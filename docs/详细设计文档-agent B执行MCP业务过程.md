
# 🚀 agent_sub_tasks_mcp_executions 表完整实施方案

**文档版本：** v1.0  
**创建日期：** 2025-03-09  
**文档状态：** ✅ 可实施

---

## 📋 目录
1. **改动清单总览**
2. **详细实施步骤**
3. **验证方案**
4. **回滚方案**
5. **风险评估**
6. **时间估算**
7. **Checklist（实施前检查）**
8. **字段设计详解**
9. **智能化字段分类**

---

## 📊 一、改动清单总览

| 类别 | 文件路径 | 操作 | 优先级 |
|------|---------|------|--------|agent_sub_tasks_mcp_executions;

| **数据库 Schema** | `src/lib/db/schema/agent-sub-tasks-mcp-executions.ts` | 🆕 新建 | P0 |
| **数据库 Schema** | `src/lib/db/schema.ts` | ✏️ 修改 | P0 |
| **数据库迁移** | `migrations/002_add_mcp_executions_table.sql` | 🆕 新建 | P0 |
| **业务逻辑** | `src/lib/services/subtask-execution-engine.ts` | ✏️ 修改 | P0 |
| **查询服务（可选）** | `src/lib/services/mcp-execution-query-service.ts` | 🆕 新建 | P1 |
| **单元测试（可选）** | `src/lib/test/mcp-executions-table.test.ts` | 🆕 新建 | P1 |
| **验证 API（可选）** | `src/app/api/test/mcp-executions-validation/route.ts` | 🆕 新建 | P1 |

**总计：4 个必须文件 + 3 个可选文件**

---

## 🔧 二、详细实施步骤

### **Phase 1：准备工作（30 分钟）**

#### **Step 1.1：确认当前代码状态**
```bash
# 切换到主分支
git checkout main

# 拉取最新代码
git pull origin main

# 创建新分支
git checkout -b feature/mcp-executions-table
```

---

### **Phase 2：数据库层（1 小时）**

#### **Step 2.1：新建表 Schema 文件**
**文件：** `src/lib/db/schema/agent-sub-tasks-mcp-executions.ts`

```typescript
import { pgTable, serial, integer, text, timestamp, jsonb, boolean as pgBoolean, index } from 'drizzle-orm/pg-core';
import { agentSubTasksStepHistory } from './agent-sub-tasks-step-history';

export const agentSubTasksMcpExecutions = pgTable('agent_sub_tasks_mcp_executions', {
  id: serial('id').primaryKey(),
  
  // === 关联字段 ===
  stepHistoryId: integer('step_history_id')
    .notNull()
    .references(() =&gt; agentSubTasksStepHistory.id, { onDelete: 'cascade' }),
  commandResultId: text('command_result_id').notNull(),
  orderIndex: integer('order_index').notNull(),
  
  // === MCP 尝试标识 ===
  attemptId: text('attempt_id').notNull(),
  attemptNumber: integer('attempt_number').notNull(),
  attemptTimestamp: timestamp('attempt_timestamp').notNull(),
  
  // === Agent B 决策字段（方案选型）===
  solutionNum: integer('solution_num'),
  toolName: text('tool_name'),
  actionName: text('action_name'),
  reasoning: text('reasoning'),
  strategy: text('strategy'),
  
  // === 系统记录：MCP 调用参数 ===
  params: jsonb('params'),
  
  // === 系统记录：MCP 执行结果 ===
  resultStatus: text('result_status').notNull(),
  resultData: jsonb('result_data'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  errorType: text('error_type'),
  executionTimeMs: integer('execution_time_ms').notNull(),
  
  // === Agent B 建议字段（失败分析）===
  isRetryable: pgBoolean('is_retryable'),
  failureType: text('failure_type'),
  suggestedNextAction: text('suggested_next_action'),
  
  // === 元数据 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) =&gt; {
  return {
    idxStepHistoryId: index('idx_mcp_step_history_id').on(table.stepHistoryId),
    idxCommandResult: index('idx_mcp_command_result').on(table.commandResultId, table.orderIndex),
    idxToolAction: index('idx_mcp_tool_action').on(table.toolName, table.actionName),
    idxStatus: index('idx_mcp_status').on(table.resultStatus),
    idxTimestamp: index('idx_mcp_timestamp').on(table.attemptTimestamp),
    idxErrorType: index('idx_mcp_error_type').on(table.errorType),
  };
});

export type AgentSubTasksMcpExecution = typeof agentSubTasksMcpExecutions.$inferSelect;
export type AgentSubTasksMcpExecutionInsert = typeof agentSubTasksMcpExecutions.$inferInsert;
```

