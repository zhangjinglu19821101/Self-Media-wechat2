
const fs = require('fs');

// 读取文件
const filePath = '/workspace/projects/src/lib/services/subtask-execution-engine.ts';
const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

console.log('文件读取成功，共', lines.length, '行');

// 找到 executeExecutorAgentWorkflow 方法
let methodStartLine = -1;
let methodEndLine = -1;
let inMethod = false;
let bracketCount = 0;

for (let i = 0; i &lt; lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('executeExecutorAgentWorkflow') &amp;&amp; line.includes('private async')) {
    methodStartLine = i;
    inMethod = true;
    bracketCount = 0;
  }
  
  if (inMethod) {
    bracketCount += (line.match(/{/g) || []).length;
    bracketCount -= (line.match(/}/g) || []).length;
    
    if (bracketCount === 0 &amp;&amp; methodStartLine !== -1 &amp;&amp; i &gt; methodStartLine) {
      methodEndLine = i;
      break;
    }
  }
}

console.log('方法起始行:', methodStartLine);
console.log('方法结束行:', methodEndLine);

if (methodStartLine === -1 || methodEndLine === -1) {
  console.error('未找到方法');
  process.exit(1);
}

// 新方法
const newMethodLines = [
  '  /**',
  '   * ========== 执行Agent职责 ==========',
  '   * 接收任务，从 pending 开始',
  '   * 更新状态为 in_progress',
  '   * 直接执行任务（跳过能力判定！）',
  '   * 判断结果：',
  '   *   如果能完成 → 标记为 pre_completed',
  '   *   如果需要帮助 → 标记为 pre_need_support',
  '   */',
  '  private async executeExecutorAgentWorkflow(task: typeof agentSubTasks.$inferSelect) {',
  "    console.log('[SubtaskEngine] 执行Agent: pending → in_progress');",
  '',
  '    await db',
  '      .update(agentSubTasks)',
  '      .set({',
  "        status: 'in_progress',",
  '        startedAt: getCurrentBeijingTime(),',
  '        updatedAt: getCurrentBeijingTime(),',
  '      })',
  '      .where(eq(agentSubTasks.id, task.id));',
  '',
  '    try {',
  "      console.log('[SubtaskEngine] 执行Agent: 开始处理任务');",
  '',
  '      const allTasksInGroup = await db',
  '        .select()',
  '        .from(agentSubTasks)',
  '        .where(eq(agentSubTasks.commandResultId, task.commandResultId))',
  '        .orderBy(agentSubTasks.orderIndex);',
  '',
  '      const previousResult = this.getPreviousStepResult(allTasksInGroup, task.orderIndex);',
  '',
  '      // ==========================================',
  '      // ✅ 核心改动：直接执行，不做能力判定！',
  '      // ==========================================',
  "      console.log('[SubtaskEngine] 执行Agent: 直接执行任务（跳过能力判定）');",
  '      const executorResult = await this.callExecutorAgentDirectly(task, previousResult);',
  "      console.log('[SubtaskEngine] 执行Agent执行结果:', executorResult);",
  '',
  '      // ==========================================',
  '      // ✅ 简化：保存结果到数据库',
  '      // ==========================================',
  '      const resultToSave = executorResult;',
  "      console.log('[SubtaskEngine] 保存执行结果:', resultToSave);",
  '',
  '      await db',
  '        .update(agentSubTasks)',
  '        .set({',
  '          executionResult: JSON.stringify(resultToSave),',
  '          updatedAt: getCurrentBeijingTime(),',
  '        })',
  '        .where(eq(agentSubTasks.id, task.id));',
  '',
  '      // ==========================================',
  '      // ✅ 简化：更新状态',
  '      // ==========================================',
  '      if (executorResult.isCompleted) {',
  "        console.log('[SubtaskEngine] 执行Agent: 任务完成 → pre_completed');",
  '        await db',
  '          .update(agentSubTasks)',
  '          .set({',
  '            status: \'pre_completed\',',
  '            updatedAt: getCurrentBeijingTime(),',
  '          })',
  '          .where(eq(agentSubTasks.id, task.id));',
  '      } else {',
  "        console.log('[SubtaskEngine] 执行Agent: 需要帮助 → pre_need_support');",
  '        await db',
  '          .update(agentSubTasks)',
  '          .set({',
  '            status: \'pre_need_support\',',
  '            updatedAt: getCurrentBeijingTime(),',
  '          })',
  '          .where(eq(agentSubTasks.id, task.id));',
  '      }',
  '',
  "      console.log('[SubtaskEngine] ========== 执行Agent处理完成，等待Agent B评审 ==========');",
  '    } catch (error) {',
  "      console.error('[SubtaskEngine] 执行Agent执行失败:', error);",
  '      await db',
  '        .update(agentSubTasks)',
  '        .set({',
  '          status: \'pre_need_support\',',
  '          updatedAt: getCurrentBeijingTime(),',
  '        })',
  '        .where(eq(agentSubTasks.id, task.id));',
  '    }',
  '  }'
];

// 重新组合
const beforeLines = lines.slice(0, methodStartLine - 9); // 从注释前开始
const afterLines = lines.slice(methodEndLine + 1);

const newLines = [...beforeLines, ...newMethodLines, ...afterLines];

console.log(`原文件 ${lines.length} 行');
console.log(`新文件 ${newLines.length} 行');

// 写入
fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');

console.log('\n✅ 方法替换成功！');

// 验证
const verifyContent = fs.readFileSync(filePath, 'utf-8');
if (verifyContent.includes('直接执行任务（跳过能力判定）') &amp;&amp; !verifyContent.includes('capabilityCheckResult')) {
  console.log('✅ 验证成功：新方法已写入，旧代码已删除');
} else {
  console.error('❌ 验证失败');
}

console.log('\n完成！');

