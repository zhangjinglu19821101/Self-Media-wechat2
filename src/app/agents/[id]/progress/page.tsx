'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, CheckCircle2, Clock, AlertCircle, Circle } from 'lucide-react';
import Link from 'next/link';
import { formatBeijingTime } from '@/lib/utils/date-time';

interface Task {
  id: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  command: string;
  commandType: string;
  priority: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  metadata?: {
    conversationId?: string;
    sessionId?: string;
    progress?: Array<{
      timestamp: string;
      content: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface TaskStats {
  sent: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
  received: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
}

export default function AgentProgressPage() {
  const params = useParams();
  const agentId = params.id as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // 获取 Agent 名称
  const getAgentName = (id: string) => {
    const agentNames: Record<string, string> = {
      A: '总裁（A）',
      B: '技术负责人（B）',
      C: 'AI运营（C）',
      D: 'AI内容（D）',
      'insurance-c': '保险运营（C）',
      'insurance-d': '保险内容（D）',
    };
    return agentNames[id] || id;
  };

  // 获取状态图标和颜色
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Circle className="h-4 w-4 text-gray-400" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待处理';
      case 'in_progress':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">高优先级</Badge>;
      case 'normal':
        return <Badge variant="default">普通</Badge>;
      case 'low':
        return <Badge variant="secondary">低优先级</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // 加载任务列表
  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/list?agentId=${agentId}`);
      const data = await response.json();
      if (data.success) {
        setTasks(data.data.tasks);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('加载任务列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [agentId]);

  // 过滤任务
  const sentTasks = tasks.filter((t) => t.fromAgentId === agentId);
  const receivedTasks = tasks.filter((t) => t.toAgentId === agentId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/agents/${agentId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {getAgentName(agentId)} - 工作进展
              </h1>
              <p className="text-gray-600 mt-1">
                查看 {getAgentName(agentId)} 的任务执行情况
              </p>
            </div>
          </div>
          <Button onClick={loadTasks} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>下达任务</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.sent.total}</div>
                <div className="text-xs text-gray-500 mt-1">
                  已完成: {stats.sent.completed} / 进行中: {stats.sent.inProgress}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>接收任务</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.received.total}</div>
                <div className="text-xs text-gray-500 mt-1">
                  已完成: {stats.received.completed} / 进行中: {stats.received.inProgress}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>待处理</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-600">
                  {stats.received.pending}
                </div>
                <div className="text-xs text-gray-500 mt-1">接收但未开始的任务</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>进行中</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.received.inProgress}
                </div>
                <div className="text-xs text-gray-500 mt-1">正在执行的任务</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 任务列表 */}
        <Tabs defaultValue="received" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received">
              接收的任务 ({receivedTasks.length})
            </TabsTrigger>
            <TabsTrigger value="sent">
              下达的任务 ({sentTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="space-y-4">
            {receivedTasks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-gray-500">暂无接收的任务</div>
                </CardContent>
              </Card>
            ) : (
              receivedTasks.map((task) => (
                <TaskCard
                  key={task.taskId}
                  task={task}
                  getAgentName={getAgentName}
                  getStatusIcon={getStatusIcon}
                  getStatusText={getStatusText}
                  getStatusColor={getStatusColor}
                  getPriorityBadge={getPriorityBadge}
                  onViewDetails={() => setSelectedTask(task)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-4">
            {sentTasks.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-gray-500">暂无下达的任务</div>
                </CardContent>
              </Card>
            ) : (
              sentTasks.map((task) => (
                <TaskCard
                  key={task.taskId}
                  task={task}
                  getAgentName={getAgentName}
                  getStatusIcon={getStatusIcon}
                  getStatusText={getStatusText}
                  getStatusColor={getStatusColor}
                  getPriorityBadge={getPriorityBadge}
                  onViewDetails={() => setSelectedTask(task)}
                />
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* 任务详情对话框 */}
        {selectedTask && (
          <TaskDetailDialog
            task={selectedTask}
            getAgentName={getAgentName}
            getStatusIcon={getStatusIcon}
            getStatusText={getStatusText}
            getStatusColor={getStatusColor}
            getPriorityBadge={getPriorityBadge}
            onClose={() => setSelectedTask(null)}
          />
        )}
      </div>
    </div>
  );
}

// 任务卡片组件
function TaskCard({
  task,
  getAgentName,
  getStatusIcon,
  getStatusText,
  getStatusColor,
  getPriorityBadge,
  onViewDetails,
}: any) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusIcon(task.status)}
              <span className="font-semibold">
                {task.fromAgentId === task.toAgentId
                  ? '自下达任务'
                  : `来自 ${getAgentName(task.fromAgentId)} 的指令`}
              </span>
              <Badge className={getStatusColor(task.status)}>
                {getStatusText(task.status)}
              </Badge>
              {getPriorityBadge(task.priority)}
            </div>
            <div className="text-xs text-gray-500">
              任务ID: {task.taskId} | 接收时间: {formatBeijingTime(task.createdAt)}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onViewDetails}>
            查看详情
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm whitespace-pre-wrap line-clamp-3">{task.command}</p>
        </div>
        {task.metadata?.progress && task.metadata.progress.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-1">最新进展:</div>
            <div className="bg-blue-50 p-2 rounded text-xs text-blue-700">
              {task.metadata.progress[task.metadata.progress.length - 1].content}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 任务详情对话框组件
function TaskDetailDialog({
  task,
  getAgentName,
  getStatusIcon,
  getStatusText,
  getStatusColor,
  getPriorityBadge,
  onClose,
}: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">任务详情</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>

          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusIcon(task.status)}
              <span className="font-semibold">
                来自 {getAgentName(task.fromAgentId)} 的指令
              </span>
              <Badge className={getStatusColor(task.status)}>
                {getStatusText(task.status)}
              </Badge>
              {getPriorityBadge(task.priority)}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">任务ID</div>
                <div className="font-mono text-xs">{task.taskId}</div>
              </div>
              <div>
                <div className="text-gray-500">创建时间</div>
                <div>{formatBeijingTime(task.createdAt)}</div>
              </div>
              <div>
                <div className="text-gray-500">更新时间</div>
                <div>{formatBeijingTime(task.updatedAt)}</div>
              </div>
              <div>
                <div className="text-gray-500">完成时间</div>
                <div>
                  {task.completedAt
                    ? formatBeijingTime(task.completedAt)
                    : '未完成'}
                </div>
              </div>
            </div>

            {/* 指令内容 */}
            <div>
              <h3 className="font-semibold mb-2">指令内容</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{task.command}</p>
              </div>
            </div>

            {/* 执行结果 */}
            {task.result && (
              <div>
                <h3 className="font-semibold mb-2">执行结果</h3>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{task.result}</p>
                </div>
              </div>
            )}

            {/* 进展记录 */}
            {task.metadata?.progress && task.metadata.progress.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">进展记录</h3>
                <div className="space-y-2">
                  {task.metadata.progress.map((entry: any, index: number) => (
                    <div key={index} className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500 mb-1">
                        {formatBeijingTime(entry.timestamp)}
                      </div>
                      <p className="text-sm">{entry.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
