# insurance-d 草稿存储规范更新总结

## 更新概述

根据保险事业部 insurance-d 专属要求，对草稿存储功能进行了专业化更新，添加了合规校验状态管理功能。

## 核心改动

### 1. 存储路径（大小写修正）

**修正前**：
```
/workspace/projects/insurance-business/draft-article/insurance-d/
```

**修正后** ✅：
```
/workspace/projects/insurance-Business/draft-article/insurance-d/
```

**说明**：路径中的 "Business" 首字母改为大写 B

### 2. 文件首行标注（新增合规校验状态）

**Agent D 格式**：
```
任务ID 完整文章标题 创作完成时间
示例：task-001 普通人必懂的医保报销误区 2026/02/03 14:30:45
```

**insurance-d 格式** ✅：
```
任务ID 完整文章标题 创作完成时间 合规校验状态
示例：task-001 养老保险全面解析 2026/02/03 14:30:45 passed
```

### 3. 合规校验状态（新增）

insurance-d 专属的合规校验状态：

- `pending`：待校验（默认值）
- `passed`：合规通过
- `failed`：合规不通过

### 4. 完整文件示例（insurance-d）

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

## 修改的文件

### 后端代码

1. **src/lib/services/draft-storage.ts**
   - ✅ 修正 insurance-d 存储路径大小写（insurance-Business）
   - ✅ `DraftFile` 接口：添加 `complianceStatus` 字段
   - ✅ `buildDraftContent()` 函数：为 insurance-d 添加合规校验状态到首行
   - ✅ `parseDraftContent()` 函数：解析合规校验状态

2. **src/app/api/drafts/route.ts**
   - ✅ POST 方法：接收 `complianceStatus` 参数
   - ✅ GET 方法：返回 `complianceStatus` 字段

### 前端组件

3. **src/components/save-draft-button.tsx**
   - ✅ 添加 `complianceStatus` 状态变量
   - ✅ 为 insurance-d 显示合规校验状态选择器
   - ✅ 修正存储路径显示（insurance-Business）

4. **src/components/draft-list-panel.tsx**
   - ✅ `DraftItem` 接口：添加 `complianceStatus` 字段
   - ✅ `getStatusConfig()` 函数：添加合规校验状态配置
   - ✅ 草稿列表显示：为 insurance-d 显示合规校验状态徽章
   - ✅ 修正存储路径显示（insurance-Business）

### 文档

5. **INSURANCE_D_DRAFT_SPEC.md** (新增)
   - insurance-d 草稿存储规范详细文档
   - 合规校验状态管理说明
   - 完整的使用示例和验证方法

6. **DRAFT_STORAGE_README.md** (更新)
   - 更新存储路径说明（insurance-Business）

7. **DRAFT_PATH_CONFIG.md** (更新)
   - 更新配置代码说明
   - 添加路径大小写注意事项

## 测试结果

所有测试通过 ✅

```
【测试 1】insurance-d 保存草稿（含合规校验状态）
✅ 文件路径正确 (insurance-Business)
✅ 文件名格式正确
✅ 首行标注包含合规校验状态
✅ YAML frontmatter 包含 complianceStatus 字段

【测试 2】Agent D 保存草稿（无合规校验状态）
✅ 文件路径正确 (AI-Business)
✅ 文件名格式正确
✅ 首行标注不包含合规校验状态

【测试 3】API 返回合规校验状态
✅ GET /api/drafts 正确返回 complianceStatus 字段
✅ GET /api/drafts/[fileName] 正确返回 complianceStatus 字段
```

## 存储路径对比

| Agent | 存储路径 | 路径说明 |
|-------|---------|---------|
| Agent D | `/workspace/projects/AI-Business/draft-article/agent-d/` | AI 业务路径 |
| insurance-d | `/workspace/projects/insurance-Business/draft-article/insurance-d/` | 保险业务路径，Business 首字母大写 |

## 首行标注对比

| Agent | 首行格式 | 示例 |
|-------|---------|------|
| Agent D | 任务ID + 标题 + 创作时间 | `task-001 普通人必懂的医保报销误区 2026/02/03 14:30:45` |
| insurance-d | 任务ID + 标题 + 创作时间 + 合规校验状态 | `task-001 养老保险全面解析 2026/02/03 14:30:45 passed` |

## 合规校验状态管理

### 状态流转

```
pending (待校验)
    ↓
    ├──→ passed (合规通过) → 可以发布
    └──→ failed (合规不通过) → 需要修改 → pending
```

### 前端界面

insurance-d 的保存草稿对话框中，可以单独设置合规校验状态：

- **待校验**：草稿刚创建，尚未进行合规校验
- **通过**：草稿已通过合规校验，可以发布
- **不通过**：草稿未通过合规校验，需要修改

### API 使用

```bash
# 保存草稿（带合规校验状态）
curl -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "insurance-d",
    "taskId": "task-001",
    "title": "养老保险全面解析",
    "content": "# 内容...",
    "author": "保险科普",
    "status": "draft",
    "complianceStatus": "passed"
  }'
```

## 兼容性

- ✅ 向后兼容：支持读取旧格式文件（没有合规校验状态的文件）
- ✅ 新格式优先：新保存的 insurance-d 草稿包含合规校验状态
- ✅ Agent D 不受影响：Agent D 的草稿格式保持不变

## 使用示例

### 保存 insurance-d 草稿

```bash
curl -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "insurance-d",
    "taskId": "task-001",
    "title": "养老保险全面解析",
    "content": "# 养老保险\n\n内容...",
    "author": "保险科普",
    "status": "draft",
    "complianceStatus": "passed"
  }'
```

### 查看文件

```bash
# insurance-d 的草稿
ls /workspace/projects/insurance-Business/draft-article/insurance-d/
# 输出：task-001_养老保_20260203.md
```

### 查看首行标注

```bash
head -n 1 /workspace/projects/insurance-Business/draft-article/insurance-d/task-001_养老保_20260203.md
# 输出：task-001 养老保险全面解析 2026/02/03 14:30:45 passed
```

### 查看合规校验状态

```bash
head -n 15 /workspace/projects/insurance-Business/draft-article/insurance-d/task-001_养老保_20260203.md | grep complianceStatus
# 输出：complianceStatus: passed
```

## 优势

1. **专业合规**：insurance-d 草稿独立管理合规校验状态，符合保险行业要求
2. **路径规范**：修正了路径大小写，符合保险业务目录规范
3. **状态清晰**：首行标注包含合规校验状态，便于快速识别
4. **灵活管理**：支持三种合规校验状态，满足不同场景需求
5. **完全兼容**：不影响 Agent D 的现有功能，向后兼容

## 后续建议

1. 在 Agent A 的提示词中添加关于 insurance-d 合规校验状态管理的说明
2. 考虑添加合规校验状态的自动流转功能（如：审核通过自动更新状态）
3. 考虑添加合规校验历史记录功能
4. 考虑添加按合规校验状态筛选草稿的功能

## 相关文档

- [insurance-d 草稿存储规范](./INSURANCE_D_DRAFT_SPEC.md)
- [草稿存储功能文档](./DRAFT_STORAGE_README.md)
- [草稿存储使用指南](./DRAFT_STORAGE_USAGE.md)
- [Agent D 草稿存储规范](./AGENT_D_DRAFT_SPEC.md)
- [草稿路径配置说明](./DRAFT_PATH_CONFIG.md)
- [草稿命名规范更新](./DRAFT_NAMING_UPDATE.md)
