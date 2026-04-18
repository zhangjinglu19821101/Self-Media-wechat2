/**
 * 火山引擎豆包 Embedding API - 完整示例
 * 包含错误处理、重试机制、缓存等最佳实践
 */
import okhttp3.*;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

/**
 * 豆包 Embedding 服务（带完整错误处理和优化）
 */
public class DoubaoEmbeddingService {

    private static final String API_KEY = "5fbbaa05-5e1c-4a0e-ab10-358adb0d8476";
    private static final String API_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/embeddings";
    private static final String MODEL = "doubao-embedding-vision-251215";

    // 缓存：避免重复生成相同文本的向量
    private final Map<String, float[]> cache = new ConcurrentHashMap<>();

    // OkHttp 客户端
    private final OkHttpClient client;

    // 重试次数
    private static final int MAX_RETRIES = 3;

    // 重试间隔（毫秒）
    private static final long RETRY_DELAY_MS = 1000;

    public DoubaoEmbeddingService() {
        this.client = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build();
    }

    /**
     * 生成向量（带缓存和重试）
     */
    public float[] generateEmbedding(String text) throws IOException {
        // 1. 检查缓存
        if (cache.containsKey(text)) {
            System.out.println("[Cache] 命中缓存");
            return cache.get(text);
        }

        // 2. 带重试的请求
        float[] embedding = generateEmbeddingWithRetry(text, MAX_RETRIES);

        // 3. 存入缓存
        cache.put(text, embedding);

        return embedding;
    }

    /**
     * 生成向量（带重试）
     */
    private float[] generateEmbeddingWithRetry(String text, int retries) throws IOException {
        IOException lastException = null;

        for (int i = 0; i < retries; i++) {
            try {
                System.out.printf("[Attempt %d/%d] 生成向量...%n", i + 1, retries);
                return doGenerateEmbedding(text);

            } catch (IOException e) {
                lastException = e;
                System.err.printf("[Attempt %d/%d] 失败: %s%n", i + 1, retries, e.getMessage());

                // 如果是最后一次重试，直接抛出异常
                if (i == retries - 1) {
                    break;
                }

                // 指数退避
                long delay = RETRY_DELAY_MS * (i + 1);
                System.out.printf("[Attempt %d/%d] 等待 %dms 后重试...%n", i + 1, retries, delay);

                try {
                    Thread.sleep(delay);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new IOException("重试被中断", ie);
                }
            }
        }

        // 所有重试都失败
        throw new IOException(String.format("重试 %d 次后仍然失败", retries), lastException);
    }

    /**
     * 生成向量（实际请求）
     */
    private float[] doGenerateEmbedding(String text) throws IOException {
        // 构造请求体
        JSONObject requestBody = new JSONObject();
        requestBody.put("model", MODEL);
        requestBody.put("input", text);

        // 创建请求
        RequestBody body = RequestBody.create(
                requestBody.toString(),
                MediaType.parse("application/json; charset=utf-8")
        );

        Request request = new Request.Builder()
                .url(API_ENDPOINT)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer " + API_KEY)
                .post(body)
                .build();

        // 发送请求
        try (Response response = client.newCall(request).execute()) {
            int responseCode = response.code();
            String responseBody = response.body() != null ? response.body().string() : "";

            // 处理响应
            handleResponse(responseCode, responseBody);

            // 解析响应
            JSONObject jsonResponse = new JSONObject(responseBody);
            JSONArray dataArray = jsonResponse.optJSONArray("data");

            if (dataArray == null || dataArray.length() == 0) {
                throw new IOException("API 返回空数据");
            }

            JSONObject firstItem = dataArray.getJSONObject(0);
            JSONArray embeddingArray = firstItem.getJSONArray("embedding");

            // 转换为 float[]
            float[] embedding = new float[embeddingArray.length()];
            for (int i = 0; i < embeddingArray.length(); i++) {
                embedding[i] = (float) embeddingArray.getDouble(i);
            }

            System.out.println("[Success] 向量生成成功，维度: " + embedding.length);
            return embedding;
        }
    }

    /**
     * 处理响应（错误检查）
     */
    private void handleResponse(int responseCode, String responseBody) throws IOException {
        System.out.println("[Response] 状态码: " + responseCode);

        if (responseCode >= 200 && responseCode < 300) {
            // 成功
            return;
        }

        // 错误处理
        String errorMessage = String.format("API 请求失败: %d", responseCode);

        if (responseCode == 401) {
            errorMessage = "认证失败：API Key 不正确或已过期";
            System.err.println("[Error] " + errorMessage);
            System.err.println("[Error] 请检查 API Key 是否正确配置");

        } else if (responseCode == 404) {
            errorMessage = "模型未开通或不存在";
            System.err.println("[Error] " + errorMessage);
            System.err.println("[Error] 请在火山引擎控制台开通模型: https://console.volcengine.com/ark");

        } else if (responseCode == 429) {
            errorMessage = "请求过多：超出速率限制";
            System.err.println("[Error] " + errorMessage);
            System.err.println("[Error] 请添加请求间隔或联系火山引擎提升额度");

        } else if (responseCode >= 500) {
            errorMessage = "服务器错误：" + responseCode;
            System.err.println("[Error] " + errorMessage);
            System.err.println("[Error] 请稍后重试或联系技术支持");

        } else {
            errorMessage = "未知错误：" + responseCode;
            System.err.println("[Error] " + errorMessage);
        }

        System.err.println("[Error] 响应内容: " + responseBody);
        throw new IOException(errorMessage);
    }

