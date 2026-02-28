import { getDB } from '../index'
import type { Transaction } from '@accounting/shared'
import { generateId, formatDateTime } from '@accounting/shared'

export const transactionRepository = {
  async getAll(): Promise<Transaction[]> {
    const db = await getDB()
    return db.getAll('transactions')
  },

  async getById(id: string): Promise<Transaction | undefined> {
    const db = await getDB()
    return db.get('transactions', id)
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
    const db = await getDB()
    const all = await db.getAll('transactions')
    return all.filter(t => t.date >= startDate && t.date <= endDate)
  },

  async getByAccountId(accountId: string): Promise<Transaction[]> {
    const db = await getDB()
    return db.getAllFromIndex('transactions', 'by-account', accountId)
  },

  async getByCategoryId(categoryId: string): Promise<Transaction[]> {
    const db = await getDB()
    return db.getAllFromIndex('transactions', 'by-category', categoryId)
  },

  async getByType(type: Transaction['type']): Promise<Transaction[]> {
    const db = await getDB()
    const all = await db.getAll('transactions')
    return all.filter(t => t.type === type)
  },

  async create(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    const db = await getDB()
    const now = formatDateTime(new Date())
    const newTransaction: Transaction = {
      ...transaction,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    await db.add('transactions', newTransaction)
    return newTransaction
  },

  async createMany(transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Transaction[]> {
    const db = await getDB()
    const now = formatDateTime(new Date())
    const newTransactions: Transaction[] = transactions.map(t => ({
      ...t,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }))
    const tx = db.transaction('transactions', 'readwrite')
    await Promise.all(newTransactions.map(t => tx.store.add(t)))
    await tx.done
    return newTransactions
  },

  async update(id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Promise<Transaction | null> {
    const db = await getDB()
    const transaction = await db.get('transactions', id)
    if (!transaction) return null

    const updatedTransaction: Transaction = {
      ...transaction,
      ...updates,
      updatedAt: formatDateTime(new Date()),
    }
    await db.put('transactions', updatedTransaction)
    return updatedTransaction
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDB()
    const transaction = await db.get('transactions', id)
    if (!transaction) return false

    await db.delete('transactions', id)
    return true
  },

  async clear(): Promise<void> {
    const db = await getDB()
    await db.clear('transactions')
  },

  async countByCategoryId(categoryId: string): Promise<number> {
    const db = await getDB()
    const transactions = await db.getAllFromIndex('transactions', 'by-category', categoryId)
    return transactions.length
  },
}
