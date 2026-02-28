import React, { useState, useEffect } from 'react'
import { Card, Tabs, Table, Button, Space, Tag, Switch, message, Modal, Form, Input, InputNumber, Select, Popconfirm, Typography, Badge } from 'antd'
import { UserOutlined, RobotOutlined, TagsOutlined, PlusOutlined, DeleteOutlined, EditOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'

const { Text } = Typography
const { TabPane } = Tabs

interface User {
  id: string
  email: string
  username: string | null
  role: 'user' | 'admin'
  isActive: boolean
  createdAt: string
}

interface AiConfig {
  id: string
  userId: string
  provider: string
  apiKey: string
  modelName: string
  isActive: boolean
  createdAt: string
  user?: {
    email: string
    username: string | null
  }
}

interface Category {
  id: string
  userId: string
  name: string
  icon: string
  type: 'expense' | 'income'
  parentId: string | null
  isPreset: boolean
  createdAt: string
  user?: {
    email: string
    username: string | null
  }
}

const Admin: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<User[]>([])
  const [aiConfigs, setAiConfigs] = useState<AiConfig[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [aiConfigModalOpen, setAiConfigModalOpen] = useState(false)
  const [editingAiConfig, setEditingAiConfig] = useState<AiConfig | null>(null)
  const [aiConfigForm] = Form.useForm()

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/')
      return
    }
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, configsRes, categoriesRes] = await Promise.all([
        api.admin.getUsers(),
        api.admin.getAiConfigs(),
        api.admin.getCategories(),
      ])
      if (usersRes.success) setUsers(usersRes.data as User[])
      if (configsRes.success) setAiConfigs(configsRes.data as AiConfig[])
      if (categoriesRes.success) setCategories(categoriesRes.data as Category[])
    } catch (error) {
      console.error('Failed to load admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUserStatusChange = async (userId: string, isActive: boolean) => {
    try {
      await api.admin.updateUser(userId, { isActive })
      message.success(isActive ? '用户已启用' : '用户已禁用')
      loadData()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleUserRoleChange = async (userId: string, role: 'user' | 'admin') => {
    try {
      await api.admin.updateUser(userId, { role })
      message.success('角色已更新')
      loadData()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleDeleteAiConfig = async (id: string) => {
    try {
      await api.admin.deleteAiConfig(id)
      message.success('配置已删除')
      loadData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleAddAiConfig = () => {
    setEditingAiConfig(null)
    aiConfigForm.resetFields()
    aiConfigForm.setFieldsValue({
      provider: 'openai',
      modelName: 'gpt-3.5-turbo',
      isActive: true,
    })
    setAiConfigModalOpen(true)
  }

  const handleEditAiConfig = (config: AiConfig) => {
    setEditingAiConfig(config)
    aiConfigForm.setFieldsValue({
      provider: config.provider,
      apiKey: '',
      modelName: config.modelName,
      isActive: config.isActive,
    })
    setAiConfigModalOpen(true)
  }

  const handleAiConfigSubmit = async () => {
    try {
      const values = await aiConfigForm.validateFields()
      if (editingAiConfig) {
        await api.admin.updateAiConfig(editingAiConfig.id, values)
        message.success('配置已更新')
      } else {
        await api.admin.createAiConfig(values)
        message.success('配置已创建')
      }
      setAiConfigModalOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to save AI config:', error)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      await api.admin.deleteCategory(id)
      message.success('分类已删除')
      loadData()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const userColumns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string | null) => text || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: 'user' | 'admin', record: User) => (
        <Select
          value={role}
          onChange={(value) => handleUserRoleChange(record.id, value)}
          style={{ width: 100 }}
          disabled={record.id === user?.id}
        >
          <Select.Option value="user">用户</Select.Option>
          <Select.Option value="admin">管理员</Select.Option>
        </Select>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, record: User) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleUserStatusChange(record.id, checked)}
          disabled={record.id === user?.id}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
    },
  ]

  const aiConfigColumns = [
    {
      title: '用户',
      key: 'user',
      render: (_: unknown, record: AiConfig) => record.user?.email || record.userId,
    },
    {
      title: '供应商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => <Tag color="blue">{provider}</Tag>,
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (key: string) => (
        <Space>
          <LockOutlined />
          <Text type="secondary">{key}</Text>
        </Space>
      ),
    },
    {
      title: '模型',
      dataIndex: 'modelName',
      key: 'modelName',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Badge status={isActive ? 'success' : 'default'} text={isActive ? '启用' : '禁用'} />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AiConfig) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEditAiConfig(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除此配置？"
            onConfirm={() => handleDeleteAiConfig(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const categoryColumns = [
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: 'expense' | 'income') => (
        <Tag color={type === 'expense' ? 'red' : 'green'}>
          {type === 'expense' ? '支出' : '收入'}
        </Tag>
      ),
    },
    {
      title: '所属用户',
      key: 'user',
      render: (_: unknown, record: Category) => 
        record.isPreset ? <Tag>系统预设</Tag> : (record.user?.email || record.userId),
    },
    {
      title: '预设',
      dataIndex: 'isPreset',
      key: 'isPreset',
      render: (isPreset: boolean) => (
        <Badge status={isPreset ? 'warning' : 'default'} text={isPreset ? '是' : '否'} />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Category) => (
        record.isPreset ? null : (
          <Popconfirm
            title="确认删除此分类？"
            onConfirm={() => handleDeleteCategory(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        )
      ),
    },
  ]

  if (user?.role !== 'admin') {
    return null
  }

  return (
    <div>
      <Card title="管理后台">
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <span>
                <UserOutlined />
                用户管理
              </span>
            }
            key="users"
          >
            <Table
              dataSource={users}
              columns={userColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane
            tab={
              <span>
                <RobotOutlined />
                AI配置
              </span>
            }
            key="ai-config"
          >
            <div style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAiConfig}>
                添加配置
              </Button>
            </div>
            <Table
              dataSource={aiConfigs}
              columns={aiConfigColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane
            tab={
              <span>
                <TagsOutlined />
                分类管理
              </span>
            }
            key="categories"
          >
            <Table
              dataSource={categories}
              columns={categoryColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={editingAiConfig ? '编辑AI配置' : '添加AI配置'}
        open={aiConfigModalOpen}
        onOk={handleAiConfigSubmit}
        onCancel={() => setAiConfigModalOpen(false)}
        okText="确认"
        cancelText="取消"
      >
        <Form form={aiConfigForm} layout="vertical">
          <Form.Item name="userId" label="用户" rules={[{ required: true }]}>
            <Select placeholder="选择用户">
              {users.map(u => (
                <Select.Option key={u.id} value={u.id}>
                  {u.username || u.email}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="provider" label="供应商" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="openai">OpenAI</Select.Option>
              <Select.Option value="anthropic">Anthropic</Select.Option>
              <Select.Option value="azure">Azure OpenAI</Select.Option>
              <Select.Option value="custom">自定义</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入API Key' }]}>
            <Input.Password placeholder={editingAiConfig ? '留空表示不修改' : '请输入API Key'} />
          </Form.Item>
          <Form.Item name="modelName" label="模型名称" rules={[{ required: true }]}>
            <Input placeholder="如: gpt-3.5-turbo, gpt-4" />
          </Form.Item>
          <Form.Item name="isActive" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Admin
