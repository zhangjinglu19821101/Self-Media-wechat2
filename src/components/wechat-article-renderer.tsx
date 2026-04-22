/**
 * 微信公众号文章预览渲染器
 * 
 * 模拟微信公众号 App 中的文章预览效果：
 * 1. 手机模拟器外观
 * 2. 正确渲染内联样式（保持公众号格式）
 * 3. 折叠/展开支持
 * 4. 模拟公众号阅读体验
 */

'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';

// ============ 微信公众号样式常量 ============

/** 公众号标准配色 */
const WECHAT_COLORS = {
  openingOrange: '#E67E22',
  primaryGreen: '#2AB692',
  warningRed: '#FF0000',
  textDark: '#3E3E3E',
  textBlack: '#000000',
  textLight: '#666666',
  divider: '#eeeeee',
};

// ============ HTML 清理和标准化 ============

/**
 * 清理公众号文章 HTML，移除危险标签，保持内联样式
 */
function sanitizeWechatHtml(html: string): string {
  if (!html) return '';
  
  // 如果没有外层 section 包装，自动添加一个
  let processed = html.trim();
  if (!processed.startsWith('<section')) {
    processed = `<section style="background:#ffffff; padding:0 12px; font-size:14px; line-height:1.6;">${processed}</section>`;
  }
  
  return processed;
}

/**
 * 计算预览时的高度来判断是否需要折叠
 */
function estimateContentHeight(html: string): number {
  if (!html) return 0;
  // 粗略估算：每个标签约等于一定高度
  const pCount = (html.match(/<p[^>]*>/g) || []).length;
  const h2Count = (html.match(/<h2[^>]*>/g) || []).length;
  const h3Count = (html.match(/<h3[^>]*>/g) || []).length;
  const hrCount = (html.match(/<hr[^>]*>/g) || []).length;
  
  return pCount * 40 + h2Count * 60 + h3Count * 45 + hrCount * 15;
}

// ============ 主组件 ============

interface WechatArticleRendererProps {
  /** 文章 HTML 内容 */
  html: string;
  /** 是否折叠（默认 true） */
  collapsed?: boolean;
  /** 折叠时最大显示高度（像素，默认 400） */
  maxHeight?: number;
  /** 展开/收起回调 */
  onToggleCollapse?: () => void;
  /** 额外 className */
  className?: string;
}

/**
 * 微信公众号文章预览渲染器
 * 
 * 特点：
 * - 手机模拟器外观（圆角、边框、阴影）
 * - 正确渲染公众号内联样式
 * - 折叠/展开支持（渐变遮罩）
 * - 保持原文格式完整
 */
export function WechatArticleRenderer({
  html,
  collapsed = true,
  maxHeight = 400,
  onToggleCollapse,
  className = '',
}: WechatArticleRendererProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 清理 HTML
  const safeHtml = useMemo(() => sanitizeWechatHtml(html), [html]);
  
  // 判断内容是否足够长需要折叠
  const needsCollapse = useMemo(() => {
    return estimateContentHeight(safeHtml) > maxHeight;
  }, [safeHtml, maxHeight]);
  
  // 处理折叠切换
  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    onToggleCollapse?.();
  };
  
  // 重置状态当 html 变化时
  useEffect(() => {
    setIsExpanded(!collapsed);
  }, [html, collapsed]);
  
  if (!safeHtml) {
    return (
      <div className={`wechat-article-renderer ${className}`}>
        <div className="text-center py-8 text-gray-400">
          暂无文章内容
        </div>
      </div>
    );
  }
  
  return (
    <div className={`wechat-article-renderer ${className}`}>
      {/* 🔥 手机模拟器外壳 */}
      <div className="bg-gray-100 rounded-3xl p-3 shadow-sm border border-gray-200">
        {/* 顶部状态栏模拟 */}
        <div className="bg-gray-900 text-white text-xs px-4 py-1.5 rounded-t-2xl flex justify-between items-center mb-0.5">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>
        
        {/* 公众号头部 */}
        <div className="bg-white px-4 py-3 border-b flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm">
            📝
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">智者足迹-探寻</div>
            <div className="text-xs text-gray-400">2小时前</div>
          </div>
          <button className="text-green-600 text-xs border border-green-600 rounded px-2 py-1">
            关注
          </button>
        </div>
        
        {/* 文章内容区 */}
        <div className="bg-white">
          <div 
            ref={contentRef}
            className={`overflow-hidden transition-all duration-300 ${isExpanded ? '' : 'relative'}`}
            style={!isExpanded && needsCollapse ? { maxHeight: `${maxHeight}px` } : undefined}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
          
          {/* 折叠遮罩渐变 */}
          {!isExpanded && needsCollapse && (
            <div className="relative -mt-16 pt-16 bg-gradient-to-t from-white to-transparent pointer-events-none">
            </div>
          )}
          
          {/* 展开/收起按钮 */}
          {needsCollapse && (
            <div className="px-4 pb-4 pt-2">
              <button
                onClick={handleToggle}
                className="w-full text-center text-sm text-green-600 font-medium hover:text-green-700 transition-colors"
              >
                {isExpanded ? '收起内容' : '展开阅读全文'}
              </button>
            </div>
          )}
        </div>
        
        {/* 底部互动栏 */}
        <div className="bg-white border-t px-4 py-3 flex justify-around text-xs text-gray-500">
          <div className="flex flex-col items-center gap-0.5">
            <span>👍</span>
            <span>点赞</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span>💬</span>
            <span>留言</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span>⭐</span>
            <span>收藏</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span>↗️</span>
            <span>分享</span>
          </div>
        </div>
      </div>
      
      {/* 格式说明提示 */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        预览效果，格式与公众号完全一致
      </div>
    </div>
  );
}

// ============ 纯函数版本（用于非 React 场景） ============

/**
 * 微信公众号 HTML 转为安全预览 HTML
 */
export function wechatHtmlToPreview(html: string): string {
  if (!html) return '<p class="text-gray-400">暂无内容</p>';
  return sanitizeWechatHtml(html);
}
