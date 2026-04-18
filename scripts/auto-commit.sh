#!/bin/bash

# ============================================
# 每日代码自动提交脚本
# ============================================
# 
# 功能：
# 1. 检查工作目录是否有修改
# 2. 如果有修改，自动添加、提交到 Git
# 3. 提交信息包含日期时间和修改摘要
#
# 使用方法：
# - 手动执行：bash /workspace/projects/scripts/auto-commit.sh
# - 设置定时任务：使用 crontab -e 添加
#
# ============================================

# 设置项目目录
PROJECT_DIR="/workspace/projects"

# 设置日志文件
LOG_FILE="$PROJECT_DIR/.coze-logs/auto-commit.log"

# 获取当前时间
NOW=$(date '+%Y-%m-%d %H:%M:%S')
DATE=$(date '+%Y-%m-%d')

# 创建日志目录（如果不存在）
mkdir -p "$(dirname "$LOG_FILE")"

# 记录开始时间
echo "========================================" >> "$LOG_FILE"
echo "[$NOW] 开始执行自动提交脚本" >> "$LOG_FILE"

# 进入项目目录
cd "$PROJECT_DIR" || {
    echo "[$NOW] 错误：无法进入项目目录 $PROJECT_DIR" >> "$LOG_FILE"
    exit 1
}

# 检查 Git 仓库状态
GIT_STATUS=$(git status --porcelain 2>/dev/null)

# 如果没有修改，直接退出
if [ -z "$GIT_STATUS" ]; then
    echo "[$NOW] 没有检测到代码修改，跳过提交" >> "$LOG_FILE"
    echo "[$NOW] 脚本执行完成" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    exit 0
fi

# 检测到修改，开始提交流程
echo "[$NOW] 检测到代码修改，开始提交..." >> "$LOG_FILE"

# 显示修改的文件列表
echo "[$NOW] 修改的文件：" >> "$LOG_FILE"
git status --short >> "$LOG_FILE"

# 添加所有修改的文件
git add -A >> "$LOG_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo "[$NOW] 错误：git add 失败" >> "$LOG_FILE"
    exit 1
fi

# 生成提交信息
COMMIT_MSG="chore: 每日自动提交 - $DATE

修改摘要：
$(git diff --cached --stat | tail -1)"

# 提交代码
git commit -m "$COMMIT_MSG" >> "$LOG_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo "[$NOW] 错误：git commit 失败" >> "$LOG_FILE"
    exit 1
fi

# 记录提交成功
echo "[$NOW] 代码提交成功" >> "$LOG_FILE"

# 显示最新提交信息
echo "[$NOW] 最新提交：" >> "$LOG_FILE"
git log -1 --oneline >> "$LOG_FILE"

# 记录结束时间
echo "[$NOW] 脚本执行完成" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 退出
exit 0
