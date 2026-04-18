/**
 * POST /api/agents/b/split-publish
 * 第二阶段：发布流程拆解
 * 
 * 当用户在第一阶段（创作）确认文章后，调用此 API 触发第二阶段（发布）
 * 
 * 【第二阶段：发布】Agent B 自动拆解为多个子任务：
 *   #2 [Agent T] 合规内容评审（技术工作）
 *   #3 [insurance-d] 依据合规整改（如需要）
 *   #4 [formatter] 格式化适配公众号样式
 *   #5 [uploader] 上传至微信公众号
 *   #6 [Agent B] 确认发布结果
 * 
 * 关键设计：
 * - 所有第二阶段子任务共享同一个 commandResultId（与第一阶段相同）
 * - 文章内容存储在第一阶段 insurance-d 子任务的 resultText 中
 * - 第二阶段子任务通过 commandResultId 查询获取文章内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, sql, max } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface SplitPublishParams {
  commandResultId: string;  // 第一阶段的 commandResultId
  articleContent?: string;  // 用户最终确认的文章内容（可选，不传则从数据库读取）
  wechatAccountId?: string; // 公众号账号ID（可选）
}

// 🔥 定义 TaskMetadata 类型，避免 any 类型滥用
interface TaskMetadata {
  source?: string;
  phase?: 'creation' | 'publishing' | 'creation_completed';
  tempSessionId?: string;
  originalTaskTitle?: string;
  originalTaskDescription?: string;
  userConfirmedPublishAt?: string;
  confirmedArticleContent?: string;
  confirmedArticleLength?: number;
  articleContentLength?: number;
  wechatAccountId?: string | null;
  confirmedArticleAt?: string;
  [key: string]: unknown; // 允许其他字段
}

/**
 * 第二阶段固定子任务定义
 * orderIndex 从 2 开始（#1 是第一阶段的 insurance-d 生成文章）
 */
const PHASE_2_SUBTASKS = [
  {
    title: '合规内容评审',
    executor: 'T',  // Agent T - 技术专家，负责合规校验
    descriptionTemplate: (articlePreview: string) => 
      `【第二阶段：发布 - 步骤1/4】\n\n## 任务目标\n对以下文章进行合规性内容评审。\n\n## 待审文章（前2000字）\n${articlePreview.slice(0, 2000)}${articlePreview.length > 2000 ? '\n...(文章较长，请通过系统获取完整内容)' : ''}\n\n## 评审要点\n1. **法律法规**：是否违反保险相关法规、广告法等\n2. **平台规则**：是否符合微信公众号发布规范\n3. **事实准确性**：数据、案例、引用是否准确无误\n4. **敏感词检测**：是否存在违规敏感词汇\n5. **版权风险**：是否有侵权风险\n\n## 输出要求\n- 返回 JSON 格式的评审结果：\n{\n  "passed": true/false,\n  "issues": ["问题描述1", ...],\n  "suggestions": ["修改建议1", ...],\n  "riskLevel": "low/medium/high",\n  "summary": "总体评价"\n}`,
    orderIndex: 2,
  },
  {
    title: '依据合规整改',
    executor: 'insurance-d',
    descriptionTemplate: (articlePreview: string) => 
      `【第二阶段：发布 - 步骤2/4】\n\n## 任务目标\n根据 Agent T 的合规评审结果，对文章进行整改。\n\n## 原始文章\n（请从系统获取第一阶段 insurance-d 生成的原始文章）\n\n## 整改要求\n- 如果评审通过（passed=true）：保持原文不变，直接输出原文\n- 如果评审未通过：根据 issues 和 suggestions 逐一修改\n- 保持文章的核心观点和风格不变\n- 整改后的文章仍需符合公众号发布格式`,
    orderIndex: 3,
  },
  {
    title: '格式化适配公众号',
    executor: 'formatter',
    descriptionTemplate: (articlePreview: string) => 
      `【第二阶段：发布 - 步骤3/4】\n\n## 任务目标\n将整改后的文章格式化为微信公众号发布格式。\n\n## 格式化要求\n1. 标题优化：吸引眼球但不过度标题党\n2. 排版美化：合适的段落间距、重点加粗\n3. 配图建议：建议配图位置和类型\n4. 摘要生成：生成适合分享的摘要文字\n5. 标签建议：推荐文章标签`,
    orderIndex: 4,
  },
  {
    title: '上传至微信公众号',
    executor: 'uploader',
    descriptionTemplate: (articlePreview: string) => 
      `【第二阶段：发布 - 步骤4/4】\n\n## 任务目标\n将格式化后的文章上传至微信公众号草稿箱。\n\n## 上传步骤\n1. 调用微信公众号 API 创建草稿\n2. 设置正确的标题、作者、摘要\n3. 上传封面图片\n4. 确认排版效果\n5. 返回草稿URL和状态`,
    orderIndex: 5,
  },
];

