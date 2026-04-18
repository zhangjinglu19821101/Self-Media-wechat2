
const fs = require('fs');

// 读取文件
const filePath = '/workspace/projects/src/lib/services/subtask-execution-engine.ts';
const content = fs.readFileSync(filePath, 'utf-8');

// 旧方法内容
const oldMethod = `  /**
   * ========== 执行Agent职责 ==========
   * 接收任务，从 pending 开始
   * 更新状态为 in_progress
   * 尽力尝试独立完成任务
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
      .where(eq(agentSubTasks.id, task.id);

    try {
      console.log('[SubtaskEngine] 执行Agent: 开始处理任务');
      
      const allTasksInGroup = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, task.commandResultId)
        .orderBy(agentSubTasks.orderIndex);
      
      const previousResult = this.getPreviousStepResult(allTasksInGroup, task.orderIndex);
      
      // ==========================================
      // ✅ 核心改动：直接执行，不做能力判定！
      // ==========================================
      console.log('[SubtaskEngine] 执行Agent: 直接执行任务（跳过能力判定）');
      const executorResult = await this.callExecutorAgentDirectly(task, previousResult);
      console.log('[SubtaskEngine] 执行Agent执行结果:', executorResult);


      
      // 2. 如果判定任务可以直接完成，则真正执行任务
      if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
        console.log('[SubtaskEngine] 任务可直接完成，调用执行Agent真正执行任务');
        const directResult = await this.callExecutorAgentDirectly(task, previousResult);
        console.log('[SubtaskEngine] 执行Agent直接执行结果:', directResult);
        
        if (directResult.isCompleted) {
          finalExecutionResult = directResult.result;
        } else {
          // 如果直接执行失败，则降级为需要帮助
          console.log('[SubtaskEngine] 执行Agent直接执行失败，降级为需要帮助');
          capabilityCheckResult.isNeedMcp = true;
          capabilityCheckResult.isTaskDown = false;
          capabilityCheckResult.problem = directResult.suggestion || '执行Agent无法完成任务');
        }
      }

      // 3. 保存结果到数据库
      // ✅ 修复：根据不同情况保存不同的结果
      let resultToSave: any;
      if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
        // 任务完成：保存最终结果
        resultToSave = finalExecutionResult;
        console.log('[SubtaskEngine] 保存任务完成结果:', resultToSave);
      } else {
        // 需要帮助：保存 capabilityCheckResult！
        resultToSave = capabilityCheckResult;
        console.log('[SubtaskEngine] 保存需要帮助结果:', resultToSave);
      }

      await db
        .update(agentSubTasks)
        .set({
          executionResult: JSON.stringify(resultToSave),
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id);

      // 4. 更新状态
      if (!capabilityCheckResult.isNeedMcp &amp;&amp; capabilityCheckResult.isTaskDown) {
        console.log('[SubtaskEngine] 执行Agent: 任务完成 → pre_completed');
        await db
          .update(agentSubTasks)
          .set({
            status: 'pre_completed',
            updatedAt: getCurrentBeijingTime(),
          })
          .where(eq(agentSubTasks.id, task.id);
      } else {
        console.log('[SubtaskEngine] 执行Agent: 需要帮助 → pre_need_support');
        await db
          .update(agentSubTasks)
          .set({
            status: 'pre_need_support',
            updatedAt: getCurrentBeijingTime(),
          })
          .where(eq(agentSubTasks.id, task.id);
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
  }`;

// 新方法内容
const newMethod = `  /**
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
        .where(eq(agentSubTasks.commandResultId, task.commandResultId)
        .orderBy(agentSubTasks.orderIndex));
      
      const previousResult = this.getPreviousStepResult(allTasksInGroup, task.orderIndex));
      
      // ==========================================
      // ✅ 核心改动：直接执行，不做能力判定！
      // ==========================================
      console.log('[SubtaskEngine] 执行Agent: 直接执行任务（跳过能力判定）');
      const executorResult = await this.callExecutorAgentDirectly(task, previousResult));
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
          updatedAt: getCurrentBeijingTime()),
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
            updatedAt: getCurrentBeijingTime()),
          })
          .where(eq(agentSubTasks.id, task.id));
      } else {
        console.log('[SubtaskEngine] 执行Agent: 需要帮助 → pre_need_support');
        await db
          .update(agentSubTasks)
          .set({
            status: 'pre_need_support',
            updatedAt: getCurrentBeijingTime()),
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
          updatedAt: getCurrentBeijingTime()),
        })
        .where(eq(agentSubTasks.id, task.id));
    }
  }`;

// 替换
if (content.includes(oldMethod)) {
  const newContent = content.replace(oldMethod, newMethod);
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log('✅ 方法替换成功！');
  
  // 验证一下
  const verifyContent = fs.readFileSync(filePath, 'utf-8');
  if (verifyContent.includes(newMethod)) {
    console.log('✅ 验证成功：新方法已写入');
  } else {
    console.log('❌ 验证失败：新方法未找到');
  }
} else {
  console.log('❌ 未找到旧方法，尝试用更灵活的方式...');
  
  // 尝试用更灵活的方式 - 用正则匹配
  const lines = content.split('\\n');
  let startLine = -1;
  let endLine = -1;
  let bracketCount = 0;
  let inMethod = false;
  
  for (let i = 0; i &lt; lines.length; i++) {
    if (lines[i].includes('executeExecutorAgentWorkflow') &amp;&amp; lines[i].includes('private async')) {
      startLine = i;
      inMethod = true;
      bracketCount = 0;
    }
    
    if (inMethod) {
      for (const char of lines[i]) {
        if (char === '{') bracketCount++;
        if (char === '}') bracketCount--;
      }
      
      if (bracketCount === 0 &amp;&amp; startLine !== -1 &amp;&amp; i &gt; startLine) {
        endLine = i;
        break;
      }
    }
  }
  
  if (startLine !== -1 &amp;&amp; endLine !== -1) {
    console.log(`找到方法：行 ${startLine} - ${endLine}`);
    const before = lines.slice(0, startLine).join('\\n');
    const after = lines.slice(endLine + 1).join('\\n');
    const newContent = before + '\\n' + newMethod + '\\n' + after;
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log('✅ 方法替换成功！');
  } else {
    console.log('❌ 仍然失败，请手动修改');
  }
}

