/**
 * 指令确认对话框 - 优化版
 *
 * 优化内容：
 * 1. 按钮固定在顶部，始终可见
 * 2. 指令列表区域可滚动
 * 3. 优化布局，减少空间占用
 * 4. 添加滚动指示器
 * 5. 优化最小化模式
 */

'use client';

import { useState, useEffect, useRef } from 'react';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, XCircle, Send, Minimize2, Maximize2, X } from 'lucide-react';
import { DetectedCommand, formatCommandForAgent, sendCommandToAgent } from '@/lib/command-detector';

interface CommandConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: DetectedCommand[];
  fromAgentId?: string;
  onConfirm?: () => void;
}

interface SendingStatus {
  agentId: string;
  status: 'pending' | 'sending' | 'success' | 'failed';
  error?: string;
}

export function CommandConfirmDialog({
  open,
  onOpenChange,
  commands,
  fromAgentId = 'A',
  onConfirm,
}: CommandConfirmDialogProps) {
  const [sendingStatuses, setSendingStatuses] = useState<SendingStatus[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [allSent, setAllSent] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ESC 键支持
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isSending) {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, isSending, onOpenChange]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  // 对话框打开时重置状态
  useEffect(() => {
    if (open) {
      setAllSent(false);
      setIsSending(false);
      setSendingStatuses(
        commands.map(cmd => ({
          agentId: cmd.targetAgentId,
          status: 'pending' as const,
        }))
      );
    }
  }, [open, commands]);

  // 初始化发送状态
  const initializeStatuses = () => {
    setSendingStatuses(
      commands.map(cmd => ({
        agentId: cmd.targetAgentId,
        status: 'pending' as const,
      }))
    );
    setAllSent(false);
  };

  const handleConfirm = async () => {
    setIsSending(true);
    initializeStatuses();

    // 逐个发送指令
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];

      // 更新状态为发送中
      setSendingStatuses(prev =>
        prev.map(s =>
          s.agentId === command.targetAgentId
            ? { ...s, status: 'sending' }
            : s
        )
      );

      // 格式化指令内容
      const formattedCommand = formatCommandForAgent(command, fromAgentId);

      // 发送指令
      const result = await sendCommandToAgent(
        command.targetAgentId,
        formattedCommand,
        command.commandType,
        command.priority,
        fromAgentId
      );

      // 更新状态
      setSendingStatuses(prev =>
        prev.map(s =>
          s.agentId === command.targetAgentId
            ? {
                ...s,
                status: result.success ? 'success' : 'failed',
                error: result.error,
              }
            : s
        )
      );

      // 等待一小段时间再发送下一个
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsSending(false);
    setAllSent(true);

    // 3秒后自动关闭
    autoCloseTimerRef.current = setTimeout(() => {
      setIsMinimized(false); // 确保退出最小化状态
      onOpenChange(false);
      onConfirm?.();
    }, 3000);
  };

  const getStatusIcon = (status: SendingStatus['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
      case 'sending':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: SendingStatus['status']) => {
    switch (status) {
      case 'pending':
        return '待发送';
      case 'sending':
        return '发送中...';
      case 'success':
        return '已发送';
      case 'failed':
        return '发送失败';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500 hover:bg-red-600">高优先级</Badge>;
      case 'normal':
        return <Badge className="bg-blue-500 hover:bg-blue-600">普通</Badge>;
      case 'low':
        return <Badge className="bg-gray-500 hover:bg-gray-600">低优先级</Badge>;
      default:
        return <Badge>普通</Badge>;
    }
  };

  const allSuccess = sendingStatuses.every(s => s.status === 'success');
  const anyFailed = sendingStatuses.some(s => s.status === 'failed');

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          ${isMinimized
            ? 'fixed bottom-6 right-6 w-auto h-auto min-w-[320px] p-4'
            : 'max-w-4xl max-h-[85vh] flex flex-col overflow-hidden'
          }
        `}
        onPointerDownOutside={(e) => {
          // 最小化状态下也允许点击外部关闭
        }}
        onInteractOutside={(e) => {
          // 最小化状态下也允许点击外部关闭
        }}
      >
        {/* 最小化模式 */}
        {isMinimized ? (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Send className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">待确认指令</span>
                <Badge variant="secondary" className="text-xs">
                  {commands.length} 条
                </Badge>
              </div>

              {/* 发送状态概览 */}
              <div className="flex items-center gap-2 text-xs text-gray-600">
                {allSent ? (
                  anyFailed ? (
                    <>
                      <XCircle className="h-3 w-3 text-red-500" />
                      <span>部分发送失败</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span>已全部发送</span>
                    </>
                  )
                ) : isSending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    <span>发送中...</span>
                  </>
                ) : (
                  <span>等待确认</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
                disabled={isSending}
                title="关闭"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleMinimize}
                title="最大化"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* 完整模式 */}
            <DialogHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-500" />
                  确认指令下发
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggleMinimize}
                  title="最小化"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
              <DialogDescription>
                Agent A 已在对话框中整理好以下 <span className="font-semibold text-gray-900">{commands.length}</span> 条指令，请确认是否真的要发送给对应的 Agent
              </DialogDescription>
            </DialogHeader>

            {/* 底部按钮 - 固定在上方，始终可见 */}
            <DialogFooter className="flex flex-row gap-3 pb-4 border-b flex-shrink-0">
          {!allSent ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSending}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isSending}
                className="bg-blue-600 hover:bg-blue-700 flex-1 min-w-[180px]"
              >
                {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSending ? '发送中...' : `确认下发 ${commands.length} 条指令`}
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm w-full justify-center">
              {allSuccess && (
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle className="h-5 w-5" />
                  <span>所有指令已成功发送</span>
                </div>
              )}
              {anyFailed && (
                <div className="flex items-center gap-2 text-red-600 font-medium">
                  <XCircle className="h-5 w-5" />
                  <span>部分指令发送失败</span>
                </div>
              )}
              <span className="text-gray-500">3秒后自动关闭</span>
            </div>
          )}
        </DialogFooter>

        {/* 指令列表 - 固定高度，可滚动 */}
        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-3 pb-2">
              {commands.map((command, index) => {
                const status = sendingStatuses.find(s => s.agentId === command.targetAgentId);
                const currentStatus = status?.status || 'pending';

                return (
                  <Card key={index} className="p-4 border-gray-200 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        {/* 标题行 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(currentStatus)}
                              <span className="font-medium text-base">
                                {command.targetAgentName}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                Agent ID: {command.targetAgentId}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                指令ID: {command.id}
                              </Badge>
                            </div>
                            {getPriorityBadge(command.priority)}
                          </div>
                          <div className="text-sm font-medium text-gray-500">
                            {getStatusText(currentStatus)}
                          </div>
                        </div>

                        {/* 核心目标 - 限制行数 */}
                        {command.commandContent && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                              核心目标
                            </div>
                            <div className="text-sm text-gray-600 line-clamp-2">
                              {command.commandContent.match(/核心目标[:：]\s*(.+?)(?:\n|$)/)?.[1]?.trim() || '未明确'}
                            </div>
                          </div>
                        )}

                        {/* 错误信息 */}
                        {status?.error && (
                          <div className="bg-red-50 border border-red-200 p-2 rounded-lg">
                            <div className="text-sm text-red-600">
                              ❌ {status.error}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
