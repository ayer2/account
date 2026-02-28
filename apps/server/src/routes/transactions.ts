import { Router, Response } from 'express'
import { z } from 'zod'
import { query, getClient } from '../db/index.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import type { ApiResponse, Transaction, TransactionType } from '../types/index.js'

const router = Router()

const createTransactionSchema = z.object({
  type: z.enum(['expense', 'income', 'transfer', 'refund', 'lend', 'borrow']),
  amount: z.coerce.number().positive('金额必须大于0'),
  accountId: z.string().uuid('账户ID无效'),
  toAccountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式无效'),
  time: z.string().regex(/^\d{2}:\d{2}$/, '时间格式无效').optional().default('00:00'),
  note: z.string().optional().default(''),
  source: z.enum(['manual', 'import']).optional().default('manual'),
  originalRefundId: z.string().uuid().nullable().optional(),
})

const updateTransactionSchema = z.object({
  type: z.enum(['expense', 'income', 'transfer', 'refund', 'lend', 'borrow']).optional(),
  amount: z.coerce.number().positive().optional(),
  accountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  note: z.string().optional(),
  source: z.enum(['manual', 'import']).optional(),
})

router.get('/', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Transaction[]>>) => {
  try {
    const { 
      startDate, 
      endDate, 
      accountId, 
      categoryId, 
      type,
      limit = '100',
      offset = '0'
    } = req.query

    let sql = `SELECT id, user_id as "userId", type, amount, account_id as "accountId",
                      to_account_id as "toAccountId", category_id as "categoryId",
                      date, time, note, source, original_refund_id as "originalRefundId",
                      created_at as "createdAt", updated_at as "updatedAt"
               FROM transactions 
               WHERE user_id = $1`
    
    const params: unknown[] = [req.userId]
    let paramIndex = 2

    if (startDate && typeof startDate === 'string') {
      sql += ` AND date >= $${paramIndex++}`
      params.push(startDate)
    }
    if (endDate && typeof endDate === 'string') {
      sql += ` AND date <= $${paramIndex++}`
      params.push(endDate)
    }
    if (accountId && typeof accountId === 'string') {
      sql += ` AND (account_id = $${paramIndex} OR to_account_id = $${paramIndex})`
      params.push(accountId)
      paramIndex++
    }
    if (categoryId && typeof categoryId === 'string') {
      sql += ` AND category_id = $${paramIndex++}`
      params.push(categoryId)
    }
    if (type && typeof type === 'string' && type !== 'all') {
      sql += ` AND type = $${paramIndex++}`
      params.push(type)
    }
    
    sql += ` ORDER BY date DESC, time DESC, created_at DESC`
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`
    params.push(parseInt(limit as string) || 100)
    params.push(parseInt(offset as string) || 0)

    const result = await query(sql, params)

    const countSql = `SELECT COUNT(*) as total FROM transactions WHERE user_id = $1`
    const countResult = await query(countSql, [req.userId])

    res.json({
      success: true,
      data: {
        list: result.rows,
        total: parseInt(countResult.rows[0].total),
      } as any,
    })
  } catch (error) {
    console.error('Get transactions error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.post('/', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Transaction>>) => {
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    
    const data = createTransactionSchema.parse(req.body)

    const accountCheck = await client.query(
      'SELECT id, current_balance FROM accounts WHERE id = $1 AND user_id = $2',
      [data.accountId, req.userId]
    )
    if (accountCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        error: '账户不存在',
      })
    }

    const source = (data.source || 'manual') as 'manual' | 'import'

    const result = await client.query(
      `INSERT INTO transactions (user_id, type, amount, account_id, to_account_id, category_id, date, time, note, source, original_refund_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, user_id as "userId", type, amount, account_id as "accountId",
                 to_account_id as "toAccountId", category_id as "categoryId",
                 date, time, note, source, original_refund_id as "originalRefundId",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        req.userId, data.type, data.amount, data.accountId, data.toAccountId || null,
        data.categoryId || null, data.date, data.time, data.note, source, data.originalRefundId || null
      ]
    )

    const oldBalance = parseFloat(accountCheck.rows[0].current_balance) || 0
    let newBalance = oldBalance

    switch (data.type) {
      case 'expense':
      case 'lend':
        newBalance = oldBalance - data.amount
        break
      case 'income':
      case 'borrow':
        newBalance = oldBalance + data.amount
        break
      case 'transfer':
        if (data.toAccountId) {
          await client.query(
            'UPDATE accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
            [data.amount, data.toAccountId]
          )
        }
        break
      case 'refund':
        newBalance = oldBalance + data.amount
        break
    }

    await client.query(
      'UPDATE accounts SET current_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, data.accountId]
    )

    await client.query('COMMIT')

    res.status(201).json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    await client.query('ROLLBACK')
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      })
    }
    console.error('Create transaction error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  } finally {
    client.release()
  }
})

