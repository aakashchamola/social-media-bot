const axios = require('axios');

class FacebookService {
  constructor() {
    this.baseURL = 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    this.pageId = process.env.FACEBOOK_PAGE_ID;
    this.initialized = false;
    this.initialize();
  }

  // Initialize Facebook service
  initialize() {
    try {
      if (!this.isConfigured()) {
        console.log('⚠️ Facebook API credentials not configured');
        return;
      }

      this.initialized = true;
      console.log('✅ Facebook service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Facebook service:', error);
      this.initialized = false;
    }
  }

  // Check if service is properly configured
  isConfigured() {
    return !!(this.accessToken && this.pageId);
  }

  // Create a post on Facebook Page
  async createPost(content, mediaUrls = [], options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Facebook service not initialized');
      }

      const {
        link = null,
        scheduled_publish_time = null,
        published = true
      } = options;

      const postData = {
        message: content,
        access_token: this.accessToken
      };

      // Add link if provided
      if (link) {
        postData.link = link;
      }

      // Handle media uploads
      if (mediaUrls && mediaUrls.length > 0) {
        // For single image
        if (mediaUrls.length === 1) {
          postData.url = mediaUrls[0];
          
          // Post to photos endpoint for single image
          const response = await axios.post(
            `${this.baseURL}/${this.pageId}/photos`,
            postData
          );

          return {
            success: true,
            postId: response.data.id,
            message: 'Facebook photo post created successfully',
            metadata: {
              postId: response.data.id,
              type: 'photo',
              content: content,
              postedAt: new Date().toISOString()
            }
          };
        } else {
          // For multiple images, need to create album first
          return await this.createMultiImagePost(content, mediaUrls, options);
        }
      }

      // Text-only post or post with link
      const response = await axios.post(
        `${this.baseURL}/${this.pageId}/feed`,
        postData
      );

