#!/usr/bin/env node

/**
 * 测试解析通知的 result 字段
 */

// 模拟从数据库中获取的 content 字段
const dbContent = {
  "fromAgentId": "B",
  "toAgentId": "A",
  "result": "{\"totalDeliverables\":\"10\",\"timeFrame\":\"5天\",\"summary\":\"根据新增要求，将保险事业部公众号5篇内容发布任务重新拆解为每日内容生产+运营配合的子任务，明确insurance-d和insurance-c的分工，新增单篇文章字数不超过1200字的要求\",\"subTasks\":[{\"taskTitle\":\"第1天：完成《三口之家保险配置逻辑》生产与发布\",\"commandContent\":\"insurance-d完成文章创作，嵌入1-2个三口之家投保真实案例，语言通俗，单篇文章字数不超过1200字；insurance-c完成内容合规校验、公众号排版配置，当日完成发布\",\"executor\":\"insurance-d,insurance-c\",\"taskType\":\"内容生产,运营支持\",\"priority\":\"高\",\"deadline\":\"2026-02-13\",\"estimatedHours\":8,\"acceptanceCriteria\":\"文章符合公众号发布规范，嵌入真实生活化案例，语言通俗易读，单篇字数≤1200字；完成公众号发布，可查看发布链接\"}]}",
  "status": "completed",
  "data": {
    "splitResult": "...",
    "subTasksCount": 10
  }
};

console.log('1️⃣  数据库中的 content 字段：');
console.log(JSON.stringify(dbContent, null, 2));
console.log();

// API 返回的数据格式
const apiResponse = {
  type: 'task_result',
  fromAgentId: dbContent.fromAgentId,
  toAgentId: dbContent.toAgentId,
  taskId: null,
  result: dbContent.result,  // 🔥 直接返回 result 字段，没有解析
  status: dbContent.status,
  timestamp: new Date().toISOString(),
  notificationId: 'notif-A-B-split-1770963707620',
  isRead: false
};

console.log('2️⃣  API 返回的数据：');
console.log(JSON.stringify(apiResponse, null, 2));
console.log();

// 前端解析逻辑
const notification = apiResponse;
console.log('3️⃣  前端解析逻辑：');
console.log('   notification.result 的类型:', typeof notification.result);
console.log('   notification.result 的值（前200字符）:', notification.result.substring(0, 200));
console.log();

// 尝试解析
let jsonData = null;

if (typeof notification.result === 'object') {
  console.log('   ✅ result 已经是 JSON 对象');
  jsonData = notification.result;
} else if (typeof notification.result === 'string') {
  console.log('   🔍 result 是字符串，尝试解析...');

  // 尝试方法 1: 从 Markdown 代码块中提取 JSON
  const jsonMatch = notification.result.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    console.log('   ✅ 通过 Markdown 代码块解析成功');
    jsonData = JSON.parse(jsonMatch[1].trim());
  } else {
    console.log('   ⚠️  未找到 Markdown 代码块');

    // 尝试方法 2: 直接解析
    try {
      jsonData = JSON.parse(notification.result.trim());
      console.log('   ✅ 直接解析成功');
      console.log('   解析后的 jsonData:', JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log('   ❌ 直接解析失败:', e.message);
    }
  }
}

console.log();
console.log('4️⃣  检查 subTasks：');
console.log('   jsonData 是否存在:', !!jsonData);
console.log('   jsonData.subTasks 是否存在:', !!jsonData?.subTasks);
console.log('   jsonData.subTasks 是否为数组:', Array.isArray(jsonData?.subTasks));
console.log('   jsonData.subTasks 的长度:', jsonData?.subTasks?.length);

console.log();
if (jsonData && jsonData.subTasks && Array.isArray(jsonData.subTasks) && jsonData.subTasks.length > 0) {
  console.log('🎉 成功识别拆解结果，应该显示弹框！');
} else {
  console.log('❌ 未能识别拆解结果，不会显示弹框');
}
