'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Play, RefreshCw, CheckCircle2, XCircle, Clock, ArrowRight, Eye, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';

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
}

export default function WorkflowPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [template, setTemplate] = useState<WorkflowTemplate[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const [newWorkflow, setNewWorkflow] = useState({
    title: '',
    description: '',
    initiator: 'A',
    priority: 'MEDIUM',
    tags: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [workflowsRes, templateRes, statsRes] = await Promise.all([
        fetch('/api/workflow'),
        fetch('/api/workflow/template'),
        fetch('/api/workflow/stats'),
      ]);

      const workflowsData = await workflowsRes.json();
      const templateData = await templateRes.json();
      const statsData = await statsRes.json();

      if (workflowsData.success) setWorkflows(workflowsData.data);
      if (templateData.success) setTemplate(templateData.data);
      if (statsData.success) setStats(statsData.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      const response = await fetch('/api/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newWorkflow,
          tags: newWorkflow.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateDialog(false);
        setNewWorkflow({ title: '', description: '', initiator: 'A', priority: 'MEDIUM', tags: '' });
        loadData();
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running': return '进行中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      case 'paused': return '已暂停';
      case 'pending': return '待启动';
      default: return status;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        {/* 头部 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">工作流程管理</h1>
              <p className="text-muted-foreground mt-2">
                管理 10 步闭环工作流程：战略制定 → 执行 → 反馈 → 优化 → 验证 → 推广
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    创建工作流程
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>创建新的工作流程</DialogTitle>
                    <DialogDescription>
                      启动一个新的 10 步闭环工作流程
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">标题</label>
                      <Input
                        value={newWorkflow.title}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, title: e.target.value })}
                        placeholder="输入工作流程标题"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">描述</label>
                      <Textarea
                        value={newWorkflow.description}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                        placeholder="输入工作流程描述"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">发起者</label>
                        <Select
                          value={newWorkflow.initiator}
                          onValueChange={(value) => setNewWorkflow({ ...newWorkflow, initiator: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">Agent A - 战略决策者</SelectItem>
                            <SelectItem value="B">Agent B - 技术落地人</SelectItem>
                            <SelectItem value="C">Agent C - 运营数据反馈人</SelectItem>
                            <SelectItem value="D">Agent D - 内容数据反馈人</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">优先级</label>
                        <Select
                          value={newWorkflow.priority}
                          onValueChange={(value) => setNewWorkflow({ ...newWorkflow, priority: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOW">低</SelectItem>
                            <SelectItem value="MEDIUM">中</SelectItem>
                            <SelectItem value="HIGH">高</SelectItem>
                            <SelectItem value="URGENT">紧急</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">标签（逗号分隔）</label>
                      <Input
                        value={newWorkflow.tags}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, tags: e.target.value })}
                        placeholder="例如：战略,优化,A/B测试"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      取消
                    </Button>
                    <Button onClick={handleCreateWorkflow}>
                      创建
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">总工作流程</div>
              <div className="text-2xl font-bold mt-1">{stats.total}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">进行中</div>
              <div className="text-2xl font-bold mt-1 text-blue-600">
                {stats.byStatus?.running || 0}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">已完成</div>
              <div className="text-2xl font-bold mt-1 text-green-600">
                {stats.byStatus?.completed || 0}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">成功率</div>
              <div className="text-2xl font-bold mt-1">
                {((stats.successRate || 0) * 100).toFixed(1)}%
              </div>
            </Card>
          </div>
        )}

        {/* 工作流程列表 */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">工作流程列表</h2>
          {workflows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              暂无工作流程，点击"创建工作流程"开始
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => (
                <Card key={workflow.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{workflow.title}</h3>
                        <Badge className={`${getStatusColor(workflow.status)} text-white`}>
                          {getStatusLabel(workflow.status)}
                        </Badge>
                        <Badge variant="outline">
                          步骤 {workflow.currentStep}/10
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {workflow.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {new Date(workflow.startedAt).toLocaleString()}
                        </span>
                        {workflow.metadata?.initiator && (
                          <span className="flex items-center gap-1">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white text-xs font-bold ${getAgentColor(workflow.metadata.initiator)}`}>
                              {workflow.metadata.initiator}
                            </span>
                            发起者
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/workflow/${workflow.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          查看执行
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedWorkflow(workflow);
                          setShowDetailDialog(true);
                        }}
                      >
                        预览
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {/* 工作流程模板 */}
        <Card className="p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">工作流程模板（10 步闭环）</h2>
          <div className="space-y-3">
            {template.map((step) => (
              <div key={step.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white font-bold text-sm flex-shrink-0 ${getAgentColor(step.fromAgent || 'A')}`}>
                  {step.order}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{step.name}</h3>
                    {step.required && <Badge variant="destructive">必需</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {step.fromAgent && (
                      <span className="flex items-center gap-1 text-xs">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-white text-xs font-bold ${getAgentColor(step.fromAgent)}`}>
                          {step.fromAgent}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    )}
                    {step.toAgent && step.toAgent.length > 0 && (
                      <div className="flex gap-1">
                        {step.toAgent.map((agent) => (
                          <span key={agent} className={`flex h-5 w-5 items-center justify-center rounded-full text-white text-xs font-bold ${getAgentColor(agent)}`}>
                            {agent}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      预计 {step.estimatedDuration} 分钟
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedWorkflow?.title}</DialogTitle>
            <DialogDescription>{selectedWorkflow?.description}</DialogDescription>
          </DialogHeader>
          {selectedWorkflow && (
            <div className="space-y-4 py-4">
              {selectedWorkflow.steps.map((stepExec, index) => {
                const stepTemplate = template.find(t => t.id === stepExec.stepId);
                return (
                  <div
                    key={stepExec.stepId}
                    className={`p-4 rounded-lg border-2 ${
                      stepExec.status === 'completed'
                        ? 'border-green-500 bg-green-50 dark:bg-green-950'
                        : stepExec.status === 'running'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : stepExec.status === 'failed'
                        ? 'border-red-500 bg-red-50 dark:bg-red-950'
                        : 'border-gray-300 bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold ${getAgentColor(stepTemplate?.fromAgent || 'A')}`}>
                        {index + 1}
                      </div>
                      <h3 className="font-semibold">{stepTemplate?.name}</h3>
                      <Badge variant={stepExec.status === 'completed' ? 'default' : 'secondary'}>
                        {stepExec.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {stepExec.status === 'running' && <Clock className="h-3 w-3 mr-1" />}
                        {stepExec.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                        {stepExec.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{stepTemplate?.description}</p>
                    {stepExec.result && (
                      <div className="bg-background p-2 rounded text-sm mt-2">
                        <strong>结果：</strong>{stepExec.result}
                      </div>
                    )}
                    {stepExec.feedback && (
                      <div className="bg-background p-2 rounded text-sm mt-2">
                        <strong>反馈：</strong>{stepExec.feedback}
                      </div>
                    )}
                    {stepExec.startedAt && (
                      <div className="text-xs text-muted-foreground mt-2">
                        开始时间：{new Date(stepExec.startedAt).toLocaleString()}
                      </div>
                    )}
                    {stepExec.completedAt && (
                      <div className="text-xs text-muted-foreground">
                        完成时间：{new Date(stepExec.completedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
