import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Statistic, List, Button, Empty, Space, Tag, Progress, Divider, Typography, DatePicker, Select } from 'antd'
import { PlusOutlined, ArrowUpOutlined, ArrowDownOutlined, WalletOutlined, WarningOutlined, CheckCircleOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useDataStore } from '../stores/dataStore'
import { formatMoneySimple, formatDate, getMonthRange, getCurrentMonth, sortByDate } from '@accounting/shared'
import type { Transaction, TransactionType } from '@accounting/shared'
import dayjs from 'dayjs'

const { Text } = Typography

const transactionTypeLabels: Record<TransactionType, { label: string; color: string }> = {
  expense: { label: '支出', color: 'red' },
  income: { label: '收入', color: 'green' },
  transfer: { label: '转账', color: 'blue' },
  refund: { label: '退款', color: 'orange' },
  lend: { label: '借出', color: 'purple' },
  borrow: { label: '借入', color: 'cyan' },
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { transactions, accounts, getCategoryById, getAccountById, settings } = useDataStore()

  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs())

  const year = selectedDate.year()
  const month = selectedDate.month() + 1
  const monthRange = getMonthRange(year, month)
  const today = selectedDate.date()
  const daysInMonth = selectedDate.daysInMonth()
  const isCurrentMonth = selectedDate.isSame(dayjs(), 'month')

  const handleMonthChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      setSelectedDate(date)
    }
  }

  const handlePrevMonth = () => {
    setSelectedDate(selectedDate.subtract(1, 'month'))
  }

  const handleNextMonth = () => {
    if (!isCurrentMonth) {
      setSelectedDate(selectedDate.add(1, 'month'))
    }
  }

  const activeAccounts = accounts.filter(a => !a.isDeleted)

  const monthTransactions = useMemo(() => {
    return transactions.filter(
      t => t.date >= monthRange.start && t.date <= monthRange.end
    )
  }, [transactions, monthRange])

  const monthStats = useMemo(() => {
    let totalExpense = 0
    let totalIncome = 0

    monthTransactions.forEach(t => {
      if (t.type === 'expense') {
        totalExpense += t.amount
      } else if (t.type === 'income') {
        totalIncome += t.amount
      } else if (t.type === 'refund') {
        totalExpense -= t.amount
      }
    })

    return {
      totalExpense,
      totalIncome,
      balance: totalIncome - totalExpense,
    }
  }, [monthTransactions])

  const totalAssets = useMemo(() => {
    return activeAccounts.reduce((sum, a) => sum + Number(a.currentBalance), 0)
  }, [activeAccounts])

  const todayExpense = useMemo(() => {
    const todayStr = selectedDate.format('YYYY-MM-DD')
    return transactions
      .filter(t => t.date === todayStr && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)
  }, [transactions, selectedDate])

  const budgetInfo = useMemo(() => {
    const monthlyBudget = settings?.monthlyBudget || 0
    if (monthlyBudget <= 0) return null

    const dailyBudget = monthlyBudget / daysInMonth
    const dailyBudgetUsed = todayExpense
    const monthUsagePercent = (monthStats.totalExpense / monthlyBudget) * 100
    const remainingBudget = monthlyBudget - monthStats.totalExpense
    const isOverDailyBudget = dailyBudgetUsed > dailyBudget
    const isOverMonthlyBudget = monthStats.totalExpense > monthlyBudget

    const alertThreshold = settings?.budgetAlertThreshold || 80
    const shouldAlert = (settings?.budgetAlertEnabled && monthUsagePercent >= alertThreshold) || isOverMonthlyBudget

    return {
      monthlyBudget,
      dailyBudget,
      dailyBudgetUsed,
      monthUsagePercent,
      remainingBudget,
      isOverDailyBudget,
      isOverMonthlyBudget,
      shouldAlert,
      alertThreshold,
    }
  }, [settings, monthStats.totalExpense, daysInMonth, todayExpense])

  const recentTransactions = useMemo(() => {
    return sortByDate(monthTransactions, 'desc').slice(0, 5)
  }, [monthTransactions])

  const handleAddTransaction = () => {
    navigate('/transactions')
  }

  const getTransactionDisplay = (t: Transaction) => {
    const account = getAccountById(t.accountId)
    const category = t.categoryId ? getCategoryById(t.categoryId) : null
    const parent = category?.parentId ? getCategoryById(category.parentId) : null
    const categoryName = parent ? `${parent.name} - ${category.name}` : category?.name || ''

    let displayInfo = ''
    if (t.type === 'transfer') {
      const toAccount = getAccountById(t.toAccountId || '')
      displayInfo = `${account?.name || ''} → ${toAccount?.name || ''}`
    } else {
      displayInfo = categoryName || t.note || ''
    }

    const isNegative = ['expense', 'lend'].includes(t.type)
    const displayAmount = isNegative ? -t.amount : t.amount

    return {
      category: categoryName || '转账',
      account: account?.name || '',
      displayInfo,
      amount: displayAmount,
      type: t.type,
    }
  }

  return (
    <div className="dashboard">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Button icon={<LeftOutlined />} onClick={handlePrevMonth} />
        <DatePicker.MonthPicker
          value={selectedDate}
          onChange={handleMonthChange}
          allowClear={false}
          style={{ margin: '0 16px', width: 150 }}
          placeholder="选择月份"
        />
        <Button 
          icon={<RightOutlined />} 
          onClick={handleNextMonth} 
          disabled={isCurrentMonth}
        />
        {isCurrentMonth && <span style={{ marginLeft: 8, color: '#999' }}>(当前月)</span>}
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic
              title={`${month}月支出`}
              value={monthStats.totalExpense}
              formatter={(value) => formatMoneySimple(value as number).replace('¥', '')}
              prefix={<ArrowDownOutlined />}
              valueStyle={{ color: '#ff4d4f', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic
              title={`${month}月收入`}
              value={monthStats.totalIncome}
              formatter={(value) => formatMoneySimple(value as number).replace('¥', '')}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title={`${month}月结余`}
              value={Math.abs(monthStats.balance)}
              formatter={(value) => formatMoneySimple(value as number).replace('¥', '')}
              prefix={monthStats.balance >= 0 ? '+' : '-'}
              valueStyle={{ color: monthStats.balance >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}
            />
          </Card>
        </Col>
        {budgetInfo && (
          <Col xs={24}>
            <Card
              size="small"
              title={
                <Space>
                  <span>本月预算</span>
                  {budgetInfo.shouldAlert ? (
                    <Tag color="red" icon={<WarningOutlined />}>超标</Tag>
                  ) : (
                    <Tag color="green" icon={<CheckCircleOutlined />}>正常</Tag>
                  )}
                </Space>
              }
              extra={<Button type="link" size="small" onClick={() => navigate('/settings')}>设置</Button>}
            >
              <Row gutter={16}>
                <Col xs={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">本月已支出</Text>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: budgetInfo.isOverMonthlyBudget ? '#ff4d4f' : '#333' }}>
                      {formatMoneySimple(monthStats.totalExpense).replace('¥', '')}
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">预算总额</Text>
                    <div>{formatMoneySimple(budgetInfo.monthlyBudget).replace('¥', '')}</div>
                  </div>
                  <div>
                    <Text type="secondary">剩余预算</Text>
                    <div style={{ color: budgetInfo.remainingBudget >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      {formatMoneySimple(Math.abs(budgetInfo.remainingBudget)).replace('¥', '')}
                      {budgetInfo.remainingBudget < 0 && ' (已超支)'}
                    </div>
                  </div>
                </Col>
                <Col xs={12}>
                  <Progress
                    type="circle"
                    percent={Math.min(budgetInfo.monthUsagePercent, 100)}
                    format={(percent) => `${percent?.toFixed(0)}%`}
                    strokeColor={budgetInfo.isOverMonthlyBudget ? '#ff4d4f' : budgetInfo.shouldAlert ? '#faad14' : '#52c41a'}
                    size={80}
                  />
                </Col>
              </Row>
              <Divider style={{ margin: '12px 0' }} />
              <Row gutter={16}>
                <Col xs={12}>
                  <Text type="secondary">日均预算</Text>
                  <div>{formatMoneySimple(budgetInfo.dailyBudget).replace('¥', '')}</div>
                </Col>
                <Col xs={12}>
                  <Text type="secondary">今日已用</Text>
                  <div style={{ color: budgetInfo.isOverDailyBudget ? '#ff4d4f' : '#333' }}>
                    {formatMoneySimple(budgetInfo.dailyBudgetUsed).replace('¥', '')}
                    {budgetInfo.isOverDailyBudget && <WarningOutlined style={{ marginLeft: 4 }} />}
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        )}
        <Col xs={24}>
          <Card 
            size="small"
            title="账户总资产"
            extra={<Button type="link" size="small" onClick={() => navigate('/accounts')}>管理</Button>}
          >
            <Statistic
              value={totalAssets}
              formatter={(value) => formatMoneySimple(value as number).replace('¥', '')}
              prefix={<WalletOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title="近期交易"
            extra={
              <Space>
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddTransaction}>
                  记一笔
                </Button>
              </Space>
            }
          >
            {recentTransactions.length > 0 ? (
              <List
                itemLayout="horizontal"
                dataSource={recentTransactions}
                renderItem={item => {
                  const display = getTransactionDisplay(item)
                  const typeConfig = transactionTypeLabels[item.type]
                  return (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: '#f0f0f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 16,
                            }}
                          >
                            💰
                          </div>
                        }
                        title={
                          <Space>
                            <span style={{ fontSize: 14 }}>{display.category}</span>
                            <Tag color={typeConfig.color} style={{ marginLeft: 4, fontSize: 10 }}>
                              {typeConfig.label}
                            </Tag>
                          </Space>
                        }
                        description={`${formatDate(item.date)} · ${display.displayInfo}`}
                      />
                      <div
                        style={{
                          color: display.amount >= 0 ? '#52c41a' : '#ff4d4f',
                          fontWeight: 'bold',
                          fontSize: 14,
                        }}
                      >
                        {formatMoneySimple(display.amount)}
                      </div>
                    </List.Item>
                  )
                }}
              />
            ) : (
              <Empty
                description="暂无交易记录"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTransaction}>
                  开始记账
                </Button>
              </Empty>
            )}
          </Card>
        </Col>
      </Row>

      <style>{`
        @media (max-width: 576px) {
          .dashboard .ant-card-head-title {
            font-size: 14px;
          }
          .dashboard .ant-statistic-title {
            font-size: 12px;
          }
          .dashboard .ant-list-item {
            padding: 8px 0;
          }
        }
      `}</style>
    </div>
  )
}

export default Dashboard
