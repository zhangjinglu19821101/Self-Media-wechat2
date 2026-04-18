'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateTasks: Array<{
    taskId: string;
    coreCommand: string;
    executor: string;
    createdAt: string;
    taskStatus?: string;
    similarity?: number;
  }>;
  warningMessage?: string;
}

interface BatchTaskResult {
  index: number;
  command: string;
  status: 'created' | 'duplicate' | 'error';
  task?: any;
  duplicateCheck?: DuplicateCheckResult;
  error?: string;
}

interface BatchTaskConfirmationProps {
  isOpen: boolean;
  results: BatchTaskResult[];
  summary: {
    total: number;
    created: number;
    duplicates: number;
    errors: number;
  };
  onCancel: () => void;
  onCreateNonDuplicates: () => void;
  onCreateAll: (selectedIndexes: number[]) => void;
  onViewDetail: (taskId: string) => void;
}

export function BatchTaskConfirmation({
  isOpen,
  results,
  summary,
  onCancel,
  onCreateNonDuplicates,
  onCreateAll,
  onViewDetail,
}: BatchTaskConfirmationProps) {
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<number>>(new Set());

  const duplicates = results.filter((r) => r.status === 'duplicate');
  const nonDuplicates = results.filter((r) => r.status === 'created' || r.status === 'error');

  const toggleDuplicate = (index: number) => {
    setSelectedDuplicates((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getSimilarityColor = (similarity?: number) => {
    if (!similarity) return 'bg-yellow-500';
    if (similarity >= 0.9) return 'bg-red-500';
    if (similarity >= 0.8) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const getSimilarityLevel = (similarity?: number) => {
    if (!similarity) return { label: '疑似重复', color: 'orange' };
    if (similarity >= 0.9) return { label: '高度重复', color: 'red' };
    if (similarity >= 0.8) return { label: '疑似重复', color: 'orange' };
    return { label: '轻度重复', color: 'yellow' };
  };

  const handleCreateAll = () => {
    const selectedArray = Array.from(selectedDuplicates);
    onCreateAll(selectedArray);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            批量任务重复检测
          </DialogTitle>
          <DialogDescription>
            检测到 {summary.total} 个指令，其中 {summary.duplicates} 个疑似重复，
            {summary.created} 个无重复。
            {summary.errors > 0 && ` ${summary.errors} 个创建失败。`}
          </DialogDescription>
        </DialogHeader>

        {/* 疑似重复列表 */}
        {duplicates.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">疑似重复</Badge>
              <span className="text-sm text-muted-foreground">
                ({duplicates.length} 个)
              </span>
            </div>

            {duplicates.map((result) => {
              const duplicateTask = result.duplicateCheck?.duplicateTasks[0];
              const similarityLevel = getSimilarityLevel(duplicateTask?.similarity);

              return (
                <Card key={result.index} className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`duplicate-${result.index}`}
                      checked={selectedDuplicates.has(result.index)}
                      onCheckedChange={() => toggleDuplicate(result.index)}
                      className="mt-1"
                    />

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label
                          htmlFor={`duplicate-${result.index}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          #{result.index + 1}
                        </label>
                        <Badge variant="outline">{similarityLevel.label}</Badge>
                        {duplicateTask?.similarity !== undefined && (
                          <Badge variant="outline">
                            相似度: {(duplicateTask.similarity * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>

                      <p className="font-medium text-sm">{result.command}</p>

                      {duplicateTask && (
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">相似任务:</span>
                            <span className="font-mono text-xs">{duplicateTask.taskId}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">执行者:</span>
                            <span>{duplicateTask.executor}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">创建时间:</span>
                            <span>
                              {formatDistanceToNow(new Date(duplicateTask.createdAt), {
                                addSuffix: true,
                                locale: zhCN,
                              })}
                            </span>
                          </div>
                          {duplicateTask.taskStatus && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">状态:</span>
                              <Badge variant={duplicateTask.taskStatus === 'completed' ? 'default' : 'secondary'}>
                                {duplicateTask.taskStatus}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetail(duplicateTask?.taskId || '')}
                          disabled={!duplicateTask}
                        >
                          查看详情
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* 无重复列表 */}
        {nonDuplicates.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="default">无重复</Badge>
              <span className="text-sm text-muted-foreground">
                ({nonDuplicates.length} 个)
              </span>
            </div>

            {nonDuplicates.map((result) => (
              <Card key={result.index} className="p-4">
                <div className="flex items-start gap-3">
                  {result.status === 'created' ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">#{result.index + 1}</span>
                      {result.status === 'created' && <Badge variant="default">已创建</Badge>}
                      {result.status === 'error' && (
                        <Badge variant="destructive">创建失败</Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm">{result.command}</p>
                    {result.error && (
                      <p className="text-xs text-red-500">{result.error}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={onCancel}>
            全部取消
          </Button>

          {summary.created > 0 && (
            <Button variant="secondary" onClick={onCreateNonDuplicates}>
              仅创建无重复 ({summary.created})
            </Button>
          )}

          {selectedDuplicates.size > 0 && (
            <Button onClick={handleCreateAll}>
              创建全部 ({summary.created + selectedDuplicates.size})
            </Button>
          )}

          {selectedDuplicates.size === 0 && duplicates.length > 0 && (
            <Button
              onClick={() => {
                // 全选所有重复任务
                setSelectedDuplicates(new Set(duplicates.map((d) => d.index)));
              }}
              variant="outline"
            >
              全选重复任务
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