#### **Step 2.2：修改主 schema.ts，导出新表**
**文件：** `src/lib/db/schema.ts`

在文件**末尾**添加：
```typescript
// 在现有导出后面添加
export * from './schema/agent-sub-tasks-mcp-executions';
```

#### **Step 2.3：创建数据库迁移脚本**
**文件：** `migrations/002_add_mcp_executions_table.sql`

```sql
-- ============================================
-- MCP 执行记录表
-- ============================================
CREATE TABLE agent_sub_tasks_mcp_executions (
  id SERIAL PRIMARY KEY,
  
  -- 关联字段
  step_history_id INTEGER NOT NULL REFERENCES agent_sub_tasks_step_history(id) ON DELETE CASCADE,
  command_result_id UUID NOT NULL,
  order_index INTEGER NOT NULL,
  
  -- MCP 尝试标识
  attempt_id VARCHAR(100) NOT NULL,
  attempt_number INTEGER NOT NULL,
  attempt_timestamp TIMESTAMP NOT NULL,
  
  -- Agent B 决策字段（方案选型）
  solution_num INTEGER,
  tool_name VARCHAR(100),
  action_name VARCHAR(100),
  reasoning TEXT,
  strategy VARCHAR(50),
  
  -- 系统记录：MCP 调用参数
  params JSONB,
  
  -- 系统记录：MCP 执行结果
  result_status VARCHAR(20) NOT NULL,
  result_data JSONB,
  error_code VARCHAR(100),
  error_message TEXT,
  error_type VARCHAR(50),
  execution_time_ms INTEGER NOT NULL,
  
  -- Agent B 建议字段（失败分析）
  is_retryable BOOLEAN,
  failure_type VARCHAR(50),
  suggested_next_action VARCHAR(50),
  
  -- 元数据
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 索引创建
-- ============================================
CREATE INDEX idx_mcp_step_history_id ON agent_sub_tasks_mcp_executions(step_history_id);
CREATE INDEX idx_mcp_command_result ON agent_sub_tasks_mcp_executions(command_result_id, order_index);
CREATE INDEX idx_mcp_tool_action ON agent_sub_tasks_mcp_executions(tool_name, action_name);
CREATE INDEX idx_mcp_status ON agent_sub_tasks_mcp_executions(result_status);
CREATE INDEX idx_mcp_timestamp ON agent_sub_tasks_mcp_executions(attempt_timestamp);
CREATE INDEX idx_mcp_error_type ON agent_sub_tasks_mcp_executions(error_type);

-- ============================================
-- 验证表结构
-- ============================================
COMMENT ON TABLE agent_sub_tasks_mcp_executions IS 'MCP 执行详细审计表';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.step_history_id IS '关联 agent_sub_tasks_step_history.id';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.result_status IS '执行状态：in_process|success|failed';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.strategy IS '策略类型：initial|retry|switch_type|degrade';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.is_retryable IS 'Agent B 分析：是否可重试';
COMMENT ON COLUMN agent_sub_tasks_mcp_executions.suggested_next_action IS 'Agent B 建议：retry_same|switch_method';
```

#### **Step 2.4：执行数据库迁移**
```bash
# 连接数据库执行迁移
psql -d your_database_name -f migrations/002_add_mcp_executions_table.sql

# 验证表结构
psql -d your_database_name -c "\d agent_sub_tasks_mcp_executions"

# 验证索引
psql -d your_database_name -c "\di idx_mcp_*"
```

---

### **Phase 3：业务逻辑层（1.5 小时）**

#### **Step 3.1：修改 subtask-execution-engine.ts**
**文件：** `src/lib/services/subtask-execution-engine.ts`

