/**
 * API Key 缺失错误
 * 
 * 当 workspace 的 llmKeySource='user_key' 但用户未配置 API Key 时，
 * factory.ts 抛出此错误。
 * 后端 API 路由捕获后返回 HTTP 403 + 错误码 'API_KEY_MISSING'。
 * 前端 client.ts 检测到该错误码后，自动跳转 /settings/api-keys。
 */

export class ApiKeyMissingError extends Error {
  /** 错误码，前端通过此码识别 */
  public readonly code = 'API_KEY_MISSING';
  /** HTTP 状态码 */
  public readonly statusCode = 403;
  /** 是否需要跳转配置页面 */
  public readonly redirectUrl = '/settings/api-keys';

  constructor(message?: string) {
    super(message || '未配置 API Key，请前往设置页面添加您的豆包 API Key');
    this.name = 'ApiKeyMissingError';
  }
}

/**
 * 判断一个错误是否为 API Key 缺失错误
 */
export function isApiKeyMissingError(error: unknown): error is ApiKeyMissingError {
  return error instanceof ApiKeyMissingError;
}
