# Agent 指令下达决策指南

## 📋 概述

Agent A（总裁）在向其他 Agent 下达指令时，需要根据任务特点选择合适的下达方式。本文档提供了清晰的决策规则和使用场景。

## 🎯 两种下达方式

### 1. 实时指令（Real-time Command）

**API**：`POST /api/agents/send-command`

**特点**：
- ✅ 立即执行，实时响应
- ✅ 适合简单、紧急的任务
- ✅ 无状态，无需长期跟踪

**适用场景**：
- 紧急任务：需要立即响应或紧急处理
- 简单任务：预计执行时间 < 10 分钟
- 单步任务：不需要分步骤执行
- 即时通讯：需要快速获取信息或确认
- 协调工作：需要立即协调多个 Agent
- 状态查询：查询 Agent 当前状态或进度
- 快速决策：需要 Agent 快速给出建议或决策

**示例**：
```javascript
// 紧急查询
POST /api/agents/send-command
{
  "fromAgentId": "A",
  "toAgentId": "C",
  "command": "今天的数据收集完成了吗？",
  "commandType": "instruction",
  "priority": "high"
}

// 简单任务
POST /api/agents/send-command
{
  "fromAgentId": "A",
  "toAgentId": "D",
  "command": "请写一篇简短的摘要，200字左右",
  "commandType": "task",
  "priority": "normal"
}
```

### 2. 任务管理（Task Management）

**API**：`POST /api/agents/tasks`

**特点**：
- ✅ 异步执行，长期跟踪
- ✅ 支持任务状态管理
- ✅ 支持结果反馈和评价
- ✅ 适合复杂、长时间的任务

**适用场景**：
- 调研任务：需要调研分析（如市场调研、技术调研）
- 开发任务：需要开发新功能或模块
- 优化任务：需要优化改进（如流程优化、性能优化）
- 报告任务：需要提交详细报告或分析文档
- 长期任务：预计执行时间 > 10 分钟
- 多步任务：需要分步骤执行并跟踪
- 复杂任务：需要多次交互或反馈
- 验收任务：需要提交结果并等待验收

**示例**：
```javascript
// 调研任务
POST /api/agents/tasks
{
  "fromAgentId": "A",
  "toAgentId": "B",
  "command": "请调研当前最流行的AI内容检测工具，分析其优缺点和适用场景，并提交详细报告",
  "commandType": "task",
  "priority": "high",
  "metadata": {
    "deadline": "2025-02-10",
    "category": "research"
  }
}

// 优化任务
POST /api/agents/tasks
{
  "fromAgentId": "A",
  "toAgentId": "B",
  "command": "请优化新媒体内容生成流程，重点关注去AI化效果和跨平台适配能力。要求：1. 分析当前流程的不足；2. 提出优化方案；3. 验证优化效果；4. 向我提交优化报告。",
  "commandType": "task",
  "priority": "high",
  "metadata": {
    "deadline": "2025-02-10",
    "category": "optimization"
  }
}
```

## 🌳 决策树

```
是否需要立即响应？
├─ 是 → 使用【实时指令】（/api/agents/send-command）
└─ 否 → 继续判断

任务预计执行时间是否超过 10 分钟？
├─ 是 → 使用【任务管理】（/api/agents/tasks）
└─ 否 → 继续判断

任务是否需要多个步骤或长时间跟踪？
├─ 是 → 使用【任务管理】（/api/agents/tasks）
└─ 否 → 使用【实时指令】（/api/agents/send-command）
```

## 📊 快速决策表

| 任务特征 | 实时指令 | 任务管理 |
|---------|---------|---------|
| 紧急程度 | ⚡ 紧急 | ✅ 非紧急 |
| 执行时间 | ⏱️ < 10 分钟 | ⏱️ > 10 分钟 |
| 任务复杂度 | 📝 单步 | 📝 多步 |
| 跟踪需求 | ❌ 无需跟踪 | ✅ 需要跟踪 |
| 反馈需求 | 💬 实时反馈 | 📊 提交报告 |
| 优先级 | 🔴 高/中 | 🟡 中/低 |

## 🎯 实际使用案例

### 案例 1：紧急Bug修复

**场景**：系统出现紧急Bug，需要立即修复

**决策**：使用实时指令

