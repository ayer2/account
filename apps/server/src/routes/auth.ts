import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { query } from '../db/index.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import type { ApiResponse } from '../types/index.js'

const router = Router()

const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少6位'),
  username: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
})

router.post('/register', async (req, res: Response<ApiResponse>) => {
  try {
    const data = registerSchema.parse(req.body)

    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    )

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: '该邮箱已被注册',
      })
    }

    const passwordHash = await bcrypt.hash(data.password, 10)

    const result = await query(
      `INSERT INTO users (email, password_hash, username) 
       VALUES ($1, $2, $3) RETURNING id, email, username, role, is_active, created_at`,
      [data.email, passwordHash, data.username || null]
    )

    const user = result.rows[0]
    // 获取 JWT 签名密钥
    const secret = (process.env.JWT_SECRET || 'your-secret-key') as string
    // 生成用户的 JWT 凭证
    const token = jwt.sign(
      { userId: user.id },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    )

    await seedDefaultData(user.id)

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          createdAt: user.created_at,
        },
        token,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      })
    }
    console.error('Register error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试',
    })
  }
})

router.post('/login', async (req, res: Response<ApiResponse>) => {
  try {
    const data = loginSchema.parse(req.body)

    const result = await query(
      'SELECT id, email, password_hash, username, role, is_active FROM users WHERE email = $1',
      [data.email]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误',
      })
    }

    const user = result.rows[0]
    
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: '账户已被禁用，请联系管理员',
      })
    }

    const isValidPassword = await bcrypt.compare(data.password, user.password_hash)

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误',
      })
    }

    // 获取 JWT 签名密钥
    const secret = (process.env.JWT_SECRET || 'your-secret-key') as string
    // 生成用户的 JWT 凭证
    const token = jwt.sign(
      { userId: user.id },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    )

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
        token,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      })
    }
    console.error('Login error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试',
    })
  }
})

router.get('/me', authenticate, async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    res.json({
      success: true,
      data: req.user,
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

async function seedDefaultData(userId: string) {
  const PRESET_ACCOUNTS = [
    { name: '支付宝', icon: 'alipay', currency: 'CNY' },
    { name: '微信', icon: 'wechat', currency: 'CNY' },
    { name: '现金', icon: 'money', currency: 'CNY' },
    { name: '银行卡', icon: 'bank', currency: 'CNY' },
    { name: '信用卡', icon: 'credit-card', currency: 'CNY' },
  ]

  const PRESET_EXPENSE_CATEGORIES = [
    { name: '餐饮', icon: 'restaurant' },
    { name: '交通', icon: 'car' },
    { name: '购物', icon: 'shopping' },
    { name: '娱乐', icon: 'play-circle' },
    { name: '居住', icon: 'home' },
    { name: '通讯', icon: 'phone' },
    { name: '医疗', icon: 'medicine-box' },
    { name: '教育', icon: 'book' },
    { name: '其他', icon: 'more' },
  ]

  const PRESET_INCOME_CATEGORIES = [
    { name: '工资', icon: 'dollar' },
    { name: '奖金', icon: 'trophy' },
    { name: '投资收益', icon: 'rise' },
    { name: '其他', icon: 'more' },
  ]

  const EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
    '餐饮': ['早餐', '午餐', '晚餐', '零食', '外卖'],
    '交通': ['打车', '公交', '地铁', '加油', '停车'],
    '购物': ['服装', '数码', '日用品', '化妆品'],
    '娱乐': ['电影', '游戏', '旅游', '健身'],
    '居住': ['房租', '水电费', '物业费', '装修'],
    '通讯': ['话费', '网费'],
    '医疗': ['药品', '挂号', '体检'],
    '教育': ['培训', '书籍', '课程'],
  }

  for (const account of PRESET_ACCOUNTS) {
    await query(
      `INSERT INTO accounts (user_id, name, icon, currency, initial_balance, current_balance, is_preset)
       VALUES ($1, $2, $3, $4, 0, 0, true)`,
      [userId, account.name, account.icon, account.currency]
    )
  }

  for (const category of PRESET_EXPENSE_CATEGORIES) {
    const result = await query(
      `INSERT INTO categories (user_id, name, icon, type, is_preset)
       VALUES ($1, $2, $3, 'expense', true) RETURNING id`,
      [userId, category.name, category.icon]
    )
    const parentId = result.rows[0].id

    const subcategories = EXPENSE_SUBCATEGORIES[category.name] || []
    for (const sub of subcategories) {
      await query(
        `INSERT INTO categories (user_id, name, icon, type, parent_id, is_preset)
         VALUES ($1, $2, $3, 'expense', $4, true)`,
        [userId, sub, category.icon, parentId]
      )
    }
  }

  for (const category of PRESET_INCOME_CATEGORIES) {
    await query(
      `INSERT INTO categories (user_id, name, icon, type, is_preset)
       VALUES ($1, $2, $3, 'income', true)`,
      [userId, category.name, category.icon]
    )
  }

  await query(
    `INSERT INTO app_settings (user_id) VALUES ($1)`,
    [userId]
  )
}

export default router
