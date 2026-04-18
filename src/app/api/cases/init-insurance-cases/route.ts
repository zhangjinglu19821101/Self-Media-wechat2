/**
 * 保险案例初始化 API
 * 
 * GET /api/cases/init-insurance-cases
 * 
 * 解析 assets 目录下的保险案例 MD 文件，导入到数据库
 */

import { NextRequest, NextResponse } from 'next/server';
import { industryCaseService } from '@/lib/services/industry-case-service';
import { join } from 'path';
import { existsSync } from 'fs';

// 案例文件列表
const CASE_FILES = [
  '保险行业标准化案例库（AI专属·MD格式·险种分类） (1-6).md',
  '保险行业标准化案例库（AI专属·MD格式·险种分类） (7-10).md',
];

export async function GET(request: NextRequest) {
  try {
    const workspacePath = process.env.COZE_WORKSPACE_PATH || '/workspace/projects';
    const assetsDir = join(workspacePath, 'assets');
    
    console.log('[CaseInit] 开始初始化保险案例...');
    console.log(`[CaseInit] 资源目录: ${assetsDir}`);
    
    let totalSuccess = 0;
    let totalFailed = 0;
    const fileResults: { file: string; success: number; failed: number }[] = [];
    
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
      
      // 导入数据库
      const result = await industryCaseService.importCases(cases);
      totalSuccess += result.success;
      totalFailed += result.failed;
      
      fileResults.push({
        file: fileName,
        success: result.success,
        failed: result.failed,
      });
    }
    
    // 获取统计
    const stats = await industryCaseService.getCaseStats('insurance');
    
    return NextResponse.json({
      success: true,
      message: '保险案例初始化完成',
      summary: {
        totalSuccess,
        totalFailed,
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
