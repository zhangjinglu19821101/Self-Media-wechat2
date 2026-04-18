'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Brain,
  Activity,
  FileText,
  Check,
  X,
  Trash2,
} from 'lucide-react';

interface AgentActivity {
  agentId: string;
  status: string;
  currentTask?: {
    id: string;
    title: string;
    description: string;
    progress: number;
    startedAt: string;
  };
  taskUnderstanding?: {
    taskId: string;
    taskTitle: string;
    taskDescription: string;
    strategy: string;
    approach: string;
    expectedOutcome: string;
    risks: string[];
    confidence: number;
    createdAt: string;
    updatedAt: string;
  };
  lastActivity?: string;
  lastActivityAt: string;
  currentWorkflowId?: string;
  currentStepId?: string;
}

interface LogEntry {
  id: string;
  agentId: string;
  timestamp: string;
  type: string;
  category: string;
  message: string;
  details?: Record<string, any>;
}

export default function AgentActivityMonitorPage() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadData();

    // 🔥 优化：使用页面可见性 API 替代定时轮询
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoRefresh]);

  const loadData = async () => {
    try {
      const response = await fetch('/api/agents/activity');
      const data = await response.json();

      if (data.success) {
        setActivities(data.data);
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAgentData = async () => {
    if (!confirm('确定要清空所有 Agent 相关数据吗？此操作不可恢复！')) {
      return;
    }

    setIsClearing(true);
    try {
      const response = await fetch('/api/agents/clear-data', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        alert('数据清空成功！');
        // 刷新页面数据
        loadData();
      } else {
        alert(`清空失败：${data.error}`);
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('清空数据时出错');
    } finally {
      setIsClearing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-gray-400';
      case 'thinking': return 'bg-purple-500';
      case 'planning': return 'bg-blue-500';
      case 'executing': return 'bg-green-500';
      case 'waiting_confirmation': return 'bg-orange-500 animate-pulse';
      case 'completed': return 'bg-cyan-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      idle: '空闲',
      thinking: '思考中',
      planning: '规划中',
      executing: '执行中',
      waiting_confirmation: '等待确认',
      completed: '已完成',
      error: '错误',
    };
    return statusMap[status] || status;
  };

  const getAgentColor = (id: string) => {
    switch (id) {
      case 'A': return 'bg-red-500';
      case 'B': return 'bg-blue-500';
      case 'C': return 'bg-green-500';
      case 'D': return 'bg-purple-500';
      case 'insurance-c': return 'bg-amber-500';
      case 'insurance-d': return 'bg-teal-500';
      default: return 'bg-gray-500';
    }
  };

  const getAgentName = (id: string) => {
    const nameMap: Record<string, string> = {
      A: '核心战略决策者（总裁）',
      B: '技术落地人',
      C: '运营数据反馈人',
      D: '内容数据反馈人',
      'insurance-c': '保险运营执行者',
      'insurance-d': '保险内容执行者',
    };
    return nameMap[id] || `Agent ${id}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const waitingAgents = activities.filter(a => a.status === 'waiting_confirmation');

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        {/* 头部 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Agent 活动监控</h1>
              <p className="text-muted-foreground mt-2">
                实时查看 Agent 的当前活动、任务理解和执行状态
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? <Activity className="h-4 w-4 mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                {autoRefresh ? '自动刷新' : '手动刷新'}
              </Button>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={clearAgentData}
                disabled={isClearing}
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    清空中...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    清空数据
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* 等待确认提示 */}
        {waitingAgents.length > 0 && (
          <Card className="p-4 mb-6 border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-orange-700 dark:text-orange-400">
                有 {waitingAgents.length} 个 Agent 等待您的确认
              </h2>
            </div>
            <div className="text-sm text-orange-600 dark:text-orange-500">
              {waitingAgents.map(agent => (
                <div key={agent.agentId} className="mt-1">
                  <strong>Agent {agent.agentId}</strong>: {agent.currentTask?.description}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Agent 卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {['A', 'B', 'C', 'D', 'insurance-c', 'insurance-d'].map(agentId => {
            const activity = activities.find(a => a.agentId === agentId);
            const agentName = getAgentName(agentId);

            return (
              <Card key={agentId} className="p-6">
                {/* Agent 头部 */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-xl ${getAgentColor(agentId)}`}>
                      {agentId}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{agentName}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`h-2 w-2 rounded-full ${getStatusColor(activity?.status || 'idle')}`} />
                        <span className="text-sm text-muted-foreground">
                          {getStatusLabel(activity?.status || 'idle')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {activity?.status === 'waiting_confirmation' && (
                    <Badge className="bg-orange-500 animate-pulse">
                      需要确认
                    </Badge>
                  )}
                </div>

                {/* 当前任务 */}
                {activity?.currentTask && (
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">当前任务</span>
                    </div>
                    <h3 className="font-semibold mb-1">{activity.currentTask.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{activity.currentTask.description}</p>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${activity.currentTask.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      进度: {activity.currentTask.progress}%
                    </div>
                  </div>
                )}

                {/* 任务理解 */}
                {activity?.taskUnderstanding && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400">战略理解</span>
                      <Badge variant="outline" className="ml-auto">
                        信心度: {activity.taskUnderstanding.confidence}%
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">战略：</span>
                        <span className="text-muted-foreground ml-1">{activity.taskUnderstanding.strategy}</span>
                      </div>
                      <div>
                        <span className="font-medium">方法：</span>
                        <span className="text-muted-foreground ml-1">{activity.taskUnderstanding.approach}</span>
                      </div>
                      <div>
                        <span className="font-medium">预期结果：</span>
                        <span className="text-muted-foreground ml-1">{activity.taskUnderstanding.expectedOutcome}</span>
                      </div>
                      {activity.taskUnderstanding.risks.length > 0 && (
                        <div>
                          <span className="font-medium">风险：</span>
                          <ul className="list-disc list-inside text-muted-foreground ml-1 mt-1">
                            {activity.taskUnderstanding.risks.map((risk, i) => (
                              <li key={i}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 等待确认操作 */}
                {activity?.status === 'waiting_confirmation' && activity.currentTask && (
                  <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-400">等待确认</span>
                    </div>
                    <p className="text-sm text-orange-600 dark:text-orange-500 mb-3">
                      {activity.currentTask.description}
                    </p>
                    <Textarea
                      placeholder="请输入确认意见或建议..."
                      className="mb-2"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700">
                        <Check className="h-4 w-4 mr-2" />
                        确认通过
                      </Button>
                      <Button size="sm" variant="destructive">
                        <X className="h-4 w-4 mr-2" />
                        拒绝
                      </Button>
                    </div>
                  </div>
                )}

                {/* 最后活动 */}
                {activity?.lastActivity && (
                  <div className="text-xs text-muted-foreground">
                    最后活动: {activity.lastActivity}
                    <br />
                    {new Date(activity.lastActivityAt).toLocaleString()}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
