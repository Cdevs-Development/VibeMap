package ng.cdev.vibemap;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.os.VibrationEffect;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class EmergencySosService extends Service implements LocationListener {

    private static final String CHANNEL_ID_FOREGROUND = "emergency_sos_service";
    private static final String CHANNEL_ID_ALARM = "sos_alarm_channel_v2";
    private static final String CHANNEL_ID_BENEFICIARY = "beneficiary_requests_channel";
    private static final int NOTIFICATION_ID = 9991;
    private ScheduledExecutorService scheduler;
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private boolean isAlarmPlaying = false;
    private LocationManager locationManager;
    private Location latestLocation = null;
    private int locationUploadCounter = 0;
    private java.util.Set<String> notifiedBeneficiaryReqIds = java.util.Collections.synchronizedSet(new java.util.HashSet<>());

    // WAKE LOCK — keeps CPU alive and GPS callbacks firing through Doze / screen-off
    private PowerManager.WakeLock locationWakeLock = null;

    // Only true once onLocationChanged has fired at least once for this session.
    // Guards the scheduler from uploading stale getLastKnownLocation() data.
    private volatile boolean hasFreshFix = false;

    private Uri getSosAlarmSoundUri() {
        try {
            int resId = getResources().getIdentifier("sos_alarm", "raw", getPackageName());
            if (resId != 0) {
                return Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            }
        } catch (Exception ignored) {}
        Uri fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (fallback == null) fallback = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        return fallback;
    }

    private boolean isLocationSharingEnabled() {
        try {
            SharedPreferences prefs = getSharedPreferences("VibeMapPrefs", Context.MODE_PRIVATE);
            return prefs.getBoolean("location_sharing_enabled", true);
        } catch (Exception e) {
            return true;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();

        boolean foregroundStarted = false;
        try {
            boolean hasLocation = ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                                  ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int serviceTypes = android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
                if (hasLocation && isLocationSharingEnabled()) {
                    serviceTypes |= android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
                }
                startForeground(NOTIFICATION_ID, buildForegroundNotification(), serviceTypes);
                foregroundStarted = true;
            } else {
                startForeground(NOTIFICATION_ID, buildForegroundNotification());
                foregroundStarted = true;
            }
        } catch (Throwable t) {
            try {
                // Fallback startForeground without special flags
                startForeground(NOTIFICATION_ID, buildForegroundNotification());
                foregroundStarted = true;
            } catch (Throwable t2) {
                // If foreground cannot start, stop service immediately to prevent the 5s ANR crash
                stopSelf();
                return;
            }
        }

        if (foregroundStarted) {
            if (isLocationSharingEnabled()) {
                startLocationUpdates();
            }
            startSosPolling();
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) {
                    // 1. Silent Ongoing Foreground Service Channel
                    NotificationChannel fgChannel = new NotificationChannel(
                        CHANNEL_ID_FOREGROUND,
                        "VibeMap Background Service",
                        NotificationManager.IMPORTANCE_LOW
                    );
                    fgChannel.setDescription("Ongoing status notification for background emergency monitoring");
                    fgChannel.setShowBadge(false);
                    fgChannel.setSound(null, null);
                    manager.createNotificationChannel(fgChannel);

                    // 2. High-Priority SOS Distress Alarm Channel with Custom SOS Siren Audio
                    NotificationChannel alarmChannel = new NotificationChannel(
                        CHANNEL_ID_ALARM,
                        "SOS Emergency Alerts",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    alarmChannel.setDescription("Critical high-priority emergency alarms for life-threatening distress signals");
                    alarmChannel.enableVibration(true);
                    alarmChannel.setVibrationPattern(new long[]{0, 1000, 300, 1000, 300, 1200, 300, 1500, 300, 2000});
                    alarmChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    alarmChannel.enableLights(true);

                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build();
                    alarmChannel.setSound(getSosAlarmSoundUri(), audioAttributes);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        alarmChannel.setBypassDnd(true);
                    }

                    manager.createNotificationChannel(alarmChannel);

                    // 3. High-Priority Beneficiary Request Notification Channel
                    NotificationChannel benChannel = new NotificationChannel(
                        CHANNEL_ID_BENEFICIARY,
                        "Beneficiary Requests",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    benChannel.setDescription("Incoming requests to add you as an emergency beneficiary");
                    benChannel.enableVibration(true);
                    benChannel.setVibrationPattern(new long[]{0, 400, 200, 400});
                    benChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    benChannel.enableLights(true);
                    manager.createNotificationChannel(benChannel);
                }
            } catch (Exception ignored) {}
        }
    }

    private long lastUploadTimestamp = 0;
    private Location lastUploadedLocation = null;

    private void startLocationUpdates() {
        if (!isLocationSharingEnabled()) {
            return;
        }
        try {
            // Acquire a PARTIAL_WAKE_LOCK so Doze Mode cannot suspend GPS callbacks
            if (locationWakeLock == null || !locationWakeLock.isHeld()) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    locationWakeLock = pm.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "VibeMap:LocationListenerWakeLock"
                    );
                    locationWakeLock.setReferenceCounted(false);
                    locationWakeLock.acquire(); // held indefinitely while service is running
                }
            }

            locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            if (locationManager != null) {
                if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {

                    // NOTE: We intentionally do NOT call getLastKnownLocation() here.
                    // getLastKnownLocation() returns potentially hours-old stale data (e.g. home)
                    // which the wake-lock scheduler would then continuously upload to the server,
                    // overwriting the correct real-time location coming from the JS layer.
                    // latestLocation stays null until onLocationChanged fires a real live fix.

                    // Register GPS provider with 5s / 2m sensitivity
                    if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                        locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5000, 2.0f, this);
                    }
                    // Register Network / Wi-Fi provider fallback
                    if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                        locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5000, 2.0f, this);
                    }
                    // Register Passive provider to capture fixes from other apps / services
                    if (locationManager.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
                        locationManager.requestLocationUpdates(LocationManager.PASSIVE_PROVIDER, 5000, 2.0f, this);
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    private void stopLocationUpdates() {
        try {
            if (locationManager != null) {
                locationManager.removeUpdates(this);
            }
        } catch (Exception ignored) {}
        // Release the wake lock when location updates are explicitly stopped
        try {
            if (locationWakeLock != null && locationWakeLock.isHeld()) {
                locationWakeLock.release();
            }
            locationWakeLock = null;
        } catch (Exception ignored) {}
        hasFreshFix = false;
        latestLocation = null;
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location != null) {
            latestLocation = location;
            hasFreshFix = true; // Mark that we have a real live GPS callback, not stale cache
            
            // Check if we should upload immediately on movement
            long now = System.currentTimeMillis();
            boolean shouldUpload = false;
            if (lastUploadedLocation == null) {
                shouldUpload = true;
            } else {
                float dist = lastUploadedLocation.distanceTo(location);
                if (dist >= 2.0f && (now - lastUploadTimestamp >= 4000)) {
                    shouldUpload = true;
                } else if (now - lastUploadTimestamp >= 15000) {
                    shouldUpload = true;
                }
            }

            if (shouldUpload) {
                lastUploadTimestamp = now;
                lastUploadedLocation = location;
                Executors.newSingleThreadExecutor().execute(() -> {
                    uploadLocationToServer(location);
                });
            }
        }
    }

    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}

    private Notification buildForegroundNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID_FOREGROUND)
            .setContentTitle("VibeMap Live Protection Active")
            .setContentText("Monitoring live emergency SOS and location sharing")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .build();
    }

    private void startSosPolling() {
        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdownNow();
        }
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleWithFixedDelay(new Runnable() {
            @Override
            public void run() {
                try {
                    checkSosStatus();
                    checkPendingBeneficiaryRequests();
                    // Only upload from the scheduler if we have a LIVE GPS fix.
                    // hasFreshFix is false until onLocationChanged has fired at least once,
                    // preventing stale cached data from overwriting the JS layer's real location.
                    if (hasFreshFix && latestLocation != null) {
                        long now = System.currentTimeMillis();
                        if (now - lastUploadTimestamp >= 15000) {
                            lastUploadTimestamp = now;
                            lastUploadedLocation = latestLocation;
                            uploadLocationToServer(latestLocation);
                        }
                    }
                } catch (Throwable ignored) {}
            }
        }, 3, 10, TimeUnit.SECONDS);
    }

    private void uploadLocationToServer(Location loc) {
        if (loc == null) return;
        if (!isLocationSharingEnabled()) return;

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "VibeMap:LocationUploadWakeLock");
            wakeLock.acquire(4000);
        }

        try {
            SharedPreferences prefs = getSharedPreferences("VibeMapPrefs", Context.MODE_PRIVATE);
            String token = prefs.getString("auth_token", null);
            String apiUrl = prefs.getString("api_url", "https://vibemap-backend-9q3z.onrender.com");

            if (token == null || token.trim().isEmpty()) {
                return;
            }

            String endpoint = apiUrl;
            if (!endpoint.endsWith("/")) endpoint += "/";
            if (!endpoint.contains("/api/")) endpoint += "api/";
            endpoint += "users/me/location";

            URL url = URI.create(endpoint).toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("PUT");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setDoOutput(true);
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);

            JSONObject body = new JSONObject();
            body.put("lat", loc.getLatitude());
            body.put("lng", loc.getLongitude());
            body.put("accuracy", (double) loc.getAccuracy());
            if (loc.hasSpeed()) body.put("speed", (double) loc.getSpeed());
            if (loc.hasBearing()) body.put("heading", (double) loc.getBearing());

            OutputStream os = conn.getOutputStream();
            os.write(body.toString().getBytes("UTF-8"));
            os.close();

            int code = conn.getResponseCode();
            conn.disconnect();
        } catch (Exception ignored) {
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try { wakeLock.release(); } catch (Exception ignored) {}
            }
        }
    }

    private void checkSosStatus() {
        try {
            SharedPreferences prefs = getSharedPreferences("VibeMapPrefs", Context.MODE_PRIVATE);
            String token = prefs.getString("auth_token", null);
            String apiUrl = prefs.getString("api_url", "https://vibemap-backend-9q3z.onrender.com");

            if (token == null || token.trim().isEmpty()) {
                return;
            }

            String endpoint = apiUrl;
            if (!endpoint.endsWith("/")) endpoint += "/";
            if (!endpoint.contains("/api/")) endpoint += "api/";
            endpoint += "users/my-watched";

            URL url = URI.create(endpoint).toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                JSONArray users = new JSONArray(response.toString());
                boolean anySosActive = false;
                String distressedUserName = "Beneficiary";

                for (int i = 0; i < users.length(); i++) {
                    JSONObject user = users.getJSONObject(i);
                    if (user.optBoolean("sos_active", false)) {
                        anySosActive = true;
                        distressedUserName = user.optString("custom_name", "");
                        if (distressedUserName.trim().isEmpty()) {
                            distressedUserName = user.optString("name", "");
                        }
                        if (distressedUserName.trim().isEmpty()) {
                            distressedUserName = user.optString("full_name", "Beneficiary");
                        }
                        break;
                    }
                }

                if (anySosActive) {
                    triggerEmergencyDisturbance(distressedUserName);
                } else {
                    stopEmergencyAlarm();
                }
            }
            conn.disconnect();
        } catch (Exception e) {
            // Background polling fail-safe
        }
    }

    private void checkPendingBeneficiaryRequests() {
        try {
            SharedPreferences prefs = getSharedPreferences("VibeMapPrefs", Context.MODE_PRIVATE);
            String token = prefs.getString("auth_token", null);
            String apiUrl = prefs.getString("api_url", "https://vibemap-backend-9q3z.onrender.com");

            if (token == null || token.trim().isEmpty()) {
                return;
            }

            String endpoint = apiUrl;
            if (!endpoint.endsWith("/")) endpoint += "/";
            if (!endpoint.contains("/api/")) endpoint += "api/";
            endpoint += "beneficiaries/requests";

            URL url = URI.create(endpoint).toURL();
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Accept", "application/json");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                JSONArray requests = new JSONArray(response.toString());
                for (int i = 0; i < requests.length(); i++) {
                    JSONObject req = requests.getJSONObject(i);
                    String reqId = req.optString("id");
                    String requesterName = req.optString("name", "Someone");
                    if (reqId != null && !reqId.isEmpty() && !notifiedBeneficiaryReqIds.contains(reqId)) {
                        notifiedBeneficiaryReqIds.add(reqId);
                        postBeneficiaryRequestNotification(reqId, requesterName);
                    }
                }
            }
            conn.disconnect();
        } catch (Exception ignored) {}
    }

    private void postBeneficiaryRequestNotification(String beneficiaryId, String requesterName) {
        try {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            int notifId = (beneficiaryId != null ? Math.abs(beneficiaryId.hashCode()) : 8888) % 100000;

            // Tap notification -> open app to family screen
            Intent openIntent = new Intent(this, MainActivity.class);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            openIntent.putExtra("route", "/family");
            openIntent.putExtra("deep_link_path", "/family");

            PendingIntent openPendingIntent = PendingIntent.getActivity(
                this,
                notifId,
                openIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE : PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Action Accept
            Intent acceptIntent = new Intent(this, BeneficiaryActionReceiver.class);
            acceptIntent.setAction("ACTION_ACCEPT_BENEFICIARY");
            acceptIntent.putExtra("beneficiary_id", beneficiaryId);
            acceptIntent.putExtra("notification_id", notifId);
            PendingIntent acceptPendingIntent = PendingIntent.getBroadcast(
                this,
                notifId * 10 + 1,
                acceptIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE : PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Action Decline
            Intent declineIntent = new Intent(this, BeneficiaryActionReceiver.class);
            declineIntent.setAction("ACTION_DECLINE_BENEFICIARY");
            declineIntent.putExtra("beneficiary_id", beneficiaryId);
            declineIntent.putExtra("notification_id", notifId);
            PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
                this,
                notifId * 10 + 2,
                declineIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE : PendingIntent.FLAG_UPDATE_CURRENT
            );

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID_BENEFICIARY)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("👤 Emergency Beneficiary Request")
                .setContentText(requesterName + " wants to add you as an emergency beneficiary on VibeMap.")
                .setStyle(new NotificationCompat.BigTextStyle()
                    .bigText(requesterName + " wants to add you as an emergency contact on VibeMap.\n\nAccept to connect your emergency networks together."))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_SOCIAL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(openPendingIntent)
                .setAutoCancel(true)
                .addAction(R.drawable.ic_notification, "Accept", acceptPendingIntent)
                .addAction(R.drawable.ic_notification, "Decline", declinePendingIntent);

            manager.notify(notifId, builder.build());
        } catch (Exception ignored) {}
    }

    private void triggerEmergencyDisturbance(String userName) {
        try {
            // 1. Wake screen up safely
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && pm.isInteractive() == false) {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "VibeMap:EmergencyWakeLock"
                );
                wakeLock.acquire(10000);
            }

            // 2. Play continuous native custom SOS emergency alarm sound
            if (!isAlarmPlaying) {
                Uri alarmUri = getSosAlarmSoundUri();
                if (mediaPlayer == null) {
                    mediaPlayer = MediaPlayer.create(this, alarmUri);
                    if (mediaPlayer != null) {
                        mediaPlayer.setLooping(true);
                        mediaPlayer.setAudioAttributes(
                            new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ALARM)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .build()
                        );
                        mediaPlayer.start();
                        isAlarmPlaying = true;
                    }
                }
            }

            // 3. Forceful attention-grabbing vibration even if phone is on silent mode
            try {
                if (vibrator == null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                        if (vm != null) vibrator = vm.getDefaultVibrator();
                    } else {
                        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                    }
                }
                if (vibrator != null) {
                    long[] pattern = new long[]{0, 1000, 300, 1000, 300, 1200, 300, 1500};
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        AudioAttributes audioAttrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                        VibrationEffect effect = VibrationEffect.createWaveform(pattern, 0); // 0 = repeat continuously
                        vibrator.vibrate(effect, audioAttrs);
                    } else {
                        vibrator.vibrate(pattern, 0);
                    }
                }
            } catch (Exception ignored) {}

            // 4. Post full-screen high-priority alert notification with custom SOS alarm sound
            Intent openIntent = new Intent(this, MainActivity.class);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            openIntent.putExtra("route", "/family");

            PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 9992, openIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE : PendingIntent.FLAG_UPDATE_CURRENT
            );

            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID_ALARM)
                    .setContentTitle("🚨 EMERGENCY SOS: " + userName + "!")
                    .setContentText(userName + " has triggered an emergency distress alarm! Tap to view live map.")
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentIntent(pendingIntent)
                    .setFullScreenIntent(pendingIntent, true)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setSound(getSosAlarmSoundUri())
                    .setVibrate(new long[]{0, 1000, 300, 1000, 300, 1200, 300, 1500})
                    .setAutoCancel(true)
                    .build();

                manager.notify(9993, notification);
            }
        } catch (Exception e) {
            // Fail-safe
        }
    }

    private void stopEmergencyAlarm() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
            }
            isAlarmPlaying = false;

            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("ACTION_STOP_EMERGENCY_ALARM".equals(action)) {
                stopEmergencyAlarm();
            } else if ("ACTION_STOP_LOCATION_UPDATES".equals(action)) {
                stopLocationUpdates();
                latestLocation = null;
            } else if ("ACTION_START_LOCATION_UPDATES".equals(action)) {
                if (isLocationSharingEnabled()) {
                    startLocationUpdates();
                }
            }
        } else {
            // Relaunched by OS after kill (START_STICKY)
            if (isLocationSharingEnabled()) {
                startLocationUpdates();
            }
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        // Auto-restart service if user swipes app away from recents
        try {
            if (isLocationSharingEnabled()) {
                Intent restartServiceIntent = new Intent(getApplicationContext(), EmergencySosService.class);
                restartServiceIntent.setPackage(getPackageName());
                PendingIntent restartPendingIntent = PendingIntent.getService(
                    getApplicationContext(), 101, restartServiceIntent,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? (PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_ONE_SHOT) : PendingIntent.FLAG_ONE_SHOT
                );
                android.app.AlarmManager alarmManager = (android.app.AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null) {
                    alarmManager.set(
                        android.app.AlarmManager.ELAPSED_REALTIME,
                        android.os.SystemClock.elapsedRealtime() + 1500,
                        restartPendingIntent
                    );
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopLocationUpdates();
        stopEmergencyAlarm();
        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdownNow();
        }
        // Belt-and-suspenders: release wake lock if still held
        try {
            if (locationWakeLock != null && locationWakeLock.isHeld()) {
                locationWakeLock.release();
            }
            locationWakeLock = null;
        } catch (Exception ignored) {}
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
