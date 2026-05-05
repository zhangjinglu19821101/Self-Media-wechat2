'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StepHistoryCard, type StepHistoryItem } from '@/components/step-history-card';
import { Search, RefreshCw, Eye, ChevronUp, ChevronDown, Clock } from 'lucide-react';

interface Task {
  id: number;
  commandResultId: string;
  fromParentsExecutor: string;
  taskTitle: string;
  taskDescription: string;
  status: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  executionResult?: string;
  startedAt?: string;
  completedAt?: string;
}

interface StepHistory {
  id: number;
  stepNo: number;
  interactType: string;
  interactContent: any;
  interactUser: string;
  interactTime: string;
  interactNum: number;
}

// ═══════════════════════════════════════════════════
// 可折叠的原始执行结果组件
// ═══════════════════════════════════════════════════
function CollapsibleResultSection({ result }: { result: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = result.length > 300 ? result.substring(0, 300) + '...' : result;

  return (
    <Card className="border-slate-200">
      <CardHeader
        className="pb-2 cursor-pointer hover:bg-slate-50/50 rounded-t-lg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-500" />
            原始执行结果
            <span className="text-xs font-normal text-muted-foreground">({result.length} 字符)</span>
          </CardTitle>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent className="pt-0">
          <Textarea value={result} disabled rows={20} className="font-mono text-xs" />
        </CardContent>
      ) : (
        <CardContent className="pt-0">
          <pre className="text-xs text-slate-600 bg-slate-50 rounded p-3 whitespace-pre-wrap break-all font-mono max-h-40 overflow-hidden relative">
            {preview}
            {result.length > 300 && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-50 to-transparent flex items-end justify-center pb-1">
                <span className="text-xs text-blue-600">点击展开全部</span>
              </div>
            )}
          </pre>
        </CardContent>
      )}
    </Card>
  );
}

