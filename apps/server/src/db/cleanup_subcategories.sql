-- 清理子分类数据
-- 1. 将使用子分类的交易记录更新为使用父分类
UPDATE transactions t
SET category_id = c.parent_id
FROM categories c
WHERE t.category_id = c.id AND c.parent_id IS NOT NULL;

-- 2. 删除所有子分类
DELETE FROM categories WHERE parent_id IS NOT NULL;