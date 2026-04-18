/**
 * 业务场景级数据完整性验证
 *
 * 功能：验证每个已完成功能的业务场景下，数据结构的完整性
 *
 * 业务场景：
 * - TC-01A/B/C: 合规审核场景
 * - TC-02/03: 搜索场景
 * - TC-04: 公众号上传场景
 * - TC-05/06: 重试场景
 * - TC-23/24/25: 完整业务流程场景
 */

import { db } from '@/lib/db';
import { sql, eq } from 'drizzle-orm';
import { agentSubTasksStepHistory, agentSubTasks } from '@/lib/db/schema';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema/agent-sub-tasks-mcp-executions';

// ==================== 业务场景定义 ====================

export interface BusinessScenarioValidation {
  scenarioId: string;
  scenarioName: string;
  description: string;
  requiredDataStructures: DataStructureRequirement[];
  validate: (commandResultId: string, subTaskId: string) => Promise<ScenarioValidationResult>;
}

export interface DataStructureRequirement {
  id: string;
  name: string;
  description: string;
  required: boolean;
  check: (record: any) => boolean;
}

export interface ScenarioValidationResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  validations: StructureValidation[];
  summary: string;
}

export interface StructureValidation {
  structureId: string;
  structureName: string;
  passed: boolean;
  details: any;
  error?: string;
}

// ==================== 通用数据结构检查 ====================

/**
 * 检查是否有 MCP 调用记录
 */
function hasMcpAttempts(content: any): boolean {
  return !!(content?.response?.mcp_attempts &&
    Array.isArray(content.response.mcp_attempts) &&
    content.response.mcp_attempts.length > 0);
}

/**
 * 检查是否有决策记录
 */
function hasDecision(content: any): boolean {
  return !!content?.response?.decision?.type;
}

/**
 * 检查是否有执行摘要
 */
function hasExecutionSummary(content: any): boolean {
  return !!content?.response?.execution_summary;
}

/**
 * 检查是否有成对的 request/response
 */
function hasRequestResponsePairs(records: any[]): boolean {
  const interactNums = new Set(records.map(r => r.interactNum));
  for (const num of interactNums) {
    const pairRecords = records.filter(r => r.interactNum === num);
    const hasRequest = pairRecords.some(r => r.interactType === 'request');
    const hasResponse = pairRecords.some(r => r.interactType === 'response');
    if (hasRequest && hasResponse) {
      return true;
    }
  }
  return false;
}

// ==================== agent_sub_tasks_mcp_executions 表验证 ====================

/**
 * 验证 agent_sub_tasks_mcp_executions 表数据
 * 
 * 这是 f1bafc6 版本新增的表，用于 MCP 执行详细审计
 */
