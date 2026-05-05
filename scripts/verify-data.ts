import postgres from 'postgres';

const CORRECT_DATABASE_URL = 'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require';

async function verifyData() {
  const sql = postgres(CORRECT_DATABASE_URL, {
    ssl: 'require',
    max: 1,
  });

  try {
    console.log('🔍 数据库信息:');
    const dbInfo = await sql`SELECT current_database() as db_name`;
    console.log('数据库名:', dbInfo[0].db_name);

    console.log('\n📊 核心表数据量:');
    
    const agentTasks = await sql`SELECT COUNT(*) FROM agent_tasks`;
    console.log('agent_tasks:', agentTasks[0].count);
    
    const agentSubTasks = await sql`SELECT COUNT(*) FROM agent_sub_tasks`;
    console.log('agent_sub_tasks:', agentSubTasks[0].count);
    
    const users = await sql`SELECT email, name FROM accounts LIMIT 5`;
    console.log('\n👤 账户列表 (前5个):');
    users.forEach(u => console.log(`  - ${u.email}${u.name ? ' (' + u.name + ')' : ''}`));
    
    const cases = await sql`SELECT id, title, industry FROM industry_case_library LIMIT 5`;
    console.log('\n📚 案例列表 (前5个):');
    cases.forEach(c => console.log(`  - [${c.industry}] ${c.title} (${c.id})`));

  } catch (error) {
    console.error('❌ 错误:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyData();