/**
 * 测试 JSON 解析增强功能
 * 测试各种格式的 JSON 是否能正确解析
 */

import { JsonParserEnhancer } from '/workspace/projects/src/lib/utils/json-parser-enhancer';

function testCase(name: string, input: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试用例: ${name}`);
  console.log(`${'='.repeat(60)}`);
  console.log('输入（前300字符）:', input.substring(0, 300));
  console.log('...');
  
  const result = JsonParserEnhancer.parseSplitResult(input);
  
  if (result.success) {
    console.log(`✅ 解析成功`);
    console.log(`📋 subTasks 数量:`, result.data.subTasks.length);
    if (result.data.subTasks.length > 0) {
      console.log(`📝 第一个子任务:`, JSON.stringify(result.data.subTasks[0], null, 2));
    }
    if (result.warnings && result.warnings.length > 0) {
      console.log(`⚠️ 警告:`, result.warnings);
    }
  } else {
    console.log(`❌ 解析失败:`, result.error);
    if (result.warnings && result.warnings.length > 0) {
      console.log(`⚠️ 警告:`, result.warnings);
    }
  }
}

// 测试用例 1: 标准格式（带 json 代码块）
testCase(
  '标准格式（带 json 代码块）',
  ```json
{
  "totalDeliverables": "3",
  "timeFrame": "3天",
  "summary": "将任务拆解为3个子任务",
  "subTasks": [
    {
      "taskTitle": "第1天：筛选爆文",
      "commandContent": "筛选2篇爆文",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高",
      "deadline": "2026-06-26",
      "estimatedHours": 4,
      "acceptanceCriteria": "爆文清单"
    }
  ]
}
```
);

// 测试用例 2: 简单代码块格式
testCase(
  '简单代码块格式',
  \`\`\`
{
  "subTasks": [
    {
      "taskTitle": "第1天任务",
      "commandContent": "任务描述",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高"
    }
  ]
}
\`\`\`
);

// 测试用例 3: 直接 JSON 对象
testCase(
  '直接 JSON 对象',
  `{ "subTasks": [ { "taskTitle": "任务1", "commandContent": "描述", "executor": "insurance-c", "taskType": "内容生产", "priority": "高" } ] }`
);

// 测试用例 4: 直接 JSON 数组
testCase(
  '直接 JSON 数组',
  `[ { "taskTitle": "任务1", "commandContent": "描述", "executor": "insurance-c", "taskType": "内容生产", "priority": "高" } ]`
);

// 测试用例 5: 单引号格式（需要转换）
testCase(
  '单引号格式（需要转换）',
  `{
  'subTasks': [
    {
      'taskTitle': '第1天任务',
      'commandContent': '任务描述',
      'executor': 'insurance-c',
      'taskType': '内容生产',
      'priority': '高'
    }
  ]
}`
);

// 测试用例 6: 带注释的 JSON
testCase(
  '带注释的 JSON',
  \`\`\`json
{
  // 总交付物数量
  "totalDeliverables": "3",
  "subTasks": [
    {
      "taskTitle": "第1天任务",  // 任务标题
      "commandContent": "任务描述",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高"
    }
  ]
}
\`\`\`
);

// 测试用例 7: 带尾随逗号的 JSON
testCase(
  '带尾随逗号的 JSON',
  `{
  "subTasks": [
    {
      "taskTitle": "任务1",
      "commandContent": "描述",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高",
    },
  ]
}`
);

// 测试用例 8: 包含多余文字说明
testCase(
  '包含多余文字说明',
  `好的，我已经完成了任务拆解，结果如下：

\`\`\`json
{
  "subTasks": [
    {
      "taskTitle": "第1天任务",
      "commandContent": "任务描述",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高"
    }
  ]
}
\`\`\`

希望这个拆解方案能满足你的要求。`
);

// 测试用例 9: 字段名不使用引号（需要标准化）
testCase(
  '字段名不使用引号（需要标准化）',
  `{
  subTasks: [
    {
      taskTitle: "第1天任务",
      commandContent: "任务描述",
      executor: "insurance-c",
      taskType: "内容生产",
      priority: "高"
    }
  ]
}`
);

// 测试用例 10: 无效格式
testCase(
  '无效格式（无法解析）',
  `这是一段普通的文本，不包含任何 JSON 数据。`
);

console.log('\n' + '='.repeat(60));
console.log('所有测试用例执行完成');
console.log('='.repeat(60));
