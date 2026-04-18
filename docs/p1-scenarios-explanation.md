# P1 场景详细说明

## 场景 3：拆解拒绝清理关联数据

### 当前代码问题

查看 `src/app/api/commands/reject/route.ts`：

```typescript
// 2. 更新总任务状态为拒绝
await TaskManager.updateTaskSplitStatus(taskId, 'split_rejected', {
  metadata: {
    ...task.metadata,
    rejectionReason,
    rejectedAt: new Date().toISOString(),
    rejectedBy: agentId,
  },
});

// 3. 更新所有子任务的拒绝理由
await db.update(commandResults)
  .set({
    rejectionReason,
    isConfirmed: false,
    updatedAt: now,
  })
  .where(eq(commandResults.relatedTaskId, taskId));
```

**问题：** 只更新了状态字段，但保留了所有关联的 `commandResults` 和 `agentSubTasks` 记录。

---

### 实际业务场景

#### 场景描述

**Agent B** 拆分任务后，**Agent A** 审核发现拆分结果不符合要求，拒绝拆分，要求 Agent B 重新拆分。

**具体案例：**

**初始状态：**
```
agentTasks.taskId = "task-user-to-B-001"
agentTasks.taskStatus = "split_pending_review"
agentTasks.splitStatus = "split_pending_review"

关联的 commandResults：
  - commandResults.commandId = "cmd-task-001-01"
  - commandResults.commandId = "cmd-task-001-02"
  - commandResults.commandId = "cmd-task-001-03"

关联的 agentSubTasks：
  - agentSubTasks.id = "subtask-001-01-01" (属于 command 01)
  - agentSubTasks.id = "subtask-001-01-02" (属于 command 01)
  - agentSubTasks.id = "subtask-001-02-01" (属于 command 02)
  - ... 共 10 个子任务
```

**Agent A 拒绝拆解：**
```
POST /api/commands/reject
{
  agentId: "agent A",
  taskId: "task-user-to-B-001",
  rejectionReason: "拆分不够详细，缺少数据准备步骤，且时间安排不合理"
}
```

**当前行为（问题）：**
```
agentTasks.splitStatus = "split_rejected"
agentTasks.metadata.rejectionReason = "拆分不够详细..."

commandResults 全部保留，只是设置了 rejectionReason
agentSubTasks 全部保留，没有任何变化

❌ 问题：这些数据已经"废弃"，但仍然占用存储空间
❌ 问题：重新拆解时，会产生新的数据，导致数据冗余
❌ 问题：查询任务时，会包含已废弃的数据
```

**期望行为（P1 修复后）：**
```
agentTasks.splitStatus = "split_rejected"
agentTasks.metadata.rejectionReason = "拆分不够详细..."

✅ 删除所有关联的 commandResults（3 条记录）
✅ 删除所有关联的 agentSubTasks（10 条记录）
✅ agentTasks 重置为可重新拆解的状态
```

**Agent B 重新拆解：**
```
POST /api/commands/split
{
  taskId: "task-user-to-B-001",
  agentId: "agent B"
}

✅ 创建新的 commandResults（新的拆分结果）
✅ 创建新的 agentSubTasks（新的子任务）
✅ 没有数据冗余，数据库干净
```

---

### 为什么需要清理数据？

#### 1. 避免数据冗余

**不清理的情况：**
```
任务重新拆解 5 次后：
- commandResults：15 条记录（3 条有效 + 12 条废弃）
- agentSubTasks：50 条记录（10 条有效 + 40 条废弃）

❌ 数据库膨胀
❌ 查询变慢
❌ 统计困难（需要过滤废弃数据）
```

**清理的情况：**
```
任务重新拆解 5 次后：
- commandResults：3 条记录（全是有效数据）
- agentSubTasks：10 条记录（全是有效数据）

✅ 数据库干净
✅ 查询快速
✅ 统计简单
```

#### 2. 避免状态混淆

**不清理的情况：**
```sql
-- 查询任务的子任务
SELECT * FROM agent_sub_tasks
WHERE command_result_id IN (
  SELECT id FROM command_results
  WHERE related_task_id = 'task-user-to-B-001'
);

❌ 返回 10 条记录，其中 7 条是废弃的
❌ 前端需要额外过滤废弃数据
❌ 计算进度时会出现错误（7/10 而不是 0/10）
```

