# Coze MCP能力 capability_type 详细设计文档

# 一、设计总则

## 1.1 设计目标

统一MCP能力的分类标准，定义全局唯一的capability_type枚举，支撑多Agent协作（执行Agent、Agent B、Agent A）的能力匹配、解决方案选型，适配所有业务线（无业务绑定），保证Agent间交互规范、可追溯、可扩展。

## 1.2 核心原则

- 通用性：按“能力类型”划分，不绑定具体业务、任务步骤、Agent职责，所有业务线可复用；

- 适度粒度：既保证Agent能精准匹配能力，又避免类型过细导致维护成本过高；

- 可枚举：所有capability_type全局唯一、固化枚举，禁止Agent随意输出非规范值；

- 可扩展：支持新增全新能力维度，同时控制总数，保证体系清晰；

- 强适配：贴合Coze Agent协作逻辑，支持MCP能力调用、控制器查询、交互记录存储全流程。

# 二、capability_type 数量规范

## 2.1 初始数量

初始设计10~15个通用capability_type，覆盖Agent协作、MCP调用、工具执行、内容处理、数据操作、平台发布等核心通用能力，满足各业务线初期需求。

## 2.2 长期上限

总数建议不超过30个；若超过30个，需对现有类型进行上层归类，避免能力体系混乱，保证维护便捷性。

## 2.3 扩展规则

- 新增前提：仅当出现“全新能力维度”（现有类型无法覆盖）时，方可新增；

- 复用优先：新增业务线时，优先复用现有capability_type，不随意新增；

- 统一管理：所有类型需录入全局枚举字典，禁止个人随意创建、修改；

- 命名规范：统一采用“小写英文+下划线”格式，格式为「核心能力_细分维度」，保证语义清晰、无歧义。

# 三、通用 capability_type 枚举清单（初始15个，无业务绑定）

|capability_type（枚举值）|中文释义|核心能力描述|适配场景示例|
|---|---|---|---|
|data_acquire|数据获取|获取各类数据（外网爬取、数据库查询、文件读取、第三方接口调用）|热点数据爬取、案例数据读取|
|data_process|数据处理|对获取的数据进行清洗、解析、结构化、格式转换|数据去重、文本结构化处理|
|content_generate|内容生成|生成各类文本内容（标题、正文、摘要、文案等）|文章标题创作、正文撰写|
|content_optimize|内容优化|对生成的内容进行润色、去AI化、语气调整、逻辑优化|文本去机械化、口语化调整|
|content_check|内容审核|对内容进行合规校验、风险检测、格式检查|合规性审核、风险词检测|
|media_operate|媒体操作|处理各类媒体资源（图片、文件、音视频的上传、下载、编辑）|图片上传、文件下载|
|platform_publish|平台发布|将内容发布至各类平台（公众号、小红书、抖音等）|公众号文章上传、文案发布|
|tool_execute|工具调用|调用各类工具（计算器、搜索工具、MCP连接器等）|MCP连接器调用、搜索工具执行|
|agent_collaborate|Agent协作|多Agent间的咨询、转交、协同处理任务|执行Agent咨询Agent B|
|human_interact|人工交互|与人工进行交互（确认、反馈、审批、修改意见接收）|人工审核确认、修改意见接收|
|task_control|任务控制|任务的调度、重试、超时处理、状态更新|超时步骤重试、任务状态同步|
|resource_access|资源访问|访问各类资源（文件、数据库、外部接口、知识库）|数据库访问、文件读取|
|knowledge_search|知识检索|从知识库、文档、FAQ中检索相关知识|知识库检索、FAQ匹配|
|schedule_plan|规划编排|对任务流程、步骤、策略进行规划和编排|任务步骤规划、协作策略编排|
|exception_handle|异常处理|处理任务执行中的报错、降级、兜底逻辑|报错处理、兜底方案触发|
# 四、Agent交互流程与核心功能设计

## 4.1 设计说明

本章节整合Agent交互核心功能，替换原“按交互次数判定流程”的逻辑，改为“按Agent行为自主决策”，覆盖执行Agent能力边界判定、Agent B解决方案选型、Agent B上报决策三大核心需求，确保交互流程规范、可落地，适配Coze多Agent协作场景。

核心原则：交互流程不依赖交互次数，以Agent自主决策为核心，每一次单向信息传递（请求/应答/上报）均记录交互历史，保证全链路可追溯。

## 4.2 执行Agent核心功能（能力边界判定）

### 4.2.1 功能要求

