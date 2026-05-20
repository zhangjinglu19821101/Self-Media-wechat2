/**
 * 动态提示词拼接服务
 * 
 * 功能（需求文档 3.2.3）：
 * - 读取 insurance-d-v3.md 固定基础提示词
 * - 从数字资产服务提取用户专属规则（3.2.2）
 * - 自动拼接形成最终提示词
 * 
 * 拼接规则（3.2.3）：
 * 最终提示词 = 固定基础提示词 + 用户专属动态规则 + 本次创作需求（核心锚点、素材、结构、目标字数）
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { digitalAssetService, USER_RULE_TYPE_LABELS, STYLE_RULE_TYPE_LABELS } from './digital-asset-service';
import type { UserExclusiveRule, StyleRule, SampleArticle } from './digital-asset-service';

// ========== 类型定义 ==========

export interface CoreAnchorData {
  openingCase: string;      // 开篇核心案例段
  coreViewpoint: string;    // 全文核心观点段
  endingConclusion: string; // 结尾核心结论段
}

export interface PromptAssemblyOptions {
  workspaceId?: string;         // 🔥 Phase 6: 工作空间ID（替代原 userId）
  templateId?: string;          // 🔥 Phase 5.5: 风格模板ID
  accountId?: string;           // 🔥 Phase 5.5: 平台账号ID（用于获取绑定的模板）
  executorType?: string;        // 🔥 执行 Agent 类型（insurance-d / insurance-xiaohongshu），决定加载哪个提示词文件
  subTaskRole?: 'outline_generation' | 'full_article'; // 🔥 大纲确认双子任务角色，决定输出格式
  taskInstruction?: string;
  samples?: string[];
  materials?: string[];
  targetWordCount?: string;
  coreAnchorData?: CoreAnchorData;
  structureName?: string;       // 用户选定的固定结构名称
  structureDetail?: string;     // 结构明细
  userOpinion?: string;         // 用户核心观点（关键素材，硬约束）
  materialIds?: string[];       // 素材ID列表
  confirmedOutline?: string;    // Phase 3: 用户确认后的大纲内容（全文子任务使用）
  relatedMaterials?: string;    // 🔥 关联素材补充区（软参考，灵活整合）
  priorStepOutput?: string;     // 🔴 前序步骤执行结果（大纲/调研等，由 buildExecutionContext 构建）
  cardCountMode?: '3-card' | '5-card' | '7-card'; // 🔥🔥🔥 小红书卡片数量模式（统一命名，与数据库字段一致）
  /** @deprecated 使用 cardCountMode 代替 */
  imageCountMode?: '3-card' | '5-card' | '7-card'; // 兼容旧字段
  articleType?: string; // 🔥 创作类型（pitfall_guide/authority_analysis/story_driven/product_eval/insurance_guide/free_creation + 旧 key 兼容）
  analogyMaterials?: string;     // 🔥 类比素材预格式化文本（由执行引擎按创作类型检索后传入）
  // ===== Phase 2 新增字段 =====
  articleLength?: 'short' | 'medium' | 'long'; // 🔥 篇幅类型
  primaryMaterialData?: string;  // 🔥 主素材数据预格式化文本（产品信息/法规原文等）
  auxiliaryMaterialData?: string; // 🔥 辅素材数据预格式化文本（类比/案例/数据等）
  articleStructureTemplate?: string; // 🔥 文章结构模板预格式化文本（由 article-structure-templates 生成）
  // 🔥🔥 范式-素材位置绑定（段落级精准素材注入）
  slotMaterialDetails?: Array<{
    slotId: string;
    paradigmCode?: string;       // 🔥 范式ID（如P001）
    stepName: string;
    paragraphOrder: number;
    materialTitle: string;
    materialContent: string;
    materialType: string;
    isUserBound?: boolean;       // 🔥 是否为用户手动绑定（最高优先级）
    // 🔥🔥 新增：素材上下文信息（指导LLM如何使用素材）
    contextBefore?: string;        // 前文语境（素材前面是什么内容）
    contextAfter?: string;         // 后文语境（素材后面是什么内容）
    emotionTone?: string;          // 情绪基调（如：警示/温暖/理性/反差）
    usageInstruction?: string;     // 使用指导（如：用转折句式引入、紧接上文展开）
    relationToPrevious?: string;   // 与前一段的关系（如：反驳/延续/举例）
  }>;
}

/**
 * 结构化规则段（m1: 保留结构化信息，不仅仅格式化为字符串）
 */
export interface StructuredRuleSection {
  sectionTitle: string;
  rules: Array<{
    index: number;
    type: string;
    typeLabel: string;
    content: string;
    priority: number;
    priorityLabel: string;
    sampleExtract?: string;
    confidence?: number;
  }>;
  formattedText: string;
}

export interface AssembledPrompt {
  fixedBasePrompt: string;
  userExclusiveRules: StructuredRuleSection;
  styleRules: StructuredRuleSection;
  currentTask: string;
  fullPrompt: string;
  assemblyMetadata: {
    timestamp: Date;
    ruleCount: number;
    styleRuleCount: number;
    sampleCount: number;
    hasCoreAnchor: boolean;
    hasUserOpinion: boolean;
    materialCount: number;
    hasConfirmedOutline?: boolean; // Phase 3
    hasPriorStepOutput?: boolean;  // 🔴 前序步骤结果
    hasIndustryCases?: boolean;    // 🔥 是否有行业案例
    hasUniversalObjectiveWriting?: boolean; // 🔥 是否有通用客观写作要求
  };
}

// ========== 优先级标签映射 ==========

const PRIORITY_LABELS: Record<number, string> = {
  1: '🔴 最高优先级',
  2: '🟡 高优先级',
  3: '🟡 高优先级',
};

function getPriorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? '🟢 中优先级';
}

// ========== 提示词文件路径映射 ==========

