import { getDB } from '../index'
import type { Category } from '@accounting/shared'
import { generateId, formatDateTime } from '@accounting/shared'

export const categoryRepository = {
  async getAll(): Promise<Category[]> {
    const db = await getDB()
    return db.getAll('categories')
  },

  async getById(id: string): Promise<Category | undefined> {
    const db = await getDB()
    return db.get('categories', id)
  },

  async getByType(type: 'expense' | 'income'): Promise<Category[]> {
    const db = await getDB()
    return db.getAllFromIndex('categories', 'by-type', type)
  },

  async getByParentId(parentId: string | null): Promise<Category[]> {
    const db = await getDB()
    if (parentId === null) {
      const all = await db.getAll('categories')
      return all.filter(c => c.parentId === null)
    }
    return db.getAllFromIndex('categories', 'by-parent', parentId)
  },

  async getParents(type?: 'expense' | 'income'): Promise<Category[]> {
    const db = await getDB()
    const all = await db.getAll('categories')
    return all.filter(c => c.parentId === null && (!type || c.type === type))
  },

  async getChildren(parentId: string): Promise<Category[]> {
    const db = await getDB()
    return db.getAllFromIndex('categories', 'by-parent', parentId)
  },

  async create(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    const db = await getDB()
    const now = formatDateTime(new Date())
    const newCategory: Category = {
      ...category,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }
    await db.add('categories', newCategory)
    return newCategory
  },

  async update(id: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<Category | null> {
    const db = await getDB()
    const category = await db.get('categories', id)
    if (!category) return null

    const updatedCategory: Category = {
      ...category,
      ...updates,
      updatedAt: formatDateTime(new Date()),
    }
    await db.put('categories', updatedCategory)
    return updatedCategory
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDB()
    const category = await db.get('categories', id)
    if (!category) return false

    await db.delete('categories', id)
    return true
  },

  async clear(): Promise<void> {
    const db = await getDB()
    await db.clear('categories')
  },
}
