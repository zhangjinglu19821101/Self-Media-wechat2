#!/bin/bash

# 微信公众号合规规则导入脚本
# 将公众号合规规则文件导入到 RAG 知识库

set -e

echo "========================================="
echo "微信公众号合规规则导入脚本"
echo "========================================="
echo ""

# 配置参数
API_BASE="http://localhost:5000"
RULES_FILE="./backup/download_log/AgentB/公众号合规规则合并.md"
COLLECTION_NAME="wechat_compliance_rules"

# 检查文件是否存在
if [ ! -f "$RULES_FILE" ]; then
    echo "❌ 错误：规则文件不存在：$RULES_FILE"
    exit 1
fi

echo "✅ 规则文件存在：$RULES_FILE"
echo ""

# 读取文件内容
echo "📖 读取规则文件内容..."
RULES_CONTENT=$(cat "$RULES_FILE")

echo "✅ 文件读取完成（文件大小：$(wc -c < "$RULES_FILE") 字节）"
echo ""

# 构建请求数据
echo "📦 准备导入数据..."
JSON_DATA=$(cat <<EOF
{
  "text": $(echo "$RULES_CONTENT" | jq -Rs .),
  "metadata": {
    "source": "$RULES_FILE",
    "title": "微信公众号合规规则合并文档",
    "document_type": "compliance_rules",
    "platform": "wechat",
    "category": "合规规则",
    "created_date": "2026-02-07",
    "version": "merged_v1.0"
  },
  "collectionName": "$COLLECTION_NAME"
}
EOF
)

echo "✅ 数据准备完成"
echo ""

# 发送导入请求
echo "🚀 开始导入到知识库..."
echo "   Collection: $COLLECTION_NAME"
echo ""

RESPONSE=$(curl -s -X POST "$API_BASE/api/rag/documents" \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA")

echo "📥 响应："
echo "$RESPONSE" | jq .
echo ""

# 检查是否成功
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
    CHUNK_COUNT=$(echo "$RESPONSE" | jq -r '.chunkCount')
    echo "========================================="
    echo "✅ 导入成功！"
    echo "========================================="
    echo ""
    echo "📊 导入统计："
    echo "   - Collection: $COLLECTION_NAME"
    echo "   - 文档数: 1"
    echo "   - 分块数: $CHUNK_COUNT"
    echo ""
    echo "🔍 现在可以通过以下方式查询规则："
    echo ""
    echo "   curl -X GET \"$API_BASE/api/rag/documents?query=敏感词&collectionName=$COLLECTION_NAME&topK=5\""
    echo ""
else
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    echo "❌ 导入失败：$ERROR"
    exit 1
fi
