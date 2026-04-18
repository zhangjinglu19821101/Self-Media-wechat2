/**
 * 通用 MCP 调用层
 * 
 * 底层：灵活的通用调用（给 Agent B 用）
 * 上层：类型安全的封装（给普通开发者用）
 * 
 * 设计理念：
 * - 底层：Agent B 自己决策、自己拼参数
 * - 接口定义：放到 capability_list 表的字段上
 * - Agent B 获取能力时，根据接口信息直接分析
 * - 工具注册：使用 ToolRegistry 动态注册，支持运行时扩展
 * 
 * @docs /docs/详细设计文档agent智能交互MCP能力设计capability_type.md
 */

import { toolRegistry } from './tool-registry';
import { toolAutoRegistrar } from './tool-auto-registrar';

// === 初始化标志 ===
// 在 serverless 环境中，每个请求可能运行在不同的执行上下文
// 因此需要确保在首次调用 MCP 之前完成工具注册
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * 确保工具注册器已初始化
 * 在 serverless 环境中，必须在每次请求前确保初始化完成
 */
async function ensureInitialized(): Promise<void> {
  if (isInitialized) {
    return;
  }
  
  // 如果正在初始化，等待完成
  if (initPromise) {
    return initPromise;
  }
  
  // 开始初始化
  initPromise = (async () => {
    try {
      await toolAutoRegistrar.initialize();
      isInitialized = true;
      console.log('[Generic MCP Call] 工具注册器初始化完成');
    } catch (error) {
      console.error('[Generic MCP Call] 工具注册器初始化失败:', error);
      throw error;
    } finally {
      initPromise = null;
    }
  })();
  
  return initPromise;
}

// === 类型定义 ===

export interface GenericMCPRequest {
  tool: string;           // 工具名：search / wechat / data_acquire / email
  action: string;         // 动作名：web_search / add_draft / etc.
  params: any;            // 参数随便传（Agent B 自己负责）
}

export interface GenericMCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    tool: string;
    action: string;
    timestamp: number;
  };
}

export interface CapabilityInterfaceSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  description?: string;
}

// === 通用 MCP 调用函数 ===

/**
 * 底层：灵活的通用调用（给 Agent B 用）
 * 
 * Agent B 自己决定：
 * - 调用什么 tool
 * - 调用什么 action
 * - 怎么拼 params
 * 
 * 我们只负责：
 * - 把调用分发到对应的工具
 * - 返回结果
 */
export async function genericMCPCall(
  tool: string,
  action: string,
  params: any
): Promise<GenericMCPResponse> {
  try {
    // 🔥 确保工具注册器已初始化（在 serverless 环境中防止竞态条件）
    await ensureInitialized();
    
    console.log('[Generic MCP Call] 开始通用调用:', { tool, action, params });
    console.log('[Generic MCP Call] 可用工具:', toolRegistry.getAvailableTools());

    // 1. 验证 tool 是否存在
    const toolInstance = toolRegistry.getTool(tool);
    if (!toolInstance) {
      return {
        success: false,
        error: [
          `不支持的 tool: ${tool}`,
          `可用的 tool: ${toolRegistry.getAvailableTools().join(', ')}`,
          ``,
          `💡 请按以下步骤操作：`,
          `1. 在 capability_list 表中配置 tool_name = '${tool}' 的能力`,
          `2. 确保工具实现文件存在`,
          `3. 等待10分钟自动刷新，或重启服务`
        ].join('\n'),
        metadata: { tool, action, timestamp: Date.now() },
      };
    }

    // 1.5 将 action 名称从下划线格式转换为驼峰格式
    // 例如: add_draft -> addDraft, web_search -> webSearch
    const toCamelCase = (str: string): string => {
      return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    };
    const camelCaseAction = toCamelCase(action);
    console.log('[Generic MCP Call] Action 名称转换:', { original: action, camelCase: camelCaseAction });

    // 2. 验证 action 是否存在（尝试驼峰格式，如果不存在则尝试原始格式）
    let actionToCall = camelCaseAction;
    if (typeof toolInstance[actionToCall] !== 'function') {
      // 如果驼峰格式不存在，尝试原始格式
      if (typeof toolInstance[action] === 'function') {
        actionToCall = action;
      } else {
        return {
          success: false,
          error: `tool ${tool} 不支持的 action: ${action}（尝试 ${camelCaseAction}），可用的 action: ${Object.keys(toolInstance).filter(k => typeof toolInstance[k] === 'function').join(', ')}`,
          metadata: { tool, action, timestamp: Date.now() },
        };
      }
    }

    // 3. 执行调用（Agent B 自己负责参数正确）
    console.log('[Generic MCP Call] 执行调用...');
    const result = await toolInstance[actionToCall](params);

    console.log('[Generic MCP Call] 调用完成，结果:', result);

    // 4. 返回结果
    return {
      success: true,
      data: result,
      metadata: { tool, action: actionToCall, timestamp: Date.now() },
    };
  } catch (error: any) {
    console.error('[Generic MCP Call] 调用失败:', error);
    return {
      success: false,
      error: `通用 MCP 调用失败: ${error.message}`,
      metadata: { tool, action, timestamp: Date.now() },
    };
  }
}

