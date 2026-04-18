// 诊断脚本：检查拆解流程

console.log('🔍 诊断拆解流程\n');
console.log('='.repeat(60));

// 1. 检查 WebSocket 连接
console.log('\n1️⃣ 检查 WebSocket 连接');
console.log('请访问: http://localhost:5000/agents/A');
console.log('在浏览器控制台执行以下代码:');
console.log('''
// 检查 WebSocket 连接
console.log('WebSocket 状态:', window.wsClient?.readyState);
console.log('当前 Agent ID:', window.currentAgentId);
''');

// 2. 检查 Agent B 是否在线
console.log('\n2️⃣ 检查 Agent B 是否在线');
console.log('请访问: http://localhost:5000/agents/B');
console.log('如果页面正常加载，说明 Agent B 在线');

// 3. 测试指令检测
console.log('\n3️⃣ 测试指令检测');
console.log('在 Agent A 页面的浏览器控制台执行:');
console.log('''
// 模拟指令检测
const { detectCommands } = await import('/src/lib/command-detector.ts');
const result = detectCommands('#### 执行主体 insurance-d\n**核心目标**：复刻高流量内容逻辑');
console.log('检测结果:', result);
''');

// 4. 测试指令发送
console.log('\n4️⃣ 测试指令发送');
console.log('在 Agent A 页面的浏览器控制台执行:');
console.log('''
// 测试发送指令到 Agent B
const response = await fetch('/api/agents/send-command', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fromAgentId: 'A',
    toAgentId: 'B',
    command: '测试任务拆解',
    commandType: 'instruction',
    priority: 'normal'
  })
});
console.log('发送结果:', await response.json());
''');

// 5. 检查弹框状态
console.log('\n5️⃣ 检查弹框状态');
console.log('在 Agent A 页面的浏览器控制台执行:');
console.log('''
// 检查弹框状态（需要在 React DevTools 中查看）
// 或者直接检查 DOM 元素
const splitDialog = document.querySelector('[role="dialog"]');
console.log('弹框元素:', splitDialog);
console.log('弹框显示状态:', splitDialog?.style.display !== 'none');
''');

console.log('\n' + '='.repeat(60));
console.log('📋 诊断清单\n');
console.log('✅ WebSocket 连接正常');
console.log('✅ Agent B 页面可以访问');
console.log('✅ 指令检测函数正常');
console.log('✅ 指令发送 API 正常');
console.log('\n如果以上都正常，请检查:');
console.log('1. 是否在 Agent A 页面 (http://localhost:5000/agents/A)');
console.log('2. 是否输入了完整的指令（包含 "#### 执行主体 xxx"）');
console.log('3. 是否点击了"发送"按钮');
console.log('4. 浏览器控制台是否有错误信息');
