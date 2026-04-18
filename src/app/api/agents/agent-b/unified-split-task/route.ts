/**
 * Agent B 统一拆分任务 API
 * 
 * POST /api/agents/agent-b/unified-split-task
 * 
 * 功能：
 * - 统一处理所有 executor 的任务拆分（不再区分 insurance-d、insurance-c）
 * - 用 Agent B 的身份去拆分 daily_task → agent_sub_tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { AgentBUnifiedSplitter } from '@/lib/services/splitters/agent-b-unified-splitter';

export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { taskIds } = body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json(
        { error: '缺少必要参数：taskIds（任务ID数组）' },
        { status: 400 }
      );
    }

    console.log(`🔧 [API] Agent B 统一拆分任务: ${taskIds.length} 个任务`);
    console.log(`📋 [API] 任务 IDs:`, taskIds);

    // 创建拆分器实例
    const splitter = new AgentBUnifiedSplitter();
    
    // 执行拆分
    const result = await splitter.executeSplit(taskIds);

    if (result.success) {
      console.log(`✅ [API] Agent B 统一拆分成功`);
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data,
        subTaskCount: result.data?.totalSubTaskCount || 0,
      });
    } else {
      console.error(`❌ [API] Agent B 统一拆分失败:`, result.message);
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error(`❌ [API] Agent B 统一拆分任务异常:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
