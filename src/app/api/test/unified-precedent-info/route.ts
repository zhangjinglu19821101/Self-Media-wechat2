/**
 * 测试 API：验证统一前序信息获取服务
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { taskId, enableLLMFilter = true } = await request.json();

    if (!taskId) {
      return NextResponse.json(
        { error: '缺少 taskId 参数' },
        { status: 400 }
      );
    }

    console.log('🧪 测试统一前序信息获取服务...');
    console.log('🧪 任务ID:', taskId);
    console.log('🧪 启用LLM筛选:', enableLLMFilter);

    // 1. 验证任务是否存在
    const task = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, taskId)
    });

    if (!task) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    console.log('✅ 任务存在:', {
      id: task.id,
      orderIndex: task.orderIndex,
      taskTitle: task.taskTitle
    });

    // 2. 调用统一前序信息获取服务
    const { default: unifiedPrecedentService } = await import('@/lib/services/unified-precedent-info-service');
    
    const startTime = Date.now();
    const resultText = await unifiedPrecedentService.getPrecedentInfoText(taskId, {
      enableLLMFilter
    });
    const duration = Date.now() - startTime;

    console.log('✅ 服务调用完成:', {
      duration_ms: duration,
      result_length: resultText.length,
      has_result: resultText.length > 0
    });

    // 3. 返回结果
    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        orderIndex: task.orderIndex,
        taskTitle: task.taskTitle,
        taskDescription: task.taskDescription
      },
      result: {
        text: resultText,
        length: resultText.length,
        hasContent: resultText.length > 0,
        preview: resultText.substring(0, 500) + (resultText.length > 500 ? '...' : '')
      },
      performance: {
        durationMs: duration
      }
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json(
      { 
        error: '测试失败', 
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET 方法：获取测试说明
 */
export async function GET() {
  return NextResponse.json({
    name: '统一前序信息获取服务测试 API',
    description: '测试 UnifiedPrecedentInfoService 的功能',
    usage: {
      method: 'POST',
      body: {
        taskId: '任务ID（必填）',
        enableLLMFilter: '是否启用LLM筛选（可选，默认true）'
      },
      example: {
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        enableLLMFilter: true
      }
    }
  });
}
