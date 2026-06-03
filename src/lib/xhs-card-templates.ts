/**
 * 小红书卡片模板系统
 * 
 * 设计原则：
 * 1. 可扩展：新增模板只需在 XHS_CARD_TEMPLATES 数组中添加一条配置
 * 2. 用户独立：用户选择存储在 platform_accounts.metadata.cardTemplateId
 * 3. 前后端统一：前端预览和后端生成共用同一套模板定义
 */

// ============ 类型定义 ============

/** 卡片背景类型 */
export type CardBgType = 'gradient' | 'solid' | 'pattern';

/** 文字对齐方式 */
export type TextAlign = 'left' | 'center';

/** 要点卡片布局 */
export type PointLayout = 'icon_title_content' | 'number_title_content' | 'emoji_title_content' | 'title_content_side';

/** 装饰元素 */
export type DecorationType = 'none' | 'dots' | 'lines' | 'corner' | 'wave';

/** 圆角大小 */
export type BorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

/** 单个颜色方案 */
export interface ColorScheme {
  from: string;
  to: string;
}

/** 卡片模板定义 */
export interface XhsCardTemplate {
  /** 模板唯一ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description: string;
  /** 预览缩略图（用于前端选择器展示） */
  thumbnail: {
    background: string; // CSS background 值
    textColor: string;
    accentColor: string;
  };
  
  // ---- 封面卡样式 ----
  cover: {
    bgType: CardBgType;
    colors: ColorScheme[];        // 渐变色列表，封面使用第一个
    textColor: string;            // 主文字颜色
    subtitleColor: string;        // 副文字颜色
    textAlign: TextAlign;
    borderRadius: BorderRadius;
    decoration: DecorationType;
    emoji?: string;               // 装饰 emoji（当 decoration=emoji 时使用）
    showTagline: boolean;         // 是否显示底部标语（如"小红书"标识）
    fontSize: { title: string; subtitle: string };
    padding: string;
  };
  
  // ---- 要点卡样式 ----
  point: {
    bgType: CardBgType;
    colors: ColorScheme[];        // 渐变色列表，要点卡片轮流使用
    textColor: string;
    titleColor: string;           // 要点标题颜色（可不同于正文）
    numberColor: string;          // 序号颜色
    layout: PointLayout;
    borderRadius: BorderRadius;
    decoration: DecorationType;
    emoji?: string;               // 装饰 emoji（当 decoration=emoji 时使用）
    showNumber: boolean;          // 是否显示序号
    numberStyle: 'circle' | 'square' | 'badge' | 'plain';
    fontSize: { title: string; content: string; number: string };
    padding: string;
    contentMaxHeight: number;     // 正文最大高度(px)，0表示不限制
  };
  
  // ---- 结尾卡样式 ----
  conclusion: {
    bgType: CardBgType;
    colors: ColorScheme[];
    textColor: string;
    tagBgColor: string;           // 标签背景色
    tagTextColor: string;         // 标签文字色
    borderRadius: BorderRadius;
    decoration: DecorationType;
    emoji?: string;               // 装饰 emoji（当 decoration=emoji 时使用）
    fontSize: { conclusion: string; tag: string };
    padding: string;
  };
}

// ============ 默认模板ID ============

export const DEFAULT_CARD_TEMPLATE_ID = 'classic_gradient';

// ============ 模板定义 ============

