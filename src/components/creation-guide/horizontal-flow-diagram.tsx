/**
 * 横向流程图组件（V2 重构版）
 * 
 * 展示平台创作步骤的横向流程图，支持：
 * - 蓝色方形图标节点 + 箭头连接 + 标签
 * - 点击节点选中高亮联动
 * - 下方详情面板展示完整字段（包括自动拆分信息）
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  FileText,
  CheckCircle,
  Play,
  GitBranch,
  Wrench,
  BookOpen,
  Brain,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import type { SubTask } from './flow-diagram-types';

export interface HorizontalFlowDiagramProps {
  /** 子任务列表 */
  subTasks: SubTask[];
  /** 平台标签 */
  platformLabel: string;
  /** 平台标识 */
  platform: string;
  /** 账号名 */
  accountName: string;
  /** 当前选中的节点 ID */
  selectedNodeId: string | null;
  /** 点击节点回调 */
  onNodeSelect: (taskId: string) => void;
  /** 添加子任务 */
  onAdd: () => void;
}

// 节点图标映射（语义化图标）
const EXECUTOR_ICONS: Record<string, React.ReactNode> = {
  // Agent B - 业务控制器：使用 GitBranch 表示任务拆解/流程控制
  'B': <GitBranch className="w-6 h-6 text-white" />,
  // Agent T - 技术专家：使用 Wrench 表示技术执行
  'T': <Wrench className="w-6 h-6 text-white" />,
  // 微信公众号：使用 FileText 表示长文章
  'insurance-d': <FileText className="w-6 h-6 text-white" />,
  // 小红书：使用 BookOpen 表示图文/笔记
  'insurance-xiaohongshu': <BookOpen className="w-6 h-6 text-white" />,
  // 知乎：使用 Brain 表示知识分享/深度思考
  'insurance-zhihu': <Brain className="w-6 h-6 text-white" />,
  // 头条：使用 TrendingUp 表示热点/推荐
  'insurance-toutiao': <TrendingUp className="w-6 h-6 text-white" />,
  // 抖音：使用 Play 表示短视频
  'insurance-douyin': <Play className="w-6 h-6 text-white" />,
  // 微博：使用 Sparkles 表示社交/热点
  'insurance-weibo': <Sparkles className="w-6 h-6 text-white" />,
  'default': <CheckCircle className="w-6 h-6 text-white" />,
};

// 箭头标签映射（语义化流转标签）
const ARROW_LABELS: Record<string, string> = {
  'B': '拆解',
  'insurance-d': '写作',
  'insurance-xiaohongshu': '种草',
  'insurance-zhihu': '深度',
  'insurance-toutiao': '分发',
  'insurance-douyin': '视频',
  'insurance-weibo': '社交',
  'T': '技术',
  'default': '流转',
};

