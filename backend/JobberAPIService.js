const fs = require('fs');
const path = require('path');

// Dynamic import for ES module
let GraphQLClient;
(async () => {
  const { GraphQLClient: GQLClient } = await import('graphql-request');
  GraphQLClient = GQLClient;
})();

class JobberAPIService {
  constructor() {
    this.apiUrl = process.env.JOBBER_API_URL;
    this.clientId = process.env.JOBBER_CLIENT_ID;
    this.clientSecret = process.env.JOBBER_CLIENT_SECRET;
    this.redirectUri = process.env.JOBBER_REDIRECT_URL;
    this.tokenStoragePath = process.env.TOKEN_STORAGE_PATH || './tokens.json';
    this.graphqlVersion = process.env.JOBBER_GRAPHQL_VERSION || '2025-01-20';

    this.debug = process.env.DEBUG_GRAPHQL === 'true';

    // Initialize GraphQL client (will be updated with auth token)
    this.client = null;
  }

  log(message, data = null) {
    if (this.debug) {
      console.log(`[JOBBER_API] ${message}`, data || '');
    }
  }

  // Initialize GraphQL client with access token
  async initializeClient(accessToken) {
    if (!accessToken) {
      throw new Error('Access token required to initialize Jobber API client');
    }

    // Wait for GraphQLClient to be available
    while (!GraphQLClient) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.client = new GraphQLClient(this.apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-JOBBER-GRAPHQL-VERSION': this.graphqlVersion,
        'Content-Type': 'application/json'
      }
    });

    this.log('GraphQL client initialized with access token');
  }

  // Load stored tokens
  loadTokens() {
    try {
      if (fs.existsSync(this.tokenStoragePath)) {
        const rawTokens = JSON.parse(fs.readFileSync(this.tokenStoragePath, 'utf8'));
        this.log('Loaded stored tokens');
        
        // Handle the account-keyed token structure
        if (rawTokens && typeof rawTokens === 'object') {
          // If it's the account-keyed structure, get the first account's tokens
          const accountKeys = Object.keys(rawTokens);
          if (accountKeys.length > 0 && rawTokens[accountKeys[0]].access_token) {
            const tokens = rawTokens[accountKeys[0]];
            // Add timestamp if missing
            if (!tokens.created_at && tokens.obtained_at) {
              tokens.created_at = tokens.obtained_at;
            }
            return tokens;
          }
          // If it's already in the correct format
          if (rawTokens.access_token) {
            return rawTokens;
          }
        }
      }
    } catch (error) {
      this.log('Error loading tokens:', error.message);
    }
    return null;
  }

  // Save tokens to storage
  saveTokens(tokens) {
    try {
      // Add timestamp if not present
      if (!tokens.created_at && !tokens.obtained_at) {
        tokens.created_at = new Date().toISOString();
      }
      
      fs.writeFileSync(this.tokenStoragePath, JSON.stringify(tokens, null, 2));
      this.log('Tokens saved successfully');
    } catch (error) {
      this.log('Error saving tokens:', error.message);
      throw error;
    }
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(authorizationCode) {
    try {
      this.log('Exchanging authorization code for access token');
      
      const tokenUrl = 'https://api.getjobber.com/api/oauth/token';
      
      // According to Jobber docs, use application/x-www-form-urlencoded
      const formData = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: authorizationCode,
        redirect_uri: this.redirectUri,
      });
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokens = await response.json();
      this.log('Token exchange successful');
      
      // Save tokens for future use
      this.saveTokens(tokens);
      
      // Initialize GraphQL client with new access token
      await this.initializeClient(tokens.access_token);
      
      return tokens;
    } catch (error) {
      this.log('Error exchanging code for token:', error.message);
      throw error;
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken) {
    try {
      this.log('Refreshing access token');
      
      const tokenUrl = 'https://api.getjobber.com/api/oauth/token';
      
      // According to Jobber docs, use application/x-www-form-urlencoded
      const formData = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      });
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const tokens = await response.json();
      this.log('Token refresh successful');
      
      // Save new tokens
      this.saveTokens(tokens);
      
      // Update GraphQL client with new access token
      await this.initializeClient(tokens.access_token);
      
      return tokens;
    } catch (error) {
      this.log('Error refreshing token:', error.message);
      throw error;
    }
  }

  // Ensure we have a valid access token
  async ensureValidToken() {
    const storedTokens = this.loadTokens();
    
    if (!storedTokens) {
      throw new Error('No stored tokens found. User needs to authenticate.');
    }

    // Check if token is expired
    const now = Date.now();
    const tokenTimestamp = new Date(storedTokens.created_at || storedTokens.obtained_at || 0).getTime();
    
    // Default token lifetime is usually 2 hours (7200 seconds) for Jobber
    const defaultTokenLifetime = 7200 * 1000; // 2 hours in milliseconds
    const tokenLifetime = storedTokens.expires_in ? 
      storedTokens.expires_in * 1000 : 
      defaultTokenLifetime;
    
    const tokenAge = now - tokenTimestamp;
    
    // Refresh if token is 90% expired or if it's older than 1.5 hours
    if (tokenAge >= tokenLifetime * 0.9 || tokenAge >= 5400000) { // 5400000ms = 1.5 hours
      this.log('Token is expiring, refreshing...');
      try {
        return await this.refreshAccessToken(storedTokens.refresh_token);
      } catch (refreshError) {
        this.log('Token refresh failed:', refreshError.message);
        throw new Error(`Token refresh failed: ${refreshError.message}`);
      }
    }

    // Initialize client with existing token
    await this.initializeClient(storedTokens.access_token);
    return storedTokens;
  }

  // Execute GraphQL query
  async query(graphqlQuery, variables = {}) {
    try {
      await this.ensureValidToken();
      
      if (!this.client) {
        throw new Error('GraphQL client not initialized');
      }

      this.log('Executing GraphQL query');
      this.log('Query:', graphqlQuery);
      this.log('Variables:', variables);

      const result = await this.client.request(graphqlQuery, variables);
      this.log('Query successful');
      
      return result;
    } catch (error) {
      this.log('GraphQL query error:', error.message);
      throw error;
    }
  }

  // Direct query without token management (for testing fresh tokens)
  async queryDirect(graphqlQuery, accessToken, variables = {}) {
    try {
      // Wait for GraphQLClient to be available
      while (!GraphQLClient) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const directClient = new GraphQLClient('https://api.getjobber.com/api/graphql', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-JOBBER-GRAPHQL-VERSION': '2025-01-20',
          'Content-Type': 'application/json'
        }
      });

      this.log('Executing direct GraphQL query');
      this.log('Query:', graphqlQuery);
      this.log('Variables:', variables);

      const result = await directClient.request(graphqlQuery, variables);
      this.log('Direct query successful');
      
      return result;
    } catch (error) {
      this.log('Direct GraphQL query error:', error.message);
      throw error;
    }
  }

  // Get first valid account info (used for testing OAuth and account access)
  async getFirstValidAccount() {
    try {
      await this.ensureValidToken();
      
      // Simple query to get current account info
      const query = `
        query getCurrentAccount {
          account {
            id
            name
          }
        }
      `;
      
      const result = await this.query(query);
      this.log('Retrieved account info:', result.account);
      
      return result.account;
    } catch (error) {
      this.log('Error getting account info:', error.message);
      throw new Error(`Failed to get account info: ${error.message}`);
    }
  }

  // Generate OAuth authorization URL
  generateAuthUrl(state = null) {
    const baseUrl = 'https://api.getjobber.com/api/oauth/authorize';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read', // Adjust scope as needed
    });

    if (state) {
      params.append('state', state);
    }

    const authUrl = `${baseUrl}?${params.toString()}`;
    this.log('Generated auth URL:', authUrl);
    
    return authUrl;
  }
}

module.exports = JobberAPIService;