# 火山引擎豆包 Embedding API - 快速故障排除

## 🚨 常见错误和解决方案

### 1. 401 Unauthorized（认证失败）

#### 错误信息
```
API 请求失败: 401
{"error":{"code":"AuthenticationError","message":"the API key or AK/SK in the request is missing or invalid"}}
```

#### 可能原因
- API Key 不正确
- API Key 过期
- API Key 格式错误

#### 解决方案
1. **确认 API Key 格式**
   - 正确格式：UUID（例如：`5fbbaa05-5e1c-4a0e-ab10-358adb0d8476`）
   - 错误格式：`AKIDxxx.xxx`（这是 AK/SK，不是 API Key）

2. **检查代码中的配置**
   ```java
   // ✓ 正确
   private static final String API_KEY = "5fbbaa05-5e1c-4a0e-ab10-358adb0d8476";

   // ✗ 错误（多余的空格）
   private static final String API_KEY = " 5fbbaa05-5e1c-4a0e-ab10-358adb0d8476 ";

   // ✗ 错误（多余的引号）
   private static final String API_KEY = "\"5fbbaa05-5e1c-4a0e-ab10-358adb0d8476\"";
   ```

3. **重新获取 API Key**
   - 访问火山引擎控制台
   - 生成新的 API Key
   - 更新代码中的配置

---

### 2. 404 Not Found（模型未开通）

#### 错误信息
```
API 请求失败: 404
{"error":{"code":"ModelNotOpen","message":"Your account has not activated the model doubao-embedding-vision-251215. Please activate the model service in the Ark Console."}}
```

#### 可能原因
- 模型未在火山引擎控制台开通
- 模型名称不正确

#### 解决方案
1. **开通模型**
   - 访问：https://console.volcengine.com/ark
   - 进入"模型管理"
   - 找到豆包 Embedding 模型
   - 点击"开通"

2. **确认模型名称**
   - 登录控制台后，查看已开通的模型列表
   - 确认正确的模型名称
   - 更新代码中的 `MODEL` 常量

3. **尝试其他模型**
   ```java
   // 尝试使用其他可能的模型名称
   private static final String MODEL = "doubao-embedding-text";
   private static final String MODEL = "doubao-embedding";
   ```

---

### 3. 429 Too Many Requests（请求过多）

#### 错误信息
```
API 请求失败: 429
{"error":{"code":"RateLimitExceeded","message":"Rate limit exceeded"}}
```

#### 可能原因
- 超出 API 速率限制
- 并发请求过多

#### 解决方案
1. **添加请求延迟**
   ```java
   public float[] generateEmbedding(String text) throws IOException {
       // 添加延迟
       Thread.sleep(100); // 100ms 延迟

       return doGenerateEmbedding(text);
   }
   ```

2. **使用批量接口**
   ```java
   // 批量生成，减少请求次数
   String[] texts = {"文本1", "文本2", "文本3"};
   float[][] embeddings = generateBatchEmbeddings(texts);
   ```

3. **联系火山引擎提升额度**
   - 访问控制台
   - 查看当前额度
   - 申请提升额度

---

### 4. 500 Internal Server Error（服务器错误）

#### 错误信息
```
API 请求失败: 500
{"error":{"code":"InternalServerError","message":"Internal server error"}}
```

#### 可能原因
- 服务器临时故障
- 请求格式不正确
- 模型正在维护

#### 解决方案
1. **稍后重试**
   ```java
   public float[] generateEmbeddingWithRetry(String text, int maxRetries) {
       for (int i = 0; i < maxRetries; i++) {
           try {
               return generateEmbedding(text);
           } catch (IOException e) {
               if (i == maxRetries - 1) throw e;
               Thread.sleep(1000 * (i + 1));
           }
       }
       throw new IOException("重试失败");
   }
   ```

2. **检查请求格式**
   ```json
   // ✓ 正确格式
   {
     "model": "doubao-embedding-vision-251215",
     "input": "要生成向量的文本"
   }

   // ✗ 错误格式（input 应该是字符串，不是对象）
   {
     "model": "doubao-embedding-vision-251215",
     "input": {"text": "要生成向量的文本"}
   }
   ```

3. **联系技术支持**
   - 提交工单
   - 提供错误日志
   - 等待技术支持响应

---

### 5. Connection Timeout（连接超时）

#### 错误信息
```
java.net.SocketTimeoutException: connect timed out
```

#### 可能原因
- 网络连接问题
- 防火墙阻止
- DNS 解析失败

#### 解决方案
1. **检查网络连接**
   ```bash
   # 测试连接
   ping ark.cn-beijing.volces.com

   # 测试 HTTP 连接
   curl -I https://ark.cn-beijing.volces.com
   ```

2. **增加超时时间**
   ```java
   OkHttpClient client = new OkHttpClient.Builder()
       .connectTimeout(60, TimeUnit.SECONDS)  // 增加连接超时
       .readTimeout(120, TimeUnit.SECONDS)    // 增加读取超时
       .build();
   ```

3. **检查防火墙**
   - 确保防火墙允许访问火山引擎域名
   - 检查代理设置

---

### 6. ClassNotFoundException（类未找到）

#### 错误信息
```
java.lang.ClassNotFoundException: org.json.JSONObject
```

#### 可能原因
- 依赖未正确导入
- classpath 配置错误

#### 解决方案
1. **检查依赖**
   ```bash
   # 确认 JAR 文件存在
   ls -la lib/json-20231013.jar
   ```

2. **确认 classpath**
   ```bash
   # ✓ 正确（Linux/Mac）
   java -cp ".:lib/json-20231013.jar" DoubaoEmbeddingExample

   # ✓ 正确（Windows）
   java -cp ".;lib\json-20231013.jar" DoubaoEmbeddingExample
   ```

3. **使用 Maven**
   ```bash
   mvn clean install
   mvn exec:java -Dexec.mainClass="DoubaoEmbeddingExample"
   ```

---

## 🔍 调试技巧

### 1. 启用详细日志

```java
// 使用 OkHttp 的日志拦截器
OkHttpClient client = new OkHttpClient.Builder()
    .addInterceptor(new HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BODY))
    .build();
```

### 2. 打印请求详情

```java
System.out.println("请求 URL: " + API_ENDPOINT);
System.out.println("请求头: Authorization: Bearer " + API_KEY);
System.out.println("请求体: " + requestBody.toString());
```

### 3. 检查响应内容

```java
String responseBody = response.body().string();
System.out.println("响应码: " + response.code());
System.out.println("响应内容: " + responseBody);
```

---

## 📞 获取帮助

如果以上方案都无法解决问题：

1. **查看官方文档**
   - 火山引擎文档：https://www.volcengine.com/docs/
   - 豆包 API 文档：https://www.volcengine.com/docs/82379

2. **提交工单**
   - 访问火山引擎控制台
   - 进入"工单系统"
   - 提交技术支持工单

3. **联系销售**
   - 如果需要更高额度或特殊支持
   - 联系火山引擎销售团队

---

## ✅ 检查清单

在运行代码前，请确认：

- [ ] API Key 已正确配置
- [ ] API Key 格式正确（UUID）
- [ ] 模型已在控制台开通
- [ ] Java 版本 >= 11
- [ ] 依赖已正确导入
- [ ] 网络连接正常
- [ ] 防火墙允许访问火山引擎域名
- [ ] 代码中的模型名称正确

---

**祝您顺利解决问题！**
