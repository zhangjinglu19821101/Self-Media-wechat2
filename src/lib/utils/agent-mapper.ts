/**
 * Agent ID 映射工具函数
 * 将简写的 agent ID 转换为完整的 agent ID
 */

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
