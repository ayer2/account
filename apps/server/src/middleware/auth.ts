import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../db/index.js'

export interface AuthRequest extends Request {
  userId?: string
  user?: {
    id: string
    email: string
    username: string | null
    role?: string
  }
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: '未授权，请先登录' 
      })
    }

    const token = authHeader.substring(7)
    const secret = process.env.JWT_SECRET || 'your-secret-key'

    const decoded = jwt.verify(token, secret) as { userId: string }
    
    const result = await query(
      'SELECT id, email, username, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: '用户不存在' 
      })
    }

    const user = result.rows[0]
    
    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        error: '账户已被禁用' 
      })
    }

    req.userId = decoded.userId
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    }
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token无效' 
      })
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token已过期' 
      })
    }
    next(error)
  }
}