export const XHS_CARD_TEMPLATES: XhsCardTemplate[] = [
  // ==================== 模板1: 经典渐变（当前默认样式） ====================
  {
    id: 'classic_gradient',
    name: '经典渐变',
    description: '渐变背景+白色文字，小红书最流行的经典风格',
    thumbnail: {
      background: 'linear-gradient(135deg, #FF6B6B, #FFA07A)',
      textColor: '#ffffff',
      accentColor: '#FF6B6B',
    },
    cover: {
      bgType: 'gradient',
      colors: [
        { from: '#FF6B6B', to: '#FFA07A' },   // 粉橙
        { from: '#667eea', to: '#764ba2' },    // 蓝紫
        { from: '#2dd4bf', to: '#34d399' },    // 青绿
        { from: '#1e3a5f', to: '#4a90d9' },    // 深蓝
        { from: '#f472b6', to: '#fb923c' },    // 珊瑚粉
      ],
      textColor: '#ffffff',
      subtitleColor: 'rgba(255,255,255,0.85)',
      textAlign: 'center',
      borderRadius: 'xl',
      decoration: 'none',
      showTagline: true,
      fontSize: { title: '1.25rem', subtitle: '0.85rem' },
      padding: '2rem 1.5rem',
    },
    point: {
      bgType: 'gradient',
      colors: [
        { from: '#FF6B6B', to: '#FFA07A' },
        { from: '#667eea', to: '#764ba2' },
        { from: '#2dd4bf', to: '#34d399' },
        { from: '#1e3a5f', to: '#4a90d9' },
        { from: '#f472b6', to: '#fb923c' },
      ],
      textColor: '#ffffff',
      titleColor: '#ffffff',
      numberColor: 'rgba(255,255,255,0.7)',
      layout: 'icon_title_content',
      borderRadius: 'xl',
      decoration: 'none',
      showNumber: true,
      numberStyle: 'plain',
      fontSize: { title: '1.05rem', content: '0.9rem', number: '0.8rem' },
      padding: '1.5rem',
      contentMaxHeight: 160,
    },
    conclusion: {
      bgType: 'gradient',
      colors: [{ from: '#667eea', to: '#764ba2' }],
      textColor: '#ffffff',
      tagBgColor: 'rgba(255,255,255,0.2)',
      tagTextColor: '#ffffff',
      borderRadius: 'xl',
      decoration: 'none',
      fontSize: { conclusion: '1rem', tag: '0.75rem' },
      padding: '1.5rem',
    },
  },

  // ==================== 模板2: 极简白底 ====================
  {
    id: 'minimal_white',
    name: '极简白底',
    description: '干净白底+深色文字+彩色点缀，专业清爽风格',
    thumbnail: {
      background: '#ffffff',
      textColor: '#1a1a2e',
      accentColor: '#FF6B6B',
    },
    cover: {
      bgType: 'solid',
      colors: [{ from: '#ffffff', to: '#ffffff' }],
      textColor: '#1a1a2e',
      subtitleColor: '#666666',
      textAlign: 'center',
      borderRadius: 'xl',
      decoration: 'corner',
      showTagline: false,
      fontSize: { title: '1.35rem', subtitle: '0.85rem' },
      padding: '2.5rem 2rem',
    },
    point: {
      bgType: 'solid',
      colors: [{ from: '#fafafa', to: '#f5f5f5' }],
      textColor: '#333333',
      titleColor: '#1a1a2e',
      numberColor: '#FF6B6B',
      layout: 'number_title_content',
      borderRadius: 'lg',
      decoration: 'none',
      showNumber: true,
      numberStyle: 'circle',
      fontSize: { title: '1.05rem', content: '0.88rem', number: '0.85rem' },
      padding: '1.5rem',
      contentMaxHeight: 150,
    },
    conclusion: {
      bgType: 'solid',
      colors: [{ from: '#fafafa', to: '#f5f5f5' }],
      textColor: '#333333',
      tagBgColor: '#FF6B6B',
      tagTextColor: '#ffffff',
      borderRadius: 'lg',
      decoration: 'none',
      fontSize: { conclusion: '1rem', tag: '0.72rem' },
      padding: '1.5rem',
    },
  },

  // ==================== 模板3: 暗夜模式 ====================
  {
    id: 'dark_night',
    name: '暗夜模式',
    description: '深色背景+霓虹色彩，酷炫科技风格',
    thumbnail: {
      background: 'linear-gradient(135deg, #0f0c29, #302b63)',
      textColor: '#e0e0ff',
      accentColor: '#00f5d4',
    },
    cover: {
      bgType: 'gradient',
      colors: [
        { from: '#0f0c29', to: '#302b63' },
        { from: '#1a1a2e', to: '#16213e' },
      ],
      textColor: '#e0e0ff',
      subtitleColor: 'rgba(224,224,255,0.7)',
      textAlign: 'center',
      borderRadius: 'xl',
      decoration: 'dots',
      showTagline: true,
      fontSize: { title: '1.3rem', subtitle: '0.85rem' },
      padding: '2rem 1.5rem',
    },
    point: {
      bgType: 'gradient',
      colors: [
        { from: '#1a1a2e', to: '#16213e' },
        { from: '#0f0c29', to: '#302b63' },
      ],
      textColor: '#d0d0ee',
      titleColor: '#00f5d4',
      numberColor: '#00f5d4',
      layout: 'number_title_content',
      borderRadius: 'xl',
      decoration: 'none',
      showNumber: true,
      numberStyle: 'badge',
      fontSize: { title: '1.05rem', content: '0.88rem', number: '0.8rem' },
      padding: '1.5rem',
      contentMaxHeight: 150,
    },
    conclusion: {
      bgType: 'gradient',
      colors: [{ from: '#0f0c29', to: '#302b63' }],
      textColor: '#d0d0ee',
      tagBgColor: 'rgba(0,245,212,0.15)',
      tagTextColor: '#00f5d4',
      borderRadius: 'xl',
      decoration: 'none',
      fontSize: { conclusion: '1rem', tag: '0.72rem' },
      padding: '1.5rem',
    },
  },

  // ==================== 模板4: 手账风 ====================
  {
    id: 'handwrite',
    name: '手账风',
    description: '暖色纸质感+手写风格+圆角装饰，温馨亲切',
    thumbnail: {
      background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
      textColor: '#78350f',
      accentColor: '#d97706',
    },
    cover: {
      bgType: 'gradient',
      colors: [
        { from: '#fef3c7', to: '#fde68a' },   // 暖黄纸
        { from: '#fce7f3', to: '#fbcfe8' },    // 粉纸
        { from: '#dbeafe', to: '#bfdbfe' },     // 蓝纸
      ],
      textColor: '#78350f',
      subtitleColor: '#92400e',
      textAlign: 'left',
      borderRadius: 'xl',
      decoration: 'corner',
      showTagline: false,
      fontSize: { title: '1.2rem', subtitle: '0.82rem' },
      padding: '2rem 1.8rem',
    },
    point: {
      bgType: 'gradient',
      colors: [
        { from: '#fef3c7', to: '#fde68a' },
        { from: '#fce7f3', to: '#fbcfe8' },
        { from: '#dbeafe', to: '#bfdbfe' },
      ],
      textColor: '#44403c',
      titleColor: '#78350f',
      numberColor: '#d97706',
      layout: 'emoji_title_content',
      borderRadius: 'lg',
      decoration: 'dots',
      showNumber: true,
      numberStyle: 'plain',
      fontSize: { title: '1rem', content: '0.85rem', number: '0.9rem' },
      padding: '1.4rem 1.5rem',
      contentMaxHeight: 140,
    },
    conclusion: {
      bgType: 'gradient',
      colors: [{ from: '#fef3c7', to: '#fde68a' }],
      textColor: '#78350f',
      tagBgColor: 'rgba(217,119,6,0.15)',
      tagTextColor: '#92400e',
      borderRadius: 'lg',
      decoration: 'dots',
      fontSize: { conclusion: '0.95rem', tag: '0.72rem' },
      padding: '1.4rem 1.5rem',
    },
  },
];

