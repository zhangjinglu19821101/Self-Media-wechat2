/**
 * 范式初始化状态追踪服务
 * 
 * 核心职责：
 * 1. 在文章提取完成后自动标记匹配到的范式为"已初始化"
 * 2. 查询10套范式的初始化状态（含提取次数、素材数量、匹配均分等）
 * 3. 提取已初始化范式的素材参考数据（减少AI同质化）
 * 
 * 设计原则：
 * - 范式初始化是自动的：只要有文章成功匹配到某范式，该范式即标记为已初始化
 * - 累计统计：每次提取后更新范式的统计指标（次数、素材量、匹配分数等）
 * - 素材维度覆盖：追踪7维素材中哪些维度在该范式下已有内容
 */

import { db } from '@/lib/db';
import { paradigmInitStatus, articleExtractions } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { STANDARD_PARADIGMS, type ParadigmId } from '@/lib/services/article-extraction-service';
import { PARADIGM_LABELS, type ParadigmType, RELATIONAL_MATERIAL_TYPES } from '@/lib/db/schema/article-extractions';

// ============================================================
// 类型定义
// ============================================================

/** 范式初始化状态（含详细统计） */
export interface ParadigmInitInfo {
  /** 范式ID */
  paradigmId: ParadigmType;
  /** 范式中文名 */
  paradigmName: string;
  /** 范式描述 */
  paradigmDescription: string;
  /** 范式结构步骤 */
  paradigmStructure: string[];
  /** 标志句式 */
  signaturePhrases: string[];
  /** 适用文章类型 */
  applicableTypes: string[];
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 首次初始化时间 */
  initializedAt: string | null;
  /** 匹配到该范式的提取次数 */
  extractionCount: number;
  /** 累计素材数量 */
  totalMaterialCount: number;
  /** 平均匹配分数 */
  avgMatchScore: number;
  /** 最高匹配分数 */
  bestMatchScore: number;
  /** 最近一次提取ID */
  lastExtractionId: string | null;
  /** 最近一次提取时间 */
  lastExtractionAt: string | null;
  /** 已覆盖的素材维度（7维中有内容的维度列表） */
  coveredDimensions: string[];
}

/** 范式素材参考（用于提取时注入，减少AI同质化） */
export interface ParadigmMaterialReference {
  /** 范式ID */
  paradigmId: string;
  /** 范式名称 */
  paradigmName: string;
  /** 该范式下已有的素材类型摘要 */
  materialTypeSummary: Record<string, number>;
  /** 该范式下最佳匹配的提取文章标题 */
  bestArticleTitle: string | null;
}

// ============================================================
// 核心方法
// ============================================================

/**
 * 文章提取完成后，标记匹配到的范式为已初始化并更新统计
 * 
 * @param workspaceId 工作区ID
 * @param paradigmId 匹配到的范式ID
 * @param paradigmName 匹配到的范式名称
 * @param matchScore 匹配分数
 * @param materialCount 本次提取的素材数量
 * @param extractionId 本次提取记录ID
 * @param coveredDimensions 本次提取覆盖的素材维度
 */
