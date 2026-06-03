'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Loader2, Check, X, ChevronRight, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

// ============ 类型定义 ============

export interface ReviseOption {
  label: string;
  description: string;
}

/** 后端返回的方案结构 */
interface ApiScheme {
  label: string;
  description: string;
  content: string;
}

/** 前端展示的方案结构 */
export interface ReviseResult {
  label: string;
  revisedText: string;
  explanation: string;
}

interface AiRevisePopoverProps {
  /** 原始段落文本 */
  originalText: string;
  /** 文章标题（供 LLM 参考，可选） */
  articleTitle?: string;
  /** 前文段落（当前段落的前一段，可选） */
  contextBefore?: string;
  /** 后文段落（当前段落的后一段，可选） */
  contextAfter?: string;
  /** 回调：选择某个修订方案后 */
  onApplyRevision: (revisedText: string) => void;
  /** 回调：关闭浮窗（独立模式必传，Popover 内嵌模式可不传） */
  onClose?: () => void;
  /** 锚点元素（独立浮窗定位参考，Popover 内嵌模式不需要） */
  anchorRect?: DOMRect | null;
  /** 内嵌模式：嵌入到 PopoverContent 中，不渲染 fixed 定位和背景遮罩 */
  inline?: boolean;
}

// ============ 预设修改方向 ============

const PRESET_REVISIONS: ReviseOption[] = [
  { label: '更生动', description: '增加比喻、场景描写，让段落更鲜活' },
  { label: '更专业', description: '使用行业术语、权威数据，增强可信度' },
  { label: '更简洁', description: '精简冗余表达，保留核心信息' },
  { label: '更共情', description: '站在读者角度，引发情感共鸣' },
  { label: '更严谨', description: '修正表述漏洞，增强逻辑严密性' },
];

// ============ API 调用封装 ============

async function callAiReviseAPI(params: {
  paragraph: string;
  articleTitle?: string;
  contextBefore?: string;
  contextAfter?: string;
  requirement: string;
  signal?: AbortSignal;
}): Promise<ReviseResult[]> {
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

  // 后端返回 { success, schemes: [{ label, description, content }] }
  if (data.schemes && Array.isArray(data.schemes) && data.schemes.length > 0) {
    return data.schemes.map((s: ApiScheme) => ({
      label: s.label || '方案',
      revisedText: s.content || '',
      explanation: s.description || '',
    }));
  }

  throw new Error('AI 未返回有效的修改方案，请重试');
}

// ============ 主组件 ============

