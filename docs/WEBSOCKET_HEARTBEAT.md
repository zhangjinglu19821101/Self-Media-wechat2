# WebSocket 心跳维护机制

## 概述

心跳机制是保持 WebSocket 长连接稳定运行的核心技术。本文档详细描述了系统中的心跳实现方案。

## 为什么需要心跳？

### WebSocket 连接状态

WebSocket 连接在长时间空闲时可能因为以下原因断开：

1. **代理服务器超时**：Nginx、HAProxy 等反向代理服务器通常有连接超时限制
2. **防火墙/NAT 超时**：网络设备可能会清理长时间空闲的连接
3. **客户端/服务端进程异常**：进程崩溃或资源耗尽

### 心跳的作用

心跳机制通过定期发送小消息，确保：

1. **连接保持活跃**：防止代理服务器或防火墙超时
2. **检测连接状态**：及时发现断开的连接
3. **触发重连机制**：在连接断开后自动重新连接

## 心跳协议设计

### 消息格式

系统使用 JSON 格式的心跳消息：

```json
{
  "type": "ping"
}
```

```json
{
  "type": "pong"
}
```

### 消息类型

| 类型 | 方向 | 描述 |
|------|------|------|
| `ping` | 客户端 → 服务端 | 客户端发送的心跳请求 |
| `pong` | 服务端 → 客户端 | 服务端对 ping 的响应 |

## 双向心跳机制

### 架构图

```
┌─────────────┐                    ┌─────────────┐
│   客户端     │                    │   服务端     │
│  (Agent)    │                    │  (Server)   │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       │ ──────── ping (每 30s) ─────────→ │
       │ ←─────── pong ───────────────── │
       │                                   │
       │ ←─────── ping (每 60s) ───────── │
       │ ──────── pong ──────────────────→ │
       │                                   │
```

### 服务端心跳

**发送间隔**：60 秒

**实现逻辑**：

1. 遍历所有已连接的客户端
2. 发送 `ping` 消息（使用 WebSocket 原生 `ping()` 方法）
3. 记录最后发送时间
4. 检查最后响应时间（120 秒超时）
5. 如果超时，关闭连接

**代码实现**：

```typescript
private startHeartbeat(): void {
  this.heartbeatInterval = setInterval(() => {
    const now = new Date();

    this.clients.forEach((client, agentId) => {
      if (client.socket.readyState !== WebSocket.OPEN) {
        this.clients.delete(agentId);
        return;
      }

      try {
        // 发送 ping 消息
        client.socket.ping();

        // 检查最后响应时间
        if (client.lastPing && (now.getTime() - client.lastPing.getTime()) > 120000) {
          console.log(`⚠️  Agent ${agentId} heartbeat timeout (120s), closing connection`);
          client.socket.close();
          this.clients.delete(agentId);
        }
      } catch (error) {
        console.error(`Error sending ping to Agent ${agentId}:`, error);
        this.clients.delete(agentId);
      }
    });
  }, 60000);
}
```

**响应处理**：

```typescript
ws.on('pong', () => {
  const client = this.clients.get(agentId);
  if (client) {
    client.lastPing = new Date();
  }
});
```

### 客户端心跳

**发送间隔**：30 秒

**实现逻辑**：

1. 检查 WebSocket 连接状态
2. 发送 `ping` 消息（JSON 格式）
3. 记录发送时间

**代码实现**：

```typescript
const startHeartbeat = useCallback(() => {
  if (heartbeatTimerRef.current) {
    clearInterval(heartbeatTimerRef.current);
  }

  heartbeatTimerRef.current = setInterval(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        console.log(`💓 Heartbeat sent for Agent ${agentId}`);
      } catch (error) {
        console.error(`Error sending heartbeat for Agent ${agentId}:`, error);
      }
    }
  }, 30000);
}, [agentId]);
```

## 超时检测

### 服务端超时检测

**超时时间**：120 秒

**检测逻辑**：

```typescript
const now = new Date();
const timeoutMs = 120000;

if (client.lastPing && (now.getTime() - client.lastPing.getTime()) > timeoutMs) {
  console.log(`⚠️  Agent ${agentId} heartbeat timeout (120s), closing connection`);
  client.socket.close();
  this.clients.delete(agentId);
}
```

