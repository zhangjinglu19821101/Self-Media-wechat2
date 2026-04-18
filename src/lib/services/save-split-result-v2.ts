/**
 * 保存拆解结果到 daily_task 表的服务函数（使用原始 SQL）
 */

import postgres from 'postgres';
import { mapExecutorId } from '@/lib/utils/agent-mapper';

// 从环境变量获取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 60,
});

/**
 * 保存拆解结果到 daily_task 表
 * @param taskId 总任务ID
 * @param splitResult 拆解结果
 * @returns 保存结果
 */
export async function saveSplitResultToDailyTasks(
  taskId: string,
  splitResult: {
    subTasks?: Array<{
      taskTitle: string;
      commandContent: string;
      executor: string;
      taskType: string;
      priority: string;
      deadline: string;
      estimatedHours: string;
      acceptanceCriteria: string;
    }>;
  }
) {
  try {
    // 🔥 定义当前时间戳
    const now = new Date();
    
    console.log(`📝 [save-split-result] 接收到保存请求`);
    console.log(`📝 [save-split-result] taskId: ${taskId} (类型: ${typeof taskId})`);
    console.log(`📝 [save-split-result] taskId 长度: ${taskId.length}`);
    console.log(`📋 [save-split-result] 拆解结果包含 ${splitResult.subTasks?.length || 0} 个子任务`);

    // 1. 查询总任务信息
    console.log(`🔍 [save-split-result] 查询 agent_tasks 表，task_id = ${taskId}`);
    
    // 🔥 先尝试用 task_id 查询
    let tasks = await sql`
      SELECT id, task_id, task_name, creator, core_command, from_agent_id, to_agent_id, executor, metadata
      FROM agent_tasks
      WHERE task_id = ${taskId}
      LIMIT 1
    `;
    
    console.log(`🔍 [save-split-result] 通过 task_id 查询结果: ${tasks.length} 条记录`);
    
    // 🔥 检查 taskId 是否是有效的 UUID 格式
    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    
    // 🔥 只有当 taskId 是 UUID 且未找到记录时，才尝试用 id (UUID) 查询
    if (tasks.length === 0 && isUuid(taskId)) {
      console.log(`⚠️ [save-split-result] 通过 task_id 未找到，尝试用 id (UUID) 查询`);
      tasks = await sql`
        SELECT id, task_id, task_name, creator, core_command, from_agent_id, to_agent_id, executor, metadata
        FROM agent_tasks
        WHERE id = ${taskId}
        LIMIT 1
      `;
      console.log(`🔍 [save-split-result] 通过 id 查询结果: ${tasks.length} 条记录`);
    } else if (tasks.length === 0) {
      console.log(`⚠️ [save-split-result] 通过 task_id 未找到，且 taskId 不是 UUID 格式 (${taskId})，跳过 id 查询`);
    }

    let task: any;

    if (tasks.length > 0) {
      console.log(`✅ [save-split-result] 找到总任务: ${tasks[0].task_name}`);
      task = tasks[0];
    } else {
      console.log(`⚠️ [save-split-result] 总任务不存在，自动创建...`);

      // 🔥 自动创建 agent_tasks 记录
      const result = await sql`
        INSERT INTO agent_tasks (
          task_id, task_name, core_command, executor, acceptance_criteria, task_type,
          split_status, task_duration_start, task_duration_end, total_deliverables,
          task_priority, task_status, creator, updater, from_agent_id, to_agent_id,
          command_type, metadata, workspace_id, created_at, updated_at
        ) VALUES (
          ${taskId},
          ${`任务拆解：${splitResult.subTasks?.[0]?.taskTitle || '未知任务'}`},
          ${splitResult.subTasks?.[0]?.commandContent || ''},
          ${'agent B'},
          ${splitResult.totalDeliverables || '未指定'},
          ${'master'},
          ${'splitting'},
          ${now},
          ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)},
          ${splitResult.totalDeliverables || '未指定'},
          ${'normal'},
          ${'split'},
          ${'A'},
          ${'TS'},
          ${'A'},
          ${'B'},
          ${'instruction'},
          ${JSON.stringify({ splitSource: 'websocket-confirm' })},
          ${null},
          ${now},
          ${now}
        ) RETURNING *
      `;

      console.log(`✅ [save-split-result] 自动创建总任务成功: ${result[0].task_name}`);
      task = result[0];
    }

    console.log(`✅ 找到总任务: ${task.task_name}`);

    // 2. 检查是否已经保存过（先检查 task_id，再检查 related_task_id，最后检查 id）
    let existingByTaskId = await sql`
      SELECT id, task_id, related_task_id
      FROM daily_task
      WHERE task_id = ${taskId}
    `;

    if (existingByTaskId.length === 0) {
      // 🔥 检查 taskId 是否是有效的 UUID 格式
      const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      
      if (isUuid(taskId)) {
        // 🔥 只有当 taskId 是 UUID 时，才尝试用 id (UUID) 查询
        existingByTaskId = await sql`
          SELECT id, task_id, related_task_id
          FROM daily_task
          WHERE id = ${taskId}
        `;
      } else {
        console.log(`⚠️ taskId 不是 UUID 格式 (${taskId})，跳过 id 查询`);
      }
    }

    if (existingByTaskId.length > 0) {
      console.log(`⚠️ 该任务已作为 daily_task 存在 (id/task_id=${taskId}), 跳过保存`);
      return {
        success: true,
        message: '拆解结果已存在，跳过保存',
        existingCount: existingByTaskId.length,
        data: {
          taskId,
          totalTasks: existingByTaskId.length,
          dailyTaskId: existingByTaskId[0].id, // ✅ 修复：返回 UUID id 而不是 task_id
          isUpdate: false, // 不需要更新
        },
      };
    }

    const existingByRelatedTaskId = await sql`
      SELECT id, task_id
      FROM daily_task
      WHERE related_task_id = ${taskId}
    `;

    if (existingByRelatedTaskId.length > 0) {
      console.log(`⚠️ 该任务已保存 ${existingByRelatedTaskId.length} 条 daily_task 记录 (related_task_id=${taskId}), 跳过保存`);
      return {
        success: true,
        message: '拆解结果已存在，跳过保存',
        existingCount: existingByRelatedTaskId.length,
        data: {
          taskId,
          totalTasks: existingByRelatedTaskId.length,
          dailyTaskId: existingByRelatedTaskId[0].id, // ✅ 修复：返回 UUID id 而不是 task_id
          isUpdate: false, // 不需要更新
        },
      };
    }

    // 3. 遍历子任务，插入到 daily_task 表
    const insertedTasks = [];
    const skippedTasks = []; // 🔥 新增：记录跳过的任务
    // 🔥 修复：兼容两种格式：subTasks 和 subtasks
    let subTasks = splitResult.subTasks || splitResult.subtasks || [];

    // 🔥 新增：格式转换逻辑
    // 检测是否是 SubTaskSplitResult 格式（包含 title, description, executor, acceptanceCriteria, isCritical, criticalReason）
    if (subTasks.length > 0 && subTasks[0].title && subTasks[0].description) {
      console.log('🔄 [save-split-result] 检测到 SubTaskSplitResult 格式（agent B 返回），进行格式转换...');
      subTasks = subTasks.map((st: any, index: number) => ({
        taskTitle: st.title,
        commandContent: st.description,
        executor: st.executor,
        taskType: 'daily',
        priority: st.isCritical ? '高' : 'normal',
        // 🔥 修复：优先使用 Agent B 返回的 deadline，如果没有才使用兜底方案
        deadline: st.deadline || `第${st.orderIndex || index + 1}天`,
        estimatedHours: st.estimatedHours?.toString() || '8',
        acceptanceCriteria: st.acceptanceCriteria || '未指定',
        // 🔥 新增：保存 isCritical 和 criticalReason 到临时字段，后续会存入 metadata
        isCritical: st.isCritical || false,
        criticalReason: st.criticalReason || '',
      }));
      console.log(`✅ [save-split-result] 格式转换完成，转换了 ${subTasks.length} 个子任务`);
    }
    // 🔥 修复：如果是数据库中的格式（包含 name, description, executor 等），也进行转换
    else if (subTasks.length > 0 && subTasks[0].name) {
      console.log('🔄 [save-split-result] 检测到数据库格式，进行格式转换...');
      subTasks = subTasks.map((st: any) => ({
        taskTitle: st.name,
        commandContent: st.description,
        executor: st.executor,
        taskType: 'daily',
        priority: 'normal',
        deadline: `第${st.estimatedDuration || 1}天`,
        estimatedHours: '8',
        acceptanceCriteria: st.metadata?.acceptanceCriteria || '未指定',
      }));
      console.log(`✅ [save-split-result] 格式转换完成，转换了 ${subTasks.length} 个子任务`);
    }

    for (let i = 0; i < subTasks.length; i++) {
      const subTask = subTasks[i];
      
      // 🔥 核心原则：execution_date 必须对应 Agent 返回的 deadline
      let executionDate: Date;
      let dateSource = '';
      
      console.log(`🔍 [deadline处理] ===== 子任务 ${i + 1} =====`);
      console.log(`🔍 [deadline处理] Agent返回的deadline: "${subTask.deadline}" (类型: ${typeof subTask.deadline})`);
      
      // 方案1：优先直接使用 Agent 返回的 deadline
      if (subTask.deadline) {
        // 尝试解析 YYYY-MM-DD 格式（这是规范要求的格式）
        const dateMatch = subTask.deadline.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          executionDate = new Date(`${year}-${month}-${day}`);
          if (!isNaN(executionDate.getTime())) {
            dateSource = 'Agent返回的YYYY-MM-DD格式';
            console.log(`✅ [deadline处理] 直接使用Agent返回的deadline: ${executionDate.toISOString().split('T')[0]}`);
          }
        }
        
        // 如果上面失败，尝试直接 new Date() 解析
        if (!dateSource) {
          executionDate = new Date(subTask.deadline);
          if (!isNaN(executionDate.getTime())) {
            dateSource = 'Agent返回的其他日期格式';
            console.log(`✅ [deadline处理] 直接使用Agent返回的deadline: ${executionDate.toISOString().split('T')[0]}`);
          }
        }
      }
      
      // 方案2：如果 Agent 没有返回有效 deadline，使用当前日期 + i 天作为兜底
      if (!dateSource) {
        console.log(`⚠️ [deadline处理] Agent未返回有效deadline，使用兜底方案`);
        executionDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        dateSource = '兜底方案(当前日期+i天)';
        console.log(`✅ [deadline处理] 使用兜底日期: ${executionDate.toISOString().split('T')[0]}`);
      }
      
      // 最终验证日期是否有效
      if (isNaN(executionDate.getTime())) {
        console.error(`❌ [deadline处理] 日期解析最终失败，使用当前日期`);
        executionDate = now;
        dateSource = '最终兜底(当前日期)';
      }
      
      console.log(`✅ [deadline处理] 最终结果:`);
      console.log(`  - execution_date: ${executionDate.toISOString().split('T')[0]}`);
      console.log(`  - 日期来源: ${dateSource}`);
      console.log(`  - Agent原始deadline: "${subTask.deadline}"`);
      
      const executorId = mapExecutorId(subTask.executor); // 🔥 映射 agent ID
      const dailyTaskId = `daily-task-${executorId}-${executionDate.toISOString().split('T')[0]}-${String(i + 1).padStart(3, '0')}`;
      const commandId = `${taskId}-${executorId}-${i + 1}`; // 🔥 使用 taskId 生成唯一的 command_id

      // 🔥 新增：检查 dailyTaskId 是否已经存在
      const existingDailyTask = await sql`
        SELECT id, task_id
        FROM daily_task
        WHERE task_id = ${dailyTaskId}
      `;

      if (existingDailyTask.length > 0) {
        console.log(`⚠️ daily_task 已存在 (task_id=${dailyTaskId})，跳过插入`);
        skippedTasks.push({
          id: existingDailyTask[0].id, // 🔥 保存 UUID 而不是 task_id
          dailyTaskId,
          taskTitle: subTask.taskTitle,
        });
        continue;
      }

      console.log(`📝 保存子任务 ${i + 1}/${subTasks.length}: ${subTask.taskTitle}`);
      console.log(`📝 执行者映射: ${subTask.executor} -> ${executorId}`);

      const result = await sql`
        INSERT INTO daily_task (
          id, command_id, related_task_id, task_description, executor, task_priority,
          execution_deadline_start, execution_deadline_end, deliverables,
          execution_status, status_proof, help_record, audit_opinion,
          splitter, entry_user, remarks,
          last_ts_check_time, last_ts_awakening_time, ts_awakening_count,
          last_inspection_time, last_consult_time, awakening_count,
          task_id, from_agent_id, to_agent_id,
          original_command, execution_result, output_data, metrics, attachments,
          completed_at, scenario_type, task_name, trigger_source, retry_status,
          metadata, created_at, updated_at, task_type, execution_date,
          rejection_reason, dependencies, sort_order,
          completed_sub_tasks, completed_sub_tasks_description, sub_task_count,
          question_status, last_checked_at, last_inspected_at,
          dialogue_session_id, dialogue_rounds, dialogue_status, last_dialogue_at,
          latest_report_id, report_count, requires_intervention,
          task_title, command_content, command_priority,
          user_opinion, material_ids, workspace_id
        ) VALUES (
          gen_random_uuid(), ${commandId}, ${task.task_id}, ${subTask.commandContent}, ${executorId}, ${subTask.priority === '高' ? 'high' : 'normal'},
          ${new Date(`${executionDate.toISOString().split('T')[0]} 09:00:00`)}, ${new Date(`${executionDate.toISOString().split('T')[0]} 18:00:00`)}, ${subTask.acceptanceCriteria || '未指定'},
          ${'pending_review'}, ${null}, ${null}, ${null},
          ${'agent B'}, ${task.creator || 'B'}, ${null},
          ${null}, ${null}, ${0},
          ${null}, ${null}, ${0},
          ${dailyTaskId}, ${task.from_agent_id || 'A'}, ${executorId},
          ${task.core_command || subTask.commandContent}, ${null}, ${'{}'}, ${'{}'}, ${'[]'},
          ${null}, ${'agent-b-daily'}, ${subTask.taskTitle}, ${'agent-b-split'}, ${'pending'},
          ${JSON.stringify({
            estimatedHours: subTask.estimatedHours,
            acceptanceCriteria: subTask.acceptanceCriteria,
            isCritical: subTask.isCritical || false,
            criticalReason: subTask.criticalReason || '',
            splitSource: 'agent-b',
          })},
          ${new Date()}, ${new Date()}, ${subTask.taskType || 'daily'}, ${executionDate.toISOString().split('T')[0]},
          ${null}, ${'{}'}, ${i + 1},
          ${0}, ${null}, ${0},
          ${'resolved'}, ${null}, ${null},
          ${null}, ${0}, ${'none'}, ${null},
          ${null}, ${0}, ${false},
          ${subTask.taskTitle}, ${subTask.commandContent}, ${subTask.priority === '高' ? 'high' : 'normal'},
          ${task.user_opinion || null}, ${task.material_ids || '[]'},
          ${task.workspace_id || null}
        ) RETURNING *
      `;

      insertedTasks.push(result[0]);
    }

    // 4. 更新总任务状态
    await sql`
      UPDATE agent_tasks
      SET task_status = 'split', split_status = 'completed', updated_at = ${new Date()}
      WHERE task_id = ${taskId}
    `;

    console.log(`✅ 保存完成: ${taskId}, 共 ${insertedTasks.length} 条记录, 跳过 ${skippedTasks.length} 条已存在的记录`);

    // 🔥 返回第一个 daily_task 的 UUID（id），用于后续的 confirm-split API
    const firstDailyTaskId = insertedTasks[0]?.id || skippedTasks[0]?.id;

    // ✅ 修复：删除自动触发 insurance-d 拆分的逻辑
    // 原因：必须等用户确认后才能触发拆分，违反了"所有拆分必须等用户确认"的原则
    // 改为：定时任务检测 is_confirmed = true 的记录后，再触发拆解
    // 参考：DESIGN_SPLIT_CONFIRMATION_FLOW.md

    return {
      success: true,
      message: skippedTasks.length > 0
        ? `成功保存 ${insertedTasks.length} 条 daily_task 记录，跳过 ${skippedTasks.length} 条已存在的记录`
        : `成功保存 ${insertedTasks.length} 条 daily_task 记录`,
      data: {
        taskId,
        totalTasks: insertedTasks.length + skippedTasks.length,
        dailyTaskId: firstDailyTaskId, // 这是 UUID (id)
        insertedCount: insertedTasks.length,
        skippedCount: skippedTasks.length,
        dailyTask: insertedTasks.map(t => ({
          id: t.id,
          taskId: t.task_id,
          taskTitle: t.task_title,
          executionDate: t.execution_date,
          executor: t.executor,
        })),
        skippedTasks,
      },
    };
  } catch (error) {
    console.error('❌ 保存拆解结果失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
