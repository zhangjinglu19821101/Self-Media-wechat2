
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, commandResults } from '@/lib/db/schema';
import { generateUUID } from '@/lib/utils/uuid';
import { getCurrentBeijingTime } from '@/lib/utils/date';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

// 测试：对比 base_article 和 platform_adaptation 两种合规校验任务的执行
export async function POST(request: Request) {
  try {
    console.log('========================================');
    console.log('📋 [对比测试] base_article vs platform_adaptation');
    console.log('========================================');

    // 1. 创建两个父任务
    const tasksToCreate = [
      {
        type: 'base_article',
        name: '公众号 base_article 合规校验',
        platform: '微信公众号',
        phase: 'base_article'
      },
      {
        type: 'platform_adaptation',
        name: '小红书 platform_adaptation 合规校验',
        platform: '小红书',
        phase: 'platform_adaptation'
      }
    ];

    const createdParents: any[] = [];
    const createdSubtasks: any[] = [];

    for (const taskConfig of tasksToCreate) {
      // 创建父任务
      const parentId = generateUUID();
      const [parent] = await db.insert(commandResults).values({
        id: parentId,
        workspaceId: 'test-workspace-001',
        userId: 'test-user-001',
        status: 'in_progress',
        userInstruction: `测试 ${taskConfig.name}`,
        contentPieces: [],
        coreOpinion: '合规校验测试',
        emotionTone: '专业',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      createdParents.push({ config: taskConfig, parent });
      console.log(`✅ 创建父任务成功: ${taskConfig.name} (${parentId})`);

      // 创建子任务：合规校验
      const subtaskId = generateUUID();
      const taskTitle = taskConfig.platform === '微信公众号' ? '合规校验' : '[小红书] 合规校验';
      const [subtask] = await db.insert(agentSubTasks).values({
        id: subtaskId,
        commandResultId: parentId,
        fromParentsExecutor: 'T',
        agentId: 'T',
        taskTitle: taskTitle,
        taskDescription: '对文章进行合规性校验',
        status: 'pending',
        orderIndex: taskConfig.platform === '微信公众号' ? 5 : 4,
        isDispatched: false,
        dialogueRounds: 0,
        dialogueStatus: 'none',
        escalated: false,
        timeoutHandlingCount: 0,
        feedbackHistory: [],
        resultData: null,
        metadata: {
          phase: taskConfig.phase,
          platform: taskConfig.platform,
          platformLabel: taskConfig.platform
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      createdSubtasks.push({ config: taskConfig, subtask });
      console.log(`✅ 创建子任务成功: ${taskTitle} (order_index=${subtask.orderIndex}, phase=${taskConfig.phase})`);
    }

    console.log('');
    console.log('========================================');
    console.log('📊 任务对比信息');
    console.log('========================================');

    for (let i = 0; i &lt; createdSubtasks.length; i++) {
      const { config, subtask } = createdSubtasks[i];
      console.log(`\n[任务 ${i+1}] ${config.name}`);
      console.log('  order_index:', subtask.orderIndex);
      console.log('  fromParentsExecutor:', subtask.fromParentsExecutor);
      console.log('  taskTitle:', subtask.taskTitle);
      console.log('  metadata:', JSON.stringify(subtask.metadata, null, 4));
    }

    console.log('');
    console.log('========================================');
    console.log('🔧 准备数据（给前序任务添加内容）');
    console.log('========================================');

    // 模拟前序任务有内容
    for (const { config, subtask, parent } of createdParents.map((cp, i) =&gt; ({ ...cp, subtask: createdSubtasks[i].subtask }))) {
      // 模拟前序任务有文章内容
      const dummyPrevResult = {
        id: generateUUID(),
        commandResultId: parent.parent.id,
        orderIndex: subtask.orderIndex - 1,
        resultText: config.platform === '微信公众号'
          ? `【任务${subtask.orderIndex - 1}】用户预览修改初稿\n结果：&lt;p&gt;&lt;strong&gt;保险知识普及&lt;/strong&gt;&lt;/p&gt;\n&lt;p&gt;保险是...&lt;/p&gt;`
          : `【任务${subtask.orderIndex - 1}】用户预览修改图文\n结果：# 保险知识普及\n\n保险...`
      };
      console.log(`✅ [${config.name}] 模拟前序任务 ${dummyPrevResult.orderIndex} 有内容`);
    }

    console.log('');
    console.log('========================================');
    console.log('🚀 开始执行 Agent T 工作流');
    console.log('========================================');

    const engine = SubtaskExecutionEngine.getInstance();
    const engineAny = engine as any;

    for (let i = 0; i &lt; createdSubtasks.length; i++) {
      const { config, subtask } = createdSubtasks[i];
      console.log(`\n────────────────────────────────────────`);
      console.log(`🚀 开始执行: ${config.name}`);
      console.log(`   order_index: ${subtask.orderIndex}`);
      console.log(`   phase: ${config.phase}`);
      console.log(`   taskTitle: ${subtask.taskTitle}`);
      console.log(`────────────────────────────────────────`);

      try {
        await engineAny.executeAgentTExecutorWorkflow(subtask);
        console.log(`✅ ${config.name} 执行完成`);
      } catch (err) {
        console.error(`❌ ${config.name} 执行失败:`, err);
      }
    }

    // 查询最终状态
    console.log('');
    console.log('========================================');
    console.log('📝 最终结果查询');
    console.log('========================================');

    const finalResults: any[] = [];
    for (const { config, subtask } of createdSubtasks) {
      const [final] = await db.select().from(agentSubTasks).where(db.eq(agentSubTasks.id, subtask.id));
      finalResults.push({
        config,
        subtaskId: subtask.id,
        finalStatus: final?.status,
        resultText: final?.resultText,
        resultData: final?.resultData
      });

      console.log(`\n[${config.name}]`);
      console.log('  最终状态:', final?.status);
      console.log('  resultText:', final?.resultText?.substring(0, 300));
    }

    return NextResponse.json({
      success: true,
      message: '对比测试完成',
      parents: createdParents.map(p =&gt; ({ type: p.config.type, id: p.parent.id })),
      subtasks: createdSubtasks.map(s =&gt; ({ type: s.config.type, id: s.subtask.id })),
      results: finalResults
    });

  } catch (error) {
    console.error('❌ 对比测试失败:', error);
    return NextResponse.json(
      { error: '测试失败', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