export async function markParadigmInitialized(
  workspaceId: string,
  paradigmId: string,
  paradigmName: string,
  matchScore: number,
  materialCount: number,
  extractionId: string,
  coveredDimensions: string[] = []
): Promise<void> {
  try {
    // 查询是否已有记录
    const existing = await db
      .select()
      .from(paradigmInitStatus)
      .where(
        and(
          eq(paradigmInitStatus.workspaceId, workspaceId),
          eq(paradigmInitStatus.paradigmId, paradigmId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      const newExtractionCount = (row.extractionCount ?? 0) + 1;
      const newTotalMaterialCount = (row.totalMaterialCount ?? 0) + materialCount;
      
      // 重新计算平均匹配分数
      const oldTotal = (row.avgMatchScore ?? 0) * (row.extractionCount ?? 0);
      const newAvgMatchScore = Math.round((oldTotal + matchScore) / newExtractionCount);
      const newBestMatchScore = Math.max(row.bestMatchScore ?? 0, matchScore);
      
      // 合并已覆盖维度
      const existingDimensions: string[] = Array.isArray(row.coveredDimensions) 
        ? row.coveredDimensions as string[] 
        : [];
      const mergedDimensions = Array.from(new Set([...existingDimensions, ...coveredDimensions]));

      await db
        .update(paradigmInitStatus)
        .set({
          isInitialized: true,
          extractionCount: newExtractionCount,
          totalMaterialCount: newTotalMaterialCount,
          avgMatchScore: newAvgMatchScore,
          bestMatchScore: newBestMatchScore,
          lastExtractionId: extractionId,
          lastExtractionAt: new Date(),
          coveredDimensions: mergedDimensions as any,
          updatedAt: new Date(),
        })
        .where(eq(paradigmInitStatus.id, row.id));
    } else {
      // 创建新记录
      const paradigmLabel = PARADIGM_LABELS[paradigmId as ParadigmType] || paradigmName;
      await db.insert(paradigmInitStatus).values({
        workspaceId,
        paradigmId,
        paradigmName: paradigmLabel || paradigmName,
        isInitialized: true,
        initializedAt: new Date(),
        extractionCount: 1,
        totalMaterialCount: materialCount,
        avgMatchScore: matchScore,
        bestMatchScore: matchScore,
        lastExtractionId: extractionId,
        lastExtractionAt: new Date(),
        coveredDimensions: coveredDimensions as any,
      });
    }
  } catch (error) {
    console.error('[ParadigmInitService] markParadigmInitialized error:', error);
    // 不阻塞主流程
  }
}

/**
 * 获取10套范式的完整初始化状态
 * 
 * @param workspaceId 工作区ID
 * @returns 10套范式的初始化状态列表（始终返回10条）
 */
export async function getParadigmInitStatusList(workspaceId: string): Promise<ParadigmInitInfo[]> {
  // 查询该 workspace 下所有已初始化的范式记录
  const initRecords = await db
    .select()
    .from(paradigmInitStatus)
    .where(eq(paradigmInitStatus.workspaceId, workspaceId));

  // 构建查询映射
  const initMap = new Map<string, typeof initRecords[number]>();
  for (const record of initRecords) {
    initMap.set(record.paradigmId, record);
  }

  // 为10套标准范式构建完整状态列表
  const result: ParadigmInitInfo[] = STANDARD_PARADIGMS.map((paradigm) => {
    const initRecord = initMap.get(paradigm.id);
    
    return {
      paradigmId: paradigm.id as ParadigmType,
      paradigmName: PARADIGM_LABELS[paradigm.id as ParadigmType] || paradigm.name,
      paradigmDescription: paradigm.description,
      paradigmStructure: [...paradigm.structure],
      signaturePhrases: [...paradigm.signaturePhrases],
      applicableTypes: [...paradigm.applicableTypes],
      isInitialized: initRecord?.isInitialized ?? false,
      initializedAt: initRecord?.initializedAt?.toISOString() ?? null,
      extractionCount: initRecord?.extractionCount ?? 0,
      totalMaterialCount: initRecord?.totalMaterialCount ?? 0,
      avgMatchScore: initRecord?.avgMatchScore ?? 0,
      bestMatchScore: initRecord?.bestMatchScore ?? 0,
      lastExtractionId: initRecord?.lastExtractionId ?? null,
      lastExtractionAt: initRecord?.lastExtractionAt?.toISOString() ?? null,
      coveredDimensions: Array.isArray(initRecord?.coveredDimensions) 
        ? initRecord!.coveredDimensions as string[] 
        : [],
    };
  });

  return result;
}

/**
 * 获取已初始化范式的素材参考（用于提取时注入，减少AI同质化）
 * 
 * @param workspaceId 工作区ID
 * @param excludeParadigmId 排除的范式ID（当前正在提取的范式）
 * @returns 已初始化范式的素材摘要
 */
export async function getInitializedParadigmReferences(
  workspaceId: string,
  excludeParadigmId?: string
): Promise<ParadigmMaterialReference[]> {
  // 查询所有已初始化的范式
  const initRecords = await db
    .select()
    .from(paradigmInitStatus)
    .where(
      and(
        eq(paradigmInitStatus.workspaceId, workspaceId),
        eq(paradigmInitStatus.isInitialized, true)
      )
    );

  const references: ParadigmMaterialReference[] = [];

  for (const record of initRecords) {
    // 排除当前正在提取的范式
    if (excludeParadigmId && record.paradigmId === excludeParadigmId) continue;

    // 获取该范式最近一次提取的素材维度分布
    if (record.lastExtractionId) {
      try {
        const [lastExtraction] = await db
          .select({
            articleTitle: articleExtractions.articleTitle,
            relationalMaterials: articleExtractions.relationalMaterials,
          })
          .from(articleExtractions)
          .where(eq(articleExtractions.id, record.lastExtractionId))
          .limit(1);

        if (lastExtraction) {
          // 统计素材维度分布
          const materials = lastExtraction.relationalMaterials as Array<{ materialType?: string }> | null;
          const typeSummary: Record<string, number> = {};
          if (Array.isArray(materials)) {
            for (const m of materials) {
              const mt = m.materialType || 'unknown';
              typeSummary[mt] = (typeSummary[mt] || 0) + 1;
            }
          }

          references.push({
            paradigmId: record.paradigmId,
            paradigmName: record.paradigmName,
            materialTypeSummary: typeSummary,
            bestArticleTitle: lastExtraction.articleTitle,
          });
        }
      } catch {
        // 查询失败不影响其他范式的处理
      }
    }
  }

  return references;
}

/**
 * 从素材列表中提取覆盖的维度
 */
export function extractCoveredDimensions(
  materials: Array<{ materialType: string }>
): string[] {
  const dimensions = new Set<string>();
  for (const m of materials) {
    if (RELATIONAL_MATERIAL_TYPES.includes(m.materialType as any)) {
      dimensions.add(m.materialType);
    }
  }
  return Array.from(dimensions);
}

/**
 * 获取单个范式的初始化状态
 * 
 * @param paradigmId 范式ID
 * @param workspaceId 工作区ID
 * @returns 范式初始化信息，不存在则返回null
 */
export async function getParadigmInitStatus(
  paradigmId: string,
  workspaceId?: string
): Promise<ParadigmInitInfo | null> {
  const wsId = workspaceId || 'default-workspace';
  
  const [record] = await db
    .select()
    .from(paradigmInitStatus)
    .where(
      and(
        eq(paradigmInitStatus.workspaceId, wsId),
        eq(paradigmInitStatus.paradigmId, paradigmId)
      )
    )
    .limit(1);

  // 从 STANDARD_PARADIGMS 查找范式定义
  const paradigmDef = STANDARD_PARADIGMS.find(p => p.id === paradigmId);
  if (!paradigmDef) return null;

  return {
    paradigmId: paradigmDef.id as ParadigmType,
    paradigmName: PARADIGM_LABELS[paradigmDef.id as ParadigmType] || paradigmDef.name,
    paradigmDescription: paradigmDef.description,
    paradigmStructure: [...paradigmDef.structure],
    signaturePhrases: [...paradigmDef.signaturePhrases],
    applicableTypes: [...paradigmDef.applicableTypes],
    isInitialized: record?.isInitialized ?? false,
    initializedAt: record?.initializedAt?.toISOString() ?? null,
    extractionCount: record?.extractionCount ?? 0,
    totalMaterialCount: record?.totalMaterialCount ?? 0,
    avgMatchScore: record?.avgMatchScore ?? 0,
    bestMatchScore: record?.bestMatchScore ?? 0,
    lastExtractionId: record?.lastExtractionId ?? null,
    lastExtractionAt: record?.lastExtractionAt?.toISOString() ?? null,
    coveredDimensions: Array.isArray(record?.coveredDimensions)
      ? record!.coveredDimensions as string[]
      : [],
  };
}
