/**
 * MCP 参数映射服务
 * 
 * 通用的 LLM 参数映射功能，将上游内容自动映射为 capability_list 中定义的参数格式
 * 
 * 功能：
 * - 读取 capability_list 中的 paramDesc（参数说明）
 * - 理解上游任务内容
 * - 通过 LLM 自动生成正确的参数格式
 * - 零硬编码，完全基于数据库配置
 * 
 * @docs /docs/最新流程交互图.md
 */

import { callLLM } from '@/lib/agent-llm';
import type { CapabilityList } from '@/lib/db/schema';

// === 类型定义 ===

export interface ParameterMappingRequest {
  /**
   * 上游任务内容（文章、任务描述等）
   */
  upstreamContent: string;
  
  /**
   * 从 capability_list 中查询到的能力配置
   */
  capability: CapabilityList;
  
  /**
   * 任务类型（用于上下文理解）
   */
  taskType?: string;
  
  /**
   * 额外的上下文信息
   */
  extraContext?: Record<string, any>;
}

export interface ParameterMappingResult {
  /**
   * 是否成功
   */
  success: boolean;
  
  /**
   * 映射后的参数（直接用于 MCP 调用）
   */
  params?: Record<string, any>;
  
  /**
   * 错误信息（如果失败）
   */
  error?: string;
  
  /**
   * LLM 的推理过程（用于调试）
   */
  reasoning?: string;
}

/**
 * MCP 参数映射服务
 * 
 * 核心功能：
 * 1. 查表：从 capability_list 获取能力配置
 * 2. 理解：LLM 理解能力要求和上游内容
 * 3. 映射：自动生成正确的参数格式
 */
export class McpParameterMapper {
  constructor() {}

  /**
   * 核心方法：执行参数映射
   * 
   * @param request 映射请求
   * @returns 映射结果
   */
  async mapParameters(request: ParameterMappingRequest): Promise<ParameterMappingResult> {
    const { upstreamContent, capability, taskType, extraContext } = request;

    console.log('[McpParameterMapper] ========== 开始参数映射 ==========');
    console.log('[McpParameterMapper] 能力信息:', {
      toolName: capability.toolName,
      actionName: capability.actionName,
      capabilityType: capability.capabilityType,
      hasParamDesc: !!capability.paramDesc,
      hasParamExamples: !!capability.paramExamples,
      hasExampleOutput: !!capability.exampleOutput,
    });

    try {
      // 1. 校验必要字段
      if (!capability.toolName || !capability.actionName) {
        return {
          success: false,
          error: 'capability 缺少必要字段：toolName 或 actionName',
        };
      }

      // 2. 构建提示词
      const prompt = this.buildUserMappingPrompt(
        upstreamContent,
        capability,
        taskType,
        extraContext
      );

      console.log('[McpParameterMapper] 提示词构建完成，长度:', prompt.length, '字符');

      // 3. 调用 LLM 进行参数映射
      const llmStart = Date.now();
      const llmResponse = await callLLM(
        'mcp-parameter-mapper',
        `参数映射: ${capability.toolName}.${capability.actionName}`,
        this.getSystemPrompt(),
        prompt,
        { temperature: 0.3 } // 低温度，确保输出稳定
      );
      const llmEnd = Date.now();

      console.log('[McpParameterMapper] LLM 调用完成，耗时:', llmEnd - llmStart, 'ms');
      console.log('[McpParameterMapper] LLM 响应预览:', 
        llmResponse ? llmResponse.substring(0, 200) + '...' : '空');

      // 4. 解析 LLM 响应
      const result = this.parseLLMResponse(llmResponse, capability);

      if (result.success) {
        console.log('[McpParameterMapper] ✅ 参数映射成功');
        console.log('[McpParameterMapper] 生成的参数:', JSON.stringify(result.params, null, 2));
      } else {
        console.warn('[McpParameterMapper] ❌ 参数映射失败:', result.error);
      }

      return result;

    } catch (error) {
      console.error('[McpParameterMapper] 参数映射过程发生错误:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 构建系统提示词
   */
  private getSystemPrompt(): string {
    return `
你是一个专业的 MCP（Model Context Protocol）参数映射专家。

你的职责：
1. 仔细阅读 MCP 能力的参数说明
2. 理解上游任务内容
3. 把上游内容映射成正确的参数格式
4. 只输出 JSON，不要其他文字

输出格式要求：
{
  "success": true,
  "params": {
    // 根据能力要求的参数
  },
  "reasoning": "简单说明你的映射思路"
}

如果失败：
{
  "success": false,
  "error": "错误原因"
}

重要规则：
1. 严格按照 paramDesc 中的字段说明生成参数
2. 如果有 paramExamples，参考示例格式
3. 如果有 exampleOutput，理解输出结构
4. 参数值必须从上游内容中提取，不要编造
5. 只输出 JSON，不要任何其他文字说明
`;
  }

  /**
   * 构建用户提示词
   */
  private buildUserMappingPrompt(
    upstreamContent: string,
    capability: CapabilityList,
    taskType?: string,
    extraContext?: Record<string, any>
  ): string {
    let prompt = '';

    // 1. 任务类型说明
    if (taskType) {
      prompt += `【任务类型】
${taskType}

`;
    }

    // 2. 上游内容
    prompt += `【上游任务内容】
${upstreamContent}

`;

    // 3. MCP 能力信息
    prompt += `【MCP 能力信息】
- 工具名称：${capability.toolName}
- 动作名称：${capability.actionName}
- 能力类型：${capability.capabilityType}
- 功能描述：${capability.functionDesc || '无'}

`;

    // 4. 参数说明（核心）
    if (capability.paramDesc) {
      prompt += `【参数说明】
${JSON.stringify(capability.paramDesc, null, 2)}

`;
    } else {
      prompt += `【参数说明】
⚠️  警告：此能力没有提供参数说明，请根据功能描述推断

`;
    }

    // 5. 参数示例（如果有）
    if (capability.paramExamples) {
      prompt += `【参数示例】
${JSON.stringify(capability.paramExamples, null, 2)}

`;
    }

    // 6. 输出样例（如果有）
    if (capability.exampleOutput) {
      prompt += `【输出样例】
${JSON.stringify(capability.exampleOutput, null, 2)}

`;
    }

    // 7. 额外上下文（如果有）
    if (extraContext && Object.keys(extraContext).length > 0) {
      prompt += `【额外上下文】
${JSON.stringify(extraContext, null, 2)}

`;
    }

    // 8. 最终任务
    prompt += `【你的任务】
请根据以上信息，把上游任务内容映射成正确的 MCP 参数格式。

要求：
1. 只输出 JSON，不要其他文字
2. 参数字段必须严格按照【参数说明】中的定义
3. 参数值必须从【上游任务内容】中提取，不要编造
4. 如果有【参数示例】，尽量保持格式一致
5. 🔴 重要：如果【参数说明】中包含 title 字段，必须从【上游任务内容】中提取文章标题作为 title 参数值
   - 如果内容是 markdown 格式，优先提取 # 标题
   - 如果是第一行纯文本（长度<=50字符），可以作为标题
   - 如果确实无法提取标题，使用内容的前50个字符作为标题
`;

    return prompt;
  }

  /**
   * 解析 LLM 响应
   */
  private parseLLMResponse(
    llmResponse: string,
    capability: CapabilityList
  ): ParameterMappingResult {
    if (!llmResponse || llmResponse.trim().length === 0) {
      return {
        success: false,
        error: 'LLM 返回空响应',
      };
    }

    try {
      // 尝试直接解析
      let parsed: any;
      
      // 清理响应（去掉可能的 markdown 代码块标记）
      let cleanedResponse = llmResponse.trim();
      
      // 去掉 ```json 和 ``` 标记
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.substring(7);
      }
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.substring(3);
      }
      if (cleanedResponse.endsWith('```')) {
        cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
      }
      
      cleanedResponse = cleanedResponse.trim();
      
      parsed = JSON.parse(cleanedResponse);

      // 检查是否成功
      if (parsed.success === true || parsed.success === 'true') {
        if (!parsed.params) {
          return {
            success: false,
            error: 'LLM 返回成功但缺少 params 字段',
            reasoning: parsed.reasoning,
          };
        }

        return {
          success: true,
          params: parsed.params,
          reasoning: parsed.reasoning,
        };
      } else {
        return {
          success: false,
          error: parsed.error || 'LLM 返回失败但未说明原因',
          reasoning: parsed.reasoning,
        };
      }

    } catch (parseError) {
      console.warn('[McpParameterMapper] LLM 响应解析失败，尝试降级处理:', parseError);
      console.warn('[McpParameterMapper] 原始响应:', llmResponse);

      // 降级方案：尝试从响应中提取 JSON
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.params) {
            return {
              success: true,
              params: parsed.params,
              reasoning: '通过降级解析方式提取到参数',
            };
          }
        } catch (e) {
          // 继续失败
        }
      }

