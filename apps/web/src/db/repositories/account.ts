import { getDB } from '../index'
import type { Account } from '@accounting/shared'
import { generateId, formatDateTime } from '@accounting/shared'

export const accountRepository = {
  async getAll(): Promise<Account[]> {
    const db = await getDB()
    return db.getAll('accounts')
  },

  async getById(id: string): Promise<Account | undefined> {
    const db = await getDB()
    return db.get('accounts', id)
  },

  async getActive(): Promise<Account[]> {
    const db = await getDB()
    const all = await db.getAll('accounts')
    return all.filter(a => !a.isDeleted)
  },

  async create(account: Omit<Account, 'id' | 'currentBalance' | 'isDeleted' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const db = await getDB()
    const now = formatDateTime(new Date())
    const newAccount: Account = {
      ...account,
      id: generateId(),
      currentBalance: account.initialBalance,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    }
    await db.add('accounts', newAccount)
    return newAccount
  },

  async update(id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<Account | null> {
    const db = await getDB()
    const account = await db.get('accounts', id)
    if (!account) return null

    const updatedAccount: Account = {
      ...account,
      ...updates,
      updatedAt: formatDateTime(new Date()),
    }
    await db.put('accounts', updatedAccount)
    return updatedAccount
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDB()
    const account = await db.get('accounts', id)
    if (!account) return false

    const updatedAccount: Account = {
      ...account,
      isDeleted: true,
      updatedAt: formatDateTime(new Date()),
    }
    await db.put('accounts', updatedAccount)
    return true
  },

  async updateBalance(id: string, amount: number): Promise<Account | null> {
    const db = await getDB()
    const account = await db.get('accounts', id)
    if (!account) return null

    const updatedAccount: Account = {
      ...account,
      currentBalance: account.currentBalance + amount,
      updatedAt: formatDateTime(new Date()),
    }
    await db.put('accounts', updatedAccount)
    return updatedAccount
  },

  async clear(): Promise<void> {
    const db = await getDB()
    await db.clear('accounts')
  },
}
