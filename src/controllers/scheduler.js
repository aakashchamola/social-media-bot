const cron = require('node-cron');
const Post = require('../models/Post');
const Task = require('../models/Task');
const { TwitterService } = require('../services/twitterService');
const { RedditService } = require('../services/redditService');
const { InstagramService } = require('../services/instagramService');
const { FacebookService } = require('../services/facebookService');
const { executeTask } = require('./interactions');
const { scrapeData } = require('./analytics');

class Scheduler {
  constructor() {
    this.twitterService = new TwitterService();
    this.redditService = new RedditService();
    this.instagramService = new InstagramService();
    this.facebookService = new FacebookService();
    this.jobs = new Map();
  }

  // Initialize all scheduled jobs
  initializeSchedulers() {
    console.log('🔄 Initializing schedulers...');
    
    if (process.env.ENABLE_SCHEDULED_POSTING === 'true') {
      this.startPostingScheduler();
    }
    
    if (process.env.ENABLE_AUTO_INTERACTIONS === 'true') {
      this.startInteractionScheduler();
    }
    
    if (process.env.ENABLE_TREND_MONITORING === 'true') {
      this.startTrendMonitoring();
    }
    
    if (process.env.ENABLE_DATA_SCRAPING === 'true') {
      this.startDataScraping();
    }
    
    this.startTaskProcessor();
    this.startAnalyticsUpdater();
    
    console.log('✅ All schedulers initialized');
  }

