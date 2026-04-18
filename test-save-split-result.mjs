import { saveSplitResultToDailyTasks } from './src/lib/services/save-split-result-v2';

async function testSaveSplitResult() {
  try {
    console.log('🧪 开始测试 saveSplitResultToDailyTasks 函数...');

    // 使用数据库中存在的任务ID
    const taskId = 'task-A-to-B-1771267583847-xuc';

    console.log(`📝 调用 saveSplitResultToDailyTasks(${taskId})...`);

    const result = await saveSplitResultToDailyTasks(taskId);

    console.log('✅ 测试成功！');
    console.log('📊 插入记录数:', result.insertedTasks.length);
    console.log('📊 跳过记录数:', result.skippedTasks.length);
    console.log('📊 插入的第一个子任务ID:', result.insertedTasks[0]?.id);
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testSaveSplitResult();
