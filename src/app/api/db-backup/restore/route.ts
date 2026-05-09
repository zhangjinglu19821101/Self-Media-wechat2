/**
 * 数据库恢复 API
 * 
 * 功能：
 * - POST /api/db-backup/restore: 从备份恢复数据
 * - POST /api/db-backup/verify: 验证备份完整性
 * - DELETE /api/db-backup/[backupId]: 删除备份
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbBackupService } from '@/lib/services/db-backup-service';

// ==================== POST: 恢复或验证 ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      backupId, 
      action = 'restore',
      dropExisting = false,
    } = body;

    if (!backupId) {
      return NextResponse.json(
        { success: false, error: 'backupId 是必需参数' },
        { status: 400 }
      );
    }

    // 验证备份
    if (action === 'verify') {
      console.log(`[API] 验证备份: ${backupId}`);
      
      const result = await dbBackupService.restoreFromBackup(backupId, {
        verifyOnly: true,
      });

      return NextResponse.json({
        success: result.success,
        data: result,
        message: result.message,
      });
    }

    // 恢复数据
    if (action === 'restore') {
      console.log(`[API] 恢复备份: ${backupId}, dropExisting=${dropExisting}`);

      // ⚠️ 危险操作确认
      if (dropExisting) {
        console.warn(`[API] ⚠️ 将删除现有数据并恢复备份: ${backupId}`);
      }

      const result = await dbBackupService.restoreFromBackup(backupId, {
        dropExisting,
      });

      return NextResponse.json({
        success: result.success,
        data: result,
        message: result.message,
      });
    }

    return NextResponse.json(
      { success: false, error: `未知的操作: ${action}` },
      { status: 400 }
    );

  } catch (error) {
    console.error('[API] 恢复操作失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ==================== DELETE: 删除备份 ====================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const backupId = searchParams.get('backupId');

    if (!backupId) {
      return NextResponse.json(
        { success: false, error: 'backupId 是必需参数' },
        { status: 400 }
      );
    }

    console.log(`[API] 删除备份: ${backupId}`);

    const success = await dbBackupService.deleteBackup(backupId);

    return NextResponse.json({
      success,
      message: success ? `备份已删除: ${backupId}` : `删除失败: 备份不存在`,
    });

  } catch (error) {
    console.error('[API] 删除备份失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