async function validateMcpExecutionsTable(stepHistoryRecords: any[]): Promise<{
  hasMcpExecutions: boolean;
  mcpExecutionsCount: number;
  validationDetails: any;
}> {
  const result = {
    hasMcpExecutions: false,
    mcpExecutionsCount: 0,
    validationDetails: {} as any
  };

  try {
    // 1. 提取 step_history 记录的关联信息（使用新的关联方式）
    if (stepHistoryRecords.length === 0) {
      result.validationDetails.warning = '没有 step_history 记录，跳过 mcp_executions 验证';
      return result;
    }

    // 🔴 新的关联方式：从 stepHistoryRecords 中提取 subTaskId, stepNo, interactNo
    const subTaskId = stepHistoryRecords[0]?.subTaskId;
    const uniqueStepNos = [...new Set(stepHistoryRecords.map(r => r.stepNo))];
    const uniqueInteractNos = [...new Set(stepHistoryRecords.map(r => r.interactNum))];

    // 2. 查询 agent_sub_tasks_mcp_executions 表（使用新的关联方式）
    const allMcpExecutions = await db
      .select()
      .from(agentSubTasksMcpExecutions);
    
    // 🔴 新的过滤方式：使用 subTaskId, stepNo, interactNo 进行过滤
    let mcpExecutions: any[] = [];
    if (subTaskId) {
      // 优先使用 subTaskId 过滤
      mcpExecutions = allMcpExecutions.filter(r => r.subTaskId === subTaskId);
    } else {
      // 兜底：使用 commandResultId 和 orderIndex（向后兼容）
      const commandResultId = stepHistoryRecords[0]?.commandResultId;
      const orderIndexes = uniqueStepNos;
      mcpExecutions = allMcpExecutions.filter(r => 
        r.commandResultId === commandResultId && 
        orderIndexes.includes(r.orderIndex)
      );
    }

    result.hasMcpExecutions = mcpExecutions.length > 0;
    result.mcpExecutionsCount = mcpExecutions.length;

    // 3. 详细验证
    result.validationDetails = {
      hasMatchingRecords: mcpExecutions.length > 0,
      matchingRecords: mcpExecutions.length,
      // 🔴 修改：使用新的字段替代 stepHistoryId
      uniqueSubTaskIds: new Set(mcpExecutions.map(r => r.subTaskId)).size,
      uniqueStepNos: new Set(mcpExecutions.map(r => r.stepNo)).size,
      uniqueInteractNos: new Set(mcpExecutions.map(r => r.interactNo)).size,
      toolNames: [...new Set(mcpExecutions.map(r => r.toolName))],
      actionNames: [...new Set(mcpExecutions.map(r => r.actionName))],
      statuses: [...new Set(mcpExecutions.map(r => r.resultStatus))],
      strategies: [...new Set(mcpExecutions.map(r => r.strategy))],
      hasRetryable: mcpExecutions.some(r => r.isRetryable === true),
      hasFailureAnalysis: mcpExecutions.some(r => r.failureType !== null),
      avgExecutionTime: mcpExecutions.length > 0 
        ? Math.round(mcpExecutions.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0) / mcpExecutions.length)
        : 0
    };

    console.log('🔍 agent_sub_tasks_mcp_executions 验证结果:', {
      count: mcpExecutions.length,
      tools: result.validationDetails.toolNames,
      statuses: result.validationDetails.statuses
    });

    return result;
  } catch (error) {
    console.error('验证 agent_sub_tasks_mcp_executions 失败:', error);
    result.validationDetails.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

// ==================== 两阶段流程验证辅助函数 ====================

/**
 * 检查是否有合规检查记录
 */
function hasComplianceCheck(content: any): boolean {
  const mcpAttempts = content?.response?.mcp_attempts;
  if (!Array.isArray(mcpAttempts) || mcpAttempts.length === 0) {
    return false;
  }
  return mcpAttempts.some(
    (attempt: any) => 
      attempt.decision?.toolName === 'compliance_audit' &&
      attempt.decision?.actionName === 'checkContent'
  );
}

/**
 * 检查是否有公众号上传记录
 */
function hasWechatUpload(content: any): boolean {
  const mcpAttempts = content?.response?.mcp_attempts;
  if (!Array.isArray(mcpAttempts) || mcpAttempts.length === 0) {
    return false;
  }
  return mcpAttempts.some(
    (attempt: any) => 
      attempt.decision?.toolName === 'wechat_mp' &&
      attempt.decision?.actionName === 'addDraft'
  );
}

/**
 * 检查合规检查是否在公众号上传之前
 */
function isComplianceCheckFirst(content: any): boolean {
  const mcpAttempts = content?.response?.mcp_attempts;
  if (!Array.isArray(mcpAttempts) || mcpAttempts.length < 2) {
    return false;
  }
  
  const complianceIndex = mcpAttempts.findIndex(
    (attempt: any) => attempt.decision?.toolName === 'compliance_audit'
  );
  const uploadIndex = mcpAttempts.findIndex(
    (attempt: any) => attempt.decision?.toolName === 'wechat_mp'
  );
  
  return complianceIndex !== -1 && uploadIndex !== -1 && complianceIndex < uploadIndex;
}

/**
 * 检查 mcp_attempts 数量是否为2
 */
function hasTwoMcpAttempts(content: any): boolean {
  const mcpAttempts = content?.response?.mcp_attempts;
  return Array.isArray(mcpAttempts) && mcpAttempts.length === 2;
}

/**
 * 检查合规检查是否通过
 */
function isComplianceCheckPassed(content: any): boolean {
  const mcpAttempts = content?.response?.mcp_attempts;
  if (!Array.isArray(mcpAttempts)) {
    return false;
  }
  
  const complianceAttempt = mcpAttempts.find(
    (attempt: any) => attempt.decision?.toolName === 'compliance_audit'
  );
  
  if (!complianceAttempt) {
    return false;
  }
  
  if (complianceAttempt.result?.status !== 'success') {
    return false;
  }
  
  const resultData = complianceAttempt.result?.data;
  return resultData?.is_compliant === true || resultData?.check_passed === true;
}

// ==================== 各业务场景验证器 ====================

/**
 * TC-01A: 合规审核 - 初始不合规→整改→成功上传
 */
export const COMPLIANCE_VIOLATION_SCENARIO: BusinessScenarioValidation = {
  scenarioId: 'TC-01A',
  scenarioName: '合规审核-违规整改场景',
  description: '验证初始不合规→整改→成功上传的完整业务流程数据结构（两阶段流程）',
  requiredDataStructures: [
    { id: 'request', name: '执行Agent请求', description: '有初始请求记录', required: true, check: (c) => !!c },
    { id: 'mcp_attempts', name: 'MCP调用记录', description: '有合规审核的MCP调用', required: true, check: hasMcpAttempts },
    { id: 'decision', name: '决策记录', description: '有Agent B决策', required: true, check: hasDecision },
    { id: 'execution_summary', name: '执行摘要', description: '有执行摘要', required: true, check: hasExecutionSummary },
    { id: 'two_mcp_attempts', name: '2条MCP记录', description: 'mcp_attempts应有2条记录', required: true, check: hasTwoMcpAttempts },
    { id: 'compliance_check', name: '合规检查', description: '有合规检查记录', required: true, check: hasComplianceCheck },
    { id: 'wechat_upload', name: '公众号上传', description: '有公众号上传记录', required: true, check: hasWechatUpload },
    { id: 'compliance_first', name: '合规检查在先', description: '合规检查应在公众号上传之前', required: true, check: isComplianceCheckFirst },
  ],
  validate: async (commandResultId: string, subTaskId: string) => {
    // 先查询所有记录，再在内存中过滤
    const allRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);
    
    const records = allRecords.filter(r => r.commandResultId === commandResultId);

    const validations: StructureValidation[] = [];

    // 1. 检查是否有记录
    validations.push({
      structureId: 'has_records',
      structureName: '有交互记录',
      passed: records.length > 0,
      details: { recordCount: records.length }
    });

    // 2. 检查是否有成对的 request/response
    validations.push({
      structureId: 'request_response_pairs',
      structureName: 'Request/Response 成对',
      passed: hasRequestResponsePairs(records),
      details: { interactNums: [...new Set(records.map(r => r.interactNum))] }
    });

    // 3. 检查最终的 response 记录
    const finalResponse = records.find(
      (record: any) => record.interactType === 'response' && 
                        record.interactContent?.response?.decision?.type === 'COMPLETE'
    );

    if (finalResponse) {
      const content = finalResponse.interactContent as any;
      
      // 3.1 检查 mcp_attempts 数量是否为2
      validations.push({
        structureId: 'two_mcp_attempts',
        structureName: 'mcp_attempts 应有2条记录',
        passed: hasTwoMcpAttempts(content),
        details: { 
          mcpAttemptsCount: content?.response?.mcp_attempts?.length || 0 
        }
      });

      // 3.2 检查是否有合规检查
      validations.push({
        structureId: 'has_compliance_check',
        structureName: '有合规检查记录',
        passed: hasComplianceCheck(content),
        details: {}
      });

      // 3.3 检查是否有公众号上传
      validations.push({
        structureId: 'has_wechat_upload',
        structureName: '有公众号上传记录',
        passed: hasWechatUpload(content),
        details: {}
      });

      // 3.4 检查合规检查是否在公众号上传之前
      if (hasComplianceCheck(content) && hasWechatUpload(content)) {
        validations.push({
          structureId: 'compliance_first',
          structureName: '合规检查应在公众号上传之前',
          passed: isComplianceCheckFirst(content),
          details: {}
        });
      }

      // 3.5 检查合规检查是否通过
      if (hasComplianceCheck(content)) {
        validations.push({
          structureId: 'compliance_passed',
          structureName: '合规检查应通过',
          passed: isComplianceCheckPassed(content),
          details: {}
        });
      }
    }

    // 4. 检查每个记录的数据结构
    for (const record of records) {
      const content = record.interactContent as any;

      if (record.interactType === 'response') {
        validations.push({
          structureId: `response_${record.stepNo}_${record.interactNum}`,
          structureName: `Response 数据结构 (Step ${record.stepNo})`,
          passed: hasMcpAttempts(content) || hasDecision(content),
          details: {
            hasMcpAttempts: hasMcpAttempts(content),
            hasDecision: hasDecision(content),
            hasExecutionSummary: hasExecutionSummary(content)
          }
        });
      }
    }

    return {
      scenarioId: 'TC-01A',
      scenarioName: '合规审核-违规整改场景',
      passed: validations.every(v => v.passed),
      validations,
      summary: validations.every(v => v.passed)
        ? '✅ 合规审核场景数据结构完整'
        : '❌ 合规审核场景数据结构不完整'
    };
  }
};

