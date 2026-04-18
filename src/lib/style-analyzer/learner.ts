/**
 * 风格学习器
 * 管理风格模板的存储、检索和应用
 */

import fs from 'fs';
import path from 'path';
import type { StyleTemplate, StyleFeatures } from './types';

// 模板存储路径
const STORAGE_DIR = path.join(process.cwd(), 'data', 'style-templates');
const STORAGE_FILE = path.join(STORAGE_DIR, 'templates.json');

export class StyleLearner {
  private templates: Map<string, StyleTemplate> = new Map();

  constructor() {
    // 确保存储目录存在
    this.ensureStorageDir();
    // 加载已保存的模板
    this.loadFromFile();
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDir(): void {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  /**
   * 从文件加载模板
   */
  private loadFromFile(): void {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
        const entries = JSON.parse(data);
        this.templates = new Map(entries);
        console.log(`从文件加载了 ${this.templates.size} 个风格模板`);
      }
    } catch (error) {
      console.error('加载风格模板失败:', error);
      this.templates = new Map();
    }
  }

  /**
   * 保存风格模板
   */
  saveTemplate(template: StyleTemplate): void {
    this.templates.set(template.id, template);
    this.persistToFile();
  }

  /**
   * 获取风格模板
   */
  getTemplate(id: string): StyleTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 获取分类下的所有模板
   */
  getTemplatesByCategory(category: string): StyleTemplate[] {
    return Array.from(this.templates.values()).filter(
      (t) => t.category === category
    );
  }

  /**
   * 获取最新模板
   */
  getLatestTemplate(category?: string): StyleTemplate | undefined {
    const templates = category
      ? this.getTemplatesByCategory(category)
      : Array.from(this.templates.values());

    if (templates.length === 0) {
      return undefined;
    }

    return templates.reduce((latest, current) =>
      current.updatedAt > latest.updatedAt ? current : latest
    );
  }

  /**
   * 删除模板
   */
  deleteTemplate(id: string): boolean {
    const deleted = this.templates.delete(id);
    if (deleted) {
      this.persistToFile();
    }
    return deleted;
  }

  /**
   * 更新模板
   */
  updateTemplate(
    id: string,
    updates: Partial<StyleTemplate>
  ): boolean {
    const template = this.templates.get(id);
    if (!template) {
      return false;
    }

    const updated = {
      ...template,
      ...updates,
      id: template.id, // 保持 ID 不变
      updatedAt: Date.now(),
    };

    this.templates.set(id, updated);
    this.persistToFile();
    return true;
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): StyleTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 持久化模板到文件
   */
  private persistToFile(): void {
    try {
      const data = JSON.stringify(Array.from(this.templates.entries()), null, 2);
      fs.writeFileSync(STORAGE_FILE, data, 'utf-8');
      console.log(`保存了 ${this.templates.size} 个风格模板到文件`);
    } catch (error) {
      console.error('保存风格模板失败:', error);
    }
  }

  /**
   * 生成风格模仿提示词
   */
  generateStylePrompt(
    template: StyleTemplate,
    topic: string,
    additionalInstructions?: string
  ): string {
    const features = template.features;

    let prompt = `你是一位专业的文章写作专家。请根据以下风格特征，以"${topic}"为主题写一篇文章。

---

## 风格特征说明

### 基础风格
- 语气：${features.tone}
- 复杂度：${features.complexity}
- 文章长度：${features.length}
- 置信度：${(features.confidence * 100).toFixed(1)}%

### 语言特征
- 词汇水平：${features.vocabularyLevel}
- 句式结构：${features.sentenceStructure}
- 标点风格：${features.punctuationStyle}

### 内容特征
- 内容结构：${features.contentStructure.join(' → ')}
- 典型段落：${features.typicalSections.join('、')}
- 案例使用：${features.useOfExamples}
- 数据使用：${features.useOfData}
- 引用使用：${features.useOfQuotes}

### 表达特征
- 比喻使用：${features.useOfMetaphors}

### 关键词特征
- 常用关键词：${features.commonKeywords.join('、')}
- 关键短语：${features.keyPhrases.join('、')}

### 标题特征
- 标题风格：${features.titleStyle}
- 典型标题长度：${features.typicalTitleLength} 字

### 段落特征
- 平均段落长度：${features.averageParagraphLength} 字
- 段落数量：${features.paragraphCount} 段

---

## 写作要求

1. 严格遵守上述风格特征，确保文章风格与样本一致
2. 根据内容结构要求组织文章段落
3. 使用典型段落类型和关键词
4. 控制段落长度在 ${features.averageParagraphLength} 字左右
5. ${features.useOfData !== 'none' ? '适当使用数据支撑观点' : '以观点为主'}
6. ${features.useOfExamples !== 'none' ? '加入实际案例增强可读性' : '简洁明了'}
`;

    if (additionalInstructions) {
      prompt += `\n\n## 额外要求\n${additionalInstructions}`;
    }

    prompt += `\n\n请开始写作，确保文章专业、流畅、符合风格特征。`;

    return prompt;
  }

