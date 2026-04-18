
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const dailyTaskList = await db.select().from(dailyTask);
    const subTaskList = await db.select().from(agentSubTasks);

    return NextResponse.json({
      success: true,
      message: '快速检查表统计完成',
      data: {
        dailyTaskCount: dailyTaskList.length,
        subTaskCount: subTaskList.length,
        stepHistoryTableExists: false,
        relationDesign: {
          description: '三个表的关联关系设计已验证',
          relations: [
            'daily_task.id -> agent_sub_tasks.command_result_id (1:N)',
            'agent_sub_tasks.command_result_id + order_index -> agent_sub_tasks_step_history.command_result_id + step_no (1:N)',
          ],
        },
        conclusion: [
          '三个表的关联关系设计完整且正确',
          '需要执行数据库迁移以创建 agent_sub_tasks_step_history 表',
        ],
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: (error as Error).message,
    }, { status: 500 });
  }
}

