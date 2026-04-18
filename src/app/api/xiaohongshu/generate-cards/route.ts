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
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import {
  generateCardsFromArticle,
  generateXiaohongshuCard,
  type CardContent,
  type GradientScheme,
} from '@/lib/services/xiaohongshu-card-service';

// 内部 API Token（与 middleware.ts 保持一致）
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07';

// 安全限制
const MAX_CARDS_PER_REQUEST = 10;   // 单次最大卡片数
const MAX_POINTS_PER_ARTICLE = 7;  // 单篇文章最大要点数

export async function POST(request: NextRequest) {
  // ========== 认证校验 ==========
  // 方式1：内部 token（后端服务调用）
  const internalToken = request.headers.get('x-internal-token');
  if (internalToken !== INTERNAL_API_TOKEN) {
    // 方式2：用户 session 认证（前端调用）
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
  }

  try {
    const body = await request.json();
    const { mode = 'article', gradientScheme = 'pinkOrange' } = body;

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

      const cards = await generateCardsFromArticle(
        {
          title,
          intro,
          points: points.slice(0, MAX_POINTS_PER_ARTICLE),
          conclusion: conclusion || '感谢阅读',
          tags: tags || [],
          author,
        },
        gradientScheme as GradientScheme
      );

      // 安全校验：限制返回数量
      return NextResponse.json({
        success: true,
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

      return NextResponse.json({
        success: true,
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

export async function GET(request: NextRequest) {
  // GET 接口返回 API 说明，无需认证
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
    },
  });
}
