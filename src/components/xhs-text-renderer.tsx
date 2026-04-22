/**
 * 小红书正文格式渲染器
 * 
 * 模拟小红书真实 App 中的正文渲染格式：
 * 1. 换行分段：\n 渲染为换行，空行渲染为段间距
 * 2. 话题标签：#话题 自动识别并高亮为蓝色
 * 3. 【】强调：方括号内容加粗+颜色
 * 4. emoji 列表标记：1️⃣2️⃣3️⃣/✅❌⚠️💡📌 等自动识别
 * 5. @提及：高亮显示
 * 6. 整体风格：短段落、呼吸感、口语化
 */

'use client';

import React from 'react';

// ============ 正则表达式（预编译） ============

/** 匹配 #话题# 或 #话题（后跟空格/行尾/标点） */
const HASHTAG_REGEX = /#([^#\s]{1,20})#?/g;

/** 匹配 @用户名 */
const MENTION_REGEX = /@([^\s@]{1,20})/g;

/** 匹配【】方括号强调 */
const BRACKET_EMPHASIS_REGEX = /【([^】]+)】/g;

/** emoji 数字列表标记 */
const EMOJI_NUMBER_PREFIX = /^[1-9]️⃣\s*/;

/** 常见 emoji 前缀列表标记 */
const EMOJI_BULLET_PREFIXES = ['✅', '❌', '⚠️', '💡', '📌', '🔥', '👉', '👇', '💰', '📊', '🎯', '⭐', '🌟', '📝', '🔑', '🚨', '💪', '🤔', '😱', '😭', '😅', '😊', '🤗', '👏', '🙏', '💯'];

/** 判断是否为 emoji 列表行 */
function isEmojiBulletLine(line: string): boolean {
  const trimmed = line.trim();
  if (EMOJI_NUMBER_PREFIX.test(trimmed)) return true;
  return EMOJI_BULLET_PREFIXES.some(emoji => trimmed.startsWith(emoji));
}

/** 判断是否为纯空行 */
function isEmptyLine(line: string): boolean {
  return line.trim().length === 0;
}

// ============ 行内富文本渲染 ============

/**
 * 将一行文本渲染为带富文本样式的 React 节点
 * 
 * 处理优先级：话题标签 > @提及 > 【】强调
 */
function renderInlineRichText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  
  // 用一个统一的 token 替换策略，避免正则冲突
  const tokens: Array<{ type: 'hashtag' | 'mention' | 'bracket'; text: string; full: string }> = [];
  
  // 1. 提取话题标签
  let tempText = text.replace(HASHTAG_REGEX, (match, tagContent) => {
    const idx = tokens.length;
    tokens.push({ type: 'hashtag', text: tagContent, full: match });
    return `\x00T${idx}\x00`;
  });
  
  // 2. 提取 @提及
  tempText = tempText.replace(MENTION_REGEX, (match, username) => {
    const idx = tokens.length;
    tokens.push({ type: 'mention', text: username, full: match });
    return `\x00T${idx}\x00`;
  });
  
  // 3. 提取【】强调
  tempText = tempText.replace(BRACKET_EMPHASIS_REGEX, (match, content) => {
    const idx = tokens.length;
    tokens.push({ type: 'bracket', text: content, full: match });
    return `\x00T${idx}\x00`;
  });
  
  // 4. 按占位符拆分渲染
  const parts = tempText.split(/(\x00T\d+\x00)/);
  
  for (const part of parts) {
    const tokenMatch = part.match(/^\x00T(\d+)\x00$/);
    if (tokenMatch) {
      const token = tokens[parseInt(tokenMatch[1])];
      if (token.type === 'hashtag') {
        nodes.push(
          <span key={`h-${nodes.length}`} className="text-blue-500 font-medium">
            #{token.text}
          </span>
        );
      } else if (token.type === 'mention') {
        nodes.push(
          <span key={`m-${nodes.length}`} className="text-blue-500 font-medium">
            @{token.text}
          </span>
        );
      } else if (token.type === 'bracket') {
        nodes.push(
          <span key={`b-${nodes.length}`} className="font-semibold text-gray-900">
            【{token.text}】
          </span>
        );
      }
    } else if (part) {
      nodes.push(<React.Fragment key={`t-${nodes.length}`}>{part}</React.Fragment>);
    }
  }
  
  return nodes;
}

