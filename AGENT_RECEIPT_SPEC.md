# Agent 回执和状态反馈功能文档

## 概述

本文档描述了为所有执行端 Agent（B、C、D、insurance-c、insurance-d）提供的标准化回执和状态反馈功能。

## 功能说明

### 1. 指令接收即时回执

**要求**：接收 Agent A 下达的任何指令/任务后，必须在1分钟内完成回执反馈，无客观障碍不得延迟。

**固定格式**：
```
任务ID：【收到的任务唯一ID，无ID填「无」】
指令接收状态：【成功/失败（失败需标注原因，如「指令无核心任务ID」）】
执行准备：【已明确核心要求，进入执行阶段/需补充核心信息（仅失败时填）】
```

**示例**：

**成功回执**：
```
任务ID：【task-001】
指令接收状态：【成功】
执行准备：【已明确核心要求，进入执行阶段】
```

**失败回执**：
```
任务ID：【无】
指令接收状态：【失败（失败原因：指令无核心任务ID）】
执行准备：【需补充核心信息】
```

### 2. 任务主动查询反馈

**要求**：无条件支持 Agent A 发起的任何任务情况查询，收到 A 的查询指令后立即反馈（无延迟）。

**固定格式**：
```
任务基础信息：任务ID【XXX】、任务名称【XXX】、接收时间【XXXX-XX-XX XX:XX】
当前执行状态：【未开始/执行中/已完成/暂停（暂停标注原因）】
核心完成进度：【量化进度，如「内容创作完成8/10篇」「涨粉完成400/2000」「问一问解答完成25条」】
已完成核心节点：【如「选题审核通过」「3篇文章上传草稿箱」「当日互动数据统计完成」】
待办核心事项：【如「剩余2篇文章18:00前完成」「明日10:00前提交周复盘」】
当前问题/异常：【无/客观障碍（标注具体障碍，如「公众号后台无法访问」）】
```

**示例**：

**执行中状态**：
```
任务基础信息：任务ID【task-001】、任务名称【创作公众号文章】、接收时间【2026-02-03 14:30】
当前执行状态：【执行中】
核心完成进度：【内容创作完成8/10篇】
已完成核心节点：【选题审核通过、3篇文章上传草稿箱】
待办核心事项：【剩余2篇文章18:00前完成】
当前问题/异常：【无】
```

**暂停状态**：
```
任务基础信息：任务ID【task-003】、任务名称【问一问解答】、接收时间【2026-02-03 09:00】
当前执行状态：【暂停（公众号后台无法访问）】
核心完成进度：【问一问解答完成25条】
已完成核心节点：【无】
待办核心事项：【明日10:00前提交周复盘】
当前问题/异常：【客观障碍（公众号后台无法访问）】
```

## API 使用

### 生成任务接收回执

**请求**：
```bash
POST /api/agents/receipt
Content-Type: application/json

{
  "type": "receipt",
  "params": {
    "taskId": "task-001",
    "status": "success"
  }
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "type": "receipt",
    "content": "任务ID：【task-001】\n指令接收状态：【成功】\n执行准备：【已明确核心要求，进入执行阶段】",
    "timestamp": "2026-02-03T14:30:00.000Z"
  }
}
```

### 生成任务状态反馈

**请求**：
```bash
POST /api/agents/receipt
Content-Type: application/json

{
  "type": "status-feedback",
  "params": {
    "taskId": "task-001",
    "taskName": "创作公众号文章",
    "receivedTime": "2026-02-03 14:30",
    "executionStatus": "in-progress",
    "progress": "内容创作完成8/10篇",
    "completedNodes": ["选题审核通过", "3篇文章上传草稿箱"],
    "pendingItems": ["剩余2篇文章18:00前完成"],
    "issues": "无"
  }
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "type": "status-feedback",
    "content": "任务基础信息：任务ID【task-001】、任务名称【创作公众号文章】、接收时间【2026-02-03 14:30】\n当前执行状态：【执行中】\n核心完成进度：【内容创作完成8/10篇】\n已完成核心节点：【选题审核通过、3篇文章上传草稿箱】\n待办核心事项：【剩余2篇文章18:00前完成】\n当前问题/异常：【无】",
    "timestamp": "2026-02-03T14:30:00.000Z"
  }
}
```

