# 草稿存储功能使用指南

## 场景示例

### 场景 1：Agent insurance-d 撰写文章并保存草稿

1. 用户向 Agent insurance-d 发送指令：

```
请帮我写一篇关于"普通人必懂的医保报销误区"的文章，目标读者是普通上班族，字数在 1000 字左右。
```

2. Agent insurance-d 生成文章后，用户点击输入框右侧的"保存为草稿"按钮

3. 在弹出的对话框中：
   - 确认或修改标题
   - 确认或修改作者
   - 选择状态（默认为"草稿"）
   - 确认内容
   - 点击"保存"

4. 系统提示保存成功，并显示文件路径

5. 草稿会自动显示在页面下方的"本地草稿箱"面板中

### 场景 2：查看和管理草稿

1. 在 Agent D 或 insurance-d 页面，滚动到页面底部的"本地草稿箱"面板

2. 默认显示所有草稿，可以通过标签页过滤：
   - 全部
   - 草稿
   - 审核中
   - 已通过
   - 已驳回

3. 点击"查看详情"按钮可以查看完整内容

4. 点击"删除"按钮可以删除草稿（会有确认提示）

5. 点击右上角的刷新按钮可以手动刷新草稿列表（系统每 60 秒自动刷新）

### 场景 3：草稿审核流程

#### 步骤 1：Agent D/insurance-d 保存草稿

- Agent D 完成初稿后，保存为草稿，状态选择"草稿"
  - 文件存储在 `/workspace/projects/AI-Business/draft-article/agent-d/` 目录下
- insurance-d 完成初稿后，保存为草稿，状态选择"草稿"
  - 文件存储在 `/workspace/projects/insurance-business/draft-article/insurance-d/` 目录下

#### 步骤 2：提交审核

- Agent D 在草稿列表中，打开对应草稿的详情
- 将草稿内容复制到对话框中，或者直接在编辑器中修改
- 将状态改为"审核中"
- 通过对话通知 Agent A 进行审核

#### 步骤 3：Agent A 审核

- Agent A 可以通过以下方式查看草稿：
  1. 直接访问本地文件系统路径
  2. 通过 API 读取草稿内容
  3. Agent D 通过对话将草稿内容发送给 Agent A

- Agent A 审核后，提供反馈：
  - 如果通过：状态改为"已通过"
  - 如果需要修改：状态改为"已驳回"，并提供修改意见

#### 步骤 4：根据反馈修改

- Agent D 根据反馈修改草稿
- 重新保存为草稿，或者将状态改为"审核中"

## API 调用示例

### 1. 通过脚本批量保存草稿

```typescript
const drafts = [
  {
    agentId: 'insurance-d',
    taskId: 'task-001',
    title: '医保报销误区一',
    content: '# 误区一\n\n...',
    author: '保险科普',
    status: 'draft',
  },
  {
    agentId: 'insurance-d',
    taskId: 'task-002',
    title: '医保报销误区二',
    content: '# 误区二\n\n...',
    author: '保险科普',
    status: 'draft',
  },
];

for (const draft of drafts) {
  const response = await fetch('/api/drafts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(draft),
  });

  const data = await response.json();
  console.log('保存成功:', data.data.filePath);
}
```

### 2. 获取所有草稿并导出为 JSON

```typescript
async function exportDrafts(agentId: string) {
  const response = await fetch(`/api/drafts?agentId=${agentId}`);
  const data = await response.json();

  if (data.success) {
    console.log(`总共 ${data.data.total} 个草稿`);
    data.data.drafts.forEach((draft: any) => {
      console.log(`- ${draft.title} (${draft.status})`);
    });
  }
}

// 使用
exportDrafts('insurance-d');
```

### 3. 读取特定草稿的完整内容

```typescript
async function readDraftContent(fileName: string, agentId: string) {
  const response = await fetch(
    `/api/drafts/${encodeURIComponent(fileName)}?agentId=${agentId}`
  );
  const data = await response.json();

  if (data.success) {
    console.log('标题:', data.data.title);
    console.log('作者:', data.data.author);
    console.log('内容:', data.data.content);
    console.log('创建时间:', new Date(data.data.createdAt).toLocaleString('zh-CN'));
  }
}

// 使用
readDraftContent(
  'task-001_2026-02-03T14-34-33_测试文章.md',
  'insurance-d'
);
```

