# 微信公众号合规规则配置指南

## 📋 概述

本文档说明如何将微信公众号合规规则配置到 RAG 知识库中，使其可以被 Agent 体系检索和使用。

---

## 🎯 配置目标

将微信公众号合规规则导入到 **RAG 知识库**，配置为独立的 `collection`，便于 Agent 检索和查询。

### 配置位置

```
RAG 知识库
└── wechat_compliance_rules (Collection)
    ├── 基础协议
    ├── 运营规范
    ├── 支付相关
    ├── 内容转载与原创
    ├── 违规内容治理
    ├── 违规行为治理
    ├── 侵权相关
    └── 法律法规
```

---

## 📁 当前规则文件

| 文件路径 | 大小 | 说明 |
|---------|------|------|
| `./backup/download_log/AgentB/公众号合规规则合并.md` | 116KB | 微信公众号合规规则合并文档 |

**文档内容：**
- 31个官方文档
- 8大分类（基础协议、运营规范、支付相关等）
- 涵盖所有合规要求

---

## 🚀 配置方法

### 方法1：使用导入脚本（推荐）

```bash
# 1. 给脚本添加执行权限
chmod +x import-wechat-compliance-rules.sh

# 2. 执行导入脚本
./import-wechat-compliance-rules.sh
```

**脚本功能：**
- ✅ 自动读取规则文件
- ✅ 调用 API 导入到知识库
- ✅ 设置正确的 metadata
- ✅ 显示导入结果统计

### 方法2：手动 API 调用

```bash
# 1. 读取规则文件内容
RULES_CONTENT=$(cat ./backup/download_log/AgentB/公众号合规规则合并.md)

# 2. 调用导入 API
curl -X POST http://localhost:5000/api/rag/documents \
  -H "Content-Type: application/json" \
  -d "{
    \"text\": $(echo "$RULES_CONTENT" | jq -Rs .),
    \"metadata\": {
      \"source\": \"./backup/download_log/AgentB/公众号合规规则合并.md\",
      \"title\": \"微信公众号合规规则合并文档\",
      \"document_type\": \"compliance_rules\",
      \"platform\": \"wechat\",
      \"category\": \"合规规则\",
      \"created_date\": \"2026-02-07\",
      \"version\": \"merged_v1.0\"
    },
    \"collectionName\": \"wechat_compliance_rules\"
  }"
```

---

## 📊 配置参数说明

### Collection 名称

```json
"collectionName": "wechat_compliance_rules"
```

**说明：**
- 使用独立的 collection 名称
- 便于管理和查询
- 区分于其他知识库内容

### Metadata 结构

```json
{
  "source": "./backup/download_log/AgentB/公众号合规规则合并.md",
  "title": "微信公众号合规规则合并文档",
  "document_type": "compliance_rules",
  "platform": "wechat",
  "category": "合规规则",
  "created_date": "2026-02-07",
  "version": "merged_v1.0"
}
```

**字段说明：**
- `source`: 源文件路径
- `title`: 文档标题
- `document_type`: 文档类型（compliance_rules）
- `platform`: 平台标识（wechat）
- `category`: 分类（合规规则）
- `created_date`: 创建日期
- `version`: 版本号

---

## ✅ 配置验证

### 1. 检查导入状态

```bash
curl http://localhost:5000/api/rag/stats
```

**预期响应：**

```json
{
  "success": true,
  "data": {
    "totalDocuments": 1,
    "totalChunks": 50,
    "collections": {
      "wechat_compliance_rules": {
        "documentCount": 1,
        "chunkCount": 50
      }
    }
  }
}
```

### 2. 测试检索功能

```bash
# 查询"敏感词"相关规则
curl -X GET "http://localhost:5000/api/rag/documents?query=敏感词&collectionName=wechat_compliance_rules&topK=5"

# 查询"保险"相关规则
curl -X GET "http://localhost:5000/api/rag/documents?query=保险&collectionName=wechat_compliance_rules&topK=5"

# 查询"隐私保护"相关规则
curl -X GET "http://localhost:5000/api/rag/documents?query=隐私保护&collectionName=wechat_compliance_rules&topK=5"
```

### 3. 查看知识库管理界面

访问：`http://localhost:5000/knowledge-base`

可以：
- 查看已导入的文档
- 测试搜索功能
- 查看向量分块

---

## 🔧 配置后的使用方式

### Agent 调用示例

#### 1. 直接检索 API

```typescript
// Agent 获取合规规则
async function getComplianceRules(query: string) {
  const response = await fetch(
    `http://localhost:5000/api/rag/documents?query=${encodeURIComponent(query)}&collectionName=wechat_compliance_rules&topK=5`
  );
  const data = await response.json();
  return data.results;
}

// 使用示例
const rules = await getComplianceRules("保险产品宣传违规");
console.log(rules);
```

#### 2. 通过 Agent 工具调用

```typescript
import { retrieveAndEnhancePrompt } from '@/lib/rag/agent-tools';

