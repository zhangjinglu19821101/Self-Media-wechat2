# 📋 order_index=1 状态=need_support 严谨优化方案

**制定日期**: 2026-03-15
**问题编号**: ISSUE-20260315-001
**版本**: v1.0

---

## 📖 一、方案概述

### 1.1 问题重述

**现象**：`agent_sub_tasks` 表中 `order_index=1` 的任务状态为 `need_support`，任务卡住无法继续推进。

**任务详情**：
- 任务标题：撰写《银行，保险年金险还是增额寿？》公众号文章初稿
- 执行Agent：`insurance-d`
- 当前状态：`need_support`
- `execution_result`：`null`（关键线索）

### 1.2 根因回顾

#### 技术根因
1. **数据保存缺陷**：`executeExecutorAgentWorkflow()` 方法在 `pre_need_support` 状态下，只保存了 `finalExecutionResult = null`，没有保存 `capabilityCheckResult`（包含执行Agent为什么需要帮助的关键信息）
2. **严格验证逻辑**：`initializeExecutionContext()` 方法发现 `executorResult` 为 `null` 时，直接将状态改为 `need_support`，缺少降级处理

#### 业务根因
1. 缺少数据完整性监控
2. `simple-split` 使用场景不规范
3. 缺少自动修复机制

---

## 🎯 二、修复目标

### 2.1 核心目标

| 目标维度 | 具体目标 | 衡量标准 |
|----------|----------|----------|
| **功能修复** | 修复数据保存缺陷，确保 `pre_need_support` 状态下能正确保存执行Agent反馈 | `execution_result` 字段包含完整的 `capabilityCheckResult` |
| **用户体验** | 优化降级逻辑，避免任务直接进入 `need_support` 状态 | `pre_need_support` → `need_support` 转化率降低 80% |
| **系统可靠性** | 增加监控和告警，及时发现类似问题 | 问题发生后 5 分钟内触发告警 |
| **业务连续性** | 提供自动修复和人工兜底机制 | 类似问题发生时，90% 能自动恢复或快速人工介入 |

### 2.2 非目标

- 不重构整个状态机（风险太高）
- 不修改 `simple-split` 的核心逻辑（保持兼容性）
- 不新增 MCP 能力（聚焦于修复现有问题）

---

## 🔧 三、技术修复方案（详细）

### 3.1 修复项 1：修改 `executeExecutorAgentWorkflow()` 方法

**优先级**：🔴 P0  
**预计工作量**：2 小时  
**风险等级**：🟡 中（有测试覆盖）

#### 3.1.1 问题定位

**文件**：`src/lib/services/subtask-execution-engine.ts`  
**方法**：`executeExecutorAgentWorkflow()`  
**问题代码行**：第 450-480 行

**当前逻辑**：
```typescript
// 3. 保存结果到数据库
await db
  .update(agentSubTasks)
  .set({
    executionResult: JSON.stringify(finalExecutionResult),  // ❌ 只保存了 finalExecutionResult
    updatedAt: getCurrentBeijingTime(),
  })
  .where(eq(agentSubTasks.id, task.id));

// 4. 更新状态
if (!capabilityCheckResult.isNeedMcp && capabilityCheckResult.isTaskDown) {
  // 任务完成 → pre_completed
} else {
  // 需要帮助 → pre_need_support
  // ❌ capabilityCheckResult 没有被保存！
}
```

#### 3.1.2 修复方案

**修复逻辑**：
```typescript
// 3. 保存结果到数据库
// ✅ 修复：根据不同情况保存不同的结果
let resultToSave: any;
if (!capabilityCheckResult.isNeedMcp && capabilityCheckResult.isTaskDown) {
  // 任务完成：保存最终结果
  resultToSave = finalExecutionResult;
  console.log('[SubtaskEngine] 保存任务完成结果:', resultToSave);
} else {
  // 需要帮助：保存 capabilityCheckResult！
  resultToSave = capabilityCheckResult;
  console.log('[SubtaskEngine] 保存需要帮助结果:', resultToSave);
}

await db
  .update(agentSubTasks)
  .set({
    executionResult: JSON.stringify(resultToSave),  // ✅ 保存正确的结果
    updatedAt: getCurrentBeijingTime(),
  })
  .where(eq(agentSubTasks.id, task.id));
```

#### 3.1.3 验收标准

