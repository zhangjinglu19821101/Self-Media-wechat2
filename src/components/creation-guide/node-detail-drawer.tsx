/**
 * 节点详情面板组件（V2 重构版）
 * 
 * 展示选中节点的完整信息，包括：
 * - 基础字段：标题、执行者、描述
 * - 自动拆分信息：orderIndex、structureName、structureDetail
 * - 创作引导配置：creationGuideConfig
 * - 操作按钮：上移、下移、删除
 */

'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trash2,
  MoveUp,
  MoveDown,
  X,
  ChevronDown,
  AlertCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import type { SubTask } from './flow-diagram-types';

export interface NodeDetailPanelProps {
  /** 当前节点 */
  task: SubTask | null;
  /** 节点索引 */
  nodeIndex: number;
  /** 总节点数 */
  totalNodes: number;
  /** 平台标签 */
  platformLabel: string;
  /** 更新子任务 */
  onUpdateTask: (taskId: string, field: keyof SubTask, value: SubTask[keyof SubTask]) => void;
  /** 上移子任务 */
  onMoveUp: (taskId: string) => void;
  /** 下移子任务 */
  onMoveDown: (taskId: string) => void;
  /** 删除子任务 */
  onDelete: (taskId: string) => void;
  /** 关闭面板 */
  onClose: () => void;
  /** 是否有全局创作引导 */
  hasGlobalCreationGuide?: boolean;
  /** 可选的 Agent 列表 */
  agents?: Array<{ id: string; name: string }>;
}

// 预设描述配置（按执行者分组）
const PRESET_DESCRIPTIONS: Record<string, string[]> = {
  'B': [
    '将任务拆解为多个可执行的子任务',
    '判断任务完成状态，决定是否需要用户确认',
    '分析任务合规性',
  ],
  'insurance-d': [
    '根据创作大纲生成微信公众号文章',
    '撰写保险相关的专业分析文章',
    '生成产品对比分析文章',
  ],
  'insurance-xiaohongshu': [
    '根据创作大纲生成小红书图文内容',
    '撰写种草笔记',
    '生成图文并茂的小红书内容',
  ],
  'insurance-zhihu': [
    '根据创作大纲生成知乎回答/文章',
    '撰写专业深度的知乎内容',
  ],
  'insurance-toutiao': [
    '根据创作大纲生成头条文章',
    '撰写热点解读文章',
  ],
  'default': [
    '执行指定任务',
    '处理用户指令',
    '完成内容创作',
  ],
};

