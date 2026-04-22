'use client';

/**
 * 账户设置页面
 * 
 * 功能：
 * - 修改密码
 * - 查看账户信息
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api/client';

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // 修改密码状态
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | ''>('');

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const res = await apiGet<{ success: boolean; data: UserInfo }>('/api/auth/session');
      if (res.success && res.data) {
        setUserInfo(res.data);
      }
    } catch (err) {
      console.error('[AccountSettings] 加载用户信息失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 密码强度检测
  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength('');
      return;
    }

    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[a-z]/.test(newPassword)) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^a-zA-Z0-9]/.test(newPassword)) score++;

    if (score <= 2) setPasswordStrength('weak');
    else if (score <= 4) setPasswordStrength('medium');
    else setPasswordStrength('strong');
  }, [newPassword]);

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-gray-200';
    }
  };

  const getPasswordStrengthLabel = () => {
    switch (passwordStrength) {
      case 'weak': return '弱';
      case 'medium': return '中等';
      case 'strong': return '强';
      default: return '';
    }
  };

  const handleChangePassword = async () => {
    // 验证输入
    if (!currentPassword) {
      toast.error('请输入当前密码');
      return;
    }
    if (!newPassword) {
      toast.error('请输入新密码');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('新密码至少需要 8 个字符');
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast.error('新密码需要包含字母和数字');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await apiPost<{ success: boolean; message: string }>(
        '/api/auth/change-password',
        {
          currentPassword,
          newPassword,
        }
      );

      if (res.success) {
        toast.success('密码修改成功！请重新登录');
        // 清空表单
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // 延迟跳转到登录页
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else {
        toast.error(res.message || '密码修改失败');
      }
    } catch (err: any) {
      if (err?.status === 401) {
        toast.error('当前密码错误');
      } else {
        toast.error('密码修改失败，请稍后重试');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="w-6 h-6" />
            账户设置
          </h1>
          <p className="text-sm text-slate-500 mt-1">管理您的账户信息和安全设置</p>
        </div>

        {/* 账户信息卡片 */}
        {userInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">账户信息</CardTitle>
              <CardDescription>您的基本账户信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-slate-500">姓名</Label>
                  <p className="font-medium">{userInfo.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-slate-500">邮箱</Label>
                  <p className="font-medium">{userInfo.email}</p>
                </div>
                <div>
                  <Label className="text-sm text-slate-500">角色</Label>
                  <p className="font-medium">
                    {userInfo.role === 'super_admin' ? '超级管理员' : '普通用户'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-slate-500">注册时间</Label>
                  <p className="font-medium">
                    {new Date(userInfo.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                {userInfo.lastLoginAt && (
                  <div className="col-span-2">
                    <Label className="text-sm text-slate-500">最后登录</Label>
                    <p className="font-medium">
                      {new Date(userInfo.lastLoginAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* 修改密码卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5" />
              修改密码
            </CardTitle>
            <CardDescription>定期修改密码可以保护您的账户安全</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">当前密码</Label>
              <Input
                id="currentPassword"
                type="password"
                placeholder="请输入当前密码"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={changingPassword}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="请输入新密码（至少 8 位，包含字母和数字）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changingPassword}
              />
              {passwordStrength && (
                <div className="flex items-center gap-2">
                  <div className={`h-2 flex-1 rounded-full ${getPasswordStrengthColor()}`} />
                  <span className="text-xs text-slate-500">
                    密码强度: {getPasswordStrengthLabel()}
                  </span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                密码要求：至少 8 个字符，包含字母和数字
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changingPassword}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  两次输入的密码不一致
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  两次输入的密码一致
                </p>
              )}
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  正在修改...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  修改密码
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
