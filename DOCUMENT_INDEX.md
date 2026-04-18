# 📚 文档索引

**最后更新**: 2026-02-26

---

## 🔥 ✅ 2月27日最终文档（仅看这4个！）

| 用途 | 文档路径 | 优先级 | 说明 |
|------|---------|--------|------|
| **当前进展** | `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md` | 🔴 **最高** | 所有进展记录在此 |
| **详细设计** | `docs/详细设计文档agent智能交互MCP能力设计capability_type.md` | 🔴 | 设计参考 |
| **数据库参考** | `docs/DATABASE_QUICK_REFERENCE.md` | 🟡 | 需要时看 |
| **文档索引** | `DOCUMENT_INDEX.md` | 🟡 | 本文档 |

---

## 🎯 快速导航

### 核心实施计划
- **[MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md](./MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md)** - 🔥 **最重要！** MCP 能力体系实施计划与进度跟踪
  - 今日工作记录
  - 交互流程图
  - 实施进度总览

### 详细设计文档
- **[docs/详细设计文档agent智能交互MCP能力设计capability_type.md](./docs/详细设计文档agent智能交互MCP能力设计capability_type.md)** - capability_type 详细设计文档
- **[assets/Coze MCP能力 capability_type 详细设计文档.md](./assets/Coze MCP能力 capability_type 详细设计文档.md)** - 原始详细设计文档

### 分支1相关文档
- **[MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md](./MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md)** - 分支1智能化进展已记录在此文档末尾

### ❌ 已删除的文档（请勿再找）
- `docs/BRANCH1_INTELLIGENT_ARCHITECTURE.md` - 已删除
- `docs/BRANCH1_CORE_FLOW.md` - 已删除
- `docs/BRANCH1_PROGRESS_SUMMARY.md` - 已删除

---

## 📂 完整文档清单

### 根目录文档
| 文件名 | 说明 | 优先级 |
|--------|------|--------|
| `README.md` | 项目 README | 🟡 |
| `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md` | 🔥 MCP 能力体系实施计划（主文档） | 🔴 **最高** |
| `DOCUMENT_INDEX.md` | 本文档 - 文档索引 | 🟡 |

### docs/ 目录文档
| 文件名 | 说明 | 优先级 |
|--------|------|--------|
| `详细设计文档agent智能交互MCP能力设计capability_type.md` | capability_type 详细设计 | 🟠 |
| `AGENT_A_NOTIFICATION_CONFIRM.md` | Agent A 通知确认 | 🟢 |
| `AGENT_B_HOW_TO_KNOW.md` | Agent B 如何知晓 | 🟢 |
| `AGENT_TASK_SYSTEM_README.md` | Agent 任务系统 README | 🟢 |
| `DATABASE_SCHEMA.md` | 数据库 schema | 🟡 |
| `DATABASE_QUICK_REFERENCE.md` | 数据库快速参考 | 🟡 |

### assets/ 目录文档
| 文件名 | 说明 | 优先级 |
|--------|------|--------|
| `Coze MCP能力 capability_type 详细设计文档.md` | 原始详细设计文档 | 🟠 |

---

## 🔍 下次工作前必读清单

### 开始工作前
- [ ] 阅读本文档 `DOCUMENT_INDEX.md`，了解文档结构
- [ ] 阅读 `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md` 的"今日工作记录"部分
- [ ] 查看 `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md` 的"实施进度总览"
- [ ] 确认当前进度和下一步工作

### 工作中
- [ ] **不要创建新文档**，除非用户明确要求
- [ ] 在 `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md` 上追加进展
- [ ] 如果需要记录设计决策，在现有文档中更新

### 工作完成后
- [ ] 在 `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md` 中更新进展
- [ ] 如需要，更新本文档 `DOCUMENT_INDEX.md`

---

## 🎯 核心文档速查

### 👉 找当前进展？
看这里：**[MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md](./MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md)**

### 👉 找详细设计？
看这里：**[docs/详细设计文档agent智能交互MCP能力设计capability_type.md](./docs/详细设计文档agent智能交互MCP能力设计capability_type.md)**

### 👉 找数据库参考？
看这里：**[docs/DATABASE_QUICK_REFERENCE.md](./docs/DATABASE_QUICK_REFERENCE.md)**

---

## ⚠️ 重要提醒

### 🚫 禁止行为
- ❌ 不要随意创建新的 `.md` 文档
- ❌ 不要创建重复或冗余的文档
- ❌ 不要在多个文档中分散记录同一件事

### ✅ 推荐做法
- ✅ 优先使用 `MCP_CAPABILITY_TYPE_IMPLEMENTATION_PLAN.md` 记录进展
- ✅ 在现有文档中追加内容，而不是创建新文档
- ✅ 如确实需要新文档，先跟用户确认
- ✅ 更新本文档 `DOCUMENT_INDEX.md` 维护索引

---

## 📊 文档统计

| 分类 | 数量 |
|------|------|
| 根目录文档 | 3 |
| docs/ 目录文档 | 20+ |
| assets/ 目录文档 | 2+ |
| **总计** | **25+** |

---

## 🔗 相关资源

### 代码文件索引
- **类型定义**: `src/lib/types/` 目录
- **数据库 Schema**: `src/lib/db/schema.ts`
- **MCP 相关**: `src/lib/mcp/` 目录
- **API 路由**: `src/app/api/` 目录

### 数据库表速查
- `capability_list` - 能力清单表
- `domain_rule` - 业务规则表
- `domain_case` - 案例库表
- `domain_terminology` - 术语库表
- `agent_sub_tasks` - 子任务表
- `agent_sub_tasks_step_history` - 交互历史表

---

**本文档维护者**: AI Assistant  
**最后更新**: 2026-02-26
