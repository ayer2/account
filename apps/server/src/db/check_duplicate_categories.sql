-- 查看重复的系统分类
SELECT name, type, COUNT(*) as count
FROM categories
WHERE is_system = true
GROUP BY name, type
HAVING COUNT(*) > 1;

-- 查看所有系统分类
SELECT id, name, type, is_system
FROM categories
WHERE is_system = true
ORDER BY name, type;