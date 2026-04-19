/**
 * 保险案例初始化 API
 * 
 * GET /api/cases/init-insurance-cases?reimport=1
 * 
 * 解析 assets 目录下的保险案例 MD 文件，导入到数据库
 * reimport=1 时先清空旧数据再重新导入（用于修复重复数据）
 */

import { NextRequest, NextResponse } from 'next/server';
import { industryCaseService } from '@/lib/services/industry-case-service';
import { db } from '@/lib/db';
import { industryCaseLibrary } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { join } from 'path';
import { existsSync } from 'fs';

// 案例文件列表
const CASE_FILES = [
  '保险行业标准化案例库（AI专属·MD格式·险种分类） (1-6).md',
  '保险行业标准化案例库（AI专属·MD格式·险种分类） (7-10).md',
  '保险行业标准化案例库（增额寿、年金）.md',
  '保险行业标准化案例库（8.8预定利率）.md', // 新增：8.8%预定利率历史案例
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reimport = searchParams.get('reimport') === '1';
    
    const workspacePath = process.env.COZE_WORKSPACE_PATH || '/workspace/projects';
    const assetsDir = join(workspacePath, 'assets');
    
    console.log('[CaseInit] 开始初始化保险案例...');
    console.log(`[CaseInit] 资源目录: ${assetsDir}`);
    
    // 清空旧数据（reimport 模式）
    let deletedCount = 0;
    if (reimport) {
      console.log('[CaseInit] reimport 模式：清空旧数据...');
      const deleteResult = await db
        .delete(industryCaseLibrary)
        .where(eq(industryCaseLibrary.industry, 'insurance'))
        .returning({ id: industryCaseLibrary.id });
      deletedCount = deleteResult.length;
      console.log(`[CaseInit] 已删除 ${deletedCount} 条旧数据`);
    }
    
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const fileResults: { file: string; success: number; failed: number; skipped: number }[] = [];
    
    for (const fileName of CASE_FILES) {
      const filePath = join(assetsDir, fileName);
      console.log(`[CaseInit] 处理文件: ${fileName}`);
      
      if (!existsSync(filePath)) {
        console.log(`[CaseInit] 文件不存在，跳过: ${fileName}`);
        continue;
      }
      
      // 解析案例文件
      const cases = industryCaseService.parseInsuranceCaseFile(filePath);
      
      if (cases.length === 0) {
        console.log(`[CaseInit] 未解析出案例: ${fileName}`);
        continue;
      }
      
      // 导入数据库（含去重）
      const result = await industryCaseService.importCases(cases);
      totalSuccess += result.success;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
      
      fileResults.push({
        file: fileName,
        success: result.success,
        failed: result.failed,
        skipped: result.skipped,
      });
    }
    
    // 获取统计
    const stats = await industryCaseService.getCaseStats('insurance');
    
    return NextResponse.json({
      success: true,
      message: reimport ? '保险案例重新导入完成' : '保险案例初始化完成',
      summary: {
        deletedOld: deletedCount,
        totalSuccess,
        totalFailed,
        totalSkipped,
        fileResults,
      },
      stats,
    });
  } catch (error) {
    console.error('[CaseInit] 初始化失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
