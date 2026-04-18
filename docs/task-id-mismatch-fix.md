# 任务 ID 不匹配问题修复

## 问题描述

### 现象
- 任务 `task-A-B-split-1770923183020` 被拒绝时，后端报错："任务不存在"
- 日志显示：`⚠️ 记录拒绝历史失败: 任务不存在`

### 根本原因
前端和后端的任务 ID 不一致：

1. **前端生成临时任务 ID**：`task-A-B-split-1770923183020`
2. **前端调用 `/api/tasks` 创建任务**，传递了这个临时任务 ID
3. **后端忽略传递的 ID**，重新生成新的任务 ID：`task-A-to-B-1770923181429-hxh`
4. **前端继续使用临时任务 ID** 发送给 Agent B
5. **Agent B 使用临时任务 ID** 返回拆解结果
6. **用户拒绝时，前端使用临时任务 ID** 调用拒绝 API
7. **后端查找临时任务 ID**，找不到（因为数据库中的实际任务是另一个 ID）

### 问题流程图
```
前端: 生成 taskId = task-A-B-split-1770923183020
  ↓
前端: POST /api/tasks (taskId: task-A-B-split-1770923183020)
  ↓
后端: 忽略 taskId，重新生成 task-A-to-B-1770923181429-hxh
  ↓
后端: 返回实际 taskId = task-A-to-B-1770923181429-hxh
  ↓
前端: 忽略返回的 taskId，继续使用 task-A-B-split-1770923183020
  ↓
前端: 发送拆解指令给 Agent B (taskId: task-A-B-split-1770923183020)
  ↓
Agent B: 返回拆解结果 (taskId: task-A-B-split-1770923183020)
  ↓
前端: 用户拒绝，调用拒绝 API (taskId: task-A-B-split-1770923183020)
  ↓
后端: 查找任务 task-A-B-split-1770923183020 → 不存在 ❌
```

## 解决方案

### 修改 1：使用后端返回的实际任务 ID

**文件**: `src/app/agents/[id]/page.tsx`

**问题代码**：
```typescript
// 前端生成临时任务 ID
const taskId = `task-A-B-split-${Date.now()}`;

// 调用 API 时传递临时任务 ID
const createResponse = await fetch('/api/tasks', {
  body: JSON.stringify({
    taskId, // ❌ 传递临时任务 ID，但后端会忽略
    ...
  }),
});

// 继续使用临时任务 ID
const result = await sendCommandToAgent(
  'B',
  splitTaskCommand.commandContent,
  splitTaskCommand.commandType,
  splitTaskCommand.priority,
  'A',
  taskId // ❌ 使用临时任务 ID
);
```

**修复后代码**：
```typescript
// 不再生成临时任务 ID
let actualTaskId = '';

// 调用 API，不传递 taskId，让后端生成
const createResponse = await fetch('/api/tasks', {
  body: JSON.stringify({
    // 不传递 taskId
    taskName: `任务拆解：${lastAssistantContent.substring(0, 50)}...`,
    ...
  }),
});

// 使用后端返回的实际任务 ID
if (createResponse.ok) {
  const createResult = await createResponse.json();
  actualTaskId = createResult.data.taskId; // ✅ 使用后端返回的实际任务 ID
}

// 发送指令时使用实际任务 ID
const result = await sendCommandToAgent(
  'B',
  splitTaskCommand.commandContent,
  splitTaskCommand.commandType,
  splitTaskCommand.priority,
  'A',
  actualTaskId // ✅ 使用实际任务 ID
);
```

### 修改 2：保存和使用当前任务的 taskId

**问题**：Agent B 在发送任务结果时，从 `wsStatus.lastMessage` 中读取 `taskId`，但 `lastMessage` 可能已经被其他消息更新。

**解决方案**：添加 `currentTaskId` 状态变量，在收到新指令时自动保存 `taskId`。

**文件**: `src/app/agents/[id]/page.tsx`

**添加状态变量**：
```typescript
const [currentTaskId, setCurrentTaskId] = useState('');
```

