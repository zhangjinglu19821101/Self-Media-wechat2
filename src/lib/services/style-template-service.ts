/**
 * 风格模板服务
 * 
 * 负责风格模板的 CRUD 操作、账号绑定管理
 * 
 * 🔒 安全原则：所有方法都需要传入 workspaceId 进行权限校验
 */

import { db } from '@/lib/db';
import { styleTemplates, platformAccounts, accountStyleConfigs, isValidPlatform } from '@/lib/db/schema/style-template';
import { styleAssets } from '@/lib/db/schema/digital-assets';
import { eq, and, desc, asc, inArray, sql } from 'drizzle-orm';
import { StyleTemplate, NewStyleTemplate, PlatformAccount, NewPlatformAccount, AccountStyleConfig, PLATFORM_LABELS, PlatformType, PlatformConfig, PLATFORM_CONFIG_FIELDS } from '@/lib/db/schema/style-template';

export class StyleTemplateService {
  
  // ==================== 风格模板 CRUD ====================
  
  /**
   * 创建风格模板
   * @param workspaceId 工作空间ID（必须）
   */
  async createTemplate(workspaceId: string, data: {
    name: string;
    description?: string;
    platform?: PlatformType;
    sourceArticles?: Array<{ title: string; contentPreview: string; analyzedAt: string }>;
    isDefault?: boolean;
  }): Promise<StyleTemplate> {
    // 输入验证
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('模板名称不能为空');
    }
    if (data.name.length > 50) {
      throw new Error('模板名称不能超过50个字符');
    }
    
    const platform = data.platform || 'wechat_official';
    
    // 如果设为默认，先取消该平台的其他默认模板
    if (data.isDefault) {
      await db.update(styleTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(
          eq(styleTemplates.workspaceId, workspaceId),
          eq(styleTemplates.isDefault, true),
          eq(styleTemplates.platform, platform)
        ));
    }
    
    const [template] = await db.insert(styleTemplates)
      .values({
        workspaceId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        platform,
        sourceArticles: data.sourceArticles || [],
        isDefault: data.isDefault || false,
        ruleCount: 0,
        articleCount: data.sourceArticles?.length || 0,
      })
      .returning();
    
