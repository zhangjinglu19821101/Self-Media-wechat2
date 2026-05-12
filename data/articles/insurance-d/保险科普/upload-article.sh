#!/bin/bash

# 文章上传到草稿箱脚本
# 用法：./upload-article.sh <文件名> [标题] [作者]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="http://localhost:5000"

# 检查参数
if [ -z "$1" ]; then
    echo "用法: $0 <文件名> [标题] [作者]"
    echo ""
    echo "示例:"
    echo "  $0 example1.txt"
    echo "  $0 example1.txt \"我的文章标题\" \"保险科普\""
    echo ""
    echo "可用文章:"
    ls -1 "$SCRIPT_DIR"/*.txt 2>/dev/null | xargs -n1 basename
    exit 1
fi

# 获取参数
FILE="$1"
TITLE="${2:-}"
AUTHOR="${3:-保险科普}"

# 检查文件是否存在
if [ ! -f "$SCRIPT_DIR/$FILE" ]; then
    echo "❌ 错误: 文件不存在: $FILE"
    exit 1
fi

# 读取文件内容
CONTENT=$(cat "$SCRIPT_DIR/$FILE")

# 如果没有提供标题，使用文件名
if [ -z "$TITLE" ]; then
    TITLE=$(basename "$FILE" .txt)
fi

# 获取摘要（前100字）
DIGEST=$(echo "$CONTENT" | head -c 100 | sed 's/<[^>]*>//g' | tr -d '\n')

# 确定对应的 Agent
AGENT="insurance-d"
if [[ "$(pwd)" == *"agent-d"* ]]; then
    AGENT="agent-d"
    AUTHOR="${3:-AI技术}"
fi

echo "======================================"
echo "上传文章到草稿箱"
echo "======================================"
echo "文件: $FILE"
echo "标题: $TITLE"
echo "作者: $AUTHOR"
echo "Agent: $AGENT"
echo "======================================"
echo ""

# 上传文章
RESPONSE=$(curl -s -X POST "$BASE_URL/api/wechat/draft/upload" \
  -H "Content-Type: application/json" \
  -d "{
    \"agent\": \"$AGENT\",
    \"title\": \"$TITLE\",
    \"content\": \"$(echo "$CONTENT" | sed 's/"/\\"/g' | tr '\n' ' ')\",
    \"author\": \"$AUTHOR\",
    \"digest\": \"$DIGEST\"
  }")

# 检查响应
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ 上传成功！"
    echo ""
    echo "$RESPONSE" | grep -o '"mediaId":"[^"]*"' | cut -d'"' -f4
else
    echo "❌ 上传失败"
    echo ""
    echo "错误信息:"
    echo "$RESPONSE"
    exit 1
fi

echo ""
echo "======================================"
echo "你可以在微信公众号后台查看草稿"
echo "======================================"
