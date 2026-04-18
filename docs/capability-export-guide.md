# 📦 能力导出完整指南

## 🎯 核心回答

**是的，基础能力和领域能力都能够导出！**

---

## ✅ 导出能力概览

| 能力类型 | 可导出 | 导出方式 | 文件格式 |
|---------|-------|---------|---------|
| **基础能力** | ✅ 是 | API / 代码 | JSON, YAML, TOML |
| **领域能力** | ✅ 是 | API / 代码 | JSON, YAML, TOML |
| **完整能力包** | ✅ 是 | API / 代码 | JSON, YAML, TOML |

---

## 📡 导出 API 接口

### 1. 导出基础能力

**端点**: `GET /api/admin/capabilities/export/base`

**参数**:
- `agentId` (可选): 指定导出某个 Agent 的基础能力
- `format` (可选): 导出格式（json/yaml/toml），默认 json

**示例**:

```bash
# 导出所有基础能力
curl "http://localhost:5000/api/admin/capabilities/export/base"

# 导出 Agent B 的基础能力
curl "http://localhost:5000/api/admin/capabilities/export/base?agentId=B"

# 导出 YAML 格式
curl "http://localhost:5000/api/admin/capabilities/export/base?format=yaml"
```

**响应**:
```json
{
  "success": true,
  "data": {
    "filename": "base-capabilities.json",
    "format": "json",
    "output": "{...}",
    "summary": {
      "filename": "base-capabilities.json",
      "scope": "base",
      "totalCapabilities": 21,
      "checksum": "67930ef"
    }
  }
}
```

---

### 2. 导出领域能力

**端点**: `GET /api/admin/capabilities/export/domain`

**参数**:
- `agentId` (可选): 指定导出某个 Agent 的领域能力
- `domain` (可选): 指定导出某个领域的领域能力
- `format` (可选): 导出格式（json/yaml/toml），默认 json

**示例**:

```bash
# 导出所有领域能力
curl "http://localhost:5000/api/admin/capabilities/export/domain"

# 导出电商领域的领域能力
curl "http://localhost:5000/api/admin/capabilities/export/domain?domain=电商"

# 导出 Agent B 的电商领域能力
curl "http://localhost:5000/api/admin/capabilities/export/domain?agentId=B&domain=电商"

# 使用 URL 编码（推荐）
curl "http://localhost:5000/api/admin/capabilities/export/domain?agentId=B&domain=%E7%94%B5%E5%95%86"
```

**响应**:
```json
{
  "success": true,
  "data": {
    "filename": "domain-capabilities.json",
    "format": "json",
    "output": "{...}",
    "summary": {
      "filename": "domain-capabilities.json",
      "domain": "电商",
      "scope": "domain",
      "totalCapabilities": 22,
      "checksum": "1c40c732"
    }
  }
}
```

---

### 3. 导出所有能力（基础 + 领域）

**端点**: `GET /api/admin/capabilities/export/all`

**参数**:
- `format` (可选): 导出格式（json/yaml/toml），默认 json

**示例**:

```bash
# 导出所有能力
curl "http://localhost:5000/api/admin/capabilities/export/all"

# 导出 YAML 格式
curl "http://localhost:5000/api/admin/capabilities/export/all?format=yaml"
```

**响应**:
```json
{
  "success": true,
  "data": {
    "filename": "all-capabilities.json",
    "format": "json",
    "output": "{...}",
    "summary": {
      "baseCapabilitiesCount": 21,
      "domainCapabilitiesCount": 22,
      "totalCapabilitiesCount": 43,
      "exportSize": 12802,
      "checksum": "796fa112"
    }
  }
}
```

---

## 💻 代码导出方式

### 使用 CapabilityExporter

```typescript
import { capabilityExporter, ExportFormat } from '@/lib/capability-export';

// 导出所有基础能力
const baseOutput = capabilityExporter.exportBaseCapabilities(ExportFormat.JSON);
fs.writeFileSync('base-capabilities.json', baseOutput);

// 导出特定 Agent 的基础能力
const agentBBase = capabilityExporter.exportAgentBaseCapabilities('B', ExportFormat.JSON);
fs.writeFileSync('base-capabilities-B.json', agentBBase);

// 导出所有领域能力
const domainOutput = capabilityExporter.exportDomainCapabilities(ExportFormat.JSON);
fs.writeFileSync('domain-capabilities.json', domainOutput);

// 导出特定领域的领域能力
const ecommerceOutput = capabilityExporter.exportDomainCapabilities(['电商'], ExportFormat.JSON);
fs.writeFileSync('domain-capabilities-ecommerce.json', ecommerceOutput);

// 导出所有能力（基础 + 领域）
const allOutput = capabilityExporter.exportAllCapabilities(ExportFormat.JSON);
fs.writeFileSync('all-capabilities.json', allOutput);
```

