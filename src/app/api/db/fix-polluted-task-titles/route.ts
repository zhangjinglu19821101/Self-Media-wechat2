/**
 * GET /api/db/fix-polluted-task-titles
 * 
 * 修复 syncArticleTitleToGroup 导致的标题污染问题：
 * 同 commandResultId 的所有子任务被覆盖为文章标题，导致
 * "生成创作大纲"、"合规校验"等原始标题丢失。
 * 
 * 修复策略：
 * 1. 找出同一 commandResultId 内所有子任务标题相同的组（被污染的标志）
 * 2. 根据每个子任务的 fromParentsExecutor + orderIndex 恢复默认标题
 * 3. 仅恢复非写作类子任务的原始标题，写作类子任务保留 articleTitle
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm';

/**
 * 根据 executor + orderIndex + taskDescription 推断原始标题
 * 优先使用 taskDescription 中的关键信息，但保持标题简洁
 */
function inferOriginalTitle(executor: string, orderIndex: number, taskDescription: string | null): string | null {
  // 写作类子任务的标题可能是文章标题，不需要恢复
  if (isWritingAgent(executor)) {
    return null;
  }

  // 尝试从 taskDescription 提取简洁标题
  if (taskDescription && taskDescription.trim().length > 0) {
    const desc = taskDescription.trim();

    // 尝试匹配 "任务目标：XXX" 模式
    const goalMatch = desc.match(/任务目标[：:]\s*([^\n。；;]{2,30})/);
    if (goalMatch) {
      return goalMatch[1].trim();
    }

    // 尝试提取简短的命令式标题（4-25字，中文为主）
    const shortMatch = desc.match(/^([\u4e00-\u9fa5a-zA-Z0-9\s，、]{4,25})/);
    if (shortMatch) {
      const candidate = shortMatch[1].trim()
        .replace(/^【[^】]*】\s*/, '')
        .replace(/^#+\s*/, '')
        .replace(/^请\s*/, '')
        .trim();
      if (candidate.length >= 4 && candidate.length <= 25) {
        return candidate;
      }
    }
  }

  // 回退：根据 executor + orderIndex 推断
  if (executor === 'B' || executor === 'insurance-b') {
    if (orderIndex === 1) return '分析任务需求';
    if (orderIndex === 2) return '合规校验';
    if (orderIndex === 3) return '用户确认';
    if (orderIndex === 4) return '最终审核';
    return `协调任务 #${orderIndex}`;
  }

  if (executor === 'agent T' || executor === 'T') {
    if (orderIndex === 1) return 'MCP 技术执行';
    return `技术任务 #${orderIndex}`;
  }

  if (executor === 'insurance-c') {
    if (orderIndex === 1) return '运营执行';
    return `运营任务 #${orderIndex}`;
  }

  return null;
}

/**
 * 判断一个标题是否看起来像"文章标题"而非"功能标题"
 * 文章标题特征：包含具体话题/观点/数字，不包含动词性指令
 * 功能标题特征：短、含动词、描述任务类型
 */
function looksLikeArticleTitle(title: string): boolean {
  if (!title || title.length <= 4) return false;

  // 功能性标题关键词（如果包含这些，大概率是功能标题而非文章标题）
  const functionalKeywords = [
    '校验', '审核', '确认', '大纲', '初稿', '全文', '执行', '分析',
    '生成', '修改', '优化', '调整', '完善', '润色', '发布', '上传',
    '评估', '审查', '检查', '整改', '创建', '拆解', '协调',
  ];
  
  // 如果标题较短且包含功能性关键词，不太可能是文章标题
  if (title.length <= 15 && functionalKeywords.some(k => title.includes(k))) {
    return false;
  }

  // 文章标题特征：包含书名号、问号、引号、感叹号、具体数字
  const articlePatterns = [
    /[《》]/,          // 书名号
    /[？?！!]/,        // 问号/感叹号
    /[""''""]/,       // 引号
    /\d+万/,          // 金额数字
    /\d+个/,          // 数量词
    /\d+大/,          // 排名
    /别踩/,           // 警示性标题
    /真相/,           // 揭秘性标题
    /纠结/,           // 情感标题
    /坑/,             // 避坑标题
  ];

  return articlePatterns.some(p => p.test(title));
}

export async function GET() {
  try {
    console.log('[FixPollutedTitles] 🔧 开始修复被污染的子任务标题...');

    // 1. 查找所有已完成的子任务，按 commandResultId 分组
    const allTasks = await db
      .select({
        id: agentSubTasks.id,
        commandResultId: agentSubTasks.commandResultId,
        taskTitle: agentSubTasks.taskTitle,
        fromParentsExecutor: agentSubTasks.fromParentsExecutor,
        orderIndex: agentSubTasks.orderIndex,
        status: agentSubTasks.status,
        taskDescription: agentSubTasks.taskDescription,
      })
      .from(agentSubTasks)
      .where(isNotNull(agentSubTasks.commandResultId))
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(500);

    // 2. 按 commandResultId 分组
    const groups: Record<string, typeof allTasks> = {};
    for (const task of allTasks) {
      const key = task.commandResultId || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    }

    let fixedCount = 0;
    const fixedDetails: string[] = [];

    for (const [commandResultId, tasks] of Object.entries(groups)) {
      if (tasks.length < 2) continue; // 只有一个子任务的组无需修复

      // 改进的污染检测：
      // 非写作类子任务（B/T/C等）的标题看起来像文章标题，说明被 syncArticleTitleToGroup 污染
      let polluted = false;
      for (const task of tasks) {
        const isWritingExecutor = isWritingAgent(task.fromParentsExecutor);
        if (!isWritingExecutor && task.taskTitle && looksLikeArticleTitle(task.taskTitle)) {
          polluted = true;
          break;
        }
      }

      // 兼容旧检测：同组内标题完全相同的任务数 > 1（可能标题不含文章特征但确实是同步过来的）
      if (!polluted) {
        const titleCounts: Record<string, number> = {};
        for (const task of tasks) {
          const t = task.taskTitle || '';
          titleCounts[t] = (titleCounts[t] || 0) + 1;
        }
        // 只有多于1个非写作类子任务标题相同时才认为被污染
        const nonWritingDuplicates = Object.entries(titleCounts).some(([title, count]) => {
          if (count <= 1) return false;
          // 检查这个标题是否属于非写作类子任务
          return tasks.some(t => t.taskTitle === title && t.fromParentsExecutor !== 'insurance-d' && t.fromParentsExecutor !== 'insurance-xiaohongshu');
        });
        if (!nonWritingDuplicates) continue;
      }

      // 3. 对被污染的组进行修复
      for (const task of tasks) {
        // 写作类子任务保留文章标题（不恢复）
        if (isWritingAgent(task.fromParentsExecutor)) {
          continue;
        }

        // 尝试推断原始标题
        const originalTitle = inferOriginalTitle(task.fromParentsExecutor, task.orderIndex, task.taskDescription);
        if (!originalTitle) continue;

        // 如果当前标题和推断的原始标题不同，说明被污染了
        if (task.taskTitle !== originalTitle) {
          await db
            .update(agentSubTasks)
            .set({ taskTitle: originalTitle })
            .where(eq(agentSubTasks.id, task.id));

          fixedCount++;
          fixedDetails.push(
            `${commandResultId.slice(0, 8)}: ${task.fromParentsExecutor}#${task.orderIndex} "${task.taskTitle}" → "${originalTitle}"`
          );
        }
      }
    }

    console.log(`[FixPollutedTitles] ✅ 修复完成，共修复 ${fixedCount} 条记录`);

    return NextResponse.json({
      success: true,
      totalGroups: Object.keys(groups).length,
      pollutedGroups: Object.entries(groups).filter(([, tasks]) => {
        // 检测方法1：非写作类子任务标题看起来像文章标题
        for (const task of tasks) {
          const isWritingExecutor = isWritingAgent(task.fromParentsExecutor);
          if (!isWritingExecutor && task.taskTitle && looksLikeArticleTitle(task.taskTitle)) {
            return true;
          }
        }
        // 检测方法2：非写作类子任务标题重复
        const titleCounts: Record<string, number> = {};
        for (const task of tasks) {
          const t = task.taskTitle || '';
          titleCounts[t] = (titleCounts[t] || 0) + 1;
        }
        return Object.entries(titleCounts).some(([title, count]) => {
          if (count <= 1) return false;
          return tasks.some(t => t.taskTitle === title && t.fromParentsExecutor !== 'insurance-d' && t.fromParentsExecutor !== 'insurance-xiaohongshu');
        });
      }).length,
      fixedCount,
      details: fixedDetails.slice(0, 20), // 只返回前20条详情
    });

  } catch (error) {
    console.error('[FixPollutedTitles] ❌ 修复失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
