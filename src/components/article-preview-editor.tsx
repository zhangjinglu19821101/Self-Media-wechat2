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
  AlertCircle, Loader2, FileText, Image 
} from 'lucide-react';
import { toast } from 'sonner';

// ============ 类型定义 ============

export type PreviewPlatform = 'wechat_official' | 'xiaohongshu' | 'zhihu' | 'douyin' | 'weibo';

export interface ArticlePreviewEditorProps {
  /** 预览任务 ID */
  taskId: string;
  /** 平台类型 */
  platform: PreviewPlatform;
  /** 文章内容（由父组件传入） */
  articleContent?: string;
  /** 文章标题（由父组件传入） */
  articleTitle?: string;
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
  canEdit = true,
  canSkip = true,
  onComplete,
  onCancel,
}: ArticlePreviewEditorProps) {
  const [content, setContent] = useState(initialContent || '');
  const [title, setTitle] = useState(initialTitle || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialContent);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');

  // 如果没有传入内容，从 API 加载
  // 🔴 P2-2 修复：增加 AbortController 处理竞态条件
  useEffect(() => {
    if (initialContent) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const fetchContent = async () => {
      try {
        const res = await fetch(`/api/agents/preview-article?taskId=${taskId}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        
        if (!cancelled && data.success) {
          setContent(data.data.articleContent || '');
          setTitle(data.data.articleTitle || '');
        } else if (!cancelled && !data.success) {
          toast.error('加载文章内容失败: ' + (data.error || '未知错误'));
        }
      } catch (err) {
        // AbortError 是正常取消，不需要报错
        if (!cancelled && err instanceof Error && err.name !== 'AbortError') {
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
            <XiaohongshuContentPreview content={content} />
          ) : (
            <PlainTextPreview content={content} />
          )}
        </TabsContent>

        {isEditing && (
          <TabsContent value="edit" className="mt-0">
            {platform === 'xiaohongshu' ? (
              <XiaohongshuContentEditor content={content} onChange={setContent} />
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

function XiaohongshuContentPreview({ content: rawContent }: { content: string }) {
  const parsed = parseXhsContent(rawContent);
  
  // 🔥🔥🔥 【P1修复】严谨计算卡片数量
  // 封面卡：title 或 intro 有值时才存在
  // 要点卡：points 数组长度
  // 结尾卡：conclusion 或 tags 有值时才存在
  const hasCover = !!(parsed.title || parsed.intro);
  const hasEnding = !!(parsed.conclusion || parsed.tags.length > 0);
  const totalCards = (hasCover ? 1 : 0) + parsed.points.length + (hasEnding ? 1 : 0);

  return (
    <div className="flex justify-center">
      {/* 手机模拟器容器 */}
      <div className="w-[375px] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* 手机顶部刘海 */}
        <div className="bg-gray-100 px-4 py-2 flex items-center justify-center">
          <div className="w-20 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* 小红书风格内容区 */}
        <div className="px-4 py-3 space-y-3 max-h-[500px] overflow-y-auto">
          {/* 卡片数量指示 */}
          {totalCards > 0 && (
            <div className="text-xs text-gray-400 text-center mb-2">
              📱 {totalCards}卡模式预览
            </div>
          )}

          {/* 【第1卡】封面卡 - 仅在有内容时渲染 */}
          {hasCover && (
            <div className="bg-gradient-to-br from-red-500 to-pink-500 rounded-xl p-4 text-white shadow-lg">
              {parsed.title && (
                <h3 className="text-lg font-bold leading-tight mb-1">{parsed.title}</h3>
              )}
              {parsed.intro && (
                <p className="text-sm opacity-90">{parsed.intro}</p>
              )}
            </div>
          )}

          {/* 【第2-4卡】要点卡片 */}
          {parsed.points.length > 0 && (
            <div className="space-y-3">
              {parsed.points.map((point, idx) => {
                const scheme = GRADIENT_SCHEMES[idx % GRADIENT_SCHEMES.length];
                const cardNo = idx + 2; // 第2卡开始
                return (
                  <div
                    key={idx}
                    className="rounded-xl p-4 text-white shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${scheme.from}, ${scheme.to})`,
                    }}
                  >
                    <div className="font-bold text-base mb-1">{point.title}</div>
                    {point.content && (
                      <div className="text-sm opacity-90 leading-relaxed">{point.content}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 【第N卡】结尾卡 - 仅在有内容时渲染 */}
          {hasEnding && (
            <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl p-4 text-white shadow-lg">
              {parsed.conclusion && (
                <div className="font-medium text-base mb-2">💡 {parsed.conclusion}</div>
              )}
              {parsed.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {parsed.tags.map((tag, idx) => (
                    <span 
                      key={idx} 
                      className="text-xs bg-white/20 px-2 py-0.5 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 完整正文（折叠展示） */}
          {parsed.fullText && (
            <details className="border-t border-gray-100 pt-3">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                📝 查看完整正文 ({parsed.fullText.length}字)
              </summary>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mt-2 pl-2 border-l-2 border-gray-200">
                {parsed.fullText}
              </div>
            </details>
          )}

          {/* 无内容提示 - 使用统一的判断逻辑 */}
          {!hasCover && parsed.points.length === 0 && !hasEnding && !parsed.fullText && (
            <div className="text-center text-gray-400 py-8">
              暂无内容
            </div>
          )}
        </div>

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

function XiaohongshuContentEditor({ content: rawContent, onChange }: { content: string; onChange: (v: string) => void }) {
  const parsed = parseXhsContent(rawContent);
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
