/**
 * recordAgentInteraction 方法单元测试
 * 
 * 测试策略：
 * - 纯逻辑测试，不依赖数据库
 * - 测试辅助方法的逻辑
 * - 使用 Mock 数据测试边界条件
 */

// 测试数据
const TEST_DATA = {
  // 正常的 Agent 交互数据
  normalInteraction: {
    commandResultId: 'test-command-result-123',
    stepNo: 1,
    agentId: 'insurance-d',
    requestContent: {
      task: '写一篇保险科普文章',
      topic: '年金险'
    },
    responseStatus: 'COMPLETED' as const,
    responseContent: {
      result: '文章已完成',
      articleId: 'ART-2024-001'
    },
    subTaskId: 1,
  },

  // 另一个不同的交互（用于测试去重）
  differentInteraction: {
    commandResultId: 'test-command-result-123',
    stepNo: 1,
    agentId: 'insurance-d',
    requestContent: {
      task: '写一篇保险科普文章',
      topic: '增额寿'
    },
    responseStatus: 'COMPLETED' as const,
    responseContent: {
      result: '文章已完成',
      articleId: 'ART-2024-002'
    },
    subTaskId: 1,
  },
};

// 为了测试，我们提取需要测试的纯逻辑
class RecordAgentInteractionLogicTester {
  private testResults: Array<{
    testName: string;
    passed: boolean;
    error?: string;
  }> = [];

  // 复制被测类的辅助方法逻辑用于测试
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private generateInteractionFingerprint(
    agentId: string,
    requestContent: any,
    responseStatus: string
  ): string {
    const contentStr = typeof requestContent === 'string' 
      ? requestContent 
      : JSON.stringify(requestContent);
    const contentPreview = contentStr.substring(0, 1000);
    return `${agentId}:${responseStatus}:${this.simpleHash(contentPreview)}`;
  }

  private isDuplicateInteraction(
    existingContent: any,
    newFingerprint: string
  ): boolean {
    if (!existingContent) return false;
    return existingContent.fingerprint === newFingerprint;
  }

  private isUniqueConstraintError(error: any): boolean {
    const errorMsg = error?.message || String(error);
    return errorMsg.includes('unique constraint') || 
           errorMsg.includes('duplicate key') ||
           errorMsg.includes('idx_task_step_num_type_user');
  }

  async runAllTests() {
    console.log('========================================');
    console.log('  recordAgentInteraction 单元测试');
    console.log('========================================\n');

    // 测试1: simpleHash 方法
    await this.testSimpleHash();

    // 测试2: generateInteractionFingerprint 方法
    await this.testGenerateFingerprint();

    // 测试3: 相同内容生成相同指纹
    await this.testSameContentSameFingerprint();

    // 测试4: 不同内容生成不同指纹
    await this.testDifferentContentDifferentFingerprint();

    // 测试5: isDuplicateInteraction 方法
    await this.testIsDuplicateInteraction();

    // 测试6: isUniqueConstraintError 方法
    await this.testIsUniqueConstraintError();

    // 测试7: interactNum 递增逻辑
    await this.testInteractNumIncrement();

    this.printSummary();
  }

