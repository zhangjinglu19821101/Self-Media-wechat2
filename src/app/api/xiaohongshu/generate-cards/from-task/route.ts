/**
 * 从子任务生成小红书卡片 API
 * 
 * POST /api/xiaohongshu/generate-cards/from-task
 * 
 * 根据 subTaskId 自动提取文章内容并生成卡片图片
 * 
 * 安全说明：
 * - 需要用户认证（session）
 * - 支持 workspaceId 隔离
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  generateCardsFromArticle,
  type GradientScheme,
  type ImageCountMode,
} from '@/lib/services/xiaohongshu-card-service';
import { uploadXhsCardGroup } from '@/lib/services/xhs-storage-service';

// 有效的卡片数量模式
const VALID_CARD_COUNT_MODES = ['3-card', '5-card', '7-card'] as const;
type CardCountMode = typeof VALID_CARD_COUNT_MODES[number];

// 有效的渐变方案
const VALID_GRADIENT_SCHEMES = ['pinkOrange', 'bluePurple', 'tealGreen', 'orangeYellow', 'deepBlue', 'coralPink'] as const;
type GradientSchemeType = typeof VALID_GRADIENT_SCHEMES[number];

// 类型守卫
function isValidCardCountMode(mode: string): mode is CardCountMode {
  return VALID_CARD_COUNT_MODES.includes(mode as CardCountMode);
}

function isValidGradientScheme(scheme: string): scheme is GradientSchemeType {
  return VALID_GRADIENT_SCHEMES.includes(scheme as GradientSchemeType);
}

/**
 * 从任务 resultData 中提取小红书文章内容
 */
function extractXhsArticleFromTask(task: typeof agentSubTasks.$inferSelect): {
  title: string;
  intro: string;
  points: Array<{ title: string; content: string }>;
  conclusion: string;
  tags: string[];
} | null {
  const resultData = task.resultData as any;
  
  // 尝试多种数据路径提取
  const platformData = resultData?.structuredResult?.resultContent?.platformData ||
                       resultData?.executorOutput?.structuredResult?.resultContent?.platformData ||
                       resultData?.platformData ||
                       null;
  
  if (!platformData) {
    return null;
  }
  
  // 提取字段
  const title = platformData.title || task.articleTitle || '未命名文章';
  const intro = platformData.intro || '';
  const points = platformData.points || [];
  const conclusion = platformData.conclusion || '';
  const tags = platformData.tags || [];
  
  // 验证必要字段
  if (!title || points.length === 0) {
    return null;
  }
  
  return {
    title,
    intro,
    points: points.map((p: any) => ({
      title: p.title || '',
      content: p.content || '',
    })),
    conclusion,
    tags,
  };
}

export async function POST(request: NextRequest) {
  // ========== 认证校验 ==========
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  
  const workspaceId = getWorkspaceId(request);
  
  try {
    const body = await request.json();
    const {
      subTaskId,
      gradientScheme = 'pinkOrange',
      cardCountMode = '5-card',
      persist = true,  // 默认持久化
    } = body;
    
    // 参数校验
    if (!subTaskId) {
      return NextResponse.json({
        success: false,
        error: '缺少 subTaskId 参数',
      }, { status: 400 });
    }
    
    // 类型守卫校验
    const finalGradientScheme: GradientScheme = isValidGradientScheme(gradientScheme)
      ? gradientScheme
      : 'pinkOrange';
    
    const finalCardCountMode: ImageCountMode = isValidCardCountMode(cardCountMode)
      ? cardCountMode
      : '5-card';
    
    // ========== 查询任务 ==========
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(and(
        eq(agentSubTasks.id, subTaskId),
        eq(agentSubTasks.workspaceId, workspaceId)
      ))
      .limit(1);
    
    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未找到该任务或无权限访问',
      }, { status: 404 });
    }
    
    const task = tasks[0];
    
    // ========== 提取文章内容 ==========
    const article = extractXhsArticleFromTask(task);
    
    if (!article) {
      return NextResponse.json({
        success: false,
        error: '无法从任务中提取小红书文章内容',
        hint: '请确保任务已完成并包含 platformData 字段',
      }, { status: 400 });
    }
    
    console.log('[XhsCard API] 提取文章内容成功:', {
      title: article.title,
      pointsCount: article.points.length,
      subTaskId,
    });
    
    // ========== 生成卡片 ==========
    const cards = await generateCardsFromArticle(
      article,
      finalGradientScheme,
      finalCardCountMode
    );
    
    console.log('[XhsCard API] 生成卡片成功:', cards.length);
    
    // ========== 持久化存储 ==========
    if (persist) {
      // 构建卡片数据（符合 uploadXhsCardGroup 参数格式）
      const cardsForUpload = cards.map((card, index) => ({
        base64: card.base64,
        cardType: index === 0 ? 'cover' as const : 
                  index === cards.length - 1 ? 'ending' as const : 
                  'point' as const,
        title: card.title || '',
        content: '',
      }));
      
      const uploadResult = await uploadXhsCardGroup(
        cardsForUpload,
        subTaskId,
        {
          workspaceId,
          commandResultId: task.commandResultId || undefined,
        }
      );
      
      console.log('[XhsCard API] 上传卡片成功:', uploadResult.groupId);
      
      return NextResponse.json({
        success: true,
        subTaskId,
        groupId: uploadResult.groupId,
        cards: uploadResult.cards.map(card => ({
          cardId: card.cardId,
          cardIndex: cards.findIndex(c => c.base64 && card.signedUrl),
          url: card.signedUrl,
        })),
        totalCount: uploadResult.totalCards,
      });
    }
    
    // 非持久化模式：返回 Base64
    return NextResponse.json({
      success: true,
      subTaskId,
      cards: cards.map((card, index) => ({
        cardIndex: index,
        base64: card.base64,
        title: card.title,
      })),
      totalCount: cards.length,
    });
    
  } catch (error) {
    console.error('[XhsCard API] Error:', error);
    return NextResponse.json({
      success: false,
      error: '生成卡片失败',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
