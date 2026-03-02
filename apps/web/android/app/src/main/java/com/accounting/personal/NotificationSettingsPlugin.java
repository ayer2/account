package com.accounting.personal;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

@CapacitorPlugin(name = "NotificationSettings")
public class NotificationSettingsPlugin extends Plugin {

    // 跳转到系统的"辅助功能（无障碍）"设置页面
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开无障碍设置页面", e);
        }
    }

    // 检查本应用的无障碍服务是否已被用户开启
    @PluginMethod
    public void checkPermission(PluginCall call) {
        Context context = getContext();
        boolean isGranted = isAccessibilityServiceEnabled(context, AutoAccountingService.class);

        JSObject ret = new JSObject();
        ret.put("granted", isGranted);
        call.resolve(ret);
    }

    // 检查指定的 AccessibilityService 是否已被开启
    private boolean isAccessibilityServiceEnabled(Context context, Class<?> serviceClass) {
        AccessibilityManager am =
                (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (am == null) return false;

        // 获取已启用的无障碍服务列表
        List<AccessibilityServiceInfo> enabledServices =
                am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);

        // 构造当前服务的组件名，格式为 "包名/类名"
        String targetComponent = new ComponentName(context, serviceClass).flattenToString();

        for (AccessibilityServiceInfo info : enabledServices) {
            if (info.getResolveInfo() != null
                    && info.getResolveInfo().serviceInfo != null) {
                // 用 ComponentName 来做精确匹配
                ComponentName enabledComponent = new ComponentName(
                        info.getResolveInfo().serviceInfo.packageName,
                        info.getResolveInfo().serviceInfo.name
                );
                if (enabledComponent.flattenToString().equals(targetComponent)) {
                    return true;
                }
            }
        }
        return false;
    }
}
