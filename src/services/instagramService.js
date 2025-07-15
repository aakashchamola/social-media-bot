const axios = require('axios');

class InstagramService {
  constructor() {
    this.baseURL = 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    this.initialized = false;
    this.initialize();
  }

  // Initialize Instagram service
  initialize() {
    try {
      if (!this.isConfigured()) {
        console.log('⚠️ Instagram API credentials not configured');
        return;
      }

      this.initialized = true;
      console.log('✅ Instagram service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Instagram service:', error);
      this.initialized = false;
    }
  }

  // Check if service is properly configured
  isConfigured() {
    return !!(this.accessToken && this.businessAccountId);
  }

  // Create a post (photo or video)
  async createPost(content, mediaUrls = [], options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Instagram service not initialized');
      }

      const { 
        caption = content,
        location_id = null,
        user_tags = []
      } = options;

      let mediaId;

      if (mediaUrls && mediaUrls.length > 0) {
        // Upload media first
        const mediaUrl = mediaUrls[0]; // Instagram supports one media per post
        const isVideo = this.isVideoUrl(mediaUrl);
        
        const mediaResponse = await axios.post(
          `${this.baseURL}/${this.businessAccountId}/media`,
          {
            image_url: !isVideo ? mediaUrl : undefined,
            video_url: isVideo ? mediaUrl : undefined,
            caption: caption,
            location_id: location_id,
            user_tags: user_tags.length > 0 ? JSON.stringify(user_tags) : undefined,
            access_token: this.accessToken
          }
        );

        mediaId = mediaResponse.data.id;
      } else {
        // Text-only posts are not supported on Instagram
        throw new Error('Instagram requires at least one image or video');
      }

      // Publish the media
      const publishResponse = await axios.post(
        `${this.baseURL}/${this.businessAccountId}/media_publish`,
        {
          creation_id: mediaId,
          access_token: this.accessToken
        }
      );

