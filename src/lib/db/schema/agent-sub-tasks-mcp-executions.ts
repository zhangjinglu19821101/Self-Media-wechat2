import { pgTable, serial, integer, text, timestamp, jsonb, boolean as pgBoolean, index, uuid } from 'drizzle-orm/pg-core';

export const agentSubTasksMcpExecutions = pgTable('agent_sub_tasks_mcp_executions', {
  id: serial('id').primaryKey(),
  
  // 数据库实际字段：step_history_id
  stepHistoryId: integer('step_history_id'),
  
  commandResultId: uuid('command_result_id'),
  
  // 数据库实际字段：order_index
  orderIndex: integer('order_index'),
  
  attemptId: text('attempt_id'),
  attemptNumber: integer('attempt_number'),
  attemptTimestamp: timestamp('attempt_timestamp'),
  solutionNum: integer('solution_num'),
  toolName: text('tool_name'),
  actionName: text('action_name'),
  reasoning: text('reasoning'),
  strategy: text('strategy'),
  params: jsonb('params'),
  resultStatus: text('result_status'),
  resultData: jsonb('result_data'),
  resultText: text('result_text'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  errorType: text('error_type'),
  executionTimeMs: integer('execution_time_ms'),
  isRetryable: pgBoolean('is_retryable'),
  failureType: text('failure_type'),
  suggestedNextAction: text('suggested_next_action'),
  createdAt: timestamp('created_at')
}, (table) => {
  return {
    // 保留基本索引
    idxCommandResult: index('idx_mcp_command_result').on(table.commandResultId, table.orderIndex)
  };
});

export type AgentSubTasksMcpExecution = typeof agentSubTasksMcpExecutions.$inferSelect;
export type AgentSubTasksMcpExecutionInsert = typeof agentSubTasksMcpExecutions.$inferInsert;
