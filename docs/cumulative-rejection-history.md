# 累积拒绝原因功能实现文档

## 需求描述

1. **应该记录每次被拒绝的原因**
2. **拿着拒绝的原因，重新提交给 insurance-d 进行新一轮的拆分**
3. **如果再被拒绝，应该拿着 2 次被拒绝的原因，重新提交 insurance-d 再进行新一轮的拆分**

## 核心设计

### 数据结构

在 `agentTasks.metadata` 中存储拒绝历史：

```typescript
metadata: {
  rejectionReason: "最后一次拒绝的原因",
  rejectedAt: "2026-02-13T10:00:00Z",
  rejectedBy: "A",
  rejectionHistory: [
    {
      reason: "第一次拒绝原因",
      rejectedAt: "2026-02-13T09:00:00Z",
      rejectedBy: "A",
      rejectionCount: 1
    },
    {
      reason: "第二次拒绝原因",
      rejectedAt: "2026-02-13T10:00:00Z",
      rejectedBy: "A",
      rejectionCount: 2
    }
  ],
  totalRejections: 2  // 总拒绝次数
}
```

## 关键决策

- **拒绝历史累积策略**：使用 `agentTasks.metadata.rejectionHistory` 数组存储所有拒绝记录，每次拒绝追加新记录。
- **拒绝时数据清理**：每次拒绝时删除所有关联的 `daily_tasks`，避免数据冗余。
- **重新拆解提示词增强**：在拆解接口和前端提示词中包含所有历史拒绝原因，确保 Agent 能看到完整反馈。
- **目标 Agent 识别优化**：拒绝时优先从拆解结果的 `executor` 字段获取目标 Agent，其次查询任务的 `toAgentId`，避免硬编码通知 Agent B。
- **任务 ID 一致性**：确保前后端使用相同的任务 ID，避免拒绝时找不到任务。

## 实现方案

### 前置条件：修复任务 ID 不匹配问题

**重要**：在实现累积拒绝历史功能之前，必须先修复任务 ID 不匹配问题。详见 [任务 ID 修复文档](./task-id-mismatch-fix.md)。

**核心问题**：
- 前端生成临时任务 ID（`task-A-B-split-{timestamp}`），但后端忽略传递的 ID，重新生成新任务 ID
- 导致拒绝时找不到任务，拒绝历史无法记录

**解决方案**：
1. 前端使用后端返回的实际任务 ID
2. 添加 `currentTaskId` 状态变量，在收到新指令时自动保存 `taskId`
3. 发送任务结果时使用保存的 `currentTaskId`

### 1. 修改拒绝接口（`/api/commands/reject`）

**功能**：
- 获取当前拒绝历史（如果存在）
- 添加本次拒绝原因到历史记录
- 删除所有关联的子任务（清理数据）
- 更新任务状态为 `split_rejected`
- 保存完整的拒绝历史到 `metadata`

**关键代码**：

```typescript
// 获取当前拒绝历史（如果存在）
const rejectionHistory = task.metadata?.rejectionHistory || [];

// 添加本次拒绝原因到历史记录
const newRejectionHistory = [
  ...rejectionHistory,
  {
    reason: rejectionReason,
    rejectedAt: new Date().toISOString(),
    rejectedBy: agentId,
    rejectionCount: rejectionHistory.length + 1,
  }
];

// 删除所有关联的子任务
await db.delete(dailyTasks).where(eq(dailyTasks.relatedTaskId, taskId));

// 更新任务状态
await TaskManager.updateTaskSplitStatus(taskId, 'split_rejected', {
  metadata: {
    ...task.metadata,
    rejectionReason,
    rejectedAt: new Date().toISOString(),
    rejectedBy: agentId,
    rejectionHistory: newRejectionHistory,
    totalRejections: newRejectionHistory.length,
  },
});
```

### 2. 修改拆解接口（`/api/split-insurance-d-task`）

**功能**：
- 获取任务的拒绝历史（如果存在）
- 将拒绝历史传递给 `splitTaskWithLLM` 函数
- 在每日子任务的描述中包含所有拒绝原因

**关键代码**：

```typescript
// 获取拒绝历史（如果存在）
const rejectionHistory = task.metadata?.rejectionHistory || [];
const totalRejections = task.metadata?.totalRejections || 0;

if (rejectionHistory.length > 0) {
  console.log(`📝 此任务曾被拒绝 ${totalRejections} 次：`);
  rejectionHistory.forEach((r: any) => {
    console.log(`   #${r.rejectionCount}: ${r.reason}`);
  });
}

