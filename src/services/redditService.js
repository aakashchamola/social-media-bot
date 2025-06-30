const axios = require('axios');

class RedditService {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.initialized = false;
    this.baseURL = 'https://oauth.reddit.com';
    this.authURL = 'https://www.reddit.com/api/v1/access_token';
    
    if (this.isConfigured()) {
      this.initialize();
    }
  }

  // Check if service is properly configured
  isConfigured() {
    return !!(
      process.env.REDDIT_CLIENT_ID &&
      process.env.REDDIT_CLIENT_SECRET &&
      process.env.REDDIT_USERNAME &&
      process.env.REDDIT_PASSWORD &&
      process.env.REDDIT_USER_AGENT
    );
  }

  // Initialize Reddit authentication
  async initialize() {
    try {
      if (!this.isConfigured()) {
        console.log('⚠️ Reddit API credentials not configured');
        return;
      }

      await this.authenticate();
      this.initialized = true;
      console.log('✅ Reddit service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Reddit service:', error);
      this.initialized = false;
    }
  }

  // Authenticate with Reddit API
  async authenticate() {
    try {
      const auth = Buffer.from(
        `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
      ).toString('base64');

      const response = await axios.post(this.authURL, 
        new URLSearchParams({
          grant_type: 'password',
          username: process.env.REDDIT_USERNAME,
          password: process.env.REDDIT_PASSWORD
        }), {
          headers: {
            'Authorization': `Basic ${auth}`,
            'User-Agent': process.env.REDDIT_USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      
      console.log('🔑 Reddit authentication successful');
    } catch (error) {
      console.error('❌ Reddit authentication failed:', error);
      throw error;
    }
  }

  // Check if token needs refresh
  async ensureAuthenticated() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticate();
    }
  }

  // Make authenticated request to Reddit API
  async makeRequest(endpoint, method = 'GET', data = null) {
    await this.ensureAuthenticated();

    const config = {
      method: method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': process.env.REDDIT_USER_AGENT,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    return await axios(config);
  }

  // Create a new post
  async createPost(title, text = '', subreddit = 'test') {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const postData = {
        sr: subreddit,
        kind: 'self',
        title: title,
        text: text,
        api_type: 'json'
      };

      const response = await this.makeRequest('/api/submit', 'POST', postData);

      if (response.data.json.errors && response.data.json.errors.length > 0) {
        throw new Error(response.data.json.errors[0][1]);
      }

      const postId = response.data.json.data.name;
      const postUrl = response.data.json.data.url;

      return {
        success: true,
        postId: postId,
        url: postUrl,
        message: `Post created in r/${subreddit}`,
        metadata: {
          subreddit: subreddit,
          title: title,
          postId: postId,
          url: postUrl,
          postedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error creating Reddit post:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  // Upvote a post
  async upvotePost(postId) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const voteData = {
        id: postId,
        dir: 1, // 1 for upvote, -1 for downvote, 0 for no vote
        api_type: 'json'
      };

      await this.makeRequest('/api/vote', 'POST', voteData);

      return {
        success: true,
        message: `Upvoted post ${postId}`,
        metadata: { postId, action: 'upvote' }
      };
    } catch (error) {
      console.error('❌ Error upvoting Reddit post:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Comment on a post
  async commentOnPost(postId, commentText) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const commentData = {
        thing_id: postId,
        text: commentText,
        api_type: 'json'
      };

      const response = await this.makeRequest('/api/comment', 'POST', commentData);

      if (response.data.json.errors && response.data.json.errors.length > 0) {
        throw new Error(response.data.json.errors[0][1]);
      }

      const commentId = response.data.json.data.things[0].data.name;

      return {
        success: true,
        message: `Commented on post ${postId}`,
        metadata: {
          postId: postId,
          commentId: commentId,
          commentText: commentText,
          action: 'comment'
        }
      };
    } catch (error) {
      console.error('❌ Error commenting on Reddit post:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Follow a user (friend them)
  async followUser(username) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const friendData = {
        name: username,
        api_type: 'json'
      };

      await this.makeRequest('/api/friend', 'POST', friendData);

      return {
        success: true,
        message: `Followed user u/${username}`,
        metadata: {
          username: username,
          action: 'follow'
        }
      };
    } catch (error) {
      console.error('❌ Error following Reddit user:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Search for posts
  async searchPosts(query, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const {
        subreddit = null,
        sort = 'relevance',
        time = 'all',
        limit = 10
      } = options;

      let endpoint = '/search';
      if (subreddit) {
        endpoint = `/r/${subreddit}/search`;
      }

      const params = new URLSearchParams({
        q: query,
        sort: sort,
        t: time,
        limit: Math.min(limit, 100), // Reddit limit
        type: 'link',
        raw_json: 1
      });

      if (subreddit) {
        params.append('restrict_sr', 'true');
      }

      const response = await this.makeRequest(`${endpoint}?${params}`);
      const posts = response.data.data.children || [];

      // Process posts
      const processedPosts = posts.map(post => ({
        id: post.data.name,
        title: post.data.title,
        text: post.data.selftext,
        author: post.data.author,
        subreddit: post.data.subreddit,
        score: post.data.score,
        upvoteRatio: post.data.upvote_ratio,
        numComments: post.data.num_comments,
        createdAt: new Date(post.data.created_utc * 1000).toISOString(),
        url: `https://reddit.com${post.data.permalink}`
      }));

      // Extract unique users
      const users = [...new Set(posts.map(post => post.data.author))]
        .filter(author => author && author !== '[deleted]')
        .map(author => ({
          id: author,
          username: author,
          displayName: author,
          platform: 'reddit'
        }));

      return {
        success: true,
        posts: processedPosts,
        users: users,
        totalResults: posts.length,
        query: query
      };
    } catch (error) {
      console.error('❌ Error searching Reddit posts:', error);
      return {
        success: false,
        message: error.message,
        posts: [],
        users: []
      };
    }
  }

  // Get trending posts from popular subreddits
  async getTrends() {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      // Get hot posts from r/all
      const response = await this.makeRequest('/r/all/hot?limit=25');
      const posts = response.data.data.children || [];

      // Extract trending topics/subreddits
      const subredditCounts = {};
      const topPosts = [];

      posts.forEach(post => {
        const subreddit = post.data.subreddit;
        subredditCounts[subreddit] = (subredditCounts[subreddit] || 0) + 1;
        
        if (topPosts.length < 10) {
          topPosts.push({
            title: post.data.title,
            subreddit: subreddit,
            score: post.data.score,
            comments: post.data.num_comments,
            url: `https://reddit.com${post.data.permalink}`
          });
        }
      });

      // Get top trending subreddits
      const trendingSubreddits = Object.entries(subredditCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([subreddit, count]) => ({
          name: `r/${subreddit}`,
          posts: count,
          rank: Object.keys(subredditCounts).indexOf(subreddit) + 1
        }));

      return {
        success: true,
        trends: trendingSubreddits,
        topPosts: topPosts,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting Reddit trends:', error);
      return {
        success: false,
        message: error.message,
        trends: []
      };
    }
  }

  // Get user information
  async getUserInfo(username) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const response = await this.makeRequest(`/user/${username}/about`);
      const userData = response.data.data;

      return {
        success: true,
        user: {
          id: userData.name,
          username: userData.name,
          displayName: userData.name,
          karma: {
            comment: userData.comment_karma,
            link: userData.link_karma,
            total: userData.total_karma
          },
          verified: userData.verified,
          created: new Date(userData.created_utc * 1000).toISOString(),
          isGold: userData.is_gold,
          isMod: userData.is_mod
        }
      };
    } catch (error) {
      console.error('❌ Error getting Reddit user info:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get posts from specific subreddit
  async getSubredditPosts(subreddit, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const {
        sort = 'hot',
        time = 'day',
        limit = 25
      } = options;

      let endpoint = `/r/${subreddit}/${sort}`;
      const params = new URLSearchParams({
        limit: Math.min(limit, 100),
        raw_json: 1
      });

      if (sort === 'top') {
        params.append('t', time);
      }

      const response = await this.makeRequest(`${endpoint}?${params}`);
      const posts = response.data.data.children || [];

      return {
        success: true,
        posts: posts.map(post => ({
          id: post.data.name,
          title: post.data.title,
          text: post.data.selftext,
          author: post.data.author,
          score: post.data.score,
          upvoteRatio: post.data.upvote_ratio,
          numComments: post.data.num_comments,
          createdAt: new Date(post.data.created_utc * 1000).toISOString(),
          url: `https://reddit.com${post.data.permalink}`
        })),
        subreddit: subreddit,
        totalResults: posts.length
      };
    } catch (error) {
      console.error('❌ Error getting subreddit posts:', error);
      return {
        success: false,
        message: error.message,
        posts: []
      };
    }
  }

  // Get rate limit status
  getRateLimitStatus() {
    return {
      configured: this.isConfigured(),
      authenticated: this.initialized,
      tokenExpiry: this.tokenExpiry,
      limits: {
        requests: { remaining: 60, reset: Date.now() + 60 * 1000 }, // Reddit allows 60 requests per minute
        posts: { remaining: 10, reset: Date.now() + 60 * 1000 }
      }
    };
  }
}

module.exports = { RedditService };
