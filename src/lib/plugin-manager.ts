/**
 * 插件管理模块
 * 用于管理插件的配置、使用日志和版本管理
 */

import {
  Plugin,
  AgentId,
  PluginUsageLog,
  getAgentPlugins,
  canAgentUsePlugin,
  getPluginById,
} from './plugin-system';

// 内存存储（实际项目中应该使用数据库）
const pluginUsageLogs: Map<string, PluginUsageLog[]> = new Map();
const pluginConfigs: Map<string, Record<string, any>> = new Map();

/**
 * 记录插件使用日志
 */
export function logPluginUsage(
  pluginId: string,
  usedBy: AgentId,
  action: string,
  config?: Record<string, any>,
  result?: {
    success: boolean;
    data?: any;
    error?: string;
  }
): void {
  const plugin = getPluginById(pluginId);
  if (!plugin) {
    console.warn(`插件 ${pluginId} 不存在`);
    return;
  }

  const log: PluginUsageLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    pluginId,
    pluginName: plugin.name,
    usedBy,
    action,
    config,
    result,
    timestamp: new Date(),
  };

  // 按插件 ID 分组存储日志
  if (!pluginUsageLogs.has(pluginId)) {
    pluginUsageLogs.set(pluginId, []);
  }
  pluginUsageLogs.get(pluginId)!.push(log);

  // 更新插件使用次数
  if (plugin.metadata) {
    plugin.metadata.usageCount = (plugin.metadata.usageCount || 0) + 1;
    plugin.metadata.lastUsedAt = new Date();
  }

  console.log(`[插件使用记录] ${usedBy} 使用 ${plugin.name} (${action}) - ${result?.success ? '成功' : '失败'}`);
}

/**
 * 获取插件的使用日志
 */
export function getPluginUsageLogs(pluginId: string): PluginUsageLog[] {
  return pluginUsageLogs.get(pluginId) || [];
}

/**
 * 获取 Agent 的插件使用历史
 */
export function getAgentPluginUsageHistory(agentId: AgentId): PluginUsageLog[] {
  const logs: PluginUsageLog[] = [];

  pluginUsageLogs.forEach((pluginLogs) => {
    pluginLogs.forEach((log) => {
      if (log.usedBy === agentId) {
        logs.push(log);
      }
    });
  });

  // 按时间倒序排序
  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * 保存插件配置
 */
export function savePluginConfig(
  pluginId: string,
  agentId: AgentId,
  config: Record<string, any>
): void {
  const key = `${pluginId}_${agentId}`;
  pluginConfigs.set(key, config);

  console.log(`[插件配置] Agent ${agentId} 配置插件 ${pluginId}`, config);
}

/**
 * 获取插件配置
 */
export function getPluginConfig(pluginId: string, agentId: AgentId): Record<string, any> | null {
  const key = `${pluginId}_${agentId}`;
  return pluginConfigs.get(key) || null;
}

/**
 * 获取 Agent 的所有插件配置
 */
export function getAgentPluginConfigs(agentId: AgentId): Map<string, Record<string, any>> {
  const configs = new Map<string, Record<string, any>>();

  pluginConfigs.forEach((config, key) => {
    const [pluginId, configAgentId] = key.split('_');
    if (configAgentId === agentId) {
      configs.set(pluginId, config);
    }
  });

  return configs;
}

/**
 * 执行插件
 */
export async function executePlugin(
  pluginId: string,
  agentId: AgentId,
  action: string,
  params?: Record<string, any>
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  // 检查 Agent 是否有权限使用该插件
  if (!canAgentUsePlugin(agentId, pluginId)) {
    const error = `Agent ${agentId} 没有权限使用插件 ${pluginId}`;
    logPluginUsage(pluginId, agentId, action, params, { success: false, error });
    return { success: false, error };
  }

  // 获取插件配置
  const config = getPluginConfig(pluginId, agentId);
  const plugin = getPluginById(pluginId);

  if (!plugin) {
    const error = `插件 ${pluginId} 不存在`;
    logPluginUsage(pluginId, agentId, action, params, { success: false, error });
    return { success: false, error };
  }

  try {
    // TODO: 这里应该调用实际的插件 API
    // 目前是模拟执行
    console.log(`[插件执行] 执行插件 ${plugin.name} (${action})`, {
      agentId,
      params,
      config,
    });

    // 模拟执行结果
    const result = {
      success: true,
      data: {
        pluginId,
        pluginName: plugin.name,
        action,
        result: '执行成功（模拟）',
      },
    };

    // 记录使用日志
    logPluginUsage(pluginId, agentId, action, params, result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const result = {
      success: false,
      error: errorMessage,
    };

    logPluginUsage(pluginId, agentId, action, params, result);

    return result;
  }
}

/**
 * 获取插件统计信息
 */
export function getPluginStats(pluginId: string): {
  totalUsage: number;
  successRate: number;
  lastUsed: Date | null;
  topAgent: AgentId | null;
} {
  const logs = getPluginUsageLogs(pluginId);

  if (logs.length === 0) {
    return {
      totalUsage: 0,
      successRate: 0,
      lastUsed: null,
      topAgent: null,
    };
  }

  // 计算成功率
  const successCount = logs.filter((log) => log.result?.success).length;
  const successRate = (successCount / logs.length) * 100;

  // 获取最后使用时间
  const lastUsed = logs[logs.length - 1].timestamp;

  // 获取使用最多的 Agent
  const agentUsageCount = new Map<AgentId, number>();
  logs.forEach((log) => {
    agentUsageCount.set(
      log.usedBy,
      (agentUsageCount.get(log.usedBy) || 0) + 1
    );
  });

  let topAgent: AgentId | null = null;
  let maxUsage = 0;
  agentUsageCount.forEach((count, agentId) => {
    if (count > maxUsage) {
      maxUsage = count;
      topAgent = agentId;
    }
  });

  return {
    totalUsage: logs.length,
    successRate,
    lastUsed,
    topAgent,
  };
}

/**
 * 获取所有插件的统计信息
 */
export function getAllPluginsStats(): Map<string, {
  totalUsage: number;
  successRate: number;
  lastUsed: Date | null;
  topAgent: AgentId | null;
}> {
  const stats = new Map();

  ['auto-reply', 'points-system', 'coupon-distribution', 'viral-marketing', 'ab-testing', 'user-segmentation'].forEach((pluginId) => {
    stats.set(pluginId, getPluginStats(pluginId));
  });

  return stats;
}

/**
 * 格式化插件配置为提示词格式
 */
export function formatPluginConfigForPrompt(agentId: AgentId): string {
  const plugins = getAgentPlugins(agentId);
  const configs = getAgentPluginConfigs(agentId);

  if (plugins.length === 0) {
    return '当前没有可用的插件。';
  }

  let result = '你可以使用的插件列表：\n\n';

  plugins.forEach((plugin, index) => {
    const config = configs.get(plugin.id);
    result += `${index + 1}. ${plugin.name}（${plugin.id}）\n`;
    result += `   描述：${plugin.description}\n`;
    result += `   版本：${plugin.version}\n`;
    result += `   状态：${plugin.status}\n`;
    result += `   可配置：${plugin.isCustomizable ? '是' : '否'}\n`;

    if (config) {
      result += `   当前配置：${JSON.stringify(config, null, 2)}\n`;
    }

    result += '\n';
  });

  result += '\n使用说明：\n';
  result += '- 使用插件前，确认 Agent B 已开发完成\n';
  result += '- 根据领域特性配置插件的业务参数\n';
  result += '- 记录每次插件使用的效果\n';
  result += '- 向 Agent B 反馈插件使用情况';

  return result;
}
