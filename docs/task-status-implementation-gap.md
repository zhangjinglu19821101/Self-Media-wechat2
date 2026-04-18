# 状态联动规则实现情况分析

## 代码实现现状

### ✅ 已实现的联动规则（P0）

#### 1. 向上传递（完成状态）

**代码位置：** `src/app/api/agents/[id]/subtasks/route.ts`

```typescript
// 子任务完成时更新主任务进度
const allSubTasks = await db.select().from(agentSubTasks)
  .where(eq(agentSubTasks.commandResultId, subTask.commandResultId));

const completedCount = allSubTasks.filter(st => st.status === 'completed').length;

await db.update(commandResults)
  .set({
    completedSubTasks: completedCount,
    completedSubTasksDescription: subTask.taskTitle,
  })
  .where(eq(commandResults.id, subTask.commandResultId));

// 如果所有子任务都完成了，更新主任务状态
if (completedCount === allSubTasks.length) {
  await db.update(commandResults)
    .set({
      executionStatus: 'completed',
      completedAt: new Date(),
    })
    .where(eq(commandResults.id, subTask.commandResultId));
}
```

**代码位置：** `src/lib/services/task-state-machine.ts`

```typescript
private static async checkAndUpdateTaskStatus(taskId: string) {
  const commands = await db.select().from(commandResults)
    .where(eq(commandResults.relatedTaskId, taskId));

  const allCompleted = commands.every(cmd => cmd.executionStatus === CommandStatus.FEEDBACK_COMPLETED);

  if (allCompleted) {
    await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, 'TS', '所有指令已完成');
  }
}
```

**实现状态：** ✅ 已实现
- agentSubTasks 全部 completed → commandResults.executionStatus = 'completed' ✅
- commandResults 全部 completed → agentTasks.taskStatus = 'completed' ✅

---

#### 2. 向下传递（失败状态）- P0 已实现

**代码位置：** `src/lib/services/task-state-machine.ts`

```typescript
// 任务失败时级联更新所有指令和子任务
static async updateTaskStatus(taskId: string, newStatus: TaskStatus) {
  // 更新任务状态
  const [updatedTask] = await db.update(agentTasks).set({ taskStatus: newStatus }).where(...);

  // 如果任务失败，级联更新所有指令和子任务
  if (newStatus === TaskStatus.FAILED) {
    await this.cascadeTaskFailure(taskId);
  }

  return updatedTask;
}

// 指令失败时级联更新所有子任务
static async updateCommandStatus(commandId: string, newStatus: CommandStatus) {
  // 更新指令状态
  const [updatedCommand] = await db.update(commandResults).set({ executionStatus: newStatus }).where(...);

  // 如果指令失败，级联更新所有子任务
  if (newStatus === CommandStatus.FAILED) {
    await this.cascadeCommandFailure(updatedCommand.id);
  }

  return updatedCommand;
}

// 级联更新：任务失败时更新所有指令和子任务
private static async cascadeTaskFailure(taskId: string) {
  // 获取所有关联的指令
  const commands = await db.select().from(commandResults)
    .where(eq(commandResults.relatedTaskId, taskId));

  // 级联更新所有指令状态为 failed
  for (const cmd of commands) {
    await db.update(commandResults)
      .set({ executionStatus: CommandStatus.FAILED, ... })
      .where(eq(commandResults.id, cmd.id));

    // 级联更新所有子任务状态为 failed
    await this.cascadeCommandFailure(cmd.id);
  }
}

// 级联更新：指令失败时更新所有子任务
private static async cascadeCommandFailure(commandId: string) {
  // 更新所有子任务状态为 failed
  await db.update(agentSubTasks)
    .set({ status: 'failed', ... })
    .where(eq(agentSubTasks.commandResultId, commandId));
}
```

**实现状态：** ✅ 已实现（P0）
- commandResults.executionStatus = 'failed' → agentTasks.taskStatus = 'failed' ✅
- agentTasks.taskStatus = 'failed' → 所有关联 commandResults.executionStatus = 'failed' ✅
- agentTasks.taskStatus = 'failed' → 所有关联 agentSubTasks.status = 'failed' ✅
- commandResults.executionStatus = 'failed' → 所有关联 agentSubTasks.status = 'failed' ✅

**测试方式：**
- 访问测试页面：`/test-failure-cascade.html`
- API 端点：`POST /api/test/failure-cascade`

---

### ❌ 未实现的联动规则

#### 3. 双向同步（执行状态）

**实现状态：** ❌ 未实现
- agentTasks.taskStatus = 'in_progress' → 未完成 commandResults.executionStatus = 'in_progress' ❌
- commandResults.executionStatus = 'in_progress' → 未完成 agentSubTasks.status = 'in_progress' ❌

