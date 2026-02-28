// 引入 dotenv 库来加载环境变量
import 'dotenv/config'
// 从 pg 库中引入 Pool 连接池类
import { Pool } from 'pg'

// 导出创建的连接池实例
export const pool = new Pool({
  // 数据库主机地址，默认使用环境变量或者 localhost
  host: process.env.DB_HOST || 'localhost',
  // 数据库端口号，默认使用环境变量或者 5432
  port: parseInt(process.env.DB_PORT || '5432'),
  // 数据库名称，默认使用环境变量或者 accounting
  database: process.env.DB_NAME || 'accounting',
  // 数据库登录账号，使用用户的规则 root
  user: process.env.DB_USER || 'root',
  // 数据库登录密码，使用用户的规则 123456
  password: process.env.DB_PASSWORD || '123456',
  // 连接池最大连接数限制为 20
  max: 20,
  // 闲置连接超时时间设置为 30000 毫秒（30秒）
  idleTimeoutMillis: 30000,
  // 连接超时时间设置为 2000 毫秒（2秒）
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  process.exit(-1)
})

export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (process.env.NODE_ENV === 'development') {
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: res.rowCount })
  }
  return res
}

export const getClient = async () => {
  const client = await pool.connect()
  return client
}
