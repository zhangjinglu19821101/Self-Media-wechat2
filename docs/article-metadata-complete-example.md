# Article Metadata 完整样例（2025-02-25 更新）

## 字段结构调整说明

### 主要变更
1. ❌ 删除 `article_basic.final_article_content`（不再保存文章内容）
2. ✅ 新增 `article_basic.article_content_status`（内容状态："已生成" | "未生成"）
3. ✅ `article_basic.article_id` 仅在步骤8后才有值
4. ✅ `current_step.step_output` 步骤8时为固定提示语
5. ✅ `current_step.exception_info` 新增"问题阻塞未执行"场景

---

## 完整样例（按步骤）

### 步骤 1：选题与规划
```json
{
  "article_basic": {
    "article_id": "",
    "article_title": "《年终奖到手，存年金险还是增额寿？》",
    "creator_agent": "insurance-d",
    "article_content_status": "未生成"
  },
  "current_step": {
    "step_no": 1,
    "step_name": "选题与规划",
    "step_status": "success",
    "step_output": "选题与规划完成：\n\n1. 文章标题：《年终奖到手，存年金险还是增额寿？》\n2. 目标读者：30-45岁的都市白领，有年终奖理财需求\n3. 文章结构：\n   - 引入：年终奖理财的痛点\n   - 对比：年金险 vs 增额寿\n   - 建议：根据不同需求给出建议\n4. 关键词：年终奖、年金险、增额寿、理财规划",
    "confirm_status": "已确认",
    "exception_info": ""
  },
  "wechat_mp_core_data": {
    "title_idea_set": [
      "《年终奖理财攻略：年金险 vs 增额寿》",
      "《拿了年终奖怎么存？年金险还是增额寿？》",
      "《年终奖理财：年金险和增额寿怎么选？》"
    ],
    "topics": ["年终奖", "年金险", "增额寿", "理财规划"],
    "user_pain_point": [
      "年终奖到手不知道怎么规划",
      "分不清年金险和增额寿的区别",
      "担心理财风险，想找安全稳定的方式"
    ],
    "hot_spot": [
      "2025年终奖",
      "年金险利率",
      "增额寿收益"
    ]
  }
}
```

---

### 步骤 2：资料收集与热点结合
```json
{
  "article_basic": {
    "article_id": "",
    "article_title": "《年终奖到手，存年金险还是增额寿？》",
    "creator_agent": "insurance-d",
    "article_content_status": "未生成"
  },
  "current_step": {
    "step_no": 2,
    "step_name": "资料收集与热点结合",
    "step_status": "success",
    "step_output": "资料收集完成：\n\n1. 最新政策：\n   - 2025年保险市场利率走势\n   - 年金险和增额寿的监管要求\n\n2. 热点数据：\n   - 2025年终奖平均水平：3.5万元\n   - 保险理财搜索量上升40%\n\n3. 产品对比：\n   - 年金险：长期收益稳定，适合养老规划\n   - 增额寿：灵活性高，适合中期理财",
    "confirm_status": "已确认",
    "exception_info": ""
  },
  "wechat_mp_core_data": {
    "title_idea_set": [
      "《年终奖理财攻略：年金险 vs 增额寿》",
      "《拿了年终奖怎么存？年金险还是增额寿？》",
      "《年终奖理财：年金险和增额寿怎么选？》"
    ],
    "topics": ["年终奖", "年金险", "增额寿", "理财规划"],
    "user_pain_point": [
      "年终奖到手不知道怎么规划",
      "分不清年金险和增额寿的区别",
      "担心理财风险，想找安全稳定的方式"
    ],
    "hot_spot": [
      "2025年终奖",
      "年金险利率",
      "增额寿收益"
    ]
  }
}
```

---

### 步骤 3：写作大纲
```json
{
  "article_basic": {
    "article_id": "",
    "article_title": "《年终奖到手，存年金险还是增额寿？》",
    "creator_agent": "insurance-d",
    "article_content_status": "未生成"
  },
  "current_step": {
    "step_no": 3,
    "step_name": "写作大纲",
    "step_status": "success",
    "step_output": "写作大纲完成：\n\n1. 引入：年终奖理财的痛点\n   - 年终奖到手，却不知道怎么存\n   - 银行利率低，股票风险高\n   - 保险理财成为热门选择\n\n2. 对比：年金险 vs 增额寿\n   - 年金险：是什么，适合谁，收益如何\n   - 增额寿：是什么，适合谁，收益如何\n   - 对比表：灵活性、收益、适用场景\n\n3. 建议：根据不同需求给出建议\n   - 短期用：增额寿\n   - 长期养老：年金险\n   - 组合配置：两者搭配\n\n4. 结语：稳健理财，守护财富",
    "confirm_status": "已确认",
    "exception_info": ""
  },
  "wechat_mp_core_data": {
    "title_idea_set": [
      "《年终奖理财攻略：年金险 vs 增额寿》",
      "《拿了年终奖怎么存？年金险还是增额寿？》",
      "《年终奖理财：年金险和增额寿怎么选？》"
    ],
    "topics": ["年终奖", "年金险", "增额寿", "理财规划"],
    "user_pain_point": [
      "年终奖到手不知道怎么规划",
      "分不清年金险和增额寿的区别",
      "担心理财风险，想找安全稳定的方式"
    ],
    "hot_spot": [
      "2025年终奖",
      "年金险利率",
      "增额寿收益"
    ]
  }
}
```

