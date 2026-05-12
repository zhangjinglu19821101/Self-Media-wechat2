# 平台化改造方案

## 📋 方案概述

### 核心目标
将当前工程改造为**可复用的基础技术平台**，实现：
- ✅ 基础技术能力作为独立包共享
- ✅ 支持多业务线快速接入
- ✅ 平台升级可快速同步到各业务线
- ✅ 类似 Java JAR 包的升级体验

---

## 🏗️ 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        业务应用层 (Business Apps)                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  保险事业部应用   │  │  AI事业部应用     │  │  电商事业部   │ │
│  │  (insurance-app) │  │  (ai-app)        │  │  (ecommerce) │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│           │                       │                       │        │
│           └───────────────────────┼───────────────────────┘        │
│                                   │                                │
├───────────────────────────────────┼────────────────────────────────┤
│                                   │                                │
│         基础技术平台层 (Platform Layer)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @multi-platform/platform-core (核心包)                   │  │
│  │  - Agent T (技术专家)                                     │  │
│  │  - Agent B (协调专家)                                     │  │
│  │  - 任务执行引擎                                            │  │
│  │  - MCP 能力管理                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @multi-platform/platform-ui (UI组件包)                   │  │
│  │  - shadcn/ui 组件                                          │  │
│  │  - Agent 聊天界面                                          │  │
│  │  - 任务管理界面                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  @multi-platform/platform-config (配置系统)                │  │
│  │  - 事业部配置加载器                                        │  │
│  │  - 配置验证器                                              │  │
│  │  - 热加载支持                                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 包结构设计

```
multi-platform-platform/          # 平台仓库（独立 Git 仓库）
├── packages/
│   ├── platform-core/            # 核心包
│   │   ├── src/
│   │   │   ├── agents/           # Agent T, Agent B
│   │   │   ├── services/         # 任务执行引擎
│   │   │   ├── mcp/              # MCP 能力管理
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── platform-ui/              # UI 组件包
│   │   ├── src/
│   │   │   ├── components/       # 可复用组件
│   │   │   ├── hooks/            # 可复用 Hooks
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── platform-config/          # 配置系统包
│       ├── src/
│       │   ├── loader.ts
│       │   ├── validator.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── templates/                     # 业务应用模板
│   └── business-app-template/    # 快速启动模板
│       ├── src/
│       ├── package.json
│       └── README.md
│
├── package.json                   # Monorepo 配置
├── pnpm-workspace.yaml
└── README.md


insurance-app/                     # 保险事业部应用（独立仓库）
├── src/
│   ├── config/                    # 保险事业部配置
│   │   └── business-units/
│   │       └── insurance/
│   └── app/                       # 业务特定页面
├── package.json
│   {
│     "dependencies": {
│       "@multi-platform/platform-core": "^1.0.0",
│       "@multi-platform/platform-ui": "^1.0.0",
│       "@multi-platform/platform-config": "^1.0.0"
│     }
│   }
└── README.md


ai-app/                           # AI事业部应用（独立仓库）
├── src/
│   ├── config/                   # AI事业部配置
│   └── app/                      # AI特定页面
├── package.json
└── README.md
```

---

## 📦 技术方案

### 方案一：Monorepo + 内部包（推荐）

#### 优点
- ✅ 统一管理，代码共享方便
- ✅ 版本同步简单
- ✅ 开发体验好（热更新、类型提示）
- ✅ 适合初期快速迭代

#### 实现步骤

**1. 创建 Monorepo 结构**

```bash
# 创建新的平台仓库
mkdir multi-platform-platform
cd multi-platform-platform

# 初始化 pnpm workspace
pnpm init
```

**2. 配置 pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
  - 'templates/*'
```

**3. 创建核心包**

```bash
cd packages
mkdir platform-core platform-ui platform-config

