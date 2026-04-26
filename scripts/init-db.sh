#!/bin/bash
# ============================================
# 本地 PostgreSQL 数据库初始化脚本
# 用于开发环境创建本地数据库
# ============================================

set -Eeuo pipefail

DB_NAME="${DB_NAME:-dev自媒体}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "=========================================="
echo "  PostgreSQL 数据库初始化"
echo "=========================================="
echo "数据库名: $DB_NAME"
echo "用户名:   $DB_USER"
echo "主机:     $DB_HOST:$DB_PORT"
echo "=========================================="

# 检查 PostgreSQL 是否运行
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" > /dev/null 2>&1; then
    echo "❌ PostgreSQL 未运行，请先启动 PostgreSQL:"
    echo "   macOS:  brew services start postgresql@16"
    echo "   Linux:  sudo systemctl start postgresql"
    exit 1
fi

# 创建数据库（如果不存在）
echo "📦 创建数据库..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE \"$DB_NAME\""

# 创建用户（如果不存在）
echo "👤 创建用户..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS'"

# 授予权限
echo "🔐 授权..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE \"$DB_NAME\" TO $DB_USER"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER"

echo "✅ 数据库初始化完成！"
echo ""
echo "连接字符串:"
echo "postgresql://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=prefer"
echo ""
echo "请将上述连接字符串填入 .env.local 中的 DATABASE_URL"