const PROMPT_FILE_MAP: Record<string, string> = {
  'insurance-d': 'src/lib/agents/prompts/insurance-d-v3.md',
  'insurance-xiaohongshu': 'src/lib/agents/prompts/insurance-xiaohongshu.md',
  'insurance-zhihu': 'src/lib/agents/prompts/insurance-zhihu.md',
  'insurance-toutiao': 'src/lib/agents/prompts/insurance-toutiao.md',
};

const DEFAULT_EXECUTOR_TYPE = 'insurance-d';

// 🔥 合规规则文件路径（所有保险创作 Agent 共用）
const COMPLIANCE_RULES_FILE = 'src/lib/agents/prompts/insurance-compliance-rules.md';

// 🔥 通用客观写作要求文件路径（所有平台通用）
const UNIVERSAL_OBJECTIVE_WRITING_FILE = 'src/lib/agents/prompts/universal-objective-writing.md';

// ========== 需要注入合规规则的 Agent 类型列表 ==========
const COMPLIANCE_REQUIRED_AGENTS = new Set([
  'insurance-d',
  'insurance-xiaohongshu',
  'insurance-zhihu',
  'insurance-toutiao',
]);

// ========== 提示词拼接服务 ==========

export class PromptAssemblerService {
  private fixedBasePrompts: Map<string, string> = new Map();
  // 🔥 合规规则缓存（P1-2: 使用 Promise 缓存避免并发竞态）
  private complianceRulesPromise: Promise<string> | null = null;
  // 🔥 通用客观写作要求缓存
  private universalObjectiveWritingPromise: Promise<string> | null = null;

  /**
   * 加载固定基础提示词
   * 
   * 根据 executorType 加载对应的提示词文件，缓存策略同前。
   */
  async loadFixedBasePrompt(executorType?: string): Promise<string> {
    const resolvedType = executorType || DEFAULT_EXECUTOR_TYPE;
    const promptFilePath = path.join(
      process.cwd(),
      PROMPT_FILE_MAP[resolvedType] || PROMPT_FILE_MAP[DEFAULT_EXECUTOR_TYPE]
    );

    try {
      const content = await readFile(promptFilePath, 'utf-8');
      const cached = this.fixedBasePrompts.get(resolvedType);
      if (content !== cached) {
        this.fixedBasePrompts.set(resolvedType, content);
      }
      return this.fixedBasePrompts.get(resolvedType)!;
    } catch (error) {
      console.error(`[PromptAssembler] 加载固定基础提示词失败 (executorType=${resolvedType}):`, error);
      // 兜底：仅对 insurance-d 返回兜底内容，其他类型回退到 insurance-d
      if (resolvedType !== DEFAULT_EXECUTOR_TYPE) {
        console.warn(`[PromptAssembler] 回退到 ${DEFAULT_EXECUTOR_TYPE} 提示词`);
        return this.loadFixedBasePrompt(DEFAULT_EXECUTOR_TYPE);
      }
      return this.getFallbackFixedPrompt();
    }
  }

  /**
   * 强制刷新缓存（供外部调用）
   */
  invalidateCache(executorType?: string): void {
    if (executorType) {
      this.fixedBasePrompts.delete(executorType);
    } else {
      this.fixedBasePrompts.clear();
      // 🔥 同时刷新合规规则缓存（P1-1）
      this.invalidateComplianceRulesCache();
      // 🔥 同时刷新通用客观写作要求缓存
      this.invalidateUniversalObjectiveWritingCache();
    }
  }

  /**
   * 🔥 强制刷新合规规则缓存（P1-1: 供外部调用，规则更新后无需重启服务）
   */
  invalidateComplianceRulesCache(): void {
    this.complianceRulesPromise = null;
  }

  /**
   * 🔥 强制刷新通用客观写作要求缓存
   */
  invalidateUniversalObjectiveWritingCache(): void {
    this.universalObjectiveWritingPromise = null;
  }

  /**
   * 🔥 加载通用客观写作要求（所有平台通用）
   */
  private async loadUniversalObjectiveWriting(): Promise<string> {
    if (this.universalObjectiveWritingPromise) {
      return this.universalObjectiveWritingPromise;
    }

    this.universalObjectiveWritingPromise = this._loadUniversalObjectiveWritingOnce();
    return this.universalObjectiveWritingPromise;
  }

  /**
   * 通用客观写作要求实际加载逻辑
   */
  private async _loadUniversalObjectiveWritingOnce(): Promise<string> {
    const filePath = path.join(process.cwd(), UNIVERSAL_OBJECTIVE_WRITING_FILE);
    try {
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('[PromptAssembler] 加载通用客观写作要求失败:', error);
      // 生产环境不允许静默降级
      if (process.env.COZE_PROJECT_ENV === 'PROD') {
        throw new Error('通用客观写作要求文件加载失败，生产环境不允许静默降级');
      }
      console.warn('[PromptAssembler] 非生产环境，通用客观写作要求降级为空');
      return '';
    }
  }

  /**
   * 🔥 加载合规规则（所有保险创作 Agent 共用）
   * 
   * 从 insurance-compliance-rules.md 文件读取，使用 Promise 缓存避免并发竞态（P1-2）
   * 生产环境加载失败直接抛出错误，避免静默降级导致合规规则缺失（P1-3）
   */
  private async loadComplianceRules(): Promise<string> {
    // P1-2: 使用 Promise 缓存，并发请求共享同一个 Promise，避免重复加载
    if (this.complianceRulesPromise) {
      return this.complianceRulesPromise;
    }

    this.complianceRulesPromise = this._loadComplianceRulesOnce();
    return this.complianceRulesPromise;
  }

