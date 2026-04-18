# Agent B 异常分析与状态回退方案

## 🔍 问题 1：Agent B 有几类异常？

### Agent B 评审流程分解

```
1. 准备阶段
   ↓
2. 调用 Agent B API
   ↓
3. 解析 Agent B 响应
   ↓
4. 处理评审结果
   ↓
5. 最后更新状态
```

---

### Agent B 异常类型分类

#### 第一类：准备阶段异常
- **任务不存在**：找不到任务
- **状态错误**：任务状态不是 `pre_completed` 或 `pre_need_support`
- **数据缺失**：缺少必要的任务数据

#### 第二类：API 调用异常
- **网络错误**：网络连接失败
- **超时错误**：API 调用超时
- **API 错误**：Agent B API 返回错误状态码

#### 第三类：响应解析异常
- **格式错误**：响应不是 valid JSON
- **字段缺失**：缺少 `decision`、`reasoning` 等必要字段
- **决策无效**：决策不是允许的类型（如返回了 `INVALID_DECISION`）

#### 第四类：结果处理异常
- **数据库错误**：更新数据库失败
- **逻辑错误**：状态机处理失败
- **重试超限**：超过最大重试次数

---

## 🔍 问题 2：状态回退策略

### 核心原则

**"原来什么状态进来的，是不是应该把状态退回去？"**

**答案：要看情况！** 🤔

---

### 状态回退分析表

| 原始状态 | Agent B 异常 | 应该回退到什么状态？ | 理由 |
|---------|-------------|---------------------|------|
| `pre_completed` | 任何异常 | **保持 `pre_completed`** ✅ | 执行 Agent 已经完成了任务，不要轻易回退 |
| `pre_need_support` | 任何异常 | **保持 `pre_need_support`** ✅ | 执行 Agent 确实需要帮助，不要轻易回退 |

---

### 为什么不回退？

#### 场景：pre_completed

```
执行 Agent (insurance-d) 已经完成了任务
    ↓
状态变成 pre_completed
    ↓
准备调用 Agent B 评审
    ↓
❌ Agent B API 报错了
    ↓
我们应该：保持 pre_completed 状态 ✅
    ↓
而不是：回退到 pending 或 in_progress ❌
```

**理由：**
- 执行 Agent 已经完成了任务，成果还在
- 只是 Agent B 临时出问题了
- 等 Agent B 恢复后，可以继续评审
- 不要让执行 Agent 重新执行一遍

---

#### 场景：pre_need_support

```
执行 Agent (insurance-d) 遇到困难，需要帮助
    ↓
状态变成 pre_need_support
    ↓
准备调用 Agent B 评审
    ↓
❌ Agent B API 报错了
    ↓
我们应该：保持 pre_need_support 状态 ✅
    ↓
而不是：回退到 pending 或 in_progress ❌
```

**理由：**
- 执行 Agent 确实需要帮助
- 只是 Agent B 临时出问题了
- 等 Agent B 恢复后，可以继续评审
- 不要让执行 Agent 重新遇到困难

---

## 🎯 重新设计的方案

### 核心原则

1. **Agent B 最后再改状态**：先完成所有逻辑，最后再更新状态
2. **不同异常不同处理**：根据异常类型，做不同的处理
3. **状态不轻易回退**：保持原始状态，等 Agent B 恢复
4. **记录异常信息**：在 metadata 中记录异常详情，方便排查

---

### 重新设计的代码结构

