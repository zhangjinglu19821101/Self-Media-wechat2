/**
 * 插件系统类型定义
 * 定义了通用运营插件的架构和管理机制
 */

import { AgentId } from './agent-types';

/**
 * 插件分类
 */
export enum PluginCategory {
  REPLY = 'reply',           // 自动回复类
  GROWTH = 'growth',         // 增长运营类
  USER = 'user',             // 用户管理类
  MARKETING = 'marketing',   // 营销活动类
  ANALYSIS = 'analysis',     // 数据分析类
}

/**
 * 插件状态
 */
export enum PluginStatus {
  DEVELOPING = 'developing', // 开发中
  AVAILABLE = 'available',   // 可用
  DEPRECATED = 'deprecated', // 已废弃
}

/**
 * 插件能力来源
 */
export enum CapabilitySource {
  NATIVE = 'native',         // 原生能力（Agent 天生具备）
  DOMAIN = 'domain',         // 领域能力（赛道独有）
  PLUGIN = 'plugin',         // 插件能力（B 开发）
}

/**
 * 通用插件定义
 * 由 Agent B 开发，可供 Agent C 和 Agent insurance-c 使用
 */
export interface Plugin {
  id: string;                    // 插件唯一标识
  name: string;                  // 插件名称
  description: string;           // 插件描述
  category: PluginCategory;      // 插件分类
  version: string;               // 插件版本
  status: PluginStatus;          // 插件状态
  developer: 'B';                // 插件开发者（始终是 B）
  users: AgentId[];              // 可使用此插件的 Agent 列表
  isCustomizable: boolean;       // 是否可配置业务参数

  // 插件配置（由 Agent C 或 insurance-c 填充业务参数）
  config?: {
    // B 负责的基础配置（技术参数）
    baseConfig?: Record<string, any>;
    // C 负责的业务配置（业务参数）
    customConfig?: Record<string, any>;
  };

  // 插件 API
  api?: {
    endpoint: string;            // API 端点
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  };

  // 插件元数据
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt?: Date;
    usageCount?: number;
  };
}

/**
 * Agent 能力定义
 * 每个 Agent 的能力包含三个来源
 */
export interface AgentCapabilities {
  agentId: AgentId;
  agentName: string;

  // 原生能力（Agent 天生具备，无需插件）
  nativeCapabilities: {
    id: string;
    name: string;
    description: string;
    source: CapabilitySource.NATIVE;
  }[];

  // 领域能力（赛道独有，不抽取为插件）
  domainCapabilities: {
    id: string;
    name: string;
    description: string;
    source: CapabilitySource.DOMAIN;
    applicableTo?: AgentId[];  // 适用的 Agent 列表
  }[];

  // 插件能力（B 开发，Agent 使用）
  pluginCapabilities: {
    pluginId: string;
    pluginName: string;
    description: string;
    source: CapabilitySource.PLUGIN;
    config?: Record<string, any>;  // Agent 配置的业务参数
  }[];
}

/**
 * 插件使用日志
 */
export interface PluginUsageLog {
  id: string;
  pluginId: string;
  pluginName: string;
  usedBy: AgentId;
  action: string;
  config?: Record<string, any>;
  result?: {
    success: boolean;
    data?: any;
    error?: string;
  };
  timestamp: Date;
}

/**
 * 预定义的通用插件列表（由 Agent B 开发）
 */
export const PREDEFINED_PLUGINS: Plugin[] = [
  {
    id: 'auto-reply',
    name: '自动回复插件',
    description: '根据关键词自动回复用户留言，支持 AI 对话',
    category: PluginCategory.REPLY,
    version: '1.0.0',
    status: PluginStatus.AVAILABLE,
    developer: 'B',
    users: ['C', 'insurance-c'],
    isCustomizable: true,
    api: {
      endpoint: '/api/plugins/auto-reply',
      method: 'POST',
    },
    metadata: {
      createdAt: new Date('2025-02-01'),
      updatedAt: new Date('2025-02-01'),
    },
  },
  {
    id: 'points-system',
    name: '积分系统插件',
    description: '用户行为积分奖励系统，支持多种积分规则',
    category: PluginCategory.GROWTH,
    version: '1.0.0',
    status: PluginStatus.AVAILABLE,
    developer: 'B',
    users: ['C', 'insurance-c'],
    isCustomizable: true,
    api: {
      endpoint: '/api/plugins/points',
      method: 'POST',
    },
    metadata: {
      createdAt: new Date('2025-02-01'),
      updatedAt: new Date('2025-02-01'),
    },
  },
  {
    id: 'coupon-distribution',
    name: '优惠券插件',
    description: '发放和核销优惠券，支持多种券类型',
    category: PluginCategory.MARKETING,
    version: '1.0.0',
    status: PluginStatus.AVAILABLE,
    developer: 'B',
    users: ['C', 'insurance-c'],
    isCustomizable: true,
    api: {
      endpoint: '/api/plugins/coupon',
      method: 'POST',
    },
    metadata: {
      createdAt: new Date('2025-02-01'),
      updatedAt: new Date('2025-02-01'),
    },
  },
  {
    id: 'viral-marketing',
    name: '裂变营销插件',
    description: '用户裂变拉新活动，支持多种裂变模式',
    category: PluginCategory.MARKETING,
    version: '1.0.0',
    status: PluginStatus.AVAILABLE,
    developer: 'B',
    users: ['C', 'insurance-c'],
    isCustomizable: true,
    api: {
      endpoint: '/api/plugins/viral',
      method: 'POST',
    },
    metadata: {
      createdAt: new Date('2025-02-01'),
      updatedAt: new Date('2025-02-01'),
    },
  },
  {
    id: 'ab-testing',
    name: 'A/B 测试插件',
    description: '内容和活动效果 A/B 测试',
    category: PluginCategory.ANALYSIS,
    version: '1.0.0',
    status: PluginStatus.AVAILABLE,
    developer: 'B',
    users: ['C', 'insurance-c'],
    isCustomizable: true,
    api: {
      endpoint: '/api/plugins/ab-test',
      method: 'POST',
    },
    metadata: {
      createdAt: new Date('2025-02-01'),
      updatedAt: new Date('2025-02-01'),
    },
  },
  {
    id: 'user-segmentation',
    name: '用户分层插件',
    description: '根据用户行为进行分层和打标签',
    category: PluginCategory.USER,
    version: '1.0.0',
    status: PluginStatus.AVAILABLE,
    developer: 'B',
    users: ['C', 'insurance-c'],
    isCustomizable: true,
    api: {
      endpoint: '/api/plugins/segmentation',
      method: 'POST',
    },
    metadata: {
      createdAt: new Date('2025-02-01'),
      updatedAt: new Date('2025-02-01'),
    },
  },
];

