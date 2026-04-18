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
  imageCountMode?: '3-card' | '5-card' | '7-card'; // 🔥 小红书卡片数量模式
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

// ========== 提示词拼接服务 ==========

export class PromptAssemblerService {
  private fixedBasePrompts: Map<string, string> = new Map();

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
      result += '### 已确认的创作大纲（必须严格按照此大纲展开写作，不得偏离）\n\n';
      result += `${options.confirmedOutline}\n\n`;
      result += '⚠️ 大纲是用户确认过的，具有最高优先级。必须以大纲为骨架展开写作，大纲中规划的素材使用位置必须遵守。\n\n';
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
      result += '- 如果使用了这里的内容，必须确保 100% 精准\n\n';
    }

    // 🔥🔥🔴 新增：关联素材补充区（软参考，灵活整合）
    if (options.relatedMaterials) {
      result += '### 关联素材补充区（可参考使用，灵活整合）\n\n';
      result += `${options.relatedMaterials}\n\n`;
      result += `💡 以上为关联素材，${agentLabel} 可以：\n`;
      result += '- 引用、整合这些信息到文章中作为背景知识或补充案例\n';
      result += '- 基于这些信息进行合理演绎、扩展、补充\n';
      result += '- 优先级低于关键素材，但高于自行编造的内容\n\n';
    }

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

    // 🔥🔥🔥 【新增】小红书卡片数量模式
    if (options.imageCountMode && options.executorType === 'insurance-xiaohongshu') {
      const cardCountMap: Record<string, { count: number; desc: string }> = {
        '3-card': { count: 3, desc: '封面 + 1个要点 + 结尾（极简版，信息精炼）' },
        '5-card': { count: 5, desc: '封面 + 3个要点 + 结尾（标准版，信息适中）' },
        '7-card': { count: 7, desc: '封面 + 5个要点 + 结尾（详尽版，信息丰富）' },
      };
      const cardConfig = cardCountMap[options.imageCountMode] || cardCountMap['5-card'];
      result += '### 小红书卡片数量要求\n\n';
      result += `**图片模式**：${options.imageCountMode}（${cardConfig.desc}）\n\n`;
      result += `⚠️ **必须输出 ${cardConfig.count - 2} 个要点（points）**：\n`;
      result += `- 封面卡片（1个）：标题 + 副标题\n`;
      result += `- 要点卡片（${cardConfig.count - 2}个）：每个要点包含 title（渲染到图上）和 content（文字区展开）\n`;
      result += `- 结尾卡片（1个）：总结语\n\n`;
      result += `输出 JSON 中 platformData.points 数组长度必须为 ${cardConfig.count - 2}，不可多不可少。\n\n`;
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
   * 最终提示词 = 固定基础提示词 + 用户专属动态规则 + 本次创作需求
   */
  async assemblePrompt(options: PromptAssemblyOptions = {}): Promise<AssembledPrompt> {
    const [
      fixedBasePrompt,
      { userExclusiveRules, styleRules, sampleArticles, availableMaterials }
    ] = await Promise.all([
      this.loadFixedBasePrompt(options.executorType),
      // 🔥 Phase 5.5: 传递 templateId 给数字资产服务
      digitalAssetService.getDigitalAssetsForPrompt(options.workspaceId, options.templateId),
    ]);

    // 格式化各部分
    const userExclusiveRulesSection = this.formatUserExclusiveRules(userExclusiveRules);
    const styleRulesSection = this.formatStyleRules(styleRules);
    const currentTaskText = this.formatCurrentTask(options, availableMaterials);

    // M4: 拼接顺序对齐需求文档 3.2.3
    // 最终提示词 = 固定基础提示词 + 用户专属动态规则 + 本次创作需求
    const fullPrompt = [
      fixedBasePrompt,
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
      },
    };
  }
}

// 导出单例实例
export const promptAssemblerService = new PromptAssemblerService();
