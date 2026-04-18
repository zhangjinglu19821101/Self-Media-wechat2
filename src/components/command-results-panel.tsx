'use client';

/**
 * CommandResultsPanel - 指令执行结果面板组件
 * 用于 Agent A 查看和管理所有执行结果
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommandResultCard } from '@/components/command-result-card';
import { CommandResult } from '@/lib/types/command-result';
import { RefreshCw, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CommandResultsPanelProps {
  toAgentId: string;
  onClose?: () => void; // 🔥 新增：关闭回调
}

export function CommandResultsPanel({ toAgentId, onClose }: CommandResultsPanelProps) {
  const router = useRouter();
  const [results, setResults] = useState<CommandResult[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // 处理统计卡片点击
  const handleStatClick = (type: string) => {
    switch (type) {
      case 'intervention':
        // 跳转到需要介入的任务列表
        router.push(`/command-results?filter=requiresIntervention`);
        break;
      case 'report':
        // 跳转到报告列表
        router.push('/reports');
        break;
      case 'timeout-subtask':
        // 跳转到超时子任务列表
        router.push('/subtasks?filter=timeout');
        break;
      case 'timeout-task':
        // 跳转到超长任务列表
        router.push('/command-results?filter=longRunning');
        break;
      case 'report-pending':
        // 跳转到待审核报告列表
        router.push('/reports?filter=pending');
        break;
      default:
        break;
    }
  };

  // 加载执行结果
  const loadResults = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/command-results?toAgentId=${toAgentId}&limit=50`
      );
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      }
    } catch (error) {
      console.error('加载执行结果失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载统计信息
  const loadStats = async () => {
    try {
      const response = await fetch(`/api/command-results/stats?toAgentId=${toAgentId}`);
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    loadResults();
    loadStats();
  }, [toAgentId]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadResults();
      loadStats();
    }, 30000); // 每30秒刷新一次

    return () => clearInterval(interval);
  }, [toAgentId, autoRefresh]);

  // 过滤结果
  const filteredResults = results.filter((result) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return result.executionStatus === 'pending';
    if (activeTab === 'in_progress') return result.executionStatus === 'in_progress';
    if (activeTab === 'completed') return result.executionStatus === 'completed';
    if (activeTab === 'failed') return result.executionStatus === 'failed';
    if (activeTab === 'blocked') return result.executionStatus === 'blocked';
    return true;
  });

  return (
    <Card className={`fixed right-4 top-4 shadow-lg z-50 transition-all duration-300 ${
      isMinimized ? 'w-auto h-auto' : 'w-96 max-h-[calc(100vh-2rem)] flex flex-col'
    }`}>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className={isMinimized ? "flex items-center gap-3" : ""}>
            <CardTitle className={`text-lg ${isMinimized ? "text-base" : ""}`}>执行结果</CardTitle>
            {!isMinimized && (
              <CardDescription className="text-xs">
                各 Agent 的指令执行反馈
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isMinimized && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  loadResults();
                  loadStats();
                }}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "展开" : "最小化"}
            >
              {isMinimized ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                title="关闭"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* 统计信息 */}
        {stats && (
          <div className={`space-y-2 ${isMinimized ? '' : ''}`}>
            {/* 基础统计 */}
            <div className={`flex items-center gap-2 flex-wrap ${isMinimized ? 'gap-1' : ''}`}>
              <Badge variant="secondary" className="text-xs">
                {isMinimized ? stats.total : `总计: ${stats.total}`}
              </Badge>
              {isMinimized ? (
                <>
                  {stats.pending > 0 && (
                    <Badge variant="outline" className="text-xs text-blue-500">
                      {stats.pending}
                    </Badge>
                  )}
                  {stats.inProgress > 0 && (
                    <Badge variant="outline" className="text-xs text-yellow-500">
                      {stats.inProgress}
                    </Badge>
                  )}
                  {stats.failed > 0 && (
                    <Badge variant="outline" className="text-xs text-red-500">
                      {stats.failed}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Badge variant="outline" className="text-xs text-blue-500">
                    待处理: {stats.pending}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-yellow-500">
                    进行中: {stats.inProgress}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-green-500">
                    已完成: {stats.completed}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-red-500">
                    失败: {stats.failed}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-orange-500">
                    阻塞: {stats.blocked}
                  </Badge>
                </>
              )}
            </div>

            {/* 高级统计 - 仅展开时显示 */}
            {!isMinimized && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* 介入统计 */}
                {(stats.requiresIntervention > 0 || stats.reportCount > 0) && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">介入:</span>
                    <Badge
                      variant={stats.requiresIntervention > 0 ? "destructive" : "outline"}
                      className="text-xs cursor-pointer hover:opacity-80"
                      onClick={() => handleStatClick('intervention')}
                    >
                      {stats.requiresIntervention}
                    </Badge>
                    <Badge
                      variant={stats.reportCount > 0 ? "default" : "outline"}
                      className="text-xs cursor-pointer hover:opacity-80"
                      onClick={() => handleStatClick('report')}
                    >
                      {stats.reportCount} 上报
                    </Badge>
                  </div>
                )}

                {/* 超时统计 */}
                {(stats.timeoutSubtasks > 0 || stats.longRunningTasks > 0) && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">超时:</span>
                    <Badge
                      variant={stats.timeoutSubtasks > 0 ? "destructive" : "outline"}
                      className="text-xs cursor-pointer hover:opacity-80"
                      onClick={() => handleStatClick('timeout-subtask')}
                    >
                      {stats.timeoutSubtasks}
                    </Badge>
                <Badge
                      variant={stats.longRunningTasks > 0 ? "destructive" : "outline"}
                      className="text-xs cursor-pointer hover:opacity-80"
                      onClick={() => handleStatClick('timeout-task')}
                    >
                      {stats.longRunningTasks}
                    </Badge>
                  </div>
                )}

                {/* 报告统计 */}
                {stats.pendingReports > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-xs cursor-pointer hover:opacity-80"
                    onClick={() => handleStatClick('report-pending')}
                  >
                    {stats.pendingReports} 待审报告
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        {/* 标签页 - 仅在展开时显示 */}
        {!isMinimized && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all" className="text-xs">
                全部
              </TabsTrigger>
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
              <TabsTrigger value="blocked" className="text-xs">
                阻塞
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </CardHeader>

      {/* 内容区域 - 仅在展开时显示 */}
      {!isMinimized && (
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <div className="p-4 space-y-3">
              {filteredResults.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  暂无执行结果
                </div>
              ) : (
                filteredResults.map((result) => (
                  <CommandResultCard key={result.id || result.commandId} result={result} />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
