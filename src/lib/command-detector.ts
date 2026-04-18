import { Command, AgentType } from '../types/command';
import { parseAllTimes } from './utils/time-parser';
import {
  COMMAND_FORMATS,
  detectExecutors,
  extractExecutorContent,
  parseExecutorId,
} from './command-formats';

/**
 * 指令检测器
 * 从 Agent A 生成的总指令中识别出各个 Agent 的专属指令
 * 
 * 使用指令格式配置（command-formats.ts），易于扩展和维护
 */

/**
 * 检测到的指令（用于指令确认对话框）
 */
export interface DetectedCommand {
  id: string;
  targetAgentId: string;
  targetAgentName: string;
  commandContent: string;
  commandType: 'instruction' | 'task' | 'report' | 'urgent';
  priority: 'high' | 'normal' | 'low';
}

/**
 * 指令检测结果
 */
export interface CommandDetectionResult {
  hasCommands: boolean;
  commands: DetectedCommand[];
}

/**
 * 从 Command 转换为 DetectedCommand
 */
function convertToDetectedCommand(command: Command): DetectedCommand {
  // 从内容中提取核心目标
  const coreGoalMatch = command.content.match(/核心目标[:：]\s*(.+?)(?:\n|$)/);
  const coreGoal = coreGoalMatch ? coreGoalMatch[1].trim() : command.content.substring(0, 100);

  // 根据内容判断指令类型和优先级
  let commandType: DetectedCommand['commandType'] = 'instruction';
  let priority: DetectedCommand['priority'] = 'normal';

  const content = command.content.toLowerCase();

  // 判断指令类型
  if (content.includes('紧急') || content.includes('urgency') || content.includes('priority')) {
    commandType = 'urgent';
  } else if (content.includes('任务') || content.includes('执行') || content.includes('完成')) {
    commandType = 'task';
  } else if (content.includes('报告') || content.includes('反馈') || content.includes('总结')) {
    commandType = 'report';
  }

  // 判断优先级
  if (content.includes('高优先级') || content.includes('紧急') || content.includes('立即') || content.includes('asap')) {
    priority = 'high';
  } else if (content.includes('低优先级') || content.includes('不急') || content.includes('暂缓')) {
    priority = 'low';
  }

  const detectedCommand = {
    id: command.id,
    targetAgentId: command.agentId,
    targetAgentName: command.agentName,
    commandContent: coreGoal,
    commandType,
    priority,
  };

  console.log(`[CommandDetector] 转换为 DetectedCommand:`, {
    targetAgentId: detectedCommand.targetAgentId,
    targetAgentName: detectedCommand.targetAgentName,
  });

  return detectedCommand;
}

// Agent 定义和对应的名称
const AGENT_DEFINITIONS = [
  {
    id: 'C' as AgentType,
    name: 'AI运营Agent（内容运营）',
  },
  {
    id: 'D' as AgentType,
    name: 'AI内容生成Agent',
  },
  {
    id: 'insurance-c' as AgentType,
    name: '保险事业部运营总监 (Agent C)',
  },
  {
    id: 'insurance-d' as AgentType,
    name: '保险事业部内容负责人',
  },
  {
    id: 'B' as AgentType,
    name: '架构师B（技术支撑）',
  },
];

/**
 * 清理指令内容，移除多余的标题和标记
 * @param content 原始指令内容
 * @returns 清理后的指令内容
 */
