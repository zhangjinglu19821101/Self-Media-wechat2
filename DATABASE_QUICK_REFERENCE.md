# 🗄️ 数据库查询快速参考

## 📦 已安装工具

PostgreSQL 客户端 (psql) 已成功安装！

---

## 🚀 快速使用

### 方法 1：使用便捷脚本（推荐）

```bash
# 查看帮助
./db.sh help

# 查看所有表
./db.sh tables

# 查看表结构
./db.sh table capability_list

# 查询表数据（默认10行）
./db.sh query capability_list

# 查询表数据（指定行数）
./db.sh query capability_list 20

# 查看表记录数
./db.sh count capability_list

# 执行自定义 SQL
./db.sh "SELECT * FROM capability_list ORDER BY id;"

# 进入交互式模式
./db.sh
```

### 方法 2：直接使用 psql

```bash
# 进入交互式模式
./psql.sh

# 执行单条 SQL
./psql.sh "SELECT * FROM capability_list;"
```

---

## 📋 常用命令参考

### 在交互式 psql 中

| 命令 | 说明 |
|------|------|
| `\dt` | 查看所有表 |
| `\d 表名` | 查看表结构 |
| `\q` | 退出 |
| `\?` | 查看帮助 |
| `\h` | 查看 SQL 帮助 |

### 常用 SQL 查询

```sql
-- 查询所有表
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- 查询表结构
\d table_name;

-- 查询前 N 行
SELECT * FROM table_name LIMIT 10;

-- 统计记录数
SELECT COUNT(*) FROM table_name;

-- 按条件查询
SELECT * FROM table_name WHERE column = 'value' LIMIT 20;

-- 排序查询
SELECT * FROM table_name ORDER BY created_at DESC LIMIT 10;
```

---

## 📊 主要数据表

| 表名 | 说明 |
|------|------|
| `daily_tasks` | 日常任务表 |
| `agent_sub_tasks` | Agent 子任务表 |
| `agent_sub_tasks_step_history` | 子任务步骤交互历史 |
| `agent_reports` | Agent 上报报告表 |
| `agent_notifications` | Agent 通知表 |
| `capability_list` | MCP 能力清单表（新） |
| `conversations` | 对话会话表 |
| `messages` | 对话消息表 |

---

## 💡 常用查询示例

```bash
# 查看 capability_list 表（新创建的能力清单表）
./db.sh query capability_list

# 查看最新的 daily_tasks
./db.sh "SELECT * FROM daily_tasks ORDER BY created_at DESC LIMIT 5;"

# 查看子任务状态
./db.sh "SELECT id, task_title, status, order_index FROM agent_sub_tasks ORDER BY created_at DESC LIMIT 10;"

# 查看通知
./db.sh "SELECT * FROM agent_notifications ORDER BY created_at DESC LIMIT 5;"

# 查看上报报告
./db.sh "SELECT id, report_type, status, created_at FROM agent_reports ORDER BY created_at DESC LIMIT 5;"
```

---

## 🔧 故障排除

如果遇到连接问题，请检查：
1. 网络连接正常
2. 数据库 URL 正确
3. SSL 配置正确

---

## 📝 提示

- 使用 `./db.sh help` 随时查看帮助
- 所有查询都支持颜色输出，便于阅读
- 交互式模式支持上下箭头查看历史命令
