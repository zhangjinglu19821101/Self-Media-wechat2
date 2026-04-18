/**
 * 结构流程管理组件
 * 
 * 独立组件，解决 Hook 在条件内调用的问题
 * 负责流程节点的展示、编辑、删除、移动功能
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowRight, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import type { FlowNode, FlowTemplate } from './types';

// ============ 工具函数（内联，避免循环依赖） ============

/**
 * 删除节点并自动衔接
 */
function deleteNodeAndAutoConnect(nodes: FlowNode[], nodeId: string): FlowNode[] {
  const filteredNodes = nodes.filter(node => node.id !== nodeId);
  return filteredNodes
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((node, index) => ({
      ...node,
      orderIndex: index + 1,
    }));
}

/**
 * 移动节点位置
 */
function moveNode(nodes: FlowNode[], nodeId: string, direction: 'up' | 'down'): FlowNode[] {
  const nodeIndex = nodes.findIndex(node => node.id === nodeId);
  if (nodeIndex === -1) return nodes;

  const newNodes = [...nodes];
  const targetIndex = direction === 'up' ? nodeIndex - 1 : nodeIndex + 1;

  if (targetIndex < 0 || targetIndex >= nodes.length) return nodes;

  [newNodes[nodeIndex], newNodes[targetIndex]] = [newNodes[targetIndex], newNodes[nodeIndex]];

  return newNodes
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((node, index) => ({
      ...node,
      orderIndex: index + 1,
    }));
}

/**
 * 更新节点信息
 */
function updateNode(
  nodes: FlowNode[],
  nodeId: string,
  updates: Partial<Omit<FlowNode, 'id' | 'orderIndex'>>
): FlowNode[] {
  return nodes.map(node =>
    node.id === nodeId
      ? { ...node, ...updates }
      : node
  );
}

// ============ 组件 Props ============

interface StructureFlowSectionProps {
  /** 当前选择的平台 */
  platform: string;
  /** 是否激活（显示） */
  isActive: boolean;
  /** 流程模板（从外部传入，避免重复获取） */
  flowTemplate: FlowTemplate | null;
  /** 模板变化回调 */
  onTemplateChange?: (template: FlowTemplate) => void;
}

// ============ 主组件 ============

