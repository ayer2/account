package com.accounting.personal;

import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NotificationSettings")
public class NotificationSettingsPlugin extends Plugin {

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("无法打开通知设置页面", e);
        }
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        Context context = getContext();
        boolean isGranted = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.getPackageName());
        
        JSObject ret = new JSObject();
        ret.put("granted", isGranted);
        call.resolve(ret);
    }
}