-- =====================================================
-- 样式模板表迁移脚本
-- 创建时间：2024-01-01
-- 说明：创建 style_templates 表并预置系统模板数据
-- =====================================================

-- 1. 创建样式模板表
CREATE TABLE IF NOT EXISTS style_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  html_content TEXT NOT NULL,
  platform VARCHAR(50) NOT NULL DEFAULT '公众号',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_style_templates_platform ON style_templates(platform);
CREATE INDEX IF NOT EXISTS idx_style_templates_is_system ON style_templates(is_system);

-- 3. 预置系统模板数据
INSERT INTO style_templates (name, html_content, platform, is_system) VALUES 
(
  '公众号标准样式',
  '<section style="text-align:center; background:#fff; padding:0 10px;">
  <p style="font-size:14px; color:#E67E22; font-weight:bold; line-height:1.6; margin:0 0 1em;">【开头引导语，橙色加粗】</p>

  <h2 style="font-size:14px; color:#52C41A; font-weight:bold; text-align:center; margin:1em 0;">一、一级标题（绿色）</h2>
  <hr style="border:none; border-top:1px solid #eee; margin:0.5em auto; width:90%;">
  
  <h3 style="font-size:14px; color:#000; font-weight:bold; line-height:1.75; text-align:center; margin:1em 0;">1. 二级标题（黑色）</h3>
  <p style="font-size:14px; color:#3E3E3E; line-height:1.6; text-align:center; margin:0 0 1em;">正文内容...</p>
  
  <p style="font-size:14px; color:#FF0000; font-weight:bold; text-align:center; margin:0 0 1em;">⚠️ 重要提醒（红色加粗）</p>

  <h2 style="font-size:14px; color:#52C41A; font-weight:bold; text-align:center; margin:1em 0;">二、一级标题（绿色）</h2>
  <hr style="border:none; border-top:1px solid #eee; margin:0.5em auto; width:90%;">

  <p style="font-size:14px; color:#3E3E3E; line-height:1.6; text-align:center; margin:2em 0 1em;">【互动提问】</p>
  <p style="font-size:12px; color:#666; line-height:1.5; text-align:center; margin:1em 0;">【免责声明】本文仅为知识科普，不构成投资/购买建议。</p>
</section>',
  '公众号',
  true
);

-- 4. 更新时间戳触发器（可选）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_style_templates_updated_at 
    BEFORE UPDATE ON style_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 完成
SELECT '样式模板表创建成功，已预置 1 个系统模板' as result;
