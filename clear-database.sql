-- 清空数据库表数据
-- 注意：这个脚本会删除所有表中的数据，请谨慎使用

-- 清空 agent_notifications 表
TRUNCATE TABLE agent_notifications CASCADE;

-- 清空 agent_tasks 表
TRUNCATE TABLE agent_tasks CASCADE;

-- 清空 daily_tasks 表
TRUNCATE TABLE daily_tasks CASCADE;

-- 清空 task_assignments 表
TRUNCATE TABLE task_assignments CASCADE;

SELECT 'All tables have been cleared successfully.' AS result;
