/**
 * AI 多版本改写面板
 *
 * 完整功能：
 * 1. 文本选中后浮动工具栏触发
 * 2. 模态对话框：选中字符数 + 自定义指令 + 6个快捷指令按钮 + 生成按钮
 * 3. 侧边面板展示 3 个风格差异化版本
 * 4. 每个版本：风格标签 + 相似度百分比 + 一键替换/复制
 * 5. "换一批"重新生成 + "修改指令"重新输入
 * 6. 历史记录（localStorage，最近 10 次）
 * 7. Ctrl+Shift+R 快捷键
 * 8. 批量改写支持
 * 9. 版本对比（并排显示）
 */

'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Sparkles, Loader2, Check, X, ChevronRight, Wand2,
  RefreshCw, Copy, History, ArrowRight, ArrowLeft,
  SplitSquareHorizontal, RotateCcw, Zap, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ============ 类型定义 ============

/** 快捷指令 */
export interface QuickCommand {
  key: string;
  label: string;
  description: string;
  promptHint: string;
}

/** 改写方案 */
export interface RewriteScheme {
  label: string;
  styleTag: string;
  description: string;
  content: string;
  similarity: number;
}

/** 历史记录条目 */
export interface RewriteHistoryEntry {
  id: string;
  timestamp: number;
  originalText: string;
  requirement: string;
  schemes: RewriteScheme[];
  appliedSchemeIndex: number | null;
}

/** 组件 Props */
export interface AiMultiRewritePanelProps {
  /** 原始文本（选中的片段或整段） */
  originalText: string;
  /** 整段原文（当 originalText 是选中片段时，提供完整段落作为上下文） */
  fullParagraphText?: string;
  /** 文章标题（供 LLM 参考） */
  articleTitle?: string;
  /** 前文段落 */
  contextBefore?: string;
  /** 后文段落 */
  contextAfter?: string;
  /** 回调：选择某个修订方案后 */
  onApplyRevision: (revisedText: string) => void;
  /** 回调：关闭面板 */
  onClose: () => void;
  /** 锚点位置（浮动定位参考） */
  anchorRect?: DOMRect | null;
  /** 内嵌模式 */
  inline?: boolean;
  /** workspaceId（传递给 API） */
  workspaceId?: string;
}

// ============ 常量 ============

const QUICK_COMMANDS: QuickCommand[] = [
  { key: 'optimize', label: '优化表达', description: '优化措辞和表达节奏，让文字更流畅自然', promptHint: '优化措辞和表达节奏，让文字更流畅自然，消除生硬感' },
  { key: 'colloquial', label: '更口语化', description: '用日常口语化表达，减少书面感和AI感', promptHint: '用日常口语化表达方式改写，像朋友聊天一样自然，减少书面感和AI感，多用生活化用词' },
  { key: 'formal', label: '更正式', description: '使用规范的书面表达，增强专业感', promptHint: '使用规范的书面表达，增强专业感和权威性，措辞严谨' },
  { key: 'shorten', label: '缩短篇幅', description: '精简冗余，保留核心信息', promptHint: '精简冗余表达，保留核心信息，让内容更加凝练简洁' },
  { key: 'emotional', label: '增加感染力', description: '增加情感渲染和画面感', promptHint: '增加情感渲染和画面感，让读者产生共鸣，加入具体的场景描写和感性表达' },
  { key: 'deai', label: '去AI化', description: '消除AI痕迹，让文字像真人写的', promptHint: '消除AI写作痕迹，让文字像真人写的。禁用"很多人问""据统计""值得注意的是"等AI高频连接词，用口语化表达替代，增加个人观点和主观感受' },
];

// 快捷指令查找表（用于键盘快捷键）
const QUICK_COMMAND_MAP = Object.fromEntries(QUICK_COMMANDS.map(c => [c.key, c]));

const HISTORY_STORAGE_KEY = 'ai-rewrite-history';
const MAX_HISTORY_ENTRIES = 10;

