/**
 * 公众号文章格式化相关类型定义
 */

/**
 * 格式化请求参数
 */
export interface WeChatFormatRequest {
  /**
   * 文章标题
   */
  title: string;
  
  /**
   * 文章内容（纯文本）
   */
  content: string;
  
  /**
   * 作者（可选）
   */
  author?: string;
  
  /**
   * 日期（可选，默认为今天）
   */
  date?: string;
  
  /**
   * 账户ID（Agent T 调用时需要）
   */
  accountId?: string;
}

/**
 * 格式化响应结果
 */
export interface WeChatFormatResponse {
  /**
   * 是否成功
   */
  success: boolean;
  
  /**
   * 错误信息（失败时）
   */
  error?: string;
  
  /**
   * 数据（成功时）
   */
  data?: {
    /**
     * 格式化后的 HTML 内容
     */
    formattedHtml: string;
    
    /**
     * 元数据
     */
    metadata: {
      title: string;
      author: string;
      date: string;
      originalLength: number;
      formattedLength: number;
    };
  };
}

/**
 * MCP 能力参数描述
 * 用于 Agent T 智能选择和调用能力
 */
export const WECHAT_FORMAT_CAPABILITY_PARAM_DESC = {
  type: 'object' as const,
  properties: {
    accountId: {
      type: 'string',
      description: '账户ID，必填',
      required: true,
    },
    title: {
      type: 'string',
      description: '文章标题，必填',
      required: true,
    },
    content: {
      type: 'string',
      description: '文章内容（纯文本），必填',
      required: true,
    },
    author: {
      type: 'string',
      description: '作者，可选',
      required: false,
    },
    date: {
      type: 'string',
      description: '日期，可选，格式如 "2026年2月1日"',
      required: false,
    },
  },
  required: ['accountId', 'title', 'content'],
  description: '公众号文章格式化：使用 wechat_article.html 模板将合规审核后的文章格式化为公众号适配的 HTML 格式',
};

/**
 * 公众号发布请求参数
 */
export interface WeChatPublishRequest {
  /**
   * 账户ID
   */
  accountId: string;
  
  /**
   * 格式化后的 HTML 内容
   */
  formattedHtml: string;
  
  /**
   * 文章标题
   */
  title: string;
  
  /**
   * 作者（可选）
   */
  author?: string;
  
  /**
   * 摘要（可选）
   */
  digest?: string;
}

/**
 * 公众号发布响应结果
 */
export interface WeChatPublishResponse {
  success: boolean;
  error?: string;
  data?: {
    articleId: string;
    createTime: string;
    url?: string;
  };
}