/**
 * TC-01B: 合规审核 - 初始合规→直接上传
 */
export const COMPLIANCE_DIRECT_SCENARIO: BusinessScenarioValidation = {
  scenarioId: 'TC-01B',
  scenarioName: '合规审核-直接发布场景',
  description: '验证初始合规→直接上传的业务流程数据结构（两阶段流程）',
  requiredDataStructures: [
    { id: 'request', name: '执行Agent请求', description: '有初始请求记录', required: true, check: (c) => !!c },
    { id: 'mcp_attempts', name: 'MCP调用记录', description: '有合规审核的MCP调用', required: true, check: hasMcpAttempts },
    { id: 'decision', name: '决策记录', description: '有COMPLETE决策', required: true, check: (c) => c?.response?.decision?.type === 'COMPLETE' },
    { id: 'two_mcp_attempts', name: '2条MCP记录', description: 'mcp_attempts应有2条记录', required: true, check: hasTwoMcpAttempts },
    { id: 'compliance_check', name: '合规检查', description: '有合规检查记录', required: true, check: hasComplianceCheck },
    { id: 'wechat_upload', name: '公众号上传', description: '有公众号上传记录', required: true, check: hasWechatUpload },
    { id: 'compliance_first', name: '合规检查在先', description: '合规检查应在公众号上传之前', required: true, check: isComplianceCheckFirst },
  ],
  validate: async (commandResultId: string, subTaskId: string) => {
    // 先查询所有记录，再在内存中过滤
    const allRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);
    
    const records = allRecords.filter(r => r.commandResultId === commandResultId);

    const validations: StructureValidation[] = [];

    validations.push({
      structureId: 'has_records',
      structureName: '有交互记录',
      passed: records.length > 0,
      details: { recordCount: records.length }
    });

    validations.push({
      structureId: 'has_complete_decision',
      structureName: '有 COMPLETE 决策',
      passed: records.some(r => (r.interactContent as any)?.response?.decision?.type === 'COMPLETE'),
      details: {}
    });

    // 检查最终的 response 记录
    const finalResponse = records.find(
      (record: any) => record.interactType === 'response' && 
                        record.interactContent?.response?.decision?.type === 'COMPLETE'
    );

    if (finalResponse) {
      const content = finalResponse.interactContent as any;
      
      // 检查 mcp_attempts 数量是否为2
      validations.push({
        structureId: 'two_mcp_attempts',
        structureName: 'mcp_attempts 应有2条记录',
        passed: hasTwoMcpAttempts(content),
        details: { 
          mcpAttemptsCount: content?.response?.mcp_attempts?.length || 0 
        }
      });

      // 检查是否有合规检查
      validations.push({
        structureId: 'has_compliance_check',
        structureName: '有合规检查记录',
        passed: hasComplianceCheck(content),
        details: {}
      });

      // 检查是否有公众号上传
      validations.push({
        structureId: 'has_wechat_upload',
        structureName: '有公众号上传记录',
        passed: hasWechatUpload(content),
        details: {}
      });

      // 检查合规检查是否在公众号上传之前
      if (hasComplianceCheck(content) && hasWechatUpload(content)) {
        validations.push({
          structureId: 'compliance_first',
          structureName: '合规检查应在公众号上传之前',
          passed: isComplianceCheckFirst(content),
          details: {}
        });
      }

      // 检查合规检查是否通过
      if (hasComplianceCheck(content)) {
        validations.push({
          structureId: 'compliance_passed',
          structureName: '合规检查应通过',
          passed: isComplianceCheckPassed(content),
          details: {}
        });
      }
    }

    return {
      scenarioId: 'TC-01B',
      scenarioName: '合规审核-直接发布场景',
      passed: validations.every(v => v.passed),
      validations,
      summary: validations.every(v => v.passed)
        ? '✅ 直接发布场景数据结构完整'
        : '❌ 直接发布场景数据结构不完整'
    };
  }
};

