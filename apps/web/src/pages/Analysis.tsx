import React, { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, List, Avatar, Typography, Space, Spin, Alert, DatePicker } from 'antd'
import { SendOutlined, UserOutlined, RobotOutlined, WarningOutlined } from '@ant-design/icons'
import { api } from '../services/api'
import dayjs from 'dayjs'

const { Text } = Typography

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface QuickQuestion {
  id: string
  question: string
}

const quickQuestions: QuickQuestion[] = [
  { id: '1', question: '本月支出多少？' },
  { id: '2', question: '哪个类别花得最多？' },
  { id: '3', question: '收入来源有哪些？' },
  { id: '4', question: '对比上个月支出有什么变化？' },
  { id: '5', question: '本月有什么消费建议？' },
  { id: '6', question: '哪些支出可以减少？' },
]

const Analysis: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '你好！我是你的记账AI助手，可以帮你分析交易记录、解答财务问题。你可以问我：\n\n• 本月支出多少？\n• 哪个类别花得最多？\n• 对比上个月有什么变化？\n• 有什么消费建议？\n\n也可以点击下方快捷问题快速提问。',
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(dayjs().year())
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)
    setError(null)

    try {
      const response = await api.analysis.chat(inputValue.trim(), selectedYear, selectedMonth)

      if (response.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.data.reply,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        setError(response.error || 'AI 回复失败')
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError('AI 服务暂不可用，请检查 AI 配置')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickQuestion = async (question: string) => {
    setInputValue(question)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setLoading(true)
    setError(null)

    try {
      const response = await api.analysis.chat(question, selectedYear, selectedMonth)

      if (response.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.data.reply,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        setError(response.error || 'AI 回复失败')
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError('AI 服务暂不可用，请检查 AI 配置')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs())

  const handleDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      setSelectedDate(date)
    }
  }

  useEffect(() => {
    setSelectedYear(selectedDate.year())
    setSelectedMonth(selectedDate.month() + 1)
  }, [selectedDate])

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ fontSize: 16 }}>AI 财务分析</Text>
        <DatePicker.MonthPicker
          value={selectedDate}
          onChange={handleDateChange}
          allowClear={false}
          placeholder="选择月份"
        />
      </div>

      {error && (
        <Alert
          message={error}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError(null)}
        />
      )}

      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', overflow: 'hidden' } }}
      >
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
          <List
            dataSource={messages}
            renderItem={item => (
              <List.Item style={{ border: 'none', justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <Space align="start" direction={item.role === 'user' ? 'row-reverse' : 'row'}>
                  <Avatar
                    icon={item.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    style={{
                      backgroundColor: item.role === 'user' ? '#1890ff' : '#52c41a',
                    }}
                  />
                  <div
                    style={{
                      maxWidth: '70%',
                      padding: '12px 16px',
                      borderRadius: 12,
                      backgroundColor: item.role === 'user' ? '#1890ff' : '#f5f5f5',
                      color: item.role === 'user' ? '#fff' : '#333',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {item.content}
                  </div>
                </Space>
              </List.Item>
            )}
          />
          {loading && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <Spin tip="AI 思考中..." />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>快捷问题：</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {quickQuestions.map(q => (
                  <Button
                    key={q.id}
                    size="small"
                    onClick={() => handleQuickQuestion(q.question)}
                    disabled={loading}
                  >
                    {q.question}
                  </Button>
                ))}
              </div>
            </div>
            <Input.Search
              placeholder="输入你的问题..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              enterButton={<SendOutlined />}
              onSearch={handleSend}
              loading={loading}
              size="large"
            />
          </Space>
        </div>
      </Card>
    </div>
  )
}

export default Analysis
