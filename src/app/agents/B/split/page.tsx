'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2, Send, Sparkles, ListTodo, UserCheck, CheckCircle2, XCircle, GripVertical, MoveUp, MoveDown, Maximize2, Minimize2, AlertTriangle, GitCompare, RefreshCw, FileText, Save, Eye, Home } from 'lucide-react';
import { toast } from 'sonner';
import { AgentTaskListNormal } from '@/components/agent-task-list-normal';

interface SubTask {
  id: string;
  title: string;
  description: string;
  executor: string;
  orderIndex: number;
}

interface AISplitResponse {
  subTasks: Array<{
    title: string;
    description: string;
    executor: string;
    orderIndex?: number;
  }>;
  domain?: string;
  productTags?: string[];
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
];

export default function AgentBSplitPage() {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  // 在客户端挂载后设置今日日期，避免 SSR/Client hydration 不一致
  useEffect(() => {
    setExecutionDate(new Date().toISOString().split('T')[0]);
  }, []);
  const [mainInstruction, setMainInstruction] = useState('');
  const [subTasks, setSubTasks] = useState<SubTask[]>([
    { id: '1', title: '', description: '', executor: 'B', orderIndex: 1 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [hasSplitResult, setHasSplitResult] = useState(false);
  const [tempSessionId, setTempSessionId] = useState<string | null>(null); // 临时会话 ID，用于替换逻辑
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null); // 识别到的领域
  const [detectedProductTags, setDetectedProductTags] = useState<string[]>([]); // 识别到的产品标签
  const [showPrompt, setShowPrompt] = useState(false); // 是否展示提示词
  const [fullPrompt, setFullPrompt] = useState<string | null>(null); // 完整的提示词内容
  
  // 🔥 新增：用户决策相关状态
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [userDecisionContent, setUserDecisionContent] = useState('');
  const [selectedDecisionOption, setSelectedDecisionOption] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  
  // 🔥 新增：执行者选择相关状态
  const [executorOptions, setExecutorOptions] = useState<any[]>([]);
  const [selectedExecutor, setSelectedExecutor] = useState<string>('');
  const [loadingExecutorOptions, setLoadingExecutorOptions] = useState(false);
  
  // 🔥 新增：浮窗显示状态
  const [showTaskListPanel, setShowTaskListPanel] = useState(false);
  const [showUserDecisionPanel, setShowUserDecisionPanel] = useState(false);
  
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

  const handleAISplit = async () => {
    if (!mainInstruction.trim()) {
      toast.error('请输入主任务指令');
      return;
    }

    setIsSplitting(true);
    try {
      const response = await fetch('/api/agents/b/ai-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: mainInstruction }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI 拆解失败');
      }

      const result: AISplitResponse = await response.json();
      
      // 保存识别到的领域和提示词
      if (result.domain) {
        setDetectedDomain(result.domain);
      }
      // 保存识别到的产品标签
      if (result.productTags && result.productTags.length > 0) {
        setDetectedProductTags(result.productTags);
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
      }));

      setSubTasks(newSubTasks);
      setHasSplitResult(true);
      toast.success(`✅ AI 成功拆解出 ${newSubTasks.length} 个子任务`);
      
    } catch (error: any) {
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
    const validSubTasks = subTasks.filter(t => t.title.trim());
    if (validSubTasks.length === 0) {
      return '请至少填写一个子任务';
    }
    return null;
  };

  // 🔥 检查是否有重复任务
  const checkDuplicateTasks = async (): Promise<boolean> => {
    try {
      const mainExecutor = subTasks[0]?.executor || 'unknown';
      
      const response = await fetch('/api/agents/b/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle,
          executionDate,
          mainExecutor,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.hasDuplicate;
    } catch (error) {
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
    const validSubTasks = subTasks.filter(t => t.title.trim());
    
    try {
      const response = await fetch('/api/agents/b/simple-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle,
          taskDescription,
          executionDate,
          subTasks: validSubTasks,
          tempSessionId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建失败');
      }

      const result = await response.json();
      toast.success(`✅ 成功创建 ${result.data.insertedCount} 个子任务`);
      
      if (result.data.tempSessionId) {
        setTempSessionId(result.data.tempSessionId);
      }
      
    } catch (error: any) {
      toast.error(`❌ 创建失败: ${error.message}`);
      throw error;
    }
  };

  // 🔥 主提交函数
  const handleSubmit = async () => {
    // 1. 立即加锁，防止重复点击
    if (submitLockRef.current) {
      toast.warning('正在创建中，请勿重复点击');
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

    const validSubTasks = subTasks.filter(t => t.title.trim());
    if (validSubTasks.length === 0) {
      toast.error('请至少填写一个子任务');
      return;
    }

    // 3. 加锁并设置状态
    submitLockRef.current = true;
    setIsSubmitting(true);
    
    try {
      // 4. 先显示确认创建弹框
      const confirmedCreate = await showConfirmCreateDialog();
      if (!confirmedCreate) {
        return; // 用户取消，不提交
      }

      // 5. 检查是否有重复任务
      const hasDuplicate = await checkDuplicateTasks();
      if (hasDuplicate) {
        const confirmed = await showDuplicateConfirmDialog();
        if (!confirmed) {
          return; // 用户取消，不提交
        }
      }

      // 6. 用户确认后，提交到服务器
      await submitToServer();
      
    } catch (error: any) {
      // 错误已经在 submitToServer 中处理了
    } finally {
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
      
      const response = await fetch(`/api/articles/history?commandResultId=${commandResultId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
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
      
      const agentBData = await agentBRes.json();
      const insuranceDData = await insuranceDRes.json();
      
      // 合并统计数据
      const pending = (agentBData.data?.stats?.pending || 0) + (insuranceDData.data?.stats?.pending || 0);
      const in_progress = (agentBData.data?.stats?.in_progress || 0) + (insuranceDData.data?.stats?.in_progress || 0);
      const waiting_user = (agentBData.data?.stats?.waiting_user || 0) + (insuranceDData.data?.stats?.waiting_user || 0);
      
      setTaskStats({ pending, in_progress, waiting_user });
    } catch (error) {
      console.error('❌ 加载任务统计失败:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // 🔥 新增：提交用户决策
  const submitUserDecision = async () => {
    if (!selectedTask) {
      toast.error('请先选择一个任务');
      return;
    }

    if (!userDecisionContent.trim()) {
      toast.error('请输入决策内容');
      return;
    }

    setIsSubmittingDecision(true);

    try {
      console.log('📤 提交用户决策...');
      console.log('  - 子任务 ID:', selectedTask.id);
      console.log('  - 决策内容:', userDecisionContent);
      console.log('  - 决策选项:', selectedDecisionOption);
      console.log('  - 强制执行者:', selectedExecutor);

      const response = await fetch('/api/agents/user-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subTaskId: selectedTask.id,
          commandResultId: selectedTask.commandResultId,
          userDecision: userDecisionContent,
          decisionType: selectedDecisionOption || 'redecision',
          forcedExecutor: selectedExecutor || undefined,  // 🔴 携带强制执行者
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('用户决策已提交');
        console.log('✅ 用户决策提交成功:', data);
        setUserDecisionContent('');
        setSelectedDecisionOption('');
        setSelectedTask(null);
        setSelectedExecutor('');  // 🔴 重置执行者选择
        // 提交决策后重新加载统计
        loadTaskStats();
      } else {
        toast.error(`提交失败: ${data.error}`);
        console.error('❌ 用户决策提交失败:', data.error);
      }
    } catch (error) {
      console.error('❌ 提交用户决策时出错:', error);
      toast.error('提交失败，请重试');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // 🔥 新增：加载执行者选项（含避坑信息）
  const loadExecutorOptions = async (taskId: string) => {
    if (!taskId) return;
    
    setLoadingExecutorOptions(true);
    try {
      console.log('📤 加载执行者选项...', taskId);
      const response = await fetch(`/api/agents/user-decision?subTaskId=${taskId}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ 执行者选项加载成功:', data.data);
        setExecutorOptions(data.data.executorOptions || []);
        // 重置选中的执行者
        setSelectedExecutor('');
      } else {
        console.error('❌ 加载执行者选项失败:', data.error);
        toast.error(`加载执行者选项失败: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ 加载执行者选项时出错:', error);
      toast.error('加载失败，请重试');
    } finally {
      setLoadingExecutorOptions(false);
    }
  };

  // 🔥 新增：当选择任务时，加载执行者选项
  useEffect(() => {
    if (selectedTask?.id) {
      loadExecutorOptions(selectedTask.id);
    } else {
      setExecutorOptions([]);
      setSelectedExecutor('');
    }
  }, [selectedTask?.id]);

  // 🔥 优化：使用页面可见性 API 替代定时轮询（业界标准做法）
  useEffect(() => {
    loadTaskStats();
    
    // 只在页面重新可见时刷新，减少不必要的请求
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
        {/* 🔥 美化后的TabList */}
        <TabsList className="mb-6 p-1.5 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 rounded-xl border border-slate-200 shadow-sm">
          {/* 任务拆解 Tab - 紫蓝色主题 */}
          <TabsTrigger 
            value="split" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-200 hover:bg-white/50"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            <span className="font-medium">任务拆解</span>
          </TabsTrigger>

          {/* 任务列表 Tab - 青绿色主题 + 数字徽章 */}
          <TabsTrigger 
            value="tasks" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-emerald-200 hover:bg-white/50"
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

          {/* 用户决策 Tab - 橙色主题 */}
          <TabsTrigger 
            value="user-decision" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-orange-200 hover:bg-white/50"
          >
            <UserCheck className="w-5 h-5 mr-2" />
            <span className="font-medium">用户决策</span>
          </TabsTrigger>

          {/* 对比草稿与终稿 Tab - 粉色主题 */}
          <TabsTrigger 
            value="article-compare" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-pink-200 hover:bg-white/50"
          >
            <GitCompare className="w-5 h-5 mr-2" />
            <span className="font-medium">对比草稿</span>
          </TabsTrigger>

          {/* 微信草稿 Tab - 蓝绿色主题 */}
          <TabsTrigger 
            value="wechat-drafts" 
            className="relative px-4 py-2.5 rounded-lg transition-all duration-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-cyan-200 hover:bg-white/50"
          >
            <FileText className="w-5 h-5 mr-2" />
            <span className="font-medium">微信草稿</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="split">
          {/* 任务拆解主内容 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Link href="/">
                    <Button variant="outline" size="sm">
                      <Home className="w-4 h-4 mr-2" />
                      返回主页
                    </Button>
                  </Link>
                  <div>
                    <CardTitle className="text-2xl">🤖 Agent B 简化拆解工具</CardTitle>
                    <CardDescription>
                      AI 智能拆解任务，直接创建子任务到 agent_sub_tasks 表
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
        <CardContent className="space-y-6">
          {/* AI 智能拆解区域 */}
          <div className="space-y-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              🧠 AI 智能拆解
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">粘贴主任务指令</label>
              <Textarea
                value={mainInstruction}
                onChange={(e) => setMainInstruction(e.target.value)}
                placeholder="粘贴你的完整任务指令在这里，比如：&#10;&#10;完全依据复制下列指令给insurance-d下达执行指令&#10;### 二、正式指令下达&#10;职责标签：内容类&#10;执行主体为「insurance-d 」&#10;..."
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleAISplit}
                    disabled={isSplitting || !mainInstruction.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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
                {/* 产品标签交互区 - AI 识别回填，用户可编辑 */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-amber-600 flex items-center gap-1">
                    🏷️ 产品标签
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={detectedProductTags.join('、')}
                      onChange={(e) => {
                        const tags = e.target.value.split(/[、,，\s]+/).filter(Boolean);
                        setDetectedProductTags(tags);
                      }}
                      className="h-8 text-sm flex-1"
                      placeholder="AI 自动识别，也可手动输入标签"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['意外险', '重疾险', '医疗险', '寿险', '年金险', '增额终身寿', '教育金', '养老金', '信托', '财产险', '雇主责任险'].map((preset) => {
                      const isSelected = detectedProductTags.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setDetectedProductTags(detectedProductTags.filter(t => t !== preset));
                            } else {
                              setDetectedProductTags([...detectedProductTags, preset]);
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            isSelected
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{preset}
                        </button>
                      );
                    })}
                  </div>
                </div>

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

          {/* 主任务信息 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">📋 主任务信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  任务标题
                  <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">
                    （AI 拆解会自动生成）
                  </span>
                </label>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="例如：Q3产品迭代计划"
                  className={!taskTitle.trim() ? 'border-red-300 focus-visible:ring-red-500' : ''}
                />
                {!taskTitle.trim() && (
                  <p className="text-xs text-red-500">请填写任务标题，或使用 AI 智能拆解自动生成</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  执行日期
                  <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={executionDate}
                  onChange={(e) => setExecutionDate(e.target.value)}
                  className={!executionDate ? 'border-red-300 focus-visible:ring-red-500' : ''}
                />
                {!executionDate && (
                  <p className="text-xs text-red-500">请选择执行日期</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">任务描述</label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="详细描述这个任务..."
                rows={2}
              />
            </div>
          </div>

          {/* 子任务列表 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">📝 子任务列表</h3>
              <Button variant="outline" size="sm" onClick={addSubTask}>
                <Plus className="w-4 h-4 mr-2" />
                添加子任务
              </Button>
            </div>

            {subTasks.map((subTask, index) => (
              <Card 
                key={subTask.id} 
                className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-blue-400"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-purple-500"></div>
                <CardContent className="pt-4 space-y-4 pl-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* 拖拽手柄和序号 */}
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveSubTaskUp(subTask.id)}
                            disabled={index === 0}
                            className={`h-7 w-7 rounded-full transition-all duration-200 ${
                              index === 0 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100'
                            }`}
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveSubTaskDown(subTask.id)}
                            disabled={index === subTasks.length - 1}
                            className={`h-7 w-7 rounded-full transition-all duration-200 ${
                              index === subTasks.length - 1 
                                ? 'text-gray-300 cursor-not-allowed' 
                                : 'text-gray-500 hover:text-amber-600 hover:bg-amber-50 active:bg-amber-100'
                            }`}
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* 序号徽章 */}
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="secondary"
                          className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 border-blue-200 font-semibold"
                        >
                          #{subTask.orderIndex}
                        </Badge>
                        
                        {/* 拖拽提示 */}
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <span className="hidden sm:inline">拖拽或</span>
                          <GripVertical className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                    
                    {/* 直接修改序号输入框 */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Input
                          type="number"
                          min={1}
                          max={subTasks.length}
                          value={subTask.orderIndex}
                          onChange={(e) => changeSubTaskOrder(subTask.id, parseInt(e.target.value) || 1)}
                          className="w-16 h-8 text-center font-mono text-sm border-gray-600 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-400"
                        />
                        <span className="absolute -top-2 -right-1 text-[10px text-gray-400 bg-white px-1">
                          序号
                        </span>
                      </div>
                      
                      {/* 删除按钮 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSubTask(subTask.id)}
                        className="h-8 w-8 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 group-hover:opacity-100 opacity-70"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1 space-y-2">
                      <label className="text-sm font-medium">子任务标题</label>
                      <Input
                        value={subTask.title}
                        onChange={(e) => updateSubTask(subTask.id, 'title', e.target.value)}
                        placeholder="子任务标题"
                      />
                    </div>
                    <div className="md:col-span-1 space-y-2">
                      <label className="text-sm font-medium">执行者</label>
                      <Select
                        value={subTask.executor}
                        onValueChange={(value) => updateSubTask(subTask.id, 'executor', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择执行者" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_AGENTS.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">子任务描述</label>
                    <Textarea
                      value={subTask.description}
                      onChange={(e) => updateSubTask(subTask.id, 'description', e.target.value)}
                      placeholder="详细描述这个子任务..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end pt-4 border-t">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || submitLockRef.current || !taskTitle.trim() || !executionDate || subTasks.filter(t => t.title.trim()).length === 0}
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

      {/* 用户决策面板（浮窗） */}
      {showUserDecisionPanel && (
        <div className="fixed bottom-4 right-4 z-50 w-[750px]">
          <Card>
            <CardHeader className="sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  <UserCheck className="w-6 h-6 mr-2 inline" />
                  用户决策
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUserDecisionPanel(false)}
                  className="h-10 w-10 p-0"
                >
                  <XCircle className="w-6 h-6" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3 text-base">📋 功能说明</h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>• 支持用户对任务进行重新决策</li>
                  <li>• 支持用户确认 waiting_user 状态的任务</li>
                  <li>• 自动记录用户交互历史</li>
                </ul>
              </div>

              {selectedTask && (
                <Card className="border-2 border-blue-300">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">当前选择的任务</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <div className="space-y-2">
                      <div>
                        <strong className="text-sm">任务标题：</strong>
                        <span className="text-base">{selectedTask.taskTitle}</span>
                      </div>
                      <div>
                        <strong className="text-sm">任务描述：</strong>
                        <p className="text-sm text-gray-600">{selectedTask.taskDescription}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-sm">{selectedTask.status}</Badge>
                        <Badge variant="outline" className="text-sm">{selectedTask.executor}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">决策选项</label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={selectedDecisionOption === 'redecision' ? 'default' : 'outline'}
                      onClick={() => setSelectedDecisionOption('redecision')}
                      className="justify-start text-sm h-10"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      重新决策
                    </Button>
                    <Button
                      variant={selectedDecisionOption === 'waiting_user' ? 'default' : 'outline'}
                      onClick={() => setSelectedDecisionOption('waiting_user')}
                      className="justify-start text-sm h-10"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      确认等待用户
                    </Button>
                  </div>
                </div>

                {/* 🔥 新增：执行者选择器 */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    指定执行者
                    {loadingExecutorOptions && <Loader2 className="w-4 h-4 ml-2 inline animate-spin" />}
                  </label>
                  <Select 
                    value={selectedExecutor} 
                    onValueChange={setSelectedExecutor}
                    disabled={!selectedTask || loadingExecutorOptions}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择执行者（可选）" />
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
                              <Badge variant="default" className="text-xs px-1 py-0 h-5 bg-green-600">
                                推荐
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* 显示选中执行者的详细信息 */}
                  {selectedExecutor && executorOptions.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      {(() => {
                        const selected = executorOptions.find(o => o.value === selectedExecutor);
                        if (!selected) return null;
                        return (
                          <div className="space-y-1">
                            <p><strong>描述：</strong>{selected.description}</p>
                            {selected.capabilities && (
                              <p><strong>能力：</strong>{selected.capabilities.join('、')}</p>
                            )}
                            {selected.rejectionCount > 0 && (
                              <p className="text-amber-600">
                                <strong>⚠️ 注意：</strong>该执行者已拒绝此任务 {selected.rejectionCount} 次
                                {selected.rejectionReasons?.length > 0 && (
                                  <span>（原因：{selected.rejectionReasons[0].substring(0, 50)}...）</span>
                                )}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">决策内容</label>
                  <Textarea
                    value={userDecisionContent}
                    onChange={(e) => setUserDecisionContent(e.target.value)}
                    placeholder="请输入您的决策或建议..."
                    rows={4}
                    className="text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={submitUserDecision}
                    disabled={!userDecisionContent.trim() || isSubmittingDecision}
                  >
                    {isSubmittingDecision ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      '提交决策'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUserDecisionContent('');
                      setSelectedDecisionOption('');
                      setSelectedTask(null);
                      setSelectedExecutor('');
                    }}
                  >
                    重置
                  </Button>
                </div>
              </div>
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
            {/* 主任务信息 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3 text-base">📋 主任务信息</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">任务标题：</span>
                  <span className="text-gray-900 font-medium">{taskTitle}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">执行日期：</span>
                  <span className="text-gray-900">{executionDate}</span>
                </div>
                {taskDescription && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-600">任务描述：</span>
                    <p className="text-gray-900 mt-1">{taskDescription}</p>
                  </div>
                )}
              </div>
            </div>

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
              <div className="space-y-4">
                {/* 显示 Agent B 的任务列表 */}
                <AgentTaskListNormal 
                  agentId="B" 
                  showPanel={true} 
                  onTogglePanel={() => {}} 
                />
                
                {/* 显示 insurance-d 的任务列表 */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">insurance-d 任务</h3>
                  <AgentTaskListNormal 
                    agentId="insurance-d" 
                    showPanel={true} 
                    onTogglePanel={() => {}} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user-decision">
          <Card>
            <CardHeader>
              <CardTitle>
                <UserCheck className="w-5 h-5 mr-2 inline" />
                用户决策功能
              </CardTitle>
              <CardDescription>
                模拟用户对任务的决策和建议
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3 text-base">📋 功能说明</h4>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>• 支持用户对任务进行重新决策</li>
                  <li>• 支持用户确认 waiting_user 状态的任务</li>
                  <li>• 自动记录用户交互历史</li>
                </ul>
              </div>

              {selectedTask && (
                <Card className="border-2 border-blue-300">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">当前选择的任务</CardTitle>
                  </CardHeader>
                  <CardContent className="py-3">
                    <div className="space-y-2">
                      <div>
                        <strong className="text-sm">任务标题：</strong>
                        <span className="text-base">{selectedTask.taskTitle}</span>
                      </div>
                      <div>
                        <strong className="text-sm">任务描述：</strong>
                        <p className="text-sm text-gray-600">{selectedTask.taskDescription}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-sm">{selectedTask.status}</Badge>
                        <Badge variant="outline" className="text-sm">{selectedTask.executor}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">决策选项</label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant={selectedDecisionOption === 'redecision' ? 'default' : 'outline'}
                      onClick={() => setSelectedDecisionOption('redecision')}
                      className="justify-start text-sm h-10"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      重新决策
                    </Button>
                    <Button
                      variant={selectedDecisionOption === 'waiting_user' ? 'default' : 'outline'}
                      onClick={() => setSelectedDecisionOption('waiting_user')}
                      className="justify-start text-sm h-10"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      确认等待用户
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">决策内容</label>
                  <Textarea
                    value={userDecisionContent}
                    onChange={(e) => setUserDecisionContent(e.target.value)}
                    placeholder="请输入您的决策或建议..."
                    rows={4}
                    className="text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={submitUserDecision}
                    disabled={!userDecisionContent.trim() || isSubmittingDecision}
                  >
                    {isSubmittingDecision ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      '提交决策'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUserDecisionContent('');
                      setSelectedDecisionOption('');
                      setSelectedTask(null);
                    }}
                  >
                    重置
                  </Button>
                </div>
              </div>
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
                            {articleVersions.map((version, index) => (
                              <SelectItem key={version.timestamp?.toString() || index} value={version.timestamp?.toString() || String(index)}>
                                {version.title || `版本 ${index + 1}`}
                                {version.timestamp && (
                                  <span className="text-gray-500 ml-2">
                                    {new Date(version.timestamp).toLocaleString()}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
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
                            {articleVersions.map((version, index) => (
                              <SelectItem key={version.timestamp?.toString() || `v2-${index}`} value={version.timestamp?.toString() || String(index)}>
                                {version.title || `版本 ${index + 1}`}
                                {version.timestamp && (
                                  <span className="text-gray-500 ml-2">
                                    {new Date(version.timestamp).toLocaleString()}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
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
          <WechatDraftsTab />
        </TabsContent>
      </Tabs>
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
      const response = await fetch('/api/wechat/draft/sync?limit=20');
      const result = await response.json();
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
      const response = await fetch('/api/wechat/draft/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'random',
          accountId: 'insurance-account',
          overwrite: false,
        }),
      });
      const result = await response.json();
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
