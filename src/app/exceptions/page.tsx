'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Clock, User, MessageSquare } from 'lucide-react';
import { ExceptionResolveModal } from '@/components/exceptions/exception-resolve-modal';

interface SplitFailure {
  failureId: string;
  taskId: string;
  taskName: string;
  coreCommand: string;
  failureReason: string;
  retryCount: number;
  exceptionStatus: 'pending' | 'processing' | 'resolved' | 'cancelled';
  exceptionPriority: 'urgent' | 'high' | 'normal' | 'low';
  assignedTo: string;
  createdAt: string;
  agentBResponses: Array<{ attempt: number; content: string; error: string; timestamp: string }>;
}

export default function ExceptionsPage() {
  const [failures, setFailures] = useState<SplitFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFailure, setSelectedFailure] = useState<SplitFailure | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 加载异常列表
  const loadFailures = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/exceptions?status=pending&limit=20');
      const result = await response.json();

      if (result.success) {
        setFailures(result.data);
      }
    } catch (error) {
      console.error('加载异常列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFailures();
  }, []);

  // 处理异常
  const handleResolve = async (failureId: string) => {
    const failure = failures.find(f => f.failureId === failureId);
    if (failure) {
      setSelectedFailure(failure);
      setShowDetailModal(true);
    }
  };

  // 分配异常
  const handleAssign = async (failureId: string) => {
    try {
      const response = await fetch(`/api/exceptions/${failureId}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignedTo: 'A', // 默认分配给 Agent A
          notes: '人工处理中',
        }),
      });

      if (response.ok) {
        alert('异常已分配');
        loadFailures();
      }
    } catch (error) {
      console.error('分配异常失败:', error);
      alert('分配异常失败');
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500';
      case 'processing':
        return 'bg-blue-500';
      case 'resolved':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'normal':
        return 'bg-blue-500';
      case 'low':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">异常补偿管理</h1>
        <p className="text-gray-600 mt-2">管理 Agent B 拆解失败的异常任务</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {failures.filter(f => f.exceptionStatus === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">处理中</CardTitle>
            <User className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {failures.filter(f => f.exceptionStatus === 'processing').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已解决</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {failures.filter(f => f.exceptionStatus === 'resolved').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">紧急</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {failures.filter(f => f.exceptionPriority === 'urgent').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 异常列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-2 text-gray-600">加载中...</p>
          </div>
        ) : failures.length === 0 ? (
          <Card>
            <CardContent className="py-10">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-600">暂无待处理的异常</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          failures.map((failure) => (
            <Card key={failure.failureId} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{failure.taskName}</CardTitle>
                      <Badge className={getPriorityColor(failure.exceptionPriority)}>
                        {failure.exceptionPriority === 'urgent' ? '紧急' :
                         failure.exceptionPriority === 'high' ? '高' :
                         failure.exceptionPriority === 'normal' ? '普通' : '低'}
                      </Badge>
                      <Badge className={getStatusColor(failure.exceptionStatus)}>
                        {failure.exceptionStatus === 'pending' ? '待处理' :
                         failure.exceptionStatus === 'processing' ? '处理中' :
                         failure.exceptionStatus === 'resolved' ? '已解决' : '已取消'}
                      </Badge>
                    </div>
                    <CardDescription>任务ID: {failure.taskId}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAssign(failure.failureId)}
                      disabled={failure.exceptionStatus === 'processing' || failure.exceptionStatus === 'resolved'}
                    >
                      <User className="h-4 w-4 mr-1" />
                      分配
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleResolve(failure.failureId)}
                      disabled={failure.exceptionStatus === 'resolved'}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      处理
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* 失败原因 */}
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">失败原因</AlertTitle>
                    <AlertDescription className="text-sm">
                      {failure.failureReason}
                    </AlertDescription>
                  </Alert>

                  {/* 原始指令 */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">原始指令:</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{failure.coreCommand}</p>
                  </div>

                  {/* 重试信息 */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>重试次数: {failure.retryCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>创建时间: {new Date(failure.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 异常处理弹窗 */}
      <ExceptionResolveModal
        exception={selectedFailure}
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        onSuccess={loadFailures}
      />
    </div>
  );
}
