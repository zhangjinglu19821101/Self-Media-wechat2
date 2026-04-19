/**
 * 小红书卡片生成 - 预览与下载页面
 * 
 * /xiaohongshu-card
 * /xiaohongshu-card?taskId=xxx  （从任务预览跳转，自动加载已生成的卡片）
 * 
 * 功能：
 * 1. 从任务预览跳转时，自动加载已持久化的卡片（OSS）
 * 2. 如果没有已生成的卡片，支持手动生成并持久化
 * 3. 支持逐张下载或批量下载
 * 4. 图片可直接用于上传小红书
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Download, RefreshCw, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentWorkspaceId } from '@/lib/api/client';

const GRADIENT_OPTIONS = [
  { value: 'pinkOrange', label: '粉橙渐变（热门）' },
  { value: 'bluePurple', label: '蓝紫渐变（专业）' },
  { value: 'tealGreen', label: '青绿渐变（清新）' },
  { value: 'deepBlue', label: '深蓝渐变（稳重）' },
  { value: 'coralPink', label: '珊瑚粉（女性向）' },
];

// 持久化卡片（来自OSS）
interface PersistedCard {
  cardId: string;
  cardIndex: number;
  cardType: string;
  url: string;
  title: string | null;
}

// 生成的卡片（来自API）
interface GeneratedCard {
  index: number;
  base64?: string;
  width: number;
  height: number;
  url?: string;  // 持久化后的URL
  storageKey?: string;
  cardId?: string;
}

export default function XiaohongshuCardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <XiaohongshuCardContent />
    </Suspense>
  );
}

function XiaohongshuCardContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId');
  
  // 持久化卡片（从OSS加载）
  const [persistedCards, setPersistedCards] = useState<PersistedCard[]>([]);
  const [loadingPersisted, setLoadingPersisted] = useState(false);
  
  // 手动生成相关状态
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [pointsText, setPointsText] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [tags, setTags] = useState('');
  const [gradient, setGradient] = useState('pinkOrange');
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 是否显示生成表单
  const [showGenerateForm, setShowGenerateForm] = useState(false);

  // 从 taskId 加载已持久化的卡片
  const loadPersistedCards = useCallback(async () => {
    if (!taskId) return;
    
    setLoadingPersisted(true);
    try {
      const workspaceId = getCurrentWorkspaceId();
      const response = await fetch(
        `/api/xiaohongshu/generate-cards?subTaskId=${taskId}`,
        {
          headers: { 'x-workspace-id': workspaceId },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.cards?.length > 0) {
          setPersistedCards(data.cards);
          setShowGenerateForm(false);
          toast.success(`已加载 ${data.cards.length} 张卡片`);
        } else {
          // 没有已生成的卡片，显示生成表单
          setShowGenerateForm(true);
          toast.info('暂无已生成的卡片，请手动生成');
        }
      } else {
        setShowGenerateForm(true);
      }
    } catch (err) {
      console.error('加载持久化卡片失败:', err);
      setShowGenerateForm(true);
    } finally {
      setLoadingPersisted(false);
    }
  }, [taskId]);

  // 页面加载时，如果有 taskId，先尝试加载已持久化的卡片
  useEffect(() => {
    if (taskId) {
      loadPersistedCards();
    } else {
      // 没有 taskId，直接显示生成表单
      setShowGenerateForm(true);
    }
  }, [taskId, loadPersistedCards]);

  const parsePoints = () => {
    return pointsText
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const [title, content] = line.split('|');
        return { title: title?.trim() || '', content: content?.trim() || '' };
      });
  };

  // 生成卡片并持久化到OSS
  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setGeneratedCards([]);

    try {
      const points = parsePoints();
      if (!title || points.length === 0) {
        setError('请填写标题和至少一个要点');
        setLoading(false);
        return;
      }

      const workspaceId = getCurrentWorkspaceId();
      
      const response = await fetch('/api/xiaohongshu/generate-cards', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          mode: 'article',
          title,
          intro,
          points,
          conclusion,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          gradientScheme: gradient,
          // 🔥 关键：持久化到OSS
          persist: true,
          subTaskId: taskId || `manual-${Date.now()}`,
          workspaceId,
          cardCountMode: '5-card',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.error || '生成失败');
        return;
      }

      // 设置生成的卡片
      setGeneratedCards(data.cards || []);
      
      if (data.persisted) {
        toast.success(`已生成 ${data.cards?.length || 0} 张卡片并保存到云端`);
        // 重新加载持久化卡片
        if (taskId) {
          await loadPersistedCards();
        }
      } else {
        toast.success(`已生成 ${data.cards?.length || 0} 张卡片`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 下载单张卡片
  const downloadCard = async (url: string, index: number, isBase64: boolean = false) => {
    try {
      let blob: Blob;
      
      if (isBase64) {
        // Base64 转 Blob
        const response = await fetch(`data:image/png;base64,${url}`);
        blob = await response.blob();
      } else {
        // 从 URL 下载
        const response = await fetch(url);
        blob = await response.blob();
      }
      
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `xhs_card_${index + 1}.png`;
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error('下载失败');
      console.error('下载失败:', err);
    }
  };

  // 批量下载
  const downloadAll = async () => {
    const cards = persistedCards.length > 0 ? persistedCards : generatedCards;
    
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const url = persistedCards.length > 0 
        ? (card as PersistedCard).url 
        : (card as GeneratedCard).url || `data:image/png;base64,${(card as GeneratedCard).base64}`;
      
      await downloadCard(url, i, !!(card as GeneratedCard).base64 && !(card as GeneratedCard).url);
      // 间隔200ms避免浏览器阻止
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    toast.success('下载完成');
  };

  // 打开图片在新标签页
  const openInNewTab = (url: string) => {
    window.open(url, '_blank');
  };

  // 判断是否有卡片可显示
  const hasPersistedCards = persistedCards.length > 0;
  const hasGeneratedCards = generatedCards.length > 0;
  const displayCards = hasPersistedCards ? persistedCards : generatedCards;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">小红书卡片生成器</h1>
            {taskId && (
              <p className="text-sm text-gray-500 mt-1">
                任务ID: {taskId}
              </p>
            )}
          </div>
          
          {hasPersistedCards && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadPersistedCards}>
                <RefreshCw className="w-4 h-4 mr-1" />
                刷新
              </Button>
              <Button variant="outline" size="sm" onClick={downloadAll}>
                <Download className="w-4 h-4 mr-1" />
                下载全部
              </Button>
            </div>
          )}
        </div>

        {/* 加载中 */}
        {loadingPersisted && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-500">加载已生成的卡片...</span>
          </div>
        )}

        {/* 已持久化的卡片展示 */}
        {!loadingPersisted && hasPersistedCards && !showGenerateForm && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 text-sm">
                ✅ 已生成 {persistedCards.length} 张卡片，存储在云端，可直接下载使用
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {persistedCards.map((card, index) => (
                <div
                  key={card.cardId}
                  className="relative group bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <img
                    src={card.url}
                    alt={`卡片 ${index + 1}`}
                    className="w-full aspect-[3/4] object-cover"
                  />
                  
                  {/* 卡片类型标签 */}
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {card.cardType === 'cover' ? '封面' : 
                     card.cardType === 'ending' ? '结尾' : 
                     `要点${card.cardIndex}`}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => downloadCard(card.url, index)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => openInNewTab(card.url)}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* 重新生成按钮 */}
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setShowGenerateForm(true)}
              >
                重新生成
              </Button>
            </div>
          </div>
        )}

        {/* 生成表单 */}
        {(!loadingPersisted && showGenerateForm) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧：输入区 */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    文章内容
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>标题</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="文章标题（≤20字）"
                      maxLength={30}
                    />
                  </div>

                  <div>
                    <Label>副标题/引言</Label>
                    <Input
                      value={intro}
                      onChange={(e) => setIntro(e.target.value)}
                      placeholder="副标题（可选）"
                    />
                  </div>

                  <div>
                    <Label>
                      要点（每行一条，格式：标题|内容）
                    </Label>
                    <Textarea
                      value={pointsText}
                      onChange={(e) => setPointsText(e.target.value)}
                      placeholder="要点标题|要点内容"
                      rows={6}
                    />
                  </div>

                  <div>
                    <Label>结语</Label>
                    <Input
                      value={conclusion}
                      onChange={(e) => setConclusion(e.target.value)}
                      placeholder="总结语"
                    />
                  </div>

                  <div>
                    <Label>话题标签（逗号分隔）</Label>
                    <Input
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="保险,重疾险"
                    />
                  </div>

                  <div>
                    <Label>配色方案</Label>
                    <Select value={gradient} onValueChange={setGradient}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADIENT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 mr-1" />
                        生成卡片
                      </>
                    )}
                  </Button>

                  {error && (
                    <p className="text-red-500 text-sm">{error}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 右侧：预览区 */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  生成结果 {hasGeneratedCards && `(${generatedCards.length}张)`}
                </h2>
                {hasGeneratedCards && (
                  <Button variant="outline" size="sm" onClick={downloadAll}>
                    <Download className="w-4 h-4 mr-1" />
                    下载全部
                  </Button>
                )}
              </div>

              {!hasGeneratedCards ? (
                <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-300 rounded-lg text-gray-400">
                  填写左侧内容后点击生成
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {generatedCards.map((card, index) => (
                    <div
                      key={index}
                      className="relative group bg-white rounded-lg shadow-md overflow-hidden"
                    >
                      <img
                        src={card.url || `data:image/png;base64,${card.base64}`}
                        alt={`卡片 ${index + 1}`}
                        className="w-full aspect-[3/4] object-cover"
                      />
                      
                      {/* 卡片类型标签 */}
                      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {index === 0 ? '封面' : 
                         index === generatedCards.length - 1 ? '结尾' : 
                         `要点${index}`}
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => downloadCard(card.url || card.base64 || '', index, !card.url)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        {card.url && (
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => openInNewTab(card.url)}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
