/**
 * Agent LLM 调用辅助函数
 * 集成 Agent 身份提示词，确保 agent 知道自己的身份和能力边界
 * 集成本地缓存，避免重复调用，降低成本
 * 🔥 集成 Agent 记忆系统，加载历史经验和知识
 */

// 🔴 P0 修复：请求去重守卫 — 防止同一任务的并发 LLM 调用（幽灵请求）
// 当超时触发重试时，前一个请求可能仍在服务端执行，需要：
// 1. 记录每个任务正在执行的请求
// 2. 重试前取消前一个请求的 AbortController
// 3. 避免同一任务同时发出多个 LLM 调用
// 🔴 并行改造：key 从 agentId 改为 agentId:commandResultId，支持不同用户并行调用同一 Agent
const inflightRequests = new Map<string, {
  abortController: AbortController;
  startedAt: number;
}>();

/**
 * 构建 inflight 请求的唯一键
 * 格式：agentId:commandResultId（如果提供 commandResultId），否则 agentId（向后兼容）
 */
function buildInflightKey(agentId: string, commandResultId?: string): string {
  return commandResultId ? `${agentId}:${commandResultId}` : agentId;
}

/**
 * 注册正在执行的 LLM 请求
 * @returns AbortController 用于取消请求
 */
function registerInflightRequest(agentId: string, commandResultId?: string): AbortController {
  const key = buildInflightKey(agentId, commandResultId);
  // 如果有前一个请求，尝试取消它（超时重试场景）
  const existing = inflightRequests.get(key);
  if (existing) {
    try {
      existing.abortController.abort();
      console.warn(`[LLM Guard] 取消 ${key} 的前一个请求（运行 ${Date.now() - existing.startedAt}ms）`);
    } catch {
      // 忽略取消失败
    }
  }

  const controller = new AbortController();
  inflightRequests.set(key, {
    abortController: controller,
    startedAt: Date.now(),
  });
  return controller;
}

/**
 * 注销正在执行的 LLM 请求
 */
function unregisterInflightRequest(agentId: string, commandResultId?: string): void {
  const key = buildInflightKey(agentId, commandResultId);
  inflightRequests.delete(key);
}

/**
 * 获取当前正在执行的请求统计（用于健康检查）
 */
export function getInflightRequestStats(): Record<string, { runningMs: number }> {
  const stats: Record<string, { runningMs: number }> = {};
  const now = Date.now();
  const entries = Array.from(inflightRequests.entries());
  for (const [agentId, req] of entries) {
    stats[agentId] = { runningMs: now - req.startedAt };
  }
  return stats;
}

/**
 * 计算日期加上指定天数后的日期
 * @param dateStr 起始日期（YYYY-MM-DD 格式）
 * @param days 要加的天数
 * @returns 计算后的日期（YYYY-MM-DD 格式）
 */
function getDatePlusDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}


import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { loadAgentPrompt, hasAgentPrompt } from './agents/prompt-loader';
import { isWritingAgent } from './agents/agent-registry';
import { createUserLLMClient, getPlatformLLM } from './llm/factory';
import {
  agentSelfCheckCache,
  agentTaskSplitCache,
  agentSolutionCache,
  agentAnswerCache,
  generateCacheKey,
  hashString,
  printAllCacheStats,
  startCacheCleanup,
} from './cache';
import { getMemoryContext, saveAgentExperience } from './agent-memory-helper';

// ============================================
// 类型定义
// ============================================

/**
 * 子任务拆分结果
 * 用于 splitTaskForAgent 函数的返回值
 */
export interface SubTaskSplitResult {
  orderIndex: number; // 执行顺序，从 1 开始
  title: string; // 子任务标题（对应数据库字段 taskTitle）
  description: string; // 子任务描述（对应数据库字段 taskDescription）
  executor: string; // 执行该子任务的 agent ID（如：insurance-a, insurance-b 等）
  deadline: string; // 截止时间（YYYY-MM-DD 格式）
  priority: 'urgent' | 'normal' | 'low'; // 优先级：urgent（紧急）、normal（普通）、low（低）
  estimatedHours: number; // 预计工时（小时）
  acceptanceCriteria: string; // 验收标准（存储在 metadata.acceptanceCriteria）
  isCritical: boolean; // 是否为关键子任务（存储在 metadata.isCritical）
  criticalReason: string; // 关键原因（存储在 metadata.criticalReason）
}

// ============================================
// 导出缓存工具（供外部查看统计信息）
// ============================================
export {
  agentSelfCheckCache,
  agentTaskSplitCache,
  agentSolutionCache,
  agentAnswerCache,
  printAllCacheStats,
  startCacheCleanup,
};

// ============================================
// 导出 Agent 提示词加载器（供外部使用）
// ============================================
export { loadAgentPrompt, hasAgentPrompt } from './agents/prompt-loader';

// ============================================
// LLM Client 初始化
// ============================================

let llmClientInstance: LLMClient | null = null;

/**
 * 获取 LLMClient 单例实例（平台默认 Key）
 * ⚠️ 向后兼容方法，新代码请使用 createUserLLMClient(workspaceId)
 * Config 会自动从环境变量加载凭证
 */
export function getLLMClient(): LLMClient {
  if (!llmClientInstance) {
    llmClientInstance = getPlatformLLM();
    console.log('✅ LLMClient 初始化成功（平台默认 Key）');
  }
  return llmClientInstance;
}



/**
 * 🔥 通用 LLM 调用函数（带记忆）
 * 在调用 LLM 时自动加载 Agent 的相关记忆
 *
 * @param agentId Agent ID
 * @param context 上下文（用于检索相关记忆）
 * @param systemPrompt 系统 prompt
 * @param userPrompt 用户 prompt
 * @param options 可选配置
 * @returns LLM 响应内容
 */
