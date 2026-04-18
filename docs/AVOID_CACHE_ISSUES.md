# 避免 Next.js 缓存问题的最佳实践

## 问题总结
在开发过程中，可能会遇到以下类似问题：
- 模块导入错误（`Attempted import error: 'xxx' is not exported`）
- 组件无法加载
- 热更新失效
- 修改代码后不生效

## 根本原因
1. **Next.js 缓存未及时更新**
2. **模块解析路径不一致**
3. **构建产物残留**
4. **依赖关系混乱**

---

## 一、配置优化

### 1.1 优化 next.config.ts

```typescript
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // 🔧 解决模块解析问题
  outputFileTracingRoot: path.resolve(__dirname, './'),

  // 🔧 配置文件监听，确保热更新正常
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000, // 每 1 秒检查一次文件变化
      aggregateTimeout: 300, // 延迟 300ms 后执行构建
      ignored: /node_modules/,
    };
    return config;
  },

  // 🔧 配置模块解析路径
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // 🔧 禁用 SWC 使用 Babel（如果存在 .babelrc）
  // 注意：这已在你的配置中自动处理

  allowedDevOrigins: ['*.dev.coze.site'],

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
```

### 1.2 优化 tsconfig.json（确保路径别名正确）

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 二、开发流程规范

### 2.1 添加便捷脚本

在 `package.json` 中添加以下脚本：

```json
{
  "scripts": {
    "dev": "coze dev",
    "dev:clean": "rm -rf .next && pnpm dev",
    "dev:hard": "rm -rf .next node_modules/.cache && pnpm install && pnpm dev",
    "build:clean": "rm -rf .next && pnpm build",
    "type-check": "tsc --noEmit"
  }
}
```

### 2.2 清理缓存的标准流程

#### 轻量级清理（推荐日常使用）
```bash
# 1. 清理 Next.js 缓存
rm -rf .next

# 2. 重启服务
coze dev
```

#### 完整清理（遇到无法解决的问题时）
```bash
# 1. 停止当前服务
pkill -f "next-server"

# 2. 清理所有缓存
rm -rf .next
rm -rf node_modules/.cache
rm -rf /tmp/.cache

# 3. 重新安装依赖（可选）
pnpm install

# 4. 重启服务
coze dev
```

### 2.3 何时需要清理缓存

✅ **必须清理的情况：**
- 修改了 `next.config.ts` 或 `tsconfig.json`
- 修改了 `@/` 路径别名
- 新增/删除了模块导出（如 `export function`）
- 重构了文件结构（移动/重命名文件）
- 热更新完全失效
- 出现模块导入错误

⚠️ **可能需要清理的情况：**
- 修改了依赖包版本
- 遇到莫名其妙的 TypeScript 错误
- 样式不更新

❌ **不需要清理的情况：**
- 修改组件内部逻辑
- 修改页面内容
- 修改 CSS 样式
- 修改常量配置

---

## 三、代码规范

### 3.1 统一使用路径别名

**推荐：** 始终使用 `@/` 别名
```typescript
// ✅ 正确
import { foo } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ❌ 避免
import { foo } from '../../../lib/utils';
```

### 3.2 明确的模块导出

**推荐：** 在文件顶部统一导出
```typescript
// ✅ 正确：清晰导出
export function formatCommandForAgent() {}
export async function sendCommandToAgent() {}
export interface DetectedCommand {}

// ❌ 避免：默认导出 + 命名导出混用
export default function xxx() {}
export function yyy() {}
```

### 3.3 避免循环依赖

```typescript
// ❌ 错误：循环依赖
// file-a.ts
import { funcB } from './file-b';
export function funcA() { funcB(); }

// file-b.ts
import { funcA } from './file-a';
export function funcB() { funcA(); }

// ✅ 正确：提取公共逻辑
// file-a.ts
import { common } from './common';
export function funcA() { common(); }

// file-b.ts
import { common } from './common';
export function funcB() { common(); }
```

---

## 四、监控和预防

### 4.1 添加启动检查脚本

创建 `scripts/check-modules.js`：

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 检查关键模块是否存在
const criticalModules = [
  'src/lib/command-detector.ts',
  'src/components/command-confirm-dialog.tsx',
  'src/lib/agent-types.ts',
];

console.log('🔍 检查关键模块...');

let hasErrors = false;

criticalModules.forEach((modulePath) => {
  const fullPath = path.join(__dirname, '..', modulePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ 模块不存在: ${modulePath}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${modulePath}`);
  }
});

if (hasErrors) {
  console.error('\n⚠️  发现问题，建议执行: pnpm run dev:clean');
  process.exit(1);
}

console.log('\n✅ 所有关键模块检查通过');
```

### 4.2 添加 git hooks（可选）

创建 `.husky/pre-commit`：

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# 类型检查
pnpm type-check

# 如果类型检查失败，阻止提交
if [ $? -ne 0 ]; then
  echo "❌ 类型检查失败，请修复后再提交"
  exit 1
fi
```

---

## 五、问题排查清单

遇到问题时，按以下顺序排查：

### 5.1 快速诊断

```bash
# 1. 检查文件是否存在
ls -la src/lib/command-detector.ts

# 2. 检查导出是否正确
grep "export function" src/lib/command-detector.ts

# 3. 检查控制台错误
tail -n 50 /app/work/logs/bypass/console.log | grep -i error

# 4. 尝试手动导入测试
node -e "const x = require('./src/lib/command-detector.ts'); console.log(x)"
```

### 5.2 常见错误及解决方案

| 错误现象 | 可能原因 | 解决方案 |
|---------|---------|---------|
| `Attempted import error: 'xxx' is not exported` | 缓存未更新 | `rm -rf .next && coze dev` |
| `Cannot find module '@/lib/xxx'` | 路径别名配置错误 | 检查 `tsconfig.json` |
| 热更新失效 | webpack 配置问题 | 检查 `next.config.ts` 的 `watchOptions` |
| 组件加载失败 | 循环依赖 | 检查导入关系，提取公共模块 |

---

## 六、最佳实践总结

### ✅ 每日开发
1. 使用 `pnpm dev` 启动服务
2. 依赖热更新进行开发
3. 遇到问题先检查控制台日志

### ⚠️ 每周维护
1. 清理一次缓存：`rm -rf .next`
2. 运行类型检查：`pnpm type-check`
3. 更新依赖（谨慎）

### 🚀 重大变更
1. 修改配置文件后必须清理缓存
2. 重构文件结构后必须重启服务
3. 部署前执行 `pnpm run build:clean`

---

## 七、紧急情况处理

如果所有方法都不起作用：

```bash
# 终极方案：完全重置环境
pkill -f "next-server"
pkill -f "coze dev"
rm -rf .next
rm -rf node_modules
rm -rf /tmp/.cache
pnpm install
coze dev
```

⚠️ **注意：** 终极方案会清除所有依赖，耗时较长，仅在必要时使用。
