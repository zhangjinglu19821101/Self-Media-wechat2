#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

# 禁用 Turbopack（Vercel 构建必须使用 webpack）
export NEXT_NO_TURBOPACK=1
export TURBOPACK=0

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel warn --reporter=append-only 2>/dev/null || pnpm install --no-frozen-lockfile --loglevel warn

# 修补 lightningcss
echo "Patching lightningcss for Turbopack compatibility..."
node scripts/postinstall.js

echo "Building the project with webpack..."
next build --webpack

echo "Build completed successfully!"
