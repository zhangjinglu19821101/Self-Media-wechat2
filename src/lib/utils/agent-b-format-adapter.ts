/**
 * Agent B 格式适配器
 * 自动检测和转换新旧格式
 */

import type { AgentBOldFormat, AgentBNewFormat, AgentBUnifiedFormat } from '../types/agent-b-response';

/**
 * Agent B 格式适配器类
 */
export class AgentBFormatAdapter {
  /**
   * 检测响应格式类型
   */
  static detectFormat(response: any): 'old' | 'new' | 'agent-t' | 'executor' | 'unknown' {
    if (!response || typeof response !== 'object') {
      return 'unknown';
    }
    
    console.log('[AgentBFormatAdapter] 检测格式，响应字段:', Object.keys(response));
    
    // 🔴 检测 Executor 格式（Agent T/insurance-d 标准返回格式）
    // 优先级最高，因为这是新的标准格式
    if ('isCompleted' in response && 'result' in response && 'structuredResult' in response) {
      console.log('[AgentBFormatAdapter] ✅ 检测到 Executor 格式（标准返回格式）');
      return 'executor';
    }
    
    // 检测旧格式（Agent B 格式）
    if ('type' in response && 'reasonCode' in response && 'context' in response) {
      console.log('[AgentBFormatAdapter] ✅ 检测到旧格式（Agent B 格式）');
      return 'old';
    }
    
    // 检测 Agent T 旧扁平格式（向后兼容）
    if ('action' in response && 'solutionNum' in response && 'toolName' in response) {
      console.log('[AgentBFormatAdapter] ✅ 检测到 Agent T 旧扁平格式（向后兼容）');
      return 'agent-t';
    }
    
    // 检测新格式
    if ('status' in response && 'result' in response && 'message' in response) {
      console.log('[AgentBFormatAdapter] ✅ 检测到新格式（标准模板）');
      return 'new';
    }
    
    console.log('[AgentBFormatAdapter] ⚠️  未知格式');
    return 'unknown';
  }

  /**
   * 转换为统一格式
   */
  static convertToUnified(response: any): AgentBUnifiedFormat {
    const format = this.detectFormat(response);
    
    console.log('[AgentBFormatAdapter] 开始转换，格式类型:', format);
    
    switch (format) {
      case 'old':
        return this.convertOldToUnified(response as AgentBOldFormat);
      case 'new':
        return this.convertNewToUnified(response as AgentBNewFormat);
      case 'agent-t':
        return this.convertAgentTToUnified(response);
      case 'executor':
        return this.convertExecutorToUnified(response);
      default:
        return this.tryExtractFromUnknown(response);
    }
  }

