# 🎯 `in_progress` 超时处理完整方案

## 📋 业务背景

### ✅ 明确的业务规则
1. **`waiting_user` 状态**：**不需要超时**
   - 用户有待办任务提醒
   - 用户想什么时候处理就什么时候处理
   - 可能等5分钟，也可能等3天

2. **`in_progress` 状态**：**需要超时处理**
   - 超过10分钟没反应
   - 可能是执行Agent挂了
   - 可能是网络问题
   - 需要Agent B介入

---

## 🤔 用户建议的方案分析

### 💡 你的方案
> Agent B介入，分析历史执行过程，带着总结做为提示词去咨询执行Agent

**优点**：
- ✅ 利用Agent B的分析能力
- ✅ 有历史数据支撑
- ✅ 尝试让执行Agent继续

**潜在问题**：
- ⚠️ 执行Agent可能已经挂了，问了也白问
- ⚠️ 可能形成死循环（Agent B问执行Agent，执行Agent又卡住）
- ⚠️ 用户体验不好（等了10分钟，又让Agent问来问去）

---

## 🏆 推荐方案：三级 escalation（升级）机制

基于业务专家和技术专家的经验，我推荐一个**三级升级机制**：

```
Level 1: 快速重试（技术层）
    ↓ (如果失败)
Level 2: Agent B诊断 + 咨询执行Agent（业务层）
    ↓ (如果失败)
Level 3: 转为 waiting_user，交给用户决策（用户层）
```

---

## 🚀 详细设计

### Level 1: 快速重试（5分钟内）

**触发条件**：`in_progress` 超过10分钟，**且没有检测到明显错误**

**处理流程**：
```
1. 检查执行历史，看是否有明显的错误
2. 如果没有明显错误，尝试"轻量级重启"
3. 重置 executionResult，重新触发执行
4. 等待5分钟，看是否能继续
```

**技术实现**：
```typescript
// 轻量级重试
async function level1QuickRetry(task: Task): Promise<boolean> {
  // 1. 检查是否有明显错误
  const hasFatalError = checkForFatalErrors(task);
  if (hasFatalError) {
    return false; // 有致命错误，直接进入Level 2
  }

  // 2. 轻量级重试：重置状态，重新执行
  await db.update(agentSubTasks)
    .set({
      executionResult: null,
      statusProof: null,
      startedAt: getCurrentBeijingTime(), // 重置开始时间
      updatedAt: getCurrentBeijingTime(),
      metadata: {
        ...task.metadata,
        level1Retry: true,
        level1RetryAt: new Date().toISOString(),
      }
    })
    .where(eq(agentSubTasks.id, task.id));

  // 3. 重新触发执行
  await subtaskExecutionEngine.execute();

  return true;
}
```

---

### Level 2: Agent B诊断 + 咨询执行Agent（5-15分钟）

**触发条件**：
- Level 1重试失败，**或**
- 检测到明显错误

**处理流程**：
```
1. Agent B分析历史执行记录
2. 生成"诊断报告"
3. 带着诊断报告咨询执行Agent
4. 等待10分钟，看执行Agent是否能恢复
```

**诊断报告示例**：
```
📋 任务超时诊断报告
=====================
任务：撰写《银行，保险年金险还是增额寿？》公众号文章初稿
执行者：insurance-d
超时时间：12分钟

📊 历史执行分析：
- 第1次尝试：执行了wechat_compliance/content_audit
- 第2次尝试：又执行了wechat_compliance/content_audit
- 结果：达到最大迭代次数，进入waiting_user

🔍 可能的原因：
1. 合规检查一直失败，但没有给出明确的修复建议
2. 文章内容有问题，但执行Agent不知道怎么改
3. 执行Agent陷入了循环

💡 咨询执行Agent：
"请帮我分析一下这个任务为什么卡住了？
历史执行记录：[附上历史记录]
你觉得应该怎么处理？"
```

**技术实现**：
```typescript
// Agent B诊断 + 咨询执行Agent
async function level2AgentBDiagnosis(task: Task): Promise<boolean> {
  // 1. 收集历史执行记录
  const history = await getExecutionHistory(task);

  // 2. Agent B生成诊断报告
  const diagnosisReport = await generateDiagnosisReport(task, history);

  // 3. 咨询执行Agent
  const response = await askExecutorAgent(task, diagnosisReport);

  // 4. 分析执行Agent的回复
  if (response.hasSolution) {
    // 执行Agent给出了解决方案，尝试执行
    await executeSolution(task, response.solution);
    return true;
  } else {
    // 执行Agent也不知道怎么办，进入Level 3
    return false;
  }
}
```

---

### Level 3: 转为 waiting_user，交给用户决策（15分钟以上）

**触发条件**：
- Level 2失败，**或**
- 执行Agent明确表示无法处理

**处理流程**：
```
1. Agent B生成"总结报告"
2. 将任务状态改为 waiting_user
3. 创建用户待办任务
4. 等用户来决策
```

