#!/bin/bash
# ============================================
# 开发环境启动脚本
# 用于本地开发，自动使用 .env.local 配置
# ============================================

set -Eeuo pipefail

# 设置工作目录（支持环境变量覆盖）
export COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(dirname "$0"/..)}"
cd "${COZE_WORKSPACE_PATH}"

# 加载开发环境变量（如果存在）
if [ -f ".env.local" ]; then
    echo "[dev.sh] 加载 .env.local 开发环境配置"
    set -a
    source .env.local
    set +a
fi

# 设置开发环境变量
export NODE_ENV="development"
export COZE_PROJECT_ENV="${COZE_PROJECT_ENV:-DEV}"  # 允许外部覆盖，默认 DEV
export PORT="${PORT:-5000}"

echo "[dev.sh] 启动开发服务器..."
echo "[dev.sh] 端口: ${PORT}"
echo "[dev.sh] 环境: ${NODE_ENV}"
echo "[dev.sh] 数据库: ${DATABASE_URL:+已配置}"

# 清理端口占用函数
kill_port_if_listening() {
    local port=$1
    local pid=$(ss -lptn "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
    if [[ -n "$pid" ]]; then
        echo "[dev.sh] 清理端口 $port 上的进程 $pid"
        kill "$pid" 2>/dev/null || true
        sleep 1
    fi
}

# 清理端口占用（仅在非 coze dev 模式下清理，避免杀掉 coze 管理的进程）
if [[ -z "${COZE_DEV_MODE:-}" ]]; then
    kill_port_if_listening ${PORT}
else
    echo "[dev.sh] coze dev 模式，跳过端口清理"
fi

# 再次确保在正确的项目目录
cd "${COZE_WORKSPACE_PATH}"
echo "[dev.sh] 工作目录: $(pwd)"

# 检查 node_modules 是否存在，不存在则自动安装依赖
if [[ ! -d "node_modules" ]]; then
    echo "[dev.sh] node_modules 不存在，正在安装依赖..."
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    echo "[dev.sh] 依赖安装完成"
else
    echo "[dev.sh] node_modules 已存在，跳过安装"
fi

# 启动 Next.js 开发服务器（带热更新）
exec pnpm next dev --webpack --port ${PORT} -H 0.0.0.0
