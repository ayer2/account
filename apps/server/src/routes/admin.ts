import { Router, Response } from 'express'
import { z } from 'zod'
import { query } from '../db/index.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import type { ApiResponse } from '../types/index.js'

const router = Router()

export async function getUserAiConfig(userId: string): Promise<{ apiKey: string; modelName: string; provider: string } | null> {
  try {
    console.log('getUserAiConfig called with userId:', userId)
    
    const result = await query(
      `SELECT id, api_key as "apiKey", model_name as "modelName", provider, is_active as "isActive", user_id as "userId"
       FROM ai_config 
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    )
    
    console.log('AI config query result:', result.rows)
    
    if (result.rows.length === 0) {
      console.log('No AI config found for user:', userId)
      return null
    }
    
    const row = result.rows[0]
    console.log('Found AI config:', row)
    return {
      apiKey: row.apiKey,
      modelName: row.modelName,
      provider: row.provider,
    }
  } catch (error) {
    console.error('Get user AI config error:', error)
    return null
  }
}

const adminAuthenticate = async (req: AuthRequest, res: Response, next: Function) => {
  await authenticate(req, res, () => {})
  if (!req.userId) {
    return res.status(401).json({ success: false, error: '未登录' })
  }
  
  const result = await query(
    'SELECT role FROM users WHERE id = $1',
    [req.userId]
  )
  
  if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
    return res.status(403).json({ success: false, error: '无权限访问' })
  }
  
  next()
}

const userSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.boolean().optional(),
})

const aiConfigSchema = z.object({
  userId: z.string().uuid().optional(),
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  modelName: z.string().optional(),
  isActive: z.boolean().optional(),
})

router.use(adminAuthenticate)

router.get('/users', async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const result = await query(
      `SELECT id, email, username, role, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM users ORDER BY created_at DESC`
    )
    
    res.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ success: false, error: '服务器错误' })
  }
})

router.put('/users/:id', async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const { id } = req.params
    const data = userSchema.parse(req.body)
    
    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1
    
    if (data.role !== undefined) {
      fields.push(`role = $${paramIndex++}`)
      values.push(data.role)
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`)
      values.push(data.isActive)
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' })
    }
    
    fields.push(`updated_at = NOW()`)
    values.push(id)
    
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING id, email, username, role, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '用户不存在' })
    }
    
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message })
    }
    console.error('Update user error:', error)
    res.status(500).json({ success: false, error: '服务器错误' })
  }
})

router.get('/ai-config', async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const result = await query(
      `SELECT id, user_id as "userId", provider, api_key as "apiKey", model_name as "modelName", 
              is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
       FROM ai_config ORDER BY created_at DESC`
    )
    
    const configRows = result.rows.map((row: Record<string, unknown>) => ({
      ...row,
      apiKey: row.apiKey ? '••••••••' + String(row.apiKey).slice(-4) : null,
    }))
    
    res.json({ success: true, data: configRows })
  } catch (error) {
    console.error('Get AI config error:', error)
    res.status(500).json({ success: false, error: '服务器错误' })
  }
})

router.post('/ai-config', async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const data = aiConfigSchema.parse(req.body)
    const targetUserId = data.userId || req.userId
    
    const result = await query(
      `INSERT INTO ai_config (user_id, provider, api_key, model_name, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id as "userId", provider, api_key as "apiKey", model_name as "modelName", 
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [targetUserId, data.provider || 'openai', data.apiKey || '', data.modelName || 'gpt-3.5-turbo', data.isActive ?? true]
    )
    
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message })
    }
    console.error('Create AI config error:', error)
    res.status(500).json({ success: false, error: '服务器错误' })
  }
})

router.put('/ai-config/:id', async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const { id } = req.params
    const data = aiConfigSchema.parse(req.body)
    
    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1
    
    if (data.provider !== undefined) {
      fields.push(`provider = $${paramIndex++}`)
      values.push(data.provider)
    }
    if (data.apiKey !== undefined && data.apiKey !== '') {
      fields.push(`api_key = $${paramIndex++}`)
      values.push(data.apiKey)
    }
    if (data.modelName !== undefined) {
      fields.push(`model_name = $${paramIndex++}`)
      values.push(data.modelName)
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`)
      values.push(data.isActive)
    }
    
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' })
    }
    
    fields.push(`updated_at = NOW()`)
    values.push(id)
    
    const result = await query(
      `UPDATE ai_config SET ${fields.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING id, user_id as "userId", provider, api_key as "apiKey", model_name as "modelName", 
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '配置不存在' })
    }
    
    const row = result.rows[0]
    res.json({
      success: true,
      data: {
        ...row,
        apiKey: row.apiKey ? '••••••••' + String(row.apiKey).slice(-4) : null,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0].message })
    }
    console.error('Update AI config error:', error)
    res.status(500).json({ success: false, error: '服务器错误' })
  }
})

router.delete('/ai-config/:id', async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const { id } = req.params
    
    const result = await query(
      'DELETE FROM ai_config WHERE id = $1 RETURNING id',
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '配置不存在' })
    }
    
    res.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete AI config error:', error)
    res.status(500).json({ success: false, error: '服务器错误' })
  }
})

router.get('/categories', async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const result = await query(
      `SELECT c.id, c.user_id as "userId", c.name, c.icon, c.type, c.parent_id as "parentId", 
              c.is_preset as "isPreset", c.created_at as "createdAt"
       FROM categories c
       ORDER BY c.type, c.name`
    )
    
    const usersResult = await query('SELECT id, username, email FROM users')
    const usersMap = new Map(usersResult.rows.map((u: Record<string, unknown>) => [u.id, u]))
    
    const categoriesWithUser = result.rows.map((c: Record<string, unknown>) => ({
      ...c,
      user: usersMap.get(c.userId) || null,
    }))
    
    res.json({ success: true, data: categoriesWithUser })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ success: false, error: '服务器错误' })
  }
})

router.delete('/categories/:id', async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const { id } = req.params
    
    const result = await query(
      'DELETE FROM categories WHERE id = $1 AND is_preset = FALSE RETURNING id',
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '分类不存在或为预设分类无法删除' })
    }
    
    res.json({ success: true, data: null })
  } catch (error) {
    console.error('Delete category error:', error)
    res.status(500).json({ success: false, error: '服务器错误' })
  }
})

export default router
