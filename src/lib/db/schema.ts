/**
 * 数据库 Schema 定义
 * 定义对话历史和会话管理的数据库表结构
 */

import { pgTable, text, timestamp, jsonb, uuid, integer, boolean as pgBoolean, date, unique, serial, index, numeric } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import type { ArticleMetadata } from '@/lib/types/article-metadata';

/**
 * 对话会话表
 * 存储每个对话会话的基本信息
 */
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull().unique(),
  userId: text('user_id'),
  agentId: text('agent_id').notNull(),
  state: text('state').notNull().default('active'),
  variables: jsonb('variables').$type<Record<string, any>>().default({}),
  context: jsonb('context').$type<Record<string, any>>().default({}),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  lastActiveAt: timestamp('last_active_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * 对话消息表
 * 存储每条对话消息的内容
 */
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  tokens: integer('tokens'),
  model: text('model'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Agent 记忆表
 * 存储 Agent 的长期记忆和经验
 */
export const agentMemories = pgTable('agent_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: text('agent_id').notNull(),
  memoryType: text('memory_type').notNull(), // 'decision' | 'strategy' | 'experience' | 'rule' | 'knowledge'
  title: text('title').notNull(),
  content: text('content').notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  importance: integer('importance').notNull().default(0), // 0-10, 越高越重要
  source: text('source'), // 来源：'manual' | 'auto' | 'import'
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Agent 任务表
 * 存储 Agent 间下达的任务（扩展版）
 *
 * 📋 字段映射说明（TaskManager.createTask）
 * ========================================
 * API 参数 → 数据库字段映射关系：
 *
 * 【身份相关】
 * ┌──────────────────┬────────────────────────────────────────────────┐
 * │ API: fromAgentId │ → taskId: "task-{fromAgentId}-to-{toAgentId}-..." │
 * │                  │   业务含义：任务唯一标识，包含发起方和接收方信息  │
 * │                  │   格式规则：task-{发起方}-to-{接收方}-{时间戳}    │
 * │                  │   示例：task-A-to-B-1770699956142               │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: fromAgentId │ → from_agent_id: 发起指令的 Agent ID            │
 * │                  │   业务含义：记录任务发起方，便于追溯任务来源      │
 * │                  │   值域：'A' | 'B' | 'C' | 'D' | 'insurance-c' | 'insurance-d' │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: toAgentId   │ → executor: 任务执行者（默认=接收方）           │
 * │                  │   业务含义：谁实际执行这个任务                     │
 * │                  │   默认规则：接收方即执行方（toAgentId = executor）│
 * │                  │   特殊情况：未来可能支持任务转发（A→B→C）        │
 * │                  │   值域：同 fromAgentId                           │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: toAgentId   │ → to_agent_id: 接收指令的 Agent ID              │
 * │                  │   业务含义：指令最初发送给谁                      │
 * │                  │   说明：如果任务转发，executor 可能与 toAgentId 不同 │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ 自动生成         │ → creator: 任务创建人（默认=发起方）            │
 * │                  │   业务含义：谁创建了这个任务记录                   │
 * │                  │   通常等于 fromAgentId（Agent A 创建任务给 Agent B）│
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ 自动生成         │ → updater: 最后更新人（默认=发起方）            │
 * │                  │   业务含义：谁最后修改了这个任务记录               │
 * │                  │   示例：'TS'（系统自动更新）| 'A' | 'B'         │
 * └──────────────────┴────────────────────────────────────────────────┘
 *
 * 【指令内容】
 * ┌──────────────────┬────────────────────────────────────────────────┐
 * │ API: command     │ → core_command: 核心指令内容（完整文本）       │
 * │                  │   业务含义：发送给 Agent 的完整指令               │
 * │                  │   格式："[来自 总裁 的指令] 优先级：普通 ..."    │
 * │                  │   向量用途：此字段会同步到向量库，支持语义搜索    │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: command     │ → task_name: 任务名称（默认基于 taskId）        │
 * │                  │   业务含义：任务的简短名称，用于显示和查询        │
 * │                  │   默认值："任务 task-A-to-B-1770699956142"        │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: commandType │ → command_type: 指令类型                        │
 * │                  │   业务含义：指令的用途分类                        │
 * │                  │   值域：'instruction'（指令）| 'task'（任务）     │
 * │                  │        'report'（报告）| 'urgent'（紧急）        │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ 自动生成         │ → total_deliverables: 交付物描述（默认="0"）     │
 * │                  │   业务含义：任务需要交付的产出物                  │
 * │                  │   默认值："0"（创建时未知，执行完成后更新）       │
 * │                  │   示例："3篇文章" | "1个系统" | "5个接口"       │
 * │                  │   向量用途：同步到向量库，支持按交付物检索        │
 * └──────────────────┴────────────────────────────────────────────────┘
 *
 * 【时间与期限】
 * ┌──────────────────┬────────────────────────────────────────────────┐
 * │ 自动生成         │ → task_duration_start: 任务开始时间（当前时间） │
 * │                  │   业务含义：任务创建/下达的时间                   │
 * │                  │   说明：通常是任务的立项时间                      │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: metadata    │ → task_duration_end: 任务结束时间（默认=当前）   │
 * │                  │   业务含义：任务预期完成时间（截止日期）          │
 * │                  │   默认值：创建时设为当前时间，后续根据指令更新     │
 * │                  │   示例：2026-01-17（"本周内"解析后）             │
 * │                  │   向量用途：同步到向量库，支持按期限检索          │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: metadata    │ → completed_at: 实际完成时间（任务完成时填写）   │
 * │                  │   业务含义：任务真正完成的时间                    │
 * │                  │   默认值：null（任务未完成）                     │
 * └──────────────────┴────────────────────────────────────────────────┘
 *
 * 【状态与优先级】
 * ┌──────────────────┬────────────────────────────────────────────────┐
 * │ API: priority    │ → task_priority: 任务优先级                      │
 * │                  │   业务含义：任务处理优先级                        │
 * │                  │   值域：'urgent'（高）| 'normal'（普通）          │
 * │                  │   默认值：'normal'                                │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: status      │ → task_status: 任务状态                         │
 * │                  │   业务含义：任务当前执行状态                      │
 * │                  │   值域：'pending'（待处理）| 'in_progress'（执行中）│
 * │                  │        'completed'（已完成）| 'failed'（失败）   │
 * │                  │   默认值：'pending'                               │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: status      │ → status: 旧状态字段（兼容旧版）                 │
 * │                  │   说明：保持向后兼容，新代码应使用 task_status    │
 * └──────────────────┴────────────────────────────────────────────────┘
 *
 * 【结果与输出】
 * ┌──────────────────┬────────────────────────────────────────────────┐
 * │ 任务执行完成时   │ → result: 执行结果（任务完成后填写）           │
 * │                  │   业务含义：Agent 执行任务后的结果输出           │
 * │                  │   默认值：null                                   │
 * │                  │   示例："系统架构已完成..."                      │
 * ├──────────────────┼────────────────────────────────────────────────┤
 * │ API: metadata    │ → metadata: 附加元数据（JSON 格式）             │
 * │                  │   业务含义：存储额外的任务信息                    │
 * │                  │   示例：{"conversationId": "...", "sessionId": "..."} │
 * └──────────────────┴────────────────────────────────────────────────┘
 *
 * 【审计字段】
 * ┌──────────────────┬────────────────────────────────────────────────┐
 * │ API: metadata    │ → remarks: 任务备注                            │
 * │                  │   业务含义：人工或系统添加的说明信息              │
 * │                  │   默认值：空字符串                               │
 * └──────────────────┴────────────────────────────────────────────────┘
 */
export const agentTasks = pgTable('agent_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),

  // === 工作空间归属 ===
  workspaceId: text('workspace_id'),

  // === 基础字段 ===
  taskId: text('task_id').notNull().unique(), // 任务ID，格式：master-A-to-B-20260210-001
  taskName: text('task_name').notNull(), // 任务名称
  coreCommand: text('core_command').notNull(), // 核心指令（向量库同步字段）
  executor: text('executor').notNull(), // 执行主体（向量库同步字段）
  
  // === 新增：验收相关 ===
  acceptanceCriteria: text('acceptance_criteria').notNull(), // 🔥 新增：验收标准（纯文本）
  taskType: text('task_type').notNull().default('master'), // 🔥 新增：任务类型（master=总任务）
  
  // === 新增：拆解相关 ===
  splitStatus: text('split_status').notNull().default('pending'), // 🔥 新增：拆解状态（pending/splitting/completed）
  splitStartTime: timestamp('split_start_time'), // 🔥 新增：拆解开始时间（用于超时兜底）
  rejectionReason: text('rejection_reason'), // 🔥 新增：拒绝理由
  
  // === 时间相关 ===
  taskDurationStart: timestamp('task_duration_start').notNull(), // 任务开始时间
  taskDurationEnd: timestamp('task_duration_end').notNull(), // 任务结束时间（向量库同步字段）
  
  // === 交付物 ===
  totalDeliverables: text('total_deliverables').notNull(), // 总交付物（向量库同步字段）
  
  // === 状态与优先级 ===
  taskPriority: text('task_priority').notNull().default('normal'), // 任务优先级：'urgent' | 'normal'
  taskStatus: text('task_status').notNull().default('pending'), // 任务状态：'pending'/'splitting'/'confirmed'/'in_progress'/'completed'/'failed'
  
  // === 审计字段 ===
  creator: text('creator').notNull(), // 创建人（人）
  updater: text('updater').notNull().default('TS'), // 更新人
  remarks: text('remarks'), // 备注
  
  // === 元数据 ===
  fromAgentId: text('from_agent_id').notNull(), // 发起 Agent ID
  toAgentId: text('to_agent_id').notNull(), // 接收 Agent ID（拆解方）
  commandType: text('command_type').notNull().default('instruction'),
  result: text('result'), // 执行结果
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  
  // === 用户观点与素材（新增）===
  userOpinion: text('user_opinion'), // 🔥 用户期望表达的核心观点
  materialIds: jsonb('material_ids').$type<string[]>().default([]), // 🔥 关联的素材ID列表
  
  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

/**
 * Agent 反馈表
 * 存储 Agent 对指令的异议、疑问和建议
 */
export const agentFeedbacks = pgTable('agent_feedbacks', {
  id: uuid('id').primaryKey().defaultRandom(),
  feedbackId: text('feedback_id').notNull().unique(),
  taskId: text('task_id').notNull(), // 关联的任务ID
  fromAgentId: text('from_agent_id').notNull(), // 反馈的Agent ID
  toAgentId: text('to_agent_id').notNull(), // 目标Agent ID（通常是A）
  originalCommand: text('original_command').notNull(), // 原始指令
  feedbackContent: text('feedback_content').notNull(), // 反馈内容
  feedbackType: text('feedback_type').notNull().default('question'), // question(疑问), objection(异议), suggestion(建议)
  status: text('status').notNull().default('pending'), // pending(待处理), processing(处理中), resolved(已解决), rejected(已驳回)
  resolution: text('resolution'), // 解决方案或处理结果
  resolvedCommand: text('resolved_command'), // 纠正后的指令
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});

/**
 * Agent 通知表
 * 存储 Agent 间通信的所有通知（指令、任务结果、反馈、系统通知）
 */
export const agentNotifications = pgTable('agent_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  notificationId: text('notification_id').notNull().unique(),
  fromAgentId: text('from_agent_id').notNull(), // 发送方Agent ID
  toAgentId: text('to_agent_id').notNull(), // 接收方Agent ID
  notificationType: text('notification_type').notNull(), // 'command' | 'result' | 'feedback' | 'system'
  title: text('title').notNull(), // 通知标题
  content: text('content').notNull(), // 通知内容（JSON格式字符串）
  relatedTaskId: text('related_task_id'), // 关联的任务ID
  status: text('status').notNull().default('unread'), // 'unread' | 'read' | 'processed'
  priority: text('priority').notNull().default('normal'), // 'low' | 'normal' | 'high' | 'urgent'
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}), // 额外元数据
  isRead: pgBoolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'), // 读取时间
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * 日工作任务表
 * 存储拆分后的每日工作任务及执行结果，与 agentTasks 强关联
 */
export const dailyTask = pgTable('daily_task', {
  id: uuid('id').primaryKey().defaultRandom(),

  // === 工作空间归属 ===
  workspaceId: text('workspace_id'),

  // === 关联字段 ===
  taskId: text('task_id').unique(), // 🔄 任务ID，格式：daily-task-{executor}-{date}-{seq}
  relatedTaskId: text('related_task_id').notNull(), // 关联总任务ID（外键关联 agentTasks.taskId）

  // === 任务内容 ===
  taskTitle: text('task_title').notNull(), // 🔄 任务标题
  taskDescription: text('task_description').notNull(), // 🔄 任务描述
  executor: text('executor').notNull(), // 执行主体
  taskPriority: text('task_priority').notNull().default('normal'), // 任务优先级：'urgent' | 'normal' | 'low'
  executionDate: date('execution_date').notNull(), // 🔄 执行日期（YYYY-MM-DD）
  executionDeadlineStart: timestamp('execution_deadline_start').notNull(), // 执行开始时间
  executionDeadlineEnd: timestamp('execution_deadline_end').notNull(), // 执行结束时间
  deliverables: text('deliverables').notNull(), // 交付物描述

  // === 状态 ===
  executionStatus: text('execution_status').notNull().default('new'), // 'new' | 'pending_review' | 'in_progress' | 'completed' | 'paused' | 'failed'
  statusProof: text('status_proof'), // 状态更新佐证（文本或附件路径）
  helpRecord: text('help_record'), // 求助记录（多行文本）
  auditOpinion: text('audit_opinion'), // 审核意见

  // === 审计字段 ===
  splitter: text('splitter').notNull().default('agent B'), // 拆分人
  entryUser: text('entry_user').notNull().default('TS'), // 录入人
  remarks: text('remarks'), // 备注

  // === 监控字段 ===
  lastTsCheckTime: timestamp('last_ts_check_time'), // 上次 TS 检查时间
  lastTSAwakeningTime: timestamp('last_ts_awakening_time'), // 上次 TS 唤起时间
  tsAwakeningCount: integer('ts_awakening_count').notNull().default(0), // TS 唤起次数
  lastInspectionTime: timestamp('last_inspection_time'), // 上次 Agent B 巡检时间
  lastConsultTime: timestamp('last_consult_time'), // 上次咨询时间
  awakeningCount: integer('awakening_count').notNull().default(0), // 总唤起次数

  // === 确认相关字段 ===
  taskType: text('task_type').notNull().default('daily'), // 任务类型（daily=每日任务）
  rejectionReason: text('rejection_reason'), // 拒绝理由

  // === 任务依赖 ===
  dependencies: jsonb('dependencies').$type<{after?: string[]; before?: string[]}>().default('{}'), // 任务依赖关系
  sortOrder: integer('sort_order').notNull().default(0), // 排序（考虑依赖）

  // === 元数据 ===
  fromAgentId: text('from_agent_id').notNull(), // 下发任务的 Agent ID
  toAgentId: text('to_agent_id').notNull(), // 接收任务的 Agent ID（通常是执行者）
  executionResult: text('execution_result'), // 执行结果描述
  outputData: jsonb('output_data').$type<Record<string, any>>().default({}), // 输出数据
  metrics: jsonb('metrics').$type<Record<string, any>>().default({}), // 指标数据
  attachments: jsonb('attachments').$type<Array<{name: string, url: string, type: string}>>().default([]), // 附件
  completedAt: timestamp('completed_at'), // 完成时间
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}), // 额外元数据

  // === 用户观点与素材（新增）===
  userOpinion: text('user_opinion'), // 🔥 用户期望表达的核心观点
  materialIds: jsonb('material_ids').$type<string[]>().default([]), // 🔥 关联的素材ID列表

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),

  // === 子任务管理相关字段 ===
  completedSubTasks: integer('completed_sub_tasks').notNull().default(0), // 当前进展到第几个子任务
  completedSubTasksDescription: text('completed_sub_tasks_description'), // 当前子任务描述
  subTaskCount: integer('sub_task_count').notNull().default(0), // 拆分的子任务总数
  splitStartTime: timestamp('split_start_time'), // 🔥 新增：开始拆解时间（用于处理超时或异常时才更新）
  questionStatus: text('question_status').notNull().default('none'), // 问题状态（none | pending | resolved）
  lastCheckedAt: timestamp('last_checked_at'), // 最后自检时间
  lastInspectedAt: timestamp('last_inspected_at'), // 最后巡检时间

  // === 对话相关字段 ===
  dialogueSessionId: text('dialogue_session_id'), // 对话会话 ID（关联 agentInteractions.sessionId）
  dialogueRounds: integer('dialogue_rounds').notNull().default(0), // 对话轮数
  dialogueStatus: text('dialogue_status').notNull().default('none'), // 对话状态（none | in_progress | completed | timeout）
  lastDialogueAt: timestamp('last_dialogue_at'), // 最后对话时间

  // === 报告管理字段 ===
  latestReportId: uuid('latest_report_id').references(() => agentReports.id), // 最新报告 ID（外键关联 agentReports）
  reportCount: integer('report_count').notNull().default(0), // 报告数量
  requiresIntervention: pgBoolean('requires_intervention').notNull().default(false), // 是否需要 Agent A 介入

  // === 兼容旧版字段（建议后续迁移后删除） ===
  commandId: text('command_id').unique(), // 兼容旧版：指令ID
  commandContent: text('command_content'), // 兼容旧版：指令内容
  commandPriority: text('command_priority'), // 兼容旧版：指令优先级
  taskName: text('task_name'), // 兼容旧版：任务名称
  triggerSource: text('trigger_source'), // 兼容旧版：触发方式
  retryStatus: text('retry_status'), // 兼容旧版：重试状态
  scenarioType: text('scenario_type'), // 兼容旧版：场景类型
});

