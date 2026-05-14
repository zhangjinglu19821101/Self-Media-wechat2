/**
 * 范式库 API
 * 
 * GET /api/paradigm-library          - 获取范式列表
 * GET /api/paradigm-library?code=P001 - 获取范式详情
 * POST /api/paradigm-library          - 识别范式（创作流程入口）
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveParadigms,
  getParadigmDetail,
  recognizeParadigm,
  matchMaterials,
  fillParadigmArticle,
  optimizeConnectives,
  paradigmCreationPipeline,
  generateParadigmPrompt,
} from '@/lib/services/paradigm-creation-service';
import { getParadigmPositionMap, getParadigmStructure } from '@/lib/services/paradigm-creation-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (code) {
      // 获取范式详情
      const detail = await getParadigmDetail(code);
      if (!detail) {
        return NextResponse.json({ error: '范式不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    // 获取范式列表
    const paradigms = await getActiveParadigms();
    return NextResponse.json({ success: true, data: paradigms });
  } catch (error) {
    console.error('[paradigm-library] GET 失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'recognize': {
        // 范式识别
        const result = await recognizeParadigm({
          articleType: body.articleType,
          industry: body.industry,
          topic: body.topic,
          taskDescription: body.taskDescription,
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'match_materials': {
        // 素材匹配
        const paradigmPositionMap = await getParadigmPositionMap(body.paradigmCode);
        const result = await matchMaterials({
          paradigmCode: body.paradigmCode,
          industry: body.industry,
          topicTags: body.topicTags,
          paradigmPositionMap,
        });
        // Map → 可序列化对象
        const serialized: Record<string, any[]> = {};
        result.forEach((v, k) => { serialized[String(k)] = v; });
        return NextResponse.json({ success: true, data: serialized });
      }

      case 'fill': {
        // 原位填充
        const structure = await getParadigmStructure(body.paradigmCode);
        const paradigmPositionMap = await getParadigmPositionMap(body.paradigmCode);

        // 如果前端传了 matchedMaterials，直接用
        let matchedMaterials = new Map<number, any[]>();
        if (body.matchedMaterials) {
          for (const [key, value] of Object.entries(body.matchedMaterials)) {
            matchedMaterials.set(Number(key), value as any[]);
          }
        } else {
          // 自动匹配
          matchedMaterials = await matchMaterials({
            paradigmCode: body.paradigmCode,
            industry: body.industry,
            topicTags: body.topicTags,
            paradigmPositionMap,
          });
        }

        const result = await fillParadigmArticle({
          paradigmCode: body.paradigmCode,
          matchedMaterials,
          paradigmStructure: structure,
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'optimize': {
        // 衔接优化
        const result = optimizeConnectives({
          article: body.article,
          personalFragments: body.personalFragments,
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'full_pipeline': {
        // 完整创作流程
        const result = await paradigmCreationPipeline({
          articleType: body.articleType,
          industry: body.industry,
          topic: body.topic,
          taskDescription: body.taskDescription,
          topicTags: body.topicTags,
          personalFragments: body.personalFragments,
        });
        return NextResponse.json({ success: true, data: result });
      }

      case 'generate_prompt': {
        // 生成写作Agent提示词（用于insurance-d集成）
        const prompt = await generateParadigmPrompt({
          paradigmCode: body.paradigmCode,
          industry: body.industry,
          topicTags: body.topicTags,
        });
        return NextResponse.json({ success: true, data: { prompt } });
      }

      default:
        return NextResponse.json(
          { error: '未知的 action，支持：recognize/match_materials/fill/optimize/full_pipeline/generate_prompt' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[paradigm-library] POST 失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    );
  }
}
