/**
 * 文章预览编辑组件
 * 
 * 支持4种平台：
 * - wechat_official: HTML 预览 + 富文本编辑
 * - xiaohongshu: 小红书图文卡片预览 + 字段编辑
 * - zhihu: 纯文本预览 + 文本编辑
 * - douyin/toutiao: 纯文本预览 + 文本编辑
 * 
 * 设计原则：
 * - 用户可预览文章初稿
 * - 用户可编辑标题和正文
 * - 用户可跳过修改直接确认
 * - 修改后内容存入当前节点 result_text（不修改前序写作任务）
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Eye, Pencil, CheckCircle2, SkipForward, Save, X, 
  AlertCircle, Loader2, FileText, Image, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

// ============ 类型定义 ============

export type PreviewPlatform = 'wechat_official' | 'xiaohongshu' | 'zhihu' | 'douyin' | 'weibo';

export interface ArticlePreviewEditorProps {
  /** 预览任务 ID */
  taskId: string;
  /** 平台类型 */
  platform: PreviewPlatform;
  /** 文章内容（由父组件传入，纯文本正文） */
  articleContent?: string;
  /** 文章标题（由父组件传入） */
  articleTitle?: string;
  /** 平台渲染数据（结构化，如小红书卡片数据） */
  platformRenderData?: Record<string, unknown> | null;
  /** 是否可编辑 */
  canEdit?: boolean;
  /** 是否可跳过 */
  canSkip?: boolean;
  /** 确认回调（修改或跳过后触发） */
  onComplete: (result: PreviewCompleteResult) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

export interface PreviewCompleteResult {
  /** 用户操作类型 */
  action: 'skip' | 'save';
  /** 修改后的文章内容 */
  modifiedContent: string;
  /** 修改后的文章标题 */
  modifiedTitle: string;
  /** 是否发生了修改 */
  wasModified: boolean;
}

// ============ 平台标签映射 ============

const PLATFORM_LABELS: Record<PreviewPlatform, string> = {
  wechat_official: '微信公众号',
  xiaohongshu: '小红书',
  zhihu: '知乎',
  douyin: '抖音/头条',
  weibo: '微博',
};

const PLATFORM_COLORS: Record<PreviewPlatform, string> = {
  wechat_official: 'bg-green-100 text-green-800',
  xiaohongshu: 'bg-red-100 text-red-800',
  zhihu: 'bg-blue-100 text-blue-800',
  douyin: 'bg-orange-100 text-orange-800',
  weibo: 'bg-amber-100 text-amber-800',
};

// ============ 主组件 ============

