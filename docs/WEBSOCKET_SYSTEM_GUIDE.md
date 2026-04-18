# Agent WebSocket 实时通知系统使用指南

## 📋 系统概述

Agent WebSocket 实时通知系统允许 Agent 之间进行实时通信和指令推送。当 Agent A 向其他 Agent 下达指令时，接收方 Agent 会立即收到通知，无需手动刷新页面。

### 🎯 核心功能

- **实时指令推送**：Agent A 下达指令后，接收方 Agent 立即收到通知
- **WebSocket 连接管理**：自动管理 WebSocket 连接、断线重连、心跳检测
- **指令通知显示**：在 Agent 页面顶部显示新指令通知
- **多 Agent 支持**：支持所有 Agent（A、B、C、D、insurance-c、insurance-d）

## 🏗️ 工作原理

### 架构图

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Agent A   │─────>│  API Server  │─────>│   Agent B   │
│  (发送方)   │      │  (HTTP/SSE)  │      │  (接收方)   │
└─────────────┘      └──────┬───────┘      └──────┬──────┘
                            │                      │
                            │                      │
                            ▼                      ▼
                     ┌──────────────┐      ┌─────────────┐
                     │ WebSocket    │◀─────│ WebSocket   │
                     │ Server       │      │ Client      │
                     │ (Port 5001)  │      │             │
                     └──────────────┘      └─────────────┘
```

### 数据流

1. **Agent A 下达指令**
   - Agent A 调用 `POST /api/agents/send-command`
   - API 保存指令到数据库
   - API 通过 WebSocket 推送给 Agent B

2. **Agent B 接收通知**
   - Agent B 前端连接到 WebSocket 服务器（`ws://localhost:5001/agent/B`）
   - WebSocket 服务器推送新指令消息
   - Agent B 前端显示通知
   - Agent B 用户点击通知查看指令

## 🚀 使用方法

### 1. 查看 WebSocket 服务器状态

**API 接口：**
```bash
GET /api/websocket/status
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "port": 5001,
    "running": true,
    "connectedAgents": ["B", "C", "D"],
    "clientCount": 3
  }
}
```

**测试命令：**
```bash
curl http://localhost:5000/api/websocket/status
```

### 2. Agent A 下达指令

**在 Agent A 聊天页面输入：**
```
请向 Agent B 下达指令，让它调研当前最流行的 AI 内容检测工具
```

**Agent A 会自动：**
1. 分析任务特点（调研任务，预计时间 > 10分钟）
2. 选择"任务管理"方式（而非"实时指令"）
3. 调用 `POST /api/agents/send-command` API
4. 通过 WebSocket 推送给 Agent B
5. 返回确认消息

### 3. Agent B 接收指令通知

**打开 Agent B 页面：**
```
http://localhost:5000/agents/B
```

**Agent B 会自动：**
1. 连接到 WebSocket 服务器（`ws://localhost:5001/agent/B`）
2. 接收新指令推送
3. 在页面顶部显示通知卡片
4. 显示 Toast 提示

**通知卡片显示内容：**
- WebSocket 连接状态（绿色 = 已连接，红色 = 离线）
- 新指令数量
- 指令列表（发送方、类型、优先级、内容）
- 查看详情按钮

### 4. 查看指令详情

**点击通知卡片中的"查看详情"按钮，跳转到指令历史页面：**
```
http://localhost:5000/agents/B/commands
```

**指令历史页面显示：**
- 所有收到的指令列表
- 指令详细信息（发送方、类型、优先级、内容、时间）

## 🧪 测试步骤

### 完整测试流程

#### 测试 1：验证 WebSocket 服务器运行

```bash
# 1. 检查 WebSocket 服务器状态
curl http://localhost:5000/api/websocket/status

# 预期结果：
# {
#   "success": true,
#   "data": {
#     "port": 5001,
#     "running": true,
#     "connectedAgents": [],
#     "clientCount": 0
#   }
# }
```

#### 测试 2：Agent B 连接 WebSocket

```
1. 打开 Agent B 页面：
   http://localhost:5000/agents/B

2. 观察页面顶部的 WebSocket 状态：
   - 绿色图标 + "实时连接中" = 已连接 ✅
   - 红色图标 + "离线" = 未连接 ❌

3. 再次检查 WebSocket 服务器状态：
   curl http://localhost:5000/api/websocket/status

# 预期结果：
# {
#   "success": true,
#   "data": {
#     "port": 5001,
#     "running": true,
#     "connectedAgents": ["B"],
#     "clientCount": 1
#   }
# }
```

#### 测试 3：Agent A 下达指令

```
1. 打开 Agent A 页面：
   http://localhost:5000/agents/A

2. 输入指令：
   请向 Agent B 下达一个简单指令，让它问个好

3. Agent A 会：
   - 分析任务特点（简单、快速）
   - 选择"实时指令"方式
   - 调用 API 下达指令
   - 返回确认消息

4. 观察终端日志（应该看到）：
   📤 WebSocket push to Agent B: Success
```

#### 测试 4：Agent B 接收通知

```
1. 切换到 Agent B 页面标签（如果已经打开）

2. 观察页面：
   - 应该立即显示 Toast 提示："收到来自 总裁 的指令"
   - 页面顶部出现黄色通知卡片
   - 显示指令详情

3. 点击"查看详情"按钮，跳转到指令历史页面
```

#### 测试 5：验证指令传达

