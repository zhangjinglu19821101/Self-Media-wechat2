'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Settings, 
  PlayCircle, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Send,
  FileText,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { toast } from 'sonner';

// 从统一类型文件导入
import type { CreationControlData, CreationControllerProps } from './types';

export function CreationController({
  value,
  onChange,
  onGenerateOutline,
  onGenerateFullText,
  canGenerateOutline,
  generatingOutline,
  generatingFullText,
  onError,
  onSuccess,
}: CreationControllerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingOutline, setIsEditingOutline] = useState(false);
  const [editedOutline, setEditedOutline] = useState(value.outline || '');

  const handleGenerateOutlineClick = async () => {
    if (!canGenerateOutline) {
      toast.error('请先完成核心锚点输入');
      return;
    }
    setIsGenerating(true);
    try {
      await onGenerateOutline();
      onSuccess?.('大纲生成成功');
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成大纲失败';
      toast.error(message);
      onError?.({ code: 'OUTLINE_GENERATION_FAILED', message, retryable: true });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFullTextClick = async () => {
    if (!value.outlineConfirmed) {
      toast.error('请先确认大纲');
      return;
    }
    setIsGenerating(true);
    try {
      await onGenerateFullText();
      onSuccess?.('全文生成任务已提交');
    } catch (err) {
      const message = err instanceof Error ? err.message : '生成全文失败';
      toast.error(message);
      onError?.({ code: 'FULLTEXT_GENERATION_FAILED', message, retryable: true });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWordCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value, 10);
    onChange({ ...value, targetWordCount: isNaN(num) ? 0 : num });
  };

  const handleOutlineConfirm = () => {
    if (!value.outline.trim()) {
      toast.error('请先生成大纲');
      return;
    }
    onChange({ ...value, outlineConfirmed: true });
    toast.success('大纲已确认，可以开始生成全文！');
  };

  // 进入编辑模式
  const handleOutlineEdit = () => {
    setEditedOutline(value.outline || '');
    setIsEditingOutline(true);
    onChange({ ...value, outlineConfirmed: false });
  };

  // 保存编辑
  const handleSaveOutline = () => {
    onChange({
      ...value,
      outline: editedOutline,
      outlineConfirmed: false,
    });
    setIsEditingOutline(false);
    toast.success('大纲已保存');
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditedOutline(value.outline || '');
    setIsEditingOutline(false);
  };

  return (
    <Card className="border-2 border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-sky-500" />
              创作控制
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              防止AI跑偏，确保创作质量
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 目标字数设置 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-500" />
              目标字数
            </Label>
            <Badge variant="secondary" className="text-xs bg-slate-50 text-slate-600">
              浮动±200字
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Input
              value={value.targetWordCount}
              onChange={handleWordCountChange}
              placeholder="2000-2200"
              className="w-40 border-slate-200 focus:border-sky-500 focus:ring-sky-500/20"
            />
            <span className="text-sm text-slate-500">字</span>
          </div>
          <p className="text-xs text-slate-500">
            默认2000-2200字，严格控制文章篇幅，贴合用户写作习惯
          </p>
        </div>

        <Separator className="my-2" />

        {/* 生成大纲按钮 */}
        <div className="space-y-3">
          <Button
            onClick={handleGenerateOutlineClick}
            disabled={!canGenerateOutline || generatingOutline || isGenerating}
            size="lg"
            className="w-full h-12 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {generatingOutline || isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                生成大纲中...
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5 mr-2" />
                生成创作大纲
              </>
            )}
          </Button>
          {!canGenerateOutline && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="w-3.5 h-3.5" />
              请先完成核心锚点输入（开篇案例、全文观点、结尾结论）
            </div>
          )}
        </div>

        {/* 大纲确认区 */}
        {value.outline && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-900">
                {isEditingOutline ? '编辑大纲' : '大纲确认区'}
              </Label>
              {isEditingOutline ? (
                <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700">
                  <Edit3 className="w-3 h-3 mr-1" />
                  编辑中
                </Badge>
              ) : value.outlineConfirmed ? (
                <Badge variant="secondary" className="text-xs bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  已确认
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  待确认
                </Badge>
              )}
            </div>
            
            {/* 大纲内容展示/编辑 */}
            {isEditingOutline ? (
              <div className="bg-sky-50 rounded-lg border border-sky-200 overflow-hidden">
                <Textarea
                  value={editedOutline}
                  onChange={(e) => setEditedOutline(e.target.value)}
                  className="min-h-[160px] border-0 bg-transparent focus-visible:ring-0 resize-none text-sm leading-relaxed"
                  placeholder="在此编辑大纲内容..."
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <ScrollArea className="h-40">
                  <div className="p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {value.outline || '大纲将在此展示...'}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            <p className="text-xs text-slate-500">
              {isEditingOutline 
                ? '编辑完成后点击保存，系统将使用您修改后的大纲生成全文'
                : '展示大纲明细（结构+核心观点+素材使用规划），用户可核对，确认无误后才可触发全文生成'}
            </p>
            
            {/* 大纲操作按钮 */}
            <div className="flex gap-3">
              {isEditingOutline ? (
                <>
                  <Button
                    onClick={handleSaveOutline}
                    variant="outline"
                    size="lg"
                    className="flex-1 h-12 border-sky-500 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    保存修改
                  </Button>
                  <Button
                    onClick={handleCancelEdit}
                    variant="outline"
                    size="lg"
                    className="h-12 px-4"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </>
              ) : value.outlineConfirmed ? (
                <Button
                  onClick={handleOutlineEdit}
                  variant="outline"
                  size="lg"
                  className="flex-1 h-12"
                >
                  <Edit3 className="w-5 h-5 mr-2" />
                  修改大纲
                </Button>
              ) : (
                <Button
                  onClick={handleOutlineConfirm}
                  variant="outline"
                  size="lg"
                  className="flex-1 h-12 border-emerald-500 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  确认大纲
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 生成全文按钮 */}
        <Button
          onClick={handleGenerateFullTextClick}
          disabled={!value.outlineConfirmed || generatingFullText || isGenerating}
          size="lg"
          className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg hover:shadow-xl transition-all duration-300"
        >
          {generatingFullText || isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              生成全文中...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              生成全文
            </>
          )}
        </Button>
        {!value.outlineConfirmed && value.outline && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="w-3.5 h-3.5" />
            请先确认大纲后再生成全文
          </div>
        )}
      </CardContent>
    </Card>
  );
}
