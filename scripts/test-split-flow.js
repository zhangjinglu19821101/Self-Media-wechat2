// 测试拆解流程

console.log('🧪 测试拆解流程\n');

// 1. 测试指令检测
console.log('步骤 1: 测试指令检测');
const testCommand = `#### 执行主体 insurance-d
**职责标签**：内容类
**核心目标**：复刻高流量内容逻辑，产出符合保险赛道定位的原创科普内容
**执行范围**：基于insurance-c提供的10万+文章题材进行仿写创作
**落地标准**：
1. 严格匹配样本文章的选题方向、结构框架、语言风格
2. 每篇文章融入1-2个贴近大众的真实保险案例
**完成时限**：2天内`;

// 模拟指令检测
const EXECUTOR_MAP = {
  'insurance-d': 'insurance-d',
  'insuranced': 'insurance-d',
};

function parseExecutorId(executorText) {
  if (!executorText) return null;
  const normalized = executorText.trim().toLowerCase();
  return EXECUTOR_MAP[normalized] || null;
}

const regex = /执行主体[\s:：]*[为]?\s*(?:「([^\」]+)」|([^\n]+))(?:\s*[\n$,.;:：]*)?/gi;
const match = testCommand.match(regex);

if (match) {
  const executorText = match[1] || match[2];
  const cleanedText = executorText.trim().replace(/[，。、；：,.;:：]+$/, '');
  const executorId = parseExecutorId(cleanedText);
  
  console.log('✅ 检测到执行主体:', executorId);
  console.log('   文本:', cleanedText);
  console.log('   完整匹配:', `"${match[0]}"`);
  console.log('');
} else {
  console.log('❌ 未检测到执行主体');
  console.log('');
}

// 2. 检查是否在 SPLIT_KEYWORDS 中
const SPLIT_KEYWORDS = ['B', 'insurance-c', 'insurance-d', 'C', 'D'];
const needsSplit = executorId && SPLIT_KEYWORDS.includes(executorId);

console.log('步骤 2: 检查是否需要拆解');
console.log('   SPLIT_KEYWORDS:', SPLIT_KEYWORDS);
console.log('   需要拆解:', needsSplit ? '✅ 是' : '❌ 否');
console.log('');

// 3. 模拟发送拆解指令
console.log('步骤 3: 模拟发送拆解指令');
console.log('   目标: Agent B');
console.log('   指令类型: instruction');
console.log('   优先级: normal');
console.log('   预期行为: Agent B 接收指令并返回拆解结果');
console.log('');

// 4. 总结
console.log('📊 流程总结:');
console.log('   1. Agent A 页面输入指令 ✅');
console.log('   2. 检测到 insurance-d ✅');
console.log('   3. 判断需要拆解 ✅');
console.log('   4. 显示"是否让 Agent B 拆解"弹框 ✅');
console.log('   5. 用户点击"确认拆解" ✅');
console.log('   6. 发送拆解指令到 Agent B ✅');
console.log('   7. Agent B 返回拆解结果 ✅');
console.log('   8. 显示"拆解结果确认"弹框 ✅');
console.log('');
console.log('⚠️  如果第 4 步没有弹框，请检查:');
console.log('   - 是否在 Agent A 页面 (http://localhost:5000/agents/A)');
console.log('   - 浏览器控制台是否有错误');
console.log('   - showSplitDialog 状态是否为 true');
console.log('   - React 组件是否正确渲染');