执行Agent（如insurance-d）在执行任务过程中，需自主判断当前操作是否超出自身能力范围，若超出则按固定格式输出相关字段，触发Agent B介入。

### 4.2.2 输出规范（必选字段）

|字段名|数据类型|取值规范|核心说明|
|---|---|---|---|
|is_need_mcp|布尔值|true/false|true：超出自身能力范围，需Agent B介入；false：可自主完成|
|problem|字符串|不超过500字，结构化描述|is_need_mcp=true时必填，格式：「能力类型+具体问题」，如“平台发布能力缺失，无微信公众号上传权限”|
|capability_type|字符串|第三章枚举值之一|is_need_mcp=true时必填，关联对应能力类型，便于Agent B匹配解决方案|
### 4.2.3 输出示例

```json
{
  "is_need_mcp": true,
  "problem": "平台发布能力缺失，无微信公众号上传权限，无法完成内容发布操作",
  "capability_type": "platform_publish"
}
```

## 4.3 Agent B核心功能（解决方案选型+上报决策）

### 4.3.1 核心职责

Agent B接收执行Agent的反馈后，自主分析问题，结合能力清单（capability_list表）选型解决方案，同时自主决策是否上报Agent A，全程不依赖交互次数。

### 4.3.2 解决方案选型流程（正常场景）

1. Agent B接收执行Agent输出的is_need_mcp、problem、capability_type信息，分析问题核心；

2. 若需查询当前可用的能力清单，输出list_capabilities=true，同时携带capability_type参数（指定查询维度）；

3. 控制器接收请求后，查询capability_list表，将“执行Agent问题+匹配的能力清单（序号+功能描述）”返回给Agent B；

4. Agent B分析清单后，选定适配的解决方案，输出solution_num（与能力清单id一一对应），完成选型。

### 4.3.3 输出规范（解决方案选型）

|字段名|数据类型|取值规范|核心说明|
|---|---|---|---|
|list_capabilities|布尔值|true/false|true：需要查询能力清单；false：无需查询，可直接选型|
|solution_num|整数|与capability_list表id一致|list_capabilities=true且收到控制器反馈后必填，如solution_num=10表示采用能力清单中id=10的解决方案|
|solution_desc|字符串|不超过300字|可选，补充解决方案描述，便于追溯，如“采用10号方案，通过Coze MCP连接器完成微信公众号上传”|
### 4.3.4 上报决策功能

Agent B自主判断是否需要上报Agent A，无需依赖交互次数，通过is_notify_agentA字段控制，上报时需补充相关说明。

### 4.3.5 上报输出规范

|字段名|数据类型|取值规范|核心说明|
|---|---|---|---|
|is_notify_agentA|布尔值|true/false|true：需要上报Agent A；false：无需上报，自主处理|
|report_content|字符串/JSONB|结构化描述，不超过500字|is_notify_agentA=true时必填，需包含：问题描述、解决方案（或无匹配方案）、上报原因|
### 4.3.6 Agent B输出示例

示例1：需要查询能力清单，无需上报

```json
{
  "list_capabilities": true,
  "capability_type": "platform_publish",
  "is_notify_agentA": false
}
```

示例2：选定解决方案，无需上报

```json
{
  "list_capabilities": false,
  "solution_num": 10,
  "solution_desc": "采用10号方案，通过Coze MCP连接器完成微信公众号上传",
  "is_notify_agentA": false
}
```

示例3：无匹配解决方案，需要上报

```json
{
  "list_capabilities": true,
  "solution_num": null,
  "is_notify_agentA": true,
  "report_content": {
    "problem": "执行Agent无微信公众号上传权限，查询能力清单后无适配解决方案",
    "reason": "能力清单中platform_publish类型的解决方案均不可用",
    "suggestion": "请Agent A更新能力清单或调整权限"
  }
}
```

## 4.4 交互历史存储规范

### 4.4.1 存储时机

每一次Agent间、Agent与控制器间的单向信息传递（请求/应答/上报），均需在agent_sub_tasks_step_history表存储一条记录，与交互次数无关，确保全链路可追溯。

### 4.4.2 存储核心要求

- interact_num规则：同task_id+step_no下，每新增一条记录，interact_num自动递增（从1开始），仅用于排序，不影响Agent决策；

- interact_content规范：必须包含本次交互的核心字段（如is_need_mcp、list_capabilities、is_notify_agentA等），格式参考本章节输出示例；

- 交互类型匹配：根据交互主体和内容，对应设置interact_type（agent_consult/agent_response/agent_summary等），贴合第三章枚举规范。

