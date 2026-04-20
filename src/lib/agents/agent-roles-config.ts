/**
 * Agent 角色配置系统
 * 定义不同 Agent 角色的配置，支持标准化返回结果
 */

/**
 * Agent 角色类型
 */
export type AgentRole = 
  | 'executor' 
  | 'agent-b' 
  | 'agent-c' 
  | 'agent-d'
  | 'insurance-c'
  | 'insurance-d'
  | 'insurance-xiaohongshu'
  | 'insurance-zhihu'
  | 'insurance-toutiao'
  | 'deai-optimizer'
  | 'A' 
  | 'B' 
  | 'C' 
  | 'D';

/**
 * 响应类型枚举
 */
export type ResponseType = 'standard' | 'custom';

/**
 * 标准响应配置
 */
export interface StandardResponseConfig {
  schemaType: 'simple' | 'detailed';
  enableConfidence: boolean;
  confidenceScale?: '0-1' | '0-100' | 'low-medium-high';
  enableEvidence: boolean;
  evidenceRequired?: boolean;
  evidenceFormat?: 'list' | 'key_points' | 'data_points' | 'code_snippets';
}

/**
 * 自定义响应配置
 */
export interface CustomResponseConfig {
  formatDescription: string;
  validationRules: string[];
  examples: string[];
}

/**
 * Agent 任务描述
 */
export interface AgentTaskDescription {
  id: string;
  name: string;
  description: string;
  responseDescription: string;
  responseExamples: unknown[];
  judgmentCriteria?: Array<{
    id: string;
    description: string;
    weight: number;
    checkMethod: string;
  }>;
  outputConstraints?: string[];
}

/**
 * Agent 角色配置
 */
export interface AgentRoleConfig {
  id: AgentRole;
  name: string;
  description: string;
  version: string;
  responseType: ResponseType;
  standardResponseConfig?: StandardResponseConfig;
  customResponseConfig?: CustomResponseConfig;
  tasks: AgentTaskDescription[];
  responsePlaceholderConfig?: {
    placeholders: Array<{
      key: string;
      description: string;
    }>;
    exampleValues: Record<string, string>;
  };
  additionalInstructions?: string[];
}

/**
 * Agent 角色配置映射
 */
