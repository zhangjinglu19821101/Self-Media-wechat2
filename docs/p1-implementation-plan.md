# P1 功能实现方案

## 整体实现策略

### 实现原则

1. **向后兼容**：不破坏现有功能，`isCritical` 默认为 `false`
2. **渐进增强**：先实现核心逻辑，再完善标记功能
3. **自动触发**：状态更新时自动执行，无需额外 API 调用
4. **可选配置**：支持手动覆盖 LLM 的判断

---

## 功能 1：拆解拒绝清理关联数据

### 实现位置

**文件：** `src/app/api/commands/reject/route.ts`

### 实现步骤

#### 步骤 1：在拆解拒绝时清理数据

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

// 3. 🔥 新增：删除所有关联的 commandResults
const deletedCommands = await db
  .delete(commandResults)
  .where(eq(commandResults.relatedTaskId, taskId))
  .returning();

console.log(`🗑️ 删除了 ${deletedCommands.length} 个废弃指令`);

// 注意：由于外键约束（ON DELETE CASCADE），删除 commandResults 会自动删除 agentSubTasks
// 但为了安全和明确，可以手动删除（如果外键未设置 CASCADE）

// 4. 🔥 新增：验证是否已清理所有子任务
const remainingSubTasks = await db
  .select()
  .from(agentSubTasks)
  .where(
    eq(agentSubTasks.commandResultId, sql`::uuid IN (
      SELECT id FROM command_results WHERE related_task_id = ${taskId}
    )`)
  );

if (remainingSubTasks.length > 0) {
  // 外键未设置 CASCADE，手动删除
  await db.delete(agentSubTasks)
    .where(
      eq(agentSubTasks.commandResultId, sql`::uuid IN (
        SELECT id FROM command_results WHERE related_task_id = ${taskId}
      )`)
    );
  console.log(`🗑️ 手动删除了 ${remainingSubTasks.length} 个废弃子任务`);
}
```

#### 步骤 2：添加日志记录

```typescript
// 在删除前记录日志
console.log(`📊 拆解拒绝数据统计:`, {
  taskId,
  deletedCommandsCount: deletedCommands.length,
  deletedSubTasksCount: remainingSubTasks.length,
  rejectionReason,
  rejectedBy: agentId
});
```

---

## 功能 2：关键子任务失败判断

### 实现位置

**文件：** `src/lib/services/task-state-machine.ts`

### 实现步骤

#### 步骤 1：在子任务状态更新时检查

```typescript
/**
 * 更新子任务状态（新增方法）
 */
static async updateSubTaskStatus(
  subTaskId: string,
  newStatus: string,
  updater: string = 'TS'
) {
  // 1. 获取当前子任务
  const [currentSubTask] = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.id, subTaskId));

  if (!currentSubTask) {
    throw new Error(`子任务 ${subTaskId} 不存在`);
  }

  // 2. 更新子任务状态
  const [updatedSubTask] = await db
    .update(agentSubTasks)
    .set({
      status: newStatus,
      updatedAt: new Date(),
      completedAt: newStatus === 'completed' ? new Date() : null
    })
    .where(eq(agentSubTasks.id, subTaskId))
    .returning();

  // 3. 🔥 新增：如果子任务失败，检查是否为关键子任务
  if (newStatus === 'failed') {
    await this.handleSubTaskFailure(subTaskId, currentSubTask);
  }

  // 4. 更新所属指令的完成进度
  await this.updateCommandProgress(currentSubTask.commandResultId);

  return updatedSubTask;
}

/**
 * 处理子任务失败
 */
