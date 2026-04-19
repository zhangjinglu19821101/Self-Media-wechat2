
import { db } from './src/lib/db';
import { agentSubTasks } from './src/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

console.log('🔍 调试 order_index=1 的任务执行结果问题');
console.log('='.repeat(80));

async function debugOrder1Tasks() {
  try {
    // 1. 查询最近的 order_index=1 的任务
    console.log('\n📊 步骤1: 查询最近的 order_index=1 的任务...');
    const order1Tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.orderIndex, 1))
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(10);
    
    console.log(`找到 ${order1Tasks.length} 个 order_index=1 的任务`);
    
    if (order1Tasks.length === 0) {
      console.log('❌ 没有找到 order_index=1 的任务');
      return;
    }
    
    // 2. 详细分析第一个任务
    const latestTask = order1Tasks[0];
    console.log('\n📋 步骤2: 分析最新的 order_index=1 任务:');
    console.log('  task_id:', latestTask.id);
    console.log('  order_index:', latestTask.orderIndex);
    console.log('  status:', latestTask.status);
    console.log('  executor:', latestTask.fromParentsExecutor);
    console.log('  created_at:', latestTask.createdAt?.toISOString());
    console.log('  started_at:', latestTask.startedAt?.toISOString());
    console.log('  updated_at:', latestTask.updatedAt?.toISOString());
    console.log('  is_dispatched:', latestTask.isDispatched);
    console.log('  dispatched_at:', latestTask.dispatchedAt?.toISOString());
    
    // 3. 检查 resultText
    console.log('\n💾 步骤3: 检查 resultText:');
    console.log('  resultText 存在:', !!latestTask.resultText);
    console.log('  resultText 长度:', latestTask.resultText?.length || 0);
    
    if (latestTask.resultText) {
      console.log('  resultText 预览:', latestTask.resultText.substring(0, 200));
      
      try {
        const parsed = JSON.parse(latestTask.resultText);
        console.log('  resultText 解析成功:', {
          isCompleted: parsed.isCompleted,
          hasResult: !!parsed.result,
          hasSuggestion: !!parsed.suggestion,
          resultType: typeof parsed.result,
          suggestionType: typeof parsed.suggestion
        });
      } catch (e) {
        console.log('  resultText 解析失败:', e);
      }
    } else {
      console.log('  ⚠️ resultText 为空！');
    }
    
    // 4. 检查同组其他任务
    console.log('\n👥 步骤4: 检查同组其他任务:');
    if (latestTask.commandResultId) {
      const groupTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, latestTask.commandResultId))
        .orderBy(agentSubTasks.orderIndex);
      
      console.log(`  同组共有 ${groupTasks.length} 个任务:`);
      groupTasks.forEach((t, i) => {
        console.log(`    ${i+1}. order_index=${t.orderIndex}, status=${t.status}, has_resultText=${!!t.resultText}`);
      });
    }
    
    // 5. 检查是否有状态异常
    console.log('\n⚠️ 步骤5: 检查异常状态:');
    if (latestTask.status === 'pre_need_support' && !latestTask.resultData) {
      console.log('  ❌ 发现问题: status=pre_need_support 但 resultData 为空');
      console.log('  这不符合预期！应该有执行结果说明为什么需要帮助');
    }
    
    if (latestTask.status === 'in_progress' && latestTask.startedAt) {
      const timeSinceStart = Date.now() - latestTask.startedAt.getTime();
      console.log(`  ⚠️ 任务卡在 in_progress 状态: ${Math.round(timeSinceStart/1000/60)} 分钟`);
    }
    
  } catch (error) {
    console.error('❌ 调试过程出错:', error);
  }
}

debugOrder1Tasks();
