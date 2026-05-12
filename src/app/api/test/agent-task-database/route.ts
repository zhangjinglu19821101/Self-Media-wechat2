/**
 * POST /api/test/agent-task-database
 * 
 * Agent 任务执行数据库测试 API（实际操作数据库）
 * 
 * 功能：
 * 1. 实际创建 agent_sub_tasks 测试记录
 * 2. 实际更新 article_metadata 字段
 * 3. 实际创建 agent_sub_tasks_step_history 记录
 * 4. 实际测试交互次数递增逻辑
 * 
 * ⚠️ 警告：这个 API 会实际修改数据库！
 * 
 * 使用方法：
 * curl -X POST http://localhost:5000/api/test/agent-task-database
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { agentSubTasksStepHistory } from '@/lib/db/schema/agent-sub-tasks-step-history';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { 
  createInitialArticleMetadata, 
  updateArticleMetadataStep,
  type ArticleMetadata 
} from '@/lib/types/article-metadata';
import { 
  createAgentConsultContent,
  createAgentResponseContent,
  type InteractContent 
} from '@/lib/types/interact-content';

export async function POST(request: NextRequest) {
  const testResults: any[] = [];
  let testCommandResultId: string | null = null;
  let testSubTaskId: string | null = null;

  try {
    console.log('🧪 开始 Agent 任务执行数据库测试...\n');
    console.log('⚠️ 警告：这个测试会实际修改数据库！\n');

    // ========================================================================
    // 测试 1: 实际创建 agent_sub_tasks 测试记录
    // ========================================================================
    console.log('=' .repeat(60));
    console.log('测试 1: 实际创建 agent_sub_tasks 测试记录');
    console.log('=' .repeat(60));

    testCommandResultId = uuidv4();
    testSubTaskId = uuidv4();
    
    // 创建初始的 articleMetadata
    const initialMetadata = createInitialArticleMetadata({
      articleId: `article-${Date.now()}`,
      articleTitle: '保险知识科普文章 - 数据库测试',
      creatorAgent: 'insurance-d',
    });

    // 实际插入数据库
    const insertResult = await db.insert(agentSubTasks).values({
      id: testSubTaskId,
      commandResultId: testCommandResultId,
      fromParentsExecutor: 'insurance-d',
      taskTitle: '选题与规划 - 测试',
      taskDescription: '测试任务执行流程',
      status: 'pending',
      orderIndex: 1,
      articleMetadata: initialMetadata,
    }).returning();

    console.log('✅ 创建 agent_sub_tasks 记录成功:');
    console.log(`  - ID: ${insertResult[0].id}`);
    console.log(`  - Command Result ID: ${insertResult[0].commandResultId}`);
    console.log(`  - article_metadata 已设置`);

    testResults.push({
      test: '创建 agent_sub_tasks 记录',
      status: 'success',
      data: {
        id: insertResult[0].id,
        commandResultId: insertResult[0].commandResultId,
      },
    });

    // ========================================================================
    // 测试 2: 实际更新 article_metadata 字段 - 步骤 1 进行中
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('测试 2: 实际更新 article_metadata 字段 - 步骤 1 进行中');
    console.log('=' .repeat(60));

    // 先查询当前的 articleMetadata
    const currentTask = await db
      .select({ articleMetadata: agentSubTasks.articleMetadata })
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, testSubTaskId))
      .limit(1);

    const currentMetadata = currentTask[0].articleMetadata as ArticleMetadata;
    
    // 更新 articleMetadata
    const step1InProgressMetadata = updateArticleMetadataStep(currentMetadata, {
      stepNo: 1,
      stepName: '选题与规划',
      stepStatus: 'in_progress',
      stepOutput: '正在分析热门保险话题...',
      confirmStatus: '未确认',
    });

    // 实际更新数据库
    await db
      .update(agentSubTasks)
      .set({ 
        articleMetadata: step1InProgressMetadata,
        status: 'in_progress',
        startedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, testSubTaskId));

    console.log('✅ 更新 articleMetadata (步骤 1 进行中) 成功');
    console.log(JSON.stringify(step1InProgressMetadata, null, 2));

    testResults.push({
      test: '更新 articleMetadata - 步骤 1 进行中',
      status: 'success',
      data: step1InProgressMetadata,
    });

    // ========================================================================
    // 测试 3: 实际更新 article_metadata 字段 - 步骤 1 成功
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('测试 3: 实际更新 article_metadata 字段 - 步骤 1 成功');
    console.log('=' .repeat(60));

    // 再次查询当前的 articleMetadata
    const currentTask2 = await db
      .select({ articleMetadata: agentSubTasks.articleMetadata })
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, testSubTaskId))
      .limit(1);

    const currentMetadata2 = currentTask2[0].articleMetadata as ArticleMetadata;
    
    // 更新 articleMetadata
    const step1SuccessMetadata = updateArticleMetadataStep(currentMetadata2, {
      stepNo: 1,
      stepName: '选题与规划',
      stepStatus: 'success',
      stepOutput: '选定话题："如何为家庭配置保险"',
      confirmStatus: '已确认',
    });

    // 实际更新数据库
    await db
      .update(agentSubTasks)
      .set({ 
        articleMetadata: step1SuccessMetadata,
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, testSubTaskId));

    console.log('✅ 更新 articleMetadata (步骤 1 成功) 成功');
    console.log(JSON.stringify(step1SuccessMetadata, null, 2));

    testResults.push({
      test: '更新 articleMetadata - 步骤 1 成功',
      status: 'success',
      data: step1SuccessMetadata,
    });

    // ========================================================================
    // 测试 4: 实际创建 agent_sub_tasks_step_history 记录 - 第 1 次交互
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('测试 4: 实际创建 agent_sub_tasks_step_history 记录 - 第 1 次交互');
    console.log('=' .repeat(60));

    const agentConsultContent = createAgentConsultContent({
      consultant: 'insurance-d',
      responder: 'agent B',
      question: '这个保险配置方案是否符合监管要求？',
      response: '让我检查一下监管规则...',
      executionResult: {
        status: 'success',
        upload_url: 'https://example.com/check-result.pdf',
        error_msg: null,
        confirm_note: '初步检查通过',
      },
      extInfo: {
        mcp_connector: 'compliance-check',
        execution_time: new Date().toISOString(),
      },
    });

    // 实际插入 step_history 表
    const stepHistoryResult1 = await db.insert(agentSubTasksStepHistory).values({
      commandResultId: testCommandResultId,
      stepNo: 1,
      interactContent: agentConsultContent,
      interactUser: 'insurance-d',
      interactNum: 1,
    }).returning();

    console.log('✅ 创建 agent_sub_tasks_step_history 记录 (第 1 次交互) 成功:');
    console.log(`  - ID: ${stepHistoryResult1[0].id}`);
    console.log(`  - interact_num: ${stepHistoryResult1[0].interactNum}`);

    testResults.push({
      test: '创建 agent_sub_tasks_step_history 记录 - 第 1 次交互',
      status: 'success',
      data: {
        id: stepHistoryResult1[0].id,
        interactNum: stepHistoryResult1[0].interactNum,
      },
    });

    // ========================================================================
    // 测试 5: 实际更新 agent_sub_tasks_step_history 记录 - 第 2 次交互
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('测试 5: 实际更新 agent_sub_tasks_step_history 记录 - 第 2 次交互');
    console.log('=' .repeat(60));

    const agentResponseContent = createAgentResponseContent({
      consultant: 'insurance-d',
      responder: 'agent B',
      question: '这个保险配置方案是否符合监管要求？',
      response: '经过详细检查，方案完全符合监管要求，可以继续执行。',
      executionResult: {
        status: 'success',
        upload_url: 'https://example.com/final-check-result.pdf',
        error_msg: null,
        confirm_note: '监管检查通过',
      },
      extInfo: {
        mcp_connector: 'compliance-check',
        execution_time: new Date().toISOString(),
        suggestion: '建议保存检查报告',
      },
    });

    // 查询现有的 step_history 记录
    const existingHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, testCommandResultId),
          eq(agentSubTasksStepHistory.stepNo, 1)
        )
      )
      .limit(1);

    if (existingHistory.length > 0) {
      // 更新现有记录：interact_num 递增
      const newInteractNum = (existingHistory[0].interactNum || 0) + 1;
      
      await db
        .update(agentSubTasksStepHistory)
        .set({
          interactContent: agentResponseContent,
          interactUser: 'agent B',
          interactTime: new Date(),
          interactNum: newInteractNum,
        })
        .where(eq(agentSubTasksStepHistory.id, existingHistory[0].id));

      console.log('✅ 更新 agent_sub_tasks_step_history 记录 (第 2 次交互) 成功:');
      console.log(`  - ID: ${existingHistory[0].id}`);
      console.log(`  - 新的 interact_num: ${newInteractNum}`);

      testResults.push({
        test: '更新 agent_sub_tasks_step_history 记录 - 第 2 次交互',
        status: 'success',
        data: {
          id: existingHistory[0].id,
          oldInteractNum: existingHistory[0].interactNum,
          newInteractNum: newInteractNum,
        },
      });
    } else {
      throw new Error('未找到现有的 step_history 记录');
    }

    // ========================================================================
    // 测试 6: 查询验证数据
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('测试 6: 查询验证数据');
    console.log('=' .repeat(60));

    // 查询 agent_sub_tasks 记录
    const finalTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, testSubTaskId))
      .limit(1);

    console.log('✅ 查询 agent_sub_tasks 记录成功:');
    console.log(`  - ID: ${finalTask[0].id}`);
    console.log(`  - Status: ${finalTask[0].status}`);
    console.log(`  - article_metadata.current_step.step_status: ${(finalTask[0].articleMetadata as ArticleMetadata).current_step.step_status}`);

    // 查询 agent_sub_tasks_step_history 记录
    const finalHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, testCommandResultId),
          eq(agentSubTasksStepHistory.stepNo, 1)
        )
      )
      .limit(1);

    console.log('✅ 查询 agent_sub_tasks_step_history 记录成功:');
    console.log(`  - ID: ${finalHistory[0].id}`);
    console.log(`  - interact_num: ${finalHistory[0].interactNum}`);

    testResults.push({
      test: '查询验证数据',
      status: 'success',
      data: {
        agentSubTasks: {
          id: finalTask[0].id,
          status: finalTask[0].status,
          stepStatus: (finalTask[0].articleMetadata as ArticleMetadata).current_step.step_status,
        },
        stepHistory: {
          id: finalHistory[0].id,
          interactNum: finalHistory[0].interactNum,
        },
      },
    });

    // ========================================================================
    // 测试完成总结
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 数据库测试完成总结');
    console.log('=' .repeat(60));

    console.log(`✅ 总共执行了 ${testResults.length} 个测试`);
    console.log(`✅ 所有测试通过`);
    console.log(`\n📝 测试数据：`);
    console.log(`  - agent_sub_tasks ID: ${testSubTaskId}`);
    console.log(`  - Command Result ID: ${testCommandResultId}`);
    console.log(`\n⚠️ 注意：测试数据已写入数据库，如需清理请手动删除！`);

    const successCount = testResults.filter(r => r.status === 'success').length;

    return NextResponse.json({
      success: true,
      message: 'Agent 任务执行数据库测试完成',
      data: {
        totalTests: testResults.length,
        successCount: successCount,
        testSubTaskId: testSubTaskId,
        testCommandResultId: testCommandResultId,
        testResults: testResults,
      },
    });

  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        testResults: testResults,
        testSubTaskId: testSubTaskId,
        testCommandResultId: testCommandResultId,
      },
      { status: 500 }
    );
  }
}
