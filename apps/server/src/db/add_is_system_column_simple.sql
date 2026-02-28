-- 添加 is_system 字段到 categories 表
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- 更新现有的预设分类为系统分类
UPDATE categories SET is_system = TRUE WHERE is_preset = TRUE;