const Task = require('../models/Task');
const User = require('../models/User');
const { TwitterService } = require('../services/twitterService');

class InteractionController {
  constructor() {
    this.twitterService = new TwitterService();
    this.rateLimits = new Map();
  }

  // Execute a specific task
  async executeTask(task) {
    try {
      console.log(`🎯 Executing ${task.type} task on ${task.platform}: ${task.target}`);
      
      // Check rate limits
      if (!this.checkRateLimit(task.platform)) {
        await task.markFailed(new Error('Rate limit exceeded'));
        return false;
      }

      let result;
      
      switch (task.platform) {
        case 'twitter':
          result = await this.executeTwitterTask(task);
          break;
        case 'instagram':
          result = await this.executeInstagramTask(task);
          break;
        case 'facebook':
          result = await this.executeFacebookTask(task);
          break;
        default:
          throw new Error(`Unsupported platform: ${task.platform}`);
      }

      if (result.success) {
        await task.markCompleted(result);
        await this.updateUserInteraction(task, result);
        console.log(`✅ Task completed: ${task.type} on ${task.platform}`);
      } else {
        await task.markFailed(new Error(result.message));
        console.log(`❌ Task failed: ${task.type} on ${task.platform} - ${result.message}`);
      }

      this.updateRateLimit(task.platform);
      return result.success;

    } catch (error) {
      console.error(`❌ Error executing task:`, error);
      await task.markFailed(error);
      return false;
    }
  }

