# 草稿存储功能文档

## 概述

为 Agent D 和 insurance-d 提供本地文件系统存储能力，用于存放未审核的草稿文章。

## 功能特性

- 基于 Markdown 格式，包含 YAML frontmatter 元数据
- 支持按 Agent ID 分目录存储
- 提供完整的 CRUD API
- 前端提供草稿列表和保存功能

## 存储路径

草稿文件存储在以下本地文件系统路径：

- **Agent D**: `/workspace/projects/AI-Business/draft-article/agent-d/`
- **insurance-d**: `/workspace/projects/insurance-Business/draft-article/insurance-d/`（注意：Business 首字母大写）

## 文件命名规则

```
【任务ID】_【文章标题简名（2-4字）】_【创作日期XXXXXX】.md
```

格式说明：
- **任务ID**：关联的任务 ID，如 `task-001`、`insurance-d-001`
- **文章标题简名**：文章标题的 2-4 字简写，不包含特殊字符
- **创作日期**：格式为 `YYYYMMDD`，如 `20260203`
- **文件扩展名**：统一使用 `.md` 格式

示例：
```
task-001_医保报_20260203.md
insurance-d-001_养老险_20260203.md
```

## 文件首行标注

每个草稿文件的首行都会自动添加以下标注：
```
任务ID + 完整文章标题 + 创作完成时间
```

示例：
```
task-001 普通人必懂的医保报销误区 2026/02/03 14:30:45
```

## API 接口

### 1. 保存草稿

**请求**
```
POST /api/drafts
```

**请求体**
```json
{
  "agentId": "insurance-d",
  "taskId": "test-task-001",
  "title": "测试文章：普通人必懂的医保报销误区",
  "content": "# 普通人必懂的医保报销误区\n\n## 误区一：...",
  "author": "保险科普",
  "status": "draft",
  "metadata": {
    "savedFrom": "chat"
  }
}
```

**响应**
```json
{
  "success": true,
  "message": "草稿保存成功",
  "data": {
    "fileName": "test-task-001_2026-02-03T14-34-33_测试文章：普通人必懂的医保报销误区.md",
    "filePath": "/workspace/projects/insurance-business/draft-article/insurance-d/test-task-001_2026-02-03T14-34-33_测试文章：普通人必懂的医保报销误区.md",
    "agentId": "insurance-d",
    "taskId": "test-task-001",
    "title": "测试文章：普通人必懂的医保报销误区",
    "author": "保险科普",
    "status": "draft",
    "createdAt": "2026-02-03T14:34:33.636Z",
    "updatedAt": "2026-02-03T14:34:33.636Z"
  }
}
```

### 2. 获取草稿列表

**请求**
```
GET /api/drafts?agentId=insurance-d
```

**响应**
```json
{
  "success": true,
  "data": {
    "agentId": "insurance-d",
    "total": 1,
    "drafts": [
      {
        "fileName": "test-task-001_2026-02-03T14-34-33_测试文章：普通人必懂的医保报销误区.md",
        "title": "测试文章：普通人必懂的医保报销误区",
        "author": "保险科普",
        "status": "draft",
        "createdAt": "2026-02-03T14:34:33.636Z",
        "updatedAt": "2026-02-03T14:34:33.636Z",
        "taskId": "test-task-001",
        "preview": "\n# 普通人必懂的医保报销误区\n\n## 误区一：..."
      }
    ]
  }
}
```

### 3. 读取单个草稿

**请求**
```
GET /api/drafts/{fileName}?agentId=insurance-d
```

**响应**
```json
{
  "success": true,
  "data": {
    "agentId": "insurance-d",
    "taskId": "test-task-001",
    "title": "测试文章：普通人必懂的医保报销误区",
    "author": "保险科普",
    "createdAt": "2026-02-03T14:34:33.636Z",
    "updatedAt": "2026-02-03T14:34:33.636Z",
    "status": "draft",
    "content": "\n# 普通人必懂的医保报销误区\n\n## 误区一：医保可以报销所有医疗费用..."
  }
}
```

### 4. 删除草稿

**请求**
```
DELETE /api/drafts/{fileName}?agentId=insurance-d
```

**响应**
```json
{
  "success": true,
  "message": "草稿已成功删除"
}
```

## 前端组件

### SaveDraftButton

保存草稿按钮组件，允许用户将对话中的文章内容保存为草稿。

**Props**
- `agentId`: Agent ID ('D' | 'insurance-d')
- `initialContent`: 初始内容（可选）
- `initialTitle`: 初始标题（可选）
- `taskId`: 任务 ID（可选）
- `onSaveSuccess`: 保存成功回调（可选）

**使用示例**
```tsx
import { SaveDraftButton } from '@/components/save-draft-button';

<SaveDraftButton
  agentId="insurance-d"
  initialContent={input}
  initialTitle="测试文章"
  taskId="test-task-001"
  onSaveSuccess={(filePath) => console.log('已保存到:', filePath)}
/>
```

### DraftListPanel

草稿列表面板组件，显示指定 Agent 的所有草稿文件。

**Props**
- `agentId`: Agent ID ('D' | 'insurance-d')

**使用示例**
```tsx
import { DraftListPanel } from '@/components/draft-list-panel';

<DraftListPanel agentId="insurance-d" />
```

**功能**
- 显示所有草稿列表
- 支持状态过滤（草稿、审核中、已通过、已驳回）
- 查看草稿详情
- 删除草稿
- 自动刷新（每 60 秒）

## 集成位置

- Agent D 和 insurance-d 的页面会自动显示"本地草稿箱"面板
- Agent D 和 insurance-d 的聊天输入框右侧会显示"保存为草稿"按钮
- 其他 Agent 页面不显示草稿相关功能

## 状态说明

草稿支持以下状态：

- `draft`: 草稿
- `reviewing`: 审核中
- `approved`: 已通过
- `rejected`: 已驳回

## 元数据字段

每个草稿文件包含以下元数据：

- `agentId`: Agent ID
- `taskId`: 关联的任务 ID（如果有）
- `title`: 文章标题
- `author`: 作者
- `status`: 状态
- `createdAt`: 创建时间
- `updatedAt`: 更新时间
- `metadata`: 额外元数据（JSON 格式）

## 注意事项

1. 文件名中的特殊字符会被移除，空格会被替换为下划线
2. 文件名中的 `:` 会被替换为 `-`
3. 支持的 Agent ID 只有 `D` 和 `insurance-d`
4. 删除草稿是不可逆操作，请谨慎使用
5. 草稿内容支持 Markdown 格式

## 测试

可以使用以下命令测试 API：

```bash
# 保存草稿
curl -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "insurance-d",
    "taskId": "test-001",
    "title": "测试文章",
    "content": "# 测试\n\n这是测试内容",
    "author": "保险科普",
    "status": "draft"
  }'

# 获取草稿列表
curl http://localhost:5000/api/drafts?agentId=insurance-d

# 读取单个草稿
curl "http://localhost:5000/api/drafts/test-001_2026-02-03T14-34-33_测试文章.md?agentId=insurance-d"

# 删除草稿
curl -X DELETE "http://localhost:5000/api/drafts/test-001_2026-02-03T14-34-33_测试文章.md?agentId=insurance-d"
```
