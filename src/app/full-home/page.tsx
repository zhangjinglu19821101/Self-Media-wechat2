'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete, checkApiKeyMissing } from '@/lib/api/client';
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
import { Loader2, Plus, Trash2, Send, Sparkles, ListTodo, CheckCircle2, XCircle, GripVertical, MoveUp, MoveDown, Maximize2, Minimize2, AlertTriangle, GitCompare, RefreshCw, FileText, Save, Eye, Home, BookmarkPlus, ExternalLink, BookOpen, Clock, Building2, X, HelpCircle, Settings, Rocket, Layers, ChevronDown, ChevronUp, Cpu, Brain, Workflow, Palette, PenTool, ArrowRight, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { AgentTaskListNormal } from '@/components/agent-task-list-normal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { STRUCTURE_TEMPLATES, getDefaultStructure, type StructureTemplate } from '@/components/creation-guide/structure-templates';
import { PLATFORM_CONFIG_FIELDS, type PlatformType, PLATFORM_LABELS } from '@/lib/db/schema/style-template';
import { getFlowTemplate } from '@/lib/agents/flow-templates';
import { HorizontalFlowDiagram } from '@/components/creation-guide/horizontal-flow-diagram';
import { NodeDetailPanel } from '@/components/creation-guide/node-detail-drawer';
import type { FlowNode } from '@/components/creation-guide/types';

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
  productTags: string[];
  crowdTags: string[];
  sceneTags: string[];
  emotionTags: string[];
  relevanceScore: number;
}

// 🔥 创作引导持久化数据类型
interface CreationGuideDraft {
  coreOpinion: string;
  emotionTone: string;
  selectedMaterialIds: string[];
  selectedAccountId: string; // 兼容旧草稿：发布账号ID
  selectedAccountIds: string[]; // 🔥 多平台发布：选中的账号ID列表
  savedAt: number;
  version: number;
}

// 🔥🔥 表单快照类型（用于 API Key 跳转后恢复全部表单数据）
interface FormSnapshot {
  mainInstruction: string;
  coreOpinion: string;
  emotionTone: string;
  selectedMaterialIds: string[];
  selectedCaseIds: string[];
  selectedAccountIds: string[];
  selectedContentTemplate: {
    id: string;
    name: string;
    promptInstruction?: string;
    cardCountMode?: string;
    densityStyle?: string;
  } | null;
  selectedStructureId: string;
  savedAt: number;
}

const FORM_SNAPSHOT_KEY = 'fullHome_formSnapshot';

