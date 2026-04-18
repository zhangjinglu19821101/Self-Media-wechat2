# 修复拆解结果确认对话框重复弹出问题

## 问题描述
用户反馈拆解结果确认对话框会反复弹出，即使已经确认或拒绝过拆解结果。

## 根本原因分析

### 问题 1: 对话框标题显示 "insurance-d"
- **现象**: 拆解结果确认对话框的标题显示为 "insurance-d 拆解结果确认"，而不是 "Agent B 拆解结果确认"
- **原因**: 代码中有两处根据 executor 映射设置 `displayExecutor`，保留了 insurance-d 的特殊处理
- **影响**: 用户体验不一致，因为 insurance-d 已经完全使用 Agent B 的逻辑

### 问题 2: 通知去重机制未生效
- **现象**: 每次拒绝后重新拆解，对话框会重复弹出
- **原因**: 拆解 API 使用的是 `notification-service.ts` 的 `createNotification`，没有去重机制
- **影响**: 每次拒绝后重新拆解都会创建新的通知，导致对话框重复弹出

## 修复方案

### 修复 1: 统一对话框标题为 "Agent B"
**文件**: `src/app/agents/[id]/page.tsx`

**修改内容**:
1. 移除 `displayExecutor` 的 insurance-d 特殊处理
2. 统一设置 `displayExecutor = 'Agent B'`
3. 修改了两处代码（实时通知和历史通知）

**修改前**:
```typescript
const displayExecutor = mappedExecutor === 'insurance-d' ? 'insurance-d' :
                       mappedExecutor === 'insurance-c' ? 'insurance-c' :
                       'Agent B';
```

**修改后**:
```typescript
// 🔥 统一显示为 Agent B（insurance-d 已完全使用 Agent B 的逻辑）
const displayExecutor = 'Agent B';
```

### 修复 2: 使用带去重机制的通知服务
**文件**: `src/app/api/agents/tasks/[taskId]/split/route.ts`

**修改内容**:
1. 将 `notification-service.ts` 的 `createNotification` 改为 `notification-service-v3.ts` 的 `createNotification`
2. 启用通知去重机制

**修改前**:
```typescript
import { createNotification } from '@/lib/services/notification-service';
```

**修改后**:
```typescript
import { createNotification } from '@/lib/services/notification-service-v3';
```

**去重机制说明**:
- 去重规则: 相同 `type` + `relatedTaskId` + `toAgentId` 的通知
- 去重窗口: 10 分钟
- 去重结果: 如果发现重复通知，返回现有通知 ID，跳过创建

## 前端去重机制

前端已有完善的通知去重机制：

### 1. 显示计数限制
- 使用 `displayedCountRef.current` 限制同时显示的弹框数量
- 默认限制为 2 个

### 2. 通知状态检查
- 检查通知的 `metadata.splitPopupStatus` 字段
- 只显示状态为 `null` 的通知
- 已处理的通知会有以下状态:
  - `popup_shown`: 已弹框
  - `confirmed`: 已确认
  - `rejected`: 已拒绝
  - `skipped`: 已跳过

### 3. 队列机制
- 使用 `pendingSplitNotificationsRef.current` 队列管理待显示的通知
- 检查通知是否已在队列中，避免重复添加

### 4. 弹框状态检查
- 检查 `showSplitResultConfirm` 状态
- 如果已有弹框显示，不显示新的弹框

## 验证结果

### 数据库验证
```sql
SELECT notification_id, notification_type, related_task_id, to_agent_id, created_at, metadata 
FROM agent_notifications 
WHERE notification_type = 'agent_b_split_result' 
ORDER BY created_at DESC 
LIMIT 10;
```

**结果**:
- 只有 1 条拆解结果通知
- 通知状态已正确更新为 `splitPopupStatus:confirmed`

### 日志验证
```bash
tail -n 20 /app/work/logs/bypass/app.log | grep -iE "error|exception|warn"
```

**结果**: 没有发现错误

## 相关文档
- [统一拆解逻辑文档](./unify-split-logic.md)
- [insurance-d 拒绝修复文档](./insurance-d-reject-fix.md)
- [Agent B 拒绝拆解调试文档](./agent-b-reject-split-debug.md)

## 后续优化建议

1. **清理旧通知**: 定期清理已处理的通知，避免数据库膨胀
2. **监控去重效果**: 监控去重机制的效果，确保不会误判
3. **优化轮询机制**: 考虑使用 SSE 替代轮询，减少服务器压力
4. **添加通知过期时间**: 设置通知过期时间，自动清理过期通知
