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

interface StepHistoryItem {
  id: string;
  stepNo: number;
  interactNum: number;
  interactType: string;
  interactUser: string;
  interactTime: string;
  interactContent: {
    interact_type: string;
    consultant: string;
    responder: string;
    question: string | Record<string, any>;
    response: string | Record<string, any>;
    execution_result?: {
      status: string;
      error_msg?: string;
    };
    ext_info?: Record<string, any>;
  };
}

// 步骤卡片组件 - 使用 Slate + Sky 配色（与主页一致）
function StepHistoryCard({ step, isLast }: { step: StepHistoryItem; isLast: boolean }) {
  const [isExpanded, setIsExpanded] = useState(step.interactUser === 'agent B');

  // 判断是否为 Agent B 评审
  const isAgentBReview = step.interactUser === 'agent B';
  
  // 提取决策信息
  const response = typeof step.interactContent.response === 'object' 
    ? step.interactContent.response 
    : {};
  const decisionType = response?.type || '';
  const reasoning = response?.reasoning || '';
  const riskLevel = response?.context?.riskLevel || '';
  
  // 提取三个关键字段（执行Agent的核心输出）
  const briefResponse = response?.briefResponse || '';
  const selfEvaluation = response?.selfEvaluation || '';
  const actionsTaken = response?.actionsTaken || [];
  
  // 格式化时间
  const formatTime = (time: string) => {
    return new Date(time).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 获取决策者图标和样式（统一使用 Sky 色系）
  const getAgentIcon = (user: string) => {
    switch (user) {
      case 'agent B': return <Bot className="w-5 h-5" />;
      case 'insurance-d': return <FileText className="w-5 h-5" />;
      case 'system': return <Settings className="w-5 h-5" />;
      case 'human': return <User className="w-5 h-5" />;
      default: return <Bot className="w-5 h-5" />;
    }
  };

  // 获取决策类型徽章样式（使用 Slate 色系，Agent B 用 Sky 强调）
  const getDecisionBadge = (type: string) => {
    switch (type) {
      case 'COMPLETE':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'NEED_USER':
        return isAgentBReview ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-700 border-slate-200';
      case 'FAILED':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="relative">
      {/* 时间线连接 */}
      {!isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-px bg-slate-200" />
      )}
      
      <Card className={`
        group relative overflow-hidden transition-all duration-300
        ${isAgentBReview ? 'border-l-4 border-l-sky-500' : 'border border-slate-200'}
        hover:shadow-md hover:shadow-slate-100/50
      `}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                {/* 左侧：图标 + 标题 */}
                <div className="flex items-start gap-3">
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isAgentBReview ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600'}
                  `}>
                    {getAgentIcon(step.interactUser)}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">
                        {step.interactUser === 'agent B' ? 'Agent B 评审' : `${step.interactUser} 执行`}
                      </h4>
                      {decisionType && (
                        <Badge variant="outline" className={`text-xs ${getDecisionBadge(decisionType)}`}>
                          {decisionType}
                        </Badge>
                      )}
                    </div>
                    
                    {reasoning && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                        {reasoning}
                      </p>
                    )}
                    
                    {!reasoning && typeof step.interactContent.question === 'string' && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                        {step.interactContent.question.substring(0, 80)}...
                      </p>
                    )}
                  </div>
                </div>

                {/* 右侧：时间 + 展开按钮 */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">
                    {formatTime(step.interactTime)}
                  </span>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <div className="pl-13 space-y-4">
                {/* 🌟 系统亮点：执行Agent核心输出 - 三个关键字段高亮展示 */}
                {(briefResponse || selfEvaluation || actionsTaken.length > 0) && (
                  <div className="relative">
                    {/* 亮点标识标签 */}
                    <div className="absolute -top-2 left-4 px-2 py-0.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-medium rounded-full shadow-sm">
                      AI 智能分析
                    </div>
                    
                    <div className="bg-gradient-to-br from-sky-50/80 via-slate-50/50 to-white rounded-xl p-5 border border-sky-200/60 shadow-sm">
                      {/* 简要回应 - 最重要的输出 */}
                      {briefResponse && (
                        <div className="mb-4 pb-4 border-b border-sky-200/50">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shadow-sm">
                              <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <Label className="text-sm font-semibold text-slate-900">简要回应</Label>
                              <p className="text-xs text-slate-500">核心结论与观点</p>
                            </div>
                          </div>
                          <div className="pl-10">
                            <p className="text-sm text-slate-800 leading-relaxed bg-white/60 rounded-lg p-3 border border-sky-100">
                              {briefResponse}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* 自我评估 - 智能反思 */}
                      {selfEvaluation && (
                        <div className="mb-4 pb-4 border-b border-slate-200/50">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <Label className="text-sm font-semibold text-slate-900">自我评估</Label>
                              <p className="text-xs text-slate-500">质量反思与优化建议</p>
                            </div>
                          </div>
                          <div className="pl-10">
                            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/80 rounded-lg p-3 border border-slate-200">
                              {selfEvaluation}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* 已执行动作 - 执行轨迹 */}
                      {actionsTaken.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <ListTodo className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <Label className="text-sm font-semibold text-slate-900">已执行动作</Label>
                              <p className="text-xs text-slate-500">分步骤执行轨迹</p>
                            </div>
                          </div>
                          <div className="pl-10 space-y-2">
                            {actionsTaken.map((action: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-3 text-sm group">
                                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center flex-shrink-0 text-xs text-white font-bold shadow-sm group-hover:shadow-md transition-shadow">
                                  {idx + 1}
                                </span>
                                <span className="text-slate-700 leading-relaxed pt-0.5">{action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Agent B 评审信息高亮展示 */}
                {isAgentBReview && decisionType && (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-sky-600" />
                      </div>
                      <span className="font-medium text-slate-900">评审决策</span>
                    </div>
                    
                    {reasoning && (
                      <div className="mb-3">
                        <Label className="text-xs text-slate-500">评审理由</Label>
                        <p className="text-sm text-slate-700 mt-1">{reasoning}</p>
                      </div>
                    )}
                    
                    {riskLevel && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-slate-500">风险等级</Label>
                        <Badge variant="outline" className="text-xs">
                          {riskLevel}
                        </Badge>
                      </div>
                    )}
                    
                    {response?.context?.suggestedAction && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <Label className="text-xs text-slate-500">建议操作</Label>
                        <p className="text-sm text-slate-700 mt-1">{response.context.suggestedAction}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 执行结果 */}
                {step.interactContent.execution_result && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">执行结果:</span>
                    <Badge variant="outline" className="text-xs">
                      {step.interactContent.execution_result.status}
                    </Badge>
                    {step.interactContent.execution_result.error_msg && (
                      <span className="text-xs text-red-600">
                        {step.interactContent.execution_result.error_msg}
                      </span>
                    )}
                  </div>
                )}

                {/* 开发者工具：完整 JSON 查看 */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700 border-slate-200 hover:bg-slate-50"
                    >
                      <Code2 className="w-3 h-3 mr-2" />
                      查看完整 JSON 数据（开发者模式）
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                      {/* JSON 头部工具栏 */}
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                          </div>
                          <span className="text-xs text-slate-400 ml-2 font-mono">interact_content.json</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                          {JSON.stringify(step.interactContent).length} bytes
                        </Badge>
                      </div>
                      {/* JSON 内容 */}
                      <div className="p-4 overflow-x-auto max-h-96 overflow-y-auto">
                        <pre className="text-xs text-slate-300 font-mono leading-relaxed">
                          {JSON.stringify(step.interactContent, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
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
