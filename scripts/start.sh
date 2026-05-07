#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
# 🔴 强制使用 5000 端口（不继承环境中的 PORT，防止被沙箱平台的 PORT=9000 污染）
PORT=5000
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

cd "${COZE_WORKSPACE_PATH}"
echo "Starting HTTP service on port ${DEPLOY_RUN_PORT} for deploy..."

# standalone 模式启动方式
# 设置 HOSTNAME 为 0.0.0.0 以接受外部请求
export HOSTNAME="0.0.0.0"
export PORT="${DEPLOY_RUN_PORT}"

# 使用 standalone 模式的 server.js 启动
node .next/standalone/server.js
