#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel warn --reporter=append-only 2>/dev/null || pnpm install --no-frozen-lockfile --loglevel warn

echo "Building the project with webpack..."
next build --webpack

echo "Build completed successfully!"
