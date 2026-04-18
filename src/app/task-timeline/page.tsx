'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ListTodo,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Calendar,
  Filter,
  Search,
  Archive,
  Folder,
  Link2,
  LayoutGrid,
  List as ListIcon,
  Rocket
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

interface TaskWithDetails {
  id: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  status: string;
  executor: string;
  priority: string;
  orderIndex: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  metadata: {
    acceptanceCriteria?: string;
    originalCommand?: string;
    [key: string]: any;
  };
  relatedDailyTask?: {
    id: string;
    taskId: string;
    executionDate: string;
    executionDeadlineStart: string;
    executionDeadlineEnd: string;
    coreCommand?: string;
  };
}

// 视图模式类型
type ViewMode = 'timeline' | 'parent-group';

// 日期分组类型
type DateGroup = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'earlier';

interface GroupedTasks {
  [key: string]: TaskWithDetails[];
}

// 颜色调色板（用于区分不同父任务）
const PARENT_TASK_COLORS = [
  { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' },
  { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700', dot: 'bg-purple-500' },
  { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500' },
  { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700', dot: 'bg-orange-500' },
  { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700', dot: 'bg-pink-500' },
  { bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700', dot: 'bg-cyan-500' },
];

const AVAILABLE_AGENTS = [
  { id: 'B', name: '技术官 B' },
  { id: 'T', name: '技术专家 T' },
  { id: 'C', name: '数据分析师 C' },
  { id: 'D', name: '内容创作者 D' },
  { id: 'insurance-c', name: '保险运营 insurance-c' },
  { id: 'insurance-d', name: '保险作者 insurance-d' },
];

const STATUS_FILTERS = [
  { value: 'all', label: '全部', icon: ListTodo },
  { value: 'in_progress', label: '进行中', icon: Loader2 },
  { value: 'pending', label: '待处理', icon: Clock },
  { value: 'waiting_user', label: '待确认', icon: Eye },
  { value: 'completed', label: '已完成', icon: CheckCircle2 },
  { value: 'failed', label: '失败', icon: XCircle },
];

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: '今天',
  yesterday: '昨天',
  thisWeek: '本周',
  lastWeek: '上周',
  earlier: '更早',
};

export default function TaskTimelinePage() {
  const [selectedAgent, setSelectedAgent] = useState<string>('B');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['today']));

  // 加载任务列表
  const loadTasks = async (agentId: string, status?: string) => {
    try {
      setLoading(true);
      const url = new URL(`/api/agents/${agentId}/tasks`, window.location.origin);
      if (status && status !== 'all') {
        url.searchParams.set('status', status);
      }
      
      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.success) {
        setTasks(data.data.tasks);
        console.log(`✅ 加载到 ${data.data.tasks.length} 个任务`);
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

  useEffect(() => {
    loadTasks(selectedAgent, statusFilter);
  }, [selectedAgent, statusFilter]);

  // 按日期分组任务
  const groupedTasks = useMemo((): GroupedTasks => {
    const groups: GroupedTasks = {
      today: [],
      yesterday: [],
      thisWeek: [],
      lastWeek: [],
      earlier: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    tasks.forEach(task => {
      const taskDate = new Date(task.createdAt);
      const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());

      if (taskDateOnly.getTime() === today.getTime()) {
        groups.today.push(task);
      } else if (taskDateOnly.getTime() === yesterday.getTime()) {
        groups.yesterday.push(task);
      } else if (taskDateOnly >= weekStart) {
        groups.thisWeek.push(task);
      } else if (taskDateOnly >= lastWeekStart) {
        groups.lastWeek.push(task);
      } else {
        groups.earlier.push(task);
      }
    });

    return groups;
  }, [tasks]);

  // 切换分组展开/折叠
  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  // 获取状态信息
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
      pending: { label: '待处理', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
      in_progress: { label: '进行中', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Loader2 },
      waiting_user: { label: '待确认', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Eye },
      completed: { label: '已完成', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle2 },
      failed: { label: '失败', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle },
    };
    return statusMap[status] || { label: status, color: 'text-gray-600', bgColor: 'bg-gray-100', icon: ListTodo };
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 🔥 获取父任务标识（从relatedDailyTask或taskId推断）
  const getParentTaskId = (task: TaskWithDetails): string => {
    // 优先从relatedDailyTask获取
    if (task.relatedDailyTask?.taskId) {
      return task.relatedDailyTask.taskId;
    }
    // 从taskId推断：如果是子任务，通常有规律的命名
    if (task.taskId) {
      // 假设taskId格式为：parent-xxx-sub-1，提取parent-xxx部分
      const match = task.taskId.match(/^(.*)-sub-\d+$/);
      if (match) return match[1];
      // 或者直接用taskId的前半部分作为标识
      return task.taskId.split('-').slice(0, 3).join('-');
    }
    // 兜底：用executor + orderIndex作为临时分组
    return `${task.executor}-group`;
  };

  // 🔥 按父任务分组（用于父任务分组视图）
  const groupedByParentTask = useMemo((): GroupedTasks => {
    const groups: GroupedTasks = {};
    
    tasks.forEach(task => {
      const parentId = getParentTaskId(task);
      if (!groups[parentId]) {
        groups[parentId] = [];
      }
      groups[parentId].push(task);
    });
    
    return groups;
  }, [tasks]);

  // 🔥 获取所有父任务ID列表
  const parentTaskIds = useMemo(() => {
    return Object.keys(groupedByParentTask);
  }, [groupedByParentTask]);

  // 🔥 为每个父任务分配颜色（确定性分配，确保同一个父任务总是同一个颜色）
  const getParentTaskColor = (parentId: string) => {
    // 简单的哈希函数，将字符串映射到颜色索引
    let hash = 0;
    for (let i = 0; i < parentId.length; i++) {
      hash = parentId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PARENT_TASK_COLORS.length;
    return PARENT_TASK_COLORS[index];
  };

  // 🔥 获取父任务显示名称（截断或简化）
  const getParentTaskDisplayName = (parentId: string, tasksInGroup: TaskWithDetails[]) => {
    // 尝试从第一个任务的relatedDailyTask获取更友好的名称
    const firstTask = tasksInGroup[0];
    if (firstTask?.relatedDailyTask?.coreCommand) {
      const coreCommand = firstTask.relatedDailyTask.coreCommand;
      // 截断过长的指令
      return coreCommand.length > 30 ? coreCommand.substring(0, 30) + '...' : coreCommand;
    }
    // 如果没有，使用父任务ID的简化版本
    return parentId.length > 20 ? parentId.substring(0, 20) + '...' : parentId;
  };

  // 🔥 获取需要关注的任务（待处理 + 进行中 + 待确认）
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

  // 🔥 获取已完成可发布的任务
  const publishableTasks = useMemo(() => {
    return tasks.filter(t => t.status === 'completed');
  }, [tasks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-sky-100/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 p-3 shadow-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">
                任务时间线
              </h1>
              <p className="text-muted-foreground mt-1">
                {viewMode === 'timeline' 
                  ? '按时间分组查看所有任务，历史任务自动折叠' 
                  : '按父任务分组，快速识别子任务归属'
                }
              </p>
            </div>
          </div>
          
          {/* 视图模式切换 */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="flex items-center gap-1"
            >
              <ListIcon className="w-4 h-4" />
              <span className="hidden sm:inline">时间线</span>
            </Button>
            <Button
              variant={viewMode === 'parent-group' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('parent-group')}
              className="flex items-center gap-1"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">按父任务</span>
            </Button>
          </div>
        </div>

        {/* 🔥🔥🔥 我的待办高亮区（最醒目！） */}
        {!loading && actionableTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-2 shadow-lg">
                <ListTodo className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                需要你处理的任务
              </h2>
              <Badge className="bg-amber-100 text-amber-700 font-semibold px-2.5 py-1">
                {actionableTasks.length} 项待处理
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {actionableTasks.slice(0, 6).map((task) => {
                const statusInfo = getStatusInfo(task.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <Card 
                    key={task.id} 
                    className={`border-2 overflow-hidden transition-all hover:shadow-lg ${
                      task.status === 'waiting_user' 
                        ? 'border-purple-300 bg-purple-50/80' 
                        : task.status === 'in_progress'
                          ? 'border-blue-300 bg-blue-50/80'
                          : 'border-amber-200 bg-amber-50/60'
                    }`}
                  >
                    {/* 状态条 */}
                    <div className={`h-1.5 ${
                      task.status === 'waiting_user' ? 'bg-purple-500' :
                      task.status === 'in_progress' ? 'bg-blue-500' : 'bg-amber-400'
                    }`} />
                    
                    <CardContent className="pt-4 pb-4">
                      {/* 任务序号 + 状态 */}
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                          #{task.orderIndex}
                        </Badge>
                        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          task.status === 'waiting_user' ? 'bg-purple-100 text-purple-700' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                          {task.status === 'in_progress' && (
                            <Loader2 className="w-3 h-3 animate-spin ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* 🔥 标题（大字加粗） */}
                      <h3 className="font-bold text-base text-gray-900 mb-2 line-clamp-2 leading-snug">
                        {task.taskTitle || `子任务 #${task.orderIndex}`}
                      </h3>

                      {/* 主任务指令（如果有） */}
                      {task.relatedDailyTask?.coreCommand && (
                        <p className="text-xs text-gray-600 line-clamp-2 mb-3 bg-white/60 rounded p-2">
                          📋 {task.relatedDailyTask.coreCommand}
                        </p>
                      )}

                      {/* 执行者 + 时间 */}
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span>🤖 {task.executor}</span>
                        <span>{formatTime(task.createdAt)}</span>
                      </div>

                      {/* 操作按钮（根据状态） */}
                      {task.status === 'waiting_user' && (
                        <Link href={`/agent-task-manager?focus=${task.id}`} className="block">
                          <Button size="sm" className="w-full bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white text-sm h-9">
                            <Eye className="w-4 h-4 mr-1" />
                            去确认决策
                          </Button>
                        </Link>
                      )}
                      
                      {task.status === 'in_progress' && (
                        <div className="text-center py-1.5 text-sm text-blue-600 font-medium bg-blue-50 rounded-lg border border-blue-100">
                          <Loader2 className="w-4 h-4 inline mr-1 animate-spin" />
                          正在执行中...
                        </div>
                      )}

                      {task.status === 'pending' && (
                        <div className="text-center py-1.5 text-sm text-amber-700 font-medium bg-amber-50 rounded-lg border border-amber-100">
                          <Clock className="w-4 h-4 inline mr-1" />
                          排队等待中
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* 🔥 可发布任务提示（已完成但未发布的） */}
        {!loading && publishableTasks.length > 0 && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/70">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 p-2.5 shadow-md">
                    <Rocket className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-800">
                      有 {publishableTasks.length} 个任务已完成，可以发布到公众号
                    </p>
                    <p className="text-sm text-green-600 mt-0.5">
                      点击下方按钮进入发布就绪中心
                    </p>
                  </div>
                </div>
                <Link href="/task-timeline">
                  <Button className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white">
                    <Rocket className="w-4 h-4 mr-1" />
                    查看待发布任务
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧筛选区 */}
          <div className="lg:col-span-1 space-y-6">
            {/* Agent 选择 */}
            <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 p-2 shadow-md">
                    <Filter className="w-4 h-4 text-white" />
                  </div>
                  执行者筛选
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {AVAILABLE_AGENTS.map((agent) => (
                  <Button
                    key={agent.id}
                    variant={selectedAgent === agent.id ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSelectedAgent(agent.id)}
                  >
                    {agent.name}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* 统计卡片 */}
            <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">任务统计</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">总任务数</span>
                  <Badge variant="secondary">{tasks.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">进行中</span>
                  <Badge className="bg-blue-100 text-blue-700">
                    {tasks.filter(t => t.status === 'in_progress').length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">已完成</span>
                  <Badge className="bg-green-100 text-green-700">
                    {tasks.filter(t => t.status === 'completed').length}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧时间线 */}
          <div className="lg:col-span-3 space-y-6">
            {/* 状态筛选标签 */}
            <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
              <CardContent className="pt-6">
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
                    {STATUS_FILTERS.map((filter) => {
                      const Icon = filter.icon;
                      return (
                        <TabsTrigger key={filter.value} value={filter.value} className="flex items-center gap-1">
                          <Icon className="w-4 h-4" />
                          <span className="hidden sm:inline">{filter.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* 时间线/父任务分组列表 */}
            <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
              <CardContent className="pt-6">
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-sky-400" />
                    <p className="text-sm text-gray-500 mt-4">加载任务中...</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <ListTodo className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg font-medium text-gray-600">暂无任务</p>
                    <p className="text-sm text-gray-400 mt-1">当前筛选条件下没有任务</p>
                  </div>
                ) : viewMode === 'timeline' ? (
                  // 时间线视图
                  <ScrollArea className="h-[700px] pr-4">
                    <div className="space-y-6">
                      {Object.entries(groupedTasks).map(([group, groupTasks]) => {
                        if (groupTasks.length === 0) return null;
                        
                        const isExpanded = expandedGroups.has(group);
                        
                        return (
                          <div key={group} className="space-y-3">
                            {/* 分组标题 */}
                            <button
                              onClick={() => toggleGroup(group)}
                              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-sky-50/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-sky-400" />
                                <h3 className="font-semibold text-gray-700">
                                  {DATE_GROUP_LABELS[group as DateGroup]}
                                </h3>
                                <Badge variant="secondary" className="text-xs">
                                  {groupTasks.length} 个任务
                                </Badge>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </button>

                            {/* 分组内容 */}
                            {isExpanded && (
                              <div className="space-y-4 pl-8 border-l-2 border-sky-100 ml-4">
                                {groupTasks.map((task) => {
                                  const statusInfo = getStatusInfo(task.status);
                                  const StatusIcon = statusInfo.icon;
                                  const parentId = getParentTaskId(task);
                                  const taskColor = getParentTaskColor(parentId);
                                  
                                  return (
                                    <Card
                                      key={task.id}
                                      className={`border-2 ${taskColor.border} bg-white/80 hover:shadow-lg transition-all overflow-hidden`}
                                    >
                                      {/* 🔥 顶部状态条 */}
                                      <div className={`h-1.5 ${taskColor.dot}`} />
                                      
                                      <CardContent className="pt-5 pb-5">
                                        <div className="flex items-start gap-4">
                                          {/* 左侧：状态图标（放大） */}
                                          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${statusInfo.bgColor} flex items-center justify-center shadow-sm`}>
                                            <StatusIcon className={`w-6 h-6 ${statusInfo.color}`} />
                                          </div>
                                          
                                          <div className="flex-1 min-w-0 space-y-3">
                                            {/* 🔥 第一行：任务标题（放大+加粗） */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                              <h3 className="text-base font-bold text-gray-900 truncate">
                                                {task.taskTitle || `子任务 #${task.orderIndex}`}
                                              </h3>
                                              <Badge variant="outline" className="font-mono text-xs font-semibold">
                                                #{task.orderIndex}
                                              </Badge>
                                              <Badge className={`text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color} px-2 py-0.5`}>
                                                {statusInfo.label}
                                              </Badge>
                                            </div>

                                            {/* 🔥 第二行：主任务/原始指令（新增！） */}
                                            {task.relatedDailyTask?.coreCommand && (
                                              <div className={`${taskColor.bg} rounded-lg p-3 border ${taskColor.border}`}>
                                                <div className="flex items-start gap-2">
                                                  <Folder className={`w-4 h-4 ${taskColor.text} mt-0.5 flex-shrink-0`} />
                                                  <div className="min-w-0">
                                                    <p className={`text-xs font-medium ${taskColor.text} mb-1`}>
                                                      主任务指令
                                                    </p>
                                                    <p className="text-sm text-gray-700 line-clamp-2">
                                                      {task.relatedDailyTask.coreCommand}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {/* 🔥 第三行：任务描述 */}
                                            {task.taskDescription && (
                                              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                                {task.taskDescription}
                                              </p>
                                            )}
                                            
                                            {/* 🔥 第四行：元信息 + 操作按钮 */}
                                            <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100">
                                              {/* 左侧：元信息 */}
                                              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                  🤖 {task.executor}
                                                </span>
                                                <span>·</span>
                                                <span>🕐 {formatTime(task.createdAt)}</span>
                                                {task.progress > 0 && (
                                                  <>
                                                    <span>·</span>
                                                    <span className="font-medium text-sky-600">进度 {task.progress}%</span>
                                                  </>
                                                )}
                                              </div>

                                              {/* 右侧：状态驱动的操作按钮 */}
                                              <div className="flex items-center gap-2">
                                                {/* 待处理 → 提示等待 */}
                                                {task.status === 'pending' && (
                                                  <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    等待执行
                                                  </span>
                                                )}

                                                {/* 进行中 → 显示进度 */}
                                                {task.status === 'in_progress' && (
                                                  <span className="text-xs text-blue-600 font-medium flex items-center gap-1 animate-pulse">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    执行中...
                                                  </span>
                                                )}

                                                {/* 待确认 → 需要用户决策 */}
                                                {task.status === 'waiting_user' && (
                                                  <Link href={`/agent-task-manager?focus=${task.id}`}>
                                                    <Button 
                                                      size="sm" 
                                                      className="bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white text-xs h-7"
                                                    >
                                                      <Eye className="w-3 h-3 mr-1" />
                                                      去确认
                                                    </Button>
                                                  </Link>
                                                )}

                                                {/* 已完成 → 可发布 */}
                                                {task.status === 'completed' && (
                                                  <Link href={`/task-publish?taskId=${task.id}`}>
                                                    <Button 
                                                      size="sm" 
                                                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-xs h-7"
                                                    >
                                                      <Rocket className="w-3 h-3 mr-1" />
                                                      去发布
                                                    </Button>
                                                  </Link>
                                                )}

                                                {/* 失败 → 查看详情 */}
                                                {task.status === 'failed' && (
                                                  <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                                    <XCircle className="w-3 h-3" />
                                                    执行失败
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  // 🔥 父任务分组视图
                  <ScrollArea className="h-[700px] pr-4">
                    <div className="space-y-6">
                      {Object.entries(groupedByParentTask).map(([parentId, groupTasks]) => {
                        if (groupTasks.length === 0) return null;
                        
                        const isExpanded = expandedGroups.has(parentId);
                        const color = getParentTaskColor(parentId);
                        const displayName = getParentTaskDisplayName(parentId, groupTasks);
                        
                        return (
                          <div key={parentId} className="space-y-3">
                            {/* 父任务分组标题 */}
                            <button
                              onClick={() => toggleGroup(parentId)}
                              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 ${color.border} ${color.bg} hover:opacity-90 transition-all`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${color.dot}`} />
                                <div className="flex items-center gap-2">
                                  <Folder className={`w-5 h-5 ${color.text}`} />
                                  <h3 className={`font-semibold ${color.text}`}>
                                    {displayName}
                                  </h3>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {groupTasks.length} 个子任务
                                </Badge>
                              </div>
                              {isExpanded ? (
                                <ChevronUp className={`w-5 h-5 ${color.text}`} />
                              ) : (
                                <ChevronDown className={`w-5 h-5 ${color.text}`} />
                              )}
                            </button>

                            {/* 子任务列表 */}
                            {isExpanded && (
                              <div className="space-y-4 pl-8 border-l-2 border-sky-100 ml-4">
                                {groupTasks.map((task) => {
                                  const statusInfo = getStatusInfo(task.status);
                                  const StatusIcon = statusInfo.icon;
                                  const taskColor = getParentTaskColor(getParentTaskId(task));
                                  
                                  return (
                                    <Card
                                      key={task.id}
                                      className={`border-2 ${taskColor.border} bg-white/80 hover:shadow-lg transition-all overflow-hidden`}
                                    >
                                      {/* 🔥 顶部状态条 */}
                                      <div className={`h-1.5 ${taskColor.dot}`} />
                                      
                                      <CardContent className="pt-5 pb-5">
                                        <div className="flex items-start gap-4">
                                          {/* 左侧：状态图标（放大） */}
                                          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${statusInfo.bgColor} flex items-center justify-center shadow-sm`}>
                                            <StatusIcon className={`w-6 h-6 ${statusInfo.color}`} />
                                          </div>
                                          
                                          <div className="flex-1 min-w-0 space-y-3">
                                            {/* 🔥 第一行：任务标题（放大+加粗） */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                              <h3 className="text-base font-bold text-gray-900 truncate">
                                                {task.taskTitle || `子任务 #${task.orderIndex}`}
                                              </h3>
                                              <Badge variant="outline" className="font-mono text-xs font-semibold">
                                                #{task.orderIndex}
                                              </Badge>
                                              <Badge className={`text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color} px-2 py-0.5`}>
                                                {statusInfo.label}
                                              </Badge>
                                            </div>

                                            {/* 🔥 第二行：主任务/原始指令（新增！） */}
                                            {task.relatedDailyTask?.coreCommand && (
                                              <div className={`${taskColor.bg} rounded-lg p-3 border ${taskColor.border}`}>
                                                <div className="flex items-start gap-2">
                                                  <Folder className={`w-4 h-4 ${taskColor.text} mt-0.5 flex-shrink-0`} />
                                                  <div className="min-w-0">
                                                    <p className={`text-xs font-medium ${taskColor.text} mb-1`}>
                                                      主任务指令
                                                    </p>
                                                    <p className="text-sm text-gray-700 line-clamp-2">
                                                      {task.relatedDailyTask.coreCommand}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {/* 🔥 第三行：任务描述 */}
                                            {task.taskDescription && (
                                              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                                                {task.taskDescription}
                                              </p>
                                            )}
                                            
                                            {/* 🔥 第四行：元信息 + 操作按钮 */}
                                            <div className="flex items-center justify-between gap-4 pt-2 border-t border-gray-100">
                                              {/* 左侧：元信息 */}
                                              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                  🤖 {task.executor}
                                                </span>
                                                <span>·</span>
                                                <span>🕐 {formatTime(task.createdAt)}</span>
                                                {task.progress > 0 && (
                                                  <>
                                                    <span>·</span>
                                                    <span className="font-medium text-sky-600">进度 {task.progress}%</span>
                                                  </>
                                                )}
                                              </div>

                                              {/* 右侧：状态驱动的操作按钮 */}
                                              <div className="flex items-center gap-2">
                                                {/* 待处理 → 提示等待 */}
                                                {task.status === 'pending' && (
                                                  <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    等待执行
                                                  </span>
                                                )}

                                                {/* 进行中 → 显示进度 */}
                                                {task.status === 'in_progress' && (
                                                  <span className="text-xs text-blue-600 font-medium flex items-center gap-1 animate-pulse">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    执行中...
                                                  </span>
                                                )}

                                                {/* 待确认 → 需要用户决策 */}
                                                {task.status === 'waiting_user' && (
                                                  <Link href={`/agent-task-manager?focus=${task.id}`}>
                                                    <Button 
                                                      size="sm" 
                                                      className="bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white text-xs h-7"
                                                    >
                                                      <Eye className="w-3 h-3 mr-1" />
                                                      去确认
                                                    </Button>
                                                  </Link>
                                                )}

                                                {/* 已完成 → 可发布 */}
                                                {task.status === 'completed' && (
                                                  <Link href={`/task-publish?taskId=${task.id}`}>
                                                    <Button 
                                                      size="sm" 
                                                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white text-xs h-7"
                                                    >
                                                      <Rocket className="w-3 h-3 mr-1" />
                                                      去发布
                                                    </Button>
                                                  </Link>
                                                )}

                                                {/* 失败 → 查看详情 */}
                                                {task.status === 'failed' && (
                                                  <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                                    <XCircle className="w-3 h-3" />
                                                    执行失败
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}