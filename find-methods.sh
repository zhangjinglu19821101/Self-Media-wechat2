FILE="src/lib/services/subtask-execution-engine.ts"

methods=(
  "getCurrentMaxInteractNum"
  "callPrecedentSelectorAgent"
  "findExistingAgentInteraction"
  "formatComplianceMcpResult"
  "notifyAgentA"
  "checkForUserFeedback"
  "clearWaitingUserStatus"
  "buildStructuredResultText"
  "getAgentBOutputFormat"
)

echo "📍 未使用方法的定义位置:"
echo "================================================================================"

for method in "${methods[@]}"; do
  echo ""
  echo "🔍 查找: $method"
  grep -n -A 2 -B 2 "private.*$method" "$FILE" || grep -n -A 2 -B 2 "private async.*$method" "$FILE"
done
