/**
 * Agent 能力配置服务
 * 
 * 功能：
 * - 管理各执行Agent的固有能力、MCP偏好、自动判定规则
 * - 提供通用化的Agent B智能化能力支持
 * - 支持动态配置，无需修改代码即可扩展新Agent
 * 
 * @features
 * - 获取Agent配置（带缓存）
 * - 注册新Agent
 * - 更新判定规则
 * - 能力边界判定
 */

import { db } from '@/lib/db';
import { agentCapabilities, type AutoJudgeRule, type AgentCapabilities, type NewAgentCapabilities } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// 简单内存缓存
const configCache = new Map<string, { config: AgentCapabilities; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

export interface AgentCapabilityConfig {
  agentId: string;
  agentName: string;
  description?: string;
  nativeCapabilities: string[];
  preferredMcpCapabilities: Array<{ capabilityType: string; priority: number }>;
  autoJudgeRules: AutoJudgeRule[];
  defaultAccountId?: string;
  isActive: boolean;
}

export interface NewAgentConfig {
  agentId: string;
  agentName: string;
  description?: string;
  nativeCapabilities?: string[];
  preferredMcpCapabilities?: Array<{ capabilityType: string; priority: number }>;
  autoJudgeRules?: AutoJudgeRule[];
  defaultAccountId?: string;
}

export class AgentCapabilityService {
  
  /**
   * 获取Agent配置（带缓存）
   */
  static async getConfig(agentId: string): Promise<AgentCapabilityConfig> {
    // 1. 检查缓存
    const cached = configCache.get(agentId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[AgentCapabilityService] 命中缓存: ${agentId}`);
      return this.mapToConfig(cached.config);
    }
    
    // 2. 从数据库获取
    console.log(`[AgentCapabilityService] 从数据库获取配置: ${agentId}`);
    const config = await db.query.agentCapabilities.findFirst({
      where: eq(agentCapabilities.agentId, agentId)
    });
    
    if (config) {
      // 写入缓存
      configCache.set(agentId, { config, timestamp: Date.now() });
      return this.mapToConfig(config);
    }
    
    // 3. 无配置，返回默认配置
    console.log(`[AgentCapabilityService] 使用默认配置: ${agentId}`);
    return this.getDefaultConfig(agentId);
  }
  
  /**
   * 注册新Agent
   */
  static async registerAgent(config: NewAgentConfig): Promise<AgentCapabilities> {
    console.log(`[AgentCapabilityService] 注册新Agent: ${config.agentId}`);
    
    const newConfig: NewAgentCapabilities = {
      agentId: config.agentId,
      agentName: config.agentName,
      description: config.description,
      nativeCapabilities: config.nativeCapabilities || [],
      preferredMcpCapabilities: config.preferredMcpCapabilities || [],
      autoJudgeRules: config.autoJudgeRules || [],
      defaultAccountId: config.defaultAccountId,
      isActive: true,
    };
    
    const [inserted] = await db.insert(agentCapabilities).values(newConfig).returning();
    
    // 清除缓存（如果存在）
    configCache.delete(config.agentId);
    
    return inserted;
  }
  
  /**
   * 更新Agent规则
   */
  static async updateRules(agentId: string, rules: AutoJudgeRule[]): Promise<void> {
    console.log(`[AgentCapabilityService] 更新规则: ${agentId}, 规则数: ${rules.length}`);
    
    await db.update(agentCapabilities)
      .set({ 
        autoJudgeRules: rules,
        updatedAt: new Date()
      })
      .where(eq(agentCapabilities.agentId, agentId));
    
    // 清除缓存
    configCache.delete(agentId);
  }
  
  /**
   * 更新Agent配置
   */
  static async updateConfig(
    agentId: string, 
    updates: Partial<Omit<NewAgentCapabilities, 'agentId' | 'createdAt'>>
  ): Promise<void> {
    console.log(`[AgentCapabilityService] 更新配置: ${agentId}`);
    
    await db.update(agentCapabilities)
      .set({ 
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(agentCapabilities.agentId, agentId));
    
    // 清除缓存
    configCache.delete(agentId);
  }
  
  /**
   * 获取所有Agent配置
   */
  static async getAllConfigs(): Promise<AgentCapabilityConfig[]> {
    const configs = await db.query.agentCapabilities.findMany({
      where: eq(agentCapabilities.isActive, true)
    });
    
    return configs.map(config => this.mapToConfig(config));
  }
  
  /**
   * 清除缓存
   */
  static clearCache(agentId?: string): void {
    if (agentId) {
      configCache.delete(agentId);
      console.log(`[AgentCapabilityService] 清除缓存: ${agentId}`);
    } else {
      configCache.clear();
      console.log('[AgentCapabilityService] 清除所有缓存');
    }
  }
  
  /**
   * 检查Agent是否存在
   */
  static async exists(agentId: string): Promise<boolean> {
    const config = await db.query.agentCapabilities.findFirst({
      where: eq(agentCapabilities.agentId, agentId),
      columns: { id: true }
    });
    return !!config;
  }
  
  /**
   * 获取默认配置
   */
  private static getDefaultConfig(agentId: string): AgentCapabilityConfig {
    return {
      agentId,
      agentName: agentId,
      description: `默认配置 - ${agentId}`,
      nativeCapabilities: [],
      preferredMcpCapabilities: [],
      autoJudgeRules: this.getDefaultRules(agentId),
      defaultAccountId: `${agentId}-account`,
      isActive: true,
    };
  }
  
  /**
   * 获取默认规则
   */
  private static getDefaultRules(agentId: string): AutoJudgeRule[] {
    // 通用默认规则：包含常见关键词
    return [
      {
        ruleId: 'default_001',
        ruleName: '搜索类任务',
        keywords: ['搜索', '查询', '最新', '热点', '素材', '数据', '查证', '案例'],
        matchMode: 'any',
        action: 'need_mcp',
        suggestedCapabilityType: 'search',
        problemTemplate: '需要搜索相关信息',
        confidence: 0.7,
        priority: 100,
      },
      {
        ruleId: 'default_002',
        ruleName: '发布类任务',
        keywords: ['发布', '上传', '草稿', '推送'],
        matchMode: 'any',
        action: 'need_mcp',
        suggestedCapabilityType: 'platform_publish',
        problemTemplate: '需要平台发布能力',
        confidence: 0.7,
        priority: 99,
      },
    ];
  }
  
  /**
   * 映射数据库配置为业务配置
   */
  private static mapToConfig(dbConfig: AgentCapabilities): AgentCapabilityConfig {
    return {
      agentId: dbConfig.agentId,
      agentName: dbConfig.agentName,
      description: dbConfig.description || undefined,
      nativeCapabilities: dbConfig.nativeCapabilities || [],
      preferredMcpCapabilities: dbConfig.preferredMcpCapabilities || [],
      autoJudgeRules: dbConfig.autoJudgeRules || [],
      defaultAccountId: dbConfig.defaultAccountId || undefined,
      isActive: dbConfig.isActive,
    };
  }
}

export default AgentCapabilityService;
