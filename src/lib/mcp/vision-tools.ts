/**
 * 视觉识别 MCP 能力实现
 *
 * 实现 2 个视觉识别相关的 MCP 能力：
 * 1. ID 30: 视觉识别-图片文字提取 (imageOcr)
 * 2. ID 31: 视觉识别-图片内容分析 (imageAnalyze)
 *
 * 设计原则（与 web-search-executor 保持一致）：
 * 1. 易读：代码结构清晰，注释完善
 * 2. 易维护：遵循 BaseMCPCapabilityExecutor 模式
 * 3. 易扩展：新增视觉能力只需添加新的实现类
 *
 * 技术实现：
 * - 使用 doubao-seed-1-6-lite 视觉多模态模型
 * - 图片转 base64 后通过 image_url 类型传给 LLM
 * - 支持 jpg/png/webp/gif 格式，最大 5MB
 */

import { BaseMCPCapabilityExecutor, MCPCapabilityExecutorFactory } from './mcp-executor';
import { MCPExecutionResult } from './types';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';

// ============================================================================
// 类型定义
// ============================================================================

export interface VisionMCPResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    fileName: string;
    fileSize: number;
    type: string;
    charCount: number;
    timestamp: number;
  };
}

export interface ImageOcrParams {
  /** 图片的 base64 编码内容 */
  imageBase64: string;
  /** 图片 MIME 类型 */
  mimeType: string;
  /** 原始文件名（用于日志） */
  fileName?: string;
}

export interface ImageAnalyzeParams {
  /** 图片的 base64 编码内容 */
  imageBase64: string;
  /** 图片 MIME 类型 */
  mimeType: string;
  /** 原始文件名（用于日志） */
  fileName?: string;
  /** 分析指令（可选，如"提取表格数据"、"分析图表趋势"） */
  instruction?: string;
}

export interface ImageOcrResult {
  fileName: string;
  type: 'ocr';
  extractedText: string;
  charCount: number;
  timestamp: string;
}

export interface ImageAnalyzeResult {
  fileName: string;
  type: 'analysis';
  instruction?: string;
  analysisText: string;
  charCount: number;
  timestamp: string;
}

// ============================================================================
// 工具函数（内部使用）
// ============================================================================

/** LLM 调用超时时间（毫秒） */
const VISION_LLM_TIMEOUT_MS = 30000;

/**
 * 创建 LLM 客户端实例
 */
function createLLMClient(): LLMClient {
  return new LLMClient(new Config({ timeout: VISION_LLM_TIMEOUT_MS }));
}

/**
 * 创建支持 BYOK 的 LLM 客户端
 * @param workspaceId 工作空间 ID（用于查询用户 API Key）
 */
async function createLLMClientWithBYOK(workspaceId?: string): Promise<LLMClient> {
  const { client } = await createUserLLMClient(workspaceId, { timeout: VISION_LLM_TIMEOUT_MS });
  return client;
}

/**
 * 图片文字提取（OCR）
 *
 * 使用 LLM 视觉模型从图片中提取所有可见文字
 */
