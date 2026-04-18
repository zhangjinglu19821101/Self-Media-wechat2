/**
 * POST /api/agents/b/async-create-task
 * 异步创建任务（两阶段模式 - 第一阶段：创作）
 * 
 * 【第一阶段：创作】只创建 1 个固定子任务：
 *   1. insurance-d 生成完整文章（一次性）
 *   用户编辑确认后，通过 split-publish API 触发第二阶段（发布）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { randomUUID } from 'crypto';

interface CreateTaskParams {
  taskTitle?: string;
  instruction: string;
  userOpinion?: string;
  materialIds?: string[];
  relatedMaterials?: string[];
  keyMaterials?: string[];
}

export async function POST(request: NextRequest) {
  const tempSessionId = crypto.randomUUID();
  
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body: CreateTaskParams = await request.json();
    const { taskTitle, instruction, userOpinion, materialIds = [], relatedMaterials = [], keyMaterials = [] } = body;

    console.log(`\n🚀 [Async-Create] 开始异步创建任务（简化模式）`);
    console.log(`   指令长度: ${instruction.length}`);
    console.log(`   用户观点: ${userOpinion ? '有' : '无'}`);
    console.log(`   素材数量: ${materialIds.length}`);
    console.log(`   关联素材: ${relatedMaterials.length}`);
    console.log(`   核心素材: ${keyMaterials.length}`);

    if (!instruction || instruction.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '指令不能为空' },
        { status: 400 }
      );
    }

    // 🔥 第一阶段（创作）：固定只创建1个子任务，不调用 AI 拆解
    // 用户确认文章后，通过 /api/agents/b/split-publish 触发第二阶段（发布流程）
    const phase1SubTasks = [
      {
        title: '生成完整文章',
        description: buildInsuranceDTaskDescription(instruction, userOpinion),
        executor: 'insurance-d',
        orderIndex: 1,
      },
    ];

    console.log(`✅ [Async-Create] 第一阶段（创作模式）：生成 ${phase1SubTasks.length} 个子任务`);
    for (const st of phase1SubTasks) {
      console.log(`   #${st.orderIndex} [${st.executor}] ${st.title}`);
    }

    // 调用 simple-split API 创建子任务（使用完整URL）
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';
    const splitResponse = await fetch(`${baseUrl}/api/agents/b/simple-split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskTitle: taskTitle || instruction.slice(0, 50),
        instruction,
        subTasks: phase1SubTasks,
        userOpinion,
        materialIds,
        relatedMaterials,
        keyMaterials,
        tempSessionId,
      }),
    });

    const splitData = await splitResponse.json();

    if (!splitData.success) {
      console.error(`❌ [Async-Create] simple-split 失败:`, splitData.error);
      throw new Error(splitData.error || '创建子任务失败');
    }

    console.log(`✅ [Async-Create] 子任务创建成功`);
    console.log(`   commandResultId: ${splitData.data?.commandResultId}`);

    // 立即返回成功响应
    const response = NextResponse.json({
      success: true,
      data: { 
        tempSessionId, 
        status: 'pending_split',
        commandResultId: splitData.data?.commandResultId,
        message: '任务已创建（第一阶段：insurance-d 生成文章，用户确认后触发第二阶段发布流程）',
      },
    });

    // 后台异步执行（触发子任务执行引擎）
    executeAsyncTask({
      commandResultId: splitData.data?.commandResultId,
      instruction,
      userOpinion,
      materialIds,
    }).catch(error => {
      console.error('❌ [Async-Create] 后台执行失败:', error);
    });

    return response;

  } catch (error: any) {
    console.error('❌ [Async-Create] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '创建任务失败' },
      { status: 500 }
    );
  }
}

/**
 * 构建 insurance-d 的任务描述（包含用户观点和素材信息）
 * 第一阶段：创作 - 一次性生成完整文章
 */
function buildInsuranceDTaskDescription(instruction: string, userOpinion?: string): string {
  let desc = `【第一阶段：创作】请根据以下要求，一次性生成完整的保险科普文章。\n\n`;
  desc += `## 原始创作指令\n${instruction}\n`;
  
  if (userOpinion) {
    desc += `\n## 用户核心观点（必须遵守）\n${userOpinion}\n`;
  }
  
  desc += `\n## 创作要求\n`;
  desc += `- 字数：2000-2500字\n`;
  desc += `- 格式：HTML格式，适合微信公众号发布\n`;
  desc += `- 风格：专业但不晦涩，通俗易懂\n`;
  desc += `- 结构：包含开篇案例、核心观点、数据支撑、结尾总结\n`;
  desc += `- **一次性输出完整文章，不要分章节拆解**\n`;
  desc += `- **输出后等待用户编辑确认，确认后将进入第二阶段（合规校验+发布流程）**\n`;
  
  return desc;
}

/**
 * 后台异步执行：触发子任务执行引擎
 */
async function executeAsyncTask(params: {
  commandResultId?: string;
  instruction: string;
  userOpinion?: string;
  materialIds?: string[];
}) {
  try {
    console.log(`⏳ [Async-Execute] 开始后台执行...`);
    
    // 延迟一下让主响应先返回
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 触发子任务执行（通过调用执行引擎的API或内部方法）
    // 这里简单记录日志，实际执行由 SubtaskExecutionEngine 负责
    console.log(`✅ [Async-Execute] 任务已提交给执行引擎`);
    
  } catch (error) {
    console.error('❌ [Async-Execute] 执行错误:', error);
  }
}
