# 数据库查询工具 - 快速开始

一个简单的 Node.js 命令行工具，用于查询 `daily_task` 和 `agent_sub_tasks` 表数据。

## 环境要求

- Node.js (推荐 v14+)

## 快速使用

### 方式一：交互式模式（推荐新手）

```bash
node scripts/query-db.js
```

然后按照提示选择表、输入查询条件、选择字段等。

### 方式二：命令行模式（推荐熟练用户）

```bash
# 查询 insurance-d 表
node scripts/query-db.js --table insurance-d --executor insurance-d --limit 10

# 查询 agent_sub_tasks 表
node scripts/query-db.js --table agent-sub-tasks --agent-id insurance-d

# 指定字段和格式
node scripts/query-db.js --table insurance-d \
  --executor insurance-d \
  --fields id,task_title,executor \
  --format json

# 导出为 CSV
node scripts/query-db.js --table insurance-d \
  --executor insurance-d \
  --format csv > output.csv
```

## 常用参数

| 参数 | 说明 |
|------|------|
| `--table` | 表名：`insurance-d` 或 `agent-sub-tasks` |
| `--executor` | 执行 Agent（insurance-d 表） |
| `--agent-id` | Agent ID（agent-sub-tasks 表） |
| `--task-id` | 任务 ID（支持模糊匹配） |
| `--execution-status` | 执行状态 |
| `--status` | 状态 |
| `--start-time` | 开始时间（格式：2026-02-01） |
| `--end-time` | 结束时间（格式：2026-02-28） |
| `--limit` | 返回记录数量（默认 50） |
| `--fields` | 字段列表（逗号分隔） |
| `--format` | 输出格式：`table`/`json`/`csv` |
| `--help` | 显示帮助信息 |

## 完整文档

详细使用说明请查看：[docs/query-db-usage.md](docs/query-db-usage.md)

## 示例

```bash
# 查询 insurance-d 表中所有记录
node scripts/query-db.js --table insurance-d

# 查询特定状态的记录
node scripts/query-db.js --table insurance-d --execution-status pending

# 查询指定时间范围内的记录
node scripts/query-db.js --table insurance-d \
  --start-time 2026-02-01 \
  --end-time 2026-02-28

# 只返回部分字段
node scripts/query-db.js --table insurance-d \
  --executor insurance-d \
  --fields task_id,task_title,execution_status
```

## 注意事项

- 数据库连接信息已内置，可直接使用
- 时间格式使用 `YYYY-MM-DD`
- 支持任务 ID 模糊匹配
- 使用 `--fields` 时，字段名用逗号分隔，不要有空格