export async function callLLM(
  agentId: string,
  context: string,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    maxMemories?: number;
    minImportance?: number;
    memoryTypes?: string[];
    timeout?: number; // 新增：超时时间（毫秒）
    workspaceId?: string; // BYOK：传入 workspaceId 以使用用户 API Key
    maxRetries?: number; // 🔴 阶段1：最大重试次数（默认 3）
    commandResultId?: string; // 🔴 并行改造：传入 commandResultId 实现按组去重，不同组可并行
    /**
     * 🔴 P1 修复：skipCircuitBreaker 仅限内部健康探测使用
     * ⚠️ 业务代码禁止使用此选项！所有 LLM 调用必须经过熔断器保护。
     * 如果需要跳过熔断器，请在 circuit-breaker.ts 中调整阈值。
     * @internal
     */
    skipCircuitBreaker?: boolean;
  }
): Promise<string> {
  
  if (agentId === 'B') {
    console.log(`🤖 [LLM调用] Agent B 不使用 mock，使用真实 LLM (Agent ${agentId})`);
  }

  // 🔴 阶段1：熔断器检查
  const { getCircuitBreaker, retryWithBackoff } = await import('@/lib/llm/circuit-breaker');
  const breaker = getCircuitBreaker(agentId);
  
  // 🔴 P1 修复：skipCircuitBreaker 仅限健康探测，业务代码使用会打印警告
  if (options?.skipCircuitBreaker) {
    // 获取调用栈以定位滥用位置
    const stack = new Error().stack;
    const caller = stack?.split('\n')[2]?.trim() || 'unknown';
    console.warn(`⚠️ [CircuitBreaker] skipCircuitBreaker=true 被 ${caller} 使用，此选项仅限健康探测！`);
  }
  
  if (!options?.skipCircuitBreaker && !breaker.allowRequest()) {
    const stats = breaker.getStats();
    console.error(`🛑 [CircuitBreaker] Agent ${agentId} 熔断中，拒绝请求`, stats);
    throw new Error(
      `LLM 熔断器开启（Agent ${agentId}），连续失败过多，请稍后重试。` +
      `冷却剩余: ${Math.round(stats.cooldownRemaining / 1000)}s`
    );
  }

  // 🔴 阶段1：降低默认超时（120s → 60s），减少单次调用阻塞引擎的时间
  const maxRetries = options?.maxRetries ?? 3;

  try {
    // 🔴 阶段1：使用重试 + 指数退避包裹整个 LLM 调用
    const result = await retryWithBackoff(
      () => callLLMInternal(agentId, context, systemPrompt, userPrompt, options),
      {
        maxRetries,
        isRetryable: (error: Error) => {
          // 熔断器拒绝不可重试
          if (error.message?.includes('熔断器开启')) return false;
          // 🔴 P0 修复：被取消的请求不可重试（已被新请求替代）
          if (error.message?.includes('请求被取消')) return false;
          // 超时、网络错误、5xx、429 可重试
          const msg = error.message?.toLowerCase() || '';
          if (msg.includes('timeout') || msg.includes('超时')) return true;
          if (msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('etimedout')) return true;
          if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('429')) return true;
          if (msg.includes('rate_limit') || msg.includes('rate limit') || msg.includes('too many requests')) return true;
          return false;
        },
      }
    );

    // 成功 → 记录到熔断器
    breaker.recordSuccess();
    return result;
  } catch (error) {
    // 失败 → 记录到熔断器
    breaker.recordFailure();
    
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════════════');
    console.error('❌ 【执行 Agent】LLM 调用失败（重试耗尽）');
    console.error('═══════════════════════════════════════════════════════════════════════════');
    console.error('');
    console.error('🤖 Agent ID:', agentId);
    console.error('🔁 重试次数:', maxRetries);
    console.error('错误详情:', error);
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════════════');
    console.error('');
    
    throw new Error(`LLM 调用失败（重试 ${maxRetries} 次后）: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * LLM 调用内部实现（不含熔断/重试，由 callLLM 统一包裹）
 * 
 * 🔴 P0 修复：集成请求去重守卫
 * - 每次调用注册 inflight 请求
 * - 超时重试时自动取消前一个请求的 AbortController
 * - 调用完成后（无论成功失败）注销 inflight 请求
 */
async function callLLMInternal(
  agentId: string,
  context: string,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    maxMemories?: number;
    minImportance?: number;
    memoryTypes?: string[];
    timeout?: number;
    workspaceId?: string;
    maxRetries?: number;
    commandResultId?: string; // 🔴 并行改造：按组去重
    /** @internal 仅限健康探测使用 */
    skipCircuitBreaker?: boolean;
  }
): Promise<string> {
    // 🔴 P0 修复：注册请求去重守卫，超时重试时自动取消前一个请求
    // 🔴 并行改造：使用 agentId:commandResultId 作为去重键，不同组可并行
    const abortController = registerInflightRequest(agentId, options?.commandResultId);

    // 🔴 阶段1：降低默认超时 120s → 60s，减少单次调用阻塞引擎的时间
    const temperature = options?.temperature || 0.3;
    // 🔴🔴🔴 P0 修复：使用高质量模型的 Agent 自动延长超时到 180s
    // doubao-seed-2-0-pro-260215 正常响应 65-80 秒，60s 必然超时
    // 涵盖：写作 Agent（WRITING_AGENTS）+ deai-optimizer 等使用高质量模型的 Agent
    const _usesHighQualityModel = isWritingAgent(agentId) || agentId === 'deai-optimizer';
    const _defaultTimeout = _usesHighQualityModel ? 180000 : 60000;
    const timeout = options?.timeout || _defaultTimeout;

    try {
    // 🔥 加载 Agent 记忆
    const memoryContext = await getMemoryContext(agentId, context, {
      maxMemories: options?.maxMemories || 5,
      minImportance: options?.minImportance || 6,
      memoryTypes: options?.memoryTypes || ['strategy', 'experience', 'knowledge'],
    });

    // 构建完整的 system prompt（包含记忆）
    const fullSystemPrompt = memoryContext
      ? systemPrompt + memoryContext
      : systemPrompt;

    // 🔥 完整打印发送给 LLM 的提示词
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📤 【执行 Agent】发送给 LLM 的完整提示词');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('🤖 Agent ID:', agentId);
    console.log('🔧 调用参数:');
    console.log(`   温度: ${temperature}`);
    console.log(`   超时: ${timeout}ms`);
    console.log('');
    
    const messages = [
      { role: 'system', content: fullSystemPrompt },
      { role: 'user', content: userPrompt },
    ];
    
    messages.forEach((msg, index) => {
      console.log(`📋 消息 ${index + 1} [${msg.role.toUpperCase()}]:`);
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log(msg.content);
      console.log('───────────────────────────────────────────────────────────────────────────────');
      console.log('');
    });

    console.log('📊 提示词统计:');
    console.log(`   - 消息数量: ${messages.length}`);
    console.log(`   - System 长度: ${fullSystemPrompt.length} 字符`);
    console.log(`   - User 长度: ${userPrompt.length} 字符`);
    console.log(`   - 总字符数: ${fullSystemPrompt.length + userPrompt.length}`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    // 调用 LLM（带超时）— 按 workspace llmKeySource 策略选择 Key
    const workspaceId = options?.workspaceId;
    let llm: LLMClient;
    let llmSource = 'platform-default';
    if (workspaceId) {
      const userClient = await createUserLLMClient(workspaceId, { timeout });
      llm = userClient.client;
      llmSource = userClient.source;
    } else {
      llm = getLLMClient();
    }
    console.log(`🤖 [LLM调用] LLM 来源: ${llmSource}`);
    const startTime = Date.now();
    console.log(`🤖 [LLM调用] 开始调用 LLM (Agent ${agentId})...`);
    console.log(`🤖 [LLM调用] 超时设置: ${timeout}ms`);
    
    // 根据 agentId 选择合适的模型
    const llmConfig: Record<string, unknown> = { temperature };
    if (_usesHighQualityModel) {
      // 写作类 Agent + deai-optimizer 使用更好的模型，确保格式正确性
      llmConfig.model = 'doubao-seed-2-0-pro-260215';
      console.log(`🤖 [LLM调用] ${agentId} 使用模型: doubao-seed-2-0-pro-260215`);
    }
    
    // 🔴 P1 修复：将 inflight AbortController 的信号传递给 LLM 调用
    // 这样在超时重试时，旧请求可以被真正中断（而非仅靠 Promise.race 忽略结果）
    if (abortController.signal) {
      llmConfig.signal = abortController.signal;
    }

    // 使用 Promise.race 实现超时（双重保障：AbortController + setTimeout）
    let responsePromiseResolved = false;
    let timeoutPromiseRejected = false;
    
    const responsePromise = llm.invoke(messages, llmConfig).then((response) => {
      responsePromiseResolved = true;
      console.log(`🤖 [LLM调用] LLM 响应成功 (${Date.now() - startTime}ms)`);
      return response;
    }).catch((error) => {
      responsePromiseResolved = true;
      console.error(`🤖 [LLM调用] LLM 调用失败:`, error);
      throw error;
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        if (!responsePromiseResolved) {
          timeoutPromiseRejected = true;
          console.error(`🤖 [LLM调用] LLM 调用超时 (${timeout}ms)，强制终止！`);
          reject(new Error(`LLM 调用超时 (${timeout}ms)`));
        }
      }, timeout);
      
      // 清理定时器
      responsePromise.finally(() => {
        clearTimeout(timeoutId);
      });
    });

    console.log(`🤖 [LLM调用] 等待 LLM 响应...`);
    const response = await Promise.race([responsePromise, timeoutPromise]);
    const latency = Date.now() - startTime;
    console.log(`🤖 [LLM调用] LLM 调用完成，总耗时: ${latency}ms`);

    // 🔥 完整打印 LLM 的返回结果
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('📥 【执行 Agent】LLM 返回的完整结果');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('⏱️  性能数据:');
    console.log(`   响应时间: ${latency}ms`);
    console.log('');

    // 记录 token 使用情况
    if (response.usage) {
      console.log('🔢 Token 使用情况:');
      console.log(`   输入: ${response.usage.input_tokens}`);
      console.log(`   输出: ${response.usage.output_tokens}`);
      console.log(`   总计: ${response.usage.total_tokens}`);
      console.log('');
    }

    console.log('📝 返回内容:');
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log(response.content);
    console.log('───────────────────────────────────────────────────────────────────────────────');
    console.log('');

    console.log('📊 响应统计:');
    console.log(`   内容长度: ${response.content?.length || 0} 字符`);
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    console.log(`✅ LLM 响应成功 (${latency}ms)`);
    console.log(`   - 响应长度: ${response.content?.length || 0}`);

    return response.content;
  } catch (error) {
    // 🔴 P0 修复：如果是被取消的请求（前一个请求被重试取消），直接抛出
    if (abortController.signal.aborted) {
      console.warn(`[LLM Guard] Agent ${agentId} 请求已被取消（被重试替代），跳过`);
      throw new Error(`LLM 请求被取消（Agent ${agentId}，超时重试）`);
    }
    // 🔴 阶段1：内层只抛原始错误，重试由外层 callLLM 负责
    // 保留关键日志但不再包装新的 Error（避免双重包装）
    console.error(`❌ LLM 调用失败 (Agent ${agentId}):`, error);
    throw error;
  } finally {
    // 🔴 P0 修复：无论成功失败，都注销 inflight 请求
    // 🔴 并行改造：传入 commandResultId 确保正确的组级注销
    unregisterInflightRequest(agentId, options?.commandResultId);
  }
}

/**
 * Agent 自检：检查是否能执行任务
 * @param agentId Agent ID
 * @param task 任务信息
 * @returns 自检结果
 */
export async function agentSelfCheck(agentId: string, task: any) {
  console.log(`🔍 Agent ${agentId} 开始自检任务...`);

  // 生成缓存键
  const taskTitle = task.taskTitle || task.taskName || '';
  const taskContent = task.commandContent || task.coreCommand || '';
  const cacheKey = generateCacheKey(agentId, hashString(taskTitle + taskContent));

  // 检查缓存
  const cached = agentSelfCheckCache.get(cacheKey);
  if (cached) {
    console.log(`✅ Agent ${agentId} 自检结果已缓存`);
    return cached;
  }

  // 加载 Agent 身份提示词
  let agentPrompt = '';
  if (hasAgentPrompt(agentId)) {
    agentPrompt = loadAgentPrompt(agentId);
    console.log(`✅ 已加载 Agent ${agentId} 的身份提示词`);
  } else {
    console.log(`⚠️ 未找到 Agent ${agentId} 的提示词文件，使用默认提示`);
  }

  // 🔥 读取拒绝原因（如果存在）
  const rejectionReason = task.metadata?.rejectionReason || '';
  const rejectionCount = task.metadata?.rejectionCount || 0;

  // 构建完整 prompt
  let prompt = `
# 你是 Agent ${agentId}

${agentPrompt}

${rejectionCount > 0 ? `
---

## 🚨🚨🚨 最高优先级警告 🚨🚨🚨

**此任务已被用户拒绝 ${rejectionCount} 次！你必须按照用户的拒绝原因重新拆解！**

**用户拒绝原因**：
\`\`\`
${rejectionReason}
\`\`\`

**立即调整你的拆解策略，不要重复之前的错误！**

---` : ''}

## 当前任务

任务标题：${taskTitle}
任务内容：${taskContent}

${rejectionReason ? `---

## 🔥 重要提示：拆解结果已被拒绝

**拒绝原因**：
${rejectionReason}

**拒绝次数**：${rejectionCount}

**请根据拒绝原因调整拆解策略**：
- 仔细分析拒绝原因中提出的问题
- 在新的拆解结果中，必须体现出针对拒绝原因的调整
- 如果是关于步骤合并的问题，请按照要求合并相关步骤
- 如果是关于步骤顺序的问题，请调整执行顺序
- 如果是关于遗漏的问题，请补充缺失的步骤

**切记**：这次拆解必须解决之前被拒绝的问题，不要重复相同的错误！

` : ''}

---

## 你的任务

请基于你的身份和能力边界，检查你是否能执行这个任务。你需要：
1. 检查是否缺少必要的素材（如产品信息、数据源等）
2. 检查是否明确任务方向和目标
3. 检查是否符合你的业务边界和能力范围

---

## 返回格式

请严格按照以下 JSON 格式返回：

\`\`\`json
{
  "hasQuestions": true/false,
  "questions": "如果有疑问，详细描述你的疑问",
  "resolution": "如果没有疑问，回复：没问题，可以开始"
}
\`\`\`
  `;

  console.log(`📝 Prompt 长度: ${prompt.length} 字符`);

  // TODO: 集成 LLM 调用
  // const response = await callLLM(prompt);
  // const result = JSON.parse(response);

  // 临时返回模拟数据
  const result = {
    hasQuestions: false,
    questions: '',
    resolution: '没问题，可以开始',
  };

  // 缓存结果
  agentSelfCheckCache.set(cacheKey, result);

  return result;
}

/**
 * Agent 拆分任务
 * @param agentId Agent ID
 * @param task 任务信息
 * @returns 拆分后的子任务列表
 */
export async function splitTaskForAgent(agentId: string, task: any): Promise<SubTaskSplitResult[]> {
  console.log('[DEBUG] [splitTaskForAgent] ===== 开始拆分任务 =====');
  console.log('[DEBUG] [splitTaskForAgent] Agent:', agentId);
  console.log('[DEBUG] [splitTaskForAgent] 任务标题:', task.taskTitle || task.taskName);
  console.log('[DEBUG] [splitTaskForAgent] 是否有 rejectionReason:', !!task.metadata?.rejectionReason);
  console.log('[DEBUG] [splitTaskForAgent] rejectionReason 内容:', task.metadata?.rejectionReason || '无');
  console.log('[DEBUG] [splitTaskForAgent] rejectionCount:', task.metadata?.rejectionCount || 0);
  console.log('[DEBUG] [splitTaskForAgent] 是否有 splitResult:', !!task.metadata?.splitResult);
  console.log('[DEBUG] [splitTaskForAgent] splitResult 内容:', task.metadata?.splitResult ? JSON.stringify(task.metadata.splitResult).substring(0, 300) + '...' : '无');
  console.log('[DEBUG] [splitTaskForAgent] 完整 metadata:', JSON.stringify(task.metadata, null, 2));
  
  console.log('[DEBUG] [splitTaskForAgent] Agent', agentId, '开始拆分任务...');

  // 🔥 生成缓存键（包含拒绝原因，确保重新拆解时不会命中旧缓存）
  const taskTitle = task.taskTitle || task.taskName || '';
  const taskContent = task.commandContent || task.coreCommand || '';
  const rejectionReason = task.metadata?.rejectionReason || '';
  const rejectionCount = task.metadata?.rejectionCount || 0;
  
  // 🔥 获取当前北京时间
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const today = beijingTime.toISOString().split('T')[0];
  
  console.log(`[DEBUG] [splitTaskForAgent] 当前北京时间: ${beijingTime.toISOString()}`);
  console.log(`[DEBUG] [splitTaskForAgent] 今天的日期 (YYYY-MM-DD): ${today}`);

  // 添加日志，检查拒绝原因是否正确提取
  console.log(`[DEBUG] [splitTaskForAgent] 检查任务拆解上下文:`);
  console.log(`  - taskTitle: ${taskTitle}`);
  console.log(`  - taskContent 完整内容:`, taskContent);
  console.log(`  - taskContent 长度: ${taskContent?.length}`);
  console.log(`  - task.metadata:`, JSON.stringify(task.metadata, null, 2));
  console.log(`  - rejectionReason: ${rejectionReason}`);
  console.log(`  - rejectionCount: ${rejectionCount}`);
  console.log(`  - rejectionCount > 0: ${rejectionCount > 0}`);
  
  const cacheKey = generateCacheKey(agentId, hashString(taskTitle + taskContent + rejectionReason + rejectionCount));

  // 检查缓存
  const cached = agentTaskSplitCache.get(cacheKey);
  if (cached) {
    console.log(`✅ Agent ${agentId} 任务拆分结果已缓存`);
    return cached;
  }

  // 加载 Agent 身份提示词
  let agentPrompt = '';
  if (hasAgentPrompt(agentId)) {
    agentPrompt = loadAgentPrompt(agentId);
    console.log(`✅ 已加载 Agent ${agentId} 的身份提示词`);
  } else {
    console.log(`⚠️ 未找到 Agent ${agentId} 的提示词文件，使用默认提示`);
  }

  // 🔥 如果存在拒绝原因，提取用户的具体要求
  const userRequirement = rejectionCount > 0 
    ? `\n\n【用户的具体要求】\n${rejectionReason}\n` 
    : '';

  // 构建完整 prompt
  let prompt = `
# 你是 Agent ${agentId}

${agentPrompt}

${userRequirement ? `

## 🚨🚨🚨 用户的明确要求（必须严格遵守）🚨🚨🚨

${userRequirement}

**⚠️ 最高优先级：以上要求绝对不可违背！**
- 在拆解任务前，先仔细阅读用户的要求
- 确保拆解方案完全符合用户的要求
- 如果用户要求了具体的子任务数量，必须严格遵守
- 如果用户要求了具体的执行方式，必须按照用户要求执行

` : ''}

---

## 🔴 关键信息：当前日期和时间计算规则

**今天的日期（北京时间）：${today}**

### 时间计算规则（必须严格遵守）：

1. **识别原始任务中的时间要求**：
   - 仔细阅读任务内容中的时间描述，例如：
     - "第1天18:00前" → 今天（${today}）
     - "第2天完成" → 明天（${getDatePlusDays(today, 1)}）
     - "第3天交付" → 后天（${getDatePlusDays(today, 2)}）
     - "1周内完成" → 7天后（${getDatePlusDays(today, 6)}）

2. **"第X天"的计算规则**：
   - 第1天 = 今天（${today}）
   - 第2天 = 今天 + 1天（${getDatePlusDays(today, 1)}）
   - 第3天 = 今天 + 2天（${getDatePlusDays(today, 2)}）
   - 第N天 = 今天 + (N-1)天

3. **如果任务中没有明确的时间要求**：
   - 第一个子任务的 deadline = 今天（${today}）
   - 后续子任务按顺序依次 +1 天
   - 例如：8个子任务 → deadline 依次为 ${today}, ${getDatePlusDays(today, 1)}, ${getDatePlusDays(today, 2)}, ...

4. **绝对不能使用示例日期**：
   - ❌ 禁止使用 "2026-02-20" 这样的示例日期
   - ❌ 禁止使用任何过去的日期
   - ✅ 必须使用基于今天（${today}）计算出的日期

---

## 当前任务

任务标题：${taskTitle}
任务内容：${taskContent}

---

## 历史拆解记录 🔥

${rejectionCount > 0 ? `
**🚨🚨🚨 重要提醒：此任务已被用户拒绝 ${rejectionCount} 次！🚨🚨🚨**

**用户拒绝原因**：
\`\`\`
${rejectionReason}
\`\`\`

**🔥 你必须严格遵守以下要求**：

1. **仔细阅读用户的拒绝原因**，逐条分析用户提出的问题
2. **根据用户的反馈调整拆解策略**，确保新的拆解方案能够满足用户的要求
3. **绝对避免重复上一次拆解中存在的问题**
4. **如果用户要求减少子任务数量（如"合并成5条"）**，必须严格遵守，生成的子任务数量不能超过用户要求的数量
5. **如果用户要求调整子任务内容**，必须按照用户的要求修改每个子任务的描述
6. **保持原始任务的时间结构**：如果原始任务中明确提到了"第1天、第2天、第3天"等时间结构，必须严格保持这种结构
7. **只修改需要调整的部分**：不要完全重新生成，而是基于上一次的拆解结果进行局部调整

**🎯 关键理解：如何识别用户意图**

请先分析用户拒绝原因的关键词，判断用户意图：

| 用户关键词 | 你的操作 |
|-----------|---------|
| "补充一条"、"增加一条"、"加一条" | **保留原有子任务不变**，只在最后**新增**1条 |
| "修改一下"、"调整一下"、"优化一下" | **只修改需要调整的子任务**，其他子任务保持原样 |
| "重新来"、"重新生成"、"换一个思路" | 可以完全重新生成 |
| "删除第X条"、"去掉第X条" | 只删除指定的子任务，其他保持原样 |

**⚠️ 极端重要：如果用户说"补充一条"**

- ❌ **不要**：完全重新生成，把原来的2条变成8条
- ✅ **应该**：保留原来的2条子任务**完全不变**，只在最后新增1条，总共变成3条
- ✅ **应该**：保持原有子任务的顺序、内容、执行者、截止时间**完全不变**

**⚠️ 警告**：
- 如果不按照用户的拒绝原因调整拆解，用户会继续拒绝
- 这是第 ${rejectionCount} 次拒绝，不要再犯同样的错误
- 用户期望的是一个能够解决问题的拆解方案，而不是重复之前的方案

**✅ 正确的做法**：
- 先分析用户的拒绝原因："用户为什么拒绝？"
- 然后判断用户意图："用户是想补充、修改、还是重新生成？"
- 最后生成新的拆解方案："确保这次拆解符合要求"
` : '此任务是首次拆解，没有历史记录。'}

${task.metadata?.splitResult ? `
**上一次拆解结果**（供参考，请基于此进行调整）：
- 子任务数量：${(() => {
    const splitResult = task.metadata.splitResult;
    if (typeof splitResult === 'string') {
      try {
        const parsed = JSON.parse(splitResult);
        return parsed.subTasks?.length || parsed.subtasks?.length || 0;
      } catch (e) {
        return 0;
      }
    } else {
      return splitResult.subTasks?.length || splitResult.subtasks?.length || 0;
    }
  })()}
- 拆解时间：${task.metadata.splitAt || '未知'}

**完整的上一次拆解结果**：
\`\`\`json
${typeof task.metadata.splitResult === 'string' 
  ? task.metadata.splitResult 
  : JSON.stringify(task.metadata.splitResult, null, 2)}
\`\`\`

**🔥 重要说明**：
1. 请基于上一次的拆解结果进行调整
2. 保持原始任务中的时间结构（第1天、第2天、第3天等）
3. 只根据用户的拒绝原因修改需要调整的部分
4. 不要完全重新生成，而是在原有基础上优化
` : ''}

---

## 你的任务

请基于你的身份和能力边界，将这个任务拆分成具体的执行步骤。

**特别说明**：
- **如果你是 insurance-d**：请严格按照你的**8个标准步骤**拆解任务（指令拆解、核心文本材料获取、标题创作、框架搭建、正文撰写、合规自查、去AI校验、最终核对）
- 如果用户提供了拒绝原因，请务必根据用户的反馈调整拆解策略
- 每个步骤应该：
  1. 明确可执行
  2. 有清晰的验收标准
  3. 符合你的业务边界和能力范围
  4. 按顺序执行，逻辑连贯

---

## 关键子任务判断标准 🔥

**关键子任务定义**：
- 如果该子任务失败，会导致后续依赖任务无法执行
- 或者该子任务失败，会导致整个任务目标无法实现

**判断标准**：
1. **前置依赖性**：该子任务是后续其他子任务的前提条件 => isCritical = true
2. **核心功能**：该子任务是实现目标的核心功能，失败则目标无法实现 => isCritical = true
3. **无替代方案**：该子任务失败后，没有可用的替代方案 => isCritical = true
4. **不可延后性**：该子任务必须现在完成，不能延后到后续迭代 => isCritical = true

**非关键子任务特征**：
1. **功能可选**：该子任务是锦上添花的功能，失败不影响核心目标 => isCritical = false
2. **有替代方案**：该子任务失败后，可以采用其他方式达成目标 => isCritical = false
3. **可延后迭代**：该子任务可以延后到后续版本中完成 => isCritical = false
4. **独立可并行**：该子任务失败不影响其他子任务的执行 => isCritical = false

**判断流程**：
\`\`\`
第一步：检查前置依赖
  => 如果有后续子任务依赖此任务 => isCritical = true

第二步：检查核心性
  => 如果是实现目标的核心功能 => isCritical = true

第三步：检查替代性
  => 如果失败后无替代方案 => isCritical = true

第四步：检查延后性
  => 如果必须现在完成，不能延后 => isCritical = true

否则 => isCritical = false
\`\`\`

---

## 数据库表结构说明

### 1. daily_task 表（日工作任务表）

这是你当前正在拆解的任务来源表，每个 daily_task 记录对应一个需要拆解的任务。

\`\`\`sql
CREATE TABLE daily_task (
  id UUID PRIMARY KEY,                    -- 日任务 ID（这是你正在拆解的任务 ID）
  task_id TEXT UNIQUE,                    -- 任务编号
  task_title TEXT NOT NULL,               -- 任务标题
  task_description TEXT NOT NULL,         -- 任务描述（你需要拆解的任务内容）
  executor TEXT NOT NULL,                 -- 执行主体（通常是 insurance-d）
  execution_status TEXT NOT NULL,         -- 执行状态
  execution_date DATE NOT NULL,           -- 执行日期
  sub_task_count INTEGER,                 -- 子任务数量（拆解后会更新）
  completed_sub_tasks INTEGER,            -- 已完成子任务数量
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
\`\`\`

### 2. agent_sub_tasks 表（Agent 子任务表）

这是你拆解后的子任务会存储的表，每个子任务对应一条记录。

**重要说明**：
- \`command_result_id\` 字段关联 \`daily_task.id\`（你正在拆解的任务 ID）
- 这表示子任务属于哪个 daily_task 记录

\`\`\`sql
CREATE TABLE agent_sub_tasks (
  id UUID PRIMARY KEY,                    -- 主键（自动生成）
  command_result_id UUID NOT NULL,         -- 关联 daily_task.id（你正在拆解的任务 ID）
  from_parents_executor TEXT NOT NULL,     -- 从父 daily_task 继承的 executor
  task_title TEXT NOT NULL,                -- 子任务标题
  task_description TEXT,                   -- 子任务描述
  status TEXT NOT NULL DEFAULT 'pending',  -- 状态：pending/in_progress/completed/blocked
  order_index INTEGER NOT NULL,            -- 执行顺序（1, 2, 3...）
  started_at TIMESTAMP,                    -- 开始时间
  completed_at TIMESTAMP,                  -- 完成时间
  metadata JSONB DEFAULT '{}',             -- 元数据（包含 acceptanceCriteria, isCritical, criticalReason）
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  dialogue_session_id TEXT,                -- 对话会话 ID
  dialogue_rounds INTEGER DEFAULT 0,       -- 对话轮数
  dialogue_status TEXT DEFAULT 'none',     -- 对话状态：none/in_progress/completed/timeout
  last_dialogue_at TIMESTAMP,              -- 最后对话时间
  execution_result TEXT,                   -- 执行结果
  status_proof TEXT,                       -- 状态证明
  is_dispatched BOOLEAN DEFAULT false,     -- 是否已分发
  dispatched_at TIMESTAMP,                 -- 分发时间
  timeout_handling_count INTEGER DEFAULT 0, -- 超时处理次数
  feedback_history JSONB DEFAULT '[]',     -- 反馈历史
  last_feedback_at TIMESTAMP,              -- 最后反馈时间
  escalated BOOLEAN DEFAULT false,         -- 是否升级
  escalated_at TIMESTAMP,                  -- 升级时间
  escalated_reason TEXT                    -- 升级原因
);
\`\`\`

**两级拆解架构说明**：
1. **第一层拆解**（由 Agent B 执行）：agent_tasks（总任务）→ 拆解为 → daily_task（每日子任务）
2. **第二层拆解**（由 insurance-d 执行）：daily_task（每日子任务）→ 拆解为 → agent_sub_tasks（执行步骤）

你现在正在进行的是**第二层拆解**，将 daily_task 记录拆解为 agent_sub_tasks 记录。

### 3. 字段说明

| 数据库字段 | 数据类型 | 说明 | 由谁负责 |
|-----------|---------|------|---------|
| id | uuid | 主键 | 后端自动生成 |
| command_result_id | uuid | 关联 daily_task.id（你正在拆解的任务 ID） | 后端自动处理 |
| from_parents_executor | text | 从父 daily_task 继承的 executor | 后端自动设置（使用父任务的 executor） |
| task_title | text | 子任务标题 | **你返回**（对应 "title"） |
| task_description | text | 子任务描述 | **你返回**（对应 "description"） |
| status | text | 状态：pending/in_progress/completed/blocked | 后端自动设置 |
| order_index | integer | 执行顺序（1, 2, 3...） | **你返回**（对应 "orderIndex"） |
| started_at | timestamp | 开始时间 | 后端自动设置 |
| completed_at | timestamp | 完成时间 | 后端自动设置 |
| dialogue_session_id | text | 对话会话 ID | 后端自动处理 |
| dialogue_rounds | integer | 对话轮数 | 后端自动处理 |
| dialogue_status | text | 对话状态 | 后端自动处理 |
| last_dialogue_at | timestamp | 最后对话时间 | 后端自动处理 |
| metadata | jsonb | 元数据 JSON（包含 executor, parentTaskExecutor 等） | **你提供内容**（存储到 metadata 字段） |
| created_at | timestamp | 创建时间 | 后端自动生成 |
| updated_at | timestamp | 更新时间 | 后端自动生成 |

## executor 字段说明

executor 字段指定执行该子任务的 agent ID，例如：
- **insurance-d**: 任务拆分与管理 agent（你）
- **insurance-a**: 保险内容撰写 agent
- **insurance-b**: 保险合规审核 agent
- **insurance-c**: 图片素材匹配 agent

根据子任务的特性，选择最合适的 agent 执行。

## metadata 字段结构

\`\`\`json
{
  "acceptanceCriteria": "验收标准",
  "isCritical": true/false,
  "criticalReason": "关键原因（仅当 isCritical=true 时提供）",
  "executor": "执行该子任务的 agent ID"
}
\`\`\`

## 你需要返回的字段

你只需要返回以下 JSON 格式的数据（数组格式），后端会自动处理其他字段：

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderIndex | Integer | 是 | **执行顺序号**，表示子任务的执行次序，从 1 开始递增（1, 2, 3...）。需要根据任务之间的依赖关系合理安排顺序，例如：收集素材（1）-> 撰写文章（2）-> 合规校验（3）-> 添加配图（4） |
| title | String | 是 | 子任务标题，简明扼要地描述该子任务的核心内容 |
| description | String | 是 | 子任务详细描述，说明具体要做什么、如何做、达到什么要求 |
| executor | String | 是 | **执行该子任务的 agent ID**，指定由哪个 agent 负责执行此子任务，例如：insurance-a（撰写）、insurance-b（合规）、insurance-c（配图）等。需要根据任务特性匹配对应能力的 agent |
| deadline | String | 是 | **截止时间**，格式为 YYYY-MM-DD，例如 "2026-02-20"。根据原始任务的时间要求合理安排每个子任务的截止时间 |
| priority | String | 是 | **优先级**，可选值：urgent（紧急）、normal（普通）、low（低）。根据子任务的重要性和紧急程度合理安排优先级 |
| estimatedHours | Number | 是 | **预计工时**，单位为小时，例如 4（表示4小时）。根据子任务的复杂度合理预估所需时间 |
| acceptanceCriteria | String | 是 | 验收标准，明确界定任务完成的具体要求、质量标准、交付物形式 |
| isCritical | Boolean | 是 | 是否为关键子任务。true 表示关键路径上的任务，失败会影响整体任务；false 表示可延后或跳过的任务 |
| criticalReason | String | 条件必填 | 关键原因，仅当 isCritical=true 时必填，说明为什么此任务是关键的 |

**字段填写规则：**

1. **orderIndex（执行顺序）**：
   - 必须按照任务执行的先后顺序填写数字（1, 2, 3...）
   - 考虑任务依赖关系：前置任务必须先执行
   - 示例：先收集素材（orderIndex=1），再撰写文章（orderIndex=2），最后合规校验（orderIndex=3）

2. **executor（执行者）**：
   - 必须填写有效的 agent ID
   - 根据任务类型选择最合适的 agent
   - 支持多 agent 协作：不同步骤可分配给不同 agent

3. **deadline（截止时间）**：
   - 格式必须为 YYYY-MM-DD，例如 "2026-02-20"
   - 根据原始任务的整体时间要求，合理分配每个子任务的截止时间
   - 考虑子任务之间的依赖关系，前置任务的截止时间应早于后置任务

4. **priority（优先级）**：
   - urgent（紧急）：关键路径上的任务，或时间敏感的任务
   - normal（普通）：一般重要性的任务
   - low（低）：可延后或非核心的任务

5. **estimatedHours（预计工时）**：
   - 单位为小时，例如 4（表示4小时）
   - 根据子任务的复杂度和工作量合理预估
   - 简单任务：1-4小时
   - 中等任务：4-8小时
   - 复杂任务：8小时以上

6. **isCritical（关键性）**：
   - 关键路径上的任务设为 true
   - 可延后或非核心任务设为 false

**重要说明：**
- **executor 字段必须填写**：指定执行该子任务的 agent ID，例如 "insurance-a"（撰写）、"insurance-b"（合规）、"insurance-c"（配图）等
- **根据任务特性分配 agent**：不同类型的任务应分配给不同能力的 agent
- **支持多 agent 协作**：一个任务可以拆分为多个子任务，分配给不同 agent 执行
- **orderIndex 必须连续且合理**：确保任务执行顺序符合逻辑依赖关系

**示例 1：保险文章创作任务拆解**

\`\`\`json
[
  {
    "orderIndex": 1,
    "title": "收集保险素材",
    "description": "收集相关的保险产品素材、案例素材、合规素材，包括产品条款、理赔案例、监管政策等",
    "executor": "insurance-b",
    "deadline": "2026-02-20",
    "priority": "urgent",
    "estimatedHours": 4,
    "acceptanceCriteria": "素材收集完成，整理成文档，包含至少 5 个产品素材、3 个真实案例、2 条合规政策，符合保险事业部规范",
    "isCritical": true,
    "criticalReason": "素材是文章撰写的前提，没有素材无法撰写文章"
  },
  {
    "orderIndex": 2,
    "title": "撰写保险文章初稿",
    "description": "根据收集的素材撰写保险文章初稿，确保内容合规、真实、实用，字数控制在 1500-1600 字",
    "executor": "insurance-a",
    "deadline": "2026-02-21",
    "priority": "urgent",
    "estimatedHours": 8,
    "acceptanceCriteria": "初稿完成，字数 1500-1600 字，符合微信公众号合规规则，无夸大、无违规表述，包含 1-2 个真实案例",
    "isCritical": true,
    "criticalReason": "文章撰写是核心任务，无法完成则整个任务失败"
  },
  {
    "orderIndex": 3,
    "title": "合规校验与修正",
    "description": "使用 Agent B 提供的合规规则进行校验，修正违规点，确保文章符合监管要求",
    "executor": "insurance-b",
    "deadline": "2026-02-22",
    "priority": "urgent",
    "estimatedHours": 2,
    "acceptanceCriteria": "通过合规校验，无违规点，文末标注「内容仅供科普参考，具体保障责任以保险合同条款为准」",
    "isCritical": true,
    "criticalReason": "保险内容必须通过合规审核，否则无法发布"
  },
  {
    "orderIndex": 4,
    "title": "添加配图",
    "description": "为文章添加相关配图，增强视觉效果，配图需为免费商用无版权图片",
    "executor": "insurance-c",
    "deadline": "2026-02-23",
    "priority": "normal",
    "estimatedHours": 2,
    "acceptanceCriteria": "添加 2-3 张配图，清晰美观，附图片来源链接",
    "isCritical": false,
    "criticalReason": "配图是锦上添花的功能，失败不影响文章内容发布"
  }
]
\`\`\`

**示例 2：insurance-d 按照8个标准步骤拆解任务**

你是 insurance-d（保险事业部内容主编），按照你的8个标准步骤拆解文章创作任务：

\`\`\`json
[
  {
    "orderIndex": 1,
    "title": "指令拆解",
    "description": "接收创作指令后，明确核心关键词（如分红险），拆解中老年受众核心痛点，确定文章核心价值（如'帮中老年理性了解分红险、避坑'）",
    "executor": "insurance-d",
    "deadline": "2026-02-20",
    "priority": "urgent",
    "estimatedHours": 2,
    "acceptanceCriteria": "明确核心关键词、核心受众痛点、文章核心价值，不偏离保险科普、中老年友好的核心定位",
    "isCritical": true,
    "criticalReason": "指令拆解是第一步，决定了文章整体方向，方向错误会导致后续所有步骤无效"
  },
  {
    "orderIndex": 2,
    "title": "核心文本材料获取",
    "description": "从固定目录获取核心文本材料（如保险知识点、案例、事项描述等）；若未获取到材料，自行结合关键词（如分红险）、中老年受众需求，生成贴合主题的案例/实操相关内容",
    "executor": "insurance-d",
    "deadline": "2026-02-20",
    "priority": "urgent",
    "estimatedHours": 3,
    "acceptanceCriteria": "获取或生成足够的素材内容，确保内容不遗漏、不偏离保险科普核心，贴合中老年理解习惯",
    "isCritical": true,
    "criticalReason": "素材是文章撰写的基础，没有素材无法撰写高质量内容"
  },
  {
    "orderIndex": 3,
    "title": "标题创作",
    "description": "严格按照标题规则执行，确定包含三类词的标题（18-26字），无误导、不标题党，若关键词为分红险，按专属要求搭配词汇",
    "executor": "insurance-d",
    "deadline": "2026-02-21",
    "priority": "urgent",
    "estimatedHours": 2,
    "acceptanceCriteria": "标题符合规则（18-26字，包含核心行业词、用户需求词、友好安心词），无误导、不标题党，自查合规性和适配性",
    "isCritical": true,
    "criticalReason": "标题是吸引读者的第一步，不合格的标题会影响文章传播"
  },
  {
    "orderIndex": 4,
    "title": "框架搭建",
    "description": "对照固定结构，梳理每部分核心内容——开头明确用户价值、正文确定3条实操方向、结尾规划温和提醒，确保结构完整，不遗漏任何模块",
    "executor": "insurance-d",
    "deadline": "2026-02-21",
    "priority": "urgent",
    "estimatedHours": 2,
    "acceptanceCriteria": "框架完整，包含开头、正文3条实操、结尾、关注引导、留言引导，无遗漏模块",
    "isCritical": true,
    "criticalReason": "框架是文章的骨架，框架不完整会导致内容混乱"
  },
  {
    "orderIndex": 5,
    "title": "正文撰写",
    "description": "按内容规则撰写，全程大白话、短句短段，控制全文1000字左右；嵌入关键词，融入'去AI核心要求'（加语气词、场景碎片等）",
    "executor": "insurance-d",
    "deadline": "2026-02-22",
    "priority": "urgent",
    "estimatedHours": 6,
    "acceptanceCriteria": "正文完成，字数1000字左右（误差不超过50字），全程大白话、短句短段，无专业术语，自然融入关键词和去AI元素",
    "isCritical": true,
    "criticalReason": "正文是文章的核心内容，质量直接影响读者体验"
  },
  {
    "orderIndex": 6,
    "title": "合规自查",
    "description": "对照合规底线，重点检查关键词相关表述（如分红险不夸大分红、不承诺收益），杜绝焦虑、违规内容，确保所有表述贴合合规要求",
    "executor": "insurance-d",
    "deadline": "2026-02-22",
    "priority": "urgent",
    "estimatedHours": 2,
    "acceptanceCriteria": "通过合规检查，无夸大、不承诺、不违规、不贩卖焦虑，符合监管要求，文末标注'内容仅供科普参考'",
    "isCritical": true,
    "criticalReason": "保险内容必须通过合规审核，否则无法发布"
  },
  {
    "orderIndex": 7,
    "title": "去AI校验",
    "description": "对照去AI核心要求，自查语气词、场景碎片、AI书面词禁用情况，调整说教感表述，确保内容自然有温度",
    "executor": "insurance-d",
    "deadline": "2026-02-23",
    "priority": "normal",
    "estimatedHours": 2,
    "acceptanceCriteria": "通过去AI校验，有2-3个生活化语气词，至少1条带场景碎片，无AI书面词，无说教感，语气平等温和",
    "isCritical": false,
    "criticalReason": "去AI校验是锦上添花的功能，可以延后迭代优化"
  },
  {
    "orderIndex": 8,
    "title": "最终核对",
    "description": "整体核对——字数误差、结构完整性、关键词融入、合规性、去AI效果；核对核心文本材料（若有）是否准确使用、无遗漏、不生硬",
    "executor": "insurance-d",
    "deadline": "2026-02-23",
    "priority": "urgent",
    "estimatedHours": 1,
    "acceptanceCriteria": "所有核对项都符合要求，字数准确、结构完整、关键词自然融入、合规无误、去AI效果良好",
    "isCritical": true,
    "criticalReason": "最终核对是最后一道关卡，确保文章质量符合预期"
  }
]
\`\`\`

**示例 3：技术开发任务拆解**

\`\`\`json
[
  {
    "orderIndex": 1,
    "title": "需求分析与设计",
    "description": "分析业务需求，设计系统架构，编写技术方案文档",
    "executor": "tech-architect",
    "deadline": "2026-02-20",
    "priority": "urgent",
    "estimatedHours": 8,
    "acceptanceCriteria": "需求分析文档完成，包含功能清单、技术架构图、数据库设计，通过评审",
    "isCritical": true,
    "criticalReason": "需求分析是开发的基础，没有明确的需求和设计，后续开发无法进行"
  },
  {
    "orderIndex": 2,
    "title": "数据库设计与实现",
    "description": "根据需求设计数据库表结构，编写迁移脚本，初始化数据",
    "executor": "backend-developer",
    "deadline": "2026-02-21",
    "priority": "urgent",
    "estimatedHours": 4,
    "acceptanceCriteria": "数据库表设计完成，迁移脚本可执行，初始化数据正确",
    "isCritical": true,
    "criticalReason": "数据库是系统核心，没有数据库支撑，业务逻辑无法实现"
  },
  {
    "orderIndex": 3,
    "title": "后端接口开发",
    "description": "开发后端 API 接口，实现业务逻辑，编写单元测试",
    "executor": "backend-developer",
    "deadline": "2026-02-22",
    "priority": "urgent",
    "estimatedHours": 16,
    "acceptanceCriteria": "API 接口开发完成，功能正常，单元测试覆盖率 >80%",
    "isCritical": true,
    "criticalReason": "后端接口是系统的核心功能，没有接口无法提供业务服务"
  },
  {
    "orderIndex": 4,
    "title": "前端页面开发",
    "description": "开发前端页面，对接后端接口，实现用户交互",
    "executor": "frontend-developer",
    "deadline": "2026-02-23",
    "priority": "normal",
    "estimatedHours": 12,
    "acceptanceCriteria": "前端页面开发完成，功能正常，UI 符合设计稿，兼容主流浏览器",
    "isCritical": false,
    "criticalReason": "前端可以延后迭代，先用命令行或简单工具进行功能验证"
  },
  {
    "orderIndex": 5,
    "title": "部署上线",
    "description": "将系统部署到生产环境，配置域名、SSL、监控告警",
    "executor": "devops-engineer",
    "deadline": "2026-02-24",
    "priority": "low",
    "estimatedHours": 4,
    "acceptanceCriteria": "系统部署成功，可正常访问，监控告警配置完成",
    "isCritical": false,
    "criticalReason": "部署可以在测试环境完成，生产环境部署可以延后"
  }
]
\`\`\`

## 数据流转过程

1. 你返回上述 JSON 格式的子任务数据
2. 后端接收后，自动：
   - 生成 id（UUID）
   - 设置 command_result_id
   - 设置 agent_id
   - 设置 status 为 'pending'
   - 将 acceptanceCriteria、isCritical、criticalReason 存储到 metadata 字段
   - 设置 created_at 和 updated_at
3. 数据最终存储到 agent_sub_tasks 表中

---

## 返回格式要求

⚠️⚠️⚠️ **极其重要：只返回纯 JSON，不要使用 Markdown 格式！** ⚠️⚠️⚠️

**绝对禁止**：
- ❌ 不要使用 \`\`\`json 和 \`\`\` 包裹
- ❌ 不要在 JSON 前后添加任何说明文字
- ❌ 不要添加任何 Markdown 格式

**只返回纯 JSON 数组**：
[
  {
    "orderIndex": 1,
    "title": "第一个子任务",
    "description": "详细描述要完成的任务内容",
    "executor": "insurance-d",
    "deadline": "2026-02-20",
    "priority": "urgent",
    "estimatedHours": 4,
    "acceptanceCriteria": "验收标准：明确界定任务完成的具体要求",
    "isCritical": true,
    "criticalReason": "这是关键任务，失败会影响整体进度"
  },
  {
    "orderIndex": 2,
    "title": "第二个子任务",
    "description": "详细描述要完成的任务内容",
    "executor": "insurance-d",
    "deadline": "2026-02-21",
    "priority": "normal",
    "estimatedHours": 2,
    "acceptanceCriteria": "验收标准：明确界定任务完成的具体要求",
    "isCritical": true,
    "criticalReason": "这是关键任务，失败会影响整体进度"
  }
]

**重要说明**：
- ✅ 只返回纯 JSON 数组，不要任何其他内容
- ✅ 确保 JSON 格式正确，可以被 JSON.parse() 直接解析
- ✅ 每个子任务必须包含所有必填字段
- ✅ 从第一个字符开始就是 [，最后一个字符就是 ]
  `;

  console.log(`📝 Prompt 长度: ${prompt.length} 字符`);
  console.log(`📝 完整 Prompt 内容:`, prompt);

  // 🔥 添加日志，检查 prompt 中的历史拆解记录部分
  console.log(`🔥 [splitTaskForAgent] Prompt 中的历史拆解记录部分:`);
  const historySectionStart = prompt.indexOf('## 历史拆解记录');
  if (historySectionStart !== -1) {
    const historySectionEnd = prompt.indexOf('---', historySectionStart + 1);
    const historySection = historySectionEnd !== -1 
      ? prompt.substring(historySectionStart, historySectionEnd)
      : prompt.substring(historySectionStart);
    console.log(historySection);
  } else {
    console.log(`  ❌ 未找到历史拆解记录部分`);
  }

  // 🔥 加载 Agent 记忆
  const memoryContext = await getMemoryContext(agentId, taskTitle + taskContent, {
    maxMemories: 5,
    minImportance: 6,
    memoryTypes: ['strategy', 'experience', 'knowledge'],
  });

  if (memoryContext) {
    prompt += memoryContext;
    console.log(`💭 已加载 Agent ${agentId} 的记忆上下文`);
  }

  // 集成 LLM 调用
  try {
    const llm = getLLMClient();
    console.log(`🤖 调用 LLM 进行任务拆解...`);

    const response = await llm.invoke([
      { role: 'system', content: prompt },
    ], {
      temperature: 0.3, // 较低的温度以获得更稳定的输出
    });

    console.log(`✅ LLM 响应成功`);

    // 解析 LLM 响应
    const content = response.content;
    console.log(`📄 LLM 返回内容长度: ${content.length} 字符`);

    let subTasks: SubTaskSplitResult[];

    try {
      // 🔥 简化：优先直接解析纯 JSON，不要 Markdown 格式
      let jsonStr = '';

      // 方法1：优先尝试直接解析整个内容为 JSON（最快路径）
      console.log(`[extract] 优先尝试直接解析纯 JSON...`);
      try {
        subTasks = JSON.parse(content.trim());
        console.log(`✅ 直接解析 JSON 成功！`);
      } catch (directParseError) {
        console.log(`[extract] 直接解析失败，尝试提取 JSON 数组...`);
        
        // 方法2：如果直接解析失败，尝试提取 JSON 数组（兼容旧格式）
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          jsonStr = arrayMatch[0];
          console.log(`[extract] 提取到 JSON 数组`);
          subTasks = JSON.parse(jsonStr);
        } else {
          // 方法3：最后尝试 Markdown 代码块（仅为了向后兼容）
          const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
          if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
            console.log(`[extract] 从 Markdown 代码块中提取 JSON（向后兼容）`);
            subTasks = JSON.parse(jsonStr);
          } else {
            throw new Error('No JSON array found in LLM response');
          }
        }
      }

      console.log(`✅ 成功解析 ${subTasks.length} 个子任务`);

      // 验证子任务数据结构
      subTasks = subTasks.filter((task, index) => {
        if (!task.orderIndex || !task.title || !task.description || !task.executor) {
          console.warn(`⚠️ 子任务 ${index} 缺少必填字段，跳过:`, task);
          return false;
        }
        return true;
      });

      if (subTasks.length === 0) {
        throw new Error('没有有效的子任务数据');
      }

      // 按照执行顺序排序
      subTasks.sort((a, b) => a.orderIndex - b.orderIndex);

      console.log(`✅ 子任务验证完成，最终数量: ${subTasks.length}`);

      // 缓存结果
      agentTaskSplitCache.set(cacheKey, subTasks);

      return subTasks;
    } catch (parseError) {
      console.error(`❌ 解析 LLM 响应失败:`, parseError);
      console.error(`📄 原始响应:`, content);

      // 解析失败时返回默认模拟数据
      console.warn(`⚠️ 使用默认模拟数据`);
      const defaultTasks = [
        {
          orderIndex: 1,
          title: '收集素材',
          description: '收集相关的产品素材和数据',
          executor: agentId,
          acceptanceCriteria: '素材收集完成，整理成文档',
          isCritical: true,
          criticalReason: '素材是任务执行的前提，没有素材无法继续',
        },
        {
          orderIndex: 2,
          title: '执行任务',
          description: '根据素材执行任务',
          executor: agentId,
          acceptanceCriteria: '任务完成，符合要求',
          isCritical: true,
          criticalReason: '这是核心执行任务，失败则整个任务无法完成',
        },
      ];

      // 缓存默认结果
      agentTaskSplitCache.set(cacheKey, defaultTasks);

      return defaultTasks;
    }
  } catch (error) {
    console.error(`❌ LLM 调用失败:`, error);
    throw new Error(`LLM 调用失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Agent 提供解决方案
 * @param agentId Agent ID
 * @param problem 问题描述
 * @param roundNumber 第几轮沟通
 * @returns 解决方案
 */
export async function agentProvideSolution(
  agentId: string,
  problem: string,
  roundNumber: number
) {
  console.log(`💡 Agent ${agentId} 开始提供解决方案...`);

  // 生成缓存键（包含问题描述和轮次）
  // 注意：不同轮次可能有不同的解决方案，所以轮次也要加入缓存键
  const cacheKey = generateCacheKey(agentId, hashString(problem), roundNumber);

  // 检查缓存
  const cached = agentSolutionCache.get(cacheKey);
  if (cached) {
    console.log(`✅ Agent ${agentId} 解决方案已缓存`);
    return cached;
  }

  // 加载 Agent 身份提示词
  let agentPrompt = '';
  if (hasAgentPrompt(agentId)) {
    agentPrompt = loadAgentPrompt(agentId);
    console.log(`✅ 已加载 Agent ${agentId} 的身份提示词`);
  } else {
    console.log(`⚠️ 未找到 Agent ${agentId} 的提示词文件，使用默认提示`);
  }

  // 构建完整 prompt
  let prompt = `
# 你是 Agent ${agentId}

${agentPrompt}

---

## 当前问题

问题描述：${problem}
当前是第 ${roundNumber} 轮沟通

---

## 你的任务

请基于你的身份和能力边界，提供解决方案或进一步的建议。如果已经沟通多次，请尝试新的角度。

---

## 返回格式

请严格按照以下 JSON 格式返回：

\`\`\`json
{
  "suggestion": "你的建议或解决方案",
  "isHelpful": true/false
}
\`\`\`
  `;

  console.log(`📝 Prompt 长度: ${prompt.length} 字符`);

  // TODO: 集成 LLM 调用
  // const response = await callLLM(prompt);
  // const result = JSON.parse(response);

  // 临时返回模拟数据
  const result = {
    suggestion: `我理解你的问题。让我帮你分析一下...（第 ${roundNumber} 轮建议）`,
    isHelpful: true,
  };

  // 缓存结果
  agentSolutionCache.set(cacheKey, result);

  return result;
}

/**
 * Agent 回答问题
 * @param agentId Agent ID
 * @param question 问题
 * @returns 回答
 */
export async function agentAnswerQuestion(agentId: string, question: string) {
  console.log(`💬 Agent ${agentId} 开始回答问题...`);

  // 生成缓存键
  const cacheKey = generateCacheKey(agentId, hashString(question));

  // 检查缓存
  const cached = agentAnswerCache.get(cacheKey);
  if (cached) {
    console.log(`✅ Agent ${agentId} 回答已缓存`);
    return cached;
  }

  // 加载 Agent 身份提示词
  let agentPrompt = '';
  if (hasAgentPrompt(agentId)) {
    agentPrompt = loadAgentPrompt(agentId);
    console.log(`✅ 已加载 Agent ${agentId} 的身份提示词`);
  } else {
    console.log(`⚠️ 未找到 Agent ${agentId} 的提示词文件，使用默认提示`);
  }

  // 构建完整 prompt
  let prompt = `
# 你是 Agent ${agentId}

${agentPrompt}

---

## 问题

${question}

---

## 你的任务

请基于你的身份和能力边界，回答这个问题。

---

## 返回格式

请直接返回你的回答，不需要 JSON 格式。
  `;

  console.log(`📝 Prompt 长度: ${prompt.length} 字符`);

  // TODO: 集成 LLM 调用
  // const response = await callLLM(prompt);
  // const result = response;

  // 临时返回模拟数据
  const result = `我收到了你的问题。让我基于我的身份和能力来回答...`;

  // 缓存结果
  agentAnswerCache.set(cacheKey, result);

  return result;
}

/**
 * 获取所有缓存的统计信息
 */
export function getCacheStats() {
  return printAllCacheStats();
}

/**
 * 清空所有缓存
 */
export function clearAllCaches() {
  agentSelfCheckCache.clear();
  agentTaskSplitCache.clear();
  agentSolutionCache.clear();
  agentAnswerCache.clear();
  console.log('✅ 所有缓存已清空');
}
