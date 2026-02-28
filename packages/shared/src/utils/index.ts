import { v4 as uuidv4 } from 'uuid'

export const generateId = (): string => {
  return uuidv4()
}

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toTimeString().slice(0, 5)
}

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString()
}

export const formatMoney = (amount: number, currency: string = 'CNY'): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const formatMoneySimple = (amount: number | string): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  const absAmount = Math.abs(numAmount)
  const sign = numAmount < 0 ? '-' : ''
  const formatted = absAmount.toLocaleString('zh-CN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2,
    useGrouping: true
  })
  return `${sign}¥${formatted}`
}

export const parseMoney = (value: string): number => {
  const cleaned = value.replace(/[^\d.-]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.round(num * 100) / 100
}

export const getMonthRange = (year: number, month: number): { start: string; end: string } => {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    start: formatDate(start),
    end: formatDate(end),
  }
}

export const getCurrentMonth = (): { year: number; month: number } => {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }
}

export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate()
}

export const isToday = (date: string): boolean => {
  return date === formatDate(new Date())
}

export const isThisMonth = (date: string): boolean => {
  const d = new Date(date)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export const groupByDate = <T extends { date: string }>(items: T[]): Record<string, T[]> => {
  return items.reduce(
    (acc, item) => {
      const date = item.date
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(item)
      return acc
    },
    {} as Record<string, T[]>
  )
}

export const sortByDate = <T extends { date: string; time: string }>(
  items: T[],
  order: 'asc' | 'desc' = 'desc'
): T[] => {
  return [...items].sort((a, b) => {
    const dateTimeA = `${a.date}T${a.time}`
    const dateTimeB = `${b.date}T${b.time}`
    return order === 'desc'
      ? dateTimeB.localeCompare(dateTimeA)
      : dateTimeA.localeCompare(dateTimeB)
  })
}
