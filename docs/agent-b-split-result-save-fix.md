# Agent B 拆解结果保存到 daily_task 表修复文档

## 问题描述

任务 `task-A-to-B-1770925001079-f2g` 在 `agent_tasks` 表中有记录，但 `daily_task` 和 `agent_sub_tasks` 表中均无记录，导致任务流转中断。

## 根本原因分析

### 问题 1：Executor ID 映射错误

**原因**：
- Agent B 拆解任务后，LLM 返回的 `executor` 值是 `'D'`，而不是 `'insurance-d'`
- `save-split-result-v2.ts` 直接使用 LLM 返回的 `executor` 值，没有将其映射到正确的 agent ID
- 导致 `daily_task` 表中 `executor` 和 `to_agent_id` 字段为 `'D'`，而不是 `'insurance-d'`

**影响**：
- insurance-d 没有被正确识别
- 没有触发 insurance-d 的子任务拆解
- 任务流转中断

### 问题 2：缺少子任务拆解触发机制

**原因**：
- insurance-d 没有自动触发子任务拆解的逻辑
- 需要手动调用 `/api/agents/insurance-d/split-task` API 才能触发拆解

**影响**：
- `agent_sub_tasks` 表中没有记录
- 任务无法执行

## 修复方案

### 修复 1：添加 Executor ID 映射函数

**文件**：`src/lib/services/save-split-result-v2.ts`

**修改内容**：
1. 添加 `mapExecutorId` 函数，将简写的 agent ID 转换为完整的 agent ID
2. 在保存 `daily_task` 记录时使用映射后的 `executorId`

**代码**：
```typescript
/**
 * Agent ID 映射函数
 * 将简写的 agent ID 转换为完整的 agent ID
 */
function mapExecutorId(executor: string): string {
  const executorMap: Record<string, string> = {
    'A': 'insurance-a',
    'B': 'insurance-b',
    'C': 'insurance-c',
    'D': 'insurance-d',
    'insurance-a': 'insurance-a',
    'insurance-b': 'insurance-b',
    'insurance-c': 'insurance-c',
    'insurance-d': 'insurance-d',
    'agent-b': 'agent-b',
  };
  return executorMap[executor] || executor;
}
```

**使用**：
```typescript
const executorId = mapExecutorId(subTask.executor); // 🔥 映射 agent ID
```

### 修复 2：手动触发 Insurance-d 子任务拆解

**操作**：
1. 更新现有的 `daily_task` 记录，将 `executor` 和 `to_agent_id` 从 `'D'` 改为 `'insurance-d'`
2. 手动调用 `/api/agents/insurance-d/split-task` API，拆分所有未拆分的任务

**SQL**：
```sql
-- 更新 executor 和 to_agent_id
UPDATE daily_task
SET executor = 'insurance-d', to_agent_id = 'insurance-d'
WHERE executor = 'D' AND to_agent_id = 'D';

-- 查询需要拆分的任务
SELECT id::text as id_text, task_id, task_title, executor
FROM daily_task
WHERE executor = 'insurance-d' AND sub_task_count = 0;
```

**API 调用**：
```bash
curl -X POST http://localhost:5000/api/agents/insurance-d/split-task \
  -H "Content-Type: application/json" \
  -d '{"commandResultId": "0f933ef5-5a62-4d12-9e29-1ca65c1d48ca"}'
```

## 修复结果

### 任务流转链路验证

**查询**：
```sql
SELECT
  at.task_id as agent_task_task_id,
  at.to_agent_id as agent_task_to_agent,
  dt.task_id as daily_task_task_id,
  dt.executor as daily_task_executor,
  dt.sub_task_count as daily_task_sub_task_count,
  COUNT(ast.id) as agent_sub_task_count
FROM agent_tasks at
LEFT JOIN daily_task dt ON dt.related_task_id = at.task_id
LEFT JOIN agent_sub_tasks ast ON ast.command_result_id = dt.id
WHERE at.task_id = 'task-A-to-B-1770925001079-f2g'
GROUP BY at.id, dt.id, dt.sub_task_count;
```

**结果**：
| agent_task_task_id | agent_task_to_agent | daily_task_task_id | daily_task_executor | daily_task_sub_task_count | agent_sub_task_count |
|---------------------|---------------------|---------------------|---------------------|----------------------------|----------------------|
| task-A-to-B-1770925001079-f2g | agent B | daily-task-D-2026-02-13-001 | insurance-d | 5 | 5 |
| task-A-to-B-1770925001079-f2g | agent B | daily-task-D-2026-02-14-002 | insurance-d | 5 | 5 |

### 子任务详细信息

**查询**：
```sql
SELECT
  dt.task_id as daily_task_task_id,
  dt.task_title as daily_task_title,
  ast.task_title as sub_task_title,
  ast.agent_id as sub_task_executor,
  ast.status as sub_task_status,
  ast.order_index as sub_task_order
FROM daily_task dt
JOIN agent_sub_tasks ast ON ast.command_result_id = dt.id
WHERE dt.related_task_id = 'task-A-to-B-1770925001079-f2g'
ORDER BY dt.task_id, ast.order_index;
```

**结果**：
- **daily-task-D-2026-02-13-001**（第1天：测试任务）
  1. 明确测试任务核心需求 - insurance-d - in_progress
  2. 生成测试用内容初稿 - insurance-a - pending
  3. 合规性与适配性校验 - insurance-b - pending
  4. 优化测试内容并最终定稿 - insurance-a - pending
  5. 测试任务复盘与总结 - insurance-d - pending

- **daily-task-D-2026-02-14-002**（第2天：测试任务）
  1. 明确测试任务核心需求 - insurance-d - in_progress
  2. 生成测试用科普文章初稿 - insurance-a - pending
  3. 完成文章合规性校验 - insurance-b - pending
  4. 适配中老年阅读的优化调整 - insurance-a - pending
  5. 测试任务结果复盘总结 - insurance-d - pending

## 总结

### 修复内容
1. ✅ 添加 Executor ID 映射函数，将简写的 agent ID 转换为完整的 agent ID
2. ✅ 更新现有的 `daily_task` 记录，将 `executor` 和 `to_agent_id` 从 `'D'` 改为 `'insurance-d'`
3. ✅ 手动触发 insurance-d 子任务拆解，创建 10 条 `agent_sub_tasks` 记录
4. ✅ 更新 `daily_task` 表的 `sub_task_count` 字段

### 任务流转链路
- ✅ `agent_tasks` 表：1 条记录
- ✅ `daily_task` 表：2 条记录，每条记录 `sub_task_count = 5`
- ✅ `agent_sub_tasks` 表：10 条记录，每个 `daily_task` 对应 5 条 `agent_sub_tasks` 记录

### 后续优化建议
1. **自动触发子任务拆解**：在 `/api/agents/send-command` API 中，当发送指令给 insurance-d 时，自动调用 `/api/agents/insurance-d/split-task` API
2. **定时任务**：创建定时任务，定期检查并拆分 insurance-d 的未拆分任务
3. **前端触发**：在 insurance-d 的页面加载时，自动检查并拆分未拆分的任务

## 相关文档
- [任务 ID 不匹配修复文档](./task-id-mismatch-fix.md)
- [累积拒绝原因功能实现文档](./cumulative-rejection-history.md)
- [insurance-d 任务拆解流程文档（修正版）](./insurance-d-task-split-flow-v2.md)
