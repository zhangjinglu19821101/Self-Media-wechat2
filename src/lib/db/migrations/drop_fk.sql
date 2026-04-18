-- 删除 agent_sub_tasks 表的外键约束
-- 先查询约束名称
DO $$
DECLARE
    fk_name text;
BEGIN
    -- 查找并删除 agent_sub_tasks 的外键约束
    FOR fk_name IN 
        SELECT tc.constraint_name
        FROM information_schema.table_constraints AS tc
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'agent_sub_tasks'
    LOOP
        EXECUTE format('ALTER TABLE agent_sub_tasks DROP CONSTRAINT IF EXISTS %I', fk_name);
        RAISE NOTICE 'Dropped foreign key constraint: %', fk_name;
    END LOOP;

    -- 查找并删除 agent_sub_tasks_step_history 的外键约束
    FOR fk_name IN 
        SELECT tc.constraint_name
        FROM information_schema.table_constraints AS tc
        WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'agent_sub_tasks_step_history'
    LOOP
        EXECUTE format('ALTER TABLE agent_sub_tasks_step_history DROP CONSTRAINT IF EXISTS %I', fk_name);
        RAISE NOTICE 'Dropped foreign key constraint: %', fk_name;
    END LOOP;
END $$;

-- 添加索引（如果还没有）
CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_command_result_id ON agent_sub_tasks(command_result_id);
CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_executor_date ON agent_sub_tasks(from_parents_executor, execution_date);
CREATE INDEX IF NOT EXISTS idx_agent_sub_tasks_status ON agent_sub_tasks(status);

CREATE INDEX IF NOT EXISTS idx_step_history_command_result_id ON agent_sub_tasks_step_history(command_result_id);
CREATE INDEX IF NOT EXISTS idx_step_history_interact_time ON agent_sub_tasks_step_history(interact_time);

-- 验证外键已删除
SELECT 'Foreign keys in agent_sub_tasks:' as info;
SELECT tc.constraint_name, tc.table_name, kcu.column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'agent_sub_tasks';

SELECT 'Foreign keys in agent_sub_tasks_step_history:' as info;
SELECT tc.constraint_name, tc.table_name, kcu.column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'agent_sub_tasks_step_history';
