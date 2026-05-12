import { NextRequest, NextResponse } from 'next/server';
import { WechatComplianceAuditor } from '@/lib/mcp/wechat-compliance-auditor';

export const maxDuration = 120;

/**
 * 简单测试 MCP 返回结果日志功能
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[TestMcpResultSimple] ========== 开始测试 MCP 返回结果 ==========');
    
    // 测试 1: 包含违规内容的文章
    console.log('[TestMcpResultSimple] 测试 1: 包含违规内容的文章');
    const test1Params = {
      articleTitle: '测试违规文章',
      articleContent: '这是一篇测试文章，包含绝对化用语，比如最好、最佳、第一、完美等词汇，还有保本、保息、刚性兑付等保险敏感词。'
    };
    
    const result1 = await WechatComplianceAuditor.contentAudit(test1Params);
    console.log('[TestMcpResultSimple] 测试 1 结果:', result1);
    
    // 测试 2: 正常合规的文章
    console.log('\n[TestMcpResultSimple] 测试 2: 正常合规的文章');
    const test2Params = {
      articleTitle: '正常文章',
      articleContent: '这是一篇正常的文章，内容合规，没有违规词汇。文章客观中立，符合相关规定。'
    };
    
    const result2 = await WechatComplianceAuditor.contentAudit(test2Params);
    console.log('[TestMcpResultSimple] 测试 2 结果:', result2);
    
    // 测试 3: 快速检查模式
    console.log('\n[TestMcpResultSimple] 测试 3: 快速检查模式');
    const test3Params = {
      articleTitle: '快速检查测试',
      articleContent: '这篇文章包含一些绝对化用语，比如顶级、唯一、首个。'
    };
    
    const result3 = await WechatComplianceAuditor.contentAuditSimple(test3Params);
    console.log('[TestMcpResultSimple] 测试 3 结果:', result3);
    
    console.log('\n[TestMcpResultSimple] ========== 所有测试完成 ==========');
    
    return NextResponse.json({
      success: true,
      message: 'MCP 返回结果日志测试完成',
      testResults: {
        test1: result1,
        test2: result2,
        test3: result3
      }
    });
    
  } catch (error) {
    console.error('[TestMcpResultSimple] 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