function saveFormSnapshot(snapshot: FormSnapshot) {
  try {
    sessionStorage.setItem(FORM_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch { /* sessionStorage 不可用时忽略 */ }
}

function loadFormSnapshot(): FormSnapshot | null {
  try {
    const raw = sessionStorage.getItem(FORM_SNAPSHOT_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as FormSnapshot;
    // 超过 1 小时的快照视为过期
    if (Date.now() - snapshot.savedAt > 60 * 60 * 1000) {
      sessionStorage.removeItem(FORM_SNAPSHOT_KEY);
      return null;
    }
    return snapshot;
  } catch { return null; }
}

function clearFormSnapshot() {
  try {
    sessionStorage.removeItem(FORM_SNAPSHOT_KEY);
  } catch { /* ignore */ }
}

// 🔥 信息速记类型定义
interface InfoSnippet {
  id: string;
  title: string;
  sourceOrg: string;
  publishDate: string | null;
  url: string | null;
  highlights: string;
  status: string;
  createdAt: string;
}

// localStorage Key 前缀
const STORAGE_KEY_PREFIX = 'creationGuide_draft_';
const CURRENT_DRAFT_VERSION = 3; // v3: 支持 platformGuideOverrides 按平台区分

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

// 🔥 生成创作引导的 localStorage Key
function getCreationGuideStorageKey(sessionId: string | null): string {
  return `${STORAGE_KEY_PREFIX}${sessionId || 'default'}`;
}

// 🔥 保存创作引导草稿到 localStorage（防抖版）
const saveCreationGuideDraft = debounce((
  sessionId: string | null,
  data: Omit<CreationGuideDraft, 'savedAt' | 'version'>
) => {
  if (typeof window === 'undefined') return;
  try {
    const key = getCreationGuideStorageKey(sessionId);
    const draft: CreationGuideDraft = {
      ...data,
      savedAt: Date.now(),
      version: CURRENT_DRAFT_VERSION,
    };
    localStorage.setItem(key, JSON.stringify(draft));
    // 同时清理超过7天的旧草稿
    cleanupOldDrafts();
  } catch (error) {
    console.warn('[CreationGuide] 保存草稿失败:', error);
  }
}, 500);

// 🔥 从 localStorage 加载创作引导草稿
function loadCreationGuideDraft(sessionId: string | null): CreationGuideDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = getCreationGuideStorageKey(sessionId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CreationGuideDraft;

    // 🔥 版本兼容：v1 缺少 selectedAccountIds 字段，自动升级
    if (draft.version === 1 && !draft.selectedAccountIds) {
      draft.selectedAccountIds = draft.selectedAccountId
        ? [draft.selectedAccountId]
        : [];
    }

    // 静默升级到当前版本
    draft.version = CURRENT_DRAFT_VERSION;
    try {
      localStorage.setItem(key, JSON.stringify(draft));
    } catch { /* ignore write failure */ }

    // 校验版本和过期时间（7天）
    if (draft.version !== CURRENT_DRAFT_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch (error) {
    console.warn('[CreationGuide] 加载草稿失败:', error);
    return null;
  }
}

// 🔥 清除创作引导草稿
function clearCreationGuideDraft(sessionId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const key = getCreationGuideStorageKey(sessionId);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('[CreationGuide] 清除草稿失败:', error);
  }
}

// 🔥 清理超过7天的旧草稿
function cleanupOldDrafts() {
  if (typeof window === 'undefined') return;
  try {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const draft = JSON.parse(raw);
            if (draft.savedAt && draft.savedAt < cutoffTime) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key); // 格式错误的旧数据也清理
          }
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (error) {
    console.warn('[CreationGuide] 清理旧草稿失败:', error);
  }
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
  const [materialSearchOpen, setMaterialSearchOpen] = useState(false);
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [materialSearchResults, setMaterialSearchResults] = useState<MaterialItem[]>([]);
  const [materialSearchLoading, setMaterialSearchLoading] = useState(false);
  const [suggestedOpinions, setSuggestedOpinions] = useState<string[]>([]);
  const [loadingSuggestedOpinions, setLoadingSuggestedOpinions] = useState(false);
  const [recommendedMaterials, setRecommendedMaterials] = useState<MaterialItem[]>([]);
  const [loadingRecommendedMaterials, setLoadingRecommendedMaterials] = useState(false);

  // 🔥 行业案例引用相关状态
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [selectedCases, setSelectedCases] = useState<CaseItem[]>([]);
  const [recommendedCases, setRecommendedCases] = useState<CaseItem[]>([]);
  const [loadingRecommendedCases, setLoadingRecommendedCases] = useState(false);

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
  const [snippetForm, setSnippetForm] = useState({
    title: '',
    sourceOrg: '',
    publishDate: '',
    url: '',
    highlights: '',
  });
  const [snippetSearchQuery, setSnippetSearchQuery] = useState('');
  const [snippetStatusFilter, setSnippetStatusFilter] = useState<string>('all');

  // 🔥 创作引导：从 localStorage 加载草稿（仅在客户端）
  useEffect(() => {
    if (hasSplitResult) {
      const draft = loadCreationGuideDraft(tempSessionId);
      if (draft) {
        setCoreOpinion(draft.coreOpinion || '');
        setEmotionTone(draft.emotionTone || '理性客观'); // 默认值：理性客观
        setSelectedMaterialIds(draft.selectedMaterialIds || []);
        // 🔥 多平台发布：优先使用 selectedAccountIds，兼容旧草稿的 selectedAccountId
        if (draft.selectedAccountIds && draft.selectedAccountIds.length > 0) {
          setSelectedAccountIds(draft.selectedAccountIds);
          setSelectedAccountId(draft.selectedAccountIds[0]); // 兼容字段
        } else if (draft.selectedAccountId) {
          setSelectedAccountIds([draft.selectedAccountId]);
          setSelectedAccountId(draft.selectedAccountId);
        }
        toast.success('已自动恢复你的创作引导内容');
      }
    }
  }, [hasSplitResult, tempSessionId]);

  // 🔥 创作引导：监听变化，debounce 保存到 localStorage
  useEffect(() => {
    if (!hasSplitResult) return; // 只有AI拆解后才保存
    saveCreationGuideDraft(tempSessionId, {
      coreOpinion,
      emotionTone,
      selectedMaterialIds,
      selectedAccountId, // 兼容字段
      selectedAccountIds, // 🔥 多平台发布：保存账号多选列表
    });
  }, [coreOpinion, emotionTone, selectedMaterialIds, selectedAccountId, selectedAccountIds, hasSplitResult, tempSessionId]);

  // 🔥🔥 表单快照：从 sessionStorage 恢复（API Key 跳转后返回时）
  const formSnapshotRestored = useRef(false);
  useEffect(() => {
    if (formSnapshotRestored.current) return; // 避免重复恢复
    const snapshot = loadFormSnapshot();
    if (snapshot) {
      if (snapshot.mainInstruction) setMainInstruction(snapshot.mainInstruction);
      if (snapshot.coreOpinion) setCoreOpinion(snapshot.coreOpinion);
      if (snapshot.emotionTone) setEmotionTone(snapshot.emotionTone);
      if (snapshot.selectedMaterialIds?.length) setSelectedMaterialIds(snapshot.selectedMaterialIds);
      if (snapshot.selectedCaseIds?.length) setSelectedCaseIds(snapshot.selectedCaseIds);
      if (snapshot.selectedAccountIds?.length) {
        setSelectedAccountIds(snapshot.selectedAccountIds);
        setSelectedAccountId(snapshot.selectedAccountIds[0]); // 兼容字段
      }
      if (snapshot.selectedContentTemplate) setSelectedContentTemplate(snapshot.selectedContentTemplate);
      if (snapshot.selectedStructureId) {
        const structure = STRUCTURE_TEMPLATES.find(s => s.id === snapshot.selectedStructureId);
        if (structure) setSelectedStructure(structure);
      }
      formSnapshotRestored.current = true;
      toast.success('已恢复您之前填写的内容');
    }
  }, []);

  // 🔥🔥 表单快照：监听变化，自动保存到 sessionStorage（用于跳转恢复）
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return; // 首次渲染跳过（等待恢复完成）
    }
    // 只在有实质内容时保存
    const hasContent = mainInstruction || coreOpinion || selectedMaterialIds.length > 0
      || selectedAccountIds.length > 0 || selectedContentTemplate;
    if (!hasContent) return;

    saveFormSnapshot({
      mainInstruction,
      coreOpinion,
      emotionTone,
      selectedMaterialIds,
      selectedCaseIds,
      selectedAccountIds,
      selectedContentTemplate,
      selectedStructureId: selectedStructure.id,
      savedAt: Date.now(),
    });
  }, [mainInstruction, coreOpinion, emotionTone, selectedMaterialIds, selectedCaseIds, selectedAccountIds, selectedContentTemplate, selectedStructure]);

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

    // 为每个选中的账号创建对应的子任务组
    const groups: PlatformSubTaskGroup[] = selectedAccountIds.map(accountId => {
      const config = accountConfigs.find(c => c.account.id === accountId);
      const platform = config?.account?.platform || 'wechat_official';
      const accountName = config?.account?.accountName || '未知账号';
      
      // 🔥 核心逻辑：使用对应平台的固定流程模板（与原来一致）
      const template = getFlowTemplate(platform);

      // 检查是否已有该平台的分组（保留用户编辑过的内容）
      const existingGroup = platformSubTaskGroupsRef.current.find(g => g.accountId === accountId);
      if (existingGroup) {
        return existingGroup; // 保留用户编辑
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
        // 用户在"账号管理"页配置了账号就意味着要发布，无需手动勾选
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

  // 🔥 创作引导：预计算去重后的手动搜索结果（避免O(n²)重复filter）
  const filteredSearchMaterials = useMemo(() => 
    materialSearchResults.filter((m) => !recommendedMaterials.some((r) => r.id === m.id)),
    [materialSearchResults, recommendedMaterials]
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
      toast.success(`✅ AI 成功拆解出 ${newSubTasks.length} 个子任务`);
      
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
  const handleSuggestOpinions = async () => {
    if (!mainInstruction.trim()) {
      toast.error('请先输入任务指令');
      return;
    }
    setLoadingSuggestedOpinions(true);
    try {
      const data: any = await apiPost('/api/agents/b/suggest-opinion', { instruction: mainInstruction });
      setSuggestedOpinions(data.opinions || []);
      toast.success(`生成了 ${data.opinions?.length || 0} 个建议观点`);
    } catch (error: any) {
      toast.error(`生成建议观点失败: ${error.message}`);
    } finally {
      setLoadingSuggestedOpinions(false);
    }
  };

  // 🔥 创作引导：搜索素材
  const handleSearchMaterials = async (query: string) => {
    if (!query.trim()) {
      setMaterialSearchResults([]);
      return;
    }
    setMaterialSearchLoading(true);
    try {
      const data: any = await apiGet(`/api/materials?search=${encodeURIComponent(query)}&limit=10`);
      setMaterialSearchResults(data?.data || []);
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

  // 🔥 创作引导：AI推荐素材
  const handleRecommendMaterials = async () => {
    if (!mainInstruction.trim()) {
      toast.error('请先输入任务指令');
      return;
    }
    setLoadingRecommendedMaterials(true);
    try {
      const data: any = await apiGet(`/api/materials/recommend?instruction=${encodeURIComponent(mainInstruction)}&limit=5`);
      const materials = data?.data || [];
      setRecommendedMaterials(materials);
      // 同时更新搜索结果，使选中状态可交互
      setMaterialSearchResults(prev => {
        const existing = prev.filter(p => !materials.some((d: any) => d.id === p.id));
        return [...materials, ...existing];
      });
      if (materials.length > 0) {
        toast.success(`推荐了 ${materials.length} 个相关素材`);
      } else {
        toast.info('暂无匹配素材，可先去素材库创建');
      }
    } catch (error) {
      console.error('推荐素材失败:', error);
      toast.error('推荐素材失败');
    } finally {
      setLoadingRecommendedMaterials(false);
    }
  };

  // 🔥 行业案例：推荐相关案例
  const handleRecommendCases = async () => {
    if (!mainInstruction.trim()) {
      toast.error('请先输入任务指令');
      return;
    }
    setLoadingRecommendedCases(true);
    try {
      const data: any = await apiPost('/api/cases/recommend', { instruction: mainInstruction });
      const cases: CaseItem[] = data?.data?.cases || [];
      setRecommendedCases(cases);
      if (cases.length > 0) {
        toast.success(`推荐了 ${cases.length} 条相关案例`);
      } else {
        toast.info('暂无匹配案例');
      }
    } catch (error) {
      console.error('推荐案例失败:', error);
      toast.error('推荐案例失败');
    } finally {
      setLoadingRecommendedCases(false);
    }
  };

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

  // 🔥 信息速记：加载列表
  const loadSnippetList = useCallback(async () => {
    setSnippetLoading(true);
    try {
      const params = new URLSearchParams();
      if (snippetSearchQuery) params.set('search', snippetSearchQuery);
      if (snippetStatusFilter !== 'all') params.set('status', snippetStatusFilter);
      params.set('pageSize', '50');
      const data: any = await apiGet(`/api/info-snippets?${params.toString()}`);
      setSnippetList(data?.data?.list || data?.data || []);
    } catch (error) {
      console.error('[InfoSnippets] 加载失败:', error);
    } finally {
      setSnippetLoading(false);
    }
  }, [snippetSearchQuery, snippetStatusFilter]);

  // 🔥 信息速记：打开抽屉时加载
  useEffect(() => {
    if (showSnippetDrawer) {
      loadSnippetList();
    }
  }, [showSnippetDrawer, loadSnippetList]);

  // 🔥 信息速记：保存速记
  const handleSaveSnippet = async () => {
    if (!snippetForm.title.trim()) { toast.error('请填写报告/信息名称'); return; }
    if (!snippetForm.sourceOrg.trim()) { toast.error('请填写发布机构'); return; }
    if (!snippetForm.highlights.trim()) { toast.error('请填写核心数据亮点'); return; }
    
    setSnippetSaving(true);
    try {
      await apiPost('/api/info-snippets', snippetForm);
      toast.success('速记已保存');
      setSnippetForm({ title: '', sourceOrg: '', publishDate: '', url: '', highlights: '' });
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

  // 🔥 信息速记：转化为素材
  const handleConvertToMaterial = async (id: string, title: string) => {
    try {
      await apiPost(`/api/info-snippets/${id}/convert-to-material`, { type: 'data' });
      toast.success(`已将「${title}」转化为素材`);
      loadSnippetList();
    } catch (error) {
      toast.error('转化失败');
    }
  };

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
        taskUserOpinion += `${taskUserOpinion ? '\n' : ''}【原始指令】${mainInstruction.trim()}`;

        return {
          ...task,
          userOpinion: taskUserOpinion,
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
        taskUserOpinion += `\n【原始指令】${mainInstruction.trim()}`;

        return {
          ...task,
          userOpinion: taskUserOpinion,
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
      clearCreationGuideDraft(tempSessionId);
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
    if (submitLockRef.current) {
      toast.warning('正在创建中，请勿重复点击。如果卡住了，点击按钮旁的重置图标');
      return;
    }

    // 2. 强制字段约束验证
    if (!taskTitle.trim()) {
      toast.error('请填写任务标题');
      return;
    }
    
    if (!executionDate) {
      toast.error('请选择执行日期');
      return;
    }

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



          {/* 对比草稿与终稿 Tab - 副天蓝色主题 */}
          <TabsTrigger 
            value="article-compare" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-indigo-200 hover:bg-white/70"
          >
            <GitCompare className="w-5 h-5 mr-2" />
            <span className="font-medium">对比草稿</span>
          </TabsTrigger>

          {/* 微信草稿 Tab - 副天蓝色主题 */}
          <TabsTrigger 
            value="wechat-drafts" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-cyan-200 hover:bg-white/70"
          >
            <FileText className="w-5 h-5 mr-2" />
            <span className="font-medium">微信草稿</span>
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
                  <Button 
                    size="sm" 
                    asChild
                    className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg shadow-violet-200/50"
                  >
                    <Link href="/account-management">
                      <Settings className="w-4 h-4 mr-2" />
                      账号管理
                    </Link>
                  </Button>
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
                <div className="text-sm text-green-600 font-medium flex items-center gap-2">
                  ✅ AI 拆解完成！你可以编辑和确认下面的子任务
                </div>
                {detectedDomain && (
                  <div className="text-sm text-blue-600 font-medium flex items-center gap-2">
                    🎯 识别到的领域：<span className="font-bold">{detectedDomain}</span>
                  </div>
                )}
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
                          <div>
                            <div className="flex items-center gap-3">
                              <h2 className="text-2xl font-bold text-slate-900">内容模版</h2>
                              <Badge className="text-xs text-sky-700 bg-sky-100 border border-sky-200">小红书专属</Badge>
                              {selectedContentTemplate && (
                                <Badge className="text-xs text-sky-700 bg-sky-100 border border-sky-200">已选择</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-1">选择内容模版，快速匹配你的创作风格</p>
                          </div>
                          {/* 内容类型标签页 */}
                          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl">
                            <button
                              type="button"
                              className="
                                px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                                bg-white text-slate-900 shadow-sm
                              "
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                图文
                              </div>
                            </button>
                            <button
                              type="button"
                              className="
                                px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                                text-slate-500 hover:text-slate-700
                              "
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                视频
                              </div>
                            </button>
                          </div>
                        </div>
                        
                        {/* 内容区域 */}
                        <div className="p-6 bg-slate-50/50">
                          {/* 图文模板展示 */}
                          <div className="space-y-6">
                            {/* 图文模板网格 */}
                            <div>
                              <h3 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                图文模板
                              </h3>
                              <div className="grid gap-4 md:grid-cols-2">
                                {/* 模板卡片1 */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                                  <div className="aspect-[4/5] bg-gradient-to-br from-amber-50 to-orange-100 relative overflow-hidden">
                                    {/* 模板封面模拟 */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="text-center">
                                        <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
                                          <span className="text-white font-bold text-lg">图文</span>
                                        </div>
                                        <p className="text-sm text-slate-600">封面模板</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-4">
                                    <h4 className="font-semibold text-slate-800 mb-1">情感共鸣模板</h4>
                                    <p className="text-sm text-slate-500">以情感故事为主，引发读者共鸣</p>
                                  </div>
                                </div>
                                
                                {/* 模板卡片2 */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                                  <div className="aspect-[4/5] bg-gradient-to-br from-blue-50 to-sky-100 relative overflow-hidden">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="text-center">
                                        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-sky-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
                                          <span className="text-white font-bold text-lg">图文</span>
                                        </div>
                                        <p className="text-sm text-slate-600">对比模板</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-4">
                                    <h4 className="font-semibold text-slate-800 mb-1">对比分析模板</h4>
                                    <p className="text-sm text-slate-500">产品对比，突出优势</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* 模板长图展示 */}
                            <div>
                              <h3 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                模板长图
                              </h3>
                              <div className="grid gap-4 md:grid-cols-2">
                                {/* 长图模板卡片1 */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                                  <div className="aspect-[16/9] bg-gradient-to-br from-blue-500 to-sky-600 relative overflow-hidden">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="text-center">
                                        <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                                          <BookOpen className="w-10 h-10 text-white" />
                                        </div>
                                        <p className="text-white font-semibold">长图预览</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-4">
                                    <h4 className="font-semibold text-slate-800 mb-1">专业分析长图</h4>
                                    <p className="text-sm text-slate-500">专业严谨的分析风格</p>
                                  </div>
                                </div>
                                
                                {/* 长图模板卡片2 */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                                  <div className="aspect-[16/9] bg-gradient-to-br from-purple-500 to-pink-600 relative overflow-hidden">
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="text-center">
                                        <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-3 flex items-center justify-center backdrop-blur-sm">
                                          <BookOpen className="w-10 h-10 text-white" />
                                        </div>
                                        <p className="text-white font-semibold">长图预览</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="p-4">
                                    <h4 className="font-semibold text-slate-800 mb-1">情感故事长图</h4>
                                    <p className="text-sm text-slate-500">温馨感人的故事风格</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* 实际的 ContentTemplateSelector 组件（保持原有功能） */}
                            <div className="mt-6">
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
                            </div>
                            
                            {/* 已选择模板展示 */}
                            {selectedContentTemplate && (
                              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                                <p className="text-sm font-semibold text-slate-800 mb-2">已选择模板：{selectedContentTemplate.name}</p>
                                {selectedContentTemplate.promptInstruction && (
                                  <p className="text-sm text-slate-500 leading-relaxed">{selectedContentTemplate.promptInstruction}</p>
                                )}
                              </div>
                            )}
                          </div>
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
                          {selectedAccountIds.length > 1 && (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                              <p className="text-sm text-amber-800 flex items-center gap-2">
                                <Rocket className="w-4 h-4" />
                                将为 <span className="font-semibold">{selectedAccountIds.length}</span> 个平台分别生成差异化文章
                              </p>
                            </div>
                          )}
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
                            <Button variant="ghost" size="sm" onClick={handleRecommendCases} disabled={loadingRecommendedCases || !mainInstruction.trim()} className="h-8 px-3 text-xs text-emerald-600 hover:text-emerald-700">
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
                                根据指令推荐的最相关案例（点击选择）
                              </div>
                              {recommendedCases.map((c) => {
                                const isSelected = selectedCaseIds.includes(c.id);
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggleCaseSelection(c)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                                      isSelected
                                        ? 'border-emerald-400 bg-emerald-50'
                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
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
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* 无推荐结果 */}
                          {mainInstruction.trim() && !loadingRecommendedCases && recommendedCases.length === 0 && (
                            <div className="text-center py-8 text-sm text-slate-400">
                              点击上方「推荐案例」按钮，获取与指令相关的行业案例
                            </div>
                          )}
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
                        关联素材
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
                            <Button variant="ghost" size="sm" onClick={handleSuggestOpinions} disabled={loadingSuggestedOpinions || !mainInstruction.trim()} className="h-8 px-3 text-xs text-indigo-500 hover:text-indigo-700">
                              {loadingSuggestedOpinions ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                              AI帮我想
                            </Button>
                          </div>
                          <Input
                            value={coreOpinion}
                            onChange={(e) => setCoreOpinion(e.target.value)}
                            placeholder="比如：存款到期别急着买增额寿，先算清楚再决定"
                            className="h-10 text-sm"
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
                      
                      {/* 关联素材 Tab */}
                      {activeGuideTab === 'material' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">选择关联素材</span>
                              <span className="text-xs text-slate-400">增强文章的说服力</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setMaterialSearchOpen(!materialSearchOpen)} className="h-8 px-3 text-xs text-slate-500">
                                <FileText className="w-3.5 h-3.5 mr-1.5" />搜索
                              </Button>
                              <Button variant="ghost" size="sm" onClick={handleRecommendMaterials} disabled={loadingRecommendedMaterials || !mainInstruction.trim()} className="h-8 px-3 text-xs text-amber-500">
                                {loadingRecommendedMaterials ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                                AI推荐
                              </Button>
                            </div>
                          </div>
                          
                          {selectedMaterials.length > 0 && (
                            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg">
                              {selectedMaterials.map(mat => (
                                <Badge
                                  key={mat.id}
                                  variant="secondary"
                                  className="text-sm bg-indigo-50 text-indigo-700 border-indigo-200 cursor-pointer hover:bg-indigo-100 gap-1.5 pr-2"
                                  onClick={() => toggleMaterialSelection(mat)}
                                >
                                  {mat.title.length > 12 ? mat.title.slice(0, 12) + '...' : mat.title}
                                  <span className="text-indigo-400 hover:text-red-400 text-sm">×</span>
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* 素材搜索弹窗（内联） */}
                          {materialSearchOpen && (
                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                              <div className="flex gap-2">
                                <Input
                                  placeholder="搜索素材..."
                                  value={materialSearchQuery}
                                  onChange={(e) => setMaterialSearchQuery(e.target.value)}
                                  className="text-sm h-9"
                                />
                                <Button size="sm" onClick={() => handleSearchMaterials(materialSearchQuery)} disabled={materialSearchLoading || !materialSearchQuery.trim()} className="text-sm h-9 px-4">
                                  {materialSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '搜索'}
                                </Button>
                              </div>
                              {recommendedMaterials.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    AI推荐素材
                                  </div>
                                  {recommendedMaterials.map((mat) => (
                                    <button
                                      key={mat.id}
                                      type="button"
                                      onClick={() => toggleMaterialSelection(mat)}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                                        selectedMaterialIds.includes(mat.id)
                                          ? 'bg-indigo-100 text-indigo-700'
                                          : 'hover:bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      <span className="font-medium">{mat.title}</span>
                                      {selectedMaterialIds.includes(mat.id) && <CheckCircle2 className="w-3.5 h-3.5 ml-1.5 inline text-indigo-500" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {filteredSearchMaterials.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="text-xs font-medium text-slate-500">搜索结果</div>
                                  {filteredSearchMaterials.map((mat) => (
                                    <button
                                      key={mat.id}
                                      type="button"
                                      onClick={() => toggleMaterialSelection(mat)}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                                        selectedMaterialIds.includes(mat.id)
                                          ? 'bg-indigo-100 text-indigo-700'
                                          : 'hover:bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      <span className="font-medium">{mat.title}</span>
                                      {selectedMaterialIds.includes(mat.id) && <CheckCircle2 className="w-3.5 h-3.5 ml-1.5 inline text-indigo-500" />}
                                    </button>
                                  ))}
                                </div>
                              )}
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
              {platformSubTaskGroups.map((group) => {
                const validTasks = group.subTasks.filter(t => t.title.trim());
                const selectedTask = selectedNodeId
                  ? group.subTasks.find(t => t.id === selectedNodeId)
                  : null;
                const selectedIndex = selectedTask
                  ? validTasks.findIndex(t => t.id === selectedNodeId)
                  : -1;
                const isCurrentGroup = selectedGroupAccountId === group.accountId;

                return (
                  <div key={group.accountId} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                    disabled={isSubmitting || submitLockRef.current || !taskTitle.trim() || !executionDate || platformSubTaskGroups.length === 0}
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

        {/* 微信草稿 Tab */}
        <TabsContent value="wechat-drafts" className="space-y-4">
          {/* 🔥 公众号发布快捷入口 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/wechat-config">
              <Card className="bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-200/50 hover:shadow-md hover:border-sky-300 transition-all cursor-pointer h-full">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 p-3 shadow-lg flex-shrink-0">
                      <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sky-900">公众号发布配置</h3>
                      <p className="text-sm text-sky-600 mt-1">设置作者、原创、评论等默认值</p>
                      <Badge variant="secondary" className="mt-2 text-xs bg-sky-100 text-sky-700">首次使用请先配置</Badge>
                    </div>
                    <ExternalLink className="w-5 h-5 text-sky-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/task-timeline">
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200/50 hover:shadow-md hover:border-green-300 transition-all cursor-pointer h-full">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 p-3 shadow-lg flex-shrink-0">
                      <Rocket className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-green-900">发布就绪中心</h3>
                      <p className="text-sm text-green-600 mt-1">完成任务后一键上传到草稿箱</p>
                      <Badge variant="secondary" className="mt-2 text-xs bg-green-100 text-green-700">任务完成后使用</Badge>
                    </div>
                    <ExternalLink className="w-5 h-5 text-green-400 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <WechatDraftsTab />
        </TabsContent>
      </Tabs>

      {/* 🔥 信息速记浮动按钮 */}
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

      {/* 🔥 信息速记抽屉 */}
      {showSnippetDrawer && (
        <div className="fixed inset-0 z-[60]">
          {/* 遮罩层 */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSnippetDrawer(false)}
          />
          
          {/* 抽屉主体 */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
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
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">报告/信息名称 *</Label>
                    <Input
                      placeholder="如：中国城镇居民家庭资产负债调查"
                      value={snippetForm.title}
                      onChange={(e) => setSnippetForm(prev => ({ ...prev, title: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">发布机构 *</Label>
                    <Input
                      placeholder="如：中国人民银行"
                      value={snippetForm.sourceOrg}
                      onChange={(e) => setSnippetForm(prev => ({ ...prev, sourceOrg: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">
                      <Clock className="h-3 w-3 inline mr-1" />发布时间
                    </Label>
                    <Input
                      placeholder="2020年 / 2026年1月"
                      value={snippetForm.publishDate}
                      onChange={(e) => setSnippetForm(prev => ({ ...prev, publishDate: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">
                      <ExternalLink className="h-3 w-3 inline mr-1" />直达 URL
                    </Label>
                    <Input
                      placeholder="https://..."
                      value={snippetForm.url}
                      onChange={(e) => setSnippetForm(prev => ({ ...prev, url: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">核心数据亮点 *</Label>
                  <Textarea
                    placeholder="家庭总资产均值 317.9 万元，房产占比 70%..."
                    value={snippetForm.highlights}
                    onChange={(e) => setSnippetForm(prev => ({ ...prev, highlights: e.target.value }))}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                <Button
                  onClick={handleSaveSnippet}
                  disabled={snippetSaving}
                  className="w-full bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-600 hover:to-cyan-700 text-white h-9"
                >
                  {snippetSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中...</>
                  ) : (
                    <><BookmarkPlus className="mr-2 h-4 w-4" />保存速记</>
                  )}
                </Button>
              </div>
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
                    className="h-8 w-36 text-xs"
                  />
                  <select
                    value={snippetStatusFilter}
                    onChange={(e) => setSnippetStatusFilter(e.target.value)}
                    className="h-8 text-xs border rounded-md px-2 bg-white"
                  >
                    <option value="all">全部</option>
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
                  {snippetList.map((snippet) => (
                    <div
                      key={snippet.id}
                      className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                        snippet.status === 'organized' 
                          ? 'bg-emerald-50/50 border-emerald-200' 
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-slate-800 truncate">{snippet.title}</h4>
                            {snippet.status === 'organized' && (
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0">已整理</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {snippet.sourceOrg}
                            </span>
                            {snippet.publishDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {snippet.publishDate}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{snippet.highlights}</p>
                          
                          {snippet.url && (
                            <a
                              href={snippet.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 mt-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              查看原文
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {snippet.status !== 'organized' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleConvertToMaterial(snippet.id, snippet.title)}
                                    className="h-8 w-8 rounded-lg hover:bg-sky-50 flex items-center justify-center text-sky-600 hover:text-sky-700 transition-colors"
                                  >
                                    <BookOpen className="h-4 w-4" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent><p>转化为素材</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleDeleteSnippet(snippet.id, snippet.title)}
                                  className="h-8 w-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent><p>删除</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  ))}
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
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        正在加载内容模板...
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-slate-400 mb-2">暂无内容模板</p>
        <Link
          href="/style-init"
          className="text-xs text-amber-600 hover:text-amber-700 underline"
        >
          去风格复刻创建 →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-400">选择一个模板决定图文分工方式（不选则使用默认）</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* 不使用模板选项 */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`text-left p-3 rounded-lg border-2 transition-all ${
            !selectedId || selectedId === 'new'
              ? 'border-gray-300 bg-gray-50 shadow-sm'
              : 'border-transparent bg-white hover:border-gray-200 hover:bg-gray-50/50'
          }`}
        >
          <p className="text-xs font-medium text-slate-500">默认模式</p>
          <p className="text-[10px] text-slate-400 mt-1">系统自动判断图文分工</p>
        </button>

        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onSelect(tpl)}
            className={`text-left p-3 rounded-lg border-2 transition-all ${
              selectedId === tpl.id
                ? 'border-amber-400 bg-amber-50/60 shadow-sm'
                : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
            }`}
          >
            <div className="flex items-start justify-between mb-1">
              <p className="text-xs font-medium text-slate-800 truncate flex-1">{tpl.name}</p>
              {selectedId === tpl.id && (
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-1" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                {tpl.cardCountMode?.replace('-card', '卡') || 'N卡'}
              </Badge>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                {tpl.densityStyle === 'minimal' ? '极简' :
                 tpl.densityStyle === 'concise' ? '精简' :
                 tpl.densityStyle === 'detailed' ? '详尽' : '标准'}
              </Badge>
              {tpl.useCount > 0 && (
                <span className="text-[9px] text-slate-400">{tpl.useCount}次使用</span>
              )}
            </div>
            {tpl.promptInstruction && (
              <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{tpl.promptInstruction}</p>
            )}
          </button>
        ))}
      </div>
      <div className="flex justify-end pt-1">
        <Link
          href="/style-init"
          className="text-[10px] text-amber-600 hover:text-amber-700 flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3" />
          从参考笔记创建新模板
        </Link>
      </div>
    </div>
  );
}
