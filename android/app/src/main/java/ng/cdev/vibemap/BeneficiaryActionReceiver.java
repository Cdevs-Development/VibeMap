package ng.cdev.vibemap;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public class BeneficiaryActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String actionType = intent.getAction();
        if (actionType == null) return;

        String beneficiaryId = intent.getStringExtra("beneficiary_id");
        int notificationId = intent.getIntExtra("notification_id", 0);

        // Cancel notification immediately so the user gets instant visual feedback
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null && notificationId != 0) {
                manager.cancel(notificationId);
            }
        } catch (Exception ignored) {}

        if (beneficiaryId == null || beneficiaryId.trim().isEmpty()) return;

        final String apiAction = "ACTION_ACCEPT_BENEFICIARY".equals(actionType) ? "accept" : "decline";

        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                SharedPreferences prefs = context.getSharedPreferences("VibeMapPrefs", Context.MODE_PRIVATE);
                String token = prefs.getString("auth_token", null);
                String apiUrl = prefs.getString("api_url", "https://vibemap-backend-9q3z.onrender.com");
                if (token == null || token.trim().isEmpty()) return;

                String endpoint = apiUrl;
                if (!endpoint.endsWith("/")) endpoint += "/";
                if (!endpoint.contains("/api/")) endpoint += "api/";
                endpoint += "beneficiaries/" + beneficiaryId + "/respond";

                URL url = URI.create(endpoint).toURL();
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("PATCH");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                JSONObject body = new JSONObject();
                body.put("action", apiAction);

                OutputStream os = conn.getOutputStream();
                os.write(body.toString().getBytes("UTF-8"));
                os.close();

                int responseCode = conn.getResponseCode();
                conn.disconnect();
            } catch (Exception ignored) {}
        });
    }
}