      return {
        success: false,
        error: `无法解析 LLM 响应：${parseError instanceof Error ? parseError.message : String(parseError)}`,
      };
    }
  }

  /**
   * 便捷方法：根据专用任务类型快速选择能力并映射参数
   * 
   * @param upstreamContent 上游内容
   * @param dedicatedTaskType 专用任务类型
   * @param capabilities 可用能力列表
   * @returns 映射结果
   */
  async mapByDedicatedTaskType(
    upstreamContent: string,
    dedicatedTaskType: string,
    capabilities: CapabilityList[]
  ): Promise<ParameterMappingResult & { capability?: CapabilityList }> {
    console.log('[McpParameterMapper] 按专用任务类型选择能力:', dedicatedTaskType);

    // 1. 筛选专用能力
    const dedicatedCapabilities = capabilities
      .filter(c => c.dedicatedTaskType === dedicatedTaskType && c.status === 'available')
      .sort((a, b) => (a.dedicatedTaskPriority || 999) - (b.dedicatedTaskPriority || 999));

    if (dedicatedCapabilities.length === 0) {
      return {
        success: false,
        error: `找不到专用任务类型为 "${dedicatedTaskType}" 的可用能力`,
      };
    }

    // 2. 优先选择 isPrimaryForTask = true 的能力
    let selectedCapability = dedicatedCapabilities.find(c => c.isPrimaryForTask);
    
    // 如果没有首选，选优先级最高的
    if (!selectedCapability) {
      selectedCapability = dedicatedCapabilities[0];
    }

    console.log('[McpParameterMapper] 选定能力:', {
      toolName: selectedCapability.toolName,
      actionName: selectedCapability.actionName,
      isPrimary: selectedCapability.isPrimaryForTask,
      priority: selectedCapability.dedicatedTaskPriority,
    });

    // 3. 执行参数映射
    const mappingResult = await this.mapParameters({
      upstreamContent,
      capability: selectedCapability,
      taskType: dedicatedTaskType,
    });

    return {
      ...mappingResult,
      capability: selectedCapability,
    };
  }
}

// 导出单例
let mapperInstance: McpParameterMapper | null = null;

export function getMcpParameterMapper(): McpParameterMapper {
  if (!mapperInstance) {
    mapperInstance = new McpParameterMapper();
  }
  return mapperInstance;
}
