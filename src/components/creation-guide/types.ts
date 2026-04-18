/**
 * 创作引导类型定义 - 统一版本
 * 
 * 所有组件统一从此文件导入类型，禁止在组件内重复定义
 */

// ========== 文章结构模板类型 ==========

/**
 * 结构段落类型
 */
export interface StructureSection {
  id: string;
  name: string;
  description: string;
  suggestedWordCount: number;
  requirements: string[];
}

/**
 * 文章结构模板类型
 */
export interface StructureTemplate {
  id: string;
  name: string;
  description: string;
  sections: StructureSection[];
  isFixed?: boolean;
  isUserExclusive?: boolean;
  totalSuggestedWordCount?: number;
}

/**
 * 结构选择器组件 Props
 */
export interface StructureSelectorProps {
  selectedStructure: StructureTemplate;
  onStructureChange: (structure: StructureTemplate) => void;
}

// ========== 流程节点类型 ==========

/**
 * 流程步骤基础类型（兼容旧代码）
 * 包含执行流程所需的核心字段
 */
export interface FlowStep {
  orderIndex: number;
  executor: string;
  title: string;
  description: string;
}

/**
 * 流程节点类型（扩展自 FlowStep）
 * 包含 UI 展示所需的额外字段
 */
export interface FlowNode extends FlowStep {
  id: string;
  icon?: string;
  color?: string;
}

/**
 * 节点样式配置
 */
export interface NodeStyleConfig {
  icon: string;
  color: string;
}

/**
 * 流程模板类型
 * @property steps - 流程步骤（兼容旧代码，由 nodes 派生）
 * @property nodes - 流程节点（完整数据）
 */
export interface FlowTemplate {
  id: string;
  platform: string;
  platformLabel: string;
  name: string;
  nodes: FlowNode[];
  /** 兼容旧代码，由 nodes 派生，请勿直接修改 */
  steps: FlowStep[];
  isDefault?: boolean;
}

// ========== 核心锚点类型 ==========

export interface CoreAnchor {
  id: string;
  content: string;
  type: 'viewpoint' | 'conclusion' | 'question' | 'call_to_action';
  createdAt: Date;
  updatedAt: Date;
}

// ========== 情感基调类型 ==========

export type EmotionTone = '理性客观' | '踩坑警醒' | '温情共情' | '专业权威';

export interface EmotionToneOption {
  value: EmotionTone;
  label: string;
  icon: string;
  desc: string;
}

// ========== 素材类型 ==========

export interface Material {
  id: string;
  title: string;
  content: string;
  type: 'case' | 'data' | 'story' | 'quote' | 'opening' | 'ending';
  topicTags: string[];
  sceneTags: string[];
  emotionTags: string[];
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ========== 工具函数类型 ==========

/**
 * 从 FlowNode 提取 FlowStep
 */
export function extractStep(node: FlowNode): FlowStep {
  const { id, icon, color, ...step } = node;
  return step;
}

/**
 * 从 FlowNode[] 生成 FlowStep[]
 */
export function extractSteps(nodes: FlowNode[]): FlowStep[] {
  return nodes.map(extractStep);
}

/**
 * 创建 FlowNode（自动生成 ID）
 */
export function createFlowNode(
  step: Omit<FlowStep, 'orderIndex'>,
  style: NodeStyleConfig,
  orderIndex: number
): FlowNode {
  return {
    id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    ...step,
    orderIndex,
    ...style,
  };
}

// ========== 创作引导核心数据类型 ==========

/**
 * 核心锚点数据
 */
export interface CoreAnchorData {
  openingCase: string;      // 开头案例
  coreViewpoint: string;    // 核心观点
  endingConclusion: string; // 结尾总结
}

/**
 * 素材数据
 */
export interface MaterialData {
  relatedMaterials: string;  // 关联素材
  keyMaterials: string;      // 关键素材
}

/**
 * 创作控制数据
 */
export interface CreationControlData {
  targetWordCount: number;   // 目标字数
  writingStyle: string;      // 写作风格
  tone: string;              // 语气
}

// ========== 默认值 ==========

/**
 * 核心锚点数据默认值
 */
export const DEFAULT_CORE_ANCHOR_DATA: CoreAnchorData = {
  openingCase: '',
  coreViewpoint: '',
  endingConclusion: ''
};

/**
 * 素材数据默认值
 */
export const DEFAULT_MATERIAL_DATA: MaterialData = {
  relatedMaterials: '',
  keyMaterials: ''
};

/**
 * 创作控制数据默认值
 */
export const DEFAULT_CREATION_CONTROL_DATA: CreationControlData = {
  targetWordCount: 2000,
  writingStyle: '专业严谨',
  tone: '理性客观'
};

// ========== 字数范围常量 ==========

/**
 * 核心锚点各字段的字数范围
 */
export const WORD_COUNT_RANGES = {
  openingCase: { min: 50, max: 200 },
  coreViewpoint: { min: 30, max: 100 },
  endingConclusion: { min: 30, max: 100 }
} as const;

// ========== 验证结果类型 ==========

/**
 * 验证结果类型
 */
export interface ValidationResult {
  valid: boolean;
  current: number;
  message?: string;
}
