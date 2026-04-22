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
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

// 🔥 小红书正文格式渲染器
import { XhsTextRenderer } from '@/components/xhs-text-renderer';

// ============ 共享解析模块 ============
import { 
  GRADIENT_SCHEMES, 
  parseXhsRenderData, 
  parseXhsContent,
  type XhsParsedContent 
} from '@/lib/xhs-parser';

// 🔥 微信公众号文章渲染器
import { WechatArticleRenderer } from '@/components/wechat-article-renderer';

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
          // 🔥🔥🔥 【修复公众号预览】公众号优先使用 platformRenderData.htmlContent
          const apiPlatform = data.data.platform as string;
          const apiPlatformRenderData = data.data.platformRenderData;
          
          let finalContent = data.data.articleContent || '';
          if (apiPlatform === 'wechat_official' && 
              apiPlatformRenderData && 
              typeof apiPlatformRenderData === 'object' && 
              'htmlContent' in apiPlatformRenderData) {
            finalContent = (apiPlatformRenderData as any).htmlContent || finalContent;
          }
          
          setContent(finalContent);
          setTitle(data.data.articleTitle || '');
          setPlatformRenderData(apiPlatformRenderData || null);
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
            // 🔥🔥🔥 【修复公众号预览】优先使用 platformRenderData.htmlContent
            <WechatHtmlPreview 
              html={
                (platformRenderData && typeof platformRenderData === 'object' && 'htmlContent' in platformRenderData)
                  ? (platformRenderData as any).htmlContent || content
                  : content
              } 
            />
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
    <div className="overflow-hidden">
      <WechatArticleRenderer 
        html={html} 
        collapsed={true}
        maxHeight={450}
      />
    </div>
  );
}

