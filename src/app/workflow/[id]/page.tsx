'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle2, Clock, XCircle, Play, Pause, RefreshCw, AlertCircle, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Workflow {
  id: string;
  title: string;
  description: string;
  status: string;
  currentStep: number;
  steps: any[];
  startedAt: string;
  completedAt?: string;
  metadata?: any;
}

interface WorkflowTemplate {
  id: string;
  stage: string;
  name: string;
  description: string;
  fromAgent?: string;
  toAgent?: string[];
  order: number;
  required: boolean;
  estimatedDuration: number;
  requiresHumanConfirmation?: boolean;
  confirmationMessage?: string;
}

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [template, setTemplate] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmingStep, setConfirmingStep] = useState<any>(null);
  const [confirmComment, setConfirmComment] = useState('');

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
  }, [workflowId, autoRefresh]);

  const loadData = async () => {
    try {
      const [workflowRes, templateRes] = await Promise.all([
        fetch(`/api/workflow/${workflowId}`),
        fetch('/api/workflow/template'),
      ]);

      const workflowData = await workflowRes.json();
      const templateData = await templateRes.json();

      if (workflowData.success) setWorkflow(workflowData.data);
      if (templateData.success) setTemplate(templateData.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStep = async (stepId: string, action: string, result?: string) => {
    try {
      const response = await fetch(`/api/workflow/${workflowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          action,
          result,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setWorkflow(data.data);
      }
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  const handleConfirm = async (approved: boolean) => {
    if (!confirmingStep) return;

    try {
      const response = await fetch(`/api/workflow/${workflowId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: confirmingStep.stepId,
          agentId: confirmingStep.assignedTo,
          approved,
          comment: confirmComment,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setWorkflow(data.data);
        setShowConfirmDialog(false);
        setConfirmComment('');
        setConfirmingStep(null);
      }
    } catch (error) {
      console.error('Error confirming step:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      case 'pending': return 'bg-gray-400';
      default: return 'bg-gray-500';
    }
  };

  const getAgentColor = (id: string) => {
    switch (id) {
      case 'A': return 'bg-red-500';
      case 'B': return 'bg-blue-500';
      case 'C': return 'bg-green-500';
      case 'D': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStageLabel = (stage: string) => {
    const stageMap: Record<string, string> = {
      'strategy_planning': '战略规划',
      'execution': '执行',
      'reporting': '反馈报告',
      'experience_extraction': '经验提取',
      'iteration_proposal': '迭代方案',
      'decision_making': '审核决策',
      'implementation': '规则落地',
      'validation': '效果验证',
      'acceptance': '验收',
    };
    return stageMap[stage] || stage;
  };

  if (loading || !workflow) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const progress = (workflow.currentStep / template.length) * 100;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        {/* 头部 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{workflow.title}</h1>
                <p className="text-muted-foreground mt-1">{workflow.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {autoRefresh ? '自动刷新' : '手动刷新'}
              </Button>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>
          </div>
        </div>

        {/* 状态卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">当前状态</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`h-3 w-3 rounded-full ${getStatusColor(workflow.status)}`} />
              <span className="text-lg font-semibold">
                {workflow.status === 'running' ? '进行中' :
                 workflow.status === 'completed' ? '已完成' :
                 workflow.status === 'failed' ? '失败' :
                 workflow.status === 'paused' ? '已暂停' : '待启动'}
              </span>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">执行进度</div>
            <div className="text-2xl font-bold mt-2">
              {workflow.currentStep} / {template.length}
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">开始时间</div>
            <div className="text-lg font-semibold mt-2">
              {new Date(workflow.startedAt).toLocaleString()}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">发起者</div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white font-bold ${getAgentColor(workflow.metadata?.initiator || 'A')}`}>
                {workflow.metadata?.initiator || 'A'}
              </span>
              <span className="text-lg font-semibold">Agent {workflow.metadata?.initiator || 'A'}</span>
            </div>
          </Card>
        </div>

        {/* 工作流程执行图 */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">执行流程</h2>
          <div className="space-y-4">
            {template.map((stepTemplate, index) => {
              const stepExecution = workflow.steps.find(s => s.stepId === stepTemplate.id);
              const isCurrent = index + 1 === workflow.currentStep;
              const isCompleted = stepExecution?.status === 'completed';
              const isRunning = stepExecution?.status === 'running';
              const isFailed = stepExecution?.status === 'failed';
              const isPending = !stepExecution || stepExecution.status === 'pending';

              return (
                <div
                  key={stepTemplate.id}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    isCurrent ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' :
                    isCompleted ? 'border-green-500 bg-green-50 dark:bg-green-950/20' :
                    isFailed ? 'border-red-500 bg-red-50 dark:bg-red-950/20' :
                    'border-gray-200 bg-muted/30'
                  }`}
                >
                  {/* 连接线 */}
                  {index < template.length - 1 && (
                    <div className={`absolute left-8 top-full h-8 w-0.5 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`} style={{ transform: 'translateY(100%)' }} />
                  )}

                  <div className="flex items-start gap-4">
                    {/* 步骤图标 */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-bold ${
                      isCompleted ? 'bg-green-500' :
                      isRunning ? 'bg-blue-500 animate-pulse' :
                      isFailed ? 'bg-red-500' :
                      'bg-gray-400'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> :
                       isRunning ? <Clock className="h-5 w-5" /> :
                       isFailed ? <XCircle className="h-5 w-5" /> :
                       index + 1}
                    </div>

                    {/* 步骤内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold">{stepTemplate.name}</h3>
                        {isCurrent && <Badge className="bg-blue-500">进行中</Badge>}
                        {isCompleted && <Badge className="bg-green-500">已完成</Badge>}
                        {isFailed && <Badge className="bg-red-500">失败</Badge>}
                        {isPending && <Badge variant="secondary">待启动</Badge>}
                        {stepTemplate.required && <Badge variant="destructive">必需</Badge>}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {stepTemplate.description}
                      </p>

                      {/* Agent 流转 */}
                      <div className="flex items-center gap-2 mb-3">
                        {stepTemplate.fromAgent && (
                          <span className="flex items-center gap-1">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold ${getAgentColor(stepTemplate.fromAgent)}`}>
                              {stepTemplate.fromAgent}
                            </span>
                            <span className="text-xs">发起</span>
                          </span>
                        )}
                        {stepTemplate.toAgent && stepTemplate.toAgent.length > 0 && (
                          <>
                            <span className="text-gray-400">→</span>
                            <div className="flex gap-1">
                              {stepTemplate.toAgent.map((agent) => (
                                <span key={agent} className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold ${getAgentColor(agent)}`}>
                                  {agent}
                                </span>
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">执行</span>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          预计 {stepTemplate.estimatedDuration} 分钟
                        </span>
                      </div>

                      {/* 步骤结果和反馈 */}
                      {stepExecution && (stepExecution.result || stepExecution.feedback) && (
                        <div className="mt-3 space-y-2">
                          {stepExecution.result && (
                            <div className="bg-background p-3 rounded border">
                              <div className="text-xs font-semibold text-muted-foreground mb-1">执行结果：</div>
                              <div className="text-sm">{stepExecution.result}</div>
                            </div>
                          )}
                          {stepExecution.feedback && (
                            <div className="bg-background p-3 rounded border">
                              <div className="text-xs font-semibold text-muted-foreground mb-1">反馈：</div>
                              <div className="text-sm">{stepExecution.feedback}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      {isCurrent && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              const result = prompt('请输入执行结果：');
                              if (result) updateStep(stepTemplate.id, 'complete', result);
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            完成步骤
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const feedback = prompt('请输入失败原因：');
                              if (feedback) updateStep(stepTemplate.id, 'fail', undefined, feedback);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            标记失败
                          </Button>
                        </div>
                      )}

                      {/* 等待确认提示 */}
                      {isCompleted && stepTemplate.requiresHumanConfirmation && stepExecution.result && (
                        <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">等待确认</span>
                          </div>
                          <p className="text-sm text-orange-600 dark:text-orange-500 mb-2">
                            {stepTemplate.confirmationMessage}
                          </p>
                          <Button
                            size="sm"
                            onClick={() => {
                              setConfirmingStep(stepExecution);
                              setShowConfirmDialog(true);
                            }}
                          >
                            确认此步骤
                          </Button>
                        </div>
                      )}

                      {/* 时间信息 */}
                      {stepExecution && (stepExecution.startedAt || stepExecution.completedAt) && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {stepExecution.startedAt && (
                            <span>开始：{new Date(stepExecution.startedAt).toLocaleString()}</span>
                          )}
                          {stepExecution.startedAt && stepExecution.completedAt && <span className="mx-2">|</span>}
                          {stepExecution.completedAt && (
                            <span>完成：{new Date(stepExecution.completedAt).toLocaleString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 确认对话框 */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认工作流程步骤</DialogTitle>
              <DialogDescription>
                {confirmingStep && template.find(t => t.id === confirmingStep.stepId)?.confirmationMessage}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {confirmingStep?.result && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-sm font-medium mb-1">执行结果：</div>
                  <div className="text-sm text-muted-foreground">{confirmingStep.result}</div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-2 block">确认意见（可选）</label>
                <Textarea
                  value={confirmComment}
                  onChange={(e) => setConfirmComment(e.target.value)}
                  placeholder="请输入您的确认意见或建议..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setConfirmComment('');
                  setConfirmingStep(null);
                }}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleConfirm(false)}
              >
                <X className="h-4 w-4 mr-2" />
                拒绝
              </Button>
              <Button
                onClick={() => handleConfirm(true)}
              >
                <Check className="h-4 w-4 mr-2" />
                确认通过
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
