'use client';

/**
 * CommandResultCard - 执行结果卡片组件
 * 展示单个指令执行结果的详细信息
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CommandResult, ExecutionStatus } from '@/lib/types/command-result';
import { formatBeijingTime, formatRelativeTime } from '@/lib/utils/date-time';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  MoreVertical,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';

interface CommandResultCardProps {
  result: CommandResult;
}

export function CommandResultCard({ result }: CommandResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  // 获取状态配置
  const getStatusConfig = (status: ExecutionStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: '待处理',
          icon: Clock,
          variant: 'secondary' as const,
          color: 'text-gray-500',
        };
      case 'in_progress':
        return {
          label: '进行中',
          icon: Clock,
          variant: 'default' as const,
          color: 'text-blue-500',
        };
      case 'completed':
        return {
          label: '已完成',
          icon: CheckCircle2,
          variant: 'default' as const,
          color: 'text-green-500',
        };
      case 'failed':
        return {
          label: '失败',
          icon: XCircle,
          variant: 'destructive' as const,
          color: 'text-red-500',
        };
      case 'blocked':
        return {
          label: '阻塞',
          icon: AlertCircle,
          variant: 'destructive' as const,
          color: 'text-orange-500',
        };
      default:
        return {
          label: status,
          icon: Clock,
          variant: 'secondary' as const,
          color: 'text-gray-500',
        };
    }
  };

  const statusConfig = getStatusConfig(result.executionStatus);
  const StatusIcon = statusConfig.icon;

  // 格式化时间（北京时间）
  const timeAgo = formatRelativeTime(result.createdAt);
  const formattedTime = formatBeijingTime(result.createdAt, 'datetime');

  // 下载附件
  const handleDownloadAttachment = async (attachment: any) => {
    try {
      const response = await fetch(attachment.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.name;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载附件失败:', error);
    }
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">
                {result.fromAgentId} → {result.toAgentId}
              </CardTitle>
              <Badge variant={statusConfig.variant} className="text-xs">
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {timeAgo} ({formattedTime}) · 任务 {result.taskId ? result.taskId.slice(-8) : 'N/A'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            {/* 原始指令 */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-1">原始指令</h4>
              <p className="text-sm bg-gray-50 p-2 rounded">{result.originalCommand}</p>
            </div>

            {/* 执行结果 */}
            {result.executionResult && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-1">执行结果</h4>
                <p className="text-sm bg-gray-50 p-2 rounded">{result.executionResult}</p>
              </div>
            )}

            {/* 输出数据 */}
            {Object.keys(result.outputData || {}).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-1">输出数据</h4>
                <ScrollArea className="h-32 bg-gray-50 p-2 rounded">
                  <pre className="text-xs">{JSON.stringify(result.outputData, null, 2)}</pre>
                </ScrollArea>
              </div>
            )}

            {/* 指标 */}
            {Object.keys(result.metrics || {}).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2">执行指标</h4>
                <div className="grid grid-cols-2 gap-2">
                  {result.metrics && Object.entries(result.metrics).map(([key, value]) => (
                    <div key={key} className="bg-blue-50 p-2 rounded">
                      <p className="text-xs text-gray-500">{key}</p>
                      <p className="text-sm font-medium">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 附件 */}
            {result.attachments && result.attachments.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-2">附件 ({result.attachments.length})</h4>
                <div className="space-y-1">
                  {result.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 p-2 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{attachment.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(attachment.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadAttachment(attachment)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 完成时间 */}
            {result.completedAt && (
              <div className="text-xs text-gray-500">
                完成时间: {new Date(result.completedAt).toLocaleString('zh-CN')}
              </div>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}
