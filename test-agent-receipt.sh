#!/bin/bash

# Agent 回执和状态反馈功能测试脚本

echo "================================"
echo "Agent 回执和状态反馈功能测试"
echo "================================"
echo ""

# 测试 1：生成成功的任务接收回执
echo "【测试 1】生成成功的任务接收回执"
echo "--------------------------------"
RESPONSE1=$(curl -s -X POST http://localhost:5000/api/agents/receipt \
  -H "Content-Type: application/json" \
  -d '{
    "type": "receipt",
    "params": {
      "taskId": "task-001",
      "status": "success"
    }
  }')

echo "响应："
echo "$RESPONSE1" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | sed 's/\\n/\n/g'
echo ""

# 验证格式
CONTENT1=$(echo "$RESPONSE1" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | sed 's/\\n/\n/g')
if echo "$CONTENT1" | grep -q "任务ID【task-001】"; then
    echo "✅ 任务ID格式正确"
else
    echo "❌ 任务ID格式不正确"
fi

if echo "$CONTENT1" | grep -q "指令接收状态【成功】"; then
    echo "✅ 指令接收状态格式正确"
else
    echo "❌ 指令接收状态格式不正确"
fi

if echo "$CONTENT1" | grep -q "执行准备【已明确核心要求，进入执行阶段】"; then
    echo "✅ 执行准备格式正确"
else
    echo "❌ 执行准备格式不正确"
fi
echo ""

# 测试 2：生成失败的任务接收回执
echo "【测试 2】生成失败的任务接收回执"
echo "--------------------------------"
RESPONSE2=$(curl -s -X POST http://localhost:5000/api/agents/receipt \
  -H "Content-Type: application/json" \
  -d '{
    "type": "receipt",
    "params": {
      "status": "failed",
      "failureReason": "指令无核心任务ID"
    }
  }')

echo "响应："
echo "$RESPONSE2" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | sed 's/\\n/\n/g'
echo ""

# 验证格式
CONTENT2=$(echo "$RESPONSE2" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | sed 's/\\n/\n/g')
if echo "$CONTENT2" | grep -q "任务ID【无】"; then
    echo "✅ 任务ID格式正确（无任务ID）"
else
    echo "❌ 任务ID格式不正确"
fi

if echo "$CONTENT2" | grep -q "指令接收状态【失败（失败原因：指令无核心任务ID）】"; then
    echo "✅ 失败状态格式正确"
else
    echo "❌ 失败状态格式不正确"
fi

if echo "$CONTENT2" | grep -q "执行准备【需补充核心信息】"; then
    echo "✅ 执行准备格式正确"
else
    echo "❌ 执行准备格式不正确"
fi
echo ""

# 测试 3：生成任务状态反馈（执行中）
echo "【测试 3】生成任务状态反馈（执行中）"
echo "--------------------------------"
RESPONSE3=$(curl -s -X POST http://localhost:5000/api/agents/receipt \
  -H "Content-Type: application/json" \
  -d '{
    "type": "status-feedback",
    "params": {
      "taskId": "task-001",
      "taskName": "创作公众号文章",
      "receivedTime": "2026-02-03 14:30",
      "executionStatus": "in-progress",
      "progress": "内容创作完成8/10篇",
      "completedNodes": ["选题审核通过", "3篇文章上传草稿箱"],
      "pendingItems": ["剩余2篇文章18:00前完成"],
      "issues": "无"
    }
  }')

echo "响应："
echo "$RESPONSE3" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | sed 's/\\n/\n/g'
echo ""

# 验证格式
CONTENT3=$(echo "$RESPONSE3" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | sed 's/\\n/\n/g')
if echo "$CONTENT3" | grep -q "任务基础信息：任务ID【task-001】"; then
    echo "✅ 任务基础信息格式正确"
else
    echo "❌ 任务基础信息格式不正确"
fi

if echo "$CONTENT3" | grep -q "当前执行状态【执行中】"; then
    echo "✅ 执行状态格式正确"
