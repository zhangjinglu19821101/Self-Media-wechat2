/**
 * 小红书图文预览组件
 * 
 * 解析 insurance-xiaohongshu 返回的 JSON 内容，
 * 以小红书风格渲染预览（手机模拟器 + 图文卡片 + 文字区）
 * 
 * 支持左右滑动翻页查看多张卡片
 * 
 * P1-3 增强：支持展示已生成的 OSS 卡片图片（优先级高于 CSS 渲染）
 * 
 * 使用共享模块：@/lib/xhs-parser
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Copy, Download, CheckCircle2, ChevronLeft, ChevronRight, ImageIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { getCurrentWorkspaceId } from '@/lib/api/client';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

// ============ 共享解析模块 ============
import { 
  parseXhsContent as parseXhsContentFromLib,
  type XiaohongshuContent
} from '@/lib/xhs-parser';

// ============ 卡片模板系统 ============
import {
  XHS_CARD_TEMPLATES,
  type XhsCardTemplate,
  getXhsCardTemplate,
  DEFAULT_CARD_TEMPLATE_ID,
} from '@/lib/xhs-card-templates';

/** 用户偏好 localStorage key */
const TEMPLATE_PREF_KEY = 'xhs_card_template_id';

/** 将 ColorScheme 数组转为 CSS 渐变色字符串 */
function colorsToGradient(colors: {from: string; to: string}[], deg: number = 135): string | null {
  if (!colors || colors.length === 0) return null;
  const stops = colors.map(c => `${c.from}, ${c.to}`).join(', ');
  return `linear-gradient(${deg}deg, ${stops})`;
}

/** 根据模板卡片定义生成 CSS 样式对象 */
function getCardStyle(cardDef: {bgType: string; colors: {from: string; to: string}[]; textColor: string; borderColor?: string}): React.CSSProperties {
  const base: React.CSSProperties = { color: cardDef.textColor };
  if (cardDef.bgType === 'gradient' && cardDef.colors.length >= 1) {
    const gradient = colorsToGradient(cardDef.colors);
    if (gradient) base.background = gradient;
  } else if (cardDef.bgType === 'solid' && cardDef.colors.length >= 1) {
    base.background = cardDef.colors[0].from;
  }
  if ((cardDef as any).borderColor) {
    base.border = `1px solid ${(cardDef as any).borderColor}`;
  }
  return base;
}

/** 根据要点卡片定义和索引生成样式 */
function getPointCardStyle(pointDef: XhsCardTemplate['point'], idx: number): React.CSSProperties {
  const style = getCardStyle(pointDef);
  // 渐变类模板按索引轮换颜色方向
  if (pointDef.bgType === 'gradient' && pointDef.colors.length >= 1) {
    const deg = 120 + idx * 30;
    const gradient = colorsToGradient(pointDef.colors, deg);
    if (gradient) style.background = gradient;
  }
  return style;
}

// 🔥 小红书正文格式渲染器
import { XhsTextRenderer } from '@/components/xhs-text-renderer';

// 🔥 P1-3: 已持久化的卡片（从 OSS 加载）
interface PersistedCardUrl {
  cardId: string;
  cardIndex: number;
  cardType: string;  // 'cover' | 'point' | 'ending'
  url: string;       // 签名 URL
  title: string | null;
}

interface XiaohongshuPreviewProps {
  /** 任务ID，用于加载内容 */
  taskId?: string;
  /** 命令结果ID，用于查找同组的写作任务（当 taskId 不是写作任务时使用） */
  commandResultId?: string;
  /** 是否直接传入内容（不需要API加载） */
  content?: XiaohongshuContent | null;
  /** 触发按钮的变体 */
  variant?: 'default' | 'outline' | 'ghost';
  /** 按钮尺寸 */
  size?: 'default' | 'sm' | 'lg';
}

/**
 * 解析小红书 JSON 内容（包装共享模块函数，兼容 null 返回）
 */
function parseXhsContent(raw: string | object | null | undefined): XiaohongshuContent | null {
  if (!raw) return null;
  const result = parseXhsContentFromLib(raw);
  if (!result.title && !result.fullText && result.points.length === 0) {
    return null;
  }
  return {
    ...result,
    fullText: result.fullText,
  };
}

/** 🎨 数据库模板类型 */
interface DbCardStyleTemplate {
  id: string;
  name: string;
  description: string | null;
  templateType: string;
  presetTemplateId: string | null;
  templateConfig: XhsCardTemplate;
  sourceType: string;
  useCount: number;
}

/** 🎨 合并后的模板项（硬编码 + 数据库） */
interface MergedTemplateItem {
  id: string;
  name: string;
  description: string;
  template: XhsCardTemplate;
  source: 'preset' | 'db_system' | 'db_user';
  dbId?: string; // 数据库记录ID，用于编辑/删除
}

