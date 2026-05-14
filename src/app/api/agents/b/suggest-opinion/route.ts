import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import { createUserLLMClient } from '@/lib/llm/factory';
import { handleRouteError } from '@/lib/api/route-error-handler';

/**
 * POST /api/agents/b/suggest-opinion
 * 根据用户任务指令，AI 生成3个建议核心观点
 * 帮助不擅长表达的用户快速构思文章观点
 * 
 * BYOK 改造：使用 createUserLLMClient 优先使用用户 API Key
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { instruction } = await request.json();

    if (!instruction || !instruction.trim()) {
      return NextResponse.json({ error: '请提供任务指令' }, { status: 400 });
    }

    const systemPrompt = `你是一位保险科普文章的策划专家。你的任务是根据用户给的任务指令，为用户生成3个不同的核心观点建议。

要求：
1. 每个观点必须是明确的立场或结论，不能模棱两可
2. 3个观点要覆盖不同的角度（如：理性对比、情感共鸣、风险警示）
3. 每个观点用1-2句话表达，简洁有力
4. 观点必须基于保险领域常识，不能有合规风险
5. 返回纯JSON格式，不要包含markdown代码块标记

返回格式：
{
  "opinions": [
    "观点1内容",
    "观点2内容",
    "观点3内容"
  ]
}`;

    const userPrompt = `请根据以下任务指令，生成3个核心观点建议：

${instruction}`;

    // BYOK: 优先使用用户 API Key
    const workspaceId = await getWorkspaceId(request);
    const { client: llmClient, source } = await createUserLLMClient(workspaceId, { timeout: 30000 });
    console.log('[suggest-opinion] LLM 来源:', source);

    try {
      const response = await llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.7,
      });

      const content = response.content || '';
      
      // 解析 LLM 返回的 JSON（多层兜底策略）
      const opinions = parseOpinionsFromLLM(content);

      if (opinions.length === 0) {
        console.error('[suggest-opinion] 无法解析LLM返回内容:', content.substring(0, 200));
        return NextResponse.json({ 
          error: 'LLM 返回格式异常，无法解析观点，请重试',
          rawContent: content.substring(0, 200),
        }, { status: 422 });
      }

      return NextResponse.json({
        opinions: opinions.slice(0, 3),
      });
    } catch (llmError: any) {
      console.error('[suggest-opinion] LLM调用失败:', llmError);
      if (llmError.message?.includes('超时') || llmError.message?.includes('timeout')) {
        return NextResponse.json({ error: 'LLM 请求超时，请稍后重试' }, { status: 504 });
      }
      return NextResponse.json({ error: 'LLM 调用失败: ' + llmError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[suggest-opinion] 错误:', error);
    return handleRouteError(error, '生成建议观点失败');
  }
}

/**
 * 从 LLM 返回内容中解析观点数组
 * 策略1: 直接 JSON 解析
 * 策略2: 提取 markdown 代码块后解析
 * 策略3: 按编号行提取（兜底）
 */
function parseOpinionsFromLLM(content: string): string[] {
  // 策略1: 直接解析
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.opinions) && parsed.opinions.length > 0) {
      return parsed.opinions.filter((o: unknown) => typeof o === 'string' && o.trim().length > 0);
    }
  } catch {
    // 继续下一种策略
  }

  // 策略2: 从 markdown 代码块中提取
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (Array.isArray(parsed.opinions) && parsed.opinions.length > 0) {
        return parsed.opinions.filter((o: unknown) => typeof o === 'string' && o.trim().length > 0);
      }
    } catch {
      // 继续下一种策略
    }
  }

  // 策略3: 按编号行提取（兜底）
  const lines = content.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 5);
  
  const opinionLines: string[] = [];
  for (const line of lines) {
    // 匹配 "1. xxx" / "1、xxx" / "1) xxx" / "- xxx" / "• xxx" / "xxx"等格式
    const match = line.match(/^(?:\d+[.、)\s]+|[-•]\s+)(.+)$/);
    if (match) {
      opinionLines.push(match[1].trim());
    }
  }

  // 如果编号提取也失败，把有意义的行作为观点
  if (opinionLines.length === 0 && lines.length >= 2) {
    return lines.slice(0, 3);
  }

  return opinionLines;
}
