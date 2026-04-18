# 实施条件检查报告（修正版）

## 检查日期
2025-01-01

## 检查结果

### ✅ 基本具备实施条件，但需要补充少量字段和创建新表

---

## 现有表结构分析

### ✅ 已存在的表

#### 1. `commandResults` 表（✅ 存在）
**位置**：`src/lib/db/schema.ts` 第 266 行

**现有字段**：
- ✅ `id`, `commandId`, `relatedTaskId`, `commandContent`, `executor`
- ✅ `executionStatus`（'new' | 'in_progress' | 'completed' | 'feedback_completed' | 'helping_tech_expert' | 'helping_president' | 'failed'）
- ✅ `questionStatus`（'none' | 'pending' | 'resolved'）
- ✅ `subTaskCount`, `completedSubTasks`, `completedSubTasksDescription`
- ✅ `createdAt`, `updatedAt`, `lastCheckedAt`, `lastInspectedAt`
- ✅ `helpRecord`

**缺失字段**：
- ❌ `dialogueSessionId`（对话会话 ID）
- ❌ `dialogueRounds`（对话轮数）
- ❌ `dialogueStatus`（对话状态：'none' | 'in_progress' | 'completed' | 'timeout'）
- ❌ `lastDialogueAt`（最后对话时间）

---

#### 2. `agentSubTasks` 表（✅ 存在）
**位置**：`src/lib/db/schema.ts` 第 393 行

**现有字段**：
- ✅ `id`, `commandResultId`（外键关联 commandResults）
- ✅ `agentId`, `taskTitle`, `taskDescription`
- ✅ `status`（'pending' | 'in_progress' | 'completed' | 'blocked'）
- ✅ `orderIndex`, `startedAt`, `completedAt`
- ✅ `createdAt`, `updatedAt`, `metadata`

**缺失字段**：
- ❌ `dialogueSessionId`（对话会话 ID）
- ❌ `dialogueRounds`（对话轮数）
- ❌ `dialogueStatus`（对话状态：'none' | 'in_progress' | 'completed' | 'timeout'）
- ❌ `lastDialogueAt`（最后对话时间）

---

#### 3. `agentInteractions` 表（✅ 存在，可替代 agentDialogues）
**位置**：`src/lib/db/schema.ts` 第 424 行

**现有字段**：
- ✅ `id`, `commandResultId`（外键关联 commandResults）
- ✅ `sessionId`, `sender`, `receiver`
- ✅ `message`, `roundNumber`, `createdAt`

**缺失字段**：
- ❌ `isUnderstand`（是否理解：true/false）

**说明**：`agentInteractions` 表可以替代设计文档中的 `agentDialogues` 表，只需要添加 `isUnderstand` 字段即可。

---

#### 4. `agentTasks` 表（✅ 存在，作为总任务表）
**位置**：`src/lib/db/schema.ts` 第 135 行

**说明**：这是总任务表，与 `commandResults` 表是不同的概念，不需要修改。

---

### ❌ 不存在的表

#### 5. `agentReports` 表（❌ 不存在）
**需要创建**：用于存储上报给 Agent A 的报告

**字段**：
- `id`（主键）
- `reportType`（报告类型：'subtask_timeout' | 'task_timeout'）
- `commandResultId`（关联的指令 ID）
- `subTaskId`（关联的子任务 ID，可选）
- `summary`（总结信息）
- `conclusion`（结论）
- `dialogueProcess`（对话过程信息，JSONB）
- `reportedTo`（上报对象：'agent_a'）
- `reportedFrom`（上报人：'agent_b'）
- `createdAt`（创建时间）

---

## 需要补充的工作

### P0（必须完成，工作量约 1-2 小时）

#### 1. 为 `commandResults` 表添加对话相关字段

```sql
ALTER TABLE command_results
ADD COLUMN dialogue_session_id VARCHAR(100),
ADD COLUMN dialogue_rounds INTEGER DEFAULT 0,
ADD COLUMN dialogue_status VARCHAR(50) DEFAULT 'none',
ADD COLUMN last_dialogue_at TIMESTAMP;
```

