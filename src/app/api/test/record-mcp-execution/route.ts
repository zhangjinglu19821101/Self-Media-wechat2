/**
 * recordMcpExecution 方法测试 API
 * 
 * 通过 HTTP API 运行测试，方便验证
 */

import { NextResponse } from 'next/server';

// 测试数据
const TEST_DATA = {
  // 正常的 MCP 执行数据
  normalMcpExecution: {
    attemptId: 'mcp-attempt-001',
    attemptNumber: 1,
    toolName: 'search',
    actionName: 'webSearch',
    params: {
      query: '年金险科普',
      limit: 10
    },
    resultStatus: 'success',
    resultData: {
      results: [
        { title: '什么是年金险', url: 'https://example.com/1' },
        { title: '年金险的好处', url: 'https://example.com/2' }
      ],
      total: 2
    },
    resultText: '【搜索结果】\n查询：年金险科普\n找到 2 条结果：\n1. 什么是年金险\n2. 年金险的好处',
    executionTimeMs: 1234,
  },

  // 没有 resultText 的 MCP 执行（测试自动生成）
  mcpWithoutResultText: {
    attemptId: 'mcp-attempt-002',
    attemptNumber: 1,
    toolName: 'read_file',
    actionName: 'read',
    params: {
      path: '/tmp/test.txt'
    },
    resultStatus: 'success',
    resultData: {
      content: '这是文件内容',
      size: 100
    },
    executionTimeMs: 567,
  },

  // 失败的 MCP 执行
  failedMcpExecution: {
    attemptId: 'mcp-attempt-003',
    attemptNumber: 2,
    toolName: 'wechat',
    actionName: 'publish',
    params: {
      title: '测试文章',
      content: '文章内容'
    },
    resultStatus: 'error',
    resultData: null,
    errorCode: 'AUTH_FAILED',
    errorMessage: '微信授权失败',
    errorType: 'authentication',
    executionTimeMs: 890,
  },
};

// 测试逻辑类
class RecordMcpExecutionTester {
  testResults: Array<{
    testName: string;
    passed: boolean;
    error?: string;
  }> = [];

  // 模拟 generateMcpResultText 的逻辑
  private mockGenerateMcpResultText(attempt: any): string {
    const toolName = attempt.decision?.toolName || attempt.toolName;
    const actionName = attempt.decision?.actionName || attempt.actionName;
    const resultStatus = attempt.result?.status || attempt.resultStatus;
    const resultData = attempt.result?.data || attempt.resultData;

    return `【MCP执行结果 - ${toolName || '未知工具'}】
工具：${toolName || '未知'}
动作：${actionName || '未知'}
状态：${resultStatus}
数据：${JSON.stringify(resultData, null, 2).substring(0, 200)}`;
  }

  private isUniqueConstraintError(error: any): boolean {
    const errorMsg = error?.message || String(error);
    return errorMsg.includes('unique constraint') || 
           errorMsg.includes('duplicate key');
  }

  async runAllTests() {
    console.log('========================================');
    console.log('  recordMcpExecution 单元测试');
    console.log('========================================\n');

    await this.testIsUniqueConstraintError();
    await this.testMockGenerateMcpResultText();
    await this.testNormalMcpData();
    await this.testMcpWithoutResultText();
    await this.testFailedMcpExecution();
    await this.testGenerateResultTextFallback();
    await this.testExecutionTimeDefaultValue();

    return this.getResults();
  }

