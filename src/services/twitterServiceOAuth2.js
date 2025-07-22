const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto-js');

class TwitterServiceOAuth2 {
  constructor() {
    // OAuth 2.0 credentials (from your .env)
    this.clientId = process.env.Client_ID || process.env.TWITTER_CLIENT_ID;
    this.clientSecret = process.env.Client_Secret || process.env.TWITTER_CLIENT_SECRET;
    
    // OAuth 1.0a credentials (legacy, still needed for some endpoints)
    this.apiKey = process.env.TWITTER_API_KEY;
    this.apiSecret = process.env.TWITTER_API_SECRET;
    this.accessToken = process.env.TWITTER_ACCESS_TOKEN;
    this.accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    this.baseURL = 'https://api.twitter.com/2';
    this.v1BaseURL = 'https://api.twitter.com/1.1';
    
    // OAuth 2.0 access token (will be set after user authorization)
    this.oauth2AccessToken = null;
    
    console.log('✅ Twitter OAuth 2.0 service initialized');
    console.log(`   Client ID: ${this.clientId ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Client Secret: ${this.clientSecret ? '✅ Set' : '❌ Missing'}`);
  }

  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  // Generate OAuth 2.0 authorization URL for user login
  getAuthorizationUrl() {
    const state = crypto.lib.WordArray.random(32).toString();
    const codeVerifier = crypto.lib.WordArray.random(32).toString(crypto.enc.Base64url);
    const codeChallenge = crypto.SHA256(codeVerifier).toString(crypto.enc.Base64url);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: 'http://localhost:3001/auth/twitter/callback',
      scope: 'tweet.read tweet.write users.read',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    // Store for later use
    this.codeVerifier = codeVerifier;
    this.state = state;

    return {
      url: `https://twitter.com/i/oauth2/authorize?${params}`,
      state,
      codeVerifier
    };
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code, codeVerifier) {
    try {
      const response = await axios.post('https://api.twitter.com/2/oauth2/token', {
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: 'http://localhost:3001/auth/twitter/callback',
        code: code,
        code_verifier: codeVerifier
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.oauth2AccessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      
      return {
        success: true,
        accessToken: this.oauth2AccessToken,
        refreshToken: this.refreshToken
      };
    } catch (error) {
      console.error('Token exchange error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // For testing, let's create a method that uses app-only auth (Bearer token) for posting
  async makeAppOnlyRequest(endpoint, options = {}) {
    if (!this.bearerToken) {
      return { success: false, error: 'Bearer token not configured' };
    }

    let config = {
      url: `${this.baseURL}${endpoint}`,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 10000
    };

    if (options.data) {
      if (config.method === 'GET') {
        config.params = options.data;
      } else {
        config.data = options.data;
      }
    }

    try {
      const response = await axios(config);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Twitter API Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || error.message,
        status: error.response?.status
      };
    }
  }

  // Method to post tweet using OAuth 2.0 (when we have user token)
  async postTweetOAuth2(content, accessToken = null) {
    const token = accessToken || this.oauth2AccessToken;
    
    if (!token) {
      return { 
        success: false, 
        error: 'No OAuth 2.0 access token. User authorization required.' 
      };
    }

    try {
      const response = await axios.post(`${this.baseURL}/tweets`, {
        text: content
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        postId: response.data.data.id,
        text: response.data.data.text
      };
    } catch (error) {
      console.error('OAuth 2.0 Tweet Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  // Let's try posting using OAuth 1.0a (might work with your current tokens)
  async postTweetOAuth1(content) {
    if (!this.apiKey || !this.apiSecret || !this.accessToken || !this.accessTokenSecret) {
      return { success: false, error: 'OAuth 1.0a credentials not configured' };
    }

    // Initialize OAuth 1.0a
    const oauth = OAuth({
      consumer: { key: this.apiKey, secret: this.apiSecret },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.HmacSHA1(base_string, key).toString(crypto.enc.Base64);
      }
    });

    const userTokens = {
      key: this.accessToken,
      secret: this.accessTokenSecret
    };

    const requestData = {
      url: `${this.baseURL}/tweets`,
      method: 'POST',
      data: { text: content }
    };

    try {
      const authHeader = oauth.toHeader(oauth.authorize(requestData, userTokens));
      
      const response = await axios.post(requestData.url, requestData.data, {
        headers: {
          ...authHeader,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        postId: response.data.data.id,
        text: response.data.data.text
      };
    } catch (error) {
      console.error('OAuth 1.0a Tweet Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.detail || error.message
      };
    }
  }

  // Main posting method that tries different approaches
  async postTweet(content, options = {}) {
    console.log(`🐦 Attempting to post tweet: "${content}"`);

    // Try OAuth 2.0 first if we have a token
    if (this.oauth2AccessToken) {
      console.log('   Trying OAuth 2.0...');
      const result = await this.postTweetOAuth2(content);
      if (result.success) {
        console.log('   ✅ OAuth 2.0 success!');
        return result;
      }
      console.log('   ❌ OAuth 2.0 failed:', result.error);
    }

    // Try OAuth 1.0a
    console.log('   Trying OAuth 1.0a...');
    const result = await this.postTweetOAuth1(content);
    if (result.success) {
      console.log('   ✅ OAuth 1.0a success!');
      return result;
    }
    console.log('   ❌ OAuth 1.0a failed:', result.error);

    return { 
      success: false, 
      error: 'All authentication methods failed. User authorization may be required.' 
    };
  }

  // Search tweets (read-only, uses Bearer token)
  async searchTweets(query, options = {}) {
    const params = new URLSearchParams({
      query: query,
      max_results: options.maxResults || 10,
      'tweet.fields': 'created_at,author_id,public_metrics'
    });

    const result = await this.makeAppOnlyRequest(`/tweets/search/recent?${params}`);
    
    if (result.success) {
      return {
        success: true,
        tweets: result.data.data || [],
        meta: result.data.meta
      };
    }
    
    return result;
  }

  // Get user metrics (read-only, uses Bearer token)
  async getUserMetrics(username) {
    const result = await this.makeAppOnlyRequest(`/users/by/username/${username}?user.fields=public_metrics,verified,created_at`);
    
    if (result.success) {
      return {
        success: true,
        user: result.data.data
      };
    }
    
    return result;
  }

  // Test connection
  async testConnection() {
    try {
      // Test with a simple search
      const result = await this.searchTweets('hello', { maxResults: 1 });
      
      if (result.success) {
        return {
          success: true,
          message: 'Twitter API connection successful',
          readAccess: true,
          writeAccess: !!this.oauth2AccessToken || !!(this.accessToken && this.accessTokenSecret)
        };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = { TwitterServiceOAuth2 };
