package ng.cdev.vibemap

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class SosAlertActivity : AppCompatActivity() {

    private var vibrator: Vibrator? = null
    private var mediaPlayer: MediaPlayer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_sos_alert)

        setupLockScreenDisplay()
        startAlarmAudioAndVibration()

        val senderName = intent.getStringExtra("sender_name") ?: "Someone"
        val senderLat = intent.getStringExtra("sender_lat") ?: ""
        val senderLng = intent.getStringExtra("sender_lng") ?: ""
        val sosEventId = intent.getStringExtra("sos_event_id") ?: ""

        findViewById<TextView>(R.id.sos_title).text = "🚨 EMERGENCY"
        findViewById<TextView>(R.id.sos_message).text = "$senderName has triggered an SOS alert and needs immediate assistance."

        findViewById<Button>(R.id.btn_view_location).setOnClickListener {
            stopAlarmAudioAndVibration()
            openAppToSosTracking(sosEventId, senderLat, senderLng)
        }

        findViewById<Button>(R.id.btn_dismiss).setOnClickListener {
            stopAlarmAudioAndVibration()
            finish()
        }
    }

    private fun startAlarmAudioAndVibration() {
        // 1. Play native custom SOS emergency siren audio
        try {
            val resId = resources.getIdentifier("sos_alarm", "raw", packageName)
            val alarmUri = if (resId != 0) {
                Uri.parse("android.resource://" + packageName + "/" + resId)
            } else {
                android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
            }

            if (alarmUri != null) {
                mediaPlayer = MediaPlayer.create(this, alarmUri)?.apply {
                    isLooping = true
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    start()
                }
            }
        } catch (ignored: Exception) {}

        // 2. Continuous forceful vibration
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            val pattern = longArrayOf(0, 1000, 300, 1000, 300, 1200, 300, 1500)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val audioAttrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                val effect = VibrationEffect.createWaveform(pattern, 0) // 0 = repeat continuously
                vibrator?.vibrate(effect, audioAttrs)
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (ignored: Exception) {}
    }

    private fun stopAlarmAudioAndVibration() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) {
                    it.stop()
                }
                it.release()
            }
            mediaPlayer = null
        } catch (ignored: Exception) {}

        try {
            vibrator?.cancel()
        } catch (ignored: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAlarmAudioAndVibration()
    }

    private fun setupLockScreenDisplay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
    }

    private fun openAppToSosTracking(sosEventId: String, lat: String, lng: String) {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        launchIntent?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("deep_link_path", "/sos/track/$sosEventId")
            putExtra("sos_lat", lat)
            putExtra("sos_lng", lng)
        }
        startActivity(launchIntent)
        finish()
    }
}
