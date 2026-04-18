'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

// 存储键名常量
export const STORAGE_KEY = 'creationGuide_v2_draft';
const AUTO_SAVE_DELAY = 1000; // 1秒防抖（内部使用）

/**
 * 防抖自动保存Hook - 优化版本
 * 
 * 解决问题：
 * - 自动保存频率过高，导致UI卡顿
 * - 无变化时避免重复保存
 * - 添加了保存状态反馈
 */
export function useDebouncedStorage<T extends object>(
  key: string,
  data: T,
  delay: number = AUTO_SAVE_DELAY
): { isSaving: boolean; lastSaved: Date | null; forceSave: () => void } {
  // [M4修复] 使用 ReturnType<typeof setTimeout> 替代 NodeJS.Timeout
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDataRef = useRef<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 序列化数据
  const serializedData = useMemo(() => {
    return JSON.stringify({
      ...data,
      savedAt: Date.now()
    });
  }, [data]);

  // 强制保存函数
  const forceSave = useCallback(() => {
    try {
      setIsSaving(true);
      localStorage.setItem(key, serializedData);
      prevDataRef.current = serializedData;
      setLastSaved(new Date());
      setIsSaving(false);
    } catch (error) {
      console.warn('强制保存失败:', error);
      setIsSaving(false);
    }
  }, [key, serializedData]);

  // 防抖自动保存
  useEffect(() => {
    if (serializedData === prevDataRef.current) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsSaving(true);

    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, serializedData);
        prevDataRef.current = serializedData;
        setLastSaved(new Date());
      } catch (error) {
        console.warn('自动保存失败:', error);
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsSaving(false);
    };
  }, [key, serializedData, delay]);

  // 初始化时加载保存时间
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.savedAt) {
          setLastSaved(new Date(parsed.savedAt));
        }
      }
    } catch (error) {
      console.warn('加载草稿失败:', error);
    }
  }, [key]);

  return {
    isSaving,
    lastSaved,
    forceSave
  };
}

/**
 * 加载存储数据的辅助函数
 */
export function loadFromStorage<T extends object>(
  key: string,
  defaultValue: T
): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);
      // [m6修复] 不直接修改解析后的对象，使用展开运算符创建新对象并排除 savedAt
      const { savedAt: _, ...rest } = data;
      return { ...defaultValue, ...rest };
    }
  } catch (error) {
    console.warn('从Storage加载失败:', error);
  }

  return defaultValue;
}

/**
 * 安全的localStorage大小检查
 */
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB

export function checkStorageSize(data: object): { valid: boolean; size: number } {
  const serialized = JSON.stringify(data);
  const size = serialized.length;
  return {
    valid: size <= MAX_STORAGE_SIZE,
    size
  };
}
