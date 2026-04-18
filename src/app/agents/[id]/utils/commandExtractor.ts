/**
 * 指令提取工具函数
 * 从用户输入的文本中提取格式化的指令内容
 */

export interface CommandSection {
  id: string;
  targetAgentId: string;
  targetAgentName: string;
  commandContent: string;
  commandType: 'instruction';
  priority: 'normal';
}

/**
 * 提取完整的指令内容
 * 支持多种格式：
 * - #### 1. 【技术类】向架构师B（技术支撑）下达的执行指令
 * - ### （一）致 AI 事业部 Agent C
 * - ## 致 Agent B
 * - ## 【AI事业部内容岗指令 - Agent D】
 * - #### 执行主体：insurance-c（运营类）
 */
export function extractCommandSections(content: string): CommandSection[] {
  const commands: CommandSection[] = [];

  // 模式1：#### 1. 【技术类】向架构师B（技术支撑）下达的执行指令
  const quadrupleHashPattern = /####\s*(\d+|[\u4e00-\u9fa5]+)[\）、.]\s*【([^\]]+】)?\s*向([^#\n]+)/g;
  let match;
  let lastEndPos = 0;

  const quadrupleMatches: Array<{
    index: number;
    length: number;
    fullMatch: string;
    agentId: string;
    agentName: string;
  }> = [];

  while ((match = quadrupleHashPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const agentInfo = match[3].trim();

    let agentId = 'unknown';
    let agentName = agentInfo;

    if (agentInfo.includes('Agent')) {
      const agentMatch = agentInfo.match(/Agent\s*([A-Za-z0-9-]+)/i);
      if (agentMatch) {
        agentId = agentMatch[1];
        const agentNameMatch = agentInfo.match(/([^（]+)\([^)]*\)/);
        agentName = agentNameMatch ? agentNameMatch[1].trim() : agentInfo.replace(/Agent\s+[A-Za-z0-9-]+.*/i, '').trim();
      }
    } else if (agentInfo.includes('架构师B')) {
      agentId = 'B';
      agentName = '架构师B（技术支撑）';
    } else if (agentInfo.includes('Agent B')) {
      agentId = 'B';
      agentName = '架构师B（技术支撑）';
    }

    console.log(`🔍 提取指令（四级标题）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}"`);

    quadrupleMatches.push({
      index: match.index,
      length: fullMatch.length,
      fullMatch: fullMatch,
      agentId: agentId,
      agentName: agentName,
    });
  }

  for (let i = 0; i < quadrupleMatches.length; i++) {
    const currentMatch = quadrupleMatches[i];
    const nextMatch = quadrupleMatches[i + 1];

    const contentStart = currentMatch.index + currentMatch.length;
    const contentEnd = nextMatch ? nextMatch.index : content.length;

    const commandContent = content.substring(contentStart, contentEnd).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: currentMatch.agentId,
        targetAgentName: currentMatch.agentName,
        commandContent: currentMatch.fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  // 模式2：### （一）致 AI 事业部 Agent C
  const tripleHashPattern = /###\s*[(（]?([\d一二三四五六七八九十]+)[)）\、.\s]*\s*致\s+([^\n]+)/g;

  const tripleMatches: Array<{
    index: number;
    length: number;
    fullMatch: string;
    agentId: string;
    agentName: string;
  }> = [];

  while ((match = tripleHashPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const agentInfo = match[2].trim();

    let agentId = 'unknown';
    let agentName = agentInfo;

    if (agentInfo.includes('Agent')) {
      const agentMatch = agentInfo.match(/Agent\s*([A-Za-z0-9-]+)/i);
      if (agentMatch) {
        agentId = agentMatch[1];
        agentName = agentInfo.replace(/Agent\s+[A-Za-z0-9-]+/i, '').trim() || agentInfo;
      }
    } else if (/^[A-Za-z0-9-]+$/.test(agentInfo)) {
      agentId = agentInfo;
      agentName = agentInfo;
    }

    console.log(`🔍 提取指令（三级标题）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}"`);

    tripleMatches.push({
      index: match.index,
      length: fullMatch.length,
      fullMatch: fullMatch,
      agentId: agentId,
      agentName: agentName,
    });
  }

  for (let i = 0; i < tripleMatches.length; i++) {
    const currentMatch = tripleMatches[i];
    const nextMatch = tripleMatches[i + 1];

    const contentStart = currentMatch.index + currentMatch.length;
    const contentEnd = nextMatch ? nextMatch.index : content.length;

    const commandContent = content.substring(contentStart, contentEnd).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: currentMatch.agentId,
        targetAgentName: currentMatch.agentName,
        commandContent: currentMatch.fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  // 模式3：## 致 Agent B
  const doubleHashPattern = /##\s*致\s+([^\n]+)/g;
  const doubleHashMatches: Array<{
    index: number;
    length: number;
    fullMatch: string;
    agentId: string;
    agentName: string;
  }> = [];

  while ((match = doubleHashPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const agentInfo = match[1].trim();

    let agentId = 'unknown';
    let agentName = agentInfo;

    if (agentInfo.includes('Agent')) {
      const agentMatch = agentInfo.match(/Agent\s*([A-Za-z0-9-]+)/i);
      if (agentMatch) {
        agentId = agentMatch[1];
        agentName = agentInfo.replace(/Agent\s+[A-Za-z0-9-]+/i, '').trim() || agentInfo;
      }
    } else if (/^[A-Za-z0-9-]+$/.test(agentInfo)) {
      agentId = agentInfo;
      agentName = agentInfo;
    }

    console.log(`🔍 提取指令（双井号）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}"`);

    doubleHashMatches.push({
      index: match.index,
      length: fullMatch.length,
      fullMatch: fullMatch,
      agentId: agentId,
      agentName: agentName,
    });
  }

  for (let i = 0; i < doubleHashMatches.length; i++) {
    const currentMatch = doubleHashMatches[i];
    const nextMatch = doubleHashMatches[i + 1];

    const contentStart = currentMatch.index + currentMatch.length;
    const contentEnd = nextMatch ? nextMatch.index : content.length;

    const commandContent = content.substring(contentStart, contentEnd).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: currentMatch.agentId,
        targetAgentName: currentMatch.agentName,
        commandContent: currentMatch.fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  // 模式4：## 【AI事业部内容岗指令 - Agent D】
  const bracketedHashPattern = /(?:###|##)\s*【([^】]+?)\s*-\s*Agent\s*([A-Za-z0-9-]+)】/g;

  while ((match = bracketedHashPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const instructionType = match[1].trim();
    const agentId = match[2].trim();

    let agentName = `Agent ${agentId}`;
    if (instructionType.includes('AI事业部')) {
      agentName = `AI事业部 Agent ${agentId}`;
    } else if (instructionType.includes('保险事业部')) {
      agentName = `保险事业部 Agent ${agentId}`;
    } else if (instructionType.includes('技术')) {
      agentName = `架构师${agentId}（技术支撑）`;
    } else if (agentId === 'B') {
      agentName = `架构师${agentId}（技术支撑）`;
    }

    console.log(`🔍 提取指令（方括号格式）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}"`);

    const startIndex = content.indexOf(fullMatch);

    const nextMatch = bracketedHashPattern.exec(content);
    let endIndex = content.length;

    if (nextMatch) {
      endIndex = content.indexOf(nextMatch[0]);
      bracketedHashPattern.lastIndex = 0;
      bracketedHashPattern.exec(content);
    }

    const commandContent = content.substring(startIndex + fullMatch.length, endIndex).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: agentId,
        targetAgentName: agentName,
        commandContent: fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  // 模式5：#### 执行主体：insurance-c（运营类）
  const executionBodyPattern = /####\s*执行主体[：:]\s*([^\n（(]+?)[（(]([^）)]+)[）)]/g;

  const executionBodyMatches: Array<{
    index: number;
    length: number;
    fullMatch: string;
    agentId: string;
    agentName: string;
    agentRole: string;
  }> = [];

  while ((match = executionBodyPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const agentInfo = match[1].trim();
    const agentRole = match[2].trim();

    let agentId = 'unknown';
    let agentName = agentInfo;

    if (agentInfo.toLowerCase().startsWith('agent ')) {
      agentId = agentInfo.replace(/^agent\s*/i, '').trim();
      agentName = `Agent ${agentId}`;
    } else {
      agentId = agentInfo;
      agentName = agentInfo;
    }

    console.log(`🔍 提取指令（执行主体格式）: "${fullMatch}" -> agentId="${agentId}", agentName="${agentName}", agentRole="${agentRole}"`);

    executionBodyMatches.push({
      index: match.index,
      length: fullMatch.length,
      fullMatch: fullMatch,
      agentId: agentId,
      agentName: agentName,
      agentRole: agentRole,
    });
  }

  for (let i = 0; i < executionBodyMatches.length; i++) {
    const currentMatch = executionBodyMatches[i];
    const nextMatch = executionBodyMatches[i + 1];

    const contentStart = currentMatch.index + currentMatch.length;
    let contentEnd = content.length;
    if (nextMatch) {
      contentEnd = nextMatch.index;
    }

    const commandContent = content.substring(contentStart, contentEnd).trim();

    if (commandContent) {
      commands.push({
        id: `cmd_${Date.now()}_${commands.length}`,
        targetAgentId: currentMatch.agentId,
        targetAgentName: `${currentMatch.agentName}（${currentMatch.agentRole}）`,
        commandContent: currentMatch.fullMatch + '\n' + commandContent,
        commandType: 'instruction' as const,
        priority: 'normal' as const,
      });
    }
  }

  return commands;
}
