'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ScanLine,
  ShieldCheck,
  QrCode,
  User,
  Copyright,
  MessageCircle,
  Heart,
  FolderOpen,
  Image as ImageIcon,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface WechatDraftDefaults {
  author: string;
  isOriginal: 0 | 1;
  needOpenComment: 0 | 1;
  onlyFansCanComment: 0 | 1;
  canReward: 0 | 1;
  showCoverPic: 0 | 1;
  defaultNewsId?: string;
  defaultNewsName?: string;
}

export default function WechatConfigPage() {
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('insurance-account');
  const [config, setConfig] = useState<WechatDraftDefaults>({
    author: '智者足迹-探寻',
    isOriginal: 1,
    needOpenComment: 1,
    onlyFansCanComment: 0,
    canReward: 1,
    showCoverPic: 0,
    defaultNewsId: undefined,
    defaultNewsName: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'unknown' | 'logged_in' | 'not_logged_in'>('unknown');
  const [qrLoading, setQrLoading] = useState(false);

  // 加载当前配置
  useEffect(() => {
    loadConfig();
    checkLoginStatus();
  }, [selectedAccountId]);

  // 检查公众号登录状态
  const checkLoginStatus = async () => {
    try {
      const response = await fetch(`/api/wechat/automation/login?accountId=${selectedAccountId}`);
      const data = await response.json();
      if (data.success && data.status === 'confirmed') {
        setLoginStatus('logged_in');
      } else {
        setLoginStatus('not_logged_in');
      }
    } catch {
      setLoginStatus('not_logged_in');
    }
  };

  // 发起扫码登录
  const handleQRLogin = async () => {
    try {
      setQrLoading(true);
      const response = await fetch('/api/wechat/automation/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccountId }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('请在弹出的公众号页面中扫码登录');
        // 轮询登录状态
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/wechat/automation/login?accountId=${selectedAccountId}`);
          const statusData = await statusRes.json();
          if (statusData.status === 'confirmed') {
            setLoginStatus('logged_in');
            toast.success('登录成功！现在可以自动配置原创声明、赞赏等设置');
            clearInterval(pollInterval);
          } else if (statusData.status === 'expired') {
            toast.error('二维码已过期，请重新扫码');
            clearInterval(pollInterval);
          }
        }, 3000);
        
        // 60秒后停止轮询
        setTimeout(() => clearInterval(pollInterval), 60000);
      } else {
        toast.error(`扫码登录失败: ${data.error}`);
      }
    } catch (error) {
      toast.error('扫码登录失败');
    } finally {
      setQrLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      
      // 🔥 调用后端API加载配置
      const response = await fetch(`/api/wechat/accounts/${selectedAccountId}/draft-config`);
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
        console.log('✅ 已加载配置:', data.data);
      } else {
        toast.error(`加载配置失败: ${data.error}`);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      toast.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // 🔥 调用后端API保存配置
      const response = await fetch(`/api/wechat/accounts/${selectedAccountId}/draft-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSaveSuccess(true);
        setShowBanner(true);
        toast.success('配置已保存成功！上传草稿时将自动使用这些设置。');

        // 延迟一小会儿让用户看到"已保存"按钮，然后跳转
        setTimeout(() => {
          router.push('/task-timeline?from=wechat-config');
        }, 600);
      } else {
        toast.error(`保存失败: ${data.error}`);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      toast.error('保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('确定要重置为默认配置吗？')) {
      setConfig({
        author: '智者足迹-探寻',
        isOriginal: 1,
        needOpenComment: 1,
        onlyFansCanComment: 0,
        canReward: 1,
        showCoverPic: 0,
        defaultNewsId: undefined,
        defaultNewsName: undefined,
      });
      toast.info('已重置为默认配置');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50">
      <div className="container mx-auto p-6 space-y-6 max-w-4xl">
        {/* 页面标题 */}
        <div className="flex items-center justify-between bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-sky-100/50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 p-3 shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-transparent">
                公众号发布配置
              </h1>
              <p className="text-muted-foreground mt-1">配置草稿箱自动填写的发布设置</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              返回首页
            </Button>
          </Link>
        </div>

        {/* ✅ 保存成功横幅 - 第2层反馈（最显眼） */}
        {showBanner && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
            <div className="rounded-full bg-green-500 p-1.5 flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-800">配置保存成功</p>
              <p className="text-sm text-green-600">上传草稿到公众号时，将自动使用以上设置</p>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-green-400 hover:text-green-600 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* 🔥 扫码登录状态卡片 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-indigo-100/50">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 p-2 flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                  自动配置授权
                  <Badge variant="outline" className={
                    loginStatus === 'logged_in'
                      ? 'bg-green-100 text-green-700 border-green-200 text-xs'
                      : 'bg-gray-100 text-gray-600 border-gray-200 text-xs'
                  }>
                    {loginStatus === 'logged_in' ? '已授权' : '未授权'}
                  </Badge>
                </h3>
                <p className="text-sm text-indigo-600 mt-0.5">
                  授权后可自动设置原创声明、赞赏、合集等
                </p>
              </div>
            </div>
          </div>
          <CardContent className="pt-5">
            {loginStatus === 'logged_in' ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 text-sm">已登录公众号</p>
                  <p className="text-xs text-green-600">系统将自动配置原创声明、赞赏、合集等设置</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <ScanLine className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-800 text-sm">未授权公众号登录</p>
                    <p className="text-xs text-amber-600 mt-1">
                      原创声明、赞赏、合集等设置需要模拟操作公众号后台，请先扫码授权
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleQRLogin}
                  disabled={qrLoading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 flex items-center gap-2"
                >
                  {qrLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      等待扫码中...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      扫码登录公众号
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-400 text-center">
                  不授权也不影响基本功能（作者、摘要、评论等仍可自动设置）
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 📝 配置说明卡片 - 业界标准设计 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-sky-50 to-cyan-50 px-6 py-4 border-b border-sky-100/50">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gradient-to-br from-sky-400 to-cyan-500 p-2 flex-shrink-0">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sky-900 flex items-center gap-2">
                  智能发布助手
                  <Badge variant="outline" className="bg-white text-sky-600 border-sky-200 text-xs">
                    自动化
                  </Badge>
                </h3>
                <p className="text-sm text-sky-600 mt-0.5">一次配置，终身省心</p>
              </div>
            </div>
          </div>
          <CardContent className="pt-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-green-100 p-1.5 flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">发布零重复操作</p>
                  <p className="text-xs text-gray-500 mt-1">上传草稿时自动填入作者、原创声明等设置</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-blue-100 p-1.5 flex-shrink-0 mt-0.5">
                  <Save className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-800 text-sm">云端持久化保存</p>
                  <p className="text-xs text-gray-500 mt-1">配置安全存储，下次访问自动恢复</p>
                </div>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="text-lg">💡</span>
                <span>注：如需要临时调整，发布就绪中心支持在上传前覆盖配置</span>
              </div>
              <Link href="/task-timeline" className="text-xs text-sky-600 hover:text-sky-700 font-medium">
                查看发布就绪中心 →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 公众号选择 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              选择公众号
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="选择公众号" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insurance-account">保险科普公众号</SelectItem>
                <SelectItem value="ai-tech-account">AI技术公众号</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* 作者信息 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-sky-500" />
              作者信息
            </CardTitle>
            <CardDescription>设置文章的作者名称</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="author">作者名称</Label>
              <Input
                id="author"
                value={config.author}
                onChange={(e) => setConfig({ ...config, author: e.target.value })}
                placeholder="请输入作者名称"
              />
              <p className="text-xs text-muted-foreground">
                将显示在文章标题下方，如：保险科普、AI技术等
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 原创声明 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Copyright className="w-5 h-5 text-sky-500" />
              原创声明
            </CardTitle>
            <CardDescription>是否在公众号中声明原创</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={String(config.isOriginal)}
              onValueChange={(value) => setConfig({ ...config, isOriginal: Number(value) as 0 | 1 })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="0" id="original-no" />
                <Label htmlFor="original-no" className="cursor-pointer">不声明原创</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1" id="original-yes" />
                <Label htmlFor="original-yes" className="cursor-pointer">声明原创</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              如果你的内容是原创的，建议开启原创声明以获得更好的保护
            </p>
          </CardContent>
        </Card>

        {/* 评论设置 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-sky-500" />
              评论设置
            </CardTitle>
            <CardDescription>控制文章的评论功能</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>是否开启评论</Label>
              <RadioGroup
                value={String(config.needOpenComment)}
                onValueChange={(value) => setConfig({ ...config, needOpenComment: Number(value) as 0 | 1 })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1" id="comment-open" />
                  <Label htmlFor="comment-open" className="cursor-pointer">开启评论</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="0" id="comment-close" />
                  <Label htmlFor="comment-close" className="cursor-pointer">关闭评论</Label>
                </div>
              </RadioGroup>
            </div>

            {config.needOpenComment === 1 && (
              <div className="space-y-3 pl-4 border-l-2 border-sky-100">
                <Label>谁可以评论</Label>
                <RadioGroup
                  value={String(config.onlyFansCanComment)}
                  onValueChange={(value) => setConfig({ ...config, onlyFansCanComment: Number(value) as 0 | 1 })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="0" id="comment-all" />
                    <Label htmlFor="comment-all" className="cursor-pointer">所有人可评论</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="comment-fans" />
                    <Label htmlFor="comment-fans" className="cursor-pointer">仅粉丝可评论</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 赞赏设置 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="w-5 h-5 text-sky-500" />
              赞赏设置
            </CardTitle>
            <CardDescription>是否允许读者赞赏</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={String(config.canReward)}
              onValueChange={(value) => setConfig({ ...config, canReward: Number(value) as 0 | 1 })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="0" id="reward-close" />
                <Label htmlFor="reward-close" className="cursor-pointer">关闭赞赏</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1" id="reward-open" />
                <Label htmlFor="reward-open" className="cursor-pointer">开启赞赏</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* 封面和合集 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-sky-500" />
              封面显示
            </CardTitle>
            <CardDescription>是否在正文中显示封面图片</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={String(config.showCoverPic)}
              onValueChange={(value) => setConfig({ ...config, showCoverPic: Number(value) as 0 | 1 })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="0" id="cover-hide" />
                <Label htmlFor="cover-hide" className="cursor-pointer">不显示封面</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1" id="cover-show" />
                <Label htmlFor="cover-show" className="cursor-pointer">显示封面</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <Card className="bg-white/80 backdrop-blur-md border-sky-100/50 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  重置为默认值
                </Button>
              </div>

              {/* 第1层：保存按钮 - 成功态变绿+打勾 */}
              {saveSuccess ? (
                <div className="flex items-center gap-2 bg-green-500 text-white px-5 py-2.5 rounded-lg font-medium animate-in zoom-in-95 duration-200">
                  <CheckCircle2 className="w-5 h-5" />
                  已保存
                </div>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 flex items-center gap-2 min-w-[120px] justify-center"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      保存配置
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}