## 参数说明

### 任务接收回执参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值：receipt |
| params.taskId | string | 否 | 任务ID，无ID可不填 |
| params.status | string | 是 | 状态：success（成功）、failed（失败） |
| params.failureReason | string | 否 | 失败原因，仅失败时必填 |

### 任务状态反馈参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | 固定值：status-feedback |
| params.taskId | string | 是 | 任务ID |
| params.taskName | string | 是 | 任务名称 |
| params.receivedTime | string | 是 | 接收时间（格式：YYYY-MM-DD HH:MM） |
| params.executionStatus | string | 是 | 执行状态：not-started、in-progress、completed、paused |
| params.executionStatusReason | string | 否 | 暂停原因，仅暂停时必填 |
| params.progress | string | 是 | 核心完成进度 |
| params.completedNodes | string[] | 否 | 已完成核心节点数组 |
| params.pendingItems | string[] | 否 | 待办核心事项数组 |
| params.issues | string | 是 | 当前问题/异常 |

## 执行状态说明

| 状态值 | 说明 | 示例 |
|--------|------|------|
| not-started | 未开始 | 任务已接收但尚未开始执行 |
| in-progress | 执行中 | 任务正在执行中 |
| completed | 已完成 | 任务已完成 |
| paused | 暂停 | 任务因客观障碍暂停（需标注原因） |

## 前端组件

### AgentReceiptManager

回执和状态反馈管理组件，提供两个标签页：

1. **指令接收回执**：生成任务接收回执
2. **任务状态反馈**：生成任务状态反馈

### 使用示例

```tsx
import { AgentReceiptManager } from '@/components/agent-receipt-manager';

function AgentPage() {
  return (
    <AgentReceiptManager agentId="B" />
  );
}
```

## 使用流程

### 指令接收回执流程

1. Agent 接收到 Agent A 下达的指令/任务
2. 在1分钟内打开"回执和状态反馈管理"面板
3. 选择"指令接收回执"标签页
4. 填写任务ID（如有）
5. 选择指令接收状态（成功/失败）
6. 如失败，填写失败原因
7. 点击"生成回执"按钮
8. 复制生成的回执，反馈给 Agent A

### 任务状态反馈流程

1. Agent 接收到 Agent A 的任务查询指令
2. 立即打开"回执和状态反馈管理"面板
3. 选择"任务状态反馈"标签页
4. 填写任务信息：
   - 任务ID（必填）
   - 任务名称（必填）
   - 接收时间（默认当前时间，可修改）
   - 当前执行状态（必填）
   - 暂停原因（仅暂停时必填）
   - 核心完成进度（必填）
   - 已完成核心节点（可选）
   - 待办核心事项（可选）
   - 当前问题/异常（必填）
5. 点击"生成状态反馈"按钮
6. 复制生成的状态反馈，反馈给 Agent A

## 注意事项

1. **时间要求**：
   - 指令接收回执：必须在1分钟内完成
   - 任务状态反馈：必须立即反馈（无延迟）

2. **格式要求**：
   - 严格按照固定格式执行
   - 仅替换【】内变量
   - 其余内容不变

3. **空值处理**：
   - 无对应信息填「无」
   - 失败原因需标注具体障碍

4. **适用范围**：
   - 仅执行端 Agent（B、C、D、insurance-c、insurance-d）
   - Agent A 不需要此功能

## 测试验证

运行测试脚本验证功能：

```bash
./test-agent-receipt.sh
```

测试内容：
- 生成成功的任务接收回执
- 生成失败的任务接收回执
- 生成任务状态反馈（执行中）
- 生成任务状态反馈（已完成）
- 生成任务状态反馈（暂停）
- 验证不支持的操作类型

## 相关文档

- [Agent 任务管理系统](./AGENT_TASK_SYSTEM.md)
- [Agent 协作规范](./AGENT_COLLABORATION.md)