export function ArticlePreviewEditor({
  taskId,
  platform,
  articleContent: initialContent,
  articleTitle: initialTitle,
  platformRenderData: initialPlatformRenderData,
  canEdit = true,
  canSkip = true,
  onComplete,
  onCancel,
}: ArticlePreviewEditorProps) {
  const [content, setContent] = useState(initialContent || '');
  const [title, setTitle] = useState(initialTitle || '');
  const [platformRenderData, setPlatformRenderData] = useState<Record<string, unknown> | null>(
    initialPlatformRenderData || null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialContent);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');

  // 如果没有传入内容，从 API 加载
  // 🔴 P2-2 修复：增加 AbortController 处理竞态条件
  useEffect(() => {
    console.log('[ArticlePreviewEditor] useEffect 触发:', {
      taskId,
      initialContent: initialContent?.substring(0, 100),
      initialContentLength: initialContent?.length || 0,
      initialPlatformRenderData: initialPlatformRenderData ? 'exists' : 'null',
    });
    
    if (initialContent) {
      setIsLoading(false);
      console.log('[ArticlePreviewEditor] 已有内容，跳过 API 调用');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const fetchContent = async () => {
      console.log('[ArticlePreviewEditor] 开始调用 API...');
      try {
        const res = await fetch(`/api/agents/preview-article?taskId=${taskId}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        
        console.log('[ArticlePreviewEditor] API 响应:', {
          success: data.success,
          hasArticleContent: !!data.data?.articleContent,
          hasPlatformRenderData: !!data.data?.platformRenderData,
          platform: data.data?.platform,
          platformRenderDataKeys: data.data?.platformRenderData ? Object.keys(data.data.platformRenderData) : [],
          cardsCount: data.data?.platformRenderData?.cards?.length || 0,
        });
        
        if (!cancelled && data.success) {
          setContent(data.data.articleContent || '');
          setTitle(data.data.articleTitle || '');
          // 🔥🔥🔥 【架构改造】从 API 响应获取平台渲染数据
          setPlatformRenderData(data.data.platformRenderData || null);
        } else if (!cancelled && !data.success) {
          toast.error('加载文章内容失败: ' + (data.error || '未知错误'));
        }
      } catch (err) {
        // AbortError 是正常取消，不需要报错
        if (!cancelled && err instanceof Error && err.name !== 'AbortError') {
          console.error('[ArticlePreviewEditor] 加载失败:', err);
          toast.error('加载文章内容失败');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchContent();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [taskId, initialContent]);

  // 处理跳过
  const handleSkip = useCallback(async () => {
    setIsSubmitting(true);
    try {
      onComplete({
        action: 'skip',
        modifiedContent: content,
        modifiedTitle: title,
        wasModified: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [content, title, onComplete]);

  // 处理保存修改
  const handleSave = useCallback(async () => {
    setIsSubmitting(true);
    try {
      onComplete({
        action: 'save',
        modifiedContent: content,
        modifiedTitle: title,
        wasModified: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [content, title, onComplete]);

  // 加载中
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground">加载文章内容中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部：平台标签 + 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={PLATFORM_COLORS[platform]}>
            {PLATFORM_LABELS[platform]}
          </Badge>
          <span className="text-sm text-muted-foreground">文章预览</span>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(true);
                setActiveTab('edit');
              }}
            >
              <Pencil className="h-4 w-4 mr-1" />
              修改文章
            </Button>
          )}
          {isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEditing(false);
                setActiveTab('preview');
              }}
            >
              <X className="h-4 w-4 mr-1" />
              取消编辑
            </Button>
          )}
        </div>
      </div>

      {/* 标题编辑 */}
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-1 block">
          文章标题
        </label>
        {isEditing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入文章标题"
            className="text-base"
          />
        ) : (
          <p className="text-base font-medium">{title || '无标题'}</p>
        )}
      </div>

      {/* 正文：预览/编辑 切换 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'edit')}>
        <TabsList className="mb-2">
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-1" />
            预览
          </TabsTrigger>
          {isEditing && (
            <TabsTrigger value="edit">
              <Pencil className="h-4 w-4 mr-1" />
              编辑
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="preview" className="mt-0">
          {platform === 'wechat_official' ? (
            <WechatHtmlPreview html={content} />
          ) : platform === 'xiaohongshu' ? (
            <XiaohongshuContentPreview 
              content={content} 
              platformRenderData={platformRenderData}
            />
          ) : (
            <PlainTextPreview content={content} />
          )}
        </TabsContent>

        {isEditing && (
          <TabsContent value="edit" className="mt-0">
            {platform === 'xiaohongshu' ? (
              <XiaohongshuContentEditor 
                content={content} 
                platformRenderData={platformRenderData}
                onChange={setContent} 
              />
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="编辑文章内容..."
              />
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {content.length > 0 && (
            <span>共 {content.length} 字</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canSkip && !isEditing && (
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isSubmitting}
            >
              <SkipForward className="h-4 w-4 mr-1" />
              无需修改，继续
            </Button>
          )}
          {isEditing && (
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              保存修改
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ 微信 HTML 预览组件 ============

function WechatHtmlPreview({ html }: { html: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
          <FileText className="h-4 w-4" />
          微信公众号文章预览
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="prose prose-sm max-w-none overflow-auto max-h-[500px] p-4 bg-white rounded border"
          dangerouslySetInnerHTML={{ __html: html || '<p class="text-muted-foreground">暂无内容</p>' }}
        />
      </CardContent>
    </Card>
  );
}

// ============ 小红书渲染数据解析（platformRenderData 格式） ============

/**
 * 从 platformRenderData（后端提取器生成的结构化数据）解析为前端展示格式
 * 
 * platformRenderData 格式（来自 extractors.ts）：
 * {
 *   platform: 'xiaohongshu',
 *   cardCountMode: '5-card',
 *   cards: [{ type: 'cover', title, subtitle }, { type: 'point', title, content }, { type: 'ending', conclusion, tags }],
 *   textContent: '正文',
 *   articleTitle: '标题'
 * }
 */
function parseXhsRenderData(
  renderData: Record<string, unknown>,
  fallbackText: string
): XhsParsedContent {
  const result: XhsParsedContent = { title: '', points: [], tags: [], fullText: '' };

  // 从 cards 数组提取结构化数据
  const cards = renderData.cards;
  if (Array.isArray(cards)) {
    for (const card of cards) {
      if (typeof card !== 'object' || card === null) continue;
      const c = card as Record<string, unknown>;
      
      if (c.type === 'cover') {
        result.title = typeof c.title === 'string' ? c.title : '';
        result.intro = typeof c.subtitle === 'string' ? c.subtitle : undefined;
      } else if (c.type === 'point') {
        result.points.push({
          title: typeof c.title === 'string' ? c.title : '',
          content: typeof c.content === 'string' ? c.content : '',
        });
      } else if (c.type === 'ending') {
        result.conclusion = typeof c.conclusion === 'string' ? c.conclusion : undefined;
        if (Array.isArray(c.tags)) {
          result.tags = c.tags.filter((t: unknown) => typeof t === 'string') as string[];
        }
      }
    }
  } else {
    // 🔥 兜底：platformRenderData 可能是 platformData 格式（旧路径传下来的）
    if (renderData.platform === 'xiaohongshu') {
      result.title = typeof renderData.title === 'string' ? renderData.title : '';
      result.intro = typeof renderData.intro === 'string' ? renderData.intro : undefined;
      if (Array.isArray(renderData.points)) {
        result.points = renderData.points
          .filter((p: unknown) => typeof p === 'object' && p !== null && typeof (p as Record<string, unknown>).title === 'string')
          .map((p: unknown) => ({
            title: (p as Record<string, unknown>).title as string,
            content: typeof (p as Record<string, unknown>).content === 'string' ? (p as Record<string, unknown>).content as string : '',
          }));
      }
      result.conclusion = typeof renderData.conclusion === 'string' ? renderData.conclusion : undefined;
      if (Array.isArray(renderData.tags)) {
        result.tags = renderData.tags.filter((t: unknown) => typeof t === 'string') as string[];
      }
    }
  }

  // 正文：优先从 platformRenderData.textContent，兜底用 fallbackText
  result.fullText = typeof renderData.textContent === 'string' && renderData.textContent.length > 0
    ? renderData.textContent
    : fallbackText;
  
  // 标题
  result.articleTitle = typeof renderData.articleTitle === 'string' ? renderData.articleTitle : '';

  return result;
}

// ============ 小红书内容预览组件 ============

interface XhsParsedContent {
  articleTitle?: string;  // 文章核心标题（15字以内）
  title: string;          // 封面标题（20字以内）
  intro?: string;         // 副标题/引言（30字以内）
  points: Array<{ title: string; content: string }>;
  conclusion?: string;    // 总结语（50字以内）
  tags: string[];
  fullText: string;       // 完整正文
}

function parseXhsContent(raw: string): XhsParsedContent {
  const defaultResult: XhsParsedContent = { title: '', points: [], tags: [], fullText: '' };

  if (!raw) return defaultResult;

  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    
    // 信封格式: { isCompleted, result: { content, articleTitle, platformData: {...} } }
    if (data?.result?.platformData) {
      const pd = data.result.platformData;
      return {
        articleTitle: data.result.articleTitle || '',
        title: pd.title || '',
        intro: pd.intro || '',
        points: pd.points || [],
        conclusion: pd.conclusion || '',
        tags: pd.tags || [],
        fullText: data.result.content || pd.fullText || '',
      };
    }

    // 旧格式: { result: { content, title, points, ... } }
    if (data?.result?.content) {
      return {
        articleTitle: data.articleTitle || data.result.articleTitle || '',
        title: data.result.title || '',
        intro: data.result.intro || '',
        points: data.result.points || [],
        conclusion: data.result.conclusion || '',
        tags: data.result.tags || [],
        fullText: data.result.content,
      };
    }

    // 直接格式: { title, points, fullText, ... }
    if (data?.title || data?.fullText) {
      return {
        articleTitle: data.articleTitle || '',
        title: data.title || '',
        intro: data.intro || '',
        points: data.points || [],
        conclusion: data.conclusion || '',
        tags: data.tags || [],
        fullText: data.fullText || data.content || '',
      };
    }

    // 纯文本
    return { ...defaultResult, fullText: typeof raw === 'string' ? raw : JSON.stringify(raw) };
  } catch {
    return { ...defaultResult, fullText: raw };
  }
}

// 渐变色方案（与小红书卡片生成器一致）
const GRADIENT_SCHEMES = [
  { from: '#FF6B6B', to: '#FFA07A' },  // 粉橙
  { from: '#667eea', to: '#764ba2' },  // 蓝紫
  { from: '#2dd4bf', to: '#34d399' },  // 青绿
  { from: '#1e3a5f', to: '#4a90d9' },  // 深蓝
  { from: '#f472b6', to: '#fb923c' },  // 珊瑚粉
];

function XiaohongshuContentPreview({ 
  content: rawContent, 
  platformRenderData 
}: { 
  content: string; 
  platformRenderData?: Record<string, unknown> | null;
}) {
  // 🔥 翻页状态
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // 🔥🔥🔥 【架构改造】优先使用 platformRenderData（结构化卡片数据）
  const parsed = platformRenderData 
    ? parseXhsRenderData(platformRenderData, rawContent)
    : parseXhsContent(rawContent);
  
  // 计算卡片数量
  const hasCover = !!(parsed.title || parsed.intro);
  const hasEnding = !!(parsed.conclusion || parsed.tags.length > 0);
  const totalCards = (hasCover ? 1 : 0) + parsed.points.length + (hasEnding ? 1 : 0);
  
  // 🔥 翻页功能
  const goToNextPage = useCallback(() => {
    if (currentPage < totalCards - 1) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalCards]);
  
  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);
  
  // 触摸滑动处理
  const minSwipeDistance = 50;
  
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNextPage();
    } else if (isRightSwipe) {
      goToPrevPage();
    }
  };
  
  // 构建卡片数组（用于翻页渲染）
  const cards: Array<{ type: 'cover' | 'point' | 'ending'; title: string; content?: string; tags?: string[]; idx?: number }> = [];
  
  if (hasCover) {
    cards.push({ type: 'cover', title: parsed.title, content: parsed.intro });
  }
  parsed.points.forEach((point, idx) => {
    cards.push({ type: 'point', title: point.title, content: point.content, idx: idx + 1 });
  });
  if (hasEnding) {
    cards.push({ type: 'ending', title: parsed.conclusion || '', tags: parsed.tags });
  }

  return (
    <div className="flex justify-center">
      {/* 手机模拟器容器 */}
      <div className="w-[375px] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* 手机顶部刘海 */}
        <div className="bg-gray-100 px-4 py-2 flex items-center justify-center">
          <div className="w-20 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* 🔥 翻页卡片区域 */}
        {totalCards > 0 ? (
          <div 
            className="relative"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* 卡片容器 */}
            <div className="overflow-hidden rounded-xl mx-4 my-3">
              <div
                className="transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${currentPage * 100}%)` }}
              >
                <div className="flex" style={{ width: `${totalCards * 100}%` }}>
                  {cards.map((card, idx) => {
                    const scheme = GRADIENT_SCHEMES[idx % GRADIENT_SCHEMES.length];
                    return (
                      <div key={idx} style={{ width: `${100 / totalCards}%` }} className="flex-shrink-0 px-1">
                        <div
                          className="rounded-xl p-5 text-white min-h-[280px] flex flex-col justify-center"
                          style={{
                            background: card.type === 'ending' 
                              ? 'linear-gradient(135deg, #374151, #111827)'
                              : `linear-gradient(135deg, ${scheme.from}, ${scheme.to})`,
                          }}
                        >
                          {/* 卡片类型标签 */}
                          <div className="text-xs opacity-80 mb-2">
                            {card.type === 'cover' && '📕 封面'}
                            {card.type === 'point' && `📌 要点 ${card.idx}`}
                            {card.type === 'ending' && '✨ 结语'}
                          </div>
                          
                          {/* 标题 */}
                          <div className="text-lg font-bold leading-tight">{card.title}</div>
                          
                          {/* 内容 */}
                          {card.content && (
                            <div className="text-sm opacity-90 mt-3 leading-relaxed">{card.content}</div>
                          )}
                          
                          {/* 标签（仅结尾卡） */}
                          {card.type === 'ending' && card.tags && card.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {card.tags.map((tag, tIdx) => (
                                <span key={tIdx} className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* 左右翻页按钮 */}
            {totalCards > 1 && (
              <>
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 0}
                  className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center transition-all ${
                    currentPage === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white hover:scale-110'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalCards - 1}
                  className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center transition-all ${
                    currentPage === totalCards - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white hover:scale-110'
                  }`}
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </>
            )}
            
            {/* 页码指示器 */}
            {totalCards > 1 && (
              <div className="flex items-center justify-center gap-2 py-2">
                {cards.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentPage ? 'bg-red-500 w-4' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            )}
            
            {/* 页码文字 */}
            <div className="text-center text-xs text-gray-400 pb-2">
              {currentPage + 1} / {totalCards}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            暂无内容
          </div>
        )}

        {/* 完整正文（折叠展示） */}
        {parsed.fullText && (
          <div className="px-4 pb-3">
            <details className="border-t border-gray-100 pt-3">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                📝 查看完整正文 ({parsed.fullText.length}字)
              </summary>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mt-2 pl-2 border-l-2 border-gray-200 max-h-[200px] overflow-y-auto">
                {parsed.fullText}
              </div>
            </details>
          </div>
        )}

        {/* 手机底部操作栏 */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
          <div className="flex items-center justify-around text-gray-400 text-xs">
            <span>❤️ 点赞</span>
            <span>💬 评论</span>
            <span>⭐ 收藏</span>
            <span>↗️ 分享</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 小红书内容编辑组件 ============

function XiaohongshuContentEditor({ 
  content: rawContent, 
  platformRenderData,
  onChange 
}: { 
  content: string; 
  platformRenderData?: Record<string, unknown> | null;
  onChange: (v: string) => void; 
}) {
  // 🔥🔥🔥 【架构改造】优先使用 platformRenderData
  const parsed = platformRenderData 
    ? parseXhsRenderData(platformRenderData, rawContent)
    : parseXhsContent(rawContent);
  const [title, setTitle] = useState(parsed.title);
  const [fullText, setFullText] = useState(parsed.fullText);
  const [points, setPoints] = useState(parsed.points);
  const [tags, setTags] = useState(parsed.tags.join(', '));

  const rebuildContent = useCallback(() => {
    const newContent = JSON.stringify({
      title,
      points,
      fullText,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    onChange(newContent);
  }, [title, points, fullText, tags, onChange]);

  useEffect(() => {
    rebuildContent();
  }, [rebuildContent]);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-muted-foreground block mb-1">标题</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground block mb-1">正文</label>
        <Textarea
          value={fullText}
          onChange={(e) => setFullText(e.target.value)}
          className="min-h-[200px]"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-muted-foreground block mb-1">
          标签（逗号分隔）
        </label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
    </div>
  );
}

// ============ 纯文本预览组件 ============

function PlainTextPreview({ content }: { content: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
          <FileText className="h-4 w-4" />
          文章内容预览
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none overflow-auto max-h-[500px] p-4 bg-white rounded border whitespace-pre-wrap">
          {content || '暂无内容'}
        </div>
      </CardContent>
    </Card>
  );
}
