/**
 * 范式-素材联动查询 API
 * GET /api/paradigm-library/available-materials?paradigmCode=P001
 *
 * 🔥 位置ID三重绑定核心接口：
 * - 根据范式ID查询该范式每个位置(slotId)对应的可选素材
 * - 返回每个位置的：slotId、允许的素材类型、已绑定的素材列表
 * - 前端使用此接口实现"选择范式 → 自动展示对应可选素材"的联动
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { getParadigmPositionMap, getParadigmDetail } from '@/lib/services/paradigm-creation-service';
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

    // 3. 为每个位置查询可用的素材
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const slotResults: Record<string, {
      slotId: string;
      paragraphOrder: number;
      stepName: string;
      allowedMaterialTypes: string[];
      materials: Array<{
        id: string;
        title: string;
        content: string;
        type: string;
        sceneType: string | null;
        slotId: string | null;
        paradigmPosition: string | null;
        useCount: number;
        lastUsedAt: Date | null;
        matchedBy: 'slotId' | 'paradigmPosition' | 'paradigmId';
      }>;
    }> = {};

    for (const position of positionMap) {
      const posSlotId = position.slotId as string;
      const paragraphOrder = position.paragraphOrder as number;
      const allowedTypes = (position.materialTypes as string[]) || [];

      // 如果指定了slotId过滤，跳过不匹配的位置
      if (slotId && posSlotId !== slotId) continue;

      // 如果指定了materialType过滤，跳过不匹配的位置
      if (materialType && !allowedTypes.includes(materialType)) continue;

      // 🔥 三级匹配策略：slotId > paradigmPosition > paradigmId
      const materials: Array<{
        id: string;
        title: string;
        content: string;
        type: string;
        sceneType: string | null;
        slotId: string | null;
        paradigmPosition: string | null;
        useCount: number;
        lastUsedAt: Date | null;
        matchedBy: 'slotId' | 'paradigmPosition' | 'paradigmId';
      }> = [];

      // 策略1：slotId精确匹配（最高优先级）
      if (posSlotId) {
        const slotMatches = await db
          .select({
            id: materialLibrary.id,
            title: materialLibrary.title,
            content: materialLibrary.content,
            type: materialLibrary.type,
            sceneType: materialLibrary.sceneType,
            slotId: materialLibrary.slotId,
            paradigmPosition: materialLibrary.paradigmPosition,
            useCount: materialLibrary.useCount,
            lastUsedAt: materialLibrary.lastUsedAt,
          })
          .from(materialLibrary)
          .where(
            and(
              eq(materialLibrary.status, 'active'),
              eq(materialLibrary.slotId, posSlotId),
              or(
                isNull(materialLibrary.lastUsedAt),
                sql`${materialLibrary.lastUsedAt} <= ${sevenDaysAgo}`
              )
            )
          )
          .orderBy(asc(materialLibrary.useCount))
          .limit(10);

        for (const m of slotMatches) {
          materials.push({ ...m, matchedBy: 'slotId' });
        }
      }

      // 策略2：paradigmPosition匹配
      if (materials.length < 5) {
        const existingIds = materials.map(m => m.id);
        const posMatches = await db
          .select({
            id: materialLibrary.id,
            title: materialLibrary.title,
            content: materialLibrary.content,
            type: materialLibrary.type,
            sceneType: materialLibrary.sceneType,
            slotId: materialLibrary.slotId,
            paradigmPosition: materialLibrary.paradigmPosition,
            useCount: materialLibrary.useCount,
            lastUsedAt: materialLibrary.lastUsedAt,
          })
          .from(materialLibrary)
          .where(
            and(
              eq(materialLibrary.status, 'active'),
              eq(materialLibrary.paradigmPosition, `${paradigmCode}-段落${paragraphOrder}`),
              or(
                isNull(materialLibrary.lastUsedAt),
                sql`${materialLibrary.lastUsedAt} <= ${sevenDaysAgo}`
              ),
              ...existingIds.length > 0
                ? [sql`${materialLibrary.id} NOT IN (${sql.join(existingIds.map(id => sql`${id}`), sql`, `)})`]
                : []
            )
          )
          .orderBy(asc(materialLibrary.useCount))
          .limit(10 - materials.length);

        for (const m of posMatches) {
          materials.push({ ...m, matchedBy: 'paradigmPosition' });
        }
      }

      // 策略3：paradigmId + materialType匹配（最低优先级）
      if (materials.length < 5 && allowedTypes.length > 0) {
        const existingIds = materials.map(m => m.id);
        for (const allowedType of allowedTypes) {
          if (materials.length >= 5) break;
          const typeMatches = await db
            .select({
              id: materialLibrary.id,
              title: materialLibrary.title,
              content: materialLibrary.content,
              type: materialLibrary.type,
              sceneType: materialLibrary.sceneType,
              slotId: materialLibrary.slotId,
              paradigmPosition: materialLibrary.paradigmPosition,
              useCount: materialLibrary.useCount,
              lastUsedAt: materialLibrary.lastUsedAt,
            })
            .from(materialLibrary)
            .where(
              and(
                eq(materialLibrary.status, 'active'),
                eq(materialLibrary.paradigmId, paradigmCode),
                eq(materialLibrary.type, allowedType),
                or(
                  isNull(materialLibrary.lastUsedAt),
                  sql`${materialLibrary.lastUsedAt} <= ${sevenDaysAgo}`
                ),
                ...existingIds.length > 0
                  ? [sql`${materialLibrary.id} NOT IN (${sql.join(existingIds.map(id => sql`${id}`), sql`, `)})`]
                  : []
              )
            )
            .orderBy(asc(materialLibrary.useCount))
            .limit(5 - materials.length);

          for (const m of typeMatches) {
            materials.push({ ...m, matchedBy: 'paradigmId' });
            existingIds.push(m.id);
          }
        }
      }

      slotResults[posSlotId || `${paradigmCode}-${paragraphOrder}`] = {
        slotId: posSlotId,
        paragraphOrder,
        stepName: position.stepName as string || `段落${paragraphOrder}`,
        allowedMaterialTypes: allowedTypes,
        materials,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        paradigmCode,
        paradigmName: paradigmDetail.paradigmName,
        totalSlots: positionMap.length,
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
