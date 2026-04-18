# LLM 关键子任务判断提示词优化说明

## 优化后的提示词结构

### 1. 关键子任务定义

```
关键子任务定义：
- 如果该子任务失败，会导致后续依赖任务无法执行
- 或者该子任务失败，会导致整个任务目标无法实现
```

**核心思想**：基于失败后果判断关键性

---

### 2. 判断标准（四维判断）

#### 维度 1：前置依赖性
```
该子任务是后续其他子任务的前提条件
→ isCritical = true

示例：
- "搭建基础架构" → 后续开发都依赖它 → 关键
- "准备数据集" → 数据分析依赖它 → 关键
```

#### 维度 2：核心功能
```
该子任务是实现目标的核心功能，失败则目标无法实现
→ isCritical = true

示例：
- "开发用户登录" → 电商系统核心功能 → 关键
- "开发商品详情" → 电商系统核心功能 → 关键
- "开发评论功能" → 可选功能 → 非关键
```

#### 维度 3：无替代方案
```
该子任务失败后，没有可用的替代方案
→ isCritical = true

示例：
- "连接数据库" → 没有替代方案 → 关键
- "发送邮件通知" → 可以改用短信通知 → 非关键
```

#### 维度 4：不可延后性
```
该子任务必须现在完成，不能延后到后续迭代
→ isCritical = true

示例：
- "系统安全认证" → 必须现在完成 → 关键
- "个性化推荐" → 可以延后迭代 → 非关键
```

---

### 3. 判断流程

```
第一步：检查前置依赖
  → 如果有后续子任务依赖此任务 → isCritical = true

第二步：检查核心性
  → 如果是实现目标的核心功能 → isCritical = true

第三步：检查替代性
  → 如果失败后无替代方案 → isCritical = true

第四步：检查延后性
  → 如果必须现在完成，不能延后 → isCritical = true

否则 → isCritical = false
```

**优先级**：前置依赖 > 核心功能 > 无替代方案 > 不可延后

---

## 实际业务场景示例

### 场景 1：软件开发项目

**任务**：开发一个电商系统

**子任务拆分**：

```json
[
  {
    "orderIndex": 1,
    "title": "搭建项目基础架构",
    "description": "创建项目框架、配置开发环境、搭建 CI/CD 流程",
    "acceptanceCriteria": "项目可正常运行，开发环境配置完成，CI/CD 流程可用",
    "isCritical": true,
    "criticalReason": "基础架构是所有后续开发的前提，没有架构无法开发任何功能"
  },
  {
    "orderIndex": 2,
    "title": "开发用户登录注册模块",
    "description": "实现用户注册、登录、密码找回功能",
    "acceptanceCriteria": "用户可以注册、登录、找回密码",
    "isCritical": true,
    "criticalReason": "用户认证是电商系统的核心功能，没有认证用户无法使用系统"
  },
  {
    "orderIndex": 3,
    "title": "开发商品管理模块",
    "description": "实现商品列表、详情、搜索、分类功能",
    "acceptanceCriteria": "可以浏览商品、查看详情、搜索商品",
    "isCritical": true,
    "criticalReason": "商品管理是电商系统的核心功能，无法展示商品则系统无法使用"
  },
  {
    "orderIndex": 4,
    "title": "开发订单管理模块",
    "description": "实现购物车、下单、支付、订单查询功能",
    "acceptanceCriteria": "用户可以加购、下单、支付、查询订单",
    "isCritical": true,
    "criticalReason": "订单管理是电商系统的核心功能，无法下单则无法产生收益"
  },
  {
    "orderIndex": 5,
    "title": "开发商品评论模块",
    "description": "实现商品评论、评分、回复功能",
    "acceptanceCriteria": "用户可以发表评论、查看评分",
    "isCritical": false,
    "criticalReason": "评论功能是可选功能，失败不影响核心电商流程"
  },
  {
    "orderIndex": 6,
    "title": "开发个性化推荐模块",
    "description": "基于用户行为实现商品推荐",
    "acceptanceCriteria": "首页展示个性化推荐商品",
    "isCritical": false,
    "criticalReason": "推荐功能可以延后到后续迭代，不影响核心电商功能"
  }
]
```

---

### 场景 2：数据迁移任务

**任务**：迁移 100 万用户数据到新系统

**子任务拆分**：