  // Schedule posts to be published
  startPostingScheduler() {
    const job = cron.schedule('*/5 * * * *', async () => {
      try {
        console.log('🔍 Checking for scheduled posts...');
        
        const now = new Date();
        const scheduledPosts = await Post.find({
          posted: false,
          scheduledTime: { $lte: now }
        }).limit(10);

        for (const post of scheduledPosts) {
          await this.publishPost(post);
        }
        
        if (scheduledPosts.length > 0) {
          console.log(`📝 Processed ${scheduledPosts.length} scheduled posts`);
        }
      } catch (error) {
        console.error('❌ Error in posting scheduler:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('posting', job);
    job.start();
    console.log('📅 Posting scheduler started (every 5 minutes)');
  }

  // Process automated interactions
  startInteractionScheduler() {
    const job = cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('🤖 Processing automated interactions...');
        
        const pendingTasks = await Task.getPendingTasks();
        const interactionTasks = pendingTasks.filter(task => 
          ['like', 'comment', 'follow', 'retweet'].includes(task.type)
        );

        for (const task of interactionTasks.slice(0, 5)) {
          await executeTask(task);
        }
        
        if (interactionTasks.length > 0) {
          console.log(`🎯 Processed ${Math.min(interactionTasks.length, 5)} interaction tasks`);
        }
      } catch (error) {
        console.error('❌ Error in interaction scheduler:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('interactions', job);
    job.start();
    console.log('🤖 Interaction scheduler started (every 10 minutes)');
  }

  // Monitor trending topics
  startTrendMonitoring() {
    const job = cron.schedule('0 */2 * * *', async () => {
      try {
        console.log('📈 Monitoring trends...');
        
        // Twitter trends
        if (this.twitterService.isConfigured()) {
          const twitterTrends = await this.twitterService.getTrends();
          await this.saveTrends('twitter', twitterTrends);
        }

        // Reddit trends
        if (this.redditService.isConfigured()) {
          const redditTrends = await this.redditService.getTrends();
          await this.saveTrends('reddit', redditTrends);
        }
        
        console.log('📊 Trend monitoring completed');
      } catch (error) {
        console.error('❌ Error in trend monitoring:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('trends', job);
    job.start();
    console.log('📈 Trend monitoring started (every 2 hours)');
  }

  // Schedule data scraping
  startDataScraping() {
    const job = cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('🔍 Starting data scraping...');
        
        const scrapingTasks = await Task.find({
          type: 'scrape',
          status: 'pending'
        }).limit(3);

        for (const task of scrapingTasks) {
          await scrapeData(task);
        }
        
        console.log(`📊 Completed ${scrapingTasks.length} scraping tasks`);
      } catch (error) {
        console.error('❌ Error in data scraping:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('scraping', job);
    job.start();
    console.log('🔍 Data scraping started (every 6 hours)');
  }

  // Process general tasks
  startTaskProcessor() {
    const job = cron.schedule('*/2 * * * *', async () => {
      try {
        const pendingTasks = await Task.find({
          status: 'pending',
          scheduledTime: { $lte: new Date() }
        }).limit(10);

        for (const task of pendingTasks) {
          await executeTask(task);
        }
      } catch (error) {
        console.error('❌ Error processing tasks:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('tasks', job);
    job.start();
    console.log('⚙️ Task processor started (every 2 minutes)');
  }

  // Update analytics data
  startAnalyticsUpdater() {
    const job = cron.schedule('0 0 * * *', async () => {
      try {
        console.log('📊 Updating daily analytics...');
        await this.updateDailyAnalytics();
        console.log('✅ Daily analytics updated');
      } catch (error) {
        console.error('❌ Error updating analytics:', error);
      }
    }, {
      scheduled: false
    });

    this.jobs.set('analytics', job);
    job.start();
    console.log('📊 Analytics updater started (daily at midnight)');
  }

  // Publish a post to the appropriate platform
  async publishPost(post) {
    try {
      let result;
      
      switch (post.platform) {
        case 'twitter':
          if (this.twitterService.isConfigured()) {
            result = await this.twitterService.createPost(post.content, post.mediaUrls);
          }
          break;
          
        case 'reddit':
          if (this.redditService.isConfigured()) {
            result = await this.redditService.createPost(post.content, post.metadata?.subreddit);
          }
          break;
          
        default:
          throw new Error(`Unsupported platform: ${post.platform}`);
      }

      if (result && result.success) {
        post.posted = true;
        post.postId = result.postId;
        post.metadata = { ...post.metadata, ...result.metadata };
        await post.save();
        
        console.log(`✅ Post published on ${post.platform}: ${post.postId}`);
      } else {
        console.error(`❌ Failed to publish post on ${post.platform}:`, result?.error);
      }
      
    } catch (error) {
      console.error(`❌ Error publishing post on ${post.platform}:`, error);
    }
  }

  // Save trending data
  async saveTrends(platform, trends) {
    try {
      const task = new Task({
        type: 'trend_monitor',
        platform: platform,
        target: 'trends',
        action: 'save_trends',
        status: 'completed',
        result: {
          success: true,
          data: trends,
          timestamp: new Date()
        }
      });
      
      await task.save();
    } catch (error) {
      console.error(`❌ Error saving trends for ${platform}:`, error);
    }
  }

  // Update daily analytics
  async updateDailyAnalytics() {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Get daily stats
      const postsCount = await Post.countDocuments({
        posted: true,
        createdAt: {
          $gte: yesterday,
          $lt: today
        }
      });

      const tasksCompleted = await Task.countDocuments({
        status: 'completed',
        executedTime: {
          $gte: yesterday,
          $lt: today
        }
      });

      const tasksFailed = await Task.countDocuments({
        status: 'failed',
        updatedAt: {
          $gte: yesterday,
          $lt: today
        }
      });

      // Create analytics task
      const analyticsTask = new Task({
        type: 'analytics',
        platform: 'all',
        target: 'daily_report',
        action: 'generate_daily_analytics',
        status: 'completed',
        result: {
          success: true,
          data: {
            date: yesterday.toISOString().split('T')[0],
            postsPublished: postsCount,
            tasksCompleted: tasksCompleted,
            tasksFailed: tasksFailed,
            successRate: tasksCompleted + tasksFailed > 0 ? 
              (tasksCompleted / (tasksCompleted + tasksFailed) * 100).toFixed(2) : 0
          }
        }
      });

      await analyticsTask.save();
    } catch (error) {
      console.error('❌ Error updating daily analytics:', error);
    }
  }

  // Schedule a new post
  async schedulePost(postData) {
    try {
      const post = new Post(postData);
      await post.save();
      
      console.log(`📅 Post scheduled for ${post.scheduledTime} on ${post.platform}`);
      return post;
    } catch (error) {
      console.error('❌ Error scheduling post:', error);
      throw error;
    }
  }

  // Schedule a new task
  async scheduleTask(taskData) {
    try {
      const task = new Task(taskData);
      await task.save();
      
      console.log(`⏰ Task scheduled: ${task.type} on ${task.platform}`);
      return task;
    } catch (error) {
      console.error('❌ Error scheduling task:', error);
      throw error;
    }
  }

  // Stop all schedulers
  stopAllSchedulers() {
    console.log('🛑 Stopping all schedulers...');
    
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`⏹️ Stopped ${name} scheduler`);
    }
    
    this.jobs.clear();
    console.log('✅ All schedulers stopped');
  }

  // Get scheduler status
  getSchedulerStatus() {
    const status = {};
    
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running || false,
        scheduled: job.scheduled || false
      };
    }
    
    return status;
  }
}

// Create singleton instance
const scheduler = new Scheduler();

module.exports = {
  initializeSchedulers: () => scheduler.initializeSchedulers(),
  schedulePost: (postData) => scheduler.schedulePost(postData),
  scheduleTask: (taskData) => scheduler.scheduleTask(taskData),
  stopAllSchedulers: () => scheduler.stopAllSchedulers(),
  getSchedulerStatus: () => scheduler.getSchedulerStatus()
};
