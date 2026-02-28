import { Router, Response } from 'express'
import { z } from 'zod'
import { query } from '../db/index.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import type { ApiResponse, Category } from '../types/index.js'

const router = Router()

const createCategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空'),
  icon: z.string().optional().default('tag'),
  type: z.enum(['expense', 'income']),
  parentId: z.string().uuid().nullable().optional(),
})

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  type: z.enum(['expense', 'income']).optional(),
  parentId: z.string().uuid().nullable().optional(),
})

router.get('/', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Category[]>>) => {
  try {
    const { type } = req.query
    
    let sql = `SELECT id, user_id as "userId", name, icon, type, 
                      parent_id as "parentId", is_preset as "isPreset", is_system as "isSystem",
                      created_at as "createdAt", updated_at as "updatedAt"
               FROM categories 
               WHERE user_id = $1 OR is_system = true`
    
    const params: unknown[] = [req.userId]
    
    if (type && (type === 'expense' || type === 'income')) {
      sql += ` AND type = $2`
      params.push(type)
    }
    
    sql += ` ORDER BY is_system DESC, is_preset DESC, created_at ASC`

    const result = await query(sql, params)

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.post('/', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Category>>) => {
  try {
    const data = createCategorySchema.parse(req.body)

    if (data.parentId) {
      const parentCheck = await query(
        'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
        [data.parentId, req.userId]
      )
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: '父分类不存在',
        })
      }
    }

    const result = await query(
      `INSERT INTO categories (user_id, name, icon, type, parent_id, is_preset)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING id, user_id as "userId", name, icon, type, 
                 parent_id as "parentId", is_preset as "isPreset",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [req.userId, data.name, data.icon, data.type, data.parentId || null]
    )

    res.status(201).json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      })
    }
    console.error('Create category error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.get('/:id', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Category>>) => {
  try {
    const result = await query(
      `SELECT id, user_id as "userId", name, icon, type, 
              parent_id as "parentId", is_preset as "isPreset", is_system as "isSystem",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM categories 
       WHERE id = $1 AND (user_id = $2 OR is_system = true)`,
      [req.params.id, req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '分类不存在',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Get category error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.put('/:id', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Category>>) => {
  try {
    const data = updateCategorySchema.parse(req.body)

    // 检查分类是否存在且属于当前用户（非系统分类）
    const categoryCheck = await query(
      `SELECT id, is_system FROM categories WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    )

    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '分类不存在或无权修改',
      })
    }

    if (categoryCheck.rows[0].is_system) {
      return res.status(403).json({
        success: false,
        error: '系统分类不能修改',
      })
    }

    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`)
      values.push(data.name)
    }
    if (data.icon !== undefined) {
      fields.push(`icon = $${paramIndex++}`)
      values.push(data.icon)
    }
    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`)
      values.push(data.type)
    }
    if (data.parentId !== undefined) {
      fields.push(`parent_id = $${paramIndex++}`)
      values.push(data.parentId)
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有要更新的字段',
      })
    }

    fields.push(`updated_at = NOW()`)
    values.push(req.params.id)
    values.push(req.userId)

    const result = await query(
      `UPDATE categories SET ${fields.join(', ')} 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, user_id as "userId", name, icon, type, 
                 parent_id as "parentId", is_preset as "isPreset", is_system as "isSystem",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '分类不存在',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      })
    }
    console.error('Update category error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    // 检查分类是否存在且属于当前用户（非系统分类）
    const categoryCheck = await query(
      `SELECT id, is_system FROM categories WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    )

    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '分类不存在或无权删除',
      })
    }

    if (categoryCheck.rows[0].is_system) {
      return res.status(403).json({
        success: false,
        error: '系统分类不能删除',
      })
    }

    const result = await query(
      `DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '分类不存在',
      })
    }

    await query(
      'UPDATE categories SET parent_id = NULL WHERE parent_id = $1',
      [req.params.id]
    )

    res.json({
      success: true,
      message: '分类已删除',
    })
  } catch (error) {
    console.error('Delete category error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

export default router