      return {
        success: true,
        postId: publishResponse.data.id,
        message: 'Instagram post published successfully',
        metadata: {
          mediaId: mediaId,
          postId: publishResponse.data.id,
          caption: caption,
          postedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error creating Instagram post:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        error: error
      };
    }
  }

  // Like a post
  async likePost(mediaId) {
    try {
      if (!this.initialized) {
        throw new Error('Instagram service not initialized');
      }

      await axios.post(
        `${this.baseURL}/${mediaId}/likes`,
        {
          access_token: this.accessToken
        }
      );

      return {
        success: true,
        message: `Liked Instagram post ${mediaId}`,
        metadata: { mediaId, action: 'like' }
      };
    } catch (error) {
      console.error('❌ Error liking Instagram post:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Comment on a post
  async commentOnPost(mediaId, commentText) {
    try {
      if (!this.initialized) {
        throw new Error('Instagram service not initialized');
      }

      const response = await axios.post(
        `${this.baseURL}/${mediaId}/comments`,
        {
          message: commentText,
          access_token: this.accessToken
        }
      );

      return {
        success: true,
        message: `Commented on Instagram post ${mediaId}`,
        metadata: {
          mediaId: mediaId,
          commentId: response.data.id,
          commentText: commentText
        }
      };
    } catch (error) {
      console.error('❌ Error commenting on Instagram post:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Follow a user (requires additional permissions)
  async followUser(userId) {
    try {
      if (!this.initialized) {
        throw new Error('Instagram service not initialized');
      }

      // Note: Following users requires additional app review and permissions
      console.log('⚠️ Following users requires additional Instagram permissions');
      
      return {
        success: false,
        message: 'Following users requires additional Instagram API permissions'
      };
    } catch (error) {
      console.error('❌ Error following Instagram user:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Search for posts using hashtags
  async searchPosts(hashtag, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Instagram service not initialized');
      }

      const {
        maxResults = 10,
        fields = 'id,caption,media_type,media_url,permalink,timestamp'
      } = options;

      // Search for hashtag
      const hashtagResponse = await axios.get(
        `${this.baseURL}/ig_hashtag_search`,
        {
          params: {
            user_id: this.businessAccountId,
            q: hashtag,
            access_token: this.accessToken
          }
        }
      );

      if (!hashtagResponse.data.data || hashtagResponse.data.data.length === 0) {
        return {
          success: true,
          posts: [],
          totalResults: 0,
          hashtag: hashtag
        };
      }

      const hashtagId = hashtagResponse.data.data[0].id;

      // Get recent media for hashtag
      const mediaResponse = await axios.get(
        `${this.baseURL}/${hashtagId}/recent_media`,
        {
          params: {
            user_id: this.businessAccountId,
            fields: fields,
            limit: Math.min(maxResults, 25), // Instagram API limit
            access_token: this.accessToken
          }
        }
      );

      const posts = mediaResponse.data.data || [];

      return {
        success: true,
        posts: posts.map(post => ({
          id: post.id,
          caption: post.caption || '',
          mediaType: post.media_type,
          mediaUrl: post.media_url,
          permalink: post.permalink,
          timestamp: post.timestamp
        })),
        totalResults: posts.length,
        hashtag: hashtag
      };
    } catch (error) {
      console.error('❌ Error searching Instagram posts:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        posts: []
      };
    }
  }

  // Get account information
  async getAccountInfo() {
    try {
      if (!this.initialized) {
        throw new Error('Instagram service not initialized');
      }

      const response = await axios.get(
        `${this.baseURL}/${this.businessAccountId}`,
        {
          params: {
            fields: 'id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url',
            access_token: this.accessToken
          }
        }
      );

      return {
        success: true,
        account: {
          id: response.data.id,
          username: response.data.username,
          name: response.data.name,
          bio: response.data.biography,
          website: response.data.website,
          followers: response.data.followers_count,
          following: response.data.follows_count,
          postsCount: response.data.media_count,
          profilePicture: response.data.profile_picture_url
        }
      };
    } catch (error) {
      console.error('❌ Error getting Instagram account info:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Get account media
  async getAccountMedia(options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Instagram service not initialized');
      }

      const {
        maxResults = 10,
        fields = 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count'
      } = options;

      const response = await axios.get(
        `${this.baseURL}/${this.businessAccountId}/media`,
        {
          params: {
            fields: fields,
            limit: Math.min(maxResults, 25),
            access_token: this.accessToken
          }
        }
      );

      const posts = response.data.data || [];

      return {
        success: true,
        posts: posts.map(post => ({
          id: post.id,
          caption: post.caption || '',
          mediaType: post.media_type,
          mediaUrl: post.media_url,
          permalink: post.permalink,
          timestamp: post.timestamp,
          likes: post.like_count || 0,
          comments: post.comments_count || 0
        })),
        totalResults: posts.length
      };
    } catch (error) {
      console.error('❌ Error getting Instagram media:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        posts: []
      };
    }
  }

  // Get insights/analytics
  async getInsights(options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Instagram service not initialized');
      }

      const {
        period = 'day',
        metrics = ['impressions', 'reach', 'profile_views']
      } = options;

      const response = await axios.get(
        `${this.baseURL}/${this.businessAccountId}/insights`,
        {
          params: {
            metric: metrics.join(','),
            period: period,
            access_token: this.accessToken
          }
        }
      );

      return {
        success: true,
        insights: response.data.data || [],
        period: period,
        metrics: metrics
      };
    } catch (error) {
      console.error('❌ Error getting Instagram insights:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        insights: []
      };
    }
  }

  // Helper method to check if URL is a video
  isVideoUrl(url) {
    const videoExtensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  // Get rate limit status
  async getRateLimitStatus() {
    try {
      if (!this.initialized) {
        return { configured: false };
      }

      // Instagram Graph API has different rate limits based on app usage
      return {
        configured: true,
        limits: {
          posts: { remaining: 25, reset: Date.now() + 24 * 60 * 60 * 1000 },
          api_calls: { remaining: 200, reset: Date.now() + 60 * 60 * 1000 }
        }
      };
    } catch (error) {
      console.error('❌ Error getting Instagram rate limit status:', error);
      return { configured: false, error: error.message };
    }
  }
}

module.exports = { InstagramService };