    /**
     * 批量生成向量
     */
    public float[][] generateBatchEmbeddings(String[] texts) throws IOException {
        System.out.println("[Batch] 开始批量生成向量，数量: " + texts.length);

        // 构造请求体
        JSONObject requestBody = new JSONObject();
        requestBody.put("model", MODEL);

        JSONArray inputs = new JSONArray();
        for (String text : texts) {
            inputs.put(text);
        }
        requestBody.put("input", inputs);

        // 创建请求
        RequestBody body = RequestBody.create(
                requestBody.toString(),
                MediaType.parse("application/json; charset=utf-8")
        );

        Request request = new Request.Builder()
                .url(API_ENDPOINT)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer " + API_KEY)
                .post(body)
                .build();

        // 发送请求
        try (Response response = client.newCall(request).execute()) {
            int responseCode = response.code();
            String responseBody = response.body() != null ? response.body().string() : "";

            handleResponse(responseCode, responseBody);

            // 解析响应
            JSONObject jsonResponse = new JSONObject(responseBody);
            JSONArray dataArray = jsonResponse.optJSONArray("data");

            if (dataArray == null || dataArray.length() == 0) {
                throw new IOException("API 返回空数据");
            }

            // 按照 index 排序
            java.util.List<JSONObject> sortedItems = new java.util.ArrayList<>();
            for (int i = 0; i < dataArray.length(); i++) {
                sortedItems.add(dataArray.getJSONObject(i));
            }
            sortedItems.sort((a, b) -> a.getInt("index") - b.getInt("index"));

            // 转换为 float[][]
            float[][] embeddings = new float[sortedItems.size()][];
            for (int i = 0; i < sortedItems.size(); i++) {
                JSONArray embeddingArray = sortedItems.get(i).getJSONArray("embedding");
                embeddings[i] = new float[embeddingArray.length()];
                for (int j = 0; j < embeddingArray.length(); j++) {
                    embeddings[i][j] = (float) embeddingArray.getDouble(j);
                }
            }

            System.out.println("[Batch] 批量向量生成成功，数量: " + embeddings.length);
            return embeddings;
        }
    }

    /**
     * 清空缓存
     */
    public void clearCache() {
        cache.clear();
        System.out.println("[Cache] 缓存已清空");
    }

    /**
     * 获取缓存大小
     */
    public int getCacheSize() {
        return cache.size();
    }

    /**
     * 主函数 - 完整测试
     */
    public static void main(String[] args) {
        System.out.println("========================================");
        System.out.println("火山引擎豆包 Embedding API - 完整测试");
        System.out.println("========================================\n");

        try {
            DoubaoEmbeddingService service = new DoubaoEmbeddingService();

            // 测试1：单个文本
            System.out.println("【测试1】单个文本生成向量");
            System.out.println("----------------------------------------");
            String text1 = "这是一个测试文本，用于生成向量表示。";
            float[] embedding1 = service.generateEmbedding(text1);

            System.out.println("\n向量信息:");
            System.out.println("  维度: " + embedding1.length);
            System.out.println("  前5个值:");
            for (int i = 0; i < Math.min(5, embedding1.length); i++) {
                System.out.printf("    [%d] = %.6f%n", i, embedding1[i]);
            }

            // 测试2：缓存测试
            System.out.println("\n\n【测试2】缓存测试");
            System.out.println("----------------------------------------");
            System.out.println("再次请求相同文本，应该命中缓存...");
            float[] embedding2 = service.generateEmbedding(text1);

            System.out.println("\n缓存大小: " + service.getCacheSize());
            System.out.println("向量是否相同: " + java.util.Arrays.equals(embedding1, embedding2));

            // 测试3：批量文本
            System.out.println("\n\n【测试3】批量文本生成向量");
            System.out.println("----------------------------------------");
            String[] texts = {
                "这是第一个文本",
                "这是第二个文本",
                "这是第三个文本"
            };
            float[][] embeddings = service.generateBatchEmbeddings(texts);

            System.out.println("\n批量生成结果:");
            for (int i = 0; i < embeddings.length; i++) {
                System.out.printf("  文本 %d: %d 维度, 前3个值: [", i + 1, embeddings[i].length);
                for (int j = 0; j < Math.min(3, embeddings[i].length); j++) {
                    System.out.printf("%.4f%s", embeddings[i][j], j < 2 ? ", " : "");
                }
                System.out.println("]");
            }

            // 测试4：清空缓存
            System.out.println("\n\n【测试4】清空缓存");
            System.out.println("----------------------------------------");
            service.clearCache();
            System.out.println("缓存大小: " + service.getCacheSize());

            // 成功
            System.out.println("\n\n========================================");
            System.out.println("✅ 所有测试通过！");
            System.out.println("========================================");

        } catch (Exception e) {
            System.err.println("\n\n========================================");
            System.err.println("❌ 测试失败！");
            System.err.println("========================================");
            System.err.println("错误信息: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
