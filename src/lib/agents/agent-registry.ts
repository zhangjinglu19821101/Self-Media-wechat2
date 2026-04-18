/**
 * Agent 注册中心 - 统一管理所有 Agent 的注册、分类和查询
 * 
 * 设计原则：
 * 1. 新增平台 Agent 时，只需在 WRITING_AGENTS / PLATFORM_EXECUTOR_MAP 中添加一条配置
 * 2. 所有 "是否为写作 Agent" 的判断统一使用 isWritingAgent()
 * 3. 所有 "平台 → 执行 Agent" 的映射统一使用 getExecutorForPlatform()
 * 4. 所有 "Agent → 平台" 的反向映射统一使用 getPlatformForExecutor()
 */

import { PlatformType } from '@/lib/db/schema/style-template';

// ==================== 写作 Agent 注册表 ====================

/**
 * 所有写作类 Agent 的 executor ID 列表
 * 
 * 新增平台 Agent 时只需在此添加一条，下游所有 isWritingAgent() 判断自动生效。
 * 对应的消费端包括：
 * - extractResultTextFromResultData（result_text 提取）
 * - 合规校验触发（command-result-service / agent-task）
 * - 文章内容保存（article-content-service）
 * - 风格沉淀（style-deposition-service）
 * - 任务分配（task-assignment-service）
 * - LLM 模型选择（agent-llm）
 */
export const WRITING_AGENTS = [
  'insurance-d',              // 微信公众号长文
  'insurance-xiaohongshu',    // 小红书图文笔记
  'insurance-zhihu',          // 知乎回答/文章
  'insurance-toutiao',        // 今日头条文章
] as const;

/** 写作 Agent ID 类型（从 WRITING_AGENTS 派生） */
export type WritingAgentId = typeof WRITING_AGENTS[number];

/**
 * 写作 Agent ID 字符串数组（用于 .includes() 调用）
 * 
 * WRITING_AGENTS 是 readonly tuple，不能直接用于 Array.includes()。
 * 此常量提供普通 string[]，便于前端和后端的 .includes() 判断。
 */
export const WRITING_AGENT_IDS: string[] = [...WRITING_AGENTS];

/**
 * 判断是否为写作类 Agent
 * @param executor Agent executor ID
 * @returns 是否为写作 Agent
 */
export function isWritingAgent(executor: string | undefined | null): boolean {
  if (!executor) return false;
  return (WRITING_AGENTS as readonly string[]).includes(executor);
}

// ==================== 平台内容字段映射 ====================

/**
 * 平台内容字段映射表
 * 
 * 🔥🔥🔥 核心设计：定义每个平台在 resultContent 中的主内容字段
 * 
 * 用途：
 * - extractResultTextFromResultData：根据平台提取正确的正文内容
 * - 新增平台时只需在此添加字段名，无需修改提取逻辑
 * 
 * 字段说明：
 * - contentField: 主内容字段（用于 result_text 提取）
 * - format: 内容格式（html / text / json）
 * - description: 字段用途说明
 */
export const PLATFORM_CONTENT_FIELDS: Record<string, {
  contentField: string;
  format: 'html' | 'text' | 'json';
  description: string;
}> = {
  'insurance-d': {
    contentField: 'articleHtml',
    format: 'html',
    description: '公众号文章 HTML（包含样式标签）',
  },
  'insurance-xiaohongshu': {
    contentField: 'content',
    format: 'text',
    description: '小红书正文（纯文本，platformData 包含图文卡片）',
  },
  'insurance-zhihu': {
    contentField: 'content',
    format: 'text',
    description: '知乎回答正文（Markdown 格式）',
  },
  'insurance-toutiao': {
    contentField: 'content',
    format: 'text',
    description: '头条文章正文',
  },
};

/**
 * 获取平台的内容字段配置
 * @param executor Agent executor ID
 * @returns 内容字段配置，未知平台返回默认配置
 */
export function getPlatformContentField(executor: string | undefined | null): {
  contentField: string;
  format: 'html' | 'text' | 'json';
  description: string;
} {
  if (executor && PLATFORM_CONTENT_FIELDS[executor]) {
    return PLATFORM_CONTENT_FIELDS[executor];
  }
  // 默认配置：使用 content 字段
  return {
    contentField: 'content',
    format: 'text',
    description: '默认正文内容',
  };
}

