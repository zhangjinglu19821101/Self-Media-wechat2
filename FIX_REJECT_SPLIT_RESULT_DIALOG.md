# 修复：拒绝拆解结果后无法显示下一个弹框

## 问题描述
用户反馈：Agent B 拆解指令入 daily_tasks 表前，通过弹框把拆解结果给到 Agent A，被拒绝后，没有再看到弹框。

## 问题根源分析

### 1. 队列机制实现
在之前的修复中，我们实现了队列机制来处理多个拆解结果：
- 第一个通知直接显示弹框
- 后续通知加入 `pendingSplitNotificationsRef` 队列等待
- 用户确认后，从队列中取出下一个通知显示

### 2. 确认拆解的处理逻辑
在 `handleSplitResultConfirm` 函数中，我们正确实现了队列处理：

```typescript
} finally {
  setIsProcessingSplitResult(false);
  
  // 🔥 显示队列中的下一个拆解结果
  setTimeout(() => {
    if (pendingSplitNotificationsRef.current.length > 0) {
      const nextNotification = pendingSplitNotificationsRef.current.shift();
      // ... 显示下一个弹框
    }
  }, 300);
}
```

### 3. 拒绝拆解的处理逻辑
但是在 `handleSubmitRejectReason` 函数中，我们**忘记**添加队列处理逻辑：

```typescript
finally {
  setIsSubmittingReject(false);
  setRejectReason('');

  // 标记通知为已读
  // 清空 processedSplitResultsRef
  // 关闭弹窗
  
  // ❌ 缺少：没有处理队列中的下一个拆解结果
}
```

### 4. 放弃拆解的处理逻辑
同样，在 `handleSplitResultAbandon` 函数中也**忘记**添加队列处理逻辑。

## 修复方案

### 1. 修复 `handleSubmitRejectReason` 函数

**修改前：**
```typescript
// === insurance-d 拆解拒绝逻辑 ===
if (splitExecutor === 'insurance-d') {
  // ... 处理逻辑
  setIsSubmittingReject(false);
  return; // ❌ 直接 return，不执行后续的队列处理逻辑
}

// === Agent B 拆解拒绝逻辑 ===
// ... 处理逻辑
finally {
  setIsSubmittingReject(false);
  setRejectReason('');
  // 标记通知为已读
  // 清空 processedSplitResultsRef
  // 关闭弹窗
  // ❌ 缺少：没有处理队列中的下一个拆解结果
}
```

**修改后：**
```typescript
// === insurance-d 拆解拒绝逻辑 ===
if (splitExecutor === 'insurance-d') {
  // ... 处理逻辑
  setIsSubmittingReject(false);
  // ✅ 移除 return 语句，继续执行队列处理逻辑
}

// === Agent B 拆解拒绝逻辑 ===
// ... 处理逻辑
finally {
  setIsSubmittingReject(false);
  setRejectReason('');
  // 标记通知为已读
  // 清空 processedSplitResultsRef
  // 关闭弹窗
  
  // ✅ 新增：显示队列中的下一个拆解结果
  setTimeout(() => {
    console.log(`🔍 [拒绝后队列] 检查队列中的待显示通知...`);
    if (pendingSplitNotificationsRef.current.length > 0) {
      const nextNotification = pendingSplitNotificationsRef.current.shift();
      
      if (nextNotification) {
        const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;
        
        // 显示下一个弹框
        setShowSplitResultConfirm(true);
        setSplitResultTaskId(taskIdToUse);
        setCurrentNotificationId(notification.notificationId || '');
        setSplitResult(jsonData);
        setSplitExecutor(displayExecutor);
        
        // 添加到已处理集合
        if (notification.notificationId) {
          processedSplitResultsRef.current.add(notification.notificationId);
        }
        
        displayedCountRef.current++;
      }
    } else {
      displayedCountRef.current = 0;
    }
  }, 300);
}
```

### 2. 修复 `handleSplitResultAbandon` 函数

**修改前：**
```typescript
const handleSplitResultAbandon = async () => {
  // ... 标记通知为已读
  // ... 关闭弹框
  // ... 清空状态
  toast.info('已放弃此拆解方案');
  // ❌ 缺少：没有处理队列中的下一个拆解结果
};
```

