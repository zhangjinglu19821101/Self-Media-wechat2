/**
 * 微信小程序 WebView 登录桥接页面
 * 
 * 核心流程：
 * 1. 小程序端通过 WebView 打开此页面（携带 env=miniprogram 参数）
 * 2. 页面加载后注入微信 JSSDK，调用 wx.miniProgram.getEnv 确认环境
 * 3. 调用 wx.login() 获取 code（需通过 postMessage 请求小程序端执行）
 * 4. 将 code 发送到 /api/auth/wechat/miniprogram 获取 Token
 * 5. Token 存入 localStorage（Bearer Token 模式）
 * 6. 通知小程序端登录成功
 * 7. 跳转到主页面
 * 
 * 备用流程（非小程序环境）：
 * - 显示账号密码登录表单（复用 /login 的逻辑）
 * - 登录成功后同时获取 Bearer Token 并存储
 * 
 * URL 参数：
 * - env=miniprogram: 标记小程序环境
 * - callbackUrl: 登录成功后跳转地址
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, AlertCircle, Smartphone } from 'lucide-react';
import Link from 'next/link';
import {
  isMiniProgram,
  isBearerAuthMode,
  getAccessToken,
  clearTokens,
} from '@/lib/auth/token-store';
import { loginWithWechatCode } from '@/lib/api/client';

// 微信 JSSDK 类型声明
declare global {
  interface Window {
    __wxjs_environment?: string;
    wx?: {
      miniProgram?: {
        getEnv(callback: (res: { miniprogram: boolean }) => void): void;
        postMessage(data: Record<string, unknown>): void;
        navigateTo(params: { url: string }): void;
        reLaunch(params: { url: string }): void;
        switchTab(params: { url: string }): void;
      };
    };
  }
}

export default function WechatLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
      <WechatLoginContent />
    </Suspense>
  );
}

function WechatLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/full-home';
  const envParam = searchParams.get('env');

  const [isInMiniProgram, setIsInMiniProgram] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [wechatError, setWechatError] = useState('');

  // 备用：账号密码登录
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // 检测小程序环境
  useEffect(() => {
    const check = async () => {
      const isMP = isMiniProgram() || envParam === 'miniprogram';
      setIsInMiniProgram(isMP);

      if (isMP) {
        // 自动触发微信登录
        await handleWechatLogin();
      }
    };
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 微信小程序登录流程
   * 
   * 流程说明：
   * - WebView 内无法直接调用 wx.login()（这是小程序 API，不是 JSSDK API）
   * - 需要通过 postMessage 请求小程序端执行 wx.login() 并回传 code
   * - 如果小程序端未实现监听，则显示手动输入 code 的界面（开发调试用）
   */
  const handleWechatLogin = useCallback(async () => {
    setWechatLoading(true);
    setWechatError('');

    try {
      // 方式1：从 URL 参数获取 code（小程序端通过 URL 传递）
      const urlCode = searchParams.get('code');
      if (urlCode) {
        const result = await loginWithWechatCode(urlCode);
        if (result.success) {
          onLoginSuccess(result.userId, result.workspaceId);
          return;
        }
        setWechatError('微信登录失败，请重试');
        return;
      }

      // 方式2：通过 postMessage 请求小程序端执行 wx.login
      if (window.wx?.miniProgram) {
        // 设置 code 监听（小程序端回传 code 的机制）
        window.addEventListener('message', handleMiniProgramMessage);

        // 请求小程序端获取 code
        window.wx.miniProgram.postMessage({
          type: 'request_wx_login',
          timestamp: Date.now(),
        });

        // 设置超时：5 秒内未收到 code 则提示
        setTimeout(() => {
          window.removeEventListener('message', handleMiniProgramMessage);
          if (wechatLoading) {
            setWechatError('未收到微信授权，请确认小程序已实现登录监听');
            setWechatLoading(false);
          }
        }, 5000);
        return;
      }

      // 方式3：非小程序 WebView 环境，无法自动登录
      setWechatError('未检测到微信小程序环境，请使用账号密码登录');
    } catch (error) {
      setWechatError('微信登录异常，请使用账号密码登录');
    } finally {
      setWechatLoading(false);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 监听小程序端回传的 wx.login code */
  const handleMiniProgramMessage = useCallback((event: MessageEvent) => {
    const data = event.data;
    if (data?.type === 'wx_login_code' && data?.code) {
      window.removeEventListener('message', handleMiniProgramMessage);
      loginWithWechatCode(data.code).then(result => {
        if (result.success) {
          onLoginSuccess(result.userId, result.workspaceId);
        } else {
          setWechatError('微信登录失败，请重试');
          setWechatLoading(false);
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** 登录成功回调 */
  const onLoginSuccess = (userId?: string, workspaceId?: string) => {
    // 通知小程序端登录成功
    if (window.wx?.miniProgram) {
      window.wx.miniProgram.postMessage({
        type: 'login_success',
        userId,
        workspaceId,
        timestamp: Date.now(),
      });
    }

    // 跳转到目标页面
    router.push(callbackUrl);
    router.refresh();
  };

  /** 备用：账号密码登录（同时获取 Bearer Token） */
  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!email || !password) {
      setLoginError('请填写邮箱和密码');
      return;
    }

    setLoginLoading(true);
    try {
      // 先走 NextAuth Cookie 登录
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setLoginError('邮箱或密码不正确');
        return;
      }

      // Cookie 登录成功后，额外获取 Bearer Token（用于后续 API 调用）
      try {
        const tokenResponse = await fetch('/api/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, deviceType: 'web', deviceName: 'WebView' }),
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.success && tokenData.data?.accessToken) {
            const { setTokens } = await import('@/lib/auth/token-store');
            setTokens(
              {
                accessToken: tokenData.data.accessToken,
                refreshToken: tokenData.data.refreshToken,
                expiresIn: tokenData.data.expiresIn || 3600,
              },
              tokenData.data.userId || '',
              tokenData.data.workspaceId || ''
            );
          }
        }
      } catch {
        // Bearer Token 获取失败不影响登录
        console.warn('[WechatLogin] Bearer Token 获取失败，将使用 Cookie 模式');
      }

      // 等待 session cookie 设置
      await new Promise(resolve => setTimeout(resolve, 200));
      await router.push(callbackUrl);
      router.refresh();
    } catch {
      setLoginError('登录失败，请稍后重试');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Smartphone className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold">微信小程序登录</CardTitle>
          <CardDescription>
            {isInMiniProgram ? '正在通过微信授权登录...' : '请选择登录方式'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 微信自动登录状态 */}
          {isInMiniProgram && (
            <div className="space-y-4">
              {wechatLoading && (
                <div className="flex flex-col items-center py-8 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                  <p className="text-sm text-slate-500">正在获取微信授权...</p>
                </div>
              )}

              {wechatError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{wechatError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* 备用：账号密码登录 */}
          {(!isInMiniProgram || wechatError) && (
            <div className={isInMiniProgram ? 'mt-4 pt-4 border-t' : ''}>
              {isInMiniProgram && (
                <p className="text-sm text-slate-500 mb-4 text-center">
                  微信授权失败，请使用账号密码登录
                </p>
              )}
              <form onSubmit={handleCredentialLogin} className="space-y-4">
                {loginError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      disabled={loginLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      disabled={loginLoading}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loginLoading}>
                  {loginLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    '账号密码登录'
                  )}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm text-slate-500">
                还没有账号？{' '}
                <Link href="/register" className="text-blue-600 hover:underline">
                  注册
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
