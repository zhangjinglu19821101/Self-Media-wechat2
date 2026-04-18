/**
 * Mock MCP 服务
 * 用于测试 MCP 执行逻辑
 */

// Mock 执行结果配置
interface MockMcpConfig {
  shouldSucceed: boolean;
  delayMs: number;
  errorMessage?: string;
  resultData?: any;
}

// 按工具/方法配置的执行策略
const mcpExecutionStrategies: Map<string, MockMcpConfig[]> = new Map();

// 默认配置
let defaultConfig: MockMcpConfig = {
  shouldSucceed: true,
  delayMs: 100,
  resultData: { success: true, data: 'mock result' }
};

/**
 * 设置MCP执行策略
 * @param toolName 工具名
 * @param actionName 方法名
 * @param configs 执行配置数组（按调用顺序）
 */
export function setMcpExecutionStrategy(
  toolName: string,
  actionName: string,
  configs: MockMcpConfig[]
): void {
  const key = `${toolName}/${actionName}`;
  mcpExecutionStrategies.set(key, [...configs]);
  console.log(`[MockMCP] 设置策略 ${key}: ${configs.length}次调用`);
}

/**
 * 设置全局默认配置
 */
export function setDefaultMcpConfig(config: MockMcpConfig): void {
  defaultConfig = { ...config };
}

/**
 * 重置所有策略
 */
export function resetMcpStrategies(): void {
  mcpExecutionStrategies.clear();
  defaultConfig = {
    shouldSucceed: true,
    delayMs: 100,
    resultData: { success: true, data: 'mock result' }
  };
  console.log('[MockMCP] 所有策略已重置');
}

/**
 * 执行Mock MCP调用
 */
export async function executeMockMcp(
  toolName: string,
  actionName: string,
  params: any
): Promise<any> {
  const key = `${toolName}/${actionName}`;
  const strategies = mcpExecutionStrategies.get(key);
  
  // 获取当前配置
  let config: MockMcpConfig;
  if (strategies && strategies.length > 0) {
    config = strategies.shift()!; // 取出第一个配置
    if (strategies.length === 0) {
      mcpExecutionStrategies.delete(key);
    }
  } else {
    config = defaultConfig;
  }

  console.log(`[MockMCP] 执行 ${key}:`, {
    shouldSucceed: config.shouldSucceed,
    delayMs: config.delayMs,
    params: JSON.stringify(params).substring(0, 100)
  });

  // 模拟延迟
  if (config.delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, config.delayMs));
  }

  // 返回结果
  if (config.shouldSucceed) {
    return {
      success: true,
      ...config.resultData,
      _mock: true,
      _timestamp: new Date().toISOString()
    };
  } else {
    const error = new Error(config.errorMessage || 'Mock MCP execution failed');
    (error as any).code = 'MOCK_MCP_ERROR';
    (error as any).toolName = toolName;
    (error as any).actionName = actionName;
    throw error;
  }
}

/**
 * 预设策略：成功-成功-成功
 */
export function presetAllSuccess(): void {
  setMcpExecutionStrategy('web_search', 'searchEngine', [
    { shouldSucceed: true, delayMs: 100, resultData: { data: '搜索结果' } }
  ]);
}

/**
 * 预设策略：失败-成功
 */
export function presetFailThenSuccess(): void {
  setMcpExecutionStrategy('web_search', 'searchEngine', [
    { shouldSucceed: false, delayMs: 100, errorMessage: 'Search timeout' },
    { shouldSucceed: true, delayMs: 100, resultData: { data: '重试成功' } }
  ]);
}

/**
 * 预设策略：失败-失败-成功（3次尝试）
 */
export function presetTwoFailsThenSuccess(): void {
  setMcpExecutionStrategy('web_search', 'searchEngine', [
    { shouldSucceed: false, delayMs: 100, errorMessage: 'First attempt failed' },
    { shouldSucceed: false, delayMs: 100, errorMessage: 'Second attempt failed' },
    { shouldSucceed: true, delayMs: 100, resultData: { data: 'Third attempt success' } }
  ]);
}

/**
 * 预设策略：全部失败（3次）
 */
export function presetAllFail(): void {
  setMcpExecutionStrategy('web_search', 'searchEngine', [
    { shouldSucceed: false, delayMs: 100, errorMessage: '搜索引擎超时' },
    { shouldSucceed: false, delayMs: 100, errorMessage: '模拟浏览器失败' },
    { shouldSucceed: false, delayMs: 100, errorMessage: '直接访问失败' }
  ]);
  
  setMcpExecutionStrategy('web_search', 'simulateBrowser', [
    { shouldSucceed: false, delayMs: 100, errorMessage: 'Browser simulation failed' }
  ]);
  
  setMcpExecutionStrategy('web_search', 'directFetch', [
    { shouldSucceed: false, delayMs: 100, errorMessage: 'Direct fetch failed' }
  ]);
}

/**
 * 获取当前策略状态
 */
export function getMcpStrategyStatus(): any {
  const status: Record<string, number> = {};
  mcpExecutionStrategies.forEach((configs, key) => {
    status[key] = configs.length;
  });
  return {
    strategies: status,
    totalStrategies: mcpExecutionStrategies.size,
    defaultConfig
  };
}
