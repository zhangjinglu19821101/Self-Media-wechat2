# MCP 架构与使用场景设计文档

## 📋 目录

1. [概述](#概述)
2. [两个层面的 MCP 实现](#两个层面的-mcp-实现)
3. [架构图示](#架构图示)
4. [使用场景对比](#使用场景对比)
5. [总结对比表](#总结对比表)

---

## 概述

本项目中有**两个层面**的 MCP 实现，分别服务于不同的使用场景：

1. **ToolRegistry** - 内部工具注册机制，给 Agent B 使用
2. **标准 MCP 协议服务端** - 外部服务，给 Claude Desktop、VS Code 等外部客户端使用

这两个实现可以共存，也可以完全独立。

---

## 两个层面的 MCP 实现

### 1. ToolRegistry（内部使用）

#### 是什么
ToolRegistry 是我们代码库内部的工具注册和发现机制，用于 Agent B 在处理任务时动态选择和调用 MCP 工具。

#### 给谁用
- ✅ Agent B（决策智能体）
- ✅ 你的 Next.js 应用内部

#### 用途
Agent B 在处理任务时，根据 `capability_list` 表的配置，动态选择合适的 MCP 工具并调用。

#### 核心代码位置
- `src/lib/mcp/tool-registry.ts` - 工具注册表实现
- `src/lib/mcp/generic-mcp-call.ts` - 通用 MCP 调用层
- `src/lib/services/subtask-execution-engine.ts` - 子任务执行引擎（使用 ToolRegistry）

#### 通信方式
- 直接函数调用
- 在 Next.js 应用内部

#### 使用示例
```typescript
import { toolRegistry } from './lib/mcp/tool-registry';

// 注册工具
toolRegistry.registerTool('email', EmailMCPTools);

// Agent B 调用工具
const tool = toolRegistry.getTool('email');
const result = await tool.sendEmail({ to: '...', subject: '...', body: '...' });
```

---

### 2. 标准 MCP 协议服务端（外部使用）

#### 是什么
标准的 MCP (Model Context Protocol) 服务端实现，遵循 MCP 协议规范，用于给外部 AI 客户端提供工具能力。

#### 给谁用
- ✅ Claude Desktop
- ✅ VS Code（安装 MCP 扩展）
- ✅ Cursor
- ✅ 任何支持 MCP 协议的客户端

#### 用途
给外部 AI 客户端提供工具能力，客户端可以零开发接入。

#### 核心代码位置
- `src/lib/mcp/examples/complete-mcp-server.ts` - 完整的 MCP 服务端示例

#### 通信方式
- JSON-RPC over stdio
- 独立进程运行

#### 使用示例
```typescript
// 服务端实现
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'send_email',
        description: '发送邮件',
        inputSchema: { /* JSON Schema */ }
      }
    ]
  };
});
```

---

## 架构图示

```
┌─────────────────────────────────────────────────────────────────┐
│                        你的 Next.js 应用                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │   Agent A    │───▶│   Agent B    │───▶│  执行器      │    │
│  │  (任务分配)  │    │  (决策)      │    │  (调用工具)   │    │
│  └──────────────┘    └──────┬───────┘    └──────────────┘    │
│                               │                                     │
│                               ▼                                     │
│                    ┌──────────────────┐                            │
│                    │  ToolRegistry    │  ← 我们内部用的！         │
│                    │  (search, wechat)│                            │
│                    └──────────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ （分开部署，可选）
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   标准 MCP 协议服务端 (独立进程)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  ListTools (列出工具)                                 │      │
│  │  CallTool (调用工具)                                   │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         │ JSON-RPC over stdio
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Desktop (外部客户端)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 使用场景对比

### ToolRegistry 的使用场景

**适用场景：**
- ✅ Agent B 处理任务时需要调用 MCP 工具
- ✅ 你的 Next.js 应用内部需要动态工具发现
- ✅ 需要根据 `capability_list` 表配置动态选择工具
- ✅ 需要运行时动态注册/注销工具

**不适用场景：**
- ❌ 给外部 AI 客户端（如 Claude Desktop）提供工具
- ❌ 需要跨进程通信

---

### 标准 MCP 协议服务端的使用场景

**适用场景：**
- ✅ 给 Claude Desktop 提供工具
- ✅ 给 VS Code 提供工具
- ✅ 给任何支持 MCP 协议的客户端提供工具
- ✅ 需要客户端零开发接入

**不适用场景：**
- ❌ Agent B 内部调用（效率太低，不需要跨进程）
- ❅ 需要与 Next.js 应用深度集成

---

## 总结对比表

| 维度 | ToolRegistry（已实现的） | 标准 MCP 协议服务端（示例） |
|------|---------------------|---------------------|
| **给谁用？** | 你的 Agent B | Claude Desktop、VS Code 等 |
| **通信方式** | 直接函数调用 | JSON-RPC over stdio |
| **用途** | Agent B 动态调用工具 | 外部 AI 客户端使用工具 |
| **位置** | 在 Next.js 应用内部 | 独立进程（可选） |
| **代码位置** | `src/lib/mcp/tool-registry.ts` | `src/lib/mcp/examples/complete-mcp-server.ts` |
| **是否已实现** | ✅ 已实现 | ✅ 已提供示例 |
| **动态注册** | ✅ 支持 | ✅ 支持（通过 ListTools） |
| **客户端零开发** | ❌ 不需要客户端 | ✅ 支持 |
| **适用场景** | Agent B 内部调用 | 外部 AI 客户端接入 |
| **学习成本** | 低（内部使用） | 中等（需要理解 MCP 协议） |
| **维护成本** | 低 | 中等 |

---

## 最佳实践建议

### 1. 按需选择

- **如果你需要 Agent B 调用工具：** 使用 ToolRegistry
- **如果你需要给 Claude Desktop 提供工具：** 使用标准 MCP 协议服务端
- **两者都需要：** 可以同时使用两者

### 2. 工具复用

可以在两个层面复用同一套工具实现：

```typescript
// 工具实现可以复用
const EmailMCPTools = {
  async sendEmail(params: SendEmailParams) {
    // 实现逻辑
  }
};

// 给 ToolRegistry 用
toolRegistry.registerTool('email', EmailMCPTools);

// 给标准 MCP 服务端用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'send_email') {
    return await EmailMCPTools.sendEmail(request.params.arguments);
  }
});
```

---

## 相关文档

- [详细设计文档agent智能交互MCP能力设计capability_type.md](./详细设计文档agent智能交互MCP能力设计capability_type.md)
- [ToolRegistry 使用示例](../src/lib/mcp/examples/README.md)
- [标准 MCP 服务端示例](../src/lib/mcp/examples/complete-mcp-server.ts)
