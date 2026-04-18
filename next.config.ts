import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // 🔧 解决模块解析和缓存问题，消除多 lockfile 警告
  // outputFileTracingRoot: path.resolve(__dirname, './'),
  // 🔧 配置文件监听，确保热更新正常
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000, // 每 1 秒检查一次文件变化
      aggregateTimeout: 300, // 延迟 300ms 后执行构建
      ignored: /node_modules/,
    };
    // 排除原生模块，避免 webpack 打包
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('@napi-rs/canvas');
    }
    return config;
  },

  // 🔧 Turbopack 配置（Next.js 16+）
  turbopack: {},

  // 🔧 配置模块解析路径
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'date-fns', 'lodash'],
    // 预编译所有页面，避免首次访问时按需编译导致的慢加载
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