**清理的情况：**
```sql
-- 查询任务的子任务
SELECT * FROM agent_sub_tasks
WHERE command_result_id IN (
  SELECT id FROM command_results
  WHERE related_task_id = 'task-user-to-B-001'
);

✅ 返回 3 条记录，全是有效数据
✅ 前端直接使用，无需过滤
✅ 进度计算正确（0/3）
```

#### 3. 符合业务语义

**业务语义：**
- 拆解被拒绝 = 拆分结果无效
- 无效数据 = 应该被删除或归档
- 重新拆解 = 创建新的有效数据

**类比：**
- 就像编辑文档，撤销后删除草稿
- 就像电商订单取消后删除未完成的支付记录
- 就像代码提交被驳回后，删除未合并的分支

---

### 实现方案

```typescript
// src/app/api/commands/reject/route.ts

// 2. 更新总任务状态为拒绝
await TaskManager.updateTaskSplitStatus(taskId, 'split_rejected', {
  metadata: {
    ...task.metadata,
    rejectionReason,
    rejectedAt: new Date().toISOString(),
    rejectedBy: agentId,
  },
});

// 3. 🔥 P1 新增：删除所有关联的 commandResults
const deletedCommands = await db
  .delete(commandResults)
  .where(eq(commandResults.relatedTaskId, taskId))
  .returning();

console.log(`🗑️ 删除了 ${deletedCommands.length} 个废弃指令`);

// 4. 🔥 P1 新增：删除所有关联的 agentSubTasks
// 注意：由于外键约束（ON DELETE CASCADE），删除 commandResults 会自动删除 agentSubTasks
// 但为了安全和明确，可以手动删除

console.log(`✅ 任务拆解已拒绝并清理关联数据: taskId=${taskId}`);
```

---

## 场景 4：关键子任务失败判断

### 什么是关键子任务？

**定义：**
关键子任务是指如果该子任务失败，会导致整个任务无法完成的子任务。

**对比：**
- **关键子任务**：失败 → 整个任务失败
- **普通子任务**：失败 → 标记失败，但任务可以继续

---

### 实际业务场景

#### 场景 1：软件开发项目

**任务：开发电商系统**

**子任务列表：**
```json
[
  {
    "id": "subtask-001",
    "title": "搭建基础架构",
    "description": "创建项目框架、配置数据库连接、搭建 CI/CD 流程",
    "metadata": {
      "isCritical": true,  // 🔥 关键子任务
      "reason": "基础架构是所有后续开发的前提"
    }
  },
  {
    "id": "subtask-002",
    "title": "开发用户模块",
    "description": "用户注册、登录、个人信息管理",
    "metadata": {
      "isCritical": true  // 🔥 关键子任务
    }
  },
  {
    "id": "subtask-003",
    "title": "开发商品模块",
    "description": "商品列表、详情、搜索",
    "metadata": {
      "isCritical": true  // 🔥 关键子任务
    }
  },
  {
    "id": "subtask-004",
    "title": "开发订单模块",
    "description": "购物车、下单、支付",
    "metadata": {
      "isCritical": true  // 🔥 关键子任务
    }
  },
  {
    "id": "subtask-005",
    "title": "开发评论模块",
    "description": "商品评论、用户评价",
    "metadata": {
      "isCritical": false  // ❌ 非关键子任务
      "reason": "评论功能可以后续迭代，不影响系统核心功能"
    }
  },
  {
    "id": "subtask-006",
    "title": "开发推荐模块",
    "description": "个性化商品推荐",
    "metadata": {
      "isCritical": false  // ❌ 非关键子任务
      "reason": "推荐功能可以后续迭代，不影响系统核心功能"
    }
  }
]
```

**场景 A：关键子任务失败**
```
subtask-001（搭建基础架构）失败
  → metadata.isCritical = true
  → 🔥 级联更新：整个任务失败
  → agentTasks.taskStatus = 'failed'
  → 所有关联子任务标记为 'failed'

❌ 结果：整个电商系统开发失败，无法继续
```

