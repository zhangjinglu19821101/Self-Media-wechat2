
-- ============================================================
-- 数据库迁移：新增 interact_type 字段并修改唯一约束
-- ============================================================

-- 1. 新增 interact_type 字段
ALTER TABLE agent_sub_tasks_step_history 
  ADD COLUMN IF NOT EXISTS interact_type VARCHAR(32);

-- 2. 为现有数据设置默认值（如果有）
UPDATE agent_sub_tasks_step_history 
  SET interact_type = 'agent_consult' 
  WHERE interact_type IS NULL;

-- 3. 设置为非空
ALTER TABLE agent_sub_tasks_step_history 
  ALTER COLUMN interact_type SET NOT NULL;

-- 4. 删除旧的唯一约束
ALTER TABLE agent_sub_tasks_step_history 
  DROP CONSTRAINT IF EXISTS idx_command_result_step_no;

-- 5. 新增唯一约束（包含 interact_type 和 interact_user）
-- 顺序：command_result_id, step_no, interact_num, interact_type, interact_user
-- 这样可以支持同一轮交互中，同一个agent的多条记录（通过interactUser区分）
ALTER TABLE agent_sub_tasks_step_history 
  ADD CONSTRAINT idx_task_step_num_type_user 
  UNIQUE (command_result_id, step_no, interact_num, interact_type, interact_user);

-- 6. 添加注释
COMMENT ON COLUMN agent_sub_tasks_step_history.interact_type IS '交互类型：request（请求）/response（响应）';

