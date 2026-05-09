/**
 * 数据库备份 API
 * 
 * 功能：
 * - POST /api/db-backup: 手动触发备份
 * - GET /api/db-backup: 查询备份列表
 * - GET /api/db-backup/status: 查询备份服务状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbBackupService } from '@/lib/services/db-backup-service';
import { getCurrentSchema, checkDatabaseHealth } from '@/lib/db';
import { getWorkspaceId } from '@/lib/auth/context';

// ==================== GET: 查询备份列表 ====================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // 查询备份服务状态
    if (action === 'status') {
      const dbHealth = await checkDatabaseHealth();
      const schema = getCurrentSchema();

      return NextResponse.json({
        success: true,
        data: {
          database: {
            connected: dbHealth.connected,
            schema: dbHealth.schema,
            latencyMs: dbHealth.latencyMs,
          },
          backupService: {
            status: 'ready',
            tempDir: '/tmp/db-backups',
            lastBackup: null, // TODO: 从注册表获取
          },
        },
      });
    }

    // 查询备份列表
    const schema = searchParams.get('schema') || getCurrentSchema();
    const type = searchParams.get('type') as 'full' | 'incremental' | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await dbBackupService.listBackups(schema, {
      type: type || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('[API] 查询备份失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ==================== POST: 手动触发备份 ====================

export async function POST(request: NextRequest) {
  try {
    // 权限检查：仅管理员可触发备份
    const workspaceId = getWorkspaceId(request);
    // TODO: 添加管理员权限检查

    const body = await request.json();
    const { 
      type = 'full', 
      schema, 
      compress = true,
      retentionDays = 30,
    } = body;

    // 参数校验
    if (type !== 'full' && type !== 'incremental') {
      return NextResponse.json(
        { success: false, error: 'type 必须是 full 或 incremental' },
        { status: 400 }
      );
    }

    const targetSchema = schema || getCurrentSchema();

    console.log(`[API] 手动触发${type === 'full' ? '全量' : '增量'}备份: schema=${targetSchema}`);

    // 执行备份
    const result = type === 'full'
      ? await dbBackupService.performFullBackup({
          schema: targetSchema,
          compress,
          retentionDays,
        })
      : await dbBackupService.performIncrementalBackup({
          schema: targetSchema,
        });

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.success
        ? `${type === 'full' ? '全量' : '增量'}备份完成: ${result.backupId}`
        : `备份失败: ${result.error}`,
    });

  } catch (error) {
    console.error('[API] 触发备份失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
