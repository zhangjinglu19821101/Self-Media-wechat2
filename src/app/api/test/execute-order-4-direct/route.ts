import { NextRequest, NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';
import { db } from '@/lib/db';
import { tasks, subTaskTable } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // 1. 创建主任务
    const parentTaskId = `test-order4-${Date.now()}`;
    const taskTitle = '保险产品推广方案';
    
    const [createdTask] = await db.insert(tasks).values({
      taskId: parentTaskId,
      title: taskTitle,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      priority: 1,
      category: 'insurance-marketing',
      createdBy: 'test-user',
    }).returning();

    // 2. 创建子任务
    const subTasksData = subTasks.slice(0, 5).map((st, index) => ({
      ...st,
      id: undefined,
      taskId: parentTaskId,
      orderIndex: index + 1,
      status: index === 3 ? 'pending' : 'completed' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // 只创建 order_index=4 的任务为 pending，其他完成
    for (let i = 0; i < subTasksData.length; i++) {
      if (i !== 3) {
        subTasksData[i].status = 'completed';
        subTasksData[i].resultText = `已完成子任务 ${i + 1}`;
      }
    }

    await db.insert(subTaskTable).values(subTasksData);

    // 3. 找到 order_index=4 的任务
    const order4Task = await db.query.subTaskTable.findFirst({
      where: and(
        eq(subTaskTable.taskId, parentTaskId),
        eq(subTaskTable.orderIndex, 4)
      ),
    });

    if (!order4Task) {
      return NextResponse.json({
        success: false,
        message: '未找到 order_index=4 的任务',
      });
    }

    // 4. 执行 order_index=4 任务，注入文章内容
    const engine = new SubtaskExecutionEngine();
    
    // 准备上下文：包括上一阶段（内容创作）的输出
    const previousOutput = {
      articleTitle: '保险知识普及：如何选择适合您的医疗险',
      articleAuthor: '保险顾问团队',
      articleContent: `<p>随着人们对健康保障的重视程度不断提高，医疗险已成为许多家庭必备的保障之一。然而，面对市场上琳琅满目的医疗险产品，如何选择一款适合自己的产品成为了许多人关心的问题。</p>

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
      publishTime: new Date().toISOString(),
    };

    // 直接调用 executeCapabilityWithParams，传入完整参数
    const result = await engine.executeCapabilityWithParams({
      taskId: order4Task.id,
      commandResultId: order4Task.commandResultId || `cmd-${order4Task.id}`,
      capabilityId: 11, // wechat add_draft
      params: {
        articles: [{
          title: previousOutput.articleTitle,
          author: previousOutput.articleAuthor,
          digest: '本文介绍如何选择适合的医疗险产品',
          content: previousOutput.articleContent,
          showCoverPic: 0,
          needOpenComment: 0,
        }],
        accountId: 'insurance-account',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'order_index=4 任务直接执行完成',
      parentTask: {
        id: createdTask.id,
        taskId: parentTaskId,
      },
      order4Task: {
        id: order4Task.id,
        orderIndex: 4,
        taskTitle: order4Task.title,
        status: order4Task.status,
      },
      executionResult: result,
    });
  } catch (error) {
    console.error('[Test Route] 执行失败:', error);
    return NextResponse.json({
      success: false,
      message: '执行失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