#### 2. 为 `agentSubTasks` 表添加对话相关字段

```sql
ALTER TABLE agent_sub_tasks
ADD COLUMN dialogue_session_id VARCHAR(100),
ADD COLUMN dialogue_rounds INTEGER DEFAULT 0,
ADD COLUMN dialogue_status VARCHAR(50) DEFAULT 'none',
ADD COLUMN last_dialogue_at TIMESTAMP;
```

#### 3. 为 `agentInteractions` 表添加 `isUnderstand` 字段

```sql
ALTER TABLE agent_interactions
ADD COLUMN is_understand BOOLEAN DEFAULT FALSE;
```

#### 4. 创建 `agentReports` 表

```sql
CREATE TABLE agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type VARCHAR(50) NOT NULL,
  command_result_id UUID NOT NULL REFERENCES command_results(id) ON DELETE CASCADE,
  sub_task_id UUID REFERENCES agent_sub_tasks(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  dialogue_process JSONB NOT NULL,
  reported_to VARCHAR(50) NOT NULL,
  reported_from VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_reports_type ON agent_reports(report_type);
CREATE INDEX idx_agent_reports_command_result_id ON agent_reports(command_result_id);
CREATE INDEX idx_agent_reports_created_at ON agent_reports(created_at);
```

#### 5. 更新 Drizzle ORM Schema

```typescript
// src/lib/db/schema.ts

// 修改 commandResults 表定义，添加对话相关字段
export const commandResults = pgTable('command_results', {
  // ... 现有字段 ...

  // === 对话相关字段 ===
  dialogueSessionId: text('dialogue_session_id'),
  dialogueRounds: integer('dialogue_rounds').notNull().default(0),
  dialogueStatus: text('dialogue_status').notNull().default('none'), // 'none' | 'in_progress' | 'completed' | 'timeout'
  lastDialogueAt: timestamp('last_dialogue_at'),
});

// 修改 agentSubTasks 表定义，添加对话相关字段
export const agentSubTasks = pgTable('agent_sub_tasks', {
  // ... 现有字段 ...

  // === 对话相关字段 ===
  dialogueSessionId: text('dialogue_session_id'),
  dialogueRounds: integer('dialogue_rounds').notNull().default(0),
  dialogueStatus: text('dialogue_status').notNull().default('none'), // 'none' | 'in_progress' | 'completed' | 'timeout'
  lastDialogueAt: timestamp('last_dialogue_at'),
});

// 修改 agentInteractions 表定义，添加 isUnderstand 字段
export const agentInteractions = pgTable('agent_interactions', {
  // ... 现有字段 ...

  isUnderstand: pgBoolean('is_understand').notNull().default(false),
});

// 新增 agentReports 表定义
export const agentReports = pgTable('agent_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportType: text('report_type').notNull(), // 'subtask_timeout' | 'task_timeout'
  commandResultId: uuid('command_result_id').notNull().references(() => commandResults.id, { onDelete: 'cascade' }),
  subTaskId: uuid('sub_task_id').references(() => agentSubTasks.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  conclusion: text('conclusion').notNull(),
  dialogueProcess: jsonb('dialogue_process').notNull().$type<DialogueProcessEntry[]>(),
  reportedTo: text('reported_to').notNull(), // 'agent_a'
  reportedFrom: text('reported_from').notNull(), // 'agent_b'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export interface DialogueProcessEntry {
  roundNumber: number;
  sender: string;
  receiver: string;
  message: string;
  isUnderstand: boolean;
  timestamp: string;
}
```

---

### P1（建议完成，工作量约 2-3 小时）

#### 6. 安装 MCP SDK

```bash
pnpm add @modelcontextprotocol/sdk
```

#### 7. 配置定时任务调度

**方案 1：使用 node-cron（开发环境）**

```bash
pnpm add node-cron
pnpm add -D @types/node-cron
```

