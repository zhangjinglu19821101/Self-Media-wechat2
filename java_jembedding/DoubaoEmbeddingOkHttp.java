import okhttp3.*;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * 豆包 Embedding API 调用示例 - Java (使用 OkHttp)
 * 使用火山引擎 API Key 认证
 */
public class DoubaoEmbeddingOkHttp {

    private static final String API_KEY = "5fbbaa05-5e1c-4a0e-ab10-358adb0d8476";
    private static final String API_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/embeddings";
    private static final String MODEL = "doubao-embedding-vision-251215";

    private final OkHttpClient client;

    public DoubaoEmbeddingOkHttp() {
        this.client = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(60, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .build();
    }

    /**
     * 生成单个文本的向量
     */
    public float[] generateEmbedding(String text) throws IOException {
        // 构造请求体
        JSONObject requestBody = new JSONObject();
        requestBody.put("model", MODEL);
        requestBody.put("input", text);

        System.out.println("[DoubaoEmbedding] 发送请求...");
        System.out.println("  - Model: " + MODEL);
        System.out.println("  - Text length: " + text.length());

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
            String responseBody = response.body().string();

            System.out.println("[DoubaoEmbedding] 响应码: " + responseCode);

            if (!response.isSuccessful()) {
                System.err.println("[DoubaoEmbedding] API 错误: " + responseBody);
                throw new IOException("API 请求失败: " + responseCode + " - " + responseBody);
            }

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

            System.out.println("[DoubaoEmbedding] 向量生成成功，维度: " + embedding.length);
            return embedding;
        }
    }

    /**
     * 批量生成向量
     */
    public float[][] generateBatchEmbeddings(String[] texts) throws IOException {
        // 构造请求体
        JSONObject requestBody = new JSONObject();
        requestBody.put("model", MODEL);

        JSONArray inputs = new JSONArray();
        for (String text : texts) {
            inputs.put(text);
        }
        requestBody.put("input", inputs);

        System.out.println("[DoubaoEmbedding] 发送批量请求...");
        System.out.println("  - Model: " + MODEL);
        System.out.println("  - Batch size: " + texts.length);

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
            String responseBody = response.body().string();

            System.out.println("[DoubaoEmbedding] 响应码: " + responseCode);

            if (!response.isSuccessful()) {
                System.err.println("[DoubaoEmbedding] API 错误: " + responseBody);
                throw new IOException("API 请求失败: " + responseCode + " - " + responseBody);
            }

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

            System.out.println("[DoubaoEmbedding] 批量向量生成成功，数量: " + embeddings.length);
            return embeddings;
        }
    }

    /**
     * 主函数 - 测试
     */
    public static void main(String[] args) {
        try {
            DoubaoEmbeddingOkHttp service = new DoubaoEmbeddingOkHttp();

            // 测试单个文本
            String text = "这是一个测试文本，用于生成向量表示。";
            System.out.println("========== 测试单个文本 ==========");
            float[] embedding = service.generateEmbedding(text);

            System.out.println("\n向量前10个维度:");
            for (int i = 0; i < Math.min(10, embedding.length); i++) {
                System.out.printf("  dimension[%d] = %.6f%n", i, embedding[i]);
            }

            // 测试批量文本
            System.out.println("\n========== 测试批量文本 ==========");
            String[] texts = {
                "这是第一个文本",
                "这是第二个文本",
                "这是第三个文本"
            };
            float[][] embeddings = service.generateBatchEmbeddings(texts);

            System.out.println("\n批量生成结果:");
            for (int i = 0; i < embeddings.length; i++) {
                System.out.printf("  Text %d: %d 维度%n", i + 1, embeddings[i].length);
                System.out.printf("    前5个维度: ");
                for (int j = 0; j < Math.min(5, embeddings[i].length); j++) {
                    System.out.printf("%.6f ", embeddings[i][j]);
                }
                System.out.println();
            }

            System.out.println("\n✅ 所有测试通过！");

        } catch (Exception e) {
            System.err.println("❌ 测试失败: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
