// 测试 insurance-d 指令是否被检测

const EXECUTOR_MAP = {
  'insurance-d': 'insurance-d',
  'insuranced': 'insurance-d',
  'insurance-d ': 'insurance-d',
  ' insurance-d': 'insurance-d',
};

function parseExecutorId(executorText) {
  if (!executorText) return null;
  const normalized = executorText.trim().toLowerCase();
  return EXECUTOR_MAP[normalized] || null;
}

const COMMAND_FORMATS = [
  {
    name: '标准格式：执行主体为「xxx」',
    executorRegex: /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))(?:\s*[\n$,.;:：]*)?/gi,
  },
  {
    name: '连续格式：####执行主体',
    executorRegex: /####\s*执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*\n/gi,
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

// 测试用户的指令
const userCommand = `#### 执行主体 insurance-d
**职责标签**：内容类
**核心目标**：复刻高流量内容逻辑，产出符合保险赛道定位的原创科普内容`;

console.log('🔍 测试: "#### 执行主体 insurance-d"\n');

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

// 模拟前端过滤逻辑（检查是否在 SPLIT_KEYWORDS 中）
const SPLIT_KEYWORDS = ['B', 'insurance-c', 'insurance-d', 'C', 'D'];

console.log('🔍 模拟前端过滤逻辑:\n');
results.forEach((result, idx) => {
  const needsSplit = SPLIT_KEYWORDS.includes(result.id);
  console.log(`${idx + 1}. Agent ${result.id}: ${needsSplit ? '✅ 需要拆解（会显示）' : '❌ 不需要拆解（不会显示）'}`);
});
