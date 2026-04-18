# 动态显示拆解执行者修复文档

## 问题描述

前端弹框中写死了 "Agent B 拆解任务"，但实际上系统中有 2 个 agent 可以拆分任务：
- **Agent B**：负责拆解一般任务
- **insurance-d**：负责拆解自己的任务（按照 8 个标准步骤）

## 修复内容

### 1. 修改拆解确认对话框标题

**文件**：`src/app/agents/[id]/page.tsx`

**修改前**：
```tsx
<DialogTitle className="flex items-center gap-2">
  <Info className="w-5 h-5 text-blue-600" />
  是否让 Agent B 拆解为日任务？
</DialogTitle>
```

**修改后**：
```tsx
<DialogTitle className="flex items-center gap-2">
  <Info className="w-5 h-5 text-blue-600" />
  是否让任务拆解为日任务？
</DialogTitle>
```

### 2. 动态显示拆解执行者和目标表

**修改前**：
```tsx
<div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs space-y-1">
  <div className="flex items-center gap-1">
    <span>🤖</span>
    <span><strong>拆解执行者：</strong>Agent B</span>
  </div>
  <div className="flex items-center gap-1">
    <span>📊</span>
    <span><strong>目标表：</strong><code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">daily_tasks</code></span>
  </div>
</div>

<div>
  <strong>建议：</strong>让 Agent B 将任务拆解为可执行的每日子任务，便于跟踪和管理。
</div>
```

**修改后**：
```tsx
{(() => {
  // 判断是否有需要 insurance-d 拆解的任务
  const hasInsuranceDTasks = pendingCommandsForSplit
    .filter(cmd => SPLIT_KEYWORDS.includes(cmd.targetAgentId))
    .some(cmd => cmd.targetAgentId === 'insurance-d' || cmd.targetAgentId === 'D');

  const splitExecutor = hasInsuranceDTasks ? 'insurance-d' : 'Agent B';
  const targetTable = hasInsuranceDTasks ? 'agent_sub_tasks' : 'daily_tasks';

  return (
    <>
      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs space-y-1">
        <div className="flex items-center gap-1">
          <span>🤖</span>
          <span><strong>拆解执行者：</strong>{splitExecutor}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>📊</span>
          <span><strong>目标表：</strong><code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{targetTable}</code></span>
        </div>
      </div>

      <div>
        <strong>建议：</strong>让 {splitExecutor} 将任务拆解为可执行的每日子任务，便于跟踪和管理。
      </div>
    </>
  );
})()}
```

### 3. 修改拒绝原因输入框的提示文本

**修改前**：
```tsx
<p className="text-xs text-gray-500 mt-1">
  提示：详细的反馈能帮助 Agent B 更准确地重新拆解任务
</p>
```

**修改后**：
```tsx
<p className="text-xs text-gray-500 mt-1">
  提示：详细的反馈能帮助 {splitExecutor} 更准确地重新拆解任务
</p>
```

## 逻辑说明

### 判断拆解执行者的逻辑

```typescript
const hasInsuranceDTasks = pendingCommandsForSplit
  .filter(cmd => SPLIT_KEYWORDS.includes(cmd.targetAgentId))
  .some(cmd => cmd.targetAgentId === 'insurance-d' || cmd.targetAgentId === 'D');

const splitExecutor = hasInsuranceDTasks ? 'insurance-d' : 'Agent B';
const targetTable = hasInsuranceDTasks ? 'agent_sub_tasks' : 'daily_tasks';
```

**判断逻辑**：
1. 过滤出需要拆解的任务（`SPLIT_KEYWORDS` 包含：`['B', 'insurance-c', 'insurance-d', 'C', 'D']`）
2. 检查是否有 `insurance-d` 或 `D` 的任务
3. 如果有，则由 `insurance-d` 拆解，目标表为 `agent_sub_tasks`
4. 否则由 `Agent B` 拆解，目标表为 `daily_tasks`

## 修复效果

### 场景 1：包含 insurance-d 任务

**弹框显示**：
- 🤖 拆解执行者：**insurance-d**
- 📊 目标表：**agent_sub_tasks**
- 建议：让 **insurance-d** 将任务拆解为可执行的每日子任务，便于跟踪和管理。

### 场景 2：不包含 insurance-d 任务

**弹框显示**：
- 🤖 拆解执行者：**Agent B**
- 📊 目标表：**daily_tasks**
- 建议：让 **Agent B** 将任务拆解为可执行的每日子任务，便于跟踪和管理。

## 相关文档

- [insurance-d 任务拆解流程文档（修正版）](./insurance-d-task-split-flow-v2.md)
- [Agent B 拆解结果保存修复文档](./agent-b-split-result-save-fix.md)
