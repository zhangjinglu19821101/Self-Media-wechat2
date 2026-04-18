/**
 * 完整测试 order_index=4 的流程
 * 创建任务 -> 创建子任务 -> 执行 order_index=4 (上传微信公众号草稿箱)
 * POST /api/test/full-test-order-4
 */

import { NextRequest, NextResponse } from 'next/server';
import { subtaskEngine } from '@/lib/services/subtask-execution-engine';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { agentTasks, agentSubTasks } from '@/lib/db/schema';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { v4 as uuidv4 } from 'uuid';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('========== [FullTestOrder4] 开始完整测试 ==========');

    // 1. 创建任务记录 (agentTasks)
    const taskId = `task-A-to-insurance-d-${Date.now()}`;
    const coreCommand = '创作5篇关于保险科普的文章，覆盖健康险、寿险、意外险等';
    
    const insertedTasks = await db.insert(agentTasks).values({
      id: generateUUID(),
      taskId,
      taskName: '保险科普文章创作',
      coreCommand,
      executor: 'insurance-d',
      acceptanceCriteria: '每篇文章800-1000字，内容准确通俗',
      taskType: 'master',
      splitStatus: 'split_completed',
      taskDurationStart: new Date(),
      taskDurationEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      totalDeliverables: '5篇保险科普文章',
      taskPriority: 'normal',
      taskStatus: 'in_progress',
      creator: 'A',
      updater: 'TS',
      fromAgentId: 'A',
      toAgentId: 'insurance-d',
      commandType: 'instruction',
      metadata: { taskType: 'article_creation' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    const parentTask = insertedTasks[0];
    console.log(`[FullTestOrder4] 创建任务成功: ${parentTask.id}`);

    // 2. 创建子任务（模拟 Agent B 的拆分结果）
    // order_index=1: 选题策划
    // order_index=2: 内容创作  
    // order_index=3: 合规审核
    // order_index=4: 上传微信公众号草稿箱
    // order_index=5: 汇总报告
    
    const subTasksToCreate = [
      {
        orderIndex: 1,
        taskTitle: '选题策划',
        taskDescription: '根据保险科普主题，策划5篇文章选题方向',
        executor: 'insurance-d',
        isCritical: false,
        acceptanceCriteria: '产出5个选题方向，每个方向有明确的主题和角度',
      },
      {
        orderIndex: 2,
        taskTitle: '内容创作',
        taskDescription: '根据选题方向，创作5篇文章内容',
        executor: 'insurance-d',
        isCritical: true,
        acceptanceCriteria: '每篇文章800-1000字，内容准确、通俗易懂',
      },
      {
        orderIndex: 3,
        taskTitle: '合规审核',
        taskDescription: '对创作的文章进行合规性审核',
        executor: 'insurance-d',
        isCritical: true,
        acceptanceCriteria: '确保文章内容符合微信公众号发布规范',
      },
      {
        orderIndex: 4,
        taskTitle: '上传微信公众号草稿箱',
        taskDescription: '将审核通过的文章上传到微信公众号草稿箱',
        executor: 'insurance-d',
        isCritical: true,
        acceptanceCriteria: '文章成功上传到微信公众号草稿箱，获得 media_id',
      },
      {
        orderIndex: 5,
        taskTitle: '汇总报告',
        taskDescription: '汇总本次文章创作任务的执行情况',
        executor: 'insurance-d',
        isCritical: false,
        acceptanceCriteria: '产出任务执行报告，包括完成情况、问题说明等',
      },
    ];

    const createdSubTasks: any[] = [];
    for (const st of subTasksToCreate) {
      const subTaskId = generateUUID();
      
      // 🔴 【测试用】给 order_index=2 添加模拟的文章内容
      let taskResultData: any = undefined;
      if (st.orderIndex === 2) {
        taskResultData = {
          draftContent: `<p><strong>保险知识普及：如何选择适合您的医疗险</strong></p>
<p>随着人们对健康保障的重视程度不断提高，医疗险已成为许多家庭必备的保障之一。然而，面对市场上琳琅满目的医疗险产品，如何选择一款适合自己的产品成为了许多人关心的问题。</p>

<p><strong>一、了解医疗险的基本类型</strong></p>
<p>医疗险主要分为两种类型：定额给付型和费用报销型。定额给付型保险在被保险人患有合同约定的疾病时，保险公司会一次性支付约定的保险金；而费用报销型保险则是对被保险人因疾病或意外产生的医疗费用进行报销。</p>

<p><strong>二、选择医疗险的关键要素</strong></p>
<ul>
<li><strong>保障范围</strong>：选择医疗险时，首先要关注保障范围是否广泛，是否包含常见疾病和特殊疾病的治疗费用。</li>
<li><strong>免赔额</strong>：免赔额越低，实际获得的保障越多，但相应的保费可能也会更高。</li>
<li><strong>报销比例</strong>：报销比例越高，自付部分越少，保障力度越强。</li>
<li><strong>续保条件</strong>：优先选择保证续保的产品，避免因健康状况变化而失去保障。</li>
</ul>

<p><strong>三、不同人群的医疗险选择建议</strong></p>
<p>对于年轻人来说，可以选择保费较低、保障适中的产品；而对于中老年人，则应重点关注保障范围和续保条件。</p>

<p>总之，选择一款合适的医疗险需要综合考虑多方面因素。建议您在购买前详细了解产品条款，必要时可以咨询专业的保险顾问。</p>`,
          articleTitle: '保险知识普及：如何选择适合您的医疗险',
          author: '保险顾问团队',
          publishTime: new Date().toISOString(),
        };
        console.log(`[FullTestOrder4] 🔴 为 order_index=2 添加模拟文章内容`);
      }
      
      const inserted = await db.insert(agentSubTasks).values({
        id: subTaskId,
        commandResultId: parentTask.id,
        fromParentsExecutor: st.executor,
        agentId: st.executor,
        taskTitle: st.taskTitle,
        taskDescription: st.taskDescription,
        status: st.orderIndex < 4 ? 'completed' : 'pending', // 前序任务标记为完成
        orderIndex: st.orderIndex,
        isDispatched: false,
        dialogueRounds: 0,
        dialogueStatus: 'none',
        escalated: false,
        timeoutHandlingCount: 0,
        feedbackHistory: [],
        resultData: taskResultData, // 🔴 添加结果数据
        metadata: {
          acceptanceCriteria: st.acceptanceCriteria,
          isCritical: st.isCritical,
          executor: st.executor,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      createdSubTasks.push(inserted[0]);
      console.log(`[FullTestOrder4] 创建子任务 ${st.orderIndex}: ${st.taskTitle} (${inserted[0].id})`);
    }

    // 3. 找到 order_index=4 的任务
    const order4Task = createdSubTasks.find(t => t.orderIndex === 4);
    
    if (!order4Task) {
      return NextResponse.json({ error: '未找到 order_index=4 的任务' }, { status: 404 });
    }

    console.log(`[FullTestOrder4] 开始执行 order_index=4: ${order4Task.taskTitle}`);
    console.log(`[FullTestOrder4] 任务ID: ${order4Task.id}`);

    // 4. 执行 order_index=4 任务（调用 Agent T 的工作流）
    console.log('[FullTestOrder4] 调用 executeAgentTExecutorWorkflow...');
    const engine = subtaskEngine as any;
    await engine.executeAgentTExecutorWorkflow(order4Task);

    console.log('[FullTestOrder4] ========== 执行完成 ==========');

    // 5. 查询最新状态
    const updatedTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, order4Task.id))
      .then(res => res[0]);

    console.log(`[FullTestOrder4] 最终状态: ${updatedTask.status}`);
    console.log(`[FullTestOrder4] resultText: ${updatedTask.resultText?.substring(0, 500)}...`);

    return NextResponse.json({
      success: true,
      message: 'order_index=4 任务执行完成',
      parentTask: {
        id: parentTask.id,
        taskId: parentTask.taskId,
      },
      order4Task: {
        id: updatedTask.id,
        orderIndex: updatedTask.orderIndex,
        taskTitle: updatedTask.taskTitle,
        status: updatedTask.status,
        resultText: updatedTask.resultText,
        resultData: updatedTask.resultData,
      },
      allSubTasks: createdSubTasks.map(st => ({
        id: st.id,
        orderIndex: st.orderIndex,
        taskTitle: st.taskTitle,
        status: st.status,
      })),
    });

  } catch (error) {
    console.error('[FullTestOrder4] 执行失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}
