#!/bin/bash

# ============================================
# 设置每日自动提交定时任务
# ============================================
#
# 功能：
# 每天自动执行代码提交，防止数据丢失
#
# 默认执行时间：每天 23:59（退出前）
#
# ============================================

SCRIPT_PATH="/workspace/projects/scripts/auto-commit.sh"
CRON_JOB="59 23 * * * $SCRIPT_PATH"

# 检查脚本是否存在
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "错误：脚本不存在 $SCRIPT_PATH"
    exit 1
fi

# 检查脚本是否有执行权限
if [ ! -x "$SCRIPT_PATH" ]; then
    echo "错误：脚本没有执行权限"
    echo "请执行：chmod +x $SCRIPT_PATH"
    exit 1
fi

# 检查 crontab 是否已存在该任务
if crontab -l 2>/dev/null | grep -q "$SCRIPT_PATH"; then
    echo "定时任务已存在，无需重复设置"
    echo ""
    echo "当前的定时任务："
    crontab -l | grep "$SCRIPT_PATH"
    exit 0
fi

# 添加定时任务到 crontab
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ 定时任务设置成功！"
echo ""
echo "定时任务详情："
echo "  执行时间：每天 23:59"
echo "  执行脚本：$SCRIPT_PATH"
echo "  执行频率：每天一次"
echo ""
echo "查看定时任务：crontab -l"
echo "删除定时任务：crontab -e（删除对应行）"
echo ""
echo "手动执行脚本：bash $SCRIPT_PATH"
