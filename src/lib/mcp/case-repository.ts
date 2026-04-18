/**
 * 案例仓库
 * 用于闭环学习：保存成功/失败案例，更新参数模板
 */

import { db } from '@/lib/db';
import { domainCase, capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { NewDomainCase } from '@/lib/db/schema';

/**
 * 案例仓库
 */
export class CaseRepository {
  /**
   * 保存成功案例
   */
  static async saveSuccessCase(options: {
    taskContent: string;
    capabilityType: string;
    solutionNum?: number;
    params: Record<string, any>;
    result: any;
  }): Promise<void> {
    const { taskContent, capabilityType, solutionNum, params, result } = options;
    
    console.log('[CaseRepository] 保存成功案例:', { taskContent, capabilityType, solutionNum });
    
    const newCase: NewDomainCase = {
      taskContent,
      capabilityType,
      solutionNum,
      params,
      result,
      isSuccess: true
    };
    
    await db.insert(domainCase).values(newCase);
    
    // 如果有 solutionNum，尝试更新参数模板
    if (solutionNum) {
      await this.updateParamTemplate(solutionNum, params);
    }
  }

  /**
   * 保存失败案例
   */
  static async saveFailureCase(options: {
    taskContent: string;
    capabilityType: string;
    solutionNum?: number;
    params?: Record<string, any>;
    failureReason: string;
  }): Promise<void> {
    const { taskContent, capabilityType, solutionNum, params, failureReason } = options;
    
    console.log('[CaseRepository] 保存失败案例:', { taskContent, capabilityType, solutionNum, failureReason });
    
    const newCase: NewDomainCase = {
      taskContent,
      capabilityType,
      solutionNum,
      params,
      isSuccess: false,
      failureReason
    };
    
    await db.insert(domainCase).values(newCase);
  }

  /**
   * 更新参数模板（基于成功案例）
   */
  private static async updateParamTemplate(
    capabilityId: number,
    newParams: Record<string, any>
  ): Promise<void> {
    try {
      // 获取当前能力信息
      const current = await db
        .select()
        .from(capabilityList)
        .where(eq(capabilityList.id, capabilityId));
      
      if (current.length === 0) {
        console.log('[CaseRepository] 能力不存在，跳过更新参数模板:', capabilityId);
        return;
      }
      
      const capability = current[0];
      let updatedTemplate: Record<string, any>;
      
      if (capability.paramTemplate) {
        // 合并现有模板和新参数
        updatedTemplate = {
          ...(capability.paramTemplate as Record<string, any>),
          ...newParams
        };
      } else {
        // 没有现有模板，直接使用新参数
        updatedTemplate = newParams;
      }
      
      // 更新数据库
      await db
        .update(capabilityList)
        .set({
          paramTemplate: updatedTemplate,
          updatedAt: new Date()
        })
        .where(eq(capabilityList.id, capabilityId));
      
      console.log('[CaseRepository] 参数模板已更新:', capabilityId);
      
    } catch (error) {
      console.error('[CaseRepository] 更新参数模板失败:', error);
    }
  }

  /**
   * 获取成功案例（用于参数模板学习）
   */
  static async getSuccessCases(
    capabilityType: string,
    limit: number = 5
  ): Promise<any[]> {
    const cases = await db
      .select()
      .from(domainCase)
      .where(
        eq(domainCase.capabilityType, capabilityType),
        eq(domainCase.isSuccess, true)
      )
      .orderBy(domainCase.createdAt)
      .limit(limit);
    
    return cases;
  }

  /**
   * 获取失败案例（用于避错学习）
   */
  static async getFailureCases(
    capabilityType: string,
    limit: number = 5
  ): Promise<any[]> {
    const cases = await db
      .select()
      .from(domainCase)
      .where(
        eq(domainCase.capabilityType, capabilityType),
        eq(domainCase.isSuccess, false)
      )
      .orderBy(domainCase.createdAt)
      .limit(limit);
    
    return cases;
  }
}
