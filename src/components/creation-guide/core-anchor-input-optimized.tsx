'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { BookOpen, Target, CheckCircle2, AlertCircle } from 'lucide-react';

// 导入优化的类型
import type {
  CoreAnchorData,
  CoreAnchorInputProps,
  ValidationResult
} from './types';
import { WORD_COUNT_RANGES } from './types';

// ========== 纯函数：字数验证 ==========
// 优化：抽离到组件外，减少组件内代码
export function validateWordCount(
  text: string,
  min: number,
  max: number
): ValidationResult {
  const count = text.trim().length;
  const valid = count >= min && count <= max;
  
  let message: string | undefined;
  if (!valid) {
    if (count === 0) {
      message = '请输入内容';
    } else if (count < min) {
      message = `内容较短，建议 ${min}-${max} 字`;
    } else {
      message = `内容较长，建议 ${min}-${max} 字`;
    }
  }

  return { valid, current: count, message };
}

// ========== 纯函数：计算验证结果 ==========
export function computeCoreAnchorValidation(
  data: CoreAnchorData
): Record<keyof CoreAnchorData, ValidationResult> {
  return {
    openingCase: validateWordCount(
      data.openingCase,
      WORD_COUNT_RANGES.openingCase.min,
      WORD_COUNT_RANGES.openingCase.max
    ),
    coreViewpoint: validateWordCount(
      data.coreViewpoint,
      WORD_COUNT_RANGES.coreViewpoint.min,
      WORD_COUNT_RANGES.coreViewpoint.max
    ),
    endingConclusion: validateWordCount(
      data.endingConclusion,
      WORD_COUNT_RANGES.endingConclusion.min,
      WORD_COUNT_RANGES.endingConclusion.max
    )
  };
}

// ========== 子组件：字数指示器 ==========
interface WordCountIndicatorProps {
  current: number;
  min: number;
  max: number;
  valid: boolean;
}

export function WordCountIndicator({
  current,
  min,
  max,
  valid
}: WordCountIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {valid ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
      )}
      <span className={valid ? 'text-emerald-600' : 'text-amber-600'}>
        {current} 字
        {!valid && (
          <span className="text-slate-500 ml-1">（建议 {min}-{max} 字）</span>
        )}
      </span>
    </div>
  );
}

// ========== 主组件：核心锚点输入 ==========
export function CoreAnchorInput({ value, onChange }: CoreAnchorInputProps) {
  // 优化：使用 useMemo 缓存验证结果，避免重复计算
  const validation = useMemo(() => {
    return computeCoreAnchorValidation(value);
  }, [value]);

  const handleChange = (field: keyof CoreAnchorData, text: string) => {
    onChange({ ...value, [field]: text });
  };

  return (
    <Card className="border-2 border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-4 h-4 text-white" />
            </div>
            核心锚点输入
            <Badge variant="secondary" className="text-xs bg-red-50 text-red-600 hover:bg-red-50 ml-2">
              锁死文章灵魂
            </Badge>
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          用户亲笔输入，AI必须原样使用，不可修改、替换、反向解读
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 开篇核心案例段 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-500" />
              开篇核心案例段
              <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700">
                {WORD_COUNT_RANGES.openingCase.min}-{WORD_COUNT_RANGES.openingCase.max}字
              </Badge>
            </Label>
            <WordCountIndicator
              current={validation.openingCase.current}
              min={WORD_COUNT_RANGES.openingCase.min}
              max={WORD_COUNT_RANGES.openingCase.max}
              valid={validation.openingCase.valid}
            />
          </div>
          <Textarea
            placeholder="用户亲笔输入，需包含真实人物、场景、情绪，AI必须原样使用，不可修改、替换。例如：上周我身边的一位朋友小李，32岁，刚查出甲状腺癌，庆幸的是两年前他听了我的建议买了一份港险重疾险..."
            value={value.openingCase}
            onChange={(e) => handleChange('openingCase', e.target.value)}
            rows={4}
            className={`resize-none text-base leading-relaxed transition-colors ${
              validation.openingCase.valid 
                ? 'border-slate-200 focus:border-sky-500 focus:ring-sky-500/20'
                : 'border-amber-200 focus:border-amber-500 focus:ring-amber-500/20 bg-amber-50/30'
            }`}
          />
          {validation.openingCase.message && !validation.openingCase.valid && (
            <p className="text-xs text-amber-600">{validation.openingCase.message}</p>
          )}
        </div>

        {/* 全文核心观点段 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-sky-500" />
              全文核心观点段
              <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700">
                {WORD_COUNT_RANGES.coreViewpoint.min}-{WORD_COUNT_RANGES.coreViewpoint.max}字
              </Badge>
            </Label>
            <WordCountIndicator
              current={validation.coreViewpoint.current}
              min={WORD_COUNT_RANGES.coreViewpoint.min}
              max={WORD_COUNT_RANGES.coreViewpoint.max}
              valid={validation.coreViewpoint.valid}
            />
          </div>
          <Textarea
            placeholder="用户输入核心立场、最终结论及不可改写的红线，AI严格遵循，不可反向解读。例如：保险是保障不是理财，普通人买保险优先看杠杆率，不推荐返还型保险。我们需要的是一份安心，而不是发财梦..."
            value={value.coreViewpoint}
            onChange={(e) => handleChange('coreViewpoint', e.target.value)}
            rows={3}
            className={`resize-none text-base leading-relaxed transition-colors ${
              validation.coreViewpoint.valid 
                ? 'border-slate-200 focus:border-sky-500 focus:ring-sky-500/20'
                : 'border-amber-200 focus:border-amber-500 focus:ring-amber-500/20 bg-amber-50/30'
            }`}
          />
          {validation.coreViewpoint.message && !validation.coreViewpoint.valid && (
            <p className="text-xs text-amber-600">{validation.coreViewpoint.message}</p>
          )}
        </div>

        {/* 结尾核心结论段 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-500" />
              结尾核心结论段
              <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700">
                {WORD_COUNT_RANGES.endingConclusion.min}-{WORD_COUNT_RANGES.endingConclusion.max}字
              </Badge>
            </Label>
            <WordCountIndicator
              current={validation.endingConclusion.current}
              min={WORD_COUNT_RANGES.endingConclusion.min}
              max={WORD_COUNT_RANGES.endingConclusion.max}
              valid={validation.endingConclusion.valid}
            />
          </div>
          <Textarea
            placeholder="用户输入最终避坑建议、态度及收尾观点，AI仅可润色细节，不可修改结论。例如：希望这篇文章能帮你避开保险路上的那些坑。记住，保险姓保，别让营销话术误导了你的判断。如果觉得有用，欢迎转发给身边需要的朋友..."
            value={value.endingConclusion}
            onChange={(e) => handleChange('endingConclusion', e.target.value)}
            rows={3}
            className={`resize-none text-base leading-relaxed transition-colors ${
              validation.endingConclusion.valid 
                ? 'border-slate-200 focus:border-sky-500 focus:ring-sky-500/20'
                : 'border-amber-200 focus:border-amber-500 focus:ring-amber-500/20 bg-amber-50/30'
            }`}
          />
          {validation.endingConclusion.message && !validation.endingConclusion.valid && (
            <p className="text-xs text-amber-600">{validation.endingConclusion.message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// 重新导出类型
export type { CoreAnchorData, CoreAnchorInputProps, ValidationResult };
