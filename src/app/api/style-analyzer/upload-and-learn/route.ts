/**
 * 文件上传学习 API
 * POST /api/style-analyzer/upload-and-learn
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
  // 创建保存目录
  const saveDir = path.join(process.cwd(), 'data', 'articles', agent, category);
  if (!existsSync(saveDir)) {
    await mkdir(saveDir, { recursive: true });
  }

  // 生成文件名
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(file.name) || '.txt';
  const filename = `${timestamp}_${random}${ext}`;
  const filepath = path.join(saveDir, filename);

  // 保存文件
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(filepath, buffer);

  return filepath;
}

/**
 * 读取文件内容
 */
async function readUploadedFile(file: File): Promise<string> {
  const text = await file.text();
  return text;
}

/**
 * POST /api/style-analyzer/upload-and-learn
 * 上传单个文件并学习风格
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const formData = await request.formData();

    // 获取参数
    const file = formData.get('file') as File;
    const categoryName = formData.get('categoryName') as string || '通用';
    const agent = formData.get('agent') as string || 'insurance-d';
    const saveFile = formData.get('saveFile') === 'true';

    // 参数验证
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：必须上传文件',
        },
        { status: 400 }
      );
    }

    // 读取文件内容
    const content = await readUploadedFile(file);

    if (content.length < 50) {
      return NextResponse.json(
        {
          success: false,
          error: '文件内容过短，至少需要 50 个字符',
        },
        { status: 400 }
      );
    }

    // 保存文件（如果需要）
    let savedPath = '';
    if (saveFile) {
      try {
        savedPath = await saveUploadedFile(file, agent, categoryName);
      } catch (error) {
        console.error('保存文件失败:', error);
      }
    }

    // 执行风格分析
    const analysisResult = await styleAnalyzer.analyzeStyle({
      articles: [content],
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
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
          savedPath: savedPath || null,
        },
      },
    });
  } catch (error: any) {
    console.error('文件上传学习失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '文件上传学习失败',
      },
      { status: 500 }
    );
  }
}