#### 4. 求助状态级联

**实现状态：** ❌ 未实现
- commandResults.executionStatus = 'helping_tech_expert' 或 'helping_president' → agentSubTasks.status = 'blocked' ❌
- commandResults.executionStatus 从 'helping_*' → 'in_progress' → agentSubTasks.status = 'in_progress' ❌

#### 5. 数据清理（拒绝状态）

**实现状态：** ❌ 未实现
- agentTasks.splitStatus = 'split_rejected' → 删除关联 commandRecords 和 agentSubTasks ❌

#### 6. 拆解状态联动

**实现状态：** ⚠️ 部分实现
- agentTasks.splitStatus = 'split_confirmed' → commandResults.executionStatus = 'in_progress' ⚠️ 在创建时设置
- 其他拆解状态联动 ❌ 未实现

---

## 向下传递（失败状态）场景讨论

### 用户疑问
> 向下传递（失败状态）—— 这个流程我理解 只有数据修改的时候需要，我们可以讨论一下，这种情况发生在什么场景。

### 场景分析

#### 场景 1：人工手动标记任务失败（数据修改）
```
操作者（管理员/用户）在前端点击"标记失败"按钮
  → 调用 API: PUT /api/tasks/:taskId/status
  → agentTasks.taskStatus = 'failed'
  → 级联更新：所有关联的 commandResults 和 agentSubTasks 也标记为 failed
```

**触发条件：**
- 任务严重超期，不再有完成可能
- 任务被取消或废弃
- 资源不足，无法继续执行

**实现必要性：** ✅ 需要实现
- 保持数据一致性
- 避免遗留部分完成的子任务
- 便于后续数据清理和分析

---

#### 场景 2：指令执行失败自动级联
```
commandResults.executionStatus = 'failed' (由执行引擎或 Agent 报错)
  → 自动触发级联更新
  → agentTasks.taskStatus = 'failed'
  → 关联 agentSubTasks.status = 'failed'
```

**触发条件：**
- Agent 执行指令时遇到无法恢复的错误
- 执行环境异常（服务宕机、网络中断）
- 依赖的外部服务不可用

**实现必要性：** ✅ 需要实现
- 自动化状态管理，减少人工干预
- 及时反馈任务执行情况

---

#### 场景 3：子任务执行失败级联
```
某个 agentSubTasks.status = 'failed' (子任务执行失败)
  → 判断是否为关键子任务
  → 如果是：commandResults.executionStatus = 'failed'
  → 级联更新：agentTasks.taskStatus = 'failed'
  → 其他未完成的 agentSubTasks.status = 'failed'
```

**触发条件：**
- 关键子任务失败（如依赖的基础设施搭建失败）
- 子任务失败无法重试或重试次数耗尽
- 业务逻辑判定：某个子任务失败导致整个任务无法继续

**实现必要性：** ⚠️ 需要实现，但要区分场景
- 不是所有子任务失败都会导致整个任务失败
- 可以通过配置标记哪些子任务是"关键子任务"

---

#### 场景 4：批量失败重试
```
任务执行中遇到系统性问题
  → agentTasks.taskStatus = 'failed'
  → 修复问题后，点击"重新执行"
  → agentTasks.taskStatus 重置为 'in_progress'
  → 关联 commandResults 和 agentSubTasks 状态重置为 'pending' 或 'in_progress'
```

**触发条件：**
- 数据库临时不可用，导致多个任务同时失败
- 配置错误，修复后需要批量重试
- 系统升级后需要重新执行历史失败任务

**实现必要性：** ✅ 需要实现
- 支持失败任务的重试和恢复
- 便于系统维护和故障恢复

---

## 建议的实现方案

### ✅ 已完成 - 优先级 P0（已实现）

1. **向上传递完成状态**（已实现）
   - ✅ agentSubTasks 全部 completed → commandResults.completed
   - ✅ commandResults 全部 completed → agentTasks.completed

2. **向下传递失败状态**（已实现）
   - ✅ commandResults.failed → agentTasks.failed
   - ✅ agentTasks.failed → 所有子任务 failed
   - ✅ commandResults.failed → 所有子任务 failed

**实现文件：**
- `src/lib/services/task-state-machine.ts`
- `src/app/api/test/failure-cascade/route.ts` (测试 API)
- `public/test-failure-cascade.html` (测试页面)

---

### 🔄 待实现 - 优先级 P1（应该实现）

3. **拆解拒绝清理**
   - ❌ agentTasks.split_rejected → 删除关联数据（新增）