**为什么是 120 秒？**

1. 客户端每 30 秒发送一次心跳
2. 网络延迟和消息处理时间假设为 10-20 秒
3. 留出足够的安全余量
4. 建议：超时时间 = 客户端心跳间隔 × 3 ~ 4

## 错误处理

### 心跳发送失败

**场景**：网络断开、WebSocket 已关闭

**处理方式**：

```typescript
try {
  client.socket.ping();
} catch (error) {
  console.error(`Error sending ping to Agent ${agentId}:`, error);
  this.clients.delete(agentId);
}
```

### 心跳超时

**场景**：客户端无响应、网络延迟过高

**处理方式**：

1. 记录超时日志
2. 关闭连接
3. 从客户端列表中移除

```typescript
if (client.lastPing && (now.getTime() - client.lastPing.getTime()) > 120000) {
  console.log(`⚠️  Agent ${agentId} heartbeat timeout (120s), closing connection`);
  client.socket.close();
  this.clients.delete(agentId);
}
```

## 性能优化

### 资源管理

1. **定时器清理**：连接断开时清理心跳定时器

```typescript
const stopHeartbeat = useCallback(() => {
  if (heartbeatTimerRef.current) {
    clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = null;
  }
}, []);
```

2. **客户端列表清理**：定期清理无效连接

```typescript
if (client.socket.readyState !== WebSocket.OPEN) {
  this.clients.delete(agentId);
  return;
}
```

### 日志优化

1. **关键日志**：连接建立、断开、超时
2. **调试日志**：心跳发送、接收（可配置）
3. **错误日志**：发送失败、解析错误

## 监控指标

### 关键指标

| 指标 | 描述 | 告警阈值 |
|------|------|----------|
| 连接时长 | 单个连接的存活时间 | > 24h |
| 心跳超时次数 | 心跳超时的次数 | > 5 次/小时 |
| 重连次数 | 客户端重连的次数 | > 10 次/小时 |
| 心跳间隔 | 实际心跳发送间隔 | 偏差 > 10s |

### 日志示例

**正常日志**：

```
✅ WebSocket connected for Agent A
💓 Heartbeat sent for Agent A
📨 === Agent A 收到 WebSocket 消息 ===
📦 消息类型: pong
```

**异常日志**：

```
⚠️  Agent A heartbeat timeout (120s), closing connection
❌ WebSocket disconnected for Agent A 1006
🔄 Attempting to reconnect WebSocket for Agent A...
```

## 故障排查

### 问题：频繁心跳超时

**排查步骤**：

1. 检查客户端心跳发送是否正常
2. 检查网络延迟和丢包率
3. 检查服务端 `pong` 响应逻辑
4. 调整超时时间配置

**解决方案**：

```typescript
// 增加超时时间
const timeoutMs = 180000; // 从 120s 增加到 180s
```

### 问题：心跳发送失败

**排查步骤**：

1. 检查 WebSocket 连接状态
2. 检查网络连接
3. 检查定时器是否正常运行

**解决方案**：

```typescript
// 检查连接状态后再发送
if (wsRef.current?.readyState === WebSocket.OPEN) {
  wsRef.current.send(JSON.stringify({ type: 'ping' }));
}
```

## 最佳实践

1. **心跳间隔配置**：
   - 客户端：30 秒
   - 服务端：60 秒
   - 超时：120 秒

2. **重连策略**：
   - 使用指数退避算法
   - 设置最大重试次数

3. **错误处理**：
   - 记录所有心跳相关错误
   - 区分临时错误和永久错误

4. **监控告警**：
   - 监控心跳超时次数
   - 监控重连频率
   - 设置合理的告警阈值

## 总结

心跳维护机制通过定期发送心跳消息，确保 WebSocket 长连接的稳定性。双向心跳、超时检测、自动重联等技术手段共同构成了一个健壮的连接管理系统。

合理配置心跳间隔和超时时间是关键，需要根据实际网络环境和业务需求进行调整。
