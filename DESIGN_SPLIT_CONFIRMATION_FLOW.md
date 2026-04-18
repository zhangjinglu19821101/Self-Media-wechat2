# 拆解确认流程设计方案

> **目标**：确保所有拆分必须等用户确认后才能触发后续操作，支持多次重新拆分，具备良好的扩展性
> **创建日期**：2026-02-15
> **版本**：v1.0

---

## 📋 业务流程

### 第一步：Agent B 拆分（agent_tasks → daily_tasks）

**正常流程：**
```
1. Agent B 返回拆解结果（通过 WebSocket）
   ↓
2. 前端调用 /api/save-split-result
   - 保存到 daily_tasks
   - is_confirmed = false（未确认）
   - executor: insurance-d / insurance-c / insurance-a
   ↓
3. 用户收到弹框，看到 Agent B 的拆解结果
   ↓
4. 用户确认
   ↓
5. 调用 confirm-split API
   - 将 daily_tasks 的 is_confirmed 设置为 true
   - 触发第二步拆分（insurance-d / insurance-c）
```

**重新拆分流程（可多次重复）：**
```
1. 用户拒绝 Agent B 的拆解结果
   ↓
2. 前端调用 /api/commands/reject
   - 删除所有关联的 daily_tasks
   - 更新 agent_tasks 状态为 split_rejected
   - 记录拒绝原因和历史
   ↓
3. 前端发送拒绝原因给 Agent B
   ↓
4. Agent B 重新拆分，返回新结果
   ↓
5. 前端再次调用 /api/save-split-result
   - 保存新的 daily_tasks
   - is_confirmed = false
   ↓
6. 用户再次确认或拒绝（可循环）
```

### 第二步：insurance-d/insurance-c 拆分（daily_tasks → agent_sub_tasks）

**正常流程：**
```
1. 定时任务检测到 is_confirmed = true 的 daily_tasks
   ↓
2. 触发对应 agent 的拆解 API
   - insurance-d: /api/agents/insurance-d/split-task
   - insurance-c: /api/agents/insurance-c/split-task
   ↓
3. insurance-d/insurance-c 返回拆解结果
   - 保存到 agent_sub_tasks
   - is_confirmed = false
   - 创建通知
   ↓
4. 用户收到弹框，看到拆解结果
   ↓
5. 用户确认
   ↓
6. 将 agent_sub_tasks 的 is_confirmed 设置为 true
   - 开始执行任务
```

**重新拆分流程（可多次重复）：**
```
1. 用户拒绝拆解结果
   ↓
2. 前端调用 /api/{agent}/reject-split
   - 删除 agent_sub_tasks 中的相关子任务
   - 更新 daily_tasks 状态（回到 pending_review）
   - 记录拒绝原因
   ↓
3. 如果 retry=true，重新触发拆解
   ↓
4. agent 重新拆分，返回新结果
   ↓
5. 用户再次确认或拒绝（可循环）
```

---

## 🔴 当前问题

### 问题1：save-split-result API 自动触发 insurance-d 拆解

**位置**：`src/lib/services/save-split-result-v2.ts` 第 270-295 行

**问题描述**：
```
1. Agent B 返回拆解结果
   ↓
2. 前端调用 /api/save-split-result
   - 保存到 daily_tasks
   - is_confirmed = false
   ↓
3. ❌ 后端自动触发 insurance-d 拆解（违反原则）
   ↓
4. 用户收到弹框
   ↓
5. 用户拒绝
   ↓
6. 但 insurance-d 已经拆分完成！❌
```

**根因**：
- save-split-result API 在保存后立即检查是否有 insurance-d 的任务
- 如果有，直接调用 insurance-d 拆解 API
- 违反了"必须等用户确认"的原则

---

## ✅ 解决方案

### 方案：删除自动触发逻辑，改为定时任务检测

#### 第一步：修改 save-split-result API

**文件**：`src/lib/services/save-split-result-v2.ts`

**修改内容**：
```typescript
// ❌ 删除第 270-295 行的自动触发 insurance-d 拆分的逻辑
// 只保存记录，不触发任何后续动作

// 删除这段代码：
// const insuranceDTasks = [...insertedTasks, ...skippedTasks].filter(
//   (t: any) => t.executor === 'insurance-d'
// );
// if (insuranceDTasks.length > 0) {
//   for (const insuranceDTask of insuranceDTasks) {
//     const response = await fetch('http://localhost:5000/api/agents/insurance-d/split-task', ...);
//   }
// }
```

#### 第二步：创建定时任务

**新建文件**：`src/lib/services/cron-split-trigger.ts`

