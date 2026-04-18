#!/bin/bash

# 快速清理 Next.js 缓存并重启服务
# 用于解决模块导入错误、热更新失效等问题

set -e

echo "🧹 开始清理缓存..."

# 1. 停止当前服务
echo "🛑 停止当前服务..."
pkill -f "next-server" 2>/dev/null || true
sleep 2

# 2. 清理 Next.js 缓存
echo "🗑️  清理 .next 缓存..."
rm -rf .next

# 3. 清理 node_modules 缓存
echo "🗑️  清理 node_modules 缓存..."
rm -rf node_modules/.cache 2>/dev/null || true

# 4. 清理临时文件
echo "🗑️  清理临时文件..."
rm -rf /tmp/.cache 2>/dev/null || true

echo "✅ 缓存清理完成！"
echo ""
echo "🚀 启动服务..."
echo "   使用命令: coze dev"
echo ""
echo "💡 提示：如果问题依然存在，请运行完整清理："
echo "   rm -rf .next node_modules && pnpm install && coze dev"
