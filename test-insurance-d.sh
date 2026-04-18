#!/bin/bash

# insurance-d 专属功能测试脚本
# 测试路径大小写修正和合规校验状态功能

echo "================================"
echo "insurance-d 专属功能测试"
echo "================================"
echo ""

# 测试 insurance-d 保存草稿（含合规校验状态）
echo "【测试 1】insurance-d 保存草稿（含合规校验状态）"
echo "--------------------------------"
RESPONSE1=$(curl -s -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "insurance-d",
    "taskId": "test-ins-001",
    "title": "养老保险全面解析",
    "content": "# 养老保险全面解析\n\n## 什么是养老保险\n\n养老保险是国家和社会根据一定的法律和法规...",
    "author": "保险科普",
    "status": "draft",
    "complianceStatus": "passed"
  }')

echo "响应："
echo "$RESPONSE1" | grep -o '"filePath":"[^"]*"'
echo ""

# 验证文件路径大小写
FILEPATH1=$(echo "$RESPONSE1" | grep -o '"filePath":"[^"]*"' | cut -d'"' -f4)
echo "文件路径：$FILEPATH1"

if [[ $FILEPATH1 =~ /insurance-Business/ ]]; then
    echo "✅ 路径大小写正确 (insurance-Business)"
else
    echo "❌ 路径大小写不正确"
fi
echo ""

# 验证文件存在
FILENAME1=$(echo "$FILEPATH1" | xargs basename)
if [ -f "$FILEPATH1" ]; then
    echo "✅ 文件已创建"
else
    echo "❌ 文件未创建"
fi
echo ""

# 验证首行标注包含合规校验状态
FIRST_LINE=$(head -n 1 "$FILEPATH1")
echo "首行标注：$FIRST_LINE"
if [[ $FIRST_LINE =~ passed ]]; then
    echo "✅ 首行标注包含合规校验状态"
else
    echo "❌ 首行标注不包含合规校验状态"
fi
echo ""

# 验证 YAML frontmatter 包含 complianceStatus
COMPLIANCE_FIELD=$(grep -c "^complianceStatus:" "$FILEPATH1" || echo "0")
if [ "$COMPLIANCE_FIELD" -eq "1" ]; then
    echo "✅ YAML frontmatter 包含 complianceStatus 字段"
else
    echo "❌ YAML frontmatter 不包含 complianceStatus 字段"
fi
echo ""

# 测试 API 返回合规校验状态
echo "【测试 2】API 返回合规校验状态"
echo "--------------------------------"
RESPONSE2=$(curl -s -X GET "http://localhost:5000/api/drafts?agentId=insurance-d")
COMPLIANCE_STATUS=$(echo "$RESPONSE2" | grep -o '"complianceStatus":"[^"]*"' | cut -d'"' -f4)
echo "API 返回的合规校验状态：$COMPLIANCE_STATUS"

if [ "$COMPLIANCE_STATUS" = "passed" ]; then
    echo "✅ API 正确返回合规校验状态"
else
    echo "❌ API 未正确返回合规校验状态"
fi
echo ""

# 测试 Agent D 保存草稿（无合规校验状态）
echo "【测试 3】Agent D 保存草稿（无合规校验状态）"
echo "--------------------------------"
RESPONSE3=$(curl -s -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "D",
    "taskId": "test-d-001",
    "title": "测试 Agent D",
    "content": "# 测试\n\n内容",
    "author": "内容主编",
    "status": "draft"
  }')

echo "响应："
echo "$RESPONSE3" | grep -o '"filePath":"[^"]*"'
echo ""

# 验证文件路径
FILEPATH3=$(echo "$RESPONSE3" | grep -o '"filePath":"[^"]*"' | cut -d'"' -f4)
echo "文件路径：$FILEPATH3"

if [[ $FILEPATH3 =~ /AI-Business/ ]]; then
    echo "✅ Agent D 路径正确 (AI-Business)"
else
    echo "❌ Agent D 路径不正确"
fi
echo ""

# 验证首行标注不包含合规校验状态
FIRST_LINE3=$(head -n 1 "$FILEPATH3")
echo "首行标注：$FIRST_LINE3"

if [[ $FIRST_LINE3 =~ passed|pending|failed ]]; then
    echo "❌ Agent D 首行标注不应包含合规校验状态"
else
    echo "✅ Agent D 首行标注不包含合规校验状态"
fi
echo ""

# 测试不同的合规校验状态
echo "【测试 4】测试不同的合规校验状态"
echo "--------------------------------"
echo "测试 pending 状态..."
RESPONSE4=$(curl -s -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "insurance-d",
    "taskId": "test-pending",
    "title": "测试 pending",
    "content": "# 内容",
    "author": "保险科普",
    "complianceStatus": "pending"
  }')
FILEPATH4=$(echo "$RESPONSE4" | grep -o '"filePath":"[^"]*"' | cut -d'"' -f4)
FIRST_LINE4=$(head -n 1 "$FILEPATH4")
if [[ $FIRST_LINE4 =~ pending ]]; then
    echo "✅ pending 状态正确"
else
    echo "❌ pending 状态不正确"
fi
echo ""

echo "测试 failed 状态..."
RESPONSE5=$(curl -s -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "insurance-d",
    "taskId": "test-failed",
    "title": "测试 failed",
    "content": "# 内容",
    "author": "保险科普",
    "complianceStatus": "failed"
  }')
FILEPATH5=$(echo "$RESPONSE5" | grep -o '"filePath":"[^"]*"' | cut -d'"' -f4)
FIRST_LINE5=$(head -n 1 "$FILEPATH5")
if [[ $FIRST_LINE5 =~ failed ]]; then
    echo "✅ failed 状态正确"
else
    echo "❌ failed 状态不正确"
fi
echo ""

# 清理测试文件
echo "【清理】删除测试文件"
echo "--------------------------------"
rm -f "$FILEPATH1"
rm -f "$FILEPATH3"
rm -f "$FILEPATH4"
rm -f "$FILEPATH5"
echo "✅ 测试文件已删除"
echo ""

echo "================================"
echo "测试完成"
echo "================================"