**功能**：
```typescript
/**
 * 定时任务：检测并触发第二步拆解
 *
 * 逻辑：
 * 1. 每分钟轮询 daily_tasks 表
 * 2. 查找 is_confirmed = true 的记录
 * 3. 根据 executor 字段触发对应的拆解 API
 * 4. 支持多个执行主体（insurance-d, insurance-c, insurance-a）
 * 5. 按优先级排序（高优先级先执行）
 */

async function checkAndTriggerSplit() {
  // 1. 查询 is_confirmed = true 的 daily_tasks
  const tasks = await db
    .select()
    .from(dailyTasks)
    .where(and(
      eq(dailyTasks.isConfirmed, true),
      eq(dailyTasks.executionStatus, 'pending_review')
    ))
    .orderBy(dailyTasks.taskPriority); // 高优先级先执行

  // 2. 按 executor 分组
  const tasksByExecutor = groupBy(tasks, 'executor');

  // 3. 遍历每个 executor，触发对应的拆解 API
  for (const [executor, executorTasks] of Object.entries(tasksByExecutor)) {
    const taskIds = executorTasks.map(t => t.id);

    // 根据 executor 调用不同的拆解 API
    switch (executor) {
      case 'insurance-d':
        await triggerInsuranceDSplit(taskIds);
        break;
      case 'insurance-c':
        await triggerInsuranceCSplit(taskIds);
        break;
      case 'insurance-a':
        await triggerInsuranceASplit(taskIds);
        break;
      default:
        console.warn(`未知的 executor: ${executor}`);
    }
  }
}

// 触发 insurance-d 拆解
async function triggerInsuranceDSplit(taskIds: string[]) {
  const response = await fetch('/api/agents/insurance-d/split-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskIds }),
  });
}

// 触发 insurance-c 拆解
async function triggerInsuranceCSplit(taskIds: string[]) {
  const response = await fetch('/api/agents/insurance-c/split-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskIds }),
  });
}

// 触发 insurance-a 拆解
async function triggerInsuranceASplit(taskIds: string[]) {
  const response = await fetch('/api/agents/insurance-a/split-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskIds }),
  });
}

// 每分钟执行一次
setInterval(checkAndTriggerSplit, 60 * 1000);
```

#### 第三步：修改 confirm-split API

**文件**：`src/app/api/insurance-d/confirm-split/route.ts`（或其他 confirm-split API）

**修改内容**：
```typescript
// 用户确认后：
// 1. 将 daily_tasks 的 is_confirmed 设置为 true
await db.update(dailyTasks)
  .set({ isConfirmed: true })
  .where(eq(dailyTasks.id, taskId));

// 2. 定时任务会在下次轮询时检测到并触发拆解
// ✅ 不在这里直接触发拆解
```

---

## 🔧 扩展性分析

### 扩展性评估表

| 场景 | 能否兼容 | 需要改动 | 说明 |
|------|---------|---------|------|
| 第一步兼容 insurance-c | ✅ 可以 | ❌ 不需要 | mapExecutorId 已支持，Agent B 可返回 insurance-c 的任务 |
| 第一步兼容 insurance-a | ✅ 可以 | ❌ 不需要 | mapExecutorId 已支持，Agent B 可返回 insurance-a 的任务 |
| 第二步兼容 insurance-c | ❌ 不能 | ✅ 需要 | 需要创建 insurance-c 的拆解 API |
| 第二步兼容 insurance-a | ❌ 不能 | ✅ 需要 | 需要创建 insurance-a 的拆解 API |
| 支持多个执行主体 | ❌ 不能 | ✅ 需要 | 当前只支持 insurance-d，需要改为通用逻辑 |
| 按优先级排序 | ❌ 不能 | ✅ 需要 | 当前无排序，需要按 taskPriority 排序 |

### 当前扩展性问题

#### 问题1：第二步拆解硬编码 insurance-d

**位置**：`src/lib/services/save-split-result-v2.ts` 第 270-295 行

```typescript
// ❌ 硬编码只支持 insurance-d
const insuranceDTasks = [...insertedTasks, ...skippedTasks].filter(
  (t: any) => t.executor === 'insurance-d'
);
if (insuranceDTasks.length > 0) {
  // 只触发 insurance-d 拆解
}
```

**问题**：
- 如果 Agent B 返回 insurance-c 的任务，会被忽略
- 无法支持多个执行主体

#### 问题2：缺少 insurance-c 和 insurance-a 的拆解 API

**现状**：
- 只有 insurance-d 的拆解 API：`/api/agents/insurance-d/split-task`
- 缺少 insurance-c 的拆解 API
- 缺少 insurance-a 的拆解 API

---

## 🎯 完整修复方案（执行步骤）

### 步骤1：删除自动触发逻辑

**文件**：`src/lib/services/save-split-result-v2.ts`

**操作**：
- 删除第 270-295 行的自动触发 insurance-d 拆分的逻辑

### 步骤2：创建通用定时任务

