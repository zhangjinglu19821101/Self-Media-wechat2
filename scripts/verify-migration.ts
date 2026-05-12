import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function verify() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 10 });

  try {
    console.log('🔍 验证数据库迁移...\n');

    // 检查 command_results 表字段
    const commandResultsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'command_results'
      AND column_name IN ('dialogue_session_id', 'dialogue_rounds', 'dialogue_status', 'last_dialogue_at', 'latest_report_id', 'report_count', 'requires_intervention')
      ORDER BY column_name
    `;

    console.log('✅ command_results 表新增字段:');
    commandResultsColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 检查 agent_sub_tasks 表字段
    const agentSubTasksColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks'
      AND column_name IN ('dialogue_session_id', 'dialogue_rounds', 'dialogue_status', 'last_dialogue_at')
      ORDER BY column_name
    `;

    console.log('\n✅ agent_sub_tasks 表新增字段:');
    agentSubTasksColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 检查 agent_interactions 表字段
    const agentInteractionsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'agent_interactions'
      AND column_name = 'is_understand'
    `;

    console.log('\n✅ agent_interactions 表新增字段:');
    agentInteractionsColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 检查 agent_reports 表
    const agentReportsColumns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'agent_reports'
      ORDER BY column_name
    `;

    console.log('\n✅ agent_reports 表字段:');
    agentReportsColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // 检查索引
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'agent_reports'
      ORDER BY indexname
    `;

    console.log('\n✅ agent_reports 表索引:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });

    console.log('\n🎉 数据库迁移验证完成！');
  } catch (error) {
    console.error('❌ 验证失败:', error instanceof Error ? error.message : String(error));
  } finally {
    await sql.end();
  }
}

verify();
