const Task = require('../models/Task');
const Post = require('../models/Post');
const User = require('../models/User');
const { TwitterService } = require('../services/twitterService');
const { RedditService } = require('../services/redditService');

class AnalyticsController {
  constructor() {
    this.twitterService = new TwitterService();
    this.redditService = new RedditService();
  }

  // Get comprehensive analytics dashboard data
  async getDashboardAnalytics(timeRange = 7) {
    try {
      const since = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      
      const [
        postStats,
        taskStats,
        userGrowth,
        engagementMetrics,
        platformBreakdown,
        topTrends
      ] = await Promise.all([
        this.getPostStatistics(since),
        this.getTaskStatistics(since),
        this.getUserGrowthMetrics(since),
        this.getEngagementMetrics(since),
        this.getPlatformBreakdown(since),
        this.getTopTrends(timeRange)
      ]);

      return {
        timeRange: `${timeRange} days`,
        summary: {
          totalPosts: postStats.total,
          successfulPosts: postStats.successful,
          totalTasks: taskStats.total,
          completedTasks: taskStats.completed,
          totalUsers: userGrowth.total,
          newUsers: userGrowth.new
        },
        postStatistics: postStats,
        taskStatistics: taskStats,
        userGrowth: userGrowth,
        engagement: engagementMetrics,
        platformBreakdown: platformBreakdown,
        trends: topTrends,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error generating dashboard analytics:', error);
      throw error;
    }
  }

  // Get post publishing statistics
  async getPostStatistics(since) {
    try {
      const stats = await Post.aggregate([
        {
          $match: {
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successful: {
              $sum: { $cond: [{ $eq: ['$posted', true] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$posted', false] }, 1, 0] }
            },
            totalEngagement: {
              $sum: {
                $add: [
                  '$metadata.likes',
                  '$metadata.retweets', 
                  '$metadata.replies'
                ]
              }
            }
          }
        }
      ]);

      const platformStats = await Post.aggregate([
        {
          $match: {
            createdAt: { $gte: since },
            posted: true
          }
        },
        {
          $group: {
            _id: '$platform',
            count: { $sum: 1 },
            avgEngagement: {
              $avg: {
                $add: [
                  '$metadata.likes',
                  '$metadata.retweets',
                  '$metadata.replies'
                ]
              }
            }
          }
        }
      ]);

      const result = stats[0] || { total: 0, successful: 0, pending: 0, totalEngagement: 0 };
      
      return {
        total: result.total,
        successful: result.successful,
        pending: result.pending,
        successRate: result.total > 0 ? (result.successful / result.total * 100).toFixed(2) : 0,
        totalEngagement: result.totalEngagement || 0,
        avgEngagementPerPost: result.successful > 0 ? 
          (result.totalEngagement / result.successful).toFixed(2) : 0,
        byPlatform: platformStats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            avgEngagement: Math.round(stat.avgEngagement || 0)
          };
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('❌ Error getting post statistics:', error);
      return { total: 0, successful: 0, pending: 0, successRate: 0 };
    }
  }

  // Get task execution statistics
  async getTaskStatistics(since) {
    try {
      const stats = await Task.aggregate([
        {
          $match: {
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const typeStats = await Task.aggregate([
        {
          $match: {
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        }
      ]);

      const statusMap = stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});

      const total = Object.values(statusMap).reduce((sum, count) => sum + count, 0);
      const completed = statusMap.completed || 0;
      const failed = statusMap.failed || 0;

      return {
        total: total,
        completed: completed,
        failed: failed,
        pending: statusMap.pending || 0,
        scheduled: statusMap.scheduled || 0,
        successRate: total > 0 ? (completed / (completed + failed) * 100).toFixed(2) : 0,
        byType: typeStats.reduce((acc, stat) => {
          acc[stat._id] = {
            total: stat.total,
            completed: stat.completed,
            failed: stat.failed,
            successRate: stat.total > 0 ? 
              (stat.completed / (stat.completed + stat.failed) * 100).toFixed(2) : 0
          };
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('❌ Error getting task statistics:', error);
      return { total: 0, completed: 0, failed: 0, successRate: 0 };
    }
  }

  // Get user metrics for a specific platform and time range
  async getUserMetrics(since, platform = null) {
    try {
      const filter = {};
      if (since) {
        filter.createdAt = { $gte: since };
      }
      if (platform) {
        filter.platform = platform;
      }

      const [total, newUsers, verifiedUsers, platformBreakdown] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments(filter),
        User.countDocuments({ verified: true, ...filter }),
        User.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$platform',
              count: { $sum: 1 },
              avgFollowers: { $avg: '$followers' },
              totalFollowers: { $sum: '$followers' },
              verified: {
                $sum: { $cond: ['$verified', 1, 0] }
              }
            }
          }
        ])
      ]);

      return {
        total,
        newUsers,
        verified: verifiedUsers,
        platforms: platformBreakdown.reduce((acc, platform) => {
          acc[platform._id] = {
            count: platform.count,
            avgFollowers: Math.round(platform.avgFollowers || 0),
            totalFollowers: platform.totalFollowers || 0,
            verified: platform.verified || 0
          };
          return acc;
        }, {}),
        growth: total > 0 ? ((newUsers / total) * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error('❌ Error getting user metrics:', error);
      return { total: 0, newUsers: 0, verified: 0, platforms: {}, growth: 0 };
    }
  }

  // Get user growth metrics
  async getUserGrowthMetrics(since) {
    try {
      const total = await User.countDocuments();
      const newUsers = await User.countDocuments({
        createdAt: { $gte: since }
      });

      const platformGrowth = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$platform',
            newUsers: { $sum: 1 },
            avgFollowers: { $avg: '$followers' },
            totalFollowers: { $sum: '$followers' }
          }
        }
      ]);

      const topUsers = await User.find({})
        .sort({ followers: -1 })
        .limit(5)
        .select('username platform followers verified');

      return {
        total: total,
        new: newUsers,
        growthRate: total > 0 ? (newUsers / total * 100).toFixed(2) : 0,
        byPlatform: platformGrowth.reduce((acc, stat) => {
          acc[stat._id] = {
            newUsers: stat.newUsers,
            avgFollowers: Math.round(stat.avgFollowers || 0),
            totalFollowers: stat.totalFollowers || 0
          };
          return acc;
        }, {}),
        topUsers: topUsers
      };
    } catch (error) {
      console.error('❌ Error getting user growth metrics:', error);
      return { total: 0, new: 0, growthRate: 0 };
    }
  }

  // Get engagement metrics
  async getEngagementMetrics(since) {
    try {
      // Get average engagement from posts
      const postEngagement = await Post.aggregate([
        {
          $match: {
            posted: true,
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$platform',
            avgLikes: { $avg: '$metadata.likes' },
            avgRetweets: { $avg: '$metadata.retweets' },
            avgReplies: { $avg: '$metadata.replies' },
            totalPosts: { $sum: 1 }
          }
        }
      ]);

      // Get interaction success rates
      const interactionSuccess = await Task.aggregate([
        {
          $match: {
            type: { $in: ['like', 'comment', 'follow', 'retweet'] },
            executedTime: { $gte: since }
          }
        },
        {
          $group: {
            _id: '$platform',
            totalInteractions: { $sum: 1 },
            successfulInteractions: {
              $sum: { $cond: [{ $eq: ['$result.success', true] }, 1, 0] }
            }
          }
        }
      ]);

      return {
        postEngagement: postEngagement.reduce((acc, stat) => {
          acc[stat._id] = {
            avgLikes: Math.round(stat.avgLikes || 0),
            avgRetweets: Math.round(stat.avgRetweets || 0),
            avgReplies: Math.round(stat.avgReplies || 0),
            totalPosts: stat.totalPosts,
            avgTotalEngagement: Math.round(
              (stat.avgLikes || 0) + (stat.avgRetweets || 0) + (stat.avgReplies || 0)
            )
          };
          return acc;
        }, {}),
        interactionSuccess: interactionSuccess.reduce((acc, stat) => {
          acc[stat._id] = {
            total: stat.totalInteractions,
            successful: stat.successfulInteractions,
            rate: stat.totalInteractions > 0 ? 
              (stat.successfulInteractions / stat.totalInteractions * 100).toFixed(2) : 0
          };
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('❌ Error getting engagement metrics:', error);
      return { postEngagement: {}, interactionSuccess: {} };
    }
  }

  // Get platform activity breakdown
  async getPlatformBreakdown(since) {
    try {
      const platforms = ['twitter', 'reddit', 'instagram'];
      const breakdown = {};

      for (const platform of platforms) {
        const [posts, tasks, users] = await Promise.all([
          Post.countDocuments({ platform, createdAt: { $gte: since } }),
          Task.countDocuments({ platform, createdAt: { $gte: since } }),
          User.countDocuments({ platform, createdAt: { $gte: since } })
        ]);

        breakdown[platform] = {
          posts: posts,
          tasks: tasks,
          users: users,
          totalActivity: posts + tasks
        };
      }

      return breakdown;
    } catch (error) {
      console.error('❌ Error getting platform breakdown:', error);
      return {};
    }
  }

  // Get trending topics and hashtags
  async getTopTrends(timeRange) {
    try {
      const since = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);

      // Get trending hashtags from posts
      const hashtagTrends = await Post.aggregate([
        {
          $match: {
            createdAt: { $gte: since },
            hashtags: { $exists: true, $ne: [] }
          }
        },
        { $unwind: '$hashtags' },
        {
          $group: {
            _id: '$hashtags',
            count: { $sum: 1 },
            platforms: { $addToSet: '$platform' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Get trend monitoring data
      const trendData = await Task.find({
        type: 'trend_monitor',
        'result.success': true,
        executedTime: { $gte: since }
      })
      .sort({ executedTime: -1 })
      .limit(5);

      return {
        hashtags: hashtagTrends.map(trend => ({
          hashtag: trend._id,
          count: trend.count,
          platforms: trend.platforms
        })),
        monitoredTrends: trendData.map(task => ({
          platform: task.platform,
          timestamp: task.executedTime,
          data: task.result.data?.slice(0, 5) || [] // Top 5 trends
        }))
      };
    } catch (error) {
      console.error('❌ Error getting trends:', error);
      return { hashtags: [], monitoredTrends: [] };
    }
  }

  // Generate detailed report for a specific platform
  async getPlatformReport(platform, timeRange = 30) {
    try {
      const since = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);

      const [
        posts,
        tasks,
        users,
        engagement,
        topPerformingPosts
      ] = await Promise.all([
        this.getPostStatistics(since, platform),
        this.getTaskStatistics(since, platform),
        this.getUserMetrics(since, platform),
        this.getEngagementMetrics(since, platform),
        this.getTopPerformingPosts(platform, 5)
      ]);

      return {
        platform: platform,
        timeRange: `${timeRange} days`,
        posts: posts,
        tasks: tasks,
        users: users,
        engagement: engagement,
        topPerformingPosts: topPerformingPosts,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error generating ${platform} report:`, error);
      throw error;
    }
  }

  // Get top performing posts
  async getTopPerformingPosts(platform, limit = 5) {
    try {
      const posts = await Post.find({
        platform: platform,
        posted: true
      })
      .sort({ 'metadata.likes': -1, 'metadata.retweets': -1 })
      .limit(limit)
      .select('content metadata.likes metadata.retweets metadata.replies postId createdAt');

      return posts.map(post => ({
        id: post.postId,
        content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
        likes: post.metadata?.likes || 0,
        retweets: post.metadata?.retweets || 0,
        replies: post.metadata?.replies || 0,
        totalEngagement: (post.metadata?.likes || 0) + 
                        (post.metadata?.retweets || 0) + 
                        (post.metadata?.replies || 0),
        publishedAt: post.createdAt
      }));
    } catch (error) {
      console.error('❌ Error getting top performing posts:', error);
      return [];
    }
  }

  // Scrape and analyze data for reporting
  async scrapeData(task) {
    try {
      let result;

      switch (task.platform) {
        case 'twitter':
          if (this.twitterService.isConfigured()) {
            result = await this.scrapeTwitterData(task);
          }
          break;
        case 'reddit':
          if (this.redditService.isConfigured()) {
            result = await this.scrapeRedditData(task);
          }
          break;
        default:
          throw new Error(`Unsupported platform for scraping: ${task.platform}`);
      }

      if (result && result.success) {
        await task.markCompleted(result);
        console.log(`✅ Data scraping completed for ${task.platform}: ${task.target}`);
      } else {
        await task.markFailed(new Error(result?.message || 'Scraping failed'));
      }

      return result;
    } catch (error) {
      console.error('❌ Error in data scraping:', error);
      await task.markFailed(error);
      return { success: false, message: error.message };
    }
  }

  // Export analytics data
  async exportAnalytics(format = 'json', timeRange = 30) {
    try {
      const analytics = await this.getDashboardAnalytics(timeRange);
      
      if (format === 'json') {
        return {
          format: 'json',
          data: analytics,
          exportedAt: new Date().toISOString()
        };
      }
      
      // For CSV format (simplified)
      if (format === 'csv') {
        const csvData = this.convertToCSV(analytics);
        return {
          format: 'csv',
          data: csvData,
          exportedAt: new Date().toISOString()
        };
      }

      throw new Error(`Unsupported export format: ${format}`);
    } catch (error) {
      console.error('❌ Error exporting analytics:', error);
      throw error;
    }
  }

  // Convert analytics data to CSV format
  convertToCSV(analytics) {
    const rows = [
      ['Metric', 'Value', 'Platform', 'Date'],
      ['Total Posts', analytics.summary.totalPosts, 'All', new Date().toISOString().split('T')[0]],
      ['Successful Posts', analytics.summary.successfulPosts, 'All', new Date().toISOString().split('T')[0]],
      ['Total Tasks', analytics.summary.totalTasks, 'All', new Date().toISOString().split('T')[0]],
      ['Completed Tasks', analytics.summary.completedTasks, 'All', new Date().toISOString().split('T')[0]]
    ];

    return rows.map(row => row.join(',')).join('\n');
  }

  // Real-time analytics stream (for WebSocket)
  getRealtimeStats() {
    return {
      timestamp: new Date().toISOString(),
      activeTasks: 0, // This would be calculated in real implementation
      recentPosts: 0,
      systemHealth: 'healthy'
    };
  }
}

// Create singleton instance
const analyticsController = new AnalyticsController();

module.exports = {
  getDashboardAnalytics: (timeRange) => analyticsController.getDashboardAnalytics(timeRange),
  getPlatformReport: (platform, timeRange) => analyticsController.getPlatformReport(platform, timeRange),
  exportAnalytics: (format, timeRange) => analyticsController.exportAnalytics(format, timeRange),
  scrapeData: (task) => analyticsController.scrapeData(task),
  getRealtimeStats: () => analyticsController.getRealtimeStats()
};
