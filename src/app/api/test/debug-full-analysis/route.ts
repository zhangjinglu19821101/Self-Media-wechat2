import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { agentSubTasksStepHistory } from '@/lib/db/schema/agent-sub-tasks-step-history';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema/agent-sub-tasks-mcp-executions';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const commandResultId = searchParams.get('commandResultId');
    
    if (!commandResultId) {
      return NextResponse.json(
        { error: '缺少 commandResultId 参数' },
        { status: 400 }
      );
    }

    console.log('[调试分析] 开始分析 commandResultId:', commandResultId);

    // 1. 查询所有子任务
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, commandResultId))
      .orderBy(agentSubTasks.orderIndex);

    // 2. 查询所有 step history
    const stepHistoryList = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId))
      .orderBy(agentSubTasksStepHistory.createdAt);

    // 3. 查询所有 MCP 执行记录
    const mcpExecutions = await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(eq(agentSubTasksMcpExecutions.commandResultId, commandResultId))
      .orderBy(agentSubTasksMcpExecutions.createdAt);

    // 4. 分析 order_index = 2 的任务详情
    const order2Task = subTasks.find(t => t.orderIndex === 2);
    let order2Analysis = null;
    
    if (order2Task) {
      const order2History = stepHistoryList.filter(h => h.orderIndex === 2);
      const order2Mcp = mcpExecutions.filter(m => m.orderIndex === 2);
      
      // 解析 resultData
      let resultDataParsed = null;
      if (order2Task.resultData) {
        try {
          resultDataParsed = typeof order2Task.resultData === 'string' 
            ? JSON.parse(order2Task.resultData)
            : order2Task.resultData;
        } catch (e) {
          resultDataParsed = { parseError: String(e) };
        }
      }
      
      order2Analysis = {
        task: order2Task,
        resultDataParsed,
        stepHistory: order2History,
        mcpExecutions: order2Mcp,
        // 分析 isNeedMcp
        isNeedMcpAnalysis: {
          value: resultDataParsed?.isNeedMcp,
          isCompleted: resultDataParsed?.isTaskDown,
          explanation: `isNeedMcp = !isCompleted。因为任务已完成(isCompleted=${resultDataParsed?.isTaskDown})，所以 isNeedMcp = ${resultDataParsed?.isNeedMcp}。这是正常的逻辑！`
        }
      };
    }

    const analysis = {
      summary: {
        totalSubTasks: subTasks.length,
        totalStepHistory: stepHistoryList.length,
        totalMcpExecutions: mcpExecutions.length,
        subTasksByStatus: subTasks.reduce((acc, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      subTasks,
      stepHistoryList,
      mcpExecutions,
      order2Analysis
    };

    console.log('[调试分析] 完成，结果:', {
      totalSubTasks: subTasks.length,
      totalStepHistory: stepHistoryList.length,
      totalMcpExecutions: mcpExecutions.length
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[调试分析] 错误:', error);
    return NextResponse.json(
      { 
        error: '分析失败', 
        message: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
