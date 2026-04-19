'use client';

/**
 * 报告列表页面 - 查看 Agent B 上报的报告
 */

import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Clock, AlertCircle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Report {
  id: string;
  commandResultId: string;
  subTaskId?: string;
  reportType: string;
  status: string;
  summary: string;
  conclusion: string;
  dialogueProcess: any;
  suggestedActions?: any[];
  reportedFrom: string;
  reportedTo: string;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  processedActions?: any[];
  dismissedReason?: string;
}

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待审核', color: 'bg-yellow-500', icon: Clock },
  reviewed: { label: '已审核', color: 'bg-blue-500', icon: CheckCircle2 },
  processing: { label: '处理中', color: 'bg-blue-500', icon: MessageSquare },
  processed: { label: '已处理', color: 'bg-green-500', icon: CheckCircle2 },
  dismissed: { label: '已忽略', color: 'bg-gray-500', icon: AlertCircle },
};

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <ReportsContent />
    </Suspense>
  );
}

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'processed' | 'dismissed'>('processed');
  const [reviewNotes, setReviewNotes] = useState('');

  // 加载报告列表
  const loadReports = async (filterType: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports?filter=${filterType}&limit=50`);
      const data = await response.json();

      if (data.success) {
        setReports(data.data);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('加载报告列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(filter);
  }, [filter]);

  // 提交审核
  const handleReview = async () => {
    if (!selectedReport) return;

    try {
      const response = await fetch(`/api/reports/${selectedReport.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: reviewStatus,
          reviewedBy: 'Agent A',
          dismissedReason: reviewNotes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setReviewDialogOpen(false);
        loadReports(filter);
      } else {
        alert('审核失败: ' + data.error);
      }
    } catch (error) {
      console.error('审核失败:', error);
      alert('审核失败');
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Agent 报告管理</h1>
        <p className="text-gray-600 mt-2">查看和管理 Agent B 上报的报告</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">全部</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-600">待审核</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {reports.filter(r => r.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-600">已审核</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {reports.filter(r => r.status === 'reviewed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-600">已处理</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {reports.filter(r => r.status === 'processed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">已忽略</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {reports.filter(r => r.status === 'dismissed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 过滤标签 */}
      <Tabs value={filter} onValueChange={(value) => router.push(`/reports?filter=${value}`)} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="pending">待审核</TabsTrigger>
          <TabsTrigger value="reviewed">已审核</TabsTrigger>
          <TabsTrigger value="processing">处理中</TabsTrigger>
          <TabsTrigger value="processed">已处理</TabsTrigger>
          <TabsTrigger value="dismissed">已忽略</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 报告列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无报告</div>
        ) : (
          reports.map((report) => {
            const statusInfo = statusLabels[report.status] || statusLabels.pending;
            const StatusIcon = statusInfo.icon;

            return (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                        <Badge variant={report.status === 'pending' ? 'destructive' : 'secondary'}>
                          {statusInfo.label}
                        </Badge>
                        <Badge variant="outline">{report.reportType}</Badge>
                      </div>
                      <CardTitle className="text-lg">
                        {report.summary || '无总结'}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        任务 ID: {report.commandResultId}
                      </CardDescription>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <div>上报时间: {new Date(report.createdAt).toLocaleString()}</div>
                      {report.reviewedAt && (
                        <div>审核时间: {new Date(report.reviewedAt).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* 结论 */}
                    {report.conclusion && (
                      <div>
                        <Label className="text-sm font-medium">结论</Label>
                        <p className="text-sm text-gray-700 mt-1">{report.conclusion}</p>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    {report.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedReport(report);
                            setReviewDialogOpen(true);
                          }}
                        >
                          审核
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // 查看对话过程
                            setSelectedReport(report);
                            setReviewDialogOpen(true);
                          }}
                        >
                          查看详情
                        </Button>
                      </div>
                    )}

                    {/* 审核备注 */}
                    {report.reviewedAt && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-md">
                        <Label className="text-sm font-medium">审核人: {report.reviewedBy}</Label>
                        {report.dismissedReason && (
                          <p className="text-sm text-gray-700 mt-1">{report.dismissedReason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 审核对话框 */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>审核报告</DialogTitle>
            <DialogDescription>
              查看 Agent B 上报的报告并决定处理方式
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="space-y-2">
                <Label>报告类型: {selectedReport.reportType}</Label>
                <Label>上报时间: {new Date(selectedReport.createdAt).toLocaleString()}</Label>
                <Label>上报人: {selectedReport.reportedFrom}</Label>
                <Label>上报对象: {selectedReport.reportedTo}</Label>
              </div>

              {/* 总结 */}
              {selectedReport.summary && (
                <div>
                  <Label className="font-medium">总结</Label>
                  <p className="text-sm text-gray-700 mt-1">{selectedReport.summary}</p>
                </div>
              )}

              {/* 结论 */}
              {selectedReport.conclusion && (
                <div>
                  <Label className="font-medium">结论</Label>
                  <p className="text-sm text-gray-700 mt-1">{selectedReport.conclusion}</p>
                </div>
              )}

              {/* 对话过程 */}
              {selectedReport.dialogueProcess && (
                <div>
                  <Label className="font-medium">对话过程</Label>
                  <ScrollArea className="h-[200px] mt-2 border rounded-md p-3">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(selectedReport.dialogueProcess, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {/* 建议的行动 */}
              {selectedReport.suggestedActions && (
                <div>
                  <Label className="font-medium">建议的行动</Label>
                  <ScrollArea className="h-[150px] mt-2 border rounded-md p-3">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(selectedReport.suggestedActions, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}

              {/* 审核表单 */}
              {selectedReport.status === 'pending' && (
                <div className="space-y-3 pt-4 border-t">
                  <Label>审核结果</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={reviewStatus === 'processed' ? 'default' : 'outline'}
                      onClick={() => setReviewStatus('processed')}
                    >
                      处理
                    </Button>
                    <Button
                      type="button"
                      variant={reviewStatus === 'dismissed' ? 'default' : 'outline'}
                      onClick={() => setReviewStatus('dismissed')}
                    >
                      忽略
                    </Button>
                  </div>

                  <Label>审核备注</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="输入审核备注..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              关闭
            </Button>
            {selectedReport?.status === 'pending' && (
              <Button onClick={handleReview}>
                提交审核
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
