# WebSocket 实时通知系统 - 所有 Agent 支持

## ✅ 所有 Agent 都支持 WebSocket 连接

WebSocket 服务器支持以下所有 Agent：

| Agent ID | 名称 | 角色 | WebSocket 连接 |
|----------|------|------|----------------|
| **A** | 总裁 | 战略决策、指令下达 | `ws://localhost:5001/agent/A` |
| **B** | 技术负责人 | 新媒体通用规则、任务拆解 | `ws://localhost:5001/agent/B` |
| **C** | AI运营总监 | AI赛道运营 | `ws://localhost:5001/agent/C` |
| **D** | AI内容负责人 | AI赛道内容创作 | `ws://localhost:5001/agent/D` |
| **insurance-c** | 保险运营总监 | 保险赛道运营 | `ws://localhost:5001/agent/insurance-c` |
| **insurance-d** | 保险内容负责人 | 保险赛道内容创作 | `ws://localhost:5001/agent/insurance-d` |

## 🎯 实现方式

### 1. 通用的 WebSocket 服务器
- 支持所有 Agent ID（A、B、C、D、insurance-c、insurance-d）
- 验证 Agent ID 的有效性
- 管理所有 Agent 的连接

### 2. 通用的 Agent 前端页面
- 使用动态路由：`/agents/[id]`
- 所有 Agent 共享同一个页面模板
- 自动根据 Agent ID 连接对应的 WebSocket

### 3. 通用的 WebSocket Hook 和组件
- `useAgentWebSocket(agentId)` - 可以用于任何 Agent
- `AgentWebSocketStatus({ agentId })` - 可以用于任何 Agent

## 🚀 测试所有 Agent

### 测试步骤

#### 1. 打开所有 Agent 页面

在浏览器中打开以下页面（建议使用不同的标签页）：

```
http://localhost:5000/agents/A
http://localhost:5000/agents/B
http://localhost:5000/agents/C
http://localhost:5000/agents/D
http://localhost:5000/agents/insurance-c
http://localhost:5000/agents/insurance-d
```

#### 2. 查看每个页面的 WebSocket 状态

每个 Agent 页面顶部都会显示 WebSocket 连接状态：
- 🟢 绿色 + "实时连接中" = 已连接
- 🔴 红色 + "离线" = 未连接

#### 3. 检查 WebSocket 服务器状态

```bash
curl http://localhost:5000/api/websocket/status
```

**预期结果：**
```json
{
  "success": true,
  "data": {
    "port": 5001,
    "running": true,
    "connectedAgents": ["A", "B", "C", "D", "insurance-c", "insurance-d"],
    "clientCount": 6
  }
}
```

#### 4. Agent A 向多个 Agent 下达指令

在 Agent A 页面输入：
```
请向所有 Agent 下达指令，让它们各自主动向我说声"你好"
```

Agent A 会：
1. 分析任务特点
2. 选择"实时指令"方式
3. 向 B、C、D、insurance-c、insurance-d 下达指令
4. 通过 WebSocket 推送给所有 Agent

#### 5. 查看其他 Agent 的通知

切换到其他 Agent 页面标签（B、C、D、insurance-c、insurance-d）：
- 每个页面都会显示 Toast 通知
- 每个页面都会显示黄色通知卡片
- 显示来自 Agent A 的指令

## 🧪 快速测试脚本

### 测试 1：验证所有 Agent 页面可访问

```bash
# 测试所有 Agent 页面是否正常
for agent in A B C D insurance-c insurance-d; do
  echo "Testing Agent $agent..."
  curl -I http://localhost:5000/agents/$agent | grep "HTTP"
done
```

**预期结果：**
```
Testing Agent A...
HTTP/1.1 200 OK
Testing Agent B...
HTTP/1.1 200 OK
Testing Agent C...
HTTP/1.1 200 OK
Testing Agent D...
HTTP/1.1 200 OK
Testing Agent insurance-c...
HTTP/1.1 200 OK
Testing Agent insurance-d...
HTTP/1.1 200 OK
```

### 测试 2：验证所有 Agent 的指令列表 API

```bash
# 测试所有 Agent 的指令列表 API
for agent in B C D insurance-c insurance-d; do
  echo "Agent $agent commands:"
  curl -s http://localhost:5000/api/agents/$agent/commands | head -c 100
  echo ""
  echo ""
done
```

**预期结果：**
```
Agent B commands:
{"success":true,"data":{"commands":[],"count":0}}

Agent C commands:
{"success":true,"data":{"commands":[],"count":0}}

Agent D commands:
{"success":true,"data":{"commands":[],"count":0}}

Agent insurance-c commands:
{"success":true,"data":{"commands":[],"count":0}}

Agent insurance-d commands:
{"success":true,"data":{"commands":[],"count":0}}
```