// ============ 小红书内容预览组件 ============

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
  const [isLiked, setIsLiked] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  const [isFullTextExpanded, setIsFullTextExpanded] = useState(false);
  
  // 解析数据
  const parsed = platformRenderData 
    ? parseXhsRenderData(platformRenderData, rawContent)
    : parseXhsContent(rawContent);
  
  // 计算卡片数量
  const hasCover = !!(parsed.title || parsed.intro);
  const hasEnding = !!(parsed.conclusion || parsed.tags.length > 0);
  const totalCards = (hasCover ? 1 : 0) + parsed.points.length + (hasEnding ? 1 : 0);
  
  // 翻页功能
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
  
  // 触摸滑动
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
    if (distance > 50) goToNextPage();
    else if (distance < -50) goToPrevPage();
  };
  
  // 构建卡片数组
  const cards: Array<{ type: 'cover' | 'point' | 'ending'; title: string; content?: string; tags?: string[]; idx?: number }> = [];
  if (hasCover) cards.push({ type: 'cover', title: parsed.title, content: parsed.intro });
  parsed.points.forEach((point, idx) => {
    cards.push({ type: 'point', title: point.title, content: point.content, idx: idx + 1 });
  });
  if (hasEnding) cards.push({ type: 'ending', title: parsed.conclusion || '', tags: parsed.tags });

  return (
    <div className="flex justify-center">
      {/* 🔥 小红书风格容器 */}
      <div className="w-[375px] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
        
        {/* 顶部状态栏 */}
        <div className="bg-white px-5 py-2 flex items-center justify-between text-xs text-gray-600">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>
        
        {/* 导航栏 */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <button className="text-gray-600 text-lg">←</button>
          <span className="font-semibold text-gray-800">笔记详情</span>
          <button className="text-gray-600 text-lg">⋯</button>
        </div>
        
        {/* 主内容区：图片+右侧操作栏 */}
        <div className="relative bg-black">
          
          {/* 🔥 图片卡片区域（竖版比例 3:4） */}
          {totalCards > 0 ? (
            <div 
              className="relative aspect-[3/4] overflow-hidden"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* 卡片滑动容器 */}
              <div
                className="flex h-full transition-transform duration-300 ease-out"
                style={{ 
                  // 🔥 修复：基于每张卡片在容器中的占比计算位移
                  // 每张卡片占容器的 (100/totalCards)%，所以翻页需要移动这个比例
                  transform: `translateX(-${currentPage * (100 / totalCards)}%)`,
                  width: `${totalCards * 100}%`
                }}
              >
                {cards.map((card, idx) => {
                  const scheme = GRADIENT_SCHEMES[idx % GRADIENT_SCHEMES.length];
                  return (
                    <div 
                      key={idx} 
                      className="flex-shrink-0 h-full flex items-center justify-center p-6"
                      style={{ width: `${100 / totalCards}%` }}
                    >
                      <div
                        className="w-full h-full rounded-2xl flex flex-col justify-center px-5 py-6 text-white shadow-lg"
                        style={{
                          background: card.type === 'ending' 
                            ? 'linear-gradient(135deg, #374151, #111827)'
                            : `linear-gradient(135deg, ${scheme.from}, ${scheme.to})`,
                        }}
                      >
                        {/* 卡片类型标签 */}
                        <div className="text-xs opacity-70 mb-3 font-medium">
                          {card.type === 'cover' && '📕 封面'}
                          {card.type === 'point' && `📌 要点 ${card.idx}`}
                          {card.type === 'ending' && '✨ 结语'}
                        </div>
                        
                        {/* 标题 */}
                        <div className="text-xl font-bold leading-tight mb-3">{card.title}</div>
                        
                        {/* 内容 */}
                        {card.content && (
                          <div className="text-sm opacity-90 leading-relaxed">{card.content}</div>
                        )}
                        
                        {/* 标签 */}
                        {card.type === 'ending' && card.tags && card.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {card.tags.map((tag, tIdx) => (
                              <span key={tIdx} className="text-xs bg-white/20 px-2.5 py-1 rounded-full">
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
              
              {/* 左右翻页按钮 */}
              {totalCards > 1 && (
                <>
                  <button
                    onClick={goToPrevPage}
                    disabled={currentPage === 0}
                    aria-label="上一页"
                    className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center transition-all ${
                      currentPage === 0 ? 'opacity-20' : 'hover:bg-black/60'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5 text-white" aria-hidden="true" />
                  </button>
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalCards - 1}
                    aria-label="下一页"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center transition-all ${
                      currentPage === totalCards - 1 ? 'opacity-20' : 'hover:bg-black/60'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5 text-white" aria-hidden="true" />
                  </button>
                </>
              )}
              
              {/* 页码指示器 */}
              {totalCards > 1 && (
                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
                  {cards.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx)}
                      className={`h-1 rounded-full transition-all ${
                        idx === currentPage ? 'bg-white w-4' : 'bg-white/50 w-1'
                      }`}
                    />
                  ))}
                </div>
              )}
              
              {/* 页码 */}
              {totalCards > 1 && (
                <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  {currentPage + 1}/{totalCards}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[3/4] flex items-center justify-center text-gray-400">
              暂无内容
            </div>
          )}
          
          {/* 🔥 右侧悬浮操作栏（小红书特色） */}
          <div className="absolute right-3 bottom-16 flex flex-col items-center gap-5">
            {/* 头像 */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                AI
              </div>
            </div>
            
            {/* 点赞 */}
            <button 
              onClick={() => setIsLiked(!isLiked)}
              className="flex flex-col items-center gap-1"
              aria-label={isLiked ? '取消点赞' : '点赞'}
            >
              <div className={`w-10 h-10 rounded-full ${isLiked ? 'bg-red-500' : 'bg-white/20'} flex items-center justify-center transition-colors`}>
                <span className="text-lg" aria-hidden="true">{isLiked ? '❤️' : '🤍'}</span>
              </div>
            </button>
            
            {/* 收藏 */}
            <button 
              onClick={() => setIsCollected(!isCollected)}
              className="flex flex-col items-center gap-1"
              aria-label={isCollected ? '取消收藏' : '收藏'}
            >
              <div className={`w-10 h-10 rounded-full ${isCollected ? 'bg-yellow-500' : 'bg-white/20'} flex items-center justify-center transition-colors`}>
                <span className="text-lg" aria-hidden="true">{isCollected ? '⭐' : '☆'}</span>
              </div>
            </button>
            
            {/* 评论 */}
            <button className="flex flex-col items-center gap-1" aria-label="评论">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-lg" aria-hidden="true">💬</span>
              </div>
            </button>
            
            {/* 分享 */}
            <button className="flex flex-col items-center gap-1" aria-label="分享">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-lg" aria-hidden="true">↗️</span>
              </div>
            </button>
          </div>
        </div>
        
        {/* 🔥 底部正文区 */}
        <div className="bg-white p-4">
          {/* 标题 */}
          <h2 className="text-base font-bold text-gray-900 mb-2 leading-snug">
            {parsed.title || '小红书笔记'}
          </h2>
          
          {/* 正文 - 使用小红书真实格式渲染器 */}
          {parsed.fullText && (
            <XhsTextRenderer
              content={parsed.fullText}
              collapsed={!isFullTextExpanded}
              maxLines={3}
              onToggleCollapse={() => setIsFullTextExpanded(!isFullTextExpanded)}
              className="mb-2"
            />
          )}
          
          {/* 标签 */}
          {parsed.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 mt-2">
              {parsed.tags.map((tag, idx) => (
                <span key={idx} className="text-xs text-blue-500 font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          
          {/* 发布信息 */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>IP属地：中国</span>
            <span>编辑于 {getCurrentBeijingTime().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
          </div>
        </div>
        
        {/* 底部评论入口 */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-400">
            说点什么...
          </div>
          <button className="text-gray-400 text-xl">😊</button>
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
