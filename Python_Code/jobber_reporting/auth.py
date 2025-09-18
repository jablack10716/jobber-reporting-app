# Handles loading/saving tokens, decoding JWT expiry, and refreshing the access token
import os
import json
import time
import base64
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
import requests

TOKEN_FILE = os.getenv("JOBBER_TOKEN_FILE", os.path.join(os.path.dirname(os.path.dirname(__file__)), "tokens.json"))
JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token"
JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql"

# Set up session with default headers
SESSION = requests.Session()
SESSION.headers.update({
    'Content-Type': 'application/json',
    'Accept': 'application/json'
})

class TokenManager:
    def __init__(self, token_file: str = None):
        self.token_file = token_file or TOKEN_FILE
        self.client_id = os.getenv("JOBBER_CLIENT_ID")
        self.client_secret = os.getenv("JOBBER_CLIENT_SECRET")
        self.tokens = self._load()

    @contextmanager
    def _file_lock(self, timeout: int = 10):
        lock_path = self.token_file + ".lock"
        start = time.time()
        fd = None
        while True:
            try:
                fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_RDWR)
                break
            except FileExistsError:
                if time.time() - start > timeout:
                    raise RuntimeError("Token file is locked by another process.")
                time.sleep(0.2)
        try:
            yield
        finally:
            try:
                if fd is not None:
                    os.close(fd)
                os.remove(lock_path)
            except FileNotFoundError:
                pass

    def _load(self) -> dict:
        try:
            with open(self.token_file, "r", encoding="utf-8-sig") as f:
                raw = f.read().strip()
            if not raw:
                print("No tokens found. Starting OAuth flow...")
                return self._start_oauth_flow()
            return json.loads(raw)
        except FileNotFoundError:
            print("No tokens file found. Starting OAuth flow...")
            return self._start_oauth_flow()
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"Invalid JSON in {self.token_file}: {e}. Make sure values are quoted and there are no trailing commas."
            )

    def _save(self) -> None:
        with self._file_lock():
            tmp = self.token_file + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.tokens, f, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, self.token_file)

    def _raw_access(self) -> str:
        tok = self.tokens.get("access_token", "")
        return tok.split(" ", 1)[1] if tok.startswith("Bearer ") else tok

    def _exp_utc(self):
        raw = self._raw_access()
        if not raw or "." not in raw:
            return None
        try:
            payload_b64 = raw.split(".")[1]
            payload_b64 += "=" * (-len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode())
            exp = payload.get("exp")
            return datetime.fromtimestamp(exp, tz=timezone.utc) if exp else None
        except Exception:
            return None

    def _is_expiring_soon(self, buffer_seconds: int = 300) -> bool:
        exp = self._exp_utc()
        if not exp:
            return True
        return datetime.now(timezone.utc) >= exp - timedelta(seconds=buffer_seconds)

    def refresh(self) -> None:
        """Refresh the access token using the refresh token.
        
        This implementation handles refresh token rotation and concurrent refresh attempts.
        Always saves the new refresh token immediately and retries with the latest token if a refresh fails.
        """
        with self._file_lock():  # Ensure atomic token operations
            try:
                # Always load fresh tokens from disk before refresh
                on_disk = self._load()
                if on_disk.get("refresh_token"):
                    if on_disk.get("refresh_token") != self.tokens.get("refresh_token"):
                        print("ℹ️ Found newer refresh token on disk, using it instead.")
                        self.tokens = on_disk
            except Exception as e:
                print(f"⚠️ Error loading tokens from disk: {e}")

            # Prepare refresh request
            payload = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
                "refresh_token": self.tokens["refresh_token"],
            }

            # Attempt token refresh
            r = SESSION.post(JOBBER_TOKEN_URL, json=payload, timeout=30)

            if r.status_code == 401:
                # Handle invalid token - could be a race condition where another process
                # already refreshed and rotated the token
                try:
                    print("♻️ Got 401, checking for newer refresh token on disk...")
                    newer = self._load()
                    if newer.get("refresh_token") and newer["refresh_token"] != self.tokens["refresh_token"]:
                        print("♻️ Found rotated refresh token, retrying...")
                        self.tokens = newer
                        payload["refresh_token"] = self.tokens["refresh_token"]
                        r = SESSION.post(JOBBER_TOKEN_URL, json=payload, timeout=30)
                except Exception as e:
                    print(f"⚠️ Error during token retry: {e}")

            # Handle response
            if r.status_code != 200:
                raise RuntimeError(f"Failed to refresh token ({r.status_code}): {r.text}")

            data = r.json()
            
            # Check for warnings about token rotation
            if "warning" in data:
                if "Refresh token rotation is off" in data["warning"]:
                    print("⚠️ Warning: Refresh token rotation is disabled in Developer Center")
                elif "Unexpected Refresh Token Redemption" in data["warning"]:
                    print("⚠️ Warning: Attempted to use an old refresh token")
                else:
                    print(f"⚠️ Warning from Jobber: {data['warning']}")

            # Always save both tokens immediately
            self.tokens["access_token"] = data["access_token"]
            if data.get("refresh_token"):
                # If we got a new refresh token, save it immediately
                old_token = self.tokens.get("refresh_token")
                self.tokens["refresh_token"] = data["refresh_token"]
                print(f"🔄 Refresh token rotated")
                
            # Save to disk within the lock to prevent race conditions
            self._save()
            print("🔐 Tokens refreshed and saved to:", os.path.abspath(self.token_file))
        print("🔐 Tokens refreshed and saved to:", os.path.abspath(self.token_file))

    def _start_oauth_flow(self) -> dict:
        """Start the OAuth flow to get both access and refresh tokens"""
        print("\nTo get your tokens, follow these steps:")
        print("1. Visit the Jobber Developer Portal: https://developer.getjobber.com/apps")
        print("2. Create a new application if you haven't already")
        print("3. Set the following redirect URI in your app settings:")
        print("   http://localhost:8080/callback")
        
        client_id = input("\nEnter your Client ID from the Developer Portal: ").strip()
        client_secret = input("Enter your Client Secret from the Developer Portal: ").strip()
        
        # Save credentials for future use
        self.client_id = client_id
        self.client_secret = client_secret
        
        # Generate authorization URL
        auth_url = (
            "https://api.getjobber.com/api/oauth/authorize?"
            f"client_id={client_id}&"
            "response_type=code&"
            "redirect_uri=http://localhost:8080/callback"
        )
        
        print("\nPlease visit this URL in your browser:")
        print(auth_url)
        print("\nAfter authorizing, you'll be redirected to a URL like:")
        print("http://localhost:8080/callback?code=XXXX")
        
        auth_code = input("\nEnter the 'code' parameter from the URL: ").strip()
        
        # Exchange authorization code for tokens
        response = SESSION.post(
            'https://api.getjobber.com/api/oauth/token',
            json={
                'grant_type': 'authorization_code',
                'code': auth_code,
                'client_id': client_id,
                'client_secret': client_secret,
                'redirect_uri': 'http://localhost:8080/callback'
            }
        )
        
        if response.status_code != 200:
            raise RuntimeError(f"Failed to get tokens: {response.text}")
            
        tokens = response.json()
        
        # Save tokens to file
        token_data = {
            'access_token': tokens['access_token'],
            'refresh_token': tokens['refresh_token']
        }
        
        with open(self.token_file, 'w', encoding='utf-8') as f:
            json.dump(token_data, f, indent=2)
            
        print(f"\nTokens successfully saved to {self.token_file}")
        return token_data

    def auth_header_value(self) -> str:
        if self._is_expiring_soon():
            self.refresh()
        return f"Bearer {self._raw_access()}"

    def execute_graphql(self, query: str, variables: dict = None) -> dict:
        """Execute a GraphQL query against the Jobber API
        
        Args:
            query (str): The GraphQL query to execute
            variables (dict, optional): Variables for the GraphQL query. Defaults to None.
            
        Returns:
            dict: The response data from the API
            
        Raises:
            requests.exceptions.RequestException: If the request fails
        """
        if self._is_expiring_soon():
            self.refresh()

        headers = {
            'Authorization': self.auth_header_value(),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-Version': '2025-01-20'  # Using version from GraphiQL response
        }
        
        # Keep the original query formatting
        payload = {
            'query': query,
            'variables': variables or {}
        }
        
        print("\nSending GraphQL request...")
        print(f"Headers: {headers}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = SESSION.post(JOBBER_GRAPHQL_URL, json=payload, headers=headers, timeout=30)
        print(f"\nResponse Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"Error Response Text: {response.text}")
            print(f"Response Headers: {dict(response.headers)}")
            response.raise_for_status()
            
        try:
            json_response = response.json()
            print(f"Response JSON: {json.dumps(json_response, indent=2)}")
            return json_response
        except requests.exceptions.JSONDecodeError:
            print(f"Raw response text (not JSON):\n{response.text}")
            print(f"Response Headers: {dict(response.headers)}")
            print(f"Request payload: {json.dumps(payload, indent=2)}")
            raise

            if 'errors' in response_data:
                print("GraphQL Error Response:", json.dumps(response_data, indent=2))
                raise RuntimeError(f"GraphQL errors: {response_data['errors']}")

            if 'data' not in response_data:
                print("Unexpected response format:", json.dumps(response_data, indent=2))
                raise RuntimeError("Response missing 'data' field")

            return response_data['data']

        except requests.exceptions.RequestException as e:
            print(f"Request failed: {str(e)}")
            print("Request payload:", json.dumps(payload, indent=2))
            raise
