package ng.cdev.vibemap

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build

class VibeMapApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        try {
            createSosAlarmChannel()
        } catch (e: Exception) {
            e.printStackTrace()
        }

        try {
            val prefs = getSharedPreferences("VibeMapPrefs", android.content.Context.MODE_PRIVATE)
            val token = prefs.getString("auth_token", null)
            val isSharing = prefs.getBoolean("location_sharing_enabled", true)
            if (!token.isNullOrBlank() && isSharing) {
                val serviceIntent = android.content.Intent(this, EmergencySosService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent)
                } else {
                    startService(serviceIntent)
                }
            }
        } catch (ignored: Exception) {}
    }

    private fun createSosAlarmChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val alarmSoundUri: Uri? = try {
                val resId = resources.getIdentifier("sos_alarm", "raw", packageName)
                if (resId != 0) {
                    Uri.parse("android.resource://" + packageName + "/" + resId)
                } else {
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                }
            } catch (e: Exception) {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            }

        val manager = getSystemService(NotificationManager::class.java)
        if (manager != null) {
            try {
                manager.deleteNotificationChannel("sos_alarm_channel")
                manager.deleteNotificationChannel("emergency_sos")
            } catch (ignored: Exception) {}

            val channel = NotificationChannel(
                "sos_alarm_channel_v2",
                "SOS Emergency Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Critical emergency SOS alerts from beneficiaries"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 300, 1000, 300, 1200, 300, 1500, 300, 2000)
                enableLights(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    setBypassDnd(true)
                }
                if (alarmSoundUri != null) {
                    setSound(alarmSoundUri, audioAttributes)
                }
            }

            val beneficiaryChannel = NotificationChannel(
                "beneficiary_requests_channel",
                "Beneficiary Requests",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming requests from family and emergency contacts"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 400, 200, 400)
                enableLights(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }

            manager.createNotificationChannel(channel)
            manager.createNotificationChannel(beneficiaryChannel)
        }
        }
    }
}
