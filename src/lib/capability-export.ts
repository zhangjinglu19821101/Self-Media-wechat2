/**
 * 能力导出系统
 * 支持基础能力和领域能力的导出和导入
 */

import { CapabilityPlugin } from './capability-plugin';
import { Skill } from './agent-types';
import { agentBuilder } from './agent-builder';
import { getBaseCapabilities, getDomainCapabilitiesTemplate } from './agent-capabilities';

/**
 * 导出格式
 */
export enum ExportFormat {
  JSON = 'json',
  YAML = 'yaml',
  TOML = 'toml',
}

/**
 * 导出范围
 */
export enum ExportScope {
  BASE = 'base',           // 仅基础能力
  DOMAIN = 'domain',       // 仅领域能力
  ALL = 'all',             // 所有能力
  SPECIFIC = 'specific',   // 特定能力
}

/**
 * 导出元数据
 */
export interface ExportMetadata {
  version: string;
  exportDate: string;
  exportScope: ExportScope;
  exportFormat: ExportFormat;
  agentId?: string;
  domain?: string;
  checksum: string;
  signature?: string;
}

/**
 * 基础能力导出包
 */
export interface BaseCapabilitiesExport {
  metadata: ExportMetadata;
  capabilities: {
    [agentId: string]: Skill[];
  };
}

/**
 * 领域能力导出包
 */
export interface DomainCapabilitiesExport {
  metadata: ExportMetadata;
  capabilities: {
    [domain: string]: {
      [agentId: string]: Skill[];
    };
  };
}

/**
 * 完整能力导出包
 */
export interface FullCapabilitiesExport {
  metadata: ExportMetadata;
  baseCapabilities: {
    [agentId: string]: Skill[];
  };
  domainCapabilities: {
    [domain: string]: {
      [agentId: string]: Skill[];
    };
  };
}

/**
 * 能力导出器
 */
export class CapabilityExporter {
  /**
   * 导出基础能力
   */
  exportBaseCapabilities(format: ExportFormat = ExportFormat.JSON): string {
    const capabilities: { [agentId: string]: Skill[] } = {};

    for (const agentId of ['A', 'B', 'C', 'D']) {
      capabilities[agentId] = getBaseCapabilities(agentId);
    }

    const exportData: BaseCapabilitiesExport = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        exportScope: ExportScope.BASE,
        exportFormat: format,
        checksum: this.calculateChecksum(capabilities),
      },
      capabilities,
    };

    return this.formatOutput(exportData, format);
  }

  /**
   * 导出领域能力
   */
  exportDomainCapabilities(
    domains?: string[],
    format: ExportFormat = ExportFormat.JSON
  ): string {
    const capabilities: {
      [domain: string]: {
        [agentId: string]: Skill[];
      };
    } = {};

    const targetDomains = domains || ['电商', '金融', '医疗'];

    for (const domain of targetDomains) {
      capabilities[domain] = {};
      for (const agentId of ['A', 'B', 'C', 'D']) {
        const skills = getDomainCapabilitiesTemplate(agentId, domain);
        if (skills.length > 0) {
          capabilities[domain][agentId] = skills;
        }
      }
    }

    const exportData: DomainCapabilitiesExport = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        exportScope: ExportScope.DOMAIN,
        exportFormat: format,
        domains: targetDomains,
        checksum: this.calculateChecksum(capabilities),
      },
      capabilities,
    };

    return this.formatOutput(exportData, format);
  }

  /**
   * 导出特定 Agent 的基础能力
   */
  exportAgentBaseCapabilities(
    agentId: string,
    format: ExportFormat = ExportFormat.JSON
  ): string {
    const capabilities = getBaseCapabilities(agentId);

    const exportData: BaseCapabilitiesExport = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        exportScope: ExportScope.BASE,
        exportFormat: format,
        agentId,
        checksum: this.calculateChecksum(capabilities),
      },
      capabilities: {
        [agentId]: capabilities,
      },
    };

    return this.formatOutput(exportData, format);
  }

  /**
   * 导出特定 Agent 的领域能力
   */
  exportAgentDomainCapabilities(
    agentId: string,
    domain?: string,
    format: ExportFormat = ExportFormat.JSON
  ): string {
    const capabilities: { [domain: string]: Skill[] } = {};

    if (domain) {
      const skills = getDomainCapabilitiesTemplate(agentId, domain);
      if (skills.length > 0) {
        capabilities[domain] = skills;
      }
    } else {
      // 导出所有领域
      for (const d of ['电商', '金融', '医疗']) {
        const skills = getDomainCapabilitiesTemplate(agentId, d);
        if (skills.length > 0) {
          capabilities[d] = skills;
        }
      }
    }

    const exportData: DomainCapabilitiesExport = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        exportScope: ExportScope.DOMAIN,
        exportFormat: format,
        agentId,
        domain,
        checksum: this.calculateChecksum(capabilities),
      },
      capabilities: {
        [agentId]: capabilities,
      },
    };

    return this.formatOutput(exportData, format);
  }

  /**
   * 导出所有能力（基础 + 领域）
   */
  exportAllCapabilities(format: ExportFormat = ExportFormat.JSON): string {
    const baseCapabilities: { [agentId: string]: Skill[] } = {};
    const domainCapabilities: {
      [domain: string]: {
        [agentId: string]: Skill[];
      };
    } = {};

    // 导出基础能力
    for (const agentId of ['A', 'B', 'C', 'D']) {
      baseCapabilities[agentId] = getBaseCapabilities(agentId);
    }

    // 导出领域能力
    for (const domain of ['电商', '金融', '医疗']) {
      domainCapabilities[domain] = {};
      for (const agentId of ['A', 'B', 'C', 'D']) {
        const skills = getDomainCapabilitiesTemplate(agentId, domain);
        if (skills.length > 0) {
          domainCapabilities[domain][agentId] = skills;
        }
      }
    }

    const exportData: FullCapabilitiesExport = {
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        exportScope: ExportScope.ALL,
        exportFormat: format,
        checksum: this.calculateChecksum({ baseCapabilities, domainCapabilities }),
      },
      baseCapabilities,
      domainCapabilities,
    };

    return this.formatOutput(exportData, format);
  }

  /**
   * 格式化输出
   */
  private formatOutput(data: any, format: ExportFormat): string {
    switch (format) {
      case ExportFormat.JSON:
        return JSON.stringify(data, null, 2);
      case ExportFormat.YAML:
        // 简化的 YAML 输出
        return this.toYAML(data);
      case ExportFormat.TOML:
        // 简化的 TOML 输出
        return this.toTOML(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * 计算 checksum
   */
  private calculateChecksum(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 简化的 YAML 转换
   */
  private toYAML(data: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    let output = '';

    if (Array.isArray(data)) {
      for (const item of data) {
        output += `${spaces}- ${this.toYAML(item, indent + 1).trim()}\n`;
      }
    } else if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null) {
          output += `${spaces}${key}:\n${this.toYAML(value, indent + 1)}`;
        } else {
          output += `${spaces}${key}: ${JSON.stringify(value)}\n`;
        }
      }
    } else {
      output += String(data);
    }

    return output;
  }

  /**
   * 简化的 TOML 转换
   */
  private toTOML(data: any, section?: string): string {
    let output = '';

    if (section) {
      output += `[${section}]\n`;
    }

    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            output += `${key} = ${JSON.stringify(value)}\n`;
          } else {
            output += this.toTOML(value, section ? `${section}.${key}` : key);
          }
        } else {
          output += `${key} = ${JSON.stringify(value)}\n`;
        }
      }
    }

    return output;
  }
}

