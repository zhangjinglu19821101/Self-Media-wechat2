/**
 * Agent 任务列表组件（放大版）
 * 显示指定 Agent 的待执行任务列表 - 内容放大1.5倍
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
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'waiting_user';
  priority: 'high' | 'normal' | 'low';
  orderIndex: number;
  isCritical: boolean;
  executor: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress: number;
  executionResult?: string; // 🔥 新增：执行结果
  statusProof?: string; // 🔥 新增：状态证明
  articleMetadata?: any; // 🔥 新增：文章元数据
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

interface AgentTaskListLargeProps {
  agentId: string;
  showPanel: boolean;
  onTogglePanel?: () => void;
}

export function AgentTaskListLarge({ agentId, showPanel, onTogglePanel }: AgentTaskListLargeProps) {
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
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListTodo className="w-8 h-8 text-blue-600" />
            <h3 className="font-bold text-xl text-gray-900">我的任务列表</h3>
            {stats && (
              <Badge variant="outline" className="ml-3 text-base py-1 px-3">
                {stats.pending} 待执行 · {stats.in_progress} 进行中 · {stats.waiting_user || 0} 待处理
              </Badge>
            )}
          </div>
          {onTogglePanel && (
            <Button variant="ghost" size="default" onClick={onTogglePanel} className="h-12 w-12">
              ×
            </Button>
          )}
        </div>

        {/* 统计信息 */}
        {stats && (
          <div className="mt-4 grid grid-cols-6 gap-3 text-sm">
            <div className="bg-white p-4 rounded border border-gray-200 text-center">
              <div className="font-bold text-2xl text-gray-900">{stats.total}</div>
              <div className="text-gray-500 text-base">总计</div>
            </div>
            <div className="bg-white p-4 rounded border border-gray-200 text-center">
              <div className="font-bold text-2xl text-yellow-600">{stats.pending}</div>
              <div className="text-gray-500 text-base">待执行</div>
            </div>
            <div className="bg-white p-4 rounded border border-gray-200 text-center">
              <div className="font-bold text-2xl text-blue-600">{stats.in_progress}</div>
              <div className="text-gray-500 text-base">进行中</div>
            </div>
            <div className="bg-white p-4 rounded border border-gray-200 text-center">
              <div className="font-bold text-2xl text-purple-600">{stats.waiting_user || 0}</div>
              <div className="text-gray-500 text-base">待处理</div>
            </div>
            <div className="bg-white p-4 rounded border border-gray-200 text-center">
              <div className="font-bold text-2xl text-green-600">{stats.completed}</div>
              <div className="text-gray-500 text-base">已完成</div>
            </div>
            <div className="bg-white p-4 rounded border border-gray-200 text-center">
              <div className="font-bold text-2xl text-red-600">{stats.critical}</div>
              <div className="text-gray-500 text-base">关键</div>
            </div>
          </div>
        )}
      </div>

      {/* 任务列表 */}
      <ScrollArea className="h-[600px]">
        <div className="p-6">
          {loading ? (
            <div className="text-center text-gray-500 py-12 text-xl">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <ListTodo className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-xl">暂无任务</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => {
                const statusInfo = getStatusInfo(task.status);
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={task.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTask(task);
                      setShowTaskDetail(true);
                    }}
                  >
                    {/* 任务头部 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        {/* 状态图标 */}
                        <StatusIcon className={`w-8 h-8 ${statusInfo.color} flex-shrink-0`} />

                        {/* 任务标题 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-lg text-gray-900 truncate">{task.taskTitle}</h4>
                            {task.isCritical && (
                              <Badge variant="destructive" className="text-sm py-1 px-3">
                                关键
                              </Badge>
                            )}
                            <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`} />
                          </div>
                          <p className="text-base text-gray-600 mt-2 line-clamp-2">
                            {task.taskDescription}
                          </p>
                        </div>
                      </div>

                      {/* 状态标签 */}
                      <Badge variant="outline" className={`${statusInfo.bgColor} ${statusInfo.color} text-base py-1 px-4`}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    {/* 进度条 */}
                    {task.status === 'in_progress' && (
                      <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <div className="text-sm text-gray-500 mt-2">进度: {task.progress}%</div>
                      </div>
                    )}

                    {/* 执行结果预览 */}
                    {task.status === 'completed' && task.executionResult && (
                      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                          <span className="text-base font-medium text-green-800">执行结果</span>
                        </div>
                        <p className="text-base text-green-700 line-clamp-2">
                          {task.executionResult}
                        </p>
                      </div>
                    )}

                    {/* 元信息 */}
                    <div className="mt-3 flex items-center gap-6 text-sm text-gray-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <Card className="bg-white max-w-3xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-8 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">任务详情</h3>
                <Button variant="ghost" size="default" onClick={() => setShowTaskDetail(false)} className="h-12 w-12">
                  ×
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[calc(80vh-160px)]">
              <div className="p-8">
                {/* 基本信息 */}
                <div className="space-y-6">
                  <div>
                    <label className="text-base font-medium text-gray-700">任务标题</label>
                    <p className="mt-2 text-xl text-gray-900">{selectedTask.taskTitle}</p>
                  </div>

                  <div>
                    <label className="text-base font-medium text-gray-700">任务描述</label>
                    <p className="mt-2 text-base text-gray-900 whitespace-pre-wrap">{selectedTask.taskDescription}</p>
                  </div>

                  {selectedTask.metadata?.acceptanceCriteria && (
                    <div>
                      <label className="text-base font-medium text-gray-700">验收标准</label>
                      <p className="mt-2 text-base text-gray-900 whitespace-pre-wrap">
                        {selectedTask.metadata.acceptanceCriteria}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-base font-medium text-gray-700">状态</label>
                      <Badge className="mt-2 text-base py-1 px-3">
                        {getStatusInfo(selectedTask.status).label}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-base font-medium text-gray-700">优先级</label>
                      <Badge className="mt-2 text-base py-1 px-3">
                        {selectedTask.priority}
                      </Badge>
                    </div>
                  </div>

                  {/* 执行结果 */}
                  {selectedTask.executionResult && (
                    <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
                      <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-3">
                        <CheckCircle2 className="w-7 h-7" />
                        执行结果
                      </h4>
                      <p className="text-green-800 text-base whitespace-pre-wrap">
                        {selectedTask.executionResult}
                      </p>
                    </div>
                  )}

                  {/* 状态证明 */}
                  {selectedTask.statusProof && (
                    <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-4">状态证明</h4>
                      <p className="text-blue-800 text-base whitespace-pre-wrap">
                        {selectedTask.statusProof}
                      </p>
                    </div>
                  )}

                  {/* 文章元数据 */}
                  {selectedTask.articleMetadata && (
                    <div className="bg-purple-50 border border-purple-200 p-6 rounded-lg">
                      <h4 className="font-semibold text-purple-900 mb-4">文章信息</h4>
                      <pre className="text-purple-800 text-sm overflow-x-auto">
                        {JSON.stringify(selectedTask.articleMetadata, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedTask.relatedDailyTask && (
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h4 className="font-semibold text-lg mb-4">关联任务信息</h4>
                      <div className="space-y-3 text-base">
                        <div>
                          <span className="font-medium">任务 ID:</span> {selectedTask.relatedDailyTask.taskId}
                        </div>
                        <div>
                          <span className="font-medium">执行日期:</span> {selectedTask.relatedDailyTask.executionDate}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </Card>
        </div>
      )}
    </Card>
  );
}
