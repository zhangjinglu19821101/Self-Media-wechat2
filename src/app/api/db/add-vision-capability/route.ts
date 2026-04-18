/**
 * 视觉识别 MCP 能力注册迁移
 * GET /api/db/add-vision-capability
 *
 * 向 capability_list 表插入 2 条视觉识别能力记录：
 * 1. ID 30: 视觉识别-图片文字提取 (image_ocr)
 * 2. ID 31: 视觉识别-图片内容分析 (image_analyze)
 *
 * 执行后：
 * - ToolAutoRegistrar 会自动从 capability_list 加载并注册到 ToolRegistry
 * - Agent T 通过 getAvailableTools() 发现 "vision" 工具
 * - Agent T 可在执行时返回 mcpParams 调用视觉能力
 *
 * 使用方式：
 * 1. 访问此接口完成数据库迁移
 * 2. 调用 /api/mcp/refresh-tools 刷新工具注册（或重启服务）
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/** 要插入的视觉能力定义 */
const VISION_CAPABILITIES = [
  {
    // ID 30: 图片文字提取
    capabilityType: 'vision',
    functionDesc: '视觉识别-图片文字提取：使用 LLM 视觉模型从图片中提取所有可见文字，支持截图、海报、文档照片、表格图片等场景',
    status: 'available',
    requiresOnSiteExecution: false,
    metadata: {
      model: 'doubao-seed-1-6-lite-251015',
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      maxSizeMB: 5,
      timeoutSeconds: 30,
      temperature: 0.1,
    },
    interfaceSchema: {
      type: 'object',
      properties: {
        imageBase64: { type: 'string', description: '图片的 base64 编码内容' },
        mimeType: { type: 'string', description: '图片 MIME 类型，如 image/jpeg, image/png' },
        fileName: { type: 'string', description: '原始文件名（可选，用于日志）' },
      },
      required: ['imageBase64', 'mimeType'],
    },
    agentResponseSpec: {
      format: 'JSON',
      fields: {
        success: { type: 'boolean', description: '是否成功' },
        data: {
          fileName: { type: 'string', description: '文件名' },
          type: { type: 'string', description: '固定值 ocr' },
          extractedText: { type: 'string', description: '提取的文字内容' },
          charCount: { type: 'number', description: '提取的字符数' },
          timestamp: { type: 'string', description: '执行时间' },
        },
        error: { type: 'string', description: '错误信息（失败时）' },
      },
    },
    toolName: 'vision',
    actionName: 'image_ocr',
    paramDesc: {
      imageBase64: '图片的 base64 编码字符串（必填）',
      mimeType: '图片 MIME 类型，支持 image/jpeg / image/png / image/webp / image/gif（必填）',
      fileName: '原始文件名，仅用于日志记录（可选）',
    },
    paramExamples: {
      imageBase64: '/9j/4AAQSkZJRg...（base64 编码的图片数据）',
      mimeType: 'image/jpeg',
      fileName: 'screenshot.png',
    },
    sceneTags: ['素材提取', 'OCR识别', '文档数字化', '表格提取'],
    exampleOutput: {
      success: true,
      data: {
        fileName: 'screenshot.png',
        type: 'ocr',
        extractedText: '根据国家金融监管总局2024年最新数据显示...',
        charCount: 1256,
        timestamp: '2026-04-11T10:00:00Z',
      },
    },
    supportedAgents: ['insurance-d', 'insurance-c', 'T'],
    agentSpecificParams: {},
    dedicatedTaskType: 'vision_ocr',
    dedicatedTaskPriority: 1,
    isPrimaryForTask: true,
  },
  {
    // ID 31: 图片内容分析
    capabilityType: 'vision',
    functionDesc: '视觉识别-图片内容分析：使用 LLM 视觉模型对图片进行深度分析，可指定分析方向（如"提取表格数据"、"分析图表趋势"），支持自定义分析指令',
    status: 'available',
    requiresOnSiteExecution: false,
    metadata: {
      model: 'doubao-seed-1-6-lite-251015',
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      maxSizeMB: 5,
      timeoutSeconds: 30,
      temperature: 0.2,
    },
    interfaceSchema: {
      type: 'object',
      properties: {
        imageBase64: { type: 'string', description: '图片的 base64 编码内容' },
        mimeType: { type: 'string', description: '图片 MIME 类型' },
        fileName: { type: 'string', description: '原始文件名（可选）' },
        instruction: { type: 'string', description: '分析指令（可选，如"提取表格数据"、"分析图表趋势"）' },
      },
      required: ['imageBase64', 'mimeType'],
    },
    agentResponseSpec: {
      format: 'JSON',
      fields: {
        success: { type: 'boolean' },
        data: {
          fileName: { type: 'string' },
          type: { type: 'string', description: '固定值 analysis' },
          instruction: { type: 'string', description: '使用的分析指令' },
          analysisText: { type: 'string', description: '分析结果文本' },
          charCount: { type: 'number' },
          timestamp: { type: 'string' },
        },
        error: { type: 'string' },
      },
    },
    toolName: 'vision',
    actionName: 'image_analyze',
    paramDesc: {
      imageBase64: '图片的 base64 编码字符串（必填）',
      mimeType: '图片 MIME 类型（必填）',
      fileName: '原始文件名（可选）',
      instruction: '分析指令，如"提取表格中的所有数据"、"分析这张图表的趋势和结论"（可选，不传则进行通用全面分析）',
    },
    paramExamples: {
      imageBase64: '/9j/4AAQSkZJRg...（base64 编码的图片数据）',
      mimeType: 'image/png',
      fileName: 'chart.png',
      instruction: '提取图表中的数据和趋势结论',
    },
    sceneTags: ['素材分析', '图表解读', '海报分析', '内容理解'],
    exampleOutput: {
      success: true,
      data: {
        fileName: 'chart.png',
        type: 'analysis',
        instruction: '提取图表中的数据和趋势结论',
        analysisText: '该图表展示了2023-2024年保险行业理赔数据...',
        charCount: 892,
        timestamp: '2026-04-11T10:00:00Z',
      },
    },
    supportedAgents: ['insurance-d', 'insurance-c', 'B', 'T'],
    agentSpecificParams: {},
    dedicatedTaskType: 'vision_analyze',
    dedicatedTaskPriority: 1,
    isPrimaryForTask: true,
  },
];

