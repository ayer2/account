package com.accounting.personal

import android.app.Notification
import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.regex.Pattern

class NotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "NotificationListener"
        
        // 支付宝包名
        private const val ALIPAY_PACKAGE = "com.eg.android.AlipayGphone"
        // 微信支付包名
        private const val WECHAT_PACKAGE = "com.tencent.mm"
        
        // API 地址（需要配置为实际后端地址）
        private const val API_BASE_URL = "http://120.27.228.132:3000"
        
        // 允许的应用列表
        private val ALLOWED_PACKAGES = listOf(ALIPAY_PACKAGE, WECHAT_PACKAGE)
    }

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        
        val packageName = sbn.packageName
        
        // 只处理支付宝和微信的通知
        if (packageName !in ALLOWED_PACKAGES) {
            return
        }

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        // 获取通知内容
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val time = sbn.postTime

        Log.d(TAG, "收到通知 - 包名: $packageName, 标题: $title, 内容: $text")

        // 解析交易信息
        val transactionInfo = when (packageName) {
            ALIPAY_PACKAGE -> parseAlipayNotification(title, text, time)
            WECHAT_PACKAGE -> parseWechatNotification(title, text, time)
            else -> null
        }

        if (transactionInfo != null) {
            Log.d(TAG, "解析到交易信息: $transactionInfo")
            // 发送到后端 API
            sendToServer(transactionInfo)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        // 不需要处理通知移除
    }

    /**
     * 解析支付宝通知
     */
    private fun parseAlipayNotification(title: String, text: String, timestamp: Long): TransactionInfo? {
        // 支付宝通知标题示例："支付宝交易通知"、"余额宝收益"
        // 支付宝通知内容示例："您向商家付款了Xx.xx元"、"收款到账Xx.xx元"
        
        // 支出通知匹配
        val expensePattern = Pattern.compile("付款了?([\\d,]+\\.?\\d*)元")
        val expenseMatcher = expensePattern.matcher(text)
        
        // 收入通知匹配  
        val incomePattern = Pattern.compile("到账(?!处)([\\d,]+\\.?\\d*)元")
        val incomeMatcher = incomePattern.matcher(text)
        
        // 商家名称匹配
        val merchantPattern = Pattern.compile("(?:向|给)(.+?)(?:付款|收款)")
        val merchantMatcher = merchantPattern.matcher(text)
        
        return when {
            // 支出
            expenseMatcher.find() -> {
                val amount = expenseMatcher.group(1)?.replace(",", "")?.toDoubleOrNull() ?: return null
                val merchant = if (merchantMatcher.find()) merchantMatcher.group(1) else ""
                TransactionInfo(
                    type = "expense",
                    amount = amount,
                    merchant = merchant,
                    timestamp = timestamp,
                    source = "alipay",
                    note = text.take(100)
                )
            }
            // 收入
            incomeMatcher.find() -> {
                val amount = incomeMatcher.group(1)?.replace(",", "")?.toDoubleOrNull() ?: return null
                TransactionInfo(
                    type = "income",
                    amount = amount,
                    merchant = "",
                    timestamp = timestamp,
                    source = "alipay",
                    note = text.take(100)
                )
            }
            else -> null
        }
    }

    /**
     * 解析微信支付通知
     */
    private fun parseWechatNotification(title: String, text: String, timestamp: Long): TransactionInfo? {
        // 微信通知标题示例："微信支付"、"支付成功"
        
        // 支出通知匹配
        val expensePattern = Pattern.compile("支付([\\d,]+\\.?\\d*)元")
        val expenseMatcher = expensePattern.matcher(text)
        
        // 收入通知匹配
        val incomePattern = Pattern.compile("收款([\\d,]+\\.?\\d*)元|到账([\\d,]+\\.?\\d*)元")
        val incomeMatcher = incomePattern.matcher(text)
        
        // 商家名称匹配
        val merchantPattern = Pattern.compile("(.+?)向你|你向(.+?)(?:付款|收款)")
        val merchantMatcher = merchantPattern.matcher(text)

        return when {
            // 支出
            expenseMatcher.find() -> {
                val amount = expenseMatcher.group(1)?.replace(",", "")?.toDoubleOrNull() ?: return null
                val merchant = if (merchantMatcher.find()) {
                    merchantMatcher.group(1) ?: merchantMatcher.group(2) ?: ""
                } else ""
                TransactionInfo(
                    type = "expense",
                    amount = amount,
                    merchant = merchant,
                    timestamp = timestamp,
                    source = "wechat",
                    note = text.take(100)
                )
            }
            // 收入
            incomeMatcher.find() -> {
                val amount = incomeMatcher.group(1)?.replace(",", "")?.toDoubleOrNull() 
                    ?: incomeMatcher.group(2)?.replace(",", "")?.toDoubleOrNull()
                    ?: return null
                TransactionInfo(
                    type = "income",
                    amount = amount,
                    merchant = "",
                    timestamp = timestamp,
                    source = "wechat",
                    note = text.take(100)
                )
            }
            else -> null
        }
    }

    /**
     * 发送交易信息到后端 API
     */
    private fun sendToServer(info: TransactionInfo) {
        scope.launch {
            try {
                val url = URL("$API_BASE_URL/api/transactions/auto")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true

                val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
                val date = dateFormat.format(Date(info.timestamp))
                val time = timeFormat.format(Date(info.timestamp))

                val json = JSONObject().apply {
                    put("type", info.type)
                    put("amount", info.amount)
                    put("date", date)
                    put("time", time)
                    put("note", info.note)
                    put("source", "auto_${info.source}")
                    put("merchant", info.merchant)
                }

                val outputStream: OutputStream = connection.outputStream
                outputStream.write(json.toString().toByteArray())
                outputStream.flush()
                outputStream.close()

                val responseCode = connection.responseCode
                Log.d(TAG, "API 响应码: $responseCode")

                if (responseCode == 200 || responseCode == 201) {
                    Log.d(TAG, "交易记录创建成功")
                } else {
                    Log.w(TAG, "交易记录创建失败: $responseCode")
                }

                connection.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "发送交易信息失败", e)
            }
        }
    }

    /**
     * 交易信息数据类
     */
    data class TransactionInfo(
        val type: String,        // expense / income
        val amount: Double,      // 金额
        val merchant: String,   // 商户名称
        val timestamp: Long,     // 时间戳
        val source: String,      // alipay / wechat
        val note: String         // 备注
    )
}
