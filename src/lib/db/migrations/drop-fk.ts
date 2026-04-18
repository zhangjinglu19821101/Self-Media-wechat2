import { db } from '@/lib/db';

async function dropForeignKeys() {
  console.log('Dropping foreign key constraints...\n');

  try {
    // 查询 agent_sub_tasks 的外键约束
    const subTaskFKs = await db.execute(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints AS tc
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'agent_sub_tasks'
    `);
    
    console.log('Found FKs in agent_sub_tasks:', subTaskFKs);

    // 删除 agent_sub_tasks 的外键
    for (const row of subTaskFKs as any[]) {
      const fkName = row.constraint_name;
      console.log(`Dropping FK: ${fkName}`);
      await db.execute(`ALTER TABLE agent_sub_tasks DROP CONSTRAINT IF EXISTS "${fkName}"`);
    }

    // 查询 agent_sub_tasks_step_history 的外键约束
    const historyFKs = await db.execute(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints AS tc
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'agent_sub_tasks_step_history'
    `);
    
    console.log('\nFound FKs in agent_sub_tasks_step_history:', historyFKs);

    // 删除 agent_sub_tasks_step_history 的外键
    for (const row of historyFKs as any[]) {
      const fkName = row.constraint_name;
      console.log(`Dropping FK: ${fkName}`);
      await db.execute(`ALTER TABLE agent_sub_tasks_step_history DROP CONSTRAINT IF EXISTS "${fkName}"`);
    }

    // 创建索引
    console.log('\nCreating indexes...');
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_command_result_id ON agent_sub_tasks(command_result_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_executor_date ON agent_sub_tasks(from_parents_executor, execution_date)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_status ON agent_sub_tasks(status)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_step_history_command_result_id ON agent_sub_tasks_step_history(command_result_id)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_step_history_interact_time ON agent_sub_tasks_step_history(interact_time)`);

    console.log('\n✓ Foreign keys dropped and indexes created successfully!');

    // 验证
    const remainingFKs = await db.execute(`
      SELECT tc.table_name, tc.constraint_name
      FROM information_schema.table_constraints AS tc
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name IN ('agent_sub_tasks', 'agent_sub_tasks_step_history')
    `);
    
    console.log('\nRemaining FKs:', remainingFKs);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

dropForeignKeys()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
