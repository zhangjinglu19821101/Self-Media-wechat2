#!/bin/bash
set -Eeuo pipefail

PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
NODE_ENV=development
DEPLOY_RUN_PORT=5000

cd "${COZE_WORKSPACE_PATH}"

kill_port_if_listening() {
    local pids
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -z "${pids}" ]]; then
      echo "Port ${DEPLOY_RUN_PORT} is free."
      return
    fi
    echo "Port ${DEPLOY_RUN_PORT} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs -I {} kill -9 {}
    sleep 1
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -n "${pids}" ]]; then
      echo "Warning: port ${DEPLOY_RUN_PORT} still busy after SIGKILL, PIDs: ${pids}"
    else
      echo "Port ${DEPLOY_RUN_PORT} cleared."
    fi
}

echo "Clearing port ${PORT} before start."
kill_port_if_listening
echo "Starting HTTP service on port ${PORT} for dev..."

pnpm next dev --webpack --port $PORT &

# 等待服务启动
echo "Waiting for server to start..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:${PORT} 2>/dev/null; then
    echo "Server started on port ${PORT}"
    break
  fi
  sleep 1
done

# 预热所有页面（触发 Next.js 编译缓存，避免首次访问慢）
echo "Prewarming all pages..."
PREWARM_PAGES=(
  "/login" "/register" "/full-home" "/home"
  "/materials" "/digital-assets" "/style-init" "/style-replica"
  "/account-management" "/settings/team" "/publish/history"
  "/admin" "/query/agent-sub-tasks" "/query/insurance-d"
  "/agents/activity" "/agents/B/split" "/agents/B/problem-monitor"
  "/agent-task-manager" "/creation-guide" "/creation-guide-legacy"
  "/diagnostics/task-list" "/download" "/exceptions"
  "/interaction-history" "/knowledge-base" "/optimization"
  "/reports" "/task-publish" "/task-split-flow"
  "/task-timeline" "/tasks/batch" "/template"
  "/wechat-config" "/workflow" "/test"
  "/admin/agent-builder" "/admin/agent-builder/capabilities"
  "/admin/agent-builder/export" "/admin/agent-commands-verification"
)
for page in "${PREWARM_PAGES[@]}"; do
  curl -s -o /dev/null -m 60 --max-time 60 -L "http://localhost:${PORT}${page}" 2>/dev/null &
done
echo "Prewarm requests sent (background). Note: compilation takes time, pages may still be slow for the first ~60 seconds."

# 等待 next dev 进程
wait