router.get('/:id', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Transaction>>) => {
  try {
    const result = await query(
      `SELECT id, user_id as "userId", type, amount, account_id as "accountId",
              to_account_id as "toAccountId", category_id as "categoryId",
              date, time, note, source, original_refund_id as "originalRefundId",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM transactions 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: '交易记录不存在',
      })
    }

    res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Get transaction error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.put('/:id', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Transaction>>) => {
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    
    const data = updateTransactionSchema.parse(req.body)

    const existingTx = await client.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (existingTx.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        error: '交易记录不存在',
      })
    }

    const oldTx = existingTx.rows[0]

    if (data.accountId && data.accountId !== oldTx.account_id) {
      const oldAccount = await client.query(
        'SELECT current_balance FROM accounts WHERE id = $1',
        [oldTx.account_id]
      )
      const newAccount = await client.query(
        'SELECT current_balance FROM accounts WHERE id = $1 AND user_id = $2',
        [data.accountId, req.userId]
      )
      
      if (newAccount.rows.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({
          success: false,
          error: '目标账户不存在',
        })
      }

      let amount = data.amount ?? oldTx.amount
      let oldType = oldTx.type as TransactionType
      let newType = data.type ?? oldType

      const revertAmount = (type: TransactionType, amount: number) => {
        if (type === 'expense' || type === 'lend') return amount
        if (type === 'income' || type === 'borrow') return -amount
        return 0
      }
      const applyAmount = (type: TransactionType, amount: number) => {
        if (type === 'expense' || type === 'lend') return -amount
        if (type === 'income' || type === 'borrow') return amount
        return 0
      }

      await client.query(
        'UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2',
        [revertAmount(oldType, oldTx.amount), oldTx.account_id]
      )
      await client.query(
        'UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2',
        [applyAmount(newType, amount), data.accountId]
      )
    }

    const fields: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`)
      values.push(data.type)
    }
    if (data.amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`)
      values.push(data.amount)
    }
    if (data.accountId !== undefined) {
      fields.push(`account_id = $${paramIndex++}`)
      values.push(data.accountId)
    }
    if (data.toAccountId !== undefined) {
      fields.push(`to_account_id = $${paramIndex++}`)
      values.push(data.toAccountId)
    }
    if (data.categoryId !== undefined) {
      fields.push(`category_id = $${paramIndex++}`)
      values.push(data.categoryId)
    }
    if (data.date !== undefined) {
      fields.push(`date = $${paramIndex++}`)
      values.push(data.date)
    }
    if (data.time !== undefined) {
      fields.push(`time = $${paramIndex++}`)
      values.push(data.time)
    }
    if (data.note !== undefined) {
      fields.push(`note = $${paramIndex++}`)
      values.push(data.note)
    }
    if (data.source !== undefined) {
      fields.push(`source = $${paramIndex++}`)
      values.push(data.source)
    }

    if (fields.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        error: '没有要更新的字段',
      })
    }

    fields.push(`updated_at = NOW()`)
    values.push(req.params.id)
    values.push(req.userId)

    const result = await client.query(
      `UPDATE transactions SET ${fields.join(', ')} 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, user_id as "userId", type, amount, account_id as "accountId",
                 to_account_id as "toAccountId", category_id as "categoryId",
                 date, time, note, source, original_refund_id as "originalRefundId",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    )

    await client.query('COMMIT')

    res.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    await client.query('ROLLBACK')
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      })
    }
    console.error('Update transaction error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  } finally {
    client.release()
  }
})

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response<ApiResponse>) => {
  const client = await getClient()
  
  try {
    await client.query('BEGIN')
    
    const existingTx = await client.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (existingTx.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        error: '交易记录不存在',
      })
    }

    const oldTx = existingTx.rows[0]

    const revertAmount = (type: TransactionType, amount: number) => {
      if (type === 'expense' || type === 'lend') return amount
      if (type === 'income' || type === 'borrow') return -amount
      return 0
    }

    await client.query(
      'UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2',
      [revertAmount(oldTx.type as TransactionType, parseFloat(oldTx.amount)), oldTx.account_id]
    )

    if (oldTx.to_account_id) {
      if (oldTx.type === 'transfer') {
        await client.query(
          'UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2',
          [parseFloat(oldTx.amount), oldTx.to_account_id]
        )
      }
    }

    await client.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )

    await client.query('COMMIT')

    res.json({
      success: true,
      message: '交易记录已删除',
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Delete transaction error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  } finally {
    client.release()
  }
})

