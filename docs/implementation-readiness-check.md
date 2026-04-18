# 实施条件检查报告

## 检查日期
2025-01-01

## 检查结果

### ❌ 不具备完整实施条件

---

## 缺失的基础条件

### 1. 数据库表结构缺失

| 表名 | 状态 | 说明 |
|------|------|------|
| `commandResults` | ❌ 不存在 | 需要创建 |
| `agentSubTasks` | ❌ 不存在 | 需要创建 |
| `agentDialogues` | ❌ 不存在 | 需要创建 |
| `agentReports` | ❌ 不存在 | 需要创建 |

#### 当前存在的表
- ✅ `agentTasks`（但字段与设计文档不一致）
- ✅ `agentNotifications`
- ✅ `conversations`
- ✅ `messages`
- ✅ `agentMemories`

---

### 2. 现有代码与设计文档不匹配

#### 问题 1：表名不一致

**设计文档使用的表名**：
- `commandResults`（存储任务/指令）
- `agentSubTasks`（存储子任务）
- `agentDialogues`（存储对话记录）
- `agentReports`（存储上报报告）

**当前系统使用的表名**：
- `agentTasks`（存储任务）
- `agentNotifications`（存储通知）

#### 问题 2：字段不一致

**设计文档中的 `commandResults` 表字段**：
- `id`, `commandId`, `executor`, `commandContent`, `executionStatus`, `questionStatus`, `subTaskCount`, `completedSubTasks`, `createdAt`, `updatedAt`, `lastCheckedAt`, `lastInspectionTime`, `helpRecord`, `dialogueSessionId`, `dialogueRounds`, `dialogueStatus`, `lastDialogueAt`

**当前系统中的 `agentTasks` 表字段**：
- `id`, `taskId`, `taskName`, `coreCommand`, `executor`, `acceptanceCriteria`, `taskType`, `splitStatus`, `taskDurationStart`, `taskDurationEnd`, `totalDeliverables`, `taskPriority`, `taskStatus`, `fromAgentId`, `toAgentId`, `commandType`, `result`, `completedAt`, `creator`, `updater`, `remarks`, `metadata`, `createdAt`, `updatedAt`

---

### 3. MCP SDK 未安装

检查 `package.json`，未发现 MCP 相关依赖：
- ❌ `@modelcontextprotocol/sdk` 未安装
- ❌ `@modelcontextprotocol/sdk/server` 未安装
- ❌ `@modelcontextprotocol/sdk/client` 未安装

---

### 4. 定时任务调度机制缺失

检查项目中，未发现定时任务调度机制：
- ❌ 无 `cron` 配置
- ❌ 无定时任务调度器（如 node-cron、bull）
- ❌ 无定时任务入口（如 `src/app/api/cron/*`）

---

## 需要前置完成的工作

### P0（必须完成）

#### 1. 创建数据库表

**SQL 脚本**：

```sql
-- 1. command_results 表
CREATE TABLE command_results (
  id SERIAL PRIMARY KEY,
  command_id VARCHAR(100) NOT NULL UNIQUE,
  executor VARCHAR(50) NOT NULL,
  command_content TEXT NOT NULL,
  task_name VARCHAR(255),
  execution_status VARCHAR(50) NOT NULL DEFAULT 'new',
  question_status VARCHAR(50) DEFAULT 'none',
  sub_task_count INTEGER DEFAULT 0,
  completed_sub_tasks INTEGER DEFAULT 0,
  completed_sub_tasks_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_checked_at TIMESTAMP,
  last_inspection_time TIMESTAMP,
  help_record TEXT,

  -- 对话相关字段
  dialogue_session_id VARCHAR(100),
  dialogue_rounds INTEGER DEFAULT 0,
  dialogue_status VARCHAR(50) DEFAULT 'none',
  last_dialogue_at TIMESTAMP
);

CREATE INDEX idx_command_results_executor ON command_results(executor);
CREATE INDEX idx_command_results_execution_status ON command_results(execution_status);
CREATE INDEX idx_command_results_created_at ON command_results(created_at);

-- 2. agent_sub_tasks 表
CREATE TABLE agent_sub_tasks (
  id SERIAL PRIMARY KEY,
  command_result_id INTEGER NOT NULL REFERENCES command_results(id),
  agent_id VARCHAR(50) NOT NULL,
  task_title VARCHAR(255) NOT NULL,
  task_description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  order_index INTEGER NOT NULL,

  -- 时间字段
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- 元数据
  metadata JSONB,

  -- 对话相关字段
  dialogue_session_id VARCHAR(100),
  dialogue_rounds INTEGER DEFAULT 0,
  dialogue_status VARCHAR(50) DEFAULT 'none',
  last_dialogue_at TIMESTAMP
);

CREATE INDEX idx_agent_sub_tasks_command_result_id ON agent_sub_tasks(command_result_id);
CREATE INDEX idx_agent_sub_tasks_agent_id ON agent_sub_tasks(agent_id);
CREATE INDEX idx_agent_sub_tasks_status ON agent_sub_tasks(status);
CREATE INDEX idx_agent_sub_tasks_created_at ON agent_sub_tasks(created_at);

-- 3. agent_dialogues 表
CREATE TABLE agent_dialogues (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  command_result_id INTEGER NOT NULL,
  sub_task_id INTEGER REFERENCES agent_sub_tasks(id),
  sender VARCHAR(50) NOT NULL,
  receiver VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  is_understand BOOLEAN DEFAULT FALSE,
  round_number INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_dialogues_session_id ON agent_dialogues(session_id);
CREATE INDEX idx_agent_dialogues_command_result_id ON agent_dialogues(command_result_id);
CREATE INDEX idx_agent_dialogues_sub_task_id ON agent_dialogues(sub_task_id);
CREATE INDEX idx_agent_dialogues_created_at ON agent_dialogues(created_at);

-- 4. agent_reports 表
CREATE TABLE agent_reports (
  id SERIAL PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL,
  command_result_id INTEGER NOT NULL,
  sub_task_id INTEGER REFERENCES agent_sub_tasks(id),
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

#### 2. 安装 MCP SDK

```bash
pnpm add @modelcontextprotocol/sdk
```

#### 3. 创建 Drizzle ORM Schema

```typescript
// src/lib/db/schema/command-results.ts

