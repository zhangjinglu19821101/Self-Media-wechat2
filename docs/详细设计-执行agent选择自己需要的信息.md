# 详细设计：执行 Agent 选择自己需要的信息

## 📋 概述

本文档详细设计了执行 Agent 如何选择和获取前序任务信息的完整方案。

---

## 🎯 业务背景

### **问题**
- order_index=2 的合规校验任务找不到 order_index=1 撰写的文章初稿
- 前序任务结果传递链路断裂

### **目标**
- 建立清晰的前序任务结果传递机制
- 让执行 Agent 能够准确获取需要的信息

---

## 📊 业务规则

### 1. **前置任务清单的构成**

```
前置清单 = agent_sub_tasks 表的行（order_index = 当前）
         ↓
    每个指令一行
         ↓
    【步骤 1：撰写文章初稿】
    指令的结果文本
```

**关键点：** order_index **等于** 当前（不是小于）

---

### 2. **表关系结构**

```
┌─────────────────────────────────────────────────────────┐
│  agent_sub_tasks 表（主表）            │
│  每一行 = 一个指令（主要前置项）           │
└─────────────────────────────────────────────────────────┘
         ↓ 一对多
         ↓
┌─────────────────────────────────────────────────────────┐
│  agent_sub_tasks_mcp_executions 表（明细表）│
│  每一行 = 一次 MCP 工具执行（指令的细节）     │
│  - command_result_id: 关联 agent_sub_tasks.id  │
└─────────────────────────────────────────────────────────┘
```

**注意：** 不需要加 `task_id` 字段，`command_result_id` 已够用。

---

## 🏗️ 数据库设计

### 1. **字段变更方案**

| 操作 | 字段名 | 类型 | 说明 |
|------|--------|------|------|
| ✅ **新增** | `result_data` | JSONB | 原始结构化结果数据 |
| ✅ **新增** | `result_text` | TEXT | 文本化结果（供 Agent 使用） |
| ✅ **删除** | `execution_result` | TEXT | 原字段，不再使用 |

---

### 2. **Migration SQL**

```sql
-- 1. 新增 result_data 字段（JSONB 格式，存结构化数据）
ALTER TABLE agent_sub_tasks 
ADD COLUMN IF NOT EXISTS result_data JSONB;

-- 2. 新增 result_text 字段（TEXT 格式，存文本化结果）
ALTER TABLE agent_sub_tasks 
ADD COLUMN IF NOT EXISTS result_text TEXT;

-- 3. 数据迁移：把 existing execution_result 同步到新字段
UPDATE agent_sub_tasks 
SET 
  result_data = execution_result::JSONB,
  result_text = (execution_result::JSONB)->>'result'
WHERE execution_result IS NOT NULL;

-- 4. 删除旧字段 execution_result
ALTER TABLE agent_sub_tasks 
DROP COLUMN IF EXISTS execution_result;
```

---

### 3. **数据结构确认**

根据实际数据调查，`execution_result` 的结构如下：

```typescript
{
  "result": "文章内容在这里！",                    // 路径 1
  "structuredResult": {
    "resultContent": "文章内容也在这里！"         // 路径 2
  }
}
```

**文章在两个路径都有！** 数据迁移时使用 `result` 路径。

---

## 💻 代码实现

### 1. **Schema 更新**

```typescript
export const agentSubTasks = pgTable('agent_sub_tasks', {
  // ... 其他字段保持不变 ...
  
  // 新增字段
  resultData: jsonb('result_data'),
  resultText: text('result_text'),
  
  // 删除旧字段
  // executionResult: text('execution_result'),  ← 删掉
  
  // ... 其他字段保持不变 ...
});
```

---

### 2. **删除重复代码**

**删除：** `generateResultTextFromExecutionResult()` 方法  
**替代：** 完全复用 `McpResultTextGenerator`

---

### 3. **修改 `getPreviousStepResult()` 方法**

**之前的错误代码：**
```typescript
const taskResultText = task.resultText || 
                     this.generateResultTextFromExecutionResult(task.executionResult);
```

**修改后：**
```typescript
const taskResultText = await this.getTextFromTask(task);
```

---

### 4. **新增 `getTextFromTask()` 方法**

```typescript
private async getTextFromTask(task: typeof agentSubTasks.$inferSelect): Promise<string> {
  // 优先级 1：如果有 result_text，直接用
  if (task.resultText) {
    return task.resultText;
  }
  
  // 优先级 2：如果有 result_data，用 McpResultTextGenerator 生成
  if (task.resultData) {
    return await this.generateTextWithMcpGenerator(task.resultData);
  }
  
  // 兜底：空字符串
  return '';
}
```

---

### 5. **任务完成时保存结果**

在任务完成时（如 `markSubTaskCompleted` 方法）：

```typescript
// 1. 保存结构化结果到 result_data
// 2. 调用 McpResultTextGenerator 生成文本
// 3. 保存文本化结果到 result_text

// 条件调用逻辑：
if (resultData 存在) {
  const text = await mcpResultTextGenerator.generate({...});
  // 保存到 result_text
}
```

---

### 6. **Async 改造**

以下方法需要改为 `async`：
- `generateCuratedListFormat()` → `async`
- `getPreviousStepResult()` → `async`
- 调用链路都加上 `await`

---

## 📋 实施清单

### **第一步：数据库**
- [ ] 编写 Migration SQL
- [ ] 执行 Migration
- [ ] 验证数据迁移

### **第二步：代码**
- [ ] 更新 Schema 定义
- [ ] 删除 `generateResultTextFromExecutionResult()`
- [ ] 新增 `getTextFromTask()` 方法
- [ ] 修改 `getPreviousStepResult()`
- [ ] 修改任务完成逻辑
- [ ] Async 改造

### **第三步：测试**
- [ ] 测试 order_index=2 能取到文章
- [ ] 验证整个流程正常

---

## 🔗 相关文件

- `src/lib/db/migrations/XXXX_new_fields.sql`
- `src/lib/db/schema.ts`
- `src/lib/services/subtask-execution-engine.ts`

---

## 📝 总结

### **核心要点**
1. ✅ 前置任务：order_index **=** 当前
2. ✅ 字段方案：`result_data`（JSON）+ `result_text`（文本）
3. ✅ 复用组件：`McpResultTextGenerator`
4. ✅ 删除重复：`generateResultTextFromExecutionResult()`

### **数据路径**
- 文章在 `result` 和 `structuredResult.resultContent` 都有
- 迁移时使用 `result` 路径

---

**设计完成，可以开始实施！**
