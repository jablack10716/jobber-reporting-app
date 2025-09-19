import { Spinner } from "@jobber/components/Spinner";
import { useUserContext } from "contexts";
import { redirectToJobberOAuth } from "helpers";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authenticateUser } from "services";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const navigate = useNavigate();
  const { setUser, user } = useUserContext();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    console.log('🔍 [Auth] Component loaded, checking state...', {
      hasCode: !!code,
      userAccountName: user.accountName,
      currentURL: window.location.href
    });

    // If user is already authenticated, redirect to home immediately
    if (user.accountName) {
      console.log('✅ [Auth] User already authenticated, redirecting to home');
      navigate('/home', { replace: true });
      return;
    }

    // If there's no code we need to start the OAuth flow
    if (!code) {
      console.log('🚀 [Auth] No code found, starting OAuth flow...');
      redirectToJobberOAuth();
      return;
    }

    // Prevent multiple authentication attempts
    if (authenticating) return;

    // We have a code, attempt to exchange it for a user/token
    (async () => {
      setAuthenticating(true);
      setLoading(true);
      setError(null);

      try {
        // validate state returned from Jobber against stored state
        const returnedState = new URLSearchParams(window.location.search).get('state');
        const expectedState = sessionStorage.getItem('jobber_oauth_state');
        if (expectedState && returnedState !== expectedState) {
          // state mismatch: abort
          const msg = 'OAuth state mismatch';
          console.error(msg, { expectedState, returnedState });
          setError(msg);
          setLoading(false);
          setAuthenticating(false);
          return;
        }

        console.log('🔄 Starting authentication with code:', code.substring(0, 10) + '...');
        const resp = await authenticateUser(code, returnedState || undefined);
        const userData = resp?.data;
        if (!userData || !userData.accountName) {
          throw new Error('No valid user data returned from /auth/token');
        }
        
        console.log('✅ Authentication successful:', userData);
        
        // Clear sessionStorage state to prevent reuse
        sessionStorage.removeItem('jobber_oauth_state');
        
        // Update user context
        setUser(userData);
        
        // Use hard redirect instead of React Router navigation to break any loops
        console.log('🏠 Redirecting to home page...');
        window.location.href = '/home';
        
      } catch (err: any) {
        console.error('Authentication error', err);
        setError(err?.message || 'Authentication failed');
        setLoading(false);
        setAuthenticating(false);
      }
    })();
  }, [code, navigate, setUser, user.accountName, authenticating]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      {loading ? (
        <>
          <Spinner />
          <h1>Authentication in progress</h1>
          {code && <p>Processing authorization code...</p>}
        </>
      ) : error ? (
        <>
          <h1 style={{ color: 'crimson' }}>Authentication failed</h1>
          <p>{error}</p>
          <button onClick={() => { 
            setError(null); 
            setAuthenticating(false);
            sessionStorage.removeItem('jobber_oauth_state');
            redirectToJobberOAuth(); 
          }}>Try again</button>
        </>
      ) : (
        <>
          <Spinner />
          <h1>Authentication in progress</h1>
        </>
      )}
    </div>
  );
};

export default Auth;
