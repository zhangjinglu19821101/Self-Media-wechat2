/**
 * 数据库初始化 API
 * 创建所有必要的表
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('开始初始化数据库表...');

    // 创建 agent_tasks 表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id TEXT NOT NULL UNIQUE,
        task_name TEXT NOT NULL,
        core_command TEXT NOT NULL,
        executor TEXT NOT NULL,
        task_duration_start TIMESTAMP NOT NULL,
        task_duration_end TIMESTAMP NOT NULL,
        total_deliverables TEXT NOT NULL,
        task_priority TEXT NOT NULL DEFAULT 'normal',
        task_status TEXT NOT NULL DEFAULT 'pending',
        creator TEXT NOT NULL,
        updater TEXT NOT NULL DEFAULT 'TS',
        remarks TEXT,
        from_agent_id TEXT NOT NULL,
        command_type TEXT NOT NULL DEFAULT 'instruction',
        result TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);

    // 创建 command_results 表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS command_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        command_id TEXT NOT NULL UNIQUE,
        related_task_id TEXT NOT NULL,
        command_content TEXT NOT NULL,
        executor TEXT NOT NULL,
        command_priority TEXT NOT NULL DEFAULT 'normal',
        execution_deadline_start TIMESTAMP NOT NULL,
        execution_deadline_end TIMESTAMP NOT NULL,
        deliverables TEXT NOT NULL,
        execution_status TEXT NOT NULL DEFAULT 'new',
        status_proof TEXT,
        help_record TEXT,
        audit_opinion TEXT,
        splitter TEXT NOT NULL DEFAULT 'agent B',
        entry_user TEXT NOT NULL DEFAULT 'TS',
        remarks TEXT,
        last_ts_check_time TIMESTAMP,
        last_ts_awakening_time TIMESTAMP,
        ts_awakening_count INTEGER NOT NULL DEFAULT 0,
        last_inspection_time TIMESTAMP,
        last_consult_time TIMESTAMP,
        awakening_count INTEGER NOT NULL DEFAULT 0,
        task_id TEXT,
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        original_command TEXT NOT NULL,
        execution_result TEXT,
        output_data JSONB DEFAULT '{}',
        metrics JSONB DEFAULT '{}',
        attachments JSONB DEFAULT '[]',
        completed_at TIMESTAMP,
        scenario_type TEXT,
        task_name TEXT,
        trigger_source TEXT,
        retry_status TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // 创建 agent_memories 表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_memories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags JSONB DEFAULT '[]',
        importance INTEGER NOT NULL DEFAULT 0,
        source TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // 创建 agent_feedbacks 表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_feedbacks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feedback_id TEXT NOT NULL UNIQUE,
        task_id TEXT NOT NULL,
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        original_command TEXT NOT NULL,
        feedback_content TEXT NOT NULL,
        feedback_type TEXT NOT NULL DEFAULT 'question',
        status TEXT NOT NULL DEFAULT 'pending',
        resolution TEXT,
        resolved_command TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP
      )
    `);

    // 创建 agent_notifications 表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        notification_id TEXT NOT NULL UNIQUE,
        from_agent_id TEXT NOT NULL,
        to_agent_id TEXT NOT NULL,
        notification_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        related_task_id TEXT,
        status TEXT NOT NULL DEFAULT 'unread',
        priority TEXT NOT NULL DEFAULT 'normal',
        metadata JSONB DEFAULT '{}',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // 创建 conversations 表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL UNIQUE,
        user_id TEXT,
        agent_id TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'active',
        variables JSONB DEFAULT '{}',
        context JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMP,
        last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // 创建 messages 表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        tokens INTEGER,
        model TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    console.log('数据库表初始化完成');

    return NextResponse.json({
      success: true,
      message: '数据库表初始化完成'
    });

  } catch (error) {
    console.error('数据库初始化失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '数据库初始化失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
