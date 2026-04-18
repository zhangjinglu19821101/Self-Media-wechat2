/**
 * 微信公众号配置文件
 * 用于配置 insurance-d 和 Agent D 对应的公众号信息
 */

export interface WechatDraftDefaults {
  // 作者
  author: string;
  
  // 原创声明
  isOriginal: 0 | 1;
  originalType?: number;
  
  // 评论设置
  needOpenComment: 0 | 1;
  onlyFansCanComment: 0 | 1;
  
  // 赞赏设置
  canReward: 0 | 1;
  
  // 封面设置
  showCoverPic: 0 | 1;
  
  // 合集设置（可选）
  defaultNewsId?: string;
  defaultNewsName?: string;
}

export interface WechatOfficialAccount {
  id: string;
  name: string;
  appId: string;
  appSecret: string;
  agent: 'insurance-d' | 'agent-d' | 'both';
  description: string;
  enabled: boolean;
  defaultAuthor?: string;
  defaultAuthorId?: number;
  createdAt: number;
  updatedAt: number;
  
  // 🔥 新增：草稿默认发布设置
  draftDefaults?: WechatDraftDefaults;
}

export interface WechatDraft {
  title: string;
  author?: string;
  digest?: string;
  content: string;
  content_source_url?: string;
  thumb_media_id?: string;
  need_open_comment?: 0 | 1;
  only_fans_can_comment?: 0 | 1;
  show_cover_pic?: 0 | 1;
}

export interface WechatDraftResponse {
  media_id: string;
  create_time: number;
}

/**
 * 默认公众号配置
 */
export const defaultWechatConfig: Record<string, WechatOfficialAccount> = {
  'insurance-account': {
    id: 'insurance-account',
    name: '保险科普公众号',
    appId: 'wxdb3ea2f8e0bb2496',  // 需要填写真实的 AppID
    appSecret: '0a5caa78cd7dbf3ce39639b24ff520e5',  // 需要填写真实的 AppSecret
    agent: 'insurance-d',
    description: 'insurance-d 对应的保险科普公众号',
    enabled: true,
    defaultAuthor: '智者足迹-探寻',
    defaultAuthorId: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    
    // 🔥 新增：默认发布配置
    draftDefaults: {
      author: '智者足迹-探寻',
      isOriginal: 1,              // 默认声明原创
      needOpenComment: 1,         // 默认开启评论
      onlyFansCanComment: 0,      // 默认所有人可评论
      canReward: 1,               // 默认开启赞赏
      showCoverPic: 0,            // 默认不显示封面
      defaultNewsId: undefined,   // 不加入合集（用户可配置）
      defaultNewsName: undefined,
    },
  },
  'ai-tech-account': {
    id: 'ai-tech-account',
    name: 'AI技术公众号',
    appId: 'wxf102f76f4a6e56b0',  // 需要填写真实的 AppID
    appSecret: 'e265a2ae8f2786749b6525caa7ce1252',  // 需要填写真实的 AppSecret
    agent: 'agent-d',
    description: 'Agent D 对应的 AI 技术公众号',
    enabled: true,
    defaultAuthor: 'AI技术',
    defaultAuthorId: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    
    // 🔥 新增：默认发布配置
    draftDefaults: {
      author: 'AI技术',
      isOriginal: 0,
      needOpenComment: 1,
      onlyFansCanComment: 0,
      canReward: 0,
      showCoverPic: 0,
      defaultNewsId: undefined,
      defaultNewsName: undefined,
    },
  },
};

/**
 * 获取 Agent 对应的公众号
 */
export function getAgentAccount(agent: 'insurance-d' | 'agent-d'): WechatOfficialAccount | undefined {
  const accounts = Object.values(defaultWechatConfig);
  return accounts.find(acc => acc.agent === agent || acc.agent === 'both');
}

/**
 * 根据 ID 获取公众号
 */
export function getAccountById(accountId: string): WechatOfficialAccount | undefined {
  return defaultWechatConfig[accountId];
}

/**
 * 获取所有启用的公众号
 */
export function getEnabledAccounts(): WechatOfficialAccount[] {
  return Object.values(defaultWechatConfig).filter(acc => acc.enabled);
}

/**
 * 获取 Agent 的所有公众号
 */
export function getAgentAccounts(agent: 'insurance-d' | 'agent-d'): WechatOfficialAccount[] {
  return Object.values(defaultWechatConfig).filter(
    acc => acc.agent === agent || acc.agent === 'both'
  );
}

/**
 * 智能匹配公众号
 *
 * 匹配优先级：
 * 1. 如果提供了 accountId，精确匹配
 * 2. 如果提供了 agent，获取该 agent 的默认账号
 * 3. 如果都没有提供，返回 undefined（需要调用方列出可用账号）
 *
 * @param options 匹配选项
 * @returns 匹配到的公众号，或 undefined
 */
export function matchAccount(options: {
  accountId?: string;
  agent?: 'insurance-d' | 'agent-d';
}): WechatOfficialAccount | undefined {
  const { accountId, agent } = options;

  // 优先级 1：通过 accountId 精确匹配
  if (accountId) {
    const account = getAccountById(accountId);
    if (account && account.enabled) {
      return account;
    }
  }

  // 优先级 2：通过 agent 类型获取默认账号
  if (agent) {
    const account = getAgentAccount(agent);
    if (account && account.enabled) {
      return account;
    }
  }

  // 都没有提供或匹配失败
  return undefined;
}

/**
 * 列出所有可用的公众号
 *
 * @param agent 可选，只列出指定 agent 的账号
 * @returns 可用账号列表
 */
export function listAvailableAccounts(agent?: 'insurance-d' | 'agent-d'): Array<{
  id: string;
  name: string;
  agent: 'insurance-d' | 'agent-d' | 'both';
  description: string;
}> {
  let accounts = getEnabledAccounts();

  // 如果指定了 agent，过滤
  if (agent) {
    accounts = accounts.filter(acc => acc.agent === agent || acc.agent === 'both');
  }

  // 返回简化的账号信息
  return accounts.map(acc => ({
    id: acc.id,
    name: acc.name,
    agent: acc.agent,
    description: acc.description,
  }));
}

/**
 * 🔥 获取公众号的默认发布配置
 * 
 * @param accountId 公众号ID
 * @returns 默认发布配置，如果不存在则返回系统默认值
 */
export function getDraftDefaults(accountId?: string): WechatDraftDefaults {
  const account = accountId ? getAccountById(accountId) : undefined;
  
  if (account?.draftDefaults) {
    return account.draftDefaults;
  }
  
  // 系统默认值
  return {
    author: account?.defaultAuthor || '原创',
    isOriginal: 0,
    needOpenComment: 1,
    onlyFansCanComment: 0,
    canReward: 0,
    showCoverPic: 0,
    defaultNewsId: undefined,
    defaultNewsName: undefined,
  };
}

/**
 * 微信公众号 API 配置
 */
export const WECHAT_API_CONFIG = {
  baseUrl: 'https://api.weixin.qq.com/cgi-bin',
  tokenCacheTime: 7200,  // access_token 缓存时间（秒）
  apiTimeout: 30000,  // API 超时时间（毫秒）
};