// ==================== 平台 ↔ 执行 Agent 映射 ====================

/**
 * 平台 → 执行 Agent 映射表
 * 
 * 新增平台时只需在此添加一条映射：
 * - 知乎 → insurance-zhihu
 * - 头条 → insurance-toutiao
 * 
 * 用途：
 * - simple-split/route.ts：根据账号平台选择执行 Agent
 * - flow-templates.ts：流程模板的 executor 字段
 */
export const PLATFORM_EXECUTOR_MAP: Record<PlatformType, string> = {
  wechat_official: 'insurance-d',
  xiaohongshu: 'insurance-xiaohongshu',
  zhihu: 'insurance-zhihu',
  douyin: 'insurance-toutiao',
  weibo: 'insurance-toutiao',   // 微博暂复用头条 Agent（短图文风格接近）
};

/**
 * 执行 Agent → 平台 反向映射（自动从 PLATFORM_EXECUTOR_MAP 派生）
 */
export const EXECUTOR_PLATFORM_MAP: Record<string, PlatformType> = {};
for (const [platform, executor] of Object.entries(PLATFORM_EXECUTOR_MAP)) {
  // 避免重复覆盖（如 douyin 和 weibo 都映射到 insurance-toutiao，取第一个）
  if (!EXECUTOR_PLATFORM_MAP[executor]) {
    EXECUTOR_PLATFORM_MAP[executor] = platform as PlatformType;
  }
}

/**
 * 根据平台获取对应的执行 Agent ID
 * @param platform 平台类型
 * @param fallback 兜底 Agent ID（默认 insurance-d）
 * @returns 执行 Agent ID
 */
export function getExecutorForPlatform(platform: string | undefined | null, fallback: string = 'insurance-d'): string {
  if (!platform) return fallback;
  const mapped = PLATFORM_EXECUTOR_MAP[platform as PlatformType];
  if (mapped) return mapped;
  // 未知平台：记录告警并使用兜底值
  console.warn(`[agent-registry] 未知平台: "${platform}"，使用兜底 Agent: ${fallback}。已知平台: ${Object.keys(PLATFORM_EXECUTOR_MAP).join(', ')}`);
  return fallback;
}

/**
 * 根据执行 Agent ID 获取对应的平台类型
 * @param executor Agent executor ID
 * @param fallback 兜底平台类型（默认 wechat_official）
 * @returns 平台类型
 */
export function getPlatformForExecutor(executor: string | undefined | null, fallback: PlatformType = 'wechat_official'): PlatformType {
  if (!executor) return fallback;
  const mapped = EXECUTOR_PLATFORM_MAP[executor];
  if (mapped) return mapped;
  console.warn(`[agent-registry] 未知执行 Agent: "${executor}"，使用兜底平台: ${fallback}`);
  return fallback;
}

// ==================== Agent 显示信息 ====================

/**
 * 写作 Agent 的显示信息（前端 UI 渲染用）
 */
export const WRITING_AGENT_INFO: Record<WritingAgentId, { name: string; platform: PlatformType; description: string }> = {
  'insurance-d': {
    name: '公众号创作专家',
    platform: 'wechat_official',
    description: '擅长保险科普长文，HTML 格式输出',
  },
  'insurance-xiaohongshu': {
    name: '小红书创作专家',
    platform: 'xiaohongshu',
    description: '擅长图文笔记，JSON 格式输出（标题/要点/正文/标签）',
  },
  'insurance-zhihu': {
    name: '知乎创作专家',
    platform: 'zhihu',
    description: '擅长专业深度回答与文章，Markdown 格式输出',
  },
  'insurance-toutiao': {
    name: '头条创作专家',
    platform: 'douyin',
    description: '擅长信息流文章，标题党+短段落+强节奏',
  },
};

/**
 * 获取写作 Agent 的显示名称
 */
export function getWritingAgentName(executor: string): string {
  return (WRITING_AGENT_INFO as Record<string, { name: string; platform: PlatformType; description: string }>)[executor]?.name || executor;
}

/**
 * 获取写作 Agent 的平台类型
 */
export function getWritingAgentPlatform(executor: string): PlatformType {
  return (WRITING_AGENT_INFO as Record<string, { name: string; platform: PlatformType; description: string }>)[executor]?.platform || 'wechat_official';
}
