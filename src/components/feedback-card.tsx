'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, XCircle, MessageSquare, Send, Loader2 } from 'lucide-react';
import { formatBeijingTime } from '@/lib/utils/date-time';

interface Feedback {
  feedbackId: string;
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  originalCommand: string;
  feedbackContent: string;
  feedbackType: 'question' | 'objection' | 'suggestion';
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  resolution?: string;
  resolvedCommand?: string;
  createdAt: string;
}

interface FeedbackCardProps {
  feedback: Feedback;
  onResolve?: (feedbackId: string, resolution: string, resolvedCommand: string) => Promise<void>;
  onReject?: (feedbackId: string, resolution: string) => Promise<void>;
  showActions?: boolean;
}

export function FeedbackCard({ feedback, onResolve, onReject, showActions = true }: FeedbackCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [resolvedCommand, setResolvedCommand] = useState(feedback.originalCommand);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getFeedbackTypeBadge = () => {
    switch (feedback.feedbackType) {
      case 'question':
        return <Badge className="bg-blue-500 hover:bg-blue-600">疑问</Badge>;
      case 'objection':
        return <Badge className="bg-orange-500 hover:bg-orange-600">异议</Badge>;
      case 'suggestion':
        return <Badge className="bg-green-500 hover:bg-green-600">建议</Badge>;
    }
  };

  const getStatusBadge = () => {
    switch (feedback.status) {
      case 'pending':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">待处理</Badge>;
      case 'processing':
        return <Badge variant="outline" className="border-blue-500 text-blue-700">处理中</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500 hover:bg-green-600">已解决</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 hover:bg-red-600">已驳回</Badge>;
    }
  };

  const handleResolve = async () => {
    if (!resolution.trim()) {
      alert('请输入解决方案');
      return;
    }

    setIsSubmitting(true);
    try {
      await onResolve?.(feedback.feedbackId, resolution, resolvedCommand);
      setIsOpen(false);
    } catch (error) {
      console.error('解决反馈失败:', error);
      alert('操作失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!resolution.trim()) {
      alert('请输入驳回原因');
      return;
    }

    setIsSubmitting(true);
    try {
      await onReject?.(feedback.feedbackId, resolution);
      setIsOpen(false);
    } catch (error) {
      console.error('驳回反馈失败:', error);
      alert('操作失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="p-4 hover:border-gray-300 transition-colors">
        <div className="space-y-3">
          {/* 标题行 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span className="font-medium text-sm">
                来自 {feedback.fromAgentId} 的反馈
              </span>
              {getFeedbackTypeBadge()}
              {getStatusBadge()}
            </div>
            <span className="text-xs text-gray-500">
              {formatBeijingTime(feedback.createdAt, 'datetime')}
            </span>
          </div>

          {/* 反馈内容 */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {feedback.feedbackContent}
            </div>
          </div>

          {/* 原始指令 */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-xs font-semibold text-blue-700 mb-1">原始指令</div>
            <div className="text-sm text-gray-600 line-clamp-2">
              {feedback.originalCommand}
            </div>
          </div>

          {/* 解决方案（如果有） */}
          {feedback.resolution && (
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-xs font-semibold text-green-700 mb-1">处理结果</div>
              <div className="text-sm text-gray-700">
                {feedback.resolution}
              </div>
            </div>
          )}

          {/* 纠正后的指令（如果有） */}
          {feedback.resolvedCommand && (
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-xs font-semibold text-purple-700 mb-1">纠正后的指令</div>
              <div className="text-sm text-gray-600 line-clamp-2">
                {feedback.resolvedCommand}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          {showActions && feedback.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(true)}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                处理反馈
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 处理反馈对话框 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>处理反馈</DialogTitle>
            <DialogDescription>
              请针对来自 {feedback.fromAgentId} 的反馈进行处理
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* 反馈内容 */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs font-semibold text-gray-700 mb-1">反馈内容</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {feedback.feedbackContent}
              </div>
            </div>

            {/* 原始指令 */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-xs font-semibold text-blue-700 mb-1">原始指令</div>
              <div className="text-sm text-gray-600 whitespace-pre-wrap">
                {feedback.originalCommand}
              </div>
            </div>

            {/* 解决方案 */}
            <div>
              <label className="text-sm font-medium mb-1 block">处理说明</label>
              <Textarea
                placeholder="请输入您的处理说明或决策理由..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={3}
              />
            </div>

            {/* 纠正后的指令 */}
            <div>
              <label className="text-sm font-medium mb-1 block">纠正后的指令（可选）</label>
              <Textarea
                placeholder="如果需要纠正指令，请输入新的指令内容..."
                value={resolvedCommand}
                onChange={(e) => setResolvedCommand(e.target.value)}
                rows={5}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
              驳回反馈
            </Button>
            <Button
              onClick={handleResolve}
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              接受并纠正
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