**新建文件**：`src/lib/services/cron-split-trigger.ts`

**功能**：
- 每分钟轮询 daily_tasks 表
- 查找 is_confirmed = true 的记录
- 按 executor 分组
- 按 taskPriority 排序（高优先级先执行）
- 触发对应 agent 的拆解 API

### 步骤3：修改 confirm-split API

**文件**：`src/app/api/insurance-d/confirm-split/route.ts`

**操作**：
- 将 is_confirmed 设置为 true
- 不在这里直接触发拆解
- 让定时任务来处理

### 步骤4：扩展性增强（可选，未来实施）

**文件**：`src/lib/services/cron-split-trigger.ts`

**操作**：
- 支持多个 executor（insurance-d, insurance-c, insurance-a）
- 按优先级排序

---

## 📝 关键字段说明

### daily_tasks 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| task_id | string | 任务ID（如 daily-task-insurance-d-2026-02-15-001） |
| related_task_id | string | 关联的 agent_tasks ID |
| executor | string | 执行主体（insurance-d, insurance-c, insurance-a） |
| is_confirmed | boolean | 是否已确认（false：不触发拆分；true：触发拆解） |
| task_priority | string | 任务优先级（high, normal, low） |
| execution_status | string | 执行状态（pending_review, pending_execution, completed） |

### agent_sub_tasks 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| command_result_id | string | 关联的 daily_tasks ID |
| executor | string | 执行主体（insurance-d, insurance-c, insurance-a） |
| is_confirmed | boolean | 是否已确认（false：不执行；true：执行） |

---

## 🔄 重新拆分机制

### 第一步重新拆分（Agent B）

**API**：`POST /api/commands/reject`

**处理逻辑**：
1. 删除所有关联的 daily_tasks
2. 更新 agent_tasks 状态为 split_rejected
3. 记录拒绝原因和历史
4. 前端发送拒绝原因给 Agent B
5. Agent B 重新拆分

**可重复性**：✅ 可以无限次重新拆分

### 第二步重新拆分（insurance-d/insurance-c）

**API**：`POST /api/{agent}/reject-split`

**处理逻辑**：
1. 删除 agent_sub_tasks 中的相关子任务
2. 更新 daily_tasks 状态（回到 pending_review）
3. 记录拒绝原因
4. 如果 retry=true，重新触发拆解
5. agent 重新拆分

**可重复性**：✅ 可以无限次重新拆分

---

## ✅ 验证清单

修复后需要验证以下场景：

- [ ] 用户确认 Agent B 拆解结果后，insurance-d 才触发拆解
- [ ] 用户拒绝 Agent B 拆解结果后，insurance-d 不会触发拆解
- [ ] 第一步可以多次重新拆分
- [ ] 第二步可以多次重新拆分
- [ ] 支持 insurance-d 和 insurance-c 并存
- [ ] 支持按优先级排序（高优先级先执行）
- [ ] is_confirmed = false 时，定时任务不会触发拆解
- [ ] is_confirmed = true 时，定时任务会触发拆解

---

## 📌 重要提醒

### 禁止事项

❌ **禁止在 save-split-result API 中直接触发第二步拆解**
- 所有拆分都必须等用户确认
- is_confirmed 字段是关键控制点

❌ **禁止硬编码只支持某个 agent**
- 应该支持多个执行主体（insurance-d, insurance-c, insurance-a）
- 使用通用逻辑，根据 executor 字段动态触发

❌ **禁止忽略优先级**
- 高优先级的任务应该先执行
- 按任务优先级排序

### 必须遵守的原则

✅ **所有拆分必须等用户确认**
- 第一步：is_confirmed = false → 用户确认 → is_confirmed = true → 触发第二步
- 第二步：is_confirmed = false → 用户确认 → is_confirmed = true → 执行任务

✅ **支持多次重新拆分**
- 用户拒绝后可以无限次重新拆分
- 每次拒绝都会清除旧的子任务记录

✅ **具备良好的扩展性**
- 新增执行主体（如 insurance-c）时，第一步无需改动代码
- 第二步需要创建对应的拆解 API

---

## 📞 后续修复指引

**每次修复缺陷前，必须先阅读此文档！**

1. **理解业务流程**
   - 先看"业务流程"部分
   - 理解第一步和第二步的区别
   - 理解重新拆分机制

2. **检查相关代码**
   - save-split-result API
   - confirm-split API
   - reject-split API
   - 定时任务

3. **验证扩展性**
   - 新增 executor 是否需要改动代码
   - 是否支持多个执行主体
   - 是否支持优先级排序

4. **确保不违反原则**
   - 是否等用户确认
   - 是否支持重新拆分
   - is_confirmed 字段是否正确使用

---

**文档维护**：每次发现新问题或改进方案，立即更新此文档
