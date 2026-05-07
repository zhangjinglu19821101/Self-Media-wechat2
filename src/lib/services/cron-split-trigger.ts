
/**
 * 定时任务：检测并触发第二步拆解
 *
 * 功能：
 * 1. 每分钟轮询 daily_task 表
 * 2. 查找 execution_status = 'pending_review' 的记录
 * 3. 根据 executor 字段触发对应的拆解 API
 * 4. 支持多个执行主体（insurance-d, insurance-c, insurance-a）
 * 5. 按优先级排序（高优先级先执行）
 *
 * 参考：DESIGN_SPLIT_CONFIRMATION_FLOW.md
 */

import postgres from 'postgres';

// 从环境变量获取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('[cron-split-trigger] DATABASE_URL 环境变量未设置');
}

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 60,
});

/**
 * 检测并触发拆解
 */
async function checkAndTriggerSplit() {
  try {
    console.log(`🔍 [定时任务] 开始检测待拆分任务...`);

    // 1. 查询 execution_status = 'pending_review' 的记录
    // 按优先级排序（high > normal > low）
    const tasks = await sql`
      SELECT id, task_id, task_title, executor, task_priority, execution_status, created_at
      FROM daily_task
      WHERE execution_status = 'pending_review'
      ORDER BY
        CASE task_priority
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END,
        created_at ASC
      LIMIT 10
    `;

    if (tasks.length === 0) {
      console.log(`✅ [定时任务] 没有待拆分任务`);
      return;
    }

    console.log(`📋 [定时任务] 找到 ${tasks.length} 个待拆分任务`);

    // 🔥 新增：在触发拆解之前，先检查记录是否仍然存在且状态正确
    // 避免在用户拒绝后，记录被删除但仍触发拆解的问题
    const validTasks: typeof tasks = [];
    
    for (const task of tasks) {
      // 重新查询该记录，确保它仍然存在
      const currentTask = await sql`
        SELECT id, task_id, task_title, executor, task_priority, execution_status
        FROM daily_task
        WHERE id = ${task.id}
      `;

      if (currentTask.length === 0) {
        console.log(`⚠️ [定时任务] 任务 ${task.id} 已被删除，跳过`);
        continue;
      }

      if (currentTask[0].execution_status !== 'pending_review') {
        console.log(`⚠️ [定时任务] 任务 ${task.id} 状态已变更（${currentTask[0].execution_status}），跳过`);
        continue;
      }

      validTasks.push(currentTask[0]);
    }

    if (validTasks.length === 0) {
      console.log(`✅ [定时任务] 没有有效的待拆分任务（所有记录已失效）`);
      return;
    }

    console.log(`📋 [定时任务] 找到 ${validTasks.length} 个有效的待拆分任务`);

    // 2. 按 executor 分组
    const tasksByExecutor: Record<string, typeof tasks> = {};
    validTasks.forEach(task => {
      const executor = task.executor;
      if (!tasksByExecutor[executor]) {
        tasksByExecutor[executor] = [];
      }
      tasksByExecutor[executor].push(task);
    });

    console.log(`📊 [定时任务] 按执行主体分组:`, Object.entries(tasksByExecutor).map(([executor, tasks]) => `${executor}: ${tasks.length} 个`));

    // 3. 统一由 Agent B 拆解所有任务（不再按 executor 分发）
    const allTaskIds = validTasks.map(t => t.id);
    console.log(`🔧 [定时任务] 统一由 Agent B 拆解 ${allTaskIds.length} 个任务`);

    try {
      // 🔥 更新任务状态为 'splitting'，避免重复触发
      await sql`
        UPDATE daily_task
        SET execution_status = 'splitting',
            updated_at = NOW()
        WHERE id = ANY(${allTaskIds})
      `;
      console.log(`✅ [定时任务] 已更新 ${allTaskIds.length} 个任务状态为 'splitting'`);

      // 统一调用 Agent B 拆解 API
      await triggerAgentBUnifiedSplit(allTaskIds);
      
    } catch (error) {
      console.error(`❌ [定时任务] Agent B 统一拆解失败:`, error);
      // 🔥 失败时恢复状态
      await sql`
        UPDATE daily_task
        SET execution_status = 'pending_review',
            updated_at = NOW()
        WHERE id = ANY(${allTaskIds})
      `;
      console.log(`✅ [定时任务] 已恢复 ${allTaskIds.length} 个任务状态为 'pending_review'`);
    }

    console.log(`✅ [定时任务] 拆解任务检测完成`);
  } catch (error) {
    console.error(`❌ [定时任务] 检测失败:`, error);
  }
}

/**
 * 触发 Agent B 统一拆解
 */
async function triggerAgentBUnifiedSplit(taskIds: string[]) {
  console.log(`🚀 [定时任务] 触发 Agent B 统一拆解: ${taskIds.length} 个任务`);

  try {
    const response = await fetch('http://localhost:5000/api/agents/agent-b/unified-split-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07' },
      body: JSON.stringify({ taskIds }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent B 统一拆解 API 返回错误: ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ [定时任务] Agent B 统一拆解成功: ${result.subTaskCount} 个子任务`);
  } catch (error) {
    console.error(`❌ [定时任务] Agent B 统一拆解失败:`, error);
    throw error;
  }
}

/**
 * 触发 insurance-a 拆解
 */
async function triggerInsuranceASplit(taskIds: string[]) {
  console.log(`🚀 [定时任务] 触发 insurance-a 拆解: ${taskIds.length} 个任务`);

  try {
    const response = await fetch('http://localhost:5000/api/agents/insurance-a/split-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07' },
      body: JSON.stringify({ taskIds }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`insurance-a 拆解 API 返回错误: ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ [定时任务] insurance-a 拆解成功: ${result.subTaskCount} 个子任务`);
  } catch (error) {
    console.error(`❌ [定时任务] insurance-a 拆解失败:`, error);
    throw error;
  }
}

/**
 * 启动定时任务
 */
export function startCronSplitTrigger() {
  console.log(`🚀 [定时任务] 启动拆解任务检测定时器（每分钟执行一次）`);

  // 每分钟执行一次
  const intervalId = setInterval(checkAndTriggerSplit, 60 * 1000);

  // 立即执行一次
  checkAndTriggerSplit();

  return intervalId;
}

// 如果直接运行此文件，启动定时任务
if (require.main === module) {
  startCronSplitTrigger();
}
