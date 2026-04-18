import { NextRequest, NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

export const maxDuration = 120;

/**
 * 测试 MCP 增强日志功能
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[TestMcpEnhancedLogging] ========== 开始测试 MCP 增强日志功能 ==========');
    
    const engine = new SubtaskExecutionEngine();
    
    // 测试: 包含违规内容的文章
    console.log('[TestMcpEnhancedLogging] 测试: 包含违规内容的文章');
    
    const testParams = {
      toolName: 'WechatComplianceAuditor',
      actionName: 'contentAudit',
      solutionNum: 1,
      params: {
        articleTitle: '测试违规文章',
        articleContent: '这是一篇测试文章，包含绝对化用语，比如最好、最佳、第一、完美等词汇，还有保本、保息、刚性兑付等保险敏感词。'
      }
    };
    
    // 调用 executeCapabilityWithParams 方法
    // @ts-ignore
    const result = await engine['executeCapabilityWithParams'](
      { id: 'test-task-1' } as any, 
      testParams
    );
    
    console.log('[TestMcpEnhancedLogging] 测试完成，结果:', result);
    
    console.log('[TestMcpEnhancedLogging] ========== 增强日志功能测试结束 ==========');
    
    return NextResponse.json({
      success: true,
      message: 'MCP 增强日志功能测试完成',
      result: result
    });
    
  } catch (error) {
    console.error('[TestMcpEnhancedLogging] 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
