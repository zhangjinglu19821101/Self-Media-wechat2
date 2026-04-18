import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { contentTemplateService } from '@/lib/services/content-template-service';

/**
 * 内容模板列表
 * GET /api/content-templates
 *
 * 查询参数：
 * - platform: 平台筛选
 * - cardCountMode: 卡片数量模式筛选
 * - densityStyle: 密度风格筛选
 * - limit: 返回数量限制
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || undefined;
    const cardCountMode = searchParams.get('cardCountMode') as any || undefined;
    const densityStyle = searchParams.get('densityStyle') as any || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    // 优先返回最近使用的模板
    const templates = await contentTemplateService.listTemplates(workspaceId, {
      platform,
      cardCountMode,
      densityStyle,
      limit: limit || 20,
    });

    return NextResponse.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('[ContentTemplateAPI] GET error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 创建内容模板
 * POST /api/content-templates
 *
 * Body:
 * - name: 模板名称
 * - description?: 描述
 * - platform?: 平台（默认 xiaohongshu）
 * - styleTemplateId?: 关联的风格模板ID
 * - analysis: ContentTemplateAnalysis 对象
 * - visualAnalysis?: VisualStyleAnalysis 对象
 * - sourceImageHashes?: 图片hash列表
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const body = await request.json();
    const { name, description, platform, styleTemplateId, analysis, visualAnalysis, sourceImageHashes } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: '模板名称不能为空' },
        { status: 400 }
      );
    }

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: '缺少分析结果 (analysis)' },
        { status: 400 }
      );
    }

    const template = await contentTemplateService.createTemplate(workspaceId, {
      name,
      description,
      platform,
      styleTemplateId,
      analysis,
      visualAnalysis,
      sourceImageHashes,
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('[ContentTemplateAPI] POST error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
