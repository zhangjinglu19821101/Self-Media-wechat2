/**
 * 文章全维度提取 API
 * POST /api/article-extraction/extract
 * 
 * 接收文章内容，调用AI进行5层21维结构化提取
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { articleExtractions, extractionLayers, extractionAssets } from '@/lib/db/schema';
import { extractArticleDimensions, extractionToMaterialInputs } from '@/lib/services/article-extraction-service';

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { articleContent, articleTitle, saveToLibrary, templateId } = body;

    if (!articleContent || articleContent.trim().length < 50) {
      return NextResponse.json(
        { success: false, error: '文章内容不能少于50字' },
        { status: 400 }
      );
    }

    console.log(`[ArticleExtraction] 开始提取文章: ${articleTitle || '未命名'} (${articleContent.length}字)`);

    // 调用AI提取服务
    const extractionResult = await extractArticleDimensions(articleContent, articleTitle, {
      workspaceId: workspaceId as string,
    });

    // 保存提取结果到数据库
    const [savedExtraction] = await db.insert(articleExtractions).values({
      workspaceId: workspaceId as string,
      articleTitle: extractionResult.layer1.articleTitle || articleTitle || '未命名文章',
      articleContent: articleContent,
      layer1Data: extractionResult.layer1,
      layer2Data: extractionResult.layer2,
      layer3Data: extractionResult.layer3,
      layer4Data: extractionResult.layer4,
      layer5Data: extractionResult.layer5,
      assetValueScore: extractionResult.assetValueScore,
      reusableDimensionCount: extractionResult.reusableDimensionCount,
      extractionSummary: extractionResult.extractionSummary,
      templateId: templateId || null,
    }).returning();

    // 保存各层提取结果到 extraction_layers 表
    const layerRecords = buildLayerRecords(savedExtraction.id, workspaceId as string, extractionResult);
    if (layerRecords.length > 0) {
      await db.insert(extractionLayers).values(layerRecords);
    }

    // 保存各维度提取的数字资产到 extraction_assets 表
    const assetRecords = buildAssetRecords(savedExtraction.id, workspaceId as string, extractionResult, articleTitle);
    if (assetRecords.length > 0) {
      await db.insert(extractionAssets).values(assetRecords);
    }

    // 如果选择保存到素材库
    let savedMaterialCount = 0;
    if (saveToLibrary) {
      const materialInputs = extractionToMaterialInputs(
        extractionResult,
        extractionResult.layer1.articleTitle || articleTitle || '未命名文章'
      );
      savedMaterialCount = materialInputs.length;
      console.log(`[ArticleExtraction] 将保存 ${savedMaterialCount} 条素材到素材库`);
    }

    console.log(`[ArticleExtraction] 提取完成: 资产价值=${extractionResult.assetValueScore}, 可复用维度=${extractionResult.reusableDimensionCount}/21`);

    return NextResponse.json({
      success: true,
      data: {
        extractionId: savedExtraction.id,
        ...extractionResult,
        savedMaterialCount,
      },
    });
  } catch (error) {
    console.error('[ArticleExtraction] 提取失败:', error);
    return NextResponse.json(
      { success: false, error: `提取失败: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

/**
 * 构建5层提取记录
 */
function buildLayerRecords(
  extractionId: string,
  workspaceId: string,
  result: Awaited<ReturnType<typeof extractArticleDimensions>>
) {
  const layers: Array<{
    extractionId: string;
    workspaceId: string;
    layerName: string;
    layerIndex: number;
    extractionData: Record<string, any>;
    confidence: number;
  }> = [];

  layers.push({ extractionId, workspaceId, layerName: 'meta_info', layerIndex: 1, extractionData: result.layer1, confidence: 85 });
  layers.push({ extractionId, workspaceId, layerName: 'core_logic', layerIndex: 2, extractionData: result.layer2, confidence: 80 });
  layers.push({ extractionId, workspaceId, layerName: 'content_module', layerIndex: 3, extractionData: result.layer3, confidence: 85 });
  layers.push({ extractionId, workspaceId, layerName: 'language_style', layerIndex: 4, extractionData: result.layer4, confidence: 75 });
  layers.push({ extractionId, workspaceId, layerName: 'atomic_material', layerIndex: 5, extractionData: result.layer5, confidence: 90 });

  return layers;
}

/**
 * 构建21维数字资产记录
 */