/**
 * 拆解任务异常补偿表
 * 存储自动重试失败需要人工介入处理的拆解任务
 */
export const splitFailures = pgTable('split_failures', {
  id: uuid('id').primaryKey().defaultRandom(),
  failureId: text('failure_id').notNull().unique(), // 异常ID，格式：failure-{taskId}-{timestamp}
  
  // === 关联任务信息 ===
  taskId: text('task_id').notNull(), // 关联的原始任务ID（agentTasks.taskId）
  taskName: text('task_name').notNull(), // 任务名称
  coreCommand: text('core_command').notNull(), // 原始指令内容
  
  // === 失败信息 ===
  failureReason: text('failure_reason').notNull(), // 失败原因（最后一次错误）
  retryCount: integer('retry_count').notNull().default(0), // 重试次数
  agentBResponses: jsonb('agent_b_responses').$type<Array<{attempt: number, content: string, error: string, timestamp: string}>>().default([]), // Agent B 的所有响应记录
  
  // === 异常状态 ===
  exceptionStatus: text('exception_status').notNull().default('pending'), // 异常状态：pending=待处理, processing=处理中, resolved=已解决, cancelled=已取消
  exceptionPriority: text('exception_priority').notNull().default('normal'), // 异常优先级：urgent=紧急, high=高, normal=普通, low=低
  
  // === 人工处理信息 ===
  assignedTo: text('assigned_to'), // 处理人（Agent A 或人工操作员）
  assignedAt: timestamp('assigned_at'), // 分配时间
  manualSplitResult: jsonb('manual_split_result').$type<Record<string, any>>().default({}), // 手动输入的拆解结果
  processingNotes: text('processing_notes'), // 处理备注
  
  // === 处理记录 ===
  resolvedBy: text('resolved_by'), // 解决人
  resolvedAt: timestamp('resolved_at'), // 解决时间
  resolutionMethod: text('resolution_method'), // 解决方式：manual=手动输入, agent_assist=辅助对话, other=其他
  resolutionResult: jsonb('resolution_result').$type<{success: boolean, subTaskCount: number, dailyTask: any[]}>().default({}), // 解决结果
  
  // === 元数据 ===
  fromAgentId: text('from_agent_id').notNull(), // 发起方 Agent ID
  toAgentId: text('to_agent_id').notNull(), // 接收方 Agent ID（Agent B）
  conversationId: text('conversation_id'), // 对话会话ID（可用于查看对话历史）
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}), // 额外元数据
  
  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(), // 创建时间（失败时间）
  updatedAt: timestamp('updated_at').notNull().defaultNow(), // 更新时间
});