### 4. 清理所有草稿

```typescript
async function clearAllDrafts(agentId: string) {
  const response = await fetch(`/api/drafts?agentId=${agentId}`);
  const data = await response.json();

  if (data.success && data.data.drafts.length > 0) {
    const confirmDelete = confirm(
      `确定要删除所有 ${data.data.drafts.length} 个草稿吗？`
    );

    if (confirmDelete) {
      for (const draft of data.data.drafts) {
        await fetch(
          `/api/drafts/${encodeURIComponent(draft.fileName)}?agentId=${agentId}`,
          { method: 'DELETE' }
        );
      }
      alert('所有草稿已删除');
    }
  }
}

// 使用
clearAllDrafts('insurance-d');
```

## 前端集成示例

### 在自定义组件中使用保存草稿按钮

```tsx
'use client';

import { SaveDraftButton } from '@/components/save-draft-button';

export function ArticleEditor() {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="文章标题"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="文章内容"
        rows={10}
      />

      <div className="flex gap-2 mt-4">
        <SaveDraftButton
          agentId="insurance-d"
          initialContent={content}
          initialTitle={title}
          taskId={`custom-${Date.now()}`}
          onSaveSuccess={(filePath) => {
            console.log('已保存到:', filePath);
            alert('保存成功！');
          }}
        />
      </div>
    </div>
  );
}
```

### 在自定义组件中使用草稿列表

```tsx
'use client';

import { DraftListPanel } from '@/components/draft-list-panel';

export function DraftManagement() {
  return (
    <div>
      <h1>草稿管理</h1>

      <DraftListPanel agentId="insurance-d" />
    </div>
  );
}
```

## 最佳实践

### 1. 草稿命名规范

- 使用描述性的标题
- 避免使用特殊字符
- 标题长度建议在 20-50 字符之间

### 2. 任务 ID 管理

- 如果草稿与特定任务关联，务必提供 `taskId`
- 任务 ID 应该是唯一且可追溯的
- 示例：`task-20260203-001`、`insurance-d-001`

### 3. 状态管理

- 新创建的草稿默认使用 `draft` 状态
- 提交审核时改为 `reviewing`
- 审核通过后改为 `approved`
- 审核不通过改为 `rejected`

### 4. 内容格式

- 使用标准的 Markdown 格式
- 包含适当的标题层级（H1-H6）
- 添加适当的段落分隔
- 支持列表、代码块等 Markdown 特性

### 5. 作者信息

- 使用有意义的作者名称
- 示例：`保险科普`、`内容主编`、`Agent D`

## 故障排查

### 问题 1：保存草稿失败

**可能原因**
- 目录不存在或没有写权限
- 文件名包含非法字符
- 内容格式不正确

**解决方案**
- 检查 Agent D 的目录 `/workspace/projects/AI-Business/draft-article/agent-d/` 是否存在
- 检查 insurance-d 的目录 `/workspace/projects/insurance-business/draft-article/insurance-d/` 是否存在
- 检查目录权限
- 确保标题中不包含特殊字符

### 问题 2：草稿列表为空

**可能原因**
- 草稿目录为空
- Agent ID 不正确
- API 请求失败

**解决方案**
- 检查本地文件系统目录是否真的有文件
- 确认 Agent ID 是否正确（`D` 或 `insurance-d`）
- 检查浏览器控制台的错误信息

### 问题 3：无法删除草稿

**可能原因**
- 文件被其他进程占用
- 没有删除权限

**解决方案**
- 检查文件是否被打开
- 检查文件权限
- 手动删除文件后刷新列表

## 扩展功能建议

1. **草稿版本控制**
   - 为每个草稿维护多个版本
   - 支持版本回溯

2. **草稿评论**
   - 允许多个 Agent 对草稿添加评论
   - 支持评论回复

3. **草稿标签**
   - 为草稿添加标签
   - 支持按标签筛选

4. **草稿搜索**
   - 按标题搜索
   - 按内容搜索
   - 按日期范围搜索

5. **草稿导出**
   - 导出为 PDF
   - 导出为 Word 文档
   - 批量导出

6. **草稿模板**
   - 创建草稿模板
   - 基于模板创建新草稿
