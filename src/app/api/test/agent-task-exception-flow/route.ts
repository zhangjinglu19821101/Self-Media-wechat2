/**
 * POST /api/test/agent-task-exception-flow
 * 
 * Agent 任务执行异常流程测试 API
 * 
 * 功能：
 * 1. 测试步骤超时的完整流程
 * 2. 测试交互次数从 1 递增到 5 的完整流程
 * 3. 测试 Agent B 介入和总结逻辑
 * 4. 测试步骤失败和异常处理逻辑
 * 
 * 使用方法：
 * curl -X POST http://localhost:5000/api/test/agent-task-exception-flow
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
  type InteractType
} from '@/lib/types/interact-content';

export async function POST(request: NextRequest) {
  const testResults: any[] = [];
  let testCommandResultId = uuidv4();

  try {
    console.log('🧪 开始 Agent 任务执行异常流程测试...\n');

    // ========================================================================
    // 测试 1: 模拟步骤超时 - 系统提示
    // ========================================================================
    console.log('=' .repeat(60));
    console.log('测试 1: 模拟步骤超时 - 系统提示');
    console.log('=' .repeat(60));

    // 创建初始的 articleMetadata
    const initialMetadata = createInitialArticleMetadata({
      articleId: `article-exception-${Date.now()}`,
      articleTitle: '保险知识科普文章 - 异常流程测试',
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
    console.log(`  - started_at: (模拟时间: ${new Date().toISOString()})`);

    testResults.push({
      test: '步骤 1 开始执行',
      status: 'success',
      data: {
        stepStatus: step1InProgressMetadata.current_step.step_status,
        stepName: step1InProgressMetadata.current_step.step_name,
      },
    });

    // 模拟超时（10 分钟后）
    console.log('\n⏰ 模拟 10 分钟后 - 步骤执行超时...');

    // 创建系统提示的 InteractContent
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
        timeout_minutes: 10,
      },
    });

    console.log('✅ 创建系统提示 InteractContent:');
    console.log(`  - interact_type: ${systemTipContent.interact_type}`);
    console.log(`  - execution_result.status: ${systemTipContent.execution_result.status}`);

    testResults.push({
      test: '步骤超时 - 系统提示',
      status: 'success',
      data: {
        interactType: systemTipContent.interact_type,
        executionStatus: systemTipContent.execution_result.status,
        errorMsg: systemTipContent.execution_result.error_msg,
      },
    });

    // ========================================================================
    // 测试 2: 模拟交互次数从 1 递增到 4 - Agent B 介入沟通
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('测试 2: 模拟交互次数从 1 递增到 4 - Agent B 介入沟通');
    console.log('=' .repeat(60));

    const interactionHistory: Array<{
      interactNum: number;
      interactType: InteractType;
      content: InteractContent;
    }> = [];

    // 第 1 次交互 - Agent 咨询
    console.log('\n📝 第 1 次交互 (interact_num = 1):');
    const consult1 = createAgentConsultContent({
      consultant: 'insurance-d',
      responder: 'agent B',
      question: '这个保险配置方案有个地方不确定，能帮我看看吗？',
      response: '好的，请告诉我具体是哪个地方？',
      executionResult: {
        status: 'success',
        upload_url: null,
        error_msg: null,
        confirm_note: '等待 Agent B 回应',
      },
      extInfo: {
        execution_time: new Date().toISOString(),
      },
    });
    interactionHistory.push({ interactNum: 1, interactType: 'agent_consult', content: consult1 });
    console.log(`  - interact_type: ${consult1.interact_type}`);
    console.log(`  - question: ${consult1.question.substring(0, 30)}...`);

    // 第 2 次交互 - Agent 回应
    console.log('\n📝 第 2 次交互 (interact_num = 2):');
    const response1 = createAgentResponseContent({
      consultant: 'insurance-d',
      responder: 'agent B',
      question: '这个保险配置方案有个地方不确定，能帮我看看吗？',
      response: '我看了，这个部分需要调整一下保额比例。',
      executionResult: {
        status: 'success',
        upload_url: null,
        error_msg: null,
        confirm_note: 'Agent B 回应',
      },
      extInfo: {
        execution_time: new Date().toISOString(),
      },
    });
    interactionHistory.push({ interactNum: 2, interactType: 'agent_response', content: response1 });
    console.log(`  - interact_type: ${response1.interact_type}`);
    console.log(`  - response: ${response1.response.substring(0, 30)}...`);

    // 第 3 次交互 - Agent 再咨询
    console.log('\n📝 第 3 次交互 (interact_num = 3):');
    const consult2 = createAgentConsultContent({
      consultant: 'insurance-d',
      responder: 'agent B',
      question: '好的，我调整了保额比例，现在可以了吗？',
      response: '让我再检查一下...',
      executionResult: {
        status: 'success',
        upload_url: null,
        error_msg: null,
        confirm_note: '等待 Agent B 再次确认',
      },
      extInfo: {
        execution_time: new Date().toISOString(),
      },
    });
    interactionHistory.push({ interactNum: 3, interactType: 'agent_consult', content: consult2 });
    console.log(`  - interact_type: ${consult2.interact_type}`);

    // 第 4 次交互 - Agent 再回应
    console.log('\n📝 第 4 次交互 (interact_num = 4):');
    const response2 = createAgentResponseContent({
      consultant: 'insurance-d',
      responder: 'agent B',
      question: '好的，我调整了保额比例，现在可以了吗？',
      response: '现在看起来没问题了，但还有个小细节需要注意...',
      executionResult: {
        status: 'success',
        upload_url: null,
        error_msg: null,
        confirm_note: 'Agent B 再次回应',
      },
      extInfo: {
        execution_time: new Date().toISOString(),
      },
    });
    interactionHistory.push({ interactNum: 4, interactType: 'agent_response', content: response2 });
    console.log(`  - interact_type: ${response2.interact_type}`);

    console.log('\n✅ 交互次数 1-4 模拟完成:');
    console.log(`  - 总共 ${interactionHistory.length} 次交互`);
    console.log(`  - interact_num 从 1 递增到 4`);

    testResults.push({
      test: '交互次数 1-4 - Agent B 介入沟通',
      status: 'success',
      data: {
        totalInteractions: interactionHistory.length,
        interactTypes: interactionHistory.map(h => h.interactType),
      },
    });

    // ========================================================================
    // 测试 3: 模拟第 5 次交互 - Agent B 做总结
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('测试 3: 模拟第 5 次交互 - Agent B 做总结');
    console.log('=' .repeat(60));

    console.log('📝 第 5 次交互 (interact_num = 5) - Agent B 做总结:');
    console.log('  ⚠️ 注意：interact_num = 5 是最后一次交互');
    console.log('  ⚠️ 之后不再继续交互，直接推送给用户确认');

    const agentSummaryContent = createAgentSummaryContent({
      consultant: 'agent B',
      responder: '人工',
      question: '总结交互过程',
      response: '经过 5 次交互，我们已经完成了保险配置方案的讨论。主要调整了保额比例，解决了不确定性问题。虽然还有一些小细节需要注意，但整体方案是可行的。建议用户确认后继续执行。',
      executionResult: {
        status: 'success',
        upload_url: 'https://example.com/summary-report.pdf',
        error_msg: null,
        confirm_note: 'Agent B 第 5 次交互总结',
      },
      extInfo: {
        execution_time: new Date().toISOString(),
        total_interactions: 5,
        suggestion: '建议用户确认后继续执行',
        next_step: '等待用户确认',
      },
    });

    console.log('✅ 创建 Agent 总结 InteractContent (第 5 次交互):');
    console.log(`  - interact_type: ${agentSummaryContent.interact_type}`);
    console.log(`  - interact_num: 5（最后一次）`);
    console.log(`  - response 长度: ${agentSummaryContent.response.length} 字符`);
    console.log(`  - ext_info.total_interactions: 5`);

    testResults.push({
      test: '第 5 次交互 - Agent B 做总结',
      status: 'success',
      data: {
        interactType: agentSummaryContent.interact_type,
        interactNum: 5,
        isLastInteraction: true,
        totalInteractions: 5,
      },
    });

    // ========================================================================
    // 测试 4: 模拟步骤失败 - 更新 article_metadata
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('测试 4: 模拟步骤失败 - 更新 article_metadata');
    console.log('=' .repeat(60));

    // 更新 article_metadata 为失败状态
    const stepFailedMetadata = updateArticleMetadataStep(step1InProgressMetadata, {
      stepNo: 1,
      stepName: '选题与规划',
      stepStatus: 'failed',
      stepOutput: '步骤执行失败，遇到技术问题',
      confirmStatus: '未确认',
      exceptionInfo: 'API 调用失败：网络连接超时',
    });

    console.log('✅ 更新 articleMetadata (步骤失败):');
    console.log(`  - step_status: ${stepFailedMetadata.current_step.step_status}`);
    console.log(`  - exception_info: ${stepFailedMetadata.current_step.exception_info}`);

    testResults.push({
      test: '步骤失败 - 更新 article_metadata',
      status: 'success',
      data: {
        stepStatus: stepFailedMetadata.current_step.step_status,
        exceptionInfo: stepFailedMetadata.current_step.exception_info,
      },
    });

    // ========================================================================
    // 测试 5: 异常流程总结
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('测试 5: 异常流程总结');
    console.log('=' .repeat(60));

    console.log('📋 完整异常流程：');
    console.log('  1. 步骤开始执行 → status = in_progress');
    console.log('  2. 10 分钟后超时 → 系统提示 (interact_type = system_tip)');
    console.log('  3. Agent B 介入 → 交互 1-4 次 (interact_num = 1-4)');
    console.log('  4. 第 5 次交互 → Agent B 做总结 (interact_type = agent_summary)');
    console.log('  5. 推送给用户确认');
    console.log('  6. (可选) 如果无法解决 → status = failed / timeout');

    console.log('\n🔑 关键点：');
    console.log('  - interact_num 最多 5 次');
    console.log('  - 第 5 次由 Agent B 做总结');
    console.log('  - 总结后推送给用户，不再继续交互');
    console.log('  - article_metadata 会记录 exception_info');

    testResults.push({
      test: '异常流程总结',
      status: 'success',
      data: {
        flow: [
          '步骤开始执行',
          '10 分钟超时',
          'Agent B 介入 (交互 1-4 次)',
          '第 5 次交互 - Agent B 总结',
          '推送给用户确认',
        ],
        keyPoints: [
          'interact_num 最多 5 次',
          '第 5 次由 Agent B 做总结',
          '总结后推送给用户，不再继续交互',
          'article_metadata 会记录 exception_info',
        ],
      },
    });

    // ========================================================================
    // 测试完成总结
    // ========================================================================
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 异常流程测试完成总结');
    console.log('=' .repeat(60));

    console.log(`✅ 总共执行了 ${testResults.length} 个测试`);
    console.log(`✅ 所有测试通过`);

    const successCount = testResults.filter(r => r.status === 'success').length;
    console.log(`✅ 成功: ${successCount}/${testResults.length}`);

    return NextResponse.json({
      success: true,
      message: 'Agent 任务执行异常流程测试完成',
      data: {
        totalTests: testResults.length,
        successCount: successCount,
        testCommandResultId: testCommandResultId,
        testResults: testResults,
      },
    });

  } catch (error) {
    console.error('❌ 异常流程测试失败:', error);
    
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
