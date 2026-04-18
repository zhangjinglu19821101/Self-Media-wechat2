'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { BookOpen, Target, CheckCircle2, AlertCircle } from 'lucide-react';

// 核心锚点数据类型
export interface CoreAnchorData {
  openingCase: string;        // 开篇核心案例段
  coreViewpoint: string;       // 全文核心观点段
  endingConclusion: string;   // 结尾核心结论段
}

interface CoreAnchorInputProps {
  value: CoreAnchorData;
  onChange: (data: CoreAnchorData) => void;
}

// 字数验证函数
const validateWordCount = (text: string, min: number, max: number): { valid: boolean; current: number } => {
  const count = text.trim().length;
  return { valid: count >= min && count <= max, current: count };
};

export function CoreAnchorInput({ value, onChange }: CoreAnchorInputProps) {
  const [validation, setValidation] = useState({
    openingCase: validateWordCount(value.openingCase, 150, 300),
    coreViewpoint: validateWordCount(value.coreViewpoint, 100, 200),
    endingConclusion: validateWordCount(value.endingConclusion, 100, 200)
  });

  // 实时验证
  useEffect(() => {
    setValidation({
      openingCase: validateWordCount(value.openingCase, 150, 300),
      coreViewpoint: validateWordCount(value.coreViewpoint, 100, 200),
      endingConclusion: validateWordCount(value.endingConclusion, 100, 200)
    });
  }, [value]);

  const handleChange = (field: keyof CoreAnchorData, text: string) => {
    onChange({ ...value, [field]: text });
  };

  // 渲染字数指示器
  const WordCountIndicator = ({ 
    current, 
    min, 
    max, 
    valid 
  }: { current: number; min: number; max: number; valid: boolean }) => (
    <div className="flex items-center gap-2 text-xs">
      {valid ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
      )}
      <span className={valid ? 'text-emerald-600' : 'text-amber-600'}>
        {current} 字
        {!valid && <span className="text-slate-500 ml-1">（建议 {min}-{max} 字）</span>}
      </span>
    </div>
  );

  return (
    <Card className="border-2 border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            核心锚点输入
            <Badge variant="secondary" className="text-xs bg-red-50 text-red-600 hover:bg-red-50 ml-2">
              锁死文章灵魂
            </Badge>
          </CardTitle>
        </div>
        <CardDescription>
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
                150-300字
              </Badge>
            </Label>
            <WordCountIndicator 
              current={validation.openingCase.current}
              min={150}
              max={300}
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
        </div>

        {/* 全文核心观点段 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-sky-500" />
              全文核心观点段
              <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700">
                100-200字
              </Badge>
            </Label>
            <WordCountIndicator 
              current={validation.coreViewpoint.current}
              min={100}
              max={200}
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
        </div>

        {/* 结尾核心结论段 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-500" />
              结尾核心结论段
              <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700">
                100-200字
              </Badge>
            </Label>
            <WordCountIndicator 
              current={validation.endingConclusion.current}
              min={100}
              max={200}
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
        </div>
      </CardContent>
    </Card>
  );
}

// 初始空数据
export const emptyCoreAnchorData: CoreAnchorData = {
  openingCase: '',
  coreViewpoint: '',
  endingConclusion: ''
};