  /**
   * 🔴 Executor 格式 → 统一格式（Agent T/insurance-d 标准返回格式）
   * 
   * Executor 格式：
   * {
   *   isCompleted: true/false,
   *   result: "【执行结论】...",
   *   suggestion: "...",
   *   structuredResult: { ... }
   * }
   * 
   * 转换为统一格式后：
   * - 如果 isCompleted=true → decisionType: 'COMPLETE'
   * - 如果 isCompleted=false → decisionType: 由 Agent B 根据 result 决定
   */
  private static convertExecutorToUnified(executor: any): AgentBUnifiedFormat {
    console.log('[AgentBFormatAdapter] Executor 格式 → 统一格式');
    console.log('[AgentBFormatAdapter] Executor 原始数据:', {
      isCompleted: executor.isCompleted,
      isCompleted: executor.isCompleted,
      result: executor.result,
      hasStructuredResult: !!executor.structuredResult
    });
    
    // 🔴🔴🔴 核心逻辑：根据 isCompleted 和 isCompleted 综合判断 decisionType
    // 优先级：isCompleted > isCompleted
    // 1. isCompleted=false → 执行者不具备完成此任务的能力，需要切换执行者 → REEXECUTE_EXECUTOR
    // 2. isCompleted=true 或 isCompleted=true → 任务执行成功 → COMPLETE
    // 3. isCompleted=false（无 isCompleted）→ 任务执行失败，需要 Agent B 决定下一步 → FAILED
    
    let decisionType: 'COMPLETE' | 'FAILED' | 'REEXECUTE_EXECUTOR';
    let reasoning = executor.result || executor.suggestion || '执行完成';
    
    // 提取 structuredResult 中的关键信息
    if (executor.structuredResult) {
      const { executionSummary, resultContent } = executor.structuredResult;
      
      // 工具使用记录
      if (executionSummary?.toolsUsed?.length > 0) {
        console.log('[AgentBFormatAdapter] Executor 使用了工具:', executionSummary.toolsUsed);
      }
      
      // 失败原因
      if (executionSummary?.failureReason) {
        reasoning = `执行失败：${executionSummary.failureReason}。${executor.result || ''}`;
      }
    }
    
    // 🔴 根据 isCompleted 字段判断 decisionType
    if (executor.isCompleted === false) {
      // isCompleted=false 表示执行者不具备完成此任务的能力
      // 需要切换执行者
      decisionType = 'REEXECUTE_EXECUTOR';
      console.log('[AgentBFormatAdapter] 🔴 检测到 isCompleted=false，返回 REEXECUTE_EXECUTOR');
      
      // 从 structuredResult 中提取 reason（为什么不能完成）
      const reason = executor.reason || executor.structuredResult?.reason || executor.suggestion || '执行者不具备完成此任务的能力';
      reasoning = `执行者无法完成此任务：${reason}`;
      
      // 🔴🔴🔴 关键修复：根据 reason 内容推断应该使用哪个执行者
      // insurance-d 的 reason 通常包含"合规"、"审核"、"Agent T"等关键词
      const suggestedExecutor = this.inferSuggestedExecutor(reason, executor);
      
      // 🔴🔴🔴 关键：填充 context 和 data，让 handleDecisionType 能正确提取执行者
      // 🔴 reasoning 可能为空，使用空字符串兜底
      const safeReasoning = reasoning || '';
      const unified: AgentBUnifiedFormat = {
        decisionType: decisionType,
        reasoning: reasoning,
        // 🔴 新增：保留完整的执行结果，供 Agent B 做后续决策
        completionResult: executor.structuredResult?.resultContent || executor.result,
        // 🔴🔴🔴 关键：填充 context 和 data，让 handleDecisionType 能正确提取执行者
        context: {
          executionSummary: safeReasoning.substring(0, 200),
          riskLevel: 'medium',
          suggestedAction: suggestedExecutor ? `更换执行者为 ${suggestedExecutor}` : '重新分派执行者',
          suggestedExecutor: suggestedExecutor
        },
        data: {
          from_parents_executor: suggestedExecutor
        }
      };
      
      console.log('[AgentBFormatAdapter] 🔴🔴🔴 已填充执行者信息:', {
        suggestedExecutor,
        from_parents_executor: suggestedExecutor
      });
      
      console.log('[AgentBFormatAdapter] Executor 格式转换完成:', {
        decisionType: unified.decisionType,
        reasoning: unified.reasoning?.substring(0, 100)
      });
      
      return unified;
    } else if (executor.isCompleted || executor.isCompleted === true) {
      // 任务执行成功
      decisionType = 'COMPLETE';
      console.log('[AgentBFormatAdapter] ✅ 检测到 isCompleted=true 或 isCompleted=true，返回 COMPLETE');
      
      const unified: AgentBUnifiedFormat = {
        decisionType: decisionType,
        reasoning: reasoning,
        // 🔴 新增：保留完整的执行结果，供 Agent B 做后续决策
        completionResult: executor.structuredResult?.resultContent || executor.result,
      };
      
      console.log('[AgentBFormatAdapter] Executor 格式转换完成:', {
        decisionType: unified.decisionType,
        reasoning: unified.reasoning?.substring(0, 100)
      });
      
      return unified;
    } else {
      // 其他失败情况
      decisionType = 'FAILED';
      console.log('[AgentBFormatAdapter] ⚠️  其他失败情况，返回 FAILED');
      
      const unified: AgentBUnifiedFormat = {
        decisionType: decisionType,
        reasoning: reasoning,
        // 🔴 新增：保留完整的执行结果，供 Agent B 做后续决策
        completionResult: executor.structuredResult?.resultContent || executor.result,
      };
      
      console.log('[AgentBFormatAdapter] Executor 格式转换完成:', {
        decisionType: unified.decisionType,
        reasoning: unified.reasoning?.substring(0, 100)
      });
      
      return unified;
    }
  }

