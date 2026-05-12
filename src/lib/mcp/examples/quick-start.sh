#!/bin/bash

# ============================================
# MCP 服务端快速启动脚本
# ============================================

echo "🚀 开始设置 MCP 服务端..."
echo ""

# 1. 检查 Node.js 版本
echo "📦 检查 Node.js 版本..."
node --version
if [ $? -ne 0 ]; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

echo ""

# 2. 编译 TypeScript
echo "🔨 编译 TypeScript..."
cd /workspace/projects

if [ ! -f "node_modules/.bin/tsc" ]; then
    echo "📦 安装 TypeScript..."
    npm install -g typescript
fi

echo "编译中..."
npx tsc src/lib/mcp/examples/complete-mcp-server.ts --outDir dist/

if [ $? -ne 0 ]; then
    echo "❌ 编译失败"
    exit 1
fi

echo "✅ 编译成功！"
echo ""

# 3. 显示配置说明
echo "📋 下一步操作："
echo ""
echo "1️⃣  配置 Claude Desktop 配置文件："
echo ""
echo "   Mac:"
echo "   ~/Library/Application Support/Claude/claude_desktop_config.json"
echo ""
echo "   Linux:"
echo "   ~/.config/Claude/claude_desktop_config.json"
echo ""
echo "   Windows:"
echo "   %APPDATA%\\Claude\\claude_desktop_config.json"
echo ""
echo "2️⃣  配置文件内容："
cat << 'EOF'
{
  "mcpServers": {
    "my-awesome-server": {
      "command": "node",
      "args": [
        "/workspace/projects/dist/complete-mcp-server.js"
      ]
    }
  }
}
EOF
echo ""
echo ""
echo "3️⃣  重启 Claude Desktop"
echo ""
echo "🎉 完成！你的 MCP 服务端已经准备好了！"
echo ""
echo "💡 提示：想要测试服务端，直接运行："
echo "   node dist/complete-mcp-server.js"
echo ""
