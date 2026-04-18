# Agent B 决策信息与 Continue 流程详解

## ❓ 问题1：Agent B 决策的信息够吗？它知道要干什么吗？

## ✅ 答案：是的，信息非常充分！

### Agent B 接收的完整信息

让我看看 `callAgentBWithDecision` 函数中给 Agent B 的完整 Prompt：

```
你是 Agent B，负责综合多方信息做出标准化决策。

【重要：两阶段流程】 ← 明确告诉 Agent B 要遵循两阶段流程
如果任务涉及保险事业部内容发布（insurance-d + 公众号发布），必须严格遵循：
1. 第一阶段：先调用合规检查 MCP（compliance_audit/checkContent）
2. 第二阶段：合规通过后，再调用公众号上传 MCP（wechat_mp/addDraft）

【当前状态检查】 ← 告诉 Agent B 当前处于什么状态
- 是否已完成合规检查：是/否
- 合规检查是否通过：是/否

【任务信息】
- 任务ID: xxx
- 当前轮次: 1/5

【执行Agent反馈】 ← insurance-d 的输出
- 原始任务: xxx
- 遇到的问题: xxx（这里包含文章内容！）
- 建议方案: xxx

【MCP执行历史】 ← 之前的所有 MCP 调用记录
第 1 次尝试:
- 工具: compliance_audit/checkContent
- 策略: initial
- 结果: success

【用户反馈】（如果有）
- 反馈类型: select
- 反馈内容: xxx
- 反馈时间: xxx

【系统可用的 MCP 能力清单】 ← 所有可用的 MCP 能力，带详细说明
能力 ID: 15
功能描述: 合规审核检查
能力类型: compliance_audit
工具名 (tool_name): compliance_audit
动作名 (action_name): checkContent
参数说明: {...}

能力 ID: 21
功能描述: 微信公众号草稿添加
能力类型: wechat_upload
工具名 (tool_name): wechat_mp
动作名 (action_name): addDraft
参数说明: {...}

【你的任务】
综合以上所有信息，分析当前任务状态，输出标准化决策JSON。

【决策类型说明】
1. EXECUTE_MCP - 需要执行MCP
2. COMPLETE - 任务已完成
3. NEED_USER - 需要用户介入
4. FAILED - 任务无法继续

【reasonCode编码规范】
...

【要求的输出格式】
{
  "type": "EXECUTE_MCP",
  "reasonCode": "MCP_CONTINUE",
  "reasoning": "...",
  "context": {...},
  "data": {...}
}
```

---

### Agent B 知道的信息清单

| 信息类别 | 具体内容 | Agent B 知道吗？ |
|-----------|---------|------------------|
| ✅ **任务目标** | 任务标题、任务类型 | ✅ 知道 |
| ✅ **文章内容** | 在 `executorFeedback.problem` 字段 | ✅ 知道 |
| ✅ **当前状态** | 已完成合规检查？合规通过？ | ✅ 知道 |
| ✅ **历史记录** | 之前的所有 MCP 调用 | ✅ 知道 |
| ✅ **可用能力** | 所有可用的 MCP 能力，带参数说明 | ✅ 知道 |
| ✅ **流程规则** | 两阶段流程要求 | ✅ 知道 |
| ✅ **输出格式** | 明确的 JSON 格式要求 | ✅ 知道 |

---

### Agent B 的决策逻辑示例

#### 场景1：第一轮，还没做合规检查
```
Agent B 看到的信息：
- 任务：发布保险文章到公众号
- 文章内容：在 problem 字段中
- 当前状态：未完成合规检查 ❌
- 合规通过：否 ❌
- 可用能力：compliance_audit（合规检查）、wechat_mp（公众号上传）

Agent B 的决策：
{
  "type": "EXECUTE_MCP",
  "reasonCode": "MCP_CONTINUE",
  "reasoning": "根据两阶段流程，先执行合规检查",
  "data": {
    "mcpParams": {
      "toolName": "compliance_audit",
      "actionName": "checkContent",
      "params": { "content": "..." }
    }
  }
}
```

#### 场景2：第二轮，已完成合规检查且通过
```
Agent B 看到的信息：
- 任务：发布保险文章到公众号
- 当前状态：已完成合规检查 ✅
- 合规通过：是 ✅
- MCP历史：第1条是合规检查，成功
- 可用能力：wechat_mp（公众号上传）

Agent B 的决策：
{
  "type": "EXECUTE_MCP",
  "reasonCode": "MCP_CONTINUE",
  "reasoning": "合规检查已通过，执行公众号上传",
  "data": {
    "mcpParams": {
      "toolName": "wechat_mp",
      "actionName": "addDraft",
      "params": { "articles": [...] }
    }
  }
}
```

#### 场景3：第三轮，已完成公众号上传
```
Agent B 看到的信息：
- 任务：发布保险文章到公众号
- 当前状态：已完成合规检查 ✅
- 合规通过：是 ✅
- MCP历史：第1条合规检查、第2条公众号上传，都成功

Agent B 的决策：
{
  "type": "COMPLETE",
  "reasonCode": "TASK_DONE",
  "reasoning": "合规检查和公众号上传都已完成",
  "context": {
    "executionSummary": "任务完成"
  }
}
```

---

## ❓ 问题2：continue 回到哪里重新执行？

