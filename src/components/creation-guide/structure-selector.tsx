'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Layers, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

// 从统一类型文件导入
import type { StructureTemplate, StructureSelectorProps } from './types';
import { STRUCTURE_TEMPLATES, getDefaultStructure } from './structure-templates';

export function StructureSelector({ selectedStructure, onStructureChange }: StructureSelectorProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // 获取默认结构
  const defaultStructure = getDefaultStructure();
  
  // 判断当前选中的是否为默认结构
  const isDefaultSelected = selectedStructure.id === defaultStructure.id;
  
  // 当前要优先展示的结构（如果是其他结构选中，展示选中的；否则展示默认）
  const primaryStructure = isDefaultSelected ? defaultStructure : selectedStructure;
  
  // 其他结构（排除当前优先展示的）
  const otherStructures = STRUCTURE_TEMPLATES.filter(
    (s) => s.id !== primaryStructure.id
  );

  // 渲染结构卡片
  const renderStructureCard = (structure: StructureTemplate, isPrimary: boolean = false) => (
    <div
      key={structure.id}
      onClick={() => onStructureChange(structure)}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        selectedStructure.id === structure.id
          ? 'border-sky-500 bg-sky-50 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
      } ${isPrimary ? 'ring-1 ring-sky-100' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900">{structure.name}</span>
            {structure.isFixed && (
              <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700">
                默认
              </Badge>
            )}
            {structure.isUserExclusive && (
              <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700">
                专属
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs bg-slate-50 text-slate-600">
              {structure.sections.length}段
            </Badge>
            {structure.totalSuggestedWordCount && (
              <Badge variant="secondary" className="text-xs bg-slate-50 text-slate-600">
                约{structure.totalSuggestedWordCount}字
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">{structure.description}</p>
        </div>
        {selectedStructure.id === structure.id && (
          <CheckCircle2 className="w-5 h-5 text-sky-500 flex-shrink-0" />
        )}
      </div>
    </div>
  );

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-500" />
          结构选择
          <Badge variant="secondary" className="text-xs bg-sky-50 text-sky-700 ml-2">
            核心骨架
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs mt-1">
          选择文章结构模板，AI严格按该结构顺序创作
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 优先展示的结构 */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-slate-900">
            {primaryStructure.isFixed ? '默认推荐' : '当前选择'}
          </Label>
          {renderStructureCard(primaryStructure, true)}
        </div>

        {/* 其他结构（可折叠） */}
        {otherStructures.length > 0 && (
          <Collapsible open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-9 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              >
                {isMoreOpen ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    收起其他结构
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    查看其他 {otherStructures.length} 种结构
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-2">
                {otherStructures.map((structure) => renderStructureCard(structure))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}


