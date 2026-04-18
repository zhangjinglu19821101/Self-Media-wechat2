# 草稿存储规范更新总结

## 更新内容

根据 AI 事业部 Agent D 专属【核心执行动作 1】第 9 条的要求，对草稿存储功能进行了标准化更新。

## 修改内容

### 1. 文件命名规范

**旧格式**：
```
{taskId}_{timestamp}_{title}.md
示例：task-001_2026-02-03T14-34-33_测试文章.md
```

**新格式**：
```
【任务ID】_【文章标题简名（2-4字）】_【创作日期XXXXXX】.md
示例：task-001_医保报_20260203.md
```

### 2. 文件首行标注

**新增要求**：草稿文件内首行标注「任务ID+完整文章标题+创作完成时间」

**格式**：
```
任务ID 完整文章标题 创作完成时间
示例：task-001 普通人必懂的医保报销误区 2026/02/03 14:30:45
```

### 3. 完整文件示例

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
---

# 普通人必懂的医保报销误区

## 误区一：医保可以报销所有医疗费用

实际上，医保只能报销符合规定的医疗费用...
```

## 代码修改

### 修改的文件

1. **src/lib/services/draft-storage.ts**
   - 修改 `generateFileName()` 函数：实现新的命名规范
   - 修改 `buildDraftContent()` 函数：添加首行标注
   - 修改 `parseDraftContent()` 函数：支持解析新格式文件
   - 修改 `DraftFile` 接口：添加 `fileName` 字段

2. **src/app/api/drafts/route.ts**
   - 修改 GET 方法：直接返回实际的文件名，而不是重新生成

### 新增的文件

3. **AGENT_D_DRAFT_SPEC.md**
   - Agent D 草稿存储规范文档
   - 详细的命名规则和使用说明

4. **test-draft-storage.sh**
   - 自动化测试脚本
   - 验证文件命名规范和首行标注

## 测试结果

所有测试通过 ✅

```
【测试 1】Agent D 保存草稿
✅ 文件名格式正确
✅ 文件已创建
✅ 首行标注格式正确

【测试 2】获取 Agent D 草稿列表
✅ API 返回的文件名与实际文件名一致

【测试 3】insurance-d 保存草稿
✅ 文件名格式正确
✅ 文件已创建
✅ 首行标注格式正确

【测试 4】读取 Agent D 草稿
✅ 读取成功
```

## 兼容性

- **向后兼容**：系统支持读取旧格式的文件
- **新格式优先**：新保存的草稿使用新格式
- **无缝迁移**：旧格式文件仍可正常读取和管理

## 使用示例

### 保存草稿

```bash
curl -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "D",
    "taskId": "task-001",
    "title": "普通人必懂的医保报销误区",
    "content": "# 内容...",
    "author": "内容主编",
    "status": "draft"
  }'
```

### 查看文件

```bash
# Agent D 的草稿
ls /workspace/projects/AI-Business/draft-article/agent-d/
# 输出：task-001_普通人必_20260203.md

# insurance-d 的草稿
ls /workspace/projects/insurance-business/draft-article/insurance-d/
# 输出：test-ins-001_养老保险_20260203.md
```

### 查看首行标注

```bash
head -n 1 /workspace/projects/AI-Business/draft-article/agent-d/task-001_普通人必_20260203.md
# 输出：task-001 普通人必懂的医保报销误区 2026/02/03 14:30:45
```

## 优势

1. **标准化命名**：文件名更加简洁规范，便于 Agent A 查询和管理
2. **首行标注**：快速识别文件内容，无需打开文件即可了解基本信息
3. **日期清晰**：创作日期使用 YYYYMMDD 格式，便于按日期排序和筛选
4. **向后兼容**：支持旧格式文件，平滑过渡

## 后续建议

1. 逐步将旧格式文件迁移到新格式（可选）
2. 定期清理旧格式文件
3. 在 Agent A 的提示词中添加关于新命名规范的说明
4. 考虑添加按日期范围查询草稿的功能

## 相关文档

- [Agent D 草稿存储规范](./AGENT_D_DRAFT_SPEC.md)
- [草稿存储功能文档](./DRAFT_STORAGE_README.md)
- [草稿存储使用指南](./DRAFT_STORAGE_USAGE.md)
- [草稿路径配置说明](./DRAFT_PATH_CONFIG.md)
