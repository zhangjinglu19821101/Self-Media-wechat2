#!/bin/bash

# Next.js Turbopack 开发脚本
#
# 优势：
# 1. 性能提升 10 倍（Rust 编写）
# 2. 智能缓存管理
# 3. 更快的 HMR
# 4. 自动依赖追踪
# 5. 减少内存占用

set -e

echo "🚀 启动 Next.js 开发服务器 (Turbopack 模式)"
echo "=========================================="
echo "📌 优势："
echo "   • 性能提升 10x+"
echo "   • 智能缓存管理"
echo "   • 更快的热更新"
echo "   • 自动依赖追踪"
echo "=========================================="
echo ""

# 设置环境变量
export TURBOPACK_ENABLED=1
export NEXT_DISABLE_TURBOPACK_WARNINGS=1

# 清理旧的端口占用
echo "🔧 检查端口 5000..."
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "⚠️  端口 5000 被占用，正在清理..."
  pkill -f "next-server" 2>/dev/null || true
  sleep 2
fi

# 启动开发服务器
echo "✨ 启动服务..."
echo ""

# 使用 Turbopack 启动（Next.js 16+ 原生支持）
pnpm next dev --turbopack --port 5000

# 如果上面的命令失败，回退到普通模式
if [ $? -ne 0 ]; then
  echo "⚠️  Turbopack 启动失败，回退到普通模式..."
  pnpm next dev --port 5000
fi
