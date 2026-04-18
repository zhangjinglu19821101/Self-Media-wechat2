/**
 * 分支1执行器：具备解决执行Agent的问题（执行 capability num 的内容）
 * 
 * 处理流程：
 * 1. Agent B 返回 hasSolution = true，带有 solution_num
 * 2. 根据 solution_num 查找 capability_list 表
 * 3. 根据 requires_on_site_execution 决定执行路径
 * 4. 执行对应的 MCP 能力
 * 5. 返回结果
 * 
 * @docs /docs/详细设计文档agent智能交互MCP能力设计capability_type.md
 */

import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SearchMCPTools } from './web-search-executor';
import { WechatMCPTools } from './wechat-tools';
import { MCPCapabilityExecutorFactory } from './mcp-executor';
import type { AgentBOutput } from '@/lib/types/capability-types';

// 导入并注册合规审核执行器
import './wechat-compliance-auditor';

// === 类型定义 ===

export interface Branch1ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    solutionNum: number;
    capabilityType: string;
    functionDesc: string;
    requiresOnSiteExecution: boolean;
    executionPath: 'direct' | 'on_site';
    timestamp: number;
  };
}

export interface Branch1ExecutionParams {
  solutionNum: number;
  agentBOutput: AgentBOutput;
  mcpArgs?: Record<string, any>;
}

// === 核心执行器 ===

/**
 * 分支1主执行器
 */
export async function executeBranch1(params: Branch1ExecutionParams): Promise<Branch1ExecutionResult> {
  const { solutionNum, agentBOutput, mcpArgs } = params;

  try {
    console.log('[Branch1 Executor] 开始执行分支1，solution_num:', solutionNum);

    // 步骤1：根据 solution_num 查找 capability_list 表
    const capability = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.id, solutionNum));

    if (capability.length === 0) {
      return {
        success: false,
        error: `未找到 solution_num = ${solutionNum} 对应的 capability`,
        metadata: {
          solutionNum,
          capabilityType: '',
          functionDesc: '',
          requiresOnSiteExecution: false,
          executionPath: 'direct',
          timestamp: Date.now(),
        },
      };
    }

    const cap = capability[0];
    console.log('[Branch1 Executor] 找到 capability:', {
      id: cap.id,
      capabilityType: cap.capabilityType,
      functionDesc: cap.functionDesc,
      requiresOnSiteExecution: cap.requiresOnSiteExecution,
    });

    // 步骤2：根据 requires_on_site_execution 决定执行路径
    if (cap.requiresOnSiteExecution) {
      // 路径A：需要现场执行
      console.log('[Branch1 Executor] 选择路径：需现场执行');
      return await executeOnSitePath(cap, mcpArgs);
    } else {
      // 路径B：无需现场执行，直接执行
      console.log('[Branch1 Executor] 选择路径：无需现场执行，直接执行');
      return await executeDirectPath(cap, mcpArgs);
    }
  } catch (error: any) {
    console.error('[Branch1 Executor] 执行失败:', error);
    return {
      success: false,
      error: `分支1执行失败: ${error.message}`,
      metadata: {
        solutionNum: params.solutionNum,
        capabilityType: '',
        functionDesc: '',
        requiresOnSiteExecution: false,
        executionPath: 'direct',
        timestamp: Date.now(),
      },
    };
  }
}

// === 路径B：无需现场执行，直接执行 ===

