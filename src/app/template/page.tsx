'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { TemplateForm } from '@/components/template/template-form';
import { StyleTemplate, PLATFORM_OPTIONS } from '@/lib/template/types';
import { Plus, RefreshCw, Loader2, Palette, LayoutTemplate, Crown, FileText, Star, Pencil, Trash2, Check, Minimize2, Maximize2, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 示例文章内容（用于展示模板效果）
const SAMPLE_ARTICLE = {
  title: '如何科学理财：新手入门指南',
  content: `理财是每个人都应该掌握的重要技能。本文将为您介绍几个简单实用的理财方法。

一、建立预算习惯

合理规划收入和支出是理财的第一步。建议按照 50-30-20 法则分配收入：50% 用于必要开支，30% 用于娱乐消费，20% 用于储蓄和投资。

1. 记录每一笔支出

养成记账的习惯，了解钱的去向。可以使用手机 APP 或记账本，每天花几分钟记录。

2. 设定储蓄目标

明确自己的储蓄目标，比如应急基金、旅行基金、购房首付等，有目标更容易坚持。

⚠️ 重要提醒：理财需谨慎，不要盲目追求高收益。

二、选择适合的投资方式

根据风险承受能力和投资期限，选择合适的投资产品。

【互动提问】您目前的理财方式是什么？欢迎留言分享！

【免责声明】本文仅为知识科普，不构成投资建议。`
};

/**
 * 浮动预览面板组件
 */
function FloatingPreviewPanel({ 
  template, 
  onClose,
  onMinimize,
  isMinimized 
}: { 
  template: StyleTemplate | null;
  onClose: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
}) {
  if (!template) return null;

  // 将模板的占位符替换为示例内容
  const renderedHtml = template.htmlContent
    .replace(/\{\{title\}\}/g, SAMPLE_ARTICLE.title)
    .replace(/\{\{content\}\}/g, SAMPLE_ARTICLE.content)
    .replace(/\{\{author\}\}/g, '理财小助手')
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString('zh-CN'));

  if (isMinimized) {
    // 最小化状态：只显示小图标
    return (
      <div 
        className="fixed right-4 bottom-4 z-50 cursor-pointer"
        onClick={onMinimize}
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-sky-200/50 hover:scale-105 transition-transform">
          <Eye className="w-6 h-6 text-white" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-[72px] bottom-4 w-[420px] z-50 bg-white rounded-2xl shadow-2xl border border-sky-200 flex flex-col overflow-hidden">
      {/* 标题栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-100 to-cyan-50 border-b border-sky-200">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-sky-600" />
          <span className="font-medium text-sky-700 truncate max-w-[200px]">
            {template.name}
          </span>
          {template.isDefault && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 flex items-center gap-1 flex-shrink-0">
              <Star className="w-3 h-3 fill-amber-400" />
              默认
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-sky-500 hover:text-sky-700 hover:bg-sky-100"
            onClick={onMinimize}
            title="最小化"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-sky-500 hover:text-sky-700 hover:bg-sky-100"
            onClick={onClose}
            title="关闭"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* 预览区域 */}
      <div className="flex-1 overflow-y-auto bg-gray-100 flex justify-center py-4">
        <div className="w-[375px] bg-white shadow-lg flex-shrink-0">
          <iframe
            srcDoc={`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
                  <style>
                    * { box-sizing: border-box; }
                    html, body { 
                      margin: 0; 
                      padding: 16px; 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
                      background: #fff;
                      min-height: 100%;
                      -webkit-font-smoothing: antialiased;
                    }
                    img { max-width: 100%; height: auto; }
                    section { display: block; }
                  </style>
                </head>
                <body>${renderedHtml}</body>
              </html>
            `}
            className="w-full border-0 bg-white"
            style={{ minHeight: 'calc(100vh - 180px)', height: 'auto' }}
            title="模板预览"
          />
        </div>
      </div>
      
      {/* 底部提示 */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
        <span className="text-xs text-gray-400">预览宽度 375px · 点击模板切换预览</span>
      </div>
    </div>
  );
}

/**
 * 样式模板管理页面
 */
export default function TemplatePage() {
  const [systemTemplates, setSystemTemplates] = useState<StyleTemplate[]>([]);
  const [userTemplates, setUserTemplates] = useState<StyleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<string>('all');
  
  // 选中的模板（用于预览）
  const [selectedTemplate, setSelectedTemplate] = useState<StyleTemplate | null>(null);
  
  // 预览面板状态
  const [previewVisible, setPreviewVisible] = useState(true);
  const [previewMinimized, setPreviewMinimized] = useState(false);

  // 弹窗状态
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingTemplate, setEditingTemplate] = useState<StyleTemplate | null>(null);
  
  // 删除确认
  const [deleteTemplate, setDeleteTemplate] = useState<StyleTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 设置默认模板
  const [defaultTemplate, setDefaultTemplate] = useState<StyleTemplate | null>(null);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  // 加载模板列表
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (platform && platform !== 'all') {
        params.append('platform', platform);
      }
      
      const response = await fetch(`/api/template?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setSystemTemplates(result.data.systemTemplates);
        setUserTemplates(result.data.userTemplates);
        
        // 默认选中第一个模板
        const allTemplates = [...result.data.systemTemplates, ...result.data.userTemplates];
        if (allTemplates.length > 0 && !selectedTemplate) {
          const defaultOne = allTemplates.find(t => t.isDefault) || allTemplates[0];
          setSelectedTemplate(defaultOne);
        }
      } else {
        toast.error('加载模板列表失败');
      }
    } catch (error) {
      console.error('加载模板列表失败:', error);
      toast.error('加载模板列表失败');
    } finally {
      setLoading(false);
    }
  }, [platform, selectedTemplate]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // 新增模板
  const handleCreate = () => {
    setFormMode('create');
    setEditingTemplate(null);
    setFormOpen(true);
  };

  // 编辑模板
  const handleEdit = (template: StyleTemplate) => {
    setFormMode('edit');
    setEditingTemplate(template);
    setFormOpen(true);
  };

  // 删除模板
  const handleDelete = async () => {
    if (!deleteTemplate) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/template/${deleteTemplate.id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('模板删除成功');
        if (selectedTemplate?.id === deleteTemplate.id) {
          setSelectedTemplate(null);
        }
        setDeleteTemplate(null);
        fetchTemplates();
      } else {
        toast.error(result.error || '删除失败');
      }
    } catch (error) {
      console.error('删除模板失败:', error);
      toast.error('删除模板失败');
    } finally {
      setIsDeleting(false);
    }
  };

  // 设置默认模板
  const handleSetDefault = async () => {
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
        fetchTemplates();
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

  // 提交表单
  const handleSubmit = async (data: { name: string; htmlContent: string; platform: string }) => {
    if (formMode === 'create') {
      const response = await fetch('/api/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('模板创建成功');
        fetchTemplates();
      } else {
        toast.error(result.error || '创建失败');
        throw new Error(result.error);
      }
    } else {
      const response = await fetch(`/api/template/${editingTemplate?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success('模板更新成功');
        fetchTemplates();
      } else {
        toast.error(result.error || '更新失败');
        throw new Error(result.error);
      }
    }
  };

  // 格式化时间
  const formatTime = (date: Date | string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN });
  };

  // 渲染模板卡片
  const renderTemplateItem = (template: StyleTemplate, isSystem: boolean) => (
    <div
      key={template.id}
      onClick={() => {
        setSelectedTemplate(template);
        setPreviewVisible(true);
        setPreviewMinimized(false);
      }}
      className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
        selectedTemplate?.id === template.id
          ? 'border-sky-400 bg-sky-50 shadow-md'
          : 'border-transparent hover:border-sky-200 hover:bg-sky-50/50'
      }`}
    >
      <div className="flex items-center gap-4">
        {/* 图标 */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          template.isDefault
            ? 'bg-gradient-to-br from-amber-400 to-orange-500'
            : isSystem
              ? 'bg-gradient-to-br from-sky-400 to-cyan-500'
              : 'bg-gradient-to-br from-cyan-400 to-teal-400'
        }`}>
          {template.isDefault ? (
            <Star className="h-6 w-6 text-white fill-white" />
          ) : isSystem ? (
            <Crown className="h-6 w-6 text-white" />
          ) : (
            <FileText className="h-6 w-6 text-white" />
          )}
        </div>
        
        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sky-800 text-lg truncate">{template.name}</span>
            {template.isDefault && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 flex-shrink-0">默认</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-sky-500">
            <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-600">{template.platform}</span>
            <span>{template.useCount} 次使用</span>
            <span className="text-sky-400">{formatTime(template.createdAt)}</span>
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-sky-500 hover:text-sky-700 hover:bg-sky-100"
            onClick={(e) => { e.stopPropagation(); handleEdit(template); }}
            title="编辑"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {!template.isDefault && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-amber-500 hover:text-amber-700 hover:bg-amber-50"
              onClick={(e) => { e.stopPropagation(); setDefaultTemplate(template); }}
              title="设为默认"
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          {!isSystem && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); setDeleteTemplate(template); }}
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50">
      {/* 装饰背景 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-20 w-60 h-60 bg-cyan-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-40 h-40 bg-sky-300/20 rounded-full blur-2xl" />
      </div>

      {/* 顶部导航栏 */}
      <div className="fixed top-0 left-0 right-0 z-40 border-b border-sky-100 bg-white/80 backdrop-blur-md">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-200/50">
                  <Palette className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-300 rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">
                  样式模板管理
                </h1>
                <p className="text-sky-500/70 text-sm">
                  选择模板预览效果，点击星标设为默认
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* 预览面板切换 */}
              {selectedTemplate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (previewMinimized) {
                      setPreviewMinimized(false);
                    } else {
                      setPreviewVisible(!previewVisible);
                    }
                  }}
                  className="border-sky-200 text-sky-600 hover:bg-sky-50"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {previewMinimized ? '展开预览' : previewVisible ? '隐藏预览' : '显示预览'}
                </Button>
              )}
              
              {/* 平台筛选 */}
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="w-[130px] border-sky-200 focus:ring-sky-400">
                  <SelectValue placeholder="全部平台" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部平台</SelectItem>
                  {PLATFORM_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                size="sm"
                variant="outline"
                onClick={fetchTemplates}
                className="border-sky-200 text-sky-600 hover:bg-sky-50"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                刷新
              </Button>
              
              <Button 
                onClick={handleCreate}
                className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white shadow-lg shadow-sky-200/50"
              >
                <Plus className="h-4 w-4 mr-2" />
                新增模板
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="pt-24 pb-8 px-6 relative z-10">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-sky-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
              <LayoutTemplate className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                {systemTemplates.length + userTemplates.length}
              </div>
              <div className="text-xs text-violet-500">总模板数</div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-sky-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-fuchsia-100 to-pink-100 flex items-center justify-center">
              <Crown className="w-5 h-5 text-fuchsia-600" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                {systemTemplates.length}
              </div>
              <div className="text-xs text-fuchsia-500">系统模板</div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-sky-100 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                {userTemplates.length}
              </div>
              <div className="text-xs text-indigo-500">自定义模板</div>
            </div>
          </div>
        </div>

        {/* 模板列表 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
            <span className="text-sky-500 mt-3">加载中...</span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 系统模板 */}
            {systemTemplates.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="h-5 w-5 text-sky-500" />
                  <span className="font-semibold text-sky-700">系统模板</span>
                  <span className="text-sm text-sky-400">预设的专业模板，不可删除</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {systemTemplates.map((t) => renderTemplateItem(t, true))}
                </div>
              </div>
            )}
            
            {/* 用户模板 */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-cyan-500" />
                <span className="font-semibold text-sky-700">自定义模板</span>
                <span className="text-sm text-sky-400">您创建的个性化样式模板</span>
              </div>
              {userTemplates.length === 0 ? (
                <div className="bg-white/60 rounded-xl border border-dashed border-sky-200 py-12 text-center">
                  <FileText className="h-12 w-12 text-sky-300 mx-auto mb-3" />
                  <p className="text-sky-500">暂无自定义模板</p>
                  <p className="text-sm text-sky-400 mt-1">点击右上角「新增模板」创建您的第一个模板</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {userTemplates.map((t) => renderTemplateItem(t, false))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 浮动预览面板 */}
      {previewVisible && selectedTemplate && (
        <FloatingPreviewPanel
          template={selectedTemplate}
          onClose={() => setPreviewVisible(false)}
          onMinimize={() => setPreviewMinimized(!previewMinimized)}
          isMinimized={previewMinimized}
        />
      )}

      {/* 新增/编辑弹窗 */}
      <TemplateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        initialData={editingTemplate}
        mode={formMode}
      />

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
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
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 设置默认模板确认弹窗 */}
      <AlertDialog open={!!defaultTemplate} onOpenChange={() => setDefaultTemplate(null)}>
        <AlertDialogContent className="border-amber-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <Star className="h-5 w-5 fill-amber-400" />
              设为默认模板
            </AlertDialogTitle>
            <AlertDialogDescription>
              确定将「{defaultTemplate?.name}」设为 {defaultTemplate?.platform} 的默认模板吗？
              <br />
              <span className="text-sky-600">设置后，AI 生成文章时将自动使用此模板样式。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSettingDefault}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSetDefault}
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
    </div>
  );
}
