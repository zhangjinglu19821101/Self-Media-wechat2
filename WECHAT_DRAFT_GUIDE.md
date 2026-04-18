# 微信公众号草稿箱配置和使用指南

## 功能概述

insurance-d 和 Agent D 现已具备**微信公众号草稿箱管理**能力，可以将创作的文章直接上传到对应公众号的草稿箱。

**Agent 对应关系**：
- **insurance-d** → 保险科普公众号
- **Agent D** → AI 技术公众号

## 配置步骤

### 步骤 1: 获取微信公众号信息

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入"设置与开发" → "基本配置"
3. 获取以下信息：
   - **AppID**: 公众号的唯一标识
   - **AppSecret**: 公众号的密钥（需要管理员扫码验证）

### 步骤 2: 配置公众号信息

#### 方式 1: 使用 API 添加公众号

```bash
curl -X POST http://localhost:5000/api/wechat/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "insurance-account",
    "name": "保险科普公众号",
    "appId": "wx1234567890abcdef",
    "appSecret": "your_app_secret_here",
    "agent": "insurance-d",
    "description": "insurance-d 对应的保险科普公众号",
    "defaultAuthor": "保险科普",
    "enabled": true
  }'
```

**参数说明**：
- `id`: 公众号唯一标识（自定义）
- `name`: 公众号名称
- `appId`: 微信公众号 AppID
- `appSecret`: 微信公众号 AppSecret
- `agent`: 对应的 Agent（insurance-d 或 agent-d）
- `description`: 描述信息
- `defaultAuthor`: 默认作者名称
- `enabled`: 是否启用

#### 方式 2: 修改配置文件

编辑 `src/config/wechat-official-account.config.ts`：

```typescript
export const defaultWechatConfig: Record<string, WechatOfficialAccount> = {
  'insurance-account': {
    id: 'insurance-account',
    name: '保险科普公众号',
    appId: 'wx1234567890abcdef',  // 替换为真实的 AppID
    appSecret: 'your_app_secret_here',  // 替换为真实的 AppSecret
    agent: 'insurance-d',
    description: 'insurance-d 对应的保险科普公众号',
    enabled: true,
    defaultAuthor: '保险科普',
    defaultAuthorId: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  'ai-tech-account': {
    id: 'ai-tech-account',
    name: 'AI技术公众号',
    appId: 'wxabcdef1234567890',  // 替换为真实的 AppID
    appSecret: 'your_app_secret_here',  // 替换为真实的 AppSecret
    agent: 'agent-d',
    description: 'Agent D 对应的 AI 技术公众号',
    enabled: true,
    defaultAuthor: 'AI技术',
    defaultAuthorId: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};
```

### 步骤 3: 验证配置

```bash
# 查看所有公众号配置
curl http://localhost:5000/api/wechat/accounts
```

## 使用方法

### 1. 上传文章到草稿箱

#### 使用 API

```bash
curl -X POST http://localhost:5000/api/wechat/draft/upload \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "insurance-d",
    "title": "重疾险的常见误区",
    "content": "<p>大家好！今天我们来聊聊重疾险那些事儿...</p>",
    "author": "保险科普",
    "digest": "很多人觉得重疾险复杂，其实只要掌握几个要点...",
    "contentSourceUrl": "https://yourwebsite.com/article/1"
  }'
```

**参数说明**：
- `agent`: Agent 类型（insurance-d 或 agent-d）
- `title`: 文章标题（不超过 64 字）
- `content`: 文章内容（HTML 格式）
- `author`: 作者名称
- `digest`: 摘要（不超过 120 字）
- `contentSourceUrl`: 原文链接（可选）
- `accountId`: 指定公众号 ID（可选，默认使用 Agent 对应的公众号）

**响应**：
```json
{
  "success": true,
  "data": {
    "mediaId": "MEDIA_ID_xxx",
    "createTime": 1234567890,
    "account": {
      "id": "insurance-account",
      "name": "保险科普公众号"
    },
    "draft": {
      "title": "重疾险的常见误区",
      "author": "保险科普",
      "digest": "很多人觉得重疾险复杂，其实只要掌握几个要点..."
    }
  },
  "message": "文章已成功上传到草稿箱"
}
```

### 2. 通过 Agent 对话使用

#### insurance-d 对话示例

