/**
 * 文章校验服务 (ArticleValidationService)
 *
 * Phase 4 核心校验能力 — 需求文档 5.1 定义的 4 类校验规则
 *
 * 校验维度：
 * 1. 锚点完整性 (anchorIntegrity) — 文本相似度 ≥ 0.85 通过
 * 2. 结构完整性 (structureCompleteness) — 全模块出现即通过
 * 3. 素材使用率 (materialUsage) — 使用率 ≥ 60% 通过
 * 4. 风格合规 (styleCompliance) — 零违规/警告级别
 *
 * 调用时机：insurance-d 执行完成后、Agent B 评审前
 * 输出：ValidationResult → 注入 Agent B 上下文 → 影响决策
 */

// ========== 类型定义 ==========

/** 单个违规记录 */
export interface Violation {
  type: 'absolute_word' | 'forbidden_term' | 'tone_mismatch' | 'paragraph_length' | 'other';
  severity: 'error' | 'warning';
  description: string;
  position?: string; // 违规位置描述（如"第3段"）
  suggestion?: string; // 修改建议
}

/** 锚点完整性分数 */
export interface AnchorIntegrityScore {
  score: number; // 0~1 相似度
  threshold: number; // 默认 0.85
  details: string;
  /** 各锚点维度独立评分 */
  dimensionScores: {
    openingCase: number;
    coreViewpoint: number;
    endingConclusion: number;
  };
}

/** 结构完整性分数 */
export interface StructureCompletenessScore {
  score: number; // 0~1, 1=全模块出现
  passed: boolean;
  details: string;
  /** 缺失的模块列表 */
  missingModules: string[];
  /** 检测到的模块列表 */
  detectedModules: string[];
}

/** 素材使用率 */
export interface MaterialUsageScore {
  usedCount: number;
  totalCount: number;
  rate: number; // 0~1 百分比
  threshold: number; // 默认 0.6
  /** 各素材使用详情 */
  materialDetails: {
    id: string;
    title: string;
    isUsed: boolean;
    matchSnippet?: string;
  }[];
}

/** 风格合规检查结果 */
export interface StyleComplianceResult {
  violations: Violation[];
  severity: 'clean' | 'warning' | 'error';
  summary: string;
}

/** 校验选项 */
export interface ValidationOptions {
  /** 核心锚点数据 */
  coreAnchorData?: {
    openingCase?: string;
    coreViewpoint?: string;
    endingConclusion?: string;
  };
  /** 结构名称（如"SCQA故事法"） */
  structureName?: string;
  /** 结构详情（各模块标题列表） */
  structureDetail?: string;
  /** 关联素材列表 */
  materials?: Array<{
    id: string;
    title: string;
    content: string;
    materialType: string;
  }>;
  /** 用户观点（用于风格基线对比） */
  userOpinion?: string;
  /** 禁用词列表（从 style_assets 中读取） */
  forbiddenTerms?: string[];
  /** 绝对化词汇检测开关 */
  checkAbsoluteWords?: boolean;
}

/** 完整校验结果 */
export interface ValidationResult {
  overall: 'pass' | 'warn' | 'fail';
  scores: {
    anchorIntegrity: AnchorIntegrityScore;
    structureCompleteness: StructureCompletenessScore;
    materialUsage: MaterialUsageScore;
    styleCompliance: StyleComplianceResult;
  };
  /** 给 Agent B 的汇总描述（自然语言） */
  summary: string;
  /** 不通过时的修改建议 */
  rewriteSuggestions: string[];
  /** 校验耗时(ms) */
  elapsedMs: number;
  /** 各维度是否通过 */
  dimensionPassStatus: {
    anchorIntegrity: boolean;
    structureCompleteness: boolean;
    materialUsage: boolean;
    styleCompliance: boolean;
  };
}

// ========== 常量 ==========

/** 默认阈值配置 */
const DEFAULT_THRESHOLDS = {
  anchorIntegrity: 0.85,
  materialUsageRate: 0.6,
} as const;

/** 绝对化词汇黑名单（Phase4修复#6: 移除单字/高误报词，替换为精确多字词组） */
const ABSOLUTE_WORDS = [
  // 高风险绝对化表述（3字以上，精确匹配）
  '百分之百', '100%', '绝对保证', '唯一选择',
  '史上最佳', '空前绝后', '世界第一',
  '绝不后悔', '肯定赚钱', '稳赚不赔',
  // 注意: 已移除单字词('最','一')和合规常用词('必须','保证')以降低误报率
];

