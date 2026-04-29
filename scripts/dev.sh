#!/bin/bash
# ============================================
# 开发环境启动脚本
# 用于本地开发，自动使用 .env.local 配置
# ============================================

set -Eeuo pipefail

# 硬编码项目目录（确保在任何环境下都正确）
export COZE_WORKSPACE_PATH="/workspace/projects/ai-venture"
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
# 🔴 不再强制覆盖，尊重 .env.local 中的配置
export COZE_PROJECT_ENV="${COZE_PROJECT_ENV:-DEV}"
# 🔴 强制使用 5000 端口（不继承环境中的 PORT，防止被沙箱平台的 PORT=9000 污染）
export PORT=5000

# ============================================
# 端口占用自动清理
# 如果 5000 端口被占用（残留的 Next.js 进程），自动 kill 后再启动
# ============================================
kill_port_if_listening() {
    local port=$1
    local pids
    pids=$(ss -H -lntp 2>/dev/null | awk -v p="${port}" '$4 ~ ":"p"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -z "${pids}" ]]; then
      echo "[dev.sh] 端口 ${port} 空闲，可直接启动"
      return 0
    fi
    echo "[dev.sh] 端口 ${port} 被占用 (PID: ${pids})，正在清理..."
    echo "${pids}" | xargs -I {} kill -9 {} 2>/dev/null || true
    sleep 1
    # 二次检查
    pids=$(ss -H -lntp 2>/dev/null | awk -v p="${port}" '$4 ~ ":"p"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -n "${pids}" ]]; then
      echo "[dev.sh] ⚠️ 端口 ${port} 仍被占用 (PID: ${pids})，无法清理"
      return 1
    fi
    echo "[dev.sh] 端口 ${port} 已清理"
    return 0
}

echo "[dev.sh] 启动开发服务器..."
echo "[dev.sh] 端口: ${PORT}"
echo "[dev.sh] 环境: ${NODE_ENV}"
echo "[dev.sh] 数据库: ${DATABASE_URL:+已配置}"

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
# 使用 nohup + 长期运行方式，避免后台进程被系统终止
exec pnpm next dev --port ${PORT} -H 0.0.0.0
