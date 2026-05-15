import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { getParadigmInitStatusList, getInitializedParadigmReferences } from '@/lib/services/paradigm-init-service';

/**
 * 范式初始化状态查询 API
 * 
 * GET /api/article-extraction/paradigm-status
 *   - 查询10套范式的初始化状态
 *   - 支持 mode=references 获取已初始化范式的素材参考
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    if (mode === 'references') {
      // 获取已初始化范式的素材参考（用于提取时注入）
      const excludeParadigmId = searchParams.get('excludeParadigmId') || undefined;
      const references = await getInitializedParadigmReferences(workspaceId, excludeParadigmId);
      return NextResponse.json({
        success: true,
        data: references,
      });
    }

    // 默认：返回10套范式完整初始化状态
    const statusList = await getParadigmInitStatusList(workspaceId);
    
    // 汇总统计
    const initializedCount = statusList.filter(s => s.isInitialized).length;
    const totalExtractions = statusList.reduce((sum, s) => sum + s.extractionCount, 0);
    const totalMaterials = statusList.reduce((sum, s) => sum + s.totalMaterialCount, 0);
    
    // 覆盖维度统计
    const allCoveredDimensions = new Set<string>();
    for (const s of statusList) {
      for (const dim of s.coveredDimensions) {
        allCoveredDimensions.add(dim);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        paradigms: statusList,
        summary: {
          total: statusList.length,
          initialized: initializedCount,
          uninitialized: statusList.length - initializedCount,
          initializationRate: Math.round((initializedCount / statusList.length) * 100),
          totalExtractions,
          totalMaterials,
          coveredDimensions: Array.from(allCoveredDimensions),
          totalCoveredDimensions: allCoveredDimensions.size,
          totalPossibleDimensions: 7, // 7维关系型素材
        },
      },
    });
  } catch (error: any) {
    console.error('[paradigm-status] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '查询失败' },
      { status: 500 }
    );
  }
}
