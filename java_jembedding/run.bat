@echo off
REM 火山引擎豆包 Embedding API - Java 编译和运行脚本 (Windows)

echo ========================================
echo 火山引擎豆包 Embedding API
echo ========================================
echo.

REM 检查 Java
echo 检查 Java...
where java >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] 未找到 Java，请先安装 Java 11 或更高版本
    pause
    exit /b 1
)
echo [OK] Java 已安装

REM 检查 Maven
echo.
echo 检查 Maven...
where mvn >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] 未找到 Maven，将使用 javac 编译
    set USE_MAVEN=false
) else (
    echo [OK] Maven 已安装
    set USE_MAVEN=true
)

REM 创建 lib 目录
echo.
echo 创建 lib 目录...
if not exist lib mkdir lib

REM 下载依赖
echo.
echo 检查依赖文件...

if not exist lib\json-20231013.jar (
    echo [WARN] 未找到 json-20231013.jar，正在下载...
    curl -L -o lib\json-20231013.jar https://repo1.maven.org/maven2/org/json/json/20231013/json-20231013.jar
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] json-20231013.jar 下载失败
        pause
        exit /b 1
    )
    echo [OK] json-20231013.jar 下载成功
) else (
    echo [OK] json-20231013.jar 已存在
)

if not exist lib\okhttp-4.12.0.jar (
    echo [WARN] 未找到 okhttp-4.12.0.jar，正在下载...
    curl -L -o lib\okhttp-4.12.0.jar https://repo1.maven.org/maven2/com/squareup/okhttp3/okhttp/4.12.0/okhttp-4.12.0.jar
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] okhttp-4.12.0.jar 下载失败
        pause
        exit /b 1
    )
    echo [OK] okhttp-4.12.0.jar 下载成功
) else (
    echo [OK] okhttp-4.12.0.jar 已存在
)

if not exist lib\okio-3.6.0.jar (
    echo [WARN] 未找到 okio-3.6.0.jar，正在下载...
    curl -L -o lib\okio-3.6.0.jar https://repo1.maven.org/maven2/com/squareup/okio/okio/3.6.0/okio-3.6.0.jar
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] okio-3.6.0.jar 下载失败
        pause
        exit /b 1
    )
    echo [OK] okio-3.6.0.jar 下载成功
) else (
    echo [OK] okio-3.6.0.jar 已存在
)

REM 编译
echo.
echo ========================================
echo 编译代码
echo ========================================

if "%USE_MAVEN%"=="true" (
    echo 使用 Maven 编译...
    call mvn clean compile
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Maven 编译失败
        pause
        exit /b 1
    )
    echo [OK] Maven 编译成功
) else (
    echo 使用 javac 编译...

    echo 编译 DoubaoEmbeddingExample.java...
    javac -cp "lib\json-20231013.jar" DoubaoEmbeddingExample.java
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] DoubaoEmbeddingExample.java 编译失败
        pause
        exit /b 1
    )
    echo [OK] DoubaoEmbeddingExample.java 编译成功

    echo 编译 DoubaoEmbeddingOkHttp.java...
    javac -cp "lib\json-20231013.jar;lib\okhttp-4.12.0.jar;lib\okio-3.6.0.jar" DoubaoEmbeddingOkHttp.java
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] DoubaoEmbeddingOkHttp.java 编译失败
        pause
        exit /b 1
    )
    echo [OK] DoubaoEmbeddingOkHttp.java 编译成功

    echo 编译 DoubaoEmbeddingService.java...
    javac -cp "lib\json-20231013.jar;lib\okhttp-4.12.0.jar;lib\okio-3.6.0.jar" DoubaoEmbeddingService.java
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] DoubaoEmbeddingService.java 编译失败
        pause
        exit /b 1
    )
    echo [OK] DoubaoEmbeddingService.java 编译成功
)

REM 运行
echo.
echo ========================================
echo 运行测试
echo ========================================

if "%USE_MAVEN%"=="true" (
    echo 使用 Maven 运行...
    call mvn exec:java -Dexec.mainClass="DoubaoEmbeddingService"
) else (
    echo 使用 java 命令运行...

    echo 运行 DoubaoEmbeddingService...
    java -cp ".;lib\json-20231013.jar;lib\okhttp-4.12.0.jar;lib\okio-3.6.0.jar" DoubaoEmbeddingService
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] 运行失败
        pause
        exit /b 1
    )
    echo [OK] 运行成功
)

echo.
echo ========================================
echo [OK] 所有步骤完成！
echo ========================================
pause
