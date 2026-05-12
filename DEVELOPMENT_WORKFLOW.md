# 日常开发与演进工作流

## 📋 目录
- [开发环境设置](#开发环境设置)
- [日常开发流程](#日常开发流程)
- [平台演进策略](#平台演进策略)
- [业务线开发流程](#业务线开发流程)
- [版本发布流程](#版本发布流程)
- [常见问题处理](#常见问题处理)

---

## 🛠️ 开发环境设置

### 首次环境配置

#### 1. 克隆仓库

```bash
# 克隆平台仓库（核心开发在这个仓库）
git clone git@github.com:your-org/multi-platform-platform.git
cd multi-platform-platform

# 安装依赖
pnpm install
```

#### 2. 设置本地开发链接

为了方便在业务应用中测试平台代码变更，我们使用 `pnpm link`：

```bash
# 在平台仓库中
cd packages/platform-core
pnpm link --global

cd ../platform-ui
pnpm link --global

cd ../platform-config
pnpm link --global

# 在业务应用仓库中
cd ../insurance-app
pnpm link --global @multi-platform/platform-core
pnpm link --global @multi-platform/platform-ui
pnpm link --global @multi-platform/platform-config
```

#### 3. 启动开发模式

```bash
# 在平台仓库中，启动所有包的 watch 模式
pnpm dev

# 在业务应用仓库中，启动开发服务器
pnpm dev
```

现在，当你修改平台代码时，业务应用会自动热更新！

---

## 💻 日常开发流程

### 场景一：开发新的平台功能

#### Step 1: 创建功能分支

```bash
# 在平台仓库中
git checkout main
git pull origin main
git checkout -b feature/new-agent-capability
```

#### Step 2: 开发功能

```bash
# 启动 watch 模式
pnpm dev

# 修改代码
# packages/platform-core/src/agents/new-feature.ts
```

#### Step 3: 在业务应用中测试

由于已经设置了 `pnpm link`，你可以同时在保险应用中测试：

```bash
# 在另一个终端，进入保险应用
cd ../insurance-app
pnpm dev

# 打开浏览器测试新功能
```

#### Step 4: 提交代码

```bash
# 在平台仓库中
git add .
git commit -m "feat: add new agent capability

- 新增 XYZ 功能
- 支持 ABC 配置
- 优化 DEF 性能"
```

#### Step 5: 创建 Pull Request

1. 推送分支到远程
2. 创建 PR
3. 等待代码审查
4. 合并到 main

---

### 场景二：修复平台 Bug

#### Step 1: 定位问题

```bash
# 在平台仓库中
git checkout main
git pull origin main
git checkout -b fix/agent-t-timeout
```

#### Step 2: 修复 Bug

```bash
# 修改代码
# packages/platform-core/src/services/task-execution.ts
```

#### Step 3: 添加测试（如果有）

```bash
# 运行测试
pnpm test
```

#### Step 4: 在业务应用中验证

```bash
# 确保保险应用和 AI 应用都能正常工作
cd ../insurance-app
pnpm dev
# 测试修复效果

cd ../ai-app
pnpm dev
# 测试修复效果
```

#### Step 5: 提交并发布补丁版本

```bash
git add .
git commit -m "fix: resolve agent T timeout issue

- 修复超时问题
- 添加重试机制
- 优化错误处理"

git push origin fix/agent-t-timeout
```

---

## 🚀 平台演进策略

### 版本管理策略

我们使用 **语义化版本（Semantic Versioning）**：

- **Major (主版本)**：破坏性变更，不兼容旧版本
- **Minor (次版本)**：新增功能，向后兼容
- **Patch (补丁版本)**：Bug 修复，向后兼容

### 演进路线图

#### 阶段一：核心功能稳定化（当前）

**目标**：确保现有功能稳定可靠

**每周任务**：
- ✅ 修复 critical bug
- ✅ 性能优化
- ✅ 完善单元测试
- ✅ 文档更新

**发布频率**：
- Patch 版本：每周 1-2 次
- Minor 版本：每 2-3 周 1 次

#### 阶段二：新功能迭代

**目标**：按计划添加新功能

**功能规划**：
```
Q1 2025:
- [ ] Agent T 增强
- [ ] 性能监控面板
- [ ] 配置热加载优化

Q2 2025:
- [ ] 多数据库支持
- [ ] AI 能力增强
- [ ] 插件系统
```

**发布频率**：
- Minor 版本：每月 1 次
- Major 版本：每季度评估 1 次

#### 阶段三：生态建设

**目标**：建设开发者生态

**任务**：
- 插件市场
- 第三方集成
- 社区贡献指南

---

## 📦 业务线开发流程

### 保险事业部开发流程

#### 日常开发（不涉及平台变更）

```bash
# 1. 在保险应用仓库中工作
cd insurance-app
git checkout main
git pull origin main
git checkout -b feature/new-insurance-template

# 2. 开发业务功能
# src/config/business-units/insurance/templates/new-template.ts

# 3. 测试
pnpm dev
# 浏览器测试

# 4. 提交
git add .
git commit -m "feat: add new insurance content template"
git push origin feature/new-insurance-template

# 5. 创建 PR，合并
```

#### 需要平台新功能时

```bash
# 1. 在平台仓库中开发新功能（见场景一）

# 2. 平台功能合并后，升级保险应用的依赖
cd insurance-app

# 查看可用的平台版本
pnpm outdated @multi-platform/platform-core

# 升级到最新版本
pnpm update @multi-platform/platform-core @multi-platform/platform-ui

# 测试新功能
pnpm dev

# 提交升级
git add package.json pnpm-lock.yaml
git commit -m "chore: upgrade platform packages to v1.1.0"
```

### AI事业部开发流程

与保险事业部流程相同，但有自己的独立仓库：

```bash
# AI 事业部仓库
cd ai-app

# 同样的开发流程
git checkout -b feature/ai-new-feature
# ... 开发 ...
pnpm update @multi-platform/platform-core
```

---

## 🔖 版本发布流程

### Patch 版本发布（Bug 修复）

#### Step 1: 确保代码在 main 分支

```bash
cd multi-platform-platform
git checkout main
git pull origin main
```

#### Step 2: 创建变更日志

```bash
# 使用 changesets 创建变更日志
pnpm changeset

# 按照提示选择：
# - 哪些包需要升级？（platform-core, platform-ui, platform-config）
# - 升级类型？（patch）
# - 描述变更？
```

#### Step 3: 升级版本号

```bash
pnpm changeset version

# 这会自动：
# - 更新 package.json 中的版本号
# - 更新 CHANGELOG.md
# - 创建 git commit
```

#### Step 4: 发布

```bash
# 构建所有包
pnpm build

# 发布到 npm
pnpm changeset publish

# 推送到 git
git push origin main
git push --tags
```

#### Step 5: 通知业务线

```
📢 平台补丁版本 v1.0.1 已发布！

变更内容：
- 修复 Agent T 超时问题
- 优化错误处理

升级方式：
cd insurance-app
pnpm update @multi-platform/platform-core

cd ai-app
pnpm update @multi-platform/platform-core
```

### Minor 版本发布（新功能）

流程与 Patch 版本基本相同，但需要：

1. **更详细的变更日志**
2. **升级指南文档**
3. **提前通知业务线**

```bash
# 创建升级指南
vim docs/upgrade-guides/v1.1.0.md

# 内容包括：
# - 新增功能介绍
# - 如何使用新功能
# - 注意事项
```

### Major 版本发布（破坏性变更）

这是重大版本，需要更谨慎：

#### Step 1: 发布预发布版本

```bash
# 创建 alpha 版本
git checkout -b release/v2.0.0
pnpm changeset pre enter alpha
pnpm changeset
pnpm changeset version
pnpm build
pnpm changeset publish --tag alpha
```

#### Step 2: 业务线测试

```bash
# 保险应用测试 alpha 版本
cd insurance-app
pnpm add @multi-platform/platform-core@alpha
pnpm dev
# 全面测试
```

#### Step 3: 收集反馈，修复问题

#### Step 4: 发布正式版本

```bash
# 退出预发布模式
pnpm changeset pre exit
pnpm changeset version
pnpm build
pnpm changeset publish
```

---

## 🔧 常见问题处理

### 问题 1: pnpm link 不生效

**症状**：修改平台代码后，业务应用没有更新

**解决方案**：

```bash
# 1. 清理链接
cd multi-platform-platform/packages/platform-core
pnpm unlink --global

# 2. 重新链接
pnpm link --global

# 3. 在业务应用中重新链接
cd ../../insurance-app
pnpm unlink @multi-platform/platform-core
pnpm link --global @multi-platform/platform-core

# 4. 清理缓存
rm -rf node_modules/.vite
pnpm dev
```

### 问题 2: 类型错误

**症状**：TypeScript 类型不匹配

**解决方案**：

```bash
# 1. 确保平台包已构建
cd multi-platform-platform
pnpm build

# 2. 清理业务应用的 node_modules
cd ../insurance-app
rm -rf node_modules
pnpm install

# 3. 重新启动 TypeScript 服务器
# 在 VS Code 中：Cmd+Shift+P -> TypeScript: Restart TS Server
```

### 问题 3: 版本冲突

**症状**：不同业务线依赖不同版本的平台包

**解决方案**：

1. **尽量保持同步升级**
2. **使用 peerDependencies 约束**
3. **提供兼容性迁移指南**

### 问题 4: 开发环境太慢

**症状**：热更新需要很长时间

**解决方案**：

```bash
# 1. 使用 Turbo 模式
pnpm dev:turbo

# 2. 只开发需要的包
cd packages/platform-core
pnpm dev

# 3. 增加系统文件监视限制
# macOS:
sudo sysctl -w kern.maxfiles=524288
sudo sysctl -w kern.maxfilesperproc=524288
```

---

## 📅 每周例行工作

### 周一：规划与同步

```
10:00 - 团队站会
- 上周完成情况
- 本周计划
- 阻塞问题

11:00 - 平台开发规划
- 优先级排序
- 任务分配
```

### 周二至周四：开发与测试

```
专注开发：
- 平台功能开发
- Bug 修复
- 业务线支持
```

### 周五：发布与总结

```
上午：
- 代码审查
- 测试验证
- 发布版本

下午：
- 本周总结
- 文档更新
- 下周规划
```

---

## 🎯 最佳实践

### 1. 小步快跑

- 每次 PR 只做一件事
- 频繁提交，频繁合并
- 避免大型 PR

### 2. 保持沟通

- 重大变更提前讨论
- 使用 RFC（Request for Comments）流程
- 及时同步进度

### 3. 自动化一切

- 自动化测试
- 自动化构建
- 自动化发布
- 自动化通知

### 4. 文档优先

- 先写文档，再写代码
- 保持文档更新
- 提供示例代码

---

## 📞 支持渠道

### 内部 Slack 频道

- `#platform-dev`：平台开发讨论
- `#business-insurance`：保险事业部问题
- `#business-ai`：AI 事业部问题

### 文档

- 平台 API 文档：`docs/api.md`
- 升级指南：`docs/upgrade-guides/`
- 示例代码：`examples/`

### 值班表

- 周一：张三
- 周二：李四
- 周三：王五
- 周四：赵六
- 周五：钱七

---

**祝开发顺利！** 🚀
