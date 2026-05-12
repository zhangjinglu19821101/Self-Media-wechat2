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
import { getFlowTemplate, SubTaskTemplate, splitBaseAndAdaptationGroups, getAdaptationSteps, isBaseArticlePlatform } from '@/lib/agents/flow-templates';
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
      materialIds, // 🔥 素材ID列表
      caseIds, // 🔥 行业案例ID列表（用户手动选择）
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
      // useFlowTemplate 已移除：步骤来源由数据特征自动判断
      // 前端 subTasks 中包含 accountId 字段 → 使用前端编辑步骤
      // 否则 → 使用流程模板兜底
    } = body;

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
      hasFrontendSteps: subTasks?.some((st: any) => st.accountId) || false,
    });

    // 🔥 步骤来源判断（纯数据特征，无需 useFlowTemplate 开关）：
    // 前端 subTasks 中包含 accountId → 用户编辑过步骤，优先使用
    // 否则 → 使用流程模板兜底
    const hasFrontendSteps = subTasks?.some((st: any) => st.accountId) || false;
    let effectiveSubTasks = subTasks;

    if (hasFrontendSteps) {
      console.log(`🔵 [Agent B 简化拆解] 🔥 检测到前端编辑步骤（含 accountId），优先使用前端步骤`);
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
            const fallbackTemplate = getFlowTemplate(baseAccountInfo.platform);
            baseSubTasks = fallbackTemplate.steps.map(step => ({
              title: step.title,
              description: step.description,
              executor: step.executor,
              orderIndex: step.orderIndex,
            }));
            console.log(`🔵 [Agent B 简化拆解] ⚠️ 基础组前端步骤为空，回退到流程模板: ${fallbackTemplate.name}`);
          }
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
          const taskCaseIds = subTask.caseIds !== undefined
            ? subTask.caseIds
            : (caseIds || []);

          const resolvedExecutor = resolveExecutorForPlatform(baseAccountInfo.platform, subTask.executor);
          let taskTitleForDb = subTask.title;
          if (isWritingAgent(subTask.executor)) {
            let cleanedTitle = subTask.title
              .replace(/\[微信公众号\]\s*/g, '')
              .replace(/\[小红书\]\s*/g, '')
              .replace(/\[知乎\]\s*/g, '')
              .replace(/\[抖音\]\s*/g, '')
              .replace(/\[微博\]\s*/g, '');
            taskTitleForDb = `[${baseAccountInfo.platformLabel}] ${cleanedTitle}`;
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
              phase: 'base_article', // 🔥 阶段标识：基础文章
              tempSessionId: newTempSessionId,
              originalTaskTitle: taskTitle,
              originalTaskDescription: taskDescription,
              articleType: articleType || null, // 🔥 创作类型
              articleLength: articleLength || null, // 🔥 Phase 2: 篇幅类型
              primaryMaterialId: primaryMaterialId || null, // 🔥 Phase 2: 主素材ID
              auxiliaryMaterialIds: auxiliaryMaterialIds || null, // 🔥 Phase 2: 辅素材ID列表
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
              ...(taskCaseIds.length > 0 ? { caseIds: taskCaseIds } : {}),
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
          const adaptationSteps = getAdaptationSteps(adaptAcc.platform);

          for (let i = 0; i < adaptationSteps.length; i++) {
            const step = adaptationSteps[i];
            const newSubTaskId = uuidv4();

            const resolvedExecutor = resolveExecutorForPlatform(adaptAcc.platform, step.executor);
            const taskTitleForDb = `[${adaptAcc.platformLabel}] ${step.title}`;

            // 🔥 只有第一个适配任务为 blocked，后续任务为 pending
            // 引擎按 orderIndex 顺序执行，后续任务不会在第一个之前运行
            const taskStatus = i === 0 ? 'blocked' : 'pending';

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
        const taskCaseIds = subTask.caseIds !== undefined
          ? subTask.caseIds
          : (caseIds || []);

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

        const inserted = await db.insert(agentSubTasks).values({
          id: newSubTaskId,
          commandResultId: newTempSessionId,
          fromParentsExecutor: resolvedExecutor,
          taskTitle: subTask.title,
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
            phase: 'creation',
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
            ...(taskCaseIds.length > 0 ? { caseIds: taskCaseIds } : {}), // 🔥 行业案例ID列表
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();

        insertedSubTasks.push(inserted[0]);
        console.log(`🔵 [Agent B 简化拆解] 已插入子任务 ${i + 1}/${effectiveSubTasks.length}: ${subTask.title}`);
      }
    }

    console.log('✅ [Agent B 简化拆解] 成功插入', insertedSubTasks.length, '个子任务');

    return NextResponse.json({
      success: true,
      message: `成功创建 ${insertedSubTasks.length} 个子任务${isMultiPlatform ? `（基础文章+平台适配协同模式）` : ''}`,
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