```json
[
  {
    "orderIndex": 1,
    "title": "创建目标数据库",
    "description": "在新系统中创建数据库和表结构",
    "acceptanceCriteria": "数据库创建完成，表结构与旧系统一致",
    "isCritical": true,
    "criticalReason": "没有数据库无法导入数据，这是数据迁移的前提"
  },
  {
    "orderIndex": 2,
    "title": "导出用户数据",
    "description": "从旧系统导出 100 万用户数据",
    "acceptanceCriteria": "数据导出完成，格式正确，数据完整",
    "isCritical": true,
    "criticalReason": "没有数据无法完成迁移，导出是必要步骤"
  },
  {
    "orderIndex": 3,
    "title": "数据清洗",
    "description": "清洗重复、无效、格式错误的数据",
    "acceptanceCriteria": "数据清洗完成，重复数据已删除，无效数据已标记",
    "isCritical": false,
    "criticalReason": "数据清洗失败不影响迁移，可以导入未清洗的数据并手动修正"
  },
  {
    "orderIndex": 4,
    "title": "导入用户数据",
    "description": "将清洗后的数据导入新系统",
    "acceptanceCriteria": "数据导入完成，数量正确，数据完整",
    "isCritical": true,
    "criticalReason": "数据导入是迁移的核心目标，无法完成则迁移失败"
  },
  {
    "orderIndex": 5,
    "title": "数据验证",
    "description": "验证数据的完整性和准确性",
    "acceptanceCriteria": "验证完成，数据完整性通过，准确性通过",
    "isCritical": false,
    "criticalReason": "验证失败可以手动修正，不影响数据导入的结果"
  },
  {
    "orderIndex": 6,
    "title": "性能优化",
    "description": "优化数据查询性能，添加索引",
    "acceptanceCriteria": "查询性能达标，索引添加完成",
    "isCritical": false,
    "criticalReason": "性能优化可以延后，不影响数据迁移的完成"
  }
]
```

---

### 场景 3：保险内容创作

**任务**：创作 5 篇保险科普文章

**子任务拆分**：

```json
[
  {
    "orderIndex": 1,
    "title": "选题确定",
    "description": "确定 5 篇文章的主题和方向",
    "acceptanceCriteria": "5 个选题确定，符合业务需求，有内容价值",
    "isCritical": true,
    "criticalReason": "选题是文章撰写的前提，没有选题无法开始创作"
  },
  {
    "orderIndex": 2,
    "title": "撰写第 1 篇文章",
    "description": "撰写第 1 篇保险科普文章",
    "acceptanceCriteria": "文章完成，字数 1500-1600 字，内容准确",
    "isCritical": false,
    "criticalReason": "可以减少文章数量，至少完成 1 篇即可"
  },
  {
    "orderIndex": 3,
    "title": "撰写第 2 篇文章",
    "description": "撰写第 2 篇保险科普文章",
    "acceptanceCriteria": "文章完成，字数 1500-1600 字，内容准确",
    "isCritical": false,
    "criticalReason": "可以减少文章数量，不影响整体任务完成"
  },
  {
    "orderIndex": 4,
    "title": "撰写第 3 篇文章",
    "description": "撰写第 3 篇保险科普文章",
    "acceptanceCriteria": "文章完成，字数 1500-1600 字，内容准确",
    "isCritical": false,
    "criticalReason": "可以减少文章数量，不影响整体任务完成"
  },
  {
    "orderIndex": 5,
    "title": "合规审查",
    "description": "对所有文章进行合规审查",
    "acceptanceCriteria": "所有文章通过合规审查，无违规点",
    "isCritical": true,
    "criticalReason": "保险内容必须通过合规审查才能发布，无法通过则任务失败"
  },
  {
    "orderIndex": 6,
    "title": "排版优化",
    "description": "优化文章排版，添加图片、图表",
    "acceptanceCriteria": "排版美观，图片清晰，图表准确",
    "isCritical": false,
    "criticalReason": "排版可以延后，可以先发布后续优化"
  }
]
```

---

## 提示词优化要点

### 1. 清晰的定义

**优化前**：
```
判断哪些子任务是关键的
```

**优化后**：
```
关键子任务定义：
- 如果该子任务失败，会导致后续依赖任务无法执行
- 或者该子任务失败，会导致整个任务目标无法实现
```

### 2. 结构化的判断标准

**优化前**：
```
根据业务逻辑判断
```

**优化后**：
```
判断标准：
1. 前置依赖性：该子任务是后续其他子任务的前提条件 → isCritical = true
2. 核心功能：该子任务是实现目标的核心功能 → isCritical = true
3. 无替代方案：该子任务失败后，没有可用的替代方案 → isCritical = true
4. 不可延后性：该子任务必须现在完成，不能延后到后续迭代 → isCritical = true
```

### 3. 具体的判断流程

**优化前**：
```
请判断是否为关键子任务
```

**优化后**：
```
判断流程：
第一步：检查前置依赖 → 如果有后续子任务依赖此任务 → isCritical = true
第二步：检查核心性 → 如果是实现目标的核心功能 → isCritical = true
第三步：检查替代性 → 如果失败后无替代方案 → isCritical = true
第四步：检查延后性 → 如果必须现在完成，不能延后 → isCritical = true
否则 → isCritical = false
```

