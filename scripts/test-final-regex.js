// 最终测试修复后的正则表达式

const EXECUTOR_MAP = {
  'agent b': 'B',
  'agent-b': 'B',
  'agentb': 'B',
  'b': 'B',
  'insurance-c': 'insurance-c',
  'insurance-d': 'insurance-d',
};

function parseExecutorId(executorText) {
  const normalized = executorText.trim().toLowerCase();
  return EXECUTOR_MAP[normalized] || null;
}

// 失败的指令（用户提供的）
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
const regex1 = /####\s*执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*\n/gi;
const regex2 = /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*(?:\n|$)/gi;

console.log('🔍 测试失败的指令（用户提供的）:\n');

const allResults = [];

// 使用第一个正则
const matches1 = failedCommand.matchAll(regex1);
for (const match of matches1) {
  const executorText = match[1] || match[2];
  const cleanedText = executorText ? executorText.trim().replace(/[，。、；：,.;:：]+$/, '') : null;
  const executorId = parseExecutorId(cleanedText);
  
  if (executorId) {
    allResults.push({
      regex: 'regex1 (####)',
      executorId,
      text: cleanedText,
      index: match.index,
    });
  }
}

// 使用第二个正则
const matches2 = failedCommand.matchAll(regex2);
for (const match of matches2) {
  const executorText = match[1] || match[2];
  const cleanedText = executorText ? executorText.trim().replace(/[，。、；：,.;:：]+$/, '') : null;
  const executorId = parseExecutorId(cleanedText);
  
  if (executorId) {
    allResults.push({
      regex: 'regex2 (通用)',
      executorId,
      text: cleanedText,
      index: match.index,
    });
  }
}

console.log(`📊 检测结果: 共找到 ${allResults.length} 个执行主体\n`);

if (allResults.length === 0) {
  console.log('❌ 未检测到任何执行主体！');
} else {
  allResults.forEach((result, idx) => {
    console.log(`${idx + 1}. Agent ${result.executorId}`);
    console.log(`   文本: "${result.text}"`);
    console.log(`   正则: ${result.regex}`);
    console.log(`   位置: ${result.index}`);
    console.log('');
  });
}

// 测试各种格式
console.log('=' .repeat(60));
console.log('测试各种格式:\n');

const testCases = [
  { text: '#### 执行主体为「insurance-c」', expected: 'insurance-c' },
  { text: '#### 执行主体：Agent B', expected: 'B' },
  { text: '#### 执行主体 insurance-d', expected: 'insurance-d' },
  { text: '执行主体为「insurance-c」', expected: 'insurance-c' },
  { text: '执行主体：Agent B', expected: 'B' },
  { text: '执行主体 insurance-d', expected: 'insurance-d' },
];

testCases.forEach((testCase, idx) => {
  const testRegex = /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))(?:\s*[\n$,.;:：]*)?/gi;
  const testMatch = testCase.text.match(testRegex);
  
  if (testMatch) {
    const executorText = testMatch[1] || testMatch[2];
    const cleanedText = executorText ? executorText.trim().replace(/[，。、；：,.;:：]+$/, '') : null;
    const executorId = parseExecutorId(cleanedText);
    
    const status = executorId === testCase.expected ? '✅' : '❌';
    console.log(`${idx + 1}. ${status} "${testCase.text}"`);
    console.log(`   提取: "${cleanedText}" -> Agent ${executorId} (预期: ${testCase.expected})\n`);
  } else {
    console.log(`${idx + 1}. ❌ "${testCase.text}" - 未匹配\n`);
  }
});