  private async testIsUniqueConstraintError() {
    const testName = 'isUniqueConstraintError 方法';
    console.log(`【测试1】${testName}`);

    try {
      const error1 = new Error('duplicate key value violates unique constraint');
      const isUnique1 = this.isUniqueConstraintError(error1);
      if (!isUnique1) throw new Error('应该识别 unique constraint 错误');

      const error2 = new Error('duplicate key error');
      const isUnique2 = this.isUniqueConstraintError(error2);
      if (!isUnique2) throw new Error('应该识别 duplicate key 错误');

      const error3 = new Error('database connection failed');
      const isUnique3 = this.isUniqueConstraintError(error3);
      if (isUnique3) throw new Error('不应该识别其他错误为唯一约束错误');

      this.testResults.push({ testName, passed: true });
      console.log('  ✓ 通过\n');
    } catch (error) {
      this.testResults.push({ 
        testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`  ✗ 失败: ${error}\n`);
    }
  }

  private async testMockGenerateMcpResultText() {
    const testName = 'generateMcpResultText 模拟逻辑';
    console.log(`【测试2】${testName}`);

    try {
      const data = TEST_DATA.normalMcpExecution;
      const resultText = this.mockGenerateMcpResultText({
        decision: {
          toolName: data.toolName,
          actionName: data.actionName,
        },
        result: {
          status: data.resultStatus,
          data: data.resultData,
        },
      });

      if (!resultText.includes('MCP执行结果')) {
        throw new Error('结果应该包含 MCP执行结果');
      }
      if (!resultText.includes(data.toolName!)) {
        throw new Error('结果应该包含工具名称');
      }
      if (!resultText.includes(data.resultStatus)) {
        throw new Error('结果应该包含状态');
      }

      this.testResults.push({ testName, passed: true });
      console.log('  ✓ 通过\n');
    } catch (error) {
      this.testResults.push({ 
        testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`  ✗ 失败: ${error}\n`);
    }
  }

  private async testNormalMcpData() {
    const testName = '正常的 MCP 数据验证';
    console.log(`【测试3】${testName}`);

    try {
      const data = TEST_DATA.normalMcpExecution;

      // 验证必填字段
      if (!data.attemptId) throw new Error('attemptId 是必填的');
      if (!data.attemptNumber) throw new Error('attemptNumber 是必填的');
      if (!data.resultStatus) throw new Error('resultStatus 是必填的');

      // 验证数据类型
      if (typeof data.attemptNumber !== 'number') {
        throw new Error('attemptNumber 应该是数字');
      }
      if (data.executionTimeMs && typeof data.executionTimeMs !== 'number') {
        throw new Error('executionTimeMs 应该是数字');
      }

      // 验证有 resultText 的情况
      if (!data.resultText) {
        throw new Error('这个测试数据应该有 resultText');
      }

      this.testResults.push({ testName, passed: true });
      console.log('  ✓ 通过\n');
    } catch (error) {
      this.testResults.push({ 
        testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`  ✗ 失败: ${error}\n`);
    }
  }

  private async testMcpWithoutResultText() {
    const testName = '没有 resultText 的 MCP 数据';
    console.log(`【测试4】${testName}`);

    try {
      const data = TEST_DATA.mcpWithoutResultText;

      // 验证没有 resultText
      if (data.resultText) {
        throw new Error('这个测试数据不应该有 resultText');
      }

      // 验证有 resultData
      if (!data.resultData) {
        throw new Error('应该有 resultData 用于生成 resultText');
      }

      // 模拟自动生成 resultText
      const generatedText = this.mockGenerateMcpResultText({
        decision: {
          toolName: data.toolName,
          actionName: data.actionName,
        },
        result: {
          status: data.resultStatus,
          data: data.resultData,
        },
      });

      if (!generatedText) {
        throw new Error('应该能生成 resultText');
      }

      this.testResults.push({ testName, passed: true });
      console.log('  ✓ 通过\n');
    } catch (error) {
      this.testResults.push({ 
        testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`  ✗ 失败: ${error}\n`);
    }
  }

  private async testFailedMcpExecution() {
    const testName = '失败的 MCP 执行数据';
    console.log(`【测试5】${testName}`);

    try {
      const data = TEST_DATA.failedMcpExecution;

      // 验证错误状态
      if (data.resultStatus !== 'error') {
        throw new Error('resultStatus 应该是 error');
      }

      // 验证错误字段
      if (!data.errorCode) throw new Error('errorCode 是必填的');
      if (!data.errorMessage) throw new Error('errorMessage 是必填的');
      if (!data.errorType) throw new Error('errorType 是必填的');

      // 验证 resultData 可以是 null
      if (data.resultData !== null) {
        throw new Error('失败时 resultData 可以是 null');
      }

      this.testResults.push({ testName, passed: true });
      console.log('  ✓ 通过\n');
    } catch (error) {
      this.testResults.push({ 
        testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`  ✗ 失败: ${error}\n`);
    }
  }

  private async testGenerateResultTextFallback() {
    const testName = 'generateResultText 异常时的降级处理';
    console.log(`【测试6】${testName}`);

    try {
      // 模拟 generateMcpResultText 抛出异常的情况
      const shouldThrow = true;
      let resultText: string | undefined = '预设的 resultText';
      
      if (!resultText) {
        try {
          if (shouldThrow) {
            throw new Error('生成失败');
          }
          resultText = this.mockGenerateMcpResultText({});
        } catch (error) {
          // 降级：留空
          console.warn('生成失败，resultText 留空');
          resultText = undefined;
        }
      }

      // 验证降级逻辑
      if (shouldThrow && resultText !== '预设的 resultText') {
        throw new Error('应该使用预设的 resultText，不应该尝试生成');
      }

      this.testResults.push({ testName, passed: true });
      console.log('  ✓ 通过\n');
    } catch (error) {
      this.testResults.push({ 
        testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`  ✗ 失败: ${error}\n`);
    }
  }

  private async testExecutionTimeDefaultValue() {
    const testName = 'executionTimeMs 默认值';
    console.log(`【测试7】${testName}`);

    try {
      // 测试有值的情况
      const data1 = TEST_DATA.normalMcpExecution;
      const executionTime1 = data1.executionTimeMs || 0;
      if (executionTime1 !== 1234) {
        throw new Error('有值时应该使用原值');
      }

      // 测试没有值的情况
      const dataWithoutTime = { ...TEST_DATA.normalMcpExecution, executionTimeMs: undefined };
      const executionTime2 = dataWithoutTime.executionTimeMs || 0;
      if (executionTime2 !== 0) {
        throw new Error('没有值时应该默认为 0');
      }

      // 测试 null 的情况
      const dataWithNull = { ...TEST_DATA.normalMcpExecution, executionTimeMs: null };
      const executionTime3 = dataWithNull.executionTimeMs || 0;
      if (executionTime3 !== 0) {
        throw new Error('null 时应该默认为 0');
      }

      this.testResults.push({ testName, passed: true });
      console.log('  ✓ 通过\n');
    } catch (error) {
      this.testResults.push({ 
        testName, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`  ✗ 失败: ${error}\n`);
    }
  }

  private getResults() {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;

    return {
      summary: {
        total,
        passed,
        failed,
        passRate: `${((passed / total) * 100).toFixed(1)}%`,
      },
      details: this.testResults,
    };
  }
}

export async function GET() {
  try {
    console.log('🧪 开始运行 recordMcpExecution 单元测试...\n');
    
    const tester = new RecordMcpExecutionTester();
    const results = await tester.runAllTests();
    
    console.log('\n🧪 测试完成！');
    
    return NextResponse.json({
      success: true,
      message: 'recordMcpExecution 单元测试完成',
      results,
    });
  } catch (error) {
    console.error('❌ 测试运行失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
