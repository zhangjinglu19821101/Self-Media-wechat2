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
  Layers,
} from 'lucide-react';
import { apiGet, apiPost, apiFetch } from '@/lib/api/client';
import ExtractionPanel from '@/components/article-extraction/extraction-panel';
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
        {/* 全维度提取 */}
        <ExtractionPanel />
      </div>
    </div>
  );
}

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
          {/* 🔥 原文证据片段 */}
          {data.originalTextEvidence && data.originalTextEvidence.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-blue-600">📝</span> 原文依据（评分来源）
              </h4>
              <div className="space-y-2">
                {data.originalTextEvidence.map((evidence: string, idx: number) => (
                  <div key={idx} className="rounded bg-blue-50 border border-blue-200 p-2 text-sm text-blue-800 italic">
                    &ldquo;{evidence}&rdquo;
                  </div>
                ))}
              </div>
            </div>
          )}
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
          {/* 🔥 代词原文片段 */}
          {data.pronounExcerpts && data.pronounExcerpts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-blue-600">📝</span> 代词使用原文示例
              </h4>
              <div className="space-y-2">
                {data.pronounExcerpts.map((item: { pronoun: string; excerpt: string }, idx: number) => (
                  <div key={idx} className="rounded bg-blue-50 border border-blue-200 p-2 text-sm">
                    <span className="font-semibold text-blue-700">&ldquo;{item.pronoun}&rdquo;</span>
                    <span className="text-blue-800 ml-2">{item.excerpt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 🔥 口语化原文片段 */}
          {data.colloquialExcerpts && data.colloquialExcerpts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-blue-600">📝</span> 口语化表达原文示例
              </h4>
              <div className="space-y-2">
                {data.colloquialExcerpts.map((item: { marker: string; excerpt: string }, idx: number) => (
                  <div key={idx} className="rounded bg-amber-50 border border-amber-200 p-2 text-sm">
                    <span className="font-semibold text-amber-700">&ldquo;{item.marker}&rdquo;</span>
                    <span className="text-amber-800 ml-2">{item.excerpt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          {/* 🔥 高频词原文片段 */}
          {data.highFrequencyExcerpts && data.highFrequencyExcerpts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-blue-600">📝</span> 高频词原文示例
              </h4>
              <div className="space-y-2">
                {data.highFrequencyExcerpts.map((item: { word: string; excerpts: string[] }, idx: number) => (
                  <div key={idx} className="rounded bg-blue-50 border border-blue-200 p-2 text-sm">
                    <span className="font-semibold text-blue-700">&ldquo;{item.word}&rdquo;</span>
                    <div className="mt-1 space-y-1">
                      {item.excerpts.map((excerpt: string, eidx: number) => (
                        <p key={eidx} className="text-blue-800 italic pl-2 border-l-2 border-blue-300">&ldquo;{excerpt}&rdquo;</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 🔥 绝对化词原文片段 */}
          {data.absoluteExcerpts && data.absoluteExcerpts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-red-600">📝</span> 绝对化词原文示例
              </h4>
              <div className="space-y-2">
                {data.absoluteExcerpts.map((item: { word: string; excerpts: string[] }, idx: number) => (
                  <div key={idx} className="rounded bg-red-50 border border-red-200 p-2 text-sm">
                    <span className="font-semibold text-red-700">&ldquo;{item.word}&rdquo;</span>
                    <div className="mt-1 space-y-1">
                      {item.excerpts.map((excerpt: string, eidx: number) => (
                        <p key={eidx} className="text-red-800 italic pl-2 border-l-2 border-red-300">&ldquo;{excerpt}&rdquo;</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          {/* 🔥 案例名原文片段 */}
          {data.caseExcerpts && data.caseExcerpts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-blue-600">📝</span> 案例名原文出处
              </h4>
              <div className="space-y-2">
                {data.caseExcerpts.map((item: { caseName: string; excerpt: string }, idx: number) => (
                  <div key={idx} className="rounded bg-blue-50 border border-blue-200 p-2 text-sm">
                    <span className="font-semibold text-blue-700">&ldquo;{item.caseName}&rdquo;</span>
                    <p className="text-blue-800 italic mt-1 pl-2 border-l-2 border-blue-300">&ldquo;{item.excerpt}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 🔥 官方数据源原文片段 */}
          {data.sourceExcerpts && data.sourceExcerpts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-blue-600">📝</span> 官方数据源原文出处
              </h4>
              <div className="space-y-2">
                {data.sourceExcerpts.map((item: { source: string; excerpt: string }, idx: number) => (
                  <div key={idx} className="rounded bg-emerald-50 border border-emerald-200 p-2 text-sm">
                    <span className="font-semibold text-emerald-700">&ldquo;{item.source}&rdquo;</span>
                    <p className="text-emerald-800 italic mt-1 pl-2 border-l-2 border-emerald-300">&ldquo;{item.excerpt}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 🔥 合规声明原文 */}
          {data.complianceExcerpt && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-emerald-600">📝</span> 合规声明原文
              </h4>
              <div className="rounded bg-emerald-50 border border-emerald-200 p-2 text-sm text-emerald-800 italic">
                &ldquo;{data.complianceExcerpt}&rdquo;
              </div>
            </div>
          )}
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
          {/* 🔥 小标题原文 */}
          {data.headingExcerpts && data.headingExcerpts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-blue-600">📝</span> 检测到的小标题（原文）
              </h4>
              <div className="space-y-1">
                {data.headingExcerpts.map((heading: string, idx: number) => (
                  <div key={idx} className="rounded bg-blue-50 border border-blue-200 px-3 py-1.5 text-sm text-blue-800 font-medium">
                    {heading}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 🔥 典型段落原文样本 */}
          {(data.shortParagraphExcerpts?.length > 0 || data.longParagraphExcerpts?.length > 0) && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                <span className="text-blue-600">📝</span> 典型段落原文样本
              </h4>
              <div className="space-y-2">
                {data.shortParagraphExcerpts?.map((p: string, idx: number) => (
                  <div key={`short-${idx}`} className="rounded bg-amber-50 border border-amber-200 p-2 text-sm">
                    <span className="text-xs text-amber-600 font-medium">短段示例：</span>
                    <p className="text-amber-800 italic mt-0.5">&ldquo;{p}&rdquo;</p>
                  </div>
                ))}
                {data.longParagraphExcerpts?.map((p: string, idx: number) => (
                  <div key={`long-${idx}`} className="rounded bg-purple-50 border border-purple-200 p-2 text-sm">
                    <span className="text-xs text-purple-600 font-medium">长段示例：</span>
                    <p className="text-purple-800 italic mt-0.5">&ldquo;{p}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    default:
      return <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
  }
}
