-- 查询所有分类，按名称、类型、是否系统分类排序
SELECT id, user_id, name, type, is_system, is_preset 
FROM categories 
ORDER BY name, type, is_system DESC, user_id;