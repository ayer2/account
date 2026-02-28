import React, { useState } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Popconfirm, Tag, Tabs } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useDataStore } from '../stores/dataStore'
import { useAuthStore } from '../stores/authStore'
import type { Category } from '@accounting/shared'

const Categories: React.FC = () => {
  const { categories, addCategory, updateCategory, deleteCategory } = useDataStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [selectedType, setSelectedType] = useState<'expense' | 'income'>('expense')
  const [form] = Form.useForm()

  const expenseCategories = categories.filter(c => c.type === 'expense' && !c.parentId)
  const incomeCategories = categories.filter(c => c.type === 'income' && !c.parentId)

  const handleAdd = () => {
    setEditingCategory(null)
    form.resetFields()
    setIsModalOpen(true)
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    form.setFieldsValue({
      name: category.name,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    await deleteCategory(id)
    message.success('分类已删除')
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: values.name,
        })
        message.success('分类已更新')
      } else {
        await addCategory({
          name: values.name,
          type: selectedType,
          parentId: null,
          isPreset: false,
        })
        message.success('分类已创建')
      }
      setIsModalOpen(false)
      form.resetFields()
    } catch (error) {
      console.error('Form validation failed:', error)
    }
  }

  const columns = [
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'isPreset',
      key: 'isPreset',
      render: (isPreset: boolean) => (
        <Tag color={isPreset ? 'blue' : 'green'}>{isPreset ? '预设' : '自定义'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Category) => (
        <Space>
          {(isAdmin || !record.isPreset) && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {!record.isPreset && (
            <Popconfirm
              title="确认删除"
              description="删除后无法恢复，是否继续？"
              onConfirm={() => handleDelete(record.id)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card
        title="分类管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加分类
          </Button>
        }
      >
        <Tabs
          activeKey={selectedType}
          onChange={key => setSelectedType(key as 'expense' | 'income')}
          items={[
            { key: 'expense', label: '支出分类' },
            { key: 'income', label: '收入分类' },
          ]}
        />

        <Table
          columns={columns}
          dataSource={selectedType === 'expense' ? expenseCategories : incomeCategories}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingCategory ? '编辑分类' : '添加分类'}
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
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Categories
