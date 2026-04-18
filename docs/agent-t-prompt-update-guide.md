# 🤖 Agent T 提示词简化 - 仅保留公众号文章格式化功能

## ✅ 已完成简化

### 更新文件
- `src/lib/agents/prompts/agent-t-tech-expert.ts`

---

## 📋 简化内容概览

### 只保留的核心功能

| 任务内容 | 需要的能力 | 说明 |
|---------|-----------|------|
| "格式化公众号文章" | wechat_format (format_article) | 格式化公众号文章 |

---

### 1. **系统提示词简化** (`AGENT_T_TECH_EXPERT_SYSTEM_PROMPT`)

#### 保留章节：【🔴 核心：公众号文章格式化 🔴】

**能力识别：**
- 当任务包含"格式化"、"公众号格式"、"wechat_article"等关键词时
- 查找 capability_list 中 tool_name = "wechat_format" 的能力
- 该能力的 action_name = "format_article"
- dedicated_task_type = "wechat_format"

**参数构建：**
```json
{
  "accountId": "默认账户ID",
  "title": "文章标题",
  "content": "文章内容（纯文本）",
  "author": "作者（可选）",
  "date": "日期（可选）"
}
```

**数据来源：**
- **title**: 从上一步输出中提取文章标题
- **content**: 从上一步输出中提取纯文本文章内容
- **author**: 可选，如果有作者信息则填入
- **date**: 可选，默认为今天

---

### 2. **用户提示词简化** (`buildAgentTTechExpertUserPrompt`)

#### 保留章节：【🔴 公众号文章格式化 🔴】

**任务识别：**
- 当任务包含"格式化"、"公众号格式"、"wechat_article"等关键词时
- 查找 tool_name = "wechat_format" 的能力
- action_name = "format_article"
- 参数必须包含：accountId, title, content

---

## 🎯 简化后的 Agent T 能力

### 只保留的功能
- ✅ 公众号文章格式化（wechat_format）
- ✅ 其他原有技术能力保持不变

### 移除的复杂逻辑
- ❌ 公众号文章发布流程判断
- ❌ 文章格式自动识别（纯文本 vs HTML）
- ❌ 智能能力选择（先格式化后发布）
- ❌ wechat (add_draft) 发布能力的特殊处理

---

## 📊 能力匹配

### capability_list 中的能力（仅关注格式化）

| ID | capability_type | tool_name | action_name | dedicated_task_type | 用途 |
|----|-----------------|-----------|-------------|---------------------|------|
| 23 | content_generation | wechat_format | format_article | wechat_format | 公众号文章格式化 |

---

## 🧪 测试场景

### 场景：格式化公众号文章
**任务**: "把这篇文章格式化为公众号格式"
**上一步输出**: 纯文本文章
**预期行为**:
- Agent T 识别需要格式化
- 选择 wechat_format 能力（ID=23）
- 构造格式化参数（accountId, title, content）
- 返回 mcpParams

---

## 📝 总结

### 更新的文件
- ✅ `src/lib/agents/prompts/agent-t-tech-expert.ts`

### 保留的功能
1. ✅ 公众号文章格式化（wechat_format）
2. ✅ 能力识别和参数构建
3. ✅ Executor 标准格式返回

### Agent T 现在专注于：
- 🤖 识别格式化公众号文章的任务
- 🤖 正确选择 wechat_format 能力（ID=23）
- 🤖 按照正确的参数格式构造请求
- 🤖 返回标准的 Executor 格式

---

**最后更新**: 2026年2月1日  
**版本**: v2.0（简化版）  
**状态**: ✅ Agent T 提示词已简化，仅保留公众号文章格式化功能！
