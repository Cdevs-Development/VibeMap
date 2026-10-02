package ng.cdev.vibemap

import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject

@CapacitorPlugin(name = "FullScreenIntentPermission")
class FullScreenIntentPlugin : Plugin() {

    @PluginMethod
    fun checkPermission(call: PluginCall) {
        val result = JSObject()
        if (Build.VERSION.SDK_INT >= 34) {
            val manager = context.getSystemService(NotificationManager::class.java)
            result.put("granted", manager?.canUseFullScreenIntent() ?: true)
        } else {
            result.put("granted", true)
        }
        call.resolve(result)
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 34) {
            val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                data = Uri.fromParts("package", context.packageName, null)
            }
            activity.startActivity(intent)
        }
        call.resolve()
    }
}
