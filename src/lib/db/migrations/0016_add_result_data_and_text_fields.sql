-- Migration: 0016_add_result_data_and_text_fields
-- Description: 新增 result_data 和 result_text 字段，删除 execution_result 字段
-- Date: 2026-02-24

-- 1. 新增 result_data 字段（JSONB 格式，存结构化数据）
ALTER TABLE agent_sub_tasks 
ADD COLUMN IF NOT EXISTS result_data JSONB;

-- 2. 新增 result_text 字段（TEXT 格式，存文本化结果）
ALTER TABLE agent_sub_tasks 
ADD COLUMN IF NOT EXISTS result_text TEXT;

-- 3. 数据迁移：把 existing execution_result 同步到新字段
UPDATE agent_sub_tasks 
SET 
  result_data = execution_result::JSONB,
  result_text = (execution_result::JSONB)->>'result'
WHERE execution_result IS NOT NULL 
  AND execution_result != '' 
  AND execution_result != 'null';

-- 4. 删除旧字段 execution_result
ALTER TABLE agent_sub_tasks 
DROP COLUMN IF EXISTS execution_result;
