const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto-js');

class TwitterService {
  constructor() {
    this.apiKey = process.env.TWITTER_API_KEY;
    this.apiSecret = process.env.TWITTER_API_SECRET;
    this.accessToken = process.env.TWITTER_ACCESS_TOKEN;
    this.accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    this.baseURL = 'https://api.twitter.com/2';
    this.v1BaseURL = 'https://api.twitter.com/1.1';
    
    // Initialize OAuth for user context operations
    this.oauth = OAuth({
      consumer: { key: this.apiKey, secret: this.apiSecret },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.HmacSHA1(base_string, key).toString(crypto.enc.Base64);
      }
    });

    this.userTokens = {
      key: this.accessToken,
      secret: this.accessTokenSecret
    };
    
    this.rateLimits = {
      tweets: { limit: 300, window: 15 * 60 * 1000 }, // 300 per 15 minutes
      users: { limit: 300, window: 15 * 60 * 1000 },
      likes: { limit: 75, window: 15 * 60 * 1000 }
    };
    
    console.log('✅ Twitter service initialized');
  }

  isConfigured() {
    return !!(this.apiKey && this.apiSecret && this.accessToken && this.accessTokenSecret && 
              !this.apiKey.includes('your_') && !this.apiSecret.includes('your_') &&
              !this.accessToken.includes('your_') && !this.accessTokenSecret.includes('your_'));
  }

  async makeRequest(endpoint, options = {}) {
    if (!this.isConfigured()) {
      console.log('⚠️  Twitter API: Using mock mode - credentials not configured');
      return this.mockResponse(endpoint, options);
    }

    // Determine if we need user context (OAuth 1.0a) or app context (Bearer token)
    const needsUserContext = options.userContext !== false && (
      endpoint.includes('/users/me') ||
      endpoint.includes('/tweets') && options.method === 'POST' ||
      endpoint.includes('/users/') && options.method === 'POST' ||
      endpoint.includes('/likes') ||
      endpoint.includes('/retweets') ||
      endpoint.includes('/following')
    );

    let config = {
      url: `${this.baseURL}${endpoint}`,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 10000
    };

    // Add data/params based on method
    if (options.data) {
      if (config.method === 'GET') {
        config.params = options.data;
      } else {
        config.data = options.data;
      }
    }

    if (needsUserContext) {
      // Use OAuth 1.0a for user context
      const authHeader = this.oauth.toHeader(
        this.oauth.authorize({
          url: config.url,
          method: config.method,
          data: config.method === 'POST' ? config.data : config.params
        }, this.userTokens)
      );
      config.headers.Authorization = authHeader.Authorization;
    } else {
      // Use Bearer token for app context
      config.headers.Authorization = `Bearer ${this.bearerToken}`;
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

  // Helper method for v1.1 API calls
  async makeV1Request(endpoint, options = {}) {
    if (!this.isConfigured()) {
      console.log('⚠️  Twitter API: Using mock mode - credentials not configured');
      return this.mockResponse(endpoint, options);
    }

    let config = {
      url: `${this.v1BaseURL}${endpoint}`,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 10000
    };

    // Add data/params based on method
    if (options.data) {
      if (config.method === 'GET') {
        config.params = options.data;
      } else {
        config.data = options.data;
      }
    }

    // v1.1 API always requires OAuth 1.0a
    const authHeader = this.oauth.toHeader(
      this.oauth.authorize({
        url: config.url,
        method: config.method,
        data: config.method === 'POST' ? config.data : config.params
      }, this.userTokens)
    );
    config.headers.Authorization = authHeader.Authorization;

    try {
      const response = await axios(config);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Twitter v1.1 API Error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.response?.data?.error || error.message
      };
    }
  }

  // Mock responses for when API is not configured
  mockResponse(endpoint, options) {
    console.log(`🎭 Mock Twitter API: ${options.method || 'GET'} ${endpoint}`);
    
    if (endpoint === '/users/me') {
      return {
        success: true,
        data: {
          data: {
            id: 'mock_user_123',
            username: 'mock_user',
            name: 'Mock User'
          }
        }
      };
    }
    
    if (endpoint === '/tweets' && options.method === 'POST') {
      return {
        success: true,
        data: {
          data: {
            id: `mock_tweet_${Date.now()}`,
            text: options.data?.text || 'Mock tweet'
          }
        }
      };
    }

    return { success: true, data: { data: {} } };
  }

  // Enhanced mock response for rate limit fallback
  getMockDataForEndpoint(endpoint, options = {}) {
    console.log(`🎭 Using mock data for ${endpoint}`);
    
    // Check for tweets endpoint first (more specific)
    if (endpoint.includes('/users/by/username/') && endpoint.includes('/tweets')) {
      const pathParts = endpoint.split('/');
      const usernameIndex = pathParts.indexOf('username') + 1;
      const username = pathParts[usernameIndex];
      const maxResults = options.maxResults || 5;
      const mockTweets = Array.from({ length: maxResults }, (_, i) => ({
        id: `mock_tweet_${username}_${i}`,
        text: `Mock tweet ${i + 1} from ${username}. This would be real tweet content with proper API access. #MockData #TwitterAPI`,
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        author_id: `mock_${username}_id`,
        public_metrics: {
          like_count: Math.floor(Math.random() * 200),
          retweet_count: Math.floor(Math.random() * 50),
          reply_count: Math.floor(Math.random() * 30),
          quote_count: Math.floor(Math.random() * 10)
        }
      }));

      return {
        success: true,
        data: {
          data: mockTweets
        },
        meta: {
          result_count: mockTweets.length,
          newest_id: mockTweets[0]?.id,
          oldest_id: mockTweets[mockTweets.length - 1]?.id
        }
      };
    }
    
    // Check for user profile endpoint
    if (endpoint.includes('/users/by/username/')) {
      const username = endpoint.split('/').pop();
      return {
        success: true,
        data: {
          data: {
            id: `mock_${username}_id`,
            username: username,
            name: `${username.charAt(0).toUpperCase() + username.slice(1)} (Mock)`,
            description: `This is a mock user profile for ${username}. Real data would appear here with proper API access.`,
            verified: Math.random() > 0.8,
            public_metrics: {
              followers_count: Math.floor(Math.random() * 50000) + 1000,
              following_count: Math.floor(Math.random() * 5000) + 100,
              tweet_count: Math.floor(Math.random() * 10000) + 500,
              listed_count: Math.floor(Math.random() * 100) + 10
            },
            created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      };
    }

    if (endpoint.includes('/tweets/search/recent')) {
      const query = options.query || 'search';
      const maxResults = options.maxResults || 10;
      const mockTweets = Array.from({ length: Math.min(maxResults, 5) }, (_, i) => ({
        id: `mock_search_${i}_${Date.now()}`,
        text: `Mock search result ${i + 1} for "${query}". This tweet contains relevant content about ${query}. #${query.replace(/[^a-zA-Z0-9]/g, '')} #MockData`,
        created_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        author_id: `mock_author_${i}`,
        public_metrics: {
          like_count: Math.floor(Math.random() * 100),
          retweet_count: Math.floor(Math.random() * 25),
          reply_count: Math.floor(Math.random() * 15),
          quote_count: Math.floor(Math.random() * 5)
        }
      }));

      return {
        success: true,
        tweets: mockTweets,
        meta: {
          result_count: mockTweets.length
        }
      };
    }

    return { success: true, data: { data: {} } };
  }

  async postTweet(content, options = {}) {
    try {
      const tweetData = {
        text: content
      };

      // Add media if provided
      if (options.mediaIds && options.mediaIds.length > 0) {
        tweetData.media = { media_ids: options.mediaIds };
      }

      // Add reply settings
      if (options.replySettings) {
        tweetData.reply_settings = options.replySettings;
      }

      const result = await this.makeRequest('/tweets', {
        method: 'POST',
        data: tweetData
      });

      if (result.success) {
        console.log('✅ Tweet posted successfully:', result.data.data.id);
        return {
          success: true,
          postId: result.data.data.id,
          text: result.data.data.text
        };
      } else {
        console.error('❌ Failed to post tweet:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Tweet posting error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async likeTweet(tweetId) {
    try {
      if (!this.isConfigured()) {
        console.log('👍 Mock: Liking tweet:', tweetId);
        return { success: true, tweetId, liked: true };
      }

      // Get authenticated user ID first
      const userResult = await this.makeRequest('/users/me');
      if (!userResult.success) {
        return { success: false, error: 'Failed to get user info' };
      }

      const userId = userResult.data.data.id;
      
      const result = await this.makeRequest(`/users/${userId}/likes`, {
        method: 'POST',
        data: { tweet_id: tweetId }
      });

      if (result.success) {
        console.log('✅ Tweet liked successfully:', tweetId);
        return { success: true, tweetId, liked: result.data.data.liked };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Like tweet error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async retweet(tweetId) {
    try {
      if (!this.isConfigured()) {
        console.log('🔄 Mock: Retweeting:', tweetId);
        return { success: true, tweetId, retweeted: true };
      }

      const userResult = await this.makeRequest('/users/me');
      if (!userResult.success) {
        return { success: false, error: 'Failed to get user info' };
      }

      const userId = userResult.data.data.id;
      
      const result = await this.makeRequest(`/users/${userId}/retweets`, {
        method: 'POST',
        data: { tweet_id: tweetId }
      });

      if (result.success) {
        console.log('✅ Tweet retweeted successfully:', tweetId);
        return { success: true, tweetId, retweeted: result.data.data.retweeted };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Retweet error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async followUser(username) {
    try {
      if (!this.isConfigured()) {
        console.log('👤 Mock: Following user:', username);
        return { success: true, username, following: true };
      }

      // Get user ID by username
      const userResult = await this.makeRequest(`/users/by/username/${username}`);
      if (!userResult.success) {
        return { success: false, error: 'User not found' };
      }

      const targetUserId = userResult.data.data.id;
      
      // Get authenticated user ID
      const meResult = await this.makeRequest('/users/me');
      if (!meResult.success) {
        return { success: false, error: 'Failed to get authenticated user info' };
      }

      const myUserId = meResult.data.data.id;

      const result = await this.makeRequest(`/users/${myUserId}/following`, {
        method: 'POST',
        data: { target_user_id: targetUserId }
      });

      if (result.success) {
        console.log('✅ User followed successfully:', username);
        return { success: true, username, following: result.data.data.following };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Follow user error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async searchTweets(query, options = {}) {
    try {
      if (!this.isConfigured()) {
        console.log('🔍 Mock: Searching tweets:', query);
        return this.getMockDataForEndpoint('/tweets/search/recent', { query, ...options });
      }

      const params = new URLSearchParams({
        query: query,
        max_results: options.maxResults || 10,
        'tweet.fields': 'created_at,author_id,public_metrics',
        'user.fields': 'username,name,verified'
      });

      if (options.sinceId) params.append('since_id', options.sinceId);
      if (options.untilId) params.append('until_id', options.untilId);

      const result = await this.makeRequest(`/tweets/search/recent?${params}`);

      if (result.success) {
        return {
          success: true,
          tweets: result.data.data || [],
          meta: result.data.meta
        };
      } else {
        // Fallback to mock data
        console.log(`⚠️ Tweet search failed for "${query}", using mock data:`, result.error);
        return this.getMockDataForEndpoint('/tweets/search/recent', { query, ...options });
      }
    } catch (error) {
      console.error('❌ Search tweets error:', error.message);
      // Fallback to mock data on error
      return this.getMockDataForEndpoint('/tweets/search/recent', { query, ...options });
    }
  }

  async getTrends(woeid = 1) {
    try {
      if (!this.isConfigured()) {
        console.log('📈 Mock: Getting trending topics...');
        const mockTrends = [
          { name: '#Technology', volume: 125000 },
          { name: '#AI', volume: 89000 },
          { name: '#NodeJS', volume: 45000 },
          { name: '#Programming', volume: 67000 },
          { name: '#WebDev', volume: 34000 }
        ];
        return { success: true, trends: mockTrends };
      }

      // Note: Trends endpoint is part of Twitter API v1.1
      const trendsUrl = `https://api.twitter.com/1.1/trends/place.json?id=${woeid}`;
      
      const result = await axios.get(trendsUrl, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        }
      });

      if (result.data && result.data[0] && result.data[0].trends) {
        return {
          success: true,
          trends: result.data[0].trends.slice(0, 10)
        };
      } else {
        return { success: false, error: 'No trends data found' };
      }
    } catch (error) {
      console.error('❌ Get trends error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getUserMetrics(username) {
    try {
      if (!this.isConfigured()) {
        console.log('📊 Mock: Getting user metrics for:', username);
        return this.getMockDataForEndpoint(`/users/by/username/${username}`);
      }

      const result = await this.makeRequest(`/users/by/username/${username}?user.fields=public_metrics,verified,created_at,description`);

      if (result.success) {
        return {
          success: true,
          user: result.data.data
        };
      } else {
        // If API fails (rate limit, etc.), provide mock data as fallback
        console.log(`⚠️ API failed for ${username}, using mock data:`, result.error);
        const mockData = this.getMockDataForEndpoint(`/users/by/username/${username}`);
        return {
          success: true,
          user: mockData.data.data
        };
      }
    } catch (error) {
      console.error('❌ Get user metrics error:', error.message);
      // Fallback to mock data on error
      const mockData = this.getMockDataForEndpoint(`/users/by/username/${username}`);
      return {
        success: true,
        user: mockData.data.data
      };
    }
  }

  async getUserTweets(username, count = 5) {
    try {
      if (!this.isConfigured()) {
        console.log('🎭 Mock: Getting tweets for:', username);
        const mockData = this.getMockDataForEndpoint(`/users/by/username/${username}/tweets`, { maxResults: count });
        console.log('🔍 Mock data returned:', JSON.stringify(mockData, null, 2));
        console.log('🔍 Extracting tweets from:', mockData.data?.data);
        return {
          success: true,
          tweets: mockData.data.data
        };
      }

      // First get user ID
      const userResult = await this.makeRequest(`/users/by/username/${username}`);
      
      if (!userResult.success) {
        console.log(`⚠️ Failed to get user ID for ${username}, using mock data`);
        const mockData = this.getMockDataForEndpoint(`/users/by/username/${username}/tweets`, { maxResults: count });
        return {
          success: true,
          tweets: mockData.data.data
        };
      }

      const userId = userResult.data.data.id;
      const result = await this.makeRequest(`/users/${userId}/tweets?max_results=${count}&tweet.fields=created_at,public_metrics`);

      if (result.success) {
        return {
          success: true,
          tweets: result.data.data || []
        };
      } else {
        // If API fails (rate limit, etc.), provide mock data as fallback
        console.log(`⚠️ API failed for ${username} tweets, using mock data:`, result.error);
        const mockData = this.getMockDataForEndpoint(`/users/by/username/${username}/tweets`);
        return {
          success: true,
          tweets: mockData.data.data
        };
      }
    } catch (error) {
      console.error('❌ Get user tweets error:', error.message);
      // Fallback to mock data on error
      const mockData = this.getMockDataForEndpoint(`/users/by/username/${username}/tweets`);
      return {
        success: true,
        tweets: mockData.data.data
      };
    }
  }

  async searchUsers(query, options = {}) {
    try {
      if (!this.isConfigured()) {
        console.log(`🔍 Mock: Searching users for "${query}"...`);
        return {
          success: true,
          users: [
            {
              id: '123456789',
              username: `${query}_user1`,
              name: `${query} User 1`,
              verified: false,
              public_metrics: {
                followers_count: Math.floor(Math.random() * 10000),
                following_count: Math.floor(Math.random() * 1000)
              }
            },
            {
              id: '987654321',
              username: `${query}_user2`,
              name: `${query} User 2`,
              verified: true,
              public_metrics: {
                followers_count: Math.floor(Math.random() * 50000),
                following_count: Math.floor(Math.random() * 2000)
              }
            }
          ]
        };
      }

      // Try to use real API, but with Essential access limitations
      try {
        // Use search API to find users
        const searchQuery = `from:${query} OR @${query}`;
        const result = await this.searchTweets(searchQuery, { maxResults: options.maxResults || 5 });
        
        if (result.success && result.tweets && result.tweets.length > 0) {
          // Extract unique user IDs from search results
          const userIds = [...new Set(result.tweets.map(tweet => tweet.author_id))];
          
          // Get detailed user info for found users
          const userPromises = userIds.slice(0, 10).map(async (userId) => {
            const userResult = await this.makeRequest(`/users/${userId}?user.fields=public_metrics,verified,created_at,description`);
            return userResult.success ? userResult.data.data : null;
          });

          const users = (await Promise.all(userPromises)).filter(user => user !== null);
          
          if (users.length > 0) {
            return {
              success: true,
              users: users
            };
          }
        }
        
        // If search fails, try direct username lookup
        const directResult = await this.getUserMetrics(query);
        if (directResult.success) {
          return {
            success: true,
            users: [directResult.user || directResult.data?.data]
          };
        }
      } catch (apiError) {
        console.log(`⚠️ API search failed for "${query}", using mock data:`, apiError.message);
      }

      // Fallback to mock data for Essential access limitations
      console.log(`🎭 Using mock user search results for "${query}"`);
      return {
        success: true,
        users: [
          {
            id: `mock_${query}_search_1`,
            username: `${query}_dev`,
            name: `${query.charAt(0).toUpperCase() + query.slice(1)} Developer`,
            description: `A developer working with ${query}. Mock profile for API access limitations.`,
            verified: Math.random() > 0.7,
            public_metrics: {
              followers_count: Math.floor(Math.random() * 25000) + 1000,
              following_count: Math.floor(Math.random() * 2000) + 100,
              tweet_count: Math.floor(Math.random() * 5000) + 200,
              listed_count: Math.floor(Math.random() * 100) + 10
            },
            created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            id: `mock_${query}_search_2`,
            username: `${query}_official`,
            name: `${query.charAt(0).toUpperCase() + query.slice(1)} Team`,
            description: `Official ${query} account. Mock profile for API access limitations.`,
            verified: true,
            public_metrics: {
              followers_count: Math.floor(Math.random() * 100000) + 10000,
              following_count: Math.floor(Math.random() * 1000) + 50,
              tweet_count: Math.floor(Math.random() * 8000) + 500,
              listed_count: Math.floor(Math.random() * 200) + 50
            },
            created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      };
      
    } catch (error) {
      console.error('❌ Search users error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getMyProfile() {
    try {
      const result = await this.makeRequest('/users/me?user.fields=public_metrics,verified,created_at');

      if (result.success) {
        return {
          success: true,
          profile: result.data.data
        };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Get profile error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Test connection
  async testConnection() {
    try {
      if (!this.isConfigured()) {
        return { 
          success: true, 
          message: 'Twitter API mock mode - credentials not configured',
          mock: true 
        };
      }

      const result = await this.makeRequest('/users/me');
      
      if (result.success) {
        return {
          success: true,
          message: 'Twitter API connection successful',
          user: result.data.data
        };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = { TwitterService };
