/**
 * 提示词组装 API
 * 
 * POST - 组装最终提示词（用于文章生成时调用）
 * GET  - 预览当前提示词拼接结果（用于调试/开发）
 */

import { NextRequest, NextResponse } from 'next/server';
import { promptAssemblerService } from '@/lib/services/prompt-assembler-service';

// ========== 输入校验工具 ==========

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isValidCoreAnchorData(value: unknown): value is {
  openingCase: string;
  coreViewpoint: string;
  endingConclusion: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  // 至少有一个字段非空
  return (
    (isNonEmptyString(obj.openingCase) || isNonEmptyString(obj.coreViewpoint) || isNonEmptyString(obj.endingConclusion))
  );
}

interface ValidationError {
  field: string;
  message: string;
}

function validateRequestBody(body: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  // taskInstruction: 可选，但如果提供必须是非空字符串
  if ('taskInstruction' in body && body.taskInstruction !== undefined && !isNonEmptyString(body.taskInstruction)) {
    errors.push({ field: 'taskInstruction', message: '必须是非空字符串' });
  }

  // samples: 可选，但如果提供必须是字符串数组
  if ('samples' in body && body.samples !== undefined && !isStringArray(body.samples)) {
    errors.push({ field: 'samples', message: '必须是字符串数组' });
  }

  // materials: 可选，但如果提供必须是字符串数组
  if ('materials' in body && body.materials !== undefined && !isStringArray(body.materials)) {
    errors.push({ field: 'materials', message: '必须是字符串数组' });
  }

  // targetWordCount: 可选，但如果提供必须是合法数字字符串
  if ('targetWordCount' in body && body.targetWordCount !== undefined) {
    const num = Number(body.targetWordCount);
    if (isNaN(num) || num < 500 || num > 10000) {
      errors.push({ field: 'targetWordCount', message: '必须是500-10000之间的数字' });
    }
  }

  // coreAnchorData: 可选，但如果提供必须是合法对象
  if ('coreAnchorData' in body && body.coreAnchorData !== undefined) {
    if (!isValidCoreAnchorData(body.coreAnchorData)) {
      errors.push({ field: 'coreAnchorData', message: '必须包含至少一个非空字段(openingCase/coreViewpoint/endingConclusion)' });
    } else {
      // 字数限制校验（需求文档 3.1.1）
      const data = body.coreAnchorData as Record<string, string>;
      if (data.openingCase && (data.openingCase.length < 30 || data.openingCase.length > 600)) {
        errors.push({ field: 'coreAnchorData.openingCase', message: '开篇核心案例段字数应在30-600字之间' });
      }
      if (data.coreViewpoint && (data.coreViewpoint.length < 20 || data.coreViewpoint.length > 400)) {
        errors.push({ field: 'coreAnchorData.coreViewpoint', message: '全文核心观点段字数应在20-400字之间' });
      }
      if (data.endingConclusion && (data.endingConclusion.length < 20 || data.endingConclusion.length > 400)) {
        errors.push({ field: 'coreAnchorData.endingConclusion', message: '结尾核心结论段字数应在20-400字之间' });
      }
    }
  }

  return errors;
}

// ========== GET: 预览提示词拼接结果（M5: 用于调试/开发） ==========

export async function GET(request: NextRequest) {
  try {
    // 从查询参数获取选项
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') || undefined;

    const assembledPrompt = await promptAssemblerService.assemblePrompt({
      workspaceId,
    });

    return NextResponse.json({
      success: true,
      data: {
        metadata: assembledPrompt.assemblyMetadata,
        // m4: GET 方法仅返回 metadata 和摘要，不暴露完整提示词
        summary: {
          fixedBasePromptLength: assembledPrompt.fixedBasePrompt.length,
          userExclusiveRulesCount: assembledPrompt.userExclusiveRules.rules.length,
          styleRulesCount: assembledPrompt.styleRules.rules.length,
          currentTaskLength: assembledPrompt.currentTask.length,
          fullPromptLength: assembledPrompt.fullPrompt.length,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '提示词预览失败';
    console.error('[PromptAssemblerAPI] GET error:', error);
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 500 });
  }
}

// ========== POST: 组装最终提示词 ==========

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;

    // M2: 输入校验
    const validationErrors = validateRequestBody(body);
    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: '输入参数校验失败',
        details: validationErrors,
      }, { status: 400 });
    }

    const {
      workspaceId,
      taskInstruction,
      samples,
      materials,
      targetWordCount,
      coreAnchorData,
      structureName,
      structureDetail,
      userOpinion,
      materialIds,
    } = body as {
      workspaceId?: string;
      taskInstruction?: string;
      samples?: string[];
      materials?: string[];
      targetWordCount?: string;
      coreAnchorData?: {
        openingCase: string;
        coreViewpoint: string;
        endingConclusion: string;
      };
      structureName?: string;
      structureDetail?: string;
      userOpinion?: string;
      materialIds?: string[];
    };

    const assembledPrompt = await promptAssemblerService.assemblePrompt({
      workspaceId: workspaceId,
      taskInstruction,
      samples,
      materials,
      targetWordCount,
      coreAnchorData,
      structureName,
      structureDetail,
      userOpinion,
      materialIds,
    });

    return NextResponse.json({
      success: true,
      data: {
        fullPrompt: assembledPrompt.fullPrompt,
        metadata: assembledPrompt.assemblyMetadata,
        // m4/N6: TODO 生产环境移除 parts 字段，避免暴露完整提示词内容
        // 可通过环境变量控制：process.env.NODE_ENV === 'production' ? undefined : parts
        parts: {
          fixedBasePromptLength: assembledPrompt.fixedBasePrompt.length,
          userExclusiveRules: assembledPrompt.userExclusiveRules.formattedText,
          styleRules: assembledPrompt.styleRules.formattedText,
          currentTask: assembledPrompt.currentTask,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '提示词组装失败';
    console.error('[PromptAssemblerAPI] POST error:', error);
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 500 });
  }
}
