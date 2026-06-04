/**
 * Agent B 简化拆解 API
 * 只创建子任务到 agent_sub_tasks 表，不再创建 daily_task 表
 * 2026-04-05 修改：移除 daily_task 关联
 * 2026-04-14 修改：支持多平台发布（独立 commandResultId 模式）
 * 2026-04-20 修改：支持平台独立流程模板
 * 2026-05-01 修改：移除 useFlowTemplate 开关，改为数据特征判断 + 流程模板兜底
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { platformAccounts, PLATFORM_LABELS } from '@/lib/db/schema/style-template';
import { v4 as uuidv4 } from 'uuid';
import { sql, eq } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { getFlowTemplate, SubTaskTemplate, splitBaseAndAdaptationGroups, getAdaptationSteps, isBaseArticlePlatform, getDirectPublishTemplate, getDirectPublishAdaptationSteps, getOutlineCreationTemplate, getOutlineCreationAdaptationSteps } from '@/lib/agents/flow-templates';
import { getExecutorForPlatform, isWritingAgent } from '@/lib/agents/agent-registry';

/**
 * 根据平台和原始 executor 决定最终写作 Agent
 * 
 * 逻辑：
 * 1. 非写作 Agent → 直接返回原 executor（不做平台路由）
 * 2. 写作 Agent → 使用 agent-registry 的 getExecutorForPlatform 映射
 */
function resolveExecutorForPlatform(platform: string, originalExecutor: string): string {
  if (!isWritingAgent(originalExecutor)) return originalExecutor;
  return getExecutorForPlatform(platform, originalExecutor);
}

/**
 * 查询账号的平台信息
 */
