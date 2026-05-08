/**
 * 微信公众号结构化段落编辑器
 *
 * 核心设计：
 * 1. 解析 HTML → 段落列表，每段显示类型标签 + 可编辑纯文本
 * 2. 用户只修改纯文本，看不到任何 HTML 标签
 * 3. 保存时回写：只替换标签内文本，标签属性原封不动（格式零损失）
 * 4. 每种段落类型有独特的视觉标识（颜色、图标）
 *
 * 数据流：
 *   HTML → parseHtmlToBlocks() → 段落列表（纯文本可编辑）
 *   → 用户修改文字 → rebuildHtmlFromBlocks() → HTML（零损失）
 */

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Heading1, Heading2, Type, AlertTriangle, MessageCircle,
  Shield, Minus, List, Quote, ChevronDown, ChevronUp,
  RotateCcw, FileText
} from 'lucide-react';
import {
  parseHtmlToBlocks,
  rebuildHtmlFromBlocks,
  type HtmlBlock,
} from '@/lib/html-block-parser';

// ============ 类型定义 ============

export interface WechatBlockEditorProps {
  /** 原始 HTML 内容 */
  html: string;
  /** 内容变更回调 */
  onChange: (newHtml: string) => void;
  /** 是否只读模式 */
  readOnly?: boolean;
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
    // 根据类型标签查找精确匹配
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
}

function BlockEditorItem({ block, originalText, readOnly, onTextChange }: BlockEditorProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

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

  // 计算行数
  const lineCount = Math.max(2, Math.ceil((block.text?.length || 0) / 50));

  return (
    <div className={`group relative ${style.borderClass} ${style.bgClass} rounded-r-md transition-all`}>
      {/* 头部：类型标签 + 折叠按钮 + 修改标记 */}
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
              value={block.text}
              onChange={(e) => handleChange(e.target.value)}
              rows={lineCount}
              className={`text-sm leading-relaxed resize-y border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 ${style.minHeight}`}
              placeholder="输入内容..."
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============ 主组件 ============

export function WechatBlockEditor({ html, onChange, readOnly = false }: WechatBlockEditorProps) {
  // 解析 HTML
  const parseResult = useMemo(() => parseHtmlToBlocks(html), [html]);

  // 编辑状态：维护每个块的文本
  const [editedTexts, setEditedTexts] = useState<Record<number, string>>({});

  // 构建当前编辑后的块列表
  const currentBlocks = useMemo(() => {
    return parseResult.blocks.map(block => ({
      ...block,
      text: editedTexts[block.index] !== undefined ? editedTexts[block.index] : block.text,
    }));
  }, [parseResult.blocks, editedTexts]);

  // 处理文本变更
  const handleTextChange = useCallback((index: number, newText: string) => {
    setEditedTexts(prev => ({ ...prev, [index]: newText }));
  }, []);

  // 当编辑状态变化时，实时回写到父组件
  useEffect(() => {
    const newHtml = rebuildHtmlFromBlocks(parseResult, currentBlocks);
    onChange(newHtml);
  }, [currentBlocks, onChange, parseResult]);

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
