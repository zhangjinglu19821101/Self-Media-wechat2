# insurance-d 草稿存储规范

## 概述

本文档定义了保险事业部 insurance-d 的文章草稿存储标准化要求。

## 存储规则

### 1. 固定存储路径

```
/workspace/projects/insurance-Business/draft-article
```

**说明**：
- 所有 insurance-d 的公众号文章草稿必须存放在此路径
- 无客观障碍不得变更存储位置
- insurance-d 的子目录：`/workspace/projects/insurance-Business/draft-article/insurance-d/`
- 注意：路径中的 "Business" 首字母为大写 B

### 2. 草稿命名规范

```
【任务ID】_【文章标题简名（2-4字）】_【创作日期XXXXXX】.md
```

**格式说明**：
- **任务ID**：关联的任务 ID，如 `task-001`、`insurance-d-001`
- **文章标题简名**：文章标题的 2-4 字简写，不包含特殊字符
- **创作日期**：格式为 `YYYYMMDD`，如 `20260203`
- **文件扩展名**：统一使用 `.md` 格式

**示例**：
```
task-001_养老保_20260203.md
insurance-d-001_医疗保_20260203.md
task-002_理赔指_20260203.md
```

### 3. 存储附加要求

**文件首行标注**：
```
任务ID + 完整文章标题 + 创作完成时间 + 合规校验状态
```

**格式示例**：
```
task-001 养老保险全面解析：如何规划养老生活 2026/02/03 14:30:45 passed
```

**合规校验状态说明**：
- `pending`：待校验（默认值）
- `passed`：合规通过
- `failed`：合规不通过

## 完整文件示例

```markdown
task-001 养老保险全面解析：如何规划养老生活 2026/02/03 14:30:45 passed

---
agentId: insurance-d
taskId: task-001
title: 养老保险全面解析：如何规划养老生活
author: 保险科普
createdAt: 2026-02-03T14:30:45.123Z
updatedAt: 2026-02-03T14:30:45.123Z
status: draft
complianceStatus: passed
---

# 养老保险全面解析：如何规划养老生活

## 什么是养老保险

养老保险是国家和社会根据一定的法律和法规...
```

## 与 Agent D 的区别

| 项目 | Agent D | insurance-d |
|------|---------|-------------|
| 存储路径 | `/workspace/projects/AI-Business/draft-article/agent-d/` | `/workspace/projects/insurance-Business/draft-article/insurance-d/` |
| 路径大小写 | AI-Business | insurance-Business（B 大写） |
| 命名规范 | 【任务ID】_【文章标题简名（2-4字）】_【创作日期XXXXXX】.md | 【任务ID】_【文章标题简名（2-4字）】_【创作日期XXXXXX】.md |
| 首行标注 | 任务ID + 标题 + 创作时间 | 任务ID + 标题 + 创作时间 + 合规校验状态 |
| 合规校验状态 | 无 | 有（pending/passed/failed） |

## API 使用

### 保存草稿

**请求**：
```bash
POST /api/drafts
Content-Type: application/json

{
  "agentId": "insurance-d",
  "taskId": "task-001",
  "title": "养老保险全面解析",
  "content": "# 养老保险全面解析\n\n## 什么是养老保险...",
  "author": "保险科普",
  "status": "draft",
  "complianceStatus": "passed"
}
```

**响应**：
```json
{
  "success": true,
  "message": "草稿已成功保存",
  "data": {
    "filePath": "/workspace/projects/insurance-Business/draft-article/insurance-d/task-001_养老保_20260203.md",
    "fileName": "task-001_养老保_20260203.md",
    "draft": {
      "agentId": "insurance-d",
      "title": "养老保险全面解析",
      "author": "保险科普",
      "status": "draft",
      "complianceStatus": "passed",
      "createdAt": "2026-02-03T14:30:45.123Z",
      "updatedAt": "2026-02-03T14:30:45.123Z"
    }
  }
}
```

### 读取草稿

**请求**：
```bash
GET /api/drafts/task-001_养老保_20260203.md?agentId=insurance-d
```

