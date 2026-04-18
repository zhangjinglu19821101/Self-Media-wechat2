/**
 * 小红书图文预览页面（供 Agent T MCP 截图使用）
 *
 * 路径: /xiaohongshu-preview/[taskId]
 * 
 * 这是一个独立的、无导航栏的预览页面，
 * Agent T 通过 Playwright 访问此页面并截图生成小红书预览图。
 * 页面渲染完成后会设置 window.__XHS_PREVIEW_READY__ = true，
 * 供 Playwright 等待渲染完成。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useState, useEffect } from 'react';

// 小红书内容结构
interface XiaohongshuContent {
  title: string;
  intro?: string;
  points: Array<{ title: string; content: string }>;
  conclusion?: string;
  tags?: string[];
  fullText?: string;
  articleTitle?: string;
}

// 渐变配色方案
const GRADIENT_SCHEMES = [
  { from: '#ff6b6b', to: '#ffa500' },  // 红橙
  { from: '#6366f1', to: '#a855f7' },  // 蓝紫
  { from: '#14b8a6', to: '#22d3ee' },  // 青绿
  { from: '#1e3a5f', to: '#4a90d9' },  // 深蓝
  { from: '#f472b6', to: '#fb923c' },  // 珊瑚粉
];

/**
 * 从任务结果中解析小红书 JSON 内容
 */
function parseXhsContent(raw: string | object | null | undefined): XiaohongshuContent | null {
  if (!raw) return null;

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (obj.result && typeof obj.result === 'object') {
      const result = obj.result as Record<string, unknown>;
      if (result.title || result.points || result.fullText) {
        return result as unknown as XiaohongshuContent;
      }
    }
    if ((obj as any).title || (obj as any).points || (obj as any).fullText) {
      return obj as unknown as XiaohongshuContent;
    }
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parseXhsContent(parsed);
    } catch {
      // 尝试从文本中提取 JSON
      const jsonMatch = raw.match(/\{[\s\S]*"title"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch { /* ignore */ }
      }
    }
  }

  return null;
}

export default function XiaohongshuPreviewPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const [taskId, setTaskId] = useState<string>('');
  const [content, setContent] = useState<XiaohongshuContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    params.then(p => setTaskId(p.taskId));
  }, [params]);

  useEffect(() => {
    if (!taskId) return;

    let cancelled = false;
    const loadContent = async () => {
      setLoading(true);
      try {
        // 使用公开的预览数据 API（不需要认证，供 Playwright 截图使用）
        const response = await fetch(`/api/xiaohongshu-preview?taskId=${taskId}`);
        
        // 🔥 P1 修复：检查 HTTP 状态码
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();

        if (cancelled) return;

        if (data.success) {
          const rawContent = data.data?.rawContent;
          const parsed = parseXhsContent(rawContent);
          if (parsed) {
            setContent(parsed);
          } else {
            setError('无法解析小红书图文内容');
          }
        } else {
          setError(data.error || '加载失败');
        }
      } catch (err) {
        if (!cancelled) {
          setError('加载内容失败');
          console.error('加载小红书预览失败:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          // 🔥 通知 Playwright 渲染完成
          if (typeof window !== 'undefined') {
            (window as any).__XHS_PREVIEW_READY__ = true;
          }
        }
      }
    };

    loadContent();
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto" />
          <p className="mt-4 text-gray-500">加载小红书图文预览...</p>
        </div>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-500">
          <p className="text-lg">{error || '无法加载内容'}</p>
          <p className="text-sm text-gray-400 mt-2">TaskID: {taskId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center py-8">
      <div className="w-[375px] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* 手机顶部状态栏 */}
        <div className="bg-gray-100 px-4 py-2 flex items-center justify-center">
          <div className="w-20 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* 小红书内容区 */}
        <div className="px-4 py-3 space-y-4">
          {/* 标题 */}
          <h1 className="text-lg font-bold text-gray-900 leading-snug">
            {content.title}
          </h1>

          {/* 引言 */}
          {content.intro && (
            <p className="text-sm text-gray-500">{content.intro}</p>
          )}

          {/* 图片卡片区域 */}
          {content.points && content.points.length > 0 && (
            <div className="space-y-3">
              {/* 封面卡 */}
              <div
                className="rounded-xl p-4 text-white"
                style={{
                  background: `linear-gradient(135deg, ${GRADIENT_SCHEMES[0].from}, ${GRADIENT_SCHEMES[0].to})`,
                  minHeight: '120px',
                }}
              >
                <div className="text-xs opacity-80 mb-1">📕 封面</div>
                <div className="text-base font-bold leading-tight">{content.title}</div>
                {content.intro && (
                  <div className="text-xs opacity-90 mt-1">{content.intro}</div>
                )}
              </div>

              {/* 要点卡片 */}
              {content.points.map((point, idx) => {
                const scheme = GRADIENT_SCHEMES[(idx + 1) % GRADIENT_SCHEMES.length];
                return (
                  <div
                    key={idx}
                    className="rounded-xl p-4 text-white"
                    style={{
                      background: `linear-gradient(135deg, ${scheme.from}, ${scheme.to})`,
                    }}
                  >
                    <div className="text-xs opacity-80 mb-1">
                      {idx === content.points.length - 1 && content.conclusion ? '💡 总结' : `📌 要点${idx + 1}`}
                    </div>
                    <div className="text-sm font-bold leading-tight">{point.title}</div>
                    {point.content && (
                      <div className="text-xs opacity-90 mt-1">{point.content}</div>
                    )}
                  </div>
                );
              })}

              {/* 结尾卡 */}
              {content.conclusion && (
                <div
                  className="rounded-xl p-4 text-white"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  }}
                >
                  <div className="text-xs opacity-80 mb-1">✨ 结语</div>
                  <div className="text-sm font-bold leading-tight">{content.conclusion}</div>
                </div>
              )}
            </div>
          )}

          {/* 文字区 */}
          {content.fullText && (
            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs text-gray-400 mb-2">📝 正文</div>
              <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {content.fullText}
              </div>
            </div>
          )}

          {/* 标签 */}
          {content.tags && content.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {content.tags.map((tag, idx) => (
                <span key={idx} className="text-xs text-blue-500 font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-gray-400 text-xs">
          <div className="flex items-center gap-4">
            <span>❤️ 点赞</span>
            <span>💬 评论</span>
            <span>⭐ 收藏</span>
          </div>
          <span>📤 分享</span>
        </div>
      </div>
    </div>
  );
}
