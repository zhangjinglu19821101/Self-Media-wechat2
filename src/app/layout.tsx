import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { ClientLayout } from '@/components/client-layout';

// 🔥 在应用启动时初始化 WebSocket 服务器
import '@/lib/websocket-server';

// 🔥 在应用启动时启动定时任务调度器
// 注意：TSScheduler 和 AgentBInspector 暂时禁用，因为它们有导入问题
// import { TSScheduler } from '@/lib/services/ts-scheduler';
// import { AgentBInspector } from '@/lib/services/agent-b-inspector';
import { startAllCronJobs } from '@/lib/cron';

// 🔥 MCP 工具自动注册器
import { toolAutoRegistrar } from '@/lib/mcp/tool-auto-registrar';

// 启动后台服务（仅在服务端运行）
if (typeof window === 'undefined') {
  // 暂时禁用：TS 定时任务（每 10 分钟检查一次）
  // TSScheduler.start();
  // console.log('✅ TS 定时任务已启动');

  // 暂时禁用：Agent B 巡检（每日 13:00）
  // AgentBInspector.start();
  // console.log('✅ Agent B 巡检服务已启动');

  // 🔥 开启定时任务调度器（轮巡、分发、监控、上报）
  startAllCronJobs();
  console.log('✅ 定时任务调度器已启动');

  // 🔥 初始化 MCP 工具自动注册器（启动时注册 + 每10分钟刷新）
  console.log('[Init] 开始初始化 MCP 工具自动注册器...');
  toolAutoRegistrar.initialize().catch(error => {
    console.error('[Init] MCP 工具自动注册器初始化失败:', error);
    // 注意：不要让初始化失败阻断服务启动
  });
}

export const metadata: Metadata = {
  title: {
    default: '新应用 | 扣子编程',
    template: '%s | 扣子编程',
  },
  description:
    '扣子编程是一款一站式云端 Vibe Coding 开发平台。通过对话轻松构建智能体、工作流和网站，实现从创意到上线的无缝衔接。',
  keywords: [
    '扣子编程',
    'Coze Code',
    'Vibe Coding',
    'AI 编程',
    '智能体搭建',
    '工作流搭建',
    '网站搭建',
    '网站部署',
    '全栈开发',
    'AI 工程师',
  ],
  authors: [{ name: 'Coze Code Team', url: 'https://code.coze.cn' }],
  generator: 'Coze Code',
  // icons: {
  //   icon: '',
  // },
  openGraph: {
    title: '扣子编程 | 你的 AI 工程师已就位',
    description:
      '我正在使用扣子编程 Vibe Coding，让创意瞬间上线。告别拖拽，拥抱心流。',
    url: 'https://code.coze.cn',
    siteName: '扣子编程',
    locale: 'zh_CN',
    type: 'website',
    // images: [
    //   {
    //     url: '',
    //     width: 1200,
    //     height: 630,
    //     alt: '扣子编程 - 你的 AI 工程师',
    //   },
    // ],
  },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'Coze Code | Your AI Engineer is Here',
  //   description:
  //     'Build and deploy full-stack applications through AI conversation. No env setup, just flow.',
  //   // images: [''],
  // },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`antialiased`} suppressHydrationWarning>
        <ClientLayout>
          {children}
        </ClientLayout>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