private static async handleSubTaskFailure(
  subTaskId: string,
  subTask: any
) {
  // 1. 🔥 检查是否为关键子任务
  const isCritical = subTask.metadata?.isCritical === true;

  if (isCritical) {
    console.log(`🔴 关键子任务失败，级联更新任务: ${subTask.taskTitle}`);

    // 2. 获取所属指令
    const [command] = await db
      .select()
      .from(commandResults)
      .where(eq(commandResults.id, subTask.commandResultId));

    if (command) {
      // 3. 级联更新指令和任务为失败
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

#### 步骤 2：更新指令进度（兼容现有逻辑）

```typescript
/**
 * 更新指令进度（重构现有逻辑）
 */
private static async updateCommandProgress(commandResultId: string) {
  // 1. 获取所有子任务
  const subTasks = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.commandResultId, commandResultId));

  if (subTasks.length === 0) {
    return;
  }

  // 2. 统计完成数量
  const completedCount = subTasks.filter(st => st.status === 'completed').length;
  const failedCount = subTasks.filter(st => st.status === 'failed').length;

  // 3. 更新指令进度
  await db.update(commandResults)
    .set({
      completedSubTasks: completedCount,
      completedSubTasksDescription: subTasks.find(st => st.status === 'completed')?.taskTitle || '',
    })
    .where(eq(commandResults.id, commandResultId));

  // 4. 如果所有子任务都完成了，更新指令状态
  if (completedCount + failedCount === subTasks.length) {
    // 判断是否有关键子任务失败
    const hasCriticalFailed = subTasks.some(
      st => st.status === 'failed' && st.metadata?.isCritical === true
    );

    if (hasCriticalFailed) {
      await this.updateCommandStatus(
        subTasks[0].commandResultId, // 注意：这里需要 commandId
        CommandStatus.FAILED,
        'TS',
        '存在失败的关键子任务'
      );
    } else if (completedCount === subTasks.length) {
      await db.update(commandResults)
        .set({
          executionStatus: CommandStatus.COMPLETED,
          completedAt: new Date(),
        })
        .where(eq(commandResults.id, commandResultId));
    }
  }
}
```

---

## 如何标记关键子任务？

### 方案 A：LLM 自动判断（推荐）

**优点：**
- 自动化，无需人工干预
- 基于业务逻辑判断，更准确

**实现：**

修改 `src/lib/agent-llm.ts` 中的 `splitTaskForAgent` 函数：

```typescript
const prompt = `
请基于你的身份和能力边界，将这个任务拆分成 3-5 个具体的执行步骤。

## 返回格式

\`\`\`json
[
  {
    "orderIndex": 1,
    "title": "步骤标题",
    "description": "步骤描述",
    "acceptanceCriteria": "验收标准",
    "isCritical": true/false,  // 🔥 新增：是否为关键子任务
    "reason": "判断原因（如果是关键子任务，说明原因）"
  }
]
\`\`\`

## 关键子任务判断标准

请根据以下标准判断子任务是否为关键：

1. **前置依赖**：如果该子任务失败，后续子任务无法执行 → isCritical: true
2. **核心功能**：该子任务是实现目标的核心功能 → isCritical: true
3. **可替代性**：该子任务失败后，有替代方案 → isCritical: false
4. **可延后性**：该子任务可以延后到后续迭代 → isCritical: false

## 示例

### 示例 1：软件开发任务
\`\`\`json
[
  {
    "orderIndex": 1,
    "title": "搭建基础架构",
    "description": "创建项目框架、配置数据库",
    "acceptanceCriteria": "框架创建完成，数据库连接正常",
    "isCritical": true,
    "reason": "基础架构是所有后续开发的前提"
  },
  {
    "orderIndex": 2,
    "title": "开发评论模块",
    "description": "实现商品评论功能",
    "acceptanceCriteria": "用户可以发布和查看评论",
    "isCritical": false,
    "reason": "评论功能可以延后到后续迭代"
  }
]
\`\`\`
`;
```

### 方案 B：API 手动标记（补充）

**优点：**
- 灵活性高，可以手动调整
- 支持特殊场景

**实现：**

新增 API：`PUT /api/subtasks/:subtaskId/critical`

```typescript
// src/app/api/subtasks/[subtaskId]/critical/route.ts

export async function PUT(
  request: NextRequest,
  { params }: { params: { subtaskId: string } }
) {
  const body = await request.json();
  const { isCritical, reason } = body;

  // 更新子任务的关键性标记
  const [updatedSubTask] = await db
    .update(agentSubTasks)
    .set({
      metadata: {
        ...existingSubTask.metadata,
        isCritical,
        criticalReason: reason
      }
    })
    .where(eq(agentSubTasks.id, params.subtaskId))
    .returning();

  return NextResponse.json({
    success: true,
    data: updatedSubTask
  });
}
```

### 方案 C：前端界面标记（可视化）

**实现：**

在子任务列表中添加关键标记开关：

```tsx
// components/SubTaskItem.tsx

interface SubTaskItemProps {
  subTask: SubTask;
  onUpdateCritical: (id: string, isCritical: boolean, reason?: string) => Promise<void>;
}

export function SubTaskItem({ subTask, onUpdateCritical }: SubTaskItemProps) {
  return (
    <div className="flex items-center gap-4 p-4 border rounded">
      <div className="flex-1">
        <h3 className="font-semibold">{subTask.taskTitle}</h3>
        <p className="text-sm text-gray-600">{subTask.taskDescription}</p>
      </div>

      {/* 关键标记开关 */}
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={subTask.metadata?.isCritical || false}
            onChange={(e) => onUpdateCritical(subTask.id, e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">关键子任务</span>
        </label>
      </div>

      {/* 关键子任务标识 */}
      {subTask.metadata?.isCritical && (
        <Badge variant="destructive">关键</Badge>
      )}
    </div>
  );
}
```

---

## 完整实现计划

### 阶段 1：核心逻辑实现（当前任务）

**优先级：P0 → P1**

**任务清单：**
- [x] P0: 失败状态级联
- [ ] P1-1: 拆解拒绝清理关联数据
- [ ] P1-2: 关键子任务失败判断（核心逻辑）
- [ ] P1-3: 子任务状态更新 API

**文件变更：**
- `src/app/api/commands/reject/route.ts` - 添加数据清理逻辑
- `src/lib/services/task-state-machine.ts` - 添加关键子任务判断
- `src/app/api/subtasks/[subtaskId]/route.ts` - 新增状态更新 API

---

### 阶段 2：标记功能完善（后续任务）

**优先级：P1 → P2**

**任务清单：**
- [ ] P2-1: LLM 自动判断关键子任务
- [ ] P2-2: API 手动标记关键子任务
- [ ] P2-3: 前端界面关键标记开关
- [ ] P2-4: 关键子任务列表筛选

**文件变更：**
- `src/lib/agent-llm.ts` - 添加 isCritical 判断逻辑
- `src/app/api/subtasks/[subtaskId]/critical/route.ts` - 新增标记 API
- `components/SubTaskItem.tsx` - 添加关键标记开关
- `app/dashboard/subtasks/page.tsx` - 添加筛选功能

---

### 阶段 3：测试和文档（质量保证）

**任务清单：**
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 更新 API 文档
- [ ] 更新用户手册

---

## 向后兼容性保证

### 默认行为

```typescript
// 如果没有 metadata.isCritical，默认为 false
const isCritical = subTask.metadata?.isCritical === true;

// 等价于：所有子任务都是非关键的，与现有行为一致
```

### 兼容现有数据

```typescript
// 查询现有子任务，自动添加默认值
const subTasks = await db.select().from(agentSubTasks);

subTasks.forEach(st => {
  // 如果没有 isCritical，视为 false
  const isCritical = st.metadata?.isCritical || false;
});
```

### 渐进式启用

```typescript
// 配置项：是否启用关键子任务判断
const ENABLE_CRITICAL_CHECK = process.env.ENABLE_CRITICAL_CHECK === 'true';

if (ENABLE_CRITICAL_CHECK && isCritical) {
  // 启用时才执行关键子任务判断
  await this.updateCommandStatus(..., CommandStatus.FAILED);
}
```

---

## 我的实施建议

### 立即实施（当前会话）

**功能 1：拆解拒绝清理关联数据**
- ✅ 修改 `src/app/api/commands/reject/route.ts`
- ✅ 添加删除逻辑和日志记录
- ✅ 测试清理功能

**功能 2：关键子任务失败判断（核心逻辑）**
- ✅ 修改 `src/lib/services/task-state-machine.ts`
- ✅ 添加 `updateSubTaskStatus` 方法
- ✅ 添加 `handleSubTaskFailure` 方法
- ✅ 测试判断逻辑

### 后续实施（下次会话）

**标记功能完善**
- 修改 `src/lib/agent-llm.ts` 添加 LLM 判断
- 添加 API 手动标记功能
- 添加前端界面标记开关

---

## 总结

### 我的方案是什么？

1. **核心逻辑优先**：先实现状态更新的判断逻辑，不依赖标记功能
2. **自动触发**：状态更新时自动执行，无需额外 API 调用
3. **向后兼容**：默认行为与现有逻辑一致，`isCritical` 为 `false`
4. **渐进增强**：先实现核心，再完善标记功能

### 只在判断关键任务时实现吗？

**不是！** 实际上是：

1. **拆解拒绝清理**：在拆解拒绝时自动执行，与关键子任务无关
2. **关键子任务判断**：在子任务状态更新时触发，无论是否为关键子任务都会检查
3. **标记功能**：后续补充，用于设置 `isCritical` 字段

### 实现顺序

1. ✅ **阶段 1**：核心逻辑（状态更新时的判断和清理）
2. ⏳ **阶段 2**：标记功能（如何设置 isCritical）
3. ⏳ **阶段 3**：界面优化（前端开关和筛选）

这样设计的好处是：
- ✅ 核心逻辑独立，不依赖标记功能
- ✅ 可以手动在数据库中设置 `isCritical` 进行测试
- ✅ 标记功能可以逐步完善，不影响核心逻辑
