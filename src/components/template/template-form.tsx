'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_OPTIONS } from '@/lib/template/types';
import { Loader2, Eye, Minimize2, X, Code2 } from 'lucide-react';

interface TemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; htmlContent: string; platform: string }) => Promise<void>;
  initialData?: {
    id: string;
    name: string;
    htmlContent: string;
    platform: string;
  } | null;
  mode: 'create' | 'edit';
}

/**
 * 浮动预览面板组件（纯fixed定位）
 */
function EditorFloatingPreview({
  htmlContent,
  isVisible,
  onClose,
  onMinimize,
  isMinimized
}: {
  htmlContent: string;
  isVisible: boolean;
  onClose: () => void;
  onMinimize: () => void;
  isMinimized: boolean;
}) {
  if (!isVisible) return null;

  if (isMinimized) {
    return (
      <div 
        className="fixed right-4 bottom-4 z-[60] cursor-pointer animate-in fade-in duration-200"
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
    <div className="fixed w-[380px] z-[60] bg-white rounded-2xl shadow-2xl border border-sky-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
         style={{ right: '24px', top: '72px', bottom: '4px' }}>
      {/* 标题栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-100 to-cyan-50 border-b border-sky-200">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-sky-600" />
          <span className="font-medium text-sky-700">实时预览</span>
          {htmlContent && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              同步
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
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* 预览区域 */}
      <div className="flex-1 overflow-y-auto bg-gray-100 flex justify-center py-4">
        {htmlContent ? (
          <div className="w-[375px] bg-white shadow-lg flex-shrink-0 min-h-[600px]">
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
                      p { margin: 0 0 1em 0; }
                      h1, h2, h3 { margin: 0 0 0.5em 0; }
                    </style>
                  </head>
                  <body>${htmlContent}</body>
                </html>
              `}
              className="w-full border-0 bg-white"
              style={{ minHeight: '100%', height: '100%' }}
              sandbox="allow-same-origin"
              title="模板预览"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-sky-400">
            <div className="w-16 h-16 rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
              <Code2 className="h-8 w-8" />
            </div>
            <p className="text-sm">在左侧输入 HTML 代码</p>
            <p className="text-xs text-sky-400/70 mt-1">预览将实时同步显示</p>
          </div>
        )}
      </div>
      
      {/* 底部提示 */}
      <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
        <span className="text-xs text-gray-400">预览宽度 375px · 实时同步编辑内容</span>
      </div>
    </div>
  );
}

/**
 * 纯fixed定位的编辑弹窗
 */
function EditFormPanel({
  name,
  setName,
  htmlContent,
  setHtmlContent,
  platform,
  setPlatform,
  onSubmit,
  onCancel,
  onTogglePreview,
  isSubmitting,
  mode,
  previewVisible,
  previewMinimized
}: {
  name: string;
  setName: (val: string) => void;
  htmlContent: string;
  setHtmlContent: (val: string) => void;
  platform: string;
  setPlatform: (val: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onTogglePreview: () => void;
  isSubmitting: boolean;
  mode: 'create' | 'edit';
  previewVisible: boolean;
  previewMinimized: boolean;
}) {
  return (
    <div 
      className="fixed w-[680px] z-[60] bg-white rounded-2xl shadow-2xl border border-sky-200 flex flex-col overflow-hidden"
      style={{ left: '260px', top: '72px', maxHeight: 'calc(100vh - 180px)', height: 'auto' }}
    >
      {/* 主体内容：全宽编辑区 */}
      <div className="flex-1 flex flex-col gap-5 p-6 overflow-y-auto">
        {/* 模板名称 */}
        <div className="grid gap-2">
          <Label htmlFor="name" className="text-sky-700 font-medium flex items-center gap-2">
            <span className="w-1 h-4 bg-sky-400 rounded-full" />
            模板名称 <span className="text-red-400">*</span>
          </Label>
          <Input
            id="name"
            placeholder="请输入模板名称，如：公众号标准样式"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-sky-200 focus:border-sky-400 focus:ring-sky-400/20 placeholder:text-sky-300"
          />
        </div>

        {/* 平台分类 */}
        <div className="grid gap-2">
          <Label htmlFor="platform" className="text-sky-700 font-medium flex items-center gap-2">
            <span className="w-1 h-4 bg-cyan-400 rounded-full" />
            平台分类 <span className="text-red-400">*</span>
          </Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="border-sky-200 focus:ring-sky-400/20 focus:border-sky-400">
              <SelectValue placeholder="请选择平台" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* HTML 样式代码 */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <Label htmlFor="htmlContent" className="text-sky-700 font-medium flex items-center gap-2">
            <span className="w-1 h-4 bg-teal-400 rounded-full" />
            HTML 样式代码 <span className="text-red-400">*</span>
          </Label>
          <Textarea
            id="htmlContent"
            placeholder={`请粘贴 HTML 样式代码...

示例：
<section style="text-align:center; background:#fff; padding:0 10px;">
  <h2 style="color:#52C41A; font-weight:bold;">标题</h2>
  <p style="color:#3E3E3E;">正文内容...</p>
</section>

右侧浮动窗口将实时预览效果`}
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="flex-1 min-h-[350px] font-mono text-sm border-sky-200 focus:border-sky-400 focus:ring-sky-400/20 placeholder:text-sky-300 bg-sky-50/30 resize-none"
          />
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-sky-100 gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onTogglePreview}
            className="border-sky-200 text-sky-600 hover:bg-sky-50"
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewVisible && !previewMinimized ? '隐藏预览' : '显示预览'}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="border-sky-200 text-sky-600 hover:bg-sky-50"
          >
            取消
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!name.trim() || !htmlContent.trim() || isSubmitting}
            className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white shadow-lg shadow-sky-200/50 hover:shadow-sky-300/50 transition-all"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? '保存模板' : '更新模板'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * 模板表单组件（完全重写版本 - 纯fixed定位）
 * 用于新增和编辑模板
 * 预览区域为独立的浮动窗口
 */
export function TemplateForm({ 
  open, 
  onOpenChange, 
  onSubmit, 
  initialData,
  mode 
}: TemplateFormProps) {
  const [name, setName] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [platform, setPlatform] = useState('公众号');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 浮动预览窗口状态
  const [previewVisible, setPreviewVisible] = useState(true);
  const [previewMinimized, setPreviewMinimized] = useState(false);

  // 初始化表单数据
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setHtmlContent(initialData.htmlContent);
      setPlatform(initialData.platform);
    } else {
      setName('');
      setHtmlContent('');
      setPlatform('公众号');
    }
    // 打开弹窗时重置预览窗口状态
    if (open) {
      setPreviewVisible(true);
      setPreviewMinimized(false);
    }
  }, [initialData, open]);

  // 提交表单
  const handleSubmit = async () => {
    if (!name.trim() || !htmlContent.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name, htmlContent, platform });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/50 z-[55]"
        onClick={() => onOpenChange(false)}
      />
      
      {/* 编辑弹窗 - 纯fixed定位，左侧显示 */}
      <EditFormPanel
        name={name}
        setName={setName}
        htmlContent={htmlContent}
        setHtmlContent={setHtmlContent}
        platform={platform}
        setPlatform={setPlatform}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
        onTogglePreview={() => {
          setPreviewVisible(!previewVisible);
          setPreviewMinimized(false);
        }}
        isSubmitting={isSubmitting}
        mode={mode}
        previewVisible={previewVisible}
        previewMinimized={previewMinimized}
      />

      {/* 浮动预览窗口 - 纯fixed定位，右侧显示 */}
      <EditorFloatingPreview
        htmlContent={htmlContent}
        isVisible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onMinimize={() => setPreviewMinimized(!previewMinimized)}
        isMinimized={previewMinimized}
      />
    </>
  );
}