**修改 1：顶部导入新表**
```typescript
// 找到这一行（大约第 10 行）
import { 
  agentSubTasks, 
  agentSubTasksStepHistory, 
  capabilityList,
  dailyTask,
  agentReports
} from '@/lib/db/schema';

// 修改为：
import { 
  agentSubTasks, 
  agentSubTasksStepHistory, 
  agentSubTasksMcpExecutions,  // ← 新增这一行
  capabilityList,
  dailyTask,
  agentReports
} from '@/lib/db/schema';
```

**修改 2：修改 `createInteractionStep` 方法（第 1871 行附近）**

```typescript
// ========== 修改前 ==========
private async createInteractionStep(
  commandResultId: string,
  stepNo: number,
  interactType: string,
  interactNum: number,
  interactUser: string,
  content: any
) {
  await db.insert(agentSubTasksStepHistory).values({
    commandResultId,
    stepNo,
    interactType,
    interactNum,
    interactContent: content,
    interactUser,
    interactTime: getCurrentBeijingTime(),
  });
}

// ========== 修改后 ==========
private async createInteractionStep(
  commandResultId: string,
  stepNo: number,
  interactType: string,
  interactNum: number,
  interactUser: string,
  content: any
) {
  // 事务：同时写入两张表
  await db.transaction(async (tx) =&gt; {
    // 1. 写入主表（维持现有逻辑不变）
    const [stepHistory] = await tx.insert(agentSubTasksStepHistory)
      .values({
        commandResultId,
        stepNo,
        interactType,
        interactNum,
        interactContent: content,
        interactUser,
        interactTime: getCurrentBeijingTime(),
      })
      .returning({ id: agentSubTasksStepHistory.id });

    // 2. 如果有 mcp_attempts，同时写入新表
    const mcpAttempts = content?.response?.mcp_attempts;
    if (mcpAttempts &amp;&amp; Array.isArray(mcpAttempts) &amp;&amp; mcpAttempts.length &gt; 0) {
      for (const attempt of mcpAttempts) {
        await tx.insert(agentSubTasksMcpExecutions)
          .values({
            stepHistoryId: stepHistory.id,
            commandResultId,
            orderIndex: stepNo,
            attemptId: attempt.attemptId,
            attemptNumber: attempt.attemptNumber,
            attemptTimestamp: attempt.timestamp,
            solutionNum: attempt.decision?.solutionNum,
            toolName: attempt.decision?.toolName,
            actionName: attempt.decision?.actionName,
            reasoning: attempt.decision?.reasoning,
            strategy: attempt.decision?.strategy,
            params: attempt.params,
            resultStatus: attempt.result?.status,
            resultData: attempt.result?.data,
            errorCode: attempt.result?.error?.code,
            errorMessage: attempt.result?.error?.message,
            errorType: attempt.result?.error?.type,
            executionTimeMs: attempt.result?.executionTime,
            isRetryable: attempt.failureAnalysis?.isRetryable,
            failureType: attempt.failureAnalysis?.failureType,
            suggestedNextAction: attempt.failureAnalysis?.suggestedNextAction,
          });
      }
    }
  });
}
```

#### **Step 3.2：运行 TypeScript 类型检查**
```bash
npx tsc --noEmit
```
✅ 确保没有类型错误！

---

### **Phase 4：验证与测试（2 小时）**

#### **Step 4.1：本地手动测试（关键！）**
```bash
# 启动开发服务
coze dev
```

**手动测试步骤：**
1. 触发一个包含 MCP 调用的任务
2. 等待任务完成
3. 检查数据库：
   ```sql
   -- 检查主表有数据
   SELECT * FROM agent_sub_tasks_step_history ORDER BY id DESC LIMIT 5;
   
   -- 检查从表有数据
   SELECT * FROM agent_sub_tasks_mcp_executions ORDER BY id DESC LIMIT 5;
   
   -- 验证数量一致
   SELECT 
     s.id AS step_id,
     s.interact_content-&gt;'response'-&gt;'mcp_attempts' AS json_attempts,
     jsonb_array_length(s.interact_content-&gt;'response'-&gt;'mcp_attempts') AS json_count,
     COUNT(m.id) AS db_count
   FROM agent_sub_tasks_step_history s
   LEFT JOIN agent_sub_tasks_mcp_executions m ON s.id = m.step_history_id
   WHERE s.interact_content-&gt;'response'-&gt;'mcp_attempts' IS NOT NULL
   GROUP BY s.id
   ORDER BY s.id DESC
   LIMIT 10;
   ```

