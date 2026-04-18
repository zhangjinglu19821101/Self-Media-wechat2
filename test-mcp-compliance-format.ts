/**
 * 测试MCP合规校验格式化功能
 */

import { ComplianceResultFormatter } from './src/lib/utils/compliance-result-formatter';

// 测试数据 - 模拟MCP合规校验返回结果
const testMcpResult = {
  approved: false,
  riskLevel: 'medium' as const,
  issues: [
    '使用了绝对化用语：最好、最佳',
    '使用了保险行业敏感用语：保本、保息'
  ],
  suggestions: [
    '建议避免使用绝对化用语，使用更客观的表述',
    '建议避免使用违规承诺类用语，遵守保险行业监管规定'
  ],
  referencedRules: [
    '保险广告不得使用绝对化用语',
    '保险产品不得承诺保本保息'
  ],
  auditTime: new Date().toISOString()
};

// 测试数据2 - 模拟通过的情况
const testMcpResultApproved = {
  approved: true,
  riskLevel: 'low' as const,
  issues: [],
  suggestions: [],
  referencedRules: [],
  auditTime: new Date().toISOString(),
  summary: '文章内容合规，未发现明显违规问题'
};

// 适配器函数 - 模拟我们在MCP中实现的转换
function formatMcpAuditResultToSummary(auditResult: any): string {
  // 构建兼容的合规检查结果格式
  const complianceResult = {
    isCompliant: auditResult.approved || false,
    score: auditResult.riskLevel === 'low' ? 90 : 
           auditResult.riskLevel === 'medium' ? 70 : 
           auditResult.riskLevel === 'high' ? 50 : 30,
    issues: (auditResult.issues || []).map((issue: string, index: number) => ({
      type: auditResult.riskLevel === 'critical' ? 'critical' : 
            auditResult.riskLevel === 'high' ? 'warning' : 'info',
      category: '内容合规',
      description: issue,
      suggestion: (auditResult.suggestions || [])[index] || '请根据合规要求修改'
    })),
    summary: auditResult.summary || '合规审核完成',
    recommendations: auditResult.suggestions || []
  };

  // 使用格式化器生成摘要
  return ComplianceResultFormatter.format(complianceResult);
}

console.log('========================================');
console.log('  MCP合规校验格式化功能测试');
console.log('========================================\n');

// 测试1: 有问题的情况
console.log('【测试1】有合规问题的情况');
console.log('-'.repeat(60));
const formatted1 = formatMcpAuditResultToSummary(testMcpResult);
console.log(formatted1);
console.log('\n');

// 测试2: 通过的情况
console.log('【测试2】合规通过的情况');
console.log('-'.repeat(60));
const formatted2 = formatMcpAuditResultToSummary(testMcpResultApproved);
console.log(formatted2);
console.log('\n');

console.log('========================================');
console.log('  测试完成！');
console.log('========================================');