export function NodeDetailPanel({
  task,
  nodeIndex,
  totalNodes,
  platformLabel,
  onUpdateTask,
  onMoveUp,
  onMoveDown,
  onDelete,
  onClose,
  hasGlobalCreationGuide = false,
  agents = [],
}: NodeDetailPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  if (!task) {
    return (
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 text-center text-slate-400">
        请选择一个节点查看详情
      </div>
    );
  }

  // 获取预设描述
  const presetDescriptions = PRESET_DESCRIPTIONS[task.executor] || PRESET_DESCRIPTIONS['default'];

  // 处理字段更新
  const handleFieldChange = (field: keyof SubTask, value: SubTask[keyof SubTask]) => {
    onUpdateTask(task.id, field, value);
  };

  // 上移
  const handleMoveUp = () => {
    if (nodeIndex === 0) {
      toast.warning('已经是第一个节点');
      return;
    }
    onMoveUp(task.id);
    toast.success('已上移');
  };

  // 下移
  const handleMoveDown = () => {
    if (nodeIndex >= totalNodes - 1) {
      toast.warning('已经是最后一个节点');
      return;
    }
    onMoveDown(task.id);
    toast.success('已下移');
  };

  // 删除
  const handleDelete = () => {
    if (totalNodes <= 1) {
      toast.warning('流程至少需要保留一个节点');
      return;
    }
    // 🔥 禁止删除第一个节点：第一个节点是分析节点，删除后写作Agent将缺少前序输入
    if (nodeIndex === 0) {
      toast.warning('第一个节点不可删除，它是后续节点的必要输入');
      return;
    }
    onDelete(task.id);
    toast.success('节点已删除');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg">
            <span className="text-xs font-semibold text-blue-600">步骤</span>
            <span className="text-sm font-bold text-blue-700">{nodeIndex + 1}</span>
          </div>
          <h3 className="font-semibold text-slate-900 max-w-[200px] truncate" title={task.title}>
            {task.title || '未命名节点'}
          </h3>
          <Badge variant="outline" className="text-xs border-slate-200 text-slate-500">
            {platformLabel}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭详情面板"
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
        </button>
      </div>

      {/* 表单内容 */}
      <div className="p-5 space-y-5">
        {/* 基本信息卡片 */}
        <div className="space-y-4">
          {/* 标题字段 */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              标题
              <span className="text-red-400">*</span>
            </Label>
            <Input
              value={task.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="例如：大纲生成、文章创作..."
              className="h-10 border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
            />
          </div>

          {/* 执行者字段 */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              执行者
              <span className="text-xs font-normal text-slate-400">(Agent)</span>
            </Label>
            <Select
              value={task.executor}
              onValueChange={(value) => handleFieldChange('executor', value)}
            >
              <SelectTrigger className="h-10 border-slate-200 focus:ring-2 focus:ring-blue-100">
                <SelectValue placeholder="选择执行Agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      {agent.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 描述字段 */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">任务描述</Label>
            <div className="space-y-2">
              {/* 预设描述快速选择 */}
              <div className="flex flex-wrap gap-2">
                {presetDescriptions.slice(0, 3).map((desc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleFieldChange('description', desc)}
                    className={`
                      text-xs px-3 py-1.5 rounded-full border transition-all duration-200
                      ${task.description === desc
                        ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                      }
                    `}
                  >
                    {desc.slice(0, 12)}...
                  </button>
                ))}
              </div>
              <Textarea
                value={task.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="详细描述此步骤的任务内容..."
                rows={2}
                className="resize-none text-sm border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>
          </div>
        </div>

        {/* 操作按钮区域 */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-slate-700">排序操作</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMoveUp}
                disabled={nodeIndex === 0}
                className="h-9 px-3 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <MoveUp className="w-4 h-4 mr-1.5" />
                上移
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMoveDown}
                disabled={nodeIndex >= totalNodes - 1}
                className="h-9 px-3 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <MoveDown className="w-4 h-4 mr-1.5" />
                下移
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={totalNodes <= 1 || nodeIndex === 0}
                className={`h-9 px-3 transition-colors ${
                  nodeIndex === 0
                    ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                    : 'border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300'
                }`}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                删除
              </Button>
            </div>
          </div>
        </div>

        {/* 创作引导配置 */}
        {hasGlobalCreationGuide && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <Checkbox
                id="inherit-guide"
                checked={task.creationGuideConfig?.inheritFromGlobal ?? true}
                onCheckedChange={(checked) =>
                  handleFieldChange('creationGuideConfig', { inheritFromGlobal: checked === true })
                }
                className="border-slate-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <Label htmlFor="inherit-guide" className="text-sm text-slate-600 cursor-pointer">
                继承全局创作引导配置
              </Label>
            </div>
          </div>
        )}

        {/* 高级选项（自动拆分信息） */}
        <div className="border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            <div className={`
              p-1 rounded transition-transform duration-200
              ${showAdvanced ? 'rotate-180' : ''}
            `}>
              <ChevronDown className="w-4 h-4" />
            </div>
            <span className="font-medium">自动拆分信息</span>
            <span className="text-xs text-slate-400">
              ({['orderIndex', 'structureName', 'userOpinion'].filter(k => (task as Record<string, unknown>)[k]).length} 项已填充)
            </span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 pl-2 border-l-2 border-slate-100">
              {/* 序号 */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  执行序号
                  <Info className="w-3 h-3 text-slate-300" />
                </Label>
                <Input
                  value={task.orderIndex}
                  onChange={(e) => handleFieldChange('orderIndex', parseInt(e.target.value) || 0)}
                  type="number"
                  min={0}
                  className="h-9 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>

              {/* 结构名称 */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">结构名称</Label>
                <Input
                  value={task.structureName || ''}
                  onChange={(e) => handleFieldChange('structureName', e.target.value)}
                  placeholder="AI自动拆分时填充的结构名称"
                  className="h-9 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>

              {/* 结构详情 */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">结构详情</Label>
                <Textarea
                  value={task.structureDetail || ''}
                  onChange={(e) => handleFieldChange('structureDetail', e.target.value)}
                  placeholder="AI自动拆分时填充的详细结构信息..."
                  rows={2}
                  className="resize-none text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>

              {/* 用户观点 */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">用户观点</Label>
                <Textarea
                  value={task.userOpinion || ''}
                  onChange={(e) => handleFieldChange('userOpinion', e.target.value)}
                  placeholder="用户在创作引导中填写的核心观点..."
                  rows={2}
                  className="resize-none text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>

              {/* 素材 ID */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500">关联素材</Label>
                <Input
                  value={task.materialIds?.join(', ') || ''}
                  onChange={(e) => handleFieldChange('materialIds', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="素材ID，逗号分隔"
                  className="h-9 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
                />
              </div>

              {/* 只读信息组 */}
              <div className="pt-2 border-t border-slate-100/60 space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>以下信息由系统维护，不可修改</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">账号 ID</Label>
                    <Input
                      value={task.accountId || '-'}
                      readOnly
                      className="h-8 text-xs bg-slate-100/80 text-slate-500 border-slate-200/60 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-400">平台</Label>
                    <Input
                      value={task.platformLabel || task.platform || '-'}
                      readOnly
                      className="h-8 text-xs bg-slate-100/80 text-slate-500 border-slate-200/60 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NodeDetailPanel;
