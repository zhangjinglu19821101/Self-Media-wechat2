/**
 * 待办任务列表组件
 * 专门显示 status='waiting_user' 的任务
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserCheck, AlertCircle, ChevronRight, Check, X, ListTodo, MessageSquare, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface KeyField {
  fieldId: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'select' | 'date' | 'boolean';
  description: string;
  currentValue: any;
  options?: any[];
  validationRules?: {
    required: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface AvailableSolution {
  solutionId: string;
  label: string;
  description: string;
  pros?: string[];
  cons?: string[];
  estimatedTime?: number;
}

interface PromptMessage {
  title: string;
  description: string;
  deadline?: Date;
  priority?: 'low' | 'medium' | 'high';
}

interface WaitingTask {
  id: string;
  taskTitle: string;
  taskDescription: string;
  status: string;
  priority: 'high' | 'normal' | 'low';
  orderIndex: number;
  isCritical: boolean;
  executor: string;
  createdAt: string;
  startedAt?: string;
  updatedAt?: string;
  metadata: {
    [key: string]: any;
  };
  pendingKeyFields: KeyField[];
  availableSolutions: AvailableSolution[];
  promptMessage?: PromptMessage;
  relatedDailyTask?: {
    id: string;
    taskId: string;
    executionDate: string;
    commandContent?: string;
  };
}

interface WaitingTaskStats {
  total: number;
  waitingUser: number;
  withKeyFields: number;
  withSolutions: number;
}

interface WaitingUserTasksProps {
  agentId: string;
  showPanel: boolean;
  onTogglePanel?: () => void;
  onTaskClick?: (task: WaitingTask) => void;
}

export function WaitingUserTasks({ 
  agentId, 
  showPanel, 
  onTogglePanel,
  onTaskClick 
}: WaitingUserTasksProps) {
  const [tasks, setTasks] = useState<WaitingTask[]>([]);
  const [stats, setStats] = useState<WaitingTaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<WaitingTask | null>(null);

  // 加载待办任务列表
  const loadWaitingTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/agents/${agentId}/waiting-tasks`);
      const data = await response.json();

      if (data.success) {
        setTasks(data.data.tasks);
        setStats(data.data.stats);
        console.log(`✅ 加载到 ${data.data.tasks.length} 个待办任务`);
      } else {
        toast.error(`加载待办任务失败: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ 加载待办任务失败:', error);
      toast.error('加载待办任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showPanel) {
      loadWaitingTasks();

      // 🔥 优化：使用页面可见性 API 替代定时轮询
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          loadWaitingTasks();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [agentId, showPanel]);

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
    <Card className="border border-purple-200 shadow-sm">
      {/* 头部 */}
      <div className="p-4 border-b border-purple-200 bg-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">待办任务</h3>
            {stats && (
              <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-700">
                {stats.waitingUser} 个待处理
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
          <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
            <div className="bg-white p-2 rounded border border-purple-200 text-center">
              <div className="font-bold text-lg text-purple-600">{stats.waitingUser}</div>
              <div className="text-gray-500">待处理</div>
            </div>
            <div className="bg-white p-2 rounded border border-purple-200 text-center">
              <div className="font-bold text-lg text-blue-600">{stats.withKeyFields}</div>
              <div className="text-gray-500">待确认字段</div>
            </div>
            <div className="bg-white p-2 rounded border border-purple-200 text-center">
              <div className="font-bold text-lg text-green-600">{stats.withSolutions}</div>
              <div className="text-gray-500">可选方案</div>
            </div>
            <div className="bg-white p-2 rounded border border-purple-200 text-center">
              <div className="font-bold text-lg text-gray-700">{stats.total}</div>
              <div className="text-gray-500">总计</div>
            </div>
          </div>
        )}
      </div>

      {/* 任务列表 */}
      <ScrollArea className="h-[400px]">
        <div className="p-4">
          {loading ? (
            <div className="text-center text-gray-500 py-8">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <UserCheck className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>暂无待办任务</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white border-2 border-purple-200 rounded-lg p-4 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedTask(task);
                    onTaskClick?.(task);
                  }}
                >
                  {/* 任务头部 */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      {/* 状态图标 */}
                      <UserCheck className="w-5 h-5 text-purple-600 flex-shrink-0" />

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
                    <Badge className="bg-purple-100 text-purple-700">
                      待处理
                    </Badge>
                  </div>

                  {/* 待办任务特有的信息 */}
                  <div className="mt-3 space-y-2">
                    {/* 提示信息 */}
                    {task.promptMessage && (
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h5 className="font-medium text-purple-900">{task.promptMessage.title}</h5>
                            <p className="text-sm text-purple-700 mt-1">
                              {task.promptMessage.description}
                            </p>
                          </div>
                          {task.promptMessage.deadline && (
                            <div className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                              <Clock className="w-3 h-3" />
                              <span>截止: {formatDate(task.promptMessage.deadline.toString())}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 待确认字段 */}
                    {task.pendingKeyFields.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <ListTodo className="w-4 h-4" />
                        <span>待确认字段: {task.pendingKeyFields.length} 个</span>
                      </div>
                    )}

                    {/* 可选方案 */}
                    {task.availableSolutions.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <MessageSquare className="w-4 h-4" />
                        <span>可选方案: {task.availableSolutions.length} 个</span>
                      </div>
                    )}
                  </div>

                  {/* 元信息 */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span>顺序: #{task.orderIndex}</span>
                    <span>创建: {formatDate(task.createdAt)}</span>
                    {task.updatedAt && <span>更新: {formatDate(task.updatedAt)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
