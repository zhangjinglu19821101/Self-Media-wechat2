# Agent 协作系统 - 代码下载指南

## 📦 下载方式

您可以通过以下两种方式下载代码：

### 方式 1：通过 Web 界面下载（推荐）

访问下载页面：`http://localhost:5000/download`

选择适合您的版本并点击"立即下载"。

### 方式 2：通过 API 下载

```bash
# 获取下载列表
curl http://localhost:5000/api/download

# 直接下载（替换 URL 为实际下载链接）
wget "https://coze-coding-project.tos.coze.site/coze_storage_7601340203210440704/agent-collaboration-system/projects-source-only.tar_xxx.gz?sign=xxx" -O agent-collaboration-system.tar.gz
```

## 📋 下载包说明

### 1️⃣ 完整项目（包含依赖）
- **文件大小**：152MB
- **包含内容**：
  - ✅ 所有源代码
  - ✅ node_modules（所有依赖包）
  - ✅ Git 历史记录
  - ✅ 配置文件
- **适用场景**：直接部署到生产环境

### 2️⃣ 源代码（不包含依赖）⭐ 推荐
- **文件大小**：2.3MB
- **包含内容**：
  - ✅ 所有源代码
  - ✅ Git 历史记录
  - ✅ 配置文件
  - ❌ node_modules
- **适用场景**：开发环境、代码审查
- **使用方法**：
  ```bash
  # 解压后安装依赖
  tar -xzf agent-collaboration-system.tar.gz
  cd projects
  pnpm install
  coze dev
  ```

### 3️⃣ 纯净代码（不含 .git）
- **文件大小**：596KB
- **包含内容**：
  - ✅ 所有源代码（当前版本）
  - ✅ 配置文件
  - ❌ Git 历史记录
  - ❌ .git 目录
- **适用场景**：代码迁移、第三方分发

## 🔧 使用方法

### 解压文件
```bash
tar -xzf agent-collaboration-system-*.tar.gz
cd projects
```

### 安装依赖（如果下载的是源代码版本）
```bash
pnpm install
```

### 启动开发环境
```bash
coze dev
```

### 启动生产环境
```bash
coze build
coze start
```

## 📝 注意事项

1. **下载链接有效期**：7 天，过期后请重新访问 `/api/download` 获取新链接
2. **环境要求**：
   - Node.js 24+
   - pnpm 包管理器
3. **端口配置**：开发环境默认运行在 5000 端口
4. **环境变量**：确保已配置必要的环境变量（见项目根目录 `.env.example`）

## 🔐 安全说明

- 下载链接已通过签名验证，确保文件完整性
- 所有下载包均包含完整的项目代码和配置
- 如需修改配置，请编辑项目根目录的 `.coze` 文件

## 📚 项目文档

- [README.md](README.md) - 项目概述
- [PLUGIN_CONFIGURATION_GUIDE.md](PLUGIN_CONFIGURATION_GUIDE.md) - 插件配置指南
- [AUTO_COMMIT_GUIDE.md](AUTO_COMMIT_GUIDE.md) - 自动提交功能指南

## 🆘 常见问题

### Q: 下载速度慢怎么办？
A: 使用下载工具（如 IDM、迅雷）加速下载，或选择体积更小的"源代码"版本。

### Q: 解压后如何运行？
A:
```bash
cd projects
pnpm install  # 如果下载的是源代码版本
coze dev      # 启动开发环境
```

### Q: 如何获取最新的下载链接？
A: 访问 `http://localhost:5000/api/download` 自动生成新的下载链接。

### Q: 可以在其他环境部署吗？
A: 可以，但需要确保目标环境满足：
- Node.js 24+
- pnpm 包管理器
- 支持的操作系统（Linux、macOS、Windows）

## 📞 技术支持

如有问题，请检查：
1. 下载链接是否过期（7 天有效期）
2. 文件是否完整下载（检查文件大小）
3. 环境是否满足要求（Node.js 24+）
4. 依赖是否正确安装（`pnpm install`）

---

**祝您使用愉快！** 🎉