---

## 📊 导出数据结构

### 基础能力导出结构

```json
{
  "metadata": {
    "version": "1.0.0",
    "exportDate": "2026-01-31T14:37:09.437Z",
    "exportScope": "base",
    "exportFormat": "json",
    "checksum": "67930ef"
  },
  "capabilities": {
    "A": [
      {
        "id": "task-decomposition",
        "name": "任务分解",
        "level": 90,
        "description": "将复杂需求分解为具体任务",
        "type": "base",
        "replicable": true
      }
      // ... 更多基础能力
    ],
    "B": [...],
    "C": [...],
    "D": [...]
  }
}
```

### 领域能力导出结构

```json
{
  "metadata": {
    "version": "1.0.0",
    "exportDate": "2026-01-31T14:37:09.437Z",
    "exportScope": "domain",
    "exportFormat": "json",
    "checksum": "1c40c732"
  },
  "capabilities": {
    "电商": {
      "A": [...],
      "B": [...],
      "C": [...],
      "D": [...]
    },
    "金融": {
      "A": [...],
      "B": [...],
      "C": [...],
      "D": [...]
    },
    "医疗": {
      "A": [...],
      "B": [...],
      "C": [...],
      "D": [...]
    }
  }
}
```

### 完整能力导出结构

```json
{
  "metadata": {
    "version": "1.0.0",
    "exportDate": "2026-01-31T14:37:09.437Z",
    "exportScope": "all",
    "exportFormat": "json",
    "checksum": "796fa112"
  },
  "baseCapabilities": {
    "A": [...],
    "B": [...],
    "C": [...],
    "D": [...]
  },
  "domainCapabilities": {
    "电商": {
      "A": [...],
      "B": [...],
      "C": [...],
      "D": [...]
    },
    "金融": {...},
    "医疗": {...}
  }
}
```

---

## 🧪 测试结果

### ✅ 测试 1：导出所有基础能力

```
✅ 基础能力导出成功
   文件名: base-capabilities.json
   总能力数: 21
   校验和: 67930ef

各 Agent 基础能力:
   Agent A: 6 项
     - 任务分解 (90%)
     - 协调能力 (85%)
     - 决策能力 (88%)
     - 进度跟踪 (80%)
     - 冲突解决 (75%)
     - 沟通能力 (90%)
   Agent B: 5 项
     - 编程开发 (85%)
     - 调试能力 (80%)
     - 测试能力 (75%)
     - 版本控制 (80%)
     - 文档编写 (70%)
   Agent C: 5 项
     - 数据分析 (75%)
     - 内容运营 (70%)
     - 用户分群 (65%)
     - A/B 测试 (60%)
     - 报表生成 (70%)
   Agent D: 5 项
     - 文本写作 (80%)
     - 编辑排版 (75%)
     - 创意生成 (70%)
     - 内容规划 (65%)
     - SEO 基础 (60%)
```

### ✅ 测试 2：导出所有领域能力

```
✅ 领域能力导出成功
   文件名: domain-capabilities.json
   总能力数: 22
   校验和: 1c40c732

各领域领域能力:
   电商:
     Agent A: 2 项
       - 电商业务规则 (¥5,000)
       - 电商 KPI 指标 (¥3,000)
     Agent B: 2 项
       - 电商技术栈 (¥8,000)
       - 电商安全标准 (¥10,000)
     Agent C: 2 项
       - 电商推广渠道 (¥6,000)
       - 电商用户画像 (¥4,000)
     Agent D: 2 项
       - 电商品牌调性 (¥3,000)
       - 电商 SEO 策略 (¥5,000)
   金融:
     Agent A: 2 项
       - 金融业务规则 (¥15,000)
       - 金融 KPI 指标 (¥10,000)
     Agent B: 2 项
       - 金融技术栈 (¥20,000)
       - 金融安全标准 (¥30,000)
     Agent C: 2 项
       - 金融推广渠道 (¥12,000)
       - 金融用户画像 (¥8,000)
     Agent D: 2 项
       - 金融品牌调性 (¥5,000)
       - 金融合规写作 (¥15,000)
   医疗:
     Agent A: 1 项
       - 医疗业务规则 (¥20,000)
     Agent B: 2 项
       - 医疗技术栈 (¥25,000)
       - 医疗安全标准 (¥40,000)
     Agent C: 1 项
       - 医疗推广渠道 (¥15,000)
     Agent D: 2 项
       - 医疗品牌调性 (¥8,000)
       - 医疗合规写作 (¥20,000)
```

### ✅ 测试 3：导出所有能力（基础 + 领域）

```
✅ 所有能力导出成功
   文件名: all-capabilities.json
   基础能力数: 21
   领域能力数: 22
   总能力数: 43
   导出大小: 12802 bytes
   校验和: 796fa112
```