import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const commandResults = pgTable('command_results', {
  id: serial('id').primaryKey(),
  commandId: text('command_id').notNull().unique(),
  executor: text('executor').notNull(),
  commandContent: text('command_content').notNull(),
  taskName: text('task_name'),
  executionStatus: text('execution_status').notNull().default('new'),
  questionStatus: text('question_status').default('none'),
  subTaskCount: integer('sub_task_count').default(0),
  completedSubTasks: integer('completed_sub_tasks').default(0),
  completedSubTasksDescription: text('completed_sub_tasks_description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastCheckedAt: timestamp('last_checked_at'),
  lastInspectionTime: timestamp('last_inspection_time'),
  helpRecord: text('help_record'),
  dialogueSessionId: text('dialogue_session_id'),
  dialogueRounds: integer('dialogue_rounds').default(0),
  dialogueStatus: text('dialogue_status').default('none'),
  lastDialogueAt: timestamp('last_dialogue_at'),
});
```

#### 4. 配置定时任务调度

**方案 1：使用 node-cron**

```bash
pnpm add node-cron
pnpm add -D @types/node-cron
```

```typescript
// src/lib/cron/index.ts

import cron from 'node-cron';
import { checkSubTaskProgress } from '@/app/api/cron/check-subtask-progress/route';
import { checkLongRunningTasks } from '@/app/api/cron/check-long-running-tasks/route';
import { checkNewTasksToSplit } from '@/app/api/cron/check-new-tasks-to-split/route';

/**
 * 启动所有定时任务
 */
export function startCronJobs() {
  console.log('🕐 启动定时任务...');

  // 每 10 分钟监控子任务
  cron.schedule('*/10 * * * *', async () => {
    console.log('🕐 执行 check-subtask-progress');
    await checkSubTaskProgress();
  });

  // 每日 13:00 巡检超长任务
  cron.schedule('0 13 * * *', async () => {
    console.log('🕐 执行 check-long-running-tasks');
    await checkLongRunningTasks();
  });

  // 每 10 分钟监控新任务拆分
  cron.schedule('*/10 * * * *', async () => {
    console.log('🕐 执行 check-new-tasks-to-split');
    await checkNewTasksToSplit();
  });

  console.log('✅ 定时任务已启动');
}
```

**方案 2：使用外部 Cron 服务（推荐生产环境）**

- 使用 Vercel Cron
- 使用 AWS EventBridge
- 使用 GitHub Actions

---

### P1（建议完成）

#### 5. 实现基础函数

- ✅ `generateSessionId()` - 已存在
- ✅ `splitTaskForAgent()` - 已存在
- ❌ `judgeExecutorResponse()` - 需要实现
- ❌ `summarizeDialogue()` - 需要实现
- ❌ `reportToAgentA()` - 需要实现

#### 6. 实现 MCP Server 和 Client

- 创建 `src/lib/mcp/server.ts`
- 创建 `src/lib/mcp/security.ts`
- 创建 `src/lib/agents/agent-b-mcp-client.ts`

#### 7. 更新现有代码

- 修改所有使用 `agentTasks` 的代码，改为使用 `commandResults`
- 修改所有使用 `agentNotifications` 的代码，改为使用 `agentDialogues`

---

## 实施建议

### 阶段 1：数据库表创建（1-2 小时）
1. 创建 SQL 脚本
2. 创建 Drizzle ORM Schema
3. 执行数据库迁移

### 阶段 2：基础函数实现（2-3 小时）
1. 实现 `judgeExecutorResponse()`
2. 实现 `summarizeDialogue()`
3. 实现 `reportToAgentA()`

### 阶段 3：MCP 集成（2-3 小时）
1. 安装 MCP SDK
2. 实现 MCP Server
3. 实现 MCP Client
4. 实现安全机制

### 阶段 4：定时任务实现（3-4 小时）
1. 配置定时任务调度
2. 实现 3 个定时任务
3. 测试定时任务

### 阶段 5：集成测试（2-3 小时）
1. 端到端测试
2. 错误处理测试
3. 性能测试

**总估算时间**：10-15 小时

---

## 风险评估

### 高风险
- ❌ 现有代码与设计文档不一致，需要大量重构
- ❌ 定时任务调度机制需要从零开始搭建

### 中风险
- ⚠️ MCP SDK 集成可能遇到兼容性问题
- ⚠️ 数据库表创建可能影响现有功能

### 低风险
- ✅ 基础函数实现相对简单
- ✅ 定时任务逻辑已清晰定义

---

## 结论

**当前不具备完整的实施条件，建议先完成以下 P0 工作**：

1. ✅ 创建数据库表（`commandResults`、`agentSubTasks`、`agentDialogues`、`agentReports`）
2. ✅ 安装 MCP SDK
3. ✅ 创建 Drizzle ORM Schema
4. ✅ 配置定时任务调度

完成 P0 工作后，再开始实施定时任务和 MCP 集成。

---

## 下一步行动

1. **确认是否需要使用 `commandResults` 表，还是可以复用现有的 `agentTasks` 表**
2. **确认定时任务调度方案（node-cron vs 外部 Cron 服务）**
3. **确认 MCP SDK 版本和集成方式**

请确认以上决策后，再开始实施。