  /**
   * 🔴🔴🔴 根据 reason 内容推断应该使用哪个执行者
   * insurance-d 返回 isCompleted=false 时，reason 通常包含：
   * - "合规"、"审核"、"Agent T" → 应该切换到 Agent T
   * - "公众号"、"格式化"、"format"、"wechat"、"合规审核" → 应该切换到 Agent T（公众号格式化由 Agent T 负责）
   * - 其他关键词 → 默认返回 undefined，让 Agent B 自己决定
   */
  private static inferSuggestedExecutor(reason: string, executor: any): string | undefined {
    const lowerReason = (reason || '').toLowerCase();
    
    console.log('[AgentBFormatAdapter] 🔴 推断执行者，reason:', reason);
    
    // 检查是否包含"合规"、"审核"、"合规审核"、"compliance"
    if (lowerReason.includes('合规') || lowerReason.includes('审核') || lowerReason.includes('compliance')) {
      console.log('[AgentBFormatAdapter] 🔴 推断：reason 包含合规/审核关键词，建议使用 Agent T');
      return 'agent T';
    }
    
    // 检查是否包含"Agent T"
    if (lowerReason.includes('agent t')) {
      console.log('[AgentBFormatAdapter] 🔴 推断：reason 明确提到 Agent T');
      return 'agent T';
    }
    
    // 🔴🔴🔴 新增：检查公众号格式化相关关键词
    // insurance-d 提示词明确说"专注于内容创作，不负责格式转换"
    // 因此包含"公众号"、"格式化"、"format"、"wechat"等词时，应切换到 Agent T
    const wechatFormatKeywords = ['公众号', 'wechat', 'format', '格式化', 'html', '排版', '发布格式'];
    const hasWechatFormatKeyword = wechatFormatKeywords.some(keyword => lowerReason.includes(keyword));
    
    if (hasWechatFormatKeyword) {
      console.log('[AgentBFormatAdapter] 🔴 推断：reason 包含公众号/格式化关键词，建议使用 Agent T');
      return 'agent T';
    }
    
    // 检查 structuredResult 中是否有 capabilityType 字段
    if (executor.structuredResult?.capabilityType) {
      const capabilityType = executor.structuredResult.capabilityType.toLowerCase();
      console.log('[AgentBFormatAdapter] 🔴 structuredResult.capabilityType:', capabilityType);
      
      // 根据 capabilityType 判断
      if (capabilityType.includes('compliance') || capabilityType.includes('audit') || 
          capabilityType.includes('审核') || capabilityType.includes('wechat') || 
          capabilityType.includes('format')) {
        return 'agent T';
      }
    }
    
    // 无法推断，让 Agent B 决定
    console.log('[AgentBFormatAdapter] 🔴 无法推断执行者，让 Agent B 决定');
    return undefined;
  }

