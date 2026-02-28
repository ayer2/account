import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, ApiError } from '../services/api'

interface User {
  id: string
  email: string
  username: string | null
  role: 'user' | 'admin'
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, username?: string) => Promise<void>
  logout: () => void
  clearError: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.auth.login(email, password)
          const { user, token } = response.data
          localStorage.setItem('auth_token', token)
          set({
            user: user as User,
            token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          let message = '登录失败'
          if (error instanceof ApiError) {
            message = error.message
          } else if (error instanceof Error) {
            message = error.message
          }
          console.error('登录错误:', error)
          set({ error: message, isLoading: false })
          throw error
        }
      },

      register: async (email: string, password: string, username?: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.auth.register(email, password, username)
          const { user, token } = response.data
          localStorage.setItem('auth_token', token)
          set({
            user: user as User,
            token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          const message = error instanceof ApiError ? error.message : '注册失败'
          set({ error: message, isLoading: false })
          throw error
        }
      },

      logout: () => {
        localStorage.removeItem('auth_token')
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        })
      },

      clearError: () => {
        set({ error: null })
      },

      checkAuth: async () => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
          set({ isAuthenticated: false, user: null })
          return
        }

        set({ isLoading: true })
        try {
          const response = await api.auth.me()
          set({
            user: response.data as unknown as User,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch {
          localStorage.removeItem('auth_token')
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
