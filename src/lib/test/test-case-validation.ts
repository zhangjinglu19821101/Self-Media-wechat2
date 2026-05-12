/**
 * 测试案例验证模块 - 支持 step_history 详细验证
 * 
 * 功能：
 * 1. 从 agent_sub_tasks_step_history 表查询详细交互记录
 * 2. 验证 MCP 调用验证
 * 3. 验证决策流程完整性
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

/**
 * StepHistory 验证结果
 */
export interface StepHistoryValidation {
  success: boolean;
  recordCount: number;
  hasRequest: boolean;
  hasResponse: boolean;
  mcpAttemptCount: number;
  details: {
    mcpCalls: any[];
    userInteractions: any[];
    decisions: any[];
  };
  errors: string[];
}

/**
 * 单个测试案例的详细验证
 */
export async function validateTestCaseStepHistory(
  commandResultId: string
): Promise<StepHistoryValidation> {
  const result: StepHistoryValidation = {
    success: false,
    recordCount: 0,
    hasRequest: false,
    hasResponse: false,
    mcpAttemptCount: 0,
    details: {
      mcpCalls: [],
      userInteractions: [],
      decisions: [],
    },
    errors: [],
  };

  try {
    // 查询 step_history 记录
    const stepHistoryResult = await db.execute(sql`
      SELECT 
        step_no,
        interact_type,
        interact_content,
        interact_num,
        interact_user,
        interact_time
      FROM agent_sub_tasks_step_history 
      WHERE encode(command_result_id::bytea, 'hex') = encode(${commandResultId}::bytea, 'hex')
      ORDER BY step_no ASC, interact_num ASC
    `);

    const records = stepHistoryResult.rows;
    result.recordCount = records.length;

    // 基础验证
    result.hasRequest = records.some((r: any) => r.interact_type === 'request');
    result.hasResponse = records.some((r: any) => r.interact_type === 'response');

    // 解析详细内容
    for (const record of records) {
      try {
        const content = record.interact_content;
        
        // 解析 MCP 尝试
        if (content?.response?.mcp_attempts) {
          result.details.mcpCalls.push(...content.response.mcp_attempts);
        }
        
        // 解析用户交互
        if (content?.response?.user_interactions) {
          result.details.userInteractions.push(...content.response.user_interactions);
        }
        
        // 解析决策
        if (content?.response?.decision) {
          result.details.decisions.push(content.response.decision);
        }
      } catch (parseError) {
        result.errors.push(`解析记录失败 (step=${record.step_no}): ${parseError}`);
      }
    }

    // MCP 调用计数
    result.mcpAttemptCount = result.details.mcpCalls.length;

    // 综合验证
    result.success = 
      result.recordCount > 0 && 
      result.hasRequest && 
      result.hasResponse;

  } catch (error) {
    result.errors.push(`查询 step_history 失败: ${error}`);
  }

  return result;
}

/**
 * 从 execution_result 解析验证（作为备份方案
 * 
 * 当 step_history 查询失败时，使用此方案
 */
export function validateFromExecutionResult(executionResult: any): StepHistoryValidation {
  const result: StepHistoryValidation = {
    success: false,
    recordCount: 0,
    hasRequest: false,
    hasResponse: false,
    mcpAttemptCount: 0,
    details: {
      mcpCalls: [],
      userInteractions: [],
      decisions: [],
    },
    errors: [],
  };

  try {
    // 解析 execution_result JSON
    let parsedResult: any;
    if (typeof executionResult === 'string') {
      parsedResult = JSON.parse(executionResult);
    } else {
      parsedResult = executionResult;
    }

    // 从 execution_result 中提取信息
    if (parsedResult?.mcpAttempts || parsedResult?.mcp_attempts) {
      const mcpAttempts = parsedResult.mcpAttempts || parsedResult.mcp_attempts;
      result.details.mcpCalls = Array.isArray(mcpAttempts) ? mcpAttempts : [mcpAttempts];
      result.mcpAttemptCount = result.details.mcpCalls.length;
    }

    if (parsedResult?.userInteractions || parsedResult?.user_interactions) {
      const userInteractions = parsedResult.userInteractions || parsedResult.user_interactions;
      result.details.userInteractions = Array.isArray(userInteractions) ? userInteractions : [userInteractions];
    }

    if (parsedResult?.decision) {
      result.details.decisions = [parsedResult.decision];
    }

    // 设置基础验证标志
    result.hasRequest = result.mcpAttemptCount > 0 || result.details.userInteractions.length > 0;
    result.hasResponse = result.details.decisions.length > 0;
    result.recordCount = 1; // 标记为至少有 execution_result

    result.success = result.hasRequest && result.hasResponse;

  } catch (error) {
    result.errors.push(`解析 execution_result 失败: ${error}`);
  }

  return result;
}

/**
 * 综合验证：优先使用 step_history，失败时使用 execution_result
 */
export async function comprehensiveValidation(
  commandResultId: string,
  executionResult: any
): Promise<StepHistoryValidation> {
  // 1. 优先查询 step_history
  const stepHistoryValidation = await validateTestCaseStepHistory(commandResultId);
  
  if (stepHistoryValidation.success) {
    return stepHistoryValidation;
  }

  // 2. 如果 step_history 验证失败，使用 execution_result 作为备份
  console.log(`[验证] step_history 验证失败，使用 execution_result 作为备份方案`);
  
  const executionValidation = validateFromExecutionResult(executionResult);
  
  // 合并两种方案的错误信息
  executionValidation.errors = [
    ...stepHistoryValidation.errors,
    ...executionValidation.errors,
  ];
  
  return executionValidation;
}

/**
 * 特定测试案例的定制化验证
 */
export async function validateSpecificTestCase(
  testCaseId: string,
  commandResultId: string,
  executionResult: any
): Promise<{
  passed: boolean;
  details: any;
  errors: string[];
}> {
  const result = await comprehensiveValidation(commandResultId, executionResult);
  
  const specificValidations: Record<string, (validation: StepHistoryValidation) => boolean> = {
    // TC-01A: 内容审核
    'TC-01A': (v) => v.mcpAttemptCount >= 1,
    
    // TC-01B: 搜索引擎搜索
    'TC-01B': (v) => v.mcpAttemptCount >= 1,
    
    // TC-01C: 公众号上传
    'TC-01C': (v) => v.mcpAttemptCount >= 1,
    
    // TC-23: 违规处理 + 公众号上传
    'TC-23': (v) => {
      // 需要至少1次MCP调用，并且有违规检测
      const hasViolations = v.details.decisions.some((d: any) => 
        d.type === 'EXECUTE_MCP' && d.reason_code === 'MCP_CONTINUE'
      );
      return v.mcpAttemptCount >= 1 && hasViolations;
    },
    
    // TC-24: 用户确认后继续
    'TC-24': (v) => v.details.userInteractions.length >= 1,
    
    // TC-25: 失败后上报
    'TC-25': (v) => v.details.decisions.some((d: any) => d.type === 'FAILED'),
  };

  const specificValidation = specificValidations[testCaseId];
  const specificPassed = specificValidation ? specificValidation(result) : true;

  return {
    passed: result.success && specificPassed,
    details: {
      stepHistoryValidation: result,
      specificPassed,
    },
    errors: result.errors,
  };
}
