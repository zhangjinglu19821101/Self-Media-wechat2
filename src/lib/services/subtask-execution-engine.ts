/**
 * 子任务执行引擎
 * 
 * 完整实现 Coze MCP 能力体系交互流程
 * 
 * 功能：
 * - 阶段1：执行Agent能力边界判定
 * - 阶段2：Agent B解决方案选型
 * - 阶段3：执行 capability
 * - 阶段4：返回给执行Agent继续执行
 * - 阶段5：保存最终结果
 * 
 * @docs /docs/最新流程交互图.md
 */

import { db } from '@/lib/db';
import { 
  agentSubTasks, 
  agentSubTasksStepHistory, 
  agentSubTasksMcpExecutions,
  capabilityList,
  dailyTask,
  agentReports
} from '@/lib/db/schema';
import { coreAnchorAssets } from '@/lib/db/schema/digital-assets';
import { eq, and, or, lte, desc, inArray, notInArray, lt, gte, sql, isNull, asc } from 'drizzle-orm';
import { Branch1IntelligentExecutor } from '@/lib/mcp/branch1-intelligent-executor';
import { genericMCPCall } from '@/lib/mcp/generic-mcp-call';
import { callLLM } from '@/lib/agent-llm';

import { AgentCapabilityService } from '@/lib/services/agent-capability-service';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { reportToAgentA } from '@/lib/agents/agent-b/report-to-agent-a';
import { promptAssemblerService } from '@/lib/services/prompt-assembler-service';
import { digitalAssetService } from '@/lib/services/digital-asset-service';
import { loadAgentPrompt, loadFeaturePrompt } from '@/lib/agents/prompt-loader';
import { isWritingAgent, getPlatformForExecutor, WRITING_AGENT_INFO, WRITING_AGENTS } from '@/lib/agents/agent-registry';
import { isVirtualExecutor, USER_PREVIEW_EDIT_EXECUTOR } from '@/lib/agents/flow-templates';
import { 
  extractResultTextFromResultData as extractResultTextCore,
  serializeOutlineToText,
  serializeResultToFallbackText,
  isValidContentText
} from '@/lib/services/result-text-extractor';

// N3修复：insurance-d 专属任务上下文类型（这些字段来自创作引导，非数据库列）
interface InsuranceDTaskExtension {
  userOpinion?: string;
  materialIds?: string[];      // 🔥 新增：素材ID列表
  relatedMaterials?: string;   // 🔥 新增：关联素材补充区
  targetWordCount?: string;
  structureName?: string;
  structureDetail?: string;
  // Phase 3 大纲确认新增字段
  confirmedOutline?: string;       // 用户确认后的大纲内容（子任务B使用）
  subTaskRole?: 'outline_generation' | 'full_article'; // 大纲确认双子任务角色
}

// 【P2修复】重执行历史记录项类型
interface ReexecuteHistoryItem {
  executor: string;
  previousExecutor?: string;
  reason: string;
  decisionType: string;
  timestamp: string;
  status: 'pending' | 'completed';
  executionResult?: {
    success: boolean;
    mcpSuccess?: boolean;
    isTaskDown?: boolean;
    executorResult?: unknown;
  };
}

// 【P2修复】任务 metadata 类型定义，替代 as any
// 两阶段架构 metadata 扩展
interface TwoPhaseTaskMetadata extends TaskMetadata {
  phase?: 'base_article' | 'platform_adaptation';
  multiPlatformGroupId?: string;
  sourceCommandResultId?: string;
  adaptationPlatform?: string;
}

interface TaskMetadata {
  reexecuteHistory?: ReexecuteHistoryItem[];
  lastExecutedExecutor?: string;
  lastExecutionType?: string;
  lastAgentBDecision?: unknown;
  lastReexecuteTimestamp?: string;
  executorChange?: {
    from: string;
    to: string;
    reason: string;
    changedAt: string;
    changedBy: string;
  };
  // 两阶段架构字段（P2-5 修复：添加精确类型，而非 Record<string, any>）
  phase?: 'base_article' | 'platform_adaptation';
  multiPlatformGroupId?: string;
  sourceCommandResultId?: string;
  adaptationPlatform?: string;
  [key: string]: unknown; // 允许其他动态字段
}

import { ArticleContentService } from './article-content-service';
import { ArticleReviewService } from './article-review-service';
import { 
  createInitialArticleMetadata, 
  updateArticleMetadataStep,
  type ArticleMetadata 
} from '@/lib/types/article-metadata';

// ============================================
// 🔥 多平台发布：平台上下文前缀构建
// ============================================
const PLATFORM_GUIDELINES: Record<string, string> = {
  '微信公众号': '请按照微信公众号文章风格创作：标题≤64字，正文深度长文，HTML排版，专业语气',
  '小红书': `请按照小红书图文笔记风格创作，输出必须严格遵循以下JSON格式：
{
  "title": "标题（≤20字，悬念/反差感，吸引眼球）",
  "intro": "副标题/引言（≤30字）",
  "points": [
    {"title": "要点1标题（≤15字，核心结论）", "content": "要点1详细内容（≤80字，用于文字区展开）"},
    {"title": "要点2标题", "content": "要点2详细内容"},
    {"title": "要点3标题", "content": "要点3详细内容"},
    {"title": "要点4标题", "content": "要点4详细内容"},
    {"title": "要点5标题", "content": "要点5详细内容"}
  ],
  "conclusion": "总结语（≤50字）",
  "tags": ["标签1", "标签2", "标签3"],
  "fullText": "完整正文文字（800-1000字，emoji点缀、短段落、数字编号、口语化、像朋友聊天）"
}
【图文分工原则（重要！）】
本系统采用"图片+文字"双通道输出模式：
🖼️ 图片卡片：渲染 points 的 title（核心结论），读者1秒扫完获取要点
📝 文字区域：展示 fullText（完整论证），包含数据、案例、推理过程
→ points.title = 放在图上的金句/结论（简短有力）
→ fullText = 放在文字区的完整版（详细展开）
→ content 字段 = 补充说明（不渲染到图片上，仅用于上下文）

格式要求：
1. title：用反差/悬念/揭秘式标题（如"我已经不卖XX了，但我能告诉你真相"）
2. points：3-5个核心要点，每个要点的 title 是结论性金句（会渲染到图片卡片上）
3. fullText：完整的正文文字版本，包含emoji、分段、编号，用于小红书文字区域
4. tags：3-5个话题标签，不带#号
5. 语气：亲切、口语化、大白话、像朋友聊天、多用emoji
6. 重点：干货要突出，每点先说结论再说原因
7. 必须输出合法JSON，不要在JSON外添加其他文字`,
  '知乎': '请按照知乎回答风格创作：标题为问题形式，正文专业深度，逻辑清晰，数据说话',
  '抖音': '请按照抖音视频脚本风格创作：标题≤30字，正文≤300字，口语化，节奏感强，开头抓人',
  '微博': '请按照微博正文风格创作：正文≤140字，话题标签，简洁有力，热点关联',
};

function buildPlatformContextPrefix(
  platformLabel: string,
  platformGroupTotal: number,
  options?: { hasImageStructureRules?: boolean }
): string {
  if (!platformLabel) return '';
  let guideline = PLATFORM_GUIDELINES[platformLabel] || `请按照${platformLabel}的内容规范创作`;

  // 🔥 P1-S06 修复：当模板中存在 image_structure 规则时，精简静态 GUIDELINES 中的"图文分工原则"部分
  // 避免与动态规则重复，让 insurance-d 以模板规则为准（更精确、更个性化）
  if (options?.hasImageStructureRules && platformLabel === '小红书') {
    guideline = guideline.replace(
      /【图文分工原则（重要！）】[\s\S]*?→ content 字段 = 补充说明（不渲染到图片上，仅用于上下文）\n\n/,
      '【图文分工】已根据模板中的「图文结构」规则自动配置（详见下方风格规则区的 image_structure 部分）\n\n'
    );
  }

  const multiPlatformNote = platformGroupTotal > 1
    ? `（本文为${platformLabel}专属版本，与其他平台版本风格不同）`
    : '';
  return `【目标平台：${platformLabel}】${multiPlatformNote}${guideline}\n\n`;
}

// ============================================
// 🔴 超时配置常量
// ============================================
const IN_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000; // 10分钟超时

// 🔴 新增：导入执行结果类型
import { 
  ExecutorDirectResult, 
  hasStructuredResult, 
  fillLegacyFields 
} from '@/lib/types/agent-execution-result';

// 🔴 新增：导入增强JSON解析器
import { JsonParserEnhancer } from '@/lib/utils/json-parser-enhancer';

// 🔴 重构：导入统一响应解析器和格式适配器
import { AgentResponseParser } from './agent-response-parser';
import { AgentBFormatAdapter } from '@/lib/utils/agent-b-format-adapter';

// 🔴 新增：Agent T（技术专家）提示词
import { 
  AGENT_T_TECH_EXPERT_SYSTEM_PROMPT, 
  buildAgentTTechExpertUserPrompt 
} from '@/lib/agents/prompts/agent-t-tech-expert';

// 🔴 新增：Agent B（业务流程控制专家）提示词
import { 
  AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT, 
  buildAgentBBusinessControllerUserPrompt,
  AGENT_B_OUTPUT_FORMAT
} from '@/lib/agents/prompts/agent-b-business-controller';

// 🔴 Phase 4 新增：文章校验服务
import { articleValidationService, type ValidationResult } from './article-validation-service';

// 🔴 Phase 5 新增：LLM 辅助规则提取 + 风格相似度评估
import { llmAssistedRuleService, type EmotionClassificationResult } from './llm-assisted-rule-service';
import { styleSimilarityService, type StyleConsistencyResult } from './style-similarity-service';

// 🔴 新增：执行者身份配置
import { buildExecutorIdentityText } from '@/lib/agents/prompt-loader';



interface ExecutorAgentResult {
  // 🔴🔴🔴 新增：支持 isCompleted 字段
  isCompleted: boolean;
  
  isNeedMcp: boolean;
  problem?: string;
  capabilityType?: string;
  resultData?: any;
  isTaskDown: boolean;
  
  // 🔴 新增：执行 Agent 的完整输出
  executorOutput?: {
    // 执行结论声明（最重要！）
    result?: string;
    // 🔴 统一使用 output 字段存放执行结果内容
    output?: string;
    // 执行 Agent 的建议
    suggestions?: string;
    // 执行 Agent 的思考过程
    reasoning?: string;
    // 结构化结果（如果有）
    structuredResult?: any;
    // 其他补充信息
    additionalInfo?: Record<string, any>;
  };
  
  // 🔴🔴🔴 【新增】失败原因和决策内容（关键字段！）
  failureReason?: string;
  decisionContent?: {
    reason?: string;
    result?: string;
    isCompleted?: boolean;
  };
  
  // 🔴🔴🔴 【新增】执行结果概述字段
  briefResponse?: string;
  selfEvaluation?: string;
  executionSummary?: {
    actionsTaken?: string[];
    toolsUsed?: string[];
    resultContent?: any;
    failureReason?: string;
  };
  
  // 🔴🔴🔴 【新增】自动拆分相关字段
  isNeedSplit?: boolean;
  splitReason?: string;
  suggestedSplitPoints?: string[];
}

/**
 * 🔴 类型转换器：ExecutorDirectResult → ExecutorAgentResult
 * 解决类型不匹配导致的解析失败问题
 */
function convertExecutorDirectToAgentResult(
  directResult: ExecutorDirectResult
): ExecutorAgentResult {
  // 🔴 统一提取 output 字段
  let outputContent: string | undefined;
  let suggestions: string | undefined;
  let reasoning: string | undefined;
  let structuredResult: any;
  let additionalInfo: Record<string, any> | undefined;
  
  // 🔴🔴🔴 【统一辅助函数】从 resultContent 中提取纯文本
  // resultContent 可能是：纯文本 / JSON字符串 / 对象
  // 统一提取为纯文本，不再把 JSON 原样塞进 output
  const extractPlainText = (rc: any): string | undefined => {
    if (!rc) return undefined;
    if (typeof rc === 'string') {
      // 可能是纯文本，也可能是 JSON 字符串
      if (rc.startsWith('{') || rc.startsWith('[')) {
        try {
          const parsed = JSON.parse(rc);
          if (typeof parsed === 'object' && parsed !== null) {
            // 对象：优先取 content，其次取 outlineText
            if (typeof parsed.content === 'string' && parsed.content.trim().length > 0) {
              return parsed.content;
            }
            if (typeof parsed.outlineText === 'string' && parsed.outlineText.trim().length > 0) {
              return parsed.outlineText;
            }
          }
        } catch {
          // JSON 解析失败，当纯文本用
        }
      }
      return rc.trim().length > 0 ? rc : undefined;
    }
    if (typeof rc === 'object' && !Array.isArray(rc)) {
      // 对象：优先取 content，其次取 outlineText
      if (typeof rc.content === 'string' && rc.content.trim().length > 0) {
        return rc.content;
      }
      if (typeof rc.outlineText === 'string' && rc.outlineText.trim().length > 0) {
        return rc.outlineText;
      }
    }
    return undefined;
  };
  
  // 🔴🔴🔴 P0-2 修复：保留 LLM 原始 result（执行结论声明），不再覆盖为 HTML 正文
  // executorOutput.result = LLM 的 result 字段（"【执行结论】..."）
  // executorOutput.output = 从 structuredResult.resultContent 提取的正文内容（HTML/纯文本）
  const originalResult = typeof directResult.result === 'string'
    ? directResult.result
    : (directResult.result?.content || directResult.result?.output || '');

  if (directResult.structuredResult && typeof directResult.structuredResult === 'object') {
    structuredResult = directResult.structuredResult;
    
    // 🔴🔴🔴 【关键修复】从 resultContent 提取纯文本，不再原样塞 JSON
    // 优先级：executionSummary.resultContent > resultContent > output
    const srResultContent = structuredResult.executionSummary?.resultContent || structuredResult.resultContent;
    const plainText = extractPlainText(srResultContent);
    if (plainText && plainText.length > 50) {
      outputContent = plainText;
    } else if (directResult.output) {
      // structuredResult 里没有内容，从 output 提取
      outputContent = directResult.output;
    }
    
    suggestions = structuredResult.completionJudgment?.suggestions;
    reasoning = structuredResult.executionSummary?.actionsTaken?.join(', ');
  }
  // 🔴 其次从 directResult.output 提取（insurance-d 使用此字段）
  else if (directResult.output) {
    outputContent = directResult.output;
  } else {
    // 从 legacy 字段提取（仅当没有 structuredResult 时）
    if (directResult.result) {
      if (typeof directResult.result === 'string') {
        outputContent = directResult.result;
      } else if (directResult.result?.content || directResult.result?.output) {
        outputContent = directResult.result.content || directResult.result.output;
      }
    }
    suggestions = directResult.suggestion;
  }
  
  // 判断是否需要 MCP
  // 🔴🔴🔴 【修复】isNeedMcp 应该根据 needsMcpSupport 或 mcpParams 字段判断
  // 而不是简单地取反 isCompleted！
  // isCompleted = false 只表示任务无法完成（可能缺少信息），不代表需要 MCP
  const isCompleted = directResult.isCompleted;
  
  // 🔥 修复：只有明确需要 MCP 支持时才设置 isNeedMcp = true
  // 检查路径：
  // 1. directResult.needsMcpSupport = true
  // 2. directResult.mcpParams 存在
  // 3. structuredResult 中明确表示需要 MCP
  const needsMcpFromResult = directResult.needsMcpSupport === true;
  const hasMcpParams = !!(directResult.mcpParams && Object.keys(directResult.mcpParams).length > 0);
  const needsMcpFromStructured = structuredResult?.needsMcpSupport === true || 
                                  structuredResult?.executionSummary?.needsMcpSupport === true;
  
  const isNeedMcp = needsMcpFromResult || hasMcpParams || needsMcpFromStructured;
  
  // 🔥 修复：isTaskDown 应该根据实际完成状态判断
  // isTaskDown = true 表示执行 Agent 确认任务已完成
  const isTaskDown = directResult.isCompleted === true;
  
  // 从 result 字段中提取无法执行的原因
  // 🔴 P0-2 修复：使用原始 result（执行结论）判断问题，而非 HTML 正文
  let problem: string | undefined;
  if (isNeedMcp && !isTaskDown) {
    if (suggestions) {
      problem = suggestions;
    } else if (originalResult && originalResult.includes('【无法执行】')) {
      problem = originalResult;
    } else {
      problem = '执行 Agent 需要帮助';
    }
  }
  
  // 🔴🔴🔴 P0-1 修复：将 briefResponse/selfEvaluation/executionSummary 传递到顶层
  // 前端从 step_history 的 responseContent 中提取这些字段，必须存在于顶层
  const briefResponse = typeof directResult.briefResponse === 'string'
    ? directResult.briefResponse
    : undefined;
  const selfEvaluation = typeof directResult.selfEvaluation === 'string'
    ? directResult.selfEvaluation
    : undefined;
  const executionSummaryFromDirect = structuredResult?.executionSummary
    ? { ...structuredResult.executionSummary }
    : undefined;

  const agentResult: ExecutorAgentResult = {
    isCompleted: isCompleted,
    isNeedMcp,
    isTaskDown,
    problem: problem,
    briefResponse,
    selfEvaluation,
    executionSummary: executionSummaryFromDirect,
    executorOutput: {
      result: originalResult,  // 🔴 P0-2：使用原始 result（执行结论声明，如"【执行结论】..."）
      output: outputContent,                       // 正文内容（HTML/纯文本）
      suggestions,
      reasoning,
      structuredResult,
      additionalInfo
    }
  };
  
  return agentResult;
}



// MCP尝试记录
export interface McpAttempt {
  attemptId: string;
  attemptNumber: number;
  timestamp: Date;
  decision: {
    solutionNum: number;
    toolName: string;
    actionName: string;
    reasoning: string;
    strategy: 'initial' | 'retry' | 'switch_type' | 'degrade' | 'idempotent_skip';
    orderIndex: number;  // 🔴🔴🔴 【修复】添加 orderIndex 字段，用于区分当前任务和前序任务的 MCP 结果
  };
  params: {
    accountId: string;
    [key: string]: any;
  };
  result: {
    status: 'success' | 'failed' | 'partial';
    data?: any;
    error?: {
      code: string;
      message: string;
      type: 'network' | 'timeout' | 'permission' | 'not_found' | 'unknown';
    };
    executionTime: number;
  };
  failureAnalysis?: {
    isRetryable: boolean;
    failureType: 'temporary' | 'resource_unavailable';
    suggestedNextAction: 'retry_same' | 'switch_method';
  };
}

// Agent T 响应类型（Executor 标准格式 - 与 insurance-d 一致）
export interface AgentTDecision {
  // 🔴 核心：任务是否完成
  isCompleted: boolean;
  
  // 🔴 执行结论（必须以【执行结论】开头）
  result: string;
  
  // 🔴 无法处理的原因（isCompleted=false 时必填）
  reason?: string;
  
  // 🔴 建议（可选）
  suggestion?: string;
  
  // 🔴🔴🔴 AUTO_SPLIT 相关字段
  type?: 'AUTO_SPLIT' | 'auto_split' | string;
  context?: {
    splitStrategy?: string;
    splitReason?: string;
    suggestedSplitPoints?: string[];
  };
  isNeedSplit?: boolean;
  splitReason?: string;
  suggestedSplitPoints?: string[];
  reasonCode?: string;
  reasoning?: string;
  
  // 🔴 结构化结果
  structuredResult?: {
    originalInstruction: {
      title: string;
      description: string;
    };
    executionSummary: {
      needsMcpSupport: boolean;
      actionsTaken: string[];
      toolsUsed: string[];
      resultContent?: any;
      failureReason?: string;
    };
  };
  
  // 🔴 MCP 参数（如果需要执行 MCP）
  mcpParams?: {
    solutionNum: number;
    toolName: string;
    actionName: string;
    params: Record<string, any>;
  };
}

// 用户交互记录
interface UserInteraction {
  interactionId: string;
  interactionNumber: number;
  timestamp: Date;
  keyFieldsConfirmed: {
    fieldId: string;
    fieldName: string;
    fieldValue: any;
    originalValue?: any;
    isModified: boolean;
  }[];
  selectedSolution: {
    solutionId: string;
    solutionLabel: string;
    solutionDescription: string;
    selectedAt: Date;
  };
  userComment?: {
    content: string;
    inputAt: Date;
  };
  userInfo: {
    userId: string;
    userName?: string;
    department?: string;
  };
  submission: {
    submittedAt: Date;
    status: 'completed' | 'timeout' | 'rejected';
    processingTime: number;
  };
}

// 可选方案
interface AvailableSolution {
  solutionId: string;
  label: string;
  description: string;
  pros?: string[];
  cons?: string[];
  estimatedTime?: number;
}

// Agent B标准化决策输出
export interface AgentBDecision {
  type: 'EXECUTE_MCP' | 'COMPLETE' | 'NEED_USER' | 'FAILED'|'REEXECUTE_EXECUTOR';
  reasonCode: 
    | 'MCP_CONTINUE'
    | 'MCP_RETRY'
    | 'MCP_NEXT_STEP'
    | 'TASK_DONE'
    | 'NO_MCP_NEEDED'
    | 'USER_CONFIRM'
    | 'USER_SELECT'
    | 'USER_INPUT'
    | 'MAX_RETRY_EXCEEDED'
    | 'MCP_ERROR_UNRECOVERABLE'
    | 'CAPABILITY_NOT_FOUND'
    | 'USER_REJECT'
    | 'BUSINESS_RULE_VIOLATION'
    | 'UNKNOWN_ERROR'
    | 'MCP_AUDIT_COMPLETE';
  reasoning: string;
  
  /**
   * 🔴 【新增】判断依据
   * - 详细说明为什么做这个决策
   * - 包括参考了哪些信息、应用了什么规则等
   */
  decisionBasis?: string;
  
  /**
   * 🔴 【新增】为什么不是 COMPLETE？
   * - 当返回非 COMPLETE 决策时，必须填写此字段
   * - 用于诊断 Agent B 为什么没有标记任务完成
   * - 可能的值：
   *   - "mcp_result_pending": MCP 正在执行中
   *   - "awaiting_user_confirmation": 等待用户确认
   *   - "mcp_failed_need_retry": MCP 失败，需要重试
   *   - "business_rule_violation": 违反业务规则
   *   - "insufficient_result": MCP 结果不完整或不满足条件
   *   - "explicit_user_request": 用户明确要求暂停
   *   - "max_iterations_reached": 达到最大迭代次数
   *   - "none": 不需要说明（当决策为 COMPLETE 时）
   */
  notCompletedReason?: string;
  
  /**
   * 🔴 【新增】评审结论描述
   * - Agent B 对本次评审的简要结论
   * - 不超过120字
   * - 用于在交互历史中快速展示评审结果
   */
  reviewConclusion?: string;
  
  context: {
    executionSummary: string;
    riskLevel: 'low' | 'medium' | 'high';
    suggestedAction: string;
    /**
     * 🔴 【新增】建议的执行者 ID
     * - 当 Agent B 发现任务不属于当前执行者时，填写此字段
     * - 例如：'insurance-d'、'agent T' 等
     */
    suggestedExecutor?: string;
  };
  data?: {
    from_parents_executor?: string;  // 🔴 REEXECUTE_EXECUTOR 场景：指定新的执行者
    mcpParams?: {
      solutionNum: number;
      toolName: string;
      actionName: string;
      params: any;
    };
    completionResult?: any;
    pendingKeyFields?: {
      fieldId: string;
      fieldName: string;
      fieldType: 'text' | 'number' | 'select' | 'date' | 'boolean';
      description: string;
      currentValue: any;
      options?: any[];
      validationRules?: {
        required: boolean;
        min?: number;
        max?: number;
        pattern?: string;
      };
    }[];
    availableSolutions?: AvailableSolution[];
    promptMessage?: {
      title: string;
      description: string;
      deadline?: Date;
      priority?: 'low' | 'medium' | 'high';
    };
    failedDetails?: {
      errorType: string;
      errorMessage: string;
      recoverable: boolean;
      suggestedFix?: string;
    };
  };
}

// 兼容旧接口的AgentBOutput
interface AgentBOutput {
  action: 'EXECUTE_MCP' | 'FAILED' | 'NEED_USER';
  solutionNum?: number;
  toolName?: string;
  actionName?: string;
  params?: any;
  reasoning?: string;
  failedReason?: string;
  userMessage?: string;
}

// 执行上下文
interface ExecutionContext {
  executorFeedback: {
    // 🔴 新增：执行 Agent 的核心判断字段
    isNeedMcp: boolean;
    isTaskDown: boolean;
    // 🔴🔴🔴 新增：isNeedSplit 相关字段（自动拆分功能）
    isNeedSplit: boolean;
    splitReason: string;
    suggestedSplitPoints: string[];
    
    originalTask: string;
    problem: string;
    attemptedSolutions: string[];
    suggestedApproach?: string;
    executionLogs?: any[];
    // 🔴 统一使用 output 字段
    executorOutput?: {
      output?: string;
      suggestions?: string;
      reasoning?: string;
      structuredResult?: any;
      additionalInfo?: Record<string, any>;
    };
    // 🔴🔴🔴 【新增】失败原因和决策内容（关键字段！）
    failureReason?: string;
    decisionContent?: {
      reason?: string;
      result?: string;
      isCompleted?: boolean;
    };
    // 🔴🔴🔴 【新增】执行结果概述字段
    briefResponse?: string;
    selfEvaluation?: string;
    executionSummary?: {
      actionsTaken?: string[];
      toolsUsed?: string[];
      resultContent?: any;
    };
  };
  mcpExecutionHistory: McpAttempt[];
  userFeedback?: {
    feedbackType: 'select' | 'input' | 'confirm';
    userInput: any;
    feedbackTime: Date;
    userId?: string;
  };
  // 🔴 新增：最高决策优先级的用户建议
  latestUserDecision?: AgentBDecision | null;
  taskMeta: {
    taskId: string;
    taskType: string;
    priority: 'low' | 'medium' | 'high';
    createdAt: Date;
    timeoutAt?: Date;
    iterationCount: number;
    maxIterations: number;
    taskTitle?: string;
  };
  availableCapabilities: any[];
  // 🔴 新增：上一步骤输出结果（不仅仅是文章内容）
  priorStepOutput?: string;
  // 🔥 用户观点和素材（insurance-d 必须遵守）
  userOpinionAndMaterials?: {
    userOpinion?: string;
    materials?: Array<{ id: string; title: string; type: string; content: string; sourceDesc?: string }>;
    relatedMaterials?: string;
  };
}



export class SubtaskExecutionEngine {

  // 🔒 进程级执行锁：防止同一进程内并发执行 engine.execute()
  // 🔴 唯一权威锁：cron 层和其他调用方通过 isCurrentlyExecuting() 委托查询
  private static isExecuting = false;
  private static executionStartTime: Date | null = null;
  private static readonly EXECUTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟超时

  /**
   * 🔒 查询引擎是否正在执行（供外部调用方使用）
   * 包含超时自动释放逻辑
   */
  static isCurrentlyExecuting(): boolean {
    if (!SubtaskExecutionEngine.isExecuting) {
      return false;
    }
    // 超时强制释放（防止死锁）
    if (SubtaskExecutionEngine.executionStartTime &&
        Date.now() - SubtaskExecutionEngine.executionStartTime.getTime() > SubtaskExecutionEngine.EXECUTION_TIMEOUT_MS) {
      console.warn('[SubtaskEngine] 🔒 引擎执行超时，强制解锁');
      SubtaskExecutionEngine.isExecuting = false;
      SubtaskExecutionEngine.executionStartTime = null;
      return false;
    }
    return true;
  }

  /**
   * 获取引擎执行状态（用于监控）
   */
  static getExecutionStatus(): {
    isRunning: boolean;
    startTime: Date | null;
    runningDurationMs: number | null;
  } {
    return {
      isRunning: SubtaskExecutionEngine.isExecuting,
      startTime: SubtaskExecutionEngine.executionStartTime,
      runningDurationMs: SubtaskExecutionEngine.executionStartTime
        ? Date.now() - SubtaskExecutionEngine.executionStartTime.getTime()
        : null,
    };
  }

  /**
   * 🔴 新增：执行特定的 command_result_id 和 order_index（用于测试）
   * @param commandResultId 指令结果 ID
   * @param orderIndex 顺序索引（可选，不指定则执行该 command_result_id 下所有需要处理的任务）
   */
  async executeSpecificTask(commandResultId: string, orderIndex?: number) {
    console.log('');
    console.log('[SubtaskEngine] 🔴🔴🔴 ========== 执行特定任务（测试模式） ========== 🔴🔴🔴');
    console.log('[SubtaskEngine] 测试参数:', {
      command_result_id: commandResultId,
      order_index: orderIndex,
      execution_time: new Date().toISOString()
    });

    try {
      // 查询指定的任务
      let query = db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, commandResultId));
      
      // 如果指定了 orderIndex，增加这个条件
      if (orderIndex !== undefined) {
        query = query.where(eq(agentSubTasks.orderIndex, orderIndex));
      }
      
      const tasks = await query.orderBy(agentSubTasks.orderIndex);
      
      console.log('[SubtaskEngine] 🔴 查询到的任务:', {
        total_count: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          command_result_id: t.commandResultId,
          order_index: t.orderIndex,
          status: t.status,
          executor: t.fromParentsExecutor,
          task_title: t.taskTitle?.substring(0, 80)
        }))
      });

      if (tasks.length === 0) {
        console.log('[SubtaskEngine] 没有找到指定的任务，结束');
        console.log('[SubtaskEngine] 🔴🔴🔴 ========== 特定任务执行结束（无任务） ========== 🔴🔴🔴');
        return { success: false, message: '没有找到指定的任务', tasksFound: 0 };
      }

      // 处理任务
      await this.processGroup(tasks);

      console.log('[SubtaskEngine] 特定任务执行完成');
      console.log('[SubtaskEngine] 🔴🔴🔴 ========== 特定任务执行结束（成功） ========== 🔴🔴🔴');
      
      return { 
        success: true, 
        message: '特定任务执行完成', 
        tasksFound: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          command_result_id: t.commandResultId,
          order_index: t.orderIndex
        }))
      };
    } catch (error) {
      console.error('[SubtaskEngine] 特定任务执行失败:', error);
      throw error;
    }
  }

  async execute() {
    // 🔒 进程级并发控制（单一权威锁）
    if (SubtaskExecutionEngine.isCurrentlyExecuting()) {
      console.log('[SubtaskEngine] 🔒 引擎已在执行中，跳过本次调用');
      return;
    }

    SubtaskExecutionEngine.isExecuting = true;
    SubtaskExecutionEngine.executionStartTime = new Date();

    console.log('');
    console.log('[SubtaskEngine] ========== 子任务引擎开始执行 ==========');
    console.log('[SubtaskEngine] 执行信息:', {
      execution_time: new Date().toISOString(),
    });

    try {
      // 查询状态：'pending'、'in_progress'、'pre_completed'、'pre_need_support'
      const pendingTasks = await this.getPendingTasks();
      console.log('[SubtaskEngine] 🔴 从数据库查询到的待执行任务:', {
        total_count: pendingTasks.length,
        tasks: pendingTasks.map(t => ({
          id: t.id,
          command_result_id: t.commandResultId,
          order_index: t.orderIndex,
          status: t.status,
          executor: t.fromParentsExecutor,
          task_title: t.taskTitle?.substring(0, 80)
        }))
      });

      if (pendingTasks.length === 0) {
        console.log('[SubtaskEngine] 没有待执行任务，结束');
        console.log('[SubtaskEngine] 🔴🔴🔴 ========== 子任务引擎执行结束（无任务） ========== 🔴🔴🔴');
        return;
      }

      const groupedTasks = this.groupTasks(pendingTasks);
      console.log('[SubtaskEngine] 分组完成:', {
        total_groups: Object.keys(groupedTasks).length,
        group_ids: Object.keys(groupedTasks)
      });

      // 🔴 直接使用分组，无需防重（定时任务重复调用问题已在 scheduler.ts 源头修复）
      if (Object.keys(groupedTasks).length === 0) {
        console.log('[SubtaskEngine] 没有待处理的分组，跳过执行');
        console.log('[SubtaskEngine] ========== 子任务引擎执行结束 ==========');
        return;
      }

      for (const [groupId, tasks] of Object.entries(groupedTasks)) {
        console.log('[SubtaskEngine] 开始处理分组:', {
          command_result_id: groupId,
          tasks_count: tasks.length,
          order_indexes: [...new Set(tasks.map(t => t.orderIndex))].sort((a, b) => a - b).join(', ')
        });
        await this.processGroup(tasks);
      }

      console.log('[SubtaskEngine] 执行完成');
    } catch (error) {
      console.error('[SubtaskEngine] 执行失败:', error);
      throw error;
    } finally {
      // 🔒 无论成功失败，释放进程级锁
      SubtaskExecutionEngine.isExecuting = false;
      SubtaskExecutionEngine.executionStartTime = null;
    }
  }

  private async getPendingTasks() {
    // 使用北京时间获取今天的日期
    const now = getCurrentBeijingTime();
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    
    // 🔴🔴🔴 【修复】同时包含 executionDate 为 NULL 的任务，确保新创建的任务也能被处理
    return await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          or(
            isNull(agentSubTasks.executionDate),  // 🔴 新增：包含 executionDate 为 NULL 的任务
            lte(agentSubTasks.executionDate, today)
          ),
          or(
            eq(agentSubTasks.status, 'pending'),
            eq(agentSubTasks.status, 'in_progress'),
            eq(agentSubTasks.status, 'pre_completed'),
            eq(agentSubTasks.status, 'pre_need_support'),
            eq(agentSubTasks.status, 'auto_split')  // 🔴🔴🔴 AUTO_SPLIT 状态
            // 注意：不包含 'waiting_user' —— 该状态需等待用户手动确认，定时任务不应触碰
          )
        )
      )
      .orderBy(agentSubTasks.commandResultId, agentSubTasks.orderIndex);
  }

  private groupTasks(tasks: typeof agentSubTasks.$inferSelect[]) {
    const groups: Record<string, typeof agentSubTasks.$inferSelect[]> = {};

    for (const task of tasks) {
      // 确保同一个 commandResultId 的任务在一起，严格按照 orderIndex 顺序执行
      const groupId = task.commandResultId;
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(task);
    }

    return groups;
  }

  private async processGroup(tasks: typeof agentSubTasks.$inferSelect[]) {
    const groupId = tasks[0]?.commandResultId;

    console.log('[SubtaskEngine] ========== 开始处理分组 ==========', {
      command_result_id: groupId,
      needing_attention_count: tasks.length,
    });

    // 🔴 全量查询该分组所有任务（含 waiting_user/completed 等所有状态）
    // 仅此一次查询，后续均从中 filter，避免多次 DB 查询
    const allTasksInGroup = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, groupId));

    const allOrderIndexes = [...new Set(allTasksInGroup.map(t => t.orderIndex))].sort((a, b) => a - b);

    // 基于全量数据：找到第一个未完成的 order_index
    // 只有 'completed' 算完成；waiting_user/pending/in_progress/pre_*/failed 等都算未完成
    let targetOrderIndex: number | null = null;

    for (const orderIndex of allOrderIndexes) {
      const stepTasks = allTasksInGroup.filter(t => t.orderIndex === orderIndex);
      const allCompleted = stepTasks.every(t => t.status === 'completed');

      if (!allCompleted) {
        targetOrderIndex = orderIndex;
        break;
      }
    }

    console.log('[SubtaskEngine] 选择 targetOrderIndex', {
      all_order_indexes: allOrderIndexes,
      order_status_map: allOrderIndexes.map(oi => ({
        order_index: oi,
        statuses: allTasksInGroup.filter(t => t.orderIndex === oi).map(t => t.status),
      })),
      selected_order_index: targetOrderIndex,
    });

    // 所有任务都已完成
    if (!targetOrderIndex) {
      console.log('[SubtaskEngine] 分组所有任务已完成，跳过', { command_result_id: groupId });
      return;
    }

    // 从全量数据中 filter 出目标任务（无需额外查询）
    const targetTasks = allTasksInGroup.filter(t => t.orderIndex === targetOrderIndex);

    console.log('[SubtaskEngine] 目标 order_index:', {
      command_result_id: groupId,
      order_index: targetOrderIndex,
      tasks_count: targetTasks.length,
      statuses: targetTasks.map(t => t.status),
    });

    // processOrderIndexTasks 内部会检查 waiting_user 等状态并做对应处理
    await this.processOrderIndexTasks(targetOrderIndex, targetTasks, allTasksInGroup);

    console.log('[SubtaskEngine] ========== 分组处理完成 ==========', {
      command_result_id: groupId,
      processed_order_index: targetOrderIndex,
    });
  }

  /**
   * 统一的平台确定逻辑（P1-3 修复：集中处理）
   * 
   * 优先级：
   * 1. 从写作 Agent 任务获取（通过 executor 映射）
   * 2. 从 metadata.platform 获取
   * 3. 从 metadata.platformType 获取
   * 4. 兜底为 'wechat_official'
   * 
   * @param effectiveWritingTask 当前的有效写作任务
   * @param firstCompletedWritingTask 最近完成的写作 Agent 任务
   * @param fallbackWritingTask 写作 Agent 兜底任务
   * @param metadata 任务 metadata
   * @returns 平台类型字符串
   */
  private determinePlatformForPreview(
    effectiveWritingTask: typeof agentSubTasks.$inferSelect | undefined,
    firstCompletedWritingTask: typeof agentSubTasks.$inferSelect | undefined,
    fallbackWritingTask: typeof agentSubTasks.$inferSelect | undefined,
    metadata: Record<string, unknown>
  ): string {
    // 1. 如果有效写作任务是写作 Agent，直接从 executor 映射
    if (effectiveWritingTask && effectiveWritingTask.fromParentsExecutor !== 'deai-optimizer') {
      return getPlatformForExecutor(effectiveWritingTask.fromParentsExecutor);
    }

    // 2. deai-optimizer 场景：从原始写作任务获取平台
    if (effectiveWritingTask?.fromParentsExecutor === 'deai-optimizer') {
      const originalWritingTask = firstCompletedWritingTask || fallbackWritingTask;
      if (originalWritingTask) {
        return getPlatformForExecutor(originalWritingTask.fromParentsExecutor);
      }
    }

    // 3. 从 metadata 获取（支持 platform 和 platformType 两种字段）
    const platformFromMeta = metadata?.platform;
    if (typeof platformFromMeta === 'string' && platformFromMeta) {
      return platformFromMeta;
    }
    const platformTypeFromMeta = metadata?.platformType;
    if (typeof platformTypeFromMeta === 'string' && platformTypeFromMeta) {
      return platformTypeFromMeta;
    }

    // 4. 兜底
    return 'wechat_official';
  }

  /**
   * 🔴 新增：处理单个 order_index 的任务
   * 提取出独立方法，便于前序任务处理
   */
  private async processOrderIndexTasks(
    orderIndex: number,
    currentStepTasks: typeof agentSubTasks.$inferSelect[],
    allTasks: typeof agentSubTasks.$inferSelect[]
  ) {
    const groupId = currentStepTasks[0]?.commandResultId;

    console.log('');
    console.log('[SubtaskEngine] ========== processOrderIndexTasks 开始 ==========');
    console.log('[SubtaskEngine] 处理信息:', {
      command_result_id: groupId,
      order_index: orderIndex,
      tasks_count: currentStepTasks.length,
      tasks: currentStepTasks.map(t => ({
        id: t.id,
        status: t.status,
        executor: t.fromParentsExecutor
      }))
    });

    // 按优先级处理任务状态
    // 优先级：in_progress > waiting_user > pre_completed/pre_need_support > pending
    
    // 1. 检查是否有进行中的任务（仅处理超时）
    // 注意：用户反馈现在由 user-decision API 直接设为 pending，不需要在这里处理
    const inProgressTasks = currentStepTasks.filter(t => t.status === 'in_progress');
    if (inProgressTasks.length > 0) {
      console.log('[SubtaskEngine] 检查进行中的任务（仅超时检测）:', {
        command_result_id: groupId,
        order_index: orderIndex,
        tasks_count: inProgressTasks.length
      });
      
      await this.checkAndHandleTimeout(inProgressTasks);
      return;
    }

    // 2. 检查是否有等待用户的任务
    const waitingUserTasks = currentStepTasks.filter(t => t.status === 'waiting_user');
    if (waitingUserTasks.length > 0) {
      console.log('[SubtaskEngine] ⏸️ 等待用户交互（跳过处理）:', {
        command_result_id: groupId,
        order_index: orderIndex,
        tasks_count: waitingUserTasks.length,
        waiting_tasks: waitingUserTasks.map(t => ({
          id: t.id,
          status: t.status,
          from_parents_executor: t.fromParentsExecutor,
          last_agent_b_decision: (t.metadata as any)?.lastAgentBDecision?.type,
          reexecute_history_count: ((t.metadata as any)?.reexecuteHistory || []).length
        }))
      });
      return;
    }

    // 3. 检查是否有需要评审的任务（包含 auto_split）
    const reviewTasks = currentStepTasks.filter(t => 
      t.status === 'pre_completed' || t.status === 'pre_need_support' || t.status === 'auto_split');
    if (reviewTasks.length > 0) {
      console.log('[SubtaskEngine] Agent B 评审:', {
        command_result_id: groupId,
        order_index: orderIndex,
        tasks_count: reviewTasks.length,
        task_statuses: reviewTasks.map(t => t.status)
      });
      
      // 直接执行 Agent B 评审
      for (const task of reviewTasks) {
        await this.executeAgentBReviewWorkflow(task);
      }
    }

    // 4. 处理 pending 状态的任务
    const pendingTasks = currentStepTasks.filter(t => t.status === 'pending');
    if (pendingTasks.length > 0) {
      console.log('[SubtaskEngine] 执行 pending 任务:', {
        command_result_id: groupId,
        order_index: orderIndex,
        tasks_count: pendingTasks.length
      });
      await this.executeStepTasks(pendingTasks);
      return;
    }

    // 所有任务都已完成
    console.log('[SubtaskEngine] 当前步骤所有任务已完成:', {
      command_result_id: groupId,
      order_index: orderIndex
    });
  }



  private async executeStepTasks(tasks: typeof agentSubTasks.$inferSelect[]) {
    const groupId = tasks[0]?.commandResultId;

    console.log(`[SubtaskEngine] ========== executeStepTasks 被调用`, {
      command_result_id: groupId,
      tasks_count: tasks.length,
    });

    // 🔒 状态守卫：批量查询最新状态，避免 N+1 查询
    const taskIds = tasks.map(t => t.id);
    const latestStatusMap = await db
      .select({ id: agentSubTasks.id, status: agentSubTasks.status })
      .from(agentSubTasks)
      .where(inArray(agentSubTasks.id, taskIds))
      .then(res => new Map(res.map(r => [r.id, r.status])));

    for (const task of tasks) {
      const latestStatus = latestStatusMap.get(task.id);

      // 🔴 P1-2 修复：任务不存在时语义明确地跳过
      if (latestStatus === undefined) {
        console.warn('[SubtaskEngine] 🔒 任务不存在，跳过:', task.id);
        continue;
      }

      if (latestStatus !== 'pending') {
        console.log('[SubtaskEngine] 🔒 任务状态已变更，跳过执行:', {
          taskId: task.id,
          oldStatus: task.status,
          currentStatus: latestStatus
        });
        continue;
      }

      if (task.status === 'pending') {
        console.log(`[SubtaskEngine] ========== 执行Agent开始处理 ==========`, {
          command_result_id: groupId,
          task_id: task.id,
          order_index: task.orderIndex,
          executor: task.fromParentsExecutor
        });
        
        // 🔴🔴🔴 【虚拟执行器】user_preview_edit 等用户交互节点不走 LLM
        // 注意：虚拟执行器内部自行处理防重检查（checkExecutorAgentTaskBeforeExecution）
        if (isVirtualExecutor(task.fromParentsExecutor)) {
          console.log(`[SubtaskEngine] 👁️ 检测到虚拟执行器: ${task.fromParentsExecutor}，直接处理`);
          await this.executeVirtualExecutorTask(task);
          continue;
        }
        
        // 🔴🔴🔴 【关键修复】Agent T 也需要调用防重检查！
        // 使用原子性更新确保只有一个请求能成功获取任务执行权
        const lockedTask = await this.checkExecutorAgentTaskBeforeExecution(task);
        if (!lockedTask) {
          // 防重失败，跳过此任务
          console.log(`[SubtaskEngine] ⚠️ 防重检查失败，跳过任务: ${task.id}`);
          continue;
        }
        
        // 🔴 新增：判断是否是 Agent T
        if (task.fromParentsExecutor === 'agent T' || task.fromParentsExecutor === 'T') {
          // Agent T 特殊流程：返回后先执行 MCP，再转为 pre_completed/pre_need_support
          await this.executeAgentTExecutorWorkflow(lockedTask);
        } else {
          // 普通执行 Agent 流程
          // Phase 3: 检测 insurance-d 创作任务是否需要拆分为大纲确认双子任务
          const wasSplitForOutline = await this.splitForOutlineConfirmationIfNeeded(lockedTask);
          if (wasSplitForOutline) {
            console.log('[SubtaskEngine] 📋 任务已拆分为大纲确认双子任务，跳过本次执行');
            continue; // 拆分成功，跳过本次执行，下一轮循环会拾取新创建的子任务A
          }
          await this.executeExecutorAgentWorkflow(lockedTask);
        }
      }
    }
  }

  // ========== 🔴🔴🔴 【虚拟执行器】用户交互节点处理 ==========
  /**
   * 执行虚拟执行器任务（如 user_preview_edit）
   * 
   * 设计原则：
   * 1. 不调用 LLM，直接设为 waiting_user 状态
   * 2. 从前序写作任务获取文章内容，存入 resultData 供前端展示
   * 3. 用户修改后的内容存入本节点的 result_text（不修改前序任务）
   * 4. 下游合规校验通过 priorStepOutput 自然获取本节点的最终版本
   */
  private async executeVirtualExecutorTask(task: typeof agentSubTasks.$inferSelect) {
    console.log('[SubtaskEngine] 👁️ executeVirtualExecutorTask 开始', {
      taskId: task.id,
      executor: task.fromParentsExecutor,
      orderIndex: task.orderIndex,
    });

    if (task.fromParentsExecutor === USER_PREVIEW_EDIT_EXECUTOR) {
      await this.executeUserPreviewEditTask(task);
    } else {
      // 未来其他虚拟执行器可在此扩展
      console.warn('[SubtaskEngine] ⚠️ 未知的虚拟执行器:', task.fromParentsExecutor);
      await this.markTaskWaitingUser(task, '未知交互类型，请手动处理');
    }
  }

  /**
   * 执行用户预览修改节点
   * 
   * 流程：
   * 1. 原子性更新为 in_progress（防重）
   * 2. 获取前序写作任务的文章内容
   * 3. 将文章内容存入 resultData 供前端预览
   * 4. 设置任务为 waiting_user 状态
   * 5. 前端渲染预览编辑界面
   * 6. 用户确认后通过 user-decision API 处理
   */
  private async executeUserPreviewEditTask(task: typeof agentSubTasks.$inferSelect) {
    // 1. 原子性更新：pending → in_progress（防重，与真实 Agent 一致）
    const lockedTask = await this.checkExecutorAgentTaskBeforeExecution(task);
    if (!lockedTask) {
      console.log('[SubtaskEngine] 👁️ 预览节点防重检查失败，跳过:', task.id);
      return;
    }

    // 2. 查找前序写作任务
    const previousTasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.commandResultId, task.commandResultId),
          lt(agentSubTasks.orderIndex, task.orderIndex)
        )
      )
      .orderBy(desc(agentSubTasks.orderIndex));

    // 🔴🔴🔴 区分"初稿预览"和"最终预览"
    // 判断依据：当前节点之前是否已有 user_preview_edit 节点完成
    // - 初稿预览（首次出现 user_preview_edit）：优先获取 deai-optimizer 或写作 Agent 的输出
    // - 最终预览（第二次出现 user_preview_edit，在合规整改之后）：优先获取最近写作 Agent 的输出
    const isFinalPreview = previousTasks.some(t =>
      t.fromParentsExecutor === 'user_preview_edit' && t.status === 'completed'
    );

    // 🔴🔴🔴 单次遍历 previousTasks，提取所有需要的任务引用
    let effectiveWritingTask: typeof agentSubTasks.$inferSelect | undefined;
    let firstCompletedWritingTask: typeof agentSubTasks.$inferSelect | undefined;
    let deaiOptimizerTask: typeof agentSubTasks.$inferSelect | undefined;
    let fallbackWritingTask: typeof agentSubTasks.$inferSelect | undefined;
    let fallbackDeaiTask: typeof agentSubTasks.$inferSelect | undefined;

    for (const t of previousTasks) {
      // 写作 Agent 查找（取第一个已完成的，由于 previousTasks 按 orderIndex 降序，即最近完成的）
      if (isWritingAgent(t.fromParentsExecutor)) {
        if (t.status === 'completed' && !firstCompletedWritingTask) {
          firstCompletedWritingTask = t;
        }
        if (!fallbackWritingTask) {
          fallbackWritingTask = t;
        }
      }
      // deai-optimizer 查找
      if (t.fromParentsExecutor === 'deai-optimizer') {
        if (t.status === 'completed' && !deaiOptimizerTask) {
          deaiOptimizerTask = t;
        }
        if (!fallbackDeaiTask) {
          fallbackDeaiTask = t;
        }
      }
    }

    if (isFinalPreview) {
      // 🔴 最终预览（合规整改后）：直接取最近的已完成写作 Agent 任务（即合规整改任务）
      effectiveWritingTask = firstCompletedWritingTask || fallbackWritingTask;
      console.log('[SubtaskEngine] 👁️ 最终预览模式：使用合规整改后的内容', {
        taskId: effectiveWritingTask?.id,
        executor: effectiveWritingTask?.fromParentsExecutor,
        title: effectiveWritingTask?.taskTitle,
      });
    } else {
      // 🔴 初稿预览（合规校验前）：优先获取 deai-optimizer 输出，兜底获取写作 Agent 输出
      effectiveWritingTask = deaiOptimizerTask || firstCompletedWritingTask || fallbackDeaiTask || fallbackWritingTask;
      console.log('[SubtaskEngine] 👁️ 初稿预览模式：使用去AI化/原始写作内容', {
        source: deaiOptimizerTask ? 'deai-optimizer' : (firstCompletedWritingTask ? 'writing-agent' : 'fallback'),
      });
    }

    let articleContent = '';
    let articleTitle = '';
    let platform = '';

    // 🔴🔴🔴 统一的平台确定逻辑（P1-3 修复：集中处理，消除分散）
    platform = this.determinePlatformForPreview(
      effectiveWritingTask,
      firstCompletedWritingTask,
      fallbackWritingTask,
      task.metadata as Record<string, unknown>
    );

    if (effectiveWritingTask) {
      // 提取文章内容（result_text 保持纯文本，不与平台渲染耦合）
      articleContent = effectiveWritingTask.resultText || '';
      if (!articleContent && effectiveWritingTask.resultData) {
        articleContent = this.extractResultTextFromResultData(effectiveWritingTask.resultData, effectiveWritingTask.fromParentsExecutor) || '';
      }
      articleTitle = this.extractArticleTitleFromResultData(effectiveWritingTask.resultData, effectiveWritingTask.taskTitle);
    }

    // 🔥🔥🔥 【架构改造】平台渲染数据提取
    // result_text 是通用纯文本，不与平台渲染耦合
    // 平台专属的渲染数据（如小红书卡片）通过 platformRenderData 独立传递
    let platformRenderData: Record<string, unknown> | null = null;
    let platformDataSource: typeof agentSubTasks.$inferSelect | undefined;
    if (effectiveWritingTask?.fromParentsExecutor === 'deai-optimizer') {
      // deai-optimizer → 复用单次遍历结果，从原始写作任务获取渲染数据
      platformDataSource = firstCompletedWritingTask || fallbackWritingTask;
    } else if (isFinalPreview) {
      // 最终预览 → 优先从整改任务获取渲染数据（含平台渲染数据则用），兜底用原始写作任务
      // 复用 firstCompletedWritingTask（最近完成的写作 Agent = 合规整改任务）
      const hasResultData = effectiveWritingTask?.resultData && Object.keys(effectiveWritingTask.resultData as object).length > 0;
      platformDataSource = hasResultData ? effectiveWritingTask : firstCompletedWritingTask || fallbackWritingTask;
    } else {
      platformDataSource = effectiveWritingTask;
    }
    if (platformDataSource && platform) {
      try {
        const { extractPlatformRenderData } = await import('@/lib/platform-render/extractors');
        console.log('[SubtaskEngine] 👁️ 开始提取 platformRenderData...', {
          platform,
          dataSource: platformDataSource.fromParentsExecutor,
          hasWritingTaskResultData: !!platformDataSource.resultData,
          writingTaskResultDataType: typeof platformDataSource.resultData,
        });
        platformRenderData = extractPlatformRenderData(
          platform,
          platformDataSource.resultData,
          (task.metadata as Record<string, unknown>) || {}
        );
        console.log('[SubtaskEngine] 👁️ 提取结果:', {
          hasPlatformRenderData: !!platformRenderData,
          platformRenderDataKeys: platformRenderData ? Object.keys(platformRenderData) : [],
          cardsCount: platformRenderData && 'cards' in platformRenderData 
            ? (platformRenderData.cards as unknown[])?.length 
            : 0,
        });
      } catch (err) {
        console.error('[SubtaskEngine] ❌ 平台渲染数据提取失败:', err);
      }
    } else {
      console.warn('[SubtaskEngine] ⚠️ 跳过 platformRenderData 提取:', {
        hasEffectiveWritingTask: !!effectiveWritingTask,
        platform,
      });
    }

    console.log('[SubtaskEngine] 👁️ 前序写作任务信息:', {
      effectiveTaskId: effectiveWritingTask?.id,
      effectiveExecutor: effectiveWritingTask?.fromParentsExecutor,
      isFinalPreview: isFinalPreview,
      hasContent: articleContent.length > 0,
      contentLength: articleContent.length,
      platform,
      hasPlatformRenderData: !!platformRenderData,
    });

    // 3. 设置为 waiting_user，存入文章内容供前端预览
    // articleContent = 纯文本正文（通用，与平台无关）
    // platformRenderData = 平台渲染数据（结构化，按平台定义）
    const overrideResultData = {
      interactionType: 'preview_edit_article',
      articleContent,
      articleTitle,
      platform,
      platformRenderData,  // 🔥 新增：平台专属渲染数据
      writingTaskId: effectiveWritingTask?.id || null,
      canEdit: true,
      canSkip: true,
    };

    const waitingMessage = isFinalPreview
      ? (articleContent ? '合规整改已完成，请最终预览确认文章内容' : '未找到合规整改后的内容，请确认后继续')
      : (articleContent ? '请预览文章初稿，您可以修改内容或直接确认继续' : '未找到前序文章内容，请确认后继续');

    await this.markTaskWaitingUser(lockedTask, waitingMessage, overrideResultData);

    console.log('[SubtaskEngine] 👁️ 预览修改节点已设为 waiting_user:', {
      taskId: task.id,
      platform,
      contentLength: articleContent.length,
    });
  }

  /**
   * 从 resultData 中提取文章标题（轻量版，供虚拟执行器使用）
   */
  private extractArticleTitleFromResultData(resultData: any, fallbackTitle?: string | null): string {
    if (!resultData) return fallbackTitle || '';
    
    try {
      const data = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;
      
      // 信封格式: { result: { articleTitle: "..." } }
      if (data?.result?.articleTitle) return data.result.articleTitle;
      // 顶层 articleTitle
      if (data?.articleTitle) return data.articleTitle;
      // executorOutput.structuredResult
      if (data?.executorOutput?.structuredResult?.articleTitle) return data.executorOutput.structuredResult.articleTitle;
    } catch {
      // 解析失败，使用兜底
    }
    
    return fallbackTitle || '';
  }

  // ========== 🔴🔴🔴 【新增】独立的 AUTO_SPLIT 处理方法 ==========
  // 由 Agent T 识别 isNeedSplit=true 后，调度器调用此方法执行自动拆分
  /**
   * 处理 AUTO_SPLIT 决策（由 Agent T 识别后触发）
   * @param task 当前任务
   * @param splitDecision 拆分决策（来自 Agent T）
   * @returns true=成功，false=失败
   */
  async handleAutoSplitDecision(
    task: typeof agentSubTasks.$inferSelect,
    splitDecision: {
      type: string;
      context?: {
        splitStrategy?: string;
        splitReason?: string;
        suggestedSplitPoints?: string[];
      };
      reasoning?: string;
      reasonCode?: string;
    }
  ): Promise<boolean> {
    console.log('[SubtaskEngine] 🔴🔴🔴 handleAutoSplitDecision 开始执行...', {
      command_result_id: task.commandResultId,
      task_id: task.id,
      order_index: task.orderIndex,
      decision: splitDecision
    });

    // 构建自动拆分提示信息
    const splitContext = splitDecision.context || {};
    const splitStrategy = splitContext.splitStrategy || 'step_by_step';
    const suggestedSplitPoints = splitContext.suggestedSplitPoints || [];
    const splitReason = splitContext.splitReason || '任务太复杂，需要分步执行';

    // 🔴 常量定义：拆分后原任务搬到的位置（必须在 try 块外定义，以便 catch 块使用）
    const SPLIT_TASK_BASE_ORDER_INDEX = 1000;

    // 🔴🔴🔴 【完整实现】自动拆分逻辑（order_index 必须是自然数）
    try {
      console.log('[SubtaskEngine] 🔴🔴🔴 开始执行自动拆分...', {
        currentOrderIndex: task.orderIndex,
        splitPointsCount: suggestedSplitPoints.length
      });

      // 🔴 验证拆分点数量
      if (!suggestedSplitPoints || suggestedSplitPoints.length === 0) {
        throw new Error('没有提供拆分点，无法拆分任务');
      }

      if (suggestedSplitPoints.length === 1) {
        // 🔴 只有1个拆分点，不需要拆分，直接执行
        console.log('[SubtaskEngine] 🔴🔴🔴 只有1个拆分点，不需要拆分，直接执行');
        return true;
      }

      const baseOrderIndex = task.orderIndex;
      const splitCount = suggestedSplitPoints.length;
      // 🔴🔴🔴 【修改】拆分后 order_index 设计：
      // - 原任务 order_index 改为 1000（status=completed）
      // - 拆分任务1 → order_index=原 order_index
      // - 拆分任务2 → order_index=原 order_index+1
      // - 后续任务从原 order_index + splitCount 开始递增
      
      console.log('[SubtaskEngine] 🔴🔴🔴 AUTO_SPLIT 拆分策略:', {
        baseOrderIndex: baseOrderIndex,
        splitCount: splitCount,
        suggestedSplitPoints: suggestedSplitPoints
      });

      // 1️⃣ 获取 order_index >= baseOrderIndex 的所有任务（升序）
      const affectedTasks = await db
        .select()
        .from(agentSubTasks)
        .where(
          and(
            eq(agentSubTasks.commandResultId, task.commandResultId as any),
            gte(agentSubTasks.orderIndex, baseOrderIndex)
          )
        )
        .orderBy(asc(agentSubTasks.orderIndex));

      console.log('[SubtaskEngine] 🔴🔴🔴 找到受影响的订单数:', affectedTasks.length);

      // 2️⃣ 先把原任务的 order_index 改为 1000
      console.log('[SubtaskEngine] 🔴🔴🔴 原任务 order_index 改为:', SPLIT_TASK_BASE_ORDER_INDEX);
      await db
        .update(agentSubTasks)
        .set({ 
          orderIndex: SPLIT_TASK_BASE_ORDER_INDEX,
          status: "split_to_be_destroyed",
          resultText: `【已拆分】原任务已拆分为 ${splitCount} 个子任务`,
          resultData: {
            ...(typeof task.resultData === 'object' ? task.resultData : {}),
            splitInfo: { isOriginalTask: true, splitCount },
            splitChildTaskIds: []
          } as any,
          updatedAt: new Date()
        })
        .where(eq(agentSubTasks.id, task.id));
      console.log("[SubtaskEngine] 🔴🔴🔴 原任务已标记为 split_to_be_destroyed");

      // 3️⃣ 从后往前移动 order_index（+splitCount，避免冲突）
      const tasksToMove = affectedTasks.filter(t => t.id !== task.id && t.orderIndex >= baseOrderIndex);

      if (tasksToMove.length > 0) {
        console.log('[SubtaskEngine] 🔴🔴🔴 开始移动任务 order_index（从后往前，避免冲突）...');

        for (const taskToMove of tasksToMove.reverse()) {
          const newOrderIndex = taskToMove.orderIndex + splitCount;
          console.log('[SubtaskEngine] 🔴🔴🔴 移动任务:', {
            taskId: taskToMove.id,
            oldOrderIndex: taskToMove.orderIndex,
            newOrderIndex: newOrderIndex
          });

          await db
            .update(agentSubTasks)
            .set({ orderIndex: newOrderIndex })
            .where(eq(agentSubTasks.id, taskToMove.id));
        }
      }

      // 4️⃣ 创建拆分后的子任务
      const splitTasks = [];

      for (let i = 0; i < splitCount; i++) {
        const splitPoint = suggestedSplitPoints[i];
        // 🔴 拆分任务从 baseOrderIndex 开始递增
        const splitOrderIndex = baseOrderIndex + i;

        // 🔴 构建拆分元数据
        const splitMeta = {
          isSplitChild: true,
          splitIndex: i + 1,
          totalSplits: splitCount,
          splitReason: splitReason,
          parentOrderIndex: baseOrderIndex,
          originalTaskId: task.id,  // 记录原始任务 ID
          splitPoints: suggestedSplitPoints,
          splitStrategy: splitStrategy,
          createdAt: new Date().toISOString()
        };

        console.log('[SubtaskEngine] 🔴🔴🔴 创建拆分任务:', {
          index: i + 1,
          orderIndex: splitOrderIndex,
          title: splitPoint
        });

        // 🔴 创建新的拆分任务
        const newSubTasks = await db
          .insert(agentSubTasks)
          .values({
            commandResultId: task.commandResultId,
            orderIndex: splitOrderIndex,
            taskTitle: splitPoint,
            taskDescription: `【自动拆分任务 ${i + 1}/${splitCount}】${splitReason}`,
            status: 'pending',
            fromParentsExecutor: task.fromParentsExecutor,
            // 🔥 新增：从原任务继承用户观点和素材
            userOpinion: task.userOpinion || null,
            materialIds: task.materialIds || [],
            // 🔥 Phase 6 多用户：从原任务继承 workspaceId
            workspaceId: task.workspaceId || null,
            resultData: splitMeta as any
          })
          .returning();

        console.log('[SubtaskEngine] 🔴🔴🔴 已创建拆分任务:', {
          index: i + 1,
          orderIndex: splitOrderIndex,
          taskId: newSubTasks[0]?.id
        });
        splitTasks.push(newSubTasks[0]);
      }

      // 🔴 验证 order_index 连续性
      const allTasks = await db
        .select({ orderIndex: agentSubTasks.orderIndex })
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, task.commandResultId as any))
        .orderBy(asc(agentSubTasks.orderIndex));

      console.log('[SubtaskEngine] 🔴🔴🔴 自动拆分完成，order_index 验证:', {
        totalTasks: allTasks.length,
        orderIndexes: allTasks.map(t => t.orderIndex),
        isSequential: allTasks.every((t, i) => i === 0 || t.orderIndex === allTasks[i - 1].orderIndex + 1)
      });

      // 5️⃣ 🔴🔴🔴 【简化】保留 MCP 记录和历史记录用于追溯，不删除

      // 6️⃣ 记录拆分操作到历史
      await db
        .insert(agentSubTasksStepHistory)
        .values({
          commandResultId: task.commandResultId,
          stepNo: SPLIT_TASK_BASE_ORDER_INDEX,
          interactType: "system",
          interactUser: "system",
          interactContent: {
            action: "AUTO_SPLIT",
            splitReason: splitReason,
            splitPoints: suggestedSplitPoints,
            originalTaskId: task.id,
            createdTasks: splitTasks.map(t => ({
              id: t?.id,
              orderIndex: t?.orderIndex,
              title: t?.taskTitle
            })),
            timestamp: new Date().toISOString()
          } as any
        });

      console.log("[SubtaskEngine] 🔴🔴🔴 AUTO_SPLIT 完成!");
      console.log("[SubtaskEngine] 🔴🔴🔴 原任务 order_index 已改为:", SPLIT_TASK_BASE_ORDER_INDEX);
      console.log("[SubtaskEngine] 🔴🔴🔴 新增拆分任务:", splitTasks.length, "个");
      console.log("[SubtaskEngine] 🔴🔴🔴 拆分任务 order_index:", splitTasks.map(t => t?.orderIndex));

      // 7️⃣ 返回 true，继续执行第一个拆分任务
      console.log("[SubtaskEngine] 🔴🔴🔴 AUTO_SPLIT 完成，返回 true 继续执行第一个拆分任务");
      return true;

    } catch (error) {
      console.error('[SubtaskEngine] 🔴🔴🔴 AUTO_SPLIT 执行失败:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // 🔴 检查拆分子任务是否已创建成功
      const createdSplitTasks = await db
        .select()
        .from(agentSubTasks)
        .where(and(
          eq(agentSubTasks.commandResultId, task.commandResultId),
          sql`order_index < ${SPLIT_TASK_BASE_ORDER_INDEX}`
        ))
        .orderBy(asc(agentSubTasks.orderIndex));

      // 🔴 如果子任务已创建，说明拆分基本成功，只是后续步骤（如step_history）失败
      // 此时应该保持 split_to_be_destroyed 状态，不要覆盖
      if (createdSplitTasks.length > 0) {
        console.log('[SubtaskEngine] 🔴🔴🔴 拆分子任务已创建成功，保持 split_to_be_destroyed 状态:', {
          createdCount: createdSplitTasks.length,
          orderIndexes: createdSplitTasks.map(t => t.orderIndex)
        });
        
        // 确保 status 是 split_to_be_destroyed，只更新 resultText
        await db
          .update(agentSubTasks)
          .set({
            status: 'split_to_be_destroyed',
            resultText: `【已拆分】原任务已拆分为 ${createdSplitTasks.length} 个子任务（后续步骤有错误但不影响拆分结果）`,
            updatedAt: getCurrentBeijingTime()
          })
          .where(eq(agentSubTasks.id, task.id));
        
        return true; // 返回 true，让拆分后的任务继续执行
      }

      // 🔴 如果子任务未创建，说明拆分前就失败了，恢复为 waiting_user
      console.log('[SubtaskEngine] 🔴🔴🔴 拆分子任务未创建，恢复为 waiting_user');
      await db
        .update(agentSubTasks)
        .set({
          status: 'waiting_user',
          resultText: `AUTO_SPLIT 失败：${error instanceof Error ? error.message : String(error)}`,
          updatedAt: getCurrentBeijingTime()
        })
        .where(eq(agentSubTasks.id, task.id));

      return false;
    }
  }

  // ========== Phase 3：大纲确认双子任务拆分 ==========
  /**
   * 检测 insurance-d 创作任务是否需要拆分为大纲确认双子任务
   *
   * 拆分策略（复用 auto-split 整数递增模式）：
   * - 原任务 order_index → 改为 9000（status=completed，标记为 outline_split）
   * - 子任务A(生成大纲) → order_index = 原值
   * - 子任务B(生成全文) → order_index = 原值 + 1（初始 pending，需用户确认后激活）
   * - 后续任务 order_index → 原值 + 2 顺延
   *
   * @param task 当前 insurance-d 子任务
   * @returns true=已拆分（调用方应跳过本次执行），false=无需拆分（正常执行）
   */
  async splitForOutlineConfirmationIfNeeded(
    task: typeof agentSubTasks.$inferSelect
  ): Promise<boolean> {
    // 仅对写作类 Agent（insurance-d / insurance-xiaohongshu）的创作任务生效
    const isWritingAgentCreation = isWritingAgent(task.fromParentsExecutor)
      && !task.taskTitle?.includes('大纲')
      && !task.taskTitle?.includes('outline')
      // 检查 metadata 中是否已经拆分过（防止重复拆分）
      && !(task as any).resultData?.isOutlineSplit;

    if (!isWritingAgentCreation) {
      return false;
    }

    // 🔥 新增：检查同组是否已存在大纲相关任务（防止重复拆分）
    const existingOutlineTasks = await db
      .select({ id: agentSubTasks.id, taskTitle: agentSubTasks.taskTitle })
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.commandResultId, task.commandResultId as any),
          or(
            sql`${agentSubTasks.taskTitle} LIKE '%大纲%'`,
            sql`${agentSubTasks.taskTitle} LIKE '%outline%'`
          )
        )
      );

    if (existingOutlineTasks.length > 0) {
      console.log('[SubtaskEngine] 📋 [Phase3] 同组已存在大纲任务，跳过拆分:', {
        task_id: task.id,
        existing_outline_tasks: existingOutlineTasks.map(t => t.taskTitle),
      });
      return false;
    }

    console.log('[SubtaskEngine] 📋 [Phase3] 检测到 insurance-d 创作任务，执行大纲确认拆分:', {
      task_id: task.id,
      order_index: task.orderIndex,
      task_title: task.taskTitle,
    });

    const OUTLINE_SPLIT_BASE_ORDER = 9000; // 原任务搬到的位置（区别于 AUTO_SPLIT 的 1000）
    const baseOrderIndex = task.orderIndex;

    try {
      // 使用事务包裹全部拆分操作，确保原子性（中途失败则全部回滚）
      await db.transaction(async (tx) => {
        // 1. 获取受影响的所有后续任务
        const affectedTasks = await tx
          .select()
          .from(agentSubTasks)
          .where(
            and(
              eq(agentSubTasks.commandResultId, task.commandResultId as any),
              gte(agentSubTasks.orderIndex, baseOrderIndex)
            )
          )
          .orderBy(asc(agentSubTasks.orderIndex));

        console.log('[SubtaskEngine] 📋 [Phase3] 受影响任务数:', affectedTasks.length);

        // 2. 将原任务标记为已拆分
        await tx
          .update(agentSubTasks)
          .set({
            orderIndex: OUTLINE_SPLIT_BASE_ORDER,
            status: 'completed',
            resultText: '【大纲确认拆分】原任务已拆分为"生成大纲"+"生成全文"两个子任务',
            resultData: {
              ...(typeof task.resultData === 'object' ? task.resultData : {}),
              isOutlineSplit: true,
              outlineSplitInfo: {
                originalOrderIndex: baseOrderIndex,
                createdAt: new Date().toISOString(),
              },
            } as any,
            updatedAt: getCurrentBeijingTime(),
          })
          .where(eq(agentSubTasks.id, task.id));
        console.log('[SubtaskEngine] 📋 [Phase3] 原任务已标记为大纲拆分');

        // 3. 后续任务 order_index +1 顺延（因为原任务移到 9000，只新增了 1 个任务位置）
        // 原任务移走后，子任务A 占原位置，子任务B 占 +1 位置，所以后续任务只需 +1
        const tasksToMove = affectedTasks.filter(
          (t) => t.id !== task.id && t.orderIndex > baseOrderIndex
        );

        for (const taskToMove of tasksToMove.reverse()) {
          const oldOrderIndex = taskToMove.orderIndex;
          const newOrderIndex = oldOrderIndex + 1;  // 🔥 修复：+1 而非 +2
          
          // 更新 agent_sub_tasks 的 orderIndex
          await tx
            .update(agentSubTasks)
            .set({ orderIndex: newOrderIndex })
            .where(eq(agentSubTasks.id, taskToMove.id));
          
          // 同步更新 step_history 的 stepNo（保持数据一致性）
          // 注意：此处更新可能影响同一 stepNo 的多条历史记录
          // TODO: P0 问题待优化 - step_history 应通过 taskId 关联而非 stepNo
          await tx
            .update(agentSubTasksStepHistory)
            .set({ stepNo: newOrderIndex })
            .where(
              and(
                eq(agentSubTasksStepHistory.commandResultId, task.commandResultId as any),
                eq(agentSubTasksStepHistory.stepNo, oldOrderIndex)
              )
            );
        }
        console.log('[SubtaskEngine] 📋 [Phase3] 后续任务顺移完成, 数量:', tasksToMove.length);

        // 4. 创建子任务 A：生成大纲
        // 🔥 继承原任务的 executor（insurance-d 或 insurance-xiaohongshu）
        const inheritedExecutor = task.fromParentsExecutor;
        
        // 🔥🔥🔥 【修复】继承原任务的结构信息（微信7段/小红书5卡片等）
        const taskExtension = task as InsuranceDTaskExtension;
        const inheritedStructureName = taskExtension.structureName || null;
        const inheritedStructureDetail = taskExtension.structureDetail || null;
        
        // 🔥🔥🔥 【修复】继承原任务的 metadata（contentTemplateId、platform、imageCountMode 等）
        const inheritedMetadata = typeof task.metadata === 'object' && task.metadata !== null 
          ? { ...task.metadata } 
          : {};
        
        const outlineTask = await tx
          .insert(agentSubTasks)
          .values({
            commandResultId: task.commandResultId,
            orderIndex: baseOrderIndex,
            taskTitle: '生成创作大纲',
            taskDescription: `【大纲生成】请根据以下创作需求，先生成文章的大纲结构（包含各段落标题、核心论点、素材使用位置），不要写完整正文。\n\n原始创作指令：${task.taskDescription || ''}`,
            status: 'pending',
            fromParentsExecutor: inheritedExecutor,
            userOpinion: task.userOpinion || null,
            materialIds: task.materialIds || [],
            // 🔥🔥🔥 【修复】继承结构信息
            structureName: inheritedStructureName,
            structureDetail: inheritedStructureDetail,
            // 🔥🔥🔥 【修复】继承 metadata（包含 contentTemplateId、platform、imageCountMode）
            metadata: inheritedMetadata,
            // 🔥 Phase 6 多用户：从原任务继承 workspaceId
            workspaceId: task.workspaceId || null,
            resultData: {
              isOutlineSplitChild: true,
              subTaskRole: 'outline_generation',
              parentOriginalTaskId: task.id,
              parentOrderIndex: baseOrderIndex,
            } as any,
          })
          .returning();

        // 5. 创建子任务 B：生成全文（初始状态 pending，依赖用户确认）
        const fullArticleTask = await tx
          .insert(agentSubTasks)
          .values({
            commandResultId: task.commandResultId,
            orderIndex: baseOrderIndex + 1,
            taskTitle: '根据确认大纲生成全文',
            taskDescription: task.taskDescription || '',
            status: 'pending', // 等待用户确认大纲后激活
            fromParentsExecutor: inheritedExecutor,
            userOpinion: task.userOpinion || null,
            materialIds: task.materialIds || [],
            // 🔥🔥🔥 【修复】继承结构信息（全文任务需要按结构写作）
            structureName: inheritedStructureName,
            structureDetail: inheritedStructureDetail,
            // 🔥🔥🔥 【修复】继承 metadata（包含 contentTemplateId、platform、imageCountMode）
            metadata: inheritedMetadata,
            // 🔥 Phase 6 多用户：从原任务继承 workspaceId
            workspaceId: task.workspaceId || null,
            resultData: {
              isOutlineSplitChild: true,
              subTaskRole: 'full_article',
              parentOriginalTaskId: task.id,
              dependsOnOutlineTaskId: outlineTask[0]?.id,
              confirmedOutline: null, // 待用户确认后填入
            } as any,
          })
          .returning();

        console.log('[SubtaskEngine] 📋 [Phase3] 大纲确认双子任务创建成功:', {
          outline_task_id: outlineTask[0]?.id,
          outline_order: baseOrderIndex,
          full_article_task_id: fullArticleTask[0]?.id,
          full_article_order: baseOrderIndex + 1,
        });

        // 6. 记录拆分操作到历史
        await tx.insert(agentSubTasksStepHistory).values({
          commandResultId: task.commandResultId,
          stepNo: OUTLINE_SPLIT_BASE_ORDER,
          interactType: 'system',
          interactUser: 'system',
          interactContent: {
            action: 'OUTLINE_CONFIRMATION_SPLIT',
            reason: `${inheritedExecutor} 创作任务自动拆分为大纲+全文双子任务`,
            originalTaskId: task.id,
            createdTasks: [
              { id: outlineTask[0]?.id, role: 'outline_generation', title: outlineTask[0]?.taskTitle },
              { id: fullArticleTask[0]?.id, role: 'full_article', title: fullArticleTask[0]?.taskTitle },
            ],
            timestamp: new Date().toISOString(),
          } as any,
        });
      });

      return true; // 已拆分，调用方应跳过本次执行
    } catch (error) {
      console.error('[SubtaskEngine] 📋 [Phase3] 大纲确认拆分失败:', error);
      // 拆分失败时不阻塞主流程，降级为直接执行原始任务
      return false;
    }
  }

  // ========== Phase 3：核心锚点自动归档 ==========

  /**
   * insurance-d 任务完成后，自动将核心锚点数据归档到 core_anchor_assets 表
   *
   * 归档内容：
   * - userOpinion → core_viewpoint 类型
   * - structureName + structureDetail → structure_supplement 类型（通过 rawContent 存储）
   *
   * 幂等性：同一任务不重复归档（通过 sourceTaskId 去重）
   */
  async archiveCoreAnchorsIfNeeded(
    task: typeof agentSubTasks.$inferSelect
  ): Promise<void> {
    // 仅对写作类 Agent（insurance-d / insurance-xiaohongshu）任务归档
    if (!isWritingAgent(task.fromParentsExecutor)) return;

    const extension = task as InsuranceDTaskExtension;

    // 检查是否有可归档的数据
    const hasDataToArchive = !!extension.userOpinion || !!extension.structureName;
    if (!hasDataToArchive) return;

    // 检查是否已归档过（幂等）
    try {
      const existing = await db
        .select()
        .from(coreAnchorAssets)
        .where(eq(coreAnchorAssets.sourceTaskId, task.id))
        .limit(1);

      if (existing.length > 0) {
        console.log('[SubtaskEngine] 📋 [Phase3] 核心锚点已归档，跳过:', task.id);
        return;
      }
    } catch (error) {
      // 表不存在时降级跳过
      console.warn('[SubtaskEngine] 📋 [Phase3] core_anchor_assets 表可能尚未创建，跳过归档');
      return;
    }

    console.log('[SubtaskEngine] 📋 [Phase3] 开始归档核心锚点:', {
      task_id: task.id,
      hasUserOpinion: !!extension.userOpinion,
      hasStructure: !!extension.structureName,
    });

    try {
      // 归档 userOpinion → core_viewpoint
      if (extension.userOpinion) {
        await digitalAssetService.archiveCoreAnchor({
          sourceTaskId: task.id,
          anchorType: 'core_viewpoint',
          rawContent: extension.userOpinion,
        });
        console.log('[SubtaskEngine] 📋 [Phase3] ✅ 核心观点已归档');
      }

      // 归档结构选择信息
      if (extension.structureName || extension.structureDetail) {
        await digitalAssetService.archiveCoreAnchor({
          sourceTaskId: task.id,
          anchorType: 'opening_case', // 结构选择作为"开头案例"类型的补充
          rawContent: `[结构模板] ${extension.structureName || ''}\n${extension.structureDetail || ''}`,
        });
        console.log('[SubtaskEngine] 📋 [Phase3] ✅ 结构选择已归档');
      }
    } catch (error) {
      // 归档失败不影响主流程
      console.error('[SubtaskEngine] 📋 [Phase3] 核心锚点归档失败（不影响主流程）:', error);
    }
  }


  /**
   * ========== 【抽取】执行Agent防重逻辑 ==========
   * 在调用执行Agent之前做防重检查
   * 使用数据库条件更新实现原子性防重！
   * @param task 任务对象
   * @returns 如果防重通过，返回最新的任务对象；否则返回 null
   */
  private async checkExecutorAgentTaskBeforeExecution(
    task: typeof agentSubTasks.$inferSelect
  ): Promise<typeof agentSubTasks.$inferSelect | null> {
    console.log('[执行Agent防重] 开始执行Agent防重检查...', {
      task_id: task.id,
      current_status: task.status
    });

    const executionStartAt = getCurrentBeijingTime();

    // ========== 🔴🔴🔴 【原子性防重】使用数据库条件更新 ==========
    // 只有状态是 pending 时才更新为 in_progress，确保只有一个请求能成功！
    console.log('[执行Agent防重] 🔄🔄🔴 尝试原子性更新任务状态: pending → in_progress...');
    
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: executionStartAt,
        updatedAt: executionStartAt,
      })
      .where(
        and(
          eq(agentSubTasks.id, task.id),
          eq(agentSubTasks.status, 'pending')  // 🔴🔴🔴 关键：只有状态是 pending 时才更新！
        )
      );

    // 重新读取任务状态，验证是否更新成功
    const latestTaskAfterUpdate = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .then(res => res[0]);

    // 检查是否更新成功（状态是否变成了 in_progress）
    if (!latestTaskAfterUpdate || latestTaskAfterUpdate.status !== 'in_progress') {
      // 没有更新成功，说明任务状态不是 pending，或者已经被其他请求更新了
      console.warn('[执行Agent防重] ⚠️ ⚠️ ⚠️ 原子性更新失败，任务状态不是 pending 或已被其他请求处理', {
        taskId: task.id,
        currentStatus: latestTaskAfterUpdate?.status || 'not_found'
      });

      return null;
    }

    // 原子性更新成功！
    console.log('[执行Agent防重] ✅✅✅ 原子性更新成功，状态已更新为 in_progress', {
      taskId: task.id,
      status: latestTaskAfterUpdate.status
    });

    const latestTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .then(res => res[0]);

    if (!latestTask) {
      console.error('[执行Agent防重] ❌ 任务不存在，跳过');
      return null;
    }

    console.log('[执行Agent防重] ✅ 防重检查通过，继续执行', {
      taskId: latestTask.id,
      status: latestTask.status
    });

    return latestTask;
  }

  /**
   * ========== 【辅助函数】解析 resultData 为 ExecutorAgentResult 格式 ==========
   * 用于 recordAgentInteraction 的 requestContent 参数
   * @param resultData 任务的结果数据
   * @returns ExecutorAgentResult 格式的对象
   */
  private parseExecutorResult(resultData: any): any {
    if (!resultData) {
      return { hasContent: false };
    }
    
    try {
      // 🔴 修复：智能类型检查！
      // 如果已经是对象，直接使用；如果是字符串，才解析
      let parsed = resultData;
      if (typeof resultData === 'string') {
        parsed = JSON.parse(resultData);
      }
      
      // 提取 executorOutput（兼容多种格式）
      const executorOutput = parsed.executorOutput || {
        result: parsed.result || parsed.briefResponse || parsed.output || '',
        output: parsed.output || '',
        suggestions: parsed.suggestions || ''
      };
      
      // 🔴 修复：添加 executorResult 字段，供 recordAgentInteraction 使用
      // 同时保留 isCompleted, isNeedMcp, isTaskDown 等字段
      return {
        isCompleted: parsed.isCompleted ?? false,
        isNeedMcp: parsed.isNeedMcp ?? false,
        isTaskDown: parsed.isTaskDown ?? parsed.isCompleted ?? false,
        // 🔴 关键修复：添加 executorResult 字段（用于 hasExecutorResult 检查）
        executorResult: {
          result: executorOutput.result || executorOutput.output || '',
          output: executorOutput.output || '',
          suggestions: executorOutput.suggestions || '',
          structuredResult: executorOutput.structuredResult || null
        },
        executorOutput
      };
    } catch (e) {
      console.warn('[parseExecutorResult] 解析 resultData 失败:', e);
      return { hasContent: false, rawData: String(resultData).substring(0, 200) };
    }
  }

  /**
   * ========== 【辅助函数】检查任务是否可以完成 ==========
   * 当 Agent B 重试超限时，判断执行结果是否有效
   * @param task 任务对象
   * @returns 如果执行结果有效（可以完成），返回 true
   */
  private checkIfTaskCanComplete(task: typeof agentSubTasks.$inferSelect): boolean {
    // 1. 如果任务状态是 pre_completed，认为可以完成
    if (task.status === 'pre_completed') {
      console.log('[Agent B 防重] checkIfTaskCanComplete: status=pre_completed → true');
      return true;
    }
    
    // 2. 如果任务状态不是 pre_need_support，认为可以完成
    if (task.status !== 'pre_need_support') {
      console.log('[Agent B 防重] checkIfTaskCanComplete: status != pre_need_support → true');
      return true;
    }
    
    // 3. 检查 resultData 中是否有有效的执行结果
    if (task.resultData) {
      try {
        // 🔴 修复：resultData 可能是字符串或已经是对象
        let resultData: any = task.resultData;
        if (typeof resultData === 'string') {
          resultData = JSON.parse(resultData);
        }
        
        // 🔴 检查 isCompleted 格式
        if (resultData.isCompleted === true) {
          console.log('[Agent B 防重] checkIfTaskCanComplete: resultData.isCompleted=true → true');
          return true;
        }
        
        // 检查旧格式 isNeedMcp + isTaskDown
        if (resultData.isNeedMcp === false && resultData.isTaskDown === true) {
          console.log('[Agent B 防重] checkIfTaskCanComplete: isNeedMcp=false && isTaskDown=true → true');
          return true;
        }
        
        // 检查是否有有效的输出内容
        if (resultData.briefResponse || resultData.output || resultData.resultSummary) {
          console.log('[Agent B 防重] checkIfTaskCanComplete: 有有效输出内容 → true');
          return true;
        }
        
        // 检查 MCP 执行结果
        if (resultData.mcpResult || resultData.mcpExecuted) {
          console.log('[Agent B 防重] checkIfTaskCanComplete: mcpResult exists → true');
          return true;
        }
      } catch (e) {
        console.warn('[Agent B 防重] checkIfTaskCanComplete: 解析 resultData 失败:', e);
      }
    }
    
    // 4. 检查 articleMetadata 中的 step_status
    if (task.articleMetadata) {
      const articleMetadata = task.articleMetadata as any;
      if (articleMetadata?.current_step?.step_status === 'success') {
        console.log('[Agent B 防重] checkIfTaskCanComplete: step_status=success → true');
        return true;
      }
    }
    
    // 5. 所有检查都失败，认为不能完成
    console.log('[Agent B 防重] checkIfTaskCanComplete: 所有检查失败 → false');
    return false;
  }

  // ============================================================================
  // 🔴🔴🔴 封装：执行Agent直接调用Agent T的支持方法
  // ============================================================================

  // 🔴🔴🔴 getRecentMcpExecutionIfValid 方法已移除
  // 原因：MCP 执行成功后直接设置为 pre_completed，不会再次调度
  // 如果后续有其他场景需要这个检查，可以在这里重新添加

  /**
   * ========== 【封装】检测并处理待执行的 Agent T 决策 ==========
   * 当任务有 lastExecutionType === 'executor_direct_to_agent_t' 时
   * 直接处理 Agent T 的 EXECUTE_MCP 决策，跳过执行Agent调用
   * 
   * @param task 任务对象
   * @returns true=已处理，false=不需要处理
   */
  private async processPendingAgentTDecision(
    task: typeof agentSubTasks.$inferSelect
  ): Promise<boolean> {
    const lastAgentTDecision = (task.metadata as any)?.lastAgentTDecision;
    const lastExecutionType = (task.metadata as any)?.lastExecutionType;

    if (lastExecutionType !== 'executor_direct_to_agent_t' || !lastAgentTDecision) {
      return false;
    }

    console.log('[执行Agent追踪] 🔴🔴🔴 检测到待处理的 Agent T 决策，直接处理');
    console.log('[执行Agent追踪] Agent T 决策:', JSON.stringify(lastAgentTDecision, null, 2));

    // 标记正在处理
    await db
      .update(agentSubTasks)
      .set({
        metadata: {
          ...((task.metadata as any) || {}),
          lastExecutionType: 'processing_agent_t_decision'
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    // 查询 capabilities 和 userInteractions
    const capabilities = await this.queryCapabilityList();
    // 🔴🔴🔴 查询用户反馈（最重要！必须传递用户指令！）
    const userFeedbackQueryStartTime = Date.now();
    let userInteractions = [];
    try {
      // 查询当前任务的用户反馈记录
      const userFeedbackRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
            eq(agentSubTasksStepHistory.stepNo, task.orderIndex),
            eq(agentSubTasksStepHistory.interactUser, 'human')
          )
        )
        .orderBy(agentSubTasksStepHistory.interactTime);

      console.log('[SubtaskEngine] 🔴🔴🔴 查询到用户反馈记录:', {
        taskId: task.id,
        commandResultId: task.commandResultId,
        orderIndex: task.orderIndex,
        recordCount: userFeedbackRecords.length,
        queryTime: Date.now() - userFeedbackQueryStartTime + 'ms'
      });

      if (userFeedbackRecords.length > 0) {
        // 只取最新的一条用户反馈
        const latestRecord = userFeedbackRecords[userFeedbackRecords.length - 1];
        const feedbackContent = latestRecord.interactContent as any;

        console.log('[SubtaskEngine] 🔴🔴🔴 最新用户反馈:', {
          feedbackType: feedbackContent.type,
          userDecision: feedbackContent.userDecision,
          decisionType: feedbackContent.decisionType
        });

        // 构建用户反馈对象（与 queryUserInteractions 方法的返回格式一致）
        userInteractions = [{
          feedbackType: feedbackContent.type || 'user_decision',
          userDecision: feedbackContent.userDecision || latestRecord.interactContent,
          decisionType: feedbackContent.decisionType || 'user_decision',
          feedbackTime: latestRecord.interactTime.toISOString(),
          recordId: latestRecord.id
        }];

        console.log('[SubtaskEngine] 🔴🔴🔴 用户反馈已添加到 userInteractions');
      }
    } catch (error) {
      console.warn('[SubtaskEngine] ⚠️ 查询用户反馈失败:', error);
    }

    // 解析 executorResult
    let executorResultForDecision: ExecutorAgentResult | null = null;
    if (task.resultData) {
      try {
        executorResultForDecision = typeof task.resultData === 'string'
          ? JSON.parse(task.resultData)
          : task.resultData;
      } catch (e) {
        console.error('[执行Agent追踪] ❌ executorResult 解析失败:', e);
      }
    }

    if (executorResultForDecision) {
      // 调用 handleDecisionType 处理 Agent T 的 EXECUTE_MCP 决策
      await this.handleDecisionType(
        task,
        lastAgentTDecision,
        executorResultForDecision,
        capabilities,
        [],
        userInteractions,
        1, 5, 3
      );
    }

    return true;
  }

  /**
   * ========== 执行Agent职责 ==========
   * 接收任务，从 pending 开始
   * 更新状态为 in_progress
   * 直接执行任务（跳过能力判定！）
   * 判断结果：
   *   如果能完成 → 标记为 pre_completed
   *   如果需要帮助 → 标记为 pre_need_support
   */
  private async executeExecutorAgentWorkflow(task: typeof agentSubTasks.$inferSelect) {
    const executionStartAt = getCurrentBeijingTime();
    let executionPhase = 'init';
    let executionSuccess = false;
    let executorResult: ExecutorDirectResult | null = null;
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[执行Agent追踪] ========== 开始执行 ==========');
    console.log('[执行Agent追踪] 任务信息:', {
      task_id: task.id,
      command_result_id: task.commandResultId,
      order_index: task.orderIndex,
      executor: task.fromParentsExecutor,
      task_title: task.taskTitle,
      initial_status: task.status,
      started_at: executionStartAt.toISOString()
    });

    // ========== 🔴🔴🔴 【第一层】业务流程防护：调用抽取的防重方法 ==========
    console.log('[执行Agent追踪] 🔄 调用防重检查...');
    const latestTask = await this.checkExecutorAgentTaskBeforeExecution(task);
    
    if (!latestTask) {
      console.warn('[执行Agent追踪] ⚠️ 防重检查未通过，跳过执行');
      return;
    }
    
    // 🔴 优化：检查任务是否已完成，如果已完成则跳过
    const terminalStates = ['completed', 'cancelled'];
    if (terminalStates.includes(latestTask.status)) {
      console.warn('[执行Agent追踪] ⚠️ 任务已完成或已取消，跳过执行:', latestTask.status);
      return;
    }
    
    // 🔴 优化：如果任务已经是 pre_completed 且有有效的 MCP 结果，跳过重复执行
    if (latestTask.status === 'pre_completed' && latestTask.resultData) {
      try {
        const resultData = typeof latestTask.resultData === 'string' 
          ? JSON.parse(latestTask.resultData) 
          : latestTask.resultData;
        if (resultData.isCompleted) {
          console.warn('[执行Agent追踪] ⚠️ 任务已成功完成(resultData.isCompleted=true)，跳过重复执行');
          return;
        }
      } catch (e) {
        // 解析失败，继续执行
      }
    }

    // 使用最新读取的任务继续执行（注意：状态已经是 in_progress 了！）
    task = latestTask;
    
    // 🔴🔴🔴 注意：不再需要 getRecentMcpExecutionIfValid 检查
    // 因为 MCP 执行成功后直接设置为 pre_completed，不会再次调度
    // 如果后续有其他场景需要这个检查，可以在这里重新添加
    
    // 🔴 🔴🔴 【简化】前序任务结果获取已统一在 callExecutorAgentDirectly 内部处理
    // 不再需要外部获取 currentTaskHistoryText
    
    try {
      // ========== 注意：状态已经在防重检查中原子性更新为 in_progress 了！ ==========
      console.log('[执行Agent追踪] [阶段1/4] ✅ 状态已在防重检查中原子性更新为 in_progress');
      
      // ========== 阶段2：前序结果获取 ==========
      executionPhase = 'previous_result';
      console.log('[执行Agent追踪] [阶段2/5] 获取前序结果');
      
      const allTasksInGroup = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, task.commandResultId))
        .orderBy(agentSubTasks.orderIndex);
      
      console.log('[执行Agent追踪] 同组任务概览:', {
        command_result_id: task.commandResultId,
        total_tasks: allTasksInGroup.length,
        order_indexes: allTasksInGroup.map(t => t.orderIndex).join(', '),
        tasks: allTasksInGroup.map(t => ({
          id: t.id,
          order_index: t.orderIndex,
          status: t.status,
          has_execution_result: !!t.resultData,
          execution_result_length: t.resultData ? t.resultData.length : 0
        }))
      });
      
      // 🔥 前序任务结果现在由 buildExecutionContext 内部获取，这里不再需要外部调用
      // getPrecedentInfoText 已合并到 buildExecutionContext 内部
      console.log('[执行Agent追踪] [阶段2/5] 前序任务结果将由 buildExecutionContext 内部获取');
      const previousResult = null;  // 不再需要外部传递，由 buildExecutionContext 内部处理
      
      // ========== 阶段3：执行Agent调用 ==========
      executionPhase = 'agent_execution';
      console.log('[执行Agent追踪] [阶段3/5] 调用执行Agent');
      console.log('[执行Agent追踪] 执行Agent信息:', {
        command_result_id: task.commandResultId,
        executor: task.fromParentsExecutor,
        task_id: task.id,
        order_index: task.orderIndex
      });
      
      console.log('[执行Agent追踪] 🔴🔴🔴 执行Agent调用...');
      executorResult = await this.callExecutorAgentDirectly(task);
      
      console.log('[执行Agent追踪] [阶段3/5] ✅ 执行Agent调用完成');
      console.log('[执行Agent追踪] 执行Agent返回结果:', {
        command_result_id: task.commandResultId,
        task_id: task.id,
        order_index: task.orderIndex,
        is_completed: executorResult.isCompleted,
        has_result: executorResult.result !== null && executorResult.result !== undefined,
        has_suggestion: executorResult.suggestion !== null && executorResult.suggestion !== undefined,
        result_preview: executorResult.result ? 
          (typeof executorResult.result === 'string' ? 
            executorResult.result.substring(0, 150) + '...' : 
            JSON.stringify(executorResult.result).substring(0, 150) + '...') : 
          null,
        suggestion_preview: executorResult.suggestion ? 
          executorResult.suggestion.substring(0, 150) + '...' : 
          null
      });
      
      // ========== 阶段4+5：原子更新（保存结果 + 更新状态） ==========
      executionPhase = 'save_result_and_status';
      console.log('[执行Agent追踪] [阶段4/4] 原子更新：保存执行结果 + 更新最终状态');
      
      // 🔴 🔴 🔴 关键优化：在更新前重新读取最新任务！（你的方案！）
      console.log('[执行Agent追踪] 🔄 重新读取最新任务，准备更新...');
      const latestTaskForExecute = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.id, task.id))
        .then(res => res[0]);

      if (!latestTaskForExecute) {
        console.error('[执行Agent追踪] ❌ 重新读取任务失败，无法更新');
        executionSuccess = true;
        return { executorResult: null, capabilities: [] };
      }

      console.log('[执行Agent追踪] ✅ 重新读取成功，最新状态:', {
        status: latestTaskForExecute.status,
        updatedAt: latestTaskForExecute.updatedAt
      });
      
      // ⚠️  🔴 重要：检查当前状态，如果已经是处理中的状态，不再更新！
      const terminalOrProcessingStates = ['completed', 'cancelled', 'pre_completed', 'pre_need_support', 'waiting_user'];
      if (terminalOrProcessingStates.includes(latestTaskForExecute.status)) {
        console.warn('[执行Agent追踪] ⚠️  ⚠️  ⚠️  任务已在处理中或已结束，跳过执行Agent原子更新:', {
          taskId: latestTaskForExecute.id,
          currentStatus: latestTaskForExecute.status
        });
        executionSuccess = true;
        return { executorResult: null, capabilities: [] };
      }
      
      // 🔴 修复：类型转换！ExecutorDirectResult → ExecutorAgentResult
      const resultToSave = convertExecutorDirectToAgentResult(executorResult);
      const resultJson = JSON.stringify(resultToSave);
      
      // 🔴 正常流程：根据 isCompleted 或 isTaskDown 判断状态
      // isCompleted: MCP 执行成功 或 任务明确完成
      // isTaskDown: 任务声明完成
      const finalStatus = (executorResult.isCompleted || executorResult.isTaskDown) ? 'pre_completed' : 'pre_need_support';
      
      // 🔴 新增：生成 resultText 字段（从 resultData 中提取文本内容）
      let resultText = '';
      try {
        resultText = this.extractResultTextFromResultData(resultToSave, task.fromParentsExecutor);
      } catch {
        resultText = '';
      }
      
      console.log('[执行Agent追踪] 🔴 类型转换完成:', {
        command_result_id: task.commandResultId,
        task_id: task.id,
        order_index: task.orderIndex,
        from_type: 'ExecutorDirectResult',
        to_type: 'ExecutorAgentResult',
        is_completed: executorResult.isCompleted,
        final_status: finalStatus,
        result_text_length: resultText.length
      });
      
      // ✅ P0优化：合并成一次原子操作，避免两次更新的一致性问题
      await db
        .update(agentSubTasks)
        .set({
          resultData: resultJson,
          resultText: resultText,  // 🔴 新增：保存文本化结果
          status: finalStatus,
          metadata: {
            ...((latestTaskForExecute.metadata as any) || {}),
            agentBRetryCount: 0,  // 🔴 重置 Agent B 重试计数器，允许下次正常审核
            lastExecutionCompletedAt: getCurrentBeijingTime()
          },
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, latestTaskForExecute.id)); // 🔴 使用重新读取的任务ID！
      
      console.log('[执行Agent追踪] [阶段4/4] ✅ 原子更新成功:', {
        command_result_id: task.commandResultId,
        task_id: task.id,
        order_index: task.orderIndex,
        final_status: finalStatus,
        is_completed: executorResult.isCompleted,
        result_json_length: resultJson.length,
        result_json_preview: resultJson.substring(0, 100) + '...'
      });
      
      // 🔴 🔴 🔴 新增：记录执行 Agent 的交互到 step_history 表！！！
      console.log('[执行Agent追踪] 🔴 记录执行 Agent 的交互（正常流程）:', {
        command_result_id: task.commandResultId,
        task_id: task.id,
        order_index: task.orderIndex,
        agentId: task.fromParentsExecutor,
        responseStatus: finalStatus
      });
      
      await this.recordAgentInteraction(
        task.commandResultId,
        task.orderIndex,
        task.fromParentsExecutor,  // agentId: 执行 Agent，如 'insurance-d'
        {
          type: 'executor_agent_execution',
          taskTitle: task.taskTitle,
          description: task.taskDescription,
          executorResult: {
            result: executorResult.result,  // 🔴 新增：执行结论声明
            suggestion: executorResult.suggestion,
            isCompleted: executorResult.isCompleted,
            structuredResult: (executorResult as any).structuredResult
          }
        },
        finalStatus,  // responseStatus: 'pre_completed' 或 'pre_need_support'
        resultToSave,  // responseContent: 执行 Agent 的完整结果
        task.id
      );
      
      console.log('[执行Agent追踪] ✅ 执行 Agent 交互记录完成');
      
      executionSuccess = true;
      
      console.log('');
      console.log('[执行Agent追踪] ========== 执行完成 ==========');
      console.log('[执行Agent追踪] 执行总结:', {
        command_result_id: task.commandResultId,
        task_id: task.id,
        order_index: task.orderIndex,
        success: true,
        final_status: finalStatus,
        duration_ms: getCurrentBeijingTime().getTime() - executionStartAt.getTime(),
        phases: ['status_update', 'previous_result', 'agent_execution', 'save_result', 'final_status'],
        completed_phases: 5
      });
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');
      
    } catch (error) {
      const errorAt = getCurrentBeijingTime();
      console.error('');
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('[执行Agent追踪] ❌ 执行失败！');
      console.error('[执行Agent追踪] 失败信息:', {
        command_result_id: task.commandResultId,
        task_id: task.id,
        order_index: task.orderIndex,
        failed_at_phase: executionPhase,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
        started_at: executionStartAt.toISOString(),
        failed_at: errorAt.toISOString(),
        duration_ms: errorAt.getTime() - executionStartAt.getTime(),
        execution_success: executionSuccess,
        has_executor_result: executorResult !== null
      });
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('');
      
      // ✅ P0修复：即使失败也要保存错误信息到 execution_result
      const errorResult: ExecutorDirectResult = {
        isCompleted: false,
        suggestion: `执行过程中发生错误 (阶段: ${executionPhase}): ${error instanceof Error ? error.message : String(error)}`
      };
      
      console.error('[执行Agent追踪] 保存错误结果到 execution_result:', errorResult);
      
      // 🔴 修复：类型转换！ExecutorDirectResult → ExecutorAgentResult
      const errorResultToSave = convertExecutorDirectToAgentResult(errorResult);

      // 更新状态 + 保存错误结果
      await db
        .update(agentSubTasks)
        .set({
          status: 'pre_need_support',
          resultData: JSON.stringify(errorResultToSave),
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));
      
      console.error('[执行Agent追踪] ✅ 错误结果已保存到数据库');
      
      // 🔴 🔴 🔴 新增：记录执行 Agent 的交互到 step_history 表！！！（异常流程）
      console.error('[执行Agent追踪] 🔴 记录执行 Agent 的交互（异常流程）:', {
        agentId: task.fromParentsExecutor,
        responseStatus: 'pre_need_support'
      });
      
      await this.recordAgentInteraction(
        task.commandResultId,
        task.orderIndex,
        task.fromParentsExecutor,  // agentId: 执行 Agent，如 'insurance-d'
        {
          type: 'executor_agent_execution',
          taskTitle: task.taskTitle,
          taskDescription: task.taskDescription,
          errorPhase: executionPhase,
          errorMessage: error instanceof Error ? error.message : String(error)
        },
        'pre_need_support',  // responseStatus
        errorResultToSave,    // responseContent: 错误结果
        task.id
      );
      
      console.error('[执行Agent追踪] ✅ 执行 Agent 交互记录完成（异常流程）');
    }
  }

  /**
   * ========== Agent T 作为执行 Agent 的特殊流程 ==========
   * Agent T 比较特殊：返回后需要先执行 MCP，再转为 pre_completed/pre_need_support
   */
  private async executeAgentTExecutorWorkflow(task: typeof agentSubTasks.$inferSelect) {
    const executionStartAt = getCurrentBeijingTime();
    const executionId = `t-${task.id}-${Date.now()}`;  // 🔴 新增：唯一执行ID，用于追踪
    let executionPhase = 'init';
    let executionSuccess = false;
    let executorResult: ExecutorDirectResult | null = null;
    let mcpExecutionSuccess = false;

    console.log('[SubtaskEngine] executeAgentTExecutorWorkflow 被调用', {
      executionId: executionId,
      task_id: task.id,
      command_result_id: task.commandResultId,
      order_index: task.orderIndex,
      executor: task.fromParentsExecutor,
      task_title: task.taskTitle,
      initial_status: task.status,
      started_at: executionStartAt.toISOString()
    });
    
    // 🔴 修复：在使用 capabilities 之前先定义并查询
    let capabilities: any[] = [];
    try {
      const isComplianceTask = task.orderIndex === 2 ||
        task.taskTitle.includes('合规') ||
        task.taskTitle.includes('审核');
      capabilities = await this.queryCapabilityList();
      console.log('[Agent T 执行追踪] 🔴 查询到 ' + capabilities.length + ' 个可用能力（合规任务=' + isComplianceTask + '）');
    } catch (capError) {
      console.error('[Agent T 执行追踪] ⚠️ 查询 capabilities 失败，但继续执行:', capError);
    }
    
    console.log('[Agent T 执行追踪] 🔄 开始执行（特殊流程）', {
      executionId: executionId,
      task_id: task.id,
      command_result_id: task.commandResultId,
      order_index: task.orderIndex
    });

    try {
      // ========== 阶段1：防重检查 ==========
      console.log('[Agent T 执行追踪] 🔄 调用防重检查...');
      const latestTask = await this.checkExecutorAgentTaskBeforeExecution(task);
      
      if (!latestTask) {
        console.warn('[Agent T 执行追踪] ⚠️ 防重检查未通过，跳过执行');
        return;
      }
      
      // 🔴 优化：检查任务是否已完成，如果已完成则跳过
      const terminalStates = ['completed', 'cancelled'];
      if (terminalStates.includes(latestTask.status)) {
        console.warn('[Agent T 执行追踪] ⚠️ 任务已完成或已取消，跳过执行:', latestTask.status);
        return;
      }
      
      // 🔴 优化：如果任务已经是 pre_completed 且有有效的 MCP 结果，跳过重复执行
      if (latestTask.status === 'pre_completed' && latestTask.resultData) {
        try {
          const resultData = typeof latestTask.resultData === 'string' 
            ? JSON.parse(latestTask.resultData) 
            : latestTask.resultData;
          if (resultData.isCompleted) {
            console.warn('[Agent T 执行追踪] ⚠️ 任务已成功完成(resultData.isCompleted=true)，跳过重复执行');
            return;
          }
        } catch (e) {
          // 解析失败，继续执行
        }
      }
      
      task = latestTask;
      executionPhase = 'fetch_current_task_history';
      
      // ========== 阶段2：获取历史信息 ==========
      console.log('[Agent T 执行追踪] [阶段0/5] 检查并获取当前任务的历史信息');
      
      let currentTaskHistoryText = '';
      try {
        const isReExecution = task.resultData !== null && task.resultData.length > 0;
        
        // 🔧 修复：无论是否重新执行，都需要获取前序任务结果
        // 合规校验需要前序文章内容
        console.log('[Agent T 执行追踪] 正在使用 PrecedentInfoExtractor 获取前序任务信息...');
        
        const { PrecedentInfoExtractor } = await import('@/lib/utils/precedent-info-extractor');
        const extractor = PrecedentInfoExtractor.getInstance();
        
        // 获取前序任务结果
        const previousResults = await extractor.extractPreviousTaskResults(
          task.commandResultId,
          task.orderIndex
        );
        
        // 格式化前序任务结果
        if (previousResults && previousResults.length > 0) {
          const formattedResults = previousResults
            .filter(r => r.resultText && r.resultText.trim().length > 0)
            .map(r => `【任务${r.orderIndex}】${r.taskTitle}\n结果：${r.resultText}`)
            .join('\n\n');
          
          if (formattedResults) {
            currentTaskHistoryText = `【前序任务结果】\n${formattedResults}`;
            console.log('[Agent T 执行追踪] 前序任务结果获取完成:', {
              previous_task_count: previousResults.length,
              has_content: currentTaskHistoryText.length > 0,
              text_length: currentTaskHistoryText.length
            });
          }
        }
        
        // 如果是重新执行，还需要获取当前任务的历史信息
        if (isReExecution) {
          console.log('[Agent T 执行追踪] 检测到这是重新执行的任务，获取当前任务历史信息...');
          const taskHistoryText = await extractor.extractAndFormatCurrentTaskHistory(task);
          if (taskHistoryText) {
            currentTaskHistoryText = currentTaskHistoryText 
              ? `${currentTaskHistoryText}\n\n【当前任务历史】\n${taskHistoryText}`
              : taskHistoryText;
          }
        }
        
        console.log('[Agent T 执行追踪] 历史信息获取完成:', {
          is_re_execution: isReExecution,
          has_history_text: currentTaskHistoryText.length > 0,
          history_text_length: currentTaskHistoryText.length
        });
      } catch (error) {
        console.warn('[Agent T 执行追踪] ⚠️ 获取历史信息失败，但继续执行:', error);
      }
      
      // 🔴 🔴 🔴 【已删除】外部 getPrecedentInfoText 调用已合并到 buildExecutionContext 内部
      // 前序任务结果将在 buildExecutionContext 内部获取
      
      // ========== 阶段4：调用 Agent T ==========
      executionPhase = 'agent_execution';
      console.log('[Agent T 执行追踪] [阶段2/5] 调用 Agent T（作为执行 Agent）');
      
      // 🔴 修复：统一使用外层查询的 capabilities，避免重复查询
      // 构建简化的 executionContext
      const initialExecutionContext = await this.buildExecutionContext(
        task,
        null, // executorResult 还没有
        capabilities,
        1,    // currentIteration
        1,    // maxIterations
        undefined
      );
      
      // 🔧 修复：将前序任务结果注入到 priorStepOutput
      // 🔧 P2-3 优化：处理边界情况，避免覆盖原有内容
      if (currentTaskHistoryText && currentTaskHistoryText.trim().length > 0) {
        initialExecutionContext.priorStepOutput = currentTaskHistoryText;
        console.log('[Agent T 执行追踪] 已将前序任务结果注入到 priorStepOutput，长度:', currentTaskHistoryText.length);
      } else if (!initialExecutionContext.priorStepOutput || initialExecutionContext.priorStepOutput.trim().length === 0) {
        // 仅在 priorStepOutput 为空时设置警告日志
        console.warn('[Agent T 执行追踪] ⚠️ 前序任务结果为空，请检查 result_text 字段。任务ID:', task.id, 'orderIndex:', task.orderIndex);
      }
      
      // ========== 调用 Agent T ==========
      const agentTDecision = await this.callAgentTTechExpert(task, initialExecutionContext, capabilities);
      
      console.log('[Agent T 执行追踪] ✅ Agent T 调用完成');
      console.log('[Agent T 执行追踪] Agent T 返回:', {
        hasMcpParams: !!agentTDecision.mcpParams,
        mcpParams: agentTDecision.mcpParams,
        // 🔴🔴🔴 新增：检测 AUTO_SPLIT
        decisionType: (agentTDecision as any).type,
        isNeedSplit: agentTDecision.isNeedSplit,
        hasSuggestedSplitPoints: !!(agentTDecision.suggestedSplitPoints && agentTDecision.suggestedSplitPoints.length > 0)
      });
      
      // 🔴🔴🔴 【核心】检测 Agent T 是否返回 AUTO_SPLIT 决策
      const agentTDecisionAny = agentTDecision as any;
      // 🔴 模型返回不稳定：有时用 needSplit，有时用 isNeedSplit，同时检查两个字段
      const isAutoSplit = 
        agentTDecisionAny.type === 'AUTO_SPLIT' || 
        agentTDecisionAny.type === 'auto_split' ||
        agentTDecisionAny.needSplit === true ||
        agentTDecisionAny.isNeedSplit === true;
      
      if (isAutoSplit) {
        // Agent T 返回 AUTO_SPLIT，设置状态为 auto_split
        console.log('[Agent T 执行追踪] 🔴🔴🔴 检测到 Agent T 返回 AUTO_SPLIT，准备设置 auto_split 状态');
        
        // 提取拆分信息
        const splitContext = agentTDecisionAny.context || {};
        const splitReason = splitContext.splitReason || agentTDecision.splitReason || '任务需要分步执行';
        const suggestedSplitPoints = splitContext.suggestedSplitPoints || agentTDecision.suggestedSplitPoints || [];
        const splitStrategy = splitContext.splitStrategy || 'step_by_step';
        
        console.log('[Agent T 执行追踪] 🔴🔴🔴 AUTO_SPLIT 拆分信息:', {
          splitReason,
          splitPointsCount: suggestedSplitPoints.length,
          splitStrategy
        });
        
        // 构建拆分元数据
        const splitMeta = {
          isAutoSplit: true,
          splitReason: splitReason,
          splitStrategy: splitStrategy,
          suggestedSplitPoints: suggestedSplitPoints,
          agentTDecision: {
            type: agentTDecisionAny.type,
            reasonCode: agentTDecisionAny.reasonCode,
            reasoning: agentTDecisionAny.reasoning,
            result: agentTDecision.result,
            suggestion: agentTDecision.suggestion,
            // 🔴🔴🔴 新增：保留 isNeedSplit 字段
            isNeedSplit: agentTDecisionAny.isNeedSplit ?? agentTDecisionAny.needSplit ?? false,
            splitReason: agentTDecisionAny.splitReason,
            suggestedSplitPoints: agentTDecisionAny.suggestedSplitPoints
          },
          createdAt: getCurrentBeijingTime().toISOString()
        };
        
        // 更新任务状态为 auto_split，并保存拆分信息
        await db
          .update(agentSubTasks)
          .set({
            status: 'auto_split',
            resultData: JSON.stringify(splitMeta) as any,
            resultText: `AUTO_SPLIT: ${splitReason}`,
            updatedAt: getCurrentBeijingTime()
          })
          .where(eq(agentSubTasks.id, task.id));
        
        console.log('[Agent T 执行追踪] 🔴🔴🔴 任务状态已设置为 auto_split，等待调度器处理');
        
        // 🔴 记录到 step_history（包含 isNeedSplit 字段）
        await this.recordAgentInteraction(
          task.commandResultId,
          task.orderIndex,
          task.fromParentsExecutor,
          {
            type: 'agent_t_auto_split',
            taskTitle: task.taskTitle,
            description: task.taskDescription,
            status: 'auto_split'
          },
          'auto_split',
          {
            // 🔴 显式包含 isNeedSplit 字段
            isNeedSplit: true,
            splitReason: splitReason,
            // 🔴 使用 suggestedSplitPoints 而不是 splitPoints（保持与 recordAgentInteraction 一致）
            suggestedSplitPoints: suggestedSplitPoints,
            splitStrategy: splitStrategy,
            result: agentTDecision.result,
            reasoning: agentTDecisionAny.reasoning || agentTDecision.reason
          },
          task.id
        );
        
        console.log('[Agent T 执行追踪] 🔴🔴🔴 AUTO_SPLIT 处理完成');
        return; // 直接返回，等待调度器处理 auto_split 状态
      }
      
      // 🔴 🔴 🔴 核心逻辑：根据 MCP 执行结果决定最终状态
      // - 有 mcpParams 且 MCP 执行成功 → pending（让 Agent B 继续评审）
      // - 有 mcpParams 但 MCP 执行失败 → pre_need_support
      // - 无 mcpParams → pre_need_support（需要用户介入）
      
      // 如果有 mcpParams，执行 MCP
      let mcpSuccess = false;
      if (agentTDecision.mcpParams) {
        console.log('[Agent T 执行追踪] 🔄 开始执行 MCP...');
        
        // 构建 MCP 执行决策
        const mcpDecision: AgentBDecision = {
          type: 'EXECUTE_MCP',
          reasonCode: 'MCP_CONTINUE',
          reasoning: agentTDecision.result || 'Agent T 选择执行 MCP',
          context: {
            executionSummary: 'Agent T 执行 MCP',
            riskLevel: 'low',
            suggestedAction: '执行 MCP'
          },
          data: { mcpParams: agentTDecision.mcpParams }
        };

        
        // 构建执行 Agent 结果
        const executorResult: ExecutorAgentResult = {
          isCompleted: true,
          isNeedMcp: true,
          isTaskDown: false,
          problem: 'Agent T 选择执行 MCP',
          executorOutput: {
            result: agentTDecision.result,
            suggestions: agentTDecision.suggestion
          }
        };

        console.log('zhangjinglu  executeAgentTExecutorWorkflow begin [await this.executeMcpWithRetry]', {
          executionId: executionId,
          task_id: task.id,
          command_result_id: task.commandResultId,
          order_index: task.orderIndex,
          mcpParams: mcpDecision.data?.mcpParams ? {
            toolName: mcpDecision.data.mcpParams.toolName,
            actionName: mcpDecision.data.mcpParams.actionName,
            hasParams: !!mcpDecision.data.mcpParams.params
          } : null,
          timestamp: getCurrentBeijingTime().toISOString()
        });
        
        // 执行 MCP
        mcpSuccess = await this.executeMcpWithRetry(
          task,
          mcpDecision,
          executorResult,
          capabilities,
          [],
          [],
          1,
          1,
          initialExecutionContext.priorStepOutput
        );
        
        console.log('zhangjinglu  executeAgentTExecutorWorkflow end [await this.executeMcpWithRetry]', {
          executionId: executionId,
          task_id: task.id,
          command_result_id: task.commandResultId,
          order_index: task.orderIndex,
          mcpSuccess: mcpSuccess,
          duration_ms: Date.now() - executionStartAt.getTime(),
          timestamp: getCurrentBeijingTime().toISOString()
        });
        console.log('[Agent T 执行追踪] [阶段2/5] 调用 Agent T（作为执行 Agent）');
        
        console.log('[Agent T 执行追踪] MCP 执行结果:', { mcpSuccess });
      }
      
      // 🔴🔴🔴 简化逻辑：使用 isCompleted 判断
      let finalStatus: 'pre_completed' | 'pre_need_support';
      
      if (agentTDecision.isCompleted === true) {
        finalStatus = 'pre_completed';
      } else {
        finalStatus = 'pre_need_support';
      }
      
      console.log('[Agent T 执行追踪] 🔴 状态判断完成', {
        task_id: task.id,
        order_index: task.orderIndex,
        command_result_id: task.commandResultId,
        executor: task.fromParentsExecutor,
        isCompleted: agentTDecision.isCompleted,
        finalStatus: finalStatus
      });
      
      // 🔴🔴🔴 【修复】生成 resultText 字段（用于前序任务结果传递）
      // 🔴 P0-1 修复：提取 resultDataToSave 为变量，避免重复创建对象
      // 🔴 P0-2 修复：统一使用 getCurrentBeijingTime() 确保时间一致性
      const resultDataToSave = {
        ...agentTDecision,
        updatedBy: 'agent_t_executor',
        updatedAt: getCurrentBeijingTime().toISOString()
      };
      
      let agentTResultText = '';
      try {
        agentTResultText = this.extractResultTextFromResultData(resultDataToSave, task.fromParentsExecutor);
        console.log('[Agent T 执行追踪] ✅ resultText 提取成功:', {
          taskId: task.id,
          resultTextLength: agentTResultText.length,
          resultTextPreview: agentTResultText.substring(0, 100)
        });
      } catch (extractError) {
        console.error('[Agent T 执行追踪] ❌ resultText 提取失败:', extractError);
        agentTResultText = '';
      }
      
      // 更新数据库（添加 resultText 字段）
      await db
        .update(agentSubTasks)
        .set({
          status: finalStatus,
          resultData: JSON.stringify(resultDataToSave),
          resultText: agentTResultText,  // 🔴 新增：保存文本化结果
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));
      
      // 🔴🔴🔴 【新增】执行成功后更新 reexecuteHistory 中最新记录的执行结果
      // 目的：让死循环检测能够识别到执行已经成功
      try {
        const taskForUpdate = await db
          .select({ metadata: agentSubTasks.metadata })
          .from(agentSubTasks)
          .where(eq(agentSubTasks.id, task.id))
          .limit(1);
        
        if (taskForUpdate.length > 0) {
          const currentMetadata = (taskForUpdate[0].metadata as any) || {};
          const reexecuteHistory = currentMetadata.reexecuteHistory || [];
          
          // 🔴 找到最新一条 reexecuteHistory 记录并更新其 executionResult
          if (reexecuteHistory.length > 0) {
            const latestRecord = reexecuteHistory[reexecuteHistory.length - 1];
            
            // 🔴 如果最新记录没有 executionResult，或者 executionResult.success 为 false，则更新
            if (!latestRecord.executionResult || !latestRecord.executionResult.success) {
              // 🔴 MCP 执行成功：mcpSuccess = true
              // 🔴 普通执行成功：isCompleted = true
              const executionSuccess = mcpSuccess === true || agentTDecision.isCompleted === true;
              
              console.log('[Agent T 执行追踪] 🔴 更新 reexecuteHistory 的 executionResult:', {
                taskId: task.id,
                executor: latestRecord.executor,
                previousExecutor: latestRecord.previousExecutor,
                mcpSuccess,
                isCompleted: agentTDecision.isCompleted,
                executionSuccess
              });
              
              // 更新最新记录的 executionResult
              reexecuteHistory[reexecuteHistory.length - 1].executionResult = {
                success: executionSuccess,
                mcpSuccess: mcpSuccess === true,
                isTaskDown: agentTDecision.isCompleted === true,
                executorResult: agentTDecision
              };
              
              await db
                .update(agentSubTasks)
                .set({
                  metadata: {
                    ...currentMetadata,
                    reexecuteHistory
                  },
                  updatedAt: getCurrentBeijingTime()
                })
                .where(eq(agentSubTasks.id, task.id));
              
              console.log('[Agent T 执行追踪] ✅ reexecuteHistory executionResult 更新成功');
            }
          }
        }
      } catch (updateError) {
        console.error('[Agent T 执行追踪] ❌ 更新 reexecuteHistory 失败:', updateError);
        // 不影响主流程
      }
      // 🔴🔴🔴 更新 reexecuteHistory 结束
      
      // 🔴🔴🔴 【新增】记录 Agent T 的交互到 step_history 表！！！
      console.log('[Agent T 执行追踪] 🔴 记录 Agent T 的交互到 step_history:', {
        command_result_id: task.commandResultId,
        task_id: task.id,
        order_index: task.orderIndex,
        agentId: task.fromParentsExecutor,
        responseStatus: finalStatus
      });
      
      // 🔴 从原始响应中提取所有额外字段（用于保存到 step_history）
      // 注意：agentTDecision 是 AgentTDecision 类型，可能不包含所有原始字段
      // 所以直接用 (agentTDecision as any) 保留原始数据
      const agentTDecisionRaw = agentTDecision as any;
      
      // 🔴🔴🔴 逐层追踪 isNeedSplit 的值
      console.log('[Agent T] 🔍 第1步 - agentTDecisionRaw 中的值:');
      console.log('[Agent T]   isNeedSplit:', agentTDecisionRaw.isNeedSplit);
      console.log('[Agent T]   needSplit:', agentTDecisionRaw.needSplit);
      console.log('[Agent T]   splitReason:', agentTDecisionRaw.splitReason);
      
      const needSplitValue = agentTDecisionRaw.needSplit ?? agentTDecisionRaw.isNeedSplit;
      const splitReasonValue = agentTDecisionRaw.splitReason;
      const suggestedSplitPointsValue = agentTDecisionRaw.suggestedSplitPoints;
      
      console.log('[Agent T] 🔍 第2步 - 提取后的值:');
      console.log('[Agent T]   needSplitValue =', needSplitValue);
      console.log('[Agent T]   splitReasonValue =', splitReasonValue);
      
      // 解构已知字段，保留其他所有原始字段
      const { result, suggestion, mcpParams, reason, needSplit, isNeedSplit, splitReason, suggestedSplitPoints, ...restOriginalFields } = agentTDecisionRaw;
      
      console.log('[Agent T] 🔍 第3步 - 解构后的值:');
      console.log('[Agent T]   isNeedSplit (局部变量) =', isNeedSplit);
      console.log('[Agent T]   restOriginalFields keys =', Object.keys(restOriginalFields || {}));
      
      const agentTResultToSave = {
        // 显式字段
        isCompleted: agentTDecision.isCompleted,
        isNeedMcp: !!agentTDecision.mcpParams,
        isTaskDown: agentTDecision.isCompleted,
        problem: agentTDecision.result || '',
        // 🔴 拆分相关字段（显式包含）
        isNeedSplit: needSplitValue,
        splitReason: splitReasonValue,
        suggestedSplitPoints: suggestedSplitPointsValue,
        // executorOutput
        executorOutput: {
          result: agentTDecision.result,
          suggestions: agentTDecision.suggestion,
          mcpParams: agentTDecision.mcpParams,
          mcpSuccess: mcpSuccess
        },
        // structuredResult
        structuredResult: {
          originalInstruction: {
            title: task.taskTitle,
            description: task.taskDescription || ''
          },
          executionSummary: {
            needsMcpSupport: !!agentTDecision.mcpParams,
            actionsTaken: agentTDecision.mcpParams ? [`${agentTDecision.mcpParams.toolName}/${agentTDecision.mcpParams.actionName}`] : [],
            toolsUsed: agentTDecision.mcpParams ? [agentTDecision.mcpParams.toolName] : [],
            resultContent: agentTDecision,
            failureReason: mcpSuccess ? undefined : agentTDecision.result,
            mcpSuccess: mcpSuccess
          }
        },
        // 🔴 合并原始响应的其他所有字段
        ...restOriginalFields
      };
      
      // 🔴🔴🔴 调试日志：检查 agentTResultToSave 中的 isNeedSplit
      console.log('[Agent T] 🔍 第4步 - agentTResultToSave.isNeedSplit:', agentTResultToSave.isNeedSplit);
      console.log('[Agent T] 🔍 第4步 - agentTResultToSave.splitReason:', agentTResultToSave.splitReason);
      console.log('[Agent T] 🔍 第4步 - agentTResultToSave JSON:', JSON.stringify(agentTResultToSave));
      
      await this.recordAgentInteraction(
        task.commandResultId,
        task.orderIndex,
        task.fromParentsExecutor,  // agentId: agent T
        {
          type: 'agent_t_execution',
          taskTitle: task.taskTitle,
          description: task.taskDescription,
          mcpParams: agentTDecision.mcpParams,
          mcpSuccess: mcpSuccess,
          executorResult: {
            result: agentTDecision.result,
            suggestion: agentTDecision.suggestion,
            isCompleted: agentTDecision.isCompleted,
            // 🔴 修复：使用 isNeedSplit 而不是 needSplit（字段名匹配 recordAgentInteraction 中的查找逻辑）
            isNeedSplit: needSplitValue,
            splitReason: splitReasonValue,
            suggestedSplitPoints: suggestedSplitPointsValue
          }
        },
        finalStatus,  // responseStatus: 'pre_completed' 或 'pre_need_support' 或 'waiting_user'
        agentTResultToSave,  // responseContent: Agent T 的完整结果
        task.id
      );
      
      console.log('[Agent T 执行追踪] ✅ Agent T 交互记录完成');
      
      // 🔴🔴🔴 【新增】Agent T 状态更新完成日志
      console.log('[Agent T 执行追踪] ✅ 状态更新成功，等待 Agent B 评审', {
        task_id: task.id,
        order_index: task.orderIndex,
        command_result_id: task.commandResultId,
        executor: task.fromParentsExecutor,
        finalStatus: finalStatus,
        // 🔴🔴🔴 关键信息：告知 Agent B 评审应该会被触发
        expectedNextStep: finalStatus === 'pre_completed' ? 'Agent B 评审' : '等待用户介入',
        timestamp: getCurrentBeijingTime().toISOString()
      });
      
      executionSuccess = true;
      
    } catch (error) {
      const errorAt = getCurrentBeijingTime();
      console.error('');
      console.error('═══════════════════════════════════════════════════════════════');
      console.error('[Agent T 执行追踪] ❌ 执行失败！');
      console.error('[Agent T 执行追踪] 失败信息:', {
        task_id: task.id,
        error_message: error instanceof Error ? error.message : String(error),
      });
      console.error('═══════════════════════════════════════════════════════════════');
      
      // 失败时也设置 pre_need_support
      await db
        .update(agentSubTasks)
        .set({
          status: 'pre_need_support',
          resultData: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            errorType: 'agent_t_execution_failed'
          }),
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));
      
      console.error('[Agent T 执行追踪] ✅ 错误结果已保存到数据库');
      
      // 🔴🔴🔴 【新增】记录 Agent T 的错误交互到 step_history 表！！！
      try {
        await this.recordAgentInteraction(
          task.commandResultId,
          task.orderIndex,
          task.fromParentsExecutor,  // agentId: agent T
          {
            type: 'agent_t_execution_error',
            taskTitle: task.taskTitle,
            description: task.taskDescription,
            error: error instanceof Error ? error.message : String(error),
            errorType: 'agent_t_execution_failed'
          },
          'pre_need_support',  // responseStatus
          {
            isCompleted: false,
            isNeedMcp: false,
            isTaskDown: false,
            problem: error instanceof Error ? error.message : String(error),
            executorOutput: {
              error: error instanceof Error ? error.message : String(error),
              errorType: 'agent_t_execution_failed'
            }
          },
          task.id
        );
        console.error('[Agent T 执行追踪] ✅ 错误交互记录完成');
      } catch (recordError) {
        console.error('[Agent T 执行追踪] ⚠️ 记录错误交互失败:', recordError);
      }
    }
  }

  /**
   * ========== Agent B 职责 ==========
   * 仅在 pre_completed 或 pre_need_support 状态时介入
   * 作为技术专家，进行评审
   * 根据不同状态，做出不同决策：
   *   pre_completed：APPROVE、NEED_REVISE、NEED_USER
   *   pre_need_support：CAN_HELP、NEED_USER
   */
  private async executeAgentBReviewWorkflow(task: typeof agentSubTasks.$inferSelect) {
    console.log('[Agent B 评审] 开始评审', {
      task_id: task.id,
      order_index: task.orderIndex,
      command_result_id: task.commandResultId,
      task_title: task.taskTitle,
      status: task.status,
      executor: task.fromParentsExecutor
    });

    // 🔒 状态守卫：评审前重新从数据库读取最新状态
    // 防止并发场景下，其他引擎实例已将任务更新为 waiting_user/completed，
    // 但本实例仍使用旧的内存数据（pre_completed）进行重复评审
    const latestTask = await db
      .select({ status: agentSubTasks.status })
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .then(res => res[0]);

    if (!latestTask) {
      console.warn('[Agent B 评审] 任务不存在，跳过:', task.id);
      return;
    }

    const reviewableStatuses = ['pre_completed', 'pre_need_support', 'auto_split'];
    if (!reviewableStatuses.includes(latestTask.status)) {
      console.log('[Agent B 评审] 🔒 任务状态已变更，跳过重复评审:', {
        taskId: task.id,
        oldStatus: task.status,
        currentStatus: latestTask.status
      });
      return;
    }
    
    // 🔴🔴🔴 【新增】处理 auto_split 状态：直接执行 AUTO_SPLIT，跳过 Agent B 调用
    if (task.status === 'auto_split') {
      console.log('[Agent B评审] 🔴🔴🔴 auto_split 状态 | taskId:', task.id);
      console.log('[Agent B评审] 🔴🔴🔴 直接执行 AUTO_SPLIT 逻辑，跳过 Agent B 调用');
      
      // 从 resultData 中提取拆分信息
      let splitMeta: any = null;
      if (task.resultData) {
        try {
          splitMeta = typeof task.resultData === 'string' 
            ? JSON.parse(task.resultData) 
            : task.resultData;
        } catch (e) {
          console.error('[Agent B评审] 🔴 解析 resultData 失败:', e);
        }
      }
      
      // 执行 AUTO_SPLIT 逻辑
      const splitResult = await this.handleAutoSplitDecision(task, {
        type: splitMeta?.agentTDecision?.type || 'AUTO_SPLIT',
        context: {
          splitStrategy: splitMeta?.splitStrategy || 'step_by_step',
          splitReason: splitMeta?.splitReason || '任务需要分步执行',
          suggestedSplitPoints: splitMeta?.suggestedSplitPoints || []
        },
        reasoning: splitMeta?.agentTDecision?.reasoning || 'Agent T 识别需要拆分',
        reasonCode: splitMeta?.agentTDecision?.reasonCode || 'NEED_SPLIT_DECLARED'
      });
      
      console.log('[Agent B评审] 🔴🔴🔴 AUTO_SPLIT 执行结果:', splitResult);
      return;
    }
    
    // 根据状态分流
    if (task.status === 'pre_completed') {
      await this.handlePreCompletedReview(task);
    } else if (task.status === 'pre_need_support') {
      await this.handlePreNeedSupportReview(task);
    } else if (task.status === 'auto_split') {
      await this.handleAutoSplitDecision(task);
    } else if (task.status === 'waiting_user') {
      // waiting_user 状态应该等待用户决策，不应该被 Agent B 重新接管
      console.log('[Agent B评审] waiting_user状态，等待用户决策:', task.id);
    } else {
      console.error('[AgentB评审] 未知状态:', task.status);
    }
  }

  /**
   * 处理 pre_completed 状态的评审
   * 
   * 【重要修改 2025-04-02】
   * 移除简化判断逻辑，所有情况都走 LLM 调用路径
   * 确保高阶能力（输入条件梳理、执行结果质量判断）生效
   * 
   * 修改前：Agent T + MCP 成功时直接返回 COMPLETE，绕过 LLM
   * 修改后：所有情况都调用 LLM，让 Agent B 真正执行审核
   */
  private async handlePreCompletedReview(task: typeof agentSubTasks.$inferSelect) {
    console.log('[Agent B评审] pre_completed状态 | taskId:', task.id, '| executor:', task.fromParentsExecutor);
    console.log('[Agent B评审] 调用 LLM 进行完整审核（高阶能力生效）');

    // 所有情况都调用 LLM，让 Agent B 真正执行审核
    await this.executeAgentBDecisionAndMcp(task);
  }

  /**
   * 处理 pre_need_support 状态的评审
   * 
   * 【重要修改 2025-04-02】
   * 移除简化判断逻辑，所有情况都走 LLM 调用路径
   * 确保高阶能力（输入条件梳理、智能路由）生效
   * 
   * 修改前：Agent T 无法处理时直接返回 NEED_USER，绕过 LLM
   * 修改后：所有情况都调用 LLM，让 Agent B 智能路由
   */
  private async handlePreNeedSupportReview(task: typeof agentSubTasks.$inferSelect) {
    console.log('[Agent B评审] pre_need_support状态 | taskId:', task.id, '| executor:', task.fromParentsExecutor);
    console.log('[Agent B评审] 调用 LLM 进行智能路由（高阶能力生效）');

    // 所有情况都调用 LLM，让 Agent B 智能路由
    await this.executeAgentBDecisionAndMcp(task);
  }

  /**
   * ========== Agent B 决策（agent B执行自己的任务：pre_need_support|pre_completed） + MCP 调用 ==========
   * 从 pre_completed/pre_need_support 状态开始
   * 查询 capability_list
   * Agent B 循环决策（最多 5 次）
   * MCP 执行（支持多次尝试）
   * 用户交互处理
   */
  private async executeAgentBDecisionAndMcp(task: typeof agentSubTasks.$inferSelect) {
    console.log('[SubtaskEngine] executeAgentBDecisionAndMcp 开始');
    console.log('[SubtaskEngine] Agent B 决策循环开始', {
      order_index: task.orderIndex,
      task_id: task.id,
      command_result_id: task.commandResultId,
      task_title: task.taskTitle,
      status: task.status,
      executor: task.fromParentsExecutor
    });
    
    try {
      // 使用公共初始化方法（可能抛错）
      let executorResult: ExecutorAgentResult | null = null;
      let capabilities: any[] = [];
      try {
        const result = await this.initializeExecutionContext(task);
        executorResult = result.executorResult;
        capabilities = result.capabilities;
      } catch (initError) {
        // 初始化失败，标记任务为失败状态
        console.error('[SubtaskEngine] ❌ 执行上下文初始化失败，标记任务失败:', initError);
        console.error('[SubtaskEngine] 错误堆栈:', initError instanceof Error ? initError.stack : new Error().stack);
        await this.markTaskFailed(task, {
          error: initError instanceof Error ? initError.message : String(initError),
          errorType: 'initialization_failed',
          timestamp: getCurrentBeijingTime().toISOString()
        });
        return;
      }
      
      if (!executorResult) {
        return;
      }

      // 执行主循环
      await this.executeDecisionLoop(
        task,
        executorResult,
        capabilities
      );
    } catch (error) {
      console.error('[SubtaskEngine] executeAgentBDecisionAndMcp 发生异常', {
        task_id: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // 🔴🔴🔴 修复：异常时也要记录 Agent B 的交互历史！
      console.log('[SubtaskEngine] 🔴🔴🔴 Agent B 执行异常，记录交互历史...');
      
      // 记录 Agent B 的异常交互历史
      await this.recordAgentInteraction(
        task.commandResultId,
        task.orderIndex,
        'agent B',
        {
          type: 'agent_b_review',
          taskTitle: task.taskTitle,
          description: task.taskDescription,
          status: task.status
        },
        'NEED_USER', // responseStatus
        {
          error: error instanceof Error ? error.message : String(error),
          errorType: 'agent_b_execution_failed',
          failedPhase: 'executeAgentBDecisionAndMcp',
          timestamp: getCurrentBeijingTime().toISOString(),
          result: '【系统异常】Agent B 执行过程中发生错误，需要用户介入处理',
          reason: error instanceof Error ? error.message : String(error)
        },
        task.id
      );
      
      console.log('[SubtaskEngine] ✅ Agent B 异常交互历史已记录');
      
      // 异常时设置为 waiting_user，等待用户处理
      await db
        .update(agentSubTasks)
        .set({
          status: 'waiting_user',
          metadata: {
            ...((task.metadata as any) || {}),
            executionError: error instanceof Error ? error.message : String(error),
            failedAt: getCurrentBeijingTime().toISOString(),
            failedPhase: 'executeAgentBDecisionAndMcp'
          },
          updatedAt: getCurrentBeijingTime()
        })
        .where(eq(agentSubTasks.id, task.id));
    }
  }

  /**
   * ========== 公共方法：初始化执行上下文 ==========
   * 从 task.resultData 中解析 executorResult
   * 查询 capability_list
   * 验证 executorResult
   */
  private async initializeExecutionContext(task: typeof agentSubTasks.$inferSelect): Promise<{
    executorResult: ExecutorAgentResult | null;
    capabilities: any[];
  }> {
    let executorResult: ExecutorAgentResult | null = null;
    let capabilities: any[] = [];

    // 1. 从 task.resultData 中解析 executorResult
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 从 resultData 中解析 executorResult...');
    if (task.resultData) {
      try {
        let parsed;
        // 🔴 修复：智能类型检查！
        // 如果已经是对象，直接使用；如果是字符串，才解析
        if (typeof task.resultData === 'string') {
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] resultData 是字符串，进行 JSON.parse');
          parsed = JSON.parse(task.resultData);
        } else {
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] resultData 已经是对象，直接使用');
          parsed = task.resultData;
        }
        
        // 🔴 修复：智能识别类型并兼容！
        // 🔥 首先增加调试日志，看看 parsed 到底是什么
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔍 parsed 类型:', typeof parsed);
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔍 parsed 内容:', JSON.stringify(parsed).substring(0, 300));
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔍 parsed 键:', Object.keys(parsed));
        
        // 🔥 首先检查是否是错误对象（这是之前执行失败时保存的错误）
        // 支持多种错误对象格式：
        // 1. 有 error 字段
        // 2. 有 errorType 字段  
        // 3. 有 errorMessage 字段
        // 4. success === false
        if ('error' in parsed || 'errorType' in parsed || 'errorMessage' in parsed || parsed.success === false) {
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  检测到错误对象（之前执行失败），标记为失败');
          // 错误对象 → 转换为 ExecutorAgentResult（标记为失败）
          executorResult = {
            isCompleted: false,
            isNeedMcp: false,
            isTaskDown: false,
            executorOutput: {
              result: `执行失败：${parsed.errorMessage || parsed.error || parsed.message || '未知错误'}`,
              output: '',
              suggestions: ''
            }
          };
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 错误对象处理完成');
        }
        // 检查是否是 ExecutorAgentResult 类型（有 isNeedMcp 字段）
        else if ('isNeedMcp' in parsed && 'isTaskDown' in parsed) {
          // 已经是正确的类型，直接使用
          executorResult = parsed as ExecutorAgentResult;
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 解析到 ExecutorAgentResult 类型（正确类型）');
        } 
        // 检查是否是 ExecutorDirectResult 类型（有 isCompleted 字段）
        else if ('isCompleted' in parsed) {
          // 旧数据，需要转换类型
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  检测到旧类型 ExecutorDirectResult，自动转换');
          executorResult = convertExecutorDirectToAgentResult(parsed as ExecutorDirectResult);
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 类型转换完成');
        }
        // 其他情况：未知类型，尝试兼容性处理
        else {
          // 🔴🔴🔴 兼容性处理：检测是否是文章内容格式
          if ('title' in parsed && 'content' in parsed) {
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  检测到文章内容格式，转换为 ExecutorAgentResult');
            // 文章内容格式 → 转换为 ExecutorAgentResult
            executorResult = {
              isCompleted: true,
              isNeedMcp: false,
              isTaskDown: true,
              executorOutput: {
                result: JSON.stringify(parsed),  // 保留原始内容
                output: parsed.content,  // 文章正文
                suggestions: parsed.description  // 文章描述
              }
            };
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 文章内容格式转换完成');
          }
          // 🔴🔴🔴 兼容性处理：检测是否是文章内容格式（articleTitle + articleContent）
          else if ('articleTitle' in parsed && 'articleContent' in parsed) {
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  检测到文章内容格式（articleTitle + articleContent），转换为 ExecutorAgentResult');
            // 文章内容格式 → 转换为 ExecutorAgentResult
            executorResult = {
              isCompleted: true,
              isNeedMcp: false,
              isTaskDown: true,
              executorOutput: {
                result: `【文章标题】${parsed.articleTitle}\n【任务完成】文章初稿已完成`,
                output: parsed.articleContent,  // 文章正文
                suggestions: `文章标题: ${parsed.articleTitle}`
              }
            };
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 文章内容格式转换完成');
          }
          // 🔴🔴🔴 兼容性处理：检测是否是 MCP 结果格式
          else if ('success' in parsed && 'mcpResult' in parsed) {
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  检测到 MCP 结果格式，转换为 ExecutorAgentResult');
            executorResult = {
              isCompleted: true,
              isNeedMcp: false,
              isTaskDown: true,
              executorOutput: {
                result: JSON.stringify(parsed),
                output: parsed.message || ''
              }
            };
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ MCP 结果格式转换完成');
          }
          // 无法识别，抛出错误
          else {
            const unknownTypeError = new Error(
              `[SubtaskEngine] ❌ 无法解析执行结果类型：` +
              `resultData 既不是 ExecutorAgentResult 也不是 ExecutorDirectResult，也不是兼容格式。` +
              `taskId=${task.id}, orderIndex=${task.orderIndex}, command_result_id=${task.commandResultId}`
            );
            console.error(unknownTypeError.message);
            throw unknownTypeError;
          }
        }
      } catch (e) {
        // JSON 解析失败，抛错
        const parseError = new Error(
          `[SubtaskEngine] ❌ resultData JSON 解析失败：` +
          `${e instanceof Error ? e.message : String(e)}，` +
          `taskId=${task.id}, orderIndex=${task.orderIndex}, command_result_id=${task.commandResultId}`
        );
        console.error(parseError.message);
        console.error('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 原始数据预览:', 
          typeof task.resultData === 'string' 
            ? task.resultData.substring(0, 200) + '...'
            : JSON.stringify(task.resultData).substring(0, 200) + '...'
        );
        throw parseError;
      }
    } else {
      // resultData 为空，抛错
      const emptyError = new Error(
        `[SubtaskEngine] ❌ 执行结果为空：` +
        `taskId=${task.id}, orderIndex=${task.orderIndex}, command_result_id=${task.commandResultId}`
      );
      console.error(emptyError.message);
      throw emptyError;
    }
    
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 解析到 executorResult:', executorResult);

    // 2. 查询 capability_list
    // 🔴 修复：即使没有 capabilityType，也查询所有可用能力（特别是合规校验任务）
    const isComplianceTask = task.orderIndex === 2 || 
                            task.taskTitle.includes('合规') || 
                            task.taskTitle.includes('审核');
    
    if (executorResult?.capabilityType) {
      console.log('[SubtaskEngine] 查询 capability_list（按 capabilityType）');
      capabilities = await this.queryCapabilityList(executorResult.capabilityType);
      console.log('[SubtaskEngine] 找到 ' + capabilities.length + ' 个可用能力');
    } else if (isComplianceTask) {
      console.log('[SubtaskEngine] 🔴 检测到合规校验任务，查询所有可用能力');
      capabilities = await this.queryCapabilityList(); // 查询所有能力
      console.log('[SubtaskEngine] 找到 ' + capabilities.length + ' 个可用能力（合规校验任务）');
    } else {
      console.log('[SubtaskEngine] 无 capabilityType，查询所有可用能力');
      capabilities = await this.queryCapabilityList(); // 查询所有能力
      console.log('[SubtaskEngine] 找到 ' + capabilities.length + ' 个可用能力');
    }

    // 3. 验证 executorResult
    if (!executorResult) {
      throw new Error(`无法获取 executorResult，任务ID: ${task.id}`);
    }

    return { executorResult, capabilities };
  }

  /**
   * ========== Agent B 决策循环（重构后） ==========
   * 
   * 流程：
   *   1. 构建执行上下文（历史记录、MCP结果、用户建议）
   *   2. 检查是否已有有效 MCP 结果 → 直接完成
   *   3. 调用 Agent B 决策
   *   4. 根据决策类型执行相应操作
   *   5. 返回是否继续循环
   */
  private async executeDecisionLoop(
    task: typeof agentSubTasks.$inferSelect,
    executorResult: ExecutorAgentResult,
    capabilities: any[]
  ) {
    const MAX_ITERATIONS = 1;  // 当前只执行一次
    let currentIteration = 0;
    let mcpExecutionHistory: McpAttempt[] = [];

    try {
      // 🔽 主循环（当前只执行一次）
      while (currentIteration < MAX_ITERATIONS) {
        currentIteration++;

        console.log(`\n[SubtaskEngine] ========== 决策循环 第${currentIteration}/${MAX_ITERATIONS}轮 ==========`, {
          taskId: task.id,
          orderIndex: task.orderIndex,
          title: task.taskTitle
        });

        // ─────────────────────────────────────────────
        // Step 1: 构建执行上下文
        // ─────────────────────────────────────────────
        const executionContext = await this.buildExecutionContext(
          task, executorResult, capabilities,
          currentIteration, MAX_ITERATIONS,
          (task.metadata as any)?.lastAgentBDecision
        );
        mcpExecutionHistory = executionContext.mcpExecutionHistory;

        console.log('[SubtaskEngine] 执行上下文: priorStepLen=' + (executionContext.priorStepOutput?.length || 0) 
          + ', mcpHistory=' + mcpExecutionHistory.length);

        // ─────────────────────────────────────────────
        // Step 2: 调用 Agent B 决策
        // ─────────────────────────────────────────────
        // 🔴 重要：始终先调用 Agent B！哪怕有 MCP 结果也要让 Agent B 先评审
        // 未来 Agent B 能力增强后，还会补充更多功能
        const agentBDecision = await this.callAgentBWithRetry(task, executionContext, capabilities, currentIteration);

        // Agent B 超时但有有效MCP → 直接完成（这是兜底逻辑，正常情况不会走到这里）
        // 🔴🔴🔴 【修复】必须传入 currentOrderIndex，防止前序任务的 MCP 被误判为当前任务的结果
        if ((agentBDecision as any).type === 'MCP_RESULT_EXISTS' && this.hasValidMcpResult(mcpExecutionHistory, task.orderIndex)) {
          console.log('[SubtaskEngine] ✅ Agent B超时但有有效MCP → 直接完成任务');
          await this.completeTaskWithMcpResult(task, executorResult, mcpExecutionHistory, currentIteration);
          return;
        }

        // Agent B 超时且无有效MCP → 需要用户介入
        if (agentBDecision.type === 'NEED_USER') {
          console.log('[SubtaskEngine] ⏳ Agent B决策失败 → 需要用户介入');
          // 记录评审结果
          await this.recordAgentInteraction(
            task.commandResultId, task.orderIndex, 'agent B',
            executorResult, 'NEED_USER',
            { decision: agentBDecision, reasoning: 'Agent B决策失败，需要用户介入' },
            task.id, currentIteration
          );
          const userMsg = agentBDecision.data?.promptMessage?.description 
            || agentBDecision.reasoning 
            || 'Agent B 决策失败，需要您的介入';
          await this.markTaskWaitingUser(task, userMsg);
          return;
        }

        // ─────────────────────────────────────────────
        // Step 4: 处理决策类型
        // ─────────────────────────────────────────────
        const shouldContinue = await this.handleDecisionType(
          task, agentBDecision, executorResult, capabilities,
          mcpExecutionHistory, [], currentIteration, MAX_ITERATIONS, 1
        );

        if (!shouldContinue) return;
      }

      // 达到最大循环次数
      console.log('[SubtaskEngine] ⚠️ 达到最大循环次数 → 强制完成');
      await this.handleMaxIterationsExceeded(task, executorResult, mcpExecutionHistory, [], currentIteration);

    } catch (error) {
      console.error('[SubtaskEngine] ❌ 决策循环异常:', error);

      // 异常时检查是否有有效MCP结果
      // 🔴🔴🔴 【修复】必须传入 currentOrderIndex，防止前序任务的 MCP 被误判为当前任务的结果
      if (this.hasValidMcpResult(mcpExecutionHistory, task.orderIndex)) {
        console.log('[SubtaskEngine] ✅ 异常恢复：检测到有效MCP → 直接完成任务');
        await this.completeTaskWithMcpResult(task, executorResult, mcpExecutionHistory, currentIteration);
        return;
      }

      throw error;
    }
  }

  // ═══════════════════════════════════════════════════
  // 私有方法：Agent B 调用（含重试）
  // ═══════════════════════════════════════════════════
  private async callAgentBWithRetry(
    task: typeof agentSubTasks.$inferSelect,
    executionContext: ExecutionContext,
    capabilities: any[],
    iteration: number
  ): Promise<AgentBDecision> {
    const MAX_RETRIES = 1;

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      try {
        console.log(`[SubtaskEngine] 🔄 调用Agent B (尝试${retry + 1}/${MAX_RETRIES + 1})`);
        
        const decision = await this.callAgentBWithDecision(task, executionContext, capabilities, iteration);
        
        console.log('[SubtaskEngine] ✅ Agent B决策:', decision.type);
        return decision;

      } catch (error) {
        console.warn(`[SubtaskEngine] ⚠️ Agent B调用失败 (${retry + 1}/${MAX_RETRIES}):`, error);

        if (retry < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000)); // 等待后重试
        } else {
          // 最终重试也失败 → 检查是否有有效MCP结果
          // 🔴🔴🔴 【修复】必须传入 currentOrderIndex，防止前序任务的 MCP 被误判为当前任务的结果
          if (this.hasValidMcpResult(executionContext.mcpExecutionHistory, task.orderIndex)) {
            return { type: 'MCP_RESULT_EXISTS' } as any;  // 标记为"有有效MCP"
          }
          
          // 没有有效MCP → 需要用户介入
          return {
            type: 'NEED_USER',
            reasonCode: 'USER_CONFIRM',
            reasoning: `Agent B调用超时（重试${MAX_RETRIES}次）`,
            context: { executionSummary: 'Agent B调用超时，需要用户确认', riskLevel: 'medium', suggestedAction: '请确认下一步' },
            data: { promptMessage: { title: 'Agent B超时', description: String(error), priority: 'medium' } }
          };
        }
      }
    }

    // 不应到达这里，但兜底返回 NEED_USER
    return { type: 'NEED_USER', reasonCode: 'UNEXPECTED', reasoning: '意外错误' } as any;
  }

  // ═══════════════════════════════════════════════════
  // 私有方法：使用MCP结果完成任务
  // ═══════════════════════════════════════════════════
  private async completeTaskWithMcpResult(
    task: typeof agentSubTasks.$inferSelect,
    executorResult: ExecutorAgentResult,
    mcpHistory: McpAttempt[],
    iteration: number
  ) {
    const lastResult = mcpHistory[mcpHistory.length - 1].result?.data;

    // 记录 Agent B 评审结果
    try {
      await this.recordAgentInteraction(
        task.commandResultId, task.orderIndex, 'agent B',
        executorResult, 'COMPLETE',
        {
          decision: { type: 'COMPLETE', reasoning: '检测到有效MCP结果，任务自动完成' },
          mcp_attempts: mcpHistory,
          execution_summary: { total: mcpHistory.length, successful: mcpHistory.filter(m => m.result?.status === 'success').length }
        },
        task.id, iteration
      );
    } catch (e) {
      console.error('[SubtaskEngine] ❌ 记录评审结果失败:', e);
    }

    await this.markTaskCompleted(task, { mcpResult: lastResult, completionType: 'mcp_complete' });
  }

  // ═══════════════════════════════════════════════════
  // Phase 4 新增：构建校验结果文本（注入 Agent B 提示词）
  // ═══════════════════════════════════════════════════
  private buildValidationResultTextForAgentB(result: ValidationResult): string {
    const { overall, scores, summary, rewriteSuggestions } = result;

    let text = '\n【📊 文章校验报告（Phase 4 自动校验）】\n';
    text += `\n总体判定: ${overall === 'pass' ? '✅ 通过' : overall === 'warn' ? '⚠️ 警告' : '❌ 不通过'}\n\n`;

    // 锚点完整性
    const anchor = scores.anchorIntegrity;
    text += `1. 核心锚点完整性: ${(anchor.score * 100).toFixed(1)}%（阈值 ${anchor.threshold * 100}%）`;
    text += anchor.score >= anchor.threshold ? ' ✅\n' : ' ❌\n';
    if (anchor.details) {
      text += `   ${anchor.details}\n`;
    }

    // 结构完整性
    const structure = scores.structureCompleteness;
    text += `\n2. 结构完整性: ${structure.passed ? '✅ 全模块覆盖' : '❌ 有缺失'}`;
    if (!structure.passed && structure.missingModules.length > 0) {
      text += ` 缺失: [${structure.missingModules.join(', ')}]`;
    }
    text += '\n';

    // 素材使用率
    const material = scores.materialUsage;
    if (material.totalCount > 0) {
      text += `\n3. 素材使用率: ${material.usedCount}/${material.totalCount} (${(material.rate * 100).toFixed(0)}%)`;
      text += material.rate >= material.threshold ? ' ✅\n' : ' ⚠️\n';
    }

    // 风格合规
    const style = scores.styleCompliance;
    const errorCount = style.violations.filter(v => v.severity === 'error').length;
    const warnCount = style.violations.filter(v => v.severity === 'warning').length;
    text += `\n4. 风格合规: ${style.severity === 'clean' ? '✅ 无违规' : `${style.severity === 'error' ? '❌' : '⚠️'} ${errorCount}处错误, ${warnCount}处警告`}\n`;

    // 汇总
    text += `\n--- 校验汇总 ---\n${summary}\n`;

    // 修改建议
    if (rewriteSuggestions.length > 0) {
      text += `\n--- 修改建议 ---\n`;
      rewriteSuggestions.forEach((s, i) => {
        text += `${i + 1}. ${s}\n`;
      });
    }

    return text;
  }

  // ═══════════════════════════════════════════════════
  // Phase 5 新增：LLM 情绪分类（后台异步持久化）
  // ═══════════════════════════════════════════════════
  private async runEmotionClassificationAsync(
    task: typeof agentSubTasks.$inferSelect,
    articleText: string,
    cachedResult?: EmotionClassificationResult  // 🔴 可选缓存结果，避免重复 LLM 调用
  ): Promise<void> {
    try {
      console.log('[SubtaskEngine] [Phase5] 🎭 开始 LLM 情绪分类持久化', { taskId: task.id, hasCached: !!cachedResult });

      const emotionResult: EmotionClassificationResult = cachedResult || await llmAssistedRuleService.classifyEmotion(articleText);

      // 将情绪分类结果持久化到 resultData.metadata
      const currentResultData = typeof task.resultData === 'string'
        ? JSON.parse(task.resultData)
        : (task.resultData || {});
      if (!currentResultData.metadata) currentResultData.metadata = {};
      currentResultData.metadata.emotionClassification = {
        primaryEmotion: emotionResult.primaryEmotion,
        confidence: emotionResult.confidence,
        secondaryTags: emotionResult.secondaryTags,
        analysisText: emotionResult.analysisText,
        classifiedAt: new Date().toISOString(),
      };

      await db.update(agentSubTasks)
        .set({ resultData: JSON.stringify(currentResultData) })
        .where(eq(agentSubTasks.id, task.id));

      console.log('[SubtaskEngine] [Phase5] ✅ 情绪分类完成并持久化', {
        taskId: task.id,
        emotion: emotionResult.primaryEmotion,
        confidence: emotionResult.confidence,
      });
    } catch (error) {
      console.warn('[SubtaskEngine] [Phase5] ⚠️ 情绪分类失败（不阻塞主流程）:', error instanceof Error ? error.message : String(error));
    }
  }

  // ═══════════════════════════════════════════════════
  // Phase 5 新增：风格一致性评估（后台异步执行）
  // ═══════════════════════════════════════════════════
  private async runStyleConsistencyAsync(
    task: typeof agentSubTasks.$inferSelect,
    articleText: string,
    confirmedOutline: string
  ): Promise<void> {
    try {
      // 🔴 Phase5 PoC: 使用 confirmedOutline 作为标杆文本进行风格一致性评估
      // 生产环境应从历史高质量文章中选取标杆，此处为 PoC 级别实现
      const benchmarks = [
        { name: '已确认大纲', content: confirmedOutline },
        // TODO: 从 core_anchor_assets 或历史高分文章中获取更多标杆
      ];

      console.log('[SubtaskEngine] [Phase5] 📐 开始风格一致性评估（后台）', {
        taskId: task.id,
        benchmarkCount: benchmarks.length,
      });

      const consistencyResult: StyleConsistencyResult = await styleSimilarityService.evaluateConsistency(
        articleText,
        benchmarks
      );

      // 将风格一致性结果持久化到 resultData.metadata
      const currentResultData = typeof task.resultData === 'string'
        ? JSON.parse(task.resultData)
        : (task.resultData || {});
      if (!currentResultData.metadata) currentResultData.metadata = {};
      currentResultData.metadata.styleConsistency = {
        averageSimilarity: consistencyResult.averageSimilarity,
        maxSimilarity: consistencyResult.maxSimilarity,
        minSimilarity: consistencyResult.minSimilarity,
        consistencyLevel: consistencyResult.consistencyLevel,
        suggestion: consistencyResult.suggestion,
        evaluatedAt: new Date().toISOString(),
      };

      await db.update(agentSubTasks)
        .set({ resultData: JSON.stringify(currentResultData) })
        .where(eq(agentSubTasks.id, task.id));

      console.log('[SubtaskEngine] [Phase5] ✅ 风格一致性评估完成并持久化', {
        taskId: task.id,
        level: consistencyResult.consistencyLevel,
        avgSim: consistencyResult.averageSimilarity,
      });
    } catch (error) {
      console.warn('[SubtaskEngine] [Phase5] ⚠️ 风格一致性评估失败（不阻塞主流程）:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * ========== 公共方法：构建MCP执行历史文本 ==========
   * @param mcpExecutionHistory MCP执行历史
   * @param currentOrderIndex 当前任务的order_index，用于区分前序和当前
   */
  private buildMcpHistoryText(mcpExecutionHistory: McpAttempt[], currentOrderIndex?: number): string {
    if (mcpExecutionHistory.length === 0) return '';

    // 🔴🔴🔴 用自然语言区分前序任务和当前任务的MCP执行结果
    const predecessorMcp = mcpExecutionHistory.filter(m => currentOrderIndex !== undefined && m.decision.orderIndex < currentOrderIndex);
    const currentMcp = mcpExecutionHistory.filter(m => currentOrderIndex === undefined || m.decision.orderIndex === currentOrderIndex);

    let historyText = '\n【MCP执行结果】\n';

    // 🔴 前序任务的MCP执行结果（用自然语言强调这是前序）
    if (predecessorMcp.length > 0) {
      historyText += '\n⚠️ 【前序任务的MCP执行结果】⚠️\n';
      historyText += '以下MCP执行结果是前序任务的，不是当前任务需要的！\n';
      predecessorMcp.forEach((m, idx) => {
        const naturalLanguageResult = this.generateMcpNaturalLanguage(m);
        historyText += '\n  【前序 order_index=' + m.decision.orderIndex + ' 的结果】\n' +
          '  - 工具: ' + m.decision.toolName + '/' + m.decision.actionName + '\n' +
          '  - 执行结果: ' + naturalLanguageResult + '\n';
        if (m.result.error) {
          historyText += '  - 错误详情: ' + m.result.error.message + '\n';
        }
      });
      historyText += '\n  ⛔ 重要提醒：前序任务的MCP执行成功，不代表当前任务已完成！\n';
    }

    // 🔴 当前任务的MCP执行结果
    if (currentMcp.length > 0) {
      historyText += '\n📋 【当前任务 order_index=' + currentOrderIndex + ' 的MCP执行状态】\n';
      currentMcp.forEach((m, idx) => {
        const naturalLanguageResult = this.generateMcpNaturalLanguage(m);
        historyText += '\n  【当前 order_index=' + m.decision.orderIndex + ' 的结果】\n' +
          '  - 工具: ' + m.decision.toolName + '/' + m.decision.actionName + '\n' +
          '  - 执行结果: ' + naturalLanguageResult + '\n';
        if (m.result.error) {
          historyText += '  - 错误详情: ' + m.result.error.message + '\n';
        }
      });
    }

    // 🔴 如果当前任务的MCP还没有执行
    if (currentMcp.length === 0 && predecessorMcp.length > 0) {
      historyText += '\n🔴 【当前任务还没有执行MCP！】\n';
      historyText += '   需要执行当前任务的MCP才能完成评审！\n';
    }

    historyText += '\n';
    return historyText;
  }

  /**
   * 🔴 新增：生成 MCP 自然语言描述
   * 
   * 🔴🔴🔴 重要区分：MCP 调用状态 vs MCP 返回结果 🔴🔴🔴
   * - MCP 调用状态（技术层面）：success / failed（HTTP 是否成功）
   * - MCP 返回结果（业务层面）：审核通过 / 审核未通过
   * 
   * ⚠️ 审核未通过 ≠ MCP 执行失败！
   * - 审核未通过 = MCP 调用成功 + 业务结果未通过
   * - MCP 执行失败 = 网络错误、超时等技术性问题
   */
  private generateMcpNaturalLanguage(mcpAttempt: McpAttempt): string {
    // 🔴🔴🔴 核心修复：区分 MCP 调用状态和业务结果 🔴🔴🔴
    
    // 🔴 情况1：MCP 技术性失败（网络错误、超时等）
    if (mcpAttempt.result.status !== 'success') {
      return '❌ MCP 技术执行失败（需重试）！' + this.getFailureDescription(mcpAttempt.result);
    }
    
    // 🔴 情况2：MCP 调用成功（status === 'success'）
    // 无论业务结果是成功还是失败，MCP 调用本身是成功的
    if (mcpAttempt.result.status === 'success') {
      const data = mcpAttempt.result.data;
      
      // 🔴 子情况2.1：业务成功（data.success === true）
      if (data?.success === true) {
        return '✅ MCP 调用成功，业务结果: 通过！' + this.getSuccessDescription(data);
      }
      
      // 🔴 子情况2.2：业务失败（审核未通过等）— 这是正常结果，不是执行失败！
      if (data?.success === false) {
        // 🔴 关键修复：审核未通过 = MCP 调用成功 + 业务结果未通过
        const businessResult = this.getBusinessResultDescription(data);
        return '✅ MCP 调用成功，' + businessResult;
      }
      
      // 🔴 子情况2.3：没有明确的 success 字段
      if (data?.approved !== undefined) {
        // 兼容旧格式：approved 字段
        return data.approved 
          ? '✅ MCP 调用成功，审核结果: 通过！' + this.getSuccessDescription(data)
          : '✅ MCP 调用成功，审核结果: 未通过（发现 ' + (data.issues?.length || 0) + ' 个问题）';
      }
      
      // 🔴 子情况2.4：其他成功情况
      return '✅ MCP 调用成功！' + this.getSuccessDescription(data || {});
    }
    
    // 🔴 其他情况（未知状态）
    return '⚠️ MCP 执行结果未知，需要人工判断';
  }

  /**
   * 🔴 新增：获取业务结果描述（审核未通过等）
   */
  private getBusinessResultDescription(data: any): string {
    // 合规审核未通过
    if (data.approved === false || data.issues) {
      return '审核结果: 未通过（发现 ' + (data.issues?.length || 0) + ' 个合规问题）';
    }
    
    // 有错误信息
    if (data.error || data.message) {
      return '业务结果: ' + (data.error || data.message);
    }
    
    return '业务结果: 未通过';
  }

  /**
   * 🔴 新增：生成成功描述
   */
  private getSuccessDescription(data: any): string {
    // 根据不同类型的 MCP 返回，生成友好的成功描述
    if (data.approved !== undefined) {
      return data.approved 
        ? '合规审核通过，文章可以发布' 
        : '合规审核未通过，发现 ' + (data.issues?.length || 0) + ' 个问题需要修改';
    }
    if (data.media_id) {
      return '素材上传成功，media_id: ' + data.media_id;
    }
    if (data.article_id) {
      return '文章发布成功，article_id: ' + data.article_id;
    }
    if (data.draft_id) {
      return '文章已保存到草稿箱，draft_id: ' + data.draft_id;
    }
    if (data.msg) {
      return '操作成功：' + data.msg;
    }
    return '操作已完成';
  }

  /**
   * 🔴 新增：生成失败描述（HTTP 层失败）
   */
  private getFailureDescription(result: any): string {
    // 根据不同的失败原因，生成友好的失败描述
    if (result.status === 'network_error') {
      return '网络连接失败，请检查网络配置';
    }
    if (result.status === 'timeout') {
      return '请求超时，请检查网络或重试';
    }
    if (result.status === 401) {
      return '认证失败，权限不足或 token 过期';
    }
    if (result.status === 403) {
      return '权限不足，无法执行此操作';
    }
    if (result.status === 404) {
      return '资源不存在，请检查请求参数';
    }
    if (result.status === 500) {
      return '服务器内部错误，请稍后重试';
    }
    if (result.error?.message) {
      return result.error.message;
    }
    return '请求失败，状态码: ' + result.status;
  }

  /**
   * 🔴 新增：生成业务层失败描述
   */
  private getBusinessFailureDescription(data: any): string {
    // 根据不同的业务失败原因，生成友好的失败描述
    if (data.error) {
      return data.error;
    }
    if (data.message) {
      return data.message;
    }
    if (data.errcode) {
      return '微信返回错误码: ' + data.errcode + '，错误信息: ' + (data.errmsg || '未知');
    }
    return '业务执行失败，原因未知';
  }

  /**
   * ========== 公共方法：构建用户反馈文本 ==========
   */
  private buildUserFeedbackText(userFeedback: ExecutionContext['userFeedback']): string {
    if (!userFeedback) return '';
    
    return '\n【⚠️  ⚠️  ⚠️  用户反馈 - 请务必重视！⚠️  ⚠️  ⚠️ 】\n' +
'【用户反馈】\n' +
'- 反馈类型: ' + userFeedback.feedbackType + '\n' +
'- 反馈内容: ' + JSON.stringify(userFeedback.userInput) + '\n' +
'- 反馈时间: ' + userFeedback.feedbackTime + '\n' +
'\n【重要提示】\n' +
'- 用户的反馈是最高优先级的决策依据\n' +
'- 请务必认真对待用户的反馈和决定\n' +
'- 如果用户已经确认可以继续，应该优先考虑 COMPLETE 或 EXECUTE_MCP\n' +
'- 不要重复询问用户同样的问题\n';
  }

  /**
   * 🔥 Phase 5.5: 根据任务获取风格模板ID
   * @description 从任务的 metadata 中获取 accountId，然后根据 accountId 获取绑定的模板ID
   * 🔥 修复：多平台支持 - 传递 platform 参数给 getDefaultTemplate
   * @param task 子任务
   * @returns 模板ID（如果未绑定则返回默认模板ID）
   */
  private async getTemplateIdForTask(task: typeof agentSubTasks.$inferSelect): Promise<string | undefined> {
    try {
      const { styleTemplateService } = await import('@/lib/services/style-template-service');
      // P2 修复：导入 getValidPlatform 进行运行时校验
      const { DEFAULT_PLATFORM, getValidPlatform } = await import('@/lib/db/schema/style-template');
      
      // 从 metadata 中获取 accountId
      const metadata = task.metadata as Record<string, any> | null;
      const accountId = metadata?.accountId;
      
      // 🔥 确定目标平台：优先从账号获取，否则使用默认平台
      let targetPlatform: string = DEFAULT_PLATFORM;
      
      if (accountId) {
        // 🔥 先查询账号的平台信息
        const accountPlatform = await styleTemplateService.getAccountPlatform(accountId);
        if (accountPlatform) {
          targetPlatform = accountPlatform;
          console.log(`[SubtaskEngine] 账号 ${accountId} 平台: ${targetPlatform}`);
        }
        
        // 根据账号ID获取绑定的模板ID
        const templateId = await styleTemplateService.getTemplateIdByAccount(accountId);
        
        if (templateId) {
          console.log(`[SubtaskEngine] 账号 ${accountId} 绑定模板: ${templateId}`);
          return templateId;
        } else {
          console.log(`[SubtaskEngine] 账号 ${accountId} 未绑定模板，尝试使用 ${targetPlatform} 平台默认模板`);
        }
      } else {
        console.log(`[SubtaskEngine] 任务未绑定账号，尝试使用 ${targetPlatform} 平台默认模板`);
      }
      
      // 🔥 修复：传递 platform 参数，确保获取正确平台的默认模板
      // P2 修复：使用 getValidPlatform() 进行运行时校验，避免 as any
      // 使用 workspaceId 替代 userId（多用户 Workspace 架构）
      const workspaceId = task.workspaceId || 'default-workspace';
      const validPlatform = getValidPlatform(targetPlatform);
      const defaultTemplate = await styleTemplateService.getDefaultTemplate(workspaceId, validPlatform);
      
      if (defaultTemplate) {
        console.log(`[SubtaskEngine] 使用默认模板: ${defaultTemplate.id} (${defaultTemplate.name}, 平台: ${defaultTemplate.platform})`);
        return defaultTemplate.id;
      }
      
      console.log('[SubtaskEngine] 未找到默认模板，返回 undefined');
      return undefined;
    } catch (error) {
      console.error('[SubtaskEngine] 获取模板ID失败:', error);
      return undefined;
    }
  }

  /**
   * ========== 公共方法：构建执行上下文 ==========
   * @description 内部查询 mcpRecords 并转换为 mcpExecutionHistory
   * @param agentBDecision 可选的 Agent B 决策（用于 REEXECUTE_EXECUTOR 场景）
   */
  private async buildExecutionContext(
    task: typeof agentSubTasks.$inferSelect,
    executorResult: ExecutorAgentResult,
    capabilities: any[],
    currentIteration: number,
    maxIterations: number,
    agentBDecision?: AgentBDecision | undefined
  ): Promise<ExecutionContext> {
    // ========== 1. 查询 step_history（历史交互记录） ==========
    console.log('[SubtaskEngine] 查询 step_history...');
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime);
    
    console.log('[SubtaskEngine] 找到历史记录数:', historyRecords.length);
    
    // ========== 2. 解析 userInteractions ==========
    let userInteractions: UserInteraction[] = [];
    let latestUserDecision: AgentBDecision | null = null;
    
    for (const record of historyRecords) {
      const content = record.interactContent as any;
      
      // 解析用户交互
      if (record.interactUser === 'human' && record.interactType === 'response') {
        if (content.type === 'user_decision' || content.type === 'user_interaction') {
          userInteractions.push({
            interactionId: 'history-' + record.id,
            interactionNumber: record.interactNum || 0,
            timestamp: record.interactTime,
            keyFieldsConfirmed: content.interactionData?.fieldValues ? 
              Object.entries(content.interactionData.fieldValues).map(([fieldId, fieldValue]) => ({
                fieldId,
                fieldName: fieldId,
                fieldValue,
                isModified: true
              })) : [],
            selectedSolution: {
              solutionId: content.interactionData?.selectedSolution || 'default',
              solutionLabel: '用户选择方案',
              solutionDescription: content.userDecision || '',
              selectedAt: record.interactTime
            },
            userComment: content.interactionData?.notes ? {
              content: content.interactionData.notes,
              inputAt: record.interactTime
            } : undefined,
            userInfo: {
              userId: 'human',
              userName: '用户'
            },
            submission: {
              submittedAt: record.interactTime,
              status: 'completed',
              processingTime: 0
            }
          });
          
          // 记录最新用户决策（最高优先级）
          if (content.type === 'user_decision') {
            latestUserDecision = content;
          }
        }
      }
    }
    
    // ========== 2.5 查询 BossOrder（最高优先级用户指令） ==========
    console.log('[SubtaskEngine] 查询 BossOrder（最高优先级用户指令）...');
    let bossOrder: any = null;
    
    try {
      // 查询 interactUser = 'boss' 且 interactType = 'agent_interaction' 的记录
      const bossOrderRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, task.commandResultId as any),
            eq(agentSubTasksStepHistory.stepNo, task.orderIndex),
            eq(agentSubTasksStepHistory.interactUser, 'boss'),
            eq(agentSubTasksStepHistory.interactType, 'agent_interaction')
          )
        )
        .orderBy(desc(agentSubTasksStepHistory.interactTime));
      
      console.log('[SubtaskEngine] 找到 BossOrder 记录数:', bossOrderRecords.length);
      
      // 解析最新的 BossOrder
      if (bossOrderRecords.length > 0) {
        const latestBossOrderRecord = bossOrderRecords[0];
        const bossOrderContent = latestBossOrderRecord.interactContent as any;
        
        bossOrder = {
          type: 'agent_interaction',
          agentId: bossOrderContent?.agentId || 'Agent T',
          timestamp: latestBossOrderRecord.interactTime,
          requestContent: bossOrderContent?.requestContent || {
            type: bossOrderContent?.requestContent?.type || 'unknown',
            taskTitle: task.taskTitle,
            description: bossOrderContent?.requestContent?.description || task.taskDescription || '',
            hasStructuredResult: false
          },
          responseStatus: bossOrderContent?.responseStatus || 'pending',
          responseContent: bossOrderContent?.responseContent || {
            toolsUsed: [],
            isCompleted: false,
            actionsTaken: [],
            decisionType: 'PENDING'
          }
        };
        
        console.log('[SubtaskEngine] ✅ BossOrder 已加载:', {
          agentId: bossOrder.agentId,
          taskTitle: bossOrder.requestContent?.taskTitle,
          responseStatus: bossOrder.responseStatus
        });
      } else {
        console.log('[SubtaskEngine] ⚠️  未找到 BossOrder 记录');
      }
    } catch (error) {
      console.warn('[SubtaskEngine] ⚠️  查询 BossOrder 失败:', {
        message: error instanceof Error ? error.message : String(error)
      });
    }
    
    // ========== 3. 查询 MCP 执行记录（只查询当前 order_index 和前序 order_index） ==========
    console.log('[SubtaskEngine] 查询 MCP 执行记录（当前 order_index=' + task.orderIndex + ' 和前序 order_index=' + (task.orderIndex - 1) + '）...');
    const mcpRecords = await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(
        and(
          eq(agentSubTasksMcpExecutions.commandResultId, task.commandResultId as any),
          // 🔴🔴🔴 【优化】只查询当前 order_index 和前序 order_index 的 MCP 执行结果
          inArray(
            agentSubTasksMcpExecutions.orderIndex,
            [task.orderIndex - 1, task.orderIndex]
          )
        )
      )
      .orderBy(agentSubTasksMcpExecutions.attemptTimestamp);
    
    console.log('[SubtaskEngine] 🔴 找到 MCP 执行记录数:', {
      command_result_id: task.commandResultId,
      order_index_2_or_3: true,
      mcp_records_count: mcpRecords.length
    });
    
    // 将 MCP 记录转换为 mcpExecutionHistory 格式
    let mcpExecutionHistory: McpAttempt[] = [];
    if (mcpRecords.length > 0) {
      console.log('[SubtaskEngine] 🔴 转换 MCP 记录到 mcpExecutionHistory...');
      for (const mcpRecord of mcpRecords) {
        // 解析错误信息
        let errorInfo: McpAttempt['result']['error'] | undefined;
        if (mcpRecord.errorMessage) {
          errorInfo = {
            code: mcpRecord.errorCode || 'UNKNOWN',
            message: mcpRecord.errorMessage,
            type: this.classifyErrorType(mcpRecord.errorMessage)
          };
        }
        
        mcpExecutionHistory.push({
          attemptId: mcpRecord.attemptId || '',
          attemptNumber: mcpRecord.attemptNumber || 1,
          timestamp: mcpRecord.attemptTimestamp || new Date(),
          decision: {
            solutionNum: mcpRecord.solutionNum || 1,
            toolName: mcpRecord.toolName || '',
            actionName: mcpRecord.actionName || '',
            reasoning: mcpRecord.reasoning || '',
            strategy: (mcpRecord.strategy as McpAttempt['decision']['strategy']) || 'initial',
            orderIndex: mcpRecord.orderIndex || 0  // 🔴🔴🔴 【修复】添加 orderIndex，用于区分当前任务和前序任务的 MCP 结果
          },
          params: {
            accountId: (mcpRecord.params && typeof mcpRecord.params === 'object') 
              ? (mcpRecord.params as any).accountId || this.getDefaultAccountId(task.fromParentsExecutor)
              : this.getDefaultAccountId(task.fromParentsExecutor),
            ...((mcpRecord.params && typeof mcpRecord.params === 'object') ? mcpRecord.params : {})
          },
          result: {
            status: (mcpRecord.resultStatus as 'success' | 'failed') || 'failed',
            data: mcpRecord.resultData,
            error: errorInfo,
            executionTime: mcpRecord.executionTimeMs || 0
          },
          failureAnalysis: mcpRecord.failureType ? {
            isRetryable: mcpRecord.isRetryable || false,
            failureType: mcpRecord.failureType as 'temporary' | 'resource_unavailable',
            suggestedNextAction: 'retry_same' as const
          } : undefined
        });
      }
      console.log('[SubtaskEngine] 🔴 MCP 记录转换完成，当前 mcpExecutionHistory 数量:', mcpExecutionHistory.length);
    }
    
    // 🔴 修复：处理 executorResult 为 null 的情况
    const safeExecutorResult = executorResult ?? {
      isNeedMcp: false,
      isTaskDown: false,
      resultData: undefined
    };
    
    // 🔴 新增：打印详细的任务信息，方便追踪
    console.log('[SubtaskEngine] ========== 开始构建执行上下文 ==========', {
      command_result_id: task.commandResultId,
      task_title: task.taskTitle,
      order_index: task.orderIndex,
      executorResultNull: executorResult === null
    });
    
    // 🔴 🔴🔴 【优化】统一解析 resultData，避免重复解析
    // 统一的内容字段列表（用于提取文本内容）
    const CONTENT_FIELDS = [
      'output', 'content', 'articleContent', 'text', 'message', 'description', 
      'summary', 'result', 'article', 'stepOutput', 'step_output',
      'data', 'response', 'answer', 'resultContent'
    ];
    
    // 辅助函数：从对象中提取内容字段
    const extractContentField = (obj: any, skipFields: string[] = []): string | undefined => {
      if (!obj || typeof obj !== 'object') return undefined;
      
      // 优先检查 CONTENT_FIELDS 中的字段
      for (const field of CONTENT_FIELDS) {
        if (skipFields.includes(field)) continue;
        const value = obj[field];
        if (typeof value === 'string' && value.length > 50) {
          return value;
        }
      }
      return undefined;
    };
    
    // 统一解析 resultDataData（只解析一次）
    let parsedResultData: any = null;
    if (safeExecutorResult.resultData) {
      try {
        parsedResultData = typeof safeExecutorResult.resultData === 'string' 
          ? JSON.parse(safeExecutorResult.resultData)
          : safeExecutorResult.resultData;
        
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 解析 resultDataData 完成');
      } catch (e) {
        console.warn('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  解析 resultData 失败:', e);
      }
    }
    
    // 🔴 统一获取 priorStepOutputText
    let priorStepOutputText = '';
    try {
      // 1. 先尝试从 parsedResultData 中提取（统一解析结果）
      if (parsedResultData) {
        // 🔴🔴🔴 【修复】优先使用 structuredResult.resultContent（可能包含完整内容）
        // 而不是被截断的 output 字段
        let extracted: string | undefined;
        
        // 1.1 优先检查 structuredResult.resultContent（完整内容）
        if (parsedResultData.structuredResult && typeof parsedResultData.structuredResult === 'object') {
          const sr = parsedResultData.structuredResult;
          if (sr.resultContent && typeof sr.resultContent === 'string' && sr.resultContent.length > 50) {
            extracted = sr.resultContent;
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 从 structuredResult.resultContent 获取到完整内容，长度:', extracted.length);
          } else if (sr.executionSummary?.resultContent && typeof sr.executionSummary.resultContent === 'string' && sr.executionSummary.resultContent.length > 50) {
            extracted = sr.executionSummary.resultContent;
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 从 structuredResult.executionSummary.resultContent 获取到完整内容，长度:', extracted.length);
          }
        }
        
        // 1.2 如果没有 structuredResult，尝试直接字段
        if (!extracted) {
          extracted = extractContentField(parsedResultData);
        }
        
        // 1.3 嵌套 result.xxx
        if (!extracted && parsedResultData.result && typeof parsedResultData.result === 'object') {
          extracted = extractContentField(parsedResultData.result);
        }
        
        // 1.4 直接从 safeExecutorResult.resultContent 获取
        if (!extracted && (safeExecutorResult as any).resultContent && typeof (safeExecutorResult as any).resultContent === 'string') {
          extracted = (safeExecutorResult as any).resultContent;
        }
        
        if (extracted) {
          priorStepOutputText = extracted;
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 从 resultData 提取到内容，长度:', priorStepOutputText.length);
        }
      }
      
      // 2. 如果从 resultData 中没找到，再尝试从 ArticleContentService 获取
      if (!priorStepOutputText) {
        const { ArticleContentService } = await import('./article-content-service');
        const articleService = ArticleContentService.getInstance();
        const articleData = await articleService.getArticleContent(task.commandResultId);
        
        if (articleData) {
          priorStepOutputText = articleData.content;
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 从 ArticleContentService 获取到文章内容:', {
            content_length: priorStepOutputText.length
          });
        } else {
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  未从 ArticleContentService 获取到文章内容');
        }
      }
    } catch (error) {
      console.warn('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  获取上一步骤输出失败:', {
        message: error instanceof Error ? error.message : String(error)
      });
    }

    // 🔴 统一构建 executorOutput（复用 parsedResultData）
    let executorOutput: ExecutionContext['executorFeedback']['executorOutput'] = undefined;
    if (parsedResultData) {
      // 🔴🔴🔴 【修复】优先使用 structuredResult.resultContent（可能包含完整内容）
      let outputContent: string | undefined;
      
      // 1. 优先从 structuredResult.resultContent 获取（完整内容）
      if (parsedResultData.structuredResult && typeof parsedResultData.structuredResult === 'object') {
        const sr = parsedResultData.structuredResult;
        if (sr.resultContent && typeof sr.resultContent === 'string' && sr.resultContent.length > 50) {
          outputContent = sr.resultContent;
        } else if (sr.executionSummary?.resultContent && typeof sr.executionSummary.resultContent === 'string' && sr.executionSummary.resultContent.length > 50) {
          outputContent = sr.executionSummary.resultContent;
        }
      }
      
      // 2. 如果没有 structuredResult，尝试直接字段
      if (!outputContent) {
        outputContent = extractContentField(parsedResultData);
      }
      
      // 3. 尝试从 result.xxx 获取
      if (!outputContent && parsedResultData.result && typeof parsedResultData.result === 'object') {
        outputContent = extractContentField(parsedResultData.result);
      }
      
      // 4. 尝试从 safeExecutorResult.resultContent 获取
      if (!outputContent && (safeExecutorResult as any).resultContent && typeof (safeExecutorResult as any).resultContent === 'string') {
        outputContent = (safeExecutorResult as any).resultContent;
      }
      
      executorOutput = {
        output: outputContent,
        suggestions: parsedResultData.suggestions || parsedResultData.suggestion || undefined,
        reasoning: parsedResultData.reasoning || parsedResultData.thought || undefined,
        structuredResult: parsedResultData.structuredResult || undefined,
        additionalInfo: parsedResultData.additionalInfo || undefined,
      };
      
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 解析 executorOutput:', {
        hasOutput: !!executorOutput.output,
        outputLength: executorOutput.output?.length || 0,
        hasSuggestions: !!executorOutput.suggestions,
      });
    } else if (safeExecutorResult.executorOutput) {
      // 如果没有 parsedResultData，尝试使用 safeExecutorResult.executorOutput
      executorOutput = safeExecutorResult.executorOutput;
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 使用 safeExecutorResult.executorOutput');
    }

    // 🔴🔴🔴 【重构】获取所有前序任务的执行结果，按 order_index 分组
    // 获取所有前序任务（order_index 1 到 current-1）的 result_text，让 LLM 自己判断需要哪些内容
    let currentTaskMcpOutput = '';  // 当前任务的 MCP 执行结果（用于补充信息）
    
    // 🔴🔴🔴 【重构】获取所有前序任务的执行结果，按 order_index 分组
    const priorTaskResults: Array<{
      orderIndex: number;
      taskTitle: string;
      executor: string;
      resultText: string;
    }> = [];
    
    try {
      if (task.orderIndex > 1) {
        // 🔴 先查询所有子任务（只查一次）
        const allSubTasks = await db
          .select()
          .from(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, task.commandResultId))
          .orderBy(agentSubTasks.orderIndex);
        
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 找到子任务总数:', allSubTasks.length);
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 子任务列表:', allSubTasks.map(t => ({
          orderIndex: t.orderIndex,
          title: t.taskTitle,
          hasResultText: !!t.resultText,
          resultTextLength: t.resultText?.length || 0
        })));
        
        // 🔴🔴🔴 【优化】获取前序任务（orderIndex - 1）和当前任务（orderIndex）
        const priorOrderIndex = task.orderIndex - 1;
        const currentOrderIndex = task.orderIndex;
        
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 查询范围: orderIndex IN [' + priorOrderIndex + ', ' + currentOrderIndex + ']');
        
        // 找到前序任务和当前任务
        const priorTask = allSubTasks.find(t => t.orderIndex === priorOrderIndex);
        const currentTask = allSubTasks.find(t => t.orderIndex === currentOrderIndex);
        
        // ========== 1. 获取所有前序任务的执行结果 ==========
        // 🔴🔴🔴 【重构】不再"查找"，而是获取所有前序任务结果，让 LLM 自己判断
        // priorTaskResults 已在 try 块外定义，这里直接填充
        
        for (let idx = 1; idx < task.orderIndex; idx++) {
          const priorTask = allSubTasks.find(t => t.orderIndex === idx);
          if (priorTask) {
            // 🔴 修复：result_text 为空时，从 result_data 中提取纯文本兜底
            let priorResultText = priorTask.resultText || '';
            if (!priorResultText && priorTask.resultData) {
              priorResultText = this.extractResultTextFromResultData(priorTask.resultData, priorTask.fromParentsExecutor);
              if (priorResultText) {
                console.log('[SubtaskEngine] 📋 前序任务 orderIndex=' + idx + ' result_text 为空，从 result_data 提取纯文本兜底，长度:', priorResultText.length);
              }
            }
            priorTaskResults.push({
              orderIndex: priorTask.orderIndex,
              taskTitle: priorTask.taskTitle || '',
              executor: priorTask.fromParentsExecutor || '', // 🔴 修复：schema 字段名是 fromParentsExecutor，不是 executor
              resultText: priorResultText,
            });
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 📋 获取前序任务 orderIndex=' + idx + ' 的结果, 长度:', priorResultText.length);
          }
        }
        
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 📋 共获取 ' + priorTaskResults.length + ' 个前序任务结果');
        
        // ========== 2. 获取 MCP 执行结果（范围：orderIndex - 1 和 orderIndex） ==========
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 查询 MCP 执行结果，范围: orderIndex IN [' + priorOrderIndex + ', ' + currentOrderIndex + ']');
        
        try {
          const mcpRecordsForOutput = await db
            .select()
            .from(agentSubTasksMcpExecutions)
            .where(
              and(
                eq(agentSubTasksMcpExecutions.commandResultId, task.commandResultId),
                inArray(agentSubTasksMcpExecutions.orderIndex, [priorOrderIndex, currentOrderIndex])
              )
            )
            .orderBy(desc(agentSubTasksMcpExecutions.createdAt));
          
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 找到 MCP 执行记录数:', mcpRecordsForOutput.length);
          
          if (mcpRecordsForOutput.length > 0) {
            // 按 orderIndex 分组
            const mcpByOrderIndex: { [key: number]: typeof mcpRecordsForOutput } = {};
            for (const record of mcpRecordsForOutput) {
              const idx = record.orderIndex;
              if (!mcpByOrderIndex[idx]) {
                mcpByOrderIndex[idx] = [];
              }
              mcpByOrderIndex[idx].push(record);
            }
            
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 MCP 记录分组:', Object.keys(mcpByOrderIndex).map(k => `orderIndex=${k}: ${mcpByOrderIndex[parseInt(k)].length}条`));
            
            // 构建输出文本
            const mcpOutputParts: string[] = [];
            
            // 前序任务的 MCP 结果
            if (mcpByOrderIndex[priorOrderIndex] && mcpByOrderIndex[priorOrderIndex].length > 0) {
              const priorMcp = mcpByOrderIndex[priorOrderIndex][0]; // 取最新一条
              if (priorMcp.resultText && priorMcp.resultText.length > 0) {
                mcpOutputParts.push(`【前序任务(orderIndex=${priorOrderIndex}) MCP 执行结果】\n工具: ${priorMcp.toolName}\n动作: ${priorMcp.actionName}\n状态: ${priorMcp.resultStatus}\n结果:\n${priorMcp.resultText}`);
                console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 前序任务 MCP 结果已加入输出');
              }
            }
            
            // 当前任务的 MCP 结果
            if (mcpByOrderIndex[currentOrderIndex] && mcpByOrderIndex[currentOrderIndex].length > 0) {
              const currentMcp = mcpByOrderIndex[currentOrderIndex][0]; // 取最新一条
              if (currentMcp.resultText && currentMcp.resultText.length > 0) {
                mcpOutputParts.push(`【当前任务(orderIndex=${currentOrderIndex}) MCP 执行结果】\n工具: ${currentMcp.toolName}\n动作: ${currentMcp.actionName}\n状态: ${currentMcp.resultStatus}\n结果:\n${currentMcp.resultText}`);
                console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 当前任务 MCP 结果已加入输出');
              }
            }
            
            if (mcpOutputParts.length > 0) {
              currentTaskMcpOutput = mcpOutputParts.join('\n\n');
              console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ MCP 执行结果合并完成, 总长度:', currentTaskMcpOutput.length);
            }
          } else {
            console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  无 MCP 执行结果');
          }
        } catch (mcpError) {
          console.warn('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  获取 MCP 记录失败:', mcpError);
        }
      } else {
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 order_index = 1，无前序任务');
      }
    } catch (error) {
      console.warn('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️  直接获取前序任务 resultText 失败:', {
        message: error instanceof Error ? error.message : String(error)
      });
    }

    // 🔥🔥🔥 两阶段架构：适配任务跨组注入基础文章
    // 如果当前任务是适配组（metadata.phase === 'platform_adaptation'），
    // 需要额外查询基础文章组（sourceCommandResultId）的内容
    try {
      // P2-5 修复：使用精确类型 TwoPhaseTaskMetadata
      const taskMetadata = task.metadata as TwoPhaseTaskMetadata | null;
      const taskPhase = taskMetadata?.phase;

      if (taskPhase === 'platform_adaptation' && taskMetadata?.sourceCommandResultId) {
        const sourceCommandResultId = taskMetadata.sourceCommandResultId;
        console.log('[SubtaskEngine] 🔥 适配任务检测到，开始跨组注入基础文章', {
          sourceCommandResultId,
          adaptationPlatform: taskMetadata.adaptationPlatform,
        });

        // 查询基础文章组的所有已完成任务（必须加 workspaceId 隔离，符合多租户规范）
        const baseArticleTasks = await db
          .select()
          .from(agentSubTasks)
          .where(
            and(
              eq(agentSubTasks.commandResultId, sourceCommandResultId),
              eq(agentSubTasks.status, 'completed'),
              eq(agentSubTasks.workspaceId, task.workspaceId)
            )
          )
          .orderBy(agentSubTasks.orderIndex);

        // 提取基础文章内容：优先找写作 Agent 的 result_text
        let baseArticleContent = '';
        let baseArticleTitle = '';
        for (const baseTask of baseArticleTasks) {
          if (isWritingAgent(baseTask.fromParentsExecutor)) {
            let content = baseTask.resultText || '';
            if (!content && baseTask.resultData) {
              content = this.extractResultTextFromResultData(baseTask.resultData, baseTask.fromParentsExecutor);
            }
            if (content) {
              baseArticleContent = content;
              baseArticleTitle = baseTask.taskTitle || '基础文章';
              console.log('[SubtaskEngine] 🔥 找到基础文章内容，长度:', content.length, {
                baseTaskId: baseTask.id,
                orderIndex: baseTask.orderIndex,
                executor: baseTask.fromParentsExecutor,
              });
              break;
            }
          }
        }

        // 将基础文章作为"特殊前序"（orderIndex=0）注入 priorTaskResults 最前面
        if (baseArticleContent) {
          priorTaskResults.unshift({
            orderIndex: 0, // 特殊序号，表示基础文章
            taskTitle: `[基础文章] ${baseArticleTitle}`,
            executor: 'base_article',
            resultText: baseArticleContent,
          });
          console.log('[SubtaskEngine] 🔥 已将基础文章注入 priorTaskResults（orderIndex=0），长度:', baseArticleContent.length);
        } else {
          console.warn('[SubtaskEngine] 🔥 ⚠️ 适配任务未找到基础文章内容，sourceCommandResultId:', sourceCommandResultId);
        }
      }
    } catch (baseArticleError) {
      console.warn('[SubtaskEngine] 🔥 跨组注入基础文章失败（不影响主流程）:', {
        message: baseArticleError instanceof Error ? baseArticleError.message : String(baseArticleError)
      });
    }

    // 🔴🔴🔴 【重构】使用 priorTaskResults 构建前序信息，每个任务按 order_index 分组
    // 获取所有前序任务的 result_text，让 LLM 自己判断需要哪些内容
    let finalPriorStepOutput = '';
    
    // 1. 构建所有前序任务的执行结果（按 order_index 分组）
    if (priorTaskResults.length > 0) {
      finalPriorStepOutput += '【前序任务执行结果汇总】\n';
      finalPriorStepOutput += '以下为当前任务之前的所有任务执行结果，请根据需要参考：\n\n';
      
      for (const result of priorTaskResults) {
        finalPriorStepOutput += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        finalPriorStepOutput += `【order_index = ${result.orderIndex}】\n`;
        finalPriorStepOutput += `任务标题：${result.taskTitle}\n`;
        finalPriorStepOutput += `执行者：${result.executor}\n`;
        finalPriorStepOutput += `执行结果：\n${result.resultText || '（无结果）'}\n\n`;
      }
      
      console.log('[SubtaskEngine] 📋 已构建 ' + priorTaskResults.length + ' 个前序任务的结果汇总');
    }
    
    // 2. 当前任务的 MCP 执行结果（如有）
    if (currentTaskMcpOutput && currentTaskMcpOutput.length > 0) {
      finalPriorStepOutput += `\n【当前任务 MCP 执行结果】\n${currentTaskMcpOutput}\n`;
    }
    
    console.log('[SubtaskEngine] 🔴🔴🔴 前序信息构建完成:', {
      priorTaskResults_count: priorTaskResults.length,
      finalPriorStepOutput_length: finalPriorStepOutput?.length || 0
    });
    
    // 🔴🔴🔴 新增超详细日志：输出所有与 content 相关的字段
    console.log('[SubtaskEngine] 🔴🔴🔴 ========== buildExecutionContext - content 相关字段详细输出 ==========');
    console.log('[SubtaskEngine] 🔴🔴🔴 order_index =', task.orderIndex);
    console.log('[SubtaskEngine] 🔴🔴🔴 priorTaskResults 数量:', priorTaskResults.length);
    console.log('[SubtaskEngine] 🔴🔴🔴 priorStepOutputText 长度:', priorStepOutputText?.length || 0);
    console.log('[SubtaskEngine] 🔴🔴🔴 priorStepOutputText 前500字符:', JSON.stringify(priorStepOutputText?.substring(0, 500)));
    console.log('[SubtaskEngine] 🔴🔴🔴 finalPriorStepOutput 长度:', finalPriorStepOutput?.length || 0);
    console.log('[SubtaskEngine] 🔴🔴🔴 finalPriorStepOutput 前500字符:', JSON.stringify(finalPriorStepOutput?.substring(0, 500)));
    console.log('[SubtaskEngine] 🔴🔴🔴 parsedResultData:', parsedResultData ? '有数据' : '无数据');
    if (parsedResultData) {
      console.log('[SubtaskEngine] 🔴🔴🔴 parsedResultData 字段:', Object.keys(parsedResultData));
      console.log('[SubtaskEngine] 🔴🔴🔴 parsedResultData.structuredResult:', parsedResultData.structuredResult ? '有数据' : '无数据');
      if (parsedResultData.structuredResult) {
        console.log('[SubtaskEngine] 🔴🔴🔴 parsedResultData.structuredResult 字段:', Object.keys(parsedResultData.structuredResult));
        console.log('[SubtaskEngine] 🔴🔴🔴 parsedResultData.structuredResult.resultContent 长度:', (parsedResultData.structuredResult as any)?.resultContent?.length || 0);
      }
      console.log('[SubtaskEngine] 🔴🔴🔴 safeExecutorResult.resultData 长度:', safeExecutorResult.resultData?.length || 0);
    }
    console.log('[SubtaskEngine] 🔴🔴🔴 safeExecutorResult.resultContent 长度:', (safeExecutorResult as any)?.resultContent?.length || 0);
    console.log('[SubtaskEngine] 🔴🔴🔴 ========== content 相关字段详细输出结束 ==========');
    
    // 🔴 新增：注入 Agent B 的建议（如果有）
    let enhancedProblem = safeExecutorResult.problem || '';
    if (agentBDecision) {
      const agentBSuggestion = `
【Agent B 决策建议】
决策类型：${agentBDecision.type}
决策理由：${agentBDecision.reasoning || '无'}
建议操作：${agentBDecision.context?.suggestedAction || '请根据以上信息重新执行任务'}
`;
      enhancedProblem = enhancedProblem + agentBSuggestion;
      console.log('[SubtaskEngine] 🔴 [REEXECUTE_EXECUTOR] 已注入 Agent B 建议到 problem');
    }

    // 🔴🔴🔴 【新增】构建 BossOrder 注入文本（优先级最高！）
    let bossOrderInstruction = '';
    if (bossOrder) {
      bossOrderInstruction = `
【BOSS 最高优先级指令 - 必须优先执行】
任务标题：${bossOrder.requestContent?.taskTitle || task.taskTitle}
任务描述：${bossOrder.requestContent?.description || ''}
执行状态：${bossOrder.responseStatus || 'pending'}
注意：此指令为 BOSS 最高优先级指令，请优先执行上述任务！
`;
      console.log('[SubtaskEngine] 🔴🔴🔴 BossOrder 指令已注入，优先级最高');
    }

    // 🔥🔥🔥 【新增】获取用户观点和素材（insurance-d 必须遵守）
    const userOpinionAndMaterials: {
      userOpinion?: string; // 核心锚点 + 关键素材（硬约束）
      materials?: Array<{ id: string; title: string; type: string; content: string; sourceDesc?: string }>;
      // 🔥 新增：关联素材补充区内容（软参考，与 keyMaterials 区分处理）
      relatedMaterials?: string;
    } = {};

    // 1. 获取用户观点（核心锚点 + 关键素材）
    if (task.userOpinion) {
      userOpinionAndMaterials.userOpinion = task.userOpinion;
      console.log('[SubtaskEngine] 🔥 发现用户观点:', task.userOpinion?.substring(0, 100) + '...');
    }

    // 🔥 新增：获取关联素材补充区内容（与关键素材区分）
    if (task.relatedMaterials && typeof task.relatedMaterials === 'string' && task.relatedMaterials.trim().length > 0) {
      userOpinionAndMaterials.relatedMaterials = task.relatedMaterials.trim();
      console.log('[SubtaskEngine] 🔥 发现关联素材:', task.relatedMaterials.substring(0, 100) + '...');
    }

    // 2. 获取素材内容
    const materialIds = task.materialIds;
    if (Array.isArray(materialIds) && materialIds.length > 0) {
      console.log('[SubtaskEngine] 🔥 发现用户素材ID:', materialIds);
      try {
        const { db } = await import('@/lib/db');
        const { materialLibrary } = await import('@/lib/db/schema/material-library');
        const { inArray } = await import('drizzle-orm');
        
        // materialIds 是 JSONB 存储的 string[]，需确保为有效UUID数组
        const validMaterialIds = materialIds.filter((id: string) => 
          typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        );
        
        if (validMaterialIds.length > 0) {
          const materials = await db
            .select({
              id: materialLibrary.id,
              title: materialLibrary.title,
              type: materialLibrary.type,
              content: materialLibrary.content,
              sourceDesc: materialLibrary.sourceDesc,
            })
            .from(materialLibrary)
            .where(inArray(materialLibrary.id, validMaterialIds));
        
          userOpinionAndMaterials.materials = materials.map(m => ({
            id: m.id,
            title: m.title,
            type: m.type,
            content: m.content,
            sourceDesc: m.sourceDesc || undefined,
          }));
        
          console.log('[SubtaskEngine] 🔥 获取到素材:', materials.length, '个');
        } else {
          console.warn('[SubtaskEngine] ⚠️ 素材ID列表中无有效UUID，跳过素材查询');
        }
      } catch (error) {
        console.warn('[SubtaskEngine] ⚠️ 获取素材失败:', error);
      }
    }

    // 🔴🔴🔴 【统一提取】从前序任务中提取大纲内容（供全文任务使用）
    // 优先级：用户确认的 > 前序大纲任务的 result_text
    let extractedOutline: string | undefined;
    
    // 1. 先检查用户是否明确确认过大纲
    const taskMetadata = task.metadata as Record<string, any> | null;
    if (taskMetadata?.confirmedOutline) {
      extractedOutline = taskMetadata.confirmedOutline;
      console.log('[SubtaskEngine] 📋 使用用户确认的大纲，长度:', extractedOutline.length);
    } else if (task.userOpinion && task.taskTitle?.includes('根据确认大纲生成全文')) {
      // 2. 检查 userOpinion 是否存储了大纲（user-decision API 可能存入这里）
      extractedOutline = task.userOpinion;
      console.log('[SubtaskEngine] 📋 从 userOpinion 提取大纲，长度:', extractedOutline.length);
    } else if (priorTaskResults.length > 0) {
      // 3. 🔥🔥🔥 【修复】直接从 priorTaskResults 数组按 orderIndex 查找大纲任务
      // 不再从 priorStepOutput 正则解析（脆弱且多余）
      // 大纲任务固定在 orderIndex=2
      const outlineTask = priorTaskResults.find(r => 
        r.orderIndex === 2 && r.resultText && r.resultText.length > 50
      );
      if (outlineTask) {
        let outlineContent = outlineTask.resultText;
        
        // 🔥 处理 JSON 格式的 result_text（历史数据兼容）
        // 旧数据可能存储了 {"outlineText": "..."} 而非纯文本
        if (outlineContent.startsWith('{')) {
          try {
            const parsed = JSON.parse(outlineContent);
            if (typeof parsed.outlineText === 'string') {
              outlineContent = parsed.outlineText;
            } else if (typeof parsed.content === 'string') {
              outlineContent = parsed.content;
            } else if (typeof parsed.outlineText === 'object') {
              outlineContent = JSON.stringify(parsed.outlineText, null, 2);
            }
          } catch {
            // JSON 解析失败，保持原样
          }
        }
        
        if (outlineContent && outlineContent.length > 50) {
          extractedOutline = outlineContent;
          console.log('[SubtaskEngine] 📋 从前序任务 orderIndex=2 直接提取大纲成功，长度:', outlineContent.length);
        }
      }
    }

    return {
      // 🔴🔴🔴 【最高优先级】BossOrder - 用户指令信息
      bossOrder: bossOrder,
      // 🔴🔴🔴 【新增】BossOrder 文本指令（用于直接注入到 prompt 中）
      bossOrderInstruction: bossOrderInstruction,
      // 🔥🔥🔥 【新增】用户观点和素材（insurance-d 必须遵守）
      userOpinionAndMaterials: userOpinionAndMaterials,
      // 🔥🔥🔥 【统一提取】大纲内容（用户确认 或 前序任务自动提取）
      extractedOutline: extractedOutline,
      executorFeedback: {
        // 🔴 新增：执行 Agent 的核心判断字段（最重要！）
        isNeedMcp: safeExecutorResult.isNeedMcp,
        isTaskDown: safeExecutorResult.isTaskDown,
        // 🔴🔴🔴 新增：isNeedSplit 相关字段（自动拆分功能）
        // 这些字段来自 Agent T 的响应（executorResult.isNeedSplit）
        isNeedSplit: (safeExecutorResult as any).isNeedSplit ?? false,
        splitReason: (safeExecutorResult as any).splitReason ?? '',
        suggestedSplitPoints: (safeExecutorResult as any).suggestedSplitPoints ?? [],
        
        originalTask: task.taskTitle + (task.taskDescription ? '\n' + task.taskDescription : ''),
        // 🔴 使用 safeExecutorResult 而不是 executorResult
        problem: enhancedProblem,
        attemptedSolutions: mcpExecutionHistory.map(m => m.decision.reasoning),
        suggestedApproach: safeExecutorResult.capabilityType,
        // 🔴 新增：执行 Agent 的完整输出（包含 BossOrder 指令）
        executorOutput: executorOutput + bossOrderInstruction,
        // 🔴🔴🔴 【新增】失败原因和决策内容（关键字段！）
        failureReason: (safeExecutorResult as any)?.failureReason,
        decisionContent: (safeExecutorResult as any)?.decisionContent,
        // 🔴🔴🔴 【新增】执行结果概述字段
        briefResponse: (safeExecutorResult as any)?.briefResponse,
        selfEvaluation: (safeExecutorResult as any)?.selfEvaluation,
        executionSummary: (safeExecutorResult as any)?.executionSummary,
      },
      mcpExecutionHistory,
      // 🔴🔴🔴 【优化3】优化用户反馈获取，增加 executionSuggestion 字段
      // 获取 order_index = 3 的最新执行建议
      userFeedback: (() => {
        // 🔴 优先获取最新的执行建议（order_index = 3）
        if (userInteractions.length > 0) {
          const latestInteraction = userInteractions[userInteractions.length - 1];
          return {
            feedbackType: 'select',
            userInput: latestInteraction.selectedSolution,
            feedbackTime: latestInteraction.timestamp,
            userId: latestInteraction.userInfo.userId,
            // 🔴 新增：执行建议字段
            executionSuggestion: latestInteraction.selectedSolution || latestInteraction.userInfo.executionSuggestion || undefined
          };
        }
        return undefined;
      })(),
      // 最高决策优先级的用户建议
      latestUserDecision,
      taskMeta: {
        taskId: task.id,
        taskType: (task.metadata as any)?.taskType || 'default',
        priority: 'medium',
        createdAt: task.createdAt || getCurrentBeijingTime(),
        timeoutAt: undefined,
        iterationCount: currentIteration,
        maxIterations: maxIterations,
        taskTitle: task.taskTitle,
      },
      availableCapabilities: capabilities,
      // 🔴 新增：将上一步骤输出包含在上下文中（优先使用前序任务结果）
      priorStepOutput: finalPriorStepOutput,
    };
  }

  /**
   * ========== 公共方法：处理决策类型 ==========
   * 返回是否应该继续循环
   */
  private async handleDecisionType(
    task: typeof agentSubTasks.$inferSelect,
    agentBDecision: AgentBDecision,
    executorResult: ExecutorAgentResult,
    capabilities: any[],
    mcpExecutionHistory: McpAttempt[],
    userInteractions: UserInteraction[],
    currentIteration: number,
    maxIterations: number,
    maxMcpAttempts: number
  ): Promise<boolean> {
    switch (agentBDecision.type) {
      case 'COMPLETE':
        await this.handleCompleteDecision(task, agentBDecision, executorResult, mcpExecutionHistory, userInteractions, currentIteration);
        return false;

      case 'NEED_USER':
        await this.handleNeedUserDecision(task, agentBDecision, executorResult, mcpExecutionHistory, userInteractions, currentIteration);
        return false; // 等待用户反馈后会重新触发

      case 'FAILED':
        await this.handleFailedDecision(task, agentBDecision, executorResult, mcpExecutionHistory, userInteractions, currentIteration);
        return false;

      case 'REEXECUTE_EXECUTOR':
        // 🔴🔴🔴 Agent B 判断需要更换执行者
        console.log('[SubtaskEngine] Agent B 决策 REEXECUTE_EXECUTOR，需要更换执行者');
        
        // 1. 提取新的执行者
        const newExecutor = agentBDecision.context?.suggestedExecutor || agentBDecision.data?.from_parents_executor;
        const oldExecutor = task.fromParentsExecutor;
        
        console.log('[SubtaskEngine] 执行者变更:', {
          from: oldExecutor,
          to: newExecutor,
          reason: agentBDecision.reasoning
        });
        
        // ========== 🔴🔴🔴 【方案2修复】MCP 业务层失败时不再重试，直接转 waiting_user ==========
        // 检查是否存在 MCP 失败记录，且失败原因是业务层问题（如 empty content）
        const mcpFailureRecords = mcpExecutionHistory.filter(
          m => m.result.status === 'failed' && 
               (m.result.error?.type === 'business' || 
                m.result.error?.code === 'BUSINESS_ERROR' ||
                (m.result.error?.message && (
                  m.result.error.message.includes('empty content') ||
                  m.result.error.message.includes('empty') ||
                  m.result.error.message.includes('BUSINESS_ERROR')
                )))
        );
        
        // 如果存在业务层失败的 MCP 记录，不再重试，直接转 waiting_user
        if (mcpFailureRecords.length > 0) {
          console.log('[SubtaskEngine] 🔴🔴🔴 检测到 MCP 业务层失败，不再重试，直接转 waiting_user');
          console.log('[SubtaskEngine] MCP 失败记录:', mcpFailureRecords.map(m => ({
            error: m.result.error?.message,
            type: m.result.error?.type,
            code: m.result.error?.code
          })));
          
          // 记录 Agent B 的交互
          await this.recordAgentInteraction(
            task.commandResultId,
            task.orderIndex,
            'agent B',
            executorResult,
            'REEXECUTE_EXECUTOR',
            {
              ...agentBDecision,
              mcpFailureDetected: true,
              mcpFailureRecords: mcpFailureRecords.map(m => ({
                error: m.result.error?.message,
                action: '直接转 waiting_user（不再重试）'
              }))
            },
            task.id,
            currentIteration
          );
          
          // 🔴 直接转为 waiting_user，不再切换执行者重试
          const userMessage = 'MCP 业务层执行失败：' + (mcpFailureRecords[0]?.result.error?.message || 'empty content') + '。已尝试多次仍失败，需要您介入处理。';
          await this.markTaskWaitingUser(task, userMessage);
          console.log('[SubtaskEngine] ✅ MCP 业务层失败，已转为 waiting_user，等待用户介入');
          return false;
        }
        // ========== 🔴🔴🔴 修复结束 ==========
        
        // 2. 记录 Agent B 的交互
        await this.recordAgentInteraction(
          task.commandResultId,
          task.orderIndex,
          'agent B',
          executorResult,
          'REEXECUTE_EXECUTOR',
          {
            ...agentBDecision,
            executorChange: { from: oldExecutor, to: newExecutor, reason: agentBDecision.reasoning }
          },
          task.id,
          currentIteration
        );
        
        // ========== 构建重执行历史记录 ==========
        // 【P1修复】深拷贝避免副作用，防止修改原始 metadata
        const currentMetadata = ((task.metadata as Record<string, unknown>) || {}) as TaskMetadata;
        const existingHistory: ReexecuteHistoryItem[] = JSON.parse(
          JSON.stringify(currentMetadata.reexecuteHistory || [])
        );
        
        // 【P1修复】深拷贝后安全修改，不影响原始数据
        const lastExecutor = currentMetadata.lastExecutedExecutor || oldExecutor;
        
        // 如果已有 pending 记录，更新为 completed
        const pendingIndex = existingHistory.findIndex(h => h.status === 'pending');
        if (pendingIndex >= 0) {
          existingHistory[pendingIndex] = {
            ...existingHistory[pendingIndex],
            executionResult: {
              success: executorResult?.executorResult?.isTaskDown === true || executorResult?.mcpSuccess === true,
              mcpSuccess: executorResult?.mcpSuccess === true,
              isTaskDown: executorResult?.executorResult?.isTaskDown === true,
              executorResult: executorResult?.executorResult
            },
            status: 'completed'
          };
        }
        
        // 添加新的 pending 记录
        existingHistory.push({
          executor: newExecutor || oldExecutor,
          previousExecutor: lastExecutor,
          reason: agentBDecision.reasoning || 'agent_b_reexecute',
          decisionType: 'REEXECUTE_EXECUTOR',
          timestamp: getCurrentBeijingTime().toISOString(),
          status: 'pending'
        });
        
        // 【P3修复】提取公共 metadata，避免重复
        const baseMetadata: TaskMetadata = {
          ...currentMetadata,
          lastExecutionType: 'reexecute_executor',
          lastAgentBDecision: agentBDecision,
          lastReexecuteTimestamp: getCurrentBeijingTime().toISOString(),
          reexecuteHistory: existingHistory
        };

        // 3. 更新执行者和状态
        if (newExecutor && newExecutor !== oldExecutor) {
          console.log('[SubtaskEngine] REEXECUTE_EXECUTOR - 执行者切换:', {
            taskId: task.id,
            orderIndex: task.orderIndex,
            oldExecutor,
            newExecutor,
            reasoning: agentBDecision.reasoning
          });
          
          await db
            .update(agentSubTasks)
            .set({
              fromParentsExecutor: newExecutor,
              status: 'pending',
              metadata: {
                ...baseMetadata,
                executorChange: {
                  from: oldExecutor,
                  to: newExecutor,
                  reason: agentBDecision.reasoning,
                  changedAt: getCurrentBeijingTime().toISOString(),
                  changedBy: 'agent B'
                }
              } as Record<string, unknown>,
              updatedAt: getCurrentBeijingTime(),
            })
            .where(eq(agentSubTasks.id, task.id));
          
          console.log('[SubtaskEngine] 执行者已更新，任务设为 pending');
        } else {
          // 执行者不变，但状态需重置为 pending（上次执行失败需要重试）
          console.log('[SubtaskEngine] REEXECUTE_EXECUTOR - 执行者相同，状态重置:', {
            taskId: task.id,
            currentStatus: task.status,
            executor: newExecutor
          });
          
          await db
            .update(agentSubTasks)
            .set({
              status: 'pending',
              metadata: baseMetadata as Record<string, unknown>,
              updatedAt: getCurrentBeijingTime(),
            })
            .where(eq(agentSubTasks.id, task.id));
          
          console.log('[SubtaskEngine] 状态已重置为 pending');
        }
        
        return false;

      case 'EXECUTE_MCP': {
        // ==============================================================
        // EXECUTE_MCP: 根据 suggestedExecutor 重分配执行者
        // ==============================================================
        console.log('[AgentB决策] EXECUTE_MCP | taskId:', task.id, '| from:', task.fromParentsExecutor);

        const currentExecutor = task.fromParentsExecutor;
        const suggestedExecutor = agentBDecision.context?.suggestedExecutor;
        const mcpParams = agentBDecision.data?.mcpParams;

        // ========== 🔴🔴🔴 【新增】检查 MCP 参数完整性 ==========
        // 如果 mcpParams 存在但不完整（缺少 toolName 或 actionName），直接转为 waiting_user
        // 这样可以避免 Agent T 收到不完整的参数导致执行失败
        if (mcpParams && (!mcpParams.toolName || !mcpParams.actionName)) {
          console.log('[AgentB决策] 🔴🔴🔴 MCP 参数不完整（toolName 或 actionName 为空），直接转为 waiting_user');
          console.log('[AgentB决策] MCP 参数详情:', mcpParams);

          // 记录评审结果
          await this.recordAgentInteraction(
            task.commandResultId, task.orderIndex, 'agent B',
            { executorResult: { isNeedMcp: true, isTaskDown: false }, reasoning: 'MCP 参数不完整' },
            'EXECUTE_MCP', {
              ...agentBDecision,
              mcpParamsIncomplete: true,
              incompleteReason: 'toolName 或 actionName 为空'
            }, task.id, currentIteration
          );

          // 直接转为 waiting_user
          const userMessage = 'MCP 执行参数不完整（缺少 toolName 或 actionName），无法继续执行，需要您介入处理。';
          await this.markTaskWaitingUser(task, userMessage);
          console.log('[AgentB决策] ✅ 已转为 waiting_user（MCP 参数不完整）');
          return false;
        }
        // ========== 🔴🔴🔴 检查结束 ==========

        // Step 1: 记录评审结果
        await this.recordAgentInteraction(
          task.commandResultId, task.orderIndex, 'agent B',
          {
            executorResult: {
              isNeedMcp: executorResult.isNeedMcp,
              isTaskDown: executorResult.isTaskDown
            },
            reasoning: agentBDecision.reasoning,
            suggestedExecutor: suggestedExecutor
          },
          'EXECUTE_MCP', agentBDecision, task.id, currentIteration
        );

        // Step 2: 分支处理
        if (suggestedExecutor) {
          // 2a: 有明确的执行者建议 -> 重分配 + pending
          console.log('[AgentB决策] 🔴🔴🔴 EXECUTE_MCP - 执行者切换:', {
            taskId: task.id,
            orderIndex: task.orderIndex,
            commandResultId: task.commandResultId,
            currentExecutor,
            targetExecutor: suggestedExecutor,
            currentStatus: task.status,
            decisionType: 'EXECUTE_MCP',
            reasoning: agentBDecision.reasoning
          });

          // 标准化执行者名称
          let targetExecutor = suggestedExecutor;
          if (suggestedExecutor.toLowerCase() === 't') {
            targetExecutor = 'agent T';
          } else if (suggestedExecutor.toLowerCase() === 'insurance-d') {
            targetExecutor = 'insurance-d';
          } else if (suggestedExecutor.toLowerCase() === 'insurance-xiaohongshu') {
            targetExecutor = 'insurance-xiaohongshu';
          } else if (suggestedExecutor.toLowerCase() === 'insurance-zhihu') {
            targetExecutor = 'insurance-zhihu';
          } else if (suggestedExecutor.toLowerCase() === 'insurance-toutiao') {
            targetExecutor = 'insurance-toutiao';
          }

          // 🔴 构建 reexecute_history
          // 🔴🔴🔴 【修复】只在执行者实际执行后才记录 reexecuteHistory
          const currentMetadata2 = (task.metadata as any) || {};
          const existingHistory2 = currentMetadata2.reexecuteHistory || [];
          
          // 🔴 如果已经有 pending 记录，更新它
          const pendingIndex2 = existingHistory2.findIndex(h => h.status === 'pending');
          if (pendingIndex2 >= 0) {
            // 更新 pending 记录的执行结果
            existingHistory2[pendingIndex2].executionResult = {
              success: executorResult?.executorResult?.isTaskDown === true || executorResult?.mcpSuccess === true,
              mcpSuccess: executorResult?.mcpSuccess === true,
              isTaskDown: executorResult?.executorResult?.isTaskDown === true,
              executorResult: executorResult?.executorResult
            };
            existingHistory2[pendingIndex2].status = 'completed';
          }
          
          // 🔴 添加新的 pending 记录
          existingHistory2.push({
            executor: targetExecutor,
            previousExecutor: currentExecutor,
            reason: agentBDecision.reasoning || 'agent_b_execute_mcp',
            decisionType: 'EXECUTE_MCP',
            timestamp: getCurrentBeijingTime().toISOString(),
            status: 'pending',  // 🔴 新增：标记为待执行状态
          });
          
          const newHistory2 = existingHistory2;

          await db.update(agentSubTasks).set({
            fromParentsExecutor: targetExecutor,
            status: 'pending',
            metadata: {
              ...currentMetadata2,
              lastExecutionType: 'reexecute_executor',
              lastAgentBDecision: agentBDecision,
              lastReexecuteTimestamp: getCurrentBeijingTime().toISOString(),
              executorChange: {
                from: currentExecutor,
                to: targetExecutor,
                reason: agentBDecision.reasoning,
                changedAt: getCurrentBeijingTime().toISOString(),
                changedBy: 'agent B'
              },
              // 🔴 记录 reexecute_history
              reexecuteHistory: newHistory2,
            } as any,
            updatedAt: getCurrentBeijingTime(),
          }).where(eq(agentSubTasks.id, task.id));
          
          console.log('[AgentB决策] 🔴 reexecute_history:', newHistory2);

        } else {
          // 2b: 没有明确的执行者建议 -> waiting_user
          console.log('[AgentB决策] 无建议执行者 -> waiting_user');

          await db.update(agentSubTasks).set({
            status: 'waiting_user',
            metadata: {
              ...((task.metadata as any) || {}),
              lastAgentBDecision: agentBDecision,
              agentBReviewNote: '需要更换执行者但未明确指定目标'
            } as any,
            updatedAt: getCurrentBeijingTime(),
          }).where(eq(agentSubTasks.id, task.id));
        }

        return false;
      }

      // 🔴🔴🔴 【优化】AUTO_SPLIT: 自动拆分指令（复用独立方法）
      case 'AUTO_SPLIT': {
        console.log('[SubtaskEngine] 🔴🔴🔴 检测到 AUTO_SPLIT 决策，准备自动拆分...', {
          command_result_id: task.commandResultId,
          task_id: task.id,
          order_index: task.orderIndex,
          decision: agentBDecision
        });

        // 调用独立的 handleAutoSplitDecision 方法
        const splitResult = await this.handleAutoSplitDecision(task, agentBDecision);
        
        if (splitResult) {
          console.log('[SubtaskEngine] 🔴🔴🔴 AUTO_SPLIT 执行成功，返回 true');
          return true;
        } else {
          console.log('[SubtaskEngine] 🔴🔴🔴 AUTO_SPLIT 执行失败，返回 false');
          return false;
        }
      }

      default: {
        console.warn('[SubtaskEngine] 未知的决策类型，视为NEED_USER:', {
          command_result_id: task.commandResultId,
          task_id: task.id,
          decision_type: agentBDecision.type
        });
        // 未知决策类型时，转为NEED_USER让用户决定
        const fallbackDecision: AgentBDecision = {
          type: 'NEED_USER',
          reasonCode: 'USER_CONFIRM',
          reasoning: `Agent B返回了未知的决策类型(${agentBDecision.type})，需要您确认下一步操作。`,
          context: {
            executionSummary: 'Agent B返回了未知的决策类型，需要用户确认下一步操作。',
            riskLevel: 'medium',
            suggestedAction: '请确认下一步操作'
          },
          data: {
            promptMessage: {
              title: '需要您的确认',
              description: `Agent B返回了未知的决策类型，需要您确认下一步操作。原始决策信息：${JSON.stringify(agentBDecision)}`
            }
          }
        };
        await this.handleNeedUserDecision(task, fallbackDecision, executorResult, mcpExecutionHistory, userInteractions, currentIteration);
        return false;
      }
    }
  }

  /**
   * MCP 幂等执行检查（从数据库查询最近执行记录）
   * @returns 返回 { shouldSkip: true, result } 如果应该跳过；返回 { shouldSkip: false } 如果需要继续执行
   */
  private async checkMcpIdempotency(
    task: typeof agentSubTasks.$inferSelect,
    mcpParams: { toolName: string; actionName: string; params: any; solutionNum: number; }
  ): Promise<{ shouldSkip: boolean; result?: { success: boolean; data?: any; reason: string } }> {
    const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;  // 5分钟幂等窗口
    const STALE_EXECUTION_MS = 2 * 60 * 1000;     // 2分钟认为执行卡住
    
    try {
      // 查询该任务最近的 MCP 执行记录
      const recentExecutions = await db
        .select()
        .from(agentSubTasksMcpExecutions)
        .where(
          and(
            eq(agentSubTasksMcpExecutions.commandResultId, task.commandResultId as any),
            eq(agentSubTasksMcpExecutions.orderIndex, task.orderIndex)
          )
        )
        .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp))
        .limit(5);  // 最多查5条，取最近的几条

      if (recentExecutions.length === 0) {
        console.log('[SubtaskEngine] 🔴 [幂等检查] 未找到历史执行记录，需要执行 MCP');
        return { shouldSkip: false };
      }

      const latestExecution = recentExecutions[0];
      const executionTime = new Date(latestExecution.attemptTimestamp).getTime();
      const timeDiff = Date.now() - executionTime;

      console.log('[SubtaskEngine] 🔴 [幂等检查] 最近的执行记录:', {
        attemptId: latestExecution.attemptId,
        toolName: latestExecution.toolName,
        actionName: latestExecution.actionName,
        resultStatus: latestExecution.resultStatus,
        attemptTimestamp: latestExecution.attemptTimestamp,
        timeDiffMs: timeDiff,
        timeDiffMinutes: (timeDiff / 1000 / 60).toFixed(2)
      });

      // 情况1：最近一次执行成功，且在幂等窗口内
      if (latestExecution.resultStatus === 'success') {
        if (timeDiff < IDEMPOTENCY_WINDOW_MS) {
          console.log('[SubtaskEngine] 🔴 [幂等检查] ✅ 检测到5分钟内有成功执行，幂等跳过', {
            resultData: latestExecution.resultData,
            timeDiffMinutes: (timeDiff / 1000 / 60).toFixed(2)
          });
          return {
            shouldSkip: true,
            result: {
              success: true,
              data: latestExecution.resultData,
              reason: `幂等跳过：5分钟内已有成功执行记录 (${(timeDiff / 1000 / 60).toFixed(1)}分钟前)`
            }
          };
        } else {
          console.log('[SubtaskEngine] 🔴 [幂等检查] ⏰ 最近成功执行已超过5分钟，需要重新执行', {
            timeDiffMinutes: (timeDiff / 1000 / 60).toFixed(2)
          });
          return { shouldSkip: false };
        }
      }

      // 情况2：最近一次执行是失败
      if (latestExecution.resultStatus === 'failed') {
        // 如果失败但超过2分钟，认为可以重试
        if (timeDiff > STALE_EXECUTION_MS) {
          console.log('[SubtaskEngine] 🔴 [幂等检查] ⚠️ 上次执行失败但已超过2分钟，允许重试');
          return { shouldSkip: false };
        } else {
          console.log('[SubtaskEngine] 🔴 [幂等检查] ⚠️ 上次执行失败且在2分钟内，暂不重试');
          return {
            shouldSkip: true,
            result: {
              success: false,
              reason: `跳过：上次执行失败且在2分钟内 (${(timeDiff / 1000 / 60).toFixed(1)}分钟前)`
            }
          };
        }
      }

      // 情况3：最近一次执行是 pending（正在执行中）
      if (latestExecution.resultStatus === 'pending') {
        console.log('[SubtaskEngine] 🔴 [幂等检查] ⚠️ 上次执行正在进行中 (pending)，幂等跳过');
        return {
          shouldSkip: true,
          result: {
            success: false,
            reason: `跳过：上次执行正在进行中 (${(timeDiff / 1000 / 60).toFixed(1)}分钟前)`
          }
        };
      }

      // 情况4：最近一次执行状态未知
      console.log('[SubtaskEngine] 🔴 [幂等检查] ⚠️ 上次执行状态异常:', latestExecution.resultStatus);
      return { shouldSkip: false };

    } catch (error) {
      console.error('[SubtaskEngine] 🔴 [幂等检查] ❌ 查询历史执行记录失败:', error);
      // 查询失败时不阻止执行
      return { shouldSkip: false };
    }
  }

  /**
   * 🔴🔴🔴 补充文章内容参数
   * @description 在执行 MCP 前检查是否缺少文章内容参数，如果缺少则从 priorStepOutput 或历史记录中补充
   * @param task 任务对象
   * @param mcpParams MCP 参数
   * @param priorStepOutput 可选的前序任务输出（包含完整文章内容）
   * @returns 补充后的 MCP 参数
   */
  private async supplementArticleContentParams(
    task: typeof agentSubTasks.$inferSelect,
    mcpParams: { toolName: string; actionName: string; params: any; solutionNum: number; },
    priorStepOutput?: string
  ): Promise<{ toolName: string; actionName: string; params: any; solutionNum: number; }> {
    try {
      console.log('[SubtaskEngine] 🔴🔴🔴 ========== supplementArticleContentParams 开始 ==========');
      console.log('[SubtaskEngine] 🔴🔴🔴 order_index =', task.orderIndex);
      console.log('[SubtaskEngine] 🔴🔴🔴 task.commandResultId =', task.commandResultId);
      console.log('[SubtaskEngine] 🔴🔴🔴 mcpParams =', {
        toolName: mcpParams.toolName,
        actionName: mcpParams.actionName,
        hasParams: !!mcpParams.params,
        paramsKeys: mcpParams.params ? Object.keys(mcpParams.params) : []
      });
      console.log('[SubtaskEngine] 🔴🔴🔴 priorStepOutput 参数有值吗?', !!priorStepOutput);
      console.log('[SubtaskEngine] 🔴🔴🔴 priorStepOutput 长度:', priorStepOutput?.length || 0);
      console.log('[SubtaskEngine] 🔴🔴🔴 priorStepOutput 前1000字符:', JSON.stringify(priorStepOutput?.substring(0, 1000)));
      
      // 1. 检查是否是需要文章内容的 MCP
      const isWechatFormatTask = 
        mcpParams.toolName?.toLowerCase().includes('wechat') ||
        mcpParams.actionName?.toLowerCase().includes('format') ||
        mcpParams.toolName?.toLowerCase().includes('compliance') ||
        mcpParams.actionName?.toLowerCase().includes('compliance') ||
        mcpParams.actionName?.toLowerCase().includes('audit');

      if (!isWechatFormatTask) {
        console.log('[SubtaskEngine] 🔴 [补充文章内容] 不是需要文章内容的任务，跳过');
        console.log('[SubtaskEngine] 🔴🔴🔴 ========== supplementArticleContentParams 结束（不是目标任务）==========');
        return mcpParams;
      }

      console.log('[SubtaskEngine] 🔴 [补充文章内容] 检测到需要文章内容的任务，开始检查参数...');
      console.log('[SubtaskEngine] 🔴 [补充文章内容] 原始 MCP 参数:', {
        toolName: mcpParams.toolName,
        actionName: mcpParams.actionName,
        hasParams: !!mcpParams.params,
        paramsKeys: mcpParams.params ? Object.keys(mcpParams.params) : [],
        hasPriorStepOutput: !!priorStepOutput,
        priorStepOutputLength: priorStepOutput?.length || 0
      });

      // 2. 检查参数中是否已经有文章内容
      const params = mcpParams.params || {};
      const hasArticleContent = 
        params.articleContent || 
        params.content ||
        params.title ||
        (params.articles && params.articles.length > 0 && params.articles[0].content);

      if (hasArticleContent) {
        console.log('[SubtaskEngine] 🔴 [补充文章内容] 参数中已有文章内容，跳过');
        return mcpParams;
      }

      // 3. 🔴 如果传入了 priorStepOutput，直接使用它（最可靠的方式）
      let articleContentData: { title: string; content: string } | null = null;
      
      console.log('[SubtaskEngine] 🔴🔴🔴 开始尝试获取文章内容...');
      
      if (priorStepOutput && priorStepOutput.length > 100) {
        console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 从 priorStepOutput 获取文章内容，长度:', priorStepOutput.length);
        
        // 提取标题
        let title = '未命名文章';
        const titleMatch = priorStepOutput.match(/^#{1,3}\s*([^\n]+)/);
        if (titleMatch) {
          title = titleMatch[1].trim();
        }
        
        articleContentData = {
          title: title,
          content: priorStepOutput
        };
        
        console.log('[SubtaskEngine] 🔴🔴🔴 ✅ 从 priorStepOutput 提取到文章内容:');
        console.log('[SubtaskEngine] 🔴🔴🔴    - 标题:', title);
        console.log('[SubtaskEngine] 🔴🔴🔴    - 内容长度:', priorStepOutput.length);
        console.log('[SubtaskEngine] 🔴🔴🔴    - 内容前500字符:', JSON.stringify(priorStepOutput.substring(0, 500)));
      } else {
        console.log('[SubtaskEngine] 🔴🔴🔴 ❌ priorStepOutput 不可用或太短:', {
          hasPriorStepOutput: !!priorStepOutput,
          length: priorStepOutput?.length || 0
        });
        // 4. 如果没有 priorStepOutput，尝试从 article_content 表查询
        console.log('[SubtaskEngine] 🔴 [补充文章内容] 没有 priorStepOutput，尝试从 article_content 表中查询...');
        const articleContentService = ArticleContentService.getInstance();
        articleContentData = await articleContentService.getArticleContent(task.commandResultId);
        
        // 4.1 如果 article_content 表没有数据，尝试从历史记录中直接提取
        if (!articleContentData) {
          console.log('[SubtaskEngine] 🔴 [补充文章内容] article_content 表没有数据，尝试从 agentSubTasksStepHistory 中提取...');
          
          // 直接从数据库查询前序任务的交互记录
          const historyRecords = await db
            .select()
            .from(agentSubTasksStepHistory)
            .where(eq(agentSubTasksStepHistory.commandResultId, task.commandResultId))
            .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

          console.log('[SubtaskEngine] 🔴 [补充文章内容] 查询到历史记录数量:', historyRecords.length);

          // 遍历历史记录，查找前序任务（order_index 更小的任务）的文章内容
          for (const record of historyRecords) {
            // 只检查前序任务（order_index 更小的任务）
            if (record.stepNo >= task.orderIndex) continue;
            
            const content = record.interactContent as any;
            
            // 尝试从各个字段提取文章内容
            let extractedContent: string | undefined;
            let extractedTitle = '未命名文章';
            
            // 1. structuredResult.executionSummary.resultContent
            const resultContent1 = content?.responseContent?.structuredResult?.executionSummary?.resultContent;
            if (resultContent1 && typeof resultContent1 === 'string' && resultContent1.length > 100) {
              extractedContent = resultContent1;
            }
            // 2. structuredResult.resultContent
            else if (content?.responseContent?.structuredResult?.resultContent) {
              extractedContent = content.responseContent.structuredResult.resultContent;
            }
            // 3. executorOutput.output
            else if (content?.responseContent?.executorOutput?.output) {
              extractedContent = content.responseContent.executorOutput.output;
            }
            // 4. executorOutput.result
            else if (content?.responseContent?.executorOutput?.result) {
              extractedContent = content.responseContent.executorOutput.result;
            }
            // 5. responseContent.result
            else if (content?.responseContent?.result && typeof content.responseContent.result === 'string' && content.responseContent.result.length > 100) {
              extractedContent = content.responseContent.result;
            }
            // 6. 直接从 responseContent 任意字段提取
            else {
              const keys = Object.keys(content?.responseContent || {});
              for (const key of keys) {
                const value = content.responseContent[key];
                if (typeof value === 'string' && value.length > 100 && (value.includes('#') || value.includes('\n'))) {
                  extractedContent = value;
                  break;
                }
              }
            }

            if (extractedContent && extractedContent.length > 100) {
              // 提取标题
              const titleMatch = extractedContent.match(/^#{1,3}\s*([^\n]+)/);
              if (titleMatch) {
                extractedTitle = titleMatch[1].trim();
              }
              
              console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 从前序任务历史记录中找到文章内容:', {
                title: extractedTitle,
                contentLength: extractedContent.length,
                agentId: record.interactAgent,
                stepNo: record.stepNo
              });
              
              articleContentData = {
                title: extractedTitle,
                content: extractedContent
              };
              break;
            }
          }
        }
      }

      if (!articleContentData) {
        console.log('[SubtaskEngine] 🔴 [补充文章内容] ❌ 未找到文章内容，无法补充');
        console.log('[SubtaskEngine] 🔴🔴🔴 ========== supplementArticleContentParams 结束（无文章内容）==========');
        return mcpParams;
      }

      console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 找到文章内容:', {
        title: articleContentData.title,
        contentLength: articleContentData.content.length
      });
      console.log('[SubtaskEngine] 🔴🔴🔴 文章内容前500字符:', JSON.stringify(articleContentData.content.substring(0, 500)));

      // 4. 根据不同的 MCP 类型补充参数
      const supplementedParams = { ...params };

      // 公众号格式化任务：补充 accountId, title, content 参数
      if (mcpParams.toolName?.toLowerCase().includes('wechat') || 
          mcpParams.actionName?.toLowerCase().includes('format')) {
        // 补充 accountId（如果没有）
        if (!supplementedParams.accountId) {
          supplementedParams.accountId = 'insurance-account'; // 默认账户ID
          console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 已补充 accountId 参数');
        }
        // 补充 title（如果没有）
        if (!supplementedParams.title && articleContentData.title) {
          supplementedParams.title = articleContentData.title;
          console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 已补充 title 参数');
        }
        // 补充 content（如果没有）
        if (!supplementedParams.content) {
          supplementedParams.content = articleContentData.content;
          console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 已补充 content 参数');
        }
        console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 已补充公众号格式化参数（accountId, title, content）');
      }

      // 合规审核任务：补充 articleTitle + articleContent + workspaceId 参数
      if (mcpParams.toolName?.toLowerCase().includes('compliance') || 
          mcpParams.actionName?.toLowerCase().includes('compliance') ||
          mcpParams.actionName?.toLowerCase().includes('audit')) {
        if (!supplementedParams.articleTitle && articleContentData.title) {
          supplementedParams.articleTitle = articleContentData.title;
          console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 已补充 articleTitle 参数（合规审核）');
        }
        if (!supplementedParams.articleContent) {
          supplementedParams.articleContent = articleContentData.content;
          console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 已补充 articleContent 参数（合规审核）');
        }
        // 补充 workspaceId 供 LLM 合规判定使用（BYOK 支持）
        if (!supplementedParams.workspaceId && task.workspaceId) {
          supplementedParams.workspaceId = task.workspaceId;
          console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 已补充 workspaceId 参数（合规审核 LLM BYOK）');
        }
      }

      // 5. 返回补充后的参数
      const result = {
        ...mcpParams,
        params: supplementedParams
      };

      console.log('[SubtaskEngine] 🔴🔴🔴 ========== supplementArticleContentParams - 最终结果 ==========');
      console.log('[SubtaskEngine] 🔴 [补充文章内容] ✅ 补充完成，最终参数:', {
        toolName: result.toolName,
        actionName: result.actionName,
        paramsKeys: Object.keys(result.params)
      });
      console.log('[SubtaskEngine] 🔴🔴🔴 最终 params 详情:', JSON.stringify(result.params, null, 2));
      console.log('[SubtaskEngine] 🔴🔴🔴 ========== supplementArticleContentParams 结束 ==========');

      return result;

    } catch (error) {
      console.error('[SubtaskEngine] 🔴 [补充文章内容] ❌ 补充失败:', error);
      console.log('[SubtaskEngine] 🔴🔴🔴 ========== supplementArticleContentParams 结束（异常）==========');
      // 补充失败时返回原始参数
      return mcpParams;
    }
  }

  /**
   * 🔴 创建 MCP 执行锁（pending 状态记录）
   * @description 在执行 MCP 前创建一条 pending 状态的记录，作为并发控制的锁
   * @returns 返回创建的 attemptId，如果创建失败返回 null
   */
  private async createMcpExecutionLock(
    task: typeof agentSubTasks.$inferSelect,
    mcpParams: { toolName: string; actionName: string; params: any; solutionNum: number; },
    attemptNumber: number
  ): Promise<string | null> {
    const attemptId = 'mcp-' + Date.now() + '-' + attemptNumber;
    
    try {
      // 🔴🔴🔴 【关键修复】使用事务 + 唯一约束实现原子性检查-插入
      // 方案：尝试插入，如果因唯一约束冲突失败，说明已有锁
      // 
      // 注意：由于 Drizzle ORM 不直接支持 ON CONFLICT，我们需要用两种方式结合：
      // 1. 先用 SELECT ... FOR UPDATE 查询（行锁）
      // 2. 再插入
      
      // 为了简化并确保原子性，我们改用另一种方案：
      // 直接尝试更新已有的 pending 记录，如果没有则插入
      // 这样可以利用数据库的行锁来防止竞态条件
      
      const now = getCurrentBeijingTime();
      
      // 1. 尝试 UPDATE 已有的 pending 记录（使用行锁）
      const updateResult = await db
        .update(agentSubTasksMcpExecutions)
        .set({
          attemptId: attemptId, // 更新为新的 attemptId
          attemptNumber: attemptNumber,
          attemptTimestamp: now,
          resultStatus: 'pending',
          resultData: null,
          resultText: null,
          errorCode: null,
          errorMessage: null,
          errorType: null,
          executionTimeMs: 0,
        })
        .where(
          and(
            eq(agentSubTasksMcpExecutions.commandResultId, task.commandResultId as any),
            eq(agentSubTasksMcpExecutions.orderIndex, task.orderIndex),
            eq(agentSubTasksMcpExecutions.resultStatus, 'pending')
          )
        );
      
      // 检查是否更新成功（更新行数 > 0 表示找到了 pending 记录）
      // 注意：Drizzle ORM 的 update 不返回 affected rows，我们需要用另一种方式
      
      // 改用查询-插入模式，确保原子性
      // 先查询是否有 pending 记录（带 FOR UPDATE 锁）
      const existingPending = await db
        .select({ 
          id: agentSubTasksMcpExecutions.id, 
          attemptId: agentSubTasksMcpExecutions.attemptId 
        })
        .from(agentSubTasksMcpExecutions)
        .where(
          and(
            eq(agentSubTasksMcpExecutions.commandResultId, task.commandResultId as any),
            eq(agentSubTasksMcpExecutions.orderIndex, task.orderIndex),
            eq(agentSubTasksMcpExecutions.resultStatus, 'pending')
          )
        )
        .limit(1)
        .for('update'); // PostgreSQL 行锁

      if (existingPending.length > 0) {
        console.log('[SubtaskEngine] 🔴 [创建锁] ⚠️ 已有 pending 记录，跳过创建:', existingPending[0].attemptId);
        return null; // 返回 null 表示有其他执行正在进行
      }

      // 2. 没有 pending 记录，创建新的（使用 UPSERT 避免唯一索引冲突）
      await db.insert(agentSubTasksMcpExecutions)
        .values({
          commandResultId: task.commandResultId as any,
          orderIndex: task.orderIndex,
          attemptId: attemptId,
          attemptNumber: attemptNumber,
          attemptTimestamp: now,
          solutionNum: mcpParams.solutionNum,
          toolName: mcpParams.toolName,
          actionName: mcpParams.actionName,
          params: mcpParams.params,
          resultStatus: 'pending', // 🔴 关键：设置为 pending 状态
          resultData: null,
          resultText: null,
          errorCode: null,
          errorMessage: null,
          errorType: null,
          executionTimeMs: 0,
        })
        .onConflictDoNothing({
          target: [agentSubTasksMcpExecutions.commandResultId, agentSubTasksMcpExecutions.orderIndex]
        });

      console.log('[SubtaskEngine] 🔴 [创建锁] ✅ 成功创建 pending 锁:', attemptId);
      return attemptId;

    } catch (error) {
      // 如果创建失败，可能是并发冲突或其他错误，返回 null
      console.warn('[SubtaskEngine] 🔴 [创建锁] ⚠️ 创建 pending 记录失败:', error);
      // 如果创建失败，可能是并发冲突，返回 null 让调用方决定如何处理
      return null;
    }
  }

  /**
   * 🔴 更新 MCP 执行记录状态
   * @description 将 pending 状态的记录更新为 success 或 failed
   */
  private async updateMcpExecutionStatus(
    task: typeof agentSubTasks.$inferSelect,
    attemptId: string,
    resultStatus: 'success' | 'failed',
    resultData?: any,
    errorCode?: string,
    errorMessage?: string,
    errorType?: string,
    executionTimeMs?: number
  ): Promise<void> {
    try {
      await db
        .update(agentSubTasksMcpExecutions)
        .set({
          resultStatus,
          resultData,
          resultText: resultData ? JSON.stringify(resultData, null, 2) : null,
          errorCode: errorCode as any,
          errorMessage: errorMessage as any,
          errorType: errorType as any,
          executionTimeMs: executionTimeMs || 0,
        })
        .where(
          and(
            eq(agentSubTasksMcpExecutions.commandResultId, task.commandResultId as any),
            eq(agentSubTasksMcpExecutions.attemptId, attemptId)
          )
        );

      console.log('[SubtaskEngine] 🔴 [更新状态] ✅ 成功更新 MCP 执行记录:', {
        attemptId,
        resultStatus,
        executionTimeMs
      });

    } catch (error) {
      console.error('[SubtaskEngine] 🔴 [更新状态] ❌ 更新 MCP 执行记录失败:', error);
    }
  }

  /**
   * 🔴🔴🔴 【场景2核心方法】直接执行 MCP
   * @description 执行 Agent 直接请求 MCP，跳过 Agent B 中转
   * @param task 任务对象
   * @param mcpParams MCP 参数（由执行 Agent 提供）
   * @param executorResult 执行 Agent 的结果
   * @returns MCP 是否执行成功
   */
  private async executeMcpDirectly(
    task: typeof agentSubTasks.$inferSelect,
    mcpParams: {
      solutionNum: number;
      toolName: string;
      actionName: string;
      params: Record<string, any>;
    },
    executorResult: ExecutorAgentResult
  ): Promise<boolean> {
    console.log('[executeMcpDirectly] 🔴🔴🔴 ========== 直接执行 MCP 开始 ==========');
    console.log('[executeMcpDirectly] MCP 参数:', {
      toolName: mcpParams.toolName,
      actionName: mcpParams.actionName,
      solutionNum: mcpParams.solutionNum
    });
    
    const startTime = Date.now();
    
    try {
      // 1. 构建 AgentBDecision 格式（复用现有 MCP 执行逻辑）
      const decision: AgentBDecision = {
        type: 'EXECUTE_MCP',
        reasonCode: 'MCP_CONTINUE',
        reasoning: '执行 Agent 直接请求执行 MCP',
        context: {
          executionSummary: `执行 ${mcpParams.toolName}.${mcpParams.actionName}`,
          riskLevel: 'medium',
          suggestedAction: '执行 MCP'
        },
        data: {
          mcpParams: mcpParams,
          availableSolutions: []
        }
      };
      
      // 2. 查询 capabilities（用于 MCP 执行）
      const capabilities = await db
        .select()
        .from(capabilityList)
        .where(
          and(
            eq(capabilityList.toolName, mcpParams.toolName),
            eq(capabilityList.actionName, mcpParams.actionName)
          )
        )
        .limit(1);
      
      if (capabilities.length === 0) {
        console.error('[executeMcpDirectly] ❌ 未找到对应的 capability:', {
          toolName: mcpParams.toolName,
          actionName: mcpParams.actionName
        });
        return false;
      }
      
      const capability = capabilities[0];
      console.log('[executeMcpDirectly] ✅ 找到 capability:', {
        id: capability.id,
        toolName: capability.toolName,
        actionName: capability.actionName
      });
      
      // 3. 执行 MCP（复用 genericMCPCall 方法）
      console.log('[executeMcpDirectly] 🔄 开始执行 MCP...');
      const mcpResult = await genericMCPCall(
        mcpParams.toolName,
        mcpParams.actionName,
        mcpParams.params
      );
      
      const executionTime = Date.now() - startTime;
      console.log('[executeMcpDirectly] MCP 执行结果:', {
        success: mcpResult.success,
        executionTimeMs: executionTime
      });
      
      // 🔴🔴🔴 【关键修复】检查业务层成功（不仅仅是 HTTP 成功）
      // MCP 可能返回 HTTP 200，但业务层 success=false
      // 🔴🔴🔴 【二次修复】增加对 approved 字段的检查（合规审核场景）
      const businessSuccess = mcpResult.success && mcpResult.data?.success !== false
        && this.checkComplianceApproved(mcpResult.data, mcpParams);
      
      // 🔴🔴🔴 【新增】如果 approved=false，生成有意义的错误信息并设置 businessError
      let businessError = mcpResult.data?.error || mcpResult.error;
      if (typeof mcpResult.data?.data?.approved !== 'undefined' && !mcpResult.data.data.approved) {
        // approved=false 视为业务失败
        const complianceError = '合规审核未通过：' + (
          mcpResult.data.data.issues?.join('；') || 
          mcpResult.data.data.suggestions?.join('；') ||
          '内容存在合规风险'
        );
        businessError = complianceError;
        console.error('[executeMcpDirectly] ❌ MCP 合规审核失败:', complianceError);
      }
      
      if (!businessSuccess && businessError) {
        console.error('[executeMcpDirectly] ❌ MCP 业务层失败:', businessError);
      }
      
      // 4. 记录 MCP 执行结果
      await this.recordMcpExecution(
        task.commandResultId as string,
        task.orderIndex,
        task.id ? Number(task.id) : 0,
        1,
        {
          attemptId: 'direct-' + Date.now(),
          attemptNumber: 1,
          toolName: mcpParams.toolName,
          actionName: mcpParams.actionName,
          params: mcpParams.params,
          resultStatus: businessSuccess ? 'success' : 'failed',
          resultData: mcpResult.data,
          resultText: businessSuccess ? JSON.stringify(mcpResult.data) : businessError,
          errorCode: businessSuccess ? undefined : 'BUSINESS_ERROR',
          errorMessage: businessSuccess ? undefined : businessError,
          errorType: businessSuccess ? undefined : 'business',
          executionTimeMs: executionTime
        }
      );
      
      // 🔴🔴🔴 【关键修复】更新 executorResult.resultData，让调用方能获取 MCP 执行结果
      executorResult.resultData = mcpResult;
      
      console.log('[executeMcpDirectly] MCP 执行完成，业务结果:', businessSuccess ? '成功' : '失败');
      console.log('[executeMcpDirectly] 🔴🔴🔴 ========== 直接 MCP 执行结束 ==========');
      
      return businessSuccess;
      
    } catch (error) {
      console.error('[executeMcpDirectly] ❌ MCP 执行异常:', error);
      return false;
    }
  }

  /**
   * 执行MCP（支持多次尝试）
   * @description 带幂等检查的 MCP 执行入口
   */
  public async executeMcpWithRetry(
    task: typeof agentSubTasks.$inferSelect,
    initialDecision: AgentBDecision,
    executorResult: ExecutorAgentResult,
    capabilities: any[],
    mcpExecutionHistory: McpAttempt[],
    userInteractions: UserInteraction[],
    maxAttempts: number,
    currentIteration: number,
    priorStepOutput?: string
  ): Promise<boolean> {
    // 🔴🔴🔴 新增详细日志
    console.log('zhangjinglu 🔴🔴🔴 executeMcpWithRetry 被调用', {
      task_id: task.id,
      command_result_id: task.commandResultId,
      order_index: task.orderIndex,
      mcpParams: initialDecision.data?.mcpParams ? {
        toolName: initialDecision.data.mcpParams.toolName,
        actionName: initialDecision.data.mcpParams.actionName,
        hasParams: !!initialDecision.data.mcpParams.params
      } : null,
      maxAttempts: maxAttempts,
      currentIteration: currentIteration,
      timestamp: getCurrentBeijingTime().toISOString()
    });
    
    // ============================================
    // 🔴 P0 幂等检查：在执行前检查是否已有成功执行
    // ============================================
    if (initialDecision.data?.mcpParams) {
      const idempotencyCheck = await this.checkMcpIdempotency(task, initialDecision.data.mcpParams);
      
      if (idempotencyCheck.shouldSkip && idempotencyCheck.result) {
        console.log('[SubtaskEngine] 🔴🔴🔴 ========== MCP 幂等跳过 ========== 🔴🔴🔴');
        console.log('[SubtaskEngine] 🔴 跳过原因:', idempotencyCheck.result.reason);
        
        // 将幂等结果添加到历史记录
        if (idempotencyCheck.result.success) {
          const idempotentAttempt: McpAttempt = {
            attemptId: 'idempotent-' + Date.now(),
            attemptNumber: 1,
            timestamp: getCurrentBeijingTime(),
            decision: {
              solutionNum: initialDecision.data.mcpParams.solutionNum,
              toolName: initialDecision.data.mcpParams.toolName,
              actionName: initialDecision.data.mcpParams.actionName,
              reasoning: idempotencyCheck.result.reason,
              strategy: 'idempotent_skip',
              orderIndex: task.orderIndex  // 🔴🔴🔴 【修复】添加 orderIndex
            },
            params: initialDecision.data.mcpParams.params,
            result: {
              status: 'success',
              data: idempotencyCheck.result.data,
              executionTime: 0
            }
          };
          mcpExecutionHistory.push(idempotentAttempt);
          
          console.log('[SubtaskEngine] 🔴🔴🔴 ========== MCP 幂等跳过完成（成功） ========== 🔴🔴🔴');
          return true;
        } else {
          console.log('[SubtaskEngine] 🔴🔴🔴 ========== MCP 幂等跳过完成（失败） ========== 🔴🔴🔴');
          return false;
        }
      }
    }
    
    // 继续执行 MCP...
    let attemptCount = 0;
    let lastDecision = initialDecision;
    let lockAttemptId: string | null = null; // 🔴 保存锁的 attemptId

    while (attemptCount < maxAttempts) {
      attemptCount++;
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] MCP尝试 ' + attemptCount + '/' + maxAttempts);

      if (!lastDecision.data?.mcpParams) {
        console.error('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 缺少MCP参数');
        return false;
      }

      // 🔴🔴🔴 关键修复：在执行前补充文章内容参数
      console.log('[SubtaskEngine] 🔴🔴🔴 ========== 开始补充文章内容参数 ==========');
      console.log('[SubtaskEngine] 🔴🔴🔴 priorStepOutput 长度:', priorStepOutput?.length || 0);
      const supplementedMcpParams = await this.supplementArticleContentParams(
        task,
        lastDecision.data.mcpParams,
        priorStepOutput
      );
      
      // 更新 decision 中的 mcpParams
      lastDecision = {
        ...lastDecision,
        data: {
          ...lastDecision.data,
          mcpParams: supplementedMcpParams
        }
      };
      
      console.log('[SubtaskEngine] 🔴🔴🔴 ========== 文章内容参数补充完成 ==========');

      const startTime = Date.now();
      let attemptId = 'mcp-' + Date.now() + '-' + attemptCount;

      // 🔴🔴🔴 关键修复：在执行前创建 pending 状态的锁
      // 这样即使并发调用，也能检测到正在执行中的任务
      if (attemptCount === 1 && initialDecision.data?.mcpParams) {
        const lockId = await this.createMcpExecutionLock(
          task,
          initialDecision.data.mcpParams,
          attemptCount
        );
        
        if (lockId === null) {
          // 🔴 锁已存在，说明有其他执行正在进行
          console.log('[SubtaskEngine] 🔴🔴🔴 ========== MCP 锁冲突，跳过执行 ========== 🔴🔴🔴');
          console.log('[SubtaskEngine] 🔴 检测到其他执行正在进行中，幂等跳过');
          
          // 🔴🔴🔴 新增：返回前日志
          console.log('zhangjinglu 🔴🔴🔴 executeMcpWithRetry 返回 false（锁冲突）', {
            task_id: task.id,
            command_result_id: task.commandResultId,
            order_index: task.orderIndex,
            timestamp: getCurrentBeijingTime().toISOString()
          });
          
          return false; // 返回 false，表示执行失败（但不应该重试）
        }
        
        lockAttemptId = lockId;
        attemptId = lockId; // 使用锁的 attemptId
        console.log('[SubtaskEngine] 🔴🔴🔴 ========== MCP 锁创建成功 ========== 🔴🔴🔴');
      }

      try {
        // 执行MCP
        const mcpResult = await this.executeCapabilityWithParams(
          task,
          lastDecision.data.mcpParams,
          currentIteration
        );

        const executionTime = Date.now() - startTime;

        // 构建MCP尝试记录
        const mcpAttempt: McpAttempt = {
          attemptId,
          attemptNumber: attemptCount,
          timestamp: getCurrentBeijingTime(),
          decision: {
            solutionNum: lastDecision.data.mcpParams.solutionNum,
            toolName: lastDecision.data.mcpParams.toolName,
            actionName: lastDecision.data.mcpParams.actionName,
            reasoning: lastDecision.reasoning,
            strategy: attemptCount === 1 ? 'initial' : 
                     (mcpExecutionHistory.length > 0 && 
                      mcpExecutionHistory[mcpExecutionHistory.length - 1].decision.toolName === lastDecision.data.mcpParams.toolName ? 'retry' : 'switch_type'),
            orderIndex: task.orderIndex  // 🔴🔴🔴 【修复】添加 orderIndex
          },
          params: lastDecision.data.mcpParams.params,
          result: {
            status: mcpResult.success ? 'success' : 'failed',
            data: mcpResult.success ? mcpResult.data : undefined,
            error: !mcpResult.success ? {
              code: 'MCP_ERROR',
              message: mcpResult.error || '执行失败',
              type: this.classifyErrorType(mcpResult.error || ''),
            } : undefined,
            executionTime,
          },
        };

        // 如果失败，添加失败分析
        if (!mcpResult.success) {
          mcpAttempt.failureAnalysis = {
            isRetryable: this.isRetryableError(mcpResult.error || ''),
            failureType: this.getFailureType(mcpResult.error || ''),
            suggestedNextAction: attemptCount < maxAttempts ? 'switch_method' : 'retry_same',
          };
        }

        // 添加到历史
        mcpExecutionHistory.push(mcpAttempt);

        // 如果成功，返回true
        // 🔴🔴🔴 【关键修复】检查业务层成功（不仅仅是 HTTP 成功）
        // 🔴🔴🔴 【二次修复】增加对 approved 字段的检查（合规审核场景）
        const businessSuccess = mcpResult.success && mcpResult.data?.success !== false
          && this.checkComplianceApproved(mcpResult.data, lastDecision.data?.mcpParams);
        
        // 🔴🔴🔴 【新增】如果 approved=false，生成有意义的错误信息并设置 businessError
        let businessError = mcpResult.data?.error || mcpResult.error;
        if (typeof mcpResult.data?.data?.approved !== 'undefined' && !mcpResult.data.data.approved) {
          // approved=false 视为业务失败
          const complianceError = '合规审核未通过：' + (
            mcpResult.data.data.issues?.join('；') || 
            mcpResult.data.data.suggestions?.join('；') ||
            '内容存在合规风险'
          );
          businessError = complianceError;
          console.error('[SubtaskEngine] ❌ MCP 合规审核失败:', complianceError);
        }
        
        if (mcpResult.success && !businessSuccess && businessError) {
          console.error('[SubtaskEngine] ❌ MCP 业务层失败:', businessError);
          // 更新 mcpAttempt 为失败状态
          mcpAttempt.result.status = 'failed';
          mcpAttempt.result.error = {
            code: 'BUSINESS_ERROR',
            message: businessError,
            type: 'business'
          };
          mcpAttempt.failureAnalysis = {
            isRetryable: true,
            failureType: 'business',
            suggestedNextAction: 'check_params'
          };
        }
        
        if (businessSuccess) {
          console.log('[SubtaskEngine] ========== MCP 执行成功！详细结果 ==========');
          console.log('[SubtaskEngine] MCP 工具: ' + lastDecision.data.mcpParams.toolName);
          console.log('[SubtaskEngine] MCP 动作: ' + lastDecision.data.mcpParams.actionName);
          console.log('[SubtaskEngine] 执行时间: ' + executionTime + 'ms');
          
          // 详细展示返回数据
          if (mcpResult.data) {
            console.log('[SubtaskEngine] 返回数据:');
            
            // 特别处理合规审核结果
            if (lastDecision.data.mcpParams.actionName && (
                lastDecision.data.mcpParams.actionName.toLowerCase().includes('compliance') || 
                lastDecision.data.mcpParams.actionName.toLowerCase().includes('audit') ||
                lastDecision.data.mcpParams.actionName.toLowerCase().includes('check') ||
                lastDecision.data.mcpParams.toolName.toLowerCase().includes('compliance') ||
                lastDecision.data.mcpParams.toolName.toLowerCase().includes('audit')
            )) {
              console.log('[SubtaskEngine] 🔴 这是合规审核结果，详细展示:');
              this.prettyPrintComplianceResult(mcpResult.data);
            } else {
              // 通用结果展示
              console.log('[SubtaskEngine] 返回数据 (JSON): ' + JSON.stringify(mcpResult.data, null, 2));
            }
          }
          
          console.log('[SubtaskEngine] ========== MCP 执行成功结束 ==========');
          
          // 🔴🔴🔴 关键修复：更新执行记录状态为 success
          if (lockAttemptId) {
            await this.updateMcpExecutionStatus(
              task,
              lockAttemptId,
              'success',
              mcpResult.data,
              undefined,
              undefined,
              undefined,
              executionTime
            );
          }
          
          // 🔴🔴🔴 新增：返回前日志
          console.log('zhangjinglu 🔴🔴🔴 executeMcpWithRetry 返回 true（MCP执行成功）', {
            task_id: task.id,
            command_result_id: task.commandResultId,
            order_index: task.orderIndex,
            toolName: lastDecision.data.mcpParams.toolName,
            actionName: lastDecision.data.mcpParams.actionName,
            executionTime: executionTime,
            timestamp: getCurrentBeijingTime().toISOString()
          });
          
          return true;
        }
        
        // 🔴🔴🔴 业务失败或 HTTP 失败，记录错误
        const failureReason = businessError || mcpResult.error || '未知错误';
        console.log('[SubtaskEngine] MCP执行失败:', failureReason);

        // 🔴🔴🔴 【修复】确保数据库中的 resultStatus 与实际业务状态一致
        // 避免 Agent B 基于错误的 resultStatus 做判断
        if (lockAttemptId) {
          await this.updateMcpExecutionStatus(
            task,
            lockAttemptId,
            'failed',
            mcpResult.data,
            'BUSINESS_ERROR',
            failureReason,
            'business',
            executionTime
          );
        }

        // 如果失败且还有尝试次数，让Agent B重新决策
        if (attemptCount < maxAttempts) {
          console.log('[SubtaskEngine] MCP执行失败，请求Agent B重新决策');
          
          // 🔴🔴🔴 【优化】mcpExecutionHistory 已在 buildExecutionContext 内部查询
          // 构建临时上下文用于重新决策（复用 buildExecutionContext 方法）
          const retryContext = await this.buildExecutionContext(
            task,
            {
              ...executorResult,
              problem: 'MCP执行失败: ' + failureReason,
            },
            capabilities,
            [], // userInteractions
            attemptCount,
            maxAttempts
          );

          // 调用Agent B重新决策
          const retryDecision = await this.callAgentBWithDecision(
            task,
            retryContext,
            capabilities
          );

          if (retryDecision.type !== 'EXECUTE_MCP' || !retryDecision.data?.mcpParams) {
            console.log('[SubtaskEngine] Agent B决定不再继续MCP执行');
            return false;
          }

          lastDecision = retryDecision;
        }

      } catch (error) {
        const executionTime = Date.now() - startTime;

        // 记录失败的尝试
        const mcpAttempt: McpAttempt = {
          attemptId,
          attemptNumber: attemptCount,
          timestamp: getCurrentBeijingTime(),
          decision: {
            solutionNum: lastDecision.data?.mcpParams?.solutionNum ?? 1,
            toolName: lastDecision.data?.mcpParams?.toolName ?? '',
            actionName: lastDecision.data?.mcpParams?.actionName ?? '',
            reasoning: lastDecision.reasoning,
            strategy: attemptCount === 1 ? 'initial' : 'retry',
            orderIndex: task.orderIndex  // 🔴🔴🔴 【修复】添加 orderIndex
          },
          params: lastDecision.data?.mcpParams?.params ?? {},
          result: {
            status: 'failed',
            error: {
              code: 'EXCEPTION',
              message: error instanceof Error ? error.message : '未知异常',
              type: 'unknown',
            },
            executionTime,
          },
          failureAnalysis: {
            isRetryable: attemptCount < maxAttempts,
            failureType: 'temporary',
            suggestedNextAction: attemptCount < maxAttempts ? 'retry_same' : 'switch_method',
          },
        };

        mcpExecutionHistory.push(mcpAttempt);
        
        // 🔴🔴🔴 关键修复：更新执行记录状态为 failed
        if (lockAttemptId && attemptCount >= maxAttempts) {
          await this.updateMcpExecutionStatus(
            task,
            lockAttemptId,
            'failed',
            undefined,
            'MCP_ERROR',
            error instanceof Error ? error.message : '未知异常',
            'unknown',
            executionTime
          );
        }
        
        if (attemptCount >= maxAttempts) {
          return false;
        }
      }
    }

    return false;
  }

  /**
   * 使用参数执行MCP
   */
  private async executeCapabilityWithParams(
    task: typeof agentSubTasks.$inferSelect,
    mcpParams: { toolName: string; actionName: string; params: any; solutionNum: number; },
    currentIteration: number
  ) {
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== 执行MCP ==========');
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] MCP 调用参数详情:');
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] - toolName:', mcpParams.toolName);
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] - actionName:', mcpParams.actionName);
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] - solutionNum:', mcpParams.solutionNum);
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] - params:', JSON.stringify(mcpParams.params, null, 2));
    
    // 🔴 特别检查：如果是合规审核相关的MCP，检查是否包含文章内容
    if (mcpParams.actionName && mcpParams.actionName.toLowerCase().includes('compliance') || 
        mcpParams.actionName && mcpParams.actionName.toLowerCase().includes('check') ||
        mcpParams.actionName && mcpParams.actionName.toLowerCase().includes('审核')) {
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 合规审核相关MCP，检查文章内容:');
      const params = mcpParams.params;
      const hasContent = params && (params.content || params.articleContent || params.text || params.priorStepOutput);
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 - 是否包含文章内容字段:', hasContent);
      if (!hasContent) {
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 ❌ 警告：合规审核MCP缺少文章内容参数！');
      } else {
        const content = params.content || params.articleContent || params.text || params.priorStepOutput;
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 - 文章内容长度:', content?.length || 0);
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 - 文章内容前 200 字符:', content?.substring(0, 200) || '');
      }
    }

    // 🔴 临时修复：wechat add_draft 参数转换
    // 如果只有 content 没有 articles，自动转换为 articles 格式
    let finalParams = mcpParams.params;
    if (mcpParams.toolName === 'wechat' && mcpParams.actionName === 'add_draft') {
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 检测到 wechat add_draft，检查参数格式...');
      if (finalParams.articles) {
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ✅ 已有 articles 参数，无需转换');
      } else if (finalParams.content) {
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ⚠️ 只有 content，转换为 articles 格式');
        // 从 content 中提取标题（第一行或 # 开头的内容）
        let title = '未命名文章';
        let contentText = finalParams.content;
        
        // 尝试提取标题
        const titleMatch = finalParams.content.match(/^#\s*(.+)$/m);
        if (titleMatch) {
          title = titleMatch[1].trim();
        }
        
        // 转换 content 为 HTML 格式（简单处理）
        const htmlContent = finalParams.content
          .split('\n')
          .map(line => {
            if (line.startsWith('#### ')) return `<h4>${line.substring(5)}</h4>`;
            if (line.startsWith('### ')) return `<h3>${line.substring(4)}</h3>`;
            if (line.startsWith('## ')) return `<h2>${line.substring(3)}</h2>`;
            if (line.startsWith('# ')) return `<h1>${line.substring(2)}</h1>`;
            if (line.trim() === '') return '<br>';
            return `<p>${line}</p>`;
          })
          .join('\n');
        
        finalParams = {
          accountId: finalParams.accountId || 'insurance-account',
          articles: [{
            title: title,
            author: finalParams.author || '保险助手',
            digest: finalParams.digest || finalParams.content.substring(0, 100) + '...',
            content: `<div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.8;">${htmlContent}</div>`,
            show_cover_pic: 0,  // 不显示封面（这样不需要 thumb_media_id）
            // thumb_media_id: 如果需要封面，需要先上传图片获取 media_id
          }]
        };
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 转换后的参数:', JSON.stringify(finalParams, null, 2));
      } else {
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ❌ 既没有 articles 也没有 content 参数');
      }
    }

    try {
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== MCP 执行前 ==========');
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 开始调用 MCP 接口...');
      const mcpResult = await genericMCPCall(
        mcpParams.toolName,
        mcpParams.actionName,
        finalParams  // 使用转换后的参数
      );
      
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== MCP 执行后 ==========');
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] MCP 调用成功！');
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== MCP 返回结果详情 ==========');
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] MCP 返回结果 (完整JSON):', JSON.stringify(mcpResult, null, 2));
      
      // 🔴 特别处理：合规审核类 MCP，详细展示问题
      if (mcpParams.actionName && (
          mcpParams.actionName.toLowerCase().includes('compliance') || 
          mcpParams.actionName.toLowerCase().includes('audit') ||
          mcpParams.actionName.toLowerCase().includes('check') ||
          mcpParams.actionName.toLowerCase().includes('审核') ||
          mcpParams.toolName.toLowerCase().includes('compliance') ||
          mcpParams.toolName.toLowerCase().includes('audit')
      )) {
        console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 🔴 ========== 合规审核结果详细展示 ==========');
        this.prettyPrintComplianceResult(mcpResult);
      }
      
      // 通用 MCP 结果摘要
      this.prettyPrintMcpResultSummary(mcpResult, mcpParams.toolName, mcpParams.actionName);
      
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== MCP 返回结果结束 ==========');
      
      // 🔴🔴🔴 【修复】检查业务层成功，不仅仅是 HTTP 成功
      // MCP 可能返回 HTTP 200，但业务层 success=false（如微信返回 "empty content"）
      const businessSuccess = mcpResult.success && mcpResult.data?.success !== false
        && this.checkComplianceApproved(mcpResult.data, mcpParams);
      
      // 如果业务失败，提取错误信息
      const businessError = !businessSuccess ? (mcpResult.data?.error || mcpResult.error || '业务执行失败') : undefined;
      
      // 🔴 记录 MCP 执行（使用业务层成功状态）
      await this.recordMcpExecution(
        task.commandResultId,
        task.orderIndex,
        task.id,
        currentIteration,
        {
          attemptId: 'mcp-' + Date.now() + '-' + currentIteration,
          attemptNumber: currentIteration,
          toolName: mcpParams.toolName,
          actionName: mcpParams.actionName,
          params: mcpParams.params,
          resultStatus: businessSuccess ? 'success' : 'failed',
          resultData: mcpResult.data,
          resultText: businessSuccess ? JSON.stringify(mcpResult.data) : businessError,
          errorMessage: businessError,
        }
      );
      
      return {
        success: businessSuccess,  // 🔴 修复：返回业务层成功状态
        data: mcpResult,
        error: businessError,
        executionMode: 'direct',
      };
    } catch (error) {
      console.error('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== MCP 执行失败 ==========');
      console.error('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] MCP 调用失败！');
      console.error('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 错误详情:', error);
      
      // 🔴 记录 MCP 执行失败
      await this.recordMcpExecution(
        task.commandResultId,
        task.orderIndex,
        task.id,
        currentIteration,
        {
          attemptId: 'mcp-' + Date.now() + '-' + currentIteration,
          attemptNumber: currentIteration,
          toolName: mcpParams.toolName,
          actionName: mcpParams.actionName,
          params: mcpParams.params,
          resultStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : '执行失败',
        }
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
        executionMode: 'direct',
      };
    }
  }

  /**
   * 分类错误类型
   */
  private classifyErrorType(errorMessage: string): 'network' | 'timeout' | 'permission' | 'not_found' | 'unknown' {
    const lowerError = errorMessage.toLowerCase();
    if (lowerError.includes('timeout') || lowerError.includes('time out')) return 'timeout';
    if (lowerError.includes('network') || lowerError.includes('connection')) return 'network';
    if (lowerError.includes('permission') || lowerError.includes('forbidden') || lowerError.includes('unauthorized')) return 'permission';
    if (lowerError.includes('not found') || lowerError.includes('404')) return 'not_found';
    return 'unknown';
  }

  /**
   * 🔴🔴🔴 【关键修复】检查合规审核结果中的 approved 字段
   * 
   * 【重要修改】此方法不再将 approved=false 视为技术失败
   * 合规审核返回 approved=false 是业务结果，不是技术失败
   * 应该让 Agent B 根据审核结果决定下一步操作
   * 
   * @param data MCP 返回的数据
   * @param mcpParams MCP 参数（包含 toolName 和 actionName）
   * @returns 是否技术成功（MCP API 调用成功）
   */
  private checkComplianceApproved(data: any, mcpParams?: { toolName?: string; actionName?: string }): boolean {
    // 检查是否有 approved 字段
    const hasApprovedField = typeof data?.data?.approved !== 'undefined' || typeof data?.approved !== 'undefined';
    
    // 如果没有 approved 字段，返回 true（不阻断）
    if (!hasApprovedField) {
      return true;
    }
    
    // 检查是否是合规审核场景
    const toolName = mcpParams?.toolName?.toLowerCase() || '';
    const actionName = mcpParams?.actionName?.toLowerCase() || '';
    const isComplianceScenario = 
      toolName.includes('compliance') || 
      toolName.includes('audit') ||
      toolName.includes('wechat') ||
      actionName.includes('compliance') || 
      actionName.includes('audit') ||
      actionName.includes('check');
    
    // 无论 approved 的值是什么，都返回 true，不阻断 MCP 执行
    // 让 Agent B 根据审核结果决定后续操作
    if (isComplianceScenario) {
      const approved = data?.data?.approved ?? data?.approved;
      console.log('[SubtaskEngine] 🔔 合规审核完成，approved=' + approved + '，由 Agent B 决定下一步操作');
    }
    
    return true;
  }

  /**
   * 判断是否可重试的错误
   */
  private isRetryableError(errorMessage: string): boolean {
    const errorType = this.classifyErrorType(errorMessage);
    return ['timeout', 'network'].includes(errorType);
  }

  /**
   * 获取失败类型
   */
  private getFailureType(errorMessage: string): 'temporary' | 'resource_unavailable' {
    const errorType = this.classifyErrorType(errorMessage);
    if (errorType === 'timeout' || errorType === 'network') return 'temporary';
    return 'resource_unavailable';
  }

  /**
   * 🔴 详细展示合规审核结果
   */
  private prettyPrintComplianceResult(mcpResult: any) {
    console.log('[SubtaskEngine] 🔴 合规审核结果详细分析:');
    
    // 处理不同的数据结构格式
    const data = mcpResult?.data || mcpResult;
    
    if (data) {
      // 检查是否有 approved 字段
      if (typeof data.approved !== 'undefined') {
        const statusIcon = data.approved ? '✅' : '❌';
        console.log(`[SubtaskEngine] 🔴 审核结果: ${statusIcon} ${data.approved ? '通过' : '未通过'}`);
      }
      
      // 风险等级
      if (data.riskLevel) {
        const riskEmoji = data.riskLevel === 'low' ? '🟢' : 
                         data.riskLevel === 'medium' ? '🟡' :
                         data.riskLevel === 'high' ? '🟠' : '🔴';
        console.log(`[SubtaskEngine] 🔴 风险等级: ${riskEmoji} ${data.riskLevel}`);
      }
      
      // 问题列表
      if (data.issues && Array.isArray(data.issues)) {
        console.log(`[SubtaskEngine] 🔴 发现的问题 (${data.issues.length} 个):`);
        data.issues.forEach((issue: string, index: number) => {
          console.log(`[SubtaskEngine] 🔴   ${index + 1}. ${issue}`);
        });
      } else if (data.summary) {
        console.log(`[SubtaskEngine] 🔴 审核摘要: ${data.summary}`);
      }
      
      // 建议列表
      if (data.suggestions && Array.isArray(data.suggestions)) {
        console.log(`[SubtaskEngine] 🔴 改进建议 (${data.suggestions.length} 条):`);
        data.suggestions.forEach((suggestion: string, index: number) => {
          console.log(`[SubtaskEngine] 🔴   ${index + 1}. ${suggestion}`);
        });
      }
      
      // 引用规则
      if (data.referencedRules && Array.isArray(data.referencedRules)) {
        console.log(`[SubtaskEngine] 🔴 引用的规则 (${data.referencedRules.length} 条):`);
        data.referencedRules.forEach((rule: string, index: number) => {
          console.log(`[SubtaskEngine] 🔴   ${index + 1}. ${rule}`);
        });
      }
      
      // 审核时间
      if (data.auditTime) {
        console.log(`[SubtaskEngine] 🔴 审核时间: ${data.auditTime}`);
      }
    } else {
      console.log('[SubtaskEngine] 🔴 无合规审核数据');
    }
  }

  /**
   * 通用 MCP 结果摘要打印
   */
  private prettyPrintMcpResultSummary(mcpResult: any, toolName: string, actionName: string) {
    console.log('[SubtaskEngine] 📊 MCP 结果摘要:');
    console.log(`[SubtaskEngine]   工具: ${toolName}`);
    console.log(`[SubtaskEngine]   动作: ${actionName}`);
    
    const data = mcpResult?.data || mcpResult;
    
    // 检查是否有 success 字段
    if (typeof mcpResult?.success !== 'undefined') {
      const statusIcon = mcpResult.success ? '✅' : '❌';
      console.log(`[SubtaskEngine]   执行状态: ${statusIcon} ${mcpResult.success ? '成功' : '失败'}`);
    }
    
    // 错误信息
    if (mcpResult?.error) {
      console.log(`[SubtaskEngine]   错误信息: ${mcpResult.error}`);
    }
    
    // 数据类型判断
    if (data) {
      if (typeof data === 'object') {
        const keys = Object.keys(data);
        console.log(`[SubtaskEngine]   返回字段: ${keys.join(', ')}`);
        
        // 特殊字段展示
        if (data.content) {
          const contentPreview = typeof data.content === 'string' 
            ? data.content.substring(0, 200) 
            : JSON.stringify(data.content).substring(0, 200);
          console.log(`[SubtaskEngine]   Content 预览: ${contentPreview}...`);
        }
        if (data.message) {
          console.log(`[SubtaskEngine]   Message: ${data.message}`);
        }
        if (data.result) {
          const resultPreview = typeof data.result === 'string' 
            ? data.result.substring(0, 200) 
            : JSON.stringify(data.result).substring(0, 200);
          console.log(`[SubtaskEngine]   Result 预览: ${resultPreview}...`);
        }
      } else if (typeof data === 'string') {
          console.log(`[SubtaskEngine]   返回字符串: ${data.substring(0, 300)}...`);
      } else {
        console.log(`[SubtaskEngine]   返回类型: ${typeof data}`);
      }
    }
  }

  /**
   * 🔴 新增：检测 MCP 是否已返回有效结果
   * 🔴 修复：同时检查 HTTP 层和业务层，防止 HTTP 200 但业务失败的情况
   * 🔴 关键修复：只有明确有 success: true 才返回 true，确保 Agent B 有机会评审
   * 🔴🔴🔴 【关键修复】：必须检查 MCP 是否属于当前任务，防止前序任务的 MCP 被误判为当前任务的结果
   */
  private hasValidMcpResult(mcpExecutionHistory: McpAttempt[], currentOrderIndex?: number): boolean {
    if (!mcpExecutionHistory || mcpExecutionHistory.length === 0) {
      return false;
    }
    
    // 🔴🔴🔴 【关键修复】只检查属于当前任务的 MCP 结果
    let targetAttempts = mcpExecutionHistory;
    if (currentOrderIndex !== undefined) {
      targetAttempts = mcpExecutionHistory.filter(m => m.decision.orderIndex === currentOrderIndex);
      
      if (targetAttempts.length === 0) {
        console.log('[SubtaskEngine] ❌ 当前任务无 MCP 执行记录 (orderIndex=' + currentOrderIndex + ')');
        return false;
      }
    }
    
    // 检查最后一次 MCP 执行结果
    const lastAttempt = targetAttempts[targetAttempts.length - 1];
    
    // 1. 首先检查 HTTP 层状态
    if (lastAttempt.result?.status !== 'success') {
      console.log('[SubtaskEngine] ❌ MCP HTTP 层失败:', { status: lastAttempt.result?.status });
      return false;
    }
    
    // 2. 检查业务层状态（必须明确有 success: true）
    const businessData = lastAttempt.result?.data;
    
    // 🔴 关键修复：必须明确有 success: true 才返回 true
    // 如果没有 success 字段，或者 success 不是 true，都返回 false，让 Agent B 来评审
    if (!businessData) {
      console.log('[SubtaskEngine] ⚠️ MCP 无业务数据 → 让 Agent B 评审');
      return false;
    }
    
    if (businessData.success !== true) {
      console.log('[SubtaskEngine] ❌ MCP 业务层未明确成功:', { 
        businessSuccess: businessData.success, 
        error: businessData.error || businessData.message 
      });
      return false;
    }
    
    console.log('[SubtaskEngine] ✅ 检测到 MCP 有效结果 (HTTP层+业务层都明确成功):', {
      httpStatus: lastAttempt.result.status,
      businessSuccess: businessData.success,
      has_data: !!businessData,
      mcpOrderIndex: lastAttempt.decision.orderIndex,
      currentOrderIndex: currentOrderIndex
    });
    return true;
  }

  /**
   * 处理COMPLETE决策
   */
  public async handleCompleteDecision(
    task: typeof agentSubTasks.$inferSelect,
    decision: AgentBDecision,
    executorResult: ExecutorAgentResult,
    mcpExecutionHistory: McpAttempt[],
    userInteractions: UserInteraction[],
    iteration: number
  ) {
    console.log('[SubtaskEngine] 处理COMPLETE决策');

    // 🔴 记录 Agent B 的完整交互（request + response）
    // 🔴🔴🔴 直接传入 decision 对象，而不是包装对象！
    await this.recordAgentInteraction(
      task.commandResultId,
      task.orderIndex,
      'agent B',
      executorResult,  // requestContent: Agent B 收到的请求（执行Agent的结果）
      'COMPLETE',       // responseStatus
      decision,         // responseContent: 直接传入 decision 对象！
      task.id,
      iteration
    );

    // 🔴 🔴 🔴 关键优化：在更新前重新读取最新任务！（你的方案！）
    console.log('[SubtaskEngine] 🔄 重新读取最新任务，准备更新为 completed...');
    const latestTaskForCompleted = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .then(res => res[0]);

    if (!latestTaskForCompleted) {
      console.error('[SubtaskEngine] ❌ 重新读取任务失败，无法更新');
      return;
    }

    console.log('[SubtaskEngine] ✅ 重新读取成功，最新状态:', {
      status: latestTaskForCompleted.status,
      updatedAt: latestTaskForCompleted.updatedAt
    });

    // 🔴🔴🔴 【新增】执行成功后更新 reexecuteHistory 中最新记录的执行结果
    // 目的：让死循环检测能够识别到执行已经成功
    try {
      const currentMetadata = (latestTaskForCompleted.metadata as any) || {};
      const reexecuteHistory = currentMetadata.reexecuteHistory || [];
      
      // 🔴 找到最新一条 reexecuteHistory 记录并更新其 executionResult
      if (reexecuteHistory.length > 0) {
        const latestRecord = reexecuteHistory[reexecuteHistory.length - 1];
        
        // 🔴 如果最新记录没有 executionResult，或者 executionResult.success 为 false，则更新
        if (!latestRecord.executionResult || !latestRecord.executionResult.success) {
          // 🔴 insurance-d 执行成功：isTaskDown = true
          const executionSuccess = executorResult.isTaskDown === true;
          
          console.log('[SubtaskEngine] 🔴 更新 reexecuteHistory 的 executionResult (COMPLETE):', {
            taskId: task.id,
            executor: latestRecord.executor,
            previousExecutor: latestRecord.previousExecutor,
            isTaskDown: executorResult.isTaskDown,
            executionSuccess
          });
          
          // 更新最新记录的 executionResult
          reexecuteHistory[reexecuteHistory.length - 1].executionResult = {
            success: executionSuccess,
            mcpSuccess: false,  // COMPLETE 不是 MCP 执行
            isTaskDown: executorResult.isTaskDown === true,
            executorResult: executorResult
          };
          
          // 🔴 将更新后的 reexecuteHistory 保存到 metadata
          const updatedMetadata = {
            ...currentMetadata,
            reexecuteHistory
          };
          
          // 🔴 更新数据库
          await db
            .update(agentSubTasks)
            .set({
              metadata: updatedMetadata,
              updatedAt: getCurrentBeijingTime()
            })
            .where(eq(agentSubTasks.id, task.id));
          
          console.log('[SubtaskEngine] ✅ reexecuteHistory executionResult 更新成功 (COMPLETE)');
        }
      }
    } catch (updateError) {
      console.error('[SubtaskEngine] ❌ 更新 reexecuteHistory 失败 (COMPLETE):', updateError);
      // 不影响主流程
    }
    // 🔴🔴🔴 更新 reexecuteHistory 结束

    // 用重新读取的最新任务调用 markTaskCompleted！
    // 🔴🔴🔴 关键修复：传入 executorResult（包含真正的执行结果和文章内容）
    // 而不是 decision.data?.completionResult（只有 {"success":true}）
    await this.markTaskCompleted(latestTaskForCompleted, executorResult);

    // Phase 3: 核心锚点自动归档（insurance-d 完成后）
    await this.archiveCoreAnchorsIfNeeded(latestTaskForCompleted);

    // 🔥🔥🔥 两阶段架构：基础文章定稿后解锁适配组
    await this.unlockAdaptationGroupsIfNeeded(latestTaskForCompleted);
  }

  /**
   * 🔥🔥🔥 两阶段架构：基础文章定稿后解锁适配组
   *
   * 触发条件：
   * 1. 任务属于基础文章组（metadata.phase === 'base_article'）
   * 2. 任务是写作 Agent（insurance-d）完成合规整改（orderIndex >= 6）
   *
   * 解锁逻辑：
   * 1. 按 multiPlatformGroupId 查找所有 blocked 的适配组任务
   * 2. 按适配组（commandResultId）分组
   * 3. 每组只解锁第一个任务（blocked → pending）
   * 4. 原子性更新（二次校验 status=blocked 防并发）
   * 5. 主动触发引擎执行
   */
  private async unlockAdaptationGroupsIfNeeded(task: typeof agentSubTasks.$inferSelect): Promise<void> {
    try {
      const taskMetadata = task.metadata as Record<string, any> | null;
      if (!taskMetadata) return;

      // 条件1：必须是基础文章组的任务
      if (taskMetadata.phase !== 'base_article') {
        return;
      }

      // 条件2：必须是多平台模式
      const multiPlatformGroupId = taskMetadata.multiPlatformGroupId;
      if (!multiPlatformGroupId) {
        return;
      }

      // 条件3：必须是基础文章定稿点
      // P2-4 修复：动态计算定稿点，而非硬编码 orderIndex >= 6
      // 查询基础文章组的所有任务，取 orderIndex >= 2 的最大值作为定稿点
      // orderIndex >= 2 作为写作任务阈值（orderIndex=1 是分析，写作相关任务从 2 开始）
      // 即使包含 preview 等非写作节点，也不会高于实际最后写作任务
      let isFinalizationPoint = false;
      try {
        const baseArticleTasks = await db
          .select({ orderIndex: agentSubTasks.orderIndex })
          .from(agentSubTasks)
          .where(
            and(
              sql`${agentSubTasks.metadata}->>'multiPlatformGroupId' = ${multiPlatformGroupId}`,
              sql`${agentSubTasks.metadata}->>'phase' = 'base_article'`
            )
          );
        const writingOrderIndices = baseArticleTasks
          .map(t => t.orderIndex)
          .filter(idx => idx !== null && idx >= 2);
        const maxWritingOrderIndex = writingOrderIndices.length > 0
          ? Math.max(...writingOrderIndices)
          : 6; // 兜底值（与原硬编码一致）
        isFinalizationPoint = task.orderIndex >= maxWritingOrderIndex;

        if (!isFinalizationPoint) {
          console.log('[SubtaskEngine] 🔥 基础文章组任务完成，但尚未到达定稿点', {
            orderIndex: task.orderIndex,
            maxWritingOrderIndex,
            taskId: task.id,
          });
          return;
        }
      } catch (err) {
        // 查询失败时降级为 orderIndex >= 6 兜底
        console.warn('[SubtaskEngine] ⚠️ 定稿点动态计算失败，降级为 orderIndex >= 6:', err);
        isFinalizationPoint = task.orderIndex >= 6;
        if (!isFinalizationPoint) return;
      }

      console.log('[SubtaskEngine] 🔥🔥🔥 基础文章定稿点已到达，开始解锁适配组', {
        taskId: task.id,
        orderIndex: task.orderIndex,
        multiPlatformGroupId,
      });

      // 查找所有 blocked 的适配组任务
      const blockedTasks = await db
        .select()
        .from(agentSubTasks)
        .where(
          and(
            sql`${agentSubTasks.metadata}->>'multiPlatformGroupId' = ${multiPlatformGroupId}`,
            eq(agentSubTasks.status, 'blocked')
          )
        );

      if (blockedTasks.length === 0) {
        console.log('[SubtaskEngine] 🔥 没有找到 blocked 的适配组任务，无需解锁');
        return;
      }

      console.log('[SubtaskEngine] 🔥 找到 blocked 适配组任务:', blockedTasks.length, '个');

      // 按 commandResultId 分组
      const groups: Record<string, typeof agentSubTasks.$inferSelect[]> = {};
      for (const t of blockedTasks) {
        const gid = t.commandResultId;
        if (!groups[gid]) groups[gid] = [];
        groups[gid].push(t);
      }

      // 每组只解锁第一个任务（按 orderIndex 排序）
      const unlockedGroups: string[] = [];
      for (const [groupId, tasks] of Object.entries(groups)) {
        const sortedTasks = tasks.sort((a, b) => a.orderIndex - b.orderIndex);
        const firstTask = sortedTasks[0];

        // 原子性更新：二次校验 status=blocked 防并发
        const updateResult = await db
          .update(agentSubTasks)
          .set({
            status: 'pending',
            updatedAt: getCurrentBeijingTime(),
          })
          .where(
            and(
              eq(agentSubTasks.id, firstTask.id),
              eq(agentSubTasks.status, 'blocked') // 二次校验
            )
          )
          .returning();

        if (updateResult.length > 0) {
          unlockedGroups.push(groupId);
          console.log('[SubtaskEngine] 🔥 已解锁适配组首个任务:', {
            groupId,
            taskId: firstTask.id,
            orderIndex: firstTask.orderIndex,
            taskTitle: firstTask.taskTitle,
          });
        } else {
          console.warn('[SubtaskEngine] ⚠️ 适配组任务解锁失败（可能已被其他进程解锁）:', {
            groupId,
            taskId: firstTask.id,
          });
        }
      }

      if (unlockedGroups.length > 0) {
        console.log('[SubtaskEngine] 🔥🔥🔥 成功解锁', unlockedGroups.length, '个适配组，触发引擎执行');

        // P1-3 修复：立即触发引擎执行，移除无意义的 1 秒延迟
        // 延迟原意是等 DB 持久化，但 UPDATE ... RETURNING 已同步完成，
        // 且引擎轮询是最终保障，即使本次触发丢失，下个周期也会执行 pending 任务
        this.execute().catch(err => {
          console.error('[SubtaskEngine] 🔥 适配组解锁后引擎执行失败:', err);
        });
      }
    } catch (error) {
      console.error('[SubtaskEngine] 🔥 解锁适配组失败（不影响基础文章流程）:', error);
      // 不影响基础文章的主流程
    }
  }

  /**
   * 处理NEED_USER决策
   */
  public async handleNeedUserDecision(
    task: typeof agentSubTasks.$inferSelect,
    decision: AgentBDecision,
    executorResult: ExecutorAgentResult,
    mcpExecutionHistory: McpAttempt[],
    userInteractions: UserInteraction[],
    iteration: number
  ) {
    console.log('[SubtaskEngine] 🔴🔴🔴 处理NEED_USER决策 🔴🔴🔴');
    console.log('[SubtaskEngine] 参数信息:', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      commandResultId: task.commandResultId,
      iteration: iteration,
      decisionType: decision.type,
      reasonCode: decision.reasonCode,
      // 🔴 新增：打印 notCompletedReason
      notCompletedReason: decision.notCompletedReason || '【未填写！】',
      currentStatus: task.status
    });
    
    // 🔴 如果 notCompletedReason 为空，打印警告
    if (!decision.notCompletedReason) {
      console.warn('[SubtaskEngine] ⚠️ ⚠️ ⚠️ 【诊断】Agent B 未填写 notCompletedReason！');
    }

    // ⚠️  🔴 重要：检查当前状态，如果已经是 completed 或 cancelled，不再处理！
    if (task.status === 'completed' || task.status === 'cancelled') {
      console.warn('[SubtaskEngine] ⚠️  ⚠️  ⚠️  任务已结束，跳过 handleNeedUserDecision:', {
        taskId: task.id,
        currentStatus: task.status
      });
      return;
    }



    // ========== 🔴 新增：记录 Agent B 的交互（NEED_USER） ==========
    // 🔴🔴🔴 直接传入 decision 对象，而不是包装对象！
    await this.recordAgentInteraction(
      task.commandResultId,
      task.orderIndex,
      'agent B',
      executorResult,  // requestContent: Agent B 收到的请求（执行Agent的结果）
      'NEED_USER',     // responseStatus
      decision,         // responseContent: 直接传入 decision 对象！
      task.id,
      iteration
    );
    console.log('[SubtaskEngine] ✅ Agent B NEED_USER 交互记录完成');

    // 🔴 🔴 🔴 关键优化：在更新前重新读取最新任务！（你的方案！）
    console.log('[SubtaskEngine] 🔄 重新读取最新任务，准备更新为 waiting_user...');
    const latestTaskForWaitingUser = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .then(res => res[0]);
    
    if (!latestTaskForWaitingUser) {
      console.error('[SubtaskEngine] ❌ 重新读取任务失败，无法更新');
      return;
    }
    
    console.log('[SubtaskEngine] ✅ 重新读取成功，最新状态:', {
      status: latestTaskForWaitingUser.status,
      updatedAt: latestTaskForWaitingUser.updatedAt
    });
    
    // 更新任务状态为waiting_user（使用重新读取的最新任务！）
    const promptMessage = decision.data?.promptMessage;
    const waitingMessage = typeof promptMessage === 'string' 
      ? promptMessage 
      : (promptMessage?.description || '需要您的介入来继续处理此任务');
    await this.markTaskWaitingUser(latestTaskForWaitingUser, waitingMessage);
  }

  /**
   * 处理FAILED决策
   */
  public async handleFailedDecision(
    task: typeof agentSubTasks.$inferSelect,
    decision: AgentBDecision,
    executorResult: ExecutorAgentResult,
    mcpExecutionHistory: McpAttempt[],
    userInteractions: UserInteraction[],
    iteration: number
  ) {
    console.log('[SubtaskEngine] 🔴🔴🔴 处理FAILED决策 🔴🔴🔴');
    console.log('[SubtaskEngine] 参数信息:', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      commandResultId: task.commandResultId,
      iteration: iteration,
      decisionType: decision.type,
      failedDetails: decision.data?.failedDetails
    });

    // ========== 🔴 新增：记录 Agent B 的交互（FAILED） ==========
    // 🔴🔴🔴 直接传入 decision 对象，而不是包装对象！
    await this.recordAgentInteraction(
      task.commandResultId,
      task.orderIndex,
      'agent B',
      executorResult,  // requestContent: Agent B 收到的请求（执行Agent的结果）
      'FAILED',        // responseStatus
      decision,         // responseContent: 直接传入 decision 对象！
      task.id,
      iteration
    );
    console.log('[SubtaskEngine] ✅ Agent B FAILED 交互记录完成');

    // ========== 更新任务状态为waiting_user ==========
    const userMessage = `Agent B 判定当前情况需要您的协助：${decision.data?.failedDetails?.errorMessage || decision.reasoning || '请查看详情后决定下一步操作'}`;
    console.log('[SubtaskEngine] 🔴 调用 markTaskWaitingUser:', userMessage);
    await this.markTaskWaitingUser(task, userMessage);
    console.log('[SubtaskEngine] ✅ handleFailedDecision 完成');
  }

  /**
   * 处理超过最大迭代次数
   */
  public async handleMaxIterationsExceeded(
    task: typeof agentSubTasks.$inferSelect,
    executorResult: ExecutorAgentResult,
    mcpExecutionHistory: McpAttempt[],
    userInteractions: UserInteraction[],
    iteration: number
  ) {
    console.log('[SubtaskEngine] 🔴🔴🔴 处理超过最大迭代次数 🔴🔴🔴');



    // ========== 更新任务状态为waiting_user ==========
    const userMessage = '任务已执行 ' + iteration + ' 次迭代仍在进行中，请您查看当前状态后决定下一步操作';
    console.log('[SubtaskEngine] 🔴 调用 markTaskWaitingUser:', userMessage);
    await this.markTaskWaitingUser(task, userMessage);
    console.log('[SubtaskEngine] ✅ handleMaxIterationsExceeded 完成');
  }



  public async queryCapabilityList(capabilityType?: string) {
    if (capabilityType) {
      return await db
        .select()
        .from(capabilityList)
        .where(
          and(
            eq(capabilityList.status, 'available'),
            eq(capabilityList.capabilityType, capabilityType)
          )
        );
    }
    return await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.status, 'available'));
  }

  /**
   * 🔴 【简化】直接调用执行Agent处理任务
   * 前序内容获取已统一在内部处理
   */
  private async callExecutorAgentDirectly(
    task: typeof agentSubTasks.$inferSelect
  ): Promise<ExecutorDirectResult> {
    const callStartAt = getCurrentBeijingTime();
    let callPhase = 'init';
    
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│          [执行Agent调用追踪] 开始调用                        │');
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log('[执行Agent调用] 基础信息:', {
      task_id: task.id,
      order_index: task.orderIndex,
      executor: task.fromParentsExecutor,
      task_title: task.taskTitle,
      // 🔴 注：前序内容获取已统一在内部处理，这里不再单独记录
      called_at: callStartAt.toISOString()
    });
    
    try {
      // ========== 阶段1：加载提示词 ==========
      callPhase = 'load_prompt';
      console.log('[执行Agent调用] [阶段1/4] 加载Agent系统提示词');
      
      // 🔴🔴🔴 B5修复：写作 Agent 使用 PromptAssemblerService 动态拼接
      // 其他 Agent 仍使用传统的 loadAgentPrompt
      const _isWritingAgent = isWritingAgent(task.fromParentsExecutor);
      // 🔴🔴🔴 P0 修复：deai-optimizer 使用高质量模型，需要同样的长超时
      const _needsLongTimeout = _isWritingAgent || task.fromParentsExecutor === 'deai-optimizer';
      const isInsuranceD = task.fromParentsExecutor === 'insurance-d'; // 公众号特有逻辑（自动上传等）
      const isInsuranceXhs = task.fromParentsExecutor === 'insurance-xiaohongshu'; // 小红书特有逻辑标识
      
      let agentPrompt: string;
      // N2修复：写作 Agent 的完整组装结果，供阶段2拆分使用（避免双重调用）
      let insuranceDAssembledResult: Awaited<ReturnType<typeof promptAssemblerService.assemblePrompt>> | null = null;
      
      if (_isWritingAgent) {
        // 写作 Agent: 使用 PromptAssemblerService 组装提示词（仅调用一次）
        const executorType = task.fromParentsExecutor;
        console.log(`[执行Agent调用] ${executorType} 检测到，使用 PromptAssemblerService 动态拼接提示词`);
        
        // 先获取执行上下文（需要 userOpinionAndMaterials 来构建完整的组装参数）
        // 注意：这里提前获取 capabilities 和 executionContext，与原逻辑顺序一致
        const _capabilities = await this.queryCapabilityList();
        const _execCtx = await this.buildExecutionContext(
          task, null, _capabilities, 1, 5
        );
        const { userOpinionAndMaterials: _userOpinionAndMaterials, priorStepOutput: _priorStepOutput, extractedOutline: _extractedOutline } = _execCtx;
        
        // 构建素材内容文本
        const _materialsContent = _userOpinionAndMaterials?.materials && _userOpinionAndMaterials.materials.length > 0
          ? _userOpinionAndMaterials.materials.map(m => `--- 素材：${m.title}（${m.type}）---\n来源：${m.sourceDesc || '未标注'}\n内容：\n${m.content}`).join('\n\n')
          : undefined;
        
        // 单次调用 assemblePrompt
        // Phase 3: 如果是全文子任务(B)，传入已确认的大纲内容
        const taskExtension = task as InsuranceDTaskExtension;
        
        // 🔥 Phase 3.5: 获取 subTaskRole 用于提示词注入
        // 🔴🔴🔴 【修复】subTaskRole 存储在 resultData 中，不是顶层字段！
        const taskResultData = task.resultData as { subTaskRole?: 'outline_generation' | 'full_article' } | null;
        const taskSubTaskRole = taskResultData?.subTaskRole;
        
        // 🔧 修复：isFullArticleTask 判断优先使用 resultData 中的 subTaskRole，再检查任务标题
        const isFullArticleTask = 
          taskSubTaskRole === 'full_article' ||
          task.taskTitle?.includes('根据确认大纲生成全文');

        // 🔥🔥🔥 【统一修复】使用 buildExecutionContext 统一提取的 outline
        // 所有前序内容提取逻辑已统一到 buildExecutionContext 中
        // 优先级：metadata.confirmedOutline > task.userOpinion > 前序大纲任务 result_text
        const _confirmedOutline = _extractedOutline;
        
        // Phase 3 安全检查：全文子任务必须携带 confirmedOutline
        if (isFullArticleTask && !_confirmedOutline) {
          console.warn(
            '[SubtaskEngine] 📋 [Phase3] ⚠️ 全文子任务缺少 confirmedOutline，将使用原始指令执行（可能未经过用户大纲确认）',
            { task_id: task.id, orderIndex: task.orderIndex, taskTitle: task.taskTitle }
          );
        }

        // 🔥 多平台发布：为 insurance-d 注入平台上下文前缀
        // insurance-xiaohongshu 不需要平台前缀（平台规则已内置到提示词中）
        // P1-S06 修复：提前获取模板ID，检查是否存在 image_structure 规则，用于精简静态 GUIDELINES 重复内容
        const taskMetadata = task.metadata as Record<string, any> | null;
        const _templateIdForPlatform = await this.getTemplateIdForTask(task);
        let _hasImageStructureRules = false;
        if (_templateIdForPlatform && taskMetadata?.platformLabel === '小红书' && isInsuranceD) {
          try {
            const { digitalAssetService } = await import('./digital-asset-service');
            const _rules = await digitalAssetService.listStyleRules(_templateIdForPlatform);
            _hasImageStructureRules = _rules.some(r => r.ruleType === 'image_structure');
          } catch (e) {
            // 静默失败，不影响主流程
          }
        }
        // insurance-xiaohongshu 不注入平台前缀（规则已内置）
        const platformPrefix = isInsuranceXhs ? '' : buildPlatformContextPrefix(
          taskMetadata?.platformLabel || '',
          taskMetadata?.platformGroupTotal || 1,
          { hasImageStructureRules: _hasImageStructureRules }
        );

        // 🔥🔥🔥 两阶段架构：适配模式前缀
        // 如果当前任务是适配组（metadata.phase === 'platform_adaptation'），
        // 追加"平台适配模式"指令，要求基于基础文章改写
        let adaptationModePrefix = '';
        if (taskMetadata?.phase === 'platform_adaptation') {
          const adaptationPlatform = taskMetadata.adaptationPlatform || taskMetadata.platform || '';
          const platformLabel = taskMetadata.platformLabel || adaptationPlatform;
          adaptationModePrefix = `\n【平台适配模式 - 最高优先级指令】\n你正在执行"平台适配"任务。基础文章已完成定稿，你需要基于基础文章的内容进行平台适配改写。\n核心规则：\n1. 必须基于基础文章内容改写，不得自行创作新的核心论点、数据或案例\n2. 保留基础文章的核心观点和逻辑结构\n3. 按照${platformLabel}平台风格和格式进行改写\n4. 可以调整表达方式、段落结构、用词风格以适应平台特点\n5. 基础文章内容已在"前序任务执行结果"中提供（order_index=0 的"基础文章"条目）\n\n`;
          console.log('[SubtaskEngine] 🔥 适配模式前缀已注入，平台:', platformLabel);
        }

        // 🔥🔥🔥 【P0修复】提前读取内容模板，获取 cardCountMode 和 promptInstruction
        // cardCountMode 优先级：1. 内容模板的 cardCountMode  2. metadata 中的 imageCountMode（兼容旧数据）3. 小红书默认 5-card
        const VALID_CARD_COUNT_MODES = ['3-card', '5-card', '7-card'] as const;
        type CardCountMode = typeof VALID_CARD_COUNT_MODES[number];
        
        let _contentTpl: any = null;
        let _contentTemplateService: any = null;
        let _derivedCardCountMode: CardCountMode | undefined = taskMetadata?.imageCountMode as CardCountMode | undefined;

        if (taskMetadata?.contentTemplateId) {
          try {
            const { contentTemplateService } = await import('./content-template-service');
            _contentTemplateService = contentTemplateService;
            _contentTpl = await contentTemplateService.getTemplate(taskMetadata.contentTemplateId, task.workspaceId);
            // 🔥 从内容模板推导 cardCountMode（优先级高于 metadata.imageCountMode）
            if (_contentTpl?.cardCountMode && VALID_CARD_COUNT_MODES.includes(_contentTpl.cardCountMode as CardCountMode)) {
              _derivedCardCountMode = _contentTpl.cardCountMode as CardCountMode;
              console.log('[SubtaskEngine] 📋 从内容模板获取 cardCountMode:', _derivedCardCountMode);
            }
          } catch (_tplErr) {
            console.warn('[SubtaskEngine] ⚠️ 读取内容模板失败:', _tplErr);
          }
        }

        // 🔥🔥🔥 【P0修复】小红书平台默认使用 5-card 详尽模式
        // 如果没有指定 cardCountMode，且执行者是小红书 Agent，默认使用 5-card
        if (!_derivedCardCountMode && task.fromParentsExecutor === 'insurance-xiaohongshu') {
          _derivedCardCountMode = '5-card';
          console.log('[SubtaskEngine] 📋 小红书平台默认使用 5-card 详尽模式');
        }

        // 🔥🔥🔥 行业案例库：优先用户选择，其次自动推荐
        // 1. 用户在前端「案例引用」tab 选择了案例 → 使用用户选择的案例（最高优先级）
        // 2. 用户未选择 → 根据任务指令自动推荐相关案例
        // 3. 无匹配 → 跳过注入，不污染提示词
        let _industryCasesText = '';
        try {
          const { industryCaseService } = await import('./industry-case-service');
          const _metadata = (task as any).metadata || {};
          const _userCaseIds: string[] = _metadata.caseIds || [];

          if (_userCaseIds.length > 0) {
            // 优先：用户手动选择的案例——直接按 ID 查询，不依赖 searchCases 的热门排序
            const _selectedCases = await industryCaseService.getCasesByIds(_userCaseIds);
            if (_selectedCases.length > 0) {
              _industryCasesText = industryCaseService.formatCasesForPrompt(_selectedCases, 'manual');
              console.log('[SubtaskEngine] 📚 用户选择案例:', _selectedCases.length, '条');
            } else {
              console.log('[SubtaskEngine] 📚 用户选择案例ID未命中数据库，降级为自动推荐');
            }
          }

          if (!_industryCasesText) {
            // 兜底：根据任务指令自动推荐
            const _caseInstruction = task.taskDescription || '';
            if (_caseInstruction.length > 5) {
              const _matchedCases = await industryCaseService.recommendCases(
                _caseInstruction,
                task.fromParentsExecutor === 'insurance-xiaohongshu' ? 'xiaohongshu' : undefined
              );
              if (_matchedCases.length > 0) {
                _industryCasesText = industryCaseService.formatCasesForPrompt(_matchedCases, 'auto');
                console.log('[SubtaskEngine] 📚 自动推荐案例:', _matchedCases.length, '条');
              } else {
                console.log('[SubtaskEngine] 📚 自动推荐无匹配结果，跳过注入');
              }
            }
          }
        } catch (_caseErr) {
          console.warn('[SubtaskEngine] 📚 行业案例检索失败（不影响主流程）:', _caseErr);
        }

        insuranceDAssembledResult = await promptAssemblerService.assemblePrompt({
          workspaceId: task.workspaceId || undefined,
          executorType, // 🔥 传递 executorType 决定加载哪个提示词文件
          subTaskRole: taskSubTaskRole, // 🔥 Phase 3.5: 传递子任务角色（outline_generation / full_article）
          taskInstruction: isFullArticleTask && _confirmedOutline
            ? `${adaptationModePrefix}${platformPrefix}【已确认的创作大纲（必须严格按照此大纲展开写作）】\n\n${_confirmedOutline}\n\n原始创作指令：${task.taskDescription}`
            : `${adaptationModePrefix}${platformPrefix}${task.taskDescription || ''}`,
          userOpinion: _userOpinionAndMaterials?.userOpinion ?? task.userOpinion,
          materials: _materialsContent ? [_materialsContent] : undefined,
          targetWordCount: taskExtension.targetWordCount,
          // 🔥🔥🔥 【修复】直接使用 task 的结构字段（schema 已定义 structureName/structureDetail）
          structureName: task.structureName || undefined,
          structureDetail: task.structureDetail || undefined,
          confirmedOutline: _confirmedOutline, // 🔧 修复：使用统一提取的 confirmedOutline
          relatedMaterials: _userOpinionAndMaterials?.relatedMaterials, // 🔥 关联素材补充区
          // 🔥 Phase 5.5: 支持账号绑定风格模板（复用上面已查询的 templateId）
          templateId: _templateIdForPlatform,
          // 🔴 前序步骤执行结果（大纲/调研/合规校验等，由 buildExecutionContext 构建）
          priorStepOutput: _priorStepOutput || undefined,
          // 🔥🔥🔥 【P0修复】传递小红书卡片数量模式（优先从内容模板读取，兼容旧数据）
          cardCountMode: _derivedCardCountMode,
          // 🔥🔥🔥 行业案例库：按需检索的预格式化文本（由上方逻辑检索后传入）
          industryCases: _industryCasesText || undefined,
        });

        agentPrompt = insuranceDAssembledResult.fixedBasePrompt; // 固定基础部分作为 agentPrompt

        // 🔥🔥 Phase 2-2: 注入内容模板精简指令到 insurance-d Prompt
        // 注意：必须在 agentPrompt 赋值之后，否则会被覆盖
        if (_contentTpl?.promptInstruction) {
          // 将精简指令追加到 agentPrompt 末尾（作为最高优先级图文分工指导）
          // 内容模板指令与用户观点不互斥，两者叠加注入
          const _templateInstruction = `\n\n【📝 图文分工模板（来自参考笔记分析）】\n${_contentTpl.promptInstruction}\n请严格按照此分工规则分配图片内容和正文内容。`;
          agentPrompt = agentPrompt + _templateInstruction;
          // 记录使用次数
          if (taskMetadata?.contentTemplateId && _contentTemplateService) {
            _contentTemplateService.recordUse(taskMetadata.contentTemplateId).catch(() => {});
          }
          console.log('[SubtaskEngine] 📝 已注入内容模板精简指令到insurance-d Prompt:', _contentTpl.promptInstruction);
        }

        // Phase 6: inject platform-specific config into insurance-d Prompt
        // Each platform account can have its own style parameters
        if (taskMetadata?.accountId || taskMetadata?.accountIds?.length) {
          try {
            const { styleTemplateService } = await import('./style-template-service');
            const _accountId = taskMetadata.accountId ||
              (taskMetadata.multiPlatformGroupId && taskMetadata.accountIds?.[taskMetadata.platformGroupIndex || 0]) ||
              taskMetadata.accountIds?.[0];

            if (_accountId) {
              const _platformConfigText = await styleTemplateService.formatPlatformConfigForPrompt(_accountId, task.workspaceId);
              if (_platformConfigText) {
                agentPrompt = agentPrompt + `\n\n${_platformConfigText}\n请按照以上平台专属配置调整写作风格。`;
                console.log('[SubtaskEngine] platform config injected, accountId:', _accountId);
              }
            }
          } catch (_pcErr) {
            console.warn('[SubtaskEngine] platform config injection failed:', _pcErr);
          }
        }

        console.log('[SubtaskEngine] PromptAssemblerService assembled (single call):', {
          rule_count: insuranceDAssembledResult.assemblyMetadata.ruleCount,
          style_rule_count: insuranceDAssembledResult.assemblyMetadata.styleRuleCount,
          has_core_anchor: insuranceDAssembledResult.assemblyMetadata.hasCoreAnchor,
          has_user_opinion: insuranceDAssembledResult.assemblyMetadata.hasUserOpinion,
          material_count: insuranceDAssembledResult.assemblyMetadata.materialCount,
          has_industry_cases: insuranceDAssembledResult.assemblyMetadata.hasIndustryCases, // 🔥 行业案例
        });
      } else {
        agentPrompt = loadAgentPrompt(task.fromParentsExecutor);
      }
      
      console.log('[执行Agent调用] [阶段1/4] ✅ 系统提示词加载成功:', {
        prompt_length: agentPrompt.length,
        prompt_preview: agentPrompt.substring(0, 100) + '...'
      });
      
      // ========== 阶段2：构建完整提示词 ==========
      callPhase = 'build_prompt';
      console.log('[执行Agent调用] [阶段2/4] 构建完整提示词');
      
      // 🔥🔥🔥 【优化】使用 buildExecutionContext 统一获取执行上下文
      console.log('[执行Agent调用] 🔄 使用 buildExecutionContext 统一获取执行上下文...');
      
      // 获取可用能力列表
      const capabilities = await this.queryCapabilityList();
      
      // 调用 buildExecutionContext 获取完整上下文
      const executionContext = await this.buildExecutionContext(
        task,
        null,  // executorResult - 当前还没有执行结果
        capabilities,
        1,     // currentIteration
        5      // maxIterations
      );
      
      // 从上下文中提取需要的信息
      const { 
        priorStepOutput, 
        mcpExecutionHistory, 
        userFeedback, 
        latestUserDecision,
        bossOrder,
        bossOrderInstruction,
        userOpinionAndMaterials  // 🔥 新增：用户观点和素材
      } = executionContext;
      
      console.log('[执行Agent调用] ✅ 执行上下文获取完成:', {
        has_prior_step_output: !!priorStepOutput && priorStepOutput.length > 0,
        prior_step_output_length: priorStepOutput?.length || 0,
        mcp_history_count: mcpExecutionHistory?.length || 0,
        has_user_feedback: !!userFeedback,
        has_latest_user_decision: !!latestUserDecision,
        has_boss_order: !!bossOrder,
        has_user_opinion: !!userOpinionAndMaterials?.userOpinion,
        has_materials: !!(userOpinionAndMaterials?.materials && userOpinionAndMaterials.materials.length > 0),
        materials_count: userOpinionAndMaterials?.materials?.length || 0,
        prior_step_output_preview: priorStepOutput ? priorStepOutput.substring(0, 200) + '...' : '(empty)'
      });
      
      // 🔥🔥🔥 【新增】构建用户观点和素材文本
      // N2修复：insurance-d 直接复用阶段1的单次组装结果，不再重复调用
      let userOpinionAndMaterialsText = '';
      
      if (isInsuranceD && insuranceDAssembledResult) {
        // insurance-d 专属：直接从已组装结果中提取动态规则+当前创作需求
        userOpinionAndMaterialsText = insuranceDAssembledResult.userExclusiveRules.formattedText + '\n' 
          + insuranceDAssembledResult.styleRules.formattedText + '\n'
          + insuranceDAssembledResult.currentTask;
        
        console.log('[执行Agent调用] ✅ insurance-d 动态提示词复用（无重复调用）:', {
          rules_count: insuranceDAssembledResult.assemblyMetadata.ruleCount,
          style_rules_count: insuranceDAssembledResult.assemblyMetadata.styleRuleCount,
          has_user_opinion: insuranceDAssembledResult.assemblyMetadata.hasUserOpinion,
          material_count: insuranceDAssembledResult.assemblyMetadata.materialCount,
        });
      } else if (userOpinionAndMaterials) {
        // 其他 Agent：原有手动拼接逻辑
        const { userOpinion, materials } = userOpinionAndMaterials;
        
        if (userOpinion) {
          userOpinionAndMaterialsText += `
【🔥 用户核心观点（最高优先级！必须遵守！）】
${userOpinion}

⚠️ 重要提示：
- 用户的观点是文章的灵魂，必须作为核心论点贯穿全文
- 文章的立场、结论必须与用户观点一致
- 在文章开头或结尾明确阐述用户观点
`;
        }
        
        if (materials && materials.length > 0) {
          userOpinionAndMaterialsText += `
【🔥 用户提供的素材（必须使用！）】
`;
          materials.forEach((material, index) => {
            const typeLabels: Record<string, string> = {
              'case': '案例',
              'data': '数据',
              'story': '故事',
              'quote': '引用',
              'opening': '开头',
              'ending': '结尾'
            };
            const typeLabel = typeLabels[material.type] || material.type;
            
            userOpinionAndMaterialsText += `
--- 素材 ${index + 1}：${material.title}（${typeLabel}）---
来源：${material.sourceDesc || '未标注'}
内容：
${material.content}

`;
          });
          
          userOpinionAndMaterialsText += `
⚠️ 素材使用规则：
- 必须在文章中使用用户提供的素材
- 素材中的案例、数据必须原样引用，不得篡改
- 保持文章流畅性，自然融入素材
`;
        }
      }
      
      // 构建前序任务输出文本
      let previousResultText = '';
      if (priorStepOutput && priorStepOutput.length > 0) {
        previousResultText = `
【前序任务输出】
${priorStepOutput}
`;
      }
      
      // 构建 MCP 执行历史文本（如果有）
      let mcpHistoryText = '';
      if (mcpExecutionHistory && mcpExecutionHistory.length > 0) {
        mcpHistoryText = `
【MCP 执行历史】
共 ${mcpExecutionHistory.length} 条执行记录：
${mcpExecutionHistory.map((mcp, idx) => `
${idx + 1}. 工具: ${mcp.decision.toolName}, 动作: ${mcp.decision.actionName}
   状态: ${mcp.result.status}
   ${mcp.result.data ? '结果数据: ' + JSON.stringify(mcp.result.data).substring(0, 500) : ''}
   ${mcp.result.error ? '错误: ' + mcp.result.error.message : ''}
`).join('')}
`;
      }
      
      // 构建用户反馈文本
      let userFeedbackText = '';
      if (userFeedback) {
        userFeedbackText = `
【⚠️ 用户反馈 - 请务必重视！⚠️】
- 反馈类型: ${userFeedback.feedbackType || 'user_interaction'}
- 用户输入: ${userFeedback.userInput || ''}
- 反馈时间: ${userFeedback.feedbackTime}
- 执行建议: ${userFeedback.executionSuggestion || ''}
【重要提示】
- 用户的反馈是最高优先级的决策依据
- 请务必认真对待用户的反馈和决定
`;
      }
      
      // 🔴 构建完整提示词：Agent系统提示词 + 功能提示词 + 上下文信息 + 任务内容
      const fullPrompt = `${agentPrompt}

${loadFeaturePrompt('executor-standard-result')}

${userOpinionAndMaterialsText}
${bossOrderInstruction}
${previousResultText}
${mcpHistoryText}
${userFeedbackText}
【当前任务】
任务标题：${task.taskTitle}
任务描述：${task.taskDescription}
`;
      
      console.log('[执行Agent调用] [阶段2/4] ✅ 完整提示词构建成功:', {
        full_prompt_length: fullPrompt.length,
        has_prior_step_output: !!priorStepOutput && priorStepOutput.length > 0,
        has_mcp_history: mcpExecutionHistory && mcpExecutionHistory.length > 0,
        has_user_feedback: !!userFeedback,
        has_boss_order: !!bossOrder
      });
      
      // 🔴🔴🔴 新增：打印完整提示词内容，便于调试
      console.log('');
      console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
      console.log('│          [执行Agent调用] 完整提示词内容 (传递给 ' + task.fromParentsExecutor + ')    │');
      console.log('└─────────────────────────────────────────────────────────────────────────────┘');
      console.log('[完整提示词开始] ====================');
      console.log(fullPrompt);
      console.log('[完整提示词结束] ====================');
      console.log('');
      
      // ========== 阶段3：调用 LLM ==========
      callPhase = 'call_llm';
      console.log('[执行Agent调用] [阶段3/4] 调用 LLM');
      console.log('[执行Agent调用] LLM调用开始时间:', getCurrentBeijingTime().toISOString());
      
      const llmStartAt = getCurrentBeijingTime();
      // 🔴🔴🔴 写作 Agent + deai-optimizer 超时修复：
      // doubao-seed-2-0-pro-260215 模型正常响应 65-80 秒，60s 超时必然失败
      // 使用高质量模型的 Agent 需要 180s 超时（与 Agent B 一致），其他 Agent 保持 60s
      const _llmTimeout = _needsLongTimeout ? 180000 : 60000;
      const response = await callLLM(
        task.fromParentsExecutor,
        '直接执行任务',
        agentPrompt,
        fullPrompt,
        { workspaceId: task.workspaceId || undefined, timeout: _llmTimeout }
      );
      const llmEndAt = getCurrentBeijingTime();
      
      console.log('[执行Agent调用] [阶段3/4] ✅ LLM调用完成:', {
        llm_call_duration_ms: llmEndAt.getTime() - llmStartAt.getTime(),
        response_length: response.length,
        response_preview: response.substring(0, 200) + '...',
        llm_started_at: llmStartAt.toISOString(),
        llm_ended_at: llmEndAt.toISOString()
      });
      
      // 🔴 新增：记录完整的原始响应，便于调试解析失败问题
      console.log('[执行Agent调用] 🔴 完整原始响应内容:', {
        task_id: task.id,
        executor: task.fromParentsExecutor,
        full_response_length: response.length,
        full_response_content: response
      });
      
      // ========== 阶段4：解析结果 ==========
      callPhase = 'parse_response';
      console.log('[执行Agent调用] [阶段4/4] 解析LLM响应');
      
      const parsedResult = this.parseExecutorResponse(response);
      
      console.log('[执行Agent调用] [阶段4/4] ✅ 响应解析完成:', {
        is_completed: parsedResult.isCompleted,
        has_result: parsedResult.result !== null && parsedResult.result !== undefined,
        has_suggestion: parsedResult.suggestion !== null && parsedResult.suggestion !== undefined,
        result_preview: parsedResult.result ? 
          (typeof parsedResult.result === 'string' ? 
            parsedResult.result.substring(0, 100) + '...' : 
            JSON.stringify(parsedResult.result).substring(0, 100) + '...') : 
          null,
        suggestion_preview: parsedResult.suggestion ? 
          parsedResult.suggestion.substring(0, 100) + '...' : 
          null
      });
      
      const callEndAt = getCurrentBeijingTime();
      console.log('');
      console.log('┌─────────────────────────────────────────────────────────────┐');
      console.log('│          [执行Agent调用追踪] 调用成功                        │');
      console.log('└─────────────────────────────────────────────────────────────┘');
      console.log('[执行Agent调用] 调用总结:', {
        task_id: task.id,
        success: true,
        total_duration_ms: callEndAt.getTime() - callStartAt.getTime(),
        phases: ['load_prompt', 'build_prompt', 'call_llm', 'parse_response'],
        completed_phases: 4,
        final_result: {
          is_completed: parsedResult.isCompleted
        }
      });
      console.log('');
      
      return parsedResult;
      
    } catch (error) {
      const errorAt = getCurrentBeijingTime();
      console.error('');
      console.error('┌─────────────────────────────────────────────────────────────┐');
      console.error('│          [执行Agent调用追踪] ❌ 调用失败                     │');
      console.error('└─────────────────────────────────────────────────────────────┘');
      console.error('[执行Agent调用] 失败详情:', {
        task_id: task.id,
        failed_at_phase: callPhase,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
        started_at: callStartAt.toISOString(),
        failed_at: errorAt.toISOString(),
        duration_ms: errorAt.getTime() - callStartAt.getTime()
      });
      console.error('');
      
      return {
        isCompleted: false,
        suggestion: `执行Agent处理时发生错误 (阶段: ${callPhase}): ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 解析执行Agent的响应
   */
  private parseExecutorResponse(response: string): ExecutorDirectResult {
    const parseStartAt = getCurrentBeijingTime();
    
    console.log('');
    console.log('  [响应解析追踪] ──────────────────────────────────────────────');
    console.log('  [响应解析] 开始解析LLM响应');
    console.log('  [响应解析] 响应基础信息:', {
      response_length: response.length,
      response_first_50_chars: response.substring(0, 50),
      parse_started_at: parseStartAt.toISOString()
    });
    
    try {
      // 🔴 重构：使用统一的 Agent 响应解析器！
      console.log('  [响应解析] 步骤1/3: 使用统一解析器解析执行Agent输出');
      const parseResult = AgentResponseParser.parseExecutorResponse(response);
      
      console.log('  [响应解析] 增强解析结果:', {
        success: parseResult.success,
        has_data: !!parseResult.data,
        error: parseResult.error,
        warnings_count: parseResult.warnings?.length || 0
      });
      
      if (parseResult.success) {
        const parsed = parseResult.data;
        
        console.log('  [响应解析] JSON解析成功（增强方式）:', {
          parsed_type: typeof parsed,
          is_object: typeof parsed === 'object' && parsed !== null,
          has_isCompleted: 'isCompleted' in parsed,
          has_result: 'result' in parsed,
          has_suggestion: 'suggestion' in parsed,
          raw_parsed_preview: JSON.stringify(parsed).substring(0, 150) + '...'
        });
        
        if (parseResult.warnings && parseResult.warnings.length > 0) {
          console.log('  [响应解析] ⚠️ 解析警告：', parseResult.warnings);
        }
        
        // 步骤3：构建返回结果
        console.log('  [响应解析] 步骤3/3: 构建返回结果');
        
        // 🔴 新增：如果有 structuredResult，自动填充原有字段
        let result: ExecutorDirectResult = {
          isCompleted: parsed.isCompleted ?? false,
          result: parsed.result,
          suggestion: parsed.suggestion,
          // 🔴 新增：支持 output 字段（insurance-d 使用此字段）
          output: parsed.output,
          // 🔴🔴🔴 新增：支持 mcpParams 字段（场景2核心）
          needsMcpSupport: parsed.needsMcpSupport,
          mcpParams: parsed.mcpParams
        };
        
        // 🔴🔴🔴 新增：支持 v2 格式（isCompleted）
        // 如果 parsed 中有 isCompleted 字段，转换为 isCompleted
        if ('isCompleted' in parsed) {
          console.log('  [响应解析] 🔴 检测到 v2 格式 isCompleted 字段');
          result.isCompleted = parsed.isCompleted === true;
          
          // 如果 isCompleted = false，将 result 或 reason 放到 suggestion 中
          if (parsed.isCompleted === false) {
            if (parsed.result) {
              result.suggestion = parsed.result;
              console.log('  [响应解析] v2 格式：isCompleted=false，result=' + parsed.result);
            } else if (parsed.reason) {
              result.suggestion = parsed.reason;
              console.log('  [响应解析] v2 格式：isCompleted=false，reason=' + parsed.reason);
            }
          }
        }
        
        // 如果有 structuredResult，使用 fillLegacyFields 自动填充
        if (parsed.structuredResult) {
          result.structuredResult = parsed.structuredResult;
          result = fillLegacyFields(result);
          console.log('  [响应解析] ✅ 检测到 structuredResult，已自动填充原有字段');
        }
        
        console.log('  [响应解析] 最终结果构建完成:', {
          is_completed: result.isCompleted,
          has_result_value: result.result !== null && result.result !== undefined,
          has_suggestion_value: result.suggestion !== null && result.suggestion !== undefined,
          has_structured_result: hasStructuredResult(result),
          result_type: typeof result.result,
          suggestion_type: typeof result.suggestion
        });
        
        const parseEndAt = getCurrentBeijingTime();
        console.log('  [响应解析] ✅ 解析成功! 耗时:', parseEndAt.getTime() - parseStartAt.getTime(), 'ms');
        console.log('  [响应解析追踪] ──────────────────────────────────────────────');
        console.log('');
        
        return result;
      } else {
        console.warn('  [响应解析] ⚠️ 增强解析未找到JSON格式内容，尝试原方法');
        // 🔴 新增：兜底 - 如果增强解析失败，尝试原方法
        console.log('  [响应解析] 尝试原方法查找JSON');
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          console.log('  [响应解析] 原方法找到JSON，尝试解析');
          let parsed: any;
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (parseError) {
            console.warn('  [响应解析] ⚠️ 原方法JSON解析失败:', parseError);
            console.warn('  [响应解析] ⚠️ 匹配到的JSON内容:', jsonMatch[0].substring(0, 300));
            throw parseError;
          }
          
          let result: ExecutorDirectResult = {
            isCompleted: parsed.isCompleted ?? false,
            result: parsed.result,
            suggestion: parsed.suggestion,
            // 🔴 新增：支持 output 字段（insurance-d 使用此字段）
            output: parsed.output,
            // 🔴🔴🔴 新增：支持 mcpParams 字段（场景2核心）
            needsMcpSupport: parsed.needsMcpSupport,
            mcpParams: parsed.mcpParams
          };
          
          // 🔴🔴🔴 新增：支持 v2 格式（isCompleted）
          if ('isCompleted' in parsed) {
            console.log('  [响应解析] 🔴 兜底解析检测到 v2 格式 isCompleted 字段');
            result.isCompleted = parsed.isCompleted === true;
            if (parsed.isCompleted === false) {
              if (parsed.result) {
                result.suggestion = parsed.result;
              } else if (parsed.reason) {
                result.suggestion = parsed.reason;
              }
            }
          }
          
          if (parsed.structuredResult) {
            result.structuredResult = parsed.structuredResult;
            result = fillLegacyFields(result);
          }
          
          const parseEndAt = getCurrentBeijingTime();
          console.log('  [响应解析] ✅ 原方法解析成功! 耗时:', parseEndAt.getTime() - parseStartAt.getTime(), 'ms');
          return result;
        } else {
          console.warn('  [响应解析] ⚠️ 未找到JSON格式内容');
          console.warn('  [响应解析] 🔴 完整原始响应内容:', {
            response_length: response.length,
            full_response_content: response
          });
        }
      }
    } catch (e) {
      console.error('  [响应解析] ❌ 解析失败!');
      console.error('  [响应解析] 🔴 完整原始响应内容:', {
        response_length: response.length,
        full_response_content: response
      });
      console.error('  [响应解析] 错误详情:', {
        error_message: e instanceof Error ? e.message : String(e),
        error_stack: e instanceof Error ? e.stack : undefined
      });
    }
    
    const parseEndAt = getCurrentBeijingTime();
    console.log('  [响应解析] ⚠️ 使用兜底结果: isCompleted=false, 需要帮助');
    console.log('  [响应解析] 解析耗时:', parseEndAt.getTime() - parseStartAt.getTime(), 'ms');
    console.log('  [响应解析追踪] ──────────────────────────────────────────────');
    console.log('');
    
    // 兜底：默认需要帮助
    return {
      isCompleted: false,
      suggestion: '无法解析执行Agent的响应'
    };
  }

  /**
   * ========== 公共方法：获取默认 accountId ==========
   */
  private getDefaultAccountId(fromParentsExecutor: string): string {
    if (isWritingAgent(fromParentsExecutor)) {
      return 'insurance-account';
    } else if (fromParentsExecutor === 'agent-d') {
      return 'ai-tech-account';
    }
    return 'insurance-account';
  }

  /**
   * ========== 公共方法：构建能力清单文本 ==========
   */
  private buildCapabilitiesText(capabilities: any[]): string {
    return capabilities.map(cap => 
'能力 ID: ' + cap.id + '\n' +
'功能描述: ' + cap.functionDesc + '\n' +
'能力类型: ' + cap.capabilityType + '\n' +
'工具名 (tool_name): ' + cap.toolName + '\n' +
'动作名 (action_name): ' + cap.actionName + '\n' +
'参数说明 (param_desc): ' + JSON.stringify(cap.paramDesc, null, 2) + '\n' +
'是否需要现场执行: ' + cap.requiresOnSiteExecution + '\n' +
'输出样例 (example_output): ' + (cap.example_output ? JSON.stringify(cap.example_output, null, 2) : '无')
    ).join('\n\n');
  }



  public async executeCapability(
    task: typeof agentSubTasks.$inferSelect,
    agentBOutput: AgentBOutput
  ) {
    console.log('[SubtaskEngine] ========== 执行 capability ==========');
    
    // 验证 action 类型
    if (agentBOutput.action !== 'EXECUTE_MCP') {
      console.error('[SubtaskEngine] executeCapability 被错误调用，action 不是 EXECUTE_MCP');
      return { 
        success: false, 
        error: 'Invalid action: expected EXECUTE_MCP',
        executionMode: 'direct'
      };
    }

    // 验证必需字段
    if (!agentBOutput.toolName || !agentBOutput.actionName) {
      console.error('[SubtaskEngine] executeCapability 缺少必需字段: toolName 或 actionName');
      return { 
        success: false, 
        error: 'Missing required fields: toolName or actionName',
        executionMode: 'direct'
      };
    }

    console.log('📥 [executeCapability][入口参数] 输入:', {
      taskId: task.id,
      solutionNum: agentBOutput.solutionNum,
      toolName: agentBOutput.toolName,
      actionName: agentBOutput.actionName,
      params: agentBOutput.params,
    });

    try {
      console.log('⚡ [executeCapability] 直接调用 genericMCPCall:', {
        tool: agentBOutput.toolName,
        action: agentBOutput.actionName,
        params: agentBOutput.params,
      });

      const mcpResult = await genericMCPCall(
        agentBOutput.toolName,
        agentBOutput.actionName,
        agentBOutput.params || {}
      );

      console.log('📤 MCP 执行结果:', mcpResult);
      
      return {
        success: true,
        executionMode: 'direct',
        insuranceDAnalysis: {
          isNeedMcp: true,
          problem: task.taskTitle,
          domainScene: '通用场景',
          capabilityType: agentBOutput.toolName ? 'platform_publish' : 'search',
          creationSuggestion: '根据任务需求调用对应功能描述执行操作',
        },
        agentBParams: {
          apiAddress: agentBOutput.toolName + '/' + agentBOutput.actionName,
          params: agentBOutput.params,
          riskTips: '请确保参数符合业务规则',
          capabilityUpgradeSuggestion: '建议积累更多案例优化参数模板',
        },
        mcpResult,
      };
    } catch (error) {
      console.error('❌ [executeCapability][失败] 执行 capability 失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '执行失败',
        executionMode: 'direct',
        mcpResult: { success: false, error: error instanceof Error ? error.message : '执行失败' }
      };
    }
  }

  /**
   * sendBackToExecutor 方法
   * @description 用于 Agent B 决策 REEXECUTE_EXECUTOR 场景，让执行Agent重新执行
   * @note 此方法与场景2（直接MCP执行）无关，场景2使用 buildExecutionContext
   * @note 此方法接收 mcpExecutionHistory 参数，但 latestMcpResult 固定为 null，这是历史遗留问题
   * @important 场景2的MCP结果传递由 buildExecutionContext + mcpExecutionHistory 统一处理
   */
  public async sendBackToExecutor(
    task: typeof agentSubTasks.$inferSelect,
    executorResult: ExecutorAgentResult,
    agentBDecision: AgentBDecision | undefined,
    mcpResult: any,
    mcpExecutionHistory: McpAttempt[] = [],
    userInteractions: UserInteraction[] = [],
    allTasksInGroup: typeof agentSubTasks.$inferSelect[] = []
  ): Promise<any> {
    console.log('[SubtaskEngine] 返回给执行Agent继续执行')
    const latestMcpResult = null;

    // 2. 获取当前任务的最新用户反馈
    const latestUserFeedback = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex),
          eq(agentSubTasksStepHistory.interactUser, 'human'),
          eq(agentSubTasksStepHistory.interactType, 'response')
        )
      )
      .orderBy(desc(agentSubTasksStepHistory.interactTime))
      .limit(1)
      .then(r => r[0] || null);
    
    const userFeedbackContent = latestUserFeedback 
      ? (latestUserFeedback.interactContent as any)?.userDecision || 
        (latestUserFeedback.interactContent as any)?.interactionData?.notes || 
        JSON.stringify(latestUserFeedback.interactContent)
      : null;
    
    console.log('[SubtaskEngine] 🔴 当前任务最新用户反馈:', userFeedbackContent ? '有' : '无');

    // 3. 智能选择必要的前序任务信息
    let selectedPrecedentInfo = '';
    try {
      const { PrecedentInfoFetcher } = await import('./precedent-info-fetcher');
      const fetcher = PrecedentInfoFetcher.getInstance();
      
      const fetcherResult = await fetcher.fetchPrecedentInfo(task, allTasksInGroup, {
        strategy: 'llm-with-fallback',
        enableFallback: true
      });
      
      selectedPrecedentInfo = fetcherResult.infoText;
      console.log('[SubtaskEngine] ✅ 智能选择前序信息成功，长度:', selectedPrecedentInfo.length);
    } catch (error) {
      console.warn('[SubtaskEngine] ⚠️  智能选择前序信息失败，使用空字符串:', error);
      selectedPrecedentInfo = '';
    }

    // ========== 🔴 构建精简的 prompt ==========
    const prompt = `
【当前任务】
任务标题：${task.taskTitle}
任务描述：${task.taskDescription || '无'}

【最新MCP执行结果】⭐
${latestMcpResult ? 
  `工具：${latestMcpResult.toolName || '-'}/${latestMcpResult.actionName || '-'}
状态：${latestMcpResult.resultStatus}
${latestMcpResult.resultText ? '结果：' + latestMcpResult.resultText : ''}
${latestMcpResult.errorMessage ? '错误：' + latestMcpResult.errorMessage : ''}` : 
  '无MCP执行结果'}

【最新用户反馈】⭐
${userFeedbackContent || '无'}

【智能选择的必要信息】🟡
${selectedPrecedentInfo || '无相关前序任务'}

【Agent B 决策建议】⭐
${agentBDecision ? 
  `决策类型：${agentBDecision.type}
   决策理由：${agentBDecision.reasoning}
   建议操作：${agentBDecision.context?.suggestedAction || '无'}` : 
  '无Agent B决策建议'}

请根据以上信息继续执行任务，返回最终结果。
`;

    try {
      // 🔴 写作 Agent + deai-optimizer 超时修复：reExecution 路径也需要更长超时
      const _reExecTimeout = (isWritingAgent(task.fromParentsExecutor) || task.fromParentsExecutor === 'deai-optimizer') ? 180000 : 60000;
      const response = await callLLM(
        task.fromParentsExecutor,
        '继续执行任务',
        '你是 ' + task.fromParentsExecutor + '，请根据以上信息继续执行任务',
        prompt,
        { workspaceId: task.workspaceId || undefined, timeout: _reExecTimeout }
      );

      // ========== 🔴 记录执行 Agent 交互（正常情况） ==========
      console.log('[SubtaskEngine] 🔴 记录执行 Agent 交互（正常返回）');
      try {
        // 解析执行 Agent 的响应来确定状态
        let responseStatus: 'pre_completed' | 'pre_need_support' | 'pre_failed' = 'pre_completed';
        
        try {
          // 尝试解析响应来判断状态
          if (typeof response === 'string') {
            // 简单判断：如果包含"需要"、"帮助"、"支持"等关键词，判定为 need_support
            const lowerResponse = response.toLowerCase();
            if (lowerResponse.includes('需要') || 
                lowerResponse.includes('帮助') || 
                lowerResponse.includes('支持') ||
                lowerResponse.includes('无法') ||
                lowerResponse.includes('不能')) {
              responseStatus = 'pre_need_support';
            }
          }
        } catch (parseError) {
          console.warn('[SubtaskEngine] ⚠️  解析执行 Agent 响应失败，使用默认状态 pre_completed');
        }

        await this.recordAgentInteraction(
          task.commandResultId as string,
          task.orderIndex,
          task.fromParentsExecutor,
          {
            type: 'send_back_to_executor',
            originalProblem: executorResult.problem,
            agentBDecision,
            mcpResult,
            latestMcpResult,
            latestUserFeedback,
            prompt,
          },
          responseStatus,
          {
            finalResult: response,
          },
          task.id ? Number(task.id) : undefined
        );
        console.log('[SubtaskEngine] ✅ 执行 Agent 交互记录完成');
      } catch (recordError) {
        console.warn('[SubtaskEngine] ⚠️  记录执行 Agent 交互失败，不影响主流程:', recordError);
      }

      return { finalResult: response };
    } catch (error) {
      console.error('[SubtaskEngine] 返回给执行Agent失败:', error);

      // ========== 🔴 记录执行 Agent 交互（异常情况） ==========
      console.log('[SubtaskEngine] 🔴 记录执行 Agent 交互（异常情况）');
      try {
        await this.recordAgentInteraction(
          task.commandResultId as string,
          task.orderIndex,
          task.fromParentsExecutor,
          {
            type: 'send_back_to_executor',
            originalProblem: executorResult.problem,
            agentBDecision,
            mcpResult,
            latestMcpResult,
            latestUserFeedback,
            prompt,
          },
          'pre_failed',
          {
            error: error instanceof Error ? error.message : String(error),
            errorType: 'agent_execution_failed',
            timestamp: getCurrentBeijingTime().toISOString(),
          },
          task.id ? Number(task.id) : undefined
        );
        console.log('[SubtaskEngine] ✅ 执行 Agent 异常交互记录完成');
      } catch (recordError) {
        console.warn('[SubtaskEngine] ⚠️  记录执行 Agent 异常交互失败，不影响主流程:', recordError);
      }
      // ========== 🔴 新增结束 ==========

      return { finalResult: '执行完成', mcpResult };
    }
  }

  public async markTaskCompleted(
    task: typeof agentSubTasks.$inferSelect,
    result: any,
    retryCount: number = 0  // 新增：重试次数计数器
  ) {
    console.log('');
    console.log('[SubtaskEngine] markTaskCompleted 被调用', { retryCount });
    console.log('[SubtaskEngine] 任务信息:', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      currentStatus: task.status,
      fromParentsExecutor: task.fromParentsExecutor,
      taskTitle: task.taskTitle?.substring(0, 100),
      expectedUpdatedAt: task.updatedAt  // 🔒 乐观锁：记录期望的 updatedAt
    });

    // ⚠️  🔴 重要：检查当前状态，如果已经是 completed 或 cancelled，不再更新！
    if (task.status === 'completed' || task.status === 'cancelled') {
      console.warn('[SubtaskEngine] ⚠️  ⚠️  ⚠️  任务已结束，跳过 markTaskCompleted:', {
        taskId: task.id,
        currentStatus: task.status
      });
      return;
    }

    // 🔴 新增：更新 article_metadata（长期方案）
    let articleMetadata: ArticleMetadata | null = null;
    try {
      // 从 result 中提取 stepOutput
      let stepOutput = '';
      if (result && typeof result === 'object') {
        stepOutput = result.stepOutput || result.step_output || '';
      }

      // 判断是否为文章生成相关任务
      const isArticleTask = task.taskTitle.includes('文章') || 
                            task.taskTitle.includes('初稿') ||
                            task.taskTitle.includes('合规') ||
                            task.taskTitle.includes('审核') ||
                            isWritingAgent(task.fromParentsExecutor) ||
                            task.fromParentsExecutor === 'insurance-c';

      if (isArticleTask) {
        console.log('[SubtaskEngine] ========== 更新 article_metadata ==========');
        
        if (!task.articleMetadata || Object.keys(task.articleMetadata).length === 0) {
          // 第一次更新，创建初始 metadata
          console.log('[SubtaskEngine] 创建初始 article_metadata');
          articleMetadata = createInitialArticleMetadata({
            articleTitle: task.taskTitle,
            creatorAgent: task.fromParentsExecutor,
            taskType: 'article_generation',
            totalSteps: 4, // 我们当前是4步流程
          });
        } else {
          // 已有 metadata，更新它
          console.log('[SubtaskEngine] 更新现有 article_metadata');
          articleMetadata = updateArticleMetadataStep(
            task.articleMetadata as ArticleMetadata,
            {
              stepNo: task.orderIndex,
              stepStatus: 'success',
              stepOutput: stepOutput,
              confirmStatus: '已确认',
            }
          );
        }

        console.log('[SubtaskEngine] article_metadata 更新完成:', {
          stepNo: task.orderIndex,
          hasMetadata: !!articleMetadata,
        });
      }
    } catch (metadataError) {
      console.error('[SubtaskEngine] ❌ 更新 article_metadata 失败:', metadataError);
      // 不影响主流程
    }

    // 🔴 方案 B：生成 resultText
    let resultText = '';
    console.log('[SubtaskEngine] 🔴🔴🔴 ========== resultText 处理开始 ==========', {
      orderIndex: task.orderIndex,
      taskTitle: task.taskTitle?.substring(0, 100),
      resultType: typeof result,
      resultIsNull: result === null,
      resultIsUndefined: result === undefined
    });
    
    if (result && typeof result === 'object') {
      console.log('[SubtaskEngine] 🔴🔴🔴 result 对象字段:', Object.keys(result));
    }
    
    try {
      resultText = this.extractResultTextFromResultData(result, task.fromParentsExecutor);
      console.log('[SubtaskEngine] 🔴🔴🔴 extractResultTextFromResultData 执行完成', {
        resultTextLength: resultText.length,
        resultTextPreview: resultText.substring(0, 200)
      });
    } catch (extractError) {
      console.error('[SubtaskEngine] ❌ extractResultTextFromResultData 执行失败:', extractError);
      resultText = ''; // 兜底：空字符串
    }
    
    console.log('[SubtaskEngine] 🔴🔴🔴 最终 resultText 准备保存:', {
      orderIndex: task.orderIndex,
      resultTextLength: resultText.length,
      resultTextPreview: resultText.substring(0, 300)
    });
    console.log('[SubtaskEngine] 🔴🔴🔴 ========== resultText 处理结束 ==========');

    // 构建更新数据
    type UpdateAgentSubTaskData = Partial<typeof agentSubTasks.$inferInsert>;
    const updateData: UpdateAgentSubTaskData = {
      status: 'completed',
      resultData: result,  // 🔴 方案 B：直接传对象，不要 JSON.stringify
      resultText: resultText,  // 🔴 方案 B：保存文本化结果
      completedAt: getCurrentBeijingTime(),
      updatedAt: getCurrentBeijingTime(),
    };

    // 🔥🔥🔥 从写作 Agent 结果中提取 articleTitle，仅更新当前任务的 taskTitle
    // 注意：不再同步到同组其他子任务，避免覆盖"生成大纲"、"合规校验"等原始标题
    try {
      const extractedTitle = this.extractArticleTitle(result, task);
      if (extractedTitle && extractedTitle !== task.taskTitle) {
        // 只在调试模式下打印日志
        if (process.env.DEBUG_SUBTASK_ENGINE === 'true') {
          console.log('[SubtaskEngine] 🔥 提取到文章标题，更新当前任务 taskTitle:', {
            taskId: task.id.slice(0, 8),
            newTitle: extractedTitle,
          });
        }
        updateData.taskTitle = extractedTitle;
        // 不再调用 syncArticleTitleToGroup —— 同组其他子任务保留原始标题
      }
    } catch (titleErr) {
      console.error('[SubtaskEngine] ❌ 提取文章标题失败:', {
        taskId: task.id.slice(0, 8),
        error: titleErr instanceof Error ? titleErr.message : String(titleErr),
      });
    }

    // 如果有 articleMetadata，也更新它
    if (articleMetadata) {
      updateData.articleMetadata = articleMetadata as any;
    }

    // 🔒 🔒 🔒 乐观锁：使用 updatedAt 作为版本控制进行更新！
    let updateResult;
    
    // 🔴 🔴 🔴 关键：如果是重试（retryCount >= 1），不用乐观锁直接更新！
    if (retryCount >= 1) {
      console.log('[SubtaskEngine] 🔄 重试模式：不使用乐观锁，直接更新任务');
      updateResult = await db
        .update(agentSubTasks)
        .set(updateData)
        .where(and(
          eq(agentSubTasks.id, task.id),
          // 🔴 重试时仍用 status 保护，避免覆盖终态
          notInArray(agentSubTasks.status, ['completed', 'cancelled'])
        ))
        .returning();
    } else {
      // 🔒 第一次尝试：使用乐观锁（status 校验，避免 updatedAt 精度差异问题）
      console.log('[SubtaskEngine] 🔒 第一次尝试：使用乐观锁更新');
      updateResult = await db
        .update(agentSubTasks)
        .set(updateData)
        // 🔒 🔒 🔒 乐观锁核心：用 status 做校验
        // 🔴 修复：不再仅依赖 updatedAt（JS Date 毫秒精度 vs PG 微秒精度可能不匹配）
        // 改为校验当前状态不是终态即可安全更新
        .where(and(
          eq(agentSubTasks.id, task.id),
          notInArray(agentSubTasks.status, ['completed', 'cancelled'])
        ))
        .returning();
    }

    // 🔒 检查更新结果！
    if (updateResult.length === 0) {
      // ⚠️ 更新失败：版本不匹配！先检查数据库中任务的当前状态
      console.warn('[SubtaskEngine] ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  乐观锁冲突！检查当前任务状态...', {
        taskId: task.id,
        expectedUpdatedAt: task.updatedAt
      });
      
      // 🔍 重新读取数据库中的任务
      const currentTask = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.id, task.id))
        .then(res => res[0]);
      
      if (currentTask) {
        console.warn('[SubtaskEngine] 🔍 当前数据库中的任务状态:', {
          status: currentTask.status,
          updatedAt: currentTask.updatedAt
        });
        
        // 🔴 🔴 🔴 统一逻辑（和 markTaskWaitingUser 完全一致）：
        // 只有当状态是 completed/cancelled（最终状态）才跳过！
        if (currentTask.status === 'completed' || currentTask.status === 'cancelled') {
          console.log('[SubtaskEngine] ✅ 任务已经是最终状态，无需更新:', currentTask.status);
          return;
        }
        
        // 🔴 🔴 🔴 关键：重试限制！最多重试 1 次！
        if (retryCount >= 1) {
          console.error('[SubtaskEngine] ❌ 已达到重试上限，放弃更新！');
          return;
        }
        
        // 🔄 重试！用 currentTask 和 retryCount + 1
        console.log('[SubtaskEngine] 🔄 用最新任务信息重试更新... (retryCount = ' + (retryCount + 1) + ')');
        
        // 用 currentTask 重新调用 markTaskCompleted！
        await this.markTaskCompleted(currentTask, result, retryCount + 1);
        return;
      }
      
      // 读取不到任务，放弃
      console.warn('[SubtaskEngine] ⚠️  读取不到任务，放弃更新');
      return;
    }

    // ✅ 更新成功
    const updatedTask = updateResult[0];
    console.log('[SubtaskEngine] ✅✅✅ ========== markTaskCompleted 更新成功（乐观锁验证通过）==========', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      taskTitle: task.taskTitle?.substring(0, 100),
      newStatus: 'completed',
      savedResultTextLength: updatedTask.resultText?.length || 0,
      savedResultTextPreview: updatedTask.resultText?.substring(0, 300) || '',
      hasResultData: !!updatedTask.resultData
    });
    console.log('[SubtaskEngine] ✅✅✅ ========== 保存完成 ==========');

    // 🔴 新增：先更新 dailyTask 进度，会自动触发文章内容保存
    await this.updateDailyTaskProgress(task);

    // 🔴 新增：根据子任务类型执行审核流程
    if (task.taskTitle.includes('合规') || task.taskTitle.includes('审核')) {
      // 步骤2：文章合规与内容校验 - 执行审核
      console.log('[SubtaskEngine] ========== 触发文章审核流程 ==========');
      try {
        const reviewService = ArticleReviewService.getInstance();
        const reviewResult = await reviewService.executeReview(task);
        
        if (reviewResult) {
          console.log('[SubtaskEngine] ✅ 文章审核完成:', {
            result: reviewResult.result,
            commentsCount: reviewResult.comments.length,
          });
        }
      } catch (reviewError) {
        console.error('[SubtaskEngine] ❌ 文章审核失败:', reviewError);
        // 审核失败不影响主流程
      }
    }

    // 🔥🔥🔥 两阶段架构：基础文章定稿后解锁适配组
    // 修复：markTaskCompleted 也需要触发解锁逻辑（用户通过"指令已完成"按钮完成任务时走此路径）
    await this.unlockAdaptationGroupsIfNeeded(updatedTask || task);
  }

  /**
   * 标记任务失败
   */
  public async markTaskFailed(
    task: typeof agentSubTasks.$inferSelect,
    error: {
      error: string;
      errorType: string;
      timestamp: string;
    }
  ) {
    console.log('');
    console.log('[SubtaskEngine] markTaskFailed 被调用');
    console.log('[SubtaskEngine] 任务信息:', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      currentStatus: task.status,
      fromParentsExecutor: task.fromParentsExecutor,
      taskTitle: task.taskTitle?.substring(0, 100),
    });
    console.log('[SubtaskEngine] 错误信息:', error);
    console.log('');

    // ⚠️ 检查当前状态，如果已经是 completed、failed 或 cancelled，不再更新！
    if (task.status === 'completed' || 
        task.status === 'failed' || 
        task.status === 'cancelled') {
      console.warn('[SubtaskEngine] ⚠️  任务已结束，跳过 markTaskFailed:', {
        taskId: task.id,
        currentStatus: task.status
      });
      return;
    }

    // 构建错误结果数据
    const errorResult = {
      success: false,
      errorType: error.errorType,
      errorMessage: error.error,
      failedAt: error.timestamp,
    };

    // 构建更新数据
    const updateData: any = {
      status: 'failed',
      resultData: errorResult,
      resultText: `[任务失败] ${error.error}`,
      completedAt: getCurrentBeijingTime(),
      updatedAt: getCurrentBeijingTime(),
    };

    // 执行更新（使用 status 校验代替 updatedAt 乐观锁）
    let updateResult;
    try {
      updateResult = await db
        .update(agentSubTasks)
        .set(updateData)
        .where(and(
          eq(agentSubTasks.id, task.id),
          notInArray(agentSubTasks.status, ['completed', 'cancelled'])
        ))
        .returning();
    } catch (dbError) {
      console.error('[SubtaskEngine] ❌ 标记任务失败时数据库更新失败:', dbError);
      throw dbError;
    }

    // 检查更新结果
    if (updateResult.length === 0) {
      console.warn('[SubtaskEngine] ⚠️  乐观锁冲突，任务可能被其他进程更新:', {
        taskId: task.id
      });
      return;
    }

    // ✅ 更新成功
    const updatedTask = updateResult[0];
    console.log('[SubtaskEngine] ✅✅✅ ========== markTaskFailed 更新成功 ==========', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      taskTitle: task.taskTitle?.substring(0, 100),
      newStatus: 'failed',
      savedResultTextLength: updatedTask.resultText?.length || 0,
      savedResultTextPreview: updatedTask.resultText?.substring(0, 200) || ''
    });
    console.log('[SubtaskEngine] ✅✅✅ ========== 保存完成 ==========');
  }

  /**
   * 标记任务等待用户处理
   */
  public async markTaskWaitingUser(
    task: typeof agentSubTasks.$inferSelect,
    userMessage: string,
    overrideResultData?: Record<string, any>,
    retryCount: number = 0
  ) {
    console.log('[SubtaskEngine] markTaskWaitingUser 被调用', { retryCount });
    console.log('[SubtaskEngine] 任务信息:', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      currentStatus: task.status,
      taskTitle: task.taskTitle,
      expectedUpdatedAt: task.updatedAt
    });
    console.log('[SubtaskEngine] 用户消息:', userMessage);

    // ⚠️  🔴 重要：检查当前状态，如果已经是 completed 或 cancelled，不再更新！
    if (task.status === 'completed' || task.status === 'cancelled') {
      console.warn('[SubtaskEngine] ⚠️  ⚠️  ⚠️  任务已结束，跳过 markTaskWaitingUser:', {
        taskId: task.id,
        currentStatus: task.status
      });
      return;
    }

    console.log('[SubtaskEngine] 执行状态更新:', {
      from: task.status,
      to: 'waiting_user'
    });

    // 🔴 修复：保留已有的 resultData，只在 resultData 为空时才设置新数据，或者合并数据
    // 🔴 🔴🔴 新增：支持 overrideResultData，用于虚拟执行器（如 user_preview_edit）注入自定义数据
    let finalResultData: string;
    let finalResultText: string = task.resultText || ''; // 🔴 保留已有的 resultText
    
    // 🔴 如果没有已有的 resultText，生成一个
    if (!finalResultText) {
      finalResultText = `[等待用户处理] ${userMessage}`;
    }
    
    console.log('[SubtaskEngine] 🔴🔴🔴 ========== markTaskWaitingUser resultText 处理 ==========', {
      orderIndex: task.orderIndex,
      existingResultTextLength: task.resultText?.length || 0,
      finalResultTextLength: finalResultText.length,
      finalResultTextPreview: finalResultText.substring(0, 200),
      hasOverrideData: !!overrideResultData,
    });
    
    if (overrideResultData) {
      // 🔴🔴🔴 新增：虚拟执行器传入的自定义 resultData 优先级最高
      // 合并到现有 resultData 中（保留已有字段，overrideResultData 覆盖同名字段）
      try {
        const existingData = task.resultData ? JSON.parse(task.resultData) : {};
        const mergedData = {
          ...existingData,
          ...overrideResultData,
          needUserHelp: true,
          userMessage: userMessage,
          waitingUserAt: getCurrentBeijingTime()
        };
        finalResultData = JSON.stringify(mergedData);
        console.log('[SubtaskEngine] ✅ 使用 overrideResultData 合并完成');
      } catch (e) {
        // 解析失败，直接使用 overrideResultData
        finalResultData = JSON.stringify({
          ...overrideResultData,
          needUserHelp: true,
          userMessage: userMessage,
          waitingUserAt: getCurrentBeijingTime()
        });
        console.warn('[SubtaskEngine] ⚠️ 解析现有 resultData 失败，直接使用 overrideResultData');
      }
    } else if (task.resultData) {
      // 如果已有 resultData，尝试合并数据
      try {
        const existingData = JSON.parse(task.resultData);
        const mergedData = {
          ...existingData,
          needUserHelp: true,
          userMessage: userMessage,
          waitingUserAt: getCurrentBeijingTime()
        };
        finalResultData = JSON.stringify(mergedData);
        console.log('[SubtaskEngine] ✅ 已合并现有 resultData 和 waiting_user 信息');
      } catch (e) {
        // 如果解析失败，保留原有数据
        finalResultData = task.resultData;
        console.warn('[SubtaskEngine] ⚠️ 解析现有 resultData 失败，保留原有数据');
      }
    } else {
      // 如果没有 resultData，设置新数据
      finalResultData = JSON.stringify({ 
        success: false, 
        needUserHelp: true,
        userMessage: userMessage,
        waitingUserAt: getCurrentBeijingTime()
      });
    }

    // 🔒 🔒 🔒 乐观锁：使用 status 校验进行更新！
    let updateResult;
    
    // 🔴 🔴 🔴 关键：如果是重试（retryCount >= 1），不用乐观锁直接更新！
    if (retryCount >= 1) {
      console.log('[SubtaskEngine] 🔄 重试模式：不使用乐观锁，直接更新任务');
      updateResult = await db
        .update(agentSubTasks)
        .set({
          status: 'waiting_user',
          dialogueStatus: 'waiting_user_interaction',
          resultData: finalResultData,
          resultText: finalResultText,
          updatedAt: getCurrentBeijingTime(),
        })
        .where(and(
          eq(agentSubTasks.id, task.id),
          notInArray(agentSubTasks.status, ['completed', 'cancelled'])
        ))
        .returning();
    } else {
      // 🔒 第一次尝试：使用 status 校验（避免 updatedAt 精度差异导致假冲突）
      console.log('[SubtaskEngine] 🔒 第一次尝试：使用乐观锁更新');
      updateResult = await db
        .update(agentSubTasks)
        .set({
          status: 'waiting_user',
          dialogueStatus: 'waiting_user_interaction',
          resultData: finalResultData,
          resultText: finalResultText,
          updatedAt: getCurrentBeijingTime(),
        })
        // 🔒 🔒 🔒 乐观锁核心：用 status 做校验
        // 🔴 修复：不再仅依赖 updatedAt（JS Date 毫秒精度 vs PG 微秒精度可能不匹配）
        .where(and(
          eq(agentSubTasks.id, task.id),
          notInArray(agentSubTasks.status, ['completed', 'cancelled'])
        ))
        .returning();
    }

    // 🔒 检查更新结果！
    if (updateResult.length === 0) {
      // ⚠️ 更新失败：版本不匹配！先检查数据库中任务的当前状态
      console.warn('[SubtaskEngine] ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  乐观锁冲突！检查当前任务状态...', {
        taskId: task.id,
        expectedUpdatedAt: task.updatedAt
      });
      
      // 🔍 重新读取数据库中的任务
      const currentTask = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.id, task.id))
        .then(res => res[0]);
      
      if (currentTask) {
        console.warn('[SubtaskEngine] 🔍 当前数据库中的任务状态:', {
          status: currentTask.status,
          updatedAt: currentTask.updatedAt
        });
        
        // 🔴 🔴 🔴 统一逻辑：只有当状态是 completed/cancelled（最终状态）才跳过！
        if (currentTask.status === 'completed' || currentTask.status === 'cancelled') {
          console.log('[SubtaskEngine] ✅ 任务已经是最终状态，无需更新:', currentTask.status);
          return;
        }
        
        // 🔴 🔴 🔴 关键：重试限制！最多重试 1 次！
        if (retryCount >= 1) {
          console.error('[SubtaskEngine] ❌ 已达到重试上限，放弃更新！');
          return;
        }
        
        // 🔄 重试！用 currentTask 和 retryCount + 1
        console.log('[SubtaskEngine] 🔄 用最新任务信息重试更新... (retryCount = ' + (retryCount + 1) + ')');
        // 🔴 修复：overrideResultData 是第3个参数，retryCount 是第4个参数，必须保留 overrideResultData
        await this.markTaskWaitingUser(currentTask, userMessage, overrideResultData, retryCount + 1);
        return;
      }
      
      // 读取不到任务，放弃
      console.warn('[SubtaskEngine] ⚠️  读取不到任务，放弃更新');
      return;
    }

    // ✅ 更新成功
    const updatedTask = updateResult[0];
    console.log('[SubtaskEngine] ✅✅✅ ========== markTaskWaitingUser 更新成功 ==========', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      taskTitle: task.taskTitle?.substring(0, 100),
      newStatus: 'waiting_user',
      savedResultTextLength: updatedTask.resultText?.length || 0,
      savedResultTextPreview: updatedTask.resultText?.substring(0, 200) || ''
    });
    console.log('[SubtaskEngine] ✅✅✅ ========== 保存完成 ==========');
  }

  /**
   * 从堆栈中提取调用者信息
   */
  private extractCallerInfo(stack: string | undefined): string {
    if (!stack) return 'unknown';
    
    const lines = stack.split('\n');
    // lines[0] = "Error"
    // lines[1] = "at markTaskWaitingUser (...)"
    // lines[2] = "at handleNeedUserDecision (...)" ← 我们想要的
    // lines[3] = "at processTask (...)"
    
    if (lines.length >= 3) {
      const callerLine = lines[2];
      // 提取类似 "at handleNeedUserDecision (/path/to/file.ts:123:45)"
      const match = callerLine.match(/at\s+(\w+)\s*\(/);
      if (match) {
        return match[1]; // 返回方法名，如 "handleNeedUserDecision"
      }
      return callerLine.trim();
    }
    
    return 'unknown-caller';
  }



  /**
   * 带决策的 Agent B 调用（返回标准化决策）
   */
  public async callAgentBWithDecision(
    task: typeof agentSubTasks.$inferSelect,
    executionContext: ExecutionContext,
    capabilities: any[],
    currentIteration?: number
  ): Promise<AgentBDecision> {
    console.log('[SubtaskEngine] ========== 调用 Agent B（标准化决策） ==========', {
      command_result_id: task.commandResultId,
      task_id: task.id,
      order_index: task.orderIndex,
      iteration: currentIteration
    });

    // 🔴🔴🔴 新增：查询同一主任务下的所有子任务，判断当前任务是否是最后一个
    let isLastTask = false;
    let allSiblingTasks: any[] = [];
    try {
      allSiblingTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, task.commandResultId));
      
      if (allSiblingTasks.length > 0) {
        // 过滤掉 split_to_be_destroyed 状态的任务
        const validTasks = allSiblingTasks.filter(t => t.status !== 'split_to_be_destroyed');
        const maxOrderIndex = Math.max(...validTasks.map(t => t.orderIndex));
        isLastTask = task.orderIndex === maxOrderIndex;
        console.log('[SubtaskEngine] 🔴 子任务顺序信息:', {
          currentOrderIndex: task.orderIndex,
          maxOrderIndex,
          isLastTask,
          totalSiblingTasks: allSiblingTasks.length,
          validTasksCount: validTasks.length,
          siblingOrderIndexes: validTasks.map(t => t.orderIndex).sort((a, b) => a - b)
        });
      }
    } catch (error) {
      console.warn('[SubtaskEngine] ⚠️ 查询子任务顺序失败:', error);
    }

    // 根据事业部自动选择 accountId
    const defaultAccountId = this.getDefaultAccountId(task.fromParentsExecutor);
    const capabilitiesText = this.buildCapabilitiesText(capabilities);

    // 构建MCP执行历史文本（传递当前order_index，用于区分前序和当前）
    const mcpHistoryText = this.buildMcpHistoryText(executionContext.mcpExecutionHistory, task.orderIndex);

    // 构建用户反馈文本
    const userFeedbackText = this.buildUserFeedbackText(executionContext.userFeedback);

    // 构建执行 Agent 完整输出的文本
    let executorOutputText = '';
    
    // 🔴 🔴 🔴 关键：先输出执行 Agent 的核心判断字段（最重要！）
    // 🔴 insurance-d v2 格式：isCompleted 和 result 字段
    const isCompletedValue = executionContext.executorFeedback.isCompleted;
    const resultValue = executionContext.executorFeedback.executorOutput?.result;
    // 从 result 字段中提取无法执行的原因（当 result 包含【无法执行】前缀时）
    const reasonValue = resultValue?.includes('【无法执行】') ? resultValue : undefined;
    // 🔴🔴🔴 新增：isNeedSplit 相关字段（自动拆分功能）
    const isNeedSplitValue = (executionContext.executorFeedback as any)?.isNeedSplit;
    const splitReasonValue = (executionContext.executorFeedback as any)?.splitReason;
    const suggestedSplitPointsValue = (executionContext.executorFeedback as any)?.suggestedSplitPoints;
    
    // 🔴 新增：执行结果概述字段（briefResponse、selfEvaluation、actionsTaken）
    const briefResponse = (executionContext.executorFeedback as any)?.briefResponse;
    const selfEvaluation = (executionContext.executorFeedback as any)?.selfEvaluation;
    const actionsTaken = (executionContext.executorFeedback as any)?.executionSummary?.actionsTaken;
    
    let coreJudgmentText = `
【执行 Agent 核心判断（最重要！）】
- isNeedMcp: ${executionContext.executorFeedback.isNeedMcp}（是否需要 MCP 支持）
- isTaskDown: ${executionContext.executorFeedback.isTaskDown}（任务是否完成）`;
    
    // 🔴 insurance-d v2 格式：isCompleted 和 result
    if (isCompletedValue !== undefined) {
      coreJudgmentText += `
- isCompleted: ${isCompletedValue}（执行者是否能够完成此任务，v2格式字段）`;
    }
    if (reasonValue) {
      // result 中包含【无法执行】前缀，说明无法执行的原因
      coreJudgmentText += `
- result: ${reasonValue.substring(0, 300)}${reasonValue.length > 300 ? '...' : ''}（执行结论，包含无法执行的原因）`;
    } else if (resultValue) {
      // 正常执行结论
      coreJudgmentText += `
- result: ${resultValue.substring(0, 300)}${resultValue.length > 300 ? '...' : ''}（执行结论）`;
    }
    
    // 🔴🔴🔴 新增：isNeedSplit 相关字段（自动拆分功能）
    if (isNeedSplitValue !== undefined) {
      coreJudgmentText += `
- isNeedSplit: ${isNeedSplitValue}（是否需要拆分任务）`;
      if (splitReasonValue) {
        coreJudgmentText += `
- splitReason: ${splitReasonValue}（拆分原因）`;
      }
      if (suggestedSplitPointsValue && Array.isArray(suggestedSplitPointsValue) && suggestedSplitPointsValue.length > 0) {
        coreJudgmentText += `
- suggestedSplitPoints: ${JSON.stringify(suggestedSplitPointsValue)}（建议的拆分点）`;
      }
    }
    
    // 🔴 新增：执行结果概述字段
    if (briefResponse) {
      coreJudgmentText += `
- briefResponse: ${briefResponse.substring(0, 300)}${briefResponse.length > 300 ? '...' : ''}（执行者对任务的简要响应）`;
    }
    if (selfEvaluation) {
      coreJudgmentText += `
- selfEvaluation: ${selfEvaluation.substring(0, 300)}${selfEvaluation.length > 300 ? '...' : ''}（执行者对完成情况的自我评价）`;
    }
    if (actionsTaken && Array.isArray(actionsTaken) && actionsTaken.length > 0) {
      coreJudgmentText += `
- actionsTaken: ${JSON.stringify(actionsTaken.slice(0, 5))}${actionsTaken.length > 5 ? '...(共' + actionsTaken.length + '项)' : ''}（执行者采取的行动）`;
    }
    
    // 🔴🔴🔴 【新增】失败原因和决策内容（关键字段！）
    const failureReasonValue = (executionContext.executorFeedback as any)?.failureReason;
    const decisionContentValue = (executionContext.executorFeedback as any)?.decisionContent;
    
    if (failureReasonValue) {
      coreJudgmentText += `
- failureReason: ${failureReasonValue.substring(0, 300)}${failureReasonValue.length > 300 ? '...' : ''}（🔴 执行者明确说明的失败原因！）`;
    }
    if (decisionContentValue) {
      const dcReason = typeof decisionContentValue === 'object' ? decisionContentValue.reason : decisionContentValue;
      if (dcReason) {
        coreJudgmentText += `
- decisionContent.reason: ${String(dcReason).substring(0, 300)}${String(dcReason).length > 300 ? '...' : ''}（🔴 执行者的详细拒绝原因！）`;
      }
    }
    
    coreJudgmentText += `

【判断规则】
- 如果 isCompleted = false → 执行者无法完成此任务，需要切换执行者！
- 如果 isTaskDown = true → 任务已完成！
- 如果 isNeedMcp = false 且 isTaskDown = true → 任务完成，不需要技术处理！
- 🔴🔴🔴 如果 isNeedSplit = true → 任务需要拆分！返回 AUTO_SPLIT！
`;
    const combinedCoreJudgment = coreJudgmentText;
    
    if (executionContext.executorFeedback.executorOutput) {
      const eo = executionContext.executorFeedback.executorOutput;
      const parts: string[] = [];
      
      if (eo.output) {
        parts.push('- 产出内容: ' + eo.output.substring(0, 500) + (eo.output.length > 500 ? '...' : ''));
      }
      if (eo.suggestions) {
        parts.push('- 执行Agent的建议: ' + eo.suggestions);
      }
      if (eo.reasoning) {
        parts.push('- 执行Agent的思考: ' + eo.reasoning);
      }
      
      if (parts.length > 0) {
        executorOutputText = combinedCoreJudgment + '\n【执行Agent的完整输出】\n' + parts.join('\n') + '\n';
      } else {
        executorOutputText = combinedCoreJudgment + '\n';
      }
    } else {
      executorOutputText = combinedCoreJudgment + '\n';
    }

    // 将 priorStepOutput 加入到 Agent B 的提示词中（限制长度避免超时）
    let priorStepOutputText = '';
    if (executionContext.priorStepOutput) {
      // 🔴 修复：增大内容长度限制，避免文章内容被截断
      // 原值 3000 太小，导致文章类任务（通常 4000-10000 字符）被截断
      const maxContentLength = 20000;
      let contentToUse = executionContext.priorStepOutput;
      
      if (contentToUse.length > maxContentLength) {
        contentToUse = contentToUse.substring(0, maxContentLength) + '\n\n[...内容已截断，完整内容请参考上一步骤输出...]';
      }
      
      priorStepOutputText = `
【上一步骤输出（重要！）】
${contentToUse}
`;
    }

    // 🔴 生成执行者身份配置文本（供 Agent B 做任务归属判断）
    const executorIdentityText = buildExecutorIdentityText();
    
    // 🔴🔴🔴 测试日志：确认 executor-identity-config.ts 修改已生效
    console.log('[Agent B] ========== 执行者身份配置已更新 ==========');
    console.log('[Agent B] 关键标记: Agent T 是否声明"合规校验是我的专属职责"');
    console.log('[Agent B] 关键标记: insurance-d 是否声明"技术操作、合规校验不是我负责"');
    // 🔴🔴🔴 测试日志：打印前100字符确认内容
    console.log('[Agent B] executorIdentityText 前200字符:', executorIdentityText.substring(0, 200));
    console.log('[Agent B] ==========================================');

    // 🔴 检查用户是否强制指定了执行者
    const taskMetadata = (task.metadata as any) || {};
    const reexecuteHistory: any[] = taskMetadata.reexecuteHistory || [];
    
    // 🔴 获取已尝试过的执行者列表
    // 🔴🔴🔴 修复：triedExecutors 应该是【实际执行过】的执行者，而不是 Agent B 建议过的
    // Agent B 的 reexecuteHistory 记录的是"建议切换到 X"，不是"X 已经执行并失败"
    // 应该基于 previousExecutor（上一个执行者）来计算，因为只有上一个执行者才是真正执行过的
    const triedExecutors = [...new Set(
      reexecuteHistory
        .filter((h: any) => h.previousExecutor) // 只统计真正执行过的
        .map((h: any) => h.previousExecutor)
    )];
    
    // 🔴 如果没有实际执行记录，只看当前执行者
    const actualCurrentExecutor = task.fromParentsExecutor;
    const allExecutors = ['agent T', ...WRITING_AGENTS, 'insurance-c'];
    
    // 确保当前执行者也在"已尝试"列表中
    const allTriedExecutors = triedExecutors.includes(actualCurrentExecutor) 
      ? triedExecutors 
      : [...triedExecutors, actualCurrentExecutor];
    
    const untriedExecutors = allExecutors.filter(e => !allTriedExecutors.includes(e));
    
    // 🔴 统计每个执行者的"切换"次数（仅供参考，不是拒绝次数）
    const executorSwitchStats: Record<string, { count: number; reasons: string[] }> = {};
    for (const h of reexecuteHistory) {
      const executor = h.executor; // 这是建议切换到的执行者
      if (!executorSwitchStats[executor]) {
        executorSwitchStats[executor] = { count: 0, reasons: [] };
      }
      executorSwitchStats[executor].count++;
      if (h.reason) {
        executorSwitchStats[executor].reasons.push(h.reason);
      }
    }

    // 🔴 构建避坑提示文本（只警告真正执行过并失败的执行者）
    const pitfallWarningText = Object.entries(executorSwitchStats)
      .filter(([_, stats]) => stats.count >= 2) // 只在切换 2 次以上时警告
      .map(([executor, stats]) => {
        const reasons = stats.reasons.slice(0, 2).join('；'); // 最多显示2个原因
        return `- ⚠️ ${executor}: 已拒绝 ${stats.count} 次${reasons ? `（原因: ${reasons.substring(0, 100)}）` : ''}`;
      })
      .join('\n');

    // 🔴 构建 reexecuteHistoryText 传给 Agent B（增强避坑提示）
    const reexecuteHistoryText = reexecuteHistory.length > 0 
      ? `\n【执行者切换历史（重要！）】\n${reexecuteHistory.map((h, i) => 
          `${i + 1}. ${h.executor} (前一个: ${h.previousExecutor || '无'}) - ${h.reason || h.decisionType} - ${h.timestamp}`
        ).join('\n')}\n已尝试过的执行者: [${triedExecutors.join(', ')}]\n未尝试的执行者: [${untriedExecutors.join(', ')}]\n\n【🔴🔴🔴 避坑警告（非常重要！）🔴🔴🔴】\n以下执行者已经拒绝过此任务，请勿再次推荐：\n${pitfallWarningText}\n🔴 **绝对不能在 suggestedExecutor 中推荐已拒绝过的执行者！**\n🔴 **如果所有执行者都已尝试过，必须返回 NEED_USER！**`
      : '\n【执行者切换历史】暂无切换记录';



    // 🔴🔴🔴 【优化】检查是否可能陷入死循环
    // 公众号格式化等 MCP 任务，如果 reexecuteHistory 中存在多次相同执行者，可能陷入死循环
    // 🔴 修复：只有当最近一次执行仍未成功时，才触发死循环检测
    const executorAttempts = reexecuteHistory.reduce((acc, record) => {
      acc[record.executor] = (acc[record.executor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const maxExecutorAttempts = Math.max(...Object.values(executorAttempts), 0);
    
    // 🔴 修复后的逻辑：获取最近一次执行的结果
    const latestExecution = reexecuteHistory[reexecuteHistory.length - 1];
    const latestExecutionSucceeded = latestExecution?.executionResult?.success === true;
    
    // 🔴 死循环条件：执行次数>=2 且 最近一次执行仍未成功
    // 如果最近一次执行已经成功，说明任务正在正常推进，不算死循环
    const hasLoopRisk = (maxExecutorAttempts >= 2 && !latestExecutionSucceeded) || 
                        (reexecuteHistory.length >= 1 && untriedExecutors.length === 0);
    
    // 🔴 检查是否所有执行者都已尝试过，或者有死循环风险
    if (hasLoopRisk) {
      console.log('[SubtaskEngine] 🔴🔴🔴 检测到可能陷入死循环，强制转为用户介入');
      console.log('[SubtaskEngine] 死循环风险分析:', {
        executorAttempts,
        maxExecutorAttempts,
        reexecuteHistoryLength: reexecuteHistory.length,
        untriedExecutorsLength: untriedExecutors.length,
        hasLoopRisk,
        // 🔴 新增：打印最近一次执行结果
        latestExecution: latestExecution ? {
          executor: latestExecution.executor,
          executionResult: latestExecution.executionResult,
          succeeded: latestExecutionSucceeded
        } : '无历史执行'
      });
      console.log('[SubtaskEngine] reexecuteHistory:', reexecuteHistory);
      
      return {
        type: 'NEED_USER',
        reasonCode: 'LOOP_RISK_DETECTED',
        reasoning: `检测到任务可能陷入死循环（${triedExecutors.join(', ')}）。强制转为用户介入。`,
        notCompletedReason: 'loop_risk_detected', // 🔴 检测到死循环风险
        decisionBasis: `执行者 ${JSON.stringify(executorAttempts)} 已尝试多次但任务仍未完成，存在死循环风险。`, // 🔴 决策依据
        context: {
          executionSummary: '检测到死循环风险，需要用户介入',
          riskLevel: 'high',
          suggestedAction: '请用户手动处理或决定下一步'
        },
        data: {
          promptMessage: {
            title: '任务执行异常',
            description: `任务执行多次仍无法完成，可能陷入死循环。请决定下一步操作。已尝试的执行者：${triedExecutors.join(', ')}`
          }
        }
      };
    }
    
    // 🔴 从 task.resultData 中提取 executionSummary（客观描述）
    let executionSummaryText = '';
    if (task.resultData) {
      try {
        const resultData = typeof task.resultData === 'string' 
          ? JSON.parse(task.resultData) 
          : task.resultData;
        if (resultData.executionSummary) {
          executionSummaryText = `
【执行结果客观描述（重要！请根据此描述做出决策）】
${resultData.executionSummary}
`;
          console.log('[SubtaskEngine] 🔴 提取到 executionSummary:', resultData.executionSummary);
        }
      } catch (e) {
        console.warn('[SubtaskEngine] ⚠️ 提取 executionSummary 失败:', e);
      }
    }

    // ========== Phase 4: 文章校验（写作类 Agent 任务在 Agent B 评审前自动校验） ==========
    let validationResult: ValidationResult | null = null;
    let validationResultText = '';
    let phase5ResultText = ''; // 🔴 修复：提前定义，避免作用域问题

    const _isWritingAgentHere = isWritingAgent(task.fromParentsExecutor);
    if (_isWritingAgentHere && executionContext.executorFeedback?.executorOutput?.output) {
      try {
        const taskExtension = task as InsuranceDTaskExtension;

        // 🔴 Phase4修复(#1): 从多级数据源提取核心锚点（优先级：confirmedOutline > structureDetail > userOpinion）
        // 提取已确认大纲中的结构化内容作为锚点
        let anchorOpeningCase: string | undefined;
        let anchorCoreViewpoint: string | undefined;
        let anchorEndingConclusion: string | undefined;

        // 尝试从 resultData.metadata.confirmedOutline 中提取（Phase3 大纲确认模式）
        if (task.resultData) {
          try {
            const rd = typeof task.resultData === 'string' ? JSON.parse(task.resultData) : task.resultData;
            const confirmedOutline = rd?.metadata?.confirmedOutline || rd?.confirmedOutline;
            if (typeof confirmedOutline === 'string' && confirmedOutline.length > 10) {
              // 按 "## " 或 "### " 分割大纲段落
              const sections = confirmedOutline.split(/(?:^|\n)\s*#{2,3}\s*/).filter(s => s.trim().length > 5);
              if (sections.length >= 1) anchorOpeningCase = sections[0].trim();    // 第一段→开头案例
              if (sections.length >= 2) anchorCoreViewpoint = sections[1].trim();  // 第二段→核心观点
              if (sections.length >= 3) anchorEndingConclusion = sections[sections.length - 1].trim(); // 最后一段→结尾
            }
          } catch {
            // 解析失败时静默降级
          }
        }

        // 回退：无大纲时用 structureDetail/userOpinion 作为锚点
        if (!anchorOpeningCase && taskExtension.structureDetail) {
          anchorOpeningCase = taskExtension.structureDetail; // 结构详情包含各模块描述
        }
        if (!anchorCoreViewpoint && taskExtension.userOpinion) {
          anchorCoreViewpoint = taskExtension.userOpinion; // 用户观点作为核心立场回退
        }

        // 🔥 insurance-xiaohongshu 输出 JSON，需要提取 fullText 进行校验
        let articleContentForValidation = executionContext.executorFeedback.executorOutput.output;
        if (task.fromParentsExecutor === 'insurance-xiaohongshu') {
          try {
            const xhsResult = JSON.parse(articleContentForValidation);
            if (xhsResult.fullText) {
              // 小红书：用 fullText 替代整段 JSON 进行校验
              articleContentForValidation = xhsResult.fullText;
            } else if (xhsResult.result && typeof xhsResult.result === 'string') {
              // 尝试从 result 字段中提取 JSON
              try {
                const innerResult = JSON.parse(xhsResult.result);
                articleContentForValidation = innerResult.fullText || xhsResult.result;
              } catch {
                articleContentForValidation = xhsResult.result;
              }
            }
          } catch {
            // JSON 解析失败，使用原始内容
          }
        }

        validationResult = await articleValidationService.validate(
          articleContentForValidation,
          {
            coreAnchorData: {
              openingCase: anchorOpeningCase,
              coreViewpoint: anchorCoreViewpoint,
              endingConclusion: anchorEndingConclusion,
            },
            structureName: taskExtension.structureName,
            structureDetail: taskExtension.structureDetail,
            userOpinion: taskExtension.userOpinion,
            checkAbsoluteWords: true,
          }
        );

        // 构建校验结果文本（注入到 Agent B 提示词中）
        validationResultText = this.buildValidationResultTextForAgentB(validationResult);

        console.log('[SubtaskEngine] [Phase4] 📊 文章校验完成', {
          overall: validationResult.overall,
          elapsedMs: validationResult.elapsedMs,
          anchorIntegrity: validationResult.scores.anchorIntegrity.score,
          structureCompleteness: validationResult.scores.structureCompleteness.passed,
          materialUsage: validationResult.scores.materialUsage.rate,
          styleCompliance: validationResult.scores.styleCompliance.severity,
        });

        // 🔴 Phase4修复(#2): 将校验结果持久化到 resultData.metadata（审计追溯）
        try {
          const currentResultData = typeof task.resultData === 'string'
            ? JSON.parse(task.resultData)
            : (task.resultData || {});
          if (!currentResultData.metadata) currentResultData.metadata = {};
          currentResultData.metadata.validationResult = {
            overall: validationResult.overall,
            dimensionPassStatus: validationResult.dimensionPassStatus,
            summary: validationResult.summary,
            rewriteSuggestions: validationResult.rewriteSuggestions,
            validatedAt: new Date().toISOString(),
          };
          await db.update(agentSubTasks)
            .set({ resultData: JSON.stringify(currentResultData) })
            .where(eq(agentSubTasks.id, task.id));
          console.log('[SubtaskEngine] [Phase4] ✅ 校验结果已持久化到 resultData');
        } catch (persistError) {
          console.warn('[SubtaskEngine] [Phase4] ⚠️ 校验结果持久化失败（不阻塞流程）:', persistError instanceof Error ? persistError.message : String(persistError));
        }
      } catch (validationError) {
        console.warn('[SubtaskEngine] [Phase4] ⚠️ 文章校验失败（不阻塞流程）:', validationError instanceof Error ? validationError.message : String(validationError));
        // 校验失败不影响主流程，静默降级
      }

      // ========== Phase 5: LLM 辅助闭环（情绪分类 + 风格一致性评估） ==========
      // 🔴 修复：确保 taskExtension 在此作用域可用
      if (_isWritingAgentHere && executionContext.executorFeedback?.executorOutput?.output) {
        const taskExtension = task as InsuranceDTaskExtension;
        const articleText = executionContext.executorFeedback.executorOutput.output;
        
        // 🔧 修复：从多级数据源读取 confirmedOutline
        const _taskMetadataHere = task.metadata as Record<string, any> | null;
        const _confirmedOutlineHere = _taskMetadataHere?.confirmedOutline || task.userOpinion || taskExtension.confirmedOutline;

        // Phase5.1: LLM 情绪分类（同步执行，轻量 LLM 调用通常 <5s，结果注入 Agent B 提示词）
        try {
          const emotionResult: EmotionClassificationResult = await llmAssistedRuleService.classifyEmotion(articleText);
          phase5ResultText += `[情绪分类] 主导情绪: ${emotionResult.primaryEmotion} (置信度: ${(emotionResult.confidence * 100).toFixed(0)}%)`;
          if (emotionResult.secondaryTags.length > 0) {
            phase5ResultText += ` | 辅助标签: ${emotionResult.secondaryTags.join('、')}`;
          }
          if (emotionResult.analysisText) {
            phase5ResultText += `\n分析: ${emotionResult.analysisText}`;
          }
          phase5ResultText += '\n';

          // 持久化到 resultData.metadata（后台异步，不阻塞）
          this.runEmotionClassificationAsync(task, articleText, emotionResult).catch(err => {
            console.warn('[SubtaskEngine] [Phase5] ⚠️ 情绪分类持久化异常:', err instanceof Error ? err.message : String(err));
          });
        } catch (err) {
          console.warn('[SubtaskEngine] [Phase5] ⚠️ 情绪分类失败（不阻塞主流程）:', err instanceof Error ? err.message : String(err));
        }

        // Phase5.2: 风格一致性评估（保持异步，embedding 计算较慢）
        if (_confirmedOutlineHere) {
          this.runStyleConsistencyAsync(task, articleText, _confirmedOutlineHere).catch(err => {
            console.warn('[SubtaskEngine] [Phase5] ⚠️ 风格一致性评估后台任务异常:', err instanceof Error ? err.message : String(err));
          });
        }
      }
    }

    // 使用模块化的 Agent B 提示词
    const prompt = 
      AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT + '\n\n' +
      buildAgentBBusinessControllerUserPrompt(
        {
          id: task.id,
          taskTitle: task.taskTitle,
          taskDescription: task.taskDescription || '',
          orderIndex: task.orderIndex,
          fromParentsExecutor: task.fromParentsExecutor
        },
        {
          taskMeta: executionContext.taskMeta,
          executorFeedback: executionContext.executorFeedback
        },
        capabilitiesText,
        mcpHistoryText,
        userFeedbackText,
        executorOutputText,
        priorStepOutputText,
        defaultAccountId,
        executorIdentityText,  // 🔴 传入执行者身份配置
        reexecuteHistoryText,  // 🔴 传入执行者切换历史
        isLastTask,             // 🔴 传入是否是最后一个任务
        validationResultText,  // 🔴 Phase 4: 校验结果文本
        phase5ResultText       // 🔴 Phase 5: 情绪分类 + 风格一致性评估结果
      ) + '\n\n' +
      executionSummaryText + '\n\n' +  // 🔴 添加客观描述
      AGENT_B_OUTPUT_FORMAT;

    console.log('[SubtaskEngine] Agent B 提示词构建完成', {
      command_result_id: task.commandResultId,
      task_id: task.id,
      prompt_length: prompt.length
    });

    try {
      const response = await callLLM(
        'agent B',
        '标准化决策',
        '你是 Agent B，负责综合多方信息做出标准化决策',
        prompt,
        {
          timeout: 180000, // 3 分钟超时
          workspaceId: task.workspaceId || undefined,
        }
      );

      console.log('[SubtaskEngine] 🔴🔴🔴 Agent B 原始返回（完整）:', response);
      console.log('[SubtaskEngine] 🔴🔴🔴 Agent B 原始返回长度:', response.length, '字符');

      let decision: AgentBDecision;
      let rawLLMResponse = response; // 保存原始响应用于调试
      
      try {
        const parseResult = AgentResponseParser.parseAgentBResponse(response);
        
        if (!parseResult.success) {
          console.error('[SubtaskEngine] Agent B 响应解析失败:', parseResult.error);
          throw new Error(parseResult.error || '响应解析失败');
        }
        
        decision = parseResult.data!;
        
        if (parseResult.warnings && parseResult.warnings.length > 0) {
          console.warn('[SubtaskEngine] Agent B 解析警告:', parseResult.warnings);
        }

        // 确保 MCP 参数中有 accountId
        if (decision.type === 'EXECUTE_MCP' && decision.data?.mcpParams?.params) {
          if (!decision.data.mcpParams.params.accountId) {
            decision.data.mcpParams.params.accountId = defaultAccountId;
          }
        }

      } catch (parseError) {
        console.error('[SubtaskEngine] Agent B 决策解析失败:', parseError);
        
        // 检查是否已有有效的 MCP 合规审核结果
        // 🔴🔴🔴 【修复】必须传入 currentOrderIndex，防止前序任务的 MCP 被误判为当前任务的结果
        if (executionContext.mcpExecutionHistory && executionContext.mcpExecutionHistory.length > 0) {
          const hasValidResult = this.hasValidMcpResult(executionContext.mcpExecutionHistory, task.orderIndex);
          if (hasValidResult) {
            console.log('[SubtaskEngine] 检测到已有有效 MCP 结果，直接返回 COMPLETE 决策');
            const lastMcpResult = executionContext.mcpExecutionHistory[executionContext.mcpExecutionHistory.length - 1].result?.data;
            return {
              type: 'COMPLETE',
              reasonCode: 'MCP_AUDIT_COMPLETE',
              reasoning: 'Agent B 决策解析失败，但已有有效的 MCP 合规审核结果，任务已完成。',
              context: {
                executionSummary: 'MCP 合规审核已完成，Agent B 决策解析失败但不影响任务完成。',
                riskLevel: 'low',
                suggestedAction: '任务已完成，继续下一步'
              },
              data: {
                completionResult: {
                  success: true,
                  mcpResult: lastMcpResult,
                  completionType: 'mcp_audit_complete'
                }
              }
            };
          }
        }
        
        // 如果没有有效的 MCP 结果，返回 NEED_USER 决策
        return {
          type: 'NEED_USER',
          reasonCode: 'USER_CONFIRM',
          reasoning: 'Agent B 决策解析失败，需要您的确认。错误信息：' + (parseError instanceof Error ? parseError.message : String(parseError)),
          context: {
            executionSummary: 'Agent B 输出解析失败，需要用户确认下一步操作',
            riskLevel: 'medium',
            suggestedAction: '请确认下一步操作'
          },
          data: {
            promptMessage: {
              title: 'Agent B 决策解析失败',
              description: 'Agent B 返回的决策格式有误，需要您确认下一步操作。错误信息：' + (parseError instanceof Error ? parseError.message : String(parseError)),
              priority: 'medium'
            }
          }
        };
      }

      console.log('[SubtaskEngine] Agent B 决策完成:', decision.type);
      
      // 🔴🔴🔴 【删除重复记录】recordAgentInteraction 已在 handleDecisionType 中调用
      // 此处不应再次记录，避免重复插入 step_history
      // if (currentIteration !== undefined) { ... }
      
      // 返回决策 + 原始 LLM 响应（用于调试）
      return {
        ...decision,
        _debug: {
          rawLLMResponse,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[SubtaskEngine] Agent B 调用失败:', error);
      
      // 构造失败决策
      const agentBFailedDecision: AgentBDecision = {
        type: 'NEED_USER',
        reasonCode: 'USER_CONFIRM',
        reasoning: 'Agent B 调用失败，需要您的确认。错误信息：' + (error instanceof Error ? error.message : String(error)),
        context: {
          executionSummary: 'Agent B 调用异常，需要用户确认下一步操作',
          riskLevel: 'medium',
          suggestedAction: '请确认下一步操作'
        },
        data: {
          promptMessage: {
            title: 'Agent B 调用失败',
            description: 'Agent B 调用失败，需要您确认下一步操作。错误信息：' + (error instanceof Error ? error.message : String(error)),
            priority: 'medium'
          }
        }
      };
      
      // 🔴🔴🔴 【删除重复记录】recordAgentInteraction 已在 handleDecisionType 中调用
      // catch 块中的失败决策也由 handleDecisionType 统一记录
      // if (currentIteration !== undefined) { ... }
      
      // 返回失败决策 + 调试信息
      return {
        ...agentBFailedDecision,
        _debug: {
          error: 'Agent B decision failed',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // ========== 🔴 🔴 🔴 新增：简单直接的交互记录方法 ==========
  // 设计原则：Agent 完成任务后记录，一条记录包含请求和响应
  // 状态范围："EXECUTE_MCP" | "COMPLETE" | "NEED_USER" | "FAILED" | "REEXECUTE_EXECUTOR"

  /**
   * 记录 Agent 的完整交互（请求 + 响应）
   * 在 Agent 完成任务后调用
   * 🔴 极简方案：只存最关键字段，避免数据过大
   * 🔴 可靠方案：使用原子性操作 + 重试机制避免重复插入
   */
  public async recordAgentInteraction(
    commandResultId: string,
    stepNo: number,
    agentId: string,
    requestContent: any,
    responseStatus: 'pre_completed' | 'pre_need_support' | 'pre_failed' | 'EXECUTE_MCP' | 'COMPLETE' | 'NEED_USER' | 'FAILED' | 'REEXECUTE_EXECUTOR',
    responseContent: any,
    subTaskId?: number | string,
    iteration?: number
  ): Promise<number> {
    // 🔴🔴🔴 调试：打印传入参数
    console.log('[SubtaskEngine] recordAgentInteraction 入口参数:', {
      agentId,
      responseStatus,
      hasResponseContent: !!responseContent,
      // 🔴 关键：打印 responseContent 中的 isNeedSplit
      responseContent_isNeedSplit: (responseContent as any)?.isNeedSplit,
      responseContent_keys: responseContent ? Object.keys(responseContent) : [],
      // 🔴 打印 requestContent 中的 executorResult.isNeedSplit
      requestContent_executorResult_isNeedSplit: (requestContent as any)?.executorResult?.isNeedSplit
    });

    console.log('[SubtaskEngine] 记录 Agent 完整交互:', { 
      agentId, 
      responseStatus, 
      commandResultId, 
      stepNo, 
      iteration,
      subTaskId
    });

    // ========== 🔴 新增：先保存文章内容（如果是写作类 Agent）==========
    if ((isWritingAgent(agentId) || agentId === 'insurance-c') && subTaskId) {
      try {
        console.log('[SubtaskEngine] 🔴 检测到 insurance-d/insurance-c 执行，先保存文章内容...');
        
        const executorResponse = responseContent as any;
        
        // 🔴🔴🔴 关键修复：优先从 structuredResult 中提取完整文章内容！
        // 这是 insurance-d 现在返回完整文章内容的地方！
        let fullArticleContent: string | undefined;
        
        // 1. 优先从 structuredResult.executionSummary.resultContent 提取
        if (executorResponse?.structuredResult?.executionSummary?.resultContent) {
          fullArticleContent = executorResponse.structuredResult.executionSummary.resultContent;
          console.log('[SubtaskEngine] ✅ 从 structuredResult.executionSummary.resultContent 提取文章内容');
        }
        // 2. 其次从 structuredResult.resultContent 提取
        else if (executorResponse?.structuredResult?.resultContent) {
          fullArticleContent = executorResponse.structuredResult.resultContent;
          console.log('[SubtaskEngine] ✅ 从 structuredResult.resultContent 提取文章内容');
        }
        // 3. 再次从 executorOutput.result 或 executorOutput.output 提取（兼容旧格式）
        else if (executorResponse?.executorOutput?.result || executorResponse?.executorOutput?.output) {
          fullArticleContent = executorResponse.executorOutput.result || executorResponse.executorOutput.output;
          if (fullArticleContent) {
            console.log('[SubtaskEngine] ✅ 从 executorOutput.result/output 提取文章内容（兼容旧格式）');
          }
        }
        // 4. 🔴 新增：从 responseContent.result 直接提取（insurance-d 可能返回的格式）
        else if (executorResponse?.result && typeof executorResponse.result === 'string' && executorResponse.result.length > 100) {
          fullArticleContent = executorResponse.result;
          console.log('[SubtaskEngine] ✅ 从 responseContent.result 直接提取文章内容');
        }
        // 5. 🔴 新增：从 responseContent 直接提取（最宽松的兜底）
        else {
          const keys = Object.keys(executorResponse || {});
          console.log('[SubtaskEngine] 🔴 未找到 structuredResult/executorOutput，尝试其他字段。keys:', keys);
          
          // 尝试从 responseContent 的任意字符串字段中提取文章内容
          for (const key of keys) {
            const value = executorResponse[key];
            if (typeof value === 'string' && value.length > 100 && (value.includes('#') || value.includes('\n'))) {
              fullArticleContent = value;
              console.log('[SubtaskEngine] ✅ 从 responseContent.' + key + ' 提取文章内容');
              break;
            }
          }
        }
        
        if (fullArticleContent && typeof fullArticleContent === 'string' && fullArticleContent.length > 100) {
          console.log('[SubtaskEngine] ✅ 找到完整文章内容，长度:', fullArticleContent.length);
          
          // 获取当前子任务信息
          const subTasks = await db
            .select()
            .from(agentSubTasks)
            .where(eq(agentSubTasks.id, subTaskId as any))
            .limit(1);
          
          if (subTasks.length > 0) {
            const { ArticleContentService } = await import('./article-content-service');
            const articleContentService = ArticleContentService.getInstance();
            
            // 直接保存文章内容，而不是从历史记录中提取
            const savedArticle = await articleContentService.saveArticleContentDirectly(
              subTasks[0],
              fullArticleContent
            );
            
            if (savedArticle) {
              console.log('[SubtaskEngine] ✅ 文章内容保存成功:', savedArticle.articleId);
              
              // 🔥 卡片生成已移至 order_index=3 用户确认后执行
              // 参见 user-decision/route.ts 中的 preview_edit_article 处理逻辑
              
              // ========== 🔥 合规整改后重新生成卡片（order_index=5） ==========
              // 设计原则：合规整改后的内容是最新版本，需要重新生成卡片覆盖旧版本
              const taskTitle = subTasks[0].taskTitle || '';
              const taskMetadata = subTasks[0].metadata as Record<string, any> | null;
              const platformLabel = taskMetadata?.platformLabel || '';
              
              if (platformLabel === '小红书' && taskTitle.includes('合规整改')) {
                console.log('[SubtaskEngine] 🎨 检测到小红书合规整改任务，异步重新生成卡片...');
                
                // 异步重新生成卡片，不阻塞主流程
                (async () => {
                  try {
                    // 1. 解析小红书 JSON 格式
                    let xhsData: { title: string; intro?: string; points: Array<{ title: string; content: string }>; conclusion: string; tags: string[]; fullText?: string } | null = null;
                    
                    const jsonMatch = fullArticleContent.match(/\{[\s\S]*"title"[\s\S]*"points"[\s\S]*\}/);
                    if (jsonMatch) {
                      try {
                        xhsData = JSON.parse(jsonMatch[0]);
                        console.log('[SubtaskEngine] 🎨 合规整改JSON解析成功, points:', xhsData?.points?.length);
                      } catch (parseErr) {
                        console.warn('[SubtaskEngine] 🎨 JSON解析失败，跳过卡片重新生成');
                        return;
                      }
                    }
                    
                    if (!xhsData || !xhsData.points || xhsData.points.length === 0) {
                      console.warn('[SubtaskEngine] 🎨 未解析到有效的 points 数据，跳过卡片重新生成');
                      return;
                    }
                    
                    // 2. 导入卡片生成服务
                    const { generateCardsFromArticle } = await import('./xiaohongshu-card-service');
                    const { uploadXhsCardGroup } = await import('./xhs-storage-service');
                    
                    // 3. 确定卡片数量模式
                    let imageCountMode: '3-card' | '5-card' | '7-card' = '5-card';
                    const metadataImageMode = taskMetadata?.imageCountMode;
                    if (metadataImageMode && ['3-card', '5-card', '7-card'].includes(metadataImageMode)) {
                      imageCountMode = metadataImageMode as '3-card' | '5-card' | '7-card';
                    }
                    console.log('[SubtaskEngine] 🎨 图片模式:', imageCountMode);
                    
                    // 4. 读取自定义配色方案
                    let customColorScheme: any = undefined;
                    try {
                      const { digitalAssetService } = await import('./digital-asset-service');
                      const { styleTemplateService } = await import('./style-template-service');
                      const templateId = await styleTemplateService.getTemplateIdByAccount(subTasks[0].accountId || undefined, subTasks[0].workspaceId);
                      if (templateId) {
                        const rules = await digitalAssetService.listStyleRules(templateId);
                        const colorRule = rules.find(r => r.ruleType === 'color_scheme' && r.metadata?.primaryColor);
                        if (colorRule) {
                          customColorScheme = {
                            primaryColor: colorRule.metadata.primaryColor,
                            secondaryColor: colorRule.metadata.secondaryColor,
                            backgroundColor: colorRule.metadata.backgroundColor,
                            accentColor: colorRule.metadata.accentColor,
                            textPrimaryColor: colorRule.metadata.textPrimaryColor,
                            textSecondaryColor: colorRule.metadata.textSecondaryColor,
                          };
                          console.log('[SubtaskEngine] 🎨 从模板读取配色方案:', customColorScheme.primaryColor);
                        }
                      }
                    } catch (colorErr) {
                      console.warn('[SubtaskEngine] 🎨 读取配色方案失败:', colorErr);
                    }
                    
                    // 5. 生成卡片
                    const cards = await generateCardsFromArticle({
                      title: xhsData.title,
                      intro: xhsData.intro,
                      points: xhsData.points.slice(0, 5),
                      conclusion: xhsData.conclusion || '感谢阅读',
                      tags: xhsData.tags || [],
                    },
                      ['pinkOrange', 'bluePurple', 'tealGreen', 'orangeYellow', 'deepBlue'],
                      imageCountMode,
                      customColorScheme
                    );
                    
                    console.log('[SubtaskEngine] 🎨 合规整改重新生成卡片数量:', cards.length);
                    
                    // 6. 上传到 OSS（覆盖旧版本）
                    if (cards.length < 2) {
                      console.error('[SubtaskEngine] 🎨 卡片数量不足：生成', cards.length, '张，至少需要 2 张');
                      return;
                    }
                    
                    const cardTypes: Array<'cover' | 'point' | 'ending'> = ['cover'];
                    const pointCount = cards.length - 2;
                    for (let pi = 0; pi < pointCount; pi++) {
                      cardTypes.push('point');
                    }
                    cardTypes.push('ending');
                    
                    const uploadResult = await uploadXhsCardGroup(
                      cards.map((card, index) => ({
                        base64: card.base64,
                        cardType: cardTypes[index] || 'point',
                        title: index === 0
                          ? xhsData.title
                          : index === cards.length - 1
                            ? xhsData.conclusion
                            : xhsData.points[index - 1]?.title,
                        content: index === 0
                          ? xhsData.intro
                          : index === cards.length - 1
                            ? (xhsData.tags || []).join(' ')
                            : xhsData.points[index - 1]?.content,
                      })),
                      subTaskId as string,
                      {
                        cardCountMode: imageCountMode,
                        articleTitle: xhsData.title,
                        articleIntro: xhsData.intro,
                        workspaceId: subTasks[0].workspaceId,
                        commandResultId: subTasks[0].commandResultId || undefined,
                      }
                    );
                    
                    console.log('[SubtaskEngine] 🎨 ✅ 合规整改卡片已上传到OSS:', {
                      groupId: uploadResult.groupId,
                      totalCards: uploadResult.totalCards,
                    });
                    
                    // 7. 更新文章的 extInfo（覆盖旧版本）
                    const existingExt = (savedArticle as any).extInfo || {};
                    await db.update(articleContent)
                      .set({
                        extInfo: {
                          ...existingExt,
                          xhsCardStorageKeys: uploadResult.cards.map(c => c.storageKey),
                          xhsCardGroupId: uploadResult.groupId,
                          xhsCardStorageType: 'oss',
                          xhsFullText: xhsData.fullText || '',
                          xhsTags: xhsData.tags || [],
                          xhsIntro: xhsData.intro || '',
                        },
                      } as any)
                      .where(eq(articleContent.articleId, savedArticle.articleId));
                    
                    console.log('[SubtaskEngine] 🎨 ✅ 合规整改卡片信息已更新到文章 extInfo');
                    
                  } catch (cardError) {
                    console.error('[SubtaskEngine] 🎨 ❌ 合规整改卡片重新生成失败:', cardError);
                  }
                })().catch(err => console.error('[SubtaskEngine] 🎨 ❌ 卡片生成异步任务失败:', err));
              }
            } else {
              console.log('[SubtaskEngine] ⚠️ 文章内容保存跳过');
            }
          }
        }
      } catch (articleError) {
        console.error('[SubtaskEngine] ❌ 保存文章内容失败:', articleError);
        // 不影响主流程
      }
    }

    // ========== 🔴 差异化存储策略 ==========
    let storedRequestContent: any;
    let storedResponseContent: any;

    if (agentId === 'agent B') {
      // ========== Agent B：存储完整的审核决策信息 ==========
      const agentBResponse = responseContent as any;
      
      console.log('[SubtaskEngine] 🔴🔴🔴 recordAgentInteraction - Agent B 处理开始');
      console.log('[SubtaskEngine] 🔴🔴🔴 responseContent 原始字段:', Object.keys(agentBResponse || {}));
      console.log('[SubtaskEngine] 🔴🔴🔴 responseContent 原始数据:', JSON.stringify(agentBResponse, null, 2));
      
      // 提取 Agent B 决策的关键信息
      // 🔴🔴🔴 【修复】hasExecutorResult 检查逻辑：检查 requestContent 本身是否有内容
      // requestContent 可能是 ExecutorAgentResult 类型（没有 executorResult 字段）
      // 也可能是包装对象（包含 executorResult 字段）
      const hasExecutorResultContent = (() => {
        if (!requestContent) return false;
        // 如果是包装对象（有 executorResult 字段）
        if (requestContent.executorResult) return true;
        // 如果是 ExecutorAgentResult 类型（有 isNeedMcp 字段）
        if ('isNeedMcp' in requestContent || 'isTaskDown' in requestContent) return true;
        // 如果是普通对象且有内容
        if (typeof requestContent === 'object' && Object.keys(requestContent).length > 0) return true;
        return false;
      })();
      
      storedRequestContent = requestContent && typeof requestContent === 'object'
        ? {
            type: requestContent.type,
            taskTitle: requestContent.taskTitle,
            // 🔴 修复：检查 requestContent 本身是否有内容
            hasExecutorResult: hasExecutorResultContent,
            // 🔴 新增：执行结果概述字段
            briefResponse: requestContent.briefResponse,
            selfEvaluation: requestContent.selfEvaluation,
            actionsTaken: requestContent.executionSummary?.actionsTaken,
            executorOutput: requestContent.executorOutput ? {
            hasContent: !!requestContent.executorOutput.result || !!requestContent.executorOutput.output,
            contentLength: (requestContent.executorOutput.result || requestContent.executorOutput.output || '').length
            } : undefined
          }
        : { hasContent: !!requestContent };

      // 🔴 Agent B 的审核结果必须包含完整的决策信息！
      // 🔴 修复：为关键字段提供兜底值
      // 🔴🔴🔴 【关键修复】先检测传入的格式：
      // 情况1：直接传入 decision 对象（包含 type, reasoning, decisionBasis, notCompletedReason, context）
      // 情况2：传入包装对象（包含 decision: { ... }, mcp_attempts: [ ... ], execution_summary: { ... }）
      let actualDecision: any = null;
      if (agentBResponse?.type || agentBResponse?.decisionType || agentBResponse?.decisionBasis || agentBResponse?.notCompletedReason) {
        // 情况1：直接传入 decision 对象
        actualDecision = agentBResponse;
        console.log('[SubtaskEngine] 🔴🔴🔴 识别到格式1：直接传入 decision 对象');
      } else if (agentBResponse?.decision) {
        // 情况2：传入包装对象，decision 在 decision 字段中
        actualDecision = agentBResponse.decision;
        console.log('[SubtaskEngine] 🔴🔴🔴 识别到格式2：包装对象，decision 在 decision 字段中');
      } else {
        console.warn('[SubtaskEngine] ⚠️ 无法识别 Agent B 响应格式，使用兜底');
        actualDecision = agentBResponse;
      }
      
      console.log('[SubtaskEngine] 🔴🔴🔴 actualDecision 字段:', Object.keys(actualDecision || {}));
      console.log('[SubtaskEngine] 🔴🔴🔴 actualDecision 数据:', JSON.stringify(actualDecision, null, 2));
      
      // 🔴🔴🔴 【新增】详细日志：追踪 requestContent 的结构
      console.log('[SubtaskEngine] 🔴🔴🔴 requestContent 详细分析:', {
        isNull: requestContent === null,
        isUndefined: requestContent === undefined,
        type: typeof requestContent,
        hasIsNeedMcp: requestContent && 'isNeedMcp' in requestContent,
        hasIsTaskDown: requestContent && 'isTaskDown' in requestContent,
        hasExecutorResult: requestContent && 'executorResult' in requestContent,
        keys: requestContent && typeof requestContent === 'object' ? Object.keys(requestContent) : [],
      });
      
      const agentBReasoning = actualDecision?.reasoning 
        ?? actualDecision?.context 
        ?? actualDecision?.suggestion
        ?? actualDecision?.message;
      
      // 🔴 新增：提取 notCompletedReason（用于诊断"为什么不是 COMPLETE"）
      const notCompletedReason = actualDecision?.notCompletedReason;
      
      // 🔴 新增：提取 decisionBasis（判断依据）
      const decisionBasis = actualDecision?.decisionBasis;
      
      // 🔴 新增：提取 suggestedExecutor（建议的执行者）
      const suggestedExecutor = actualDecision?.context?.suggestedExecutor;
      
      console.log('[SubtaskEngine] 🔴🔴🔴 提取的字段:');
      console.log('[SubtaskEngine] 🔴🔴🔴 - notCompletedReason:', notCompletedReason);
      console.log('[SubtaskEngine] 🔴🔴🔴 - decisionBasis:', decisionBasis);
      console.log('[SubtaskEngine] 🔴🔴🔴 - suggestedExecutor:', suggestedExecutor);
      
      // 如果 notCompletedReason 为空但决策不是 COMPLETE，打印警告日志
      const decisionType = actualDecision?.type ?? actualDecision?.decisionType;
      if (decisionType !== 'COMPLETE' && !notCompletedReason) {
        console.warn('[SubtaskEngine] ⚠️ ⚠️ ⚠️ 【诊断】Agent B 未填写 notCompletedReason！', {
          decisionType: decisionType,
          reasonCode: actualDecision?.reasonCode,
          reasoning: agentBReasoning?.substring(0, 100)
        });
      }
      
      // 如果 decisionBasis 为空，打印警告日志
      if (!decisionBasis) {
        console.warn('[SubtaskEngine] ⚠️ ⚠️ ⚠️ 【诊断】Agent B 未填写 decisionBasis！', {
          decisionType: decisionType,
          reasonCode: actualDecision?.reasonCode
        });
      }
      
      storedResponseContent = agentBResponse
        ? {
            // 决策类型（COMPLETE, EXECUTE_MCP, NEED_USER, FAILED）
            decisionType: decisionType,
            // 审核结论
            isCompleted: actualDecision?.isCompleted ?? (decisionType === 'COMPLETE'),
            isNeedMcp: actualDecision?.isNeedMcp ?? (decisionType !== 'COMPLETE'),
            // 🔴 新增：为什么不是 COMPLETE？（诊断字段）
            notCompletedReason: notCompletedReason,
            // 🔴 新增：判断依据（详细说明为什么做这个决策）
            decisionBasis: decisionBasis,
            // 🔴 新增：评审结论描述（不超过120字）
            reviewConclusion: actualDecision?.reviewConclusion?.substring(0, 120),
            // Agent B 的决策详情
            decision: {
              type: decisionType,
              // 🔴 修复：reasoning 为空时从其他字段兜底
              reasoning: agentBReasoning ? agentBReasoning.substring(0, 500) : undefined,
              reasonCode: actualDecision?.reasonCode ?? actualDecision?.code,
              // 🔴 修复：context 为空时从 reasoning 兜底
              // 🔴 新增：提取 suggestedExecutor（建议的执行者）
              context: actualDecision?.context 
                ? {
                    ...actualDecision.context,
                    suggestedExecutor: suggestedExecutor
                  }
                : agentBReasoning?.substring(0, 200)
            },
            // MCP 执行历史摘要
            mcpAttemptsSummary: agentBResponse.mcp_attempts || agentBResponse.mcpAttempts
              ? (agentBResponse.mcp_attempts || agentBResponse.mcpAttempts).map((m: any) => ({
                  toolName: m.decision?.toolName,
                  actionName: m.decision?.actionName,
                  status: m.result?.status,
                  executionTime: m.result?.executionTime
                }))
              : [],
            // 执行摘要
            executionSummary: agentBResponse.execution_summary || agentBResponse.executionSummary
          }
        : { hasContent: false };
      
      console.log('[SubtaskEngine] 🔴🔴🔴 最终 storedResponseContent 字段:', Object.keys(storedResponseContent));
      console.log('[SubtaskEngine] 🔴🔴🔴 最终 storedResponseContent:', JSON.stringify(storedResponseContent, null, 2));
      console.log('[SubtaskEngine] 🔴🔴🔴 recordAgentInteraction - Agent B 处理完成');

    } else if (agentId === 'agent T' || agentId === 'T') {
      // ========== Agent T：技术执行者，使用与 insurance-d 一致的 Executor 格式 ==========
      // 🔴 修复：同时支持 'agent T' 和 'T'（数据库中 from_parents_executor 字段可能是 'T'）
      const executorResponse = responseContent as any;
      
      // Agent T 的 structuredResult（兼容两种格式）
      // 🔴🔴🔴 【修复】Agent T 的 executionSummary 可能在根对象，也可能在 structuredResult 中
      const structuredResult = executorResponse?.structuredResult;
      const executionSummary = executorResponse?.executionSummary ?? structuredResult?.executionSummary;
      const toolsUsed = executionSummary?.toolsUsed || [];
      const actionsTaken = executionSummary?.actionsTaken || [];
      storedRequestContent = requestContent && typeof requestContent === 'object'
        ? {
            type: requestContent.type || 'executor_agent_execution',
            taskTitle: requestContent.taskTitle,
            description: requestContent.description?.substring(0, 200), // 截取前200字符
            hasStructuredResult: !!structuredResult,
            // 🔴 新增：原始指令信息（与 insurance-d 一致）
            originalInstruction: requestContent.originalInstruction
              ? {
                  title: requestContent.originalInstruction.title,
                  description: requestContent.originalInstruction.description?.substring(0, 300)
                }
              : undefined
          }
        : { hasContent: !!requestContent };

      // 🔴 Agent T 的执行结果
      const resultText = structuredResult?.resultContent 
        ?? executorResponse?.result;
      
      // 🔴 提取 mcpParams（可能直接在根对象，也可能在 executorOutput 中）
      // 🔴🔴🔴 调试：检查 mcpParams 的提取路径
      const rawMcpParams1 = executorResponse?.mcpParams;
      const rawMcpParams2 = executorResponse?.executorOutput?.mcpParams;
      const mcpParams = rawMcpParams1 ?? rawMcpParams2;
      console.log('[SubtaskEngine] 🔍 mcpParams 提取调试:', {
        'agentId': agentId,
        'executorResponse 存在': !!executorResponse,
        'executorResponse.mcpParams': rawMcpParams1 ? '有值' : 'undefined/null',
        'executorResponse.executorOutput 存在': !!executorResponse?.executorOutput,
        'executorResponse.executorOutput.mcpParams': rawMcpParams2 ? '有值' : 'undefined/null',
        '最终 mcpParams': mcpParams ? { toolName: mcpParams.toolName, actionName: mcpParams.actionName } : 'undefined/null'
      });
      
      // 🔴🔴🔴 新增：提取 briefResponse 和 resultSummary（与 insurance-d 一致）
      // 🔴🔴🔴 【修复】优先从 executionSummary 中提取（Agent T 的新格式）
      // briefResponse：简短响应摘要
      const briefResponse = executionSummary?.briefResponse
        ?? structuredResult?.briefResponse
        ?? structuredResult?.selfEvaluation
        ?? executorResponse?.result?.substring(0, 200)
        ?? executorResponse?.suggestion?.substring(0, 200)
        ?? executorResponse?.briefResponse;
      
      // resultSummary：结果摘要
      const resultSummary = structuredResult?.resultSummary
        ?? executionSummary?.resultContent?.resultSummary
        ?? executorResponse?.resultSummary
        ?? executorResponse?.result;
      
      // selfEvaluation：自我评价
      const selfEvaluation = executionSummary?.selfEvaluation
        ?? structuredResult?.selfEvaluation;
      
      // 🔴🔴🔴 新增：提取 isNeedSplit、splitReason、suggestedSplitPoints（自动拆分功能）
      // 🔴 修复：同时支持 splitPoints 和 suggestedSplitPoints（兼容不同调用方）
      const isNeedSplit = executorResponse?.isNeedSplit ?? structuredResult?.isNeedSplit ?? false;
      const splitReason = executorResponse?.splitReason ?? structuredResult?.splitReason ?? '';
      const suggestedSplitPoints = executorResponse?.suggestedSplitPoints ?? executorResponse?.splitPoints ?? structuredResult?.suggestedSplitPoints ?? [];
      
      // 🔴🔴🔴 调试日志：追踪 isNeedSplit 的来源
      console.log('[SubtaskEngine] Agent T 分支 - isNeedSplit 追踪:', {
        'executorResponse.isNeedSplit': executorResponse?.isNeedSplit,
        'structuredResult.isNeedSplit': structuredResult?.isNeedSplit,
        'final_isNeedSplit': isNeedSplit,
        'executorResponse_keys': executorResponse ? Object.keys(executorResponse) : []
      });
      
      storedResponseContent = executorResponse
        ? {
            // 🔴 Executor 标准格式
            isCompleted: executorResponse.isCompleted ?? false,
            // 🔴 新增：MCP 执行结果（重要！）
            mcpSuccess: executorResponse.executorOutput?.mcpSuccess ?? requestContent.mcpSuccess,
            // 🔴 新增：Agent T 的判断说明
            result: executorResponse.result,  // 执行结论
            suggestion: executorResponse.suggestion,  // 建议
            reasoning: structuredResult?.executionSummary?.resultContent?.reasoning,  // 推理过程
            decisionContent: structuredResult?.executionSummary?.resultContent,  // 完整决策内容
            // 🔴🔴🔴 新增：briefResponse、resultSummary、selfEvaluation（与 insurance-d 一致）
            briefResponse: briefResponse,
            resultSummary: resultSummary,
            // 🔴🔴🔴 【修复】使用提取的 selfEvaluation 变量
            selfEvaluation: selfEvaluation,  // 自我评价
            decisionBasis: structuredResult?.decisionBasis,  // 🔴 新增：决策依据
            // 🔴 MCP 参数（如果需要执行 MCP）
            mcpParams: mcpParams,
            // 🔴🔴🔴 【修复】失败原因：优先从根对象提取，兜底从 executionSummary 提取
            // Agent T 可能在根对象返回 failureReason，也可能在 structuredResult 中
            failureReason: executorResponse?.failureReason ?? executionSummary?.failureReason,
            // 🔴🔴🔴 【新增】decisionContent：包含详细的拒绝原因
            decisionContent: executorResponse?.decisionContent ?? structuredResult?.resultContent,
            // 使用了哪些工具
            toolsUsed: toolsUsed,
            // 采取了哪些行动
            actionsTaken: actionsTaken,
            // 🔴🔴🔴 新增：自动拆分相关字段
            isNeedSplit: isNeedSplit,  // 是否需要拆分
            splitReason: splitReason,  // 拆分原因
            suggestedSplitPoints: suggestedSplitPoints,  // 建议的拆分点
            // 🔴 执行 Agent 标准格式：只有 COMPLETE 和 FAILED
            // 🔴 修复：移除 NEED_MCP，因为 Agent T 现在是执行 Agent，不是技术选择者
            decisionType: executorResponse.isCompleted ? 'COMPLETE' : 'FAILED'
          }
        : { hasContent: false };
      
      console.log('[SubtaskEngine] Agent T 执行结果记录:', {
        isCompleted: executorResponse?.isCompleted,
        hasMcpParams: !!mcpParams,
        toolName: mcpParams?.toolName,
        // 🔴🔴🔴 调试：检查 storedResponseContent 是否包含 mcpParams
        storedResponseContent_mcpParams: storedResponseContent && typeof storedResponseContent === 'object' ? (storedResponseContent as any).mcpParams : undefined,
        decisionType: executorResponse?.isCompleted ? 'COMPLETE' : 'FAILED',
        hasBriefResponse: !!briefResponse,
        hasResultSummary: !!resultSummary,
        // 🔴 新增：自动拆分相关字段
        isNeedSplit: isNeedSplit,
        hasSplitPoints: suggestedSplitPoints.length > 0
      });

    } else {
      // ========== 执行 Agent（insurance-d等）：精简存储，只保留关键信息 ==========
      const executorResponse = responseContent as any;
      
      // 对于执行 Agent，只存储精简的请求内容（去掉大文本）
      storedRequestContent = requestContent && typeof requestContent === 'object'
        ? {
            type: requestContent.type,
            taskTitle: requestContent.taskTitle,
            description: requestContent.description?.substring(0, 200), // 截取前200字符
            hasStructuredResult: !!requestContent.executorResult?.structuredResult,
            // 🔴 只保留原始指令信息，不存储 executionSummary（避免重复）
            originalInstruction: requestContent.executorResult?.structuredResult?.originalInstruction
              ? {
                  title: requestContent.executorResult.structuredResult.originalInstruction.title,
                  description: requestContent.executorResult.structuredResult.originalInstruction.description?.substring(0, 300)
                }
              : undefined
          }
        : { hasContent: !!requestContent };

      // 执行 Agent 的响应：去掉冗余的大文本内容
      const structuredResult = executorResponse?.executorOutput?.structuredResult;
      
      // 🔴 修复：为 briefRequest 和 briefResponse 提供兜底值
      // 如果 LLM 没有返回这些字段，从其他字段提取
      const briefRequest = structuredResult?.briefRequest 
        ?? executorResponse?.executorOutput?.taskInstruction?.substring(0, 200)
        ?? structuredResult?.originalInstruction?.description?.substring(0, 200);
      
      const briefResponse = structuredResult?.briefResponse
        ?? structuredResult?.selfEvaluation
        ?? executorResponse?.executorOutput?.result?.substring(0, 200)
        ?? executorResponse?.executorOutput?.suggestion;
      
      // 🔴🔴🔴 修复：提取 result 字段，支持多种路径
      // insurance-d 可能返回的 result 位置：
      // 1. executorResponse.result
      // 2. executorResponse.resultSummary
      // 3. executorResponse.executorOutput.result
      // 4. structuredResult?.resultContent
      // 5. 从 responseContent 的任意字符串字段中找【执行结论】或【无法处理】开头的内容
      let extractedResult: string | undefined = executorResponse.result;
      
      if (!extractedResult && executorResponse.resultSummary) {
        extractedResult = executorResponse.resultSummary;
        console.log('[SubtaskEngine] ✅ 从 resultSummary 提取 result');
      }
      
      if (!extractedResult && executorResponse.executorOutput?.result) {
        extractedResult = executorResponse.executorOutput.result;
        console.log('[SubtaskEngine] ✅ 从 executorOutput.result 提取 result');
      }
      
      if (!extractedResult && structuredResult?.resultContent) {
        // 🔴 修复：确保 resultContent 是字符串
        extractedResult = typeof structuredResult.resultContent === 'string' 
          ? structuredResult.resultContent 
          : JSON.stringify(structuredResult.resultContent);
        console.log('[SubtaskEngine] ✅ 从 structuredResult.resultContent 提取 result');
      }
      
      // 🔴 兜底：从 responseContent 的任意字符串字段中找执行结论
      if (!extractedResult) {
        const keys = Object.keys(executorResponse || {});
        for (const key of keys) {
          const value = executorResponse[key];
          if (typeof value === 'string' && 
              (value.includes('【执行结论】') || 
               value.includes('【无法执行】') || 
               value.includes('【无法处理】'))) {
            extractedResult = value;
            console.log('[SubtaskEngine] ✅ 从 responseContent.' + key + ' 提取 result（兜底）');
            break;
          }
        }
      }
      
      storedResponseContent = executorResponse
        ? {
            // 🔴🔴🔴 支持 v2 格式 isCompleted 和 result 字段
            // insurance-d v2 格式：isCompleted=false 时，无法执行的原因放在 result 字段中（以【无法执行】开头）
            isCompleted: executorResponse.isCompleted,
            // 🔴 修复：result 字段，支持多种提取路径
            result: extractedResult,
            // 🔴 reason 字段（向后兼容，如果没有则从 result 提取）
            // 🔴 修复：确保 extractedResult 是字符串才调用 includes
            reason: executorResponse.reason || 
                   (typeof extractedResult === 'string' && extractedResult.includes('【无法执行】') ? extractedResult : undefined) ||
                   (typeof extractedResult === 'string' && extractedResult.includes('【无法处理】') ? extractedResult : undefined),
            // 关键标识
            isNeedMcp: executorResponse.isNeedMcp,
            isTaskDown: executorResponse.isTaskDown,
            // 只保留简短摘要
            resultSummary: executorResponse.executorOutput?.result
              ? executorResponse.executorOutput.result.substring(0, 200) + '...'
              : executorResponse.resultSummary,
            // 保留结构化信息但不存储大文本
            executionSummary: structuredResult?.executionSummary,
            selfEvaluation: structuredResult?.selfEvaluation,
            briefRequest: briefRequest ? briefRequest.substring(0, 200) + '...' : undefined,
            briefResponse: briefResponse ? briefResponse.substring(0, 200) + '...' : undefined,
            // 标记是否有完整内容（便于调试）
            _hasFullContent: !!(executorResponse.executorOutput?.result || executorResponse.executorOutput?.output),
            _contentLength: (executorResponse.executorOutput?.result || executorResponse.executorOutput?.output || '').length
          }
        : { hasContent: false };
    }

    // ========== 🔴🔴🔴 关键：使用原子性操作 + 重试机制避免重复插入 ==========
    // 🔴 修复：使用 FOR UPDATE SKIP LOCKED 防止并发冲突，并确保查询到最新的 interactNum
    const MAX_RETRIES = 5;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 步骤 1: 使用事务 + FOR UPDATE SKIP LOCKED 获取唯一的 interactNum
        // 先查询所有已存在的 interactNum，然后计算下一个可用的
        const existingRecords = await db
          .select({ 
            id: agentSubTasksStepHistory.id,
            interactNum: agentSubTasksStepHistory.interactNum
          })
          .from(agentSubTasksStepHistory)
          .where(
            and(
              eq(agentSubTasksStepHistory.commandResultId, commandResultId as any),
              eq(agentSubTasksStepHistory.stepNo, stepNo),
              eq(agentSubTasksStepHistory.interactType, 'agent_interaction')
            )
          )
          .orderBy(agentSubTasksStepHistory.interactNum);

        // 🔴 修复：计算所有已使用的 interactNum，找最小的可用数字
        const usedNums = new Set(existingRecords.map(r => r.interactNum));
        let nextInteractNum = 1;
        while (usedNums.has(nextInteractNum)) {
          nextInteractNum++;
        }
        
        console.log(
          `[SubtaskEngine] 🔴 [尝试 ${attempt}/${MAX_RETRIES}] 已存在 ${existingRecords.length} 条记录，已使用: [${[...usedNums].sort((a,b)=>a-b).join(',')}]，分配下一个可用 interactNum: ${nextInteractNum}`
        );

        // 步骤 2: 尝试插入记录（利用数据库唯一约束防止重复）
        console.log(`[SubtaskEngine] [尝试 ${attempt}/${MAX_RETRIES}] 准备插入记录...`);
        await db.insert(agentSubTasksStepHistory)
          .values({
            commandResultId,
            stepNo,
            interactType: 'agent_interaction',
            interactNum: nextInteractNum,
            interactUser: agentId,
            interactContent: {
              type: 'agent_interaction',
              agentId,
              responseStatus,
              requestContent: storedRequestContent,
              responseContent: storedResponseContent,
              timestamp: getCurrentBeijingTime().toISOString()
            },
            interactTime: getCurrentBeijingTime(),
          });

        // 插入成功！
        console.log('[SubtaskEngine] ✅ Agent 完整交互记录完成:', { 
          interactNum: nextInteractNum,
          attempt,
          storageStrategy: (agentId === 'agent B' || agentId === 'agent T' || agentId === 'T') ? 'simplified' : 'full'
        });
        return nextInteractNum;
        
      } catch (error: any) {
        lastError = error;
        
        // 检查是否是唯一约束冲突（PostgreSQL 错误码 23505）
        if (error.code === '23505') {
          console.warn(`[SubtaskEngine] ⚠️ [尝试 ${attempt}/${MAX_RETRIES}] 唯一约束冲突，重新查询并分配新的 interactNum...`);
          
          // 如果不是最后一次尝试，等待一小段时间后重新查询
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 50 * attempt)); // 指数退避
            continue;
          }
        }
        
        // 其他错误，直接抛出
        console.error(`[SubtaskEngine] ❌ [尝试 ${attempt}/${MAX_RETRIES}] 插入失败:`, error);
        throw error;
      }
    }
    
    // 所有重试都失败了
    console.error('[SubtaskEngine] ❌ 所有重试都失败了，最后一次错误:', lastError);
    throw lastError;
  }

  /**
   * 记录 MCP 执行情况
   * 在 MCP 执行完成后调用
   * 🔴 修复：增加重复插入防护、自动生成 resultText、异常处理
   */
  public async recordMcpExecution(
    commandResultId: string,
    stepNo: number,
    subTaskId: number | string,
    interactNum: number,
    mcpData: {
      attemptId: string;
      attemptNumber: number;
      toolName?: string;
      actionName?: string;
      params?: any;
      resultStatus: string;
      resultData?: any;
      resultText?: string;
      errorCode?: string;
      errorMessage?: string;
      errorType?: string;
      executionTimeMs?: number;
    }
  ) {
    console.log('[SubtaskEngine] 🔴 记录 MCP 执行:', { 
      toolName: mcpData.toolName, 
      actionName: mcpData.actionName, 
      resultStatus: mcpData.resultStatus,
      attemptId: mcpData.attemptId
    });

    // ========== 🔴 修复：使用 commandResultId + attemptId 替代 subTaskId ==========
    const existingRecord = await db
      .select({ id: agentSubTasksMcpExecutions.id })
      .from(agentSubTasksMcpExecutions)
      .where(
        and(
          eq(agentSubTasksMcpExecutions.commandResultId, commandResultId as any),
          eq(agentSubTasksMcpExecutions.attemptId, mcpData.attemptId)
        )
      );

    // ========== 🔴 修复：如果记录已存在（可能是 pending 状态），更新它 ==========
    if (existingRecord.length > 0) {
      console.log(
        `[SubtaskEngine] ⚠️  MCP 执行记录已存在，尝试更新状态: ` +
        `commandResultId=${commandResultId}, ` +
        `attemptId=${mcpData.attemptId}`
      );
      
      // 🔴 修复：如果记录已存在（可能是 pending 状态），更新它
      try {
        await db
          .update(agentSubTasksMcpExecutions)
          .set({
            resultStatus: mcpData.resultStatus as any,
            resultData: mcpData.resultData as any,
            resultText: mcpData.resultText || (mcpData.resultData ? JSON.stringify(mcpData.resultData, null, 2) : null) as any,
            errorCode: mcpData.errorCode as any,
            errorMessage: mcpData.errorMessage as any,
            errorType: mcpData.errorType as any,
            executionTimeMs: mcpData.executionTimeMs || 0,
          })
          .where(
            and(
              eq(agentSubTasksMcpExecutions.commandResultId, commandResultId as any),
              eq(agentSubTasksMcpExecutions.attemptId, mcpData.attemptId)
            )
          );
        
        console.log('[SubtaskEngine] ✅ MCP 执行记录状态更新成功');
      } catch (updateError) {
        console.error('[SubtaskEngine] ❌ MCP 执行记录状态更新失败:', updateError);
      }
      
      return;
    }

    // ========== 🔴 新增：如果没有 resultText，自动生成 ==========
    let resultText = mcpData.resultText;
    if (!resultText && mcpData.resultData) {
      try {
        resultText = await this.generateMcpResultText({
          decision: {
            toolName: mcpData.toolName,
            actionName: mcpData.actionName,
          },
          result: {
            status: mcpData.resultStatus,
            data: mcpData.resultData,
          },
        });
        console.log('[SubtaskEngine] ✅ 自动生成 MCP resultText 成功');
      } catch (error) {
        console.warn('[SubtaskEngine] ⚠️  自动生成 MCP resultText 失败，将留空:', error);
      }
    }

    // ========== 🔴 新增：使用 UPSERT 模式避免唯一索引冲突 ==========
    try {
      await db.insert(agentSubTasksMcpExecutions)
        .values({
          commandResultId,
          orderIndex: stepNo,
          attemptId: mcpData.attemptId,
          attemptNumber: mcpData.attemptNumber,
          attemptTimestamp: getCurrentBeijingTime(),
          toolName: mcpData.toolName as any,
          actionName: mcpData.actionName as any,
          params: mcpData.params as any,
          resultStatus: mcpData.resultStatus as any,
          resultData: mcpData.resultData as any,
          resultText: resultText as any,
          errorCode: mcpData.errorCode as any,
          errorMessage: mcpData.errorMessage as any,
          errorType: mcpData.errorType as any,
          executionTimeMs: mcpData.executionTimeMs || 0,
        })
        .onConflictDoUpdate({
          target: [agentSubTasksMcpExecutions.commandResultId, agentSubTasksMcpExecutions.orderIndex],
          set: {
            attemptId: mcpData.attemptId,
            attemptNumber: mcpData.attemptNumber,
            attemptTimestamp: getCurrentBeijingTime(),
            toolName: mcpData.toolName as any,
            actionName: mcpData.actionName as any,
            params: mcpData.params as any,
            resultStatus: mcpData.resultStatus as any,
            resultData: mcpData.resultData as any,
            resultText: resultText as any,
            errorCode: mcpData.errorCode as any,
            errorMessage: mcpData.errorMessage as any,
            errorType: mcpData.errorType as any,
            executionTimeMs: mcpData.executionTimeMs || 0,
          }
        });

      console.log('[SubtaskEngine] ✅ MCP 执行记录完成');
    } catch (insertError) {
      console.warn(
        `[SubtaskEngine] ⚠️  MCP 执行记录失败，但不影响主流程: ` +
        `attemptId=${mcpData.attemptId}, ` +
        `error=${insertError instanceof Error ? insertError.message : String(insertError)}`
      );
    }
  }

  // ========== 🔴 🔴 🔴 新增：组合方法 - 同时记录 Agent 交互和 MCP 执行（事务保证） ==========

  /**
   * 组合方法 - 同时记录 Agent 交互和 MCP 执行
   * 使用事务保证数据一致性
   */
  public async recordAgentInteractionWithMcp(
    commandResultId: string,
    stepNo: number,
    agentId: string,
    requestContent: any,
    responseStatus: 'pre_completed' | 'pre_need_support' | 'pre_failed' | 'EXECUTE_MCP' | 'COMPLETE' | 'NEED_USER' | 'FAILED' | 'REEXECUTE_EXECUTOR',
    responseContent: any,
    subTaskId: number,
    mcpDataList: Array<{
      attemptId: string;
      attemptNumber: number;
      toolName?: string;
      actionName?: string;
      params?: any;
      resultStatus: string;
      resultData?: any;
      resultText?: string;
      errorCode?: string;
      errorMessage?: string;
      errorType?: string;
      executionTimeMs?: number;
    }>
  ): Promise<{ interactNum: number; success: boolean }> {
    console.log('[SubtaskEngine] 🔴 记录 Agent 交互 + MCP 执行（事务保证）:', { 
      agentId, 
      responseStatus, 
      mcpCount: mcpDataList.length 
    });

    try {
      const result = await db.transaction(async (tx) => {
        const interactionFingerprint = this.generateInteractionFingerprint(
          agentId,
          requestContent,
          responseStatus
        );

        const existingInteractions = await tx
          .select({ 
            id: agentSubTasksStepHistory.id,
            interactNum: agentSubTasksStepHistory.interactNum,
            interactContent: agentSubTasksStepHistory.interactContent
          })
          .from(agentSubTasksStepHistory)
          .where(
            and(
              eq(agentSubTasksStepHistory.commandResultId, commandResultId as any),
              eq(agentSubTasksStepHistory.stepNo, stepNo),
              eq(agentSubTasksStepHistory.interactType, 'agent_interaction'),
              eq(agentSubTasksStepHistory.interactUser, agentId)
            )
          );

        let interactNum: number;
        let isNewInteraction = true;

        for (const record of existingInteractions) {
          if (this.isDuplicateInteraction(record.interactContent, interactionFingerprint)) {
            console.log('[SubtaskEngine] ⚠️  Agent 交互记录已存在，复用:', record.interactNum);
            interactNum = record.interactNum;
            isNewInteraction = false;
            break;
          }
        }

        if (isNewInteraction) {
          interactNum = existingInteractions.length > 0
            ? Math.max(...existingInteractions.map(r => r.interactNum || 1)) + 1
            : 1;

          await tx.insert(agentSubTasksStepHistory)
            .values({
              commandResultId,
              stepNo,
              interactType: 'agent_interaction',
              interactNum,
              interactUser: agentId,
              interactContent: {
                type: 'agent_interaction',
                agentId,
                requestContent,
                responseStatus,
                responseContent,
                timestamp: getCurrentBeijingTime().toISOString(),
                fingerprint: interactionFingerprint,
                hasMcpExecutions: mcpDataList.length > 0,
                mcpCount: mcpDataList.length,
              },
              interactTime: getCurrentBeijingTime(),
            });

          console.log('[SubtaskEngine] ✅ Agent 交互记录插入成功:', { interactNum });
        }

        for (const mcpData of mcpDataList) {
          // ========== 🔴 修复：使用 commandResultId + attemptId 替代 subTaskId ==========
          const existingMcp = await tx
            .select({ id: agentSubTasksMcpExecutions.id })
            .from(agentSubTasksMcpExecutions)
            .where(
              and(
                eq(agentSubTasksMcpExecutions.commandResultId, commandResultId as any),
                eq(agentSubTasksMcpExecutions.attemptId, mcpData.attemptId)
              )
            );

          if (existingMcp.length > 0) {
            console.log('[SubtaskEngine] ⚠️  MCP 记录已存在，跳过:', mcpData.attemptId);
            continue;
          }

          let resultText = mcpData.resultText;
          if (!resultText && mcpData.resultData) {
            try {
              resultText = await this.generateMcpResultText({
                decision: {
                  toolName: mcpData.toolName,
                  actionName: mcpData.actionName,
                },
                result: {
                  status: mcpData.resultStatus,
                  data: mcpData.resultData,
                },
              });
            } catch (error) {
              console.warn('[SubtaskEngine] ⚠️  自动生成 MCP resultText 失败:', error);
            }
          }

          // 🔴 修复：使用 UPSERT 模式避免唯一索引冲突
          await tx.insert(agentSubTasksMcpExecutions)
            .values({
              commandResultId,
              orderIndex: stepNo,
              attemptId: mcpData.attemptId,
              attemptNumber: mcpData.attemptNumber,
              attemptTimestamp: getCurrentBeijingTime(),
              toolName: mcpData.toolName as any,
              actionName: mcpData.actionName as any,
              params: mcpData.params as any,
              resultStatus: mcpData.resultStatus as any,
              resultData: mcpData.resultData as any,
              resultText: resultText as any,
              errorCode: mcpData.errorCode as any,
              errorMessage: mcpData.errorMessage,
              errorType: mcpData.errorType,
              executionTimeMs: mcpData.executionTimeMs || 0,
            })
            .onConflictDoUpdate({
              target: [agentSubTasksMcpExecutions.commandResultId, agentSubTasksMcpExecutions.orderIndex],
              set: {
                attemptId: mcpData.attemptId,
                attemptNumber: mcpData.attemptNumber,
                attemptTimestamp: getCurrentBeijingTime(),
                toolName: mcpData.toolName as any,
                actionName: mcpData.actionName as any,
                params: mcpData.params as any,
                resultStatus: mcpData.resultStatus as any,
                resultData: mcpData.resultData as any,
                resultText: resultText as any,
                errorCode: mcpData.errorCode as any,
                errorMessage: mcpData.errorMessage,
                errorType: mcpData.errorType,
                executionTimeMs: mcpData.executionTimeMs || 0,
              }
            });

          console.log('[SubtaskEngine] ✅ MCP 执行记录插入成功:', mcpData.attemptId);
        }

        return { interactNum, success: true };
      });

      console.log('[SubtaskEngine] ✅ 事务提交成功，Agent 交互 + MCP 执行记录完成');
      return result;
    } catch (error) {
      console.error('[SubtaskEngine] ❌ 事务执行失败:', error);
      throw error;
    }
  }

  // ========== 🔴 🔴 🔴 旧方法保留（待删除） ==========

  /**
   * 创建交互记录
   * @param commandResultId - 关联的 commandResultId
   * @param stepNo - 步骤编号
   * @param interactType - 交互类型（'request' | 'response' | 'agent_consult' | 'agent_response'）
   * @param interactNum - 交互次数（成对时共用同一个）
   * @param interactUser - 交互发起方
   * @param content - 交互内容（InteractContent）
   */
  public async createInteractionStep(
    commandResultId: string,
    stepNo: number,
    interactType: string,
    interactNum: number,
    interactUser: string,
    content: any,
    subTaskId: number  // 🔴 新增：添加 subTaskId 参数
  ) {
    console.log('[SubtaskEngine] 🔴 createInteractionStep 被调用:', {
      commandResultId,
      stepNo,
      interactType,
      interactNum,
      interactUser
    });

    // ========== 第一步：先检查记录是否已存在 ==========
    console.log('[SubtaskEngine] 🔴 检查记录是否已存在...');
    const existingRecord = await db
      .select({ id: agentSubTasksStepHistory.id })
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, commandResultId),
          eq(agentSubTasksStepHistory.stepNo, stepNo),
          eq(agentSubTasksStepHistory.interactType, interactType),
          eq(agentSubTasksStepHistory.interactNum, interactNum),
          eq(agentSubTasksStepHistory.interactUser, interactUser) // 🔴 修复：加上 interactUser，匹配唯一键约束
        )
      );

    console.log('[SubtaskEngine] 🔴 现有记录查询结果:', {
      foundCount: existingRecord.length,
      existingRecords: existingRecord
    });

    // ========== 如果记录已存在，直接返回，不重复插入 ==========
    if (existingRecord.length > 0) {
      console.log(
        `[SubtaskEngine] ⚠️  ⚠️  ⚠️  交互记录已存在，跳过插入: ` +
        `commandResultId=${commandResultId}, ` +
        `stepNo=${stepNo}, ` +
        `interactType=${interactType}, ` +
        `interactNum=${interactNum}`
      );
      return;
    }

    console.log('[SubtaskEngine] 🔴 记录不存在，执行插入...');

    // ========== 记录不存在，执行插入 ==========
    // 🔴 修复：捕获插入错误，不要让唯一约束错误中断主流程
    try {
      await db.transaction(async (tx) => {
        const [stepHistory] = await tx.insert(agentSubTasksStepHistory)
          .values({
            commandResultId,
            stepNo,
            interactType,
            interactNum,
            interactContent: content,
            interactUser,
            interactTime: getCurrentBeijingTime(),
          })
          .returning({ id: agentSubTasksStepHistory.id });

        const mcpAttempts = content?.response?.mcp_attempts;
        if (mcpAttempts && Array.isArray(mcpAttempts) && mcpAttempts.length > 0) {
          for (const attempt of mcpAttempts) {
            // 🔥 新增：生成 MCP 执行结果的文本化格式 (LLM 优化)
            const resultText = await this.generateMcpResultText(attempt);
            
            // 🔴 修复：使用 UPSERT 模式避免唯一索引冲突
            // 唯一索引 unique_pending_execution 限制 (command_result_id, order_index) 唯一
            // 改用 INSERT ... ON CONFLICT DO UPDATE 模式，允许同一任务多次尝试
            await tx.insert(agentSubTasksMcpExecutions)
              .values({
                commandResultId,
                orderIndex: stepNo,
                attemptId: attempt.attemptId,
                attemptNumber: attempt.attemptNumber,
                attemptTimestamp: attempt.timestamp,
                solutionNum: attempt.decision?.solutionNum as any,
                toolName: attempt.decision?.toolName as any,
                actionName: attempt.decision?.actionName as any,
                reasoning: attempt.decision?.reasoning as any,
                strategy: attempt.decision?.strategy as any,
                params: attempt.params as any,
                resultStatus: attempt.result?.status as any,
                resultData: attempt.result?.data as any,
                resultText: resultText,
                errorCode: attempt.result?.error?.code,
                errorMessage: attempt.result?.error?.message,
                errorType: attempt.result?.error?.type,
                executionTimeMs: attempt.result?.executionTime,
                isRetryable: attempt.failureAnalysis?.isRetryable,
                failureType: attempt.failureAnalysis?.failureType,
                suggestedNextAction: attempt.failureAnalysis?.suggestedNextAction,
              })
              .onConflictDoUpdate({
                target: [agentSubTasksMcpExecutions.commandResultId, agentSubTasksMcpExecutions.orderIndex],
                set: {
                  attemptId: attempt.attemptId,
                  attemptNumber: attempt.attemptNumber,
                  attemptTimestamp: attempt.timestamp,
                  solutionNum: attempt.decision?.solutionNum as any,
                  toolName: attempt.decision?.toolName as any,
                  actionName: attempt.decision?.actionName as any,
                  reasoning: attempt.decision?.reasoning as any,
                  strategy: attempt.decision?.strategy as any,
                  params: attempt.params as any,
                  resultStatus: attempt.result?.status as any,
                  resultData: attempt.result?.data as any,
                  resultText: resultText,
                  errorCode: attempt.result?.error?.code,
                  errorMessage: attempt.result?.error?.message,
                  errorType: attempt.result?.error?.type,
                  executionTimeMs: attempt.result?.executionTime,
                  isRetryable: attempt.failureAnalysis?.isRetryable,
                  failureType: attempt.failureAnalysis?.failureType,
                  suggestedNextAction: attempt.failureAnalysis?.suggestedNextAction,
                }
              });
          }
        }
        
        console.log('[SubtaskEngine] 🔴 ✅ 交互记录插入成功:', {
          stepHistoryId: stepHistory.id,
          commandResultId,
          stepNo,
          interactType,
          interactNum
        });
      });
      
      console.log('[SubtaskEngine] 🔴 ✅ createInteractionStep 完成');
    } catch (insertError) {
      // 🔴 重要：捕获插入错误，不要让它中断主流程！
      console.warn('[SubtaskEngine] ⚠️  ⚠️  ⚠️  交互记录插入失败（可能是唯一约束），但不影响主流程:', {
        error: insertError instanceof Error ? insertError.message : String(insertError),
        commandResultId,
        stepNo,
        interactType,
        interactNum
      });
      console.log('[SubtaskEngine] 🔴 createInteractionStep 完成（插入失败但已捕获）');
    }
  }

  /**
   * 🔥 重写：智能获取前置任务结果（精选清单格式）
   */
  public async getPreviousStepResult(
    allTasks: typeof agentSubTasks.$inferSelect[],
    currentOrderIndex: number,
    currentTask?: typeof agentSubTasks.$inferSelect
  ): Promise<string> {
    console.log('[getPreviousStepResult] ========== 智能获取前置结果（精选清单格式）==========');
    console.log('[getPreviousStepResult] 当前任务:', {
      orderIndex: currentOrderIndex,
      taskTitle: currentTask?.taskTitle
    });
    
    // 1. 找到所有前置任务
    const previousTasks = allTasks
      .filter(task => task.orderIndex < currentOrderIndex)
      .sort((a, b) => b.orderIndex - a.orderIndex);
    
    console.log('[getPreviousStepResult] 找到前置任务数量:', previousTasks.length);
    
    if (previousTasks.length === 0) {
      console.log('[getPreviousStepResult] 没有前置任务');
      return '';
    }
    else
    {
        // 2. 直接按 orderIndex 降序排序（最近的在前）
        const sortedTasks = [...previousTasks].sort((a, b) => b.orderIndex - a.orderIndex);
        
        console.log('[getPreviousStepResult] 排序后的任务数量:', sortedTasks.length);
        console.log('[getPreviousStepResult] 排序后的任务列表:', sortedTasks.map(t => ({
          orderIndex: t.orderIndex,
          title: t.taskTitle
        })));
        
        // 3. 生成精选清单格式
        const resultText = await this.generateCuratedListFormat(sortedTasks);
        
        console.log('[getPreviousStepResult] 精选清单生成完成，总长度:', resultText.length);
        console.log('[getPreviousStepResult] ========== 获取完成 ==========');
        
        return resultText || '';
    }
  }

  /**
   * 🔥 新增：生成精选清单格式
   */
  private async generateCuratedListFormat(
    sortedTasks: Array<typeof agentSubTasks.$inferSelect>
  ): Promise<string> {
    if (sortedTasks.length === 0) return '';
    
    let result = '【前置任务结果清单】\n\n';
    
    // 按 orderIndex 降序显示所有任务
    for (const task of sortedTasks) {
      const taskResultText = await this.getTextFromTask(task);
      result += `【步骤 ${task.orderIndex}：${task.taskTitle}】\n${taskResultText}\n\n`;
    }
    
    result += '【说明】请根据当前任务需要，参考上述相关结果。';
    
    return result;
  }

  /**
   * 🔥 方案 B：从 result_data 中提取执行结果文本
   * 兜底策略：空字符串
   */
  /**
   * 🔥 从写作 Agent 执行结果中提取文章标题（articleTitle）
   * insurance-d / insurance-xiaohongshu 提示词均约束返回 articleTitle 字段
   */
  private extractArticleTitle(result: any, task: typeof agentSubTasks.$inferSelect): string | null {
    if (!result || typeof result !== 'object') return null;

    // 对写作类 Agent 任务的子任务提取标题
    if (task.fromParentsExecutor !== 'insurance-d' && task.fromParentsExecutor !== 'insurance-xiaohongshu') return null;

    const articleTitle = result.articleTitle;
    if (typeof articleTitle === 'string' && articleTitle.trim().length > 0) {
      return articleTitle.trim().substring(0, 50);
    }

    return null;
  }

  /**
   * 🔥 将文章标题同步到同 commandResultId 的所有子任务
   * 这样在任务列表中，同一组的所有子任务都能显示正确的文章主题
   */
  // syncArticleTitleToGroup 已删除 —— 不再将文章标题同步到同组其他子任务
  // 原因：覆盖了"生成创作大纲"、"合规校验"等原始子任务标题

  /**
   * 从 resultData 中提取文本内容，写入 result_text 字段
   * 
   * 优先级（从高到低）：
   * 1. 新信封格式：executorOutput.result.content（统一 ArticleOutputEnvelope）
   * 2. 旧格式兼容：executorOutput.output / executorOutput.result（字符串）
   * 3. structuredResult.resultContent / structuredResult.executionSummary.resultContent
   * 4. output / result / resultSummary 等旧字段
   * 5. 兜底字段：content / articleContent / fullText 等
   */
  /**
   * 🔴🔴🔴 【统一辅助函数】从 resultContent 中提取纯文本
   * 
   * resultContent 有三种形态：
   * 1. 纯文本字符串（直接返回）
   * 2. JSON 字符串（解析后提取 content/outlineText）
   * 3. 对象（直接提取 content/outlineText）
   * 
   * 优先级：content > outlineText（正文优先于大纲）
   * 
   * @param rc resultContent 的值
   * @param path 日志中的路径标识（如 'structuredResult.resultContent'）
   * @returns 提取的纯文本，或 null
   */
  private extractFromResultContent(rc: any, path: string): string | null {
    if (!rc) return null;

    // 辅助：从对象中提取 content、outlineText、htmlContent 或大纲 JSON
    const extractFromObject = (obj: Record<string, any>): string | null => {
      if (typeof obj.content === 'string' && obj.content.trim().length > 0) {
        return obj.content;
      }
      if (typeof obj.outlineText === 'string' && obj.outlineText.trim().length > 0) {
        return obj.outlineText;
      }
      // 🔥 新增：支持 htmlContent（公众号 HTML 格式）
      if (typeof obj.htmlContent === 'string' && obj.htmlContent.trim().length > 0) {
        return obj.htmlContent;
      }
      // 🔥 新增：支持 fullText（小红书旧格式）
      if (typeof obj.fullText === 'string' && obj.fullText.trim().length > 0) {
        return obj.fullText;
      }
      // 🔥 新增：支持大纲 JSON 结构（insurance-d outline 格式）
      // 格式：{ outline: { title: "...", sections: [...] } } 或 { title: "...", sections: [...] }
      if (obj.outline && typeof obj.outline === 'object') {
        return serializeOutlineToText(obj.outline);
      }
      if (obj.sections && Array.isArray(obj.sections)) {
        return serializeOutlineToText(obj);
      }
      return null;
    };

    if (typeof rc === 'string') {
      // 先尝试 JSON 解析
      try {
        const parsed = JSON.parse(rc);
        if (Array.isArray(parsed)) {
          // 🔥 修复：数组情况也支持 htmlContent
          const first = parsed.find(item => 
            (item?.content && typeof item.content === 'string' && item.content.trim().length > 0) ||
            (item?.htmlContent && typeof item.htmlContent === 'string' && item.htmlContent.trim().length > 0)
          );
          if (first) {
            const text = first.content || first.htmlContent || '';
            console.log(`[SubtaskEngine] extractResultText: 从 ${path}[?].content/htmlContent（数组）提取，长度:`, text.length);
            return text;
          }
        } else if (parsed && typeof parsed === 'object') {
          const extracted = extractFromObject(parsed);
          if (extracted) {
            const field = extracted === parsed.htmlContent ? 'htmlContent' : extracted === parsed.content ? 'content' : extracted === parsed.outlineText ? 'outlineText' : 'unknown';
            console.log(`[SubtaskEngine] extractResultText: 从 ${path}.${field}（JSON解析后）提取，长度:`, extracted.length);
            return extracted;
          }
        }
      } catch {
        // JSON 解析失败，检查是否为有效文本
        if (isValidContentText(rc)) {
          console.log(`[SubtaskEngine] extractResultText: 从 ${path}（纯文本）提取，长度:`, rc.length);
          return rc;
        }
      }
    } else if (typeof rc === 'object' && rc !== null) {
      if (Array.isArray(rc)) {
        const first = rc.find(item => 
          item?.content && typeof item.content === 'string' && item.content.trim().length > 0
        );
        if (first) {
          console.log(`[SubtaskEngine] extractResultText: 从 ${path}[?].content（对象数组）提取，长度:`, first.content.length);
          return first.content;
        }
      } else {
        const extracted = extractFromObject(rc);
        if (extracted) {
          const field = extracted === rc.content ? 'content' : 'outlineText';
          console.log(`[SubtaskEngine] extractResultText: 从 ${path}.${field}（对象）提取，长度:`, extracted.length);
          return extracted;
        }
      }
    }

    return null;
  }

  /**
   * 从 resultData 中提取文本内容，写入 result_text 字段
   * 
   * 🔴🔴🔴 【设计原则】写入端统一，读取端确定
   * 
   * 写入端（convertExecutorDirectToAgentResult）已统一：
   * - executorOutput.output 始终是纯文本（从 resultContent 的 content/outlineText 提取）
   * - executorOutput.structuredResult 保留原始 JSON（供下游需要结构化数据的场景使用）
   * - executorOutput.result 是结论性文字
   * 
   * 读取端只需按确定性路径读取：
   * 1. executorOutput.output（写入端已统一为纯文本） ← 主路径
   * 2. 顶层 result.content / result.outlineText（信封格式兼容） ← 新 Agent 输出
   * 3. 顶层 output（极简格式兼容） ← 旧数据兜底
   */
  private extractResultTextFromResultData(resultData: any, executor?: string): string {
    return extractResultTextCore(resultData, { executor, debug: true, debugPrefix: '[SubtaskEngine]' });
  }

  /**
   * 🔥 方案 B：从任务获取文本结果
   * 兜底策略：空字符串
   */
  private async getTextFromTask(task: typeof agentSubTasks.$inferSelect): Promise<string> {
    // 1. 优先用现成的 resultText
    if (task.resultText) {
      return task.resultText;
    }
    
    // 2. 其次从 resultData 提取
    if (task.resultData) {
      return this.extractResultTextFromResultData(task.resultData, task.fromParentsExecutor);
    }
    
    // 3. 兜底：空字符串
    return '';
  }

  /**
   * 🔴 新增：调用 Agent T（技术专家）处理技术任务
   * 当前阶段（Phase 1）：MCP 执行
   * 未来扩展：技术问题处理、技术方案选择等
   */
  /**
   * ========== 🔴🔴🔴 Agent T 核心方法 ==========
   * 当 capabilities 为空时，自动查询 capability_list
   */
  private async callAgentTTechExpert(
    task: typeof agentSubTasks.$inferSelect,
    executionContext: any,
    capabilities?: any[]
  ): Promise<AgentTDecision> {
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== 调用 Agent T（技术专家） ==========');
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 任务信息:', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      taskTitle: task.taskTitle,
      status: task.status
    });
    
    // 🔴🔴🔴 如果没有传入 capabilities，自动查询
    if (!capabilities || capabilities.length === 0) {
      console.log('[SubtaskEngine] 🔴 未传入 capabilities，自动查询 capability_list...');
      const isComplianceTask = task.orderIndex === 2 ||
        task.taskTitle.includes('合规') ||
        task.taskTitle.includes('审核');
      
      capabilities = await this.queryCapabilityList();
      console.log('[SubtaskEngine] 🔴 自动查询到 ' + capabilities.length + ' 个可用能力');
    }
    
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] 可用能力数量:', capabilities.length);
    
    const defaultAccountId = this.getDefaultAccountId(task.fromParentsExecutor);
    const capabilitiesText = this.buildCapabilitiesText(capabilities);
    
    // 🔴🔴🔴 新增：构建用户反馈文本（最高优先级！）
    const userFeedbackText = this.buildUserFeedbackText(executionContext.userFeedback);
    
    // 🔴 详细日志：输出可用的 capability 列表
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== 可用的 capability 列表 ==========');
    capabilities.forEach((cap, index) => {
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] capability ' + (index + 1) + ':', {
        id: cap.id,
        functionDesc: cap.functionDesc,
        capabilityType: cap.capabilityType,
        toolName: cap.toolName,
        actionName: cap.actionName
      });
    });
    
    // 构建MCP执行历史文本（传递当前order_index，用于区分前序和当前）
    const mcpHistoryText = this.buildMcpHistoryText(executionContext.mcpExecutionHistory, task.orderIndex);
    
    // 构建 priorStepOutputText
    let priorStepOutputText = '';
    if (executionContext.priorStepOutput) {
      // 🔴 修复：增大内容长度限制，避免文章内容被截断
      // 原值 3000 太小，导致文章类任务（通常 4000-10000 字符）被截断
      const maxContentLength = 20000;
      let contentToUse = executionContext.priorStepOutput;
      
      if (contentToUse.length > maxContentLength) {
        contentToUse = contentToUse.substring(0, maxContentLength) + 
          '\n\n[...内容已截断，完整内容请参考上一步骤输出...]';
      }
      
      priorStepOutputText = `
【🔴 上一步骤输出（重要！）】
${contentToUse}
`;
    }
    
    // 构建 Prompt
    const prompt = 
      AGENT_T_TECH_EXPERT_SYSTEM_PROMPT + '\n\n' +
      buildAgentTTechExpertUserPrompt(
        task,
        executionContext,
        capabilitiesText,
        mcpHistoryText,
        priorStepOutputText,
        defaultAccountId,
        userFeedbackText,  // 🔴 用户反馈文本
        executionContext.bossOrderInstruction || ''  // 🔴🔴🔴 BossOrder 最高优先级指令
      );
    
    // 🔴 详细日志：输出完整的系统提示词内容（前3000字符，避免太长）
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== Agent T 系统提示词（AGENT_T_TECH_EXPERT_SYSTEM_PROMPT） ==========');
    console.log(AGENT_T_TECH_EXPERT_SYSTEM_PROMPT.substring(0, 3000));
    if (AGENT_T_TECH_EXPERT_SYSTEM_PROMPT.length > 3000) {
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ...（系统提示词太长，剩余部分省略，总长度:', AGENT_T_TECH_EXPERT_SYSTEM_PROMPT.length);
    }
    
    // 🔴 详细日志：输出完整的用户提示词内容（前2000字符，避免太长）
    const userPrompt = buildAgentTTechExpertUserPrompt(
      task,
      executionContext,
      capabilitiesText,
      mcpHistoryText,
      priorStepOutputText,
      defaultAccountId,
      userFeedbackText,
      executionContext.bossOrderInstruction || ''
    );
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== Agent T 用户提示词（前2000字符） ==========');
    console.log(userPrompt.substring(0, 2000));
    if (userPrompt.length > 2000) {
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ...（用户提示词太长，剩余部分省略，总长度:', userPrompt.length);
    }
    
    console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] Agent T 提示词构建完成，总长度:', prompt.length);
    
    try {
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== 开始调用 Agent T LLM ==========');
      const response = await callLLM(
        'agent T',
        '技术专家',
        AGENT_T_TECH_EXPERT_SYSTEM_PROMPT,
        userPrompt,
        {
          timeout: 180000, // 3 分钟超时
          workspaceId: task.workspaceId || undefined,
        }
      );
      
      // 🔴🔴🔴 调试：把原始响应写入日志文件（完整内容）
      const fs = require('fs');
      const debugLogPath = '/app/work/logs/bypass/agent-t-raw-response.log';
      const timestamp = new Date().toISOString();
      const debugContent = `\n\n${'='.repeat(80)}\n[${timestamp}] [command_result_id=${task.commandResultId}]\n${'='.repeat(80)}\n${response}\n`;
      fs.appendFileSync(debugLogPath, debugContent, 'utf-8');
      
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== Agent T 原始响应（已写入 ' + debugLogPath + '）==========');
      console.log('[SubtaskEngine] 原始响应长度:', response.length, '字符');
      console.log('[SubtaskEngine] 原始响应前300字符:', response.substring(0, 300));
      
      // 🔴 使用 Executor 响应解析器（适配新的 isCompleted 格式）
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== 开始解析 Agent T 响应（Executor 格式） ==========');
      const parseResult = AgentResponseParser.parseExecutorResponse(response);
      
      if (!parseResult.success) {
        console.error('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] Agent T 响应解析失败:', parseResult.error);
        throw new Error(parseResult.error || 'Agent T 响应解析失败');
      }
      
      const decisionRaw = parseResult.data!;
      
      // 🔴 直接使用原始数据，保留所有字段（包括 isNeedSplit、splitReason 等）
      // 不使用 "as AgentTDecision" 类型转换，因为会丢失原始数据中的其他字段
      const decision = decisionRaw as AgentTDecision;
      // 同时保留原始数据的完整内容，用于保存到数据库
      const decisionAny = decisionRaw as any;
      
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== Agent T 解析后的决策 ==========');
      console.log('检测到的格式类型:', parseResult.warnings?.[0] || '未知');
      console.log('isCompleted:', decision.isCompleted);
      console.log('result:', decision.result);
      console.log('【关键字段】isNeedSplit:', (decision as any).isNeedSplit, 'needSplit:', (decision as any).needSplit);
      console.log('【关键字段】splitReason:', (decision as any).splitReason);
      console.log('【关键字段】suggestedSplitPoints:', (decision as any).suggestedSplitPoints);
      console.log('完整决策:', JSON.stringify(parseResult.data, null, 2));
      
      // 确保 MCP 参数中有 accountId（如果有的话）
      if (decision.mcpParams?.params) {
        if (!decision.mcpParams.params.accountId) {
          decision.mcpParams.params.accountId = defaultAccountId;
          console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] Agent T 自动填充 accountId:', defaultAccountId);
        }
      }
      
      console.log('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] ========== Agent T 最终决策 ==========');
      console.log(JSON.stringify(decision, null, 2));

      

      // 🔴 记录 Agent T 的交互（作为执行 Agent，与 insurance-d 一致）
      // 🔴 修复：responseStatus 判断逻辑
      // - 有 mcpParams（capability 存在）→ pre_completed（MCP 会执行）
      // - 无 mcpParams（capability 不存在）→ pre_need_support（需要用户介入）
      const responseStatus = decision.mcpParams ? 'pre_completed' : 'pre_need_support';
      
      // 🔴 参考 insurance-d 的存储格式，构造完整的 requestContent
      const requestContentForRecord = {
        type: 'executor_agent_execution',
        taskTitle: task.taskTitle,
        description: task.taskDescription,
        hasStructuredResult: !!decision.structuredResult,
        originalInstruction: {
          title: task.taskTitle,
          description: task.taskDescription
        }
      };
      
      return decision;
      
    } catch (error) {
      console.error('[SubtaskEngine] [command_result_id=' + task.commandResultId + '] Agent T 调用失败:', error);
      throw error;
    }
  }

  /**
   * 🔥 新增：调用前序信息选择器Agent
   * 这个方法会：
   * 1. 获取精选清单格式的前序信息
   * 2. 调用选择器Agent让其选择需要的信息
   * 3. 解析选择结果并提取对应的前序信息
   */
  private async callPrecedentSelectorAgent(
    task: typeof agentSubTasks.$inferSelect,
    allTasksInGroup: Array<typeof agentSubTasks.$inferSelect>
  ): Promise<{
    selectedInfoText: string | null;
    selectorResponse: string | null;
  }> {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║          [前序信息选择器] 开始调用选择器Agent              ║');
    console.log('║                     任务ID: ' + task.id + '                             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('[前序信息选择器] 基础信息 (任务ID: ' + task.id + '):', {
      task_id: task.id,
      order_index: task.orderIndex,
      executor: task.fromParentsExecutor,
      task_title: task.taskTitle,
      total_tasks_in_group: allTasksInGroup.length
    });

    try {
      // 1. 获取精选清单格式的前序信息
      console.log('[前序信息选择器] [阶段1/4] 获取精选清单格式前序信息');
      const curatedPreviousResult = await this.getPreviousStepResult(
        allTasksInGroup,
        task.orderIndex,
        task
      );

      if (!curatedPreviousResult) {
        console.log('[前序信息选择器] 没有前序信息，跳过选择器 (任务ID: ' + task.id + ')');
        return { selectedInfoText: null, selectorResponse: null };
      }

      console.log('[前序信息选择器] [阶段1/4] ✅ 精选清单获取成功:', {
        length: curatedPreviousResult.length
      });

      // 2. 构建选择器Agent的提示词
      console.log('[前序信息选择器] [阶段2/4] 构建选择器提示词');
      
      const currentTaskText = `【当前任务】
任务标题：${task.taskTitle}
任务描述：${task.taskDescription}
任务组ID：${task.groupId}`;

      const selectorPrompt = `${curatedPreviousResult}

${currentTaskText}

---

【筛选任务】
请根据上述候选前序任务，为当前任务选择最相关的参考任务。

请按JSON格式返回你的选择结果（不要包含任何额外文字）：`;

      console.log('[前序信息选择器] [阶段2/4] ✅ 选择器提示词构建成功');
      console.log('');
      console.log('════════════════════════════════════════════════════════════');
      console.log('📤 [前序信息选择器] 传递给选择器Agent的完整提示词:');
      console.log('════════════════════════════════════════════════════════════');
      console.log(selectorPrompt);
      console.log('════════════════════════════════════════════════════════════');
      console.log('');

      // 3. 调用选择器Agent（使用专门的 PrecedentSelector 提示词）
      console.log('[前序信息选择器] [阶段3/4] 调用选择器LLM');
      
      const llmStartAt = getCurrentBeijingTime();
      const systemPrompt = loadFeaturePrompt('precedent-selector-system-prompt');
      
      const selectorResponse = await callLLM(
        task.fromParentsExecutor,
        '前序信息选择',
        systemPrompt,
        selectorPrompt,
        { workspaceId: task.workspaceId || undefined }
      );
      
      const llmEndAt = getCurrentBeijingTime();
      
      console.log('[前序信息选择器] [阶段3/4] ✅ 选择器LLM调用完成:', {
        duration_ms: llmEndAt.getTime() - llmStartAt.getTime(),
        response_length: selectorResponse.length
      });
      
      console.log('');
      console.log('════════════════════════════════════════════════════════════');
      console.log('📥 [前序信息选择器] 选择器Agent返回的完整结果:');
      console.log('════════════════════════════════════════════════════════════');
      console.log(selectorResponse);
      console.log('════════════════════════════════════════════════════════════');
      console.log('');

      // 4. 解析选择结果并提取信息
      console.log('[前序信息选择器] [阶段4/4] 解析选择结果并提取信息');
      
      const { PrecedentSelectorController } = await import('@/lib/agents/precedent-selector-controller');
      
      // 解析选择器响应
      const selectionResult = PrecedentSelectorController.parseAgentResponse(selectorResponse);
      
      console.log('[前序信息选择器] 选择结果解析成功:', {
        selected_subtasks_count: selectionResult.result.selectedSubtasks.length,
        selected_mcp_results_count: selectionResult.result.selectedMcpResults.length
      });

      // 提取选择的前序信息
      const extractedInfo = await PrecedentSelectorController.extractPrecedentInfo(
        selectorResponse
      );

      // 拼装最终的执行提示词
      const selectedInfoText = PrecedentSelectorController.assembleExecutionPrompt(
        currentTaskText,
        extractedInfo
      );

      console.log('[前序信息选择器] [阶段4/4] ✅ 信息提取完成:', {
        subtask_texts_count: extractedInfo.subtaskTexts.length,
        mcp_result_texts_count: extractedInfo.mcpResultTexts.length,
        final_text_length: selectedInfoText.length
      });
      
      console.log('');
      console.log('════════════════════════════════════════════════════════════');
      console.log('📋 [前序信息选择器] 最终拼装的执行提示词 (任务ID: ' + task.id + '):');
      console.log('════════════════════════════════════════════════════════════');
      console.log(selectedInfoText);
      console.log('════════════════════════════════════════════════════════════');
      console.log('');

      console.log('');
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║          [前序信息选择器] 调用成功 (任务ID: ' + task.id + ')  ║');
      console.log('╚═══════════════════════════════════════════════════════════╝');
      console.log('');

      return { selectedInfoText, selectorResponse };

    } catch (error) {
      console.error('');
      console.error('╔═══════════════════════════════════════════════════════════╗');
      console.error('║          [前序信息选择器] ❌ 调用失败                     ║');
      console.error('║                     任务ID: ' + task.id + '                             ║');
      console.error('╚═══════════════════════════════════════════════════════════╝');
      console.error('[前序信息选择器] 失败详情 (任务ID: ' + task.id + '):', {
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined
      });
      console.error('');

      // 降级：返回 null，让后续逻辑使用原有的精选清单
      console.warn('[前序信息选择器] 降级：使用原有的精选清单格式 (任务ID: ' + task.id + ')');
      return { selectedInfoText: null, selectorResponse: null };
    }
  }

  /**
   * 🔥 新增：生成 MCP 执行结果的文本化格式
   */
  private async generateMcpResultText(attempt: any): Promise<string> {
    const toolName = attempt.decision?.toolName;
    const actionName = attempt.decision?.actionName;
    const resultStatus = attempt.result?.status;
    const resultData = attempt.result?.data;
    
    const { getMcpResultTextGenerator } = await import('./mcp-result-text-generator');
    const generator = getMcpResultTextGenerator();
    
    const result = await generator.generate({
      toolName,
      actionName,
      resultStatus,
      resultData
    });
    
    if (!result.success) {
      throw new Error(`MCP 结果文本生成失败: ${result.error}`);
    }
    
    return result.text;
  }

  // ========== 🔴 🔴 🔴 新增：辅助方法（用于去重和异常处理） ==========

  /**
   * 生成交互指纹（用于去重）
   */
  private generateInteractionFingerprint(
    agentId: string,
    requestContent: any,
    responseStatus: string
  ): string {
    const contentStr = typeof requestContent === 'string' 
      ? requestContent 
      : JSON.stringify(requestContent);
    
    const contentPreview = contentStr.substring(0, 1000);
    
    return `${agentId}:${responseStatus}:${this.simpleHash(contentPreview)}`;
  }

  /**
   * 简单 hash 函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 检查是否为重复交互
   */
  private isDuplicateInteraction(
    existingContent: any,
    newFingerprint: string
  ): boolean {
    if (!existingContent) return false;
    return existingContent.fingerprint === newFingerprint;
  }

  /**
   * 检查是否为唯一约束错误
   */
  private isUniqueConstraintError(error: any): boolean {
    const errorMsg = error?.message || String(error);
    return errorMsg.includes('unique constraint') || 
           errorMsg.includes('duplicate key') ||
           errorMsg.includes('idx_task_step_num_type_user');
  }

  /**
   * 查找已存在的 Agent 交互记录
   */
  private async findExistingAgentInteraction(
    commandResultId: string,
    stepNo: number,
    agentId: string,
    fingerprint: string
  ): Promise<{ interactNum: number } | null> {
    const records = await db
      .select({ interactNum: agentSubTasksStepHistory.interactNum })
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, commandResultId as any),
          eq(agentSubTasksStepHistory.stepNo, stepNo),
          eq(agentSubTasksStepHistory.interactType, 'agent_interaction'),
          eq(agentSubTasksStepHistory.interactUser, agentId)
        )
      );

    for (const record of records) {
      return record;
    }

    return null;
  }

  /**
   * 🔥 新增：格式化合规校验 MCP 结果
   */
  private formatComplianceMcpResult(resultData: any): string {
    try {
      // 尝试使用已有的 formattedSummary
      if (resultData?.formattedSummary) {
        return `【合规校验结果】
${resultData.formattedSummary}
`;
      }
      
      // 兜底：直接返回 JSON 格式
      return `【合规校验结果】
${JSON.stringify(resultData, null, 2)}
`;
    } catch {
      // 兜底：返回 JSON 格式
      return `【合规校验结果】
${JSON.stringify(resultData, null, 2)}
`;
    }
  }

  /**
   * 检查是否有未处理的报告
   */
  private async hasUnprocessedReport(task: typeof agentSubTasks.$inferSelect): Promise<boolean> {
    // 查询该子任务的最新报告
    const latestReports = await db
      .select()
      .from(agentReports)
      .where(
        and(
          eq(agentReports.subTaskId, task.id)
        )
      )
      .orderBy(desc(agentReports.createdAt))
      .limit(1);

    if (latestReports.length === 0) {
      // 没有报告，可以上报
      return false;
    }

    const latestReport = latestReports[0];
    
    // 检查报告状态
    if (latestReport.status === 'pending' || latestReport.status === 'processing') {
      // 有未处理的报告，不再重复上报
      console.log('[SubtaskEngine] 发现未处理报告，状态: ' + latestReport.status + ', 跳过重复上报');
      return true;
    }

    // 报告已处理或被驳回，可以重新上报
    return false;
  }

  private async notifyAgentA(
    task: typeof agentSubTasks.$inferSelect,
    agentBOutput: AgentBOutput
  ) {
    console.log('[SubtaskEngine] 通知 Agent A');

    // 先检查是否有未处理的报告
    const hasUnprocessed = await this.hasUnprocessedReport(task);
    
    if (hasUnprocessed) {
      console.log('[SubtaskEngine] 已有未处理报告，跳过重复上报');
      return;
    }
    
    // 当 Agent B 要求上报时，将任务状态设置为 need_support
    await db
      .update(agentSubTasks)
      .set({
        status: 'need_support',
        dialogueStatus: 'completed',
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));
    
    console.log('[SubtaskEngine] 任务已标记为需要支持: ' + task.id);
  }

  private async updateDailyTaskProgress(task: typeof agentSubTasks.$inferSelect) {
    try {
      const subTask = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.id, task.id))
        .limit(1);

      if (subTask.length === 0) {
        return;
      }

      const currentTask = subTask[0];
      const completedSubTasksDescription = '步骤 ' + currentTask.orderIndex + ': ' + currentTask.taskTitle;

      await db
        .update(dailyTask)
        .set({
          completedSubTasks: currentTask.orderIndex,
          completedSubTasksDescription,
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(dailyTask.id, currentTask.commandResultId));

      // 🔴 新增：尝试保存文章内容到 article_content 表
      try {
        console.log('[SubtaskEngine] 尝试保存文章内容...');
        const articleContentService = ArticleContentService.getInstance();
        const savedArticle = await articleContentService.saveArticleContent(currentTask);
        
        if (savedArticle) {
          console.log('[SubtaskEngine] ✅ 文章内容保存成功:', savedArticle.articleId);
        } else {
          console.log('[SubtaskEngine] 文章内容不满足保存条件，跳过');
        }
      } catch (articleError) {
        console.error('[SubtaskEngine] ❌ 保存文章内容失败:', articleError);
        // 注意：不因为文章保存失败而影响主流程
      }
    } catch (error) {
      console.error('[SubtaskEngine] 更新 dailyTask 进度失败:', error);
    }
  }

  /**
   * ========== 第二步+第三步：超时检测 + 标准询问 ==========
   * 同时检查用户是否已经给出反馈，如果有反馈则继续执行
   * 使用三级升级机制处理 in_progress 超时
   */
  /**
   * ========== 检查并处理超时任务 ==========
   * 
   * 超时判断逻辑：
   * 1. 检查任务状态是否为 in_progress
   * 2. 检查是否有 startedAt 时间
   * 3. 计算当前时间与 startedAt 的时间差
   * 4. 如果超过 IN_PROGRESS_TIMEOUT_MS（10分钟），则判定为超时
   * 5. 🔴 简化：直接转为 pre_need_support 状态，复用现有的 Agent B 审核功能
   */
  private async checkAndHandleTimeout(tasks: typeof agentSubTasks.$inferSelect[]) {
    const now = getCurrentBeijingTime();

    console.log('[SubtaskEngine] ========== 开始检查超时任务 ==========');
    console.log('[SubtaskEngine] 超时阈值:', IN_PROGRESS_TIMEOUT_MS / 1000 / 60, '分钟');
    console.log('[SubtaskEngine] 待检查任务数:', tasks.length);

    for (const task of tasks) {
      if (task.status === 'in_progress' && task.startedAt) {
        
        // 1. 计算已用时间
        const elapsedTime = now.getTime() - task.startedAt.getTime();
        const elapsedMinutes = elapsedTime / 1000 / 60;
        
        console.log('[SubtaskEngine] 检查任务超时:', {
          task_id: task.id,
          command_result_id: task.commandResultId,
          order_index: task.orderIndex,
          started_at: task.startedAt,
          elapsed_time_ms: elapsedTime,
          elapsed_time_minutes: elapsedMinutes.toFixed(2),
          timeout_threshold_minutes: IN_PROGRESS_TIMEOUT_MS / 1000 / 60
        });

        // 2. 判断是否超时
        if (elapsedTime >= IN_PROGRESS_TIMEOUT_MS) {
          console.log('[SubtaskEngine] ========== 检测到超时任务 ==========');
          console.log('[SubtaskEngine] 任务', task.id, '已超时', elapsedMinutes.toFixed(2), '分钟');
          console.log('[SubtaskEngine] 🔴 简化方案：直接转为 pre_need_support 状态，复用 Agent B 审核功能');
          
          // 3. 🔴 简化：直接转为 pending 状态
          // 这样现有的 Agent B 审核流程会自动处理，不需要新的智能审核逻辑
          await db
            .update(agentSubTasks)
            .set({
              status: 'pending',
              metadata: {
                ...task.metadata,
                timeoutAt: getCurrentBeijingTime().toISOString(),
                timeoutElapsedMs: elapsedTime,
                timeoutReason: '任务执行超时，自动转为需要 Agent B 评审',
              },
              updatedAt: getCurrentBeijingTime(),
            })
            .where(eq(agentSubTasks.id, task.id));
          
          console.log('[SubtaskEngine] ✅ 已转为 pre_need_support 状态，Agent B 将介入评审');
        } else {
          console.log('[SubtaskEngine] 任务', task.id, '未超时，继续执行中');
        }
      }
    }

    console.log('[SubtaskEngine] ========== 超时检查完成 ==========');
  }

  /**
   * 检查任务是否有用户反馈
   */
  private async checkForUserFeedback(task: typeof agentSubTasks.$inferSelect): Promise<boolean> {
    if (!task.commandResultId) {
      return false;
    }

    // 查询历史记录
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      )
      .orderBy(desc(agentSubTasksStepHistory.interactTime));

    if (historyRecords.length === 0) {
      return false;
    }

    // 检查最新的记录是否是用户反馈
    const latestRecord = historyRecords[0];
    
    // 如果是用户（human）的 response，就认为有用户反馈
    // 注意：不要求时间严格在 startedAt 之后，因为用户交互可能在设置 startedAt 之前就记录了
    if (latestRecord.interactType === 'response' && 
        latestRecord.interactUser === 'human') {
      
      console.log('[SubtaskEngine] 检测到用户反馈:', latestRecord.interactTime);
      return true;
    }

    return false;
  }

  /**
   * 清除任务的 waiting_user 状态
   * 注意：不清除 resultData，保留执行 Agent 的结果
   */
  private async clearWaitingUserStatus(task: typeof agentSubTasks.$inferSelect) {
    // 只清除 waiting_user 相关的状态，保留 resultData
    await db
      .update(agentSubTasks)
      .set({
        statusProof: null,
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));
  }



  /**
   * 解析历史记录，恢复执行状态
   */
  public parseHistoryRecords(
    historyRecords: typeof agentSubTasksStepHistory.$inferSelect[]
  ): {
    mcpExecutionHistory: McpAttempt[];
    userInteractions: UserInteraction[];
    executorResult: ExecutorAgentResult | null;
  } {
    const mcpExecutionHistory: McpAttempt[] = [];
    const userInteractions: UserInteraction[] = [];
    let executorResult: ExecutorAgentResult | null = null;

    console.log('[SubtaskEngine] 🔴 开始解析历史记录，记录数:', historyRecords.length);

    for (const record of historyRecords) {
      const content = record.interactContent as any;

      console.log('[SubtaskEngine] 🔴 处理记录:', {
        record_id: record.id,
        interact_num: record.interactNum,
        interact_type: record.interactType,
        interact_user: record.interactUser,
        has_question: !!content.question,
        has_response: !!content.response,
        question_keys: content.question ? Object.keys(content.question) : [],
      });

      // ========== 解析 executorResult（从第一条记录或 response 记录） ==========
      if (!executorResult) {
        // 🔴 修复：同时支持从 question 和 response 中解析 executorResult
        let sourceData = null;
        
        if (record.interactNum === 1 && content.question) {
          sourceData = content.question;
          console.log('[SubtaskEngine] 🔴 从第一条记录的 question 中解析');
        } else if (content.response?.decision && record.interactType === 'response') {
          // 🔴 新增：从 response 中解析执行 Agent 的输出
          console.log('[SubtaskEngine] 🔴 从 response 记录中解析执行 Agent 输出');
          sourceData = content.question || content.response?.question;
        }
        
        if (sourceData) {
          console.log('[SubtaskEngine] 🔴 源数据内容:', {
            has_isCompleted: 'isCompleted' in sourceData,
            has_isNeedMcp: 'isNeedMcp' in sourceData,
            has_isTaskDown: 'isTaskDown' in sourceData,
            has_problem: 'problem' in sourceData,
            has_suggestion: 'suggestion' in sourceData,
            isCompleted_value: sourceData.isCompleted,
            isNeedMcp_value: sourceData.isNeedMcp,
          });
          
          // 🔴 修复：优先检查 isCompleted，如果为 true，则任务已完成
          if (sourceData.isCompleted === true) {
            console.log('[SubtaskEngine] 🔴 ✅ 检测到 isCompleted=true，任务已完成！');
            executorResult = {
              isNeedMcp: false,
              isTaskDown: true,
              problem: sourceData.problem || '任务已完成',
              capabilityType: sourceData.capabilityType,
              resultData: sourceData.resultData,
            };
          } else if (sourceData.isNeedMcp !== undefined) {
            executorResult = {
              isNeedMcp: sourceData.isNeedMcp,
              problem: sourceData.problem,
              capabilityType: sourceData.capabilityType,
              resultData: sourceData.resultData,
              isTaskDown: sourceData.isTaskDown,
            };
          }
          
          if (executorResult) {
            console.log('[SubtaskEngine] 🔴 ✅ 成功解析到 executorResult:', executorResult);
          }
        }
      }

      // ========== 解析用户交互 ==========
      if (record.interactUser === 'human' && record.interactType === 'response') {
        if (content.type === 'user_decision' || content.type === 'user_interaction') {
          const userInteraction: UserInteraction = {
            interactionId: 'history-' + record.id,
            interactionNumber: record.interactNum || 0,
            timestamp: record.interactTime,
            keyFieldsConfirmed: content.interactionData?.fieldValues ? 
              Object.entries(content.interactionData.fieldValues).map(([fieldId, fieldValue]) => ({
                fieldId,
                fieldName: fieldId,
                fieldValue,
                isModified: true
              })) : [],
            selectedSolution: {
              solutionId: content.interactionData?.selectedSolution || 'default',
              solutionLabel: '用户选择方案',
              solutionDescription: content.userDecision || '',
              selectedAt: record.interactTime
            },
            userComment: content.interactionData?.notes ? {
              content: content.interactionData.notes,
              inputAt: record.interactTime
            } : undefined,
            userInfo: {
              userId: 'human',
              userName: '用户'
            },
            submission: {
              submittedAt: record.interactTime,
              status: 'completed',
              processingTime: 0
            }
          };
          userInteractions.push(userInteraction);
        }
      }
    }

    return {
      mcpExecutionHistory,
      userInteractions,
      executorResult
    };
  }

  /**
   * 🔴 新增：构建结构化结果文本（给Agent B看）
   */
  private buildStructuredResultText(executorResult: ExecutorDirectResult): string {
    if (!hasStructuredResult(executorResult)) {
      return '执行Agent未提供结构化结果，请基于现有信息判断';
    }
    
    const { structuredResult } = executorResult;
    const { completionJudgment } = structuredResult;
    
    return `
1. 原指令内容：
   - 标题: ${structuredResult.originalInstruction.title}
   - 描述: ${structuredResult.originalInstruction.description}
   ${structuredResult.originalInstruction.fullContent ? 
     `- 完整内容: ${structuredResult.originalInstruction.fullContent}` : ''}

2. 执行摘要：
   - 采取的行动: ${structuredResult.executionSummary.actionsTaken?.join('; ') || '无'}
   ${structuredResult.executionSummary.toolsUsed?.length ? 
     `- 使用工具: ${structuredResult.executionSummary.toolsUsed.join(', ')}` : ''}

3. 执行结果内容：
   ${this.truncateText(structuredResult.resultContent, 500)}

4. 完成情况判断（关键！）：
   - 是否完成: ${completionJudgment.isCompleted ? '✅ 是' : '❌ 否'}
   - 置信度: ${completionJudgment.confidence}
   - 证据列表:
     ${completionJudgment.evidence?.map((e, i) => `     ${i + 1}. ${e}`).join('\n') || '     无证据'}
   ${completionJudgment.suggestions ? 
     `- 后续建议: ${completionJudgment.suggestions}` : ''}

【🔴 Agent B 判断 Checklist】
- [ ] 执行Agent是否提供了清晰的判断理由？
- [ ] 是否有具体的证据支持判断？
- [ ] 置信度级别是否合理？
- [ ] 结果内容是否与原指令匹配？
- [ ] 是否有明显的遗漏或问题？

【🔴 判断策略】
- 如果 confidence = high 且 evidence 充分 → 直接 COMPLETE
- 如果 confidence = medium → 可 COMPLETE 或 NEED_USER（视情况）
- 如果 confidence = low → 建议 NEED_USER 或仔细审核
`;
  }

  /**
   * 🔴 新增：截断文本
   */
  private truncateText(text: any, maxLength: number): string {
    if (!text) return '无结果内容';
    
    const str = typeof text === 'string' ? text : JSON.stringify(text);
    if (str.length <= maxLength) return str;
    
    return str.substring(0, maxLength) + '... [内容已截断]';
  }

  /**
   * 🔴 新增：获取Agent B输出格式
   */
  private getAgentBOutputFormat(): string {
    return `{
  "type": "EXECUTE_MCP" | "COMPLETE" | "NEED_USER" | "FAILED" | "AUTO_SPLIT",
  "reasonCode": "...",
  "reasoning": "详细说明决策理由",
  "context": {
    "executionSummary": "执行摘要",
    "riskLevel": "low" | "medium" | "high",
    "suggestedAction": "建议控制器执行的操作",
    "splitStrategy": "step_by_step | mcp_sequence",  // 🔴 AUTO_SPLIT 时的拆分策略
    "suggestedSplitPoints": ["步骤1", "步骤2"],  // 🔴 AUTO_SPLIT 时的拆分点
    "splitReason": "拆分原因说明"  // 🔴 AUTO_SPLIT 时的拆分原因
  },
  "data": {
    "mcpParams": {
      "solutionNum": 能力ID,
      "toolName": "工具名",
      "actionName": "方法名",
      "params": { ... }
    },
    "completionResult": { ... },
    "pendingKeyFields": [ ... ],
    "availableSolutions": [ ... ],
    "promptMessage": { ... },
    "failedDetails": { ... },
    "splitInfo": {  // 🔴 AUTO_SPLIT 时的拆分信息
      "strategy": "拆分策略",
      "points": ["拆分点数组"],
      "reason": "拆分原因"
    }
  }
}`;
  }
}

/**
 * 🔴 单例实例导出
 */
export const subtaskEngine = new SubtaskExecutionEngine();
