/**
 * 句式约束服务
 * 
 * 核心理念：去AI化的本质不是"把AI写的改成不像AI写的"，而是"让AI按真人的写作流程写"。
 * 真人写保险文章时会使用自己习惯的句式，而不会使用AI高频模式。
 * 
 * 三层约束机制：
 * 1. 许可句式：来自已提取的真实文章（如"我有个客户..."、"上个月..."）
 * 2. 禁止句式：AI高频模式（如"值得注意的是"、"综上所述"、"不可否认"）
 * 3. 句式注入位置：段落开头、段落结尾、转折点、总结点
 */

// ================================================================
// 第一层：禁止句式清单（AI高频模式）
// 这些句式在AI生成的文章中出现频率极高，必须禁止
// ================================================================

export const FORBIDDEN_PATTERNS = {
  // 空洞衔接词（AI最爱用）
  emptyTransitions: [
    '值得注意的是',
    '需要指出的是',
    '不可否认的是',
    '不可否认',
    '毋庸置疑',
    '毋庸置疑的是',
    '显而易见',
    '众所周知',
    '众所周知的是',
    '由此可见',
    '由此可见',
    '综上所述',
    '总而言之',
    '一言以蔽之',
    '换句话说',
    '换言之',
    '换句话说就是',
    '换句话说，',
    '简而言之',
    '简言之',
    '概括来说',
    '从某种程度上说',
    '从某种意义上说',
    '在一定程度上',
    '不得不承认',
    '不得不承认的是',
  ],
  
  // 机械转折词（AI用得太频繁）
  mechanicalTransitions: [
    '然而，我们需要注意到',
    '但是，我们也要看到',
    '不过，值得注意的是',
    '当然，这并不意味着',
    '当然，这并不代表',
    '但是，我们也不能忽视',
    '但是，我们也要认识到',
    '同时，我们也应该',
    '此外，我们还应该',
    '更重要的是',
    '更为关键的是',
    '更为重要的是',
    '不仅如此，',
    '不仅如此，我们还',
    '事实上，',
    '实际上，',
    '客观地说，',
    '坦白说，',
    '说实话，',
    '说实话，这也是',
  ],
  
  // 模板总结词（AI结尾标配）
  templateSummaries: [
    '总而言之，',
    '综上所述，',
    '通过以上分析，我们可以得出',
    '通过以上分析，我们可以看出',
    '通过以上分析，不难发现',
    '通过上述分析，',
    '通过上述内容，',
    '从以上分析可以看出',
    '从以上分析我们可以得出',
    '最后，我想说的是',
    '最后需要提醒的是',
    '最后需要强调的是',
    '在此，我想强调的是',
    '在此，我想提醒大家',
    '希望通过本文',
    '希望通过这篇文章',
    '写到最后，',
    '文章写到这，',
  ],
  
  // 空洞强调词（AI用来凑字数）
  emptyEmphasis: [
    '这一点非常重要',
    '这一点至关重要',
    '这一点尤为关键',
    '这一点不容忽视',
    '这一点值得我们深思',
    '我们需要特别关注',
    '我们需要格外注意',
    '我们需要高度重视',
    '我们应该认识到',
    '我们应该意识到',
    '我们必须承认',
    '我们必须认识到',
    '我们要清醒地认识到',
    '我们要深刻认识到',
  ],
  
  // 假设性开头（AI用来制造悬念，但很生硬）
  fakeHypotheticals: [
    '试想一下，',
    '试想，',
    '想象一下，',
    '设想一下，',
    '假如，',
    '如果，',
    '假设，',
    '不妨设想',
    '不妨想象',
    '不妨试想',
  ],
  
  // 数据引入词（AI用来假装专业）
  fakeDataIntroducers: [
    '据统计，',
    '数据显示，',
    '根据相关数据，',
    '根据调查，',
    '研究表明，',
    '有研究表明，',
    '研究发现，',
    '有研究发现，',
    '专家指出，',
    '有专家指出，',
    '业内人士指出，',
    '业内人士认为，',
    '有关专家表示，',
  ],
};

// 展平为一维数组，方便匹配
export const ALL_FORBIDDEN_PHRASES = Object.values(FORBIDDEN_PATTERNS).flat();

// ================================================================
// 第二层：许可句式清单（来自真人写作）
// 这些句式来自真实文章，有温度、有画面感
// ================================================================

