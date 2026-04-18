'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TemplatePreview } from './template-preview';
import { StyleTemplate } from '@/lib/template/types';
import { Eye, Pencil, Trash2, FileText, Sparkles, Crown, Star, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';

interface TemplateListProps {
  systemTemplates: StyleTemplate[];
  userTemplates: StyleTemplate[];
  onEdit: (template: StyleTemplate) => void;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => void;
}

/**
 * 模板列表组件
 */
export function TemplateList({ 
  systemTemplates, 
  userTemplates, 
  onEdit, 
  onDelete,
  onRefresh 
}: TemplateListProps) {
  const [previewTemplate, setPreviewTemplate] = useState<StyleTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<StyleTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 设置默认模板相关状态
  const [defaultTemplate, setDefaultTemplate] = useState<StyleTemplate | null>(null);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deleteTemplate) return;
    
    setIsDeleting(true);
    try {
      await onDelete(deleteTemplate.id);
      setDeleteTemplate(null);
      onRefresh();
    } finally {
      setIsDeleting(false);
    }
  };

  // 确认设置为默认模板
  const handleConfirmSetDefault = async () => {
    if (!defaultTemplate) return;
    
    setIsSettingDefault(true);
    try {
      const response = await fetch('/api/template/default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: defaultTemplate.id }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(result.data.message);
        onRefresh();
      } else {
        toast.error(result.error || '设置失败');
      }
    } catch (error) {
      console.error('设置默认模板失败:', error);
      toast.error('设置失败');
    } finally {
      setIsSettingDefault(false);
      setDefaultTemplate(null);
    }
  };

  // 格式化时间
  const formatTime = (date: Date | string) => {
    return formatDistanceToNow(new Date(date), { 
      addSuffix: true, 
      locale: zhCN 
    });
  };

  // 渲染模板卡片
  const renderTemplateCard = (template: StyleTemplate, isSystem: boolean) => (
    <Card 
      key={template.id} 
      className={`relative group bg-white/80 backdrop-blur-sm border transition-all duration-300 hover:shadow-lg ${
        template.isDefault 
          ? 'border-amber-300 ring-2 ring-amber-200/50' 
          : isSystem 
            ? 'border-sky-200 hover:border-sky-300 hover:shadow-sky-100/50' 
            : 'border-cyan-100 hover:border-cyan-200 hover:shadow-cyan-100/50'
      }`}
    >
      {/* 顶部装饰条 */}
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-lg ${
        template.isDefault 
          ? 'bg-gradient-to-r from-amber-400 to-orange-400' 
          : isSystem 
            ? 'bg-gradient-to-r from-sky-400 to-cyan-400' 
            : 'bg-gradient-to-r from-cyan-400 to-teal-400'
      }`} />
      
      {/* 默认模板标识 */}
      {template.isDefault && (
        <div className="absolute top-3 right-3">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-600 text-xs font-medium">
            <Star className="h-3 w-3 fill-amber-400" />
            默认
          </div>
        </div>
      )}
      
      <CardHeader className="pb-2 pt-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {template.isDefault ? (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                <Star className="h-4 w-4 text-white fill-white" />
              </div>
            ) : isSystem ? (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-sm">
                <Crown className="h-4 w-4 text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center shadow-sm">
                <FileText className="h-4 w-4 text-white" />
              </div>
            )}
            <div>
              <CardTitle className={`text-base font-semibold ${
                template.isDefault ? 'text-amber-700' : 'text-sky-800'
              }`}>
                {template.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-600">
                  {template.platform}
                </span>
                {isSystem && !template.isDefault && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    系统
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-sky-600/70 mb-3">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {template.useCount} 次使用
          </span>
        </div>
        <div className="text-xs text-sky-500/60 mb-4 flex items-center gap-1">
          <span>创建于 {formatTime(template.createdAt)}</span>
        </div>
        <div className="flex gap-2 pt-2 border-t border-sky-100 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-sky-600 hover:text-sky-700 hover:bg-sky-50"
            onClick={() => setPreviewTemplate(template)}
          >
            <Eye className="h-4 w-4 mr-1" />
            预览
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-sky-600 hover:text-sky-700 hover:bg-sky-50"
            onClick={() => onEdit(template)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            编辑
          </Button>
          {/* 设为默认按钮 */}
          {!template.isDefault && (
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-500 hover:text-amber-600 hover:bg-amber-50"
              onClick={() => setDefaultTemplate(template)}
              title="设为默认模板"
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          {/* 删除按钮 */}
          {!isSystem && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => setDeleteTemplate(template)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      {/* 系统模板 */}
      {systemTemplates.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-sm">
              <Crown className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-sky-800">系统模板</h3>
              <p className="text-xs text-sky-500/70">预设的专业模板，不可删除</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemTemplates.map((t) => renderTemplateCard(t, true))}
          </div>
        </div>
      )}

      {/* 用户模板 */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center shadow-sm">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-sky-800">自定义模板</h3>
            <p className="text-xs text-sky-500/70">您创建的个性化样式模板</p>
          </div>
        </div>
        {userTemplates.length === 0 ? (
          <Card className="border-dashed border-2 border-sky-200 bg-sky-50/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
                <FileText className="h-7 w-7 text-sky-400" />
              </div>
              <p className="text-sky-600/70 mb-2">暂无自定义模板</p>
              <p className="text-xs text-sky-500/50">点击右上角「新增模板」创建您的第一个模板</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userTemplates.map((t) => renderTemplateCard(t, false))}
          </div>
        )}
      </div>

      {/* 预览弹窗 */}
      <AlertDialog 
        open={!!previewTemplate} 
        onOpenChange={() => setPreviewTemplate(null)}
      >
        <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-sky-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sky-700">
              <Eye className="h-5 w-5" />
              {previewTemplate?.name} - 样式预览
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="py-4">
            {previewTemplate && (
              <TemplatePreview 
                htmlContent={previewTemplate.htmlContent}
                title=""
              />
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-sky-500 hover:bg-sky-600">
              关闭
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 设置默认模板确认弹窗 */}
      <AlertDialog 
        open={!!defaultTemplate} 
        onOpenChange={() => setDefaultTemplate(null)}
      >
        <AlertDialogContent className="border-amber-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <Star className="h-5 w-5 fill-amber-400" />
              设为默认模板
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              确定将「{defaultTemplate?.name}」设为 <strong>{defaultTemplate?.platform}</strong> 的默认模板吗？
              <br /><br />
              <span className="text-sky-600">设置后，AI 生成文章时将自动使用此模板样式。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSettingDefault}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSetDefault}
              disabled={isSettingDefault}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isSettingDefault ? '设置中...' : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  确认设置
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除确认弹窗 */}
      <AlertDialog 
        open={!!deleteTemplate} 
        onOpenChange={() => setDeleteTemplate(null)}
      >
        <AlertDialogContent className="border-red-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模板「{deleteTemplate?.name}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
