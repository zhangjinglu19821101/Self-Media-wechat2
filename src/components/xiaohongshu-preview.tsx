/**
 * 小红书图文预览组件
 * 
 * 解析 insurance-xiaohongshu 返回的 JSON 内容，
 * 以小红书风格渲染预览（手机模拟器 + 图文卡片 + 文字区）
 * 
 * 支持左右滑动翻页查看多张卡片
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Copy, Download, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { getCurrentWorkspaceId } from '@/lib/api/client';

// 小红书内容结构
interface XiaohongshuContent {
  title: string;
  intro?: string;
  points: Array<{ title: string; content: string }>;
  conclusion?: string;
  tags?: string[];
  fullText?: string;   // 旧格式：纯正文
  content?: string;     // 新信封格式：正文
  articleTitle?: string;
}

interface XiaohongshuPreviewProps {
  /** 任务ID，用于加载内容 */
  taskId?: string;
  /** 命令结果ID，用于查找同组的写作任务（当 taskId 不是写作任务时使用） */
  commandResultId?: string;
  /** 是否直接传入内容（不需要API加载） */
  content?: XiaohongshuContent | null;
  /** 触发按钮的变体 */
  variant?: 'default' | 'outline' | 'ghost';
  /** 按钮尺寸 */
  size?: 'default' | 'sm' | 'lg';
}

/**
 * 从任务结果中解析小红书 JSON 内容
 * 
 * 支持多种数据格式：
 * 1. 新信封格式：{ isCompleted, result: { content, articleTitle, platformData: { title, points, ... } } }
 * 2. 旧格式1：{ isCompleted, result: { fullText, title, points, ... } }
 * 3. 旧格式2：直接的 JSON 对象
 * 4. 从文本中提取的 JSON 片段
 */
function parseXhsContent(raw: string | object | null | undefined): XiaohongshuContent | null {
  if (!raw) return null;

  // 如果已经是对象
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    
    // 新信封格式：{ isCompleted, result: { content, articleTitle, platformData: {...} } }
    if (obj.result && typeof obj.result === 'object') {
      const result = obj.result as Record<string, unknown>;
      
      // 信封格式：result.content + result.platformData
      if (result.platformData && typeof result.platformData === 'object') {
        const pd = result.platformData as Record<string, unknown>;
        // 类型安全的 points 提取：过滤掉不符合结构的元素
        let points: Array<{ title: string; content: string }> = [];
        if (Array.isArray(pd.points)) {
          points = pd.points
            .filter((p: unknown) => typeof p === 'object' && p !== null && typeof (p as Record<string, unknown>).title === 'string' && typeof (p as Record<string, unknown>).content === 'string')
            .map((p: unknown) => ({ title: (p as Record<string, unknown>).title as string, content: (p as Record<string, unknown>).content as string }));
        }
        return {
          content: typeof result.content === 'string' ? result.content : undefined,
          fullText: typeof result.content === 'string' ? result.content : undefined,
          articleTitle: typeof result.articleTitle === 'string' ? result.articleTitle : undefined,
          title: typeof pd.title === 'string' ? pd.title : '',
          intro: typeof pd.intro === 'string' ? pd.intro : undefined,
          points,
          conclusion: typeof pd.conclusion === 'string' ? pd.conclusion : undefined,
          tags: Array.isArray(pd.tags) ? pd.tags.filter((t: unknown) => typeof t === 'string') as string[] : undefined,
        };
      }
      
      // 旧格式：result.fullText + result.title + result.points
      if (result.title || result.points || result.fullText) {
        return result as unknown as XiaohongshuContent;
      }
    }
    
    // 可能直接就是内容对象
    if (obj.title || obj.points || obj.fullText || obj.content) {
      return obj as unknown as XiaohongshuContent;
    }
    
    // result 可能是字符串
    if (typeof obj.result === 'string') {
      return parseXhsContent(obj.result);
    }
    return null;
  }

  // 字符串处理
  try {
    const parsed = JSON.parse(raw);
    return parseXhsContent(parsed); // 递归处理解析后的对象
  } catch {
    // 尝试从文本中提取 JSON
    const jsonMatch = raw.match(/\{[\s\S]*"title"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title || parsed.points || parsed.fullText) {
          return parsed;
        }
      } catch {
        // 忽略
      }
    }
  }
  return null;
}

