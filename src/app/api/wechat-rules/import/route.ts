// 微信公众号合规规则一键导入 API

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createVectorImporter } from '@/lib/rag/vector-importer';

/**
 * POST /api/wechat-rules/import
 * 一键导入微信公众号合规规则到知识库
 */
export async function POST(request: NextRequest) {
  try {
    // 规则文件路径
    const rulesFilePath = path.join(
      process.cwd(),
      'backup/download_log/AgentB/公众号合规规则合并.md'
    );

    // 检查文件是否存在
    try {
      await fs.access(rulesFilePath);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: '规则文件不存在：' + rulesFilePath
        },
        { status: 404 }
      );
    }

    // 读取文件内容
    console.log('[WeChat Rules Import] 读取规则文件...');
    const rulesContent = await fs.readFile(rulesFilePath, 'utf-8');
    console.log(`[WeChat Rules Import] 文件读取成功，大小：${rulesContent.length} 字节`);

    // 导入到知识库
    console.log('[WeChat Rules Import] 开始导入到知识库...');
    const importer = createVectorImporter();
    const chunkCount = await importer.importDocument(
      rulesContent,
      {
        source: rulesFilePath,
        title: '微信公众号合规规则合并文档',
        document_type: 'compliance_rules',
        platform: 'wechat',
        category: '合规规则',
        created_date: '2026-02-07',
        version: 'merged_v1.0',
      },
      {
        collectionName: 'wechat_compliance_rules',
      }
    );

    console.log(`[WeChat Rules Import] 导入成功，分块数：${chunkCount}`);

    return NextResponse.json({
      success: true,
      message: '微信公众号合规规则导入成功',
      chunkCount,
      documentCount: 1,
      collectionName: 'wechat_compliance_rules',
    });
  } catch (error: any) {
    console.error('[WeChat Rules Import] 导入失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '导入失败',
      },
      { status: 500 }
    );
  }
}