- [ ] 当任务完成时，`execution_result` 保存 `finalExecutionResult`
- [ ] 当任务需要帮助时，`execution_result` 保存完整的 `capabilityCheckResult`
- [ ] `capabilityCheckResult` 包含 `isNeedMcp`、`isTaskDown`、`problem`、`capabilityType` 等字段
- [ ] 日志中输出保存的结果，便于调试

---

### 3.2 修复项 2：优化 `initializeExecutionContext()` 方法

**优先级**：🔴 P0  
**预计工作量**：1 小时  
**风险等级**：🟡 中（有测试覆盖）

#### 3.2.1 问题定位

**文件**：`src/lib/services/subtask-execution-engine.ts`  
**方法**：`initializeExecutionContext()`  
**问题代码行**：第 730-750 行

**当前逻辑**：
```typescript
// 3. 验证 executorResult
if (!executorResult) {
  console.error('[SubtaskEngine] 无法获取 executorResult，标记任务失败');
  await db
    .update(agentSubTasks)
    .set({
      status: 'need_support',  // ❌ 直接标记为 need_support，太激进
      updatedAt: getCurrentBeijingTime(),
    })
    .where(eq(agentSubTasks.id, task.id));
  return { executorResult: null, capabilities: [] };
}
```

#### 3.2.2 修复方案

**修复逻辑**：
```typescript
// 3. 验证 executorResult
if (!executorResult) {
  console.warn('[SubtaskEngine] executorResult 为空，尝试降级处理');
  
  // ✅ 降级方案1：如果是 pre_need_support 状态，改成 waiting_user
  if (task.status === 'pre_need_support') {
    console.log('[SubtaskEngine] 降级：pre_need_support → waiting_user（转人工处理）');
    await db
      .update(agentSubTasks)
      .set({
        status: 'waiting_user',  // ✅ 改成 waiting_user 而不是 need_support
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));
    
    // 记录降级操作
    console.log('[SubtaskEngine] 已将任务降级为 waiting_user，任务ID:', task.id);
    return { executorResult: null, capabilities: [] };
  }
  
  // ✅ 降级方案2：其他情况才标记为 need_support
  console.error('[SubtaskEngine] 无法获取 executorResult，标记任务失败');
  await db
    .update(agentSubTasks)
    .set({
      status: 'need_support',
      updatedAt: getCurrentBeijingTime(),
    })
    .where(eq(agentSubTasks.id, task.id));
  
  return { executorResult: null, capabilities: [] };
}
```

#### 3.2.3 验收标准

- [ ] 当 `task.status === 'pre_need_support'` 且 `executorResult` 为 `null` 时，状态改为 `waiting_user`
- [ ] 其他情况下，状态改为 `need_support`
- [ ] 日志中输出降级操作的详细信息
- [ ] 降级后任务可以在前端看到"等待用户处理"的提示

---

### 3.3 修复项 3：增加数据完整性前置检查

**优先级**：🟡 P1  
**预计工作量**：1.5 小时  
**风险等级**：🟢 低（新增逻辑，不影响现有功能）

#### 3.3.1 新增方法

**文件**：`src/lib/services/subtask-execution-engine.ts`  
**方法名**：`validateExecutionResultBeforeReview()`

**方法逻辑**：
```typescript
/**
 * 在 Agent B 评审前，验证 execution_result 的完整性
 * 如果不完整，尝试自动修复
 */
private async validateExecutionResultBeforeReview(
  task: typeof agentSubTasks.$inferSelect
): Promise<boolean> {
  console.log('[SubtaskEngine] 执行数据完整性前置检查...');
  
  // 检查1：execution_result 是否存在
  if (!task.executionResult || task.executionResult === 'null' || task.executionResult === '""') {
    console.warn('[SubtaskEngine] 数据完整性检查失败：execution_result 为空');
    
    // 如果是 pre_need_support 状态，尝试重新触发执行Agent
    if (task.status === 'pre_need_support') {
      console.log('[SubtaskEngine] 尝试自动修复：重新触发执行Agent处理');
      await db
        .update(agentSubTasks)
        .set({
          status: 'pending',  // 改回 pending，让执行Agent重新处理
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));
      
      console.log('[SubtaskEngine] 自动修复成功：任务已改回 pending');
      return false; // 返回 false，表示不继续评审
    }
  }
  
  console.log('[SubtaskEngine] 数据完整性检查通过');
  return true; // 返回 true，表示可以继续评审
}
```

#### 3.3.2 集成到现有流程

