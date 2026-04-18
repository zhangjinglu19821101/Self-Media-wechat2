'use client';

/**
 * DraftListPanel - 草稿列表面板
 * 显示指定 Agent 的所有草稿文件
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Trash2, RefreshCw, Eye, CheckCircle, Clock, XCircle } from 'lucide-react';
import { formatBeijingTime, formatRelativeTime } from '@/lib/utils/date-time';

interface DraftItem {
  fileName: string;
  title: string;
  author: string;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  complianceStatus?: 'pending' | 'passed' | 'failed';
  createdAt: string;
  updatedAt: string;
  taskId?: string;
  preview: string;
}

interface DraftListPanelProps {
  agentId: 'D' | 'insurance-d';
}

export function DraftListPanel({ agentId }: DraftListPanelProps) {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDraft, setSelectedDraft] = useState<DraftItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  // 加载草稿列表
  const loadDrafts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/drafts?agentId=${agentId}`);
      const data = await response.json();

      if (data.success) {
        setDrafts(data.data.drafts);
      }
    } catch (error) {
      console.error('加载草稿列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  // 初始加载 + 页面可见性刷新
  useEffect(() => {
    loadDrafts();

    // 🔥 优化：使用页面可见性 API 替代定时轮询
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDrafts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [agentId]);

  // 删除草稿
  const handleDeleteDraft = async (fileName: string) => {
    if (!confirm('确定要删除这个草稿吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/drafts/${encodeURIComponent(fileName)}?agentId=${agentId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        alert('草稿已删除');
        loadDrafts();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除草稿失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 过滤草稿
  const filteredDrafts = drafts.filter((draft) => {
    if (activeTab === 'all') return true;
    return draft.status === activeTab;
  });

  // 获取状态配置
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft':
        return {
          label: '草稿',
          icon: FileText,
          variant: 'secondary' as const,
          color: 'text-gray-500',
        };
      case 'reviewing':
        return {
          label: '审核中',
          icon: Clock,
          variant: 'default' as const,
          color: 'text-blue-500',
        };
      case 'approved':
        return {
          label: '已通过',
          icon: CheckCircle,
          variant: 'default' as const,
          color: 'text-green-500',
        };
      case 'rejected':
        return {
          label: '已驳回',
          icon: XCircle,
          variant: 'destructive' as const,
          color: 'text-red-500',
        };
      case 'pending':
        return {
          label: '待校验',
          icon: Clock,
          variant: 'outline' as const,
          color: 'text-gray-500',
        };
      case 'passed':
        return {
          label: '合规通过',
          icon: CheckCircle,
          variant: 'default' as const,
          color: 'text-green-500',
        };
      case 'failed':
        return {
          label: '合规不通过',
          icon: XCircle,
          variant: 'destructive' as const,
          color: 'text-red-500',
        };
      default:
        return {
          label: status,
          icon: FileText,
          variant: 'secondary' as const,
          color: 'text-gray-500',
        };
    }
  };

  const timeAgo = (dateStr: string) => {
    try {
      return formatRelativeTime(dateStr);
    } catch {
      return '未知时间';
    }
  };

  return (
    <Card className="w-full mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">本地草稿箱</CardTitle>
            <CardDescription className="text-xs">
              文件存储路径：
              <code>
                {agentId === 'insurance-d'
                  ? '/workspace/projects/insurance-Business/draft-article/insurance-d/'
                  : '/workspace/projects/AI-Business/draft-article/agent-d/'}
              </code>
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDrafts}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="text-xs">
              全部
            </TabsTrigger>
            <TabsTrigger value="draft" className="text-xs">
              草稿
            </TabsTrigger>
            <TabsTrigger value="reviewing" className="text-xs">
              审核中
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">
              已通过
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">
              已驳回
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {loading && drafts.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            暂无草稿
          </div>
        ) : viewMode === 'list' ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3 pr-4">
              {filteredDrafts.map((draft) => {
                const statusConfig = getStatusConfig(draft.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <Card key={draft.fileName} className="border-l-4 border-l-green-500">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {/* 草稿头部 */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500">
                                {draft.author}
                              </span>
                              {draft.taskId && (
                                <Badge variant="outline" className="text-xs">
                                  {draft.taskId.slice(-12)}
                                </Badge>
                              )}
                              <Badge
                                variant={statusConfig.variant}
                                className="text-xs"
                              >
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                              {agentId === 'insurance-d' && draft.complianceStatus && (
                                <>
                                  {' '}
                                  <Badge
                                    variant={getStatusConfig(draft.complianceStatus).variant}
                                    className="text-xs"
                                  >
                                    {getStatusConfig(draft.complianceStatus).label}
                                  </Badge>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {timeAgo(draft.createdAt)}
                            </p>
                          </div>
                        </div>

                        {/* 草稿内容 */}
                        <div>
                          <h4 className="text-sm font-medium mb-1">{draft.title}</h4>
                          <p className="text-xs text-gray-600 line-clamp-2">{draft.preview}</p>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDraft(draft)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            查看详情
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteDraft(draft.fileName)}
                          >
                            <Trash2 className="w-3 h-3 mr-1 text-red-500" />
                            删除
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
            >
              ← 返回列表
            </Button>
            {selectedDraft && (
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2">{selectedDraft.title}</h3>
                <div className="text-sm text-gray-600 mb-4">
                  <p>作者：{selectedDraft.author}</p>
                  <p>任务 ID：{selectedDraft.taskId || '无'}</p>
                  <p>状态：{selectedDraft.status}</p>
                  <p>创建时间：{new Date(selectedDraft.createdAt).toLocaleString('zh-CN')}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans">{selectedDraft.preview}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
