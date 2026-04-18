# Agent 记忆系统使用指南

> 更新时间：2026-02-02

本文档说明如何使用 Agent 的记忆系统，确保 Agent 能够持久化存储和检索信息。

---

## 📋 目录

1. [系统架构](#系统架构)
2. [数据库 Schema](#数据库-schema)
3. [API 接口](#api-接口)
4. [使用示例](#使用示例)
5. [Agent B 的记忆能力](#agent-b-的记忆能力)

---

## 系统架构

### 数据库存储

- **数据库**: PostgreSQL (已配置环境变量 `PGDATABASE_URL`)
- **ORM**: Drizzle ORM
- **Schema**:
  - `conversations`: 对话会话表
  - `messages`: 对话消息表
  - `agent_memories`: Agent 记忆表

### 服务层

- `src/lib/db/index.ts`: 数据库连接
- `src/lib/db/schema.ts`: 数据库表定义
- `src/lib/services/conversation-history.ts`: 对话历史管理
- `src/lib/services/agent-memory.ts`: Agent 记忆管理

### API 接口

- `src/app/api/agents/[agentId]/memories/route.ts`: 记忆列表接口
- `src/app/api/agents/[agentId]/memories/[memoryId]/route.ts`: 单个记忆接口

---

## 数据库 Schema

### conversations 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| sessionId | string | 会话ID（唯一） |
| userId | string | 用户ID |
| agentId | string | Agent ID |
| state | string | 会话状态（active/closed/archived） |
| variables | jsonb | 会话变量 |
| context | jsonb | 会话上下文 |
| metadata | jsonb | 元数据 |
| startedAt | timestamp | 开始时间 |
| endedAt | timestamp | 结束时间 |
| lastActiveAt | timestamp | 最后活跃时间 |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

### messages 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| conversationId | uuid | 对话ID（外键） |
| role | string | 角色（user/assistant/system） |
| content | string | 消息内容 |
| metadata | jsonb | 元数据 |
| tokens | integer | Token数量 |
| model | string | 使用的模型 |
| createdAt | timestamp | 创建时间 |

### agent_memories 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| agentId | string | Agent ID |
| memoryType | string | 记忆类型（decision/strategy/experience/rule/knowledge） |
| title | string | 标题 |
| content | string | 内容 |
| tags | jsonb | 标签数组 |
| importance | integer | 重要性（0-10） |
| source | string | 来源（manual/auto/import） |
| metadata | jsonb | 元数据 |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

---

## API 接口

### 1. 获取记忆列表

```http
GET /api/agents/{agentId}/memories
```

**查询参数**:
- `type`: 记忆类型（可选）
- `tags`: 标签（逗号分隔，可选）
- `keyword`: 关键词（可选）
- `limit`: 返回数量（默认50）
- `offset`: 偏移量（默认0）

**示例**:
```bash
curl "http://localhost:5000/api/agents/B/memories?type=rule&limit=10"
```

### 2. 创建记忆

```http
POST /api/agents/{agentId}/memories
```

**请求体**:
```json
{
  "memoryType": "rule",
  "title": "新媒体内容生成流程",
  "content": "定义从需求到发布的完整内容生成流程...",
  "tags": ["内容", "流程", "新媒体"],
  "importance": 8,
  "source": "auto",
  "metadata": {
    "platform": "all"
  }
}
```

**示例**:
```bash
curl -X POST http://localhost:5000/api/agents/B/memories \
  -H "Content-Type: application/json" \
  -d '{
    "memoryType": "rule",
    "title": "去AI化规则",
    "content": "基础去AI+语气拟人化、案例具象化、句式多样化、观点差异化",
    "tags": ["内容", "去AI化"],
    "importance": 9
  }'
```

### 3. 获取单个记忆

```http
GET /api/agents/{agentId}/memories/{memoryId}
```

### 4. 更新记忆

```http
PUT /api/agents/{agentId}/memories/{memoryId}
```

**请求体**:
```json
{
  "title": "更新后的标题",
  "content": "更新后的内容",
  "tags": ["新标签"],
  "importance": 10
}
```

### 5. 删除记忆

```http
DELETE /api/agents/{agentId}/memories/{memoryId}
```

---

## 使用示例

### Agent B 如何创建记忆

在 Agent B 的对话中，可以这样说：

```
我刚完成了新媒体内容生成流程的优化，需要记录到记忆中。

调用API创建记忆：
POST /api/agents/B/memories
{
  "memoryType": "strategy",
  "title": "新媒体内容生成流程优化方案",
  "content": "优化后的内容生成流程包括：需求分析→内容规划→初稿生成→去AI化处理→合规检测→发布...",
  "tags": ["内容", "流程", "优化"],
  "importance": 9,
  "source": "auto"
}
```

### Agent B 如何搜索记忆

```
我需要查找之前记录的去AI化规则。

调用API搜索记忆：
GET /api/agents/B/memories?keyword=去AI化&type=rule
```

### Agent B 如何回顾重要记忆

```
我需要回顾所有重要的技术决策（importance >= 8）。

调用API：
GET /api/agents/B/memories?type=decision&limit=20
```

---

## Agent B 的记忆能力

### 记忆类型

| 类型 | 说明 | 使用场景 |
|------|------|---------|
| decision | 重要决策 | 记录技术决策、架构选择 |
| strategy | 策略方案 | 记录技术策略、实现方案 |
| experience | 经验教训 | 记录问题解决方案、最佳实践 |
| rule | 规则规范 | 记录提炼的规则、流程规范 |
| knowledge | 知识文档 | 记录技术知识、API文档 |

### 重要性评分

| 评分 | 说明 |
|------|------|
| 0-3 | 低重要性，可忽略 |
| 4-6 | 中等重要性，可参考 |
| 7-8 | 高重要性，优先回顾 |
| 9-10 | 极高重要性，必须记住 |

### 使用规范

1. **何时创建记忆**：
   - 完成规则迭代后
   - 完成技能开发后
   - 解决技术难题后
   - 完成跨平台适配后
   - 完成拆解引擎优化后

2. **记忆内容要求**：
   - 标题：简洁明确，便于检索
   - 内容：详细描述，包含关键细节
   - 标签：便于分类和搜索
   - 重要性：客观评估，0-10分

3. **何时检索记忆**：
   - 遇到新的技术需求时
   - 开始新的任务时
   - 需要参考历史经验时
   - 定期回顾重要记忆时

---

## 🚀 立即开始

1. **测试 API 接口**：
   ```bash
   # 创建一个测试记忆
   curl -X POST http://localhost:5000/api/agents/B/memories \
     -H "Content-Type: application/json" \
     -d '{
       "memoryType": "test",
       "title": "测试记忆",
       "content": "这是一个测试记忆",
       "tags": ["测试"],
       "importance": 5
     }'

   # 获取所有记忆
   curl http://localhost:5000/api/agents/B/memories
   ```

2. **在对话中使用**：
   Agent B 现在可以在对话中主动调用这些 API 来创建和检索记忆。

3. **长期维护**：
   - 定期清理低价值记忆
   - 更新过时的记忆内容
   - 保持记忆系统的高效

---

**提示**：记忆系统已经完全配置好，Agent B 可以立即使用！