  /**
   * Agent T 扁平格式 → 统一格式（向后兼容）
   */
  private static convertAgentTToUnified(agentT: any): AgentBUnifiedFormat {
    console.log('[AgentBFormatAdapter] Agent T 扁平格式 → 统一格式（向后兼容）');
    
    const unified: AgentBUnifiedFormat = {
      decisionType: agentT.action || 'EXECUTE_MCP',
      reasoning: agentT.reasoning,
    };
    
    // MCP 参数（从 Agent T 扁平格式转换）
    if (agentT.solutionNum !== undefined && agentT.toolName && agentT.actionName) {
      unified.mcpParams = {
        solutionNum: agentT.solutionNum,
        toolName: agentT.toolName,
        actionName: agentT.actionName,
        params: agentT.params || {},
      };
      console.log('[AgentBFormatAdapter] 从 Agent T 扁平格式提取到 MCP 参数:', unified.mcpParams);
    }
    
    console.log('[AgentBFormatAdapter] Agent T 扁平格式转换完成:', unified);
    return unified;
  }

  /**
   * 旧格式 → 统一格式
   */
  private static convertOldToUnified(old: AgentBOldFormat): AgentBUnifiedFormat {
    console.log('[AgentBFormatAdapter] 旧格式 → 统一格式');
    
    // 🔴🔴🔴 兜底逻辑：即使 Agent B 没有返回这些字段，也能从其他字段中推断出来
    // 1. 推断 decisionBasis：从 reasoning 中推断
    let inferredDecisionBasis = old.decisionBasis;
    if (!inferredDecisionBasis && old.reasoning) {
      inferredDecisionBasis = `1. 参考信息：执行Agent反馈；\n2. 应用规则：根据执行Agent反馈进行决策；\n3. 为什么选择这个决策：${old.reasoning.substring(0, 200)}；\n4. 判断过程：检查执行Agent反馈 → 应用决策规则 → 做出决策`;
      console.log('[AgentBFormatAdapter] 🔴 兜底：从 reasoning 推断 decisionBasis');
    }
    
    // 2. 推断 notCompletedReason：从 decision type 中推断
    let inferredNotCompletedReason = old.notCompletedReason;
    if (!inferredNotCompletedReason) {
      const notCompletedReasonMap: Record<string, string> = {
        'EXECUTE_MCP': 'mcp_result_pending',
        'NEED_USER': 'awaiting_user_confirmation',
        'FAILED': 'mcp_failed_need_retry',
        'REEXECUTE_EXECUTOR': 'insufficient_result',
        'COMPLETE': 'none'
      };
      inferredNotCompletedReason = notCompletedReasonMap[old.type] || 'insufficient_result';
      console.log('[AgentBFormatAdapter] 🔴 兜底：从 decision type 推断 notCompletedReason:', inferredNotCompletedReason);
    }
    
    // 3. 推断 suggestedExecutor：从 reasoning 中推断
    let inferredSuggestedExecutor = old.context?.suggestedExecutor;
    if (!inferredSuggestedExecutor && old.reasoning) {
      const lowerReasoning = old.reasoning.toLowerCase();
      if (lowerReasoning.includes('合规') || lowerReasoning.includes('审核') || lowerReasoning.includes('agent t')) {
        inferredSuggestedExecutor = 'agent T';
        console.log('[AgentBFormatAdapter] 🔴 兜底：从 reasoning 推断 suggestedExecutor: agent T');
      }
    }
    
    // 🔴 初始化 context 对象（必须放在 unified 构建之前！）
    const unifiedContext: AgentBUnifiedFormat['context'] = {};
    
    const unified: AgentBUnifiedFormat = {
      decisionType: old.type,
      reasoning: old.reasoning,
      // 🔴 新增：提取 decisionBasis（判断依据）- 带兜底逻辑
      decisionBasis: inferredDecisionBasis,
      // 🔴 新增：提取 notCompletedReason（为什么不是 COMPLETE）- 带兜底逻辑
      notCompletedReason: inferredNotCompletedReason,
      // 🔴🔴🔴 【新增】提取 reviewConclusion（评审结论）
      reviewConclusion: old.reviewConclusion,
      // 🔴 初始化 context（用于后续添加 suggestedExecutor）
      context: unifiedContext,
    };
    
    // MCP 参数
    if (old.data?.mcpParams) {
      unified.mcpParams = old.data.mcpParams;
      console.log('[AgentBFormatAdapter] 提取到 MCP 参数:', unified.mcpParams);
    }
    
    // 完成结果
    if (old.data?.completionResult) {
      unified.completionResult = old.data.completionResult;
      console.log('[AgentBFormatAdapter] 提取到完成结果');
    }
    
    // 用户提示
    if (old.data?.promptMessage) {
      unified.userPrompt = typeof old.data.promptMessage === 'string'
        ? { title: '需要用户介入', description: old.data.promptMessage }
        : old.data.promptMessage;
      console.log('[AgentBFormatAdapter] 提取到用户提示:', unified.userPrompt);
    }
    
    // 🔴 新增：提取 context.suggestedExecutor（建议的执行者）- 带兜底逻辑
    if (inferredSuggestedExecutor) {
      unifiedContext.suggestedExecutor = inferredSuggestedExecutor;
      console.log('[AgentBFormatAdapter] 🔴 提取到 suggestedExecutor:', inferredSuggestedExecutor);
    }
    
    console.log('[AgentBFormatAdapter] 旧格式转换完成:', unified);
    return unified;
  }