**响应**：
```json
{
  "success": true,
  "data": {
    "agentId": "insurance-d",
    "taskId": "task-001",
    "title": "养老保险全面解析",
    "author": "保险科普",
    "createdAt": "2026-02-03T14:30:45.123Z",
    "updatedAt": "2026-02-03T14:30:45.123Z",
    "status": "draft",
    "complianceStatus": "passed",
    "content": "# 养老保险全面解析\n\n## 什么是养老保险..."
  }
}
```

## 合规校验状态管理

### 更新合规校验状态

当草稿经过合规校验后，需要更新合规校验状态：

**示例代码**：
```typescript
const response = await fetch('/api/drafts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    agentId: 'insurance-d',
    taskId: 'task-001',
    title: '养老保险全面解析',
    content: '# 内容...',
    author: '保险科普',
    status: 'draft',
    complianceStatus: 'passed', // 更新为通过
  }),
});
```

### 前端界面

在 insurance-d 的保存草稿对话框中，可以单独设置合规校验状态：

- **待校验**：草稿刚创建，尚未进行合规校验
- **通过**：草稿已通过合规校验，可以发布
- **不通过**：草稿未通过合规校验，需要修改

## 验证方法

### 1. 检查目录结构

```bash
ls -la /workspace/projects/insurance-Business/draft-article/insurance-d/
```

### 2. 检查文件命名格式

```bash
ls /workspace/projects/insurance-Business/draft-article/insurance-d/
# 输出示例：
# task-001_养老保_20260203.md
# insurance-d-001_医疗保_20260203.md
```

### 3. 检查文件首行格式

```bash
head -n 1 /workspace/projects/insurance-Business/draft-article/insurance-d/task-001_养老保_20260203.md
# 输出示例：
# task-001 养老保险全面解析 2026/02/03 14:30:45 passed
```

### 4. 验证合规校验状态字段

```bash
head -n 15 /workspace/projects/insurance-Business/draft-article/insurance-d/task-001_养老保_20260203.md | grep complianceStatus
# 输出示例：
# complianceStatus: passed
```

### 5. 通过 API 验证

```bash
# 保存草稿
curl -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "insurance-d",
    "taskId": "test-001",
    "title": "测试文章",
    "content": "# 测试\n\n内容...",
    "author": "保险科普",
    "complianceStatus": "passed"
  }'

# 验证文件路径
ls /workspace/projects/insurance-Business/draft-article/insurance-d/

# 读取文件首行
head -n 1 /workspace/projects/insurance-Business/draft-article/insurance-d/test-001_测试文_$(date +%Y%m%d).md

# 清理测试文件
rm /workspace/projects/insurance-Business/draft-article/insurance-d/test-001_测试文_$(date +%Y%m%d).md
```

## 注意事项

1. **路径大小写**：insurance-Business 中的 "Business" 首字母为大写 B
2. **合规校验状态**：insurance-d 草稿必须包含合规校验状态，默认为 `pending`
3. **首行标注**：每次保存草稿时，首行会自动添加任务ID+标题+时间+合规校验状态
4. **特殊字符**：文件名中的特殊字符会被自动移除或替换
5. **向后兼容**：支持读取旧格式的文件（没有合规校验状态的文件）

## 合规校验流程

### 典型流程

1. **创建草稿**：insurance-d 创建草稿，合规校验状态默认为 `pending`
2. **提交审核**：草稿提交给合规审核人员
3. **合规校验**：合规审核人员对草稿进行审核
4. **更新状态**：
   - 审核通过：更新状态为 `passed`
   - 审核不通过：更新状态为 `failed`，并提供修改意见
5. **修改重审**：根据审核意见修改草稿，重新提交审核

### 状态流转图

```
pending (待校验)
    ↓
    ├──→ passed (合规通过) → 可以发布
    └──→ failed (合规不通过) → 需要修改 → pending
```

## 相关文档

- [草稿存储功能文档](./DRAFT_STORAGE_README.md)
- [草稿存储使用指南](./DRAFT_STORAGE_USAGE.md)
- [Agent D 草稿存储规范](./AGENT_D_DRAFT_SPEC.md)
- [草稿命名规范更新](./DRAFT_NAMING_UPDATE.md)
