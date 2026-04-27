#!/bin/bash
# ============================================
# 开发环境启动脚本
# 用于本地开发，自动使用 .env.local 配置
# ============================================

set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

# 加载开发环境变量（如果存在）
if [ -f ".env.local" ]; then
    echo "[dev.sh] 加载 .env.local 开发环境配置"
    # 使用 source 加载，支持带空格的值
    set -a  # 自动导出所有变量
    source .env.local
    set +a
    echo "[dev.sh] COZE_PROJECT_ENV=${COZE_PROJECT_ENV}"
fi

# 设置开发环境变量
export NODE_ENV="development"
# 🔴 不再强制覆盖，尊重 .env.local 中的配置
export COZE_PROJECT_ENV="${COZE_PROJECT_ENV:-DEV}"
# 🔴 强制使用 5000 端口（不继承环境中的 PORT，防止被沙箱平台的 PORT=9000 污染）
# 沙箱平台 FastAPI 进程占用 9000 端口，如果继承 PORT=9000 会导致 EADDRINUSE
export PORT=5000

echo "[dev.sh] 启动开发服务器..."
echo "[dev.sh] 端口: ${PORT}"
echo "[dev.sh] 环境: ${NODE_ENV}"
echo "[dev.sh] 数据库: ${DATABASE_URL:+已配置}"

# 启动 Next.js 开发服务器（带热更新）
pnpm next dev --port ${PORT} -H 0.0.0.0