#### **Step 4.2：运行现有 E2E 测试（向后兼容验证）**
```bash
# 运行合规测试
node src/lib/test/e2e/run-compliance-tests.ts

# 运行通用测试
node src/lib/test/e2e/run-tests.ts
```
✅ 确保所有现有测试通过！

---

### **Phase 5：可选增强（按需，2 小时）**

#### **Step 5.1：新建查询服务（可选）**
**文件：** `src/lib/services/mcp-execution-query-service.ts`

```typescript
import { db } from '@/lib/db';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq, and, between, desc, gte, lte } from 'drizzle-orm';

export class McpExecutionQueryService {
  /**
   * 查询指定 step history 的所有 MCP 执行记录
   */
  static async getByStepHistoryId(stepHistoryId: number) {
    return await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(eq(agentSubTasksMcpExecutions.stepHistoryId, stepHistoryId))
      .orderBy(agentSubTasksMcpExecutions.attemptNumber);
  }

  /**
   * 查询指定任务的所有 MCP 执行记录
   */
  static async getByCommandResultId(commandResultId: string) {
    return await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(eq(agentSubTasksMcpExecutions.commandResultId, commandResultId))
      .orderBy(agentSubTasksMcpExecutions.attemptTimestamp);
  }

  /**
   * 查询指定时间范围内的失败 MCP 调用
   */
  static async getFailedExecutions(startTime: Date, endTime: Date) {
    return await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(
        and(
          eq(agentSubTasksMcpExecutions.resultStatus, 'failed'),
          gte(agentSubTasksMcpExecutions.attemptTimestamp, startTime),
          lte(agentSubTasksMcpExecutions.attemptTimestamp, endTime)
        )
      )
      .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp));
  }

  /**
   * 按工具名统计调用情况
   */
  static async getStatsByTool(toolName: string, startTime?: Date, endTime?: Date) {
    let query = db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(eq(agentSubTasksMcpExecutions.toolName, toolName));

    if (startTime &amp;&amp; endTime) {
      query = query.where(
        and(
          gte(agentSubTasksMcpExecutions.attemptTimestamp, startTime),
          lte(agentSubTasksMcpExecutions.attemptTimestamp, endTime)
        )
      );
    }

    return query.orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp));
  }

  /**
   * 获取统计概览
   */
  static async getStatsOverview(startTime?: Date, endTime?: Date) {
    let query = db.select().from(agentSubTasksMcpExecutions);
    
    if (startTime &amp;&amp; endTime) {
      query = query.where(
        and(
          gte(agentSubTasksMcpExecutions.attemptTimestamp, startTime),
          lte(agentSubTasksMcpExecutions.attemptTimestamp, endTime)
        )
      );
    }

    const records = await query;
    
    return {
      totalCalls: records.length,
      successCount: records.filter(r =&gt; r.resultStatus === 'success').length,
      failedCount: records.filter(r =&gt; r.resultStatus === 'failed').length,
      inProcessCount: records.filter(r =&gt; r.resultStatus === 'in_process').length,
      avgExecutionTime: records.length &gt; 0 
        ? Math.round(records.reduce((sum, r) =&gt; sum + (r.executionTimeMs || 0), 0) / records.length)
        : 0,
      successRate: records.length &gt; 0 
        ? Math.round(records.filter(r =&gt; r.resultStatus === 'success').length * 100 / records.length)
        : 0,
    };
  }
}
```