function cleanCommandContent(content: string): string {
  const lines = content.split('\n');
  const cleanedLines: string[] = [];

  // 移除执行主体行（如果有）
  const executorPattern = /执行主体[\s:：]*[为]?[\s]*[「\["]*[^\]\"\)」]+[\"\]」]*/;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 跳过空行
    if (trimmedLine === '') {
      continue;
    }
    
    // 跳过执行主体行
    if (executorPattern.test(trimmedLine)) {
      continue;
    }
    
    cleanedLines.push(line);
  }

  return cleanedLines.join('\n').trim();
}

/**
 * 从 Agent A 的指令中提取所有 Agent 的专属指令
 * @param agentACommands Agent A 生成的总指令
 * @returns 检测结果
 */
export function detectCommands(agentACommands: string): CommandDetectionResult {
  const commands: Command[] = [];

  console.log('[CommandDetector] 开始检测指令，原始内容长度:', agentACommands.length);
  console.log('[CommandDetector] 原始内容（前500字符）:', agentACommands.substring(0, 500));

  // 步骤1：检测所有执行主体
  console.log('[CommandDetector] 步骤1：检测所有执行主体...');
  const executors = detectExecutors(agentACommands);
  
  console.log(`[CommandDetector] 检测到 ${executors.length} 个执行主体:`);
  executors.forEach((executor, idx) => {
    console.log(`  ${idx + 1}. ID: ${executor.id}, 文本: "${executor.text}", 位置: ${executor.index}`);
  });

  // 步骤2：如果没有检测到执行主体，返回空结果
  if (executors.length === 0) {
    console.log('[CommandDetector] 未检测到任何执行主体，返回空结果');
    return {
      hasCommands: false,
      commands: [],
    };
  }

  // 步骤3：为每个执行主体提取指令内容
  console.log('[CommandDetector] 步骤3：提取每个执行主体的指令内容...');
  
  for (let i = 0; i < executors.length; i++) {
    const executor = executors[i];
    const nextExecutor = executors[i + 1];
    
    console.log(`[CommandDetector] 处理执行主体 ${i + 1}/${executors.length}: ${executor.id} ("${executor.text}")`);
    
    // 提取内容块
    const contentBlock = extractExecutorContent(agentACommands, executor, nextExecutor);
    console.log(`[CommandDetector]   - 内容块长度: ${contentBlock.length}`);
    console.log(`[CommandDetector]   - 内容块前150字符: ${contentBlock.substring(0, 150).replace(/\n/g, ' ')}`);
    
    // 清理内容
    const cleanedContent = cleanCommandContent(contentBlock);
    console.log(`[CommandDetector]   - 清理后长度: ${cleanedContent.length}`);
    
    // 解析时间表达式
    const parsedContent = parseAllTimes(cleanedContent);
    if (parsedContent !== cleanedContent) {
      console.log(`[CommandDetector]   - 时间解析: "${cleanedContent.substring(0, 50)}..." → "${parsedContent.substring(0, 50)}..."`);
    }
    
    if (parsedContent.length > 0) {
      // 查找对应的 Agent 定义
      const agentDef = AGENT_DEFINITIONS.find(def => def.id === executor.id);
      
      if (agentDef) {
        const command: Command = {
          id: crypto.randomUUID(),
          agentId: agentDef.id,
          agentName: agentDef.name,
          content: parsedContent,
          createdAt: new Date(),
          status: 'pending',
        };
        commands.push(command);
        console.log(`[CommandDetector]   - ✅ 成功添加指令: ${agentDef.name}`);
      } else {
        console.log(`[CommandDetector]   - ⚠️ 未找到 Agent ${executor.id} 的定义，跳过`);
      }
    } else {
      console.log(`[CommandDetector]   - ⚠️ 内容为空，跳过`);
    }
  }

  console.log(`[CommandDetector] 检测完成，共找到 ${commands.length} 条指令`);

  // 转换为 DetectedCommand
  const detectedCommands = commands.map(convertToDetectedCommand);

  return {
    hasCommands: detectedCommands.length > 0,
    commands: detectedCommands,
  };
}

/**
 * 格式化指令内容
 * @param command 检测到的指令
 * @param fromAgentId 发送方 Agent ID
 * @returns 格式化后的指令内容
 */
export function formatCommandForAgent(command: DetectedCommand, fromAgentId: string): string {
  const priorityLabels = {
    high: '🔴 高优先级',
    normal: '🟡 普通优先级',
    low: '🟢 低优先级',
  };

  const typeLabels = {
    instruction: '📋 执行指令',
    task: '✅ 任务',
    report: '📊 报告',
    urgent: '🚨 紧急指令',
  };

  return `${typeLabels[command.commandType]}
${priorityLabels[command.priority]}

**接收方：**${command.targetAgentName}
**发送方：**Agent ${fromAgentId}

---
${command.commandContent}`;
}

/**
 * 发送指令到指定 Agent
 * @param toAgentId 接收方 Agent ID
 * @param command 指令内容
 * @param commandType 指令类型
 * @param priority 优先级
 * @param fromAgentId 发送方 Agent ID
 * @param taskId 可选的任务 ID（用于关联任务）
 * @returns 发送结果
 */
export async function sendCommandToAgent(
  toAgentId: string,
  command: string,
  commandType: 'instruction' | 'task' | 'report' | 'urgent' = 'instruction',
  priority: 'high' | 'normal' | 'low' = 'normal',
  fromAgentId: string = 'A',
  taskId?: string // 🔥 添加可选的 taskId 参数
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[sendCommandToAgent] 准备发送指令: ${fromAgentId} -> ${toAgentId}`);
    console.log(`[sendCommandToAgent] commandType: ${commandType}, priority: ${priority}`);
    console.log(`[sendCommandToAgent] command 长度: ${command.length}`);
    console.log(`[sendCommandToAgent] taskId: ${taskId || 'N/A'}`);

    // 判断是否在服务器端，如果是则使用完整的 URL
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer ? 'http://localhost:5000' : '';

    const response = await fetch(`${baseUrl}/api/agents/send-command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromAgentId,
        toAgentId,
        command,
        commandType,
        priority,
        taskId, // 🔥 传递 taskId
        metadata: {
          timestamp: new Date().toISOString(),
          ...(taskId && { taskId }), // 🔥 如果有 taskId，也包含在 metadata 中
        },
      }),
    });

    // 🔥 先检查响应状态
    if (!response.ok) {
      console.error(`[sendCommandToAgent] HTTP 请求失败: ${response.status} ${response.statusText}`);
      let errorText = '';
      try {
        errorText = await response.text();
        console.error(`[sendCommandToAgent] 响应内容:`, errorText);
      } catch (e) {
        console.error(`[sendCommandToAgent] 无法读取响应内容`);
      }
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // 🔥 尝试解析 JSON
    let result: any;
    try {
      const responseText = await response.text();
      console.log(`[sendCommandToAgent] 原始响应:`, responseText);
      result = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error(`[sendCommandToAgent] JSON 解析失败:`, e);
      return {
        success: false,
        error: '响应解析失败',
      };
    }

    // 🔥 检查 result 是否有值
    if (!result || typeof result !== 'object') {
      console.error(`[sendCommandToAgent] 响应格式错误:`, result);
      return {
        success: false,
        error: '响应格式错误',
      };
    }

    if (!result.success) {
      console.error(`[sendCommandToAgent] 发送失败:`, result);
      return {
        success: false,
        error: result.error || '发送指令失败',
      };
    }

    console.log(`[sendCommandToAgent] 发送成功:`, result);
    return {
      success: true,
    };
  } catch (error) {
    console.error(`[sendCommandToAgent] 发送异常:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}
