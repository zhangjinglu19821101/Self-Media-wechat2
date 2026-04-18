/**
 * 前序选择器控制器单元测试
 * 
 * 测试策略：
 * - 纯单元测试，不依赖数据库
 * - 使用Mock数据测试解析逻辑
 * - 测试边界条件和错误处理
 */

import { PrecedentSelectorController } from './precedent-selector-controller';

// 测试数据
const TEST_DATA = {
  // 正常的选择响应
  normalResponse: `
{
  "status": "completed",
  "result": {
    "selectedSubtasks": [
      {
        "subtaskId": "subtask-123",
        "orderIndex": 1,
        "reason": "需要子任务1的分析结果"
      },
      {
        "subtaskId": "subtask-456",
        "orderIndex": 2
      }
    ],
    "selectedMcpResults": [
      {
        "mcpResultId": "101",
        "reason": "需要这个文件内容"
      },
      {
        "mcpResultId": "102"
      }
    ]
  },
  "message": "已选择需要的前序信息",
  "confidence": 95,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "agentVersion": "1.0.0"
}
`,

  // 空选择响应
  emptyResponse: `
{
  "status": "completed",
  "result": {
    "selectedSubtasks": [],
    "selectedMcpResults": []
  },
  "message": "无需前序信息，可直接执行",
  "confidence": 85,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "agentVersion": "1.0.0"
}
`,

  // 包含额外文字的响应
  responseWithExtraText: `
好的，我来选择需要的前序信息。

{
  "status": "completed",
  "result": {
    "selectedSubtasks": [
      {
        "subtaskId": "subtask-789",
        "orderIndex": 3
      }
    ],
    "selectedMcpResults": []
  },
  "message": "已选择",
  "confidence": 90,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "agentVersion": "1.0.0"
}

希望这个选择合适！
`,

  // 缺少字段的响应
  incompleteResponse: `
{
  "status": "completed",
  "message": "测试",
  "confidence": 80,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "agentVersion": "1.0.0"
}
`,

  // 无效JSON
  invalidJson: `
这不是一个有效的JSON
{
  "status": "completed",
  这里有语法错误
}
`
};

// 测试类
class PrecedentSelectorControllerTester {
  private testResults: Array<{
    testName: string;
    passed: boolean;
    error?: string;
  }> = [];

  async runAllTests() {
    console.log('========================================');
    console.log('  前序选择器控制器单元测试');
    console.log('========================================\n');

    // 测试1: 解析正常响应
    await this.testParseNormalResponse();

    // 测试2: 解析空选择响应
    await this.testParseEmptyResponse();

    // 测试3: 解析包含额外文字的响应
    await this.testParseResponseWithExtraText();

    // 测试4: 解析缺少字段的响应（容错测试）
    await this.testParseIncompleteResponse();

    // 测试5: 解析无效JSON
    await this.testParseInvalidJson();

    // 测试6: 拼装执行提示词 - 有前序信息
    await this.testAssemblePromptWithPrecedent();

    // 测试7: 拼装执行提示词 - 无前序信息
    await this.testAssemblePromptWithoutPrecedent();

    this.printSummary();
  }

