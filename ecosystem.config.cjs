/**
 * PM2 进程守护配置
 * 
 * 用途：
 * 1. 进程崩溃自动重启（max_restarts 控制重启上限）
 * 2. 内存泄漏检测（max_memory_restart 超限自动重启）
 * 3. 启动延迟（restart_delay 避免频繁重启风暴）
 * 4. 日志统一管理（输出到 /app/work/logs/bypass/）
 * 
 * 使用方式：
 * - 开发环境：pm2 start ecosystem.config.cjs --env development
 * - 生产环境：pm2 start ecosystem.config.cjs --env production
 * - 查看状态：pm2 status
 * - 查看日志：pm2 logs ai-venture
 * - 停止服务：pm2 stop ai-venture
 * - 重启服务：pm2 restart ai-venture
 * 
 * 🔴 P1 修复：
 * - wait_ready: true + start.sh 中 process.send('ready')，确保服务就绪后才接收流量
 * - exec_mode: 'fork'（去除歧义，与 instances: 1 保持一致）
 * - 新增 env_production 区块
 */

module.exports = {
  apps: [
    {
      name: 'ai-venture',
      // 🔴 P1 修复：改用 Node.js 入口脚本（支持 process.send('ready')）
      script: './scripts/start.js',
      // 不再使用 bash 解释器（Node.js 是默认解释器）

      // ========== 基础配置 ==========
      cwd: process.env.COZE_WORKSPACE_PATH || '/workspace/projects',
      env: {
        NODE_ENV: 'production',
        DEPLOY_RUN_PORT: '5000',
        PORT: '5000',
      },
      env_development: {
        NODE_ENV: 'development',
        DEPLOY_RUN_PORT: '5000',
        PORT: '5000',
      },
      // 🔴 P1 修复：新增 env_production 区块，确保生产环境关键变量存在
      // 🔴 Schema 隔离：COZE_PROJECT_ENV=PROD → 使用 public schema
      env_production: {
        NODE_ENV: 'production',
        DEPLOY_RUN_PORT: '5000',
        PORT: '5000',
        COZE_PROJECT_ENV: 'PROD',
      },

      // ========== 进程守护 ==========
      // 崩溃后自动重启
      autorestart: true,
      // 最大重启次数（防止无限重启循环）
      max_restarts: 10,
      // 重启间隔 ms（避免重启风暴）
      restart_delay: 5000,
      // 内存超限自动重启（1.5GB，Next.js + LLM 缓存可能占较多内存）
      max_memory_restart: '1500M',

      // ========== 日志配置 ==========
      // 输出到统一日志目录
      output: '/app/work/logs/bypass/pm2-out.log',
      error: '/app/work/logs/bypass/pm2-error.log',
      // 合并日志（不按进程ID分文件）
      merge_logs: true,
      // 日志时间格式
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // ========== 健康检查 ==========
      // 🔴 P1 修复：wait_ready: true — 等待 start.sh 通过 IPC 发送 'ready' 信号
      // 确保服务端口监听就绪后 PM2 才标记进程为 online
      // start.sh 中需要在端口就绪后执行: process.send('ready')
      wait_ready: true,
      // 监听超时（30s 内未 ready 视为启动失败）
      listen_timeout: 30000,
      // 进程无响应超时（kill_timeout 后发送 SIGKILL）
      kill_timeout: 10000,

      // ========== 进程管理 ==========
      // 🔴 P1 修复：显式声明 fork 模式（单实例，避免 WebSocket 端口冲突）
      // instances: 1 + exec_mode: 'fork' 是 PM2 单实例的正确配置
      instances: 1,
      exec_mode: 'fork',
      // 自动重启的最低运行时间（低于此时间重启视为异常）
      min_uptime: '10s',
    },
  ],
};
