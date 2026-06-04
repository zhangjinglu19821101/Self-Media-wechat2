/**
 * 流程模板配置
 * 
 * 支持微信公众号和小红书等不同平台的默认流程模板
 * 
 * 设计原则：
 * 1. 单一数据源：只定义 nodes，steps 由 nodes 派生
 * 2. 类型安全：使用配置对象替代魔法数组
 * 3. 扩展友好：新增平台只需添加配置
 */

import type { FlowNode, FlowTemplate, FlowStep, NodeStyleConfig } from '@/components/creation-guide/types';
import { extractSteps } from '@/components/creation-guide/types';
import { getExecutorForPlatform } from '@/lib/agents/agent-registry';

// ============ 类型重导出（兼容旧代码） ============

/**
 * @deprecated 使用 FlowStep 代替
 */
export type SubTaskTemplate = FlowStep;

// ============ 节点样式配置（类型安全） ============

/**
 * 节点样式映射表
 * 使用 as const 确保类型安全，添加/删除样式时会编译报错
 */
const NODE_STYLES = {
  // 微信公众号样式
  wechat_user: { icon: '📱', color: 'from-green-500 to-emerald-600' },
  wechat_write: { icon: '📝', color: 'from-blue-500 to-indigo-600' },
  wechat_deai: { icon: '✨', color: 'from-cyan-500 to-teal-600' },
  wechat_preview: { icon: '👁️', color: 'from-purple-500 to-violet-600' },
  wechat_polish: { icon: '🔧', color: 'from-sky-500 to-blue-600' },
  wechat_check: { icon: '✅', color: 'from-amber-500 to-orange-600' },
  wechat_upload: { icon: '📤', color: 'from-teal-500 to-cyan-600' },
  
  // 小红书样式
  xiaohongshu_user: { icon: '📕', color: 'from-red-500 to-rose-600' },
  xiaohongshu_write: { icon: '📝', color: 'from-pink-500 to-rose-600' },
  xiaohongshu_deai: { icon: '✨', color: 'from-fuchsia-500 to-pink-600' },
  xiaohongshu_preview: { icon: '👁️', color: 'from-purple-500 to-pink-600' },
  xiaohongshu_polish: { icon: '🔧', color: 'from-rose-500 to-red-600' },
  xiaohongshu_check: { icon: '✅', color: 'from-amber-500 to-orange-600' },
  
  // 知乎样式
  zhihu_user: { icon: '🔵', color: 'from-blue-600 to-slate-700' },
  zhihu_write: { icon: '📝', color: 'from-slate-500 to-slate-700' },
  zhihu_deai: { icon: '✨', color: 'from-indigo-500 to-blue-600' },
  zhihu_preview: { icon: '👁️', color: 'from-purple-500 to-indigo-600' },
  zhihu_check: { icon: '✅', color: 'from-amber-500 to-orange-600' },
  
  // 头条/抖音样式
  toutiao_user: { icon: '📱', color: 'from-red-600 to-orange-600' },
  toutiao_write: { icon: '📝', color: 'from-orange-500 to-red-600' },
  toutiao_deai: { icon: '✨', color: 'from-amber-500 to-orange-600' },
  toutiao_preview: { icon: '👁️', color: 'from-purple-500 to-orange-600' },
  toutiao_check: { icon: '✅', color: 'from-amber-500 to-orange-600' },
  
  // 直接发文模式样式（4步流程：预览→合规→整改→上传）
  dp_preview: { icon: '👁️', color: 'from-purple-500 to-violet-600' },
  dp_confirm: { icon: '📋', color: 'from-emerald-500 to-green-600' },
  dp_check: { icon: '✅', color: 'from-amber-500 to-orange-600' },
  dp_fix: { icon: '🔧', color: 'from-sky-500 to-blue-600' },
  dp_upload: { icon: '📤', color: 'from-teal-500 to-cyan-600' },
  dp_final: { icon: '🏁', color: 'from-indigo-500 to-violet-600' },
  dp_xhs_format: { icon: '📝', color: 'from-pink-500 to-rose-600' },
  dp_xhs_preview: { icon: '👁️', color: 'from-purple-500 to-pink-600' },
  dp_xhs_confirm: { icon: '📋', color: 'from-rose-500 to-pink-600' },
  dp_xhs_check: { icon: '✅', color: 'from-amber-500 to-orange-600' },
  dp_xhs_fix: { icon: '🔧', color: 'from-rose-500 to-red-600' },
  dp_zhihu_format: { icon: '📝', color: 'from-slate-500 to-slate-700' },
  dp_zhihu_preview: { icon: '👁️', color: 'from-purple-500 to-indigo-600' },
  dp_toutiao_format: { icon: '📝', color: 'from-orange-500 to-red-600' },
  dp_toutiao_preview: { icon: '👁️', color: 'from-purple-500 to-orange-600' },

  // 大纲创作模式样式
  ow_write: { icon: '✍️', color: 'from-violet-500 to-indigo-600' },
  ow_preview: { icon: '👁️', color: 'from-purple-500 to-violet-600' },
  ow_review: { icon: '🔍', color: 'from-amber-500 to-yellow-600' },
  ow_revise: { icon: '🔧', color: 'from-sky-500 to-blue-600' },
  ow_check: { icon: '✅', color: 'from-emerald-500 to-green-600' },
  ow_fix: { icon: '🛠️', color: 'from-orange-500 to-amber-600' },
  ow_upload: { icon: '📤', color: 'from-teal-500 to-cyan-600' },
} as const;

// ============ 平台默认流程模板定义 ============

/**
 * 创建流程模板的工厂函数
 * 确保数据一致性：只定义 nodes，steps 自动派生
 */