在 `executeAgentBReviewWorkflow()` 方法开头调用：
```typescript
private async executeAgentBReviewWorkflow(task: typeof agentSubTasks.$inferSelect) {
  console.log('[SubtaskEngine] Agent B: 开始评审');
  
  try {
    // ✅ 新增：先做数据完整性前置检查
    const isDataValid = await this.validateExecutionResultBeforeReview(task);
    if (!isDataValid) {
      console.log('[SubtaskEngine] 数据不完整，已尝试自动修复，跳过本次评审');
      return;
    }
    
    // 原有逻辑...
  } catch (error) {
    // 原有错误处理...
  }
}
```

#### 3.3.3 验收标准

- [ ] 新增方法 `validateExecutionResultBeforeReview()` 能正确检测空的 `execution_result`
- [ ] 当检测到空的 `execution_result` 且状态是 `pre_need_support` 时，自动改回 `pending`
- [ ] 日志中输出检查结果和修复操作
- [ ] 不影响正常情况下的评审流程

---

## 💼 四、业务优化方案

### 4.1 优化项 1：增加监控和告警

**优先级**：🟡 P1  
**预计工作量**：2 小时  
**风险等级**：🟢 低（新增监控，不影响核心功能）

#### 4.1.1 监控指标

| 指标名称 | 监控频率 | 告警阈值 | 告警方式 |
|----------|----------|----------|----------|
| `need_support` 状态任务数 | 每 5 分钟 | &gt; 5 个 | 邮件 + 钉钉 |
| `pre_need_support` → `need_support` 转化率 | 每 10 分钟 | &gt; 10% | 邮件 + 钉钉 |
| `execution_result` 为空的任务数 | 每 5 分钟 | &gt; 0 个 | 邮件 |
| 自动修复成功率 | 每小时 | &lt; 80% | 邮件 |

#### 4.1.2 告警内容模板

```
【告警】任务状态异常

时间: {{timestamp}}
告警级别: {{level}}
告警内容: {{content}}

影响任务数: {{count}}
影响任务ID列表: {{taskIds}}

建议处理方式: {{suggestion}}
```

---

### 4.2 优化项 2：规范 `simple-split` 使用场景

**优先级**：🟢 P2  
**预计工作量**：3 小时  
**风险等级**：🟡 中（需要业务方确认）

#### 4.2.1 使用场景规范

| 任务类型 | 推荐使用方式 | 说明 |
|----------|--------------|------|
| **简单任务** | `simple-split` | 单步骤、不需要多Agent协作、不依赖MCP |
| **复杂任务** | Agent B 完整拆解 | 多步骤、需要多Agent协作、内容创作等场景 |

#### 4.2.2 内容创作场景判断标准

满足以下任一条件即为复杂任务：
- 任务标题包含"文章"、"撰写"、"创作"、"内容"等关键词
- 任务描述超过 200 字
- 需要多步骤执行（`order_index` &gt; 1）
- 依赖 MCP 能力

---

### 4.3 优化项 3：提供人工兜底操作入口

**优先级**：🟡 P1  
**预计工作量**：2 小时  
**风险等级**：🟢 低（新增功能，不影响现有流程）

#### 4.3.1 新增操作按钮

在任务详情页增加以下操作按钮：

| 按钮名称 | 触发条件 | 操作逻辑 |
|----------|----------|----------|
| **重新执行** | `need_support` 或 `waiting_user` 状态 | 将状态改回 `pending`，触发重新执行 |
| **标记完成** | 任何状态（管理员） | 直接将状态改为 `completed`，需要填写完成说明 |
| **转人工处理** | `need_support` 状态 | 将状态改为 `waiting_user`，通知相关人员 |

---

## 📅 五、实施计划

### 5.1 实施阶段

| 阶段 | 任务 | 预计时间 | 负责人 | 依赖 |
|------|------|----------|--------|------|
| **阶段 1：代码修复** | 修复项 1：`executeExecutorAgentWorkflow()` | 2h | 开发 | - |
| | 修复项 2：`initializeExecutionContext()` | 1h | 开发 | 修复项 1 |
| | 修复项 3：数据完整性前置检查 | 1.5h | 开发 | 修复项 1、2 |
| **阶段 2：测试验证** | 单元测试 | 2h | 测试 | 阶段 1 完成 |
| | 集成测试 | 2h | 测试 | 单元测试通过 |
| | 回归测试 | 1h | 测试 | 集成测试通过 |
| **阶段 3：业务优化** | 监控告警配置 | 2h | 运维 | 阶段 2 完成 |
| | 人工兜底操作入口 | 2h | 前端 | 阶段 2 完成 |
| **阶段 4：上线发布** | 代码审查 | 1h | 技术负责人 | 所有代码完成 |
| | 灰度发布 | 2h | 运维 + 测试 | 代码审查通过 |
| | 全量发布 | 1h | 运维 | 灰度验证通过 |