      return {
        success: true,
        postId: response.data.id,
        message: 'Facebook post created successfully',
        metadata: {
          postId: response.data.id,
          type: 'text',
          content: content,
          postedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error creating Facebook post:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        error: error
      };
    }
  }

  // Create multi-image post
  async createMultiImagePost(content, mediaUrls, options = {}) {
    try {
      // Upload images first
      const uploadedPhotos = [];
      
      for (const mediaUrl of mediaUrls.slice(0, 10)) { // Facebook allows max 10 images
        try {
          const photoResponse = await axios.post(
            `${this.baseURL}/${this.pageId}/photos`,
            {
              url: mediaUrl,
              published: false, // Don't publish immediately
              access_token: this.accessToken
            }
          );
          uploadedPhotos.push({ media_fbid: photoResponse.data.id });
        } catch (uploadError) {
          console.error('⚠️ Failed to upload photo:', uploadError.message);
        }
      }

      if (uploadedPhotos.length === 0) {
        throw new Error('No photos were successfully uploaded');
      }

      // Create the multi-photo post
      const response = await axios.post(
        `${this.baseURL}/${this.pageId}/feed`,
        {
          message: content,
          attached_media: JSON.stringify(uploadedPhotos),
          access_token: this.accessToken
        }
      );

      return {
        success: true,
        postId: response.data.id,
        message: 'Facebook multi-photo post created successfully',
        metadata: {
          postId: response.data.id,
          type: 'multi_photo',
          content: content,
          photoCount: uploadedPhotos.length,
          postedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error creating multi-image Facebook post:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Like a post
  async likePost(postId) {
    try {
      if (!this.initialized) {
        throw new Error('Facebook service not initialized');
      }

      await axios.post(
        `${this.baseURL}/${postId}/likes`,
        {
          access_token: this.accessToken
        }
      );

      return {
        success: true,
        message: `Liked Facebook post ${postId}`,
        metadata: { postId, action: 'like' }
      };
    } catch (error) {
      console.error('❌ Error liking Facebook post:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Comment on a post
  async commentOnPost(postId, commentText) {
    try {
      if (!this.initialized) {
        throw new Error('Facebook service not initialized');
      }

      const response = await axios.post(
        `${this.baseURL}/${postId}/comments`,
        {
          message: commentText,
          access_token: this.accessToken
        }
      );

      return {
        success: true,
        message: `Commented on Facebook post ${postId}`,
        metadata: {
          postId: postId,
          commentId: response.data.id,
          commentText: commentText
        }
      };
    } catch (error) {
      console.error('❌ Error commenting on Facebook post:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Search for posts (limited by Facebook API)
  async searchPosts(query, options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Facebook service not initialized');
      }

      // Note: Facebook severely limits post search capabilities
      // This is mostly for demonstration - real search is very limited
      console.log('⚠️ Facebook post search is limited by API restrictions');

      return {
        success: true,
        posts: [],
        message: 'Facebook post search is limited by API restrictions',
        totalResults: 0,
        query: query
      };
    } catch (error) {
      console.error('❌ Error searching Facebook posts:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        posts: []
      };
    }
  }

  // Get page information
  async getPageInfo() {
    try {
      if (!this.initialized) {
        throw new Error('Facebook service not initialized');
      }

      const response = await axios.get(
        `${this.baseURL}/${this.pageId}`,
        {
          params: {
            fields: 'id,name,about,category,fan_count,followers_count,link,picture,cover,website',
            access_token: this.accessToken
          }
        }
      );

      return {
        success: true,
        page: {
          id: response.data.id,
          name: response.data.name,
          about: response.data.about,
          category: response.data.category,
          likes: response.data.fan_count || 0,
          followers: response.data.followers_count || 0,
          link: response.data.link,
          profilePicture: response.data.picture?.data?.url,
          coverPhoto: response.data.cover?.source,
          website: response.data.website
        }
      };
    } catch (error) {
      console.error('❌ Error getting Facebook page info:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Get page posts
  async getPagePosts(options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Facebook service not initialized');
      }

      const {
        maxResults = 10,
        fields = 'id,message,created_time,likes.summary(true),comments.summary(true),shares'
      } = options;

      const response = await axios.get(
        `${this.baseURL}/${this.pageId}/posts`,
        {
          params: {
            fields: fields,
            limit: Math.min(maxResults, 100),
            access_token: this.accessToken
          }
        }
      );

      const posts = response.data.data || [];

      return {
        success: true,
        posts: posts.map(post => ({
          id: post.id,
          message: post.message || '',
          createdTime: post.created_time,
          likes: post.likes?.summary?.total_count || 0,
          comments: post.comments?.summary?.total_count || 0,
          shares: post.shares?.count || 0
        })),
        totalResults: posts.length
      };
    } catch (error) {
      console.error('❌ Error getting Facebook page posts:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        posts: []
      };
    }
  }

  // Get page insights/analytics
  async getPageInsights(options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Facebook service not initialized');
      }

      const {
        period = 'day',
        metrics = ['page_impressions', 'page_reach', 'page_fans']
      } = options;

      const response = await axios.get(
        `${this.baseURL}/${this.pageId}/insights`,
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
      console.error('❌ Error getting Facebook page insights:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message,
        insights: []
      };
    }
  }

  // Schedule a post
  async schedulePost(content, scheduledTime, mediaUrls = [], options = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Facebook service not initialized');
      }

      const scheduledTimestamp = Math.floor(new Date(scheduledTime).getTime() / 1000);
      
      // Check if scheduled time is at least 10 minutes in the future
      const minScheduleTime = Math.floor(Date.now() / 1000) + (10 * 60);
      if (scheduledTimestamp < minScheduleTime) {
        throw new Error('Scheduled time must be at least 10 minutes in the future');
      }

      const postData = {
        message: content,
        scheduled_publish_time: scheduledTimestamp,
        published: false,
        access_token: this.accessToken
      };

      // Handle media if provided
      if (mediaUrls && mediaUrls.length > 0) {
        postData.url = mediaUrls[0]; // For single image
      }

      const endpoint = mediaUrls && mediaUrls.length > 0 
        ? `${this.baseURL}/${this.pageId}/photos`
        : `${this.baseURL}/${this.pageId}/feed`;

      const response = await axios.post(endpoint, postData);

      return {
        success: true,
        postId: response.data.id,
        message: 'Facebook post scheduled successfully',
        metadata: {
          postId: response.data.id,
          scheduledTime: scheduledTime,
          content: content,
          scheduled: true
        }
      };
    } catch (error) {
      console.error('❌ Error scheduling Facebook post:', error);
      return {
        success: false,
        message: error.response?.data?.error?.message || error.message
      };
    }
  }

  // Get rate limit status
  async getRateLimitStatus() {
    try {
      if (!this.initialized) {
        return { configured: false };
      }

      // Facebook has different rate limits based on app and page usage
      return {
        configured: true,
        limits: {
          posts: { remaining: 200, reset: Date.now() + 60 * 60 * 1000 },
          api_calls: { remaining: 4800, reset: Date.now() + 60 * 60 * 1000 }
        }
      };
    } catch (error) {
      console.error('❌ Error getting Facebook rate limit status:', error);
      return { configured: false, error: error.message };
    }
  }
}

module.exports = { FacebookService };
