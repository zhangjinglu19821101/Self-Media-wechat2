/**
 * 微信公众号配置模块
 * 用于管理 Agent D 和 Agent insurance-d 的微信公众号发布能力
 */

import { AgentId } from './agent-types';

/**
 * 微信公众号信息
 */
export interface WechatOfficialAccount {
  id: string;              // 内部配置ID
  accountId: string;       // 公众号原始ID (gh_xxxxx)
  name: string;            // 公众号名称
  appId: string;           // 微信 AppID
  appSecret: string;       // 微信 AppSecret
  accessToken?: string;    // 访问令牌（自动获取）
  tokenExpireTime?: Date;  // 令牌过期时间
  agents: AgentId[];       // 可使用的 Agent 列表
  permissions: {
    canPublish: boolean;   // 是否可发布
    canDraft: boolean;     // 是否可存草稿
    canDelete: boolean;    // 是否可删除
  };
}

/**
 * 公众号发布结果
 */
export interface WechatPublishResult {
  success: boolean;
  accountId: string;
  articleId?: string;      // 文章ID（发布成功后返回）
  mediaId?: string;        // 素材ID
  publishUrl?: string;     // 文章链接
  error?: string;
  timestamp: Date;
}

/**
 * 获取 Agent 可使用的公众号列表
 */
export function getAgentAccounts(agentId: AgentId): WechatOfficialAccount[] {
  const config = getWechatConfig();
  return config.filter(account => account.agents.includes(agentId));
}

/**
 * 获取指定公众号信息
 */
export function getAccountById(accountId: string): WechatOfficialAccount | null {
  const config = getWechatConfig();
  return config.find(acc => acc.accountId === accountId) || null;
}

/**
 * 验证 Agent 是否有权使用指定公众号
 */
export function validateAgentPermission(
  agentId: AgentId,
  accountId: string,
  action: 'publish' | 'draft' | 'delete'
): boolean {
  const account = getAccountById(accountId);
  if (!account) {
    return false;
  }

  // 检查 Agent 是否有权限访问该公众号
  if (!account.agents.includes(agentId)) {
    return false;
  }

  // 检查具体操作权限
  switch (action) {
    case 'publish':
      return account.permissions.canPublish;
    case 'draft':
      return account.permissions.canDraft;
    case 'delete':
      return account.permissions.canDelete;
    default:
      return false;
  }
}

/**
 * 获取微信公众号配置
 * 从环境变量中读取配置
 */
export function getWechatConfig(): WechatOfficialAccount[] {
  try {
    const envConfig = process.env.WECHAT_OFFICIAL_ACCOUNTS_JSON;

    if (!envConfig) {
      console.warn('WECHAT_OFFICIAL_ACCOUNTS_JSON 环境变量未配置，公众号功能不可用');
      return [];
    }

    const config = JSON.parse(envConfig);
    return config as WechatOfficialAccount[];
  } catch (error) {
    console.error('解析微信公众号配置失败:', error);
    return [];
  }
}

/**
 * 格式化微信公众号配置信息（用于 Agent 提示词）
 */
export function formatWechatConfigForAgent(agentId: AgentId): string {
  const accounts = getAgentAccounts(agentId);

  if (accounts.length === 0) {
    return '当前未配置可用的微信公众号，无法执行发布任务。';
  }

  let result = '你可以使用的微信公众号列表：\n\n';

  accounts.forEach((account, index) => {
    result += `${index + 1}. ${account.name}\n`;
    result += `   - 公众号ID: ${account.accountId}\n`;
    result += `   - AppID: ${account.appId}\n`;
    result += `   - 权限: ${account.permissions.canPublish ? '✅ 可发布' : '❌ 不可发布'}, `;
    result += `${account.permissions.canDraft ? '✅ 可存草稿' : '❌ 不可存草稿'}, `;
    result += `${account.permissions.canDelete ? '✅ 可删除' : '❌ 不可删除'}\n\n`;
  });

  result += '\n使用说明：\n';
  result += '- 发布文章时，需要指定目标公众号的 ID\n';
  result += '- 确保你有该公众号的发布权限\n';
  result += '- 文章发布后会返回文章 ID 和访问链接';

  return result;
}

/**
 * 微信公众号 API 接口配置
 * （后续根据实际需求补充）
 */
export const WechatAPI = {
  // 获取 access_token
  getAccessToken: 'https://api.weixin.qq.com/cgi-bin/token',
  // 上传素材
  uploadMedia: 'https://api.weixin.qq.com/cgi-bin/media/upload',
  // 新增永久素材
  addMaterial: 'https://api.weixin.qq.com/cgi-bin/material/add_material',
  // 新增永久图文素材
  addNews: 'https://api.weixin.qq.com/cgi-bin/material/add_news',
  // 发布图文消息
  publish: 'https://api.weixin.qq.com/cgi-bin/freepublish/submit',
  // 删除永久素材
  delMaterial: 'https://api.weixin.qq.com/cgi-bin/material/del_material',
  // 获取草稿
  getDraft: 'https://api.weixin.qq.com/cgi-bin/draft/get',
  // 保存草稿
  addDraft: 'https://api.weixin.qq.com/cgi-bin/draft/add',
  // 删除草稿
  delDraft: 'https://api.weixin.qq.com/cgi-bin/draft/delete',
};

/**
 * 发布文章到公众号（模拟接口，后续需要接入真实微信 API）
 */
export async function publishArticleToWechat(
  accountId: string,
  articleData: {
    title: string;
    content: string;
    author?: string;
    digest?: string;
    coverUrl?: string;
    showCoverPic?: boolean;
  }
): Promise<WechatPublishResult> {
  try {
    // 验证公众号是否存在
    const account = getAccountById(accountId);
    if (!account) {
      return {
        success: false,
        accountId,
        error: '公众号不存在或未配置',
        timestamp: new Date(),
      };
    }

    // TODO: 接入真实的微信公众号 API
    // 1. 获取 access_token
    // 2. 上传封面图片（如果有）
    // 3. 创建图文素材
    // 4. 发布文章

    // 模拟返回
    console.log(`[模拟] 发布文章到公众号 ${account.name}`, {
      title: articleData.title,
      accountId,
    });

    return {
      success: true,
      accountId,
      articleId: `article_${Date.now()}`,
      mediaId: `media_${Date.now()}`,
      publishUrl: `https://mp.weixin.qq.com/s/mock_${Date.now()}`,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('发布文章到公众号失败:', error);
    return {
      success: false,
      accountId,
      error: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date(),
    };
  }
}

/**
 * 保存文章为草稿
 */
export async function saveDraftToWechat(
  accountId: string,
  articleData: {
    title: string;
    content: string;
    author?: string;
    digest?: string;
    coverUrl?: string;
  }
): Promise<WechatPublishResult> {
  try {
    // 验证公众号是否存在
    const account = getAccountById(accountId);
    if (!account) {
      return {
        success: false,
        accountId,
        error: '公众号不存在或未配置',
        timestamp: new Date(),
      };
    }

    // TODO: 接入真实的微信公众号 API
    console.log(`[模拟] 保存草稿到公众号 ${account.name}`, {
      title: articleData.title,
      accountId,
    });

    return {
      success: true,
      accountId,
      mediaId: `draft_${Date.now()}`,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('保存草稿失败:', error);
    return {
      success: false,
      accountId,
      error: error instanceof Error ? error.message : '未知错误',
      timestamp: new Date(),
    };
  }
}