## ✅ 答案：回到 while 循环的开头！

### 代码位置

```typescript
// ========== Agent B 循环决策（最多5次） ==========
while (currentIteration < MAX_ITERATIONS) {  // ← A. 循环起点
  currentIteration++;
  console.log(`第 ${currentIteration}/${MAX_ITERATIONS} 轮决策`);

  // ... 构建执行上下文 ...
  // ... 两阶段流程控制 ...
  // ... 调用 Agent B 决策 ...

  switch (agentBDecision.type) {
    case 'COMPLETE':
      await this.handleCompleteDecision(...);
      return;  // ← 直接返回，结束方法

    case 'NEED_USER':
      await this.handleNeedUserDecision(...);
      return;  // ← 直接返回，结束方法

    case 'FAILED':
      await this.handleFailedDecision(...);
      return;  // ← 直接返回，结束方法

    case 'EXECUTE_MCP':
      const mcpSuccess = await this.executeMcpWithRetry(...);
      
      if (mcpSuccess) {
        console.log('MCP执行成功，继续下一轮决策');
        continue;  // ← B. 回到循环起点 A！
      } else {
        console.log('MCP多次尝试失败，继续下一轮决策');
        continue;  // ← C. 回到循环起点 A！
      }
  }
}  // ← D. 循环结束

// 达到最大循环次数
console.log('达到最大循环次数，强制完成');
await this.handleMaxIterationsExceeded(...);
```

---

### Continue 的执行流程

#### 示例流程（以 TC-01B 为例）

```
第1轮循环（currentIteration = 1）
    │
    ├─ 构建执行上下文
    │
    ├─ 两阶段流程检查
    │   └─ 需要两阶段 ✅
    │   └─ 未做合规检查 ❌
    │
    ├─ 强制执行合规检查 MCP
    │   └─ 执行成功 ✅
    │   └─ 记录到 mcpExecutionHistory[0]
    │
    └─ continue ← 回到循环起点！
        │
        ▼
第2轮循环（currentIteration = 2）
    │
    ├─ 构建执行上下文（现在 mcpExecutionHistory 有1条记录了！
    │
    ├─ 两阶段流程检查
    │   └─ 需要两阶段 ✅
    │   └─ 已做合规检查 ✅
    │   └─ 合规通过 ✅
    │
    ├─ 调用 Agent B 决策
    │   └─ Agent B 看到：合规已完成，应该上传公众号
    │   └─ Agent B 决策：EXECUTE_MCP（公众号上传）
    │
    ├─ 执行公众号上传 MCP
    │   └─ 执行成功 ✅
    │   └─ 记录到 mcpExecutionHistory[1]
    │
    └─ continue ← 回到循环起点！
        │
        ▼
第3轮循环（currentIteration = 3）
    │
    ├─ 构建执行上下文（现在 mcpExecutionHistory 有2条记录了！
    │
    ├─ 两阶段流程检查
    │   └─ 需要两阶段 ✅
    │   └─ 已做合规检查 ✅
    │   └─ 合规通过 ✅
    │
    ├─ 调用 Agent B 决策
    │   └─ Agent B 看到：合规和上传都完成了
    │   └─ Agent B 决策：COMPLETE
    │
    └─ handleCompleteDecision()
        └─ return ← 直接返回，结束方法！
```

---

### Continue vs Return 的区别

| 关键字 | 作用 | 下一步 |
|--------|------|-------|
| `continue` | 跳过本次循环剩余部分 | 回到 **while 循环开头**，开始下一轮 |
| `return` | 立即结束方法 | **直接返回**，不再执行循环 |

---

## 📊 完整流程图

```
executeCompleteWorkflow(task)
    │
    └─ while (currentIteration < 5) {  ← 循环入口
        │
        ├─ currentIteration++
        │
        ├─ 构建执行上下文
        │
        ├─ 两阶段流程控制
        │
        ├─ 调用 Agent B 决策
        │
        └─ switch (decision.type) {
        │   │
        │   ├─ COMPLETE → handleCompleteDecision() → return ← 结束方法 ❌
        │   │
        │   ├─ NEED_USER → handleNeedUserDecision() → return ← 结束方法 ❌
        │   │
        │   ├─ FAILED → handleFailedDecision() → return ← 结束方法 ❌
        │   │
        │   └─ EXECUTE_MCP → executeMcpWithRetry()
        │       │
        │       ├─ 成功 → continue ← 回到循环入口 ✅
        │       │
        │       └─ 失败 → continue ← 回到循环入口 ✅
        │
        └─ }
    │
    └─ } // while 循环结束
    │
    └─ 达到最大循环次数 → handleMaxIterationsExceeded()
```

---

## 🎯 总结

### 问题1解答
**Agent B 的信息非常充分！** 它知道：
- ✅ 任务目标和文章内容
- ✅ 当前状态（是否已完成合规检查）
- ✅ 历史记录（之前的 MCP 调用）
- ✅ 可用能力（所有 MCP 能力的详细说明）
- ✅ 流程规则（两阶段流程要求）
- ✅ 输出格式（明确的 JSON 格式）

### 问题2解答
**`continue` 回到 `while` 循环的开头！**
- 跳过本次循环剩余代码
- 重新从 `while (currentIteration < MAX_ITERATIONS)` 开始
- 开始下一轮决策
