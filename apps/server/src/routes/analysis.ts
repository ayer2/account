import { Router, Response } from 'express'
import { query } from '../db/index.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import type { ApiResponse } from '../types/index.js'
import { getUserAiConfig } from './admin.js'

const router = Router()

interface MonthlyStats {
  year: number
  month: number
  totalExpense: number
  totalIncome: number
  balance: number
  transactionCount: number
}

interface CategoryStats {
  categoryId: string
  categoryName: string
  totalAmount: number
  count: number
  percentage: number
}

interface AccountStats {
  accountId: string
  accountName: string
  totalExpense: number
  totalIncome: number
}

interface DailyStats {
  date: string
  expense: number
  income: number
}

router.get('/stats', authenticate, async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const { year, month } = req.query
    const currentYear = year ? parseInt(year as string) : new Date().getFullYear()
    const currentMonth = month ? parseInt(month as string) : new Date().getMonth() + 1

    const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const lastDay = new Date(currentYear, currentMonth, 0).getDate()
    const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // 获取月度统计
    const monthlyStatsResult = await query(`
      SELECT 
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN type IN ('income', 'refund') THEN amount ELSE 0 END) as total_income,
        COUNT(*) as transaction_count
      FROM transactions 
      WHERE user_id = $1 AND date >= $2 AND date <= $3
    `, [req.userId, startDate, endDate])

    const monthlyStats = monthlyStatsResult.rows[0]

    // 获取分类统计（支出）
    const categoryStatsResult = await query(`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        COALESCE(SUM(t.amount), 0) as total_amount,
        COUNT(t.id) as count
      FROM categories c
      LEFT JOIN transactions t ON t.category_id = c.id 
        AND t.user_id = $1 
        AND t.type = 'expense'
        AND t.date >= $2 
        AND t.date <= $3
      WHERE c.user_id IN ($1, (SELECT id FROM users WHERE id = $1 AND role = 'admin' LIMIT 1))
        OR c.user_id IS NULL
      GROUP BY c.id, c.name
      HAVING COALESCE(SUM(t.amount), 0) > 0
      ORDER BY total_amount DESC
    `, [req.userId, startDate, endDate])

    const totalExpense = parseFloat(monthlyStats.total_expense) || 0
    const categoryStats: CategoryStats[] = categoryStatsResult.rows.map((row: Record<string, unknown>) => ({
      categoryId: String(row.category_id),
      categoryName: String(row.category_name),
      totalAmount: parseFloat(String(row.total_amount)) || 0,
      count: parseInt(String(row.count)) || 0,
      percentage: totalExpense > 0 ? (parseFloat(String(row.total_amount)) || 0) / totalExpense * 100 : 0,
    }))

    // 获取账户统计
    const accountStatsResult = await query(`
      SELECT 
        a.id as account_id,
        a.name as account_name,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN t.type IN ('income', 'refund') THEN t.amount ELSE 0 END), 0) as total_income
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id 
        AND t.user_id = $1 
        AND t.date >= $2 
        AND t.date <= $3
      WHERE a.user_id = $1 AND a.is_deleted = FALSE
      GROUP BY a.id, a.name
    `, [req.userId, startDate, endDate])

    const accountStats: AccountStats[] = accountStatsResult.rows.map((row: Record<string, unknown>) => ({
      accountId: String(row.account_id),
      accountName: String(row.account_name),
      totalExpense: parseFloat(String(row.total_expense)) || 0,
      totalIncome: parseFloat(String(row.total_income)) || 0,
    }))

    // 获取每日统计
    const dailyStatsResult = await query(`
      SELECT 
        date,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense,
        COALESCE(SUM(CASE WHEN type IN ('income', 'refund') THEN amount ELSE 0 END), 0) as income
      FROM transactions
      WHERE user_id = $1 AND date >= $2 AND date <= $3
      GROUP BY date
      ORDER BY date ASC
    `, [req.userId, startDate, endDate])

    const dailyStats: DailyStats[] = dailyStatsResult.rows.map((row: Record<string, unknown>) => ({
      date: String(row.date),
      expense: parseFloat(String(row.expense)) || 0,
      income: parseFloat(String(row.income)) || 0,
    }))

    // 获取最近几个月的数据对比
    const recentMonthsStats: MonthlyStats[] = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const s = `${y}-${String(m).padStart(2, '0')}-01`
      const lastDay = new Date(y, m, 0).getDate()
      const e = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const result = await query(`
        SELECT 
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
          SUM(CASE WHEN type IN ('income', 'refund') THEN amount ELSE 0 END) as total_income,
          COUNT(*) as transaction_count
        FROM transactions 
        WHERE user_id = $1 AND date >= $2 AND date <= $3
      `, [req.userId, s, e])

      const stats = result.rows[0]
      recentMonthsStats.push({
        year: y,
        month: m,
        totalExpense: parseFloat(stats.total_expense) || 0,
        totalIncome: parseFloat(stats.total_income) || 0,
        balance: (parseFloat(stats.total_income) || 0) - (parseFloat(stats.total_expense) || 0),
        transactionCount: parseInt(stats.transaction_count) || 0,
      })
    }

    res.json({
      success: true,
      data: {
        year: currentYear,
        month: currentMonth,
        monthlyStats: {
          totalExpense,
          totalIncome: parseFloat(monthlyStats.total_income) || 0,
          balance: (parseFloat(monthlyStats.total_income) || 0) - totalExpense,
          transactionCount: parseInt(monthlyStats.transaction_count) || 0,
        },
        categoryStats,
        accountStats,
        dailyStats,
        recentMonthsStats,
      },
    })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({
      success: false,
      error: '服务器错误',
    })
  }
})

