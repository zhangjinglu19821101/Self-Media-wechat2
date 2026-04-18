#!/bin/bash

# 快速配置风格学习脚本

BASE_DIR="./data/articles"

echo "======================================"
echo "风格学习文章配置工具"
echo "======================================"
echo ""

# 创建目录结构
echo "1. 创建目录结构..."
mkdir -p "$BASE_DIR/insurance-d/保险科普"
mkdir -p "$BASE_DIR/insurance-d/产品介绍"
mkdir -p "$BASE_DIR/insurance-d/理赔案例"
mkdir -p "$BASE_DIR/agent-d/AI技术"
mkdir -p "$BASE_DIR/agent-d/编程教程"
mkdir -p "$BASE_DIR/agent-d/技术博客"

echo "✅ 目录结构已创建"
echo ""

# 显示当前配置
echo "2. 当前配置："
echo ""
echo "insurance-d 文章路径："
echo "  - $BASE_DIR/insurance-d/保险科普/"
echo "  - $BASE_DIR/insurance-d/产品介绍/"
echo "  - $BASE_DIR/insurance-d/理赔案例/"
echo ""
echo "Agent D 文章路径："
echo "  - $BASE_DIR/agent-d/AI技术/"
echo "  - $BASE_DIR/agent-d/编程教程/"
echo "  - $BASE_DIR/agent-d/技术博客/"
echo ""

# 询问用户配置方式
echo "3. 选择配置方式："
echo "  1) 手动复制文件到对应目录"
echo "  2) 通过 API 上传文件"
echo "  3) 通过 URL 抓取文章"
echo "  4) 查看现有配置"
echo "  5) 生成示例文章"
echo ""
read -p "请选择 (1-5): " choice

case $choice in
  1)
    echo ""
    echo "请将文章文件复制到以下目录："
    echo ""
    echo "insurance-d 文章："
    echo "  $BASE_DIR/insurance-d/保险科普/  (用于保险科普文章)"
    echo "  $BASE_DIR/insurance-d/产品介绍/  (用于产品介绍文章)"
    echo "  $BASE_DIR/insurance-d/理赔案例/  (用于理赔案例文章)"
    echo ""
    echo "Agent D 文章："
    echo "  $BASE_DIR/agent-d/AI技术/        (用于 AI 技术文章)"
    echo "  $BASE_DIR/agent-d/编程教程/      (用于编程教程文章)"
    echo "  $BASE_DIR/agent-d/技术博客/      (用于技术博客文章)"
    echo ""
    echo "复制完成后，使用 API 学习："
    echo "  curl -X POST http://localhost:5000/api/style-analyzer/learn ..."
    ;;
  2)
    echo ""
    echo "使用 API 上传文件："
    echo ""
    echo "上传单个文件："
    echo 'curl -X POST http://localhost:5000/api/style-analyzer/upload-and-learn \\'
    echo '  -F "file=@your-article.txt" \\'
    echo '  -F "categoryName=保险科普" \\'
    echo '  -F "agent=insurance-d" \\'
    echo '  -F "saveFile=true"'
    echo ""
    echo "批量上传文件："
    echo 'curl -X POST http://localhost:5000/api/style-analyzer/upload-batch \\'
    echo '  -F "file1=@article1.txt" \\'
    echo '  -F "file2=@article2.txt" \\'
    echo '  -F "categoryName=保险科普" \\'
    echo '  -F "agent=insurance-d" \\'
    echo '  -F "saveFiles=true"'
    ;;
  3)
    echo ""
    echo "使用 URL 抓取文章："
    echo ""
    echo "curl -X POST http://localhost:5000/api/style-analyzer/fetch-and-learn \\"
    echo '  -H "Content-Type: application/json" \\'
    echo '  -d '"'"'{'
    echo '    "urls": ['
    echo '      "https://mp.weixin.qq.com/s/xxx",'
    echo '      "https://juejin.cn/post/xxx"'
    echo '    ],'
    echo '    "categoryName": "保险科普",'
    echo '    "agent": "insurance-d"'
    echo '  }'"'"
    ;;
  4)
    echo ""
    echo "获取当前配置："
    echo ""
    echo "curl http://localhost:5000/api/style-analyzer/config"
    echo ""
    echo "查看所有风格模板："
    echo "curl http://localhost:5000/api/style-analyzer/templates"
    ;;
  5)
    echo ""
    echo "生成示例文章..."
    
    # insurance-d 示例文章
    cat > "$BASE_DIR/insurance-d/保险科普/example1.txt" << 'EOF'
