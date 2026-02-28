-- 清理重复的系统分类
-- 1. 为每个(name, type)组合选择一个保留的ID
WITH duplicate_categories AS (
  SELECT 
    name, 
    type, 
    MIN(id) as keep_id,
    ARRAY_AGG(id) as all_ids
  FROM categories
  WHERE is_system = true
  GROUP BY name, type
  HAVING COUNT(*) > 1
),
-- 2. 收集所有需要删除的ID
ids_to_delete AS (
  SELECT 
    UNNEST(all_ids) as id
  FROM duplicate_categories
  WHERE UNNEST(all_ids) != keep_id
)
-- 3. 更新使用了要删除的分类ID的交易记录
UPDATE transactions t
SET category_id = dc.keep_id
FROM duplicate_categories dc
WHERE EXISTS (
  SELECT 1 
  FROM ids_to_delete d 
  WHERE t.category_id = d.id
  AND d.id = ANY(dc.all_ids)
);

-- 4. 删除重复的分类
DELETE FROM categories
WHERE id IN (SELECT id FROM ids_to_delete);

-- 5. 验证结果
SELECT name, type, COUNT(*) as count
FROM categories
WHERE is_system = true
GROUP BY name, type
HAVING COUNT(*) > 1;

SELECT COUNT(*) as remaining_system_categories
FROM categories
WHERE is_system = true;