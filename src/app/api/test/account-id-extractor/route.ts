import { NextRequest, NextResponse } from 'next/server';
import {
  extractAccountIdFromText,
  smartGetAccountId,
  getTaskAccountId,
  getAccountOptions,
  isValidAccountId,
} from '@/lib/utils/account-id-extractor';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const testCase = searchParams.get('case') || 'all';

  console.log('🔍 [账号ID提取测试] 开始测试，测试用例:', testCase);

  const testResults: any[] = [];

  // 测试用例1：从文本中提取账号ID
  if (testCase === '1' || testCase === 'all') {
    console.log('\n🧪 测试用例1：从文本中提取账号ID');
    
    const testTexts = [
      '无法上传微信公众号文章草稿...，公众号账号ID：insurance-account',
      '需要上传到 ai-tech-account 这个账号',
      '请使用账号：insurance-account 进行操作',
      'accountId: ai-tech-account，开始执行',
      '这个文本中没有账号ID信息',
    ];

    for (const text of testTexts) {
      const result = extractAccountIdFromText(text);
      testResults.push({
        test: 'extractAccountIdFromText',
        input: text.substring(0, 50) + '...',
        output: result,
        success: result !== null,
      });
      console.log(`  输入: ${text.substring(0, 60)}...`);
      console.log(`  输出: ${result || '(未找到)'}`);
    }
  }

  // 测试用例2：智能获取账号ID
  if (testCase === '2' || testCase === 'all') {
    console.log('\n🧪 测试用例2：智能获取账号ID');
    
    const testScenarios = [
      { 
        name: '从文本提取',
        options: { 
          text: '公众号账号ID：insurance-account，开始处理' 
        } 
      },
      { 
        name: 'Agent默认账号（insurance-d）',
        options: { 
          agent: 'insurance-d' as const 
        } 
      },
      { 
        name: 'Agent默认账号（agent-d）',
        options: { 
          agent: 'agent-d' as const 
        } 
      },
      { 
        name: '指定preferredAccountId',
        options: { 
          preferredAccountId: 'insurance-account' 
        } 
      },
      { 
        name: '文本提取+Agent兜底',
        options: { 
          text: '这个文本没有账号ID', 
          agent: 'insurance-d' as const 
        } 
      },
    ];

    for (const scenario of testScenarios) {
      const result = smartGetAccountId(scenario.options);
      testResults.push({
        test: 'smartGetAccountId',
        scenario: scenario.name,
        options: scenario.options,
        result: {
          success: result.success,
          accountId: result.accountId,
          method: result.method,
          message: result.message,
        },
      });
      console.log(`  场景: ${scenario.name}`);
      console.log(`  结果: ${result.success ? '✅' : '❌'} ${result.message}`);
      if (result.accountId) {
        console.log(`  账号ID: ${result.accountId}`);
        console.log(`  获取方式: ${result.method}`);
      }
    }
  }

  // 测试用例3：便捷函数 getTaskAccountId
  if (testCase === '3' || testCase === 'all') {
    console.log('\n🧪 测试用例3：便捷函数 getTaskAccountId');
    
    const testTasks = [
      {
        name: '保险相关任务',
        content: '无法上传微信公众号文章草稿，公众号账号ID：insurance-account',
        agent: 'insurance-d' as const,
      },
      {
        name: 'AI相关任务',
        content: '需要上传AI技术文章',
        agent: 'agent-d' as const,
      },
      {
        name: '无内容只有Agent',
        content: undefined,
        agent: 'insurance-d' as const,
      },
    ];

    for (const task of testTasks) {
      const result = getTaskAccountId(task.content, task.agent);
      testResults.push({
        test: 'getTaskAccountId',
        taskName: task.name,
        result: {
          success: result.success,
          accountId: result.accountId,
          method: result.method,
        },
      });
      console.log(`  任务: ${task.name}`);
      console.log(`  结果: ${result.success ? '✅' : '❌'} ${result.accountId || '无'}`);
    }
  }

  // 测试用例4：获取账号选项
  if (testCase === '4' || testCase === 'all') {
    console.log('\n🧪 测试用例4：获取账号选项');
    
    const allOptions = getAccountOptions();
    const insuranceOptions = getAccountOptions('insurance-d');
    const aiOptions = getAccountOptions('agent-d');

    testResults.push({
      test: 'getAccountOptions',
      allOptions,
      insuranceOptions,
      aiOptions,
    });
    console.log('  所有账号选项:', allOptions);
    console.log('  insurance-d 账号选项:', insuranceOptions);
    console.log('  agent-d 账号选项:', aiOptions);
  }

  // 测试用例5：验证账号ID有效性
  if (testCase === '5' || testCase === 'all') {
    console.log('\n🧪 测试用例5：验证账号ID有效性');
    
    const testIds = [
      'insurance-account',
      'ai-tech-account',
      'invalid-account',
      '',
      null,
    ];

    for (const id of testIds) {
      const result = isValidAccountId(id as string);
      testResults.push({
        test: 'isValidAccountId',
        accountId: id,
        isValid: result,
      });
      console.log(`  账号ID: ${id} → ${result ? '✅ 有效' : '❌ 无效'}`);
    }
  }

  console.log('\n✅ [账号ID提取测试] 所有测试完成');

  return NextResponse.json({
    success: true,
    message: '账号ID提取功能测试完成',
    testResults,
    summary: {
      totalTests: testResults.length,
      successfulTests: testResults.filter((r: any) => r.success !== false).length,
    },
  });
}
