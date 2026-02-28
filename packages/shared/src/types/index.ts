export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund' | 'lend' | 'borrow'

export type CategoryType = 'expense' | 'income'

export type TransactionSource = 'manual' | 'import'

export interface Account {
  id: string
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
  theme: 'light' | 'dark'
  language: 'zh-CN' | 'en-US'
  lastUsedAccountId: string | null
  monthlyBudget: number
  budgetAlertEnabled: boolean
  budgetAlertThreshold: number
  createdAt: string
  updatedAt: string
}

export interface BillImportRecord {
  id: string
  platform: 'alipay' | 'wechat'
  fileName: string
  totalCount: number
  successCount: number
  failCount: number
  importedAt: string
}

export interface CategoryKeyword {
  id: string
  categoryId: string
  keyword: string
  createdAt: string
}
