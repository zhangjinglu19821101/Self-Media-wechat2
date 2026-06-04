'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

/**
 * 通用多选下拉框组件
 * 
 * - 支持多选/全选
 * - 选中项以 Badge 形式展示
 * - 点击"全部"清除所有选择
 * 
 * 用法：
 * ```tsx
 * <MultiSelectDropdown
 *   options={[{ value: '意外险', label: '意外险' }, ...]}
 *   selected={selectedProducts}
 *   onChange={setSelectedProducts}
 *   placeholder="险种筛选"
 * />
 * ```
 */
export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder = '请选择',
  allLabel = '全部',
  className = '',
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  const isSelectedAll = selected.length === 0;

  // 显示文本
  const displayText = isSelectedAll
    ? allLabel
    : selected.length <= 2
      ? selected.join('、')
      : `${selected[0]}等${selected.length}项`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer hover:bg-accent hover:text-accent-foreground"
      >
        <span className={`truncate ${isSelectedAll ? 'text-muted-foreground' : 'text-foreground'}`}>
          {placeholder}{isSelectedAll ? '' : `：${displayText}`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[200px] max-h-[280px] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {/* 全部选项 */}
          <button
            type="button"
            onClick={selectAll}
            className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground ${
              isSelectedAll ? 'bg-accent/50' : ''
            }`}
          >
            {isSelectedAll && <Check className="mr-2 h-3.5 w-3.5 text-primary" />}
            {!isSelectedAll && <span className="mr-2 w-3.5" />}
            {allLabel}
          </button>

          <div className="my-1 h-px bg-border" />

          {/* 各选项 */}
          {options.map(option => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleOption(option.value)}
                className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground ${
                  isSelected ? 'bg-accent/50' : ''
                }`}
              >
                {isSelected && <Check className="mr-2 h-3.5 w-3.5 text-primary" />}
                {!isSelected && <span className="mr-2 w-3.5" />}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
