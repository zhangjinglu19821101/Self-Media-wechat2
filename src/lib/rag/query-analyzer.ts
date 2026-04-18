// 问题分析器
// 分析用户问题，判断是否需要调用 RAG 以及使用哪个知识库

export interface QueryAnalysis {
  needsRAG: boolean;
  collectionName: string;
  confidence: number;
  keywords: string[];
  category: 'compliance' | 'technical' | 'operation' | 'general';
}

/**
 * 问题分析器
 */
export class QueryAnalyzer {
  private rules: Map<string, {
    keywords: string[];
    collectionName: string;
    agentIds: string[];
  }>;

  constructor() {
    this.rules = new Map([
      // Agent B - 合规规则
      ['compliance', {
        keywords: [
          '合规', '规则', '规范', '法规', '要求', '禁止', '限制', '标准',
          '违规', '处罚', '封号', '法律责任', '义务', '权利',
          '腾讯服务协议', '隐私政策', '运营规范', '内容规范',
          '不得', '禁止', '严禁', '应当', '必须', '可以'
        ],
        collectionName: 'compliance_rules',
        agentIds: ['B', 'C', 'D', 'insurance-c', 'insurance-d'],
      }],
      // Agent B - 技术经验
      ['technical', {
        keywords: [
          '技术', '架构', '开发', '部署', '调试', '优化',
          '代码', '算法', '数据库', 'API', '接口',
          '性能', '安全', '可用性', '扩展性',
          '经验', '最佳实践', '方案', '设计'
        ],
        collectionName: 'technical_experiences',
        agentIds: ['B'],
      }],
      // Agent C - 运营 SOP
      ['operation', {
        keywords: [
          '运营', '策略', '推广', '活动', '用户',
          '增长', '转化', '留存', '活跃',
          '数据分析', 'A/B测试', '内容运营'
        ],
        collectionName: 'operation_sop',
        agentIds: ['C', 'insurance-c'],
      }],
    ]);
  }

  /**
   * 分析问题
   */
  async analyze(query: string, agentId: string): Promise<QueryAnalysis> {
    const normalizedQuery = query.toLowerCase();

    let bestMatch: QueryAnalysis = {
      needsRAG: false,
      collectionName: 'general',
      confidence: 0,
      keywords: [],
      category: 'general',
    };

    console.log(`[QueryAnalyzer] 开始分析问题，agentId: ${agentId}`);

    // 遍历所有规则
    for (const [category, rule] of this.rules.entries()) {
      // 检查 Agent ID 是否匹配
      if (!rule.agentIds.includes(agentId)) {
        continue;
      }

      // 检查关键词匹配
      const matchedKeywords = rule.keywords.filter(kw =>
        normalizedQuery.includes(kw.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        const confidence = matchedKeywords.length / rule.keywords.length;

        console.log(`[QueryAnalyzer] 匹配到规则 ${category}:`, {
          matchedKeywords,
          confidence,
          ruleKeywords: rule.keywords.length,
        });

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            needsRAG: true,
            collectionName: rule.collectionName,
            confidence,
            keywords: matchedKeywords,
            category: category as any,
          };
        }
      }
    }

    console.log(`[QueryAnalyzer] 分析结果:`, bestMatch);

    return bestMatch;
  }

  /**
   * 添加自定义规则
   */
  addRule(
    name: string,
    keywords: string[],
    collectionName: string,
    agentIds: string[]
  ): void {
    this.rules.set(name, { keywords, collectionName, agentIds });
    console.log(`[QueryAnalyzer] 已添加规则: ${name}`);
  }

  /**
   * 移除规则
   */
  removeRule(name: string): void {
    this.rules.delete(name);
    console.log(`[QueryAnalyzer] 已移除规则: ${name}`);
  }

  /**
   * 获取所有规则
   */
  getAllRules(): Array<{ name: string; rule: any }> {
    return Array.from(this.rules.entries()).map(([name, rule]) => ({
      name,
      rule,
    }));
  }
}

export const queryAnalyzer = new QueryAnalyzer();
