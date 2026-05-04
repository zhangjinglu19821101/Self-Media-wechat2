/**
 * Agent 任务列表组件（正常版）
 * 显示指定 Agent 的待执行任务列表 - 正常尺寸
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Clock, AlertTriangle, ChevronRight, ChevronDown, ChevronUp, Calendar, ListTodo, UserCheck, MessageSquare, Terminal, Send, Loader2, RefreshCw, Filter, XCircle, Users, Eye, Rocket, Folder, FileText, PenTool, ShieldCheck, Cpu, Sparkles, ChevronDownIcon, Bot, BookOpen, Lock, Layers, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import Link from 'next/link';
import { XiaohongshuPreview } from '@/components/xiaohongshu-preview';
import { ArticlePreviewEditor, PreviewPlatform } from '@/components/article-preview-editor';
import { WRITING_AGENT_IDS, isWritingAgent } from '@/lib/agents/agent-registry';
import { PLATFORM_LABELS } from '@/lib/db/schema/style-template';

/** 平台标签映射（从 style-template 复用） */
const PLATFORM_LABELS_MAP: Record<string, string> = PLATFORM_LABELS;

// 🔥 Agent B 决策类型定义（与 agent-b-response.ts 保持一致）
type AgentBDecisionType = 'EXECUTE_MCP' | 'COMPLETE' | 'NEED_USER' | 'FAILED' | 'REEXECUTE_EXECUTOR' | '';

interface Task {
  id: string;
  taskTitle: string;
  taskDescription: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'waiting_user' | 'blocked';
  priority: 'high' | 'normal' | 'low';
  orderIndex: number;
  isCritical: boolean;
  executor: string;
  fromParentsExecutor?: string;  // 写作 Agent 类型（用于平台推断）
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  executionResult?: string;
  statusProof?: string;
  articleMetadata?: any;
  userOpinion?: string;
  originalInstruction?: string;  // 🔥 【Step4 新增】用户原始指令
  metadata: {
    acceptanceCriteria?: string;
    [key: string]: any;
  };
  relatedDailyTask?: {
    id: string;
    taskId: string;
    executionDate: string;
    executionDeadlineStart: string;
    executionDeadlineEnd: string;
    deliverables?: string;
  };
  commandResultId?: string;
}

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  waiting_user: number;
  critical: number;
}

interface AgentTaskListNormalProps {
  agentId: string;
  showPanel: boolean;
  onTogglePanel?: () => void;
  refreshKey?: number;
}

interface StepHistory {
  id: number;
  commandResultId: string;
  stepNo: number;
  interactContent: any;
  interactUser: string;
  interactTime: string;
  interactNum: number;
}

interface McpExecution {
  id: number;
  stepHistoryId: number;
  toolName?: string;
  actionName?: string;
  reasoning?: string;
  strategy?: string;
  params?: any;
  resultStatus: string;
  resultData?: any;
  errorMessage?: string;
  attemptTimestamp: string;
  executionTimeMs: number;
}

interface TaskDetail {
  task: Task;
  stepHistory: StepHistory[];
  mcpExecutions: McpExecution[];
}

/**
 * Agent 类型配置表 - 可扩展，新增Agent只需在此处添加
 * 
 * 角色分类：
 *   - executor: 执行者（创作、合规、处理等）
 *   - reviewer: 评审官（Agent B）
 *   - technical: 技术顾问（Agent T）
 */
const AGENT_CONFIG_MAP: Record<string, {
  icon: typeof PenTool;
  label: string;           // 技术名（系统内部用）
  friendlyLabel: string;   // 友好名（用户可见）
  statusText: string;
  statusEmoji: string;
  role: 'executor' | 'reviewer' | 'technical';
  color: 'emerald' | 'sky' | 'slate' | 'violet' | 'amber' | 'rose';
  sectionLabel: string;    // briefResponse 的标题
  evalLabel: string;       // selfEvaluation 的标题
  processLabel: string;    // actionsTaken 的标题
}> = {
  // ── 执行类 Agent（executor）─
  'insurance-d': {
    icon: PenTool,
    label: 'insurance-d',
    friendlyLabel: '创作专家',
    statusText: '创作完成',
    statusEmoji: '📝',
    role: 'executor',
    color: 'emerald',
    sectionLabel: '创作总结',
    evalLabel: '质量自评',
    processLabel: '执行过程',
  },
  'insurance-xiaohongshu': {
    icon: BookOpen,
    label: 'insurance-xiaohongshu',
    friendlyLabel: '小红书创作专家',
    statusText: '图文创作完成',
    statusEmoji: '📕',
    role: 'executor',
    color: 'rose',
    sectionLabel: '图文创作总结',
    evalLabel: '质量自评',
    processLabel: '执行过程',
  },
  'insurance-zhihu': {
    icon: BookOpen,
    label: 'insurance-zhihu',
    friendlyLabel: '知乎创作专家',
    statusText: '文章创作完成',
    statusEmoji: '🔵',
    role: 'executor',
    color: 'sky',
    sectionLabel: '创作总结',
    evalLabel: '质量自评',
    processLabel: '执行过程',
  },
  'insurance-toutiao': {
    icon: PenTool,
    label: 'insurance-toutiao',
    friendlyLabel: '头条创作专家',
    statusText: '文章创作完成',
    statusEmoji: '📱',
    role: 'executor',
    color: 'amber',
    sectionLabel: '创作总结',
    evalLabel: '质量自评',
    processLabel: '执行过程',
  },
  'insurance-c': {
    icon: ShieldCheck,
    label: 'insurance-c',
    friendlyLabel: '合规校验官',
    statusText: '合规检查完成',
    statusEmoji: '🛡️',
    role: 'executor',
    color: 'violet',
    sectionLabel: '检查总结',
    evalLabel: '合规评估',
    processLabel: '检查过程',
  },
  // 🔴 虚拟执行器：用户预览修改节点
  'user_preview_edit': {
    icon: Eye,
    label: 'user_preview_edit',
    friendlyLabel: '预览修改',
    statusText: '等待确认',
    statusEmoji: '👁️',
    role: 'executor',
    color: 'violet',
    sectionLabel: '预览结果',
    evalLabel: '修改记录',
    processLabel: '确认过程',
  },
  // 🔴 去AI化优化专家
  'deai-optimizer': {
    icon: Sparkles,
    label: 'deai-optimizer',
    friendlyLabel: '去AI化优化',
    statusText: '优化完成',
    statusEmoji: '✨',
    role: 'executor',
    color: 'sky',
    sectionLabel: '优化总结',
    evalLabel: '优化评估',
    processLabel: '优化过程',
  },
  'agent c': {
    icon: ShieldCheck,
    label: 'agent C',
    friendlyLabel: '合规助手',
    statusText: '合规检查完成',
    statusEmoji: '🛡️',
    role: 'executor',
    color: 'violet',
    sectionLabel: '检查总结',
    evalLabel: '合规评估',
    processLabel: '检查过程',
  },
  'agent d': {
    icon: FileText,
    label: 'agent D',
    friendlyLabel: '任务处理',
    statusText: '任务完成',
    statusEmoji: '✅',
    role: 'executor',
    color: 'amber',
    sectionLabel: '完成总结',
    evalLabel: '自我评价',
    processLabel: '执行过程',
  },

  // ── 评审类 Agent（reviewer）─
  'agent b': {
    icon: ShieldCheck,
    label: 'Agent B',
    friendlyLabel: '智能评审',
    statusText: '评审通过',
    statusEmoji: '✅',
    role: 'reviewer',
    color: 'sky',
    sectionLabel: '评审意见',
    evalLabel: '评估依据',
    processLabel: '评审过程',
  },

  // ── 技术类 Agent（technical）─
  'agent t': {
    icon: Cpu,
    label: 'Agent T',
    friendlyLabel: '技术专家',
    statusText: '分析完成',
    statusEmoji: '⚙️',
    role: 'technical',
    color: 'slate',
    sectionLabel: '分析结论',
    evalLabel: '风险评估',
    processLabel: '分析过程',
  },
};

/** 默认配置：未匹配到任何已知Agent时使用 */
const DEFAULT_AGENT_CONFIG = {
  icon: Bot,
  label: 'Agent',
  friendlyLabel: 'Agent',
  statusText: '执行完成',
  statusEmoji: '🤖',
  role: 'executor' as const,
  color: 'slate' as const,
  sectionLabel: '执行总结',
  evalLabel: '自我评价',
  processLabel: '执行过程',
};

/**
 * 缓存的正则表达式 Map，避免重复创建
 */
const regexCache = new Map<string, RegExp>();

/**
 * 检查 configKey 是否包含 key 作为独立单词
 * 例如：'agent t' 包含 't' 作为独立单词 → true
 * 但 'insurance-toutiao' 包含 't' 不是独立单词（在 'toutiao' 中）→ false
 */
const isWholeWordMatch = (configKey: string, key: string): boolean => {
  const cacheKey = `${configKey}:${key}`;
  let regex = regexCache.get(cacheKey);
  if (!regex) {
    // 使用正则表达式检查是否作为独立单词出现
    regex = new RegExp(`\\b${key}\\b`, 'i');
    regexCache.set(cacheKey, regex);
  }
  return regex.test(configKey);
};

/**
 * 根据 interactUser 查找 Agent 配置（模糊匹配）
 */
const findAgentConfig = (interactUser: string | undefined) => {
  if (!interactUser) return DEFAULT_AGENT_CONFIG;
  
  const key = interactUser.toLowerCase().trim();
  
  // 1. 精确匹配（包括别名）
  if (AGENT_CONFIG_MAP[key]) return AGENT_CONFIG_MAP[key];
  
  // 🔧 修复：精确别名映射（优先级高于包含匹配）
  // 数据库中可能存储的简写形式
  const EXACT_ALIAS_MAP: Record<string, string> = {
    't': 'agent t',      // interact_user = 'T'
    'b': 'agent b',      // interact_user = 'B'
    'd': 'insurance-d',  // interact_user = 'D'
    'c': 'agent c',      // interact_user = 'C'
  };
  if (EXACT_ALIAS_MAP[key] && AGENT_CONFIG_MAP[EXACT_ALIAS_MAP[key]]) {
    return AGENT_CONFIG_MAP[EXACT_ALIAS_MAP[key]];
  }
  
  // 2. 包含匹配（如 "insurance-d (v2)" 能匹配到 "insurance-d"）
  // 🔧 修复：按 configKey 长度降序排序，避免短 key 误匹配
  const sortedEntries = Object.entries(AGENT_CONFIG_MAP)
    .sort((a, b) => b[0].length - a[0].length);
  
  for (const [configKey, config] of sortedEntries) {
    // 🔧 修复：只有当 key 包含完整的 configKey，或者 configKey 精确包含 key 作为独立单词时才匹配
    if (key.includes(configKey) || isWholeWordMatch(configKey, key)) {
      return config;
    }
  }
  
  // 3. 未匹配 → 使用默认
  return { ...DEFAULT_AGENT_CONFIG, label: interactUser };
};

