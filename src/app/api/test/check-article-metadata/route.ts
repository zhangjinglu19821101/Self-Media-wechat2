/**
 * 检查 article_metadata 字段保存的数据
 * 
 * 使用方法：
 * curl -X GET http://localhost:5000/api/test/check-article-metadata
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  console.log('[Check ArticleMetadata] 开始检查 article_metadata 字段...');

  try {
    // 1. 查询所有 agent_sub_tasks（最新的）
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(16);

    if (subTasks.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到 agent_sub_tasks',
      });
    }

    console.log(`[Check ArticleMetadata] 找到 ${subTasks.length} 个 agent_sub_tasks`);

    // 2. 分组（按 commandResultId）
    const groupedSubTasks: Record<string, typeof subTasks> = {};
    for (const task of subTasks) {
      if (!groupedSubTasks[task.commandResultId]) {
        groupedSubTasks[task.commandResultId] = [];
      }
      groupedSubTasks[task.commandResultId].push(task);
    }

    // 3. 使用最新的一组
    const latestGroupId = Object.keys(groupedSubTasks)[0];
    const currentSubTasks = groupedSubTasks[latestGroupId].sort((a, b) => a.orderIndex - b.orderIndex);
    console.log(`[Check ArticleMetadata] 使用 commandResultId: ${latestGroupId}, 共 ${currentSubTasks.length} 个任务`);

    console.log(`[Check ArticleMetadata] 找到 ${currentSubTasks.length} 个 agent_sub_tasks`);

    // 3. 检查每个 subTask 的 article_metadata
    const checkResults = currentSubTasks.map((task, index) => {
      const metadata = task.articleMetadata as any;
      const stepNo = task.orderIndex;
      const isLastStep = stepNo === 8;

      let checks = [];

      // 检查 article_basic.task_type
      if (metadata?.article_basic?.task_type) {
        checks.push({
          field: 'article_basic.task_type',
          value: metadata.article_basic.task_type,
          expected: 'article_generation',
          status: metadata.article_basic.task_type === 'article_generation' ? '✅' : '❌',
        });
      }

      // 检查 article_basic.total_steps
      if (metadata?.article_basic?.total_steps) {
        checks.push({
          field: 'article_basic.total_steps',
          value: metadata.article_basic.total_steps,
          expected: 8,
          status: metadata.article_basic.total_steps === 8 ? '✅' : '❌',
        });
      }

      // 检查 article_basic.article_id
      if (metadata?.article_basic?.article_id !== undefined) {
        const hasArticleId = metadata.article_basic.article_id && metadata.article_basic.article_id.length > 0;
        checks.push({
          field: 'article_basic.article_id',
          value: metadata.article_basic.article_id || '(空)',
          expected: isLastStep ? '有值' : '空',
          status: (isLastStep ? hasArticleId : !hasArticleId) ? '✅' : '❌',
        });
      }

      // 检查 article_basic.article_content_status
      if (metadata?.article_basic?.article_content_status) {
        const expectedStatus = isLastStep ? '已生成' : '未生成';
        checks.push({
          field: 'article_basic.article_content_status',
          value: metadata.article_basic.article_content_status,
          expected: expectedStatus,
          status: metadata.article_basic.article_content_status === expectedStatus ? '✅' : '❌',
        });
      }

      // 检查 current_step.step_no
      if (metadata?.current_step?.step_no) {
        checks.push({
          field: 'current_step.step_no',
          value: metadata.current_step.step_no,
          expected: stepNo,
          status: metadata.current_step.step_no === stepNo ? '✅' : '❌',
        });
      }

      // 检查 current_step.step_output
      if (metadata?.current_step?.step_output) {
        const expectedOutput = isLastStep 
          ? '文章已经生成，请通过 article_content 表查看。'
          : '(实际内容)';
        const isCorrectOutput = isLastStep 
          ? metadata.current_step.step_output === '文章已经生成，请通过 article_content 表查看。'
          : metadata.current_step.step_output.length > 0;
        
        checks.push({
          field: 'current_step.step_output',
          value: metadata.current_step.step_output.substring(0, 50) + '...',
          expected: expectedOutput,
          status: isCorrectOutput ? '✅' : '❌',
        });
      }

      // 检查 current_step.exception_info
      if (metadata?.current_step?.exception_info !== undefined) {
        checks.push({
          field: 'current_step.exception_info',
          value: metadata.current_step.exception_info || '(空)',
          expected: '(空)',
          status: metadata.current_step.exception_info === '' ? '✅' : '❌',
        });
      }

      return {
        orderIndex: task.orderIndex,
        taskTitle: task.taskTitle,
        status: task.status,
        checks,
        fullMetadata: metadata,
      };
    });

    // 4. 统计结果
    const totalChecks = checkResults.reduce((sum, r) => sum + r.checks.length, 0);
    const passedChecks = checkResults.reduce(
      (sum, r) => sum + r.checks.filter(c => c.status === '✅').length,
      0
    );

    console.log(`[Check ArticleMetadata] 检查完成: ${passedChecks}/${totalChecks} 项通过`);

    return NextResponse.json({
      success: true,
      message: 'article_metadata 字段检查完成',
      data: {
        commandResultId: latestGroupId,
        subTaskCount: currentSubTasks.length,
        summary: {
          totalChecks,
          passedChecks,
          passRate: `${((passedChecks / totalChecks) * 100).toFixed(1)}%`,
        },
        checkResults,
      },
    });

  } catch (error) {
    console.error('[Check ArticleMetadata] 检查失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