/**
 * 预定义的 Agent C 原生能力
 */
export const AGENT_C_NATIVE_CAPABILITIES = [
  {
    id: 'user-communication',
    name: '用户沟通',
    description: '主动回复用户留言、私信，解答用户问题',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'data-analysis',
    name: '数据分析',
    description: '分析运营数据，发现趋势和问题',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'emergency-handling',
    name: '应急处理',
    description: '快速应对运营事故、Bug、突发情况',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'hot-topic-response',
    name: '突发热点应对',
    description: '追踪 AI 领域热点，快速响应',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'channel-exception-handling',
    name: '渠道异常处理',
    description: '处理引流渠道被封、限流等异常',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'ad-hoc-task-execution',
    name: '临时任务执行',
    description: '快速响应 Agent A 下达的临时任务',
    source: CapabilitySource.NATIVE,
  },
];

/**
 * 预定义的 Agent C 领域能力（AI 事业部独有）
 */
export const AGENT_C_DOMAIN_CAPABILITIES = [
  {
    id: 'ai-product-operations',
    name: 'AI 产品运营',
    description: '推广 AI 产品功能，教育用户使用',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['C'],
  },
  {
    id: 'ai-tools-usage',
    name: 'AI 工具使用',
    description: '使用 Midjourney、GPT 等 AI 工具辅助运营',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['C'],
  },
  {
    id: 'ai-hot-topic-tracking',
    name: 'AI 领域热点追踪',
    description: '追踪 AI 行业动态，快速响应热点',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['C'],
  },
  {
    id: 'ai-community-operations',
    name: 'AI 社群运营',
    description: '运营 AI 爱好者社群、开发者社群',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['C'],
  },
  {
    id: 'ai-technology-transformation',
    name: 'AI 技术转化',
    description: '将技术特性转化为用户价值',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['C'],
  },
  {
    id: 'ai-competitor-analysis',
    name: 'AI 竞品分析',
    description: '分析 AI 领域竞品动态',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['C'],
  },
  {
    id: 'ai-user-persona',
    name: 'AI 用户画像',
    description: '分析 AI 用户特征（技术爱好者、产品经理等）',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['C'],
  },
];

/**
 * 预定义的 Agent insurance-c 原生能力
 */
export const AGENT_INSURANCE_C_NATIVE_CAPABILITIES = [
  {
    id: 'user-communication',
    name: '用户沟通',
    description: '主动回复用户留言、私信，解答用户问题',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'data-analysis',
    name: '数据分析',
    description: '分析运营数据，发现趋势和问题',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'emergency-handling',
    name: '应急处理',
    description: '快速应对运营事故、Bug、突发情况',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'hot-topic-response',
    name: '突发热点应对',
    description: '追踪保险行业热点，快速响应',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'channel-exception-handling',
    name: '渠道异常处理',
    description: '处理引流渠道被封、限流等异常',
    source: CapabilitySource.NATIVE,
  },
  {
    id: 'ad-hoc-task-execution',
    name: '临时任务执行',
    description: '快速响应 Agent A 下达的临时任务',
    source: CapabilitySource.NATIVE,
  },
];

/**
 * 预定义的 Agent insurance-c 领域能力（保险事业部独有）
 */