// === 根据 capability_id 调用（从 capability_list 表读取配置） ===

/**
 * 根据 capability_list 表的记录调用
 * 
 * Agent B 只需要提供：
 * - solution_num (capability_list.id)
 * - params (自己拼的参数)
 * 
 * 我们负责：
 * - 从 capability_list 表读取 tool_name 和 action_name
 * - 执行调用
 */
export async function callMCPByCapabilityId(
  capabilityId: number,
  params: any,
  getCapabilityFn?: (id: number) => Promise<any>
): Promise<GenericMCPResponse> {
  try {
    console.log('[Call MCP by Capability ID] 开始调用，capabilityId:', capabilityId);

    // 1. 获取 capability 记录（如果提供了获取函数）
    let capability: any = null;
    if (getCapabilityFn) {
      capability = await getCapabilityFn(capabilityId);
    }

    // 2. 如果有 capability 记录，从中读取 tool_name 和 action_name
    let tool: string | null = null;
    let action: string | null = null;

    if (capability) {
      tool = capability.tool_name;
      action = capability.action_name;
      console.log('[Call MCP by Capability ID] 从 capability 读取配置:', { tool, action });
    }

    // 3. 如果没有 capability 记录或缺少字段，尝试从 params 中读取
    if (!tool) {
      tool = params.tool;
    }
    if (!action) {
      action = params.action;
    }

    // 4. 验证必需字段
    if (!tool || !action) {
      return {
        success: false,
        error: '缺少必需字段：tool 和 action（可以从 capability 记录或 params 中提供）',
        metadata: { tool: tool || '', action: action || '', timestamp: Date.now() },
      };
    }

    // 5. 执行通用调用
    return await genericMCPCall(tool, action, params);
  } catch (error: any) {
    console.error('[Call MCP by Capability ID] 调用失败:', error);
    return {
      success: false,
      error: `根据 capability_id 调用失败: ${error.message}`,
      metadata: { tool: '', action: '', timestamp: Date.now() },
    };
  }
}

// === 辅助函数 ===

/**
 * 获取可用的工具列表
 */
export function getAvailableTools(): string[] {
  return toolRegistry.getAvailableTools();
}

/**
 * 获取工具的可用动作列表
 */
export function getAvailableActions(tool: string): string[] {
  const toolInstance = toolRegistry.getTool(tool);
  if (!toolInstance) {
    return [];
  }
  return Object.keys(toolInstance).filter(key => typeof toolInstance[key] === 'function');
}

/**
 * 通用 MCP 调用工具集
 */
export const GenericMCPTools = {
  genericMCPCall,
  callMCPByCapabilityId,
  getAvailableTools,
  getAvailableActions,
};

/**
 * 使用示例
 */
export async function exampleGenericUsage() {
  // 示例1：直接通用调用（Agent B 自己拼参数）
  const result1 = await genericMCPCall('search', 'webSearch', {
    query: '人工智能',
    count: 10,
  });
  console.log('通用调用结果:', result1);

  // 示例2：通过 capability_id 调用
  const result2 = await callMCPByCapabilityId(16, {
    query: '机器学习',
    count: 5,
  });
  console.log('通过 capability_id 调用结果:', result2);

  // 示例3：获取可用工具和动作
  console.log('可用工具:', getAvailableTools());
  console.log('search 工具的可用动作:', getAvailableActions('search'));
}
