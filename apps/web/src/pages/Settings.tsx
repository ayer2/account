
import React, { useState, useEffect } from 'react'
import { Card, Button, Divider, message, Modal, Upload, Space, Typography, Popconfirm, InputNumber, Switch, Slider, Row, Col } from 'antd'
import { DownloadOutlined, UploadOutlined, DeleteOutlined, SettingOutlined, DollarOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import * as XLSX from 'xlsx'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { useDataStore } from '../stores/dataStore'
import { getDB } from '../db'
import { api } from '../services/api'

// 使用 registerPlugin 注册自定义插件（Capacitor 4+ 推荐方式，兼容性更好）
interface NotificationSettingsPluginInterface {
  openSettings(): Promise<void>
  checkPermission(): Promise<{ granted: boolean }>
}
const NotificationSettingsPlugin = registerPlugin<NotificationSettingsPluginInterface>('NotificationSettings')

const { Text, Paragraph } = Typography

const transactionTypeLabels: Record<string, string> = {
  expense: '支出', 
  income: '收入',
  transfer: '转账',
  refund: '退款',
  lend: '借出',
  borrow: '借入',
}

const Settings: React.FC = () => {
  const { accounts, categories, transactions, loadAll, getAccountById, getCategoryById, settings } = useDataStore()
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [budgetLoading, setBudgetLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  
  // 原生权限状态
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(null)

  // 检查无障碍服务权限状态
  useEffect(() => {
    const checkNotificationPermission = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // 使用 registerPlugin 方式，比 window.Capacitor.Plugins 更可靠
          const result = await NotificationSettingsPlugin.checkPermission()
          setNotificationGranted(result.granted)
        } else {
          // 非原生环境（网页端）不支持此功能
          setNotificationGranted(false)
        }
      } catch (e) {
        console.error('检查无障碍权限失败', e)
        setNotificationGranted(false)
      }
    }
    checkNotificationPermission()
  }, [])

  // 跳转到系统无障碍设置页
  const handleOpenNotificationSettings = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await NotificationSettingsPlugin.openSettings()
        Modal.info({
          title: '授权引导',
          content: '请在弹出的"辅助功能"设置页面中，找到【个人记账助手】，打开开关授权即可。授权后返回 App，自动记账立即生效。',
          okText: '知道了'
        })
      } else {
        message.warning('该功能仅在移动端 App 中可用')
      }
    } catch (e) {
      console.error('跳转设置失败', e)
      message.error('无法跳转到系统设置，请手动前往：设置 → 辅助功能 → 已安装应用')
    }
  }
  
  const monthlyBudget = settings?.monthlyBudget || 0
  const budgetAlertEnabled = settings?.budgetAlertEnabled || false
  const budgetAlertThreshold = settings?.budgetAlertThreshold || 80

  const handleBudgetChange = async (value: number | null) => {
    setBudgetLoading(true)
    try {
      await api.settings.update({
        monthlyBudget: value || 0,
      })
      await loadAll()
      message.success('预算设置已保存')
    } catch (error) {
      console.error('Failed to update budget:', error)
      message.error('保存失败')
    } finally {
      setBudgetLoading(false)
    }
  }

  const handleAlertEnabledChange = async (enabled: boolean) => {
    setBudgetLoading(true)
    try {
      await api.settings.update({
        budgetAlertEnabled: enabled,
      })
      await loadAll()
      message.success('预警设置已更新')
    } catch (error) {
      console.error('Failed to update alert setting:', error)
      message.error('保存失败')
    } finally {
      setBudgetLoading(false)
    }
  }

  const handleAlertThresholdChange = async (value: number) => {
    setBudgetLoading(true)
    try {
      await api.settings.update({
        budgetAlertThreshold: value,
      })
      await loadAll()
      message.success('预警阈值已更新')
    } catch (error) {
      console.error('Failed to update threshold:', error)
      message.error('保存失败')
    } finally {
      setBudgetLoading(false)
    }
  }

  const analyzeExcelWithAI = async (file: File): Promise<any> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      let transactionsSheet = null
      const sheetNames = workbook.SheetNames
      
      for (const name of sheetNames) {
        const sheet = workbook.Sheets[name]
        const data = XLSX.utils.sheet_to_json(sheet)
        if (data.length > 0) {
          transactionsSheet = sheet
          break
        }
      }
      
      if (!transactionsSheet) {
        throw new Error('未找到有效的数据工作表')
      }
      
      const transactionsData = XLSX.utils.sheet_to_json(transactionsSheet)
      
      if (transactionsData.length === 0) {
        throw new Error('工作表中没有数据')
      }
      
      // 准备发送给AI的数据
      const excelDataSummary = {
        sheetCount: workbook.SheetNames.length,
        transactionCount: transactionsData.length,
        sampleData: transactionsData.slice(0, 5), // 只发送前5行作为样本
        columns: transactionsData[0] ? Object.keys(transactionsData[0] as object) : []
      }
      
      // 调用火山引擎API
      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer 466c7d7b-5777-4928-86b3-253eb215759e',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-v3-2-251201',
          stream: false,
          input: [{
            role: 'user',
            content: [{
              type: 'input_text',
              text: `请分析以下Excel账单数据，提取交易记录信息。返回格式应为JSON数组，包含以下字段：
- date: 交易日期（YYYY-MM-DD格式）
- time: 交易时间（HH:MM格式）
- type: 交易类型（expense/income/transfer）
- amount: 交易金额（数字）
- account: 账户名称
- toAccount: 目标账户名称（转账时使用）
- category: 分类名称
- note: 备注信息

Excel数据摘要：${JSON.stringify(excelDataSummary, null, 2)}`
            }]
          }]
        })
      })
      
      if (!response.ok) {
        throw new Error(`API调用失败: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('AI API返回结果:', result)
      
      if (result.output && result.output.length > 0) {
        const content = result.output[0].content[0].text
        console.log('AI返回的文本内容:', content)
        
        // 提取JSON部分
        const jsonMatch = content.match(/```json[\s\S]*?```/)
        if (jsonMatch) {
          console.log('找到JSON代码块')
          const jsonStr = jsonMatch[0].replace(/```json|```/g, '')
          console.log('提取的JSON字符串:', jsonStr)
          const parsedResult = JSON.parse(jsonStr)
          console.log('解析后的JSON:', parsedResult)
          return parsedResult
        }
        
        // 尝试直接解析JSON
        try {
          console.log('尝试直接解析JSON')
          const parsedResult = JSON.parse(content)
          console.log('直接解析成功:', parsedResult)
          return parsedResult
        } catch (e) {
          console.error('直接解析JSON失败:', e)
          throw new Error('AI返回的内容不是有效的JSON格式')
        }
      } else {
        throw new Error('AI未返回有效的结果')
      }
    } catch (error) {
      console.error('AI分析失败:', error)
      throw error
    }
  }

  const handleExport = () => {
    const workbook = XLSX.utils.book_new()

    const accountsData = accounts.filter(a => !a.isDeleted).map(a => ({
      '账户名称': a.name,
      '初始余额': a.initialBalance,
      '当前余额': a.currentBalance,
      '类型': a.isPreset ? '预设' : '自定义',
    }))
    const accountsSheet = XLSX.utils.json_to_sheet(accountsData)
    XLSX.utils.book_append_sheet(workbook, accountsSheet, '账户')

    const categoriesData = categories.map(c => ({
      '分类名称': c.name,
      '类型': c.type === 'expense' ? '支出' : '收入',
      '父级分类': c.parentId ? categories.find(p => p.id === c.parentId)?.name || '' : '',
      '预设': c.isPreset ? '是' : '否',
    }))
    const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData)
    XLSX.utils.book_append_sheet(workbook, categoriesSheet, '分类')

    const transactionsData = transactions.map(t => {
      const account = getAccountById(t.accountId)
      const toAccount = t.toAccountId ? getAccountById(t.toAccountId) : null
      const category = t.categoryId ? getCategoryById(t.categoryId) : null
      const parentCategory = category?.parentId ? getCategoryById(category.parentId) : null
      
      return {
        '日期': t.date,
        '时间': t.time,
        '类型': transactionTypeLabels[t.type] || t.type,
        '账户': account?.name || '',
        '目标账户': toAccount?.name || '',
        '分类': parentCategory ? `${parentCategory.name}-${category?.name}` : (category?.name || ''),
        '金额': t.amount,
        '备注': t.note || '',
      }
    })
    const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData)
    XLSX.utils.book_append_sheet(workbook, transactionsSheet, '交易记录')

    XLSX.writeFile(workbook, `记账数据_${new Date().toISOString().split('T')[0]}.xlsx`)

    message.success('数据导出成功')
  }

  const handleImport = async (file: File) => {
    const fileName = file.name.toLowerCase()
    
    // 对于Excel文件，先打开账户选择模态框
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      setImportModalOpen(true)
      // 存储文件信息，等待用户选择账户后处理
      localStorage.setItem('importFile', JSON.stringify({
        name: file.name,
        lastModified: file.lastModified,
        size: file.size,
        type: file.type
      }))
      // 保存文件到临时存储
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          localStorage.setItem('importFileData', e.target.result as string)
        }
      }
      reader.readAsDataURL(file)
    } else {
      // 对于JSON备份文件，直接处理
      setImportLoading(true)
      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (!data.accounts || !data.categories || !data.transactions) {
          message.error('无效的备份文件格式')
          return
        }

        const db = await getDB()

        await db.clear('accounts')
        await db.clear('categories')
        await db.clear('transactions')

        const tx = db.transaction(['accounts', 'categories', 'transactions'], 'readwrite')

        for (const account of data.accounts) {
          await tx.objectStore('accounts').add(account)
        }
        for (const category of data.categories) {
          await tx.objectStore('categories').add(category)
        }
        for (const transaction of data.transactions) {
          await tx.objectStore('transactions').add(transaction)
        }

        await tx.done
        await loadAll()

        message.success(`数据导入成功：${data.accounts.length} 个账户，${data.categories.length} 个分类，${data.transactions.length} 条交易记录`)
      } catch (error) {
        console.error('Import failed:', error)
        message.error('数据导入失败，请检查文件格式')
      } finally {
        setImportLoading(false)
      }
    }
  }

  const handleAccountSelect = async () => {
    if (!selectedAccountId) {
      message.error('请选择一个账户')
      return
    }
    
    setImportLoading(true)
    setImportModalOpen(false)
    
    try {
      // 从本地存储中获取文件信息
      const fileInfoStr = localStorage.getItem('importFile')
      const fileDataStr = localStorage.getItem('importFileData')
      
      if (!fileInfoStr || !fileDataStr) {
        throw new Error('文件信息丢失')
      }
      
      const fileInfo = JSON.parse(fileInfoStr)
      const fileData = fileDataStr
      
      // 重建文件对象
      const byteString = atob(fileData.split(',')[1])
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const file = new File([ab], fileInfo.name, {
        type: fileInfo.type,
        lastModified: fileInfo.lastModified
      })
      
      // 处理Excel文件
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      const sheetNames = workbook.SheetNames
      let transactionsSheet = workbook.Sheets['交易记录']
      let isAlipayFormat = false
      
      if (!transactionsSheet) {
        for (const name of sheetNames) {
          const sheet = workbook.Sheets[name]
          const data = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]
          if (data.length > 0) {
            const firstRow = data[0]
            if ('创建时间' in firstRow || '订单金额(元)' in firstRow || '商品名称' in firstRow) {
              transactionsSheet = sheet
              isAlipayFormat = true
              break
            }
            if ('交易时间' in firstRow || '收/支' in firstRow || '交易分类' in firstRow) {
              transactionsSheet = sheet
              isAlipayFormat = true
              break
            }
            if ('日期' in firstRow || '时间' in firstRow) {
              transactionsSheet = sheet
              break
            }
          }
        }
      }
      
      if (!transactionsSheet) {
        // 尝试使用AI分析
        message.info('尝试使用AI分析Excel内容...')
        const aiResult = await analyzeExcelWithAI(file)
        console.log('AI分析结果:', aiResult)
        const result = await processAIResult(aiResult, selectedAccountId)
        console.log('处理AI结果完成:', result)
        return result
      }
      
      const transactionsData = XLSX.utils.sheet_to_json(transactionsSheet) as Record<string, unknown>[]
      
      if (transactionsData.length === 0) {
        message.error('工作表中没有数据')
        return
      }
      
      let importedCount = 0
      
      if (isAlipayFormat) {
        for (const row of transactionsData) {
          const datetime = String(row['创建时间'] || row['交易时间'] || '')
          const product = String(row['商品名称'] || row['商品说明'] || '')
          const amountStr = String(row['订单金额(元)'] || row['金额'] || '0')
          const status = String(row['交易状态'] || '')
          const counterparty = String(row['对方名称'] || row['交易对方'] || '')
          const buySellFlag = String(row['买卖标志'] || '')
          const inOut = String(row['收/支'] || '')
          const categoryStr = String(row['交易分类'] || '')
          
          if (status && status !== '交易成功' && status !== '已支付' && status !== '已收款') continue
          
          if (!datetime || !amountStr) continue
          
          const amount = Math.abs(parseFloat(amountStr.replace(/[^0-9.-]/g, '')))
          if (isNaN(amount) || amount === 0) continue
          
          const [datePart, timePart] = datetime.split(' ')
          const date = datePart || ''
          const time = timePart || '00:00'
          
          let type: string = 'expense'
          if (buySellFlag.includes('卖出') || inOut.includes('收入') || inOut.includes('收款')) {
            type = 'income'
          } else if (inOut.includes('不计收支')) {
            continue
          }
          
          const account = accounts.find(a => a.id === selectedAccountId && !a.isDeleted)
          if (!account) continue
          
          let categoryId = ''
          if (categoryStr || product) {
            const matchStr = categoryStr || product
            const category = categories.find(c => 
              c.type === (type === 'income' ? 'income' : 'expense') &&
              (c.name === matchStr || matchStr.includes(c.name))
            )
            if (category) categoryId = category.id
          }
          
          const fullNote = [counterparty, product].filter(Boolean).join(' - ')
          
          const transactionData = {
            type: type as 'expense' | 'income' | 'transfer' | 'refund' | 'lend' | 'borrow',
            amount,
            accountId: account.id,
            toAccountId: null,
            categoryId: categoryId || null,
            date,
            time: time.substring(0, 5),
            note: fullNote,
            source: 'import' as const,
            originalRefundId: null,
          }
          
          await api.transactions.create(transactionData)
          importedCount++
        }
      } else {
        const typeMap: Record<string, string> = {
          '支出': 'expense',
          '收入': 'income',
          '转账': 'transfer',
          '退款': 'refund',
          '借出': 'lend',
          '借入': 'borrow',
        }
        
        for (const row of transactionsData) {
          const date = String(row['日期'] || '')
          const time = String(row['时间'] || '00:00')
          const typeName = String(row['类型'] || '')
          const toAccountName = String(row['目标账户'] || '')
          const categoryName = String(row['分类'] || '')
          const amount = Number(row['金额']) || 0
          const note = String(row['备注'] || '')
          
          if (!date || !amount) continue
          
          const type = typeMap[typeName] || 'expense'
          
          const account = accounts.find(a => a.id === selectedAccountId && !a.isDeleted)
          if (!account) continue
          
          let categoryId = ''
          if (categoryName && type !== 'transfer') {
            const category = categories.find(c => 
              c.name === categoryName || 
              categoryName.includes(c.name)
            )
            if (category) categoryId = category.id
          }
          
          let toAccountId = ''
          if (type === 'transfer' && toAccountName) {
            const toAccount = accounts.find(a => a.name === toAccountName && !a.isDeleted)
            if (toAccount) toAccountId = toAccount.id
          }
          
          const transactionData = {
            type: type as 'expense' | 'income' | 'transfer' | 'refund' | 'lend' | 'borrow',
            amount,
            accountId: account.id,
            toAccountId: toAccountId || null,
            categoryId: categoryId || null,
            date,
            time,
            note,
            source: 'import' as const,
            originalRefundId: null,
          }
          
          await api.transactions.create(transactionData)
          importedCount++
        }
      }
      
      await loadAll()
      message.success(`成功导入 ${importedCount} 条交易记录`)
      return
    } catch (error) {
      console.error('常规导入失败，尝试AI分析:', error)
      // 常规导入失败，尝试AI分析
      message.info('常规导入失败，尝试使用AI分析...')
      
      // 从本地存储中获取文件信息
      const fileInfoStr = localStorage.getItem('importFile')
      const fileDataStr = localStorage.getItem('importFileData')
      
      if (!fileInfoStr || !fileDataStr) {
        throw new Error('文件信息丢失')
      }
      
      const fileInfo = JSON.parse(fileInfoStr)
      const fileData = fileDataStr
      
      // 重建文件对象
      const byteString = atob(fileData.split(',')[1])
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const file = new File([ab], fileInfo.name, {
        type: fileInfo.type,
        lastModified: fileInfo.lastModified
      })
      
      const aiResult = await analyzeExcelWithAI(file)
      return processAIResult(aiResult, selectedAccountId)
    } finally {
      setImportLoading(false)
      // 清理本地存储
      localStorage.removeItem('importFile')
      localStorage.removeItem('importFileData')
    }
  }

  const processAIResult = async (aiResult: any[], selectedAccountId?: string) => {
    try {
      if (!Array.isArray(aiResult)) {
        throw new Error('AI返回的不是数组格式')
      }
      
      let importedCount = 0
      
      console.log('开始处理AI结果，共', aiResult.length, '条记录')
      
      for (const item of aiResult) {
        console.log('处理记录:', item)
        
        const { date, time, type, amount, account: accountName, toAccount: toAccountName, category: categoryName, note } = item
        
        if (!date || !type || amount === undefined || amount === null) {
          console.log('跳过记录：缺少必要字段', { date, type, amount })
          continue
        }
        
        // 处理负数金额，确保金额为正数
        const absoluteAmount = Math.abs(amount)
        if (absoluteAmount === 0) {
          console.log('跳过记录：金额为0', { amount })
          continue
        }
        
        // 验证交易类型
        const validTypes = ['expense', 'income', 'transfer', 'refund', 'lend', 'borrow']
        if (!validTypes.includes(type)) {
          console.log('跳过记录：无效的交易类型', { type })
          continue
        }
        
        // 处理账户
        let account = null
        
        // 如果用户选择了账户，优先使用用户选择的账户
        if (selectedAccountId) {
          account = accounts.find(a => a.id === selectedAccountId && !a.isDeleted)
          console.log('使用用户选择的账户:', account)
        } else if (accountName) {
          console.log('尝试匹配账户:', accountName)
          
          // 1. 尝试精确匹配
          account = accounts.find(a => a.name === accountName && !a.isDeleted)
          if (account) {
            console.log('精确匹配成功:', account)
          } else {
            // 2. 尝试基于关键词的智能匹配
            console.log('精确匹配失败，尝试智能匹配')
            
            // 支付宝账户匹配
            if (accountName.includes('支付宝') || accountName.includes('alipay') || accountName.includes('2088') || accountName.includes('zhifubao')) {
              account = accounts.find(a => (a.name === '支付宝' || a.name.includes('支付宝')) && !a.isDeleted)
              console.log('匹配支付宝账户:', account)
            }
            // 微信账户匹配
            else if (accountName.includes('微信') || accountName.includes('wechat') || accountName.includes('wx') || accountName.includes('weixin')) {
              account = accounts.find(a => (a.name === '微信' || a.name.includes('微信')) && !a.isDeleted)
              console.log('匹配微信账户:', account)
            }
            // 银行卡账户匹配
            else if (accountName.includes('银行') || accountName.includes('bank') || accountName.includes('card') || accountName.includes('银行卡')) {
              account = accounts.find(a => (a.name === '银行卡' || a.name.includes('银行')) && !a.isDeleted)
              console.log('匹配银行卡账户:', account)
            }
            // 现金账户匹配
            else if (accountName.includes('现金') || accountName.includes('cash') || accountName.includes('现钞')) {
              account = accounts.find(a => (a.name === '现金' || a.name.includes('现金')) && !a.isDeleted)
              console.log('匹配现金账户:', account)
            }
            // 信用卡账户匹配
            else if (accountName.includes('信用卡') || accountName.includes('credit') || accountName.includes('cc') || accountName.includes('信用卡')) {
              account = accounts.find(a => (a.name === '信用卡' || a.name.includes('信用卡')) && !a.isDeleted)
              console.log('匹配信用卡账户:', account)
            }
            // 其他账户匹配
            else {
              // 尝试基于账户名称的部分匹配
              const matchedAccount = accounts.find(a => 
                !a.isDeleted && 
                (accountName.includes(a.name) || a.name.includes(accountName))
              )
              if (matchedAccount) {
                account = matchedAccount
                console.log('部分匹配成功:', account)
              }
            }
          }
        }
        
        // 3. 如果仍然找不到账户，使用第一个活跃账户作为默认账户
        if (!account) {
          account = accounts.find(a => !a.isDeleted)
          console.log('使用第一个活跃账户作为默认账户:', account)
        }
        
        if (!account) {
          console.log('跳过记录：没有找到可用账户')
          continue
        }
        
        console.log('最终选择的账户:', account)
        
        let categoryId = ''
        if (categoryName && type !== 'transfer') {
          console.log('尝试匹配分类:', categoryName)
          // 尝试精确匹配
          let category = categories.find(c => 
            c.type === (type === 'income' ? 'income' : 'expense') &&
            c.name === categoryName
          )
          
          // 如果精确匹配失败，尝试模糊匹配
          if (!category) {
            category = categories.find(c => 
              c.type === (type === 'income' ? 'income' : 'expense') &&
              categoryName.includes(c.name)
            )
          }
          
          // 如果仍然失败，尝试使用通用分类
          if (!category) {
            category = categories.find(c => 
              c.type === (type === 'income' ? 'income' : 'expense') &&
              c.name === '其他'
            )
          }
          
          if (category) {
            categoryId = category.id
            console.log('匹配分类成功:', category)
          } else {
            console.log('跳过分类匹配：没有找到合适的分类')
          }
        }
        
        let toAccountId = ''
        if (type === 'transfer' && toAccountName) {
          console.log('尝试匹配目标账户:', toAccountName)
          const toAccount = accounts.find(a => a.name === toAccountName && !a.isDeleted)
          if (toAccount) {
            toAccountId = toAccount.id
            console.log('匹配目标账户成功:', toAccount)
          } else {
            console.log('跳过目标账户匹配：没有找到合适的账户')
          }
        }
        
        const transactionData = {
          type,
          amount: absoluteAmount,
          accountId: account.id,
          toAccountId: toAccountId || null,
          categoryId: categoryId || null,
          date,
          time: time || '00:00',
          note: note || '',
          source: 'import' as const,
          originalRefundId: null,
        }
        
        console.log('准备创建交易:', transactionData)
        
        // 使用API创建交易记录
        await api.transactions.create(transactionData)
        console.log('创建交易成功')
        
        importedCount++
        console.log('已处理记录数:', importedCount)
      }
      
      // 重新加载数据
      await loadAll()
      console.log('重新加载数据成功')
      message.success(`AI分析成功，导入 ${importedCount} 条交易记录`)
    } catch (error) {
      console.error('处理AI结果失败:', error)
      message.error('AI分析结果处理失败')
    }
  }

  const handleClearData = async () => {
    try {
      const db = await getDB()
      await db.clear('accounts')
      await db.clear('categories')
      await db.clear('transactions')
      await loadAll()
      message.success('数据已清空')
    } catch (error) {
      console.error('Clear data failed:', error)
      message.error('清空数据失败')
    }
  }

  const uploadProps: UploadProps = {
    accept: '.json,.xlsx,.xls,.csv',
    showUploadList: false,
    beforeUpload: file => {
      handleImport(file)
      return false
    },
  }

  return (
    <div>
      <Card title="预算设置">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Row align="middle" gutter={16}>
              <Col>
                <DollarOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              </Col>
              <Col flex={1}>
                <Text strong style={{ fontSize: 16 }}>每月预算</Text>
                <br />
                <Text type="secondary">设置每月支出预算，实时追踪消费情况</Text>
              </Col>
              <Col>
                <InputNumber
                  value={monthlyBudget}
                  onChange={handleBudgetChange}
                  precision={2}
                  min={0}
                  max={999999999}
                  style={{ width: 150 }}
                  formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value?.replace(/¥\s?|(,*)/g, '') as unknown as number}
                />
              </Col>
            </Row>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <Row align="middle" justify="space-between">
              <Col>
                <Text strong>预算预警</Text>
                <br />
                <Text type="secondary">当支出达到预算的 {budgetAlertThreshold}% 时提醒</Text>
              </Col>
              <Col>
                <Switch
                  checked={budgetAlertEnabled}
                  onChange={handleAlertEnabledChange}
                  loading={budgetLoading || undefined}
                />
              </Col>
            </Row>
            {budgetAlertEnabled && (
              <div style={{ marginTop: 16 }}>
                <Row align="middle" gutter={16}>
                  <Col span={12}>
                    <Slider
                      min={50}
                      max={100}
                      value={budgetAlertThreshold}
                      onChange={handleAlertThresholdChange}
                      disabled={budgetLoading}
                      marks={{ 50: '50%', 80: '80%', 100: '100%' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Text>
                      提醒阈值：<Text strong>{budgetAlertThreshold}%</Text>
                    </Text>
                  </Col>
                </Row>
              </div>
            )}
          </div>
        </Space>
      </Card>

      <Card title="数据管理" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text strong>数据导出</Text>
            <br />
            <Text type="secondary">将所有账户、分类和交易记录导出为 Excel 文件</Text>
            <div style={{ marginTop: 8 }}>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出数据
              </Button>
            </div>
          </div>

          <Divider />

          <div>
            <Text strong>数据导入</Text>
            <br />
            <Text type="secondary">支持导入支付宝账单、Excel (.xlsx/.xls/.csv) 或 JSON 备份文件</Text>
            <div style={{ marginTop: 8 }}>
              <Upload {...uploadProps}>
                <Button icon={importLoading ? <LoadingOutlined /> : <UploadOutlined />} loading={importLoading || undefined}>导入数据</Button>
              </Upload>
            </div>
          </div>

          <Divider />

          <div>
            <Text strong>清空数据</Text>
            <br />
            <Text type="secondary">删除所有账户、分类和交易记录（不可恢复）</Text>
            <div style={{ marginTop: 8 }}>
              <Popconfirm
                title="确认清空数据"
                description="此操作将删除所有数据且不可恢复，是否继续？"
                onConfirm={handleClearData}
                okText="确认"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />}>
                  清空数据
                </Button>
              </Popconfirm>
            </div>
          </div>
        </Space>
      </Card>

      <Card title="自动记账设置" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Text strong>自动识别支付宝/微信付款并记账</Text>
              <br />
              <Text type="secondary">
                需要开启"辅助功能（无障碍服务）"权限。开启后，每次在支付宝或微信完成付款，App 将自动为您记账，无需手动操作。
              </Text>
            </Col>
          </Row>
          <div style={{ marginTop: 12 }}>
            {notificationGranted === null ? (
              <Button disabled>检查权限中...</Button>
            ) : notificationGranted ? (
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                <Text type="success">辅助功能已开启，自动记账生效中</Text>
                <Button type="link" onClick={handleOpenNotificationSettings}>
                  前往管理
                </Button>
              </Space>
            ) : (
              <Space direction="vertical">
                <Space>
                  <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                  <Text type="danger">辅助功能权限未开启</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  点击下方按钮，在跳转页面中找到【个人记账助手】并开启开关即可。
                </Text>
                <Button type="primary" onClick={handleOpenNotificationSettings} icon={<SettingOutlined />}>
                  去辅助功能设置中开启
                </Button>
              </Space>
            )}
          </div>
        </Space>
      </Card>

      <Card title="数据统计" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">账户数量：</Text>
            <Text strong>{accounts.filter(a => !a.isDeleted).length}</Text>
          </div>
          <div>
            <Text type="secondary">分类数量：</Text>
            <Text strong>{categories.length}</Text>
          </div>
          <div>
            <Text type="secondary">交易记录：</Text>
            <Text strong>{transactions.length} 条</Text>
          </div>
        </Space>
      </Card>

      <Card title="关于" style={{ marginTop: 16 }}>
        <Space direction="vertical">
          <div>
            <Text type="secondary">版本：</Text>
            <Text>V1.0.0</Text>
          </div>
          <div>
            <Text type="secondary">技术栈：</Text>
            <Text>React + TypeScript + Ant Design + IndexedDB</Text>
          </div>
          <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            个人记账助手 - 帮助您统一管理多平台的收支记录，支持自定义分类和统计分析。
          </Paragraph>
        </Space>
      </Card>

      {/* 账户选择模态框 */}
      <Modal
        title="选择导入账户"
        open={importModalOpen}
        onOk={handleAccountSelect}
        onCancel={() => setImportModalOpen(false)}
        okText="确定"
        cancelText="取消"
        loading={importLoading || undefined}
      >
        <div style={{ marginTop: 16 }}>
          <Text strong>请选择要导入到的账户：</Text>
          <div style={{ marginTop: 12 }}>
            {accounts.filter(a => !a.isDeleted).map(account => (
              <div key={account.id} style={{ marginBottom: 8 }}>
                <input
                  type="radio"
                  id={`account-${account.id}`}
                  name="account"
                  value={account.id}
                  checked={selectedAccountId === account.id}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  style={{ marginRight: 8 }}
                />
                <label htmlFor={`account-${account.id}`}>
                  {account.name} (当前余额: ¥{account.currentBalance.toFixed(2)})
                </label>
              </div>
            ))}
          </div>
          {accounts.filter(a => !a.isDeleted).length === 0 && (
            <div style={{ marginTop: 16, color: '#ff4d4f' }}>
              没有可用的账户，请先创建账户
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default Settings
