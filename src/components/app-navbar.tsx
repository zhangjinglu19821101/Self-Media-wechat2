'use client';

/**
 * 应用顶部导航栏
 * 
 * 包含 Workspace 切换器 + 页面导航链接 + 用户操作
 * 集成到 root layout 中，所有认证页面共享
 * 
 * 简化设计：主导航只显示核心功能，其它功能收起到下拉菜单
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { Button } from '@/components/ui/button';
import { useReminderNotification } from '@/hooks/use-browser-notification';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sparkles,
  FileText,
  Palette,
  BookOpen,
  Settings,
  Rocket,
  LogOut,
  Menu,
  X,
  Shield,
  Key,
  ChevronDown,
  Copy,
  Users,
  Bell,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

/** 主导航项（直接显示） */
const MAIN_NAV_ITEMS: NavItem[] = [
  { href: '/style-init', label: '风格初始化', icon: <Palette className="w-4 h-4" /> },
  { href: '/style-replica', label: '风格复刻', icon: <Copy className="w-4 h-4" /> },
  { href: '/account-management', label: '账号管理', icon: <Settings className="w-4 h-4" /> },
];

/** 其它配置菜单项（收起到下拉菜单） */
const OTHER_NAV_ITEMS: NavItem[] = [
  { href: '/full-home', label: '任务拆解', icon: <Sparkles className="w-4 h-4" /> },
  { href: '/publish/history', label: '发布记录', icon: <Rocket className="w-4 h-4" /> },
  { href: '/materials', label: '素材库', icon: <BookOpen className="w-4 h-4" /> },
  { href: '/digital-assets', label: '数字资产', icon: <FileText className="w-4 h-4" /> },
  { href: '/settings/api-keys', label: 'API Key', icon: <Key className="w-4 h-4" /> },
  { href: '/settings/team', label: '团队管理', icon: <Users className="w-4 h-4" /> },
];

export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);

  // 浏览器通知轮询
  useReminderNotification();

  // 登录/注册页不显示导航
  const isAuthPage = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    if (isAuthPage) return;

    // 检查是否是超级管理员
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        setIsSuperAdmin(data?.user?.role === 'super_admin');
      })
      .catch(() => {});

    // 加载逾期提醒数量
    const loadOverdueCount = async () => {
      try {
        const res = await fetch('/api/reminders?mode=stats', {
          headers: { 'x-workspace-id': localStorage.getItem('currentWorkspaceId') || '' },
        });
        const data = await res.json();
        if (data.success) {
          setOverdueCount(data.data.overdue || 0);
        }
      } catch {
        // 忽略错误
      }
    };
    loadOverdueCount();
    // 每 60 秒刷新一次
    const interval = setInterval(loadOverdueCount, 60000);

    const handler = (e: Event) => {
      // workspace 变化时可以触发其他逻辑（如刷新数据）
      void (e as CustomEvent).detail;
      loadOverdueCount();
    };
    window.addEventListener('workspace-changed', handler);
    return () => {
      window.removeEventListener('workspace-changed', handler);
      clearInterval(interval);
    };
  }, [isAuthPage]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      router.push('/login');
    } catch {
      // fallback
      window.location.href = '/login';
    }
  };

  const isActive = (href: string) => {
    if (href === '/full-home' && (pathname === '/' || pathname === '/full-home')) return true;
    return pathname.startsWith(href);
  };

  if (isAuthPage) return null;

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* 左侧: Logo + Workspace 切换器 */}
          <div className="flex items-center gap-4">
            <Link href="/full-home" className="flex items-center gap-2 text-lg font-bold text-gray-900 shrink-0">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <span className="hidden sm:inline">Agent 系统</span>
            </Link>
            <div className="hidden sm:block">
              <WorkspaceSwitcher />
            </div>
          </div>

          {/* 中间: 导航链接 (桌面) - 简化设计 */}
          <div className="hidden md:flex items-center gap-1">
            {/* 主导航项 */}
            {MAIN_NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}

            {/* 其它配置下拉菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                  <Settings className="w-4 h-4" />
                  其它配置
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {OTHER_NAV_ITEMS.map(item => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2 cursor-pointer ${
                        isActive(item.href) ? 'text-blue-700' : ''
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                {/* 超级管理员入口 */}
                {isSuperAdmin && (
                  <>
                    <div className="h-px bg-gray-100 my-1" />
                    <DropdownMenuItem asChild>
                      <Link
                        href="/admin"
                        className={`flex items-center gap-2 cursor-pointer ${
                          isActive('/admin') ? 'text-red-700' : 'text-red-600'
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                        后台管理
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 右侧: 提醒 + 退出 + 移动端菜单 */}
          <div className="flex items-center gap-2">
            {/* 提醒中心入口 */}
            <Link href="/reminders" className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-900"
              >
                <Bell className="w-4 h-4" />
                {overdueCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {overdueCount > 9 ? '9+' : overdueCount}
                  </span>
                )}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">退出</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* 移动端 Workspace 切换器 */}
        <div className="sm:hidden pb-2">
          <WorkspaceSwitcher />
        </div>
      </div>

      {/* 移动端菜单 - 简化设计 */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-2 space-y-1">
            {/* 主导航项 */}
            {MAIN_NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <div className="h-px bg-gray-100 my-2" />
            <div className="px-3 py-1 text-xs text-gray-400 font-medium">其它配置</div>
            {OTHER_NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(item.href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            {/* 超级管理员入口 */}
            {isSuperAdmin && (
              <>
                <div className="h-px bg-gray-100 my-2" />
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/admin')
                      ? 'bg-red-50 text-red-700'
                      : 'text-red-600 hover:bg-red-50'
                }`}
                >
                  <Shield className="w-4 h-4" />
                  后台管理
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
