/**
 * 新用户数据初始化服务
 * 
 * 注册时自动创建：
 * 1. 默认平台账号（微信公众号、小红书）
 * 2. 默认风格模板（10个：公众号6个 + 小红书/知乎/抖音/微博各1个）
 */

import { db } from '@/lib/db';
import { platformAccounts, styleTemplates } from '@/lib/db/schema/style-template';

/**
 * 默认平台账号配置
 */
const DEFAULT_ACCOUNTS = [
  {
    accountName: '公众号账号',
    platform: 'wechat_official' as const,
    platformLabel: '微信公众号',
  },
  {
    accountName: '小红书账号',
    platform: 'xiaohongshu' as const,
    platformLabel: '小红书',
  },
];

/**
 * 默认风格模板配置（所有平台）
 */
const DEFAULT_TEMPLATES = [
  // 微信公众号模板
  {
    name: '专业严谨',
    platform: 'wechat_official' as const,
    description: '专业、严谨、数据驱动的写作风格',
    isDefault: true,
  },
  {
    name: '避坑指南',
    platform: 'wechat_official' as const,
    description: '适合揭露骗局、提醒风险，语气严肃，案例具体',
    isDefault: false,
  },
  {
    name: '家庭故事',
    platform: 'wechat_official' as const,
    description: '适合温馨内容、情感共鸣，用真实案例打动人',
    isDefault: false,
  },
  {
    name: '数据对比',
    platform: 'wechat_official' as const,
    description: '适合产品评测、方案对比，数据密集，结构分明',
    isDefault: false,
  },
  {
    name: '口语分享',
    platform: 'wechat_official' as const,
    description: '适合轻松聊天、经验分享，接地气，像朋友对话',
    isDefault: false,
  },
  {
    name: '专业科普',
    platform: 'wechat_official' as const,
    description: '适合保险知识讲解、政策解读，逻辑清晰，数据准确',
    isDefault: false,
  },
  // 小红书模板
  {
    name: '小红书种草',
    platform: 'xiaohongshu' as const,
    description: '适合产品推荐、经验分享，风格亲切自然',
    isDefault: true,
  },
  // 知乎模板
  {
    name: '知乎干货',
    platform: 'zhihu' as const,
    description: '适合深度分析、专业解答，逻辑清晰',
    isDefault: true,
  },
  // 抖音模板
  {
    name: '抖音短视频',
    platform: 'douyin' as const,
    description: '适合短视频脚本，节奏快、吸引眼球',
    isDefault: true,
  },
  // 微博模板
  {
    name: '微博热点',
    platform: 'weibo' as const,
    description: '适合热点评论、资讯分享，简洁有力',
    isDefault: true,
  },
];

/**
 * 为新用户初始化默认数据
 * 
 * @param accountId - 用户账户ID
 * @param workspaceId - 工作空间ID
 */
export async function initializeUserData(
  accountId: string,
  workspaceId: string
): Promise<{ accountsCreated: number; templatesCreated: number }> {
  console.log(`[InitUserData] 开始初始化用户数据: accountId=${accountId}, workspaceId=${workspaceId}`);

  let accountsCreated = 0;
  let templatesCreated = 0;

  try {
    // 1. 创建默认平台账号
    for (const accountConfig of DEFAULT_ACCOUNTS) {
      await db.insert(platformAccounts).values({
        accountName: accountConfig.accountName,
        platform: accountConfig.platform,
        platformLabel: accountConfig.platformLabel,
        workspaceId,
        isActive: true,
      });
      accountsCreated++;
    }
    console.log(`[InitUserData] 创建了 ${accountsCreated} 个平台账号`);

    // 2. 创建默认风格模板
    for (const templateConfig of DEFAULT_TEMPLATES) {
      await db.insert(styleTemplates).values({
        name: templateConfig.name,
        description: templateConfig.description,
        platform: templateConfig.platform,
        workspaceId,
        isDefault: templateConfig.isDefault,
        isActive: true,
        ruleCount: 0,
        articleCount: 0,
      });
      templatesCreated++;
    }
    console.log(`[InitUserData] 创建了 ${templatesCreated} 个风格模板`);

    console.log(`[InitUserData] ✅ 初始化完成: ${accountsCreated} 个账号, ${templatesCreated} 个模板`);
    return { accountsCreated, templatesCreated };
  } catch (error) {
    console.error('[InitUserData] 初始化失败:', error);
    // 不抛出错误，避免影响注册流程
    return { accountsCreated, templatesCreated };
  }
}
