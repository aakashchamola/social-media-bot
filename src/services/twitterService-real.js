const axios = require('axios');

class TwitterService {
  constructor() {
    this.apiKey = process.env.TWITTER_API_KEY;
    this.apiSecret = process.env.TWITTER_API_SECRET;
    this.accessToken = process.env.TWITTER_ACCESS_TOKEN;
    this.accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN;
    
    this.baseURL = 'https://api.twitter.com/2';
    this.rateLimits = {
      tweets: { limit: 300, window: 15 * 60 * 1000 }, // 300 per 15 minutes
      users: { limit: 300, window: 15 * 60 * 1000 },
      likes: { limit: 75, window: 15 * 60 * 1000 }
    };
    
    console.log('✅ Twitter service initialized');
  }

  isConfigured() {
    return !!(this.apiKey && this.apiSecret && this.bearerToken && 
              !this.apiKey.includes('your_') && !this.apiSecret.includes('your_'));
  }

  async makeRequest(endpoint, options = {}) {
    if (!this.isConfigured()) {
      console.log('⚠️  Twitter API: Using mock mode - credentials not configured');
      return this.mockResponse(endpoint, options);
    }

    const config = {
      url: `${this.baseURL}${endpoint}`,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 10000,
      ...options
    };

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
        const mockTweets = Array.from({ length: 5 }, (_, i) => ({
          id: `mock_tweet_${i}`,
          text: `Mock tweet about ${query} - ${i + 1}`,
          author_id: `mock_user_${i}`,
          created_at: new Date().toISOString(),
          public_metrics: {
            like_count: Math.floor(Math.random() * 100),
            retweet_count: Math.floor(Math.random() * 50)
          }
        }));
        return { success: true, tweets: mockTweets, meta: { result_count: 5 } };
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
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Search tweets error:', error.message);
      return { success: false, error: error.message };
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
        return {
          success: true,
          user: {
            id: 'mock_user_123',
            username: username,
            name: `Mock ${username}`,
            public_metrics: {
              followers_count: Math.floor(Math.random() * 10000),
              following_count: Math.floor(Math.random() * 1000),
              tweet_count: Math.floor(Math.random() * 5000)
            }
          }
        };
      }

      const result = await this.makeRequest(`/users/by/username/${username}?user.fields=public_metrics,verified,created_at`);

      if (result.success) {
        return {
          success: true,
          user: result.data.data
        };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Get user metrics error:', error.message);
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

module.exports = TwitterService;
