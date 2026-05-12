/**
 * 数据库查询工具 - 彻底解决 bytea/UUID 查询问题
 * 
 * 功能：
 * 1. 自动检测 UUID 格式并正确转换
 * 2. 提供统一的查询接口
 * 3. 支持 agent_sub_tasks_step_history 表的查询
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * 将 UUID 字符串转换为 bytea 查询格式
 */
export function uuidToByteaQuery(uuidStr: string): Buffer {
  // 移除横线并转换为 Buffer
  const hexStr = uuidStr.replace(/-/g, '');
  return Buffer.from(hexStr, 'hex');
}

/**
 * 将 bytea 数据转换为 UUID 字符串
 */
export function byteaToUuid(byteaData: Buffer | string): string {
  if (typeof byteaData === 'string') {
    // 如果是十六进制字符串（如 \\x...）
    if (byteaData.startsWith('\\x')) {
      byteaData = byteaData.slice(2);
    }
    // 添加横线
    return `${byteaData.slice(0, 8)}-${byteaData.slice(8, 12)}-${byteaData.slice(12, 16)}-${byteaData.slice(16, 20)}-${byteaData.slice(20, 32)}`;
  }
  
  // 如果是 Buffer
  const hexStr = byteaData.toString('hex');
  return `${hexStr.slice(0, 8)}-${hexStr.slice(8, 12)}-${hexStr.slice(12, 16)}-${hexStr.slice(16, 20)}-${hexStr.slice(20, 32)}`;
}

/**
 * 查询 step_history 记录 - 自动处理 UUID/bytea 转换
 */
export async function queryStepHistory(commandResultId: string) {
  try {
    // 方法1: 使用 SQL 直接查询，PostgreSQL 会自动转换
    const result = await db.execute(sql`
      SELECT 
        id,
        command_result_id,
        step_no,
        interact_type,
        interact_content,
        created_at
      FROM agent_sub_tasks_step_history 
      WHERE command_result_id = ${commandResultId}::uuid
      ORDER BY step_no ASC
    `);

    return {
      success: true,
      count: result.rows.length,
      records: result.rows.map((row: any) => ({
        id: row.id,
        commandResultId: row.command_result_id,
        stepNo: row.step_no,
        interactType: row.interact_type,
        interactContent: row.interact_content,
        createdAt: row.created_at,
      })),
    };
  } catch (error) {
    console.error('查询 step_history 失败:', error);
    return {
      success: false,
      count: 0,
      records: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 批量查询多个 subtask 的 step_history
 */
export async function queryStepHistoryBatch(commandResultIds: string[]) {
  const results: Record<string, any> = {};
  
  for (const id of commandResultIds) {
    results[id] = await queryStepHistory(id);
  }
  
  return results;
}

/**
 * 检查 step_history 表的完整状态
 */
export async function checkStepHistoryStatus() {
  try {
    // 1. 总记录数
    const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM agent_sub_tasks_step_history`);
    const totalCount = parseInt(totalResult.rows[0]?.count || '0');

    // 2. 最近的记录
    const recentResult = await db.execute(sql`
      SELECT 
        id,
        encode(command_result_id::bytea, 'hex') as cmd_id_hex,
        step_no,
        interact_type,
        created_at
      FROM agent_sub_tasks_step_history
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // 3. 按 command_result_id 分组统计
    const groupResult = await db.execute(sql`
      SELECT 
        encode(command_result_id::bytea, 'hex') as cmd_id_hex,
        COUNT(*) as count
      FROM agent_sub_tasks_step_history
      GROUP BY command_result_id
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);

    return {
      totalCount,
      recentRecords: recentResult.rows,
      topGroups: groupResult.rows,
    };
  } catch (error) {
    console.error('检查 step_history 状态失败:', error);
    return {
      totalCount: 0,
      recentRecords: [],
      topGroups: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 验证 UUID 格式
 */
export function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * 标准化 UUID 格式（确保有横线）
 */
export function normalizeUuid(str: string): string {
  // 移除所有横线和空格
  const clean = str.replace(/[-\s]/g, '').toLowerCase();
  
  if (clean.length !== 32) {
    throw new Error(`Invalid UUID length: ${clean.length}, expected 32`);
  }
  
  // 添加横线
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`;
}
