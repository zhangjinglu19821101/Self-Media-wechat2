/**
 * Agent 能力配置化
 * 区分基础能力（平台提供）和领域能力（专家提供）
 */

import { Skill } from './agent-types';

/**
 * 基础能力定义（平台提供）
 */
export const BASE_CAPABILITIES: {
  [agentId: string]: Skill[];
} = {
  A: [
    {
      id: 'task-decomposition',
      name: '任务分解',
      level: 90,
      description: '将复杂需求分解为具体任务',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'coordination',
      name: '协调能力',
      level: 85,
      description: '协调多个 Agent 协同工作',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'decision-making',
      name: '决策能力',
      level: 88,
      description: '快速做出决策（基于规则）',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'progress-tracking',
      name: '进度跟踪',
      level: 80,
      description: '监控任务执行进度',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'conflict-resolution',
      name: '冲突解决',
      level: 75,
      description: '处理 Agent 之间的冲突',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'communication',
      name: '沟通能力',
      level: 90,
      description: '向用户反馈信息和结果',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
  ],
  B: [
    {
      id: 'programming',
      name: '编程开发',
      level: 85,
      description: '通用编程逻辑和算法',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'debugging',
      name: '调试能力',
      level: 80,
      description: '定位和修复通用问题',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'testing',
      name: '测试能力',
      level: 75,
      description: '编写和执行测试',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'version-control',
      name: '版本控制',
      level: 80,
      description: 'Git 操作和分支管理',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'documentation',
      name: '文档编写',
      level: 70,
      description: '编写技术文档',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
  ],
  C: [
    {
      id: 'data-analysis',
      name: '数据分析',
      level: 75,
      description: '通用数据分析方法',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'content-operation',
      name: '内容运营',
      level: 70,
      description: '通用内容运营策略',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'user-segmentation',
      name: '用户分群',
      level: 65,
      description: '基于数据的用户分群',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'a-b-testing',
      name: 'A/B 测试',
      level: 60,
      description: '实验设计和分析',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'reporting',
      name: '报表生成',
      level: 70,
      description: '生成运营报表',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
  ],
  D: [
    {
      id: 'writing',
      name: '文本写作',
      level: 80,
      description: '通用写作技巧和结构',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'editing',
      name: '编辑排版',
      level: 75,
      description: '文本编辑和格式调整',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'creative-generation',
      name: '创意生成',
      level: 70,
      description: '通用创意构思方法',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'content-planning',
      name: '内容规划',
      level: 65,
      description: '内容日历和排期',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
    {
      id: 'seo-basics',
      name: 'SEO 基础',
      level: 60,
      description: '基础 SEO 优化',
      experience: 0,
      maxExperience: 100,
      type: 'base',
      replicable: true,
    },
  ],
};

/**
 * 领域能力模板（专家提供）
 */
export const DOMAIN_CAPABILITIES_TEMPLATES: {
  [domain: string]: {
    [agentId: string]: Skill[];
  };
} = {
  电商: {
    A: [
      {
        id: 'ecommerce-business-rules',
        name: '电商业务规则',
        level: 85,
        description: '促销活动期间优先级最高，库存不足的任务降级处理',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '电商运营专家',
        price: 5000,
      },
      {
        id: 'ecommerce-kpi',
        name: '电商 KPI 指标',
        level: 80,
        description: '转化率、客单价、用户留存',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '电商分析师',
        price: 3000,
      },
    ],
    B: [
      {
        id: 'ecommerce-tech-stack',
        name: '电商技术栈',
        level: 80,
        description: 'Spring Boot, MySQL, Redis, ElasticSearch',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '电商架构师',
        price: 8000,
      },
      {
        id: 'ecommerce-security',
        name: '电商安全标准',
        level: 75,
        description: '支付安全、数据加密、防刷单',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '安全专家',
        price: 10000,
      },
    ],
    C: [
      {
        id: 'ecommerce-channels',
        name: '电商推广渠道',
        level: 85,
        description: '微信、抖音、小红书、天猫、京东',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '电商运营专家',
        price: 6000,
      },
      {
        id: 'ecommerce-user-persona',
        name: '电商用户画像',
        level: 80,
        description: '价格敏感型、品质追求型、品牌忠诚型',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '用户研究员',
        price: 4000,
      },
    ],
    D: [
      {
        id: 'ecommerce-brand-tone',
        name: '电商品牌调性',
        level: 75,
        description: '促销性强、紧迫感、吸引力',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '品牌专家',
        price: 3000,
      },
      {
        id: 'ecommerce-seo',
        name: '电商 SEO 策略',
        level: 70,
        description: '商品标题优化、长尾关键词、站内搜索',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: 'SEO 专家',
        price: 5000,
      },
    ],
  },
  金融: {
    A: [
      {
        id: 'financial-business-rules',
        name: '金融业务规则',
        level: 90,
        description: '合规优先、风险控制、监管报告',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '金融业务专家',
        price: 15000,
      },
      {
        id: 'financial-kpi',
        name: '金融 KPI 指标',
        level: 85,
        description: 'AUM、净新增、客户满意度',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '金融分析师',
        price: 10000,
      },
    ],
    B: [
      {
        id: 'financial-tech-stack',
        name: '金融技术栈',
        level: 90,
        description: 'Java, Go, Oracle, Kafka',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '金融架构师',
        price: 20000,
      },
      {
        id: 'financial-security',
        name: '金融安全标准',
        level: 95,
        description: 'PCI-DSS 合规、数据加密、审计日志',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '安全专家',
        price: 30000,
      },
    ],
    C: [
      {
        id: 'financial-channels',
        name: '金融推广渠道',
        level: 75,
        description: '银行网点、客户经理、数字营销',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '金融营销专家',
        price: 12000,
      },
      {
        id: 'financial-user-persona',
        name: '金融用户画像',
        level: 85,
        description: '保守型、稳健型、激进型',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '用户研究员',
        price: 8000,
      },
    ],
    D: [
      {
        id: 'financial-brand-tone',
        name: '金融品牌调性',
        level: 90,
        description: '专业、严谨、值得信赖',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '品牌专家',
        price: 5000,
      },
      {
        id: 'financial-compliance-writing',
        name: '金融合规写作',
        level: 95,
        description: '必须包含风险提示、免责声明',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '法务专家',
        price: 15000,
      },
    ],
  },
  医疗: {
    A: [
      {
        id: 'medical-business-rules',
        name: '医疗业务规则',
        level: 95,
        description: '急诊最高优先级、患者隐私保护、医生确认',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '医疗管理专家',
        price: 20000,
      },
    ],
    B: [
      {
        id: 'medical-tech-stack',
        name: '医疗技术栈',
        level: 85,
        description: 'HL7, DICOM, 电子病历系统',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '医疗 IT 专家',
        price: 25000,
      },
      {
        id: 'medical-security',
        name: '医疗安全标准',
        level: 100,
        description: 'HIPAA 合规、患者数据保护',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '安全专家',
        price: 40000,
      },
    ],
    C: [
      {
        id: 'medical-channels',
        name: '医疗推广渠道',
        level: 60,
        description: '医院官网、医疗平台、医生推荐',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '医疗营销专家',
        price: 15000,
      },
    ],
    D: [
      {
        id: 'medical-brand-tone',
        name: '医疗品牌调性',
        level: 95,
        description: '专业、严谨、关怀、科学',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '品牌专家',
        price: 8000,
      },
      {
        id: 'medical-compliance-writing',
        name: '医疗合规写作',
        level: 100,
        description: '必须医学严谨、不承诺疗效',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '法务专家',
        price: 20000,
      },
    ],
  },
  自媒体: {
    A: [],
    B: [
      {
        id: 'wechat-article-format',
        name: '公众号文章格式化',
        level: 85,
        description: '将合规审核后的文章使用 wechat_article.html 模板进行格式化，适配公众号排版要求',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '公众号运营专家',
        price: 5000,
        tools: ['wechat-article-format-tool'],
      },
      {
        id: 'wechat-article-publish',
        name: '公众号文章发布',
        level: 90,
        description: '将格式化后的文章发布到微信公众号草稿箱',
        experience: 0,
        maxExperience: 100,
        type: 'domain',
        replicable: true,
        provider: '公众号运营专家',
        price: 8000,
        tools: ['wechat-draft-publish'],
      },
    ],
    C: [],
    D: [],
  },
};

/**
 * 能力配置接口
 */
export interface AgentCapabilityConfig {
  agentId: string;
  baseCapabilities: Skill[];
  domainCapabilities?: {
    domain: string;
    skills: Skill[];
  };
}

/**
 * 获取 Agent 的基础能力
 */
export function getBaseCapabilities(agentId: string): Skill[] {
  return BASE_CAPABILITIES[agentId] || [];
}

/**
 * 获取 Agent 的领域能力模板
 */
export function getDomainCapabilitiesTemplate(
  agentId: string,
  domain: string
): Skill[] {
  return DOMAIN_CAPABILITIES_TEMPLATES[domain]?.[agentId] || [];
}

/**
 * 组合基础能力和领域能力
 */
export function combineCapabilities(
  agentId: string,
  domain?: string
): Skill[] {
  const base = getBaseCapabilities(agentId);
  const domainSkills = domain ? getDomainCapabilitiesTemplate(agentId, domain) : [];

  return [...base, ...domainSkills];
}

/**
 * 计算能力可复制性
 */
export function calculateReplicability(agentId: string): {
  baseRatio: number;
  domainRatio: number;
  replicability: 'high' | 'medium' | 'low';
} {
  const base = getBaseCapabilities(agentId);
  const baseRatio = 100; // 所有基础能力都是可复制的

  const domainCount = Object.keys(DOMAIN_CAPABILITIES_TEMPLATES).reduce(
    (sum, domain) => {
      return sum + (DOMAIN_CAPABILITIES_TEMPLATES[domain][agentId]?.length || 0);
    },
    0
  );

  const domainRatio = domainCount > 0 ? (base.length / (base.length + domainCount)) * 100 : 100;

  let replicability: 'high' | 'medium' | 'low';
  if (domainRatio >= 70) {
    replicability = 'high';
  } else if (domainRatio >= 50) {
    replicability = 'medium';
  } else {
    replicability = 'low';
  }

  return {
    baseRatio,
    domainRatio,
    replicability,
  };
}

/**
 * 获取能力配置摘要
 */
export function getCapabilitiesSummary(agentId: string): {
  baseCapabilities: number;
  domainCapabilities: number;
  replicability: string;
  total: number;
} {
  const base = getBaseCapabilities(agentId);
  const baseCount = base.length;

  const domainCount = Object.keys(DOMAIN_CAPABILITIES_TEMPLATES).reduce(
    (sum, domain) => {
      return sum + (DOMAIN_CAPABILITIES_TEMPLATES[domain][agentId]?.length || 0);
    },
    0
  );

  const { replicability } = calculateReplicability(agentId);

  return {
    baseCapabilities: baseCount,
    domainCapabilities: domainCount,
    replicability,
    total: baseCount + domainCount,
  };
}
