sequenceDiagram
    participant 控制器（调度核心+记忆管理器）
    participant insurance-d（智能体：LLM实例+身份+记忆）
    participant Agent B（智能体：LLM实例+身份+记忆）
    participant MCP接口
    participant 案例库（智能体的记忆源）

    %% 前置：控制器加载任务+智能体记忆
    控制器->>案例库: 加载insurance-d/Agent B的历史案例（失败/成功）
    案例库->>控制器: 返回记忆列表
    控制器->>insurance-d: 实例化（传入身份Prompt+记忆）
    控制器->>Agent B: 实例化（传入身份Prompt+记忆）

    %% Step1：insurance-d智能分析任务（带记忆+场景化推理）
    控制器->>insurance-d: 传入agent_sub_tasks任务+能力类型枚举+记忆提示
    Note over insurance-d: 智能推理：<br>1. 判断是否需MCP；<br>2. 补全模糊任务描述；<br>3. 规避历史错误
    insurance-d->>控制器: 返回结构化结果（is_need_mcp+problem+capability_type）
    控制器->>控制器: 智能校验结果（格式/信息完整性）
    alt 结果不合规
        控制器->>insurance-d: 追加Prompt（含错误示例+修正要求）重试
    end

    %% Step2：Agent B智能生成参数（带记忆+场景适配）
    控制器->>Agent B: 传入insurance-d结果+capability_list+记忆提示
    Note over Agent B: 智能生成：<br>1. 匹配能力清单；<br>2. 补全必填参数；<br>3. 参考历史案例优化参数
    Agent B->>控制器: 返回JSON参数（api_address+params）
    控制器->>控制器: 智能校验参数（必填项/格式）
    alt 参数不合规
        控制器->>Agent B: 追加Prompt（含参数规则+错误示例）重试
    end

    %% Step3：控制器执行MCP+闭环学习
    控制器->>MCP接口: 调用接口（传入参数）
    MCP接口->>控制器: 返回执行结果（成功/失败）
    alt 执行失败
        控制器->>案例库: 记录失败案例（任务+参数+原因）
        控制器->>insurance-d: 更新记忆（失败案例）
        控制器->>Agent B: 更新记忆（失败案例）
    else 执行成功
        控制器->>案例库: 记录成功案例（最优参数）
    end

    %% Step4：结果反馈
    控制器->>agent_sub_tasks: 更新任务状态+执行结果