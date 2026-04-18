# 自媒体多平台内容发布系统

## 项目概览
这是一个基于 Next.js 的自媒体内容创作与多平台发布系统，支持微信公众号、小红书、知乎、头条等平台。系统集成 AI Agent 协作能力，可自动化完成内容创作、合规校验、发布管理等流程。

## 技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **ORM**: Drizzle ORM
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **认证**: NextAuth v5
- **实时通信**: WebSocket

## 目录结构
```
.
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── full-home/          # 主页（任务拆解 + 创作引导）
│   │   ├── agents/             # Agent 相关页面
│   │   ├── api/                # API 路由
│   │   ├── materials/          # 素材库管理
│   │   ├── digital-assets/     # 数字资产管理
│   │   ├── account-management/ # 账号管理
│   │   ├── style-init/         # 风格初始化
│   │   ├── style-replica/      # 风格复刻
│   │   ├── publish/            # 发布管理
│   │   └── settings/           # 设置（API Key、团队）
│   ├── lib/
│   │   ├── agents/             # Agent 逻辑与提示词
│   │   ├── services/           # 业务服务
│   │   ├── db/                 # 数据库 Schema
│   │   ├── api/                # API 客户端
│   │   ├── auth/               # 认证相关
│   │   └── mcp/                # MCP 工具集成
│   ├── components/             # UI 组件
│   └── hooks/                  # React Hooks
├── scripts/                    # 开发脚本
├── docs/                       # 文档
└── .coze                       # 项目配置
```

## 核心功能模块

### 1. 多平台内容发布
- 支持平台：微信公众号、小红书、知乎、头条/抖音、微博
- 多账号管理：每个平台可绑定多个账号
- 差异化内容：同一指令生成不同平台风格的文章

### 2. AI Agent 协作系统
| Agent | 职责 |
|-------|------|
| Agent A | 战略决策者 |
| Agent B | 技术官，任务拆解与协调 |
| Agent T | 技术专家，MCP 工具执行 |
| insurance-d | 公众号长文创作 |
| insurance-xiaohongshu | 小红书图文创作 |
| insurance-zhihu | 知乎文章创作 |
| insurance-toutiao | 头条文章创作 |
| insurance-c | 保险运营 |

### 3. 素材库
- 素材类型：案例、数据、故事、引用、开头、结尾
- 标签系统：主题标签、场景标签、情绪标签
- AI 推荐：根据指令自动推荐相关素材

### 4. 风格模板系统
- 风格学习：从历史文章提取写作风格
- 模板管理：创建和管理风格模板
- 账号绑定：不同账号使用不同风格模板
- 平台隔离：不同平台独立风格模板

### 5. 用户认证与权限
- NextAuth v5 认证
- Workspace 工作区隔离
- RBAC 权限模型（Owner/Admin/Editor/Viewer）

## 开发命令
```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 生产模式
pnpm start

# 类型检查
pnpm ts-check

# 代码检查
pnpm lint
```

## 关键 API 路由

### 任务管理
- `POST /api/agents/b/simple-split` - AI 拆解任务
- `GET /api/tasks` - 任务列表
- `GET /api/tasks/[id]` - 任务详情

### 素材管理
- `GET /api/materials` - 素材列表
- `POST /api/materials` - 创建素材
- `GET /api/materials/recommend` - 素材推荐

### 风格模板
- `GET /api/style-templates` - 模板列表
- `POST /api/style-templates` - 创建模板
- `POST /api/style/init-from-upload` - 从文章提取风格

### 账号管理
- `GET /api/platform-accounts` - 平台账号列表
- `POST /api/platform-accounts/bind-template` - 绑定风格模板

### 发布
- `POST /api/publish/submit` - 提交发布
- `GET /api/publish/history` - 发布历史

## 环境变量
参考 `.env.example` 配置以下环境变量：
- 数据库连接
- LLM API 密钥（豆包）
- 加密密钥
- 对象存储配置

## 最近更新
- 多平台发布功能（方案B：多版本生成模式）
- 用户预览修改节点
- 统一输出信封格式
- 风格模板平台维度
- BYOK（用户自带 API Key）

## 注意事项
1. 使用 pnpm 作为包管理器（禁止 npm/yarn）
2. 服务端口固定为 5000
3. 代码修改后自动热更新（HMR）
4. 所有 API 需要认证（除公开路径）
