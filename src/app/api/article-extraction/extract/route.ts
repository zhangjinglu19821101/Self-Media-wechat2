import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getDatabase } from '@/lib/db';
import { articleExtractions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  extractArticleV2,
  extractionV2ToMaterialInputs,
  type ArticleExtractionResultV2,
} from '@/lib/services/article-extraction-service';
import { getWorkspaceId } from '@/lib/auth/context';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleContent, articleTitle, saveToLibrary = false, templateId } = body;

    if (!articleContent || articleContent.trim().length < 50) {
      return NextResponse.json(
        { success: false, error: '文章内容不能少于50字' },
        { status: 400 }
      );
    }

    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    // 1. 计算文章哈希用于去重
    const articleHash = createHash('sha256').update(articleContent.trim()).digest('hex');

    // 2. 去重检查
    const db = getDatabase();
    const existing = await db
      .select({ id: articleExtractions.id })
      .from(articleExtractions)
      .where(
        and(
          eq(articleExtractions.workspaceId, workspaceId),
          eq(articleExtractions.articleHash, articleHash)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        data: {
          extractionId: existing[0].id,
          isDuplicate: true,
          message: '该文章已提取过，直接返回已有结果',
        },
      });
    }

    // 3. 调用两步拆解服务（范式识别 + 关系型素材提取）
    const extractionResult: ArticleExtractionResultV2 = await extractArticleV2(
      articleContent.trim(),
      articleTitle?.trim()
    );

    // 4. 存入数据库（V2 使用独立范式字段）
    const [inserted] = await db
      .insert(articleExtractions)
      .values({
        workspaceId,
        articleTitle: extractionResult.articleTitle || articleTitle || '未命名文章',
        articleText: articleContent.trim(),
        articleHash,
        // V2 范式识别结果（独立字段存储）
        paradigmName: extractionResult.paradigmRecognition.matchedParadigmName,
        paradigmType: extractionResult.paradigmRecognition.matchedParadigmId,
        paradigmMatchScore: extractionResult.paradigmRecognition.matchScore,
        paradigmDiffNote: extractionResult.paradigmRecognition.structureDifference,
        // V2 关系型素材
        relationalMaterials: extractionResult.relationalMaterials as any,
        // V2 情绪曲线和段落节奏
        emotionCurve: extractionResult.emotionCurve as any,
        paragraphRhythm: extractionResult.paragraphRhythm as any,
        // 元信息快捷字段
        articleType: extractionResult.articleType,
        coreTheme: extractionResult.coreTheme,
        emotionTone: extractionResult.emotionalTone,
        targetAudience: extractionResult.targetAudience,
        publishPlatform: extractionResult.platform,
        // 兼容旧字段（V1 的 layer1 保留元信息，layer2-5 设为 null）
        layer1Data: {
          articleTitle: extractionResult.articleTitle,
          articleType: extractionResult.articleType,
          coreTheme: extractionResult.coreTheme,
          targetAudience: extractionResult.targetAudience,
          emotionalTone: extractionResult.emotionalTone,
          platform: extractionResult.platform,
        } as any,
        layer2Data: null,
        layer3Data: null,
        layer4Data: null,
        layer5Data: null,
        // 汇总
        extractionSummary: `范式：${extractionResult.paradigmRecognition.matchedParadigmName}（${extractionResult.paradigmRecognition.matchScore}分），素材${extractionResult.relationalMaterials.length}个`,
        assetValueScore: extractionResult.assetValueScore,
        reusableDimensionCount: extractionResult.reusableDimensionCount,
        templateId: templateId || null,
      } as any)
      .returning();

    // 5. 如果 saveToLibrary=true，自动将素材写入 material_library
    let savedMaterialCount = 0;
    if (saveToLibrary) {
      try {
        const materialInputs = extractionV2ToMaterialInputs(
          extractionResult,
          extractionResult.articleTitle || articleTitle || '未命名文章'
        );
        const { materialLibrary } = await import('@/lib/db/schema/material-library');
        for (const input of materialInputs) {
          await db.insert(materialLibrary).values({
            workspaceId,
            title: input.title,
            content: input.content,
            type: input.type,
            sceneType: input.sceneType,
            sourceType: 'article_extraction',
            sourceDesc: extractionResult.articleTitle || undefined,
            topicTags: input.topicTags,
            sceneTags: input.sceneTags,
            emotionTags: input.emotionTags,
            ownerType: 'user',
            analysisText: JSON.stringify(input.structuredData),
          } as any);
          savedMaterialCount++;
        }
      } catch (saveErr) {
        console.error('[extract] saveToLibrary failed:', saveErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        extractionId: inserted.id,
        articleTitle: extractionResult.articleTitle,
        paradigmRecognition: extractionResult.paradigmRecognition,
        relationalMaterials: extractionResult.relationalMaterials,
        emotionCurve: extractionResult.emotionCurve,
        paragraphRhythm: extractionResult.paragraphRhythm,
        assetValueScore: extractionResult.assetValueScore,
        reusableDimensionCount: extractionResult.reusableDimensionCount,
        savedMaterialCount,
      },
    });
  } catch (error: any) {
    console.error('[article-extraction/extract] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '提取失败' },
      { status: 500 }
    );
  }
}
