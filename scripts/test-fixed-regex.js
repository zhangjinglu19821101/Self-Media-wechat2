// 测试修复后的正则表达式

const failedCommand = `### 向董事长（交互人）汇报并请示方案：
#### 一、职责边界匹配校验（前置完成）
本次任务为技术支撑类，执行主体为Agent B（技术岗），符合「技术类任务仅下达至B」的职责边界要求，校验通过，标注「职责标签：技术类」。

#### 二、拟下发具体指令（待审批）
---
##### 【指令】
**职责标签：技术类**
#### 执行主体 Agent B
> 核心目标：3天内为保险事业部运营、内容岗提供精准技术支撑，保障核心任务节点推进
> 执行范围：保险事业部insurance-c、insurance-d的核心任务全流程`;

// 修复后的正则表达式
const fixedRegex = /####\s*执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*\n/gi;

console.log('🔍 测试修复后的正则表达式:');
console.log('   正则:', fixedRegex.source);
console.log('');

const matches = failedCommand.matchAll(fixedRegex);
const results = Array.from(matches);

console.log(`📊 匹配结果: ${results.length} 个\n`);

if (results.length === 0) {
  console.log('❌ 未匹配到任何执行主体！');
} else {
  results.forEach((match, idx) => {
    console.log(`${idx + 1}. 匹配详情:`);
    console.log(`   完整匹配: "${match[0]}"`);
    console.log(`   捕获组1（引号）: ${match[1] ? `"${match[1]}"` : 'null'}`);
    console.log(`   捕获组2（无引号）: ${match[2] ? `"${match[2]}"` : 'null'}`);
    console.log(`   最终提取: "${match[1] || match[2]}"`);
    console.log(`   位置: ${match.index}`);
    console.log('');
  });
}

// 测试其他格式
console.log('=' .repeat(60));
console.log('测试其他格式:\n');

const testCases = [
  '#### 执行主体为「insurance-c」',
  '#### 执行主体：Agent B',
  '#### 执行主体 insurance-d',
  '执行主体为「insurance-c」',
];

testCases.forEach((testCase, idx) => {
  const testRegex = /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*(?:\n|$)/gi;
  const testMatch = testCase.match(testRegex);
  
  if (testMatch) {
    console.log(`${idx + 1}. "${testCase}"`);
    console.log(`   ✅ 匹配: "${testMatch[1] || testMatch[2]}"\n`);
  } else {
    console.log(`${idx + 1}. "${testCase}"`);
    console.log(`   ❌ 未匹配\n`);
  }
});
