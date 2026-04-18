# 火山引擎豆包 Embedding API - Java 调用示例

## 📋 前提条件

1. **火山引擎账号** - 已注册火山引擎账号
2. **API Key** - 已获取 API Key（UUID 格式）
3. **模型开通** - 已在火山引擎控制台开通豆包 Embedding 模型
4. **Java 11+** - 已安装 Java 11 或更高版本
5. **Maven** - 已安装 Maven（用于依赖管理）

## 🚀 快速开始

### 1. 配置 API Key

在代码中替换 `API_KEY` 为您的实际值：

```java
private static final String API_KEY = "5fbbaa05-5e1c-4a0e-ab10-358adb0d8476";
```

### 2. 模型名称

确保在火山引擎控制台已开通以下模型之一：

- `doubao-embedding-vision-251215`（豆包 Embedding）
- 或其他 Embedding 模型

### 3. 运行代码

#### 方式1：使用标准 HttpURLConnection

```bash
# 编译
javac -cp ".:lib/json-20231013.jar" DoubaoEmbeddingExample.java

# 运行
java -cp ".:lib/json-20231013.jar" DoubaoEmbeddingExample
```

#### 方式2：使用 Maven

```bash
# 安装依赖
mvn clean install

# 运行
mvn exec:java -Dexec.mainClass="DoubaoEmbeddingExample"
```

#### 方式3：使用 OkHttp（推荐）

```bash
# 编译
javac -cp ".:lib/json-20231013.jar:lib/okhttp-4.12.0.jar:lib/okio-3.6.0.jar" DoubaoEmbeddingOkHttp.java

# 运行
java -cp ".:lib/json-20231013.jar:lib/okhttp-4.12.0.jar:lib/okio-3.6.0.jar" DoubaoEmbeddingOkHttp
```

## 📦 依赖管理

### Maven

在 `pom.xml` 中添加：

```xml
<dependencies>
    <!-- JSON 处理 -->
    <dependency>
        <groupId>org.json</groupId>
        <artifactId>json</artifactId>
        <version>20231013</version>
    </dependency>

    <!-- OkHttp（可选） -->
    <dependency>
        <groupId>com.squareup.okhttp3</groupId>
        <artifactId>okhttp</artifactId>
        <version>4.12.0</version>
    </dependency>
</dependencies>
```

### Gradle

```gradle
dependencies {
    implementation 'org.json:json:20231013'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
}
```

## 🔧 核心代码说明

### 认证方式

使用 **Bearer Token** 认证：

```java
String apiKey = "5fbbaa05-5e1c-4a0e-ab10-358adb0d8476";
connection.setRequestProperty("Authorization", "Bearer " + apiKey);
```

### 请求格式

```json
{
  "model": "doubao-embedding-vision-251215",
  "input": "要生成向量的文本"
}
```

### 响应格式

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

## ❓ 常见问题

### 1. 401 认证失败

**原因：** API Key 不正确

**解决方案：**
- 检查 API Key 是否正确复制
- 确认 API Key 没有多余的空格或换行符
- 重新从火山引擎控制台获取 API Key

### 2. 404 模型未开通

**原因：** 模型未在控制台开通

**错误信息：**
```
Your account has not activated the model doubao-embedding-vision-251215.
Please activate the model service in the Ark Console.
```

**解决方案：**
1. 访问火山引擎控制台：https://console.volcengine.com/ark
2. 进入"模型管理"
3. 找到豆包 Embedding 模型
4. 点击"开通"

### 3. 429 请求过多

**原因：** 超出 API 速率限制

**解决方案：**
- 添加请求间隔
- 使用批量接口减少请求次数
- 联系火山引擎提升额度

### 4. 500 服务器错误

**原因：** 服务器内部错误

**解决方案：**
- 稍后重试
- 检查请求格式是否正确
- 联系火山引擎技术支持

## 📝 Spring Boot 集成示例

### 配置类

```java
@Configuration
public class DoubaoEmbeddingConfig {

    @Value("${doubao.api-key}")
    private String apiKey;

    @Value("${doubao.endpoint}")
    private String endpoint;

    @Value("${doubao.model}")
    private String model;

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }

    @Bean
    public DoubaoEmbeddingService doubaoEmbeddingService() {
        return new DoubaoEmbeddingService(apiKey, endpoint, model);
    }
}
```

### 服务类

```java
@Service
public class DoubaoEmbeddingService {

    private final String apiKey;
    private final String endpoint;
    private final String model;
    private final RestTemplate restTemplate;

    public DoubaoEmbeddingService(String apiKey, String endpoint, String model,
                                   RestTemplate restTemplate) {
        this.apiKey = apiKey;
        this.endpoint = endpoint;
        this.model = model;
        this.restTemplate = restTemplate;
    }

    public float[] generateEmbedding(String text) {
        // 实现逻辑
    }
}
```

### 配置文件

```yaml
doubao:
  api-key: 5fbbaa05-5e1c-4a0e-ab10-358adb0d8476
  endpoint: https://ark.cn-beijing.volces.com/api/v3/embeddings
  model: doubao-embedding-vision-251215
```

## 🎯 最佳实践

### 1. 重试机制

```java
public float[] generateEmbeddingWithRetry(String text, int maxRetries) {
    for (int i = 0; i < maxRetries; i++) {
        try {
            return generateEmbedding(text);
        } catch (IOException e) {
            if (i == maxRetries - 1) {
                throw new RuntimeException("重试失败", e);
            }
            Thread.sleep(1000 * (i + 1)); // 指数退避
        }
    }
    throw new RuntimeException("重试失败");
}
```

### 2. 批量请求

```java
public float[][] generateBatchEmbeddings(String[] texts) {
    // 使用批量接口，减少请求次数
}
```

### 3. 缓存机制

```java
private final Map<String, float[]> cache = new ConcurrentHashMap<>();

public float[] generateEmbedding(String text) {
    return cache.computeIfAbsent(text, this::doGenerateEmbedding);
}
```

### 4. 限流控制

```java
private final RateLimiter rateLimiter = RateLimiter.create(10.0); // 每秒10个请求

public float[] generateEmbedding(String text) {
    rateLimiter.acquire(); // 获取许可
    return doGenerateEmbedding(text);
}
```

## 📞 技术支持

- 火山引擎文档：https://www.volcengine.com/docs/
- 火山引擎控制台：https://console.volcengine.com/
- 火山引擎支持：https://www.volcengine.com/support/

## ✅ 验证清单

- [ ] API Key 已正确配置
- [ ] 模型已在控制台开通
- [ ] Java 版本 >= 11
- [ ] 依赖已正确安装
- [ ] 网络连接正常
- [ ] 防火墙允许访问火山引擎域名

## 🎉 成功标志

运行成功后，您应该看到：

```
[DoubaoEmbedding] 发送请求...
  - Model: doubao-embedding-vision-251215
  - Text length: 18
[DoubaoEmbedding] 响应码: 200
[DoubaoEmbedding] 向量生成成功，维度: 1024

向量前10个维度:
  dimension[0] = 0.123456
  dimension[1] = -0.234567
  ...

✅ 所有测试通过！
```

---

**祝您集成成功！如有问题，请查看常见问题或联系技术支持。**
