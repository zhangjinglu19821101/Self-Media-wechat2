# 数据库查询工具使用指南

一个灵活的命令行工具，用于查询 `daily_tasks` (insurance-d) 和 `agent_sub_tasks` 表数据。

## 快速开始

### 方式一：交互式模式（推荐新手）

直接运行脚本，通过问答方式输入查询条件：

```bash
node scripts/query-db.js
```

系统会引导您完成：
1. 选择要查询的表
2. 输入查询条件
3. 选择要展示的字段
4. 设置返回记录数量
5. 选择输出格式

### 方式二：命令行模式（推荐熟练用户）

直接通过命令行参数传入查询条件：

```bash
node scripts/query-db.js --table insurance-d --executor insurance-d
```

## 命令行参数说明

### 基础参数

| 参数 | 说明 | 适用表 | 示例 |
|------|------|--------|------|
| `--table` | 表名 | 必填 | `insurance-d` 或 `agent-sub-tasks` |
| `--limit` | 返回记录数量 | 通用 | `--limit 100` (默认 50) |
| `--format` | 输出格式 | 通用 | `--format table` / `json` / `csv` |
| `--fields` | 字段列表 | 通用 | `--fields id,task_title,executor` |

### insurance-d 表查询参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--executor` | 执行Agent | `--executor insurance-d` |
| `--task-id` | 任务ID（支持模糊匹配） | `--task-id insurance-d` |
| `--execution-status` | 执行状态 | `--execution-status pending` |
| `--start-time` | 开始时间 | `--start-time 2026-02-01` |
| `--end-time` | 结束时间 | `--end-time 2026-02-28` |

### agent-sub-tasks 表查询参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--agent-id` | Agent ID | `--agent-id insurance-d` |
| `--command-result-id` | Command Result ID（支持模糊匹配） | `--command-result-id task-A` |
| `--status` | 状态 | `--status pending` |
| `--start-time` | 开始时间 | `--start-time 2026-02-01` |
| `--end-time` | 结束时间 | `--end-time 2026-02-28` |

## 使用示例

### 示例 1: 查询 insurance-d 表中所有记录

```bash
node scripts/query-db.js --table insurance-d --limit 10
```

### 示例 2: 查询特定 executor 的记录

```bash
node scripts/query-db.js --table insurance-d --executor insurance-d
```

### 示例 3: 查询特定状态的记录

```bash
node scripts/query-db.js --table insurance-d --execution-status pending --limit 20
```

### 示例 4: 查询指定时间范围内的记录

```bash
node scripts/query-db.js --table insurance-d \
  --start-time 2026-02-01 \
  --end-time 2026-02-28 \
  --format json
```

### 示例 5: 查询 agent-sub-tasks 表

```bash
node scripts/query-db.js --table agent-sub-tasks --agent-id insurance-d
```

### 示例 6: 只返回特定字段

```bash
node scripts/query-db.js --table insurance-d \
  --executor insurance-d \
  --fields task_id,task_title,execution_status,created_at
```

### 示例 7: 导出为 CSV 格式

```bash
node scripts/query-db.js --table insurance-d \
  --executor insurance-d \
  --format csv > insurance-d-tasks.csv
```

### 示例 8: 模糊搜索任务ID

```bash
node scripts/query-db.js --table insurance-d \
  --task-id insurance-d-2026 \
  --limit 20
```

### 示例 9: 多条件组合查询

```bash
node scripts/query-db.js --table insurance-d \
  --executor insurance-d \
  --execution-status pending \
  --start-time 2026-02-01 \
  --end-time 2026-02-15 \
  --limit 30
```

### 示例 10: 查询 completed 状态的子任务

```bash
node scripts/query-db.js --table agent-sub-tasks \
  --status completed \
  --fields id,task_title,agent_id,created_at \
  --format table
```

## 可用字段列表

### insurance-d 表 (daily_tasks)

| 字段名 | 说明 |
|--------|------|
| `id` | 记录 ID |
| `task_id` | 任务ID |
| `task_title` | 任务标题 |
| `task_description` | 任务描述 |
| `executor` | 执行Agent |
| `execution_status` | 执行状态 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

### agent-sub-tasks 表

| 字段名 | 说明 |
|--------|------|
| `id` | 记录 ID |
| `command_result_id` | Command Result ID |
| `agent_id` | Agent ID |
| `task_title` | 任务标题 |
| `task_description` | 任务描述 |
| `status` | 状态 |
| `order_index` | 顺序 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

## 输出格式

### table（默认）
以表格形式展示数据，适合终端查看：

```
+----+-----------------------------+---------------------+
| ID | 任务标题                    | 执行Agent           |
+----+-----------------------------+---------------------+
| 1  | 第5天：成果验收申请提交    | insurance-d         |
+----+-----------------------------+---------------------+
```

### json
以 JSON 格式输出，适合程序处理：

```json
[
  {
    "id": "431d3d18-2c5b-493f-b81a-9a06acdf41b3",
    "task_title": "第5天：成果验收申请提交",
    "executor": "insurance-d",
    "created_at": "2026-02-13T04:37:49.189Z"
  }
]
```

### csv
以 CSV 格式输出，适合导入 Excel 或其他工具：

```csv
ID,任务标题,执行Agent,创建时间
"431d3d18-2c5b-493f-b81a-9a06acdf41b3","第5天：成果验收申请提交","insurance-d","2026-02-13T04:37:49.189Z"
```

## 注意事项

1. **数据库连接**：脚本已内置数据库连接信息，可以直接使用
2. **时间格式**：时间参数使用 `YYYY-MM-DD` 格式
3. **模糊匹配**：`task-id` 和 `command-result-id` 支持模糊匹配
4. **字段选择**：使用 `--fields` 时，字段名用逗号分隔，不要有空格
5. **导出文件**：使用 `>` 符号可以将输出重定向到文件

## 获取帮助

```bash
node scripts/query-db.js --help
```

## 常见问题

### Q: 如何查询所有记录？
```bash
node scripts/query-db.js --table insurance-d
```

### Q: 如何导出数据到 Excel？
```bash
# 先导出为 CSV
node scripts/query-db.js --table insurance-d --format csv > data.csv

# 然后用 Excel 打开 data.csv
```

### Q: 如何查询多个条件？
```bash
node scripts/query-db.js --table insurance-d \
  --executor insurance-d \
  --execution-status pending \
  --start-time 2026-02-01
```

### Q: 如何只返回前10条记录？
```bash
node scripts/query-db.js --table insurance-d --limit 10
```

## 技术支持

如有问题，请检查：
1. Node.js 是否已安装（建议 v14+）
2. 网络连接是否正常
3. 数据库连接信息是否正确
