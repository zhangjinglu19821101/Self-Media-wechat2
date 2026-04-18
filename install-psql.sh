#!/bin/bash

# ========================================
# PostgreSQL 客户端安装脚本
# 
# 使用方法:
#   ./install-psql.sh    - 安装 PostgreSQL 客户端
# ========================================

echo "========================================"
echo "  安装 PostgreSQL 客户端"
echo "========================================"
echo ""

# 检查是否已安装
if command -v psql &> /dev/null; then
  echo "✅ PostgreSQL 客户端已安装！"
  echo "   版本: $(psql --version)"
  echo ""
  echo "可以使用 ./db.sh 进行数据库查询"
  exit 0
fi

echo "📦 正在安装 PostgreSQL 客户端..."
echo ""

# 更新包列表
echo "1/2 更新包列表..."
apt-get update -qq

# 安装 PostgreSQL 客户端
echo "2/2 安装 postgresql-client..."
apt-get install -y -qq postgresql-client

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ PostgreSQL 客户端安装成功！"
  echo "   版本: $(psql --version)"
  echo ""
  echo "现在可以使用 ./db.sh 进行数据库查询了！"
  echo ""
  echo "快速开始："
  echo "  ./db.sh help              - 查看帮助"
  echo "  ./db.sh tables            - 查看所有表"
  echo "  ./db.sh query capability_list  - 查询能力清单表"
else
  echo ""
  echo "❌ 安装失败！"
  echo "请手动执行："
  echo "  apt-get update && apt-get install -y postgresql-client"
  exit 1
fi
