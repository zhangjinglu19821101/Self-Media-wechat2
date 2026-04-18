'use client';

import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SPLIT_KEYWORDS = ['agent-b', 'Agent B', 'B', 'insurance-d', 'Agent D', 'D', 'agent-frontend', 'Agent Frontend', 'Frontend'];

interface PendingCommand {
  targetAgentId: string;
  targetAgentName: string;
}

interface SplitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingCommandsForSplit: PendingCommand[];
  onConfirm: () => void;
  onCancel: () => void;
  onSkip: () => void;
}

export function SplitConfirmDialog({
  open,
  onOpenChange,
  pendingCommandsForSplit,
  onConfirm,
  onCancel,
  onSkip,
}: SplitConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            是否让任务拆解为日任务？
          </DialogTitle>
          <div className="space-y-3">
            <div>
              检测到指令中有向以下 Agent 下达的任务：
              <ul className="list-disc list-inside mt-2 space-y-1">
                {pendingCommandsForSplit
                  .filter(cmd => SPLIT_KEYWORDS.includes(cmd.targetAgentId))
                  .map((cmd, idx) => (
                    <li key={idx}>
                      <strong>{cmd.targetAgentName}</strong>（{cmd.targetAgentId}）
                    </li>
                  ))}
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded text-xs space-y-1">
              <div className="flex items-center gap-1">
                <span>🤖</span>
                <span><strong>拆解执行者：</strong>Agent B</span>
              </div>
              <div className="flex items-center gap-1">
                <span>📊</span>
                <span><strong>目标表：</strong><code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">daily_task</code></span>
              </div>
            </div>

            <div>
              <strong>建议：</strong>让 Agent B 将任务拆解为可执行的每日子任务，便于跟踪和管理。
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="outline" onClick={onSkip}>
            不拆解，直接发送
          </Button>
          <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">
            确认拆解
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
