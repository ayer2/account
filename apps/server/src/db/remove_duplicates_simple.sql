-- 清理重复的系统分类
-- 1. 为每个(name, type)组合删除重复的记录，只保留第一条
WITH ranked_categories AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY name, type ORDER BY id) as rn
  FROM categories
  WHERE is_system = true
)
DELETE FROM categories
WHERE id IN (
  SELECT id FROM ranked_categories WHERE rn > 1
);

-- 2. 验证结果
SELECT name, type, COUNT(*) as count
FROM categories
WHERE is_system = true
GROUP BY name, type
HAVING COUNT(*) > 1;

SELECT COUNT(*) as remaining_system_categories
FROM categories
WHERE is_system = true;