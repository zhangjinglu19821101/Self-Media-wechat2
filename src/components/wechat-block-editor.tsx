/**
 * 微信公众号结构化段落编辑器
 *
 * 核心设计：
 * 1. 解析 HTML → 段落列表，每段显示类型标签 + 可编辑纯文本
 * 2. 用户只修改纯文本，看不到任何 HTML 标签
 * 3. 保存时回写：只替换标签内文本，标签属性原封不动（格式零损失）
 * 4. 每种段落类型有独特的视觉标识（颜色、图标）
 * 5. AI 多版本改写：选中文本/整段 → 3 个差异化版本 → 一键替换
 *
 * 数据流：
 *   HTML → parseHtmlToBlocks() → 段落列表（纯文本可编辑）
 *   → 用户修改文字 → rebuildHtmlFromBlocks() → HTML（零损失）
 */

'use client';

import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Heading1, Heading2, Type, AlertTriangle, MessageCircle,
  Shield, Minus, List, Quote, ChevronDown, ChevronUp,
  RotateCcw, FileText, Sparkles, Trash2
} from 'lucide-react';
import {
  parseHtmlToBlocks,
  rebuildHtmlFromBlocks,
  type HtmlBlock,
} from '@/lib/html-block-parser';
import { AiMultiRewritePanel } from '@/components/ai-multi-rewrite-panel';

// ============ 类型定义 ============

export interface WechatBlockEditorProps {
  /** 原始 HTML 内容 */
  html: string;
  /** 内容变更回调 */
  onChange: (newHtml: string) => void;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 文章标题（供 AI 辅助修改参考） */
  articleTitle?: string;
}

interface BlockStyleConfig {
  icon: React.ReactNode;
  badgeVariant: string;
  badgeText: string;
  borderClass: string;
  bgClass: string;
  minHeight: string;
}

// ============ 段落类型样式配置 ============

const BLOCK_STYLES: Record<string, BlockStyleConfig> = {
  h2: {
    icon: <Heading1 className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-black text-white',
    badgeText: '一级标题',
    borderClass: 'border-l-4 border-l-black',
    bgClass: 'bg-gray-50',
    minHeight: 'min-h-[36px]',
  },
  h3: {
    icon: <Heading2 className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-emerald-600 text-white',
    badgeText: '二级标题',
    borderClass: 'border-l-4 border-l-emerald-600',
    bgClass: 'bg-emerald-50/50',
    minHeight: 'min-h-[36px]',
  },
  p_normal: {
    icon: <Type className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-gray-500 text-white',
    badgeText: '正文',
    borderClass: 'border-l-4 border-l-gray-300',
    bgClass: 'bg-white',
    minHeight: 'min-h-[48px]',
  },
  p_重要提醒: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-red-600 text-white',
    badgeText: '重要提醒',
    borderClass: 'border-l-4 border-l-red-500',
    bgClass: 'bg-red-50/50',
    minHeight: 'min-h-[48px]',
  },
  p_引导语: {
    icon: <MessageCircle className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-orange-500 text-white',
    badgeText: '引导语',
    borderClass: 'border-l-4 border-l-orange-400',
    bgClass: 'bg-orange-50/50',
    minHeight: 'min-h-[48px]',
  },
  p_免责声明: {
    icon: <Shield className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-slate-500 text-white',
    badgeText: '免责声明',
    borderClass: 'border-l-4 border-l-slate-400',
    bgClass: 'bg-slate-50/50',
    minHeight: 'min-h-[48px]',
  },
  p_互动区: {
    icon: <MessageCircle className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-blue-500 text-white',
    badgeText: '互动区',
    borderClass: 'border-l-4 border-l-blue-400',
    bgClass: 'bg-blue-50/50',
    minHeight: 'min-h-[48px]',
  },
  p_辅助说明: {
    icon: <FileText className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-slate-400 text-white',
    badgeText: '辅助说明',
    borderClass: 'border-l-4 border-l-slate-300',
    bgClass: 'bg-slate-50/30',
    minHeight: 'min-h-[48px]',
  },
  blockquote: {
    icon: <Quote className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-purple-500 text-white',
    badgeText: '引用',
    borderClass: 'border-l-4 border-l-purple-400',
    bgClass: 'bg-purple-50/50',
    minHeight: 'min-h-[48px]',
  },
  li: {
    icon: <List className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-indigo-500 text-white',
    badgeText: '列表项',
    borderClass: 'border-l-4 border-l-indigo-400',
    bgClass: 'bg-indigo-50/50',
    minHeight: 'min-h-[36px]',
  },
  hr: {
    icon: <Minus className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-gray-300 text-gray-600',
    badgeText: '分割线',
    borderClass: 'border-l-4 border-l-gray-200',
    bgClass: 'bg-gray-50/50',
    minHeight: '',
  },
  other: {
    icon: <FileText className="h-3.5 w-3.5" />,
    badgeVariant: 'bg-gray-400 text-white',
    badgeText: '其他',
    borderClass: 'border-l-4 border-l-gray-300',
    bgClass: 'bg-gray-50/50',
    minHeight: 'min-h-[36px]',
  },
};

