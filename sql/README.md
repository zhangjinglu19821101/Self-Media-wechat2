
# 数据库查询：北京时间格式

## 📁 文件说明

本目录包含两个 SQL 查询文件，帮助你在查询数据库时看到北京时间格式。

### 1. `query-with-beijing-time.sql`
详细的查询示例和说明文档，包含：
- 完整的查询示例
- 视图（View）创建语句
- 时间转换说明
- 各种场景的查询示例

### 2. `quick-queries.sql`
简化的日常使用查询，包含：
- 快速查询最新任务
- 查询今日任务
- 查询正在执行的任务
- 查询执行历史
- 查看当前北京时间

## 🚀 快速开始

### 查询最新 20 条子任务（北京时间）
```sql
SELECT 
    id,
    task_id,
    from_agent_id,
    to_agent_id,
    status,
    order_index,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at,
    (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS completed_at,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at,
    subtask_type,
    SUBSTRING(description, 1, 50) AS description
FROM agent_sub_tasks
ORDER BY created_at DESC
LIMIT 20;
```

### 查看当前北京时间
```sql
SELECT (NOW() AT TIME ZONE 'Asia/Shanghai') AS current_beijing_time;
```

### 查询正在执行的任务
```sql
SELECT 
    id,
    task_id,
    status,
    order_index,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60, 1) AS execution_minutes,
    SUBSTRING(description, 1, 50) AS description
FROM agent_sub_tasks
WHERE status = 'in_progress'
ORDER BY started_at;
```

## 💡 时间转换说明

### PostgreSQL 时间转换语法
```sql
(timestamp_column AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')
```

**含义：**
1. 首先告诉 PostgreSQL，这个 timestamp 是 UTC 时间
2. 然后将其转换为 'Asia/Shanghai' 时区（北京时间，UTC+8）

### 常用时区名称
- `'UTC'` - 协调世界时
- `'Asia/Shanghai'` - 北京时间（UTC+8）
- `'Asia/Hong_Kong'` - 香港时间
- `'Asia/Tokyo'` - 东京时间

## 📊 对比示例

| 原始 UTC 时间 | 北京时间（转换后） |
|--------------|------------------|
| 2026-03-01 14:00:00 UTC | 2026-03-01 22:00:00 |
| 2026-03-01 06:00:00 UTC | 2026-03-01 14:00:00 |
| 2026-03-01 20:00:00 UTC | 2026-03-02 04:00:00 |

## 🔧 进阶用法：创建视图

如果你想永久使用北京时间视图，可以执行以下语句：

```sql
CREATE OR REPLACE VIEW agent_sub_tasks_with_beijing_time AS
SELECT 
    id,
    task_id,
    from_agent_id,
    to_agent_id,
    executor,
    status,
    order_index,
    (started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS started_at,
    (completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS completed_at,
    (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS created_at,
    (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai') AS updated_at,
    subtask_type,
    description,
    metadata
FROM agent_sub_tasks;
```

然后就可以直接使用视图查询：
```sql
SELECT * FROM agent_sub_tasks_with_beijing_time ORDER BY created_at DESC LIMIT 20;
```

## 📝 提示

- 两个 SQL 文件中的查询都可以直接复制到你的数据库查询工具中执行
- 建议先从 `quick-queries.sql` 开始，日常使用最方便
- 需要了解更多细节时，查看 `query-with-beijing-time.sql`