**总结报告示例**：
```
📋 任务处理总结报告
=====================
任务：撰写《银行，保险年金险还是增额寿？》公众号文章初稿
执行者：insurance-d
处理时间：25分钟

📊 处理过程：
1. 初始执行：执行了2次迭代，达到最大次数
2. Level 1重试：轻量级重启，没有改善
3. Level 2诊断：Agent B分析了历史记录，咨询了执行Agent
4. 结果：执行Agent表示无法继续，需要人工介入

🔍 问题分析：
- 合规检查一直失败，但没有明确的修复方向
- 文章内容可能涉及敏感话题，需要人工审核
- 建议用户查看当前进展，决定下一步

💡 建议选项：
1. [继续执行] - 让我再试一次
2. [修改任务] - 调整任务要求
3. [跳过此步] - 先做其他任务
4. [人工处理] - 我自己来写这篇文章
```

**技术实现**：
```typescript
// 转为 waiting_user，交给用户决策
async function level3EscalateToUser(task: Task): Promise<void> {
  // 1. 生成总结报告
  const summaryReport = await generateSummaryReport(task);

  // 2. 改为 waiting_user 状态
  await db.update(agentSubTasks)
    .set({
      status: 'waiting_user',
      executionResult: {
        success: false,
        needUserHelp: true,
        userMessage: '任务执行遇到困难，需要您的帮助',
        summaryReport: summaryReport,
        escalatedAt: new Date().toISOString(),
      },
      updatedAt: getCurrentBeijingTime(),
      metadata: {
        ...task.metadata,
        escalatedToUser: true,
        escalatedAt: new Date().toISOString(),
      }
    })
    .where(eq(agentSubTasks.id, task.id));

  // 3. 创建用户待办任务（如果还没有）
  await createUserTodoIfNotExists(task);
}
```

---

## 🎯 状态流转图

```
in_progress
    │
    ├─→ 超时（10分钟）
    │       │
    │       ├─→ Level 1: 快速重试
    │       │       │
    │       │       ├─→ 成功 → in_progress（继续执行）
    │       │       └─→ 失败 → Level 2
    │       │
    │       └─→ Level 2: Agent B诊断 + 咨询
    │               │
    │               ├─→ 成功 → in_progress（继续执行）
    │               └─→ 失败 → Level 3
    │
    └─→ Level 3: 转为 waiting_user
            │
            └─→ 等待用户决策
```

---

## 🚀 完整实现示例

```typescript
/**
 * in_progress 超时处理主流程
 */
async function handleInProgressTimeout(task: Task): Promise<void> {
  console.log('[TimeoutHandler] 开始处理 in_progress 超时:', task.id);

  const elapsed = getElapsedTime(task);
  console.log('[TimeoutHandler] 已执行时间:', elapsed, '分钟');

  // Level 1: 10-15分钟，快速重试
  if (elapsed >= 10 && elapsed < 15) {
    console.log('[TimeoutHandler] ========== Level 1: 快速重试 ==========');
    const success = await level1QuickRetry(task);
    if (success) {
      console.log('[TimeoutHandler] Level 1 成功');
      return;
    }
    console.log('[TimeoutHandler] Level 1 失败，进入 Level 2');
  }

  // Level 2: 15-25分钟，Agent B诊断 + 咨询执行Agent
  if (elapsed >= 15 && elapsed < 25) {
    console.log('[TimeoutHandler] ========== Level 2: Agent B诊断 ==========');
    const success = await level2AgentBDiagnosis(task);
    if (success) {
      console.log('[TimeoutHandler] Level 2 成功');
      return;
    }
    console.log('[TimeoutHandler] Level 2 失败，进入 Level 3');
  }

  // Level 3: 25分钟以上，交给用户决策
  if (elapsed >= 25) {
    console.log('[TimeoutHandler] ========== Level 3: 交给用户决策 ==========');
    await level3EscalateToUser(task);
    console.log('[TimeoutHandler] Level 3 完成');
  }
}
```

---

## 🎯 关键业务规则总结

### ✅ `waiting_user` 状态
- **永远不超时**
- 用户有待办任务提醒
- 用户想什么时候处理就什么时候处理

### ⚠️ `in_progress` 状态
- **三级升级机制**：
  1. Level 1（10-15分钟）：快速重试
  2. Level 2（15-25分钟）：Agent B诊断 + 咨询执行Agent
  3. Level 3（25分钟+）：转为 waiting_user，交给用户

---

## 💡 额外建议

### 1. **超时时间可配置**
不同任务类型可能需要不同的超时时间：
```typescript
const TIMEOUT_CONFIG = {
  'writing': 10,      // 写作类：10分钟
  'research': 20,     // 调研类：20分钟
  'analysis': 15,     // 分析类：15分钟
  'default': 10,      // 默认：10分钟
};
```

### 2. **进度可视化**
给用户展示当前处理级别：
```
任务状态：处理中（Level 2: Agent B诊断中...）
预计还需：5-10分钟
```

### 3. **用户可干预**
即使在Level 1或Level 2，用户也可以随时介入：
```
[立即干预] - 我来看看现在的情况
[继续等待] - 让系统再试试
```

---

## 🎓 总结

这个方案的优势：
1. ✅ **渐进式处理**：从轻量到重量，避免不必要的用户打扰
2. ✅ **利用Agent能力**：Level 2充分利用Agent B和执行Agent
3. ✅ **用户体验好**：Level 3才打扰用户，前面尽量自动化
4. ✅ **可追溯**：每个级别都有记录，便于分析
5. ✅ **可配置**：不同任务类型可以有不同的超时策略

这是一个**业务驱动、技术支撑**的完整方案！🚀
