import { db } from '@/lib/db';

async function checkForeignKeys() {
  console.log('Checking foreign key constraints...\n');

  // Check agent_sub_tasks FKs
  const subTaskFKs = await db.execute(`
    SELECT 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'agent_sub_tasks'
  `);
  
  console.log('agent_sub_tasks foreign keys:');
  console.log(subTaskFKs);

  // Check agent_sub_tasks_step_history FKs
  const historyFKs = await db.execute(`
    SELECT 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name = 'agent_sub_tasks_step_history'
  `);
  
  console.log('\nagent_sub_tasks_step_history foreign keys:');
  console.log(historyFKs);
}

checkForeignKeys().catch(console.error);