/**
 * TC-04: 公众号上传场景
 */
export const WECHAT_DRAFT_SCENARIO: BusinessScenarioValidation = {
  scenarioId: 'TC-04',
  scenarioName: '公众号上传场景',
  description: '验证公众号草稿上传的业务流程数据结构',
  requiredDataStructures: [
    { id: 'request', name: '执行Agent请求', description: '有初始请求记录', required: true, check: (c) => !!c },
    { id: 'mcp_attempts', name: 'MCP调用记录', description: '有公众号上传的MCP调用', required: true, check: hasMcpAttempts },
    { id: 'platform_publish', name: 'platform_publish 类型', description: '有 platform_publish 能力调用', required: true, check: (c) => true },
  ],
  validate: async (commandResultId: string, subTaskId: string) => {
    // 先查询所有记录，再在内存中过滤
    const allRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);
    
    const records = allRecords.filter(r => r.commandResultId === commandResultId);

    const validations: StructureValidation[] = [];

    validations.push({
      structureId: 'has_records',
      structureName: '有交互记录',
      passed: records.length > 0,
      details: { recordCount: records.length }
    });

    validations.push({
      structureId: 'has_mcp_attempts',
      structureName: '有 MCP 调用记录',
      passed: records.some(r => hasMcpAttempts(r.interactContent as any)),
      details: {}
    });

    return {
      scenarioId: 'TC-04',
      scenarioName: '公众号上传场景',
      passed: validations.every(v => v.passed),
      validations,
      summary: validations.every(v => v.passed)
        ? '✅ 公众号上传场景数据结构完整'
        : '❌ 公众号上传场景数据结构不完整'
    };
  }
};

