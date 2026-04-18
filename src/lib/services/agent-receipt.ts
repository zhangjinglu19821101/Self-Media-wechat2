/**
 * Agent 回执和状态反馈服务
 * 提供标准化的回执和状态反馈格式生成功能
 */

export interface TaskReceiptParams {
  taskId?: string;
  status: 'success' | 'failed';
  preparation?: string;
  failureReason?: string;
}

export interface TaskStatusFeedbackParams {
  taskId: string;
  taskName: string;
  receivedTime: string;
  executionStatus: 'not-started' | 'in-progress' | 'completed' | 'paused';
  executionStatusReason?: string; // 暂停原因
  progress: string; // 核心完成进度
  completedNodes: string[]; // 已完成核心节点
  pendingItems: string[]; // 待办核心事项
  issues: string; // 当前问题/异常
}

/**
 * 生成指令接收回执
 * 格式：严格按照提示词要求的固定格式
 */
export function generateTaskReceipt(params: TaskReceiptParams): string {
  const taskId = params.taskId || '无';
  const status = params.status === 'success' ? '成功' : '失败';
  const preparation = params.status === 'success'
    ? '已明确核心要求，进入执行阶段'
    : (params.preparation || '需补充核心信息');

  const failureReason = params.status === 'failed' && params.failureReason
    ? `（失败原因：${params.failureReason}）`
    : '';

  return `任务ID：【${taskId}】
指令接收状态：【${status}${failureReason}】
执行准备：【${preparation}】`;
}

/**
 * 生成任务状态反馈
 * 格式：严格按照提示词要求的固定格式
 */
export function generateTaskStatusFeedback(params: TaskStatusFeedbackParams): string {
  const executionStatusMap: Record<string, string> = {
    'not-started': '未开始',
    'in-progress': '执行中',
    'completed': '已完成',
    'paused': '暂停',
  };

  let executionStatus = executionStatusMap[params.executionStatus] || '执行中';
  if (params.executionStatus === 'paused' && params.executionStatusReason) {
    executionStatus += `（${params.executionStatusReason}）`;
  }

  const completedNodes = params.completedNodes.length > 0
    ? params.completedNodes.join('、')
    : '无';

  const pendingItems = params.pendingItems.length > 0
    ? params.pendingItems.join('、')
    : '无';

  const issues = params.issues || '无';

  return `任务基础信息：任务ID【${params.taskId}】、任务名称【${params.taskName}】、接收时间【${params.receivedTime}】
当前执行状态：【${executionStatus}】
核心完成进度：【${params.progress}】
已完成核心节点：【${completedNodes}】
待办核心事项：【${pendingItems}】
当前问题/异常：【${issues}】`;
}

/**
 * 解析任务ID
 * 从指令文本中提取任务ID
 */
export function extractTaskId(commandText: string): string | null {
  // 匹配各种任务ID格式
  const patterns = [
    /任务ID[:：]\s*([A-Za-z0-9-_]+)/i,
    /任务编号[:：]\s*([A-Za-z0-9-_]+)/i,
    /任务码[:：]\s*([A-Za-z0-9-_]+)/i,
    /task\s*id[:：]\s*([A-Za-z0-9-_]+)/i,
    /id[:：]\s*([A-Za-z0-9-_]+)/i,
  ];

  for (const pattern of patterns) {
    const match = commandText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * 验证回执格式
 * 检查回执是否符合固定格式
 */
export function validateTaskReceipt(receipt: string): boolean {
  const requiredFields = [
    /任务ID[:：]\s*【.+】/,
    /指令接收状态[:：]\s*【.+】/,
    /执行准备[:：]\s*【.+】/,
  ];

  return requiredFields.every(pattern => pattern.test(receipt));
}

/**
 * 验证状态反馈格式
 * 检查状态反馈是否符合固定格式
 */
export function validateTaskStatusFeedback(feedback: string): boolean {
  const requiredFields = [
    /任务基础信息[:：]/,
    /任务ID【.+】/,
    /任务名称【.+】/,
    /接收时间【.+】/,
    /当前执行状态[:：]\s*【.+】/,
    /核心完成进度[:：]\s*【.+】/,
    /已完成核心节点[:：]\s*【.+】/,
    /待办核心事项[:：]\s*【.+】/,
    /当前问题\/异常[:：]\s*【.+】/,
  ];

  return requiredFields.every(pattern => pattern.test(feedback));
}
