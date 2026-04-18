/**
 * 开发环境页面预热脚本
 * 
 * 在服务启动后，自动请求所有页面路由，
 * 触发 Next.js 编译缓存，避免用户首次访问时的慢加载。
 * 
 * 仅在开发环境运行。
 */

const PAGES = [
  '/login',
  '/register',
  '/full-home',
  '/materials',
  '/digital-assets',
  '/style-init',
  '/style-replica',
  '/account-management',
  '/settings/team',
  '/publish/history',
  '/admin',
  '/query/agent-sub-tasks',
];

const BASE_URL = process.env.PREWARM_URL || 'http://localhost:5000';

async function prewarm() {
  console.log('[Prewarm] 开始预热页面...');
  
  for (const page of PAGES) {
    try {
      const start = Date.now();
      const res = await fetch(`${BASE_URL}${page}`, {
        signal: AbortSignal.timeout(30000), // 30秒超时
        redirect: 'manual', // 不跟随重定向
      });
      const elapsed = Date.now() - start;
      console.log(`[Prewarm] ${page} → ${res.status} (${elapsed}ms)`);
    } catch (err: any) {
      console.log(`[Prewarm] ${page} → 失败: ${err.message}`);
    }
  }
  
  console.log('[Prewarm] 预热完成');
}

// 延迟5秒执行，等待服务完全启动
setTimeout(prewarm, 5000);
