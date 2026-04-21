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
 */

module.exports = {
  apps: [
    {
      name: 'ai-venture',
      script: './scripts/start.sh',
      interpreter: '/bin/bash',

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
      // 启动等待时间（Next.js 启动较慢，给予足够时间）
      wait_ready: false,
      // 监听超时（30s 内未 ready 视为启动失败）
      listen_timeout: 30000,
      // 进程无响应超时（kill_timeout 后发送 SIGKILL）
      kill_timeout: 10000,

      // ========== 进程管理 ==========
      // 不以集群模式运行（单实例，避免 WebSocket 端口冲突）
      instances: 1,
      exec_mode: 'fork',
      // 自动重启的最低运行时间（低于此时间重启视为异常）
      min_uptime: '10s',
    },
  ],
};