**场景 B：非关键子任务失败**
```
subtask-005（开发评论模块）失败
  → metadata.isCritical = false
  → ✅ 仅标记该子任务失败
  → agentSubTasks.status = 'failed'
  → 任务继续执行

✅ 结果：评论功能缺失，但电商系统仍然可用
```

---

#### 场景 2：数据迁移任务

**任务：迁移 100 万用户数据到新系统**

**子任务列表：**
```json
[
  {
    "id": "subtask-001",
    "title": "创建目标数据库",
    "description": "在新系统中创建数据库和表结构",
    "metadata": {
      "isCritical": true,  // 🔥 关键子任务
      "reason": "没有数据库无法导入数据"
    }
  },
  {
    "id": "subtask-002",
    "title": "导出用户数据",
    "description": "从旧系统导出 100 万用户数据",
    "metadata": {
      "isCritical": true  // 🔥 关键子任务
    }
  },
  {
    "id": "subtask-003",
    "title": "数据清洗",
    "description": "清洗重复、无效的数据",
    "metadata": {
      "isCritical": false  // ❌ 非关键子任务
      "reason": "即使清洗不完美，也可以先导入部分数据"
    }
  },
  {
    "id": "subtask-004",
    "title": "导入用户数据",
    "description": "将清洗后的数据导入新系统",
    "metadata": {
      "isCritical": true  // 🔥 关键子任务
    }
  },
  {
    "id": "subtask-005",
    "title": "数据验证",
    "description": "验证数据完整性和准确性",
    "metadata": {
      "isCritical": false  // ❌ 非关键子任务
      "reason": "可以分批验证，发现问题时手动修正"
    }
  }
]
```

**场景 A：关键子任务失败**
```
subtask-002（导出用户数据）失败
  → metadata.isCritical = true
  → 🔥 级联更新：整个任务失败
  → 无法继续迁移数据

❌ 结果：数据迁移失败，需要排查问题后重试
```

**场景 B：非关键子任务失败**
```
subtask-005（数据验证）失败
  → metadata.isCritical = false
  → ✅ 仅标记该子任务失败
  → 任务继续执行，可以手动验证数据

✅ 结果：数据迁移完成，但需要人工验证数据准确性
```

---

#### 场景 3：保险内容创作

**任务：创作 5 篇保险科普文章**

**子任务列表：**
```json
[
  {
    "id": "subtask-001",
    "title": "选题确定",
    "description": "确定 5 篇文章的主题和方向",
    "metadata": {
      "isCritical": true,  // 🔥 关键子任务
      "reason": "没有选题无法撰写文章"
    }
  },
  {
    "id": "subtask-002",
    "title": "撰写第 1 篇文章",
    "description": "撰写第 1 篇保险科普文章",
    "metadata": {
      "isCritical": false  // ❌ 非关键子任务
      "reason": "可以减少文章数量，但至少要完成 1 篇"
    }
  },
  {
    "id": "subtask-003",
    "title": "撰写第 2 篇文章",
    "description": "撰写第 2 篇保险科普文章",
    "metadata": {
      "isCritical": false  // ❌ 非关键子任务
    }
  },
  {
    "id": "subtask-004",
    "title": "撰写第 3 篇文章",
    "description": "撰写第 3 篇保险科普文章",
    "metadata": {
      "isCritical": false  // ❌ 非关键子任务
    }
  },
  {
    "id": "subtask-005",
    "title": "撰写第 4 篇文章",
    "description": "撰写第 4 篇保险科普文章",
    "metadata": {
      "isCritical": false  // ❌ 非关键子任务
    }
  },
  {
    "id": "subtask-006",
    "title": "撰写第 5 篇文章",
    "description": "撰写第 5 篇保险科普文章",
    "metadata": {
      "isCritical": false  // ❌ 非关键子任务
    }
  },
  {
    "id": "subtask-007",
    "title": "合规审查",
    "description": "对所有文章进行合规审查",
    "metadata": {
      "isCritical": true  // 🔥 关键子任务
      "reason": "保险内容必须通过合规审查才能发布"
    }
  }
]
```

**场景 A：关键子任务失败**
```
subtask-007（合规审查）失败
  → metadata.isCritical = true
  → 🔥 级联更新：整个任务失败
  → 所有文章不能发布

❌ 结果：内容创作失败，需要修改文章后重新审查
```

