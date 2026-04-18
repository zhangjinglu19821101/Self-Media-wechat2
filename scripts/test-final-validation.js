// 最终验证测试

const EXECUTOR_MAP = {
  'agent b': 'B',
  'agent-b': 'B',
  'agentb': 'B',
  'b': 'B',
  'insurance-c': 'insurance-c',
  'insurance-d': 'insurance-d',
};

function parseExecutorId(executorText) {
  if (!executorText) return null;
  const normalized = executorText.trim().toLowerCase();
  return EXECUTOR_MAP[normalized] || null;
}

const COMMAND_FORMATS = [
  {
    name: '标准格式：【指令X】',
    executorRegex: /执行主体[\s:：]*[为]?[\s]*[「\["]*([^\]\"\)」]+)[\"\]」]*/gi,
  },
  {
    name: '连续格式：####执行主体',
    executorRegex: /####\s*执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*\n/gi,
  },
  {
    name: '单指令格式：执行主体',
    executorRegex: /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*(?:\n|$)/gi,
  },
];

function detectExecutors(text) {
  const results = [];
  const seenPositions = new Set();
  
  for (const format of COMMAND_FORMATS) {
    const matches = text.matchAll(format.executorRegex);
    
    for (const match of matches) {
      const executorText = match[1] || match[2];
      
      if (!executorText) continue;
      
      const cleanedText = executorText.trim().replace(/[，。、；：,.;:：]+$/, '');
      const executorId = parseExecutorId(cleanedText);
      
      if (executorId) {
        const position = match.index;
        const isDuplicate = Array.from(seenPositions).some(pos => Math.abs(pos - position) < 10);
        
        if (!isDuplicate) {
          seenPositions.add(position);
          results.push({
            id: executorId,
            text: cleanedText,
            index: position,
            format: format.name,
          });
        }
      }
    }
  }
  
  return results.sort((a, b) => a.index - b.index);
}

// 测试用户的失败指令
const userCommand = `### 向董事长（交互人）汇报并请示方案：
#### 一、职责边界匹配校验（前置完成）
本次任务为技术支撑类，执行主体为Agent B（技术岗），符合「技术类任务仅下达至B」的职责边界要求，校验通过，标注「职责标签：技术类」。

#### 二、拟下发具体指令（待审批）
---
##### 【指令】
**职责标签：技术类**
#### 执行主体 Agent B
> 核心目标：3天内为保险事业部运营、内容岗提供精准技术支撑，保障核心任务节点推进
> 执行范围：保险事业部insurance-c、insurance-d的核心任务全流程`;

console.log('🔍 测试用户的指令:\n');
const results = detectExecutors(userCommand);

console.log(`📊 检测结果: ${results.length} 个执行主体\n`);

if (results.length === 0) {
  console.log('❌ 未检测到任何执行主体！');
} else {
  results.forEach((result, idx) => {
    console.log(`${idx + 1}. Agent ${result.id}`);
    console.log(`   文本: "${result.text}"`);
    console.log(`   格式: ${result.format}`);
    console.log(`   位置: ${result.index}`);
    console.log('');
  });
}

console.log('✅' .repeat(30));
console.log('测试之前成功的指令:\n');

const successCommand = `### 二、正式指令下发
#### 执行主体为「insurance-c」
**职责标签**：运营类
**核心目标**：输出高参考性保险公众号标杆内容与可落地运营方案，支撑保险事业部获流提效

#### 执行主体为「agent B」
**职责标签**：技术类
**核心目标**：保障保险事业部运营/内容岗任务全流程顺畅推进，实现进度可视化监控

#### 执行主体为「insurance-d」
**职责标签**：内容类
**核心目标**：复刻高流量内容逻辑，产出符合保险赛道定位的原创科普内容`;

const successResults = detectExecutors(successCommand);

console.log(`📊 检测结果: ${successResults.length} 个执行主体\n`);

successResults.forEach((result, idx) => {
  console.log(`${idx + 1}. Agent ${result.id}`);
  console.log(`   文本: "${result.text}"`);
  console.log(`   格式: ${result.format}`);
  console.log(`   位置: ${result.index}`);
  console.log('');
});
