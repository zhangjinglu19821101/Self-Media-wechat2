/**
 * 直接测试 agentSelfCheck 的缓存行为
 */

import { agentSelfCheck, clearAllCaches } from './src/lib/agent-llm.ts';

console.log('='.repeat(60));
console.log('🧪 直接测试 agentSelfCheck 缓存');
console.log('='.repeat(60));

// 清空缓存
clearAllCaches();
console.log('✅ 缓存已清空\n');

const task = {
  taskTitle: '撰写一篇关于重疾险的文章',
  taskName: '撰写一篇关于重疾险的文章',
  commandContent: '要求包括产品对比、理赔流程、注意事项，字数 1500 字',
  coreCommand: '要求包括产品对比、理赔流程、注意事项，字数 1500 字',
};

console.log('任务信息:');
console.log(`  - 任务标题: ${task.taskTitle}`);
console.log(`  - 任务内容: ${task.commandContent}\n`);

console.log('='.repeat(60));
console.log('📝 第一次调用（预期：未命中缓存，设置缓存）');
console.log('='.repeat(60));

const startTime1 = Date.now();
const result1 = await agentSelfCheck('insurance-d', task);
const duration1 = Date.now() - startTime1;

console.log(`✅ 调用完成`);
console.log(`  - 耗时: ${duration1}ms`);
console.log(`  - 结果: ${result1.resolution}`);
console.log(`  - 有疑问: ${result1.hasQuestions}\n`);

console.log('='.repeat(60));
console.log('📝 第二次调用（预期：命中缓存）');
console.log('='.repeat(60));

const startTime2 = Date.now();
const result2 = await agentSelfCheck('insurance-d', task);
const duration2 = Date.now() - startTime2;

console.log(`✅ 调用完成`);
console.log(`  - 耗时: ${duration2}ms`);
console.log(`  - 结果: ${result2.resolution}`);
console.log(`  - 有疑问: ${result2.hasQuestions}\n`);

console.log('='.repeat(60));
console.log('📊 总结');
console.log('='.repeat(60));

console.log('\n对比结果:');
console.log(`  - 第一次耗时: ${duration1}ms`);
console.log(`  - 第二次耗时: ${duration2}ms`);
console.log(`  - 速度提升: ${((duration1 - duration2) / duration1 * 100).toFixed(2)}%`);

console.log('\n结果一致性:');
const isConsistent = JSON.stringify(result1) === JSON.stringify(result2);
console.log(`  - 结果是否一致: ${isConsistent ? '✅ 是' : '❌ 否'}`);

console.log('\n缓存行为:');
if (duration2 < duration1) {
  console.log('  ✅ 第二次调用更快，说明缓存生效');
} else if (duration2 === duration1) {
  console.log('  ⚠️  两次调用耗时相同，可能缓存未生效或模拟数据太快');
} else {
  console.log('  ❌ 第二次调用更慢，说明有问题');
}

console.log('\n' + '='.repeat(60));
