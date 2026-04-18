/**
 * Agent 提示词生成器
 * 根据 Agent 角色配置生成具体的提示词
 */

import type { AgentRoleConfig, StandardResponseConfig, CustomResponseConfig } from './agent-roles-config';

/**
 * 生成 Agent 角色提示词
 * @param config Agent 角色配置
 * @returns 完整的提示词内容
 */
export function generateAgentRolePrompt(config: AgentRoleConfig): string {
  const sections: string[] = [];

  // 1. 角色基础信息
  sections.push(generateRoleHeader(config));

  // 2. 角色描述和任务
  sections.push(generateRoleDescription(config));

  // 3. 返回格式要求
  if (config.responseType === 'standard' && config.standardResponseConfig) {
    sections.push(generateStandardResponseFormat(config.standardResponseConfig, config));
  } else if (config.responseType === 'custom' && config.customResponseConfig) {
    sections.push(generateCustomResponseFormat(config.customResponseConfig));
  }

  // 4. 占位符说明（如果有）
  if (config.responsePlaceholderConfig) {
    sections.push(generatePlaceholderGuide(config));
  }

  // 5. 返回示例
  sections.push(generateResponseExamples(config));

  // 6. 判断标准（如果有）
  if (config.tasks.some(task => task.judgmentCriteria && task.judgmentCriteria.length > 0)) {
    sections.push(generateJudgmentCriteria(config));
  }

  // 7. 输出约束
  sections.push(generateOutputConstraints(config));

  // 8. 额外指令
  if (config.additionalInstructions && config.additionalInstructions.length > 0) {
    sections.push(generateAdditionalInstructions(config));
  }

  return sections.join('\n\n');
}

/**
 * 生成角色头部信息
 */
function generateRoleHeader(config: AgentRoleConfig): string {
  return `# ${config.name} (v${config.version})

**角色ID**: ${config.id}
**版本**: ${config.version}`;
}

/**
 * 生成角色描述
 */
function generateRoleDescription(config: AgentRoleConfig): string {
  const parts: string[] = [];

  parts.push(`## 角色描述

${config.description}`);

  if (config.tasks.length > 0) {
    parts.push(`## 主要任务`);

    config.tasks.forEach((task, index) => {
      parts.push(`### ${index + 1}. ${task.name}

${task.description}

**预期输出**: ${task.responseDescription}`);
    });
  }

  return parts.join('\n\n');
}

/**
 * 生成标准响应格式说明
 */
function generateStandardResponseFormat(
  responseConfig: StandardResponseConfig,
  agentConfig: AgentRoleConfig
): string {
  const parts: string[] = [];

  parts.push(`## 返回格式要求

你必须严格按照以下 JSON 格式返回结果：`);

  if (responseConfig.schemaType === 'simple') {
    parts.push(`\`\`\`json
{
  "status": "completed|partial|failed|in_progress",
  "result": "执行结果的详细描述",
  "message": "简洁的状态消息",
  ${responseConfig.enableConfidence ? `"confidence": 0-100,` : ''}
  ${responseConfig.enableConfidence ? `"confidenceScale": "0-100",` : ''}
  ${responseConfig.enableEvidence ? `"evidence": [
    {
      "type": "data_point|reference|example|calculation",
      "value": "证据内容",
      "source": "证据来源（可选）"
    }
  ],` : ''}
  "metadata": {
    "agentVersion": "${agentConfig.version}",
    "timestamp": "ISO 8601 格式时间戳"
  },
  "timestamp": "ISO 8601 格式时间戳",
  "agentVersion": "${agentConfig.version}"
}
\`\`\``);
  } else {
    parts.push(`\`\`\`json
{
  "status": "completed|partial|failed|in_progress",
  "result": {
    "summary": "总体总结",
    "findings": [
      {
        "type": "strength|weakness|issue|opportunity",
        "description": "详细描述",
        "severity": "low|medium|high|critical",
        "location": "具体位置（可选）"
      }
    ],
    "scores": {
      "overall": 0-100,
      "criteria1": 0-100,
      "criteria2": 0-100
    },
    "recommendations": ["改进建议1", "改进建议2"]
  },
  "message": "简洁的状态消息",
  ${responseConfig.enableConfidence ? `"confidence": 0-100,` : ''}
  ${responseConfig.enableConfidence ? `"confidenceScale": "0-100",` : ''}
  ${responseConfig.enableEvidence ? `"evidence": [
    {
      "type": "data_point|reference|example|calculation|code_snippet|chart_reference",
      "value": "证据内容",
      "source": "证据来源",
      "location": "具体位置（可选）"
    }
  ],` : ''}
  "metadata": {
    "agentVersion": "${agentConfig.version}",
    "timestamp": "ISO 8601 格式时间戳"
  },
  "timestamp": "ISO 8601 格式时间戳",
  "agentVersion": "${agentConfig.version}"
}
\`\`\``);
  }

  // 字段说明
  parts.push(`### 字段说明

- **status**: 执行状态
  - \`completed\`: 任务完全完成
  - \`partial\`: 任务部分完成
  - \`failed\`: 任务失败
  - \`in_progress\`: 任务进行中

- **result**: 执行结果
  ${responseConfig.schemaType === 'simple' ? '- 字符串类型，描述执行的具体结果' : '- 对象类型，包含详细的结果信息'}

- **message**: 简洁的状态消息，总结当前状态

${responseConfig.enableConfidence ? `- **confidence**: 置信度评分 (0-100)，表示你对结果的确信程度
- **confidenceScale**: 置信度范围，固定为 "0-100"` : ''}

${responseConfig.enableEvidence ? `- **evidence**: 支持性证据列表
  - 每个证据需要说明类型、内容和来源
  - ${responseConfig.evidenceRequired ? '此字段为必填项' : '此字段为可选项'}` : ''}

- **timestamp**: ISO 8601 格式的时间戳
- **agentVersion**: Agent 版本号，固定为 "${agentConfig.version}"`);

  return parts.join('\n\n');
}

