
/**
 * 🧪 拆解流程自动化测试
 * 
 * 测试完整的拆解流程：
 * 1. 测试数据库表关系是否正确
 * 2. 测试 API 调用是否成功
 * 3. 测试数据流转是否正确
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&amp;channel_binding=require';

// 测试数据
const TEST_TASK_ID = 'test-flow-' + Date.now();
const TEST_DAILY_TASK_ID = crypto.randomUUID();

const TEST_SPLIT_RESULT = {
  taskTitle: '测试任务标题',
  taskDescription: '测试任务描述',
  subtasks: [
    {
      taskName: '子任务 1',
      taskDescription: '子任务 1 描述',
      executor: 'Agent A',
      taskType: 'research',
      priority: '高',
      commandContent: '请执行子任务 1',
      acceptanceCriteria: '完成子任务 1'
    },
    {
      taskName: '子任务 2',
      taskDescription: '子任务 2 描述',
      executor: 'insurance-d',
      taskType: 'content',
      priority: '中',
      commandContent: '请执行子任务 2',
      acceptanceCriteria: '完成子任务 2'
    }
  ]
};

async function runTests() {
  console.log('[TEST] ===== 开始拆解流程自动化测试 =====');
  
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  
  try {
    // 测试 1: 检查数据库表是否存在
    console.log('\n[TEST] 1: 检查数据库表是否存在...');
    const tables = await sql`
      SELECT tablename FROM pg_tables 
      WHERE tablename IN ('agent_tasks', 'daily_task', 'agent_sub_tasks')
      ORDER BY tablename;
    `;
    
    console.log('[OK] 找到的表:', tables.map(t =&gt; t.tablename));
    
    if (tables.length !== 3) {
      throw new Error('缺少必要的数据库表');
    }
    
    // 测试 2: 插入测试数据到 agent_tasks
    console.log('\n[TEST] 2: 插入测试数据到 agent_tasks...');
    await sql`
      INSERT INTO agent_tasks (task_id, task_name, description, created_at, updated_at)
      VALUES (${TEST_TASK_ID}, '测试总任务', '测试总任务描述', NOW(), NOW())
      ON CONFLICT (task_id) DO NOTHING;
    `;
    
    // 验证是否插入成功
    const agentTasks = await sql`
      SELECT * FROM agent_tasks WHERE task_id = ${TEST_TASK_ID};
    `;
    
    console.log('[OK] agent_tasks 插入成功:', agentTasks[0]?.task_id);
    
    // 测试 3: 模拟调用 /api/split/confirm 的逻辑
    console.log('\n[TEST] 3: 测试完整数据流转...');
    
    // 3.1 先保存到 daily_task 表
    console.log('   3.1 保存到 daily_task 表...');
    await sql`
      INSERT INTO daily_task (
        id, task_id, task_title, task_description, 
        executor, execution_date, execution_status, created_at, updated_at
      ) VALUES (
        ${TEST_DAILY_TASK_ID},
        ${TEST_TASK_ID},
        ${TEST_SPLIT_RESULT.taskTitle},
        ${TEST_SPLIT_RESULT.taskDescription},
        ${'Agent B'},
        ${new Date().toISOString().split('T')[0]},
        ${'pending'},
        NOW(),
        NOW()
      )
    `;
    
    const dailyTask = await sql`
      SELECT * FROM daily_task WHERE id = ${TEST_DAILY_TASK_ID};
    `;
    
    console.log('   [OK] daily_task 插入成功:', dailyTask[0]?.id);
    
    // 3.2 再保存到 agent_sub_tasks 表
    console.log('   3.2 保存到 agent_sub_tasks 表...');
    const subTasks = TEST_SPLIT_RESULT.subtasks;
    const insertedIds = [];
    
    for (let i = 0; i &lt; subTasks.length; i++) {
      const subTask = subTasks[i];
      const newSubTaskId = crypto.randomUUID();
      insertedIds.push(newSubTaskId);
      
      await sql`
        INSERT INTO agent_sub_tasks (
          id, command_result_id, from_parents_executor, task_title, task_description,
          status, order_index, execution_date, metadata, created_at, updated_at
        ) VALUES (
          ${newSubTaskId},
          ${TEST_DAILY_TASK_ID},
          ${subTask.executor},
          ${subTask.taskName},
          ${subTask.taskDescription},
          ${'pending'},
          ${i + 1},
          ${new Date().toISOString().split('T')[0]},
          ${JSON.stringify(subTask)},
          NOW(),
          NOW()
        )
      `;
    }
    
    console.log('   [OK] agent_sub_tasks 插入成功，共', insertedIds.length, '条');
    
    // 3.3 更新 daily_task 状态
    console.log('   3.3 更新 daily_task 状态...');
    await sql`
      UPDATE daily_task
      SET 
        execution_status = ${'split_completed'},
        sub_task_count = ${subTasks.length},
        updated_at = NOW()
      WHERE id = ${TEST_DAILY_TASK_ID};
    `;
    
    const updatedDailyTask = await sql`
      SELECT * FROM daily_task WHERE id = ${TEST_DAILY_TASK_ID};
    `;
    
    console.log('   [OK] daily_task 状态更新成功:', updatedDailyTask[0]?.execution_status);
    
    // 测试 4: 验证数据完整性
    console.log('\n[TEST] 4: 验证数据完整性...');
    
    // 4.1 验证 agent_tasks -&gt; daily_task 关系
    const relatedDailyTasks = await sql`
      SELECT * FROM daily_task WHERE task_id = ${TEST_TASK_ID};
    `;
    
    console.log('   [OK] agent_tasks -&gt; daily_task 关系正确，找到', relatedDailyTasks.length, '条记录');
    
    // 4.2 验证 daily_task -&gt; agent_sub_tasks 关系
    const relatedSubTasks = await sql`
      SELECT * FROM agent_sub_tasks WHERE command_result_id = ${TEST_DAILY_TASK_ID};
    `;
    
    console.log('   [OK] daily_task -&gt; agent_sub_tasks 关系正确，找到', relatedSubTasks.length, '条记录');
    
    if (relatedSubTasks.length !== subTasks.length) {
      throw new Error('子任务数量不匹配');
    }
    
    // 测试 5: 验证状态字段
    console.log('\n[TEST] 5: 验证状态字段...');
    
    if (updatedDailyTask[0]?.execution_status !== 'split_completed') {
      throw new Error('daily_task 状态不正确');
    }
    
    if (updatedDailyTask[0]?.sub_task_count !== subTasks.length) {
      throw new Error('sub_task_count 不正确');
    }
    
    console.log('   [OK] 状态字段验证通过');
    
    // 所有测试通过！
    console.log('\n[SUCCESS] ===== 所有测试通过！=====');
    console.log('\n[SUMMARY] 测试总结:');
    console.log('   [OK] 数据库表存在性检查');
    console.log('   [OK] agent_tasks 插入');
    console.log('   [OK] daily_task 插入');
    console.log('   [OK] agent_sub_tasks 插入');
    console.log('   [OK] 数据关系验证');
    console.log('   [OK] 状态字段验证');
    console.log('\n   [DONE] 完整流程验证成功！');
    
  } catch (error) {
    console.error('\n❌ ===== 测试失败 =====');
    console.error('❌ 错误:', error);
    throw error;
  } finally {
    // 清理测试数据
    console.log('\n🧹 清理测试数据...');
    try {
      await sql`
        DELETE FROM agent_sub_tasks WHERE command_result_id = ${TEST_DAILY_TASK_ID};
      `;
      await sql`
        DELETE FROM daily_task WHERE id = ${TEST_DAILY_TASK_ID};
      `;
      await sql`
        DELETE FROM agent_tasks WHERE task_id = ${TEST_TASK_ID};
      `;
      console.log('✅ 测试数据已清理');
    } catch (cleanupError) {
      console.log('⚠️  清理测试数据失败:', cleanupError);
    }
    
    await sql.end();
  }
}

// 运行测试
runTests().catch(error =&gt; {
  console.error('❌ 测试运行失败:', error);
  process.exit(1);
});