  /**
   * 合规规则实际加载逻辑（仅执行一次）
   */
  private async _loadComplianceRulesOnce(): Promise<string> {
    const complianceFilePath = path.join(process.cwd(), COMPLIANCE_RULES_FILE);
    try {
      const content = await readFile(complianceFilePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('[PromptAssembler] 加载合规规则文件失败:', error);
      // P1-3: 生产环境不允许静默降级，合规规则缺失会导致创作内容无合规约束
      if (process.env.COZE_PROJECT_ENV === 'PROD') {
        throw new Error('合规规则文件加载失败，生产环境不允许静默降级');
      }
      // 非生产环境降级返回空字符串（开发/测试）
      console.warn('[PromptAssembler] 非生产环境，合规规则降级为空');
      return '';
    }
  }



  /**
   * 兜底固定提示词（文件加载失败时使用）
   * 
   * N8: 此内容应与 insurance-d-v3.md 第一部分（固定基础提示词）保持同步。
   * 当 v3.md 更新铁律/风格/流程内容时，需同步更新此处。
   */
  private getFallbackFixedPrompt(): string {
    return `# Insurance-D 文章创作 Agent（兜底版本）

你是【智者足迹-探寻】专属保险文案AI，严格遵守以下规则，100%复刻用户写作风格，不偏离用户核心思想，不编造任何无依据内容：

## 【一、核心铁律（绝对不可违反）】

1. 必须完整使用用户提供的：开篇核心案例段、全文核心观点段、结尾核心结论段，不得修改、替换、删减、反向解读，仅可对结尾结论做细节润色（不改变原意）。
2. 必须严格按照用户选定的固定文章结构，按顺序写作，不得跳步、调换结构顺序、删减结构模块。
3. 必须优先使用用户提供的关联素材和本篇关键素材，不编造数据、案例、保险条款。
4. 禁止使用任何绝对化、营销类词汇，禁止堆砌专业术语。

## 【二、风格复刻基础要求】

1. 口吻：第一人称「我」，称呼用户为「你/咱们」，语气共情、亲切。
2. 排版：短句为主，每段1-3行，手机阅读无压力。
3. 人设：站在消费者立场，不推荐任何具体保险产品。
4. 篇幅：严格控制在用户设定的目标字数范围内。

## 【三、创作流程要求】

1. 先根据用户输入的核心锚点、素材、固定结构，生成创作大纲，等待用户确认后再生成完整文章。
2. 大纲需清晰呈现：结构模块、每个模块的核心内容、素材使用规划。
3. 全文禁止使用通用AI套话。
`;
  }

  /**
   * 格式化用户专属规则（3.2.2 动态规则）
   */
  private formatUserExclusiveRules(rules: UserExclusiveRule[]): StructuredRuleSection {
    const structuredRules = rules
      .sort((a, b) => a.priority - b.priority)
      .map((rule, index) => ({
        index: index + 1,
        type: rule.ruleType,
        typeLabel: USER_RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType,
        content: rule.ruleContent,
        priority: rule.priority,
        priorityLabel: getPriorityLabel(rule.priority),
        sampleExtract: undefined,
        confidence: undefined,
      }));

    let formattedText = '## 【用户专属动态规则（自动拼接，随使用更新）】\n\n';
    
    if (structuredRules.length === 0) {
      formattedText += '（暂无用户专属动态规则，将使用固定基础提示词中的默认规则。后续随着用户使用沉淀，系统将自动补充。）\n';
    } else {
      structuredRules.forEach(rule => {
        formattedText += `${rule.index}. ${rule.priorityLabel} [${rule.typeLabel}]\n`;
        formattedText += `   ${rule.content}\n\n`;
      });
    }

    return {
      sectionTitle: '用户专属动态规则',
      rules: structuredRules,
      formattedText,
    };
  }

  /**
   * 格式化风格规则（3.3.1 风格资产）
   *
   * P1-7 修复：新增对小红书专属规则类型（title_pattern/emoji_usage/visual_layout/card_style/image_structure）
   * 的识别和分区展示，确保 insurance-d 能区分通用文字风格和图文排版风格
   */
  private formatStyleRules(rules: StyleRule[]): StructuredRuleSection {
    // 小红书专属规则类型（含图文结构维度）
    const XHS_RULE_TYPES = new Set(['title_pattern', 'emoji_usage', 'visual_layout', 'card_style', 'image_structure', 'color_scheme']);

    const generalRules: typeof structuredRules = [];
    const xhsRules: typeof structuredRules = [];

    const structuredRules = rules.map((rule, index) => ({
      index: index + 1,
      type: rule.ruleType,
      typeLabel: STYLE_RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType,
      content: rule.ruleContent,
      priority: rule.priority ?? 2,
      priorityLabel: (rule.priority ?? 2) <= 1 ? '🔴 最高优先级' : '🟡 高优先级',
      sampleExtract: rule.sampleExtract,
      confidence: rule.confidence,
      isXhsRule: XHS_RULE_TYPES.has(rule.ruleType),
    }));

    // 分区：通用规则 vs 小红书专属规则
    for (const rule of structuredRules) {
      if (rule.isXhsRule) {
        xhsRules.push(rule);
      } else {
        generalRules.push(rule);
      }
    }

    // 构建格式化文本
    let formattedText = '## 【风格复刻规则（从样本提取）】\n\n';

    // 1. 通用文字风格规则（tone/vocabulary/logic/emotion）
    if (generalRules.length > 0) {
      formattedText += '### 📝 通用文字风格\n\n';
      generalRules.forEach(rule => {
        formattedText += `${rule.index}. ${rule.typeLabel}\n`;
        formattedText += `   要求：${rule.content}\n`;
        if (rule.sampleExtract) {
          formattedText += `   示例：${rule.sampleExtract}\n`;
        }
        if (rule.confidence !== undefined) {
          formattedText += `   置信度：${Math.round(Number(rule.confidence) * 100)}%\n`;
        }
        formattedText += '\n';
      });
    }

    // 2. 小红书专属图文规则（title_pattern/emoji_usage/visual_layout/card_style/image_structure）
    if (xhsRules.length > 0) {
      formattedText += '### 📕 小红书图文风格（图文笔记专用）\n\n';
      formattedText += '**以下规则仅在小红书平台生成时生效：**\n\n';

      // 🔥 P2-S09 增强：将 image_structure 类型的"图文分工"规则提取并强化展示
      const imageStructureRules = xhsRules.filter(r => r.type === 'image_structure');
      const otherXhsRules = xhsRules.filter(r => r.type !== 'image_structure');

      // 先展示其他 XHS 规则
      otherXhsRules.forEach(rule => {
        formattedText += `${rule.index}. ${rule.typeLabel} [${rule.priorityLabel}]\n`;
        formattedText += `   要求：${rule.content}\n`;
        if (rule.sampleExtract) {
          formattedText += `   示例：${rule.sampleExtract}\n`;
        }
        if (rule.confidence !== undefined) {
          formattedText += `   置信度：${Math.round(Number(rule.confidence) * 100)}%\n`;
        }
        formattedText += '\n';
      });

      // 🔥 图文结构规则单独强化区块（P2-S09）
      if (imageStructureRules.length > 0) {
        formattedText += '**📐 图文结构要求（必须严格遵守）：**\n';
        formattedText += '> 以下规则决定「什么内容放图片」vs「什么内容放文字区」，请严格按此分配\n\n';
        imageStructureRules.forEach(rule => {
          // 强化格式：根据内容前缀判断类型并添加行为指引
          const isImageOnly = rule.content.startsWith('图文分工-图片专属');
          const isTextOnly = rule.content.startsWith('图文分工-文字专属');
          const rawContent = rule.content.replace(/^(图文分工-(?:图片专属|文字专属)：)/, '');

          if (isImageOnly) {
            formattedText += `- 🖼️ **图片卡片仅放**：${rawContent}\n`;
            formattedText += `  → 这些内容以**标题/金句形式**渲染到图片上，不要在 fullText 中重复展开\n`;
          } else if (isTextOnly) {
            formattedText += `- 📝 **文字区展开**：${rawContent}\n`;
            formattedText += `  → 这些内容仅在 **fullText** 中详细论证，不渲染到图片卡片上\n`;
          } else {
            // 其他 image_structure 规则（如图片数量模式、卡片密度等）
            formattedText += `- 📐 ${rule.typeLabel}：${rule.content}\n`;
          }
          formattedText += '\n';
        });
      }
    }

    if (structuredRules.length === 0) {
      formattedText += '（暂无风格复刻规则。后续随着样本分析沉淀，系统将自动补充。）\n';
    }

    return {
      sectionTitle: '风格复刻规则',
      rules: structuredRules,
      formattedText,
    };
  }

  /**
   * 格式化当前创作需求
   * 
   * C4: 核心锚点数据完整输出，不做截断
   * M4: 拼接顺序对齐需求文档 3.2.3（核心锚点、素材、结构、目标字数）
   */
  private formatCurrentTask(
    options: PromptAssemblyOptions,
    materials: Awaited<ReturnType<typeof digitalAssetService.getMaterials>>
  ): string {
    let result = '## 【本次创作需求】\n\n';

    // 🔥 Phase 3.5: 子任务角色提示（大纲生成 vs 全文生成）
    // 告诉 insurance-d 当前任务的输出格式要求
    if (options.subTaskRole === 'outline_generation') {
      result += '### ⚠️ 当前任务类型：生成创作大纲\n\n';
      result += '**重要提示**：当前处于「大纲生成」子任务，你需要先根据创作需求生成文章大纲，等待用户确认后再生成完整文章。\n\n';
      result += '**输出要求**：\n';
      result += '- 不输出完整文章，而是输出结构化大纲\n';
      result += '- 大纲需清晰呈现：结构模块、每个模块的核心内容、素材使用规划\n';
      result += '- 输出格式使用标准信封格式，platformData.outlineText 包含大纲文本\n\n';
    } else if (options.subTaskRole === 'full_article') {
      result += '### ⚠️ 当前任务类型：根据确认大纲生成全文\n\n';
      result += '**重要提示**：当前处于「全文生成」子任务，你需要根据已确认的大纲生成完整的文章内容。\n\n';
      result += '**输出要求**：\n';
      result += '- 必须严格按照已确认大纲的结构和内容展开写作\n';
      result += '- 输出完整的 HTML 格式文章\n';
      result += '- 输出格式使用标准信封格式，result.content 包含完整文章\n\n';
    }

    // 0. Phase 3: 已确认的创作大纲（最高优先级，必须在最前面）
    if (options.confirmedOutline) {
      result += '### 已确认的创作大纲（以大纲为骨架展开写作，核心结构不得改变）\n\n';
      result += `${options.confirmedOutline}\n\n`;
      result += '⚠️ 大纲是用户确认过的，具有最高优先级。必须以大纲为骨架展开写作，核心论点和段落顺序不得改变。允许细节层面的自然调整（素材呈现方式、过渡措辞等），大纲中规划的素材使用位置必须遵守。\n\n';
    }

    // 0.5 🔴 前序步骤执行结果（大纲/调研/合规校验等，由 buildExecutionContext 构建）
    // 注意：如果已有 confirmedOutline，则 priorStepOutput 中的大纲部分已在上面处理
    // 这里主要传递的是非大纲前序结果（如 order_index=1 的调研结果等）
    if (options.priorStepOutput) {
      let priorContent = options.priorStepOutput;
      
      if (options.confirmedOutline) {
        // 🔴 已有确认大纲时，从 priorStepOutput 中移除与大纲重复的内容块
        // priorStepOutput 格式: ━━━...【order_index = N】任务标题：xxx\n执行结果：xxx
        // 需要过滤掉标题含"大纲"且内容与 confirmedOutline 高度重叠的任务块
        const taskBlocks = priorContent.split(/━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━/);
        const filteredBlocks: string[] = [];
        const outlineContent = options.confirmedOutline.trim();
        
        for (const block of taskBlocks) {
          const trimmedBlock = block.trim();
          if (!trimmedBlock) continue;
          
          // 检查是否是大纲相关的任务块
          const titleMatch = trimmedBlock.match(/任务标题[：:]\s*(.+)/);
          const isOutlineTask = titleMatch && (
            titleMatch[1].includes('大纲') || 
            titleMatch[1].includes('outline') || 
            titleMatch[1].includes('Outline')
          );
          
          if (isOutlineTask) {
            // 提取该任务块的执行结果内容
            const resultMatch = trimmedBlock.match(/执行结果[：:]\s*\n([\s\S]*)/);
            if (resultMatch) {
              const blockContent = resultMatch[1].trim();
              // 计算与 confirmedOutline 的重叠率（简单关键词重叠检测）
              const outlineKeywords = outlineContent.split(/[\s,，。.、！!？?；;：:""''（）()\n]+/).filter(w => w.length >= 3);
              const blockKeywords = blockContent.split(/[\s,，。.、！!？?；;：:""''（）()\n]+/).filter(w => w.length >= 3);
              if (outlineKeywords.length > 0 && blockKeywords.length > 0) {
                const overlapCount = blockKeywords.filter(bk => outlineKeywords.includes(bk)).length;
                const overlapRate = overlapCount / Math.min(outlineKeywords.length, blockKeywords.length);
                // 重叠率超过 50% 认为是重复的大纲内容，跳过
                if (overlapRate > 0.5) {
                  console.log(`[PromptAssembler] 🔴 过滤重复大纲块: 标题="${titleMatch[1].trim()}", 重叠率=${(overlapRate * 100).toFixed(1)}%`);
                  continue;
                }
              }
            }
          }
          filteredBlocks.push(trimmedBlock);
        }
        
        if (filteredBlocks.length > 0) {
          priorContent = filteredBlocks.join('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          result += '### 前序步骤补充参考（确认大纲的上下文，仅供参考不必严格遵循）\n\n';
          if (priorContent.length > 3000) {
            priorContent = priorContent.substring(0, 3000) + '\n\n...（内容过长已截断，请重点关注上方已确认大纲）';
          }
          result += `${priorContent}\n\n`;
        } else {
          // 所有前序块都被过滤掉了（都是重复大纲），不再输出 priorStepOutput 部分
          console.log('[PromptAssembler] 🔴 priorStepOutput 中所有块均为重复大纲，已跳过');
        }
      } else {
        // 没有确认大纲时，priorStepOutput 包含大纲等关键内容，必须严格遵循
        result += '### 前序步骤执行结果（必须参考，其中大纲部分必须严格遵循展开写作）\n\n';
        result += '⚠️ 以下为前序任务已完成的执行结果。如果包含创作大纲，你必须严格按照大纲的结构和内容展开写作。\n\n';
        if (priorContent.length > 8000) {
          priorContent = priorContent.substring(0, 8000) + '\n\n...（内容过长已截断）';
        }
        result += `${priorContent}\n\n`;
      }
    }

    // 1. 核心锚点（C4: 完整输出，不做截断）
    if (options.coreAnchorData) {
      result += '### 核心锚点（必须完整使用，不可修改/替换/删减）\n\n';
      if (options.coreAnchorData.openingCase) {
        result += `**开篇核心案例段：**\n${options.coreAnchorData.openingCase}\n\n`;
      }
      if (options.coreAnchorData.coreViewpoint) {
        result += `**全文核心观点段：**\n${options.coreAnchorData.coreViewpoint}\n\n`;
      }
      if (options.coreAnchorData.endingConclusion) {
        result += `**结尾核心结论段：**\n${options.coreAnchorData.endingConclusion}\n\n`;
      }
    }

    // 计算当前执行 Agent 的标签（支持 insurance-d/xiaohongshu/zhihu/toutiao）
    const agentLabel = options.executorType || DEFAULT_EXECUTOR_TYPE;

    // 2. 用户观点（来自创作引导 — 核心锚点 + 关键素材，硬约束）
    if (options.userOpinion) {
      result += '### 用户核心观点与关键素材（最高优先级！必须精准引用，严禁编造）\n\n';
      result += `${options.userOpinion}\n\n`;
      result += `⚠️ 以上内容为用户指定的核心观点和关键素材，${agentLabel} 必须：\n`;
      result += '- 完整、准确、逐字逐句引用这些内容\n';
      result += '- 不得修改、夸张、歪曲任何数据或细节\n';
      result += '- 如果使用了这里的内容，必须确保 100% 精准\n';
      result += '- ⚠️ 素材优先级：当同一素材同时出现在「用户选中的素材及使用指导」时，以该指导中的位置绑定为准\n\n';
    }

    // 🔥🔥🔴 新增：关联素材补充区（软参考，灵活整合）
    if (options.relatedMaterials) {
      result += '### 关联素材补充区（可参考使用，灵活整合）\n\n';
      result += `${options.relatedMaterials}\n\n`;
      result += `💡 以上为关联素材，${agentLabel} 可以：n`;
      result += '- 引用、整合这些信息到文章中作为背景知识或补充案例\n';
      result += '- 基于这些信息进行合理演绎、扩展、补充\n';
      result += '- 优先级低于关键素材，但高于自行编造的内容\n\n';
    }

    // 🔥🔥🔥 新增：句式约束（去AI化的核心）
    const { SentencePatternService } = require('./sentence-pattern-constraint');
    result += SentencePatternService.generateFullConstraintPrompt();
    result += '\n\n';

    // 3. 固定结构
    if (options.structureName || options.structureDetail) {
      result += '### 固定文章结构（必须严格按顺序写作）\n\n';
      if (options.structureName) {
        result += `选定结构：${options.structureName}\n\n`;
      }
      if (options.structureDetail) {
        result += `结构明细：\n${options.structureDetail}\n\n`;
      }
    }

    // 🔥🔥🔥 【修复】小红书卡片数量模式（统一使用 cardCountMode，兼容旧的 imageCountMode）
    const effectiveCardCountMode = options.cardCountMode || options.imageCountMode;
    if (effectiveCardCountMode && options.executorType === 'insurance-xiaohongshu') {
      const cardCountMap: Record<string, { count: number; desc: string }> = {
        '3-card': { count: 3, desc: '封面 + 1个要点 + 结尾（极简版，信息精炼）' },
        '5-card': { count: 5, desc: '封面 + 3个要点 + 结尾（标准版，信息适中）' },
        '7-card': { count: 7, desc: '封面 + 5个要点 + 结尾（详尽版，信息丰富）' },
      };
      const cardConfig = cardCountMap[effectiveCardCountMode] || cardCountMap['5-card'];
      result += '### 小红书卡片数量要求\n\n';
      result += `**图片模式**：${effectiveCardCountMode}（${cardConfig.desc}）\n\n`;
      result += `⚠️ **必须输出 ${cardConfig.count - 2} 个要点（points）**：\n`;
      result += `- 封面卡片（1个）：标题 + 副标题\n`;
      result += `- 要点卡片（${cardConfig.count - 2}个）：每个要点包含 title（渲染到图上）和 content（文字区展开）\n`;
      result += `- 结尾卡片（1个）：总结语\n\n`;
      result += `输出 JSON 中 platformData.points 数组长度必须为 ${cardConfig.count - 2}，不可多不可少。\n\n`;
    }


    // 3.55 🔥 创作类型声明（告知写作 Agent 本次创作类型，影响写作策略）
    if (options.articleType) {
      const ARTICLE_TYPE_LABELS: Record<string, string> = {
        pitfall_guide: '避坑指南（误区+纠正+类比）',
        authority_analysis: '权威解读（法规+影响+建议）',
        story_driven: '故事驱动（事件+转折+启示）',
        product_eval: '产品测评（对比+优劣+推荐）',
        insurance_guide: '投保指南（需求+方案+避坑）',
        free_creation: '自由创作（无固定结构）',
        // 旧 key 兼容
        myth_busting: '避坑指南（误区+纠正+类比）',
        analogy: '类比驱动',
        regulation: '法规解读',
        story: '故事驱动',
        general: '自由创作',
      };
      const typeLabel = ARTICLE_TYPE_LABELS[options.articleType] || options.articleType;
      result += `### 创作类型\n\n`;
      result += `本次创作类型为：**${typeLabel}**（${options.articleType}）\n`;
      result += `请根据此创作类型选择合适的写作策略和结构。\n\n`;
    }

    // 3.6 🔥 类比素材区（按创作类型注入，由执行引擎检索后传入）
    if (options.analogyMaterials) {
      result += options.analogyMaterials;
      result += '\n';
    }

    // 3.7 🔥 Phase 2: 文章结构模板
    if (options.articleStructureTemplate) {
      result += options.articleStructureTemplate;
      result += '\n';
    }

    // 3.8 🔥 Phase 2: 主素材数据（产品信息/法规原文等核心素材）
    if (options.primaryMaterialData) {
      result += options.primaryMaterialData;
      result += '\n';
    }

    // 3.9 🔥 Phase 2: 辅素材数据（类比/案例/数据等支撑素材）
    if (options.auxiliaryMaterialData) {
      result += options.auxiliaryMaterialData;
      result += '\n';
    }

    // 3.10 🔥 Phase 2: 篇幅要求
    if (options.articleLength) {
      const lengthLabels: Record<string, { label: string; range: string; instruction: string }> = {
        short: { label: '短文', range: '800-1500字', instruction: '精炼表达，合并段落，每段不超过200字，快速切入核心观点' },
        medium: { label: '中篇', range: '1500-3000字', instruction: '标准篇幅，每段150-400字，详细但不冗余' },
        long: { label: '长文', range: '3000-5000字', instruction: '深度展开，每段200-600字，多角度论述，丰富案例和数据' },
      };
      const lc = lengthLabels[options.articleLength];
      if (lc) {
        result += `### 篇幅要求：${lc.label}（${lc.range}）\n${lc.instruction}\n\n`;
      }
    }

    // 4. 素材
    if (options.materials && options.materials.length > 0) {
      result += `### 本篇关键素材（${options.materials.length} 个，必须优先使用，不编造无依据内容）\n\n`;
      options.materials.forEach((material, index) => {
        result += `素材 ${index + 1}:\n${material}\n\n`;
      });
    } else if (materials.length > 0) {
      result += `### 素材库推荐素材（${materials.length} 个，优先使用）\n\n`;
      materials.slice(0, 5).forEach((material, index) => {
        result += `${index + 1}. ${material.title} (${material.type})\n`;
        result += `   内容：${material.content.substring(0, 200)}${material.content.length > 200 ? '...' : ''}\n`;
        if (material.topicTags.length > 0) {
          result += `   标签：${material.topicTags.join(', ')}\n`;
        }
        result += '\n';
      });
    }

    // 🔥🔥 4.5 范式-素材推荐位置（精准指导模式）
    if (options.slotMaterialDetails && options.slotMaterialDetails.length > 0) {
      result += `### 用户选中的素材及使用指导（🔥范式原位填充，位置绑定素材优先于自由素材）\n\n`;
      result += `以下是用户选中并指定用于特定段落的素材。每条素材都附带了**使用指导**，你必须按照指导将素材填充到指定段落位置。\n\n`;
      result += `**素材优先级**：当同一素材同时出现在「用户核心观点与关键素材」和本区域时，以本区域的位置绑定(slotId)为准——素材不仅要引用，还要放在正确的段落位置。\n\n`;
      // 按 paragraphOrder 排序，同一段落的多条素材合并展示
      const sortedSlots = [...options.slotMaterialDetails].sort((a, b) => a.paragraphOrder - b.paragraphOrder);
      // 按 paragraphOrder 分组
      const groupedByOrder = new Map<number, typeof sortedSlots>();
      for (const slot of sortedSlots) {
        if (!groupedByOrder.has(slot.paragraphOrder)) {
          groupedByOrder.set(slot.paragraphOrder, []);
        }
        groupedByOrder.get(slot.paragraphOrder)!.push(slot);
      }
      for (const [order, slots] of groupedByOrder) {
        if (slots.length === 1) {
          result += `#### 段落${order}「${slots[0].stepName}」\n\n`;
        } else {
          result += `#### 段落${order}「${slots[0].stepName}」（${slots.length}条可选，选最合适的1-2条）\n\n`;
        }
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i];
          const prefix = slots.length > 1 ? `${i + 1}. ` : '';
          
          // 🔥🔥 使用上下文信息构建精准指导
          result += `${prefix}**【${slot.materialTitle}】**（${slot.materialType}）`;
          if (slot.isUserBound) {
            result += ` 🔥用户手动绑定（最高优先级）`;
          }
          result += `\n`;
          result += `   📝 内容：${slot.materialContent}\n`;
          if (slot.paradigmCode) {
            result += `   📍 位置：第${slot.paragraphOrder}段「${slot.stepName}」（${slot.paradigmCode}）\n`;
          } else {
            result += `   📍 位置：第${slot.paragraphOrder}段「${slot.stepName}」\n`;
          }
          
          // 上下文语境指导
          if (slot.contextBefore || slot.contextAfter) {
            result += `   🎯 **位置指导**：`;
            if (slot.contextBefore) {
              result += `放在"${slot.contextBefore.substring(0, 30)}${slot.contextBefore.length > 30 ? '...' : ''}"之后；`;
            }
            if (slot.contextAfter) {
              result += `放在"${slot.contextAfter.substring(0, 30)}${slot.contextAfter.length > 30 ? '...' : ''}"之前。`;
            }
            result += '\n';
          } else if (slot.stepName) {
            // 无上下文时，用步骤名称和段落序号作为位置指导
            result += `   🎯 **位置指导**：放在第${slot.paragraphOrder}段「${slot.stepName}」的核心位置\n`;
          }
          
          // 情绪基调指导
          if (slot.emotionTone) {
            result += `   💡 **情绪基调**：${slot.emotionTone}\n`;
          }
          
          // 使用指导
          if (slot.usageInstruction) {
            result += `   ⚠️ **使用指导**：${slot.usageInstruction}\n`;
          }
          
          // 与前段关系
          if (slot.relationToPrevious) {
            result += `   🔗 **与上一段的关系**：${slot.relationToPrevious}\n`;
          }
          
          result += '\n';
        }
      }
      result += `💡 **素材使用核心规则（素材是主角！本规则优先于"必须原创"的铁律）**：
> 以下素材是用户提供的真人写作素材（真实案例、真实数据、真实经历），保留素材≠抄袭，而是"引用用户指定的真实素材"——这是文章人味的根本来源。
1. **位置优先**：带有📍位置标记的素材，必须出现在对应段落（如"第2段「开篇破局」"→文章第2段必须包含此素材）
2. **优先级**：🔥用户手动绑定 > 📍位置标记素材 > 通用关联素材 > AI自行补充
3. **素材完整保留**：素材原文90%+保留，仅加1-3句过渡引子。⚠️合规例外：含违规内容（真实姓名/绝对化表述等）时仅改写违规部分
4. **引子过渡**：在素材前后只加1-3句简短引子把素材"引出来"，引子要像真人聊天那样自然
5. **引子示例**：保险公众号风格——"最近有个客户跟我讲了他的经历...""看到一组数据挺触目惊心的...""我一个朋友前阵子遇到了这样的事..."
6. **比例明确**：素材主体占比90%+，过渡引子占比不到10%

`;
    }

    // 🔥🔥 4.6 句式级约束（去AI化核心）
    // 从已初始化范式中提取的真人句式模式
    const permittedPhrases: string[] = [];
    
    // 🔥 优先从素材中提取真人句式（来自真实文章的 fixed_phrase / hook_sentence 类型）
    const fixedPhrases = materials.filter(m => 
      m.type === 'fixed_phrase' || m.type === 'hook_sentence'
    );
    for (const fp of fixedPhrases.slice(0, 15)) {
      if (fp.content && fp.content.length < 50 && fp.content.length > 3) {
        permittedPhrases.push(fp.content);
      }
    }
    
    // 🔥 从素材的 contextBefore 中提取真人句式模式（前文语境往往包含句式开头）
    for (const m of materials.slice(0, 20)) {
      // 从素材元数据中获取上下文句式
      const metadata = m as any;
      if (metadata.contextBefore && metadata.contextBefore.length < 30) {
        // 提取句式开头（通常是逗号前的部分）
        const parts = metadata.contextBefore.split(/[，,。]/);
        if (parts.length > 0 && parts[0].length >= 3 && parts[0].length <= 15) {
          permittedPhrases.push(parts[0] + (parts[0].endsWith('，') ? '' : '，'));
        }
      }
    }
    
    // 🔥🔥 AI高频模式句式清单（精准版：只禁AI指纹级句式，不禁真人常用词）
    const forbiddenPhrases: string[] = [
      // 🔴 学术化转折（AI"装专业"的标志，真人不会在公众号文章中这么写）
      '值得注意的是', '不可否认', '众所周知', 
      '不言而喻', '由此可见', '毋庸置疑', '毋庸置疑地',
      '显而易见', '不难发现', '这不禁让人思考',
      
      // 🔴 模板化总结（AI段落结尾必备，真人不会这么"升华"）
      '这告诉我们', '这启示我们', '这让我们明白',
      '这充分说明', '从中我们可以看出',
      '综上所述', '总而言之', '简而言之',
      
      // 🔴 机械序列（仅禁止三连套用模式，单独使用"最后"允许）
      '首先...其次...最后', // 三连套用模式
      '一方面...另一方面', // 对仗式转折
      
      // 🔴 假互动引导（AI假装有温度，实际是模板套路）
      '有人可能会说', '普遍认为',
      '令人惊讶的是', '让人意外的是',
      '令人遗憾的是',
      
      // 🔴 假深度分析（AI假装在思考）
      '深入分析可以发现', '仔细观察不难发现',
    ];
    
    // 🔥🔥 真人感句式清单（来源于真实保险文章分析）
    const defaultPermittedPhrases = [
      // 🔵 口语化开头（真人特色）
      '说实话，', '不瞒你说，', '我之前也这么想，', '后来才发现，',
      '有个客户问我，', '前两天跟朋友聊起，', '说起来也巧，', '我自己就遇到过，',
      '那会儿我还不知道，', '当时也没多想，', '回想起来，', '现在看明白了，',
      
      // 🔵 日常感过渡（真人特色）
      '这事儿吧，', '简单说，', '你就这么想，', '打个比方，',
      '举个例子，', '我给你算笔账，', '这么说吧，', '你想想，',
      '不夸张地说，', '毫不夸张地说，', '站在过来人的角度，',
      
      // 🔵 情感连接（真人特色）
      '我跟你说个事儿，', '有个朋友问我，', '客户老张前两天来找我，',
      '上个月有个客户，', '我遇到过一个案例，', '说个真实的例子，',
      
      // 🔵 自然转折（真人特色，取代AI的"事实上""实际上"）
      '其实吧，', '说白了，', '你想啊，', '关键在于，',
      '这里头有个坑，', '别急，我给你捋一捋，', '我之前也犯过这个错，',
    ];
    permittedPhrases.push(...defaultPermittedPhrases);
    
    // 输出句式约束（精简版：只输出核心规则，减少token消耗）
    result += `### 🔥 句式约束（去AI化核心）\n\n`;
    result += `#### ✅ 段落开头必须使用真人感句式（每段至少1个）\n`;
    const uniquePermitted = [...new Set(permittedPhrases)].slice(0, 10);
    for (const phrase of uniquePermitted) {
      result += `- "${phrase}"\n`;
    }
    result += `\n#### ❌ 禁止使用AI指纹级句式（出现即判为AI生成）\n`;
    for (const phrase of forbiddenPhrases.slice(0, 12)) {
      result += `- "${phrase}"\n`;
    }
    result += `\n💡 **核心原则**：用"说实话""说白了"这样的真人句式开头，让读者感觉是在跟一个真实的人对话。"其实""当然""事实上"等词本身不是禁词（真人说话也用），但不要作为段落开头或转折标志。真正要避免的是"值得注意的是""综上所述"这种AI指纹级模式。禁止的是"首先...其次...最后"三连套用，单独使用"首先""其次"没问题（如"首先得搞清楚一件事"就很自然）。\n\n`;

    // 5. 目标字数
    if (options.targetWordCount) {
      result += `### 目标字数\n\n${options.targetWordCount} 字（浮动±200字）\n\n`;
    }

    // 6. 任务指令
    if (options.taskInstruction) {
      result += `### 任务指令\n\n${options.taskInstruction}\n\n`;
    }

    return result;
  }