/** 🎨 卡片模板选择器组件（支持预设+数据库自定义模板） */
function CardTemplateSelector({
  selectedTemplateId,
  onTemplateChange,
}: {
  selectedTemplateId: string;
  onTemplateChange: (id: string) => void;
}) {
  const [dbTemplates, setDbTemplates] = useState<DbCardStyleTemplate[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editTemplate, setEditTemplate] = useState<DbCardStyleTemplate | null>(null);

  // 加载数据库模板
  useEffect(() => {
    let cancelled = false;
    const loadDbTemplates = async () => {
      setLoadingDb(true);
      try {
        const workspaceId = getCurrentWorkspaceId();
        const res = await fetch('/api/xhs-card-style-templates', {
          headers: { 'x-workspace-id': workspaceId },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setDbTemplates(data.data || []);
          }
        }
      } catch (err) {
        console.error('加载数据库卡片模板失败:', err);
      } finally {
        if (!cancelled) setLoadingDb(false);
      }
    };
    loadDbTemplates();
    return () => { cancelled = true; };
  }, []);

  // 合并模板列表：数据库系统模板 + 硬编码模板（去重）+ 数据库用户模板
  const mergedTemplates: MergedTemplateItem[] = (() => {
    const items: MergedTemplateItem[] = [];
    const seenIds = new Set<string>();

    // 1. 数据库系统模板（优先，如果有则替代硬编码）
    for (const db of dbTemplates) {
      if (db.templateType === 'system' && db.templateConfig) {
        seenIds.add(db.presetTemplateId || db.id);
        items.push({
          id: db.presetTemplateId || db.id,
          name: db.name,
          description: db.description || '',
          template: db.templateConfig as XhsCardTemplate,
          source: 'db_system',
          dbId: db.id,
        });
      }
    }

    // 2. 硬编码预设模板（去重：如果数据库已有同ID则跳过）
    for (const tpl of XHS_CARD_TEMPLATES) {
      if (!seenIds.has(tpl.id)) {
        items.push({
          id: tpl.id,
          name: tpl.name,
          description: tpl.description,
          template: tpl,
          source: 'preset',
        });
      }
    }

    // 3. 数据库用户自定义模板
    for (const db of dbTemplates) {
      if (db.templateType === 'user' && db.templateConfig) {
        items.push({
          id: db.id, // 用户模板使用数据库ID
          name: db.name,
          description: db.description || '',
          template: db.templateConfig as XhsCardTemplate,
          source: 'db_user',
          dbId: db.id,
        });
      }
    }

    return items;
  })();

  // 删除用户自定义模板
  const handleDeleteTemplate = async (dbId: string) => {
    try {
      const workspaceId = getCurrentWorkspaceId();
      const res = await fetch(`/api/xhs-card-style-templates/${dbId}`, {
        method: 'DELETE',
        headers: { 'x-workspace-id': workspaceId },
      });
      if (res.ok) {
        setDbTemplates(prev => prev.filter(t => t.id !== dbId));
        toast.success('模板已删除');
        // 如果删除的是当前选中的模板，切回默认
        if (selectedTemplateId === dbId) {
          onTemplateChange(DEFAULT_CARD_TEMPLATE_ID);
        }
      }
    } catch (err) {
      console.error('删除模板失败:', err);
      toast.error('删除失败');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span>🎨 卡片风格</span>
          <span className="text-xs text-gray-400">选择你喜欢的卡片样式</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-indigo-600 hover:text-indigo-700"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="w-3 h-3 mr-1" />
          自定义
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {loadingDb && (
          <div className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-400 px-2">
            <span className="animate-spin">⏳</span> 加载中...
          </div>
        )}
        {mergedTemplates.map((item) => {
          const isSelected = item.id === selectedTemplateId;
          const tpl = item.template;
          const colorScheme = tpl.cover.colors[0];
          const bgStyle = tpl.cover.bgType === 'gradient'
            ? { background: `linear-gradient(135deg, ${colorScheme.from}, ${colorScheme.to})` }
            : { backgroundColor: colorScheme.from };
          return (
            <div key={item.id} className="relative group flex-shrink-0">
              <button
                onClick={() => onTemplateChange(item.id)}
                className={`rounded-lg border-2 p-2 transition-all ${
                  isSelected
                    ? 'border-indigo-500 shadow-md scale-105'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                } ${item.source === 'db_user' ? 'border-dashed' : ''}`}
                title={item.description}
            >
              <div
                className="w-16 h-10 rounded flex items-center justify-center"
                style={bgStyle}
              >
                <span className="text-white text-[8px] font-bold drop-shadow-sm">
                  {tpl.name}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-gray-500 truncate w-16 text-center">
                {item.source === 'db_user' ? `${tpl.name} ✨` : tpl.name}
              </div>
              </button>
              {/* 用户自定义模板的操作按钮 */}
              {item.source === 'db_user' && (
                <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditTemplate(dbTemplates.find(t => t.id === item.dbId) || null); }}
                    className="w-4 h-4 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-indigo-50"
                    title="编辑模板"
                  >
                    <Pencil className="w-2 h-2 text-gray-500" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(item.dbId!); }}
                    className="w-4 h-4 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-red-50"
                    title="删除模板"
                  >
                    <Trash2 className="w-2 h-2 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {/* 创建自定义模板入口 */}
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex-shrink-0 rounded-lg border-2 border-dashed border-gray-300 p-2 transition-all hover:border-indigo-400 hover:bg-indigo-50/30"
          title="创建自定义样式"
        >
          <div className="w-16 h-10 rounded flex items-center justify-center bg-gray-50">
            <Plus className="w-4 h-4 text-gray-400" />
          </div>
          <div className="mt-1 text-[10px] text-gray-400 truncate w-16 text-center">
            自定义
          </div>
        </button>
      </div>

      {/* 创建/编辑自定义模板对话框 */}
      {(showCreateDialog || editTemplate) && (
        <CardStyleTemplateEditor
          mode={editTemplate ? 'edit' : 'create'}
          template={editTemplate || undefined}
          onClose={() => { setShowCreateDialog(false); setEditTemplate(null); }}
          onSaved={(saved) => {
            // 刷新列表
            setDbTemplates(prev => {
              const idx = prev.findIndex(t => t.id === saved.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
              }
              return [...prev, saved];
            });
            setShowCreateDialog(false);
            setEditTemplate(null);
          }}
        />
      )}
    </div>
  );
}

/** 🎨 卡片样式模板编辑器（创建/编辑自定义模板） */
function CardStyleTemplateEditor({
  mode,
  template,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  template?: DbCardStyleTemplate | null;
  onClose: () => void;
  onSaved: (saved: DbCardStyleTemplate) => void;
}) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [saving, setSaving] = useState(false);

  // 模板配置编辑（简化版：基于现有预设模板修改颜色）
  const [baseTemplateId, setBaseTemplateId] = useState(
    template?.presetTemplateId || DEFAULT_CARD_TEMPLATE_ID
  );
  const [coverFrom, setCoverFrom] = useState(
    template?.templateConfig?.cover?.colors?.[0]?.from || '#FF6B6B'
  );
  const [coverTo, setCoverTo] = useState(
    template?.templateConfig?.cover?.colors?.[0]?.to || '#FFA07A'
  );
  const [pointFrom, setPointFrom] = useState(
    template?.templateConfig?.point?.colors?.[0]?.from || '#667eea'
  );
  const [pointTo, setPointTo] = useState(
    template?.templateConfig?.point?.colors?.[0]?.to || '#764ba2'
  );
  const [conclusionFrom, setConclusionFrom] = useState(
    template?.templateConfig?.conclusion?.colors?.[0]?.from || '#667eea'
  );
  const [conclusionTo, setConclusionTo] = useState(
    template?.templateConfig?.conclusion?.colors?.[0]?.to || '#764ba2'
  );
  const [coverTextColor, setCoverTextColor] = useState(
    template?.templateConfig?.cover?.textColor || '#ffffff'
  );
  const [pointTextColor, setPointTextColor] = useState(
    template?.templateConfig?.point?.textColor || '#ffffff'
  );

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入模板名称');
      return;
    }
    setSaving(true);
    try {
      const workspaceId = getCurrentWorkspaceId();

      // 基于选择的预设模板构建完整配置
      const baseTemplate = getXhsCardTemplate(baseTemplateId) || XHS_CARD_TEMPLATES[0];
      const templateConfig: XhsCardTemplate = {
        ...baseTemplate,
        id: mode === 'edit' ? template!.templateConfig.id : `custom_${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        cover: {
          ...baseTemplate.cover,
          colors: [{ from: coverFrom, to: coverTo }, ...baseTemplate.cover.colors.slice(1)],
          textColor: coverTextColor,
        },
        point: {
          ...baseTemplate.point,
          colors: [{ from: pointFrom, to: pointTo }, ...baseTemplate.point.colors.slice(1)],
          textColor: pointTextColor,
        },
        conclusion: {
          ...baseTemplate.conclusion,
          colors: [{ from: conclusionFrom, to: conclusionTo }],
        },
      };

      const url = mode === 'edit' && template
        ? `/api/xhs-card-style-templates/${template.id}`
        : '/api/xhs-card-style-templates';
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          templateConfig,
          ...(mode === 'create' ? { sourceType: 'manual' } : {}),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || `保存失败 (HTTP ${res.status})`);
        return;
      }

      const data = await res.json();
      if (data.success) {
        toast.success(mode === 'edit' ? '模板已更新' : '模板已创建');
        onSaved(data.data);
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (err) {
      console.error('保存模板失败:', err);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {mode === 'edit' ? '编辑自定义模板' : '创建自定义模板'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {/* 基本信息 */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700">模板名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="如：我的品牌色"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="如：品牌主色调的渐变卡片"
            />
          </div>
        </div>

        {/* 基于预设模板 */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-1 block">基于预设模板</label>
          <div className="flex gap-2 flex-wrap">
            {XHS_CARD_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setBaseTemplateId(tpl.id)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                  baseTemplateId === tpl.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* 颜色自定义 */}
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-700">配色自定义</h4>

          {/* 封面颜色 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">封面渐变起始色</label>
              <div className="flex items-center gap-2">
                <input type="color" value={coverFrom} onChange={(e) => setCoverFrom(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                <input type="text" value={coverFrom} onChange={(e) => setCoverFrom(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">封面渐变结束色</label>
              <div className="flex items-center gap-2">
                <input type="color" value={coverTo} onChange={(e) => setCoverTo(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                <input type="text" value={coverTo} onChange={(e) => setCoverTo(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono" />
              </div>
            </div>
          </div>

          {/* 要点颜色 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">要点渐变起始色</label>
              <div className="flex items-center gap-2">
                <input type="color" value={pointFrom} onChange={(e) => setPointFrom(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                <input type="text" value={pointFrom} onChange={(e) => setPointFrom(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">要点渐变结束色</label>
              <div className="flex items-center gap-2">
                <input type="color" value={pointTo} onChange={(e) => setPointTo(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                <input type="text" value={pointTo} onChange={(e) => setPointTo(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono" />
              </div>
            </div>
          </div>

          {/* 结尾颜色 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">结尾渐变起始色</label>
              <div className="flex items-center gap-2">
                <input type="color" value={conclusionFrom} onChange={(e) => setConclusionFrom(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                <input type="text" value={conclusionFrom} onChange={(e) => setConclusionFrom(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">结尾渐变结束色</label>
              <div className="flex items-center gap-2">
                <input type="color" value={conclusionTo} onChange={(e) => setConclusionTo(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                <input type="text" value={conclusionTo} onChange={(e) => setConclusionTo(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono" />
              </div>
            </div>
          </div>

          {/* 文字颜色 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">封面文字色</label>
              <div className="flex items-center gap-2">
                <input type="color" value={coverTextColor} onChange={(e) => setCoverTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                <input type="text" value={coverTextColor} onChange={(e) => setCoverTextColor(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">要点文字色</label>
              <div className="flex items-center gap-2">
                <input type="color" value={pointTextColor} onChange={(e) => setPointTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                <input type="text" value={pointTextColor} onChange={(e) => setPointTextColor(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs font-mono" />
              </div>
            </div>
          </div>

          {/* 预览 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">预览效果</label>
            <div className="flex gap-2">
              <div
                className="w-24 h-14 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${coverFrom}, ${coverTo})` }}
              >
                <span style={{ color: coverTextColor }} className="text-xs font-bold">封面</span>
              </div>
              <div
                className="w-24 h-14 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${pointFrom}, ${pointTo})` }}
              >
                <span style={{ color: pointTextColor }} className="text-xs font-bold">要点</span>
              </div>
              <div
                className="w-24 h-14 rounded-lg flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${conclusionFrom}, ${conclusionTo})` }}
              >
                <span style={{ color: '#ffffff' }} className="text-xs font-bold">结尾</span>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? '保存中...' : mode === 'edit' ? '更新模板' : '创建模板'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function XiaohongshuPreview({
  taskId,
  commandResultId,
  content: externalContent,
  variant = 'outline',
  size = 'sm',
}: XiaohongshuPreviewProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<XiaohongshuContent | null>(externalContent || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // 🔥 P1-3: 已持久化的卡片图片（从 OSS 加载）
  const [persistedCards, setPersistedCards] = useState<PersistedCardUrl[]>([]);
  const [loadingPersistedCards, setLoadingPersistedCards] = useState(false);
  
  // 🔥 翻页状态
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // 🔥 正文展开/收起状态
  const [isFullTextExpanded, setIsFullTextExpanded] = useState(false);
  
  // 🔥 P0 修复：使用 ref 防止重复加载
  const loadingRef = useRef(false);
  
  // 计算总卡片数
  const totalCards = content ? (1 + (content.points?.length || 0) + (content.conclusion ? 1 : 0)) : 0;

  // 🔥 点赞/收藏状态（仅UI展示）
  const [isLiked, setIsLiked] = useState(false);
  const [isCollected, setIsCollected] = useState(false);

  // 🎨 卡片模板选择状态（用户偏好持久化到 localStorage）
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_CARD_TEMPLATE_ID;
    try {
      const saved = localStorage.getItem(TEMPLATE_PREF_KEY);
      if (saved) return saved; // 不再验证，数据库模板ID也可能被保存
    } catch {}
    return DEFAULT_CARD_TEMPLATE_ID;
  });

  // 数据库自定义模板（用于 selectedTemplate 查找）
  const [dbTemplatesCache, setDbTemplatesCache] = useState<DbCardStyleTemplate[]>([]);

  // 加载数据库模板（用于 selectedTemplate 查找）
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const workspaceId = getCurrentWorkspaceId();
        const res = await fetch('/api/xhs-card-style-templates', {
          headers: { 'x-workspace-id': workspaceId },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.success) setDbTemplatesCache(data.data || []);
        }
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // 解析选中的模板（优先硬编码，其次数据库）
  const selectedTemplate = (() => {
    // 1. 先查硬编码
    const hardcoded = getXhsCardTemplate(selectedTemplateId);
    if (hardcoded) return hardcoded;
    // 2. 再查数据库
    const dbTpl = dbTemplatesCache.find(t => t.id === selectedTemplateId && t.templateConfig);
    if (dbTpl) return dbTpl.templateConfig as XhsCardTemplate;
    // 3. 兜底
    return getXhsCardTemplate(DEFAULT_CARD_TEMPLATE_ID) || XHS_CARD_TEMPLATES[0];
  })();

  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    try { localStorage.setItem(TEMPLATE_PREF_KEY, templateId); } catch {}
  }, []);

  // 当外部内容变化时同步
  useEffect(() => {
    if (externalContent) {
      setContent(externalContent);
    }
  }, [externalContent]);

  // 对话框打开时加载内容（仅在无外部内容时）
  // 🔥 修复：使用 ref 防止重复加载，移除 content 依赖避免循环
  useEffect(() => {
    if (open && !externalContent && (taskId || commandResultId) && !content && !loadingRef.current) {
      loadingRef.current = true;
      let cancelled = false;
      const loadContent = async () => {
        setLoading(true);
        try {
          const workspaceId = getCurrentWorkspaceId();
          
          // 🔥 如果只有 commandResultId，先查找写作任务
          let actualTaskId = taskId;
          if (!actualTaskId && commandResultId) {
            const listResponse = await fetch(`/api/agents/tasks/writing-task?commandResultId=${commandResultId}&executor=insurance-xiaohongshu`, {
              headers: { 'x-workspace-id': workspaceId },
            });
            if (listResponse.ok) {
              const listData = await listResponse.json();
              const writingTask = listData.tasks?.[0];
              if (writingTask) {
                actualTaskId = writingTask.id;
              }
            }
          }
          
          if (!actualTaskId) {
            throw new Error('找不到写作任务');
          }
          
          const response = await fetch(`/api/agents/tasks/${actualTaskId}/detail`, {
            headers: {
              'x-workspace-id': workspaceId,
            },
          });
          
          // 🔥 P1 修复：检查 HTTP 状态码
          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
          }
          
          const data = await response.json();
          if (cancelled) return;
          if (data.success) {
            const task = data.data?.task;
            const stepHistory = data.data?.stepHistory || [];

            // 🔥🔥🔥 【架构改造】优先使用 platformRenderData
            const platformRenderData = task?.platformRenderData;
            if (platformRenderData && platformRenderData.platform === 'xiaohongshu') {
              console.log('[XiaohongshuPreview] ✅ 使用 platformRenderData:', {
                cardCountMode: platformRenderData.cardCountMode,
                cardsCount: platformRenderData.cards?.length || 0,
              });
              
              // 从 platformRenderData 构建 XiaohongshuContent
              // 🔥🔥🔥 P0 修复：按卡片 type 字段安全拆分，避免字段映射错误
              // XhsCoverCard: { type: 'cover', title, subtitle? }   — 无 content
              // XhsPointCard: { type: 'point', title, content }     — 有 content
              // XhsEndingCard: { type: 'ending', conclusion, tags? } — 无 content/title
              const cards = platformRenderData.cards || [];
              const coverCard = cards.find(c => (c as { type?: string }).type === 'cover');
              const pointCards = cards.filter(c => (c as { type?: string }).type === 'point');
              const endingCard = cards.find(c => (c as { type?: string }).type === 'ending');
              
              const xhsContent: XiaohongshuContent = {
                title: platformRenderData.articleTitle || (coverCard as { title?: string } | undefined)?.title || '',
                articleTitle: platformRenderData.articleTitle,
                fullText: platformRenderData.textContent || '',
                content: platformRenderData.textContent || '',
                points: pointCards.map(card => ({
                  title: (card as { title?: string }).title || '',
                  content: (card as { content?: string }).content || '',
                })),
                // 🔥 P0 修复：XhsCoverCard 的引言字段是 subtitle（不是 content）
                intro: (coverCard as { subtitle?: string })?.subtitle,
                // 🔥 P0 修复：XhsEndingCard 的总结字段是 conclusion（不是 content）
                conclusion: (endingCard as { conclusion?: string })?.conclusion,
                // 🔥 P0 修复：tags 来自结尾卡（XhsPlatformRenderData 无顶层 tags 字段）
                tags: (endingCard as { tags?: string[] })?.tags || [],
              };
              
              setContent(xhsContent);
              
              // 🔥 P1-3: 尝试加载已持久化的卡片图片（从 OSS）
              if (actualTaskId) {
                setLoadingPersistedCards(true);
                try {
                  const cardsResponse = await fetch(
                    `/api/xiaohongshu/generate-cards?subTaskId=${actualTaskId}`,
                    { headers: { 'x-workspace-id': workspaceId } }
                  );
                  if (cardsResponse.ok) {
                    const cardsData = await cardsResponse.json();
                    if (cardsData.success && cardsData.cards?.length > 0) {
                      setPersistedCards(cardsData.cards);
                      console.log('[XiaohongshuPreview] 已加载持久化卡片:', cardsData.cards.length, '张');
                    }
                  }
                } catch (cardsErr) {
                  console.warn('[XiaohongshuPreview] 加载持久化卡片失败:', cardsErr);
                } finally {
                  setLoadingPersistedCards(false);
                }
              }
              
              loadingRef.current = false;
              setLoading(false);
              return;
            }

            // 兜底：从 stepHistory / resultData 提取内容（旧逻辑）
            let rawContent: string | object | null = null;

            for (const step of stepHistory) {
              const interactContent = step.interactContent;
              if (interactContent?.executorOutput?.output) {
                // output 可能是字符串或已解析的对象
                rawContent = typeof interactContent.executorOutput.output === 'object'
                  ? interactContent.executorOutput.output
                  : String(interactContent.executorOutput.output);
                break;
              }
              if (interactContent?.resultSummary) {
                rawContent = interactContent.resultSummary;
                break;
              }
            }

            if (!rawContent && task?.resultData) {
              const rd = task.resultData;
              if (rd.executorOutput?.output) {
                rawContent = typeof rd.executorOutput.output === 'object'
                  ? rd.executorOutput.output
                  : String(rd.executorOutput.output);
              } else if (rd.result) {
                rawContent = typeof rd.result === 'object' ? rd.result : String(rd.result);
              } else if (rd.executorOutput?.structuredResult?.resultContent) {
                // 🔥 信封格式兜底：从 structuredResult.resultContent 提取
                rawContent = rd.executorOutput.structuredResult.resultContent;
              }
            }

            // 🔥 最终兜底：从 task.resultData 直接提取信封格式的 result.content
            if (!rawContent && task?.resultData?.result?.content) {
              rawContent = task.resultData.result;
            }

            const parsed = parseXhsContent(rawContent);
            if (parsed) {
              setContent(parsed);
              
              // 🔥 P1-3: 尝试加载已持久化的卡片图片（从 OSS）
              if (actualTaskId) {
                setLoadingPersistedCards(true);
                try {
                  const cardsResponse = await fetch(
                    `/api/xiaohongshu/generate-cards?subTaskId=${actualTaskId}`,
                    { headers: { 'x-workspace-id': workspaceId } }
                  );
                  if (cardsResponse.ok) {
                    const cardsData = await cardsResponse.json();
                    if (cardsData.success && cardsData.cards?.length > 0) {
                      setPersistedCards(cardsData.cards);
                      console.log('[XiaohongshuPreview] 已加载持久化卡片:', cardsData.cards.length, '张');
                    }
                  }
                } catch (cardsErr) {
                  console.warn('[XiaohongshuPreview] 加载持久化卡片失败:', cardsErr);
                  // 不影响主流程
                } finally {
                  setLoadingPersistedCards(false);
                }
              }
            } else {
              toast.error('无法解析小红书图文内容');
            }
          }
        } catch (error) {
          if (!cancelled) {
            console.error('加载小红书内容失败:', error);
            toast.error('加载内容失败');
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
            loadingRef.current = false;
          }
        }
      };
      loadContent();
      return () => { 
        cancelled = true; 
        loadingRef.current = false;
      };
    }
  }, [open, taskId, externalContent]);  // 🔥 修复：移除 content 依赖，使用 ref 防重复

  const handleCopyFullText = () => {
    // 兼容新信封格式 content 和旧格式 fullText
    const textToCopy = (content?.content || content?.fullText || '').trim();
    if (!textToCopy) {
      toast.error('没有可复制的正文内容');
      return;
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      toast.success('正文已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyJson = () => {
    if (!content) return;
    navigator.clipboard.writeText(JSON.stringify(content, null, 2)).then(() => {
      toast.success('JSON 已复制到剪贴板');
    });
  };
  
  // 🔥 翻页功能
  const goToPage = useCallback((page: number) => {
    if (page >= 0 && page < totalCards) {
      setCurrentPage(page);
    }
  }, [totalCards]);
  
  const goToNextPage = useCallback(() => {
    if (currentPage < totalCards - 1) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalCards]);
  
  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);
  
  // 触摸滑动处理
  const minSwipeDistance = 50;
  
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      goToNextPage();
    } else if (isRightSwipe) {
      goToPrevPage();
    }
  };
  
  // 重置页码当内容变化时
  useEffect(() => {
    setCurrentPage(0);
  }, [content?.title]);

  // 🔥 修复：关闭对话框时重置状态，确保下次打开时重新加载
  useEffect(() => {
    if (!open) {
      if (!externalContent) {
        setContent(null);
      }
      setCurrentPage(0);
      setPersistedCards([]);
      loadingRef.current = false;
    }
  }, [open, externalContent]);

  // 如果没有内容，不渲染
  if (!content && !open) {
    return (
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Eye className="w-4 h-4 mr-1" />
        预览
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-1">
          <Eye className="w-4 h-4" />
          预览
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">📕 小红书图文预览</span>
            {content?.articleTitle && (
              <Badge variant="secondary" className="text-xs">
                {content.articleTitle}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription asChild>
            <VisuallyHidden.Root>小红书图文内容预览</VisuallyHidden.Root>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
            <span className="ml-3 text-gray-500">加载中...</span>
          </div>
        ) : content ? (
          <div className="space-y-6">
            {/* 🎨 卡片模板选择器 */}
            <CardTemplateSelector
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={handleTemplateChange}
            />
            {/* 🔥 小红书风格模拟器 */}
            <div className="flex justify-center">
              <div className="w-[375px] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
                
                {/* 顶部状态栏 */}
                <div className="bg-white px-5 py-2 flex items-center justify-between text-xs text-gray-600">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <span>📶</span>
                    <span>🔋</span>
                  </div>
                </div>
                
                {/* 导航栏 */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
                  <button className="text-gray-600 text-lg">←</button>
                  <span className="font-semibold text-gray-800">笔记详情</span>
                  <button className="text-gray-600 text-lg">⋯</button>
                </div>
                
                {/* 主内容区：图片+右侧操作栏 */}
                <div className="relative bg-black">
                  
                  {/* 🔥 图片卡片区域（竖版比例 3:4） */}
                  {totalCards > 0 ? (
                    <div 
                      className="relative aspect-[3/4] overflow-hidden"
                      onTouchStart={onTouchStart}
                      onTouchMove={onTouchMove}
                      onTouchEnd={onTouchEnd}
                    >
                      {/* 卡片滑动容器 */}
                      <div
                        className="flex h-full transition-transform duration-300 ease-out"
                        style={{ 
                          // 🔥 修复：基于每张卡片在容器中的占比计算位移
                          // 每张卡片占容器的 (100/totalCards)%，所以翻页需要移动这个比例
                          transform: `translateX(-${currentPage * (100 / totalCards)}%)`,
                          width: `${totalCards * 100}%`
                        }}
                      >
                        {/* 封面卡 */}
                        <div className="flex-shrink-0 h-full flex items-center justify-center p-4" style={{ width: `${100 / totalCards}%` }}>
                          <div
                            className="w-full h-full rounded-2xl flex flex-col justify-center px-5 py-5 shadow-lg overflow-y-auto"
                            style={getCardStyle(selectedTemplate.cover)}
                          >
                            {selectedTemplate.cover.emoji && (
                              <div className="text-xs opacity-70 mb-2 font-medium">{selectedTemplate.cover.emoji}</div>
                            )}
                            <div className="text-lg font-bold leading-tight mb-2">{content.title}</div>
                            {content.intro && (
                              <div className="text-sm opacity-90 leading-relaxed">{content.intro}</div>
                            )}
                          </div>
                        </div>
                        
                        {/* 要点卡片 */}
                        {content.points?.map((point, idx) => {
                          const pointStyle = getPointCardStyle(selectedTemplate.point, idx);
                          return (
                            <div key={idx} className="flex-shrink-0 h-full flex items-center justify-center p-4" style={{ width: `${100 / totalCards}%` }}>
                              <div
                                className="w-full h-full rounded-2xl flex flex-col px-5 py-5 shadow-lg overflow-y-auto"
                                style={pointStyle}
                              >
                                <div className="text-xs opacity-70 mb-2 font-medium">{selectedTemplate.point.emoji} 要点 {idx + 1}</div>
                                <div className="text-lg font-bold leading-tight mb-2">{point.title}</div>
                                {point.content && (
                                  <div className="text-sm opacity-90 leading-relaxed flex-1">{point.content}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* 结尾卡 */}
                        {content.conclusion && (
                          <div className="flex-shrink-0 h-full flex items-center justify-center p-4" style={{ width: `${100 / totalCards}%` }}>
                            <div
                              className="w-full h-full rounded-2xl flex flex-col px-5 py-5 shadow-lg overflow-y-auto"
                              style={getCardStyle(selectedTemplate.conclusion)}
                            >
                              <div className="text-xs opacity-70 mb-2 font-medium">{selectedTemplate.conclusion.emoji}</div>
                              <div className="text-lg font-bold leading-tight mb-2">{content.conclusion}</div>
                              {content.tags && content.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {content.tags.map((tag, tIdx) => (
                                    <span key={tIdx} className="text-xs bg-white/20 px-2.5 py-1 rounded-full">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* 左右翻页按钮 */}
                      {totalCards > 1 && (
                        <>
                          <button
                            onClick={goToPrevPage}
                            disabled={currentPage === 0}
                            aria-label="上一页"
                            className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center transition-all ${
                              currentPage === 0 ? 'opacity-20' : 'hover:bg-black/60'
                            }`}
                          >
                            <ChevronLeft className="w-5 h-5 text-white" aria-hidden="true" />
                          </button>
                          <button
                            onClick={goToNextPage}
                            disabled={currentPage === totalCards - 1}
                            aria-label="下一页"
                            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center transition-all ${
                              currentPage === totalCards - 1 ? 'opacity-20' : 'hover:bg-black/60'
                            }`}
                          >
                            <ChevronRight className="w-5 h-5 text-white" aria-hidden="true" />
                          </button>
                        </>
                      )}
                      
                      {/* 页码指示器 */}
                      {totalCards > 1 && (
                        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
                          {Array.from({ length: totalCards }).map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => goToPage(idx)}
                              className={`h-1 rounded-full transition-all ${
                                idx === currentPage ? 'bg-white w-4' : 'bg-white/50 w-1'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* 页码 */}
                      {totalCards > 1 && (
                        <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          {currentPage + 1}/{totalCards}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-[3/4] flex items-center justify-center text-gray-400">
                      暂无内容
                    </div>
                  )}
                  
                  {/* 🔥 右侧悬浮操作栏（小红书特色） */}
                  <div className="absolute right-3 bottom-16 flex flex-col items-center gap-5">
                    {/* 头像 */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                        AI
                      </div>
                    </div>
                    
                    {/* 点赞 */}
                    <button 
                      onClick={() => setIsLiked(!isLiked)}
                      className="flex flex-col items-center gap-1"
                      aria-label={isLiked ? '取消点赞' : '点赞'}
                    >
                      <div className={`w-10 h-10 rounded-full ${isLiked ? 'bg-red-500' : 'bg-white/20'} flex items-center justify-center transition-colors`}>
                        <span className="text-lg" aria-hidden="true">{isLiked ? '❤️' : '🤍'}</span>
                      </div>
                    </button>
                    
                    {/* 收藏 */}
                    <button 
                      onClick={() => setIsCollected(!isCollected)}
                      className="flex flex-col items-center gap-1"
                      aria-label={isCollected ? '取消收藏' : '收藏'}
                    >
                      <div className={`w-10 h-10 rounded-full ${isCollected ? 'bg-yellow-500' : 'bg-white/20'} flex items-center justify-center transition-colors`}>
                        <span className="text-lg" aria-hidden="true">{isCollected ? '⭐' : '☆'}</span>
                      </div>
                    </button>
                    
                    {/* 评论 */}
                    <button className="flex flex-col items-center gap-1" aria-label="评论">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-lg" aria-hidden="true">💬</span>
                      </div>
                    </button>
                    
                    {/* 分享 */}
                    <button className="flex flex-col items-center gap-1" aria-label="分享">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-lg" aria-hidden="true">↗️</span>
                      </div>
                    </button>
                  </div>
                </div>
                
                {/* 🔥 底部正文区 */}
                <div className="bg-white p-4">
                  {/* 标题 */}
                  <h2 className="text-base font-bold text-gray-900 mb-2 leading-snug">
                    {content.title || '小红书笔记'}
                  </h2>
                  
                  {/* 正文 - 使用小红书真实格式渲染器 */}
                  {(content.content || content.fullText) && (
                    <XhsTextRenderer
                      content={content.content || content.fullText || ''}
                      collapsed={!isFullTextExpanded}
                      maxLines={3}
                      onToggleCollapse={() => setIsFullTextExpanded(!isFullTextExpanded)}
                      className="mb-2"
                    />
                  )}
                  
                  {/* 标签 */}
                  {content.tags && content.tags.length > 0 && (
                    <div className="flex items-center gap-2 mb-3 flex-wrap mt-2">
                      {content.tags.map((tag, idx) => (
                        <span key={idx} className="text-xs text-blue-500 font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* 发布信息 */}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>IP属地：中国</span>
                    <span>编辑于 {getCurrentBeijingTime().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
                  </div>
                </div>
                
                {/* 底部评论入口 */}
                <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-400">
                    说点什么...
                  </div>
                  <button className="text-gray-400 text-xl">😊</button>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {/* 🔥 P1-3: 如果有已持久化的卡片，优先展示"查看已生成卡片"按钮 */}
              {persistedCards.length > 0 ? (
                <>
                  <Link href={`/xiaohongshu-card?taskId=${taskId}`} className="inline-flex">
                    <Button size="sm" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                      <ImageIcon className="w-4 h-4 mr-1" />
                      查看已生成卡片 ({persistedCards.length}张)
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={handleCopyFullText}>
                    {copied ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copied ? '已复制' : '复制正文'}
                  </Button>
                </>
              ) : (
                <>
                  {(content.content || content.fullText) && (
                    <Button variant="outline" size="sm" onClick={handleCopyFullText}>
                      {copied ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      {copied ? '已复制' : '复制正文'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleCopyJson}>
                    <Copy className="w-4 h-4 mr-1" />
                    复制 JSON
                  </Button>
                  <Link href={`/xiaohongshu-card?taskId=${taskId}`} className="inline-flex">
                    <Button size="sm" className="bg-gradient-to-r from-red-500 to-pink-500 text-white">
                      <Download className="w-4 h-4 mr-1" />
                      生成卡片图
                    </Button>
                  </Link>
                </>
              )}
            </div>
            
            {/* 🔥 P1-3: 如果有已持久化的卡片，显示提示 */}
            {persistedCards.length > 0 && (
              <p className="text-xs text-green-600 text-center mt-2">
                ✅ 已生成 {persistedCards.length} 张卡片图片，点击上方按钮查看和下载
              </p>
            )}
            
            {/* 加载持久化卡片中的提示 */}
            {loadingPersistedCards && (
              <p className="text-xs text-gray-400 text-center mt-2">
                正在检查已生成的卡片...
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            暂无可预览的内容
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
