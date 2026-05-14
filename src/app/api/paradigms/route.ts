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
      
      return {
        id: p.paradigmCode,
        name: p.paradigmName,
        description: p.description,
        sectionCount: structure.length,
        totalWordRange: {
          min: structure.reduce((sum, s) => sum + s.wordRange.min, 0),
          max: structure.reduce((sum, s) => sum + s.wordRange.max, 0),
        },
        applicableArticleTypes: p.applicableArticleTypes,
        applicableSceneKeywords: p.applicableSceneKeywords.slice(0, 5), // 只取前5个关键词
        signaturePhrases: p.signaturePhrases.slice(0, 3), // 只取前3个标志性句式
        sortOrder: p.sortOrder,
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
