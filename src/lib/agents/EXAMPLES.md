# Agent 角色配置系统使用示例

## 概述

本系统通过配置方式实现多 Agent 角色的标准化返回结果，无需修改核心代码。

---

## 1. 新增 Agent 角色的步骤

### 步骤 1: 在 `agent-roles-config.ts` 中添加配置

在 `AGENT_ROLE_CONFIGS` 对象中添加新的 Agent 配置：

```typescript
// 示例：新增 Agent C
'agent-c': {
  id: 'agent-c',
  name: 'Agent C',
  description: 'Agent C 的角色描述',
  version: '1.0.0',
  responseType: 'standard',  // 或 'custom'
  standardResponseConfig: {  // 如果是 'standard'
    schemaType: 'simple',     // 或 'detailed'
    enableConfidence: true,
    enableEvidence: true,
    evidenceRequired: false,
    evidenceFormat: 'key_points',
  },
  tasks: [
    {
      id: 'main-task',
      name: '主要任务',
      description: '描述 Agent C 的主要任务',
      responseDescription: '描述预期的返回结果格式',
      responseExamples: [
        // 示例返回结果
      ],
      judgmentCriteria: [
        // 判断标准
      ],
      outputConstraints: [
        // 输出约束
      ],
    },
  ],
  responsePlaceholderConfig: {
    // 占位符配置
  },
  additionalInstructions: [
    // 额外指令
  ],
}
```

### 步骤 2: 在类型定义中添加新角色

在 `AgentRole` 类型中添加新角色 ID：

```typescript
export type AgentRole = 
  | 'executor' 
  | 'agent-b'
  | 'agent-c';  // 新增
```

---

## 2. Agent C 配置示例

### 场景：数据分析 Agent

```typescript
'agent-c': {
  id: 'agent-c',
  name: '数据分析专家',
  description: '负责分析数据、生成统计报告、识别数据趋势',
  version: '1.0.0',
  responseType: 'standard',
  standardResponseConfig: {
    schemaType: 'detailed',
    enableConfidence: true,
    confidenceScale: '0-100',
    enableEvidence: true,
    evidenceRequired: true,
    evidenceFormat: 'data_points',
  },
  tasks: [
    {
      id: 'analyze-data',
      name: '数据分析',
      description: '对提供的数据进行深入分析，识别关键模式和趋势',
      responseDescription: '返回详细的分析结果，包含关键发现、趋势分析和建议',
      responseExamples: [
        {
          status: 'completed',
          result: {
            key_findings: ['发现了季节性销售趋势', '产品A的转化率提升了15%'],
            trend_analysis: '过去3个月用户增长呈现上升趋势',
            recommendations: ['建议增加产品A的库存', '推出季节性促销活动'],
          },
          message: '数据分析完成，发现了重要趋势',
          confidence: 85,
          evidence: [
            { type: 'data_point', value: '转化率提升15%', source: '销售数据' },
            { type: 'chart_reference', value: '图3-1：用户增长趋势', source: '数据可视化报告' },
          ],
        },
      ],
      judgmentCriteria: [
        {
          id: 'data_accuracy',
          description: '分析结果的准确性',
          weight: 0.4,
          checkMethod: '与原始数据对比验证',
        },
        {
          id: 'insight_depth',
          description: '洞察的深度和实用性',
          weight: 0.3,
          checkMethod: '评估建议的可操作性',
        },
        {
          id: 'completeness',
          description: '分析的完整性',
          weight: 0.3,
          checkMethod: '检查是否覆盖了所有关键维度',
        },
      ],
      outputConstraints: [
        '分析结果必须基于提供的数据，不能编造信息',
        '建议需要具体可行，避免空泛描述',
        '使用数据支撑每个结论',
      ],
    },
  ],
  responsePlaceholderConfig: {
    placeholders: [
      { key: '{data_source}', description: '数据来源说明' },
      { key: '{analysis_period}', description: '分析的时间周期' },
    ],
    exampleValues: {
      '{data_source}': '2024年第一季度销售数据',
      '{analysis_period}': '2024-01-01 至 2024-03-31',
    },
  },
  additionalInstructions: [
    '使用数据可视化的思维来组织分析结果',
    '优先关注业务影响大的发现',
    '提供的建议需要考虑实施成本和收益',
  ],
}
```

---

## 3. Agent D 配置示例

### 场景：代码审查 Agent

