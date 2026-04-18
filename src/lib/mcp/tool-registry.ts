/**
 * MCP 工具注册表
 * 
 * 【重要】此文件只提供工具存储功能，不包含任何默认工具注册！
 * 
 * 工具来源：
 * 1. 从 capability_list 数据库表动态注册（主要方式）
 *    - 由 ToolAutoRegistrar 在启动时自动加载
 *    - 可通过 toolAutoRegistrar.refresh() 手动刷新
 * 
 * 2. 运行时动态注册（可选）
 *    - 通过 registerTool() 方法注册
 * 
 * 【注意】
 * - ❌ 此文件不再硬编码任何默认工具
 * - ✅ 所有工具都应该从数据库动态注册
 * - ✅ 避免被误导：不要以为只有 search 和 wechat 两个工具
 * 
 * 使用方式：
 * 1. Agent T 和 genericMCPCall 通过 getTool() 获取工具实例
 * 2. Agent B 通过 getAvailableTools() 发现可用工具
 * 3. 新工具在数据库配置后自动注册
 */

// === 类型定义 ===

export interface ToolRegistration {
  name: string;
  instance: any;
  description?: string;
}

// === 工具注册表类 ===

class ToolRegistry {
  private tools: Map<string, { instance: any; description?: string }> = new Map();

  /**
   * 注册一个新的 MCP 工具
   * 
   * 【注意】通常不需要手动调用此方法！
   * 工具应该由 ToolAutoRegistrar 从数据库自动注册
   * 
   * @param name 工具名称（如 'search', 'wechat', 'wechat_compliance'）
   * @param instance 工具实例（包含方法的对象）
   * @param description 工具描述（可选）
   */
  registerTool(name: string, instance: any, description?: string) {
    console.log(`[ToolRegistry] 注册工具: ${name}`, description ? `(${description})` : '');
    this.tools.set(name, { instance, description });
  }

  /**
   * 获取一个已注册的工具
   * 
   * @param name 工具名称
   * @returns 工具实例，如果未注册返回 undefined
   */
  getTool(name: string): any | undefined {
    const tool = this.tools.get(name);
    return tool?.instance;
  }

  /**
   * 检查工具是否已注册
   * 
   * @param name 工具名称
   * @returns 是否已注册
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取所有可用的工具名称列表
   * 
   * 【注意】返回的是当前已注册的所有工具
   * 包括从数据库动态注册的工具（如 wechat_compliance）
   * 
   * @returns 工具名称数组
   */
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取所有工具的详细信息
   * 
   * @returns 工具信息数组
   */
  getToolInfos(): ToolRegistration[] {
    const infos: ToolRegistration[] = [];
    this.tools.forEach((tool, name) => {
      infos.push({
        name,
        instance: tool.instance,
        description: tool.description,
      });
    });
    return infos;
  }

  /**
   * 注销一个工具
   * 
   * @param name 工具名称
   */
  unregisterTool(name: string) {
    console.log(`[ToolRegistry] 注销工具: ${name}`);
    this.tools.delete(name);
  }

  /**
   * 清空所有已注册的工具
   */
  clearAllTools() {
    console.log('[ToolRegistry] 清空所有工具');
    this.tools.clear();
  }
}

// === 导出单例实例 ===

export const toolRegistry = new ToolRegistry();

console.log('[ToolRegistry] 初始化完成');
console.log('[ToolRegistry] 【重要】工具将由 ToolAutoRegistrar 从数据库动态注册');
console.log('[ToolRegistry] 【重要】此文件不包含任何默认工具');
