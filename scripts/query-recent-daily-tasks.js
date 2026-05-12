const { Client } = require('pg');
require('dotenv').config();

async function queryRecentDailyTasks() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ 已连接到数据库\n');

    // 查询最近1小时内插入的 daily_task 数据
    const query = `
      SELECT
        id::text as id,
        task_id,
        related_task_id,
        task_title,
        executor,
        to_agent_id,
        execution_status,
        sub_task_count,
        created_at,
        CASE
          WHEN created_at >= NOW() - INTERVAL '1 hour' THEN '1小时内'
          ELSE '更早'
        END as time_range
      FROM daily_task
      WHERE created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC;
    `;

    console.log('📋 查询最近1小时内插入的 daily_task 数据...\n');
    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('❌ 未找到最近1小时内插入的数据\n');

      // 查询所有数据（限制最近5条）
      const allQuery = `
        SELECT
          id::text as id,
          task_id,
          task_title,
          executor,
          created_at,
          EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 as minutes_ago
        FROM daily_task
        ORDER BY created_at DESC
        LIMIT 5;
      `;

      console.log('📋 查询最近的5条 daily_task 数据（供参考）...\n');
      const allResult = await client.query(allQuery);

      if (allResult.rows.length === 0) {
        console.log('❌ daily_task 表中没有数据\n');
      } else {
        console.log(`共找到 ${allResult.rows.length} 条记录：\n`);
        console.table(allResult.rows);
      }
    } else {
      console.log(`✅ 找到 ${result.rows.length} 条最近1小时内插入的数据：\n`);
      console.table(result.rows);
    }

    // 统计总数
    const countQuery = `
      SELECT
        COUNT(*) as total_count,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as recent_count
      FROM daily_task;
    `;

    const countResult = await client.query(countQuery);
    console.log(`\n📊 统计信息：`);
    console.log(`   总记录数：${countResult.rows[0].total_count}`);
    console.log(`   1小时内记录数：${countResult.rows[0].recent_count}`);

  } catch (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ 数据库连接已关闭');
  }
}

queryRecentDailyTasks();
