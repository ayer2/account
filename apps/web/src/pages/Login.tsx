import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message, Tabs, Typography } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import { useDataStore } from '../stores/dataStore'

const { Title, Text } = Typography

export default function Login() {
  const navigate = useNavigate()
  const { login, register, isLoading, error, clearError } = useAuthStore()
  const { loadAll } = useDataStore()
  const [activeTab, setActiveTab] = useState('login')

  const handleLogin = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password)
      await loadAll()
      message.success('登录成功')
      navigate('/')
    } catch {
      message.error(error || '登录失败')
      clearError()
    }
  }

  const handleRegister = async (values: { email: string; password: string; username?: string }) => {
    try {
      await register(values.email, values.password, values.username)
      await loadAll()
      message.success('注册成功')
      navigate('/')
    } catch {
      message.error(error || '注册失败')
      clearError()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5',
      padding: '20px'
    }}>
      <Card style={{ width: '100%', maxWidth: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 8 }}>个人记账助手</Title>
          <Text type="secondary">记录每一笔收支</Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form onFinish={handleLogin} layout="vertical">
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' }
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={isLoading} block size="large">
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form onFinish={handleRegister} layout="vertical">
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' }
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
                  </Form.Item>

                  <Form.Item
                    name="username"
                  >
                    <Input prefix={<UserOutlined />} placeholder="用户名（可选）" size="large" />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, message: '密码至少6位' }
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={isLoading} block size="large">
                      注册
                    </Button>
                  </Form.Item>
                </Form>
              )
            }
          ]}
        />
      </Card>
    </div>
  )
}
