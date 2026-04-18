/**
 * 统一的通知类型定义
 * 
 * ⚠️⚠️⚠️ 重要说明：请阅读 docs/notification-system-design.md 文档！⚠️⚠️⚠️
 * 
 * 说明：
 * - 所有通知类型使用相同的数据结构
 * - fromAgentId、toAgentId 统一从数据库顶层字段获取
 * - 类型特定的数据放在 content 字段中
 * 
 * 🔥 创建新通知时，请遵循以下规范：
 * - 所有拆解结果统一用 type: 'task_result'
 * - 通过标记区分：isInsuranceDSplit、isAgentBSplit、isInsuranceCSplit
 * - 禁止使用：type: 'insurance_d_split_result' 等单独类型
 * - 禁止从 content.fromAgentId 获取，必须从顶层 fromAgentId 获取
 */

// 🔥 Agent ID 类型定义
export type AgentId = 'A' | 'B' | 'C' | 'D' | 'insurance-c' | 'insurance-d';

// 🔥 通知类型枚举
export enum NotificationType {
  NEW_COMMAND = 'new_command',
  TASK_RESULT = 'task_result',
  INSURANCE_D_SPLIT_RESULT = 'insurance_d_split_result',
  AGENT_B_SPLIT_RESULT = 'agent_b_split_result',
  INSURANCE_C_SPLIT_RESULT = 'insurance_c_split_result', // 预留
  SYSTEM_NOTIFICATION = 'system_notification',
}

// 🔥 通知内容接口（按类型区分）
export interface NotificationContent {
  // 通用字段（冗余，建议优先使用顶层字段）
  fromAgentId?: AgentId;
  toAgentId?: AgentId;
  
  // task_result / insurance_d_split_result / agent_b_split_result
  result?: any;
  status?: string;
  isInsuranceDSplit?: boolean;
  isAgentBSplit?: boolean;
  isInsuranceCSplit?: boolean; // 预留
  
  // new_command
  command?: string;
  commandType?: string;
  priority?: string;
  
  // system_notification
  message?: string;
  
  // 其他自定义字段
  [key: string]: any;
}

// 🔥 核心：统一的通知接口
export interface UnifiedNotification {
  // === 基础字段（所有类型都必须有）===
  type: NotificationType;
  notificationId: string;
  timestamp: Date;
  isRead: boolean;
  
  // === 身份字段（所有类型都必须有）===
  fromAgentId: AgentId; // 🔥 从数据库顶层字段获取
  toAgentId: AgentId;   // 🔥 从数据库顶层字段获取
  
  // === 关联字段（所有类型都必须有）===
  taskId?: string;
  relatedTaskId?: string;
  
  // === 内容字段（所有类型都必须有）===
  content: NotificationContent; // 🔥 类型特定的数据
  
  // === 元数据（所有类型都必须有）===
  metadata: Record<string, any>;
  
  // === 类型特定字段（可选，方便前端访问）===
  // task_result / insurance_d_split_result / agent_b_split_result
  result?: any;
  status?: string;
  
  // new_command
  command?: string;
  commandType?: string;
  priority?: string;
  
  // system_notification
  message?: string;
}

// 🔥 数据库通知类型（用于类型安全）
export interface DbNotification {
  id: string;
  notificationId: string;
  fromAgentId: string;
  toAgentId: string;
  notificationType: 'command' | 'result' | 'feedback' | 'system';
  title: string;
  content: string;
  relatedTaskId?: string | null;
  status: string;
  priority: string;
  metadata: Record<string, any>;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
}
