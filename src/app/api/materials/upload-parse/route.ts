import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';
import { handleRouteError } from '@/lib/api/route-error-handler';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * POST /api/materials/upload-parse
 * 解析上传的文件为纯文本
 *
 * 支持格式：
 * - .txt/.md/.html/.csv/.json → 前端直接读取（不经过此接口）
 * - .pdf  → pdf-parse 提取文本
 * - .docx → mammoth 提取文本
 * - .jpg/.jpeg/.png/.webp/.gif → LLM 视觉模型识别文字内容
 */

/** 图片扩展名集合 */
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** 图片 MIME 类型 */
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);

/** 判断文件是否为图片 */
function isImageFile(ext: string, mimeType: string): boolean {
  return IMAGE_EXTENSIONS.has(ext) || IMAGE_MIME_TYPES.has(mimeType);
}

/**
 * 使用 LLM 视觉模型识别图片中的文字内容
 *
 * doubao-seed 系列模型支持多模态输入，可以识别图片中的文字、表格、图表等
 */
async function extractTextFromImage(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  workspaceId?: string
): Promise<string> {
  // 将图片转为 base64
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  console.log(`[upload-parse] 🖼️ 开始 LLM 视觉识别: ${fileName} (${(buffer.length / 1024).toFixed(1)}KB)`);

  // 创建 LLM 客户端（BYOK: 优先使用用户 Key）
  const { client: llmClient } = await createUserLLMClient(workspaceId, { timeout: 30_000 });

  const response = await llmClient.invoke(
    [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `请仔细识别这张图片中的所有文字内容，并完整输出。

要求：
1. 完整提取图片中的所有可见文字，不要遗漏任何信息
2. 保持原文的段落结构和顺序
3. 如果图片包含表格数据，用 Markdown 表格格式输出
4. 如果图片是截图/海报/文档照片，按阅读顺序提取全部文本
5. 只输出提取的文字内容，不要添加任何解释或说明

请开始：`,
          },
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
    {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.1, // 低温度保证提取准确性
    }
  );

  const extractedText = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content);

  console.log(`[upload-parse] ✅ 视觉识别完成: ${extractedText.length} 字符`);

  return extractedText;
}

export async function POST(request: NextRequest) {
  try {
    // BYOK: 获取 workspaceId 传递给 LLM 调用
    const workspaceId = await getWorkspaceId(request);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '未上传文件' }, { status: 400 });
    }

    // 文件大小限制：5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请小于 5MB` },
        { status: 400 }
      );
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let content = '';

    // ═══ 图片格式：LLM 视觉识别 ═══
    if (isImageFile(ext, file.type)) {
      try {
        content = await extractTextFromImage(buffer, file.name, file.type, workspaceId);
      } catch (err) {
        console.error('[upload-parse] 图片视觉识别失败:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { success: false, error: `图片识别失败：${errMsg}` },
          { status: 422 }
        );
      }
    }
    // ═══ PDF 格式 ═══
    else if (ext === '.pdf') {
      try {
        const pdfParseModule = await import('pdf-parse');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await (pdfParseModule as any)(buffer);
        content = data.text;
      } catch (err) {
        console.error('[upload-parse] PDF 解析失败:', err);
        return NextResponse.json(
          { success: false, error: 'PDF 解析失败，可能是扫描版或加密 PDF' },
          { status: 422 }
        );
      }
    }
    // ═══ DOCX 格式 ═══
    else if (ext === '.docx') {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        content = result.value;
      } catch (err) {
        console.error('[upload-parse] DOCX 解析失败:', err);
        return NextResponse.json(
          { success: false, error: 'DOCX 解析失败，文件可能已损坏' },
          { status: 422 }
        );
      }
    }
    // ═══ 不支持的格式 ═══
    else {
      return NextResponse.json(
        {
          success: false,
          error: `不支持的格式：${ext}。支持 .jpg/.png/.webp/.gif/.pdf/.docx（纯文本 .txt/.md 请直接粘贴）`,
        },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: '文件内容为空，可能是空白图片或空文档' },
        { status: 422 }
      );
    }

    console.log(`[upload-parse] ✅ ${file.name} (${(buffer.length / 1024).toFixed(1)}KB) → ${content.length} 字符`);

    return NextResponse.json({
      success: true,
      content: content.trim(),
      fileName: file.name,
      fileSize: file.size,
      charCount: content.length,
    });

  } catch (err) {
    console.error('[upload-parse] 内部错误:', err);
    return handleRouteError(err, '服务器内部错误，请稍后重试');
  }
}
