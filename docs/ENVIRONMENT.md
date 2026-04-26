# ============================================
# 环境配置指南
# ============================================

## 三环境架构

```
┌─────────────────────────────────────────────────────────────┐
│                    开发 → 测试 → 生产                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  本地开发 (localhost:3000)                                   │
│  ├── 本地 PostgreSQL 数据库                                  │
│  ├── NODE_ENV=development                                   │
│  └── .env.local 配置                                        │
│              ↓                                               │
│  测试环境 (test.xxx.com)                                     │
│  ├── 测试数据库（独立）                                       │
│  ├── NODE_ENV=testing                                       │
│  └── .env.testing 配置                                      │
│              ↓                                               │
│  生产环境 (your-domain.com)                                  │
│  ├── 生产数据库（独立）                                       │
│  ├── NODE_ENV=production                                    │
│  └── .env.production 配置                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 文件说明

| 文件 | 用途 | 提交到 Git |
|-----|------|-----------|
| `.env.local` | 本地开发配置 | ❌ 否 |
| `.env.production.template` | 生产配置模板 | ✅ 是 |
| `.env` | Coze 沙箱环境配置 | ❌ 否 |

## 快速开始

### 1. 本地开发环境

```bash
# 1. 安装 PostgreSQL（macOS）
brew install postgresql@16
brew services start postgresql@16

# 2. 创建本地数据库
./scripts/init-db.sh

# 3. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入数据库连接字符串

# 4. 安装依赖
pnpm install

# 5. 初始化数据库
./scripts/migrate.sh

# 6. 启动开发服务器
pnpm dev
```

### 2. 生产环境部署

```bash
# 1. 复制生产配置模板
cp .env.production.template .env.production

# 2. 编辑生产配置
vim .env.production
# 填入：数据库地址、域名、密钥等

# 3. 构建
pnpm build

# 4. 使用 PM2 启动
pm2 start ecosystem.config.cjs --env production
```

## 数据库隔离策略

### 方案 A：Supabase 多项目（推荐）

```
Supabase 项目 1: dev-xxx    → 开发环境
Supabase 项目 2: test-xxx   → 测试环境
Supabase 项目 3: prod-xxx   → 生产环境

每个项目有独立的：
- 数据库实例
- API 密钥
- 认证配置
```

### 方案 B：同一 Supabase 不同 Schema

```sql
-- 开发环境 Schema
CREATE SCHEMA dev_schema;

-- 生产环境 Schema
CREATE SCHEMA prod_schema;

-- 连接字符串
# 开发
DATABASE_URL="postgres://.../?options=--search_path=dev_schema"

# 生产
DATABASE_URL="postgres://.../?options=--search_path=prod_schema"
```

### 方案 C：本地 PostgreSQL + 云端生产

```
开发: 本地 PostgreSQL (localhost:5432)
生产: Supabase PostgreSQL (云端)
```

## 环境变量说明

### 必需变量

| 变量 | 开发 | 测试 | 生产 |
|-----|------|------|------|
| `NODE_ENV` | development | testing | production |
| `COZE_PROJECT_ENV` | DEV | TEST | PROD |
| `DATABASE_URL` | 本地数据库 | 测试数据库 | 生产数据库 |
| `NEXTAUTH_URL` | localhost:3000 | test.domain.com | your-domain.com |

### 密钥变量（必须重新生成）

```bash
# 生成 AUTH_SECRET / NEXTAUTH_SECRET
openssl rand -hex 32

# 生成 COZE_ENCRYPTION_KEY
openssl rand -hex 32
```

## 常见问题

### Q: 如何在 Coze 沙箱中切换环境？

```bash
# 使用生产配置
NODE_ENV=production COZE_PROJECT_ENV=PROD pnpm start

# 使用测试配置
NODE_ENV=testing COZE_PROJECT_ENV=TEST pnpm start
```

### Q: 如何验证当前环境？

```bash
curl http://localhost:3000/api/health
# 或
curl http://localhost:5000/api/health
```

### Q: 如何回滚生产数据库？

```bash
# 使用 Supabase Dashboard
# 1. 登录 Supabase
# 2. 进入 Database → Backups
# 3. 选择时间点恢复
```
