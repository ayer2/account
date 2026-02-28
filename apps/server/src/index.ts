import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'

import authRoutes from './routes/auth.js'
import accountRoutes from './routes/accounts.js'
import categoryRoutes from './routes/categories.js'
import transactionRoutes from './routes/transactions.js'
import settingsRoutes from './routes/settings.js'
import adminRoutes from './routes/admin.js'
import analysisRoutes from './routes/analysis.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(helmet())
app.use(compression())
// 引入跨域中间件，并进行跨域配置
app.use(cors({
  // 允许所有来源跨域（解决 Capacitor 各种奇怪的 Origin 拦截）
  origin: true,
  // 允许携带凭证（如 Cookie 等）
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/accounts', accountRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/analysis', analysisRoutes)

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
  })
})

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎉 Server is running on http://localhost:${PORT}             ║
║                                                               ║
║   API Endpoints:                                              ║
║   - Health:  GET  /api/health                                  ║
║   - Auth:    POST /api/auth/register                          ║
║              POST /api/auth/login                             ║
║              GET  /api/auth/me                                ║
║   - Accounts:     GET/POST   /api/accounts                    ║
║              GET/PUT/DELETE /api/accounts/:id                ║
║   - Categories:   GET/POST   /api/categories                  ║
║              GET/PUT/DELETE /api/categories/:id              ║
║   - Transactions: GET/POST   /api/transactions               ║
║              GET/PUT/DELETE /api/transactions/:id            ║
║   - Settings:     GET/PUT   /api/settings                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `)
})

export default app