/**
 * 获取段落块的样式配置 key
 */
function getBlockStyleKey(block: HtmlBlock): string {
  if (block.type === 'p') {
    const specialKeys: string[] = ['p_重要提醒', 'p_引导语', 'p_免责声明', 'p_互动区', 'p_辅助说明'];
    for (const key of specialKeys) {
      if (block.typeLabel === BLOCK_STYLES[key]?.badgeText) {
        return key;
      }
    }
    return 'p_normal';
  }
  return block.type;
}

// ============ 单个段落块组件 ============

interface BlockEditorProps {
  block: HtmlBlock;
  originalText: string;
  readOnly: boolean;
  onTextChange: (index: number, newText: string) => void;
  onDelete?: (index: number) => void;
  contextBefore?: string;
  contextAfter?: string;
  articleTitle?: string;
  allBlocks?: HtmlBlock[];
}

/** 单个段落编辑器 — memo 防止无关段落重渲染 */
const BlockEditorItem = memo(function BlockEditorItem({ block, originalText, readOnly, onTextChange, onDelete, contextBefore, contextAfter, articleTitle }: BlockEditorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const styleKey = getBlockStyleKey(block);
  const style = BLOCK_STYLES[styleKey] || BLOCK_STYLES.other;

  // 分割线：只渲染一条线
  if (block.type === 'hr') {
    return (
      <div className={`py-2 px-3 ${style.bgClass} ${style.borderClass} rounded-r-md`}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{style.icon}</span>
          <Badge className={`text-[10px] px-1.5 py-0 h-5 rounded font-normal ${style.badgeVariant}`}>
            {style.badgeText}
          </Badge>
          <div className="flex-1 border-t border-gray-200" />
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
              onClick={() => onDelete?.(block.index)}
              title="删除此段落"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // 不可编辑的块
  if (!block.editable) {
    return null;
  }

  const handleChange = (value: string) => {
    onTextChange(block.index, value);
    setHasChanged(value !== originalText);
  };

  const handleReset = () => {
    onTextChange(block.index, originalText);
    setHasChanged(false);
  };

  /** 打开 AI 面板，如果用户选中了部分文字则只改写选中部分 */
  const handleOpenAiPanel = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      const selectedText = textarea.value.substring(selStart, selEnd).trim();
      if (selectedText.length >= 2) {
        setSelectedSnippet(selectedText);
      } else {
        setSelectedSnippet(null);
      }
    } else {
      setSelectedSnippet(null);
    }
    setAiPanelOpen(true);
  };

  /** AI 改写采纳回调 — 处理选中片段替换或整段替换 */
  const handleApplyRevision = (revisedText: string) => {
    if (selectedSnippet) {
      // 替换选中片段
      const currentText = block.text || '';
      const newText = currentText.replace(selectedSnippet, revisedText);
      onTextChange(block.index, newText);
      setHasChanged(newText !== originalText);
    } else {
      // 整段替换
      onTextChange(block.index, revisedText);
      setHasChanged(true);
    }
    setSelectedSnippet(null);
  };

  const handleCloseAiPanel = () => {
    setAiPanelOpen(false);
    setSelectedSnippet(null);
  };

  // 计算行数
  const lineCount = Math.max(2, Math.ceil((block.text?.length || 0) / 50));

  // AI 面板要改写的文本
  const aiReviseText = selectedSnippet || block.text || '';
  const isSnippetMode = !!selectedSnippet;

  return (
    <div className={`group relative ${style.borderClass} ${aiPanelOpen ? 'bg-violet-50/30' : style.bgClass} rounded-r-md transition-all`}>
      {/* 头部：类型标签 + AI按钮 + 修改标记 */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-inherit/10">
        <span className="text-gray-500">{style.icon}</span>
        <Badge className={`text-[10px] px-1.5 py-0 h-5 rounded font-normal ${style.badgeVariant}`}>
          {style.badgeText}
        </Badge>
        {block.colorHint && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full border border-gray-200"
              style={{ backgroundColor: block.colorHint }}
            />
          </span>
        )}
        {hasChanged && (
          <Badge className="text-[10px] px-1.5 py-0 h-5 rounded font-normal bg-amber-100 text-amber-700 border border-amber-200">
            已修改
          </Badge>
        )}
        <div className="flex-1" />
        {/* AI 共创按钮 — 始终可见，不在 aiPanelOpen 时显示 */}
        {!readOnly && block.text && block.text.trim().length >= 5 && !aiPanelOpen && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-violet-400 hover:text-violet-600 hover:bg-violet-50"
            onClick={handleOpenAiPanel}
            title="AI 共创改写"
          >
            <Sparkles className="h-3 w-3" />
            <span className="ml-0.5 hidden sm:inline">AI改写</span>
          </Button>
        )}
        {hasChanged && !readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-gray-400 hover:text-gray-600"
            onClick={handleReset}
            title="恢复原文"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
        {!readOnly && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => onDelete(block.index)}
            title="删除此段落"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-gray-400 hover:text-gray-600"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </Button>
      </div>

      {/* 内容：可编辑文本 */}
      {!isCollapsed && (
        <div className="px-3 py-2">
          {readOnly ? (
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${style.minHeight}`}>
              {block.text || '(空)'}
            </p>
          ) : (
            <Textarea
              ref={textareaRef}
              value={block.text}
              onChange={(e) => handleChange(e.target.value)}
              rows={lineCount}
              className={`text-sm leading-relaxed resize-y border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${style.minHeight}`}
              placeholder="输入内容..."
            />
          )}
        </div>
      )}

      {/* 选中文字提示 */}
      {isSnippetMode && aiPanelOpen && (
        <div className="px-3 pb-1">
          <div className="rounded bg-violet-100/60 border border-violet-200/50 px-2 py-1 flex items-center gap-1.5">
            <span className="text-[10px] text-violet-600 font-medium">选中文本:</span>
            <span className="text-[10px] text-violet-800 line-clamp-1 flex-1">
              {selectedSnippet.length > 60 ? selectedSnippet.slice(0, 60) + '...' : selectedSnippet}
            </span>
            <button
              className="text-[10px] text-violet-400 hover:text-violet-600"
              onClick={() => setSelectedSnippet(null)}
              title="改为改写整段"
            >
              改写整段
            </button>
          </div>
        </div>
      )}

      {/* AI 多版本改写面板（内嵌在段落下方） */}
      {aiPanelOpen && !readOnly && (
        <div className="px-3 pb-2">
          <AiMultiRewritePanel
            originalText={aiReviseText}
            contextBefore={contextBefore}
            contextAfter={contextAfter}
            articleTitle={articleTitle}
            onApplyRevision={handleApplyRevision}
            onClose={handleCloseAiPanel}
            inline={true}
          />
        </div>
      )}
    </div>
  );
});

// ============ 主组件 ============

export function WechatBlockEditor({ html, onChange, readOnly = false, articleTitle }: WechatBlockEditorProps) {
  // 解析 HTML
  const parseResult = useMemo(() => parseHtmlToBlocks(html), [html]);

  // 编辑状态：维护每个块的文本
  const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});
  const [deletedBlockIndices, setDeletedBlockIndices] = useState<Set<number>>(new Set());

  // 构建当前编辑后的块列表
  const currentBlocks = useMemo(() => {
    return parseResult.blocks
      .filter(block => !deletedBlockIndices.has(block.index))
      .map(block => ({
        ...block,
        text: editedTexts[block.index] !== undefined ? editedTexts[block.index] : block.text,
      }));
  }, [parseResult.blocks, editedTexts, deletedBlockIndices]);

  // 处理文本变更
  const handleTextChange = useCallback((index: number, newText: string) => {
    setEditedTexts(prev => ({ ...prev, [index]: newText }));
  }, []);

  // 处理删除块
  const handleDeleteBlock = useCallback((index: number) => {
    setDeletedBlockIndices(prev => new Set([...prev, index]));
    setEditedTexts(prev => {
      const newTexts = { ...prev };
      delete newTexts[index];
      return newTexts;
    });
  }, []);

  // 🔥 修复无限循环：使用 ref 记录上次输出的 HTML，只有真正变化时才调用 onChange
  const lastHtmlRef = useRef<string>(html);

  // 当 html prop 外部变化时（如恢复原文、key remount），同步更新 ref
  // 防止 ref 持有旧值导致 onChange 漏触发
  useEffect(() => {
    lastHtmlRef.current = html;
  }, [html]);

  // 当编辑状态变化时，回写到父组件（仅当内容真正变化时）
  useEffect(() => {
    const newHtml = rebuildHtmlFromBlocks(parseResult, currentBlocks);
    // 只有当 HTML 真正变化时才触发 onChange，避免循环
    if (newHtml !== lastHtmlRef.current) {
      lastHtmlRef.current = newHtml;
      onChange(newHtml);
    }
  }, [currentBlocks, onChange, parseResult]);

  // 计算每个段落的前后上下文（仅传前后各1段，而非整篇文章，减少 Token 消耗）
  const blockContexts = useMemo(() => {
    const textBlocks = currentBlocks.filter(b => b.text?.trim());
    const contextMap = new Map<number, { before?: string; after?: string }>();
    for (let i = 0; i < textBlocks.length; i++) {
      const block = textBlocks[i];
      contextMap.set(block.index, {
        before: i > 0 ? textBlocks[i - 1].text : undefined,
        after: i < textBlocks.length - 1 ? textBlocks[i + 1].text : undefined,
      });
    }
    return contextMap;
  }, [currentBlocks]);

  // 编辑中的文本与原始不同的块数
  const changedCount = useMemo(() => {
    return currentBlocks.filter(b => {
      const original = parseResult.blocks.find(ob => ob.index === b.index);
      return original && original.text !== b.text;
    }).length;
  }, [currentBlocks, parseResult.blocks]);

  // 统计信息
  const stats = useMemo(() => {
    const editable = parseResult.blocks.filter(b => b.editable);
    const total = editable.length;
    const totalChars = editable.reduce((sum, b) => sum + (b.text?.length || 0), 0);
    const h2Count = parseResult.blocks.filter(b => b.type === 'h2').length;
    const h3Count = parseResult.blocks.filter(b => b.type === 'h3').length;
    const pCount = parseResult.blocks.filter(b => b.type === 'p').length;
    return { total, totalChars, h2Count, h3Count, pCount };
  }, [parseResult.blocks]);

  return (
    <div className="space-y-3">
      {/* 顶部统计栏 */}
      <div className="flex items-center gap-3 text-xs text-gray-500 px-1">
        <span>共 {stats.total} 个段落</span>
        <span>·</span>
        <span>{stats.totalChars} 字</span>
        <span>·</span>
        <span>{stats.h2Count} 个一级标题</span>
        <span>·</span>
        <span>{stats.h3Count} 个二级标题</span>
        <span>·</span>
        <span>{stats.pCount} 个正文段落</span>
        {changedCount > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-600 font-medium">{changedCount} 处修改</span>
          </>
        )}
      </div>

      {/* 段落列表 */}
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
        {currentBlocks.map((block) => (
          <BlockEditorItem
            key={block.index}
            block={block}
            originalText={parseResult.blocks.find(b => b.index === block.index)?.text || ''}
            readOnly={readOnly}
            onTextChange={handleTextChange}
            onDelete={handleDeleteBlock}
            contextBefore={blockContexts.get(block.index)?.before}
            contextAfter={blockContexts.get(block.index)?.after}
            articleTitle={articleTitle}
            allBlocks={parseResult.blocks}
          />
        ))}
      </div>

      {/* 底部操作提示 */}
      {changedCount > 0 && !readOnly && (
        <div className="flex items-center justify-between px-1 pt-2 border-t border-gray-100">
          <p className="text-xs text-amber-600">
            你修改了 {changedCount} 处内容，点击「确认并继续」将保存修改
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              setEditedTexts({});
            }}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            撤销全部修改
          </Button>
        </div>
      )}
    </div>
  );
}
