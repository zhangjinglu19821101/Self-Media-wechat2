'use client';

/**
 * SubmitCommandResultDialog - 提交指令执行结果对话框
 * 供其他 Agent 提交指令执行结果
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, X, Plus } from 'lucide-react';

interface SubmitCommandResultDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  taskId: string;
  commandId?: string;
  fromAgentId: string;
  toAgentId: string;
  originalCommand: string;
  onSuccess?: () => void;
}

export function SubmitCommandResultDialog({
  open: controlledOpen,
  onOpenChange,
  taskId,
  commandId,
  fromAgentId,
  toAgentId,
  originalCommand,
  onSuccess,
}: SubmitCommandResultDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [loading, setLoading] = useState(false);

  // 表单状态
  const [executionStatus, setExecutionStatus] = useState<string>('completed');
  const [executionResult, setExecutionResult] = useState('');
  const [outputData, setOutputData] = useState('');
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string; type: string; size: number }>>([]);

  // 添加指标
  const [newMetricKey, setNewMetricKey] = useState('');
  const [newMetricValue, setNewMetricValue] = useState('');

  // 上传附件
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      setLoading(true);

      // TODO: 这里应该使用对象存储集成来上传文件
      // 暂时使用占位符
      const newAttachments = Array.from(files).map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file), // 临时 URL，实际应该上传到对象存储
        type: file.type,
        size: file.size,
      }));

      setAttachments([...attachments, ...newAttachments]);
    } catch (error) {
      console.error('上传附件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 移除附件
  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  // 添加指标
  const addMetric = () => {
    if (newMetricKey && newMetricValue) {
      setMetrics({ ...metrics, [newMetricKey]: newMetricValue });
      setNewMetricKey('');
      setNewMetricValue('');
    }
  };

  // 移除指标
  const removeMetric = (key: string) => {
    const newMetrics = { ...metrics };
    delete newMetrics[key];
    setMetrics(newMetrics);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      setLoading(true);

      // 解析输出数据
      let parsedOutputData = {};
      try {
        parsedOutputData = outputData ? JSON.parse(outputData) : {};
      } catch (error) {
        alert('输出数据格式错误，请输入有效的 JSON');
        return;
      }

      const response = await fetch('/api/command-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          commandId,
          fromAgentId,
          toAgentId,
          originalCommand,
          executionStatus,
          executionResult: executionResult || undefined,
          outputData: Object.keys(parsedOutputData).length > 0 ? parsedOutputData : undefined,
          metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 清空表单
        setExecutionStatus('completed');
        setExecutionResult('');
        setOutputData('');
        setMetrics({});
        setAttachments([]);

        setOpen(false);
        onSuccess?.();
      } else {
        alert(data.error || '提交失败');
      }
    } catch (error) {
      console.error('提交执行结果失败:', error);
      alert('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>提交执行结果</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>提交指令执行结果</DialogTitle>
          <DialogDescription>
            向 Agent A 提交指令的执行结果，包括状态、输出、指标和附件
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-4">
            {/* 原始指令 */}
            <Card>
              <CardContent className="pt-4">
                <Label className="text-sm font-medium">原始指令</Label>
                <p className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                  {originalCommand}
                </p>
              </CardContent>
            </Card>

            {/* 执行状态 */}
            <div className="space-y-2">
              <Label htmlFor="status">执行状态 *</Label>
              <Select value={executionStatus} onValueChange={setExecutionStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="in_progress">进行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="blocked">阻塞</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 执行结果 */}
            <div className="space-y-2">
              <Label htmlFor="result">执行结果描述</Label>
              <Textarea
                id="result"
                placeholder="描述执行结果或错误信息..."
                value={executionResult}
                onChange={(e) => setExecutionResult(e.target.value)}
                rows={3}
              />
            </div>

            {/* 输出数据 */}
            <div className="space-y-2">
              <Label htmlFor="outputData">输出数据 (JSON 格式)</Label>
              <Textarea
                id="outputData"
                placeholder='{"key": "value"}'
                value={outputData}
                onChange={(e) => setOutputData(e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
            </div>

            {/* 执行指标 */}
            <div className="space-y-2">
              <Label>执行指标</Label>
              <div className="space-y-2">
                {Object.entries(metrics).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Input value={key} disabled className="w-1/3" />
                    <Input value={value} disabled className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMetric(key)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="指标名称"
                    value={newMetricKey}
                    onChange={(e) => setNewMetricKey(e.target.value)}
                    className="w-1/3"
                  />
                  <Input
                    placeholder="指标值"
                    value={newMetricValue}
                    onChange={(e) => setNewMetricValue(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addMetric}
                    disabled={!newMetricKey || !newMetricValue}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 附件 */}
            <div className="space-y-2">
              <Label>附件</Label>
              <div className="space-y-2">
                {attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 p-2 rounded"
                  >
                    <span className="text-sm truncate flex-1">{attachment.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    id="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    multiple
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('file')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    上传附件
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row justify-start">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '提交中...' : '提交'}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
