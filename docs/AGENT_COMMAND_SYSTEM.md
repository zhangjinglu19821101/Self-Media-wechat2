# Agent 间指令下达系统

> 更新时间：2026-02-02

本文档说明如何使用 Agent 间指令下达功能。

---

## 📋 概述

Agent 间指令下达系统允许一个 Agent 向另一个 Agent 发送指令，实现 Agent 之间的协作和任务分配。

### 核心特性

- ✅ 支持所有 Agent 之间的指令传递
- ✅ 支持不同类型的指令（instruction/task/report/urgent）
- ✅ 支持优先级设置（high/normal/low）
- ✅ 流式输出响应
- ✅ 自动记录对话历史

---

## 🚀 API 接口

### 发送指令

```http
POST /api/agents/send-command
```

**请求体**：
```json
{
  "fromAgentId": "A",
  "toAgentId": "B",
  "command": "请优化新媒体内容生成流程，重点关注去AI化效果和跨平台适配能力。",
  "commandType": "task",
  "priority": "high",
  "metadata": {
    "deadline": "2026-02-10",
    "category": "optimization"
  }
}
```

**参数说明**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| fromAgentId | string | ✅ | 发送方 Agent ID |
| toAgentId | string | ✅ | 接收方 Agent ID |
| command | string | ✅ | 指令内容 |
| commandType | string | ❌ | 指令类型（默认：instruction） |
| priority | string | ❌ | 优先级（默认：normal） |
| metadata | object | ❌ | 元数据 |

**有效 Agent ID**：
- `A`: 总裁
- `B`: AI商业运营体系技术总负责人
- `C`: AI运营Agent
- `D`: AI内容创作Agent
- `insurance-c`: 保险运营Agent
- `insurance-d`: 保险内容创作Agent

**指令类型**：
- `instruction`: 一般指令（日常任务、常规操作）
- `task`: 任务型指令（需要完成的特定任务）
- `report`: 报告型指令（要求Agent提交报告）
- `urgent`: 紧急指令（需要立即处理）

**优先级**：
- `high`: 高优先级（立即执行）
- `normal`: 普通优先级（正常处理）
- `low`: 低优先级（可以稍后处理）

---

## 💡 使用示例

### 示例1：Agent A 向 Agent B 下达任务指令

```bash
curl -X POST https://f0d66a39-e9d4-4850-b095-0f1eacc1aee0.dev.coze.site/api/agents/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgentId": "A",
    "toAgentId": "B",
    "command": "请优化新媒体内容生成流程，重点关注去AI化效果和跨平台适配能力。要求：1. 分析当前流程的不足；2. 提出优化方案；3. 验证优化效果；4. 向我提交优化报告。",
    "commandType": "task",
    "priority": "high"
  }'
```

### 示例2：Agent A 向 Agent C 下达运营数据收集指令

```bash
curl -X POST https://f0d66a39-e9d4-4850-b095-0f1eacc1aee0.dev.coze.site/api/agents/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgentId": "A",
    "toAgentId": "C",
    "command": "请收集本周所有平台的运营数据，包括阅读量、互动率、转化率等，整理成报告向我汇报。",
    "commandType": "report",
    "priority": "normal"
  }'
```

### 示例3：Agent A 向 Agent D 下达内容创作指令

```bash
curl -X POST https://f0d66a39-e9d4-4850-b095-0f1eacc1aee0.dev.coze.site/api/agents/send-command \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgentId": "A",
    "toAgentId": "D",
    "command": "请撰写一篇关于AI图像生成技术的科普文章，要求通俗易懂、去AI化效果好，适合在微信公众号发布。",
    "commandType": "instruction",
    "priority": "normal"
  }'
```

---

## 📊 Agent A 的指令下达能力

Agent A（总裁）具备完整的指令下达能力，可以在对话中主动调用 API 向其他 Agent 下达指令。

### Agent A 可以下达指令的对象

| 接收方 | 角色 | 指令类型 |
|-------|------|---------|
| B | 技术总负责人 | 规则迭代、技能开发、技术支持、系统优化 |
| C | AI运营Agent | 运营任务、数据收集、用户反馈、活动策划 |
| D | AI内容创作Agent | 内容创作、文章输出、去AI化处理 |
| insurance-c | 保险运营Agent | 保险运营、合规执行、数据收集 |
| insurance-d | 保险内容创作Agent | 保险内容创作、合规把控 |

### Agent A 的指令下达流程

1. **分析任务需求**：确定接收方 Agent
2. **构建指令内容**：明确目标和要求
3. **向董事长汇报**：【核心】获得批准后再下达
4. **调用指令下达 API**：发送指令
5. **监控执行进度**：跟进任务执行情况
6. **收集执行结果**：评估执行质量
7. **反馈给董事长**：汇报最终结果

### Agent A 下达指令的时机

- 分配新任务时
- 需要收集信息时
- 需要调整策略时
- 应急处理时
- 要求提交报告时

---

## 🔐 安全和权限

### 指令下达规则

1. **核心执行动作必须先汇报**：Agent A 向其他 Agent 下达核心执行动作前，必须先向董事长（交互人）汇报并获得批准
2. **合理分配任务**：根据 Agent 的能力和职责合理分配
3. **监控执行进度**：及时跟进任务执行情况
4. **评估执行质量**：对执行结果进行评估和反馈
5. **记录到记忆系统**：重要指令和执行结果需要记录到记忆系统

### 限制条件

- 所有 Agent 都可以接收指令
- 只有 Agent A 可以主动下达指令
- Agent B、C、D、insurance-c、insurance-d 之间不能直接下达指令（需通过 Agent A 中转）

---

## 📝 响应格式

### 流式响应

响应使用 Server-Sent Events (SSE) 格式：

```
data: {"content":"收到指令..."}

data: {"content":"指令内容..."}

data: {"content":"执行计划..."}

data: [DONE]
```

### 完整响应

```javascript
const stream = fetch('/api/agents/send-command', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fromAgentId: 'A',
    toAgentId: 'B',
    command: '指令内容',
    commandType: 'task',
    priority: 'high',
  }),
});

const reader = stream.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.content) {
        console.log(data.content);
      }
    }
  }
}
```

---

## 🎯 使用建议

1. **明确指令目标**：指令内容必须清晰明确，避免模糊不清
2. **设置合理的优先级**：根据任务紧急程度设置优先级
3. **提供必要信息**：为 Agent 提供完成任务所需的信息
4. **明确完成标准**：说明任务完成的标准和要求
5. **设置合理时限**：根据任务复杂度设置合理的完成时限
6. **监控执行进度**：及时跟进任务执行情况
7. **及时反馈**：对执行结果进行评估和反馈

---

## 🚀 快速开始

1. **测试 API 接口**：
   ```bash
   curl -X POST https://f0d66a39-e9d4-4850-b095-0f1eacc1aee0.dev.coze.site/api/agents/send-command \
     -H "Content-Type: application/json" \
     -d '{
       "fromAgentId": "A",
       "toAgentId": "B",
       "command": "请测试一下指令接收功能，确认你能收到我的指令。",
       "commandType": "instruction",
       "priority": "normal"
     }'
   ```

2. **在 Agent A 的对话中使用**：
   Agent A 现在可以在对话中主动向其他 Agent 下达指令。

3. **监控执行进度**：
   Agent A 会自动监控指令执行情况，并在完成后收集结果。

---

**提示**：Agent 间指令下达功能已经完全配置好，Agent A 可以立即使用！
