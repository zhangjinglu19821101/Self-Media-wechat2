# 每日自动提交脚本使用说明

## 概述

为了防止代码意外丢失，系统提供了每日自动提交脚本，可以在每天退出时自动将代码提交到 Git。

---

## 快速开始

### 1. 设置定时任务（一键设置）

```bash
bash /workspace/projects/scripts/setup-auto-commit.sh
```

执行后，系统会自动：
- ✅ 检查脚本文件是否存在
- ✅ 检查脚本权限
- ✅ 添加定时任务到 crontab

### 2. 验证定时任务

```bash
# 查看所有定时任务
crontab -l

# 应该看到类似这样的输出：
# 59 23 * * * /workspace/projects/scripts/auto-commit.sh
```

---

## 手动执行

如果你想立即执行一次代码提交（测试脚本）：

```bash
bash /workspace/projects/scripts/auto-commit.sh
```

执行后，查看日志：

```bash
tail -20 /workspace/projects/.coze-logs/auto-commit.log
```

---

## 定时任务说明

### 默认配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 执行时间 | 每天 23:59 | 退出前执行 |
| 执行频率 | 每天一次 | 自动检测代码修改 |
| 脚本位置 | `/workspace/projects/scripts/auto-commit.sh` | 自动提交脚本 |
| 日志位置 | `/workspace/projects/.coze-logs/auto-commit.log` | 执行日志 |

### 自定义执行时间

如果你想修改执行时间，可以手动编辑 crontab：

```bash
crontab -e
```

找到这行：
```
59 23 * * * /workspace/projects/scripts/auto-commit.sh
```

修改时间（格式：`分 时 日 月 周`）：

```bash
# 示例 1：每天 12:00 执行
0 12 * * * /workspace/projects/scripts/auto-commit.sh

# 示例 2：每 6 小时执行一次
0 */6 * * * /workspace/projects/scripts/auto-commit.sh

# 示例 3：每小时执行一次
0 * * * * /workspace/projects/scripts/auto-commit.sh

# 示例 4：工作日下班前（周一至周五 18:00）
0 18 * * 1-5 /workspace/projects/scripts/auto-commit.sh
```

保存后，定时任务自动生效。

---

## 删除定时任务

如果不需要自动提交功能：

```bash
crontab -e
```

删除这一行：
```
59 23 * * * /workspace/projects/scripts/auto-commit.sh
```

或者使用命令删除：

```bash
# 临时禁用所有定时任务
crontab -r

# ⚠️ 警告：这会删除所有定时任务！
```

---

## 查看执行日志

每次执行都会生成日志：

```bash
# 查看完整日志
cat /workspace/projects/.coze-logs/auto-commit.log

# 查看最近 20 行
tail -20 /workspace/projects/.coze-logs/auto-commit.log

# 实时监控日志
tail -f /workspace/projects/.coze-logs/auto-commit.log
```

### 日志示例

```
========================================
[2025-02-01 23:59:01] 开始执行自动提交脚本
[2025-02-01 23:59:01] 检测到代码修改，开始提交...
[2025-02-01 23:59:01] 修改的文件：
 M src/lib/agent-prompts.ts
 M src/lib/plugin-system.ts
[2025-02-01 23:59:02] 代码提交成功
[2025-02-01 23:59:02] 最新提交：
3b0877d feat: 实现插件系统架构，明确运营能力分类
[2025-02-01 23:59:02] 脚本执行完成
```

---

## 脚本功能说明

### 自动提交脚本（auto-commit.sh）

**功能**：
1. 检查工作目录是否有修改
2. 如果有修改，自动添加所有文件到 Git
3. 生成包含日期时间和修改摘要的提交信息
4. 提交代码到 Git
5. 记录执行日志

**执行逻辑**：
```
开始
  ↓
检查 Git 状态
  ↓
有修改？
  ├─ 是 → 添加文件 → 生成提交信息 → 提交 → 记录日志 → 完成
  └─ 否 → 记录"无修改" → 完成
```

**提交信息格式**：
```
chore: 每日自动提交 - 2025-02-01

修改摘要：
 6 files changed, 123 insertions(+), 45 deletions(-)
```

---

## 注意事项

### 1. 权限问题

确保脚本有执行权限：

```bash
chmod +x /workspace/projects/scripts/auto-commit.sh
chmod +x /workspace/projects/scripts/setup-auto-commit.sh
```

### 2. Git 配置

确保 Git 已配置用户信息：

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 3. 日志文件管理

日志文件会无限增长，建议定期清理：

```bash
# 清空日志
> /workspace/projects/.coze-logs/auto-commit.log

# 或者保留最近 7 天的日志
find /workspace/projects/.coze-logs -name "*.log" -mtime +7 -delete
```

### 4. 多次提交

如果一天内执行多次脚本，会产生多个提交，每个提交的日期时间不同。

---

## 故障排除

### 问题 1：定时任务没有执行

**检查方法**：
```bash
# 查看定时任务是否存在
crontab -l

# 查看系统日志
tail -100 /var/log/syslog | grep CRON
```

**解决方案**：
1. 确认定时任务已设置
2. 确认脚本路径正确
3. 检查脚本是否有执行权限

### 问题 2：脚本执行失败

**检查方法**：
```bash
# 查看执行日志
tail -20 /workspace/projects/.coze-logs/auto-commit.log

# 手动执行脚本，查看错误
bash /workspace/projects/scripts/auto-commit.sh
```

**解决方案**：
1. 检查 Git 仓库是否正常
2. 检查是否有权限问题
3. 查看日志中的错误信息

### 问题 3：提交信息格式异常

**原因**：Git 配置或系统 locale 问题

**解决方案**：
```bash
# 设置系统 locale
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 添加到 ~/.bashrc
echo 'export LANG=en_US.UTF-8' >> ~/.bashrc
echo 'export LC_ALL=en_US.UTF-8' >> ~/.bashrc
```

---

## 高级用法

### 自定义提交信息模板

编辑 `scripts/auto-commit.sh`，找到这一行：

```bash
COMMIT_MSG="chore: 每日自动提交 - $DATE
```

修改为你喜欢的格式：

```bash
# 示例 1：更详细的提交信息
COMMIT_MSG="chore: [auto-commit] $DATE - 每日自动备份

修改内容：
$(git diff --cached --name-only | head -20)"

# 示例 2：简洁版
COMMIT_MSG="auto: $DATE"
```

### 提交前自动运行测试

编辑 `scripts/auto-commit.sh`，在提交前添加测试命令：

```bash
# 在 git commit 之前添加
echo "[$NOW] 运行测试..." >> "$LOG_FILE"
pnpm test >> "$LOG_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo "[$NOW] 警告：测试失败，但仍然提交" >> "$LOG_FILE"
fi
```

### 提交前自动构建

```bash
# 在 git commit 之前添加
echo "[$NOW] 运行构建..." >> "$LOG_FILE"
pnpm build >> "$LOG_FILE" 2>&1

if [ $? -ne 0 ]; then
    echo "[$NOW] 错误：构建失败，跳过提交" >> "$LOG_FILE"
    exit 1
fi
```

---

## 总结

### 推荐配置

对于大多数用户，推荐使用默认配置：

```bash
# 一键设置
bash /workspace/projects/scripts/setup-auto-commit.sh

# 验证
crontab -l

# 完成！
```

### 最佳实践

1. **每天退出前手动提交一次**：作为双重保障
2. **查看日志**：定期检查自动提交是否正常
3. **保留重要分支**：在重要节点创建分支备份
4. **定期清理日志**：避免日志文件过大

---

**文档版本**: 1.0.0
**更新日期**: 2025-02-01