/**
 * Agent 子任务表
 * 存储 Agent 自己拆分的执行步骤
 */
export const agentSubTasks = pgTable('agent_sub_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // === 工作空间归属 ===
  workspaceId: text('workspace_id'),

  // === 关联字段 ===
  commandResultId: uuid('command_result_id').notNull().references(() => dailyTask.id, { onDelete: 'cascade' }),
  
  // === 子任务信息 ===
  fromParentsExecutor: text('from_parents_executor').notNull(), // 🔥 从父 daily_task 继承的 executor
  taskTitle: text('task_title').notNull(), // 子任务标题
  taskDescription: text('task_description'), // 子任务描述
  
  // === 执行状态 ===
  status: text('status').notNull().default('pending'), // 'pending' | 'in_progress' | 'completed' | 'blocked' | 'timeout' | 'escalated'
  orderIndex: integer('order_index').notNull(), // 执行顺序

  // === 分发相关 ===
  isDispatched: pgBoolean('is_dispatched').notNull().default(false), // 是否已分发
  dispatchedAt: timestamp('dispatched_at'), // 分发时间

  // === 超时处理相关 ===
  timeoutHandlingCount: integer('timeout_handling_count').notNull().default(0), // 超时处理次数（最多 5 次）
  feedbackHistory: jsonb('feedback_history').$type<Array<{
    feedbackTime: string;
    feedbackBy: string;
    feedbackContent: string;
    handledBy: string;
    handlingResult: string;
  }>>().default([]), // 反馈历史
  lastFeedbackAt: timestamp('last_feedback_at'), // 最后反馈时间

  // === 上报相关 ===
  escalated: pgBoolean('escalated').notNull().default(false), // 是否已上报
  escalatedAt: timestamp('escalated_at'), // 上报时间
  escalatedReason: text('escalated_reason'), // 上报原因（由 agent B 生成）

  // === 执行结果 ===
  resultData: jsonb('result_data'), // 执行结果（JSONB 格式，结构化数据）
  resultText: text('result_text'), // 执行结果（文本格式，供 Agent 使用）
  statusProof: text('status_proof'), // 状态证明（文本或附件路径）

  // === 时间信息 ===
  startedAt: timestamp('started_at'), // 开始时间
  completedAt: timestamp('completed_at'), // 完成时间

  // === 新增：对话相关字段 ===
  dialogueSessionId: text('dialogue_session_id'), // 🆕 对话会话 ID（关联 agentInteractions.sessionId）
  dialogueRounds: integer('dialogue_rounds').notNull().default(0), // 🆕 对话轮数
  dialogueStatus: text('dialogue_status').notNull().default('none'), // 🆕 对话状态（none | in_progress | completed | timeout）
  lastDialogueAt: timestamp('last_dialogue_at'), // 🆕 最后对话时间

  // === 新增：任务执行与元数据 ===
  executionDate: date('execution_date'), // 🔥 新增：执行日期（用于定时任务调度）

  // === 元数据 ===
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}), // 额外元数据
  
  // === 文章元数据 ===
  articleMetadata: jsonb('article_metadata').$type<ArticleMetadata | null>(), // 🔥 新增：文章元数据（JSON格式，存储文章相关信息）

  // === 用户观点与素材（新增）===
  userOpinion: text('user_opinion'), // 🔥 用户期望表达的核心观点（从主任务继承）
  materialIds: jsonb('material_ids').$type<string[]>().default([]), // 🔥 关联的素材ID列表（从主任务继承）
  relatedMaterials: text('related_materials'), // 🔥 关联素材补充区内容（软参考，灵活整合）

  // === 结构选择（新增）===
  structureName: text('structure_name'), // 🔥 选择的文章结构名称
  structureDetail: text('structure_detail'), // 🔥 文章结构详情（JSON字符串）

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    // 索引：command_result_id（用于关联查询）
    idxCommandResultId: index('idx_agent_sub_tasks_command_result_id').on(table.commandResultId),
    // 索引：from_parents_executor + execution_date（用于定时任务查询）
    idxExecutorDate: index('idx_agent_sub_tasks_executor_date').on(table.fromParentsExecutor, table.executionDate),
    // 索引：status（用于状态筛选）
    idxStatus: index('idx_agent_sub_tasks_status').on(table.status),
  };
});

