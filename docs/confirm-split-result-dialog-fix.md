# 确认拆解方案弹框修复文档

## 问题描述

在确认拆解方案弹框中，拆解执行者硬编码显示为 "Agent B"，但实际拆解执行者可能是 insurance-d 或 insurance-c。

## 根本原因

1. **导入问题**：`page.tsx` 直接导入了 `save-split-result-v2.ts` 中的 `mapExecutorId` 函数，但该文件包含了 Node.js 特定的模块（如 `postgres`），无法在浏览器环境中运行
2. **逻辑问题**：设置 `splitExecutor` 的逻辑是根据 `fromAgentId` 来判断的，而不是从拆解结果中获取实际的 executor

## 解决方案

### 1. 创建独立的工具文件

**文件**：`src/lib/utils/agent-mapper.ts`

将 `mapExecutorId` 函数提取到一个纯工具文件中，不依赖任何 Node.js 特定的模块：

```typescript
/**
 * 映射 executor ID
 * @param executor - 原始 executor ID（可能是简写或完整ID）
 * @returns 映射后的完整 executor ID
 */
export function mapExecutorId(executor: string): string {
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

### 2. 修改 page.tsx 导入语句

**文件**：`src/app/agents/[id]/page.tsx`

```typescript
// 修改前
import { mapExecutorId } from '@/lib/services/save-split-result-v2';

// 修改后
import { mapExecutorId } from '@/lib/utils/agent-mapper';
```

### 3. 修改 splitExecutor 设置逻辑

修改三处设置 `splitExecutor` 的地方，从拆解结果中获取实际的 executor：

**位置 1**：处理任务结果时（第 555 行左右）

```typescript
// 修改前
setSplitExecutor(taskResult.fromAgentId === 'B' ? 'Agent B' : taskResult.fromAgentId || 'Agent B');

// 修改后
const firstExecutor = jsonData.subTasks[0]?.executor;
const mappedExecutor = mapExecutorId(firstExecutor);
const displayExecutor = mappedExecutor === 'insurance-d' ? 'insurance-d' :
                       mappedExecutor === 'insurance-c' ? 'insurance-c' :
                       'Agent B';
setSplitExecutor(displayExecutor);
```

**位置 2**：处理历史通知时（第 687 行左右）

```typescript
// 修改前
setSplitExecutor(notification.fromAgentId === 'B' ? 'Agent B' : notification.fromAgentId || 'Agent B');

// 修改后
const firstExecutor = jsonData.subTasks[0]?.executor;
const mappedExecutor = mapExecutorId(firstExecutor);
const displayExecutor = mappedExecutor === 'insurance-d' ? 'insurance-d' :
                       mappedExecutor === 'insurance-c' ? 'insurance-c' :
                       'Agent B';
setSplitExecutor(displayExecutor);
```

**位置 3**：查询拆解结果时（第 1915 行左右）

```typescript
// 修改前
setSplitExecutor(latestResult.fromAgentId === 'B' ? 'Agent B' : latestResult.fromAgentId || 'Agent B');

// 修改后
const firstExecutor = jsonData.subTasks[0]?.executor;
const mappedExecutor = mapExecutorId(firstExecutor);
const displayExecutor = mappedExecutor === 'insurance-d' ? 'insurance-d' :
                       mappedExecutor === 'insurance-c' ? 'insurance-c' :
                       'Agent B';
setSplitExecutor(displayExecutor);
```

### 4. 动态显示目标表

**文件**：`src/app/agents/[id]/page.tsx`（第 2366 行）

```typescript
// 修改前
<span>确认后，拆解结果将保存到 <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">daily_tasks</code> 表</span>

// 修改后
<span>确认后，拆解结果将保存到 <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{splitExecutor === 'insurance-d' ? 'agent_sub_tasks' : 'daily_tasks'}</code> 表</span>
```

### 5. 修改 save-split-result-v2.ts 导入语句

**文件**：`src/lib/services/save-split-result-v2.ts`

```typescript
// 修改前
// 在文件开头定义 mapExecutorId 函数
// 然后导入 postgres

// 修改后
import postgres from 'postgres';
import { mapExecutorId } from '@/lib/utils/agent-mapper';
```

## 修复效果

### 场景 1：insurance-d 拆解

**弹框显示**：
- 拆解执行者：**insurance-d**
- 目标表：**agent_sub_tasks**

### 场景 2：insurance-c 拆解

**弹框显示**：
- 拆解执行者：**insurance-c**
- 目标表：**daily_tasks**

### 场景 3：Agent B 拆解

**弹框显示**：
- 拆解执行者：**Agent B**
- 目标表：**daily_tasks**

## 相关文档

- [拆解结果保存修复文档](./agent-b-split-result-save-fix.md)
- [动态显示拆解执行者修复文档（拆解确认对话框）](./dynamic-split-executor-display-fix.md)
