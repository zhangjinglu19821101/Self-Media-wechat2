const { Client } = require('pg');

async function batchSplitDailyTasks() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ 已连接到数据库\n');

    // 1. 查询未拆分的 insurance-d 任务
    const query = `
      SELECT
        id::text as id,
        task_id,
        task_title,
        executor
      FROM daily_task
      WHERE executor = 'insurance-d'
        AND sub_task_count = 0
        AND execution_status = 'new'
      ORDER BY created_at DESC;
    `;

    console.log('📋 查询未拆分的 insurance-d 任务...\n');
    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('✅ 没有需要拆分的任务\n');
      process.exit(0);
    }

    console.log(`找到 ${result.rows.length} 条需要拆分的任务：\n`);
    console.table(result.rows);

    // 2. 提示用户确认
    console.log('\n⚠️  即将拆分这些任务，是否继续？(y/n)');
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('', async (answer) => {
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('❌ 已取消拆分\n');
        await client.end();
        process.exit(0);
      }

      // 3. 批量调用拆分 API
      console.log('\n🔧 开始批量拆分任务...\n');

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < result.rows.length; i++) {
        const task = result.rows[i];
        console.log(`[${i + 1}/${result.rows.length}] 拆分任务: ${task.task_title}`);

        try {
          // 调用本地 API（假设运行在 http://localhost:5000）
          const response = await fetch('http://localhost:5000/api/agents/insurance-d/split-task', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              commandResultId: task.id,
            }),
          });

          const data = await response.json();

          if (data.success) {
            console.log(`   ✅ 拆分成功，生成了 ${data.subTaskCount} 个子任务\n`);
            successCount++;
          } else {
            console.log(`   ❌ 拆分失败: ${data.error}\n`);
            failCount++;
          }
        } catch (error) {
          console.log(`   ❌ 拆分失败: ${error.message}\n`);
          failCount++;
        }

        // 添加延迟避免过快请求
        if (i < result.rows.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`\n📊 拆分完成统计：`);
      console.log(`   成功：${successCount} 条`);
      console.log(`   失败：${failCount} 条`);
      console.log(`   总计：${result.rows.length} 条\n`);

      await client.end();
      console.log('✅ 数据库连接已关闭');
    });

  } catch (error) {
    console.error('❌ 批量拆分失败:', error);
    await client.end();
    process.exit(1);
  }
}

batchSplitDailyTasks();
