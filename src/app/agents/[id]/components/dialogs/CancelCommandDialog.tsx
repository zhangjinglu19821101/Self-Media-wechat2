'use client';

import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CancelCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
}

export function CancelCommandDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onSubmit,
}: CancelCommandDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
    onReasonChange('');
  };

  const quickOptions = [
    { label: '指令内容有误', text: '- 指令内容有误，需要重新发送' },
    { label: '任务不需要了', text: '- 任务不需要了' },
    { label: '重复发送', text: '- 重复发送的指令' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            取消指令
          </DialogTitle>
          <DialogDescription>
            确定要取消这条指令吗？目标 Agent 将停止执行此任务。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="cancelReason" className="text-sm font-medium mb-2 block">
              取消原因 <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="cancelReason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="请输入取消原因，例如：
- 指令内容有误，需要重新发送
- 任务不需要了
- 重复发送的指令"
              rows={4}
              className="resize-none"
            />
          </div>

          {/* 快捷选项 */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">快捷选项：</p>
            <div className="flex flex-wrap gap-2">
              {quickOptions.map((option) => (
                <Button
                  key={option.label}
                  variant="outline"
                  size="sm"
                  onClick={() => onReasonChange(prev => prev ? prev + '\n' + option.text : option.text)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
          >
            取消
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!reason.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            确认取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
