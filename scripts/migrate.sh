#!/bin/bash
# ============================================
# 数据库迁移脚本
# 用于开发环境执行数据库 Schema 迁移
# ============================================

set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
cd "${COZE_WORKSPACE_PATH}"

echo "=========================================="
echo "  数据库迁移"
echo "=========================================="

# 检查 DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ DATABASE_URL 未设置"
    echo "请确保 .env.local 已正确配置"
    exit 1
fi

# 执行 Drizzle 迁移
echo "📦 执行 Drizzle 迁移..."
npx drizzle-kit push

echo "✅ 迁移完成！"
