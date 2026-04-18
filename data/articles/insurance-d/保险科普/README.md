# 文章上传和学习指南

## 触发风格学习

### 方法 1: 使用学习脚本（推荐）

```bash
# 在文章目录下执行
./learn-style.sh
```

这将自动读取目录下所有文章并学习其风格。

### 方法 2: 直接使用 curl 命令

```bash
# 读取文章内容
ARTICLE1=$(cat example1.txt)
ARTICLE2=$(cat example2.txt)

# 触发学习
curl -X POST http://localhost:5000/api/style-analyzer/learn \
  -H "Content-Type: application/json" \
  -d "{
    \"articles\": [
      \"$ARTICLE1\",
      \"$ARTICLE2\"
    ],
    \"categoryName\": \"保险科普\"
  }"
```

### 方法 3: 通过 Agent 对话触发

向 insurance-d 发送消息：

```
请学习以下文章的风格：
---
[粘贴文章内容]
---

现在请按照这个风格写一篇新文章。
```

### 方法 4: 使用 API 学习

```bash
# 将文章内容放在 JSON 数组中
curl -X POST http://localhost:5000/api/style-analyzer/learn \
  -H "Content-Type: application/json" \
  -d '{
    "articles": [
      "文章1内容...",
      "文章2内容...",
      "文章3内容..."
    ],
    "categoryName": "保险科普"
  }'
```

## 学习响应说明

成功的响应包含以下信息：

```json
{
  "success": true,
  "data": {
    "template": {
      "id": "style_保险科普_1234567890_abc123",
      "name": "保险科普风格模板",
      "features": {
        "tone": "亲切",
        "complexity": "simple",
        "vocabularyLevel": "basic",
        "confidence": 0.85
      }
    },
    "summary": "基于 3 篇文章分析生成的保险科普风格模板...",
    "recommendations": [...]
  }
}
```

**关键字段**：
- `template.id`: 风格模板 ID，用于后续生成文章
- `features.confidence`: 置信度（0-1），越高越好
- `recommendations`: 优化建议

## 使用风格模板生成文章

学习完成后，可以使用风格模板生成新文章：

```bash
# 获取风格模板 ID
TEMPLATE_ID="style_保险科普_1234567890_abc123"

# 生成新文章
curl -X POST http://localhost:5000/api/style-analyzer/generate \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\",
    \"topic\": \"如何选择重疾险\",
    \"additionalInstructions\": \"增加实际案例\"
  }"
```

## 完整工作流程

### 1. 上传文章 → 2. 触发学习 → 3. 生成新文章 → 4. 上传到草稿箱

```bash
# 步骤 1: 上传文章到草稿箱（可选）
./upload-article.sh example1.txt
./upload-article.sh example2.txt

# 步骤 2: 触发风格学习
./learn-style.sh

# 步骤 3: 使用风格生成新文章
TEMPLATE_ID="从学习响应中获取的ID"
curl -X POST http://localhost:5000/api/style-analyzer/generate \
  -H "Content-Type: application/json" \
  -d "{
    \"templateId\": \"$TEMPLATE_ID\",
    \"topic\": \"少儿保险配置指南\",
    \"additionalInstructions\": \"增加实际案例，通俗易懂\"
  }" > new_article.json

# 步骤 4: 上传新文章到草稿箱
# 从 new_article.json 中提取内容并上传
```

---

## 快速上传

### 方法 1: 使用上传脚本（推荐）

```bash
# 进入文章目录
cd /workspace/projects/data/articles/insurance-d/保险科普/

# 上传单篇文章
./upload-article.sh example1.txt

# 上传并指定标题和作者
./upload-article.sh example1.txt "重疾险的常见误区" "保险科普"
```

### 方法 2: 直接使用 curl 命令

```bash
# 读取文件并上传
CONTENT=$(cat example1.txt)

curl -X POST http://localhost:5000/api/wechat/draft/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"agent\": \"insurance-d\",
    \"title\": \"文章标题\",
    \"content\": \"$CONTENT\",
    \"author\": \"保险科普\",
    \"digest\": \"文章摘要\"
  }"
```

### 方法 3: 一行命令上传

```bash
curl -X POST http://localhost:5000/api/wechat/draft/upload \
  -H "Content-Type: application/json" \
  -d "{
    \"agent\": \"insurance-d\",
    \"title\": \"$(basename example1.txt .txt)\",
    \"content\": \"$(cat example1.txt | tr '\n' ' ')\",
    \"author\": \"保险科普\",
    \"digest\": \"$(cat example1.txt | head -c 100)\"
  }"
```

## 批量上传

### 上传所有文章

```bash
# 进入文章目录
cd /workspace/projects/data/articles/insurance-d/保险科普/

# 批量上传
for file in *.txt; do
    echo "上传: $file"
    ./upload-article.sh "$file"
    echo ""
done
```

### 上传指定文章

```bash
cd /workspace/projects/data/articles/insurance-d/保险科普/

# 上传 example1 和 example2
./upload-article.sh example1.txt
./upload-article.sh example2.txt
```

## 查看已有文章

```bash
# 列出目录下所有文章
ls -1 *.txt

# 查看文章内容
cat example1.txt
```

## API 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| agent | Agent 类型 | insurance-d 或 agent-d |
| title | 文章标题（不超过 64 字） | 重疾险的常见误区 |
| content | 文章内容（支持 HTML） | <p>文章内容...</p> |
| author | 作者名称 | 保险科普 |
| digest | 文章摘要（不超过 120 字） | 选择重疾险的要点... |
| contentSourceUrl | 原文链接（可选） | https://example.com/article/1 |
| accountId | 指定公众号 ID（可选） | insurance-account |

## 完整示例

```bash
# 1. 查看文章列表
ls -1 *.txt

# 2. 查看文章内容
cat example1.txt

# 3. 上传文章
./upload-article.sh example1.txt "重疾险的常见误区" "保险科普"

# 4. 查看响应（包含草稿 ID）
# 返回示例: {"success":true,"data":{"mediaId":"MEDIA_ID_xxx",...}}

# 5. 登录微信公众号后台查看草稿
# https://mp.weixin.qq.com/
```

## 常见问题

### Q1: 上传失败，提示"未找到对应的公众号配置"

**A**: 需要先配置公众号信息，查看 [WECHAT_DRAFT_GUIDE.md](../../../../WECHAT_DRAFT_GUIDE.md)

### Q2: 如何上传带格式的文章？

**A**: 文章内容支持 HTML 格式，例如：

```bash
cat > article.html << 'EOF'
<h2>文章标题</h2>
<p>段落内容...</p>
<strong>重点内容</strong>
EOF

CONTENT=$(cat article.html)
curl -X POST http://localhost:5000/api/wechat/draft/upload \
  -H "Content-Type: application/json" \
  -d "{\"agent\":\"insurance-d\",\"title\":\"标题\",\"content\":\"$CONTENT\",\"author\":\"保险科普\"}"
```

### Q3: 如何查看草稿？

**A**: 登录微信公众号后台 → 首页 → 草稿箱

### Q4: 批量上传时出错怎么办？

**A**: 检查每个文件的内容格式，确保内容不为空。使用逐个上传的方式排查：

```bash
for file in *.txt; do
    echo "检查文件: $file"
    wc -l "$file"
done
```