```typescript
'agent-d': {
  id: 'agent-d',
  name: '代码审查专家',
  description: '负责审查代码质量、识别潜在问题、提供改进建议',
  version: '1.0.0',
  responseType: 'standard',
  standardResponseConfig: {
    schemaType: 'detailed',
    enableConfidence: true,
    confidenceScale: '0-100',
    enableEvidence: true,
    evidenceRequired: true,
    evidenceFormat: 'code_snippets',
  },
  tasks: [
    {
      id: 'code-review',
      name: '代码审查',
      description: '对提交的代码进行全面审查，识别问题和改进点',
      responseDescription: '返回详细的审查报告，包含问题列表、严重程度评估和修复建议',
      responseExamples: [
        {
          status: 'completed',
          result: {
            issues: [
              {
                type: 'bug',
                severity: 'high',
                location: 'src/utils/helper.ts:42',
                description: '空指针引用风险',
                suggestion: '添加空值检查',
              },
            ],
            quality_score: 75,
            summary: '代码整体质量良好，但存在一些需要修复的问题',
          },
          message: '代码审查完成，发现了3个问题',
          confidence: 90,
          evidence: [
            { type: 'code_snippet', value: 'const result = data.process();', location: 'src/utils/helper.ts:42' },
            { type: 'test_reference', value: 'Test case #123 失败', source: '单元测试报告' },
          ],
        },
      ],
      judgmentCriteria: [
        {
          id: 'bug_detection',
          description: 'Bug 检测的准确性',
          weight: 0.4,
          checkMethod: '验证问题是否真实存在',
        },
        {
          id: 'suggestion_quality',
          description: '建议的质量和可操作性',
          weight: 0.3,
          checkMethod: '评估建议的可行性',
        },
        {
          id: 'coverage',
          description: '审查的覆盖范围',
          weight: 0.3,
          checkMethod: '检查是否覆盖了所有关键代码路径',
        },
      ],
      outputConstraints: [
        '每个问题都需要指明具体的代码位置',
        '严重程度评估需要客观标准',
        '修复建议要具体，提供代码示例',
      ],
    },
  ],
  responsePlaceholderConfig: {
    placeholders: [
      { key: '{code_path}', description: '代码文件路径' },
      { key: '{review_scope}', description: '审查范围说明' },
    ],
    exampleValues: {
      '{code_path}': 'src/components/LoginForm.tsx',
      '{review_scope}': '全量代码审查',
    },
  },
  additionalInstructions: [
    '优先关注安全性和性能问题',
    '考虑代码的可维护性和可读性',
    '提供的修复建议需要符合最佳实践',
  ],
}
```

---

## 4. 使用新配置的 Agent

### 在代码中使用

```typescript
import { loadAgentRolePrompt, AgentRole } from '@/lib/agents/prompt-loader';

// 加载 Agent C 的提示词
const agentCPrompt = loadAgentRolePrompt('agent-c');

// 加载 Agent D 的提示词
const agentDPrompt = loadAgentRolePrompt('agent-d');

// 在 LLM 调用中使用
const response = await llm.chat({
  messages: [
    { role: 'system', content: agentCPrompt },
    { role: 'user', content: '请分析以下数据...' },
  ],
});
```

### 运行时加载配置

```typescript
import { 
  getAgentRoleConfig, 
  generateAgentRolePrompt,
  AgentRole 
} from '@/lib/agents/agent-roles-config';

// 获取配置
const config = getAgentRoleConfig('agent-c');

// 动态生成提示词
const prompt = generateAgentRolePrompt(config);

// 使用提示词
console.log(prompt);
```

---

## 5. 自定义返回格式示例

如果需要完全自定义返回格式（不使用标准结构）：

```typescript
'agent-e': {
  id: 'agent-e',
  name: '创意写作专家',
  description: '负责生成创意文本、故事、广告语等',
  version: '1.0.0',
  responseType: 'custom',
  customResponseConfig: {
    formatDescription: `使用 Markdown 格式返回，包含以下部分：
# 创意作品
## 标题
[作品标题]

## 正文
[作品内容]

## 创作说明
[创作思路和说明]`,
    validationRules: [
      '必须包含标题和正文',
      '正文长度不少于500字',
      '使用 Markdown 格式',
    ],
    examples: [
      `# 春天的故事
## 标题
春暖花开

## 正文
春天来了，万物复苏...

## 创作说明
本作品通过描绘春天的景象，表达了对生命的热爱...`,
    ],
  },
  tasks: [
    {
      id: 'creative-writing',
      name: '创意写作',
      description: '根据用户需求生成创意文本',
      responseDescription: '返回一篇完整的创意作品',
      responseExamples: [],
      judgmentCriteria: [],
      outputConstraints: [],
    },
  ],
  responsePlaceholderConfig: { placeholders: [], exampleValues: {} },
  additionalInstructions: [],
}
```

---

## 6. 最佳实践

1. **渐进式迁移**：先为新 Agent 使用配置系统，现有 Agent 可逐步迁移
2. **版本管理**：每次修改配置都更新 version 字段
3. **示例丰富**：提供充分的返回示例，帮助 LLM 理解预期格式
4. **判断标准明确**：为评审 Agent 提供清晰的判断标准
5. **占位符使用**：合理使用占位符，让提示词更加灵活
6. **测试验证**：新增 Agent 后，先进行测试验证返回格式的正确性

---

## 7. 故障排查

### 问题：提示词生成失败
- 检查配置对象是否完整
- 验证必填字段是否都已提供
- 查看控制台错误信息

### 问题：LLM 不按预期格式返回
- 增加更多返回示例
- 明确输出约束
- 调整判断标准的权重

### 问题：配置修改后不生效
- 清除提示词缓存：`clearPromptCache()`
- 确保使用了最新的配置版本
