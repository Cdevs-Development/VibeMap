package ng.cdev.vibemap;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.location.Location;
import android.location.LocationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.util.Rational;
import android.content.Intent;
import android.content.SharedPreferences;
import android.speech.tts.TextToSpeech;
import java.util.Locale;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final int RC_GOOGLE_SIGN_IN = 9001;
    private static final int RC_GOOGLE_SIGN_IN_BASIC = 9002;
    private static final int RC_LOCATION_PERMISSION = 9003;

    // Native Text-to-Speech Engine for Voice Assistant Navigation
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;

    // Controls whether the app enters PiP mode when the user presses Home.
    // Only true during active navigation — set via JS bridge setNavigationActive().
    private volatile boolean isNavigationActive = false;

    public class WebAppInterface {
        Context mContext;
        WebAppInterface(Context c) { mContext = c; }

        @JavascriptInterface
        public void saveAuthToken(String token, String apiUrl) {
            try {
                SharedPreferences prefs = mContext.getSharedPreferences("VibeMapPrefs", Context.MODE_PRIVATE);
                prefs.edit()
                    .putString("auth_token", token)
                    .putString("api_url", apiUrl != null && !apiUrl.isEmpty() ? apiUrl : "https://vibemap-backend-9q3z.onrender.com")
                    .apply();

                // Start native background monitoring service safely
                Intent serviceIntent = new Intent(mContext, EmergencySosService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    mContext.startForegroundService(serviceIntent);
                } else {
                    mContext.startService(serviceIntent);
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void setNavigationActive(boolean active) {
            // Called from MapScreen.jsx when navigation starts/ends.
            // Enables or disables automatic PiP entry on home button press.
            isNavigationActive = active;
            runOnUiThread(() -> updatePipParams());
        }

        @JavascriptInterface
        public void stopNativeAlarm() {
            try {
                Intent intent = new Intent(mContext, EmergencySosService.class);
                intent.setAction("ACTION_STOP_EMERGENCY_ALARM");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    mContext.startForegroundService(intent);
                } else {
                    mContext.startService(intent);
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void setLocationSharingEnabled(boolean enabled) {
            try {
                SharedPreferences prefs = mContext.getSharedPreferences("VibeMapPrefs", Context.MODE_PRIVATE);
                prefs.edit().putBoolean("location_sharing_enabled", enabled).apply();

                Intent intent = new Intent(mContext, EmergencySosService.class);
                intent.setAction(enabled ? "ACTION_START_LOCATION_UPDATES" : "ACTION_STOP_LOCATION_UPDATES");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    mContext.startForegroundService(intent);
                } else {
                    mContext.startService(intent);
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void requestLocationPermission() {
            runOnUiThread(() -> {
                try {
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(
                            MainActivity.this,
                            new String[]{
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            },
                            RC_LOCATION_PERMISSION
                        );
                    }
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public String getLastKnownLocation() {
            try {
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                if (lm == null) return "{\"hasLocation\":false}";

                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    requestLocationPermission();
                    return "{\"hasLocation\":false,\"permissionDenied\":true}";
                }

                Location bestLocation = null;
                if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    bestLocation = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                }
                if (bestLocation == null && lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    bestLocation = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                }
                if (bestLocation == null && lm.isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
                    bestLocation = lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER);
                }

                if (bestLocation != null) {
                    JSONObject obj = new JSONObject();
                    obj.put("hasLocation", true);
                    obj.put("latitude", bestLocation.getLatitude());
                    obj.put("longitude", bestLocation.getLongitude());
                    obj.put("accuracy", (double) bestLocation.getAccuracy());
                    obj.put("speed", (double) bestLocation.getSpeed());
                    obj.put("heading", (double) bestLocation.getBearing());
                    return obj.toString();
                }
            } catch (Exception ignored) {}
            return "{\"hasLocation\":false}";
        }

        @JavascriptInterface
        public void launchGoogleSignIn() {
            runOnUiThread(() -> {
                try {
                    GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestIdToken("843446951432-bjsnr3pn3v4keoatgo8m02i3ge9l97a4.apps.googleusercontent.com")
                        .requestEmail()
                        .requestProfile()
                        .build();
                    GoogleSignInClient client = GoogleSignIn.getClient(MainActivity.this, gso);
                    client.signOut().addOnCompleteListener(MainActivity.this, task -> {
                        try {
                            Intent signInIntent = client.getSignInIntent();
                            startActivityForResult(signInIntent, RC_GOOGLE_SIGN_IN);
                        } catch (Exception err) {
                            launchFallbackGoogleSignIn();
                        }
                    });
                } catch (Exception e) {
                    launchFallbackGoogleSignIn();
                }
            });
        }

        @JavascriptInterface
        public void speakText(String text) {
            if (text == null || text.trim().isEmpty()) return;
            runOnUiThread(() -> {
                try {
                    if (tts != null && ttsReady) {
                        tts.stop();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "vibemap_nav_tts");
                        } else {
                            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
                        }
                    }
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void stopSpeaking() {
            runOnUiThread(() -> {
                try {
                    if (tts != null) {
                        tts.stop();
                    }
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public String getDeviceManufacturer() {
            return Build.MANUFACTURER != null ? Build.MANUFACTURER.toLowerCase() : "unknown";
        }

        @JavascriptInterface
        public boolean isIgnoringBatteryOptimizations() {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void openOEMBatterySettings() {
            runOnUiThread(() -> {
                String manufacturer = Build.MANUFACTURER != null ? Build.MANUFACTURER.toLowerCase() : "";
                Intent intent = new Intent();
                try {
                    switch (manufacturer) {
                        case "xiaomi":
                            intent.setComponent(new android.content.ComponentName(
                                "com.miui.securitycenter",
                                "com.miui.permcenter.autostart.AutoStartManagementActivity"));
                            break;
                        case "huawei":
                            intent.setComponent(new android.content.ComponentName(
                                "com.huawei.systemmanager",
                                "com.huawei.systemmanager.optimize.process.ProtectActivity"));
                            break;
                        case "oppo":
                            intent.setComponent(new android.content.ComponentName(
                                "com.coloros.safecenter",
                                "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
                            break;
                        case "vivo":
                            intent.setComponent(new android.content.ComponentName(
                                "com.vivo.permissionmanager",
                                "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
                            break;
                        default:
                            intent.setAction(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                            intent.setData(Uri.parse("package:" + getPackageName()));
                    }
                    startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent fallback = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        fallback.setData(Uri.parse("package:" + getPackageName()));
                        startActivity(fallback);
                    } catch (Exception ignored) {}
                }
            });
        }
    }

    private void launchFallbackGoogleSignIn() {
        runOnUiThread(() -> {
            try {
                GoogleSignInOptions fallbackGso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestEmail()
                    .requestProfile()
                    .build();
                GoogleSignInClient fallbackClient = GoogleSignIn.getClient(MainActivity.this, fallbackGso);
                fallbackClient.signOut().addOnCompleteListener(MainActivity.this, task -> {
                    try {
                        Intent signInIntent = fallbackClient.getSignInIntent();
                        startActivityForResult(signInIntent, RC_GOOGLE_SIGN_IN_BASIC);
                    } catch (Exception ex) {
                        evalJs("window.__handleGoogleSignInError(" + JSONObject.quote(ex.getMessage()) + ");");
                    }
                });
            } catch (Exception ex) {
                evalJs("window.__handleGoogleSignInError(" + JSONObject.quote(ex.getMessage()) + ");");
            }
        });
    }

    private void evalJs(String script) {
        runOnUiThread(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(script, null);
                }
            } catch (Exception ignored) {}
        });
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RC_GOOGLE_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                if (account != null) {
                    String idToken = account.getIdToken() != null ? account.getIdToken() : "";
                    String email = account.getEmail() != null ? account.getEmail() : "";
                    String name = account.getDisplayName() != null ? account.getDisplayName() : "";
                    String picture = account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "";
                    String googleId = account.getId() != null ? account.getId() : "";

                    evalJs(String.format(
                        "window.__handleGoogleSignInSuccess(%s, %s, %s, %s, %s);",
                        JSONObject.quote(idToken),
                        JSONObject.quote(email),
                        JSONObject.quote(name),
                        JSONObject.quote(picture),
                        JSONObject.quote(googleId)
                    ));
                    return;
                }
            } catch (ApiException e) {
                // If idToken request failed with statusCode (e.g. 10 / 12500), fallback to standard Google account picker
                launchFallbackGoogleSignIn();
                return;
            } catch (Exception e) {
                evalJs("window.__handleGoogleSignInError(" + JSONObject.quote("Google sign-in failed: " + e.getMessage()) + ");");
                return;
            }
        } else if (requestCode == RC_GOOGLE_SIGN_IN_BASIC) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                if (account != null) {
                    String email = account.getEmail() != null ? account.getEmail() : "";
                    String name = account.getDisplayName() != null ? account.getDisplayName() : "";
                    String picture = account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "";
                    String googleId = account.getId() != null ? account.getId() : "";

                    evalJs(String.format(
                        "window.__handleGoogleSignInSuccess(%s, %s, %s, %s, %s);",
                        JSONObject.quote(""),
                        JSONObject.quote(email),
                        JSONObject.quote(name),
                        JSONObject.quote(picture),
                        JSONObject.quote(googleId)
                    ));
                }
            } catch (Exception e) {
                evalJs("window.__handleGoogleSignInError(" + JSONObject.quote("Google sign-in failed: " + e.getMessage()) + ");");
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register Capacitor plugins before super.onCreate()
        try {
            registerPlugin(FullScreenIntentPlugin.class);
        } catch (Exception ignored) {}
        try {
            registerPlugin(com.equimaps.capacitor_background_geolocation.BackgroundGeolocation.class);
        } catch (Exception ignored) {}

        super.onCreate(savedInstanceState);

        try {
            tts = new TextToSpeech(this, status -> {
                if (status == TextToSpeech.SUCCESS) {
                    try {
                        int result = tts.setLanguage(Locale.US);
                        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                            tts.setLanguage(Locale.getDefault());
                        }
                        tts.setSpeechRate(1.02f);
                        tts.setPitch(1.0f);
                        ttsReady = true;
                    } catch (Exception ignored) {}
                }
            });
        } catch (Exception ignored) {}

        try {
            createEmergencyNotificationChannel();
            updatePipParams();

            if (getBridge() != null && getBridge().getWebView() != null) {
                android.webkit.WebSettings settings = getBridge().getWebView().getSettings();
                settings.setUserAgentString("Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36");
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setGeolocationEnabled(true);
                settings.setGeolocationDatabasePath(getFilesDir().getPath());
                settings.setSupportMultipleWindows(false);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                getBridge().getWebView().addJavascriptInterface(new WebAppInterface(this), "NativeVibeMap");
            }
            handleSosDeepLink(getIntent());

            // Prompt for location permissions early if not yet granted
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    RC_LOCATION_PERMISSION
                );
            }

            // Ask to be excluded from battery optimization (once per install).
            // This is the most critical step to keep passive tracking alive in background.
            requestBatteryOptimizationExemption();
        } catch (Exception ignored) {}
    }

    /**
     * Prompts the user to whitelist VibeMap from Android battery optimization.
     * Without this, Doze Mode and battery saver can starve the background GPS service
     * of CPU time, causing location updates to stop when the screen is off.
     *
     * This intent pops up the system dialog once — the user taps "Allow".
     * We only show it once: if already exempted, this is a no-op.
     */
    private void requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Intent batteryIntent = new Intent(
                        android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                    );
                    batteryIntent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(batteryIntent);
                }
            } catch (Exception ignored) {
                // Some OEMs block this intent; fail silently
            }
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleSosDeepLink(intent);
    }

    private void handleSosDeepLink(Intent intent) {
        if (intent == null) return;
        String path = intent.getStringExtra("deep_link_path");
        if (path == null) return;
        String lat = intent.getStringExtra("sos_lat");
        if (lat == null) lat = "";
        String lng = intent.getStringExtra("sos_lng");
        if (lng == null) lng = "";

        String script = "window.dispatchEvent(new CustomEvent('vibemap-sos-deeplink', { detail: { path: '" + path + "', lat: '" + lat + "', lng: '" + lng + "' } }));";
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(script, null);
        }
    }

    private void createEmergencyNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) {
                    String channelId = "emergency_sos";
                    CharSequence name = "Emergency SOS Distress Alerts";
                    String description = "Critical high-priority alarms for life-threatening distress signals";
                    int importance = NotificationManager.IMPORTANCE_HIGH;

                    NotificationChannel channel = new NotificationChannel(channelId, name, importance);
                    channel.setDescription(description);
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{0, 800, 200, 800, 200, 1000});
                    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    channel.enableLights(true);

                    Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                    if (alarmSound == null) {
                        alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    }
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build();
                    channel.setSound(alarmSound, audioAttributes);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        channel.setBypassDnd(true);
                    }

                    manager.createNotificationChannel(channel);
                }
            } catch (Exception e) {
                // Ignore channel creation fail-safe
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        updatePipParams();
        try {
            Intent intent = new Intent(this, EmergencySosService.class);
            intent.setAction("ACTION_STOP_EMERGENCY_ALARM");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent);
            } else {
                startService(intent);
            }
        } catch (Exception ignored) {}
    }

    private void updatePipParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
                Rational aspectRatio = new Rational(10, 12);
                builder.setAspectRatio(aspectRatio);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    builder.setAutoEnterEnabled(isNavigationActive);
                    builder.setSeamlessResizeEnabled(true);
                }
                setPictureInPictureParams(builder.build());
            } catch (Exception e) {
                // Ignore if PiP not supported on device
            }
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (isNavigationActive && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
                builder.setAspectRatio(new Rational(10, 12));
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    builder.setAutoEnterEnabled(true);
                    builder.setSeamlessResizeEnabled(true);
                }
                enterPictureInPictureMode(builder.build());
            } catch (Exception e) {
                // Fail-safe
            }
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('androidPipChange', { detail: { isInPip: " + isInPictureInPictureMode + " } }));",
                    null
                );
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            if (tts != null) {
                tts.stop();
                tts.shutdown();
                tts = null;
                ttsReady = false;
            }
        } catch (Exception ignored) {}
    }
}
