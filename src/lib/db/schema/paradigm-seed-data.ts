/**
 * 10套创作范式种子数据
 * 与方案文档严格对齐：P001~P010
 * 每套范式包含：公众号7段结构 + 小红书版结构 + 素材位置映射 + 情绪曲线
 * 
 * 【位置ID三重绑定】
 * 第一层绑定：范式结构 ↔ slotId（唯一槽位ID，如 P001-01）
 * 第二层绑定：素材 ↔ slotId（每个素材绑定对应槽位ID）
 * 第三层绑定：匹配规则 ↔ slotId（只能将同ID素材填充到同ID位置）
 */

import { paradigmLibrary } from './paradigm-library';

export const PARADIGM_SEED_DATA = [
  // ============================================================
  // P001: 标准错位破局范式 - 9个插入点（7核心+2可选）
  // ============================================================
  {
    paradigmCode: 'P001',
    paradigmName: '标准错位破局范式',
    description: '先抛出错误认知→共情接纳→点破标准错位→通俗类比→真实案例→反问→价值重构→金句收尾。适用于客户误区型文章，是保险科普最核心的范式。',
    applicableArticleTypes: ['客户误区型', 'pitfall_guide'],
    applicableIndustries: ['insurance_life', 'insurance_health', 'insurance_property', 'finance'],
    applicableSceneKeywords: ['骗人', '不靠谱', '不赔', '坑', '套路', '回本', '保额', '没用'],
    officialAccountStructure: [
      { 
        order: 1, 
        slotId: 'P001-01', 
        stepName: '错误认知', 
        titleTemplate: '开头引入：用场景引出误区', 
        contentRequirement: '用1个数据或真实场景引出"很多人这样认为"的现象，直接引用错误认知原话', 
        wordRange: { min: 100, max: 200 }, 
        required: true, 
        fixedPhrases: ['很多人说', '有人觉得', '我经常听到'],
        fixedContext: '{{P001-01}}\n\n很多人都以为，像{{主题}}这样的事，肯定早就做好了。'
      },
      { 
        order: 2, 
        slotId: 'P001-02', 
        stepName: '共情接纳', 
        titleTemplate: '共情：我特别理解你', 
        contentRequirement: '先接纳对方的想法，表达理解和认同，建立信任感', 
        wordRange: { min: 80, max: 150 }, 
        required: true, 
        fixedPhrases: ['说实话，这种想法我特别理解', '换成是我，我也可能这样想'],
        fixedContext: '甚至还有人说，{{P001-02}}。\n\n这种想法真的很常见，但往往就是这种想当然，最后容易留下天大的遗憾。'
      },
      { 
        order: 3, 
        slotId: 'P001-03', 
        stepName: '点破错位', 
        titleTemplate: '破局：标准错位在哪里', 
        contentRequirement: '揭示"标准错位"——不是人错了，是衡量标准错了，用2-3句话点破', 
        wordRange: { min: 150, max: 300 }, 
        required: true, 
        fixedPhrases: ['但问题出在哪呢', '其实不是', '关键是'],
        fixedContext: '## 案例标题\n\n{{P001-03}}'
      },
      { 
        order: 4, 
        slotId: 'P001-04', 
        stepName: '通俗类比', 
        titleTemplate: '类比：用生活场景解释', 
        contentRequirement: '用日常生活的类比（买车/买房/导航等），帮助读者从熟悉场景理解正确逻辑', 
        wordRange: { min: 200, max: 400 }, 
        required: true, 
        fixedPhrases: ['你想想', '好比', '就像'],
        fixedContext: '{{P001-04}}\n\n更讽刺的是，宗庆后那份公证遗嘱，是2023年12月才立的。'
      },
      { 
        order: 5, 
        slotId: 'P001-05', 
        stepName: '真实案例', 
        titleTemplate: '案例：真实情况是怎样的', 
        contentRequirement: '用真实理赔案例或行业数据佐证，展现"标准转换"后的正确结果', 
        wordRange: { min: 200, max: 400 }, 
        required: true, 
        fixedPhrases: ['我见过一个案例', '数据告诉我们'],
        fixedContext: '你以为的"{{大家以为的}}"，其实最不靠谱\n\n{{P001-05}}'
      },
      { 
        order: 6, 
        slotId: 'P001-06', 
        stepName: '反问升华', 
        titleTemplate: '反问：如果是你呢', 
        contentRequirement: '用反问将案例延伸到读者自身，引发换位思考', 
        wordRange: { min: 100, max: 200 }, 
        required: true, 
        fixedPhrases: ['如果这事发生在你身上', '你会怎么选'],
        fixedContext: '首先我要跟大家明确两个观点：\n\n第一，{{P001-06}}'
      },
      { 
        order: 7, 
        slotId: 'P001-07', 
        stepName: '价值重构', 
        titleTemplate: '收尾：重新定义价值', 
        contentRequirement: '用金句重构价值认知，一句话总结核心观点，留下思考空间', 
        wordRange: { min: 50, max: 150 }, 
        required: true, 
        fixedPhrases: ['所以说', '归根结底'],
        fixedContext: '说句不好听的，{{主题}}这件事，特别像{{P001-07}}'
      },
      { 
        order: 8, 
        slotId: 'P001-08', 
        stepName: '建议部分', 
        titleTemplate: '建议：其实没那么复杂', 
        contentRequirement: '可选插入点：个人细节补充', 
        wordRange: { min: 80, max: 150 }, 
        required: false, 
        fixedPhrases: ['其实做{{主题}}安排没有大家想的那么复杂'],
        fixedContext: '其实做{{主题}}安排没有大家想的那么复杂。\n\n{{P001-08}}'
      },
      { 
        order: 9, 
        slotId: 'P001-09', 
        stepName: '结尾互动', 
        titleTemplate: '互动：评论区聊聊', 
        contentRequirement: '可选插入点：结尾互动', 
        wordRange: { min: 50, max: 100 }, 
        required: false, 
        fixedPhrases: ['不知道你们怎么看这个事'],
        fixedContext: '提前做{{主题}}安排，不是矫情，也不是不吉利，是给家人最实在的保障。\n\n{{P001-09}}'
      },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P001-XHS-01', stepName: '痛点引入', titleTemplate: '开头痛点', contentRequirement: '用一句话引出误区，配合痛点emoji', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['😱', '❌', '💢'], shortSentence: true, fixedContext: '{{P001-XHS-01}}' },
      { order: 2, slotId: 'P001-XHS-02', stepName: '共情+破局', titleTemplate: '共情+点破', contentRequirement: '先共情再点破，2-3句短句', wordRange: { min: 50, max: 100 }, emojiSuggestions: ['💡', '✨'], shortSentence: true, fixedContext: '{{P001-XHS-02}}' },
      { order: 3, slotId: 'P001-XHS-03', stepName: '类比解释', titleTemplate: '通俗类比', contentRequirement: '用最简单的一句类比，配合emoji', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['🏠', '🚗', '💡'], shortSentence: true, fixedContext: '{{P001-XHS-03}}' },
      { order: 4, slotId: 'P001-XHS-04', stepName: '案例佐证', titleTemplate: '真实案例', contentRequirement: '精简案例，只保留核心结论', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📊', '📋'], shortSentence: false, fixedContext: '{{P001-XHS-04}}' },
      { order: 5, slotId: 'P001-XHS-05', stepName: '金句收尾', titleTemplate: '金句+标签', contentRequirement: '一句总结金句+行动号召+话题标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['💪', '🎯'], shortSentence: true, fixedContext: '{{P001-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P001-01', paragraphOrder: 1, stepName: '错误认知', materialTypes: ['personal_fragment', 'case'], isPrimary: true, isOptional: false },
      { slotId: 'P001-02', paragraphOrder: 2, stepName: '共情接纳', materialTypes: ['misconception'], isPrimary: true, isOptional: false },
      { slotId: 'P001-03', paragraphOrder: 3, stepName: '点破错位', materialTypes: ['case'], isPrimary: true, isOptional: false },
      { slotId: 'P001-04', paragraphOrder: 4, stepName: '通俗类比', materialTypes: ['data'], isPrimary: true, isOptional: false },
      { slotId: 'P001-05', paragraphOrder: 5, stepName: '真实案例', materialTypes: ['fixed_phrase', 'golden_sentence'], isPrimary: true, isOptional: false },
      { slotId: 'P001-06', paragraphOrder: 6, stepName: '反问升华', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
      { slotId: 'P001-07', paragraphOrder: 7, stepName: '价值重构', materialTypes: ['analogy'], isPrimary: true, isOptional: false },
      { slotId: 'P001-08', paragraphOrder: 8, stepName: '建议部分', materialTypes: ['personal_fragment'], isPrimary: false, isOptional: true },
      { slotId: 'P001-09', paragraphOrder: 9, stepName: '结尾互动', materialTypes: ['personal_fragment'], isPrimary: false, isOptional: true },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '错误认知', emotion: '警醒', intensity: 7 },
      { paragraphOrder: 2, stepName: '共情接纳', emotion: '共情', intensity: 6 },
      { paragraphOrder: 3, stepName: '点破错位', emotion: '突破', intensity: 8 },
      { paragraphOrder: 4, stepName: '通俗类比', emotion: '释然', intensity: 5 },
      { paragraphOrder: 5, stepName: '真实案例', emotion: '坚定', intensity: 7 },
      { paragraphOrder: 6, stepName: '反问升华', emotion: '升华', intensity: 8 },
      { paragraphOrder: 7, stepName: '价值重构', emotion: '温暖', intensity: 6 },
    ],
    signaturePhrases: ['说实话，这种想法我特别理解', '但问题出在哪呢', '其实不是', '你想想', '如果这事发生在你身上'],
    sortOrder: 1,
    isActive: true,
    isSystem: true,
  },

  // ============================================================
  // P002: 行业反思范式
  // ============================================================
  {
    paradigmCode: 'P002',
    paradigmName: '行业反思范式',
    description: '引出行业问题→承认行业不足→区分工具与人→分析问题根源→提出改进方向→收尾升华。适用于行业/政策解读文章。',
    applicableArticleTypes: ['行业新认知型', 'authority_analysis'],
    applicableIndustries: ['insurance_life', 'insurance_health', 'insurance_property'],
    applicableSceneKeywords: ['行业', '保险行业', '从业者', '行业乱象', '监管', '政策'],
    officialAccountStructure: [
      { order: 1, slotId: 'P002-01', stepName: '行业问题', titleTemplate: '开头：引出行业问题', contentRequirement: '用一个现象或事件引出行业存在的问题，不回避痛点', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['这个行业确实', '很多人对保险'], fixedContext: '{{P002-01}}' },
      { order: 2, slotId: 'P002-02', stepName: '承认不足', titleTemplate: '坦诚：承认行业确实有问题', contentRequirement: '不回避、不辩护，坦诚承认行业存在的问题', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['不瞒你说', '确实存在'], fixedContext: '{{P002-02}}' },
      { order: 3, slotId: 'P002-03', stepName: '区分工具与人', titleTemplate: '厘清：是工具的问题还是人的问题', contentRequirement: '核心区分：保险本身没有错，错在部分人的做法，用类比说明', wordRange: { min: 200, max: 400 }, required: true, fixedPhrases: ['不是工具的问题', '问题出在'], fixedContext: '{{P002-03}}' },
      { order: 4, slotId: 'P002-04', stepName: '分析根源', titleTemplate: '深挖：问题出在哪', contentRequirement: '分析问题的深层原因（信息不对称/利益驱动/监管滞后等）', wordRange: { min: 200, max: 400 }, required: true, fixedPhrases: ['说到底', '本质上是'], fixedContext: '{{P002-04}}' },
      { order: 5, slotId: 'P002-05', stepName: '改进方向', titleTemplate: '建设：正在变好', contentRequirement: '给出行业正在改进的方向和事实，用数据和案例佐证', wordRange: { min: 150, max: 300 }, required: true, fixedPhrases: ['我们从业者', '好在'], fixedContext: '{{P002-05}}' },
      { order: 6, slotId: 'P002-06', stepName: '读者建议', titleTemplate: '实用：普通人怎么做', contentRequirement: '给普通消费者3-5条可操作的建议', wordRange: { min: 150, max: 300 }, required: true, fixedPhrases: ['给大家的建议', '记住这三点'], fixedContext: '{{P002-06}}' },
      { order: 7, slotId: 'P002-07', stepName: '收尾升华', titleTemplate: '升华：对行业的信心', contentRequirement: '用一句话总结行业前景，传递信心', wordRange: { min: 50, max: 150 }, required: true, fixedPhrases: ['归根结底', '我相信'], fixedContext: '{{P002-07}}' },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P002-XHS-01', stepName: '行业痛点', titleTemplate: '行业真相', contentRequirement: '一句话引出行业问题', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['🤔', '💭'], shortSentence: true, fixedContext: '{{P002-XHS-01}}' },
      { order: 2, slotId: 'P002-XHS-02', stepName: '坦诚承认', titleTemplate: '确实有问题', contentRequirement: '坦诚承认不足，不回避', wordRange: { min: 50, max: 100 }, emojiSuggestions: ['🙈', '🙏'], shortSentence: true, fixedContext: '{{P002-XHS-02}}' },
      { order: 3, slotId: 'P002-XHS-03', stepName: '厘清问题', titleTemplate: '是人还是工具', contentRequirement: '区分工具与人的问题', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['🔧', '👤'], shortSentence: true, fixedContext: '{{P002-XHS-03}}' },
      { order: 4, slotId: 'P002-XHS-04', stepName: '改进方向', titleTemplate: '正在变好', contentRequirement: '给出改进方向', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📈', '✨'], shortSentence: false, fixedContext: '{{P002-XHS-04}}' },
      { order: 5, slotId: 'P002-XHS-05', stepName: '实用建议', titleTemplate: '建议+标签', contentRequirement: '实用建议+话题标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['💡', '🎯'], shortSentence: true, fixedContext: '{{P002-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P002-01', paragraphOrder: 1, stepName: '行业问题', materialTypes: ['case', 'data'], isPrimary: true, isOptional: false },
      { slotId: 'P002-02', paragraphOrder: 2, stepName: '承认不足', materialTypes: ['fixed_phrase'], isPrimary: true, isOptional: false },
      { slotId: 'P002-03', paragraphOrder: 3, stepName: '区分工具与人', materialTypes: ['analogy'], isPrimary: true, isOptional: false },
      { slotId: 'P002-04', paragraphOrder: 4, stepName: '分析根源', materialTypes: ['data', 'golden_sentence'], isPrimary: true, isOptional: false },
      { slotId: 'P002-05', paragraphOrder: 5, stepName: '改进方向', materialTypes: ['data', 'case'], isPrimary: true, isOptional: false },
      { slotId: 'P002-06', paragraphOrder: 6, stepName: '读者建议', materialTypes: ['fixed_phrase', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P002-07', paragraphOrder: 7, stepName: '收尾升华', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '行业问题', emotion: '警醒', intensity: 6 },
      { paragraphOrder: 2, stepName: '承认不足', emotion: '坦诚', intensity: 7 },
      { paragraphOrder: 3, stepName: '区分工具与人', emotion: '厘清', intensity: 8 },
      { paragraphOrder: 4, stepName: '分析根源', emotion: '深度', intensity: 7 },
      { paragraphOrder: 5, stepName: '改进方向', emotion: '希望', intensity: 8 },
      { paragraphOrder: 6, stepName: '读者建议', emotion: '实用', intensity: 7 },
      { paragraphOrder: 7, stepName: '收尾升华', emotion: '信心', intensity: 9 },
    ],
    signaturePhrases: ['这个行业确实', '不瞒你说', '不是工具的问题', '说到底', '我相信'],
    sortOrder: 2,
    isActive: true,
    isSystem: true,
  },

  // ============================================================
  // P003-P010: 其他8套范式（简化结构，保持一致性）
  // ============================================================
  {
    paradigmCode: 'P003',
    paradigmName: '案例归谬范式',
    description: '通过真实案例展开→逐步拆解逻辑→归谬出错误→给出正确方案。适用于客户案例分析文章。',
    applicableArticleTypes: ['案例归谬型', 'case_study'],
    applicableIndustries: ['insurance_life', 'insurance_health'],
    applicableSceneKeywords: ['案例', '理赔', '拒赔', '真实案例'],
    officialAccountStructure: [
      { order: 1, slotId: 'P003-01', stepName: '案例引入', titleTemplate: '真实案例', contentRequirement: '用一个真实案例引入', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['我遇到过一个案例'], fixedContext: '{{P003-01}}' },
      { order: 2, slotId: 'P003-02', stepName: '拆解过程', titleTemplate: '拆解一下', contentRequirement: '逐步拆解案例过程', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['我们来看一下'], fixedContext: '{{P003-02}}' },
      { order: 3, slotId: 'P003-03', stepName: '归谬分析', titleTemplate: '问题出在哪', contentRequirement: '归谬出错误点', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['问题出在这'], fixedContext: '{{P003-03}}' },
      { order: 4, slotId: 'P003-04', stepName: '正确方案', titleTemplate: '正确的做法', contentRequirement: '给出正确方案', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['正确的做法是'], fixedContext: '{{P003-04}}' },
      { order: 5, slotId: 'P003-05', stepName: '总结启示', titleTemplate: '给大家的启示', contentRequirement: '总结案例启示', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['这个案例告诉我们'], fixedContext: '{{P003-05}}' },
      { order: 6, slotId: 'P003-06', stepName: '实用建议', titleTemplate: '记住这几点', contentRequirement: '3-5条实用建议', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['记住这几点'], fixedContext: '{{P003-06}}' },
      { order: 7, slotId: 'P003-07', stepName: '金句收尾', titleTemplate: '一句话总结', contentRequirement: '金句收尾', wordRange: { min: 50, max: 100 }, required: true, fixedPhrases: ['所以说'], fixedContext: '{{P003-07}}' },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P003-XHS-01', stepName: '案例引入', titleTemplate: '真实案例', contentRequirement: '一句话案例', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['📋', '😮'], shortSentence: true, fixedContext: '{{P003-XHS-01}}' },
      { order: 2, slotId: 'P003-XHS-02', stepName: '拆解归谬', titleTemplate: '拆解归谬', contentRequirement: '2-3句拆解', wordRange: { min: 50, max: 100 }, emojiSuggestions: ['🔍', '💡'], shortSentence: true, fixedContext: '{{P003-XHS-02}}' },
      { order: 3, slotId: 'P003-XHS-03', stepName: '正确方案', titleTemplate: '正确做法', contentRequirement: '正确方案', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['✅', '🎯'], shortSentence: true, fixedContext: '{{P003-XHS-03}}' },
      { order: 4, slotId: 'P003-XHS-04', stepName: '实用建议', titleTemplate: '记住几点', contentRequirement: '几点建议', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📝', '💪'], shortSentence: false, fixedContext: '{{P003-XHS-04}}' },
      { order: 5, slotId: 'P003-XHS-05', stepName: '金句标签', titleTemplate: '金句+标签', contentRequirement: '金句+标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['💎', '✨'], shortSentence: true, fixedContext: '{{P003-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P003-01', paragraphOrder: 1, stepName: '案例引入', materialTypes: ['case'], isPrimary: true, isOptional: false },
      { slotId: 'P003-02', paragraphOrder: 2, stepName: '拆解过程', materialTypes: ['data', 'fixed_phrase'], isPrimary: true, isOptional: false },
      { slotId: 'P003-03', paragraphOrder: 3, stepName: '归谬分析', materialTypes: ['misconception'], isPrimary: true, isOptional: false },
      { slotId: 'P003-04', paragraphOrder: 4, stepName: '正确方案', materialTypes: ['fixed_phrase', 'data'], isPrimary: true, isOptional: false },
      { slotId: 'P003-05', paragraphOrder: 5, stepName: '总结启示', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
      { slotId: 'P003-06', paragraphOrder: 6, stepName: '实用建议', materialTypes: ['fixed_phrase', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P003-07', paragraphOrder: 7, stepName: '金句收尾', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '案例引入', emotion: '好奇', intensity: 7 },
      { paragraphOrder: 2, stepName: '拆解过程', emotion: '深入', intensity: 8 },
      { paragraphOrder: 3, stepName: '归谬分析', emotion: '警醒', intensity: 9 },
      { paragraphOrder: 4, stepName: '正确方案', emotion: '释然', intensity: 6 },
      { paragraphOrder: 5, stepName: '总结启示', emotion: '收获', intensity: 7 },
      { paragraphOrder: 6, stepName: '实用建议', emotion: '实用', intensity: 8 },
      { paragraphOrder: 7, stepName: '金句收尾', emotion: '回味', intensity: 6 },
    ],
    signaturePhrases: ['我遇到过一个案例', '我们来看一下', '问题出在这', '正确的做法是', '这个案例告诉我们'],
    sortOrder: 3,
    isActive: true,
    isSystem: true,
  },

  // ============================================================
  // P004-P010: 剩余7套范式（简化版本，保持slotId一致性）
  // ============================================================
  {
    paradigmCode: 'P004',
    paradigmName: '本质定义范式',
    description: '概念本质定义→通俗类比解释→常见误区澄清→正确认知建立→实用建议给出。适用于保险概念科普文章。',
    applicableArticleTypes: ['概念定义型', 'concept_explanation'],
    applicableIndustries: ['insurance_life', 'insurance_health', 'insurance_property', 'finance'],
    applicableSceneKeywords: ['什么是', '定义', '概念', '本质', '理解'],
    officialAccountStructure: [
      { order: 1, slotId: 'P004-01', stepName: '本质定义', titleTemplate: '什么是{{主题}}', contentRequirement: '给出本质定义', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['本质上说', '简单来说'], fixedContext: '{{P004-01}}' },
      { order: 2, slotId: 'P004-02', stepName: '通俗类比', titleTemplate: '打个比方', contentRequirement: '用通俗类比解释', wordRange: { min: 150, max: 300 }, required: true, fixedPhrases: ['打个比方', '好比'], fixedContext: '{{P004-02}}' },
      { order: 3, slotId: 'P004-03', stepName: '常见误区', titleTemplate: '常见误解', contentRequirement: '澄清常见误区', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['很多人以为', '其实不是'], fixedContext: '{{P004-03}}' },
      { order: 4, slotId: 'P004-04', stepName: '正确认知', titleTemplate: '正确理解', contentRequirement: '建立正确认知', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['正确的理解是'], fixedContext: '{{P004-04}}' },
      { order: 5, slotId: 'P004-05', stepName: '数据支撑', titleTemplate: '数据告诉你', contentRequirement: '用数据支撑观点', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['数据显示'], fixedContext: '{{P004-05}}' },
      { order: 6, slotId: 'P004-06', stepName: '实用建议', titleTemplate: '怎么选', contentRequirement: '给出实用建议', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['给大家的建议'], fixedContext: '{{P004-06}}' },
      { order: 7, slotId: 'P004-07', stepName: '金句收尾', titleTemplate: '一句话总结', contentRequirement: '金句收尾', wordRange: { min: 50, max: 100 }, required: true, fixedPhrases: ['所以说'], fixedContext: '{{P004-07}}' },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P004-XHS-01', stepName: '本质定义', titleTemplate: '一句话说清', contentRequirement: '一句话定义', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['💡', '📖'], shortSentence: true, fixedContext: '{{P004-XHS-01}}' },
      { order: 2, slotId: 'P004-XHS-02', stepName: '通俗类比', titleTemplate: '打个比方', contentRequirement: '一句类比', wordRange: { min: 50, max: 100 }, emojiSuggestions: ['🎯', '🏠'], shortSentence: true, fixedContext: '{{P004-XHS-02}}' },
      { order: 3, slotId: 'P004-XHS-03', stepName: '常见误区', titleTemplate: '别搞错了', contentRequirement: '澄清误区', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['❌', '⚠️'], shortSentence: true, fixedContext: '{{P004-XHS-03}}' },
      { order: 4, slotId: 'P004-XHS-04', stepName: '正确认知', titleTemplate: '正确理解', contentRequirement: '正确认知', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['✅', '💎'], shortSentence: false, fixedContext: '{{P004-XHS-04}}' },
      { order: 5, slotId: 'P004-XHS-05', stepName: '建议标签', titleTemplate: '建议+标签', contentRequirement: '建议+标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['📝', '🎯'], shortSentence: true, fixedContext: '{{P004-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P004-01', paragraphOrder: 1, stepName: '本质定义', materialTypes: ['golden_sentence', 'fixed_phrase'], isPrimary: true, isOptional: false },
      { slotId: 'P004-02', paragraphOrder: 2, stepName: '通俗类比', materialTypes: ['analogy'], isPrimary: true, isOptional: false },
      { slotId: 'P004-03', paragraphOrder: 3, stepName: '常见误区', materialTypes: ['misconception'], isPrimary: true, isOptional: false },
      { slotId: 'P004-04', paragraphOrder: 4, stepName: '正确认知', materialTypes: ['fixed_phrase', 'golden_sentence'], isPrimary: true, isOptional: false },
      { slotId: 'P004-05', paragraphOrder: 5, stepName: '数据支撑', materialTypes: ['data'], isPrimary: true, isOptional: false },
      { slotId: 'P004-06', paragraphOrder: 6, stepName: '实用建议', materialTypes: ['fixed_phrase', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P004-07', paragraphOrder: 7, stepName: '金句收尾', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '本质定义', emotion: '清晰', intensity: 7 },
      { paragraphOrder: 2, stepName: '通俗类比', emotion: '明白', intensity: 8 },
      { paragraphOrder: 3, stepName: '常见误区', emotion: '警醒', intensity: 6 },
      { paragraphOrder: 4, stepName: '正确认知', emotion: '明确', intensity: 8 },
      { paragraphOrder: 5, stepName: '数据支撑', emotion: '信服', intensity: 7 },
      { paragraphOrder: 6, stepName: '实用建议', emotion: '实用', intensity: 8 },
      { paragraphOrder: 7, stepName: '金句收尾', emotion: '记忆', intensity: 6 },
    ],
    signaturePhrases: ['本质上说', '打个比方', '很多人以为', '正确的理解是', '所以说'],
    sortOrder: 4,
    isActive: true,
    isSystem: true,
  },

  // ============================================================
  // P005-P010: 剩余6套范式（保持结构一致性）
  // ============================================================
  {
    paradigmCode: 'P005',
    paradigmName: '热点事件范式',
    description: '热点事件引入→事件分析→保险关联→正确应对→实用建议。适用于热点结合保险文章。',
    applicableArticleTypes: ['热点结合型', 'hot_topic'],
    applicableIndustries: ['insurance_life', 'insurance_health', 'insurance_property'],
    applicableSceneKeywords: ['热点', '新闻', '事件', '热搜', '最近'],
    officialAccountStructure: [
      { order: 1, slotId: 'P005-01', stepName: '热点引入', titleTemplate: '最近这个事', contentRequirement: '热点事件引入', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['最近这个事'], fixedContext: '{{P005-01}}' },
      { order: 2, slotId: 'P005-02', stepName: '事件分析', titleTemplate: '我们来看', contentRequirement: '分析事件', wordRange: { min: 150, max: 300 }, required: true, fixedPhrases: ['我们来看一下'], fixedContext: '{{P005-02}}' },
      { order: 3, slotId: 'P005-03', stepName: '保险关联', titleTemplate: '保险的意义', contentRequirement: '关联保险', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['这时候保险的作用就体现了'], fixedContext: '{{P005-03}}' },
      { order: 4, slotId: 'P005-04', stepName: '正确应对', titleTemplate: '正确的应对', contentRequirement: '正确应对方式', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['正确的应对是'], fixedContext: '{{P005-04}}' },
      { order: 5, slotId: 'P005-05', stepName: '数据支撑', titleTemplate: '数据说话', contentRequirement: '数据支撑', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['数据告诉我们'], fixedContext: '{{P005-05}}' },
      { order: 6, slotId: 'P005-06', stepName: '实用建议', titleTemplate: '给大家的建议', contentRequirement: '实用建议', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['给大家的建议'], fixedContext: '{{P005-06}}' },
      { order: 7, slotId: 'P005-07', stepName: '金句收尾', titleTemplate: '一句话总结', contentRequirement: '金句收尾', wordRange: { min: 50, max: 100 }, required: true, fixedPhrases: ['所以说'], fixedContext: '{{P005-07}}' },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P005-XHS-01', stepName: '热点引入', titleTemplate: '这个事火了', contentRequirement: '一句话热点', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['🔥', '📰'], shortSentence: true, fixedContext: '{{P005-XHS-01}}' },
      { order: 2, slotId: 'P005-XHS-02', stepName: '保险关联', titleTemplate: '保险的意义', contentRequirement: '关联保险', wordRange: { min: 50, max: 100 }, emojiSuggestions: ['🛡️', '💡'], shortSentence: true, fixedContext: '{{P005-XHS-02}}' },
      { order: 3, slotId: 'P005-XHS-03', stepName: '正确应对', titleTemplate: '正确应对', contentRequirement: '正确应对', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['✅', '🎯'], shortSentence: true, fixedContext: '{{P005-XHS-03}}' },
      { order: 4, slotId: 'P005-XHS-04', stepName: '实用建议', titleTemplate: '实用建议', contentRequirement: '实用建议', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📝', '💪'], shortSentence: false, fixedContext: '{{P005-XHS-04}}' },
      { order: 5, slotId: 'P005-XHS-05', stepName: '金句标签', titleTemplate: '金句+标签', contentRequirement: '金句+标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['💎', '✨'], shortSentence: true, fixedContext: '{{P005-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P005-01', paragraphOrder: 1, stepName: '热点引入', materialTypes: ['case', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P005-02', paragraphOrder: 2, stepName: '事件分析', materialTypes: ['data'], isPrimary: true, isOptional: false },
      { slotId: 'P005-03', paragraphOrder: 3, stepName: '保险关联', materialTypes: ['analogy', 'fixed_phrase'], isPrimary: true, isOptional: false },
      { slotId: 'P005-04', paragraphOrder: 4, stepName: '正确应对', materialTypes: ['fixed_phrase', 'golden_sentence'], isPrimary: true, isOptional: false },
      { slotId: 'P005-05', paragraphOrder: 5, stepName: '数据支撑', materialTypes: ['data'], isPrimary: true, isOptional: false },
      { slotId: 'P005-06', paragraphOrder: 6, stepName: '实用建议', materialTypes: ['fixed_phrase', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P005-07', paragraphOrder: 7, stepName: '金句收尾', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '热点引入', emotion: '关注', intensity: 8 },
      { paragraphOrder: 2, stepName: '事件分析', emotion: '深入', intensity: 7 },
      { paragraphOrder: 3, stepName: '保险关联', emotion: '关联', intensity: 8 },
      { paragraphOrder: 4, stepName: '正确应对', emotion: '明确', intensity: 7 },
      { paragraphOrder: 5, stepName: '数据支撑', emotion: '信服', intensity: 6 },
      { paragraphOrder: 6, stepName: '实用建议', emotion: '实用', intensity: 8 },
      { paragraphOrder: 7, stepName: '金句收尾', emotion: '记忆', intensity: 6 },
    ],
    signaturePhrases: ['最近这个事', '我们来看一下', '这时候保险的作用就体现了', '正确的应对是', '所以说'],
    sortOrder: 5,
    isActive: true,
    isSystem: true,
  },

  // ============================================================
  // P006-P010: 最后5套范式（保持一致性）
  // ============================================================
  {
    paradigmCode: 'P006',
    paradigmName: '产品解读范式',
    description: '产品亮点→深度解析→常见问题→横向对比→购买建议。适用于产品测评文章。',
    applicableArticleTypes: ['产品测评型', 'product_review'],
    applicableIndustries: ['insurance_life', 'insurance_health', 'insurance_property'],
    applicableSceneKeywords: ['产品', '测评', '对比', '怎么选', '推荐'],
    officialAccountStructure: [
      { order: 1, slotId: 'P006-01', stepName: '产品亮点', titleTemplate: '这款产品', contentRequirement: '产品亮点介绍', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['这款产品最大的亮点是'], fixedContext: '{{P006-01}}' },
      { order: 2, slotId: 'P006-02', stepName: '深度解析', titleTemplate: '深度解析', contentRequirement: '深度解析', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['我们来深度解析一下'], fixedContext: '{{P006-02}}' },
      { order: 3, slotId: 'P006-03', stepName: '常见问题', titleTemplate: '常见问题', contentRequirement: '常见问题解答', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['大家最关心的几个问题'], fixedContext: '{{P006-03}}' },
      { order: 4, slotId: 'P006-04', stepName: '横向对比', titleTemplate: '横向对比', contentRequirement: '横向对比其他产品', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['我们来对比一下'], fixedContext: '{{P006-04}}' },
      { order: 5, slotId: 'P006-05', stepName: '数据支撑', titleTemplate: '数据说话', contentRequirement: '数据支撑', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['数据显示'], fixedContext: '{{P006-05}}' },
      { order: 6, slotId: 'P006-06', stepName: '购买建议', titleTemplate: '谁适合买', contentRequirement: '购买建议', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['谁适合买这款产品'], fixedContext: '{{P006-06}}' },
      { order: 7, slotId: 'P006-07', stepName: '金句收尾', titleTemplate: '一句话总结', contentRequirement: '金句收尾', wordRange: { min: 50, max: 100 }, required: true, fixedPhrases: ['所以说'], fixedContext: '{{P006-07}}' },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P006-XHS-01', stepName: '产品亮点', titleTemplate: '这款产品火了', contentRequirement: '一句话亮点', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['✨', '💎'], shortSentence: true, fixedContext: '{{P006-XHS-01}}' },
      { order: 2, slotId: 'P006-XHS-02', stepName: '深度解析', titleTemplate: '深度解析', contentRequirement: '2-3句解析', wordRange: { min: 50, max: 100 }, emojiSuggestions: ['🔍', '💡'], shortSentence: true, fixedContext: '{{P006-XHS-02}}' },
      { order: 3, slotId: 'P006-XHS-03', stepName: '横向对比', titleTemplate: '横向对比', contentRequirement: '对比表格', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['📊', '⚖️'], shortSentence: true, fixedContext: '{{P006-XHS-03}}' },
      { order: 4, slotId: 'P006-XHS-04', stepName: '购买建议', titleTemplate: '谁适合买', contentRequirement: '购买建议', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['🎯', '✅'], shortSentence: false, fixedContext: '{{P006-XHS-04}}' },
      { order: 5, slotId: 'P006-XHS-05', stepName: '金句标签', titleTemplate: '金句+标签', contentRequirement: '金句+标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['💪', '📝'], shortSentence: true, fixedContext: '{{P006-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P006-01', paragraphOrder: 1, stepName: '产品亮点', materialTypes: ['golden_sentence', 'fixed_phrase'], isPrimary: true, isOptional: false },
      { slotId: 'P006-02', paragraphOrder: 2, stepName: '深度解析', materialTypes: ['data', 'case'], isPrimary: true, isOptional: false },
      { slotId: 'P006-03', paragraphOrder: 3, stepName: '常见问题', materialTypes: ['fixed_phrase', 'misconception'], isPrimary: true, isOptional: false },
      { slotId: 'P006-04', paragraphOrder: 4, stepName: '横向对比', materialTypes: ['data'], isPrimary: true, isOptional: false },
      { slotId: 'P006-05', paragraphOrder: 5, stepName: '数据支撑', materialTypes: ['data'], isPrimary: true, isOptional: false },
      { slotId: 'P006-06', paragraphOrder: 6, stepName: '购买建议', materialTypes: ['fixed_phrase', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P006-07', paragraphOrder: 7, stepName: '金句收尾', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '产品亮点', emotion: '吸引', intensity: 7 },
      { paragraphOrder: 2, stepName: '深度解析', emotion: '深入', intensity: 8 },
      { paragraphOrder: 3, stepName: '常见问题', emotion: '解惑', intensity: 7 },
      { paragraphOrder: 4, stepName: '横向对比', emotion: '对比', intensity: 8 },
      { paragraphOrder: 5, stepName: '数据支撑', emotion: '信服', intensity: 6 },
      { paragraphOrder: 6, stepName: '购买建议', emotion: '实用', intensity: 8 },
      { paragraphOrder: 7, stepName: '金句收尾', emotion: '记忆', intensity: 6 },
    ],
    signaturePhrases: ['这款产品最大的亮点是', '我们来深度解析一下', '大家最关心的几个问题', '我们来对比一下', '所以说'],
    sortOrder: 6,
    isActive: true,
    isSystem: true,
  },

  // ============================================================
  // P007-P010: 最后4套范式（完整slotId绑定）
  // ============================================================
  {
    paradigmCode: 'P007',
    paradigmName: '个人经历范式',
    description: '个人经历引入→心路历程→转折点→感悟总结→实用建议。适用于亲身经历分享文章。',
    applicableArticleTypes: ['个人经历型', 'personal_story'],
    applicableIndustries: ['insurance_life', 'insurance_health', 'insurance_property'],
    applicableSceneKeywords: ['我经历过', '我的故事', '亲身经历', '我来说说'],
    officialAccountStructure: [
      { order: 1, slotId: 'P007-01', stepName: '经历引入', titleTemplate: '我的经历', contentRequirement: '个人经历引入', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['我经历过一件事'], fixedContext: '{{P007-01}}' },
      { order: 2, slotId: 'P007-02', stepName: '心路历程', titleTemplate: '当时的想法', contentRequirement: '心路历程', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['当时我是这样想的'], fixedContext: '{{P007-02}}' },
      { order: 3, slotId: 'P007-03', stepName: '转折点', titleTemplate: '转折点', contentRequirement: '转折点事件', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['直到那件事发生'], fixedContext: '{{P007-03}}' },
      { order: 4, slotId: 'P007-04', stepName: '感悟总结', titleTemplate: '我的感悟', contentRequirement: '感悟总结', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['那件事让我明白'], fixedContext: '{{P007-04}}' },
      { order: 5, slotId: 'P007-05', stepName: '数据支撑', titleTemplate: '数据印证', contentRequirement: '数据印证感悟', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['后来我看到数据'], fixedContext: '{{P007-05}}' },
      { order: 6, slotId: 'P007-06', stepName: '实用建议', titleTemplate: '给大家的建议', contentRequirement: '实用建议', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['给大家的建议'], fixedContext: '{{P007-06}}' },
      { order: 7, slotId: 'P007-07', stepName: '金句收尾', titleTemplate: '一句话总结', contentRequirement: '金句收尾', wordRange: { min: 50, max: 100 }, required: true, fixedPhrases: ['所以说'], fixedContext: '{{P007-07}}' },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P007-XHS-01', stepName: '经历引入', titleTemplate: '我的经历', contentRequirement: '一句话经历', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['📖', '💭'], shortSentence: true, fixedContext: '{{P007-XHS-01}}' },
      { order: 2, slotId: 'P007-XHS-02', stepName: '转折点', titleTemplate: '转折点', contentRequirement: '2-3句转折点', wordRange: { min: 50, max: 100 }, emojiSuggestions: ['⚡', '🔄'], shortSentence: true, fixedContext: '{{P007-XHS-02}}' },
      { order: 3, slotId: 'P007-XHS-03', stepName: '感悟总结', titleTemplate: '我的感悟', contentRequirement: '感悟总结', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['💡', '✨'], shortSentence: true, fixedContext: '{{P007-XHS-03}}' },
      { order: 4, slotId: 'P007-XHS-04', stepName: '实用建议', titleTemplate: '实用建议', contentRequirement: '实用建议', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📝', '💪'], shortSentence: false, fixedContext: '{{P007-XHS-04}}' },
      { order: 5, slotId: 'P007-XHS-05', stepName: '金句标签', titleTemplate: '金句+标签', contentRequirement: '金句+标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['💎', '🎯'], shortSentence: true, fixedContext: '{{P007-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P007-01', paragraphOrder: 1, stepName: '经历引入', materialTypes: ['personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P007-02', paragraphOrder: 2, stepName: '心路历程', materialTypes: ['personal_fragment', 'fixed_phrase'], isPrimary: true, isOptional: false },
      { slotId: 'P007-03', paragraphOrder: 3, stepName: '转折点', materialTypes: ['case'], isPrimary: true, isOptional: false },
      { slotId: 'P007-04', paragraphOrder: 4, stepName: '感悟总结', materialTypes: ['golden_sentence', 'fixed_phrase'], isPrimary: true, isOptional: false },
      { slotId: 'P007-05', paragraphOrder: 5, stepName: '数据支撑', materialTypes: ['data'], isPrimary: true, isOptional: false },
      { slotId: 'P007-06', paragraphOrder: 6, stepName: '实用建议', materialTypes: ['fixed_phrase', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P007-07', paragraphOrder: 7, stepName: '金句收尾', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '经历引入', emotion: '共情', intensity: 8 },
      { paragraphOrder: 2, stepName: '心路历程', emotion: '深入', intensity: 7 },
      { paragraphOrder: 3, stepName: '转折点', emotion: '转折', intensity: 9 },
      { paragraphOrder: 4, stepName: '感悟总结', emotion: '感悟', intensity: 8 },
      { paragraphOrder: 5, stepName: '数据支撑', emotion: '印证', intensity: 6 },
      { paragraphOrder: 6, stepName: '实用建议', emotion: '实用', intensity: 8 },
      { paragraphOrder: 7, stepName: '金句收尾', emotion: '记忆', intensity: 6 },
    ],
    signaturePhrases: ['我经历过一件事', '当时我是这样想的', '直到那件事发生', '那件事让我明白', '所以说'],
    sortOrder: 7,
    isActive: true,
    isSystem: true,
  },

  // ============================================================
  // P008: 避坑指南范式
  // ============================================================
  {
    paradigmCode: 'P008',
    paradigmName: '避坑指南范式',
    description: '常见坑点列举→坑点解析→避坑方法→真实案例→实用建议→金句收尾。适用于避坑干货文章。',
    applicableArticleTypes: ['避坑指南型', 'pitfall_guide'],
    applicableIndustries: ['insurance_life', 'insurance_health', 'insurance_property'],
    applicableSceneKeywords: ['避坑', '别踩', '注意', '小心', '别被骗'],
    officialAccountStructure: [
      { order: 1, slotId: 'P008-01', stepName: '坑点引入', titleTemplate: '常见的坑', contentRequirement: '常见坑点引入', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['很多人都踩过这个坑'], fixedContext: '{{P008-01}}' },
      { order: 2, slotId: 'P008-02', stepName: '错误认知', titleTemplate: '你以为的', contentRequirement: '错误认知分析', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['你以为的其实是最不靠谱的'], fixedContext: '{{P008-02}}' },
      { order: 3, slotId: 'P008-03', stepName: '坑点案例', titleTemplate: '踩坑案例', contentRequirement: '踩坑真实案例', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['我见过最典型的'], fixedContext: '{{P008-03}}' },
      { order: 4, slotId: 'P008-04', stepName: '避坑方法', titleTemplate: '正确的做法', contentRequirement: '避坑方法', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['正确的做法是'], fixedContext: '{{P008-04}}' },
      { order: 5, slotId: 'P008-05', stepName: '数据支撑', titleTemplate: '数据说话', contentRequirement: '数据支撑避坑', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['数据不会说谎'], fixedContext: '{{P008-05}}' },
      { order: 6, slotId: 'P008-06', stepName: '实用建议', titleTemplate: '给大家的建议', contentRequirement: '实用建议', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['给大家的建议'], fixedContext: '{{P008-06}}' },
      { order: 7, slotId: 'P008-07', stepName: '金句收尾', titleTemplate: '一句话总结', contentRequirement: '金句收尾', wordRange: { min: 50, max: 100 }, required: true, fixedPhrases: ['所以说'], fixedContext: '{{P008-07}}' },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P008-XHS-01', stepName: '坑点引入', titleTemplate: '常见的坑', contentRequirement: '一句话坑点', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['⚠️', '🚫'], shortSentence: true, fixedContext: '{{P008-XHS-01}}' },
      { order: 2, slotId: 'P008-XHS-02', stepName: '坑点案例', titleTemplate: '踩坑案例', contentRequirement: '2-3句案例', wordRange: { min: 50, max: 100 }, emojiSuggestions: ['😱', '💥'], shortSentence: true, fixedContext: '{{P008-XHS-02}}' },
      { order: 3, slotId: 'P008-XHS-03', stepName: '避坑方法', titleTemplate: '正确的做法', contentRequirement: '避坑方法', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['💡', '✅'], shortSentence: true, fixedContext: '{{P008-XHS-03}}' },
      { order: 4, slotId: 'P008-XHS-04', stepName: '实用建议', titleTemplate: '实用建议', contentRequirement: '实用建议', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📝', '💪'], shortSentence: false, fixedContext: '{{P008-XHS-04}}' },
      { order: 5, slotId: 'P008-XHS-05', stepName: '金句标签', titleTemplate: '金句+标签', contentRequirement: '金句+标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['💎', '🎯'], shortSentence: true, fixedContext: '{{P008-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P008-01', paragraphOrder: 1, stepName: '坑点引入', materialTypes: ['misconception', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P008-02', paragraphOrder: 2, stepName: '错误认知', materialTypes: ['misconception'], isPrimary: true, isOptional: false },
      { slotId: 'P008-03', paragraphOrder: 3, stepName: '坑点案例', materialTypes: ['case'], isPrimary: true, isOptional: false },
      { slotId: 'P008-04', paragraphOrder: 4, stepName: '避坑方法', materialTypes: ['fixed_phrase', 'analogy'], isPrimary: true, isOptional: false },
      { slotId: 'P008-05', paragraphOrder: 5, stepName: '数据支撑', materialTypes: ['data'], isPrimary: true, isOptional: false },
      { slotId: 'P008-06', paragraphOrder: 6, stepName: '实用建议', materialTypes: ['fixed_phrase', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P008-07', paragraphOrder: 7, stepName: '金句收尾', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '坑点引入', emotion: '警醒', intensity: 8 },
      { paragraphOrder: 2, stepName: '错误认知', emotion: '否定', intensity: 7 },
      { paragraphOrder: 3, stepName: '坑点案例', emotion: '共鸣', intensity: 9 },
      { paragraphOrder: 4, stepName: '避坑方法', emotion: '实用', intensity: 8 },
      { paragraphOrder: 5, stepName: '数据支撑', emotion: '信服', intensity: 6 },
      { paragraphOrder: 6, stepName: '实用建议', emotion: '温暖', intensity: 7 },
      { paragraphOrder: 7, stepName: '金句收尾', emotion: '记忆', intensity: 6 },
    ],
    signaturePhrases: ['很多人都踩过这个坑', '你以为的其实是最不靠谱的', '正确的做法是', '数据不会说谎', '所以说'],
    sortOrder: 8,
    isActive: true,
    isSystem: true,
  },

  // ============================================================
  // P009: 对比分析范式
  // ============================================================
  {
    paradigmCode: 'P009',
    paradigmName: '对比分析范式',
    description: '对比引入→A方案解析→B方案解析→核心差异→选择建议→金句收尾。适用于产品/方案对比文章。',
    applicableArticleTypes: ['对比分析型', 'comparison_analysis'],
    applicableIndustries: ['insurance_life', 'insurance_health', 'insurance_property'],
    applicableSceneKeywords: ['对比', '哪个好', '区别', '选哪个', 'A还是B'],
    officialAccountStructure: [
      { order: 1, slotId: 'P009-01', stepName: '对比引入', titleTemplate: '很多人纠结', contentRequirement: '对比引入', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['很多人在这两者之间纠结'], fixedContext: '{{P009-01}}' },
      { order: 2, slotId: 'P009-02', stepName: 'A方案解析', titleTemplate: '先说A', contentRequirement: 'A方案优势与劣势', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['先说说A的优势'], fixedContext: '{{P009-02}}' },
      { order: 3, slotId: 'P009-03', stepName: 'B方案解析', titleTemplate: '再说B', contentRequirement: 'B方案优势与劣势', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['再来看看B'], fixedContext: '{{P009-03}}' },
      { order: 4, slotId: 'P009-04', stepName: '核心差异', titleTemplate: '核心差异', contentRequirement: '核心差异对比', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['两者最核心的差异是'], fixedContext: '{{P009-04}}' },
      { order: 5, slotId: 'P009-05', stepName: '选择建议', titleTemplate: '怎么选', contentRequirement: '选择建议', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['我的建议是'], fixedContext: '{{P009-05}}' },
      { order: 6, slotId: 'P009-06', stepName: '案例佐证', titleTemplate: '真实案例', contentRequirement: '案例佐证', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['我见过一个真实的例子'], fixedContext: '{{P009-06}}' },
      { order: 7, slotId: 'P009-07', stepName: '金句收尾', titleTemplate: '一句话总结', contentRequirement: '金句收尾', wordRange: { min: 50, max: 100 }, required: true, fixedPhrases: ['所以说'], fixedContext: '{{P009-07}}' },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P009-XHS-01', stepName: '对比引入', titleTemplate: '纠结选哪个', contentRequirement: '一句话引入', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['🤔', '⚖️'], shortSentence: true, fixedContext: '{{P009-XHS-01}}' },
      { order: 2, slotId: 'P009-XHS-02', stepName: 'AB对比', titleTemplate: 'AB对比', contentRequirement: 'AB对比要点', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📊', '🔄'], shortSentence: true, fixedContext: '{{P009-XHS-02}}' },
      { order: 3, slotId: 'P009-XHS-03', stepName: '选择建议', titleTemplate: '怎么选', contentRequirement: '选择建议', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['💡', '✅'], shortSentence: true, fixedContext: '{{P009-XHS-03}}' },
      { order: 4, slotId: 'P009-XHS-04', stepName: '实用建议', titleTemplate: '实用建议', contentRequirement: '实用建议', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📝', '💪'], shortSentence: false, fixedContext: '{{P009-XHS-04}}' },
      { order: 5, slotId: 'P009-XHS-05', stepName: '金句标签', titleTemplate: '金句+标签', contentRequirement: '金句+标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['💎', '🎯'], shortSentence: true, fixedContext: '{{P009-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P009-01', paragraphOrder: 1, stepName: '对比引入', materialTypes: ['misconception', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P009-02', paragraphOrder: 2, stepName: 'A方案解析', materialTypes: ['fixed_phrase', 'data'], isPrimary: true, isOptional: false },
      { slotId: 'P009-03', paragraphOrder: 3, stepName: 'B方案解析', materialTypes: ['fixed_phrase', 'data'], isPrimary: true, isOptional: false },
      { slotId: 'P009-04', paragraphOrder: 4, stepName: '核心差异', materialTypes: ['analogy', 'golden_sentence'], isPrimary: true, isOptional: false },
      { slotId: 'P009-05', paragraphOrder: 5, stepName: '选择建议', materialTypes: ['fixed_phrase', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P009-06', paragraphOrder: 6, stepName: '案例佐证', materialTypes: ['case'], isPrimary: true, isOptional: false },
      { slotId: 'P009-07', paragraphOrder: 7, stepName: '金句收尾', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '对比引入', emotion: '好奇', intensity: 7 },
      { paragraphOrder: 2, stepName: 'A方案解析', emotion: '客观', intensity: 6 },
      { paragraphOrder: 3, stepName: 'B方案解析', emotion: '客观', intensity: 6 },
      { paragraphOrder: 4, stepName: '核心差异', emotion: '清晰', intensity: 8 },
      { paragraphOrder: 5, stepName: '选择建议', emotion: '实用', intensity: 8 },
      { paragraphOrder: 6, stepName: '案例佐证', emotion: '信服', intensity: 7 },
      { paragraphOrder: 7, stepName: '金句收尾', emotion: '记忆', intensity: 6 },
    ],
    signaturePhrases: ['很多人在这两者之间纠结', '先说说', '再来看看', '两者最核心的差异是', '我的建议是'],
    sortOrder: 9,
    isActive: true,
    isSystem: true,
  },

  // ============================================================
  // P010: 年终总结范式
  // ============================================================
  {
    paradigmCode: 'P010',
    paradigmName: '年终总结范式',
    description: '年度回顾引入→行业重大事件→数据盘点→趋势预判→个人思考→实用建议→金句收尾。适用于年度回顾文章。',
    applicableArticleTypes: ['年终总结型', 'year_end_review'],
    applicableIndustries: ['insurance_life', 'insurance_health', 'insurance_property'],
    applicableSceneKeywords: ['年终', '年度', '回顾', '盘点', '总结'],
    officialAccountStructure: [
      { order: 1, slotId: 'P010-01', stepName: '年度回顾引入', titleTemplate: '这一年', contentRequirement: '年度回顾引入', wordRange: { min: 100, max: 200 }, required: true, fixedPhrases: ['这一年过得太快了'], fixedContext: '{{P010-01}}' },
      { order: 2, slotId: 'P010-02', stepName: '重大事件', titleTemplate: '大事记', contentRequirement: '行业重大事件', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['今年最大的事'], fixedContext: '{{P010-02}}' },
      { order: 3, slotId: 'P010-03', stepName: '数据盘点', titleTemplate: '数据说话', contentRequirement: '数据盘点', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['我们来看看数据'], fixedContext: '{{P010-03}}' },
      { order: 4, slotId: 'P010-04', stepName: '趋势预判', titleTemplate: '明年会怎样', contentRequirement: '趋势预判', wordRange: { min: 200, max: 350 }, required: true, fixedPhrases: ['明年我判断'], fixedContext: '{{P010-04}}' },
      { order: 5, slotId: 'P010-05', stepName: '个人思考', titleTemplate: '我的思考', contentRequirement: '个人思考', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['我的思考是'], fixedContext: '{{P010-05}}' },
      { order: 6, slotId: 'P010-06', stepName: '实用建议', titleTemplate: '给大家的建议', contentRequirement: '实用建议', wordRange: { min: 150, max: 250 }, required: true, fixedPhrases: ['给大家的建议'], fixedContext: '{{P010-06}}' },
      { order: 7, slotId: 'P010-07', stepName: '金句收尾', titleTemplate: '一句话总结', contentRequirement: '金句收尾', wordRange: { min: 50, max: 100 }, required: true, fixedPhrases: ['所以说'], fixedContext: '{{P010-07}}' },
    ],
    xiaohongshuStructure: [
      { order: 1, slotId: 'P010-XHS-01', stepName: '年度引入', titleTemplate: '这一年', contentRequirement: '一句话回顾', wordRange: { min: 30, max: 60 }, emojiSuggestions: ['📅', '⏰'], shortSentence: true, fixedContext: '{{P010-XHS-01}}' },
      { order: 2, slotId: 'P010-XHS-02', stepName: '大事盘点', titleTemplate: '大事记', contentRequirement: '2-3件大事', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📰', '🔥'], shortSentence: true, fixedContext: '{{P010-XHS-02}}' },
      { order: 3, slotId: 'P010-XHS-03', stepName: '趋势预判', titleTemplate: '明年怎么看', contentRequirement: '趋势预判', wordRange: { min: 40, max: 80 }, emojiSuggestions: ['🔮', '💡'], shortSentence: true, fixedContext: '{{P010-XHS-03}}' },
      { order: 4, slotId: 'P010-XHS-04', stepName: '实用建议', titleTemplate: '实用建议', contentRequirement: '实用建议', wordRange: { min: 60, max: 120 }, emojiSuggestions: ['📝', '💪'], shortSentence: false, fixedContext: '{{P010-XHS-04}}' },
      { order: 5, slotId: 'P010-XHS-05', stepName: '金句标签', titleTemplate: '金句+标签', contentRequirement: '金句+标签', wordRange: { min: 30, max: 80 }, emojiSuggestions: ['💎', '🎯'], shortSentence: true, fixedContext: '{{P010-XHS-05}}' },
    ],
    materialPositionMap: [
      { slotId: 'P010-01', paragraphOrder: 1, stepName: '年度回顾引入', materialTypes: ['personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P010-02', paragraphOrder: 2, stepName: '重大事件', materialTypes: ['case', 'data'], isPrimary: true, isOptional: false },
      { slotId: 'P010-03', paragraphOrder: 3, stepName: '数据盘点', materialTypes: ['data'], isPrimary: true, isOptional: false },
      { slotId: 'P010-04', paragraphOrder: 4, stepName: '趋势预判', materialTypes: ['fixed_phrase', 'golden_sentence'], isPrimary: true, isOptional: false },
      { slotId: 'P010-05', paragraphOrder: 5, stepName: '个人思考', materialTypes: ['analogy', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P010-06', paragraphOrder: 6, stepName: '实用建议', materialTypes: ['fixed_phrase', 'personal_fragment'], isPrimary: true, isOptional: false },
      { slotId: 'P010-07', paragraphOrder: 7, stepName: '金句收尾', materialTypes: ['golden_sentence'], isPrimary: true, isOptional: false },
    ],
    emotionCurve: [
      { paragraphOrder: 1, stepName: '年度回顾引入', emotion: '感慨', intensity: 7 },
      { paragraphOrder: 2, stepName: '重大事件', emotion: '震撼', intensity: 9 },
      { paragraphOrder: 3, stepName: '数据盘点', emotion: '客观', intensity: 6 },
      { paragraphOrder: 4, stepName: '趋势预判', emotion: '前瞻', intensity: 8 },
      { paragraphOrder: 5, stepName: '个人思考', emotion: '深度', intensity: 7 },
      { paragraphOrder: 6, stepName: '实用建议', emotion: '温暖', intensity: 7 },
      { paragraphOrder: 7, stepName: '金句收尾', emotion: '记忆', intensity: 6 },
    ],
    signaturePhrases: ['这一年过得太快了', '今年最大的事', '我们来看看数据', '明年我判断', '我的思考是'],
    sortOrder: 10,
    isActive: true,
    isSystem: true,
  },
] as const;

/** 范式代码名称映射 */
export const PARADIGM_CODE_NAME_MAP: Record<string, string> = {
  'P001': '标准错位破局范式',
  'P002': '行业反思范式',
  'P003': '案例归谬范式',
  'P004': '本质定义范式',
  'P005': '热点事件范式',
  'P006': '产品解读范式',
  'P007': '个人经历范式',
  'P008': '避坑指南范式',
  'P009': '对比分析范式',
  'P010': '年终总结范式',
};

/** 范式文章类型映射 */
export const PARADIGM_ARTICLE_TYPE_MAP: Record<string, string[]> = {
  'P001': ['客户误区型', 'pitfall_guide'],
  'P002': ['行业新认知型', 'authority_analysis'],
  'P003': ['案例归谬型', 'case_study'],
  'P004': ['概念定义型', 'concept_explanation'],
  'P005': ['热点结合型', 'hot_topic'],
  'P006': ['产品测评型', 'product_review'],
  'P007': ['个人经历型', 'personal_story'],
  'P008': ['避坑指南型', 'pitfall_guide'],
  'P009': ['对比分析型', 'comparison_analysis'],
  'P010': ['年终总结型', 'year_end_review'],
};
