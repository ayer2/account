package com.accounting.personal;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import android.content.SharedPreferences;

public class NotificationListener extends NotificationListenerService {
    private static final String TAG = "AutoAccounting";
    // 注意：这里必须和您刚才写死的服务器地址保持一致
    private static final String API_URL = "http://120.27.228.132/api/transactions/auto";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        
        // 我们只关心支付宝(com.eg.android.AlipayGphone)和微信(com.tencent.mm)的通知
        if (!packageName.equals("com.eg.android.AlipayGphone") && !packageName.equals("com.tencent.mm")) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        // 获取通知标题和内容
        String title = notification.extras.getString(Notification.EXTRA_TITLE, "");
        String content = notification.extras.getString(Notification.EXTRA_TEXT, "");
        
        Log.d(TAG, "收到通知 - 包名: " + packageName + ", 标题: " + title + ", 内容: " + content);

        try {
            double amount = 0.0;
            String merchant = "";
            String accountName = "";

            // 1. 解析支付宝支付通知规则 (例如标题: "支付成功", 内容: "您在肯德基成功付款15.50元")
            if (packageName.equals("com.eg.android.AlipayGphone") && title.contains("支付成功")) {
                accountName = "支付宝";
                // 尝试提取金额，例如 "15.50元"
                Pattern amountPattern = Pattern.compile("([0-9]+\\.[0-9]{2})元");
                Matcher amountMatcher = amountPattern.matcher(content);
                if (amountMatcher.find()) {
                    amount = Double.parseDouble(amountMatcher.group(1));
                }
                
                // 尝试提取商家名称，例如 "您在xxx成功付款"
                Pattern merchantPattern = Pattern.compile("您在(.*?)成功付款");
                Matcher merchantMatcher = merchantPattern.matcher(content);
                if (merchantMatcher.find()) {
                    merchant = merchantMatcher.group(1);
                }
            } 
            // 2. 解析微信支付通知规则 (例如标题: "微信支付", 内容: "凭证:你在星巴克支付了20.00元")
            else if (packageName.equals("com.tencent.mm") && (title.contains("微信支付") || content.contains("支付了"))) {
                accountName = "微信";
                Pattern amountPattern = Pattern.compile("([0-9]+\\.[0-9]{2})元");
                Matcher amountMatcher = amountPattern.matcher(content);
                if (amountMatcher.find()) {
                    amount = Double.parseDouble(amountMatcher.group(1));
                }
                
                Pattern merchantPattern = Pattern.compile("你在(.*?)支付了");
                Matcher merchantMatcher = merchantPattern.matcher(content);
                if (merchantMatcher.find()) {
                    merchant = merchantMatcher.group(1);
                } else {
                    // 备用提取规则：如果没有匹配到，就把整个内容作为备注
                    merchant = content;
                }
            }

            // 如果成功提取到了金额（大于0），就向后端发送请求
            if (amount > 0) {
                Log.d(TAG, "识别到付款 - 账户: " + accountName + ", 商家: " + merchant + ", 金额: " + amount);
                sendTransactionToServer(amount, merchant, accountName, title, content);
            }

        } catch (Exception e) {
            Log.e(TAG, "解析通知失败", e);
        }
    }

    private void sendTransactionToServer(double amount, String merchant, String accountName, String title, String content) {
        new Thread(() -> {
            try {
                // 1. 从 Capacitor 的本地存储中获取用户的 Token
                // Capacitor 默认会把 localStorage 存在一个特定的名为 CapacitorStorage 的 XML 文件中
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
                String token = prefs.getString("auth_token", "");
                
                if (token.isEmpty()) {
                    Log.e(TAG, "未找到登录凭证，放弃自动记账");
                    return;
                }

                // 2. 获取当前日期和时间
                SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
                SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
                Date now = new Date();

                // 3. 构建发送给后端的 JSON 数据
                JSONObject jsonParam = new JSONObject();
                jsonParam.put("type", "expense"); // 自动识别的大多是支出
                jsonParam.put("amount", amount);
                jsonParam.put("merchant", merchant);
                jsonParam.put("note", "自动记账 - " + title + " " + content);
                jsonParam.put("accountName", accountName);
                jsonParam.put("date", dateFormat.format(now));
                jsonParam.put("time", timeFormat.format(now));
                jsonParam.put("source", "auto_alipay"); // 标志为自动导入

                // 4. 发起 HTTP 请求
                URL url = new URL(API_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json;charset=UTF-8");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setDoOutput(true);
                conn.setDoInput(true);

                OutputStream os = conn.getOutputStream();
                os.write(jsonParam.toString().getBytes("UTF-8"));
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();
                Log.i(TAG, "自动记账请求发送完毕，服务器响应码: " + responseCode);
                
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "发送自动记账请求失败", e);
            }
        }).start();
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // 当通知被用户划掉时触发，这里不需要处理
    }
}