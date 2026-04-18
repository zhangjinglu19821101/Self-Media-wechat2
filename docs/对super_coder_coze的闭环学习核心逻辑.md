graph TD
    Step1[控制器加载agent_sub_tasks任务] --> Step2[读取领域知识库（规则+案例+模板）]
    Step2 --> Step3[调用insurance-d（喂领域知识），解析任务+识别领域场景]
    Step3 --> Step4[调用Agent B（喂领域案例+模板），生成领域适配参数]
    Step4 --> Step5[控制器调用MCP，执行任务]
    Step5 --> Step6[校验执行结果（成功/失败）]
    Step6 --> Step7{结果是否成功？}
    Step7 -- 成功 --> Step8[将参数/场景/结果存入“成功案例库”，更新参数模板]
    Step7 -- 失败 --> Step9[记录失败原因（如token过期/敏感词），存入“失败案例库”，更新领域规则]
    Step8 --> Step10[控制器优化智能体Prompt（追加成功案例参考）]
    Step9 --> Step10[控制器优化智能体Prompt（追加失败规避规则）]
    Step10 --> Step11[下次执行同类型任务，控制器优先喂新的领域知识]