#!/bin/bash

# ============================================
# MCP 工具动态注册 API 测试脚本
# ============================================

BASE_URL="http://localhost:5000/api/mcp/register-tool"

echo "============================================"
echo "🧪 MCP 工具动态注册 API 测试"
echo "============================================"
echo ""

# ============================================
# 1. 获取当前已注册的工具列表
# ============================================
echo "📋 步骤 1: 获取当前已注册的工具列表"
echo "GET $BASE_URL"
echo ""

response=$(curl -s -X GET "$BASE_URL")
echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""
echo "✅ 步骤 1 完成"
echo ""

# ============================================
# 2. 注册邮件工具
# ============================================
echo "📧 步骤 2: 注册邮件工具"
echo "POST $BASE_URL"
echo ""

curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "email",
    "description": "邮件相关工具：发送邮件",
    "tools": {
      "sendEmail": "function(params) { console.log('\''发送邮件:'\'', params); return { success: true }; }"
    }
  }' | python3 -m json.tool 2>/dev/null || echo "注意：函数无法通过 JSON 直接传递，请使用完整的工具实现"
echo ""
echo "⚠️  提示：通过 JSON 传递函数有限制，建议使用完整的工具实现"
echo ""

# ============================================
# 3. 再次获取工具列表
# ============================================
echo "📋 步骤 3: 再次获取工具列表"
echo "GET $BASE_URL"
echo ""

response=$(curl -s -X GET "$BASE_URL")
echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
echo ""
echo "✅ 步骤 3 完成"
echo ""

# ============================================
# 使用说明
# ============================================
echo "============================================"
echo "📖 使用说明"
echo "============================================"
echo ""
echo "由于 JSON 无法直接传递函数，建议："
echo ""
echo "1️⃣  在代码中直接调用 toolRegistry.registerTool()"
echo ""
echo "   示例："
echo "   import { toolRegistry } from '\''@/lib/mcp/tool-registry'\';"
echo "   import { EmailMCPTools } from '\''@/lib/mcp/email-tools'\';"
echo "   toolRegistry.registerTool('\''email'\'', EmailMCPTools, '\''邮件工具'\'');"
echo ""
echo "2️⃣  或者创建一个完整的工具实现文件，然后在代码中注册"
echo ""
echo "3️⃣  这个 API 主要用于："
echo "   - 查看已注册的工具列表"
echo "   - 测试 API 是否正常工作"
echo "   - 简单的工具（不包含复杂函数）"
echo ""
echo "============================================"
echo "✅ 测试完成！"
echo "============================================"
