import { NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

// 模拟 MCP 执行数据
const mockMcpAttempts = [
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
  }
];

// JSON Schema 说明
const jsonSchemaExplanations = {
  wechat_compliance_auditor: {
    schema: `{
  "approved": boolean,      // 审核是否通过
  "riskLevel": string,      // 风险等级：high/medium/low
  "issues": string[],       // 发现的问题列表
  "suggestions": string[],  // 优化建议
  "auditId": string,        // 审核唯一标识
  "formattedSummary": string // 预格式化的摘要
}`,
    explanation: '这是微信文章合规审核工具的返回数据，用于检查文章内容是否符合平台规范'
  },
  web_search: {
    schema: `{
  "query": string,              // 搜索关键词
  "totalResults": number,       // 总结果数
  "results": [                  // 搜索结果列表
    {
      "title": string,          // 结果标题
      "snippet": string,        // 摘要片段
      "source": string,         // 来源
      "date": string,           // 日期
      "relevance": number       // 相关性评分 0-100
    }
  ],
  "summary": string             // 总体摘要
}`,
    explanation: '这是网络搜索工具的返回数据，用于获取最新的网络信息'
  }
};

export async function GET() {
  try {
    console.log('');
    console.log('🧪 开始方案对比测试...');
    console.log('============================================================================');
    console.log('');

    const engine = new SubtaskExecutionEngine();
    const results: any[] = [];

    // 初始化 LLMClient
    const llmClient = new LLMClient(new Config());

    for (let i = 0; i < mockMcpAttempts.length; i++) {
      const attempt = mockMcpAttempts[i];
      const toolName = attempt.decision.toolName;

      console.log(`════════════════════════════════════════════════════════════════`);
      console.log(`📊 测试案例 ${i + 1}: ${toolName}`);
      console.log(`════════════════════════════════════════════════════════════════`);
      console.log('');

      // 方案1: 现有方案
      console.log('────────────────────────────────────────────────────────────────');
      console.log('📋 方案1: 现有方案（generateMcpResultText）');
      console.log('────────────────────────────────────────────────────────────────');
      console.log('');

      const scheme1Text = (engine as any).generateMcpResultText(attempt);
      console.log(scheme1Text.substring(0, 600) + (scheme1Text.length > 600 ? '...' : ''));
      console.log('');

      // 方案2: 用户建议的 LLM 优化方案
      console.log('────────────────────────────────────────────────────────────────');
      console.log('🚀 方案2: LLM 优化方案（JSON + Schema → 自然语言）');
      console.log('────────────────────────────────────────────────────────────────');
      console.log('');

      let scheme2Text = '';
      try {
        const schemaInfo = jsonSchemaExplanations[toolName as keyof typeof jsonSchemaExplanations];
        
        const systemPrompt = `你是一个专业的数据解释专家。请将 MCP 工具执行结果转换为流畅、自然、易于理解的自然语言描述。

要求：
1. 用自然语言流畅描述，不要使用 JSON 格式
2. 包含所有关键信息，不要遗漏重要数据
3. 语言简洁明了，适合 AI 助手理解
4. 输出格式：一段连贯的文字，200-400字`;

        const userPrompt = `【工具名称】
${toolName}

【工具说明】
${schemaInfo?.explanation || '这是一个 MCP 工具调用结果'}

【JSON Schema 说明】
${schemaInfo?.schema || JSON.stringify(attempt.result.data, null, 2)}

【实际 JSON 数据】
${JSON.stringify(attempt.result.data, null, 2)}

请用自然语言描述上述结果。`;

        console.log('🤖 正在调用 LLM 生成优化版本...');
        console.log('');

        const response = await llmClient.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], {
          temperature: 0.3
        });

        scheme2Text = response.content || '';
        
        // 包装成统一格式
        scheme2Text = `【MCP 执行结果】
工具：${toolName}
动作：${attempt.decision.actionName}
状态：${attempt.result.status}

${scheme2Text}`;

        console.log(scheme2Text);
        console.log('');

      } catch (llmError) {
        console.log('⚠️  LLM 调用失败，使用备用方案');
        scheme2Text = scheme1Text;
        console.log('');
      }

      // 评估对比
      console.log('────────────────────────────────────────────────────────────────');
      console.log('📈 方案对比评估');
      console.log('────────────────────────────────────────────────────────────────');
      console.log('');

      const evaluation = evaluateSchemes(scheme1Text, scheme2Text, toolName);
      
      console.log(`方案1（现有）可读性: ${evaluation.scheme1.score}/100`);
      console.log(`   ${evaluation.scheme1.pros.join('; ')}`);
      console.log(`   缺点: ${evaluation.scheme1.cons.join('; ')}`);
      console.log('');
      
      console.log(`方案2（LLM优化）可读性: ${evaluation.scheme2.score}/100`);
      console.log(`   ${evaluation.scheme2.pros.join('; ')}`);
      console.log(`   缺点: ${evaluation.scheme2.cons.join('; ')}`);
      console.log('');

      console.log(`🏆 推荐方案: ${evaluation.recommended}`);
      console.log(`   理由: ${evaluation.reason}`);
      console.log('');

      results.push({
        testCase: i + 1,
        toolName,
        scheme1: {
          text: scheme1Text,
          ...evaluation.scheme1
        },
        scheme2: {
          text: scheme2Text,
          ...evaluation.scheme2
        },
        evaluation
      });
    }

    // 总体总结
    console.log('');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('📊 总体对比总结');
    console.log('════════════════════════════════════════════════════════════════');
    console.log('');

    const overallAvg1 = Math.round(results.reduce((sum, r) => sum + r.scheme1.score, 0) / results.length);
    const overallAvg2 = Math.round(results.reduce((sum, r) => sum + r.scheme2.score, 0) / results.length);

    console.log(`方案1（现有）平均得分: ${overallAvg1}/100`);
    console.log(`方案2（LLM优化）平均得分: ${overallAvg2}/100`);
    console.log('');

    console.log('💡 专家建议:');
    const expertAdvice = generateExpertAdvice(results, overallAvg1, overallAvg2);
    console.log(expertAdvice);
    console.log('');

    console.log('============================================================================');
    console.log('');

    return NextResponse.json({
      success: true,
      message: '方案对比测试完成',
      results,
      summary: {
        overallAverage1: overallAvg1,
        overallAverage2: overallAvg2,
        expertAdvice
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

// 评估两个方案
function evaluateSchemes(text1: string, text2: string, toolName: string) {
  // 方案1评估
  const scheme1 = {
    score: assessReadability(text1),
    pros: ['实现简单，无需额外调用', '响应速度快，无延迟', '结果稳定可预测'],
    cons: ['JSON 部分可读性一般', '语言不够自然流畅', '缺少智能总结']
  };

  // 方案2评估
  const scheme2 = {
    score: assessReadability(text2),
    pros: ['语言自然流畅', '可读性更强', '有智能总结'],
    cons: ['需要额外 LLM 调用', '有延迟', '成本较高', '结果可能不稳定']
  };

  // 根据工具类型调整评分
  if (toolName === 'wechat_compliance_auditor') {
    // 合规工具已经有 formattedSummary，方案1已经很好
    scheme1.score += 5;
  }
  if (toolName === 'web_search') {
    // 搜索工具数据复杂，方案2优势明显
    scheme2.score += 10;
  }

  // 推荐决策
  let recommended = '方案1';
  let reason = '综合考虑性能、成本和稳定性';

  if (scheme2.score - scheme1.score >= 15) {
    recommended = '方案2';
    reason = 'LLM 优化后的可读性提升显著（>15分），值得额外投入';
  } else if (scheme2.score > scheme1.score) {
    recommended = '混合方案';
    reason = 'LLM 有提升但不明显，建议关键场景用方案2，其他用方案1';
  }

  return {
    scheme1,
    scheme2,
    recommended,
    reason
  };
}

// 可读性评估
function assessReadability(text: string): number {
  let score = 50;

  // 检查是否有清晰的标题
  if (text.includes('【') || text.includes('】')) score += 10;

  // 检查换行和分段
  const lineCount = (text.match(/\n/g) || []).length;
  if (lineCount >= 3) score += 10;
  if (lineCount >= 6) score += 5;

  // 检查 JSON 嵌套深度
  const jsonBraces = (text.match(/\{/g) || []).length;
  if (jsonBraces === 0) score += 20; // 完全没有 JSON
  else if (jsonBraces <= 2) score += 10;
  else if (jsonBraces <= 5) score += 5;
  else score -= 10;

  // 检查语言自然度
  const hasNaturalLanguage = !text.includes('{') || text.includes('，') || text.includes('。');
  if (hasNaturalLanguage) score += 5;

  // 检查长度
  if (text.length > 100 && text.length < 1000) score += 5;

  return Math.max(0, Math.min(100, score));
}

// 生成专家建议
function generateExpertAdvice(results: any[], avg1: number, avg2: number): string {
  const scoreDiff = avg2 - avg1;

  if (scoreDiff >= 20) {
    return `强烈推荐采用方案2（LLM 优化）！可读性提升非常显著（${scoreDiff}分），虽然有额外成本和延迟，但对于 Agent 理解质量的提升是值得的。建议：
1. 对所有 MCP 工具结果采用 LLM 优化
2. 可以考虑缓存机制，避免重复调用
3. 对于实时性要求高的场景，可以提供降级方案`;
  } else if (scoreDiff >= 10) {
    return `推荐采用混合方案！LLM 优化有明显提升（${scoreDiff}分），但需要权衡成本和性能。建议：
1. 对数据复杂、JSON 嵌套深的工具使用方案2
2. 对已有 formattedSummary 的工具继续使用方案1
3. 根据业务场景灵活选择`;
  } else if (scoreDiff >= 0) {
    return `建议保持方案1为主，方案2作为补充。LLM 优化提升不明显（${scoreDiff}分），考虑到额外成本和延迟，维持现状更合理。建议：
1. 继续使用现有方案
2. 可以优化 generateMcpResultText 中的格式化逻辑
3. 特定复杂场景可尝试方案2`;
  } else {
    return `强烈建议保持方案1！现有方案反而更好（${-scoreDiff}分优势）。LLM 优化在这个场景下没有带来价值。建议：
1. 继续使用现有方案
2. 如果需要改进，优化现有的格式化逻辑即可`;
  }
}
