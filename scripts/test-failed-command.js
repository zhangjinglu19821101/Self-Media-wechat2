// 测试失败的指令

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

// 当前正则表达式
const currentRegex = /执行主体[\s:：]*[为]?[\s]*[「\["]*([^\]\"\)」]+)[\"\]」]*/gi;

console.log('🔍 测试当前正则表达式:');
console.log('   正则:', currentRegex.source);
console.log('   文本:', failedCommand);
console.log('');

const matches = failedCommand.matchAll(currentRegex);
const results = Array.from(matches);

console.log(`📊 匹配结果: ${results.length} 个\n`);

if (results.length === 0) {
  console.log('❌ 未匹配到任何执行主体！');
  console.log('');
  console.log('🔍 原因分析:');
  console.log('   当前正则要求: "执行主体" + [可选冒号/为] + 引号/括号');
  console.log('   例如: "执行主体为「Agent B」" 或 "执行主体：Agent B"');
  console.log('');
  console.log('   用户格式: "#### 执行主体 Agent B"');
  console.log('   问题: 缺少冒号和引号！');
  console.log('');
  console.log('✅ 解决方案: 修改正则表达式，支持无引号格式');
} else {
  results.forEach((match, idx) => {
    console.log(`${idx + 1}. 匹配到: "${match[1]}"`);
  });
}