**修改后：**
```typescript
const handleSplitResultAbandon = async () => {
  // ... 标记通知为已读
  // ... 关闭弹框
  // ... 清空状态
  toast.info('已放弃此拆解方案');

  // ✅ 新增：显示队列中的下一个拆解结果
  setTimeout(() => {
    console.log(`🔍 [放弃后队列] 检查队列中的待显示通知...`);
    if (pendingSplitNotificationsRef.current.length > 0) {
      const nextNotification = pendingSplitNotificationsRef.current.shift();
      
      if (nextNotification) {
        const { notification, jsonData, taskIdToUse, displayExecutor } = nextNotification;
        
        // 显示下一个弹框
        setShowSplitResultConfirm(true);
        setSplitResultTaskId(taskIdToUse);
        setCurrentNotificationId(notification.notificationId || '');
        setSplitResult(jsonData);
        setSplitExecutor(displayExecutor);
        
        // 添加到已处理集合
        if (notification.notificationId) {
          processedSplitResultsRef.current.add(notification.notificationId);
        }
        
        displayedCountRef.current++;
      }
    } else {
      displayedCountRef.current = 0;
    }
  }, 300);
};
```

## 修复效果

### 修复前
1. 用户看到第一个拆解结果弹框
2. 用户选择"拒绝"
3. 输入拒绝原因，提交
4. 弹框关闭，通知 Agent B 重新拆解
5. ❌ **问题**：队列中的下一个拆解结果无法显示

### 修复后
1. 用户看到第一个拆解结果弹框
2. 用户选择"拒绝"或"放弃"
3. 输入拒绝原因（拒绝时），提交
4. 弹框关闭
5. ✅ **修复**：300ms 后，队列中的下一个拆解结果自动显示弹框
6. 用户可以继续处理队列中的其他拆解结果

## 关键修复点

### 1. 移除 insurance-d 拆解拒绝逻辑中的 `return` 语句
```typescript
// 修改前
setIsSubmittingReject(false);
return; // ❌ 直接 return，不执行后续的队列处理逻辑

// 修改后
setIsSubmittingReject(false);
// ✅ 移除 return，继续执行 finally 块中的队列处理逻辑
```

### 2. 在 `finally` 块中添加队列处理逻辑
无论是 Agent B 拆解还是 insurance-d 拆解，拒绝后都会执行 `finally` 块，在 `finally` 块中添加队列处理逻辑，确保下一个拆解结果能够显示。

### 3. 在 `handleSplitResultAbandon` 函数中添加队列处理逻辑
放弃拆解后也应该显示队列中的下一个拆解结果。

## 测试验证

### 测试场景 1：拒绝 Agent B 拆解结果
1. 准备多个待确认的 Agent B 拆解结果
2. 第一个弹框显示
3. 选择"拒绝"，输入拒绝原因
4. 提交后，300ms 后第二个弹框自动显示 ✅

### 测试场景 2：放弃 Agent B 拆解结果
1. 准备多个待确认的 Agent B 拆解结果
2. 第一个弹框显示
3. 选择"放弃"
4. 300ms 后第二个弹框自动显示 ✅

### 测试场景 3：拒绝 insurance-d 拆解结果
1. 准备多个待确认的 insurance-d 拆解结果
2. 第一个弹框显示
3. 选择"拒绝"，输入拒绝原因
4. 提交后，300ms 后第二个弹框自动显示 ✅

### 测试场景 4：放弃 insurance-d 拆解结果
1. 准备多个待确认的 insurance-d 拆解结果
2. 第一个弹框显示
3. 选择"放弃"
4. 300ms 后第二个弹框自动显示 ✅

### 测试场景 5：混合场景
1. 准备多个待确认的拆解结果（混合 Agent B 和 insurance-d）
2. 第一个弹框显示
3. 选择"拒绝"或"放弃"
4. 300ms 后第二个弹框自动显示
5. 继续处理，直到队列清空 ✅

## 相关文件

### 修改的文件
- `src/app/agents/[id]/page.tsx`

### 修改的函数
1. `handleSubmitRejectReason` - 拒绝拆解结果
2. `handleSplitResultAbandon` - 放弃拆解结果

### 涉及的状态变量
- `pendingSplitNotificationsRef` - 待显示的拆解结果队列
- `processedSplitResultsRef` - 已处理的拆解结果集合
- `displayedCountRef` - 显示计数器
- `currentNotificationId` - 当前通知 ID
- `showSplitResultConfirm` - 显示拆解结果确认弹框
- `splitResult` - 拆解结果
- `splitResultTaskId` - 拆解结果任务 ID
- `splitExecutor` - 拆解执行者

## 总结

这个问题的核心原因是：在实现队列机制时，我们只处理了"确认"操作后的队列逻辑，而忽略了"拒绝"和"放弃"操作后的队列逻辑。

修复方案很简单，就是在 `handleSubmitRejectReason` 和 `handleSplitResultAbandon` 函数中添加与 `handleSplitResultConfirm` 函数类似的队列处理逻辑，确保无论用户选择"确认"、"拒绝"还是"放弃"，都能正确处理队列中的下一个拆解结果。

修复后，用户可以连续处理多个拆解结果，不会因为拒绝或放弃某个拆解结果而看不到后续的拆解结果。
