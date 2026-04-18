# 拆解拒绝数据处理方案

## 推荐方案：删除 + 保存摘要

### 核心思路

拒绝拆解时：
1. 获取当前拆解结果的摘要信息
2. 删除详细的子任务数据
3. 在任务 metadata 中保存摘要
4. 更新任务状态

### 实现步骤

#### 1. 修改拒绝接口

```typescript
// src/app/api/commands/reject/route.ts

import { db } from '@/lib/db';
import { agentTasks, dailyTasks } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { TaskManager } from '@/lib/services/task-manager';

/**
 * POST /api/commands/reject - Agent A 拒绝拆解
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, taskId, rejectionReason } = body;

    // 1. 验证任务
    const task = await TaskManager.getTask(taskId);
    if (!task) {
      return NextResponse.json(
        { success: false, error: '任务不存在' },
        { status: 404 }
      );
    }

    // 2. 🔥 新增：获取当前拆解结果的摘要
    const currentSubTasks = await db
      .select()
      .from(dailyTasks)
      .where(eq(dailyTasks.relatedTaskId, taskId));

    const splitSummary = {
      subTaskCount: currentSubTasks.length,
      executors: [...new Set(currentSubTasks.map(t => t.executor))],
      taskTypes: [...new Set(currentSubTasks.map(t => t.taskType))],
      executionDateRange: {
        start: currentSubTasks.reduce((min, t) =>
          t.executionDate < min ? t.executionDate : min,
          currentSubTasks[0]?.executionDate || ''
        ),
        end: currentSubTasks.reduce((max, t) =>
          t.executionDate > max ? t.executionDate : max,
          currentSubTasks[0]?.executionDate || ''
        ),
      },
      rejectedAt: new Date().toISOString(),
    };

    console.log(`📊 拆解结果摘要:`, splitSummary);

    // 3. 🔥 新增：删除所有关联的子任务
    await db
      .delete(dailyTasks)
      .where(eq(dailyTasks.relatedTaskId, taskId));

    console.log(`✅ 已删除 ${splitSummary.subTaskCount} 条子任务`);

    // 4. 更新任务状态
    await TaskManager.updateTaskSplitStatus(taskId, 'split_rejected', {
      metadata: {
        ...task.metadata,
        rejectionReason,
        rejectedAt: new Date().toISOString(),
        rejectedBy: agentId,
        // 🔥 新增：保存拆解摘要
        previousSplitSummary: splitSummary,
      },
    });

    console.log(`✅ 任务拆解已拒绝: taskId=${taskId}, reason=${rejectionReason}`);

    return NextResponse.json({
      success: true,
      message: '任务拆解已拒绝',
      data: {
        taskId,
        rejectionReason,
        deletedCount: splitSummary.subTaskCount,  // 🔥 新增：返回删除数量
      },
    });
  } catch (error: any) {
    console.error('❌ 拒绝拆解失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '拒绝失败' },
      { status: 500 }
    );
  }
}
```

#### 2. 重新拆解时提供历史摘要

```typescript
// src/app/api/agents/tasks/[taskId]/split/route.ts

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;

    // 1. 获取任务信息
    const task = await TaskManager.getTask(taskId);

    // 2. 🔥 新增：如果是重新拆解，提供历史摘要作为参考
    const isResplit = task.splitStatus === 'split_rejected';
    const previousSummary = task.metadata?.previousSplitSummary || null;

    if (isResplit && previousSummary) {
      console.log(`📋 重新拆解任务，提供历史摘要:`, previousSummary);

      // 可以在 Agent 的提示词中包含这些信息
      const contextPrompt = `
【历史拆解参考】
你之前尝试过拆解此任务，但被拒绝了。以下是之前的拆解摘要：

- 子任务数量：${previousSummary.subTaskCount}
- 执行者：${previousSummary.executors.join(', ')}
- 任务类型：${previousSummary.taskTypes.join(', ')}
- 执行时间：${previousSummary.executionDateRange.start} 至 ${previousSummary.executionDateRange.end}

请在重新拆解时参考这些信息，并根据拒绝原因进行调整。
`;
    }

    // 3. 调用 Agent 拆解...
  }
}
```

#### 3. 前端显示历史信息

```typescript
// src/app/agents/[id]/page.tsx

// 在拆解结果确认对话框中显示历史信息
{task.metadata?.previousSplitSummary && (
  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
    <h4 className="font-medium text-yellow-800 mb-2">
      ⚠️ 这是重新拆解的结果
    </h4>
    <div className="text-sm text-yellow-700">
      <p>之前的拆解被拒绝：</p>
      <ul className="list-disc ml-5 mt-1">
        <li>子任务数量：{task.metadata.previousSplitSummary.subTaskCount}</li>
        <li>执行者：{task.metadata.previousSplitSummary.executors.join(', ')}</li>
        <li>拒绝时间：{new Date(task.metadata.previousSplitSummary.rejectedAt).toLocaleString()}</li>
      </ul>
    </div>
  </div>
)}
```

### 优点

1. ✅ **数据清理彻底**：删除冗余的子任务数据
2. ✅ **保留关键信息**：子任务数量、执行者、时间范围
3. ✅ **实现简单**：不需要额外表
4. ✅ **性能好**：主表数据量小
5. ✅ **用户体验好**：可以看到之前的拆解摘要

### 数据库影响

- 删除所有关联的 `dailyTasks` 记录
- 在 `agentTasks.metadata` 中增加约 200-500 字节的摘要信息
- 总体减少数据量（删除详细数据，只保留摘要）

### 迁移建议

如果已有数据包含 `split_rejected` 状态的任务，可以：

```sql
-- 1. 备份数据（可选）
CREATE TABLE backup_daily_tasks AS SELECT * FROM daily_tasks WHERE relatedTaskId IN (
  SELECT taskId FROM agentTasks WHERE splitStatus = 'split_rejected'
);

-- 2. 生成摘要并更新 metadata
UPDATE agentTasks
SET metadata = metadata || jsonb_build_object(
  'previousSplitSummary',
  (
    SELECT jsonb_build_object(
      'subTaskCount', COUNT(*),
      'executors', jsonb_agg(DISTINCT executor),
      'taskTypes', jsonb_agg(DISTINCT taskType),
      'rejectedAt', NOW()
    )
    FROM daily_tasks
    WHERE dailyTasks.relatedTaskId = agentTasks.taskId
  )
)
WHERE splitStatus = 'split_rejected';

-- 3. 删除子任务
DELETE FROM daily_tasks
WHERE relatedTaskId IN (
  SELECT taskId FROM agentTasks WHERE splitStatus = 'split_rejected'
);
```

### 后续优化方向

如果需要更详细的历史记录，可以：

1. **升级到方案1（归档表）**：创建 `split_history` 表
2. **升级到方案3（版本管理）**：添加版本号字段
3. **增加可视化**：在前端展示拆解历史对比