async function imageOcr(params: ImageOcrParams, workspaceId?: string): Promise<VisionMCPResult<ImageOcrResult>> {
  console.log('[Vision Tool] imageOcr 开始执行，参数:', {
    fileName: params.fileName,
    mimeType: params.mimeType,
    imageSize: params.imageBase64.length,
  });
  const startTime = Date.now();

  try {
    const { imageBase64, mimeType, fileName = 'unknown' } = params;

    // 参数校验
    if (!imageBase64 || imageBase64.trim().length === 0) {
      return {
        success: false,
        error: '图片内容不能为空',
        metadata: { fileName, fileSize: 0, type: 'ocr', charCount: 0, timestamp: Date.now() },
      };
    }

    // 构造 data URL
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    // 调用 LLM 视觉模型（BYOK: 优先使用用户 Key）
    const llmClient = await createLLMClientWithBYOK(workspaceId);
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
        model: 'doubao-seed-1-6-lite-251015',
        temperature: 0.1,
      }
    );

    const extractedText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const endTime = Date.now();
    console.log(`[Vision Tool] imageOcr 执行完成，耗时 ${endTime - startTime}ms，提取 ${extractedText.length} 字符`);

    return {
      success: true,
      data: {
        fileName,
        type: 'ocr',
        extractedText,
        charCount: extractedText.length,
        timestamp: new Date().toISOString(),
      },
      metadata: { fileName, fileSize: imageBase64.length, type: 'ocr', charCount: extractedText.length, timestamp: Date.now() },
    };
  } catch (error: any) {
    const endTime = Date.now();
    console.error(`[Vision Tool] imageOcr 执行失败，耗时 ${endTime - startTime}ms，错误:`, error.message);

    return {
      success: false,
      error: `图片文字提取失败: ${error.message}`,
      metadata: {
        fileName: params.fileName || 'unknown',
        fileSize: params.imageBase64?.length || 0,
        type: 'ocr',
        charCount: 0,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * 图片内容分析
 *
 * 使用 LLM 视觉模型对图片进行深度分析（可指定分析方向）
 */
async function imageAnalyze(params: ImageAnalyzeParams, workspaceId?: string): Promise<VisionMCPResult<ImageAnalyzeResult>> {
  console.log('[Vision Tool] imageAnalyze 开始执行，参数:', {
    fileName: params.fileName,
    mimeType: params.mimeType,
    instruction: params.instruction,
    imageSize: params.imageBase64.length,
  });
  const startTime = Date.now();

  try {
    const { imageBase64, mimeType, fileName = 'unknown', instruction } = params;

    // 参数校验
    if (!imageBase64 || imageBase64.trim().length === 0) {
      return {
        success: false,
        error: '图片内容不能为空',
        metadata: { fileName, fileSize: 0, type: 'analysis', charCount: 0, timestamp: Date.now() },
      };
    }

    // 构造 data URL
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    // 根据是否有自定义指令调整 prompt
    const systemPrompt = instruction
      ? `请按照以下指令分析这张图片：

指令：${instruction}

要求：
1. 基于图片实际内容进行分析
2. 输出结构化的分析结果
3. 如果图片中有文字，一并提取`
      : `请对这张图片进行全面分析，包括：
1. 图片类型和主要内容描述
2. 图片中包含的所有文字内容（完整提取）
3. 如果有数据/表格/图表，详细列出
4. 如果是文档截图，按阅读顺序输出全部文本`;

    // 调用 LLM 视觉模型（BYOK: 优先使用用户 Key）
    const llmClient = await createLLMClientWithBYOK(workspaceId);
    const response = await llmClient.invoke(
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: systemPrompt,
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
      {
        model: 'doubao-seed-1-6-lite-251015',
        temperature: 0.2,
      }
    );

    const analysisText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    const endTime = Date.now();
    console.log(`[Vision Tool] imageAnalyze 执行完成，耗时 ${endTime - startTime}ms，输出 ${analysisText.length} 字符`);

    return {
      success: true,
      data: {
        fileName,
        type: 'analysis',
        instruction,
        analysisText,
        charCount: analysisText.length,
        timestamp: new Date().toISOString(),
      },
      metadata: { fileName, fileSize: imageBase64.length, type: 'analysis', charCount: analysisText.length, timestamp: Date.now() },
    };
  } catch (error: any) {
    const endTime = Date.now();
    console.error(`[Vision Tool] imageAnalyze 执行失败，耗时 ${endTime - startTime}ms，错误:`, error.message);

    return {
      success: false,
      error: `图片内容分析失败: ${error.message}`,
      metadata: {
        fileName: params.fileName || 'unknown',
        fileSize: params.imageBase64?.length || 0,
        type: 'analysis',
        charCount: 0,
        timestamp: Date.now(),
      },
    };
  }
}

// ============================================================================
// ID 30: 视觉识别-图片文字提取 (imageOcr)
// ============================================================================

/**
 * 视觉识别-图片文字提取 MCP 执行器
 * 能力 ID: 30
 *
 * Agent T 使用方式：
 * mcpParams: { toolName: "vision", actionName: "image_ocr", params: { imageBase64: "...", mimeType: "image/jpeg" } }
 */
class ImageOcrExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 30;
  readonly capabilityName = '视觉识别-图片文字提取';

  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    console.log(`[ImageOcrExecutor] 执行图片文字提取，参数 keys:`, Object.keys(params));

    try {
      const { imageBase64, mimeType, fileName } = params;

      if (!imageBase64) {
        return {
          success: false,
          error: '缺少必要参数: imageBase64',
          executionTime: new Date().toISOString(),
        };
      }

      const result = await imageOcr({
        imageBase64,
        mimeType: mimeType || 'image/jpeg',
        fileName,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || '图片文字提取失败',
          executionTime: new Date().toISOString(),
        };
      }

      console.log(`[ImageOcrExecutor] 提取成功，${result.data?.charCount} 字符`);

      return {
        success: true,
        data: result.data,
        executionTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[ImageOcrExecutor] 执行异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '图片文字提取执行失败',
        executionTime: new Date().toISOString(),
      };
    }
  }
}

// ============================================================================
// ID 31: 视觉识别-图片内容分析 (imageAnalyze)
// ============================================================================

/**
 * 视觉识别-图片内容分析 MCP 执行器
 * 能力 ID: 31
 *
 * Agent T 使用方式：
 * mcpParams: { toolName: "vision", actionName: "image_analyze", params: { imageBase64: "...", mimeType: "image/png", instruction: "提取表格数据" } }
 */
class ImageAnalyzeExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 31;
  readonly capabilityName = '视觉识别-图片内容分析';

  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    console.log(`[ImageAnalyzeExecutor] 执行图片内容分析，参数 keys:`, Object.keys(params));

    try {
      const { imageBase64, mimeType, fileName, instruction } = params;

      if (!imageBase64) {
        return {
          success: false,
          error: '缺少必要参数: imageBase64',
          executionTime: new Date().toISOString(),
        };
      }

      const result = await imageAnalyze({
        imageBase64,
        mimeType: mimeType || 'image/png',
        fileName,
        instruction,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || '图片内容分析失败',
          executionTime: new Date().toISOString(),
        };
      }

      console.log(`[ImageAnalyzeExecutor] 分析成功，${result.data?.charCount} 字符`);

      return {
        success: true,
        data: result.data,
        executionTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[ImageAnalyzeExecutor] 执行异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '图片内容分析执行失败',
        executionTime: new Date().toISOString(),
      };
    }
  }
}

// ============================================================================
// 注册到工厂
// ============================================================================

MCPCapabilityExecutorFactory.registerExecutor(new ImageOcrExecutor());
MCPCapabilityExecutorFactory.registerExecutor(new ImageAnalyzeExecutor());

// ============================================================================
// 视觉工具对象命名空间（与 SearchMCPTools / WechatMCPTools 保持一致）
// ============================================================================

/**
 * 视觉识别 MCP 工具集
 *
 * 提供 2 个方法供 Agent T 通过 MCP 调用：
 * - imageOcr: 纯文字提取（低温度，高准确性）
 * - imageAnalyze: 内容分析（支持自定义分析指令）
 */
export const VisionMCPTools = {
  imageOcr,
  imageAnalyze,
};

// ============================================================================
// 导出类型和类供外部使用
// ============================================================================

export {
  ImageOcrExecutor,
  ImageAnalyzeExecutor,
};
