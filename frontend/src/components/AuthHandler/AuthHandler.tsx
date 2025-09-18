import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserContext } from '../../contexts/User/User';
import { authenticateUser } from '../../services/api';

const AuthHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useUserContext();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (!code) {
          setStatus('error');
          setErrorMessage('No authorization code received from Jobber');
          return;
        }

        // Validate state parameter against stored value
        const storedState = sessionStorage.getItem('jobber_oauth_state');
        if (!storedState || state !== storedState) {
          setStatus('error');
          setErrorMessage('Invalid state parameter - possible CSRF attack');
          return;
        }

        console.log('Processing OAuth callback with code:', code.substring(0, 10) + '...');
        console.log('API URL:', process.env.REACT_APP_API_URL);
        
        // Exchange code for token and user data
        const response = await authenticateUser(code, state);
        console.log('authenticateUser response:', response);
        const userData = response.data;
        
        // Store user data and update context
        setUser(userData);
        sessionStorage.removeItem('jobber_oauth_state'); // Clean up
        
        setStatus('success');
        
        // Redirect to reports page after brief success display
        setTimeout(() => {
          navigate('/reports');
        }, 1500);

      } catch (error: any) {
        console.error('OAuth callback error:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          url: error.config?.url
        });
        setStatus('error');
        
        // Provide more specific error message
        let errorMsg = 'Failed to complete authentication';
        if (error.response?.status === 404) {
          errorMsg = 'Authentication endpoint not found. Please check server configuration.';
        } else if (error.response?.status >= 500) {
          errorMsg = 'Server error during authentication. Please try again.';
        } else if (error.response?.data?.message) {
          errorMsg = error.response.data.message;
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        setErrorMessage(errorMsg);
      }
    };

    handleOAuthCallback();
  }, [location.search, navigate, setUser]);

  if (status === 'processing') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '400px',
        padding: '20px'
      }}>
        <div style={{ marginBottom: '20px', fontSize: '18px' }}>
          🔄 Processing authentication...
        </div>
        <div style={{ color: '#666' }}>
          Please wait while we complete your login with Jobber.
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '400px',
        padding: '20px'
      }}>
        <div style={{ marginBottom: '20px', fontSize: '18px', color: '#28a745' }}>
          ✅ Authentication successful!
        </div>
        <div style={{ color: '#666' }}>
          Redirecting to reports...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '400px',
      padding: '20px'
    }}>
      <div style={{ marginBottom: '20px', fontSize: '18px', color: '#dc3545' }}>
        ❌ Authentication failed
      </div>
      <div style={{ color: '#666', marginBottom: '20px', textAlign: 'center' }}>
        {errorMessage}
      </div>
      <button 
        onClick={() => navigate('/')}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Return to Home
      </button>
    </div>
  );
};

export default AuthHandler;