# agent_sub_tasks 重复创建 Bug 分析

## 🐛 问题描述

**严重问题**：1 个 daily_task 产生了 715 条子任务，完全不合理！

## 📊 问题证据

### 1. 时间规律分析

| 时间 | 创建数量 | 说明 |
|--------|---------|------|
| 14:45:25 | 6 条 | 正常拆解 |
| 14:45:31 | 15 条 | 正常拆解 |
| **14:46:00** | **40 条** | **🔴 异常！** |
| **14:47:00** | **40 条** | **🔴 异常！** |
| **14:51:00** | **40 条** | **🔴 异常！** |
| **14:52:00** | **40 条** | **🔴 异常！** |

### 2. 重复内容分析

- `order_index=1` 有 **37 种不同的"指令拆解"变体**
- `order_index=2` 有 **40 条子任务都是"核心文本材料获取"**
- 明显是同样的拆解逻辑被重复调用了多次！

### 3. 数据分布

```
insurance-d: 712 条子任务（8 个不同的 order_index）
insurance-b: 27 条子任务（2 个不同的 order_index）
总计: 739 条子任务（来自 1 个 daily_task！）
```

## 🔍 根本原因分析

### 问题 1：防重复机制不一致

**`insuranceDSplitTask` 中的检查：**
```typescript
// 检查 1: 是否正在拆解中
if (metadata.splitInProgress) { ... }

// 检查 2: 是否在冷却期内（5分钟）
if (metadata.lastSplitAt && elapsed < MIN_SPLIT_INTERVAL) { ... }

// 检查 3: 是否已经拆分过
if (commandResult.subTaskCount && commandResult.subTaskCount > 0) { ... }
```

**`BaseSplitter.getTasksToProcess()` 中的查询：**
```typescript
// 查询 pending_review 状态的任务
const pendingTasks = await db
  .select()
  .from(dailyTasks)
  .where(
    and(
      eq(dailyTasks.executor, this.agentId),
      eq(dailyTasks.executionStatus, 'pending_review'), // 🔴 问题在这里！
      lte(dailyTasks.executionDate, today)
    )
  );
```

### 问题 2：状态更新时序问题

**执行流程：**
1. `schedule-daily-tasks` 定时任务查询 `executionStatus = 'pending_review'` 的任务
2. 调用 `splitter.markAsSplitting(taskId)` 标记为 `split_in_progress`
3. 调用 `insuranceDBatchSplitTask(taskIds)` 执行拆解
4. `insuranceDSplitTask` 内部又会检查并标记 `splitInProgress`
5. 拆解完成后更新为 `pending_review` 🔴 **问题在这里！**

**关键问题**：拆解完成后状态又变回了 `pending_review`，导致下一次定时任务又会重复处理！

### 问题 3：批量拆解 vs 单任务拆解的冲突

- `schedule-daily-tasks` 使用 `insuranceDBatchSplitTask`
- 可能同时有其他地方调用 `insuranceDSplitTask`
- 两种路径的防重复机制可能不一致

## ✅ 修复方案

### 方案 1：统一状态机（推荐）

**设计原则**：
- 拆解完成后状态应该变为 `split_completed`，而不是 `pending_review`
- 只有确认后才变为 `confirmed` 或其他状态

**状态流转**：
```
new → pending_review → split_in_progress → split_completed → confirmed → in_progress → completed
                          ↑____________________|
                           (超时重试)
```

### 方案 2：增强防重复机制

**在 `BaseSplitter` 中增加检查：**
```typescript
async getTasksToProcess(): Promise<any[]> {
  // 现有查询...
  
  // 新增：检查是否已经有 agent_sub_tasks 记录
  const tasksWithSubTasks = await db
    .select()
    .from(dailyTasks)
    .leftJoin(agentSubTasks, eq(dailyTasks.id, agentSubTasks.commandResultId))
    .where(
      and(
        eq(dailyTasks.executor, this.agentId),
        eq(dailyTasks.executionStatus, 'pending_review'),
        isNull(agentSubTasks.id) // 🔴 新增：确保没有子任务
      )
    );
}
```

### 方案 3：数据库层面的唯一约束

**在 agent_sub_tasks 表增加唯一约束：**
```sql
-- 防止同一个 daily_task 的同一个 order_index 被重复创建
ALTER TABLE agent_sub_tasks 
ADD CONSTRAINT unique_daily_task_order_index 
UNIQUE (command_result_id, order_index);
```

## 🎯 立即执行建议

### 1. 清理异常数据

```sql
-- 备份异常数据
CREATE TABLE agent_sub_tasks_backup_20260218 AS 
SELECT * FROM agent_sub_tasks;

-- 删除重复数据，只保留最早的一份
DELETE FROM agent_sub_tasks
WHERE id NOT IN (
  SELECT DISTINCT ON (command_result_id, order_index) id
  FROM agent_sub_tasks
  ORDER BY command_result_id, order_index, created_at ASC
);
```

### 2. 临时禁用定时任务

```bash
# 设置环境变量禁用定时任务
export ENABLE_CRON_JOBS=false
```

### 3. 修复代码 bug

优先修复状态流转问题，确保拆解完成后不会回到 `pending_review` 状态。

## 📝 总结

**问题严重性**：🔴 严重 - 导致数据量爆炸式增长

**根本原因**：
1. 状态机设计缺陷：拆解完成后状态变回 `pending_review`
2. 防重复机制不一致：多个检查点之间有漏洞
3. 缺少数据库层面的约束：可以重复插入相同的 order_index

**修复优先级**：
1. 🔴 高：立即清理异常数据
2. 🔴 高：修复状态流转 bug
3. 🟡 中：增加数据库唯一约束
4. 🟡 中：增强防重复机制
