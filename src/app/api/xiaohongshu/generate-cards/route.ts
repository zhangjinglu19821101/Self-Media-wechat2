/**
 * 小红书卡片生成 API
 * 
 * POST /api/xiaohongshu/generate-cards
 * 
 * 根据文章内容生成小红书风格的图片卡片
 * 
 * 安全说明：
 * - 此接口消耗 CPU/内存（@napi-rs/canvas 渲染），需要认证保护
 * - 支持 x-internal-token（后端 Agent 调用）和用户 session（前端调用）两种认证方式
 * - 限制单次最多生成 10 张卡片，防止资源滥用
 * 
 * 持久化存储：
 * - 当 persist=true 时，生成的卡片会上传到对象存储
 * - 返回持久化的 signedUrl（有效期 7 天）
 * - 数据库记录 storageKey，支持后续动态生成签名 URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import {
  generateCardsFromArticle,
  generateXiaohongshuCard,
  type CardContent,
  type GradientScheme,
  type ImageCountMode,
} from '@/lib/services/xiaohongshu-card-service';
import {
  uploadXhsCardGroup,
  getCardGroupUrlsBySubTaskId,
} from '@/lib/services/xhs-storage-service';

// 内部 API Token（与 middleware.ts 保持一致）
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07';

// 安全限制
const MAX_CARDS_PER_REQUEST = 10;   // 单次最大卡片数
const MAX_POINTS_PER_ARTICLE = 7;  // 单篇文章最大要点数

// 有效的卡片数量模式
const VALID_CARD_COUNT_MODES = ['3-card', '5-card', '7-card'] as const;
type CardCountMode = typeof VALID_CARD_COUNT_MODES[number];

// 输入校验：subTaskId 格式
function isValidSubTaskId(subTaskId: string): boolean {
  // 允许字母、数字、短横、下划线，长度 1-100
  return /^[\w-]{1,100}$/.test(subTaskId);
}

// 类型守卫：校验 cardCountMode
function isValidCardCountMode(mode: string): mode is CardCountMode {
  return VALID_CARD_COUNT_MODES.includes(mode as CardCountMode);
}

export async function POST(request: NextRequest) {
  // ========== 认证校验 ==========
  let workspaceId: string | undefined;
  
  // 方式1：内部 token（后端服务调用）
  const internalToken = request.headers.get('x-internal-token');
  if (internalToken === INTERNAL_API_TOKEN) {
    // 内部调用，从请求体获取 workspaceId
    const body = await request.clone().json();
    workspaceId = body.workspaceId;
  } else {
    // 方式2：用户 session 认证（前端调用）
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    workspaceId = getWorkspaceId(request);
  }

  try {
    const body = await request.json();
    const { 
      mode = 'article', 
      gradientScheme = 'pinkOrange',
      persist = false,          // 是否持久化存储
      subTaskId,               // 子任务 ID（持久化时必需）
      commandResultId,         // 指令结果 ID（可选）
      cardCountMode = '5-card', // 卡片数量模式
      imageCountMode,          // 兼容旧参数名
    } = body;

    // 统一使用 cardCountMode（兼容旧参数）
    const rawCardCountMode = cardCountMode || imageCountMode || '5-card';
    // P1 修复：类型守卫校验 cardCountMode
    const finalCardCountMode: CardCountMode = isValidCardCountMode(rawCardCountMode) 
      ? rawCardCountMode 
      : '5-card';

    if (mode === 'article') {
      // 从文章生成卡片组
      const { title, intro, points, conclusion, tags, author } = body;

      if (!title || !points || !Array.isArray(points) || points.length === 0) {
        return NextResponse.json(
          { error: '缺少必要字段：title, points' },
          { status: 400 }
        );
      }

      // 安全校验：限制要点数量
      if (points.length > MAX_POINTS_PER_ARTICLE) {
        return NextResponse.json(
          { error: `要点数量超出限制，最多支持 ${MAX_POINTS_PER_ARTICLE} 个` },
          { status: 400 }
        );
      }

      // P1 修复：持久化时校验 subTaskId 格式
      if (persist) {
        if (!subTaskId) {
          return NextResponse.json(
            { error: '持久化存储时 subTaskId 为必填字段' },
            { status: 400 }
          );
        }
        if (!isValidSubTaskId(subTaskId)) {
          return NextResponse.json(
            { error: 'subTaskId 格式无效，仅允许字母、数字、短横、下划线，长度 1-100' },
            { status: 400 }
          );
        }
      }

      // 生成卡片
      const cards = await generateCardsFromArticle(
        {
          title,
          intro,
          points: points.slice(0, MAX_POINTS_PER_ARTICLE),
          conclusion: conclusion || '感谢阅读',
          tags: tags || [],
          author,
        },
        gradientScheme as GradientScheme,
        finalCardCountMode as ImageCountMode
      );

      // 持久化存储
      if (persist && subTaskId) {
        // 🔥 P1修复：边界情况处理，确保至少有封面和结尾两张卡
        if (cards.length < 2) {
          return NextResponse.json(
            { error: `卡片数量不足：生成 ${cards.length} 张，至少需要 2 张（封面+结尾）` },
            { status: 400 }
          );
        }
        
        // 确定卡片类型
        const cardTypes: Array<'cover' | 'point' | 'ending'> = ['cover'];
        const pointCount = cards.length - 2; // 减去封面和结尾
        for (let i = 0; i < pointCount; i++) {
          cardTypes.push('point');
        }
        cardTypes.push('ending');

        // 上传到对象存储
        const uploadResult = await uploadXhsCardGroup(
          cards.map((card, index) => ({
            base64: card.base64,
            cardType: cardTypes[index] || 'point',  // 🔥 P1修复：添加兜底逻辑防止越界
            title: index === 0 ? title : (index === cards.length - 1 ? conclusion : points[index - 1]?.title),
            content: index === 0 ? intro : (index === cards.length - 1 ? tags?.join(' ') : points[index - 1]?.content),
          })),
          subTaskId,
          {
            cardCountMode: finalCardCountMode,  // P1 修复：已通过类型守卫校验，无需断言
            gradientScheme,
            articleTitle: title,
            articleIntro: intro,
            workspaceId,
            commandResultId,
          }
        );

        console.log(`[Xiaohongshu Card API] 持久化存储成功: groupId=${uploadResult.groupId}, totalCards=${uploadResult.totalCards}`);

        return NextResponse.json({
          success: true,
          persisted: true,
          groupId: uploadResult.groupId,
          cards: uploadResult.cards.map((card, index) => ({
            index,
            cardId: card.cardId,
            storageKey: card.storageKey,
            url: card.signedUrl,  // 持久化 URL（有效期 7 天）
            width: card.width,
            height: card.height,
          })),
          totalCount: uploadResult.totalCards,
        });
      }

      // 非持久化模式：返回 base64（用于即时预览）
      return NextResponse.json({
        success: true,
        persisted: false,
        cards: cards.slice(0, MAX_CARDS_PER_REQUEST).map((card, index) => ({
          index,
          base64: card.base64,
          width: card.width,
          height: card.height,
        })),
        totalCount: Math.min(cards.length, MAX_CARDS_PER_REQUEST),
      });
    } else if (mode === 'single') {
      // 生成单张卡片
      const { cardContent } = body as { cardContent: CardContent };

      if (!cardContent || !cardContent.type) {
        return NextResponse.json(
          { error: '缺少 cardContent 或 type 字段' },
          { status: 400 }
        );
      }

      const card = await generateXiaohongshuCard(cardContent);

      // 单张卡片暂不支持持久化（通常用于预览）
      return NextResponse.json({
        success: true,
        persisted: false,
        card: {
          base64: card.base64,
          width: card.width,
          height: card.height,
        },
      });
    } else {
      return NextResponse.json(
        { error: '无效的 mode，支持 article 或 single' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Xiaohongshu Card API] Error:', error);
    return NextResponse.json(
      { error: '卡片生成失败', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET 接口：获取已持久化的卡片 URL
 * 
 * 查询参数：
 * - subTaskId: 子任务 ID
 * - workspaceId: 工作空间 ID（内部调用时必需）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subTaskId = searchParams.get('subTaskId');
  const queryWorkspaceId = searchParams.get('workspaceId');

  // 如果提供了 subTaskId，返回持久化的卡片 URL
  if (subTaskId) {
    // P1 修复：校验 subTaskId 格式
    if (!isValidSubTaskId(subTaskId)) {
      return NextResponse.json({
        success: false,
        error: 'subTaskId 格式无效',
      }, { status: 400 });
    }
    
    try {
      // 认证校验 + 获取 workspaceId
      let workspaceId: string | undefined;
      const internalToken = request.headers.get('x-internal-token');
      if (internalToken !== INTERNAL_API_TOKEN) {
        const authResult = await requireAuth(request);
        if (authResult instanceof NextResponse) return authResult;
        workspaceId = getWorkspaceId(request);
      } else {
        // P0 修复：内部调用时从 URL 参数获取 workspaceId
        workspaceId = queryWorkspaceId || undefined;
      }

      // P0 修复：传递 workspaceId 进行权限隔离
      const cards = await getCardGroupUrlsBySubTaskId(subTaskId, 604800, workspaceId);

      if (cards.length === 0) {
        return NextResponse.json({
          success: false,
          error: '未找到该子任务的卡片记录',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        subTaskId,
        cards: cards.map(card => ({
          cardId: card.cardId,
          cardIndex: card.cardIndex,
          cardType: card.cardType,
          url: card.signedUrl,
          title: card.titleSnapshot,
        })),
        totalCount: cards.length,
      });
    } catch (error) {
      console.error('[Xiaohongshu Card API] GET Error:', error);
      return NextResponse.json({
        success: false,
        error: '获取卡片 URL 失败',
        message: error instanceof Error ? error.message : String(error),
      }, { status: 500 });
    }
  }

  // 默认返回 API 说明
  return NextResponse.json({
    name: '小红书卡片生成 API',
    authentication: '需要 x-internal-token 或用户 session 认证',
    limits: {
      maxCardsPerRequest: MAX_CARDS_PER_REQUEST,
      maxPointsPerArticle: MAX_POINTS_PER_ARTICLE,
    },
    endpoints: {
      'POST /api/xiaohongshu/generate-cards': {
        description: '生成小红书风格图片卡片',
        modes: {
          article: '从文章内容生成完整卡片组（封面+要点+结尾）',
          single: '生成单张卡片',
        },
        parameters: {
          mode: { type: 'string', default: 'article', enum: ['article', 'single'] },
          gradientScheme: {
            type: 'string',
            default: 'pinkOrange',
            enum: ['pinkOrange', 'bluePurple', 'tealGreen', 'orangeYellow', 'deepBlue', 'coralPink'],
          },
          persist: { type: 'boolean', default: false, description: '是否持久化存储到对象存储' },
          subTaskId: { type: 'string', description: '子任务 ID（持久化时必需）' },
          workspaceId: { type: 'string', description: '工作空间 ID（内部调用时使用）' },
          cardCountMode: { 
            type: 'string', 
            default: '5-card', 
            enum: ['3-card', '5-card', '7-card'],
            description: '卡片数量模式（3-card=极简，5-card=标准，7-card=详细）',
          },
          // article 模式
          title: { type: 'string', description: '文章标题' },
          intro: { type: 'string', description: '引言/副标题' },
          points: { type: 'array', description: `要点数组 [{title, content}]，最多${MAX_POINTS_PER_ARTICLE}个` },
          conclusion: { type: 'string', description: '结语' },
          tags: { type: 'array', description: '话题标签' },
          author: { type: 'string', description: '作者名' },
          // single 模式
          cardContent: { type: 'object', description: '卡片内容，type: cover/point/ending' },
        },
      },
      'GET /api/xiaohongshu/generate-cards?subTaskId=xxx': {
        description: '获取已持久化的卡片 URL',
        parameters: {
          subTaskId: { type: 'string', description: '子任务 ID' },
        },
      },
    },
    example: {
      mode: 'article',
      title: '我已经不卖重疾险了，但我能告诉你真相',
      intro: '今天我想卸下保险销售的面具',
      points: [
        { title: '别把重疾险当医药费报销', content: '重疾险赔的钱是收入损失，不是医疗费' },
        { title: '别迷信病种数量', content: '28种重疾已覆盖95%理赔，关注赔付宽松度更实际' },
      ],
      conclusion: '希望这些真相能帮你少踩坑',
      tags: ['保险', '重疾险'],
      gradientScheme: 'pinkOrange',
      persist: true,
      subTaskId: 'task-xxx',
      cardCountMode: '5-card',
    },
  });
}
