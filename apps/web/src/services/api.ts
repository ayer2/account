// 从 @accounting/shared 中引入共享的数据类型定义
import type { Account, Category, Transaction, AppSettings } from '@accounting/shared'

// 获取环境变量中的 API_URL，如果没有则默认使用相对路径 /api，APK 必须使用绝对路径
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// 定义一个继承自 Error 的自定义 API 错误类
class ApiError extends Error {
  // 构造函数，接收状态码和错误信息
  constructor(public status: number, message: string) {
    // 调用父类 Error 的构造函数传入错误信息
    super(message)
    // 设置错误名称为 ApiError
    this.name = 'ApiError'
  }
}

// 封装一个泛型 request 函数用于发起请求
async function request<T>(
  // 请求接口相对路径
  endpoint: string,
  // 可选的请求配置选项
  options: RequestInit = {}
): Promise<T> {
  // 尝试从 localStorage 获取用户鉴权 token
  const token = localStorage.getItem('auth_token')

  // 初始化请求头，默认 Content-Type 为 JSON，并合并传入的 header 配置
  const headers: HeadersInit = {
    // 设置 JSON 类型的内容
    'Content-Type': 'application/json',
    // 展开并合并外部配置的 headers
    ...options.headers,
  }

  // 判断如果当前用户 token 存在
  if (token) {
    // 将 token 拼接到请求头 Authorization 字段中
    headers['Authorization'] = `Bearer ${token}`
  }

  // 拼接完整的请求 URL 并通过 fetch 发起请求
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    // 展开其他的请求选项
    ...options,
    // 覆盖配置的 headers 请求头
    headers,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(response.status, data.error || '请求失败')
  }

  return data
}

export const api = {
  auth: {
    register: (email: string, password: string, username?: string) =>
      request<{ user: unknown; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, username }),
      }),

    login: (email: string, password: string) =>
      request<{ user: unknown; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: () => request<unknown>('/auth/me'),
  },

  accounts: {
    getAll: () => request<{ success: boolean; data: Account[] }>('/accounts'),

    getById: (id: string) =>
      request<{ success: boolean; data: Account }>(`/accounts/${id}`),

    create: (account: Partial<Account>) =>
      request<{ success: boolean; data: Account }>('/accounts', {
        method: 'POST',
        body: JSON.stringify(account),
      }),

    update: (id: string, updates: Partial<Account>) =>
      request<{ success: boolean; data: Account }>(`/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    delete: (id: string) =>
      request<{ success: boolean }>(`/accounts/${id}`, {
        method: 'DELETE',
      }),
  },

  categories: {
    getAll: (type?: 'expense' | 'income') => {
      const params = type ? `?type=${type}` : ''
      return request<{ success: boolean; data: Category[] }>(`/categories${params}`)
    },

    getById: (id: string) =>
      request<{ success: boolean; data: Category }>(`/categories/${id}`),

    create: (category: Partial<Category>) =>
      request<{ success: boolean; data: Category }>('/categories', {
        method: 'POST',
        body: JSON.stringify(category),
      }),

    update: (id: string, updates: Partial<Category>) =>
      request<{ success: boolean; data: Category }>(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    delete: (id: string) =>
      request<{ success: boolean }>(`/categories/${id}`, {
        method: 'DELETE',
      }),
  },

  transactions: {
    getAll: (params?: {
      startDate?: string
      endDate?: string
      accountId?: string
      categoryId?: string
      type?: string
      limit?: number
      offset?: number
    }) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) {
            searchParams.append(key, String(value))
          }
        })
      }
      const query = searchParams.toString()
      return request<{ success: boolean; data: { list: Transaction[]; total: number } }>(
        `/transactions${query ? `?${query}` : ''}`
      )
    },

    getById: (id: string) =>
      request<{ success: boolean; data: Transaction }>(`/transactions/${id}`),

    create: (transaction: Partial<Transaction>) =>
      request<{ success: boolean; data: Transaction }>('/transactions', {
        method: 'POST',
        body: JSON.stringify(transaction),
      }),

    update: (id: string, updates: Partial<Transaction>) =>
      request<{ success: boolean; data: Transaction }>(`/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    delete: (id: string) =>
      request<{ success: boolean }>(`/transactions/${id}`, {
        method: 'DELETE',
      }),
  },

  settings: {
    get: () => request<{ success: boolean; data: AppSettings }>('/settings'),

    update: (settings: Partial<AppSettings>) =>
      request<{ success: boolean; data: AppSettings }>('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
  },

  admin: {
    getUsers: () => request<{ success: boolean; data: unknown[] }>('/admin/users'),
    
    updateUser: (userId: string, data: { role?: 'user' | 'admin'; isActive?: boolean }) =>
      request<{ success: boolean; data: unknown }>(`/admin/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    getAiConfigs: () => request<{ success: boolean; data: unknown[] }>('/admin/ai-config'),
    
    createAiConfig: (data: { userId?: string; provider?: string; apiKey?: string; modelName?: string; isActive?: boolean }) =>
      request<{ success: boolean; data: unknown }>('/admin/ai-config', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    updateAiConfig: (id: string, data: { provider?: string; apiKey?: string; modelName?: string; isActive?: boolean }) =>
      request<{ success: boolean; data: unknown }>(`/admin/ai-config/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    deleteAiConfig: (id: string) =>
      request<{ success: boolean; data: null }>(`/admin/ai-config/${id}`, {
        method: 'DELETE',
      }),
    
    getCategories: () => request<{ success: boolean; data: unknown[] }>('/admin/categories'),
    
    deleteCategory: (id: string) =>
      request<{ success: boolean; data: null }>(`/admin/categories/${id}`, {
        method: 'DELETE',
      }),
  },

  analysis: {
    getStats: (year?: number, month?: number) => {
      const params = new URLSearchParams()
      if (year) params.append('year', String(year))
      if (month) params.append('month', String(month))
      return request<{ success: boolean; data: unknown }>(`/analysis/stats${params.toString() ? `?${params}` : ''}`)
    },

    chat: (message: string, year?: number, month?: number) =>
      request<{ success: boolean; data: { reply: string; stats: unknown } }>('/analysis/chat', {
        method: 'POST',
        body: JSON.stringify({ message, year, month }),
      }),
  },
}

export { ApiError }
