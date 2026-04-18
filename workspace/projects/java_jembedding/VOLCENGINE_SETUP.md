# 火山引擎豆包 Embedding API - 配置指南

## ⚠️ 当前问题

从火山引擎 API 返回的错误来看，虽然您已经开通了豆包 Embedding 模型，但需要额外的配置才能使用。

## 🔧 解决方案

### 步骤1：创建推理接入点（Endpoint）

**注意：** 火山引擎的 Embedding 模型需要创建专门的推理接入点（endpoint），而不能直接使用模型名称。

**操作步骤：**

1. **访问火山引擎控制台**
   - URL: https://console.volcengine.com/ark

2. **进入"模型推理"**
   - 点击左侧菜单"模型推理"
   - 找到"推理接入点"或"Endpoints"

3. **创建推理接入点**
   - 点击"创建推理接入点"
   - 选择模型：`doubao-embedding-vision-250615` 或其他 embedding 模型
   - 设置名称：例如 `my-embedding-endpoint`
   - 点击"创建"

4. **获取 Endpoint ID**
   - 创建成功后，会显示 endpoint ID
   - 格式通常为：`ep-XXXXXXXXXXXXX`

### 步骤2：使用 Endpoint ID 调用 API

**API 调用方式：**

```bash
curl -X POST https://ark.cn-beijing.volces.com/api/v3/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 5fbbaa05-5e1c-4a0e-ab10-358adb0d8476" \
  -d '{
    "model": "ep-XXXXXXXXXXXXX",
    "input": "测试文本"
  }'
```

**关键点：**
- `model` 参数应该使用 **endpoint ID**，而不是模型名称
- Endpoint ID 格式：`ep-` 开头

### 步骤3：更新配置文件

**Java 项目配置：**

```java
// DoubaoEmbeddingService.java
private static final String MODEL = "ep-XXXXXXXXXXXXX"; // 使用 endpoint ID
```

**Node.js 项目配置：**

```env
# .env.local
VOLCENGINE_EMBEDDING_MODEL=ep-XXXXXXXXXXXXX
```

---

## 📊 当前可用的 Embedding 模型

| 模型 ID | 模型名称 | 状态 | 说明 |
|---------|---------|------|------|
| `doubao-embedding-text-240515` | doubao-embedding | Retiring | 即将退役 |
| `doubao-embedding-text-240715` | doubao-embedding | Retiring | 即将退役 |
| `doubao-embedding-large-text-240915` | doubao-embedding-large | Retiring | 即将退役 |
| `doubao-embedding-vision-241215` | doubao-embedding-vision | Retiring | 即将退役 |
| `doubao-embedding-vision-250328` | doubao-embedding-vision | Retiring | 即将退役 |
| `doubao-embedding-large-text-250515` | doubao-embedding-large | Retiring | 即将退役 |
| `doubao-embedding-vision-250615` | doubao-embedding-vision | ? | 推荐使用 |

**注意：** 所有模型的 status 都是 "Retiring"，这意味着您需要创建推理接入点来使用它们。

---

## 🎯 推荐模型

根据模型列表，推荐使用：

**模型：** `doubao-embedding-vision-250615`

**原因：**
- 版本最新（250615）
- 支持文本和图像 Embedding
- 向量维度：1024

---

## 📝 完整流程

### 1. 创建推理接入点

**操作：**
1. 访问 https://console.volcengine.com/ark
2. 进入"模型推理" -> "推理接入点"
3. 点击"创建推理接入点"
4. 选择模型：`doubao-embedding-vision-250615`
5. 设置名称：`my-embedding-endpoint`
6. 点击"创建"

### 2. 复制 Endpoint ID

**创建成功后，会显示：**
```
Endpoint ID: ep-1234567890abcdef
```

**复制这个 ID。**

### 3. 更新代码配置

**Java 项目：**
```java
// DoubaoEmbeddingService.java
private static final String MODEL = "ep-1234567890abcdef";
```

**Node.js 项目：**
```env
# .env.local
VOLCENGINE_EMBEDDING_MODEL=ep-1234567890abcdef
```

### 4. 重启服务并测试

**Node.js:**
```bash
kill -9 $(ss -lptn 'sport = :5000' | grep -o 'pid=[0-9]*' | cut -d= -f2)
nohup pnpm dev > /app/work/logs/bypass/dev.log 2>&1 &
curl -X POST http://localhost:5000/api/wechat-rules/import
```

**Java:**
```bash
cd /workspace/projects/java_jembedding
./run.sh
```

---

## ❓ 常见问题

### Q1: 为什么不能直接使用模型名称？

**A:** 火山引擎要求为 Embedding 模型创建专门的推理接入点（endpoint），以确保资源分配和访问控制。

### Q2: Endpoint ID 的格式是什么？

**A:** 格式为 `ep-XXXXXXXXXXXXX`，例如 `ep-1234567890abcdef`。

### Q3: 如何查看已创建的 Endpoint？

**A:** 访问火山引擎控制台 -> 模型推理 -> 推理接入点，可以看到所有已创建的 endpoint。

### Q4: 可以创建多个 Endpoint 吗？

**A:** 可以，但需要注意每个 endpoint 都会分配资源，可能产生费用。

---

## ✅ 检查清单

创建推理接入点后，请确认：

- [ ] 已在控制台创建推理接入点
- [ ] 已复制 Endpoint ID
- [ ] 已更新代码中的 MODEL 配置
- [ ] 已重启服务
- [ ] 已测试 API 调用

---

## 📞 技术支持

- 火山引擎文档：https://www.volcengine.com/docs/82379/
- 火山引擎控制台：https://console.volcengine.com/ark
- 技术支持：提交工单

---

**请按照上述步骤创建推理接入点，然后将 Endpoint ID 告诉我，我帮您更新配置！**