### 4.4.3 完整交互示例（落地参考）

场景：执行Agent（insurance-d）无微信公众号上传能力，Agent B选型解决方案后完成协作，无需上报Agent A

1. 交互1（执行Agent→Agent B，interact_num=1）：
                  `{
  "interact_type": "agent_consult",
  "consultant": "insurance-d",
  "responder": "Agent B",
  "question": {
    "is_need_mcp": true,
    "problem": "平台发布能力缺失，无微信公众号上传权限，无法完成内容发布操作",
    "capability_type": "platform_publish"
  },
  "response": "",
  "execution_result": {"status": "waiting"}
` `}`

2. 交互2（Agent B→控制器，interact_num=2）：
                  `{
  "interact_type": "agent_consult",
  "consultant": "Agent B",
  "responder": "控制器",
  "question": {
    "list_capabilities": true,
    "capability_type": "platform_publish"
  },
  "response": "",
  "execution_result": {"status": "waiting"}
` `}`

3. 交互3（控制器→Agent B，interact_num=3）：
                  `{
  "interact_type": "agent_response",
  "consultant": "控制器",
  "responder": "Agent B",
  "question": "",
  "response": {
    "capability_list": [
      {"id": 10, "function_desc": "微信公众号文章上传（Coze MCP连接器）", "status": "available"},
      {"id": 11, "function_desc": "小红书文案发布（Coze MCP连接器）", "status": "available"}
    ]
  },
  "execution_result": {"status": "success"}
` `}`

4. 交互4（Agent B→执行Agent，interact_num=4）：
                  `{
  "interact_type": "agent_response",
  "consultant": "Agent B",
  "responder": "insurance-d",
  "question": "",
  "response": {
    "list_capabilities": false,
    "solution_num": 10,
    "solution_desc": "采用10号方案，通过Coze MCP连接器完成微信公众号上传",
    "is_notify_agentA": false
  },
  "execution_result": {"status": "success"}
` `}`

## 4.5 异常处理规则

- 执行Agent未按规范输出（如is_need_mcp=true但未填problem）：Agent B反馈执行Agent，要求补充完整信息，暂不进行解决方案选型；

- Agent B查询能力清单后无匹配解决方案：自动输出is_notify_agentA=true，上报Agent A，说明问题及无匹配方案原因；

- solution_num对应解决方案不可用（status=unavailable）：Agent B重试1次选型，仍失败则上报Agent A；

- 交互超时/存储失败：存储一条interact_type=system_tip的记录，记录失败原因，触发Agent B介入或上报。

# 五、数据存储适配（与step_history表联动）

## 5.1 存储时机

每一次Agent间、Agent与控制器间的单向信息传递（请求/应答/上报），均需在agent_sub_tasks_step_history表存储一条记录，确保全链路可追溯。

## 5.2 存储规范

interact_content（JSONB）中必须包含本次交互的核心字段（如涉及能力匹配，需包含capability_type），格式严格遵循第四章输出示例，确保数据结构化、可解析。

## 5.3 交互次数控制

同task_id+step_no下，interact_num按交互次数逐次递增（从1开始）；累计交互次数不超过5次，第5次交互时，Agent B自动生成总结并决策是否上报Agent A，之后禁止该步骤新增交互。

# 六、维护与扩展流程

## 6.1 维护流程

1. 建立capability_type全局枚举字典、能力清单表（capability_list），由专人负责维护；

2. 每季度检查现有类型的复用情况、Agent交互规范执行情况，清理冗余类型、修正不规范交互；

3. 同步更新相关文档和Coze Agent配置，确保全局一致性。

## 6.2 扩展流程

1. 业务方提出新增需求，提交“新增capability_type/交互功能申请”（说明新增原因、能力描述、适配场景）；

2. 维护人员审核，确认属于“全新能力维度”、无现有类型/功能可复用后，批准新增；

3. 新增类型/功能按本设计规范定义，录入全局枚举字典，同步更新相关文档和Coze配置；

4. 通知所有Agent配置人员，确保Agent输出、交互流程符合新增规范。

# 七、附则

1. 本设计文档适用于Coze平台所有Agent协作、MCP能力调用场景，所有相关配置需严格遵循；

2. 若后续Coze平台能力升级，可根据实际需求调整本设计的细节；

3. 所有Agent、控制器、数据存储的相关操作，需以本设计文档为标准，确保全局一致性。


> （注：文档部分内容可能由 AI 生成）