/** 常见违规口吻模式 */
const TONE_VIOLATION_PATTERNS = [
  { pattern: /你(应该|必须|一定|赶紧|还不)/g, desc: '命令式口吻' },
  { pattern: /我(告诉你|跟你讲|觉得吧)/g, desc: '口语化表达过重' },
  { pattern: /(简直|真的|太|非常){2,}/g, desc: '过度强调' },
];

/** HTML 标签清理正则 */
const STRIP_HTML_TAGS_REGEX = /<[^>]+>/g;

/** 段落长度阈值（字符数） */
const PARAGRAPH_LENGTH_THRESHOLD = 500;

// ========== 服务类 ==========

export class ArticleValidationService {
  private static instance: ArticleValidationService | null = null;

  static getInstance(): ArticleValidationService {
    if (!ArticleValidationService.instance) {
      ArticleValidationService.instance = new ArticleValidationService();
    }
    return ArticleValidationService.instance;
  }

  /**
   * 主入口：执行完整 4 维度校验
   *
   * @param articleHtml - insurance-d 输出的文章内容（可能含 HTML）
   * @param options - 校验选项
   * @returns 完整校验结果
   */
  async validate(articleHtml: string, options: ValidationOptions = {}): Promise<ValidationResult> {
    const startTime = Date.now();

    // 0. 预处理：去除 HTML 标签，提取纯文本
    const plainText = this.stripHtmlTags(articleHtml);

    console.log('[ArticleValidation] 开始校验', {
      textLength: plainText.length,
      htmlLength: articleHtml.length,
      hasCoreAnchor: !!options.coreAnchorData?.coreViewpoint,
      hasStructure: !!options.structureName,
      hasMaterials: (options.materials?.length ?? 0) > 0,
    });

    // 并行执行 4 个维度的校验
    const [anchorResult, structureResult, materialResult, styleResult] = await Promise.all([
      this.validateAnchorIntegrity(plainText, options),
      this.validateStructureCompleteness(plainText, options),
      this.validateMaterialUsage(plainText, options),
      this.validateStyleCompliance(plainText, options),
    ]);

    // 计算各维度通过状态
    const dimensionPassStatus = {
      anchorIntegrity: anchorResult.score >= DEFAULT_THRESHOLDS.anchorIntegrity,
      structureCompleteness: structureResult.passed,
      materialUsage: materialResult.rate >= DEFAULT_THRESHOLDS.materialUsageRate,
      styleCompliance: styleResult.severity !== 'error',
    };

    // 计算总体判定
    const overall = this.computeOverall(dimensionPassStatus, styleResult.severity);

    // 生成汇总描述和修改建议
    const { summary, rewriteSuggestions } = this.generateSummaryAndSuggestions(
      dimensionPassStatus,
      anchorResult,
      structureResult,
      materialResult,
      styleResult,
    );

    const elapsedMs = Date.now() - startTime;

    const result: ValidationResult = {
      overall,
      scores: {
        anchorIntegrity: anchorResult,
        structureCompleteness: structureResult,
        materialUsage: materialResult,
        styleCompliance: styleResult,
      },
      summary,
      rewriteSuggestions,
      elapsedMs,
      dimensionPassStatus,
    };

    console.log('[ArticleValidation] 校验完成', {
      overall,
      elapsedMs,
      ...dimensionPassStatus,
    });

    return result;
  }

  // ================================================================
  // 维度1：核心锚点完整性（关键词重叠 + LCS）
  // ================================================================

