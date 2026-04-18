# 美化 SQL 查询结果的方法

## 方法 1：使用 jsonb_pretty() 函数（最简单）

PostgreSQL 内置的 `jsonb_pretty()` 函数可以格式化 JSON 输出！

```sql
SELECT 
  id,
  function_desc,
  tool_name,
  action_name,
  jsonb_pretty(param_examples) as param_examples,
  jsonb_pretty(interface_schema) as interface_schema,
  jsonb_pretty(agent_response_spec) as agent_response_spec,
  jsonb_pretty(metadata) as metadata
FROM capability_list
WHERE id IN (11, 14)
ORDER BY id;
```

---

## 方法 2：创建一个便捷视图

创建一个视图，自动格式化所有 JSON 字段！

```sql
-- 创建便捷视图
CREATE OR REPLACE VIEW v_capability_list_pretty AS
SELECT 
  id,
  capability_type,
  function_desc,
  status,
  requires_on_site_execution,
  tool_name,
  action_name,
  scene_tags,
  jsonb_pretty(param_examples) as param_examples,
  jsonb_pretty(param_template) as param_template,
  jsonb_pretty(interface_schema) as interface_schema,
  jsonb_pretty(agent_response_spec) as agent_response_spec,
  jsonb_pretty(metadata) as metadata,
  created_at,
  updated_at
FROM capability_list;

-- 使用视图查询
SELECT * FROM v_capability_list_pretty WHERE id IN (11, 14) ORDER BY id;
```

---

## 方法 3：分字段查询（避免太长的行）

分别查询各个字段，避免单行太长！

```sql
-- 查询基本信息
SELECT 
  id,
  function_desc,
  tool_name,
  action_name,
  status,
  scene_tags
FROM capability_list
WHERE id IN (11, 14)
ORDER BY id;

-- 查询参数示例
SELECT 
  id,
  function_desc,
  jsonb_pretty(param_examples) as param_examples
FROM capability_list
WHERE id IN (11, 14)
ORDER BY id;

-- 查询接口 Schema
SELECT 
  id,
  function_desc,
  jsonb_pretty(interface_schema) as interface_schema
FROM capability_list
WHERE id IN (11, 14)
ORDER BY id;

-- 查询 Agent B 返回规范
SELECT 
  id,
  function_desc,
  jsonb_pretty(agent_response_spec) as agent_response_spec
FROM capability_list
WHERE id IN (11, 14)
ORDER BY id;

-- 查询元数据
SELECT 
  id,
  function_desc,
  jsonb_pretty(metadata) as metadata
FROM capability_list
WHERE id IN (11, 14)
ORDER BY id;
```

---

## 方法 4：创建一个函数，逐条详细展示

```sql
-- 创建详细展示函数
CREATE OR REPLACE FUNCTION show_capability_detail(cap_id INTEGER)
RETURNS TABLE (
  field_name TEXT,
  field_value TEXT
) AS $$
BEGIN
  -- 基本信息
  RETURN QUERY SELECT 'id' as field_name, id::TEXT as field_value FROM capability_list WHERE id = cap_id;
  RETURN QUERY SELECT 'function_desc' as field_name, function_desc as field_value FROM capability_list WHERE id = cap_id;
  RETURN QUERY SELECT 'tool_name' as field_name, tool_name as field_value FROM capability_list WHERE id = cap_id;
  RETURN QUERY SELECT 'action_name' as field_name, action_name as field_value FROM capability_list WHERE id = cap_id;
  RETURN QUERY SELECT 'status' as field_name, status as field_value FROM capability_list WHERE id = cap_id;
  
  -- JSON 字段（格式化）
  RETURN QUERY SELECT 'param_examples' as field_name, jsonb_pretty(param_examples) as field_value FROM capability_list WHERE id = cap_id;
  RETURN QUERY SELECT 'interface_schema' as field_name, jsonb_pretty(interface_schema) as field_value FROM capability_list WHERE id = cap_id;
  RETURN QUERY SELECT 'agent_response_spec' as field_name, jsonb_pretty(agent_response_spec) as field_value FROM capability_list WHERE id = cap_id;
  RETURN QUERY SELECT 'metadata' as field_name, jsonb_pretty(metadata) as field_value FROM capability_list WHERE id = cap_id;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 使用函数查询 ID=14
SELECT * FROM show_capability_detail(14);

-- 使用函数查询 ID=11
SELECT * FROM show_capability_detail(11);
```

---

## 方法 5：只看关键字段（快速预览）

```sql
-- 快速预览（只看关键字段）
SELECT 
  id,
  function_desc,
  tool_name,
  action_name,
  status,
  jsonb_typeof(param_examples) as has_param_examples,
  jsonb_typeof(param_template) as has_param_template,
  jsonb_typeof(interface_schema) as has_interface_schema,
  jsonb_typeof(agent_response_spec) as has_agent_response_spec,
  jsonb_typeof(metadata) as has_metadata,
  scene_tags
FROM capability_list
WHERE id IN (11, 14)
ORDER BY id;
```

---

## 推荐使用方法

### 日常查询：方法 1（最简单）
```sql
SELECT 
  id,
  function_desc,
  tool_name,
  action_name,
  jsonb_pretty(param_examples) as param_examples,
  jsonb_pretty(interface_schema) as interface_schema
FROM capability_list
WHERE id IN (11, 14)
ORDER BY id;
```

### 详细查看：方法 4（逐条展示）
```sql
-- 查看 ID=14 的详细信息
SELECT * FROM show_capability_detail(14);

-- 查看 ID=11 的详细信息
SELECT * FROM show_capability_detail(11);
```

### 长期使用：方法 2（创建视图）
```sql
-- 先创建视图（只需执行一次）
CREATE OR REPLACE VIEW v_capability_list_pretty AS
SELECT 
  id,
  function_desc,
  tool_name,
  action_name,
  jsonb_pretty(param_examples) as param_examples,
  jsonb_pretty(interface_schema) as interface_schema,
  jsonb_pretty(agent_response_spec) as agent_response_spec,
  jsonb_pretty(metadata) as metadata
FROM capability_list;

-- 以后直接用视图查询
SELECT * FROM v_capability_list_pretty WHERE id IN (11, 14) ORDER BY id;
```
