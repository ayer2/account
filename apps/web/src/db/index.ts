import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Account, Category, Transaction, AppSettings, BillImportRecord, CategoryKeyword } from '@accounting/shared'

interface AccountingDB extends DBSchema {
  accounts: {
    key: string
    value: Account
    indexes: { 'by-name': string }
  }
  categories: {
    key: string
    value: Category
    indexes: { 'by-type': string; 'by-parent': string }
  }
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-date': string; 'by-account': string; 'by-category': string }
  }
  settings: {
    key: string
    value: AppSettings
  }
  billImportRecords: {
    key: string
    value: BillImportRecord
  }
  categoryKeywords: {
    key: string
    value: CategoryKeyword
    indexes: { 'by-category': string }
  }
}

const DB_NAME = 'personal-accounting'
const DB_VERSION = 1

let dbInstance: IDBPDatabase<AccountingDB> | null = null

export const getDB = async (): Promise<IDBPDatabase<AccountingDB>> => {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await openDB<AccountingDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('accounts')) {
        const accountStore = db.createObjectStore('accounts', { keyPath: 'id' })
        accountStore.createIndex('by-name', 'name')
      }

      if (!db.objectStoreNames.contains('categories')) {
        const categoryStore = db.createObjectStore('categories', { keyPath: 'id' })
        categoryStore.createIndex('by-type', 'type')
        categoryStore.createIndex('by-parent', 'parentId')
      }

      if (!db.objectStoreNames.contains('transactions')) {
        const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' })
        transactionStore.createIndex('by-date', 'date')
        transactionStore.createIndex('by-account', 'accountId')
        transactionStore.createIndex('by-category', 'categoryId')
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('billImportRecords')) {
        db.createObjectStore('billImportRecords', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('categoryKeywords')) {
        const keywordStore = db.createObjectStore('categoryKeywords', { keyPath: 'id' })
        keywordStore.createIndex('by-category', 'categoryId')
      }
    },
  })

  return dbInstance
}

export const closeDB = () => {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