**场景 B：非关键子任务失败**
```
subtask-004（撰写第 3 篇文章）失败
  → metadata.isCritical = false
  → ✅ 仅标记该子任务失败
  → 任务继续执行

✅ 结果：完成 4 篇文章（而不是 5 篇），但任务仍然成功
```

---

### 如何判断是否为关键子任务？

#### 方法 1：在拆分任务时由 Agent B 标记

```typescript
// src/lib/agent-llm.ts

export async function splitTaskForAgent(agentId: string, task: any) {
  const prompt = `
请基于你的身份和能力边界，将这个任务拆分成 3-5 个具体的执行步骤。

## 返回格式

请严格按照以下 JSON 格式返回：

\`\`\`json
[
  {
    "orderIndex": 1,
    "title": "步骤标题",
    "description": "步骤描述",
    "acceptanceCriteria": "验收标准",
    "isCritical": true/false,  // 🔥 新增：是否为关键子任务
    "reason": "判断原因（如果是关键子任务）"
  }
]
\`\`\`

## 关键子任务判断标准

请根据以下标准判断子任务是否为关键：

1. **前置依赖**：如果该子任务失败，后续子任务无法执行 → isCritical: true
2. **核心功能**：该子任务是实现目标的核心功能 → isCritical: true
3. **可替代性**：该子任务失败后，有替代方案 → isCritical: false
4. **可延后性**：该子任务可以延后到后续迭代 → isCritical: false
  `;

  const result = await callLLM(prompt);
  return JSON.parse(result);
}
```

#### 方法 2：在创建子任务时手动标记

```typescript
// 前端页面：子任务列表

<SubTaskList>
  <SubTaskItem
    title="搭建基础架构"
    isCritical={true}
    onToggleCritical={(id, isCritical) => {
      updateSubTask(id, { metadata: { isCritical } });
    }}
  >
    <Checkbox label="关键子任务" checked={true} />
  </SubTaskItem>

  <SubTaskItem
    title="开发评论模块"
    isCritical={false}
  >
    <Checkbox label="关键子任务" checked={false} />
  </SubTaskItem>
</SubTaskList>
```

---

### 实现方案

```typescript
// src/lib/services/task-state-machine.ts

/**
 * 检查子任务失败是否导致任务失败
 */
private static async checkSubTaskFailure(
  subTaskId: string,
  subTaskStatus: string
) {
  // 1. 如果子任务未失败，不需要级联
  if (subTaskStatus !== 'failed') {
    return;
  }

  // 2. 获取子任务信息
  const [subTask] = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.id, subTaskId));

  if (!subTask) {
    return;
  }

  // 3. 🔥 P1 新增：判断是否为关键子任务
  const isCritical = subTask.metadata?.isCritical === true;

  if (isCritical) {
    console.log(`🔴 关键子任务失败，级联更新任务: ${subTask.taskTitle}`);

    // 4. 获取所属指令
    const [command] = await db
      .select()
      .from(commandResults)
      .where(eq(commandResults.id, subTask.commandResultId));

    if (command) {
      // 5. 级联更新指令和任务为失败
      await this.updateCommandStatus(
        command.commandId,
        CommandStatus.FAILED,
        'TS',
        `关键子任务失败：${subTask.taskTitle}`
      );
    }
  } else {
    console.log(`⚠️ 非关键子任务失败，仅标记子任务: ${subTask.taskTitle}`);
    // 非关键子任务失败，不影响整体任务
  }
}
```

---

## 总结

### 场景 3：拆解拒绝清理关联数据
- **问题**：拆解被拒绝后，废弃数据仍然保留，导致数据冗余和状态混淆
- **解决方案**：删除所有关联的 `commandResults` 和 `agentSubTasks`
- **业务价值**：保持数据库干净，避免数据冗余，简化查询逻辑

### 场景 4：关键子任务失败判断
- **问题**：所有子任务失败都会导致整个任务失败，不够灵活
- **解决方案**：通过 `metadata.isCritical` 标记关键子任务，只有关键子任务失败才级联更新任务
- **业务价值**：提高系统容错能力，支持部分失败场景，更符合实际业务需求
