/**
 * MCP 存储策略工具类
 * 
 * 核心策略：
 * 1. 所有失败尝试：只存摘要（过程数据）
 * 2. 最后成功尝试：保存完整数据（最终使用的）
 * 3. 无需重试的场景：直接保存完整数据
 */

import { McpAttempt } from '@/lib/types/capability-types';

export class McpStorageStrategy {
  
  /**
   * 需要保存完整数据的 MCP 工具列表
   * 只有这些工具的成功结果才保存完整数据
   */
  private static readonly FULL_DATA_TOOLS = new Set([
    'web_search',
    'wechat_mp',
    'compliance_audit'
  ]);

  /**
   * 判断是否应该保存完整数据
   * 
   * @param attempt 当前 MCP 尝试
   * @param allAttempts 所有 MCP 尝试历史
   * @param isLastAttempt 是否是最后一次尝试
   * @returns 是否保存完整数据
   */
  static shouldStoreFullData(
    attempt: McpAttempt,
    allAttempts: McpAttempt[],
    isLastAttempt: boolean
  ): boolean {
    // 规则 1：只有成功的才考虑存完整数据
    if (attempt.result.status !== 'success') {
      return false;
    }
    
    // 规则 2：必须是最后一次尝试
    if (!isLastAttempt) {
      return false;
    }
    
    // 规则 3：只有特定的 MCP 类型才存完整数据
    if (!this.FULL_DATA_TOOLS.has(attempt.decision.toolName)) {
      return false;
    }
    
    return true;
  }

  /**
   * 裁剪失败尝试的数据（过程数据）
   * 只保留摘要信息，不保存完整数据
   */
  static truncateFailedAttempt(attempt: McpAttempt): McpAttempt {
    return {
      ...attempt,
      params: this.truncateParams(
        attempt.params, 
        attempt.decision.toolName, 
        false // 不保存完整数据
      ),
      result: {
        ...attempt.result,
        data: undefined, // 移除完整 data
        error: attempt.result.error ? {
          code: attempt.result.error.code,
          message: attempt.result.error.message?.substring(0, 200) || '未知错误',
          type: attempt.result.error.type
        } : undefined,
        _meta: {
          truncated: true,
          note: '这是失败尝试，只保存摘要信息',
          truncatedAt: new Date().toISOString()
        }
      }
    };
  }

  /**
   * 裁剪成功尝试的数据（如果不需要保存完整数据）
   */
  static truncateSuccessfulAttemptIfNeeded(
    attempt: McpAttempt,
    storeFullData: boolean
  ): McpAttempt {
    if (storeFullData) {
      // 保存完整数据，只添加标记
      return {
        ...attempt,
        result: {
          ...attempt.result,
          _meta: {
            fullDataStored: true,
            note: '这是最终使用的成功尝试，完整数据已保存'
          }
        }
      };
    }
    
    // 不保存完整数据，进行裁剪
    return {
      ...attempt,
      params: this.truncateParams(
        attempt.params, 
        attempt.decision.toolName, 
        false
      ),
      result: {
        ...attempt.result,
        data: this.truncateResultData(
          attempt.result.data, 
          attempt.decision.toolName
        ),
        _meta: {
          truncated: true,
          note: '这是成功尝试，但不是最后一次，只保存摘要',
          truncatedAt: new Date().toISOString()
        }
      }
    };
  }

  /**
   * 裁剪参数
   */
  static truncateParams(
    params: any, 
    toolName: string, 
    storeFullData: boolean
  ): any {
    if (!params) return params;
    
    if (storeFullData) {
      return params; // 保留完整参数
    }
    
    // 根据工具类型裁剪参数
    switch (toolName) {
      case 'wechat_mp':
        return {
          account_id: params.account_id,
          article_count: params.articles?.length || 0,
          article_titles: params.articles?.map((a: any) => 
            typeof a.title === 'string' ? a.title.substring(0, 50) : String(a.title)
          ) || [],
          _truncated: true
        };
        
      case 'web_search':
        return {
          account_id: params.account_id,
          query: params.query,
          num_results: params.num_results,
          _truncated: true
        };
        
      case 'compliance_audit':
        return {
          account_id: params.account_id,
          content_preview: params.content?.substring(0, 100) || '',
          content_length: params.content?.length || 0,
          _truncated: true
        };
        
      default:
        // 其他工具：只保留基本字段
        const { account_id, ...rest } = params;
        return {
          account_id,
          _truncated: true,
          _original_keys: Object.keys(rest)
        };
    }
  }

  /**
   * 裁剪结果数据
   */
  static truncateResultData(data: any, toolName: string): any {
    if (!data) return data;
    
    switch (toolName) {
      case 'web_search':
        return {
          query: data.query,
          total_results: data.total_results,
          results_count: data.results?.length || 0,
          summary: data.summary,
          _truncated: true
        };
        
      case 'wechat_mp':
        return {
          media_id: data.media_id,
          article_url: data.article_url,
          _truncated: true
        };
        
      case 'compliance_audit':
        return {
          is_compliant: data.is_compliant,
          check_passed: data.check_passed,
          violations_count: data.violations?.length || 0,
          audit_summary: data.audit_summary,
          _truncated: true
        };
        
      default:
        // 其他工具：只保留基本字段
        return {
          _truncated: true,
          _original_keys: Object.keys(data)
        };
    }
  }

  /**
   * 为成功的最终尝试添加完整数据引用
   */
  static addFullDataReference(
    attempt: McpAttempt,
    paramsFullDataId: number | null,
    resultFullDataId: number | null
  ): McpAttempt {
    return {
      ...attempt,
      params: paramsFullDataId ? {
        ...attempt.params,
        _full_data_id: paramsFullDataId,
        _full_data_stored: true
      } : attempt.params,
      result: {
        ...attempt.result,
        data: resultFullDataId && attempt.result.data ? {
          ...attempt.result.data,
          _full_data_id: resultFullDataId,
          _full_data_stored: true
        } : attempt.result.data
      }
    };
  }

  /**
   * 批量处理所有 MCP 尝试
   * 
   * @param attempts 所有 MCP 尝试数组
   * @returns 处理后的尝试数组，以及需要保存完整数据的尝试列表
   */
  static processAllAttempts(attempts: McpAttempt[]): {
    processedAttempts: McpAttempt[];
    fullDataAttempts: Array<{
      attempt: McpAttempt;
      index: number;
      storeParams: boolean;
      storeResult: boolean;
    }>;
  } {
    const processedAttempts: McpAttempt[] = [];
    const fullDataAttempts: Array<{
      attempt: McpAttempt;
      index: number;
      storeParams: boolean;
      storeResult: boolean;
    }> = [];
    
    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const isLastAttempt = (i === attempts.length - 1);
      const storeFullData = this.shouldStoreFullData(attempt, attempts, isLastAttempt);
      
      let processedAttempt: McpAttempt;
      
      if (attempt.result.status === 'failed') {
        // 失败尝试：裁剪
        processedAttempt = this.truncateFailedAttempt(attempt);
      } else if (storeFullData) {
        // 最终成功尝试：保存完整数据，添加标记
        processedAttempt = this.truncateSuccessfulAttemptIfNeeded(attempt, true);
        fullDataAttempts.push({
          attempt: processedAttempt,
          index: i,
          storeParams: true,
          storeResult: true
        });
      } else {
        // 中间成功尝试：裁剪
        processedAttempt = this.truncateSuccessfulAttemptIfNeeded(attempt, false);
      }
      
      processedAttempts.push(processedAttempt);
    }
    
    return {
      processedAttempts,
      fullDataAttempts
    };
  }
}
