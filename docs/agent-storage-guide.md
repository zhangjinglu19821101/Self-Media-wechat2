# 🏗️ Agent 存储和部署说明

## 📍 Agent 当前存储位置

### 1. 代码定义位置

**核心文件**: `/workspace/projects/src/lib/agent-manager.ts`

**存储方式**: **内存中（硬编码）**

```typescript
// Agent 在代码中定义，运行时加载到内存
export class AgentManager {
  private agents: Map<AgentId, Agent> = new Map();

  private initializeAgents(): void {
    // Agent A - 核心协调者
    this.createAgent({
      id: 'A',
      name: '核心协调者',
      role: 'Coordinator',
      // ... 其他配置
    });

    // Agent B - 技术执行者
    this.createAgent({
      id: 'B',
      name: '技术执行者',
      // ...
    });
  }
}
```

**特点**:
- ✅ 简单直接，不需要数据库
- ❌ 重启服务后状态会丢失
- ❌ 修改需要重新部署

---

### 2. 能力配置位置

**基础能力**: `/workspace/projects/src/lib/agent-capabilities.ts`

**领域能力**: `/workspace/projects/src/lib/agent-capabilities.ts`

**存储方式**: **代码中定义**

```typescript
// 基础能力 - 平台沉淀
export function getBaseCapabilities(agentId: AgentId): Skill[] {
  const capabilities: Record<AgentId, Skill[]> = {
    'A': [
      { id: 'task-decomposition', name: '任务分解', level: 90, ... },
      { id: 'coordination', name: '协调能力', level: 85, ... },
    ],
    'B': [
      { id: 'programming', name: '编程开发', level: 85, ... },
    ],
    // ...
  };
  return capabilities[agentId] || [];
}

// 领域能力 - 专家提供
export function getDomainCapabilitiesTemplate(agentId: AgentId, domain: string): Skill[] {
  // 根据领域返回不同的能力模板
}
```

---

### 3. 提示词位置

**当前状态**: **分散在代码中**

- **Agent Builder**: `/workspace/projects/src/lib/agent-builder.ts` 中的 `systemPrompts` 对象
- **Agent Manager**: 硬编码在 Agent 初始化逻辑中

```typescript
// 当前实现：硬编码
const systemPrompts = {
  'A': '你是一个核心协调者 Agent，负责协调多个 Agent 的工作...',
  'B': '你是一个技术执行者 Agent，负责执行技术类任务...',
  'C': '你是一个运营执行者 Agent，负责执行运营类任务...',
  'D': '你是一个内容执行者 Agent，负责执行内容类任务...',
};
```

---

## 🚀 部署位置

### 当前部署环境

**开发环境**:
- 位置: 沙箱环境
- 路径: `/workspace/projects/`
- 访问: http://localhost:5000
- 启动命令: `coze dev`

**生产环境**:
- 待部署
- 需要配置服务器
- 需要配置域名

---

## 💾 存储方案对比

### 当前方案：内存存储

| 特性 | 说明 |
|------|------|
| **存储位置** | 代码中定义，运行时加载到内存 |
| **优点** | 简单、快速、无需数据库 |
| **缺点** | 重启丢失、修改需要重新部署 |
| **适用场景** | 原型开发、演示 |

---

### 推荐方案：数据库存储（未实现）

| 特性 | 说明 |
|------|------|
| **存储位置** | PostgreSQL 数据库 |
| **优点** | 持久化、灵活、可动态修改 |
| **缺点** | 需要数据库、增加复杂度 |
| **适用场景** | 生产环境、长期运营 |

**数据库表结构设计**:

```sql
-- Agents 表
CREATE TABLE agents (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50),
  description TEXT,
  system_prompt TEXT,
  max_concurrent_tasks INTEGER DEFAULT 3,
  can_send_to TEXT[],
  can_receive_from TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Skills 表
CREATE TABLE skills (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  level INTEGER,
  description TEXT,
  type VARCHAR(20), -- 'base' or 'domain'
  domain VARCHAR(50),
  price DECIMAL(10, 2)
);

-- Agent_Skills 关联表
CREATE TABLE agent_skills (
  agent_id VARCHAR(10) REFERENCES agents(id),
  skill_id VARCHAR(50) REFERENCES skills(id),
  PRIMARY KEY (agent_id, skill_id)
);
```

---

## 🎯 部署到生产环境