```
1. 打开指令验证中心：
   http://localhost:5000/admin/agent-commands-verification

2. 点击 Agent B 标签页

3. 应该看到：
   - 来自 Agent A 的指令
   - 指令类型、优先级、内容、时间
```

## 🎨 功能特点

### 1. 自动连接管理

- **自动连接**：Agent 页面打开时自动连接 WebSocket
- **断线重连**：连接断开后 5 秒内自动重连
- **心跳检测**：每 30 秒发送一次心跳，确保连接活跃

### 2. 实时通知

- **即时推送**：指令下达后立即推送，无需刷新
- **Toast 提示**：右下角显示 Toast 通知
- **通知卡片**：页面顶部显示详细通知列表
- ** Badge 计数**：显示未读指令数量

### 3. 指令管理

- **查看详情**：点击通知查看指令详情
- **清除通知**：可以清除单条或全部通知
- **指令历史**：跳转到指令历史页面查看所有指令

### 4. 多 Agent 支持

所有 Agent 都支持 WebSocket 连接：
- Agent A（总裁）
- Agent B（技术负责人）
- Agent C（AI运营总监）
- Agent D（AI内容负责人）
- Agent insurance-c（保险运营总监）
- Agent insurance-d（保险内容负责人）

## ⚙️ 技术实现

### WebSocket 服务器

**文件位置：** `src/lib/websocket-server.ts`

**端口：** 5001

**连接格式：** `ws://localhost:5001/agent/{agentId}`

**功能：**
- 管理 Agent 连接
- 向指定 Agent 推送消息
- 广播消息给所有 Agent
- 心跳检测和断线处理

### WebSocket Hook

**文件位置：** `src/hooks/use-agent-websocket.ts`

**功能：**
- 连接 WebSocket
- 处理消息
- 管理连接状态
- 自动重连

### WebSocket 状态组件

**文件位置：** `src/components/agent-websocket-status.tsx`

**功能：**
- 显示 WebSocket 连接状态
- 显示新指令通知
- 提供查看详情按钮

### 指令下达 API

**文件位置：** `src/app/api/agents/send-command/route.ts`

**新增功能：**
- 保存指令到数据库
- 通过 WebSocket 推送给接收方 Agent

## 🔧 故障排除

### 问题 1：Agent 页面显示"离线"

**可能原因：**
- WebSocket 服务器未启动
- 端口 5001 被占用
- 网络连接问题

**解决方案：**
```bash
# 1. 检查 WebSocket 服务器状态
curl http://localhost:5000/api/websocket/status

# 2. 如果服务器未运行，重启开发服务器
coze dev

# 3. 检查端口是否被占用
lsof -i :5001

# 4. 如果端口被占用，修改 WebSocket 服务器端口（编辑 src/lib/websocket-server.ts）
```

### 问题 2：Agent B 收不到指令通知

**可能原因：**
- Agent B 页面未打开
- Agent B 的 WebSocket 连接断开
- Agent A 下达指令失败

**解决方案：**
```bash
# 1. 打开 Agent B 页面
http://localhost:5000/agents/B

# 2. 检查 WebSocket 连接状态
curl http://localhost:5000/api/websocket/status
# 应该看到 connectedAgents 包含 "B"

# 3. 检查 Agent A 的指令下达是否成功
# 查看 Agent A 的回复，应该有确认消息

# 4. 查看浏览器控制台日志
# 打开 Agent B 页面的开发者工具，查看 WebSocket 消息
```

### 问题 3：Toast 通知不显示

**可能原因：**
- 浏览器阻止了通知
- Toast 组件未正确初始化

**解决方案：**
```
1. 检查浏览器是否阻止了通知
2. 刷新 Agent B 页面
3. 检查浏览器控制台是否有错误
```

### 问题 4：断线后无法重连

**可能原因：**
- 网络不稳定
- WebSocket 服务器崩溃

**解决方案：**
```
1. 刷新 Agent B 页面
2. 检查 WebSocket 服务器状态
curl http://localhost:5000/api/websocket/status

3. 如果服务器未运行，重启开发服务器
coze dev
```

## 📊 性能优化

### 1. 心跳检测

- 每 30 秒发送一次心跳
- 超过 30 秒无响应自动断开
- 避免占用过多资源

### 2. 连接管理

- 每个 Agent 最多一个连接
- 新连接替换旧连接
- 断开时清理资源

### 3. 消息压缩

- 指令内容截断显示
- 只推送必要信息
- 详细内容通过 API 获取

## 🔐 安全性

### 1. Agent ID 验证

- 只接受有效的 Agent ID
- 拒绝无效连接

### 2. 连接限制

- 每个 Agent 最多一个连接
- 防止恶意连接

### 3. 消息验证

- 验证消息格式
- 拒绝恶意消息

## 📚 相关文档

- [Agent 指令下达系统](./AGENT_COMMAND_SYSTEM.md)
- [Agent 指令验证使用指南](./AGENT_COMMAND_VERIFICATION_USER_GUIDE.md)
- [Agent 记忆系统](./AGENT_MEMORY_SYSTEM.md)

## 🎓 总结

WebSocket 实时通知系统提供了 Agent 之间的实时通信能力：

✅ **实时推送**：指令下达后立即通知
✅ **自动管理**：自动连接、断线重连、心跳检测
✅ **用户友好**：Toast 通知、通知卡片、指令历史
✅ **多 Agent 支持**：所有 Agent 都支持
✅ **高可靠性**：自动重连、错误处理、状态监控

通过 WebSocket 系统，Agent 之间可以实现真正的实时通信，提升协作效率！🚀
