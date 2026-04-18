'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TemplatePreview } from './template-preview';
import { StyleTemplate } from '@/lib/template/types';
import { Loader2 } from 'lucide-react';

interface TemplateSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  platform?: string;
}

/**
 * 模板选择器组件
 * 用于 AI 创作时选择样式模板
 */
export function TemplateSelector({ 
  value, 
  onChange, 
  platform = '公众号' 
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<StyleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<StyleTemplate | null>(null);

  // 加载模板列表
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (platform) {
          params.append('platform', platform);
        }
        
        const response = await fetch(`/api/template?${params.toString()}`);
        const result = await response.json();
        
        if (result.success) {
          const allTemplates = [
            ...result.data.systemTemplates,
            ...result.data.userTemplates,
          ];
          setTemplates(allTemplates);
          
          // 设置默认选中
          if (value) {
            const found = allTemplates.find((t: StyleTemplate) => t.id === value);
            if (found) {
              setSelectedTemplate(found);
            }
          }
        }
      } catch (error) {
        console.error('加载模板列表失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [platform]);

  // 处理选择变化
  const handleChange = (templateId: string) => {
    onChange(templateId);
    
    if (templateId === 'none') {
      setSelectedTemplate(null);
    } else {
      const found = templates.find(t => t.id === templateId);
      if (found) {
        setSelectedTemplate(found);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载模板列表...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Select value={value || 'none'} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="请选择样式模板" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">不使用模板</SelectItem>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
              {template.isSystem ? ' (系统)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 选中模板的预览 */}
      {selectedTemplate && (
        <TemplatePreview 
          htmlContent={selectedTemplate.htmlContent}
          title="已选样式预览"
        />
      )}
    </div>
  );
}