router.post('/chat', authenticate, async (req: AuthRequest, res: Response<ApiResponse<unknown>>) => {
  try {
    const { message, year, month } = req.body as { message: string; year?: number; month?: number }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: '请输入问题',
      })
    }

    const currentYear = year || new Date().getFullYear()
    const currentMonth = month || new Date().getMonth() + 1

    // 获取用户配置
    console.log('=== AI Chat Request ===')
    console.log('userId:', req.userId)
    console.log('message:', message)
    console.log('year:', currentYear, 'month:', currentMonth)
    
    const aiConfig = await getUserAiConfig(req.userId || '')
    console.log('aiConfig:', aiConfig)

    if (!aiConfig) {
      console.log('No AI config found, returning error')
      return res.status(400).json({
        success: false,
        error: '请先配置 AI API Key',
      })
    }

    // 获取当月统计数据
    const statsStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const lastDay = new Date(currentYear, currentMonth, 0).getDate()
    const statsEndDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // 获取月度统计
    const monthlyStatsResult = await query(`
      SELECT 
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN type IN ('income', 'refund') THEN amount ELSE 0 END) as total_income,
        COUNT(*) as transaction_count
      FROM transactions 
      WHERE user_id = $1 AND date >= $2 AND date <= $3
    `, [req.userId, statsStartDate, statsEndDate])

    const monthlyStats = monthlyStatsResult.rows[0]
    const totalExpense = parseFloat(monthlyStats.total_expense) || 0
    const totalIncome = parseFloat(monthlyStats.total_income) || 0

    // 获取分类统计
    const categoryStatsResult = await query(`
      SELECT 
        c.name as category_name,
        COALESCE(SUM(t.amount), 0) as total_amount,
        COUNT(t.id) as count
      FROM categories c
      LEFT JOIN transactions t ON t.category_id = c.id 
        AND t.user_id = $1 
        AND t.type = 'expense'
        AND t.date >= $2 
        AND t.date <= $3
      WHERE c.user_id IN ($1, (SELECT id FROM users WHERE id = $1 AND role = 'admin' LIMIT 1))
        OR c.user_id IS NULL
      GROUP BY c.id, c.name
      HAVING COALESCE(SUM(t.amount), 0) > 0
      ORDER BY total_amount DESC
      LIMIT 10
    `, [req.userId, statsStartDate, statsEndDate])

    // 获取最近几个月对比
    const recentMonthsStats = []
    for (let i = 0; i < 3; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const s = `${y}-${String(m).padStart(2, '0')}-01`
      const lastDay = new Date(y, m, 0).getDate()
      const e = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      const result = await query(`
        SELECT 
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
          SUM(CASE WHEN type IN ('income', 'refund') THEN amount ELSE 0 END) as total_income
        FROM transactions 
        WHERE user_id = $1 AND date >= $2 AND date <= $3
      `, [req.userId, s, e])

      const stats = result.rows[0]
      recentMonthsStats.push({
        year: y,
        month: m,
        expense: parseFloat(stats.total_expense) || 0,
        income: parseFloat(stats.total_income) || 0,
      })
    }

    // 构建上下文
    const monthName = `${currentYear}年${currentMonth}月`
    const context = `
你是一个个人记账助手，请根据以下统计数据回答用户的问题。

${monthName}的统计数据：
- 总支出：¥${totalExpense.toFixed(2)}
- 总收入：¥${totalIncome.toFixed(2)}
- 结余：¥${(totalIncome - totalExpense).toFixed(2)}
- 交易笔数：${monthlyStats.transaction_count}

支出分类统计（Top 10）：
${categoryStatsResult.rows.map((r: Record<string, unknown>) => 
  `- ${r.category_name}: ¥${(parseFloat(r.total_amount as string) || 0).toFixed(2)} (${r.count}笔)`
).join('\n')}

最近3个月对比：
${recentMonthsStats.map((s: { year: number; month: number; expense: number; income: number }) => 
  `- ${s.year}年${s.month}月: 支出¥${s.expense.toFixed(2)}, 收入¥${s.income.toFixed(2)}`
).join('\n')}

用户问题：${message}

请用简洁、友好的语言回答。如果涉及具体数字，请使用人民币格式（如 ¥1,234.56）。
如果用户问题与记账数据无关，请引导用户回到记账相关话题。
`

    // 调用 AI API
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.modelName || 'deepseek-v3-2-251201',
        stream: false,
        input: [{
          role: 'user',
          content: [{
            type: 'input_text',
            text: context
          }]
        }]
      })
    })

    if (!response.ok) {
      throw new Error(`AI API调用失败: ${response.status}`)
    }

    const result = await response.json()

    let aiReply = ''
    if ((result as any).output && (result as any).output.length > 0) {
      const content = (result as any).output[0].content[0].text
      const jsonMatch = content.match(/```json[\s\S]*?```/)
      if (jsonMatch) {
        const jsonStr = jsonMatch[0].replace(/```json|```/g, '')
        aiReply = JSON.parse(jsonStr).reply || content
      } else {
        aiReply = content
      }
    }

    res.json({
      success: true,
      data: {
        reply: aiReply,
        stats: {
          year: currentYear,
          month: currentMonth,
          totalExpense,
          totalIncome,
          balance: totalIncome - totalExpense,
        }
      },
    })
  } catch (error) {
    console.error('AI chat error:', error)
    res.status(500).json({
      success: false,
      error: 'AI服务暂不可用，请稍后重试',
    })
  }
})

export default router
