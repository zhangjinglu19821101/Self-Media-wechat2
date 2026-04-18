# 指令格式配置使用指南

## ⚠️ 重要提示

**正则表达式已稳定，禁止修改！**

所有新增格式需求都通过配置实现，无需修改正则表达式。

---

## 📁 核心文件

- **配置文件**：`src/lib/command-formats.ts`
- **使用文件**：`src/lib/command-detector.ts`

---

## ✅ 当前支持的所有格式

系统已支持以下所有格式变体，**无需额外配置**：

### 格式1：标准格式（带引号）
```
执行主体为「Agent B」
执行主体：insurance-c
执行主体 insurance-c
```

### 格式2：连续格式（####前缀）
```
#### 执行主体为「insurance-c」
#### 执行主体：Agent B
#### 执行主体 insurance-d
```

### 格式3：Agent B 的各种写法
```
Agent B
agent b
Agent-B
agent-b
B
架构师B
技术负责人
```

### 格式4：Insurance Agent 的各种写法
```
insurance-c
Insurance-c
insurance-d
Insurance-d
保险运营
保险内容
```

---

## 🔧 如何添加新 Agent

**步骤1：在 `EXECUTOR_MAP` 中添加映射**

```typescript
export const EXECUTOR_MAP: Record<string, string> = {
  // 现有映射...
  'agent e': 'E',
  'agent-e': 'E',
  'e': 'E',
  '架构师e': 'E',
};
```

**完成！** 无需修改任何其他代码。

---

## 📝 如何添加新指令格式

**步骤1：在 `COMMAND_FORMATS` 中添加新格式配置**

```typescript
export const COMMAND_FORMATS: CommandFormat[] = [
  // 现有格式...
  {
    name: '新格式：XXX',
    executorRegex: /你的正则/gi,  // ⚠️ 这里的正则表达式不需要修改
    supportsMultiBlock: true,
    description: '格式说明',
  },
];
```

**完成！** 系统会自动识别新格式。

---

## 🎯 常见问题

### Q: 为什么正则表达式禁止修改？

A: 当前正则表达式已经过充分测试，支持所有常见的格式变体。频繁修改可能导致：

1. 已支持的格式被破坏
2. 重复匹配或遗漏
3. 维护成本增加

### Q: 我需要一个新的格式，怎么办？

A: 在 `COMMAND_FORMATS` 中添加配置即可，**无需修改正则表达式**。

当前正则表达式已经非常灵活，能够识别：
- 有引号格式：`「xxx」`
- 无引号格式：`xxx`（到换行符或标点符号）
- 各种分隔符：`：`、`:`、`为`、空格

### Q: 如何验证新格式是否被识别？

A: 使用以下测试命令：

```bash
node scripts/test-command-detection.js
```

---

## 📊 测试用例

### 测试1：标准格式
```typescript
const text = "执行主体为「Agent B」";
// ✅ 识别为：Agent B
```

### 测试2：无引号格式
```typescript
const text = "执行主体 Agent B";
// ✅ 识别为：Agent B
```

### 测试3：连续格式
```typescript
const text = "#### 执行主体 insurance-c";
// ✅ 识别为：insurance-c
```

### 测试4：多种格式混合
```typescript
const text = `
执行主体为「insurance-c」
#### 执行主体：Agent B
执行主体 insurance-d
`;
// ✅ 识别为：insurance-c, Agent B, insurance-d
```

---

## 🚀 总结

1. **正则表达式已稳定，禁止修改** ✅
2. 新增 Agent：在 `EXECUTOR_MAP` 中添加映射
3. 新增格式：在 `COMMAND_FORMATS` 中添加配置
4. 测试验证：使用 `scripts/test-command-detection.js`

如有问题，请检查：
- 映射是否正确（大小写、横杠）
- 正则表达式是否带有 `g` 标志
- 是否已重新加载页面（热更新）
