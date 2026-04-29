#!/bin/bash
set -Eeuo pipefail

# 硬编码项目目录（确保在任何环境下都正确）
PROJECT_DIR="/workspace/projects/ai-venture"
cd "${PROJECT_DIR}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only
