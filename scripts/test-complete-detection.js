// 完整模拟检测流程

const EXECUTOR_MAP = {
  'insurance-d': 'insurance-d',
  'insuranced': 'insurance-d',
};

function parseExecutorId(executorText) {
  if (!executorText) return null;
  const normalized = executorText.trim().toLowerCase();
  return EXECUTOR_MAP[normalized] || null;
}

const COMMAND_FORMATS = [
  {
    name: '标准格式',
    executorRegex: /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))(?:\s*[\n$,.;:：]*)?/gi,
  },
  {
    name: '连续格式',
    executorRegex: /####\s*执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*\n/gi,
  },
];

function detectExecutors(text) {
  const results = [];
  const seenPositions = new Set();
  
  console.log('🔍 开始检测执行主体...\n');
  
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
        
        console.log(`检测到执行主体:`);
        console.log(`  格式: ${format.name}`);
        console.log(`  位置: ${position}`);
        console.log(`  文本: "${cleanedText}"`);
        console.log(`  解析ID: ${executorId}`);
        console.log(`  是否重复: ${isDuplicate} (seen: ${Array.from(seenPositions)})`);
        
        if (!isDuplicate) {
          seenPositions.add(position);
          results.push({
            id: executorId,
            text: cleanedText,
            index: position,
          });
          console.log(`  ✅ 保留`);
        } else {
          console.log(`  ❌ 跳过（重复）`);
        }
        console.log('');
      }
    }
  }
  
  return results.sort((a, b) => a.index - b.index);
}

// 测试用户的指令
const userCommand = `#### 执行主体 insurance-d
**职责标签**：内容类
**核心目标**：复刻高流量内容逻辑`;

console.log('📝 用户指令:');
console.log(userCommand);
console.log('\n' + '='.repeat(60) + '\n');

const executors = detectExecutors(userCommand);

console.log('=' .repeat(60));
console.log('📊 最终检测结果:');
console.log(`  - 检测到 ${executors.length} 个执行主体`);
executors.forEach((executor, idx) => {
  console.log(`  ${idx + 1}. Agent ${executor.id} ("${executor.text}") @ 位置 ${executor.index}`);
});

// 模拟前端的过滤逻辑
const SPLIT_KEYWORDS = ['B', 'insurance-c', 'insurance-d', 'C', 'D'];

console.log('\n' + '='.repeat(60));
console.log('🔍 前端过滤逻辑 (SPLIT_KEYWORDS =', SPLIT_KEYWORDS, '):\n');

const filteredCommands = executors
  .map(e => ({
    targetAgentId: e.id,
    targetAgentName: `Agent ${e.id}`,
    needsSplit: SPLIT_KEYWORDS.includes(e.id),
  }))
  .filter(cmd => cmd.needsSplit);

console.log(`  - 需要拆解的 Agent: ${filteredCommands.length} 个`);
filteredCommands.forEach((cmd, idx) => {
  console.log(`  ${idx + 1}. ${cmd.targetAgentName} (${cmd.targetAgentId})`);
});

console.log('\n' + '='.repeat(60));
console.log('📝 结论:');
if (filteredCommands.length > 0) {
  console.log('  ✅ 应该显示拆解对话框');
} else {
  console.log('  ❌ 不会显示拆解对话框（因为不需要拆解）');
}
