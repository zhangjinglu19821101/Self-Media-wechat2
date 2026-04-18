# 🚀 完整的 MCP 服务端示例

这个示例展示了如何实现一个标准的 MCP 服务端，客户端可以零开发接入！

## 📋 目录结构

```
examples/
├── complete-mcp-server.ts    # 完整的 MCP 服务端代码
├── claude-config.example.json    # Claude Desktop 配置示例
└── README.md              # 使用说明
```

## 🎯 快速开始

### 1. 编译服务端

```bash
# 编译 TypeScript
cd /workspace/projects
npx tsc src/lib/mcp/examples/complete-mcp-server.ts --outDir dist/
```

### 2. 配置 Claude Desktop

根据你的操作系统，选择配置文件位置：

**Mac:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

**配置文件内容（复制 `claude-config.example.json`）：

```json
{
  "mcpServers": {
    "my-awesome-server": {
      "command": "node",
      "args": [
        "/workspace/projects/dist/complete-mcp-server.js"
      ]
    }
  }
}
```

### 3. 重启 Claude Desktop

1. 完全退出 Claude Desktop
2. 重新打开
3. 你的 MCP 工具自动出现了！

## 🛠️ 可用工具

### send_email - 发送邮件

**参数：**
- `to` (必填): 收件人邮箱
- `subject` (必填): 邮件主题
- `body` (必填): 邮件内容
- `cc` (可选): 抄送列表
- `bcc` (可选): 密送列表

**示例：**
```json
{
  "to": "user@example.com",
  "subject": "测试邮件",
  "body": "这是一封测试邮件"
}
```

### get_weather - 获取天气

**参数：**
- `city` (必填): 城市名称

**示例：**
```json
{
  "city": "北京"
}
```

## 🔍 测试服务端

### 直接运行服务端测试：

```bash
cd /workspace/projects
node dist/complete-mcp-server.js
```

## 📝 自定义你的工具

### 添加新工具的步骤：

1. **在 `complete-mcp-server.ts` 中：

```typescript
// 1. 添加类型定义
interface MyNewToolParams {
  param1: string;
}

// 2. 实现工具类
class MyNewService {
  async myNewTool(params: MyNewToolParams) {
    // 你的逻辑
    return { success: true };
  }
}

// 3. 在 ListTools 中添加工具定义
{
  name: 'my_new_tool',
  description: '工具描述',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '参数描述' }
    },
    required: ['param1']
  }
}

// 4. 在 CallTool 中添加处理逻辑
case 'my_new_tool':
  result = await myNewService.myNewTool(args);
  break;
```

## 🎉 完成！

现在你有了一个完整的 MCP 服务端，客户端可以零开发接入了！
