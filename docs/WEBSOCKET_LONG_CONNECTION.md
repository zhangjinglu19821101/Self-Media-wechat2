# WebSocket 长连接机制

## 概述

WebSocket 长连接机制用于保持 Agent 之间的实时通信稳定性，解决频繁断开（1006 错误）的问题。

## 架构设计

### 双向心跳机制

为了确保 WebSocket 连接的稳定性，系统采用双向心跳机制：

1. **服务端心跳**：
   - 每 60 秒发送一次 `ping` 消息
   - 120 秒超时检测：如果 120 秒内未收到 `pong` 响应，则关闭连接

2. **客户端心跳**：
   - 每 30 秒发送一次 `ping` 消息
   - 确保连接保持活跃

### 心跳时间配置

| 配置项 | 服务端 | 客户端 |
|--------|--------|--------|
| 心跳间隔 | 60 秒 | 30 秒 |
| 超时时间 | 120 秒 | - |

**设计原则**：
- 客户端心跳间隔（30s） < 服务端心跳间隔（60s） < 服务端超时时间（120s）
- 客户端主动发送心跳可以减少服务端超时断开的风险
- 双向心跳确保任一方向的消息都能保持连接活跃

## 实现细节

### 服务端实现

文件：`src/lib/websocket-server.ts`

```typescript
private startHeartbeat(): void {
  this.heartbeatInterval = setInterval(() => {
    const now = new Date();

    this.clients.forEach((client, agentId) => {
      if (client.socket.readyState !== WebSocket.OPEN) {
        // 移除已断开的客户端
        this.clients.delete(agentId);
        return;
      }

      // 发送 ping 消息（每 60 秒）
      try {
        client.socket.ping();

        // 检查最后响应时间（超过 120 秒没有响应认为断开）
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
  }, 60000); // 每 60 秒发送一次心跳
}
```

### 客户端实现

文件：`src/hooks/use-agent-websocket.ts`

```typescript
const startHeartbeat = useCallback(() => {
  if (heartbeatTimerRef.current) {
    clearInterval(heartbeatTimerRef.current);
  }

  // 每 30 秒发送一次心跳，确保连接保持活跃
  heartbeatTimerRef.current = setInterval(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        console.log(`💓 Heartbeat sent for Agent ${agentId}`);
      } catch (error) {
        console.error(`Error sending heartbeat for Agent ${agentId}:`, error);
      }
    }
  }, 30000); // 每 30 秒发送一次心跳
}, [agentId]);
```

## 错误处理

### 1006 错误

**原因**：
- 连接在没有任何关闭帧的情况下突然断开
- 通常是由于代理服务器超时或网络不稳定

**解决方案**：
1. 缩短心跳间隔，确保连接保持活跃
2. 实现自动重连机制
3. 增加超时时间，给客户端足够的时间响应

### 重连机制

客户端实现自动重连：

```typescript
ws.onclose = (event) => {
  console.log(`❌ WebSocket disconnected for Agent ${agentId}`, event.code, event.reason);

  // 停止心跳
  stopHeartbeat();

  // 自动重连（延迟 2 秒）
  if (!reconnectTimerRef.current) {
    reconnectTimerRef.current = setTimeout(() => {
      console.log(`🔄 Attempting to reconnect WebSocket for Agent ${agentId}...`);
      reconnectTimerRef.current = null;
      connect();
    }, 2000);
  }
};
```

## 监控与日志

### 服务端日志

```typescript
console.log(`✅ Agent ${agentId} connected to WebSocket`);
console.log(`⚠️  Agent ${agentId} heartbeat timeout (120s), closing connection`);
console.error(`WebSocket server error:`, error);
```

### 客户端日志

```typescript
console.log(`Connecting to WebSocket for Agent ${agentId}: ${wsUrl}`);
console.log(`✅ WebSocket connected for Agent ${agentId}`);
console.log(`💓 Heartbeat sent for Agent ${agentId}`);
console.log(`📨 === Agent ${agentId} 收到 WebSocket 消息 ===`);
```

## 最佳实践

1. **心跳间隔**：
   - 客户端心跳间隔应该小于服务端超时时间的一半
   - 推荐配置：客户端 30s，服务端 60s，超时 120s

2. **重连策略**：
   - 使用指数退避算法，避免频繁重连
   - 设置最大重试次数，避免无限重连

3. **错误处理**：
   - 记录所有连接状态变化
   - 区分临时错误和永久错误

4. **监控**：
   - 监控连接时长和断开原因
   - 统计心跳超时和重连次数

## 故障排查

### 问题：连接频繁断开

**可能原因**：
1. 心跳间隔过长，超过代理服务器超时时间
2. 网络不稳定
3. 服务端超时时间配置不合理

**解决方法**：
1. 缩短心跳间隔
2. 增加超时时间
3. 检查网络连接
4. 检查代理服务器配置

### 问题：心跳超时

**可能原因**：
1. 客户端未正确响应 `ping` 消息
2. 网络延迟过高
3. 服务端超时时间配置过短

**解决方法**：
1. 检查客户端 `pong` 响应逻辑
2. 增加服务端超时时间
3. 检查网络连接质量

## 总结

WebSocket 长连接机制通过双向心跳和自动重连，确保了 Agent 之间的实时通信稳定性。合理配置心跳间隔和超时时间是关键。
