'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Plus, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';

interface SubTask {
  id: string;
  title: string;
  description: string;
  executor: string;
  orderIndex: number;
}

const AVAILABLE_AGENTS = [
  { id: 'A', name: '战略决策者A' },
  { id: 'B', name: '架构师B' },
  { id: 'T', name: '技术专家T' },
  { id: 'C', name: '数据分析师C' },
  { id: 'D', name: '内容创作者D' },
  { id: 'insurance-c', name: '保险内容C' },
  { id: 'insurance-d', name: '保险内容D' },
];

interface SimpleSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SimpleSplitDialog({ open, onOpenChange, onSuccess }: SimpleSplitDialogProps) {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [executionDate, setExecutionDate] = useState('');
  // 在客户端挂载后设置今日日期，避免 SSR/Client hydration 不一致
  useEffect(() => {
    setExecutionDate(new Date().toISOString().split('T')[0]);
  }, []);
  const [subTasks, setSubTasks] = useState<SubTask[]>([
    { id: '1', title: '', description: '', executor: 'B', orderIndex: 1 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 重置表单
  const resetForm = () => {
    setTaskTitle('');
    setTaskDescription('');
    setExecutionDate(new Date().toISOString().split('T')[0]);
    setSubTasks([{ id: '1', title: '', description: '', executor: 'B', orderIndex: 1 }]);
  };

  // 添加子任务
  const addSubTask = () => {
    const newId = Date.now().toString();
    setSubTasks([
      ...subTasks,
      {
        id: newId,
        title: '',
        description: '',
        executor: 'B',
        orderIndex: subTasks.length + 1,
      },
    ]);
  };

  // 删除子任务
  const removeSubTask = (id: string) => {
    if (subTasks.length <= 1) {
      toast.warning('至少需要保留一个子任务');
      return;
    }
    setSubTasks(subTasks.filter(t => t.id !== id).map((t, i) => ({ ...t, orderIndex: i + 1 })));
  };

  // 更新子任务
  const updateSubTask = (id: string, field: keyof SubTask, value: string) => {
    setSubTasks(subTasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // 提交
  const handleSubmit = async () => {
    if (!taskTitle.trim()) {
      toast.error('请输入任务标题');
      return;
    }

    const validSubTasks = subTasks.filter(t => t.title.trim());
    if (validSubTasks.length === 0) {
      toast.error('请至少填写一个子任务');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/agents/b/simple-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle,
          taskDescription,
          executionDate,
          subTasks: validSubTasks,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建失败');
      }

      const result = await response.json();
      toast.success(`✅ 成功创建 ${result.data.insertedCount} 个子任务`);
      
      // 重置表单并关闭对话框
      resetForm();
      onOpenChange(false);
      
      // 调用成功回调
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error: any) {
      toast.error(`❌ 创建失败: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">🤖 简化拆解工具</DialogTitle>
          <DialogDescription>
            直接创建子任务到 agent_sub_tasks 表，跳过复杂流程
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] pr-2">
          <div className="space-y-6 py-4">
            {/* 主任务信息 */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">📋 主任务信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">任务标题</label>
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="例如：Q3产品迭代计划"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">执行日期</label>
                  <Input
                    type="date"
                    value={executionDate}
                    onChange={(e) => setExecutionDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">任务描述</label>
                <Textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="详细描述这个任务..."
                  rows={3}
                />
              </div>
            </div>

            {/* 子任务列表 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">📝 子任务列表</h3>
                <Button variant="outline" size="sm" onClick={addSubTask}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加子任务
                </Button>
              </div>

              {subTasks.map((subTask, index) => (
                <Card key={subTask.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">#{subTask.orderIndex}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSubTask(subTask.id)}
                        className="h-8 w-8 p-0 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1 space-y-2">
                        <label className="text-sm font-medium">子任务标题</label>
                        <Input
                          value={subTask.title}
                          onChange={(e) => updateSubTask(subTask.id, 'title', e.target.value)}
                          placeholder="子任务标题"
                        />
                      </div>
                      <div className="md:col-span-1 space-y-2">
                        <label className="text-sm font-medium">执行者</label>
                        <Select
                          value={subTask.executor}
                          onValueChange={(value) => updateSubTask(subTask.id, 'executor', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择执行者" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_AGENTS.map(agent => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">子任务描述</label>
                      <Textarea
                        value={subTask.description}
                        onChange={(e) => updateSubTask(subTask.id, 'description', e.target.value)}
                        placeholder="详细描述这个子任务..."
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                创建子任务
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
