const redirectToJobberOAuth = () => {
  if (process.env.NODE_ENV === "test") return;

  // Derive a safe default redirect_uri: current origin + /auth/callback
  const currentOrigin = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : 'http://localhost:3000';
  const defaultRedirectUri = `${currentOrigin}/auth/callback`;
  const redirectUri = process.env.REACT_APP_REDIRECT_URL || defaultRedirectUri;

  // Debug logging for production diagnosis
  console.log('[OAuth Debug] Environment vars:', {
    REACT_APP_REDIRECT_URL: process.env.REACT_APP_REDIRECT_URL,
    REACT_APP_JOBBER_API_URL: process.env.REACT_APP_JOBBER_API_URL,
    REACT_APP_JOBBER_APP_CLIENT_ID: process.env.REACT_APP_JOBBER_APP_CLIENT_ID,
    NODE_ENV: process.env.NODE_ENV,
    currentOrigin,
    defaultRedirectUri,
    finalRedirectUri: redirectUri
  });

  // TEMPORARY: Add delay to see logs
  console.log('⏱️ [OAuth] Delaying redirect for 5 seconds to view logs...');
  setTimeout(() => {
    console.log('🚀 [OAuth] Starting actual redirect now...');
    performOAuthRedirect();
  }, 5000);

  function performOAuthRedirect() {
    try {
      const state = Math.random().toString(36).slice(2);
      sessionStorage.setItem('jobber_oauth_state', state);

      const base = process.env.REACT_APP_JOBBER_API_URL || 'https://api.getjobber.com/oauth/authorize';
      const authUrl = new URL(base);
      // Required per Jobber docs: response_type=code
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', process.env.REACT_APP_JOBBER_APP_CLIENT_ID || '');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', state);

      // Enhanced debug to help diagnose redirect targets in production
      console.log('[OAuth] Final authorization URL:', authUrl.toString());
      console.log('[OAuth] Redirect URI being sent to Jobber:', redirectUri);
      try { console.debug('[OAuth] Redirecting to Jobber authorize', { redirectUri, base }); } catch {}

      window.location.href = authUrl.toString();
    } catch (err) {
      // Fallback simple redirect if URL constructor fails for any reason
      const state = Math.random().toString(36).slice(2);
      sessionStorage.setItem('jobber_oauth_state', state);
      const base = process.env.REACT_APP_JOBBER_API_URL || 'https://api.getjobber.com/oauth/authorize';
      const clientId = process.env.REACT_APP_JOBBER_APP_CLIENT_ID || '';
      const fallbackRedirect = `${base}?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
      window.location.href = fallbackRedirect;
    }
  }
};

export default redirectToJobberOAuth;
