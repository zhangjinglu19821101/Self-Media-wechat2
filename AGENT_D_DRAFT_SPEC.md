# Agent D 草稿存储规范

## 概述

本文档定义了 AI 事业部 Agent D 的文章草稿存储标准化要求。

## 存储规则

### 1. 固定存储路径

```
/workspace/projects/AI-Business/draft-article
```

**说明**：
- 所有 Agent D 的公众号文章草稿必须存放在此路径
- 无客观障碍不得变更存储位置
- Agent D 的子目录：`/workspace/projects/AI-Business/draft-article/agent-d/`

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
task-001_医保报_20260203.md
task-002_理财路_20260203.md
insurance-d-001_养老险_20260203.md
```

**命名规则**：
- 标题简名会自动移除特殊字符：`<>:"/\|?*，。！？、；：""''（）` 等
- 如果标题简名提取失败，默认使用 `无标题`
- 任务 ID 缺失时使用 `unknown` 作为前缀

### 3. 存储附加要求

**文件首行标注**：
```
任务ID + 完整文章标题 + 创作完成时间
```

**格式示例**：
```
task-001 普通人必懂的医保报销误区 2026/02/03 14:30:45
```

**完整文件示例**：
```markdown
task-001 普通人必懂的医保报销误区 2026/02/03 14:30:45

---
agentId: D
taskId: task-001
title: 普通人必懂的医保报销误区
author: 内容主编
createdAt: 2026-02-03T14:30:45.123Z
updatedAt: 2026-02-03T14:30:45.123Z
status: draft
metadata: {"savedFrom":"chat"}
---

# 普通人必懂的医保报销误区

## 误区一：医保可以报销所有医疗费用

实际上，医保只能报销符合规定的医疗费用...
```

## 与 insurance-d 的区别

| 项目 | Agent D | insurance-d |
|------|---------|-------------|
| 存储路径 | `/workspace/projects/AI-Business/draft-article/agent-d/` | `/workspace/projects/insurance-business/draft-article/insurance-d/` |
| 命名规范 | 【任务ID】_【文章标题简名（2-4字）】_【创作日期XXXXXX】.md | 【任务ID】_【文章标题简名（2-4字）】_【创作日期XXXXXX】.md |
| 首行标注 | ✅ 要求 | ✅ 要求 |
| 适用范围 | AI 事业部 Agent D | 保险事业部 insurance-d |

## API 使用

### 保存草稿

**请求**：
```bash
POST /api/drafts
Content-Type: application/json

{
  "agentId": "D",
  "taskId": "task-001",
  "title": "普通人必懂的医保报销误区",
  "content": "# 普通人必懂的医保报销误区\n\n## 误区一...",
  "author": "内容主编",
  "status": "draft"
}
```

**响应**：
```json
{
  "success": true,
  "message": "草稿已成功保存",
  "data": {
    "filePath": "/workspace/projects/AI-Business/draft-article/agent-d/task-001_医保报_20260203.md",
    "fileName": "task-001_医保报_20260203.md",
    "draft": {
      "agentId": "D",
      "title": "普通人必懂的医保报销误区",
      "author": "内容主编",
      "status": "draft",
      "createdAt": "2026-02-03T14:30:45.123Z",
      "updatedAt": "2026-02-03T14:30:45.123Z"
    }
  }
}
```

### 读取草稿

**请求**：
```bash
GET /api/drafts/task-001_医保报_20260203.md?agentId=D
```

**响应**：
```json
{
  "success": true,
  "data": {
    "agentId": "D",
    "taskId": "task-001",
    "title": "普通人必懂的医保报销误区",
    "author": "内容主编",
    "createdAt": "2026-02-03T14:30:45.123Z",
    "updatedAt": "2026-02-03T14:30:45.123Z",
    "status": "draft",
    "content": "# 普通人必懂的医保报销误区\n\n## 误区一..."
  }
}
```

## 验证方法

### 1. 检查目录结构

```bash
ls -la /workspace/projects/AI-Business/draft-article/agent-d/
```

### 2. 检查文件命名格式

```bash
ls /workspace/projects/AI-Business/draft-article/agent-d/
# 输出示例：
# task-001_医保报_20260203.md
# task-002_理财路_20260203.md
```

### 3. 检查文件首行格式

```bash
head -n 1 /workspace/projects/AI-Business/draft-article/agent-d/task-001_医保报_20260203.md
# 输出示例：
# task-001 普通人必懂的医保报销误区 2026/02/03 14:30:45
```

### 4. 通过 API 验证

```bash
# 保存草稿
curl -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "D",
    "taskId": "test-001",
    "title": "测试文章标题",
    "content": "# 测试\n\n内容...",
    "author": "内容主编"
  }'

# 验证文件存在
ls /workspace/projects/AI-Business/draft-article/agent-d/test-001_测试文_$(date +%Y%m%d).md

# 读取文件首行
head -n 1 /workspace/projects/AI-Business/draft-article/agent-d/test-001_测试文_$(date +%Y%m%d).md
```

## 注意事项

1. **路径固定**：Agent D 的存储路径是固定的，不允许随意更改
2. **命名规范**：必须严格按照命名规范命名，便于 Agent A 查询和管理
3. **首行标注**：每次保存草稿时，首行会自动添加任务ID+标题+时间信息
4. **特殊字符**：文件名中的特殊字符会被自动移除或替换
5. **向后兼容**：支持读取旧格式的文件（没有首行标注的文件）

## 迁移指南

如果已有旧格式的草稿文件，可以使用以下方法迁移：

```bash
# 备份现有草稿
cp -r /workspace/projects/AI-Business/draft-article/agent-d/ /backup/

# 系统会自动处理新保存的草稿格式
# 旧格式文件仍可正常读取
```

## 故障排查

### 问题 1：文件名不符合规范

**现象**：文件名包含特殊字符或格式不正确

**解决**：
- 检查文章标题是否包含大量特殊字符
- 系统会自动处理特殊字符，但如果标题完全由特殊字符组成，会使用"无标题"

### 问题 2：首行标注缺失

**现象**：文件首行没有任务ID+标题+时间信息

**解决**：
- 重新保存草稿，系统会自动添加首行标注
- 确保使用的是最新版本的保存 API

### 问题 3：读取旧格式文件失败

**现象**：读取旧格式草稿时返回错误

**解决**：
- 系统支持向后兼容，旧格式文件仍可正常读取
- 如果出现问题，请检查文件是否损坏

## 相关文档

- [草稿存储功能文档](./DRAFT_STORAGE_README.md)
- [草稿存储使用指南](./DRAFT_STORAGE_USAGE.md)
- [草稿路径配置说明](./DRAFT_PATH_CONFIG.md)
