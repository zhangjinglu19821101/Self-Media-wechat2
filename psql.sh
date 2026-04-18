#!/bin/bash

# PostgreSQL 便捷连接脚本
# 使用方法: ./psql.sh [SQL语句]

DATABASE_URL="postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require"

if [ $# -gt 0 ]; then
  # 如果有参数，直接执行 SQL
  psql "$DATABASE_URL" -c "$*"
else
  # 否则进入交互式模式
  echo "🔍 连接数据库..."
  echo "提示: 使用 \dt 查看所有表"
  echo "      使用 \q 退出"
  echo ""
  psql "$DATABASE_URL"
fi
