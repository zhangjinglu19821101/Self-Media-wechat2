/**
 * 文章排版模板 API
 * 用于管理和获取文章的 HTML 样式模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { articleTemplates } from '@/lib/db/schema/article-templates';
import { eq, desc } from 'drizzle-orm';
import { isValidPlatform, DEFAULT_PLATFORM } from '@/lib/db/schema/style-template';

// 获取模板列表
export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { searchParams } = new URL(request.url);
    const platformParam = searchParams.get('platform');
    // P1 修复：校验 platform 参数
    const platform = platformParam && isValidPlatform(platformParam) 
      ? platformParam 
      : DEFAULT_PLATFORM;

    const templates = await db
      .select()
      .from(articleTemplates)
      .where(eq(articleTemplates.platform, platform))
      .orderBy(desc(articleTemplates.isDefault), desc(articleTemplates.createdAt));

    // 按系统模板和用户模板分组
    const systemTemplates = templates.filter(t => t.isSystem);
    const userTemplates = templates.filter(t => !t.isSystem);

    return NextResponse.json({
      success: true,
      data: {
        systemTemplates,
        userTemplates,
      },
    });
  } catch (error) {
    console.error('[API] 获取模板列表失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取模板列表失败',
    }, { status: 500 });
  }
}

// 创建新模板
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { name, htmlContent, platform = 'wechat_official' } = body;

    if (!name || !htmlContent) {
      return NextResponse.json({
        success: false,
        error: '模板名称和内容不能为空',
      }, { status: 400 });
    }

    const [template] = await db
      .insert(articleTemplates)
      .values({
        userId: 'default-user',
        name,
        htmlContent,
        platform,
        isSystem: false,
        isDefault: false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('[API] 创建模板失败:', error);
    return NextResponse.json({
      success: false,
      error: '创建模板失败',
    }, { status: 500 });
  }
}
