import { NextResponse } from 'next/server';
import { getLLMClient } from '@/lib/agent-llm';

// 测试用的JSON执行结果示例
const testExecutionResults = {
  // 示例1: 文章创作结果
  articleCreation: {
    article: `# 人工智能在医疗领域的应用

随着科技的快速发展，人工智能（AI）正在深刻改变着医疗行业。从诊断到治疗，从药物研发到健康管理，AI 的身影无处不在。

## AI 在医学影像诊断中的应用

医学影像是 AI 应用最为成熟的领域之一。通过深度学习算法，计算机可以在几秒内分析成千上万张 CT、MRI 或 X 光片，准确率甚至超过经验丰富的放射科医生。

### 实际案例

某知名医院引入 AI 辅助诊断系统后，肺癌早期筛查的准确率提高了 30%，患者平均等待时间缩短了 50%。

## 个性化治疗方案制定

AI 可以分析患者的基因数据、病史、生活习惯等多维信息，为每位患者制定最适合的个性化治疗方案。这种精准医疗的理念正在改变传统的治疗模式。

## 挑战与展望

尽管 AI 在医疗领域取得了显著成就，但仍面临数据隐私、算法透明度、伦理问题等挑战。然而，随着技术的不断进步和政策的逐步完善，AI 必将在医疗健康领域发挥更大的作用。

未来，我们可以期待 AI 与医疗的深度融合，为人类健康带来更多福祉。`,
    wordCount: 452,
    topics: ['人工智能', '医疗', '精准医疗', '医学影像'],
    qualityScore: 85,
    metadata: {
      generatedAt: '2026-03-21T00:30:00Z',
      author: 'AI Writing Assistant',
      version: '1.0'
    }
  },

  // 示例2: 合规校验结果
  complianceCheck: {
    complianceCheck: {
      passed: true,
      issues: [],
      recommendations: [
        '建议在提及具体医院名称时进行匿名化处理',
        '建议补充引用数据来源以增强可信度'
      ],
      riskLevel: 'low',
      auditDetails: {
        checkedSections: ['标题', '正文内容', '案例引用', '结论'],
        totalWords: 452,
        sensitiveContentFound: 0,
        factCheckPerformed: true
      }
    },
    factCheck: {
      accuracy: 'high',
      verifiedClaims: 12,
      disputedClaims: 0,
      sources: ['医学权威数据库', '行业报告']
    },
    overallRating: 'ready_for_publication',
    auditorComment: '文章内容质量良好，建议适当补充引用来源后即可发布。'
  },

  // 示例3: 数据搜索结果
  dataSearch: {
    query: '2024年保险行业发展趋势',
    timestamp: '2026-03-21T00:35:00Z',
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
      },
      {
        title: '健康保险成为增长亮点',
        snippet: '健康险业务持续快速增长，在总保费中的占比提升至28%...',
        source: '证券日报',
        date: '2024-10-08',
        relevance: 82
      }
    ],
    summary: '2024年保险行业整体发展态势良好，数字化转型和健康险是两大增长引擎。'
  },

  // 示例4: MCP执行结果
  mcpExecution: {
    toolName: 'wechat_compliance_auditor',
    actionName: 'audit_article',
    timestamp: '2026-03-21T00:40:00Z',
    executionTime: 2345,
    status: 'success',
    input: {
      articleTitle: '人工智能在医疗领域的应用',
      articleContent: '...(文章内容)...'
    },
    output: {
      approved: true,
      riskLevel: 'low',
      issues: [],
      suggestions: [
        '匿名化医院名称',
        '补充数据来源'
      ],
      auditId: 'audit-2026-03-21-001'
    }
  }
};

// 系统提示词
const SYSTEM_PROMPT = `你是一个专业的JSON结果转自然语言助手。你的任务是将结构化的JSON执行结果转换成流畅、易读的自然语言叙述。

## 转换要求：

1. **保持完整性**：确保涵盖JSON中的所有关键信息，不要遗漏重要数据
2. **语言流畅**：使用自然、通顺的中文表达
3. **结构清晰**：合理分段，使用标题和列表来组织内容
4. **突出重点**：对于重要数据（如百分比、评分、关键结论）要重点强调
5. **客观中立**：基于JSON内容进行叙述，不添加主观臆断

## 输出格式：

- 开头用一句话总结整体情况
- 然后分段详细叙述各个方面
- 使用合适的连接词让文章连贯
- 结尾可以总结关键要点

不要输出任何markdown格式，只用纯文本叙述。`;

export async function GET() {
  try {
    console.log('');
    console.log('🧪 开始JSON转自然语言测试...');
    console.log('============================================================================');
    console.log('');

    const llm = getLLMClient();
    const results: any[] = [];

    // 逐个测试不同的JSON结果
    for (const [key, jsonData] of Object.entries(testExecutionResults)) {
      console.log('');
      console.log('────────────────────────────────────────────────────────────────');
      console.log(`📊 测试案例: ${getTestName(key)}`);
      console.log('────────────────────────────────────────────────────────────────');
      console.log('');

      console.log('📝 原始JSON数据:');
      console.log(JSON.stringify(jsonData, null, 2).substring(0, 500) + '...');
      console.log('');

      console.log('🤖 正在调用LLM进行转换...');
      const startTime = Date.now();

      const userPrompt = `请将以下JSON执行结果转换成流畅的自然语言叙述：

\`\`\`json
${JSON.stringify(jsonData, null, 2)}
\`\`\`

请用中文进行叙述。`;

      const response = await llm.invoke([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ], {
        temperature: 0.3
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('✅ 转换完成!');
      console.log(`⏱️  耗时: ${duration}ms`);
      console.log('');
      console.log('════════════════════════════════════════════════════════════');
      console.log('📖 转换后的自然语言:');
      console.log('════════════════════════════════════════════════════════════');
      console.log(response);
      console.log('════════════════════════════════════════════════════════════');
      console.log('');

      results.push({
        testCase: key,
        testName: getTestName(key),
        originalJson: jsonData,
        narrative: response,
        durationMs: duration,
        success: true
      });
    }

    console.log('');
    console.log('📊 测试总结:');
    console.log('============================================================================');
    console.log(`✅ 共完成 ${results.length} 个测试案例`);
    results.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.testName} - ${r.durationMs}ms`);
    });
    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: 'JSON转自然语言测试完成',
      testResults: results,
      summary: {
        totalTests: results.length,
        averageDuration: Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / results.length),
        successRate: '100%'
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

function getTestName(key: string): string {
  const names: Record<string, string> = {
    articleCreation: '文章创作结果',
    complianceCheck: '合规校验结果',
    dataSearch: '数据搜索结果',
    mcpExecution: 'MCP执行结果'
  };
  return names[key] || key;
}