/**
 * Agent 交互记录表
 * 存储 Agent 之间的对话和沟通记录
 */
export const agentInteractions = pgTable('agent_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // === 关联信息 ===
  commandResultId: uuid('command_result_id').notNull().references(() => dailyTask.id, { onDelete: 'cascade' }),
  taskDescription: text('task_description'), // 任务描述（冗余字段，方便查询）
  sessionId: text('session_id').notNull(), // 会话 ID（用于关联一组对话）
  
  // === 消息信息 ===
  sender: text('sender').notNull(), // 发送方：'A' | 'B' | 'C' | 'D' | 'insurance-c' | 'insurance-d' | 'system'
  receiver: text('receiver'), // 接收方（可选，可能是一对多）
  messageType: text('message_type').notNull(), // 消息类型：'question' | 'answer' | 'notification' | 'escalation'
  content: text('content').notNull(), // 消息内容
  
  // === 会话信息 ===
  roundNumber: integer('round_number'), // 第几轮沟通（从 1 开始）
  isResolution: pgBoolean('is_resolution').notNull().default(false), // 是否为解决消息（包含"OK""没问题"等关键字）

  // === 新增：理解判断字段 ===
  isUnderstand: pgBoolean('is_understand').notNull().default(false), // 🆕 执行 Agent 是否理解任务

  // === 时间信息 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),

  // === 元数据 ===
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}), // 额外元数据
});

/**
 * Agent 上报报告表
 * 存储 Agent B 上报给 Agent A 的报告
 */
