#!/bin/bash

# PostgreSQL 数据库连接脚本
# 使用方法：
#   ./connect-db.sh                    # 进入交互式 psql 终端
#   ./connect-db.sh -c "SQL语句"     # 执行单条 SQL 语句
#   ./connect-db.sh -f filename.sql   # 执行 SQL 文件

DATABASE_URL="postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require"

if [ "$1" = "-c" ]; then
    # 执行单条 SQL 语句
    shift
    echo "🔍 执行 SQL: $@"
    echo ""
    psql "$DATABASE_URL" -c "$@"
elif [ "$1" = "-f" ]; then
    # 执行 SQL 文件
    shift
    echo "📄 执行 SQL 文件: $1"
    echo ""
    psql "$DATABASE_URL" -f "$1"
else
    # 进入交互式终端
    echo "🗄️  进入 PostgreSQL 交互式终端"
    echo "ℹ️  输入 \\q 退出"
    echo ""
    psql "$DATABASE_URL"
fi