大家好！今天我们来聊聊重疾险那些事儿。

很多人觉得重疾险复杂，其实只要掌握几个要点，就能轻松选到适合自己的产品。首先，要明确保障范围，包括哪些重大疾病；其次，要了解保额选择，一般建议至少50万；最后，要关注等待期和免责条款。

记住，重疾险是转移大病风险的重要工具，宁可备而不用，不可用而不备。
EOF

    cat > "$BASE_DIR/insurance-d/保险科普/example2.txt" << 'EOF'
朋友们好！又到了科普时间。今天要讲的是百万医疗险的误区。

很多人觉得"有社保就够了"，其实这是不对的。社保只能报销一部分费用，百万医疗险可以报销更多，而且覆盖进口药、特效药。

还有人认为"身体好不用买"，但医疗险要求健康告知，身体好时买更容易通过核保。所以，百万医疗险是每个成年人必备的保障。
EOF

    # Agent D 示例文章
    cat > "$BASE_DIR/agent-d/AI技术/example1.txt" << 'EOF'
ChatGPT 原理解析

ChatGPT 是基于 GPT-3.5 架构的大语言模型，通过强化学习从人类反馈（RLHF）进行训练。

核心架构包括：
1. Transformer 解码器
2. 位置编码
3. 多头注意力机制

```python
import torch
import torch.nn as nn

class TransformerDecoder(nn.Module):
    def __init__(self, vocab_size, d_model=768):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.decoder = nn.TransformerDecoder(
            nn.TransformerDecoderLayer(d_model),
            num_layers=12
        )
```

ChatGPT 通过 RLHF 技术实现了与人类的自然交互，是当前最先进的对话系统之一。
EOF

    cat > "$BASE_DIR/agent-d/技术博客/example2.txt" << 'EOF'
深入理解 React Server Components

React 18 引入了 Server Components（服务器组件），这是一个重大的架构改进。

什么是 Server Components？
- 在服务器端渲染
- 直接访问数据库和 API
- 不发送 JavaScript 到客户端

基本用法：
```tsx
// app/posts/page.tsx
async function PostsList() {
  const posts = await db.posts.findMany();
  return (
    <div>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
    </div>
  );
}
```

Server Components 是 React 的核心特性，合理使用可以显著提升应用性能。
EOF

    echo "✅ 示例文章已生成"
    echo ""
    echo "insurance-d 示例文章："
    echo "  - $BASE_DIR/insurance-d/保险科普/example1.txt"
    echo "  - $BASE_DIR/insurance-d/保险科普/example2.txt"
    echo ""
    echo "Agent D 示例文章："
    echo "  - $BASE_DIR/agent-d/AI技术/example1.txt"
    echo "  - $BASE_DIR/agent-d/技术博客/example2.txt"
    echo ""
    echo "现在可以使用 API 学习这些文章："
    echo ""
    echo "学习 insurance-d 文章："
    echo 'curl -X POST http://localhost:5000/api/style-analyzer/learn \'
    echo '  -H "Content-Type: application/json" \'
    echo '  -d '"'"'{"articles": ["'$(cat "$BASE_DIR/insurance-d/保险科普/example1.txt")'"], "categoryName": "保险科普"}'"'"''
    ;;
  *)
    echo "无效选择"
    exit 1
    ;;
esac

echo ""
echo "======================================"
echo "配置完成！"
echo "======================================"
echo ""
echo "更多信息请查看："
echo "  - STYLE_LEARNING_CONFIG.md"
echo "  - STYLE_MIMICRY_GUIDE.md"
echo "  - AGENT_D_STYLE_GUIDE.md"
echo ""
