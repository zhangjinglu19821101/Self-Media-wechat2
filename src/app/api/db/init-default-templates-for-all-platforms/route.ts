import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { styleTemplates } from '@/lib/db/schema/style-template';
import { eq, and } from 'drizzle-orm';

/**
 * 为所有平台创建默认模板
 * GET /api/db/init-default-templates-for-all-platforms
 */
export async function GET() {
  try {
    const platforms = [
      { platform: 'wechat_official', name: '专业严谨', description: '适合保险科普类文章' },
      { platform: 'xiaohongshu', name: '小红书种草', description: '适合产品推荐、经验分享，风格亲切自然' },
      { platform: 'zhihu', name: '知乎干货', description: '适合深度分析、专业解答，逻辑清晰' },
      { platform: 'douyin', name: '抖音短视频', description: '适合短视频脚本，节奏快、吸引眼球' },
      { platform: 'weibo', name: '微博热点', description: '适合热点评论、资讯分享，简洁有力' },
    ];
    
    const results = [];
    
    for (const { platform, name, description } of platforms) {
      // 检查该平台是否已有默认模板
      // P1 修复：使用 and() 组合条件，确保查询正确
      const [existingDefault] = await db.select()
        .from(styleTemplates)
        .where(and(
          eq(styleTemplates.platform, platform),
          eq(styleTemplates.isDefault, true)
        ));
      
      if (existingDefault) {
        results.push({
          platform,
          status: 'skipped',
          message: `${platform} 已有默认模板: ${existingDefault.name}`,
          templateId: existingDefault.id,
        });
        continue;
      }
      
      // 检查该平台是否已有任何模板
      const [existingTemplate] = await db.select()
        .from(styleTemplates)
        .where(eq(styleTemplates.platform, platform));
      
      if (existingTemplate) {
        // 将第一个模板设为默认
        await db.update(styleTemplates)
          .set({ isDefault: true })
          .where(eq(styleTemplates.id, existingTemplate.id));
        
        results.push({
          platform,
          status: 'updated',
          message: `${platform} 已有模板，设为默认: ${existingTemplate.name}`,
          templateId: existingTemplate.id,
        });
        continue;
      }
      
      // 创建新的默认模板
      const [newTemplate] = await db.insert(styleTemplates)
        .values({
          userId: 'default-user',
          name,
          description,
          platform,
          isDefault: true,
          isActive: true,
          ruleCount: 0,
          articleCount: 0,
          sourceArticles: [],
        })
        .returning();
      
      results.push({
        platform,
        status: 'created',
        message: `${platform} 创建默认模板: ${name}`,
        templateId: newTemplate.id,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: '平台默认模板初始化完成',
      results,
    });
  } catch (error) {
    console.error('初始化平台默认模板失败:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}