/**
 * 单例
 */
export const capabilityExporter = new CapabilityExporter();

/**
 * 导出摘要信息
 */
export interface ExportSummary {
  agentId?: string;
  domain?: string;
  scope: ExportScope;
  baseCapabilitiesCount: number;
  domainCapabilitiesCount: number;
  totalCapabilitiesCount: number;
  exportSize: number;
  checksum: string;
}

/**
 * 生成导出摘要
 */
export function generateExportSummary(exportData: any): ExportSummary {
  const metadata = exportData.metadata;
  let baseCount = 0;
  let domainCount = 0;

  if (metadata.exportScope === ExportScope.BASE || metadata.exportScope === ExportScope.ALL) {
    if (exportData.baseCapabilities) {
      for (const agentId of Object.keys(exportData.baseCapabilities)) {
        baseCount += exportData.baseCapabilities[agentId].length;
      }
    } else if (exportData.capabilities) {
      for (const agentId of Object.keys(exportData.capabilities)) {
        baseCount += exportData.capabilities[agentId].length;
      }
    }
  }

  if (metadata.exportScope === ExportScope.DOMAIN || metadata.exportScope === ExportScope.ALL) {
    if (exportData.domainCapabilities) {
      for (const domain of Object.keys(exportData.domainCapabilities)) {
        for (const agentId of Object.keys(exportData.domainCapabilities[domain])) {
          domainCount += exportData.domainCapabilities[domain][agentId].length;
        }
      }
    } else if (exportData.capabilities) {
      for (const domain of Object.keys(exportData.capabilities)) {
        for (const agentId of Object.keys(exportData.capabilities[domain])) {
          domainCount += exportData.capabilities[domain][agentId].length;
        }
      }
    }
  }

  return {
    agentId: metadata.agentId,
    domain: metadata.domain,
    scope: metadata.exportScope,
    baseCapabilitiesCount: baseCount,
    domainCapabilitiesCount: domainCount,
    totalCapabilitiesCount: baseCount + domainCount,
    exportSize: JSON.stringify(exportData).length,
    checksum: metadata.checksum,
  };
}
