'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Rocket,
  Upload,
  ExternalLink,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  FileText,
  Settings,
  User,
  Copyright,
  MessageCircle,
  Heart,
  Image as ImageIcon,
  Copy
} from 'lucide-react';
import Link from 'next/link';

interface WechatDraftDefaults {
  author: string;
  isOriginal: 0 | 1;
  needOpenComment: 0 | 1;
  onlyFansCanComment: 0 | 1;
  canReward: 0 | 1;
  showCoverPic: 0 | 1;
}

interface TaskInfo {
  id: string;
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  status: string;
  executor: string;
  orderIndex: number;
  createdAt: string;
  completedAt?: string;
  // 文章内容（从MCP执行记录中获取）
  articleContent?: string;
  articleTitle?: string;
}

function PublishCenterContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId') || '';
  
  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [mediaId, setMediaId] = useState<string>('');
  const [config, setConfig] = useState<WechatDraftDefaults>({
    author: '智者足迹-探寻',
    isOriginal: 1,
    needOpenComment: 1,
    onlyFansCanComment: 0,
    canReward: 1,
    showCoverPic: 0,
  });

  // 加载任务信息
  useEffect(() => {
    if (taskId) {
      loadTaskInfo();
      loadDefaultConfig();
    }
  }, [taskId]);

  const loadTaskInfo = async () => {
    try {
      setLoading(true);
      
      // 获取任务详情
      const response = await fetch(`/api/agents/tasks/${taskId}/detail`);
      const data = await response.json();
      
      if (data.success) {
        setTaskInfo({
          ...data.data.task,
          // 🔥 修复：API 已经从 order_index-1 获取了文章内容
          articleTitle: data.data.task.articleTitle || data.data.task.taskTitle,
          articleContent: data.data.task.executionResult,
        });
        
        console.log('✅ 任务详情加载成功:', {
          articleTitle: data.data.task.articleTitle,
          hasExecutionResult: !!data.data.task.executionResult,
          hasTaskDescription: !!data.data.task.taskDescription,
        });
      } else {
        toast.error(`加载任务失败: ${data.error}`);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
      toast.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDefaultConfig = async () => {
    try {
      // 🔥 从后端API加载默认配置（默认使用 insurance-account）
      const response = await fetch('/api/wechat/accounts/insurance-account/draft-config');
      const data = await response.json();
      
      if (data.success) {
        setConfig({
          author: data.data.author || '原创',
          isOriginal: data.data.isOriginal ?? 0,
          needOpenComment: data.data.needOpenComment ?? 1,
          onlyFansCanComment: data.data.onlyFansCanComment ?? 0,
          canReward: data.data.canReward ?? 0,
          showCoverPic: data.data.showCoverPic ?? 0,
        });
        console.log('✅ 已加载默认发布配置:', data.data);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const handleUploadToDraft = async () => {
    if (!taskInfo) return;

    try {
      setUploading(true);
      
      // 🔥 调用真实的上传草稿API
      const response = await fetch('/api/wechat/draft/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'insurance-account',  // 默认使用保险科普公众号
          title: taskInfo.articleTitle || taskInfo.taskTitle,
          content: taskInfo.articleContent || taskInfo.taskDescription,
          // 使用用户在页面上确认的发布设置
          author: config.author,
          isOriginal: config.isOriginal,
          needOpenComment: config.needOpenComment,
          onlyFansCanComment: config.onlyFansCanComment,
          showCoverPic: config.showCoverPic,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMediaId(data.data.mediaId || data.data.media_id || `uploaded_${Date.now()}`);
        setUploaded(true);
        
        toast.success('✅ 已成功上传到公众号草稿箱！所有设置已自动填入。');
        console.log('上传结果:', data.data);
      } else {
        toast.error(`上传失败: ${data.error}`);
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      toast.error(`上传失败: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCopyMediaId = () => {
    navigator.clipboard.writeText(mediaId);
    toast.success('已复制 media_id 到剪贴板');
  };

  const handleGoToWechat = () => {
    window.open('https://mp.weixin.qq.com/', '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-sky-400" />
          <p className="mt-4 text-gray-600">正在加载任务信息...</p>
        </div>
      </div>
    );
  }

  if (!taskInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50 flex items-center justify-center">
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">未找到任务信息</p>
            <Link href="/task-timeline" className="mt-4 inline-block">
              <Button variant="outline">返回任务列表</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50">
      <div className="container mx-auto p-6 space-y-6 max-w-4xl">
        {/* 页面标题 */}
        <div className="flex items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-sky-100/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 p-3 shadow-lg">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                发布就绪中心
              </h1>
              <p className="text-muted-foreground mt-1">文章已审核通过，准备上传到公众号草稿箱</p>
            </div>
          </div>
          <Link href="/task-timeline">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回任务列表
            </Button>
          </Link>
        </div>

        {/* 状态提示 */}
        <Card className={`${uploaded ? 'bg-green-50/80' : 'bg-blue-50/80'} border-${uploaded ? 'green' : 'blue'}-200/50`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {uploaded ? (
                <CheckCircle2 className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <FileText className="w-6 h-6 text-blue-500 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className={`font-medium ${uploaded ? 'text-green-700' : 'text-blue-700'}`}>
                  {uploaded 
                    ? '✅ 状态：文章已上传到草稿箱，所有设置已自动填入'
                    : '📋 状态：文章已就绪，即将上传到草稿箱'
                  }
                </p>
                {!uploaded && (
                  <p className="mt-2 text-sm text-blue-600">
                    点击下方&quot;上传到草稿箱&quot;按钮，系统会自动填入所有发布设置。
                  </p>
                )}
                {uploaded && (
                  <div className="mt-3 flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      media_id: {mediaId}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={handleCopyMediaId} className="flex items-center gap-1">
                      <Copy className="w-3 h-3" />
                      复制
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：文章预览 */}
          <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-500" />
                即将上传的内容
              </CardTitle>
              <CardDescription>预览将要发布的文章</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">标题</Label>
                <p className="font-semibold text-lg">{taskInfo.taskTitle}</p>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">执行者</Label>
                <Badge variant="secondary">{taskInfo.executor}</Badge>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">子任务序号</Label>
                <Badge variant="outline">#{taskInfo.orderIndex}</Badge>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">内容摘要</Label>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 max-h-[200px] overflow-y-auto">
                  {taskInfo.articleContent || taskInfo.taskDescription || '(暂无内容预览，将在上传时获取完整内容)'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 右侧：发布设置 */}
          <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-sky-500" />
                自动填入的发布设置
              </CardTitle>
              <CardDescription>这些设置会在上传时自动应用（可临时修改）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 作者 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  作者
                </Label>
                <Input
                  value={config.author}
                  onChange={(e) => setConfig({ ...config, author: e.target.value })}
                  disabled={uploaded}
                />
              </div>

              {/* 原创声明 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Copyright className="w-4 h-4" />
                  原创声明
                </Label>
                <Select
                  value={String(config.isOriginal)}
                  onValueChange={(value) => setConfig({ ...config, isOriginal: Number(value) as 0 | 1 })}
                  disabled={uploaded}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">不声明原创</SelectItem>
                    <SelectItem value="1">声明原创</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 评论设置 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  评论设置
                </Label>
                <Select
                  value={`${config.needOpenComment}-${config.onlyFansCanComment}`}
                  onValueChange={(value) => {
                    const [open, fansOnly] = value.split('-').map(Number);
                    setConfig({
                      ...config,
                      needOpenComment: open as 0 | 1,
                      onlyFansCanComment: fansOnly as 0 | 1,
                    });
                  }}
                  disabled={uploaded}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-0">开启评论 - 所有人可评论</SelectItem>
                    <SelectItem value="1-1">开启评论 - 仅粉丝可评论</SelectItem>
                    <SelectItem value="0-0">关闭评论</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 赞赏设置 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  赞赏设置
                </Label>
                <Select
                  value={String(config.canReward)}
                  onValueChange={(value) => setConfig({ ...config, canReward: Number(value) as 0 | 1 })}
                  disabled={uploaded}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">关闭赞赏</SelectItem>
                    <SelectItem value="1">开启赞赏</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 封面显示 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  封面显示
                </Label>
                <Select
                  value={String(config.showCoverPic)}
                  onValueChange={(value) => setConfig({ ...config, showCoverPic: Number(value) as 0 | 1 })}
                  disabled={uploaded}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">不显示封面</SelectItem>
                    <SelectItem value="1">显示封面</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 操作说明 */}
        {!uploaded && (
          <Card className="bg-yellow-50/50 border-yellow-200/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800 space-y-2">
                  <p className="font-medium">操作说明：</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>点击下方&quot;上传到草稿箱&quot;按钮</li>
                    <li>系统自动填入上述所有发布设置</li>
                    <li>上传成功后，点击&quot;去公众号后台发布&quot;</li>
                    <li>在公众号后台找到对应草稿，直接点&quot;发布&quot;</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 最终操作按钮 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {!uploaded ? (
                  <Button
                    onClick={handleUploadToDraft}
                    disabled={uploading}
                    size="lg"
                    className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        上传中...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        上传到草稿箱
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleGoToWechat}
                    size="lg"
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 flex items-center gap-2"
                  >
                    <ExternalLink className="w-5 h-5" />
                    去公众号后台发布
                  </Button>
                )}
                
                {uploaded && (
                  <p className="text-sm text-green-600 font-medium">
                    ✅ 上传完成！去公众号只需点&quot;发布&quot;
                  </p>
                )}
              </div>
              
              <Link href="/wechat-config">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  修改默认配置
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PublishCenterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 mx-auto animate-spin text-sky-400" />
      </div>
    }>
      <PublishCenterContent />
    </Suspense>
  );
}