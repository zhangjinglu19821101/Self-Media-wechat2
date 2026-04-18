'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, FileText, Image, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { XiaohongshuPreview } from '@/components/xiaohongshu-preview';
import { getCurrentWorkspaceId } from '@/lib/api/client';

interface TaskItem {
  id: string;
  taskTitle: string;
  status: string;
  executor: string;
  platform: string;
  commandResultId: string;
  updatedAt: string;
  resultText?: string;
}

export default function ArticlesPreviewPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const workspaceId = getCurrentWorkspaceId();
      const response = await fetch('/api/agents/tasks/writing-task/recent', {
        headers: { 'x-workspace-id': workspaceId },
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformLabel = (executor: string, metadata?: { platform?: string }) => {
    if (executor === 'insurance-xiaohongshu' || metadata?.platform === 'xiaohongshu') {
      return { label: '小红书', color: 'bg-rose-100 text-rose-700' };
    }
    if (executor === 'insurance-d') {
      return { label: '微信公众号', color: 'bg-green-100 text-green-700' };
    }
    if (executor === 'insurance-zhihu') {
      return { label: '知乎', color: 'bg-blue-100 text-blue-700' };
    }
    return { label: '其他', color: 'bg-gray-100 text-gray-700' };
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'all') return true;
    if (activeTab === 'xiaohongshu') return task.executor === 'insurance-xiaohongshu' || task.platform === 'xiaohongshu';
    if (activeTab === 'wechat') return task.executor === 'insurance-d';
    return true;
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/full-home">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">文章预览</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="xiaohongshu">小红书</TabsTrigger>
          <TabsTrigger value="wechat">微信公众号</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {loading ? (
            <div className="text-center py-10 text-muted-foreground">加载中...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">暂无已完成的文章</div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map(task => {
                const platform = getPlatformLabel(task.executor, task as any);
                const isXiaohongshu = task.executor === 'insurance-xiaohongshu' || (task as any).platform === 'xiaohongshu';
                
                return (
                  <Card key={task.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={platform.color}>{platform.label}</Badge>
                          <CardTitle className="text-base">{task.taskTitle}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          {isXiaohongshu ? (
                            <XiaohongshuPreview 
                              commandResultId={task.commandResultId}
                              variant="outline"
                              size="sm"
                            />
                          ) : (
                            <Link href={`/preview/article/${task.id}`}>
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4 mr-2" />
                                预览
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        更新时间: {new Date(task.updatedAt).toLocaleString('zh-CN')}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