export const AGENT_ROLE_CONFIGS: Record<AgentRole, AgentRoleConfig> = {
  /**
   * 执行 Agent (Executor) 配置
   */
  'executor': {
    id: 'executor',
    name: '执行 Agent',
    description: '负责任务执行的 Agent，使用简单标准响应格式',
    version: '2.0.0',
    responseType: 'standard',
    standardResponseConfig: {
      schemaType: 'simple',
      enableConfidence: true,
      confidenceScale: '0-100',
      enableEvidence: true,
      evidenceRequired: false,
      evidenceFormat: 'list',
    },
    tasks: [
      {
        id: 'subtask-execution',
        name: '子任务执行',
        description: '执行用户分配的子任务，生成执行结果',
        responseDescription: '返回执行结果，包含成功状态、结果内容和可选的置信度与证据',
        responseExamples: [
          {
            status: 'completed',
            result: '已成功完成用户需求分析，识别出3个核心功能点：用户登录、数据展示、报表生成',
            message: '任务执行完成',
            confidence: 90,
            evidence: [
              { type: 'reference', value: '用户需求文档第3页', source: '输入数据' },
              { type: 'data_point', value: '识别准确率95%', source: '内部统计' },
            ],
          },
          {
            status: 'partial',
            result: '已完成部分功能实现，由于API文档缺失，报表生成功能暂缓',
            message: '任务部分完成',
            confidence: 75,
          },
          {
            status: 'failed',
            result: '任务执行失败，原因：数据库连接超时',
            message: '任务执行失败',
            confidence: 100,
          },
        ],
        outputConstraints: [
          '结果必须基于实际执行的内容，不能编造信息',
          '如果遇到问题，要明确说明问题所在',
          '保持结果的客观性和准确性',
        ],
      },
    ],
    additionalInstructions: [
      '始终保持专业、客观的语气',
      '结果要简洁明了，避免冗余',
      '如果有多个结果，使用清晰的结构组织',
    ],
  },

  /**
   * Agent B 配置（评审专家）
   */
  'agent-b': {
    id: 'agent-b',
    name: '评审专家 Agent B',
    description: '负责评审其他 Agent 输出结果的专业评审 Agent',
    version: '1.0.0',
    responseType: 'standard',
    standardResponseConfig: {
      schemaType: 'detailed',
      enableConfidence: true,
      confidenceScale: '0-100',
      enableEvidence: true,
      evidenceRequired: true,
      evidenceFormat: 'key_points',
    },
    tasks: [
      {
        id: 'output-review',
        name: '输出结果评审',
        description: '评审其他 Agent 的输出结果，提供专业的评审意见和改进建议',
        responseDescription: '返回详细的评审报告，包含总体判断、评分、优缺点分析和改进建议',
        responseExamples: [
          {
            status: 'completed',
            result: {
              summary: '执行 Agent 的输出结果整体质量良好，但存在一些需要改进的地方',
              findings: [
                {
                  type: 'strength',
                  description: '结果结构清晰，易于理解',
                  severity: 'high',
                },
                {
                  type: 'weakness',
                  description: '缺少具体的数据支撑',
                  severity: 'medium',
                },
              ],
              scores: {
                overall: 78,
                completeness: 85,
                accuracy: 70,
                clarity: 80,
              },
              recommendations: [
                '增加具体的数据支撑',
                '提供更多的细节说明',
                '考虑增加可视化展示',
              ],
            },
            message: '评审完成',
            confidence: 95,
            evidence: [
              { type: 'reference', value: '执行 Agent 输出第2段', source: '评审对象' },
              { type: 'key_points', value: '缺少数据支撑的3个具体位置', source: '评审分析' },
            ],
          },
        ],
        judgmentCriteria: [
          {
            id: 'completeness',
            description: '结果的完整性',
            weight: 0.3,
            checkMethod: '检查是否覆盖了所有必要的内容',
          },
          {
            id: 'accuracy',
            description: '结果的准确性',
            weight: 0.3,
            checkMethod: '验证结果的正确性和可靠性',
          },
          {
            id: 'clarity',
            description: '表达的清晰度',
            weight: 0.2,
            checkMethod: '评估结果的可读性和理解难度',
          },
          {
            id: 'usefulness',
            description: '结果的实用性',
            weight: 0.2,
            checkMethod: '评估结果对用户的帮助程度',
          },
        ],
        outputConstraints: [
          '评审意见要客观公正，基于事实',
          '既要指出优点，也要指出不足',
          '改进建议要具体可行',
          '使用建设性的语气',
        ],
      },
    ],
    responsePlaceholderConfig: {
      placeholders: [
        { key: '{task_description}', description: '待评审任务的描述' },
        { key: '{agent_output}', description: '待评审的 Agent 输出内容' },
        { key: '{evaluation_criteria}', description: '评审标准说明' },
      ],
      exampleValues: {
        '{task_description}': '用户需求分析任务',
        '{agent_output}': '执行 Agent 的完整输出内容...',
        '{evaluation_criteria}': '完整性、准确性、清晰度、实用性',
      },
    },
    additionalInstructions: [
      '采用结构化的评审方法',
      '每个评分都要有对应的理由说明',
      '考虑结果的上下文和使用场景',
      '提供具体的改进建议，而不是空泛的批评',
    ],
  },

  // Agent A 配置 - 任务分配专家
  'A': {
    id: 'A',
    name: 'Agent A - 任务分配专家',
    description: '负责任务分配和拆解的专家 Agent',
    version: '2.0.0',
    responseType: 'standard',
    standardResponseConfig: {
      schemaType: 'detailed',
      enableConfidence: true,
      confidenceScale: '0-100',
      enableEvidence: true,
      evidenceRequired: false,
      evidenceFormat: 'list',
    },
    tasks: [
      {
        id: 'task-splitting',
        name: '任务拆解与分配',
        description: '将大任务拆解为可执行的子任务，并分配给合适的 Agent',
        responseDescription: '返回任务拆解结果，包含子任务列表、分配建议和执行计划',
        responseExamples: [
          {
            status: 'completed',
            result: {
              summary: '任务拆解完成，共拆分为5个子任务',
              findings: [
                {
                  type: 'task',
                  description: '用户需求分析 - 分配给 Executor',
                  severity: 'high',
                },
              ],
              recommendations: [
                '按顺序执行子任务',
                '每个子任务完成后进行评审',
              ],
            },
            message: '任务拆解完成',
            confidence: 88,
          },
        ],
        outputConstraints: [
          '任务拆解要合理，每个子任务应该有明确的目标',
          '分配要基于各 Agent 的专长',
          '考虑任务之间的依赖关系',
        ],
      },
    ],
    additionalInstructions: [
      '从全局角度考虑任务分配',
      '确保子任务之间的衔接流畅',
      '考虑风险和容错机制',
    ],
  },

  // Agent B 配置（传统）- 结果评审专家
  'B': {
    id: 'B',
    name: 'Agent B - 结果评审专家',
    description: '负责评审其他 Agent 输出结果的专业评审 Agent',
    version: '2.0.0',
    responseType: 'standard',
    standardResponseConfig: {
      schemaType: 'detailed',
      enableConfidence: true,
      confidenceScale: '0-100',
      enableEvidence: true,
      evidenceRequired: true,
      evidenceFormat: 'key_points',
    },
    tasks: [
      {
        id: 'result-review',
        name: '结果评审',
        description: '评审其他 Agent 的输出结果，提供专业的评审意见',
        responseDescription: '返回详细的评审报告，包含评分、优缺点分析和改进建议',
        responseExamples: [
          {
            status: 'completed',
            result: {
              summary: '输出结果质量良好，可以通过',
              findings: [
                {
                  type: 'strength',
                  description: '结果结构清晰，易于理解',
                  severity: 'high',
                },
                {
                  type: 'weakness',
                  description: '细节方面可以进一步完善',
                  severity: 'low',
                },
              ],
              scores: {
                overall: 85,
                completeness: 90,
                accuracy: 80,
                clarity: 85,
              },
              recommendations: [
                '继续保持良好的结构',
                '可以增加更多细节说明',
              ],
            },
            message: '评审完成',
            confidence: 92,
            evidence: [
              { type: 'reference', value: '输出结果第1段', source: '评审对象' },
            ],
          },
        ],
        judgmentCriteria: [
          {
            id: 'completeness',
            description: '结果的完整性',
            weight: 0.3,
            checkMethod: '检查是否覆盖所有必要内容',
          },
          {
            id: 'accuracy',
            description: '结果的准确性',
            weight: 0.3,
            checkMethod: '验证结果的正确性',
          },
        ],
        outputConstraints: [
          '评审要客观公正，基于事实',
          '既要肯定优点，也要指出不足',
          '改进建议要具体可行',
        ],
      },
    ],
    additionalInstructions: [
      '采用结构化的评审方法',
      '每个评分都要有理由说明',
      '提供具体的改进建议',
    ],
  },

  // Agent C 配置
  'C': {
    id: 'C',
    name: 'Agent C - 专业分析专家',
    description: '负责专业领域分析和深度研究的专家 Agent',
    version: '2.0.0',
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
        id: 'professional-analysis',
        name: '专业分析',
        description: '对专业问题进行深度分析，提供专业见解',
        responseDescription: '返回详细的分析报告，包含发现、结论和建议',
        responseExamples: [
          {
            status: 'completed',
            result: {
              summary: '分析完成，发现了关键问题',
              findings: [
                {
                  type: 'finding',
                  description: '发现了关键趋势',
                  severity: 'high',
                },
              ],
              recommendations: [
                '建议采取措施1',
                '建议采取措施2',
              ],
            },
            message: '分析完成',
            confidence: 90,
            evidence: [
              { type: 'data_point', value: '关键数据点1', source: '数据分析' },
            ],
          },
        ],
        outputConstraints: [
          '分析要有数据支撑',
          '结论要基于事实',
          '建议要具体可行',
        ],
      },
    ],
    additionalInstructions: [
      '深入分析问题本质',
      '提供有价值的专业见解',
      '确保分析的客观性和准确性',
    ],
  },

  // Agent D 配置
  'D': {
    id: 'D',
    name: 'Agent D - 执行与优化专家',
    description: '负责执行优化和持续改进的专家 Agent',
    version: '2.0.0',
    responseType: 'standard',
    standardResponseConfig: {
      schemaType: 'simple',
      enableConfidence: true,
      confidenceScale: '0-100',
      enableEvidence: true,
      evidenceRequired: false,
      evidenceFormat: 'list',
    },
    tasks: [
      {
        id: 'execution-optimization',
        name: '执行优化',
        description: '优化执行过程，提升效率和质量',
        responseDescription: '返回优化结果和改进建议',
        responseExamples: [
          {
            status: 'completed',
            result: '优化完成，效率提升了30%，主要改进包括：1. 简化流程 2. 自动化重复步骤 3. 优化资源配置',
            message: '优化完成',
            confidence: 88,
            evidence: [
              { type: 'data_point', value: '效率提升30%', source: '性能测试' },
            ],
          },
        ],
        outputConstraints: [
          '优化建议要基于实际数据',
          '考虑实施成本和收益',
          '确保优化方案的可行性',
        ],
      },
    ],
    additionalInstructions: [
      '关注实际效果',
      '持续跟进优化结果',
      '积累优化经验',
    ],
  },

  // Insurance C 配置
  'insurance-c': {
    id: 'insurance-c',
    name: '保险专家 Agent C',
    description: '保险领域专业顾问，负责保险产品分析和建议',
    version: '2.0.0',
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
        id: 'insurance-analysis',
        name: '保险产品分析',
        description: '分析保险产品，提供专业的购买建议',
        responseDescription: '返回详细的保险分析报告，包含产品对比、推荐和注意事项',
        responseExamples: [
          {
            status: 'completed',
            result: {
              summary: '保险分析完成，为您推荐最适合的产品',
              findings: [
                {
                  type: 'recommendation',
                  description: '推荐产品A，性价比最高',
                  severity: 'high',
                },
                {
                  type: 'warning',
                  description: '注意产品B的健康告知较严格',
                  severity: 'medium',
                },
              ],
              scores: {
                overall: 88,
                product_a: 92,
                product_b: 75,
                product_c: 85,
              },
              recommendations: [
                '优先考虑产品A',
                '根据健康状况选择',
                '注意投保年龄限制',
              ],
            },
            message: '保险分析完成',
            confidence: 92,
            evidence: [
              { type: 'data_point', value: '产品A保费比同类低15%', source: '产品对比' },
              { type: 'reference', value: '保险行业产品数据库', source: '行业数据' },
            ],
          },
        ],
        outputConstraints: [
          '保险建议要基于产品条款',
          '不夸大保险责任',
          '提醒客户如实告知',
          '不承诺收益',
        ],
      },
    ],
    additionalInstructions: [
      '从客户角度考虑问题',
      '提供全面的产品信息',
      '提醒潜在风险',
      '保持专业和客观',
    ],
  },

  // Insurance D 配置
  'insurance-d': {
    id: 'insurance-d',
    name: '保险专家 Agent D - 内容主编',
    description: '保险事业部内容主编，专职负责微信公众号保险科普文章创作，核心受众为中老年群体及关注父母保险的子女，创作需贴合中老年理解能力，全程用大白话，杜绝专业术语。',
    version: '2.2.0',
    // 🔴 使用 isCompleted 格式
    responseType: 'custom',
    customResponseConfig: {
      formatDescription: `## 返回格式要求（强制！）

你必须严格按照以下 JSON 格式返回，禁止使用其他格式！

### 情况1：任务完成
\`\`\`json
{
  "isCompleted": true,
  "result": "【创作完成】文章已生成，共1050字..."
}
\`\`\`

### 情况2：任务无法完成
\`\`\`json
{
  "isCompleted": false,
  "reason": "缺少产品条款原文，无法完成创作。"
}
\`\`\`

**禁止返回以下旧格式：**
- ❌ \`{"isCompleted": true/false, ...}\`
- ❌ \`{"isNeedMcp": true/false, "isTaskDown": true/false, ...}\`
- ❌ 任何不包含 \`isCompleted\` 字段的响应`,
      validationRules: [
        '必须包含 isCompleted 字段（布尔值）',
        '如果 isCompleted = true，必须包含 result 字段',
        '如果 isCompleted = false，必须包含 reason 字段',
        'result/reason 必须是字符串类型',
        '只返回 JSON，不要添加任何额外文字',
      ],
      examples: [
        `{
  "isCompleted": true,
  "result": "【创作完成】文章已生成。文章标题："咱爸妈想了解分红险？记住3点，不踩坑更安心"，正文包含3条实操方法，符合中老年阅读习惯，全文约1000字，使用大白话，避免专业术语。"
}`,
        `{
  "isCompleted": false,
  "reason": "缺少产品条款原文，无法完成创作。"
}`,
      ],
    },
    tasks: [
      {
        id: 'insurance-content-creation',
        name: '保险科普文章创作',
        description: '创作适合中老年群体的保险科普文章，用大白话讲解保险知识。收到创作指令后，按以下8步执行：\n\n【第一步】指令拆解：明确核心关键词，拆解中老年受众痛点，确定文章核心价值。\n【第二步】材料获取：从固定目录获取知识点、案例；若无则自行生成。\n【第三步】标题创作：18-26字，包含三类词（行业词+需求词+安心词）。\n【第四步】框架搭建：开头明确价值、正文3条实操、结尾温和提醒、引导关注留言。\n【第五步】正文撰写：1000字左右，大白话短句短段，禁用专业术语，自然融入关键词。\n【第六步】合规自查：不夸大、不承诺、不违规、不误导。\n【第七步】去AI校验：语气自然有温度，禁用AI书面词，消除说教感。\n【第八步】最终核对：字数、结构、关键词、合规、去AI效果。',
        responseDescription: '返回完整的文章内容，包含标题、正文、结尾等完整结构',
        outputConstraints: [
          '全程用大白话，杜绝专业术语',
          '贴合中老年理解能力，每段1-2行，短句短段',
          '标题18-26字，包含三类词（核心行业词+需求词+安心词）',
          '全文1000字左右（误差不超过50字）',
          '固定结构：开头+正文3条实操+结尾+关注引导+留言引导',
          '不夸大、不承诺、不违规、不贩卖焦虑',
          '去AI核心要求：语气词（咱/哎/记得）+场景碎片+无说教感',
          '禁用专业术语：保额、免赔额、费率、健告、等待期、分红率、保底收益等',
        ],
        responseExamples: [
          { title: '买重疾险，这3个坑千万别踩', content: '...' },
        ],
      },
      {
        id: 'insurance-compliance-review',
        name: '合规审核（不负责）',
        description: '你只负责内容创作，不负责专业合规审核',
        responseDescription: '返回 isCompleted: false，说明由 Agent T 处理',
        outputConstraints: [
          '合规审核不是你负责的领域',
          '专业合规审核由 Agent T 调用工具处理',
        ],
        responseExamples: [
          { isCompleted: false, reason: '合规审核应由 Agent T 调用专业工具处理' },
        ],
      },
    ],
    additionalInstructions: [
      '🔴 【强制规则：专注本职工作】',
      '你只负责【内容创作】，不负责以下任何任务：',
      '  - 合规审核/合规检查：必须由 Agent T 调用工具处理',
      '  - 产品条款解读：缺少条款时返回 isCompleted: false',
      '  - 专业数据查询：返回 isCompleted: false，让 Agent T 处理',
      '收到非创作任务时，必须立即返回：{"isCompleted": false, "reason": "这不是我的职责。合规审核应由 Agent T 调用专业工具处理。"}',
      '',
      '核心受众为中老年群体及关注父母保险的子女',
      '每篇加2-3个生活化语气词（咱、哎、记得、放心等），自然融入不堆砌',
      '正文至少1条带1句短场景碎片（如"咱邻居阿姨买分红险时就踩过这个坑"）',
      '禁用AI书面词：不使用"诸如、综上所述、鉴于此、据此"等，替换为口语',
      '语气平等温和，像和长辈聊天，不用"你们要记住"，改用"咱记住这一点就好"',
      '分红险额外禁用：分红率、保底收益等，基础实操讲"理性了解、按需选择"',
      '只讲实操方法，不恐吓、不煽情、不制造焦虑',
    ],
  },

  // Insurance Xiaohongshu 配置
  'insurance-xiaohongshu': {
    id: 'insurance-xiaohongshu',
    name: '小红书创作专家 - 图文笔记创作',
    description: '小红书平台保险图文创作专家，专注于输出结构化小红书笔记（封面图+文字卡片+正文），支持emoji风格、短段落、口语化表达，适配小红书内容生态。',
    version: '1.0.0',
    responseType: 'custom',
    customResponseConfig: {
      formatDescription: `## 返回格式要求（强制！）

你必须严格按照以下 JSON 格式返回，禁止使用其他格式！

### 情况1：图文创作完成
\`\`\`json
{
  "isCompleted": true,
  "result": "【创作完成】小红书图文已生成，共XXX字...",
  "articleTitle": "文章的核心标题（15字以内）"
}
\`\`\`

### 情况2：任务无法完成
\`\`\`json
{
  "isCompleted": false,
  "result": "【无法执行】原因说明"
}
\`\`\``,
      validationRules: [
        '必须包含 isCompleted 字段（布尔值）',
        '如果 isCompleted = true，必须包含 result 字段和 articleTitle 字段',
        '如果 isCompleted = false，必须在 result 中说明原因',
        'articleTitle 必须是15字以内的核心标题',
        '只返回 JSON，不要添加任何额外文字',
      ],
      examples: [
        `{
  "isCompleted": true,
  "result": "【创作完成】小红书图文已生成，共980字...",
  "articleTitle": "分红险3个坑别踩"
}`,
        `{
  "isCompleted": false,
  "result": "【无法执行】缺少创作指令"
}`,
      ],
    },
    tasks: [
      {
        id: 'xiaohongshu-content-creation',
        name: '小红书图文创作',
        description: '创作适合小红书平台的保险图文笔记，输出结构化JSON（title/points/fullText/tags），支持图文分工模式。',
        responseDescription: '返回完整的图文内容JSON，包含标题、要点卡片、正文、标签',
        outputConstraints: [
          '输出JSON格式：title/intro/points/fullText/tags/articleTitle',
          'fullText 800-1000字，emoji点缀、短段落、数字编号',
          'points 3-5个核心要点，title≤15字（渲染到图片卡片）',
          '标题悬念/反差/揭秘式，≤20字',
          '口语化、像朋友聊天、不使用专业术语',
          '禁用绝对化词汇（最/第一/100%/保本/稳赚/绝对）',
        ],
        responseExamples: [
          { title: '分红险3个坑别踩', points: [{ title: '坑1: 分红不是利息', content: '...' }], fullText: '...' },
        ],
      },
    ],
    additionalInstructions: [
      '🔴 【强制规则：专注小红书图文创作】',
      '你只负责【小红书图文创作】，不负责以下任何任务：',
      '  - 合规审核：必须由 Agent T 调用工具处理',
      '  - 公众号长文：由 insurance-d 负责',
      '收到非小红书创作任务时，返回 isCompleted: false',
    ],
  },

  // Insurance Zhihu 配置
  'insurance-zhihu': {
    id: 'insurance-zhihu',
    name: '知乎创作专家 - 专业深度回答与文章',
    description: '知乎平台保险内容创作专家，专注于输出专业深度的回答和文章，支持数据引用、逻辑推理、专业术语使用，适配知乎内容生态。',
    version: '1.0.0',
    responseType: 'custom',
    customResponseConfig: {
      formatDescription: `## 返回格式要求（强制！）

你必须严格按照以下 JSON 格式返回，禁止使用其他格式！

### 情况1：文章/回答创作完成
\`\`\`json
{
  "isCompleted": true,
  "result": {
    "content": "完整的文章正文（Markdown格式）",
    "articleTitle": "文章标题（≤30字）",
    "platformData": {
      "platform": "zhihu"
    }
  },
  "articleTitle": "文章标题（与result.articleTitle一致）"
}
\`\`\`

### 情况2：任务无法完成
\`\`\`json
{
  "isCompleted": false,
  "result": {
    "error": "【无法执行】原因说明"
  }
}
\`\`\``,
      validationRules: [
        'isCompleted 为 true 时，result 必须是包含 content 和 articleTitle 的对象',
        'content 为 Markdown 格式的完整文章',
        'articleTitle 不超过30字',
      ],
      examples: [
        `{
  "isCompleted": true,
  "result": {
    "content": "# 重疾险理赔的那些坑\\n\\n很多人以为买了重疾险就万事大吉...",
    "articleTitle": "重疾险理赔的5个常见误区",
    "platformData": {
      "platform": "zhihu"
    }
  },
  "articleTitle": "重疾险理赔的5个常见误区"
}`,
        `{
  "isCompleted": false,
  "result": {
    "error": "【无法执行】缺少创作指令"
  }
}`,
      ],
    },
    tasks: [
      {
        id: 'zhihu-content-creation',
        name: '知乎文章/回答创作',
        description: '创作适合知乎平台的保险专业深度内容，输出Markdown格式文章，支持数据引用和逻辑论证。',
        responseDescription: '返回完整的文章内容（Markdown格式），包含标题、正文、数据引用',
        outputConstraints: [
          '输出信封格式：result.content（Markdown完整正文）+ result.articleTitle',
          '正文1500-3000字，专业但不晦涩',
          '支持数据引用（标注来源）、逻辑推理',
          '标题专业客观，≤30字',
          '使用专业术语但提供通俗解释',
          '禁用绝对化词汇（最/第一/100%/保本/稳赚/绝对）',
        ],
        responseExamples: [
          { content: '# 重疾险理赔的5个常见误区\n\n很多人以为...', articleTitle: '重疾险理赔的5个常见误区' },
        ],
      },
    ],
    additionalInstructions: [
      '🔴 【强制规则：专注知乎专业内容创作】',
      '你只负责【知乎专业内容创作】，不负责以下任何任务：',
      '  - 合规校验、MCP工具操作 → 交给 Agent T',
      '  - 公众号长文 → 交给 insurance-d',
      '  - 小红书图文 → 交给 insurance-xiaohongshu',
      '  - 头条/微博文章 → 交给 insurance-toutiao',
      '收到非知乎创作任务时，返回 isCompleted: false',
    ],
  },

  // Insurance Toutiao 配置
  'insurance-toutiao': {
    id: 'insurance-toutiao',
    name: '头条创作专家 - 信息流文章创作',
    description: '今日头条/抖音/微博平台保险内容创作专家，专注于输出强节奏、高信息密度的信息流文章，标题吸引力强、段落短小、节奏紧凑，适配头条/抖音/微博内容生态。',
    version: '1.0.0',
    responseType: 'custom',
    customResponseConfig: {
      formatDescription: `## 返回格式要求（强制！）

你必须严格按照以下 JSON 格式返回，禁止使用其他格式！

### 情况1：文章创作完成
\`\`\`json
{
  "isCompleted": true,
  "result": {
    "content": "完整的文章正文（纯文本格式）",
    "articleTitle": "文章标题（≤25字，吸引力强）",
    "platformData": {
      "platform": "douyin"
    }
  },
  "articleTitle": "文章标题（与result.articleTitle一致）"
}
\`\`\`

### 情况2：任务无法完成
\`\`\`json
{
  "isCompleted": false,
  "result": {
    "error": "【无法执行】原因说明"
  }
}
\`\`\``,
      validationRules: [
        'isCompleted 为 true 时，result 必须是包含 content 和 articleTitle 的对象',
        'content 为纯文本格式的完整文章',
        'articleTitle 不超过25字',
      ],
      examples: [
        `{
  "isCompleted": true,
  "result": {
    "content": "买了重疾险，这5种情况一分不赔！\\n\\n很多人以为买了重疾险就万事大吉...",
    "articleTitle": "买了重疾险这5种情况一分不赔",
    "platformData": {
      "platform": "douyin"
    }
  },
  "articleTitle": "买了重疾险这5种情况一分不赔"
}`,
        `{
  "isCompleted": false,
  "result": {
    "error": "【无法执行】缺少创作指令"
  }
}`,
      ],
    },
    tasks: [
      {
        id: 'toutiao-content-creation',
        name: '头条/信息流文章创作',
        description: '创作适合今日头条/抖音/微博的保险信息流文章，纯文本格式，标题吸引力强、段落短小、节奏紧凑。',
        responseDescription: '返回完整的文章内容（纯文本格式），包含标题和正文',
        outputConstraints: [
          '输出信封格式：result.content（纯文本完整正文）+ result.articleTitle',
          '正文800-1500字，段落短小（每段不超过3行）',
          '标题悬念/数字/反常识式，≤25字',
          '强节奏：短句、数字列表、反问句',
          '口语化、接地气、适合信息流快速阅读',
          '禁用绝对化词汇（最/第一/100%/保本/稳赚/绝对）',
        ],
        responseExamples: [
          { content: '买了重疾险，这5种情况一分不赔！\n\n很多人以为...', articleTitle: '买了重疾险这5种情况一分不赔' },
        ],
      },
    ],
    additionalInstructions: [
      '🔴 【强制规则：专注头条/信息流内容创作】',
      '你只负责【头条/信息流内容创作】，不负责以下任何任务：',
      '  - 合规校验、MCP工具操作 → 交给 Agent T',
      '  - 公众号长文 → 交给 insurance-d',
      '  - 小红书图文 → 交给 insurance-xiaohongshu',
      '  - 知乎专业内容 → 交给 insurance-zhihu',
      '收到非信息流创作任务时，返回 isCompleted: false',
    ],
  },

  // 去AI化优化 Agent 配置
  'deai-optimizer': {
    id: 'deai-optimizer',
    name: '去AI化优化专家',
    description: '对写作Agent生成的内容进行去AI化优化，让内容更自然、更像真人手写',
    version: '1.0.0',
    responseType: 'custom',
    customResponseConfig: {
      formatDescription: `返回信封格式的 JSON 对象，包含优化后的完整正文。

### 情况1：优化成功
\`\`\`json
{
  "isCompleted": true,
  "result": {
    "content": "优化后的完整正文内容（纯文本格式）",
    "articleTitle": "文章标题（不超过15字）",
    "platformData": {
      "platform": "xiaohongshu|wechat_official|zhihu|toutiao",
      "optimizationNotes": "本次优化的主要改动说明（简短）"
    }
  },
  "articleTitle": "文章标题（与result.articleTitle一致）"
}
\`\`\`

### 情况2：优化失败
\`\`\`json
{
  "isCompleted": false,
  "result": {
    "error": "【无法执行】原因说明"
  }
}
\`\`\``,
      validationRules: [
        'isCompleted 为 true 时，result 必须是包含 content 和 articleTitle 的对象',
        'content 为优化后的完整正文，必须保持原文核心观点、案例、结构',
        '优化后内容需符合目标平台文风规则',
      ],
      examples: [
        `{
  "isCompleted": true,
  "result": {
    "content": "说实话，很多人买了重疾险就以为万事大吉了。\\n\\n但真相是，有些情况真的不赔...",
    "articleTitle": "买了重疾险这5种情况不赔",
    "platformData": {
      "platform": "xiaohongshu",
      "optimizationNotes": "去除AI模板句，增加口语化表达"
    }
  },
  "articleTitle": "买了重疾险这5种情况不赔"
}`,
        `{
  "isCompleted": false,
  "result": {
    "error": "【无法执行】缺少原始文章内容"
  }
}`,
      ],
    },
    tasks: [
      {
        id: 'deai-optimization',
        name: '去AI化内容优化',
        description: '对写作Agent生成的保险科普文案进行全维度自检和柔和改写，让内容更自然、更像真人手写',
        responseDescription: '返回优化后的完整文章内容，保持原文核心观点、案例、结构',
        outputConstraints: [
          '输出信封格式：result.content（优化后完整正文）+ result.articleTitle',
          '不改变原文核心观点、案例、结构框架',
          '剔除AI机器腔、模板句式、空洞套话、生硬说教',
          '加入口语化转折词，增加真人思考痕迹',
          '按目标平台文风规则进行精准校准',
          '二次合规自查，删除违规话术',
        ],
        responseExamples: [
          { content: '说实话，很多人买了重疾险就以为万事大吉了...', articleTitle: '买了重疾险这5种情况不赔' },
        ],
      },
    ],
    additionalInstructions: [
      '🔴 【强制规则：专注去AI化优化】',
      '你只负责【内容优化】，不负责以下任何任务：',
      '  - 内容创作 → 交给写作Agent（insurance-d/insurance-xiaohongshu/insurance-zhihu/insurance-toutiao）',
      '  - 合规校验、MCP工具操作 → 交给 Agent T',
      '收到非优化任务时，返回 isCompleted: false',
    ],
  },
};

