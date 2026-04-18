/**
 * 任务列表诊断工具
 * 用于排查"总计显示5条，实际4条"的问题
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, CheckCircle2, Clock, AlertTriangle, ListTodo, Loader2 } from 'lucide-react';

interface Task {
  id: string;
  taskTitle: string;
  status: string;
  executor: string;
}

interface DiagnosticResult {
  apiUrl: string;
  responseStatus: number;
  total: number;
  taskCount: number;
  tasks: Task[];
  filteredTasks: Task[];
  activeTab: string;
  stats: any;
  discrepancies: string[];
}

export default function TaskListDiagnosticsPage() {
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  // 执行诊断
  const runDiagnostics = async () => {
    setLoading(true);
    try {
      // 1. 测试 /api/agents/B/tasks API
      const response = await fetch('/api/agents/B/tasks');
      const data = await response.json();

      if (!data.success) {
        setDiagnosticResult({
          apiUrl: '/api/agents/B/tasks',
          responseStatus: response.status,
          total: 0,
          taskCount: 0,
          tasks: [],
          filteredTasks: [],
          activeTab,
          stats: null,
          discrepancies: ['API 返回失败: ' + data.error],
        });
        return;
      }

      const allTasks: Task[] = data.data.tasks;
      const stats = data.data.stats;

      // 2. 模拟过滤逻辑
      const filteredTasks = allTasks.filter(task => {
        if (activeTab === 'all') return true;
        if (activeTab === 'pending') return task.status === 'pending';
        if (activeTab === 'in_progress') return task.status === 'in_progress';
        if (activeTab === 'completed') return task.status === 'completed';
        if (activeTab === 'failed') return task.status === 'failed';
        return true;
      });

      // 3. 检查不一致
      const discrepancies: string[] = [];

      // 检查 1: stats.total vs tasks.length
      if (stats.total !== allTasks.length) {
        discrepancies.push(
          `不一致 #1: stats.total (${stats.total}) !== tasks.length (${allTasks.length})`
        );
      }

      // 检查 2: filteredStats.total vs filteredTasks.length
      const filteredStatsTotal = filteredTasks.length;
      if (filteredStatsTotal !== filteredTasks.length) {
        discrepancies.push(
          `不一致 #2: filteredStats.total (${filteredStatsTotal}) !== filteredTasks.length (${filteredTasks.length})`
        );
      }

      // 检查 3: 任务 ID 唯一性
      const taskIds = allTasks.map(t => t.id);
      const uniqueIds = new Set(taskIds);
      if (taskIds.length !== uniqueIds.size) {
        discrepancies.push(
          `不一致 #3: 存在重复的任务 ID (总共 ${taskIds.length} 个, 唯一 ${uniqueIds.size} 个)`
        );
      }

      // 检查 4: 任务状态分布
      const statusCounts = allTasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      if (Object.keys(statusCounts).length > 0 && activeTab !== 'all') {
        const filteredCount = statusCounts[activeTab] || 0;
        if (filteredCount !== filteredTasks.length) {
          discrepancies.push(
            `不一致 #4: 状态 ${activeTab} 应该有 ${filteredCount} 个任务，但过滤后有 ${filteredTasks.length} 个`
          );
        }
      }

      setDiagnosticResult({
        apiUrl: '/api/agents/B/tasks',
        responseStatus: response.status,
        total: stats.total,
        taskCount: allTasks.length,
        tasks: allTasks,
        filteredTasks,
        activeTab,
        stats,
        discrepancies,
      });
    } catch (error) {
      console.error('诊断失败:', error);
      setDiagnosticResult({
        apiUrl: '/api/agents/B/tasks',
        responseStatus: 0,
        total: 0,
        taskCount: 0,
        tasks: [],
        filteredTasks: [],
        activeTab,
        stats: null,
        discrepancies: ['诊断执行失败: ' + (error instanceof Error ? error.message : String(error))],
      });
    } finally {
      setLoading(false);
    }
  };

  // 初始执行诊断
  useEffect(() => {
    runDiagnostics();
  }, []);

  // 标签页变化时重新诊断
  useEffect(() => {
    if (diagnosticResult) {
      const filteredTasks = diagnosticResult.tasks.filter(task => {
        if (activeTab === 'all') return true;
        if (activeTab === 'pending') return task.status === 'pending';
        if (activeTab === 'in_progress') return task.status === 'in_progress';
        if (activeTab === 'completed') return task.status === 'completed';
        if (activeTab === 'failed') return task.status === 'failed';
        return true;
      });

      setDiagnosticResult({
        ...diagnosticResult,
        filteredTasks,
        activeTab,
      });
    }
  }, [activeTab]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">任务列表诊断工具</h1>
          <p className="text-gray-500 mt-1">
            用于排查"总计显示5条，实际4条"的问题
          </p>
        </div>
        <Button onClick={runDiagnostics} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          重新诊断
        </Button>
      </div>

      {/* 诊断结果 */}
      {diagnosticResult && (
        <div className="space-y-6">
          {/* API 信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">API 响应信息</CardTitle>
              <CardDescription>API: {diagnosticResult.apiUrl}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">HTTP 状态</div>
                  <div className={`text-2xl font-bold ${
                    diagnosticResult.responseStatus === 200 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {diagnosticResult.responseStatus}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">stats.total</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {diagnosticResult.total}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">tasks.length</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {diagnosticResult.taskCount}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">filteredTasks.length</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {diagnosticResult.filteredTasks.length}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 任务状态分布 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">任务状态分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {['all', 'pending', 'in_progress', 'completed', 'failed'].map(status => {
                  const count = diagnosticResult.tasks.filter(t => 
                    status === 'all' || t.status === status
                  ).length;
                  return (
                    <div
                      key={status}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        activeTab === status
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setActiveTab(status)}
                    >
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-sm text-gray-500">
                        {status === 'all' ? '全部' :
                         status === 'in_progress' ? '进行中' :
                         status === 'pending' ? '待处理' :
                         status === 'completed' ? '已完成' : '失败'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-gray-500 mt-3">
                当前标签页: <Badge variant="outline">{activeTab}</Badge>
              </p>
            </CardContent>
          </Card>

          {/* 不一致检查结果 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">不一致检查</CardTitle>
              <CardDescription>
                检查是否存在数据不一致的问题
              </CardDescription>
            </CardHeader>
            <CardContent>
              {diagnosticResult.discrepancies.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">未发现不一致问题</span>
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    API 返回的统计数据与任务列表数量一致。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnosticResult.discrepancies.map((discrepancy, index) => (
                    <div
                      key={index}
                      className="bg-red-50 border border-red-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-medium">发现不一致 #{index + 1}</span>
                      </div>
                      <p className="text-sm text-red-700 mt-2">{discrepancy}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 任务列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                任务列表 (显示 {diagnosticResult.filteredTasks.length} 条)
              </CardTitle>
              <CardDescription>
                以下是当前筛选条件下的任务列表
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {diagnosticResult.filteredTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <ListTodo className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p>暂无任务</p>
                    <p className="text-sm mt-2">
                      当前筛选条件: {activeTab}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {diagnosticResult.filteredTasks.map((task, index) => (
                      <div
                        key={task.id}
                        className="bg-white border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400">#{index + 1}</span>
                            {getStatusIcon(task.status)}
                            <div>
                              <div className="font-medium">{task.taskTitle}</div>
                              <div className="text-sm text-gray-500">
                                执行者: {task.executor}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline">{task.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* 建议 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">排查建议</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {diagnosticResult.discrepancies.length > 0 ? (
                  <>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="font-medium text-yellow-800 mb-2">发现问题!</div>
                      <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                        <li>请检查上述不一致问题，可能是代码逻辑错误</li>
                        <li>检查是否有多个组件同时修改任务数据</li>
                        <li>检查浏览器控制台是否有报错信息</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="font-medium text-blue-800 mb-2">数据一致</div>
                    <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                      <li>API 返回的数据是正确和一致的</li>
                      <li>如果页面仍然显示不一致，可能是以下原因:</li>
                      <li>- 浏览器缓存了旧版本的页面</li>
                      <li>- 不同的组件使用了不同的 API</li>
                      <li>- 前端代码版本与后端 API 不匹配</li>
                    </ul>
                    <div className="mt-3">
                      <p className="text-sm text-blue-700 font-medium">建议操作:</p>
                      <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside mt-1">
                        <li>清除浏览器缓存或使用无痕模式</li>
                        <li>强制刷新页面 (Ctrl+Shift+R 或 Cmd+Shift+R)</li>
                        <li>检查是否有其他页面或组件显示不同的数据</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