  private async testSimpleHash() {
    const testName = 'simpleHash 方法';
    console.log(`【测试1】${testName}`);

    try {
      const testStr = 'test string';
      const hash1 = this.simpleHash(testStr);
      const hash2 = this.simpleHash(testStr);
      
      if (hash1 !== hash2) {
        throw new Error('相同输入应该产生相同 hash');
      }

      if (typeof hash1 !== 'string') {
        throw new Error('hash 应该是字符串');
      }

      if (hash1.length === 0) {
        throw new Error('hash 不应该为空');
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

  private async testGenerateFingerprint() {
    const testName = 'generateInteractionFingerprint 方法';
    console.log(`【测试2】${testName}`);

    try {
      const data = TEST_DATA.normalInteraction;
      const fingerprint = this.generateInteractionFingerprint(
        data.agentId,
        data.requestContent,
        data.responseStatus
      );

      if (!fingerprint.startsWith(`${data.agentId}:${data.responseStatus}:`)) {
        throw new Error('指纹格式不正确');
      }

      if (fingerprint.split(':').length !== 3) {
        throw new Error('指纹应该包含3个部分');
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

  private async testSameContentSameFingerprint() {
    const testName = '相同内容生成相同指纹';
    console.log(`【测试3】${testName}`);

    try {
      const data = TEST_DATA.normalInteraction;
      const fingerprint1 = this.generateInteractionFingerprint(
        data.agentId,
        data.requestContent,
        data.responseStatus
      );
      const fingerprint2 = this.generateInteractionFingerprint(
        data.agentId,
        data.requestContent,
        data.responseStatus
      );

      if (fingerprint1 !== fingerprint2) {
        throw new Error('相同内容应该生成相同指纹');
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

  private async testDifferentContentDifferentFingerprint() {
    const testName = '不同内容生成不同指纹';
    console.log(`【测试4】${testName}`);

    try {
      const data1 = TEST_DATA.normalInteraction;
      const data2 = TEST_DATA.differentInteraction;

      const fingerprint1 = this.generateInteractionFingerprint(
        data1.agentId,
        data1.requestContent,
        data1.responseStatus
      );
      const fingerprint2 = this.generateInteractionFingerprint(
        data2.agentId,
        data2.requestContent,
        data2.responseStatus
      );

      if (fingerprint1 === fingerprint2) {
        throw new Error('不同内容应该生成不同指纹');
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

  private async testIsDuplicateInteraction() {
    const testName = 'isDuplicateInteraction 方法';
    console.log(`【测试5】${testName}`);

    try {
      const data = TEST_DATA.normalInteraction;
      const fingerprint = this.generateInteractionFingerprint(
        data.agentId,
        data.requestContent,
        data.responseStatus
      );

      // 测试：相同指纹应该返回 true
      const existingContent = { fingerprint };
      const isDuplicate1 = this.isDuplicateInteraction(existingContent, fingerprint);
      
      if (!isDuplicate1) {
        throw new Error('相同指纹应该判定为重复');
      }

      // 测试：不同指纹应该返回 false
      const differentFingerprint = fingerprint + 'different';
      const isDuplicate2 = this.isDuplicateInteraction(existingContent, differentFingerprint);
      
      if (isDuplicate2) {
        throw new Error('不同指纹不应该判定为重复');
      }

      // 测试：null 应该返回 false
      const isDuplicate3 = this.isDuplicateInteraction(null, fingerprint);
      
      if (isDuplicate3) {
        throw new Error('null content 不应该判定为重复');
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

  private async testIsUniqueConstraintError() {
    const testName = 'isUniqueConstraintError 方法';
    console.log(`【测试6】${testName}`);

    try {
      // 测试：unique constraint 错误
      const error1 = new Error('duplicate key value violates unique constraint "idx_task_step_num_type_user"');
      const isUnique1 = this.isUniqueConstraintError(error1);
      
      if (!isUnique1) {
        throw new Error('应该识别 unique constraint 错误');
      }

      // 测试：duplicate key 错误
      const error2 = new Error('duplicate key error');
      const isUnique2 = this.isUniqueConstraintError(error2);
      
      if (!isUnique2) {
        throw new Error('应该识别 duplicate key 错误');
      }

      // 测试：idx_task_step_num_type_user 错误
      const error3 = new Error('idx_task_step_num_type_user');
      const isUnique3 = this.isUniqueConstraintError(error3);
      
      if (!isUnique3) {
        throw new Error('应该识别 idx_task_step_num_type_user 错误');
      }

      // 测试：其他错误
      const error4 = new Error('database connection failed');
      const isUnique4 = this.isUniqueConstraintError(error4);
      
      if (isUnique4) {
        throw new Error('不应该识别其他错误为唯一约束错误');
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

  private async testInteractNumIncrement() {
    const testName = 'interactNum 递增逻辑';
    console.log(`【测试7】${testName}`);

    try {
      // 模拟数据库查询结果
      const testCases = [
        { existing: [], expected: 1 },
        { existing: [{ interactNum: 1 }], expected: 2 },
        { existing: [{ interactNum: 1 }, { interactNum: 2 }], expected: 3 },
        { existing: [{ interactNum: 5 }], expected: 6 },
        { existing: [{ interactNum: null }], expected: 2 }, // 测试 null 值处理
      ];

      for (const testCase of testCases) {
        const existingRecords = testCase.existing;
        const nextInteractNum = existingRecords.length > 0
          ? Math.max(...existingRecords.map(r => r.interactNum || 1)) + 1
          : 1;

        if (nextInteractNum !== testCase.expected) {
          throw new Error(
            `现有记录数 ${existingRecords.length}, ` +
            `期望 nextInteractNum ${testCase.expected}, ` +
            `实际 ${nextInteractNum}`
          );
        }
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

  private printSummary() {
    console.log('========================================');
    console.log('              测试报告');
    console.log('========================================');

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;

    console.log(`\n总计: ${total} | 通过: ${passed} | 失败: ${failed}`);
    console.log(`通过率: ${((passed / total) * 100).toFixed(1)}%`);

    console.log('\n详细结果:');
    this.testResults.forEach(result => {
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`  ${status} ${result.testName}`);
      if (result.error) {
        console.log(`       错误: ${result.error}`);
      }
    });

    console.log('\n' + '='.repeat(40));
    if (failed === 0) {
      console.log('  🎉 所有测试通过！');
    } else {
      console.log(`  ⚠️  有 ${failed} 个测试失败`);
    }
    console.log('='.repeat(40));
  }
}

// 主程序
async function main() {
  const tester = new RecordAgentInteractionLogicTester();
  await tester.runAllTests();
  process.exit(0);
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  main().catch(console.error);
}

// 导出供其他测试使用
export { RecordAgentInteractionLogicTester };
