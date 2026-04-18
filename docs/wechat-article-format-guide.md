# 📱 公众号文章格式化功能指南

## 🎯 功能概述

实现合规审核后的文章在调用 Agent T 上传公众号之前的模板格式化功能。

### 核心流程

```
insurance-d 生成文章
    ↓
Agent T 合规审核
    ↓
【新增加】公众号文章格式化（使用 wechat_article.html 模板）
    ↓
Agent T 发布到公众号草稿箱
```

---

## 📋 实现内容

### 1. 能力定义 (`src/lib/agent-capabilities.ts`)

在 `DOMAIN_CAPABILITIES_TEMPLATES` 中新增了 **"自媒体"** 领域能力：

#### Agent B 的新能力：

| 能力ID | 能力名称 | 级别 | 描述 | 工具 |
|---------|---------|------|------|------|
| `wechat-article-format` | 公众号文章格式化 | 85 | 将合规审核后的文章使用 wechat_article.html 模板进行格式化，适配公众号排版要求 | `wechat-article-format-tool` |
| `wechat-article-publish` | 公众号文章发布 | 90 | 将格式化后的文章发布到微信公众号草稿箱 | `wechat-draft-publish` |

### 2. API 接口 (`src/app/api/tools/wechat/format/route.ts`)

#### 接口说明

**POST** `/api/tools/wechat/format`

公众号文章格式化工具，使用 `wechat_article.html` 模板格式化文章内容。

#### 请求参数

```typescript
{
  "title": "文章标题",           // 必填
  "content": "文章内容...",       // 必填，纯文本
  "author": "作者名",             // 可选
  "date": "2026年2月1日"         // 可选，默认为今天
}
```

#### 响应示例

**成功响应：**

```json
{
  "success": true,
  "data": {
    "formattedHtml": "<section style=...>...</section>",
    "metadata": {
      "title": "文章标题",
      "author": "作者名",
      "date": "2026年2月1日",
      "originalLength": 1050,
      "formattedLength": 2300
    }
  }
}
```

**失败响应：**

```json
{
  "success": false,
  "error": "缺少必填字段：title 和 content 是必填的"
}
```

#### 核心功能

1. **模板渲染**：使用 `src/templates/wechat_article.html` 作为模板
2. **变量替换**：
   - `{{title}}` → 文章标题
   - `{{author}}` → 作者
   - `{{date}}` → 日期
   - `{{content}}` → 格式化后的内容
3. **内容格式化**：
   - 将纯文本转换为 HTML 段落
   - 处理换行符，转换为 `<p>` 标签
   - 段落内部换行使用 `<br>` 标签
   - HTML 特殊字符转义

### 3. 类型定义 (`src/lib/types/wechat-format.ts`)

包含完整的类型定义：
- `WeChatFormatRequest` - 格式化请求参数
- `WeChatFormatResponse` - 格式化响应结果
- `WECHAT_FORMAT_CAPABILITY_PARAM_DESC` - MCP 能力参数描述
- `WeChatPublishRequest` - 公众号发布请求参数
- `WeChatPublishResponse` - 公众号发布响应结果

---

## 🔧 使用方式

### 方式 1：直接调用 API

```typescript
const response = await fetch('/api/tools/wechat/format', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '咱爸妈想了解分红险？记住3点，不踩坑更安心',
    content: '开头内容...\n\n正文第一条...\n\n正文第二条...',
    author: '保险科普小助手',
    date: '2026年2月1日',
  }),
});

const result = await response.json();
if (result.success) {
  console.log('格式化后的HTML:', result.data.formattedHtml);
}
```

### 方式 2：通过 Agent T 调用（推荐）

Agent T 会自动识别任务，选择合适的能力进行处理。

**任务示例：**

```
"将这篇合规审核通过的文章格式化为公众号格式，然后发布到草稿箱"
```

**Agent T 处理流程：**

1. 识别任务需要格式化和发布
2. 选择 `wechat-article-format` 能力
3. 调用格式化 API
4. 选择 `wechat-article-publish` 能力
5. 调用发布 API

---

## 📝 模板说明

### wechat_article.html 模板结构