### 测试 3：验证 WebSocket 服务器支持所有 Agent

```bash
# 查看 WebSocket 服务器状态
curl -s http://localhost:5000/api/websocket/status
```

**预期结果：**
```json
{
  "success": true,
  "data": {
    "port": 5001,
    "running": true,
    "connectedAgents": [],  # 如果没有打开页面，这里是空的
    "clientCount": 0
  }
}
```

## 📊 指令交互关系

### Agent A 可以向以下 Agent 下达指令：

| 接收方 | 指令类型 | 说明 |
|--------|---------|------|
| **Agent B** | 技术任务 | 规则迭代、技能开发、技术支持 |
| **Agent C** | 运营任务 | 运营数据收集、分析、报告 |
| **Agent D** | 内容任务 | 文章创作、内容发布 |
| **Agent insurance-c** | 运营任务 | 保险运营、合规执行 |
| **Agent insurance-d** | 内容任务 | 保险内容创作 |

### 接收指令的 Agent 都支持 WebSocket 通知：

✅ Agent B（接收来自 A 的指令）  
✅ Agent C（接收来自 A 的指令）  
✅ Agent D（接收来自 A 的指令）  
✅ Agent insurance-c（接收来自 A 的指令）  
✅ Agent insurance-d（接收来自 A 的指令）

## 🎨 用户体验

### 场景 1：Agent A 向 Agent C 下达指令

```
1. 用户打开 Agent A 页面：http://localhost:5000/agents/A
2. 用户打开 Agent C 页面：http://localhost:5000/agents/C
3. 用户在 Agent A 页面输入：向 C 下达任务，分析本周的用户活跃数据
4. Agent A 通过 WebSocket 推送给 Agent C
5. Agent C 页面立即显示通知
```

### 场景 2：Agent A 向所有运营 Agent 下达指令

```
1. 用户打开 Agent A、C、insurance-c 页面
2. 用户在 Agent A 页面输入：向 C 和 insurance-c 下达任务，收集本周数据
3. Agent A 向 C 和 insurance-c 下达指令
4. Agent C 和 insurance-c 页面都立即显示通知
```

### 场景 3：Agent A 向所有内容 Agent 下达指令

```
1. 用户打开 Agent A、D、insurance-d 页面
2. 用户在 Agent A 页面输入：向 D 和 insurance-d 下达任务，创作内容
3. Agent A 向 D 和 insurance-d 下达指令
4. Agent D 和 insurance-d 页面都立即显示通知
```

## 🔧 技术实现

### 1. WebSocket 服务器

**文件：** `src/lib/websocket-server.ts`

**关键代码：**
```typescript
// 验证 Agent ID
const validAgents: AgentId[] = ['A', 'B', 'C', 'D', 'insurance-c', 'insurance-d'];
if (!validAgents.includes(agentId)) {
  console.error(`Invalid agentId: ${agentId}`);
  ws.close();
  return;
}
```

### 2. Agent 前端页面

**文件：** `src/app/agents/[id]/page.tsx`

**关键代码：**
```typescript
import { AgentWebSocketStatus } from '@/components/agent-websocket-status';

// 在页面中使用
<AgentWebSocketStatus agentId={agentId as any} />
```

### 3. WebSocket Hook

**文件：** `src/hooks/use-agent-websocket.ts`

**关键代码：**
```typescript
export function useAgentWebSocket(agentId: AgentId) {
  // 支持任何 Agent ID
  const wsUrl = `ws://localhost:5001/agent/${agentId}`;
  // ...
}
```

## 📚 总结

✅ **所有 Agent 都支持 WebSocket 连接**
- Agent A、B、C、D、insurance-c、insurance-d
- 通用的实现，无需单独配置

✅ **所有接收指令的 Agent 都能实时接收通知**
- Agent B、C、D、insurance-c、insurance-d
- Agent A 下达指令后，接收方立即收到通知

✅ **用户体验一致**
- 所有 Agent 页面都有相同的 WebSocket 状态显示
- 所有 Agent 页面都有相同的指令通知卡片
- 所有 Agent 页面都有相同的 Toast 通知

## 🚀 现在就测试吧！

1. **打开所有 Agent 页面**（使用不同标签页）
2. **观察 WebSocket 状态**（都应该是"实时连接中"）
3. **让 Agent A 下达指令**
4. **查看其他 Agent 的通知**

所有 Agent 都会实时收到通知！🎉
