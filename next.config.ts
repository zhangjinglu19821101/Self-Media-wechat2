import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 跳过 TypeScript 类型检查，加速构建
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 🔧 Turbopack 配置（Next.js 16+）
  turbopack: {},

  // 🔧 配置原生模块为外部包（Turbopack 构建）
  serverExternalPackages: ['@napi-rs/canvas'],

  // 🔧 配置模块解析路径
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns', 'lodash'],
    workerThreads: true,
    cpus: 4,
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