export const ALLOWED_PATTERNS = {
  // 故事开头（真人最爱用）
  storyOpenings: [
    '我有个客户',
    '我有个朋友',
    '我有个亲戚',
    '上周，',
    '上个月，',
    '去年，',
    '前两天，',
    '前几天，',
    '前阵子，',
    '最近，',
    '昨天，',
    '今天，',
    '刚毕业那会儿，',
    '刚工作那会儿，',
    '记得有一次，',
    '有一次，',
    '说个真事，',
    '讲个故事，',
    '讲个我身边的事',
    '说说我自己的经历',
  ],
  
  // 人物引入（真人写作的自然方式）
  characterIntroductions: [
    '我有个客户叫',
    '我朋友老张',
    '我表姐',
    '我邻居',
    '我同事',
    '我同学',
    '我客户A先生',
    '我客户B女士',
    '张阿姨',
    '李叔叔',
    '王姐',
    '刘哥',
    '老王',
    '老李',
    '小李',
    '小张',
  ],
  
  // 场景描写（真人写作的画面感）
  sceneDescriptions: [
    '那天下午，',
    '那天晚上，',
    '那是个周',
    '那是个星期',
    '那天他来找我',
    '那天她来问我',
    '见面时，',
    '聊天时，',
    '吃饭时，',
    '喝茶时，',
    '他坐下来第一句话就是',
    '她开口就问我',
    '我问他，',
    '我问她，',
    '他说，',
    '她说，',
  ],
  
  // 情感表达（真人写作的真实感）
  emotionalExpressions: [
    '说实话，我也',
    '坦白讲，',
    '我当时就觉得',
    '我当时心里想',
    '我当时就愣住了',
    '我当时就蒙了',
    '我当时就急了',
    '我听完就傻眼了',
    '我听完就懵了',
    '我听完心里咯噔一下',
    '那一刻我才明白',
    '那一刻我才意识到',
    '后来我才明白',
    '后来我才意识到',
    '现在想想，',
    '回头看看，',
    '事后想想，',
  ],
  
  // 转折过渡（真人写作的自然转折）
  naturalTransitions: [
    '但问题是，',
    '但没想到，',
    '但后来发现，',
    '但仔细一看，',
    '但仔细想了想，',
    '结果呢？',
    '结果怎么样？',
    '结局是什么？',
    '最后呢？',
    '后来呢？',
    '你猜怎么着？',
    '你知道后来怎么样了吗？',
    '你猜结果如何？',
    '更让我没想到的是，',
    '更让我意外的是，',
    '更让我震惊的是，',
    '让我更意外的是，',
  ],
  
  // 数据引入（真人写作的数据表达）
  naturalDataIntroducers: [
    '我看了一下条款，',
    '我仔细看了条款，',
    '我翻了翻合同，',
    '我看了看保障内容，',
    '我对比了几款产品，',
    '我算了一笔账，',
    '我帮他算了一下，',
    '我给她算了一笔账，',
    '按照条款规定，',
    '根据合同约定，',
    '条款里写得清清楚楚，',
    '合同里明确规定，',
  ],
  
  // 结尾收束（真人写作的自然结尾）
  naturalEndings: [
    '说这么多，其实就是想告诉大家',
    '写这篇文章，主要是想',
    '分享这个故事，是希望大家',
    '把这个案例分享出来，是想提醒大家',
    '讲了这么多，核心就一句话：',
    '最后想说的是，',
    '最后想提醒大家的是，',
    '希望大家看完能有所收获',
    '希望对大家有帮助',
    '希望这个案例能给大家一些参考',
  ],
};

// 按用途分组的许可句式
export const ALLOWED_BY_POSITION = {
  paragraphOpening: [
    ...ALLOWED_PATTERNS.storyOpenings,
    ...ALLOWED_PATTERNS.characterIntroductions,
    ...ALLOWED_PATTERNS.sceneDescriptions,
  ],
  transition: [
    ...ALLOWED_PATTERNS.naturalTransitions,
    ...ALLOWED_PATTERNS.emotionalExpressions,
  ],
  dataIntroduction: [
    ...ALLOWED_PATTERNS.naturalDataIntroducers,
  ],
  paragraphEnding: [
    ...ALLOWED_PATTERNS.naturalEndings,
    ...ALLOWED_PATTERNS.emotionalExpressions,
  ],
};

// ================================================================
// 第三层：句式约束服务
// ================================================================

