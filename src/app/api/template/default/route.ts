import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { setDefaultTemplate, getTemplateById } from '@/lib/template/service';

/**
 * 设置默认模板 API
 * PUT /api/template/default
 * Body: { templateId: string }
 */
export async function PUT(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { templateId } = body;
    
    console.log(`[API /template/default] 📥 收到设置默认请求, templateId: ${templateId}`);
    
    if (!templateId) {
      console.log(`[API /template/default] ❌ 缺少 templateId`);
      return NextResponse.json(
        { success: false, error: '缺少 templateId 参数' },
        { status: 400 }
      );
    }
    
    // 获取模板信息
    const template = await getTemplateById(templateId);
    if (!template) {
      console.log(`[API /template/default] ❌ 模板不存在, templateId: ${templateId}`);
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      );
    }
    
    console.log(`[API /template/default] 📋 找到模板: ${template.name}, platform: ${template.platform}`);
    
    // 设置为默认模板
    const success = await setDefaultTemplate(templateId, template.platform);
    
    if (success) {
      console.log(`[API /template/default] ✅ 设置成功`);
      return NextResponse.json({
        success: true,
        data: {
          templateId,
          platform: template.platform,
          message: `已将「${template.name}」设为 ${template.platform} 的默认模板`
        }
      });
    } else {
      console.log(`[API /template/default] ❌ 设置失败`);
      return NextResponse.json(
        { success: false, error: '设置默认模板失败' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[API /template/default] ❌ 处理请求失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