/**
 * 清理Agent返回内容中的无意义序号
 * 去除 "3、" "4." "Step 1:" 等格式
 */
const cleanAgentText = (text: string): string => {
  if (!text) return '';
  return text
    // 去除每行开头的中文序号：3、4、5、等
    .replace(/^[ \t]*[1-9][0-9]*[、.．:：]\s*/gm, '')
    // 去除 Step 1: / step 2: 等英文序号
    .replace(/^[ \t]*(?:step\s*)?[1-9][0-9]*[.:\s]+/gmi, '')
    // 去除 (1) (2) 等括号序号
    .replace(/^[ \t]*\([1-9][0-9]*\)[\s]*/gm, '')
    // 去除连续空行（保留一个）
    .replace(/\n{3,}/g, '\n\n')
    // 去除首尾空白
    .trim();
};

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'failed' | 'waiting_user';

// ========== 预览修改节点辅助函数和组件 ==========

/**
 * 判断任务是否为预览修改节点
 * 
 * 兼容两种情况：
 * 1. 新流程：executor === 'user_preview_edit'（标准虚拟执行器）
 * 2. 旧数据：executor 是写作 Agent，但标题包含"预览修改"
 * 
 * ⚠️ P0 修复：标题关键词匹配必须覆盖所有状态（不仅仅是 waiting_user/failed），
 * 否则旧数据中 completed 状态的预览修改节点会匹配到写作 Agent 的"发布文章"按钮，
 * 导致用户点击后跳转到错误的发布页面（内容是确认信息而非完整文章）。
 */
function isPreviewEditTask(task: Task): boolean {
  // 🔴 调试日志
  const result = task.executor === 'user_preview_edit' || 
    task.taskTitle?.includes('预览修改') || 
    task.taskTitle?.includes('预览终稿');
  console.log(`[isPreviewEditTask] taskId=${task.id}, executor=${task.executor}, taskTitle=${task.taskTitle}, result=${result}`);
  return result;
}

/**
 * 从任务中推断预览平台类型
 * 
 * 推断优先级：
 * 1. 当前任务的 metadata.platform
 * 2. 执行器类型（fromParentsExecutor）推断
 * 3. 从同组写作任务推断（需要传入 allTasks 参数）
 */
function getPreviewPlatform(task: Task, allTasks?: Task[]): PreviewPlatform {
  // 1. 优先从 metadata 获取
  const metadata = task.metadata || {};
  if (metadata.platform) {
    const p = metadata.platform as string;
    if (p === 'xiaohongshu') return 'xiaohongshu';
    if (p === 'zhihu') return 'zhihu';
    if (p === 'douyin' || p === 'toutiao') return 'douyin';
    if (p === 'weibo') return 'weibo';
    if (p === 'wechat_official') return 'wechat_official';
  }

  // 2. 从执行器类型推断
  const executor = task.executor || task.fromParentsExecutor || '';
  if (executor.includes('xiaohongshu')) return 'xiaohongshu';
  if (executor.includes('zhihu')) return 'zhihu';
  if (executor.includes('toutiao')) return 'douyin';

  // 3. 从同组写作任务推断（如果提供了任务列表）
  if (allTasks && task.commandResultId) {
    const writingTask = allTasks.find(t => 
      t.commandResultId === task.commandResultId && 
      isWritingAgent(t.executor || t.fromParentsExecutor || '')
    );
    if (writingTask) {
      const writingExecutor = writingTask.executor || writingTask.fromParentsExecutor || '';
      if (writingExecutor.includes('xiaohongshu')) return 'xiaohongshu';
      if (writingExecutor.includes('zhihu')) return 'zhihu';
      if (writingExecutor.includes('toutiao')) return 'douyin';
    }
    // 尝试从写作任务的 metadata 获取平台
    if (writingTask?.metadata?.platform) {
      const p = writingTask.metadata.platform as string;
      if (p === 'xiaohongshu') return 'xiaohongshu';
      if (p === 'zhihu') return 'zhihu';
      if (p === 'douyin' || p === 'toutiao') return 'douyin';
      if (p === 'weibo') return 'weibo';
    }
  }

  // 默认微信公众号
  return 'wechat_official';
}

/**
 * 预览修改节点专用组件
 * 
 * 封装 ArticlePreviewEditor + 提交决策逻辑
 */
function PreviewEditSection({
  taskId,
  platform,
  commandResultId,
  onComplete,
}: {
  taskId: string;
  platform: PreviewPlatform;
  commandResultId: string;  // 🔴 P0-1 修复：显式传入，不再依赖外层状态
  onComplete: (result: import('@/components/article-preview-editor').PreviewCompleteResult) => void;
}) {
  return (
    <div className="space-y-4">
      <h4 className="font-semibold mb-4 flex items-center gap-2 text-purple-900">
        <Eye className="w-5 h-5" />
        预览修改初稿
      </h4>
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-purple-800">
          请预览文章初稿。您可以修改内容后保存，或直接确认继续执行合规校验。
          修改后的版本将用于后续合规校验。
        </p>
      </div>
      <ArticlePreviewEditor
        taskId={taskId}
        platform={platform}
        onComplete={onComplete}
      />
    </div>
  );
}

// ========== 格式化日期等通用工具 ==========

/**
 * 格式化日期 - 工具函数，供所有组件使用
 */
const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Agent 自述卡片组件 - 顶级UI设计
 * 根据输出内容结构自适应展示：执行类格式 vs 评审类格式
 * 
 * 🔥 核心逻辑：
 * - Agent B 执行"风格分析"任务 → 输出执行类格式 → 用执行类展示
 * - Agent B 执行"评审"任务 → 输出评审类格式 → 用评审类展示
 * - insurance-d 等执行类 Agent → 用执行类展示
 */
