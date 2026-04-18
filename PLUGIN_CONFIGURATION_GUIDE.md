# 插件配置指南

本文档详细说明了如何为 Agent C 和 Agent insurance-c 配置通用运营插件。

---

## 目录

1. [插件系统概述](#插件系统概述)
2. [能力分类](#能力分类)
3. [插件配置方法](#插件配置方法)
4. [各插件详细配置](#各插件详细配置)
5. [API 使用示例](#api-使用示例)

---

## 插件系统概述

### 架构设计

```
Agent B（插件开发者）
    ↓ 开发通用插件
通用插件库
    ↓ 提供使用
Agent C / Agent insurance-c（插件使用者）
```

### 核心原则

- ✅ B 负责技术开发，C 负责业务配置
- ✅ 插件逻辑通用，可适用于 AI 和保险事业部
- ✅ 插件必须可配置，允许 C 定制业务参数
- ✅ 插件必须支持多 Agent 使用
- ❌ 不开发赛道独有的功能

---

## 能力分类

### Agent C 的能力体系

| 能力类型 | 来源 | 数量 | 示例 |
|---------|------|------|------|
| **原生能力** | Agent 天生具备 | 6 | 用户沟通、数据分析、应急处理 |
| **领域能力** | AI 事业部独有 | 7 | AI 产品运营、AI 工具使用、AI 社群运营 |
| **插件能力** | B 开发，C 使用 | 6 | 自动回复、积分系统、优惠券 |

### Agent insurance-c 的能力体系

| 能力类型 | 来源 | 数量 | 示例 |
|---------|------|------|------|
| **原生能力** | Agent 天生具备 | 6 | 用户沟通、数据分析、应急处理 |
| **领域能力** | 保险事业部独有 | 8 | 保险合规运营、保险产品推广、保险理赔协助 |
| **插件能力** | B 开发，insurance-c 使用 | 6 | 自动回复、积分系统、优惠券 |

---

## 插件配置方法

### 方法 1：通过 API 配置（推荐）

```bash
# 配置 Agent C 的自动回复插件
curl -X POST http://localhost:5000/api/plugins/config \
  -H "Content-Type: application/json" \
  -d '{
    "pluginId": "auto-reply",
    "agentId": "C",
    "config": {
      "keywords": {
        "价格": "我们的产品价格根据套餐不同，基础版 99 元/月，专业版 199 元/月。",
        "试用": "我们提供 7 天免费试用，您可以先体验后再决定是否购买。",
        "退款": "购买后 7 天内，如不满意可以申请全额退款。"
      },
      "aiEnabled": true,
      "greeting": "您好！我是 AI 助手，很高兴为您服务。",
      "workingHours": {
        "start": "09:00",
        "end": "18:00"
      }
    }
  }'
```

### 方法 2：通过前端配置（待实现）

未来将提供前端配置界面，支持可视化配置。

---

## 各插件详细配置

### 1. 自动回复插件（auto-reply）

#### 功能描述
根据关键词自动回复用户留言，支持 AI 对话。

#### Agent C 配置示例

```json
{
  "pluginId": "auto-reply",
  "agentId": "C",
  "config": {
    "keywords": {
      "价格": "我们的 AI 产品价格根据套餐不同，基础版 99 元/月，专业版 199 元/月。",
      "试用": "我们提供 7 天免费试用，您可以先体验后再决定是否购买。",
      "退款": "购买后 7 天内，如不满意可以申请全额退款。",
      "功能": "我们支持 AI 写作、AI 绘图、AI 语音等多种功能。",
      "支持": "我们的技术支持团队 7x24 小时在线，您可以随时联系我们。"
    },
    "aiEnabled": true,
    "greeting": "您好！我是 AI 助手，很高兴为您服务。",
    "workingHours": {
      "start": "09:00",
      "end": "18:00"
    },
    "aiModel": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 500
  }
}
```

#### Agent insurance-c 配置示例

```json
{
  "pluginId": "auto-reply",
  "agentId": "insurance-c",
  "config": {
    "keywords": {
      "保险": "我们提供多种保险产品，包括人寿保险、健康保险、意外保险等。",
      "理赔": "理赔流程简单，您可以通过我们的 APP 或官网提交理赔申请。",
      "保费": "保费根据您的年龄、性别、健康状况等因素计算，具体请联系客服。",
      "等待期": "大多数保险产品的等待期为 30-90 天，具体以产品条款为准。",
      "除外责任": "请仔细阅读保险条款，了解除外责任范围。"
    },
    "aiEnabled": true,
    "greeting": "您好！我是保险顾问，很高兴为您服务。",
    "workingHours": {
      "start": "09:00",
      "end": "18:00"
    },
    "aiModel": "gpt-4",
    "temperature": 0.3,
    "maxTokens": 300,
    "complianceCheck": true
  }
}
```

#### 配置说明

| 参数 | 类型 | 说明 | 必填 |
|------|------|------|------|
| keywords | object | 关键词回复配置 | 是 |
| aiEnabled | boolean | 是否启用 AI 对话 | 否 |
| greeting | string | 欢迎语 | 否 |
| workingHours | object | 工作时间 | 否 |
| aiModel | string | AI 模型 | 否 |
| temperature | number | AI 温度参数 | 否 |
| maxTokens | number | AI 最大 token 数 | 否 |
| complianceCheck | boolean | 合规检查（保险专用） | 否 |

---

### 2. 积分系统插件（points-system）

#### 功能描述
用户行为积分奖励系统，支持多种积分规则。

#### Agent C 配置示例

```json
{
  "pluginId": "points-system",
  "agentId": "C",
  "config": {
    "rules": {
      "comment": 10,
      "share": 20,
      "like": 5,
      "invite": 50,
      "dailyLogin": 5
    },
    "rewards": {
      "100": "优惠券（满 50 减 10）",
      "500": "免费试用 7 天",
      "1000": "专业版 1 个月"
    },
    "expiryDays": 365,
    "maxPointsPerDay": 200
  }
}
```

#### Agent insurance-c 配置示例

```json
{
  "pluginId": "points-system",
  "agentId": "insurance-c",
  "config": {
    "rules": {
      "consult": 20,
      "purchase": 100,
      "refer": 50,
      "policyRenewal": 30
    },
    "rewards": {
      "100": "保费抵扣券（满 500 减 50）",
      "500": "免费体检一次",
      "1000": "保费 9 折优惠券"
    },
    "expiryDays": 730,
    "maxPointsPerDay": 100,
    "compliance": true
  }
}
```

#### 配置说明

| 参数 | 类型 | 说明 | 必填 |
|------|------|------|------|
| rules | object | 积分规则 | 是 |
| rewards | object | 积分奖励 | 是 |
| expiryDays | number | 积分有效期（天） | 否 |
| maxPointsPerDay | number | 每日最大积分 | 否 |
| compliance | boolean | 合规检查（保险专用） | 否 |

---

### 3. 优惠券插件（coupon-distribution）

#### 功能描述
发放和核销优惠券，支持多种券类型。

#### Agent C 配置示例

```json
{
  "pluginId": "coupon-distribution",
  "agentId": "C",
  "config": {
    "coupons": [
      {
        "id": "COUPON_AI_10",
        "name": "AI 产品新用户优惠",
        "type": "discount",
        "value": 10,
        "minAmount": 50,
        "validDays": 30,
        "usageLimit": 1
      }
    ],
    "autoDistribution": true,
    "distributionRules": {
      "newUser": true,
      "minPurchase": 50
    }
  }
}
```

#### Agent insurance-c 配置示例

```json
{
  "pluginId": "coupon-distribution",
  "agentId": "insurance-c",
  "config": {
    "coupons": [
      {
        "id": "COUPON_INS_50",
        "name": "保险产品优惠",
        "type": "discount",
        "value": 50,
        "minAmount": 500,
        "validDays": 90,
        "usageLimit": 1
      }
    ],
    "autoDistribution": true,
    "distributionRules": {
      "newPolicy": true,
      "minPremium": 500
    },
    "compliance": true
  }
}
```

---

### 4. 裂变营销插件（viral-marketing）

#### 功能描述
用户裂变拉新活动，支持多种裂变模式。

#### Agent C 配置示例

```json
{
  "pluginId": "viral-marketing",
  "agentId": "C",
  "config": {
    "campaign": {
      "name": "AI 产品裂变活动",
      "type": "invite",
      "rewards": {
        "inviter": 50,
        "invitee": 20
      },
      "maxRewards": 500,
      "validDays": 30
    }
  }
}
```

#### Agent insurance-c 配置示例

```json
{
  "pluginId": "viral-marketing",
  "agentId": "insurance-c",
  "config": {
    "campaign": {
      "name": "保险产品推荐活动",
      "type": "refer",
      "rewards": {
        "referrer": 100,
        "referee": 50
      },
      "maxRewards": 1000,
      "validDays": 90
    },
    "compliance": true
  }
}
```

---

### 5. A/B 测试插件（ab-testing）

#### 功能描述
内容和活动效果 A/B 测试。

#### Agent C 配置示例

```json
{
  "pluginId": "ab-testing",
  "agentId": "C",
  "config": {
    "test": {
      "name": "AI 产品文案 A/B 测试",
      "variantA": {
        "title": "AI 写作神器",
        "description": "一键生成高质量文案"
      },
      "variantB": {
        "title": "AI 写作助手",
        "description": "智能创作，轻松写作"
      },
      "splitRatio": 0.5,
      "durationDays": 7
    }
  }
}
```

#### Agent insurance-c 配置示例

```json
{
  "pluginId": "ab-testing",
  "agentId": "insurance-c",
  "config": {
    "test": {
      "name": "保险产品文案 A/B 测试",
      "variantA": {
        "title": "全方位保障，安心生活",
        "description": "为您和家人提供全面的保险保障"
      },
      "variantB": {
        "title": "守护家人，从一份保障开始",
        "description": "专业的保险方案，守护您和家人的健康"
      },
      "splitRatio": 0.5,
      "durationDays": 14
    },
    "compliance": true
  }
}
```

---

### 6. 用户分层插件（user-segmentation）

#### 功能描述
根据用户行为进行分层和打标签。

#### Agent C 配置示例

```json
{
  "pluginId": "user-segmentation",
  "agentId": "C",
  "config": {
    "segments": [
      {
        "name": "活跃用户",
        "criteria": {
          "loginDays": 7,
          "interactionCount": 10
        },
        "tags": ["active", "high-value"]
      },
      {
        "name": "新用户",
        "criteria": {
          "registerDays": 3
        },
        "tags": ["new", "onboarding"]
      },
      {
        "name": "流失用户",
        "criteria": {
          "lastLoginDays": 30
        },
        "tags": ["churn", "need-attention"]
      }
    ]
  }
}
```

#### Agent insurance-c 配置示例

```json
{
  "pluginId": "user-segmentation",
  "agentId": "insurance-c",
  "config": {
    "segments": [
      {
        "name": "高价值客户",
        "criteria": {
          "totalPremium": 10000,
          "policyCount": 3
        },
        "tags": ["high-value", "VIP"]
      },
      {
        "name": "新客户",
        "criteria": {
          "firstPolicyDays": 30
        },
        "tags": ["new", "onboarding"]
      },
      {
        "name": "续保客户",
        "criteria": {
          "renewalDueDays": 30
        },
        "tags": ["renewal", "need-contact"]
      }
    ]
  }
}
```

---

## API 使用示例

### 获取 Agent 的能力配置

```bash
curl "http://localhost:5000/api/plugins?type=capabilities&agentId=C"
```

### 获取 Agent 可使用的插件列表

```bash
curl "http://localhost:5000/api/plugins?agentId=C"
```

### 执行插件

```bash
curl -X POST http://localhost:5000/api/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "pluginId": "auto-reply",
    "agentId": "C",
    "action": "reply",
    "params": {
      "message": "我想了解价格",
      "userId": "user_123"
    }
  }'
```

### 获取插件统计信息

```bash
# 获取指定插件的统计信息
curl "http://localhost:5000/api/plugins?type=stats&pluginId=auto-reply"

# 获取所有插件的统计信息
curl "http://localhost:5000/api/plugins?type=stats"
```

---

## 总结

### 关键要点

1. **插件通用性**：插件逻辑通用，适用于 AI 和保险事业部
2. **业务可配置**：Agent C 可以根据领域特性配置业务参数
3. **合规检查**：保险领域插件需要额外的合规检查
4. **使用日志**：所有插件使用都会记录日志，便于分析和优化

### 下一步

1. 根据实际业务需求配置插件参数
2. 监控插件使用效果
3. 根据反馈优化插件配置
4. 向 Agent B 反馈插件问题和改进建议

---

**文档版本**: 1.0.0
**更新日期**: 2025-02-01
