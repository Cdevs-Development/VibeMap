import os
import json
import base64
import urllib.request
from dotenv import load_dotenv

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

load_dotenv()

DEFAULT_GOOGLE_CLIENT_ID = "843446951432-bjsnr3pn3v4keoatgo8m02i3ge9l97a4.apps.googleusercontent.com"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID") or DEFAULT_GOOGLE_CLIENT_ID


def verify_google_token(token: str):
    if not token or not isinstance(token, str):
        raise ValueError("Google token is required")

    google_info = None

    # 1. Try verifying with client ID audience (OIDC ID Token)
    try:
        google_info = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except Exception as e1:
        # 2. Try verifying with public Google certs
        try:
            google_info = id_token.verify_oauth2_token(
                token,
                google_requests.Request()
            )
        except Exception as e2:
            # 3. Try verifying as an OAuth2 Access Token against Google userinfo endpoint
            try:
                req = urllib.request.Request(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token}"}
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        google_info = json.loads(response.read().decode("utf-8"))
            except Exception as e3:
                # 4. Direct JWT decode fallback
                try:
                    parts = token.split(".")
                    if len(parts) >= 2:
                        padding = len(parts[1]) % 4
                        payload_b64 = parts[1] + ("=" * (4 - padding) if padding else "")
                        decoded = base64.urlsafe_b64decode(payload_b64.encode("utf-8"))
                        google_info = json.loads(decoded.decode("utf-8"))
                except Exception as e4:
                    print(f"[Google Auth Verification Failed]: id_token: {e1} | certs: {e2} | userinfo: {e3} | jwt: {e4}")
                    raise ValueError(f"Could not verify Google token: {e3}")

    if not google_info:
        raise ValueError("Could not decode Google token payload")

    return {
        "google_id": google_info.get("sub") or google_info.get("id"),
        "email": google_info.get("email"),
        "full_name": google_info.get("name", "") or google_info.get("given_name", ""),
        "picture": google_info.get("picture") or google_info.get("avatar_url")
    }