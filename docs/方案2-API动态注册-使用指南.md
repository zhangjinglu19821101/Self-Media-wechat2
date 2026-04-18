# 方案 2：API 动态注册 - 使用指南

## 📋 概述

API 动态注册方案允许你在运行时动态注册 MCP 工具，**完全不需要重启应用！**

---

## 🎯 核心特点

| 特点 | 说明 |
|------|------|
| ✅ 不需要重启 | 注册后立即生效 |
| ✅ 不需要改代码 | 通过 API 调用 |
| ✅ 灵活性最高 | 随时注册/注销 |
| ⚠️ 函数传递限制 | JSON 无法直接传递复杂函数 |

---

## 📁 创建的文件

| 文件 | 说明 |
|------|------|
| `src/app/api/mcp/register-tool/route.ts` | API 路由实现 |
| `src/lib/mcp/examples/api-register-example.ts` | 使用示例 |
| `src/lib/mcp/examples/test-api-register.sh` | 测试脚本 |

---

## 🚀 快速开始

### 方式 1：在代码中直接注册（推荐）

虽然我们提供了 API，但**最实用的方式还是在代码中直接注册**：

```typescript
// 在你的任何代码中（比如 layout.tsx, API 路由等）

import { toolRegistry } from '@/lib/mcp/tool-registry';

// 1. 定义你的工具
const EmailTools = {
  async sendEmail(params: {
    to: string;
    subject: string;
    body: string;
  }) {
    console.log('[Email Tools] 发送邮件:', params);
    // 实现你的逻辑
    return { success: true };
  }
};

// 2. 注册工具
toolRegistry.registerTool(
  'email',
  EmailTools,
  '邮件相关工具：发送邮件'
);

console.log('✅ 邮件工具注册成功');
console.log('✅ 可用工具:', toolRegistry.getAvailableTools());
```

---

### 方式 2：使用 API（适用于简单场景）

#### 获取已注册的工具列表

```bash
curl -X GET http://localhost:5000/api/mcp/register-tool
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "count": 2,
    "tools": [
      {
        "name": "search",
        "description": "搜索相关工具",
        "methods": ["webSearch", "imageSearch"]
      },
      {
        "name": "wechat",
        "description": "微信公众号工具",
        "methods": ["addDraft", "getDraftList"]
      }
    ]
  },
  "availableTools": ["search", "wechat"]
}
```

---

#### 注册新工具（简单场景）

**⚠️ 注意：JSON 无法直接传递函数，这个 API 主要用于：**
1. 查看已注册的工具
2. 测试 API 是否正常
3. 简单的工具（不包含复杂函数）

**对于复杂工具，推荐在代码中直接注册！**

```bash
curl -X POST http://localhost:5000/api/mcp/register-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "calculator",
    "description": "简单计算器",
    "tools": {
      "add": "function(a, b) { return a + b; }",
      "subtract": "function(a, b) { return a - b; }"
    }
  }'
```

---

#### 注销工具

```bash
curl -X DELETE http://localhost:5000/api/mcp/register-tool \
  -H "Content-Type: application/json" \
  -d '{
    "name": "calculator"
  }'
```

---

## 🎯 API 完整文档

### GET /api/mcp/register-tool

获取当前已注册的所有 MCP 工具列表。

**响应：**
```json
{
  "success": true,
  "data": {
    "count": 2,
    "tools": [
      {
        "name": "search",
        "description": "搜索相关工具",
        "methods": ["webSearch", "imageSearch"]
      }
    ]
  },
  "availableTools": ["search", "wechat"]
}
```

---

### POST /api/mcp/register-tool

动态注册新的 MCP 工具。

**请求体：**
```json
{
  "name": "email",
  "description": "邮件相关工具",
  "tools": {
    "sendEmail": "function(params) { ... }"
  }
}
```

**响应：**
```json
{
  "success": true,
  "message": "工具 \"email\" 注册成功",
  "data": {
    "name": "email",
    "description": "邮件相关工具",
    "methods": ["sendEmail"],
    "registeredAt": "2024-01-01T00:00:00.000Z"
  },
  "availableTools": ["search", "wechat", "email"]
}
```

---

### DELETE /api/mcp/register-tool

注销指定的 MCP 工具。

**请求体：**
```json
{
  "name": "email"
}
```

**响应：**
```json
{
  "success": true,
  "message": "工具 \"email\" 注销成功",
  "data": {
    "name": "email",
    "unregisteredAt": "2024-01-01T00:00:00.000Z"
  },
  "availableTools": ["search", "wechat"]
}
```

---

## 💡 实际使用建议

### 推荐使用场景

| 场景 | 推荐方式 |
|------|---------|
| **核心工具** | 在 `layout.tsx` 中直接注册 |
| **临时工具** | 在代码中动态注册 |
| **测试工具** | 使用 API 测试 |
| **生产环境** | 在代码中注册，更可控 |

---

### 完整示例：在 layout.tsx 中注册

```typescript
// src/app/layout.tsx

import { toolRegistry } from '@/lib/mcp/tool-registry';

// 导入你的工具
import { EmailMCPTools } from '@/lib/mcp/email-tools';
import { WeatherMCPTools } from '@/lib/mcp/weather-tools';

// 启动后台服务（仅在服务端运行）
if (typeof window === 'undefined') {
  // ... 其他初始化代码 ...
  
  // ============================================
  // 🔥 注册你的 MCP 工具！
  // ============================================
  
  toolRegistry.registerTool(
    'email',
    EmailMCPTools,
    '邮件相关工具：发送邮件'
  );
  
  toolRegistry.registerTool(
    'weather',
    WeatherMCPTools,
    '天气相关工具：获取天气信息'
  );
  
  console.log('✅ MCP 工具注册完成');
  console.log('✅ 可用工具:', toolRegistry.getAvailableTools());
}
```

---

## 🧪 运行测试脚本

```bash
cd /workspace/projects/src/lib/mcp/examples
./test-api-register.sh
```

---

## ⚠️ 重要提示

1. **JSON 无法传递函数**：API 方式主要用于查看工具列表，复杂工具建议在代码中注册
2. **对使用方无影响**：无论用哪种方式注册，Agent B 都不需要改代码
3. **推荐在代码中注册**：更可控、更安全、更容易维护

---

## ✅ 总结

| 方式 | 推荐度 | 适用场景 |
|------|--------|---------|
| **在代码中直接注册** | ⭐⭐⭐⭐⭐ | 核心工具、生产环境 |
| **API 动态注册** | ⭐⭐⭐ | 测试、临时工具、查看列表 |

**推荐优先在代码中直接注册工具，API 主要用于查看和测试！**