function buildAssetRecords(
  extractionId: string,
  workspaceId: string,
  result: Awaited<ReturnType<typeof extractArticleDimensions>>,
  articleTitle?: string
) {
  const assets: Array<{
    extractionId: string;
    workspaceId: string;
    layerName: string;
    dimensionName: string;
    assetType: string;
    assetName: string;
    assetContent: string;
    sourceArticleTitle: string | null;
  }> = [];

  const srcTitle = articleTitle || result.layer1.articleTitle || '未命名文章';

  // 第一层
  const l1 = result.layer1;
  addAsset(assets, extractionId, workspaceId, 'meta_info', 'articleTitle', '爆款标题素材库', '标题素材', l1.articleTitle, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'meta_info', 'articleType', '文章结构模板库', '结构模板', l1.articleType, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'meta_info', 'coreTheme', '主题标签体系', '主题标签', l1.coreTheme, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'meta_info', 'targetAudience', '用户画像库', '用户画像', l1.targetAudience, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'meta_info', 'emotionalTone', '风格规则库', '风格规则', l1.emotionalTone, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'meta_info', 'publishPlatform', '多平台适配规则库', '适配规则', l1.publishPlatform, srcTitle);

  // 第二层
  const l2 = result.layer2;
  addAsset(assets, extractionId, workspaceId, 'core_logic', 'coreArgument', '核心论点库', '论点素材', l2.coreArgument, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'core_logic', 'breakthroughLogic', '逻辑错位模型库', '逻辑模型', l2.breakthroughLogic, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'core_logic', 'argumentStructure', '标准论证结构库', '论证结构', l2.argumentStructure, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'core_logic', 'valueProposition', '价值主张库', '价值主张', l2.valueProposition, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'core_logic', 'actionGuide', '转化话术库', '转化话术', l2.actionGuide, srcTitle);

  // 第三层
  const l3 = result.layer3;
  addAsset(assets, extractionId, workspaceId, 'content_module', 'hookIntro', '钩子素材库', '钩子素材', l3.hookIntro, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'content_module', 'emotionalAcceptance', '情绪接纳句式库', '接纳句式', l3.emotionalAcceptance, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'content_module', 'cognitiveBreakthrough', '破局句式库', '破局句式', l3.cognitiveBreakthrough, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'content_module', 'plainExplanation', '解释模板库', '解释模板', l3.plainExplanation, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'content_module', 'valueReconstruction', '价值重构句式库', '重构句式', l3.valueReconstruction, srcTitle);
  addAsset(assets, extractionId, workspaceId, 'content_module', 'closingElevation', '收尾金句库', '收尾金句', l3.closingElevation, srcTitle);

  // 第四层
  const l4 = result.layer4;
  addAsset(assets, extractionId, workspaceId, 'language_style', 'fixedPatterns', '个人句式库', '个人句式', l4.fixedPatterns.join('\n'), srcTitle);
  addAsset(assets, extractionId, workspaceId, 'language_style', 'toneCharacteristics', '风格特征库', '风格特征', l4.toneCharacteristics.join('\n'), srcTitle);
  addAsset(assets, extractionId, workspaceId, 'language_style', 'catchphrases', '口头禅库', '口头禅', l4.catchphrases.join('\n'), srcTitle);
  addAsset(assets, extractionId, workspaceId, 'language_style', 'forbiddenWords', '合规禁忌库', '合规禁忌', l4.forbiddenWords.join('\n'), srcTitle);
  addAsset(assets, extractionId, workspaceId, 'language_style', 'paragraphRhythm', '排版规则库', '排版规则', l4.paragraphRhythm, srcTitle);

  // 第五层
  const l5 = result.layer5;
  addAsset(assets, extractionId, workspaceId, 'atomic_material', 'misconceptions', '误区素材包库', '误区素材', l5.misconceptions.join('\n'), srcTitle);
  addAsset(assets, extractionId, workspaceId, 'atomic_material', 'lifeAnalogies', '类比素材库', '类比素材', l5.lifeAnalogies.join('\n'), srcTitle);
  addAsset(assets, extractionId, workspaceId, 'atomic_material', 'realCases', '案例素材库', '案例素材', l5.realCases.join('\n'), srcTitle);
  addAsset(assets, extractionId, workspaceId, 'atomic_material', 'authorityData', '数据素材库', '数据素材', l5.authorityData.join('\n'), srcTitle);
  addAsset(assets, extractionId, workspaceId, 'atomic_material', 'goldenSentences', '金句素材库', '金句素材', l5.goldenSentences.join('\n'), srcTitle);

  return assets;
}

function addAsset(
  assets: Array<{
    extractionId: string;
    workspaceId: string;
    layerName: string;
    dimensionName: string;
    assetType: string;
    assetName: string;
    assetContent: string;
    sourceArticleTitle: string | null;
  }>,
  extractionId: string,
  workspaceId: string,
  layerName: string,
  dimensionName: string,
  assetType: string,
  assetName: string,
  content: string,
  sourceArticleTitle: string
) {
  if (content && content !== '未检测到' && content.trim().length > 0) {
    assets.push({ extractionId, workspaceId, layerName, dimensionName, assetType, assetName, assetContent: content, sourceArticleTitle });
  }
}
