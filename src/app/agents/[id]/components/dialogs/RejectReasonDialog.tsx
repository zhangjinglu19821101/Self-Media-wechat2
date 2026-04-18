'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { toast } from 'sonner';

interface RejectReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  isSubmitting: boolean;
  splitExecutor: string;
  onSubmit: () => void;
}

export function RejectReasonDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  isSubmitting,
  splitExecutor,
  onSubmit,
}: RejectReasonDialogProps) {
  const handleClose = () => {
    // 🔥 修复：只关闭对话框，不清空拒绝原因
    // 这样用户如果误关闭对话框，重新打开时还能看到之前输入的内容
    onOpenChange(false);
    // onReasonChange(''); // 注释掉这行，不清空拒绝原因
  };

  const handleSubmit = async () => {
    console.log('🔧 [RejectReasonDialog] 用户点击"提交并重新拆解"按钮');
    console.log(`🔧 [RejectReasonDialog] 当前状态：`);
    console.log(`  - reason: "${reason}"`);
    console.log(`  - reason.trim(): "${reason.trim()}"`);
    console.log(`  - !reason.trim(): ${!reason.trim()}`);
    console.log(`  - isSubmitting: ${isSubmitting}`);
    console.log(`  - 按钮禁用状态: ${!reason.trim() || isSubmitting}`);
    console.log(`  - splitExecutor: "${splitExecutor}"`);

    if (!reason.trim()) {
      console.error('❌ [RejectReasonDialog] 拒绝原因为空，不允许提交');
      toast.error('请输入拒绝原因');
      return;
    }

    console.log('✅ [RejectReasonDialog] 前置检查通过，调用 onSubmit...');
    try {
      await onSubmit();
      console.log('✅ [RejectReasonDialog] onSubmit 执行完成');
    } catch (error) {
      console.error('❌ [RejectReasonDialog] onSubmit 执行失败:', error);
      toast.error(`提交失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const quickFeedbackOptions = [
    { label: '子任务过多', text: '- 子任务数量过多，建议拆解为更细粒度的任务' },
    { label: '验收标准不明确', text: '- 某些子任务的验收标准不够明确，请补充具体指标' },
    { label: '时间安排不合理', text: '- 时间安排不合理，某些任务截止时间过紧' },
    { label: '任务分配不均衡', text: '- 任务分配不均衡，某些执行者任务过重' },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            拒绝拆解结果
          </DialogTitle>
          <DialogDescription>
            请输入拒绝原因，{splitExecutor} 将根据您的反馈重新拆解任务。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="rejectReason" className="text-sm font-medium mb-2 block">
              拒绝原因 <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="rejectReason"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="请详细说明拒绝的原因，例如：
- 子任务数量过多/过少
- 某些子任务的验收标准不明确
- 时间安排不合理
- 任务分配不均衡
..."
              rows={5}
              disabled={isSubmitting}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              提示：详细的反馈能帮助 {splitExecutor} 更准确地重新拆解任务
            </p>
          </div>

          {/* 快捷反馈选项 */}
          <div>
            <label className="text-sm font-medium mb-2 block">快捷反馈：</label>
            <div className="flex flex-wrap gap-2">
              {quickFeedbackOptions.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onReasonChange(prev => prev ? prev + '\n' + option.text : option.text)}
                  disabled={isSubmitting}
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
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                提交中...
              </>
            ) : (
              '提交并重新拆解'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