### 选项 1：部署到云服务器（推荐）

**步骤**:

1. **购买云服务器**
   - 阿里云 ECS
   - 腾讯云 CVM
   - AWS EC2

2. **配置服务器**
   ```bash
   # 安装 Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # 克隆代码
   git clone https://your-repo-url.git
   cd your-repo

   # 安装依赖
   pnpm install

   # 构建项目
   pnpm run build

   # 启动服务
   pnpm run start
   ```

3. **配置域名和 SSL**
   - 购买域名
   - 配置 DNS 解析
   - 申请 SSL 证书

4. **配置进程守护**
   ```bash
   # 使用 PM2
   npm install -g pm2
   pm2 start npm --name "multi-agent-system" -- start
   pm2 save
   pm2 startup
   ```

---

### 选项 2：部署到云平台（更简单）

**选择**:
- Vercel（推荐，支持 Next.js）
- Netlify
- 腾讯云 Serverless
- 阿里云云开发

**步骤**:

```bash
# 部署到 Vercel
npm install -g vercel
cd /workspace/projects
vercel

# 按照提示操作，几分钟即可完成部署
```

---

### 选项 3：部署到 Docker

**Dockerfile**:
```dockerfile
FROM node:20

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

COPY . .

RUN pnpm run build

EXPOSE 5000

CMD ["pnpm", "start"]
```

**运行**:
```bash
# 构建镜像
docker build -t multi-agent-system .

# 运行容器
docker run -p 5000:5000 multi-agent-system
```

---

## 📊 数据流向

```
┌─────────────┐
│  用户访问    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Next.js 应用 │
│ (Agent管理) │
└──────┬──────┘
       │
       ▼
┌──────────────────────────┐
│ 内存存储 (当前)           │
│ - Agent 定义             │
│ - 能力配置               │
│ - 提示词                 │
│ - 任务队列               │
└──────────────────────────┘
       │
       ▼ (未来)
┌──────────────────────────┐
│ 数据库存储 (待实现)       │
│ - PostgreSQL             │
│ - 持久化配置             │
└──────────────────────────┘
```

---

## 🔧 后续优化建议

### 1. 提示词持久化

**当前问题**: 提示词硬编码在代码中，修改需要重新部署

**解决方案**:
- 使用数据库存储提示词
- 通过管理后台在线编辑
- 支持版本管理和回滚

### 2. 配置文件化

**当前问题**: Agent 配置分散在多个文件中

**解决方案**:
```typescript
// config/agents.json
{
  "agents": [
    {
      "id": "A",
      "name": "核心协调者",
      "role": "Coordinator",
      "systemPrompt": "你是一个核心协调者 Agent...",
      "capabilities": [...]
    }
  ]
}
```

### 3. 数据库集成

**推荐集成**: 使用项目内置的 PostgreSQL 集成

```typescript
import { exec_sql } from '@/app/api/[...path]/route';

// 保存 Agent 到数据库
await exec_sql(`
  INSERT INTO agents (id, name, role, system_prompt)
  VALUES ($1, $2, $3, $4)
`, [agentId, name, role, systemPrompt]);
```

---

## 📞 快速参考

### 当前位置

| 内容 | 位置 |
|------|------|
| Agent 定义 | `src/lib/agent-manager.ts` |
| 能力配置 | `src/lib/agent-capabilities.ts` |
| 管理后台 | `src/app/admin/agent-builder/` |
| API 接口 | `src/app/api/admin/agent-builder/` |

### 访问地址

- 开发环境: http://localhost:5000
- 管理后台: http://localhost:5000/admin/agent-builder

### 存储方式

- **当前**: 内存存储（代码中定义）
- **推荐**: 数据库存储（PostgreSQL）

---

## ✅ 总结

**当前状态**:
- ✅ Agent 存储在代码中（内存）
- ✅ 能力配置在代码中
- ✅ 提示词硬编码

**部署位置**:
- 当前: 沙箱环境
- 生产: 需要部署到云服务器或云平台

**存储方案**:
- 当前: 内存存储
- 推荐: 数据库存储（PostgreSQL）

**下一步**:
1. 考虑使用数据库持久化
2. 部署到生产环境
3. 配置域名和访问

---

**一句话**: Agent 当前存储在代码的内存中，部署在沙箱环境，未来建议迁移到数据库并部署到云服务器。