async function executeDirectPath(
  cap: typeof capabilityList.$inferSelect,
  mcpArgs?: Record<string, any>
): Promise<Branch1ExecutionResult> {
  try {
    console.log('[Branch1 Executor] 直接执行路径开始');

    let result: any;

    // 根据 capability_type 和 metadata 决定调用哪个工具
    const capabilityType = cap.capabilityType;
    const metadata = cap.metadata || {};
    const action = metadata.action as string;

    console.log('[Branch1 Executor] 执行参数:', { capabilityType, action, mcpArgs });

    // 根据 capability_type 分发到对应的工具
    switch (capabilityType) {
      case 'search':
        result = await executeSearchTool(action, mcpArgs);
        break;
      case 'platform_publish':
        result = await executeWechatTool(action, mcpArgs);
        break;
      case 'data_acquire':
        result = await executeDataAcquireTool(action, mcpArgs);
        break;
      case 'content_audit':
      case 'content_audit_simple':
        result = await executeComplianceAuditTool(cap.id, mcpArgs);
        break;
      default:
        throw new Error(`不支持的 capability_type: ${capabilityType}`);
    }

    console.log('[Branch1 Executor] 直接执行路径完成，结果:', result);

    return {
      success: true,
      data: result,
      metadata: {
        solutionNum: cap.id,
        capabilityType: cap.capabilityType,
        functionDesc: cap.functionDesc,
        requiresOnSiteExecution: cap.requiresOnSiteExecution,
        executionPath: 'direct',
        timestamp: Date.now(),
      },
    };
  } catch (error: any) {
    console.error('[Branch1 Executor] 直接执行路径失败:', error);
    return {
      success: false,
      error: `直接执行失败: ${error.message}`,
      metadata: {
        solutionNum: cap.id,
        capabilityType: cap.capabilityType,
        functionDesc: cap.functionDesc,
        requiresOnSiteExecution: cap.requiresOnSiteExecution,
        executionPath: 'direct',
        timestamp: Date.now(),
      },
    };
  }
}

// === 路径A：需要现场执行 ===

async function executeOnSitePath(
  cap: typeof capabilityList.$inferSelect,
  mcpArgs?: Record<string, any>
): Promise<Branch1ExecutionResult> {
  try {
    console.log('[Branch1 Executor] 现场执行路径开始');

    // 生成现场执行链接（这里是Mock，实际需要根据业务逻辑生成）
    const onSiteExecutionUrl = generateOnSiteExecutionUrl(cap, mcpArgs);

    console.log('[Branch1 Executor] 生成现场执行链接:', onSiteExecutionUrl);

    // 返回现场执行状态，等待用户操作
    // 这里可以根据业务需求实现状态轮询或WebSocket通知
    // 目前先返回 Mock 结果

    return {
      success: true,
      data: {
        status: 'waiting_execution',
        onSiteExecutionUrl,
        message: '等待用户现场执行',
      },
      metadata: {
        solutionNum: cap.id,
        capabilityType: cap.capabilityType,
        functionDesc: cap.functionDesc,
        requiresOnSiteExecution: cap.requiresOnSiteExecution,
        executionPath: 'on_site',
        timestamp: Date.now(),
      },
    };
  } catch (error: any) {
    console.error('[Branch1 Executor] 现场执行路径失败:', error);
    return {
      success: false,
      error: `现场执行失败: ${error.message}`,
      metadata: {
        solutionNum: cap.id,
        capabilityType: cap.capabilityType,
        functionDesc: cap.functionDesc,
        requiresOnSiteExecution: cap.requiresOnSiteExecution,
        executionPath: 'on_site',
        timestamp: Date.now(),
      },
    };
  }
}

// === 工具执行函数 ===

/**
 * 执行搜索工具
 */
async function executeSearchTool(action: string, mcpArgs?: Record<string, any>): Promise<any> {
  const args = mcpArgs || {};
  const query = args.query as string;
  const count = (args.count as number) || 10;

  if (!query) {
    throw new Error('搜索工具缺少 query 参数');
  }

  switch (action) {
    case 'web_search':
      return await SearchMCPTools.webSearch({ query, count });
    case 'web_summary':
      return await SearchMCPTools.webSearchWithSummary({ query, count });
    case 'image_search':
      return await SearchMCPTools.imageSearch({ query, count });
    default:
      throw new Error(`不支持的搜索 action: ${action}`);
  }
}

/**
 * 执行微信公众号工具
 */
