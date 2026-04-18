/**
 * 文章风格分析器
 * 使用 LLM 分析文章风格并提取特征
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import type {
  StyleFeatures,
  StyleTemplate,
  StyleAnalysisRequest,
  StyleAnalysisResult,
} from './types';

export class StyleAnalyzer {
  private llmClient: LLMClient;

  constructor() {
    // Config 会自动从环境变量加载凭证
    this.llmClient = new LLMClient(new Config());
  }

  /**
   * 分析一组文章的风格
   */
  async analyzeStyle(request: StyleAnalysisRequest): Promise<StyleAnalysisResult> {
    const { articles, categoryName = '通用' } = request;

    if (articles.length === 0) {
      throw new Error('至少需要提供一篇文章进行分析');
    }

    // 提取文章样本（最多 3 篇）
    const sampleArticles = articles.slice(0, 3);
    const combinedText = sampleArticles
      .map((article, index) => `=== 文章 ${index + 1} ===\n${article}`)
      .join('\n\n');

    // 构建分析提示词
    const prompt = this.buildAnalysisPrompt(combinedText, articles.length);

    // 调用 LLM 进行风格分析
    const analysisResponse = await this.llmClient.invoke([
      {
        role: 'system',
        content: '你是一位专业的文章风格分析师。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], {
      temperature: 0.3,
    });

    const analysisText = analysisResponse.content;

    // 解析分析结果
    const styleFeatures = this.parseStyleFeatures(analysisText);

    // 生成风格模板
    const template: StyleTemplate = {
      id: this.generateTemplateId(categoryName),
      name: `${categoryName}风格模板`,
      description: `基于 ${articles.length} 篇文章分析的${categoryName}风格`,
      category: categoryName,
      features: styleFeatures,
      sampleArticles: sampleArticles,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        sourceCount: articles.length,
        lastAnalyzedAt: Date.now(),
        tags: this.extractTags(styleFeatures),
      },
    };

    // 生成总结和建议
    const summary = this.generateSummary(template);
    const recommendations = this.generateRecommendations(template);

    return {
      success: true,
      template,
      summary,
      recommendations,
    };
  }

  /**
   * 构建风格分析提示词
   */
  private buildAnalysisPrompt(articleText: string, articleCount: number): string {
    return `你是一位专业的文章风格分析师。请仔细分析以下 ${articleCount} 篇文章的写作风格，并提取风格特征。

分析要求：
1. 深入分析文章的语气、结构、表达方式
2. 提取关键词、句式、典型段落等特征
3. 识别数据使用、案例使用、引用等习惯
4. 给出置信度评分（0-1，越接近1表示特征越明显）

请严格按照以下 JSON 格式返回分析结果：
\`\`\`json
{
  "tone": "语气描述（专业/亲切/幽默/严肃）",
  "complexity": "simple | moderate | complex",
  "length": "short | medium | long",
  "vocabularyLevel": "basic | intermediate | advanced",
  "sentenceStructure": "simple | mixed | complex",
  "punctuationStyle": "minimal | standard | rich",
  "contentStructure": ["段落1类型", "段落2类型", ...],
  "typicalSections": ["典型段落1", "典型段落2", ...],
  "useOfExamples": "none | few | many",
  "useOfMetaphors": "none | occasional | frequent",
  "useOfData": "none | minimal | moderate | extensive",
  "useOfQuotes": "none | occasional | frequent",
  "commonKeywords": ["关键词1", "关键词2", ...],
  "keyPhrases": ["短语1", "短语2", ...],
  "titleStyle": "标题风格描述",
  "typicalTitleLength": 数字,
  "averageParagraphLength": 数字,
  "paragraphCount": 数字,
  "confidence": 0.0-1.0
}
\`\`\`

待分析的文章：
${articleText}`;
  }

  /**
   * 解析风格特征
   */
  private parseStyleFeatures(response: string): StyleFeatures {
    try {
      // 提取 JSON 部分
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      const features = JSON.parse(jsonStr);

      return {
        tone: features.tone || '专业',
        complexity: features.complexity || 'moderate',
        length: features.length || 'medium',
        vocabularyLevel: features.vocabularyLevel || 'intermediate',
        sentenceStructure: features.sentenceStructure || 'mixed',
        punctuationStyle: features.punctuationStyle || 'standard',
        contentStructure: features.contentStructure || [],
        typicalSections: features.typicalSections || [],
        useOfExamples: features.useOfExamples || 'few',
        useOfMetaphors: features.useOfMetaphors || 'occasional',
        useOfData: features.useOfData || 'minimal',
        useOfQuotes: features.useOfQuotes || 'occasional',
        commonKeywords: features.commonKeywords || [],
        keyPhrases: features.keyPhrases || [],
        titleStyle: features.titleStyle || '简洁明了',
        typicalTitleLength: features.typicalTitleLength || 20,
        averageParagraphLength: features.averageParagraphLength || 150,
        paragraphCount: features.paragraphCount || 5,
        signature: this.generateSignature(features),
        confidence: Math.min(Math.max(features.confidence || 0.7, 0), 1),
      };
    } catch (error) {
      console.error('解析风格特征失败:', error);
      // 返回默认特征
      return this.getDefaultFeatures();
    }
  }

  /**
   * 生成风格签名
   */
  private generateSignature(features: any): string {
    const signatureParts = [
      features.tone,
      features.complexity,
      features.vocabularyLevel,
      features.sentenceStructure,
    ];
    return Buffer.from(signatureParts.join('|')).toString('base64').substring(0, 16);
  }

  /**
   * 获取默认风格特征
   */
  private getDefaultFeatures(): StyleFeatures {
    return {
      tone: '专业',
      complexity: 'moderate',
      length: 'medium',
      vocabularyLevel: 'intermediate',
      sentenceStructure: 'mixed',
      punctuationStyle: 'standard',
      contentStructure: ['引言', '正文', '结论'],
      typicalSections: ['背景介绍', '问题分析', '解决方案'],
      useOfExamples: 'few',
      useOfMetaphors: 'occasional',
      useOfData: 'minimal',
      useOfQuotes: 'occasional',
      commonKeywords: [],
      keyPhrases: [],
      titleStyle: '简洁明了',
      typicalTitleLength: 20,
      averageParagraphLength: 150,
      paragraphCount: 5,
      signature: 'default',
      confidence: 0.5,
    };
  }

  /**
   * 提取标签
   */
  private extractTags(features: StyleFeatures): string[] {
    const tags: string[] = [];

    tags.push(features.tone);
    tags.push(features.complexity);
    tags.push(features.vocabularyLevel);

    if (features.useOfData !== 'none') {
      tags.push('数据驱动');
    }
    if (features.useOfExamples === 'many') {
      tags.push('案例丰富');
    }
    if (features.useOfMetaphors === 'frequent') {
      tags.push('比喻生动');
    }

    return tags;
  }

  /**
   * 生成总结
   */
  private generateSummary(template: StyleTemplate): string {
    const { features, metadata } = template;
    return `基于 ${metadata.sourceCount} 篇文章分析生成的${template.category}风格模板。

主要特征：
- 语气：${features.tone}
- 复杂度：${features.complexity}
- 词汇水平：${features.vocabularyLevel}
- 平均段落长度：${features.averageParagraphLength} 字
- 分析置信度：${(features.confidence * 100).toFixed(1)}%

适用场景：保险行业文章、产品介绍、知识科普等`;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(template: StyleTemplate): string[] {
    const recommendations: string[] = [];
    const { features } = template;

    if (features.confidence < 0.7) {
      recommendations.push('建议提供更多样本文章以提高风格分析的准确性');
    }

    if (features.useOfData === 'none' || features.useOfData === 'minimal') {
      recommendations.push('考虑增加数据支持以提升文章说服力');
    }

    if (features.useOfExamples === 'none') {
      recommendations.push('建议增加实际案例以增强文章可读性');
    }

    if (features.vocabularyLevel === 'basic') {
      recommendations.push('可以适当提升专业词汇的使用以增强专业性');
    }

    recommendations.push('定期更新风格模板以保持风格一致性');

    return recommendations;
  }

  /**
   * 生成模板 ID
   */
  private generateTemplateId(category: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `style_${category.toLowerCase()}_${timestamp}_${random}`;
  }
}
