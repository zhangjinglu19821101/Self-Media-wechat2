'use client';

/**
 * 客户端布局包装器
 * 
 * 在 root layout 中渲染 AppNavbar，处理认证状态的客户端展示
 */

import { AppNavbar } from '@/components/app-navbar';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNavbar />
      {children}
    </>
  );
}