```typescript
// src/lib/cron/index.ts

import cron from 'node-cron';

/**
 * 启动所有定时任务
 */
export function startCronJobs() {
  console.log('🕐 启动定时任务...');

  // 每 10 分钟监控子任务
  cron.schedule('*/10 * * * *', async () => {
    console.log('🕐 执行 check-subtask-progress');
    // TODO: 调用定时任务 API
  });

  // 每日 13:00 巡检超长任务
  cron.schedule('0 13 * * *', async () => {
    console.log('🕐 执行 check-long-running-tasks');
    // TODO: 调用定时任务 API
  });

  // 每 10 分钟监控新任务拆分
  cron.schedule('*/10 * * * *', async () => {
    console.log('🕐 执行 check-new-tasks-to-split');
    // TODO: 调用定时任务 API
  });

  console.log('✅ 定时任务已启动');
}
```

**方案 2：使用 Vercel Cron（生产环境）**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/check-subtask-progress",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/check-long-running-tasks",
      "schedule": "0 13 * * *"
    },
    {
      "path": "/api/cron/check-new-tasks-to-split",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

### P2（可选，工作量约 3-4 小时）

#### 8. 实现基础函数

- `judgeExecutorResponse()` - Agent B 判断执行agent的回复
- `summarizeDialogue()` - Agent B 总结对话
- `reportToAgentA()` - 上报给 Agent A

#### 9. 实现 MCP Server 和 Client

- `src/lib/mcp/server.ts` - MCP Server
- `src/lib/mcp/security.ts` - 安全机制
- `src/lib/agents/agent-b-mcp-client.ts` - Agent B MCP Client

#### 10. 实现 3 个定时任务

- `src/app/api/cron/check-subtask-progress/route.ts`
- `src/app/api/cron/check-long-running-tasks/route.ts`
- `src/app/api/cron/check-new-tasks-to-split/route.ts`

---

## 实施建议

### 阶段 1：数据库表变更（1-2 小时）
1. 执行 SQL 脚本，添加缺失字段
2. 创建 `agentReports` 表
3. 更新 Drizzle ORM Schema
4. 执行数据库迁移

### 阶段 2：MCP 集成（2-3 小时）
1. 安装 MCP SDK
2. 实现 MCP Server
3. 实现 MCP Client
4. 实现安全机制

### 阶段 3：定时任务实现（3-4 小时）
1. 配置定时任务调度
2. 实现 3 个定时任务
3. 测试定时任务

### 阶段 4：集成测试（2-3 小时）
1. 端到端测试
2. 错误处理测试
3. 性能测试

**总估算时间**：8-12 小时

---

## 风险评估

### 低风险
- ✅ 现有表结构基本满足需求
- ✅ 只需添加少量字段
- ✅ 只需创建 1 个新表

### 中风险
- ⚠️ 数据库表变更可能影响现有功能（需要充分测试）
- ⚠️ MCP SDK 集成可能遇到兼容性问题

---

## 结论

### ✅ 具备基本实施条件

当前系统已具备基本的实施条件：
- ✅ `commandResults` 表已存在，只需添加对话相关字段
- ✅ `agentSubTasks` 表已存在，只需添加对话相关字段
- ✅ `agentInteractions` 表已存在，可替代 `agentDialogues`，只需添加 `isUnderstand` 字段
- ❌ `agentReports` 表不存在，需要创建

### 需要前置完成的工作（P0，约 1-2 小时）

1. ✅ 为 `commandResults` 表添加对话相关字段
2. ✅ 为 `agentSubTasks` 表添加对话相关字段
3. ✅ 为 `agentInteractions` 表添加 `isUnderstand` 字段
4. ✅ 创建 `agentReports` 表
5. ✅ 更新 Drizzle ORM Schema

完成 P0 工作后，即可开始实施定时任务和 MCP 集成。

---

## 下一步行动

1. **确认是否同意使用 `agentInteractions` 表替代 `agentDialogues` 表**
2. **确认定时任务调度方案（node-cron vs Vercel Cron）**
3. **确认是否需要立即实施 P0 工作**

请确认以上决策后，即可开始实施。