export const agentReports = pgTable('agent_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportType: text('report_type').notNull(), // 报告类型：'subtask_timeout' | 'task_timeout'

  // === 关联字段 ===
  commandResultId: uuid('command_result_id').notNull().references(() => dailyTask.id, { onDelete: 'cascade' }),
  subTaskId: uuid('sub_task_id').references(() => agentSubTasks.id, { onDelete: 'cascade' }),

  // === 报告内容 ===
  summary: text('summary').notNull(), // 总结信息
  conclusion: text('conclusion').notNull(), // 结论
  dialogueProcess: jsonb('dialogue_process').notNull().$type<DialogueProcessEntry[]>(), // 对话过程信息
  suggestedActions: jsonb('suggested_actions').notNull().$type<SuggestedAction[]>(), // 建议的后续行动

  // === 上报信息 ===
  reportedTo: text('reported_to').notNull(), // 上报对象：'agent_a'
  reportedFrom: text('reported_from').notNull(), // 上报人：'agent_b'

  // === 状态管理字段 ===
  status: text('status').notNull().default('pending'), // 报告状态：'pending' | 'reviewed' | 'processing' | 'processed' | 'dismissed'
  reviewedBy: text('reviewed_by'), // 审核人
  reviewedAt: timestamp('reviewed_at'), // 审核时间
  processedBy: text('processed_by'), // 处理人
  processedAt: timestamp('processed_at'), // 处理时间
  processedActions: jsonb('processed_actions').$type<ProcessedAction[]>().default([]), // 实际执行的行动
  dismissedReason: text('dismissed_reason'), // 驳回原因
  relatedTaskId: text('related_task_id'), // 关联的任务 ID（外键关联 agentTasks.taskId）

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * MCP 能力清单表
 * 
 * 存储可用的 MCP 能力解决方案清单
 * 用于 Agent B 查询能力匹配和解决方案选型
 */
export const capabilityList = pgTable('capability_list', {
  /**
   * 主键 ID（序号）
   */
  id: serial('id').primaryKey(),

  /**
   * 能力类型
   * 关联 capability_type 枚举值
   */
  capabilityType: text('capability_type').notNull(),

  /**
   * 功能描述
   */
  functionDesc: text('function_desc').notNull(),

  /**
   * 状态
   * available: 可用
   * unavailable: 不可用
   */
  status: text('status').notNull().default('available'),

  /**
   * 是否需要现场执行
   * true: 需要现场执行
   * false: 无需现场执行
   */
  requiresOnSiteExecution: pgBoolean('requires_on_site_execution').notNull().default(false),

  /**
   * 元数据
   */
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),

  /**
   * 创建时间
   */
  createdAt: timestamp('created_at').notNull().defaultNow(),

  /**
   * 更新时间
   */
  updatedAt: timestamp('updated_at').notNull().defaultNow(),

  // 新增字段：接口定义信息（供 Agent B 分析）
  interfaceSchema: jsonb('interface_schema'), // 接口 Schema（JSON Schema 格式）

  /**
   * Agent B 返回格式规范
   * 存储每个 MCP 接口专属的 Agent B 返回格式规范
   */
  agentResponseSpec: jsonb('agent_response_spec').$type<Record<string, any>>().default({}),
  toolName: text('tool_name'), // 工具名称（search/wechat/data_acquire 等）
  actionName: text('action_name'), // 动作名称（webSearch/addDraft 等）
  paramDesc: jsonb('param_desc'), // 🆕 新增：参数含义说明（自然语言描述，给 Agent B 看）
  paramExamples: jsonb('param_examples'), // 参数示例（保留兼容）
  paramTemplate: jsonb('param_template'), // 参数模板（保留兼容）
  sceneTags: text('scene_tags').array(), // 适用场景标签数组
  exampleOutput: jsonb('example_output'), // 🆕 新增：输出样例（给 Agent B 参考的完整输出样例）
  supportedAgents: text('supported_agents').array(), // 🆕 新增：支持该能力的Agent列表
  agentSpecificParams: jsonb('agent_specific_params').default({}), // 🆕 新增：Agent专属参数配置
  
  // 🔴 🔴 🔴 新增：专用任务类型绑定字段（优化版设计）
  /**
   * 🔴 专用任务类型
   * 标准化枚举值，避免自由文本的不稳定性
   * 示例：
   * - "compliance_audit" - 合规审核专用
   * - "web_search" - 网页搜索专用
   * - "wechat_publish" - 微信发布专用
   * - "data_acquire" - 数据获取专用
   * - null - 通用能力（可用于任何任务）
   */
  dedicatedTaskType: text('dedicated_task_type'), // 🆕 专用任务类型（标准化枚举）
  
  /**
   * 🔴 专用任务类型优先级
   * 同一 dedicated_task_type 下，数字越小优先级越高
   * 例如：两个合规审核能力，priority=1 的优先于 priority=2 的
   */
  dedicatedTaskPriority: integer('dedicated_task_priority').default(999), // 🆕 专用任务优先级
  
  /**
   * 🔴 是否为该任务类型的首选能力
   * 方便快速查询：直接查 is_primary = true 就能拿到首选能力
   */
  isPrimaryForTask: pgBoolean('is_primary_for_task').notNull().default(false), // 🆕 是否为首选能力
});

/**
 * Agent 能力配置表
 * 存储各执行Agent的固有能力、MCP偏好、自动判定规则等
 * 用于实现Agent B智能化能力的通用化配置
 */
