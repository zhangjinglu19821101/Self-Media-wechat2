// 简单的验证脚本，检查所有Agent的配置
const fs = require('fs');
const path = require('path');

console.log('🔍 开始验证所有Agent配置...\n');

try {
  // 读取配置文件
  const configPath = path.join(__dirname, 'src/lib/agents/agent-roles-config.ts');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  
  // 简单检查
  const checks = [
    { id: 'A', name: 'Agent A' },
    { id: 'B', name: 'Agent B' },
    { id: 'C', name: 'Agent C' },
    { id: 'D', name: 'Agent D' },
    { id: 'insurance-c', name: 'Insurance C' },
    { id: 'insurance-d', name: 'Insurance D' },
    { id: 'executor', name: 'Executor' },
    { id: 'agent-b', name: 'Agent B (new)' },
  ];
  
  console.log('📋 Agent配置检查结果：\n');
  
  const results = [];
  
  for (const check of checks) {
    const hasStandard = configContent.includes(`'${check.id}':`) && 
                       configContent.includes(`responseType: 'standard'`);
    const hasCustom = configContent.includes(`'${check.id}':`) && 
                     configContent.includes(`responseType: 'custom'`);
    
    let status = '❓ 未知';
    if (hasStandard) {
      status = '✅ 标准';
    } else if (hasCustom) {
      status = '❌ 自定义';
    }
    
    results.push({
      agent: check.id,
      name: check.name,
      status,
      usesStandard: hasStandard,
    });
    
    console.log(`${status} ${check.name} (${check.id})`);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  const standardCount = results.filter(r => r.usesStandard).length;
  const totalCount = results.length;
  
  console.log(`📊 统计：`);
  console.log(`   总计: ${totalCount} 个Agent`);
  console.log(`   使用标准模版: ${standardCount} 个`);
  console.log(`   使用自定义模版: ${totalCount - standardCount} 个`);
  
  if (standardCount === totalCount) {
    console.log('\n🎉 所有Agent都已配置为使用标准返回模版！');
  } else {
    console.log(`\n⚠️ 还有 ${totalCount - standardCount} 个Agent使用自定义模版`);
  }
  
} catch (error) {
  console.error('❌ 验证失败:', error);
}