else
    echo "❌ 执行状态格式不正确"
fi

if echo "$CONTENT3" | grep -q "核心完成进度【内容创作完成8/10篇】"; then
    echo "✅ 完成进度格式正确"
else
    echo "❌ 完成进度格式不正确"
fi

if echo "$CONTENT3" | grep -q "已完成核心节点【选题审核通过、3篇文章上传草稿箱】"; then
    echo "✅ 已完成核心节点格式正确"
else
    echo "❌ 已完成核心节点格式不正确"
fi

if echo "$CONTENT3" | grep -q "待办核心事项【剩余2篇文章18:00前完成】"; then
    echo "✅ 待办核心事项格式正确"
else
    echo "❌ 待办核心事项格式不正确"
fi

if echo "$CONTENT3" | grep -q "当前问题/异常【无】"; then
    echo "✅ 当前问题/异常格式正确"
else
    echo "❌ 当前问题/异常格式不正确"
fi
echo ""

# 测试 4：生成任务状态反馈（已完成）
echo "【测试 4】生成任务状态反馈（已完成）"
echo "--------------------------------"
RESPONSE4=$(curl -s -X POST http://localhost:5000/api/agents/receipt \
  -H "Content-Type: application/json" \
  -d '{
    "type": "status-feedback",
    "params": {
      "taskId": "task-002",
      "taskName": "公众号涨粉目标",
      "receivedTime": "2026-02-03 10:00",
      "executionStatus": "completed",
      "progress": "涨粉完成400/2000",
      "completedNodes": ["当日互动数据统计完成"],
      "pendingItems": [],
      "issues": "无"
    }
  }')

echo "响应："
echo "$RESPONSE4" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | sed 's/\\n/\n/g'
echo ""

# 测试 5：生成任务状态反馈（暂停）
echo "【测试 5】生成任务状态反馈（暂停）"
echo "--------------------------------"
RESPONSE5=$(curl -s -X POST http://localhost:5000/api/agents/receipt \
  -H "Content-Type: application/json" \
  -d '{
    "type": "status-feedback",
    "params": {
      "taskId": "task-003",
      "taskName": "问一问解答",
      "receivedTime": "2026-02-03 09:00",
      "executionStatus": "paused",
      "executionStatusReason": "公众号后台无法访问",
      "progress": "问一问解答完成25条",
      "completedNodes": [],
      "pendingItems": ["明日10:00前提交周复盘"],
      "issues": "客观障碍（公众号后台无法访问）"
    }
  }')

echo "响应："
echo "$RESPONSE5" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | sed 's/\\n/\n/g'
echo ""

# 验证暂停状态格式
CONTENT5=$(echo "$RESPONSE5" | grep -o '"content":"[^"]*"' | cut -d'"' -f4 | sed 's/\\n/\n/g')
if echo "$CONTENT5" | grep -q "当前执行状态【暂停（公众号后台无法访问）】"; then
    echo "✅ 暂停状态格式正确"
else
    echo "❌ 暂停状态格式不正确"
fi

if echo "$CONTENT5" | grep -q "当前问题/异常【客观障碍（公众号后台无法访问）】"; then
    echo "✅ 客观障碍格式正确"
else
    echo "❌ 客观障碍格式不正确"
fi
echo ""

# 测试 6：验证不支持的操作类型
echo "【测试 6】验证不支持的操作类型"
echo "--------------------------------"
RESPONSE6=$(curl -s -X POST http://localhost:5000/api/agents/receipt \
  -H "Content-Type: application/json" \
  -d '{
    "type": "invalid-type",
    "params": {}
  }')

if echo "$RESPONSE6" | grep -q "不支持的操作类型"; then
    echo "✅ 正确返回不支持的操作类型错误"
else
    echo "❌ 未正确返回错误"
fi
echo ""

echo "================================"
echo "测试完成"
echo "================================"