const enhancedPrompt = await retrieveAndEnhancePrompt(
  '保险产品宣传违规',
  '请检查以下内容是否违反微信公众号合规规则',
  {
    collectionName: 'wechat_compliance_rules',
    topK: 5
  }
);

console.log(enhancedPrompt);
```

#### 3. TS 代码自动调用（定时任务）

```typescript
// insurance-d 定时任务中的合规校验
import { retrieveAndEnhancePrompt } from '@/lib/rag/agent-tools';

// 获取最新合规规则
const complianceRules = await retrieveAndEnhancePrompt(
  '保险宣传违规敏感词',
  '请列出保险产品宣传中禁止的敏感词和违规表述',
  {
    collectionName: 'wechat_compliance_rules',
    topK: 10
  }
);

// 使用规则进行校验
const draftContent = '...';
const violations = checkCompliance(draftContent, complianceRules);
```

---

## 📝 配置清单

### 配置前准备

- [ ] 确认规则文件存在：`./backup/download_log/AgentB/公众号合规规则合并.md`
- [ ] 确认 Next.js 服务运行：`curl -I http://localhost:5000`
- [ ] 确认 RAG 系统已初始化

### 执行配置

- [ ] 运行导入脚本：`./import-wechat-compliance-rules.sh`
- [ ] 检查导入结果：`curl http://localhost:5000/api/rag/stats`
- [ ] 测试检索功能

### 验证配置

- [ ] 测试敏感词查询
- [ ] 测试保险相关规则查询
- [ ] 测试隐私保护规则查询
- [ ] 验证 Agent 可以调用

---

## 🎯 配置成功标志

### 导入成功标志

```bash
✅ 导入成功！

📊 导入统计：
   - Collection: wechat_compliance_rules
   - 文档数: 1
   - 分块数: 50
```

### 功能可用标志

| 功能 | 测试方法 | 预期结果 |
|------|---------|---------|
| **导入统计** | `/api/rag/stats` | 显示 `wechat_compliance_rules: 1文档, 50分块` |
| **检索功能** | `query=敏感词` | 返回相关规则片段 |
| **Agent调用** | Agent工具调用 | 成功获取合规规则 |

---

## 🔄 规则更新流程

### 规则更新步骤

1. **更新源文件**
   ```bash
   # 编辑规则文件
   vim ./backup/download_log/AgentB/公众号合规规则合并.md
   ```

2. **重新导入**
   ```bash
   # 方式1：重新导入（覆盖）
   ./import-wechat-compliance-rules.sh

   # 方式2：先删除再导入
   # 删除旧规则
   curl -X DELETE "http://localhost:5000/api/rag/documents?collectionName=wechat_compliance_rules"

   # 重新导入
   ./import-wechat-compliance-rules.sh
   ```

3. **验证更新**
   ```bash
   curl http://localhost:5000/api/rag/stats
   ```

---

## 📞 常见问题

### Q1: 导入失败怎么办？

**检查：**
```bash
# 1. 检查服务是否运行
curl -I http://localhost:5000

# 2. 检查规则文件是否存在
ls -la ./backup/download_log/AgentB/公众号合规规则合并.md

# 3. 查看错误日志
tail -n 20 /app/work/logs/bypass/app.log
```

### Q2: 如何知道规则已经成功导入？

**查询统计：**
```bash
curl http://localhost:5000/api/rag/stats
```

查看 `wechat_compliance_rules` 的 `documentCount` 和 `chunkCount`。

### Q3: Agent 如何使用这些规则？

**方式1：直接调用 API**
```typescript
const response = await fetch(
  `/api/rag/documents?query=敏感词&collectionName=wechat_compliance_rules&topK=5`
);
```

**方式2：使用 Agent 工具**
```typescript
import { retrieveAndEnhancePrompt } from '@/lib/rag/agent-tools';

const rules = await retrieveAndEnhancePrompt(
  '保险宣传违规',
  '请列出保险宣传中的违规表述',
  { collectionName: 'wechat_compliance_rules' }
);
```

---

## 📚 相关文档

- [RAG 知识库使用文档](../src/lib/rag/README.md)
- [Agent 工具集成文档](../src/lib/rag/agent-integration-example.ts)
- [向量数据库架构文档](vector-db-architecture.md)

---

## ✅ 总结

### 配置位置

**RAG 知识库 → Collection: `wechat_compliance_rules`**

### 配置步骤

1. 运行导入脚本：`./import-wechat-compliance-rules.sh`
2. 验证导入：`curl http://localhost:5000/api/rag/stats`
3. 测试检索：`query=敏感词`

### 使用方式

- Agent 通过 API 检索规则
- 支持向量相似度搜索
- 返回相关规则片段和来源

---

**配置完成后，所有 Agent 都可以通过 RAG 知识库检索和使用微信公众号合规规则！**