**总预计工作量**：20 小时（约 2.5 个工作日）

---

### 5.2 回滚计划

#### 5.2.1 回滚触发条件

满足以下任一条件时触发回滚：
- 灰度发布期间，`need_support` 状态任务数增加 50% 以上
- 新的 bug 导致核心功能不可用
- 性能下降超过 30%
- 业务方反馈严重问题

#### 5.2.2 回滚步骤

1. 立即停止灰度发布
2. 使用 git revert 回滚代码变更
3. 重新构建和部署
4. 验证回滚后的系统状态
5. 通知相关方回滚结果

---

## ✅ 六、验收标准

### 6.1 技术验收标准

- [ ] 修复项 1：`pre_need_support` 状态下，`execution_result` 正确保存 `capabilityCheckResult`
- [ ] 修复项 2：`pre_need_support` 状态且 `executorResult` 为 `null` 时，状态改为 `waiting_user` 而非 `need_support`
- [ ] 修复项 3：数据完整性前置检查能正确检测和修复问题
- [ ] 所有单元测试通过（覆盖率 ≥ 80%）
- [ ] 所有集成测试通过
- [ ] 性能测试通过（响应时间 &lt; 2s，并发 100）

### 6.2 业务验收标准

- [ ] `pre_need_support` → `need_support` 转化率降低 80%
- [ ] 监控告警能在 5 分钟内发现问题
- [ ] 自动修复成功率 ≥ 90%
- [ ] 人工兜底操作入口可用
- [ ] 业务方确认功能符合预期

---

## ⚠️ 七、风险评估

### 7.1 技术风险

| 风险 | 概率 | 影响 |  mitigation |
|------|------|------|-------------|
| 修复引入新的 bug | 🟡 中 | 🔴 高 | 充分测试、代码审查、灰度发布 |
| 性能下降 | 🟢 低 | 🟡 中 | 性能测试、监控告警 |
| 兼容性问题 | 🟡 中 | 🟡 中 | 回归测试、保持接口不变 |

### 7.2 业务风险

| 风险 | 概率 | 影响 |  mitigation |
|------|------|------|-------------|
| 用户体验受影响 | 🟡 中 | 🔴 高 | 灰度发布、快速回滚机制 |
| 业务流程中断 | 🟢 低 | 🔴 高 | 人工兜底、监控告警 |
| 业务方不接受 | 🟢 低 | 🟡 中 | 提前沟通、方案评审 |

---

## 📞 八、沟通计划

### 8.1 相关方

| 角色 | 人员 | 沟通方式 | 沟通频率 |
|------|------|----------|----------|
| 技术负责人 | - | 方案评审、代码审查 | 阶段结束 |
| 业务方 | - | 方案评审、验收确认 | 关键节点 |
| 测试 | - | 测试计划、测试结果 | 每日 |
| 运维 | - | 部署计划、监控配置 | 上线前后 |

### 8.2 关键沟通节点

1. **方案评审**：实施前，邀请技术负责人和业务方评审方案
2. **阶段汇报**：每个阶段结束后，汇报进度和问题
3. **上线通知**：上线前 24 小时通知所有相关方
4. **上线验证**：上线后 2 小时，汇报验证结果
5. **复盘总结**：上线后 1 周，组织复盘会议

---

## 📚 九、附录

### 9.1 参考文档

- [状态机改造设计方案](./状态机改造设计方案.md)
- [完整问题分析与解决方案](./完整问题分析与解决方案.md)
- [Agent B 评审逻辑分析](./Agent-B评审逻辑分析.md)

### 9.2 术语表

| 术语 | 说明 |
|------|------|
| `pre_need_support` | 执行Agent说需要帮助，等待Agent B评审的中间状态 |
| `need_support` | 需要支持的最终状态（兜底状态） |
| `waiting_user` | 等待用户处理的状态 |
| `execution_result` | 任务执行结果字段，JSON 格式 |
| `capabilityCheckResult` | 执行Agent能力边界判定结果 |

---

**方案制定完成时间**：2026-03-15  
**方案版本**：v1.0  
**下一步**：等待评审确认后执行

---

## 📝 评审意见栏

| 评审人 | 评审日期 | 评审意见 | 状态 |
|--------|----------|----------|------|
| | | | 待评审 |
| | | | 待评审 |
| | | | 待评审 |
