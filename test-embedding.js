// 测试豆包 Embedding API
import { DoubaoEmbeddingService } from '../src/lib/embedding/doubao-embedding';

async function testEmbedding() {
  try {
    const service = new DoubaoEmbeddingService();

    console.log('========== 测试单个文本向量生成 ==========');
    const text = '这是一个测试文本';
    const embedding = await service.generateEmbedding(text);

    console.log('✅ 向量生成成功！');
    console.log('维度:', embedding.length);
    console.log('前5个值:', embedding.slice(0, 5));

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testEmbedding();
