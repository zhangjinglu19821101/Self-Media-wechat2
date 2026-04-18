import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { genericMCPCall } from '@/lib/mcp/generic-mcp-call';

export async function GET(request: NextRequest) {
  console.log('[Real Compliance Test] 开始测试真实合规审核能力');

  try {
    // ========== 步骤1：查询真实的合规审核能力 ==========
    console.log('[Real Compliance Test] ========== 步骤1：查询合规审核能力 ==========');
    const capabilities = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.status, 'available'));
    
    const complianceCapabilities = capabilities.filter(cap => 
      cap.id === 20 || cap.id === 21 ||
      cap.functionDesc?.toLowerCase().includes('合规') ||
      cap.functionDesc?.toLowerCase().includes('审核')
    );
    
    console.log('[Real Compliance Test] 找到合规审核能力:', complianceCapabilities.map(c => ({
      id: c.id,
      functionDesc: c.functionDesc,
      toolName: c.toolName,
      actionName: c.actionName
    })));
    
    if (complianceCapabilities.length === 0) {
      return NextResponse.json({
        error: '没有找到合规审核能力',
        step: 'query_capabilities'
      }, { status: 400 });
    }

    // ========== 步骤2：构建真实的测试文章 ==========
    console.log('[Real Compliance Test] ========== 步骤2：构建测试文章 ==========');
    const testArticle = {
      title: '重疾险产品介绍',
      author: '保险事业部',
      digest: '介绍我们的重大疾病保险产品',
      content: `
# 重疾险产品介绍

重大疾病保险是一种能够为被保险人提供重大疾病保障的保险产品。当被保险人被确诊患有保险合同约定的重大疾病时，保险公司将按照合同约定给付保险金。

## 产品特色

1. **保障全面**：涵盖100种重大疾病，包括恶性肿瘤、急性心肌梗塞、脑中风后遗症等
2. **赔付比例高**：确诊即赔，最高可赔付300%基本保额
3. **保费实惠**：性价比高，每天仅需几块钱
4. **理赔快速**：资料齐全，3天内赔付

## 投保案例

王先生，30岁，投保50万基本保额，20年交：
- 年交保费：6500元
- 保障期限：终身
- 等待期：90天

等待期后，王先生不幸确诊白血病，可获得150万赔付（300%保额）。

## 常见问题

**Q: 这个保险是最好的吗？**
A: 是的，这是市场上最好的重疾险产品，理赔速度最快，保障最全面。

**Q: 保险公司会倒闭吗？**
A: 不会，我们的保险公司绝对不会倒闭，你可以放心投保。

立即投保，给您和家人最全面的保障！
`,
      show_cover_pic: 0
    };

    console.log('[Real Compliance Test] 测试文章构建完成:', {
      title: testArticle.title,
      contentLength: testArticle.content.length
    });

    // ========== 步骤3：测试每个合规审核能力 ==========
    console.log('[Real Compliance Test] ========== 步骤3：测试合规审核能力 ==========');
    const results = [];

    for (const cap of complianceCapabilities) {
      console.log(`[Real Compliance Test] 测试能力 ID=${cap.id}: ${cap.functionDesc}`);
      
      try {
        const mcpParams = {
          accountId: 'insurance-account',
          articles: [testArticle]
        };

        console.log(`[Real Compliance Test] MCP 请求参数:`, {
          toolName: cap.toolName,
          actionName: cap.actionName,
          params: mcpParams
        });

        const startTime = Date.now();
        const mcpResult = await genericMCPCall(
          cap.toolName,
          cap.actionName,
          mcpParams
        );
        const executionTime = Date.now() - startTime;

        console.log(`[Real Compliance Test] MCP 执行成功，耗时 ${executionTime}ms`);

        results.push({
          capabilityId: cap.id,
          functionDesc: cap.functionDesc,
          toolName: cap.toolName,
          actionName: cap.actionName,
          success: true,
          executionTime,
          result: mcpResult
        });

      } catch (error) {
        console.error(`[Real Compliance Test] MCP 执行失败 (ID=${cap.id}):`, error);
        results.push({
          capabilityId: cap.id,
          functionDesc: cap.functionDesc,
          toolName: cap.toolName,
          actionName: cap.actionName,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // ========== 步骤4：返回结果 ==========
    console.log('[Real Compliance Test] ========== 测试完成 ==========');

    return NextResponse.json({
      success: true,
      summary: {
        totalCapabilities: complianceCapabilities.length,
        successCount: results.filter(r => r.success).length,
        failedCount: results.filter(r => !r.success).length
      },
      results,
      testArticle: {
        title: testArticle.title,
        contentPreview: testArticle.content.substring(0, 300)
      }
    });

  } catch (error) {
    console.error('[Real Compliance Test] 测试失败:', error);
    return NextResponse.json({
      error: '测试失败',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
