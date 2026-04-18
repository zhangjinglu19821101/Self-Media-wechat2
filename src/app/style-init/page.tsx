'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Upload,
  BarChart3,
  MessageCircle,
  Type,
  FileText,
  Layout,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Database,
  Target,
  Palette,
  Settings,
  Info,
  Image as ImageIcon,
  Rocket,
  Save,
  X,
  ChevronDown,
} from 'lucide-react';
import { apiGet, apiPost, apiFetch } from '@/lib/api/client';
import type {
  SixDimensionAnalysis,
  OverallToneAnalysis,
  ToneAndVoiceAnalysis,
  ExpressionHabitsAnalysis,
  ContentDetailAnalysis,
  FormattingStyleAnalysis,
  XiaohongshuStyleAnalysis,
} from '@/types/style-analysis';
// P1 修复：导入平台常量
import { 
  DEFAULT_PLATFORM, 
  PLATFORM_OPTIONS, 
  PLATFORM_LABELS,
  type PlatformType 
} from '@/lib/db/schema/style-template';

// ═══════════════════════════════════════════════════
// 维度配置（用于渲染）
// ═══════════════════════════════════════════════════

	// L5: 维度配置（编号 ①②④⑤⑥，维度③文章结构待后续实现）
	const DIMENSION_CONFIG = [
  {
    key: 'overallTone',
    label: '① 整体调性',
    icon: Target,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: '消费者立场、产品中立性、专业度、温度感、避坑导向',
  },
  {
    key: 'toneAndVoice',
    label: '② 语气与口吻',
    icon: MessageCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: '代词使用、口语化程度、焦虑/夸大检测、正式度',
  },
  {
    key: 'expressionHabits',
    label: '④ 表达习惯',
    icon: Type,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: '高频特色词、绝对化禁用词、行业词汇',
  },
  {
    key: 'contentDetails',
    label: '⑤ 内容细节',
    icon: FileText,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: '案例命名规范、数据源规范、合规声明检测',
  },
  {
    key: 'formattingStyle',
    label: '⑥ 排版风格',
    icon: Layout,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    description: '段落长度分布、小标题模式、总字数统计',
  },
] as const;

// ═══════════════════════════════════════════════════
// 主页面组件
// ═══════════════════════════════════════════════════

