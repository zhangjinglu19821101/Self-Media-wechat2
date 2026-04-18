#!/bin/bash

# ========================================
# 数据库便捷查询工具
# 
# 使用方法:
#   ./db.sh                    - 进入交互式模式
#   ./db.sh "SQL语句"          - 执行单条 SQL
#   ./db.sh tables             - 查看所有表
#   ./db.sh table 表名         - 查看表结构
#   ./db.sh query 表名         - 查询表数据
#   ./db.sh help               - 显示帮助
# ========================================

# 检查并安装 PostgreSQL 客户端（如果需要）
function check_and_install_psql() {
  if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL 客户端未安装，正在安装..."
    apt-get update > /dev/null 2>&1
    apt-get install -y postgresql-client > /dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo "✅ PostgreSQL 客户端安装成功！"
    else
      echo "❌ PostgreSQL 客户端安装失败，请手动安装："
      echo "   apt-get update && apt-get install -y postgresql-client"
      return 1
    fi
  fi
}

# 检查 PostgreSQL 客户端
check_and_install_psql

DATABASE_URL="postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function show_help() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}   数据库便捷查询工具${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
  echo -e "${YELLOW}使用方法:${NC}"
  echo "  ./db.sh                    - 进入交互式 psql 模式"
  echo "  ./db.sh \"SQL语句\"          - 执行单条 SQL 语句"
  echo "  ./db.sh tables             - 查看所有表"
  echo "  ./db.sh table 表名         - 查看表结构"
  echo "  ./db.sh query 表名 [行数]  - 查询表数据（默认10行）"
  echo "  ./db.sh count 表名         - 查看表记录数"
  echo "  ./db.sh help               - 显示此帮助信息"
  echo ""
  echo -e "${YELLOW}常用表名:${NC}"
  echo "  daily_tasks, agent_sub_tasks, agent_sub_tasks_step_history,"
  echo "  agent_reports, agent_notifications, capability_list, conversations, messages"
  echo ""
  echo -e "${YELLOW}示例:${NC}"
  echo "  ./db.sh tables"
  echo "  ./db.sh table capability_list"
  echo "  ./db.sh query capability_list"
  echo "  ./db.sh \"SELECT * FROM capability_list ORDER BY id;\""
  echo ""
}

if [ $# -eq 0 ]; then
  # 无参数，进入交互式模式
  echo -e "${GREEN}🔍 连接数据库...${NC}"
  echo -e "${YELLOW}提示:${NC}"
  echo "  \\dt              - 查看所有表"
  echo "  \\d 表名          - 查看表结构"
  echo "  \\q               - 退出"
  echo "  SELECT * FROM 表名 LIMIT 10;  - 查询数据"
  echo ""
  psql "$DATABASE_URL"
  exit 0
fi

case "$1" in
  help)
    show_help
    exit 0
    ;;
  tables)
    echo -e "${GREEN}📋 查看所有表...${NC}"
    psql "$DATABASE_URL" -c "\dt"
    exit 0
    ;;
  table)
    if [ -z "$2" ]; then
      echo -e "${RED}错误: 请指定表名${NC}"
      echo "使用方法: ./db.sh table 表名"
      exit 1
    fi
    echo -e "${GREEN}📊 查看表结构: $2${NC}"
    psql "$DATABASE_URL" -c "\d $2"
    exit 0
    ;;
  query)
    if [ -z "$2" ]; then
      echo -e "${RED}错误: 请指定表名${NC}"
      echo "使用方法: ./db.sh query 表名 [行数]"
      exit 1
    fi
    TABLE_NAME="$2"
    LIMIT="${3:-10}"
    echo -e "${GREEN}🔍 查询表数据: $TABLE_NAME (前 $LIMIT 行)${NC}"
    psql "$DATABASE_URL" -c "SELECT * FROM $TABLE_NAME LIMIT $LIMIT;"
    exit 0
    ;;
  count)
    if [ -z "$2" ]; then
      echo -e "${RED}错误: 请指定表名${NC}"
      echo "使用方法: ./db.sh count 表名"
      exit 1
    fi
    echo -e "${GREEN}📊 查看表记录数: $2${NC}"
    psql "$DATABASE_URL" -c "SELECT COUNT(*) as record_count FROM $2;"
    exit 0
    ;;
  *)
    # 执行自定义 SQL
    echo -e "${GREEN}📝 执行 SQL:${NC}"
    echo -e "${YELLOW}$*${NC}"
    echo ""
    psql "$DATABASE_URL" -c "$*"
    exit 0
    ;;
esac