### ✅ 测试 4：导出 Agent B 的基础能力

```
✅ Agent B 基础能力导出成功
   文件名: base-capabilities-B.json
   总能力数: 5
   技能列表:
     - 编程开发 (85%)
     - 调试能力 (80%)
     - 测试能力 (75%)
     - 版本控制 (80%)
     - 文档编写 (70%)
```

### ✅ 测试 5：导出 Agent B 的电商领域能力

```
✅ Agent B 电商领域能力导出成功
   文件名: domain-capabilities-B-电商.json
   总能力数: 2
   技能列表:
     - 电商技术栈 (¥8,000)
     - 电商安全标准 (¥10,000)
```

---

## 📝 导出最佳实践

### 1. 选择合适的导出范围

- **仅导出基础能力**: 用于快速复制平台核心能力
- **仅导出领域能力**: 用于分发行业特定能力
- **导出所有能力**: 用于完整备份和迁移

### 2. 选择合适的格式

| 格式 | 优点 | 缺点 | 推荐场景 |
|------|------|------|---------|
| JSON | 通用性强，易于解析 | 文件较大 | 通用场景 |
| YAML | 可读性好，易于编辑 | 需要额外库 | 配置文件 |
| TOML | 配置友好 | 社区支持少 | 特定配置 |

### 3. 验证导出数据

```bash
# 导出后验证校验和
checksum=$(curl -s "http://localhost:5000/api/admin/capabilities/export/base" | jq -r '.data.summary.checksum')
echo "导出校验和: $checksum"

# 保存到文件并验证
curl -s "http://localhost:5000/api/admin/capabilities/export/base" | jq -r '.data.output' > base-capabilities.json
```

### 4. 批量导出脚本

```bash
#!/bin/bash

# 创建导出目录
mkdir -p exports

# 导出基础能力
curl -s "http://localhost:5000/api/admin/capabilities/export/base" | jq -r '.data.output' > exports/base-capabilities.json

# 导出领域能力
curl -s "http://localhost:5000/api/admin/capabilities/export/domain" | jq -r '.data.output' > exports/domain-capabilities.json

# 导出所有能力
curl -s "http://localhost:5000/api/admin/capabilities/export/all" | jq -r '.data.output' > exports/all-capabilities.json

# 导出各 Agent 的基础能力
for agent in A B C D; do
  curl -s "http://localhost:5000/api/admin/capabilities/export/base?agentId=$agent" | jq -r '.data.output' > "exports/base-capabilities-$agent.json"
done

# 导出各 Agent 的领域能力
for agent in A B C D; do
  curl -s "http://localhost:5000/api/admin/capabilities/export/domain?agentId=$agent" | jq -r '.data.output' > "exports/domain-capabilities-$agent.json"
done

echo "导出完成！"
ls -lh exports/
```

---

## 💡 导出数据用途

### 1. 备份和恢复

```bash
# 备份
curl "http://localhost:5000/api/admin/capabilities/export/all" | jq -r '.data.output' > backup.json

# 恢复（需要实现导入功能）
# TODO: 实现导入 API
```

### 2. 版本管理

```bash
# 按时间戳备份
timestamp=$(date +%Y%m%d_%H%M%S)
curl "http://localhost:5000/api/admin/capabilities/export/all" | jq -r '.data.output' > "backup_$timestamp.json"
```

### 3. 跨环境迁移

```bash
# 从开发环境导出
curl "http://dev:5000/api/admin/capabilities/export/all" | jq -r '.data.output' > dev-capabilities.json

# 导入到生产环境
curl -X POST -H "Content-Type: application/json" \
  -d @dev-capabilities.json \
  http://prod:5000/api/admin/capabilities/import
```

### 4. 能力分享

```bash
# 导出并分享给其他用户
curl "http://localhost:5000/api/admin/capabilities/export/domain?domain=电商" | jq -r '.data.output' > ecommerce-capabilities.json

# 用户可以导入这个能力包
```

---

## ✅ 总结

### 核心结论

✅ **基础能力可以导出**
- 21 项基础能力
- 支持批量导出和单个 Agent 导出
- 支持多种格式（JSON, YAML, TOML）

✅ **领域能力可以导出**
- 22 项领域能力（3 个领域）
- 支持按领域筛选
- 支持多种格式（JSON, YAML, TOML）

✅ **完整能力包可以导出**
- 43 项总能力（21 + 22）
- 包含元数据和校验和
- 支持版本管理

### 商业化价值

1. **能力备份**: 防止数据丢失
2. **跨环境迁移**: 开发 → 测试 → 生产
3. **能力分享**: 在能力市场发布和交易
4. **版本控制**: 跟踪能力变化

---

**一句话总结**：基础能力（21 项）和领域能力（22 项）都可以通过 API 或代码方式导出，支持多种格式，完整支持商业化部署和迁移需求。