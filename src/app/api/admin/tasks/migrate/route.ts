/**
 * POST /api/admin/tasks/migrate
 * 为旧的指令数据补充创建任务记录
 *
 * 此 API 会扫描 messages 表中所有标记为 isCommand = 'true' 但没有对应任务记录的指令，
 * 并为它们创建对应的 agent_tasks 记录。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, schema } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  console.log('🔧 === 开始迁移旧指令数据 ===');

  let db: any = null;
  let migratedCount = 0;
  let errors: Array<{ conversationId: string; error: string }> = [];

  try {
    db = getDatabase();

    // 查询所有标记为 isCommand = 'true' 但没有对应任务记录的指令
    const oldCommands = await db
      .execute(`
        SELECT 
          m.id as message_id,
          m.conversation_id,
          m.content,
          c.session_id,
          c.metadata->>'fromAgentId' as from_agent_id,
          c.agent_id as to_agent_id,
          c.metadata->>'commandType' as command_type,
          c.metadata->>'priority' as priority,
          m.created_at
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.metadata->>'isCommand' = 'true'
          AND NOT EXISTS (
            SELECT 1 FROM agent_tasks at 
            WHERE at.metadata->>'conversationId' = m.conversation_id::text
          )
        ORDER BY m.created_at ASC
      `);

    console.log(`📊 找到 ${oldCommands.length} 条旧指令数据需要迁移`);

    // 为每条旧指令创建任务记录
    for (const cmd of oldCommands) {
      try {
        const createdAt = new Date(cmd.created_at);
        const taskId = `task-migrate-${cmd.from_agent_id}-to-${cmd.to_agent_id}-${createdAt.getTime()}`;

        await db.insert(agentTasks).values({
          taskId,
          fromAgentId: cmd.from_agent_id,
          toAgentId: cmd.to_agent_id,
          command: cmd.content,
          commandType: cmd.command_type || 'instruction',
          priority: cmd.priority || 'normal',
          status: 'pending',
          splitStatus: 'splitting', // 🔥 新增：初始状态为 splitting
          splitStartTime: createdAt, // 🔥 新增：设置拆解开始时间
          metadata: {
            conversationId: cmd.conversation_id,
            sessionId: cmd.session_id,
            migrated: true,
            migratedAt: new Date().toISOString(),
          },
          createdAt: createdAt,
          updatedAt: createdAt,
        });

        migratedCount++;
        console.log(`✅ 已创建任务记录: taskId=${taskId}, from=${cmd.from_agent_id}, to=${cmd.to_agent_id}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({
          conversationId: cmd.conversation_id,
          error: errorMsg,
        });
        console.error(`❌ 创建任务记录失败: conversationId=${cmd.conversation_id}, error=${errorMsg}`);
      }
    }

    console.log(`🎉 迁移完成: 成功 ${migratedCount} 条, 失败 ${errors.length} 条`);

    return NextResponse.json({
      success: true,
      message: '旧指令数据迁移完成',
      data: {
        total: oldCommands.length,
        migrated: migratedCount,
        failed: errors.length,
        errors: errors,
      },
    });
  } catch (error) {
    console.error('Error migrating old commands:', error);
    return NextResponse.json(
      {
        success: false,
        error: '迁移失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
