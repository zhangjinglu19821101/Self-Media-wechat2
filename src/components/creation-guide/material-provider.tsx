'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Paperclip, Database, Sparkles, Upload, X, FileText, Loader2, ImageIcon } from 'lucide-react';

// 从统一类型文件导入
import type { MaterialData, MaterialProviderProps } from './types';

/** 上传文件信息 */
interface UploadedFile {
  name: string;
  size: number;
  type: string; // 'text' | 'parsing' | 'error'
  preview?: string; // 文本预览（前200字）
  error?: string;
}

export function MaterialProvider({ value, onChange }: MaterialProviderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<Record<keyof MaterialData, UploadedFile[]>>({
    relatedMaterials: [],
    keyMaterials: [],
  });
  const [parsingFile, setParsingFile] = useState<string | null>(null);

  const handleChange = (field: keyof MaterialData, text: string) => {
    onChange({ ...value, [field]: text });
  };

  /** 客户端读取纯文本文件（txt/md/html） */
  const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  };

  /** 处理文件上传 */
  const handleFileUpload = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof MaterialData
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 重置 input，允许重复选择同一文件
    e.target.value = '';

    // 文件大小限制：5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      const errFile: UploadedFile = {
        name: file.name,
        size: file.size,
        type: 'error',
        error: `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请小于 5MB`,
      };
      setUploadedFiles(prev => ({
        ...prev,
        [field]: [...(prev[field] || []), errFile],
      }));
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    // 纯文本格式：客户端直接读取
    const TEXT_EXTENSIONS = ['.txt', '.md', '.html', '.htm', '.csv', '.json'];
    if (TEXT_EXTENSIONS.includes(ext)) {
      try {
        const text = await readTextFile(file);
        const preview = text.slice(0, 200) + (text.length > 200 ? '...' : '');

        const uploaded: UploadedFile = {
          name: file.name,
          size: file.size,
          type: 'text',
          preview,
        };

        // 追加到已上传列表
        setUploadedFiles(prev => ({
          ...prev,
          [field]: [...(prev[field] || []), uploaded],
        }));

        // 追加到对应文本框内容
        const separator = value[field] && !value[field].endsWith('\n') ? '\n\n' : '';
        const fileHeader = `\n--- 📎 ${file.name} ---\n`;
        onChange({ ...value, [field]: value[field] + separator + fileHeader + text });
      } catch {
        const errFile: UploadedFile = {
          name: file.name,
          size: file.size,
          type: 'error',
          error: '文件读取失败，请确认编码为 UTF-8',
        };
        setUploadedFiles(prev => ({
          ...prev,
          [field]: [...(prev[field] || []), errFile],
        }));
      }
      return;
    }

    // PDF/DOCX 等二进制格式：调用后端解析
    const BINARY_EXTENSIONS = ['.pdf', '.docx', '.doc'];
    // 图片格式：调用后端 LLM 视觉识别
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

    if (BINARY_EXTENSIONS.includes(ext) || IMAGE_EXTENSIONS.includes(ext)) {
      const pendingFile: UploadedFile = {
        name: file.name,
        size: file.size,
        type: 'parsing',
        preview: '正在解析...',
      };
      setUploadedFiles(prev => ({
        ...prev,
        [field]: [...(prev[field] || []), pendingFile],
      }));
      setParsingFile(`${field}-${file.name}`);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/materials/upload-parse', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || '解析失败');
        }

        const text = data.content || '';
        const preview = text.slice(0, 200) + (text.length > 200 ? '...' : '');

        // 更新文件状态为成功
        setUploadedFiles(prev => ({
          ...prev,
          [field]: (prev[field] || []).map(f =>
            f.name === file.name
              ? { ...f, type: 'text' as const, preview }
              : f
          ),
        }));

        // 追加到文本框
        const separator = value[field] && !value[field].endsWith('\n') ? '\n\n' : '';
        const fileHeader = `\n--- 📎 ${file.name} ---\n`;
        onChange({ ...value, [field]: value[field] + separator + fileHeader + text });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '解析失败';
        setUploadedFiles(prev => ({
          ...prev,
          [field]: (prev[field] || []).map(f =>
            f.name === file.name
              ? { ...f, type: 'error' as const, error: errorMsg }
              : f
          ),
        }));
      } finally {
        setParsingFile(null);
      }
      return;
    }

    // 不支持的格式
    const errFile: UploadedFile = {
      name: file.name,
      size: file.size,
      type: 'error',
      error: `不支持的格式：${ext}。支持 .txt/.md/.html/.jpg/.png/.webp/.pdf/.docx`,
    };
    setUploadedFiles(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), errFile],
    }));
  }, [value, onChange]);

  /** 移除已上传的文件（同时从文本框中移除对应内容） */
  const removeFile = (field: keyof MaterialData, fileName: string) => {
    setUploadedFiles(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter(f => f.name !== fileName),
    }));
    // 从文本框中移除该文件的内容块
    const fileMarker = `--- 📎 ${fileName} ---`;
    if (value[field]?.includes(fileMarker)) {
      const parts = value[field].split(fileMarker);
      if (parts.length >= 2) {
        // 移除文件标记和其后的内容（直到下一个文件标记或末尾）
        const afterMarker = parts[1];
        const nextMarkerIdx = afterMarker.indexOf('\n--- 📎 ');
        const toRemove = nextMarkerIdx > 0
          ? fileMarker + afterMarker.slice(0, nextMarkerIdx)
          : fileMarker + afterMarker;
        const newValue = value[field].replace(toRemove, '').replace(/\n{3,}/g, '\n\n').trim();
        onChange({ ...value, [field]: newValue });
      }
    }
  };

  /** 格式化文件大小 */
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  /** 判断文件是否为图片 */
  const isImageFileName = (name: string): boolean => {
    const ext = '.' + name.split('.').pop()?.toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  };

  /** 渲染单个文件标签 */
  const renderFileTag = (field: keyof MaterialData, file: UploadedFile) => {
    if (file.type === 'error') {
      return (
        <div key={file.name} className="flex items-center gap-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded-md text-xs">
          <X className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-red-600 truncate">{file.name}</span>
          <span className="text-red-400 shrink-0">({formatSize(file.size)})</span>
          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 shrink-0" onClick={() => removeFile(field, file.name)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      );
    }

    const isParsing = file.type === 'parsing' && parsingFile === `${field}-${file.name}`;
    const isImageFile = file.type !== 'error' && isImageFileName(file.name);

    return (
      <div key={file.name} className={`flex items-center gap-2 px-2 py-1.5 border rounded-md text-xs ${
        isParsing ? 'bg-sky-50 border-sky-200 animate-pulse' : 'bg-emerald-50 border-emerald-200'
      }`}>
        {isParsing ? (
          <Loader2 className="w-3 h-3 text-sky-500 shrink-0 animate-spin" />
        ) : isImageFile ? (
          <ImageIcon className="w-3 h-3 text-violet-500 shrink-0" />
        ) : (
          <FileText className="w-3 h-3 text-emerald-500 shrink-0" />
        )}
        <span className={`truncate ${isParsing ? 'text-sky-600' : 'text-emerald-700'}`}>{file.name}</span>
        <span className={isParsing ? 'text-sky-400' : 'text-emerald-500'} shrink-0>({formatSize(file.size)})</span>
        {!isParsing && (
          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 shrink-0" onClick={() => removeFile(field, file.name)}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-sky-500" />
            素材提供
            <span className="text-xs font-normal text-slate-500 ml-1">（可选）</span>
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          提供素材供AI参考，支持粘贴文本或上传附件（.txt/.md/.html/.jpg/.png/.pdf/.docx）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 关联素材补充区 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-500" />
              关联素材补充区
              <span className="text-xs font-normal text-slate-500">（AI优先参考使用）</span>
            </Label>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".txt,.md,.html,.htm,.pdf,.docx,.jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'relatedMaterials')}
              />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <span><Upload className="w-3 h-3" />上传附件</span>
              </Button>
            </label>
          </div>

          {/* 已上传文件列表 */}
          {(uploadedFiles.relatedMaterials || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.relatedMaterials.map(f => renderFileTag('relatedMaterials', f))}
            </div>
          )}

          <Textarea
            placeholder="用户粘贴关联素材（知识点、补充案例等），AI优先参考使用。例如：根据国家金融监管总局2024年最新数据，重疾险理赔率约为32%；香港保险的免体检额度通常更高，可达50万美元..."
            value={value.relatedMaterials}
            onChange={(e) => handleChange('relatedMaterials', e.target.value)}
            rows={4}
            className="resize-none text-sm border-slate-200 focus:border-sky-500 focus:ring-sky-500/20"
          />
        </div>

        {/* 本篇关键素材区 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              本篇关键素材区
              <span className="text-xs font-normal text-emerald-600">（AI仅可使用，不可编造）</span>
            </Label>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".txt,.md,.html,.htm,.pdf,.docx,.jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'keyMaterials')}
              />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" asChild>
                <span><Upload className="w-3 h-3" />上传附件</span>
              </Button>
            </label>
          </div>

          {/* 已上传文件列表 */}
          {(uploadedFiles.keyMaterials || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.keyMaterials.map(f => renderFileTag('keyMaterials', f))}
            </div>
          )}

          <Textarea
            placeholder="用户输入本篇文章专属关键素材（权威数据、条款、案例细节等），AI仅可使用该素材，不编造内容。例如：中国保险行业协会发布的《2023年度保险理赔白皮书》显示，恶性肿瘤理赔占比高达68.3%；某具体案例中，客户甲状腺癌术后3个月即获赔50万元..."
            value={value.keyMaterials}
            onChange={(e) => handleChange('keyMaterials', e.target.value)}
            rows={4}
            className="resize-none text-sm border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50/30"
          />
        </div>
      </CardContent>
    </Card>
  );
}
