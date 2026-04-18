# 火山引擎豆包 Embedding API - Java 项目信息

## 📁 项目路径

```
/workspace/projects/java_jembedding/
```

## 📦 项目结构

```
java_jembedding/
├── DoubaoEmbeddingExample.java      # 标准版本（HttpURLConnection）
├── DoubaoEmbeddingOkHttp.java       # OkHttp 版本（推荐）
├── DoubaoEmbeddingService.java      # 完整版本（含错误处理、重试、缓存）
├── pom.xml                          # Maven 配置文件
├── README.md                        # 完整使用文档
├── START_HERE.md                    # 快速开始指南
├── TROUBLESHOOTING.md               # 故障排除指南
├── run.sh                           # Linux/Mac 运行脚本
├── run.bat                          # Windows 运行脚本
└── .gitignore                       # Git 忽略文件
```

## 🚀 快速开始

### 1. 查看快速开始指南

```bash
cd /workspace/projects/java_jembedding
cat START_HERE.md
```

### 2. 运行代码

**Linux/Mac:**
```bash
cd /workspace/projects/java_jembedding
./run.sh
```

**Windows:**
```cmd
cd C:\workspace\projects\java_jembedding
run.bat
```

### 3. 手动编译和运行

```bash
cd /workspace/projects/java_jembedding

# 编译
javac -cp ".:lib/json-20231013.jar:lib/okhttp-4.12.0.jar:lib/okio-3.6.0.jar" DoubaoEmbeddingService.java

# 运行
java -cp ".:lib/json-20231013.jar:lib/okhttp-4.12.0.jar:lib/okio-3.6.0.jar" DoubaoEmbeddingService
```

## 🔑 配置信息

### API Key
```java
private static final String API_KEY = "5fbbaa05-5e1c-4a0e-ab10-358adb0d8476";
```

### API Endpoint
```
https://ark.cn-beijing.volces.com/api/v3/embeddings
```

### 模型名称
```
doubao-embedding-vision-251215
```

## ⚠️ 前提条件

### 1. 必须先开通模型

访问火山引擎控制台：https://console.volcengine.com/ark
- 进入"模型管理"
- 找到豆包 Embedding 模型
- 点击"开通"

### 2. Java 环境

- Java 版本：>= 11
- Maven（可选，用于依赖管理）

### 3. 依赖

- org.json:json:20231013（必需）
- okhttp3:okhttp:4.12.0（推荐）
- okio:okio:3.6.0（推荐）

## 📚 文档

| 文档 | 说明 |
|------|------|
| **START_HERE.md** | 从这里开始！快速入门指南 |
| **README.md** | 完整使用文档和示例 |
| **TROUBLESHOOTING.md** | 故障排除指南 |

## ✅ 验证清单

运行代码前，请确认：

- [ ] 模型已在火山引擎控制台开通
- [ ] API Key 已正确配置
- [ ] Java 版本 >= 11
- [ ] 依赖已正确安装
- [ ] 网络连接正常

## 🎯 核心功能

1. **单个文本向量生成**
2. **批量文本向量生成**
3. **自动缓存**（避免重复调用）
4. **自动重试**（失败时自动重试）
5. **完整错误处理**

## 📞 技术支持

- 火山引擎文档：https://www.volcengine.com/docs/
- 火山引擎控制台：https://console.volcengine.com/
- 查看故障排除：TROUBLESHOOTING.md

---

**创建时间：** 2025-02-08
**项目路径：** `/workspace/projects/java_jembedding/`
