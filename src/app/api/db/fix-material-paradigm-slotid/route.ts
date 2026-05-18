/**
 * 数据修复 API：修复已有素材的 paradigmId 和 slotId
 * 
 * 问题背景：
 * 1. PARADIGM_ID_MAP 曾有4个键名错误，导致部分素材的 paradigmId 不正确
 * 2. slotId 赋值使用 i+1 序号兜底，而非基于 materialType 反向查找
 * 3. 部分素材缺少 paradigmId 或 slotId
 * 
 * 修复策略：
 * 1. 从 article_extractions 表读取提取记录（含 relationalMaterials 和 paradigmType）
 * 2. 使用 findBestSlotIdForMaterial() 重新计算 slotId
 * 3. 更新 material_library 表的 paradigm_id、paradigm_position、slot_id 字段
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { articleExtractions } from '@/lib/db/schema/article-extractions';
import { eq, and, isNull, sql, isNotNull } from 'drizzle-orm';
import { findBestSlotIdForMaterial } from '@/lib/services/paradigm-slot-manager';

export async function POST(request: NextRequest) {
  try {
    console.log('[Fix Material Paradigm] 开始修复素材的 paradigmId/slotId...');
    
    const results = {
      totalMaterials: 0,
      fixedParadigmId: 0,
      fixedSlotId: 0,
      fixedPosition: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{ materialId: string; action: string; from: string; to: string }>,
    };

    // 1. 查找所有需要修复的素材（有 paradigmId 但可能不正确，或缺少 slotId）
    const materialsToFix = await db.select({
      id: materialLibrary.id,
      title: materialLibrary.title,
      type: materialLibrary.type,
      paradigmId: materialLibrary.paradigmId,
      paradigmPosition: materialLibrary.paradigmPosition,
      slotId: materialLibrary.slotId,
      sourceArticleId: materialLibrary.sourceArticleId,
    })
    .from(materialLibrary)
    .where(
      sql`${materialLibrary.paradigmId} IS NOT NULL`
    );

    results.totalMaterials = materialsToFix.length;
    console.log(`[Fix Material Paradigm] 找到 ${materialsToFix.length} 条有 paradigmId 的素材`);

    // 2. 批量查询文章提取记录，获取正确的范式信息
    const extractionRecords = await db.select({
      id: articleExtractions.id,
      paradigmType: articleExtractions.paradigmType,
      paradigmName: articleExtractions.paradigmName,
      relationalMaterials: articleExtractions.relationalMaterials,
    })
    .from(articleExtractions)
    .where(isNotNull(articleExtractions.paradigmType));

    // 构建 sourceArticleId → extractionRecord 映射
    const extractionMap = new Map<string, {
      paradigmType: string | null;
      paradigmName: string | null;
      relationalMaterials: unknown[] | null;
    }>();
    for (const record of extractionRecords) {
      extractionMap.set(String(record.id), {
        paradigmType: record.paradigmType,
        paradigmName: record.paradigmName,
        relationalMaterials: record.relationalMaterials as unknown[] | null,
      });
    }

    // 3. 逐条修复
    for (const material of materialsToFix) {
      try {
        let needsUpdate = false;
        const updates: Record<string, unknown> = {};

        // 3a. 从关联的文章提取记录中获取正确的 paradigmId
        let correctParadigmId = material.paradigmId;
        if (material.sourceArticleId) {
          const extraction = extractionMap.get(material.sourceArticleId);
          if (extraction?.paradigmType) {
            // 验证 paradigmId 是否正确
            const normalizedParadigmType = extraction.paradigmType.toUpperCase().replace(/-/g, '_');
            if (normalizedParadigmType !== material.paradigmId) {
              results.details.push({
                materialId: material.id,
                action: 'fix_paradigmId',
                from: material.paradigmId || 'null',
                to: normalizedParadigmType,
              });
              correctParadigmId = normalizedParadigmType;
              updates.paradigmId = normalizedParadigmType;
              results.fixedParadigmId++;
              needsUpdate = true;
            }
          }
        }

        // 3b. 使用 findBestSlotIdForMaterial 重新计算 slotId
        if (correctParadigmId && material.type) {
          const bestSlotId = findBestSlotIdForMaterial(
            correctParadigmId,
            material.type
          );

          if (bestSlotId && bestSlotId !== material.slotId) {
            results.details.push({
              materialId: material.id,
              action: 'fix_slotId',
              from: material.slotId || 'null',
              to: bestSlotId,
            });
            updates.slotId = bestSlotId;
            results.fixedSlotId++;
            needsUpdate = true;
          }

          // 3c. 修复 paradigmPosition（从 slotId 推导）
          if (bestSlotId) {
            const positionMatch = bestSlotId.match(/-(\d+)$/);
            if (positionMatch) {
              const position = parseInt(positionMatch[1], 10);
              const expectedPosition = `${correctParadigmId}-段落${position}`;
              if (expectedPosition !== material.paradigmPosition) {
                results.details.push({
                  materialId: material.id,
                  action: 'fix_position',
                  from: material.paradigmPosition || 'null',
                  to: expectedPosition,
                });
                updates.paradigmPosition = expectedPosition;
                results.fixedPosition++;
                needsUpdate = true;
              }
            }
          }
        }

        // 3d. 执行更新
        if (needsUpdate) {
          await db.update(materialLibrary)
            .set(updates)
            .where(eq(materialLibrary.id, material.id));
        } else {
          results.skipped++;
        }
      } catch (err) {
        console.error(`[Fix Material Paradigm] 素材 ${material.id} 修复失败:`, err);
        results.errors++;
      }
    }

    // 4. 额外修复：从提取记录中为缺少 paradigmId 的素材补全
    const materialsMissingParadigm = await db.select({
      id: materialLibrary.id,
      title: materialLibrary.title,
      type: materialLibrary.type,
      sourceArticleId: materialLibrary.sourceArticleId,
    })
    .from(materialLibrary)
    .where(
      and(
        isNull(materialLibrary.paradigmId),
        isNotNull(materialLibrary.sourceArticleId)
      )
    );

    console.log(`[Fix Material Paradigm] 找到 ${materialsMissingParadigm.length} 条缺少 paradigmId 但有 sourceArticleId 的素材`);

    for (const material of materialsMissingParadigm) {
      try {
        const extraction = extractionMap.get(material.sourceArticleId || '');
        if (extraction?.paradigmType && material.type) {
          const normalizedParadigmType = extraction.paradigmType.toUpperCase().replace(/-/g, '_');
          const bestSlotId = findBestSlotIdForMaterial(
            normalizedParadigmType,
            material.type
          );

          const positionMatch = bestSlotId?.match(/-(\d+)$/);
          const paradigmPosition = positionMatch
            ? `${normalizedParadigmType}-段落${parseInt(positionMatch[1], 10)}`
            : null;

          await db.update(materialLibrary)
            .set({
              paradigmId: normalizedParadigmType,
              slotId: bestSlotId || null,
              paradigmPosition: paradigmPosition,
            })
            .where(eq(materialLibrary.id, material.id));

          results.fixedParadigmId++;
          results.details.push({
            materialId: material.id,
            action: 'add_paradigmId',
            from: 'null',
            to: `${normalizedParadigmType} (slotId=${bestSlotId})`,
          });
        }
      } catch (err) {
        console.error(`[Fix Material Paradigm] 素材 ${material.id} 补全失败:`, err);
        results.errors++;
      }
    }

    console.log('[Fix Material Paradigm] 修复完成:', results);

    return NextResponse.json({
      success: true,
      message: '素材 paradigmId/slotId 修复完成',
      results: {
        totalMaterials: results.totalMaterials,
        fixedParadigmId: results.fixedParadigmId,
        fixedSlotId: results.fixedSlotId,
        fixedPosition: results.fixedPosition,
        skipped: results.skipped,
        errors: results.errors,
        detailsCount: results.details.length,
        details: results.details.slice(0, 50), // 只返回前50条详情
      },
    });

  } catch (error) {
    console.error('[Fix Material Paradigm] 修复失败:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