function createFlowTemplate(
  id: string,
  platform: string,
  platformLabel: string,
  name: string,
  nodeConfigs: Array<{
    id: string;
    executor: string;
    title: string;
    description: string;
    styleKey: keyof typeof NODE_STYLES;
  }>
): FlowTemplate {
  const nodes: FlowNode[] = nodeConfigs.map((config, index) => ({
    id: config.id,
    orderIndex: index + 1,
    executor: config.executor,
    title: config.title,
    description: config.description,
    ...NODE_STYLES[config.styleKey],
  }));

  return {
    id,
    platform,
    platformLabel,
    name,
    nodes,
    steps: extractSteps(nodes),  // 自动派生，保证一致性
    isDefault: true,
  };
}

/**
 * 微信公众号默认流程模板（7步）
 * 
 * 特点：
 * - insurance-d 撰写 HTML 长文
 * - deai-optimizer 去AI化优化
 * - 用户预览修改初稿（可跳过）
 * - Agent T 执行合规校验
 * - insurance-d 完成合规整改（根据校验结果修改文章）
 * - Agent T 上传公众号草稿箱
 * - Agent B 最终审核确认
 */
export const WECHAT_OFFICIAL_FLOW_TEMPLATE = createFlowTemplate(
  'wechat-official-default',
  'wechat_official',
  '微信公众号',
  '公众号文章创作流程',
  [
    { id: 'node-wechat-1', executor: 'B', title: '分析任务需求', description: '分析用户指令，提取核心观点、关键素材、目标受众，规划文章创作方向和结构建议', styleKey: 'wechat_user' },
    { id: 'node-wechat-2', executor: 'insurance-d', title: '撰写公众号文章', description: '根据分析结果和用户确认的大纲，撰写完整的公众号文章（HTML格式），遵循核心铁律和风格要求', styleKey: 'wechat_write' },
    { id: 'node-wechat-3', executor: 'deai-optimizer', title: '去AI化优化', description: '对文章进行全维度自检和柔和改写，剔除AI机器腔、模板句式，让内容更自然、更像真人手写', styleKey: 'wechat_deai' },
    { id: 'node-wechat-4', executor: 'user_preview_edit', title: '用户预览修改初稿', description: '用户预览文章初稿，可修改调整或直接确认继续（修改后版本将用于合规校验）。此节点由用户操作，非Agent执行', styleKey: 'wechat_preview' },
    { id: 'node-wechat-5', executor: 'T', title: '合规校验', description: '对文章进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'wechat_check' },
    { id: 'node-wechat-6', executor: 'insurance-d', title: '完成合规整改', description: '依据合规校验结果，完成公众号文章整改（修改违规内容、调整表述）', styleKey: 'wechat_polish' },
    { id: 'node-wechat-7', executor: 'T', title: '上传公众号草稿箱', description: '将整改后的文章上传至公众号草稿箱，配置原创声明、赞赏等设置', styleKey: 'wechat_upload' },
  ]
);

/**
 * 小红书默认流程模板（7步，与公众号对称）
 * 
 * 特点：
 * - insurance-xiaohongshu 创作图文（JSON格式，含卡片数据）
 * - deai-optimizer 去AI化优化
 * - 用户预览修改图文（可跳过）
 * - Agent T 执行合规校验和生成预览图
 * - Agent B 最终审核确认
 * - 小红书不支持API上传，预览图供用户手动发布
 */
export const XIAOHONGSHU_FLOW_TEMPLATE = createFlowTemplate(
  'xiaohongshu-default',
  'xiaohongshu',
  '小红书',
  '小红书图文创作流程',
  [
    { id: 'node-xhs-1', executor: 'B', title: '分析任务需求', description: '分析用户指令，提取核心观点、关键素材、目标受众，规划小红书图文创作方向和卡片结构', styleKey: 'xiaohongshu_user' },
    { id: 'node-xhs-2', executor: 'insurance-xiaohongshu', title: '创作小红书图文', description: '根据分析结果创作小红书图文内容（JSON格式），包含标题、要点卡片、正文、标签', styleKey: 'xiaohongshu_write' },
    { id: 'node-xhs-3', executor: 'deai-optimizer', title: '去AI化优化', description: '对图文内容进行全维度自检和柔和改写，剔除AI机器腔、模板句式，让内容更自然、更像真人手写', styleKey: 'xiaohongshu_deai' },
    { id: 'node-xhs-4', executor: 'user_preview_edit', title: '用户预览修改图文', description: '用户预览小红书图文初稿，可修改标题/要点/正文/标签或直接确认继续。此节点由用户操作，非Agent执行', styleKey: 'xiaohongshu_preview' },
    { id: 'node-xhs-5', executor: 'T', title: '合规校验', description: '对小红书图文进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'xiaohongshu_check' },
    { id: 'node-xhs-6', executor: 'insurance-xiaohongshu', title: '完成合规整改', description: '依据合规校验结果，完成小红书图文整改', styleKey: 'xiaohongshu_polish' },
    { id: 'node-xhs-7', executor: 'user_preview_edit', title: '用户预览终稿', description: '合规整改后的终稿确认，用户审阅最终图文内容，可修改标题/要点/正文/标签或直接确认。此节点由用户操作，非Agent执行，不涉及上传发布', styleKey: 'xiaohongshu_preview' },
  ]
);

/**
 * 知乎默认流程模板（7步）
 * 
 * 特点：
 * - insurance-zhihu 创作深度长文
 * - deai-optimizer 去AI化优化
 * - 用户预览修改初稿（可跳过）
 * - Agent T 执行合规校验
 * - Agent B 最终审核确认
 */
export const ZHIHU_FLOW_TEMPLATE = createFlowTemplate(
  'zhihu-default',
  'zhihu',
  '知乎',
  '知乎文章创作流程',
  [
    { id: 'node-zhihu-1', executor: 'B', title: '分析任务需求', description: '分析用户指令，提取核心观点、关键素材、目标受众，规划知乎文章创作方向', styleKey: 'zhihu_user' },
    { id: 'node-zhihu-2', executor: 'insurance-zhihu', title: '创作知乎文章', description: '根据分析结果创作知乎深度长文，遵循核心铁律和风格要求', styleKey: 'zhihu_write' },
    { id: 'node-zhihu-3', executor: 'deai-optimizer', title: '去AI化优化', description: '对文章进行全维度自检和柔和改写，剔除AI机器腔、模板句式，让内容更自然、更像真人手写', styleKey: 'zhihu_deai' },
    { id: 'node-zhihu-4', executor: 'user_preview_edit', title: '用户预览修改初稿', description: '用户预览文章初稿，可修改调整或直接确认继续。此节点由用户操作，非Agent执行', styleKey: 'zhihu_preview' },
    { id: 'node-zhihu-5', executor: 'T', title: '合规校验', description: '对文章进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'zhihu_check' },
    { id: 'node-zhihu-6', executor: 'T', title: '生成预览图', description: '生成知乎文章预览图，供用户手动发布使用', styleKey: 'zhihu_write' },
    { id: 'node-zhihu-7', executor: 'B', title: '最终审核确认', description: '审核文章质量、合规性，确认是否可以正式发布', styleKey: 'zhihu_check' },
  ]
);

/**
 * 头条/抖音默认流程模板（7步）
 * 
 * 特点：
 * - insurance-toutiao 创作信息流文章
 * - deai-optimizer 去AI化优化
 * - 用户预览修改初稿（可跳过）
 * - Agent T 执行合规校验
 * - Agent B 最终审核确认
 */
export const TOUTIAO_FLOW_TEMPLATE = createFlowTemplate(
  'toutiao-default',
  'douyin',
  '今日头条/抖音',
  '头条文章创作流程',
  [
    { id: 'node-toutiao-1', executor: 'B', title: '分析任务需求', description: '分析用户指令，提取核心观点、关键素材、目标受众，规划头条文章创作方向', styleKey: 'toutiao_user' },
    { id: 'node-toutiao-2', executor: 'insurance-toutiao', title: '创作头条文章', description: '根据分析结果创作头条信息流文章，遵循核心铁律和风格要求', styleKey: 'toutiao_write' },
    { id: 'node-toutiao-3', executor: 'deai-optimizer', title: '去AI化优化', description: '对文章进行全维度自检和柔和改写，剔除AI机器腔、模板句式，让内容更自然、更像真人手写', styleKey: 'toutiao_deai' },
    { id: 'node-toutiao-4', executor: 'user_preview_edit', title: '用户预览修改初稿', description: '用户预览文章初稿，可修改调整或直接确认继续。此节点由用户操作，非Agent执行', styleKey: 'toutiao_preview' },
    { id: 'node-toutiao-5', executor: 'T', title: '合规校验', description: '对文章进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'toutiao_check' },
    { id: 'node-toutiao-6', executor: 'T', title: '生成预览图', description: '生成头条文章预览图，供用户手动发布使用', styleKey: 'toutiao_write' },
    { id: 'node-toutiao-7', executor: 'B', title: '最终审核确认', description: '审核文章质量、合规性，确认是否可以正式发布', styleKey: 'toutiao_check' },
  ]
);

// ============ 虚拟执行器常量 ============

/**
 * 用户预览修改节点的执行器标识
 * 
 * 该节点不是真实 Agent，不会调用 LLM。
 * 执行引擎遇到此标识时，直接将任务设为 waiting_user 状态，
 * 等待用户在前端预览/修改后通过 user-decision API 确认。
 */
export const USER_PREVIEW_EDIT_EXECUTOR = 'user_preview_edit';

/**
 * AI评审节点的执行器标识
 * 
 * 该节点是真实 Agent（outline-writer），但以"评审者"角色调用。
 * 执行引擎遇到此标识时，将文章内容 + 评审指令发给 outline-writer，
 * 让它以通用大模型视角评审文章质量，给出修改建议或确认通过。
 */
export const AI_REVIEW_EXECUTOR = 'ai_review';

/**
 * 判断执行器是否为用户交互节点（虚拟执行器）
 */
export function isVirtualExecutor(executor: string | undefined | null): boolean {
  if (!executor) return false;
  return executor === USER_PREVIEW_EDIT_EXECUTOR || executor === AI_REVIEW_EXECUTOR;
}

/**
 * 判断执行器是否为AI评审节点
 */
export function isAiReviewExecutor(executor: string | undefined | null): boolean {
  if (!executor) return false;
  return executor === AI_REVIEW_EXECUTOR;
}

// ============ 大纲创作模式流程模板 ============

/**
 * 大纲创作模式：用户提供文章大纲，outline-writer（通用大模型）按大纲创作高质量文章
 *
 * 🔥 核心设计原则：
 * 1. 模拟"豆包"式交互体验——用户给大纲+选专家，就能得到符合心意的文章
 * 2. outline-writer 严格按照用户大纲结构创作，不擅自改变思路和方向
 * 3. 预览修改环节支持素材替换（案例/数据/观点可从素材库选取替换）
 * 4. AI评审环节：由 outline-writer 以通用大模型视角评审文章质量
 * 5. 评审发现问题 → outline-writer 修改 → 回到预览 → 再次评审（循环）
 * 6. 用户确认通过 → 合规校验 → 上传
 *
 * 与AI创作模式对比：
 * - AI创作：  分析→撰写→去AI化→预览修改→合规校验→合规整改→上传（7步）
 * - 大纲创作：写作→预览修改(素材替换)→AI评审→预览修改→合规校验→合规整改→上传（7步）
 *
 * 区别：
 * 1. 大纲创作不需要Agent B分析需求（用户已给出大纲，需求已明确）
 * 2. 不需要去AI化（outline-writer 模拟通用大模型自然写作风格）
 * 3. 增加AI评审环节（通用大模型评审→修改，提升文章质量）
 * 4. 预览修改环节支持素材替换
 */

/**
 * 微信公众号大纲创作流程（7步）
 * 写作(outline-writer) → 预览修改(素材替换) → AI评审 → 预览修改 → 合规校验 → 合规整改 → 上传
 */
export const WECHAT_OUTLINE_CREATION_TEMPLATE = createFlowTemplate(
  'wechat-outline-creation',
  'wechat_official',
  '微信公众号',
  '公众号大纲创作流程',
  [
    { id: 'node-ow-wechat-1', executor: 'outline-writer', title: '依据大纲创作文章', description: '严格按照用户提供的大纲结构和思路，创作完整的公众号文章（HTML格式）', styleKey: 'ow_write' },
    { id: 'node-ow-wechat-2', executor: 'user_preview_edit', title: '用户预览修改初稿', description: '用户预览初稿，可修改调整、替换素材（案例/数据/观点），或直接确认继续', styleKey: 'ow_preview' },
    { id: 'node-ow-wechat-3', executor: 'ai_review', title: 'AI评审文章', description: '通用大模型以读者视角评审文章质量，检查逻辑/结构/表达，给出修改建议或确认通过', styleKey: 'ow_review' },
    { id: 'node-ow-wechat-4', executor: 'user_preview_edit', title: '用户确认修改稿', description: '用户审阅AI评审修改后的文章，可继续修改或确认通过', styleKey: 'ow_preview' },
    { id: 'node-ow-wechat-5', executor: 'T', title: '合规校验', description: '对文章进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'ow_check' },
    { id: 'node-ow-wechat-6', executor: 'outline-writer', title: '完成合规整改', description: '依据合规校验结果，完成文章整改（修改违规内容、调整表述）', styleKey: 'ow_fix' },
    { id: 'node-ow-wechat-7', executor: 'T', title: '上传公众号草稿箱', description: '将文章上传至公众号草稿箱，配置原创声明、赞赏等设置', styleKey: 'ow_upload' },
  ]
);

/**
 * 小红书大纲创作流程（7步）
 * 写作(outline-writer) → 预览修改(素材替换) → AI评审 → 预览修改 → 合规校验 → 合规整改 → 预览终稿
 */
export const XIAOHONGSHU_OUTLINE_CREATION_TEMPLATE = createFlowTemplate(
  'xiaohongshu-outline-creation',
  'xiaohongshu',
  '小红书',
  '小红书大纲创作流程',
  [
    { id: 'node-ow-xhs-1', executor: 'outline-writer', title: '依据大纲创作图文', description: '严格按照用户提供的大纲结构和思路，创作小红书图文内容（JSON格式）', styleKey: 'ow_write' },
    { id: 'node-ow-xhs-2', executor: 'user_preview_edit', title: '用户预览修改图文', description: '用户预览小红书图文初稿，可修改标题/要点/正文/标签、替换素材，或直接确认继续', styleKey: 'ow_preview' },
    { id: 'node-ow-xhs-3', executor: 'ai_review', title: 'AI评审图文', description: '通用大模型以读者视角评审图文质量，给出修改建议或确认通过', styleKey: 'ow_review' },
    { id: 'node-ow-xhs-4', executor: 'user_preview_edit', title: '用户确认修改稿', description: '用户审阅AI评审修改后的图文，可继续修改或确认通过', styleKey: 'ow_preview' },
    { id: 'node-ow-xhs-5', executor: 'T', title: '合规校验', description: '对小红书图文进行合规性校验', styleKey: 'ow_check' },
    { id: 'node-ow-xhs-6', executor: 'outline-writer', title: '完成合规整改', description: '依据合规校验结果，完成小红书图文整改', styleKey: 'ow_fix' },
    { id: 'node-ow-xhs-7', executor: 'user_preview_edit', title: '用户预览终稿', description: '合规整改后的终稿确认，用户审阅最终图文内容', styleKey: 'ow_preview' },
  ]
);

/**
 * 知乎大纲创作流程（7步）
 */
export const ZHIHU_OUTLINE_CREATION_TEMPLATE = createFlowTemplate(
  'zhihu-outline-creation',
  'zhihu',
  '知乎',
  '知乎大纲创作流程',
  [
    { id: 'node-ow-zhihu-1', executor: 'outline-writer', title: '依据大纲创作文章', description: '严格按照用户提供的大纲结构和思路，创作知乎深度长文', styleKey: 'ow_write' },
    { id: 'node-ow-zhihu-2', executor: 'user_preview_edit', title: '用户预览修改初稿', description: '用户预览初稿，可修改调整、替换素材，或直接确认继续', styleKey: 'ow_preview' },
    { id: 'node-ow-zhihu-3', executor: 'ai_review', title: 'AI评审文章', description: '通用大模型以读者视角评审文章质量，给出修改建议或确认通过', styleKey: 'ow_review' },
    { id: 'node-ow-zhihu-4', executor: 'user_preview_edit', title: '用户确认修改稿', description: '用户审阅AI评审修改后的文章，可继续修改或确认通过', styleKey: 'ow_preview' },
    { id: 'node-ow-zhihu-5', executor: 'T', title: '合规校验', description: '对文章进行合规性校验', styleKey: 'ow_check' },
    { id: 'node-ow-zhihu-6', executor: 'outline-writer', title: '完成合规整改', description: '依据合规校验结果，完成文章整改', styleKey: 'ow_fix' },
    { id: 'node-ow-zhihu-7', executor: 'T', title: '生成预览图', description: '生成知乎文章预览图，供用户手动发布使用', styleKey: 'ow_upload' },
  ]
);

/**
 * 头条/抖音大纲创作流程（7步）
 */
export const TOUTIAO_OUTLINE_CREATION_TEMPLATE = createFlowTemplate(
  'toutiao-outline-creation',
  'douyin',
  '今日头条/抖音',
  '头条大纲创作流程',
  [
    { id: 'node-ow-toutiao-1', executor: 'outline-writer', title: '依据大纲创作文章', description: '严格按照用户提供的大纲结构和思路，创作头条信息流文章', styleKey: 'ow_write' },
    { id: 'node-ow-toutiao-2', executor: 'user_preview_edit', title: '用户预览修改初稿', description: '用户预览初稿，可修改调整、替换素材，或直接确认继续', styleKey: 'ow_preview' },
    { id: 'node-ow-toutiao-3', executor: 'ai_review', title: 'AI评审文章', description: '通用大模型以读者视角评审文章质量，给出修改建议或确认通过', styleKey: 'ow_review' },
    { id: 'node-ow-toutiao-4', executor: 'user_preview_edit', title: '用户确认修改稿', description: '用户审阅AI评审修改后的文章，可继续修改或确认通过', styleKey: 'ow_preview' },
    { id: 'node-ow-toutiao-5', executor: 'T', title: '合规校验', description: '对文章进行合规性校验', styleKey: 'ow_check' },
    { id: 'node-ow-toutiao-6', executor: 'outline-writer', title: '完成合规整改', description: '依据合规校验结果，完成文章整改', styleKey: 'ow_fix' },
    { id: 'node-ow-toutiao-7', executor: 'T', title: '生成预览图', description: '生成头条文章预览图，供用户手动发布使用', styleKey: 'ow_upload' },
  ]
);

/**
 * 大纲创作模式 - 平台流程映射
 */
export const OUTLINE_CREATION_FLOW_MAP: Record<string, FlowTemplate> = {
  wechat_official: WECHAT_OUTLINE_CREATION_TEMPLATE,
  xiaohongshu: XIAOHONGSHU_OUTLINE_CREATION_TEMPLATE,
  zhihu: ZHIHU_OUTLINE_CREATION_TEMPLATE,
  douyin: TOUTIAO_OUTLINE_CREATION_TEMPLATE,
  weibo: TOUTIAO_OUTLINE_CREATION_TEMPLATE, // 微博复用头条模板
};

/**
 * 根据平台获取大纲创作流程模板
 */
export function getOutlineCreationTemplate(platform: string): FlowTemplate {
  return OUTLINE_CREATION_FLOW_MAP[platform] || WECHAT_OUTLINE_CREATION_TEMPLATE;
}

/**
 * 获取大纲创作模式的适配步骤（4步）
 * 步骤：适配改写 → 预览修改 → AI评审 → 预览修改
 * 与AI创作的适配步骤不同：包含AI评审环节，不含去AI化
 */
export function getOutlineCreationAdaptationSteps(platform: string): Array<{
  executor: string;
  title: string;
  description: string;
  styleKey: keyof typeof ADAPTATION_NODE_STYLES | 'ow_review' | 'ow_preview';
}> {
  const platformLabel = {
    xiaohongshu: '小红书',
    zhihu: '知乎',
    douyin: '头条/抖音',
    weibo: '微博',
  }[platform] || platform;

  return [
    {
      executor: 'outline-writer',
      title: `适配${platformLabel}版本`,
      description: `基于基础文章内容，适配改写为${platformLabel}平台风格和格式`,
      styleKey: 'adapt_write',
    },
    {
      executor: 'user_preview_edit',
      title: `预览修改${platformLabel}版本`,
      description: `用户预览${platformLabel}版本，可修改或直接确认`,
      styleKey: 'adapt_preview',
    },
    {
      executor: 'ai_review',
      title: `AI评审${platformLabel}版本`,
      description: `通用大模型评审${platformLabel}版本质量，给出修改建议或确认通过`,
      styleKey: 'ow_review',
    },
    {
      executor: 'user_preview_edit',
      title: `确认${platformLabel}版本`,
      description: `用户审阅AI评审修改后的${platformLabel}版本，可继续修改或确认通过`,
      styleKey: 'adapt_preview',
    },
  ];
}

// ============ 直接发文模式流程模板 ============

/**
 * 直接发文模式：用户提供完整文章，由写作Agent格式化为平台标准格式，再走完整的预览/校验/上传流程
 *
 * 🔥 核心设计原则：
 * 1. 直接发文必须完全复用AI创作的格式化能力——用户通过系统发文的核心价值：
 *    a) 系统有发布到各平台的样式（公众号HTML排版、小红书图文卡片等）
 *    b) 能够直接发到对应的多个平台
 * 2. 写作Agent参与"格式化"而非"创作"——将用户文章转为平台标准格式
 * 3. 预览节点使用 ArticlePreviewEditor（与AI创作完全一致的预览体验）
 * 4. step_history 记录格式与AI创作一致
 *
 * 与AI创作模式对比：
 * - AI创作：  分析→撰写→预览修改→合规校验→合规整改→上传（6步）
 * - 直接发文：格式化→预览修改→合规校验→合规整改→上传（5步）
 *
 * 区别仅在于：AI创作的前两步（分析+撰写）被替换为一步（格式化），
 * 后续的预览/校验/整改/上传完全一致。
 */

/**
 * 微信公众号直接发文流程（5步）
 * 格式化(insurance-d) → 预览修改 → 合规校验 → 合规整改 → 上传
 * 
 * 设计说明：第1步由写作Agent自动将用户文章格式化为公众号标准HTML，无需用户确认；
 * 第2步预览修改环节让用户确认格式化后的效果
 */
export const WECHAT_DIRECT_PUBLISH_TEMPLATE = createFlowTemplate(
  'wechat-direct-publish',
  'wechat_official',
  '微信公众号',
  '公众号文章直接发布流程',
  [
    { id: 'node-dp-wechat-1', executor: 'insurance-d', title: '格式化文章', description: '将用户文章格式化为公众号标准HTML排版（自动执行，无需确认）', styleKey: 'wechat_write' },
    { id: 'node-dp-wechat-2', executor: 'user_preview_edit', title: '预览修改文章', description: '用户预览格式化后的公众号文章，可修改调整或直接确认继续', styleKey: 'dp_preview' },
    { id: 'node-dp-wechat-3', executor: 'T', title: '合规校验', description: '对文章进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'dp_check' },
    { id: 'node-dp-wechat-4', executor: 'insurance-d', title: '完成合规整改', description: '依据合规校验结果，完成文章整改（修改违规内容、调整表述）', styleKey: 'dp_fix' },
    { id: 'node-dp-wechat-5', executor: 'T', title: '上传公众号草稿箱', description: '将文章上传至公众号草稿箱，配置原创声明、赞赏等设置', styleKey: 'dp_upload' },
  ]
);

/**
 * 小红书直接发文流程（5步）
 * 格式化(insurance-xiaohongshu) → 预览修改 → 合规校验 → 合规整改 → 预览终稿
 * 
 * 设计说明：第1步由写作Agent自动将用户文章格式化为小红书标准JSON结构，无需用户确认；
 * 第2步预览修改环节让用户确认格式化后的效果
 */
export const XIAOHONGSHU_DIRECT_PUBLISH_TEMPLATE = createFlowTemplate(
  'xiaohongshu-direct-publish',
  'xiaohongshu',
  '小红书',
  '小红书图文直接发布流程',
  [
    { id: 'node-dp-xhs-1', executor: 'insurance-xiaohongshu', title: '格式化图文', description: '将用户文章格式化为小红书标准JSON结构（自动执行，无需确认）', styleKey: 'dp_xhs_format' },
    { id: 'node-dp-xhs-2', executor: 'user_preview_edit', title: '预览修改图文', description: '用户预览格式化后的小红书图文内容，可修改标题/要点/正文/标签或直接确认继续', styleKey: 'dp_preview' },
    { id: 'node-dp-xhs-3', executor: 'T', title: '合规校验', description: '对小红书图文进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'dp_check' },
    { id: 'node-dp-xhs-4', executor: 'insurance-xiaohongshu', title: '完成合规整改', description: '依据合规校验结果，完成小红书图文整改', styleKey: 'dp_fix' },
    { id: 'node-dp-xhs-5', executor: 'user_preview_edit', title: '用户预览终稿', description: '合规整改后的终稿确认，用户审阅最终图文内容。此节点由用户操作，非Agent执行', styleKey: 'dp_preview' },
  ]
);

/**
 * 知乎直接发文流程（5步）
 * 格式化(insurance-zhihu) → 预览修改 → 合规校验 → 合规整改 → 生成预览图
 * 
 * 设计说明：第1步由写作Agent自动将用户文章格式化为知乎标准格式，无需用户确认；
 * 第2步预览修改环节让用户确认格式化后的效果
 */
export const ZHIHU_DIRECT_PUBLISH_TEMPLATE = createFlowTemplate(
  'zhihu-direct-publish',
  'zhihu',
  '知乎',
  '知乎文章直接发布流程',
  [
    { id: 'node-dp-zhihu-1', executor: 'insurance-zhihu', title: '格式化文章', description: '将用户文章格式化为知乎标准排版格式（自动执行，无需确认）', styleKey: 'dp_zhihu_format' },
    { id: 'node-dp-zhihu-2', executor: 'user_preview_edit', title: '预览修改文章', description: '用户预览格式化后的知乎文章，可修改调整或直接确认继续', styleKey: 'dp_preview' },
    { id: 'node-dp-zhihu-3', executor: 'T', title: '合规校验', description: '对文章进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'dp_check' },
    { id: 'node-dp-zhihu-4', executor: 'insurance-zhihu', title: '完成合规整改', description: '依据合规校验结果，完成文章整改（修改违规内容、调整表述）', styleKey: 'dp_fix' },
    { id: 'node-dp-zhihu-5', executor: 'T', title: '生成预览图', description: '生成知乎文章预览图，供用户手动发布使用', styleKey: 'dp_upload' },
  ]
);

/**
 * 头条/抖音直接发文流程（4步）
 * 预览修改(user_preview_edit) → 合规校验 → 合规整改 → 生成预览图
 * 
 * 设计说明：用户已提供完整文章，无需AI格式化，第1步直接让用户预览确认
 */
export const TOUTIAO_DIRECT_PUBLISH_TEMPLATE = createFlowTemplate(
  'toutiao-direct-publish',
  'douyin',
  '今日头条/抖音',
  '头条文章直接发布流程',
  [
    { id: 'node-dp-toutiao-1', executor: 'user_preview_edit', title: '预览修改文章', description: '用户预览自己提供的头条文章，可修改调整或直接确认继续', styleKey: 'dp_preview' },
    { id: 'node-dp-toutiao-2', executor: 'T', title: '合规校验', description: '对文章进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'dp_check' },
    { id: 'node-dp-toutiao-3', executor: 'insurance-toutiao', title: '完成合规整改', description: '依据合规校验结果，完成文章整改（修改违规内容、调整表述）', styleKey: 'dp_fix' },
    { id: 'node-dp-toutiao-4', executor: 'T', title: '生成预览图', description: '生成头条文章预览图，供用户手动发布使用', styleKey: 'dp_upload' },
  ]
);

/**
 * 直接发文模式 - 平台流程映射
 */
export const DIRECT_PUBLISH_FLOW_MAP: Record<string, FlowTemplate> = {
  wechat_official: WECHAT_DIRECT_PUBLISH_TEMPLATE,
  xiaohongshu: XIAOHONGSHU_DIRECT_PUBLISH_TEMPLATE,
  zhihu: ZHIHU_DIRECT_PUBLISH_TEMPLATE,
  douyin: TOUTIAO_DIRECT_PUBLISH_TEMPLATE,
  weibo: TOUTIAO_DIRECT_PUBLISH_TEMPLATE, // 微博复用头条模板
};

/**
 * 根据平台获取直接发文流程模板
 */
export function getDirectPublishTemplate(platform: string): FlowTemplate {
  return DIRECT_PUBLISH_FLOW_MAP[platform] || WECHAT_DIRECT_PUBLISH_TEMPLATE;
}

/**
 * 获取直接发文模式的适配步骤（3步）
 * 与AI创作模式的适配步骤相同，但不含格式化和去AI化节点（因为用户文章已经是真人写的）
 * 步骤：预览修改 → 合规校验 → 合规整改
 */
export function getDirectPublishAdaptationSteps(platform: string): Array<{
  executor: string;
  title: string;
  description: string;
  styleKey: keyof typeof ADAPTATION_NODE_STYLES;
}> {
  const executor = getExecutorForPlatform(platform);
  const platformLabel = {
    xiaohongshu: '小红书',
    zhihu: '知乎',
    douyin: '头条/抖音',
    weibo: '微博',
  }[platform] || platform;

  return [
    {
      executor: 'user_preview_edit',
      title: `预览修改${platformLabel}版本`,
      description: `用户预览自己提供的文章${platformLabel}版本，可修改或直接确认继续`,
      styleKey: 'adapt_preview',
    },
    {
      executor: 'T',
      title: '合规校验',
      description: `对${platformLabel}版本进行合规性校验`,
      styleKey: 'adapt_check',
    },
    {
      executor,
      title: `完成合规整改`,
      description: `依据合规校验结果，完成${platformLabel}版本整改`,
      styleKey: 'adapt_write',
    },
  ];
}

// ============ 多平台协同流程模板（两阶段架构） ============

/**
 * 多平台协同流程 - 阶段定义
 *
 * 阶段1（base_article）：先在公众号平台打磨一篇基础文章
 * 阶段2（platform_adaptation）：基于基础文章适配到其他平台
 *
 * 核心设计：
 * - 基础文章组：使用公众号流程模板（7步），全部 pending
 * - 适配组：每个非公众号平台一组（4步），初始状态 blocked
 * - 定稿触发点：基础文章组 order_index=6（合规整改完成）
 * - 解锁后适配组 blocked → pending，引擎自动执行
 */

/**
 * 适配阶段节点的额外样式
 */
const ADAPTATION_NODE_STYLES = {
  adapt_write: { icon: '🔄', color: 'from-indigo-500 to-purple-600' },
  adapt_deai: { icon: '✨', color: 'from-cyan-500 to-teal-600' },
  adapt_preview: { icon: '👁️', color: 'from-purple-500 to-violet-600' },
  adapt_check: { icon: '✅', color: 'from-amber-500 to-orange-600' },
} as const;

/**
 * 获取平台的适配流程步骤（4步精简版）
 *
 * 适配流程不包含"分析任务需求"和"合规整改"节点：
 * - 分析需求已在基础文章阶段完成
 * - 合规整改由各平台写作Agent自行处理（适配即整改）
 *
 * @param platform 目标平台
 * @returns 适配流程的步骤配置
 */
export function getAdaptationSteps(platform: string): Array<{
  executor: string;
  title: string;
  description: string;
  // P2-6 修复：使用精确类型而非 string，防止无效值
  styleKey: keyof typeof ADAPTATION_NODE_STYLES;
}> {
  const executor = getExecutorForPlatform(platform);
  const platformLabel = {
    xiaohongshu: '小红书',
    zhihu: '知乎',
    douyin: '头条/抖音',
    weibo: '微博',
  }[platform] || platform;

  return [
    {
      executor,
      title: `适配${platformLabel}版本`,
      description: `基于基础文章内容，适配改写为${platformLabel}平台风格和格式。必须基于基础文章改写，不得自行创作新内容`,
      styleKey: 'adapt_write',
    },
    {
      executor: 'deai-optimizer',
      title: '去AI化优化',
      description: `对${platformLabel}适配版本进行去AI化优化，确保内容自然流畅`,
      styleKey: 'adapt_deai',
    },
    {
      executor: 'user_preview_edit',
      title: `用户预览${platformLabel}版本`,
      description: `用户预览${platformLabel}适配版本，可修改或直接确认`,
      styleKey: 'adapt_preview',
    },
    {
      executor: 'T',
      title: '合规校验',
      description: `对${platformLabel}适配版本进行合规性校验`,
      styleKey: 'adapt_check',
    },
  ];
}

/**
 * 判断平台是否为基础文章平台（公众号）
 * 在多平台协同模式中，公众号是唯一的基础文章平台
 */
export function isBaseArticlePlatform(platform: string): boolean {
  return platform === 'wechat_official';
}

/**
 * 预查询的账号信息结构
 * 调用方应先批量查询账号信息，再传入此函数，避免 N+1 查询
 */
export interface AccountInfo {
  id: string;
  platform: string;
  platformLabel: string;
  accountName: string;
}

/**
 * 从账号列表中分离基础组和适配组
 *
 * 设计原则：调用方负责批量查询账号信息（1 次 DB 查询），
 * 本函数仅做内存分组，不再内部查询 DB，消除 N+1 问题。
 *
 * @param accounts 预查询的账号信息列表
 * @returns baseAccountId 和 adaptationAccountIds
 */
export function splitBaseAndAdaptationGroups(
  accounts: AccountInfo[]
): {
  baseAccountId: string | null;
  baseAccountInfo: { platform: string; platformLabel: string; accountName: string } | null;
  adaptationAccounts: Array<{ accountId: string; platform: string; platformLabel: string; accountName: string }>;
} {
  let baseAccountId: string | null = null;
  let baseAccountInfo: { platform: string; platformLabel: string; accountName: string } | null = null;
  const adaptationAccounts: Array<{ accountId: string; platform: string; platformLabel: string; accountName: string }> = [];

  for (const acc of accounts) {
    if (isBaseArticlePlatform(acc.platform) && !baseAccountId) {
      // 第一个公众号账号作为基础文章组
      baseAccountId = acc.id;
      baseAccountInfo = { platform: acc.platform, platformLabel: acc.platformLabel, accountName: acc.accountName };
    } else {
      // 其他账号作为适配组
      adaptationAccounts.push({ accountId: acc.id, platform: acc.platform, platformLabel: acc.platformLabel, accountName: acc.accountName });
    }
  }

  // 如果没有公众号账号，第一个账号作为基础文章组
  if (!baseAccountId && accounts.length > 0) {
    const first = accounts[0];
    baseAccountId = first.id;
    baseAccountInfo = { platform: first.platform, platformLabel: first.platformLabel, accountName: first.accountName };
    // 从适配组中移除
    const idx = adaptationAccounts.findIndex(a => a.accountId === first.id);
    if (idx >= 0) adaptationAccounts.splice(idx, 1);
  }

  return { baseAccountId, baseAccountInfo, adaptationAccounts };
}

// ============ 平台流程映射 ============

export const PLATFORM_FLOW_MAP: Record<string, FlowTemplate> = {
  wechat_official: WECHAT_OFFICIAL_FLOW_TEMPLATE,
  xiaohongshu: XIAOHONGSHU_FLOW_TEMPLATE,
  zhihu: ZHIHU_FLOW_TEMPLATE,
  douyin: TOUTIAO_FLOW_TEMPLATE,
  weibo: TOUTIAO_FLOW_TEMPLATE,   // 微博复用头条模板（短图文风格接近，执行 Agent 相同）
};

/**
 * 根据平台获取默认流程模板
 */
export function getFlowTemplate(platform: string): FlowTemplate {
  return PLATFORM_FLOW_MAP[platform] || WECHAT_OFFICIAL_FLOW_TEMPLATE;
}

/**
 * 获取所有流程模板
 */
export function getAllFlowTemplates(): FlowTemplate[] {
  return Object.values(PLATFORM_FLOW_MAP);
}

// ============ 节点管理工具函数 ============

/**
 * 生成唯一节点ID
 * 使用 substring 替代废弃的 substr
 */
export function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 删除节点并自动衔接
 * @param nodes 当前节点列表
 * @param nodeId 要删除的节点ID
 * @returns 删除后的节点列表（重新排序）
 */
export function deleteNodeAndAutoConnect(nodes: FlowNode[], nodeId: FlowNode['id']): FlowNode[] {
  const filteredNodes = nodes.filter(node => node.id !== nodeId);
  
  // 边界检查：至少保留一个节点
  if (filteredNodes.length === 0) {
    console.warn('[deleteNodeAndAutoConnect] Cannot delete the last node');
    return nodes;
  }
  
  // 重新排序 orderIndex
  return filteredNodes
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((node, index) => ({
      ...node,
      orderIndex: index + 1,
    }));
}

/**
 * 移动节点位置
 * @param nodes 当前节点列表
 * @param nodeId 要移动的节点ID
 * @param direction 移动方向：'up' | 'down'
 * @returns 移动后的节点列表
 */
export function moveNode(nodes: FlowNode[], nodeId: FlowNode['id'], direction: 'up' | 'down'): FlowNode[] {
  const nodeIndex = nodes.findIndex(node => node.id === nodeId);
  if (nodeIndex === -1) return nodes;

  const newNodes = [...nodes];
  const targetIndex = direction === 'up' ? nodeIndex - 1 : nodeIndex + 1;

  // 边界检查
  if (targetIndex < 0 || targetIndex >= nodes.length) return nodes;

  // 交换位置
  [newNodes[nodeIndex], newNodes[targetIndex]] = [newNodes[targetIndex], newNodes[nodeIndex]];

  // 重新排序 orderIndex
  return newNodes
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((node, index) => ({
      ...node,
      orderIndex: index + 1,
    }));
}

/**
 * 更新节点信息
 * @param nodes 当前节点列表
 * @param nodeId 要更新的节点ID
 * @param updates 更新内容
 * @returns 更新后的节点列表
 */
export function updateNode(
  nodes: FlowNode[],
  nodeId: FlowNode['id'],
  updates: Partial<Omit<FlowNode, 'id' | 'orderIndex'>>
): FlowNode[] {
  return nodes.map(node =>
    node.id === nodeId
      ? { ...node, ...updates }
      : node
  );
}

/**
 * 添加新节点
 * @param nodes 当前节点列表
 * @param newNode 新节点（orderIndex会自动分配）
 * @param options 可选配置
 * @returns 添加后的节点列表，或错误信息
 */
export function addNode(
  nodes: FlowNode[],
  newNode: Omit<FlowNode, 'orderIndex'>,
  options?: { maxNodes?: number }
): { nodes: FlowNode[]; error?: string } {
  const maxNodes = options?.maxNodes ?? 10;
  
  if (nodes.length >= maxNodes) {
    return { nodes, error: `节点数量不能超过${maxNodes}个` };
  }
  
  const orderIndex = nodes.length + 1;
  return { nodes: [...nodes, { ...newNode, orderIndex }] };
}

/**
 * 验证流程完整性
 * @param nodes 节点列表
 * @returns 验证结果
 */
export function validateFlow(nodes: FlowNode[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (nodes.length === 0) {
    errors.push('流程至少需要一个节点');
  }

  if (nodes.length > 10) {
    errors.push('流程节点数量不能超过10个');
  }

  nodes.forEach((node, index) => {
    if (!node.title || node.title.trim() === '') {
      errors.push(`节点 ${index + 1} 的标题不能为空`);
    }
    if (!node.executor || node.executor.trim() === '') {
      errors.push(`节点 ${index + 1} 的执行者不能为空`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 从 FlowNode[] 创建新的 FlowTemplate
 * 确保 steps 和 nodes 一致
 */
export function createFlowTemplateFromNodes(
  id: string,
  platform: string,
  platformLabel: string,
  name: string,
  nodes: FlowNode[]
): FlowTemplate {
  return {
    id,
    platform,
    platformLabel,
    name,
    nodes,
    steps: extractSteps(nodes),
    isDefault: false,
  };
}