/**
 * TC-23: 多次违规→多次整改→最终成功上传
 */
export const COMPLEX_COMPLIANCE_SCENARIO: BusinessScenarioValidation = {
  scenarioId: 'TC-23',
  scenarioName: '复杂合规审核-多次违规整改场景',
  description: '验证多次违规、多次整改后最终成功上传的完整业务流程数据结构（两阶段流程）',
  requiredDataStructures: [
    { id: 'multiple_rounds', name: '多轮交互', description: '有多轮 request/response', required: true, check: (c) => true },
    { id: 'violation_detection', name: '违规检测', description: '有违规检测记录', required: true, check: (c) => true },
    { id: 'mcp_attempts', name: '多次MCP调用', description: '有多轮MCP调用', required: true, check: (c) => true },
    { id: 'final_completion', name: '最终完成', description: '有最终COMPLETE决策', required: true, check: (c) => true },
    { id: 'two_mcp_attempts', name: '2条MCP记录', description: '最终mcp_attempts应有2条记录', required: true, check: hasTwoMcpAttempts },
    { id: 'compliance_check', name: '合规检查', description: '有合规检查记录', required: true, check: hasComplianceCheck },
    { id: 'wechat_upload', name: '公众号上传', description: '有公众号上传记录', required: true, check: hasWechatUpload },
    { id: 'compliance_first', name: '合规检查在先', description: '合规检查应在公众号上传之前', required: true, check: isComplianceCheckFirst },
  ],
  validate: async (commandResultId: string, subTaskId: string) => {
    // 先查询所有记录，再在内存中过滤
    const allRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);
    
    const records = allRecords.filter(r => r.commandResultId === commandResultId);

    const validations: StructureValidation[] = [];

    // 1. 检查是否有多轮记录
    const stepNos = [...new Set(records.map(r => r.stepNo))];
    validations.push({
      structureId: 'multiple_steps',
      structureName: '有多轮执行记录',
      passed: stepNos.length >= 2,
      details: { stepCount: stepNos.length, steps: stepNos }
    });

    // 2. 检查是否有 MCP 调用
    const totalMcpAttempts = records.reduce((count, record) => {
      const content = record.interactContent as any;
      const attempts = content?.response?.mcp_attempts;
      return count + (Array.isArray(attempts) ? attempts.length : 0);
    }, 0);

    validations.push({
      structureId: 'multiple_mcp_attempts',
      structureName: '有多次 MCP 调用',
      passed: totalMcpAttempts >= 2,
      details: { totalMcpAttempts }
    });

    // 3. 检查是否有最终 COMPLETE 决策
    const hasFinalComplete = records.some(r =>
      (r.interactContent as any)?.response?.decision?.type === 'COMPLETE'
    );

    validations.push({
      structureId: 'final_complete_decision',
      structureName: '有最终 COMPLETE 决策',
      passed: hasFinalComplete,
      details: {}
    });

    // 4. 检查最终的 response 记录的两阶段流程
    const finalResponse = records.find(
      (record: any) => record.interactType === 'response' && 
                        record.interactContent?.response?.decision?.type === 'COMPLETE'
    );

    if (finalResponse) {
      const content = finalResponse.interactContent as any;
      
      // 4.1 检查 mcp_attempts 数量是否为2
      validations.push({
        structureId: 'two_mcp_attempts_final',
        structureName: '最终 mcp_attempts 应有2条记录',
        passed: hasTwoMcpAttempts(content),
        details: { 
          mcpAttemptsCount: content?.response?.mcp_attempts?.length || 0 
        }
      });

      // 4.2 检查是否有合规检查
      validations.push({
        structureId: 'has_compliance_check_final',
        structureName: '最终有合规检查记录',
        passed: hasComplianceCheck(content),
        details: {}
      });

      // 4.3 检查是否有公众号上传
      validations.push({
        structureId: 'has_wechat_upload_final',
        structureName: '最终有公众号上传记录',
        passed: hasWechatUpload(content),
        details: {}
      });

      // 4.4 检查合规检查是否在公众号上传之前
      if (hasComplianceCheck(content) && hasWechatUpload(content)) {
        validations.push({
          structureId: 'compliance_first_final',
          structureName: '合规检查应在公众号上传之前',
          passed: isComplianceCheckFirst(content),
          details: {}
        });
      }

      // 4.5 检查合规检查是否通过
      if (hasComplianceCheck(content)) {
        validations.push({
          structureId: 'compliance_passed_final',
          structureName: '合规检查应通过',
          passed: isComplianceCheckPassed(content),
          details: {}
        });
      }
    }

    return {
      scenarioId: 'TC-23',
      scenarioName: '复杂合规审核-多次违规整改场景',
      passed: validations.every(v => v.passed),
      validations,
      summary: validations.every(v => v.passed)
        ? '✅ 复杂合规场景数据结构完整'
        : '❌ 复杂合规场景数据结构不完整'
    };
  }
};

// ==================== 场景映射 ====================

export const SCENARIO_VALIDATORS: Record<string, BusinessScenarioValidation> = {
  '1A': COMPLIANCE_VIOLATION_SCENARIO,
  '1B': COMPLIANCE_DIRECT_SCENARIO,
  '4': WECHAT_DRAFT_SCENARIO,
  '23': COMPLEX_COMPLIANCE_SCENARIO,
  '24': COMPLIANCE_DIRECT_SCENARIO, // TC-24 复用 TC-01B 的验证
  '25': COMPLIANCE_VIOLATION_SCENARIO, // TC-25 复用 TC-01A 的验证
};

/**
 * 根据测试案例ID获取对应的场景验证器
 */
export function getScenarioValidator(testCaseId: string): BusinessScenarioValidation | null {
  return SCENARIO_VALIDATORS[testCaseId] || null;
}

/**
 * 执行业务场景级数据完整性验证
 */
export async function validateBusinessScenario(
  testCaseId: string,
  commandResultId: string,
  subTaskId: string
): Promise<ScenarioValidationResult | null> {
  const validator = getScenarioValidator(testCaseId);
  if (!validator) {
    return null;
  }

  return await validator.validate(commandResultId, subTaskId);
}
