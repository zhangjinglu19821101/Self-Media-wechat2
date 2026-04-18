/**
 * 风格模板 + 平台账号 数据库迁移 API
 * 
 * 创建以下表：
 * 1. style_templates - 风格模板表
 * 2. platform_accounts - 平台账号表
 * 3. account_style_configs - 账号-模板绑定表
 * 4. 给 style_assets 表添加 template_id 字段
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const results: Array<{ step: string; status: 'success' | 'error' | 'skip'; message: string }> = [];

  try {
    // Step 1: 创建风格模板表
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS style_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          source_articles JSONB DEFAULT '[]'::jsonb,
          rule_count INTEGER DEFAULT 0,
          article_count INTEGER DEFAULT 0,
          is_default BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push({ step: '创建 style_templates 表', status: 'success', message: '表创建成功' });
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push({ step: '创建 style_templates 表', status: 'skip', message: '表已存在' });
      } else {
        throw e;
      }
    }

    // Step 2: 创建平台账号表
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS platform_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          platform_label TEXT,
          account_id TEXT,
          account_name TEXT NOT NULL,
          account_description TEXT,
          auth_info JSONB,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push({ step: '创建 platform_accounts 表', status: 'success', message: '表创建成功' });
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push({ step: '创建 platform_accounts 表', status: 'skip', message: '表已存在' });
      } else {
        throw e;
      }
    }

    // Step 3: 创建账号-模板绑定表
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS account_style_configs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
          template_id UUID NOT NULL REFERENCES style_templates(id) ON DELETE CASCADE,
          priority INTEGER DEFAULT 1,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      results.push({ step: '创建 account_style_configs 表', status: 'success', message: '表创建成功' });
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push({ step: '创建 account_style_configs 表', status: 'skip', message: '表已存在' });
      } else {
        throw e;
      }
    }

    // Step 4: 给 style_assets 表添加 template_id 字段
    try {
      await db.execute(sql`
        ALTER TABLE style_assets 
        ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES style_templates(id) ON DELETE SET NULL
      `);
      results.push({ step: '给 style_assets 添加 template_id 字段', status: 'success', message: '字段添加成功' });
    } catch (e: any) {
      if (e.message?.includes('already exists') || e.message?.includes('duplicate')) {
        results.push({ step: '给 style_assets 添加 template_id 字段', status: 'skip', message: '字段已存在' });
      } else {
        throw e;
      }
    }

    // Step 5: 创建索引（分开执行）
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_style_templates_user_id ON style_templates(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_style_templates_is_default ON style_templates(user_id, is_default)',
      'CREATE INDEX IF NOT EXISTS idx_platform_accounts_user_id ON platform_accounts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform ON platform_accounts(user_id, platform)',
      'CREATE INDEX IF NOT EXISTS idx_account_style_configs_user_id ON account_style_configs(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_account_style_configs_account_id ON account_style_configs(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_account_style_configs_template_id ON account_style_configs(template_id)',
      'CREATE INDEX IF NOT EXISTS idx_style_assets_template_id ON style_assets(template_id)',
    ];
    
    for (const indexQuery of indexQueries) {
      try {
        await db.execute(sql.raw(indexQuery));
      } catch (e: any) {
        // 忽略索引已存在的错误
        if (!e.message?.includes('already exists')) {
          console.error('创建索引失败:', indexQuery, e.message);
        }
      }
    }
    results.push({ step: '创建索引', status: 'success', message: '索引创建完成' });

    // Step 6: 为现有数据创建默认模板（如果有未绑定模板的 style_assets）
    try {
      // 查询是否有未绑定模板的 style_assets
      const orphanAssets = await db.execute(sql`
        SELECT user_id, COUNT(*) as count 
        FROM style_assets 
        WHERE template_id IS NULL 
        GROUP BY user_id
      `);

      if (orphanAssets.length > 0) {
        // 为每个用户创建一个默认模板
        for (const row of orphanAssets) {
          const userId = row.user_id;
          
          // 创建默认模板
          const templateResult = await db.execute(sql`
            INSERT INTO style_templates (user_id, name, description, is_default, is_active)
            VALUES (${userId}, '默认风格模板', '系统自动创建的默认风格模板', TRUE, TRUE)
            RETURNING id
          `);
          
          const templateId = templateResult[0]?.id;
          
          if (templateId) {
            // 将未绑定的 style_assets 关联到默认模板
            await db.execute(sql`
              UPDATE style_assets 
              SET template_id = ${templateId}
              WHERE user_id = ${userId} AND template_id IS NULL
            `);
            
            // 更新模板的规则数量
            await db.execute(sql`
              UPDATE style_templates 
              SET rule_count = (SELECT COUNT(*) FROM style_assets WHERE template_id = ${templateId})
              WHERE id = ${templateId}
            `);
          }
        }
        results.push({ step: '迁移现有数据', status: 'success', message: `已为 ${orphanAssets.length} 个用户创建默认模板并迁移数据` });
      } else {
        results.push({ step: '迁移现有数据', status: 'skip', message: '没有需要迁移的数据' });
      }
    } catch (e: any) {
      results.push({ step: '迁移现有数据', status: 'error', message: e.message || '未知错误' });
    }

    return NextResponse.json({
      success: true,
      message: '风格模板 + 平台账号 表迁移完成',
      results,
    });
  } catch (error: any) {
    console.error('迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '迁移失败',
      results,
    }, { status: 500 });
  }
}