export default function AgentSubTasksQueryPage() {
  const [taskId, setTaskId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');
  
  // 任务详情相关状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [stepHistory, setStepHistory] = useState<StepHistory[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [taskResultData, setTaskResultData] = useState<any>(null); // 🔴 Phase 4/5: 子任务 resultData（含校验/情绪/风格分析）
  
  // 修改序号相关状态（保留）
  const [updateOrderDialogOpen, setUpdateOrderDialogOpen] = useState(false);
  const [updateOrderForm, setUpdateOrderForm] = useState({
    taskId: '',
    currentOrderIndex: 0,
    newOrderIndex: 1,
    maxOrderIndex: 1,
    taskTitle: '',
  });
  const [updateOrderLoading, setUpdateOrderLoading] = useState(false);

  const handleQuery = async () => {
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (taskId) params.append('taskId', taskId);
    if (agentId) params.append('agentId', agentId);
    if (startTime) params.append('startTime', startTime);
    if (endTime) params.append('endTime', endTime);

    try {
      const response = await fetch(`/api/query/agent-sub-tasks?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setTasks(result.data.tasks);
      } else {
        setError(result.error || '查询失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTaskId('');
    setAgentId('');
    setStartTime('');
    setEndTime('');
    setTasks([]);
    setError('');
  };

  const handleExport = () => {
    const csv = [
      ['ID', 'Command Result ID', '执行者', '任务标题', '任务描述', '状态', '顺序', '创建时间', '更新时间'],
      ...tasks.map(t => [
        t.id,
        t.commandResultId,
        t.fromParentsExecutor,
        t.taskTitle,
        t.taskDescription,
        t.status,
        t.orderIndex,
        t.createdAt,
        t.updatedAt,
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agent-sub-tasks-${new Date().toISOString()}.csv`;
    link.click();
  };

  interface McpExecution {
    id: number;
    attemptId: string;
    attemptNumber: number;
    attemptTimestamp: string;
    toolName: string;
    actionName: string;
    resultStatus: string;
    resultData: any;
    resultText: string;
    errorMessage?: string;
  }
  
  const [mcpExecutions, setMcpExecutions] = useState<McpExecution[]>([]);
  
  // 查看任务详情
  const openDetailDialog = async (task: Task) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
    setDetailLoading(true);
    setStepHistory([]);
    setMcpExecutions([]);
    
    try {
      // 1. 查询任务详情（包含 MCP 执行记录）
      const detailResponse = await fetch(`/api/agents/tasks/${task.id}/detail`);
      const detailResult = await detailResponse.json();
      
      if (detailResult.success) {
        setMcpExecutions(detailResult.data.mcpExecutions || []);
        // 🔴 Phase 4/5: 解析 resultData（含 validationResult / emotionClassification / styleConsistency）
        setTaskResultData(detailResult.data.task?.resultData || null);
      }
      
      // 2. 查询任务步骤历史
      const historyResponse = await fetch(`/api/test/subtask-step-history?commandResultId=${task.commandResultId}`);
      const historyResult = await historyResponse.json();
      
      if (historyResult.success && historyResult.data) {
        // 过滤出当前任务的步骤历史
        const taskStepHistory = historyResult.data
          .filter((item: any) => item.subTask?.id === task.id.toString())
          .map((item: any) => item.history);
        setStepHistory(taskStepHistory);
      }
    } catch (error) {
      console.error('查询任务详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };



  // 打开修改序号对话框
  const openUpdateOrderDialog = (task: Task) => {
    const maxOrder = Math.max(...tasks.map(t => t.orderIndex));
    setUpdateOrderForm({
      taskId: task.id.toString(),
      currentOrderIndex: task.orderIndex,
      newOrderIndex: task.orderIndex,
      maxOrderIndex: maxOrder,
      taskTitle: task.taskTitle,
    });
    setUpdateOrderDialogOpen(true);
  };

  // 修改序号
  const handleUpdateOrder = async () => {
    if (!updateOrderForm.taskId || !updateOrderForm.newOrderIndex) {
      alert('请选择新序号');
      return;
    }

    setUpdateOrderLoading(true);
    try {
      const response = await fetch('/api/agent-sub-tasks/update-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: updateOrderForm.taskId,
          newOrderIndex: updateOrderForm.newOrderIndex,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert(result.message);
        setUpdateOrderDialogOpen(false);
        handleQuery();
      } else {
        alert('修改失败：' + result.error);
      }
    } catch (error) {
      console.error('修改序号失败:', error);
      alert('修改序号失败');
    } finally {
      setUpdateOrderLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>agent_sub_tasks 表查询</CardTitle>
          <CardDescription>查询 agent_sub_tasks 表数据</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taskId">任务ID</Label>
              <Input
                id="taskId"
                placeholder="输入任务ID（模糊匹配）"
                value={taskId}
                onChange={e => setTaskId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agentId">Agent ID</Label>
              <Input
                id="agentId"
                placeholder="输入Agent ID"
                value={agentId}
                onChange={e => setAgentId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">开始时间</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">结束时间</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleQuery} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              查询
            </Button>
            <Button onClick={handleReset} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              重置
            </Button>

            {/* 修改序号对话框 */}
            <Dialog open={updateOrderDialogOpen} onOpenChange={setUpdateOrderDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>修改任务序号</DialogTitle>
                  <DialogDescription>
                    修改任务 "{updateOrderForm.taskTitle}" 的序号，其他任务会自动调整
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>当前序号</Label>
                    <Input
                      value={updateOrderForm.currentOrderIndex}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>新序号（1 - {updateOrderForm.maxOrderIndex}）</Label>
                    <Input
                      type="number"
                      min={1}
                          max={updateOrderForm.maxOrderIndex}
                          value={updateOrderForm.newOrderIndex}
                          onChange={(e) => setUpdateOrderForm({ 
                            ...updateOrderForm, 
                            newOrderIndex: parseInt(e.target.value) || 1 
                          })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setUpdateOrderDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleUpdateOrder} disabled={updateOrderLoading}>
                        {updateOrderLoading ? '修改中...' : '确认修改'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            {tasks.length > 0 && (
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                导出CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>查询结果 ({tasks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Command Result ID</th>
                    <th className="text-left p-2">执行者</th>
                    <th className="text-left p-2">任务标题</th>
                    <th className="text-left p-2">状态</th>
                    <th className="text-left p-2">顺序</th>
                    <th className="text-left p-2">操作</th>
                    <th className="text-left p-2">创建时间</th>
                    <th className="text-left p-2">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id} className="border-b hover:bg-muted">
                      <td className="p-2">{task.id}</td>
                      <td className="p-2 font-mono text-xs">{task.commandResultId}</td>
                      <td className="p-2">
                        <Badge variant="outline">{task.fromParentsExecutor}</Badge>
                      </td>
                      <td className="p-2">{task.taskTitle}</td>
                      <td className="p-2">
                        <Badge
                          variant={
                            task.status === 'completed'
                              ? 'default'
                              : task.status === 'failed'
                              ? 'destructive'
                              : task.status === 'in_progress' || task.status === 'pre_completed' || task.status === 'pre_need_support'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {task.status}
                        </Badge>
                      </td>
                      <td className="p-2 font-bold">{task.orderIndex}</td>
                      <td className="p-2 space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => openDetailDialog(task)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          详情
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => openUpdateOrderDialog(task)}
                        >
                          修改序号
                        </Button>
                      </td>
                      <td className="p-2 text-xs">
                        {new Date(task.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="p-2 text-xs">
                        {new Date(task.updatedAt).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && tasks.length === 0 && !error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">暂无数据，请输入查询条件</p>
          </CardContent>
        </Card>
      )}

      {/* 任务详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>任务详情</DialogTitle>
            <DialogDescription>
              查看任务的详细信息和执行过程
            </DialogDescription>
          </DialogHeader>
          
          {selectedTask && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">基本信息</TabsTrigger>
                <TabsTrigger value="history">执行历史</TabsTrigger>
                <TabsTrigger value="mcp">MCP 执行</TabsTrigger>
                <TabsTrigger value="result">执行结果</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>任务ID</Label>
                    <Input value={selectedTask.id} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Command Result ID</Label>
                    <Input value={selectedTask.commandResultId} disabled className="font-mono text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label>执行者</Label>
                    <Badge variant="outline">{selectedTask.fromParentsExecutor}</Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>状态</Label>
                    <Badge
                      variant={
                        selectedTask.status === 'completed'
                          ? 'default'
                          : selectedTask.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {selectedTask.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>顺序</Label>
                    <Input value={selectedTask.orderIndex} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>创建时间</Label>
                    <Input value={new Date(selectedTask.createdAt).toLocaleString('zh-CN')} disabled />
                  </div>
                  {selectedTask.startedAt && (
                    <div className="space-y-2">
                      <Label>开始时间</Label>
                      <Input value={new Date(selectedTask.startedAt).toLocaleString('zh-CN')} disabled />
                    </div>
                  )}
                  {selectedTask.completedAt && (
                    <div className="space-y-2">
                      <Label>完成时间</Label>
                      <Input value={new Date(selectedTask.completedAt).toLocaleString('zh-CN')} disabled />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>更新时间</Label>
                    <Input value={new Date(selectedTask.updatedAt).toLocaleString('zh-CN')} disabled />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>任务标题</Label>
                  <Input value={selectedTask.taskTitle} disabled />
                </div>
                
                <div className="space-y-2">
                  <Label>任务描述</Label>
                  <Textarea value={selectedTask.taskDescription} disabled rows={4} />
                </div>
              </TabsContent>
              
              <TabsContent value="history" className="space-y-4 mt-4">
                {detailLoading ? (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">加载中...</p>
                  </div>
                ) : stepHistory.length > 0 ? (
                  <div className="space-y-4">
                    {stepHistory.map((step, index, arr) => (
                      <StepHistoryCard key={step.id} step={step} isLast={index === arr.length - 1} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">暂无执行历史</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="mcp" className="space-y-4 mt-4">
                {detailLoading ? (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">加载中...</p>
                  </div>
                ) : mcpExecutions.length > 0 ? (
                  <div className="space-y-4">
                    {mcpExecutions.map((mcp, index) => (
                      <Card key={mcp.id}>
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">
                                MCP 执行 #{index + 1} - {mcp.toolName}
                              </CardTitle>
                              <CardDescription>
                                {mcp.actionName} · {new Date(mcp.attemptTimestamp).toLocaleString('zh-CN')}
                              </CardDescription>
                            </div>
                            <Badge variant={
                              mcp.resultStatus === 'success' 
                                ? 'default' 
                                : mcp.resultStatus === 'failed' 
                                ? 'destructive' 
                                : 'secondary'
                            }>
                              {mcp.resultStatus}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* 如果是合规审核结果，特别展示 */}
                          {(mcp.toolName.toLowerCase().includes('compliance') || 
                            mcp.actionName.toLowerCase().includes('compliance')) && 
                           mcp.resultData && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <h4 className="font-semibold text-blue-800 mb-2">
                                📋 合规审核结果
                              </h4>
                              <div className="text-sm space-y-2">
                                {typeof mcp.resultData === 'object' ? (
                                  <div className="space-y-2">
                                    {mcp.resultData.approved !== undefined && (
                                      <div>
                                        <span className="font-medium">审核结果：</span>
                                        <Badge className={mcp.resultData.approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                          {mcp.resultData.approved ? '通过' : '未通过'}
                                        </Badge>
                                      </div>
                                    )}
                                    {mcp.resultData.score !== undefined && (
                                      <div>
                                        <span className="font-medium">合规评分：</span>
                                        <span>{mcp.resultData.score}</span>
                                      </div>
                                    )}
                                    {mcp.resultData.issues && mcp.resultData.issues.length > 0 && (
                                      <div>
                                        <span className="font-medium">发现问题：</span>
                                        <ul className="list-disc list-inside mt-1">
                                          {mcp.resultData.issues.map((issue: any, i: number) => (
                                            <li key={i}>
                                              <span className="text-red-600">{issue.type || issue.category}</span>
                                              {issue.description && `: ${issue.description}`}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {mcp.resultData.suggestions && mcp.resultData.suggestions.length > 0 && (
                                      <div>
                                        <span className="font-medium">修改建议：</span>
                                        <ul className="list-disc list-inside mt-1">
                                          {mcp.resultData.suggestions.map((suggestion: any, i: number) => (
                                            <li key={i}>
                                              {typeof suggestion === 'string' ? suggestion : suggestion.content || suggestion.text}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p>{JSON.stringify(mcp.resultData, null, 2)}</p>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* 通用 MCP 结果展示 */}
                          <div className="space-y-2">
                            <div>
                              <Label>Result Data</Label>
                              <Textarea
                                value={JSON.stringify(mcp.resultData, null, 2)}
                                disabled
                                rows={8}
                                className="font-mono text-xs"
                              />
                            </div>
                            {mcp.resultText && (
                              <div>
                                <Label>Result Text</Label>
                                <Textarea
                                  value={mcp.resultText}
                                  disabled
                                  rows={4}
                                  className="font-mono text-xs"
                                />
                              </div>
                            )}
                            {mcp.errorMessage && (
                              <div>
                                <Label>Error</Label>
                                <Textarea
                                  value={mcp.errorMessage}
                                  disabled
                                  rows={3}
                                  className="font-mono text-xs text-red-600"
                                />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">暂无 MCP 执行记录</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="result" className="space-y-4 mt-4">
                {(() => {
                  const metadata = taskResultData?.metadata;
                  const hasAnalysis = !!(metadata?.validationResult || metadata?.emotionClassification || metadata?.styleConsistency);
                  const hasExecutionResult = !!selectedTask?.executionResult;

                  if (!hasAnalysis && !hasExecutionResult) {
                    return (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">暂无执行结果</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* ═══ Phase 4: 文章校验结果 ═══ */}
                      {metadata?.validationResult && (
                        <Card className="border-blue-200 bg-blue-50/30">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-blue-600" />
                              文章校验结果（Phase 4）
                              <Badge
                                variant={metadata.validationResult.overall === 'pass' ? 'default' :
                                        metadata.validationResult.overall === 'warn' ? 'secondary' : 'destructive'}
                                className="ml-auto"
                              >
                                {metadata.validationResult.overall === 'pass' ? '✅ 通过' :
                                 metadata.validationResult.overall === 'warn' ? '⚠️ 警告' : '❌ 不通过'}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* 维度分数 */}
                            {metadata.validationResult.scores && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {Object.entries(metadata.validationResult.scores).map(([key, score]: [string, any]) => (
                                  <div key={key} className={`rounded-lg p-2 text-center ${
                                    (score as any).passed !== false ? 'bg-green-50' : 'bg-red-50'
                                  }`}>
                                    <div className="text-xs text-muted-foreground">{key}</div>
                                    <div className={`font-semibold text-sm ${
                                      typeof (score as any).score === 'number'
                                        ? (score as any).score >= 0.85 ? 'text-green-700' : (score as any).score >= 0.6 ? 'text-amber-600' : 'text-red-600'
                                        : (score as any).passed !== false ? 'text-green-700' : 'text-red-600'
                                    }`}>
                                      {typeof (score as any).score === 'number'
                                        ? `${((score as any).score * 100).toFixed(0)}%`
                                        : ((score as any).passed !== false ? '通过' : '未通过')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* 摘要 */}
                            {metadata.validationResult.summary && (
                              <p className="text-sm text-slate-600 leading-relaxed">{metadata.validationResult.summary}</p>
                            )}
                            {/* 修改建议 */}
                            {metadata.validationResult.rewriteSuggestions && Array.isArray(metadata.validationResult.rewriteSuggestions) && metadata.validationResult.rewriteSuggestions.length > 0 && (
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">修改建议</Label>
                                <ul className="list-disc list-inside space-y-1">
                                  {metadata.validationResult.rewriteSuggestions.map((s: string, i: number) => (
                                    <li key={i} className="text-sm text-amber-700 bg-amber-50 rounded px-2 py-1">{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {metadata.validationResult.validatedAt && (
                              <p className="text-xs text-slate-400">校验时间: {new Date(metadata.validationResult.validatedAt).toLocaleString('zh-CN')}</p>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* ═══ Phase 5.1: 情绪分类 ═══ */}
                      {metadata?.emotionClassification && (
                        <Card className="border-purple-200 bg-purple-50/30">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Brain className="w-4 h-4 text-purple-600" />
                              情绪分类（Phase 5）
                              {metadata.emotionClassification.confidence > 0 && (
                                <Badge variant="outline" className="ml-auto border-purple-300 text-purple-700">
                                  置信度 {(metadata.emotionClassification.confidence * 100).toFixed(0)}%
                                </Badge>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-medium text-purple-800">
                                {(() => {
                                  const map: Record<string, string> = {
                                    empathetic: '共情温情', rational: '理性客观',
                                    warning: '踩坑警醒', warm: '温情感性',
                                    professional: '专业权威', neutral: '中性平衡',
                                  };
                                  return map[metadata.emotionClassification.primaryEmotion] || metadata.emotionClassification.primaryEmotion;
                                })()}
                              </span>
                            </div>
                            {metadata.emotionClassification.secondaryTags && Array.isArray(metadata.emotionClassification.secondaryTags) && metadata.emotionClassification.secondaryTags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {metadata.emotionClassification.secondaryTags.map((tag: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs border-purple-200 text-purple-600">{tag}</Badge>
                                ))}
                              </div>
                            )}
                            {metadata.emotionClassification.analysisText && (
                              <p className="text-sm text-slate-600">{metadata.emotionClassification.analysisText}</p>
                            )}
                            {metadata.emotionClassification.classifiedAt && (
                              <p className="text-xs text-slate-400">分类时间: {new Date(metadata.emotionClassification.classifiedAt).toLocaleString('zh-CN')}</p>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* ═══ Phase 5.2: 风格一致性 ═══ */}
                      {metadata?.styleConsistency && (
                        <Card className="border-emerald-200 bg-emerald-50/30">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <BarChart3 className="w-4 h-4 text-emerald-600" />
                              风格一致性评估（Phase 5）
                              <Badge
                                variant={
                                  metadata.styleConsistency.consistencyLevel === 'excellent' ? 'default' :
                                  metadata.styleConsistency.consistencyLevel === 'good' ? 'secondary' :
                                  metadata.styleConsistency.consistencyLevel === 'acceptable' ? 'outline' : 'destructive'
                                }
                                className="ml-auto"
                              >
                                {(() => {
                                  const map: Record<string, string> = {
                                    excellent: '优秀', good: '良好',
                                    acceptable: '可接受', needs_improvement: '需改进',
                                  };
                                  return map[metadata.styleConsistency.consistencyLevel] || metadata.styleConsistency.consistencyLevel;
                                })()}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="text-center p-2 rounded-lg bg-white/60">
                                <div className="text-xs text-muted-foreground">平均相似度</div>
                                <div className="font-bold text-emerald-700">{((metadata.styleConsistency.averageSimilarity || 0) * 100).toFixed(1)}%</div>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-white/60">
                                <div className="text-xs text-muted-foreground">最高相似度</div>
                                <div className="font-bold text-emerald-700">{((metadata.styleConsistency.maxSimilarity || 0) * 100).toFixed(1)}%</div>
                              </div>
                              <div className="text-center p-2 rounded-lg bg-white/60">
                                <div className="text-xs text-muted-foreground">最低相似度</div>
                                <div className="font-bold text-emerald-700">{((metadata.styleConsistency.minSimilarity || 0) * 100).toFixed(1)}%</div>
                              </div>
                            </div>
                            {metadata.styleConsistency.suggestion && (
                              <p className="text-sm text-slate-600 bg-white/60 rounded px-3 py-2">{metadata.styleConsistency.suggestion}</p>
                            )}
                            {/* 各标杆对比详情 */}
                            {metadata.styleConsistency.comparisons && Array.isArray(metadata.styleConsistency.comparisons) && metadata.styleConsistency.comparisons.length > 0 && (
                              <div className="space-y-1">
                                <Label className="text-xs text-slate-500">标杆对比详情</Label>
                                {metadata.styleConsistency.comparisons.map((c: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-sm bg-white/60 rounded px-3 py-1.5">
                                    <span className="text-slate-600">{c.benchmarkName}</span>
                                    <Badge variant="outline" className={
                                      c.level === 'identical' ? 'border-emerald-300 text-emerald-700' :
                                      c.level === 'high' ? 'border-green-300 text-green-700' :
                                      c.level === 'medium' ? 'border-amber-300 text-amber-700' :
                                      c.level === 'low' ? 'border-orange-300 text-orange-700' :
                                      'border-red-300 text-red-700'
                                    }>
                                      {((c.similarity || 0) * 100).toFixed(1)}%
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                            {metadata.styleConsistency.evaluatedAt && (
                              <p className="text-xs text-slate-400">评估时间: {new Date(metadata.styleConsistency.evaluatedAt).toLocaleString('zh-CN')}</p>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* ═══ 原始执行结果（可折叠） ═══ */}
                      {hasExecutionResult && (
                        <CollapsibleResultSection result={selectedTask.executionResult!} />
                      )}

                      {/* 无分析数据时的提示 */}
                      {!hasAnalysis && hasExecutionResult && (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">
                          该任务暂无 Phase 4/5 分析数据（校验、情绪分类、风格一致性），仅展示原始执行结果。
                        </p>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