function AgentSelfStatementCard({ history }: { history: StepHistory }) {
  const [showRawJson, setShowRawJson] = useState(false);
  
  // 安全提取 interactContent：支持字符串和对象两种格式
  let rawContent = history.interactContent;
  if (typeof rawContent === 'string') {
    try {
      rawContent = JSON.parse(rawContent);
    } catch (e) {
      rawContent = {};
    }
  }
  
  const content = rawContent;
  const responseContent = content?.responseContent || content;
  const interactUser = history.interactUser;
  
  // 判断Agent类型 - 使用可扩展的配置表（必须先执行，后续逻辑依赖）
  const agentConfig = findAgentConfig(interactUser);
  
  // ========== 🔥 关键改造：根据输出内容结构判断展示方式 ==========
  // 检查是否有执行类字段（风格分析等任务使用）
  const hasExecutorFields = !!(
    responseContent?.briefResponse ||
    responseContent?.resultSummary ||
    responseContent?.summary ||
    responseContent?.result ||
    responseContent?.selfEvaluation ||
    responseContent?.evaluation ||
    responseContent?.qualityAssessment ||
    responseContent?.actionsTaken ||
    responseContent?.actions ||
    responseContent?.steps ||
    responseContent?.executionSteps
  );
  
  // 检查是否有评审类字段（Agent B 评审任务使用）
  const hasReviewerFields = !!(
    responseContent?.reviewConclusion ||
    responseContent?.decisionBasis ||
    responseContent?.suggestedAction ||
    responseContent?.context?.suggestedAction ||
    responseContent?.suggestedExecutor
  );
  
  // 🔥 决策逻辑：执行类字段优先（风格分析任务）
  // 只有没有执行类字段，且有评审类字段时，才用评审类展示
  const isAgentBReviewer = agentConfig.role === 'reviewer' && !hasExecutorFields && hasReviewerFields;
  
  // ========== Agent B 评审类字段提取 ==========
  // 🔥 支持两种格式：AgentBOldFormat.type 和 AgentBUnifiedFormat.decisionType
  const decisionType: AgentBDecisionType = isAgentBReviewer 
    ? (responseContent?.type || responseContent?.decisionType || '') as AgentBDecisionType
    : '';
    
  const reviewConclusion = isAgentBReviewer 
    ? (responseContent?.reviewConclusion || '')
    : '';
  
  const executionSummary = isAgentBReviewer
    ? (responseContent?.context?.executionSummary || 
       responseContent?.executionSummary || 
       responseContent?.summary || '')
    : '';
  
  const decisionBasis = isAgentBReviewer
    ? (responseContent?.decisionBasis || 
       responseContent?.reasoning || 
       responseContent?.context?.decisionBasis || '')
    : '';
    
  const suggestedAction = isAgentBReviewer
    ? (responseContent?.suggestedAction || 
       responseContent?.context?.suggestedAction || 
       responseContent?.context?.suggestedExecutor || 
       responseContent?.suggestedExecutor || '')
    : '';
  
  // ========== 执行类 Agent 字段提取（风格分析等任务使用）==========
  const briefResponse = !isAgentBReviewer
    ? (responseContent?.briefResponse || 
       responseContent?.resultSummary ||
       responseContent?.summary ||
       responseContent?.result ||
       (typeof responseContent === 'string' ? responseContent.substring(0, 500) : '') ||
       '')
    : '';
    
  const selfEvaluation = !isAgentBReviewer
    ? (responseContent?.selfEvaluation || 
       responseContent?.evaluation ||
       responseContent?.qualityAssessment ||
       responseContent?.assessment ||
       '')
    : '';
    
  // actionsTaken - 支持多种可能的字段名和路径（包括 executionSummary 嵌套）
  const rawActionsTaken = !isAgentBReviewer
    ? (responseContent?.actionsTaken || 
       responseContent?.executionSummary?.actionsTaken ||
       responseContent?.actions ||
       responseContent?.steps ||
       responseContent?.executionSteps ||
       responseContent?.process ||
       responseContent?.workflow ||
       '')
    : '';
  
  // 处理 actionsTaken：数组转字符串，或直接使用字符串
  const actionsTaken = Array.isArray(rawActionsTaken)
    ? rawActionsTaken.map((item: string, index: number) => `${index + 1}. ${item}`).join('\n')
    : (rawActionsTaken || '');
  
  // 🔍 调试：输出完整数据结构（开发时可查看控制台）
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.group(`🔍 [Agent自述卡片] ${interactUser || 'Unknown'}`);
    console.log('完整 content:', JSON.stringify(content, null, 2));
    console.log('responseContent:', JSON.stringify(responseContent, null, 2));
    console.log('提取结果:', { briefResponse: briefResponse?.substring(0, 50), selfEvaluation: selfEvaluation?.substring(0, 50), actionsTaken: actionsTaken?.substring(0, 50) });
    console.groupEnd();
  }
  
  // 颜色映射（用于动态className）
  const colorMap = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', tagBg: 'bg-emerald-50', tagText: 'text-emerald-600', cardBorder: 'border-emerald-200', cardBg: 'bg-emerald-50/40' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', iconBg: 'bg-sky-100', iconText: 'text-sky-600', tagBg: 'bg-sky-50', tagText: 'text-sky-600', cardBorder: 'border-sky-200', cardBg: 'bg-sky-50/40' },
    slate: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', iconBg: 'bg-slate-100', iconText: 'text-slate-600', tagBg: 'bg-slate-100', tagText: 'text-slate-500', cardBorder: 'border-slate-200', cardBg: 'bg-slate-50/60' },
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', iconBg: 'bg-violet-100', iconText: 'text-violet-600', tagBg: 'bg-violet-50', tagText: 'text-violet-600', cardBorder: 'border-violet-200', cardBg: 'bg-violet-50/40' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', iconBg: 'bg-amber-100', iconText: 'text-amber-600', tagBg: 'bg-amber-50', tagText: 'text-amber-600', cardBorder: 'border-amber-200', cardBg: 'bg-amber-50/40' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', iconBg: 'bg-rose-100', iconText: 'text-rose-600', tagBg: 'bg-rose-50', tagText: 'text-rose-600', cardBorder: 'border-rose-200', cardBg: 'bg-rose-50/40' },
  };
  
  // 🔥 Agent B 动态状态计算（根据 decisionType）
  const getAgentBStatusInfo = (type: AgentBDecisionType): { text: string; emoji: string; colorOverride?: 'emerald' | 'amber' | 'rose' | 'sky' } => {
    switch (type) {
      case 'COMPLETE':
        return { text: '评审通过', emoji: '✅', colorOverride: 'emerald' };
      case 'REEXECUTE_EXECUTOR':
        return { text: '需重新执行', emoji: '⚠️', colorOverride: 'amber' };
      case 'NEED_USER':
        return { text: '需用户介入', emoji: '👤', colorOverride: 'sky' };
      case 'FAILED':
        return { text: '执行失败', emoji: '❌', colorOverride: 'rose' };
      case 'EXECUTE_MCP':
        return { text: '需调用工具', emoji: '🔧', colorOverride: 'sky' };
      default:
        return { text: '评审中', emoji: '⏳' };
    }
  };

  // 🔥🔥🔥 【新增】执行类 Agent 动态状态计算（根据 isTaskDown / isCompleted）
  const getExecutorStatusInfo = (): { text: string; emoji: string; colorOverride?: 'emerald' | 'amber' | 'rose' | 'sky' } | null => {
    // 只对执行类 Agent 生效
    if (isAgentBReviewer) return null;
    
    // 从 responseContent 中提取状态字段
    const isTaskDown = responseContent?.isTaskDown;
    const isCompleted = responseContent?.isCompleted;
    const isNeedMcp = responseContent?.isNeedMcp;
    
    // 根据状态返回对应显示
    if (isTaskDown === true || isCompleted === true) {
      // 任务完成：使用静态配置的完成状态
      return null;  // 返回 null 会使用静态配置
    }
    
    if (isNeedMcp === true) {
      return { text: '需调用工具', emoji: '🔧', colorOverride: 'sky' };
    }
    
    if (isCompleted === false && isTaskDown === false) {
      // 明确未完成
      return { text: '任务未完成', emoji: '⚠️', colorOverride: 'amber' };
    }
    
    // 默认：使用静态配置
    return null;
  };

  // 🔥 Agent B 评审任务使用动态状态，执行类 Agent 也使用动态状态
  const dynamicStatus = isAgentBReviewer 
    ? getAgentBStatusInfo(decisionType) 
    : getExecutorStatusInfo();
  const displayStatusText = dynamicStatus?.text || agentConfig.statusText;
  const displayStatusEmoji = dynamicStatus?.emoji || agentConfig.statusEmoji;
  const displayColor = dynamicStatus?.colorOverride || agentConfig.color;
  const c = colorMap[displayColor];
  
  const IconComponent = agentConfig.icon;
  
  return (
    <div className={`${c.bg} ${c.border} border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md`}>
      {/* 头部：Agent身份 + 状态 */}
      <div className={`px-5 py-4 ${c.border} border-b bg-white/60`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center`}>
              <IconComponent className={`w-5 h-5 ${c.iconText}`} />
            </div>
            <div>
              <span className="font-semibold text-slate-800">{agentConfig.friendlyLabel}</span>
              {agentConfig.label !== agentConfig.friendlyLabel && (
                <span className="ml-2 text-xs text-slate-400 font-mono">
                  {agentConfig.label}
                </span>
              )}
              <span className="ml-2 text-sm font-medium text-slate-500">{displayStatusEmoji} {displayStatusText}</span>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            #{history.interactNum} · {formatDate(history.interactTime)}
          </span>
        </div>
      </div>
      
      {/* 主体：三段式自述 */}
      <div className="px-5 py-4 space-y-5">
        
        {/* ========== Agent B 评审专用展示 ========== */}
        {isAgentBReviewer ? (
          <>
            {/* 第一段：评审结论 (reviewConclusion) */}
            {reviewConclusion && (
              <div className="group">
                <div className="flex items-center gap-2 mb-2.5">
                  <ShieldCheck className={`w-4 h-4 ${c.iconText}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    评审结论
                  </span>
                  <div className="flex-1 h-px bg-slate-200/60" />
                </div>
                <div className={`pl-6 text-sm leading-relaxed whitespace-pre-wrap font-medium ${c.text}`}>
                  {reviewConclusion}
                </div>
              </div>
            )}
            
            {/* 第二段：判断逻辑依据 (decisionBasis) */}
            {decisionBasis && (
              <div className="group">
                <div className="flex items-center gap-2 mb-2.5">
                  <Eye className={`w-4 h-4 ${c.iconText}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    判断依据
                  </span>
                  <div className="flex-1 h-px bg-slate-200/60" />
                </div>
                <div className="pl-6 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {decisionBasis}
                </div>
              </div>
            )}
            
            {/* 第三段：建议下一步指令 (suggestedAction) */}
            {suggestedAction && (
              <div className="group">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${c.iconBg}`}>
                    <ChevronRight className={`w-3.5 h-3.5 ${c.iconText}`} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    建议下一步
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.tagBg} ${c.tagText}`}>
                    指令
                  </span>
                  <div className="flex-1 h-px bg-slate-200/60" />
                </div>
                <div className={`ml-7 p-4 rounded-lg border ${c.cardBorder} ${c.cardBg} transition-all duration-200 hover:shadow-sm`}>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap font-medium ${c.text}`}>
                    {suggestedAction}
                  </p>
                </div>
              </div>
            )}
            
            {/* Agent B 无数据兜底 */}
            {!reviewConclusion && !decisionBasis && !suggestedAction && (
              <div className="pl-6 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {typeof responseContent === 'string' ? responseContent : JSON.stringify(responseContent, null, 2)}
              </div>
            )}
          </>
        ) : (
          <>
            {/* ========== 执行类 Agent 通用展示 ========== */}
            {/* 第一段：总结/结论 (briefResponse) */}
            {briefResponse && (
              <div className="group">
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className={`w-4 h-4 ${c.iconText}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {agentConfig.sectionLabel}
                  </span>
                  <div className="flex-1 h-px bg-slate-200/60" />
                </div>
                <div className="pl-6 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {briefResponse}
                </div>
              </div>
            )}
            
            {/* 第二段：自我评价 (selfEvaluation) */}
            {selfEvaluation && (
              <div className="group">
                <div className="flex items-center gap-2 mb-2.5">
                  <Eye className={`w-4 h-4 ${c.iconText}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {agentConfig.evalLabel}
                  </span>
                  <div className="flex-1 h-px bg-slate-200/60" />
                </div>
                <div className="pl-6 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selfEvaluation}
                </div>
              </div>
            )}
            
            {/* 第三段：执行过程/完成证据 (actionsTaken) */}
            {actionsTaken && (
              <div className="group">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${c.iconBg}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${c.iconText}`} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {agentConfig.processLabel}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.tagBg} ${c.tagText}`}>
                    证据
                  </span>
                  <div className="flex-1 h-px bg-slate-200/60" />
                </div>
                <div className={`ml-7 p-4 rounded-lg border ${c.cardBorder} ${c.cardBg} transition-all duration-200 hover:shadow-sm`}>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {actionsTaken}
                  </p>
                </div>
              </div>
            )}
            
            {/* 执行类 Agent 无数据兜底 */}
            {!briefResponse && !selfEvaluation && !actionsTaken && (
              <div className="pl-6 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {typeof responseContent === 'string' ? responseContent : JSON.stringify(responseContent, null, 2)}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* 底部：折叠的原始JSON */}
      <div className={`px-5 py-3 ${c.border} border-t bg-slate-50/50`}>
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5" />
          原始JSON数据
          <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${showRawJson ? 'rotate-180' : ''}`} />
        </button>
        {showRawJson && (
          <pre className="mt-2 text-[11px] text-slate-500 bg-white rounded-md p-3 overflow-auto max-h-48 border border-slate-100">
            {JSON.stringify(content, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export function AgentTaskListNormal({ agentId, showPanel, onTogglePanel, refreshKey }: AgentTaskListNormalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [userDecision, setUserDecision] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [executorFilter, setExecutorFilter] = useState<string>('all');
  
  // 🔥 新增：执行者选择相关状态
  const [selectedExecutor, setSelectedExecutor] = useState<string>('');
  const [executorOptions, setExecutorOptions] = useState<any[]>([]);
  const [loadingExecutorOptions, setLoadingExecutorOptions] = useState(false);

  // 🔥 手动解锁 blocked 任务相关状态
  const [manualArticleContent, setManualArticleContent] = useState('');
  const [manualArticleTitle, setManualArticleTitle] = useState('');
  const [manualUnblockSubmitting, setManualUnblockSubmitting] = useState(false);

  // 🔥🔥🔥 双层折叠状态
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set(['today', 'yesterday', 'dayBeforeYesterday', 'earlier'])); // 默认展开所有日期分组
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set()); // 展开的任务

  // 🔥 客户端挂载标记 — 解决 SSR 时区差异问题
  // SSR 时 new Date() 用 UTC 时区，客户端用本地时区，导致日期分组计算不一致
  // mounted=true 后 useMemo 会在客户端用正确时区重新计算
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // 从任务列表中提取所有唯一的 executor
  const availableExecutors = useMemo(() => {
    const executors = new Set<string>();
    tasks.forEach(task => executors.add(task.executor));
    return ['all', ...Array.from(executors)];
  }, [tasks]);

  // 根据筛选条件过滤任务
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const statusMatch = statusFilter === 'all' || task.status === statusFilter;
      const executorMatch = executorFilter === 'all' || task.executor === executorFilter;
      return statusMatch && executorMatch;
    });
  }, [tasks, statusFilter, executorFilter]);

  // 基于当前筛选的统计
  const filteredStats = useMemo(() => {
    return {
      total: filteredTasks.length,
      pending: filteredTasks.filter(t => t.status === 'pending').length,
      in_progress: filteredTasks.filter(t => t.status === 'in_progress').length,
      waiting_user: filteredTasks.filter(t => t.status === 'waiting_user').length,
      completed: filteredTasks.filter(t => t.status === 'completed').length,
      failed: filteredTasks.filter(t => t.status === 'failed').length,
      critical: filteredTasks.filter(t => t.isCritical).length,
    };
  }, [filteredTasks]);

  // 🔥🔥🔥 我的待办高亮区（最醒目！）
  const actionableTasks = useMemo(() => {
    return tasks.filter(t =>
      t.status === 'pending' ||
      t.status === 'in_progress' ||
      t.status === 'waiting_user'
    ).sort((a, b) => {
      const priority = { waiting_user: 0, in_progress: 1, pending: 2 };
      return (priority[a.status as keyof typeof priority] ?? 3) - (priority[b.status as keyof typeof priority] ?? 3);
    });
  }, [tasks]);

  // 🔥🔥🔥 按主任务分组展示（commandResultId 分组）- 基于 filteredTasks
  const groupedTasks = useMemo(() => {
    const groups: { [key: string]: { 
      commandResultId: string;
      mainTaskTitle?: string;
      createdAt: string;
      subTasks: Task[];
      phase?: 'base_article' | 'platform_adaptation';  // 两阶段架构
      multiPlatformGroupId?: string;                     // 跨组关联ID
      adaptationPlatform?: string;                       // 适配目标平台
      sourceCommandResultId?: string;                    // 适配组的来源组
    } } = {};

    // 过滤掉 orderIndex 异常大的任务（>100），避免误导
    const validTasks = filteredTasks.filter(task => task.orderIndex <= 100);

    validTasks.forEach(task => {
      const key = task.commandResultId || task.id;
      if (!groups[key]) {
        // 获取主任务标题：从子任务的 taskTitle 中找有意义的文章主题
        const groupSubTasks = validTasks.filter(t => (t.commandResultId || t.relatedDailyTask?.id) === key);
        
        // 通用标题黑名单（这些不算真正的文章主题）
        const genericTitles = [
          '生成创作大纲', '生成大纲', '根据确认大纲生成全文', '文章初稿',
          '创作完成', '生成全文', '合规校验', '用户确认', '最终审核',
          '分析任务需求', 'MCP 技术执行', '运营执行', '修改文章',
        ];
        const isGenericTitle = (t: string) => genericTitles.some(g => t === g || t.includes(g));
        
        // 清理标题前缀/后缀
        const cleanTitle = (t: string) => t
          .replace(/^\[微信公众号\]\s*/, '')
          .replace(/^\[小红书\]\s*/, '')
          .replace(/^\[知乎\]\s*/, '')
          .replace(/^\[抖音\]\s*/, '')
          .replace(/^\[微博\]\s*/, '')
          .replace(/^撰写\s*/, '')
          .replace(/公众号文章初稿$/, '')
          .replace(/文章初稿$/, '')
          .replace(/根据确认大纲生成全文/, '')
          .replace(/生成全文/, '')
          .trim();

        // 写作类 executor（其 taskTitle 是文章标题）
        // 使用 agent-registry 统一常量，新增平台时无需修改此处
        const writingExecutors = WRITING_AGENT_IDS;

        // 优先级1：从写作类子任务中提取文章标题（最准确）
        let title = '主任务';
        for (const subTask of groupSubTasks) {
          if (writingExecutors.includes(subTask.executor) && subTask.taskTitle && !isGenericTitle(subTask.taskTitle)) {
            const cleaned = cleanTitle(subTask.taskTitle);
            if (cleaned.length > 3) {
              title = cleaned;
              break;
            }
          }
        }

        // 优先级2：从其他子任务中找非通用标题（兜底）
        if (title === '主任务') {
          for (const subTask of groupSubTasks) {
            if (subTask.taskTitle && !isGenericTitle(subTask.taskTitle)) {
              const cleaned = cleanTitle(subTask.taskTitle);
              if (cleaned.length > 3) {
                title = cleaned;
                break;
              }
            }
          }
        }

        // 优先级3：从 relatedDailyTask 获取
        if (title === '主任务' && task.relatedDailyTask?.taskId && !isGenericTitle(task.relatedDailyTask.taskId)) {
          title = task.relatedDailyTask.taskId;
        }

        // 优先级4：从 originalInstruction（用户原始指令）获取，兜底使用 userOpinion（创作引导）
        // 🔥 分离后 originalInstruction 是用户真实输入，更接近文章主题
        if (title === '主任务') {
          const titleSource = task.originalInstruction || task.userOpinion;
          if (titleSource && titleSource.trim().length > 0) {
            title = titleSource.trim().substring(0, 30) + (titleSource.trim().length > 30 ? '...' : '');
          }
        }
        
        groups[key] = {
          commandResultId: key,
          mainTaskTitle: title,
          createdAt: task.createdAt,
          subTasks: [],
          // 🔥 两阶段架构：从任务 metadata 提取阶段信息
          phase: (task.metadata as Record<string, any>)?.phase,
          multiPlatformGroupId: (task.metadata as Record<string, any>)?.multiPlatformGroupId,
          adaptationPlatform: (task.metadata as Record<string, any>)?.adaptationPlatform,
          sourceCommandResultId: (task.metadata as Record<string, any>)?.sourceCommandResultId,
        };
      }
      groups[key].subTasks.push(task);
    });

    // 对每个分组内的子任务按 orderIndex 排序
    Object.values(groups).forEach(group => {
      group.subTasks.sort((a, b) => a.orderIndex - b.orderIndex);
    });

    // 按创建时间降序排序分组
    return Object.values(groups).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filteredTasks]);

  // 🔥🔥🔥 按日期分组（一级分组）— 使用字符串日期键比较，避免 getTime() 精度问题
  const tasksByDate = useMemo(() => {
    // 辅助函数：将 Date 转为本地日期字符串 "YYYY-MM-DD"
    const toDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const now = new Date();
    const todayKey = toDateKey(now);
    const yesterdayKey = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const dayBeforeKey = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2));

    const groups: {
      today: typeof groupedTasks;
      yesterday: typeof groupedTasks;
      dayBeforeYesterday: typeof groupedTasks;
      earlier: typeof groupedTasks;
    } = {
      today: [],
      yesterday: [],
      dayBeforeYesterday: [],
      earlier: [],
    };

    groupedTasks.forEach(group => {
      const taskKey = toDateKey(new Date(group.createdAt));

      if (taskKey === todayKey) {
        groups.today.push(group);
      } else if (taskKey === yesterdayKey) {
        groups.yesterday.push(group);
      } else if (taskKey === dayBeforeKey) {
        groups.dayBeforeYesterday.push(group);
      } else {
        groups.earlier.push(group);
      }
    });

    return groups;
  }, [groupedTasks, mounted]); // mounted 变化时用客户端本地时区重新计算

  // 🔥 已完成可发布的任务
  const publishableTasks = useMemo(() => {
    return tasks.filter(t => t.status === 'completed');
  }, [tasks]);

  // 加载任务列表（只加载一次，筛选在前端进行）
  const loadTasks = async () => {
    try {
      setLoading(true);
      // 始终加载所有任务，筛选在前端进行
      const response = await fetch(`/api/agents/${agentId}/tasks`);
      const data = await response.json();

      if (data.success) {
        setTasks(data.data.tasks);
        setStats(data.data.stats);
      } else {
        toast.error(`加载任务失败: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ 加载任务失败:', error);
      toast.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载任务详情
  const loadTaskDetail = async (taskId: string) => {
    try {
      setLoadingDetail(true);
      console.log(`🔍 开始加载任务详情，任务ID: ${taskId}`);
      const response = await fetch(`/api/agents/tasks/${taskId}/detail`);
      const data = await response.json();

      if (data.success) {
        setTaskDetail(data.data);
        console.log(`✅ 加载任务详情成功`);
        console.log(`   - 基本信息:`, data.data.task);
        console.log(`   - 交互历史记录数:`, data.data.stepHistory?.length || 0);
        console.log(`   - MCP 执行记录数:`, data.data.mcpExecutions?.length || 0);
        if (data.data.stepHistory?.length > 0) {
          console.log(`   - 第一条交互历史:`, data.data.stepHistory[0]);
        }
        if (data.data.mcpExecutions?.length > 0) {
          console.log(`   - 第一条 MCP 记录:`, data.data.mcpExecutions[0]);
        }
        // 🔥 新增：加载执行者选项
        loadExecutorOptions(taskId);
      } else {
        toast.error(`加载任务详情失败: ${data.error}`);
        console.error(`❌ 加载任务详情失败:`, data.error);
      }
    } catch (error) {
      console.error('❌ 加载任务详情失败:', error);
      toast.error('加载任务详情失败');
    } finally {
      setLoadingDetail(false);
    }
  };

  // 🔥 新增：加载执行者选项
  const loadExecutorOptions = async (taskId: string) => {
    try {
      setLoadingExecutorOptions(true);
      const response = await fetch(`/api/agents/user-decision?subTaskId=${taskId}`);
      const data = await response.json();
      
      if (data.success && data.data?.executorOptions) {
        setExecutorOptions(data.data.executorOptions);
        console.log(`✅ 加载执行者选项成功:`, data.data.executorOptions);
      } else {
        // 使用默认选项
        setExecutorOptions([
          { value: '', label: '自动选择（推荐）', description: '让系统智能选择最合适的执行者', status: 'recommended' },
          { value: 'agent T', label: 'agent T', description: '技术专家', status: 'available' },
          { value: 'insurance-d', label: 'insurance-d', description: '保险作者（公众号）', status: 'available' },
          { value: 'insurance-xiaohongshu', label: 'insurance-xiaohongshu', description: '小红书创作专家', status: 'available' },
          { value: 'insurance-zhihu', label: 'insurance-zhihu', description: '知乎创作专家', status: 'available' },
          { value: 'insurance-toutiao', label: 'insurance-toutiao', description: '头条创作专家', status: 'available' },
          { value: 'insurance-c', label: 'insurance-c', description: '保险运营', status: 'available' },
        ]);
      }
    } catch (error) {
      console.error('❌ 加载执行者选项失败:', error);
      // 使用默认选项
      setExecutorOptions([
        { value: '', label: '自动选择（推荐）', description: '让系统智能选择最合适的执行者', status: 'recommended' },
        { value: 'agent T', label: 'agent T', description: '技术专家', status: 'available' },
        { value: 'insurance-d', label: 'insurance-d', description: '保险作者', status: 'available' },
        { value: 'insurance-xiaohongshu', label: 'insurance-xiaohongshu', description: '小红书创作专家', status: 'available' },
        { value: 'insurance-zhihu', label: 'insurance-zhihu', description: '知乎创作专家', status: 'available' },
        { value: 'insurance-toutiao', label: 'insurance-toutiao', description: '头条创作专家', status: 'available' },
        { value: 'insurance-c', label: 'insurance-c', description: '保险运营', status: 'available' },
      ]);
    } finally {
      setLoadingExecutorOptions(false);
    }
  };

  // 提交用户决策 - 简化版，确保可用
  const submitUserDecision = async () => {
    // 最简单直接的验证
    if (!userDecision.trim()) {
      alert('请输入处理内容');
      return;
    }

    const currentTask = taskDetail?.task || selectedTask;
    if (!currentTask) {
      alert('未找到任务信息');
      return;
    }

    const commandResultId = currentTask.commandResultId || currentTask.relatedDailyTask?.id;
    
    console.log('🔘 任务数据:', {
      currentTask,
      commandResultId_from_task: currentTask.commandResultId,
      commandResultId_from_related: currentTask.relatedDailyTask?.id,
      final_commandResultId: commandResultId
    });
    
    if (!commandResultId) {
      alert('缺少任务关联信息');
      return;
    }

    // 最简单直接的提示
    const confirmed = window.confirm('确定要提交处理吗？');
    if (!confirmed) return;

    setSubmittingDecision(true);
    
    try {
      console.log('🔘 开始提交...', {
        subTaskId: currentTask.id,
        commandResultId,
        userDecision: userDecision.substring(0, 50) + '...'
      });

      const response = await fetch('/api/agents/user-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subTaskId: currentTask.id,
          commandResultId: commandResultId,
          userDecision: userDecision,
          decisionType: currentTask.status === 'failed' ? 'retry_failed' : 'waiting_user',
          forcedExecutor: selectedExecutor || undefined, // 🔥 新增：强制指定执行者
        }),
      });

      const data = await response.json();
      console.log('🔘 提交响应:', data);

      if (data.success) {
        // 方案 B：添加用户反馈，告知用户任务正在后台执行
        alert('✅ 提交成功！\n\n任务正在后台执行中，最多 2 分钟后会有结果。\n您可以继续其他操作，或稍后刷新页面查看状态。');
        setUserDecision('');
        setSelectedExecutor(''); // 🔥 新增：重置执行者选择
        setShowTaskDetail(false);
        setSelectedTask(null);
        setTaskDetail(null);
        loadTasks();
      } else {
        alert('❌ 提交失败: ' + data.error);
      }
    } catch (error) {
      console.error('❌ 提交出错:', error);
      alert('❌ 提交出错，请查看控制台');
    } finally {
      setSubmittingDecision(false);
    }
  };

  /**
   * 手动解锁 blocked 任务
   * 用户直接输入文章内容，触发适配任务执行
   */
  const handleManualUnblock = async () => {
    if (!displayTask?.id) return;

    if (!manualArticleContent.trim()) {
      toast.error('请输入文章内容');
      return;
    }

    if (manualArticleContent.trim().length < 50) {
      toast.error('文章内容过短，请输入至少50字');
      return;
    }

    setManualUnblockSubmitting(true);
    try {
      const response = await fetch(`/api/subtasks/${displayTask.id}/manual-unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleContent: manualArticleContent.trim(),
          articleTitle: manualArticleTitle.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('任务已解锁，开始执行');
        setShowTaskDetail(false);
        setSelectedTask(null);
        setTaskDetail(null);
        setManualArticleContent('');
        setManualArticleTitle('');
        loadTasks();
      } else {
        toast.error('解锁失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('[Manual Unblock] 提交失败:', error);
      toast.error('提交失败，请重试');
    } finally {
      setManualUnblockSubmitting(false);
    }
  };

  /**
   * 🔴 提交预览修改决策
   * 专门用于 user_preview_edit 虚拟执行器的决策提交
   * 
   * P0-1 修复：commandResultId 显式传入，不再从 taskDetail/selectedTask 获取
   */
  const submitPreviewEditDecision = async (
    taskId: string,
    commandResultId: string,  // 🔴 显式传入，确保来源可靠
    result: import('@/components/article-preview-editor').PreviewCompleteResult
  ) => {
    setSubmittingDecision(true);
    try {
      // 🔴 P0-1 修复：不再依赖 taskDetail/selectedTask，直接使用传入的 commandResultId
      if (!commandResultId) {
        toast.error('缺少任务关联信息');
        return;
      }

      console.log('[Preview] 提交预览修改决策:', {
        taskId,
        commandResultId,
        action: result.action,
        wasModified: result.wasModified,
        contentLength: result.modifiedContent.length,
      });

      const response = await fetch('/api/agents/user-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subTaskId: taskId,
          commandResultId: commandResultId,
          userDecision: result.wasModified
            ? `用户修改了文章内容（${result.modifiedContent.length}字）`
            : '用户确认使用原稿，无需修改',
          decisionType: 'preview_edit_article',
          forcedExecutor: 'preview_edit_article',
          previewAction: result.action,
          modifiedContent: result.modifiedContent,
          modifiedTitle: result.modifiedTitle,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(result.wasModified ? '已保存修改，继续执行' : '已确认使用原稿，继续执行');
        setShowTaskDetail(false);
        setSelectedTask(null);
        setTaskDetail(null);
        loadTasks();
      } else {
        toast.error('提交失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('[Preview] 提交预览修改决策失败:', error);
      toast.error('提交失败，请重试');
    } finally {
      setSubmittingDecision(false);
    }
  };

  // 🔥 优化：使用页面可见性 API 替代定时轮询（业界标准做法）
  useEffect(() => {
    loadTasks();

    // 只在页面重新可见时刷新，减少不必要的请求
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTasks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [agentId, refreshKey]);

  // 获取状态图标和颜色
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-100', label: '已完成' };
      case 'in_progress':
        return { icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-100', label: '进行中' };
      case 'waiting_user':
        return { icon: UserCheck, color: 'text-purple-600', bgColor: 'bg-purple-100', label: '待处理' };
      case 'failed':
        return { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100', label: '失败' };
      case 'blocked':
        return { icon: Lock, color: 'text-amber-600', bgColor: 'bg-amber-100', label: '等待定稿' };
      default:
        return { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100', label: '待执行' };
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'normal':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  // 从 stepHistory 中提取失败详情
  const getFailedDetails = (stepHistory: StepHistory[]) => {
    if (!stepHistory || stepHistory.length === 0) return null;
    
    const lastFailedStep = [...stepHistory].reverse().find(step => {
      const content = step.interactContent;
      return content?.execution_result?.status === 'failed' || 
             content?.response?.decision?.type === 'FAILED';
    });

    if (!lastFailedStep) return null;

    const content = lastFailedStep.interactContent;
    const decision = content?.response?.decision;
    const failedDetails = content?.response?.failed_details || content?.ext_info?.failed_details;

    return {
      reasonCode: decision?.reason_code,
      reasoning: decision?.reasoning,
      finalConclusion: decision?.final_conclusion,
      failedDetails: failedDetails,
      mcpAttempts: content?.response?.mcp_attempts,
    };
  };

  // 处理状态筛选点击
  const handleStatusFilterClick = (status: StatusFilter) => {
    setStatusFilter(status);
  };

  // 处理 executor 筛选
  const handleExecutorFilterChange = (executor: string) => {
    setExecutorFilter(executor);
  };

  // 获取当前显示的任务数据（优先使用 taskDetail）
  const getDisplayTask = () => {
    return taskDetail?.task || selectedTask;
  };

  if (!showPanel) {
    return null;
  }

  const displayTask = getDisplayTask();

  return (
    <Card className="border border-gray-200 shadow-sm">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">我的任务列表</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={loadTasks} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {onTogglePanel && (
              <Button variant="ghost" size="sm" onClick={onTogglePanel}>
                ×
              </Button>
            )}
          </div>
        </div>

        {/* 筛选状态提示 */}
        {(statusFilter !== 'all' || executorFilter !== 'all') && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <Filter className="w-4 h-4" />
                <span>当前筛选：</span>
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {getStatusInfo(statusFilter).label}
                  </Badge>
                )}
                {executorFilter !== 'all' && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    {executorFilter}
                  </Badge>
                )}
                <span className="text-blue-600 font-medium">
                  共 {filteredStats.total} 个任务
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setStatusFilter('all');
                  setExecutorFilter('all');
                }}
              >
                清除全部筛选
              </Button>
            </div>
          </div>
        )}

        {/* 统计信息 - 可点击筛选 */}
        {stats && (
          <div className="mt-3">
            <div className="grid grid-cols-6 gap-2 text-xs mb-3">
              <button
                onClick={() => handleStatusFilterClick('all')}
                className={`bg-white p-2 rounded border text-center transition-all ${
                  statusFilter === 'all' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`font-bold text-lg ${statusFilter === 'all' ? 'text-blue-600' : 'text-gray-900'}`}>
                  {filteredStats.total}
                </div>
                <div className="text-gray-500">总计</div>
              </button>
              <button
                onClick={() => handleStatusFilterClick('pending')}
                className={`bg-white p-2 rounded border text-center transition-all ${
                  statusFilter === 'pending' ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`font-bold text-lg ${statusFilter === 'pending' ? 'text-yellow-600' : 'text-yellow-600'}`}>
                  {filteredStats.pending}
                </div>
                <div className="text-gray-500">待执行</div>
              </button>
              <button
                onClick={() => handleStatusFilterClick('in_progress')}
                className={`bg-white p-2 rounded border text-center transition-all ${
                  statusFilter === 'in_progress' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`font-bold text-lg ${statusFilter === 'in_progress' ? 'text-blue-600' : 'text-blue-600'}`}>
                  {filteredStats.in_progress}
                </div>
                <div className="text-gray-500">进行中</div>
              </button>
              <button
                onClick={() => handleStatusFilterClick('waiting_user')}
                className={`bg-white p-2 rounded border text-center transition-all ${
                  statusFilter === 'waiting_user' ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`font-bold text-lg ${statusFilter === 'waiting_user' ? 'text-purple-600' : 'text-purple-600'}`}>
                  {filteredStats.waiting_user}
                </div>
                <div className="text-gray-500">待处理</div>
              </button>
              <button
                onClick={() => handleStatusFilterClick('completed')}
                className={`bg-white p-2 rounded border text-center transition-all ${
                  statusFilter === 'completed' ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`font-bold text-lg ${statusFilter === 'completed' ? 'text-green-600' : 'text-green-600'}`}>
                  {filteredStats.completed}
                </div>
                <div className="text-gray-500">已完成</div>
              </button>
              <button
                onClick={() => handleStatusFilterClick('failed')}
                className={`bg-white p-2 rounded border text-center transition-all ${
                  statusFilter === 'all' ? 'border-red-500 bg-red-50 ring-2 ring-red-200' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`font-bold text-lg ${statusFilter === 'failed' ? 'text-red-600' : 'text-red-600'}`}>
                  {filteredStats.failed}
                </div>
                <div className="text-gray-500">失败</div>
              </button>
            </div>

            {/* 关键任务统计 */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                关键任务: <span className="font-bold text-red-600">
                  {filteredStats.critical}
                </span>
              </span>
              {statusFilter !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => handleStatusFilterClick('all')}
                >
                  <Filter className="w-3 h-3 mr-1" />
                  清除状态筛选
                </Button>
              )}
            </div>
          </div>
        )}
      </div>



      {/* 任务列表 */}
      <ScrollArea className="h-[500px]">
        <div className="p-4">
          {loading ? (
            <div className="text-center text-gray-500 py-8">
              <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
              加载中...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <ListTodo className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>暂无任务</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 🔥 日期分组：业界顶尖 UI 设计 */}
              {(() => {
                // 辅助函数：去掉 Z 后缀，获取本地日期
                const getLocalDate = (isoStr: string) => new Date(String(isoStr).replace(/Z$/, ''));
                const getDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

                const now = new Date();
                const todayKey = getDateKey(now);
                const yesterdayKey = getDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
                const dayBeforeKey = getDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2));

                // 按日期分组
                const buckets: { [key: string]: typeof groupedTasks } = { today: [], yesterday: [], dayBeforeYesterday: [], earlier: [] };

                groupedTasks.forEach(group => {
                  const d = getLocalDate(group.createdAt);
                  const key = getDateKey(d);
                  if (key === todayKey) buckets.today.push(group);
                  else if (key === yesterdayKey) buckets.yesterday.push(group);
                  else if (key === dayBeforeKey) buckets.dayBeforeYesterday.push(group);
                  else buckets.earlier.push(group);
                });

                const sections = [
                  { key: 'today', label: '今天', dateStr: todayKey, groups: buckets.today, color: 'from-blue-600 to-indigo-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                  { key: 'yesterday', label: '昨天', dateStr: yesterdayKey, groups: buckets.yesterday, color: 'from-purple-600 to-pink-600', bg: 'bg-purple-50', border: 'border-purple-200' },
                  { key: 'dayBeforeYesterday', label: '前天', dateStr: dayBeforeKey, groups: buckets.dayBeforeYesterday, color: 'from-amber-600 to-orange-600', bg: 'bg-amber-50', border: 'border-amber-200' },
                  { key: 'earlier', label: '更早', dateStr: '', groups: buckets.earlier, color: 'from-slate-600 to-gray-600', bg: 'bg-slate-50', border: 'border-slate-200' },
                ];

                return sections.filter(s => s.groups.length > 0).map(section => (
                  <div key={section.key} className="space-y-3">
                    {/* 日期分组标题 - 现代设计 */}
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-lg shadow-opacity-20`}>
                        <Calendar className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-800 tracking-tight">{section.label}</span>
                        {section.dateStr && (
                          <span className="text-sm text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-full">
                            {section.dateStr}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                        {section.groups.length} {section.groups.length === 1 ? '任务' : '个任务'}
                      </span>
                    </div>

                    {/* 该组下的任务卡片 - 玻璃态设计 */}
                    <div className="space-y-2.5">
                      {section.groups.map((group) => {
                        const completedCount = group.subTasks.filter(t => t.status === 'completed').length;
                        const totalCount = group.subTasks.length;
                        const blockedCount = group.subTasks.filter(t => t.status === 'blocked').length;
                        const waitingUserCount = group.subTasks.filter(t => t.status === 'waiting_user').length;
                        const taskDate = getLocalDate(group.createdAt);
                        const timeStr = taskDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
                        const isAllDone = completedCount === totalCount;

                        // 🔥 两阶段架构：检测组阶段
                        const isBaseArticle = group.phase === 'base_article';
                        const isAdaptation = group.phase === 'platform_adaptation';
                        const hasBlocked = blockedCount > 0;
                        const hasWaitingUser = waitingUserCount > 0;

                        // 状态配色（适配组有独特风格）
                        const cardBg = isAllDone
                          ? 'bg-gradient-to-br from-emerald-50 to-green-50'
                          : isAdaptation && hasBlocked
                          ? 'bg-gradient-to-br from-amber-50 to-orange-50/50'
                          : 'bg-white';
                        const cardBorder = isAllDone
                          ? 'border-emerald-200/70'
                          : isAdaptation && hasBlocked
                          ? 'border-amber-200/70'
                          : 'border-slate-200/80';
                        const cardShadow = isAllDone
                          ? 'shadow-sm shadow-emerald-100'
                          : isAdaptation && hasBlocked
                          ? 'shadow-sm shadow-amber-100'
                          : 'shadow-sm shadow-slate-100';

                        return (
                          <div
                            key={group.commandResultId}
                            className={`rounded-2xl border-2 ${cardBorder} ${cardBg} ${cardShadow} overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300`}
                          >
                            {/* 主任务头 */}
                            <div
                              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none"
                              onClick={() => {
                                const newExpanded = new Set(expandedTasks);
                                if (expandedTasks.has(group.commandResultId)) {
                                  newExpanded.delete(group.commandResultId);
                                } else {
                                  newExpanded.add(group.commandResultId);
                                }
                                setExpandedTasks(newExpanded);
                              }}
                            >
                              {/* 时间标签 - 精美设计 */}
                              <div className="flex flex-col items-center min-w-[70px]">
                                <span className={`text-lg font-black font-mono ${isAllDone ? 'text-emerald-600' : 'text-blue-600'}`}>
                                  {timeStr}
                                </span>
                                {isAllDone && (
                                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
                                    完成
                                  </span>
                                )}
                              </div>

                              {/* 展开指示器 */}
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 ${expandedTasks.has(group.commandResultId) ? 'bg-slate-100 rotate-180' : 'bg-transparent hover:bg-slate-50'}`}>
                                {expandedTasks.has(group.commandResultId) ? (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </div>

                              {/* 标题和进度 */}
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  {isAdaptation && hasBlocked ? (
                                    <Lock className="w-4 h-4 flex-shrink-0 text-amber-500" />
                                  ) : isBaseArticle ? (
                                    <Layers className="w-4 h-4 flex-shrink-0 text-indigo-400" />
                                  ) : (
                                    <FileText className={`w-4 h-4 flex-shrink-0 ${isAllDone ? 'text-emerald-400' : 'text-slate-400'}`} />
                                  )}
                                  <span className={`font-semibold text-sm truncate ${isAllDone ? 'text-emerald-800' : isAdaptation && hasBlocked ? 'text-amber-800' : 'text-slate-700'}`}>
                                    {group.mainTaskTitle || `主任务 ${group.commandResultId.slice(0, 8)}`}
                                  </span>
                                  {/* 🔥 两阶段架构：阶段标签 */}
                                  {isBaseArticle && (
                                    <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                      基础文章
                                    </span>
                                  )}
                                  {isAdaptation && (
                                    <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${hasBlocked ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                                      {group.adaptationPlatform ? `${PLATFORM_LABELS_MAP[group.adaptationPlatform] || group.adaptationPlatform}适配` : '平台适配'}
                                    </span>
                                  )}
                                </div>
                                {/* 进度条 */}
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        isAllDone
                                          ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                                          : isAdaptation && hasBlocked
                                          ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                          : completedCount > 0
                                          ? 'bg-gradient-to-r from-blue-400 to-indigo-500'
                                          : 'bg-slate-200'
                                      }`}
                                      style={{ width: `${(completedCount / totalCount) * 100}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-mono font-semibold ${
                                    isAllDone ? 'text-emerald-600' : isAdaptation && hasBlocked ? 'text-amber-600' : 'text-slate-500'
                                  }`}>
                                    {completedCount}/{totalCount}
                                    {hasBlocked && <span className="text-amber-500 ml-1">({blockedCount}等待)</span>}
                                    {hasWaitingUser && !hasBlocked && <span className="text-violet-500 ml-1">({waitingUserCount}待处理)</span>}
                                  </span>
                                </div>
                              </div>

                              {/* 状态徽章 */}
                              {isAllDone ? (
                                <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-3 py-1 rounded-full">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span className="text-xs font-bold">全部完成</span>
                                </div>
                              ) : isAdaptation && hasBlocked ? (
                                <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 rounded-full">
                                  <Lock className="w-3.5 h-3.5" />
                                  <span className="text-xs font-bold">等待定稿</span>
                                </div>
                              ) : hasWaitingUser ? (
                                <div className="flex items-center gap-1.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white px-3 py-1 rounded-full cursor-pointer hover:from-violet-600 hover:to-purple-600 transition-colors"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedTasks);
                                    if (newExpanded.has(group.commandResultId)) {
                                      newExpanded.delete(group.commandResultId);
                                    } else {
                                      newExpanded.add(group.commandResultId);
                                    }
                                    setExpandedTasks(newExpanded);
                                  }}
                                  title="点击查看需要处理的步骤">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span className="text-xs font-bold">等待处理</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span className="text-xs font-bold">进行中</span>
                                </div>
                              )}
                            </div>

                            {/* 子任务列表（展开时显示）- 精致设计 */}
                            {expandedTasks.has(group.commandResultId) && (
                              <div className="px-4 pb-4 pt-1 border-t border-slate-100/70 bg-slate-50/30">
                                <div className="space-y-1.5 mt-2">
                                  {group.subTasks.map((task) => {
                                    const statusInfo = getStatusInfo(task.status);
                                    const StatusIcon = statusInfo.icon;
                                    const isCompleted = task.status === 'completed';
                                    const isBlocked = task.status === 'blocked';
                                    const isWaitingUser = task.status === 'waiting_user';

                                    return (
                                      <div
                                        key={task.id}
                                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                                          isCompleted
                                            ? 'bg-emerald-50/60 border-emerald-100 hover:bg-emerald-50'
                                            : isBlocked
                                            ? 'bg-amber-50/60 border-amber-100 hover:bg-amber-50'
                                            : isWaitingUser
                                            ? 'bg-blue-50/60 border-blue-300 hover:bg-blue-50 ring-2 ring-blue-200/50'
                                            : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTask(task);
                                          setShowTaskDetail(true);
                                          setTaskDetail(null);
                                          setUserDecision('');
                                          setManualArticleContent('');
                                          setManualArticleTitle('');
                                          loadTaskDetail(task.id);
                                        }}
                                      >
                                        {/* 序号 */}
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black font-mono flex-shrink-0 ${
                                          isCompleted
                                            ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white shadow-sm shadow-emerald-200'
                                            : isBlocked
                                            ? 'bg-gradient-to-br from-amber-300 to-amber-400 text-white'
                                            : isWaitingUser
                                            ? 'bg-gradient-to-br from-blue-400 to-blue-500 text-white shadow-sm shadow-blue-200'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {task.orderIndex}
                                        </div>

                                        {/* 状态图标 */}
                                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                          isCompleted ? 'bg-emerald-100' : isBlocked ? 'bg-amber-100' : isWaitingUser ? 'bg-blue-100' : 'bg-slate-100'
                                        }`}>
                                          <StatusIcon className={`w-4 h-4 ${
                                            isCompleted ? 'text-emerald-500' : isWaitingUser ? 'text-blue-500' : statusInfo.color
                                          }`} />
                                        </div>

                                        {/* 标题 */}
                                        <span className={`flex-1 text-sm font-medium truncate ${
                                          isCompleted ? 'text-emerald-700' : isBlocked ? 'text-amber-700' : isWaitingUser ? 'text-blue-700' : 'text-slate-700'
                                        }`}>
                                          {task.taskTitle || `子任务 #${task.orderIndex}`}
                                        </span>

                                        {/* 状态标签 */}
                                        <Badge
                                          variant="outline"
                                          className={`text-xs px-2 py-0.5 font-semibold ${
                                            isCompleted
                                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                              : isWaitingUser
                                              ? 'bg-blue-100 text-blue-700 border-blue-300'
                                              : `${statusInfo.bgColor} ${statusInfo.color}`
                                          }`}
                                        >
                                          {statusInfo.label}
                                        </Badge>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 任务详情弹框 */}
      {showTaskDetail && displayTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="bg-white max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">任务详情</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowTaskDetail(false)}>
                  ×
                </Button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">加载详情中...</span>
              </div>
            ) : (
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="w-full border-b border-gray-200 px-6">
                  <TabsTrigger value="info">基本信息</TabsTrigger>
                  <TabsTrigger value="history">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    交互历史
                    {taskDetail?.stepHistory && taskDetail.stepHistory.length > 0 && (
                      <Badge variant="secondary" className="ml-1">{taskDetail.stepHistory.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="mcp">
                    <Terminal className="w-4 h-4 mr-1" />
                    MCP 执行
                    {taskDetail?.mcpExecutions && taskDetail.mcpExecutions.length > 0 && (
                      <Badge variant="secondary" className="ml-1">{taskDetail.mcpExecutions.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[calc(90vh-200px)]">
                  <div className="p-6">
                    <TabsContent value="info" className="mt-0 space-y-4">
                      {/* 基本信息 */}
                      <div>
                        <label className="text-sm font-medium text-gray-700">任务标题</label>
                        <p className="mt-1 text-gray-900">{displayTask.taskTitle}</p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700">任务描述</label>
                        <p className="mt-1 text-gray-900 whitespace-pre-wrap">{displayTask.taskDescription}</p>
                      </div>

                      {/* 🔥 【Step4 新增】创作引导设置 - 高亮主要样式 */}
                      {displayTask.userOpinion && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              创作引导
                            </span>
                            <label className="text-sm font-semibold text-blue-900">用户明确约束（最高优先级）</label>
                          </div>
                          <p className="text-sm text-blue-800 whitespace-pre-wrap">
                            {displayTask.userOpinion}
                          </p>
                          <p className="text-xs text-blue-600 mt-2">
                            写作 Agent 必须严格遵守以上创作引导
                          </p>
                        </div>
                      )}

                      {/* 🔥 【Step4 新增】用户原始需求 - 灰色次要样式 */}
                      {displayTask.originalInstruction && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                              原始指令
                            </span>
                            <label className="text-sm font-medium text-gray-500">用户原始需求（仅供参考）</label>
                          </div>
                          <p className="text-sm text-gray-500 whitespace-pre-wrap">
                            {displayTask.originalInstruction}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            仅供参考，不作为执行指令；创作引导中的结构化约束为实际执行依据
                          </p>
                        </div>
                      )}

                      {displayTask.metadata?.acceptanceCriteria && (
                        <div>
                          <label className="text-sm font-medium text-gray-700">验收标准</label>
                          <p className="mt-1 text-gray-900 whitespace-pre-wrap">
                            {displayTask.metadata.acceptanceCriteria}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">状态</label>
                          <Badge className="mt-1">
                            {getStatusInfo(displayTask.status).label}
                          </Badge>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">优先级</label>
                          <Badge className="mt-1">
                            {displayTask.priority}
                          </Badge>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700">执行者</label>
                          <Badge variant="outline" className="mt-1">
                            {displayTask.executor}
                          </Badge>
                        </div>
                      </div>

                      {/* 🔥 已完成任务的发布/预览按钮 */}
                      {displayTask.status === 'completed' && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          {/* 🔴 P0修复：isPreviewEditTask 必须在写作 Agent 检查之前，
                              否则旧数据（executor=写作Agent + 标题含"预览修改"）会匹配到写作Agent的按钮分支 */}
                          {isPreviewEditTask(displayTask) ? (
                            /* 预览修改节点：已确认状态 + 预览按钮 */
                            <div className="space-y-3">
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                                <CheckCircle2 className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                                <p className="text-sm text-purple-800 font-medium">
                                  已确认文章内容
                                </p>
                                <p className="text-xs text-purple-600 mt-1">
                                  初稿已通过预览确认，继续执行合规校验
                                </p>
                              </div>
                              {/* 🔥 小红书平台：添加预览按钮 */}
                              {displayTask.metadata?.platform === 'xiaohongshu' && (
                                <div className="flex justify-center">
                                  <XiaohongshuPreview 
                                    commandResultId={displayTask.commandResultId}
                                    variant="outline" 
                                    size="sm"
                                  />
                                </div>
                              )}
                            </div>
                          ) : displayTask.executor === 'insurance-xiaohongshu' ? (
                            /* 小红书：图文预览 */
                            <>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <XiaohongshuPreview 
                                    taskId={displayTask.id} 
                                    variant="default" 
                                    size="default" 
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 text-center mt-2">
                                📕 预览小红书图文 · 预览图已由 Agent T 自动生成
                              </p>
                            </>
                          ) : displayTask.executor === 'insurance-d' ? (
                            /* 公众号：写作完成，等待自动上传 */
                            <>
                              <div className="w-full bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 text-center">
                                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                <p className="text-green-700 font-medium">✓ 文章已完成</p>
                                <p className="text-xs text-gray-500 mt-1">等待后续流程自动上传至公众号草稿箱</p>
                              </div>
                            </>
                          ) : displayTask.executor === 'insurance-zhihu' ? (
                            /* 知乎：查看文章 */
                            <>
                              <Link href={`/task-publish/${displayTask.id}`}>
                                <Button className="w-full bg-gradient-to-r from-blue-600 to-slate-700 hover:from-blue-700 hover:to-slate-800 text-white">
                                  <BookOpen className="w-4 h-4 mr-2" />
                                  查看文章
                                </Button>
                              </Link>
                              <p className="text-xs text-gray-400 text-center mt-2">
                                将文章发布到知乎
                              </p>
                            </>
                          ) : displayTask.executor === 'insurance-toutiao' ? (
                            /* 头条：查看文章 */
                            <>
                              <Link href={`/task-publish/${displayTask.id}`}>
                                <Button className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white">
                                  <PenTool className="w-4 h-4 mr-2" />
                                  查看文章
                                </Button>
                              </Link>
                              <p className="text-xs text-gray-400 text-center mt-2">
                                将文章发布到头条/抖音
                              </p>
                            </>
                          ) : null}
                        </div>
                      )}

                      {/* Failed 状态的详细失败分析 */}
                      {displayTask.status === 'failed' && taskDetail && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          {(() => {
                            const failedDetails = getFailedDetails(taskDetail.stepHistory);
                            if (!failedDetails) {
                              return (
                                <div className="text-gray-500 text-center py-4">
                                  暂无详细失败分析
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-4">
                                <h4 className="font-semibold text-red-900 flex items-center gap-2">
                                  <XCircle className="w-5 h-5 text-red-600" />
                                  失败分析
                                </h4>
                                
                                {failedDetails.reasonCode && (
                                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <h5 className="text-sm font-medium text-red-800 mb-1">原因代码</h5>
                                    <p className="text-red-700 font-mono">{failedDetails.reasonCode}</p>
                                  </div>
                                )}
                                
                                {failedDetails.reasoning && (
                                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                    <h5 className="text-sm font-medium text-orange-800 mb-1">推理过程</h5>
                                    <p className="text-orange-700 whitespace-pre-wrap">{failedDetails.reasoning}</p>
                                  </div>
                                )}
                                
                                {failedDetails.finalConclusion && (
                                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <h5 className="text-sm font-medium text-red-800 mb-1">最终结论</h5>
                                    <p className="text-red-700 whitespace-pre-wrap">{failedDetails.finalConclusion}</p>
                                  </div>
                                )}
                                
                                {failedDetails.failedDetails && (
                                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <h5 className="text-sm font-medium text-gray-800 mb-1">失败详情</h5>
                                    <pre className="text-gray-700 text-sm overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify(failedDetails.failedDetails, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* 执行结果 */}
                      {displayTask.executionResult && (
                        <div className={`p-4 rounded-lg ${
                          displayTask.status === 'completed' 
                            ? 'bg-green-50 border border-green-200' 
                            : displayTask.status === 'failed'
                            ? 'bg-red-50 border border-red-200'
                            : 'bg-blue-50 border border-blue-200'
                        }`}>
                          <h4 className={`font-semibold mb-3 flex items-center gap-2 ${
                            displayTask.status === 'completed' 
                              ? 'text-green-900' 
                              : displayTask.status === 'failed'
                              ? 'text-red-900'
                              : 'text-blue-900'
                          }`}>
                            {displayTask.status === 'completed' ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : displayTask.status === 'failed' ? (
                              <XCircle className="w-5 h-5" />
                            ) : (
                              <Clock className="w-5 h-5" />
                            )}
                            {displayTask.status === 'completed' ? '执行结果' : 
                             displayTask.status === 'failed' ? '失败信息' : '执行状态'}
                          </h4>
                          <p className={`whitespace-pre-wrap ${
                            displayTask.status === 'completed' 
                              ? 'text-green-800' 
                              : displayTask.status === 'failed'
                              ? 'text-red-800'
                              : 'text-blue-800'
                          }`}>
                            {displayTask.executionResult}
                          </p>
                        </div>
                      )}

                      {/* 状态证明 */}
                      {displayTask.statusProof && (
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                          <h4 className="font-semibold text-blue-900 mb-3">状态证明</h4>
                          <p className="text-blue-800 whitespace-pre-wrap">
                            {displayTask.statusProof}
                          </p>
                        </div>
                      )}

                      {/* 文章元数据 */}
                      {displayTask.articleMetadata && (
                        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                          <h4 className="font-semibold text-purple-900 mb-3">文章信息</h4>
                          <pre className="text-purple-800 text-sm overflow-x-auto">
                            {JSON.stringify(displayTask.articleMetadata, null, 2)}
                          </pre>
                        </div>
                      )}

                      {displayTask.relatedDailyTask && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <h4 className="font-semibold mb-3">关联任务信息</h4>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">任务 ID:</span> {displayTask.relatedDailyTask.taskId}
                            </div>
                            <div>
                              <span className="font-medium">执行日期:</span> {displayTask.relatedDailyTask.executionDate}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 🔥 手动解锁 blocked/failed 任务：输入文章内容触发执行 */}
                      {(() => {
                        const taskMetadata = (displayTask as any)?.metadata;
                        const existingArticle = taskMetadata?.manualSourceArticle;
                        const isBlocked = displayTask.status === 'blocked';
                        const isFailedWithArticle = displayTask.status === 'failed' && !!existingArticle?.content;
                        const showManualInput = isBlocked || isFailedWithArticle;
                        if (!showManualInput) return null;

                        const existingContent = isFailedWithArticle ? (existingArticle.content || '') : '';
                        const existingTitle = isFailedWithArticle ? (existingArticle.title || '') : '';

                        return (
                        <div className="border-t border-gray-200 pt-6 mt-6">
                          <h4 className="font-semibold mb-4 flex items-center gap-2 text-amber-900">
                            {isFailedWithArticle ? (
                              <><AlertTriangle className="w-5 h-5 text-red-500" /> 重新输入文章触发执行</>
                            ) : (
                              <><Lock className="w-5 h-5" /> 手动输入文章触发执行</>
                            )}
                          </h4>

                          {/* 提示说明 */}
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div className="text-sm text-amber-800 space-y-1">
                                {isFailedWithArticle ? (
                                  <>
                                    <p className="font-medium text-red-700">执行失败，上次输入的文章内容未成功处理</p>
                                    <p>请检查内容后重新提交，或修改后再次触发执行。</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="font-medium">此任务正在等待基础文章定稿后执行</p>
                                    <p>如果您已有文章内容，可以直接输入触发执行，无需等待基础文章完成。</p>
                                    <p className="text-amber-600">输入的文章将作为适配改写的原始素材，写作 Agent 会基于此内容进行平台适配。</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 文章标题 */}
                          <div className="mb-3">
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                              文章标题 <span className="text-gray-400 font-normal">（可选）</span>
                            </label>
                            <input
                              type="text"
                              value={isFailedWithArticle ? existingTitle : manualArticleTitle}
                              onChange={(e) => setManualArticleTitle(e.target.value)}
                              placeholder="输入文章标题..."
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            />
                          </div>

                          {/* 文章内容 */}
                          <div className="mb-4">
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                              文章内容 <span className="text-red-500">*</span>
                              {isFailedWithArticle && <span className="text-xs text-gray-400 ml-2">（已预填上次内容，请检查或修改后重新提交）</span>}
                            </label>
                            <Textarea
                              value={isFailedWithArticle ? existingContent : manualArticleContent}
                              onChange={(e) => setManualArticleContent(e.target.value)}
                              placeholder="粘贴或输入文章内容（至少50字）..."
                              className="min-h-[200px] resize-y"
                            />
                            <div className="flex justify-between mt-1">
                              <span className="text-xs text-gray-400">
                                {manualArticleContent.length < 50
                                  ? `还需输入 ${50 - manualArticleContent.length} 字`
                                  : `已输入 ${manualArticleContent.length} 字`}
                              </span>
                              {isFailedWithArticle && (
                                <span className="text-xs text-amber-600">
                                  已预填 {existingContent.length} 字
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 提交按钮 */}
                          <div className="flex items-center gap-3">
                            <Button
                              onClick={handleManualUnblock}
                              disabled={manualUnblockSubmitting || manualArticleContent.trim().length < 50}
                              className={isFailedWithArticle
                                ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                              }
                            >
                              {manualUnblockSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  提交中...
                                </>
                              ) : (
                                <>
                                  <Rocket className="w-4 h-4 mr-2" />
                                  {isFailedWithArticle ? '重新执行' : '立即执行'}
                                </>
                              )}
                            </Button>
                            <span className="text-xs text-gray-400">
                              提交后任务将解锁并自动开始执行
                            </span>
                          </div>
                        </div>
                        );
                      })()}

                      {/* 用户处理输入框 - waiting_user 和 failed 状态都显示 */}
                      {(() => {
                        const isWaitingOrFailed = displayTask.status === 'waiting_user' || displayTask.status === 'failed';
                        const isPreview = isPreviewEditTask(displayTask);
                        console.log(`[用户处理输入框] displayTask.status=${displayTask.status}, isWaitingOrFailed=${isWaitingOrFailed}, isPreview=${isPreview}`);
                        console.log(`[用户处理输入框] displayTask=`, JSON.stringify({ id: displayTask.id, status: displayTask.status, executor: displayTask.executor, taskTitle: displayTask.taskTitle }));
                        return isWaitingOrFailed && (
                          <div className="border-t border-gray-200 pt-6 mt-6">
                            {/* 🔴 虚拟执行器：预览修改节点使用专用编辑器 */}
                            {/* 🔴 P1-1 修复：failed 状态也显示预览编辑器 */}
                            {isPreview ? (
                              <PreviewEditSection
                                taskId={displayTask.id}
                                platform={getPreviewPlatform(displayTask, tasks)}
                                commandResultId={displayTask.commandResultId}
                                onComplete={async (result) => {
                                  // 🔴 P0-1 修复：显式传入 commandResultId
                                  await submitPreviewEditDecision(
                                    displayTask.id, 
                                    displayTask.commandResultId, 
                                    result
                                  );
                                }}
                              />
                            ) : (
                          <>
                          <h4 className={`font-semibold mb-4 flex items-center gap-2 ${
                            displayTask.status === 'waiting_user' ? 'text-purple-900' : 'text-red-900'
                          }`}>
                            {displayTask.status === 'waiting_user' ? (
                              <UserCheck className="w-5 h-5" />
                            ) : (
                              <AlertTriangle className="w-5 h-5" />
                            )}
                            {displayTask.status === 'waiting_user' ? '用户处理' : '重新处理'}
                          </h4>
                          
                          <div className="space-y-4">
                            {/* 🔥 新增：执行者选择器 */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4 text-blue-600" />
                                <label className="text-sm font-medium text-blue-900">指定执行者（可选）</label>
                                {loadingExecutorOptions && (
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                )}
                              </div>
                              <Select 
                                value={selectedExecutor} 
                                onValueChange={setSelectedExecutor}
                                disabled={loadingExecutorOptions}
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="自动选择（推荐）" />
                                </SelectTrigger>
                                <SelectContent>
                                  {executorOptions.map((option) => (
                                    <SelectItem 
                                      key={option.value || 'auto'} 
                                      value={option.value || 'auto'}
                                      disabled={option.status === 'rejected_before' && option.rejectionCount >= 2}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span>{option.label}</span>
                                        {option.status === 'rejected_before' && (
                                          <Badge variant="destructive" className="text-xs px-1 py-0 h-5">
                                            已拒绝 {option.rejectionCount} 次
                                          </Badge>
                                        )}
                                        {option.status === 'recommended' && (
                                          <Badge className="text-xs px-1 py-0 h-5 bg-green-600">
                                            推荐
                                          </Badge>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {selectedExecutor && executorOptions.length > 0 && (
                                <p className="text-xs text-blue-700 mt-2">
                                  {executorOptions.find(o => o.value === selectedExecutor)?.description || ''}
                                </p>
                              )}
                            </div>
                            
                            <Textarea
                              value={userDecision}
                              onChange={(e) => setUserDecision(e.target.value)}
                              placeholder="请输入您的处理意见..."
                              rows={6}
                              className="resize-none"
                            />
                            <div className="flex justify-start">
                              <Button
                                onClick={() => {
                                  console.log('🔘 按钮被点击了！');
                                  submitUserDecision();
                                }}
                                disabled={submittingDecision}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                {submittingDecision ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    提交中...
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 mr-2" />
                                    提交处理
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                      {!taskDetail?.stepHistory || taskDetail.stepHistory.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                          <p>暂无交互历史记录</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {taskDetail.stepHistory.map((history, index) => {
                            // 用户消息保持简洁展示
                            if (history.interactUser === 'human' || history.interactUser === '人工') {
                              const content = history.interactContent;
                              const userMessage = typeof content === 'string' 
                                ? content 
                                : content?.userInput || content?.command || content?.instruction || JSON.stringify(content);
                              
                              return (
                                <div key={history.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="bg-white">用户</Badge>
                                      <span className="text-xs text-slate-400">#{history.interactNum}</span>
                                    </div>
                                    <span className="text-xs text-slate-400">{formatDate(history.interactTime)}</span>
                                  </div>
                                  <p className="text-sm text-slate-700 pl-1">{String(userMessage).substring(0, 500)}</p>
                                </div>
                              );
                            }
                            
                            // Agent回复使用自述卡片
                            return (
                              <AgentSelfStatementCard key={history.id} history={history} />
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="mcp" className="mt-0">
                      {!taskDetail?.mcpExecutions || taskDetail.mcpExecutions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                          <Terminal className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                          <p>暂无 MCP 执行记录</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {taskDetail.mcpExecutions.map((execution) => (
                            <div key={execution.id} className={`border rounded-lg p-4 ${
                              execution.resultStatus === 'success' 
                                ? 'border-green-200 bg-green-50' 
                                : 'border-red-200 bg-red-50'
                            }`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  {execution.toolName && (
                                    <Badge variant="outline" className="font-mono">
                                      {execution.toolName}
                                    </Badge>
                                  )}
                                  {execution.actionName && (
                                    <Badge variant="outline" className="font-mono">
                                      {execution.actionName}
                                    </Badge>
                                  )}
                                  <Badge className={
                                    execution.resultStatus === 'success' 
                                      ? 'bg-green-600' 
                                      : 'bg-red-600'
                                  }>
                                    {execution.resultStatus}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-500">
                                  <span>{formatDate(execution.attemptTimestamp)}</span>
                                  <span className="mx-2">·</span>
                                  <span>{execution.executionTimeMs}ms</span>
                                </div>
                              </div>
                              
                              {execution.reasoning && (
                                <div className="mb-3">
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">推理</h5>
                                  <p className="text-sm text-gray-600">{execution.reasoning}</p>
                                </div>
                              )}
                              
                              {execution.strategy && (
                                <div className="mb-3">
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">策略</h5>
                                  <p className="text-sm text-gray-600">{execution.strategy}</p>
                                </div>
                              )}
                              
                              {execution.params && (
                                <div className="mb-3">
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">参数</h5>
                                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                                    {JSON.stringify(execution.params, null, 2)}
                                  </pre>
                                </div>
                              )}
                              
                              {execution.resultData && (
                                <div className="mb-3">
                                  <h5 className="text-sm font-medium text-gray-700 mb-1">结果</h5>
                                  <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                                    {JSON.stringify(execution.resultData, null, 2)}
                                  </pre>
                                </div>
                              )}
                              
                              {execution.errorMessage && (
                                <div className="bg-red-100 border border-red-200 rounded p-3">
                                  <h5 className="text-sm font-medium text-red-800 mb-1">错误</h5>
                                  <p className="text-sm text-red-700">{execution.errorMessage}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </ScrollArea>
              </Tabs>
            )}
          </Card>
        </div>
      )}
    </Card>
  );
}