/**
 * 获取 Agent 角色配置
 * @param agentRole Agent 角色
 * @returns 配置对象
 */
export function getAgentRoleConfig(agentRole: AgentRole): AgentRoleConfig {
  const config = AGENT_ROLE_CONFIGS[agentRole];
  if (!config) {
    throw new Error(`未找到 Agent 角色 ${agentRole} 的配置`);
  }
  return config;
}

/**
 * 获取所有 Agent 角色 ID
 * @returns Agent 角色 ID 列表
 */
export function getAllAgentRoleIds(): AgentRole[] {
  return Object.keys(AGENT_ROLE_CONFIGS) as AgentRole[];
}

/**
 * 检查 Agent 角色是否使用标准响应格式
 * @param agentRole Agent 角色
 * @returns 是否使用标准响应格式
 */
export function isUsingStandardResponse(agentRole: AgentRole): boolean {
  const config = getAgentRoleConfig(agentRole);
  return config.responseType === 'standard';
}

/**
 * 检查 Agent 角色是否有标准响应配置
 * @param agentRole Agent 角色
 * @returns 是否有标准响应配置
 */
export function hasStandardResponseConfig(agentRole: AgentRole): boolean {
  const config = getAgentRoleConfig(agentRole);
  return config.responseType === 'standard' && config.standardResponseConfig !== undefined;
}