  // Execute Twitter-specific tasks
  async executeTwitterTask(task) {
    if (!this.twitterService.isConfigured()) {
      return { success: false, message: 'Twitter service not configured' };
    }

    try {
      switch (task.type) {
        case 'like':
          return await this.twitterService.likePost(task.target);
          
        case 'retweet':
          return await this.twitterService.retweetPost(task.target);
          
        case 'comment':
          return await this.twitterService.replyToPost(task.target, task.action);
          
        case 'follow':
          return await this.twitterService.followUser(task.target);
          
        case 'scrape':
          return await this.scrapeTwitterData(task);
          
        default:
          return { success: false, message: `Unsupported Twitter task: ${task.type}` };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Execute Instagram-specific tasks
  async executeInstagramTask(task) {
    const { InstagramService } = require('../services/instagramService');
    const instagramService = new InstagramService();
    
    if (!instagramService.isConfigured()) {
      return { success: false, message: 'Instagram service not configured' };
    }

    try {
      switch (task.type) {
        case 'like':
          return await instagramService.likePost(task.target);
          
        case 'comment':
          return await instagramService.commentOnPost(task.target, task.action);
          
        case 'follow':
          return await instagramService.followUser(task.target);
          
        case 'scrape':
          return await this.scrapeInstagramData(task);
          
        default:
          return { success: false, message: `Unsupported Instagram task: ${task.type}` };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Execute Facebook-specific tasks
  async executeFacebookTask(task) {
    const { FacebookService } = require('../services/facebookService');
    const facebookService = new FacebookService();
    
    if (!facebookService.isConfigured()) {
      return { success: false, message: 'Facebook service not configured' };
    }

    try {
      switch (task.type) {
        case 'like':
          return await facebookService.likePost(task.target);
          
        case 'comment':
          return await facebookService.commentOnPost(task.target, task.action);
          
        case 'scrape':
          return await this.scrapeFacebookData(task);
          
        default:
          return { success: false, message: `Unsupported Facebook task: ${task.type}` };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Scrape Twitter data
  async scrapeTwitterData(task) {
    try {
      const { filters, limits } = task.metadata || {};
      const data = await this.twitterService.searchPosts(task.target, {
        maxResults: limits?.maxResults || 10,
        ...filters
      });

      // Save scraped users
      if (data.users && data.users.length > 0) {
        await this.saveScrapedUsers(data.users, 'twitter');
      }

      return {
        success: true,
        message: `Scraped ${data.posts?.length || 0} posts and ${data.users?.length || 0} users`,
        data: data
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Scrape Instagram data
  async scrapeInstagramData(task) {
    try {
      const { InstagramService } = require('../services/instagramService');
      const instagramService = new InstagramService();
      
      const { filters, limits } = task.metadata || {};
      const data = await instagramService.searchPosts(task.target, {
        maxResults: limits?.maxResults || 10,
        ...filters
      });

      // Save scraped users
      if (data.users && data.users.length > 0) {
        await this.saveScrapedUsers(data.users, 'instagram');
      }

      return {
        success: true,
        message: `Scraped ${data.posts?.length || 0} posts`,
        data: data
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Scrape Facebook data
  async scrapeFacebookData(task) {
    try {
      const { FacebookService } = require('../services/facebookService');
      const facebookService = new FacebookService();
      
      const { filters, limits } = task.metadata || {};
      const data = await facebookService.searchPosts(task.target, {
        limit: limits?.maxResults || 10,
        ...filters
      });

      return {
        success: true,
        message: `Scraped ${data.posts?.length || 0} posts`,
        data: data
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // Save scraped users to database
  async saveScrapedUsers(users, platform) {
    try {
      for (const userData of users) {
        await User.findOneAndUpdate(
          { platform: platform, userId: userData.id },
          {
            username: userData.username,
            displayName: userData.displayName,
            bio: userData.bio,
            profileImage: userData.profileImage,
            followers: userData.followers,
            following: userData.following,
            postsCount: userData.postsCount,
            verified: userData.verified,
            platform: platform,
            userId: userData.id
          },
          { upsert: true, new: true }
        );
      }
      
      console.log(`💾 Saved ${users.length} users from ${platform}`);
    } catch (error) {
      console.error(`❌ Error saving scraped users:`, error);
    }
  }

  // Update user interaction history
  async updateUserInteraction(task, result) {
    try {
      // Extract username from target (if it's a username-based task)
      let username = task.target;
      if (task.type === 'like' || task.type === 'retweet' || task.type === 'comment') {
        // For post interactions, we might not have the username directly
        // This would need to be extracted from the result or task metadata
        username = result.data?.username || task.metadata?.username;
      }

      if (username) {
        const user = await User.findOne({
          platform: task.platform,
          username: username
        });

        if (user) {
          await user.addInteraction({
            type: task.type,
            postId: task.target,
            success: result.success,
            notes: result.message
          });
        }
      }
    } catch (error) {
      console.error('❌ Error updating user interaction:', error);
    }
  }

  // Check rate limits
  checkRateLimit(platform) {
    const now = Date.now();
    const limit = this.rateLimits.get(platform) || { count: 0, resetTime: now };
    
    // Reset if window has passed
    const windowMs = this.getRateLimitWindow(platform) * 60 * 1000;
    if (now >= limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + windowMs;
    }
    
    const maxRequests = this.getMaxRequests(platform);
    return limit.count < maxRequests;
  }

  // Update rate limit counter
  updateRateLimit(platform) {
    const now = Date.now();
    const limit = this.rateLimits.get(platform) || { count: 0, resetTime: now };
    
    limit.count += 1;
    this.rateLimits.set(platform, limit);
  }

  // Get rate limit window in minutes
  getRateLimitWindow(platform) {
    switch (platform) {
      case 'twitter':
        return parseInt(process.env.TWITTER_RATE_LIMIT_WINDOW) || 15;
      case 'instagram':
        return parseInt(process.env.INSTAGRAM_RATE_LIMIT_WINDOW) || 60;
      case 'facebook':
        return parseInt(process.env.FACEBOOK_RATE_LIMIT_WINDOW) || 60;
      default:
        return 15;
    }
  }

  // Get max requests per window
  getMaxRequests(platform) {
    switch (platform) {
      case 'twitter':
        return parseInt(process.env.TWITTER_RATE_LIMIT_REQUESTS) || 300;
      case 'instagram':
        return parseInt(process.env.INSTAGRAM_RATE_LIMIT_REQUESTS) || 100;
      case 'facebook':
        return parseInt(process.env.FACEBOOK_RATE_LIMIT_REQUESTS) || 100;
      default:
        return 100;
    }
  }

  // Create automated interaction tasks
  async createInteractionTasks(platform, options = {}) {
    try {
      const { type, targets, action, priority = 1 } = options;
      const tasks = [];

      for (const target of targets) {
        const task = new Task({
          type: type,
          platform: platform,
          target: target,
          action: action || `Automated ${type}`,
          priority: priority,
          metadata: {
            automated: true,
            createdBy: 'interaction_controller'
          }
        });

        await task.save();
        tasks.push(task);
      }

      console.log(`📋 Created ${tasks.length} ${type} tasks for ${platform}`);
      return tasks;
    } catch (error) {
      console.error('❌ Error creating interaction tasks:', error);
      throw error;
    }
  }

  // Get interaction statistics
  async getInteractionStats(platform, timeRange = 24) {
    try {
      const since = new Date(Date.now() - timeRange * 60 * 60 * 1000);

      const stats = await Task.aggregate([
        {
          $match: {
            platform: platform,
            type: { $in: ['like', 'comment', 'follow', 'retweet'] },
            executedTime: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: 1 },
            successful: {
              $sum: { $cond: [{ $eq: ['$result.success', true] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$result.success', false] }, 1, 0] }
            }
          }
        }
      ]);

      return stats.reduce((acc, stat) => {
        acc[stat._id] = {
          total: stat.total,
          successful: stat.successful,
          failed: stat.failed,
          successRate: stat.total > 0 ? (stat.successful / stat.total * 100).toFixed(2) : 0
        };
        return acc;
      }, {});
    } catch (error) {
      console.error('❌ Error getting interaction stats:', error);
      return {};
    }
  }

  // Find users for interaction based on criteria
  async findUsersForInteraction(platform, criteria = {}) {
    try {
      const {
        minFollowers = 0,
        maxFollowers = 1000000,
        verified = false,
        excludeBots = true,
        limit = 10
      } = criteria;

      const query = {
        platform: platform,
        followers: { $gte: minFollowers, $lte: maxFollowers }
      };

      if (verified !== null) {
        query.verified = verified;
      }

      if (excludeBots) {
        query.isBot = { $ne: true };
      }

      // Exclude users we've interacted with recently
      const recentlyInteracted = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query.$or = [
        { lastInteraction: { $lt: recentlyInteracted } },
        { lastInteraction: { $exists: false } }
      ];

      const users = await User.find(query)
        .sort({ followers: -1 })
        .limit(limit);

      return users;
    } catch (error) {
      console.error('❌ Error finding users for interaction:', error);
      return [];
    }
  }
}

// Create singleton instance
const interactionController = new InteractionController();

// Route handler functions for API endpoints
const createTask = async (req, res) => {
  try {
    const taskData = req.body;
    
    // Validate required fields
    if (!taskData.type || !taskData.platform || !taskData.target || !taskData.action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, platform, target, action'
      });
    }

    const task = new Task(taskData);
    await task.save();

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create task',
      message: error.message
    });
  }
};

const getTasks = async (req, res) => {
  try {
    const { platform, type, status, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (platform) filter.platform = platform;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const skip = (page - 1) * parseInt(limit);
    
    const tasks = await Task.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Task.countDocuments(filter);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks',
      message: error.message
    });
  }
};

const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch task',
      message: error.message
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update task',
      message: error.message
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully',
      data: task
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete task',
      message: error.message
    });
  }
};

const executeTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const result = await interactionController.executeTask(task);

    res.json({
      success: true,
      message: 'Task executed successfully',
      data: {
        task: task,
        result: result
      }
    });
  } catch (error) {
    console.error('Error executing task:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute task',
      message: error.message
    });
  }
};

module.exports = {
  executeTask: (task) => interactionController.executeTask(task),
  createInteractionTasks: (platform, options) => interactionController.createInteractionTasks(platform, options),
  getInteractionStats: (platform, timeRange) => interactionController.getInteractionStats(platform, timeRange),
  findUsersForInteraction: (platform, criteria) => interactionController.findUsersForInteraction(platform, criteria),
  // Route handlers
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  getTaskById,
  executeTask: executeTaskById
};
