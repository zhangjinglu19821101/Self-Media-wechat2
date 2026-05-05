import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 跳过 TypeScript 类型检查，加速构建
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 🔧 配置原生模块为外部包
  serverExternalPackages: ['@napi-rs/canvas', 'postgres', 'drizzle-orm', 'playwright'],

  // 🔧 配置模块解析路径
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns', 'lodash'],
    // 禁用 worker threads 避免序列化问题
    workerThreads: false,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'coze-coding-dev.tos.coze.site',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
