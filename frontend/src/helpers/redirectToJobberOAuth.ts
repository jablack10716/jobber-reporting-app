const redirectToJobberOAuth = () => {
  if (process.env.NODE_ENV === "test") return;

  // Generate and save a state parameter to validate the callback
  try {
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem('jobber_oauth_state', state);

    const authUrl = new URL(process.env.REACT_APP_JOBBER_API_URL || 'https://api.getjobber.com/api/oauth/authorize');
    // Required per Jobber docs: response_type=code
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', process.env.REACT_APP_JOBBER_APP_CLIENT_ID || '');
    // Prefer env override, fall back to unified backend/front-end origin at port 3000
    authUrl.searchParams.set('redirect_uri', process.env.REACT_APP_REDIRECT_URL || 'http://localhost:3000/auth');
    authUrl.searchParams.set('state', state);

    window.location.href = authUrl.toString();
  } catch (err) {
    // fallback simple redirect if URL constructor fails for any reason
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem('jobber_oauth_state', state);
  const redirect = `${process.env.REACT_APP_JOBBER_API_URL}?response_type=code&client_id=${process.env.REACT_APP_JOBBER_APP_CLIENT_ID}&redirect_uri=${process.env.REACT_APP_REDIRECT_URL || 'http://localhost:3000/auth'}&state=${state}`;
    window.location.href = redirect;
  }
};

export default redirectToJobberOAuth;