---

### 步骤 4：标题及封面
```json
{
  "article_basic": {
    "article_id": "",
    "article_title": "《年终奖到手，存年金险还是增额寿？》",
    "creator_agent": "insurance-d",
    "article_content_status": "未生成"
  },
  "current_step": {
    "step_no": 4,
    "step_name": "标题及封面",
    "step_status": "success",
    "step_output": "标题及封面完成：\n\n1. 主标题：《年终奖到手，存年金险还是增额寿？》\n2. 副标题：3个角度帮你选对\n3. 封面设计：\n   - 主图：年终奖红包 + 保险合同\n   - 配色：红色（喜庆）+ 金色（财富）\n   - 文字：年终奖理财攻略",
    "confirm_status": "已确认",
    "exception_info": ""
  },
  "wechat_mp_core_data": {
    "title_idea_set": [
      "《年终奖理财攻略：年金险 vs 增额寿》",
      "《拿了年终奖怎么存？年金险还是增额寿？》",
      "《年终奖理财：年金险和增额寿怎么选？》"
    ],
    "topics": ["年终奖", "年金险", "增额寿", "理财规划"],
    "user_pain_point": [
      "年终奖到手不知道怎么规划",
      "分不清年金险和增额寿的区别",
      "担心理财风险，想找安全稳定的方式"
    ],
    "hot_spot": [
      "2025年终奖",
      "年金险利率",
      "增额寿收益"
    ]
  }
}
```

---

### 步骤 5：正文写作
```json
{
  "article_basic": {
    "article_id": "",
    "article_title": "《年终奖到手，存年金险还是增额寿？》",
    "creator_agent": "insurance-d",
    "article_content_status": "未生成"
  },
  "current_step": {
    "step_no": 5,
    "step_name": "正文写作",
    "step_status": "success",
    "step_output": "正文写作完成：\n\n（此处为正文内容预览，完整内容将在步骤8生成）\n\n1. 引入：年终奖理财的痛点\n   - 年终奖到手，却不知道怎么存\n   - 银行利率低，股票风险高\n   - 保险理财成为热门选择\n\n2. 对比：年金险 vs 增额寿\n   - 年金险：是什么，适合谁，收益如何\n   - 增额寿：是什么，适合谁，收益如何\n   - 对比表：灵活性、收益、适用场景\n\n3. 建议：根据不同需求给出建议\n   - 短期用：增额寿\n   - 长期养老：年金险\n   - 组合配置：两者搭配\n\n4. 结语：稳健理财，守护财富",
    "confirm_status": "已确认",
    "exception_info": ""
  },
  "wechat_mp_core_data": {
    "title_idea_set": [
      "《年终奖理财攻略：年金险 vs 增额寿》",
      "《拿了年终奖怎么存？年金险还是增额寿？》",
      "《年终奖理财：年金险和增额寿怎么选？》"
    ],
    "topics": ["年终奖", "年金险", "增额寿", "理财规划"],
    "user_pain_point": [
      "年终奖到手不知道怎么规划",
      "分不清年金险和增额寿的区别",
      "担心理财风险，想找安全稳定的方式"
    ],
    "hot_spot": [
      "2025年终奖",
      "年金险利率",
      "增额寿收益"
    ]
  }
}
```

---

### 步骤 6：引言、互动引导
```json
{
  "article_basic": {
    "article_id": "",
    "article_title": "《年终奖到手，存年金险还是增额寿？》",
    "creator_agent": "insurance-d",
    "article_content_status": "未生成"
  },
  "current_step": {
    "step_no": 6,
    "step_name": "引言、互动引导",
    "step_status": "success",
    "step_output": "引言、互动引导完成：\n\n1. 引言：\n   - \"年终奖到手，你是不是也在纠结怎么存？银行利率太低，股票风险太高，保险理财成为越来越多人的选择。今天我们就来聊聊，年终奖买年金险还是增额寿？\"\n\n2. 互动引导：\n   - \"你的年终奖打算怎么存？欢迎在评论区留言分享！\"\n   - \"点赞收藏，下次理财不迷路！\"\n   - \"关注我，获取更多理财干货！\"",
    "confirm_status": "已确认",
    "exception_info": ""
  },
  "wechat_mp_core_data": {
    "title_idea_set": [
      "《年终奖理财攻略：年金险 vs 增额寿》",
      "《拿了年终奖怎么存？年金险还是增额寿？》",
      "《年终奖理财：年金险和增额寿怎么选？》"
    ],
    "topics": ["年终奖", "年金险", "增额寿", "理财规划"],
    "user_pain_point": [
      "年终奖到手不知道怎么规划",
      "分不清年金险和增额寿的区别",
      "担心理财风险，想找安全稳定的方式"
    ],
    "hot_spot": [
      "2025年终奖",
      "年金险利率",
      "增额寿收益"
    ]
  }
}
```

