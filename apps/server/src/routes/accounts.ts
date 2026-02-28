import { Router, Response } from 'express'
import { z } from 'zod'
import { query } from '../db/index.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import type { ApiResponse, Account } from '../types/index.js'

const router = Router()

const createAccountSchema = z.object({
  name: z.string().min(1, '账户名称不能为空'),
  icon: z.string().optional().default('wallet'),
  currency: z.string().optional().default('CNY'),
  initialBalance: z.coerce.number().optional().default(0),
})

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  currency: z.string().optional(),
  initialBalance: z.coerce.number().optional(),
  currentBalance: z.coerce.number().optional(),
  isDeleted: z.boolean().optional(),
})

router.get('/', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Account[]>>) => {
  try {
    const result = await query(
      `SELECT id, user_id as "userId", name, icon, currency, 
              initial_balance as "initialBalance", current_balance as "currentBalance",
              is_preset as "isPreset", is_deleted as "isDeleted",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM accounts 
       WHERE user_id = $1 AND is_deleted = false
       ORDER BY is_preset DESC, created_at ASC`,
      [req.userId]
    )

    res.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error('Get accounts error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.post('/', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Account>>) => {
  try {
    const data = createAccountSchema.parse(req.body)

    const result = await query(
      `INSERT INTO accounts (user_id, name, icon, currency, initial_balance, current_balance, is_preset)
       VALUES ($1, $2, $3, $4, $5, $5, false)
       RETURNING id, user_id as "userId", name, icon, currency, 
                 initial_balance as "initialBalance", current_balance as "currentBalance",
                 is_preset as "isPreset", is_deleted as "isDeleted",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [req.userId, data.name, data.icon, data.currency, data.initialBalance]
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
    console.error('Create account error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.get('/:id', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Account>>) => {
  try {
    const result = await query(
      `SELECT id, user_id as "userId", name, icon, currency, 
              initial_balance as "initialBalance", current_balance as "currentBalance",
              is_preset as "isPreset", is_deleted as "isDeleted",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM accounts 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '账户不存在',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Get account error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.put('/:id', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Account>>) => {
  try {
    const data = updateAccountSchema.parse(req.body)

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
    if (data.currency !== undefined) {
      fields.push(`currency = $${paramIndex++}`)
      values.push(data.currency)
    }
    if (data.initialBalance !== undefined) {
      fields.push(`initial_balance = $${paramIndex++}`)
      values.push(data.initialBalance)
      fields.push(`current_balance = $${paramIndex++}`)
      values.push(data.initialBalance)
    }
    if (data.currentBalance !== undefined) {
      fields.push(`current_balance = $${paramIndex++}`)
      values.push(data.currentBalance)
    }
    if (data.isDeleted !== undefined) {
      fields.push(`is_deleted = $${paramIndex++}`)
      values.push(data.isDeleted)
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
      `UPDATE accounts SET ${fields.join(', ')} 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, user_id as "userId", name, icon, currency, 
                 initial_balance as "initialBalance", current_balance as "currentBalance",
                 is_preset as "isPreset", is_deleted as "isDeleted",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '账户不存在',
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
    console.error('Update account error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const result = await query(
      `UPDATE accounts SET is_deleted = true, updated_at = NOW() 
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '账户不存在',
      })
    }

    res.json({
      success: true,
      message: '账户已删除',
    })
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

export default router
