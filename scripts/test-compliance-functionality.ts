/**
 * 微信公众号合规校验功能测试脚本
 * 
 * 测试内容：
 * 1. 测试合规审核执行器是否正确注册
 * 2. 测试 branch1-executor 是否能正确分发到合规审核
 * 3. 测试完整审核流程（ID=20）
 * 4. 测试快速检查流程（ID=21）
 */

import { MCPCapabilityExecutorFactory } from '../src/lib/mcp/mcp-executor';
import '../src/lib/mcp/wechat-compliance-auditor';
import { executeBranch1 } from '../src/lib/mcp/branch1-executor';

async function runTests() {
  console.log('=== 微信公众号合规校验功能测试 ===\n');

  // 测试 1：验证执行器是否正确注册
  console.log('测试 1：验证执行器注册状态');
  console.log('----------------------------------------');
  
  const executor20 = MCPCapabilityExecutorFactory.getExecutor(20);
  const executor21 = MCPCapabilityExecutorFactory.getExecutor(21);
  
  console.log(`  ID=20 执行器: ${executor20 ? '✅ 已注册' : '❌ 未注册'}`);
  console.log(`  ID=21 执行器: ${executor21 ? '✅ 已注册' : '❌ 未注册'}`);
  
  if (executor20) {
    console.log(`  ID=20 名称: ${executor20.capabilityName}`);
  }
  if (executor21) {
    console.log(`  ID=21 名称: ${executor21.capabilityName}`);
  }
  console.log();

  // 测试 2：测试完整审核（ID=20）
  if (executor20) {
    console.log('测试 2：完整审核（ID=20）');
    console.log('----------------------------------------');
    
    const testArticle = {
      articleTitle: '保险理财产品推荐，保证高收益',
      articleContent: '这款产品保证年化收益10%，稳赚不赔，零风险高回报！最佳理财首选。',
      auditMode: 'full'
    };
    
    console.log('  输入参数:', JSON.stringify(testArticle, null, 2));
    
    try {
      const result = await executeBranch1({
        solutionNum: 20,
        agentBOutput: {
          hasSolution: true,
          solutionNum: 20
        },
        mcpArgs: testArticle
      });
      
      console.log('  执行结果:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('  ❌ 执行失败:', error);
    }
    console.log();
  }

  // 测试 3：测试快速检查（ID=21）
  if (executor21) {
    console.log('测试 3：快速检查（ID=21）');
    console.log('----------------------------------------');
    
    const testArticle = {
      articleContent: '本文介绍保险知识，帮助大家科学配置保险产品。'
    };
    
    console.log('  输入参数:', JSON.stringify(testArticle, null, 2));
    
    try {
      const result = await executeBranch1({
        solutionNum: 21,
        agentBOutput: {
          hasSolution: true,
          solutionNum: 21
        },
        mcpArgs: testArticle
      });
      
      console.log('  执行结果:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('  ❌ 执行失败:', error);
    }
    console.log();
  }

  // 测试 4：测试敏感词检测
  if (executor20) {
    console.log('测试 4：敏感词检测');
    console.log('----------------------------------------');
    
    const sensitiveArticle = {
      articleTitle: '保本保息，稳赚不赔的保险产品',
      articleContent: '我们承诺保证收益，零风险，第一选择。'
    };
    
    console.log('  输入参数:', JSON.stringify(sensitiveArticle, null, 2));
    
    try {
      const result = await executeBranch1({
        solutionNum: 20,
        agentBOutput: {
          hasSolution: true,
          solutionNum: 20
        },
        mcpArgs: sensitiveArticle
      });
      
      if (result.success && result.data?.data) {
        const auditResult = result.data.data;
        console.log(`  审核通过: ${auditResult.approved ? '是' : '否'}`);
        console.log(`  风险等级: ${auditResult.riskLevel}`);
        console.log(`  问题数量: ${auditResult.issues?.length || 0}`);
        if (auditResult.issues?.length > 0) {
          console.log('  发现问题:');
          auditResult.issues.forEach((issue: string, i: number) => {
            console.log(`    ${i + 1}. ${issue}`);
          });
        }
      }
    } catch (error) {
      console.error('  ❌ 执行失败:', error);
    }
    console.log();
  }

  console.log('=== 测试完成 ===');
}

// 运行测试
runTests().catch(console.error);
