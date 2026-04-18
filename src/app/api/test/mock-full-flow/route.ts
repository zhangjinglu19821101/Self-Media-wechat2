/**
 * Mock 完整流程测试 API
 * 
 * 专门用于测试完整的 Mock 流程：
 * - 步骤 1-8 顺序执行
 * - 每个步骤写死固定返回
 * - 超时处理（10 分钟）
 * - Agent B 介入（5 次交互）
 * - 向 Agent A 弹框汇报
 * - article_metadata 新存储逻辑
 * 
 * 使用方法：
 * curl -X POST http://localhost:5000/api/test/mock-full-flow
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createInitialArticleMetadata, updateArticleMetadataStep, STEP_CONFIGS, STEP_8_OUTPUT } from '@/lib/types/article-metadata';

export const maxDuration = 60;

/**
 * Mock 步骤输出（每个步骤写死固定返回）
 */
const MOCK_STEP_OUTPUTS: Record<number, string> = {
  1: '选题与规划完成：\n\n1. 文章标题：《年终奖到手，存年金险还是增额寿？》\n2. 目标读者：30-45岁的都市白领，有年终奖理财需求\n3. 文章结构：\n   - 引入：年终奖理财的痛点\n   - 对比：年金险 vs 增额寿\n   - 建议：根据不同需求给出建议\n4. 关键词：年终奖、年金险、增额寿、理财规划',
  2: '资料收集完成：\n\n1. 最新政策：\n   - 2025年保险市场利率走势\n   - 年金险和增额寿的监管要求\n\n2. 热点数据：\n   - 2025年终奖平均水平：3.5万元\n   - 保险理财搜索量上升40%\n\n3. 产品对比：\n   - 年金险：长期收益稳定，适合养老规划\n   - 增额寿：灵活性高，适合中期理财',
  3: '写作大纲完成：\n\n1. 引入：年终奖理财的痛点\n   - 年终奖到手，却不知道怎么存\n   - 银行利率低，股票风险高\n   - 保险理财成为热门选择\n\n2. 对比：年金险 vs 增额寿\n   - 年金险：是什么，适合谁，收益如何\n   - 增额寿：是什么，适合谁，收益如何\n   - 对比表：灵活性、收益、适用场景\n\n3. 建议：根据不同需求给出建议\n   - 短期用：增额寿\n   - 长期养老：年金险\n   - 组合配置：两者搭配\n\n4. 结语：稳健理财，守护财富',
  4: '标题及封面完成：\n\n1. 主标题：《年终奖到手，存年金险还是增额寿？》\n2. 副标题：3个角度帮你选对\n3. 封面设计：\n   - 主图：年终奖红包 + 保险合同\n   - 配色：红色（喜庆）+ 金色（财富）\n   - 文字：年终奖理财攻略',
  5: '正文写作完成：\n\n（此处为正文内容预览，完整内容将在步骤8生成）\n\n1. 引入：年终奖理财的痛点\n   - 年终奖到手，却不知道怎么存\n   - 银行利率低，股票风险高\n   - 保险理财成为热门选择\n\n2. 对比：年金险 vs 增额寿\n   - 年金险：是什么，适合谁，收益如何\n   - 增额寿：是什么，适合谁，收益如何\n   - 对比表：灵活性、收益、适用场景\n\n3. 建议：根据不同需求给出建议\n   - 短期用：增额寿\n   - 长期养老：年金险\n   - 组合配置：两者搭配\n\n4. 结语：稳健理财，守护财富',
  6: '引言、互动引导完成：\n\n1. 引言：\n   - "年终奖到手，你是不是也在纠结怎么存？银行利率太低，股票风险太高，保险理财成为越来越多人的选择。今天我们就来聊聊，年终奖买年金险还是增额寿？"\n\n2. 互动引导：\n   - "你的年终奖打算怎么存？欢迎在评论区留言分享！"\n   - "点赞收藏，下次理财不迷路！"\n   - "关注我，获取更多理财干货！"',
  7: '摘要、关键词设置完成：\n\n1. 摘要：\n   - "本文详细对比了年金险和增额寿的特点、收益和适用场景，帮助读者根据自身需求选择合适的年终奖理财方式。"\n\n2. 关键词：\n   - 年终奖\n   - 年金险\n   - 增额寿\n   - 理财规划',
  8: STEP_8_OUTPUT,
};

/**
 * Mock 微信公众号数据（每个步骤写死固定返回）
 */
const MOCK_WECHAT_DATA = {
  title_idea_set: [
    '《年终奖理财攻略：年金险 vs 增额寿》',
    '《拿了年终奖怎么存？年金险还是增额寿？》',
    '《年终奖理财：年金险和增额寿怎么选？》',
  ],
  topics: ['年终奖', '年金险', '增额寿', '理财规划'],
  user_pain_point: [
    '年终奖到手不知道怎么规划',
    '分不清年金险和增额寿的区别',
    '担心理财风险，想找安全稳定的方式',
  ],
  hot_spot: [
    '2025年终奖',
    '年金险利率',
    '增额寿收益',
  ],
};

