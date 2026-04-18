import { NextResponse } from 'next/server';
import { getMcpResultTextGenerator } from '@/lib/services/mcp-result-text-generator';

// 测试数据
const testCases = [
  {
    name: '网络搜索工具',
    request: {
      toolName: 'web_search',
      actionName: 'search',
      resultStatus: 'success',
      resultData: {
        query: '2024年保险行业发展趋势',
        totalResults: 156,
        results: [
          {
            title: '2024年中国保险市场分析报告',
            snippet: '2024年保险行业总体保持稳健增长，保费收入同比增长8.5%，健康险业务增长最快，数字化转型成效显著。',
            source: '中国保险行业协会',
            date: '2024-12-15',
            relevance: 95
          },
          {
            title: '数字化转型推动保险服务创新',
            snippet: '各大保险公司加速数字化转型，AI理赔、智能客服等新技术广泛应用，线上理赔占比提升至65%，客户满意度提高20%。',
            source: '金融时报',
            date: '2024-11-20',
            relevance: 88
          }
        ],
        summary: '2024年保险行业整体发展态势良好，数字化转型和健康险是两大增长引擎。行业总体保持稳健增长，科技投入持续增加。'
      }
    }
  },
  {
    name: '合规校验工具（已有 formattedSummary）',
    request: {
      toolName: 'wechat_compliance_auditor',
      actionName: 'audit_article',
      resultStatus: 'success',
      resultData: {
        approved: true,
        riskLevel: 'low',
        issues: [],
        suggestions: ['匿名化医院名称', '补充数据来源'],
        auditId: 'audit-2026-03-21-001',
        formattedSummary: `文章合规审核完成！
- 审核状态：通过 ✓
- 风险等级：低风险
- 发现问题：无
- 优化建议：
  1. 对文章中提及的具体医院名称进行匿名化处理
  2. 适当补充引用数据来源以增强文章可信度
- 审核ID：audit-2026-03-21-001`
      }
    }
  },
  {
    name: '数据获取工具',
    request: {
      toolName: 'data_fetcher',
      actionName: 'get_statistics',
      resultStatus: 'success',
      resultData: {
        dataset: 'insurance_market_2024',
        metrics: {
          totalPremium: '4.5万亿元',
          growthRate: '+8.5%',
          marketSize: '全球第二大保险市场',
          penetrationRate: '4.2%'
        },
        keyFindings: [
          '健康险业务增长最快，同比增长12.3%',
          '数字化转型投入同比增长15.8%',
          '线上理赔占比提升至65%'
        ],
        timestamp: '2026-03-21T01:00:00Z'
      }
    }
  },
  {
    name: '未知工具（降级到 JSON）',
    request: {
      toolName: 'unknown_tool',
      actionName: 'do_something',
      resultStatus: 'success',
      resultData: {
        foo: 'bar',
        answer: 42
      }
    }
  }
];

export async function GET() {
  try {
    console.log('🧪 开始测试 MCP 结果文本生成器...');
    console.log('============================================================================');
    console.log('');

    const generator = getMcpResultTextGenerator();
    const results: any[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`═══════════════════════════════════════════════════════════════`);
      console.log(`📊 测试案例 ${i + 1}: ${testCase.name}`);
      console.log(`═══════════════════════════════════════════════════════════════`);
      console.log('');

      console.log('🔍 输入数据:');
      console.log(JSON.stringify(testCase.request, null, 2).substring(0, 500) + '...');
      console.log('');

      console.log('🤖 正在生成...');
      const startTime = Date.now();
      const result = await generator.generate(testCase.request);
      const latency = Date.now() - startTime;

      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('📖 生成结果:');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(result.text);
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('');

      console.log('📊 性能数据:');
      console.log(`   成功: ${result.success ? '✅' : '❌'}`);
      console.log(`   耗时: ${latency}ms`);
      if (result.fromCache) {
        console.log(`   来源: 📦 缓存 (缓存时间: ${result.cachedAt})`);
      } else if (result.llmLatencyMs) {
        console.log(`   来源: 🤖 LLM (LLM耗时: ${result.llmLatencyMs}ms)`);
      } else {
        console.log(`   来源: ⬇️  降级 (JSON 格式)`);
      }
      console.log('');

      results.push({
        testCase: i + 1,
        name: testCase.name,
        request: testCase.request,
        result,
        latencyMs: latency
      });
    }

    // 测试缓存命中
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔄 测试缓存命中（重复调用第一个案例）');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    const cacheTestStart = Date.now();
    const cacheResult = await generator.generate(testCases[0].request);
    const cacheLatency = Date.now() - cacheTestStart;

    console.log('📊 缓存测试结果:');
    console.log(`   缓存命中: ${cacheResult.fromCache ? '✅' : '❌'}`);
    console.log(`   耗时: ${cacheLatency}ms (vs 首次: ${results[0].latencyMs}ms)`);
    if (cacheResult.fromCache) {
      console.log(`   ⚡ 加速比: ${Math.round(results[0].latencyMs / cacheLatency)}x`);
    }
    console.log('');

    // 统计信息
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📈 总体统计');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    const stats = generator.getStats();
    console.log('Generator 统计:');
    console.log(`   总请求数: ${stats.totalRequests}`);
    console.log(`   缓存命中: ${stats.cacheHits}`);
    console.log(`   LLM 调用: ${stats.llmCalls}`);
    console.log(`   降级次数: ${stats.fallbackToJson}`);
    console.log(`   缓存命中率: ${stats.cacheHitRate}`);
    console.log(`   平均 LLM 耗时: ${stats.avgLlmLatencyMs}ms`);
    console.log('');
    console.log('缓存统计:');
    console.log(`   缓存大小: ${stats.cacheStats.size}`);
    console.log(`   平均命中次数: ${stats.cacheStats.hitRate.toFixed(2)}`);
    console.log('');

    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'MCP 结果文本生成器测试完成',
      results,
      cacheTest: {
        hit: cacheResult.fromCache,
        latencyMs: cacheLatency,
        originalLatencyMs: results[0].latencyMs
      },
      stats
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
