# 避免 Next.js 缓存问题 - 快速指南

## 问题
在开发过程中，可能会遇到模块导入错误、热更新失效等问题，通常是 Next.js 缓存导致的。

## 快速解决方案

### 1. 轻量级清理（推荐日常使用）
```bash
pnpm run clean
pnpm run dev
```

### 2. 标准清理（遇到模块导入错误时）
```bash
pnpm run dev:clean
```

### 3. 完整清理（遇到顽固问题时）
```bash
pnpm run dev:hard
```

### 4. 手动清理（终极方案）
```bash
pkill -f "next-server"
rm -rf .next node_modules
pnpm install
coze dev
```

## 何时需要清理缓存

✅ **必须清理：**
- 修改了 `next.config.ts` 或 `tsconfig.json`
- 修改了模块导出（新增/删除 `export function`）
- 重构文件结构（移动/重命名文件）
- 出现模块导入错误（`Attempted import error`）
- 热更新完全失效

⚠️ **可能需要清理：**
- 修改了依赖包版本
- 遇到莫名其妙的 TypeScript 错误
- 样式不更新

❌ **不需要清理：**
- 修改组件内部逻辑
- 修改页面内容
- 修改 CSS 样式

## 可用的 npm 脚本

```bash
pnpm run dev          # 正常启动开发服务器
pnpm run dev:clean    # 清理缓存后启动
pnpm run dev:hard     # 完整清理后启动（重新安装依赖）
pnpm run clean        # 仅清理缓存
pnpm run type-check   # TypeScript 类型检查
```

## 预防措施

### 1. 代码规范
- ✅ 统一使用 `@/` 路径别名
- ✅ 明确的模块导出（文件顶部统一 `export`）
- ✅ 避免循环依赖

### 2. 配置优化
已优化 `next.config.ts`：
- 启用文件监听（每 1 秒检查一次）
- 配置模块路径解析
- 优化常用包导入

### 3. 监控日志
遇到问题时先查看日志：
```bash
tail -n 50 /app/work/logs/bypass/console.log | grep -i error
```

## 常见错误及解决方案

| 错误现象 | 解决方案 |
|---------|---------|
| `Attempted import error: 'xxx' is not exported` | `pnpm run dev:clean` |
| `Cannot find module '@/lib/xxx'` | 检查 `tsconfig.json` 路径配置 |
| 热更新失效 | `pnpm run clean && pnpm run dev` |
| 组件加载失败 | `pnpm run dev:clean` |

## 详细文档

查看完整文档：[docs/AVOID_CACHE_ISSUES.md](./docs/AVOID_CACHE_ISSUES.md)

包含以下内容：
- 详细的配置优化方案
- 开发流程规范
- 代码规范建议
- 问题排查清单
- 紧急情况处理
