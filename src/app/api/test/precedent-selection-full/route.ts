import { NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

// 模拟任务数据（基于用户提供的场景）
const mockSubTasks = [
  {
    id: 'task-1',
    commandResultId: 'e41a73e1',
    fromParentsExecutor: null,
    taskTitle: '文章创作',
    taskDescription: '根据给定主题创作一篇完整的文章',
    status: 'completed',
    orderIndex: 1,
    isDispatched: true,
    dispatchedAt: new Date(),
    timeoutHandlingCount: 0,
    feedbackHistory: [],
    lastFeedbackAt: null,
    escalated: false,
    escalatedAt: null,
    escalatedReason: null,
    executionResult: JSON.stringify({
      article: `# 人工智能在医疗领域的应用

随着科技的快速发展，人工智能（AI）正在深刻改变着医疗行业。从诊断到治疗，从药物研发到健康管理，AI 的身影无处不在。

## AI 在医学影像诊断中的应用

医学影像是 AI 应用最为成熟的领域之一。通过深度学习算法，计算机可以在几秒内分析成千上万张 CT、MRI 或 X 光片，准确率甚至超过经验丰富的放射科医生。

### 实际案例

某知名医院引入 AI 辅助诊断系统后，肺癌早期筛查的准确率提高了 30%，患者平均等待时间缩短了 50%。

## 个性化治疗方案制定

AI 可以分析患者的基因数据、病史、生活习惯等多维信息，为每位患者制定最适合的个性化治疗方案。这种精准医疗的理念正在改变传统的治疗模式。

## 挑战与展望

尽管 AI 在医疗领域取得了显著成就，但仍面临数据隐私、算法透明度、伦理问题等挑战。然而，随着技术的不断进步和政策的逐步完善，AI 必将在医疗健康领域发挥更大的作用。

未来，我们可以期待 AI 与医疗的深度融合，为人类健康带来更多福祉。`,
      wordCount: 452,
      topics: ['人工智能', '医疗', '精准医疗', '医学影像'],
      qualityScore: 85
    }),
    statusProof: null,
    startedAt: new Date(Date.now() - 3600000),
    completedAt: new Date(Date.now() - 1800000),
    dialogueSessionId: null,
    dialogueRounds: 0,
    dialogueStatus: null,
    lastDialogueAt: null,
    executionDate: new Date(),
    metadata: null,
    articleMetadata: null,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'task-2',
    commandResultId: 'e41a73e1',
    fromParentsExecutor: null,
    taskTitle: '合规校验',
    taskDescription: '检查文章内容是否符合平台发布规范和相关法律法规',
    status: 'completed',
    orderIndex: 2,
    isDispatched: true,
    dispatchedAt: new Date(),
    timeoutHandlingCount: 0,
    feedbackHistory: [],
    lastFeedbackAt: null,
    escalated: false,
    escalatedAt: null,
    escalatedReason: null,
    executionResult: JSON.stringify({
      complianceCheck: {
        passed: true,
        issues: [],
        recommendations: [
          '建议在提及具体医院名称时进行匿名化处理',
          '建议补充引用数据来源以增强可信度'
        ],
        riskLevel: 'low'
      },
      factCheck: {
        accuracy: 'high',
        verifiedClaims: 12,
        disputedClaims: 0
      },
      overallRating: 'ready_for_publication'
    }),
    statusProof: null,
    startedAt: new Date(Date.now() - 1800000),
    completedAt: new Date(Date.now() - 900000),
    dialogueSessionId: null,
    dialogueRounds: 0,
    dialogueStatus: null,
    lastDialogueAt: null,
    executionDate: new Date(),
    metadata: null,
    articleMetadata: null,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'task-3',
    commandResultId: 'e41a73e1',
    fromParentsExecutor: null,
    taskTitle: '文章优化整改',
    taskDescription: '根据合规校验结果和用户反馈对文章进行优化改进',
    status: 'pending',
    orderIndex: 3,
    isDispatched: false,
    dispatchedAt: null,
    timeoutHandlingCount: 0,
    feedbackHistory: [],
    lastFeedbackAt: null,
    escalated: false,
    escalatedAt: null,
    escalatedReason: null,
    executionResult: null,
    statusProof: null,
    startedAt: null,
    completedAt: null,
    dialogueSessionId: null,
    dialogueRounds: 0,
    dialogueStatus: null,
    lastDialogueAt: null,
    executionDate: new Date(),
    metadata: null,
    articleMetadata: null,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// 模拟 insurance-d 的选择逻辑
function simulateInsuranceDSelection(prompt: string) {
  // 解析提示词中的任务信息
  const currentTaskMatch = prompt.match(/当前任务\[.*?\](.*?)(?=\n\n)/s);
  const previousTasksMatch = prompt.match(/前序已完成的步骤：([\s\S]*?)(?=\n\n请从上述)/);

  let selectedResult = null;
  let reasoning = '';

  if (currentTaskMatch && previousTasksMatch) {
    const currentTaskText = currentTaskMatch[1];
    const previousTasksText = previousTasksMatch[1];

    // 根据当前任务类型选择最相关的前序结果
    if (currentTaskText.includes('文章优化整改') || currentTaskText.includes('优化整改')) {
      // 文章优化整改需要文章创作结果
      selectedResult = '文章创作';
      reasoning = '当前任务是"文章优化整改"，需要基于原始文章内容进行优化，因此选择"文章创作"的结果作为前置输入。虽然"合规校验"也提供了重要的反馈信息，但文章内容本身是优化整改的基础。';
    } else if (currentTaskText.includes('合规校验')) {
      // 合规校验需要文章创作结果
      selectedResult = '文章创作';
      reasoning = '当前任务是"合规校验"，需要检查文章内容的合规性，因此选择"文章创作"的结果作为前置输入。';
    } else {
      // 默认选择最近的一个已完成任务
      selectedResult = '文章创作';
      reasoning = '选择最近完成的"文章创作"任务结果作为前置输入。';
    }
  }

  return {
    selectedResult,
    reasoning,
    fullResponse: `我已经分析了当前任务和前序已完成的步骤。

## 选择结果
**selected_previous_result: "${selectedResult}"**

## 推理过程
${reasoning}

## 总结
基于当前任务的性质和前序任务的依赖关系，我认为"${selectedResult}"的结果是最相关的前置输入。`
  };
}

export async function GET() {
  try {
    console.log('');
    console.log('🧪 开始完整的前序结果选择流程演示...');
    console.log('============================================================================');
    console.log('');

    // 1. 显示测试场景
    console.log('📋 测试场景:');
    console.log('  - 任务1 (orderIndex=1): 文章创作 (已完成)');
    console.log('  - 任务2 (orderIndex=2): 合规校验 (已完成)');
    console.log('  - 任务3 (orderIndex=3): 文章优化整改 (待执行)');
    console.log('');
    console.log('🎯 目标: 为任务3"文章优化整改"选择合适的前序结果');
    console.log('');

    // 2. 实例化引擎
    console.log('🔧 步骤1: 实例化 SubtaskExecutionEngine...');
    const engine = new SubtaskExecutionEngine();
    console.log('✅ 引擎实例化成功');
    console.log('');

    // 3. 测试不同 orderIndex 的选择逻辑
    console.log('🧪 步骤2: 逐个测试前序结果选择...');
    console.log('');

    const results: any[] = [];

    for (const task of mockSubTasks) {
      console.log('────────────────────────────────────────────────────────────────');
      console.log(`🎯 任务 orderIndex = ${task.orderIndex}: ${task.taskTitle}`);
      console.log(`   状态: ${task.status}`);
      console.log('');

      if (task.status === 'pending') {
        console.log('📝 生成传递给 insurance-d 的提示词...');
        console.log('');
        
        // 这里模拟构建提示词的逻辑
        const prompt = buildInsuranceDPrompt(mockSubTasks, task);
        
        console.log('════════════════════════════════════════════════════════════');
        console.log('📨 传递给 insurance-d 的完整提示词:');
        console.log('════════════════════════════════════════════════════════════');
        console.log(prompt);
        console.log('════════════════════════════════════════════════════════════');
        console.log('');

        console.log('🤖 模拟 insurance-d 的选择...');
        console.log('');
        
        const insuranceDResponse = simulateInsuranceDSelection(prompt);
        
        console.log('════════════════════════════════════════════════════════════');
        console.log('📨 insurance-d 返回的完整结果:');
        console.log('════════════════════════════════════════════════════════════');
        console.log(insuranceDResponse.fullResponse);
        console.log('════════════════════════════════════════════════════════════');
        console.log('');

        console.log('📊 解析后的选择结果:');
        console.log('   selected_previous_result:', insuranceDResponse.selectedResult);
        console.log('   推理过程:', insuranceDResponse.reasoning);
        console.log('');

        results.push({
          orderIndex: task.orderIndex,
          taskTitle: task.taskTitle,
          status: task.status,
          promptSent: prompt,
          insuranceDResponse: insuranceDResponse,
          selectedResult: insuranceDResponse.selectedResult
        });
      } else {
        // 对于已完成的任务，也展示 getPreviousStepResult 的结果
        const previousResult = engine.getPreviousStepResult(mockSubTasks as any, task.orderIndex);
        
        console.log('🔍 getPreviousStepResult() 结果:');
        console.log('   前序结果是否存在:', previousResult !== null);
        if (previousResult) {
          console.log('   前序结果预览:', JSON.stringify(previousResult).substring(0, 100) + '...');
        }
        console.log('');

        results.push({
          orderIndex: task.orderIndex,
          taskTitle: task.taskTitle,
          status: task.status,
          hasPreviousResult: previousResult !== null
        });
      }

      console.log('');
    }

    console.log('');
    console.log('📊 最终演示总结:');
    console.log('============================================================================');
    console.log('');
    console.log('✅ 演示成功完成！');
    console.log('');
    console.log('📝 关键要点:');
    console.log('   1. 对于待执行的任务（orderIndex=3），系统构建了完整的提示词');
    console.log('   2. 提示词包含了当前任务信息和所有前序已完成的任务详情');
    console.log('   3. insurance-d 根据当前任务类型智能选择最相关的前序结果');
    console.log('   4. 在这个案例中，"文章优化整改"选择了"文章创作"的结果');
    console.log('');
    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: '前序结果选择完整流程演示完成',
      demo: {
        scenario: '文章创作 → 合规校验 → 文章优化整改',
        targetTask: '文章优化整改 (orderIndex=3)',
        results: results,
        keyInsights: [
          '提示词包含当前任务和所有前序已完成任务的完整信息',
          'insurance-d 根据任务依赖关系智能选择最相关的前序结果',
          '选择逻辑考虑了任务类型和工作流的先后顺序'
        ]
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

// 构建 insurance-d 提示词的函数
function buildInsuranceDPrompt(subTasks: any[], currentTask: any): string {
  const completedTasks = subTasks
    .filter(t => t.status === 'completed' && t.orderIndex < currentTask.orderIndex)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  let prompt = `你是一个智能的前置结果选择助手。请分析当前任务和前序已完成的步骤，选择最适合作为当前任务前置输入的那一个前序结果。

当前任务[${currentTask.orderIndex}] ${currentTask.taskTitle}
${currentTask.taskDescription}

前序已完成的步骤：
`;

  completedTasks.forEach((task, index) => {
    prompt += `
[${task.orderIndex}] ${task.taskTitle}
状态：${task.status}
执行结果：
${task.executionResult ? (typeof task.executionResult === 'string' ? task.executionResult : JSON.stringify(task.executionResult, null, 2)) : '无'}
`;
  });

  prompt += `
请从上述前序已完成的步骤中，选择最适合作为当前任务前置输入的那一个结果。你必须严格按照以下格式进行返回，不要包含任何额外内容：

\`\`\`json
{
  "selected_previous_result": "<你选择的前序步骤的标题，如"方案生成" or "资料收集"等>"
}
\`\`\`

注意：
1. 你只能选择一个前序结果
2. 如果有多个前序结果，选择与当前任务最相关的那一个
3. 返回的JSON必须严格遵守格式，只包含 selected_previous_result 字段
4. 如果没有合适的前序结果，可以选择空字符串，但必须返回JSON格式
`;

  return prompt;
}