```
用户：请写一篇关于"如何选择重疾险"的文章，并上传到草稿箱。

insurance-d：收到！我将按照以下步骤执行：

1. 创作关于"如何选择重疾险"的文章
2. 进行合规校验
3. 上传到保险科普公众号草稿箱

[创作文章...]

文章已完成！内容概要：
- 标题：如何选择重疾险
- 作者：保险科普
- 摘要：选择重疾险需要关注保障范围、保额、等待期等要点...

正在上传到草稿箱...
✅ 上传成功！草稿 ID: MEDIA_ID_xxx

你可以在微信公众号后台查看和编辑这篇草稿。
```

#### Agent D 对话示例

```
用户：请写一篇关于"ChatGPT 最新进展"的文章，并上传到草稿箱。

Agent D：收到！我将按照以下步骤执行：

1. 创作关于"ChatGPT 最新进展"的文章
2. 格式化为公众号格式
3. 上传到 AI 技术公众号草稿箱

[创作文章...]

文章已完成！内容概要：
- 标题：ChatGPT 最新进展
- 作者：AI技术
- 摘要：ChatGPT 引入了新的功能和改进...

正在上传到草稿箱...
✅ 上传成功！草稿 ID: MEDIA_ID_yyy

你可以在微信公众号后台查看和编辑这篇草稿。
```

## API 接口

### 1. 获取公众号配置

```bash
GET /api/wechat/accounts
```

**响应**：
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "insurance-account",
        "name": "保险科普公众号",
        "appId": "wx1234567890abcdef",
        "appSecret": "***",
        "agent": "insurance-d",
        "description": "insurance-d 对应的保险科普公众号",
        "enabled": true
      }
    ],
    "total": 1
  }
}
```

### 2. 添加公众号配置

```bash
POST /api/wechat/accounts
```

**请求体**：
```json
{
  "id": "new-account",
  "name": "新公众号",
  "appId": "wx1234567890abcdef",
  "appSecret": "your_app_secret",
  "agent": "insurance-d",
  "description": "描述信息",
  "enabled": true
}
```

### 3. 更新公众号配置

```bash
PUT /api/wechat/accounts/:id
```

**请求体**：
```json
{
  "name": "更新后的名称",
  "appId": "wx1234567890abcdef",
  "appSecret": "new_app_secret",
  "enabled": false
}
```

### 4. 删除公众号配置

```bash
DELETE /api/wechat/accounts/:id
```

### 5. 上传草稿

```bash
POST /api/wechat/draft/upload
```

**请求体**：
```json
{
  "agent": "insurance-d",
  "title": "文章标题",
  "content": "<p>文章内容（HTML）</p>",
  "author": "作者名称",
  "digest": "文章摘要",
  "contentSourceUrl": "原文链接（可选）",
  "accountId": "指定公众号 ID（可选）"
}
```

## 文章格式要求

### 标题
- 长度：不超过 64 个字符
- 风格：简洁明了，吸引眼球
- 示例：`重疾险的常见误区`、`深入理解 ChatGPT 原理`

### 摘要
- 长度：不超过 120 个字符
- 内容：准确概括文章核心内容
- 示例：`选择重疾险需要关注保障范围、保额、等待期等要点...`

### 正文格式

#### 支持的 HTML 标签
- `<h2>`、`<h3>`：标题
- `<p>`、`<section>`：段落
- `<strong>`、`<b>`：加粗
- `<em>`、`<i>`：斜体
- `<ul>`、`<ol>`、`li`：列表
- `<blockquote>`：引用
- `<code>`、`<pre>`：代码

#### 示例格式
```html
<h2 style="font-size: 18px; font-weight: bold;">重疾险的常见误区</h2>

<p>很多人觉得重疾险复杂，其实只要掌握几个要点...</p>

<h3 style="font-size: 16px; font-weight: bold;">误区一：年轻不用买</h3>

<p>重疾险越早买越好，不仅保费便宜，而且身体条件好更容易通过核保。</p>

<p><strong>建议：</strong>从 25 岁开始配置重疾险。</p>