// 使用 LLM 智能拆解任务（传入拒绝历史）
const dailySubtasks = await splitTaskWithLLM(task, totalDays, startDate, rejectionHistory);
```

### 3. 修改拆解函数（`splitTaskWithLLM`）

**功能**：
- 接受 `rejectionHistory` 参数
- 构建拒绝历史提示词
- 将拒绝历史添加到每日子任务的描述中

**关键代码**：

```typescript
async function splitTaskWithLLM(
  task: any,
  totalDays: number,
  startDate: Date,
  rejectionHistory: any[] = [] // 拒绝历史参数
) {
  // 构建拒绝历史提示词
  let rejectionHistoryPrompt = '';
  if (rejectionHistory.length > 0) {
    rejectionHistoryPrompt = `\n\n【重要：历史拒绝反馈】\n此任务之前已经被拒绝 ${rejectionHistory.length} 次，请仔细阅读以下反馈并确保在新的拆解中解决所有问题：\n\n`;
    rejectionHistory.forEach((r: any) => {
      rejectionHistoryPrompt += `--- 第 ${r.rejectionCount} 次拒绝 ---\n`;
      rejectionHistoryPrompt += `拒绝时间：${new Date(r.rejectedAt).toLocaleString('zh-CN')}\n`;
      rejectionHistoryPrompt += `拒绝原因：${r.reason}\n\n`;
    });
    rejectionHistoryPrompt += `【关键要求】\n请务必在新的拆解方案中解决以上所有 ${rejectionHistory.length} 个问题，避免重复犯错！\n`;
  }

  // 在子任务描述中添加拒绝历史
  taskDescription = `...${rejectionHistoryPrompt}`;
}
```

### 4. 修改前端提示词（`/app/agents/[id]/page.tsx`）

**功能**：
- 查询任务的拒绝历史
- 在拒绝提示词中包含所有拒绝原因
- 让 Agent 了解之前被拒绝的原因

**关键代码**：

```typescript
// 查询任务的拒绝历史
const taskResponse = await fetch(`/api/tasks/${splitResultTaskId}`);
const taskData = await taskResponse.json();

if (taskData.success && taskData.data.metadata) {
  rejectionHistory = taskData.data.metadata.rejectionHistory || [];
  totalRejections = taskData.data.metadata.totalRejections || 0;
}

// 构建拒绝历史文本
let rejectionHistoryText = '';
if (rejectionHistory.length > 0) {
  rejectionHistoryText = '\n\n【历史拒绝记录】\n此任务之前已经被拒绝，请参考以下历史反馈：\n\n';
  rejectionHistory.forEach((r: any) => {
    rejectionHistoryText += `--- 第 ${r.rejectionCount} 次拒绝 ---\n`;
    rejectionHistoryText += `拒绝时间：${new Date(r.rejectedAt).toLocaleString('zh-CN')}\n`;
    rejectionHistoryText += `拒绝原因：${r.reason}\n\n`;
  });
  rejectionHistoryText += `【关键】请确保在新的拆解中解决以上所有问题！\n`;
}

// 在提示词中包含拒绝历史
const rejectPrompt = `
**本次拒绝原因：**
${rejectReason}${rejectionHistoryText}

**【重新拆解要求】**
请根据上述拒绝原因（包括历史拒绝记录），重新拆解任务，确保解决所有问题：
1. 本次拒绝：${rejectReason}
2. 请同时解决之前 ${rejectionHistory.length} 次拒绝中的所有问题
`;
```

### 5. 修改任务查询接口（`/api/tasks/[taskId]`）

**功能**：
- 返回 `metadata` 字段，包含拒绝历史

**关键代码**：

```typescript
return NextResponse.json({
  success: true,
  data: {
    taskId: task.taskId,
    taskName: task.taskName,
    toAgentId: task.toAgentId,
    fromAgentId: task.fromAgentId,
    executor: task.executor,
    taskStatus: task.status,
    splitStatus: task.splitStatus,
    // 返回 metadata，包含拒绝历史
    metadata: task.metadata || {},
  },
});
```

## 工作流程

### 第一次拒绝

```
1. 用户拒绝拆解
   └─ 输入拒绝原因："拆解不够详细"

