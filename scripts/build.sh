#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel warn --reporter=append-only 2>/dev/null || pnpm install --no-frozen-lockfile --loglevel warn

echo "Building the project with webpack..."
next build --webpack

# standalone 模式需要手动复制 static 文件
echo "Copying static files for standalone mode..."
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true

echo "Build completed successfully!"
