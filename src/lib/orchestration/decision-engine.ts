/**
 * 决策引擎
 * 支持基于规则的决策、基于 AI 的决策和混合决策
 */

import { EventEmitter } from 'events';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import {
  DecisionType,
  DecisionRule,
  DecisionResult,
} from './types';

export class DecisionEngine extends EventEmitter {
  private rules: Map<string, DecisionRule> = new Map();
  private llm: LLMClient;
  private confidenceThreshold: number = 0.7;
  private enableLogging: boolean = true;

  constructor(llm: LLMClient, enableLogging: boolean = true) {
    super();
    this.llm = llm;
    this.enableLogging = enableLogging;
  }

  /**
   * 添加决策规则
   */
  addRule(rule: DecisionRule): void {
    this.rules.set(rule.id, rule);
    this.emit('ruleAdded', rule);
  }

  /**
   * 批量添加决策规则
   */
  addRules(rules: DecisionRule[]): void {
    rules.forEach(rule => this.addRule(rule));
  }

  /**
   * 移除决策规则
   */
  removeRule(ruleId: string): boolean {
    const result = this.rules.delete(ruleId);
    if (result) {
      this.emit('ruleRemoved', ruleId);
    }
    return result;
  }

  /**
   * 获取所有规则
   */
  getRules(): DecisionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取启用的规则
   */
  getEnabledRules(): DecisionRule[] {
    return Array.from(this.rules.values()).filter(r => r.enabled);
  }

  /**
   * 启用/禁用规则
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.emit('ruleToggled', ruleId, enabled);
      return true;
    }
    return false;
  }

  /**
   * 执行基于规则的决策
   */
  async decideByRules(
    data: any,
    ruleSet?: string[] // 可选：指定要使用的规则 ID 集合
  ): Promise<DecisionResult> {
    const startTime = Date.now();

    // 获取要使用的规则
    let rulesToCheck = this.getEnabledRules();
    if (ruleSet) {
      rulesToCheck = rulesToCheck.filter(r => ruleSet.includes(r.id));
    }

    // 按优先级排序
    rulesToCheck.sort((a, b) => a.priority - b.priority);

    // 查找匹配的规则
    const matchedRules: DecisionRule[] = [];

    for (const rule of rulesToCheck) {
      try {
        if (rule.condition(data)) {
          matchedRules.push(rule);

          // 执行规则的动作
          const actionResult = rule.action(data);

          const result: DecisionResult = {
            success: true,
            action: rule.id,
            data: actionResult,
            reasoning: `Matched rule: ${rule.name}`,
            confidence: 1.0, // 规则决策置信度为 1
            matchedRules: [rule.id],
          };

          if (this.enableLogging) {
            this.logDecision(data, result, Date.now() - startTime);
          }

          this.emit('ruleMatched', rule, data, result);
          return result;
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    // 没有匹配的规则
    const noMatchResult: DecisionResult = {
      success: false,
      reasoning: 'No matching rule found',
      confidence: 0,
    };

    if (this.enableLogging) {
      this.logDecision(data, noMatchResult, Date.now() - startTime);
    }

    this.emit('noRuleMatched', data);
    return noMatchResult;
  }

  /**
   * 执行基于 AI 的决策
   */
  async decideByAI(
    prompt: string,
    context?: Record<string, any>
  ): Promise<DecisionResult> {
    const startTime = Date.now();

    try {
      // 构建 LLM 提示词
      const systemPrompt = `你是一个智能决策助手。请根据用户的需求和上下文信息，做出合理的决策。

你的回答格式必须是 JSON，包含以下字段：
- action: 决策动作的名称或 ID
- reasoning: 决策理由（详细说明为什么这样决策）
- confidence: 决策的置信度（0-1 之间的数字）
- data: 决策相关的额外数据（可选）

请确保你的决策是基于事实和逻辑的，置信度要真实反映你的确定性。`;

      const userPrompt = `
${prompt}

${context ? `上下文信息：\n${JSON.stringify(context, null, 2)}` : ''}

请以 JSON 格式返回你的决策。`;

      // 调用 LLM
      const response = await this.llm.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // 较低的温度以获得更确定的决策
      });

      // 解析 LLM 响应
      const content = response.choices[0].message.content;
      let decisionData: any;

      try {
        // 尝试提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          decisionData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in LLM response');
        }
      } catch (error) {
        // 如果解析失败，返回原始响应
        decisionData = {
          action: 'unknown',
          reasoning: content,
          confidence: 0.5,
          data: { rawResponse: content },
        };
      }

      const result: DecisionResult = {
        success: true,
        action: decisionData.action,
        reasoning: decisionData.reasoning || 'AI-based decision',
        confidence: decisionData.confidence || 0.7,
        data: decisionData.data,
      };

      if (this.enableLogging) {
        this.logDecision({ prompt, context }, result, Date.now() - startTime);
      }

      this.emit('aiDecision', result, { prompt, context });
      return result;

    } catch (error) {
      const errorResult: DecisionResult = {
        success: false,
        reasoning: `AI decision failed: ${(error as Error).message}`,
        confidence: 0,
      };

      if (this.enableLogging) {
        this.logDecision({ prompt, context }, errorResult, Date.now() - startTime);
      }

      this.emit('aiDecisionError', error);
      return errorResult;
    }
  }

