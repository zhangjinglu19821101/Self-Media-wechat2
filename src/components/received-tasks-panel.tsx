'use client';

/**
 * ReceivedTasksPanel - 接收到的任务面板组件
 * 显示发送给当前 Agent 的任务列表，并提供反馈执行结果的功能
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubmitCommandResultDialog } from '@/components/submit-command-result-dialog';
import { RefreshCw, Clock, CheckCircle2, XCircle, Loader2, Play } from 'lucide-react';
import { formatBeijingTime, formatRelativeTime } from '@/lib/utils/date-time';
import { toast } from 'sonner';

interface ReceivedTasksPanelProps {
  agentId: string;
}

interface Task {
  id: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  command: string;
  commandType: string;
  priority: string;
  status: string;
  result: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function ReceivedTasksPanel({ agentId }: ReceivedTasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  // 加载接收到的任务
  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/agents/${agentId}/tasks?role=to&limit=50`
      );
      const data = await response.json();

      if (data.success) {
        const newTasks = data.data.tasks;

        // 检查是否有新完成的任务（之前不在列表中）
        const previousCompletedCount = tasks.filter(t => t.status === 'completed').length;
        const newCompletedCount = newTasks.filter(t => t.status === 'completed').length;

        // 如果有新完成的任务，自动切换到"已完成"标签
        if (newCompletedCount > previousCompletedCount) {
          setActiveTab('completed');
          toast.success('有任务已完成！');
        }

        setTasks(newTasks);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载 + 页面可见性刷新
  useEffect(() => {
    loadTasks();

    // 🔥 优化：使用页面可见性 API 替代定时轮询
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTasks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [agentId]);

  // 过滤任务
  const filteredTasks = tasks.filter((task) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return task.status === 'pending';
    if (activeTab === 'in_progress') return task.status === 'in_progress';
    if (activeTab === 'completed') return task.status === 'completed';
    if (activeTab === 'failed') return task.status === 'failed';
    return true;
  });

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: '待处理',
          icon: Clock,
          variant: 'secondary' as const,
          color: 'text-gray-500',
        };
      case 'in_progress':
        return {
          label: '进行中',
          icon: Clock,
          variant: 'default' as const,
          color: 'text-blue-500',
        };
      case 'completed':
        return {
          label: '已完成',
          icon: CheckCircle2,
          variant: 'default' as const,
          color: 'text-green-500',
        };
      case 'failed':
        return {
          label: '失败',
          icon: XCircle,
          variant: 'destructive' as const,
          color: 'text-red-500',
        };
      default:
        return {
          label: status,
          icon: Clock,
          variant: 'secondary' as const,
          color: 'text-gray-500',
        };
    }
  };

  // 处理反馈执行结果
  const handleSubmitResult = (task: Task) => {
    setSelectedTask(task);
    setShowResultDialog(true);
  };

  // 开始执行任务
  const handleStartTask = async (task: Task) => {
    try {
      const response = await fetch(`/api/agents/tasks/${task.taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('任务已开始执行');
        loadTasks(); // 刷新任务列表
      } else {
        toast.error(data.error || '更新任务状态失败');
      }
    } catch (error) {
      console.error('开始执行任务失败:', error);
      toast.error('更新任务状态失败');
    }
  };

  // 提交结果成功后刷新
  const handleResultSuccess = () => {
    setShowResultDialog(false);
    setSelectedTask(null);
    loadTasks();
  };

  const timeAgo = (dateStr: string) => {
    try {
      return formatRelativeTime(dateStr);
    } catch {
      return '未知时间';
    }
  };

  return (
    <Card className="w-full mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">接收到的任务</CardTitle>
            <CardDescription className="text-xs">
              来自 Agent A 的指令和任务
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadTasks}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* 统计信息 */}
        {stats && (
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <Badge variant="secondary" className="text-xs">
              总计: {stats.total}
            </Badge>
            <Badge variant="outline" className="text-xs text-gray-500">
              待处理: {stats.pending}
            </Badge>
            <Badge variant="outline" className="text-xs text-blue-500">
              进行中: {stats.inProgress}
            </Badge>
            <Badge variant="outline" className="text-xs text-green-500">
              已完成: {stats.completed}
            </Badge>
            <Badge variant="outline" className="text-xs text-red-500">
              失败: {stats.failed}
            </Badge>
          </div>
        )}

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="pending" className="text-xs">
              待处理
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="text-xs">
              进行中
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">
              已完成
            </TabsTrigger>
            <TabsTrigger value="failed" className="text-xs">
              失败
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              全部
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {loading && filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            暂无任务
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {filteredTasks.map((task) => {
                const statusConfig = getStatusConfig(task.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <Card key={task.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {/* 任务头部 */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500">
                                来自 {task.fromAgentId}
                              </span>
                              {task.taskId && (
                                <Badge variant="outline" className="text-xs">
                                  {task.taskId.slice(-12)}
                                </Badge>
                              )}
                              <Badge
                                variant={statusConfig.variant}
                                className="text-xs"
                              >
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400">
                              {timeAgo(task.createdAt)}
                            </p>
                          </div>
                        </div>

                        {/* 任务内容 */}
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-sm whitespace-pre-wrap">{task.command}</p>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {task.priority} 优先级
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {task.commandType}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {task.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleStartTask(task)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                开始执行
                              </Button>
                            )}
                            {task.status === 'in_progress' && (
                              <Button
                                size="sm"
                                onClick={() => handleSubmitResult(task)}
                              >
                                反馈执行结果
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* 执行结果（如果有） */}
                        {task.result && (
                          <div className="bg-green-50 p-3 rounded border border-green-200">
                            <p className="text-xs font-medium text-green-800 mb-1">
                              执行结果:
                            </p>
                            <p className="text-sm text-green-700">{task.result}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* 执行结果对话框 */}
      {selectedTask && (
        <SubmitCommandResultDialog
          open={showResultDialog}
          onOpenChange={setShowResultDialog}
          taskId={selectedTask.taskId}
          commandId={selectedTask.taskId}
          fromAgentId={agentId}
          toAgentId="A"
          originalCommand={selectedTask.command}
          onSuccess={handleResultSuccess}
        />
      )}
    </Card>
  );
}
