/**
 * 能力插件系统
 * 支持能力的动态加载、热插拔、版本管理
 */

import { Skill } from './agent-types';

/**
 * 插件状态
 */
export enum PluginStatus {
  LOADED = 'loaded',
  UNLOADED = 'unloaded',
  ERROR = 'error',
}

/**
 * 插件元数据
 */
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
}

/**
 * 插件依赖
 */
export interface PluginDependency {
  id: string;
  version: string;
  optional: boolean;
}

/**
 * 插件配置
 */
export interface PluginConfig {
  enabled: boolean;
  priority: number;
  options: Record<string, any>;
}

/**
 * 能力插件
 */
export interface CapabilityPlugin {
  // 元数据
  metadata: PluginMetadata;

  // 能力信息
  skill: Skill;

  // 依赖
  dependencies?: PluginDependency[];

  // 处理器
  handler: (context: PluginContext) => Promise<PluginResult>;

  // 生命周期钩子
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;

  // 配置
  config: PluginConfig;

  // 状态
  status: PluginStatus;
}

/**
 * 插件上下文
 */
export interface PluginContext {
  agentId: string;
  domain?: string;
  input: any;
  state: Record<string, any>;
  dependencies: Record<string, any>;
}

/**
 * 插件结果
 */
export interface PluginResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * 插件仓库
 */
export interface PluginRepository {
  id: string;
  name: string;
  url: string;
  plugins: PluginManifest[];
}

/**
 * 插件清单
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  downloadUrl: string;
  size: number;
  checksum: string;
  publishedAt: string;
}

/**
 * 插件加载器
 */
export class PluginLoader {
  private loadedPlugins: Map<string, CapabilityPlugin> = new Map();
  private repositories: Map<string, PluginRepository> = new Map();

  /**
   * 加载插件
   */
  async loadPlugin(plugin: CapabilityPlugin): Promise<void> {
    const { metadata, dependencies } = plugin;

    // 检查依赖
    if (dependencies) {
      for (const dep of dependencies) {
        if (!dep.optional && !this.loadedPlugins.has(dep.id)) {
          throw new Error(`缺少必需的依赖: ${dep.id}`);
        }
      }
    }

    // 调用 onLoad 钩子
    if (plugin.onLoad) {
      await plugin.onLoad();
    }

    // 启用插件
    if (plugin.config.enabled && plugin.onEnable) {
      await plugin.onEnable();
    }

    plugin.status = PluginStatus.LOADED;
    this.loadedPlugins.set(metadata.id, plugin);
  }

  /**
   * 卸载插件
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件不存在: ${pluginId}`);
    }

    // 检查是否有其他插件依赖此插件
    for (const [id, p] of this.loadedPlugins.entries()) {
      if (p.dependencies?.some((d) => d.id === pluginId)) {
        throw new Error(`无法卸载，插件 ${id} 依赖此插件`);
      }
    }

    // 调用 onDisable 钩子
    if (plugin.onDisable) {
      await plugin.onDisable();
    }

    // 调用 onUnload 钩子
    if (plugin.onUnload) {
      await plugin.onUnload();
    }

    plugin.status = PluginStatus.UNLOADED;
    this.loadedPlugins.delete(pluginId);
  }

  /**
   * 执行插件
   */
  async executePlugin(pluginId: string, context: PluginContext): Promise<PluginResult> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件未加载: ${pluginId}`);
    }

    if (!plugin.config.enabled) {
      throw new Error(`插件未启用: ${pluginId}`);
    }

    try {
      return await plugin.handler(context);
    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 启用插件
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件不存在: ${pluginId}`);
    }

    if (plugin.onEnable) {
      await plugin.onEnable();
    }

    plugin.config.enabled = true;
  }

  /**
   * 禁用插件
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件不存在: ${pluginId}`);
    }

    if (plugin.onDisable) {
      await plugin.onDisable();
    }

    plugin.config.enabled = false;
  }

  /**
   * 获取插件
   */
  getPlugin(pluginId: string): CapabilityPlugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * 列出插件
   */
  listPlugins(filter?: { type?: string; agentId?: string; domain?: string }): CapabilityPlugin[] {
    let plugins = Array.from(this.loadedPlugins.values());

    if (filter?.agentId) {
      plugins = plugins.filter((p) => p.skill.description.includes(filter.agentId));
    }

    return plugins;
  }

  /**
   * 添加仓库
   */
  addRepository(repository: PluginRepository): void {
    this.repositories.set(repository.id, repository);
  }

  /**
   * 从仓库安装插件
   */
  async installPlugin(repositoryId: string, pluginId: string): Promise<void> {
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error(`仓库不存在: ${repositoryId}`);
    }

    const manifest = repository.plugins.find((p) => p.id === pluginId);
    if (!manifest) {
      throw new Error(`插件不存在: ${pluginId}`);
    }

    // TODO: 实际从 URL 下载插件
    // 这里只是演示
    console.log(`从仓库 ${repositoryId} 下载插件 ${pluginId}`);
  }

  /**
   * 导出插件配置
   */
  exportPlugin(pluginId: string): any {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`插件不存在: ${pluginId}`);
    }

    return {
      metadata: plugin.metadata,
      skill: plugin.skill,
      dependencies: plugin.dependencies,
      config: plugin.config,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * 导入插件配置
   */
  async importPlugin(config: any): Promise<void> {
    const { metadata, skill, dependencies, config: pluginConfig } = config;

    const plugin: CapabilityPlugin = {
      metadata,
      skill,
      dependencies,
      config: pluginConfig || { enabled: true, priority: 0, options: {} },
      status: PluginStatus.UNLOADED,
      handler: async (context) => ({ success: true }),
    };

    await this.loadPlugin(plugin);
  }
}

/**
 * 单例
 */
export const pluginLoader = new PluginLoader();

/**
 * 创建基础能力插件
 */
export function createBaseCapabilityPlugin(skill: Skill, handler: (context: PluginContext) => Promise<PluginResult>): CapabilityPlugin {
  return {
    metadata: {
      id: skill.id,
      name: skill.name,
      version: '1.0.0',
      description: skill.description,
      author: 'Platform',
      license: 'MIT',
      keywords: ['base', 'capability'],
    },
    skill,
    handler,
    config: {
      enabled: true,
      priority: 0,
      options: {},
    },
    status: PluginStatus.UNLOADED,
  };
}

/**
 * 创建领域能力插件
 */
export function createDomainCapabilityPlugin(
  domain: string,
  skill: Skill,
  handler: (context: PluginContext) => Promise<PluginResult>
): CapabilityPlugin {
  return {
    metadata: {
      id: skill.id,
      name: skill.name,
      version: '1.0.0',
      description: `${domain} - ${skill.description}`,
      author: 'Domain Expert',
      license: 'Commercial',
      keywords: ['domain', domain, skill.name],
    },
    skill,
    handler,
    config: {
      enabled: true,
      priority: 100,
      options: { domain },
    },
    status: PluginStatus.UNLOADED,
  };
}