  /**
   * 新格式 → 统一格式
   */
  private static convertNewToUnified(nw: AgentBNewFormat): AgentBUnifiedFormat {
    console.log('[AgentBFormatAdapter] 新格式 → 统一格式');
    
    // 状态映射
    const decisionTypeMap: Record<string, AgentBUnifiedFormat['decisionType']> = {
      'completed': 'COMPLETE',
      'partial': 'EXECUTE_MCP',
      'failed': 'FAILED',
      'in_progress': 'EXECUTE_MCP',
    };
    
    const decisionType = decisionTypeMap[nw.status] || 'NEED_USER';
    
    const unified: AgentBUnifiedFormat = {
      decisionType: decisionType,
      reasoning: nw.message,
      completionResult: nw.result,
      confidence: nw.confidence,
      evidence: nw.evidence,
      metadata: nw.metadata,
    };
    
    // 尝试从 result 中提取 MCP 参数
    if (nw.result && typeof nw.result === 'object') {
      if ('mcpParams' in nw.result) {
        unified.mcpParams = nw.result.mcpParams;
        console.log('[AgentBFormatAdapter] 从 result 中提取到 MCP 参数:', unified.mcpParams);
      }
      if ('promptMessage' in nw.result) {
        unified.userPrompt = typeof nw.result.promptMessage === 'string'
          ? { title: '需要用户介入', description: nw.result.promptMessage }
          : nw.result.promptMessage;
        console.log('[AgentBFormatAdapter] 从 result 中提取到用户提示:', unified.userPrompt);
      }
    }
    
    console.log('[AgentBFormatAdapter] 新格式转换完成:', unified);
    return unified;
  }

