import { NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

// 模拟 MCP 执行数据
const mockMcpAttempts = [
  // 案例1: 合规校验工具
  {
    decision: {
      toolName: 'wechat_compliance_auditor',
      actionName: 'audit_article'
    },
    result: {
      status: 'success',
      data: {
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

  // 案例2: 网络搜索工具
  {
    decision: {
      toolName: 'web_search',
      actionName: 'search'
    },
    result: {
      status: 'success',
      data: {
        query: '2024年保险行业发展趋势',
        totalResults: 156,
        results: [
          {
            title: '2024年中国保险市场分析报告',
            snippet: '2024年保险行业总体保持稳健增长，保费收入同比增长8.5%...',
            source: '中国保险行业协会',
            date: '2024-12-15',
            relevance: 95
          },
          {
            title: '数字化转型推动保险服务创新',
            snippet: '各大保险公司加速数字化转型，AI理赔、智能客服等新技术广泛应用...',
            source: '金融时报',
            date: '2024-11-20',
            relevance: 88
          }
        ],
        summary: '2024年保险行业整体发展态势良好，数字化转型和健康险是两大增长引擎。'
      }
    }
  },

  // 案例3: 数据获取工具
  {
    decision: {
      toolName: 'data_fetcher',
      actionName: 'get_statistics'
    },
    result: {
      status: 'success',
      data: {
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
  }
];

export async function GET() {
  try {
    console.log('');
    console.log('🧪 开始测试 mcpResultTexts 生成过程...');
    console.log('============================================================================');
    console.log('');

    const engine = new SubtaskExecutionEngine();
    const results: any[] = [];

    // 1. 测试 generateMcpResultText 方法
    console.log('📝 步骤1: 测试 generateMcpResultText 方法（生成数据库 resultText 字段）');
    console.log('');

    for (let i = 0; i < mockMcpAttempts.length; i++) {
      const attempt = mockMcpAttempts[i];
      console.log(`────────────────────────────────────────────────────────────────`);
      console.log(`📊 测试案例 ${i + 1}: ${attempt.decision.toolName}`);
      console.log(`────────────────────────────────────────────────────────────────`);
      console.log('');

      console.log('🔍 原始 MCP 数据:');
      console.log(JSON.stringify(attempt, null, 2).substring(0, 400) + '...');
      console.log('');

      console.log('🤖 调用 generateMcpResultText 方法...');
      const resultText = (engine as any).generateMcpResultText(attempt);

      console.log('');
      console.log('════════════════════════════════════════════════════════════');
      console.log('📖 生成的 resultText（数据库字段内容）:');
      console.log('════════════════════════════════════════════════════════════');
      console.log(resultText);
      console.log('════════════════════════════════════════════════════════════');
      console.log('');

      // 评估可读性
      const readability = assessReadability(resultText);
      console.log(`📊 可读性评估: ${readability.score}/100`);
      console.log(`   ${readability.comment}`);
      console.log('');

      results.push({
        testCase: i + 1,
        toolName: attempt.decision.toolName,
        originalData: attempt,
        generatedResultText: resultText,
        readability: readability
      });
    }

    // 2. 模拟 extractMcpResults 过程
    console.log('');
    console.log('📝 步骤2: 模拟 extractMcpResults 过程（生成 mcpResultTexts 数组）');
    console.log('');

    // 模拟数据库记录
    const mockDbRecords = results.map((r, i) => ({
      id: i + 1,
      toolName: r.toolName,
      actionName: mockMcpAttempts[i].decision.actionName,
      resultStatus: 'success',
      params: { articleTitle: '测试文章' },
      resultText: r.generatedResultText,
      resultData: mockMcpAttempts[i].result.data,
      attemptTimestamp: new Date()
    }));

    // 模拟 mcpResultTexts 的生成过程
    const mcpResultTexts: string[] = [];
    for (const record of mockDbRecords) {
      const text = `【MCP执行结果 - ${record.toolName || '未知工具'}】
时间：${record.attemptTimestamp?.toISOString() || '未知时间'}
工具：${record.toolName || '未知'}
动作：${record.actionName || '未知'}
状态：${record.resultStatus}
输入参数：
${record.params ? JSON.stringify(record.params, null, 2) : '无参数'}
输出结果：
${record.resultText}
`.trim();

      mcpResultTexts.push(text);

      console.log(`────────────────────────────────────────────────────────────────`);
      console.log(`📋 生成的 mcpResultTexts[${mockDbRecords.indexOf(record)}]:`);
      console.log('────────────────────────────────────────────────────────────────');
      console.log(text.substring(0, 800) + (text.length > 800 ? '...' : ''));
      console.log('');
    }

    // 3. 总结
    console.log('');
    console.log('📊 测试总结:');
    console.log('============================================================================');
    console.log('');
    console.log('🔄 完整生成流程:');
    console.log('   1. MCP 工具执行 → 返回 JSON 数据');
    console.log('   2. generateMcpResultText() → 生成 resultText（存入数据库）');
    console.log('   3. extractMcpResults() → 读取 resultText + 包装 → 生成 mcpResultTexts');
    console.log('');

    const avgReadability = Math.round(results.reduce((sum, r) => sum + r.readability.score, 0) / results.length);
    console.log(`📈 平均可读性评分: ${avgReadability}/100`);
    console.log('');

    console.log('📝 关于可读性的结论:');
    if (avgReadability >= 80) {
      console.log('   ✅ 可读性很强！生成的文本流畅自然，Agent 能很好理解。');
    } else if (avgReadability >= 60) {
      console.log('   ⚠️  可读性一般，建议优化格式化逻辑。');
    } else {
      console.log('   ❌ 可读性较差，需要重新设计文本化逻辑。');
    }
    console.log('');
    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'mcpResultTexts 生成过程测试完成',
      testResults: results,
      mcpResultTexts: mcpResultTexts,
      summary: {
        totalTests: results.length,
        averageReadability: avgReadability,
        generationFlow: [
          'MCP 工具执行 → JSON 数据',
          'generateMcpResultText() → resultText（数据库字段）',
          'extractMcpResults() → mcpResultTexts（提示词用）'
        ]
      }
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// 辅助函数：评估可读性
function assessReadability(text: string): { score: number; comment: string } {
  let score = 50;
  let comments: string[] = [];

  // 检查是否有清晰的标题
  if (text.includes('【') || text.includes('】')) {
    score += 15;
    comments.push('有清晰的标题标识');
  }

  // 检查换行和分段
  const lineCount = (text.match(/\n/g) || []).length;
  if (lineCount >= 3) {
    score += 10;
    comments.push('有合理的分段');
  }

  // 检查是否包含关键信息
  const hasTool = text.includes('工具') || text.includes('tool');
  const hasStatus = text.includes('状态') || text.includes('status');
  const hasResult = text.includes('结果') || text.includes('result');

  if (hasTool) score += 5;
  if (hasStatus) score += 5;
  if (hasResult) score += 5;

  // 检查是否有 JSON 格式（过多 JSON 会降低可读性）
  const jsonBraces = (text.match(/\{/g) || []).length;
  if (jsonBraces <= 2) {
    score += 10;
    comments.push('JSON 结构简洁');
  } else if (jsonBraces <= 5) {
    score += 5;
    comments.push('JSON 结构适中');
  } else {
    score -= 10;
    comments.push('JSON 嵌套过深，影响可读性');
  }

  // 检查是否有格式化的摘要（合规校验专用）
  if (text.includes('formattedSummary') || text.includes('审核状态')) {
    score += 5;
    comments.push('有专门的格式化摘要');
  }

  // 确保分数在合理范围内
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    comment: comments.join('；') || '基础文本格式'
  };
}
