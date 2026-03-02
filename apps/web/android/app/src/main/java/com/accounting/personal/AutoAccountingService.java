package com.accounting.personal;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
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

        // 提取金额：在页面所有节点中查找形如 "15.50" 的金额文本
        double amount = extractAmountFromNode(rootNode);
        // 提取商家信息
        String merchant = extractMerchantFromNode(rootNode, "付款给", "收款方", "商家名称");

        if (amount > 0) {
            submitTransaction(amount, merchant, accountName);
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

        // 提取金额
        double amount = extractAmountFromNode(rootNode);
        // 提取商家信息
        String merchant = extractMerchantFromNode(rootNode, "收款方", "商家", "付款给");

        if (amount > 0) {
            submitTransaction(amount, merchant, accountName);
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
            } catch (Exception e) {
                Log.e(TAG, "自动记账请求发送失败", e);
            }
        }).start();
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "无障碍服务被中断");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        Log.d(TAG, "无障碍服务已连接，自动记账功能生效");
        // 动态配置监听参数，作为 xml 配置的补充
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                | AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.notificationTimeout = 100;
        info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        setServiceInfo(info);
    }
}
