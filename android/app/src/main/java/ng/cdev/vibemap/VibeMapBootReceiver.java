package ng.cdev.vibemap;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/**
 * VibeMapBootReceiver
 *
 * Listens for BOOT_COMPLETED and QUICKBOOT_POWERON broadcasts.
 * When the phone restarts, automatically relaunches EmergencySosService
 * if the user was previously logged in (auth_token present in SharedPreferences).
 *
 * This ensures that family location tracking and SOS monitoring resume
 * seamlessly after a phone reboot without the user needing to manually open the app.
 */
public class VibeMapBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(action)
                && !"com.htc.intent.action.QUICKBOOT_POWERON".equals(action)) {
            return;
        }

        try {
            // Only restart the service if the user is logged in
            SharedPreferences prefs = context.getSharedPreferences("VibeMapPrefs", Context.MODE_PRIVATE);
            String token = prefs.getString("auth_token", null);

            if (token != null && !token.trim().isEmpty()) {
                Intent serviceIntent = new Intent(context, EmergencySosService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }
        } catch (Exception ignored) {
            // Fail silently -- boot receivers must not crash
        }
    }
}
