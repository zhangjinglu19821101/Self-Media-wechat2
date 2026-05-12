// 测试 insurance-d 指令检测

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

// 测试文本
const testText = `#### 执行主体 insurance-d
**职责标签**：内容类
**核心目标**：复刻高流量内容逻辑`;

console.log('🔍 测试: "#### 执行主体 insurance-d"\n');

// 使用当前的正则表达式
const regex = /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))(?:\s*[\n$,.;:：]*)?/gi;
const matches = testText.matchAll(regex);

console.log('正则表达式:', regex.source);
console.log('');

let found = false;
for (const match of matches) {
  const executorText = match[1] || match[2];
  const cleanedText = executorText ? executorText.trim().replace(/[，。、；：,.;:：]+$/, '') : null;
  const executorId = parseExecutorId(cleanedText);
  
  console.log('匹配详情:');
  console.log('  完整匹配:', `"${match[0]}"`);
  console.log('  捕获组1（引号）:', match[1]);
  console.log('  捕获组2（无引号）:', match[2]);
  console.log('  清理后:', `"${cleanedText}"`);
  console.log('  解析ID:', executorId);
  console.log('  位置:', match.index);
  
  if (executorId) {
    console.log('  ✅ 成功识别为 Agent', executorId);
    found = true;
  } else {
    console.log('  ❌ 无法识别该执行主体');
  }
  console.log('');
}

if (!found) {
  console.log('❌ 未检测到任何匹配！');
  console.log('');
  console.log('可能的原因:');
  console.log('1. 正则表达式不匹配');
  console.log('2. 映射表缺少 insurance-d');
  console.log('3. 清理逻辑问题');
}
