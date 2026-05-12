#!/usr/bin/env node

/**
 * 批量拆分最近1小时内插入的 insurance-d daily_task 任务
 * 用法: node scripts/batch-split-recent-tasks.js
 */

const { Client } = require('pg');

// 数据库配置
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

async function batchSplitRecentTasks() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ 已连接到数据库\n');

    // 1. 查询最近1小时内插入的未拆分 insurance-d 任务
    const query = `
      SELECT
        id::text as id,
        task_id,
        task_title,
        executor,
        created_at
      FROM daily_task
      WHERE executor = 'insurance-d'
        AND sub_task_count = 0
        AND execution_status = 'new'
        AND created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC;
    `;

    console.log('📋 查询最近1小时内未拆分的 insurance-d 任务...\n');
    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('✅ 没有需要拆分的任务\n');
      await client.end();
      process.exit(0);
    }

    console.log(`找到 ${result.rows.length} 条需要拆分的任务：\n`);
    console.table(result.rows);
    console.log('');

    // 2. 批量调用拆分 API
    console.log('🔧 开始批量拆分任务...\n');

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (let i = 0; i < result.rows.length; i++) {
      const task = result.rows[i];
      console.log(`[${i + 1}/${result.rows.length}] 拆分任务: ${task.task_title}`);
      console.log(`   任务ID: ${task.task_id}`);

      try {
        // 调用本地 API（http://localhost:5000）
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
          console.log(`   ✅ 拆分成功，生成了 ${data.subTaskCount} 个子任务`);
          successCount++;
        } else {
          console.log(`   ❌ 拆分失败: ${data.error}`);
          errors.push({ task: task.task_title, error: data.error });
          failCount++;
        }
      } catch (error) {
        console.log(`   ❌ 拆分失败: ${error.message}`);
        errors.push({ task: task.task_title, error: error.message });
        failCount++;
      }

      console.log('');

      // 添加延迟避免过快请求
      if (i < result.rows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('='.repeat(60));
    console.log(`📊 拆分完成统计：`);
    console.log(`   成功：${successCount} 条`);
    console.log(`   失败：${failCount} 条`);
    console.log(`   总计：${result.rows.length} 条`);

    if (errors.length > 0) {
      console.log('\n❌ 失败详情：');
      errors.forEach((err, index) => {
        console.log(`   ${index + 1}. ${err.task}`);
        console.log(`      错误: ${err.error}`);
      });
    }

    console.log('\n');

    // 3. 验证拆分结果
    console.log('🔍 验证拆分结果...\n');
    const verifyQuery = `
      SELECT
        dt.task_id,
        dt.task_title,
        dt.sub_task_count,
        COUNT(ast.id) as actual_sub_task_count
      FROM daily_task dt
      LEFT JOIN agent_sub_tasks ast ON ast.command_result_id = dt.id
      WHERE dt.executor = 'insurance-d'
        AND dt.created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY dt.id, dt.task_id, dt.task_title, dt.sub_task_count
      ORDER BY dt.created_at DESC;
    `;

    const verifyResult = await client.query(verifyQuery);
    console.table(verifyResult.rows);

    await client.end();
    console.log('\n✅ 数据库连接已关闭');
    console.log('✅ 批量拆分完成\n');

  } catch (error) {
    console.error('❌ 批量拆分失败:', error);
    await client.end();
    process.exit(1);
  }
}

batchSplitRecentTasks();
