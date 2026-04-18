# 自动提交功能 - 快速参考

## 🚀 快速开始

### 启动自动提交守护进程（推荐）

```bash
# 启动守护进程（每小时检查一次）
bash /workspace/projects/scripts/auto-commit-daemon.sh start

# 查看状态
bash /workspace/projects/scripts/auto-commit-daemon.sh status

# 停止守护进程
bash /workspace/projects/scripts/auto-commit-daemon.sh stop
```

### 手动执行一次提交

```bash
bash /workspace/projects/scripts/auto-commit.sh
```

### 查看日志

```bash
# 查看守护进程日志
tail -20 /workspace/projects/.coze-logs/auto-commit-daemon.log

# 查看自动提交日志
tail -20 /workspace/projects/.coze-logs/auto-commit.log
```

---

## 📋 已完成的设置

### ✅ 已启动的守护进程

- **进程 ID**: 1998
- **启动时间**: Sun Feb 1 19:59:59 2026
- **检查间隔**: 1 小时（3600 秒）
- **状态**: 正在运行

### ✅ 工作原理

```
守护进程（每小时检查）
    ↓
检测代码修改
    ↓
有修改？
    ├─ 是 → 添加文件 → 生成提交信息 → 提交 → 记录日志
    └─ 否 → 记录"无修改" → 等待下次检查
```

---

## 📌 重要提示

### 1. 守护进程特性

- ✅ **自动运行**：无需手动干预
- ✅ **每小时检查**：及时发现并提交修改
- ✅ **智能提交**：只有修改时才提交，避免空提交
- ✅ **完整日志**：记录每次提交的详细信息

### 2. 代码安全

- ✅ 所有代码都会自动提交到 Git
- ✅ 即使沙箱重启，代码也不会丢失
- ✅ 完整的提交历史，便于回溯

### 3. 日志查看

```bash
# 实时监控日志
tail -f /workspace/projects/.coze-logs/auto-commit-daemon.log

# 查看最近的提交
git log --oneline -10
```

---

## 🔧 故障排除

### 守护进程停止了？

```bash
# 检查状态
bash /workspace/projects/scripts/auto-commit-daemon.sh status

# 重新启动
bash /workspace/projects/scripts/auto-commit-daemon.sh restart
```

### 想要立即提交？

```bash
# 手动执行一次
bash /workspace/projects/scripts/auto-commit.sh
```

---

## 📚 详细文档

完整的使用说明，请参考：
- `scripts/AUTO_COMMIT_GUIDE.md`

---

**状态**: ✅ 已启动并正常运行
**最后更新**: 2025-02-01