export function AiRevisePopover({
  originalText,
  articleTitle,
  contextBefore,
  contextAfter,
  onApplyRevision,
  onClose,
  anchorRect,
  inline: isInline = false,
}: AiRevisePopoverProps) {
  const [step, setStep] = useState<'input' | 'loading' | 'results'>('input');
  const [userRequirement, setUserRequirement] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [results, setResults] = useState<ReviseResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 组件卸载时取消进行中的请求
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // 自动聚焦输入框
  useEffect(() => {
    if (step === 'input' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [step]);

  // 点击外部关闭（仅独立浮窗模式）
  useEffect(() => {
    if (!onClose) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // 延迟添加，避免当前点击事件触发关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // 计算浮窗位置
  const popoverStyle = getPopoverPosition(anchorRect);

  // 统一的请求提交逻辑（消除 handlePresetClick 和 handleSubmit 的代码重复）
  const submitReviseRequest = useCallback(async (requirement: string) => {
    if (!requirement) return;

    // 取消前一个未完成的请求
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStep('loading');
    setError(null);

    try {
      const reviseResults = await callAiReviseAPI({
        paragraph: originalText,
        articleTitle,
        contextBefore,
        contextAfter,
        requirement,
        signal: controller.signal,
      });
      setResults(reviseResults);
      setStep('results');
    } catch (err: unknown) {
      // 请求被取消时不更新状态（组件可能已卸载）
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      setStep('input');
    }
  }, [originalText, articleTitle, contextBefore, contextAfter]);

  // 手动输入提交
  const handleSubmit = useCallback(() => {
    const requirement = selectedPreset
      ? PRESET_REVISIONS.find(p => p.label === selectedPreset)?.description || selectedPreset
      : userRequirement.trim();
    submitReviseRequest(requirement);
  }, [selectedPreset, userRequirement, submitReviseRequest]);

  // 预设标签点击（自动提交）
  const handlePresetClick = useCallback((preset: ReviseOption) => {
    setSelectedPreset(preset.label);
    setUserRequirement('');
    submitReviseRequest(preset.description);
  }, [submitReviseRequest]);

  // 采纳方案
  const handleApply = useCallback(
    (index: number) => {
      setAppliedIndex(index);
      // 短暂动画后回调
      setTimeout(() => {
        onApplyRevision(results[index].revisedText);
        if (onClose) onClose();
      }, 400);
    },
    [results, onApplyRevision, onClose]
  );

  return (
    <div
      ref={popoverRef}
      style={isInline ? undefined : popoverStyle}
      className={cn(
        "w-[420px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150",
        isInline ? "relative z-auto" : "fixed z-50"
      )}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-violet-500/10">
            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <span className="text-sm font-medium text-gray-800">AI 辅助修改</span>
        </div>
        {!isInline && onClose && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* 内容区域 */}
      <div className="max-h-[420px] overflow-y-auto">
        {step === 'input' && (
          <div className="p-4 space-y-4">
            {/* 原文预览 */}
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-400 mb-1">选中段落</p>
              <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">
                {originalText}
              </p>
            </div>

            {/* 快捷预设标签 */}
            <div>
              <p className="text-xs text-gray-500 mb-2">快捷修改方向</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_REVISIONS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      selectedPreset === preset.label
                        ? 'bg-violet-100 text-violet-700 ring-1 ring-violet-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-600'
                    }`}
                  >
                    <Wand2 className="h-3 w-3" />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义修改要求 */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5">自定义修改要求</p>
              <Textarea
                ref={textareaRef}
                value={userRequirement}
                onChange={(e) => {
                  setUserRequirement(e.target.value);
                  setSelectedPreset(null);
                }}
                placeholder="描述你想要的修改效果，如：加入一个生活化的比喻..."
                className="text-sm resize-none border-gray-200 focus-visible:ring-violet-300"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
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
            <Button
              onClick={handleSubmit}
              disabled={!selectedPreset && !userRequirement.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white text-sm h-9"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              生成 3 个修改方案
            </Button>
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-violet-600 animate-spin" />
              </div>
              <div className="absolute -inset-2 rounded-full border-2 border-violet-200 border-t-transparent animate-spin" style={{ animationDuration: '2s' }} />
            </div>
            <p className="text-sm text-gray-600 mt-4">AI 正在构思修改方案...</p>
            <p className="text-xs text-gray-400 mt-1">通常需要 5-15 秒</p>
          </div>
        )}

        {step === 'results' && results.length > 0 && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-violet-500" />
              为您生成了 {results.length} 个修改方案，点击「采纳」应用
            </p>

            {results.map((result, idx) => (
              <div
                key={idx}
                className={`rounded-lg border transition-all duration-300 ${
                  appliedIndex === idx
                    ? 'border-green-300 bg-green-50 ring-1 ring-green-300'
                    : 'border-gray-200 hover:border-violet-200 hover:shadow-sm'
                }`}
              >
                {/* 方案头部 */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{result.label}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-xs font-medium transition-all ${
                      appliedIndex === idx
                        ? 'text-green-600'
                        : 'text-violet-600 hover:text-violet-700 hover:bg-violet-50'
                    }`}
                    onClick={() => handleApply(idx)}
                    disabled={appliedIndex !== null}
                  >
                    {appliedIndex === idx ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        已采纳
                      </>
                    ) : (
                      <>
                        采纳
                        <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </>
                    )}
                  </Button>
                </div>

                {/* 方案内容 */}
                <div className="px-3 py-2">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {result.revisedText}
                  </p>
                </div>

                {/* 修改说明 */}
                {result.explanation && (
                  <div className="px-3 pb-2">
                    <p className="text-xs text-gray-400 italic">
                      {result.explanation}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* 底部操作 */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500"
                onClick={() => {
                  setStep('input');
                  setResults([]);
                  setAppliedIndex(null);
                }}
              >
                重新生成
              </Button>
              {onClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-500"
                  onClick={onClose}
                >
                  取消
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ 工具函数 ============

function getPopoverPosition(anchorRect?: DOMRect | null): React.CSSProperties {
  if (!anchorRect) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const popoverW = 420;
  const popoverH = 400;

  // 优先放在锚点右侧
  let left = anchorRect.right + 12;
  let top = anchorRect.top;

  // 右侧空间不足 → 放左侧
  if (left + popoverW > viewportW - 16) {
    left = anchorRect.left - popoverW - 12;
  }

  // 左侧也不够 → 居中
  if (left < 16) {
    left = Math.max(16, (viewportW - popoverW) / 2);
  }

  // 垂直方向：避免超出视口
  if (top + popoverH > viewportH - 16) {
    top = Math.max(16, viewportH - popoverH - 16);
  }

  return {
    top: `${top}px`,
    left: `${left}px`,
  };
}
