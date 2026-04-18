
# -*- coding: utf-8 -*-
import re

# 读取文件
file_path = '/workspace/projects/src/lib/services/subtask-execution-engine.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('文件读取成功，共', len(lines), '行')

# 找到 executeExecutorAgentWorkflow 方法的范围
method_start_line = -1
method_end_line = -1
in_method = False
bracket_count = 0

for i, line in enumerate(lines):
    if 'executeExecutorAgentWorkflow' in line and 'private async' in line:
        method_start_line = i
        in_method = True
        bracket_count = 0
    
    if in_method:
        bracket_count += line.count('{')
        bracket_count -= line.count('}')
        
        if bracket_count == 0 and method_start_line != -1 and i &gt; method_start_line:
            method_end_line = i
            break

print('方法起始行:', method_start_line)
print('方法结束行:', method_end_line)

if method_start_line == -1 or method_end_line == -1:
    print('❌ 未找到方法')
    exit(1)

# 提取方法注释和签名（保留）
method_header = lines[method_start_line - 9 : method_start_line + 3]  # 从注释开始到 {

print('\n保留的方法头:')
for line in method_header:
    print(repr(line.rstrip()))

# 新的方法体（从 try 开始）
new_body_lines = [
    '    try {\n',
    "      console.log('[SubtaskEngine] 执行Agent: 开始处理任务');\n",
    '\n',
    '      const allTasksInGroup = await db\n',
    '        .select()\n',
    '        .from(agentSubTasks)\n',
    '        .where(eq(agentSubTasks.commandResultId, task.commandResultId))\n',
    '        .orderBy(agentSubTasks.orderIndex);\n',
    '\n',
    '      const previousResult = this.getPreviousStepResult(allTasksInGroup, task.orderIndex);\n',
    '\n',
    '      // ==========================================\n',
    '      // ✅ 核心改动：直接执行，不做能力判定！\n',
    '      // ==========================================\n',
    "      console.log('[SubtaskEngine] 执行Agent: 直接执行任务（跳过能力判定）');\n",
    '      const executorResult = await this.callExecutorAgentDirectly(task, previousResult);\n',
    "      console.log('[SubtaskEngine] 执行Agent执行结果:', executorResult);\n",
    '\n',
    '      // ==========================================\n',
    '      // ✅ 简化：保存结果到数据库\n',
    '      // ==========================================\n',
    '      const resultToSave = executorResult;\n',
    "      console.log('[SubtaskEngine] 保存执行结果:', resultToSave);\n",
    '\n',
    '      await db\n',
    '        .update(agentSubTasks)\n',
    '        .set({\n',
    '          executionResult: JSON.stringify(resultToSave),\n',
    '          updatedAt: getCurrentBeijingTime(),\n',
    '        })\n',
    '        .where(eq(agentSubTasks.id, task.id));\n',
    '\n',
    '      // ==========================================\n',
    '      // ✅ 简化：更新状态\n',
    '      // ==========================================\n',
    '      if (executorResult.isCompleted) {\n',
    "        console.log('[SubtaskEngine] 执行Agent: 任务完成 → pre_completed');\n",
    '        await db\n',
    '          .update(agentSubTasks)\n',
    '          .set({\n',
    '            status: \'pre_completed\',\n',
    '            updatedAt: getCurrentBeijingTime(),\n',
    '          })\n',
    '          .where(eq(agentSubTasks.id, task.id));\n',
    '      } else {\n',
    "        console.log('[SubtaskEngine] 执行Agent: 需要帮助 → pre_need_support');\n",
    '        await db\n',
    '          .update(agentSubTasks)\n',
    '          .set({\n',
    '            status: \'pre_need_support\',\n',
    '            updatedAt: getCurrentBeijingTime(),\n',
    '          })\n',
    '          .where(eq(agentSubTasks.id, task.id));\n',
    '      }\n',
    '\n',
    "      console.log('[SubtaskEngine] ========== 执行Agent处理完成，等待Agent B评审 ==========');\n",
    '    } catch (error) {\n',
    "      console.error('[SubtaskEngine] 执行Agent执行失败:', error);\n",
    '      await db\n',
    '        .update(agentSubTasks)\n',
    '        .set({\n',
    '          status: \'pre_need_support\',\n',
    '          updatedAt: getCurrentBeijingTime(),\n',
    '        })\n',
    '        .where(eq(agentSubTasks.id, task.id));\n',
    '    }\n',
    '  }\n'
]

# 重新组合文件
new_lines = lines[:method_start_line - 9] + method_header + new_body_lines + lines[method_end_line + 1:]

print(f'\n原文件 {len(lines)} 行')
print(f'新文件 {len(new_lines)} 行')

# 写入文件
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('\n✅ 方法替换成功！')

# 验证
with open(file_path, 'r', encoding='utf-8') as f:
    verify_content = f.read()

if '直接执行任务（跳过能力判定）' in verify_content and 'capabilityCheckResult' not in verify_content:
    print('✅ 验证成功：新方法已写入，旧代码已删除')
else:
    print('❌ 验证失败')

print('\n完成！')

