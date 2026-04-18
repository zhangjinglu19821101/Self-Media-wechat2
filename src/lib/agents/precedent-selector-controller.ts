/**
 * 前序选择器控制器
 * 负责解析Agent的选择响应，提取子任务和MCP执行结果文本
 */

import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// 前序选择结果接口
export interface PrecedentSelectionResult {
  status: string;
  result: {
    selectedSubtasks: Array<{
      subtaskId: string;
      orderIndex: number;
      reason?: string;
    }>;
    selectedMcpResults: Array<{
      mcpResultId: string;
      reason?: string;
    }>;
  };
  message: string;
  confidence: number;
  timestamp: string;
  agentVersion: string;
}

// 提取的前序信息接口
export interface ExtractedPrecedentInfo {
  subtaskTexts: string[];
  mcpResultTexts: string[];
}

/**
 * 控制器：提取前序信息
 */
export class PrecedentSelectorController {
  /**
   * 解析Agent返回的JSON字符串
   */
  static parseAgentResponse(agentResponse: string): PrecedentSelectionResult {
    try {
      // 尝试提取JSON（处理可能包含额外文字的情况）
      const jsonMatch = agentResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法从响应中提取JSON');
      }
      const result = JSON.parse(jsonMatch[0]) as PrecedentSelectionResult;
      
      // 验证必需字段 - 容错处理
      if (!result.status) {
        result.status = 'completed'; // 默认completed
      }
      if (!result.result) {
        result.result = {
          selectedSubtasks: [],
          selectedMcpResults: []
        };
      }
      if (!Array.isArray(result.result.selectedSubtasks)) {
        result.result.selectedSubtasks = [];
      }
      if (!Array.isArray(result.result.selectedMcpResults)) {
        result.result.selectedMcpResults = [];
      }
      if (!result.message) {
        result.message = '已完成';
      }
      if (!result.confidence) {
        result.confidence = 80;
      }
      if (!result.timestamp) {
        result.timestamp = new Date().toISOString();
      }
      if (!result.agentVersion) {
        result.agentVersion = '1.0.0';
      }
      
      return result;
    } catch (error) {
      throw new Error(`解析Agent响应失败: ${error}`);
    }
  }

  /**
   * 根据选择结果提取子任务执行结果文本
   */
  static async extractSubtaskResults(
    selectedSubtasks: PrecedentSelectionResult['result']['selectedSubtasks']
  ): Promise<string[]> {
    const texts: string[] = [];

    for (const selection of selectedSubtasks) {
      try {
        const subtask = await db.query.agentSubTasks.findFirst({
          where: eq(agentSubTasks.id, selection.subtaskId)
        });

        if (subtask) {
          // 优先级1：如果有 resultText，直接用
          let resultText = subtask.resultText;
          
          // 优先级2：如果没有 resultText 但有 resultData，从 resultData 中提取
          if (!resultText && subtask.resultData) {
            try {
              const parsed = typeof subtask.resultData === 'string' 
                ? JSON.parse(subtask.resultData) 
                : subtask.resultData;
              if (parsed?.result) {
                resultText = String(parsed.result);
              } else if (parsed?.structuredResult?.resultContent) {
                resultText = parsed.structuredResult.resultContent;
              } else {
                resultText = JSON.stringify(parsed, null, 2);
              }
            } catch {
              resultText = String(subtask.resultData);
            }
          }
          
          const text = `
【子任务${subtask.orderIndex}】
标题：${subtask.taskTitle || '无标题'}
描述：${subtask.taskDescription || '无描述'}
状态：${subtask.status}
执行结果：
${resultText || '无执行结果'}
`.trim();
          texts.push(text);
        }
      } catch (error) {
        console.warn(`提取子任务结果失败: ${selection.subtaskId}`, error);
        // 继续处理下一个，不中断整个流程
      }
    }

    return texts;
  }

  /**
   * 根据选择结果提取MCP执行结果文本
   * 注意：这里mcpResultId对应agentSubTasksMcpExecutions表的id（serial类型）
   */
  static async extractMcpResults(
    selectedMcpResults: PrecedentSelectionResult['result']['selectedMcpResults']
  ): Promise<string[]> {
    const texts: string[] = [];

    for (const selection of selectedMcpResults) {
      try {
        // mcpResultId可能是string，需要转换为number
        const mcpId = parseInt(selection.mcpResultId, 10);
        if (isNaN(mcpId)) {
          console.warn(`无效的MCP结果ID: ${selection.mcpResultId}`);
          continue;
        }

        const mcpResult = await db.query.agentSubTasksMcpExecutions.findFirst({
          where: eq(agentSubTasksMcpExecutions.id, mcpId)
        });

        if (mcpResult) {
          // 优先使用resultText（Agent能读懂的文本化格式）
          const resultText = mcpResult.resultText || 
            (mcpResult.resultData ? JSON.stringify(mcpResult.resultData, null, 2) : '无结果数据');

          const text = `
【MCP执行结果 - ${mcpResult.toolName || '未知工具'}】
时间：${mcpResult.attemptTimestamp?.toISOString() || '未知时间'}
工具：${mcpResult.toolName || '未知'}
动作：${mcpResult.actionName || '未知'}
状态：${mcpResult.resultStatus}
输入参数：
${mcpResult.params ? JSON.stringify(mcpResult.params, null, 2) : '无参数'}
输出结果：
${resultText}
`.trim();
          texts.push(text);
        }
      } catch (error) {
        console.warn(`提取MCP结果失败: ${selection.mcpResultId}`, error);
        // 继续处理下一个，不中断整个流程
      }
    }

    return texts;
  }

  /**
   * 完整流程：解析选择 -> 提取信息 -> 返回结构化结果
   */
  static async extractPrecedentInfo(
    agentResponse: string
  ): Promise<ExtractedPrecedentInfo> {
    // 1. 解析Agent响应
    const selectionResult = this.parseAgentResponse(agentResponse);

    // 2. 提取子任务结果
    const subtaskTexts = await this.extractSubtaskResults(
      selectionResult.result.selectedSubtasks
    );

    // 3. 提取MCP结果
    const mcpResultTexts = await this.extractMcpResults(
      selectionResult.result.selectedMcpResults
    );

    return {
      subtaskTexts,
      mcpResultTexts
    };
  }

  /**
   * 拼装执行提示词（可选辅助方法）
   */
  static assembleExecutionPrompt(
    currentTask: string,
    extractedInfo: ExtractedPrecedentInfo
  ): string {
    const parts: string[] = [];

    parts.push(`你需要执行以下任务：\n【当前任务】\n${currentTask}`);

    if (extractedInfo.subtaskTexts.length > 0 || extractedInfo.mcpResultTexts.length > 0) {
      parts.push('\n---\n\n【已选择的前序信息】');
      
      if (extractedInfo.subtaskTexts.length > 0) {
        parts.push('');
        parts.push(...extractedInfo.subtaskTexts);
      }
      
      if (extractedInfo.mcpResultTexts.length > 0) {
        parts.push('');
        parts.push(...extractedInfo.mcpResultTexts);
      }
    }

    // 去掉：现在请执行这个任务。如果需要调用MCP工具，请直接调用。

    return parts.join('\n');
  }
}
