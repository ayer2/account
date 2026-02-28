import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Spin } from 'antd'
import MainLayout from './components/Layout/MainLayout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'
import Accounts from './pages/Accounts'
import Categories from './pages/Categories'
import Admin from './pages/Admin'
import Analysis from './pages/Analysis'
import Login from './pages/Login'
import { useAuthStore } from './stores/authStore'
import { useDataStore } from './stores/dataStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore()
  const { isLoading: dataLoading, loadAll } = useDataStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (isAuthenticated && !initialized) {
      loadAll().then(() => setInitialized(true))
    } else if (isAuthenticated) {
      setInitialized(true)
    }
  }, [isAuthenticated, loadAll, initialized])

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (dataLoading && !initialized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <Spin size="large" />
        <span>加载数据中...</span>
      </div>
    )
  }

  return <>{children}</>
}

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login />
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout style={{ minHeight: '100vh' }}>
              <MainLayout />
            </Layout>
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="categories" element={<Categories />} />
          <Route path="admin" element={<Admin />} />
          <Route path="analysis" element={<Analysis />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