export const AGENT_INSURANCE_C_DOMAIN_CAPABILITIES = [
  {
    id: 'insurance-compliance-operations',
    name: '保险合规运营',
    description: '确保运营符合监管要求',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['insurance-c'],
  },
  {
    id: 'insurance-product-promotion',
    name: '保险产品推广',
    description: '推广保险产品，教育用户购买',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['insurance-c'],
  },
  {
    id: 'insurance-claims-assistance',
    name: '保险理赔协助',
    description: '协助用户完成理赔流程',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['insurance-c'],
  },
  {
    id: 'insurance-risk-control-operations',
    name: '保险风控运营',
    description: '识别和防范保险欺诈',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['insurance-c'],
  },
  {
    id: 'insurance-user-education',
    name: '保险用户教育',
    description: '保险知识科普、风险教育',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['insurance-c'],
  },
  {
    id: 'insurance-community-operations',
    name: '保险社群运营',
    description: '运营保险用户社群（家庭、企业）',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['insurance-c'],
  },
  {
    id: 'insurance-competitor-analysis',
    name: '保险竞品分析',
    description: '分析保险行业竞品动态',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['insurance-c'],
  },
  {
    id: 'insurance-user-persona',
    name: '保险用户画像',
    description: '分析保险用户特征（家庭、年龄、风险偏好）',
    source: CapabilitySource.DOMAIN,
    applicableTo: ['insurance-c'],
  },
];

/**
 * 获取 Agent 可使用的插件列表
 */
export function getAgentPlugins(agentId: AgentId): Plugin[] {
  return PREDEFINED_PLUGINS.filter((plugin) => plugin.users.includes(agentId));
}

/**
 * 获取插件详情
 */
export function getPluginById(pluginId: string): Plugin | null {
  return PREDEFINED_PLUGINS.find((plugin) => plugin.id === pluginId) || null;
}

/**
 * 检查 Agent 是否可以使用指定插件
 */
export function canAgentUsePlugin(agentId: AgentId, pluginId: string): boolean {
  const plugin = getPluginById(pluginId);
  if (!plugin) return false;
  return plugin.users.includes(agentId) && plugin.status === PluginStatus.AVAILABLE;
}

/**
 * 获取 Agent 的完整能力配置
 */
export function getAgentCapabilities(agentId: AgentId): AgentCapabilities {
  let nativeCapabilities: any[];
  let domainCapabilities: any[];
  let agentName: string;

  switch (agentId) {
    case 'C':
      nativeCapabilities = AGENT_C_NATIVE_CAPABILITIES;
      domainCapabilities = AGENT_C_DOMAIN_CAPABILITIES;
      agentName = 'AI 运营专家';
      break;
    case 'insurance-c':
      nativeCapabilities = AGENT_INSURANCE_C_NATIVE_CAPABILITIES;
      domainCapabilities = AGENT_INSURANCE_C_DOMAIN_CAPABILITIES;
      agentName = '保险运营专家';
      break;
    default:
      nativeCapabilities = [];
      domainCapabilities = [];
      agentName = '未知 Agent';
  }

  // 获取 Agent 可使用的插件
  const plugins = getAgentPlugins(agentId);
  const pluginCapabilities = plugins.map((plugin) => ({
    pluginId: plugin.id,
    pluginName: plugin.name,
    description: plugin.description,
    source: CapabilitySource.PLUGIN,
    config: plugin.config,
  }));

  return {
    agentId,
    agentName,
    nativeCapabilities,
    domainCapabilities,
    pluginCapabilities,
  };
}

/**
 * 格式化 Agent 能力为提示词格式
 */
export function formatAgentCapabilitiesForPrompt(agentId: AgentId): string {
  const capabilities = getAgentCapabilities(agentId);

  let result = `你的能力体系：\n\n`;

  // 原生能力
  result += `【原生能力】（天生具备，无需插件）\n`;
  capabilities.nativeCapabilities.forEach((cap, index) => {
    result += `${index + 1}. ${cap.name}：${cap.description}\n`;
  });
  result += '\n';

  // 领域能力
  result += `【领域能力】（${capabilities.agentName}独有，不抽取为插件）\n`;
  capabilities.domainCapabilities.forEach((cap, index) => {
    result += `${index + 1}. ${cap.name}：${cap.description}\n`;
  });
  result += '\n';

  // 插件能力
  result += `【插件能力】（Agent B 开发，你负责使用）\n`;
  capabilities.pluginCapabilities.forEach((cap, index) => {
    result += `${index + 1}. ${cap.pluginName}（${cap.pluginId}）：${cap.description}\n`;
  });
  result += '\n';

  result += `【工作原则】\n`;
  result += `1. 优先使用原生能力和领域能力执行任务\n`;
  result += `2. 使用插件能力时，需要 Agent B 已开发完成\n`;
  if (agentId === 'C') {
    result += `3. 遇到临时任务时，快速响应，灵活应对\n`;
    result += `4. 所有运营经验和效果数据记录到知识库\n`;
    result += `5. 向 Agent B 反馈插件使用情况和改进建议\n`;
  } else if (agentId === 'insurance-c') {
    result += `3. 所有运营活动必须符合保险监管要求\n`;
    result += `4. 所有运营经验和效果数据记录到知识库\n`;
    result += `5. 向 Agent B 反馈插件使用情况和改进建议\n`;
  }

  return result;
}
