import { NextRequest, NextResponse } from 'next/server';
import { judgeExecutorResponse, DialogueContext, getAgentName } from '@/lib/agents/agent-b/judge-executor-response';
import { summarizeDialogue } from '@/lib/agents/agent-b/summarize-dialogue';

/**
 * POST /api/test/dialogue-judgment
 * 测试 Agent B 对话判断功能
 * 用于验证执行 Agent 身份标识
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executorAgentId, taskTitle, taskDescription } = body;

    // 验证参数
    if (!executorAgentId || !taskTitle) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：executorAgentId, taskTitle' },
        { status: 400 }
      );
    }

    console.log(`[Test] 测试对话判断功能`);
    console.log(`[Test] 执行 Agent: ${getAgentName(executorAgentId)} (ID: ${executorAgentId})`);
    console.log(`[Test] 任务: ${taskTitle}`);

    // 生成会话 ID
    const sessionId = `test-dialogue-${Date.now()}`;

    // 创建对话上下文
    const context: DialogueContext = {
      sessionId,
      executorAgentId,
      taskTitle,
      taskDescription: taskDescription || taskTitle,
      commandResultId: 'test-command-id',
    };

    // === 步骤 1：执行对话判断 ===
    console.log(`[Test] 步骤 1：Agent B 判断执行 Agent 是否理解任务...`);
    const dialogueResult = await judgeExecutorResponse(context);

    // === 步骤 2：总结对话 ===
    console.log(`[Test] 步骤 2：总结对话...`);
    const dialogueSummary = await summarizeDialogue(dialogueResult);

    // === 步骤 3：返回结果 ===
    console.log(`[Test] 测试完成`);

    return NextResponse.json({
      success: true,
      message: '对话判断测试成功',
      data: {
        executorAgent: {
          id: executorAgentId,
          name: getAgentName(executorAgentId),
        },
        dialogueResult: {
          sessionId: dialogueResult.sessionId,
          executorAgentId: dialogueResult.executorAgentId,
          roundCount: dialogueResult.roundCount,
          isUnderstand: dialogueResult.isUnderstand,
          completedReason: dialogueResult.completedReason,
        },
        dialogueSummary: {
          sessionId: dialogueSummary.sessionId,
          summary: dialogueSummary.summary,
          conclusion: dialogueSummary.conclusion,
          suggestedActions: dialogueSummary.suggestedActions,
          dialogueProcess: dialogueSummary.dialogueProcess,
        },
      },
    });
  } catch (error) {
    console.error(`[Test] 对话判断测试失败:`, error);
    return NextResponse.json(
      {
        success: false,
        error: '对话判断测试失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/dialogue-judgment
 * 获取测试说明
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Agent B 对话判断功能测试 API',
    description: '测试 Agent B 与执行 Agent 的对话判断功能，验证执行 Agent 身份标识',
    usage: {
      method: 'POST',
      body: {
        executorAgentId: 'insurance-c | insurance-d | ...',
        taskTitle: '任务标题',
        taskDescription: '任务描述（可选）',
      },
      examples: [
        {
          description: '测试 insurance-c 执行的任务',
          body: {
            executorAgentId: 'insurance-c',
            taskTitle: '创作保险文章',
            taskDescription: '创作一篇关于重疾险的科普文章，要求通俗易懂',
          },
        },
        {
          description: '测试 insurance-d 执行的任务',
          body: {
            executorAgentId: 'insurance-d',
            taskTitle: '设计产品原型',
            taskDescription: '设计保险产品详情页的原型图',
          },
        },
      ],
    },
    supportedExecutors: {
      'insurance-c': '保险运营（insurance-c）',
      'insurance-d': '保险内容（insurance-d）',
      'insurance-b': '保险技术负责人（insurance-b）',
      'insurance-a': '保险总裁（insurance-a）',
      'agent-b': '技术负责人（Agent B）',
      'agent-a': '总裁（Agent A）',
    },
  });
}
