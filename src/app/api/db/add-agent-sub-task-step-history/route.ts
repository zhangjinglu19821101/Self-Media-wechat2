/**
 * POST /api/db/add-agent-sub-task-step-history
 * 
 * 数据库迁移：
 * 1. 为 agent_sub_tasks 表新增 execution_date 字段
 * 2. 为 agent_sub_tasks 表新增 article_metadata 字段
 * 3. 创建 agent_sub_tasks_step_history 表
 * 4. 从 daily_task 表同步 execution_date 到现有数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log(`🔧 开始数据库迁移：添加 agent_sub_tasks_step_history 表和相关字段...`);

    // ========================================================================
    // 1. 为 agent_sub_tasks 表新增 execution_date 字段
    // ========================================================================
    console.log(`📝 1/5: 检查 agent_sub_tasks.execution_date 字段...`);
    const checkExecutionDate = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks'
      AND column_name = 'execution_date'
    `);

    const executionDateExists = (checkExecutionDate as any)[0].count > 0;

    if (executionDateExists) {
      console.log(`✅ execution_date 字段已经存在`);
    } else {
      console.log(`🔧 新增 execution_date 字段...`);
      await db.execute(sql`
        ALTER TABLE agent_sub_tasks
        ADD COLUMN execution_date DATE
      `);
      console.log(`✅ execution_date 字段创建成功`);
    }

    // ========================================================================
    // 2. 为 agent_sub_tasks 表新增 article_metadata 字段
    // ========================================================================
    console.log(`📝 2/5: 检查 agent_sub_tasks.article_metadata 字段...`);
    const checkArticleMetadata = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks'
      AND column_name = 'article_metadata'
    `);

    const articleMetadataExists = (checkArticleMetadata as any)[0].count > 0;

    if (articleMetadataExists) {
      console.log(`✅ article_metadata 字段已经存在`);
    } else {
      console.log(`🔧 新增 article_metadata 字段...`);
      await db.execute(sql`
        ALTER TABLE agent_sub_tasks
        ADD COLUMN article_metadata JSONB DEFAULT '{}'::jsonb
      `);
      console.log(`✅ article_metadata 字段创建成功`);
    }

    // ========================================================================
    // 3. 为 article_metadata 字段添加 GIN 索引
    // ========================================================================
    console.log(`📝 3/5: 检查 article_metadata 的 GIN 索引...`);
    const checkArticleMetadataIndex = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename = 'agent_sub_tasks'
      AND indexname = 'idx_agent_sub_tasks_article_metadata'
    `);

    const articleMetadataIndexExists = (checkArticleMetadataIndex as any)[0].count > 0;

    if (articleMetadataIndexExists) {
      console.log(`✅ article_metadata 的 GIN 索引已经存在`);
    } else {
      console.log(`🔧 为 article_metadata 字段添加 GIN 索引...`);
      await db.execute(sql`
        CREATE INDEX idx_agent_sub_tasks_article_metadata
        ON agent_sub_tasks USING GIN (article_metadata)
      `);
      console.log(`✅ article_metadata 的 GIN 索引创建成功`);
    }

    // ========================================================================
    // 4. 创建 agent_sub_tasks_step_history 表
    // ========================================================================
    console.log(`📝 4/5: 检查 agent_sub_tasks_step_history 表...`);
    const checkStepHistoryTable = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_name = 'agent_sub_tasks_step_history'
    `);

    const stepHistoryTableExists = (checkStepHistoryTable as any)[0].count > 0;

    if (stepHistoryTableExists) {
      console.log(`✅ agent_sub_tasks_step_history 表已经存在`);
    } else {
      console.log(`🔧 创建 agent_sub_tasks_step_history 表...`);
      await db.execute(sql`
        CREATE TABLE agent_sub_tasks_step_history (
          id BIGSERIAL PRIMARY KEY,
          command_result_id UUID NOT NULL,
          step_no INT NOT NULL,
          interact_content JSONB NOT NULL,
          interact_user VARCHAR(64) NOT NULL,
          interact_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          interact_num INT NOT NULL DEFAULT 1,
          
          CONSTRAINT fk_command_result_id
            FOREIGN KEY (command_result_id)
            REFERENCES agent_sub_tasks (command_result_id)
            ON DELETE CASCADE,
          
          CONSTRAINT idx_command_result_step_no
            UNIQUE (command_result_id, step_no)
        )
      `);

      // 创建索引
      await db.execute(sql`
        CREATE INDEX idx_step_history_command_result
        ON agent_sub_tasks_step_history (command_result_id)
      `);

      await db.execute(sql`
        CREATE INDEX idx_step_history_step_no
        ON agent_sub_tasks_step_history (step_no)
      `);

      await db.execute(sql`
        CREATE INDEX idx_step_history_interact_time
        ON agent_sub_tasks_step_history (interact_time)
      `);

      // 添加表和字段备注
      await db.execute(sql`
        COMMENT ON TABLE agent_sub_tasks_step_history IS '存储 agent_sub_tasks 每一步执行的交互过程（含 insurance-d 与 agent B/人工的沟通、问题咨询、执行结果）'
      `);

      await db.execute(sql`
        COMMENT ON COLUMN agent_sub_tasks_step_history.command_result_id IS '关联 agent_sub_tasks 表的 command_result_id'
      `);

      await db.execute(sql`
        COMMENT ON COLUMN agent_sub_tasks_step_history.step_no IS '步骤编号（对应 agent_sub_tasks.order_index）'
      `);

      await db.execute(sql`
        COMMENT ON COLUMN agent_sub_tasks_step_history.interact_content IS '结构化交互内容（JSONB）：含交互类型、问题描述、响应内容、处理结果等'
      `);

      await db.execute(sql`
        COMMENT ON COLUMN agent_sub_tasks_step_history.interact_user IS '交互发起方：insurance-d（咨询方）/agent B（响应方）/human（人工响应方）。human场景：agent B无法解决，系统不存在可以提供的MCP服务，需要human处理的时候'
      `);

      await db.execute(sql`
        COMMENT ON COLUMN agent_sub_tasks_step_history.interact_time IS '交互发生时间'
      `);

      await db.execute(sql`
        COMMENT ON COLUMN agent_sub_tasks_step_history.interact_num IS '同 command_result_id + step_no 下的交流次数（从1开始递增）'
      `);

      console.log(`✅ agent_sub_tasks_step_history 表创建成功`);
    }

    // ========================================================================
    // 5. 从 daily_task 表同步 execution_date 到现有数据
    // ========================================================================
    console.log(`📝 5/5: 同步 execution_date 数据...`);
    const updateResult = await db.execute(sql`
      UPDATE agent_sub_tasks ast
      SET execution_date = dt.execution_date
      FROM daily_task dt
      WHERE ast.command_result_id = dt.id
      AND ast.execution_date IS NULL
    `);

    const updatedCount = (updateResult as any).rowCount || 0;
    console.log(`✅ 同步了 ${updatedCount} 条 execution_date 数据`);

    console.log(`🎉 数据库迁移完成！`);

    return NextResponse.json({
      success: true,
      message: '数据库迁移成功',
      data: {
        executionDate: {
          added: !executionDateExists,
          alreadyExists: executionDateExists,
        },
        articleMetadata: {
          added: !articleMetadataExists,
          alreadyExists: articleMetadataExists,
          index: {
            added: !articleMetadataIndexExists,
            alreadyExists: articleMetadataIndexExists,
          },
        },
        stepHistoryTable: {
          created: !stepHistoryTableExists,
          alreadyExists: stepHistoryTableExists,
        },
        executionDateSync: {
          updatedCount: updatedCount,
        },
      },
    });
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