/**
 * 渐变色方案（与小红书卡片生成器一致）
 */
const GRADIENT_SCHEMES = [
  { from: '#FF6B6B', to: '#FFA07A' },  // 粉橙
  { from: '#667eea', to: '#764ba2' },  // 蓝紫
  { from: '#2dd4bf', to: '#34d399' },  // 青绿
  { from: '#1e3a5f', to: '#4a90d9' },  // 深蓝
  { from: '#f472b6', to: '#fb923c' },  // 珊瑚粉
];

export function XiaohongshuPreview({
  taskId,
  commandResultId,
  content: externalContent,
  variant = 'outline',
  size = 'sm',
}: XiaohongshuPreviewProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<XiaohongshuContent | null>(externalContent || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // 🔥 翻页状态
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // 🔥 正文展开/收起状态
  const [isFullTextExpanded, setIsFullTextExpanded] = useState(false);
  
  // 🔥 P0 修复：使用 ref 防止重复加载
  const loadingRef = useRef(false);
  
  // 计算总卡片数
  const totalCards = content ? (1 + (content.points?.length || 0) + (content.conclusion ? 1 : 0)) : 0;

  // 🔥 点赞/收藏状态（仅UI展示）
  const [isLiked, setIsLiked] = useState(false);
  const [isCollected, setIsCollected] = useState(false);

  // 当外部内容变化时同步
  useEffect(() => {
    if (externalContent) {
      setContent(externalContent);
    }
  }, [externalContent]);

  // 对话框打开时加载内容（仅在无外部内容时）
  // 🔥 修复：使用 ref 防止重复加载，移除 content 依赖避免循环
  useEffect(() => {
    if (open && !externalContent && (taskId || commandResultId) && !content && !loadingRef.current) {
      loadingRef.current = true;
      let cancelled = false;
      const loadContent = async () => {
        setLoading(true);
        try {
          const workspaceId = getCurrentWorkspaceId();
          
          // 🔥 如果只有 commandResultId，先查找写作任务
          let actualTaskId = taskId;
          if (!actualTaskId && commandResultId) {
            const listResponse = await fetch(`/api/agents/tasks/writing-task?commandResultId=${commandResultId}&executor=insurance-xiaohongshu`, {
              headers: { 'x-workspace-id': workspaceId },
            });
            if (listResponse.ok) {
              const listData = await listResponse.json();
              const writingTask = listData.tasks?.[0];
              if (writingTask) {
                actualTaskId = writingTask.id;
              }
            }
          }
          
          if (!actualTaskId) {
            throw new Error('找不到写作任务');
          }
          
          const response = await fetch(`/api/agents/tasks/${actualTaskId}/detail`, {
            headers: {
              'x-workspace-id': workspaceId,
            },
          });
          
          // 🔥 P1 修复：检查 HTTP 状态码
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          if (cancelled) return;
          if (data.success) {
            const task = data.data?.task;
            const stepHistory = data.data?.stepHistory || [];

            // 尝试从多个来源提取小红书 JSON
            let rawContent: string | object | null = null;

            for (const step of stepHistory) {
              const interactContent = step.interactContent;
              if (interactContent?.executorOutput?.output) {
                // output 可能是字符串或已解析的对象
                rawContent = typeof interactContent.executorOutput.output === 'object'
                  ? interactContent.executorOutput.output
                  : String(interactContent.executorOutput.output);
                break;
              }
              if (interactContent?.resultSummary) {
                rawContent = interactContent.resultSummary;
                break;
              }
            }

            if (!rawContent && task?.resultData) {
              const rd = task.resultData;
              if (rd.executorOutput?.output) {
                rawContent = typeof rd.executorOutput.output === 'object'
                  ? rd.executorOutput.output
                  : String(rd.executorOutput.output);
              } else if (rd.result) {
                rawContent = typeof rd.result === 'object' ? rd.result : String(rd.result);
              }
            }

            const parsed = parseXhsContent(rawContent);
            if (parsed) {
              setContent(parsed);
            } else {
              toast.error('无法解析小红书图文内容');
            }
          }
        } catch (error) {
          if (!cancelled) {
            console.error('加载小红书内容失败:', error);
            toast.error('加载内容失败');
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
            loadingRef.current = false;
          }
        }
      };
      loadContent();
      return () => { 
        cancelled = true; 
        loadingRef.current = false;
      };
    }
  }, [open, taskId, externalContent]);  // 🔥 修复：移除 content 依赖，使用 ref 防重复

  const handleCopyFullText = () => {
    // 兼容新信封格式 content 和旧格式 fullText
    const textToCopy = (content?.content || content?.fullText || '').trim();
    if (!textToCopy) {
      toast.error('没有可复制的正文内容');
      return;
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      toast.success('正文已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyJson = () => {
    if (!content) return;
    navigator.clipboard.writeText(JSON.stringify(content, null, 2)).then(() => {
      toast.success('JSON 已复制到剪贴板');
    });
  };
  
  // 🔥 翻页功能
  const goToPage = useCallback((page: number) => {
    if (page >= 0 && page < totalCards) {
      setCurrentPage(page);
    }
  }, [totalCards]);
  
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
  
  // 重置页码当内容变化时
  useEffect(() => {
    setCurrentPage(0);
  }, [content?.title]);

  // 如果没有内容，不渲染
  if (!content && !open) {
    return (
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Eye className="w-4 h-4 mr-1" />
        预览
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-1">
          <Eye className="w-4 h-4" />
          预览
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">📕 小红书图文预览</span>
            {content?.articleTitle && (
              <Badge variant="secondary" className="text-xs">
                {content.articleTitle}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
            <span className="ml-3 text-gray-500">加载中...</span>
          </div>
        ) : content ? (
          <div className="space-y-6">
            {/* 🔥 小红书风格模拟器 */}
            <div className="flex justify-center">
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
                          transform: `translateX(-${currentPage * 100}%)`,
                          width: `${totalCards * 100}%`
                        }}
                      >
                        {/* 封面卡 */}
                        <div className="flex-shrink-0 h-full flex items-center justify-center p-6" style={{ width: `${100 / totalCards}%` }}>
                          <div
                            className="w-full h-full rounded-2xl flex flex-col justify-center px-5 py-6 text-white shadow-lg"
                            style={{
                              background: `linear-gradient(135deg, ${GRADIENT_SCHEMES[0].from}, ${GRADIENT_SCHEMES[0].to})`,
                            }}
                          >
                            <div className="text-xs opacity-70 mb-3 font-medium">📕 封面</div>
                            <div className="text-xl font-bold leading-tight mb-3">{content.title}</div>
                            {content.intro && (
                              <div className="text-sm opacity-90 leading-relaxed">{content.intro}</div>
                            )}
                          </div>
                        </div>
                        
                        {/* 要点卡片 */}
                        {content.points?.map((point, idx) => {
                          const scheme = GRADIENT_SCHEMES[(idx + 1) % GRADIENT_SCHEMES.length];
                          return (
                            <div key={idx} className="flex-shrink-0 h-full flex items-center justify-center p-6" style={{ width: `${100 / totalCards}%` }}>
                              <div
                                className="w-full h-full rounded-2xl flex flex-col justify-center px-5 py-6 text-white shadow-lg"
                                style={{
                                  background: `linear-gradient(135deg, ${scheme.from}, ${scheme.to})`,
                                }}
                              >
                                <div className="text-xs opacity-70 mb-3 font-medium">📌 要点 {idx + 1}</div>
                                <div className="text-xl font-bold leading-tight mb-3">{point.title}</div>
                                {point.content && (
                                  <div className="text-sm opacity-90 leading-relaxed">{point.content}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* 结尾卡 */}
                        {content.conclusion && (
                          <div className="flex-shrink-0 h-full flex items-center justify-center p-6" style={{ width: `${100 / totalCards}%` }}>
                            <div
                              className="w-full h-full rounded-2xl flex flex-col justify-center px-5 py-6 text-white shadow-lg"
                              style={{
                                background: 'linear-gradient(135deg, #374151, #111827)',
                              }}
                            >
                              <div className="text-xs opacity-70 mb-3 font-medium">✨ 结语</div>
                              <div className="text-xl font-bold leading-tight mb-3">{content.conclusion}</div>
                              {content.tags && content.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                  {content.tags.map((tag, tIdx) => (
                                    <span key={tIdx} className="text-xs bg-white/20 px-2.5 py-1 rounded-full">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* 左右翻页按钮 */}
                      {totalCards > 1 && (
                        <>
                          <button
                            onClick={goToPrevPage}
                            disabled={currentPage === 0}
                            className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center transition-all ${
                              currentPage === 0 ? 'opacity-20' : 'hover:bg-black/60'
                            }`}
                          >
                            <ChevronLeft className="w-5 h-5 text-white" />
                          </button>
                          <button
                            onClick={goToNextPage}
                            disabled={currentPage === totalCards - 1}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center transition-all ${
                              currentPage === totalCards - 1 ? 'opacity-20' : 'hover:bg-black/60'
                            }`}
                          >
                            <ChevronRight className="w-5 h-5 text-white" />
                          </button>
                        </>
                      )}
                      
                      {/* 页码指示器 */}
                      {totalCards > 1 && (
                        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
                          {Array.from({ length: totalCards }).map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => goToPage(idx)}
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
                    >
                      <div className={`w-10 h-10 rounded-full ${isLiked ? 'bg-red-500' : 'bg-white/20'} flex items-center justify-center`}>
                        <span className="text-lg">{isLiked ? '❤️' : '🤍'}</span>
                      </div>
                      <span className="text-white text-xs">1.2w</span>
                    </button>
                    
                    {/* 收藏 */}
                    <button 
                      onClick={() => setIsCollected(!isCollected)}
                      className="flex flex-col items-center gap-1"
                    >
                      <div className={`w-10 h-10 rounded-full ${isCollected ? 'bg-yellow-500' : 'bg-white/20'} flex items-center justify-center`}>
                        <span className="text-lg">{isCollected ? '⭐' : '☆'}</span>
                      </div>
                      <span className="text-white text-xs">8562</span>
                    </button>
                    
                    {/* 评论 */}
                    <button className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-lg">💬</span>
                      </div>
                      <span className="text-white text-xs">328</span>
                    </button>
                    
                    {/* 分享 */}
                    <button className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-lg">↗️</span>
                      </div>
                      <span className="text-white text-xs">分享</span>
                    </button>
                  </div>
                </div>
                
                {/* 🔥 底部正文区 */}
                <div className="bg-white p-4">
                  {/* 标题 */}
                  <h2 className="text-base font-bold text-gray-900 mb-2 leading-snug">
                    {content.title || '小红书笔记'}
                  </h2>
                  
                  {/* 正文 */}
                  {(content.content || content.fullText) && (
                    <>
                      <p className={`text-sm text-gray-700 leading-relaxed mb-3 ${isFullTextExpanded ? '' : 'line-clamp-3'}`}>
                        {content.content || content.fullText}
                      </p>
                      {((content.content || content.fullText)?.length || 0) > 150 && (
                        <button
                          onClick={() => setIsFullTextExpanded(!isFullTextExpanded)}
                          className="text-xs text-red-500 font-medium mb-2 hover:text-red-600 transition-colors"
                        >
                          {isFullTextExpanded ? '收起 ▲' : '展开全文 ▼'}
                        </button>
                      )}
                    </>
                  )}
                  
                  {/* 标签 */}
                  {content.tags && content.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {content.tags.map((tag, idx) => (
                        <span key={idx} className="text-xs text-blue-500 font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* 发布信息 */}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>IP属地：北京</span>
                    <span>编辑于 2024-04-19</span>
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

            {/* 操作按钮 */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {(content.content || content.fullText) && (
                <Button variant="outline" size="sm" onClick={handleCopyFullText}>
                  {copied ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? '已复制' : '复制正文'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleCopyJson}>
                <Copy className="w-4 h-4 mr-1" />
                复制 JSON
              </Button>
              <Link href={`/xiaohongshu-card?taskId=${taskId}`} className="inline-flex">
                <Button size="sm" className="bg-gradient-to-r from-red-500 to-pink-500 text-white">
                  <Download className="w-4 h-4 mr-1" />
                  生成卡片图
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            暂无可预览的内容
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