  private async testParseNormalResponse() {
    const testName = '解析正常响应';
    console.log(`【测试1】${testName}`);

    try {
      const result = PrecedentSelectorController.parseAgentResponse(TEST_DATA.normalResponse);
      
      // 验证结果
      if (result.status !== 'completed') {
        throw new Error(`status错误: 期望completed, 实际${result.status}`);
      }
      if (result.result.selectedSubtasks.length !== 2) {
        throw new Error(`selectedSubtasks数量错误: 期望2, 实际${result.result.selectedSubtasks.length}`);
      }
      if (result.result.selectedMcpResults.length !== 2) {
        throw new Error(`selectedMcpResults数量错误: 期望2, 实际${result.result.selectedMcpResults.length}`);
      }
      if (result.result.selectedSubtasks[0].subtaskId !== 'subtask-123') {
        throw new Error('subtaskId错误');
      }
      if (result.result.selectedMcpResults[0].mcpResultId !== '101') {
        throw new Error('mcpResultId错误');
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

  private async testParseEmptyResponse() {
    const testName = '解析空选择响应';
    console.log(`【测试2】${testName}`);

    try {
      const result = PrecedentSelectorController.parseAgentResponse(TEST_DATA.emptyResponse);
      
      if (result.result.selectedSubtasks.length !== 0) {
        throw new Error(`selectedSubtasks应该为空, 实际${result.result.selectedSubtasks.length}`);
      }
      if (result.result.selectedMcpResults.length !== 0) {
        throw new Error(`selectedMcpResults应该为空, 实际${result.result.selectedMcpResults.length}`);
      }
      if (result.message !== '无需前序信息，可直接执行') {
        throw new Error('message错误');
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

  private async testParseResponseWithExtraText() {
    const testName = '解析包含额外文字的响应';
    console.log(`【测试3】${testName}`);

    try {
      const result = PrecedentSelectorController.parseAgentResponse(TEST_DATA.responseWithExtraText);
      
      if (result.result.selectedSubtasks.length !== 1) {
        throw new Error(`selectedSubtasks数量错误: 期望1, 实际${result.result.selectedSubtasks.length}`);
      }
      if (result.result.selectedSubtasks[0].subtaskId !== 'subtask-789') {
        throw new Error('subtaskId错误');
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

  private async testParseIncompleteResponse() {
    const testName = '解析缺少字段的响应（容错测试）';
    console.log(`【测试4】${testName}`);

    try {
      const result = PrecedentSelectorController.parseAgentResponse(TEST_DATA.incompleteResponse);
      
      // 验证容错机制 - 缺少result字段时应该初始化空数组
      if (!Array.isArray(result.result.selectedSubtasks)) {
        throw new Error('selectedSubtasks应该是数组');
      }
      if (!Array.isArray(result.result.selectedMcpResults)) {
        throw new Error('selectedMcpResults应该是数组');
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

  private async testParseInvalidJson() {
    const testName = '解析无效JSON';
    console.log(`【测试5】${testName}`);

    try {
      PrecedentSelectorController.parseAgentResponse(TEST_DATA.invalidJson);
      
      // 应该抛出错误
      this.testResults.push({ 
        testName, 
        passed: false, 
        error: '应该抛出错误但没有' 
      });
      console.log('  ✗ 失败: 应该抛出错误但没有\n');
    } catch (error) {
      // 预期会抛出错误
      this.testResults.push({ testName, passed: true });
      console.log('  ✓ 通过（正确抛出错误）\n');
    }
  }

  private async testAssemblePromptWithPrecedent() {
    const testName = '拼装执行提示词 - 有前序信息';
    console.log(`【测试6】${testName}`);

    try {
      const currentTask = '完成项目架构设计';
      const extractedInfo = {
        subtaskTexts: [
          '【子任务1】\n标题：需求分析\n描述：分析用户需求\n执行结果：\n用户需要一个电商网站',
          '【子任务2】\n标题：技术选型\n描述：选择技术栈\n执行结果：\n选择Next.js + TypeScript'
        ],
        mcpResultTexts: [
          '【MCP执行结果 - read_file】\n时间：2024-01-01T00:00:00.000Z\n工具：read_file\n输出：\n{"content": "参考文档内容"}'
        ]
      };

      const prompt = PrecedentSelectorController.assembleExecutionPrompt(currentTask, extractedInfo);
      
      // 验证提示词包含必要内容
      if (!prompt.includes('完成项目架构设计')) {
        throw new Error('提示词缺少当前任务');
      }
      if (!prompt.includes('需求分析')) {
        throw new Error('提示词缺少子任务1');
      }
      if (!prompt.includes('技术选型')) {
        throw new Error('提示词缺少子任务2');
      }
      if (!prompt.includes('read_file')) {
        throw new Error('提示词缺少MCP结果');
      }
      if (!prompt.includes('已选择的前序信息')) {
        throw new Error('提示词缺少前序信息标识');
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

  private async testAssemblePromptWithoutPrecedent() {
    const testName = '拼装执行提示词 - 无前序信息';
    console.log(`【测试7】${testName}`);

    try {
      const currentTask = '完成项目架构设计';
      const extractedInfo = {
        subtaskTexts: [],
        mcpResultTexts: []
      };

      const prompt = PrecedentSelectorController.assembleExecutionPrompt(currentTask, extractedInfo);
      
      // 验证提示词
      if (!prompt.includes('完成项目架构设计')) {
        throw new Error('提示词缺少当前任务');
      }
      if (prompt.includes('已选择的前序信息')) {
        throw new Error('提示词不应该包含前序信息标识');
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
  const tester = new PrecedentSelectorControllerTester();
  await tester.runAllTests();
  process.exit(0);
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  main().catch(console.error);
}

// 导出供其他测试使用
export { PrecedentSelectorControllerTester };
