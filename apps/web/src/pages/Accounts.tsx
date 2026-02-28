import React, { useState } from 'react'
import { Card, List, Button, Modal, Form, Input, InputNumber, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, WalletOutlined } from '@ant-design/icons'
import { useDataStore } from '../stores/dataStore'
import type { Account } from '@accounting/shared'
import { formatMoneySimple } from '@accounting/shared'

const Accounts: React.FC = () => {
  const { accounts, addAccount, updateAccount, deleteAccount } = useDataStore()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [form] = Form.useForm()

  const activeAccounts = accounts.filter(a => !a.isDeleted)

  const handleAdd = () => {
    setEditingAccount(null)
    form.resetFields()
    form.setFieldsValue({ initialBalance: 0 })
    setIsModalOpen(true)
  }

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    form.setFieldsValue({
      name: account.name,
      initialBalance: account.initialBalance,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    await deleteAccount(id)
    message.success('账户已删除')
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingAccount) {
        const newInitialBalance = values.initialBalance || 0
        await updateAccount(editingAccount.id, {
          name: values.name,
          initialBalance: newInitialBalance,
        })
        message.success('账户已更新')
      } else {
        await addAccount({
          name: values.name,
          icon: 'wallet',
          currency: 'CNY',
          initialBalance: values.initialBalance || 0,
          isPreset: false,
        })
        message.success('账户已创建')
      }
      setIsModalOpen(false)
      form.resetFields()
    } catch (error) {
      console.error('Form validation failed:', error)
    }
  }

  const totalAssets = activeAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0)

  return (
    <div className="accounts-page">
      <Card
        title="账户管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加账户
          </Button>
        }
      >
        <Card
          style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16 }}>账户总资产</span>
            <span style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
              {formatMoneySimple(totalAssets)}
            </span>
          </div>
          <div style={{ marginTop: 8, color: '#8c8c8c' }}>
            共 {activeAccounts.length} 个账户
          </div>
        </Card>

        <List
          itemLayout="horizontal"
          dataSource={activeAccounts}
          renderItem={(account) => (
            <List.Item
              actions={[
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(account)} />,
                !account.isPreset && (
                  <Popconfirm
                    title="确认删除"
                    description="删除后账户将标记为已删除，相关交易记录保留。是否继续？"
                    onConfirm={() => handleDelete(account.id)}
                    okText="确认"
                    cancelText="取消"
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={<WalletOutlined style={{ fontSize: 28, color: '#1890ff' }} />}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {account.name}
                    {account.isPreset && <Tag color="blue" size="small">预设</Tag>}
                  </div>
                }
                description={
                  <div>
                    <div>初始余额：{formatMoneySimple(account.initialBalance)}</div>
                    <div style={{ 
                      color: account.currentBalance >= 0 ? '#52c41a' : '#ff4d4f', 
                      fontWeight: 'bold',
                      marginTop: 4
                    }}>
                      当前余额：{formatMoneySimple(account.currentBalance)}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={editingAccount ? '编辑账户' : '添加账户'}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="账户名称"
            rules={[{ required: true, message: '请输入账户名称' }]}
          >
            <Input placeholder="请输入账户名称" />
          </Form.Item>
          <Form.Item name="initialBalance" label="余额">
            <InputNumber
              style={{ width: '100%' }}
              placeholder="0.00"
              precision={2}
              min={-999999999}
              max={999999999}
            />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        @media (max-width: 576px) {
          .accounts-page .ant-card-head-title {
            font-size: 16px;
          }
          .accounts-page .ant-list-item {
            padding: 12px 0;
          }
          .accounts-page .ant-list-item-meta-title {
            font-size: 16px;
          }
          .accounts-page .ant-list-item-meta-description {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  )
}

export default Accounts
