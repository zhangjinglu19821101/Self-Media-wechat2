'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete, checkApiKeyMissing, getCurrentWorkspaceId } from '@/lib/api/client';
import type { MaterialFormat, WebSearchResultItem } from '@/lib/services/unified-search/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2, Send, Sparkles, ListTodo, CheckCircle2, XCircle, GripVertical, MoveUp, MoveDown, Maximize2, Minimize2, AlertTriangle, GitCompare, RefreshCw, FileText, Save, Eye, Home, BookmarkPlus, ExternalLink, BookOpen, Clock, Building2, X, HelpCircle, Settings, Rocket, Layers, ChevronDown, ChevronUp, Cpu, Brain, Bell, Workflow, Palette, PenTool, ArrowRight, ArrowLeft, Briefcase, Shield, Users, Download, Copy, ImageIcon, Check, AlertCircle, Calendar, Lock, Search, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { AgentTaskListNormal } from '@/components/agent-task-list-normal';
import { XiaohongshuPreview } from '@/components/xiaohongshu-preview';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { STRUCTURE_TEMPLATES, getDefaultStructure, type StructureTemplate } from '@/components/creation-guide/structure-templates';
import { PLATFORM_CONFIG_FIELDS, type PlatformType, PLATFORM_LABELS } from '@/lib/db/schema/style-template';
import { getFlowTemplate } from '@/lib/agents/flow-templates';
import { HorizontalFlowDiagram } from '@/components/creation-guide/horizontal-flow-diagram';
import { NodeDetailPanel } from '@/components/creation-guide/node-detail-drawer';
import type { FlowNode } from '@/components/creation-guide/types';

// 🔥 信息速记分类颜色和标签（模块级常量，避免每次渲染重复创建）
const SNIPPET_CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  real_case: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  insurance: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  intelligence: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  medical: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  quick_note: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

const SNIPPET_CATEGORY_LABELS: Record<string, string> = {
  real_case: '身边真实案例',
  insurance: '保险',
  intelligence: '智能化',
  medical: '医疗',
  quick_note: '简要速记',
};

// 🔥 素材类型标签映射（提取常量，消除硬编码三元表达式）
const MATERIAL_TYPE_LABELS: Record<string, string> = {
  case: '案例',
  data: '数据',
  story: '故事',
  quote: '引用',
  opening: '开头',
  ending: '结尾',
};

// 🔥 提醒中心类型定义
interface Reminder {
  id: string;
  content: string;
  requesterName: string;
  assigneeName: string;
  direction: 'outbound' | 'inbound';
  remindAt: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
}

interface ReminderStats {
  outbound: { pending: number; overdue: number; completed: number };
  inbound: { pending: number; overdue: number; completed: number };
  total: { pending: number; overdue: number; completed: number };
}

interface SubTask {
  id: string;
  title: string;
  description: string;
  executor: string;
  orderIndex: number;
  creationGuideConfig?: { inheritFromGlobal: boolean };
  // 提交时临时使用的字段
  userOpinion?: string | null;
  materialIds?: string[];
  structureName?: string | null;
  structureDetail?: string | null;
  // 多平台分组信息（前端注入，后端用于按平台筛选子任务）
  accountId?: string;
  platform?: string;
  platformLabel?: string;
}

/**
 * 按平台分组的子任务组
 * 多平台发布时，每个平台有独立的子任务列表
 */
interface PlatformSubTaskGroup {
  platform: string;          // 平台标识（wechat_official/xiaohongshu/zhihu/...）
  platformLabel: string;     // 平台显示名（微信公众号/小红书/...）
  accountId: string;         // 绑定的账号ID
  accountName: string;       // 账号名
  subTasks: SubTask[];       // 该平台的子任务列表
  // P2-7 修复：添加 phase 字段，消除对数组索引的依赖
  phase: 'base_article' | 'platform_adaptation';
}

interface AISplitResponse {
  subTasks: Array<{
    title: string;
    description: string;
    executor: string;
    orderIndex?: number;
  }>;
  domain?: string;
  systemPrompt?: string;
  generatedTaskTitle?: string; // 自动生成的任务标题
}

const AVAILABLE_AGENTS = [
  { id: 'A', name: '战略决策者 A' },
  { id: 'B', name: '技术官 B' },
  { id: 'T', name: '技术专家 T' },
  { id: 'C', name: '数据分析师 C' },
  { id: 'D', name: '内容创作者 D' },
  { id: 'insurance-c', name: '保险运营 insurance-c' },
  { id: 'insurance-d', name: '保险作者 insurance-d' },
  { id: 'insurance-xiaohongshu', name: '小红书创作 insurance-xiaohongshu' },
  { id: 'insurance-zhihu', name: '知乎创作 insurance-zhihu' },
  { id: 'insurance-toutiao', name: '头条创作 insurance-toutiao' },
  { id: 'user_preview_edit', name: '👤 用户预览修改' },
];

// 🔥 素材项类型定义（替代 any）
interface MaterialItem {
  id: string;
  title: string;
  type: string;
  content: string;
  sourceDesc?: string;
  topicTags?: string[];
  sceneTags?: string[];
  emotionTags?: string[];
  useCount?: number;
  matchLevel?: 'high' | 'medium' | 'low';
  keywordHitCount?: number;
  tagHitCount?: number;
}

// 推荐速记项类型
interface RecommendedSnippet {
  id: string;
  title: string;
  summary: string | null;
  categories: string[];
  materialId: string | null;
  complianceLevel: string | null;
}

// 🔥 行业案例项类型定义
interface CaseItem {
  id: string;
  title: string;
  protagonist: string;
  background: string;
  insuranceAction: string;
  result: string;
  applicableProducts: string[];
  applicableScenarios: string[];
  productTags: string[];
  crowdTags: string[];
  sceneTags: string[];
  emotionTags: string[];
  relevanceScore: number;
}

// 🔥🔥🔥 精简素材快照类型：只保存必要字段，大幅减少 sessionStorage 容量占用
// content（正文内容）不保存，刷新后通过 selectedMaterialIds + 推荐列表重新匹配
interface MaterialItemSnapshot {
  id: string;
  title: string;
  type: string;
  topicTags: string[];
  sceneTags: string[];
  emotionTags: string[];
}

// 🔥🔥 表单快照类型（用于页面刷新后恢复全部表单数据）
// 统一持久化机制：废弃 CreationGuideDraft（localStorage），全部使用 FormSnapshot（sessionStorage）

const FORM_SNAPSHOT_VERSION = 1; // v1: 初始版本，统一持久化 + 精简快照
const FORM_SNAPSHOT_KEY = 'fullHome_formSnapshot';

// 🔥 精简案例快照类型：只保存必要字段，减少 sessionStorage 容量占用
interface CaseItemSnapshot {
  id: string;
  title: string;
  productTags: string[];
  relevanceScore: number;
}

interface FormSnapshot {
  version: number; // 版本号，用于向后兼容和迁移
  mainInstruction: string;
  coreOpinion: string;
  emotionTone: string;
  selectedMaterialIds: string[];
  // 🔥 保存精简的素材快照，避免 content（大字段）撑爆 sessionStorage
  selectedMaterials: MaterialItemSnapshot[];
  selectedAccountIds: string[];
  selectedContentTemplate: {
    id: string;
    name: string;
    promptInstruction?: string;
    cardCountMode?: string;
    densityStyle?: string;
  } | null;
  selectedStructureId: string;
  hasSplitResult: boolean;
  subTasks: SubTask[];
  // 🔥 只保存精简的案例快照，避免 sessionStorage 容量超限
  recommendedCases: CaseItemSnapshot[];
  selectedCases: CaseItemSnapshot[];
  // 提交表单字段
  taskTitle: string;
  executionDate: string;
  platformSubTaskGroups: PlatformSubTaskGroup[];
  savedAt: number;
}

// 🔥 debounce 工具函数（防抖动）
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 🔥 保存表单快照到 sessionStorage（防抖版，防止高频触发）
const saveFormSnapshot = debounce((snapshot: FormSnapshot) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(FORM_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn('[FormSnapshot] 保存快照失败:', error);
  }
}, 300);

// 🔥 从 sessionStorage 加载表单快照（含版本迁移）
function loadFormSnapshot(): FormSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(FORM_SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as FormSnapshot;

    // 🔥 版本兼容迁移：v0/v1 缺少 version 字段
    if (!snapshot.version) {
      // 旧快照迁移：v0 没有 selectedAccountId（现在统一用 selectedAccountIds）
      // 旧快照有 selectedCaseIds 而无 selectedCases 时，需要特殊处理
      const migrated: FormSnapshot = {
        version: FORM_SNAPSHOT_VERSION,
        mainInstruction: snapshot.mainInstruction || '',
        coreOpinion: snapshot.coreOpinion || '',
        emotionTone: snapshot.emotionTone || '',
        selectedMaterialIds: snapshot.selectedMaterialIds || [],
        // 🔥 迁移已选素材：v0 可能保存完整 MaterialItem[]，统一转为精简快照
        selectedMaterials: (snapshot.selectedMaterials || []).length > 0
          ? (snapshot.selectedMaterials as (MaterialItem | MaterialItemSnapshot)[]).map(toMaterialItemSnapshot)
          : [],
        selectedAccountIds: (snapshot as any).selectedAccountIds || [],
        selectedContentTemplate: snapshot.selectedContentTemplate || null,
        selectedStructureId: snapshot.selectedStructureId || '',
        hasSplitResult: snapshot.hasSplitResult || false,
        subTasks: snapshot.subTasks || [],
        recommendedCases: (snapshot.recommendedCases || []).map(toCaseItemSnapshot),
        // 🔥 关键迁移：如果有 selectedCaseIds 但无 selectedCases，尝试从 recommendedCases 匹配
        // 注意：v0 的 recommendedCases/selectedCases 可能是 CaseItem[]（完整对象），toCaseItemSnapshot 兼容两种输入
        selectedCases: (snapshot.selectedCases || []).length > 0
          ? (snapshot.selectedCases as (CaseItem | CaseItemSnapshot)[]).map(toCaseItemSnapshot)
          : ((snapshot as any).selectedCaseIds?.length > 0 && snapshot.recommendedCases?.length > 0)
            ? (snapshot.recommendedCases as (CaseItem | CaseItemSnapshot)[]).filter((c) => (snapshot as any).selectedCaseIds.includes(c.id)).map(toCaseItemSnapshot)
            : [],
        // 提交表单字段
        taskTitle: snapshot.taskTitle || '',
        executionDate: snapshot.executionDate || '',
        platformSubTaskGroups: snapshot.platformSubTaskGroups || [],
        savedAt: snapshot.savedAt || Date.now(),
      };
      sessionStorage.setItem(FORM_SNAPSHOT_KEY, JSON.stringify(migrated));
      return migrated;
    }

    // 超过 1 小时的快照视为过期
    if (Date.now() - snapshot.savedAt > 60 * 60 * 1000) {
      sessionStorage.removeItem(FORM_SNAPSHOT_KEY);
      return null;
    }
    return snapshot;
  } catch (error) {
    console.warn('[FormSnapshot] 加载快照失败:', error);
    return null;
  }
}

// 🔥 案例对象转为精简快照（只保留必要字段，减少存储体积）
function toCaseItemSnapshot(item: CaseItem | CaseItemSnapshot): CaseItemSnapshot {
  return {
    id: item.id,
    title: item.title,
    productTags: (item as CaseItem).productTags || (item as CaseItemSnapshot).productTags || [],
    relevanceScore: (item as CaseItem).relevanceScore || (item as CaseItemSnapshot).relevanceScore || 0,
  };
}

// 🔥 精简快照还原为完整案例对象（恢复时使用，补充缺失字段）
function toFullCaseItem(snapshot: CaseItemSnapshot): CaseItem {
  return {
    id: snapshot.id,
    title: snapshot.title,
    protagonist: '',
    background: '',
    insuranceAction: '',
    result: '',
    applicableProducts: [],
    applicableScenarios: [],
    productTags: snapshot.productTags || [],
    crowdTags: [],
    sceneTags: [],
    emotionTags: [],
    relevanceScore: snapshot.relevanceScore || 0,
  };
}

// 🔥 素材对象转为精简快照（只保留必要字段，移除 content 等大字段）
function toMaterialItemSnapshot(item: MaterialItem | MaterialItemSnapshot): MaterialItemSnapshot {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    topicTags: item.topicTags || [],
    sceneTags: item.sceneTags || [],
    emotionTags: item.emotionTags || [],
  };
}

// 🔥 精简快照还原为完整素材对象（恢复时使用，content 字段通过推荐列表重新匹配获取）
function toFullMaterialItem(snapshot: MaterialItemSnapshot, fallback?: MaterialItem): MaterialItem {
  return {
    id: snapshot.id,
    title: snapshot.title,
    type: snapshot.type,
    content: fallback?.content || '',
    sourceDesc: fallback?.sourceDesc,
    topicTags: snapshot.topicTags || [],
    sceneTags: snapshot.sceneTags || [],
    emotionTags: snapshot.emotionTags || [],
    useCount: fallback?.useCount,
    matchLevel: fallback?.matchLevel,
    keywordHitCount: fallback?.keywordHitCount,
    tagHitCount: fallback?.tagHitCount,
  };
}

function clearFormSnapshot() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(FORM_SNAPSHOT_KEY);
  } catch { /* ignore */ }
}

// 🔥 信息速记类型定义
interface InfoSnippet {
  id: string;
  rawContent: string | null;
  categories: string[] | null; // 并列多标签（无主次之分）
  title: string | null;
  sourceOrg: string | null;
  publishDate: string | null;
  url: string | null;
  summary: string | null;
  keywords: string | null;
  applicableScenes: string | null;
  complianceWarnings: Record<string, any> | null;
  complianceLevel: string | null;
  materialStatus: string | null;
  materialId: string | null;
  status: string;
  createdAt: string;
}