<blockquote>记住，宁可备而不用，不可用而不备。</blockquote>
```

## 常见问题

### Q1: AppSecret 如何获取？

**A**:
1. 登录微信公众平台
2. 进入"设置与开发" → "基本配置"
3. 点击"AppSecret"右侧的"重置"或"生成"
4. 扫描管理员二维码验证
5. 获取 AppSecret

### Q2: 上传草稿失败，提示"获取 Access Token 失败"

**A**:
- 检查 AppID 和 AppSecret 是否正确
- 检查公众号是否已认证
- 检查网络连接
- 确认 IP 白名单配置（如果有）

### Q3: 草稿上传成功，但在公众号后台找不到

**A**:
- 检查是否选择了正确的公众号
- 登录对应的公众号后台
- 进入"首页" → "草稿箱"
- 查看草稿列表

### Q4: 如何修改已上传的草稿？

**A**:
目前 API 不支持直接修改草稿，需要：
1. 在微信公众号后台打开草稿
2. 手动修改内容
3. 保存草稿

### Q5: 如何删除草稿？

**A**:
- 在微信公众号后台打开草稿
- 点击"删除"按钮
- 确认删除

## Agent 使用示例

### insurance-d 完整工作流程

```
用户：请按照之前保险科普文章的风格，写一篇关于"少儿保险配置"的文章，
      并上传到草稿箱。

insurance-d：收到！我将执行以下步骤：

【步骤 1】风格分析
- 分析历史文章的风格特征
- 提取风格模板

【步骤 2】内容创作
- 按照风格创作文章
- 确保内容通俗易懂

【步骤 3】合规校验
- 检查是否符合金融保险合规要求
- 确保无违规表述

【步骤 4】上传草稿
- 格式化为公众号格式
- 上传到草稿箱

---
文章已创作完成！

标题：少儿保险配置指南
作者：保险科普
摘要：为孩子配置保险需要关注教育金、重疾险、医疗险等要点...

正在上传草稿箱...
✅ 上传成功！草稿 ID: MEDIA_ID_xxx

你可以在"保险科普"公众号后台查看和编辑这篇草稿。
```

### Agent D 完整工作流程

```
用户：请写一篇关于"React 19 新特性"的技术文章，并上传到草稿箱。

Agent D：收到！我将执行以下步骤：

【步骤 1】内容创作
- 撰写技术文章
- 包含代码示例

【步骤 2】格式化
- 使用 HTML 标签排版
- 添加代码块

【步骤 3】上传草稿
- 上传到 AI 技术公众号

---
文章已创作完成！

标题：React 19 新特性详解
作者：AI技术
摘要：React 19 引入了 Server Components、并发优化等新特性...

[文章内容包含代码示例和详细说明]

正在上传草稿箱...
✅ 上传成功！草稿 ID: MEDIA_ID_yyy

你可以在"AI技术"公众号后台查看和编辑这篇草稿。
```

## 配置示例

### insurance-d 公众号配置

```json
{
  "id": "insurance-account",
  "name": "保险科普公众号",
  "appId": "wx1234567890abcdef",
  "appSecret": "your_app_secret_here",
  "agent": "insurance-d",
  "description": "insurance-d 对应的保险科普公众号",
  "enabled": true,
  "defaultAuthor": "保险科普",
  "defaultAuthorId": 1
}
```

### Agent D 公众号配置

```json
{
  "id": "ai-tech-account",
  "name": "AI技术公众号",
  "appId": "wxabcdef1234567890",
  "appSecret": "your_app_secret_here",
  "agent": "agent-d",
  "description": "Agent D 对应的 AI 技术公众号",
  "enabled": true,
  "defaultAuthor": "AI技术",
  "defaultAuthorId": 2
}
```

## 注意事项

1. **安全性**：
   - AppSecret 敏感信息，请妥善保管
   - 不要在公开代码中暴露 AppSecret
   - 建议使用环境变量存储

2. **限制**：
   - Access Token 有效期 2 小时
   - 单个公众号每天最多上传 100 篇草稿
   - 文章标题不超过 64 字
   - 摘要不超过 120 字

3. **合规**：
   - insurance-d 的内容必须符合金融保险合规要求
   - 避免违规表述
   - 建议上传前进行二次校验

4. **格式**：
   - 正文使用 HTML 格式
   - 建议使用标准的 HTML5 标签
   - 避免使用不兼容的样式

## 后续优化计划

- [ ] 支持封面图上传
- [ ] 支持草稿列表查看
- [ ] 支持草稿删除 API
- [ ] 支持草稿修改 API
- [ ] 支持定时发布
- [ ] 支持多图文上传
- [ ] 添加草稿模板
- [ ] 提供可视化配置界面

## 相关文档

- [微信公众号官方文档](https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html)
- [草稿箱 API 文档](https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Add.html)
- [风格模仿指南](STYLE_MIMICRY_GUIDE.md)
- [Agent D 风格指南](AGENT_D_STYLE_GUIDE.md)