```javascript
POST /api/agents/send-command
{
  "fromAgentId": "A",
  "toAgentId": "B",
  "command": "系统出现紧急Bug，请立即排查并修复！问题：用户无法登录",
  "commandType": "urgent",
  "priority": "high"
}
```

### 案例 2：技术调研

**场景**：需要调研AI内容检测工具

**决策**：使用任务管理

```javascript
POST /api/agents/tasks
{
  "fromAgentId": "A",
  "toAgentId": "B",
  "command": "请调研当前最流行的AI内容检测工具，分析其优缺点和适用场景。要求：1. 至少调研3个工具；2. 对比分析每个工具的优缺点；3. 给出推荐方案；4. 提交详细报告。",
  "commandType": "task",
  "priority": "high",
  "metadata": {
    "deadline": "2025-02-10",
    "category": "research"
  }
}
```

### 案例 3：快速确认

**场景**：确认某项工作的完成情况

**决策**：使用实时指令

```javascript
POST /api/agents/send-command
{
  "fromAgentId": "A",
  "toAgentId": "C",
  "command": "今天的运营数据收集完成了吗？",
  "commandType": "instruction",
  "priority": "normal"
}
```

### 案例 4：深度内容创作

**场景**：需要撰写一篇深度文章

**决策**：使用任务管理

```javascript
POST /api/agents/tasks
{
  "fromAgentId": "A",
  "toAgentId": "D",
  "command": "请撰写一篇关于AI技术落地的深度文章，字数2000+，需要包含案例分析和数据支撑。完成后提交初稿，我会给出反馈意见。",
  "commandType": "task",
  "priority": "normal",
  "metadata": {
    "deadline": "2025-02-12",
    "category": "content"
  }
}
```

## 🔄 完整工作流程

### 实时指令流程

```
Agent A（总裁）
    ↓
1. 评估任务特点（紧急、简单）
    ↓
2. 向董事长汇报，获得批准
    ↓
3. 调用实时指令 API
    ↓
Agent B（接收方）
    ↓
4. 立即接收并执行
    ↓
5. 实时反馈响应
    ↓
Agent A
    ↓
6. 收到响应，继续沟通或结束
```

### 任务管理流程

```
Agent A（总裁）
    ↓
1. 评估任务特点（复杂、长期）
    ↓
2. 向董事长汇报，获得批准
    ↓
3. 调用任务创建 API
    ↓
4. 任务进入待执行队列（status: pending）
    ↓
Agent B（接收方）
    ↓
5. 启动任务（status: in_progress）
    ↓
6. 执行任务（可能需要数小时/数天）
    ↓
7. 提交任务结果（status: completed/failed）
    ↓
Agent A
    ↓
8. 查看反馈结果
    ↓
9. 评估执行质量，记录经验
```

## 📌 重要提示

1. **【最高优先级】向董事长汇报**
   - 所有指令下达前必须先向董事长汇报
   - 说明选择的下达方式和理由
   - 获得批准后再下达

2. **优先使用任务管理**
   - 复杂任务优先使用任务管理
   - 需要长期跟踪的任务使用任务管理
   - 需要提交报告的任务使用任务管理

3. **合理使用实时指令**
   - 紧急任务使用实时指令
   - 简单查询使用实时指令
   - 快速协调使用实时指令

4. **记录经验**
   - 记录下达指令的经验
   - 分析哪种方式更适合特定场景
   - 持续优化决策规则

5. **不确定时请示**
   - 如果不确定使用哪种方式，向董事长说明情况
   - 提供两种方案的优缺点
   - 等待董事长决策

## 🎓 总结

| 方式 | API | 适用场景 | 优势 | 劣势 |
|------|-----|---------|------|------|
| 实时指令 | `/api/agents/send-command` | 紧急、简单、立即响应 | 快速、实时 | 无状态、无跟踪 |
| 任务管理 | `/api/agents/tasks` | 复杂、长期、需要跟踪 | 有状态、有跟踪、有反馈 | 需要等待、异步执行 |

**核心原则**：
- ⚡ 紧急 → 实时指令
- 📊 复杂 → 任务管理
- 🤔 不确定 → 向董事长请示

通过遵循这些决策规则，Agent A 可以高效、准确地向其他 Agent 下达指令！
