/**
 * 数据库迁移 API：创建 agent_sub_tasks_step_history 表
 * 
 * 用途：
 * - 创建 agent_sub_tasks_step_history 表
 * - 添加索引和约束
 * 
 * 使用方法：
 * curl -X POST http://localhost:5000/api/db/create-step-history-table
 */

import { NextResponse } from 'next/server';
import postgres from 'postgres';

export const maxDuration = 60;

// 从环境变量获取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

export async function POST() {
  console.log('[DB Migration] 开始创建 agent_sub_tasks_step_history 表...');

  let client: postgres.Sql | null = null;

  try {
    // 创建数据库连接
    client = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 60,
    });

    // 1. 检查表是否已存在
    const tableExists = await client`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'agent_sub_tasks_step_history'
      );
    `;

    if (tableExists[0].exists) {
      console.log('[DB Migration] agent_sub_tasks_step_history 表已存在，跳过创建');
      return NextResponse.json({
        success: true,
        message: 'agent_sub_tasks_step_history 表已存在',
        skipped: true,
      });
    }

    // 2. 创建 agent_sub_tasks_step_history 表
    console.log('[DB Migration] 创建 agent_sub_tasks_step_history 表...');
    
    await client`
      CREATE TABLE agent_sub_tasks_step_history (
        id SERIAL PRIMARY KEY,
        command_result_id UUID NOT NULL,
        step_no INT NOT NULL,
        interact_content JSONB NOT NULL,
        interact_user VARCHAR(64) NOT NULL,
        interact_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        interact_num INT NOT NULL DEFAULT 1,
        
        CONSTRAINT idx_command_result_step_no
          UNIQUE (command_result_id, step_no)
      );
    `;

    // 3. 创建索引
    console.log('[DB Migration] 创建索引...');
    
    await client`
      CREATE INDEX idx_step_history_command_result
      ON agent_sub_tasks_step_history (command_result_id);
    `;

    await client`
      CREATE INDEX idx_step_history_step_no
      ON agent_sub_tasks_step_history (step_no);
    `;

    await client`
      CREATE INDEX idx_step_history_interact_time
      ON agent_sub_tasks_step_history (interact_time);
    `;

    // 4. 添加表和字段备注
    console.log('[DB Migration] 添加表和字段备注...');
    
    await client`
      COMMENT ON TABLE agent_sub_tasks_step_history IS '存储 agent_sub_tasks 每一步执行的交互过程（含 insurance-d 与 agent B/人工的沟通、问题咨询、执行结果）';
    `;

    await client`
      COMMENT ON COLUMN agent_sub_tasks_step_history.command_result_id IS '关联 agent_sub_tasks 表的 command_result_id';
    `;

    await client`
      COMMENT ON COLUMN agent_sub_tasks_step_history.step_no IS '步骤编号（对应 agent_sub_tasks.order_index）';
    `;

    await client`
      COMMENT ON COLUMN agent_sub_tasks_step_history.interact_content IS '结构化交互内容（JSONB）：含交互类型、问题描述、响应内容、处理结果等';
    `;

    await client`
      COMMENT ON COLUMN agent_sub_tasks_step_history.interact_user IS '交互发起方：insurance-d（咨询方）/agent B（响应方）/human（人工响应方）。human场景：agent B无法解决，系统不存在可以提供的MCP服务，需要human处理的时候';
    `;

    await client`
      COMMENT ON COLUMN agent_sub_tasks_step_history.interact_time IS '交互发生时间';
    `;

    await client`
      COMMENT ON COLUMN agent_sub_tasks_step_history.interact_num IS '同 command_result_id + step_no 下的交流次数（从1开始递增）';
    `;

    // 5. 验证表是否创建成功
    const verifyResult = await client`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agent_sub_tasks_step_history'
      ORDER BY ordinal_position;
    `;

    console.log('[DB Migration] agent_sub_tasks_step_history 表创建成功！');
    console.log('[DB Migration] 表结构：', verifyResult);

    return NextResponse.json({
      success: true,
      message: 'agent_sub_tasks_step_history 表创建成功',
      tableStructure: verifyResult,
    });

  } catch (error) {
    console.error('[DB Migration] 创建失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  } finally {
    if (client) {
      await client.end();
    }
  }
}