2. 后端处理
   └─ 创建拒绝历史：
      [
        {
          reason: "拆解不够详细",
          rejectedAt: "2026-02-13T10:00:00Z",
          rejectedBy: "A",
          rejectionCount: 1
        }
      ]
   └─ totalRejections = 1
   └─ 删除所有子任务

3. 通知 Agent 重新拆解
   └─ 提示词包含：
      - 本次拒绝："拆解不够详细"
      - 历史拒绝：无（第一次）

4. insurance-d 重新拆解
   └─ 每个子任务描述包含：
      - "【重要：历史拒绝反馈】
         此任务之前已经被拒绝 1 次
         拒绝原因：拆解不够详细"
```

### 第二次拒绝

```
1. 用户再次拒绝拆解
   └─ 输入拒绝原因："时间安排不合理"

2. 后端处理
   └─ 更新拒绝历史：
      [
        {
          reason: "拆解不够详细",
          rejectedAt: "2026-02-13T10:00:00Z",
          rejectedBy: "A",
          rejectionCount: 1
        },
        {
          reason: "时间安排不合理",
          rejectedAt: "2026-02-13T11:00:00Z",
          rejectedBy: "A",
          rejectionCount: 2
        }
      ]
   └─ totalRejections = 2
   └─ 删除所有子任务

3. 通知 Agent 重新拆解
   └─ 提示词包含：
      - 本次拒绝："时间安排不合理"
      - 历史拒绝：
        - 第1次："拆解不够详细"
        - 第2次："时间安排不合理"

4. insurance-d 重新拆解
   └─ 每个子任务描述包含：
      - "【重要：历史拒绝反馈】
         此任务之前已经被拒绝 2 次
         --- 第1次拒绝 ---
         拒绝时间：2026-02-13 18:00:00
         拒绝原因：拆解不够详细
         --- 第2次拒绝 ---
         拒绝时间：2026-02-13 19:00:00
         拒绝原因：时间安排不合理
         【关键要求】
         请务必在新的拆解方案中解决以上所有 2 个问题，避免重复犯错！"
```

### 第三次拒绝

```
1. 用户第三次拒绝拆解
   └─ 输入拒绝原因："缺少数据准备步骤"

2. 后端处理
   └─ 更新拒绝历史：
      [
        { reason: "拆解不够详细", rejectionCount: 1 },
        { reason: "时间安排不合理", rejectionCount: 2 },
        {
          reason: "缺少数据准备步骤",
          rejectedAt: "2026-02-13T12:00:00Z",
          rejectedBy: "A",
          rejectionCount: 3
        }
      ]
   └─ totalRejections = 3
   └─ 删除所有子任务

3. 通知 Agent 重新拆解
   └─ 提示词包含：
      - 本次拒绝："缺少数据准备步骤"
      - 历史拒绝：
        - 第1次："拆解不够详细"
        - 第2次："时间安排不合理"
        - 第3次："缺少数据准备步骤"

4. insurance-d 重新拆解
   └─ 每个子任务描述包含：
      - 所有 3 次拒绝的完整历史
      - 要求解决所有问题
```

## 优点

1. ✅ **完整记录**：保存每次拒绝的完整历史
2. ✅ **避免重复犯错**：insurance-d 可以看到所有之前的反馈
3. ✅ **渐进式改进**：每次拆解都能看到之前的问题
4. ✅ **数据清理**：每次拒绝都删除冗余数据
5. ✅ **用户体验好**：可以查看完整的拒绝历史

## 注意事项

1. **拒绝历史存储**：存储在 `metadata` 中，可能会占用较多空间
   - 建议：如果拒绝次数过多（如超过 10 次），可以只保留最近的 5-10 次

2. **提示词长度**：拒绝历史过长可能导致提示词超出限制
   - 建议：如果拒绝历史过长，可以只保留最近的 3-5 次

3. **性能影响**：每次拒绝都需要查询历史记录
   - 建议：可以添加缓存机制

## 后续优化方向

1. **前端展示拒绝历史**：在 UI 中显示完整的拒绝历史
2. **拒绝原因分类**：将拒绝原因分类（如：拆解不够详细、时间不合理、缺少步骤等）
3. **智能提示**：根据拒绝历史自动提示需要解决的重点问题
4. **统计分析**：统计常见的拒绝原因，帮助改进拆解质量
