/**
 * 微信公众号合规审核测试 API
 *
 * POST /api/test/wechat-compliance
 *
 * 功能：
 * 1. 测试完整合规审核（RAG + LLM 框架）
 * 2. 测试快速合规检查
 * 3. 返回审核结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { createWeChatComplianceAuditor } from '@/lib/mcp/wechat-compliance-auditor';

/**
 * POST - 测试微信合规审核
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      articleTitle = '测试文章：这是最好的保险产品',
      articleContent = `# 这是最好的保险产品

本文将为您介绍一款最好的保险产品，绝对是您的最佳选择！

## 产品特点

1. **最好的保障**：提供最好的保障范围
2. **顶级服务**：顶级的客户服务体验
3. **100% 赔付**：承诺100%赔付，稳赚不赔
4. **零风险**：零风险投资，绝对安全

## 为什么选择这款产品？

这款产品是市场上唯一的选择，绝对不会让您失望！

*温馨提示：本文仅供参考，具体条款请以保险公司官方文件为准。*`,
      testType = 'both', // 'full' | 'simple' | 'both'
    } = body;

    console.log('🧪 开始测试微信合规审核');
    console.log(`📝 文章标题: ${articleTitle}`);
    console.log(`🧪 测试类型: ${testType}`);

    const auditor = createWeChatComplianceAuditor();
    const results: Record<string, any> = {};

    // 1. 测试完整审核
    if (testType === 'full' || testType === 'both') {
      console.log('🔍 执行完整合规审核...');
      const fullResult = await auditor.auditContent(articleTitle, articleContent);
      results.fullAudit = fullResult;
      console.log('✅ 完整审核完成:', fullResult);
    }

    // 2. 测试快速检查
    if (testType === 'simple' || testType === 'both') {
      console.log('⚡ 执行快速合规检查...');
      const simpleResult = await auditor.quickCheck(articleContent);
      results.simpleCheck = simpleResult;
      console.log('✅ 快速检查完成:', simpleResult);
    }

    // 返回测试结果
    return NextResponse.json({
      success: true,
      data: {
        testType,
        articleTitle,
        articleContent: articleContent.substring(0, 200) + '...',
        results,
      },
      message: '微信合规审核测试完成',
    });
  } catch (error) {
    console.error('❌ 测试微信合规审核失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
