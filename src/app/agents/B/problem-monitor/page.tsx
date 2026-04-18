/**
 * 架构师问题监控页面
 * 用于展示 Agent C、D 上报的问题，并提供处理界面
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  User, 
  Wrench,
  RefreshCw,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { AgentWebSocketStatus } from '@/components/agent-websocket-status';
import {
  ProblemReport,
  ProblemStatus,
  ProblemPriority,
  ProblemType,
  PROBLEM_TYPE_MAP,
  PROBLEM_PRIORITY_MAP,
  PROBLEM_STATUS_MAP,
  PROBLEM_PRIORITY_COLOR,
  PROBLEM_STATUS_COLOR,
} from '@/lib/problem-report/types';

export default function ArchitectProblemMonitor() {
  const [problems, setProblems] = useState<ProblemReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProblem, setSelectedProblem] = useState<ProblemReport | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProblemStatus>('pending');

  // 加载问题列表
  const loadProblems = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/agents/problem-report?status=${filterStatus}`);
      const data = await response.json();

      if (data.success) {
        setProblems(data.data.problems);
      } else {
        setError(data.error || '加载问题列表失败');
      }
    } catch (err: any) {
      setError(err.message || '加载问题列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 优化：使用页面可见性 API 替代定时轮询
  useEffect(() => {
    loadProblems();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadProblems();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [filterStatus]);

  // 处理问题
  const handleSolveProblem = async (problemId: string, solution: string, solutionType: 'automatic' | 'manual') => {
    try {
      const response = await fetch(`/api/agents/problem-report/${problemId}/solve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solutionType,
          solution,
          solutionLogs: [],
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(data.data.message);
        loadProblems(); // 刷新列表
      } else {
        alert(data.error || '处理失败');
      }
    } catch (err: any) {
      alert(err.message || '处理失败');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        {/* 头部 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/agents/B">
              <Button variant="ghost" size="sm">
                <Wrench className="h-4 w-4 mr-2" />
                返回 Agent B 对话
              </Button>
            </Link>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadProblems}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>
          </div>
          <Card className="p-6">
            <h1 className="text-2xl font-bold mb-2">问题监控中心</h1>
            <p className="text-muted-foreground">
              监控并处理 Agent C、D 上报的执行困难问题
            </p>
          </Card>
        </div>

        {/* WebSocket 状态 */}
        <AgentWebSocketStatus agentId="B" />

        {/* 筛选器 */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">筛选状态：</span>
            <div className="flex gap-2">
              {(['pending', 'analyzing', 'auto_solving', 'human_review', 'solved'] as ProblemStatus[]).map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                >
                  {PROBLEM_STATUS_MAP[status]}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* 问题列表 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 左侧：问题列表 */}
          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-4">
              问题列表 ({problems.length})
            </h2>
            {loading && (
              <div className="text-center py-8 text-muted-foreground">
                加载中...
              </div>
            )}
            {!loading && problems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                暂无问题
              </div>
            )}
            {!loading && problems.length > 0 && (
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {problems.map((problem) => (
                    <Card
                      key={problem.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedProblem?.id === problem.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedProblem(problem)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={PROBLEM_PRIORITY_COLOR[problem.priority]}>
                              {PROBLEM_PRIORITY_MAP[problem.priority]}
                            </Badge>
                            <span className="text-sm font-medium">
                              {PROBLEM_TYPE_MAP[problem.problemType]}
                            </span>
                          </div>
                          <h3 className="font-medium">{problem.title}</h3>
                        </div>
                        <Badge className={PROBLEM_STATUS_COLOR[problem.status]}>
                          {PROBLEM_STATUS_MAP[problem.status]}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {problem.fromAgentName} · {new Date(problem.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* 右侧：问题详情 */}
          <Card className="p-4">
            {selectedProblem ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">问题详情</h2>

                {/* 基本信息 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">上报者：</span>
                    <span>{selectedProblem.fromAgentName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">上报时间：</span>
                    <span>{new Date(selectedProblem.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">优先级：</span>
                    <Badge className={PROBLEM_PRIORITY_COLOR[selectedProblem.priority]}>
                      {PROBLEM_PRIORITY_MAP[selectedProblem.priority]}
                    </Badge>
                  </div>
                </div>

                {/* 问题描述 */}
                <div>
                  <h3 className="font-medium mb-2">问题描述</h3>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm">
                    {selectedProblem.description}
                  </div>
                </div>

                {/* 上下文信息 */}
                {selectedProblem.context && Object.keys(selectedProblem.context).length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">上下文信息</h3>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                      {Object.entries(selectedProblem.context).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-medium">{key}：</span>
                          <span className="text-muted-foreground">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 建议解决方案 */}
                {selectedProblem.suggestedSolution && (
                  <div>
                    <h3 className="font-medium mb-2">建议解决方案</h3>
                    <div className="bg-blue-50 p-3 rounded-lg text-sm">
                      {selectedProblem.suggestedSolution}
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                {selectedProblem.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSolveProblem(selectedProblem.id!, '我可以自动解决这个问题', 'automatic')}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      自动解决
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSolveProblem(selectedProblem.id!, '需要人类介入处理', 'manual')}
                      className="flex-1"
                    >
                      <User className="h-4 w-4 mr-2" />
                      人工介入
                    </Button>
                  </div>
                )}

                {/* 已解决 */}
                {selectedProblem.status === 'solved' && (
                  <div className="bg-green-50 p-3 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">问题已解决</span>
                    </div>
                    {selectedProblem.solution && (
                      <div className="mt-2">
                        <span className="font-medium">解决方案：</span>
                        <div className="text-muted-foreground">{selectedProblem.solution}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                请选择一个问题查看详情
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
