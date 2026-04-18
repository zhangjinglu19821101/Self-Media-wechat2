'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Download } from 'lucide-react';

interface Task {
  id: number;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  executor: string;
  executionStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function InsuranceDQueryPage() {
  const [taskId, setTaskId] = useState('');
  const [executor, setExecutor] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState('');

  const handleQuery = async () => {
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (taskId) params.append('taskId', taskId);
    if (executor) params.append('executor', executor);
    if (startTime) params.append('startTime', startTime);
    if (endTime) params.append('endTime', endTime);

    try {
      const response = await fetch(`/api/query/insurance-d?${params.toString()}`);
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
    setExecutor('');
    setStartTime('');
    setEndTime('');
    setTasks([]);
    setError('');
  };

  const handleExport = () => {
    const csv = [
      ['任务ID', '任务标题', '任务描述', '执行Agent', '状态', '创建时间', '更新时间'],
      ...tasks.map(t => [
        t.taskId,
        t.taskTitle,
        t.taskDescription,
        t.executor,
        t.executionStatus,
        t.createdAt,
        t.updatedAt,
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `insurance-d-tasks-${new Date().toISOString()}.csv`;
    link.click();
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>insurance-d 表查询</CardTitle>
          <CardDescription>查询 daily_task 表数据</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taskId">任务ID</Label>
              <Input
                id="taskId"
                placeholder="输入任务ID（支持模糊搜索）"
                value={taskId}
                onChange={e => setTaskId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="executor">执行Agent</Label>
              <Input
                id="executor"
                placeholder="输入执行Agent ID（如：insurance-d）"
                value={executor}
                onChange={e => setExecutor(e.target.value)}
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
          <div className="flex gap-2">
            <Button onClick={handleQuery} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              查询
            </Button>
            <Button onClick={handleReset} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              重置
            </Button>
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
                    <th className="text-left p-2">任务ID</th>
                    <th className="text-left p-2">任务标题</th>
                    <th className="text-left p-2">执行Agent</th>
                    <th className="text-left p-2">状态</th>
                    <th className="text-left p-2">创建时间</th>
                    <th className="text-left p-2">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map(task => (
                    <tr key={task.id} className="border-b hover:bg-muted">
                      <td className="p-2">{task.id}</td>
                      <td className="p-2 font-mono">{task.taskId}</td>
                      <td className="p-2">{task.taskTitle}</td>
                      <td className="p-2">
                        <Badge variant="outline">{task.executor}</Badge>
                      </td>
                      <td className="p-2">
                        <Badge
                          variant={
                            task.executionStatus === 'completed'
                              ? 'default'
                              : task.executionStatus === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {task.executionStatus}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {new Date(task.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="p-2">
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
    </div>
  );
}
