import { NextRequest, NextResponse } from 'next/server';
import { styleDepositionService, type StyleDepositionResult } from '@/lib/services/style-deposition-service';
import { styleTemplateService } from '@/lib/services/style-template-service';
import { articleDedupService } from '@/lib/services/article-dedup-service';
import { styleSimilarityValidator } from '@/lib/services/style-similarity-validator';
import { PlatformType, getValidPlatform } from '@/lib/db/schema/style-template';
import { requireAuth } from '@/lib/auth/context';

// LLM 多模态分析耗时长（可达 90 秒），需要提高函数执行时长上限
export const maxDuration = 120;

/**
 * POST /api/style/init-from-upload
 *
 * 上传文章 → 去重检测 → 6 维度风格分析 → 写入 style_assets 表
 *
 * 请求体:
 * - articleText: string (必填) 文章内容（支持纯文本或 HTML）
 * - articleTitle?: string (可选) 文章标题
 * - targetWordCount?: number (可选) 目标字数，用于排版风格合规判断
 * - templateId?: string (可选) 风格模板ID，规则将绑定到此模板
 * - createTemplate?: boolean (可选) 是否自动创建新模板
 * - templateName?: string (可选) 新模板名称（createTemplate=true 时使用）
 * - forceReanalyze?: boolean (可选) 强制重新分析（忽略缓存）
 *
 * 响应:
 * - success: boolean
 * - analysis: SixDimensionAnalysis (6 维度完整结果)
 * - savedRules: number (写入 style_assets 的规则数量)
 * - templateId: string (使用的模板ID)
 * - fromCache: boolean (是否来自缓存)
 * - duplicateInfo: { isDuplicate, duplicateType, similarity } (重复信息)
 */