#### **Step 5.2：新建验证 API（可选）**
**文件：** `src/app/api/test/mcp-executions-validation/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory, agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const commandResultId = searchParams.get('commandResultId');
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    let stepHistoryRecords;
    
    if (commandResultId) {
      // 查询指定任务
      stepHistoryRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId))
        .orderBy(desc(agentSubTasksStepHistory.id));
    } else {
      // 查询最近的记录
      stepHistoryRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .orderBy(desc(agentSubTasksStepHistory.id))
        .limit(limit);
    }

    // 查询对应的 MCP 记录
    const allMcpRecords = [];
    const validationResults = [];

    for (const record of stepHistoryRecords) {
      const mcpRecords = await db
        .select()
        .from(agentSubTasksMcpExecutions)
        .where(eq(agentSubTasksMcpExecutions.stepHistoryId, record.id));
      
      allMcpRecords.push({
        stepHistoryId: record.id,
        mcpRecords,
        mcpCount: mcpRecords.length,
      });

      // 验证：主表 JSON 中的数量 = 从表记录数
      const jsonAttempts = record.interactContent?.response?.mcp_attempts || [];
      const jsonCount = Array.isArray(jsonAttempts) ? jsonAttempts.length : 0;
      const dbCount = mcpRecords.length;
      
      validationResults.push({
        stepHistoryId: record.id,
        commandResultId: record.commandResultId,
        jsonCount,
        dbCount,
        isMatch: jsonCount === dbCount,
      });
    }

    return NextResponse.json({
      summary: {
        totalStepHistoryRecords: stepHistoryRecords.length,
        totalMcpRecords: allMcpRecords.reduce((sum, r) =&gt; sum + r.mcpCount, 0),
        allValid: validationResults.every(r =&gt; r.isMatch),
        validCount: validationResults.filter(r =&gt; r.isMatch).length,
        invalidCount: validationResults.filter(r =&gt; !r.isMatch).length,
      },
      validationResults,
      details: {
        stepHistoryRecords,
        mcpRecordsByStep: allMcpRecords,
      },
    });
  } catch (error) {
    console.error('[MCP Validation API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to validate MCP executions', message: String(error) },
      { status: 500 }
    );
  }
}
```

**使用方式：**
```
# 验证最近 10 条记录
GET /api/test/mcp-executions-validation?limit=10

# 验证指定任务
GET /api/test/mcp-executions-validation?commandResultId=&lt;some-id&gt;
```

---

## ✅ 三、完整验证方案

### **验证 Checklist**

| 验证项 | 验证方法 | 预期结果 |
|--------|---------|---------|
| **1. 数据库表结构** | `psql -d your_db -c "\d agent_sub_tasks_mcp_executions"` | 表存在，字段完整 |
| **2. 数据库索引** | `psql -d your_db -c "\di idx_mcp_*"` | 6 个索引都存在 |
| **3. TypeScript 类型检查** | `npx tsc --noEmit` | ✅ 无错误 |
| **4. 主表写入正常** | 触发任务，查询主表 | 主表有数据，JSON 字段完整 |
| **5. 从表写入正常** | 查询从表 | 从表有对应数据 |
| **6. 数据数量一致** | 运行验证 SQL | JSON 数组长度 = 从表记录数 |
| **7. 数据内容一致** | 抽查字段值 | JSON 字段值 = 从表对应字段值 |
| **8. 事务原子性** | 模拟从表写入失败 | 两张表都无数据 |
| **9. 向后兼容** | 运行现有 E2E 测试 | ✅ 全部通过 |
| **10. 无 mcp_attempts 场景** | 触发无 MCP 调用的任务 | 只写主表，逻辑正常 |
| **11. 性能影响** | 对比写入耗时 | 增加 &lt; 50ms |

---

## 🔄 四、回滚方案

### **回滚触发条件**
- 数据不一致
- 性能严重下降
- 现有业务流程受影响

### **回滚步骤**

#### **Step 1：代码回滚**
```bash
# 切换回主分支
git checkout main

# 或者回滚特定提交
git revert &lt;commit-hash&gt;

# 重启服务
coze dev
```

#### **Step 2：数据库回滚（可选，如无数据可直接删表）**
```sql
-- 删除新表（会级联删除所有数据）
DROP TABLE IF EXISTS agent_sub_tasks_mcp_executions;
```

---

## ⚠️ 五、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **数据库迁移失败** | 🟡 中 | 🔴 高 | 先在测试环境验证，准备回滚脚本 |
| **数据不一致** | 🟡 中 | 🟡 中 | 充分的测试和验证，准备验证 SQL |
| **性能下降** | 🟢 低 | 🟡 中 | 监控写入耗时，必要时优化 |
| **事务死锁** | 🟢 低 | 🔴 高 | 使用合适的事务隔离级别 |
| **向后兼容问题** | 🟢 低 | 🔴 高 | 运行完整 E2E 测试 |

**总体风险等级：🟡 中低风险**

---