export const agentCapabilities = pgTable('agent_capabilities', {
  /**
   * 主键 ID
   */
  id: serial('id').primaryKey(),
  
  /**
   * Agent 唯一标识
   * 如：insurance-d、insurance-c、agent-c、agent-d 等
   */
  agentId: text('agent_id').notNull().unique(),
  
  /**
   * Agent 显示名称
   */
  agentName: text('agent_name').notNull(),
  
  /**
   * Agent 描述
   */
  description: text('description'),
  
  /**
   * 固有能力列表（不需要MCP的能力）
   * 示例：["article_writing", "content_planning", "data_analysis"]
   */
  nativeCapabilities: jsonb('native_capabilities').$type<string[]>().default([]),
  
  /**
   * 常用MCP能力（按优先级排序）
   * 示例：[{"capability_type": "wechat_upload", "priority": 1}]
   */
  preferredMcpCapabilities: jsonb('preferred_mcp_capabilities')
    .$type<Array<{ capabilityType: string; priority: number }>>()
    .default([]),
  
  /**
   * 自动判定规则（用于能力边界判定）
   */
  autoJudgeRules: jsonb('auto_judge_rules').$type<AutoJudgeRule[]>().default([]),
  
  /**
   * 默认账号ID（用于MCP调用）
   */
  defaultAccountId: text('default_account_id'),
  
  /**
   * 是否启用
   */
  isActive: pgBoolean('is_active').notNull().default(true),
  
  /**
   * 创建时间
   */
  createdAt: timestamp('created_at').notNull().defaultNow(),
  
  /**
   * 更新时间
   */
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * 自动判定规则类型定义
 */
export interface AutoJudgeRule {
  ruleId: string;
  ruleName: string;
  keywords: string[];           // 匹配关键词
  matchMode: 'any' | 'all' | 'regex';  // 匹配模式
  action: 'native_complete' | 'need_mcp' | 'need_user';
  suggestedCapabilityType?: string;  // 建议的MCP能力类型
  problemTemplate?: string;     // 问题描述模板
  confidence: number;           // 置信度阈值 0-1
  priority: number;             // 规则优先级
}

/**
 * 存储保险行业发布规则、MCP调用规则等
 */
export const domainRule = pgTable('domain_rule', {
  id: serial('id').primaryKey(),
  ruleType: text('rule_type').notNull(), // 'sensitive_word' | 'token_rule' | 'publish_rule' | 'mcp_best_practice'
  ruleContent: jsonb('rule_content').$type<Record<string, any>>().notNull(), // 规则内容（JSON格式）
  scene: text('scene'), // 适用场景：'wechat_public' | 'web_search' | 'data_acquire' | 'all'
  description: text('description'), // 规则描述
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * 领域案例库
 * 存储成功/失败案例，供智能体学习
 */
export const domainCase = pgTable('domain_case', {
  id: serial('id').primaryKey(),
  taskContent: text('task_content').notNull(), // 任务内容描述
  capabilityType: text('capability_type').notNull(), // 能力类型
  solutionNum: integer('solution_num'), // 对应 capability_list.id
  params: jsonb('params').$type<Record<string, any>>(), // MCP调用参数
  result: jsonb('result').$type<Record<string, any>>(), // 执行结果
  isSuccess: pgBoolean('is_success').notNull(), // 是否成功
  failureReason: text('failure_reason'), // 失败原因
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * 领域术语库
 * 存储保险行业专属词汇、MCP能力专属术语
 */
export const domainTerminology = pgTable('domain_terminology', {
  id: serial('id').primaryKey(),
  term: text('term').notNull(), // 术语
  explanation: text('explanation').notNull(), // 解释说明
  scene: text('scene'), // 适用场景
  category: text('category'), // 分类：'insurance' | 'mcp'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Agent 开发原则表
 * 存储 Agent 开发过程中的核心原则、约束和经验总结
 */
export const agentDevPrinciples = pgTable('agent_dev_principles', {
  id: uuid('id').primaryKey().defaultRandom(),
  insightCategory: text('insight_category').notNull(), // 心得分类：'prompt_design' | 'architecture' | 'data_flow' | 'task_management'
  insightTitle: text('insight_title').notNull(), // 心得标题
  problemScenario: text('problem_scenario').notNull(), // 问题场景
  solutionApproach: text('solution_approach').notNull(), // 解决方案
  principles: text('principles').notNull(), // 原则描述

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    // 🔥 唯一约束：同一个任务的同一个顺序只能有一个子任务
    uniqueTaskOrder: unique('unique_task_order').on(
      table.commandResultId, 
      table.orderIndex
    ),
  };
});

// === 类型定义 ===
export interface DialogueProcessEntry {
  round: number;
  sender: string;
  content: string;
  isUnderstand: boolean;
  timestamp: string;
}

export interface SuggestedAction {
  action: string; // 'reassign_task' | 'adjust_resources' | 'escalate' | 'dismiss'
  description: string;
  targetAgentId?: string;
  resources?: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface ProcessedAction {
  action: string;
  result: 'success' | 'failed' | 'skipped';
  targetAgentId?: string;
  resources?: string[];
  taskId?: string;
  resourceIds?: string[];
  error?: string;
}

/**
 * 导出类型
 */
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type AgentMemory = typeof agentMemories.$inferSelect;
export type NewAgentMemory = typeof agentMemories.$inferInsert;
export type AgentTask = typeof agentTasks.$inferSelect;
export type NewAgentTask = typeof agentTasks.$inferInsert;
export type AgentFeedback = typeof agentFeedbacks.$inferSelect;
export type NewAgentFeedback = typeof agentFeedbacks.$inferInsert;
export type AgentNotification = typeof agentNotifications.$inferSelect;
export type NewAgentNotification = typeof agentNotifications.$inferInsert;
export type ArticleContent = typeof articleContent.$inferSelect;
export type NewArticleContent = typeof articleContent.$inferInsert;

/**
 * 文章内容表
 * 
 * 存储保险科普文章的完整内容，关联创作任务和公众号发布信息
 */
export const articleContent = pgTable('article_content', {
  /**
   * 文章唯一标识（ART+日期+序号，如ART20260224001）
   */
  articleId: text('article_id').primaryKey(),
  
  /**
   * 关联agent_sub_tasks的command_result_id，溯源创作任务
   */
  taskId: text('task_id').notNull(),
  
  /**
   * 🔥 多平台发布：关联agent_sub_tasks的子任务ID，区分同一任务不同平台版本
   */
  subTaskId: text('sub_task_id'),
  
  /**
   * 创作Agent：insurance-d/insurance-c
   */
  creatorAgent: text('creator_agent').notNull(),
  
  /**
   * 文章标题（最终版）
   */
  articleTitle: text('article_title').notNull(),
  
  /**
   * 文章副标题（可选）
   */
  articleSubtitle: text('article_subtitle').default(''),
  
  /**
   * 文章完整正文（纯文本/HTML，根据业务选择）
   */
  articleContent: text('article_content').notNull(),
  
  /**
   * 核心关键词数组，如["年金险","增额寿"]
   */
  coreKeywords: jsonb('core_keywords').default([]),
  
  /**
   * 文章创建时间
   */
  createTime: timestamp('create_time').notNull().defaultNow(),
  
  /**
   * 文章最后更新时间
   */
  updateTime: timestamp('update_time').notNull().defaultNow(),
  
  /**
   * 文章版本号（修改一次+1）
   */
  version: integer('version').notNull().default(1),
  
  /**
   * 内容状态：draft(草稿)/review(待审核)/published(已发布)/rejected(审核驳回)
   */
  contentStatus: text('content_status').notNull().default('draft'),
  
  /**
   * 审核驳回原因（仅content_status=rejected时填充）
   */
  rejectReason: text('reject_reason').default(''),
  
  /**
   * 公众号发布后的文章链接
   */
  wechatMpUrl: text('wechat_mp_url').default(''),
  
  /**
   * 公众号发布时间
   */
  wechatMpPublishTime: timestamp('wechat_mp_publish_time'),
  
  /**
   * 扩展信息（如字数、分段结构、配图ID等）
   */
  extInfo: jsonb('ext_info').default({}),
}, (table) => {
  return {
    // 索引：task_id
    idxTaskId: index('idx_article_content_task_id').on(table.taskId),
    // 🔥 多平台发布：索引 sub_task_id（区分同任务不同平台版本）
    idxSubTaskId: index('idx_article_content_sub_task_id').on(table.subTaskId),
    // 索引：creator_agent + content_status
    idxCreatorStatus: index('idx_article_content_creator_status').on(table.creatorAgent, table.contentStatus),
    // 索引：core_keywords (GIN)
    idxKeywords: index('idx_article_content_keywords').using('gin', table.coreKeywords),
    // 索引：wechat_mp_publish_time
    idxPublishTime: index('idx_article_content_publish_time').on(table.wechatMpPublishTime),
  };
});

/**
 * 文章审核记录表
 * 
 * 存储文章的每次审核记录，支持多轮审核
 */
export const articleReviewRecords = pgTable('article_review_records', {
  /**
   * 审核记录唯一标识
   */
  reviewId: text('review_id').primaryKey(),
  
  /**
   * 关联的文章ID
   */
  articleId: text('article_id').notNull(),
  
  /**
   * 审核轮次（第1轮、第2轮...）
   */
  reviewRound: integer('review_round').notNull().default(1),
  
  /**
   * 审核类型：automated(自动审核)/manual(人工审核)
   */
  reviewType: text('review_type').notNull().default('automated'),
  
  /**
   * 审核人：system(系统)/insurance-c/insurance-d/agent-a/human
   */
  reviewer: text('reviewer').notNull(),
  
  /**
   * 审核状态：pending(待审核)/reviewing(审核中)/completed(已完成)
   */
  reviewStatus: text('review_status').notNull().default('pending'),
  
  /**
   * 审核结果：approved(通过)/rejected(驳回)/needs_revision(需修改)
   */
  reviewResult: text('review_result'),
  
  /**
   * 审核总结（整体评价）
   */
  reviewSummary: text('review_summary'),
  
  /**
   * 合规性评分（0-100分）
   */
  complianceScore: integer('compliance_score'),
  
  /**
   * 审核开始时间
   */
  startTime: timestamp('start_time').notNull().defaultNow(),
  
  /**
   * 审核完成时间
   */
  endTime: timestamp('end_time'),
  
  /**
   * 审核耗时（秒）
   */
  durationSeconds: integer('duration_seconds'),
  
  /**
   * 扩展信息（审核工具版本、规则版本等）
   */
  extInfo: jsonb('ext_info').default({}),
  
  /**
   * 创建时间
   */
  createdAt: timestamp('created_at').notNull().defaultNow(),
  
  /**
   * 更新时间
   */
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    // 索引：article_id
    idxArticleId: index('idx_article_review_article_id').on(table.articleId),
    // 索引：review_status
    idxReviewStatus: index('idx_article_review_status').on(table.reviewStatus),
    // 索引：reviewer + review_result
    idxReviewerResult: index('idx_article_review_reviewer_result').on(table.reviewer, table.reviewResult),
  };
});

/**
 * 文章审核意见表
 * 
 * 存储具体的不合规意见，支持逐段、逐句的详细反馈
 */
export const articleReviewComments = pgTable('article_review_comments', {
  /**
   * 意见ID
   */
  commentId: text('comment_id').primaryKey(),
  
  /**
   * 关联的审核记录ID
   */
  reviewId: text('review_id').notNull(),
  
  /**
   * 关联的文章ID
   */
  articleId: text('article_id').notNull(),
  
  /**
   * 意见类型：
   * - compliance(合规问题)
   * - content(内容问题)
   * - structure(结构问题)
   * - style(风格问题)
   * - other(其他)
   */
  commentType: text('comment_type').notNull().default('compliance'),
  
  /**
   * 严重程度：critical(严重)/high(高)/medium(中)/low(低)/suggestion(建议)
   */
  severity: text('severity').notNull().default('medium'),
  
  /**
   * 违规规则ID（关联合规规则库）
   */
  ruleId: text('rule_id'),
  
  /**
   * 违规规则名称
   */
  ruleName: text('rule_name'),
  
  /**
   * 问题位置：段落编号（从1开始）
   */
  paragraphIndex: integer('paragraph_index'),
  
  /**
   * 问题位置：起始字符位置
   */
  startPosition: integer('start_position'),
  
  /**
   * 问题位置：结束字符位置
   */
  endPosition: integer('end_position'),
  
  /**
   * 有问题的原文内容
   */
  problematicContent: text('problematic_content'),
  
  /**
   * 问题描述
   */
  issueDescription: text('issue_description').notNull(),
  
  /**
   * 修改建议
   */
  suggestion: text('suggestion'),
  
  /**
   * 修改示例
   */
  suggestedContent: text('suggested_content'),
  
  /**
   * 法规依据
   */
  legalBasis: text('legal_basis'),
  
  /**
   * 处理状态：pending(待处理)/fixed(已修正)/dismissed(已忽略)
   */
  fixStatus: text('fix_status').notNull().default('pending'),
  
  /**
   * 实际修改内容
   */
  actualFix: text('actual_fix'),
  
  /**
   * 修改时间
   */
  fixedAt: timestamp('fixed_at'),
  
  /**
   * 扩展信息
   */
  extInfo: jsonb('ext_info').default({}),
  
  /**
   * 创建时间
   */
  createdAt: timestamp('created_at').notNull().defaultNow(),
  
  /**
   * 更新时间
   */
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    // 索引：review_id
    idxReviewId: index('idx_article_comment_review_id').on(table.reviewId),
    // 索引：article_id
    idxArticleId: index('idx_article_comment_article_id').on(table.articleId),
    // 索引：severity + fix_status
    idxSeverityStatus: index('idx_article_comment_severity_status').on(table.severity, table.fixStatus),
    // 索引：comment_type
    idxCommentType: index('idx_article_comment_type').on(table.commentType),
  };
});

// 导出类型
export type ArticleReviewRecord = typeof articleReviewRecords.$inferSelect;
export type NewArticleReviewRecord = typeof articleReviewRecords.$inferInsert;
export type ArticleReviewComment = typeof articleReviewComments.$inferSelect;
export type NewArticleReviewComment = typeof articleReviewComments.$inferInsert;

/**
 * Agent 子任务步骤交互历史表
 * 
 * 存储 agent_sub_tasks 每一步执行的交互过程（含 insurance-d 与 agent B/人工的沟通、问题咨询、执行结果）
 */
export const agentSubTasksStepHistory = pgTable('agent_sub_tasks_step_history', {
  /**
   * 主键 ID
   */
  id: serial('id').primaryKey(),
  
  /**
   * 关联 agent_sub_tasks 表的 command_result_id
   */
  commandResultId: uuid('command_result_id').notNull(),
  
  /**
   * 步骤编号（对应 agent_sub_tasks.order_index）
   */
  stepNo: integer('step_no').notNull(),
  
  /**
   * 交互类型（request/response）
   * request：请求（如 insurance-d 向 agent B 咨询）
   * response：响应（如 agent B 回应、MCP执行结果分析等）
   */
  interactType: text('interact_type').notNull(),
  
  /**
   * 结构化交互内容（JSONB）
   * 含交互类型、问题描述、响应内容、处理结果等
   */
  interactContent: jsonb('interact_content')
    .notNull(),
  
  /**
   * 交互发起方
   * insurance-d（咨询方）/agent B（响应方）/human（人工响应方）
   * 
   * human场景：agent B无法解决，系统不存在可以提供的MCP服务，需要human处理的时候
   */
  interactUser: text('interact_user').notNull(),
  
  /**
   * 交互发生时间
   */
  interactTime: timestamp('interact_time')
    .notNull()
    .defaultNow(),
  
  /**
   * 同 command_result_id + step_no 下的交流次数（从1开始递增）
   * request + response 共用同一个 interact_num
   */
  interactNum: integer('interact_num')
    .notNull()
    .default(1),
}, (table) => {
  return {
    /**
     * 唯一约束：command_result_id + step_no + interact_num + interact_type + interact_user
     * 保证同一次交互的 request 和 response 可以成对存在
     */
    uniqueCommandResultStepNo: unique('idx_task_step_num_type_user')
      .on(table.commandResultId, table.stepNo, table.interactNum, table.interactType, table.interactUser),
    
    // 索引：command_result_id（用于关联查询）
    idxCommandResultId: index('idx_step_history_command_result_id').on(table.commandResultId),
    
    // 索引：interact_time（用于时间排序）
    idxInteractTime: index('idx_step_history_interact_time').on(table.interactTime),
  };
});


/**
 * 
 * 存储Agent A的待办任务，用于处理Agent B上报的问题
 * 
 * @docs /docs/详细设计文档agent智能交互MCP能力设计capability_type.md
 */
export const agentATodos = pgTable('agent_a_todos', {
  /**
   * 主键 ID
   */
  id: uuid('id').primaryKey().defaultRandom(),
  
  /**
   * 关联的子任务ID（agent_sub_tasks.id）
   */
  subTaskId: uuid('sub_task_id')
    .notNull()
    .references(() => agentSubTasks.id, { onDelete: 'cascade' }),
  
  /**
   * 任务标题（冗余，方便列表展示）
   */
  taskTitle: text('task_title').notNull(),
  
  /**
   * 执行Agent反馈的问题描述
   */
  problemDescription: text('problem_description').notNull(),
  
  /**
   * 问题历史记录（可选，JSON数组）
   */
  problemHistory: jsonb('problem_history')
    .$type<Array<Record<string, any>>>()
    .default([]),
  
  /**
   * 执行Agent ID（insurance-d等）
   */
  executorAgentId: text('executor_agent_id').notNull(),
  
  /**
   * Agent A输入的解决方案
   */
  solutionContent: text('solution_content'),
  
  /**
   * 状态（pending/processing/completed/cancelled）
   */
  status: text('status').notNull().default('pending'),
  
  /**
   * 创建者（通常是 'agent_b'）
   */
  createdBy: text('created_by').notNull(),
  
  /**
   * 处理者（Agent A的用户ID）
   */
  processedBy: text('processed_by'),
  
  /**
   * 创建时间
   */
  createdAt: timestamp('created_at').notNull().defaultNow(),
  
  /**
   * 处理时间
   */
  processedAt: timestamp('processed_at'),
  
  /**
   * 完成时间
   */
  completedAt: timestamp('completed_at'),
});

/**
 * Agent 子任务步骤交互历史表类型
 */
export type AgentSubTasksStepHistory = typeof agentSubTasksStepHistory.$inferSelect;

/**
 * Agent 子任务步骤交互历史表插入类型
 */
export type AgentSubTasksStepHistoryInsert = typeof agentSubTasksStepHistory.$inferInsert;


export type NewCommandResult = typeof dailyTask.$inferInsert;
export type SplitFailure = typeof splitFailures.$inferSelect;
export type NewSplitFailure = typeof splitFailures.$inferInsert;
export type AgentSubTask = typeof agentSubTasks.$inferSelect;
export type NewAgentSubTask = typeof agentSubTasks.$inferInsert;
export type AgentInteraction = typeof agentInteractions.$inferSelect;
export type NewAgentInteraction = typeof agentInteractions.$inferInsert;
export type AgentReport = typeof agentReports.$inferSelect;
export type NewAgentReport = typeof agentReports.$inferInsert;
export type CapabilityList = typeof capabilityList.$inferSelect;
export type NewCapabilityList = typeof capabilityList.$inferInsert;

/**
 * Agent 能力配置表类型
 */
export type AgentCapabilities = typeof agentCapabilities.$inferSelect;
export type NewAgentCapabilities = typeof agentCapabilities.$inferInsert;
export type AgentATodo = typeof agentATodos.$inferSelect;
export type NewAgentATodo = typeof agentATodos.$inferInsert;
export type AgentDevPrinciple = typeof agentDevPrinciples.$inferSelect;
export type NewAgentDevPrinciple = typeof agentDevPrinciples.$inferInsert;

// 领域知识库类型
export type DomainRule = typeof domainRule.$inferSelect;
export type NewDomainRule = typeof domainRule.$inferInsert;
export type DomainCase = typeof domainCase.$inferSelect;
export type NewDomainCase = typeof domainCase.$inferInsert;
export type DomainTerminology = typeof domainTerminology.$inferSelect;
export type NewDomainTerminology = typeof domainTerminology.$inferInsert;

// 导出类型
export type AgentSubTasksStepHistory = typeof agentSubTasksStepHistory.$inferSelect;
export type NewAgentSubTasksStepHistory = typeof agentSubTasksStepHistory.$inferInsert;

// MCP 执行记录表
export * from './schema/agent-sub-tasks-mcp-executions';

// 样式模板表
export * from '../../lib/template/schema';

// 素材库表
export * from './schema/material-library';

// 文章哈希表（去重检测）
export * from './schema/article-hashes';

// 小红书卡片图片表
export * from './schema/xhs-cards';

// 行业案例库表
export * from './schema/industry-case-library';
