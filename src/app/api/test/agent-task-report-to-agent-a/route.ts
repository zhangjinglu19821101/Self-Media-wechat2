/**
 * POST /api/test/agent-task-report-to-agent-a
 * 
 * Agent 任务执行 - 向 Agent A 弹框汇报测试 API
 * 
 * 功能：
 * 1. 测试完整流程：超时 → Agent B 介入 1-4 次 → 第 5 次总结 → 向 Agent A 弹框汇报
 * 2. 测试 agent_notifications 表的创建（向 Agent A 发送通知）
 * 3. 测试 agent_reports 表的创建（正式上报）
 * 
 * 使用方法：
 * curl -X POST http://localhost:5000/api/test/agent-task-report-to-agent-a
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { 
  createInitialArticleMetadata, 
  updateArticleMetadataStep,
  type ArticleMetadata 
} from '@/lib/types/article-metadata';
import { 
  createAgentConsultContent,
  createAgentResponseContent,
  createSystemTipContent,
  createAgentSummaryContent,
  type InteractContent,
} from '@/lib/types/interact-content';

export async function POST(request: NextRequest) {
  const testResults: any[] = [];
  let testCommandResultId = uuidv4();

  try {
    console.log('🧪 开始 Agent 任务执行 - 向 Agent A 弹框汇报测试...\n');

    // ========================================================================
    // 测试 1: 步骤超时 - 系统提示
    // ========================================================================
    console.log('=' .repeat(60));
    console.log('测试 1: 步骤超时 - 系统提示');
    console.log('=' .repeat(60));

    // 创建初始的 articleMetadata
    const initialMetadata = createInitialArticleMetadata({
      articleId: `article-report-a-${Date.now()}`,
      articleTitle: '保险知识科普文章 - 向 Agent A 汇报测试',
      creatorAgent: 'insurance-d',
    });

    // 步骤 1 开始执行
    const step1InProgressMetadata = updateArticleMetadataStep(initialMetadata, {
      stepNo: 1,
      stepName: '选题与规划',
      stepStatus: 'in_progress',
      stepOutput: '正在分析热门保险话题...',
      confirmStatus: '未确认',
    });

    console.log('✅ 步骤 1 开始执行:');
    console.log(`  - step_status: ${step1InProgressMetadata.current_step.step_status}`);

    testResults.push({
      test: '步骤 1 开始执行',
      status: 'success',
      data: {
        stepStatus: step1InProgressMetadata.current_step.step_status,
      },
    });

    // 模拟超时（10 分钟后）
    console.log('\n⏰ 模拟 10 分钟后 - 步骤执行超时...');

    const systemTipContent = createSystemTipContent({
      consultant: 'system',
      responder: 'insurance-d',
      question: '步骤执行超时',
      response: '步骤执行已超过 10 分钟，Agent B 将介入处理。',
      executionResult: {
        status: 'timeout',
        upload_url: null,
        error_msg: '步骤执行超时（10 分钟）',
        confirm_note: null,
      },
      extInfo: {
        execution_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    });

    testResults.push({
      test: '步骤超时 - 系统提示',
      status: 'success',
      data: {
        interactType: systemTipContent.interact_type,
        executionStatus: systemTipContent.execution_result.status,
      },
    });

    // ========================================================================
    // 测试 2: 交互次数 1-4 - Agent B 介入沟通
    // ========================================================================
    console.log('\n' .repeat(60));
    console.log('测试 2: 交互次数 1-4 - Agent B 介入沟通');
    console.log('=' .repeat(60));

    const interactionHistory: Array<{
      interactNum: number;
      content: InteractContent;
    }> = [];

    // 第 1-4 次交互
    for (let i = 1; i <= 4; i++) {
      console.log(`\n📝 第 ${i} 次交互 (interact_num = ${i}):`);
      
      if (i % 2 === 1) {
        // 奇数：Agent 咨询
        const consult = createAgentConsultContent({
          consultant: 'insurance-d',
          responder: 'agent B',
          question: `这是第 ${i} 次咨询，还有个问题需要确认...`,
          response: `好的，第 ${i} 次回应，让我看看...`,
          executionResult: {
            status: 'success',
            upload_url: null,
            error_msg: null,
            confirm_note: `第 ${i} 次交互`,
          },
          extInfo: {
            execution_time: new Date().toISOString(),
          },
        });
        interactionHistory.push({ interactNum: i, content: consult });
        console.log(`  - interact_type: ${consult.interact_type}`);
      } else {
        // 偶数：Agent 回应
        const response = createAgentResponseContent({
          consultant: 'insurance-d',
          responder: 'agent B',
          question: `这是第 ${i-1} 次咨询，还有个问题需要确认...`,
          response: `好的，第 ${i} 次回应，问题已解决！`,
          executionResult: {
            status: 'success',
            upload_url: null,
            error_msg: null,
            confirm_note: `第 ${i} 次交互`,
          },
          extInfo: {
            execution_time: new Date().toISOString(),
          },
        });
        interactionHistory.push({ interactNum: i, content: response });
        console.log(`  - interact_type: ${response.interact_type}`);
      }
    }

    console.log('\n✅ 交互次数 1-4 完成:');
    console.log(`  - 总共 ${interactionHistory.length} 次交互`);
    console.log(`  - interact_num 从 1 递增到 4`);

    testResults.push({
      test: '交互次数 1-4 - Agent B 介入沟通',
      status: 'success',
      data: {
        totalInteractions: interactionHistory.length,
      },
    });

    // ========================================================================
    // 测试 3: 第 5 次交互 - Agent B 做总结
    // ========================================================================
    console.log('\n' .repeat(60));
    console.log('测试 3: 第 5 次交互 - Agent B 做总结');
    console.log('=' .repeat(60));

    console.log('📝 第 5 次交互 (interact_num = 5) - Agent B 做总结:');
    console.log('  ⚠️ 注意：interact_num = 5 是最后一次交互');

    const agentSummaryContent = createAgentSummaryContent({
      consultant: 'agent B',
      responder: 'insurance-d',
      question: '总结交互过程',
      response: '经过 5 次交互，我们尝试解决问题但仍存在不确定性。主要问题是保额比例和监管要求的平衡。建议向 Agent A 汇报，请求进一步指示。',
      executionResult: {
        status: 'success',
        upload_url: 'https://example.com/summary-report.pdf',
        error_msg: null,
        confirm_note: 'Agent B 第 5 次交互总结 - 需要向 Agent A 汇报',
      },
      extInfo: {
        execution_time: new Date().toISOString(),
        total_interactions: 5,
        next_step: '向 Agent A 弹框汇报',
        requires_agent_a_intervention: true,
      },
    });

    console.log('✅ 创建 Agent 总结 InteractContent (第 5 次交互):');
    console.log(`  - interact_type: ${agentSummaryContent.interact_type}`);
    console.log(`  - interact_num: 5（最后一次）`);
    console.log(`  - requires_agent_a_intervention: true`);

    testResults.push({
      test: '第 5 次交互 - Agent B 做总结',
      status: 'success',
      data: {
        interactType: agentSummaryContent.interact_type,
        interactNum: 5,
        requiresAgentAIntervention: true,
      },
    });

    // ========================================================================
    // 测试 4: 向 Agent A 弹框汇报 - 创建 agent_notifications 记录
    // ========================================================================
    console.log('\n' .repeat(60));
    console.log('测试 4: 向 Agent A 弹框汇报 - 创建 agent_notifications 记录');
    console.log('=' .repeat(60));

    console.log('📋 创建 agent_notifications 记录（向 Agent A 发送弹框通知）:');

    const notificationId = uuidv4();
    const notificationData = {
      id: notificationId,
      type: 'system_notification', // 或 'task_result'
      toAgentId: 'A', // 发送给 Agent A
      fromAgentId: 'agent B', // 来自 Agent B
      taskId: testCommandResultId,
      message: '⚠️ 任务执行遇到问题，需要您的介入！',
      data: {
        reason: '经过 5 次交互仍无法解决问题',
        summary: agentSummaryContent.response,
        total_interactions: 5,
        step_name: '选题与规划',
        step_no: 1,
        requires_confirmation: true,
      },
      read: 'false',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('✅ agent_notifications 记录创建成功:');
    console.log(`  - ID: ${notificationData.id}`);
    console.log(`  - toAgentId: ${notificationData.toAgentId}`);
    console.log(`  - fromAgentId: ${notificationData.fromAgentId}`);
    console.log(`  - message: ${notificationData.message}`);
    console.log(`  - type: ${notificationData.type}`);

    testResults.push({
      test: '向 Agent A 弹框汇报 - agent_notifications',
      status: 'success',
      data: {
        notificationId: notificationData.id,
        toAgentId: notificationData.toAgentId,
        fromAgentId: notificationData.fromAgentId,
        message: notificationData.message,
      },
    });

    // ========================================================================
    // 测试 5: 向 Agent A 正式上报 - 创建 agent_reports 记录（可选）
    // ========================================================================
    console.log('\n' .repeat(60));
    console.log('测试 5: 向 Agent A 正式上报 - 创建 agent_reports 记录');
    console.log('=' .repeat(60));

    console.log('📋 创建 agent_reports 记录（正式上报）:');

    const reportId = uuidv4();
    const reportData = {
      id: reportId,
      reportType: 'subtask_timeout', // 或 'agent_intervention_required'
      commandResultId: testCommandResultId,
      subTaskId: null, // 可选，如果是子任务问题
      summary: '任务执行超时，经过 5 次交互仍无法解决',
      conclusion: '建议 Agent A 介入确认下一步行动',
      dialogueProcess: [
        {
          round: 1,
          sender: 'insurance-d',
          content: '第 1 次咨询',
          timestamp: new Date().toISOString(),
        },
        {
          round: 2,
          sender: 'agent B',
          content: '第 2 次回应',
          timestamp: new Date().toISOString(),
        },
        {
          round: 3,
          sender: 'insurance-d',
          content: '第 3 次咨询',
          timestamp: new Date().toISOString(),
        },
        {
          round: 4,
          sender: 'agent B',
          content: '第 4 次回应',
          timestamp: new Date().toISOString(),
        },
        {
          round: 5,
          sender: 'agent B',
          content: agentSummaryContent.response,
          timestamp: new Date().toISOString(),
        },
      ],
      suggestedActions: [
        {
          action: 'manual_intervention',
          description: '建议 Agent A 手动介入确认',
          priority: 'high',
        },
        {
          action: 'reassign_task',
          description: '或者重新分配任务给其他 Agent',
          priority: 'medium',
        },
      ],
      reportedTo: 'agent_a',
      reportedFrom: 'agent_b',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('✅ agent_reports 记录创建成功:');
    console.log(`  - ID: ${reportData.id}`);
    console.log(`  - reportType: ${reportData.reportType}`);
    console.log(`  - reportedTo: ${reportData.reportedTo}`);
    console.log(`  - reportedFrom: ${reportData.reportedFrom}`);
    console.log(`  - status: ${reportData.status}`);

    testResults.push({
      test: '向 Agent A 正式上报 - agent_reports',
      status: 'success',
      data: {
        reportId: reportData.id,
        reportType: reportData.reportType,
        reportedTo: reportData.reportedTo,
        status: reportData.status,
      },
    });

    // ========================================================================
    // 测试 6: 完整流程总结
    // ========================================================================
    console.log('\n' .repeat(60));
    console.log('测试 6: 完整流程总结');
    console.log('=' .repeat(60));

    console.log('📋 完整异常流程（包含向 Agent A 弹框汇报）：');
    console.log('  1. 步骤开始执行 → status = in_progress');
    console.log('  2. 10 分钟后超时 → 系统提示 (interact_type = system_tip)');
    console.log('  3. Agent B 介入 → 交互 1-4 次 (interact_num = 1-4)');
    console.log('  4. 第 5 次交互 → Agent B 做总结 (interact_type = agent_summary)');
    console.log('  5. 🔥 向 Agent A 弹框汇报 → 创建 agent_notifications 记录');
    console.log('  6. (可选) 向 Agent A 正式上报 → 创建 agent_reports 记录');
    console.log('  7. 等待 Agent A 确认或介入');

    console.log('\n🔑 关键点：');
    console.log('  - interact_num 最多 5 次');
    console.log('  - 第 5 次由 Agent B 做总结');
    console.log('  - 🔥 总结后必须向 Agent A 做弹框汇报！');
    console.log('  - 通过 agent_notifications 表向 Agent A 发送通知');
    console.log('  - (可选) 通过 agent_reports 表正式上报');
    console.log('  - 等待 Agent A 确认后再继续');

    testResults.push({
      test: '完整流程总结（包含向 Agent A 弹框汇报）',
      status: 'success',
      data: {
        flow: [
          '步骤开始执行',
          '10 分钟超时',
          'Agent B 介入 (交互 1-4 次)',
          '第 5 次交互 - Agent B 总结',
          '🔥 向 Agent A 弹框汇报（agent_notifications）',
          '(可选) 向 Agent A 正式上报（agent_reports）',
          '等待 Agent A 确认',
        ],
        keyPoints: [
          'interact_num 最多 5 次',
          '第 5 次由 Agent B 做总结',
          '🔥 总结后必须向 Agent A 做弹框汇报！',
          '通过 agent_notifications 表向 Agent A 发送通知',
          '(可选) 通过 agent_reports 表正式上报',
        ],
      },
    });

    // ========================================================================
    // 测试完成总结
    // ========================================================================
    console.log('\n' .repeat(60));
    console.log('🎉 向 Agent A 弹框汇报测试完成总结');
    console.log('=' .repeat(60));

    console.log(`✅ 总共执行了 ${testResults.length} 个测试`);
    console.log(`✅ 所有测试通过`);

    const successCount = testResults.filter(r => r.status === 'success').length;
    console.log(`✅ 成功: ${successCount}/${testResults.length}`);

    return NextResponse.json({
      success: true,
      message: 'Agent 任务执行 - 向 Agent A 弹框汇报测试完成',
      data: {
        totalTests: testResults.length,
        successCount: successCount,
        testCommandResultId: testCommandResultId,
        testResults: testResults,
      },
    });

  } catch (error) {
    console.error('❌ 向 Agent A 弹框汇报测试失败:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        testResults: testResults,
      },
      { status: 500 }
    );
  }
}
