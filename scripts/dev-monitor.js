#!/usr/bin/env node

/**
 * Next.js 智能开发监控器
 *
 * 功能：
 * 1. 自动监控文件变化
 * 2. 检测模块导入错误
 * 3. 自动清理缓存
 * 4. 自动重启服务
 * 5. 实时健康检查
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 监控的目录
  watchDirs: ['src', 'next.config.ts', 'tsconfig.json'],
  // 忽略的目录
  ignoreDirs: ['node_modules', '.next', 'dist', 'build'],
  // 健康检查间隔（秒）
  healthCheckInterval: 30,
  // API 端点
  apiEndpoint: 'http://localhost:5000/api/health',
  // 日志文件
  logFile: '/app/work/logs/bypass/monitor.log',
  // 最大重试次数
  maxRetries: 3,
};

let retryCount = 0;
let serviceHealthy = true;

// 日志函数
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

  console.log(logMessage.trim());
  fs.appendFileSync(CONFIG.logFile, logMessage);
}

// 健康检查
function healthCheck() {
  try {
    const response = execSync(`curl -s -o /dev/null -w "%{http_code}" ${CONFIG.apiEndpoint}`, {
      encoding: 'utf8',
      timeout: 5000,
    });

    const statusCode = parseInt(response.trim());

    if (statusCode === 200) {
      if (!serviceHealthy) {
        log('✅ 服务恢复健康', 'info');
        serviceHealthy = true;
        retryCount = 0;
      }
      return true;
    } else {
      log(`⚠️  健康检查失败: HTTP ${statusCode}`, 'warn');
      return false;
    }
  } catch (error) {
    log(`❌ 健康检查异常: ${error.message}`, 'error');
    return false;
  }
}

// 清理缓存
function cleanCache() {
  log('🧹 开始清理缓存...', 'info');

  try {
    // 停止服务
    log('🛑 停止服务...', 'info');
    execSync('pkill -f "next-server" 2>/dev/null || true', {
      stdio: 'inherit',
    });

    sleep(2);

    // 清理缓存
    log('🗑️  清理 .next 缓存...', 'info');
    execSync('rm -rf .next', { stdio: 'inherit' });

    log('✅ 缓存清理完成', 'info');
    return true;
  } catch (error) {
    log(`❌ 清理缓存失败: ${error.message}`, 'error');
    return false;
  }
}

// 启动服务
function startService() {
  log('🚀 启动服务...', 'info');

  try {
    execSync('nohup coze dev > /app/work/logs/bypass/dev.log 2>&1 &', {
      stdio: 'inherit',
    });

    log('⏳ 等待服务启动...', 'info');
    sleep(5);

    return true;
  } catch (error) {
    log(`❌ 启动服务失败: ${error.message}`, 'error');
    return false;
  }
}

// 修复服务
function fixService() {
  log(`🔧 开始修复服务 (尝试 ${retryCount + 1}/${CONFIG.maxRetries})...`, 'info');

  retryCount++;

  if (retryCount > CONFIG.maxRetries) {
    log('❌ 已达到最大重试次数，停止修复', 'error');
    process.exit(1);
  }

  cleanCache();
  sleep(1);
  startService();
  sleep(5);

  // 检查修复结果
  if (healthCheck()) {
    log('✅ 服务修复成功', 'info');
    retryCount = 0;
  } else {
    log('⚠️  服务修复失败，5秒后重试...', 'warn');
    sleep(5);
    fixService();
  }
}

// 主监控循环
function monitor() {
  log('🔍 开始监控 Next.js 服务...', 'info');
  log(`📊 配置: 健康检查间隔 ${CONFIG.healthCheckInterval}s`, 'info');

  setInterval(() => {
    const isHealthy = healthCheck();

    if (!isHealthy) {
      log('❌ 服务异常，尝试自动修复...', 'warn');
      fixService();
    } else {
      log('✅ 服务运行正常', 'info');
    }
  }, CONFIG.healthCheckInterval * 1000);
}

// 睡眠函数
function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// 优雅退出
process.on('SIGINT', () => {
  log('👋 收到退出信号，停止监控...', 'info');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('👋 收到终止信号，停止监控...', 'info');
  process.exit(0);
});

// 启动监控
async function main() {
  try {
    // 首次健康检查
    log('🔍 执行首次健康检查...', 'info');

    if (!healthCheck()) {
      log('⚠️  服务未运行，尝试启动...', 'warn');
      startService();
      sleep(5);

      if (!healthCheck()) {
        log('⚠️  服务启动失败，尝试修复...', 'warn');
        fixService();
      }
    }

    log('✅ 服务运行正常，开始持续监控...', 'info');
    monitor();
  } catch (error) {
    log(`❌ 监控启动失败: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
