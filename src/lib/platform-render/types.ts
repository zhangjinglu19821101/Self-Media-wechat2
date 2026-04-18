/**
 * 平台渲染数据类型定义
 * 
 * 设计原则：
 * 1. result_text 是通用纯文本，不与任何平台渲染耦合
 * 2. 每个平台有独立的渲染数据结构，定义"每张卡片/每个区域放什么内容"
 * 3. 执行 Agent 输出信封格式 → 提取器从中提取平台渲染数据 → 前端按结构渲染
 * 4. 新增平台只需在此文件添加类型 + 在 extractors.ts 添加提取逻辑
 */

// ============ 通用类型 ============

/** 平台类型 */
export type PlatformType = 'wechat_official' | 'xiaohongshu' | 'zhihu' | 'douyin' | 'weibo';

/** 平台渲染数据基类 */
export interface BasePlatformRenderData {
  platform: PlatformType;
}

// ============ 小红书渲染数据 ============

/** 小红书卡片数量模式 */
export type XhsCardCountMode = '3-card' | '5-card' | '7-card';

/** 小红书封面卡 */
export interface XhsCoverCard {
  type: 'cover';
  title: string;       // 封面标题（≤20字，悬念/反差感）
  subtitle?: string;   // 副标题/引言（≤30字）
}

/** 小红书要点卡 */
export interface XhsPointCard {
  type: 'point';
  title: string;       // 要点标题（≤15字，渲染到图片卡片上）
  content: string;     // 要点详细内容（≤80字，文字区展开）
}

/** 小红书结尾卡 */
export interface XhsEndingCard {
  type: 'ending';
  conclusion: string;  // 总结语（≤50字）
  tags?: string[];     // 话题标签（3-5个，不带#号）
}

/** 小红书卡片联合类型 */
export type XhsCard = XhsCoverCard | XhsPointCard | XhsEndingCard;

/**
 * 小红书渲染数据
 * 
 * 3卡模式：封面 + 1个要点 + 结尾
 * 5卡模式：封面 + 3个要点 + 结尾
 * 7卡模式：封面 + 5个要点 + 结尾
 */
export interface XhsPlatformRenderData extends BasePlatformRenderData {
  platform: 'xiaohongshu';
  cardCountMode: XhsCardCountMode;
  
  /** 按顺序排列的卡片数组（封面→要点1→要点2→...→结尾） */
  cards: XhsCard[];
  
  /** 正文（文字区，与卡片分开） */
  textContent: string;
  
  /** 文章标题（≤15字，用于任务列表展示） */
  articleTitle: string;
}

// ============ 公众号渲染数据 ============

/**
 * 公众号渲染数据
 * 
 * 公众号是 HTML 格式，渲染数据比较简单
 */
export interface WechatPlatformRenderData extends BasePlatformRenderData {
  platform: 'wechat_official';
  
  /** HTML 格式文章内容 */
  htmlContent: string;
  
  /** 文章标题 */
  articleTitle: string;
}

// ============ 知乎渲染数据 ============

/**
 * 知乎渲染数据
 * 
 * 知乎是纯文本格式，侧重深度专业
 */
export interface ZhihuPlatformRenderData extends BasePlatformRenderData {
  platform: 'zhihu';
  
  /** 纯文本文章内容 */
  textContent: string;
  
  /** 文章标题 */
  articleTitle: string;
}

// ============ 头条/抖音渲染数据 ============

/**
 * 头条/抖音渲染数据
 * 
 * 信息流风格短图文
 */
export interface ToutiaoPlatformRenderData extends BasePlatformRenderData {
  platform: 'douyin';
  
  /** 纯文本文章内容 */
  textContent: string;
  
  /** 文章标题 */
  articleTitle: string;
}

// ============ 联合类型 ============

/** 所有平台渲染数据的联合类型 */
export type PlatformRenderData = 
  | XhsPlatformRenderData 
  | WechatPlatformRenderData 
  | ZhihuPlatformRenderData 
  | ToutiaoPlatformRenderData;

// ============ 卡片数量模式常量 ============

/** 小红书卡片数量模式与要点数的映射 */
export const XHS_CARD_MODE_POINT_COUNT: Record<XhsCardCountMode, number> = {
  '3-card': 1,  // 封面 + 1个要点 + 结尾
  '5-card': 3,  // 封面 + 3个要点 + 结尾
  '7-card': 5,  // 封面 + 5个要点 + 结尾
};

// ============ 内容模板与渲染数据关联 ============

/**
 * 内容模板定义数据结构
 * 
 * 核心原则：模板 ID = 数据结构定义
 * - 模板决定了执行 Agent 的输出结构（如小红书 3/5/7 卡片数量）
 * - 模板决定了存储方式（result_text 保持纯文本，渲染数据独立提取）
 * - 模板决定了渲染方案（前端按模板对应的卡片数量渲染）
 */
export interface ContentTemplateRenderConfig {
  /** 内容模板 ID */
  contentTemplateId: string;
  /** 模板名称（如 "5卡-详尽风"） */
  templateName: string;
  /** 卡片数量模式（仅小红书有效） */
  cardCountMode?: XhsCardCountMode;
  /** 渲染提示指令（从内容模板读取，影响 Agent 输出结构） */
  promptInstruction?: string;
}

/**
 * 根据内容模板和平台确定渲染数据结构
 * 
 * 用法：前端调用此函数获取当前平台需要的渲染配置，
 * 然后根据配置渲染对应数量的卡片。
 */
export function getRenderConfigFromTemplate(
  contentTemplateId: string | undefined | null,
  platform: PlatformType,
  metadata?: Record<string, unknown>
): ContentTemplateRenderConfig | null {
  if (!contentTemplateId) {
    // 没有内容模板时，从 metadata 推导兜底
    if (platform === 'xiaohongshu') {
      const imageCountMode = metadata?.imageCountMode as XhsCardCountMode | undefined;
      if (imageCountMode) {
        return {
          contentTemplateId: '',
          templateName: '默认',
          cardCountMode: imageCountMode,
        };
      }
    }
    return null;
  }

  // 有内容模板时，返回配置
  // 注意：cardCountMode 的具体值在运行时从数据库读取
  return {
    contentTemplateId,
    templateName: '',  // 运行时填充
  };
}

/** 根据要点数量推导卡片数量模式 */
export function inferXhsCardCountMode(pointsCount: number): XhsCardCountMode {
  if (pointsCount <= 1) return '3-card';
  if (pointsCount <= 3) return '5-card';
  return '7-card';
}

/**
 * 根据卡片数量模式推导要点数量
 * 这是反向推导，用于在内容模板缺失时确定渲染方案
 */
export function getExpectedPointsCount(cardCountMode: XhsCardCountMode): number {
  return XHS_CARD_MODE_POINT_COUNT[cardCountMode];
}
