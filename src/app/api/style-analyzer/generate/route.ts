/**
 * 按照风格生成文章 API
 * POST /api/style-analyzer/generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import { styleLearner } from '@/lib/style-analyzer';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';
import { handleRouteError } from '@/lib/api/route-error-handler';

export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { templateId, topic, additionalInstructions } = body;

    // 参数验证
    if (!templateId || !topic) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：templateId 和 topic 必填',
        },
        { status: 400 }
      );
    }

    // 获取风格模板
    const template = styleLearner.getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: '风格模板不存在',
        },
        { status: 404 }
      );
    }

    // 生成风格模仿提示词
    const stylePrompt = styleLearner.generateStylePrompt(
      template,
      topic,
      additionalInstructions
    );

    // 调用 LLM 生成文章（BYOK: 优先使用用户 Key）
    const workspaceId = await getWorkspaceId(request);
    const { client: llmClient } = await createUserLLMClient(workspaceId);

    const response = await llmClient.invoke([
      {
        role: 'system',
        content: '你是一位专业的文章写作专家。',
      },
      {
        role: 'user',
        content: stylePrompt,
      },
    ], {
      temperature: 0.7,
    });

    const article = response.content;

    return NextResponse.json({
      success: true,
      data: {
        article,
        template: {
          id: template.id,
          name: template.name,
          confidence: template.features.confidence,
        },
        topic,
      },
    });
  } catch (error: any) {
    console.error('风格化文章生成失败:', error);
    return handleRouteError(error, '风格化文章生成失败');
  }
}