# 初始化每个包
cd platform-core
pnpm init
# ... 复制核心代码
```

**4. 业务应用使用平台包**

```json
{
  "name": "insurance-app",
  "dependencies": {
    "@multi-platform/platform-core": "workspace:*",
    "@multi-platform/platform-ui": "workspace:*",
    "@multi-platform/platform-config": "workspace:*"
  }
}
```

### 方案二：独立 npm 包（生产级）

#### 优点
- ✅ 真正的独立版本管理
- ✅ 各业务线可以按自己的节奏升级
- ✅ 适合成熟稳定的平台

#### 实现步骤

**1. 发布到 npm（或私有 npm  registry）**

```bash
# 每个包独立发布
cd packages/platform-core
npm version patch
npm publish --access public
```

**2. 业务应用升级**

```bash
# 升级平台包
pnpm update @multi-platform/platform-core

# 或者指定版本
pnpm add @multi-platform/platform-core@^1.1.0
```

### 方案三：Git Submodule + 符号链接（简单快速）

#### 优点
- ✅ 无需发布到 npm
- ✅ 代码变更即时生效
- ✅ 适合快速验证

#### 实现步骤

```bash
# 业务应用中添加 submodule
git submodule add <platform-repo-url> ./platform

# 创建符号链接
ln -s ./platform/packages/platform-core/src ./node_modules/@multi-platform/platform-core
```

---

## 🚀 推荐实施方案

### 阶段一：准备工作（1天）

#### Day 1: 平台仓库初始化

1. **创建平台仓库**
   ```bash
   # 从当前项目拆分出平台代码
   mkdir -p multi-platform-platform/packages
   ```

2. **识别平台代码 vs 业务代码**
   - 平台代码：Agent T、Agent B、任务执行引擎、通用组件
   - 业务代码：保险事业部特定配置、特定页面

3. **创建目录结构**
   ```
   multi-platform-platform/
   ├── packages/
   │   ├── platform-core/
   │   ├── platform-ui/
   │   └── platform-config/
   └── templates/
       └── business-app-template/
   ```

### 阶段二：核心包拆分（2-3天）

#### Day 2-3: platform-core 包

1. **提取核心代码**
   ```typescript
   // packages/platform-core/src/index.ts
   export * from './agents';
   export * from './services';
   export * from './mcp';
   export * from './types';
   ```

2. **配置 package.json**
   ```json
   {
     "name": "@multi-platform/platform-core",
     "version": "1.0.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "exports": {
       ".": "./dist/index.js",
       "./agents": "./dist/agents/index.js",
       "./services": "./dist/services/index.js"
     }
   }
   ```

3. **配置构建**
   ```json
   {
     "scripts": {
       "build": "tsup src/index.ts --format esm,cjs --dts",
       "dev": "tsup src/index.ts --format esm,cjs --dts --watch"
     }
   }
   ```

#### Day 4: platform-ui 包

1. **提取通用 UI 组件**
   ```typescript
   // packages/platform-ui/src/index.ts
   export * from './components/chat';
   export * from './components/task-manager';
   export * from './hooks';
   ```

2. **配置 Tailwind CSS 共享**
   ```javascript
   // packages/platform-ui/tailwind.config.js
   module.exports = {
     content: ['./src/**/*.{ts,tsx}'],
     presets: [require('@multi-platform/tailwind-config')]
   };
   ```

#### Day 5: platform-config 包

1. **提取配置系统**
   ```typescript
   // packages/platform-config/src/index.ts
   export { BusinessUnitConfigLoader } from './loader';
   export { ConfigValidator } from './validator';
   export type { BusinessUnitConfig } from './types';
   ```

### 阶段三：业务应用改造（2-3天）

#### Day 6-7: 保险事业部应用

1. **创建新的保险应用仓库**
   ```bash
   # 使用模板创建
   cp -r multi-platform-platform/templates/business-app-template insurance-app
   cd insurance-app
   ```

2. **安装平台包**
   ```json
   {
     "dependencies": {
       "@multi-platform/platform-core": "workspace:*",
       "@multi-platform/platform-ui": "workspace:*",
       "@multi-platform/platform-config": "workspace:*"
     }
   }
   ```

3. **迁移保险事业部配置**
   ```typescript
   // src/config/business-units/insurance/index.ts
   import { defineBusinessUnitConfig } from '@multi-platform/platform-config';
   
   export default defineBusinessUnitConfig({
     id: 'insurance',
     name: '保险事业部',
     executors: [
       // 保险事业部特定的 Agent 配置
     ]
   });
   ```

4. **使用平台组件**
   ```tsx
   // src/app/page.tsx
   import { AgentChat } from '@multi-platform/platform-ui';
   import { useAgentTask } from '@multi-platform/platform-core';
   
   export default function InsurancePage() {
     return <AgentChat businessUnit="insurance" />;
   }
   ```

#### Day 8: AI事业部应用

1. **创建 AI 应用仓库**
   ```bash
   cp -r multi-platform-platform/templates/business-app-template ai-app
   ```

2. **配置 AI 事业部**
   ```typescript
   // src/config/business-units/ai/index.ts
   import { defineBusinessUnitConfig } from '@multi-platform/platform-config';
   
   export default defineBusinessUnitConfig({
     id: 'ai',
     name: 'AI事业部',
     executors: [
       // AI事业部特定的 Agent 配置
     ]
   });
   ```

### 阶段四：升级机制（1-2天）

#### Day 9: 版本管理

1. **配置 Changesets（推荐）**
   ```bash
   pnpm add -Dw @changesets/cli
   pnpm changeset init
   ```

2. **发布流程**
   ```bash
   # 1. 创建变更日志
   pnpm changeset
   
   # 2. 升级版本
   pnpm changeset version
   
   # 3. 发布
   pnpm changeset publish
   ```

#### Day 10: 升级工具

1. **创建升级 CLI 工具**
   ```bash
   # packages/platform-cli/src/index.ts
   export const upgradePlatform = async (targetVersion?: string) => {
     // 自动检测并升级平台包
     // 运行迁移脚本
     // 验证配置兼容性
   };
   ```

2. **业务应用升级**
   ```bash
   # 在业务应用中运行
   pnpm platform upgrade
   # 或指定版本
   pnpm platform upgrade --version 1.1.0
   ```

---

## 📊 对比与选择

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Monorepo** | 开发体验好、版本同步简单 | 仓库体积大、需要协调发布 | 初期快速迭代、团队紧密协作 |
| **独立 npm 包** | 真正独立、灵活升级 | 需要发布流程、版本管理复杂 | 成熟平台、多团队协作 |
| **Git Submodule** | 简单快速、无需发布 | 版本管理困难、容易混乱 | 快速验证、临时方案 |

**推荐路径**：
1. 初期：Monorepo 方案（快速迭代）
2. 中期：独立 npm 包（稳定后）
3. 长期：混合方案（核心包独立发布，UI 包 Monorepo）

---

## 🎯 预期效果

### 升级体验
- **升级前**：需要手动复制代码，容易出错，耗时数小时
- **升级后**：一条命令完成，耗时几分钟
- **效率提升**：90%+

### 代码复用
- **平台代码**：100% 复用
- **业务代码**：每个业务线只维护自己的配置
- **维护成本**：降低 70%

### 新业务接入
- **接入前**：2-4 周
- **接入后**：1-2 天（使用模板 + 配置）
- **效率提升**：80%+

---

## ⚠️ 关键注意事项

### 1. 接口稳定性
- 遵循语义化版本（Semantic Versioning）
- Major 版本：破坏性变更
- Minor 版本：新增功能
- Patch 版本：Bug 修复

### 2. 类型安全
- 完整的 TypeScript 类型定义
- 导出类型而非具体实现
- 使用类型守卫确保运行时安全

### 3. 配置兼容性
- 提供配置迁移工具
- 保持向后兼容至少 2 个 Major 版本
- 详细的变更日志和升级指南

### 4. 文档完善
- API 文档
- 升级指南
- 最佳实践
- 故障排查手册

---

## 📝 总结

本方案通过将当前工程拆分为独立的平台包，实现了：

1. ✅ **基础能力共享**：平台代码作为独立包，所有业务线共用
2. ✅ **快速升级**：通过 npm 包版本管理，一条命令完成升级
3. ✅ **灵活接入**：新业务线使用模板快速接入
4. ✅ **独立演进**：各业务线可以按自己的节奏升级

类似于 Java 的 JAR 包升级机制，但更适合 JavaScript/TypeScript 生态。
