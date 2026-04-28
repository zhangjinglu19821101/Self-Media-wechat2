/**
 * 权威站点白名单配置
 *
 * 保险/金融/法律领域权威信息来源，按领域分组
 * 调用方可指定领域组合，系统自动拼接为 sites 参数
 */

import type { DomainKey } from './types';

/** 站点领域组 */
export interface DomainGroup {
  key: DomainKey;
  label: string;
  sites: string[];
  description: string;
}

/** 全部领域组定义 */
export const DOMAIN_GROUPS: DomainGroup[] = [
  {
    key: 'regulatory',
    label: '监管机构',
    sites: ['www.nfra.gov.cn', 'pbc.gov.cn', 'csrc.gov.cn'],
    description: '国家金融监督管理总局、中国人民银行、证监会',
  },
  {
    key: 'media',
    label: '官方媒体',
    sites: ['xinhuanet.com', 'people.com.cn', 'news.cctv.com'],
    description: '新华网、人民网、央视新闻',
  },
  {
    key: 'finance',
    label: '财经媒体',
    sites: ['caixin.com', 'ce.cn', 'jjckb.cn'],
    description: '财新网、中国经济网、经济参考报',
  },
  {
    key: 'insurance',
    label: '保险行业',
    sites: ['iachina.cn'],
    description: '中国保险行业协会',
  },
  {
    key: 'law',
    label: '法律法规',
    sites: ['flk.npc.gov.cn', 'court.gov.cn'],
    description: '国家法律法规数据库、最高人民法院',
  },
  {
    key: 'knowledge',
    label: '知识百科',
    sites: ['baike.baidu.com'],
    description: '百度百科（基础概念查证）',
  },
  {
    key: 'data',
    label: '统计数据',
    sites: ['stats.gov.cn'],
    description: '国家统计局',
  },
];

/** 领域 Key → 领域组映射（O(1) 查找） */
const DOMAIN_MAP = new Map(DOMAIN_GROUPS.map(g => [g.key, g]));

/** 默认搜索领域：监管 + 媒体 + 保险 + 法律 */
export const DEFAULT_DOMAINS: DomainKey[] = ['regulatory', 'media', 'insurance', 'law'];

/**
 * 根据领域列表拼接 sites 参数
 *
 * @param domains 领域列表，不传则使用默认领域
 * @returns 逗号分隔的站点字符串，如 "cbirc.gov.cn,xinhuanet.com"
 */
export function getSitesForDomains(domains?: DomainKey[]): string {
  const targetDomains = domains?.length ? domains : DEFAULT_DOMAINS;
  const sites = targetDomains
    .map(key => DOMAIN_MAP.get(key))
    .filter((g): g is DomainGroup => !!g)
    .flatMap(g => g.sites);
  // 去重
  return Array.from(new Set(sites)).join(',');
}

/**
 * 获取领域标签（前端展示用）
 */
export function getDomainLabel(key: DomainKey): string {
  return DOMAIN_MAP.get(key)?.label ?? key;
}

/**
 * 获取领域描述
 */
export function getDomainDescription(key: DomainKey): string {
  return DOMAIN_MAP.get(key)?.description ?? '';
}

/**
 * 获取所有可选领域（前端下拉用）
 */
export function getAllDomainOptions(): { key: DomainKey; label: string; description: string }[] {
  return DOMAIN_GROUPS.map(g => ({
    key: g.key,
    label: g.label,
    description: g.description,
  }));
}