// ============ 辅助函数 ============

/**
 * 根据模板ID获取模板配置
 */
export function getXhsCardTemplate(templateId: string): XhsCardTemplate {
  return XHS_CARD_TEMPLATES.find(t => t.id === templateId) 
    || XHS_CARD_TEMPLATES.find(t => t.id === DEFAULT_CARD_TEMPLATE_ID)!;
}

/**
 * 获取卡片背景CSS
 */
export function getCardBgCSS(
  bgType: CardBgType, 
  colors: ColorScheme[], 
  index: number = 0
): string {
  const scheme = colors[index % colors.length];
  switch (bgType) {
    case 'gradient':
      return `linear-gradient(135deg, ${scheme.from}, ${scheme.to})`;
    case 'solid':
      return scheme.from;
    case 'pattern':
      return `linear-gradient(135deg, ${scheme.from}, ${scheme.to})`;
    default:
      return `linear-gradient(135deg, ${scheme.from}, ${scheme.to})`;
  }
}

/**
 * 获取圆角CSS值
 */
export function getBorderRadiusCSS(radius: BorderRadius): string {
  const map: Record<BorderRadius, string> = {
    none: '0',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  };
  return map[radius] || '1rem';
}

/**
 * 获取装饰元素CSS（用于前端渲染）
 */
export function getDecorationCSS(decoration: DecorationType, color: string): React.CSSProperties {
  switch (decoration) {
    case 'dots':
      return {
        backgroundImage: `radial-gradient(circle, ${color}33 1px, transparent 1px)`,
        backgroundSize: '12px 12px',
      };
    case 'lines':
      return {
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, ${color}15 10px, ${color}15 11px)`,
      };
    case 'corner':
      // 角标通过伪元素实现，这里返回空
      return {};
    case 'wave':
      return {};
    default:
      return {};
  }
}

/**
 * 获取序号样式CSS
 */
export function getNumberStyleCSS(
  style: 'circle' | 'square' | 'badge' | 'plain', 
  color: string,
  textColor: string
): React.CSSProperties {
  switch (style) {
    case 'circle':
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.6rem',
        height: '1.6rem',
        borderRadius: '50%',
        backgroundColor: color,
        color: textColor,
        fontWeight: 'bold',
        flexShrink: 0,
      };
    case 'square':
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.6rem',
        height: '1.6rem',
        borderRadius: '0.3rem',
        backgroundColor: color,
        color: textColor,
        fontWeight: 'bold',
        flexShrink: 0,
      };
    case 'badge':
      return {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.2rem 0.6rem',
        borderRadius: '0.5rem',
        backgroundColor: `${color}25`,
        color: color,
        fontWeight: 'bold',
        flexShrink: 0,
        border: `1px solid ${color}50`,
      };
    case 'plain':
    default:
      return {
        color: color,
        fontWeight: 'bold',
        flexShrink: 0,
      };
  }
}