export class SentencePatternService {
  /**
   * 检查文本是否包含禁止句式
   */
  static checkForbiddenPatterns(text: string): {
    hasForbidden: boolean;
    foundPatterns: string[];
    positions: { pattern: string; index: number }[];
  } {
    const foundPatterns: string[] = [];
    const positions: { pattern: string; index: number }[] = [];
    
    for (const pattern of ALL_FORBIDDEN_PHRASES) {
      const index = text.indexOf(pattern);
      if (index !== -1) {
        foundPatterns.push(pattern);
        positions.push({ pattern, index });
      }
    }
    
    return {
      hasForbidden: foundPatterns.length > 0,
      foundPatterns,
      positions,
    };
  }
  
  /**
   * 生成禁止句式清单的提示词
   */
  static generateForbiddenPrompt(): string {
    const sections = Object.entries(FORBIDDEN_PATTERNS).map(([category, patterns]) => {
      const categoryName = {
        emptyTransitions: '空洞衔接词',
        mechanicalTransitions: '机械转折词',
        templateSummaries: '模板总结词',
        emptyEmphasis: '空洞强调词',
        fakeHypotheticals: '假假设性开头',
        fakeDataIntroducers: '假数据引入词',
      }[category] || category;
      
      return `【${categoryName}】\n${patterns.map(p => `× "${p}"`).join('\n')}`;
    });
    
    return `## 🚫 绝对禁止使用的句式清单

以下句式是AI生成文章的"标志物"，使用任何一个都会让文章立刻暴露为AI写的。
你必须完全避免这些句式，不能以任何形式使用它们。

${sections.join('\n\n')}

**重要规则**：
- 以上句式一个都不能用，无论怎么改写都不行
- 如果你发现自己想用这些句式，说明你在"AI模式"，请切换到"真人模式"
- 真人不会说"值得注意的是"，真人会说"我当时就觉得不对劲"`;
  }
  
  /**
   * 生成许可句式清单的提示词
   */
  static generateAllowedPrompt(position?: 'opening' | 'transition' | 'data' | 'ending'): string {
    if (position) {
      const positionMap = {
        opening: 'paragraphOpening',
        transition: 'transition',
        data: 'dataIntroduction',
        ending: 'paragraphEnding',
      };
      const patterns = ALLOWED_BY_POSITION[positionMap[position]] || [];
      
      return `## ✅ 本段落可使用的真人句式

以下是来自真实文章的句式，你可以选择使用：

${patterns.map(p => `○ "${p}"`).join('\n')}

**使用建议**：选择一个你喜欢的，用在段落的${position === 'opening' ? '开头' : position === 'transition' ? '转折处' : position === 'data' ? '引入数据时' : '结尾'}。`;
    }
    
    // 返回全部许可句式
    const sections = Object.entries(ALLOWED_PATTERNS).map(([category, patterns]) => {
      const categoryName = {
        storyOpenings: '故事开头',
        characterIntroductions: '人物引入',
        sceneDescriptions: '场景描写',
        emotionalExpressions: '情感表达',
        naturalTransitions: '自然转折',
        naturalDataIntroducers: '数据引入',
        naturalEndings: '结尾收束',
      }[category] || category;
      
      return `【${categoryName}】\n${patterns.map(p => `○ "${p}"`).join('\n')}`;
    });
    
    return `## ✅ 真人写作句式参考

以下句式来自真实的保险文章，有温度、有画面感。
你可以参考这些句式的风格，但不必完全照搬。

${sections.join('\n\n')}

**核心原则**：
- 真人写作会用"我有个客户"、"上周"这样具体的时间、地点、人物
- 真人写作会用"我当时就愣住了"这样真实的情感表达
- 真人写作会用"但问题是"这样自然的转折
- 选择一个你顺口的句式，用你自己的话说出来`;
  }
  
  /**
   * 生成完整的句式约束提示词（用于 insurance-d）
   */
  static generateFullConstraintPrompt(): string {
    return `
${this.generateForbiddenPrompt()}

---

${this.generateAllowedPrompt()}

---

## 📝 句式使用检查清单

在输出文章前，请在心里过一遍这个检查清单：

□ 开头是否用了"我有个客户"、"上周"等真人句式？
□ 转折时是否用了"但问题是"、"结果呢"等自然转折？
□ 引入数据时是否用了"我看了条款"、"我算了一笔账"等自然方式？
□ 结尾是否用了"说这么多，其实就是想告诉大家"等自然收束？
□ 是否完全避免了"值得注意的是"、"综上所述"等AI句式？

如果你能通过这个检查清单，你的文章就会像真人写的。
`;
  }
}
