export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund' | 'lend' | 'borrow'
export type CategoryType = 'expense' | 'income'
export type TransactionSource = 'manual' | 'import'

export interface User {
  id: string
  email: string
  username: string | null
  createdAt: string
  updatedAt: string
}

export interface Account {
  id: string
  userId: string
  name: string
  icon: string
  currency: string
  initialBalance: number
  currentBalance: number
  isPreset: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  userId: string | null
  name: string
  icon: string
  type: CategoryType
  parentId: string | null
  isPreset: boolean
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  amount: number
  accountId: string
  toAccountId: string | null
  categoryId: string | null
  date: string
  time: string
  note: string
  source: TransactionSource
  originalRefundId: string | null
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  id: string
  userId: string
  theme: 'light' | 'dark'
  language: 'zh-CN' | 'en-US'
  lastUsedAccountId: string | null
  createdAt: string
  updatedAt: string
}

export interface ImportRecord {
  id: string
  userId: string
  platform: 'alipay' | 'wechat' | null
  fileName: string | null
  totalCount: number
  successCount: number
  failCount: number
  importedAt: string
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>
  token: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
