#!/bin/bash

# ============================================
# 后台自动提交守护进程
# ============================================
#
# 功能：
# 在后台持续运行，定期检查代码修改并自动提交
#
# 启动方式：
# bash /workspace/projects/scripts/auto-commit-daemon.sh start
#
# 停止方式：
# bash /workspace/projects/scripts/auto-commit-daemon.sh stop
#
# 查看状态：
# bash /workspace/projects/scripts/auto-commit-daemon.sh status
#
# ============================================

SCRIPT_PATH="/workspace/projects/scripts/auto-commit.sh"
PID_FILE="/workspace/projects/.coze-logs/auto-commit-daemon.pid"
LOG_FILE="/workspace/projects/.coze-logs/auto-commit-daemon.log"
INTERVAL=3600  # 检查间隔：3600 秒（1小时）

# 创建日志目录
mkdir -p "$(dirname "$PID_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"

# 启动守护进程
start_daemon() {
    # 检查是否已经运行
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "守护进程已在运行中（PID: $PID）"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi

    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 启动自动提交守护进程..." >> "$LOG_FILE"

    # 启动后台进程
    nohup bash -c "
        while true; do
            echo \"[\$(date '+%Y-%m-%d %H:%M:%S')] 执行定期检查...\" >> \"$LOG_FILE\"
            bash \"$SCRIPT_PATH\" >> \"$LOG_FILE\" 2>&1
            sleep $INTERVAL
        done
    " >> "$LOG_FILE" 2>&1 &

    # 记录 PID
    echo $! > "$PID_FILE"

    echo "✅ 自动提交守护进程已启动"
    echo "  进程 ID: $(cat $PID_FILE)"
    echo "  检查间隔: $INTERVAL 秒（$((INTERVAL / 3600)) 小时）"
    echo "  日志文件: $LOG_FILE"
    echo ""
    echo "查看日志：tail -f $LOG_FILE"
    echo "停止守护进程：bash $0 stop"
}

# 停止守护进程
stop_daemon() {
    if [ ! -f "$PID_FILE" ]; then
        echo "守护进程未运行"
        exit 0
    fi

    PID=$(cat "$PID_FILE")

    if ps -p "$PID" > /dev/null 2>&1; then
        kill "$PID"
        rm -f "$PID_FILE"
        echo "✅ 自动提交守护进程已停止（PID: $PID）"
    else
        rm -f "$PID_FILE"
        echo "守护进程未运行"
    fi
}

# 查看守护进程状态
status_daemon() {
    if [ ! -f "$PID_FILE" ]; then
        echo "守护进程未运行"
        exit 0
    fi

    PID=$(cat "$PID_FILE")

    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ 守护进程正在运行"
        echo "  进程 ID: $PID"
        echo "  启动时间: $(ps -p $PID -o lstart=)"
        echo "  运行时长: $(ps -p $PID -o etime=)"
        echo ""
        echo "最近的日志："
        tail -10 "$LOG_FILE"
    else
        rm -f "$PID_FILE"
        echo "守护进程未运行"
    fi
}

# 主逻辑
case "$1" in
    start)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    status)
        status_daemon
        ;;
    restart)
        stop_daemon
        sleep 2
        start_daemon
        ;;
    *)
        echo "用法: $0 {start|stop|status|restart}"
        echo ""
        echo "  start   - 启动守护进程"
        echo "  stop    - 停止守护进程"
        echo "  status  - 查看守护进程状态"
        echo "  restart - 重启守护进程"
        exit 1
        ;;
esac

exit 0
