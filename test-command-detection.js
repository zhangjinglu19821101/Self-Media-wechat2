// 测试指令检测器
import { detectCommand } from './src/lib/command-detector.ts';

const testCommands = `
#### 1. 【技术类】向架构师B（技术支撑）下达的执行指令
#### 2. 【AI业务类】向AI事业部Agent C（业务经理）下达的执行指令
#### 3. 【AI内容类】向AI事业部Agent D（内容生成）下达的执行指令
#### 4. 【保险运营类】向保险事业部Agent insurance-c（运营）下达的执行指令
#### 5. 【保险内容类】向保险事业部Agent insurance-d（内容）下达的执行指令
`;

console.log('测试指令检测功能...');
console.log('====================');

const result = detectCommand(testCommands, 'A');

console.log('检测结果:', JSON.stringify(result, null, 2));
console.log('检测到的指令数量:', result.detectedAgents.length);
console.log('检测到的 Agent ID:', result.detectedAgents.map(d => d.id));

if (result.detectedAgents.length > 0) {
  console.log('\n✅ 指令检测成功！');
  result.detectedAgents.forEach((detected, index) => {
    console.log(`\n指令 ${index + 1}:`);
    console.log(`  - Agent ID: ${detected.id}`);
    console.log(`  - Agent 名称: ${detected.name}`);
    console.log(`  - 提取的指令内容长度: ${detected.command.length}`);
    console.log(`  - 提取的指令内容预览: ${detected.command.substring(0, 50)}...`);
  });
} else {
  console.log('\n❌ 指令检测失败！未检测到任何 Agent 指令。');
}
