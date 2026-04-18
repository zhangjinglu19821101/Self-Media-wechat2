import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

export async function GET() {
  try {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║      前序结果选择逻辑 - 完整演示（重点展示提示词）       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🎯 测试场景：');
    console.log('   1. 文章创作 (orderIndex=1) - 已完成');
    console.log('   2. 合规校验 (orderIndex=2) - 已完成');
    console.log('   3. 文章优化整改 (orderIndex=3) - 待执行');
    console.log('');

    const engine = new SubtaskExecutionEngine();

    console.log('🧪 步骤1: 创建模拟测试数据...\n');

    const commandResultId = 'test-precedent-demo-001';

    const mockTasks = [
      {
        id: 'subtask-demo-001',
        commandResultId,
        fromParentsExecutor: 'insurance-d',
        taskTitle: '文章创作',
        taskDescription: '创作一篇关于年终奖理财的保险科普文章',
        status: 'completed',
        orderIndex: 1,
        executionResult: JSON.stringify({
          isCompleted: true,
          result: '文章创作完成：《年终奖到手，这笔钱一定要规划好！\n\n这是一篇关于年终奖理财规划的保险科普文章...\n\n文章内容通俗易懂，适合大众阅读。',
          suggestion: '文章已创作完成，内容通俗易懂'
        }),
        resultText: '文章创作完成：《年终奖到手，这笔钱一定要规划好！》\n\n文章内容：\n这是一篇关于年终奖理财规划的保险科普文章...',
        metadata: { test: true },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'subtask-demo-002',
        commandResultId,
        fromParentsExecutor: 'insurance-d',
        taskTitle: '合规校验',
        taskDescription: '对文章进行合规性检查',
        status: 'completed',
        orderIndex: 2,
        executionResult: JSON.stringify({
          isCompleted: true,
          result: '合规校验完成：文章内容基本符合金融保险合规要求，发现2个需要优化的点：\n1. 部分表述需要调整，避免夸大收益\n2. 建议增加风险提示段落',
          suggestion: '建议进行文章优化整改'
        }),
        resultText: '合规校验完成：发现2个需要优化的点\n1. 部分表述需要调整\n2. 建议增加风险提示',
        metadata: { test: true },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'subtask-demo-003',
        commandResultId,
        fromParentsExecutor: 'insurance-d',
        taskTitle: '文章优化整改',
        taskDescription: '根据合规校验结果对文章进行优化整改',
        status: 'pending',
        orderIndex: 3,
        metadata: { test: true },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    console.log('✅ 模拟测试数据创建完成！\n');
    console.log('📋 测试数据概览：');
    mockTasks.forEach(task => {
      console.log(`  - 步骤${task.orderIndex}: ${task.taskTitle} [${task.status}]`);
    });
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 步骤2: 获取前序结果（精选清单格式）');
    console.log('═══════════════════════════════════════════════════════════\n');

    const step3 = mockTasks.find(t => t.orderIndex === 3)!;
    const previousResultText = (engine as any).getPreviousStepResult(
      mockTasks as any,
      step3.orderIndex,
      step3 as any
    );

    console.log('📋 【前置任务结果清单】');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(previousResultText);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎯 步骤3: 模拟生成给 insurance-d 的完整提示词');
    console.log('═══════════════════════════════════════════════════════════\n');

    const currentTaskText = `【当前任务】
任务标题：${step3.taskTitle}
任务描述：${step3.taskDescription}`;

    const fullPromptToInsuranceD = `
${mockTasks.find(t => t.orderIndex === 2)?.resultText || ''}

【执行者Agent标准指令】

你是任务执行者，仅对分配给你的具体任务负责，不需要思考任务是否正确、是否有价值等。

你的核心职责：
1. 仔细阅读"当前任务"和提供的"前置任务结果"
2. 调用合适的MCP工具或直接执行完成该任务
3. 完成后调用decision_maker，将结果返回给协调者

你不需要：
- 质疑任务的合理性
- 担心任务是否完整
- 思考后续步骤

你只需要：
- 专注于当前分配给你的具体任务
- 用最好的方式完成它
- 及时返回结果

重要提示：
- 如果任务需要的信息在前置任务结果中，请直接使用，不要重复劳动
- 如果发现前置任务结果有问题或缺失，如实报告，不要猜测
- 如果任务需要多个步骤，一步步执行，不要急于求成

记住：你是专业的执行者，高效、准确地完成任务是你的唯一目标！

${previousResultText}

${currentTaskText}

---

【前序信息选择说明】
现在，请先从上述前置任务结果中，选择你认为执行当前任务所需要的信息。

请按以下JSON格式返回你的选择：
{
  "status": "completed",
  "result": {
    "selectedSubtasks": [
      {
        "subtaskId": "子任务ID",
        "orderIndex": 1,
        "reason": "为什么选择这个子任务"
      }
    ],
    "selectedMcpResults": [
      {
        "mcpResultId": "MCP结果ID",
        "reason": "为什么选择这个MCP结果"
      }
    ]
  },
  "message": "选择说明",
  "confidence": 90,
  "timestamp": "${new Date().toISOString()}",
  "agentVersion": "1.0.0"
}
`;

    console.log('📝 给 insurance-d 的完整提示词：');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(fullPromptToInsuranceD);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🤖 步骤4: 模拟 insurance-d 选择后返回的结果');
    console.log('═══════════════════════════════════════════════════════════\n');

    const insuranceDSelectionResult = {
      status: "completed",
      result: {
        selectedSubtasks: [
          {
            subtaskId: "subtask-demo-001",
            orderIndex: 1,
            reason: "需要原始文章内容进行优化"
          },
          {
            subtaskId: "subtask-demo-002",
            orderIndex: 2,
            reason: "需要合规校验的具体问题清单"
          }
        ],
        selectedMcpResults: []
      },
      message: "已选择文章创作和合规校验的结果，这两个结果对文章优化整改都很重要",
      confidence: 95,
      timestamp: new Date().toISOString(),
      agentVersion: "1.0.0"
    };

    console.log('📤 insurance-d 返回的选择结果：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(JSON.stringify(insuranceDSelectionResult, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔧 步骤5: 使用 PrecedentSelectorController 解析选择结果');
    console.log('═══════════════════════════════════════════════════════════\n');

    const { PrecedentSelectorController } = require('@/lib/agents/precedent-selector-controller');

    console.log('🧪 解析 insurance-d 返回的JSON...');
    const parsedResult = PrecedentSelectorController.parseAgentResponse(
      JSON.stringify(insuranceDSelectionResult)
    );

    console.log('✅ 解析结果：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  status:', parsedResult.status);
    console.log('  message:', parsedResult.message);
    console.log('  confidence:', parsedResult.confidence);
    console.log('  selectedSubtasks:', parsedResult.result.selectedSubtasks);
    console.log('  selectedMcpResults:', parsedResult.result.selectedMcpResults);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 步骤6: 根据选择提取前序信息（精选后）');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('🎯 选择的子任务：');
    parsedResult.result.selectedSubtasks.forEach((selection: any) => {
      const task = mockTasks.find(t => t.id === selection.subtaskId);
      console.log(`  • 步骤${selection.orderIndex}: ${task?.taskTitle}`);
      console.log(`    原因: ${selection.reason}`);
      console.log(`    内容: ${task?.resultText?.substring(0, 100)}...\n`);
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 步骤7: 拼装最终执行提示词（精选后的前序信息）');
    console.log('═══════════════════════════════════════════════════════════\n');

    const finalPrompt = `
你需要执行以下任务：
【当前任务】
${currentTaskText}

---

【已选择的前序信息】

【子任务1：文章创作】
标题：文章创作
描述：创作一篇关于年终奖理财的保险科普文章
状态：completed
执行结果：
文章创作完成：《年终奖到手，这笔钱一定要规划好！》

文章内容：
这是一篇关于年终奖理财规划的保险科普文章...

【子任务2：合规校验】
标题：合规校验
描述：对文章进行合规性检查
状态：completed
执行结果：
合规校验完成：发现2个需要优化的点
1. 部分表述需要调整
2. 建议增加风险提示

---

现在请执行这个任务。如果需要调用MCP工具，请直接调用。
`;

    console.log('📝 最终给 insurance-d 的执行提示词：');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(finalPrompt);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                        演示完成                            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 流程总结：');
    console.log('  1. 获取所有前序任务，生成【前置任务结果清单】');
    console.log('  2. 给 insurance-d 发送完整提示词（包含所有前序信息 + 当前任务）');
    console.log('  3. insurance-d 选择需要的前序信息（selectedSubtasks）');
    console.log('  4. PrecedentSelectorController 解析选择结果');
    console.log('  5. 根据选择提取对应前序信息');
    console.log('  6. 拼装最终执行提示词（仅包含选中的前序信息）');
    console.log('');

    return NextResponse.json({
      success: true,
      message: '前序结果选择逻辑演示完成',
      flow: {
        step1: '获取前序任务，生成精选清单',
        step2: '给 insurance-d 发送完整提示词',
        step3: 'insurance-d 选择需要的前序信息',
        step4: '解析选择结果',
        step5: '提取选中的前序信息',
        step6: '拼装最终执行提示词'
      },
      keyOutputs: {
        curatedListFormat: previousResultText,
        fullPromptToInsuranceD: fullPromptToInsuranceD,
        insuranceDSelectionResult: insuranceDSelectionResult,
        finalExecutionPrompt: finalPrompt
      }
    });

  } catch (error) {
    console.error('❌ 演示失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