const STYLE_TAG_COLORS: Record<string, string> = {
  '保守优化': 'bg-blue-100 text-blue-700',
  '创新表达': 'bg-purple-100 text-purple-700',
  '极致改写': 'bg-orange-100 text-orange-700',
  '口语化': 'bg-green-100 text-green-700',
  '专业严谨': 'bg-indigo-100 text-indigo-700',
  '精炼': 'bg-teal-100 text-teal-700',
  '感染力': 'bg-rose-100 text-rose-700',
  '去AI化': 'bg-amber-100 text-amber-700',
};

const DEFAULT_STYLE_COLOR = 'bg-gray-100 text-gray-700';

// ============ API 调用 ============

async function callAiReviseAPI(params: {
  paragraph?: string;
  selectedText?: string;
  articleTitle?: string;
  contextBefore?: string;
  contextAfter?: string;
  requirement?: string;
  quickCommand?: string;
  workspaceId?: string;
  signal?: AbortSignal;
}): Promise<RewriteScheme[]> {
  const resp = await fetch('/api/agents/ai-revise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: params.signal,
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || `请求失败 (${resp.status})`);
  }

  const data = await resp.json();

  if (data.schemes && Array.isArray(data.schemes) && data.schemes.length > 0) {
    return data.schemes.map((s: Record<string, unknown>) => ({
      label: String(s.label || '方案'),
      styleTag: String(s.styleTag || '通用'),
      description: String(s.description || ''),
      content: String(s.content || ''),
      similarity: typeof s.similarity === 'number' ? s.similarity : 0,
    }));
  }

  throw new Error('AI 未返回有效的修改方案，请重试');
}

// ============ 历史记录管理 ============

function loadHistory(): RewriteHistoryEntry[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistory(entries: RewriteHistoryEntry[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES)));
  } catch {
    // localStorage 写入失败时静默忽略
  }
}

function addHistoryEntry(entry: RewriteHistoryEntry): RewriteHistoryEntry[] {
  const entries = loadHistory();
  entries.unshift(entry);
  saveHistory(entries.slice(0, MAX_HISTORY_ENTRIES));
  return entries.slice(0, MAX_HISTORY_ENTRIES);
}

// ============ 相似度颜色 ============

function getSimilarityColor(similarity: number): string {
  if (similarity >= 75) return 'text-green-600';
  if (similarity >= 50) return 'text-amber-600';
  return 'text-orange-600';
}

function getSimilarityBg(similarity: number): string {
  if (similarity >= 75) return 'bg-green-50';
  if (similarity >= 50) return 'bg-amber-50';
  return 'bg-orange-50';
}

// ============ 主组件 ============