4. **子任务失败关键性判断**
   - ❌ 关键子任务失败 → 级联到指令和任务失败（新增）
   - 支持在 metadata 中标记 `isCritical: true`

### 优先级 P2（可以延后）

5. **执行中状态同步**
   - ❌ 批量同步执行中状态（新增）
   - 可通过定时任务或事件触发

6. **求助状态级联**
   - ❌ helping 状态 → blocked（新增）
   - 需要配合求助功能的实现

---

## 实现建议

### 方案 1：使用数据库触发器（推荐）
```sql
-- 创建触发器：commandResults 失败时级联更新 agentSubTasks
CREATE OR REPLACE FUNCTION cascade_command_failure_to_subtasks()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.executionStatus = 'failed' AND OLD.executionStatus != 'failed' THEN
    UPDATE agent_sub_tasks
    SET status = 'failed'
    WHERE command_result_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cascade_command_failure
AFTER UPDATE OF execution_status ON command_results
FOR EACH ROW
EXECUTE FUNCTION cascade_command_failure_to_subtasks();
```

### 方案 2：在 API 层实现（当前方案）
```typescript
// 在 updateTaskStatus 和 updateCommandStatus 中添加级联逻辑
static async updateTaskStatus(taskId: string, newStatus: TaskStatus) {
  // 更新任务状态
  await db.update(agentTasks).set({ taskStatus: newStatus }).where(...);

  // 如果任务失败，级联更新所有指令和子任务
  if (newStatus === TaskStatus.FAILED) {
    await this.cascadeTaskFailure(taskId);
  }
}

private static async cascadeTaskFailure(taskId: string) {
  // 获取所有关联指令
  const commands = await db.select().from(commandResults)
    .where(eq(commandResults.relatedTaskId, taskId));

  // 级联更新指令状态
  for (const cmd of commands) {
    await db.update(commandResults)
      .set({ executionStatus: CommandStatus.FAILED })
      .where(eq(commandResults.id, cmd.id));

    // 级联更新子任务状态
    await db.update(agentSubTasks)
      .set({ status: 'failed' })
      .where(eq(agentSubTasks.commandResultId, cmd.id));
  }
}
```

### 方案 3：使用状态机引擎（长期方案）
```typescript
// 使用 XState 或类似的状态机库
// 定义状态转换规则和副作用
const taskMachine = createMachine({
  id: 'task',
  initial: 'unsplit',
  states: {
    unsplit: {
      on: { SPLIT: 'splitting' }
    },
    splitting: {
      on: { SPLIT_COMPLETED: 'split_completed' }
    },
    split_completed: {
      on: { CONFIRM: 'in_progress' }
    },
    in_progress: {
      on: {
        ALL_SUBTASKS_COMPLETED: 'completed',
        ANY_SUBTASK_FAILED: 'failed'
      }
    },
    completed: {
      type: 'final'
    },
    failed: {
      type: 'final',
      entry: ['cascadeFailureToAllSubtasks'] // 自动级联
    }
  }
});
```

---

## 总结

### 当前实现情况（更新于 2025-01-17）
- ✅ **P0 - 向上传递（完成状态）**：已实现并验证
- ✅ **P0 - 向下传递（失败状态）**：已实现并验证
  - ✅ agentTasks.failed → 所有关联 commandResults.failed
  - ✅ agentTasks.failed → 所有关联 agentSubTasks.failed
  - ✅ commandResults.failed → 所有关联 agentSubTasks.failed
  - ✅ commandResults.failed → agentTasks.failed（原有逻辑）
- ❌ **P1 - 其他联动规则**：未实现
  - ❌ 拆解拒绝清理
  - ❌ 关键子任务失败判断
  - ❌ 执行中状态同步
  - ❌ 求助状态级联

### 向下传递失败状态的实际场景
1. **人工手动标记失败**（数据修改场景）- 最常见
2. **指令执行失败自动级联**（自动化场景）
3. **关键子任务失败导致任务失败**（业务逻辑场景）
4. **批量失败重试恢复**（运维场景）

### 测试说明
- **测试页面**：`/test-failure-cascade.html`
- **测试 API**：`POST /api/test/failure-cascade`
- **测试场景**：
  - 场景 1：任务失败 → 级联更新所有指令和子任务
  - 场景 2：指令失败 → 级联更新所有子任务

### 建议实现优先级（更新）
- ✅ **P0（已完成）**：完善失败状态级联（task → command → subtasks, command → subtasks）
- 🔄 **P1（待实现）**：拆解拒绝清理 + 关键子任务失败判断
- ⏳ **P2（可以延后）**：执行中状态同步 + 求助状态级联
