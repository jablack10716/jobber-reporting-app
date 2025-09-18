from jobber_reporting.auth import TokenManager

def start_oauth():
    """Start the OAuth flow to get new tokens"""
    token_mgr = TokenManager()
    token_mgr._start_oauth_flow()

if __name__ == "__main__":
    start_oauth()