  /**
   * 组装最终提示词
   * 
   * 拼接规则（3.2.3）：
   * 最终提示词 = 固定基础提示词 + 🔥合规规则（保险创作Agent） + 用户专属动态规则 + 本次创作需求
   */
  async assemblePrompt(options: PromptAssemblyOptions = {}): Promise<AssembledPrompt> {
    const resolvedExecutorType = options.executorType || DEFAULT_EXECUTOR_TYPE;
    const needsComplianceRules = COMPLIANCE_REQUIRED_AGENTS.has(resolvedExecutorType);

    const [
      fixedBasePrompt,
      complianceRulesText,
      universalObjectiveWritingText,
      { userExclusiveRules, styleRules, sampleArticles, availableMaterials }
    ] = await Promise.all([
      this.loadFixedBasePrompt(options.executorType),
      // 🔥 仅对保险创作 Agent 加载合规规则
      needsComplianceRules ? this.loadComplianceRules() : Promise.resolve(''),
      // 🔥 加载通用客观写作要求（所有平台通用）
      this.loadUniversalObjectiveWriting(),
      // 🔥 Phase 5.5: 传递 templateId 给数字资产服务
      digitalAssetService.getDigitalAssetsForPrompt(options.workspaceId, options.templateId),
    ]);

    // 格式化各部分
    const complianceRulesSection = needsComplianceRules ? complianceRulesText : '';
    const userExclusiveRulesSection = this.formatUserExclusiveRules(userExclusiveRules);
    const styleRulesSection = this.formatStyleRules(styleRules);
    const currentTaskText = this.formatCurrentTask(options, availableMaterials);

    // M4: 拼接顺序对齐需求文档 3.2.3
    // 最终提示词 = 固定基础提示词 + 🔥通用客观写作要求 + 🔥合规规则（保险创作Agent） + 用户专属动态规则 + 本次创作需求
    const fullPrompt = [
      fixedBasePrompt,
      universalObjectiveWritingText, // 🔥 通用客观写作要求（所有平台通用）
      '\n---\n\n',
      complianceRulesSection, // 🔥 合规规则注入（在固定基础提示词之后、用户专属规则之前）
      '\n---\n\n',
      userExclusiveRulesSection.formattedText,
      '\n---\n\n',
      styleRulesSection.formattedText,
      '\n---\n\n',
      currentTaskText,
    ].join('');

    return {
      fixedBasePrompt,
      userExclusiveRules: userExclusiveRulesSection,
      styleRules: styleRulesSection,
      currentTask: currentTaskText,
      fullPrompt,
      assemblyMetadata: {
        timestamp: new Date(),
        ruleCount: userExclusiveRules.length,
        styleRuleCount: styleRules.length,
        sampleCount: sampleArticles.length + (options.samples?.length || 0),
        hasCoreAnchor: !!(options.coreAnchorData?.openingCase || options.coreAnchorData?.coreViewpoint || options.coreAnchorData?.endingConclusion),
        hasUserOpinion: !!options.userOpinion,
        materialCount: (options.materials?.length ?? 0) || availableMaterials.length,
        hasConfirmedOutline: !!options.confirmedOutline, // Phase 3
        hasPriorStepOutput: !!options.priorStepOutput,    // 🔴 前序步骤结果
        hasUniversalObjectiveWriting: !!universalObjectiveWritingText, // 🔥 是否有通用客观写作要求
      },
    };
  }
}

// 导出单例实例
export const promptAssemblerService = new PromptAssemblerService();
