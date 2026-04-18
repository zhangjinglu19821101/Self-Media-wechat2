/**
 * 创建文章排版模板表
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { articleTemplates } from '@/lib/db/schema/article-templates';

export async function GET() {
  try {
    console.log('[DB] 开始创建 article_templates 表...');

    // 使用 drizzle-orm 的 SQL 模板创建表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS article_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL DEFAULT 'default-user',
        name TEXT NOT NULL,
        html_content TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'wechat_official',
        is_system BOOLEAN NOT NULL DEFAULT false,
        is_default BOOLEAN NOT NULL DEFAULT false,
        use_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 检查是否有数据
    const existing = await db.select().from(articleTemplates);
    
    if (existing.length === 0) {
      // 插入默认系统模板
      await db.insert(articleTemplates).values([
        {
          name: '简约经典',
          htmlContent: '<div style="max-width: 680px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.8; color: #333;"><h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">{{title}}</h1><div style="color: #666; font-size: 14px; margin-bottom: 20px;">{{date}}</div><div style="font-size: 16px; line-height: 1.8;">{{content}}</div></div>',
          platform: 'wechat_official',
          isSystem: true,
          isDefault: true,
        },
        {
          name: '温馨故事',
          htmlContent: '<div style="max-width: 680px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.8; color: #333; background: linear-gradient(135deg, #fff5f5 0%, #ffe4e1 50%, #ffecd2 100%);"><h1 style="font-size: 28px; font-weight: bold; text-align: center; color: #ff6b6b;">{{title}}</h1><div style="background: #fff; border-radius: 12px; padding: 25px; margin-top: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">{{content}}</div></div>',
          platform: 'wechat_official',
          isSystem: true,
          isDefault: false,
        },
      ]);
      console.log('[DB] 默认模板插入完成');
    }

    return NextResponse.json({
      success: true,
      message: 'article_templates 表创建成功',
      count: existing.length,
    });
  } catch (error) {
    console.error('[DB] 创建失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    }, { status: 500 });
  }
}
