'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Bot, FileText, Settings, User, CheckCircle2, ListTodo, MessageSquare,
  Code2, ChevronDown, ChevronUp
} from 'lucide-react';
import { WRITING_AGENT_INFO, type WritingAgentId } from '@/lib/agents/agent-registry';

// ═══════════════════════════════════════════════════════════════════════
// 统一接口：合并两个页面的 StepHistoryItem 定义
// ═══════════════════════════════════════════════════════════════════════

export interface StepHistoryItem {
  id: number | string;
  stepNo: number;
  interactNum: number;
  interactType: string;
  interactUser: string;
  interactTime: string;
  interactContent: {
    interact_type?: string;
    consultant?: string;
    responder?: string;
    question?: string | Record<string, any>;
    response?: string | Record<string, any>;
    execution_result?: {
      status: string;
      error_msg?: string;
    };
    [key: string]: any;
  };
}

export interface StepHistoryCardProps {
  step: StepHistoryItem;
  isLast: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Agent 图标与标签配置（整合 agent-registry + 扩展）
// P2-2 修复：使用 agent-registry 动态获取 + 非写作 Agent 硬编码兜底
// ═══════════════════════════════════════════════════════════════════════

const AGENT_ICON_MAP: Record<string, { icon: React.ElementType; label: string }> = {
  'agent b': { icon: Bot, label: 'Agent B 评审' },
  'agent t': { icon: Bot, label: 'Agent T 评审' },
  'agent c': { icon: Bot, label: 'Agent C 评审' },
  'insurance-d': { icon: FileText, label: '保险专家（公众号）' },
  'insurance-xiaohongshu': { icon: FileText, label: '小红书创作专家' },
  'insurance-zhihu': { icon: FileText, label: '知乎创作专家' },
  'insurance-toutiao': { icon: FileText, label: '头条创作专家' },
  'deai-optimizer': { icon: Edit3, label: '去AI化优化' },
  'user_preview_edit': { icon: User, label: '用户预览修改' },
  'system': { icon: Settings, label: '系统' },
  'human': { icon: User, label: '用户' },
};

/** 动态获取 Agent 显示配置（支持 agent-registry 中的所有写作 Agent） */
function getAgentDisplayInfo(interactUser: string): { icon: React.ElementType; label: string } {
  const normalized = interactUser.toLowerCase().trim();

  // 1. 精确匹配（优先）
  if (AGENT_ICON_MAP[normalized]) {
    return AGENT_ICON_MAP[normalized];
  }

  // 2. 通过 agent-registry 匹配写作 Agent
  const writingAgentId = normalized as WritingAgentId;
  if (WRITING_AGENT_INFO[writingAgentId]) {
    const info = WRITING_AGENT_INFO[writingAgentId];
    return { icon: FileText, label: info.name };
  }

  // 3. 包含匹配（容错大小写）
  for (const [key, config] of Object.entries(AGENT_ICON_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return config;
    }
  }

  // 4. 默认兜底
  return { icon: Bot, label: interactUser };
}

// ═══════════════════════════════════════════════════════════════════════
// 步骤卡片组件（合并两页面版本，保留 richer 展示）
// - Agent B 评审：Sky 色系高亮
// - 执行 Agent：Slate 色系
// - AI 智能分析区：gradient 高亮展示 briefResponse/selfEvaluation/actionsTaken
// - Developer JSON 折叠面板
// ═══════════════════════════════════════════════════════════════════════

function StepHistoryCard({ step, isLast }: StepHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(step.interactUser === 'agent B');

  const isAgentBReview = step.interactUser.toLowerCase() === 'agent b';

  // 提取决策信息
  const response = typeof step.interactContent.response === 'object'
    ? step.interactContent.response
    : {};
  const decisionType = response?.type || '';
  const reasoning = response?.reasoning || '';
  const riskLevel = response?.context?.riskLevel || '';

  // 提取三个关键字段（执行 Agent 的核心输出）
  const briefResponse = response?.briefResponse || '';
  const selfEvaluation = response?.selfEvaluation || '';
  const actionsTaken = Array.isArray(response?.actionsTaken) ? response.actionsTaken : [];

  // Agent 显示配置
  const agentInfo = getAgentDisplayInfo(step.interactUser);
  const IconComponent = agentInfo.icon;

  // 格式化时间
  const formatTime = (time: string) => {
    return new Date(time).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 决策类型徽章样式
  const getDecisionBadge = (type: string) => {
    switch (type) {
      case 'COMPLETE':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'NEED_USER':
        return isAgentBReview ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-700 border-slate-200';
      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // 生成标题：Agent B 显示"评审"，其他显示"执行"
  const getStepTitle = () => {
    if (isAgentBReview) return 'Agent B 评审';
    // 写作 Agent 显示平台标签（如 "[小红书] 执行"）
    const writingAgentId = step.interactUser.toLowerCase() as WritingAgentId;
    if (WRITING_AGENT_INFO[writingAgentId]) {
      return `${WRITING_AGENT_INFO[writingAgentId].name} 执行`;
    }
    return `${step.interactUser} 执行`;
  };

  return (
    <div className="relative">
      {/* 时间线连接 */}
      {!isLast && (
        <div className="absolute left-5 top-12 bottom-0 w-px bg-slate-200" />
      )}

      <Card className={`
        group relative overflow-hidden transition-all duration-300
        ${isAgentBReview ? 'border-l-4 border-l-sky-500' : 'border border-slate-200'}
        hover:shadow-md hover:shadow-slate-100/50
      `}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                {/* 左侧：图标 + 标题 */}
                <div className="flex items-start gap-3">
                  <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${isAgentBReview ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-600'}
                  `}>
                    <IconComponent className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{getStepTitle()}</h4>
                      {decisionType && (
                        <Badge variant="outline" className={`text-xs ${getDecisionBadge(decisionType)}`}>
                          {decisionType}
                        </Badge>
                      )}
                    </div>

                    {reasoning && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-1">{reasoning}</p>
                    )}

                    {!reasoning && typeof step.interactContent.question === 'string' && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                        {step.interactContent.question.substring(0, 80)}...
                      </p>
                    )}
                  </div>
                </div>

                {/* 右侧：时间 + 展开按钮 */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">
                    {formatTime(step.interactTime)}
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <div className="pl-13 space-y-4">

                {/* 执行 Agent 核心输出高亮区 */}
                {(briefResponse || selfEvaluation || actionsTaken.length > 0) && (
                  <div className="relative">
                    {/* 亮点标识标签 */}
                    <div className="absolute -top-2 left-4 px-2 py-0.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-medium rounded-full shadow-sm">
                      AI 智能分析
                    </div>

                    <div className="bg-gradient-to-br from-sky-50/80 via-slate-50/50 to-white rounded-xl p-5 border border-sky-200/60 shadow-sm">

                      {/* 简要回应 */}
                      {briefResponse && (
                        <div className="mb-4 pb-4 border-b border-sky-200/50">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shadow-sm">
                              <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <Label className="text-sm font-semibold text-slate-900">简要回应</Label>
                              <p className="text-xs text-slate-500">核心结论与观点</p>
                            </div>
                          </div>
                          <div className="pl-10">
                            <p className="text-sm text-slate-800 leading-relaxed bg-white/60 rounded-lg p-3 border border-sky-100">
                              {briefResponse}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 自我评估 */}
                      {selfEvaluation && (
                        <div className="mb-4 pb-4 border-b border-slate-200/50">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <Label className="text-sm font-semibold text-slate-900">自我评估</Label>
                              <p className="text-xs text-slate-500">质量反思与优化建议</p>
                            </div>
                          </div>
                          <div className="pl-10">
                            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/80 rounded-lg p-3 border border-slate-200">
                              {selfEvaluation}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 已执行动作 */}
                      {actionsTaken.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                              <ListTodo className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <Label className="text-sm font-semibold text-slate-900">已执行动作</Label>
                              <p className="text-xs text-slate-500">分步骤执行轨迹</p>
                            </div>
                          </div>
                          <div className="pl-10 space-y-2">
                            {actionsTaken.map((action: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-3 text-sm group">
                                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center flex-shrink-0 text-xs text-white font-bold shadow-sm group-hover:shadow-md transition-shadow">
                                  {idx + 1}
                                </span>
                                <span className="text-slate-700 leading-relaxed pt-0.5">
                                  {typeof action === 'string' ? action : JSON.stringify(action)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Agent B 评审信息高亮展示 */}
                {isAgentBReview && decisionType && (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-sky-600" />
                      </div>
                      <span className="font-medium text-slate-900">评审决策</span>
                    </div>

                    {reasoning && (
                      <div className="mb-3">
                        <Label className="text-xs text-slate-500">评审理由</Label>
                        <p className="text-sm text-slate-700 mt-1">{reasoning}</p>
                      </div>
                    )}

                    {riskLevel && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-slate-500">风险等级</Label>
                        <Badge variant="outline" className="text-xs">{riskLevel}</Badge>
                      </div>
                    )}

                    {response?.context?.suggestedAction && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <Label className="text-xs text-slate-500">建议操作</Label>
                        <p className="text-sm text-slate-700 mt-1">{response.context.suggestedAction}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 执行结果 */}
                {step.interactContent.execution_result && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">执行结果:</span>
                    <Badge variant="outline" className="text-xs">
                      {step.interactContent.execution_result.status}
                    </Badge>
                    {step.interactContent.execution_result.error_msg && (
                      <span className="text-xs text-red-600">
                        {step.interactContent.execution_result.error_msg}
                      </span>
                    )}
                  </div>
                )}

                {/* Developer JSON 折叠面板 */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700 border-slate-200 hover:bg-slate-50"
                    >
                      <Code2 className="w-3 h-3 mr-2" />
                      查看完整 JSON 数据（开发者模式）
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                          </div>
                          <span className="text-xs text-slate-400 ml-2 font-mono">interact_content.json</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                          {JSON.stringify(step.interactContent).length} bytes
                        </Badge>
                      </div>
                      <div className="p-4 overflow-x-auto max-h-96 overflow-y-auto">
                        <pre className="text-xs text-slate-300 font-mono leading-relaxed">
                          {JSON.stringify(step.interactContent, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}

// 编辑图标（用于 deai-optimizer 等未内置图标的 Agent）
function Edit3({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export { StepHistoryCard };