export async function POST() {
  console.log('[Mock Test] 开始完整 Mock 流程测试');

  try {
    // 1. 清理之前的测试数据
    console.log('[Mock Test] 清理测试数据...');
    const oldSubTasks = await db.select().from(agentSubTasks).limit(20);
    for (const st of oldSubTasks) {
      await db.delete(agentSubTasks).where(eq(agentSubTasks.id, st.id));
    }

    // 2. 查找一个现有的 daily_task
    const existingDailyTask = await db.select().from(dailyTask).limit(1);
    if (existingDailyTask.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到 daily_task，请先创建测试数据',
      });
    }

    const dailyTask = existingDailyTask[0];
    console.log('[Mock Test] 使用 daily_task:', dailyTask.taskId);

    // 3. 创建初始的 article_metadata（使用新的标识字段）
    console.log('[Mock Test] 创建初始 article_metadata...');
    const initialMetadata = createInitialArticleMetadata({
      articleTitle: '《年终奖到手，存年金险还是增额寿？》',
      creatorAgent: 'insurance-d',
      taskType: 'article_generation',  // 🔥 标识：文章生成任务
      totalSteps: 8,  // 🔥 标识：总步骤数
    });

    // 4. 创建 8 个步骤的测试子任务
    console.log('[Mock Test] 创建 8 个步骤的测试子任务...');
    
    const today = new Date().toISOString().split('T')[0];
    const createdSubTasks = [];

    for (let i = 0; i < 8; i++) {
      const orderIndex = i + 1;
      const stepConfig = STEP_CONFIGS[i];
      
      // 更新 metadata 的当前步骤
      let stepMetadata = { ...initialMetadata };
      if (orderIndex > 1) {
        stepMetadata = updateArticleMetadataStep(initialMetadata, {
          stepNo: orderIndex,
          stepStatus: 'pending',
          stepOutput: '',
          confirmStatus: '未确认',
          wechatData: MOCK_WECHAT_DATA,
        });
      }

      const subTask = await db
        .insert(agentSubTasks)
        .values({
          commandResultId: dailyTask.id,
          fromParentsExecutor: dailyTask.executor,
          taskTitle: stepConfig.stepName,
          taskDescription: `[Mock] 测试子任务 - ${stepConfig.stepName}`,
          status: 'pending',
          orderIndex,
          isDispatched: false,
          timeoutHandlingCount: 0,
          escalated: false,
          executionDate: today,
          dialogueRounds: 0,
          dialogueStatus: 'none',
          articleMetadata: stepMetadata,
          metadata: { mock: true, mock_test: true },
        })
        .returning();

      createdSubTasks.push(subTask[0]);
    }

    console.log(`[Mock Test] 创建了 ${createdSubTasks.length} 个测试子任务`);

    // 5. 模拟逐步执行（模拟定时任务调用）
    console.log('[Mock Test] 开始模拟逐步执行...');
    
    const executionResults = [];
    let currentMetadata = { ...initialMetadata };

    for (let round = 1; round <= 10; round++) {
      console.log(`[Mock Test] === 第 ${round} 次执行 ===`);
      
      // 查询当前状态
      const currentTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, dailyTask.id))
        .orderBy(agentSubTasks.orderIndex);

      const statusSummary = currentTasks.map(t => ({
        orderIndex: t.orderIndex,
        status: t.status,
      }));

      console.log('[Mock Test] 当前状态:', statusSummary);
      executionResults.push({ round, status: statusSummary });

      // 找到第一个 pending 的步骤
      const pendingTask = currentTasks.find(t => t.status === 'pending');
      
      if (pendingTask) {
        console.log(`[Mock Test] 执行步骤 ${pendingTask.orderIndex}: ${pendingTask.taskTitle}`);
        
        // Mock: 执行步骤
        currentMetadata = await mockExecuteStep(
          pendingTask,
          currentMetadata,
          MOCK_STEP_OUTPUTS[pendingTask.orderIndex]
        );
        
        // 等待一下
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('[Mock Test] 没有待执行的步骤了');
        break;
      }
    }

    // 6. 查询最终结果
    const finalTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, dailyTask.id))
      .orderBy(agentSubTasks.orderIndex);

    const finalSummary = finalTasks.map(t => ({
      orderIndex: t.orderIndex,
      taskTitle: t.taskTitle,
      status: t.status,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      articleMetadata: t.articleMetadata,
    }));

    console.log('[Mock Test] 最终结果:', finalSummary);

    return NextResponse.json({
      success: true,
      message: 'Mock 完整流程测试完成',
      data: {
        dailyTaskId: dailyTask.taskId,
        subTaskCount: createdSubTasks.length,
        executionResults,
        finalSummary,
      },
    });

  } catch (error) {
    console.error('[Mock Test] 测试失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Mock: 执行单个步骤
 */
async function mockExecuteStep(
  task: typeof agentSubTasks.$inferSelect,
  currentMetadata: any,
  stepOutput: string
) {
  console.log(`[Mock Test] 执行步骤 ${task.orderIndex}: ${task.taskTitle}`);

  // 1. 更新为 in_progress
  await db
    .update(agentSubTasks)
    .set({
      status: 'in_progress',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentSubTasks.id, task.id));

  // 2. 模拟执行延迟
  await new Promise(resolve => setTimeout(resolve, 800));

  // 3. 构建完整的 article_metadata（使用新的存储逻辑）
  const updatedMetadata = updateArticleMetadataStep(currentMetadata, {
    stepNo: task.orderIndex,
    stepStatus: 'success',
    stepOutput: stepOutput,
    confirmStatus: '已确认',
    wechatData: MOCK_WECHAT_DATA,
  });

  console.log(`[Mock Test] 更新 article_metadata:`, JSON.stringify(updatedMetadata, null, 2));

  // 4. 更新为 completed 并保存 article_metadata
  await db
    .update(agentSubTasks)
    .set({
      status: 'completed',
      completedAt: new Date(),
      articleMetadata: updatedMetadata,
      updatedAt: new Date(),
    })
    .where(eq(agentSubTasks.id, task.id));

  console.log(`[Mock Test] 步骤 ${task.orderIndex} 完成`);

  return updatedMetadata;
}
