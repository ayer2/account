-- 1. 首先创建真正的系统级分类（如果还没有）
INSERT INTO categories (name, icon, type, is_system, is_preset)
VALUES 
  ('餐饮', 'restaurant', 'expense', true, true),
  ('交通', 'car', 'expense', true, true),
  ('购物', 'shopping', 'expense', true, true),
  ('娱乐', 'play-circle', 'expense', true, true),
  ('居住', 'home', 'expense', true, true),
  ('通讯', 'phone', 'expense', true, true),
  ('医疗', 'medicine-box', 'expense', true, true),
  ('教育', 'book', 'expense', true, true),
  ('其他', 'more', 'expense', true, true),
  ('工资', 'dollar', 'income', true, true),
  ('奖金', 'trophy', 'income', true, true),
  ('投资收益', 'rise', 'income', true, true),
  ('其他', 'more', 'income', true, true)
ON CONFLICT DO NOTHING;

-- 2. 为每个用户的交易记录更新分类ID，将用户级分类替换为系统级分类
WITH system_categories AS (
  SELECT name, type, id as system_id
  FROM categories
  WHERE is_system = true
)
UPDATE transactions t
SET category_id = sc.system_id
FROM categories c
JOIN system_categories sc ON c.name = sc.name AND c.type = sc.type
WHERE t.category_id = c.id AND c.is_system = false;

-- 3. 删除所有非系统的预设分类
DELETE FROM categories 
WHERE is_preset = true AND is_system = false;

-- 4. 验证结果
SELECT COUNT(*) as total_categories FROM categories;
SELECT COUNT(*) as system_categories FROM categories WHERE is_system = true;
SELECT COUNT(*) as user_categories FROM categories WHERE is_system = false;