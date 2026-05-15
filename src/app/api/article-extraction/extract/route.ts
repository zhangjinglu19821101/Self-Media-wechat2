import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { articleExtractions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  extractArticleV2,
  extractionV2ToMaterialInputs,
  type ArticleExtractionResultV2,
} from '@/lib/services/article-extraction-service';
import { getWorkspaceId } from '@/lib/auth/context';
import {
  markParadigmInitialized,
  extractCoveredDimensions,
} from '@/lib/services/paradigm-init-service';
import { articleDedupService } from '@/lib/services/article-dedup-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { articleContent, articleTitle, saveToLibrary = false, templateId, forceReanalyze = false } = body;

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

    // 🔥 使用 articleDedupService 进行完整的两层去重检测
    // 第1层：SHA-256 精确匹配（包括规范化匹配）
    // 第2层：SimHash 海明距离（近似匹配，距离≤3）
    let duplicateInfo: {
      isDuplicate: boolean;
      duplicateType: 'exact' | 'similar' | 'none';
      similarity?: number;
    } = { isDuplicate: false, duplicateType: 'none' };

    if (!forceReanalyze) {
      const dedupResult = await articleDedupService.checkArticleDuplicate(articleContent.trim(), workspaceId);

      duplicateInfo = {
        isDuplicate: dedupResult.isDuplicate,
        duplicateType: dedupResult.duplicateType,
        similarity: dedupResult.similarity,
      };

      // 如果是完全匹配且有缓存结果，直接返回
      if (dedupResult.isDuplicate && dedupResult.cachedAnalysis) {
        console.log('[ArticleExtraction] 文章重复，返回缓存结果:', {
          duplicateType: dedupResult.duplicateType,
          similarity: dedupResult.similarity,
        });

        // 查询已有的完整提取结果
        const db = getDatabase();
        const [existingRecord] = await db
          .select()
          .from(articleExtractions)
          .where(eq(articleExtractions.id, dedupResult.existingRecord?.id || ''))
          .limit(1);

        if (existingRecord) {
          return NextResponse.json({
            success: true,
            data: {
              extractionId: existingRecord.id,
              isDuplicate: true,
              duplicateInfo: {
                isDuplicate: true,
                duplicateType: dedupResult.duplicateType,
                similarity: dedupResult.similarity,
                existingArticle: dedupResult.existingRecord?.articleTitle,
                analyzedAt: dedupResult.existingRecord?.createdAt,
              },
              fromCache: true,
              message: '该文章已提取过，返回已有结果',
              articleTitle: existingRecord.articleTitle,
              paradigmRecognition: {
                matchedParadigmName: existingRecord.paradigmName,
                matchedParadigmId: existingRecord.paradigmType,
                matchScore: existingRecord.paradigmMatchScore,
                structureDifference: existingRecord.paradigmDiffNote,
              },
              relationalMaterials: existingRecord.relationalMaterials || [],
              emotionCurve: existingRecord.emotionCurve || [],
              paragraphRhythm: existingRecord.paragraphRhythm || [],
              assetValueScore: existingRecord.assetValueScore,
              reusableDimensionCount: existingRecord.reusableDimensionCount,
            },
          });
        }
      }

      // 如果是近似重复但没有缓存，记录警告但继续分析
      if (dedupResult.isDuplicate && !dedupResult.cachedAnalysis) {
        console.log('[ArticleExtraction] 文章近似重复但无缓存，继续分析:', {
          similarity: dedupResult.similarity,
        });
      }
    } else {
      console.log('[ArticleExtraction] 强制重新分析模式，跳过去重检测');
    }

    // 3. 调用两步拆解服务（范式识别 + 关系型素材提取）
    const extractionResult: ArticleExtractionResultV2 = await extractArticleV2(
      articleContent.trim(),
      workspaceId as string
    );

    // 4. 计算哈希并存储到数据库
    const articleHash = articleDedupService.calculateSHA256(articleContent.trim());

    // 5. 存入数据库（V2 使用独立范式字段）
    const db = getDatabase();
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

    // 5.5 同时存储到 article_hashes 表（用于未来的去重检测）
    try {
      await articleDedupService.saveArticleHash({
        articleText: articleContent.trim(),
        articleTitle: extractionResult.articleTitle || articleTitle || '未命名文章',
        userId: workspaceId,
        templateId: templateId || undefined,
        analysis: {
          extractionId: inserted.id,
          paradigmName: extractionResult.paradigmRecognition.matchedParadigmName,
          materialCount: extractionResult.relationalMaterials?.length || 0,
        },
      });
    } catch (hashErr) {
      console.error('[extract] saveArticleHash failed (non-blocking):', hashErr);
    }

    // 6. 标记范式为已初始化（异步，不阻塞主流程）
    if (extractionResult.paradigmRecognition.matchedParadigmId) {
      const coveredDims = extractCoveredDimensions(
        (extractionResult.relationalMaterials || []) as Array<{ materialType: string }>
      );
      markParadigmInitialized(
        workspaceId,
        extractionResult.paradigmRecognition.matchedParadigmId,
        extractionResult.paradigmRecognition.matchedParadigmName,
        extractionResult.paradigmRecognition.matchScore,
        extractionResult.relationalMaterials?.length || 0,
        inserted.id,
        coveredDims
      ).catch(err => {
        console.error('[extract] markParadigmInitialized failed (non-blocking):', err);
      });
    }

    // 7. 如果 saveToLibrary=true，自动将素材写入 material_library
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
            sourceType: 'article',
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
        // 🔥 返回去重检测结果
        duplicateInfo: {
          isDuplicate: duplicateInfo.isDuplicate,
          duplicateType: duplicateInfo.duplicateType,
          similarity: duplicateInfo.similarity,
        },
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
