import React, { useMemo, useState } from 'react'
import { Card, Row, Col, Statistic, Segmented, Empty } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { useDataStore } from '../stores/dataStore'
import { getMonthRange, getCurrentMonth, formatMoneySimple } from '@accounting/shared'

const Statistics: React.FC = () => {
  const { transactions, getCategoryById } = useDataStore()
  const [timeDimension, setTimeDimension] = useState<'month' | 'week' | 'day'>('month')

  const { year, month } = getCurrentMonth()
  const monthRange = getMonthRange(year, month)

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

  const expenseByCategory = useMemo(() => {
    const result: Record<string, number> = {}
    monthTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        if (t.categoryId) {
          const category = getCategoryById(t.categoryId)
          if (category) {
            const parentId = category.parentId
            if (parentId) {
              const parent = getCategoryById(parentId)
              const name = parent?.name || category.name
              result[name] = (result[name] || 0) + t.amount
            } else {
              result[category.name] = (result[category.name] || 0) + t.amount
            }
          }
        }
      })
    return result
  }, [monthTransactions, getCategoryById])

  const incomeByCategory = useMemo(() => {
    const result: Record<string, number> = {}
    monthTransactions
      .filter(t => t.type === 'income')
      .forEach(t => {
        if (t.categoryId) {
          const category = getCategoryById(t.categoryId)
          if (category) {
            const parentId = category.parentId
            if (parentId) {
              const parent = getCategoryById(parentId)
              const name = parent?.name || category.name
              result[name] = (result[name] || 0) + t.amount
            } else {
              result[category.name] = (result[category.name] || 0) + t.amount
            }
          }
        }
      })
    return result
  }, [monthTransactions, getCategoryById])

  const trendData = useMemo(() => {
    const labels: string[] = []
    const expenseData: number[] = []
    const incomeData: number[] = []

    if (timeDimension === 'day') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        labels.push(`${date.getMonth() + 1}/${date.getDate()}`)

        const dayTransactions = transactions.filter(t => t.date === dateStr)
        let dayExpense = 0
        let dayIncome = 0

        dayTransactions.forEach(t => {
          if (t.type === 'expense') {
            dayExpense += t.amount
          } else if (t.type === 'income') {
            dayIncome += t.amount
          } else if (t.type === 'refund') {
            dayExpense -= t.amount
          }
        })

        expenseData.push(dayExpense)
        incomeData.push(dayIncome)
      }
    } else if (timeDimension === 'week') {
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)

        const startStr = weekStart.toISOString().split('T')[0]
        const endStr = weekEnd.toISOString().split('T')[0]
        labels.push(`${weekStart.getMonth() + 1}/${weekStart.getDate()}`)

        const weekTransactions = transactions.filter(t => t.date >= startStr && t.date <= endStr)
        let weekExpense = 0
        let weekIncome = 0

        weekTransactions.forEach(t => {
          if (t.type === 'expense') {
            weekExpense += t.amount
          } else if (t.type === 'income') {
            weekIncome += t.amount
          } else if (t.type === 'refund') {
            weekExpense -= t.amount
          }
        })

        expenseData.push(weekExpense)
        incomeData.push(weekIncome)
      }
    } else if (timeDimension === 'month') {
      for (let i = 11; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        labels.push(`${year}/${month}`)

        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
        const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

        const monthTransactions = transactions.filter(t => t.date >= monthStart && t.date <= monthEnd)
        let monthExpense = 0
        let monthIncome = 0

        monthTransactions.forEach(t => {
          if (t.type === 'expense') {
            monthExpense += t.amount
          } else if (t.type === 'income') {
            monthIncome += t.amount
          } else if (t.type === 'refund') {
            monthExpense -= t.amount
          }
        })

        expenseData.push(monthExpense)
        incomeData.push(monthIncome)
      }
    }

    return { labels, expenseData, incomeData }
  }, [transactions, timeDimension])

  const expensePieOption = useMemo(() => {
    const data = Object.entries(expenseByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { fontSize: 11 },
      },
      series: [
        {
          name: '支出分类',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold',
            },
          },
          data,
        },
      ],
    }
  }, [expenseByCategory])

  const incomePieOption = useMemo(() => {
    const data = Object.entries(incomeByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { fontSize: 11 },
      },
      series: [
        {
          name: '收入分类',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold',
            },
          },
          data,
        },
      ],
    }
  }, [incomeByCategory])

  const trendLineOption = useMemo(() => {
    return {
      tooltip: {
        trigger: 'axis',
      },
      legend: {
        data: ['支出', '收入'],
        textStyle: { fontSize: 11 },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: trendData.labels,
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          name: '支出',
          type: 'line',
          data: trendData.expenseData,
          itemStyle: { color: '#ff4d4f' },
          smooth: true,
        },
        {
          name: '收入',
          type: 'line',
          data: trendData.incomeData,
          itemStyle: { color: '#52c41a' },
          smooth: true,
        },
      ],
    }
  }, [trendData])

  const hasExpenseData = Object.keys(expenseByCategory).length > 0
  const hasIncomeData = Object.keys(incomeByCategory).length > 0

  return (
    <div className="statistics-page">
      <Card title={`${year}年${month}月收支概览`} style={{ marginBottom: 16 }}>
        <Row gutter={[8, 16]}>
          <Col xs={8}>
            <Statistic
              title="支出"
              value={monthStats.totalExpense}
              formatter={(value) => formatMoneySimple(value as number).replace('¥', '')}
              prefix={<ArrowDownOutlined />}
              valueStyle={{ color: '#ff4d4f', fontSize: 16 }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="收入"
              value={monthStats.totalIncome}
              formatter={(value) => formatMoneySimple(value as number).replace('¥', '')}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 16 }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="结余"
              value={Math.abs(monthStats.balance)}
              formatter={(value) => formatMoneySimple(value as number).replace('¥', '')}
              prefix={monthStats.balance >= 0 ? '+' : '-'}
              valueStyle={{ color: monthStats.balance >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 16 }}
            />
          </Col>
        </Row>
      </Card>

      <Card title="收支趋势" style={{ marginBottom: 16 }}>
        <Segmented
          options={[
            { label: '近7天', value: 'day' },
            { label: '近12周', value: 'week' },
            { label: '近12月', value: 'month' },
          ]}
          value={timeDimension}
          onChange={value => setTimeDimension(value as 'day' | 'week' | 'month')}
          style={{ marginBottom: 16 }}
          size="small"
        />
        <ReactECharts option={trendLineOption} style={{ height: 250 }} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card title="支出分类" size="small">
            {hasExpenseData ? (
              <ReactECharts option={expensePieOption} style={{ height: 250 }} />
            ) : (
              <Empty description="暂无支出数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="收入分类" size="small">
            {hasIncomeData ? (
              <ReactECharts option={incomePieOption} style={{ height: 250 }} />
            ) : (
              <Empty description="暂无收入数据" />
            )}
          </Card>
        </Col>
      </Row>

      <style>{`
        @media (max-width: 576px) {
          .statistics-page .ant-card-head-title {
            font-size: 14px;
          }
          .statistics-page .ant-statistic-title {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  )
}

export default Statistics