    return template;
  }
  
  /**
   * 获取用户所有风格模板
   * @param workspaceId 工作空间ID（必须）
   * @param platform 可选，按平台筛选
   */
  async listTemplates(workspaceId: string, platform?: PlatformType): Promise<Array<StyleTemplate & { ruleCount: number }>> {
    const conditions = [eq(styleTemplates.workspaceId, workspaceId)];
    
    if (platform) {
      conditions.push(eq(styleTemplates.platform, platform));
    }
    
    const templates = await db.select()
      .from(styleTemplates)
      .where(and(...conditions))
      .orderBy(desc(styleTemplates.isDefault), desc(styleTemplates.updatedAt));
    
    return templates.map(t => ({
      ...t,
      ruleCount: t.ruleCount || 0,
    }));
  }
  
  /**
   * 获取模板详情（带权限校验）
   * @param templateId 模板ID
   * @param workspaceId 工作空间ID（必须，用于权限校验）
   */
  async getTemplate(templateId: string, workspaceId: string): Promise<StyleTemplate | null> {
    const [template] = await db.select()
      .from(styleTemplates)
      .where(and(
        eq(styleTemplates.id, templateId),
        eq(styleTemplates.workspaceId, workspaceId)
      ));
    
    return template || null;
  }
  
  /**
   * 获取模板详情（不带权限校验，仅内部使用）
   * @internal
   */
  async getTemplateById(templateId: string): Promise<StyleTemplate | null> {
    const [template] = await db.select()
      .from(styleTemplates)
      .where(eq(styleTemplates.id, templateId));
    
    return template || null;
  }
  
  /**
   * 更新模板（带权限校验）
   * @param templateId 模板ID
   * @param workspaceId 工作空间ID（必须，用于权限校验）
   */
  async updateTemplate(templateId: string, workspaceId: string, data: Partial<{
    name: string;
    description: string;
    platform: PlatformType;
    isDefault: boolean;
    isActive: boolean;
  }>): Promise<StyleTemplate | null> {
    // 验证模板属于该用户
    const template = await this.getTemplate(templateId, workspaceId);
    if (!template) {
      return null; // 模板不存在或不属于该用户
    }
    
    // 输入验证
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('模板名称不能为空');
      }
      if (data.name.length > 50) {
        throw new Error('模板名称不能超过50个字符');
      }
    }
    
    // 如果设为默认，先取消该平台的其他默认模板
    if (data.isDefault) {
      const targetPlatform = data.platform || template.platform;
      await db.update(styleTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(
          eq(styleTemplates.workspaceId, workspaceId),
          eq(styleTemplates.isDefault, true),
          eq(styleTemplates.platform, targetPlatform),
          sql`${styleTemplates.id} != ${templateId}` // 排除当前模板
        ));
    }
    
    const [updated] = await db.update(styleTemplates)
      .set({
        ...data,
        name: data.name?.trim(),
        description: data.description?.trim(),
        updatedAt: new Date(),
      })
      .where(eq(styleTemplates.id, templateId))
      .returning();
    
    return updated || null;
  }
  
  /**
   * 删除模板（带权限校验 + 事务）
   * @param templateId 模板ID
   * @param workspaceId 工作空间ID（必须，用于权限校验）
   */
  async deleteTemplate(templateId: string, workspaceId: string): Promise<{ success: boolean; message: string }> {
    // 验证模板属于该用户
    const template = await this.getTemplate(templateId, workspaceId);
    if (!template) {
      return { success: false, message: '模板不存在或无权删除' };
    }
    
    // 不允许删除默认模板（如果还有其他模板）
    if (template.isDefault) {
      const otherTemplates = await db.select({ id: styleTemplates.id })
        .from(styleTemplates)
        .where(and(
          eq(styleTemplates.workspaceId, workspaceId),
          sql`${styleTemplates.id} != ${templateId}`
        ))
        .limit(1);
      
      if (otherTemplates.length > 0) {
        return { success: false, message: '请先设置其他模板为默认模板后再删除此模板' };
      }
    }
    
    try {
      // 使用事务确保数据一致性
      await db.transaction(async (tx) => {
        // 1. 将关联的 style_assets 的 template_id 设为 null
        await tx.update(styleAssets)
          .set({ templateId: null })
          .where(eq(styleAssets.templateId, templateId));
        
        // 2. 删除账号绑定关系
        await tx.delete(accountStyleConfigs)
          .where(eq(accountStyleConfigs.templateId, templateId));
        
        // 3. 删除模板
        await tx.delete(styleTemplates)
          .where(eq(styleTemplates.id, templateId));
      });
      
      return { success: true, message: '模板已删除' };
    } catch (error) {
      console.error('[StyleTemplateService] 删除模板失败:', error);
      return { success: false, message: '删除失败，请稍后重试' };
    }
  }
  
  /**
   * 获取用户的默认模板
   * @param workspaceId 工作空间ID（必须）
   * @param platform 可选，按平台筛选
   */
  async getDefaultTemplate(workspaceId: string, platform?: PlatformType): Promise<StyleTemplate | null> {
    const conditions = [
      eq(styleTemplates.workspaceId, workspaceId),
      eq(styleTemplates.isDefault, true),
      eq(styleTemplates.isActive, true)
    ];
    
    if (platform) {
      conditions.push(eq(styleTemplates.platform, platform));
    }
    
    const [template] = await db.select()
      .from(styleTemplates)
      .where(and(...conditions));
    
    // 如果没有默认模板，返回该平台的第一个模板
    if (!template) {
      const firstConditions = [
        eq(styleTemplates.workspaceId, workspaceId),
        eq(styleTemplates.isActive, true)
      ];
      
      if (platform) {
        firstConditions.push(eq(styleTemplates.platform, platform));
      }
      
      const [firstTemplate] = await db.select()
        .from(styleTemplates)
        .where(and(...firstConditions))
        .orderBy(desc(styleTemplates.updatedAt))
        .limit(1);
      return firstTemplate || null;
    }
    
    return template;
  }
  
  /**
   * 更新模板的规则数量
   * @param templateId 模板ID
   */
  async updateTemplateRuleCount(templateId: string): Promise<void> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(styleAssets)
      .where(eq(styleAssets.templateId, templateId));
    
    await db.update(styleTemplates)
      .set({ 
        ruleCount: result?.count || 0,
        updatedAt: new Date(),
      })
      .where(eq(styleTemplates.id, templateId));
  }
  
  // ==================== 平台账号 CRUD ====================
  
  /**
   * 创建平台账号
   * @param workspaceId 工作空间ID（必须）
   */
  async createAccount(workspaceId: string, data: {
    platform: string;
    accountName: string;
    accountId?: string;
    accountDescription?: string;
    platformConfig?: PlatformConfig;
  }): Promise<PlatformAccount> {
    // 输入验证
    if (!data.platform || data.platform.trim().length === 0) {
      throw new Error('请选择平台');
    }
    if (!data.accountName || data.accountName.trim().length === 0) {
      throw new Error('账号名称不能为空');
    }
    if (data.accountName.length > 50) {
      throw new Error('账号名称不能超过50个字符');
    }
    
    const [account] = await db.insert(platformAccounts)
      .values({
        workspaceId,
        platform: data.platform,
        platformLabel: PLATFORM_LABELS[data.platform] || data.platform,
        accountName: data.accountName.trim(),
        accountId: data.accountId?.trim() || null,
        accountDescription: data.accountDescription?.trim() || null,
        platformConfig: data.platformConfig || {},
      })
      .returning();
    
    return account;
  }
  
  /**
   * 获取用户所有平台账号
   * @param workspaceId 工作空间ID（必须）
   */
  async listAccounts(workspaceId: string): Promise<PlatformAccount[]> {
    return db.select()
      .from(platformAccounts)
      .where(eq(platformAccounts.workspaceId, workspaceId))
      .orderBy(asc(platformAccounts.platform), desc(platformAccounts.updatedAt));
  }
  
  /**
   * 获取账号详情（带权限校验）
   * @param accountId 账号ID
   * @param workspaceId 工作空间ID（必须，用于权限校验）
   */
  async getAccount(accountId: string, workspaceId: string): Promise<PlatformAccount | null> {
    const [account] = await db.select()
      .from(platformAccounts)
      .where(and(
        eq(platformAccounts.id, accountId),
        eq(platformAccounts.workspaceId, workspaceId)
      ));
    
    return account || null;
  }
  
  /**
   * 更新账号（带权限校验）
   * @param accountId 账号ID
   * @param workspaceId 工作空间ID（必须，用于权限校验）
   */
  async updateAccount(accountId: string, workspaceId: string, data: Partial<{
    platform: string;
    accountName: string;
    accountId: string;
    accountDescription: string;
    isActive: boolean;
    platformConfig: PlatformConfig;
  }>): Promise<PlatformAccount | null> {
    // 验证账号属于该用户
    const account = await this.getAccount(accountId, workspaceId);
    if (!account) {
      return null;
    }
    
    const [updated] = await db.update(platformAccounts)
      .set({
        ...data,
        accountName: data.accountName?.trim(),
        accountDescription: data.accountDescription?.trim(),
        platformLabel: data.platform ? PLATFORM_LABELS[data.platform] : undefined,
        updatedAt: new Date(),
      })
      .where(eq(platformAccounts.id, accountId))
      .returning();
    
    return updated || null;
  }
  
  /**
   * 删除账号（带权限校验）
   * @param accountId 账号ID
   * @param workspaceId 工作空间ID（必须，用于权限校验）
   */
  async deleteAccount(accountId: string, workspaceId: string): Promise<{ success: boolean; message: string }> {
    // 验证账号属于该用户
    const account = await this.getAccount(accountId, workspaceId);
    if (!account) {
      return { success: false, message: '账号不存在或无权删除' };
    }
    
    try {
      await db.transaction(async (tx) => {
        // 删除绑定关系
        await tx.delete(accountStyleConfigs)
          .where(eq(accountStyleConfigs.accountId, accountId));
        
        // 删除账号
        await tx.delete(platformAccounts)
          .where(eq(platformAccounts.id, accountId));
      });
      
      return { success: true, message: '账号已删除' };
    } catch (error) {
      console.error('[StyleTemplateService] 删除账号失败:', error);
      return { success: false, message: '删除失败，请稍后重试' };
    }
  }
  
  // ==================== 账号-模板绑定 ====================
  
  /**
   * 绑定账号到模板（带权限校验）
   * @param workspaceId 工作空间ID（必须）
   * @param accountId 账号ID
   * @param templateId 模板ID
   */
  async bindAccountToTemplate(workspaceId: string, accountId: string, templateId: string, priority?: number): Promise<AccountStyleConfig> {
    // 验证账号和模板都属于该工作空间
    const [account, template] = await Promise.all([
      this.getAccount(accountId, workspaceId),
      this.getTemplate(templateId, workspaceId),
    ]);
    
    if (!account) {
      throw new Error('账号不存在或无权访问');
    }
    if (!template) {
      throw new Error('模板不存在或无权访问');
    }
    
    // 检查是否已存在绑定
    const [existing] = await db.select()
      .from(accountStyleConfigs)
      .where(and(
        eq(accountStyleConfigs.workspaceId, workspaceId),
        eq(accountStyleConfigs.accountId, accountId)
      ));
    
    if (existing) {
      // 更新现有绑定
      const [updated] = await db.update(accountStyleConfigs)
        .set({
          templateId,
          priority: priority || existing.priority,
          updatedAt: new Date(),
        })
        .where(eq(accountStyleConfigs.id, existing.id))
        .returning();
      return updated;
    }
    
    // 创建新绑定
    const [config] = await db.insert(accountStyleConfigs)
      .values({
        workspaceId,
        accountId,
        templateId,
        priority: priority || 1,
      })
      .returning();
    
    return config;
  }
  
  /**
   * 解除账号绑定（带权限校验）
   * @param accountId 账号ID
   * @param workspaceId 工作空间ID（必须，用于权限校验）
   */
  async unbindAccount(accountId: string, workspaceId: string): Promise<boolean> {
    // 验证账号属于该工作空间
    const account = await this.getAccount(accountId, workspaceId);
    if (!account) {
      return false;
    }
    
    const result = await db.delete(accountStyleConfigs)
      .where(eq(accountStyleConfigs.accountId, accountId))
      .returning();
    
    return result.length > 0;
  }
  
  /**
   * 获取账号绑定的模板（带权限校验）
   * @param accountId 账号ID
   * @param workspaceId 工作空间ID（必须，用于权限校验）
   */
  async getTemplateByAccount(accountId: string, workspaceId: string): Promise<StyleTemplate | null> {
    const [config] = await db.select()
      .from(accountStyleConfigs)
      .where(and(
        eq(accountStyleConfigs.accountId, accountId),
        eq(accountStyleConfigs.workspaceId, workspaceId)
      ));
    
    if (!config) return null;
    
    return this.getTemplate(config.templateId, workspaceId);
  }
  
  /**
   * 获取账号绑定的模板ID（用于文章生成）
   * 🔒 内部方法，不做权限校验（调用方已校验）
   */
  async getTemplateIdByAccount(accountId: string): Promise<string | null> {
    const [config] = await db.select()
      .from(accountStyleConfigs)
      .where(eq(accountStyleConfigs.accountId, accountId));
    
    return config?.templateId || null;
  }
  
  /**
   * 🔥 新增：获取账号的平台类型
   * @param accountId 账号ID
   * @returns 平台类型，如果账号不存在则返回 null
   */
  async getAccountPlatform(accountId: string): Promise<PlatformType | null> {
    const [account] = await db.select()
      .from(platformAccounts)
      .where(eq(platformAccounts.id, accountId));
    
    // P2 修复：添加运行时校验，避免类型断言风险
    const platform = account?.platform;
    if (platform && isValidPlatform(platform)) {
      return platform;
    }
    return null;
  }
  
  /**
   * 获取用户的所有账号配置（含模板信息）- 优化版，解决N+1问题
   * @param workspaceId 工作空间ID（必须）
   */
  async listAccountConfigs(workspaceId: string): Promise<Array<{
    account: PlatformAccount;
    template: StyleTemplate | null;
  }>> {
    // 1. 批量查询账号
    const accounts = await this.listAccounts(workspaceId);
    if (accounts.length === 0) {
      return [];
    }
    
    const accountIds = accounts.map(a => a.id);
    
    // 2. 批量查询绑定关系
    const configs = await db.select()
      .from(accountStyleConfigs)
      .where(and(
        eq(accountStyleConfigs.workspaceId, workspaceId),
        inArray(accountStyleConfigs.accountId, accountIds)
      ));
    
    // 3. 收集需要查询的模板ID
    const templateIds = [...new Set(configs.map(c => c.templateId).filter(Boolean))];
    
    // 4. 批量查询模板
    let templates: StyleTemplate[] = [];
    if (templateIds.length > 0) {
      templates = await db.select()
        .from(styleTemplates)
        .where(and(
          eq(styleTemplates.workspaceId, workspaceId),
          inArray(styleTemplates.id, templateIds)
        ));
    }
    
    // 5. 构建映射
    const templateMap = new Map(templates.map(t => [t.id, t]));
    const configMap = new Map(configs.map(c => [c.accountId, c.templateId]));
    
    // 6. 组装结果
    return accounts.map(account => ({
      account,
      template: configMap.has(account.id) 
        ? (templateMap.get(configMap.get(account.id)!) || null)
        : null,
    }));
  }

  // ==================== 平台专属配置 ====================

  /**
   * 更新账号的平台专属配置
   * @param accountId 账号ID
   * @param workspaceId 工作空间ID（权限校验）
   * @param platformConfig 平台配置（整体替换）
   */
  async updatePlatformConfig(
    accountId: string,
    workspaceId: string,
    platformConfig: PlatformConfig
  ): Promise<PlatformAccount | null> {
    const account = await this.getAccount(accountId, workspaceId);
    if (!account) {
      return null;
    }

    // P1 修复：配置字段白名单校验，只保留 PLATFORM_CONFIG_FIELDS 中定义的字段
    const platform = account.platform as PlatformType;
    const allowedFields = PLATFORM_CONFIG_FIELDS[platform]?.map(f => f.key) || [];
    const validatedConfig: Record<string, unknown> = {};
    const rawConfig = platformConfig[platform] as Record<string, unknown> | undefined;

    if (rawConfig && typeof rawConfig === 'object') {
      for (const [key, value] of Object.entries(rawConfig)) {
        if (!allowedFields.includes(key)) {
          console.warn(`[StyleTemplateService] 忽略未知配置字段: ${key}`);
          continue;
        }
        // P2 修复：字符串长度限制
        if (typeof value === 'string' && value.length > 500) {
          console.warn(`[StyleTemplateService] 字段 ${key} 超过500字符，已截断`);
          validatedConfig[key] = value.slice(0, 500);
        } else {
          validatedConfig[key] = value;
        }
      }
    }

    // P0 修复：合并已有配置（而非直接覆盖，保留其他平台的配置）
    const existingConfig = (account.platformConfig as PlatformConfig) || {};
    const mergedConfig = { ...existingConfig, [platform]: validatedConfig };

    const result = await db.update(platformAccounts)
      .set({
        platformConfig: mergedConfig,
        updatedAt: new Date(),
      })
      .where(and(
        eq(platformAccounts.id, accountId),
        eq(platformAccounts.workspaceId, workspaceId)  // P1 修复：条件中加入 workspaceId
      ))
      .returning();

    // P0 修复：正确区分空数组和 null
    return result[0] ?? null;
  }

  /**
   * 获取账号的平台专属配置（按平台类型解析）
   * @param accountId 账号ID
   * @param workspaceId 工作空间ID（权限校验）
   */
  async getPlatformConfig(
    accountId: string,
    workspaceId: string
  ): Promise<{ platform: PlatformType; config: PlatformConfig } | null> {
    const account = await this.getAccount(accountId, workspaceId);
    if (!account) {
      return null;
    }

    const platform = account.platform as PlatformType;
    const config = (account.platformConfig as PlatformConfig) || {};

    return { platform, config };
  }

  /**
   * 获取账号的平台专属配置（内部方法，供执行引擎使用，含 workspaceId 隔离）
   * @param accountId 账号ID
   * @param workspaceId 工作空间ID（用于隔离校验）
   */
  async getPlatformConfigInternal(accountId: string, workspaceId?: string): Promise<{ platform: PlatformType; config: PlatformConfig } | null> {
    const conditions = [eq(platformAccounts.id, accountId)];
    if (workspaceId) {
      conditions.push(eq(platformAccounts.workspaceId, workspaceId));
    }
    const [account] = await db.select()
      .from(platformAccounts)
      .where(and(...conditions));

    if (!account) return null;

    const platform = account.platform as PlatformType;
    const config = (account.platformConfig as PlatformConfig) || {};

    return { platform, config };
  }

  /**
   * 将平台专属配置格式化为可注入 Prompt 的文本
   * @param accountId 账号ID
   * @param workspaceId 工作空间ID（隔离校验）
   */
  async formatPlatformConfigForPrompt(accountId: string, workspaceId?: string): Promise<string> {
    const result = await this.getPlatformConfigInternal(accountId, workspaceId);
    if (!result) return '';

    const { platform, config } = result;
    const platformConfig = config[platform];
    if (!platformConfig || Object.keys(platformConfig).length === 0) return '';

    const lines: string[] = [];
    const fieldDefs = PLATFORM_CONFIG_FIELDS[platform];
    if (!fieldDefs) return '';

    // 用字段定义的 label 替代 key，生成可读的指令
    for (const field of fieldDefs) {
      const value = (platformConfig as Record<string, unknown>)[field.key];
      if (value === undefined || value === null || value === '' || 
          (Array.isArray(value) && value.length === 0)) continue;

      if (field.type === 'select') {
        const option = field.options?.find(o => o.value === value);
        lines.push(`${field.label}：${option?.label || value}`);
      } else if (field.type === 'tags' && Array.isArray(value)) {
        lines.push(`${field.label}：${(value as string[]).join('、')}`);
      } else if (field.type === 'textarea') {
        lines.push(`${field.label}：${value}`);
      } else {
        lines.push(`${field.label}：${value}`);
      }
    }

    if (lines.length === 0) return '';

    const platformLabel = PLATFORM_LABELS[platform] || platform;
    return `【${platformLabel}专属风格配置】\n${lines.join('\n')}`;
  }
}

// 导出单例
export const styleTemplateService = new StyleTemplateService();