## ⏱️ 六、时间估算

| 阶段 | 任务 | 时间估算 |
|------|------|---------|
| **Phase 1** | 准备工作 | 30 分钟 |
| **Phase 2** | 数据库层（Schema + 迁移） | 1 小时 |
| **Phase 3** | 业务逻辑层（代码修改） | 1.5 小时 |
| **Phase 4** | 验证与测试 | 2 小时 |
| **Phase 5** | 可选增强（查询服务 + API） | 2 小时 |
| **Buffer** | 预留缓冲 | 1 小时 |
| **总计（必须部分）** | **Phase 1-4** | **5 小时** |
| **总计（完整方案）** | **Phase 1-5** | **7 小时** |

---

## ✅ 七、实施前 Checklist

**执行前请确认：**
- [ ] 已备份数据库
- [ ] 已在测试环境验证过迁移脚本
- [ ] 已准备好回滚方案
- [ ] 已通知相关团队
- [ ] 已选择低峰期实施（建议凌晨或业务低峰）
- [ ] 已准备好监控和日志查看
- [ ] 已确认开发环境可以正常运行

---

## 📋 八、字段设计详解

### **result_status 枚举值**

| 值 | 业务含义 | 场景说明 |
|----|---------|---------|
| `'in_process'` | **执行中** | MCP 调用已发起，正在等待结果 |
| `'success'` | **成功** | MCP 调用完全成功 |
| `'failed'` | **失败** | MCP 调用明确失败 |

---

### **strategy 枚举值**

| 值 | 业务含义 | Agent B 决策场景 |
|----|---------|-----------------|
| `'initial'` | **首次尝试** | Agent B 第一次选择方案调用 MCP |
| `'retry'` | **重试相同方案** | 上次失败但可重试，Agent B 决定用相同的 tool+action 再试一次 |
| `'switch_type'` | **切换方案** | 上次失败不可重试或换方案更好，Agent B 决定换不同的 tool+action |
| `'degrade'` | **降级方案** | 高级方案失败，Agent B 决定降级使用简单方案 |

---

### **error_type 枚举值**

| 值 | 业务含义 | 示例 | 是否可重试 |
|----|---------|------|-----------|
| `'network'` | **网络错误** | 连接超时、DNS 失败 | ✅ **是** |
| `'timeout'` | **超时错误** | MCP 执行超时 | ✅ **是** |
| `'permission'` | **权限错误** | 账号无权限、token 过期 | ❌ **否** |
| `'not_found'` | **资源不存在** | 账号不存在、文章找不到 | ❌ **否** |
| `'unknown'` | **未知错误** | 其他未分类错误 | ⚠️ **视情况** |

---

### **failure_type 枚举值**

| 值 | 业务含义 | 说明 |
|----|---------|------|
| `'temporary'` | **临时失败** | 网络波动、超时等，重试大概率成功 |
| `'resource_unavailable'` | **资源不可用** | 账号问题、权限问题，重试也没用 |

---

### **suggested_next_action 枚举值**

| 值 | 业务含义 | Agent B 应该怎么做 |
|----|---------|------------------|
| `'retry_same'` | **重试相同方案** | 用相同的 tool+action 再试一次 |
| `'switch_method'` | **切换方案** | 换一个不同的 tool+action |

---

## 🧠 九、智能化字段分类

### **字段智能决策分类图谱**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    字段智能决策分类                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  【Agent B 决策字段】（智能生成）                              │  │
│  │  = Agent B 基于 LLM 推理给出的决策和建议                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                            │                                         │
│  ┌─────────────────────────┼───────────────────────────────────┐   │
│  │                         │                                   │   │
│  ▼                         ▼                                   ▼   │
│  ┌─────────────────┐ ┌──────────────────┐ ┌───────────────────┐ │
│  │  方案选型决策    │ │  失败分析建议     │ │  重试策略建议      │ │
│  │  (首次执行)      │ │  (失败后分析)     │ │  (失败后建议)      │ │
│  └─────────────────┘ └──────────────────┘ └───────────────────┘ │
│         │                       │                     │            │
│         ▼                       ▼                     ▼            │
│  • solution_num         • is_retryable        • suggested_next   │
│  • tool_name            • failure_type            _action        │
│  • action_name                                                    │
│  • reasoning                                                      │
│  • strategy                                                       │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                              │
                              │
