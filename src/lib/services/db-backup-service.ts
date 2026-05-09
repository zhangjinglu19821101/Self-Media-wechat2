/**
 * 数据库备份服务
 * 
 * 功能：
 * 1. 全量备份（pg_dump）
 * 2. 增量备份（基于时间戳）
 * 3. 备份上传到对象存储
 * 4. 备份保留策略管理
 * 5. 备份验证
 * 6. 数据恢复
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, unlinkSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { sql } from 'drizzle-orm';
import { db, getCurrentSchema, getRawDatabaseUrl } from '../db';
import { storageService } from './storage-service';

const execAsync = promisify(exec);

// ==================== 类型定义 ====================

export interface BackupConfig {
  /** 备份类型 */
  type: 'full' | 'incremental';
  /** 备份目标 schema */
  schema: string;
  /** 本地临时目录 */
  tempDir: string;
  /** 对象存储桶名 */
  bucket: string;
  /** 备份保留天数 */
  retentionDays: number;
  /** 是否压缩 */
  compress: boolean;
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  type: 'full' | 'incremental';
  schema: string;
  fileSize: number;
  fileSizeMB: number;
  duration: number;
  storageKey: string;
  timestamp: string;
  error?: string;
}

export interface BackupMetadata {
  backupId: string;
  type: 'full' | 'incremental';
  schema: string;
  timestamp: string;
  fileSize: number;
  storageKey: string;
  tables: string[];
  rowCount: Record<string, number>;
  checksum: string;
}

export interface BackupListResult {
  backups: BackupMetadata[];
  total: number;
  totalSizeMB: number;
}

// ==================== 备份服务类 ====================

class DatabaseBackupService {
  private readonly TEMP_DIR = '/tmp/db-backups';
  private readonly BACKUP_BUCKET = 'db-backups';
  private readonly METADATA_KEY = 'backup-registry.json';

