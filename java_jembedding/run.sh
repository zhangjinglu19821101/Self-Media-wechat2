#!/bin/bash

# 火山引擎豆包 Embedding API - Java 编译和运行脚本

echo "========================================"
echo "火山引擎豆包 Embedding API"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Java 版本
echo "检查 Java 版本..."
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
    echo -e "${GREEN}✓${NC} Java 版本: $JAVA_VERSION"

    if [ "$JAVA_VERSION" -lt 11 ]; then
        echo -e "${RED}✗${NC} Java 版本过低，需要 Java 11 或更高版本"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} 未找到 Java，请先安装 Java 11 或更高版本"
    exit 1
fi

# 检查 Maven
echo ""
echo "检查 Maven..."
if command -v mvn &> /dev/null; then
    echo -e "${GREEN}✓${NC} Maven 已安装"
    USE_MAVEN=true
else
    echo -e "${YELLOW}⚠${NC} 未找到 Maven，将使用 javac 编译"
    USE_MAVEN=false
fi

# 创建 lib 目录
echo ""
echo "创建 lib 目录..."
mkdir -p lib

# 检查依赖
echo ""
echo "检查依赖文件..."
if [ ! -f "lib/json-20231013.jar" ]; then
    echo -e "${YELLOW}⚠${NC} 未找到 json-20231013.jar，正在下载..."
    curl -L -o lib/json-20231013.jar https://repo1.maven.org/maven2/org/json/json/20231013/json-20231013.jar

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} json-20231013.jar 下载成功"
    else
        echo -e "${RED}✗${NC} json-20231013.jar 下载失败"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} json-20231013.jar 已存在"
fi

if [ ! -f "lib/okhttp-4.12.0.jar" ]; then
    echo -e "${YELLOW}⚠${NC} 未找到 okhttp-4.12.0.jar，正在下载..."
    curl -L -o lib/okhttp-4.12.0.jar https://repo1.maven.org/maven2/com/squareup/okhttp3/okhttp/4.12.0/okhttp-4.12.0.jar

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} okhttp-4.12.0.jar 下载成功"
    else
        echo -e "${RED}✗${NC} okhttp-4.12.0.jar 下载失败"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} okhttp-4.12.0.jar 已存在"
fi

if [ ! -f "lib/okio-3.6.0.jar" ]; then
    echo -e "${YELLOW}⚠${NC} 未找到 okio-3.6.0.jar，正在下载..."
    curl -L -o lib/okio-3.6.0.jar https://repo1.maven.org/maven2/com/squareup/okio/okio/3.6.0/okio-3.6.0.jar

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} okio-3.6.0.jar 下载成功"
    else
        echo -e "${RED}✗${NC} okio-3.6.0.jar 下载失败"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} okio-3.6.0.jar 已存在"
fi

# 编译
echo ""
echo "========================================"
echo "编译代码"
echo "========================================"

if [ "$USE_MAVEN" = true ]; then
    echo "使用 Maven 编译..."
    mvn clean compile

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Maven 编译成功"
    else
        echo -e "${RED}✗${NC} Maven 编译失败"
        exit 1
    fi
else
    echo "使用 javac 编译..."

    # 编译标准版本
    echo "编译 DoubaoEmbeddingExample.java..."
    javac -cp "lib/json-20231013.jar" DoubaoEmbeddingExample.java

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} DoubaoEmbeddingExample.java 编译成功"
    else
        echo -e "${RED}✗${NC} DoubaoEmbeddingExample.java 编译失败"
        exit 1
    fi

    # 编译 OkHttp 版本
    echo "编译 DoubaoEmbeddingOkHttp.java..."
    javac -cp "lib/json-20231013.jar:lib/okhttp-4.12.0.jar:lib/okio-3.6.0.jar" DoubaoEmbeddingOkHttp.java

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} DoubaoEmbeddingOkHttp.java 编译成功"
    else
        echo -e "${RED}✗${NC} DoubaoEmbeddingOkHttp.java 编译失败"
        exit 1
    fi

    # 编译完整版本
    echo "编译 DoubaoEmbeddingService.java..."
    javac -cp "lib/json-20231013.jar:lib/okhttp-4.12.0.jar:lib/okio-3.6.0.jar" DoubaoEmbeddingService.java

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} DoubaoEmbeddingService.java 编译成功"
    else
        echo -e "${RED}✗${NC} DoubaoEmbeddingService.java 编译失败"
        exit 1
    fi
fi

# 运行
echo ""
echo "========================================"
echo "运行测试"
echo "========================================"

if [ "$USE_MAVEN" = true ]; then
    echo "使用 Maven 运行..."
    mvn exec:java -Dexec.mainClass="DoubaoEmbeddingService"
else
    echo "使用 java 命令运行..."

    # 运行完整版本（推荐）
    echo "运行 DoubaoEmbeddingService..."
    java -cp ".:lib/json-20231013.jar:lib/okhttp-4.12.0.jar:lib/okio-3.6.0.jar" DoubaoEmbeddingService

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} 运行成功"
    else
        echo -e "${RED}✗${NC} 运行失败"
        exit 1
    fi
fi

echo ""
echo "========================================"
echo -e "${GREEN}✓ 所有步骤完成！${NC}"
echo "========================================"