┌─────────────────────────────────┴─────────────────────────────────┐
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  【系统执行记录字段】（事实记录）                              │ │
│  │  = 系统实际执行过程中产生的客观数据                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  • 关联字段（step_history_id, command_result_id...）             │
│  • 尝试标识（attempt_id, attempt_number, attempt_timestamp）      │
│  • 调用参数（params）                                             │
│  • 执行结果（result_status, result_data, error_code...）         │
│  • 执行耗时（execution_time_ms）                                  │
│  • 元数据（created_at）                                           │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

### **完整字段分类表（20 个字段）**

| 字段名 | 字段分类 | 决策主体 | 说明 |
|--------|---------|---------|------|
| **id** | 系统记录 | 数据库 | 自增主键 |
| **step_history_id** | 系统记录 | 系统 | 关联主表 |
| **command_result_id** | 系统记录 | 系统 | 冗余字段，查询优化 |
| **order_index** | 系统记录 | 系统 | 冗余字段，查询优化 |
| **attempt_id** | 系统记录 | 系统 | 唯一尝试标识 |
| **attempt_number** | 系统记录 | 系统 | 第几次尝试 |
| **attempt_timestamp** | 系统记录 | 系统 | 尝试时间 |
| **solution_num** | 🔴 **Agent B 决策** | **Agent B** | 选定方案 ID |
| **tool_name** | 🔴 **Agent B 决策** | **Agent B** | 工具名称 |
| **action_name** | 🔴 **Agent B 决策** | **Agent B** | 动作名称 |
| **reasoning** | 🔴 **Agent B 决策** | **Agent B** | 决策理由 |
| **strategy** | 🔴 **Agent B 决策** | **Agent B** | 策略类型 |
| **params** | 系统记录 | 系统 | MCP 调用参数 |
| **result_status** | 系统记录 | 系统 | 执行状态（in_process/success/failed） |
| **result_data** | 系统记录 | 系统 | 成功时的返回数据 |
| **error_code** | 系统记录 | 系统 | 错误码 |
| **error_message** | 系统记录 | 系统 | 错误详细描述 |
| **error_type** | 系统记录 | 系统 | 错误类型（系统分类） |
| **execution_time_ms** | 系统记录 | 系统 | 执行耗时 |
| **is_retryable** | 🟡 **Agent B 建议** | **Agent B** | 是否可重试（失败后分析） |
| **failure_type** | 🟡 **Agent B 建议** | **Agent B** | 失败类型（失败后分析） |
| **suggested_next_action** | 🟡 **Agent B 建议** | **Agent B** | 建议下一步动作（失败后建议） |
| **created_at** | 系统记录 | 数据库 | 记录创建时间 |

---

## 💡 十、智能化设计亮点

### **1. 决策可追溯**
- Agent B 的每个决策都有 `reasoning` 字段说明理由
- 人工可以审核 Agent B 的决策逻辑

### **2. 失败可分析**
- 不仅记录"失败了"，还记录 Agent B 对失败的分析
- `is_retryable`、`failure_type`、`suggested_next_action` 三位一体

### **3. 策略可理解**
- `strategy` 字段清晰标识 Agent B 的决策思路
- 便于分析 Agent B 的决策偏好和优化空间

### **4. 未来可扩展**
- 这些字段为未来的"自动重试优化"、"决策质量评估"等功能预留了数据基础
- Agent B 可以学习历史决策，持续优化

---

## 📋 十一、文件清单（最终确认）

### **必须文件（4 个）**
- [ ] `src/lib/db/schema/agent-sub-tasks-mcp-executions.ts`（新建）
- [ ] `src/lib/db/schema.ts`（修改）
- [ ] `migrations/002_add_mcp_executions_table.sql`（新建）
- [ ] `src/lib/services/subtask-execution-engine.ts`（修改）

### **可选文件（3 个）**
- [ ] `src/lib/services/mcp-execution-query-service.ts`（新建）
- [ ] `src/lib/test/mcp-executions-table.test.ts`（新建）
- [ ] `src/app/api/test/mcp-executions-validation/route.ts`（新建）

---

**文档结束** ✅

**方案已完整梳理，可以开始实施！** 🚀

