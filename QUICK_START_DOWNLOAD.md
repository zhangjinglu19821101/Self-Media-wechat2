# 📦 代码下载完整指南

## 🎉 您的代码已经可以下载了！

我已经为您准备了 **3 种下载方式**，每种方式都有 3 个不同版本可以选择。

---

## 📍 项目路径信息

- **Git 仓库路径**：`/workspace/projects`
- **当前分支**：`main`
- **提交记录**：6 个提交
- **工作目录状态**：干净（无未提交的修改）

---

## 🌐 方式一：Web 界面下载（推荐）

### 访问地址
```
http://localhost:5000/download
```

### 使用步骤
1. 在浏览器中打开下载页面
2. 选择适合您的版本
3. 点击"立即下载"按钮
4. 等待下载完成

### 特点
- ✅ 可视化界面，操作简单
- ✅ 自动生成下载链接
- ✅ 包含详细的使用说明
- ✅ 支持断点续传

---

## 🔌 方式二：API 下载

### 获取下载列表
```bash
curl http://localhost:5000/api/download
```

### 直接下载
```bash
# 使用 wget
wget "下载链接" -O agent-collaboration-system.tar.gz

# 使用 curl
curl -L "下载链接" -o agent-collaboration-system.tar.gz
```

### 返回示例
```json
{
  "success": true,
  "packages": [
    {
      "id": "full",
      "name": "完整项目（包含依赖）",
      "description": "包含所有源代码、node_modules、Git 历史记录",
      "size": "152MB",
      "downloadUrl": "https://..."
    },
    {
      "id": "source",
      "name": "源代码（不包含依赖）",
      "description": "包含所有源代码和 Git 历史记录，不包含 node_modules",
      "size": "2.3MB",
      "downloadUrl": "https://..."
    },
    {
      "id": "minimal",
      "name": "纯净代码（不含 .git）",
      "description": "仅包含当前版本的源代码，不含 Git 历史和 .git 目录",
      "size": "596KB",
      "downloadUrl": "https://..."
    }
  ]
}
```

---

## 🚀 方式三：一键部署脚本

### 使用快速部署脚本
```bash
# 运行脚本
/workspace/scripts/quick-deploy.sh

# 或者从项目根目录运行
./scripts/quick-deploy.sh
```

### 脚本功能
- ✅ 自动检查环境（Node.js、pnpm）
- ✅ 交互式选择下载版本
- ✅ 自动下载并解压代码
- ✅ 自动安装依赖（如果需要）
- ✅ 可选直接启动开发服务器

---

## 📋 下载版本对比

| 版本 | 大小 | 依赖 | Git 历史 | 适用场景 |
|------|------|------|----------|----------|
| **完整项目** | 152MB | ✅ 包含 | ✅ 包含 | 生产部署 |
| **源代码** ⭐ | 2.3MB | ❌ 不包含 | ✅ 包含 | 开发环境 |
| **纯净代码** | 596KB | ❌ 不包含 | ❌ 不包含 | 代码迁移 |

---

## 🔧 使用方法

### 解压文件
```bash
tar -xzf agent-collaboration-system-*.tar.gz
cd projects
```

### 安装依赖（仅源代码版本）
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

---

## 📝 下载链接有效期

- **有效期**：7 天
- **刷新方式**：重新访问 `/api/download` 获取新链接
- **建议**：下载后立即备份到本地存储

---

## 🎯 推荐下载流程

### 对于开发者（推荐）
1. 访问 `http://localhost:5000/download`
2. 选择"源代码（不包含依赖）" - 2.3MB
3. 下载后解压
4. 运行 `pnpm install`
5. 运行 `coze dev`

### 对于生产部署
1. 访问 `http://localhost:5000/download`
2. 选择"完整项目（包含依赖）" - 152MB
3. 下载后解压
4. 直接运行 `coze start`

### 对于代码审查
1. 访问 `http://localhost:5000/download`
2. 选择"纯净代码（不含 .git）" - 596KB
3. 下载后直接查看代码

---

## 📚 相关文档

- [README.md](README.md) - 项目概述
- [DOWNLOAD_GUIDE.md](DOWNLOAD_GUIDE.md) - 详细下载指南
- [PLUGIN_CONFIGURATION_GUIDE.md](PLUGIN_CONFIGURATION_GUIDE.md) - 插件配置指南
- [AUTO_COMMIT_GUIDE.md](AUTO_COMMIT_GUIDE.md) - 自动提交功能指南

---

## 🆘 常见问题

### Q: 下载速度慢怎么办？
A: 使用下载工具（如 IDM、迅雷）加速下载，或选择体积更小的版本。

### Q: 下载链接过期怎么办？
A: 重新访问 `http://localhost:5000/download` 获取新的下载链接。

### Q: 解压后无法运行？
A: 检查环境是否满足要求：
```bash
node -v  # 需要 18+
pnpm -v  # 需要安装 pnpm
```

### Q: 如何在服务器上部署？
A:
```bash
# 下载完整项目
wget "下载链接" -O agent-collaboration-system.tar.gz

# 解压
tar -xzf agent-collaboration-system.tar.gz
cd projects

# 构建并启动
coze build
coze start
```

### Q: 如何更新代码？
A:
```bash
# 重新下载最新版本
curl http://localhost:5000/api/download > packages.json

# 备份现有代码
mv projects projects.backup

# 解压新版本
tar -xzf agent-collaboration-system-*.tar.gz

# 恢复配置文件（如果需要）
cp projects.backup/.env projects/
```

---

## 🔐 安全说明

- 所有下载链接均经过签名验证
- 确保从官方渠道下载（http://localhost:5000/download）
- 验证文件完整性（检查文件大小）
- 下载后建议使用杀毒软件扫描

---

## 📞 技术支持

如有问题，请：
1. 检查下载链接是否过期（7 天有效期）
2. 验证文件是否完整下载
3. 确认环境是否满足要求（Node.js 18+）
4. 查看相关文档：[DOWNLOAD_GUIDE.md](DOWNLOAD_GUIDE.md)

---

**祝您使用愉快！** 🎉
