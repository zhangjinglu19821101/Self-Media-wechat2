/**
 * 新用户数据初始化服务
 * 
 * 注册时自动创建：
 * 1. 默认平台账号（微信公众号、小红书）
 * 2. 默认风格模板（10个：公众号6个 + 小红书/知乎/抖音/微博各1个）
 * 3. 默认小红书内容模板（4个：3卡简洁/5卡标准/5卡详尽/7卡深度）
 */

import { db } from '@/lib/db';
import { platformAccounts, styleTemplates } from '@/lib/db/schema/style-template';
import { contentTemplates } from '@/lib/db/schema/content-template';

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
 * 默认小红书内容模板配置
 */
const DEFAULT_CONTENT_TEMPLATES = [
  {
    name: '3卡-简洁风',
    cardCountMode: '3-card' as const,
    densityStyle: 'minimal' as const,
    description: '封面 + 1个要点 + 结尾，信息极简，适合快速阅读',
    promptInstruction: '3卡极简模式：封面+1要点+结尾，每卡仅标题，信息高度浓缩',
    details: {
      cardExamples: [
        { cardType: 'cover' as const, imageText: '大标题\n核心标签\n副标题', textLength: 'title_only' as const, styleDescription: '大标题居中，核心标签醒目' },
        { cardType: 'point' as const, imageText: '核心要点\n关键词标注', textLength: 'title_only' as const, styleDescription: '单一要点，仅标题' },
        { cardType: 'ending' as const, imageText: '总结\n行动号召', textLength: 'title_only' as const, styleDescription: '简洁结尾，引导行动' },
      ],
      structure: { cardCountMode: '3-card' as const, densityStyle: 'minimal' as const, description: '极简3卡模式', confidence: 1.0 },
      divisionRule: { imageOnly: ['标题、标签、关键词'], textOnly: ['背景说明、详细解释'] },
      textStyleDescription: '正文极简，直击要点',
    },
  },
  {
    name: '5卡-标准风',
    cardCountMode: '5-card' as const,
    densityStyle: 'concise' as const,
    description: '封面 + 3个要点 + 结尾，标题+短文，信息适中',
    promptInstruction: '5卡标准模式：封面+3要点+结尾，每卡标题+1行内容（约50字），信息适中',
    details: {
      cardExamples: [
        { cardType: 'cover' as const, imageText: '大标题\n核心标签\n副标题', textLength: 'short' as const, styleDescription: '大标题居左，标签醒目' },
        { cardType: 'point' as const, imageText: '要点标题\n关键信息（1行）', textLength: 'short' as const, styleDescription: '标题+1行内容，约50字' },
        { cardType: 'point' as const, imageText: '要点标题\n关键信息（1行）', textLength: 'short' as const, styleDescription: '标题+1行内容，约50字' },
        { cardType: 'point' as const, imageText: '要点标题\n关键信息（1行）', textLength: 'short' as const, styleDescription: '标题+1行内容，约50字' },
        { cardType: 'ending' as const, imageText: '总结\n行动号召', textLength: 'short' as const, styleDescription: '简洁结尾' },
      ],
      structure: { cardCountMode: '5-card' as const, densityStyle: 'concise' as const, description: '标准5卡模式', confidence: 1.0 },
      divisionRule: { imageOnly: ['标题、标签、关键数据'], textOnly: ['背景故事、详细解释'] },
      textStyleDescription: '正文简洁，分点清晰',
    },
  },
  {
    name: '5卡-详尽风',
    cardCountMode: '5-card' as const,
    densityStyle: 'detailed' as const,
    description: '封面 + 3个要点 + 结尾，标题+多行内容，信息丰富',
    promptInstruction: '5卡详尽模式：封面+3要点+结尾，每卡标题+多行内容（约100字），信息丰富详尽',
    details: {
      cardExamples: [
        { cardType: 'cover' as const, imageText: '大标题\n核心标签\n副标题\n补充信息', textLength: 'standard' as const, styleDescription: '大标题居左，标签醒目，有补充信息' },
        { cardType: 'point' as const, imageText: '要点标题\n关键信息\n补充说明\n数据支撑', textLength: 'detailed' as const, styleDescription: '标题+多行内容，约100字' },
        { cardType: 'point' as const, imageText: '要点标题\n关键信息\n补充说明', textLength: 'detailed' as const, styleDescription: '标题+多行内容，约100字' },
        { cardType: 'point' as const, imageText: '要点标题\n关键信息\n补充说明', textLength: 'detailed' as const, styleDescription: '标题+多行内容，约100字' },
        { cardType: 'ending' as const, imageText: '总结\n行动号召\n补充说明', textLength: 'standard' as const, styleDescription: '详尽结尾，有补充信息' },
      ],
      structure: { cardCountMode: '5-card' as const, densityStyle: 'detailed' as const, description: '详尽5卡模式', confidence: 1.0 },
      divisionRule: { imageOnly: ['标题、标签、关键数据、图标'], textOnly: ['背景故事、详细解释、案例'] },
      textStyleDescription: '正文详尽，信息丰富，有数据支撑',
    },
  },
  {
    name: '7卡-深度风',
    cardCountMode: '7-card' as const,
    densityStyle: 'standard' as const,
    description: '封面 + 5个要点 + 结尾，内容深度解析',
    promptInstruction: '7卡深度模式：封面+5要点+结尾，每卡标题+1-2行内容，深度解析',
    details: {
      cardExamples: [
        { cardType: 'cover' as const, imageText: '大标题\n核心标签\n副标题', textLength: 'short' as const, styleDescription: '大标题居中，标签醒目' },
        { cardType: 'point' as const, imageText: '要点1标题\n关键信息', textLength: 'standard' as const, styleDescription: '标题+1-2行内容' },
        { cardType: 'point' as const, imageText: '要点2标题\n关键信息', textLength: 'standard' as const, styleDescription: '标题+1-2行内容' },
        { cardType: 'point' as const, imageText: '要点3标题\n关键信息', textLength: 'standard' as const, styleDescription: '标题+1-2行内容' },
        { cardType: 'point' as const, imageText: '要点4标题\n关键信息', textLength: 'standard' as const, styleDescription: '标题+1-2行内容' },
        { cardType: 'point' as const, imageText: '要点5标题\n关键信息', textLength: 'standard' as const, styleDescription: '标题+1-2行内容' },
        { cardType: 'ending' as const, imageText: '总结\n行动号召', textLength: 'standard' as const, styleDescription: '深度结尾' },
      ],
      structure: { cardCountMode: '7-card' as const, densityStyle: 'standard' as const, description: '深度7卡模式', confidence: 1.0 },
      divisionRule: { imageOnly: ['标题、标签、关键数据'], textOnly: ['背景故事、详细解释、案例分析'] },
      textStyleDescription: '正文深度，逻辑清晰，要点全面',
    },
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
): Promise<{ accountsCreated: number; templatesCreated: number; contentTemplatesCreated: number }> {
  console.log(`[InitUserData] 开始初始化用户数据: accountId=${accountId}, workspaceId=${workspaceId}`);

  let accountsCreated = 0;
  let templatesCreated = 0;
  let contentTemplatesCreated = 0;

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

    // 3. 创建默认小红书内容模板
    for (const contentTemplateConfig of DEFAULT_CONTENT_TEMPLATES) {
      await db.insert(contentTemplates).values({
        name: contentTemplateConfig.name,
        description: contentTemplateConfig.description,
        platform: 'xiaohongshu',
        workspaceId,
        cardCountMode: contentTemplateConfig.cardCountMode,
        densityStyle: contentTemplateConfig.densityStyle,
        promptInstruction: contentTemplateConfig.promptInstruction,
        details: contentTemplateConfig.details,
        sourceType: 'system_default',
        isActive: true,
      });
      contentTemplatesCreated++;
    }
    console.log(`[InitUserData] 创建了 ${contentTemplatesCreated} 个内容模板`);

    console.log(`[InitUserData] ✅ 初始化完成: ${accountsCreated} 个账号, ${templatesCreated} 个风格模板, ${contentTemplatesCreated} 个内容模板`);
    return { accountsCreated, templatesCreated, contentTemplatesCreated };
  } catch (error) {
    console.error('[InitUserData] 初始化失败:', error);
    // 不抛出错误，避免影响注册流程
    return { accountsCreated, templatesCreated, contentTemplatesCreated };
  }
}
