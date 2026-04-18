-- 003: 为样式模板表新增 is_default 字段
-- 用于标记每个平台的默认模板

-- 添加 is_default 字段
ALTER TABLE style_templates 
ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- 为已存在的系统模板设置默认（每个平台第一个系统模板设为默认）
UPDATE style_templates 
SET is_default = true 
WHERE id IN (
  SELECT MIN(id) 
  FROM style_templates 
  WHERE is_system = true 
  GROUP BY platform
);

-- 创建部分索引：每个平台只能有一个默认模板
-- 注意：这个约束需要在应用层保证，PostgreSQL 部分唯一索引可能有兼容性问题
CREATE UNIQUE INDEX IF NOT EXISTS idx_style_templates_default_unique 
ON style_templates(platform) 
WHERE is_default = true;

-- 添加注释
COMMENT ON COLUMN style_templates.is_default IS '是否为该平台的默认模板，每个平台只能有一个默认模板';
