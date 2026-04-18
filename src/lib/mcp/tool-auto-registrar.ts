/**
 * MCP 工具自动注册器
 * 
 * 功能：
 * 1. 启动时从 capability_list 表自动注册所有工具
 * 2. 提供手动刷新 API（refresh()），支持运行时更新
 * 3. 支持动态加载工具实现
 * 4. 提供 Mock 实现兜底
 * 
 * 已移除：
 * - ❌ 10分钟定时刷新（过度设计，实际场景很少需要）
 * 
 * @docs /docs/详细设计文档agent智能交互MCP能力设计capability_type.md
 */

import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { toolRegistry } from './tool-registry';
import { eq } from 'drizzle-orm';

export class ToolAutoRegistrar {
  private static instance: ToolAutoRegistrar;
  
  private constructor() {}
  
  public static getInstance(): ToolAutoRegistrar {
    if (!ToolAutoRegistrar.instance) {
      ToolAutoRegistrar.instance = new ToolAutoRegistrar();
    }
    return ToolAutoRegistrar.instance;
  }
  
  /**
   * 初始化：启动时从数据库加载所有工具
   */
  public async initialize() {
    console.log('[Tool Auto Registrar] ========== 初始化 ==========');
    
    try {
      // 启动时立即注册一次
      console.log('[Tool Auto Registrar] 步骤1：启动时从数据库加载工具');
      await this.autoRegisterAllTools();
      
      console.log('[Tool Auto Registrar] ========== 初始化完成 ==========');
    } catch (error) {
      console.error('[Tool Auto Registrar] 初始化失败:', error);
      // 注意：不要让初始化失败阻断服务启动
    }
  }
  
  /**
   * 手动刷新：重新从数据库加载所有工具
   */
  public async refresh() {
    console.log('[Tool Auto Registrar] ========== 手动刷新工具 ==========');
    
    try {
      await this.autoRegisterAllTools();
      console.log('[Tool Auto Registrar] ========== 手动刷新完成 ==========');
      
      return {
        success: true,
        availableTools: toolRegistry.getAvailableTools()
      };
    } catch (error) {
      console.error('[Tool Auto Registrar] 手动刷新失败:', error);
      throw error;
    }
  }
  
  /**
   * 启动时自动从 capability_list 注册所有工具
   */
  private async autoRegisterAllTools() {
    console.log('[Tool Auto Registrar] ========== 开始自动注册工具 ==========');
    
    try {
      // 1. 从 capability_list 读取所有能力
      const capabilities = await db.select().from(capabilityList);
      console.log(`[Tool Auto Registrar] 从 capability_list 读取到 ${capabilities.length} 个能力`);
      
      // 2. 按 tool_name 分组
      const toolMap = new Map<string, any[]>();
      for (const cap of capabilities) {
        const toolName = cap.toolName;
        // 跳过 null 的 toolName
        if (!toolName) {
          console.warn(`[Tool Auto Registrar] 跳过 null 的 toolName，capability id:`, cap.id);
          continue;
        }
        
        if (!toolMap.has(toolName)) {
          toolMap.set(toolName, []);
        }
        toolMap.get(toolName)!.push(cap);
      }
      
      console.log(`[Tool Auto Registrar] 发现 ${toolMap.size} 个工具:`, Array.from(toolMap.keys()));
      
      // 3. 逐个注册工具
      for (const [toolName, toolCapabilities] of toolMap) {
        await this.registerTool(toolName, toolCapabilities);
      }
      
      console.log('[Tool Auto Registrar] ========== 自动注册完成 ==========');
      console.log('[Tool Auto Registrar] 已注册工具:', toolRegistry.getAvailableTools());
      
    } catch (error) {
      console.error('[Tool Auto Registrar] 自动注册失败:', error);
      throw error;
    }
  }
  
  /**
   * 注册单个工具
   */
  private async registerTool(toolName: string | null, capabilities: any[]) {
    // 跳过 null 的 toolName
    if (!toolName) {
      console.warn(`[Tool Auto Registrar] 跳过 null 的 toolName`);
      return;
    }
    
    console.log(`[Tool Auto Registrar] 注册工具: ${toolName}`);
    
    // 1. 如果已注册，先注销旧的（支持刷新时更新）
    if (toolRegistry.hasTool(toolName)) {
      console.log(`[Tool Auto Registrar] 工具 ${toolName} 已注册，先注销旧版本`);
      toolRegistry.unregisterTool(toolName);
    }
    
    // 2. 尝试动态加载工具实现
    const toolImpl = await this.loadToolImplementation(toolName, capabilities);
    
    if (toolImpl) {
      // 3. 注册到 toolRegistry
      toolRegistry.registerTool(
        toolName,
        toolImpl,
        `从 capability_list 自动注册的工具 (${capabilities.length} 个能力)`
      );
      console.log(`[Tool Auto Registrar] ✅ 工具 ${toolName} 注册成功`);
    } else {
      console.warn(`[Tool Auto Registrar] ⚠️  工具 ${toolName} 没有找到实现，创建 Mock 实现`);
      
      // 4. 创建 Mock 实现（防止调用失败）
      const mockImpl = this.createMockTool(toolName, capabilities);
      toolRegistry.registerTool(
        toolName,
        mockImpl,
        `Mock 实现 (${toolName}) - 请提供真实实现`
      );
    }
  }
  
