# 🎉 火山引擎豆包 Embedding API - Java 代码包

## 📦 文件清单

| 文件 | 说明 |
|------|------|
| `DoubaoEmbeddingExample.java` | 标准版本（使用 HttpURLConnection）|
| `DoubaoEmbeddingOkHttp.java` | OkHttp 版本（推荐，更简洁）|
| `DoubaoEmbeddingService.java` | 完整版本（包含错误处理、重试、缓存）|
| `pom.xml` | Maven 配置文件 |
| `README.md` | 完整使用文档 |
| `TROUBLESHOOTING.md` | 故障排除指南 |
| `run.sh` | Linux/Mac 运行脚本 |
| `run.bat` | Windows 运行脚本 |

---

## 🚀 快速开始（3步完成）

### 步骤1：配置 API Key

在任一 Java 文件中，找到这行：

```java
private static final String API_KEY = "5fbbaa05-5e1c-4a0e-ab10-358adb0d8476";
```

如果需要更换 API Key，替换为您的实际值。

### 步骤2：运行脚本

**Linux/Mac:**
```bash
chmod +x run.sh
./run.sh
```

**Windows:**
```cmd
run.bat
```

### 步骤3：查看结果

成功运行后，您应该看到：

```
========================================
火山引擎豆包 Embedding API - 完整测试
========================================

【测试1】单个文本生成向量
[DoubaoEmbedding] 发送请求...
  - Model: doubao-embedding-vision-251215
  - Text length: 18
[Response] 状态码: 200
[Success] 向量生成成功，维度: 1024

向量信息:
  维度: 1024
  前5个值:
    [0] = 0.123456
    [1] = -0.234567
    ...

✅ 所有测试通过！
```

---

## 🎯 核心功能

### 1. 单个文本向量生成

```java
DoubaoEmbeddingService service = new DoubaoEmbeddingService();
float[] embedding = service.generateEmbedding("这是一段测试文本");
```

### 2. 批量文本向量生成

```java
String[] texts = {"文本1", "文本2", "文本3"};
float[][] embeddings = service.generateBatchEmbeddings(texts);
```

### 3. 自动缓存

```java
// 第一次请求：调用 API
float[] embedding1 = service.generateEmbedding("相同文本");

// 第二次请求：从缓存读取
float[] embedding2 = service.generateEmbedding("相同文本");

// embedding1 == embedding2 (快速返回，不调用 API)
```

### 4. 自动重试

```java
// API 失败时自动重试（最多3次）
// 使用指数退避策略（1s, 2s, 3s）
float[] embedding = service.generateEmbedding("测试文本");
```

---

## 🔧 认证方式

### 关键代码

```java
// API Key
private static final String API_KEY = "5fbbaa05-5e1c-4a0e-ab10-358adb0d8476";

// 请求头设置
Request request = new Request.Builder()
    .url(API_ENDPOINT)
    .addHeader("Content-Type", "application/json")
    .addHeader("Authorization", "Bearer " + API_KEY)  // ← 关键！
    .post(body)
    .build();
```

### 认证流程

```
1. 用户调用 API
   ↓
2. 设置 Authorization: Bearer {API_KEY}
   ↓
3. 发送到火山引擎服务器
   ↓
4. 服务器验证 API Key
   ↓
5. 返回向量数据
```

---

## 📊 API 接口说明

### 请求

```
POST https://ark.cn-beijing.volces.com/api/v3/embeddings
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "model": "doubao-embedding-vision-251215",
  "input": "要生成向量的文本"
}
```

### 响应

```json
{
  "id": "xxx",
  "object": "list",
  "created": 1234567890,
  "model": "doubao-embedding-vision-251215",
  "data": [
    {
      "index": 0,
      "object": "embedding",
      "embedding": [0.123, -0.456, 0.789, ...]
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "total_tokens": 10
  }
}
```

---

## ⚠️ 重要提示

### 1. 必须先开通模型

**步骤：**
1. 访问火山引擎控制台：https://console.volcengine.com/ark
2. 进入"模型管理"
3. 找到豆包 Embedding 模型
4. 点击"开通"

### 2. API Key 类型

**正确类型：**
- ✅ UUID 格式：`5fbbaa05-5e1c-4a0e-ab10-358adb0d8476`
- ✅ 使用方式：`Authorization: Bearer {API_KEY}`

**错误类型：**
- ❌ AK/SK 格式：`AKIDxxx.xxx`
- ❌ 这是火山引擎的其他服务认证方式，不是豆包 API 的认证方式

### 3. 速率限制

- 单个请求：约 10-100ms
- 批量请求：推荐一次不超过 10 个文本
- 速率限制：约 10-100 QPS（根据配置）

---

## 🛠️ 依赖说明

### 必需依赖

```xml
<dependency>
    <groupId>org.json</groupId>
    <artifactId>json</artifactId>
    <version>20231013</version>
</dependency>
```

### 可选依赖

```xml
<!-- OkHttp（推荐） -->
<dependency>
    <groupId>com.squareup.okhttp3</groupId>
    <artifactId>okhttp</artifactId>
    <version>4.12.0</version>
</dependency>

<!-- 日志 -->
<dependency>
    <groupId>org.slf4j</groupId>
    <artifactId>slf4j-api</artifactId>
    <version>2.0.9</version>
</dependency>
```

---

## 🎓 示例代码

### 示例1：基本使用

```java
import java.io.IOException;

public class BasicExample {
    public static void main(String[] args) throws IOException {
        DoubaoEmbeddingService service = new DoubaoEmbeddingService();

        String text = "这是一段测试文本";
        float[] embedding = service.generateEmbedding(text);

        System.out.println("向量维度: " + embedding.length);
        System.out.println("前5个值: " + Arrays.toString(Arrays.copyOf(embedding, 5)));
    }
}
```

### 示例2：批量处理

```java
import java.io.IOException;

public class BatchExample {
    public static void main(String[] args) throws IOException {
        DoubaoEmbeddingService service = new DoubaoEmbeddingService();

        String[] texts = {"文本1", "文本2", "文本3"};
        float[][] embeddings = service.generateBatchEmbeddings(texts);

        for (int i = 0; i < embeddings.length; i++) {
            System.out.println("文本 " + (i + 1) + ": " + embeddings[i].length + " 维");
        }
    }
}
```

### 示例3：Spring Boot 集成

```java
@Service
public class EmbeddingService {
    @Value("${doubao.api-key}")
    private String apiKey;

    public float[] generateEmbedding(String text) {
        // 实现逻辑
    }
}
```

---

## 📞 技术支持

- **官方文档**：https://www.volcengine.com/docs/
- **控制台**：https://console.volcengine.com/
- **故障排除**：查看 `TROUBLESHOOTING.md`

---

## ✅ 成功标志

运行成功后，您应该看到：

- [x] 响应码：200
- [x] 向量生成成功
- [x] 向量维度：1024
- [x] 无错误信息

---

## 🎉 总结

您现在拥有：

1. ✅ **3个版本的 Java 代码**（标准版、OkHttp版、完整版）
2. ✅ **自动化脚本**（Linux/Mac 和 Windows）
3. ✅ **完整文档**（使用指南、故障排除）
4. ✅ **正确的认证方式**（Bearer Token）
5. ✅ **最佳实践**（重试、缓存、错误处理）

**祝您集成成功！** 🎊

---

## 📝 最后一步

**确保模型已开通：**

1. 访问 https://console.volcengine.com/ark
2. 开通 `doubao-embedding-vision-251215` 模型
3. 运行代码测试

**开始使用吧！** 🚀
