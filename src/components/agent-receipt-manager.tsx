'use client';

/**
 * AgentReceiptManager - Agent 回执和状态反馈管理组件
 * 为执行端 Agent 提供标准化的回执和状态反馈功能
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, FileText, Clock, AlertCircle, Copy } from 'lucide-react';

interface ReceiptFormProps {
  agentId: string;
  onReceiptGenerated?: (receipt: string) => void;
}

export function ReceiptForm({ agentId, onReceiptGenerated }: ReceiptFormProps) {
  const [taskId, setTaskId] = useState('');
  const [status, setStatus] = useState<'success' | 'failed'>('success');
  const [failureReason, setFailureReason] = useState('');
  const [generatedReceipt, setGeneratedReceipt] = useState('');

  const handleGenerateReceipt = () => {
    const params = {
      taskId: taskId || undefined,
      status,
      failureReason: status === 'failed' ? failureReason : undefined,
    };

    fetch('/api/agents/receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'receipt',
        params,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setGeneratedReceipt(data.data.content);
          onReceiptGenerated?.(data.data.content);
        } else {
          alert(data.error || '生成失败');
        }
      })
      .catch((error) => {
        console.error('生成回执失败:', error);
        alert('生成失败，请重试');
      });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedReceipt);
    alert('已复制到剪贴板');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          指令接收回执生成
        </CardTitle>
        <CardDescription>
          接收 Agent A 下达的任何指令/任务后，必须在1分钟内完成回执反馈
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="taskId">任务 ID</Label>
          <Input
            id="taskId"
            placeholder="输入任务 ID，无 ID 可留空"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">指令接收状态</Label>
          <Select value={status} onValueChange={(value: 'success' | 'failed') => setStatus(value)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="success">成功</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {status === 'failed' && (
          <div className="space-y-2">
            <Label htmlFor="failureReason">失败原因</Label>
            <Input
              id="failureReason"
              placeholder="如：指令无核心任务ID"
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
            />
          </div>
        )}

        <Button onClick={handleGenerateReceipt} className="w-full">
          生成回执
        </Button>

        {generatedReceipt && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>生成的回执</Label>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-1" />
                复制
              </Button>
            </div>
            <Textarea
              value={generatedReceipt}
              readOnly
              rows={4}
              className="font-mono text-sm bg-gray-50"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatusFeedbackFormProps {
  agentId: string;
  onFeedbackGenerated?: (feedback: string) => void;
}

export function StatusFeedbackForm({ agentId, onFeedbackGenerated }: StatusFeedbackFormProps) {
  const [taskId, setTaskId] = useState('');
  const [taskName, setTaskName] = useState('');
  const [receivedTime, setReceivedTime] = useState('');
  const [executionStatus, setExecutionStatus] = useState<'not-started' | 'in-progress' | 'completed' | 'paused'>('not-started');
  const [executionStatusReason, setExecutionStatusReason] = useState('');
  const [progress, setProgress] = useState('');
  const [completedNodes, setCompletedNodes] = useState('');
  const [pendingItems, setPendingItems] = useState('');
  const [issues, setIssues] = useState('');
  const [generatedFeedback, setGeneratedFeedback] = useState('');

  useEffect(() => {
    // 默认设置为当前时间
    const now = new Date();
    const formattedTime = now.toISOString().slice(0, 16).replace('T', ' ');
    setReceivedTime(formattedTime);
  }, []);

  const handleGenerateFeedback = () => {
    const params = {
      taskId,
      taskName,
      receivedTime,
      executionStatus,
      executionStatusReason: executionStatus === 'paused' ? executionStatusReason : undefined,
      progress,
      completedNodes: completedNodes ? completedNodes.split('、') : [],
      pendingItems: pendingItems ? pendingItems.split('、') : [],
      issues,
    };

    fetch('/api/agents/receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'status-feedback',
        params,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setGeneratedFeedback(data.data.content);
          onFeedbackGenerated?.(data.data.content);
        } else {
          alert(data.error || '生成失败');
        }
      })
      .catch((error) => {
        console.error('生成状态反馈失败:', error);
        alert('生成失败，请重试');
      });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedFeedback);
    alert('已复制到剪贴板');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          任务状态反馈生成
        </CardTitle>
        <CardDescription>
          收到 Agent A 的查询指令后立即反馈（无延迟）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="taskId">任务 ID *</Label>
            <Input
              id="taskId"
              placeholder="输入任务 ID"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="receivedTime">接收时间 *</Label>
            <Input
              id="receivedTime"
              type="text"
              value={receivedTime}
              onChange={(e) => setReceivedTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="taskName">任务名称 *</Label>
          <Input
            id="taskName"
            placeholder="输入任务名称"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="executionStatus">当前执行状态 *</Label>
          <Select value={executionStatus} onValueChange={(value: any) => setExecutionStatus(value)}>
            <SelectTrigger id="executionStatus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not-started">未开始</SelectItem>
              <SelectItem value="in-progress">执行中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="paused">暂停</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {executionStatus === 'paused' && (
          <div className="space-y-2">
            <Label htmlFor="executionStatusReason">暂停原因 *</Label>
            <Input
              id="executionStatusReason"
              placeholder="如：等待素材"
              value={executionStatusReason}
              onChange={(e) => setExecutionStatusReason(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="progress">核心完成进度 *</Label>
          <Input
            id="progress"
            placeholder="如：内容创作完成8/10篇"
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="completedNodes">已完成核心节点</Label>
          <Textarea
            id="completedNodes"
            placeholder="用「、」分隔，如：选题审核通过、3篇文章上传草稿箱"
            value={completedNodes}
            onChange={(e) => setCompletedNodes(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pendingItems">待办核心事项</Label>
          <Textarea
            id="pendingItems"
            placeholder="用「、」分隔，如：剩余2篇文章18:00前完成、明日10:00前提交周复盘"
            value={pendingItems}
            onChange={(e) => setPendingItems(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="issues">当前问题/异常 *</Label>
          <Textarea
            id="issues"
            placeholder="无或具体障碍，如：公众号后台无法访问"
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            rows={2}
          />
        </div>

        <Button onClick={handleGenerateFeedback} className="w-full">
          生成状态反馈
        </Button>

        {generatedFeedback && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>生成的状态反馈</Label>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-1" />
                复制
              </Button>
            </div>
            <Textarea
              value={generatedFeedback}
              readOnly
              rows={6}
              className="font-mono text-sm bg-gray-50"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AgentReceiptManagerProps {
  agentId: string;
}

export function AgentReceiptManager({ agentId }: AgentReceiptManagerProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">回执和状态反馈管理</h3>
        <Badge variant="outline">{agentId}</Badge>
      </div>

      <Tabs defaultValue="receipt" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="receipt">指令接收回执</TabsTrigger>
          <TabsTrigger value="status-feedback">任务状态反馈</TabsTrigger>
        </TabsList>

        <TabsContent value="receipt" className="mt-4">
          <ReceiptForm agentId={agentId} />
        </TabsContent>

        <TabsContent value="status-feedback" className="mt-4">
          <StatusFeedbackForm agentId={agentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
