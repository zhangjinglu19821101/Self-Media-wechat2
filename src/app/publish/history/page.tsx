'use client';

/**
 * 发布历史页面
 * 
 * 查看所有发布记录的状态
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { PLATFORM_LABELS } from '@/lib/db/schema/style-template';
import { PUBLISH_STATUS } from '@/lib/db/schema/publish-records';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待发布', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  scheduled: { label: '定时中', color: 'bg-blue-100 text-blue-700', icon: Clock },
  publishing: { label: '发布中', color: 'bg-purple-100 text-purple-700', icon: Loader2 },
  published: { label: '已发布', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  failed: { label: '失败', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: '已取消', color: 'bg-slate-100 text-slate-500', icon: XCircle },
};

export default function PublishHistoryPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  useEffect(() => {
    loadRecords();
  }, [statusFilter, platformFilter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (platformFilter !== 'all') params.set('platform', platformFilter);

      const res = await fetch(`/api/publish/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRecords(data.data || []);
        }
      }
    } catch (err) {
      console.error('[PublishHistory] 加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">发布历史</h1>
        <Button variant="outline" size="sm" onClick={loadRecords}>
          <RefreshCw className="w-4 h-4 mr-1" />
          刷新
        </Button>
      </div>

      {/* 筛选栏 */}
      <div className="flex gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待发布</SelectItem>
            <SelectItem value="published">已发布</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="平台" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部平台</SelectItem>
            <SelectItem value="wechat_official">微信公众号</SelectItem>
            <SelectItem value="xiaohongshu">小红书</SelectItem>
            <SelectItem value="zhihu">知乎</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 记录列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-400">
            暂无发布记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={record.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{record.title}</h3>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span>{PLATFORM_LABELS[record.platform as keyof typeof PLATFORM_LABELS] || record.platform}</span>
                        <span>·</span>
                        <span>提交于 {formatDate(record.createdAt)}</span>
                        {record.publishedAt && (
                          <>
                            <span>·</span>
                            <span>发布于 {formatDate(record.publishedAt)}</span>
                          </>
                        )}
                      </div>
                      {record.errorMessage && (
                        <p className="text-sm text-red-500 mt-1">错误: {record.errorMessage}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {record.platformUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={record.platformUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
