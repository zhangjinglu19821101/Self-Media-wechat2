/**
 * 批量文件上传学习 API
 * POST /api/style-analyzer/upload-batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { styleAnalyzer, styleLearner } from '@/lib/style-analyzer';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * 保存上传的文件
 */
async function saveUploadedFile(
  file: File,
  agent: string,
  category: string
): Promise<string> {
  const saveDir = path.join(process.cwd(), 'data', 'articles', agent, category);
  if (!existsSync(saveDir)) {
    await mkdir(saveDir, { recursive: true });
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(file.name) || '.txt';
  const filename = `${timestamp}_${random}${ext}`;
  const filepath = path.join(saveDir, filename);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(filepath, buffer);

  return filepath;
}

/**
 * POST /api/style-analyzer/upload-batch
 * 批量上传文件并学习风格
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const formData = await request.formData();

    // 获取参数
    const categoryName = formData.get('categoryName') as string || '通用';
    const agent = formData.get('agent') as string || 'insurance-d';
    const saveFiles = formData.get('saveFiles') === 'true';

    // 获取所有上传的文件
    const files: File[] = [];
    formData.forEach((value, key) => {
      if (key.startsWith('file') && value instanceof File) {
        files.push(value);
      }
    });

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：必须上传至少一个文件',
        },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：单次最多支持 10 个文件',
        },
        { status: 400 }
      );
    }

    // 读取所有文件内容
    const articles: string[] = [];
    const fileInfos: Array<{
      name: string;
      size: number;
      type: string;
      savedPath?: string;
    }> = [];
    const errors: Array<{ name: string; error: string }> = [];

    for (const file of files) {
      try {
        const content = await file.text();

        if (content.length < 50) {
          errors.push({
            name: file.name,
            error: '文件内容过短',
          });
          continue;
        }

        articles.push(content);

        const fileInfo: any = {
          name: file.name,
          size: file.size,
          type: file.type,
        };

        // 保存文件（如果需要）
        if (saveFiles) {
          try {
            fileInfo.savedPath = await saveUploadedFile(
              file,
              agent,
              categoryName
            );
          } catch (error) {
            console.error(`保存文件 ${file.name} 失败:`, error);
          }
        }

        fileInfos.push(fileInfo);
      } catch (error: any) {
        errors.push({
          name: file.name,
          error: error.message,
        });
      }
    }

    if (articles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '未能成功读取任何文件',
          errors,
        },
        { status: 500 }
      );
    }

    // 执行风格分析
    const analysisResult = await styleAnalyzer.analyzeStyle({
      articles,
      categoryName: `${agent}-${categoryName}`,
    });

    // 保存风格模板
    styleLearner.saveTemplate(analysisResult.template);

    return NextResponse.json({
      success: true,
      data: {
        template: analysisResult.template,
        summary: analysisResult.summary,
        recommendations: analysisResult.recommendations,
        statistics: {
          totalFiles: files.length,
          successCount: articles.length,
          failCount: errors.length,
        },
        fileInfos,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    console.error('批量上传学习失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '批量上传学习失败',
      },
      { status: 500 }
    );
  }
}