**添加监听新指令的 useEffect**：
```typescript
// 🔥 保存当前任务的 taskId（用于发送任务结果时使用）
useEffect(() => {
  if (wsStatus.lastMessage?.type === 'new_command' && wsStatus.lastMessage.taskId) {
    console.log(`📋 保存当前任务的 taskId: ${wsStatus.lastMessage.taskId}`);
    setCurrentTaskId(wsStatus.lastMessage.taskId);
  }
}, [wsStatus.lastMessage]);
```

**修改发送任务结果的代码**：
```typescript
// 🔥 发送 task_result 通知给 Agent A
try {
  // 🔥 使用保存的 currentTaskId（而不是从 wsStatus.lastMessage 中读取）
  // 因为 wsStatus.lastMessage 可能已经被其他消息更新了
  const taskId = currentTaskId || `task-A-B-split-${Date.now()}`;
  
  console.log(`📋 准备发送拆解结果通知，taskId=${taskId}`);
  console.log(`📋 currentTaskId=${currentTaskId}`);
  
  // ...
  const notificationResponse = await fetch('/api/agents/A/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'task_result',
      fromAgentId: 'B',
      toAgentId: 'A',
      message: 'Agent B 已完成任务拆解',
      taskId, // ✅ 使用 currentTaskId
      result: JSON.stringify(splitResult),
      ...
    }),
  });
```

## 修复后的流程

```
前端: 不生成临时任务 ID
  ↓
前端: POST /api/tasks (不传递 taskId)
  ↓
后端: 生成实际 taskId = task-A-to-B-1770923181429-hxh
  ↓
后端: 返回实际 taskId = task-A-to-B-1770923181429-hxh
  ↓
前端: 保存实际 taskId 到 actualTaskId
  ↓
前端: 发送拆解指令给 Agent B (taskId: task-A-to-B-1770923181429-hxh)
  ↓
Agent B: 收到指令，保存 taskId 到 currentTaskId
  ↓
Agent B: 返回拆解结果 (taskId: task-A-to-B-1770923181429-hxh)
  ↓
前端: 用户拒绝，调用拒绝 API (taskId: task-A-to-B-1770923181429-hxh)
  ↓
后端: 查找任务 task-A-to-B-1770923181429-hxh → 找到 ✅
  ↓
后端: 记录拒绝历史成功 ✅
```

## 验证方法

1. **创建新的拆解任务**，观察前端日志：
   - 应该看到："✅ 拆解任务已创建: task-A-to-B-{timestamp}-{random}"
   - 不应该看到前端的临时任务 ID

2. **Agent B 完成拆解后**，观察前端日志：
   - 应该看到："📋 保存当前任务的 taskId: task-A-to-B-{timestamp}-{random}"
   - 应该看到："📋 准备发送拆解结果通知，taskId=task-A-to-B-{timestamp}-{random}"

3. **拒绝拆解结果**，观察前端日志：
   - 应该看到："📝 调用后端 API 记录拒绝历史: task-A-to-B-{timestamp}-{random}"
   - 应该看到："✅ 拒绝历史已记录"
   - **不应该**看到："⚠️ 记录拒绝历史失败: 任务不存在"

## 相关文件

- `src/app/agents/[id]/page.tsx` - Agent 页面（任务拆解、拒绝流程）
- `src/app/api/tasks/route.ts` - 任务创建 API
- `src/app/api/commands/reject/route.ts` - 拒绝记录 API

## 影响范围

- ✅ 任务拆解流程（Agent A → Agent B）
- ✅ 拆解结果拒绝流程
- ✅ 拒绝历史记录功能

## 后续优化建议

1. **统一任务 ID 生成策略**：考虑在前端统一使用后端返回的任务 ID，避免前端生成临时 ID

2. **添加任务 ID 类型验证**：在 API 层添加任务 ID 格式验证，确保传递的 ID 符合预期格式

3. **完善日志和错误提示**：在拒绝 API 中，当任务不存在时，返回更详细的错误信息，包括可能的正确任务 ID

4. **添加单元测试**：为任务 ID 传递流程添加单元测试，确保前后端 ID 一致性
