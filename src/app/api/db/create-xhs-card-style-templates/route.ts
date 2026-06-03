/**
 * 创建 xhs_card_style_templates 表的迁移 API
 *
 * 同时将硬编码预设模板插入数据库
 */

import { NextResponse } from 'next/server';

const DB_URL = process.env.DATABASE_URL || process.env.RAW_DATABASE_URL || '';

function getConnectionString(): string {
  if (!DB_URL) throw new Error('DATABASE_URL not configured');
  if (!DB_URL.includes('sslmode')) {
    return DB_URL + (DB_URL.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  return DB_URL;
}

export async function GET() {
  const results: Array<{ step: string; status: string; detail: string }> = [];

  try {
    const { default: postgres } = await import('postgres');
    const sql = postgres(getConnectionString(), { max: 2 });

    try {
      // Step 1: 创建表
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS xhs_card_style_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          template_type TEXT NOT NULL DEFAULT 'user',
          preset_template_id TEXT,
          template_config JSONB NOT NULL,
          source_type TEXT NOT NULL DEFAULT 'manual',
          use_count INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `;
      await sql.unsafe(createTableSQL);
      results.push({ step: 'create_table', status: 'ok', detail: 'xhs_card_style_templates 表创建成功' });

      // Step 2: 创建索引
      const indexes = [
        `CREATE INDEX IF NOT EXISTS idx_xhs_card_style_templates_workspace ON xhs_card_style_templates(workspace_id);`,
        `CREATE INDEX IF NOT EXISTS idx_xhs_card_style_templates_type ON xhs_card_style_templates(template_type);`,
        `CREATE INDEX IF NOT EXISTS idx_xhs_card_style_templates_preset_id ON xhs_card_style_templates(preset_template_id);`,
      ];
      for (const idxSQL of indexes) {
        await sql.unsafe(idxSQL);
      }
      results.push({ step: 'create_indexes', status: 'ok', detail: '3个索引创建成功' });

      // Step 3: 插入预设模板（仅当不存在时插入）
      const presetTemplates = [
        {
          presetTemplateId: 'classic_gradient',
          name: '经典渐变',
          description: '渐变背景+白色文字，小红书最流行的经典风格',
          sortOrder: 1,
          config: {
            id: 'classic_gradient',
            name: '经典渐变',
            description: '渐变背景+白色文字，小红书最流行的经典风格',
            thumbnail: { background: 'linear-gradient(135deg, #FF6B6B, #FFA07A)', textColor: '#ffffff', accentColor: '#FF6B6B' },
            cover: {
              bgType: 'gradient',
              colors: [{ from: '#FF6B6B', to: '#FFA07A' }, { from: '#667eea', to: '#764ba2' }, { from: '#2dd4bf', to: '#34d399' }, { from: '#1e3a5f', to: '#4a90d9' }, { from: '#f472b6', to: '#fb923c' }],
              textColor: '#ffffff', subtitleColor: 'rgba(255,255,255,0.85)', textAlign: 'center', borderRadius: 'xl', decoration: 'none', showTagline: true,
              fontSize: { title: '1.25rem', subtitle: '0.85rem' }, padding: '2rem 1.5rem',
            },
            point: {
              bgType: 'gradient',
              colors: [{ from: '#FF6B6B', to: '#FFA07A' }, { from: '#667eea', to: '#764ba2' }, { from: '#2dd4bf', to: '#34d399' }, { from: '#1e3a5f', to: '#4a90d9' }, { from: '#f472b6', to: '#fb923c' }],
              textColor: '#ffffff', titleColor: '#ffffff', numberColor: 'rgba(255,255,255,0.7)',
              layout: 'icon_title_content', borderRadius: 'xl', decoration: 'none', showNumber: true, numberStyle: 'plain',
              fontSize: { title: '1.05rem', content: '0.9rem', number: '0.8rem' }, padding: '1.5rem', contentMaxHeight: 160,
            },
            conclusion: {
              bgType: 'gradient', colors: [{ from: '#667eea', to: '#764ba2' }],
              textColor: '#ffffff', tagBgColor: 'rgba(255,255,255,0.2)', tagTextColor: '#ffffff',
              borderRadius: 'xl', decoration: 'none', fontSize: { conclusion: '1rem', tag: '0.75rem' }, padding: '1.5rem',
            },
          },
        },
        {
          presetTemplateId: 'minimal_white',
          name: '极简白底',
          description: '干净白底+深色文字+彩色点缀，专业清爽风格',
          sortOrder: 2,
          config: {
            id: 'minimal_white',
            name: '极简白底',
            description: '干净白底+深色文字+彩色点缀，专业清爽风格',
            thumbnail: { background: '#ffffff', textColor: '#1a1a2e', accentColor: '#FF6B6B' },
            cover: {
              bgType: 'solid', colors: [{ from: '#ffffff', to: '#ffffff' }],
              textColor: '#1a1a2e', subtitleColor: '#666666', textAlign: 'center', borderRadius: 'xl', decoration: 'corner', showTagline: false,
              fontSize: { title: '1.35rem', subtitle: '0.85rem' }, padding: '2.5rem 2rem',
            },
            point: {
              bgType: 'solid', colors: [{ from: '#fafafa', to: '#f5f5f5' }],
              textColor: '#333333', titleColor: '#1a1a2e', numberColor: '#FF6B6B',
              layout: 'number_title_content', borderRadius: 'lg', decoration: 'none', showNumber: true, numberStyle: 'circle',
              fontSize: { title: '1.05rem', content: '0.88rem', number: '0.85rem' }, padding: '1.5rem', contentMaxHeight: 150,
            },
            conclusion: {
              bgType: 'solid', colors: [{ from: '#fafafa', to: '#f5f5f5' }],
              textColor: '#333333', tagBgColor: '#FF6B6B', tagTextColor: '#ffffff',
              borderRadius: 'lg', decoration: 'none', fontSize: { conclusion: '1rem', tag: '0.72rem' }, padding: '1.5rem',
            },
          },
        },
        {
          presetTemplateId: 'dark_night',
          name: '暗夜模式',
          description: '深色背景+霓虹色彩，酷炫科技风格',
          sortOrder: 3,
          config: {
            id: 'dark_night',
            name: '暗夜模式',
            description: '深色背景+霓虹色彩，酷炫科技风格',
            thumbnail: { background: 'linear-gradient(135deg, #0f0c29, #302b63)', textColor: '#e0e0ff', accentColor: '#00f5d4' },
            cover: {
              bgType: 'gradient', colors: [{ from: '#0f0c29', to: '#302b63' }, { from: '#1a1a2e', to: '#16213e' }],
              textColor: '#e0e0ff', subtitleColor: 'rgba(224,224,255,0.7)', textAlign: 'center', borderRadius: 'xl', decoration: 'dots', showTagline: true,
              fontSize: { title: '1.3rem', subtitle: '0.85rem' }, padding: '2rem 1.5rem',
            },
            point: {
              bgType: 'gradient', colors: [{ from: '#1a1a2e', to: '#16213e' }, { from: '#0f0c29', to: '#302b63' }],
              textColor: '#d0d0ee', titleColor: '#00f5d4', numberColor: '#00f5d4',
              layout: 'number_title_content', borderRadius: 'xl', decoration: 'none', showNumber: true, numberStyle: 'badge',
              fontSize: { title: '1.05rem', content: '0.88rem', number: '0.8rem' }, padding: '1.5rem', contentMaxHeight: 150,
            },
            conclusion: {
              bgType: 'gradient', colors: [{ from: '#0f0c29', to: '#302b63' }],
              textColor: '#d0d0ee', tagBgColor: 'rgba(0,245,212,0.15)', tagTextColor: '#00f5d4',
              borderRadius: 'xl', decoration: 'none', fontSize: { conclusion: '1rem', tag: '0.72rem' }, padding: '1.5rem',
            },
          },
        },
        {
          presetTemplateId: 'handwrite',
          name: '手账风',
          description: '暖色纸质感+手写风格+圆角装饰，温馨亲切',
          sortOrder: 4,
          config: {
            id: 'handwrite',
            name: '手账风',
            description: '暖色纸质感+手写风格+圆角装饰，温馨亲切',
            thumbnail: { background: 'linear-gradient(135deg, #fef3c7, #fde68a)', textColor: '#78350f', accentColor: '#d97706' },
            cover: {
              bgType: 'gradient', colors: [{ from: '#fef3c7', to: '#fde68a' }, { from: '#fce7f3', to: '#fbcfe8' }, { from: '#dbeafe', to: '#bfdbfe' }],
              textColor: '#78350f', subtitleColor: '#92400e', textAlign: 'left', borderRadius: 'xl', decoration: 'corner', showTagline: false,
              fontSize: { title: '1.2rem', subtitle: '0.82rem' }, padding: '2rem 1.8rem',
            },
            point: {
              bgType: 'gradient', colors: [{ from: '#fef3c7', to: '#fde68a' }, { from: '#fce7f3', to: '#fbcfe8' }, { from: '#dbeafe', to: '#bfdbfe' }],
              textColor: '#44403c', titleColor: '#78350f', numberColor: '#d97706',
              layout: 'emoji_title_content', borderRadius: 'lg', decoration: 'dots', showNumber: true, numberStyle: 'plain',
              fontSize: { title: '1rem', content: '0.85rem', number: '0.9rem' }, padding: '1.4rem 1.5rem', contentMaxHeight: 140,
            },
            conclusion: {
              bgType: 'gradient', colors: [{ from: '#fef3c7', to: '#fde68a' }],
              textColor: '#78350f', tagBgColor: 'rgba(217,119,6,0.15)', tagTextColor: '#92400e',
              borderRadius: 'lg', decoration: 'dots', fontSize: { conclusion: '0.95rem', tag: '0.72rem' }, padding: '1.4rem 1.5rem',
            },
          },
        },
      ];

      let insertedCount = 0;
      for (const tpl of presetTemplates) {
        // 检查是否已存在
        const existing = await sql`
          SELECT id FROM xhs_card_style_templates
          WHERE preset_template_id = ${tpl.presetTemplateId} AND template_type = 'system'
        `;
        if (existing.length === 0) {
          await sql`
            INSERT INTO xhs_card_style_templates (
              name, description, template_type, preset_template_id,
              template_config, source_type, sort_order, is_active
            ) VALUES (
              ${tpl.name}, ${tpl.description}, 'system', ${tpl.presetTemplateId},
              ${JSON.stringify(tpl.config)}::jsonb, 'preset', ${tpl.sortOrder}, true
            )
          `;
          insertedCount++;
        }
      }
      results.push({ step: 'insert_presets', status: 'ok', detail: `预设模板插入完成，新增 ${insertedCount} 条` });

      return NextResponse.json({ success: true, results });

    } finally {
      await sql.end();
    }
  } catch (error: unknown) {
    console.error('创建 xhs_card_style_templates 表失败:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg, results }, { status: 500 });
  }
}