async function executeWechatTool(action: string, mcpArgs?: Record<string, any>): Promise<any> {
  const args = mcpArgs || {};

  switch (action) {
    case 'get_accounts':
      return await WechatMCPTools.getAccounts();
    case 'add_draft':
      if (!args.accountId || !args.articles) {
        throw new Error('微信添加草稿缺少必要参数: accountId, articles');
      }
      return await WechatMCPTools.addDraft({
        accountId: args.accountId as string,
        articles: args.articles as any[],
      });
    case 'get_draft_list':
      if (!args.accountId) {
        throw new Error('微信获取草稿列表缺少参数: accountId');
      }
      return await WechatMCPTools.getDraftList({
        accountId: args.accountId as string,
        offset: (args.offset as number) || 0,
        count: (args.count as number) || 20,
      });
    case 'delete_draft':
      if (!args.accountId || !args.mediaId) {
        throw new Error('微信删除草稿缺少参数: accountId, mediaId');
      }
      return await WechatMCPTools.deleteDraft({
        accountId: args.accountId as string,
        mediaId: args.mediaId as string,
      });
    case 'upload_media':
      if (!args.accountId || !args.mediaType) {
        throw new Error('微信上传素材缺少参数: accountId, mediaType');
      }
      return await WechatMCPTools.uploadMedia({
        accountId: args.accountId as string,
        mediaType: args.mediaType as 'image',
        fileUrl: args.fileUrl as string,
        fileBase64: args.fileBase64 as string,
      });
    default:
      throw new Error(`不支持的微信 action: ${action}`);
  }
}

/**
 * 执行数据获取工具
 */
async function executeDataAcquireTool(action: string, mcpArgs?: Record<string, any>): Promise<any> {
  // 这里可以实现数据获取相关的工具
  // 目前先返回 Mock 结果
  return {
    success: true,
    message: '数据获取工具执行成功（Mock）',
    action,
    args: mcpArgs,
  };
}

/**
 * 执行合规审核工具
 * 通过 MCPCapabilityExecutorFactory 调用注册的执行器
 */
async function executeComplianceAuditTool(capabilityId: number, mcpArgs?: Record<string, any>): Promise<any> {
  const args = mcpArgs || {};

  console.log('[Branch1 Executor] 执行合规审核工具:', { capabilityId, args });

  // 从工厂获取执行器
  const executor = MCPCapabilityExecutorFactory.getExecutor(capabilityId);

  if (!executor) {
    throw new Error(`未找到合规审核执行器，capabilityId: ${capabilityId}，请确保 wechat-compliance-auditor.ts 已正确导入`);
  }

  // 构造 Agent B 响应格式（模拟 Agent B 返回）
  const agentBResponse = {
    call_mcp_meth_status: 'ready_to_execute',
    ...args,
  };

  // 构造调用上下文
  const context = {
    capabilityId,
    agentBResponse,
  };

  // 构造 agent_response_spec（从 capability_list 获取或构造默认值）
  const spec = {
    trigger_key: 'call_mcp_meth_status',
    trigger_value: 'ready_to_execute',
    required_params: Object.keys(args).map(key => ({
      param_name: key,
      param_type: typeof args[key],
      example_value: args[key],
    })),
    response_example: agentBResponse,
    constraints: [],
  };

  // 调用执行器
  const result = await executor.call(context as any, spec as any);

  console.log('[Branch1 Executor] 合规审核执行完成:', result);

  return result;
}

// === 辅助函数 ===

/**
 * 生成现场执行链接
 */
function generateOnSiteExecutionUrl(
  cap: typeof capabilityList.$inferSelect,
  mcpArgs?: Record<string, any>
): string {
  // 这里可以根据业务逻辑生成真实的现场执行链接
  // 目前先返回 Mock 链接
  const baseUrl = 'http://localhost:5000';
  const path = `/on-site-execution/${cap.id}`;
  const params = new URLSearchParams();
  if (mcpArgs) {
    params.set('args', JSON.stringify(mcpArgs));
  }
  return `${baseUrl}${path}?${params.toString()}`;
}

/**
 * 分支1执行器工具集
 */
export const Branch1Executor = {
  executeBranch1,
  executeDirectPath,
  executeOnSitePath,
};
