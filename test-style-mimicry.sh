#!/bin/bash

# 风格模仿功能测试脚本

BASE_URL="http://localhost:5000"

echo "======================================"
echo "测试 1: 学习文章风格"
echo "======================================"

RESPONSE=$(curl -s -X POST "$BASE_URL/api/style-analyzer/learn" \
  -H "Content-Type: application/json" \
  -d '{
    "articles": [
      "大家好！今天我们来聊聊保险那些事儿。很多人觉得保险复杂，其实只要掌握几个要点，就能轻松选到适合自己的产品。首先，要明确自己的需求，是保障型还是理财型？其次，要了解保险的基本类型，比如重疾险、医疗险、意外险等等。最后，不要只看价格，更要看保障内容和条款。记住，买保险就是买安心，宁可备而不用，不可用而不备。",
      "朋友们好！又到了科普时间。今天要讲的是重疾险的误区。很多人觉得\"我还年轻，不用买重疾险\"，其实这是不对的。重疾险越早买越好，不仅保费便宜，而且身体条件好更容易通过核保。还有人认为\"有社保就够了\"，但社保只能报销一部分费用，重疾险是给付型的，确诊即赔，可以弥补收入损失。所以，重疾险是每个成年人必备的保障。",
      "大家好！今天分享一个实用的保险配置公式：50%医疗险 + 30%重疾险 + 15%意外险 + 5%寿险。这只是参考比例，具体还要根据个人情况调整。比如有房贷的朋友要增加寿险保额，有孩子的要考虑教育金保险。总之，保险配置要因人而异，不能一刀切。建议找专业顾问做个性化规划。"
    ],
    "categoryName": "保险科普"
  }')

echo "响应: $RESPONSE"

# 提取 template ID（简单提取）
TEMPLATE_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$TEMPLATE_ID" ]; then
  echo ""
  echo "✅ 风格学习成功！模板 ID: $TEMPLATE_ID"
  echo ""
  echo "======================================"
  echo "测试 2: 查看风格特征"
  echo "======================================"

  curl -s "$BASE_URL/api/style-analyzer/templates/$TEMPLATE_ID"
  
  echo ""
  echo ""
  echo "======================================"
  echo "测试 3: 按照风格生成新文章"
  echo "======================================"

  GENERATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/style-analyzer/generate" \
    -H "Content-Type: application/json" \
    -d "{
      \"templateId\": \"$TEMPLATE_ID\",
      \"topic\": \"如何选择适合家庭的医疗险\",
      \"additionalInstructions\": \"增加实际案例，让内容更生动\"
    }")

  echo "生成响应: $GENERATE_RESPONSE"
  
  echo ""
  echo ""
  echo "======================================"
  echo "完整文章内容（前 500 字）："
  echo "======================================"
  
  # 提取文章内容
  ARTICLE=$(echo "$GENERATE_RESPONSE" | grep -o '"article":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$ARTICLE" ]; then
    echo "$ARTICLE" | cut -c1-500
  else
    echo "未能提取文章内容"
  fi
  
  echo ""
  echo ""
  echo "======================================"
  echo "测试 4: 获取所有模板"
  echo "======================================"
  
  curl -s "$BASE_URL/api/style-analyzer/templates"
  
  echo ""
  echo ""
  echo "======================================"
  echo "测试完成！"
  echo "======================================"
else
  echo "❌ 风格学习失败"
  echo "错误响应: $RESPONSE"
  exit 1
fi
