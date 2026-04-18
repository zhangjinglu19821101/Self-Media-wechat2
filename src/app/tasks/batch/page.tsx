'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { BatchTaskConfirmation } from '@/components/tasks/batch-task-confirmation';

interface CommandInput {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  command: string;
  commandType: 'task' | 'instruction';
  priority: 'low' | 'normal' | 'high';
}

export default function BatchTaskPage() {
  const router = useRouter();
  const [commands, setCommands] = useState<CommandInput[]>([
    {
      id: '1',
      fromAgentId: 'A',
      toAgentId: 'B',
      command: '',
      commandType: 'task',
      priority: 'normal',
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [duplicateCheckMode, setDuplicateCheckMode] = useState<'simple' | 'fuzzy'>('fuzzy');
  const [checkDuplicate, setCheckDuplicate] = useState(true);

  const addCommand = () => {
    setCommands([
      ...commands,
      {
        id: Date.now().toString(),
        fromAgentId: 'A',
        toAgentId: 'B',
        command: '',
        commandType: 'task',
        priority: 'normal',
      },
    ]);
  };

  const removeCommand = (id: string) => {
    if (commands.length > 1) {
      setCommands(commands.filter((c) => c.id !== id));
    } else {
      toast.warning('至少保留一个指令');
    }
  };

  const updateCommand = (id: string, updates: Partial<CommandInput>) => {
    setCommands(commands.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleSubmit = async () => {
    // 验证
    const emptyCommands = commands.filter((c) => !c.command.trim());
    if (emptyCommands.length > 0) {
      toast.warning('请填写所有指令内容');
      return;
    }

    setIsSubmitting(true);

    try {
      // 第一次提交：检测重复
      const response = await fetch('/api/agents/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: commands.map((c) => ({
            fromAgentId: c.fromAgentId,
            toAgentId: c.toAgentId,
            command: c.command.trim(),
            commandType: c.commandType,
            priority: c.priority,
          })),
          checkDuplicate,
          duplicateCheckMode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || '批量提交失败');
        setIsSubmitting(false);
        return;
      }

      if (result.success) {
        // 如果有重复，显示确认对话框
        if (result.summary.duplicates > 0) {
          setBatchResult(result);
          setIsSubmitting(false);
          return;
        }

        // 如果全部无重复，直接成功
        if (result.summary.created > 0) {
          toast.success(`成功创建 ${result.summary.created} 个任务`);
        }
        if (result.summary.errors > 0) {
          toast.error(`${result.summary.errors} 个任务创建失败`);
        }

        // 重置表单
        resetForm();
      }
    } catch (error) {
      toast.error('批量提交失败');
      console.error('批量提交错误:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNonDuplicates = async () => {
    toast.success(`成功创建 ${batchResult.summary.created} 个任务`);
    setBatchResult(null);
    resetForm();
  };

  const handleCreateAll = async (selectedIndexes: number[]) => {
    if (selectedIndexes.length === 0) {
      handleCreateNonDuplicates();
      return;
    }

    // 获取选中的重复任务
    const duplicateCommands = batchResult.results
      .filter((r: any) => r.status === 'duplicate' && selectedIndexes.includes(r.index))
      .map((r: any) => ({
        fromAgentId: 'A',
        toAgentId: 'B',
        command: r.command,
        commandType: 'task',
        priority: 'normal',
      }));

    try {
      const response = await fetch('/api/agents/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands: duplicateCommands,
          checkDuplicate: false, // 关闭重复检测
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const totalCreated = batchResult.summary.created + (result.summary.created || 0);
        toast.success(`成功创建全部任务（共 ${totalCreated} 个）`);
        setBatchResult(null);
        resetForm();
      } else {
        toast.error(result.error || '创建失败');
      }
    } catch (error) {
      toast.error('创建失败');
      console.error('创建错误:', error);
    }
  };

  const resetForm = () => {
    setCommands([
      {
        id: '1',
        fromAgentId: 'A',
        toAgentId: 'B',
        command: '',
        commandType: 'task',
        priority: 'normal',
      },
    ]);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-blue-500" />
          批量任务下发
        </h1>
        <p className="text-muted-foreground">
          一次性提交多个任务指令，系统将自动检测重复并提供确认选项
        </p>
      </div>

      {/* 配置选项 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">检测配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="checkDuplicate"
                checked={checkDuplicate}
                onChange={(e) => setCheckDuplicate(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="checkDuplicate">启用重复检测</Label>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="duplicateCheckMode">检测模式:</Label>
              <select
                id="duplicateCheckMode"
                value={duplicateCheckMode}
                onChange={(e) => setDuplicateCheckMode(e.target.value as any)}
                disabled={!checkDuplicate}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                <option value="simple">简单匹配（完全匹配）</option>
                <option value="fuzzy">模糊匹配（相似度 ≥ 80%）</option>
              </select>
            </div>
          </div>

          {duplicateCheckMode === 'fuzzy' && checkDuplicate && (
            <p className="text-sm text-muted-foreground">
              💡 模糊匹配使用 Jaccard 相似度算法，相似度 ≥ 80% 时会被标记为重复
            </p>
          )}
        </CardContent>
      </Card>

      {/* 指令输入区域 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">任务指令</CardTitle>
            <Badge variant="outline">{commands.length} 个指令</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {commands.map((cmd, index) => (
            <div key={cmd.id} className="space-y-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">指令 #{index + 1}</Label>
                {commands.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCommand(cmd.id)}
                    disabled={isSubmitting}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    删除
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`from-${cmd.id}`} className="text-sm">
                    发起 Agent
                  </Label>
                  <select
                    id={`from-${cmd.id}`}
                    value={cmd.fromAgentId}
                    onChange={(e) => updateCommand(cmd.id, { fromAgentId: e.target.value })}
                    disabled={isSubmitting}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="A">Agent A</option>
                    <option value="B">Agent B</option>
                    <option value="C">Agent C</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor={`to-${cmd.id}`} className="text-sm">
                    执行 Agent
                  </Label>
                  <select
                    id={`to-${cmd.id}`}
                    value={cmd.toAgentId}
                    onChange={(e) => updateCommand(cmd.id, { toAgentId: e.target.value })}
                    disabled={isSubmitting}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="B">Agent B</option>
                    <option value="insurance-c">insurance-c</option>
                    <option value="insurance-d">insurance-d</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`type-${cmd.id}`} className="text-sm">
                    指令类型
                  </Label>
                  <select
                    id={`type-${cmd.id}`}
                    value={cmd.commandType}
                    onChange={(e) =>
                      updateCommand(cmd.id, { commandType: e.target.value as any })
                    }
                    disabled={isSubmitting}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="task">任务</option>
                    <option value="instruction">指令</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor={`priority-${cmd.id}`} className="text-sm">
                    优先级
                  </Label>
                  <select
                    id={`priority-${cmd.id}`}
                    value={cmd.priority}
                    onChange={(e) => updateCommand(cmd.id, { priority: e.target.value as any })}
                    disabled={isSubmitting}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="low">低</option>
                    <option value="normal">普通</option>
                    <option value="high">高</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor={`command-${cmd.id}`} className="text-sm">
                  指令内容
                </Label>
                <Textarea
                  id={`command-${cmd.id}`}
                  value={cmd.command}
                  onChange={(e) => updateCommand(cmd.id, { command: e.target.value })}
                  placeholder="请输入任务指令，例如：开发新版首页功能，包括响应式布局和动画效果"
                  rows={3}
                  disabled={isSubmitting}
                  className="mt-1"
                />
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addCommand}
            disabled={isSubmitting}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            添加指令
          </Button>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={resetForm}
          disabled={isSubmitting || commands.every((c) => !c.command.trim())}
        >
          重置
        </Button>

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || commands.every((c) => !c.command.trim())
            }
            className="min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                检测中...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                批量提交
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 批量任务确认对话框 */}
      <BatchTaskConfirmation
        isOpen={!!batchResult}
        results={batchResult?.results || []}
        summary={batchResult?.summary || { total: 0, created: 0, duplicates: 0, errors: 0 }}
        onCancel={() => setBatchResult(null)}
        onCreateNonDuplicates={handleCreateNonDuplicates}
        onCreateAll={handleCreateAll}
        onViewDetail={(taskId) => router.push(`/tasks/${taskId}`)}
      />
    </div>
  );
}