export default function HomePage() {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  
  // 🔥 平台分组 ref：供 useEffect 读取最新值，避免将 platformSubTaskGroups 加入依赖导致循环
  const platformSubTaskGroupsRef = useRef<PlatformSubTaskGroup[]>([]);
  
  // 在客户端设置初始日期，避免 hydration 错误
  useEffect(() => {
    setExecutionDate(new Date().toISOString().split('T')[0]);
  }, []);
  const [mainInstruction, setMainInstruction] = useState('');
  const [subTasks, setSubTasks] = useState<SubTask[]>([
    { id: '1', title: '', description: '', executor: 'B', orderIndex: 1 },
  ]);
  // 🔥 按平台分组的子任务（选了账号后使用此状态替代 subTasks）
  const [platformSubTaskGroups, setPlatformSubTaskGroups] = useState<PlatformSubTaskGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [hasSplitResult, setHasSplitResult] = useState(false);
  const [tempSessionId, setTempSessionId] = useState<string | null>(null); // 临时会话 ID，用于替换逻辑
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null); // 识别到的领域
  const [showPrompt, setShowPrompt] = useState(false); // 是否展示提示词
  const [fullPrompt, setFullPrompt] = useState<string | null>(null); // 完整的提示词内容
  
  // 🔥 新增：浮窗显示状态
  const [showTaskListPanel, setShowTaskListPanel] = useState(false);
  
  // 🔥 新增：重复任务确认相关
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [guideCardsCollapsed, setGuideCardsCollapsed] = useState(false); // 创作引导大卡片折叠状态
  const submitLockRef = useRef(false);
  const duplicateConfirmResolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  
  // 🔥 新增：确认创建子任务弹框相关
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const confirmCreateResolveRef = useRef<((confirmed: boolean) => void) | null>(null);
  
  // 🔥 新增：文章对比相关状态
  const [articleVersions, setArticleVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersion1, setSelectedVersion1] = useState<string>('');
  const [selectedVersion2, setSelectedVersion2] = useState<string>('');
  const [selectedCommandResultId, setSelectedCommandResultId] = useState<string>('');

  // 🔥 新增：任务统计状态（用于Tab徽章）
  const [taskStats, setTaskStats] = useState<{
    pending: number;
    in_progress: number;
    waiting_user: number;
  }>({ pending: 0, in_progress: 0, waiting_user: 0 });
  const [loadingStats, setLoadingStats] = useState(false);

  // 🔥 新增：超级管理员状态
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // 🔥 创作引导相关状态
  const [showCreationGuide, setShowCreationGuide] = useState(true);
  const [activeGuideCard, setActiveGuideCard] = useState<'content' | 'structure' | 'platform' | 'guide' | null>(null);
  const [activeGuideTab, setActiveGuideTab] = useState<'opinion' | 'emotion' | 'material' | 'case'>('opinion');
  
  // 🔥 横向流程图节点选中状态（用于联动详情面板）
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedGroupAccountId, setSelectedGroupAccountId] = useState<string | null>(null);
  
  const [coreOpinion, setCoreOpinion] = useState('');
  const [emotionTone, setEmotionTone] = useState('理性客观'); // 默认值：理性客观
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialItem[]>([]);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [materialSearchResults, setMaterialSearchResults] = useState<MaterialItem[]>([]);
  const [materialSearchLoading, setMaterialSearchLoading] = useState(false);
  const [suggestedOpinions, setSuggestedOpinions] = useState<string[]>([]);
  const [loadingSuggestedOpinions, setLoadingSuggestedOpinions] = useState(false);
  const [recommendedMaterials, setRecommendedMaterials] = useState<MaterialItem[]>([]);
  const [loadingRecommendedMaterials, setLoadingRecommendedMaterials] = useState(false);
  const [recommendedSnippets, setRecommendedSnippets] = useState<RecommendedSnippet[]>([]);
  const [autoRecommendFetched, setAutoRecommendFetched] = useState(false);
  const [autoCaseRecommendFetched, setAutoCaseRecommendFetched] = useState(false);
  const [autoOpinionFetched, setAutoOpinionFetched] = useState(false);

  // 🔥 互联网搜索相关状态
  const [webSearchResults, setWebSearchResults] = useState<any[]>([]);
  const [webSearchLoading, setWebSearchLoading] = useState(false);
  const [webSearchProgress, setWebSearchProgress] = useState('');
  const [webSearchSummary, setWebSearchSummary] = useState('');
  // P1-2: AbortController 用于取消并发请求 + 竞态保护
  const webSearchAbortRef = useRef<AbortController | null>(null);

  // 🔥 行业案例引用相关状态
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [selectedCases, setSelectedCases] = useState<CaseItem[]>([]);
  const [recommendedCases, setRecommendedCases] = useState<CaseItem[]>([]);
  const [loadingRecommendedCases, setLoadingRecommendedCases] = useState(false);
  const [hasSearchedCases, setHasSearchedCases] = useState(false); // 是否已搜索过案例
  const [viewingCase, setViewingCase] = useState<CaseItem | null>(null); // 查看案例详情

  // 🔥 结构选择相关状态
  const [selectedStructure, setSelectedStructure] = useState<StructureTemplate>(() => getDefaultStructure());
  const [showAllStructures, setShowAllStructures] = useState(false);
  
  // 🔥 发布账号选择相关状态
  const [accountConfigs, setAccountConfigs] = useState<Array<{
    account: { id: string; platform: string; platformLabel: string | null; accountName: string; platformConfig?: any };
    template: { id: string; name: string; ruleCount: number } | null;
  }>>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]); // 🔥 多平台发布：选中的账号ID列表
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const hasAutoSelectedAccount = useRef(false); // 🔥 P2: 避免自动选中循环依赖

  // 🔥🔥 内容模板选择状态（Phase 2-1）
  const [selectedContentTemplate, setSelectedContentTemplate] = useState<{
    id: string;
    name: string;
    promptInstruction?: string;
    cardCountMode?: string;
    densityStyle?: string;
  } | null>(null);

  // 🔥 信息速记相关状态
  const [showSnippetDrawer, setShowSnippetDrawer] = useState(false);
  const [snippetList, setSnippetList] = useState<InfoSnippet[]>([]);
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [snippetSaving, setSnippetSaving] = useState(false);
  const [snippetAnalyzing, setSnippetAnalyzing] = useState(false);
  const [snippetAnalyzeResult, setSnippetAnalyzeResult] = useState<{
    rawContent: string;
    categories: string[];
    categoryLabels: string[];
    title: string;
    sourceOrg: string;
    publishDate: string;
    url: string;
    summary: string;
    keywords: string;
    applicableScenes: string;
    complianceWarnings: Record<string, any> | null;
    complianceLevel: string | null;
    complianceLevelLabel: string | null;
    materialId: string;
    materialStatus: string;
  } | null>(null);
  const [snippetForm, setSnippetForm] = useState({
    rawContent: '',
  });
  
  // 🔥 提醒中心相关状态
  const [showReminderDrawer, setShowReminderDrawer] = useState(false);
  const [reminderList, setReminderList] = useState<Reminder[]>([]);
  const [reminderStats, setReminderStats] = useState<ReminderStats | null>(null);
  const [reminderDirection, setReminderDirection] = useState<'all' | 'outbound' | 'inbound'>('all');
  const [reminderSearchQuery, setReminderSearchQuery] = useState('');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string | null>(null);
  
  // 🔥 创建提醒对话框状态
  const [showCreateReminderDialog, setShowCreateReminderDialog] = useState(false);
  const [newReminderForm, setNewReminderForm] = useState({
    requesterName: '',
    assigneeName: '',
    content: '',
    remindAt: '',
    direction: 'outbound' as 'outbound' | 'inbound',
  });
  const [creatingReminder, setCreatingReminder] = useState(false);
  
  // 🔥 智能解析模式
  const [reminderInputMode, setReminderInputMode] = useState<'smart' | 'manual'>('smart');
  const [smartInputText, setSmartInputText] = useState('');
  const [parsingReminder, setParsingReminder] = useState(false);
  
  const [snippetCategoryFilter, setSnippetCategoryFilter] = useState<string>('all');
  const [snippetSearchQuery, setSnippetSearchQuery] = useState('');
  const [snippetTypeFilter, setSnippetTypeFilter] = useState('all');
  const [snippetStatusFilter, setSnippetStatusFilter] = useState('all');
  
  // 🔥 新增：检查是否是超级管理员
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        setIsSuperAdmin(data?.user?.role === 'super_admin');
      })
      .catch(() => {});
  }, []);

  // ========== 表单快照：恢复 & 自动保存（统一持久化，废弃 CreationGuideDraft） ==========
  // 架构原则：
  // 1. Restore（空依赖数组）：仅挂载时从 sessionStorage 恢复一次
  // 2. AutoSave（防抖 + skipAutoSaveCountRef）：监听状态变化保存，跳过恢复后的首次触发
  // 3. prevInstructionRef 在 Restore 时同步更新，防止恢复被误判为"用户改指令"

  // 🔥 prevInstructionRef：区分"初始化恢复"和"用户改指令"，需在 Restore useEffect 之前声明
  const prevInstructionRef = useRef('');
  const snapshotRestoredRef = useRef(false);        // 标记是否已完成快照恢复（防止 Strict Mode 双执行）
  const skipAutoSaveCountRef = useRef(0);          // 跳过 AutoSave 的次数（恢复后跳过 1 次）
  const skipAutoRecommendCountRef = useRef(0);     // 🔥 跳过 AutoRecommend 清理的次数（恢复后跳过 1 次，防止清空已恢复的状态）

  // 🔥 恢复：仅在首次挂载时执行一次
  useEffect(() => {
    if (snapshotRestoredRef.current) return; // 防止 Strict Mode 双执行时重复恢复
    snapshotRestoredRef.current = true;

    const snapshot = loadFormSnapshot();
    if (!snapshot) return;

    // 跳过恢复后的第 1 次 AutoSave（等 React 批处理完成）
    skipAutoSaveCountRef.current = 1;
    // 🔥 跳过恢复后的第 1 次 AutoRecommend 清理（防止清空刚恢复的状态）
    skipAutoRecommendCountRef.current = 1;

    // 恢复所有字段
    if (snapshot.mainInstruction) {
      setMainInstruction(snapshot.mainInstruction);
      // 🔥 严重问题 3.2 修复：同步更新 prevInstructionRef，防止恢复被误判为"用户改指令"
      prevInstructionRef.current = snapshot.mainInstruction;
    }
    if (snapshot.coreOpinion) setCoreOpinion(snapshot.coreOpinion);
    if (snapshot.emotionTone) setEmotionTone(snapshot.emotionTone);
    if (snapshot.selectedMaterialIds?.length) {
      setSelectedMaterialIds(snapshot.selectedMaterialIds);
      // 🔥 恢复已选素材：转换为完整对象，content 字段通过推荐列表重新匹配获取
      if (snapshot.selectedMaterials?.length) {
        // 🔥 content 字段不存储在快照中，刷新后需要用户重新选择或由推荐系统补充
        const fullMaterials = snapshot.selectedMaterials.map(s => toFullMaterialItem(s));
        setSelectedMaterials(fullMaterials);
      }
    }
    if (snapshot.selectedAccountIds?.length) {
      setSelectedAccountIds(snapshot.selectedAccountIds);
      setSelectedAccountId(snapshot.selectedAccountIds[0]);
    }
    if (snapshot.selectedContentTemplate) setSelectedContentTemplate(snapshot.selectedContentTemplate);
    if (snapshot.selectedStructureId) {
      const structure = STRUCTURE_TEMPLATES.find(s => s.id === snapshot.selectedStructureId);
      if (structure) setSelectedStructure(structure);
    }
    // 🔥 恢复提交表单字段
    if (snapshot.taskTitle) setTaskTitle(snapshot.taskTitle);
    if (snapshot.executionDate) setExecutionDate(snapshot.executionDate);
    if (snapshot.platformSubTaskGroups?.length) setPlatformSubTaskGroups(snapshot.platformSubTaskGroups);
    // 🔥 恢复拆解状态，确保刷新后创作引导区可见
    if (snapshot.hasSplitResult) setHasSplitResult(true);
    if (snapshot.subTasks?.length) setSubTasks(snapshot.subTasks);
    // 🔥 恢复推荐案例列表（CaseItemSnapshot[] → CaseItem[]）
    if (snapshot.recommendedCases?.length) {
      setRecommendedCases(snapshot.recommendedCases.map(toFullCaseItem));
    }
    // 🔥 恢复已选案例：直接使用 selectedCases（CaseItemSnapshot[] → CaseItem[]）
    if (snapshot.selectedCases?.length) {
      const fullCases = snapshot.selectedCases.map(toFullCaseItem);
      setSelectedCases(fullCases);
      // 从 selectedCases 推导 selectedCaseIds（消除冗余字段）
      setSelectedCaseIds(fullCases.map(c => c.id));
    }

    toast.success('已恢复您之前填写的内容');
    // 🔥 中等问题 3 修复：cleanup 重置所有 refs，防止 Strict Mode 卸载重挂后无法恢复
    return () => {
      snapshotRestoredRef.current = false;
      skipAutoSaveCountRef.current = 0;
      skipAutoRecommendCountRef.current = 0;
    };
  }, []); // 空数组：仅挂载时执行一次

  // 🔥 从指令自动提取任务标题 + 默认执行日期
  useEffect(() => {
    // 任务标题：从 mainInstruction 提取 "主题《xxx》" 或使用前50字
    if (mainInstruction && !taskTitle) {
      const match = mainInstruction.match(/主题[《"<『]([^》"』]+)[》"』]/);
      const title = match ? `主题《${match[1]}》` : mainInstruction.slice(0, 50);
      setTaskTitle(title);
    }
    // 执行日期：默认当天
    if (!executionDate) {
      setExecutionDate(new Date().toISOString().split('T')[0]);
    }
  }, [mainInstruction]); // 仅在 mainInstruction 变化时检查，避免无限循环

  // 🔥 自动保存：监听所有状态变化，有内容就保存（debounce 已内置）
  useEffect(() => {
    if (!mainInstruction) return; // 没有内容不保存
    if (skipAutoSaveCountRef.current > 0) {
      skipAutoSaveCountRef.current--;
      return; // 🔥 跳过恢复后的第 1 次触发，避免空状态覆盖已有快照
    }
    saveFormSnapshot({
      version: FORM_SNAPSHOT_VERSION,
      mainInstruction,
      coreOpinion,
      emotionTone,
      selectedMaterialIds,
      // 🔥 保存精简的素材快照（移除 content 等大字段），刷新后通过推荐列表重新获取正文
      selectedMaterials: selectedMaterials.map(toMaterialItemSnapshot),
      selectedAccountIds,
      selectedContentTemplate,
      selectedStructureId: selectedStructure?.id || '',
      hasSplitResult,
      subTasks,
      // 🔥 保存精简的案例快照，减少 sessionStorage 容量占用
      recommendedCases: recommendedCases.map(toCaseItemSnapshot),
      selectedCases: selectedCases.map(toCaseItemSnapshot),
      // 提交表单字段
      taskTitle,
      executionDate,
      platformSubTaskGroups,
      savedAt: Date.now(),
    });
  }, [mainInstruction, coreOpinion, emotionTone, selectedMaterialIds, selectedMaterials, selectedAccountIds, selectedContentTemplate, selectedStructure, hasSplitResult, subTasks, recommendedCases, selectedCases, taskTitle, executionDate, platformSubTaskGroups]);

  // 🔥 获取账号列表（AI拆解后自动加载）
  useEffect(() => {
    if (hasSplitResult) {
      loadAccountConfigs();
    }
  }, [hasSplitResult]);

  // 🔥 当账号选择变化且已有AI拆解结果时，用流程模板初始化按平台分组的子任务
  // 注意：AI拆解结果仅用于展示，真正创建任务时使用固定流程模板
  useEffect(() => {
    if (!hasSplitResult || selectedAccountIds.length === 0 || accountConfigs.length === 0) {
      // 没选账号时清空平台分组，回退到 AI 原始结果
      setPlatformSubTaskGroups([]);
      platformSubTaskGroupsRef.current = [];
      return;
    }

    // P2-7 修复：预先计算 phase，避免构建时无法知道"第一个公众号账号"
    // 两阶段架构规则：第一个 wechat_official 账号 = base_article，其余 = platform_adaptation
    const wechatAccountIds = selectedAccountIds.filter(accountId => {
      const config = accountConfigs.find(c => c.account.id === accountId);
      return config?.account?.platform === 'wechat_official';
    });
    const firstWechatAccountId = wechatAccountIds[0];

    // 为每个选中的账号创建对应的子任务组
    const groups: PlatformSubTaskGroup[] = selectedAccountIds.map(accountId => {
      const config = accountConfigs.find(c => c.account.id === accountId);
      const platform = config?.account?.platform || 'wechat_official';
      const accountName = config?.account?.accountName || '未知账号';

      // P2-7 修复：基于账号确定 phase（第一个公众号为基础文章，其余为平台适配）
      const isBaseArticle = platform === 'wechat_official' && accountId === firstWechatAccountId;
      const phase: 'base_article' | 'platform_adaptation' = isBaseArticle ? 'base_article' : 'platform_adaptation';
      
      // 🔥 核心逻辑：使用对应平台的固定流程模板（与原来一致）
      const template = getFlowTemplate(platform);

      // 检查是否已有该平台的分组（保留用户编辑过的内容）
      const existingGroup = platformSubTaskGroupsRef.current.find(g => g.accountId === accountId);
      if (existingGroup) {
        return existingGroup; // 保留用户编辑（含 phase）
      }

      // 用流程模板初始化
      const templateSubTasks: SubTask[] = template.steps.map((step, idx) => ({
        id: `${platform}-${accountId}-${Date.now()}-${idx}`,
        title: step.title,
        description: step.description,
        executor: step.executor,
        orderIndex: step.orderIndex,
        creationGuideConfig: { inheritFromGlobal: true },
      }));

      return {
        platform,
        platformLabel: (PLATFORM_LABELS as Record<string, string>)[platform] || template.name,
        accountId,
        accountName,
        subTasks: templateSubTasks,
        phase, // P2-7 修复：携带 phase 信息
      };
    });

    setPlatformSubTaskGroups(groups);
    platformSubTaskGroupsRef.current = groups;
  }, [selectedAccountIds, accountConfigs, hasSplitResult]);

  const loadAccountConfigs = async () => {
    setLoadingAccounts(true);
    try {
      const data: any = await apiGet('/api/platform-accounts?userId=default-user');
      if (data?.success) {
        setAccountConfigs(data.data || []);
        // 🔥 简化：自动全选所有已配置的账号
        // 用户在"发布平台管理"页配置了账号就意味着要发布，无需手动勾选
        if (data.data?.length > 0 && !hasAutoSelectedAccount.current) {
          const allAccountIds = data.data.map((c: any) => c.account.id);
          setSelectedAccountIds(allAccountIds);
          setSelectedAccountId(allAccountIds[0]); // 兼容字段
          hasAutoSelectedAccount.current = true;
        }
      }
    } catch (error) {
      console.error('获取账号列表失败:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // 🔥🔥 按平台创作引导：辅助函数
  // 🔥 保存平台专属配置到后端（500ms 防抖）
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const savePlatformConfig = useCallback(async (accountId: string, platformConfig: any) => {
    // 清除之前的定时器
    if (saveTimeoutRef.current[accountId]) {
      clearTimeout(saveTimeoutRef.current[accountId]);
    }
    
    // 500ms 防抖
    saveTimeoutRef.current[accountId] = setTimeout(async () => {
      try {
        await apiPut(`/api/platform-accounts/${accountId}`, { platformConfig });
      } catch (err: any) {
        console.error('保存平台配置失败:', err);
        toast.error('保存平台配置失败');
      }
    }, 500);
  }, []);

  // 🔥 创作引导：预计算搜索结果展示列表
  // 修复：当用户主动搜索时，不去重推荐列表（用户明确搜索的内容应全部展示）
  // 去重仅在无搜索时合并展示推荐+搜索时才有意义
  const filteredSearchMaterials = useMemo(() => 
    materialSearchQuery.trim()
      ? materialSearchResults  // 有搜索词：展示全部搜索结果，不去重
      : materialSearchResults.filter((m) => !recommendedMaterials.some((r) => r.id === m.id)),
    [materialSearchResults, recommendedMaterials, materialSearchQuery]
  );

  // 🔥 情感基调配置（集中管理，避免硬编码）
  const EMOTION_TONES = [
    { value: '理性客观', label: '理性客观', icon: '🧊', desc: '中立对比，让读者自己判断' },
    { value: '踩坑警醒', label: '踩坑警醒', icon: '⚠️', desc: '指出常见误区，提醒避坑' },
    { value: '温情共情', label: '温情共情', icon: '💛', desc: '理解读者处境，温暖建议' },
    { value: '专业权威', label: '专业权威', icon: '📊', desc: '数据说话，专家视角' },
  ] as const;

  const addSubTask = () => {
    const newId = Date.now().toString();
    setSubTasks([
      ...subTasks,
      {
        id: newId,
        title: '',
        description: '',
        executor: 'B',
        orderIndex: subTasks.length + 1,
        creationGuideConfig: { inheritFromGlobal: true }, // 🔥 默认继承全局创作引导
      },
    ]);
  };

  const removeSubTask = (id: string) => {
    if (subTasks.length <= 1) {
      toast.warning('至少需要保留一个子任务');
      return;
    }
    setSubTasks(subTasks.filter(t => t.id !== id).map((t, i) => ({ ...t, orderIndex: i + 1 })));
  };

  const updateSubTask = (id: string, field: keyof SubTask, value: string) => {
    setSubTasks(subTasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // 🆕 更新子任务的创作引导配置
  const updateSubTaskGuideConfig = (id: string, inheritFromGlobal: boolean) => {
    setSubTasks(subTasks.map(t => 
      t.id === id 
        ? { ...t, creationGuideConfig: { inheritFromGlobal } } 
        : t
    ));
  };

  // 🆕 检查是否有全局创作引导内容（使用 useMemo 缓存计算结果）
  // 注意：结构选择和情感基调始终有默认值，属于隐性继承，不参与"是否有内容"判断
  // 仅当用户主动输入核心观点/关联素材时才认为有创作引导内容
  const hasGlobalCreationGuide = useMemo(() => {
    return !!(
      coreOpinion.trim() || 
      selectedMaterialIds.length > 0
    );
  }, [coreOpinion, selectedMaterialIds]);

  // 向上移动子任务
  const moveSubTaskUp = (id: string) => {
    const index = subTasks.findIndex(t => t.id === id);
    if (index <= 0) return; // 已经是第一个

    const newSubTasks = [...subTasks];
    [newSubTasks[index - 1], newSubTasks[index]] = [newSubTasks[index], newSubTasks[index - 1]];
    
    // 更新 orderIndex
    newSubTasks.forEach((t, i) => {
      t.orderIndex = i + 1;
    });

    setSubTasks(newSubTasks);
    toast.success('已向上移动');
  };

  // 向下移动子任务
  const moveSubTaskDown = (id: string) => {
    const index = subTasks.findIndex(t => t.id === id);
    if (index >= subTasks.length - 1) return; // 已经是最后一个

    const newSubTasks = [...subTasks];
    [newSubTasks[index], newSubTasks[index + 1]] = [newSubTasks[index + 1], newSubTasks[index]];
    
    // 更新 orderIndex
    newSubTasks.forEach((t, i) => {
      t.orderIndex = i + 1;
    });

    setSubTasks(newSubTasks);
    toast.success('已向下移动');
  };

  // 修改序号
  const changeSubTaskOrder = (id: string, newOrder: number) => {
    if (newOrder < 1 || newOrder > subTasks.length) {
      toast.error(`序号必须在 1 到 ${subTasks.length} 之间`);
      return;
    }

    const currentIndex = subTasks.findIndex(t => t.id === id);
    const currentTask = subTasks[currentIndex];
    const newIndex = newOrder - 1;

    if (currentIndex === newIndex) return;

    const newSubTasks = [...subTasks];
    // 移除当前任务
    newSubTasks.splice(currentIndex, 1);
    // 插入到新位置
    newSubTasks.splice(newIndex, 0, currentTask);
    
    // 更新 orderIndex
    newSubTasks.forEach((t, i) => {
      t.orderIndex = i + 1;
    });

    setSubTasks(newSubTasks);
    toast.success(`已调整到第 ${newOrder} 位`);
  };

  // ============ 🔥 按平台分组的子任务 CRUD ============

  /** 更新平台分组中的子任务 */
  const updatePlatformSubTask = (accountId: string, taskId: string, field: keyof SubTask, value: any) => {
    setPlatformSubTaskGroups(groups => groups.map(g => {
      if (g.accountId !== accountId) return g;
      return { ...g, subTasks: g.subTasks.map(t => t.id === taskId ? { ...t, [field]: value } : t) };
    }));
  };

  /** 更新平台分组中子任务的创作引导配置 */
  const updatePlatformSubTaskGuideConfig = (accountId: string, taskId: string, inheritFromGlobal: boolean) => {
    setPlatformSubTaskGroups(groups => groups.map(g => {
      if (g.accountId !== accountId) return g;
      return { ...g, subTasks: g.subTasks.map(t => 
        t.id === taskId ? { ...t, creationGuideConfig: { inheritFromGlobal } } : t
      )};
    }));
  };

  /** 向平台分组添加子任务 */
  const addPlatformSubTask = (accountId: string) => {
    // 生成新任务 ID（提前生成，用于后续选中）
    const newTaskId = `new-${accountId}-${Date.now()}`;
    
    setPlatformSubTaskGroups(groups => groups.map(g => {
      if (g.accountId !== accountId) return g;
      return { ...g, subTasks: [
        ...g.subTasks,
        {
          id: newTaskId,
          title: '新步骤',
          description: '',
          executor: 'B',
          orderIndex: g.subTasks.length + 1,
          creationGuideConfig: { inheritFromGlobal: true },
        },
      ]};
    }));
    
    // 自动选中新添加的任务
    setSelectedNodeId(newTaskId);
    setSelectedGroupAccountId(accountId);
  };

  /** 从平台分组中删除子任务 */
  const removePlatformSubTask = (accountId: string, taskId: string) => {
    setPlatformSubTaskGroups(groups => groups.map(g => {
      if (g.accountId !== accountId) return g;
      if (g.subTasks.length <= 1) return g;
      return { ...g, subTasks: g.subTasks.filter(t => t.id !== taskId).map((t, i) => ({ ...t, orderIndex: i + 1 })) };
    }));
  };

  /** 平台分组中子任务上移 */
  const movePlatformSubTaskUp = (accountId: string, taskId: string) => {
    setPlatformSubTaskGroups(groups => groups.map(g => {
      if (g.accountId !== accountId) return g;
      const idx = g.subTasks.findIndex(t => t.id === taskId);
      if (idx <= 0) return g;
      const newTasks = [...g.subTasks];
      [newTasks[idx - 1], newTasks[idx]] = [newTasks[idx], newTasks[idx - 1]];
      newTasks.forEach((t, i) => { t.orderIndex = i + 1; });
      return { ...g, subTasks: newTasks };
    }));
  };

  /** 平台分组中子任务下移 */
  const movePlatformSubTaskDown = (accountId: string, taskId: string) => {
    setPlatformSubTaskGroups(groups => groups.map(g => {
      if (g.accountId !== accountId) return g;
      const idx = g.subTasks.findIndex(t => t.id === taskId);
      if (idx >= g.subTasks.length - 1) return g;
      const newTasks = [...g.subTasks];
      [newTasks[idx], newTasks[idx + 1]] = [newTasks[idx + 1], newTasks[idx]];
      newTasks.forEach((t, i) => { t.orderIndex = i + 1; });
      return { ...g, subTasks: newTasks };
    }));
  };

  const handleAISplit = async () => {
    if (!mainInstruction.trim()) {
      toast.error('请输入主任务指令');
      return;
    }

    setIsSplitting(true);
    try {
      const result: AISplitResponse = await apiPost('/api/agents/b/ai-split', { instruction: mainInstruction });
      
      // 保存识别到的领域和提示词
      if (result.domain) {
        setDetectedDomain(result.domain);
      }
      if (result.systemPrompt) {
        setFullPrompt(result.systemPrompt);
      }
      // 自动填充任务标题
      if (result.generatedTaskTitle && !taskTitle) {
        setTaskTitle(result.generatedTaskTitle);
      }
      
      // 将 AI 拆解结果转换为子任务
      const newSubTasks: SubTask[] = result.subTasks.map((task, index) => ({
        id: `ai-${Date.now()}-${index}`,
        title: task.title,
        description: task.description,
        executor: task.executor,
        orderIndex: task.orderIndex || (index + 1),
        creationGuideConfig: { inheritFromGlobal: true },
      }));

      setSubTasks(newSubTasks);
      setHasSplitResult(true);
      
      // 🔥 重新拆解时清空所有推荐数据，防止旧指令的推荐残留
      setRecommendedMaterials([]);
      setRecommendedCases([]);
      setSuggestedOpinions([]);
      setSelectedMaterialIds([]);
      setSelectedMaterials([]);
      setSelectedCaseIds([]);
      setSelectedCases([]);
      setCoreOpinion('');
      setEmotionTone('');
      // 🔥 严重问题 3.1 修复：重新拆解时清空 FormSnapshot，防止旧数据被恢复
      clearFormSnapshot();
      
      // 拆解完成后保持创作引导区展开，方便用户立即查看推荐
      toast.success(`✅ AI 成功拆解出 ${newSubTasks.length} 个子任务`);
      
      // 🔥 清空后重新触发素材/案例/核心观点自动推荐
      // 原因：mainInstruction 此时未变化，自动推荐useEffect不会重新触发
      // 延迟1秒执行：确保1) React状态更新已提交 2) 如果有pending的useEffect防抖定时器，会先触发并被AbortController取消
      setTimeout(() => {
        handleRecommendMaterials(true);
        handleRecommendCases(true);
        handleSuggestOpinions(true);
      }, 1000);
      
    } catch (error: any) {
      if (checkApiKeyMissing(error)) return;
      toast.error(`❌ AI 拆解失败: ${error.message}`);
    } finally {
      setIsSplitting(false);
    }
  };

  // 🔥 获取 AI 智能拆解按钮的禁用原因
  const getAISplitDisabledReason = () => {
    if (!mainInstruction.trim()) {
      return '请输入主任务指令';
    }
    if (isSplitting) {
      return 'AI 正在拆解中...';
    }
    return null;
  };

  // 🔥 创作引导：AI 生成建议观点
  const handleSuggestOpinions = useCallback(async (silent = false) => {
    if (!mainInstruction.trim()) {
      if (!silent) toast.error('请先输入任务指令');
      return;
    }
    setLoadingSuggestedOpinions(true);
    try {
      const data: any = await apiPost('/api/agents/b/suggest-opinion', { instruction: mainInstruction });
      setSuggestedOpinions(data.opinions || []);
      if (!silent) toast.success(`生成了 ${data.opinions?.length || 0} 个建议观点`);
    } catch (error: any) {
      if (!silent) toast.error(`生成建议观点失败: ${error.message}`);
    } finally {
      setLoadingSuggestedOpinions(false);
    }
  }, [mainInstruction]);

  // 🔥 创作引导：搜索素材
  const handleSearchMaterials = async (query: string) => {
    if (!query.trim()) {
      setMaterialSearchResults([]);
      return;
    }
    setMaterialSearchLoading(true);
    try {
      const data: any = await apiGet(`/api/materials?search=${encodeURIComponent(query)}&pageSize=20`);
      // API 返回 { success: true, data: { list: [...], pagination: {...} } }
      setMaterialSearchResults(Array.isArray(data?.data?.list) ? data.data.list : Array.isArray(data?.data) ? data.data : []);
    } catch (error) {
      console.error('搜索素材失败:', error);
    } finally {
      setMaterialSearchLoading(false);
    }
  };

  // 🔥 创作引导：选择/取消选择素材
  const toggleMaterialSelection = (material: MaterialItem) => {
    const alreadySelected = selectedMaterialIds.includes(material.id);
    if (alreadySelected) {
      setSelectedMaterialIds(prev => prev.filter(id => id !== material.id));
      setSelectedMaterials(prev => prev.filter(m => m.id !== material.id));
    } else {
      setSelectedMaterialIds(prev => [...prev, material.id]);
      setSelectedMaterials(prev => [...prev, material]);
    }
  };

  // P1-9: AbortController ref，用于取消前序推荐请求
  const recommendAbortRef = useRef<AbortController | null>(null);

  // 🔥 创作引导：智能推荐素材（支持手动和自动触发）
  // P1-10: 使用 useCallback 管理依赖，避免 useEffect 依赖抑制
  const handleRecommendMaterials = useCallback(async (silent: boolean = false) => {
    if (!mainInstruction.trim()) return;

    // P1-9: 取消前序请求，防止竞态条件
    if (recommendAbortRef.current) {
      recommendAbortRef.current.abort();
    }
    const controller = new AbortController();
    recommendAbortRef.current = controller;

    setLoadingRecommendedMaterials(true);
    try {
      const data: any = await apiGet(
        `/api/materials/recommend?instruction=${encodeURIComponent(mainInstruction)}&limit=5`,
        { signal: controller.signal },
      );
      // P1-9: 如果请求已被取消，不更新状态
      if (controller.signal.aborted) return;

      const materials = data?.data || [];
      const snippets = data?.snippets || [];
      setRecommendedMaterials(materials);
      setRecommendedSnippets(snippets);
      setAutoRecommendFetched(true);
      // P1-11: 移除推荐结果混入搜索结果的逻辑
      // 推荐和搜索是两个独立数据源，不应互相污染
      if (!silent) {
        if (materials.length > 0) {
          toast.success(`推荐了 ${materials.length} 个相关素材`);
        } else {
          toast.info('暂无匹配素材，可先去素材库创建');
        }
      }
    } catch (error: unknown) {
      // P1-9: AbortError 是预期行为，不视为错误
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('推荐素材失败:', error);
      if (!silent) toast.error('推荐素材失败');
    } finally {
      // P1-9: 仅在请求未被取消时更新 loading 状态
      if (!controller.signal.aborted) {
        setLoadingRecommendedMaterials(false);
      }
    }
  }, [mainInstruction]);

  // 🔥 追踪上一次指令值：区分"初始化恢复"和"用户主动改指令"
  // 从空值→非空值 = 初始化恢复，不清空核心观点/情感基调
  // 从非空→不同非空 = 用户改指令，清空核心观点/情感基调
  // 注：prevInstructionRef 在 Restore useEffect 之前声明，避免时序问题

  // 🔥 自动推荐：指令变化后 800ms 自动触发素材推荐
  // 核心逻辑：指令变化 → 清空已选择数据 → 推荐新数据
  // 保护：恢复期间跳过，避免清空刚恢复的状态
  useEffect(() => {
    if (skipAutoRecommendCountRef.current > 0) {
      skipAutoRecommendCountRef.current--;
      return; // 🔥 跳过恢复后的第 1 次触发
    }
    if (!mainInstruction.trim() || mainInstruction.trim().length < 4) {
      // P2: 指令清空时重置推荐状态
      setAutoRecommendFetched(false);
      setAutoCaseRecommendFetched(false);
      setAutoOpinionFetched(false);
      setRecommendedMaterials([]);
      setRecommendedSnippets([]);
      setRecommendedCases([]);
      setSuggestedOpinions([]);
      setSelectedMaterialIds([]);
      setSelectedCaseIds([]);
      setCoreOpinion('');
      prevInstructionRef.current = '';
      return;
    }

    const prevInstruction = prevInstructionRef.current;
    prevInstructionRef.current = mainInstruction;

    // 🔥 区分场景：只有用户主动改指令（非空→不同非空）才清空核心观点/情感基调
    // 初始化恢复（空→非空）不清空，保留用户之前的选择
    const isUserChangingInstruction = prevInstruction.trim() && prevInstruction.trim() !== mainInstruction.trim();
    if (isUserChangingInstruction) {
      setSelectedMaterialIds([]);
      setSelectedMaterials([]);
      setSelectedCaseIds([]);
      setSelectedCases([]);
      setCoreOpinion('');
      setEmotionTone('');
    }

    const timer = setTimeout(() => {
      handleRecommendMaterials(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [mainInstruction, handleRecommendMaterials]);

  // 🔥 页面刷新恢复：从推荐结果中重建 selectedMaterials / selectedCases
  // 快照只保存了 ID 列表，对象数组需要从推荐数据中匹配重建
  useEffect(() => {
    if (selectedMaterialIds.length > 0 && selectedMaterials.length === 0 && recommendedMaterials.length > 0) {
      const matched = selectedMaterialIds
        .map(id => recommendedMaterials.find(m => m.id === id))
        .filter((m): m is MaterialItem => m != null);
      if (matched.length > 0) setSelectedMaterials(matched);
    }
  }, [selectedMaterialIds, recommendedMaterials]);

  useEffect(() => {
    if (selectedCaseIds.length > 0 && selectedCases.length === 0 && recommendedCases.length > 0) {
      const matched = selectedCaseIds
        .map(id => recommendedCases.find(c => c.id === id))
        .filter((c): c is CaseItem => c != null);
      if (matched.length > 0) setSelectedCases(matched);
    }
  }, [selectedCaseIds, recommendedCases]);

  // 🔥 互联网搜索：搜索权威站点的保险相关信息
  // P1-2: AbortController 竞态取消 + P1-6: workspaceId 空值保护
  const handleWebSearch = async (query?: string) => {
    const searchQuery = query || mainInstruction.trim();
    if (!searchQuery) return;

    // P1-6: workspaceId 空值保护
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId || workspaceId === 'default-workspace') {
      toast.error('请先选择工作空间');
      return;
    }

    // P1-2: 取消前一个未完成的请求
    if (webSearchAbortRef.current) {
      webSearchAbortRef.current.abort();
    }
    const abortController = new AbortController();
    webSearchAbortRef.current = abortController;

    setWebSearchLoading(true);
    setWebSearchProgress('正在搜索权威站点...');
    setWebSearchResults([]);
    setWebSearchSummary('');

    try {
      const response = await fetch('/api/unified-search/web', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 5,
          needSummary: true,
        }),
        signal: abortController.signal,
      });

      // P1-2: 检查请求是否已被取消
      if (abortController.signal.aborted) return;

      if (!response.ok) {
        throw new Error(`搜索失败: ${response.status}`);
      }

      // SSE 流式读取
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error('无法读取响应流');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // P1-2: 检查请求是否已被取消
          if (abortController.signal.aborted) {
            reader.cancel();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                switch (currentEvent) {
                  case 'progress':
                    setWebSearchProgress(data.message || '搜索中...');
                    break;
                  case 'results':
                    setWebSearchResults(data.items || []);
                    break;
                  case 'summary':
                    if (data.materialFormats) {
                      setWebSearchResults(prev => prev.map((item, i) => ({
                        ...item,
                        materialFormat: data.materialFormats[i],
                        summarizedContent: data.materialFormats[i]?.content,
                      })));
                    }
                    if (data.summary) setWebSearchSummary(data.summary);
                    break;
                  case 'done':
                    setWebSearchProgress('');
                    break;
                  case 'error':
                    toast.error(data.message || '互联网搜索失败');
                    break;
                }
              } catch { /* ignore parse errors */ }
              currentEvent = '';
            }
          }
        }
      } else {
        // 普通 JSON 响应
        const data = await response.json();
        setWebSearchResults(data.webResults || []);
        setWebSearchSummary(data.summary || '');
      }

      setWebSearchProgress('');
    } catch (error) {
      // P1-2: AbortError 不显示错误提示（用户主动取消）
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[WebSearch] 请求已取消');
        return;
      }
      console.error('互联网搜索失败:', error);
      toast.error('互联网搜索失败，请稍后重试');
    } finally {
      // P1-2: 清理 abortController 引用（仅当前请求）
      if (webSearchAbortRef.current === abortController) {
        webSearchAbortRef.current = null;
      }
      setWebSearchLoading(false);
    }
  };

  // 🔥 互联网搜索：保存结果到素材库
  const handleSaveWebResultToMaterial = async (materialFormat: MaterialFormat) => {
    try {
      await apiPost('/api/unified-search/save-to-material', { materialFormat });
      toast.success('已保存到素材库');
      // 刷新推荐列表
      handleRecommendMaterials(false);
    } catch (error) {
      console.error('保存素材失败:', error);
      toast.error('保存素材失败');
    }
  };

  // P1-2: 组件卸载时取消互联网搜索请求
  useEffect(() => {
    return () => {
      if (webSearchAbortRef.current) {
        webSearchAbortRef.current.abort();
      }
    };
  }, []);

  // 🔥 行业案例：推荐相关案例（silent=true 时自动推荐，不弹 toast）
  const handleRecommendCases = useCallback(async (silent = false) => {
    if (!mainInstruction.trim()) {
      if (!silent) toast.error('请先输入任务指令');
      return;
    }
    setLoadingRecommendedCases(true);
    try {
      const data: any = await apiPost('/api/cases/recommend', { instruction: mainInstruction });
      const cases: CaseItem[] = data?.data?.cases || [];
      setRecommendedCases(cases);
      setHasSearchedCases(true);
      if (!silent) {
        if (cases.length > 0) {
          toast.success(`推荐了 ${cases.length} 条相关案例`);
        } else {
          toast.info('暂无匹配案例，当前案例库未覆盖该险种');
        }
      }
    } catch (error) {
      console.error('推荐案例失败:', error);
      if (!silent) toast.error('推荐案例失败');
    } finally {
      setLoadingRecommendedCases(false);
    }
  }, [mainInstruction]);

  // 🔥 行业案例：选择/取消选择
  const toggleCaseSelection = (caseItem: CaseItem) => {
    const alreadySelected = selectedCaseIds.includes(caseItem.id);
    if (alreadySelected) {
      setSelectedCaseIds(prev => prev.filter(id => id !== caseItem.id));
      setSelectedCases(prev => prev.filter(c => c.id !== caseItem.id));
    } else {
      setSelectedCaseIds(prev => [...prev, caseItem.id]);
      setSelectedCases(prev => [...prev, caseItem]);
    }
  };

  // 🔥 核心观点：自动推荐受 prevInstructionRef 保护（见上方素材自动推荐 useEffect）
  // 🔥 案例推荐：不由 mainInstruction 触发，仅由 handleAISplit（拆解后）和手动按钮触发
  // 🔥 案例推荐的数据来自快照持久化，刷新后从 sessionStorage 恢复

  // 🔥 自动推荐核心观点：指令变化后 800ms 自动触发观点推荐
  useEffect(() => {
    if (!mainInstruction.trim() || mainInstruction.trim().length < 4) {
      setAutoOpinionFetched(false);
      setSuggestedOpinions([]);
      return;
    }
    const timer = setTimeout(() => {
      handleSuggestOpinions(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [mainInstruction, handleSuggestOpinions]);

  // 🔥 信息速记：加载列表
  const loadSnippetList = useCallback(async () => {
    setSnippetLoading(true);
    try {
      const params = new URLSearchParams();
      if (snippetSearchQuery) params.set('search', snippetSearchQuery);
      if (snippetStatusFilter !== 'all') params.set('status', snippetStatusFilter);
      if (snippetTypeFilter !== 'all') params.set('snippetType', snippetTypeFilter);
      params.set('pageSize', '50');
      const data: any = await apiGet(`/api/info-snippets?${params.toString()}`);
      setSnippetList(data?.data?.list || data?.data || []);
    } catch (error) {
      console.error('[InfoSnippets] 加载失败:', error);
    } finally {
      setSnippetLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snippetSearchQuery, snippetStatusFilter, snippetTypeFilter]);

  // 🔥 信息速记：打开抽屉时加载
  useEffect(() => {
    if (showSnippetDrawer) {
      loadSnippetList();
    }
  }, [showSnippetDrawer, loadSnippetList]);

  // 🔥 信息速记：切到素材tab时加载速记（素材和速记已合并为统一入口）
  useEffect(() => {
    if (activeGuideTab === 'material') {
      loadSnippetList();
    }
  }, [activeGuideTab, loadSnippetList]);

  // 🔥 提醒中心：加载提醒数据和统计
  const loadReminderData = useCallback(async () => {
    try {
      const [listResult, statsResult] = await Promise.all([
        apiGet('/api/reminders?mode=list&status=pending'),
        apiGet('/api/reminders?mode=stats'),
      ]) as [any, any];
      
      if (listResult.success) {
        setReminderList(listResult.data || []);
      }
      if (statsResult.success) {
        setReminderStats(statsResult.data);
      }
    } catch (error) {
      console.error('加载提醒数据失败:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderDirection, reminderSearchQuery, selectedPersonFilter]);

  // 🔥 提醒中心：打开抽屉时加载
  useEffect(() => {
    if (showReminderDrawer) {
      loadReminderData();
    }
  }, [showReminderDrawer, loadReminderData]);

  // 🔥 提醒中心：完成提醒
  const handleCompleteReminder = async (id: string) => {
    try {
      const result = await apiPut(`/api/reminders/${id}`, { status: 'completed' }) as any;
      if (result.success) {
        toast.success('提醒已完成');
        loadReminderData();
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 🔥 提醒中心：删除提醒
  const handleDeleteReminder = async (id: string) => {
    try {
      const result = await apiDelete(`/api/reminders/${id}`) as any;
      if (result.success) {
        toast.success('提醒已删除');
        loadReminderData();
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 🔥 提醒中心：智能解析提醒输入
  const handleSmartParseReminder = async () => {
    if (!smartInputText.trim()) {
      toast.error('请输入提醒内容');
      return;
    }

    setParsingReminder(true);
    try {
      const result = await apiPost('/api/reminders/parse', {
        input: smartInputText.trim(),
      }) as any;

      if (result.success && result.data) {
        const parsed = result.data;

        // 根据解析结果填充表单
        const direction = parsed.executorType === '我自己' ? 'inbound' : 'outbound';
        const requesterName = direction === 'inbound' ? parsed.requester : (parsed.requester || '我');
        const assigneeName = direction === 'inbound' ? '我' : parsed.executor;

        // P1-2 修复：优先使用后端返回的 deadlineLocal（已处理时区）
        // 后端返回 deadlineLocal（datetime-local 格式）和 deadlineIso（ISO 格式）
        const remindAt = parsed.deadlineLocal || parsed.deadline || '';

        setNewReminderForm({
          requesterName,
          assigneeName,
          content: parsed.taskContent,
          remindAt,
          direction,
        });

        // 切换到手动模式让用户确认/修改
        setReminderInputMode('manual');

        // 显示解析提示
        if (parsed.confidence === 'low') {
          toast.warning('解析置信度较低，请确认信息是否正确');
        } else {
          toast.success('解析成功，请确认或修改信息');
        }

        // 如果有备注，显示出来
        if (parsed.extractionNotes) {
          console.log('[智能解析备注]', parsed.extractionNotes);
        }
      } else {
        toast.error(result.error || '解析失败');
      }
    } catch (error) {
      console.error('[智能解析错误]', error);
      toast.error('解析失败，请尝试手动填写');
    } finally {
      setParsingReminder(false);
    }
  };

  // 🔥 提醒中心：创建提醒
  const handleCreateReminder = async () => {
    if (!newReminderForm.requesterName.trim()) {
      toast.error('请输入要求者姓名');
      return;
    }
    if (!newReminderForm.assigneeName.trim()) {
      toast.error('请输入被要求者姓名');
      return;
    }
    if (!newReminderForm.content.trim()) {
      toast.error('请输入提醒内容');
      return;
    }
    if (!newReminderForm.remindAt) {
      toast.error('请选择提醒时间');
      return;
    }

    setCreatingReminder(true);
    try {
      const result = await apiPost('/api/reminders', {
        requesterName: newReminderForm.requesterName.trim(),
        assigneeName: newReminderForm.assigneeName.trim(),
        content: newReminderForm.content.trim(),
        remindAt: newReminderForm.remindAt,
        direction: newReminderForm.direction,
      }) as any;

      if (result.success) {
        toast.success('提醒创建成功');
        setShowCreateReminderDialog(false);
        setNewReminderForm({
          requesterName: '',
          assigneeName: '',
          content: '',
          remindAt: '',
          direction: 'outbound',
        });
        loadReminderData();
      } else {
        toast.error(result.error || '创建失败');
      }
    } catch (error) {
      toast.error('创建失败');
    } finally {
      setCreatingReminder(false);
    }
  };

  // 🔥 提醒中心：格式化时间
  const formatReminderTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `逾期 ${Math.abs(diffDays)} 天`;
    } else if (diffDays === 0) {
      return '今天';
    } else if (diffDays === 1) {
      return '明天';
    } else if (diffDays <= 7) {
      return `${diffDays} 天后`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  // 🔥 提醒中心：渲染人名头像
  const renderPersonAvatar = (name: string) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
    const colorIndex = name.charCodeAt(0) % colors.length;
    return (
      <div className={`w-6 h-6 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white text-xs font-medium`}>
        {name.charAt(0)}
      </div>
    );
  };

  // 🔥 提醒中心：分组提醒列表
  const reminderGroups = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const filtered = reminderList
      .filter(r => reminderDirection === 'all' || r.direction === reminderDirection)
      .filter(r => !reminderSearchQuery || r.content.toLowerCase().includes(reminderSearchQuery.toLowerCase()))
      .filter(r => !selectedPersonFilter || r.requesterName === selectedPersonFilter || r.assigneeName === selectedPersonFilter);
    
    const overdue = filtered.filter(r => new Date(r.remindAt) < today && r.status === 'pending');
    const todayList = filtered.filter(r => {
      const d = new Date(r.remindAt);
      return d >= today && d < tomorrow && r.status === 'pending';
    });
    const upcoming = filtered.filter(r => {
      const d = new Date(r.remindAt);
      return d >= tomorrow && d < nextWeek && r.status === 'pending';
    });
    const later = filtered.filter(r => new Date(r.remindAt) >= nextWeek && r.status === 'pending');
    
    return [
      { key: 'overdue', label: '已逾期', reminders: overdue, isOverdue: true },
      { key: 'today', label: '今天', reminders: todayList },
      { key: 'upcoming', label: '近7天', reminders: upcoming },
      { key: 'later', label: '稍后', reminders: later },
    ].filter(g => g.reminders.length > 0);
  }, [reminderList, reminderDirection, reminderSearchQuery, selectedPersonFilter]);

  // 🔥 信息速记：AI 分析原始内容
  const handleAnalyzeSnippet = async () => {
    if (!snippetForm.rawContent.trim()) {
      toast.error('请输入要记录的信息');
      return;
    }
    
    setSnippetAnalyzing(true);
    try {
      const result = await apiPost('/api/info-snippets/analyze', {
        rawContent: snippetForm.rawContent.trim(),
      }) as { success: boolean; data?: any; fromCache?: boolean; duplicateInfo?: any };
      
      if (result.success && result.data) {
        setSnippetAnalyzeResult(result.data);
        
        // 🔥 处理重复检测结果
        if (result.duplicateInfo?.isDuplicate) {
          const duplicateTypeText = result.duplicateInfo.duplicateType === 'exact' 
            ? '完全相同' 
            : '相似';
          toast.info(`📋 检测到重复速记（${duplicateTypeText}），${result.fromCache ? '已使用缓存的分析结果' : '请确认是否继续保存'}`);
          if (result.duplicateInfo.similarity) {
            console.log(`[InfoSnippets] 相似度: ${(result.duplicateInfo.similarity * 100).toFixed(1)}%`);
          }
        } else {
          toast.success(`AI 分析完成：${result.data.categoryLabels?.join('、') || '分析成功'}`);
        }
      } else {
        toast.error('AI 分析失败，请重试');
      }
    } catch (error) {
      console.error('[InfoSnippets] AI 分析失败:', error);
      toast.error('AI 分析失败，请重试');
    } finally {
      setSnippetAnalyzing(false);
    }
  };

  // 🔥 信息速记：取消分析结果，重新输入
  const handleCancelAnalyze = () => {
    setSnippetAnalyzeResult(null);
  };

  // 🔥 信息速记：确认保存
  const handleConfirmSaveSnippet = async () => {
    if (!snippetAnalyzeResult) {
      toast.error('请先进行 AI 分析');
      return;
    }
    
    setSnippetSaving(true);
    try {
      await apiPost('/api/info-snippets', {
        ...snippetAnalyzeResult,
        snippetType: 'memory',
      });
      toast.success('速记已保存');
      setSnippetForm({ rawContent: '' });
      setSnippetAnalyzeResult(null);
      loadSnippetList();
    } catch (error) {
      console.error('[InfoSnippets] 保存失败:', error);
      toast.error('保存失败');
    } finally {
      setSnippetSaving(false);
    }
  };

  // 🔥 信息速记：删除
  const handleDeleteSnippet = async (id: string, title: string) => {
    try {
      await apiDelete(`/api/info-snippets/${id}`);
      toast.success(`已删除「${title}」`);
      loadSnippetList();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 🔥 信息速记：选为素材（已入库的直接选，未入库的先入库再选）
  const handleSelectSnippetAsMaterial = async (snippet: InfoSnippet) => {
    try {
      let materialId = snippet.materialId;

      // 已入库且已选中 → 取消选择
      if (materialId && selectedMaterialIds.includes(materialId)) {
        setSelectedMaterialIds(prev => prev.filter(id => id !== materialId));
        setSelectedMaterials(prev => prev.filter(m => m.id !== materialId));
        return;
      }

      // 未入库：先入库
      if (!materialId) {
        const convertResult: any = await apiPost(`/api/info-snippets/${snippet.id}/convert-to-material`);
        if (convertResult.success && convertResult.data?.materialId) {
          materialId = convertResult.data.materialId;
          toast.success(`已入库并选为素材`);
          loadSnippetList(); // 刷新列表状态
        } else {
          toast.error(convertResult.error || '入库失败');
          return;
        }
      } else if (!selectedMaterialIds.includes(materialId)) {
        toast.success('已选为素材');
      }

      // 已入库且未选中 → 添加到已选素材
      if (materialId && !selectedMaterialIds.includes(materialId)) {
        setSelectedMaterialIds(prev => [...prev, materialId]);
        setSelectedMaterials(prev => [...prev, {
          id: materialId!,
          title: snippet.title || '无标题速记',
          type: 'data',
          content: snippet.rawContent || snippet.summary || '',
        }]);
      }
    } catch (error: any) {
      console.error('[InfoSnippets] 选为素材失败:', error);
      toast.error(error?.message || '操作失败');
    }
  };

  // 🔥 信息速记：在素材tab中选为素材（复用素材选择交互）
  const handleSelectSnippetInMaterialTab = async (snippet: InfoSnippet) => {
    try {
      let materialId = snippet.materialId;

      // 情形1: 已入库且已选中 → 取消选择
      if (materialId && selectedMaterialIds.includes(materialId)) {
        setSelectedMaterialIds(prev => prev.filter(id => id !== materialId));
        setSelectedMaterials(prev => prev.filter(m => m.id !== materialId));
        return;
      }

      // 情形2: 未入库 → 先入库
      if (!materialId) {
        const convertResult: any = await apiPost(`/api/info-snippets/${snippet.id}/convert-to-material`);
        if (convertResult.success && convertResult.data?.materialId) {
          materialId = convertResult.data.materialId;
          toast.success(`「${snippet.title || '速记'}」已入库并选为素材`);
          loadSnippetList(); // 刷新列表状态
        } else {
          toast.error(convertResult.error || '入库失败');
          return;
        }
      } else if (!selectedMaterialIds.includes(materialId)) {
        toast.success(`已选为素材`);
      }

      // 情形3: 已入库且未选中 → 添加到已选素材
      if (materialId && !selectedMaterialIds.includes(materialId)) {
        setSelectedMaterialIds(prev => [...prev, materialId]);
        setSelectedMaterials(prev => [...prev, {
          id: materialId!,
          title: snippet.title || '无标题速记',
          type: 'data',
          content: snippet.rawContent || snippet.summary || '',
        }]);
      }
    } catch (error: any) {
      console.error('[InfoSnippets] 选为素材失败:', error);
      toast.error(error?.message || '操作失败');
    }
  };

  // 🔥 提醒功能：轮询检查触发的提醒
  // 使用 dismissedIdSet 记录本次会话已处理的提醒 ID，避免重复弹窗
  // 🔥 获取确认创建子任务按钮的禁用原因
  const getSubmitDisabledReason = () => {
    if (submitLockRef.current || isSubmitting) {
      return '正在创建中...';
    }
    if (!taskTitle.trim()) {
      return '请填写任务标题';
    }
    if (!executionDate) {
      return '请选择执行日期';
    }
    if (platformSubTaskGroups.length === 0) {
      return '请先配置发布账号';
    }
    return null;
  };

  // 🔥 检查是否有重复任务
  const checkDuplicateTasks = async (): Promise<boolean> => {
    try {
      const mainExecutor = subTasks[0]?.executor || 'unknown';
      
      const data: any = await apiPost('/api/agents/b/check-duplicate', {
        taskTitle,
        executionDate,
        mainExecutor,
      });
      return data.hasDuplicate;
    } catch (error: any) {
      if (checkApiKeyMissing(error)) return false;
      console.error('检查重复任务失败:', error);
      return false; // 检查失败时，不阻止用户提交
    }
  };

  // 🔥 显示重复确认弹框
  const showDuplicateConfirmDialog = (): Promise<boolean> => {
    return new Promise((resolve) => {
      setShowDuplicateDialog(true);
      duplicateConfirmResolveRef.current = resolve;
    });
  };

  // 🔥 处理用户确认重复创建
  const handleDuplicateConfirm = () => {
    setShowDuplicateDialog(false);
    if (duplicateConfirmResolveRef.current) {
      duplicateConfirmResolveRef.current(true);
      duplicateConfirmResolveRef.current = null;
    }
  };

  // 🔥 处理用户取消重复创建
  const handleDuplicateCancel = () => {
    setShowDuplicateDialog(false);
    if (duplicateConfirmResolveRef.current) {
      duplicateConfirmResolveRef.current(false);
      duplicateConfirmResolveRef.current = null;
    }
  };

  // 🔥 显示确认创建弹框
  const showConfirmCreateDialog = (): Promise<boolean> => {
    return new Promise((resolve) => {
      setShowConfirmDialog(true);
      confirmCreateResolveRef.current = resolve;
    });
  };

  // 🔥 处理用户确认创建
  const handleConfirmCreate = () => {
    setShowConfirmDialog(false);
    if (confirmCreateResolveRef.current) {
      confirmCreateResolveRef.current(true);
      confirmCreateResolveRef.current = null;
    }
  };

  // 🔥 处理用户取消创建
  const handleCancelCreate = () => {
    setShowConfirmDialog(false);
    if (confirmCreateResolveRef.current) {
      confirmCreateResolveRef.current(false);
      confirmCreateResolveRef.current = null;
    }
  };

  // 🔥 实际提交到服务器
  const submitToServer = async () => {
    // 🔥 当有平台分组时，注入平台信息让后端按平台筛选子任务
    // 🔥 单平台模式也注入默认平台信息，确保数据格式一致
    // multiPlatformGroupId/platformGroupIndex/platformGroupTotal 由后端统一生成
    const validSubTasks = platformSubTaskGroups.length > 0 
      ? platformSubTaskGroups.flatMap((g) => 
          g.subTasks.map(st => ({
            ...st,
            accountId: g.accountId,
            platform: g.platform,
            platformLabel: g.platformLabel,
          }))
        )
      : subTasks.filter(t => t.title.trim()).map(st => ({
          ...st,
          accountId: st.accountId || selectedAccountId || null,
          platform: st.platform || (selectedAccountId ? 'wechat_official' : null),
          platformLabel: st.platformLabel || null,
        }));
    
    // 🔥 P1: 校验是否选择了发布账号
    if (accountConfigs.length > 0 && selectedAccountIds.length === 0) {
      toast.error('请在创作引导中选择至少一个发布账号');
      return;
    }
    
    // 🆕 为每个子任务根据 creationGuideConfig 组装独立的创作引导
    // 🔥 结构详情（隐性继承，始终传递）
    const structureDetailJson = selectedStructure ? JSON.stringify({
      id: selectedStructure.id,
      name: selectedStructure.name,
      description: selectedStructure.description,
      sections: selectedStructure.sections,
      totalWordCount: selectedStructure.totalSuggestedWordCount || selectedStructure.sections.reduce((sum, s) => sum + s.suggestedWordCount, 0),
    }) : null;
    
    // 🔥 构建子任务的创作引导信息
    const buildTasksWithGuide = (tasks: SubTask[]) => tasks.filter(t => t.title.trim()).map(task => {
      const inheritFromGlobal = task.creationGuideConfig?.inheritFromGlobal ?? true;

      const taskStructureName = selectedStructure?.name || null;
      const taskStructureDetail = structureDetailJson;

      if (inheritFromGlobal) {
        let taskUserOpinion = '';
        if (coreOpinion.trim()) {
          taskUserOpinion += `【核心观点】${coreOpinion.trim()}`;
        }
        taskUserOpinion += `${taskUserOpinion ? '\n' : ''}【情感基调】${emotionTone}`;
        if (selectedStructure) {
          taskUserOpinion += `${taskUserOpinion ? '\n' : ''}【文章结构】${selectedStructure.name}（${selectedStructure.sections.length}段，约${selectedStructure.totalSuggestedWordCount || selectedStructure.sections.reduce((sum, s) => sum + s.suggestedWordCount, 0)}字）`;
        }
        // 🔥 原始指令不再拼入 userOpinion，改为独立传递 originalInstruction

        return {
          ...task,
          userOpinion: taskUserOpinion,
          originalInstruction: mainInstruction.trim() || null, // 🔥 独立字段
          materialIds: selectedMaterialIds,
          caseIds: selectedCaseIds,
          structureName: taskStructureName,
          structureDetail: taskStructureDetail,
        };
      } else {
        let taskUserOpinion = `【情感基调】${emotionTone}`;
        if (selectedStructure) {
          taskUserOpinion += `\n【文章结构】${selectedStructure.name}（${selectedStructure.sections.length}段，约${selectedStructure.totalSuggestedWordCount || selectedStructure.sections.reduce((sum, s) => sum + s.suggestedWordCount, 0)}字）`;
        }
        // 🔥 原始指令不再拼入 userOpinion，改为独立传递 originalInstruction

        return {
          ...task,
          userOpinion: taskUserOpinion,
          originalInstruction: mainInstruction.trim() || null, // 🔥 独立字段
          materialIds: [],
          caseIds: [],
          structureName: taskStructureName,
          structureDetail: taskStructureDetail,
        };
      }
    });

    try {
      const result: any = await apiPost('/api/agents/b/simple-split', {
        taskTitle,
        taskDescription,
        executionDate,
        subTasks: buildTasksWithGuide(validSubTasks),
        tempSessionId,
        // 以下字段用于 daily_task 表存储（向后兼容）
        userOpinion: coreOpinion.trim() || null,
        originalInstruction: mainInstruction.trim() || null, // 🔥 独立字段：用户原始指令
        materialIds: selectedMaterialIds,
        caseIds: selectedCaseIds,
        // 结构选择数据（隐性继承，始终传递）
        structureName: selectedStructure?.name || null,
        structureDetail: structureDetailJson,
        // 发布账号（用于获取风格模板）
        accountId: selectedAccountId || null,
        // 多平台发布：选中的账号ID列表
        accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : null,
        // 内容模板ID（Phase 2-1: 图文分工模板）
        contentTemplateId: selectedContentTemplate?.id || null,
        // 🔥 后端根据 subTasks 是否含 accountId 自动判断步骤来源
        // 含 accountId → 前端用户编辑的步骤（优先）
        // 不含 accountId → 流程模板或原始步骤
      });

      toast.success(`✅ 成功创建 ${result.data.insertedCount} 个子任务`);
      
      // 提交成功后清除 localStorage 草稿
      // 🔥 严重问题 3.1 修复：重新拆解时清空 FormSnapshot，防止旧数据被恢复
      clearFormSnapshot();
      // 提交成功后清除 sessionStorage 表单快照
      clearFormSnapshot();
      
      if (result.data.tempSessionId) {
        setTempSessionId(result.data.tempSessionId);
      }
      
    } catch (error: any) {
      if (checkApiKeyMissing(error)) return;
      toast.error(`❌ 创建失败: ${error.message}`);
      throw error;
    }
  };

  // 🔴 新增：手动重置提交锁（安全机制）
  const resetSubmitLock = () => {
    submitLockRef.current = false;
    setIsSubmitting(false);
    toast.success('🔄 提交按钮已重置，请重新尝试');
    console.log('🔄 手动重置提交锁');
  };

  // 🔥 主提交函数
  const handleSubmit = async () => {
    // 1. 立即加锁，防止重复点击
    // 立即输出所有关键字段值，便于排查
    console.log('========== 提交流程开始 ==========');
    console.log('taskTitle:', JSON.stringify(taskTitle));
    console.log('executionDate:', executionDate);
    console.log('platformSubTaskGroups.length:', platformSubTaskGroups.length);
    console.log('platformSubTaskGroups:', JSON.stringify(platformSubTaskGroups, null, 2));
    console.log('subTasks.length:', subTasks?.length);
    console.log('selectedMaterials.length:', selectedMaterials?.length);
    console.log('selectedCases.length:', selectedCases?.length);
    console.log('========== 字段值输出完毕 ==========');
    console.log('检查1 submitLockRef.current=', submitLockRef.current);
    if (submitLockRef.current) {
      toast.warning('正在创建中，请勿重复点击。如果卡住了，点击按钮旁的重置图标');
      return;
    }

    // 2. 强制字段约束验证
    console.log('检查2 taskTitle.trim()=', taskTitle.trim(), '空=', !taskTitle.trim());
    if (!taskTitle.trim()) {
      toast.error('请填写任务标题');
      return;
    }
    
    console.log('检查3 executionDate=', executionDate, '空=', !executionDate);
    if (!executionDate) {
      toast.error('请选择执行日期');
      return;
    }

    console.log('检查4 platformSubTaskGroups.length=', platformSubTaskGroups.length, '为0=', platformSubTaskGroups.length === 0);
    if (platformSubTaskGroups.length === 0) {
      toast.error('请先配置发布账号');
      return;
    }

    // 3. 加锁并设置状态
    submitLockRef.current = true;
    setIsSubmitting(true);
    
    try {
      console.log('🚀 开始提交任务...');
      
      // 4. 先显示确认创建弹框
      const confirmedCreate = await showConfirmCreateDialog();
      if (!confirmedCreate) {
        console.log('❌ 用户取消确认创建');
        return; // 用户取消，不提交
      }

      // 5. 检查是否有重复任务
      const hasDuplicate = await checkDuplicateTasks();
      if (hasDuplicate) {
        const confirmed = await showDuplicateConfirmDialog();
        if (!confirmed) {
          console.log('❌ 用户取消重复确认');
          return; // 用户取消，不提交
        }
      }

      // 6. 用户确认后，提交到服务器
      console.log('📤 提交到服务器...');
      await submitToServer();
      console.log('✅ 任务提交成功');
      
    } catch (error: any) {
      console.error('❌ 提交失败:', error);
      // 错误已经在 submitToServer 中处理了
    } finally {
      console.log('🔄 最终清理：重置提交锁');
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  };

  // 🔥 新增：加载文章历史版本
  const loadArticleVersions = async (commandResultId: string) => {
    if (!commandResultId) {
      toast.error('请先选择一个任务');
      return;
    }

    try {
      setLoadingVersions(true);
      console.log('📄 加载文章历史版本:', commandResultId);
      
      const data: any = await apiGet(`/api/articles/history?commandResultId=${commandResultId}`);
      if (data?.success) {
        setArticleVersions(data.versions);
        if (data.versions.length >= 2) {
          setSelectedVersion1(data.versions[0].timestamp?.toString());
          setSelectedVersion2(data.versions[data.versions.length - 1].timestamp?.toString());
        } else if (data.versions.length === 1) {
          setSelectedVersion1(data.versions[0].timestamp?.toString());
          setSelectedVersion2('');
        }
        toast.success(`找到 ${data.versions.length} 个版本`);
      }
    } catch (error) {
      console.error('❌ 加载文章历史版本失败:', error);
      toast.error('加载失败');
    } finally {
      setLoadingVersions(false);
    }
  };

  // 🔥 新增：计算文本差异（简化版）
  const renderTextDiff = (text1: string, text2: string) => {
    if (!text1 || !text2) return null;
    
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);
    
    return (
      <div className="font-mono text-sm border rounded-lg overflow-hidden">
        <div className="grid grid-cols-2 bg-gray-100 border-b">
          <div className="px-4 py-2 font-semibold text-sm text-gray-600">旧版本</div>
          <div className="px-4 py-2 font-semibold text-sm text-gray-600">新版本</div>
        </div>
        <div className="divide-y">
          {Array.from({ length: maxLines }).map((_, i) => {
            const line1 = lines1[i] || '';
            const line2 = lines2[i] || '';
            const isSame = line1 === line2;
            
            return (
              <div key={i} className="grid grid-cols-2 divide-x">
                <div className={`px-4 py-1 ${!isSame && line1 ? 'bg-red-50' : ''}`}>
                  <span className={!isSame && line1 ? 'text-red-700' : 'text-gray-700'}>
                    {!isSame && line1 && <span className="font-bold mr-1">-</span>}
                    {line1 || <span className="text-gray-300">∅</span>}
                  </span>
                </div>
                <div className={`px-4 py-1 ${!isSame && line2 ? 'bg-green-50' : ''}`}>
                  <span className={!isSame && line2 ? 'text-green-700' : 'text-gray-700'}>
                    {!isSame && line2 && <span className="font-bold mr-1">+</span>}
                    {line2 || <span className="text-gray-300">∅</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 🔥 新增：加载任务统计（用于Tab徽章）
  const loadTaskStats = async () => {
    try {
      setLoadingStats(true);
      
      // 同时加载 Agent B 和 insurance-d 的统计
      const [agentBRes, insuranceDRes] = await Promise.all([
        fetch('/api/agents/B/tasks'),
        fetch('/api/agents/insurance-d/tasks'),
      ]);
      
      // 安全解析：先检查状态码再 json()
      let pending = 0, in_progress = 0, waiting_user = 0;
      
      if (agentBRes.ok) {
        try {
          const agentBData = await agentBRes.json();
          pending += (agentBData.data?.stats?.pending || 0);
          in_progress += (agentBData.data?.stats?.in_progress || 0);
          waiting_user += (agentBData.data?.stats?.waiting_user || 0);
        } catch { /* ignore parse error */ }
      }
      
      if (insuranceDRes.ok) {
        try {
          const insuranceDData = await insuranceDRes.json();
          pending += (insuranceDData.data?.stats?.pending || 0);
          in_progress += (insuranceDData.data?.stats?.in_progress || 0);
          waiting_user += (insuranceDData.data?.stats?.waiting_user || 0);
        } catch { /* ignore parse error */ }
      }
      
      setTaskStats({ pending, in_progress, waiting_user });
    } catch (error) {
      console.error('❌ 加载任务统计失败:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // 🔥 新增：组件加载时和定时刷新任务统计 + 重置提交锁
  useEffect(() => {
    loadTaskStats();
    // 🔴 关键修复：组件加载时强制重置提交锁，防止按钮一直禁用
    submitLockRef.current = false;
    console.log('🔄 组件已加载，提交锁已重置');
    
    // 🔥 优化：使用页面可见性 API 替代定时轮询（业界标准做法）
    // 只在页面重新可见时刷新统计，减少不必要的请求
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTaskStats();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <div className="container mx-auto py-8 max-w-6xl relative">
      <Tabs defaultValue="split" className="w-full">
        {/* 🔥 美化后的TabList - 统一天蓝色系 */}
        <TabsList className="mb-6 p-1.5 bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
          {/* 任务拆解 Tab - 主天蓝色主题 */}
          <TabsTrigger 
            value="split" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-200 hover:bg-white/70"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            <span className="font-medium">任务拆解</span>
          </TabsTrigger>

          {/* 任务列表 Tab - 副天蓝色主题 + 数字徽章 */}
          <TabsTrigger 
            value="tasks" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-cyan-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-sky-200 hover:bg-white/70"
          >
            <ListTodo className="w-5 h-5 mr-2" />
            <span className="font-medium">任务列表</span>
            {(() => {
              const total = taskStats.pending + taskStats.in_progress + taskStats.waiting_user;
              if (total > 0) {
                return (
                  <Badge 
                    className="ml-2 h-6 min-w-6 px-2 text-xs font-bold bg-gradient-to-r from-rose-500 to-red-600 text-white border-0 shadow-lg shadow-rose-200 animate-pulse"
                  >
                    {total > 99 ? '99+' : total}
                  </Badge>
                );
              }
              return null;
            })()}
          </TabsTrigger>



          {/* 对比草稿与终稿 Tab - 副天蓝色主题 - 只有超级管理员可见 */}
          {isSuperAdmin && (
            <TabsTrigger 
              value="article-compare" 
              className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-indigo-200 hover:bg-white/70"
            >
              <GitCompare className="w-5 h-5 mr-2" />
              <span className="font-medium">对比草稿</span>
            </TabsTrigger>
          )}

          {/* 内容导出 Tab - 渐变紫粉色主题 */}
          <TabsTrigger 
            value="content-export" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-200 hover:bg-white/70"
          >
            <Download className="w-5 h-5 mr-2" />
            <span className="font-medium">内容导出</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="split">
          {/* 任务拆解主内容 */}
          <Card className="border-blue-100 shadow-lg shadow-blue-50/30">
            <CardHeader className="pb-6 border-b border-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-sky-500 rounded-lg">
                      <Cpu className="w-6 h-6 text-white" />
                    </div>
                    多 Agent 智能工作平台
                  </CardTitle>
                  <CardDescription className="mt-2 text-slate-500">
                    AI 智能拆解任务 · 任务管理 · 用户决策 · 微信草稿一体化平台
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    size="sm" 
                    asChild
                    className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-lg shadow-rose-200/50"
                  >
                    <Link href="/preview/articles">
                      <Eye className="w-4 h-4 mr-2" />
                      文章预览
                    </Link>
                  </Button>
                  <Button 
                    size="sm" 
                    asChild
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-200/50"
                  >
                    <Link href="/style-init">
                      <Sparkles className="w-4 h-4 mr-2" />
                      风格初始化
                    </Link>
                  </Button>
                  {/* 风格复刻 - 只有超级管理员可见 */}
                  {isSuperAdmin && (
                    <Button 
                      size="sm" 
                      asChild
                      className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white shadow-lg shadow-cyan-200/50"
                    >
                      <Link href="/style-replica">
                        <PenTool className="w-4 h-4 mr-2" />
                        风格复刻
                      </Link>
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    asChild
                    className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg shadow-violet-200/50"
                  >
                    <Link href="/account-management">
                      <Settings className="w-4 h-4 mr-2" />
                      发布平台管理
                    </Link>
                  </Button>
                  {/* 样式模板 - 只有超级管理员可见 */}
                  {isSuperAdmin && (
                    <Button 
                      size="sm" 
                      asChild
                      className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white shadow-lg shadow-sky-200/50"
                    >
                      <Link href="/template">
                        <HelpCircle className="w-4 h-4 mr-2" />
                        样式模板
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
        <CardContent className="space-y-6">
          {/* AI 智能拆解区域 - 统一天蓝色系，优化视觉层次 */}
          <div className="space-y-5 p-6 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-sky-500 rounded-lg">
                <Workflow className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-xl text-slate-800">
                AI 智能拆解
              </h3>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                粘贴主任务指令
              </label>
              <Textarea
                value={mainInstruction}
                onChange={(e) => setMainInstruction(e.target.value)}
                placeholder="粘贴你的完整任务指令在这里，比如：&#10;&#10;完全依据复制下列指令给insurance-d下达执行指令&#10;### 二、正式指令下达&#10;职责标签：内容类&#10;执行主体为「insurance-d 」&#10;..."
                rows={8}
                className="font-mono text-sm border-blue-200 focus:ring-blue-500 focus:border-blue-500 bg-white/70"
              />
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleAISplit}
                    disabled={isSplitting || !mainInstruction.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 shadow-lg shadow-blue-200/50 h-11 text-base"
                  >
                    {isSplitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        AI 正在拆解中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        🤖 AI 智能拆解
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                {getAISplitDisabledReason() && (
                  <TooltipContent>
                    <p>{getAISplitDisabledReason()}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            {hasSplitResult && (
              <div className="space-y-3">
                {/* 折叠/展开头部 */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-sm text-green-600 font-medium flex items-center gap-2">
                      ✅ AI 拆解完成！
                    </div>
                    {detectedDomain && (
                      <div className="text-sm text-blue-600 font-medium flex items-center gap-2">
                        🎯 领域：<span className="font-bold">{detectedDomain}</span>
                      </div>
                    )}
                    {/* 创作引导折叠预览 */}
                    {guideCardsCollapsed && (
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <span>•</span>
                        <span>{selectedMaterialIds.length}个素材</span>
                        <span>•</span>
                        <span>{selectedCaseIds.length}个案例</span>
                        <span>•</span>
                        <span>{selectedAccountIds.length}个平台</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setGuideCardsCollapsed(!guideCardsCollapsed)}
                      className="text-xs text-slate-500 hover:text-slate-700 h-7 px-2"
                    >
                      {guideCardsCollapsed ? '展开编辑' : '收起'}
                      <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${guideCardsCollapsed ? '' : 'rotate-180'}`} />
                    </Button>
                  </div>
                </div>

                {/* 展开状态显示详情 */}
                {!guideCardsCollapsed && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPrompt(!showPrompt)}
                      className="text-xs"
                    >
                      {showPrompt ? '📕 隐藏提示词' : '📖 查看完整提示词'}
                    </Button>
                    {showPrompt && fullPrompt && (
                      <div className="bg-gray-50 p-4 rounded-lg border text-xs font-mono overflow-auto max-h-96">
                        <pre className="whitespace-pre-wrap">{fullPrompt}</pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 🔥 创作引导区域（大卡片网格布局） */}
          {hasSplitResult && (
            <div className="space-y-6">
              {/* 大标题：通用配置 */}
              <div className="flex items-center justify-center gap-4">
                <div className="h-[3px] w-20 bg-gradient-to-r from-transparent to-sky-500 rounded-full"></div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
                  通用配置
                </h2>
                <div className="h-[3px] w-20 bg-gradient-to-l from-transparent to-sky-500 rounded-full"></div>
              </div>

              {/* 4张大卡片网格（仅当未选择具体卡片时显示） */}
              {!activeGuideCard ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  {/* 卡片1：内容模版（小红书特有） */}
                  <button
                    type="button"
                    onClick={() => setActiveGuideCard('content')}
                    className="group relative bg-white rounded-3xl border-2 border-slate-100 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-rose-200/70 hover:border-rose-200 transition-all duration-300 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative p-6 md:p-8">
                      {/* 顶部装饰 */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-sm font-medium text-slate-500">插面区</span>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        </div>
                      </div>

                      {/* 大图标 */}
                      <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center shadow-xl shadow-rose-200">
                          <FileText className="w-12 h-12 md:w-14 md:h-14 text-white" />
                        </div>
                      </div>

                      {/* 标题 */}
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900 text-center">
                        内容模版
                      </h3>

                      {/* 平台特有标识 */}
                      <div className="mt-2 flex justify-center">
                        <Badge className="text-xs bg-rose-100 text-rose-700 border border-rose-200">
                          小红书专属
                        </Badge>
                      </div>

                      {/* 状态Badge */}
                      {selectedContentTemplate && (
                        <div className="mt-2 flex justify-center">
                          <Badge className="text-xs bg-rose-100 text-rose-700 border border-rose-200">
                            {selectedContentTemplate.name || '已选择'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* 卡片2：结构选择（公众号特有） */}
                  <button
                    type="button"
                    onClick={() => setActiveGuideCard('structure')}
                    className="group relative bg-white rounded-3xl border-2 border-slate-100 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-emerald-200/70 hover:border-emerald-200 transition-all duration-300 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative p-6 md:p-8">
                      {/* 顶部装饰 */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                            <Layers className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-sm font-medium text-slate-500">结构区</span>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        </div>
                      </div>

                      {/* 大图标 */}
                      <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-xl shadow-emerald-200">
                          <Workflow className="w-12 h-12 md:w-14 md:h-14 text-white" />
                        </div>
                      </div>

                      {/* 标题 */}
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900 text-center">
                        结构选择
                      </h3>

                      {/* 平台特有标识 */}
                      <div className="mt-2 flex justify-center">
                        <Badge className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200">
                          公众号专属
                        </Badge>
                      </div>

                      {/* 状态Badge */}
                      {selectedStructure && (
                        <div className="mt-2 flex justify-center">
                          <Badge className="text-xs bg-slate-100 text-slate-600 border border-slate-200">
                            {selectedStructure.sections.length}段
                          </Badge>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* 卡片3：发布平台 */}
                  <button
                    type="button"
                    onClick={() => setActiveGuideCard('platform')}
                    className="group relative bg-white rounded-3xl border-2 border-slate-100 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-amber-200/70 hover:border-amber-200 transition-all duration-300 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative p-6 md:p-8">
                      {/* 顶部装饰 */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                            <Building2 className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-sm font-medium text-slate-500">版面区</span>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        </div>
                      </div>

                      {/* 大图标 */}
                      <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl shadow-amber-200">
                          <Rocket className="w-12 h-12 md:w-14 md:h-14 text-white" />
                        </div>
                      </div>

                      {/* 标题 */}
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900 text-center">
                        发布平台
                      </h3>

                      {/* 状态Badge */}
                      {selectedAccountIds.length > 0 && (
                        <div className="mt-3 flex justify-center">
                          <Badge className="text-xs bg-amber-100 text-amber-700 border border-amber-200">
                            {selectedAccountIds.length}个平台
                          </Badge>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* 卡片4：创作引导 */}
                  <button
                    type="button"
                    onClick={() => setActiveGuideCard('guide')}
                    className="group relative bg-white rounded-3xl border-2 border-slate-100 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-indigo-200/70 hover:border-indigo-200 transition-all duration-300 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative p-6 md:p-8">
                      {/* 顶部装饰 */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-sm font-medium text-slate-500">核心配置</span>
                        </div>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        </div>
                      </div>

                      {/* 大图标 */}
                      <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-200">
                          <Brain className="w-12 h-12 md:w-14 md:h-14 text-white" />
                        </div>
                      </div>

                      {/* 标题 */}
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900 text-center">
                        通用配置
                      </h3>

                      {/* 状态Badge */}
                      {(coreOpinion.trim() || emotionTone !== '理性客观' || selectedMaterials.length > 0) && (
                        <div className="mt-3 flex justify-center">
                          <Badge className="text-xs bg-indigo-100 text-indigo-700 border border-indigo-200">
                            {[
                              coreOpinion.trim() && '通用输入',
                              emotionTone !== '理性客观' && emotionTone,
                              selectedMaterials.length > 0 && `${selectedMaterials.length}素材`,
                              selectedCases.length > 0 && `${selectedCases.length}案例`,
                            ].filter(Boolean).join('·')}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ) : (
                /* 返回按钮 */
                <div className="space-y-0">
                  <button
                    type="button"
                    onClick={() => setActiveGuideCard(null)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <ChevronDown className="w-4 h-4 rotate-90" />
                      返回通用配置
                    </div>
                  </button>
                </div>
              )}

              {/* 原始创作引导内容（在 activeGuideCard 有值时显示） */}
              {activeGuideCard && (
                <div className="space-y-5">
                  {/* 🔥🔥 小红书专属配置：内容模板（从风格复刻保存的图文模板） */}
                  {(() => {
                    // 仅在 activeGuideCard === 'content' 时显示
                    if (activeGuideCard !== 'content') return null;
                    
                    // 检查是否选择了小红书账号
                    const hasXiaohongshuAccount = selectedAccountIds.some(aId => {
                      const ac = accountConfigs.find(a => a.account.id === aId);
                      return ac?.account.platform === 'xiaohongshu';
                    });
                    if (!hasXiaohongshuAccount) return null;

                    // 从 URL 读取 contentTemplateId 参数（从 style-init 的"立即使用"按钮跳转过来）
                    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                    const urlTemplateId = urlParams?.get('contentTemplateId');

                    return (
                      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
                        {/* 标题区域 */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-rose-500 to-pink-500 rounded-xl flex items-center justify-center">
                              <Palette className="w-5.5 h-5.5 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl font-bold text-slate-900">内容模版</h2>
                                <Badge className="text-xs text-rose-700 bg-rose-100 border border-rose-200">小红书专属</Badge>
                                {selectedContentTemplate && (
                                  <Badge className="text-xs text-emerald-700 bg-emerald-100 border border-emerald-200">已选择</Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 mt-1">选择图文分工模板，一键匹配你的创作风格</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href="/style-init"
                              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs font-medium text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-all duration-200"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              上传笔记创建
                            </Link>
                          </div>
                        </div>
                        
                        {/* 内容区域 - 优化层次 */}
                        <div className="p-6 bg-gradient-to-b from-slate-50 to-white">
                            <ContentTemplateSelector
                              onSelect={(template) => {
                                setSelectedContentTemplate(template);
                                if (template?.promptInstruction) {
                                  if (!coreOpinion.trim() || coreOpinion.startsWith('【图文分工】')) {
                                    setCoreOpinion(`【图文分工】${template.promptInstruction}`);
                                  }
                                } else {
                                  if (coreOpinion.startsWith('【图文分工】')) {
                                    setCoreOpinion('');
                                  }
                                }
                              }}
                              selectedId={selectedContentTemplate?.id || urlTemplateId || null}
                            />

                            {/* 已选择模板展示 */}
                            {selectedContentTemplate && (
                              <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-4 border border-rose-200 shadow-sm mt-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle2 className="w-4 h-4 text-rose-500" />
                                  <p className="text-sm font-semibold text-slate-800">已选择模板：{selectedContentTemplate.name}</p>
                                </div>
                                {selectedContentTemplate.promptInstruction && (
                                  <p className="text-sm text-slate-600 leading-relaxed ml-6">{selectedContentTemplate.promptInstruction}</p>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ② 文章结构选择（仅在 activeGuideCard === 'structure' 时显示） */}
                  {activeGuideCard === 'structure' && (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
                    {/* 标题区域 */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-bold text-slate-900">文章结构</h2>
                          <Badge className="text-xs text-blue-700 bg-blue-100 border border-blue-200">
                            {selectedStructure.name}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">选择文章的段落结构模板，不同结构适合不同场景</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveGuideCard(null)}
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* 结构模板列表 */}
                    <div className="p-6 bg-slate-50/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {STRUCTURE_TEMPLATES.map((structure) => (
                          <div
                            key={structure.id}
                            onClick={() => setSelectedStructure(structure)}
                            className={`
                              p-4 rounded-xl border-2 cursor-pointer transition-all duration-200
                              ${selectedStructure.id === structure.id
                                ? 'border-blue-500 bg-blue-50 shadow-md'
                                : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                              }
                            `}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold text-slate-900">{structure.name}</h3>
                              {selectedStructure.id === structure.id && (
                                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mb-3">{structure.description}</p>
                            <div className="flex flex-wrap gap-1">
                              {structure.sections.map((section, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                                >
                                  {section.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* ③ 发布账号（仅在 activeGuideCard === 'platform' 时显示） */}
                  {activeGuideCard === 'platform' && (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
                    {/* 标题区域 */}
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-bold text-slate-900">发布平台</h2>
                          {selectedAccountIds.length > 0 && (
                            <Badge className="text-xs text-amber-700 bg-amber-100 border border-amber-200">{selectedAccountIds.length}个平台</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">选择要发布的平台账号，支持多平台同时发布</p>
                      </div>
                      <Link href="/account-management">
                        <Button variant="outline" size="sm" className="text-sm">
                          <Settings className="w-4 h-4 mr-1.5" />管理账号
                        </Button>
                      </Link>
                    </div>
                    
                    {/* 内容区域 */}
                    <div className="p-6 bg-slate-50/50">
                      {loadingAccounts ? (
                        <div className="flex items-center gap-2 py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                          <span className="text-sm text-slate-500">加载账号...</span>
                        </div>
                      ) : accountConfigs.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Building2 className="w-10 h-10 text-slate-400" />
                          </div>
                          <p className="text-sm text-slate-500 mb-4">暂无配置的账号</p>
                          <Link href="/account-management">
                            <Button variant="outline" size="sm">
                              <Plus className="w-4 h-4 mr-1" />添加账号
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          {/* 按平台分组展示 */}
                          {['wechat_official', 'xiaohongshu', 'zhihu', 'douyin', 'weibo'].map((platform) => {
                            const platformAccounts = accountConfigs.filter(({ account }) => account.platform === platform);
                            if (platformAccounts.length === 0) return null;
                            const platformLabel = (PLATFORM_LABELS as Record<string, string>)[platform] || platform;
                            const platformEmoji: Record<string, string> = {
                              wechat_official: '📱', xiaohongshu: '📕', zhihu: '🔵', douyin: '🎵', weibo: '🔴',
                            };
                            const emoji = platformEmoji[platform] || '📱';
                            
                            return (
                              <div key={platform}>
                                <div className="flex items-center gap-2 mb-4">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <h3 className="text-sm font-medium text-slate-700">{platformLabel}</h3>
                                </div>
                                <div className="grid grid-cols-5 md:grid-cols-7 gap-4">
                                  {platformAccounts.map(({ account, template }) => {
                                    const isSelected = selectedAccountIds.includes(account.id);
                                    return (
                                      <button
                                        key={account.id}
                                        type="button"
                                        onClick={() => {
                                          if (isSelected) {
                                            const newIds = selectedAccountIds.filter(id => id !== account.id);
                                            setSelectedAccountIds(newIds);
                                            setSelectedAccountId(newIds[0] || '');
                                          } else {
                                            if (selectedAccountIds.length >= 3) {
                                              toast.warning('最多可选 3 个平台');
                                              return;
                                            }
                                            const newIds = [...selectedAccountIds, account.id];
                                            setSelectedAccountIds(newIds);
                                            setSelectedAccountId(newIds[0]);
                                          }
                                        }}
                                        className={`
                                          relative aspect-square rounded-2xl border-2 transition-all duration-200 flex items-center justify-center
                                          ${isSelected
                                            ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-400 shadow-md'
                                            : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/40'
                                          }
                                        `}
                                      >
                                        {/* 平台图标模拟 */}
                                        <div className={`
                                          w-12 h-12 rounded-full flex items-center justify-center text-xl
                                          ${isSelected
                                            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                                            : 'bg-slate-100'
                                          }
                                        `}>
                                          {emoji}
                                        </div>
                                        
                                        {/* 选中状态指示 */}
                                        {isSelected && (
                                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                          </div>
                                        )}
                                        
                                        {/* 模板标签 */}
                                        {template && (
                                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-slate-900/90 text-white border-transparent">
                                              {template.name.length > 4 ? template.name.slice(0, 4) + '...' : template.name}
                                            </Badge>
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* 多平台提示 */}
                          {selectedAccountIds.length > 1 && (() => {
                            // P2-7 修复：适配组数量 = 总账号数 - 1
                            // 两阶段架构始终有且仅有一个基础文章组，剩余的都是适配组
                            const adaptationCount = selectedAccountIds.length - 1;
                            
                            const hasWechatAccount = selectedAccountIds.some(aId => {
                              const config = accountConfigs.find(c => c.account.id === aId);
                              return config?.account?.platform === 'wechat_official';
                            });
                            return (
                              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                {hasWechatAccount ? (
                                  <div className="space-y-1.5">
                                    <p className="text-sm text-amber-800 flex items-center gap-2">
                                      <Layers className="w-4 h-4" />
                                      <span className="font-semibold">基础文章+平台适配</span>协同模式
                                    </p>
                                    <p className="text-xs text-amber-700">
                                      先打磨公众号基础文章 → 定稿后自动适配到其他 {adaptationCount} 个平台
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-amber-800 flex items-center gap-2">
                                    <Rocket className="w-4 h-4" />
                                    将为 <span className="font-semibold">{adaptationCount + 1}</span> 个平台分别生成差异化文章
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                    </div>
                  </div>
                  )}

                  {/* ④ 通用配置（仅在 activeGuideCard === 'guide' 时显示） */}
                  {activeGuideCard === 'guide' && (
                  <Card className="border border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
                    {/* 顶部标题栏 */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-lg">
                          <Brain className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold text-base text-slate-900">通用配置</span>
                          <Badge className="text-xs text-sky-700 bg-sky-100 border border-sky-200 h-6">可选</Badge>
                          {(coreOpinion.trim() || selectedMaterials.length > 0) && (
                            <Badge className="text-xs text-sky-700 bg-sky-100 border border-sky-200 h-6">
                              {[
                                coreOpinion.trim() && '通用输入',
                                emotionTone !== '理性客观' && emotionTone,
                                selectedMaterials.length > 0 && `${selectedMaterials.length}素材`,
                              ].filter(Boolean).join('·')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    </div>
                    
                    {/* Tab 标签页导航 */}
                    <div className="flex items-center border-b border-slate-100 bg-slate-50/30">
                      <button
                        type="button"
                        onClick={() => setActiveGuideTab('opinion')}
                        className={`px-6 py-3 text-sm font-medium transition-all relative ${
                          activeGuideTab === 'opinion'
                            ? 'text-sky-600 bg-white'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                        }`}
                      >
                        核心观点
                        {activeGuideTab === 'opinion' && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-sky-500 rounded-t-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveGuideTab('emotion')}
                        className={`px-6 py-3 text-sm font-medium transition-all relative ${
                          activeGuideTab === 'emotion'
                            ? 'text-sky-600 bg-white'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                        }`}
                      >
                        情感基调
                        {activeGuideTab === 'emotion' && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-sky-500 rounded-t-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveGuideTab('material')}
                        className={`px-6 py-3 text-sm font-medium transition-all relative ${
                          activeGuideTab === 'material'
                            ? 'text-sky-600 bg-white'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                        }`}
                      >
                        素材选择
                        {selectedMaterials.length > 0 && (
                          <span className="ml-1 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{selectedMaterials.length}</span>
                        )}
                        {activeGuideTab === 'material' && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-sky-500 rounded-t-full" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveGuideTab('case')}
                        className={`px-6 py-3 text-sm font-medium transition-all relative ${
                          activeGuideTab === 'case'
                            ? 'text-sky-600 bg-white'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
                        }`}
                      >
                        <Briefcase className="w-3.5 h-3.5 inline mr-1" />
                        案例引用
                        {selectedCases.length > 0 && (
                          <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{selectedCases.length}</span>
                        )}
                        {activeGuideTab === 'case' && (
                          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-sky-500 rounded-t-full" />
                        )}
                      </button>
                    </div>
                    
                    {/* Tab 内容区域 */}
                    <div className="p-6 bg-white">
                      {/* 核心观点 Tab */}
                      {activeGuideTab === 'opinion' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">输入你的核心观点</span>
                              <span className="text-xs text-slate-400">insurance-d 会将此作为文章灵魂</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleSuggestOpinions(false)} disabled={loadingSuggestedOpinions || !mainInstruction.trim()} className="h-8 px-3 text-xs text-indigo-500 hover:text-indigo-700">
                              {loadingSuggestedOpinions ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                              AI帮我想
                            </Button>
                          </div>
                          <Textarea
                            value={coreOpinion}
                            onChange={(e) => setCoreOpinion(e.target.value)}
                            placeholder="比如：存款到期别急着买增额寿，先算清楚再决定&#10;可以详细描述你想表达的核心立场、关键论据、目标受众等"
                            className="min-h-[140px] text-sm resize-y leading-relaxed"
                          />
                          {suggestedOpinions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {suggestedOpinions.map((opinion, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setCoreOpinion(opinion)}
                                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                                    coreOpinion === opinion
                                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50'
                                  }`}
                                >
                                  {opinion.length > 25 ? opinion.slice(0, 25) + '...' : opinion}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 情感基调 Tab */}
                      {activeGuideTab === 'emotion' && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-700">选择文章的情感基调</span>
                            <span className="text-xs text-slate-400">影响文章的语气风格</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {EMOTION_TONES.map((tone) => (
                              <button
                                key={tone.value}
                                type="button"
                                onClick={() => setEmotionTone(tone.value)}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                  emotionTone === tone.value
                                    ? 'border-indigo-400 bg-indigo-50'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                                title={tone.desc}
                              >
                                <div className={`text-2xl mb-2 ${emotionTone === tone.value ? 'text-indigo-600' : 'text-slate-400'}`}>
                                  {tone.icon}
                                </div>
                                <div className={`font-medium ${emotionTone === tone.value ? 'text-indigo-700' : 'text-slate-700'}`}>
                                  {tone.label}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  {tone.desc}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* 素材选择 Tab（简化版：搜索+推荐+速记 三合一） */}
                      {activeGuideTab === 'material' && (
                        <div className="space-y-4">
                          {/* 已选素材 Badge（统一展示） */}
                          {selectedMaterials.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-indigo-50/60 rounded-lg border border-indigo-100">
                              {selectedMaterials.map(mat => (
                                <Badge
                                  key={mat.id}
                                  variant="secondary"
                                  className="text-sm bg-white text-indigo-700 border-indigo-200 cursor-pointer hover:bg-indigo-100 gap-1.5 pr-2"
                                  onClick={() => toggleMaterialSelection(mat)}
                                >
                                  {mat.title.length > 12 ? mat.title.slice(0, 12) + '...' : mat.title}
                                  <span className="text-indigo-400 hover:text-red-400 text-sm">×</span>
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* ─── 紧凑搜索条（常驻） ─── */}
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input
                                placeholder={mainInstruction.trim().length >= 4 ? '搜索素材库...' : '输入创作指令后自动推荐素材'}
                                value={materialSearchQuery}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMaterialSearchQuery(val);
                                  // 清空搜索框时清除搜索结果，回到推荐视图
                                  if (!val.trim()) {
                                    setMaterialSearchResults([]);
                                  }
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter' && materialSearchQuery.trim()) handleSearchMaterials(materialSearchQuery); }}
                                className="pl-9 pr-9 text-sm h-9"
                              />
                              {materialSearchQuery.trim() && (
                                <button
                                  type="button"
                                  onClick={() => { setMaterialSearchQuery(''); setMaterialSearchResults([]); }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { if (materialSearchQuery.trim()) handleSearchMaterials(materialSearchQuery); }}
                              disabled={materialSearchLoading || !materialSearchQuery.trim()}
                              className="h-9 px-3 text-sm"
                            >
                              {materialSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                              <span className="ml-1.5">搜索</span>
                            </Button>
                          </div>

                          {/* ─── 统一结果列表 ─── */}
                          <div className="space-y-2">
                            {/* 状态A：正在搜索/推荐 */}
                            {(materialSearchLoading || (loadingRecommendedMaterials && recommendedMaterials.length === 0 && recommendedSnippets.length === 0)) && (
                              <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {materialSearchLoading ? '正在搜索素材库...' : '正在匹配相关素材...'}
                              </div>
                            )}

                            {/* 状态B：有搜索结果 → 优先展示搜索 */}
                            {!materialSearchLoading && filteredSearchMaterials.length > 0 && (
                              <>
                                <div className="text-xs font-medium text-slate-500 px-1">
                                  搜索结果 <span className="text-slate-400 font-normal">({filteredSearchMaterials.length})</span>
                                </div>
                                {filteredSearchMaterials.map((mat) => {
                                  const isSelected = selectedMaterialIds.includes(mat.id);
                                  const typeLabel = MATERIAL_TYPE_LABELS[mat.type] ?? '素材';
                                  return (
                                    <div
                                      key={mat.id}
                                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                                        isSelected
                                          ? 'border-indigo-300 bg-indigo-50'
                                          : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
                                      }`}
                                    >
                                      <Badge variant="outline" className="text-xs px-2 py-0.5 shrink-0 border-slate-300 text-slate-600">
                                        {typeLabel}
                                      </Badge>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{mat.title}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => toggleMaterialSelection(mat)}
                                        className={`shrink-0 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                                          isSelected
                                            ? 'bg-indigo-100 text-indigo-600 border border-indigo-200'
                                            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                                        }`}
                                      >
                                        {isSelected ? '✓ 已添加' : '+ 添加'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </>
                            )}

                            {/* 状态B2：搜索无结果 → 显示互联网搜索按钮 */}
                            {!materialSearchLoading && materialSearchQuery.trim() && filteredSearchMaterials.length === 0 && (
                              <div className="text-center py-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                <p className="text-sm text-slate-400 mb-3">素材库未找到匹配素材</p>
                                <button
                                  type="button"
                                  onClick={() => handleWebSearch(materialSearchQuery)}
                                  disabled={webSearchLoading}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium hover:from-teal-600 hover:to-cyan-600 shadow-sm transition-all disabled:opacity-50"
                                >
                                  {webSearchLoading ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" />{webSearchProgress || '搜索中...'}</>
                                  ) : (
                                    <><Globe className="w-4 h-4" />搜索互联网（权威来源）</>
                                  )}
                                </button>
                              </div>
                            )}

                            {/* 状态C：未搜索但有推荐 → 展示智能推荐（素材+速记合并） */}
                            {!materialSearchLoading && filteredSearchMaterials.length === 0 && !materialSearchQuery.trim() && mainInstruction.trim().length >= 4 && (
                              <>
                                {/* 推荐素材 */}
                                {recommendedMaterials.length > 0 && (
                                  <>
                                    <div className="flex items-center justify-between px-1">
                                      <div className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="text-xs font-medium text-slate-600">智能推荐</span>
                                      </div>
                                      <Button variant="ghost" size="sm" onClick={() => handleRecommendMaterials(false)} disabled={loadingRecommendedMaterials} className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-amber-600">
                                        <RefreshCw className={`w-3 h-3 mr-1 ${loadingRecommendedMaterials ? 'animate-spin' : ''}`} />
                                        刷新
                                      </Button>
                                    </div>
                                    {recommendedMaterials.map((mat) => {
                                      const isSelected = selectedMaterialIds.includes(mat.id);
                                      const matchLevel = mat.matchLevel || 'medium';
                                      const matchLabel = matchLevel === 'high' ? '高度相关' : matchLevel === 'medium' ? '相关' : '可能相关';
                                      const matchDots = matchLevel === 'high' ? 3 : matchLevel === 'medium' ? 2 : 1;
                                      const matchDotColor = matchLevel === 'high'
                                        ? 'bg-emerald-400'
                                        : matchLevel === 'medium'
                                          ? 'bg-blue-400'
                                          : 'bg-slate-300';
                                      const typeLabel = MATERIAL_TYPE_LABELS[mat.type] ?? '素材';
                                      return (
                                        <div
                                          key={mat.id}
                                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                                            isSelected
                                              ? 'border-indigo-300 bg-indigo-50'
                                              : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
                                          }`}
                                        >
                                          <Badge variant="outline" className="text-xs px-2 py-0.5 shrink-0 border-slate-300 text-slate-600">
                                            {typeLabel}
                                          </Badge>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-800 truncate">{mat.title}</p>
                                          </div>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="flex items-center gap-1 shrink-0 cursor-help">
                                                <div className="flex gap-0.5">
                                                  {[1, 2, 3].map((i) => (
                                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= matchDots ? matchDotColor : 'bg-slate-200'}`} />
                                                  ))}
                                                </div>
                                                <span className="text-xs text-slate-400">{matchLabel}</span>
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                              <div className="space-y-0.5">
                                                <p>关键词命中: {mat.keywordHitCount ?? 0} 次</p>
                                                <p>标签命中: {mat.tagHitCount ?? 0} 次</p>
                                                <p>使用次数: {mat.useCount ?? 0}</p>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                          <button
                                            type="button"
                                            onClick={() => toggleMaterialSelection(mat)}
                                            className={`shrink-0 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                                              isSelected
                                                ? 'bg-indigo-100 text-indigo-600 border border-indigo-200'
                                                : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                                            }`}
                                          >
                                            {isSelected ? '✓ 已添加' : '+ 添加'}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </>
                                )}

                                {/* 推荐速记（与素材同一列表，仅一个子标题区分） */}
                                {recommendedSnippets.length > 0 && (
                                  <>
                                    <div className="flex items-center gap-2 pt-1 px-1">
                                      <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                                      <span className="text-xs font-medium text-slate-600">相关速记</span>
                                    </div>
                                    {recommendedSnippets.map((snippet) => {
                                      const isSnippetSelected = snippet.materialId ? selectedMaterialIds.includes(snippet.materialId) : false;
                                      return (
                                        <div
                                          key={snippet.id}
                                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                                            isSnippetSelected
                                              ? 'border-indigo-300 bg-indigo-50'
                                              : 'border-slate-200 bg-sky-50/30 hover:border-sky-300'
                                          }`}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-700 truncate">{snippet.title}</p>
                                            {snippet.summary && (
                                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{snippet.summary}</p>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const snippetObj = snippetList.find((s: InfoSnippet) => s.id === snippet.id);
                                              if (snippetObj) handleSelectSnippetInMaterialTab(snippetObj);
                                            }}
                                            className={`shrink-0 text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                                              isSnippetSelected
                                                ? 'bg-indigo-100 text-indigo-600 border border-indigo-200'
                                                : 'bg-sky-500 text-white hover:bg-sky-600 shadow-sm'
                                            }`}
                                          >
                                            {isSnippetSelected ? '✓ 已添加' : (snippet.materialId ? '+ 选择' : '入库并选择')}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </>
                                )}

                                {/* 推荐无结果 → 显示互联网搜索按钮 */}
                                {autoRecommendFetched && recommendedMaterials.length === 0 && recommendedSnippets.length === 0 && (
                                  <div className="text-center py-6 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                    <p className="text-sm text-slate-400 mb-3">暂无匹配素材</p>
                                    <button
                                      type="button"
                                      onClick={() => handleWebSearch()}
                                      disabled={webSearchLoading}
                                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium hover:from-teal-600 hover:to-cyan-600 shadow-sm transition-all disabled:opacity-50"
                                    >
                                      {webSearchLoading ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" />{webSearchProgress || '搜索中...'}</>
                                      ) : (
                                        <><Globe className="w-4 h-4" />搜索互联网（权威来源）</>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </>
                            )}

                            {/* 状态D：无指令也无搜索 → 空态提示 */}
                            {mainInstruction.trim().length < 4 && !materialSearchQuery.trim() && (
                              <div className="text-center py-8 text-sm text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                输入创作指令后将自动推荐相关素材<br />
                                <span className="text-xs text-slate-300">或直接在上方搜索素材库</span>
                              </div>
                            )}
                          </div>

                          {/* ─── 互联网搜索结果 ─── */}
                          {(webSearchResults.length > 0 || webSearchLoading) && (
                            <div className="space-y-2 pt-2">
                              <div className="flex items-center gap-2 px-1">
                                <Globe className="w-3.5 h-3.5 text-teal-500" />
                                <span className="text-xs font-medium text-slate-600">互联网搜索</span>
                                {webSearchLoading && (
                                  <span className="text-xs text-teal-500">{webSearchProgress}</span>
                                )}
                              </div>

                              {webSearchLoading && webSearchResults.length === 0 && (
                                <div className="flex items-center gap-2 py-4 justify-center text-sm text-slate-400">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {webSearchProgress || '正在搜索权威站点...'}
                                </div>
                              )}

                              {webSearchResults.map((item: WebSearchResultItem) => (
                                <div
                                  key={item.id}
                                  className="px-3 py-2.5 rounded-lg border border-teal-200 bg-teal-50/30 hover:border-teal-300 transition-all"
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 shrink-0">
                                          {item.siteName}
                                        </span>
                                      </div>
                                      {item.summarizedContent ? (
                                        <p className="text-xs text-slate-600 line-clamp-3">{item.summarizedContent}</p>
                                      ) : (
                                        <p className="text-xs text-slate-500 line-clamp-2">{item.snippet}</p>
                                      )}
                                      {item.materialFormat?.topicTags?.length > 0 && (
                                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                          {item.materialFormat.topicTags.slice(0, 4).map((tag: string) => (
                                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{tag}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-teal-100">
                                    {item.materialFormat && (
                                      <button
                                        type="button"
                                        onClick={() => handleSaveWebResultToMaterial(item.materialFormat)}
                                        className="text-xs px-3 py-1 rounded-md bg-teal-500 text-white hover:bg-teal-600 font-medium transition-all"
                                      >
                                        存入素材库
                                      </button>
                                    )}
                                    {item.url && (
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-slate-400 hover:text-teal-600 transition-colors"
                                      >
                                        查看原文
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {webSearchSummary && (
                                <div className="px-3 py-2 rounded-lg bg-amber-50/50 border border-amber-200">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Sparkles className="w-3 h-3 text-amber-500" />
                                    <span className="text-xs font-medium text-amber-700">AI 综合概括</span>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed">{webSearchSummary}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ─── 可折叠速记浏览区（默认收起） ─── */}
                          {!materialSearchQuery.trim() && snippetList.length > 0 && (
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById('snippet-collapse-content');
                                  if (el) el.classList.toggle('hidden');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-sky-500" />
                                  <span className="font-medium">全部速记</span>
                                  <span className="text-slate-400">({snippetList.length})</span>
                                </div>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <div id="snippet-collapse-content" className="hidden max-h-48 overflow-y-auto border-t border-slate-100">
                                {snippetList.map((snippet) => {
                                  const isSnippetSelected = snippet.materialId ? selectedMaterialIds.includes(snippet.materialId) : false;
                                  const cats = snippet.categories || [];
                                  return (
                                    <div
                                      key={snippet.id}
                                      className={`flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${
                                        isSnippetSelected ? 'bg-indigo-50/50' : ''
                                      }`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-slate-700 truncate">{snippet.title || '无标题'}</p>
                                        <div className="flex items-center gap-1 mt-0.5">
                                          {cats.slice(0, 2).map((cat) => (
                                            <span key={cat} className="text-[10px] px-1 py-0.5 rounded bg-sky-50 text-sky-600">
                                              {SNIPPET_CATEGORY_LABELS[cat] || cat}
                                            </span>
                                          ))}
                                          {snippet.complianceLevel && (
                                            <span className={`text-[10px] px-1 py-0.5 rounded ${
                                              snippet.complianceLevel === 'A' ? 'bg-emerald-50 text-emerald-600' :
                                              snippet.complianceLevel === 'B' ? 'bg-amber-50 text-amber-600' :
                                              'bg-red-50 text-red-600'
                                            }`}>
                                              {snippet.complianceLevel}级
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleSelectSnippetInMaterialTab(snippet)}
                                        className={`shrink-0 text-xs px-2 py-1 rounded font-medium transition-all ${
                                          isSnippetSelected
                                            ? 'bg-indigo-100 text-indigo-600 border border-indigo-200'
                                            : 'text-sky-600 hover:bg-sky-50 border border-transparent hover:border-sky-200'
                                        }`}
                                      >
                                        {isSnippetSelected ? '✓' : (snippet.materialId ? '+选择' : '入库+选')}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ─── 底部快捷入口 ─── */}
                          <div className="flex items-center pt-1">
                            <Link href="/materials" className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                              <ExternalLink className="w-3 h-3" />
                              管理素材库
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* 案例引用 Tab */}
                      {activeGuideTab === 'case' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">选择行业案例</span>
                              <span className="text-xs text-slate-400">增强文章说服力和真实感</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleRecommendCases(false)} disabled={loadingRecommendedCases || !mainInstruction.trim()} className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700">
                              {loadingRecommendedCases ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                              推荐案例
                            </Button>
                          </div>

                          {!mainInstruction.trim() && (
                            <div className="text-center py-6 text-sm text-slate-400">
                              请先输入任务指令，系统将根据指令推荐最相关的案例
                            </div>
                          )}

                          {/* 已选案例 Badge */}
                          {selectedCases.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-emerald-50 rounded-lg">
                              {selectedCases.map(c => (
                                <Badge
                                  key={c.id}
                                  variant="secondary"
                                  className="text-sm bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-200 gap-1.5 pr-2"
                                  onClick={() => toggleCaseSelection(c)}
                                >
                                  {c.title.length > 15 ? c.title.slice(0, 15) + '...' : c.title}
                                  <span className="text-emerald-400 hover:text-red-400 text-sm">×</span>
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* 推荐案例列表 */}
                          {recommendedCases.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                根据指令推荐的最相关案例（点击查看详情或选择）
                              </div>
                              {recommendedCases.map((c) => {
                                const isSelected = selectedCaseIds.includes(c.id);
                                return (
                                  <div
                                    key={c.id}
                                    className={`relative px-4 py-3 rounded-xl border-2 transition-all ${
                                      isSelected
                                        ? 'border-emerald-400 bg-emerald-50'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div 
                                        className="flex-1 min-w-0 cursor-pointer"
                                        onClick={() => setViewingCase(c)}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className={`font-medium text-sm ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                                            {c.title}
                                          </span>
                                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                                          {c.protagonist && <span>{c.protagonist} | </span>}
                                          {c.background}
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                          {c.productTags.slice(0, 3).map(tag => (
                                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{tag}</span>
                                          ))}
                                          {c.crowdTags.slice(0, 2).map(tag => (
                                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{tag}</span>
                                          ))}
                                        </div>
                                      </div>
                                      {/* 操作按钮 */}
                                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setViewingCase(c)}
                                          className="text-[10px] px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                                        >
                                          详情
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleCaseSelection(c)}
                                          className={`text-[10px] px-2 py-1 rounded transition-colors ${
                                            isSelected
                                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                              : 'bg-emerald-500 text-white hover:bg-emerald-600'
                                          }`}
                                        >
                                          {isSelected ? '已选' : '选择'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 无推荐结果 */}
                          {mainInstruction.trim() && !loadingRecommendedCases && recommendedCases.length === 0 && (
                            <div className="text-center py-8 text-sm text-slate-400">
                              {hasSearchedCases
                                ? '未找到与指令相关的案例，当前案例库覆盖的险种：意外险、医疗险、重疾险、财产险、雇主责任险'
                                : '点击上方「推荐案例」按钮，获取与指令相关的行业案例'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                  )}

                  {/* ⑤ 平台专属配置 - 选了账号后展示各平台的差异化配置项（排除已有专属卡片的平台） */}
                  {selectedAccountIds.length > 0 && (() => {
                    // 获取已选账号中需要展示专属配置的平台（排除小红书和公众号，它们已有专属卡片）
                    const selectedPlatforms = selectedAccountIds.map(aId => {
                      const ac = accountConfigs.find(a => a.account.id === aId);
                      return ac ? { accountId: aId, account: ac.account, template: ac.template } : null;
                    }).filter(Boolean) as Array<{ accountId: string; account: { id: string; platform: string; platformLabel: string | null; accountName: string; platformConfig?: any }; template: { id: string; name: string; ruleCount: number } | null }>;
                    
                    // 排除已有专属配置卡片的平台
                    const platformsNeedingConfig = selectedPlatforms.filter(({ account }) => 
                      !['xiaohongshu', 'wechat_official'].includes(account.platform)
                    );

                    // 如果没有需要展示的平台，不渲染
                    if (platformsNeedingConfig.length === 0) return null;

                    // 只展示有专属配置字段的平台
                    const platformIcon: Record<string, string> = {
                      xiaohongshu: '📕', wechat_official: '📗',
                      zhihu: '📘', douyin: '🎵', weibo: '📣',
                    };

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <Settings className="w-4 h-4" />
                          <span>其他平台专属配置</span>
                          <span className="text-xs text-slate-400 font-normal">知乎/抖音/微博差异化设置</span>
                        </div>
                        {platformsNeedingConfig.map(({ accountId, account }) => {
                          const fields = PLATFORM_CONFIG_FIELDS[account.platform as keyof typeof PLATFORM_CONFIG_FIELDS];
                          if (!fields || fields.length === 0) return null;

                          // 读取当前账号的 platformConfig
                          const currentConfig = (account.platformConfig as Record<string, any>)?.[account.platform] || {};

                          return (
                            <Card key={accountId} className="border border-violet-200 bg-violet-50/20 hover:shadow-md">
                              <Collapsible>
                                <CollapsibleTrigger asChild>
                                  <CardHeader className="pb-2 cursor-pointer hover:bg-violet-50/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-lg">{platformIcon[account.platform] || '📱'}</span>
                                        <CardTitle className="text-sm font-semibold text-violet-800">
                                          {account.platformLabel || account.platform}
                                        </CardTitle>
                                        <Badge variant="outline" className="text-xs text-violet-600 border-violet-300">
                                          {account.accountName}
                                        </Badge>
                                      </div>
                                      <ChevronDown className="w-4 h-4 text-violet-400 transition-transform" />
                                    </div>
                                  </CardHeader>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <CardContent className="space-y-3 pt-0">
                                    {fields.map(field => (
                                      <div key={field.key} className="space-y-1">
                                        <label className="text-xs font-medium text-slate-700">{field.label}</label>
                                        {field.description && (
                                          <p className="text-[10px] text-slate-400">{field.description}</p>
                                        )}
                                        {field.type === 'select' && field.options && (
                                          <div className="flex flex-wrap gap-1.5">
                                            {field.options.map(opt => (
                                              <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                  // 更新 platformConfig
                                                  const newConfig = { ...account.platformConfig };
                                                  if (!newConfig[account.platform]) newConfig[account.platform] = {};
                                                  newConfig[account.platform][field.key] = opt.value;
                                                  // 同步更新 accountConfigs 状态
                                                  setAccountConfigs(prev => prev.map(ac =>
                                                    ac.account.id === accountId
                                                      ? { ...ac, account: { ...ac.account, platformConfig: newConfig } }
                                                      : ac
                                                  ));
                                                  // 保存到后端
                                                  savePlatformConfig(accountId, newConfig);
                                                }}
                                                className={`px-2.5 py-1.5 rounded-md border text-xs transition-all ${
                                                  currentConfig[field.key] === opt.value
                                                    ? 'border-violet-400 bg-violet-100 text-violet-700 font-medium'
                                                    : 'border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50/50'
                                                }`}
                                              >
                                                {opt.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        {field.type === 'text' && (
                                          <Input
                                            value={currentConfig[field.key] || ''}
                                            onChange={(e) => {
                                              const newConfig = { ...account.platformConfig };
                                              if (!newConfig[account.platform]) newConfig[account.platform] = {};
                                              newConfig[account.platform][field.key] = e.target.value;
                                              setAccountConfigs(prev => prev.map(ac =>
                                                ac.account.id === accountId
                                                  ? { ...ac, account: { ...ac.account, platformConfig: newConfig } }
                                                  : ac
                                              ));
                                            }}
                                            onBlur={() => savePlatformConfig(accountId, account.platformConfig)}
                                            placeholder={field.placeholder || ''}
                                            className="text-xs h-8"
                                          />
                                        )}
                                        {field.type === 'textarea' && (
                                          <Textarea
                                            value={currentConfig[field.key] || ''}
                                            onChange={(e) => {
                                              const newConfig = { ...account.platformConfig };
                                              if (!newConfig[account.platform]) newConfig[account.platform] = {};
                                              newConfig[account.platform][field.key] = e.target.value;
                                              setAccountConfigs(prev => prev.map(ac =>
                                                ac.account.id === accountId
                                                  ? { ...ac, account: { ...ac.account, platformConfig: newConfig } }
                                                  : ac
                                              ));
                                            }}
                                            onBlur={() => savePlatformConfig(accountId, account.platformConfig)}
                                            placeholder={field.placeholder || ''}
                                            rows={2}
                                            className="text-xs resize-none"
                                          />
                                        )}
                                        {field.type === 'tags' && (
                                          <div className="space-y-1.5">
                                            <div className="flex flex-wrap gap-1">
                                              {((currentConfig[field.key] as string[]) || []).map((tag: string, idx: number) => (
                                                <Badge
                                                  key={idx}
                                                  variant="secondary"
                                                  className="text-xs bg-violet-50 text-violet-700 border-violet-200 cursor-pointer hover:bg-violet-100 gap-1 pr-1"
                                                  onClick={() => {
                                                    const newConfig = { ...account.platformConfig };
                                                    const tags = [...((newConfig[account.platform]?.[field.key] as string[]) || [])];
                                                    tags.splice(idx, 1);
                                                    if (!newConfig[account.platform]) newConfig[account.platform] = {};
                                                    newConfig[account.platform][field.key] = tags;
                                                    setAccountConfigs(prev => prev.map(ac =>
                                                      ac.account.id === accountId
                                                        ? { ...ac, account: { ...ac.account, platformConfig: newConfig } }
                                                        : ac
                                                    ));
                                                    savePlatformConfig(accountId, newConfig);
                                                  }}
                                                >
                                                  #{tag} <span className="text-violet-400 hover:text-red-400">×</span>
                                                </Badge>
                                              ))}
                                            </div>
                                            <div className="flex gap-1">
                                              <Input
                                                placeholder={field.placeholder || '输入标签后回车添加'}
                                                className="text-xs h-7 flex-1"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const value = (e.target as HTMLInputElement).value.trim();
                                                    if (!value) return;
                                                    const newConfig = { ...account.platformConfig };
                                                    if (!newConfig[account.platform]) newConfig[account.platform] = {};
                                                    const tags = [...((newConfig[account.platform][field.key] as string[]) || []), value];
                                                    newConfig[account.platform][field.key] = tags;
                                                    setAccountConfigs(prev => prev.map(ac =>
                                                      ac.account.id === accountId
                                                        ? { ...ac, account: { ...ac.account, platformConfig: newConfig } }
                                                        : ac
                                                    ));
                                                    savePlatformConfig(accountId, newConfig);
                                                    (e.target as HTMLInputElement).value = '';
                                                  }
                                                }}
                                              />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </CardContent>
                                </CollapsibleContent>
                              </Collapsible>
                            </Card>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* 子任务列表 - 仅选了账号后按平台分组展示（横向流程图模式） */}
          {platformSubTaskGroups.length > 0 && (
            <div className="space-y-6">
              {platformSubTaskGroups.map((group, groupIdx) => {
                const validTasks = group.subTasks.filter(t => t.title.trim());
                const selectedTask = selectedNodeId
                  ? group.subTasks.find(t => t.id === selectedNodeId)
                  : null;
                const selectedIndex = selectedTask
                  ? validTasks.findIndex(t => t.id === selectedNodeId)
                  : -1;
                const isCurrentGroup = selectedGroupAccountId === group.accountId;

                // 🔥 两阶段架构：P2-7 修复：使用 phase 字段判断，不依赖数组索引
                // group.phase 由账号配置决定，比 groupIdx 更可靠
                const isBaseArticleGroup = group.phase === 'base_article';
                const isAdaptationGroup = platformSubTaskGroups.length > 1 && !isBaseArticleGroup;

                return (
                  <div key={group.accountId} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* 🔥 两阶段架构：阶段标识 */}
                    {isBaseArticleGroup && platformSubTaskGroups.length > 1 && (
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
                          <Layers className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-indigo-700">阶段1：基础文章</span>
                        <span className="text-xs text-indigo-500">定稿后自动适配到其他平台</span>
                      </div>
                    )}
                    {isAdaptationGroup && groupIdx === (platformSubTaskGroups[0]?.platform === 'wechat_official' ? 1 : 0) && (
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
                          <Lock className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-amber-700">阶段2：平台适配</span>
                        <span className="text-xs text-amber-500">基于基础文章改写，等待定稿后执行</span>
                      </div>
                    )}

                    {/* 横向流程图 */}
                    <HorizontalFlowDiagram
                      subTasks={group.subTasks}
                      platformLabel={group.platformLabel}
                      platform={group.platform}
                      accountName={group.accountName}
                      selectedNodeId={isCurrentGroup ? selectedNodeId : null}
                      onNodeSelect={(taskId) => {
                        setSelectedNodeId(taskId);
                        setSelectedGroupAccountId(group.accountId);
                      }}
                      onAdd={() => addPlatformSubTask(group.accountId)}
                    />
                    
                    {/* 节点详情面板（选中节点时展示） */}
                    {isCurrentGroup && selectedTask && (
                      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <NodeDetailPanel
                          task={selectedTask}
                          nodeIndex={selectedIndex >= 0 ? selectedIndex : 0}
                          totalNodes={validTasks.length}
                          platformLabel={group.platformLabel}
                          agents={AVAILABLE_AGENTS}
                          hasGlobalCreationGuide={hasGlobalCreationGuide}
                          onUpdateTask={(taskId, field, value) =>
                            updatePlatformSubTask(group.accountId, taskId, field, value)
                          }
                          onMoveUp={(taskId) => movePlatformSubTaskUp(group.accountId, taskId)}
                          onMoveDown={(taskId) => movePlatformSubTaskDown(group.accountId, taskId)}
                          onDelete={(taskId) => {
                            removePlatformSubTask(group.accountId, taskId);
                            // 删除后清空选中状态
                            setSelectedNodeId(null);
                            setSelectedGroupAccountId(null);
                          }}
                          onClose={() => {
                            setSelectedNodeId(null);
                            setSelectedGroupAccountId(null);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 提交按钮 */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            {/* 🔴 新增：重置按钮（安全机制） */}
            {(submitLockRef.current || isSubmitting) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetSubmitLock}
                      className="text-gray-600 border-gray-300"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重置
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>如果提交按钮卡住了，点击这里重置</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSubmit}
                    disabled={(() => {
                      const disabled = isSubmitting || submitLockRef.current || !taskTitle.trim() || !executionDate || platformSubTaskGroups.length === 0;
                      if (!(window as any)._submitDisabledLogged) {
                        (window as any)._submitDisabledLogged = true;
                        console.log('========== 按钮禁用状态 ==========');
                        console.log('isSubmitting:', isSubmitting);
                        console.log('submitLockRef.current:', submitLockRef.current);
                        console.log('!taskTitle.trim():', !taskTitle.trim(), '| taskTitle:', JSON.stringify(taskTitle));
                        console.log('!executionDate:', !executionDate, '| executionDate:', executionDate);
                        console.log('platformSubTaskGroups.length === 0:', platformSubTaskGroups.length === 0, '| length:', platformSubTaskGroups.length);
                        console.log('最终 disabled:', disabled);
                        console.log('========== 按钮禁用状态结束 ==========');
                      }
                      return disabled;
                    })()}
                    className="w-full md:w-auto"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        确认创建子任务
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                {getSubmitDisabledReason() && (
                  <TooltipContent>
                    <p>{getSubmitDisabledReason()}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* 任务列表面板（浮窗） */}
      {showTaskListPanel && (
        <div className="fixed top-4 right-4 z-50 w-[702px] max-h-[80vh] overflow-y-auto">
          <Card>
            <CardHeader className="sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  <ListTodo className="w-6 h-6 mr-2 inline" />
                  任务列表
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTaskListPanel(false)}
                  className="h-10 w-10 p-0"
                >
                  <XCircle className="w-6 h-6" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* 显示 Agent B 的任务列表 */}
              <AgentTaskListNormal 
                agentId="B" 
                showPanel={true} 
                onTogglePanel={() => {}} 
              />
            </CardContent>
          </Card>
        </div>
      )}



      {/* 重复任务确认弹框 */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              发现相似任务
            </DialogTitle>
            <DialogDescription>
              检测到在过去 5 分钟内，已经创建过类似的任务：
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">任务标题：</span>
                  <span className="text-gray-900">{taskTitle}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">执行日期：</span>
                  <span className="text-gray-900">{executionDate}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">主要执行者：</span>
                  <span className="text-gray-900">{subTasks[0]?.executor || '未知'}</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              您确定要再次创建吗？这可能会产生重复的任务。
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleDuplicateCancel}>
              取消
            </Button>
            <Button 
              onClick={handleDuplicateConfirm}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              确认创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认创建子任务弹框 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              确认创建子任务
            </DialogTitle>
            <DialogDescription>
              请确认以下信息无误后，点击"确认创建"按钮：
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* 子任务列表 */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 text-base">📝 子任务列表 ({subTasks.filter(t => t.title.trim()).length} 个)</h4>
              {subTasks.filter(t => t.title.trim()).map((subTask, index) => (
                <div key={subTask.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 text-blue-700 rounded-full w-7 h-7 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{subTask.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {AVAILABLE_AGENTS.find(a => a.id === subTask.executor)?.name || subTask.executor}
                        </Badge>
                      </div>
                      {subTask.description && (
                        <p className="text-sm text-gray-600">{subTask.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCreate}>
              取消
            </Button>
            <Button 
              onClick={handleConfirmCreate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              确认创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 案例详情弹窗 */}
      <Dialog open={!!viewingCase} onOpenChange={(open) => !open && setViewingCase(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 pr-8">
              {viewingCase?.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              查看案例完整详情
            </DialogDescription>
          </DialogHeader>
          
          {viewingCase && (
            <div className="space-y-4 py-2">
              {/* 人物/主体 */}
              {viewingCase.protagonist && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-500" />
                    人物/主体
                  </h4>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 leading-relaxed">
                    {viewingCase.protagonist}
                  </p>
                </div>
              )}
              
              {/* 核心背景 */}
              {viewingCase.background && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-500" />
                    核心背景
                  </h4>
                  <p className="text-sm text-slate-600 bg-amber-50/50 rounded-lg p-3 leading-relaxed">
                    {viewingCase.background}
                  </p>
                </div>
              )}
              
              {/* 保险方案 */}
              {viewingCase.insuranceAction && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-500" />
                    保险方案
                  </h4>
                  <p className="text-sm text-slate-600 bg-emerald-50/50 rounded-lg p-3 leading-relaxed">
                    {viewingCase.insuranceAction}
                  </p>
                </div>
              )}
              
              {/* 结果详情 */}
              {viewingCase.result && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-500" />
                    结果详情
                  </h4>
                  <p className="text-sm text-slate-600 bg-purple-50/50 rounded-lg p-3 leading-relaxed">
                    {viewingCase.result}
                  </p>
                </div>
              )}
              
              {/* 标签 */}
              <div className="flex flex-wrap gap-2 pt-2">
                {viewingCase.applicableProducts.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-slate-400">适用产品:</span>
                    {viewingCase.applicableProducts.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">{tag}</span>
                    ))}
                  </div>
                )}
                {viewingCase.applicableScenarios.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-slate-400">适用场景:</span>
                    {viewingCase.applicableScenarios.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{tag}</span>
                    ))}
                  </div>
                )}
                {viewingCase.productTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-slate-400">产品标签:</span>
                    {viewingCase.productTags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{tag}</span>
                    ))}
                  </div>
                )}
                {viewingCase.crowdTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-slate-400">人群标签:</span>
                    {viewingCase.crowdTags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{tag}</span>
                    ))}
                  </div>
                )}
                {viewingCase.sceneTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-slate-400">场景标签:</span>
                    {viewingCase.sceneTags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">{tag}</span>
                    ))}
                  </div>
                )}
                {viewingCase.emotionTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-slate-400">情绪标签:</span>
                    {viewingCase.emotionTags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setViewingCase(null)}
              className="flex-1"
            >
              关闭
            </Button>
            <Button
              onClick={() => {
                if (viewingCase) {
                  toggleCaseSelection(viewingCase);
                  setViewingCase(null);
                }
              }}
              className={`flex-1 ${selectedCaseIds.includes(viewingCase?.id || '') ? 'bg-slate-500 hover:bg-slate-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
            >
              {viewingCase && selectedCaseIds.includes(viewingCase.id) ? '取消选择' : '选择此案例'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>
                <ListTodo className="w-5 h-5 mr-2 inline" />
                任务列表
              </CardTitle>
              <CardDescription>
                查看和管理当前 Agent 的任务
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* 显示 Agent B 的任务列表 */}
              <AgentTaskListNormal
                agentId="B"
                showPanel={true}
                onTogglePanel={() => {}}
              />
            </CardContent>
          </Card>

        </TabsContent>



        {/* 对比草稿与终稿 Tab - 只有超级管理员可见 */}
        {isSuperAdmin && (
          <TabsContent value="article-compare">
            <Card>
              <CardHeader>
                <CardTitle>
                  <GitCompare className="w-5 h-5 mr-2 inline" />
                  对比草稿与终稿
                </CardTitle>
                <CardDescription>
                  查看文章不同版本之间的差异对比
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-3 text-base">📋 功能说明</h4>
                  <ul className="text-sm text-purple-800 space-y-2">
                    <li>• 选择任务的 commandResultId 加载文章历史版本</li>
                    <li>• 对比不同版本之间的文本差异</li>
                    <li>• 查看草稿与终稿的修改内容</li>
                    <li>• 红色表示删除，绿色表示新增</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">选择任务 (commandResultId)</label>
                    <div className="flex gap-2">
                      <Input
                        value={selectedCommandResultId}
                        onChange={(e) => setSelectedCommandResultId(e.target.value)}
                        placeholder="输入 commandResultId"
                        className="flex-1"
                      />
                      <Button
                        onClick={() => loadArticleVersions(selectedCommandResultId)}
                        disabled={!selectedCommandResultId || loadingVersions}
                      >
                        {loadingVersions ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            加载中...
                          </>
                        ) : (
                          '加载版本'
                        )}
                      </Button>
                    </div>
                  </div>

                  {articleVersions.length === 0 && !loadingVersions && (
                    <div className="text-center py-8 text-gray-500">
                      请输入 commandResultId 并点击"加载版本"
                    </div>
                  )}

                  {articleVersions.length > 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">版本 1</label>
                          <Select value={selectedVersion1} onValueChange={setSelectedVersion1}>
                            <SelectTrigger>
                              <SelectValue placeholder="选择版本" />
                            </SelectTrigger>
                            <SelectContent>
                              {articleVersions.map((version, index) => {
                                const val = version.timestamp?.toString() || `v1-${index}`;
                                return (
                                <SelectItem key={val} value={val}>
                                  {version.title || `版本 ${index + 1}`}
                                  {version.timestamp && (
                                    <span className="text-gray-500 ml-2">
                                      {new Date(version.timestamp).toLocaleString()}
                                    </span>
                                  )}
                                </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">版本 2</label>
                          <Select value={selectedVersion2} onValueChange={setSelectedVersion2}>
                            <SelectTrigger>
                              <SelectValue placeholder="选择版本" />
                            </SelectTrigger>
                            <SelectContent>
                              {articleVersions.map((version, index) => {
                                const val = version.timestamp?.toString() || `v2-${index}`;
                                return (
                              <SelectItem key={val} value={val}>
                                {version.title || `版本 ${index + 1}`}
                                {version.timestamp && (
                                  <span className="text-gray-500 ml-2">
                                    {new Date(version.timestamp).toLocaleString()}
                                  </span>
                                )}
                              </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {selectedVersion1 && selectedVersion2 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-4">差异对比</h3>
                        {(() => {
                          const v1 = articleVersions.find((v: any) => v.timestamp?.toString() === selectedVersion1);
                          const v2 = articleVersions.find((v: any) => v.timestamp?.toString() === selectedVersion2);
                          if (v1 && v2) {
                            return renderTextDiff(v1.content, v2.content);
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* 内容导出 Tab */}
        <TabsContent value="content-export" className="space-y-4">
          <ContentExportTab />
        </TabsContent>
      </Tabs>

      {/* 🔥 提醒中心浮动按钮 - 对话框打开时隐藏 */}
      {!showCreateReminderDialog && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowReminderDrawer(true)}
                className="fixed bottom-6 right-24 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
              >
                <Bell className="h-6 w-6 group-hover:animate-bounce" />
                {/* 逾期提醒红点 */}
                {reminderStats && reminderStats.total.overdue > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-pulse">
                    {reminderStats.total.overdue}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="font-medium">提醒中心 · 谁要求谁做什么</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* 🔥 信息速记浮动按钮 - 对话框打开时隐藏 */}
      {!showCreateReminderDialog && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowSnippetDrawer(true)}
                className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-sky-200 hover:shadow-xl hover:shadow-sky-300 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
              >
                <BookmarkPlus className="h-6 w-6 group-hover:rotate-12 transition-transform" />
                {/* 脉冲提示动画 */}
                <span className="absolute inset-0 rounded-full bg-sky-400 animate-ping opacity-30"></span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="font-medium">信息速记 · 随时记录行业资讯</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* 🔥 提醒中心抽屉 */}
      {showReminderDrawer && (
        <div className="fixed inset-0 z-[60]">
          {/* 遮罩层 */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowReminderDrawer(false)}
          />
          
          {/* 抽屉主体 */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-amber-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">提醒中心</h2>
                  <p className="text-xs text-slate-500">谁要求谁做什么 · 双视角时间管理</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowCreateReminderDialog(true)}
                  className="h-8 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  创建提醒
                </Button>
                <button 
                  onClick={() => setShowReminderDrawer(false)}
                  className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* 统计卡片 */}
            {reminderStats && (
              <div className="grid grid-cols-2 gap-3 p-4">
                {/* 出向统计：我要求别人 */}
                <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/50">
                  <div className="text-sm font-medium flex items-center gap-2 text-blue-700 mb-2">
                    <ArrowRight className="w-4 h-4" />
                    我要求别人
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold">{reminderStats.outbound.pending}</div>
                      <div className="text-xs text-slate-500">待完成</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-500">{reminderStats.outbound.overdue}</div>
                      <div className="text-xs text-slate-500">逾期</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-500">{reminderStats.outbound.completed}</div>
                      <div className="text-xs text-slate-500">已完成</div>
                    </div>
                  </div>
                </div>
                {/* 入向统计：别人要求我 */}
                <div className="border border-orange-100 rounded-lg p-3 bg-orange-50/50">
                  <div className="text-sm font-medium flex items-center gap-2 text-orange-700 mb-2">
                    <ArrowLeft className="w-4 h-4" />
                    别人要求我
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold">{reminderStats.inbound.pending}</div>
                      <div className="text-xs text-slate-500">待完成</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-red-500">{reminderStats.inbound.overdue}</div>
                      <div className="text-xs text-slate-500">逾期</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-500">{reminderStats.inbound.completed}</div>
                      <div className="text-xs text-slate-500">已完成</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 方向切换 + 搜索 */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setReminderDirection('all')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    reminderDirection === 'all'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  全部
                </button>
                <button
                  onClick={() => setReminderDirection('outbound')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    reminderDirection === 'outbound'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  我要求别人
                </button>
                <button
                  onClick={() => setReminderDirection('inbound')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    reminderDirection === 'inbound'
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  别人要求我
                </button>
              </div>
              <Input
                placeholder="搜索提醒..."
                value={reminderSearchQuery}
                onChange={(e) => setReminderSearchQuery(e.target.value)}
                className="h-8 flex-1 text-sm"
              />
            </div>

            {/* 提醒列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {reminderGroups.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="mx-auto h-12 w-12 text-slate-200 mb-3" />
                  <p className="text-sm text-slate-400">
                    {reminderDirection === 'all' ? '暂无提醒事项' : 
                     reminderDirection === 'outbound' ? '暂无你要求别人的事项' : '暂无别人要求你的事项'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reminderGroups.map((group) => (
                    <div key={group.key} className={`rounded-lg border ${group.isOverdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                        {group.isOverdue ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Calendar className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-sm font-medium">{group.label}</span>
                        <Badge variant="secondary" className="text-xs">{group.reminders.length}</Badge>
                      </div>
                      <div className="p-2 space-y-2">
                        {group.reminders.map((reminder) => (
                          <div key={reminder.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-slate-100 hover:border-slate-200">
                            {/* 人名 */}
                            <div className="flex items-center gap-2 shrink-0">
                              {reminderDirection === 'outbound' ? (
                                <>
                                  {renderPersonAvatar(reminder.assigneeName)}
                                  <span className="text-sm font-medium text-blue-700">{reminder.assigneeName}</span>
                                </>
                              ) : (
                                <>
                                  {renderPersonAvatar(reminder.requesterName)}
                                  <span className="text-sm font-medium text-orange-700">{reminder.requesterName}</span>
                                </>
                              )}
                            </div>
                            {/* 内容 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {reminderDirection === 'outbound' ? (
                                  <ArrowRight className="w-4 h-4 text-blue-400" />
                                ) : (
                                  <ArrowLeft className="w-4 h-4 text-orange-400" />
                                )}
                                <span className="font-medium truncate">{reminder.content}</span>
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {formatReminderTime(reminder.remindAt)}
                              </div>
                            </div>
                            {/* 操作 */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleCompleteReminder(reminder.id)}>
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleDeleteReminder(reminder.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 创建提醒对话框 */}
      <Dialog open={showCreateReminderDialog} onOpenChange={setShowCreateReminderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              创建新提醒
            </DialogTitle>
            <DialogDescription>
              设置"谁要求谁做什么"，系统会按时提醒
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 模式切换 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReminderInputMode('smart')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  reminderInputMode === 'smart'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                智能解析
              </button>
              <button
                type="button"
                onClick={() => setReminderInputMode('manual')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                  reminderInputMode === 'manual'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <PenTool className="h-4 w-4" />
                手动填写
              </button>
            </div>

            {/* 智能解析模式 */}
            {reminderInputMode === 'smart' ? (
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-purple-700">自然语言输入</span>
                  </div>
                  <p className="text-xs text-purple-600 mb-3">
                    例如：张总让我明天下午3点把方案发给他
                  </p>
                  <Textarea
                    placeholder="输入提醒内容，AI 会自动解析..."
                    value={smartInputText}
                    onChange={(e) => setSmartInputText(e.target.value)}
                    rows={3}
                    className="resize-none bg-white border-purple-200 focus:border-purple-400"
                  />
                </div>
                <Button
                  onClick={handleSmartParseReminder}
                  disabled={parsingReminder || !smartInputText.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {parsingReminder ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />解析中...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" />AI 解析</>
                  )}
                </Button>
              </div>
            ) : (
              /* 手动填写模式 */
              <>
                {/* 方向选择 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">提醒类型</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewReminderForm(prev => ({ ...prev, direction: 'outbound' }))}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                        newReminderForm.direction === 'outbound'
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <ArrowRight className="h-4 w-4" />
                      我要求别人
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewReminderForm(prev => ({ ...prev, direction: 'inbound' }))}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                        newReminderForm.direction === 'inbound'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      别人要求我
                    </button>
                  </div>
                </div>

                {/* 要求者 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {newReminderForm.direction === 'outbound' ? '我（要求者）' : '要求者'}
                  </Label>
                  <Input
                    placeholder={newReminderForm.direction === 'outbound' ? '输入你的名字' : '输入要求者名字'}
                    value={newReminderForm.requesterName}
                    onChange={(e) => setNewReminderForm(prev => ({ ...prev, requesterName: e.target.value }))}
                    className="h-9"
                  />
                </div>

                {/* 被要求者 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {newReminderForm.direction === 'outbound' ? '被要求者' : '我（被要求者）'}
                  </Label>
                  <Input
                    placeholder={newReminderForm.direction === 'outbound' ? '输入被要求者名字' : '输入你的名字'}
                    value={newReminderForm.assigneeName}
                    onChange={(e) => setNewReminderForm(prev => ({ ...prev, assigneeName: e.target.value }))}
                    className="h-9"
                  />
                </div>

                {/* 提醒内容 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">提醒内容</Label>
                  <Textarea
                    placeholder="要做什么事..."
                    value={newReminderForm.content}
                    onChange={(e) => setNewReminderForm(prev => ({ ...prev, content: e.target.value }))}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* 提醒时间 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">提醒时间</Label>
                  <Input
                    type="datetime-local"
                    value={newReminderForm.remindAt}
                    onChange={(e) => setNewReminderForm(prev => ({ ...prev, remindAt: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateReminderDialog(false);
                // 重置状态
                setSmartInputText('');
                setReminderInputMode('smart');
              }}
              disabled={creatingReminder}
            >
              取消
            </Button>
            {reminderInputMode === 'manual' && (
              <Button
                onClick={handleCreateReminder}
                disabled={creatingReminder}
                className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
              >
                {creatingReminder ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />创建中...</>
                ) : (
                  '创建提醒'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔥 信息速记抽屉 */}
      {showSnippetDrawer && (
        <div className="fixed inset-0 z-[60]">
          {/* 遮罩层 */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSnippetDrawer(false)}
          />
          
          {/* 抽屉主体 */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-cyan-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">信息速记</h2>
                  <p className="text-xs text-slate-500">随时记录零散行业信息，后续转化为素材</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSnippetDrawer(false)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* 快速记录表单 */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2 mb-3">
                <BookmarkPlus className="h-4 w-4 text-sky-500" />
                <span className="text-sm font-medium text-slate-700">快速记录</span>
                <span className="text-xs text-slate-400 ml-1">— 输入内容，AI 自动分类、摘要、标签</span>
              </div>
              
              {!snippetAnalyzeResult ? (
                // 步骤1：输入原始内容 + AI 分析
                <div className="space-y-3">
                  {/* 唯一输入框：原始内容 */}
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">输入信息内容 *</Label>
                    <Textarea
                      placeholder="粘贴或输入任何你想记录的信息...&#10;&#10;例如：&#10;· 今天有个客户咨询了重疾险的理赔流程，他说...&#10;· 银保监会发布《关于规范保险公司城市定制型商业医疗保险的通知》&#10;· OpenAI 发布了 GPT-5，支持多模态推理&#10;· 医保目录新增 91 种药品"
                      value={snippetForm.rawContent}
                      onChange={(e) => setSnippetForm(prev => ({ ...prev, rawContent: e.target.value }))}
                      rows={5}
                      className="text-sm min-h-[120px] resize-y w-full"
                    />
                    <p className="text-xs text-slate-400 mt-1">AI 将自动完成分类、标题、摘要、关键词、合规校验</p>
                  </div>

                  <Button
                    onClick={handleAnalyzeSnippet}
                    disabled={snippetAnalyzing}
                    className="w-full h-10 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
                  >
                    {snippetAnalyzing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI 分析中...</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" />AI 智能分析</>
                    )}
                  </Button>

                  {/* 互联网搜索（权威来源） */}
                  {snippetForm.rawContent.trim().length > 0 && !snippetAnalyzeResult && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const query = snippetForm.rawContent.trim().slice(0, 100);
                          handleWebSearch(query);
                        }}
                        disabled={webSearchLoading}
                        className="w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-teal-300 bg-teal-50/60 text-teal-700 text-sm font-medium hover:bg-teal-100 transition-all disabled:opacity-50"
                      >
                        {webSearchLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />{webSearchProgress || '搜索互联网中...'}</>
                        ) : (
                          <><Globe className="w-4 h-4" />搜索互联网（权威来源）</>
                        )}
                      </button>

                      {/* 互联网搜索结果（速记场景） */}
                      {webSearchResults.length > 0 && (
                        <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                          <div className="flex items-center gap-1.5 text-xs text-teal-600 font-medium">
                            <Globe className="w-3 h-3" />
                            <span>权威来源结果</span>
                          </div>
                          {webSearchResults.map((item: WebSearchResultItem) => (
                            <div
                              key={item.id}
                              className="px-3 py-2 rounded-lg border border-teal-200 bg-teal-50/20 hover:border-teal-300 transition-all"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-800 truncate">{item.title}</p>
                                  {item.summarizedContent ? (
                                    <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{item.summarizedContent}</p>
                                  ) : (
                                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{item.snippet}</p>
                                  )}
                                  <span className="text-[10px] text-slate-400 mt-1 inline-block">{item.siteName}</span>
                                </div>
                                <div className="flex flex-col gap-1 shrink-0">
                                  {item.materialFormat && (
                                    <button
                                      type="button"
                                      onClick={() => handleSaveWebResultToMaterial(item.materialFormat)}
                                      className="text-[10px] px-2 py-1 rounded bg-teal-500 text-white hover:bg-teal-600 font-medium whitespace-nowrap"
                                    >
                                      存入素材库
                                    </button>
                                  )}
                                  {item.url && (
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-slate-400 hover:text-teal-600 text-center"
                                    >
                                      原文
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {webSearchSummary && (
                            <div className="px-3 py-2 rounded-lg bg-amber-50/50 border border-amber-200">
                              <div className="flex items-center gap-1 mb-0.5">
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                <span className="text-[10px] font-medium text-amber-700">AI 概括</span>
                              </div>
                              <p className="text-[11px] text-slate-600">{webSearchSummary}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // 步骤2：显示分析结果 + 确认保存
                <div className="space-y-3">
                  {/* 分类标签（并列多标签，无主次之分） */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {snippetAnalyzeResult.categoryLabels?.map((label, idx) => {
                      const category = snippetAnalyzeResult.categories?.[idx] || 'quick_note';
                      return (
                        <Badge 
                          key={idx}
                          className={`${
                            category === 'real_case' ? 'bg-rose-100 text-rose-700' :
                            category === 'insurance' ? 'bg-blue-100 text-blue-700' :
                            category === 'intelligence' ? 'bg-violet-100 text-violet-700' :
                            category === 'medical' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-600'
                          } px-3 py-1`}
                        >
                          {label}
                        </Badge>
                      );
                    })}
                    
                    {snippetAnalyzeResult.materialId && (
                      <span className="text-xs text-slate-400">ID: {snippetAnalyzeResult.materialId}</span>
                    )}
                    {snippetAnalyzeResult.complianceLevel && (
                      <Badge className={`${
                        snippetAnalyzeResult.complianceLevel === 'A' ? 'bg-green-100 text-green-700' :
                        snippetAnalyzeResult.complianceLevel === 'B' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {snippetAnalyzeResult.complianceLevelLabel}
                      </Badge>
                    )}
                  </div>

                  {/* 标题 */}
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">标题</Label>
                    <Input
                      value={snippetAnalyzeResult.title}
                      onChange={(e) => setSnippetAnalyzeResult(prev => prev ? { ...prev, title: e.target.value } : null)}
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* 来源机构 & 发布时间 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">来源机构</Label>
                      <Input
                        value={snippetAnalyzeResult.sourceOrg}
                        onChange={(e) => setSnippetAnalyzeResult(prev => prev ? { ...prev, sourceOrg: e.target.value } : null)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">发布时间</Label>
                      <Input
                        value={snippetAnalyzeResult.publishDate}
                        onChange={(e) => setSnippetAnalyzeResult(prev => prev ? { ...prev, publishDate: e.target.value } : null)}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  {/* 原文链接 */}
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">原文链接</Label>
                    <Input
                      value={snippetAnalyzeResult.url}
                      onChange={(e) => setSnippetAnalyzeResult(prev => prev ? { ...prev, url: e.target.value } : null)}
                      className="h-9 text-sm"
                      placeholder="https://..."
                    />
                  </div>

                  {/* 摘要 */}
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">摘要（15-30字）</Label>
                    <Textarea
                      value={snippetAnalyzeResult.summary}
                      onChange={(e) => setSnippetAnalyzeResult(prev => prev ? { ...prev, summary: e.target.value } : null)}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>

                  {/* 关键词 & 适用场景 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">关键词</Label>
                      <Input
                        value={snippetAnalyzeResult.keywords}
                        onChange={(e) => setSnippetAnalyzeResult(prev => prev ? { ...prev, keywords: e.target.value } : null)}
                        className="h-9 text-sm"
                        placeholder="关键词1, 关键词2"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500 mb-1 block">适用场景</Label>
                      <Input
                        value={snippetAnalyzeResult.applicableScenes}
                        onChange={(e) => setSnippetAnalyzeResult(prev => prev ? { ...prev, applicableScenes: e.target.value } : null)}
                        className="h-9 text-sm"
                        placeholder="场景1, 场景2"
                      />
                    </div>
                  </div>

                  {/* 合规预警（保险类） */}
                  {snippetAnalyzeResult.categories?.includes('insurance') && snippetAnalyzeResult.complianceWarnings && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <Label className="text-xs text-slate-600 mb-2 block font-medium">合规三维校验</Label>
                      <div className="space-y-2 text-xs">
                        {snippetAnalyzeResult.complianceWarnings.source && (
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${snippetAnalyzeResult.complianceWarnings.source.status === 'pass' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                            <span className="text-slate-600">来源：</span>
                            <span className="text-slate-800">{snippetAnalyzeResult.complianceWarnings.source.detail}</span>
                          </div>
                        )}
                        {snippetAnalyzeResult.complianceWarnings.content && (
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${snippetAnalyzeResult.complianceWarnings.content.status === 'pass' ? 'bg-green-500' : snippetAnalyzeResult.complianceWarnings.content.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                            <span className="text-slate-600">内容：</span>
                            <span className="text-slate-800">{snippetAnalyzeResult.complianceWarnings.content.detail}</span>
                            {snippetAnalyzeResult.complianceWarnings.content.violations && snippetAnalyzeResult.complianceWarnings.content.violations.length > 0 && (
                              <span className="text-red-600">（{snippetAnalyzeResult.complianceWarnings.content.violations.join('、')}）</span>
                            )}
                          </div>
                        )}
                        {snippetAnalyzeResult.complianceWarnings.timeliness && (
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${snippetAnalyzeResult.complianceWarnings.timeliness.status === 'pass' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="text-slate-600">时效：</span>
                            <span className="text-slate-800">{snippetAnalyzeResult.complianceWarnings.timeliness.detail}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleCancelAnalyze}
                      className="flex-1 h-9"
                    >
                      重新输入
                    </Button>
                    <Button
                      onClick={handleConfirmSaveSnippet}
                      disabled={snippetSaving}
                      className="flex-1 h-9 bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-600 hover:to-cyan-700 text-white"
                    >
                      {snippetSaving ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中...</>
                      ) : (
                        <><Check className="mr-2 h-4 w-4" />确认保存</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 已有速记列表 */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">已记录</span>
                  <Badge variant="secondary" className="bg-sky-100 text-sky-700">{snippetList.length}</Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="搜索..."
                    value={snippetSearchQuery}
                    onChange={(e) => setSnippetSearchQuery(e.target.value)}
                    className="h-8 w-32 text-xs"
                  />
                  <select
                    value={snippetTypeFilter}
                    onChange={(e) => setSnippetTypeFilter(e.target.value)}
                    className="h-8 text-xs border rounded-md px-2 bg-white"
                  >
                    <option value="all">全部类型</option>
                  </select>
                  <select
                    value={snippetStatusFilter}
                    onChange={(e) => setSnippetStatusFilter(e.target.value)}
                    className="h-8 text-xs border rounded-md px-2 bg-white"
                  >
                    <option value="all">全部状态</option>
                    <option value="pending">待整理</option>
                    <option value="organized">已整理</option>
                  </select>
                </div>
              </div>

              {snippetLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
                </div>
              ) : snippetList.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="mx-auto h-12 w-12 text-slate-200 mb-3" />
                  <p className="text-sm text-slate-400">暂无速记记录</p>
                  <p className="text-xs text-slate-300 mt-1">看到有价值的信息就随手记下来吧</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {snippetList.map((snippet) => {
                    // 获取分类数组（并列多标签）
                    const snippetCategories = (snippet.categories as string[] || ['quick_note']);
                    
                    return (
                      <div
                        key={snippet.id}
                        className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                          snippet.complianceLevel === 'C'
                            ? 'bg-red-50/30 border-red-200'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {/* 分类标签（并列多标签，无主次之分） */}
                              {snippetCategories.map((cat) => {
                                const catStyle = SNIPPET_CATEGORY_COLORS[cat] || SNIPPET_CATEGORY_COLORS.quick_note;
                                const catLabel = SNIPPET_CATEGORY_LABELS[cat] || cat;
                                return (
                                  <Badge 
                                    key={cat}
                                    className={`${catStyle.bg} ${catStyle.text} ${catStyle.border} border px-2 py-0.5`}
                                  >
                                    {catLabel}
                                  </Badge>
                                );
                              })}
                              
                              {/* 合规等级 */}
                              {snippet.complianceLevel && (
                                <Badge className={`${
                                  snippet.complianceLevel === 'A' ? 'bg-green-100 text-green-700' :
                                  snippet.complianceLevel === 'B' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {snippet.complianceLevel === 'A' ? '合规' :
                                   snippet.complianceLevel === 'B' ? '预警' : '违规'}
                                </Badge>
                              )}
                            </div>
                            
                            {/* 标题 */}
                            <h4 className="text-sm font-medium text-slate-800 truncate mb-1">
                              {snippet.title || '无标题'}
                            </h4>
                            
                            {/* 摘要 */}
                            {snippet.summary && (
                              <p className="text-xs text-slate-600 leading-relaxed mb-2">{snippet.summary}</p>
                            )}
                            
                            {/* 元数据 */}
                            <div className="flex items-center gap-3 text-xs text-slate-500 mb-2 flex-wrap">
                              {snippet.sourceOrg && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {snippet.sourceOrg}
                                </span>
                              )}
                              {snippet.publishDate && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {snippet.publishDate}
                                </span>
                              )}
                            </div>

                            {/* 关键词 */}
                            {snippet.keywords && (
                              <div className="flex items-center gap-1 flex-wrap mb-2">
                                {snippet.keywords.split(',').slice(0, 4).map((kw, i) => (
                                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                    {kw.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {snippet.url && (
                              <a
                                href={snippet.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700"
                              >
                                <ExternalLink className="h-3 w-3" />
                                查看原文
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* 选为素材按钮 */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleSelectSnippetAsMaterial(snippet)}
                                    className={`h-7 px-2 rounded-md flex items-center justify-center text-xs font-medium gap-1 transition-colors ${
                                      snippet.materialId && selectedMaterialIds.includes(snippet.materialId)
                                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                                        : 'bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 hover:text-sky-700'
                                    }`}
                                  >
                                    <BookmarkPlus className="h-3 w-3" />
                                    {snippet.materialId && selectedMaterialIds.includes(snippet.materialId)
                                      ? '取消选择'
                                      : snippet.materialId
                                        ? '选为素材'
                                        : '入库并选为素材'}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{snippet.materialId && selectedMaterialIds.includes(snippet.materialId)
                                    ? '从创作引导中移除此素材'
                                    : snippet.materialId
                                      ? '将此素材添加到创作引导'
                                      : '先入库到素材库，再添加到创作引导'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {/* 入库状态标识 */}
                            {snippet.materialId ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-7 w-7 rounded-md bg-green-50 border border-green-200 flex items-center justify-center text-green-600">
                                      <Check className="h-3 w-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent><p>已入库到素材库</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="h-7 w-7 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                                      <AlertCircle className="h-3 w-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent><p>素材入库异常，可点击"入库并选为素材"重新入库</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleDeleteSnippet(snippet.id, snippet.title || '')}
                                    className="h-7 w-7 rounded-md hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent><p>删除</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 微信草稿类型
interface WechatDraft {
  articleId: string;
  taskId: string;
  creatorAgent: string;
  articleTitle: string;
  articleSubtitle: string;
  articleContent: string;
  coreKeywords: string[];
  createTime: string;
  updateTime: string;
  version: number;
  contentStatus: string;
  wechatMpUrl: string;
  wechatMpPublishTime: string | null;
  extInfo: any;
}

// 微信草稿 Tab 组件
function WechatDraftsTab() {
  const [drafts, setDrafts] = useState<WechatDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<WechatDraft | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  // 加载本地草稿
  const loadLocalDrafts = async () => {
    setLoading(true);
    try {
      const result: any = await apiGet('/api/wechat/draft/sync?limit=20');
      if (result.success) {
        setDrafts(result.data);
      }
    } catch (error) {
      console.error('加载本地草稿失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 随机同步一个草稿
  const syncRandomDraft = async () => {
    setSyncing(true);
    try {
      const result: any = await apiPost('/api/wechat/draft/sync', {
        mode: 'random',
        accountId: 'insurance-account',
        overwrite: false,
      });
      if (result.success) {
        toast.success(result.message || '同步成功！');
        loadLocalDrafts();
      } else {
        toast.error('同步失败：' + (result.error || '未知错误'));
      }
    } catch (error) {
      console.error('同步草稿失败:', error);
      toast.error('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  // 查看草稿详情
  const viewDraft = (draft: WechatDraft) => {
    setSelectedDraft(draft);
    setViewMode('detail');
  };

  // 返回列表
  const backToList = () => {
    setSelectedDraft(null);
    setViewMode('list');
  };

  // 组件加载时获取数据
  useEffect(() => {
    loadLocalDrafts();
  }, []);

  if (viewMode === 'detail' && selectedDraft) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={backToList}>
            ← 返回列表
          </Button>
          <h2 className="text-xl font-semibold">草稿详情</h2>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold">{selectedDraft.articleTitle}</h3>
              {selectedDraft.articleSubtitle && (
                <p className="text-muted-foreground mt-2">{selectedDraft.articleSubtitle}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>文章ID</Label>
                <div className="text-sm font-mono mt-1">{selectedDraft.articleId}</div>
              </div>
              <div>
                <Label>创建者</Label>
                <div className="text-sm mt-1">{selectedDraft.creatorAgent}</div>
              </div>
              <div>
                <Label>状态</Label>
                <Badge className="mt-1">{selectedDraft.contentStatus}</Badge>
              </div>
              <div>
                <Label>版本</Label>
                <div className="text-sm mt-1">v{selectedDraft.version}</div>
              </div>
              <div>
                <Label>创建时间</Label>
                <div className="text-sm mt-1">
                  {new Date(selectedDraft.createTime).toLocaleString()}
                </div>
              </div>
              <div>
                <Label>更新时间</Label>
                <div className="text-sm mt-1">
                  {new Date(selectedDraft.updateTime).toLocaleString()}
                </div>
              </div>
            </div>

            {selectedDraft.coreKeywords && selectedDraft.coreKeywords.length > 0 && (
              <div>
                <Label>关键词</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedDraft.coreKeywords.map((keyword, idx) => (
                    <Badge key={idx} variant="outline">{keyword}</Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedDraft.wechatMpUrl && (
              <div>
                <Label>公众号链接</Label>
                <a
                  href={selectedDraft.wechatMpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-sm mt-1 block"
                >
                  {selectedDraft.wechatMpUrl}
                </a>
              </div>
            )}

            <div>
              <Label>文章内容</Label>
              <div className="mt-2 p-4 bg-muted rounded-lg max-h-96 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: selectedDraft.articleContent }} />
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">微信草稿管理</h2>
        <div className="flex gap-2">
          <Button onClick={loadLocalDrafts} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={syncRandomDraft} disabled={syncing}>
            <Save className="mr-2 h-4 w-4" />
            {syncing ? '同步中...' : '随机获取草稿'}
          </Button>
        </div>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
              <p className="text-muted-foreground">加载中...</p>
            </div>
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无本地草稿</h3>
            <p className="text-muted-foreground mb-4">点击"随机获取草稿"按钮从微信公众号获取</p>
            <Button onClick={syncRandomDraft} disabled={syncing}>
              {syncing ? '同步中...' : '随机获取草稿'}
            </Button>
          </div>
        ) : (
          <div>
            <div className="mb-4 text-sm text-muted-foreground">
              共 {drafts.length} 个本地草稿
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文章标题</TableHead>
                  <TableHead>创建者</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((draft) => (
                  <TableRow key={draft.articleId}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {draft.articleTitle || '无标题'}
                    </TableCell>
                    <TableCell>{draft.creatorAgent}</TableCell>
                    <TableCell>
                      <Badge variant={draft.contentStatus === 'published' ? 'default' : 'outline'}>
                        {draft.contentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>v{draft.version}</TableCell>
                    <TableCell>
                      {new Date(draft.createTime).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => viewDraft(draft)}>
                        <Eye className="mr-1 h-4 w-4" />
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 🔥🔥 内容导出 Tab（多平台作品下载）
// ═══════════════════════════════════════════════════

interface CompletedTask {
  id: string;
  taskTitle: string;
  articleTitle: string | null;
  executor: string;
  platform: 'wechat_official' | 'xiaohongshu' | 'zhihu' | 'toutiao' | 'unknown';
  status: string;
  completedAt: Date | null;
  resultData: any;
  resultText: string | null;
  commandResultId: string;
  thumbnailUrls?: string[]; // 缩略图URL列表（最多3张）
}

// 平台配置 - 清新简洁风格
const PLATFORM_CONFIG = {
  wechat_official: {
    name: '公众号',
    icon: '📱',
    bgColor: 'bg-white',
    borderColor: 'border-gray-200',
    labelColor: 'bg-gray-100 text-gray-600',
  },
  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    bgColor: 'bg-white',
    borderColor: 'border-gray-200',
    labelColor: 'bg-gray-100 text-gray-600',
  },
  zhihu: {
    name: '知乎',
    icon: '🔷',
    bgColor: 'bg-white',
    borderColor: 'border-gray-200',
    labelColor: 'bg-gray-100 text-gray-600',
  },
  toutiao: {
    name: '头条/抖音',
    icon: '📺',
    bgColor: 'bg-white',
    borderColor: 'border-gray-200',
    labelColor: 'bg-gray-100 text-gray-600',
  },
  unknown: {
    name: '其他',
    icon: '📄',
    bgColor: 'bg-white',
    borderColor: 'border-gray-200',
    labelColor: 'bg-gray-100 text-gray-600',
  },
};

// 获取平台类型
function getPlatformFromExecutor(executor: string): 'wechat_official' | 'xiaohongshu' | 'zhihu' | 'toutiao' | 'unknown' {
  if (executor === 'insurance-d') return 'wechat_official';
  if (executor === 'insurance-xiaohongshu') return 'xiaohongshu';
  if (executor === 'insurance-zhihu') return 'zhihu';
  if (executor === 'insurance-toutiao') return 'toutiao';
  return 'unknown';
}

function ContentExportTab() {
  const [tasks, setTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);
  const [thumbnailMap, setThumbnailMap] = useState<Record<string, string[]>>({}); // taskId -> thumbnailUrls

  // 加载已完成的任务
  const loadCompletedTasks = async () => {
    setLoading(true);
    try {
      const result: any = await apiGet('/api/subtasks/completed?limit=50');
      if (result.success) {
        const tasks = (result.data || []).map((task: any) => ({
          ...task,
          platform: getPlatformFromExecutor(task.executor),
        }));
        setTasks(tasks);
        
        // 异步加载小红书任务的缩略图
        loadThumbnailsForTasks(tasks.filter((t: CompletedTask) => t.platform === 'xiaohongshu'));
      }
    } catch (error) {
      console.error('加载已完成任务失败:', error);
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 为小红书任务加载缩略图
  const loadThumbnailsForTasks = async (xhsTasks: CompletedTask[]) => {
    const newThumbnailMap: Record<string, string[]> = {};
    
    for (const task of xhsTasks) {
      try {
        const result = await apiGet<{ success?: boolean; cards?: Array<{ url?: string }> }>(
          `/api/xiaohongshu/generate-cards?subTaskId=${task.id}`
        );
        if (result.success && result.cards) {
          // 最多取前3张作为缩略图
          newThumbnailMap[task.id] = result.cards.slice(0, 3).map(c => c.url).filter(Boolean);
        }
      } catch {
        // 忽略加载失败
      }
    }
    
    setThumbnailMap(prev => ({ ...prev, ...newThumbnailMap }));
  };

  // 下载小红书图片 - 从 OSS 获取已生成的卡片（与预览一致）
  const downloadXhsImages = async (task: CompletedTask) => {
    setDownloadingTaskId(task.id);
    try {
      // 🔥 直接从 OSS 获取已生成的卡片图片（不再重新生成）
      const result = await apiGet<{ success?: boolean; cards?: Array<{ url?: string }>; error?: string }>(
        `/api/xiaohongshu/generate-cards?subTaskId=${task.id}`
      );
      
      if (result.success && result.cards && result.cards.length > 0) {
        // 逐张下载
        for (let i = 0; i < result.cards.length; i++) {
          const card = result.cards[i];
          if (!card.url) continue;
          
          const imgResponse = await fetch(card.url);
          const blob = await imgResponse.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${task.articleTitle || '小红书'}_${i + 1}.png`;
          link.click();
          URL.revokeObjectURL(url);
          // 稍作延迟避免浏览器阻止
          await new Promise(r => setTimeout(r, 300));
        }
        toast.success(`已下载 ${result.cards.length} 张图片`);
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast.error('未找到已生成的卡片图片，请确认任务已完成');
      }
    } catch (error) {
      console.error('下载图片失败:', error);
      toast.error('下载失败，请稍后重试');
    } finally {
      setDownloadingTaskId(null);
    }
  };

  // 下载正文 TXT - 从正确的数据路径提取
  const downloadArticleText = (task: CompletedTask) => {
    // 多层级提取正文内容
    const resultData = task.resultData as any;
    const content = 
      // 小红书/公众号信封格式
      resultData?.executorOutput?.structuredResult?.resultContent?.content ||
      resultData?.executorOutput?.result ||
      // 兜底
      task.resultText ||
      '';
    
    if (!content) {
      toast.error('没有可下载的内容');
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${task.articleTitle || '文章'}_${PLATFORM_CONFIG[task.platform].name}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('下载成功');
  };

  // 复制正文到剪贴板
  const copyArticleText = async (task: CompletedTask) => {
    const resultData = task.resultData as any;
    const content = 
      resultData?.executorOutput?.structuredResult?.resultContent?.content ||
      resultData?.executorOutput?.result ||
      task.resultText ||
      '';
    
    if (!content) {
      toast.error('没有可复制的内容');
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  // 复制小红书 JSON
  const copyXhsJson = async (task: CompletedTask) => {
    const resultData = task.resultData as any;
    const platformData = 
      resultData?.executorOutput?.structuredResult?.resultContent?.platformData ||
      resultData?.structuredResult?.resultContent?.platformData ||
      null;
    
    if (!platformData) {
      toast.error('没有小红书数据');
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(platformData, null, 2));
      toast.success('JSON 已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  // 预览公众号/其他平台文章（打开 HTML 预览）
  const previewArticle = (task: CompletedTask) => {
    const resultData = task.resultData as any;
    // 获取文章内容
    const content = 
      resultData?.executorOutput?.structuredResult?.resultContent?.content ||
      resultData?.executorOutput?.result ||
      task.resultText ||
      '';
    
    if (!content) {
      toast.error('没有可预览的内容');
      return;
    }

    // 创建新窗口显示 HTML 内容
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      // 判断是否为 HTML 内容
      const isHtml = content.includes('<') && content.includes('>');
      const htmlContent = isHtml ? content : `<pre style="white-space: pre-wrap; font-family: sans-serif; padding: 20px;">${content}</pre>`;
      
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${task.articleTitle || task.taskTitle}</title>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
            img { max-width: 100%; }
            pre { background: #f5f5f5; padding: 15px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h1 style="border-bottom: 1px solid #eee; padding-bottom: 10px;">${task.articleTitle || task.taskTitle}</h1>
          ${htmlContent}
        </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  // 按平台筛选
  const filteredTasks = selectedPlatform === 'all' 
    ? tasks 
    : tasks.filter(t => t.platform === selectedPlatform);

  // 按平台分组统计
  const platformStats = tasks.reduce((acc, task) => {
    acc[task.platform] = (acc[task.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    loadCompletedTasks();
  }, []);

  return (
    <div className="space-y-4">
      {/* 标题和刷新按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">内容导出</h2>
          <p className="text-sm text-muted-foreground mt-1">
            已完成 {tasks.length} 篇作品，可下载图片和正文
          </p>
        </div>
        <Button onClick={loadCompletedTasks} variant="outline" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 平台筛选 */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedPlatform === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedPlatform('all')}
          className={selectedPlatform === 'all' ? 'bg-blue-500 hover:bg-blue-600' : ''}
        >
          全部 ({tasks.length})
        </Button>
        {Object.entries(platformStats).map(([platform, count]) => {
          const config = PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG];
          return (
            <Button
              key={platform}
              variant={selectedPlatform === platform ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPlatform(platform)}
              className={selectedPlatform === platform ? 'bg-blue-500 hover:bg-blue-600' : ''}
            >
              {config.icon} {config.name} ({count})
            </Button>
          );
        })}
      </div>

      {/* 任务列表 */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto"></div>
              <p className="text-gray-500">加载中...</p>
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">暂无已完成的作品</h3>
            <p className="text-sm text-gray-400">
              完成创作后，作品会自动出现在这里
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => {
              const config = PLATFORM_CONFIG[task.platform];
              const thumbnails = thumbnailMap[task.id] || [];
              
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
                >
                  {/* 左侧：缩略图组 */}
                  <div className="flex-shrink-0">
                    {thumbnails.length > 0 ? (
                      <div className="flex gap-1">
                        {thumbnails.slice(0, 3).map((url, idx) => (
                          <div
                            key={idx}
                            className="w-14 h-14 rounded-md overflow-hidden bg-gray-100"
                          >
                            <img
                              src={url}
                              alt={`缩略图${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                        {/* 如果超过3张，显示更多提示 */}
                        {thumbnails.length > 3 && (
                          <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                            +{thumbnails.length - 3}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center">
                        <span className="text-2xl">{config.icon}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 中间：内容信息 */}
                  <div className="flex-1 min-w-0">
                    {/* 平台标签 */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${config.labelColor}`}>
                        {config.name}
                      </span>
                    </div>
                    {/* 文章标题 */}
                    <h3 className="text-sm font-medium text-gray-900 mb-1 line-clamp-1">
                      {task.articleTitle || task.taskTitle}
                    </h3>
                    {/* 生成时间 */}
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {task.completedAt 
                          ? new Date(task.completedAt).toLocaleString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '未知时间'}
                      </span>
                    </div>
                  </div>

                  {/* 右侧：操作按钮 */}
                  <div className="flex gap-2 flex-shrink-0">
                    {/* 小红书：预览 + 下载图片 + 下载正文 */}
                    {task.platform === 'xiaohongshu' && (
                      <>
                        <XiaohongshuPreview 
                          taskId={task.id}
                          variant="outline"
                          size="sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => downloadXhsImages(task)}
                          disabled={downloadingTaskId === task.id}
                        >
                          {downloadingTaskId === task.id ? (
                            <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ImageIcon className="mr-1 h-3.5 w-3.5" />
                          )}
                          下载图片
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-3 bg-blue-500 hover:bg-blue-600 text-white"
                          onClick={() => downloadArticleText(task)}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          下载正文
                        </Button>
                      </>
                    )}
                    
                    {/* 公众号/知乎/头条：预览 */}
                    {task.platform !== 'xiaohongshu' && (
                      <Button
                        size="sm"
                        className="h-8 px-3 bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={() => previewArticle(task)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        预览
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 🔥🔥 内容模板选择器（Phase 2-1）
// ═══════════════════════════════════════════════════

interface ContentTemplateItem {
  id: string;
  name: string;
  description: string | null;
  cardCountMode: string;
  densityStyle: string;
  promptInstruction: string | null;
  useCount: number;
  createdAt: string;
}

function ContentTemplateSelector({
  onSelect,
  selectedId,
}: {
  onSelect: (template: ContentTemplateItem | null) => void;
  selectedId: string | null;
}) {
  const [templates, setTemplates] = useState<ContentTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载最近使用的内容模板
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ success: boolean; data: ContentTemplateItem[] }>('/api/content-templates?limit=5');
        if (!cancelled && data.success) {
          setTemplates(data.data || []);
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // 如果有 URL 带入的 ID，自动选中并回调（使用 ref 避免 onSelect 引用变化导致重复触发）
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // 🔥 默认选择"5卡-详尽风"逻辑
  useEffect(() => {
    if (templates.length > 0 && !selectedId) {
      // 优先查找"5卡-详尽风"
      const defaultTemplate = templates.find(t => 
        t.name === '5卡-详尽风' || 
        (t.cardCountMode === '5-card' && t.densityStyle === 'detailed')
      );
      if (defaultTemplate) {
        onSelectRef.current(defaultTemplate);
      }
    }
  }, [templates, selectedId]);

  useEffect(() => {
    if (selectedId && selectedId !== 'new' && templates.length > 0) {
      const found = templates.find(t => t.id === selectedId);
      if (found) onSelectRef.current(found);
    }
  }, [selectedId, templates]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        正在加载内容模板...
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-slate-400 mb-2">暂无内容模板</p>
        <Link
          href="/style-init"
          className="text-sm text-rose-600 hover:text-rose-700 underline"
        >
          去风格复刻创建 →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">选择一个模板决定图文分工方式（不选则使用默认）</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 不使用模板选项 */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`text-left p-3 rounded-lg border-2 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${
            !selectedId || selectedId === 'new'
              ? 'border-slate-300 bg-gradient-to-br from-slate-100 to-gray-100 shadow-sm'
              : 'border-transparent bg-white hover:border-gray-200 hover:bg-gray-50/50 hover:shadow-sm'
          }`}
        >
          <p className="text-sm font-medium text-slate-700">默认模式</p>
          <p className="text-sm text-slate-500 mt-1">系统自动判断图文分工</p>
        </button>

        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl)}
            className={`text-left p-3 rounded-lg border-2 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] ${
              selectedId === tpl.id
                ? 'border-rose-400 bg-gradient-to-br from-rose-50 to-pink-50 shadow-md shadow-rose-200/50'
                : 'border-gray-200 bg-white hover:border-rose-300 hover:bg-gradient-to-br hover:from-rose-50/50 hover:to-pink-50/30 hover:shadow-md hover:shadow-rose-100/50'
            }`}
          >
            <div className="flex items-start justify-between mb-1">
              <p className="text-sm font-semibold text-slate-800 truncate flex-1">{tpl.name}</p>
              {selectedId === tpl.id && (
                <CheckCircle2 className="w-5 h-5 text-rose-500 shrink-0 ml-1" />
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {tpl.cardCountMode?.replace('-card', '卡') || 'N卡'}
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {tpl.densityStyle === 'minimal' ? '极简' :
                 tpl.densityStyle === 'concise' ? '精简' :
                 tpl.densityStyle === 'detailed' ? '详尽' : '标准'}
              </Badge>
              {tpl.useCount > 0 && (
                <span className="text-xs text-slate-400">{tpl.useCount}次使用</span>
              )}
            </div>
            {tpl.promptInstruction && (
              <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{tpl.promptInstruction}</p>
            )}
          </button>
        ))}
      </div>
      <div className="flex justify-end pt-1">
        <Link
          href="/style-init"
          className="text-sm text-rose-600 hover:text-rose-700 flex items-center gap-1.5 transition-colors duration-200"
        >
          <Sparkles className="w-4 h-4" />
          从参考笔记创建新模板
        </Link>
      </div>
    </div>
  );
}