export async function GET() {
  const insertedIds: number[] = [];
  const skippedItems: string[] = [];

  try {
    console.log('[AddVisionCapability] 开始注册视觉识别 MCP 能力...');

    for (const cap of VISION_CAPABILITIES) {
      // 检查是否已存在（通过 toolName + actionName 唯一性）
      const existing = await db.execute(sql`
        SELECT id FROM capability_list
        WHERE tool_name = ${cap.toolName} AND action_name = ${cap.actionName}
        LIMIT 1
      `);

      if (existing.length > 0) {
        console.log(`[AddVisionCapability] ⏭️ 已存在: ${cap.toolName}/${cap.actionName} (id=${existing[0].id})`);
        skippedItems.push(`${cap.actionName} (已存在)`);
        continue;
      }

      // 插入新记录
      const result = await db.insert(capabilityList).values(cap).returning({ id: capabilityList.id });
      insertedIds.push(result[0].id);
      console.log(`[AddVisionCapability] ✅ 插入成功: ${cap.toolName}/${cap.actionName} (id=${result[0].id})`);
    }

    return NextResponse.json({
      success: true,
      message: `视觉识别 MCP 能力注册完成：${insertedIds.length} 个新增，${skippedItems.length} 个已跳过`,
      inserted: {
        count: insertedIds.length,
        ids: insertedIds,
        items: VISION_CAPABILITIES.filter((_, i) => !skippedItems[i]).map(c => ({
          toolName: c.toolName,
          actionName: c.actionName,
          functionDesc: c.functionDesc,
        })),
      },
      skipped: {
        count: skippedItems.length,
        items: skippedItems,
      },
      nextSteps: [
        '调用 POST /api/mcp/refresh-tools 刷新工具注册（或重启服务）',
        'Agent T 将自动发现 "vision" 工具并可在 mcpParams 中调用',
        '可用动作：image_ocr（文字提取）、image_analyze（内容分析）',
      ],
    });
  } catch (error: any) {
    console.error('[AddVisionCapability] 注册失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      partialInserted: insertedIds,
    }, { status: 500 });
  }
}
