// 测试执行主体检测逻辑

// 模拟 command-formats.ts 中的逻辑
const EXECUTOR_MAP = {
  'agent b': 'B',
  'agent-b': 'B',
  'agentb': 'B',
  'b': 'B',
  'agent c': 'C',
  'agent-c': 'C',
  'agentc': 'C',
  'c': 'C',
  'agent d': 'D',
  'agent-d': 'D',
  'agentd': 'D',
  'd': 'D',
  'insurance-c': 'insurance-c',
  'insurance-c ': 'insurance-c',
  ' insurance-c': 'insurance-c',
  'insurancec': 'insurance-c',
  'insurance-d': 'insurance-d',
  'insurance-d ': 'insurance-d',
  ' insurance-d': 'insurance-d',
  'insuranced': 'insurance-d',
};

function parseExecutorId(executorText) {
  const normalized = executorText.trim().toLowerCase();
  if (EXECUTOR_MAP[normalized]) {
    return EXECUTOR_MAP[normalized];
  }
  const noSpace = normalized.replace(/[\s-]/g, '');
  if (EXECUTOR_MAP[noSpace]) {
    return EXECUTOR_MAP[noSpace];
  }
  for (const [key, value] of Object.entries(EXECUTOR_MAP)) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }
  return null;
}

// 模拟检测执行主体
const executorRegex = /####\s*执行主体[\s:：]*[为]?[\s]*[「\["]*([^\]\"\)」]+)[\"\]」]*/gi;

const userCommand = `### 二、正式指令下发
#### 执行主体为「insurance-c」
**职责标签**：运营类
**核心目标**：输出高参考性保险公众号标杆内容与可落地运营方案，支撑保险事业部获流提效

#### 执行主体为「agent B」
**职责标签**：技术类
**核心目标**：保障保险事业部运营/内容岗任务全流程顺畅推进，实现进度可视化监控

#### 执行主体为「insurance-d」
**职责标签**：内容类
**核心目标**：复刻高流量内容逻辑，产出符合保险赛道定位的原创科普内容
`;

console.log('🔍 开始测试执行主体检测...\n');

const matches = userCommand.matchAll(executorRegex);
const results = [];

for (const match of matches) {
  const executorText = match[1];
  const executorId = parseExecutorId(executorText);
  
  console.log(`🔍 检测到执行主体标记:`);
  console.log(`   原始文本: "${executorText}"`);
  console.log(`   小写转换: "${executorText.trim().toLowerCase()}"`);
  console.log(`   解析结果: ${executorId || 'null'}`);
  
  if (executorId) {
    results.push({
      id: executorId,
      text: executorText,
      index: match.index,
    });
    console.log(`   ✅ 成功识别为 Agent ${executorId}\n`);
  } else {
    console.log(`   ❌ 无法识别该执行主体\n`);
  }
}

console.log(`\n✅ 检测结果：`);
console.log(`   - 总共检测到 ${results.length} 个执行主体`);
if (results.length > 0) {
  results.forEach((r, idx) => {
    console.log(`   ${idx + 1}. Agent ${r.id} ("${r.text}")`);
  });
}
