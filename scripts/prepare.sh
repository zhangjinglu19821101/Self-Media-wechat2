#!/bin/bash
set -Eeuo pipefail

# 设置项目目录（支持环境变量覆盖）
PROJECT_DIR="${COZE_WORKSPACE_PATH:-$(dirname "$0"/..)}"
cd "${PROJECT_DIR}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only