```html
<section style="padding:0 15px;max-width:750px;margin:0 auto;">
  <!-- 标题 -->
  <h2 style="font-size:17px;font-weight:bold;color:#333;margin:20px 0 10px;line-height:1.6;">
    {{title}}
  </h2>
  <!-- 作者+日期 -->
  <p style="font-size:13px;color:#888;margin:0 0 15px;">
    {{author}} · {{date}}
  </p>
  <!-- 正文内容 -->
  <div style="font-size:15px;line-height:1.8;color:#333;">
    {{content}}
  </div>
</section>
```

### 样式特点

- ✅ 最大宽度 750px（适配公众号）
- ✅ 标题：17px，加粗
- ✅ 作者日期：13px，灰色
- ✅ 正文：15px，行高 1.8
- ✅ 左右各 15px 内边距

---

## 🔄 完整工作流示例

### 场景：保险科普文章发布

```
1. 用户请求
   "帮我写一篇关于分红险的科普文章，然后发布到公众号"
   ↓
2. Agent A 分解任务
   - 任务1：insurance-d 创作文章
   - 任务2：Agent T 合规审核
   - 任务3：Agent B 格式化文章
   - 任务4：Agent T 发布到公众号
   ↓
3. insurance-d 执行
   ✅ 生成文章（1000字左右）
   ✅ 返回 ExecutorOutput 格式
   ↓
4. Agent T 合规审核
   ✅ 检查合规性
   ✅ 返回审核通过
   ↓
5. Agent B 格式化文章 【新功能】
   ✅ 调用 /api/tools/wechat/format
   ✅ 使用 wechat_article.html 模板
   ✅ 返回格式化后的 HTML
   ↓
6. Agent T 发布到公众号
   ✅ 调用公众号 API
   ✅ 返回文章 ID 和发布链接
   ↓
7. Agent A 汇总结果
   ✅ 告知用户发布成功
```

---

## 📊 核心文件清单

| 文件 | 用途 |
|------|------|
| `src/lib/agent-capabilities.ts` | 定义公众号格式化和发布能力 |
| `src/app/api/tools/wechat/format/route.ts` | 格式化 API 接口 |
| `src/lib/types/wechat-format.ts` | 类型定义 |
| `src/templates/wechat_article.html` | 公众号文章模板 |
| `docs/wechat-article-format-guide.md` | 本文档 |

---

## 🎯 下一步建议

### 待完善功能

1. **公众号发布 API**
   - 创建 `src/app/api/tools/wechat/publish/route.ts`
   - 集成微信公众号 API
   - 实现草稿箱发布功能

2. **Agent T 提示词更新**
   - 在 Agent T 的提示词中添加格式化流程说明
   - 指导 Agent T 在发布前先调用格式化能力

3. **能力市场配置**
   - 在能力市场中添加这两个新能力
   - 设置价格和提供者信息

4. **测试用例**
   - 创建格式化功能的单元测试
   - 创建完整流程的集成测试

---

## 🚀 快速开始

### 测试格式化功能

```bash
# 使用 curl 测试 API
curl -X POST http://localhost:5000/api/tools/wechat/format \
  -H "Content-Type: application/json" \
  -d '{
    "title": "咱爸妈想了解分红险？记住3点，不踩坑更安心",
    "content": "咱邻居阿姨买分红险时就踩过坑。\n\n记住这3点：\n1. 不要只看演示利率\n2. 了解保底收益\n3. 看清楚保险责任",
    "author": "保险科普小助手",
    "date": "2026年2月1日"
  }'
```

### 在管理后台查看能力

访问：http://localhost:5000/admin/agent-builder/capabilities

可以看到新增的"自媒体"领域能力。

---

## 📝 总结

**已完成的功能：**

✅ 定义公众号文章格式化能力  
✅ 创建格式化 API 接口  
✅ 实现 wechat_article.html 模板渲染  
✅ 支持纯文本到 HTML 的转换  
✅ 完整的类型定义  
✅ 详细的使用文档

**核心优势：**

1. **无缝集成** - 插入到现有的 Agent 工作流中
2. **模板化** - 使用统一的公众号模板，保证排版一致性
3. **自动化** - Agent T 可以自动识别并调用格式化能力
4. **可扩展** - 未来可以支持更多模板和平台

---

**最后更新**: 2026年2月1日  
**版本**: v1.0  
**状态**: ✅ 核心功能已完成
