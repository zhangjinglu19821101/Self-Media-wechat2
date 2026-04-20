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
    { id: 'node-wechat-4', executor: 'user_preview_edit', title: '预览修改初稿', description: '预览文章初稿，可进行修改调整或直接确认继续（修改后版本将用于合规校验）', styleKey: 'wechat_preview' },
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
    { id: 'node-xhs-4', executor: 'user_preview_edit', title: '预览修改图文', description: '预览小红书图文初稿，可修改标题/要点/正文/标签或直接确认继续', styleKey: 'xiaohongshu_preview' },
    { id: 'node-xhs-5', executor: 'T', title: '合规校验', description: '对小红书图文进行合规性校验，检查是否包含绝对化用语、虚假承诺、违规营销等内容', styleKey: 'xiaohongshu_check' },
    { id: 'node-xhs-6', executor: 'insurance-xiaohongshu', title: '完成合规整改', description: '依据合规校验结果，完成小红书图文整改', styleKey: 'xiaohongshu_polish' },
    { id: 'node-xhs-7', executor: 'B', title: '生成预览图', description: '生成小红书图文预览图，供用户手动发布使用', styleKey: 'xiaohongshu_check' },
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
    { id: 'node-zhihu-4', executor: 'user_preview_edit', title: '预览修改初稿', description: '预览文章初稿，可进行修改调整或直接确认继续', styleKey: 'zhihu_preview' },
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
    { id: 'node-toutiao-4', executor: 'user_preview_edit', title: '预览修改初稿', description: '预览文章初稿，可进行修改调整或直接确认继续', styleKey: 'toutiao_preview' },
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
 * 判断执行器是否为用户交互节点（虚拟执行器）
 */
export function isVirtualExecutor(executor: string | undefined | null): boolean {
  if (!executor) return false;
  return executor === USER_PREVIEW_EDIT_EXECUTOR;
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
