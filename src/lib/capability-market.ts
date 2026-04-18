/**
 * 能力市场管理器
 * 管理能力插件的版本、发布和交易
 */

import { CapabilityPlugin, PluginManifest, PluginRepository } from './capability-plugin';
import { Skill } from './agent-types';

/**
 * 能力包
 */
export interface CapabilityPackage {
  id: string;
  name: string;
  domain: string;
  version: string;
  description: string;
  author: string;
  price: number;
  skills: Skill[];
  plugins: string[]; // 插件 ID 列表
  publishedAt: string;
  updatedAt: string;
}

/**
 * 市场统计
 */
export interface MarketStats {
  totalPackages: number;
  totalDownloads: number;
  totalRevenue: number;
  popularPackages: string[];
}

/**
 * 订阅
 */
export interface Subscription {
  id: string;
  userId: string;
  packageId: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  status: 'active' | 'expired' | 'cancelled';
}

/**
 * 能力市场管理器
 */
export class CapabilityMarket {
  private packages: Map<string, CapabilityPackage> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private repositories: Map<string, PluginRepository> = new Map();

  /**
   * 发布能力包
   */
  publishPackage(pkg: CapabilityPackage): void {
    this.packages.set(pkg.id, pkg);
  }

  /**
   * 获取能力包
   */
  getPackage(packageId: string): CapabilityPackage | undefined {
    return this.packages.get(packageId);
  }

  /**
   * 列出能力包
   */
  listPackages(filter?: { domain?: string; agentId?: string; author?: string }): CapabilityPackage[] {
    let packages = Array.from(this.packages.values());

    if (filter?.domain) {
      packages = packages.filter((p) => p.domain === filter.domain);
    }

    if (filter?.author) {
      packages = packages.filter((p) => p.author === filter.author);
    }

    return packages.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  /**
   * 搜索能力包
   */
  searchPackages(query: string): CapabilityPackage[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.packages.values()).filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery) ||
        p.skills.some((s) => s.name.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 更新能力包
   */
  updatePackage(packageId: string, updates: Partial<CapabilityPackage>): CapabilityPackage {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`能力包不存在: ${packageId}`);
    }

    const updated = { ...pkg, ...updates, updatedAt: new Date().toISOString() };
    this.packages.set(packageId, updated);
    return updated;
  }

  /**
   * 删除能力包
   */
  deletePackage(packageId: string): void {
    this.packages.delete(packageId);
  }

  /**
   * 创建订阅
   */
  createSubscription(userId: string, packageId: string, duration: number = 30): Subscription {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`能力包不存在: ${packageId}`);
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

    const subscription: Subscription = {
      id: `sub_${Date.now()}_${userId}`,
      userId,
      packageId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      autoRenew: true,
      status: 'active',
    };

    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  /**
   * 获取订阅
   */
  getSubscription(subscriptionId: string): Subscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * 列出用户的订阅
   */
  listUserSubscriptions(userId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((s) => s.userId === userId);
  }

  /**
   * 取消订阅
   */
  cancelSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.status = 'cancelled';
      subscription.autoRenew = false;
    }
  }

  /**
   * 检查订阅状态
   */
  checkSubscription(userId: string, packageId: string): boolean {
    const subscriptions = this.listUserSubscriptions(userId);
    const now = new Date();

    return subscriptions.some(
      (s) =>
        s.packageId === packageId &&
        s.status === 'active' &&
        new Date(s.endDate) > now
    );
  }

  /**
   * 获取市场统计
   */
  getStats(): MarketStats {
    const totalPackages = this.packages.size;
    const totalDownloads = Array.from(this.packages.values()).reduce((sum, p) => sum + (p as any).downloads || 0, 0);
    const totalRevenue = Array.from(this.packages.values()).reduce((sum, p) => sum + (p as any).revenue || 0, 0);

    const popularPackages = Array.from(this.packages.values())
      .sort((a, b) => ((b as any).downloads || 0) - ((a as any).downloads || 0))
      .slice(0, 5)
      .map((p) => p.id);

    return {
      totalPackages,
      totalDownloads,
      totalRevenue,
      popularPackages,
    };
  }

  /**
   * 添加仓库
   */
  addRepository(repository: PluginRepository): void {
    this.repositories.set(repository.id, repository);
  }

  /**
   * 同步仓库
   */
  async syncRepository(repositoryId: string): Promise<void> {
    const repository = this.repositories.get(repositoryId);
    if (!repository) {
      throw new Error(`仓库不存在: ${repositoryId}`);
    }

    // TODO: 实际从仓库同步插件
    console.log(`同步仓库 ${repositoryId}`);
  }

  /**
   * 导出市场数据
   */
  exportData(): any {
    return {
      packages: Array.from(this.packages.values()),
      subscriptions: Array.from(this.subscriptions.values()),
      repositories: Array.from(this.repositories.values()),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * 导入市场数据
   */
  importData(data: any): void {
    if (data.packages) {
      for (const pkg of data.packages) {
        this.packages.set(pkg.id, pkg);
      }
    }

    if (data.subscriptions) {
      for (const sub of data.subscriptions) {
        this.subscriptions.set(sub.id, sub);
      }
    }

    if (data.repositories) {
      for (const repo of data.repositories) {
        this.repositories.set(repo.id, repo);
      }
    }
  }
}

/**
 * 单例
 */
export const capabilityMarket = new CapabilityMarket();

/**
 * 预定义能力包
 */
export function initializePredefinedPackages() {
  // 电商能力包
  capabilityMarket.publishPackage({
    id: 'ecommerce-capabilities',
    name: '电商能力包',
    domain: '电商',
    version: '1.0.0',
    description: '包含电商行业的通用能力：业务规则、技术栈、推广渠道、品牌调性',
    author: '电商运营团队',
    price: 8000,
    skills: [],
    plugins: ['ecommerce-business-rules', 'ecommerce-kpi', 'ecommerce-tech-stack', 'ecommerce-channels', 'ecommerce-brand-tone'],
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 金融能力包
  capabilityMarket.publishPackage({
    id: 'finance-capabilities',
    name: '金融能力包',
    domain: '金融',
    version: '1.0.0',
    description: '包含金融行业的通用能力：业务规则、技术栈、合规要求',
    author: '金融技术团队',
    price: 15000,
    skills: [],
    plugins: ['financial-business-rules', 'financial-kpi', 'financial-tech-stack', 'financial-security'],
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 医疗能力包
  capabilityMarket.publishPackage({
    id: 'medical-capabilities',
    name: '医疗能力包',
    domain: '医疗',
    version: '1.0.0',
    description: '包含医疗行业的通用能力：业务规则、技术栈、合规要求',
    author: '医疗技术团队',
    price: 20000,
    skills: [],
    plugins: ['medical-business-rules', 'medical-tech-stack', 'medical-security', 'medical-compliance'],
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
