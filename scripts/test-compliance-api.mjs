/**
 * API 测试脚本：微信公众号合规校验功能
 * 
 * 使用方法：
 * 1. 确保开发服务器已启动：pnpm dev
 * 2. 运行测试：node scripts/test-compliance-api.mjs
 */

const BASE_URL = 'http://localhost:5000';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(title, message, color = 'reset') {
  console.log(`${colors[color]}[${title}]${colors.reset} ${message}`);
}

// 测试 1：查询 capability_list 中的合规校验配置
async function testCapabilityConfig() {
  log('TEST 1', '查询合规校验能力配置', 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/capability-list?ids=20,21`);
    const data = await response.json();
    
    if (data.success) {
      log('PASS', '成功获取能力配置', 'green');
      data.data.forEach(cap => {
        console.log(`  ID=${cap.id}: ${cap.capability_type}`);
        console.log(`    tool_name: ${cap.tool_name}`);
        console.log(`    action_name: ${cap.action_name}`);
        console.log(`    trigger_value: ${cap.agent_response_spec?.trigger_value}`);
      });
      return true;
    } else {
      log('FAIL', `获取失败: ${data.error}`, 'red');
      return false;
    }
  } catch (error) {
    log('FAIL', `请求异常: ${error.message}`, 'red');
    return false;
  }
}

// 测试 2：直接调用合规审核执行器（通过 branch1-executor）
async function testComplianceAudit() {
  log('TEST 2', '测试完整合规审核（ID=20）', 'blue');
  
  const testPayload = {
    solutionNum: 20,
    agentBOutput: {
      hasSolution: true,
      solutionNum: 20
    },
    mcpArgs: {
      articleTitle: '保险理财产品推荐，保证高收益',
      articleContent: '这款产品保证年化收益10%，稳赚不赔，零风险高回报！最佳理财首选。',
      auditMode: 'full'
    }
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/test/execute-branch1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('PASS', '完整审核执行成功', 'green');
      const auditResult = data.data?.data;
      if (auditResult) {
        console.log(`  审核通过: ${auditResult.approved}`);
        console.log(`  风险等级: ${auditResult.riskLevel}`);
        console.log(`  问题数量: ${auditResult.issues?.length || 0}`);
        if (auditResult.issues?.length > 0) {
          console.log('  发现问题:');
          auditResult.issues.forEach((issue, i) => {
            console.log(`    ${i + 1}. ${issue}`);
          });
        }
      }
      return true;
    } else {
      log('FAIL', `执行失败: ${data.error}`, 'red');
      return false;
    }
  } catch (error) {
    log('FAIL', `请求异常: ${error.message}`, 'red');
    return false;
  }
}

// 测试 3：测试快速检查（ID=21）
async function testSimpleAudit() {
  log('TEST 3', '测试快速合规检查（ID=21）', 'blue');
  
  const testPayload = {
    solutionNum: 21,
    agentBOutput: {
      hasSolution: true,
      solutionNum: 21
    },
    mcpArgs: {
      articleContent: '本文介绍保险知识，帮助大家科学配置保险产品。'
    }
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/test/execute-branch1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    
    const data = await response.json();
    
    if (data.success) {
      log('PASS', '快速检查执行成功', 'green');
      const auditResult = data.data?.data;
      if (auditResult) {
        console.log(`  审核通过: ${auditResult.approved}`);
        console.log(`  风险等级: ${auditResult.riskLevel}`);
        console.log(`  总结: ${auditResult.summary}`);
      }
      return true;
    } else {
      log('FAIL', `执行失败: ${data.error}`, 'red');
      return false;
    }
  } catch (error) {
    log('FAIL', `请求异常: ${error.message}`, 'red');
    return false;
  }
}

// 测试 4：测试敏感词检测
async function testSensitiveWords() {
  log('TEST 4', '测试敏感词检测', 'blue');
  
  const testPayload = {
    solutionNum: 20,
    agentBOutput: {
      hasSolution: true,
      solutionNum: 20
    },
    mcpArgs: {
      articleTitle: '保本保息，稳赚不赔的保险产品',
      articleContent: '我们承诺保证收益，零风险，第一选择。'
    }
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/test/execute-branch1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    
    const data = await response.json();
    
    if (data.success) {
      const auditResult = data.data?.data;
      if (auditResult && !auditResult.approved && auditResult.issues.length > 0) {
        log('PASS', `成功检测到 ${auditResult.issues.length} 个问题`, 'green');
        auditResult.issues.forEach((issue, i) => {
          console.log(`    ${i + 1}. ${issue}`);
        });
        return true;
      } else {
        log('WARN', '未检测到预期的敏感词问题', 'yellow');
        return false;
      }
    } else {
      log('FAIL', `执行失败: ${data.error}`, 'red');
      return false;
    }
  } catch (error) {
    log('FAIL', `请求异常: ${error.message}`, 'red');
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('=== 微信公众号合规校验功能测试 ===\n');
  
  const results = [];
  
  // 测试 1：查询配置
  results.push({ name: '查询能力配置', result: await testCapabilityConfig() });
  console.log();
  
  // 测试 2：完整审核
  results.push({ name: '完整合规审核', result: await testComplianceAudit() });
  console.log();
  
  // 测试 3：快速检查
  results.push({ name: '快速合规检查', result: await testSimpleAudit() });
  console.log();
  
  // 测试 4：敏感词检测
  results.push({ name: '敏感词检测', result: await testSensitiveWords() });
  console.log();
  
  // 汇总结果
  console.log('=== 测试结果汇总 ===');
  const passed = results.filter(r => r.result).length;
  const total = results.length;
  
  results.forEach(r => {
    const status = r.result ? `${colors.green}✅ PASS${colors.reset}` : `${colors.red}❌ FAIL${colors.reset}`;
    console.log(`  ${status} ${r.name}`);
  });
  
  console.log(`\n总计: ${passed}/${total} 通过`);
  
  if (passed === total) {
    console.log(`${colors.green}所有测试通过！可以上传真实公众号文章进行验证。${colors.reset}`);
  } else {
    console.log(`${colors.yellow}部分测试未通过，请检查配置。${colors.reset}`);
  }
}

runAllTests().catch(error => {
  console.error('测试执行异常:', error);
  process.exit(1);
});