---

### 步骤 7：摘要、关键词设置
```json
{
  "article_basic": {
    "article_id": "",
    "article_title": "《年终奖到手，存年金险还是增额寿？》",
    "creator_agent": "insurance-d",
    "article_content_status": "未生成"
  },
  "current_step": {
    "step_no": 7,
    "step_name": "摘要、关键词设置",
    "step_status": "success",
    "step_output": "摘要、关键词设置完成：\n\n1. 摘要：\n   - \"本文详细对比了年金险和增额寿的特点、收益和适用场景，帮助读者根据自身需求选择合适的年终奖理财方式。\"\n\n2. 关键词：\n   - 年终奖\n   - 年金险\n   - 增额寿\n   - 理财规划",
    "confirm_status": "已确认",
    "exception_info": ""
  },
  "wechat_mp_core_data": {
    "title_idea_set": [
      "《年终奖理财攻略：年金险 vs 增额寿》",
      "《拿了年终奖怎么存？年金险还是增额寿？》",
      "《年终奖理财：年金险和增额寿怎么选？》"
    ],
    "topics": ["年终奖", "年金险", "增额寿", "理财规划"],
    "user_pain_point": [
      "年终奖到手不知道怎么规划",
      "分不清年金险和增额寿的区别",
      "担心理财风险，想找安全稳定的方式"
    ],
    "hot_spot": [
      "2025年终奖",
      "年金险利率",
      "增额寿收益"
    ]
  }
}
```

---

### 步骤 8：输出完整文章（特殊处理）
```json
{
  "article_basic": {
    "article_id": "ART20260225001",
    "article_title": "《年终奖到手，存年金险还是增额寿？》",
    "creator_agent": "insurance-d",
    "article_content_status": "已生成"
  },
  "current_step": {
    "step_no": 8,
    "step_name": "输出完整文章",
    "step_status": "success",
    "step_output": "文章已经生成，请通过 article_content 表查看。",
    "confirm_status": "已确认",
    "exception_info": ""
  },
  "wechat_mp_core_data": {
    "title_idea_set": [
      "《年终奖理财攻略：年金险 vs 增额寿》",
      "《拿了年终奖怎么存？年金险还是增额寿？》",
      "《年终奖理财：年金险和增额寿怎么选？》"
    ],
    "topics": ["年终奖", "年金险", "增额寿", "理财规划"],
    "user_pain_point": [
      "年终奖到手不知道怎么规划",
      "分不清年金险和增额寿的区别",
      "担心理财风险，想找安全稳定的方式"
    ],
    "hot_spot": [
      "2025年终奖",
      "年金险利率",
      "增额寿收益"
    ]
  }
}
```

---

## exception_info 填充场景

### 场景 1：正常执行
```json
"exception_info": ""
```

### 场景 2：执行失败
```json
"exception_info": "Agent 在执行过程中遇到错误：数据库连接失败。建议：检查数据库连接配置。"
```

### 场景 3：超时
```json
"exception_info": "Agent 执行超时（超过10分钟）。建议：拆分任务或增加超时时间。"
```

### 场景 4：异常
```json
"exception_info": "Agent 执行异常：LLM API 返回错误码 500。建议：重试或联系技术支持。"
```

### 场景 5：问题阻塞未执行（新增）
```json
"exception_info": "Agent 遇到问题阻塞未执行：无法获取2025年终奖最新数据。建议：提供数据源或调整选题方向。"
```

---

## 字段说明

### article_basic
| 字段 | 类型 | 说明 |
|------|------|------|
| `article_id` | string | 文章ID，格式：ART + 日期(8位) + 序号(3位)，仅步骤8后有值 |
| `article_title` | string | 文章标题 |
| `creator_agent` | string | 创建Agent：insurance-d |
| `article_content_status` | string | 内容状态："已生成" \| "未生成" |

### current_step
| 字段 | 类型 | 说明 |
|------|------|------|
| `step_no` | number | 步骤编号：1-8 |
| `step_name` | string | 步骤名称 |
| `step_status` | string | 步骤状态："success" \| "failed" |
| `step_output` | string | 步骤输出，步骤8时为固定提示语 |
| `confirm_status` | string | 确认状态："已确认" \| "待确认" |
| `exception_info` | string | 异常信息，Agent B 填充 |

---

## article_content 表说明

完整文章内容存储在 `article_content` 表中，包含以下字段：
- `article_id`：文章ID（关联 agent_sub_tasks 表）
- `article_title`：文章标题
- `article_content`：完整文章内容
- `created_at`：创建时间
- `updated_at`：更新时间
