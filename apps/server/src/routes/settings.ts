import { Router, Response } from 'express'
import { z } from 'zod'
import { query } from '../db/index.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import type { ApiResponse, AppSettings } from '../types/index.js'

const router = Router()

const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  language: z.enum(['zh-CN', 'en-US']).optional(),
  lastUsedAccountId: z.string().uuid().nullable().optional(),
  monthlyBudget: z.coerce.number().min(0).optional(),
  budgetAlertEnabled: z.boolean().optional(),
  budgetAlertThreshold: z.coerce.number().min(0).max(100).optional(),
})

router.get('/', authenticate, async (req: AuthRequest, res: Response<ApiResponse<AppSettings>>) => {
  try {
    let result = await query(
      `SELECT id, user_id as "userId", theme, language, 
              last_used_account_id as "lastUsedAccountId",
              COALESCE(monthly_budget, 0) as "monthlyBudget",
              COALESCE(budget_alert_enabled, false) as "budgetAlertEnabled",
              COALESCE(budget_alert_threshold, 80) as "budgetAlertThreshold",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM app_settings 
       WHERE user_id = $1`,
      [req.userId]
    )

    if (result.rows.length === 0) {
      result = await query(
        `INSERT INTO app_settings (user_id) VALUES ($1)
         RETURNING id, user_id as "userId", theme, language, 
                   last_used_account_id as "lastUsedAccountId",
                   0 as "monthlyBudget",
                   false as "budgetAlertEnabled",
                   80 as "budgetAlertThreshold",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [req.userId]
      )
    }

    res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Get settings error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.put('/', authenticate, async (req: AuthRequest, res: Response<ApiResponse<AppSettings>>) => {
  try {
    const data = updateSettingsSchema.parse(req.body)

    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (data.theme !== undefined) {
      fields.push(`theme = $${paramIndex++}`)
      values.push(data.theme)
    }
    if (data.language !== undefined) {
      fields.push(`language = $${paramIndex++}`)
      values.push(data.language)
    }
    if (data.lastUsedAccountId !== undefined) {
      fields.push(`last_used_account_id = $${paramIndex++}`)
      values.push(data.lastUsedAccountId)
    }
    if (data.monthlyBudget !== undefined) {
      fields.push(`monthly_budget = $${paramIndex++}`)
      values.push(data.monthlyBudget)
    }
    if (data.budgetAlertEnabled !== undefined) {
      fields.push(`budget_alert_enabled = $${paramIndex++}`)
      values.push(data.budgetAlertEnabled)
    }
    if (data.budgetAlertThreshold !== undefined) {
      fields.push(`budget_alert_threshold = $${paramIndex++}`)
      values.push(data.budgetAlertThreshold)
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有要更新的字段',
      })
    }

    fields.push(`updated_at = NOW()`)
    values.push(req.userId)

    let result = await query(
      `UPDATE app_settings SET ${fields.join(', ')} 
       WHERE user_id = $${paramIndex}
       RETURNING id, user_id as "userId", theme, language, 
                 last_used_account_id as "lastUsedAccountId",
                 COALESCE(monthly_budget, 0) as "monthlyBudget",
                 COALESCE(budget_alert_enabled, false) as "budgetAlertEnabled",
                 COALESCE(budget_alert_threshold, 80) as "budgetAlertThreshold",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )

    if (result.rows.length === 0) {
      result = await query(
        `INSERT INTO app_settings (user_id, ${fields.slice(0, -1).join(', ')})
         VALUES ($1, ${fields.slice(0, -1).map((_, i) => `$${i + 2}`).join(', ')})
         RETURNING id, user_id as "userId", theme, language, 
                   last_used_account_id as "lastUsedAccountId",
                   COALESCE(monthly_budget, 0) as "monthlyBudget",
                   COALESCE(budget_alert_enabled, false) as "budgetAlertEnabled",
                   COALESCE(budget_alert_threshold, 80) as "budgetAlertThreshold",
                   created_at as "createdAt", updated_at as "updatedAt"`,
        [req.userId, ...values.slice(0, -1)]
      )
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
    console.error('Update settings error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

export default router