export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body: SplitPublishParams = await request.json();
    const { commandResultId, articleContent, wechatAccountId } = body;

    console.log(`\n🚀 [Split-Publish] 开始第二阶段拆解（发布流程）`);
    console.log(`   commandResultId: ${commandResultId}`);
    console.log(`   提供文章内容: ${articleContent ? '有 (' + articleContent.length + '字)' : '无（将从数据库读取）'}`);

    // ====== 1. 验证参数 ======
    if (!commandResultId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：commandResultId' },
        { status: 400 }
      );
    }

    // ====== 2. 查询第一阶段的子任务，确认存在且已完成 ======
    const phase1Tasks = await db
      .select({
        id: agentSubTasks.id,
        taskTitle: agentSubTasks.taskTitle,
        status: agentSubTasks.status,
        orderIndex: agentSubTasks.orderIndex,
        resultText: agentSubTasks.resultText,
        fromParentsExecutor: agentSubTasks.fromParentsExecutor,
        metadata: agentSubTasks.metadata,
      })
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, commandResultId));

    if (!phase1Tasks || phase1Tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到对应的第一阶段任务，请检查 commandResultId' },
        { status: 404 }
      );
    }

    console.log(`[Split-Publish] 找到 ${phase1Tasks.length} 个第一阶段子任务`);

    // 找到写作类 Agent 的任务（orderIndex=1），获取文章内容
    const writingTask = phase1Tasks.find(t => 
      isWritingAgent(t.fromParentsExecutor)
      && t.orderIndex === 1
    );
    
    if (!writingTask) {
      return NextResponse.json(
        { success: false, error: '未找到第一阶段的写作 Agent 生成文章任务' },
        { status: 400 }
      );
    }

    // 确定最终使用的文章内容
    const finalArticleContent = articleContent || writingTask.resultText || '';
    
    if (!finalArticleContent) {
      return NextResponse.json(
        { success: false, error: '无法获取文章内容，请确保第一阶段已生成文章或手动提供内容' },
        { status: 400 }
      );
    }

    console.log(`[Split-Publish] 文章内容长度: ${finalArticleContent.length} 字符`);
    console.log(`[Split-Publish] 来源: ${articleContent ? '用户提供' : '数据库（insurance-d 生成）'}`);

    // ====== 3. 检查是否已经创建过第二阶段子任务（防止重复创建）=====
    const existingPhase2Tasks = phase1Tasks.filter(t => t.orderIndex >= 2);
    if (existingPhase2Tasks.length > 0) {
      console.log(`[Split-Publish] 已存在 ${existingPhase2Tasks.length} 个第二阶段子任务，跳过重复创建`);
      return NextResponse.json({
        success: true,
        message: '第二阶段子任务已存在',
        data: {
          existingTaskCount: existingPhase2Tasks.length,
          subTasks: existingPhase2Tasks.map(t => ({
            id: t.id,
            title: t.taskTitle,
            executor: t.fromParentsExecutor,
            orderIndex: t.orderIndex,
            status: t.status,
          })),
        },
      });
    }

    // ====== 4. 将用户确认的文章内容存储到元数据中（供后续任务使用）======
    // 更新第一阶段 insurance-d 任务的状态标记为"已确认发布"
    const existingMetadata = (writingTask.metadata || {}) as TaskMetadata;
    await db
      .update(agentSubTasks)
      .set({
        metadata: {
          ...existingMetadata,
          phase: 'creation_completed', // 标记第一阶段完成
          userConfirmedPublishAt: new Date().toISOString(),
          confirmedArticleContent: finalArticleContent, // 存储用户最终确认的文章
          confirmedArticleLength: finalArticleContent.length,
        } as TaskMetadata,
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, writingTask.id));

    console.log(`[Split-Publish] 已更新第一阶段任务状态为"已确认发布"`);

    // ====== 5. 创建第二阶段子任务（批量插入优化）======
    const phase2TaskValues = PHASE_2_SUBTASKS.map(subTaskDef => ({
      id: uuidv4(),
      commandResultId: commandResultId, // 🔥 关键：使用相同的 commandResultId！
      fromParentsExecutor: subTaskDef.executor,
      taskTitle: subTaskDef.title,
      taskDescription: subTaskDef.descriptionTemplate(finalArticleContent),
      status: 'pending',
      orderIndex: subTaskDef.orderIndex,
      executionDate: new Date().toISOString().split('T')[0],
      // 🔥 Phase 6 多用户：从认证上下文继承 workspaceId
      workspaceId: authResult.workspaceId,
      // 🔥 将文章内容存入 userOpinion 字段，供第二阶段任务使用
      userOpinion: `[第二阶段-待发布文章]\n${finalArticleContent}`,
      metadata: {
        source: 'agent-b-split-publish',
        phase: 'publishing' as const, // 🔥 标记为第二阶段：发布
        phase1TaskId: writingTask.id, // 关联第一阶段的文章任务
        confirmedArticleAt: new Date().toISOString(),
        articleContentLength: finalArticleContent.length,
        wechatAccountId: wechatAccountId || null,
      } as TaskMetadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const insertedPhase2Tasks = await db.insert(agentSubTasks).values(phase2TaskValues).returning();

    console.log(`[Split-Publish] 第二阶段拆解完成，批量创建 ${insertedPhase2Tasks.length} 个子任务`);

    // ====== 6. 返回成功响应 ======
    return NextResponse.json({
      success: true,
      message: `第二阶段（发布流程）拆解成功，已创建 ${insertedPhase2Tasks.length} 个子任务`,
      data: {
        commandResultId,
        phase: 'publishing',
        articleContentLength: finalArticleContent.length,
        insertedCount: insertedPhase2Tasks.length,
        subTasks: insertedPhase2Tasks.map(t => ({
          id: t.id,
          title: t.taskTitle,
          executor: t.fromParentsExecutor,
          orderIndex: t.orderIndex,
          status: t.status,
        })),
        workflow: [
          { step: 1, name: '✅ 创作完成', status: 'done', agent: 'insurance-d + 用户' },
          { step: 2, name: '合规内容评审', status: 'pending', agent: 'Agent T' },
          { step: 3, name: '依据合规整改', status: 'pending', agent: 'insurance-d' },
          { step: 4, name: '格式化适配公众号', status: 'pending', agent: 'formatter' },
          { step: 5, name: '上传至微信公众号', status: 'pending', agent: 'uploader' },
        ],
      },
    });

  } catch (error: unknown) {
    console.error('❌ [Split-Publish] Error:', error);
    // 🔥 安全处理：不直接暴露内部错误信息
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, error: process.env.NODE_ENV === 'development' ? errorMessage : '第二阶段拆解失败，请稍后重试' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/b/split-publish
 * 查询某个 commandResultId 的当前阶段状态
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId');

    if (!commandResultId) {
      return NextResponse.json(
        { success: false, error: '缺少参数：commandResultId' },
        { status: 400 }
      );
    }

    // 查询所有关联的子任务
    const allTasks = await db
      .select({
        id: agentSubTasks.id,
        taskTitle: agentSubTasks.taskTitle,
        fromParentsExecutor: agentSubTasks.fromParentsExecutor,
        status: agentSubTasks.status,
        orderIndex: agentSubTasks.orderIndex,
        resultText: agentSubTasks.resultText,
        metadata: agentSubTasks.metadata,
        createdAt: agentSubTasks.createdAt,
        completedAt: agentSubTasks.completedAt,
      })
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, commandResultId))
      .orderBy(agentSubTasks.orderIndex);

    if (!allTasks || allTasks.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到相关任务' },
        { status: 404 }
      );
    }

    // 判断当前阶段
    const phase1Tasks = allTasks.filter(t => t.orderIndex === 1);
    const phase2Tasks = allTasks.filter(t => t.orderIndex >= 2);

    let currentPhase: 'creation' | 'publishing' | 'completed' = 'creation';
    if (phase2Tasks.length > 0) {
      const allPhase2Done = phase2Tasks.every(t => t.status === 'completed');
      currentPhase = allPhase2Done ? 'completed' : 'publishing';
    }

    // 获取文章内容（从写作 Agent 任务或 metadata 中）
    const articleTask = phase1Tasks.find(t => 
      isWritingAgent(t.fromParentsExecutor)
    );
    const metadata = articleTask?.metadata as Record<string, any> | null;
    const articleContent = metadata?.confirmedArticleContent || articleTask?.resultText || '';

    return NextResponse.json({
      success: true,
      data: {
        commandResultId,
        currentPhase,
        articleContentLength: articleContent.length,
        phase1: {
          tasks: phase1Tasks.map(t => ({
            id: t.id,
            title: t.taskTitle,
            executor: t.fromParentsExecutor,
            status: t.status,
            hasArticle: !!t.resultText,
          })),
          completed: phase1Tasks.some(t => t.status === 'completed'),
        },
        phase2: {
          tasks: phase2Tasks.map(t => ({
            id: t.id,
            title: t.taskTitle,
            executor: t.fromParentsExecutor,
            status: t.status,
            orderIndex: t.orderIndex,
          })),
          exists: phase2Tasks.length > 0,
          completedCount: phase2Tasks.filter(t => t.status === 'completed').length,
          totalCount: phase2Tasks.length,
        },
        allTasks: allTasks.map(t => ({
          id: t.id,
          title: t.taskTitle,
          executor: t.fromParentsExecutor,
          status: t.status,
          orderIndex: t.orderIndex,
        })),
      },
    });

  } catch (error: unknown) {
    console.error('❌ [Split-Publish GET] Error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, error: process.env.NODE_ENV === 'development' ? errorMessage : '查询失败，请稍后重试' },
      { status: 500 }
    );
  }
}
