'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ListTodo,
  UserCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  Settings,
  FileText,
  Code2,
  RefreshCw,
  Edit3,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  AlignLeft
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { AgentTaskList } from '@/components/agent-task-list';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { StepHistoryCard, type StepHistoryItem } from '@/components/step-history-card';

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

export default function AgentTaskManagerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <AgentTaskManagerContent />
    </Suspense>
  );
}

function AgentTaskManagerContent() {
  const searchParams = useSearchParams();
  const [selectedAgent, setSelectedAgent] = useState<string>('B');
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [userDecisionContent, setUserDecisionContent] = useState('');
  const [selectedDecisionOption, setSelectedDecisionOption] = useState<string>('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  const AVAILABLE_AGENTS = [
    { id: 'A', name: '战略决策者 A' },
    { id: 'B', name: '技术官 B' },
    { id: 'T', name: '技术专家 T' },
    { id: 'C', name: '数据分析师 C' },
    { id: 'D', name: '内容创作者 D' },
    { id: 'insurance-c', name: '保险运营 insurance-c' },
    { id: 'insurance-d', name: '保险作者 insurance-d' },
  ];

  // 通过任务ID直接获取任务详情
  const fetchTaskById = async (taskId: string) => {
    try {
      console.log(`🔍 直接获取任务详情，任务ID: ${taskId}`);
      const response = await fetch(`/api/agents/tasks/${taskId}/detail`);
      const data = await response.json();

      if (data.success) {
        const task = data.data.task;
        // 转换为 TaskWithDetails 格式
        const formattedTask: TaskWithDetails = {
          id: task.id,
          taskId: task.id,
          taskTitle: task.taskTitle,
          taskDescription: task.taskDescription,
          status: task.status,
          executor: task.executor,
          priority: task.priority,
          orderIndex: task.orderIndex,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
          progress: task.progress,
          metadata: task.metadata || {},
          relatedDailyTask: task.relatedDailyTask
        };
        
        console.log(`✅ 获取到焦点任务:`, formattedTask);
        
        // 自动设置对应的 Agent
        const taskExecutor = formattedTask.executor;
        const matchedAgent = AVAILABLE_AGENTS.find(a => a.id === taskExecutor);
        if (matchedAgent) {
          setSelectedAgent(matchedAgent.id);
        }
        
        setSelectedTask(formattedTask);
        setShowTaskDetails(true);
        return true;
      } else {
        console.warn(`⚠️ 获取焦点任务失败: ${data.error}`);
        return false;
      }
    } catch (error) {
      console.error('❌ 获取焦点任务失败:', error);
      return false;
    }
  };

  // 加载任务列表
  const loadTasks = async (agentId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/agents/${agentId}/tasks`);
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
    loadTasks(selectedAgent);
  }, [selectedAgent]);

  // 处理 URL 参数中的 focus 任务
  useEffect(() => {
    const focusId = searchParams?.get('focus');
    if (focusId && focusId !== focusTaskId) {
      console.log(`🎯 检测到 URL focus 参数: ${focusId}`);
      setFocusTaskId(focusId);
      fetchTaskById(focusId);
    }
  }, [searchParams]);

  // 获取状态信息
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
      default:
        return { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100', label: '待执行' };
    }
  };

  // 提交用户决策
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

      const response = await fetch('/api/agents/user-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subTaskId: selectedTask.id,
          commandResultId: selectedTask.relatedDailyTask?.id || selectedTask.id,
          userDecision: userDecisionContent,
          decisionType: selectedDecisionOption || 'redecision',
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('用户决策已提交');
        console.log('✅ 用户决策提交成功:', data);
        
        // 重置表单
        setUserDecisionContent('');
        setSelectedDecisionOption('');
        setSelectedTask(null);
        
        // 刷新任务列表
        await loadTasks(selectedAgent);
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

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">🎯 Agent 任务管理中心</CardTitle>
          <CardDescription>
            统一管理所有 Agent 的任务、查看原始指令、进行用户决策
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：任务列表 */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                <ListTodo className="w-5 h-5 mr-2 inline" />
                选择 Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {AVAILABLE_AGENTS.map((agent) => (
                <Button
                  key={agent.id}
                  variant={selectedAgent === agent.id ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setSelectedAgent(agent.id)}
                >
                  {agent.name}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                <ListTodo className="w-5 h-5 mr-2 inline" />
                任务列表
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400" />
                  <p className="text-sm text-gray-500 mt-2">加载中...</p>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ListTodo className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>暂无任务</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {tasks.map((task) => {
                      const statusInfo = getStatusInfo(task.status);
                      const StatusIcon = statusInfo.icon;
                      
                      return (
                        <Card
                          key={task.id}
                          className={`cursor-pointer transition-all hover:shadow-md hover:shadow-slate-100/50 ${
                            selectedTask?.id === task.id ? 'border-2 border-sky-500 ring-2 ring-sky-100' : 'border border-slate-200'
                          }`}
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskDetails(true);
                          }}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full ${statusInfo.bgColor} flex items-center justify-center`}>
                                <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-sm truncate">
                                    {task.taskTitle}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    #{task.orderIndex}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2">
                                  {task.taskDescription}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {task.executor}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {statusInfo.label}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：任务详情和用户决策 */}
        <div className="lg:col-span-2 space-y-6">
          {selectedTask ? (
            <>
              {/* 任务详情卡片 */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Eye className="w-4 h-4 text-slate-600" />
                      </div>
                      任务详情
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTask(null);
                        setShowTaskDetails(false);
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 执行概览 */}
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-xl flex items-center justify-center">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{selectedTask.executor}</p>
                        <p className="text-xs text-slate-500">执行者</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 bg-white rounded-lg border border-slate-100">
                        <p className="text-lg font-bold text-slate-900">{selectedTask.orderIndex}</p>
                        <p className="text-xs text-slate-500">执行顺序</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded-lg border border-slate-100">
                        <Badge variant="outline" className="text-xs">
                          {getStatusInfo(selectedTask.status).label}
                        </Badge>
                        <p className="text-xs text-slate-500 mt-1">状态</p>
                      </div>
                      <div className="text-center p-2 bg-white rounded-lg border border-slate-100">
                        <p className="text-lg font-bold text-slate-900">{selectedTask.priority}</p>
                        <p className="text-xs text-slate-500">优先级</p>
                      </div>
                    </div>
                  </div>

                  {/* 任务描述 */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-2 block">任务描述</label>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm whitespace-pre-wrap">{selectedTask.taskDescription}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 原始指令 */}
                  {(selectedTask.metadata?.originalCommand || selectedTask.relatedDailyTask?.coreCommand) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-500">原始指令</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowTaskDetails(!showTaskDetails)}
                        >
                          {showTaskDetails ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {showTaskDetails && (
                        <Card className="bg-amber-50 border-amber-200">
                          <CardContent className="pt-4">
                            <ScrollArea className="h-[300px]">
                              <pre className="text-xs whitespace-pre-wrap font-mono">
                                {selectedTask.metadata?.originalCommand || selectedTask.relatedDailyTask?.coreCommand}
                              </pre>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* 验收标准 */}
                  {selectedTask.metadata?.acceptanceCriteria && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">验收标准</label>
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-sm whitespace-pre-wrap">
                            {selectedTask.metadata.acceptanceCriteria}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* 交互历史时间线 */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-sky-500" />
                        交互时间线
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {(selectedTask as any).stepHistory?.length || 0} 个步骤
                      </Badge>
                    </div>
                    
                    {(selectedTask as any).stepHistory && (selectedTask as any).stepHistory.length > 0 ? (
                      <div className="space-y-4">
                        {(selectedTask as any).stepHistory.map((step: StepHistoryItem, index: number, arr: StepHistoryItem[]) => (
                          <StepHistoryCard
                            key={step.id}
                            step={step}
                            isLast={index === arr.length - 1}
                          />
                        ))}
                      </div>
                    ) : (
                      <Card className="bg-slate-50 border-slate-200">
                        <CardContent className="pt-6 pb-6 text-center">
                          <p className="text-sm text-slate-500">暂无交互记录</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 用户决策卡片 */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-sky-600" />
                    </div>
                    用户决策
                  </CardTitle>
                  <CardDescription className="text-xs">
                    基于交互历史进行决策
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 决策选项 */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={selectedDecisionOption === 'redecision' ? 'default' : 'outline'}
                      onClick={() => setSelectedDecisionOption('redecision')}
                      className={`justify-start text-sm h-10 ${
                        selectedDecisionOption === 'redecision' 
                          ? 'bg-sky-600 hover:bg-sky-700' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重新执行
                    </Button>
                    <Button
                      variant={selectedDecisionOption === 'waiting_user' ? 'default' : 'outline'}
                      onClick={() => setSelectedDecisionOption('waiting_user')}
                      className={`justify-start text-sm h-10 ${
                        selectedDecisionOption === 'waiting_user' 
                          ? 'bg-sky-600 hover:bg-sky-700' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      标记完成
                    </Button>
                  </div>

                  {/* 决策内容 */}
                  <div>
                    <Label className="text-xs text-slate-500">决策意见（可选）</Label>
                    <Textarea
                      value={userDecisionContent}
                      onChange={(e) => setUserDecisionContent(e.target.value)}
                      placeholder="输入你的决策理由或建议..."
                      rows={4}
                      className="mt-1 text-sm resize-none"
                    />
                  </div>

                  {/* 提交按钮 */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={submitUserDecision}
                      disabled={!userDecisionContent.trim() || isSubmittingDecision}
                      className="flex-1 bg-sky-600 hover:bg-sky-700"
                    >
                      {isSubmittingDecision ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          提交中...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          提交决策
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUserDecisionContent('');
                        setSelectedDecisionOption('');
                      }}
                      className="border-slate-200 hover:bg-slate-50"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <CardContent className="text-center">
                <ListTodo className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">选择一个任务</h3>
                <p className="text-gray-500">从左侧任务列表中选择一个任务查看详情</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
