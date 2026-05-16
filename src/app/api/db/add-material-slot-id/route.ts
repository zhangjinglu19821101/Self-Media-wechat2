/**
 * 数据库迁移：为素材库添加 slotId 字段
 * 支持位置ID三重绑定机制的第二层：素材 ↔ slotId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, isNull, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log('[DB Migration] 开始添加素材库 slotId 字段...');

    // 1. 检查并添加 slotId 列（如果不存在）
    try {
      await db.execute(`
        ALTER TABLE material_library 
        ADD COLUMN IF NOT EXISTS slot_id TEXT;
      `);
      console.log('[DB Migration] slot_id 列添加成功');
    } catch (e) {
      console.log('[DB Migration] slot_id 列可能已存在，跳过:', (e as Error).message);
    }

    // 2. 为 slotId 添加索引
    try {
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_material_slot_id 
        ON material_library(slot_id);
      `);
      console.log('[DB Migration] slot_id 索引添加成功');
    } catch (e) {
      console.log('[DB Migration] slot_id 索引可能已存在，跳过:', (e as Error).message);
    }

    // 3. 基于现有 paradigmId + paradigmPosition 回填 slotId（如果缺失）
    // 格式: {paradigmCode}-{两位顺序号}，例如 P001-01
    try {
      const materialsToUpdate = await db.select({
        id: materialLibrary.id,
        paradigmId: materialLibrary.paradigmId,
        paradigmPosition: materialLibrary.paradigmPosition,
      })
      .from(materialLibrary)
      .where(and(
        isNull(materialLibrary.slotId),
        materialLibrary.paradigmId.isNotNull(),
        materialLibrary.paradigmPosition.isNotNull()
      ));

      console.log(`[DB Migration] 找到 ${materialsToUpdate.length} 条需要回填 slotId 的素材`);

      for (const material of materialsToUpdate) {
        if (material.paradigmId && material.paradigmPosition) {
          // 从 paradigmPosition 提取顺序号（格式可能是 "P001-段落1" 或直接数字）
          let orderNum = 1;
          const positionStr = String(material.paradigmPosition);
          
          // 尝试提取数字
          const match = positionStr.match(/(\d+)/);
          if (match) {
            orderNum = parseInt(match[1], 10);
          }

          // 格式化为两位数字
          const formattedOrder = String(orderNum).padStart(2, '0');
          const slotId = `${material.paradigmId}-${formattedOrder}`;

          await db.update(materialLibrary)
            .set({ slotId })
            .where(eq(materialLibrary.id, material.id));

          console.log(`[DB Migration] 素材 ${material.id}: slotId=${slotId}`);
        }
      }

      console.log('[DB Migration] slotId 回填完成');
    } catch (e) {
      console.log('[DB Migration] slotId 回填失败:', (e as Error).message);
    }

    return NextResponse.json({
      success: true,
      message: '素材库 slotId 字段添加成功',
    });

  } catch (error) {
    console.error('[DB Migration] 添加 slotId 字段失败:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