```typescript
class SubtaskExecutionEngine {
  /**
   * 处理 pre_completed 状态
   */
  private async handlePreCompletedStatus(task: typeof agentSubTasks.$inferSelect) {
    console.log(`[状态机] 处理 pre_completed: ${task.id}`);
    
    try {
      // ==========================================
      // 第一步：准备阶段（先验证，不改状态）
      // ==========================================
      console.log(`[状态机] 第一步：准备阶段`);
      this.validateTaskBeforeReview(task, 'pre_completed');
      
      // ==========================================
      // 第二步：调用 Agent B（先调用，不改状态）
      // ==========================================
      console.log(`[状态机] 第二步：调用 Agent B`);
      const reviewResult = await this.callAgentBForReview(task, 'pre_completed');
      
      // ==========================================
      // 第三步：解析响应（先解析，不改状态）
      // ==========================================
      console.log(`[状态机] 第三步：解析响应`);
      const parsedResult = this.parseAgentBResponse(reviewResult, 'pre_completed');
      
      // ==========================================
      // 第四步：处理评审结果（先处理，不改状态）
      // ==========================================
      console.log(`[状态机] 第四步：处理评审结果`);
      const nextAction = await this.processReviewResult(task, parsedResult, 'pre_completed');
      
      // ==========================================
      // 第五步：最后更新状态（所有逻辑都成功了，才改状态）
      // ==========================================
      console.log(`[状态机] 第五步：最后更新状态`);
      await this.updateTaskStatus(task, nextAction);
      
      console.log(`✅ [状态机] pre_completed 处理完成: ${task.id}`);
      
    } catch (error) {
      // ==========================================
      // 异常处理：不同异常不同处理
      // ==========================================
      await this.handlePreCompletedException(task, error);
    }
  }
  
  /**
   * 处理 pre_need_support 状态（结构同上）
   */
  private async handlePreNeedSupportStatus(task: typeof agentSubTasks.$inferSelect) {
    // 结构同 handlePreCompletedStatus
    // ...
  }
  
  // ==========================================
  // 各阶段的方法
  // ==========================================
  
  /**
   * 第一步：任务验证
   */
  private validateTaskBeforeReview(
    task: typeof agentSubTasks.$inferSelect,
    expectedStatus: 'pre_completed' | 'pre_need_support'
  ) {
    if (!task) {
      throw new ValidationError('任务不存在', { taskId: task.id });
    }
    
    if (task.status !== expectedStatus) {
      throw new ValidationError('任务状态错误', { 
        taskId: task.id,
        expectedStatus,
        actualStatus: task.status
      });
    }
    
    if (!task.executor) {
      throw new ValidationError('缺少执行者信息', { taskId: task.id });
    }
  }
  
  /**
   * 第二步：调用 Agent B
   */
  private async callAgentBForReview(
    task: typeof agentSubTasks.$inferSelect,
    statusType: 'pre_completed' | 'pre_need_support'
  ): Promise<string> {
    try {
      if (statusType === 'pre_completed') {
        return await this.agentBReviewer.reviewPreCompletedRaw(task);
      } else {
        return await this.agentBReviewer.reviewPreNeedSupportRaw(task);
      }
    } catch (error) {
      if (error instanceof NetworkError) {
        throw new AgentBAPIError('网络错误', { cause: error, taskId: task.id });
      } else if (error instanceof TimeoutError) {
        throw new AgentBAPIError('API 超时', { cause: error, taskId: task.id });
      } else {
        throw new AgentBAPIError('API 调用失败', { cause: error, taskId: task.id });
      }
    }
  }
  
  /**
   * 第三步：解析响应
   */
  private parseAgentBResponse(
    rawResponse: string,
    statusType: 'pre_completed' | 'pre_need_support'
  ): AgentBReviewResult {
    try {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new ResponseParseError('未找到 JSON', { rawResponse });
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // 验证必要字段
      if (!parsed.decision) {
        throw new ResponseParseError('缺少 decision 字段', { parsed });
      }
      
      if (!parsed.reasoning) {
        throw new ResponseParseError('缺少 reasoning 字段', { parsed });
      }
      
      // 验证决策类型
      const validDecisions = statusType === 'pre_completed'
        ? ['APPROVE', 'NEED_REVISE', 'NEED_USER']
        : ['CAN_HELP', 'NEED_USER'];
      
      if (!validDecisions.includes(parsed.decision)) {
        throw new ResponseParseError('无效的决策类型', { 
          decision: parsed.decision,
          validDecisions
        });
      }
      
      return {
        decision: parsed.decision,
        reasoning: parsed.reasoning,
        data: parsed.data,
      };
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ResponseParseError('JSON 解析失败', { cause: error, rawResponse });
      }
      throw error;
    }
  }
  
  /**
   * 第四步：处理评审结果
   */
  private async processReviewResult(
    task: typeof agentSubTasks.$inferSelect,
    reviewResult: AgentBReviewResult,
    statusType: 'pre_completed' | 'pre_need_support'
  ): Promise<NextAction> {
    // 根据决策类型，决定下一步动作
    // 这里只计算，不更新数据库
    // ...
    
    return {
      nextStatus: 'completed', // 或 'pending'、'waiting_user'
      metadata: { /* ... */ },
    };
  }
  
  /**
   * 第五步：最后更新状态
   */
  private async updateTaskStatus(
    task: typeof agentSubTasks.$inferSelect,
    nextAction: NextAction
  ) {
    // 所有逻辑都成功了，才更新数据库
    await db
      .update(agentSubTasks)
      .set({
        status: nextAction.nextStatus,
        metadata: {
          ...task.metadata,
          ...nextAction.metadata,
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));
  }
  
  // ==========================================
  // 异常处理
  // ==========================================
  
  /**
   * pre_completed 异常处理
   */
  private async handlePreCompletedException(
    task: typeof agentSubTasks.$inferSelect,
    error: Error
  ) {
    console.error(`❌ [状态机] pre_completed 处理失败:`, error);
    
    // 1. 记录异常信息
    const errorInfo = this.formatError(error);
    
    // 2. 更新 metadata，记录异常（但不改变状态！）
    await this.recordException(task, errorInfo);
    
    // 3. 根据异常类型，决定是否需要告警
    if (error instanceof AgentBAPIError) {
      console.warn(`⚠️  [告警] Agent B API 异常，需要关注: ${task.id}`);
    }
    
    // 4. 关键：状态保持 pre_completed，不回退！
    console.log(`[状态机] 状态保持 pre_completed，等待下次重试: ${task.id}`);
  }
  
  /**
   * 记录异常（不改状态，只更新 metadata）
   */
  private async recordException(
    task: typeof agentSubTasks.$inferSelect,
    errorInfo: ErrorInfo
  ) {
    await db
      .update(agentSubTasks)
      .set({
        metadata: {
          ...task.metadata,
          lastException: {
            type: errorInfo.type,
            message: errorInfo.message,
            timestamp: getCurrentBeijingTime(),
            details: errorInfo.details,
          },
          exceptionCount: (task.metadata?.exceptionCount || 0) + 1,
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));
  }
}

// ==========================================
// 自定义异常类
// ==========================================

class ValidationError extends Error {
  type = 'ValidationError';
  details: Record<string, any>;
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.details = details;
  }
}

class AgentBAPIError extends Error {
  type = 'AgentBAPIError';
  details: Record<string, any>;
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.details = details;
  }
}

class ResponseParseError extends Error {
  type = 'ResponseParseError';
  details: Record<string, any>;
  
  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.details = details;
  }
}

// ==========================================
// 类型定义
// ==========================================

interface NextAction {
  nextStatus: string;
  metadata: Record<string, any>;
}

interface ErrorInfo {
  type: string;
  message: string;
  details: Record<string, any>;
}
```

