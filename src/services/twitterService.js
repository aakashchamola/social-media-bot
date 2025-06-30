const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

class TwitterService {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.initialize();
  }

  // Initialize Twitter client
  initialize() {
    try {
      if (!this.isConfigured()) {
        console.log('⚠️ Twitter API credentials not configured');
        return;
      }

      this.client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      });

      this.initialized = true;
      console.log('✅ Twitter service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Twitter service:', error);
      this.initialized = false;
    }
  }

  // Check if service is properly configured
  isConfigured() {
    return !!(
      process.env.TWITTER_API_KEY &&
      process.env.TWITTER_API_SECRET &&
      process.env.TWITTER_ACCESS_TOKEN &&
      process.env.TWITTER_ACCESS_TOKEN_SECRET
    );
  }

  // Create a new post/tweet
  async createPost(content, mediaUrls = []) {
    try {
      if (!this.initialized) {
        throw new Error('Twitter service not initialized');
      }

      const tweetOptions = { text: content };

      // Handle media uploads if provided
      if (mediaUrls && mediaUrls.length > 0) {
        const mediaIds = [];
        
        for (const mediaUrl of mediaUrls.slice(0, 4)) { // Twitter allows max 4 images
          try {
            const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
            const mediaData = Buffer.from(mediaResponse.data);
            
            const uploadedMedia = await this.client.v1.uploadMedia(mediaData, { 
              mimeType: mediaResponse.headers['content-type'] 
            });
            mediaIds.push(uploadedMedia);
          } catch (mediaError) {
            console.error('⚠️ Failed to upload media:', mediaError.message);
          }
        }

        if (mediaIds.length > 0) {
          tweetOptions.media = { media_ids: mediaIds };
        }
      }

      const tweet = await this.client.v2.tweet(tweetOptions);

      return {
        success: true,
        postId: tweet.data.id,
        message: 'Tweet posted successfully',
        metadata: {
          tweetId: tweet.data.id,
          text: tweet.data.text,
          postedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error creating Twitter post:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  // Like a post
  async likePost(tweetId) {
    try {
      if (!this.initialized) {
        throw new Error('Twitter service not initialized');
      }

      // Get authenticated user ID
      const me = await this.client.v2.me();
      await this.client.v2.like(me.data.id, tweetId);

      return {
        success: true,
        message: `Liked tweet ${tweetId}`,
        metadata: { tweetId, action: 'like' }
      };
    } catch (error) {
      console.error('❌ Error liking Twitter post:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Retweet a post
  async retweetPost(tweetId) {
    try {
      if (!this.initialized) {
        throw new Error('Twitter service not initialized');
      }

      const me = await this.client.v2.me();
      await this.client.v2.retweet(me.data.id, tweetId);

      return {
        success: true,
        message: `Retweeted ${tweetId}`,
        metadata: { tweetId, action: 'retweet' }
      };
    } catch (error) {
      console.error('❌ Error retweeting:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Reply to a post
  async replyToPost(tweetId, replyText) {
    try {
      if (!this.initialized) {
        throw new Error('Twitter service not initialized');
      }

      const reply = await this.client.v2.reply(replyText, tweetId);

      return {
        success: true,
        message: `Replied to tweet ${tweetId}`,
        metadata: {
          originalTweetId: tweetId,
          replyId: reply.data.id,
          replyText: replyText
        }
      };
    } catch (error) {
      console.error('❌ Error replying to tweet:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Follow a user
  async followUser(username) {
    try {
      if (!this.initialized) {
        throw new Error('Twitter service not initialized');
      }

      // Get user ID from username
      const user = await this.client.v2.userByUsername(username);
      const me = await this.client.v2.me();
      
      await this.client.v2.follow(me.data.id, user.data.id);

      return {
        success: true,
        message: `Followed @${username}`,
        metadata: {
          username: username,
          userId: user.data.id,
          action: 'follow'
        }
      };
    } catch (error) {
      console.error('❌ Error following user:', error);
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
        throw new Error('Twitter service not initialized');
      }

      const {
        maxResults = 10,
        resultType = 'recent',
        lang = 'en'
      } = options;

      const searchResults = await this.client.v2.search(query, {
        max_results: Math.min(maxResults, 100), // Twitter API limit
        'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'context_annotations'],
        'user.fields': ['username', 'name', 'verified', 'public_metrics'],
        expansions: ['author_id']
      });

      const posts = searchResults.data.data || [];
      const users = searchResults.data.includes?.users || [];

      // Process posts
      const processedPosts = posts.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id,
        createdAt: tweet.created_at,
        metrics: tweet.public_metrics,
        url: `https://twitter.com/i/status/${tweet.id}`
      }));

      // Process users
      const processedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.name,
        verified: user.verified,
        followers: user.public_metrics?.followers_count || 0,
        following: user.public_metrics?.following_count || 0,
        postsCount: user.public_metrics?.tweet_count || 0
      }));

      return {
        success: true,
        posts: processedPosts,
        users: processedUsers,
        totalResults: posts.length,
        query: query
      };
    } catch (error) {
      console.error('❌ Error searching Twitter posts:', error);
      return {
        success: false,
        message: error.message,
        posts: [],
        users: []
      };
    }
  }

  // Get trending topics
  async getTrends(woeid = 1) { // 1 = Worldwide
    try {
      if (!this.initialized) {
        throw new Error('Twitter service not initialized');
      }

      // Note: Trends endpoint requires API v1.1
      const trends = await this.client.v1.trendsAvailable();
      
      // For this example, we'll return mock trending data
      // In a real implementation, you'd use the actual trends endpoint
      const mockTrends = [
        { name: '#NodeJS', volume: 125000, rank: 1 },
        { name: '#JavaScript', volume: 98000, rank: 2 },
        { name: '#SocialMedia', volume: 75000, rank: 3 },
        { name: '#API', volume: 52000, rank: 4 },
        { name: '#Automation', volume: 38000, rank: 5 }
      ];

      return {
        success: true,
        trends: mockTrends,
        location: 'Worldwide',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting Twitter trends:', error);
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
        throw new Error('Twitter service not initialized');
      }

      const user = await this.client.v2.userByUsername(username, {
        'user.fields': ['created_at', 'description', 'public_metrics', 'verified', 'profile_image_url']
      });

      return {
        success: true,
        user: {
          id: user.data.id,
          username: user.data.username,
          displayName: user.data.name,
          bio: user.data.description,
          verified: user.data.verified,
          followers: user.data.public_metrics?.followers_count || 0,
          following: user.data.public_metrics?.following_count || 0,
          postsCount: user.data.public_metrics?.tweet_count || 0,
          profileImage: user.data.profile_image_url,
          createdAt: user.data.created_at
        }
      };
    } catch (error) {
      console.error('❌ Error getting user info:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get authenticated user's timeline
  async getTimeline(options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Twitter service not initialized');
      }

      const {
        maxResults = 10,
        excludeReplies = true
      } = options;

      const me = await this.client.v2.me();
      const timeline = await this.client.v2.userTimeline(me.data.id, {
        max_results: Math.min(maxResults, 100),
        exclude: excludeReplies ? ['replies'] : [],
        'tweet.fields': ['created_at', 'public_metrics']
      });

      const posts = timeline.data.data || [];

      return {
        success: true,
        posts: posts.map(tweet => ({
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at,
          metrics: tweet.public_metrics
        })),
        totalResults: posts.length
      };
    } catch (error) {
      console.error('❌ Error getting timeline:', error);
      return {
        success: false,
        message: error.message,
        posts: []
      };
    }
  }

  // Get rate limit status
  async getRateLimitStatus() {
    try {
      if (!this.initialized) {
        return { configured: false };
      }

      // This would return actual rate limit data in a real implementation
      return {
        configured: true,
        limits: {
          search: { remaining: 300, reset: Date.now() + 15 * 60 * 1000 },
          post: { remaining: 100, reset: Date.now() + 24 * 60 * 60 * 1000 },
          like: { remaining: 1000, reset: Date.now() + 24 * 60 * 60 * 1000 }
        }
      };
    } catch (error) {
      console.error('❌ Error getting rate limit status:', error);
      return { configured: false, error: error.message };
    }
  }
}

module.exports = { TwitterService };
