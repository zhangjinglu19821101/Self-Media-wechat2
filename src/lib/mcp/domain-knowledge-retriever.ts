/**
 * 领域知识检索器
 * 用于检索领域知识库中的规则、案例、术语等
 */

import { db } from '@/lib/db';
import { domainRule, domainCase, domainTerminology, capabilityList } from '@/lib/db/schema';
import { eq, and, or, inArray, like } from 'drizzle-orm';
import type { DomainKnowledge } from '@/lib/types/branch1-types';
import type { DomainRule, DomainCase, DomainTerminology, CapabilityList } from '@/lib/db/schema';

/**
 * 领域知识检索器
 */
export class DomainKnowledgeRetriever {
  /**
   * 获取场景相关的业务规则
   */
  static async getRulesForScene(scene?: string): Promise<DomainRule[]> {
    let query = db.select().from(domainRule);
    
    if (scene) {
      query = query.where(
        or(
          eq(domainRule.scene, scene),
          eq(domainRule.scene, 'all')
        )
      );
    }
    
    return await query;
  }

  /**
   * 获取能力相关的历史案例
   */
  static async getCasesForCapability(
    capabilityType?: string,
    solutionNum?: number,
    limit: number = 10
  ): Promise<DomainCase[]> {
    let query = db.select().from(domainCase).orderBy(domainCase.createdAt).limit(limit);
    
    const conditions = [];
    
    if (capabilityType) {
      conditions.push(eq(domainCase.capabilityType, capabilityType));
    }
    
    if (solutionNum) {
      conditions.push(eq(domainCase.solutionNum, solutionNum));
    }
    
    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }
    
    return await query;
  }

  /**
   * 获取场景相关的领域术语
   */
  static async getTerminologyForScene(
    scene?: string,
    category?: 'insurance' | 'mcp'
  ): Promise<DomainTerminology[]> {
    let query = db.select().from(domainTerminology);
    
    const conditions = [];
    
    if (scene) {
      conditions.push(eq(domainTerminology.scene, scene));
    }
    
    if (category) {
      conditions.push(eq(domainTerminology.category, category));
    }
    
    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(and(...conditions));
    }
    
    return await query;
  }

  /**
   * 获取能力信息（包含参数模板）
   */
  static async getCapabilityInfo(capabilityId: number): Promise<CapabilityList | null> {
    const results = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.id, capabilityId));
    
    return results[0] || null;
  }

  /**
   * 聚合获取完整的领域知识
   */
  static async getDomainKnowledge(
    options: {
      scene?: string;
      capabilityType?: string;
      solutionNum?: number;
      capabilityId?: number;
    }
  ): Promise<DomainKnowledge> {
    const { scene, capabilityType, solutionNum, capabilityId } = options;
    
    console.log('[DomainKnowledgeRetriever] 获取领域知识:', options);
    
    // 并行检索所有知识
    const [rules, cases, terminology, capabilityInfo] = await Promise.all([
      this.getRulesForScene(scene),
      this.getCasesForCapability(capabilityType, solutionNum),
      this.getTerminologyForScene(scene),
      capabilityId ? this.getCapabilityInfo(capabilityId) : Promise.resolve(null)
    ]);
    
    console.log('[DomainKnowledgeRetriever] 检索完成:', {
      rules: rules.length,
      cases: cases.length,
      terminology: terminology.length,
      hasCapabilityInfo: !!capabilityInfo
    });
    
    return {
      rules,
      cases,
      terminology,
      paramTemplate: capabilityInfo?.paramTemplate as Record<string, any> | undefined,
      capabilityInfo
    };
  }

  /**
   * 将领域知识格式化为字符串（用于 Prompt 投喂）
   */
  static formatKnowledgeForPrompt(knowledge: DomainKnowledge): string {
    const parts: string[] = [];
    
    // 业务规则
    if (knowledge.rules.length > 0) {
      parts.push('【业务规则】');
      knowledge.rules.forEach(rule => {
        parts.push(`- [${rule.ruleType}] ${rule.description || ''}`);
        parts.push(`  ${JSON.stringify(rule.ruleContent, null, 2)}`);
      });
    }
    
    // 历史案例
    if (knowledge.cases.length > 0) {
      parts.push('\n【历史案例】');
      knowledge.cases.forEach((c, index) => {
        const status = c.isSuccess ? '✅ 成功' : '❌ 失败';
        parts.push(`- 案例 ${index + 1} [${status}]`);
        parts.push(`  任务: ${c.taskContent}`);
        if (c.params) {
          parts.push(`  参数: ${JSON.stringify(c.params)}`);
        }
        if (!c.isSuccess && c.failureReason) {
          parts.push(`  失败原因: ${c.failureReason}`);
        }
      });
    }
    
    // 领域术语
    if (knowledge.terminology.length > 0) {
      parts.push('\n【领域术语】');
      knowledge.terminology.forEach(term => {
        parts.push(`- ${term.term}: ${term.explanation}`);
      });
    }
    
    // 参数模板
    if (knowledge.paramTemplate) {
      parts.push('\n【参数模板】');
      parts.push(JSON.stringify(knowledge.paramTemplate, null, 2));
    }
    
    return parts.join('\n');
  }
}