// 自动创建交易接口（由 Android App 调用）
const autoCreateTransactionSchema = z.object({
  type: z.enum(['expense', 'income', 'transfer', 'refund', 'lend', 'borrow']),
  amount: z.coerce.number().positive('金额必须大于0'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式无效'),
  time: z.string().regex(/^\d{2}:\d{2}$/, '时间格式无效').optional().default('00:00'),
  note: z.string().optional().default(''),
  source: z.string().optional().default('auto_alipay'),
  merchant: z.string().optional().default(''),
  accountName: z.string().optional().default(''),
})

router.post('/auto', authenticate, async (req: AuthRequest, res: Response<ApiResponse<Transaction>>) => {
  const client = await getClient()
  try {
    const data = autoCreateTransactionSchema.parse(req.body)

    // 获取用户的默认账户（优先匹配支付宝或微信）
    let accountId = ''
    const accountName = data.accountName?.toLowerCase() || ''
    
    let accountQuery = `
      SELECT id FROM accounts 
      WHERE user_id = $1 AND is_deleted = FALSE
    `
    const accountParams: unknown[] = [req.userId]
    
    // 尝试根据账户名称匹配
    if (accountName.includes('支付宝') || accountName.includes('alipay')) {
      accountQuery += ` AND (name LIKE '%支付宝%' OR name LIKE '%Alipay%')`
    } else if (accountName.includes('微信') || accountName.includes('wechat')) {
      accountQuery += ` AND (name LIKE '%微信%' OR name LIKE '%WeChat%')`
    }
    
    const accountResult = await client.query(accountQuery + ' LIMIT 1', accountParams)
    
    if (accountResult.rows.length > 0) {
      accountId = accountResult.rows[0].id
    } else {
      // 如果没有匹配的账户，获取第一个账户
      const defaultAccountResult = await client.query(
        'SELECT id FROM accounts WHERE user_id = $1 AND is_deleted = FALSE LIMIT 1',
        [req.userId]
      )
      if (defaultAccountResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请先创建账户',
        })
      }
      accountId = defaultAccountResult.rows[0].id
    }

    // 尝试匹配分类
    let categoryId: string | null = null
    const merchant = data.merchant || ''
    const note = data.note || merchant || ''
    
    if (data.type !== 'transfer') {
      // 尝试根据备注/商户名匹配分类
      const categoryResult = await client.query(`
        SELECT c.id FROM categories c
        WHERE (c.user_id = $1 OR c.user_id IS NULL OR c.is_system = TRUE)
        AND c.type = $2
        AND ($3 LIKE '%' || c.name || '%')
        LIMIT 1
      `, [req.userId, data.type === 'income' ? 'income' : 'expense', note])
      
      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].id
      }
    }

    const transactionId = crypto.randomUUID()
    const now = new Date().toISOString()

    await client.query(`
      INSERT INTO transactions (
        id, user_id, type, amount, account_id, to_account_id, 
        category_id, date, time, note, source, original_refund_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      transactionId,
      req.userId,
      data.type,
      data.amount,
      accountId,
      null,
      categoryId,
      data.date,
      data.time || '00:00',
      note,
      data.source,
      null,
      now,
      now,
    ])

    // 更新账户余额
    if (data.type === 'expense' || data.type === 'lend') {
      await client.query(
        'UPDATE accounts SET current_balance = current_balance - $1, updated_at = $3 WHERE id = $2',
        [data.amount, accountId, now]
      )
    } else if (data.type === 'income' || data.type === 'refund' || data.type === 'borrow') {
      await client.query(
        'UPDATE accounts SET current_balance = current_balance + $1, updated_at = $3 WHERE id = $2',
        [data.amount, accountId, now]
      )
    }

    res.status(201).json({
      success: true,
      data: {
        id: transactionId,
        userId: req.userId || '',
        type: data.type,
        amount: data.amount,
        accountId,
        toAccountId: null,
        categoryId,
        date: data.date,
        time: data.time || '00:00',
        note,
        source: data.source as 'manual' | 'import',
        originalRefundId: null,
        createdAt: now,
        updatedAt: now,
      },
    })
  } catch (error) {
    console.error('Auto create transaction error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  } finally {
    client.release()
  }
})

export default router
