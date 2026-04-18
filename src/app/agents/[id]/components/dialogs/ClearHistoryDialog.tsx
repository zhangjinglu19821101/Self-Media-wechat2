'use client';

import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ClearHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ClearHistoryDialog({
  open,
  onOpenChange,
  onConfirm,
}: ClearHistoryDialogProps) {
  const clearItems = [
    '清空对话框中的所有消息',
    '清空待处理指令列表',
    '清空所有拆解结果和任务结果',
    '重新生成会话 ID',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            清空历史记录
          </DialogTitle>
          <DialogDescription>
            确定要清空所有历史记录吗？此操作将：
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4 text-sm text-muted-foreground">
          {clearItems.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-red-500" />
              <span>{item}</span>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t">
            <p className="text-red-600 font-medium">
              ⚠️ 此操作不可撤销，请谨慎操作！
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            确认清空
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
