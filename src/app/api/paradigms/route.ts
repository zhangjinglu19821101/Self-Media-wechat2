/**
 * 创作范式列表 API
 * 用于前端范式选择卡片
 */

import { NextRequest, NextResponse } from 'next/server';
import { PARADIGM_SEED_DATA } from '@/lib/db/schema/paradigm-seed-data';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform') || 'wechat_official'; // wechat_official | xiaohongshu
    
    // 转换范式数据为前端友好格式
    const paradigms = PARADIGM_SEED_DATA.map(p => {
      // 根据平台选择对应的结构
      const structure = platform === 'xiaohongshu' 
        ? p.xiaohongshuStructure 
        : p.officialAccountStructure;
      
      // 从情绪曲线提取主导情绪作为情感基调
      const dominantEmotion = p.emotionCurve?.reduce((prev, curr) => 
        curr.intensity > prev.intensity ? curr : prev
      , p.emotionCurve[0])?.emotion || '理性客观';

      // 从素材位置映射提取所需素材类型
      const materialTypes = [...new Set(
        p.materialPositionMap?.flatMap(m => m.materialTypes) || []
      )];
      
      return {
        paradigmCode: p.paradigmCode,
        id: p.paradigmCode,
        name: p.paradigmName,
        description: p.description,
        sectionCount: structure.length,
        totalWordRange: {
          min: structure.reduce((sum, s) => sum + s.wordRange.min, 0),
          max: structure.reduce((sum, s) => sum + s.wordRange.max, 0),
        },
        applicableArticleTypes: p.applicableArticleTypes,
        applicableTypes: p.applicableArticleTypes,
        applicableSceneKeywords: p.applicableSceneKeywords.slice(0, 5),
        signaturePhrases: p.signaturePhrases.slice(0, 3),
        sortOrder: p.sortOrder,
        emotionTone: dominantEmotion,
        structureName: `${structure.length}段${p.paradigmName.replace('范式', '')}结构`,
        materialRequirements: materialTypes.length > 0 
          ? `需要: ${materialTypes.join(' + ')}` 
          : '案例 + 类比 + 数据',
        // 结构预览（用于面板展开）
        structurePreview: structure.map(s => ({
          order: s.order,
          name: s.stepName,
          wordRange: s.wordRange,
          contentRequirement: s.contentRequirement,
        })),
      };
    });
    
    return NextResponse.json({
      success: true,
      data: paradigms,
      platform,
    });
  } catch (error) {
    console.error('[Paradigms API] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取范式列表失败' },
      { status: 500 }
    );
  }
}
