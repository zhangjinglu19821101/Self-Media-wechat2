/**
 * Agent 任务列表组件
 * 显示指定 Agent 的待执行任务列表
 */

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Clock, AlertTriangle, ChevronRight, ListTodo, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Task {
  id: string;
  taskTitle: string;
  taskDescription: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'high' | 'normal' | 'low';
  orderIndex: number;
  isCritical: boolean;
  executor: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
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
  };
}

interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  critical: number;
}

interface AgentTaskListProps {
  agentId: string;
  showPanel: boolean;
  onTogglePanel?: () => void;
}

export function AgentTaskList({ agentId, showPanel, onTogglePanel }: AgentTaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);

  // 加载任务列表
  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/agents/${agentId}/tasks`);
      const data = await response.json();

      if (data.success) {
        setTasks(data.data.tasks);
        setStats(data.data.stats);
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

  // 🔥 优化：使用页面可见性 API 替代定时轮询
  useEffect(() => {
    loadTasks();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTasks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [agentId]);

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
        return { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100', label: '失败' };
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

  // 格式化日期
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!showPanel) {
    return null;
  }

  return (
    <Card className="border border-gray-200 shadow-sm">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">我的任务列表</h3>
            {stats && (
              <Badge variant="outline" className="ml-2">
                {stats.pending} 待执行 · {stats.in_progress} 进行中 · {stats.waiting_user || 0} 待处理
              </Badge>
            )}
          </div>
          {onTogglePanel && (
            <Button variant="ghost" size="sm" onClick={onTogglePanel}>
              ×
            </Button>
          )}
        </div>

        {/* 统计信息 */}
        {stats && (
          <div className="mt-3 grid grid-cols-6 gap-2 text-xs">
            <div className="bg-white p-2 rounded border border-gray-200 text-center">
              <div className="font-bold text-lg text-gray-900">{stats.total}</div>
              <div className="text-gray-500">总计</div>
            </div>
            <div className="bg-white p-2 rounded border border-gray-200 text-center">
              <div className="font-bold text-lg text-yellow-600">{stats.pending}</div>
              <div className="text-gray-500">待执行</div>
            </div>
            <div className="bg-white p-2 rounded border border-gray-200 text-center">
              <div className="font-bold text-lg text-blue-600">{stats.in_progress}</div>
              <div className="text-gray-500">进行中</div>
            </div>
            <div className="bg-white p-2 rounded border border-gray-200 text-center">
              <div className="font-bold text-lg text-purple-600">{stats.waiting_user || 0}</div>
              <div className="text-gray-500">待处理</div>
            </div>
            <div className="bg-white p-2 rounded border border-gray-200 text-center">
              <div className="font-bold text-lg text-green-600">{stats.completed}</div>
              <div className="text-gray-500">已完成</div>
            </div>
            <div className="bg-white p-2 rounded border border-gray-200 text-center">
              <div className="font-bold text-lg text-red-600">{stats.critical}</div>
              <div className="text-gray-500">关键</div>
            </div>
          </div>
        )}
      </div>

      {/* 任务列表 */}
      <ScrollArea className="h-[600px]">
        <div className="p-4">
          {loading ? (
            <div className="text-center text-gray-500 py-8">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <ListTodo className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>暂无任务</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const statusInfo = getStatusInfo(task.status);
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={task.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTask(task);
                      setShowTaskDetail(true);
                    }}
                  >
                    {/* 任务头部 */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1">
                        {/* 状态图标 */}
                        <StatusIcon className={`w-5 h-5 ${statusInfo.color} flex-shrink-0`} />

                        {/* 任务标题 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 truncate">{task.taskTitle}</h4>
                            {task.isCritical && (
                              <Badge variant="destructive" className="text-xs">
                                关键
                              </Badge>
                            )}
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {task.taskDescription}
                          </p>
                        </div>
                      </div>

                      {/* 状态标签 */}
                      <Badge variant="outline" className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    {/* 进度条 */}
                    {task.status === 'in_progress' && (
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">进度: {task.progress}%</div>
                      </div>
                    )}

                    {/* 元信息 */}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>顺序: #{task.orderIndex}</span>
                      <span>创建: {formatDate(task.createdAt)}</span>
                      {task.startedAt && <span>开始: {formatDate(task.startedAt)}</span>}
                      {task.completedAt && <span>完成: {formatDate(task.completedAt)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 任务详情弹框 */}
      {showTaskDetail && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="bg-white max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">任务详情</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowTaskDetail(false)}>
                  ×
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[calc(80vh-140px)]">
              <div className="p-6">
                {/* 基本信息 */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">任务标题</label>
                    <p className="mt-1 text-gray-900">{selectedTask.taskTitle}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">任务描述</label>
                    <p className="mt-1 text-gray-900 whitespace-pre-wrap">{selectedTask.taskDescription}</p>
                  </div>

                  {selectedTask.metadata?.acceptanceCriteria && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">验收标准</label>
                      <p className="mt-1 text-gray-900 whitespace-pre-wrap">{selectedTask.metadata.acceptanceCriteria}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">状态</label>
                      <p className="mt-1">{getStatusInfo(selectedTask.status).label}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">优先级</label>
                      <p className="mt-1 capitalize">{selectedTask.priority}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">执行顺序</label>
                      <p className="mt-1">#{selectedTask.orderIndex}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">是否关键</label>
                      <p className="mt-1">{selectedTask.isCritical ? '是' : '否'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">进度</label>
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${selectedTask.progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{selectedTask.progress}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-sm font-medium text-gray-700">创建时间</label>
                      <p className="mt-1">{formatDate(selectedTask.createdAt)}</p>
                    </div>
                    {selectedTask.startedAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">开始时间</label>
                        <p className="mt-1">{formatDate(selectedTask.startedAt)}</p>
                      </div>
                    )}
                    {selectedTask.completedAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">完成时间</label>
                        <p className="mt-1">{formatDate(selectedTask.completedAt)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTaskDetail(false)}>
                关闭
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}