  /**
   * 执行混合决策（规则 + AI）
   */
  async decideHybrid(
    data: any,
    prompt?: string
  ): Promise<DecisionResult> {
    const startTime = Date.now();

    // 先尝试规则决策
    const ruleResult = await this.decideByRules(data);

    // 如果规则决策成功且置信度高，直接返回
    if (ruleResult.success && ruleResult.confidence >= this.confidenceThreshold) {
      this.emit('hybridDecision', ruleResult, 'rule');
      return ruleResult;
    }

    // 规则决策失败或置信度低，使用 AI 决策
    if (prompt) {
      const aiResult = await this.decideByAI(prompt, data);

      if (aiResult.success) {
        const hybridResult: DecisionResult = {
          ...aiResult,
          reasoning: `Hybrid decision: ${ruleResult.reasoning}; ${aiResult.reasoning}`,
          matchedRules: ruleResult.matchedRules,
        };

        if (this.enableLogging) {
          this.logDecision(data, hybridResult, Date.now() - startTime);
        }

        this.emit('hybridDecision', hybridResult, 'ai');
        return hybridResult;
      }
    }

    // 两者都失败
    const failureResult: DecisionResult = {
      success: false,
      reasoning: 'Both rule-based and AI-based decisions failed',
      confidence: 0,
    };

    if (this.enableLogging) {
      this.logDecision(data, failureResult, Date.now() - startTime);
    }

    this.emit('hybridDecisionFailure', data);
    return failureResult;
  }

  /**
   * 执行决策（自动选择决策类型）
   */
  async decide(
    data: any,
    options: {
      type?: DecisionType;
      prompt?: string;
      ruleSet?: string[];
    } = {}
  ): Promise<DecisionResult> {
    const { type = DecisionType.HYBRID, prompt, ruleSet } = options;

    switch (type) {
      case DecisionType.RULE_BASED:
        return this.decideByRules(data, ruleSet);

      case DecisionType.AI_BASED:
        if (!prompt) {
          throw new Error('AI-based decision requires a prompt');
        }
        return this.decideByAI(prompt, data);

      case DecisionType.HYBRID:
        return this.decideHybrid(data, prompt);

      default:
        throw new Error(`Unknown decision type: ${type}`);
    }
  }

  /**
   * 批量决策
   */
  async decideBatch(
    decisions: Array<{
      data: any;
      options?: Parameters<typeof this.decide>[1];
    }>
  ): Promise<DecisionResult[]> {
    const promises = decisions.map(d => this.decide(d.data, d.options));
    return Promise.all(promises);
  }

  /**
   * 记录决策日志
   */
  private logDecision(
    input: any,
    result: DecisionResult,
    duration: number
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      input: JSON.stringify(input).substring(0, 500), // 限制长度
      result,
      duration,
    };

    this.emit('decisionLogged', logEntry);
  }

  /**
   * 设置置信度阈值
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
    this.emit('confidenceThresholdChanged', this.confidenceThreshold);
  }

  /**
   * 启用/禁用日志
   */
  setLoggingEnabled(enabled: boolean): void {
    this.enableLogging = enabled;
    this.emit('loggingToggled', enabled);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalRules: this.rules.size,
      enabledRules: this.getEnabledRules().length,
      confidenceThreshold: this.confidenceThreshold,
      loggingEnabled: this.enableLogging,
    };
  }
}
