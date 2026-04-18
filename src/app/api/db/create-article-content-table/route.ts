/**
 * POST /api/db/create-article-content-table
 * 
 * 数据库迁移：创建 article_content 表
 * 用于存储保险科普文章的完整内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log(`🔧 开始数据库迁移：创建 article_content 表...`);

    // ========================================================================
    // 1. 检查表是否已存在
    // ========================================================================
    console.log(`📝 1/5: 检查 article_content 表是否存在...`);
    const checkTable = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name = 'article_content'
    `);

    const tableExists = (checkTable as any)[0].count > 0;

    if (tableExists) {
      console.log(`✅ article_content 表已经存在`);
    } else {
      console.log(`🔧 创建 article_content 表...`);
      
      // 创建表
      await db.execute(sql`
        CREATE TABLE article_content (
          -- 核心主键
          article_id VARCHAR(64) PRIMARY KEY,
          
          -- 基础关联信息
          task_id VARCHAR(64) NOT NULL,
          creator_agent VARCHAR(32) NOT NULL,
          
          -- 文章核心内容
          article_title VARCHAR(255) NOT NULL,
          article_subtitle VARCHAR(255) DEFAULT '',
          article_content TEXT NOT NULL,
          core_keywords JSONB DEFAULT '[]'::jsonb,
          
          -- 创作流程关联
          create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          version INT NOT NULL DEFAULT 1,
          
          -- 状态控制
          content_status VARCHAR(32) NOT NULL DEFAULT 'draft',
          reject_reason TEXT DEFAULT '',
          
          -- 公众号关联
          wechat_mp_url VARCHAR(512) DEFAULT '',
          wechat_mp_publish_time TIMESTAMP DEFAULT NULL,
          
          -- 扩展字段
          ext_info JSONB DEFAULT '{}'::jsonb
        )
      `);
      
      console.log(`✅ article_content 表创建成功`);
    }

    // ========================================================================
    // 2. 添加表备注（PostgreSQL 使用 COMMENT）
    // ========================================================================
    console.log(`📝 2/5: 添加表和字段备注...`);
    try {
      await db.execute(sql`COMMENT ON TABLE article_content IS '存储保险科普文章的完整内容，关联创作任务和公众号发布信息'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.article_id IS '文章唯一标识（ART+日期+序号，如ART20260224001）'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.task_id IS '关联agent_sub_tasks的task_id，溯源创作任务'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.creator_agent IS '创作Agent：insurance-d/insurance-c'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.article_title IS '文章标题（最终版）'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.article_subtitle IS '文章副标题（可选）'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.article_content IS '文章完整正文（纯文本/HTML，根据业务选择）'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.core_keywords IS '核心关键词数组，如["年金险","增额寿"]'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.create_time IS '文章创建时间'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.update_time IS '文章最后更新时间'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.version IS '文章版本号（修改一次+1）'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.content_status IS '内容状态：draft(草稿)/review(待审核)/published(已发布)/rejected(审核驳回)'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.reject_reason IS '审核驳回原因（仅content_status=rejected时填充）'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.wechat_mp_url IS '公众号发布后的文章链接'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.wechat_mp_publish_time IS '公众号发布时间'`);
      await db.execute(sql`COMMENT ON COLUMN article_content.ext_info IS '扩展信息（如字数、分段结构、配图ID等）'`);
      
      console.log(`✅ 表和字段备注添加成功`);
    } catch (commentError) {
      console.log(`⚠️ 添加备注失败，但表已创建:`, commentError);
    }

    // ========================================================================
    // 3. 创建索引
    // ========================================================================
    console.log(`📝 3/5: 创建索引...`);

    // 索引1: task_id
    const checkIndex1 = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename = 'article_content'
      AND indexname = 'idx_article_content_task_id'
    `);

    if ((checkIndex1 as any)[0].count === 0) {
      await db.execute(sql`
        CREATE INDEX idx_article_content_task_id 
        ON article_content (task_id)
      `);
      console.log(`✅ 索引 idx_article_content_task_id 创建成功`);
    } else {
      console.log(`✅ 索引 idx_article_content_task_id 已存在`);
    }

    // 索引2: creator_agent + content_status
    const checkIndex2 = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename = 'article_content'
      AND indexname = 'idx_article_content_creator_status'
    `);

    if ((checkIndex2 as any)[0].count === 0) {
      await db.execute(sql`
        CREATE INDEX idx_article_content_creator_status 
        ON article_content (creator_agent, content_status)
      `);
      console.log(`✅ 索引 idx_article_content_creator_status 创建成功`);
    } else {
      console.log(`✅ 索引 idx_article_content_creator_status 已存在`);
    }

    // 索引3: core_keywords (GIN)
    const checkIndex3 = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename = 'article_content'
      AND indexname = 'idx_article_content_keywords'
    `);

    if ((checkIndex3 as any)[0].count === 0) {
      await db.execute(sql`
        CREATE INDEX idx_article_content_keywords 
        ON article_content USING GIN (core_keywords)
      `);
      console.log(`✅ 索引 idx_article_content_keywords 创建成功`);
    } else {
      console.log(`✅ 索引 idx_article_content_keywords 已存在`);
    }

    // 索引4: wechat_mp_publish_time
    const checkIndex4 = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename = 'article_content'
      AND indexname = 'idx_article_content_publish_time'
    `);

    if ((checkIndex4 as any)[0].count === 0) {
      await db.execute(sql`
        CREATE INDEX idx_article_content_publish_time 
        ON article_content (wechat_mp_publish_time)
      `);
      console.log(`✅ 索引 idx_article_content_publish_time 创建成功`);
    } else {
      console.log(`✅ 索引 idx_article_content_publish_time 已存在`);
    }

    console.log(`✅ 所有索引创建完成`);

    // ========================================================================
    // 4. 验证表结构
    // ========================================================================
    console.log(`📝 4/5: 验证表结构...`);
    const columns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'article_content'
      ORDER BY ordinal_position
    `);

    console.log(`✅ article_content 表字段:`, (columns as any[]).map(c => `${c.column_name} (${c.data_type})`));

    // ========================================================================
    // 5. 完成
    // ========================================================================
    console.log(`📝 5/5: 迁移完成！`);

    return NextResponse.json({
      success: true,
      message: 'article_content 表创建成功',
      table: 'article_content',
      columns: (columns as any[]).map(c => ({
        name: c.column_name,
        type: c.data_type
      }))
    });

  } catch (error) {
    console.error('❌ 创建 article_content 表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

