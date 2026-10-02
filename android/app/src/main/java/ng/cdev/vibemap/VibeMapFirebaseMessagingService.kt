package ng.cdev.vibemap

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class VibeMapFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val type = remoteMessage.data["type"]

        if (type == "sos_alert") {
            showSosFullScreenAlert(remoteMessage)
        } else {
            // Not an SOS message — forward to the standard Capacitor push
            // notification handling so existing notifications keep working.
            super.onMessageReceived(remoteMessage)
            try {
                PushNotificationsPlugin.sendRemoteMessage(remoteMessage)
            } catch (e: Exception) {
                // Fallback safe handling
            }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Token registration for standard push notifications must continue
        // to be handled exactly as it already is via the Capacitor plugin.
        try {
            PushNotificationsPlugin.onNewToken(token)
        } catch (e: Exception) {
            // Fallback safe handling
        }
    }

    private fun showSosFullScreenAlert(remoteMessage: RemoteMessage) {
        val senderName = remoteMessage.data["sender_name"] ?: "Someone"
        val senderLat = remoteMessage.data["sender_lat"] ?: ""
        val senderLng = remoteMessage.data["sender_lng"] ?: ""
        val sosEventId = remoteMessage.data["sos_event_id"] ?: ""

        val fullScreenIntent = Intent(this, SosAlertActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("sender_name", senderName)
            putExtra("sender_lat", senderLat)
            putExtra("sender_lng", senderLng)
            putExtra("sos_event_id", sosEventId)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, sosEventId.hashCode(), fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val vibrationPattern = longArrayOf(0, 1000, 300, 1000, 300, 1200, 300, 1500, 300, 2000)

        val alarmSoundUri: android.net.Uri? = try {
            val resId = resources.getIdentifier("sos_alarm", "raw", packageName)
            if (resId != 0) {
                android.net.Uri.parse("android.resource://" + packageName + "/" + resId)
            } else {
                android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
            }
        } catch (e: Exception) {
            android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
        }

        val notification = NotificationCompat.Builder(this, "sos_alarm_channel_v2")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("🚨 EMERGENCY: SOS Triggered!")
            .setContentText("$senderName needs immediate assistance")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setVibrate(vibrationPattern)
            .setSound(alarmSoundUri)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .build()

        // Also trigger forceful system vibration to grab attention if device is on silent mode
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            if (vibrator != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(vibrationPattern, -1)
                    val audioAttrs = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                    vibrator.vibrate(effect, audioAttrs)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(vibrationPattern, -1)
                }
            }
        } catch (ignored: Exception) {}

        try {
            NotificationManagerCompat.from(this).notify(sosEventId.hashCode(), notification)
        } catch (e: Exception) {
            // Safe fallback
        }
    }
}