  /**
   * 合并多个风格特征
   */
  mergeStyles(
    templates: StyleTemplate[],
    weights?: number[]
  ): StyleFeatures {
    if (templates.length === 0) {
      throw new Error('至少需要一个模板');
    }

    // 如果只有一个模板，直接返回
    if (templates.length === 1) {
      return templates[0].features;
    }

    // 默认等权重
    const actualWeights = weights || templates.map(() => 1);

    // 计算加权平均
    const weightsSum = actualWeights.reduce((sum, w) => sum + w, 0);

    return {
      tone: this.weightedSelect(
        templates.map((t) => t.features.tone),
        actualWeights
      ),
      complexity: this.weightedSelect(
        templates.map((t) => t.features.complexity),
        actualWeights
      ),
      length: this.weightedSelect(
        templates.map((t) => t.features.length),
        actualWeights
      ),
      vocabularyLevel: this.weightedSelect(
        templates.map((t) => t.features.vocabularyLevel),
        actualWeights
      ),
      sentenceStructure: this.weightedSelect(
        templates.map((t) => t.features.sentenceStructure),
        actualWeights
      ),
      punctuationStyle: this.weightedSelect(
        templates.map((t) => t.features.punctuationStyle),
        actualWeights
      ),
      contentStructure: this.mergeArrays(
        templates.map((t) => t.features.contentStructure),
        actualWeights
      ),
      typicalSections: this.mergeArrays(
        templates.map((t) => t.features.typicalSections),
        actualWeights
      ),
      useOfExamples: this.weightedSelect(
        templates.map((t) => t.features.useOfExamples),
        actualWeights
      ),
      useOfMetaphors: this.weightedSelect(
        templates.map((t) => t.features.useOfMetaphors),
        actualWeights
      ),
      useOfData: this.weightedSelect(
        templates.map((t) => t.features.useOfData),
        actualWeights
      ),
      useOfQuotes: this.weightedSelect(
        templates.map((t) => t.features.useOfQuotes),
        actualWeights
      ),
      commonKeywords: this.mergeStringArrays(
        templates.map((t) => t.features.commonKeywords),
        actualWeights
      ),
      keyPhrases: this.mergeStringArrays(
        templates.map((t) => t.features.keyPhrases),
        actualWeights
      ),
      titleStyle: this.weightedSelect(
        templates.map((t) => t.features.titleStyle),
        actualWeights
      ),
      typicalTitleLength: this.weightedAverage(
        templates.map((t) => t.features.typicalTitleLength),
        actualWeights
      ),
      averageParagraphLength: this.weightedAverage(
        templates.map((t) => t.features.averageParagraphLength),
        actualWeights
      ),
      paragraphCount: this.weightedAverage(
        templates.map((t) => t.features.paragraphCount),
        actualWeights
      ),
      signature: 'merged',
      confidence: this.weightedAverage(
        templates.map((t) => t.features.confidence),
        actualWeights
      ),
    };
  }

  /**
   * 加权选择
   */
  private weightedSelect<T>(values: T[], weights: number[]): T {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < values.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return values[i];
      }
    }

    return values[values.length - 1];
  }

  /**
   * 加权平均
   */
  private weightedAverage(values: number[], weights: number[]): number {
    const weightedSum = values.reduce(
      (sum, v, i) => sum + v * weights[i],
      0
    );
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    return weightedSum / weightSum;
  }

  /**
   * 合并数组
   */
  private mergeArrays(arrays: string[][], weights: number[]): string[] {
    const merged: string[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < arrays.length; i++) {
      for (const item of arrays[i]) {
        if (!seen.has(item)) {
          merged.push(item);
          seen.add(item);
        }
      }
    }

    return merged;
  }

  /**
   * 合并字符串数组（考虑权重）
   */
  private mergeStringArrays(arrays: string[][], weights: number[]): string[] {
    const frequencyMap = new Map<string, number>();

    for (let i = 0; i < arrays.length; i++) {
      for (const item of arrays[i]) {
        const current = frequencyMap.get(item) || 0;
        frequencyMap.set(item, current + weights[i]);
      }
    }

    // 按权重排序，返回前 20 个
    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([item]) => item);
  }

  /**
   * 持久化模板（简化版，实际可以使用数据库）
   */
  private persistTemplates(): void {
    // TODO: 实现持久化逻辑（保存到数据库或文件）
    const data = JSON.stringify(Array.from(this.templates.entries()));
    console.log('持久化风格模板:', data.length, 'bytes');
  }

  /**
   * 加载模板（简化版，实际可以从数据库或文件加载）
   */
  loadTemplates(data: string): void {
    try {
      const entries = JSON.parse(data);
      this.templates = new Map(entries);
    } catch (error) {
      console.error('加载风格模板失败:', error);
    }
  }
}
