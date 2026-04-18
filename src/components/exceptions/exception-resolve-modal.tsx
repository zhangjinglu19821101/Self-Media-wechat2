'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

interface SubTask {
  taskTitle: string;
  commandContent: string;
  executor: string;
  taskType: string;
  priority: string;
  deadline?: string;
  estimatedHours?: number;
  acceptanceCriteria?: string;
}

interface Exception {
  failureId: string;
  taskId: string;
  taskName: string;
  coreCommand: string;
  failureReason: string;
  retryCount: number;
  agentBResponses: Array<{ attempt: number; content: string; error: string; timestamp: string }>;
}

interface ExceptionResolveModalProps {
  exception: Exception | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ExceptionResolveModal({
  exception,
  open,
  onOpenChange,
  onSuccess,
}: ExceptionResolveModalProps) {
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'input'>('history');

  // 添加子任务
  const addSubTask = () => {
    setSubTasks([
      ...subTasks,
      {
        taskTitle: '',
        commandContent: '',
        executor: 'insurance-c',
        taskType: '内容生产',
        priority: '高',
        deadline: '',
        estimatedHours: undefined,
        acceptanceCriteria: '',
      },
    ]);
  };

  // 删除子任务
  const removeSubTask = (index: number) => {
    setSubTasks(subTasks.filter((_, i) => i !== index));
  };

  // 更新子任务
  const updateSubTask = (index: number, field: keyof SubTask, value: any) => {
    const updated = [...subTasks];
    updated[index] = { ...updated[index], [field]: value };
    setSubTasks(updated);
  };

  // 提交解决
  const handleSubmit = async () => {
    if (!exception) return;
    
    if (subTasks.length === 0) {
      alert('请至少添加一个子任务');
      return;
    }

    // 验证必填字段
    const invalidTasks = subTasks.filter(
      t => !t.taskTitle || !t.commandContent || !t.executor
    );
    if (invalidTasks.length > 0) {
      alert('请填写所有必填字段（任务标题、指令内容、执行主体）');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/exceptions/${exception.failureId}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          manualSplitResult: {
            subTasks,
            totalDeliverables: String(subTasks.length),
            timeFrame: '手动设定',
            summary: notes || '人工手动处理',
          },
          resolutionMethod: 'manual',
          processingNotes: notes,
          resolvedBy: 'A',
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`异常已解决，已创建 ${result.data.commandResults.length} 条子任务`);
        onOpenChange(false);
        onSuccess();
      } else {
        alert(`解决失败: ${result.error}`);
      }
    } catch (error) {
      console.error('解决异常失败:', error);
      alert('解决异常失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>处理异常拆解任务</DialogTitle>
          <DialogDescription>
            任务: {exception?.taskName} | 任务ID: {exception?.taskId}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">重试历史</TabsTrigger>
            <TabsTrigger value="input">手动输入</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>失败原因</AlertTitle>
              <AlertDescription>{exception?.failureReason}</AlertDescription>
            </Alert>

            <div>
              <Label className="text-base font-medium">原始指令</Label>
              <p className="text-sm text-gray-600 mt-1 p-3 bg-gray-50 rounded-md">
                {exception?.coreCommand}
              </p>
            </div>

            <div>
              <Label className="text-base font-medium">
                Agent B 响应历史（{exception?.agentBResponses.length} 次）
              </Label>
              <div className="space-y-3 mt-2">
                {exception?.agentBResponses.map((response, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex justify-between">
                        <span>第 {response.attempt} 次尝试</span>
                        <span className="text-xs text-gray-500">
                          {new Date(response.timestamp).toLocaleString('zh-CN')}
                        </span>
                      </CardTitle>
                      {response.error && (
                        <CardDescription className="text-red-500">
                          错误: {response.error}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 line-clamp-4">
                        {response.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="input" className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium">子任务列表</Label>
                <Button size="sm" onClick={addSubTask}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加子任务
                </Button>
              </div>

              {/* 样例说明 */}
              {subTasks.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>拆解样例说明</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>这是一个将任务拆分成 3 天的 JSON 样例，请参考此格式手动输入子任务：</p>
                    <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-x-auto">
{`{
  "totalDeliverables": "3",
  "timeFrame": "3天",
  "summary": "将保险爆文筛选任务拆解为3个每日子任务",
  "subTasks": [
    {
      "taskTitle": "第1天：筛选保险爆文",
      "commandContent": "从公众号全平台筛选2篇近3个月内阅读量≥10万的保险爆文",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高",
      "deadline": "2026-06-26",
      "estimatedHours": 4,
      "acceptanceCriteria": "筛选结果清单（包含爆文标题、阅读量、点赞数、评论数）+ 数据截图"
    },
    {
      "taskTitle": "第2天：分析爆文特征",
      "commandContent": "分析爆文特征，输出《爆文复用运营计划初稿》",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高",
      "deadline": "2026-06-27",
      "estimatedHours": 6,
      "acceptanceCriteria": "《爆文复用运营计划初稿》（包含爆文特征拆解、推送策略、获流玩法）"
    },
    {
      "taskTitle": "第3天：优化运营计划",
      "commandContent": "优化运营计划，输出最终版《爆文复用运营落地计划》",
      "executor": "insurance-c",
      "taskType": "内容生产",
      "priority": "高",
      "deadline": "2026-06-28",
      "estimatedHours": 8,
      "acceptanceCriteria": "《爆文复用运营落地计划》+《执行SOP》+ 落地准备验收清单"
    }
  ]
}`}
                    </pre>
                    <p className="text-sm text-gray-600">
                      请按照上述样例格式填写每个子任务的信息，确保必填字段（任务标题、指令内容、执行主体）都已填写。
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {subTasks.map((subTask, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-sm">子任务 {index + 1}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubTask(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">任务标题 *</Label>
                        <Input
                          value={subTask.taskTitle}
                          onChange={(e) => updateSubTask(index, 'taskTitle', e.target.value)}
                          placeholder="例如：第1天：筛选保险爆文"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">执行主体 *</Label>
                        <Input
                          value={subTask.executor}
                          onChange={(e) => updateSubTask(index, 'executor', e.target.value)}
                          placeholder="insurance-c / insurance-d"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">指令内容 *</Label>
                      <Textarea
                        value={subTask.commandContent}
                        onChange={(e) => updateSubTask(index, 'commandContent', e.target.value)}
                        placeholder="具体的任务描述"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-sm">任务类型</Label>
                        <Input
                          value={subTask.taskType}
                          onChange={(e) => updateSubTask(index, 'taskType', e.target.value)}
                          placeholder="内容生产"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">优先级</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={subTask.priority}
                          onChange={(e) => updateSubTask(index, 'priority', e.target.value)}
                        >
                          <option value="高">高</option>
                          <option value="中">中</option>
                          <option value="低">低</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-sm">截止时间</Label>
                        <Input
                          type="date"
                          value={subTask.deadline}
                          onChange={(e) => updateSubTask(index, 'deadline', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm">预计工时（小时）</Label>
                        <Input
                          type="number"
                          value={subTask.estimatedHours || ''}
                          onChange={(e) => updateSubTask(index, 'estimatedHours', Number(e.target.value))}
                          placeholder="4"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">验收标准</Label>
                        <Input
                          value={subTask.acceptanceCriteria || ''}
                          onChange={(e) => updateSubTask(index, 'acceptanceCriteria', e.target.value)}
                          placeholder="爆文清单、数据截图"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {subTasks.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed rounded-md">
                  <p className="text-gray-500">暂无子任务，点击"添加子任务"按钮开始</p>
                </div>
              )}
            </div>

            <div>
              <Label className="text-base font-medium">处理备注</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="描述处理过程和原因"
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading || subTasks.length === 0}>
            {loading ? '提交中...' : '提交解决'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
