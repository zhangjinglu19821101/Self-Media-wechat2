/**
 * 范式-素材联动查询 API
 * GET /api/paradigm-library/available-materials?paradigmCode=P001
 *
 * 🔥 位置ID严格绑定核心接口：
 * - 根据范式ID查询该范式每个位置(slotId)对应的可选素材
 * - 返回每个位置的：slotId、允许的素材类型、已绑定的素材列表
 * - 前端使用此接口实现"选择范式 → 自动展示对应可选素材"的联动
 *
 * ⚠️ 严格绑定原则：
 * - 每个槽位只展示slotId精确匹配的素材
 * - 不属于该范式的素材不出现在可选清单
 * - 不属于该槽位的素材不出现在可选清单
 * - 无素材的槽位标记为"待补充"，前端引导用户添加
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { getParadigmPositionMap, getParadigmDetail } from '@/lib/services/paradigm-creation-service';
import { isSlotValidForParadigm } from '@/lib/services/paradigm-slot-manager';
import { getWorkspaceId } from '@/lib/auth/context';
import { eq, and, or, sql, isNull, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paradigmCode = searchParams.get('paradigmCode');
    const slotId = searchParams.get('slotId'); // 可选：只查某个位置的素材
    const materialType = searchParams.get('materialType'); // 可选：只查某种类型

    if (!paradigmCode) {
      return NextResponse.json(
        { success: false, error: '缺少 paradigmCode 参数' },
        { status: 400 }
      );
    }

    // 获取 workspaceId 隔离
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 1. 获取范式详情
    const paradigmDetail = await getParadigmDetail(paradigmCode);
    if (!paradigmDetail) {
      return NextResponse.json(
        { success: false, error: `范式 ${paradigmCode} 不存在` },
        { status: 404 }
      );
    }

    // 2. 获取范式的位置映射（包含每个位置的slotId和允许的素材类型）
    const positionMap = await getParadigmPositionMap(paradigmCode);

    // 3. 为每个位置查询可用的素材（严格slotId绑定）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const slotResults: Record<string, {
      slotId: string;
      paragraphOrder: number;
      stepName: string;
      allowedMaterialTypes: string[];
      materialCount: number;
      isEmpty: boolean;
      materials: Array<{
        id: string;
        title: string;
        content: string;
        type: string;
        sceneType: string | null;
        slotId: string | null;
        paradigmPosition: string | null;
        paradigmId: string | null;
        useCount: number;
        lastUsedAt: Date | null;
      }>;
    }> = {};

    let totalSlots = 0;
    let emptySlots = 0;

    for (const position of positionMap) {
      const posSlotId = position.slotId as string;
      const paragraphOrder = position.paragraphOrder as number;
      const allowedTypes = (position.materialTypes as string[]) || [];

      // 如果指定了slotId过滤，跳过不匹配的位置
      if (slotId && posSlotId !== slotId) continue;

      // 如果指定了materialType过滤，跳过不匹配的位置
      if (materialType && !allowedTypes.includes(materialType)) continue;

      totalSlots++;

      // 🔥 严格slotId绑定：只查询slotId精确匹配的素材
      let materials: Array<{
        id: string;
        title: string;
        content: string;
        type: string;
        sceneType: string | null;
        slotId: string | null;
        paradigmPosition: string | null;
        paradigmId: string | null;
        useCount: number;
        lastUsedAt: Date | null;
      }> = [];

      if (posSlotId) {
        // 校验slotId是否属于该范式
        if (!isSlotValidForParadigm(paradigmCode, posSlotId)) {
          console.warn(`[available-materials] slotId ${posSlotId} 不属于范式 ${paradigmCode}，跳过`);
        } else {
          // 严格查询：slotId精确匹配 + 该范式的素材
          const slotMatches = await db
            .select({
              id: materialLibrary.id,
              title: materialLibrary.title,
              content: materialLibrary.content,
              type: materialLibrary.type,
              sceneType: materialLibrary.sceneType,
              slotId: materialLibrary.slotId,
              paradigmPosition: materialLibrary.paradigmPosition,
              paradigmId: materialLibrary.paradigmId,
              useCount: materialLibrary.useCount,
              lastUsedAt: materialLibrary.lastUsedAt,
            })
            .from(materialLibrary)
            .where(
              and(
                eq(materialLibrary.status, 'active'),
                eq(materialLibrary.workspaceId, workspaceId),
                eq(materialLibrary.slotId, posSlotId),
                eq(materialLibrary.paradigmId, paradigmCode),
                or(
                  isNull(materialLibrary.lastUsedAt),
                  sql`${materialLibrary.lastUsedAt} <= ${sevenDaysAgo}`
                )
              )
            )
            .orderBy(asc(materialLibrary.useCount))
            .limit(20);

          materials = slotMatches;
        }
      }

      const isEmpty = materials.length === 0;
      if (isEmpty) emptySlots++;

      slotResults[posSlotId || `${paradigmCode}-${paragraphOrder}`] = {
        slotId: posSlotId,
        paragraphOrder,
        stepName: position.stepName as string || `段落${paragraphOrder}`,
        allowedMaterialTypes: allowedTypes,
        materialCount: materials.length,
        isEmpty,
        materials,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        paradigmCode,
        paradigmName: paradigmDetail.paradigmName,
        totalSlots,
        filledSlots: totalSlots - emptySlots,
        emptySlots,
        coverageRate: totalSlots > 0 ? Math.round(((totalSlots - emptySlots) / totalSlots) * 100) : 0,
        slots: slotResults,
      },
    });
  } catch (error) {
    console.error('[available-materials] GET 失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