async function getAccountInfo(accountId: string): Promise<{
  platform: string;
  platformLabel: string;
  accountName: string;
}> {
  try {
    const [account] = await db
      .select()
      .from(platformAccounts)
      .where(eq(platformAccounts.id, accountId))
      .limit(1);

    return {
      platform: account?.platform || 'wechat_official',
      platformLabel: (PLATFORM_LABELS as Record<string, string>)[account?.platform || ''] || account?.platform || '微信公众号',
      accountName: account?.accountName || '未知账号',
    };
  } catch (error) {
    console.warn('[simple-split] 获取账号信息失败:', error);
    return {
      platform: 'wechat_official',
      platformLabel: '微信公众号',
      accountName: '未知账号',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const {
      taskTitle,
      taskDescription,
      executionDate,
      subTasks,
      tempSessionId, // 临时会话 ID，用于替换逻辑
      userOpinion, // 🔥 用户观点（仅创作引导结构化内容：核心观点+情感基调+文章结构）
      originalInstruction, // 🔥 用户原始指令（独立存储，不传给 insurance-d）
      articleOutline, // 🔥 文章框架（用户给定的文章结构，注入insurance-d提示词）
      materialIds, // 🔥 素材ID列表（统一入口，包含案例/数据/故事等所有类型）
      relatedMaterials = '', // 🔥 关联素材补充区内容
      structureName, // 🔥 结构名称
      structureDetail, // 🔥 结构详情（JSON字符串）
      accountId, // 🔥 发布账号ID（兼容单选模式）
      accountIds, // 🔥 多平台发布：选中的账号ID列表
      imageCountMode, // 🔥 小红书图片数量模式（3-card/5-card/7-card）
      contentTemplateId, // 🔥🔥 内容模板ID（Phase 2-1: 图文分工模板）
      articleType, // 🔥 创作类型（myth_busting/analogy/law_regulation/hot_event/standard/product_eval/insurance_guide）
      structuredData, // 🔥 结构化创作引导数据（JSON对象）
      articleLength, // 🔥 Phase 2: 篇幅类型（short/medium/long）
      primaryMaterialId, // 🔥 Phase 2: 主素材ID（产品信息/法规原文等核心素材）
      auxiliaryMaterialIds, // 🔥 Phase 2: 辅素材ID列表（类比/案例/数据等支撑素材）
      paradigmCode, // 🔥 范式代码（如 P001-标准错位破局）
      paradigmName, // 🔥 范式名称（如 标准错位破局范式）
      paradigmDetail, // 🔥 范式详情（JSON字符串，含结构/情绪/素材需求）
      paradigmMaterialBindings, // 🔥 范式-素材位置绑定（slotId → materialId 映射）
      // useFlowTemplate 已移除：步骤来源由数据特征自动判断
      // 前端 subTasks 中包含 accountId 字段 → 使用前端编辑步骤
      // 否则 → 使用流程模板兜底
      mode, // 🔥 创作模式：'creation'(AI创作,默认) | 'direct_publish'(直接发文) | 'outline_creation'(大纲创作)
      articleContent, // 🔥 直接发文模式：用户提供的完整文章内容
      articleTitle, // 🔥 直接发文模式：文章标题
      outlineContent, // 🔥 大纲创作模式：用户提供的文章大纲
    } = body;

    // 🔥🔥🔥 直接发文模式校验
    const isDirectPublishMode = mode === 'direct_publish';
    if (isDirectPublishMode && (!articleContent || articleContent.trim().length < 50)) {
      return NextResponse.json(
        { success: false, error: '直接发文模式必须提供文章内容（至少50字）' },
        { status: 400 }
      );
    }
    if (isDirectPublishMode) {
      console.log(`🔵 [Agent B 简化拆解] 🔥 直接发文模式：用户提供完整文章（${articleContent.length}字，标题: ${articleTitle || '(自动提取)'}）`);
    }

    // 🔥🔥🔥 大纲创作模式校验
    const isOutlineCreationMode = mode === 'outline_creation';
    if (isOutlineCreationMode && (!outlineContent || outlineContent.trim().length < 20)) {
      return NextResponse.json(
        { success: false, error: '大纲创作模式必须提供文章大纲（至少20字）' },
        { status: 400 }
      );
    }
    if (isOutlineCreationMode) {
      console.log(`🔵 [Agent B 简化拆解] 🔥 大纲创作模式：用户提供大纲（${outlineContent.length}字）`);
    }

    // 🔥🔥🔥 转换 paradigmMaterialBindings 格式：前端传 Record<string,string>，后端存储 Array<{slotId,materialId}>
    const normalizedParadigmMaterialBindings: Array<{ slotId: string; materialId: string }> | null =
      paradigmMaterialBindings
        ? (Array.isArray(paradigmMaterialBindings)
          ? paradigmMaterialBindings
          : Object.entries(paradigmMaterialBindings as Record<string, string>).map(([slotId, materialId]) => ({ slotId, materialId }))
        )
        : null;

    // 🔥 统一处理：将 accountId / accountIds 合并为 effectiveAccountIds
    // P1-2 修复：去重 + 过滤空值
    const rawIds: string[] = (accountIds && accountIds.length > 0)
      ? accountIds
      : (accountId ? [accountId] : []);
    const effectiveAccountIds = [...new Set(rawIds.filter((id): id is string => !!id && id.trim() !== ''))];

    if (rawIds.length !== effectiveAccountIds.length) {
      console.warn('[simple-split] accountIds 包含重复或空值，已去重:', rawIds, '→', effectiveAccountIds);
    }

    console.log('🔵 [Agent B 简化拆解] 收到请求:', {
      taskTitle,
      executionDate,
      subTaskCount: subTasks?.length,
      tempSessionId,
      accountCount: effectiveAccountIds.length,
      contentTemplateId: contentTemplateId || '(未选择)', // 🔥🔥 内容模板
      hasParadigmMaterialBindings: !!normalizedParadigmMaterialBindings, // 🔥 范式-素材位置绑定
      hasFrontendSteps: subTasks?.some((st: any) => st.accountId) || false,
      mode: mode || 'creation', // 🔥 创作模式
    });

    // 🔥 步骤来源判断（纯数据特征，无需 useFlowTemplate 开关）：
    // 前端 subTasks 中包含 accountId → 用户编辑过步骤，优先使用
    // 否则 → 使用流程模板兜底
    const hasFrontendSteps = subTasks?.some((st: any) => st.accountId) || false;
    let effectiveSubTasks = subTasks;

    if (hasFrontendSteps) {
      console.log(`🔵 [Agent B 简化拆解] 🔥 检测到前端编辑步骤（含 accountId），优先使用前端步骤`);
    } else if (isDirectPublishMode) {
      // 🔥 直接发文模式：使用直接发文流程模板（跳过分析/写作/去AI化）
      if (effectiveAccountIds.length === 1) {
        const accountInfo = await getAccountInfo(effectiveAccountIds[0]);
        const dpTemplate = getDirectPublishTemplate(accountInfo.platform);
        console.log(`🔵 [Agent B 简化拆解] 🔥 直接发文模式，使用流程模板: ${dpTemplate.name}（平台: ${accountInfo.platform}）`);
        effectiveSubTasks = dpTemplate.steps.map(step => ({
          title: step.title,
          description: step.description,
          executor: step.executor,
          orderIndex: step.orderIndex,
        }));
      } else if (effectiveAccountIds.length > 1) {
        console.log(`🔵 [Agent B 简化拆解] 🔥 直接发文多平台模式，每个平台使用各自的直接发文流程模板`);
        effectiveSubTasks = [];
      }
    } else if (isOutlineCreationMode) {
      // 🔥 大纲创作模式：使用大纲创作流程模板
      if (effectiveAccountIds.length === 1) {
        const accountInfo = await getAccountInfo(effectiveAccountIds[0]);
        const ocTemplate = getOutlineCreationTemplate(accountInfo.platform);
        console.log(`🔵 [Agent B 简化拆解] 🔥 大纲创作模式，使用流程模板: ${ocTemplate.name}（平台: ${accountInfo.platform}）`);
        effectiveSubTasks = ocTemplate.steps.map(step => ({
          title: step.title,
          description: step.description,
          executor: step.executor,
          orderIndex: step.orderIndex,
        }));
      } else if (effectiveAccountIds.length > 1) {
        console.log(`🔵 [Agent B 简化拆解] 🔥 大纲创作多平台模式，每个平台使用各自的大纲创作流程模板`);
        effectiveSubTasks = [];
      }
    } else {
      // 无前端步骤 → 使用流程模板兜底
      if (effectiveAccountIds.length === 1) {
        // 单平台：直接用该平台的流程模板
        const accountInfo = await getAccountInfo(effectiveAccountIds[0]);
        const flowTemplate = getFlowTemplate(accountInfo.platform);
        console.log(`🔵 [Agent B 简化拆解] 🔥 无前端步骤，使用流程模板: ${flowTemplate.name}（平台: ${accountInfo.platform}）`);
        console.log(`🔵 [Agent B 简化拆解] 🔥 模板步骤: ${flowTemplate.steps.map(s => `${s.orderIndex}.[${s.executor}] ${s.title}`).join(' → ')}`);
        effectiveSubTasks = flowTemplate.steps.map(step => ({
          title: step.title,
          description: step.description,
          executor: step.executor,
          orderIndex: step.orderIndex,
        }));
      } else if (effectiveAccountIds.length > 1) {
        // 多平台：在插入循环中为每个平台动态获取流程模板
        console.log(`🔵 [Agent B 简化拆解] 🔥 多平台无前端步骤，每个平台使用各自的流程模板`);
        effectiveSubTasks = [];
      }
    }

    // 验证必填参数
    // 多平台无前端步骤时 effectiveSubTasks 为空是正常的（由循环内动态获取）
    const needsSubTasks = hasFrontendSteps || effectiveAccountIds.length <= 1;
    if (!taskTitle || (needsSubTasks && (!effectiveSubTasks || effectiveSubTasks.length === 0))) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：taskTitle 和 subTasks' },
        { status: 400 }
      );
    }
    // 无前端步骤且无账号时，无法获取流程模板
    if (!hasFrontendSteps && effectiveAccountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '未编辑执行步骤时，必须选择至少一个发布账号（用于加载流程模板）' },
        { status: 400 }
      );
    }

    // 🔥🔥🔥 【修复】从内容模板推导卡片数量模式（统一数据结构，不再需要单独的 imageCountMode）
    // 设计原则：contentTemplateId 是唯一来源，cardCountMode/densityStyle 等信息从模板读取
    // 注意：如果用户手动选择了 imageCountMode（前端传入），也存储到 metadata 供执行引擎使用
    const VALID_CARD_COUNT_MODES = ['3-card', '5-card', '7-card'] as const;
    type CardCountMode = typeof VALID_CARD_COUNT_MODES[number];
    
    let derivedImageCountMode: CardCountMode | undefined = imageCountMode as CardCountMode | undefined;
    // 🔥 P1修复：类型守卫确保 cardCountMode 是有效值
    if (!derivedImageCountMode && contentTemplateId) {
      try {
        const { contentTemplateService } = await import('@/lib/services/content-template-service');
        const contentTemplate = await contentTemplateService.getTemplate(contentTemplateId, workspaceId);
        // 🔥 类型守卫：只有有效的 cardCountMode 才能赋值
        if (contentTemplate?.cardCountMode && VALID_CARD_COUNT_MODES.includes(contentTemplate.cardCountMode as CardCountMode)) {
          derivedImageCountMode = contentTemplate.cardCountMode as CardCountMode;
          console.log(`🔵 [Agent B 简化拆解] 🔥 从内容模板推导 cardCountMode: ${derivedImageCountMode}（模板: ${contentTemplate.name}）`);
        }
      } catch (tplErr) {
        console.warn('[simple-split] ⚠️ 读取内容模板失败:', tplErr);
      }
    }

    // 🔥🔥🔥 批量查询账号平台信息（一次性查询，供 imageCountMode 检测 + splitBaseAndAdaptationGroups 复用）
    // P1-2 修复：消除 N+1 查询，所有账号信息在此处一次性获取
    const allAccountInfos: Array<{ id: string; platform: string; platformLabel: string; accountName: string }> =
      effectiveAccountIds.length > 0
        ? await Promise.all(effectiveAccountIds.map(async accId => {
            const info = await getAccountInfo(accId);
            return { id: accId, ...info };
          }))
        : [];

    // 🔥🔥🔥 【P0修复】为小红书平台设置默认卡片数量模式（5卡详尽）
    // 如果用户没有选择内容模板，且没有手动指定 imageCountMode，默认使用 5 卡详尽模式
    if (!derivedImageCountMode && allAccountInfos.length > 0) {
      const hasXiaohongshuAccount = allAccountInfos.some(acc => acc.platform === 'xiaohongshu');
      if (hasXiaohongshuAccount) {
        derivedImageCountMode = '5-card';
        console.log('🔵 [Agent B 简化拆解] 🔥 小红书平台默认使用 5-card 详尽模式');
      }
    }

    // 1. 如果有临时会话 ID，先删除旧的子任务（替换逻辑）
    if (tempSessionId) {
      console.log('🔵 [Agent B 简化拆解] 替换逻辑：删除旧的子任务，tempSessionId:', tempSessionId);
      const deleteResult = await db
        .delete(agentSubTasks)
        .where(sql`metadata->>'tempSessionId' = ${tempSessionId}`);
      console.log('🔵 [Agent B 简化拆解] 已删除旧的子任务数量:', deleteResult.count);
    }

    // 2. 生成新的临时会话 ID
    const newTempSessionId = uuidv4();
    console.log('🔵 [Agent B 简化拆解] 新的临时会话 ID:', newTempSessionId);

    // 3. 插入子任务到 agent_sub_tasks 表
    const insertedSubTasks = [];
    const platformGroupsInfo: Array<{ accountId: string; platform: string; platformLabel: string; accountName: string; commandResultId: string }> = [];

    // 🔥 判断是否为多平台模式
    const isMultiPlatform = effectiveAccountIds.length > 1;

    if (isMultiPlatform) {
      // ========== 多平台协同模式（两阶段架构） ==========
      // 阶段1：基础文章组（公众号）→ 全部 pending
      // 阶段2：适配组（小红书/知乎/头条等）→ 全部 blocked，基础文章定稿后解锁
      const multiPlatformGroupId = `mpg-${newTempSessionId}`;
      console.log(`🔵 [Agent B 简化拆解] 多平台协同模式：${effectiveAccountIds.length} 个账号，multiPlatformGroupId=${multiPlatformGroupId}`);

      // 分离基础组和适配组（P1-2 修复：使用预查询的账号信息，消除 N+1）
      const { baseAccountId, baseAccountInfo, adaptationAccounts } = splitBaseAndAdaptationGroups(
        allAccountInfos
      );

      if (!baseAccountId || !baseAccountInfo) {
        return NextResponse.json(
          { success: false, error: '多平台模式必须至少选择一个账号作为基础文章组' },
          { status: 400 }
        );
      }

      console.log(`🔵 [Agent B 简化拆解] 基础文章组: ${baseAccountInfo.platformLabel}(${baseAccountInfo.accountName}), accountId=${baseAccountId}`);
      console.log(`🔵 [Agent B 简化拆解] 适配组: ${adaptationAccounts.map(a => `${a.platformLabel}(${a.accountName})`).join(', ')}`);

      // P1-1 修复：使用事务保证多组子任务的原子性
      await db.transaction(async (tx) => {
        // ========== 阶段1：创建基础文章组（pending） ==========
        const baseCommandResultId = uuidv4();
        platformGroupsInfo.push({
          accountId: baseAccountId,
          platform: baseAccountInfo.platform,
          platformLabel: baseAccountInfo.platformLabel,
          accountName: baseAccountInfo.accountName,
          commandResultId: baseCommandResultId,
        });

        // 获取基础文章组的步骤
        let baseSubTasks;
        if (hasFrontendSteps) {
          baseSubTasks = effectiveSubTasks.filter((st: any) => st.accountId === baseAccountId);
          if (baseSubTasks.length === 0) {
            const fallbackTemplate = isDirectPublishMode
              ? getDirectPublishTemplate(baseAccountInfo.platform)
              : isOutlineCreationMode
                ? getOutlineCreationTemplate(baseAccountInfo.platform)
                : getFlowTemplate(baseAccountInfo.platform);
            baseSubTasks = fallbackTemplate.steps.map(step => ({
              title: step.title,
              description: step.description,
              executor: step.executor,
              orderIndex: step.orderIndex,
            }));
            console.log(`🔵 [Agent B 简化拆解] ⚠️ 基础组前端步骤为空，回退到流程模板: ${fallbackTemplate.name}`);
          }
        } else if (isDirectPublishMode) {
          // 🔥 直接发文模式：使用直接发文流程模板
          const dpTemplate = getDirectPublishTemplate(baseAccountInfo.platform);
          baseSubTasks = dpTemplate.steps.map(step => ({
            title: step.title,
            description: step.description,
            executor: step.executor,
            orderIndex: step.orderIndex,
          }));
          console.log(`🔵 [Agent B 简化拆解] 直接发文基础组使用流程模板: ${dpTemplate.name}（${baseSubTasks.length} 步）`);
        } else if (isOutlineCreationMode) {
          // 🔥 大纲创作模式：使用大纲创作流程模板
          const ocTemplate = getOutlineCreationTemplate(baseAccountInfo.platform);
          baseSubTasks = ocTemplate.steps.map(step => ({
            title: step.title,
            description: step.description,
            executor: step.executor,
            orderIndex: step.orderIndex,
          }));
          console.log(`🔵 [Agent B 简化拆解] 大纲创作基础组使用流程模板: ${ocTemplate.name}（${baseSubTasks.length} 步）`);
        } else {
          const flowTemplate = getFlowTemplate(baseAccountInfo.platform);
          baseSubTasks = flowTemplate.steps.map(step => ({
            title: step.title,
            description: step.description,
            executor: step.executor,
            orderIndex: step.orderIndex,
          }));
          console.log(`🔵 [Agent B 简化拆解] 基础组使用流程模板: ${flowTemplate.name}（${baseSubTasks.length} 步）`);
        }

        for (let i = 0; i < baseSubTasks.length; i++) {
          const subTask = baseSubTasks[i];
          const newSubTaskId = uuidv4();

          const taskUserOpinion = subTask.userOpinion !== undefined
            ? subTask.userOpinion
            : (userOpinion || null);
          const taskOriginalInstruction = subTask.originalInstruction !== undefined
            ? subTask.originalInstruction
            : (originalInstruction || null);
          const taskMaterialIds = subTask.materialIds !== undefined
            ? subTask.materialIds
            : (materialIds || []);

          const resolvedExecutor = resolveExecutorForPlatform(baseAccountInfo.platform, subTask.executor);
          // 🔴🔴🔴 统一命名格式：《用户指令摘要》- 平台名称 | 功能性标题
          // 创建时即使用标准格式，写作完成后再更新为《实际文章标题》- 平台名称
          let taskTitleForDb = subTask.title;
          {
            // 从用户原始指令中提取摘要（最长20字）作为初始标题
            const instructionSummary = (taskTitle || '').trim().substring(0, 20);
            const prefix = instructionSummary ? `《${instructionSummary}》- ${baseAccountInfo.platformLabel}` : baseAccountInfo.platformLabel;
            let cleanedTitle = subTask.title
              .replace(/\[微信公众号\]\s*/g, '')
              .replace(/\[小红书\]\s*/g, '')
              .replace(/\[知乎\]\s*/g, '')
              .replace(/\[抖音\]\s*/g, '')
              .replace(/\[微博\]\s*/g, '');
            // 格式：《指令摘要》- 平台名称 | 功能性标题（功能性标题仅在有实际意义时追加）
            taskTitleForDb = cleanedTitle && cleanedTitle !== instructionSummary
              ? `${prefix} | ${cleanedTitle}`
              : prefix;
          }

          const inserted = await tx.insert(agentSubTasks).values({
            id: newSubTaskId,
            commandResultId: baseCommandResultId,
            fromParentsExecutor: resolvedExecutor,
            taskTitle: taskTitleForDb,
            taskDescription: subTask.description || '',
            status: 'pending', // 🔥 基础文章组全部 pending
            orderIndex: subTask.orderIndex || i + 1,
            workspaceId,
            executionDate: executionDate || new Date().toISOString().split('T')[0],
            userOpinion: taskUserOpinion,
            originalInstruction: taskOriginalInstruction, // 🔥 独立存储原始指令
            materialIds: taskMaterialIds,
            relatedMaterials: relatedMaterials || null,
            structureName: subTask.structureName !== undefined ? subTask.structureName : (structureName || null),
            structureDetail: subTask.structureDetail !== undefined ? subTask.structureDetail : (structureDetail || null),
            structuredData: structuredData || null, // 🔥 结构化创作引导数据
            metadata: {
              source: 'agent-b-simple-split',
              phase: isDirectPublishMode ? 'direct_publish' : isOutlineCreationMode ? 'outline_creation' : 'base_article', // 🔥 创作模式标识
              tempSessionId: newTempSessionId,
              originalTaskTitle: taskTitle,
              originalTaskDescription: taskDescription,
              articleType: articleType || null, // 🔥 创作类型
              articleLength: articleLength || null, // 🔥 Phase 2: 篇幅类型
              primaryMaterialId: primaryMaterialId || null, // 🔥 Phase 2: 主素材ID
              auxiliaryMaterialIds: auxiliaryMaterialIds || null, // 🔥 Phase 2: 辅素材ID列表
              articleOutline: articleOutline || null, // 🔥 文章框架
              guideSource: (subTask.userOpinion !== undefined || subTask.materialIds !== undefined)
                ? 'task-level' : 'global',
              accountId: baseAccountId,
              accountIds: effectiveAccountIds,
              multiPlatformGroupId,
              platformGroupIndex: 0, // 基础组索引为 0
              platformGroupTotal: effectiveAccountIds.length,
              platformLabel: baseAccountInfo.platformLabel,
              platform: baseAccountInfo.platform,
              baseCommandResultId, // 🔥 基础组记录自己的 commandResultId
              ...(derivedImageCountMode ? { imageCountMode: derivedImageCountMode } : {}),
              ...(contentTemplateId ? { contentTemplateId } : {}),
              ...(paradigmCode ? { paradigmCode, paradigmName, paradigmDetail } : {}), // 🔥 范式数据
              ...(normalizedParadigmMaterialBindings ? { paradigmMaterialBindings: normalizedParadigmMaterialBindings } : {}), // 🔥 范式-素材位置绑定
              // 🔥🔥 直接发文模式特有字段
              ...(isDirectPublishMode ? {
                providedArticle: articleContent,
                providedArticleTitle: articleTitle || null,
                creationMode: 'direct_publish',
              } : {}),
              // 🔥🔥 大纲创作模式特有字段
              ...(isOutlineCreationMode ? {
                providedOutline: outlineContent,
                creationMode: 'outline_creation',
              } : {}),
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();

          insertedSubTasks.push(inserted[0]);
          console.log(`🔵 [Agent B 简化拆解] [基础组] 已插入子任务 ${i + 1}/${baseSubTasks.length}: ${taskTitleForDb}`);
        }

        // ========== 阶段2：创建适配组（blocked） ==========
        for (let adaptIdx = 0; adaptIdx < adaptationAccounts.length; adaptIdx++) {
          const adaptAcc = adaptationAccounts[adaptIdx];
          const adaptCommandResultId = uuidv4();

          platformGroupsInfo.push({
            accountId: adaptAcc.accountId,
            platform: adaptAcc.platform,
            platformLabel: adaptAcc.platformLabel,
            accountName: adaptAcc.accountName,
            commandResultId: adaptCommandResultId,
          });

          console.log(`🔵 [Agent B 简化拆解] 创建适配组 ${adaptIdx + 1}/${adaptationAccounts.length}: ${adaptAcc.platformLabel}(${adaptAcc.accountName})`);

          // 获取适配步骤（4步精简版）
          // 🔥 直接发文模式：使用直接发文的适配步骤（不含去AI化节点）
          // 🔥 大纲创作模式：使用大纲创作的适配步骤
          let adaptationSteps;
          if (isDirectPublishMode) {
            adaptationSteps = getDirectPublishAdaptationSteps(adaptAcc.platform);
          } else if (isOutlineCreationMode) {
            adaptationSteps = getOutlineCreationAdaptationSteps(adaptAcc.platform);
          } else {
            adaptationSteps = getAdaptationSteps(adaptAcc.platform);
          }

          for (let i = 0; i < adaptationSteps.length; i++) {
            const step = adaptationSteps[i];
            const newSubTaskId = uuidv4();

            const resolvedExecutor = resolveExecutorForPlatform(adaptAcc.platform, step.executor);
            // 🔴🔴🔴 统一命名格式：《用户指令摘要》- 平台名称 | 功能性标题
            const instructionSummary = (taskTitle || '').trim().substring(0, 20);
            const adaptPrefix = instructionSummary ? `《${instructionSummary}》- ${adaptAcc.platformLabel}` : adaptAcc.platformLabel;
            const taskTitleForDb = step.title && step.title !== instructionSummary
              ? `${adaptPrefix} | ${step.title}`
              : adaptPrefix;

            // 🔥 只有第一个适配任务为 blocked，后续任务为 pending
            // 引擎按 orderIndex 顺序执行，后续任务不会在第一个之前运行
            // 🔥🔥🔥 【Bug修复】直接发文模式下，适配组不应 blocked（用户已有文章，无需等待基础文章定稿）
            // 🔥 大纲创作模式与AI创作模式一致，适配组需 blocked（等待基础文章定稿）
            const taskStatus = isDirectPublishMode ? 'pending' : (i === 0 ? 'blocked' : 'pending');

            const inserted = await tx.insert(agentSubTasks).values({
              id: newSubTaskId,
              commandResultId: adaptCommandResultId,
              fromParentsExecutor: resolvedExecutor,
              taskTitle: taskTitleForDb,
              taskDescription: step.description || '',
              status: taskStatus,
              orderIndex: i + 1,
              workspaceId,
              executionDate: executionDate || new Date().toISOString().split('T')[0],
              userOpinion: userOpinion || null,
              originalInstruction: originalInstruction || null, // 🔥 独立存储原始指令
              materialIds: materialIds || [],
              relatedMaterials: relatedMaterials || null,
              structuredData: structuredData || null, // 🔥 结构化创作引导数据
              metadata: {
                source: 'agent-b-simple-split',
                phase: 'platform_adaptation', // 🔥 阶段标识：平台适配
                tempSessionId: newTempSessionId,
                originalTaskTitle: taskTitle,
                originalTaskDescription: taskDescription,
                articleType: articleType || null, // 🔥 创作类型
              articleLength: articleLength || null, // 🔥 Phase 2: 篇幅类型
              primaryMaterialId: primaryMaterialId || null, // 🔥 Phase 2: 主素材ID
              auxiliaryMaterialIds: auxiliaryMaterialIds || null, // 🔥 Phase 2: 辅素材ID列表
              articleOutline: articleOutline || null, // 🔥 文章框架
                guideSource: 'global',
                accountId: adaptAcc.accountId,
                accountIds: effectiveAccountIds,
                multiPlatformGroupId,
                platformGroupIndex: adaptIdx + 1, // 适配组索引从 1 开始
                platformGroupTotal: effectiveAccountIds.length,
                platformLabel: adaptAcc.platformLabel,
                platform: adaptAcc.platform,
                sourceCommandResultId: baseCommandResultId, // 🔥 指向基础文章组
                adaptationPlatform: adaptAcc.platform, // 🔥 适配目标平台
                ...(derivedImageCountMode ? { imageCountMode: derivedImageCountMode } : {}),
                ...(contentTemplateId ? { contentTemplateId } : {}),
                ...(paradigmCode ? { paradigmCode, paradigmName, paradigmDetail } : {}), // 🔥 范式数据
              ...(normalizedParadigmMaterialBindings ? { paradigmMaterialBindings: normalizedParadigmMaterialBindings } : {}), // 🔥 范式-素材位置绑定
              // 🔥🔥 直接发文模式特有字段
              // 🔥🔥🔥 【Bug修复】适配组也需要 providedArticle，否则写作Agent无法获取用户文章
              ...(isDirectPublishMode ? {
                creationMode: 'direct_publish',
                providedArticle: articleContent,
                providedArticleTitle: articleTitle || null,
              } : {}),
              // 🔥🔥 大纲创作模式特有字段
              ...(isOutlineCreationMode ? {
                creationMode: 'outline_creation',
                providedOutline: outlineContent,
              } : {}),
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning();

            insertedSubTasks.push(inserted[0]);
            console.log(`🔵 [Agent B 简化拆解] [适配组-${adaptAcc.platformLabel}] 已插入子任务 ${i + 1}/${adaptationSteps.length}: ${taskTitleForDb} (${taskStatus})`);
          }
        }
      }); // 事务结束
    } else {
      // ========== 单平台模式：与改造前完全一致 ==========
      const singleAccountId = effectiveAccountIds[0] || accountId || null;

      for (let i = 0; i < effectiveSubTasks.length; i++) {
        const subTask = effectiveSubTasks[i];
        const newSubTaskId = uuidv4();

        const taskUserOpinion = subTask.userOpinion !== undefined
          ? subTask.userOpinion
          : (userOpinion || null);
        const taskOriginalInstruction = subTask.originalInstruction !== undefined
          ? subTask.originalInstruction
          : (originalInstruction || null);
        const taskMaterialIds = subTask.materialIds !== undefined
          ? subTask.materialIds
          : (materialIds || []);

        // 🔥 单平台模式：如果有 accountId，也获取平台信息
        let platformLabel = '';
        let singlePlatform = '';
        if (singleAccountId) {
          const accountInfo = await getAccountInfo(singleAccountId);
          platformLabel = accountInfo.platformLabel;
          singlePlatform = accountInfo.platform;
          console.log(`[simple-split] 单平台账号信息: accountId=${singleAccountId}, platform=${singlePlatform}`);
        } else {
          console.warn(`[simple-split] 单平台模式但未传入 accountId，无法获取平台信息`);
        }

        // 🔥 按平台路由到对应写作 Agent
        const resolvedExecutor = resolveExecutorForPlatform(singlePlatform, subTask.executor);
        console.log(`[simple-split] executor 路由: platform=${singlePlatform}, original=${subTask.executor}, resolved=${resolvedExecutor}`);

        // 🔴🔴🔴 统一命名格式：《用户指令摘要》- 平台名称 | 功能性标题
        let singleTaskTitle = subTask.title;
        if (platformLabel) {
          const instructionSummary = (taskTitle || '').trim().substring(0, 20);
          const singlePrefix = instructionSummary ? `《${instructionSummary}》- ${platformLabel}` : platformLabel;
          let cleanedTitle = subTask.title
            .replace(/\[微信公众号\]\s*/g, '')
            .replace(/\[小红书\]\s*/g, '')
            .replace(/\[知乎\]\s*/g, '')
            .replace(/\[抖音\]\s*/g, '')
            .replace(/\[微博\]\s*/g, '');
          singleTaskTitle = cleanedTitle && cleanedTitle !== instructionSummary
            ? `${singlePrefix} | ${cleanedTitle}`
            : singlePrefix;
        }

        const inserted = await db.insert(agentSubTasks).values({
          id: newSubTaskId,
          commandResultId: newTempSessionId,
          fromParentsExecutor: resolvedExecutor,
          taskTitle: singleTaskTitle,
          taskDescription: subTask.description || '',
          status: 'pending',
          orderIndex: subTask.orderIndex || i + 1,
          workspaceId,
          executionDate: executionDate || new Date().toISOString().split('T')[0],
          userOpinion: taskUserOpinion,
          originalInstruction: taskOriginalInstruction, // 🔥 独立存储原始指令
          materialIds: taskMaterialIds,
          relatedMaterials: relatedMaterials || null,
          structuredData: structuredData || null, // 🔥 结构化创作引导数据
          structureName: subTask.structureName !== undefined ? subTask.structureName : (structureName || null),
          structureDetail: subTask.structureDetail !== undefined ? subTask.structureDetail : (structureDetail || null),
          metadata: {
            source: 'agent-b-simple-split',
            phase: isDirectPublishMode ? 'direct_publish' : isOutlineCreationMode ? 'outline_creation' : 'creation',
            tempSessionId: newTempSessionId,
            originalTaskTitle: taskTitle,
            originalTaskDescription: taskDescription,
            articleType: articleType || null, // 🔥 创作类型
            guideSource: (subTask.userOpinion !== undefined ||
                          subTask.materialIds !== undefined)
              ? 'task-level'
              : 'global',
            // 🔥 单平台兼容字段
            accountId: singleAccountId,
            accountIds: singleAccountId ? [singleAccountId] : [],
            ...(singleAccountId && platformLabel ? { platformLabel } : {}),
            ...(singlePlatform ? { platform: singlePlatform } : {}), // 🔴 平台标识（供虚拟执行器使用）
            ...(derivedImageCountMode ? { imageCountMode: derivedImageCountMode } : {}), // 🔥 小红书图片模式（从内容模板推导或前端传入）
            ...(contentTemplateId ? { contentTemplateId } : {}), // 🔥🔥 内容模板ID
            ...(paradigmCode ? { paradigmCode, paradigmName, paradigmDetail } : {}), // 🔥 范式完整数据（与多平台模式对齐）
            ...(normalizedParadigmMaterialBindings ? { paradigmMaterialBindings: normalizedParadigmMaterialBindings } : {}), // 🔥 范式-素材位置绑定
            // 🔥🔥 直接发文模式特有字段
            ...(isDirectPublishMode ? {
              providedArticle: articleContent,
              providedArticleTitle: articleTitle || null,
              creationMode: 'direct_publish',
            } : {}),
            // 🔥🔥 大纲创作模式特有字段
            ...(isOutlineCreationMode ? {
              providedOutline: outlineContent,
              creationMode: 'outline_creation',
            } : {}),
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();

        insertedSubTasks.push(inserted[0]);
        console.log(`🔵 [Agent B 简化拆解] 已插入子任务 ${i + 1}/${effectiveSubTasks.length}: ${subTask.title}`);
      }
    }

    console.log('✅ [Agent B 简化拆解] 成功插入', insertedSubTasks.length, '个子任务');

    // 🔴 P0 修复：创建任务后异步触发执行引擎（不再依赖 cron 轮询）
    // 使用 setTimeout 确保不阻塞 API 响应，引擎会自动跳过已执行的任务
    try {
      const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
      const engine = new SubtaskExecutionEngine();
      // 异步触发，不等待结果
      setTimeout(() => {
        engine.execute().catch((err: unknown) => {
          console.error('[Agent B 简化拆解] 异步触发执行引擎失败:', err);
        });
      }, 500); // 延迟500ms，确保数据库事务已提交
    } catch (engineErr) {
      console.warn('[Agent B 简化拆解] 触发执行引擎失败（不影响任务创建）:', engineErr);
    }

    return NextResponse.json({
      success: true,
      message: `成功创建 ${insertedSubTasks.length} 个子任务${isMultiPlatform ? `（${isDirectPublishMode ? '直接发文+' : isOutlineCreationMode ? '大纲创作+' : ''}基础文章+平台适配协同模式）` : isDirectPublishMode ? '（直接发文模式）' : isOutlineCreationMode ? '（大纲创作模式）' : ''}`,
      data: {
        insertedCount: insertedSubTasks.length,
        subTasks: insertedSubTasks,
        commandResultId: newTempSessionId,
        tempSessionId: newTempSessionId,
        // 🔥 多平台发布返回值
        multiPlatformGroupId: isMultiPlatform ? `mpg-${newTempSessionId}` : null,
        platformGroups: isMultiPlatform ? platformGroupsInfo : null,
      },
    });

  } catch (error: any) {
    console.error('❌ [Agent B 简化拆解] 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '创建失败' },
      { status: 500 }
    );
  }
}
