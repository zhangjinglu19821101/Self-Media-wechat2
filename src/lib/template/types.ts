/**
 * 样式模板类型定义
 */

/**
 * 样式模板
 */
export interface StyleTemplate {
  id: string;
  name: string;
  htmlContent: string;
  platform: string;
  isSystem: boolean;
  isDefault: boolean;  // 是否为该平台的默认模板
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 新增样式模板参数
 */
export interface CreateTemplateParams {
  name: string;
  htmlContent: string;
  platform?: string;
}

/**
 * 更新样式模板参数
 */
export interface UpdateTemplateParams {
  name?: string;
  htmlContent?: string;
  platform?: string;
}

/**
 * 模板列表响应
 */
export interface TemplateListResponse {
  success: boolean;
  data: {
    systemTemplates: StyleTemplate[];
    userTemplates: StyleTemplate[];
  };
}

/**
 * 平台选项
 */
export const PLATFORM_OPTIONS = [
  { label: '公众号', value: '公众号' },
  // 后续扩展：小红书、知乎等
] as const;

export type Platform = typeof PLATFORM_OPTIONS[number]['value'];