export default function StyleInitPage() {
  const router = useRouter();
  // 状态
  const [articleText, setArticleText] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [targetWordCount, setTargetWordCount] = useState<string>('1750');
  const [xhsTags, setXhsTags] = useState('');  // 小红书话题标签
  const [xhsImageMode, setXhsImageMode] = useState<'3-card' | '5-card' | '7-card'>('5-card');  // 图片数量模式
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<SixDimensionAnalysis | null>(null);
  const [xhsAnalysisResult, setXhsAnalysisResult] = useState<XiaohongshuStyleAnalysis | null>(null);  // 小红书分析结果
  const [savedRules, setSavedRules] = useState<number>(0);
  
  // 🔥 风格相似度相关状态
  const [styleSimilarity, setStyleSimilarity] = useState<{
    similarity: number;
    skipped: boolean;
    warning?: string;
    details?: {
      dimensionScore: number;
      vocabularyScore: number;
      toneScore: number;
    };
  } | null>(null);
  
  // 🔥 模板选择相关状态
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    ruleCount: number;
    articleCount?: number;
    sourceArticles?: any[];
    isDefault: boolean;
  }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [createNewTemplate, setCreateNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // 🔥 平台选择状态
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>(DEFAULT_PLATFORM);

  // 🔥 图片上传状态（多模态视觉分析）
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [imageUploading, setImageUploading] = useState(false);

  // 🔥 内容模板状态（Phase 1-3）
  const [savedContentTemplateId, setSavedContentTemplateId] = useState<string | null>(null);
  const [savingContentTemplate, setSavingContentTemplate] = useState(false);
  const savedContentTemplateIdRef = useRef<string | null>(null); // 用于跳转时获取最新值
  const [contentTemplateExpanded, setContentTemplateExpanded] = useState(false); // 🔥 内容模板卡片折叠状态
  
  // 🔥 P0 修复：使用 AbortController 防止竞态条件
  const loadTemplatesAbortRef = useRef<AbortController | null>(null);
  
  const [error, setError] = useState<string>('');
  const [existingRules, setExistingRules] = useState<{ totalRules: number; dimensions: Record<string, number> } | null>(null);

  // 加载已有规则数据
  const loadExistingRules = useCallback(async () => {
    try {
      const res = await fetch('/api/style/init-from-upload');
      const data = await res.json();
      if (data.success) {
        setExistingRules(data.data);
      }
    } catch (_) { /* ignore */ }
  }, []);

  // 页面加载时查询已有规则
  useEffect(() => { loadExistingRules(); }, [loadExistingRules]);

  // 🔥 加载风格模板列表（按平台筛选）
  // P0 修复：使用 AbortController 防止竞态条件
  const loadTemplates = useCallback(async (platform: string) => {
    // 取消之前的请求
    if (loadTemplatesAbortRef.current) {
      loadTemplatesAbortRef.current.abort();
    }
    loadTemplatesAbortRef.current = new AbortController();
    
    setLoadingTemplates(true);
    try {
      const data = await apiGet(`/api/style-templates?platform=${platform}`) as Record<string, any>;
      console.log('[StyleInit] 加载模板结果:', data, '平台:', platform);
      if (data.success) {
        console.log('[StyleInit] 模板数量:', data.data?.length, data.data);
        setTemplates(data.data || []);
        // 默认选中默认模板
        const defaultTemplate = data.data?.find((t: any) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
          console.log('[StyleInit] 选中默认模板:', defaultTemplate.id, defaultTemplate.name);
        } else if (!data.data || data.data.length === 0) {
          // 🔥 修复：没有模板时，默认勾选"创建新模板"
          setCreateNewTemplate(true);
        } else {
          // 有模板但没有默认的，选中第一个
          setSelectedTemplateId(data.data[0]?.id);
        }
      }
    } catch (error: any) {
      // 忽略取消的请求
      if (error.name === 'AbortError') return;
      console.error('[StyleInit] 加载模板列表失败:', error);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  // 页面加载时加载模板列表
  // 🔥 加载风格模板（平台变化时重新加载）
  useEffect(() => { 
    loadTemplates(selectedPlatform); 
    
    // 组件卸载时取消请求
    return () => {
      if (loadTemplatesAbortRef.current) {
        loadTemplatesAbortRef.current.abort();
      }
    };
  }, [loadTemplates, selectedPlatform]);
  // 执行分析
  const handleAnalyze = useCallback(async () => {
    const minLength = selectedPlatform === 'xiaohongshu' ? 30 : 50;
    if (!articleText.trim() || articleText.trim().length < minLength) {
      setError(`内容不能少于 ${minLength} 个字符`);
      return;
    }

    // 🔥 强制校验：必须选择模板或创建新模板
    if (!createNewTemplate && !selectedTemplateId) {
      setError('请选择一个风格模板，或勾选「创建新模板」');
      toast.warning('请先选择风格模板');
      return;
    }
    
    // 🔥 如果选择创建新模板，必须填写模板名称
    if (createNewTemplate && !newTemplateName.trim()) {
      setError('请输入新模板的名称');
      toast.warning('请输入新模板名称');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setXhsAnalysisResult(null);
    setSavedRules(0);
    setStyleSimilarity(null); // 🔥 重置风格相似度
    setSavedContentTemplateId(null); // 🔥 重置内容模板ID

    // 🔥 LLM 多模态分析耗时长（可达 90 秒），需要长超时 + AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000); // 120 秒超时

    try {
      // 🔥 小红书和公众号使用不同的请求参数
      const requestBody: Record<string, any> = {
        articleText,
        articleTitle: articleTitle || '上传文章',
        targetWordCount: targetWordCount ? parseInt(targetWordCount) : undefined,
        // 模板选择参数
        templateId: createNewTemplate ? undefined : (selectedTemplateId || undefined),
        createTemplate: createNewTemplate,
        templateName: createNewTemplate ? newTemplateName : undefined,
        // 平台参数
        platform: selectedPlatform,
      };

      // 🔥 小红书额外参数
      if (selectedPlatform === 'xiaohongshu') {
        requestBody.tags = xhsTags.split(/[,，]/).map(t => t.trim()).filter(Boolean);
        requestBody.imageCountMode = xhsImageMode;  // P0修复：传递用户选择的图片数量模式
      }

      // 🔥 使用 apiFetch 自动携带 workspaceId + 401 处理
      let data: any;
      if (uploadedImages.length > 0) {
        const formData = new FormData();
        formData.append('articleText', articleText);
        formData.append('articleTitle', articleTitle || '上传文章');
        if (targetWordCount) formData.append('targetWordCount', targetWordCount);
        if (!createNewTemplate && selectedTemplateId) formData.append('templateId', selectedTemplateId);
        if (createNewTemplate) {
          formData.append('createTemplate', 'true');
          if (newTemplateName.trim()) formData.append('templateName', newTemplateName);
        }
        formData.append('platform', selectedPlatform);
        if (selectedPlatform === 'xiaohongshu') {
          formData.append('tags', JSON.stringify(xhsTags.split(/[,，]/).map(t => t.trim()).filter(Boolean)));
          formData.append('imageCountMode', xhsImageMode);
        }
        // 添加图片文件
        uploadedImages.forEach((img, i) => {
          formData.append(`images`, img.file);
        });

        data = await apiFetch('/api/style/init-from-upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } else {
        data = await apiFetch('/api/style/init-from-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      }

      if (data.success) {
        // 🔥 根据平台类型设置不同的分析结果
        if (selectedPlatform === 'xiaohongshu' && data.data.xhsAnalysis) {
          setXhsAnalysisResult(data.data.xhsAnalysis);
        } else if (data.data.analysis) {
          setAnalysisResult(data.data.analysis);
        }
        
        setSavedRules(data.data.savedRules);
        
        // 🔥 处理风格相似度信息
        if (data.data.styleSimilarity) {
          setStyleSimilarity(data.data.styleSimilarity);
          
          // 显示风格相似度警告（如果有）
          if (data.data.styleSimilarity.warning) {
            toast.warning(`⚠️ ${data.data.styleSimilarity.warning}`);
          }
          
          // 显示风格相似度分数
          const similarityPercent = (data.data.styleSimilarity.similarity * 100).toFixed(0);
          if (!data.data.styleSimilarity.skipped) {
            toast.info(`📊 风格相似度: ${similarityPercent}%`);
          }
        }
        
        // 🔥 处理缓存结果（中文提示）
        if (data.data.fromCache) {
          const duplicateTypeText = data.data.duplicateInfo?.duplicateType === 'exact' 
            ? '内容完全相同' 
            : '内容非常相似';
          toast.info(`📋 检测到重复文章（${duplicateTypeText}），已使用缓存的分析结果`);
          if (data.data.duplicateInfo?.similarity) {
            const similarityPercent = (data.data.duplicateInfo.similarity * 100).toFixed(1);
            toast.info(`文章相似度: ${similarityPercent}%`);
          }
        }
        
        // 添加成功反馈
        if (data.data.templateId && createNewTemplate) {
          toast.success(`✅ 已创建新模板「${newTemplateName}」并保存 ${data.data.savedRules} 条风格规则`);
          // 重新加载模板列表
          loadTemplates(selectedPlatform);
          // 清空新模板名称
          setNewTemplateName('');
          setCreateNewTemplate(false);
        } else if (data.data.savedRules > 0) {
          toast.success(`✅ 已保存 ${data.data.savedRules} 条风格规则`);
        }
        
        // 处理 warnings 字段，提示用户规则入库失败
        if (data.data.warnings && data.data.warnings.length > 0) {
          setError(`⚠️ ${data.data.warnings.join('; ')}`);
        }
        
        // 处理近似重复提示（中文）
        if (data.data.duplicateInfo?.isDuplicate && !data.data.fromCache) {
          const similarityPercent = data.data.duplicateInfo.similarity 
            ? (data.data.duplicateInfo.similarity * 100).toFixed(1) 
            : '?';
          toast.warning(`⚠️ 检测到相似文章（相似度 ${similarityPercent}%），已重新分析`);
        }
      } else {
        // 🔥 处理风格相似度过低的特殊错误
        if (data.code === 'STYLE_SIMILARITY_TOO_LOW') {
          setError(`风格不匹配: ${data.error}`);
          toast.error('风格相似度过低，建议更换模板');
          
          // 如果有推荐模板，显示推荐信息
          if (data.data?.recommendation) {
            toast.info(`💡 推荐使用模板「${data.data.recommendation.templateName}」（相似度 ${(data.data.recommendation.similarity * 100).toFixed(0)}%）`);
          }
        } else {
          setError(data.error || '分析失败');
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('请求超时（120秒），LLM 分析耗时过长，请重试');
      } else {
        setError(err instanceof Error ? err.message : '网络错误，请检查连接后重试');
      }
    } finally {
      clearTimeout(timeoutId);
      setAnalyzing(false);
    }
  }, [articleText, articleTitle, targetWordCount, selectedTemplateId, createNewTemplate, newTemplateName]);

  // 🔥 保存内容模板到模板库（Phase 1-3）
  const handleSaveContentTemplate = useCallback(async () => {
    if (!xhsAnalysisResult?.contentTemplate) return;
    setSavingContentTemplate(true);
    try {
      const data = await apiPost<{ success: boolean; data?: { id: string; name: string }; error?: string }>(
        '/api/content-templates',
        {
          name: xhsAnalysisResult.contentTemplate.name || generateAutoTemplateName(),
          description: xhsAnalysisResult.contentTemplate.structure?.description || '',
          platform: selectedPlatform,
          analysis: xhsAnalysisResult.contentTemplate,
          styleTemplateId: selectedTemplateId || undefined,
        }
      );
      if (data.success && data.data?.id) {
        setSavedContentTemplateId(data.data.id);
        savedContentTemplateIdRef.current = data.data.id; // 🔥 同步 ref 供跳转使用
        toast.success(`✅ 内容模板「${data.data.name}」已保存到模板库`);
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (err) {
      toast.error('网络错误，请重试');
    } finally {
      setSavingContentTemplate(false);
    }
  }, [xhsAnalysisResult, selectedPlatform, selectedTemplateId]);

  // 🔥 自动生成模板名称（辅助函数）
  const generateAutoTemplateName = useCallback(() => {
    if (!xhsAnalysisResult?.contentTemplate) return '未命名模板';
    // 如果分析结果已有name则直接使用
    if (xhsAnalysisResult.contentTemplate.name) return xhsAnalysisResult.contentTemplate.name;
    // 否则根据结构自动生成
    const ct = xhsAnalysisResult.contentTemplate;
    const cardMode = ct.structure?.cardCountMode || '5-card';
    const density = ct.structure?.densityStyle === 'minimal' ? '极简' :
                    ct.structure?.densityStyle === 'concise' ? '精简' :
                    ct.structure?.densityStyle === 'detailed' ? '详尽' : '标准';
    return `${cardMode.replace('-card', '卡')}-${density}风`;
  }, [xhsAnalysisResult]);

  // 处理文件上传
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // L4: 文件大小限制（最大 2MB），防止大文件导致页面卡死
    const MAX_FILE_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择小于 2MB 的文件`);
      return;
    }

    // L4: .docx 是二进制格式，readAsText 无法正确读取
    const UNSUPPORTED_EXTENSIONS = ['.docx', '.doc', '.pdf', '.wps'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (UNSUPPORTED_EXTENSIONS.includes(ext)) {
      setError(`不支持的文件格式：${ext}。请使用 .txt / .md / .html 格式上传纯文本内容`);
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setArticleText(text);
      if (!articleTitle) setArticleTitle(file.name.replace(/\.[^.]+$/, ''));
    };
    reader.onerror = () => {
      setError('文件读取失败，请确认文件编码为 UTF-8');
    };
    reader.readAsText(file);
  }, [articleTitle]);

  // 🔥 图片上传处理（多模态视觉分析）
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 限制最多9张图片（小红书笔记常见5-9张，9张足够覆盖完整风格）
    const MAX_IMAGES = 9;
    const remainingSlots = MAX_IMAGES - uploadedImages.length;
    if (remainingSlots <= 0) {
      toast.warning('最多上传9张图片');
      return;
    }
    const filesToAdd = files.slice(0, remainingSlots);

    // 校验文件类型和大小
    const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    const newImages: Array<{ file: File; previewUrl: string }> = [];
    for (const file of filesToAdd) {
      if (!VALID_TYPES.includes(file.type)) {
        setError(`不支持的图片格式：${file.name}，请使用 JPG/PNG/WebP 格式`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        setError(`图片过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择小于5MB的图片`);
        continue;
      }
      newImages.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setUploadedImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES));
    // 重置 input 以便重复选择同一文件
    e.target.value = '';
  }, [uploadedImages.length]);

  // 移除已上传的图片
  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].previewUrl);
      newImages.splice(index, 1);
      return newImages;
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-sky-500 to-cyan-500 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              风格初始化
            </h1>
            <p className="mt-2 text-slate-500">
              从文章提取写作风格，写入数字资产库供后续创作参考
            </p>
          </div>
          {existingRules && (
            <Card className="border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 shadow-sm">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Database className="w-4 h-4 text-sky-500" />
                <span className="text-sm text-slate-600">已入库规则:</span>
                <Badge className="bg-gradient-to-r from-sky-500 to-cyan-600 text-white border-0">
                  {existingRules.totalRules} 条
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={loadExistingRules}
                  className="text-sky-600 hover:text-sky-700 hover:bg-sky-100"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> 刷新
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 输入区卡片 - 统一天蓝色系风格 */}
        <Card className="border-sky-200 shadow-lg shadow-sky-50/30">
          <CardHeader className="pb-6 border-b border-sky-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Upload className="w-5 h-5 text-sky-600" />
                  上传文章
                </CardTitle>
                <CardDescription className="mt-1 text-slate-500">
                  粘贴文章内容或上传文本文件（支持 .txt / .md / .html），建议上传 2-3 篇代表性作品
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 🔥 模板选择区域 - 统一天蓝色系风格 */}
            <div className="space-y-3 p-4 bg-gradient-to-r from-sky-50 via-cyan-50 to-blue-50 rounded-xl border border-sky-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-sky-600" />
                  <span className="font-semibold text-slate-700">风格模板</span>
                </div>
                <Link href="/account-management">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-sky-600 hover:text-sky-700 hover:bg-sky-100"
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    管理模板
                  </Button>
                </Link>
              </div>
              
              {/* 🔥 平台选择 - 业界UI标准优化 */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">目标平台</label>
                  <Select
                    value={selectedPlatform}
                    onValueChange={(value: string) => {
                      setSelectedPlatform(value as PlatformType);
                      setSelectedTemplateId('');
                      setTemplates([]);
                    }}
                    disabled={loadingTemplates}
                  >
                    <SelectTrigger className="w-48 h-10 bg-white border-sky-200 hover:border-sky-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-sm transition-all duration-200">
                      <SelectValue placeholder="选择平台" />
                    </SelectTrigger>
                    <SelectContent className="border-sky-200 shadow-lg shadow-sky-100/50">
                      {PLATFORM_OPTIONS.map((option) => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          className="hover:bg-sky-50 focus:bg-sky-100 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500" />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end pb-1">
                  <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                    {loadingTemplates ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        加载中...
                      </span>
                    ) : (
                      `当前平台 ${templates.length} 个模板`
                    )}
                  </span>
                </div>
              </div>
              
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  <span className="ml-2 text-sm text-slate-500">加载模板...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="space-y-2">
                  {/* 🔥 修复：更友好的提示 */}
                  <p className="text-sm text-amber-600 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    暂无风格模板，请创建新模板保存风格规则
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="输入新模板名称（如：公众号风格）"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  {newTemplateName.trim() && (
                    <p className="text-xs text-sky-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      将创建新模板「{newTemplateName}」并保存规则
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Select
                      value={selectedTemplateId}
                      onValueChange={setSelectedTemplateId}
                      disabled={createNewTemplate}
                    >
                      <SelectTrigger className="flex-1 h-11 bg-white border-sky-200 hover:border-sky-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 shadow-sm transition-all duration-200">
                        <SelectValue placeholder={`选择要保存到的模板（共 ${templates.length} 个）`}>
                          {selectedTemplateId && (() => {
                            const t = templates.find(tpl => tpl.id === selectedTemplateId);
                            if (!t) return null;
                            return (
                              <div className="flex items-center gap-2">
                                <div className={`flex-shrink-0 ${t.isDefault ? 'text-emerald-500' : 'text-slate-400'}`}>
                                  {t.isDefault ? <CheckCircle2 className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  <span className={`font-medium text-slate-700 ${t.isDefault ? 'text-emerald-700' : ''} shrink-0 truncate`}>
                                    {t.name}
                                  </span>
                                  {t.isDefault && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-emerald-500 to-green-600 text-white shrink-0">
                                      默认
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="w-[520px] max-h-[420px] border-sky-200 shadow-xl shadow-sky-100/60">
                        {templates.map((t) => (
                          <SelectItem 
                            key={t.id} 
                            value={t.id} 
                            className="py-3.5 pl-3 pr-4 hover:bg-sky-50 focus:bg-sky-100 transition-colors duration-200"
                          >
                            <div className="flex items-start gap-3 w-full">
                              <div className={`flex-shrink-0 mt-0.5 ${t.isDefault ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {t.isDefault ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <Target className="w-4 h-4" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-semibold text-slate-800 ${t.isDefault ? 'text-emerald-700' : ''}`}>
                                    {t.name}
                                  </span>
                                  {t.isDefault && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-emerald-500 to-green-600 text-white">
                                      默认
                                    </span>
                                  )}
                                </div>
                                
                                {/* 使用场景说明 - 截断处理 */}
                                {t.description && (
                                  <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                                    {t.description}
                                  </p>
                                )}
                                
                                {/* 规则统计 - 只在有数据时显示，且横向排列 */}
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                  {(t.ruleCount ?? 0) > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Layout className="w-3.5 h-3.5" />
                                      {t.ruleCount} 条规则
                                    </span>
                                  )}
                                  {(t.articleCount ?? 0) > 0 && (
                                    <span className="flex items-center gap-1">
                                      <FileText className="w-3.5 h-3.5" />
                                      {t.articleCount} 篇文章
                                    </span>
                                  )}
                                  {t.sourceArticles && Array.isArray(t.sourceArticles) && t.sourceArticles.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Database className="w-3.5 h-3.5" />
                                      {t.sourceArticles.length} 篇样本
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="checkbox"
                        id="createNewTemplate"
                        checked={createNewTemplate}
                        onChange={(e) => setCreateNewTemplate(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <label htmlFor="createNewTemplate" className="text-sm text-slate-600 whitespace-nowrap">
                        新建
                      </label>
                    </div>
                  </div>
                  
                  {/* 🔥 新增：提示用户有多个模板可选 */}
                  {templates.length > 1 && !createNewTemplate && (
                    <p className="text-xs text-slate-500">
                      点击下拉框可切换模板（当前共 {templates.length} 个模板可选）
                    </p>
                  )}
                  
                  {createNewTemplate && (
                    <Input
                      placeholder="输入新模板名称"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                    />
                  )}
                  
                  {!createNewTemplate && selectedTemplateId && (
                    <p className="text-xs text-sky-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      规则将保存到「{templates.find(t => t.id === selectedTemplateId)?.name}」模板
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <Separator />
            
            {selectedPlatform === 'xiaohongshu' ? (
              /* ========== 小红书专用输入区 ========== */
              <div className="space-y-4 p-4 bg-gradient-to-r from-rose-50 via-pink-50 to-orange-50 rounded-xl border border-rose-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📕</span>
                  <span className="font-semibold text-rose-800">小红书笔记内容</span>
                  <span className="text-xs text-rose-500 bg-rose-100 px-2 py-0.5 rounded-full">图文风格分析</span>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1 block">笔记标题 *</label>
                  <Input
                    placeholder="例如：我已经不卖重疾险了，但我能告诉你一些真相"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    className="border-rose-200 focus:border-rose-400"
                  />
                </div>

                {/* 🔥 图片上传区（多模态视觉分析） */}
                <div>
                  <label className="text-sm font-medium mb-1 block flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    笔记截图上传（可选，推荐）
                    <span className="text-xs text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full">多模态分析</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    上传 1-9 张小红书笔记截图，系统将自动提取配色、布局、装饰等视觉风格
                  </p>

                  {/* 上传按钮 + 已上传图片预览 */}
                  <div className="space-y-3">
                    {uploadedImages.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {uploadedImages.map((img, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={img.previewUrl}
                              alt={`上传图片 ${index + 1}`}
                              className="w-24 h-24 object-cover rounded-lg border-2 border-purple-200 shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-0.5 rounded-b-lg">
                              {index + 1}
                            </div>
                          </div>
                        ))}
                        {uploadedImages.length < 9 && (
                          <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-purple-300 rounded-lg cursor-pointer hover:bg-purple-50 transition-colors">
                            <ImageIcon className="w-6 h-6 text-purple-400" />
                            <span className="text-xs text-purple-500 mt-1">+ 添加</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              multiple
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    )}

                    {uploadedImages.length === 0 && (
                      <label className="flex items-center justify-center w-full h-28 border-2 border-dashed border-purple-300 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors group">
                        <div className="text-center">
                          <ImageIcon className="w-8 h-8 text-purple-400 mx-auto mb-1 group-hover:text-purple-600 transition-colors" />
                          <p className="text-sm text-purple-600 font-medium">点击上传笔记截图</p>
                          <p className="text-xs text-slate-400 mt-0.5">支持 JPG/PNG/WebP，最多9张，每张≤5MB</p>
                        </div>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">笔记正文 *</label>
                  <Textarea
                    placeholder={"粘贴小红书笔记的正文内容...\n\n支持带emoji、数字编号、分点的格式\n\n示例：\n1️⃣别把重疾险当医药费报销\n最大的误区就在这。\n很多人以为: 得了重疾→保险赔钱→拿钱去治病\n错了！\n重疾险赔的钱，从来不是医疗费，而是收入损失。"}
                    value={articleText}
                    onChange={(e) => setArticleText(e.target.value)}
                    rows={12}
                    className="font-mono text-sm border-rose-200 focus:border-rose-400"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    当前字数: {articleText.replace(/\s/g, '').length} 字
                    {articleText.length > 0 && articleText.length < 30 && (
                      <span className="text-amber-600 ml-2">（至少需要 30 个字符）</span>
                    )}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">话题标签（逗号分隔）</label>
                  <Input
                    placeholder="例如：保险,重疾险,避坑指南"
                    value={xhsTags}
                    onChange={(e) => setXhsTags(e.target.value)}
                    className="border-rose-200 focus:border-rose-400"
                  />
                </div>

                {/* 图片数量模式选择器（NEW!） */}
                <div>
                  <label className="text-sm font-medium mb-2 block">图片数量模式</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: '3-card' as const, label: '3张极简', desc: '封面+1要点+结尾', icon: '⚡', detail: '每张图仅标题，快速扫读' },
                      { value: '5-card' as const, label: '5张标准', desc: '封面+3要点+结尾', icon: '📋', detail: '标题+1行内容，信息适中' },
                      { value: '7-card' as const, label: '7张详细', desc: '封面+5要点+结尾', icon: '📖', detail: '完整内容展开，深度阅读' },
                    ]).map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => setXhsImageMode(mode.value)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          xhsImageMode === mode.value
                            ? 'border-rose-500 bg-rose-50 shadow-sm'
                            : 'border-rose-100 bg-white hover:border-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">{mode.icon}</span>
                          <span className="font-semibold text-sm">{mode.label}</span>
                        </div>
                        <p className="text-xs text-slate-600">{mode.desc}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{mode.detail}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
                    💡 选择「3张极简」时，图片只放核心结论，详细论证放在文字区
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzing || articleText.trim().length < 30}
                    className="ml-auto bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-md shadow-rose-200 transition-all duration-300"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        正在分析图文风格...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        分析小红书风格
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* ========== 公众号/其他平台输入区 ========== */
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">文章标题（可选）</label>
                    <Input
                      placeholder="例如：存款，是放在银行大额存单还是保险的增额寿"
                      value={articleTitle}
                      onChange={(e) => setArticleTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">目标字数（可选）</label>
                    <Input
                      type="number"
                      placeholder="1750"
                      value={targetWordCount}
                      onChange={(e) => setTargetWordCount(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">文章内容 *</label>
                  <Textarea
                    placeholder="在此粘贴你的文章内容...&#10;&#10;支持纯文本、Markdown 或 HTML 格式"
                    value={articleText}
                    onChange={(e) => setArticleText(e.target.value)}
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    当前字数: {articleText.replace(/\s/g, '').length} 字
                    {articleText.length > 0 && articleText.length < 50 && (
                      <span className="text-amber-600 ml-2">（至少需要 50 个字符）</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label className="cursor-pointer">
                    <Input type="file" accept=".txt,.md,.html" className="hidden" onChange={handleFileUpload} />
                    <Button variant="outline" asChild>
                      <span><Upload className="w-4 h-4 mr-2" />选择文件上传</span>
                    </Button>
                  </label>

                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzing || articleText.trim().length < 50}
                    className="ml-auto bg-gradient-to-r from-sky-500 to-cyan-600 hover:from-sky-600 hover:to-cyan-700 text-white shadow-md shadow-sky-200 transition-all duration-300"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        正在分析中...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        开始 6 维度分析
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* 分析结果 */}
        {/* 🔥 公众号6维度分析结果 */}
        {analysisResult && !xhsAnalysisResult && (
          <div className="space-y-4">
            {/* 结果概览 - 统一天蓝色系风格 */}
            <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-sky-50 shadow-lg shadow-emerald-50/30">
              <CardContent className="py-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-semibold text-emerald-800 text-lg">分析完成</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <span className="text-slate-600 bg-white px-3 py-1 rounded-full shadow-sm">
                      已提取维度: {DIMENSION_CONFIG.filter(d => analysisResult[d.key as keyof SixDimensionAnalysis]).length}/5
                    </span>
                    <Badge className="bg-gradient-to-r from-sky-500 to-cyan-600 text-white border-0 shadow-sm">
                      入库规则: {savedRules} 条
                    </Badge>
                    {/* 🔥 风格相似度展示 */}
                    {styleSimilarity && !styleSimilarity.skipped && (
                      <Badge 
                        className={`${
                          styleSimilarity.similarity >= 0.7 
                            ? 'bg-gradient-to-r from-emerald-500 to-green-600' 
                            : styleSimilarity.similarity >= 0.5 
                              ? 'bg-gradient-to-r from-amber-500 to-orange-600' 
                              : 'bg-gradient-to-r from-red-500 to-rose-600'
                        } text-white border-0 shadow-sm cursor-help`}
                        title={`维度相似度: ${((styleSimilarity.details?.dimensionScore || 0) * 100).toFixed(0)}% | 词汇相似度: ${((styleSimilarity.details?.vocabularyScore || 0) * 100).toFixed(0)}% | 语气相似度: ${((styleSimilarity.details?.toneScore || 0) * 100).toFixed(0)}%`}
                      >
                        风格相似度: {(styleSimilarity.similarity * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </div>
                {/* 🔥 风格相似度警告提示 */}
                {styleSimilarity?.warning && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-amber-800">风格警告</p>
                      <p className="text-sm text-amber-700 mt-1">{styleSimilarity.warning}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 各维度卡片 */}
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">总览</TabsTrigger>
                {DIMENSION_CONFIG.map(d => (
                  <TabsTrigger key={d.key} value={d.key}>{d.label.slice(0, 4)}</TabsTrigger>
                ))}
              </TabsList>

              {/* 总览 Tab */}
              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DIMENSION_CONFIG.map((dim) => {
                    const Icon = dim.icon;
                    const data = analysisResult[dim.key as keyof SixDimensionAnalysis];
                    const hasData = data !== null;

                    return (
                      <Card key={dim.key} className={`${hasData ? dim.borderColor : 'border-slate-200'} ${hasData ? dim.bgColor : ''}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${hasData ? dim.color : 'text-slate-400'}`} />
                            {dim.label}
                            {hasData ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 ml-auto" />}
                          </CardTitle>
                          <CardDescription className="text-xs">{dim.description}</CardDescription>
                        </CardHeader>
                        {hasData && data && (
                          <CardContent className="pt-0">
                            <DimensionSummaryRenderer dimensionKey={dim.key} data={data} />
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* 各维度详情 Tab */}
              {DIMENSION_CONFIG.map((dim) => {
                const data = analysisResult[dim.key as keyof SixDimensionAnalysis];
                return (
                  <TabsContent key={dim.key} value={dim.key} className="mt-4">
                    <Card className={`${dim.borderColor} ${dim.bgColor}`}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <dim.icon className={`w-5 h-5 ${dim.color}`} />
                          {dim.label} — 详细结果
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {data ? (
                          <DimensionDetailRenderer dimensionKey={dim.key} data={data} />
                        ) : (
                          <p className="text-muted-foreground text-sm">该维度暂无数据</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        )}

        {/* 🔥 小红书图文风格分析结果 */}
        {xhsAnalysisResult && (
          <div className="space-y-4">
            {/* 概览卡片 */}
            <Card className="border-rose-200 bg-gradient-to-r from-rose-50 via-pink-50 to-orange-50 shadow-lg shadow-rose-50/30">
              <CardContent className="py-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-semibold text-rose-800 text-lg">小红书风格分析完成</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm flex-wrap">
                    <Badge className="bg-gradient-to-r from-rose-500 to-pink-600 text-white border-0 shadow-sm">
                      入库规则: {savedRules} 条
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 风格维度卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 标题套路 */}
              {xhsAnalysisResult.titlePattern && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      标题套路
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />
                    </CardTitle>
                    <CardDescription className="text-xs">标题风格和吸引力模式</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Badge variant="outline" className="mb-2">
                      {xhsAnalysisResult.titlePattern.type === 'suspense' ? '悬念揭秘式' :
                       xhsAnalysisResult.titlePattern.type === 'numbered' ? '数字清单式' :
                       xhsAnalysisResult.titlePattern.type === 'contrast' ? '反差对比式' :
                       xhsAnalysisResult.titlePattern.type === 'emotional' ? '情感共鸣式' :
                       xhsAnalysisResult.titlePattern.type === 'question' ? '疑问引导式' : '故事分享式'}
                    </Badge>
                    <p className="text-sm text-slate-700">{xhsAnalysisResult.titlePattern.pattern}</p>
                    {xhsAnalysisResult.titlePattern.examples?.length > 0 && (
                      <p className="text-xs text-slate-500 mt-2 truncate">
                        示例: {xhsAnalysisResult.titlePattern.examples[0]}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ★ 图文结构（NEW! 核心维度） */}
              {xhsAnalysisResult.imageStructure && (
                <Card className="border-indigo-200 bg-indigo-50/50 ring-2 ring-indigo-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">🖼️</span>
                      图文结构
                      <Badge variant="default" className="ml-auto bg-indigo-600 text-xs">核心维度</Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">图片与文字的分工规则 — 决定生成时内容如何分配到图片和文字区</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* 图片模式 + 文字密度 */}
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-sm py-1 px-3 border-indigo-300 text-indigo-700 bg-white">
                        {xhsAnalysisResult.imageStructure.imageCountMode === '3-card' ? '⚡ 3张极简' :
                         xhsAnalysisResult.imageStructure.imageCountMode === '5-card' ? '📋 5张标准' : '📖 7张详细'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        卡片密度: {
                          xhsAnalysisResult.imageStructure.cardTextDensity === 'minimal' ? '仅标题' :
                          xhsAnalysisResult.imageStructure.cardTextDensity === 'concise' ? '标题+1行' : '标题+详细'
                        }
                      </Badge>
                      <span className="text-[10px] text-slate-400 ml-auto">
                        置信度: {Math.round((xhsAnalysisResult.imageStructure.confidence || 0) * 100)}%
                      </span>
                    </div>

                    {/* 图文分工 */}
                    {xhsAnalysisResult.imageStructure.contentDistribution && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-indigo-700">图文分工原则：</p>
                        {xhsAnalysisResult.imageStructure.contentDistribution.imageOnlyPoints.length > 0 && (
                          <div className="bg-blue-50 rounded p-2">
                            <p className="text-[10px] font-semibold text-blue-600 mb-1">🖼️ 图片专属（核心结论/金句）</p>
                            <ul className="text-xs text-blue-800 space-y-0.5 list-disc pl-4">
                              {xhsAnalysisResult.imageStructure.contentDistribution.imageOnlyPoints.map((pt: string, i: number) => (
                                <li key={i}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {xhsAnalysisResult.imageStructure.contentDistribution.textOnlyDetails.length > 0 && (
                          <div className="bg-emerald-50 rounded p-2">
                            <p className="text-[10px] font-semibold text-emerald-600 mb-1">📝 文字专属（数据/案例/论证）</p>
                            <ul className="text-xs text-emerald-800 space-y-0.5 list-disc pl-4">
                              {xhsAnalysisResult.imageStructure.contentDistribution.textOnlyDetails.map((dt: string, i: number) => (
                                <li key={i}>{dt}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 卡片架构预览 */}
                    {xhsAnalysisResult.imageStructure.cardArchitecture?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-indigo-700 mb-1.5">卡片架构预览（{xhsAnalysisResult.imageStructure.cardArchitecture.length} 张图）：</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                          {xhsAnalysisResult.imageStructure.cardArchitecture.map((card: any, idx: number) => (
                            <div
                              key={idx}
                              className={`rounded-lg p-2 text-center ${
                                card.cardType === 'cover' ? 'bg-gradient-to-br from-rose-100 to-pink-100 border border-rose-200' :
                                card.cardType === 'key-point' ? 'bg-gradient-to-br from-sky-100 to-cyan-100 border border-sky-200' :
                                card.cardType === 'detail' ? 'bg-gradient-to-br from-violet-100 to-purple-100 border border-violet-200' :
                                'bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200'
                              }`}
                            >
                              <p className="text-[9px] font-bold text-slate-500 mb-0.5">
                                #{card.cardIndex} · {card.cardType}
                              </p>
                              <p className="text-[11px] font-medium text-slate-700 leading-tight line-clamp-2">
                                {card.headline}
                              </p>
                              <p className="text-[8px] text-slate-400 mt-0.5">{card.purpose}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 🔥 视觉风格（多模态图片分析结果） */}
              {xhsAnalysisResult.visualStyle && (
                <Card className="border-fuchsia-200 bg-fuchsia-50/50 ring-2 ring-fuchsia-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">🎨</span>
                      视觉风格
                      <Badge variant="default" className={`ml-auto text-xs ${
                        xhsAnalysisResult.visualStyle.source === 'multimodal'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0'
                          : 'bg-slate-500 text-white border-0'
                      }`}>
                        {xhsAnalysisResult.visualStyle.source === 'multimodal' ? '📸 图片分析' : '📝 文字推断'}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">配色方案 + 布局参数 + 装饰元素 — 直接影响生成卡片的视觉效果</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* 配色预览 */}
                    {xhsAnalysisResult.visualStyle.colorScheme && (() => {
                      const cs = xhsAnalysisResult.visualStyle.colorScheme;
                      return (
                        <div>
                          <p className="text-xs font-medium text-fuchsia-700 mb-1.5 flex items-center gap-1">
                            <Palette className="w-3 h-3" /> 配色方案
                            <span className="text-[10px] text-slate-400 ml-auto">
                              置信度: {Math.round((cs.confidence || 0) * 100)}%
                            </span>
                          </p>
                          <div className="flex items-center gap-2 mb-2">
                            {/* 渐变预览 */}
                            <div
                              className="h-10 rounded-lg shadow-sm flex items-center justify-center"
                              style={{
                                background: `linear-gradient(135deg, ${cs.primaryColor}, ${cs.secondaryColor})`,
                                width: '140px',
                              }}
                            >
                              <span className="text-xs font-bold" style={{ color: cs.textPrimaryColor }}>
                                渐变预览
                              </span>
                            </div>
                            {/* 单色块 */}
                            <div className="flex gap-1 flex-1">
                              {[
                                { label: '主色', color: cs.primaryColor },
                                { label: '辅色', color: cs.secondaryColor },
                                { label: '背景', color: cs.backgroundColor },
                                { label: '强调', color: cs.accentColor },
                                { label: '文字', color: cs.textPrimaryColor },
                              ].map((c, i) => (
                                <div key={i} className="flex-1 text-center">
                                  <div
                                    className="w-full h-8 rounded-md shadow-sm border border-slate-200"
                                    style={{ backgroundColor: c.color }}
                                  />
                                  <p className="text-[9px] text-slate-500 mt-0.5 truncate">{c.label}</p>
                                  <p className="text-[8px] font-mono text-slate-400 truncate">{c.color}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[10px] mr-1">
                            色调: {cs.tone === 'warm' ? '🔥 暖色' :
                                   cs.tone === 'cool' ? '❄️ 冷色' :
                                   cs.tone === 'vibrant' ? '🌈 多彩' : '⚪ 中性'}
                          </Badge>
                        </div>
                      );
                    })()}

                    {/* 布局参数 */}
                    {xhsAnalysisResult.visualStyle.layout && (() => {
                      const layout = xhsAnalysisResult.visualStyle!.layout;
                      return (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white/60 rounded p-2">
                            <p className="text-[9px] text-slate-400">顶部留白</p>
                            <p className="text-sm font-bold text-slate-700">{Math.round(layout.contentTopRatio * 100)}%</p>
                          </div>
                          <div className="bg-white/60 rounded p-2">
                            <p className="text-[9px] text-slate-400">左右留白</p>
                            <p className="text-sm font-bold text-slate-700">{Math.round(layout.contentSideRatio * 100)}%</p>
                          </div>
                          <div className="bg-white/60 rounded p-2">
                            <p className="text-[9px] text-slate-400">标题对齐</p>
                            <p className="text-sm font-bold text-slate-700 capitalize">{layout.titleAlignment}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 字体+装饰 */}
                    <div className="flex gap-4 text-xs">
                      {xhsAnalysisResult.visualStyle.font && (
                        <div className="flex-1 bg-white/50 rounded p-2">
                          <p className="text-[9px] text-slate-400 mb-1">字体风格</p>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              标题: {xhsAnalysisResult.visualStyle.font.titleSize}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              粗细: {xhsAnalysisResult.visualStyle.font.titleWeight}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              风格: {xhsAnalysisResult.visualStyle.font.style}
                            </Badge>
                          </div>
                        </div>
                      )}
                      {xhsAnalysisResult.visualStyle.decoration && (
                        <div className="flex-1 bg-white/50 rounded p-2">
                          <p className="text-[9px] text-slate-400 mb-1">装饰元素</p>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              圆角: {xhsAnalysisResult.visualStyle.decoration.borderRadius}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              阴影: {xhsAnalysisResult.visualStyle.decoration.hasShadow ? '有' : '无'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              风格: {xhsAnalysisResult.visualStyle.decoration.style}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 来源说明 */}
                    {xhsAnalysisResult.visualStyle.source === 'default' && (
                      <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        当前为默认配色（未上传图片）。上传笔记截图可自动提取精确配色方案。
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 🔥 内容模板预览（多模态分析结果） — 默认折叠 */}
              {xhsAnalysisResult.contentTemplate && (
                <Card className="border-amber-200 bg-amber-50/50 ring-2 ring-amber-100">
                  <CardHeader
                    className="pb-2 cursor-pointer select-none"
                    onClick={() => setContentTemplateExpanded(!contentTemplateExpanded)}
                  >
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">📝</span>
                      内容模板
                      <Badge variant="secondary" className="text-[10px]">
                        {xhsAnalysisResult.contentTemplate.structure?.cardCountMode?.replace('-card', '卡') || 'N卡'} · {
                          xhsAnalysisResult.contentTemplate.structure?.densityStyle === 'minimal' ? '极简' :
                          xhsAnalysisResult.contentTemplate.structure?.densityStyle === 'concise' ? '精简' :
                          xhsAnalysisResult.contentTemplate.structure?.densityStyle === 'detailed' ? '详尽' : '标准'
                        }
                      </Badge>
                      <Badge variant="default" className={`text-xs ${
                        xhsAnalysisResult.contentTemplate.source === 'multimodal'
                          ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-0'
                          : 'bg-slate-500 text-white border-0'
                      }`}>
                        {xhsAnalysisResult.contentTemplate.source === 'multimodal' ? '📸 图片提取' : '📝 默认模板'}
                      </Badge>
                      <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${contentTemplateExpanded ? 'rotate-180' : ''}`} />
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {xhsAnalysisResult.contentTemplate.promptInstruction || '图文分工模板 — 点击展开详情'}
                    </CardDescription>
                  </CardHeader>
                  {contentTemplateExpanded && (() => {
                    const ct = xhsAnalysisResult.contentTemplate!;
                    return (
                      <CardContent className="pt-0 space-y-3">
                        {/* 结构概览 */}
                        {ct.structure && (
                          <div>
                            <p className="text-xs font-medium text-amber-700 mb-1.5 flex items-center gap-1">
                              <Layout className="w-3 h-3" /> 结构概览
                            </p>
                            <p className="text-sm text-slate-600 bg-white/60 rounded px-3 py-2">{ct.structure.description}</p>
                          </div>
                        )}

                        {/* 各卡片内容示例 */}
                        {ct.cardExamples?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-amber-700 mb-1.5 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> 图片卡片内容（{ct.cardExamples.length}张）
                            </p>
                            <div className="space-y-1.5">
                              {ct.cardExamples.map((card, i) => (
                                <div key={i} className="flex items-start gap-2 bg-white/50 rounded px-2 py-1.5">
                                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                                    {card.cardType === 'cover' ? '封面' :
                                     card.cardType === 'ending' ? '结尾' :
                                     `要点${i}`}
                                  </Badge>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs text-slate-700 truncate">{card.imageText || '(未识别文字)'}</p>
                                    <p className="text-[9px] text-slate-400">{card.styleDescription}</p>
                                  </div>
                                  <Badge variant="secondary" className="text-[9px] shrink-0">
                                    {card.textLength === 'title_only' ? '仅标题' :
                                     card.textLength === 'short' ? '短内容' :
                                     card.textLength === 'detailed' ? '长内容' : '标准'}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 图文分工规则 */}
                        {ct.divisionRule && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-blue-50/80 rounded p-2">
                              <p className="text-[10px] text-blue-600 font-medium mb-1">🖼️ 图片放</p>
                              <div className="flex flex-wrap gap-1">
                                {ct.divisionRule.imageOnly.slice(0, 4).map((item, i) => (
                                  <Badge key={i} variant="outline" className="text-[9px]">{item}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="bg-green-50/80 rounded p-2">
                              <p className="text-[10px] text-green-600 font-medium mb-1">📝 正文放</p>
                              <div className="flex flex-wrap gap-1">
                                {ct.divisionRule.textOnly.slice(0, 4).map((item, i) => (
                                  <Badge key={i} variant="outline" className="text-[9px]">{item}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 精简指令展示 */}
                        {ct.promptInstruction && (
                          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded p-2 border border-amber-200/50">
                            <p className="text-[10px] text-amber-600 font-medium mb-1">⚡ 精简指令（注入insurance-d Prompt）</p>
                            <p className="text-xs text-slate-700 font-medium">{ct.promptInstruction}</p>
                          </div>
                        )}
                      </CardContent>
                    );
                  })()}
                </Card>
              )}

              {/* Emoji 使用 */}
              {xhsAnalysisResult.emojiUsage && (
                <Card className="border-pink-200 bg-pink-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">😊</span>
                      Emoji 使用
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />
                    </CardTitle>
                    <CardDescription className="text-xs">emoji密度和使用习惯</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">
                        密度: {xhsAnalysisResult.emojiUsage.density === 'high' ? '高密度' :
                               xhsAnalysisResult.emojiUsage.density === 'medium' ? '中密度' : '低密度'}
                      </Badge>
                    </div>
                    {xhsAnalysisResult.emojiUsage.commonEmojis?.length > 0 && (
                      <p className="text-lg mb-1">{xhsAnalysisResult.emojiUsage.commonEmojis.slice(0, 8).join('')}</p>
                    )}
                    <p className="text-xs text-slate-500">{xhsAnalysisResult.emojiUsage.positionPattern}</p>
                  </CardContent>
                </Card>
              )}

              {/* 图文排版 */}
              {xhsAnalysisResult.visualLayout && (
                <Card className="border-sky-200 bg-sky-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">📐</span>
                      图文排版
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />
                    </CardTitle>
                    <CardDescription className="text-xs">段落结构和排版习惯</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Badge variant="outline">
                        {xhsAnalysisResult.visualLayout.paragraphStyle === 'short' ? '短段落' :
                         xhsAnalysisResult.visualLayout.paragraphStyle === 'medium' ? '中段落' : '长段落'}
                      </Badge>
                      <Badge variant="outline">
                        {xhsAnalysisResult.visualLayout.bulletPointStyle === 'numbered' ? '数字编号' :
                         xhsAnalysisResult.visualLayout.bulletPointStyle === 'emoji' ? 'Emoji编号' :
                         xhsAnalysisResult.visualLayout.bulletPointStyle === 'dotted' ? '圆点分列' : '无编号'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-700">
                      平均段落 {xhsAnalysisResult.visualLayout.avgParagraphLength} 字 · 
                      {xhsAnalysisResult.visualLayout.pointCount} 个要点 ·
                      换行{xhsAnalysisResult.visualLayout.lineBreakFrequency === 'high' ? '频繁' :
                           xhsAnalysisResult.visualLayout.lineBreakFrequency === 'medium' ? '适中' : '较少'}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 语气基调 */}
              {xhsAnalysisResult.tone && (
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">🗣️</span>
                      语气基调
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />
                    </CardTitle>
                    <CardDescription className="text-xs">整体语气和表达风格</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Badge variant="outline" className="mb-2">
                      {xhsAnalysisResult.tone.primary === 'empathetic' ? '亲切共情' :
                       xhsAnalysisResult.tone.primary === 'professional' ? '专业理性' :
                       xhsAnalysisResult.tone.primary === 'warning' ? '警示提醒' :
                       xhsAnalysisResult.tone.primary === 'warm' ? '温暖走心' : '随性聊天'}
                    </Badge>
                    <p className="text-sm text-slate-700">{xhsAnalysisResult.tone.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* 高频词汇 */}
              {xhsAnalysisResult.vocabulary && (
                <Card className="border-violet-200 bg-violet-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">📝</span>
                      用词习惯
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />
                    </CardTitle>
                    <CardDescription className="text-xs">高频词和口头禅</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {xhsAnalysisResult.vocabulary.highFrequencyWords?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {xhsAnalysisResult.vocabulary.highFrequencyWords.slice(0, 6).map((w: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {w.word}({w.count})
                          </Badge>
                        ))}
                      </div>
                    )}
                    {xhsAnalysisResult.vocabulary.catchphrases?.length > 0 && (
                      <p className="text-xs text-slate-500">口头禅: {xhsAnalysisResult.vocabulary.catchphrases.join('、')}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 卡片风格 */}
              {xhsAnalysisResult.cardStyle && (
                <Card className="border-orange-200 bg-orange-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-lg">🎨</span>
                      卡片风格
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto" />
                    </CardTitle>
                    <CardDescription className="text-xs">图片卡片的视觉风格</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">
                        {xhsAnalysisResult.cardStyle.colorScheme === 'warm' ? '暖色系' :
                         xhsAnalysisResult.cardStyle.colorScheme === 'cool' ? '冷色系' :
                         xhsAnalysisResult.cardStyle.colorScheme === 'vibrant' ? '鲜艳色' : '中性色'}
                      </Badge>
                      <Badge variant="outline">
                        {xhsAnalysisResult.cardStyle.decorationStyle === 'minimal' ? '简约' :
                         xhsAnalysisResult.cardStyle.decorationStyle === 'elegant' ? '优雅' :
                         xhsAnalysisResult.cardStyle.decorationStyle === 'playful' ? '活泼' : '专业'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 🔥 内容模板操作按钮 */}
              {xhsAnalysisResult.contentTemplate && (
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={async () => {
                      // 如果尚未保存，先自动保存再跳转
                      if (!savedContentTemplateIdRef.current) {
                        await handleSaveContentTemplate();
                      }
                      // 使用 ref 获取最新保存的 ID（避免 setState 异步问题）
                      const templateId = savedContentTemplateIdRef.current;
                      if (templateId) {
                        router.push(`/full-home?tab=split&contentTemplateId=${templateId}`);
                      }
                    }}
                    disabled={savingContentTemplate}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-200 transition-all duration-300"
                  >
                    {savingContentTemplate ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Rocket className="w-4 h-4 mr-1.5" />
                    )}
                    {savedContentTemplateId ? '立即使用此模板' : '保存并使用此模板'}
                    <span className="text-[10px] opacity-80 ml-1">→ 任务拆解</span>
                  </Button>
                  <Button
                    onClick={handleSaveContentTemplate}
                    disabled={savingContentTemplate || !xhsAnalysisResult.contentTemplate}
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    {savingContentTemplate ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : savedContentTemplateId ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savedContentTemplateId ? '已保存' : '保存到模板库'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// 维度摘要渲染器（用于总览卡片）
// ═══════════════════════════════════════════════════

function DimensionSummaryRenderer({ dimensionKey, data }: { dimensionKey: string; data: any }) {
  switch (dimensionKey) {
    case 'overallTone':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span>消费者立场</span><span className="font-semibold">{data.consumerStance}/10</span></div>
          <div className="flex justify-between"><span>专业性</span><span>{data.professionalism}/10</span></div>
          <p className="text-muted-foreground mt-1 line-clamp-2">{data.overallTone}</p>
        </div>
      );

    case 'toneAndVoice':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span>「你」使用</span><span className="font-semibold">{data.pronounStats.niCount}次</span></div>
          <div className="flex justify-between"><span>口语化</span><span>{(data.colloquialismScore * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span>正式度</span><Badge variant="outline" className="text-xs px-1 py-0">{data.formalityLevel === 'informal' ? '口语' : data.formalityLevel === 'formal' ? '正式' : '中性'}</Badge></div>
        </div>
      );

    case 'expressionHabits':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span>高频词</span><span className="font-semibold">{data.highFrequencyWords.length}个</span></div>
          <div className="flex justify-between"><span>绝对化词</span><span className={data.absoluteWords.length > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>{data.absoluteWords.reduce((s: number, w: any) => s + w.count, 0)}次</span></div>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.customVocabulary.slice(0, 3).map((v: any) => (
              <Badge key={v.word} variant="outline" className="text-xs px-1 py-0">{v.word}</Badge>
            ))}
          </div>
        </div>
      );

    case 'contentDetails':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span>案例名</span><span className="font-semibold">{data.caseNames.join('、') || '无'}</span></div>
          <div className="flex justify-between"><span>官方数据源</span><span>{data.officialSources.length}个</span></div>
          <div className="flex justify-between"><span>合规声明</span><span className={data.hasComplianceStatement ? 'text-green-600' : 'text-red-600'}>{data.hasComplianceStatement ? '✅ 有' : '❌ 缺失'}</span></div>
        </div>
      );

    case 'formattingStyle':
      return (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span>总字数</span><span className="font-semibold">{data.totalWordCount}</span></div>
          <div className="flex justify-between"><span>平均段长</span><span>{data.avgParagraphLength}字</span></div>
          <div className="flex justify-between"><span>短段占比</span><span>{(data.shortParagraphRatio * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between"><span>合规</span><span className={data.compliance ? 'text-green-600' : 'text-amber-600'}>{data.compliance ? '✅' : '⚠️'}</span></div>
        </div>
      );

    default:
      return <p className="text-xs text-muted-foreground">{JSON.stringify(data).slice(0, 100)}</p>;
  }
}

// ═══════════════════════════════════════════════════
// 维度详情渲染器（用于详情 Tab）
// ═══════════════════════════════════════════════════

function DimensionDetailRenderer({ dimensionKey, data }: { dimensionKey: string; data: any }) {
  switch (dimensionKey) {
    case 'overallTone':
      return (
        <div className="space-y-4">
          {/* 雷达图式分数展示 */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: '消费者立场', value: data.consumerStance },
              { label: '产品中立', value: data.productNeutrality },
              { label: '专业性', value: data.professionalism },
              { label: '温度感', value: data.warmth },
              { label: '避坑导向', value: data.pitfallFocus },
            ].map(item => (
              <div key={item.label} className={`text-center rounded-lg p-3 ${item.value >= 7 ? 'bg-green-50' : item.value >= 5 ? 'bg-amber-50' : 'bg-red-50'}`}>
                <div className="text-2xl font-bold">{item.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
              </div>
            ))}
          </div>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-1">总体调性</h4>
            <p className="text-sm">{data.overallTone}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-1">详细说明</h4>
            <p className="text-sm text-muted-foreground">{data.summary}</p>
          </div>
        </div>
      );

    case 'toneAndVoice':
      return (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">代词使用统计</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '「你」', value: data.pronounStats.niCount, good: true },
                { label: '「咱们」', value: data.pronounStats.ninCount, good: true },
                { label: '「你们」', value: data.pronounStats.ninmenCount, good: true },
                { label: '「您/贵」', value: data.pronounStats.ninGuaiguiCount, good: false },
                { label: '「客户」', value: data.pronounStats.kehuCount, good: false },
                { label: '总计', value: data.pronounStats.totalPronouns, good: null },
              ].map(item => (
                <div key={item.label} className={`text-center rounded p-2 ${item.good === true ? 'bg-green-50' : item.good === false ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <div className="text-lg font-bold">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded p-3 bg-slate-50">
              <div className="text-xs text-muted-foreground">口语化程度</div>
              <div className="text-lg font-bold">{(data.colloquialismScore * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded p-3 bg-slate-50">
              <div className="text-xs text-muted-foreground">焦虑/夸大指数</div>
              <div className={`text-lg font-bold ${data.anxietyLevel > 0.3 ? 'text-red-600' : 'text-green-600'}`}>{(data.anxietyLevel * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded p-3 bg-slate-50">
              <div className="text-xs text-muted-foreground">正式度</div>
              <div className="text-lg font-bold capitalize">{data.formalityLevel === 'informal' ? '口语' : data.formalityLevel === 'formal' ? '正式' : '中性'}</div>
            </div>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">{data.summary}</p>
        </div>
      );

    case 'expressionHabits':
      return (
        <div className="space-y-4">
          {/* 高频词 TOP 10 */}
          {data.highFrequencyWords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">高频词汇 TOP{Math.min(data.highFrequencyWords.length, 10)}</h4>
              <div className="flex flex-wrap gap-2">
                {data.highFrequencyWords.slice(0, 10).map(w => (
                  <Badge key={w.word} variant="secondary" className="px-3 py-1">
                    {w.word} <span className="text-muted-foreground ml-1">×{w.count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 绝对化/禁用词 */}
          {data.absoluteWords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-red-700">绝对化表达（应避免）</h4>
              <div className="flex flex-wrap gap-2">
                {data.absoluteWords.map(w => (
                  <Badge key={w.word} variant="destructive" className="px-3 py-1">
                    {w.word} <span className="ml-1">×{w.count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 行业特色词 */}
          {data.customVocabulary.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">行业特色词汇</h4>
              <div className="space-y-2">
                {Object.entries(
                  data.customVocabulary.reduce((acc: Record<string, Array<any>>, v: any) => {
                    (acc[v.category] ||= []).push(v); return acc;
                  }, {})
                ).map(([cat, words]: [string, any[]]) => (
                  <div key={cat}>
                    <span className="text-xs text-muted-foreground">{cat}：</span>
                    {words.map((w: any) => (
                      <Badge key={w.word} variant="outline" className="mr-1 mb-1">{w.word}(×{w.count})</Badge>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />
          <p className="text-sm text-muted-foreground">{data.summary}</p>
        </div>
      );

    case 'contentDetails':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-lg p-3 ${data.caseNames.length > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
              <h4 className="text-xs text-muted-foreground mb-1">匿名案例名 ✅</h4>
              <div className="flex flex-wrap gap-1">
                {data.caseNames.length > 0 ? data.caseNames.map(n => (
                  <Badge key={n} variant="secondary">{n}</Badge>
                )) : <span className="text-sm text-muted-foreground">未检测到</span>}
              </div>
            </div>
            <div className={`rounded-lg p-3 ${data.officialSources.length > 0 ? 'bg-emerald-50' : 'bg-slate-50'}`}>
              <h4 className="text-xs text-muted-foreground mb-1">官方数据源 ✅</h4>
              <div className="flex flex-wrap gap-1">
                {data.officialSources.length > 0 ? data.officialSources.map(s => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                )) : <span className="text-sm text-muted-foreground">未检测到</span>}
              </div>
            </div>
          </div>

          <div className={`rounded-lg p-3 ${data.hasComplianceStatement ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <h4 className="text-xs text-muted-foreground mb-1">合规声明</h4>
            <p className={`text-sm font-medium ${data.hasComplianceStatement ? 'text-emerald-700' : 'text-red-700'}`}>
              {data.hasComplianceStatement ? '✅ 文末包含合规声明（风险提示/免责声明）' : '❌ 未检测到合规声明，建议在文末添加'}
            </p>
          </div>

          {(data.nonCompliantCaseNames.length > 0 || data.nonCompliantSources.length > 0) && (
            <div className="rounded-lg p-3 bg-red-50">
              <h4 className="text-xs text-red-700 font-medium mb-1">⚠️ 不合规内容</h4>
              {data.nonCompliantCaseNames.length > 0 && (
                <p className="text-sm text-red-600">非规范案例名: {data.nonCompliantCaseNames.join('、')}</p>
              )}
              {data.nonCompliantSources.length > 0 && (
                <p className="text-sm text-red-600">非官方数据源: {data.nonCompliantSources.join('、')}</p>
              )}
            </div>
          )}

          <Separator />
          <p className="text-sm text-muted-foreground">{data.summary}</p>
        </div>
      );

    case 'formattingStyle':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center rounded p-3 bg-slate-50">
              <div className="text-xs text-muted-foreground">总字数</div>
              <div className="text-xl font-bold">{data.totalWordCount}</div>
              {data.targetWordCount && <div className="text-xs text-muted-foreground">目标: {data.targetWordCount}</div>}
            </div>
            <div className="text-center rounded p-3 bg-slate-50">
              <div className="text-xs text-muted-foreground">平均段长</div>
              <div className="text-xl font-bold">{data.avgParagraphLength}<span className="text-xs font-normal">字</span></div>
            </div>
            <div className="text-center rounded p-3 bg-slate-50">
              <div className="text-xs text-muted-foreground">短段占比</div>
              <div className={`text-xl font-bold ${(data.shortParagraphRatio * 100) >= 30 ? 'text-green-600' : 'text-amber-600'}`}>{(data.shortParagraphRatio * 100).toFixed(0)}<span className="text-xs font-normal">%</span></div>
            </div>
            <div className="text-center rounded p-3 bg-slate-50">
              <div className="text-xs text-muted-foreground">小标题</div>
              <div className="text-xl font-bold">{data.headingCount}<span className="text-xs font-normal">个</span></div>
            </div>
          </div>

          <div className="rounded p-3 bg-slate-50">
            <h4 className="text-xs text-muted-foreground mb-1">排版规律</h4>
            <p className="text-sm">{data.headingPattern}</p>
          </div>

          <div className={`rounded p-3 ${data.compliance ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <h4 className="text-xs text-muted-foreground mb-1">目标合规</h4>
            <p className={`text-sm font-medium ${data.compliance ? 'text-emerald-700' : 'text-amber-700'}`}>
              {data.compliance
                ? `✅ 符合目标排版（${data.totalWordCount}字，偏差在±15%内）`
                : `⚠️ 偏离目标排版（当前${data.totalWordCount}字，目标${data.targetWordCount || '?'}字）`
              }
            </p>
          </div>

          <Separator />
          <p className="text-sm text-muted-foreground">{data.summary}</p>
        </div>
      );

    default:
      return <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
  }
}