  private async validateAnchorIntegrity(
    text: string,
    options: ValidationOptions
  ): Promise<AnchorIntegrityScore> {
    const { coreAnchorData } = options;

    // 无锚点数据时跳过，返回满分
    if (!coreAnchorData || (!coreAnchorData.openingCase && !coreAnchorData.coreViewpoint && !coreAnchorData.endingConclusion)) {
      return {
        score: 1.0,
        threshold: DEFAULT_THRESHOLDS.anchorIntegrity,
        details: '无核心锚点数据，跳过校验',
        dimensionScores: { openingCase: 1.0, coreViewpoint: 1.0, endingConclusion: 1.0 },
      };
    }

    // 分别计算三个维度的相似度
    const openingScore = coreAnchorData.openingCase
      ? this.computeTextSimilarity(text, coreAnchorData.openingCase)
      : 1.0;
    const viewpointScore = coreAnchorData.coreViewpoint
      ? this.computeTextSimilarity(text, coreAnchorData.coreViewpoint)
      : 1.0;
    const endingScore = coreAnchorData.endingConclusion
      ? this.computeTextSimilarity(text, coreAnchorData.endingConclusion)
      : 1.0;

    // 加权平均：核心观点权重最高
    const weightedScore = openingScore * 0.2 + viewpointScore * 0.6 + endingScore * 0.2;

    const details = [
      `开头案例相似度: ${(openingScore * 100).toFixed(1)}%`,
      `核心观点相似度: ${(viewpointScore * 100).toFixed(1)}%`,
      `结尾结论相似度: ${(endingScore * 100).toFixed(1)}%`,
      `加权综合得分: ${(weightedScore * 100).toFixed(1)}%（阈值 ${DEFAULT_THRESHOLDS.anchorIntegrity * 100}%）`,
    ].join('；');

    return {
      score: Math.round(weightedScore * 1000) / 1000,
      threshold: DEFAULT_THRESHOLDS.anchorIntegrity,
      details,
      dimensionScores: {
        openingCase: Math.round(openingScore * 1000) / 1000,
        coreViewpoint: Math.round(viewpointScore * 1000) / 1000,
        endingConclusion: Math.round(endingScore * 1000) / 1000,
      },
    };
  }

  /**
   * 计算两段文本的相似度（关键词重叠率 + LCS 组合）
   */
  private computeTextSimilarity(textA: string, textB: string): number {
    // 方法1：关键词重叠率（Jaccard 系数变种）
    const wordsA = this.extractKeywords(textA);
    const wordsB = this.extractKeywords(textB);

    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    const setA = new Set(wordsA);
    const setB = new Set(wordsB);
    const intersection = [...setA].filter(w => setB.has(w));
    const union = new Set([...setA, ...setB]);

    const keywordOverlap = intersection.length / union.size;

    // 方法2：最长公共子序列比率
    const lcsRatio = this.lcsLengthRatio(textA, textB);

    // 组合：关键词重叠权重 60%，LCS 权重 40%
    return Math.round((keywordOverlap * 0.6 + lcsRatio * 0.4) * 1000) / 1000;
  }

  /**
   * 提取中文关键词（2字及以上词语）
   */
  private extractKeywords(text: string): string[] {
    // 简单分词：提取连续的中文字符序列（2字以上），并过滤停用词
    const segments = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    return segments.filter(s => !STOP_WORDS_FOR_SIMILARITY.has(s));
  }

  /**
   * 最长公共子序列长度比
   */
  private lcsLengthRatio(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0 || n === 0) return 0;

    // 使用滚动数组优化空间复杂度 O(min(m,n))
    const dp: number[] = new Array(n + 1).fill(0);

    for (let i = 1; i <= m; i++) {
      let prev = 0;
      for (let j = 1; j <= n; j++) {
        const temp = dp[j];
        if (a[i - 1] === b[j - 1]) {
          dp[j] = prev + 1;
        } else {
          dp[j] = Math.max(dp[j], dp[j - 1]);
        }
        prev = temp;
      }
    }

