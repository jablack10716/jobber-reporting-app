# GraphQL API call logic
import requests
from .auth import TokenManager

API_VERSION = "2025-01-20"
JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql"
SESSION = requests.Session()

def call_graphql(token_mgr: TokenManager, query: str, variables: dict | None = None, max_retries: int = 2) -> dict:
    variables = variables or {}
    for attempt in range(max_retries + 1):
        headers = {
            "Authorization": token_mgr.auth_header_value(),
            "X-JOBBER-GRAPHQL-VERSION": API_VERSION,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        resp = SESSION.post(
            JOBBER_GRAPHQL_URL,
            json={"query": query, "variables": variables},
            headers=headers,
            timeout=60,
        )
        if resp.status_code == 401:
            if attempt < max_retries:
                print("401 Unauthorized — refreshing token and retrying...")
                token_mgr.refresh()
                continue
            raise RuntimeError("Unauthorized after refresh attempts.")
        if resp.status_code != 200:
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < max_retries:
                retry_after = int(resp.headers.get("Retry-After", "20"))
                wait_s = max(5, min(retry_after, 60))
                print(f"HTTP {resp.status_code} — waiting {wait_s}s then retrying...")
                import time; time.sleep(wait_s)
                continue
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        data = resp.json()
        if "errors" in data and data["errors"]:
            msg = data["errors"][0].get("message", "")
            if "Throttled" in msg and attempt < max_retries:
                cost_ext = data.get("extensions", {}).get("cost", {})
                ts = cost_ext.get("throttleStatus", {})
                old_inv = variables.get("invFirst")
                old_li = variables.get("liFirst")
                if old_inv and old_inv > 1:
                    variables["invFirst"] = max(1, old_inv // 2)
                if old_li and old_li > 10:
                    variables["liFirst"] = max(10, old_li // 2)
                print(
                    f"Throttled — reducing page sizes to invoices={variables.get('invFirst')} "
                    f"lineItems={variables.get('liFirst')} and waiting 20s..."
                )
                import time; time.sleep(20)
                continue
            if ("Invalid Token" in msg or "Bad Request" in msg) and attempt < max_retries:
                print("Token error in GraphQL response — refreshing and retrying...")
                token_mgr.refresh()
                continue
            raise RuntimeError(f"GraphQL error: {msg} | full: {data}")
        return data
    raise RuntimeError("Exceeded retry attempts calling GraphQL.")
