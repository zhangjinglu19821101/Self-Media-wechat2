#!/bin/bash

# 草稿存储功能测试脚本
# 测试新的命名规范和首行标注功能

echo "================================"
echo "草稿存储功能测试"
echo "================================"
echo ""

# 测试 Agent D 的草稿保存
echo "【测试 1】Agent D 保存草稿"
echo "--------------------------------"
RESPONSE1=$(curl -s -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "D",
    "taskId": "test-001",
    "title": "普通人必懂的医保报销误区",
    "content": "# 普通人必懂的医保报销误区\n\n## 误区一：医保可以报销所有医疗费用\n\n实际上，医保只能报销符合规定的医疗费用。",
    "author": "内容主编",
    "status": "draft"
  }')

echo "响应："
echo "$RESPONSE1" | grep -o '"filePath":"[^"]*"'
echo ""

# 验证文件名格式
FILENAME1=$(echo "$RESPONSE1" | grep -o '"filePath":"[^"]*"' | cut -d'"' -f4 | xargs basename)
echo "文件名：$FILENAME1"
echo "预期格式：test-001_普通人必_YYYYMMDD.md"

# 检查命名规范
if [[ $FILENAME1 =~ ^test-001_[^_]+_[0-9]{8}\.md$ ]]; then
    echo "✅ 文件名格式正确"
else
    echo "❌ 文件名格式不正确"
fi
echo ""

# 验证文件存在
if [ -f "/workspace/projects/AI-Business/draft-article/agent-d/$FILENAME1" ]; then
    echo "✅ 文件已创建"
else
    echo "❌ 文件未创建"
fi
echo ""

# 验证首行标注
FIRST_LINE=$(head -n 1 "/workspace/projects/AI-Business/draft-article/agent-d/$FILENAME1")
echo "首行标注：$FIRST_LINE"
if [[ $FIRST_LINE =~ ^test-001\ .+ ]]; then
    echo "✅ 首行标注格式正确"
else
    echo "❌ 首行标注格式不正确"
fi
echo ""

# 测试获取草稿列表
echo "【测试 2】获取 Agent D 草稿列表"
echo "--------------------------------"
RESPONSE2=$(curl -s -X GET "http://localhost:5000/api/drafts?agentId=D")
LIST_FILENAME=$(echo "$RESPONSE2" | grep -o '"fileName":"[^"]*"' | cut -d'"' -f4)
echo "API 返回的文件名：$LIST_FILENAME"

if [ "$LIST_FILENAME" = "$FILENAME1" ]; then
    echo "✅ API 返回的文件名与实际文件名一致"
else
    echo "❌ API 返回的文件名与实际文件名不一致"
fi
echo ""

# 测试 insurance-d 的草稿保存
echo "【测试 3】insurance-d 保存草稿"
echo "--------------------------------"
RESPONSE3=$(curl -s -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "insurance-d",
    "taskId": "test-ins-001",
    "title": "养老保险全面解析：如何规划养老生活",
    "content": "# 养老保险全面解析\n\n## 什么是养老保险\n\n养老保险是国家和社会根据一定的法律和法规...",
    "author": "保险科普",
    "status": "draft"
  }')

echo "响应："
echo "$RESPONSE3" | grep -o '"filePath":"[^"]*"'
echo ""

# 验证文件名格式
FILENAME3=$(echo "$RESPONSE3" | grep -o '"filePath":"[^"]*"' | cut -d'"' -f4 | xargs basename)
echo "文件名：$FILENAME3"
echo "预期格式：test-ins-001_养老保险_YYYYMMDD.md"

# 检查命名规范
if [[ $FILENAME3 =~ ^test-ins-001_[^_]+_[0-9]{8}\.md$ ]]; then
    echo "✅ 文件名格式正确"
else
    echo "❌ 文件名格式不正确"
fi
echo ""

# 验证文件存在
if [ -f "/workspace/projects/insurance-business/draft-article/insurance-d/$FILENAME3" ]; then
    echo "✅ 文件已创建"
else
    echo "❌ 文件未创建"
fi
echo ""

# 验证首行标注
FIRST_LINE3=$(head -n 1 "/workspace/projects/insurance-business/draft-article/insurance-d/$FILENAME3")
echo "首行标注：$FIRST_LINE3"
if [[ $FIRST_LINE3 =~ ^test-ins-001\ .+ ]]; then
    echo "✅ 首行标注格式正确"
else
    echo "❌ 首行标注格式不正确"
fi
echo ""

# 测试读取草稿
echo "【测试 4】读取 Agent D 草稿"
echo "--------------------------------"
RESPONSE4=$(curl -s -X GET "http://localhost:5000/api/drafts/$FILENAME1?agentId=D")
echo "读取结果："
echo "$RESPONSE4" | grep -o '"title":"[^"]*"'
echo ""

# 清理测试文件
echo "【清理】删除测试文件"
echo "--------------------------------"
rm -f "/workspace/projects/AI-Business/draft-article/agent-d/$FILENAME1"
rm -f "/workspace/projects/insurance-business/draft-article/insurance-d/$FILENAME3"
echo "✅ 测试文件已删除"
echo ""

echo "================================"
echo "测试完成"
echo "================================"
