/**
 * 风格模板学习配置文件
 * 用于配置 insurance-d 和 Agent D 的学习文章来源
 */

export interface ArticleSource {
  id: string;
  type: 'url' | 'file' | 'directory';
  path: string;
  agent: 'insurance-d' | 'agent-d' | 'both';
  category: string;
  description: string;
  enabled: boolean;
  lastUpdated?: number;
  metadata?: Record<string, any>;
}

export interface StyleLearningConfig {
  insuranceD: {
    sources: ArticleSource[];
    autoLearnEnabled: boolean;
    autoLearnSchedule: string; // cron expression
    maxArticlesPerLearn: number;
  };
  agentD: {
    sources: ArticleSource[];
    autoLearnEnabled: boolean;
    autoLearnSchedule: string;
    maxArticlesPerLearn: number;
  };
  defaultSettings: {
    minArticleCount: number;
    confidenceThreshold: number;
    autoUpdateInterval: number; // hours
  };
}

/**
 * 默认配置
 */
export const defaultStyleLearningConfig: StyleLearningConfig = {
  insuranceD: {
    sources: [
      {
        id: 'insurance-sample-1',
        type: 'file',
        path: './articles/insurance/sample1.txt',
        agent: 'insurance-d',
        category: '保险科普',
        description: '保险科普示例文章1',
        enabled: true,
      },
      {
        id: 'insurance-sample-2',
        type: 'file',
        path: './articles/insurance/sample2.txt',
        agent: 'insurance-d',
        category: '保险科普',
        description: '保险科普示例文章2',
        enabled: true,
      },
    ],
    autoLearnEnabled: false,
    autoLearnSchedule: '0 2 * * *', // 每天凌晨2点
    maxArticlesPerLearn: 10,
  },
  agentD: {
    sources: [
      {
        id: 'ai-tech-sample-1',
        type: 'file',
        path: './articles/ai-tech/sample1.txt',
        agent: 'agent-d',
        category: 'AI技术',
        description: 'AI技术示例文章1',
        enabled: true,
      },
      {
        id: 'ai-tech-sample-2',
        type: 'file',
        path: './articles/ai-tech/sample2.txt',
        agent: 'agent-d',
        category: 'AI技术',
        description: 'AI技术示例文章2',
        enabled: true,
      },
    ],
    autoLearnEnabled: false,
    autoLearnSchedule: '0 3 * * *', // 每天凌晨3点
    maxArticlesPerLearn: 10,
  },
  defaultSettings: {
    minArticleCount: 3,
    confidenceThreshold: 0.7,
    autoUpdateInterval: 24,
  },
};

/**
 * 配置文件路径（实际使用时替换为真实路径）
 */
export const CONFIG_PATHS = {
  insuranceDArticles: './data/articles/insurance-d',
  agentDArticles: './data/articles/agent-d',
  insuranceDConfig: './config/style-learning/insurance-d.json',
  agentDConfig: './config/style-learning/agent-d.json',
};

/**
 * 支持的 URL 来源
 */
export const SUPPORTED_URL_PATTERNS = {
  wechat: /mp\.weixin\.qq\.com/,
  juejin: /juejin\.cn/,
  zhihu: /zhihu\.com/,
  csdn: /csdn\.net/,
  github: /github\.com/,
  custom: /.*/, // 自定义 URL
};

/**
 * 支持的文件类型
 */
export const SUPPORTED_FILE_TYPES = [
  '.txt',
  '.md',
  '.json',
  '.html',
];

/**
 * 获取 Agent 的配置
 */
export function getAgentConfig(agent: 'insurance-d' | 'agent-d' | 'insurance-xiaohongshu' | 'insurance-zhihu' | 'insurance-toutiao' | 'deai-optimizer') {
  if (agent === 'insurance-xiaohongshu' || agent === 'insurance-zhihu' || agent === 'insurance-toutiao' || agent === 'deai-optimizer') {
    // 小红书/知乎/头条/去AI化优化 复用 insurance-d 的配置（风格学习通过 style-deposition-service 按模板维度隔离）
    return defaultStyleLearningConfig.insuranceD;
  }
  return agent === 'insurance-d'
    ? defaultStyleLearningConfig.insuranceD
    : defaultStyleLearningConfig.agentD;
}

/**
 * 获取 Agent 的文章路径
 */
export function getAgentArticlesPath(agent: 'insurance-d' | 'agent-d' | 'insurance-xiaohongshu' | 'insurance-zhihu' | 'insurance-toutiao' | 'deai-optimizer') {
  if (agent === 'insurance-xiaohongshu' || agent === 'insurance-zhihu' || agent === 'insurance-toutiao' || agent === 'deai-optimizer') {
    return CONFIG_PATHS.insuranceDArticles;
  }
  return agent === 'insurance-d'
    ? CONFIG_PATHS.insuranceDArticles
    : CONFIG_PATHS.agentDArticles;
}
