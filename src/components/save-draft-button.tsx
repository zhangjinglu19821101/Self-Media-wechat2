'use client';

/**
 * SaveDraftButton - 保存草稿按钮
 * 允许用户将对话中的文章内容保存为草稿
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, Loader2 } from 'lucide-react';

interface SaveDraftButtonProps {
  agentId: 'D' | 'insurance-d';
  initialContent?: string;
  initialTitle?: string;
  taskId?: string;
  onSaveSuccess?: (filePath: string) => void;
}

export function SaveDraftButton({
  agentId,
  initialContent = '',
  initialTitle = '',
  taskId,
  onSaveSuccess,
}: SaveDraftButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [author, setAuthor] = useState(agentId === 'insurance-d' ? '保险科普' : '内容主编');
  const [status, setStatus] = useState<'draft' | 'reviewing' | 'approved' | 'rejected'>('draft');
  const [complianceStatus, setComplianceStatus] = useState<'pending' | 'passed' | 'failed'>('pending');

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert('标题和内容不能为空');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          taskId,
          title: title.trim(),
          content: content.trim(),
          author,
          status,
          complianceStatus,
          metadata: {
            savedFrom: 'chat',
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`草稿已保存！\n\n文件路径：${data.data.filePath}`);
        setOpen(false);
        onSaveSuccess?.(data.data.filePath);
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存草稿失败:', error);
      alert('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Save className="w-4 h-4 mr-2" />
          保存为草稿
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>保存草稿到本地</DialogTitle>
          <DialogDescription>
            文章将保存到：
            <code>
              {agentId === 'insurance-d'
                ? '/workspace/projects/insurance-Business/draft-article/insurance-d/'
                : '/workspace/projects/AI-Business/draft-article/agent-d/'}
            </code>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-14rem)] pr-4">
          <div className="space-y-2">
            <Label htmlFor="title">文章标题 *</Label>
            <Input
              id="title"
              placeholder="输入文章标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {taskId && (
            <div className="space-y-2">
              <Label htmlFor="taskId">任务 ID</Label>
              <Input id="taskId" value={taskId} disabled />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="author">作者</Label>
            <Input
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">状态</Label>
            <Select value={status} onValueChange={(value: any) => setStatus(value)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="reviewing">审核中</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已驳回</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 合规校验状态（仅 insurance-d 显示） */}
          {agentId === 'insurance-d' && (
            <div className="space-y-2">
              <Label htmlFor="complianceStatus">合规校验状态</Label>
              <Select value={complianceStatus} onValueChange={(value: any) => setComplianceStatus(value)}>
                <SelectTrigger id="complianceStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待校验</SelectItem>
                  <SelectItem value="passed">通过</SelectItem>
                  <SelectItem value="failed">不通过</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">文章内容 *</Label>
            <Textarea
              id="content"
              placeholder="输入或粘贴文章内容（支持 Markdown 格式）"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
              className="font-mono text-sm resize-none"
            />
            <p className="text-xs text-gray-500">
              支持 Markdown 格式，支持标题、列表、加粗等语法
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
