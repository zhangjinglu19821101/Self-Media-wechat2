import { NextRequest, NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';
import { genericMCPCall } from '@/lib/mcp/generic-mcp-call';

export const maxDuration = 120;

/**
 * 测试 MCP 返回结果日志功能
 * 测试合规审核 MCP 的详细日志输出
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[TestMcpResultLogging] ========== 开始测试 MCP 返回结果日志 ==========');
    
    const engine = new SubtaskExecutionEngine();
    
    // 测试 1: 直接测试 executeCapabilityWithParams 方法的日志
    console.log('[TestMcpResultLogging] 测试 1: 合规审核 MCP - 包含违规内容');
    
    const testParams1 = {
      toolName: 'WechatComplianceAuditor',
      actionName: 'contentAudit',
      solutionNum: 1,
      params: {
        articleTitle: '测试文章',
        articleContent: '这是一篇测试文章，包含绝对化用语，比如最好、最佳、第一、完美等词汇，还有保本、保息、刚性兑付等保险敏感词。'
      }
    };
    
    console.log('[TestMcpResultLogging] 调用 executeCapabilityWithParams...');
    // @ts-ignore - 调用私有方法进行测试
    const result1 = await engine['executeCapabilityWithParams'](
      { id: 'test-task-1' } as any, 
      testParams1
    );
    
    console.log('[TestMcpResultLogging] 测试 1 完成，结果:', result1);
    
    // 测试 2: 合规审核 MCP - 不包含违规内容
    console.log('\n[TestMcpResultLogging] ========== 测试 2: 合规审核 MCP - 不包含违规内容 ==========');
    
    const testParams2 = {
      toolName: 'WechatComplianceAuditor',
      actionName: 'contentAudit',
      solutionNum: 1,
      params: {
        articleTitle: '正常文章',
        articleContent: '这是一篇正常的文章，内容合规，没有违规词汇。文章客观中立，符合相关规定。'
      }
    };
    
    // @ts-ignore
    const result2 = await engine['executeCapabilityWithParams'](
      { id: 'test-task-2' } as any, 
      testParams2
    );
    
    console.log('[TestMcpResultLogging] 测试 2 完成，结果:', result2);
    
    // 测试 3: 快速检查模式
    console.log('\n[TestMcpResultLogging] ========== 测试 3: 快速检查模式 ==========');
    
    const testParams3 = {
      toolName: 'WechatComplianceAuditor',
      actionName: 'contentAuditSimple',
      solutionNum: 1,
      params: {
        articleTitle: '快速检查测试',
        articleContent: '这篇文章包含一些绝对化用语，比如顶级、唯一、首个。'
      }
    };
    
    // @ts-ignore
    const result3 = await engine['executeCapabilityWithParams'](
      { id: 'test-task-3' } as any, 
      testParams3
    );
    
    console.log('[TestMcpResultLogging] 测试 3 完成，结果:', result3);
    
    // 测试 4: 直接调用 genericMCPCall 查看日志
    console.log('\n[TestMcpResultLogging] ========== 测试 4: 直接调用 genericMCPCall ==========');
    
    const genericResult = await genericMCPCall(
      'WechatComplianceAuditor',
      'contentAudit',
      {
        articleTitle: '直接调用测试',
        articleContent: '直接调用 MCP 接口，看看日志输出情况。'
      }
    );
    
    console.log('[TestMcpResultLogging] genericMCPCall 结果:', genericResult);
    
    console.log('\n[TestMcpResultLogging] ========== 所有测试完成 ==========');
    
    return NextResponse.json({
      success: true,
      message: 'MCP 返回结果日志测试完成',
      testResults: {
        test1: result1,
        test2: result2,
        test3: result3,
        test4: genericResult
      }
    });
    
  } catch (error) {
    console.error('[TestMcpResultLogging] 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
