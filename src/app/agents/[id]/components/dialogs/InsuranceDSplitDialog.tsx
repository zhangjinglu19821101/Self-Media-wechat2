'use client';

import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DailyTask {
  taskTitle?: string;
  taskName?: string;
  commandContent?: string;
  core_command?: string;
}

interface InsuranceDSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTask: DailyTask | null;
  isSplitting: boolean;
  onConfirm: () => void;
}

export function InsuranceDSplitDialog({
  open,
  onOpenChange,
  selectedTask,
  isSplitting,
  onConfirm,
}: InsuranceDSplitDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] p-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            确认拆解 daily_task 为子任务
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-2">
              <div>
                将以下 daily_task 拆解为可执行的子任务（agent_sub_tasks）：
              </div>
              {selectedTask && (
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-sm space-y-2">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">任务标题：</span>
                    <span className="font-medium ml-2">
                      {selectedTask.taskTitle || selectedTask.taskName || '未知'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">任务内容：</span>
                    <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                      {selectedTask.commandContent || selectedTask.core_command || '无内容'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>🤖</span>
                    <span><strong>拆解执行者：</strong>insurance-d</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>📊</span>
                    <span><strong>目标表：</strong><code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">agent_sub_tasks</code></span>
                  </div>
                </div>
              )}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <strong>说明：</strong>insurance-d 将按照 8 个标准步骤拆解任务，生成可执行的子任务。
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-row justify-end gap-2 p-6">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isSplitting}
          >
            取消
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={isSplitting}
          >
            {isSplitting ? (
              <>
                <Loader2 className="w-4 w-4 mr-2 animate-spin" />
                拆解中...
              </>
            ) : (
              '确认拆解'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