// ============ 主组件 ============

interface XhsTextRendererProps {
  /** 正文内容（纯文本，含 \n 换行） */
  content: string;
  /** 是否折叠（默认 false） */
  collapsed?: boolean;
  /** 折叠时最大显示行数（默认 3） */
  maxLines?: number;
  /** 展开/收起回调 */
  onToggleCollapse?: () => void;
  /** 额外 className */
  className?: string;
}

/**
 * 小红书正文渲染器
 * 
 * 特点：
 * - \n → 分段换行（非空行 margin-bottom: 8px，空行 margin-bottom: 16px）
 * - #话题 → 蓝色高亮
 * - @提及 → 蓝色高亮
 * - 【】 → 加粗强调
 * - emoji 列表行 → 微缩进
 * - 折叠/展开支持
 */
export function XhsTextRenderer({
  content,
  collapsed = false,
  maxLines = 3,
  onToggleCollapse,
  className = '',
}: XhsTextRendererProps) {
  if (!content) return null;
  
  const lines = content.split('\n');
  
  // 折叠时只显示前 N 个非空行
  let displayLines = lines;
  let hasMore = false;
  
  if (collapsed) {
    const nonEmptyLines: string[] = [];
    let lineCount = 0;
    
    for (const line of lines) {
      nonEmptyLines.push(line);
      if (!isEmptyLine(line)) {
        lineCount++;
      }
      if (lineCount >= maxLines) {
        hasMore = true;
        break;
      }
    }
    displayLines = nonEmptyLines;
  } else {
    hasMore = false;
  }
  
  return (
    <div className={`xhs-text-renderer ${className}`}>
      {displayLines.map((line, idx) => {
        // 空行：渲染为较大的段间距
        if (isEmptyLine(line)) {
          // 折叠模式下，末尾的空行不渲染
          if (collapsed && idx === displayLines.length - 1) return null;
          return <div key={idx} className="h-3" />;
        }
        
        // emoji 列表行：微缩进
        const isBullet = isEmojiBulletLine(line);
        const lineClass = isBullet
          ? 'text-sm text-gray-700 leading-relaxed pl-1'
          : 'text-sm text-gray-700 leading-relaxed';
        
        return (
          <p key={idx} className={`${lineClass} mb-1.5`}>
            {renderInlineRichText(line)}
          </p>
        );
      })}
      
      {/* 折叠遮罩渐变 + 展开按钮 */}
      {collapsed && hasMore && (
        <div className="relative -mt-8 pt-8 bg-gradient-to-t from-white to-transparent">
          <button
            onClick={onToggleCollapse}
            className="text-xs text-red-500 font-semibold hover:text-red-600 transition-colors"
          >
            展开全文
          </button>
        </div>
      )}
      
      {/* 展开状态下的收起按钮 */}
      {!collapsed && onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="text-xs text-red-500 font-semibold hover:text-red-600 transition-colors mt-1"
        >
          收起
        </button>
      )}
    </div>
  );
}

// ============ 纯函数版本（用于非 React 场景） ============

/**
 * 将小红书正文转换为 HTML 字符串
 * 用于邮件、复制等场景
 */
export function xhsTextToHtml(content: string): string {
  if (!content) return '';
  
  return content
    .split('\n')
    .map(line => {
      if (line.trim() === '') return '<div style="height:12px"></div>';
      
      let html = line
        // 话题标签
        .replace(HASHTAG_REGEX, '<span style="color:#3b82f6;font-weight:500">#$1</span>')
        // @提及
        .replace(MENTION_REGEX, '<span style="color:#3b82f6;font-weight:500">@$1</span>')
        // 【】强调
        .replace(BRACKET_EMPHASIS_REGEX, '<span style="font-weight:600">【$1】</span>');
      
      return `<p style="font-size:14px;color:#374151;line-height:1.625;margin-bottom:6px">${html}</p>`;
    })
    .join('');
}
