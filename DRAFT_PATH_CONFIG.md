# 草稿存储路径配置说明

## 路径配置

草稿文件根据 Agent ID 存储在不同的目录中：

### Agent D
- **存储路径**: `/workspace/projects/AI-Business/draft-article/agent-d/`
- **用途**: 存储 Agent D 的草稿文章

### insurance-d
- **存储路径**: `/workspace/projects/insurance-Business/draft-article/insurance-d/`
- **用途**: 存储 insurance-d 的草稿文章
- **注意**: "Business" 首字母为大写 B

## 配置实现

### 代码位置
文件路径: `src/lib/services/draft-storage.ts`

```typescript
// 草稿存储根目录 - 保险业务使用独立目录（注意大小写：insurance-Business）
const INSURANCE_DRAFT_ROOT_DIR = '/workspace/projects/insurance-Business/draft-article';
const AI_BUSINESS_DRAFT_ROOT_DIR = process.env.DRAFT_ROOT_DIR || path.join(process.cwd(), 'AI-Business', 'draft-article');

// 确保 Agent 子目录存在
const AGENT_DRAFT_DIRS = {
  'D': path.join(AI_BUSINESS_DRAFT_ROOT_DIR, 'agent-d'),
  'insurance-d': path.join(INSURANCE_DRAFT_ROOT_DIR, 'insurance-d'),
};
```

## 环境变量

可以通过设置 `DRAFT_ROOT_DIR` 环境变量来修改 AI-Business 的草稿根目录：

```bash
export DRAFT_ROOT_DIR=/custom/path/draft-article
```

注意：insurance-d 的路径是固定的，不受环境变量影响。

## 目录结构

```
/workspace/projects/
├── AI-Business/
│   └── draft-article/
│       └── agent-d/
│           ├── task-001_2026-02-03T14-40-23_测试文章.md
│           └── task-002_2026-02-03T15-00-00_另一篇文章.md
└── insurance-business/
    └── draft-article/
        └── insurance-d/
            ├── task-001_2026-02-03T14-40-18_医保文章.md
            └── task-002_2026-02-03T15-00-00_保险产品介绍.md
```

## 前端显示

前端组件会根据 Agent ID 自动显示对应的路径：

- **SaveDraftButton** 组件：保存对话框中显示正确的存储路径
- **DraftListPanel** 组件：面板标题下方显示正确的存储路径

示例：
- insurance-d 页面显示：`/workspace/projects/insurance-business/draft-article/insurance-d/`
- Agent D 页面显示：`/workspace/projects/AI-Business/draft-article/agent-d/`

## 验证方法

### 1. 检查目录是否存在
```bash
ls -la /workspace/projects/AI-Business/draft-article/agent-d/
ls -la /workspace/projects/insurance-business/draft-article/insurance-d/
```

### 2. 通过 API 测试
```bash
# 保存 insurance-d 草稿
curl -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "insurance-d",
    "taskId": "test-001",
    "title": "测试文章",
    "content": "# 测试",
    "author": "保险科普"
  }'

# 保存 Agent D 草稿
curl -X POST http://localhost:5000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "D",
    "taskId": "test-002",
    "title": "测试文章",
    "content": "# 测试",
    "author": "内容主编"
  }'

# 验证文件路径
ls /workspace/projects/insurance-business/draft-article/insurance-d/
ls /workspace/projects/AI-Business/draft-article/agent-d/
```

## 注意事项

1. **权限**: 确保运行应用的用户对这些目录有读写权限
2. **目录创建**: 应用首次保存草稿时会自动创建目录
3. **路径固定**: insurance-d 的路径是固定的，不能通过环境变量修改
4. **子目录**: 每个 Agent 都有自己的子目录，不会互相干扰

## 迁移说明

如果需要迁移现有的草稿文件：

```bash
# 备份现有草稿
cp -r /workspace/projects/AI-Business/draft-article/insurance-d/* /backup/
cp -r /workspace/projects/AI-Business/draft-article/agent-d/* /backup/

# 移动 insurance-d 的草稿到新位置
mv /workspace/projects/AI-Business/draft-article/insurance-d/* /workspace/projects/insurance-business/draft-article/insurance-d/

# 验证
ls -la /workspace/projects/insurance-business/draft-article/insurance-d/
```
