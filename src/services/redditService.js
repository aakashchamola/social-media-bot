const snoowrap = require('snoowrap');

class RedditService {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.initialize();
  }

  // Check if service is properly configured
  isConfigured() {
    return !!(
      process.env.REDDIT_CLIENT_ID &&
      process.env.REDDIT_CLIENT_SECRET &&
      process.env.REDDIT_USERNAME &&
      process.env.REDDIT_PASSWORD
    );
  }

  // Initialize Reddit client
  initialize() {
    try {
      if (!this.isConfigured()) {
        console.log('⚠️ Reddit API credentials not configured');
        return;
      }

      this.client = new snoowrap({
        userAgent: process.env.REDDIT_USER_AGENT || 'social-media-bot/1.0.0',
        clientId: process.env.REDDIT_CLIENT_ID,
        clientSecret: process.env.REDDIT_CLIENT_SECRET,
        username: process.env.REDDIT_USERNAME,
        password: process.env.REDDIT_PASSWORD
      });

      this.initialized = true;
      console.log('✅ Reddit service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Reddit service:', error);
      this.initialized = false;
    }
  }

  // Create a new post (submission)
  async createPost(title, content, subreddit, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const { url = null, kind = 'text' } = options;

      let submission;
      
      if (url && kind === 'link') {
        // Submit a link
        submission = await this.client.getSubreddit(subreddit).submitLink({
          title: title,
          url: url
        });
      } else {
        // Submit a text post
        submission = await this.client.getSubreddit(subreddit).submitSelfpost({
          title: title,
          text: content
        });
      }

      return {
        success: true,
        postId: submission.id,
        message: `Posted to r/${subreddit} successfully`,
        metadata: {
          postId: submission.id,
          permalink: submission.permalink,
          subreddit: subreddit,
          title: title,
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
  async likePost(postId) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const submission = await this.client.getSubmission(postId);
      await submission.upvote();

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

      const submission = await this.client.getSubmission(postId);
      const comment = await submission.reply(commentText);

      return {
        success: true,
        message: `Commented on post ${postId}`,
        metadata: {
          postId: postId,
          commentId: comment.id,
          commentText: commentText
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

      const user = await this.client.getUser(username);
      await user.friend();

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

  // Search for posts in a subreddit
  async searchPosts(query, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const {
        subreddit = 'all',
        maxResults = 10,
        sort = 'relevance',
        time = 'all'
      } = options;

      const searchResults = await this.client.getSubreddit(subreddit).search({
        query: query,
        sort: sort,
        time: time,
        limit: Math.min(maxResults, 100)
      });

      const posts = await searchResults.map(post => ({
        id: post.id,
        title: post.title,
        selftext: post.selftext,
        author: post.author.name,
        subreddit: post.subreddit.display_name,
        score: post.score,
        upvoteRatio: post.upvote_ratio,
        numComments: post.num_comments,
        createdUtc: post.created_utc,
        url: post.url,
        permalink: post.permalink
      }));

      return {
        success: true,
        posts: posts,
        totalResults: posts.length,
        query: query,
        subreddit: subreddit
      };
    } catch (error) {
      console.error('❌ Error searching Reddit posts:', error);
      return {
        success: false,
        message: error.message,
        posts: []
      };
    }
  }

  // Get hot posts from a subreddit
  async getHotPosts(subreddit = 'all', options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const { maxResults = 10 } = options;

      const hotPosts = await this.client.getSubreddit(subreddit).getHot({
        limit: Math.min(maxResults, 100)
      });

      const posts = await hotPosts.map(post => ({
        id: post.id,
        title: post.title,
        selftext: post.selftext,
        author: post.author.name,
        subreddit: post.subreddit.display_name,
        score: post.score,
        upvoteRatio: post.upvote_ratio,
        numComments: post.num_comments,
        createdUtc: post.created_utc,
        url: post.url,
        permalink: post.permalink
      }));

      return {
        success: true,
        posts: posts,
        totalResults: posts.length,
        subreddit: subreddit
      };
    } catch (error) {
      console.error('❌ Error getting hot Reddit posts:', error);
      return {
        success: false,
        message: error.message,
        posts: []
      };
    }
  }

  // Get trending subreddits
  async getTrendingSubreddits() {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const trending = await this.client.getTrendingSubreddits();
      
      return {
        success: true,
        subreddits: trending,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting trending subreddits:', error);
      return {
        success: false,
        message: error.message,
        subreddits: []
      };
    }
  }

  // Get user information
  async getUserInfo(username) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const user = await this.client.getUser(username);
      
      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          created: user.created_utc,
          linkKarma: user.link_karma,
          commentKarma: user.comment_karma,
          isGold: user.is_gold,
          isMod: user.is_mod,
          verified: user.has_verified_email
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

  // Get subreddit information
  async getSubredditInfo(subredditName) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const subreddit = await this.client.getSubreddit(subredditName);
      
      return {
        success: true,
        subreddit: {
          id: subreddit.id,
          name: subreddit.display_name,
          title: subreddit.title,
          description: subreddit.public_description,
          subscribers: subreddit.subscribers,
          created: subreddit.created_utc,
          nsfw: subreddit.over18,
          language: subreddit.lang
        }
      };
    } catch (error) {
      console.error('❌ Error getting subreddit info:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Get user's posts
  async getUserPosts(username, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Reddit service not initialized');
      }

      const { maxResults = 10, sort = 'new' } = options;

      const user = await this.client.getUser(username);
      const userPosts = await user.getSubmissions({
        sort: sort,
        limit: Math.min(maxResults, 100)
      });

      const posts = await userPosts.map(post => ({
        id: post.id,
        title: post.title,
        selftext: post.selftext,
        subreddit: post.subreddit.display_name,
        score: post.score,
        numComments: post.num_comments,
        createdUtc: post.created_utc,
        url: post.url,
        permalink: post.permalink
      }));

      return {
        success: true,
        posts: posts,
        totalResults: posts.length,
        username: username
      };
    } catch (error) {
      console.error('❌ Error getting user posts:', error);
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

      // Reddit has rate limits but snoowrap handles them automatically
      return {
        configured: true,
        limits: {
          requests: { remaining: 60, reset: Date.now() + 60 * 1000 },
          posts: { remaining: 5, reset: Date.now() + 10 * 60 * 1000 }
        }
      };
    } catch (error) {
      console.error('❌ Error getting Reddit rate limit status:', error);
      return { configured: false, error: error.message };
    }
  }
}

module.exports = { RedditService };
