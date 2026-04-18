// 测试正则表达式匹配顺序

const text = `#### 执行主体 insurance-d
**职责标签**：内容类`;

const regex1 = /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))(?:\s*[\n$,.;:：]*)?/gi;
const regex2 = /####\s*执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))\s*\n/gi;

console.log('🔍 测试正则表达式匹配顺序\n');
console.log('原始文本:', JSON.stringify(text));
console.log('');

// 测试第一个正则
console.log('测试 regex1 (标准格式):');
const matches1 = text.matchAll(regex1);
for (const match of matches1) {
  console.log('  完整匹配:', `"${match[0]}"`);
  console.log('  捕获组1:', match[1]);
  console.log('  捕获组2:', match[2]);
  console.log('  提取:', `"${match[1] || match[2]}"`);
  console.log('  位置:', match.index);
}
console.log('');

// 测试第二个正则
console.log('测试 regex2 (连续格式):');
const matches2 = text.matchAll(regex2);
for (const match of matches2) {
  console.log('  完整匹配:', `"${match[0]}"`);
  console.log('  捕获组1:', match[1]);
  console.log('  捕获组2:', match[2]);
  console.log('  提取:', `"${match[1] || match[2]}"`);
  console.log('  位置:', match.index);
}
console.log('');

// 同时匹配两个正则（模拟实际代码）
console.log('模拟实际代码（遍历所有格式）:\n');
const COMMAND_FORMATS = [
  {
    name: '标准格式',
    executorRegex: regex1,
  },
  {
    name: '连续格式',
    executorRegex: regex2,
  },
];

const results = [];
for (const format of COMMAND_FORMATS) {
  const matches = text.matchAll(format.executorRegex);
  for (const match of matches) {
    const executorText = match[1] || match[2];
    if (executorText) {
      results.push({
        format: format.name,
        text: executorText.trim().replace(/[，。、；：,.;:：]+$/, ''),
        index: match.index,
      });
    }
  }
}

results.sort((a, b) => a.index - b.index);

console.log('检测结果（去重后）:');
results.forEach((r, idx) => {
  console.log(`${idx + 1}. 格式: ${r.format}, Agent: "${r.text}", 位置: ${r.index}`);
});
