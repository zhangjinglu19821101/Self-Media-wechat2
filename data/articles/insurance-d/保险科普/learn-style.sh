#!/bin/bash

# 触发风格学习脚本
# 用法：./learn-style.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="http://localhost:5000"

echo "======================================"
echo "触发风格学习"
echo "======================================"
echo ""

# 确定对应的 Agent 和分类
AGENT="insurance-d"
CATEGORY="保险科普"

# 读取所有文章文件
ARTICLES=()
for file in "$SCRIPT_DIR"/*.txt; do
    if [ -f "$file" ]; then
        CONTENT=$(cat "$file")
        # 跳过空文件
        if [ -n "$CONTENT" ]; then
            ARTICLES+=("$CONTENT")
        fi
    fi
done

# 检查是否有文章
if [ ${#ARTICLES[@]} -eq 0 ]; then
    echo "❌ 错误: 没有找到文章文件"
    exit 1
fi

echo "找到 ${#ARTICLES[@]} 篇文章"
echo "Agent: $AGENT"
echo "分类: $CATEGORY"
echo "======================================"
echo ""

# 构建 JSON 数组
echo "构建请求 JSON..."
JSON_ARRAY="["
first=true
for article in "${ARTICLES[@]}"; do
    if [ "$first" = true ]; then
        first=false
    else
        JSON_ARRAY="$JSON_ARRAY,"
    fi
    # 转义 JSON 中的特殊字符
    escaped_article=$(echo "$article" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
    JSON_ARRAY="$JSON_ARRAY\"$escaped_article\""
done
JSON_ARRAY="$JSON_ARRAY]"

# 触发学习
echo "发送学习请求..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/style-analyzer/learn" \
  -H "Content-Type: application/json" \
  -d "{
    \"articles\": $JSON_ARRAY,
    \"categoryName\": \"$CATEGORY\"
  }")

# 检查响应
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo ""
    echo "✅ 学习成功！"
    echo ""
    echo "风格模板信息:"
    echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4
    echo "$RESPONSE" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4
    echo ""
    echo "置信度:"
    echo "$RESPONSE" | grep -o '"confidence":[0-9.]*' | head -1 | cut -d':' -f2
    echo ""
    echo "风格特征:"
    echo "$RESPONSE" | grep -o '"tone":"[^"]*"' | head -1
    echo "$RESPONSE" | grep -o '"vocabularyLevel":"[^"]*"' | head -1
    echo "$RESPONSE" | grep -o '"sentenceStructure":"[^"]*"' | head -1
    echo ""
    echo "完整响应:"
    echo "$RESPONSE"
else
    echo ""
    echo "❌ 学习失败"
    echo ""
    echo "错误信息:"
    echo "$RESPONSE"
    exit 1
fi

echo ""
echo "======================================"
echo "风格模板已保存，现在可以按照该风格生成新文章"
echo "======================================"
