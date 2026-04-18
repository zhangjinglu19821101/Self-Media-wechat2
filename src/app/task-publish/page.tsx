'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Copy,
  AlertTriangle
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
  const router = useRouter();
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
    } else {
      setLoading(false);
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
        toast.error('加载任务信息失败：' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('加载任务信息失败:', error);
      toast.error('加载任务信息失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDefaultConfig = async () => {
    try {
      // 默认用第一个账号的配置
      const response = await fetch('/api/wechat/accounts/insurance-account/draft-config');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConfig(data.data);
        }
      }
    } catch (error) {
      console.error('加载默认配置失败:', error);
      // 保持默认值即可
    }
  };

  const handleUpload = async () => {
    if (!taskInfo) return;
    
    try {
      setUploading(true);
      
      const response = await fetch('/api/wechat/draft/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskInfo.id,
          accountId: 'insurance-account',
          overrides: config,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUploaded(true);
        setMediaId(data.data.mediaId);
        toast.success('草稿上传成功！');
      } else {
        toast.error('上传失败：' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('上传失败:', error);
      toast.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const copyMediaId = () => {
    if (mediaId) {
      navigator.clipboard.writeText(mediaId);
      toast.success('media_id 已复制');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto" />
          <p className="text-gray-500">加载发布就绪中心...</p>
        </div>
      </div>
    );
  }

  if (!taskId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <FileText className="w-12 h-12 text-gray-400 mx-auto" />
            <div>
              <h3 className="font-semibold text-lg">缺少任务参数</h3>
              <p className="text-sm text-gray-500 mt-1">请从任务时间线选择已完成的任务</p>
            </div>
            <Link href="/task-timeline">
              <Button className="bg-gradient-to-r from-green-500 to-emerald-500">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回任务时间线
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!taskInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <div>
              <h3 className="font-semibold text-lg">任务不存在</h3>
              <p className="text-sm text-gray-500 mt-1">找不到该任务信息</p>
            </div>
            <Link href="/task-timeline">
              <Button className="bg-gradient-to-r from-green-500 to-emerald-500">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回任务时间线
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="container mx-auto p-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-green-100/50 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            <Link href="/task-timeline" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div className="rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 p-3 shadow-lg">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                发布就绪中心
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                将完成的文章上传到公众号草稿箱
              </p>
            </div>
          </div>
          
          {taskInfo && (
            <Badge className="bg-green-100 text-green-700 text-sm">
              已完成 #{taskInfo.orderIndex}
            </Badge>
          )}
        </div>

        {/* 两栏布局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：文章预览 */}
          <Card className="bg-white/80 backdrop-blur-md border-green-100/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-500" />
                <CardTitle>文章预览</CardTitle>
              </div>
              <CardDescription>
                {taskInfo.taskTitle}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 min-h-[300px]">
                {taskInfo.articleContent ? (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {taskInfo.articleContent}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-12">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>文章内容将从任务中提取</p>
                    <p className="text-xs mt-1">（当前使用任务描述作为占位）</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 右侧：发布设置 */}
          <Card className="bg-white/80 backdrop-blur-md border-green-100/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-green-500" />
                <CardTitle>发布设置</CardTitle>
              </div>
              <CardDescription>
                上传前可临时调整，不影响保存的默认配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 作者 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  作者
                </Label>
                <Input
                  value={config.author}
                  onChange={(e) => setConfig({ ...config, author: e.target.value })}
                  placeholder="请输入作者名称"
                />
              </div>

              {/* 原创声明 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Copyright className="w-4 h-4" />
                  原创声明
                </Label>
                <RadioGroup
                  value={String(config.isOriginal)}
                  onValueChange={(v) => setConfig({ ...config, isOriginal: v === '1' ? 1 : 0 })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="1" id="original-yes" />
                    <Label htmlFor="original-yes">声明原创</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="0" id="original-no" />
                    <Label htmlFor="original-no">不声明</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* 评论设置 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  评论设置
                </Label>
                <RadioGroup
                  value={String(config.needOpenComment)}
                  onValueChange={(v) => setConfig({ ...config, needOpenComment: v === '1' ? 1 : 0 })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="1" id="comment-yes" />
                    <Label htmlFor="comment-yes">开启留言</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="0" id="comment-no" />
                    <Label htmlFor="comment-no">关闭留言</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 仅粉丝可评论 */}
              {config.needOpenComment === 1 && (
                <div className="space-y-2 pl-6">
                  <RadioGroup
                    value={String(config.onlyFansCanComment)}
                    onValueChange={(v) => setConfig({ ...config, onlyFansCanComment: v === '1' ? 1 : 0 })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="0" id="fans-no" />
                      <Label htmlFor="fans-no">所有人可留言</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="1" id="fans-yes" />
                      <Label htmlFor="fans-yes">仅粉丝可留言</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <Separator />

              {/* 赞赏设置 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  赞赏设置
                </Label>
                <RadioGroup
                  value={String(config.canReward)}
                  onValueChange={(v) => setConfig({ ...config, canReward: v === '1' ? 1 : 0 })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="1" id="reward-yes" />
                    <Label htmlFor="reward-yes">开启赞赏</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="0" id="reward-no" />
                    <Label htmlFor="reward-no">关闭赞赏</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* 封面显示 */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  封面显示
                </Label>
                <RadioGroup
                  value={String(config.showCoverPic)}
                  onValueChange={(v) => setConfig({ ...config, showCoverPic: v === '1' ? 1 : 0 })}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="1" id="cover-yes" />
                    <Label htmlFor="cover-yes">显示封面</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="0" id="cover-no" />
                    <Label htmlFor="cover-no">不显示封面</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 上传按钮 */}
              <div className="pt-4">
                {!uploaded ? (
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white h-12 text-lg"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        正在上传...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-2" />
                        上传到公众号草稿箱
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-green-700 font-medium mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        上传成功！
                      </div>
                      
                      {mediaId && (
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mt-2">
                          <span className="font-mono bg-white px-2 py-1 rounded border">
                            {mediaId}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={copyMediaId}
                            className="h-7 px-2 text-gray-500"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      asChild
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                    >
                      <a
                        href="https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&lang=zh_CN&token=0"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        去公众号后台发布
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function PublishCenterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto" />
          <p className="text-gray-500">加载发布就绪中心...</p>
        </div>
      </div>
    }>
      <PublishCenterContent />
    </Suspense>
  );
}
