'use client';

import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface DuplicateTask {
  taskId: string;
  taskName?: string;
  coreCommand?: string;
  originalCommand?: string;
  executor: string;
  createdAt: Date | string;
  similarity?: number;
}

interface DuplicateTaskWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warning: {
    title: string;
    content: {
      message?: string;
      duplicateTask?: DuplicateTask;
      newTask?: {
        taskId: string;
        taskName?: string;
        executor: string;
      };
    };
    metadata?: {
      detectionLevel?: 'business' | 'database';
    };
  } | null;
  onClose: () => void;
}

export function DuplicateTaskWarningDialog({
  open,
  onOpenChange,
  warning,
  onClose,
}: DuplicateTaskWarningDialogProps) {
  if (!warning) return null;

  const duplicateTask = warning.content?.duplicateTask;
  const newTask = warning.content?.newTask;
  const detectionLevel = warning.metadata?.detectionLevel;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-6 h-6" />
            {warning.title || '⚠️ 检测到重复任务'}
          </DialogTitle>
          <DialogDescription className="text-amber-700">
            {warning.content?.message || '系统检测到相似任务已存在，为避免重复执行，已跳过创建新任务。'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 检测级别 */}
          <div className="flex items-center gap-2">
            <Badge variant={detectionLevel === 'business' ? 'default' : 'secondary'}>
              {detectionLevel === 'business' ? '业务层面检测' : '数据库层面检测'}
            </Badge>
          </div>

          {/* 已存在的任务 */}
          {duplicateTask && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-amber-800 dark:text-amber-200">已存在的任务</span>
                    {duplicateTask.similarity !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        相似度: {Math.round((duplicateTask.similarity || 0) * 100)}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    <div><strong>任务ID:</strong> {duplicateTask.taskId}</div>
                    {duplicateTask.taskName && (
                      <div><strong>任务名称:</strong> {duplicateTask.taskName}</div>
                    )}
                    <div><strong>执行主体:</strong> {duplicateTask.executor}</div>
                    <div><strong>创建时间:</strong> {new Date(duplicateTask.createdAt).toLocaleString('zh-CN')}</div>
                    {(duplicateTask.coreCommand || duplicateTask.originalCommand) && (
                      <div>
                        <strong>任务内容:</strong>
                        <div className="mt-1 bg-amber-100 dark:bg-amber-900 p-2 rounded text-xs font-mono break-all">
                          {(duplicateTask.coreCommand || duplicateTask.originalCommand)?.substring(0, 150)}
                          {(duplicateTask.coreCommand || duplicateTask.originalCommand)?.length > 150 ? '...' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 新任务（尝试创建的） */}
          {newTask && (
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="font-medium text-gray-700 dark:text-gray-300">尝试创建的新任务（已跳过）</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div><strong>任务ID:</strong> {newTask.taskId}</div>
                    {newTask.taskName && (
                      <div><strong>任务名称:</strong> {newTask.taskName}</div>
                    )}
                    <div><strong>执行主体:</strong> {newTask.executor}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row justify-end gap-2">
          <Button onClick={onClose} className="bg-amber-600 hover:bg-amber-700">
            我知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