### 4. 详细的返回格式

**优化前**：
```json
[
  {
    "title": "步骤标题",
    "description": "步骤描述"
  }
]
```

**优化后**：
```json
[
  {
    "orderIndex": 1,
    "title": "步骤标题",
    "description": "步骤描述",
    "acceptanceCriteria": "验收标准",
    "isCritical": true,
    "criticalReason": "这是基础架构搭建，所有后续开发都依赖于它"
  }
]
```

---

## 数据存储结构

### agentSubTasks 表的 metadata 字段

```json
{
  "acceptanceCriteria": "素材收集完成，整理成文档",
  "isCritical": true,
  "criticalReason": "素材是文章撰写的前提，没有素材无法撰写文章",
  "markedBy": "llm",
  "markedAt": "2025-01-17T10:30:00.000Z"
}
```

### 字段说明

- `acceptanceCriteria`：验收标准（原有字段）
- `isCritical`：是否为关键子任务（新增，boolean）
- `criticalReason`：关键原因（新增，string）
- `markedBy`：标记方式（新增，"llm" | "manual"）
- `markedAt`：标记时间（新增，ISO 8601 格式）

---

## 代码实现

### 1. 类型定义

```typescript
// src/lib/agent-llm.ts

export interface SubTaskSplitResult {
  orderIndex: number;
  title: string;
  description: string;
  acceptanceCriteria: string;
  isCritical: boolean;  // 🔥 新增
  criticalReason: string;  // 🔥 新增
}
```

### 2. 保存逻辑

```typescript
// src/app/api/agents/[id]/subtasks/route.ts

await db.insert(agentSubTasks).values({
  commandResultId,
  agentId,
  taskTitle: subTasks[i].title,
  taskDescription: subTasks[i].description,
  status: 'pending',
  orderIndex: subTasks[i].orderIndex,
  metadata: {
    acceptanceCriteria: subTasks[i].acceptanceCriteria,
    isCritical: subTasks[i].isCritical || false,  // 🔥 保存关键标记
    criticalReason: subTasks[i].criticalReason || '',  // 🔥 保存关键原因
  },
});
```

### 3. 模拟数据

```typescript
// src/lib/agent-llm.ts

const agentSpecificTasks = {
  'insurance-d': [
    {
      orderIndex: 1,
      title: '收集保险素材',
      description: '收集相关的保险产品素材、案例素材、合规素材',
      acceptanceCriteria: '素材收集完成，整理成文档，符合保险事业部规范',
      isCritical: true,
      criticalReason: '素材是文章撰写的前提，没有素材无法撰写文章',
    },
    // ...
  ],
};
```

---

## 测试建议

### 1. 单元测试

```typescript
describe('splitTaskForAgent', () => {
  it('should correctly identify critical subtasks', async () => {
    const result = await splitTaskForAgent('insurance-d', task);

    // 验证关键子任务标记
    const criticalTasks = result.filter(t => t.isCritical);
    expect(criticalTasks.length).toBeGreaterThan(0);

    // 验证关键原因不为空
    criticalTasks.forEach(task => {
      expect(task.criticalReason).toBeTruthy();
      expect(task.criticalReason.length).toBeGreaterThan(0);
    });
  });
});
```

### 2. 集成测试

```bash
# 调用拆分 API
curl -X POST http://localhost:5000/api/agents/B/subtasks \
  -H "Content-Type: application/json" \
  -d '{
    "commandResultId": "xxx",
    "agentId": "B"
  }'

# 查询子任务
SELECT id, task_title, metadata 
FROM agent_sub_tasks 
WHERE command_result_id = 'xxx';

# 验证 metadata.isCritical 是否正确
```

### 3. 手动验证

```sql
-- 查看关键子任务标记
SELECT 
  id, 
  task_title, 
  metadata->>'isCritical' as is_critical,
  metadata->>'criticalReason' as critical_reason
FROM agent_sub_tasks
ORDER BY order_index;
```

---

## 总结

### 提示词优化核心

1. ✅ **明确定义**：基于失败后果定义关键子任务
2. ✅ **结构化标准**：四维判断（依赖、核心、替代、延后）
3. ✅ **清晰流程**：四步判断流程
4. ✅ **详细示例**：多个业务场景示例

### 实现要点

1. ✅ 类型定义更新
2. ✅ 保存逻辑更新
3. ✅ 模拟数据更新
4. ✅ 向后兼容（默认 false）

### 下一步

- ⏳ 实现 `updateSubTaskStatus()` 和 `handleSubTaskFailure()`
- ⏳ 实现关键子任务失败级联逻辑
- ⏳ 测试关键子任务判断功能