  /**
   * 动态加载工具实现
   */
  private async loadToolImplementation(toolName: string, capabilities: any[]): Promise<any> {
    // 约定：工具实现文件位于 src/lib/mcp/tools/{toolName}-tools.ts
    // 注意：由于 Next.js 的限制，这里简化处理，先检查是否有预定义的工具
    // 实际项目中可以使用动态 import
    
    // 先检查是否是已知的工具
    if (toolName === 'search') {
      try {
        const { SearchMCPTools } = await import('./web-search-executor');
        console.log(`[Tool Auto Registrar] ✅ 使用预定义的 search 工具`);
        return SearchMCPTools;
      } catch (e) {
        console.warn(`[Tool Auto Registrar] 加载 search 工具失败:`, e);
      }
    }
    
    if (toolName === 'wechat') {
      try {
        const { WechatMCPTools } = await import('./wechat-tools');
        console.log(`[Tool Auto Registrar] ✅ 使用预定义的 wechat 工具`);
        return WechatMCPTools;
      } catch (e) {
        console.warn(`[Tool Auto Registrar] 加载 wechat 工具失败:`, e);
      }
    }
    
    // 检查是否有合规审核工具
    if (toolName === 'wechat_compliance') {
      try {
        const module = await import('./wechat-compliance-auditor');
        // 尝试从模块中获取工具实现
        const moduleAsAny = module as any;
        const possibleExports = ['WechatComplianceAuditor', 'default', 'WechatComplianceTools'];
        for (const exportName of possibleExports) {
          if (moduleAsAny[exportName]) {
            console.log(`[Tool Auto Registrar] ✅ 使用预定义的 wechat_compliance 工具 (${exportName})`);
            return moduleAsAny[exportName];
          }
        }
      } catch (e) {
        console.warn(`[Tool Auto Registrar] 加载 wechat_compliance 工具失败:`, e);
      }
    }
    
    // 检查是否有公众号格式化工具
    if (toolName === 'wechat_format') {
      try {
        const { WechatMCPTools } = await import('./wechat-tools');
        console.log(`[Tool Auto Registrar] ✅ 使用预定义的 wechat_format 工具`);
        return WechatMCPTools;
      } catch (e) {
        console.warn(`[Tool Auto Registrar] 加载 wechat_format 工具失败:`, e);
      }
    }

    // 检查是否有视觉识别工具
    if (toolName === 'vision') {
      try {
        const { VisionMCPTools } = await import('./vision-tools');
        console.log(`[Tool Auto Registrar] ✅ 使用预定义的 vision 工具`);
        return VisionMCPTools;
      } catch (e) {
        console.warn(`[Tool Auto Registrar] 加载 vision 工具失败:`, e);
      }
    }

    console.log(`[Tool Auto Registrar] 未找到工具实现: ${toolName}`);
    return null;
  }
  
  /**
   * 创建 Mock 工具实现
   */
  private createMockTool(toolName: string, capabilities: any[]) {
    const mockImpl: any = {};
    
    for (const cap of capabilities) {
      // 跳过 null 的 actionName
      if (!cap.actionName) {
        console.warn(`[Tool Auto Registrar] 跳过 null 的 actionName`);
        continue;
      }
      
      const actionName = this.toCamelCase(cap.actionName);
      mockImpl[actionName] = async (params: any) => {
        console.warn(`[Mock Tool ${toolName}] 调用 Mock 实现: ${cap.actionName}`, params);
        return {
          success: false,
          error: `工具 ${toolName} 的 ${cap.actionName} 功能尚未实现，请提供真实的工具实现`,
          _isMock: true,
          _capabilityInfo: cap
        };
      };
    }
    
    return mockImpl;
  }
  
  private toCamelCase(str: string | null | undefined): string {
    if (!str) return '';
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
  
  /**
   * 运行时重新加载工具（支持热更新）
   */
  public async reloadTool(toolName: string) {
    console.log(`[Tool Auto Registrar] 重新加载工具: ${toolName}`);
    
    // 1. 先注销旧工具
    toolRegistry.unregisterTool(toolName);
    
    // 2. 重新查询 capability_list
    const capabilities = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.toolName, toolName));
    
    // 3. 重新注册
    if (capabilities.length > 0) {
      await this.registerTool(toolName, capabilities);
    }
  }
}

// 导出单例
export const toolAutoRegistrar = ToolAutoRegistrar.getInstance();