    // 🔴 Phase4修复(#4): 除以较短字符串长度（包容性相似度）
    // 修复前: Math.max(m,n) → 短文本完全包含在长文本中时得分极低
    // 修复后: Math.min(m,n) → 短文本完全包含时得分=1.0
    return dp[n] / Math.min(m, n);
  }

  // ================================================================
  // 维度2：结构完整性（段落标题匹配）
  // ================================================================

  private async validateStructureCompleteness(
    text: string,
    options: ValidationOptions
  ): Promise<StructureCompletenessScore> {
    const { structureName, structureDetail } = options;

    // 无结构要求时跳过
    if (!structureName && !structureDetail) {
      return {
        score: 1.0,
        passed: true,
        details: '无结构要求，跳过校验',
        missingModules: [],
        detectedModules: [],
      };
    }

    // 从 structureDetail 或 structureName 提取期望的模块列表
    const expectedModules = this.parseExpectedModules(structureName, structureDetail);
    if (expectedModules.length === 0) {
      return {
        score: 1.0,
        passed: true,
        details: '无法解析结构模块定义，跳过校验',
        missingModules: [],
        detectedModules: [],
      };
    }

    // 在文章中搜索每个模块的出现情况
    const detectedModules: string[] = [];
    const missingModules: string[] = [];

    for (const module of expectedModules) {
      // 模糊匹配：检查模块关键词是否出现在文本中
      const keywords = module.split(/[、，,]/).filter(k => k.trim().length >= 2);
      const found = keywords.some(kw => text.includes(kw.trim()));
      if (found) {
        detectedModules.push(module);
      } else {
        missingModules.push(module);
      }
    }

    const score = expectedModules.length > 0
      ? detectedModules.length / expectedModules.length
      : 1.0;

    const details = [
      `期望模块(${expectedModules.length}个): [${expectedModules.join(', ')}]`,
      `已检测到(${detectedModules.length}个): [${detectedModules.join(', ') || '无'}]`,
      missingModules.length > 0
        ? `缺失模块: [${missingModules.join(', ')}]`
        : '全部模块均已覆盖',
    ].join('\n');

    return {
      score: Math.round(score * 1000) / 1000,
      passed: missingModules.length === 0,
      details,
      missingModules,
      detectedModules,
    };
  }

  /**
   * 从结构名称/详情中解析期望的模块列表
   */
  private parseExpectedModules(structureName?: string, structureDetail?: string): string[] {
    // 优先从 structureDetail 解析
    if (structureDetail) {
      // 常见格式："一、引入\n二、分析\n三、结论" 或 "## 开头\n## 正文\n## 结尾"
      const headers = structureDetail.match(/(?:[一二三四五六七八九十]、[^\n]+|#{1,3}\s+[^\n]+)/g);
      if (headers && headers.length > 0) {
        return headers.map(h => h.replace(/^[一二三四五六七八九十]、[#{1,3}\s]*/, '').trim());
      }
    }

    // 回退到预定义结构名称映射
    const STRUCTURE_MODULE_MAP: Record<string, string[]> = {
      'SCQA': ['情境(S)', '冲突(C)', '问题(Q)', '答案(A)'],
      'SCQA故事法': ['情境引入', '冲突揭示', '问题提出', '解决方案'],
      'PREP': ['观点(P)', '原因(R)', '案例(E)', '观点(P)'],
      '总分总': ['总述', '分论点1', '分论点2', '分论点3', '总结'],
      '问题-分析-方案': ['问题描述', '原因分析', '解决方案'],
      '故事-道理-行动': ['故事案例', '提炼道理', '行动号召'],
    };

    if (structureName && STRUCTURE_MODULE_MAP[structureName]) {
      return STRUCTURE_MODULE_MAP[structureName];
    }

    return [];
  }

  // ================================================================
  // 维度3：素材使用率
  // ================================================================

  private async validateMaterialUsage(
    text: string,
    options: ValidationOptions
  ): Promise<MaterialUsageScore> {
    const materials = options.materials ?? [];

    // 无素材要求时跳过
    if (materials.length === 0) {
      return {
        usedCount: 0,
        totalCount: 0,
        rate: 1.0,
        threshold: DEFAULT_THRESHOLDS.materialUsageRate,
        materialDetails: [],
      };
    }

    let usedCount = 0;
    const materialDetails = materials.map(mat => {
      // 检查素材内容的关键片段是否出现在文章中
      const matKeywords = this.extractKeywords(mat.content).slice(0, 10); // 取前10个关键词
      const isUsed = matKeywords.some(kw => text.includes(kw));

      if (isUsed) {
        usedCount++;
      }

      return {
        id: mat.id,
        title: mat.title,
        isUsed,
        matchSnippet: isUsed ? matKeywords[0] : undefined,
      };
    });

    const rate = materials.length > 0 ? usedCount / materials.length : 1.0;

    return {
      usedCount,
      totalCount: materials.length,
      rate: Math.round(rate * 1000) / 1000,
      threshold: DEFAULT_THRESHOLDS.materialUsageRate,
      materialDetails,
    };
  }

  // ================================================================
  // 维度4：风格合规（禁用词+绝对化+口吻+段落长度）
  // ================================================================

  private async validateStyleCompliance(
    text: string,
    options: ValidationOptions
  ): Promise<StyleComplianceResult> {
    const violations: Violation[] = [];

    // 4.1 绝对化词汇检测
    if (options.checkAbsoluteWords !== false) {
      violations.push(...this.checkAbsoluteWords(text));
    }

    // 4.2 自定义禁用词检测
    if (options.forbiddenTerms && options.forbiddenTerms.length > 0) {
      violations.push(...this.checkForbiddenTerms(text, options.forbiddenTerms));
    }

    // 4.3 口吻模式检测
    violations.push(...this.checkTonePatterns(text));

    // 4.4 段落长度检测
    violations.push(...this.checkParagraphLength(text));

    // 判定严重级别
    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');

    let severity: 'clean' | 'warning' | 'error' = 'clean';
    if (errors.length > 0) {
      severity = 'error';
    } else if (warnings.length > 0) {
      severity = 'warning';
    }

    const summary = this.buildStyleComplianceSummary(severity, errors.length, warnings.length);

    return { violations, severity, summary };
  }

  /**
   * 检测绝对化词汇
   */
  private checkAbsoluteWords(text: string): Violation[] {
    const violations: Violation[] = [];

    for (const word of ABSOLUTE_WORDS) {
      const regex = new RegExp(word, 'g');
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        // 排除部分误报场景（如"最好的选择"中的"最"可能是合理的）
        violations.push({
          type: 'absolute_word',
          severity: 'warning',
          description: `发现绝对化词汇「${word}」(${matches.length}次)`,
          suggestion: `考虑替换为更温和的表达，如将"${word}"改为"较为"/"比较"`,
        });
      }
    }

    return violations;
  }

  /**
   * 检测自定义禁用词
   */
  private checkForbiddenTerms(text: string, forbiddenTerms: string[]): Violation[] {
    const violations: Violation[] = [];

    for (const term of forbiddenTerms) {
      if (!term || term.length < 2) continue;

      if (text.includes(term)) {
        violations.push({
          type: 'forbidden_term',
          severity: 'error',
          description: `使用了禁用词/表述「${term}」`,
          suggestion: `请替换或删除该表述`,
        });
      }
    }

    return violations;
  }

  /**
   * 检测口吻模式
   */
  private checkTonePatterns(text: string): Violation[] {
    const violations: Violation[] = [];

    for (const { pattern, desc } of TONE_VIOLATION_PATTERNS) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        violations.push({
          type: 'tone_mismatch',
          severity: 'warning',
          description: `${desc}(${matches.length}处): ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`,
        });
      }
    }

    return violations;
  }

  /**
   * 检测段落长度
   */
  private checkParagraphLength(text: string): Violation[] {
    const violations: Violation[] = [];
    // 按换行符分割段落
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);

    for (let i = 0; i < paragraphs.length; i++) {
      const len = paragraphs[i].trim().length;
      if (len > PARAGRAPH_LENGTH_THRESHOLD) {
        violations.push({
          type: 'paragraph_length',
          severity: 'warning',
          description: `第${i + 1}段过长(${len}字符，上限${PARAGRAPH_LENGTH_THRESHOLD})`,
          position: `第${i + 1}段`,
          suggestion: '建议拆分为多个短段落，提升可读性',
        });
      }
    }

    return violations;
  }

  // ================================================================
  // 工具方法
  // ================================================================

  /**
   * 去除 HTML 标签，保留纯文本
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(STRIP_HTML_TAGS_REGEX, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '') // 数字实体
      .trim();
  }

  /**
   * 计算总体判定
   */
  private computeOverall(
    dimStatus: ValidationResult['dimensionPassStatus'],
    styleSeverity: StyleComplianceResult['severity']
  ): 'pass' | 'warn' | 'fail' {
    // 核心维度任一不通过 → fail
    if (!dimStatus.anchorIntegrity || !dimStatus.structureCompleteness) {
      return 'fail';
    }

    // 风格有 error → fail
    if (styleSeverity === 'error') {
      return 'fail';
    }

    // 有 warning → warn
    if (
      !dimStatus.materialUsage ||
      styleSeverity === 'warning'
    ) {
      return 'warn';
    }

    return 'pass';
  }

  /**
   * 生成汇总描述和修改建议
   */
  private generateSummaryAndSuggestions(
    dimStatus: ValidationResult['dimensionPassStatus'],
    anchor: AnchorIntegrityScore,
    structure: StructureCompletenessScore,
    material: MaterialUsageScore,
    style: StyleComplianceResult
  ): { summary: string; rewriteSuggestions: string[] } {
    const parts: string[] = [];
    const suggestions: string[] = [];

    // 锚点完整性
    parts.push(
      dimStatus.anchorIntegrity
        ? `✅ 核心锚点完整(${(anchor.score * 100).toFixed(1)}%)`
        : `❌ 核心锚点不足(${(anchor.score * 100).toFixed(1)}% < ${anchor.threshold * 100}%)，${anchor.details}`
    );
    if (!dimStatus.anchorIntegrity) {
      suggestions.push(`加强核心观点的表达，确保文章紧扣用户核心立场`);
    }

    // 结构完整性
    parts.push(
      dimStatus.structureCompleteness
        ? `✅ 结构完整(全部${structure.detectedModules.length}个模块)`
        : `⚠️ 结构缺失模块: [${structure.missingModules.join(', ')}]`
    );
    if (!dimStatus.structureCompleteness && structure.missingModules.length > 0) {
      suggestions.push(`补全缺失的结构模块: ${structure.missingModules.join('、')}`);
    }

    // 素材使用率
    if (material.totalCount > 0) {
      parts.push(
        dimStatus.materialUsage
          ? `✅ 素材使用充分(${material.usedCount}/${material.totalCount}, ${(material.rate * 100).toFixed(0)}%)`
          : `⚠️ 素材使用不足(${material.usedCount}/${material.totalCount}, ${(material.rate * 100).toFixed(0)}% < ${material.threshold * 100}%)`
      );
    }
    if (!dimStatus.materialUsage && material.totalCount > 0) {
      const unused = material.materialDetails.filter(m => !m.isUsed).map(m => m.title);
      suggestions.push(`融入未使用的素材: ${unused.slice(0, 3).join('、')}`);
    }

    // 风格合规
    const errorCount = style.violations.filter(v => v.severity === 'error').length;
    const warnCount = style.violations.filter(v => v.severity === 'warning').length;
    if (style.severity === 'clean') {
      parts.push(`✅ 风格合规`);
    } else if (style.severity === 'error') {
      parts.push(`❌ 风格违规(${errorCount}处错误, ${warnCount}处警告)`);
      suggestions.push(style.summary);
    } else {
      parts.push(`⚠️ 风格警告(${warnCount}处)`);
    }

    return {
      summary: `【文章校验报告】${parts.join('；')}`,
      rewriteSuggestions: suggestions,
    };
  }

  /**
   * 构建风格合规汇总
   */
  private buildStyleComplianceSummary(severity: string, errorCount: number, warnCount: number): string {
    switch (severity) {
      case 'clean':
        return '文章风格符合规范';
      case 'error':
        return `存在${errorCount}处严重风格违规和${warnCount}处警告，需修改`;
      case 'warning':
        return `有${warnCount}处轻微风格问题，建议优化`;
      default:
        return '';
    }
  }
}

