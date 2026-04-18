'use client';

/**
 * SubmitFeedbackDialog - 提交反馈对话框
 * 供其他 Agent 向 Agent A 提交对指令的异议、疑问或建议
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
import { MessageCircle, AlertCircle, Lightbulb } from 'lucide-react';

interface SubmitFeedbackDialogProps {
  taskId?: string;
  commandId?: string;
  fromAgentId: string;
  toAgentId: string;
  originalCommand?: string;
  onSuccess?: () => void;
}

export function SubmitFeedbackDialog({
  taskId,
  commandId,
  fromAgentId,
  toAgentId,
  originalCommand,
  onSuccess,
}: SubmitFeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 表单状态
  const [feedbackType, setFeedbackType] = useState<string>('question');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [taskIdInput, setTaskIdInput] = useState(taskId || '');
  const [commandIdInput, setCommandIdInput] = useState(commandId || '');
  const [originalCommandInput, setOriginalCommandInput] = useState(originalCommand || '');

  // 提交反馈
  const handleSubmit = async () => {
    if (!taskIdInput || !feedbackContent.trim()) {
      alert('请填写任务ID和反馈内容');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId: taskIdInput,
          commandId: commandIdInput,
          fromAgentId,
          toAgentId,
          originalCommand: originalCommandInput,
          feedbackContent: feedbackContent.trim(),
          feedbackType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 清空表单
        setFeedbackContent('');
        setTaskIdInput('');
        setCommandIdInput('');
        setOriginalCommandInput('');
        setFeedbackType('question');

        setOpen(false);
        onSuccess?.();
      } else {
        alert(data.error || '提交失败');
      }
    } catch (error) {
      console.error('提交反馈失败:', error);
      alert('提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取反馈类型图标和描述
  const getFeedbackTypeInfo = (type: string) => {
    switch (type) {
      case 'question':
        return {
          icon: MessageCircle,
          label: '疑问',
          description: '对指令内容有疑问，需要进一步澄清或说明',
          color: 'text-blue-500',
        };
      case 'objection':
        return {
          icon: AlertCircle,
          label: '异议',
          description: '对指令内容有不同意见，建议修改或调整',
          color: 'text-orange-500',
        };
      case 'suggestion':
        return {
          icon: Lightbulb,
          label: '建议',
          description: '对指令执行有更好的想法或改进建议',
          color: 'text-green-500',
        };
      default:
        return {
          icon: MessageCircle,
          label: '反馈',
          description: '',
          color: 'text-gray-500',
        };
    }
  };

  const currentTypeInfo = getFeedbackTypeInfo(feedbackType);
  const TypeIcon = currentTypeInfo.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="border-orange-500 text-orange-700 hover:bg-orange-50">
          💬 提交反馈
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>提交反馈</DialogTitle>
          <DialogDescription>
            向 Agent A 提交对指令的异议、疑问或建议
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-14rem)] pr-4">
          {/* 反馈类型选择 */}
          <div className="space-y-2">
            <Label htmlFor="feedbackType">反馈类型 *</Label>
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger id="feedbackType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="question">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    疑问 - 需要澄清或说明
                  </div>
                </SelectItem>
                <SelectItem value="objection">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    异议 - 需要修改或调整
                  </div>
                </SelectItem>
                <SelectItem value="suggestion">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-green-500" />
                    建议 - 有更好的想法或改进
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {currentTypeInfo.description && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <TypeIcon className={`w-3 h-3 ${currentTypeInfo.color}`} />
                {currentTypeInfo.description}
              </p>
            )}
          </div>

          {/* 任务ID */}
          <div className="space-y-2">
            <Label htmlFor="taskId">任务ID *</Label>
            <Input
              id="taskId"
              placeholder="task-A-to-insurance-d-20260606"
              value={taskIdInput}
              onChange={(e) => setTaskIdInput(e.target.value)}
            />
          </div>

          {/* 指令ID（可选） */}
          <div className="space-y-2">
            <Label htmlFor="commandId">指令ID（可选）</Label>
            <Input
              id="commandId"
              placeholder="cmd-001"
              value={commandIdInput}
              onChange={(e) => setCommandIdInput(e.target.value)}
            />
          </div>

          {/* 原始指令（可选） */}
          <div className="space-y-2">
            <Label htmlFor="originalCommand">原始指令（可选）</Label>
            <Textarea
              id="originalCommand"
              placeholder="粘贴原始指令内容..."
              value={originalCommandInput}
              onChange={(e) => setOriginalCommandInput(e.target.value)}
              rows={3}
            />
          </div>

          {/* 反馈内容 */}
          <div className="space-y-2">
            <Label htmlFor="feedbackContent">反馈内容 *</Label>
            <Textarea
              id="feedbackContent"
              placeholder="请详细描述您的反馈内容..."
              value={feedbackContent}
              onChange={(e) => setFeedbackContent(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              反馈将直接发送给 Agent A，请确保内容清晰、准确
            </p>
          </div>

          {/* 提示信息 */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-800">
                💡 <strong>反馈规则：</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li>所有反馈直接提交至 Agent A，禁止跨 Agent 传递</li>
                <li>反馈不符合格式要求将影响后续任务分配</li>
                <li>若涉及跨岗协同需求，需提出具体解决方案建议</li>
                <li>Agent A 将在 24 小时内响应反馈</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !taskIdInput || !feedbackContent.trim()}>
            {loading ? '提交中...' : '提交反馈'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
