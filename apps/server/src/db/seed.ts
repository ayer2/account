import { pool, query } from './index'
import bcrypt from 'bcryptjs'

const PRESET_ACCOUNTS = [
  { name: '支付宝', icon: 'alipay', currency: 'CNY', initialBalance: 0 },
  { name: '微信', icon: 'wechat', currency: 'CNY', initialBalance: 0 },
  { name: '现金', icon: 'money', currency: 'CNY', initialBalance: 0 },
  { name: '银行卡', icon: 'bank', currency: 'CNY', initialBalance: 0 },
  { name: '信用卡', icon: 'credit-card', currency: 'CNY', initialBalance: 0 },
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

async function seed(userId: string) {
  console.log(`🔄 Seeding data for user: ${userId}`)

  try {
    for (const account of PRESET_ACCOUNTS) {
      await query(
        `INSERT INTO accounts (user_id, name, icon, currency, initial_balance, current_balance, is_preset)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, account.name, account.icon, account.currency, account.initialBalance, account.initialBalance, true]
      )
      console.log(`  ✓ Created account: ${account.name}`)
    }

    await query(
      `INSERT INTO app_settings (user_id) VALUES ($1)`,
      [userId]
    )
    console.log(`  ✓ Created app settings`)

    console.log('✅ Seeding completed!')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    throw error
  }
}

async function createSystemCategories() {
  console.log('🔄 Creating system categories...')

  try {
    // 检查是否已经存在系统分类
    const existingCount = await query(
      `SELECT COUNT(*) FROM categories WHERE is_system = true`
    )

    if (existingCount.rows[0].count > 0) {
      console.log('⚠️  System categories already exist')
      return
    }

    // 创建系统级支出分类
    for (const category of PRESET_EXPENSE_CATEGORIES) {
      await query(
        `INSERT INTO categories (name, icon, type, is_system)
         VALUES ($1, $2, 'expense', $3)`,
        [category.name, category.icon, true]
      )
      console.log(`  ✓ Created system expense category: ${category.name}`)
    }

    // 创建系统级收入分类
    for (const category of PRESET_INCOME_CATEGORIES) {
      await query(
        `INSERT INTO categories (name, icon, type, is_system)
         VALUES ($1, $2, 'income', $3)`,
        [category.name, category.icon, true]
      )
      console.log(`  ✓ Created system income category: ${category.name}`)
    }

    console.log('✅ System categories created!')
  } catch (error) {
    console.error('❌ Creating system categories failed:', error)
    throw error
  }
}

async function createTestUser() {
  console.log('🔄 Creating test user...')

  const email = 'test@example.com'
  const password = 'password123'
  const passwordHash = await bcrypt.hash(password, 10)

  try {
    await createSystemCategories()

    const result = await query(
      `INSERT INTO users (email, password_hash, username) 
       VALUES ($1, $2, $3) RETURNING id`,
      [email, passwordHash, 'Test User']
    )
    const userId = result.rows[0].id
    console.log(`✅ Test user created: ${email} / ${password}`)
    
    await seed(userId)
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('duplicate')) {
      console.log('⚠️  Test user already exists')
    } else {
      throw error
    }
  } finally {
    await pool.end()
  }
}

createTestUser()