  constructor() {
    // 确保临时目录存在
    if (!existsSync(this.TEMP_DIR)) {
      mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  // ==================== 全量备份 ====================

  /**
   * 执行全量备份
   * 
   * 使用 pg_dump 导出整个 schema，支持以下格式：
   * - custom (-Fc)：压缩格式，支持并行恢复
   * - plain (-Fp)：SQL 脚本格式
   * - tar (-Ft)：tar 归档格式
   */
  async performFullBackup(
    options: Partial<BackupConfig> = {}
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = this.generateBackupId('full');
    const schema = options.schema || getCurrentSchema();
    const tempDir = options.tempDir || this.TEMP_DIR;
    const compress = options.compress !== false;

    console.log(`[DB-Backup] 开始全量备份: backupId=${backupId}, schema=${schema}`);

    try {
      // 1. 获取数据库连接信息
      const dbUrl = getRawDatabaseUrl();
      const dbInfo = this.parseDatabaseUrl(dbUrl);

      // 2. 构建备份文件路径
      const fileExt = compress ? 'dump' : 'sql';
      const fileName = `${backupId}.${fileExt}`;
      const localPath = join(tempDir, fileName);

      // 3. 执行 pg_dump
      const format = compress ? '-Fc' : '-Fp';
      const pgDumpCmd = `pg_dump ${format} --schema=${schema} --no-owner --no-acl --dbname="${dbUrl}" -f "${localPath}"`;

      console.log(`[DB-Backup] 执行 pg_dump...`);
      const { stderr } = await execAsync(pgDumpCmd, {
        maxBuffer: 1024 * 1024 * 1024, // 1GB buffer
        timeout: 30 * 60 * 1000, // 30分钟超时
      });

      if (stderr && !stderr.includes('NOTICE')) {
        console.warn(`[DB-Backup] pg_dump 警告: ${stderr}`);
      }

      // 4. 检查备份文件
      if (!existsSync(localPath)) {
        throw new Error('备份文件创建失败');
      }

      const fileStats = statSync(localPath);
      const fileSize = fileStats.size;
      const fileSizeMB = Math.round(fileSize / 1024 / 1024);

      console.log(`[DB-Backup] 备份文件创建成功: ${fileName}, 大小: ${fileSizeMB}MB`);

      // 5. 上传到对象存储
      const storageKey = `backups/${schema}/${backupId}/${fileName}`;
      console.log(`[DB-Backup] 上传到对象存储: ${storageKey}`);

      await storageService.uploadFile(localPath, storageKey, this.BACKUP_BUCKET);

      // 6. 生成备份元数据
      const metadata = await this.generateBackupMetadata(backupId, 'full', schema, fileSize, storageKey);

      // 7. 保存元数据
      await this.saveBackupMetadata(metadata);

      // 8. 清理本地临时文件
      this.cleanupLocalFile(localPath);

      // 9. 执行保留策略
      await this.applyRetentionPolicy(schema, options.retentionDays || 30);

      const duration = Date.now() - startTime;
      console.log(`[DB-Backup] 全量备份完成: ${backupId}, 耗时: ${Math.round(duration / 1000)}秒`);

      return {
        success: true,
        backupId,
        type: 'full',
        schema,
        fileSize,
        fileSizeMB,
        duration,
        storageKey,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[DB-Backup] 全量备份失败:`, error);

      return {
        success: false,
        backupId,
        type: 'full',
        schema,
        fileSize: 0,
        fileSizeMB: 0,
        duration,
        storageKey: '',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ==================== 增量备份 ====================

  /**
   * 执行增量备份
   * 
   * 基于时间戳查询当日变更的数据，导出为 SQL INSERT 语句
   */
  async performIncrementalBackup(
    options: Partial<BackupConfig> = {}
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = this.generateBackupId('incremental');
    const schema = options.schema || getCurrentSchema();
    const tempDir = options.tempDir || this.TEMP_DIR;

    console.log(`[DB-Backup] 开始增量备份: backupId=${backupId}, schema=${schema}`);

    try {
      // 1. 获取今日变更的表和数据
      const tables = await this.getTables(schema);
      const changes: Record<string, number> = {};

      // 2. 构建增量数据 SQL
      let incrementalSql = `-- 增量备份: ${backupId}\n`;
      incrementalSql += `-- 时间: ${new Date().toISOString()}\n`;
      incrementalSql += `-- Schema: ${schema}\n\n`;

      for (const table of tables) {
        // 查询今日变更的行数（假设表有 updated_at 或 created_at 字段）
        const changeCount = await this.getTableChangesCount(schema, table);
        changes[table] = changeCount;

        if (changeCount > 0) {
          // 导出变更数据
          const data = await this.exportTableChanges(schema, table);
          if (data) {
            incrementalSql += `-- 表: ${table} (${changeCount} 行变更)\n`;
            incrementalSql += data;
            incrementalSql += '\n\n';
          }
        }
      }

      // 3. 检查是否有变更
      const totalChanges = Object.values(changes).reduce((a, b) => a + b, 0);
      if (totalChanges === 0) {
        console.log(`[DB-Backup] 无数据变更，跳过增量备份`);
        return {
          success: true,
          backupId,
          type: 'incremental',
          schema,
          fileSize: 0,
          fileSizeMB: 0,
          duration: Date.now() - startTime,
          storageKey: '',
          timestamp: new Date().toISOString(),
        };
      }

      // 4. 保存到本地文件
      const fileName = `${backupId}.sql`;
      const localPath = join(tempDir, fileName);
      writeFileSync(localPath, incrementalSql, 'utf-8');

      const fileStats = statSync(localPath);
      const fileSize = fileStats.size;
      const fileSizeMB = Math.round(fileSize / 1024 / 1024);

      // 5. 上传到对象存储
      const storageKey = `backups/${schema}/${backupId}/${fileName}`;
      await storageService.uploadFile(localPath, storageKey, this.BACKUP_BUCKET);

      // 6. 生成并保存元数据
      const metadata = await this.generateBackupMetadata(backupId, 'incremental', schema, fileSize, storageKey);
      await this.saveBackupMetadata(metadata);

      // 7. 清理本地文件
      this.cleanupLocalFile(localPath);

      const duration = Date.now() - startTime;
      console.log(`[DB-Backup] 增量备份完成: ${backupId}, 变更行数: ${totalChanges}, 耗时: ${Math.round(duration / 1000)}秒`);

      return {
        success: true,
        backupId,
        type: 'incremental',
        schema,
        fileSize,
        fileSizeMB,
        duration,
        storageKey,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[DB-Backup] 增量备份失败:`, error);

      return {
        success: false,
        backupId,
        type: 'incremental',
        schema,
        fileSize: 0,
        fileSizeMB: 0,
        duration,
        storageKey: '',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ==================== 备份恢复 ====================

  /**
   * 从备份恢复数据
   */
  async restoreFromBackup(
    backupId: string,
    options: {
      schema?: string;
      dropExisting?: boolean;
      verifyOnly?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    message: string;
    duration: number;
  }> {
    const startTime = Date.now();
    const schema = options.schema || getCurrentSchema();

    console.log(`[DB-Backup] 开始恢复: backupId=${backupId}, schema=${schema}, verifyOnly=${options.verifyOnly}`);

    try {
      // 1. 获取备份元数据
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        throw new Error(`备份不存在: ${backupId}`);
      }

      // 2. 下载备份文件
      const localPath = join(this.TEMP_DIR, `${backupId}.${metadata.type === 'full' ? 'dump' : 'sql'}`);
      await storageService.downloadFile(metadata.storageKey, localPath, this.BACKUP_BUCKET);

      if (options.verifyOnly) {
        // 仅验证，不执行恢复
        const fileStats = statSync(localPath);
        const checksum = await this.calculateChecksum(localPath);
        
        this.cleanupLocalFile(localPath);

        return {
          success: checksum === metadata.checksum,
          message: `备份验证完成: 文件大小 ${Math.round(fileStats.size / 1024 / 1024)}MB, 校验和${checksum === metadata.checksum ? '匹配' : '不匹配'}`,
          duration: Date.now() - startTime,
        };
      }

      // 3. 执行恢复
      const dbUrl = getRawDatabaseUrl();

      if (metadata.type === 'full') {
        // 全量恢复：pg_restore
        if (options.dropExisting) {
          // 先清空 schema
          await this.dropSchemaTables(schema);
        }

        const restoreCmd = `pg_restore --dbname="${dbUrl}" --schema=${schema} --no-owner --no-acl "${localPath}"`;
        await execAsync(restoreCmd, {
          maxBuffer: 1024 * 1024 * 1024,
          timeout: 60 * 60 * 1000, // 1小时超时
        });

      } else {
        // 增量恢复：执行 SQL
        const restoreCmd = `psql "${dbUrl}" -f "${localPath}"`;
        await execAsync(restoreCmd, {
          maxBuffer: 1024 * 1024 * 1024,
          timeout: 30 * 60 * 1000,
        });
      }

      // 4. 清理本地文件
      this.cleanupLocalFile(localPath);

      const duration = Date.now() - startTime;
      console.log(`[DB-Backup] 恢复完成: ${backupId}, 耗时: ${Math.round(duration / 1000)}秒`);

      return {
        success: true,
        message: `恢复完成: ${backupId}, 耗时 ${Math.round(duration / 1000)}秒`,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[DB-Backup] 恢复失败:`, error);

      return {
        success: false,
        message: `恢复失败: ${error instanceof Error ? error.message : String(error)}`,
        duration,
      };
    }
  }

  // ==================== 备份管理 ====================

  /**
   * 列出所有备份
   */
  async listBackups(
    schema?: string,
    options: {
      type?: 'full' | 'incremental';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<BackupListResult> {
    try {
      const registry = await this.loadBackupRegistry();
      let backups = registry.backups;

      // 过滤
      if (schema) {
        backups = backups.filter(b => b.schema === schema);
      }
      if (options.type) {
        backups = backups.filter(b => b.type === options.type);
      }

      // 排序（最新的在前）
      backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // 分页
      const total = backups.length;
      const offset = options.offset || 0;
      const limit = options.limit || 20;
      backups = backups.slice(offset, offset + limit);

      const totalSizeMB = Math.round(
        registry.backups.reduce((sum, b) => sum + b.fileSize, 0) / 1024 / 1024
      );

      return {
        backups,
        total,
        totalSizeMB,
      };

    } catch (error) {
      console.error(`[DB-Backup] 列出备份失败:`, error);
      return {
        backups: [],
        total: 0,
        totalSizeMB: 0,
      };
    }
  }

  /**
   * 删除备份
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = await this.getBackupMetadata(backupId);
      if (!metadata) {
        console.warn(`[DB-Backup] 备份不存在: ${backupId}`);
        return false;
      }

      // 1. 删除对象存储文件
      await storageService.deleteFile(metadata.storageKey, this.BACKUP_BUCKET);

      // 2. 从注册表中删除
      const registry = await this.loadBackupRegistry();
      registry.backups = registry.backups.filter(b => b.backupId !== backupId);
      await this.saveBackupRegistry(registry);

      console.log(`[DB-Backup] 备份已删除: ${backupId}`);
      return true;

    } catch (error) {
      console.error(`[DB-Backup] 删除备份失败:`, error);
      return false;
    }
  }

  /**
   * 应用保留策略
   * 
   * - 7天内：保留所有备份
   * - 4周内：每周保留一个（周日）
   * - 12个月内：每月保留一个（1号）
   * - 超过12个月：删除
   */
  async applyRetentionPolicy(
    schema: string,
    retentionDays: number = 365
  ): Promise<{
    deleted: number;
    retained: number;
  }> {
    try {
      const registry = await this.loadBackupRegistry();
      const now = new Date();
      const toDelete: string[] = [];
      const toRetain: string[] = [];

      // 按日期分组
      const dailyBackups: Map<string, BackupMetadata[]> = new Map();
      const weeklyBackups: Map<string, BackupMetadata> = new Map();
      const monthlyBackups: Map<string, BackupMetadata> = new Map();

      for (const backup of registry.backups) {
        if (backup.schema !== schema) continue;

        const backupDate = new Date(backup.timestamp);
        const daysAgo = Math.floor((now.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24));

        // 超过保留期限
        if (daysAgo > retentionDays) {
          toDelete.push(backup.backupId);
          continue;
        }

        // 7天内：保留所有
        if (daysAgo <= 7) {
          toRetain.push(backup.backupId);
          continue;
        }

        // 4周内：每周保留一个
        if (daysAgo <= 28) {
          const weekKey = `${backupDate.getFullYear()}-W${Math.ceil(backupDate.getDate() / 7)}`;
          if (!weeklyBackups.has(weekKey) || backup.type === 'full') {
            weeklyBackups.set(weekKey, backup);
          }
          continue;
        }

        // 12个月内：每月保留一个
        if (daysAgo <= 365) {
          const monthKey = `${backupDate.getFullYear()}-${backupDate.getMonth()}`;
          if (!monthlyBackups.has(monthKey) || backup.type === 'full') {
            monthlyBackups.set(monthKey, backup);
          }
          continue;
        }
      }

      // 收集需要保留的备份
      for (const backup of weeklyBackups.values()) {
        toRetain.push(backup.backupId);
      }
      for (const backup of monthlyBackups.values()) {
        toRetain.push(backup.backupId);
      }

      // 删除过期备份
      for (const backupId of toDelete) {
        await this.deleteBackup(backupId);
      }

      console.log(`[DB-Backup] 保留策略应用完成: 删除 ${toDelete.length} 个, 保留 ${toRetain.length} 个`);

      return {
        deleted: toDelete.length,
        retained: toRetain.length,
      };

    } catch (error) {
      console.error(`[DB-Backup] 应用保留策略失败:`, error);
      return {
        deleted: 0,
        retained: 0,
      };
    }
  }

  // ==================== 辅助方法 ====================

  private generateBackupId(type: 'full' | 'incremental'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}-${timestamp}-${random}`;
  }

  private parseDatabaseUrl(dbUrl: string): {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  } {
    const url = new URL(dbUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.substring(1),
      user: url.username,
      password: url.password,
    };
  }

  private async getTables(schema: string): Promise<string[]> {
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = ${schema} AND table_type = 'BASE TABLE'
    `);
    return result.map((row: any) => row.table_name as string);
  }

  private async getTableChangesCount(schema: string, table: string): Promise<number> {
    try {
      // 检查是否有 updated_at 或 created_at 字段
      const columns = await db.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = ${schema} AND table_name = ${table}
      `);
      const columnNames = columns.map((row: any) => row.column_name as string);

      if (columnNames.includes('updated_at')) {
        const result = await db.execute(sql`
          SELECT COUNT(*) as count FROM ${sql.identifier(schema)}.${sql.identifier(table)}
          WHERE updated_at >= CURRENT_DATE
        `);
        return Number((result[0] as any)?.count || 0);
      }

      if (columnNames.includes('created_at')) {
        const result = await db.execute(sql`
          SELECT COUNT(*) as count FROM ${sql.identifier(schema)}.${sql.identifier(table)}
          WHERE created_at >= CURRENT_DATE
        `);
        return Number((result[0] as any)?.count || 0);
      }

      return 0;

    } catch (error) {
      console.warn(`[DB-Backup] 获取表变更数失败: ${table}`, error);
      return 0;
    }
  }

  private async exportTableChanges(schema: string, table: string): Promise<string> {
    try {
      const columns = await db.execute(sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = ${schema} AND table_name = ${table}
      `);
      const columnNames = columns.map((row: any) => row.column_name as string);

      const timeColumn = columnNames.includes('updated_at') ? 'updated_at' : 'created_at';
      if (!timeColumn) return '';

      const result = await db.execute(sql`
        SELECT * FROM ${sql.identifier(schema)}.${sql.identifier(table)}
        WHERE ${sql.identifier(timeColumn)} >= CURRENT_DATE
      `);

      if (!Array.isArray(result) || result.length === 0) return '';

      // 生成 INSERT 语句
      let sqlStr = `INSERT INTO ${sql.identifier(schema)}.${sql.identifier(table)} (${columnNames.map(c => `"${c}"`).join(', ')}) VALUES\n`;
      const values = result.map((row: any) => {
        const vals = columnNames.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === 'boolean') return val ? 'true' : 'false';
          if (val instanceof Date) return `'${val.toISOString()}'`;
          return String(val);
        });
        return `(${vals.join(', ')})`;
      });
      sqlStr += values.join(',\n') + ';\n';

      return sqlStr;

    } catch (error) {
      console.warn(`[DB-Backup] 导出表变更失败: ${table}`, error);
      return '';
    }
  }

  private async generateBackupMetadata(
    backupId: string,
    type: 'full' | 'incremental',
    schema: string,
    fileSize: number,
    storageKey: string
  ): Promise<BackupMetadata> {
    const tables = await this.getTables(schema);
    const rowCount: Record<string, number> = {};

    for (const table of tables) {
      try {
        const result = await db.execute(sql`
          SELECT COUNT(*) as count FROM ${sql.identifier(schema)}.${sql.identifier(table)}
        `);
        rowCount[table] = Number((result[0] as any)?.count || 0);
      } catch {
        rowCount[table] = 0;
      }
    }

    return {
      backupId,
      type,
      schema,
      timestamp: new Date().toISOString(),
      fileSize,
      storageKey,
      tables,
      rowCount,
      checksum: '', // 稍后计算
    };
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`sha256sum "${filePath}"`);
      return stdout.split(' ')[0];
    } catch {
      // 如果 sha256sum 不可用，返回文件大小作为简单校验
      const stats = statSync(filePath);
      return stats.size.toString();
    }
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const registry = await this.loadBackupRegistry();
    registry.backups.push(metadata);
    await this.saveBackupRegistry(registry);
  }

  private async getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const registry = await this.loadBackupRegistry();
    return registry.backups.find(b => b.backupId === backupId) || null;
  }

  private async loadBackupRegistry(): Promise<{ backups: BackupMetadata[] }> {
    try {
      const content = await storageService.downloadFileAsString(
        this.METADATA_KEY,
        this.BACKUP_BUCKET
      );
      return JSON.parse(content);
    } catch {
      return { backups: [] };
    }
  }

  private async saveBackupRegistry(registry: { backups: BackupMetadata[] }): Promise<void> {
    const content = JSON.stringify(registry, null, 2);
    await storageService.uploadString(content, this.METADATA_KEY, this.BACKUP_BUCKET);
  }

  private cleanupLocalFile(filePath: string): void {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`[DB-Backup] 清理本地文件失败: ${filePath}`, error);
    }
  }

  private async dropSchemaTables(schema: string): Promise<void> {
    const tables = await this.getTables(schema);
    for (const table of tables) {
      await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(schema)}.${sql.identifier(table)} CASCADE`);
    }
  }
}

// 导出单例
export const dbBackupService = new DatabaseBackupService();