// 节点品牌色配置（平台/Agent 识别色）
const EXECUTOR_COLORS: Record<string, { bg: string; hover: string; ring: string }> = {
  // Agent B - 蓝色系（协调者）
  'B': { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', ring: 'ring-blue-200' },
  // Agent T - 紫色系（技术）
  'T': { bg: 'bg-violet-500', hover: 'hover:bg-violet-600', ring: 'ring-violet-200' },
  // 微信公众号 - 绿色系
  'insurance-d': { bg: 'bg-emerald-500', hover: 'hover:bg-emerald-600', ring: 'ring-emerald-200' },
  // 小红书 - 红色系
  'insurance-xiaohongshu': { bg: 'bg-rose-500', hover: 'hover:bg-rose-600', ring: 'ring-rose-200' },
  // 知乎 - 蓝色系
  'insurance-zhihu': { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', ring: 'ring-blue-200' },
  // 头条 - 橙红色系
  'insurance-toutiao': { bg: 'bg-orange-500', hover: 'hover:bg-orange-600', ring: 'ring-orange-200' },
  // 抖音 - 黑色系（品牌色）
  'insurance-douyin': { bg: 'bg-slate-800', hover: 'hover:bg-slate-900', ring: 'ring-slate-300' },
  // 微博 - 黄色系
  'insurance-weibo': { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', ring: 'ring-amber-200' },
  'default': { bg: 'bg-slate-500', hover: 'hover:bg-slate-600', ring: 'ring-slate-200' },
};

// ============ 节点组件 ============

interface FlowNodeProps {
  task: SubTask;
  index: number;
  total: number;
  isSelected: boolean;
  onClick: () => void;
}

function FlowNode({ task, index, total, isSelected, onClick }: FlowNodeProps) {
  const icon = EXECUTOR_ICONS[task.executor] || EXECUTOR_ICONS['default'];
  const colors = EXECUTOR_COLORS[task.executor] || EXECUTOR_COLORS['default'];
  const arrowLabel = ARROW_LABELS[task.executor] || ARROW_LABELS['default'];

  return (
    <div className="flex items-center">
      {/* 节点 */}
      <button
        type="button"
        onClick={onClick}
        aria-label={`步骤 ${index + 1}: ${task.title || '未命名'}`}
        aria-pressed={isSelected}
        className={`
          group flex flex-col items-center cursor-pointer transition-all duration-300 ease-out
          ${isSelected ? 'scale-110' : 'hover:scale-105'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400
        `}
      >
        {/* 图标节点 */}
        <div
          className={`
            w-14 h-14 rounded-xl flex items-center justify-center
            transition-all duration-300 ease-out
            ${isSelected
              ? `${colors.bg} ring-4 ${colors.ring} ring-offset-2 shadow-lg shadow-${colors.bg.replace('bg-', '')}/30`
              : `${colors.bg} ${colors.hover} shadow-md hover:shadow-lg`
            }
          `}
        >
          {icon}
        </div>
        {/* 节点标题 */}
        <span
          className={`
            mt-2 text-xs font-medium max-w-[80px] text-center
            transition-colors duration-200
            ${isSelected ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'}
          `}
          title={task.title} // 悬停显示完整标题
        >
          <span className="line-clamp-2 leading-tight">
            {task.title || '未命名'}
          </span>
        </span>
        {/* 序号标签 */}
        <span
          className={`
            mt-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium
            transition-colors duration-200
            ${isSelected
              ? `${colors.bg.replace('bg-', 'bg-opacity-10 bg-')} ${colors.bg.replace('bg-', 'text-')}`
              : 'bg-slate-100 text-slate-400'
            }
          `}
        >
          {index + 1}
        </span>
      </button>

      {/* 箭头连接（除了最后一个） */}
      {index < total - 1 && (
        <div className="flex flex-col items-center mx-6 min-w-[80px]">
          {/* 箭头标签 */}
          <span className="text-[10px] text-slate-400 mb-1 font-medium tracking-wide">
            {arrowLabel}
          </span>
          {/* 箭头图标 */}
          <div className="relative">
            <ArrowRight className="w-8 h-8 text-slate-300" />
            {/* 动态箭头高亮（选中时） */}
            {isSelected && (
              <ArrowRight className="absolute inset-0 w-8 h-8 text-blue-300 animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ 主组件 ============

export function HorizontalFlowDiagram({
  subTasks,
  platformLabel,
  platform,
  accountName,
  selectedNodeId,
  onNodeSelect,
  onAdd,
}: HorizontalFlowDiagramProps) {
  // 有效子任务（标题非空）
  const validTasks = subTasks.filter((t) => t.title.trim());

  // 平台颜色
  const platformBadgeColors: Record<string, string> = {
    wechat_official: 'bg-blue-100 text-blue-700 border-blue-200',
    xiaohongshu: 'bg-pink-100 text-pink-700 border-pink-200',
    zhihu: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    douyin: 'bg-purple-100 text-purple-700 border-purple-200',
    weibo: 'bg-orange-100 text-orange-700 border-orange-200',
  };

  return (
    <div className="bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-5 shadow-sm">
      {/* 顶部标签栏 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`
              text-sm font-medium border-2 px-3 py-1
              ${platformBadgeColors[platform] || 'bg-slate-100 text-slate-700 border-slate-200'}
            `}
          >
            {platformLabel}
          </Badge>
          <span className="text-sm text-slate-500 font-medium">{accountName}</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            <span className="font-semibold text-slate-600">{validTasks.length}</span>
            <span>步</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="text-xs bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 transition-colors"
        >
          <span className="mr-1">+</span> 添加步骤
        </Button>
      </div>

      {/* 横向流程图节点 */}
      <div className="relative">
        <div className="flex items-center justify-start md:justify-center py-5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          {validTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <span className="text-xl">+</span>
              </div>
              <span className="text-sm">暂无步骤，请添加</span>
            </div>
          ) : (
            <div className="flex items-center px-4">
              {validTasks.map((task, index) => (
                <FlowNode
                  key={task.id}
                  task={task}
                  index={index}
                  total={validTasks.length}
                  isSelected={selectedNodeId === task.id}
                  onClick={() => onNodeSelect(task.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 渐变遮罩（可滚动提示） */}
        <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-50/80 to-transparent pointer-events-none md:hidden" />
        <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-50/80 to-transparent pointer-events-none md:hidden" />
      </div>

      {/* 流程路径预览 */}
      {validTasks.length > 1 && (
        <div className="mt-4 pt-3 border-t border-slate-200/60">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-600 shrink-0 bg-slate-100 px-2 py-0.5 rounded">
              流程
            </span>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                {validTasks.map((t, idx) => (
                  <span key={t.id} className="whitespace-nowrap flex items-center">
                    <span className="text-slate-700">{t.title || '未命名'}</span>
                    {idx < validTasks.length - 1 && (
                      <ArrowRight className="w-3 h-3 mx-1.5 text-slate-300 shrink-0" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HorizontalFlowDiagram;