export function AiMultiRewritePanel({
  originalText,
  fullParagraphText,
  articleTitle,
  contextBefore,
  contextAfter,
  onApplyRevision,
  onClose,
  anchorRect,
  inline: isInline = false,
  workspaceId,
}: AiMultiRewritePanelProps) {
  // 状态
  const [step, setStep] = useState<'input' | 'loading' | 'results'>('input');
  const [userRequirement, setUserRequirement] = useState('');
  const [selectedQuickCommand, setSelectedQuickCommand] = useState<string | null>(null);
  const [schemes, setSchemes] = useState<RewriteScheme[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<RewriteHistoryEntry[]>(loadHistory);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);
  const [lastRequirement, setLastRequirement] = useState<string>('');

  // Refs
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 用于键盘快捷键中访问最新状态值（避免闭包陈旧问题）
  const stepRef = useRef(step);
  const selectedQuickCommandRef = useRef(selectedQuickCommand);
  const userRequirementRef = useRef(userRequirement);
  const lastRequirementRef = useRef(lastRequirement);

  // 同步 ref 值
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { selectedQuickCommandRef.current = selectedQuickCommand; }, [selectedQuickCommand]);
  useEffect(() => { userRequirementRef.current = userRequirement; }, [userRequirement]);
  useEffect(() => { lastRequirementRef.current = lastRequirement; }, [lastRequirement]);

  // 字符数
  const charCount = originalText.length;

  // 组件卸载时取消请求
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // 自动聚焦
  useEffect(() => {
    if (step === 'input' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [step]);

  // 点击外部关闭（仅独立浮窗模式）
  useEffect(() => {
    if (isInline || !onClose) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isInline, onClose]);

  // 提交改写请求
  const submitRewriteRequest = useCallback(async (requirement: string, quickCommand?: string) => {
    if (!requirement) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStep('loading');
    setError(null);
    setCompareIndex(null);

    try {
      const results = await callAiReviseAPI({
        paragraph: fullParagraphText || originalText,
        selectedText: fullParagraphText ? originalText : undefined,
        articleTitle,
        contextBefore,
        contextAfter,
        requirement: quickCommand ? undefined : requirement,
        quickCommand,
        workspaceId,
        signal: controller.signal,
      });
      setSchemes(results);
      setLastRequirement(requirement);
      setStep('results');

      // 保存历史记录
      const entry: RewriteHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        originalText,
        requirement,
        schemes: results,
        appliedSchemeIndex: null,
      };
      const updatedHistory = addHistoryEntry(entry);
      setHistoryEntries(updatedHistory);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      setStep('input');
    }
  }, [originalText, fullParagraphText, articleTitle, contextBefore, contextAfter, workspaceId]);

  // 点击快捷指令
  const handleQuickCommand = useCallback((cmd: QuickCommand) => {
    setSelectedQuickCommand(cmd.key);
    setUserRequirement('');
    submitRewriteRequest(cmd.promptHint, cmd.key);
  }, [submitRewriteRequest]);

  // 自定义指令提交
  const handleSubmitCustom = useCallback(() => {
    const requirement = userRequirement.trim();
    if (!requirement) return;
    setSelectedQuickCommand(null);
    submitRewriteRequest(requirement);
  }, [userRequirement, submitRewriteRequest]);

  // 换一批（使用相同指令重新生成）
  const handleRegenerate = useCallback(() => {
    if (lastRequirement) {
      if (selectedQuickCommand) {
        submitRewriteRequest(lastRequirement, selectedQuickCommand);
      } else {
        submitRewriteRequest(lastRequirement);
      }
    }
  }, [lastRequirement, selectedQuickCommand, submitRewriteRequest]);

  // Ctrl+Shift+R 快捷键（使用 ref 避免闭包陈旧问题）
  useEffect(() => {
    const submitRewriteRef = { current: submitRewriteRequest };
    const regenRef = { current: handleRegenerate };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        const currentStep = stepRef.current;
        if (currentStep === 'input') {
          const req = userRequirementRef.current;
          const qc = selectedQuickCommandRef.current;
          const effectiveReq = qc ? QUICK_COMMAND_MAP[qc]?.promptHint || req : req;
          if (effectiveReq?.trim() && submitRewriteRef.current) {
            submitRewriteRef.current(effectiveReq, qc || undefined);
          }
        } else if (currentStep === 'results') {
          if (regenRef.current) regenRef.current();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [submitRewriteRequest, handleRegenerate]);

  // 修改指令（回到输入步骤，保留之前的指令）
  const handleModifyInstruction = useCallback(() => {
    setStep('input');
    setSchemes([]);
    setAppliedIndex(null);
    setCompareIndex(null);
    // 不清空指令，方便用户修改
  }, []);

  // 采纳方案
  const handleApply = useCallback((index: number) => {
    setAppliedIndex(index);
    const scheme = schemes[index];

    // 更新历史记录中的 appliedSchemeIndex
    const currentHistory = loadHistory();
    if (currentHistory.length > 0) {
      currentHistory[0].appliedSchemeIndex = index;
      saveHistory(currentHistory);
    }

    setTimeout(() => {
      onApplyRevision(scheme.content);
      toast.success(`已采纳「${scheme.label}」方案`);
      onClose();
    }, 300);
  }, [schemes, onApplyRevision, onClose]);

  // 复制方案内容
  const handleCopyScheme = useCallback(async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(`已复制「${label}」方案`);
    } catch {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(`已复制「${label}」方案`);
    }
  }, []);

  // 从历史记录中恢复
  const handleRestoreFromHistory = useCallback((entry: RewriteHistoryEntry) => {
    setSchemes(entry.schemes);
    setLastRequirement(entry.requirement);
    setStep('results');
    setShowHistory(false);
    setAppliedIndex(null);
    setCompareIndex(null);
  }, []);

  // 计算面板位置
  const panelPosition = useMemo(() => {
    if (isInline || !anchorRect) return undefined;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const panelW = 520;
    const panelH = 560;

    let left = anchorRect.right + 12;
    let top = anchorRect.top;

    if (left + panelW > viewportW - 16) {
      left = anchorRect.left - panelW - 12;
    }
    if (left < 16) {
      left = Math.max(16, (viewportW - panelW) / 2);
    }
    if (top + panelH > viewportH - 16) {
      top = Math.max(16, viewportH - panelH - 16);
    }

    return { top: `${top}px`, left: `${left}px` };
  }, [isInline, anchorRect]);

  return (
    <div
      ref={panelRef}
      style={isInline ? undefined : panelPosition}
      className={cn(
        "w-[520px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150",
        isInline ? "relative z-auto" : "fixed z-50"
      )}
    >
      {/* ====== 标题栏 ====== */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-violet-500/10">
            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <span className="text-sm font-medium text-gray-800">AI 多版本改写</span>
          {charCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-violet-100 text-violet-700">
              {charCount} 字
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 历史记录按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 p-0",
              showHistory ? "text-violet-600 bg-violet-100" : "text-gray-400 hover:text-gray-600"
            )}
            onClick={() => setShowHistory(!showHistory)}
            title="历史记录"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          {!isInline && onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ====== 历史记录面板 ====== */}
      {showHistory && (
        <div className="max-h-[200px] overflow-y-auto border-b border-gray-100 bg-gray-50/50">
          {historyEntries.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              暂无历史记录
            </div>
          ) : (
            <div className="py-1">
              {historyEntries.map((entry) => (
                <button
                  key={entry.id}
                  className="w-full px-3 py-2 text-left hover:bg-violet-50/50 transition-colors"
                  onClick={() => handleRestoreFromHistory(entry)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 line-clamp-1 flex-1 mr-2">
                      {entry.originalText.slice(0, 40)}...
                    </span>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {formatTimeAgo(entry.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-violet-500">指令: {entry.requirement.slice(0, 20)}</span>
                    <span className="text-[10px] text-gray-300">|</span>
                    <span className="text-[10px] text-gray-500">{entry.schemes.length} 个版本</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== 内容区域 ====== */}
      <div className="max-h-[520px] overflow-y-auto">

        {/* ---- 输入步骤 ---- */}
        {step === 'input' && (
          <div className="p-4 space-y-4">
            {/* 原文预览 */}
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400">选中文本</p>
                <p className="text-[10px] text-gray-300">{charCount} 字</p>
              </div>
              <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">
                {originalText}
              </p>
            </div>

            {/* 快捷指令按钮 */}
            <div>
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                快捷指令
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {QUICK_COMMANDS.map((cmd) => (
                  <button
                    key={cmd.key}
                    onClick={() => handleQuickCommand(cmd)}
                    className={cn(
                      "flex flex-col items-start px-2.5 py-2 rounded-lg text-left transition-all border",
                      selectedQuickCommand === cmd.key
                        ? 'bg-violet-100 border-violet-300 ring-1 ring-violet-300'
                        : 'bg-white border-gray-200 hover:bg-violet-50 hover:border-violet-200'
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium",
                      selectedQuickCommand === cmd.key ? "text-violet-700" : "text-gray-700"
                    )}>
                      {cmd.label}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                      {cmd.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义指令输入 */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                自定义改写指令
              </p>
              <Textarea
                ref={textareaRef}
                value={userRequirement}
                onChange={(e) => {
                  setUserRequirement(e.target.value);
                  setSelectedQuickCommand(null);
                }}
                placeholder="描述你想要的改写效果，如：加入一个生活化的比喻..."
                className="text-sm resize-none border-gray-200 focus-visible:ring-violet-300"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitCustom();
                  }
                }}
              />
            </div>

            {/* 错误信息 */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* 提交按钮 */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSubmitCustom}
                disabled={!userRequirement.trim() && !selectedQuickCommand}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm h-9"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                生成 3 个版本
              </Button>
              <span className="text-[10px] text-gray-300 whitespace-nowrap">
                Ctrl+Shift+R
              </span>
            </div>
          </div>
        )}

        {/* ---- 加载步骤 ---- */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-violet-600 animate-spin" />
              </div>
              <div
                className="absolute -inset-2 rounded-full border-2 border-violet-200 border-t-transparent animate-spin"
                style={{ animationDuration: '2s' }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-4">AI 正在构思 3 个差异化版本...</p>
            <p className="text-xs text-gray-400 mt-1">通常需要 10-20 秒</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs text-gray-500"
              onClick={() => {
                abortRef.current?.abort();
                setStep('input');
              }}
            >
              取消
            </Button>
          </div>
        )}

        {/* ---- 结果步骤 ---- */}
        {step === 'results' && schemes.length > 0 && (
          <div className="p-4 space-y-3">
            {/* 顶部信息 */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-violet-500" />
                为您生成了 {schemes.length} 个差异化版本
              </p>
              <p className="text-[10px] text-gray-400">
                指令: {lastRequirement.slice(0, 20)}{lastRequirement.length > 20 ? '...' : ''}
              </p>
            </div>

            {/* 版本卡片列表 */}
            {schemes.map((scheme, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-lg border transition-all duration-300",
                  appliedIndex === idx
                    ? 'border-green-300 bg-green-50/50 ring-1 ring-green-300'
                    : compareIndex === idx
                      ? 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-300'
                      : 'border-gray-200 hover:border-violet-200 hover:shadow-sm'
                )}
              >
                {/* 方案头部 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100/50">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{scheme.label}</span>
                    {/* 风格标签 */}
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] h-5 px-1.5",
                        STYLE_TAG_COLORS[scheme.styleTag] || DEFAULT_STYLE_COLOR
                      )}
                    >
                      {scheme.styleTag}
                    </Badge>
                    {/* 相似度 */}
                    <span className={cn("text-[10px] font-medium", getSimilarityColor(scheme.similarity))}>
                      相似度 {scheme.similarity}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* 版本对比按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-6 w-6 p-0",
                        compareIndex === idx ? "text-blue-600 bg-blue-100" : "text-gray-400 hover:text-blue-500"
                      )}
                      onClick={() => setCompareIndex(compareIndex === idx ? null : idx)}
                      title="版本对比"
                    >
                      <SplitSquareHorizontal className="h-3 w-3" />
                    </Button>
                    {/* 复制按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      onClick={() => handleCopyScheme(scheme.content, scheme.label)}
                      title="复制内容"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {/* 采纳按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-7 text-xs font-medium transition-all",
                        appliedIndex === idx
                          ? 'text-green-600'
                          : 'text-violet-600 hover:text-violet-700 hover:bg-violet-50'
                      )}
                      onClick={() => handleApply(idx)}
                      disabled={appliedIndex !== null}
                    >
                      {appliedIndex === idx ? (
                        <><Check className="h-3.5 w-3.5 mr-1" />已采纳</>
                      ) : (
                        <>采纳<ChevronRight className="h-3.5 w-3.5 ml-0.5" /></>
                      )}
                    </Button>
                  </div>
                </div>

                {/* 版本对比视图 */}
                {compareIndex === idx && (
                  <div className="px-3 py-2 border-b border-blue-100 bg-blue-50/30">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-gray-500 mb-1 font-medium">原文</p>
                        <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-6">
                          {originalText}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-violet-600 mb-1 font-medium">改写</p>
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-6">
                          {scheme.content}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 方案内容 */}
                <div className="px-3 py-2">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {scheme.content}
                  </p>
                </div>

                {/* 修改说明 + 相似度条 */}
                {scheme.description && (
                  <div className="px-3 pb-2 space-y-1.5">
                    <p className="text-xs text-gray-400 italic">{scheme.description}</p>
                    {/* 相似度进度条 */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            scheme.similarity >= 75 ? "bg-green-400" :
                              scheme.similarity >= 50 ? "bg-amber-400" : "bg-orange-400"
                          )}
                          style={{ width: `${scheme.similarity}%` }}
                        />
                      </div>
                      <span className={cn("text-[10px] font-mono", getSimilarityColor(scheme.similarity))}>
                        {scheme.similarity}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 底部操作栏 */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                  onClick={handleRegenerate}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  换一批
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={handleModifyInstruction}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  修改指令
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-300">Ctrl+Shift+R</span>
                {onClose && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-500"
                    onClick={onClose}
                  >
                    关闭
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 工具函数 ============

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return `${days}天前`;
}