  /**
   * 从未知格式中尝试提取信息
   */
  private static tryExtractFromUnknown(response: any): AgentBUnifiedFormat {
    console.warn('[AgentBFormatAdapter] 未知格式，尝试智能提取:', response);
    
    const unified: AgentBUnifiedFormat = {
      decisionType: 'NEED_USER',
      reasoning: '无法识别的响应格式，需要人工介入',
    };
    
    // 尝试提取常见字段
    if (response && typeof response === 'object') {
      // 决策类型
      if (response.decision || response.type || response.status) {
        const decisionVal = response.decision || response.type || response.status;
        const decisionMap: Record<string, AgentBUnifiedFormat['decisionType']> = {
          'call_mcp': 'EXECUTE_MCP',
          'execute_mcp': 'EXECUTE_MCP',
          'complete': 'COMPLETE',
          'completed': 'COMPLETE',
          'need_user': 'NEED_USER',
          'failed': 'FAILED',
          'in_progress': 'EXECUTE_MCP',
          'partial': 'EXECUTE_MCP',
        };
        unified.decisionType = decisionMap[String(decisionVal).toLowerCase()] || 'NEED_USER';
      }
      
      // 推理/理由
      if (response.reasoning || response.reason || response.message) {
        unified.reasoning = response.reasoning || response.reason || response.message;
      }
      
      // 结果
      if (response.result || response.data) {
        unified.completionResult = response.result || response.data;
      }
      
      // MCP 参数
      if (response.mcpParams || response.mcp_to_call) {
        unified.mcpParams = response.mcpParams || response.mcp_to_call;
      }
      
      // 用户提示
      if (response.promptMessage || response.guidance) {
        unified.userPrompt = typeof (response.promptMessage || response.guidance) === 'string'
          ? { title: '需要用户介入', description: String(response.promptMessage || response.guidance) }
          : (response.promptMessage || response.guidance);
      }
    }
    
    console.log('[AgentBFormatAdapter] 智能提取完成:', unified);
    return unified;
  }

  /**
   * 统一格式 → 旧格式（向后兼容）
   */
  static convertUnifiedToOld(unified: AgentBUnifiedFormat): AgentBOldFormat {
    console.log('[AgentBFormatAdapter] 统一格式 → 旧格式（向后兼容）');
    
    // 🔴 构建 context，REEXECUTE_EXECUTOR 和 EXECUTE_MCP 场景下需要包含 suggestedExecutor
    // 🔴 reasoning 可能为空，使用空字符串兜底
    const safeReasoning = unified.reasoning || '';
    const context: AgentBOldFormat['context'] = {
      executionSummary: safeReasoning.substring(0, 200),
      riskLevel: 'medium',
      suggestedAction: '继续处理'
    };
    
    // 🔴 REEXECUTE_EXECUTOR 或 EXECUTE_MCP 场景：添加 suggestedExecutor
    if ((unified.decisionType === 'REEXECUTE_EXECUTOR' || unified.decisionType === 'EXECUTE_MCP') && unified.context?.suggestedExecutor) {
      context.suggestedExecutor = unified.context.suggestedExecutor;
      console.log('[AgentBFormatAdapter] 🔴 检测到', unified.decisionType, '，添加 suggestedExecutor:', unified.context.suggestedExecutor);
    }
    
    const old: AgentBOldFormat = {
      type: unified.decisionType,
      reasonCode: 'FORMAT_ADAPTER',
      reasoning: unified.reasoning,
      // 🔴 新增：decisionBasis 字段（判断依据）
      decisionBasis: unified.decisionBasis,
      // 🔴 新增：notCompletedReason 字段（为什么不是 COMPLETE）
      notCompletedReason: unified.notCompletedReason,
      // 🔴🔴🔴 【新增】reviewConclusion 字段（评审结论）
      reviewConclusion: unified.reviewConclusion,
      context: context,
      data: {}
    };
    
    // MCP 参数
    if (unified.mcpParams) {
      old.data.mcpParams = unified.mcpParams;
    }
    
    // 完成结果
    if (unified.completionResult) {
      old.data.completionResult = unified.completionResult;
    }
    
    // 用户提示
    if (unified.userPrompt) {
      old.data.promptMessage = unified.userPrompt;
    }
    
    // 🔴 REEXECUTE_EXECUTOR 场景：添加 from_parents_executor
    if (unified.decisionType === 'REEXECUTE_EXECUTOR' && unified.data?.from_parents_executor) {
      old.data.from_parents_executor = unified.data.from_parents_executor;
      console.log('[AgentBFormatAdapter] 🔴 检测到 REEXECUTE_EXECUTOR，添加 from_parents_executor:', unified.data.from_parents_executor);
    }
    
    console.log('[AgentBFormatAdapter] 转换为旧格式完成:', old);
    return old;
  }
}
