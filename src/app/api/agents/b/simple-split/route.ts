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
import { getFlowTemplate, SubTaskTemplate } from '@/lib/agents/flow-templates';
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
      userOpinion, // 🔥 用户观点（核心锚点 + 关键素材）
      materialIds, // 🔥 素材ID列表
      relatedMaterials = '', // 🔥 关联素材补充区内容
      structureName, // 🔥 结构名称
      structureDetail, // 🔥 结构详情（JSON字符串）
      accountId, // 🔥 发布账号ID（兼容单选模式）
      accountIds, // 🔥 多平台发布：选中的账号ID列表
      imageCountMode, // 🔥 小红书图片数量模式（3-card/5-card/7-card）
      contentTemplateId, // 🔥🔥 内容模板ID（Phase 2-1: 图文分工模板）
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

    // 🔥🔥🔥 【P0修复】为小红书平台设置默认卡片数量模式（5卡详尽）
    // 如果用户没有选择内容模板，且没有手动指定 imageCountMode，默认使用 5 卡详尽模式
    // 异步检查选中的账号中是否有小红书账号
    if (!derivedImageCountMode && effectiveAccountIds.length > 0) {
      // 批量查询账号平台信息
      const accountPlatforms = await Promise.all(
        effectiveAccountIds.map(accId => getAccountInfo(accId))
      );
      const hasXiaohongshuAccount = accountPlatforms.some(acc => acc.platform === 'xiaohongshu');
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
      // ========== 多平台模式：每个账号创建独立的一组子任务（独立 commandResultId） ==========
      const multiPlatformGroupId = `mpg-${newTempSessionId}`;
      console.log(`🔵 [Agent B 简化拆解] 多平台模式：${effectiveAccountIds.length} 个账号，multiPlatformGroupId=${multiPlatformGroupId}`);

      // P1-1 修复：使用事务保证多组子任务的原子性
      await db.transaction(async (tx) => {
        for (let groupIdx = 0; groupIdx < effectiveAccountIds.length; groupIdx++) {
          const accId = effectiveAccountIds[groupIdx];
          const accountInfo = await getAccountInfo(accId);
          // 🔥 每个平台组使用独立的 commandResultId（标准 UUID，分组信息存储在 metadata 中）
          const groupCommandResultId = uuidv4();

          platformGroupsInfo.push({
            accountId: accId,
            platform: accountInfo.platform,
            platformLabel: accountInfo.platformLabel,
            accountName: accountInfo.accountName,
            commandResultId: groupCommandResultId,
          });

          console.log(`🔵 [Agent B 简化拆解] 创建第 ${groupIdx + 1}/${effectiveAccountIds.length} 组子任务: ${accountInfo.platformLabel}(${accountInfo.accountName})`);

          // 🔥 多平台步骤来源：优先使用前端用户编辑的步骤，否则使用流程模板兜底
          let platformSubTasks;
          if (hasFrontendSteps) {
            // 🔥 使用前端用户编辑的步骤（按 accountId 筛选该平台的子任务）
            platformSubTasks = effectiveSubTasks.filter((st: any) => st.accountId === accId);
            // P2: 空状态回退到流程模板
            if (platformSubTasks.length === 0) {
              const fallbackTemplate = getFlowTemplate(accountInfo.platform);
              platformSubTasks = fallbackTemplate.steps.map(step => ({
                title: step.title,
                description: step.description,
                executor: step.executor,
                orderIndex: step.orderIndex,
              }));
              console.log(`🔵 [Agent B 简化拆解] ⚠️ ${accountInfo.platformLabel} 前端步骤为空，回退到流程模板: ${fallbackTemplate.name}（${platformSubTasks.length} 步）`);
            } else {
              console.log(`🔵 [Agent B 简化拆解] 🔥 ${accountInfo.platformLabel} 使用前端编辑步骤（${platformSubTasks.length} 步）`);
            }
          } else {
            // 无前端步骤 → 使用流程模板
            const flowTemplate = getFlowTemplate(accountInfo.platform);
            platformSubTasks = flowTemplate.steps.map(step => ({
              title: step.title,
              description: step.description,
              executor: step.executor,
              orderIndex: step.orderIndex,
            }));
            console.log(`🔵 [Agent B 简化拆解] 🔥 ${accountInfo.platformLabel} 使用流程模板: ${flowTemplate.name}（${platformSubTasks.length} 步）`);
          }

          for (let i = 0; i < platformSubTasks.length; i++) {
            const subTask = platformSubTasks[i];
            const newSubTaskId = uuidv4();

            // 优先使用子任务级别的创作引导配置，否则使用全局配置
            const taskUserOpinion = subTask.userOpinion !== undefined
              ? subTask.userOpinion
              : (userOpinion || null);
            const taskMaterialIds = subTask.materialIds !== undefined
              ? subTask.materialIds
              : (materialIds || []);

            // 🔥 为写作类子任务按平台路由到对应 Agent + 添加平台前缀
            const resolvedExecutor = resolveExecutorForPlatform(accountInfo.platform, subTask.executor);
            let taskTitleForDb = subTask.title;
            if (isWritingAgent(subTask.executor)) {
              // 清理原始标题中的平台描述，避免歧义
              let cleanedTitle = subTask.title
                .replace(/\[微信公众号\]\s*/g, '')
                .replace(/\[小红书\]\s*/g, '')
                .replace(/\[知乎\]\s*/g, '')
                .replace(/\[抖音\]\s*/g, '')
                .replace(/\[微博\]\s*/g, '')
                .replace(/公众号文章/g, '文章')
                .replace(/公众号初稿/g, '初稿')
                .replace(/公众号/g, '');
              
              taskTitleForDb = `[${accountInfo.platformLabel}] ${cleanedTitle}`;
            }

            const inserted = await tx.insert(agentSubTasks).values({
              id: newSubTaskId,
              commandResultId: groupCommandResultId, // 🔥 独立的 commandResultId
              fromParentsExecutor: resolvedExecutor,
              taskTitle: taskTitleForDb,
              taskDescription: subTask.description || '',
              status: 'pending',
              orderIndex: subTask.orderIndex || i + 1, // 🔥 每组独立从 1 开始
              workspaceId,
              executionDate: executionDate || new Date().toISOString().split('T')[0],
              userOpinion: taskUserOpinion,
              materialIds: taskMaterialIds,
              relatedMaterials: relatedMaterials || null,
              structureName: subTask.structureName !== undefined ? subTask.structureName : (structureName || null),
              structureDetail: subTask.structureDetail !== undefined ? subTask.structureDetail : (structureDetail || null),
              metadata: {
                source: 'agent-b-simple-split',
                phase: 'creation',
                tempSessionId: newTempSessionId,
                originalTaskTitle: taskTitle,
                originalTaskDescription: taskDescription,
                guideSource: (subTask.userOpinion !== undefined ||
                              subTask.materialIds !== undefined)
                  ? 'task-level'
                  : 'global',
                // 🔥 多平台发布字段
                accountId: accId, // 当前子任务归属的账号ID
                accountIds: effectiveAccountIds, // 所有选中的账号ID列表
                multiPlatformGroupId, // 多平台组 ID
                platformGroupIndex: groupIdx, // 平台组索引
                platformGroupTotal: effectiveAccountIds.length, // 总共几组
                platformLabel: accountInfo.platformLabel, // 平台显示名称
                platform: accountInfo.platform, // 🔴 平台标识（供 user_preview_edit 等虚拟执行器使用）
                ...(derivedImageCountMode ? { imageCountMode: derivedImageCountMode } : {}), // 🔥 小红书图片模式（从内容模板推导或前端传入）
                ...(contentTemplateId ? { contentTemplateId } : {}), // 🔥🔥 内容模板ID
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning();

            insertedSubTasks.push(inserted[0]);
            console.log(`🔵 [Agent B 简化拆解] 已插入子任务 [${accountInfo.platformLabel}] ${i + 1}/${platformSubTasks.length}: ${taskTitleForDb}`);
          }
        }
      }); // 事务结束：任一 insert 失败则全部回滚
    } else {
      // ========== 单平台模式：与改造前完全一致 ==========
      const singleAccountId = effectiveAccountIds[0] || accountId || null;

      for (let i = 0; i < effectiveSubTasks.length; i++) {
        const subTask = effectiveSubTasks[i];
        const newSubTaskId = uuidv4();

        const taskUserOpinion = subTask.userOpinion !== undefined
          ? subTask.userOpinion
          : (userOpinion || null);
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
          materialIds: taskMaterialIds,
          relatedMaterials: relatedMaterials || null,
          structureName: subTask.structureName !== undefined ? subTask.structureName : (structureName || null),
          structureDetail: subTask.structureDetail !== undefined ? subTask.structureDetail : (structureDetail || null),
          metadata: {
            source: 'agent-b-simple-split',
            phase: 'creation',
            tempSessionId: newTempSessionId,
            originalTaskTitle: taskTitle,
            originalTaskDescription: taskDescription,
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
      message: `成功创建 ${insertedSubTasks.length} 个子任务${isMultiPlatform ? `（${effectiveAccountIds.length} 个平台 × ${effectiveSubTasks.length} 个步骤）` : ''}`,
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
