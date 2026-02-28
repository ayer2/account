import { create } from 'zustand'
import type { Account, Category, Transaction, AppSettings } from '@accounting/shared'
import { formatDate } from '@accounting/shared'
import { api } from '../services/api'

const normalizeTransaction = (tx: any): Transaction => ({
  ...tx,
  amount: typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount,
  date: formatDate(tx.date),
})

const normalizeAccount = (acc: any): Account => ({
  ...acc,
  initialBalance: typeof acc.initialBalance === 'string' ? parseFloat(acc.initialBalance) : acc.initialBalance,
  currentBalance: typeof acc.currentBalance === 'string' ? parseFloat(acc.currentBalance) : acc.currentBalance,
})

interface DataState {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  settings: AppSettings | null
  isLoading: boolean
  isInitialized: boolean
  transactionsTotal: number

  loadAll: () => Promise<void>

  addAccount: (account: Partial<Account>) => Promise<Account>
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>

  addCategory: (category: Partial<Category>) => Promise<Category>
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  addTransaction: (transaction: Partial<Transaction>) => Promise<Transaction>
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  loadTransactions: (params?: {
    startDate?: string
    endDate?: string
    accountId?: string
    categoryId?: string
    type?: string
    limit?: number
    offset?: number
  }) => Promise<void>

  getAccountById: (id: string) => Account | undefined
  getCategoryById: (id: string) => Category | undefined
  getTransactionById: (id: string) => Transaction | undefined
  getParentCategories: (type?: 'expense' | 'income') => Category[]
  getChildCategories: (parentId: string) => Category[]
}

export const useDataStore = create<DataState>((set, get) => ({
  accounts: [],
  categories: [],
  transactions: [],
  settings: null,
  isLoading: true,
  isInitialized: false,
  transactionsTotal: 0,

  loadAll: async () => {
    set({ isLoading: true })
    try {
      const [accountsRes, categoriesRes, settingsRes] = await Promise.all([
        api.accounts.getAll(),
        api.categories.getAll(),
        api.settings.get(),
      ])

      const transactionsRes = await api.transactions.getAll({ limit: 100 })

      set({
        accounts: accountsRes.data.map(normalizeAccount),
        categories: categoriesRes.data,
        transactions: transactionsRes.data.list.map(normalizeTransaction),
        transactionsTotal: transactionsRes.data.total,
        settings: settingsRes.data,
        isLoading: false,
        isInitialized: true,
      })
    } catch (error) {
      console.error('Failed to load data:', error)
      set({ isLoading: false })
    }
  },

  addAccount: async account => {
    const response = await api.accounts.create(account)
    const normalizedAccount = normalizeAccount(response.data)
    set(state => ({ accounts: [...state.accounts, normalizedAccount] }))
    return normalizedAccount
  },

  updateAccount: async (id, updates) => {
    const response = await api.accounts.update(id, updates)
    const normalizedAccount = normalizeAccount(response.data)
    set(state => ({
      accounts: state.accounts.map(a => (a.id === id ? normalizedAccount : a)),
    }))
  },

  deleteAccount: async id => {
    await api.accounts.delete(id)
    set(state => ({
      accounts: state.accounts.map(a => (a.id === id ? { ...a, isDeleted: true } : a)),
    }))
  },

  addCategory: async category => {
    const response = await api.categories.create(category)
    set(state => ({ categories: [...state.categories, response.data] }))
    return response.data
  },

  updateCategory: async (id, updates) => {
    const response = await api.categories.update(id, updates)
    set(state => ({
      categories: state.categories.map(c => (c.id === id ? response.data : c)),
    }))
  },

  deleteCategory: async id => {
    await api.categories.delete(id)
    set(state => ({
      categories: state.categories.filter(c => c.id !== id),
    }))
  },

  addTransaction: async transaction => {
    const response = await api.transactions.create(transaction)
    const normalizedTx = normalizeTransaction(response.data)
    set(state => ({
      transactions: [normalizedTx, ...state.transactions],
      transactionsTotal: state.transactionsTotal + 1,
    }))
    const accountsRes = await api.accounts.getAll()
    set({ accounts: accountsRes.data.map(normalizeAccount) })
    return normalizedTx
  },

  updateTransaction: async (id, updates) => {
    const response = await api.transactions.update(id, updates)
    const normalizedTx = normalizeTransaction(response.data)
    set(state => ({
      transactions: state.transactions.map(t => (t.id === id ? normalizedTx : t)),
    }))
    const accountsRes = await api.accounts.getAll()
    set({ accounts: accountsRes.data.map(normalizeAccount) })
  },

  deleteTransaction: async id => {
    await api.transactions.delete(id)
    set(state => ({
      transactions: state.transactions.filter(t => t.id !== id),
      transactionsTotal: state.transactionsTotal - 1,
    }))
    const accountsRes = await api.accounts.getAll()
    set({ accounts: accountsRes.data.map(normalizeAccount) })
  },

  loadTransactions: async params => {
    try {
      const response = await api.transactions.getAll(params)
      set({
        transactions: response.data.list.map(normalizeTransaction),
        transactionsTotal: response.data.total,
      })
    } catch (error) {
      console.error('Failed to load transactions:', error)
    }
  },

  getAccountById: id => get().accounts.find(a => a.id === id),
  getCategoryById: id => get().categories.find(c => c.id === id),
  getTransactionById: id => get().transactions.find(t => t.id === id),
  getParentCategories: type =>
    get().categories.filter(c => c.parentId === null && (!type || c.type === type)),
  getChildCategories: parentId => get().categories.filter(c => c.parentId === parentId),
}))