// ========== 导出单例实例 ==========
export const articleValidationService = ArticleValidationService.getInstance();

// ========== 停用词表（用于相似度计算的过滤）==========
const STOP_WORDS_FOR_SIMILARITY: ReadonlySet<string> = new Set([
  // 代词
  '我们', '你们', '他们', '她们', '它们', '自己', '这个', '那个', '这些', '那些',
  '什么', '怎么', '如何', '为什么', '哪里', '哪个', '哪些', '多少',
  // 助词
  '的', '了', '着', '过', '得', '地', '吗', '呢', '吧', '啊', '呀', '嘛', '罢了',
  // 介词
  '在', '从', '向', '往', '对', '为', '以', '把', '被', '让', '给', '比',
  // 连词
  '和', '与', '或', '而', '但', '但是', '然而', '如果', '虽然', '因为', '所以',
  '因此', '于是', '并且', '以及', '或者', '还是', '不仅', '而且',
  // 副词
  '很', '太', '非常', '特别', '比较', '稍微', '仅仅', '只', '就', '都', '也',
  '还', '已经', '正在', '将要', '曾经', '一直', '总是', '常常', '偶尔',
  // 动词（高频通用）
  '是', '有', '可以', '能够', '需要', '应该', '希望', '认为', '表示', '进行',
  '通过', '实现', '达到', '获得', '提供', '包括', '涉及', '关于', '根据',
  // 数量词
  '一个', '一些', '某种', '每个', '各位', '大家',
]);