export function StructureFlowSection({
  platform,
  isActive,
  flowTemplate: externalTemplate,
  onTemplateChange,
}: StructureFlowSectionProps) {
  // 状态定义
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([]);
  const [editingNode, setEditingNode] = useState<FlowNode | null>(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);

  // 初始化：当激活或平台变化时，加载模板
  useEffect(() => {
    if (!isActive || !externalTemplate) return;
    
    // 深拷贝节点，确保不可变性
    setFlowNodes(externalTemplate.nodes.map(n => ({ ...n })));
  }, [isActive, externalTemplate]);

  // 同步更新：节点变化时通知父组件
  const updateNodes = useCallback((newNodes: FlowNode[]) => {
    setFlowNodes(newNodes);
    
    if (externalTemplate && onTemplateChange) {
      onTemplateChange({
        ...externalTemplate,
        nodes: newNodes,
        steps: newNodes.map(({ id, icon, color, ...step }) => step),
      });
    }
  }, [externalTemplate, onTemplateChange]);

  // 节点操作函数
  const handleEditNode = useCallback((node: FlowNode) => {
    setEditingNode({ ...node });
    setShowNodeEditor(true);
  }, []);

  const handleSaveNode = useCallback(() => {
    if (!editingNode) return;
    
    const updatedNodes = updateNode(flowNodes, editingNode.id, {
      title: editingNode.title,
      executor: editingNode.executor,
      description: editingNode.description,
    });
    
    updateNodes(updatedNodes);
    setShowNodeEditor(false);
    setEditingNode(null);
    toast.success('节点已更新');
  }, [editingNode, flowNodes, updateNodes]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (flowNodes.length <= 1) {
      toast.warning('流程至少需要保留一个节点');
      return;
    }
    
    const updatedNodes = deleteNodeAndAutoConnect(flowNodes, nodeId);
    updateNodes(updatedNodes);
    toast.success('节点已删除，流程已自动衔接');
  }, [flowNodes, updateNodes]);

  const handleMoveNode = useCallback((nodeId: string, direction: 'up' | 'down') => {
    const updatedNodes = moveNode(flowNodes, nodeId, direction);
    updateNodes(updatedNodes);
  }, [flowNodes, updateNodes]);

  const handleCloseEditor = useCallback(() => {
    setShowNodeEditor(false);
    setEditingNode(null);
  }, []);

  // 不激活时不渲染
  if (!isActive) return null;

  // 计算派生数据
  const platformLabel = externalTemplate?.platformLabel || '微信公众号';

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
      {/* 顶部区域标签栏 */}
      <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-blue-100 px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-400 to-sky-600 flex items-center justify-center">
              <Workflow className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-medium text-blue-700">流程区</span>
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
          </div>
        </div>
      </div>

      {/* 标题区域 */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">流程管理</h2>
            <Badge className="text-xs text-blue-700 bg-blue-100 border border-blue-200">
              {platformLabel}
            </Badge>
            <Badge className="text-xs text-slate-700 bg-slate-100 border border-slate-200">
              {flowNodes.length}个节点
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">管理文章生成流程的节点，支持删除、移动和编辑</p>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-6 bg-slate-50/50">
        {/* 横向流程图 */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
            <Workflow className="w-4 h-4" />流程节点
          </h4>
          <div className="overflow-x-auto pb-4">
            <div className="flex items-center gap-3 min-w-max p-4 bg-slate-100/50 rounded-2xl">
              {flowNodes.map((node, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === flowNodes.length - 1;
                const color = node.color || 'from-slate-500 to-slate-600';

                return (
                  <div key={node.id} className="flex items-center">
                    {/* 节点卡片 */}
                    <div className="relative">
                      <div className={`
                        p-4 rounded-xl border-2 shadow-sm bg-white hover:shadow-md transition-all duration-200
                        border-slate-200 hover:border-blue-300 w-48
                      `}>
                        {/* 节点头部 */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`
                            w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shrink-0
                          `}>
                            <span className="text-lg">{node.icon || '📌'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-sm text-slate-800 truncate">
                              {node.title}
                            </span>
                          </div>
                        </div>

                        {/* 节点信息 */}
                        <Badge variant="outline" className="text-xs mb-1.5 bg-slate-50 border-slate-200 text-slate-600">
                          {node.executor}
                        </Badge>
                        <p className="text-xs leading-relaxed text-slate-500 line-clamp-2">
                          {node.description}
                        </p>

                        {/* 操作按钮 */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            {/* 上移按钮 */}
                            <button
                              type="button"
                              onClick={() => handleMoveNode(node.id, 'up')}
                              disabled={isFirst}
                              className={`p-1.5 rounded-md transition-colors ${
                                isFirst
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'
                              }`}
                              title="上移"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            {/* 下移按钮 */}
                            <button
                              type="button"
                              onClick={() => handleMoveNode(node.id, 'down')}
                              disabled={isLast}
                              className={`p-1.5 rounded-md transition-colors ${
                                isLast
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-blue-600'
                              }`}
                              title="下移"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* 编辑按钮 */}
                            <button
                              type="button"
                              onClick={() => handleEditNode(node)}
                              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                              title="编辑"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            {/* 删除按钮 */}
                            <button
                              type="button"
                              onClick={() => handleDeleteNode(node.id)}
                              className="p-1.5 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="删除"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 箭头（除了最后一个） */}
                    {!isLast && (
                      <div className="flex items-center justify-center w-10">
                        <ArrowRight className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-800 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            点击删除按钮会自动删除节点并重新衔接流程，点击编辑按钮可修改节点信息
          </p>
        </div>
      </div>

      {/* 节点编辑弹窗 */}
      {showNodeEditor && editingNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">编辑节点</h3>
              <button
                type="button"
                onClick={handleCloseEditor}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6 space-y-4">
              {/* 标题 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">标题</label>
                <Input
                  value={editingNode.title}
                  onChange={(e) => setEditingNode({ ...editingNode, title: e.target.value })}
                  placeholder="请输入节点标题"
                  className="h-10"
                />
              </div>

              {/* 执行者 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">执行者</label>
                <Input
                  value={editingNode.executor}
                  onChange={(e) => setEditingNode({ ...editingNode, executor: e.target.value })}
                  placeholder="请输入执行者"
                  className="h-10"
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">描述</label>
                <textarea
                  value={editingNode.description}
                  onChange={(e) => setEditingNode({ ...editingNode, description: e.target.value })}
                  placeholder="请输入节点描述"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 弹窗底部 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCloseEditor}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveNode}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StructureFlowSection;
