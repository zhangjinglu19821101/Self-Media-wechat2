#!/usr/bin/env node
/**
 * PM2 启动入口脚本
 * 
 * 🔴 P1 修复：支持 PM2 wait_ready 信号
 * 
 * 功能：
 * 1. 启动 Next.js 服务（npx next start）
 * 2. 轮询端口直到服务就绪
 * 3. 通过 IPC 向 PM2 发送 'ready' 信号
 * 4. 透传子进程的标准输出/错误
 * 
 * 使用场景：
 * - PM2 配置 wait_ready: true 时，需要进程主动通知就绪状态
 * - bash 脚本无法调用 process.send()，因此改用 Node.js 入口
 */

const { spawn } = require('child_process');
const http = require('http');

const COZE_WORKSPACE_PATH = process.env.COZE_WORKSPACE_PATH || process.cwd();
const PORT = process.env.DEPLOY_RUN_PORT || process.env.PORT || '5000';
const READY_CHECK_INTERVAL = 1000; // 每 1s 检查一次端口
const READY_CHECK_TIMEOUT = 30000; // 30s 超时

/**
 * 检查端口是否已监听
 */
function checkPortReady(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/system/health`, (res) => {
      res.resume(); // 消费响应体
      resolve(res.statusCode < 500); // 2xx/3xx/4xx 都算就绪
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 等待服务就绪
 */
async function waitForReady(port, timeoutMs) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const ready = await checkPortReady(port);
    if (ready) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, READY_CHECK_INTERVAL));
  }
  
  return false;
}

// ========== 主流程 ==========
console.log(`[start.js] 启动 Next.js 服务 (port=${PORT})...`);
console.log(`[start.js] 工作目录: ${COZE_WORKSPACE_PATH}`);

// 启动 Next.js 子进程
const child = spawn('npx', ['next', 'start', '--port', PORT], {
  cwd: COZE_WORKSPACE_PATH,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
});

// 透传子进程输出
child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('exit', (code, signal) => {
  console.log(`[start.js] Next.js 进程退出: code=${code}, signal=${signal}`);
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`[start.js] Next.js 进程启动失败:`, error);
  process.exit(1);
});

// 等待端口就绪后通知 PM2
(async () => {
  console.log(`[start.js] 等待服务就绪 (超时: ${READY_CHECK_TIMEOUT}ms)...`);
  const ready = await waitForReady(PORT, READY_CHECK_TIMEOUT);
  
  if (ready) {
    console.log(`[start.js] ✅ 服务已就绪，通知 PM2`);
    // 🔴 关键：通过 IPC 通知 PM2 进程已就绪
    if (typeof process.send === 'function') {
      process.send('ready');
    } else {
      console.log(`[start.js] 非 PM2 环境，跳过 ready 信号`);
    }
  } else {
    console.error(`[start.js] ❌ 服务就绪超时 (${READY_CHECK_TIMEOUT}ms)`);
    // 即使超时也发送 ready，避免 PM2 一直等待
    // 服务可能仍在启动中，PM2 的 listen_timeout 会处理
    if (typeof process.send === 'function') {
      process.send('ready');
    }
  }
})();
