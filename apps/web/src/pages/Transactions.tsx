import React, { useState, useMemo, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, TimePicker, Space, message, Popconfirm, Tag, Tabs, Drawer } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, FilterOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDataStore } from '../stores/dataStore'
import type { Transaction, TransactionType } from '@accounting/shared'
import { formatMoneySimple, sortByDate, formatDate } from '@accounting/shared'

const { RangePicker } = DatePicker

const transactionTypeLabels: Record<TransactionType, { label: string; color: string }> = {
  expense: { label: '支出', color: 'red' },
  income: { label: '收入', color: 'green' },
  transfer: { label: '转账', color: 'blue' },
  refund: { label: '退款', color: 'orange' },
  lend: { label: '借出', color: 'purple' },
  borrow: { label: '借入', color: 'cyan' },
}

const Transactions: React.FC = () => {
  const {
    transactions,
    accounts,
    categories,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getAccountById,
    getCategoryById,
    getParentCategories,
    getChildCategories,
  } = useDataStore()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [transactionType, setTransactionType] = useState<TransactionType>('expense')
  const [form] = Form.useForm()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 576)

  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [filterAccount, setFilterAccount] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all')
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  
  // 临时筛选状态
  const [tempDateRange, setTempDateRange] = useState<[string, string] | null>(null)
  const [tempFilterAccount, setTempFilterAccount] = useState<string | null>(null)
  const [tempFilterType, setTempFilterType] = useState<TransactionType | 'all'>('all')

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 576)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const activeAccounts = accounts.filter(a => !a.isDeleted)

  const filteredTransactions = useMemo(() => {
    let result = [...transactions]

    if (dateRange) {
      result = result.filter(t => t.date >= dateRange[0] && t.date <= dateRange[1])
    }

    if (filterAccount) {
      result = result.filter(t => t.accountId === filterAccount || t.toAccountId === filterAccount)
    }

    if (filterCategory) {
      result = result.filter(t => t.categoryId === filterCategory)
    }

    if (filterType !== 'all') {
      result = result.filter(t => t.type === filterType)
    }

    return sortByDate(result, 'desc')
  }, [transactions, dateRange, filterAccount, filterCategory, filterType])

  const handleAdd = () => {
    setEditingTransaction(null)
    setTransactionType('expense')
    form.resetFields()
    form.setFieldsValue({
      date: dayjs(),
      time: dayjs(),
    })
    setIsModalOpen(true)
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setTransactionType(transaction.type)
    form.setFieldsValue({
      amount: transaction.amount,
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
      categoryId: transaction.categoryId,
      date: dayjs(transaction.date),
      time: dayjs(`2000-01-01 ${transaction.time}`),
      note: transaction.note,
    })
    setIsModalOpen(true)
  }

  const handleCopy = (transaction: Transaction) => {
    setEditingTransaction(null)
    setTransactionType(transaction.type)
    form.setFieldsValue({
      amount: transaction.amount,
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
      categoryId: transaction.categoryId,
      date: dayjs(),
      time: dayjs(),
      note: transaction.note,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    await deleteTransaction(id)
    message.success('交易记录已删除')
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const transactionData = {
        type: transactionType,
        amount: values.amount,
        accountId: values.accountId,
        toAccountId: transactionType === 'transfer' ? values.toAccountId : null,
        categoryId: transactionType === 'transfer' ? null : values.categoryId,
        date: values.date.format('YYYY-MM-DD'),
        time: values.time.format('HH:mm'),
        note: values.note || '',
        source: 'manual' as const,
        originalRefundId: null,
      }

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, transactionData)
        message.success('交易记录已更新')
      } else {
        await addTransaction(transactionData)
        message.success('交易记录已创建')
      }
      setIsModalOpen(false)
      form.resetFields()
    } catch (error) {
      console.error('Form validation failed:', error)
    }
  }

  const handleTypeChange = (type: TransactionType) => {
    setTransactionType(type)
    form.setFieldsValue({
      categoryId: undefined,
      toAccountId: undefined,
    })
  }

  const getCategoryOptions = () => {
    let type: 'expense' | 'income' = 'expense'
    if (transactionType === 'income' || transactionType === 'refund') {
      type = 'income'
    } else if (transactionType === 'lend' || transactionType === 'borrow') {
      type = 'income'
    }
    const parents = getParentCategories(type)
    return parents.map(parent => ({
      label: parent.name,
      value: parent.id,
    }))
  }

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      render: (date: string, record: Transaction) => (
        <div>
          <div style={{ fontSize: 12 }}>{formatDate(date)}</div>
          <div style={{ color: '#8c8c8c', fontSize: 10 }}>{record.time}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 60,
      render: (type: TransactionType) => {
        const config = transactionTypeLabels[type]
        return <Tag color={config.color} style={{ fontSize: 10 }}>{config.label}</Tag>
      },
    },
    {
      title: '账户',
      dataIndex: 'accountId',
      key: 'accountId',
      render: (accountId: string, record: Transaction) => {
        const account = getAccountById(accountId)
        if (record.type === 'transfer') {
          const toAccount = getAccountById(record.toAccountId || '')
          return `${account?.name || ''} → ${toAccount?.name || ''}`
        }
        return account?.name || ''
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 90,
      render: (amount: number, record: Transaction) => {
        const isNegative = ['expense', 'lend'].includes(record.type)
        const displayAmount = isNegative ? -amount : amount
        return (
          <span
            style={{
              color: displayAmount >= 0 ? '#52c41a' : '#ff4d4f',
              fontWeight: 'bold',
              fontSize: 13,
            }}
          >
            {formatMoneySimple(displayAmount)}
          </span>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: Transaction) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="确认删除"
            description="删除后将恢复账户余额，是否继续？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const FilterContent = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>日期范围</div>
        {isMobile ? (
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <DatePicker
              placeholder="开始日期"
              style={{ width: '100%' }}
              size="large"
              value={tempDateRange ? dayjs(tempDateRange[0]) : null}
              onChange={(date) => {
                if (date) {
                  const newStartDate = date.format('YYYY-MM-DD')
                  if (tempDateRange) {
                    const endDate = tempDateRange[1]
                    if (newStartDate <= endDate) {
                      setTempDateRange([newStartDate, endDate])
                    } else {
                      setTempDateRange([newStartDate, newStartDate])
                    }
                  } else {
                    setTempDateRange([newStartDate, dayjs().format('YYYY-MM-DD')])
                  }
                }
              }}
              inputReadOnly
              getPopupContainer={(trigger) => trigger.parentElement || document.body}
            />
            <DatePicker
              placeholder="结束日期"
              style={{ width: '100%' }}
              size="large"
              value={tempDateRange ? dayjs(tempDateRange[1]) : null}
              onChange={(date) => {
                if (date) {
                  const newEndDate = date.format('YYYY-MM-DD')
                  if (tempDateRange) {
                    const startDate = tempDateRange[0]
                    if (startDate <= newEndDate) {
                      setTempDateRange([startDate, newEndDate])
                    } else {
                      setTempDateRange([newEndDate, newEndDate])
                    }
                  } else {
                    setTempDateRange([dayjs().format('YYYY-MM-DD'), newEndDate])
                  }
                }
              }}
              inputReadOnly
              getPopupContainer={(trigger) => trigger.parentElement || document.body}
            />
          </Space>
        ) : (
          <RangePicker
            style={{ width: '100%' }}
            separator="至"
            size="large"
            value={tempDateRange ? [dayjs(tempDateRange[0]), dayjs(tempDateRange[1])] : null}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setTempDateRange([
                  dates[0].format('YYYY-MM-DD'),
                  dates[1].format('YYYY-MM-DD'),
                ])
              } else {
                setTempDateRange(null)
              }
            }}
          />
        )}
      </div>
      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>账户</div>
        <Select
          placeholder="选择账户"
          allowClear
          style={{ width: '100%' }}
          size="large"
          value={tempFilterAccount}
          onChange={setTempFilterAccount}
          options={activeAccounts.map(a => ({ label: a.name, value: a.id }))}
        />
      </div>
      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>交易类型</div>
        <Select
          placeholder="交易类型"
          style={{ width: '100%' }}
          size="large"
          value={tempFilterType}
          onChange={setTempFilterType}
          options={[
            { label: '全部', value: 'all' },
            ...Object.entries(transactionTypeLabels).map(([key, value]) => ({
              label: value.label,
              value: key,
            })),
          ]}
        />
      </div>
      <Space style={{ width: '100%' }} size="middle">
        <Button 
          block 
          size="large" 
          onClick={() => {
            setTempDateRange(null)
            setTempFilterAccount(null)
            setTempFilterType('all')
          }}
        >
          重置
        </Button>
        <Button 
          type="primary" 
          block 
          size="large" 
          onClick={() => {
            setDateRange(tempDateRange)
            setFilterAccount(tempFilterAccount)
            setFilterType(tempFilterType)
            setFilterDrawerOpen(false)
          }}
        >
          确定
        </Button>
      </Space>
    </Space>
  )

  return (
    <div className="transactions-page">
      <Card
        title="交易记录"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加交易
          </Button>
        }
      >
        <div className="filter-bar">
          <Button 
            icon={<FilterOutlined />} 
            onClick={() => {
              // 打开抽屉时，将当前筛选状态复制到临时状态
              setTempDateRange(dateRange)
              setTempFilterAccount(filterAccount)
              setTempFilterType(filterType)
              setFilterDrawerOpen(true)
            }}
          >
            筛选
          </Button>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#8c8c8c' }}>
            共 {filteredTransactions.length} 条记录
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredTransactions}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 500 }}
          size="small"
        />
      </Card>

      <Drawer
        title="筛选"
        placement="bottom"
        onClose={() => setFilterDrawerOpen(false)}
        open={filterDrawerOpen}
        height={isMobile ? '70%' : 450}
        styles={{ body: { overflow: 'visible' } }}
      >
        <FilterContent />
      </Drawer>

      <Drawer
        title={editingTransaction ? '编辑交易' : '添加交易'}
        placement="bottom"
        onClose={() => {
          setIsModalOpen(false)
          form.resetFields()
        }}
        open={isModalOpen}
        height={isMobile ? '85%' : 500}
        width={isMobile ? '100%' : 500}
      >
        <Tabs
          activeKey={transactionType}
          onChange={key => handleTypeChange(key as TransactionType)}
          items={Object.entries(transactionTypeLabels).map(([key, value]) => ({
            key,
            label: <span style={{ color: value.color }}>{value.label}</span>,
          }))}
        />

        <Form form={form} layout="vertical">
          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="0.00"
              precision={2}
              min={0.01}
              max={999999999}
            />
          </Form.Item>

          {transactionType === 'transfer' ? (
            <>
              <Form.Item
                name="accountId"
                label="转出账户"
                rules={[{ required: true, message: '请选择转出账户' }]}
              >
                <Select
                  placeholder="请选择转出账户"
                  options={activeAccounts.map(a => ({ label: a.name, value: a.id }))}
                />
              </Form.Item>
              <Form.Item
                name="toAccountId"
                label="转入账户"
                rules={[{ required: true, message: '请选择转入账户' }]}
              >
                <Select
                  placeholder="请选择转入账户"
                  options={activeAccounts.map(a => ({ label: a.name, value: a.id }))}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="accountId"
                label="账户"
                rules={[{ required: true, message: '请选择账户' }]}
              >
                <Select
                  placeholder="请选择账户"
                  options={activeAccounts.map(a => ({ label: a.name, value: a.id }))}
                />
              </Form.Item>
              <Form.Item
                name="categoryId"
                label="分类"
                rules={[{ required: true, message: '请选择分类' }]}
              >
                <Select
                  placeholder="请选择分类"
                  options={getCategoryOptions()}
                />
              </Form.Item>
            </>
          )}

          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="time" label="时间" rules={[{ required: true }]}>
            <TimePicker style={{ width: '100%' }} format="HH:mm" />
          </Form.Item>

          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息（可选）" maxLength={100} showCount />
          </Form.Item>

          <Form.Item>
            <Button type="primary" block onClick={handleSubmit}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      <style>{`
        .filter-bar {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }
        @media (max-width: 576px) {
          .transactions-page .ant-card-head-title {
            font-size: 16px;
          }
          .transactions-page .ant-table {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  )
}

export default Transactions