export async function POST(request: NextRequest) {
  try {
    // 🔥 认证 + workspace 隔离
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    // 🔥 支持两种请求格式：JSON（无图）和 FormData（有图）
    let articleText: string;
    let articleTitle: string = '上传文章';
    let targetWordCount: number | undefined;
    let templateId: string | undefined;
    let createTemplate: boolean = false;
    let templateName: string | undefined;
    let platform: string = 'wechat_official';
    let forceReanalyze: boolean = false;
    let imageCountMode: string | undefined;
    let tags: string[] = [];
    let imageUrls: string[] = [];  // 🔥 图片 URL 列表（base64 data URI）

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // 🔥 FormData 模式：支持图片上传
      const formData = await request.formData();
      articleText = formData.get('articleText') as string || '';
      articleTitle = (formData.get('articleTitle') as string) || '上传文章';
      const twc = formData.get('targetWordCount');
      targetWordCount = twc ? Number(twc) : undefined;
      templateId = formData.get('templateId') as string | undefined;
      createTemplate = formData.get('createTemplate') === 'true';
      templateName = formData.get('templateName') as string | undefined;
      platform = (formData.get('platform') as string) || 'wechat_official';
      forceReanalyze = formData.get('forceReanalyze') === 'true';
      imageCountMode = formData.get('imageCountMode') as string | undefined;

      // 解析 tags JSON
      try {
        const tagsStr = formData.get('tags') as string;
        if (tagsStr) tags = JSON.parse(tagsStr);
      } catch { /* ignore */ }

      // 🔥 提取图片文件，转为 base64 data URI
      const imageFiles = formData.getAll('images') as File[];
      for (const file of imageFiles) {
        if (file && file.size > 0) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;
          imageUrls.push(base64);
        }
      }
      console.log('[StyleInit] 📸 FormData模式，收到图片:', imageUrls.length, '张');
    } else {
      // JSON 模式：原有逻辑
      const body = await request.json();
      articleText = body.articleText;
      articleTitle = body.articleTitle || '上传文章';
      targetWordCount = body.targetWordCount;
      templateId = body.templateId;
      createTemplate = body.createTemplate;
      templateName = body.templateName;
      platform = body.platform || 'wechat_official';
      forceReanalyze = body.forceReanalyze || false;
      imageCountMode = body.imageCountMode;
      tags = body.tags || [];
    }

    // 输入校验（小红书平台放宽到30字）
    const minLength = platform === 'xiaohongshu' ? 30 : 50;
    if (!articleText || typeof articleText !== 'string' || articleText.trim().length < minLength) {
      return NextResponse.json({
        success: false,
        error: `文章内容不能为空且至少需要 ${minLength} 个字符`,
      }, { status: 400 });
    }

    // M2: targetWordCount 范围校验（防止负数/超大值导致异常）
    let validatedTargetWordCount: number | undefined = undefined;
    if (targetWordCount !== undefined && targetWordCount !== null) {
      const numVal = Number(targetWordCount);
      if (!Number.isFinite(numVal) || numVal < 100 || numVal > 10000) {
        return NextResponse.json({
          success: false,
          error: '目标字数必须在 100-10000 之间',
        }, { status: 400 });
      }
      validatedTargetWordCount = numVal;
    }

    console.log('[StyleInit] 收到上传文章:', {
      title: articleTitle,
      textLength: articleText.length,
      targetWordCount,
      templateId,
      createTemplate,
      forceReanalyze,
      workspaceId, // 🔥 workspace 隔离
      platform,    // 🔥 平台
      imageCountMode, // P0修复
      hasImages: imageUrls.length > 0, // 🔥 多模态
      imageCount: imageUrls.length,   // 🔥 图片数量
    });

    // 🔥 强制校验：必须选择模板或创建新模板
    if (!createTemplate && !templateId) {
      return NextResponse.json({
        success: false,
        error: '请选择一个风格模板，或勾选「创建新模板」',
      }, { status: 400 });
    }
    
    // 🔥 如果选择创建新模板，必须填写模板名称
    if (createTemplate && !templateName?.trim()) {
      return NextResponse.json({
        success: false,
        error: '请输入新模板的名称',
      }, { status: 400 });
    }

    // 🔥 P0 修复：去重检测时传入用户ID（实现用户隔离）
    let duplicateInfo: {
      isDuplicate: boolean;
      duplicateType: 'exact' | 'similar' | 'none';
      similarity?: number;
    } = { isDuplicate: false, duplicateType: 'none' };
    
    if (!forceReanalyze) {
      const dedupResult = await articleDedupService.checkArticleDuplicate(articleText, workspaceId);
      
      duplicateInfo = {
        isDuplicate: dedupResult.isDuplicate,
        duplicateType: dedupResult.duplicateType,
        similarity: dedupResult.similarity,
      };
      
      // 如果是完全匹配且有缓存结果，直接返回
      if (dedupResult.isDuplicate && dedupResult.cachedAnalysis) {
        console.log('[StyleInit] 文章重复，返回缓存结果:', {
          duplicateType: dedupResult.duplicateType,
          similarity: dedupResult.similarity,
          cachedAnalysis: !!dedupResult.cachedAnalysis,
        });
        
        // 🔥 缓存结构是 { xhsAnalysis: {...} } 或 { analysis: {...} }，需要展开
        const cached = dedupResult.cachedAnalysis as Record<string, any>;

        return NextResponse.json({
          success: true,
          data: {
            ...cached,  // 展开缓存中的 xhsAnalysis 或 analysis
            savedRules: 0, // 来自缓存，不需要重新保存
            warnings: [],
            templateId: dedupResult.existingRecord?.templateId || templateId,
            processedAt: new Date().toISOString(),
            fromCache: true,
            duplicateInfo: {
              isDuplicate: true,
              duplicateType: dedupResult.duplicateType,
              similarity: dedupResult.similarity,
              existingArticle: dedupResult.existingRecord?.articleTitle,
              analyzedAt: dedupResult.existingRecord?.createdAt,
            },
          },
        });
      }
      
      // 如果是近似重复但没有缓存，提示用户
      if (dedupResult.isDuplicate && !dedupResult.cachedAnalysis) {
        console.log('[StyleInit] 文章近似重复但无缓存，继续分析');
      }
    } else {
      console.log('[StyleInit] 强制重新分析模式，跳过去重检测');
    }

    // 🔥 确定使用的模板ID
    let finalTemplateId = templateId;
    
    // 如果需要自动创建模板
    if (createTemplate && templateName) {
      // P1 修复：校验平台参数
      const validatedPlatform = getValidPlatform(platform);
      
      const newTemplate = await styleTemplateService.createTemplate(workspaceId, { // P0 修复：使用实际用户ID
        name: templateName,
        description: `从文章《${articleTitle}》自动创建`,
        platform: validatedPlatform,
        sourceArticles: [{
          title: articleTitle,
          contentPreview: articleText.slice(0, 200),
          analyzedAt: new Date().toISOString(),
        }],
        isDefault: false,
      });
      finalTemplateId = newTemplate.id;
      console.log('[StyleInit] 自动创建模板:', newTemplate.id, newTemplate.name, '平台:', validatedPlatform);
    }

    // 🔥 根据平台类型执行不同的风格分析
    const validatedPlatform = getValidPlatform(platform);
    let analysis;
    let xhsAnalysis = null;
    
    if (validatedPlatform === 'xiaohongshu') {
      // 小红书平台：使用小红书风格分析器
      const { analyzeXiaohongshuNote, convertAnalysisToRules: convertXhsToRules } = await import('@/lib/services/xiaohongshu-style-analyzer');
      xhsAnalysis = await analyzeXiaohongshuNote({
        title: articleTitle,
        content: articleText,
        tags: tags || [],
      }, {
        // P0修复：传入用户选择的图片数量模式，让 LLM 按此模式生成架构
        preferredImageMode: imageCountMode as '3-card' | '5-card' | '7-card' | undefined,
        workspaceId, // BYOK: 传入 workspaceId 以使用用户 API Key
      });

      // 🔥 多模态视觉分析：如果有上传图片，调用视觉风格分析器
      if (imageUrls.length > 0) {
        try {
          const { analyzeVisualStyleFromImages, getDefaultVisualStyle } = await import('@/lib/services/xiaohongshu-visual-analyzer');
          console.log('[StyleInit] 🎨 开始多模态视觉分析，图片数量:', imageUrls.length);
          const visualStyle = await analyzeVisualStyleFromImages(imageUrls, workspaceId);

          // 将视觉分析结果合并到 xhsAnalysis
          xhsAnalysis.visualStyle = visualStyle;
          console.log('[StyleInit] ✅ 视觉分析完成:', {
            primaryColor: visualStyle.colorScheme.primaryColor,
            tone: visualStyle.colorScheme.tone,
            source: visualStyle.source,
          });
        } catch (visualErr) {
          console.error('[StyleInit] ⚠️ 多模态视觉分析失败，使用默认配色:', visualErr);
          // 降级：使用默认视觉风格（不影响主流程）
          const { getDefaultVisualStyle } = await import('@/lib/services/xiaohongshu-visual-analyzer');
          xhsAnalysis.visualStyle = getDefaultVisualStyle();
        }

        // 🔥🔥 内容模板分析：从图片中提取图文分工结构
        if (imageUrls.length > 0) {
          try {
            const { analyzeContentTemplateFromImages, getDefaultContentTemplate } = await import('@/lib/services/xiaohongshu-visual-analyzer');
            console.log('[StyleInit] 📝 开始内容模板分析，图片数量:', imageUrls.length);
            const contentTemplate = await analyzeContentTemplateFromImages(imageUrls, articleText, workspaceId);

            // 将内容模板合并到 xhsAnalysis
            xhsAnalysis.contentTemplate = contentTemplate;
            console.log('[StyleInit] ✅ 内容模板分析完成:', {
              name: contentTemplate.name,
              cardCount: contentTemplate.cardExamples?.length,
              source: contentTemplate.source,
              promptInstruction: contentTemplate.promptInstruction || '(待生成)',
            });
          } catch (contentErr) {
            console.error('[StyleInit] ⚠️ 内容模板分析失败，使用默认模板:', contentErr);
            // 降级：使用默认内容模板
            const { getDefaultContentTemplate } = await import('@/lib/services/xiaohongshu-visual-analyzer');
            xhsAnalysis.contentTemplate = getDefaultContentTemplate();
          }
        }
      }
      // 小红书分析结果不需要转换，后面直接保存
      analysis = null; // 小红书不走6维度分析
    } else {
      // 公众号/其他平台：使用6维度分析
      analysis = await styleDepositionService.analyzeSixDimensions(articleText, validatedTargetWordCount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 保存规则（根据平台类型走不同逻辑）
    // ═══════════════════════════════════════════════════════════════════════
    let savedCount = 0;
    const warnings: string[] = [];

    if (validatedPlatform === 'xiaohongshu' && xhsAnalysis) {
      // ========== 小红书：先做风格相似度校验，再保存 ==========
      const xhsValidation = await styleSimilarityValidator.validateXiaohongshu(xhsAnalysis, finalTemplateId!, workspaceId);
      
      console.log('[StyleInit] 小红书风格相似度校验结果:', {
        canSave: xhsValidation.canSave,
        similarity: xhsValidation.similarity,
        skipped: xhsValidation.skipped,
        warning: xhsValidation.warning,
      });
      
      // 相似度过低，拒绝保存
      if (!xhsValidation.canSave) {
        return NextResponse.json({
          success: false,
          error: xhsValidation.warning || '小红书风格差异过大，建议更换模板',
          code: 'XHS_STYLE_SIMILARITY_TOO_LOW',
          data: {
            xhsAnalysis,
            similarity: xhsValidation.similarity,
            details: xhsValidation.details,
            recommendation: xhsValidation.recommendation ? {
              templateId: xhsValidation.recommendation.templateId,
              templateName: xhsValidation.recommendation.templateName,
              similarity: xhsValidation.recommendation.similarity,
            } : undefined,
          },
        }, { status: 400 });
      }
      
      // 校验通过（或有警告但允许保存），保存规则
      const { convertAnalysisToRules: convertXhsToRules } = await import('@/lib/services/xiaohongshu-style-analyzer');
      const xhsRules = convertXhsToRules(xhsAnalysis, finalTemplateId!, workspaceId);
      
      if (xhsRules.length > 0) {
        const { db } = await import('@/lib/db');
        const { styleAssets } = await import('@/lib/db/schema/digital-assets');
        
        try {
          await db.insert(styleAssets).values(xhsRules);
          savedCount = xhsRules.length;
          console.log('[StyleInit] ✅ 小红书规则保存成功:', savedCount, '条');
        } catch (insertErr) {
          console.error('[StyleInit] ❌ 小红书规则保存失败:', insertErr);
          warnings.push('规则分析完成但入库失败，请稍后重试');
        }

        // 更新模板规则数量
        if (finalTemplateId && savedCount > 0) {
          try {
            await styleTemplateService.updateTemplateRuleCount(finalTemplateId);
          } catch (updateError) {
            console.error('[StyleInit] 更新模板规则数量失败:', updateError);
          }
        }
      }
    } else if (analysis) {
      // ========== 公众号/其他平台：原有6维度逻辑 ==========
      
      // 风格相似度校验
      const styleValidation = await styleSimilarityValidator.validate(analysis, finalTemplateId!, workspaceId);
      
      console.log('[StyleInit] 风格相似度校验结果:', {
        canSave: styleValidation.canSave,
        similarity: styleValidation.similarity,
        skipped: styleValidation.skipped,
        warning: styleValidation.warning,
      });
      
      // 如果相似度过低，拒绝保存并返回错误
      if (!styleValidation.canSave) {
        return NextResponse.json({
          success: false,
          error: styleValidation.warning || '风格相似度过低，建议更换模板',
          code: 'STYLE_SIMILARITY_TOO_LOW',
          data: {
            similarity: styleValidation.similarity,
            details: styleValidation.details,
            recommendation: styleValidation.recommendation ? {
              templateId: styleValidation.recommendation.templateId,
              templateName: styleValidation.recommendation.templateName,
              similarity: styleValidation.recommendation.similarity,
            } : undefined,
          },
        }, { status: 400 });
      }

      // 将分析结果转换为 style_assets 格式并保存
      const rulesToSave = convertAnalysisToRules(analysis, articleTitle);

      if (rulesToSave.length > 0) {
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await styleDepositionService.saveDepositionResults(rulesToSave, workspaceId, finalTemplateId);
            savedCount = rulesToSave.length;
            lastError = null;
            break;
          } catch (saveError) {
            lastError = saveError instanceof Error ? saveError : new Error(String(saveError));
            console.error(`[StyleInit] 保存规则失败 (第 ${attempt}/${MAX_RETRIES} 次):`, lastError.message);
            
            if (attempt < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        
        if (lastError) {
          console.error(`[StyleInit] 保存规则最终失败:`, lastError);
          warnings.push(`规则分析完成但入库失败（${rulesToSave.length} 条规则未持久化），请稍后重试`);
        } else if (finalTemplateId) {
          try {
            await styleTemplateService.updateTemplateRuleCount(finalTemplateId);
          } catch (updateError) {
            console.error('[StyleInit] 更新模板规则数量失败:', updateError);
            warnings.push('规则已保存，但模板规则数量更新失败');
          }
        }
      }
    }

    // 保存文章哈希记录（含分析结果缓存，下次重复提交可直接返回）
    try {
      // 构建缓存的分析结果，供下次重复提交时直接返回
      const cachedAnalysisData: Record<string, any> = {};
      if (validatedPlatform === 'xiaohongshu' && xhsAnalysis) {
        cachedAnalysisData.xhsAnalysis = xhsAnalysis;
      } else if (analysis) {
        cachedAnalysisData.analysis = analysis;
      }

      await articleDedupService.saveArticleHash({
        articleText,
        articleTitle,
        userId: workspaceId,
        templateId: finalTemplateId,
        analysis: Object.keys(cachedAnalysisData).length > 0 ? cachedAnalysisData : undefined,
      });
      console.log('[StyleInit] 文章哈希记录已保存');
    } catch (hashError) {
      console.error('[StyleInit] 保存文章哈希失败:', hashError);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 返回结果（区分平台）
    // ═══════════════════════════════════════════════════════════════════════
    const responseData: Record<string, any> = {
      savedRules: savedCount,
      warnings,
      articleTitle,
      templateId: finalTemplateId,
      processedAt: new Date().toISOString(),
      fromCache: false,
      duplicateInfo,
    };

    if (validatedPlatform === 'xiaohongshu' && xhsAnalysis) {
      responseData.xhsAnalysis = xhsAnalysis;
    } else if (analysis) {
      responseData.analysis = analysis;
      // 风格相似度信息（仅公众号）
      const styleValidation = await styleSimilarityValidator.validate(analysis, finalTemplateId!, workspaceId).catch(() => ({ canSave: true, similarity: 0, skipped: true, warning: undefined, details: undefined }));
      responseData.styleSimilarity = {
        similarity: styleValidation.similarity,
        skipped: styleValidation.skipped,
        warning: styleValidation.warning,
        details: styleValidation.details,
      };
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('[StyleInit] 处理失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误',
    }, { status: 500 });
  }
}

/**
 * GET /api/style/init-from-upload
 *
 * 查询当前 style_assets 中已有的规则数量和维度覆盖情况
 */
export async function GET() {
  try {
    const { db } = await import('@/lib/db');
    const { styleAssets } = await import('@/lib/db/schema/digital-assets');

    const allRules = await db.select({
      id: styleAssets.id,
      ruleType: styleAssets.ruleType,
      sourceType: styleAssets.sourceType,
      ruleContent: styleAssets.ruleContent, // M4: 用 ruleContent 作为维度推断的备选
    }).from(styleAssets);

    // 按维度统计（M4: 从 ruleContent 推断维度，因 schema 无 metadata 字段）
    const dimensionStats: Record<string, number> = {};
    for (const rule of allRules) {
      // M4: 从 ruleContent 前缀推断维度归属
      let dim = 'unknown';
      if (rule.ruleContent.includes('整体调性')) dim = 'overallTone';
      else if (rule.ruleContent.includes('称呼代词') || rule.ruleContent.includes('口语化')) dim = 'toneAndVoice';
      else if (rule.ruleContent.includes('特色词汇') || rule.ruleContent.includes('绝对化')) dim = 'expressionHabits';
      else if (rule.ruleContent.includes('案例命名') || rule.ruleContent.includes('数据源') || rule.ruleContent.includes('合规')) dim = 'contentDetails';
      else if (rule.ruleContent.includes('排版') || rule.ruleContent.includes('段长') || rule.ruleContent.includes('字数')) dim = 'formattingStyle';
      dimensionStats[dim] = (dimensionStats[dim] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRules: allRules.length,
        dimensions: dimensionStats,
        hasData: allRules.length > 0,
      },
    });
  } catch (error) {
    console.error('[StyleInit] 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: '查询失败',
    }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════
// 内部工具函数：将 6 维度分析结果转换为 StyleDepositionResult 格式
// ═══════════════════════════════════════════════════

function convertAnalysisToRules(
  analysis: Awaited<ReturnType<typeof styleDepositionService.analyzeSixDimensions>>,
  articleTitle: string
): StyleDepositionResult[] {
  const results: StyleDepositionResult[] = [];

  // 维度① 整体调性
  if (analysis.overallTone) {
    const t = analysis.overallTone;
    results.push(
      {
        ruleType: 'emotion' as const,
        ruleContent: `整体调性: ${t.overallTone} | 消费者立场${t.consumerStance}/10 | 专业${t.professionalism}/10 | 温度${t.warmth}/10`,
        ruleCategory: t.consumerStance >= 7 ? ('positive' as const) : ('negative' as const),
        confidence: String(t.consumerStance / 10),
        sourceType: 'llm_assist' as const, // 对齐 digital-assets.ts schema 约定: manual/auto_nlp/feedback/llm_assist
        metadata: { dimension: 'overallTone', sourceArticle: articleTitle, ...t },
      },
      {
        ruleType: 'core_stance' as const,
        ruleContent: `核心调性要求: ${t.summary}`,
        ruleCategory: 'positive' as const,
        confidence: String(0.9),
        sourceType: 'llm_assist' as const, // 对齐 digital-assets.ts schema 约定: manual/auto_nlp/feedback/llm_assist
        metadata: { dimension: 'overallTone', sourceArticle: articleTitle },
      }
    );
  }

  // 维度② 语气与口吻
  if (analysis.toneAndVoice) {
    const tv = analysis.toneAndVoice;
    const ps = tv.pronounStats;

    if (ps.niCount > 2) {
      results.push({
        ruleType: 'vocabulary' as const,
        ruleContent: `称呼代词: 使用「你」(出现${ps.niCount}次)，营造亲切感；避免「您/贵/客户」(检测到${ps.ninGuaiguiCount + ps.kehuCount}次)`,
        ruleCategory: 'positive' as const,
        confidence: String(Math.min(1, ps.niCount / 10)),
        sourceType: 'auto_nlp' as const,
        metadata: { dimension: 'toneAndVoice', sourceArticle: articleTitle, pronounStats: ps },
      });
    }

    if (tv.formalityLevel === 'informal') {
      results.push({
        ruleType: 'vocabulary' as const,
        ruleContent: `口语化表达: 口语化程度${(tv.colloquialismScore * 100).toFixed(0)}%，使用「咱们」「呢」「吧」等口语标记词`,
        ruleCategory: 'positive' as const,
        confidence: String(tv.colloquialismScore),
        sourceType: 'auto_nlp' as const,
        metadata: { dimension: 'toneAndVoice', formalityLevel: tv.formalityLevel },
      });
    }
  }

  // 维度④ 表达习惯
  if (analysis.expressionHabits) {
    const eh = analysis.expressionHabits;

    // 高频特色词汇
    for (const w of eh.customVocabulary.slice(0, 8)) {
      results.push({
        ruleType: 'vocabulary' as const,
        ruleContent: `${w.category}高频词: 「${w.word}」(使用${w.count}次)`,
        ruleCategory: 'positive' as const,
        confidence: String(Math.min(1, w.count / 3)),
        sourceType: 'auto_nlp' as const,
        metadata: { dimension: 'expressionHabits', category: w.category, word: w.word },
      });
    }

    // 绝对化禁用词
    for (const w of eh.absoluteWords.filter(w => w.count > 0)) {
      results.push({
        ruleType: 'forbidden_supplement' as const,
        ruleContent: `避免绝对化表达: 「${w.word}」(出现${w.count}次)`,
        ruleCategory: 'negative' as const,
        confidence: String(0.85),
        sourceType: 'auto_nlp' as const,
        metadata: { dimension: 'expressionHabits', forbiddenWord: w.word },
      });
    }
  }

  // 维度⑤ 内容细节
  if (analysis.contentDetails) {
    const cd = analysis.contentDetails;
    const safeArr = (v: unknown): string[] => Array.isArray(v) ? v : [];

    if (safeArr(cd.caseNames).length > 0) {
      results.push({
        ruleType: 'logic' as const,
        ruleContent: `案例命名规范: 使用匿名化称呼 — ${safeArr(cd.caseNames).join('、')}`,
        ruleCategory: 'positive' as const,
        confidence: String(0.9),
        sourceType: 'auto_nlp' as const,
        metadata: { dimension: 'contentDetails', caseNames: safeArr(cd.caseNames), sourceArticle: articleTitle },
      });
    }

    if (safeArr(cd.officialSources).length > 0) {
      results.push({
        ruleType: 'logic' as const,
        ruleContent: `数据源规范: 引用官方机构数据 — ${safeArr(cd.officialSources).join('、')}`,
        ruleCategory: 'positive' as const,
        confidence: String(0.9),
        sourceType: 'auto_nlp' as const,
        metadata: { dimension: 'contentDetails', officialSources: safeArr(cd.officialSources) },
      });
    }

    if (!cd.hasComplianceStatement) {
      results.push({
        ruleType: 'logic' as const,
        ruleContent: `合规要求: 文末需添加风险提示/免责声明`,
        ruleCategory: 'negative' as const,
        confidence: String(0.8),
        sourceType: 'auto_nlp' as const,
        metadata: { dimension: 'contentDetails', missingCompliance: true },
      });
    }

    if (safeArr(cd.nonCompliantCaseNames).length > 0) {
      results.push({
        ruleType: 'forbidden_supplement' as const,
        ruleContent: `案例名违规: 检测到非规范案例名 — ${safeArr(cd.nonCompliantCaseNames).join('、')}，应改为匿名化称呼`,
        ruleCategory: 'negative' as const,
        confidence: String(0.9),
        sourceType: 'auto_nlp' as const,
        metadata: { dimension: 'contentDetails', nonCompliant: safeArr(cd.nonCompliantCaseNames) },
      });
    }
  }

  // 维度⑥ 排版风格
  if (analysis.formattingStyle) {
    const fs = analysis.formattingStyle;

    results.push({
      ruleType: 'structure_supplement' as const,
      ruleContent: `排版规范: 平均段长${fs.avgParagraphLength}字 | 短段占比${(fs.shortParagraphRatio * 100).toFixed(0)}% | 小标题${fs.headingCount}个(${fs.headingPattern}) | 总字数${fs.totalWordCount}`,
      ruleCategory: fs.compliance ? ('positive' as const) : ('negative' as const),
      confidence: String(0.85),
      sourceType: 'auto_nlp' as const,
      metadata: { dimension: 'formattingStyle', ...fs, sourceArticle: articleTitle },
    });

    if (fs.targetWordCount && !fs.compliance) {
      results.push({
        ruleType: 'structure_supplement' as const,
        ruleContent: `字数偏差: 当前${fs.totalWordCount}字，目标${fs.targetWordCount}字，建议调整至±15%范围内`,
        ruleCategory: 'negative' as const,
        confidence: String(0.8),
        sourceType: 'auto_nlp' as const,
        metadata: { dimension: 'formattingStyle', targetWordCount: fs.targetWordCount },
      });
    }
  }

  return results;
}
