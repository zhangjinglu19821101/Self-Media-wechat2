
# -*- coding: utf-8 -*-
import re

# 读取文件
file_path = '/workspace/projects/src/lib/services/subtask-execution-engine.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print('文件读取成功，长度:', len(content))

# 找到 executeExecutorAgentWorkflow 方法的起始位置
method_start_marker = 'private async executeExecutorAgentWorkflow'
start_idx = content.find(method_start_marker)
if start_idx == -1:
    print('❌ 未找到方法起始')
    exit(1)

print('✅ 找到方法起始位置:', start_idx)

# 找到方法的结束位置（通过括号匹配）
bracket_count = 0
in_method = False
end_idx = -1

# 从起始位置开始扫描
for i in range(start_idx, len(content)):
    char = content[i]
    if char == '{':
        bracket_count += 1
        in_method = True
    elif char == '}':
        bracket_count -= 1
        if bracket_count == 0 and in_method:
            end_idx = i + 1  # 包含这个 }
            break

if end_idx == -1:
    print('❌ 未找到方法结束位置')
    exit(1)

print('✅ 找到方法结束位置:', end_idx)
print('✅ 方法长度:', end_idx - start_idx)

# 提取旧方法
old_method = content[start_idx:end_idx]
print('\n✅ 旧方法提取成功，前100字符:', repr(old_method[:100]))

# 新方法
new_method = '''  /**
   * ========== 执行Agent职责 ==========
   * 接收任务，从 pending 开始
   * 更新状态为 in_progress
   * 直接执行任务（跳过能力判定！）
   * 判断结果：
   *   如果能完成 → 标记为 pre_completed
   *   如果需要帮助 → 标记为 pre_need_support
   */
  private async executeExecutorAgentWorkflow(task: typeof agentSubTasks.$inferSelect) {
    console.log('[SubtaskEngine] 执行Agent: pending → in_progress');
    
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: getCurrentBeijingTime(),
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentSubTasks.id, task.id));

    try {
      console.log('[SubtaskEngine] 执行Agent: 开始处理任务');
      
      const allTasksInGroup = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, task.commandResultId))
        .orderBy(agentSubTasks.orderIndex);
      
      const previousResult = this.getPreviousStepResult(allTasksInGroup, task.orderIndex);
      
      // ==========================================
      // ✅ 核心改动：直接执行，不做能力判定！
      // ==========================================
      console.log('[SubtaskEngine] 执行Agent: 直接执行任务（跳过能力判定）');
      const executorResult = await this.callExecutorAgentDirectly(task, previousResult);
      console.log('[SubtaskEngine] 执行Agent执行结果:', executorResult);

      // ==========================================
      // ✅ 简化：保存结果到数据库
      // ==========================================
      const resultToSave = executorResult;
      console.log('[SubtaskEngine] 保存执行结果:', resultToSave);

      await db
        .update(agentSubTasks)
        .set({
          executionResult: JSON.stringify(resultToSave),
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));

      // ==========================================
      // ✅ 简化：更新状态
      // ==========================================
      if (executorResult.isCompleted) {
        console.log('[SubtaskEngine] 执行Agent: 任务完成 → pre_completed');
        await db
          .update(agentSubTasks)
          .set({
            status: 'pre_completed',
            updatedAt: getCurrentBeijingTime(),
          })
          .where(eq(agentSubTasks.id, task.id));
      } else {
        console.log('[SubtaskEngine] 执行Agent: 需要帮助 → pre_need_support');
        await db
          .update(agentSubTasks)
          .set({
            status: 'pre_need_support',
            updatedAt: getCurrentBeijingTime(),
          })
          .where(eq(agentSubTasks.id, task.id));
      }
      
      console.log('[SubtaskEngine] ========== 执行Agent处理完成，等待Agent B评审 ==========');
    } catch (error) {
      console.error('[SubtaskEngine] 执行Agent执行失败:', error);
      await db
        .update(agentSubTasks)
        .set({
          status: 'pre_need_support',
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));
    }
  }'''

# 替换
new_content = content[:start_idx] + new_method + content[end_idx:]

# 写入文件
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print('\n✅ 方法替换成功！')

# 验证
with open(file_path, 'r', encoding='utf-8') as f:
    verify_content = f.read()

if '直接执行任务（跳过能力判定）' in verify_content:
    print('✅ 验证成功：新方法已写入')
else:
    print('❌ 验证失败：新方法未找到')

print('\n完成！')