---

## 📊 Agent B 异常类型总结

| 异常类型 | 异常场景 | 处理方式 | 状态变化 |
|---------|---------|---------|---------|
| **第一类：准备阶段异常** | 任务不存在、状态错误、数据缺失 | 记录异常，不重试 | 保持不变 |
| **第二类：API 调用异常** | 网络错误、超时、API 错误 | 记录异常，可重试 | 保持不变 |
| **第三类：响应解析异常** | 格式错误、字段缺失、决策无效 | 记录异常，可重试 | 保持不变 |
| **第四类：结果处理异常** | 数据库错误、逻辑错误、重试超限 | 记录异常，可重试 | 保持不变 |

---

## 🎯 核心原则总结

| 原则 | 说明 |
|------|------|
| **1. Agent B 最后再改状态** | 先完成所有逻辑（验证→调用→解析→处理），最后才更新状态 |
| **2. 不同异常不同处理** | 分 4 类异常，每类异常有不同的处理策略 |
| **3. 状态不轻易回退** | 保持 `pre_completed` 或 `pre_need_support` 状态，等 Agent B 恢复 |
| **4. 记录异常信息** | 在 metadata 中记录异常详情，方便排查和重试 |

---

## 💡 一句话总结

**Agent B 评审要谨慎：先做完全部事，最后再改状态；出了错别回退，保持原状等恢复！** 🛡️