/**
 * 生成自定义响应格式说明
 */
function generateCustomResponseFormat(config: CustomResponseConfig): string {
  const parts: string[] = [];

  parts.push(`## 返回格式要求

${config.formatDescription}`);

  if (config.validationRules.length > 0) {
    parts.push(`### 验证规则

${config.validationRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}`);
  }

  if (config.examples.length > 0) {
    parts.push(`### 返回示例

${config.examples.map((example, index) => `#### 示例 ${index + 1}

\`\`\`
${example}
\`\`\``).join('\n\n')}`);
  }

  return parts.join('\n\n');
}

/**
 * 生成占位符指南
 */
function generatePlaceholderGuide(config: AgentRoleConfig): string {
  if (!config.responsePlaceholderConfig) return '';

  const { placeholders, exampleValues } = config.responsePlaceholderConfig;

  if (placeholders.length === 0) return '';

  const parts: string[] = [];

  parts.push(`## 占位符说明

在处理任务时，你会遇到以下占位符，请用实际内容替换：`);

  placeholders.forEach(placeholder => {
    const exampleValue = exampleValues[placeholder.key];
    parts.push(`- **${placeholder.key}**: ${placeholder.description}
  示例: \`${exampleValue || '待填充'}\``);
  });

  return parts.join('\n\n');
}

/**
 * 生成返回示例
 */
function generateResponseExamples(config: AgentRoleConfig): string {
  const allExamples = config.tasks.flatMap(task => task.responseExamples);

  if (allExamples.length === 0) return '';

  const parts: string[] = [];

  parts.push(`## 返回示例

以下是一些正确的返回格式示例：`);

  allExamples.forEach((example, index) => {
    parts.push(`### 示例 ${index + 1}

\`\`\`json
${JSON.stringify(example, null, 2)}
\`\`\``);
  });

  return parts.join('\n\n');
}

/**
 * 生成判断标准
 */
function generateJudgmentCriteria(config: AgentRoleConfig): string {
  const allCriteria = config.tasks.flatMap(task => task.judgmentCriteria || []);

  if (allCriteria.length === 0) return '';

  const parts: string[] = [];

  parts.push(`## 判断标准

在进行评估时，请遵循以下判断标准：`);

  allCriteria.forEach((criterion, index) => {
    parts.push(`### ${index + 1}. ${criterion.description}

- **权重**: ${criterion.weight * 100}%
- **检查方法**: ${criterion.checkMethod}`);
  });

  return parts.join('\n\n');
}

/**
 * 生成输出约束
 */
function generateOutputConstraints(config: AgentRoleConfig): string {
  const allConstraints = config.tasks.flatMap(task => task.outputConstraints || []);

  if (allConstraints.length === 0) {
    return `## 重要提醒

1. 确保返回的是有效的 JSON 格式
2. 不要在 JSON 中添加任何注释
3. 确保所有必需字段都有值
4. 保持结果的客观性和准确性`;
  }

  const parts: string[] = [];

  parts.push(`## 输出约束

请严格遵守以下约束：`);

  allConstraints.forEach((constraint, index) => {
    parts.push(`${index + 1}. ${constraint}`);
  });

  // 添加通用约束
  parts.push(`
---

## 通用约束

${allConstraints.length + 1}. 确保返回的是有效的 JSON 格式
${allConstraints.length + 2}. 不要在 JSON 中添加任何注释
${allConstraints.length + 3}. 确保所有必需字段都有值
${allConstraints.length + 4}. 不要在 JSON 外添加任何额外的文字说明
${allConstraints.length + 5}. 保持结果的客观性和准确性`);

  return parts.join('\n\n');
}

/**
 * 生成额外指令
 */
function generateAdditionalInstructions(config: AgentRoleConfig): string {
  if (!config.additionalInstructions || config.additionalInstructions.length === 0) return '';

  const parts: string[] = [];

  parts.push(`## 额外指令

${config.additionalInstructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')}`);

  return parts.join('\n\n');
}

/**
 * 生成完整的提示词（包含系统级指令）
 */
export function generateCompleteAgentPrompt(config: AgentRoleConfig): string {
  const rolePrompt = generateAgentRolePrompt(config);

  return `${rolePrompt}

---

## 执行指南

1. **仔细阅读任务**: 确保完全理解任务要求和期望
2. **遵循格式规范**: 严格按照指定的返回格式输出
3. **保持专业态度**: 以专业、客观的方式完成任务
4. **及时报告问题**: 如果遇到问题，明确说明并提供建议
5. **持续改进**: 根据反馈不断优化输出质量

记住：你的目标是提供高质量、可靠的结果，帮助用户完成任务。`;
}
