package com.accounting.personal;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class AutoAccountingService extends AccessibilityService {

    private static final String TAG = "AutoAccounting";
    // 后端接口地址，与前端保持一致
    private static final String API_URL = "http://120.27.228.132/api/transactions/auto";
    // 通知渠道 ID，用于 Android 8.0+ 的通知分类
    private static final String CHANNEL_ID = "auto_accounting_channel";
    // 通知 ID，每次记账成功弹出的通知使用此 ID（会覆盖上一条，不堆积）
    private static final int NOTIFY_ID = 1001;

    // 防重复提交：记录上次提交的金额和时间戳（5秒内同一笔金额不重复提交）
    private double lastAmount = 0;
    private long lastSubmitTime = 0;
    private static final long DEBOUNCE_MS = 5000;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // 只处理窗口内容变化和窗口状态变化两类事件
        int eventType = event.getEventType();
        if (eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                && eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            return;
        }

        // 只处理微信和支付宝的事件
        String packageName = "";
        if (event.getPackageName() != null) {
            packageName = event.getPackageName().toString();
        }
        boolean isAlipay = packageName.equals("com.eg.android.AlipayGphone");
        boolean isWeChat = packageName.equals("com.tencent.mm");
        if (!isAlipay && !isWeChat) {
            return;
        }

        // 获取当前窗口的根节点
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return;

        try {
            String accountName = isAlipay ? "支付宝" : "微信";

            if (isAlipay) {
                // 支付宝：寻找"付款成功"、"支付成功"关键词
                handleAlipay(rootNode, accountName);
            } else {
                // 微信：寻找"支付成功"、"已支付"关键词
                handleWeChat(rootNode, accountName);
            }
        } catch (Exception e) {
            Log.e(TAG, "处理无障碍事件异常", e);
        } finally {
            rootNode.recycle();
        }
    }

    // 处理支付宝支付成功识别
    private void handleAlipay(AccessibilityNodeInfo rootNode, String accountName) {
        // 识别支付宝"付款成功"或"支付成功"页面
        boolean isPaySuccess = containsText(rootNode, "付款成功")
                || containsText(rootNode, "支付成功")
                || containsText(rootNode, "付款已完成");
        if (!isPaySuccess) return;

        Log.d(TAG, "检测到支付宝支付成功页面");
        showToast("[记账] 检测到支付宝支付成功页面");

        // 提取金额：在页面所有节点中查找形如 "15.50" 的金额文本
        double amount = extractAmountFromNode(rootNode);
        // 提取商家信息
        String merchant = extractMerchantFromNode(rootNode, "付款给", "收款方", "商家名称");

        if (amount > 0) {
            showToast("[记账] 识别金额: ¥" + amount + " 提交中...");
            submitTransaction(amount, merchant, accountName);
        } else {
            showToast("[记账] 未能提取到金额，请检查页面");
        }
    }

    // 处理微信支付成功识别
    private void handleWeChat(AccessibilityNodeInfo rootNode, String accountName) {
        // 识别微信"支付成功"页面
        boolean isPaySuccess = containsText(rootNode, "支付成功")
                || containsText(rootNode, "已支付")
                || containsText(rootNode, "支付完成");
        if (!isPaySuccess) return;

        Log.d(TAG, "检测到微信支付成功页面");
        showToast("[记账] 检测到微信支付成功页面");

        // 提取金额
        double amount = extractAmountFromNode(rootNode);
        // 提取商家信息
        String merchant = extractMerchantFromNode(rootNode, "收款方", "商家", "付款给");

        if (amount > 0) {
            showToast("[记账] 识别金额: ¥" + amount + " 提交中...");
            submitTransaction(amount, merchant, accountName);
        } else {
            showToast("[记账] 未能提取到金额，请检查页面");
        }
    }

    // 检查节点树中是否包含特定文本
    private boolean containsText(AccessibilityNodeInfo node, String text) {
        if (node == null) return false;
        // 先检查当前节点的文本
        if (node.getText() != null && node.getText().toString().contains(text)) {
            return true;
        }
        if (node.getContentDescription() != null && node.getContentDescription().toString().contains(text)) {
            return true;
        }
        // 递归检查所有子节点
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                if (containsText(child, text)) {
                    child.recycle();
                    return true;
                }
                child.recycle();
            }
        }
        return false;
    }

    // 从节点树中提取最大的金额数字（通常支付金额是页面上最显眼的数字）
    private double extractAmountFromNode(AccessibilityNodeInfo rootNode) {
        // 用正则从所有节点的文本中提取形如 "123.45" 或 "¥123.45" 的金额
        Pattern pattern = Pattern.compile("[¥￥]?\\s*(\\d+\\.\\d{2})");
        double maxAmount = 0;
        maxAmount = traverseForAmount(rootNode, pattern, maxAmount);
        return maxAmount;
    }

    // 递归遍历节点，寻找最大金额
    private double traverseForAmount(AccessibilityNodeInfo node, Pattern pattern, double currentMax) {
        if (node == null) return currentMax;
        if (node.getText() != null) {
            String text = node.getText().toString();
            Matcher m = pattern.matcher(text);
            while (m.find()) {
                try {
                    double val = Double.parseDouble(m.group(1));
                    // 过滤掉过小的数（通常小于0.01为噪声）和过大的数
                    if (val > 0.01 && val < 100000) {
                        if (val > currentMax) {
                            currentMax = val;
                        }
                    }
                } catch (NumberFormatException ignored) {}
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                currentMax = traverseForAmount(child, pattern, currentMax);
                child.recycle();
            }
        }
        return currentMax;
    }

    // 从特定关键词附近提取商家信息
    private String extractMerchantFromNode(AccessibilityNodeInfo rootNode, String... keywords) {
        for (String keyword : keywords) {
            List<AccessibilityNodeInfo> nodes = rootNode.findAccessibilityNodeInfosByText(keyword);
            if (nodes != null && !nodes.isEmpty()) {
                // 找到包含关键词的节点后，尝试读取其父节点或兄弟节点的文本
                AccessibilityNodeInfo node = nodes.get(0);
                AccessibilityNodeInfo parent = node.getParent();
                if (parent != null && parent.getChildCount() > 1) {
                    for (int i = 0; i < parent.getChildCount(); i++) {
                        AccessibilityNodeInfo sibling = parent.getChild(i);
                        if (sibling != null && sibling.getText() != null) {
                            String siblingText = sibling.getText().toString().trim();
                            if (!siblingText.isEmpty() && !siblingText.equals(keyword)) {
                                sibling.recycle();
                                parent.recycle();
                                for (AccessibilityNodeInfo n : nodes) n.recycle();
                                return siblingText;
                            }
                            sibling.recycle();
                        }
                    }
                    parent.recycle();
                }
                for (AccessibilityNodeInfo n : nodes) n.recycle();
            }
        }
        return "";
    }

    // 防重复检查并向后端提交交易记录
    private void submitTransaction(double amount, String merchant, String accountName) {
        long now = System.currentTimeMillis();
        // 5秒内同一笔金额不重复提交
        if (amount == lastAmount && (now - lastSubmitTime) < DEBOUNCE_MS) {
            Log.d(TAG, "5秒内已提交过相同金额，跳过重复提交: " + amount);
            return;
        }
        lastAmount = amount;
        lastSubmitTime = now;

        final double finalAmount = amount;
        final String finalMerchant = merchant;
        final String finalAccount = accountName;

        new Thread(() -> {
            try {
                // 从 Capacitor 的本地存储中获取用户登录 Token
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
                String token = prefs.getString("auth_token", "");

                if (token.isEmpty()) {
                    Log.e(TAG, "未找到登录凭证（auth_token），放弃自动记账");
                    showToast("[记账] 错误：未找到登录凭证，请先退出重新登录");
                    return;
                }

                // 构造当前日期和时间
                SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
                SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
                Date nowDate = new Date();

                // 构建发送给后端的 JSON 数据
                JSONObject jsonParam = new JSONObject();
                jsonParam.put("type", "expense");
                jsonParam.put("amount", finalAmount);
                jsonParam.put("merchant", finalMerchant);
                jsonParam.put("note", "自动记账 - " + finalAccount);
                jsonParam.put("accountName", finalAccount);
                jsonParam.put("date", dateFormat.format(nowDate));
                jsonParam.put("time", timeFormat.format(nowDate));
                jsonParam.put("source", "auto_alipay");

                // 发起 HTTP POST 请求
                URL url = new URL(API_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json;charset=UTF-8");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                OutputStream os = conn.getOutputStream();
                os.write(jsonParam.toString().getBytes("UTF-8"));
                os.flush();
                os.close();

                int responseCode = conn.getResponseCode();
                Log.i(TAG, "自动记账成功 - 账户: " + finalAccount + " 金额: " + finalAmount
                        + " 商家: " + finalMerchant + " 响应码: " + responseCode);

                conn.disconnect();

                // 记账成功（HTTP 2xx）时发送系统通知
                if (responseCode >= 200 && responseCode < 300) {
                    sendSuccessNotification(finalAmount, finalAccount);
                } else {
                    showToast("[记账] 提交失败，服务器响应码: " + responseCode);
                }
            } catch (Exception e) {
                Log.e(TAG, "自动记账请求发送失败", e);
                showToast("[记账] 网络错误: " + e.getMessage());
            }
        }).start();
    }

    // 在主线程显示 Toast（服务运行在后台线程，需要切回主线程）
    private void showToast(final String msg) {
        new Handler(Looper.getMainLooper()).post(() ->
                Toast.makeText(getApplicationContext(), msg, Toast.LENGTH_SHORT).show()
        );
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "无障碍服务被中断");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        Log.d(TAG, "无障碍服务已连接，自动记账功能生效");
        showToast("自动记账服务已启动");
        // 在 XML 配置基础上补充 FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        // 关键：必须用 getServiceInfo() 获取已有配置（含 canRetrieveWindowContent=true），
        //       再修改，而不是创建新对象覆盖，否则 canRetrieveWindowContent 会被重置为 false，
        //       导致 getRootInActiveWindow() 返回 null，无法读取页面内容
        AccessibilityServiceInfo info = getServiceInfo();
        if (info != null) {
            info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
            setServiceInfo(info);
        }
        // 创建通知渠道（Android 8.0+ 必须先创建渠道才能发通知）
        createNotificationChannel();
    }

    // 创建通知渠道，仅在 Android 8.0（API 26）及以上需要
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "自动记账通知",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("检测到支付成功后，自动记录账单并通知您");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    // 发送系统通知，告知用户记账成功
    private void sendSuccessNotification(double amount, String accountName) {
        try {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            // 格式化金额，保留两位小数
            String amountStr = String.format(Locale.getDefault(), "%.2f", amount);

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Android 8.0+ 必须指定 channelId
                builder = new Notification.Builder(this, CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }

            builder.setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle("自动记账成功")
                    .setContentText(accountName + " 消费 ¥" + amountStr + " 已自动记录")
                    .setAutoCancel(true);

            manager.notify(NOTIFY_ID, builder.build());
            Log.i(TAG, "已发送记账成功通知: " + accountName + " ¥" + amountStr);
        } catch (Exception e) {
            Log.e(TAG, "发送通知失败", e);
        }
    }
}
