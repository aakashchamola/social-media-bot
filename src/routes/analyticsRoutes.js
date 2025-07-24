const express = require('express');
const router = express.Router();
const { getDashboardAnalytics, getPlatformReport, exportAnalytics } = require('../controllers/analytics');
const { getInteractionStats } = require('../controllers/interactions');
const Task = require('../models/Task');
const Post = require('../models/Post');
const User = require('../models/User');

// GET /api/analytics - Get dashboard analytics
router.get('/', async (req, res) => {
  try {
    const { timeRange = 7 } = req.query;
    
    const analytics = await getDashboardAnalytics(parseInt(timeRange));
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('❌ Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// GET /api/analytics/platform/:platform - Get platform-specific analytics
router.get('/platform/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { timeRange = 30 } = req.query;

    if (platform !== 'twitter') {
      return res.status(400).json({
        success: false,
        message: 'Only Twitter platform is supported'
      });
    }

    const report = await getPlatformReport(platform, parseInt(timeRange));
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('❌ Error fetching platform analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform analytics',
      error: error.message
    });
  }
});

// GET /api/analytics/interactions - Get interaction analytics
router.get('/interactions', async (req, res) => {
  try {
    const { platform, timeRange = 24 } = req.query;

    if (platform && platform !== 'twitter') {
      return res.status(400).json({
        success: false,
        message: 'Only Twitter platform is supported'
      });
    }

    const platforms = platform ? [platform] : ['twitter'];
    const analytics = {};

    for (const plt of platforms) {
      analytics[plt] = await getInteractionStats(plt, parseInt(timeRange));
    }

    res.json({
      success: true,
      data: analytics,
      timeRange: `${timeRange} hours`
    });
  } catch (error) {
    console.error('❌ Error fetching interaction analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interaction analytics',
      error: error.message
    });
  }
});

// GET /api/analytics/posts - Get post performance analytics
router.get('/posts', async (req, res) => {
  try {
    const { platform, timeRange = 7, limit = 10 } = req.query;
    
    const since = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    
    const filter = {
      posted: true,
      createdAt: { $gte: since }
    };

    if (platform) {
      filter.platform = platform;
    }

    // Get top performing posts
    const topPosts = await Post.find(filter)
      .sort({ 'metadata.likes': -1, 'metadata.retweets': -1 })
      .limit(parseInt(limit))
      .select('content platform metadata postId createdAt');

    // Get platform breakdown
    const platformStats = await Post.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$platform',
          totalPosts: { $sum: 1 },
          avgLikes: { $avg: '$metadata.likes' },
          avgRetweets: { $avg: '$metadata.retweets' },
          avgReplies: { $avg: '$metadata.replies' },
          totalEngagement: {
            $sum: {
              $add: [
                { $ifNull: ['$metadata.likes', 0] },
                { $ifNull: ['$metadata.retweets', 0] },
                { $ifNull: ['$metadata.replies', 0] }
              ]
            }
          }
        }
      }
    ]);

    // Get daily posting pattern
    const dailyPattern = await Post.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          posts: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ['$posted', true] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        topPosts: topPosts.map(post => ({
          id: post.postId,
          content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
          platform: post.platform,
          likes: post.metadata?.likes || 0,
          retweets: post.metadata?.retweets || 0,
          replies: post.metadata?.replies || 0,
          totalEngagement: (post.metadata?.likes || 0) + 
                          (post.metadata?.retweets || 0) + 
                          (post.metadata?.replies || 0),
          publishedAt: post.createdAt
        })),
        platformStats: platformStats.reduce((acc, stat) => {
          acc[stat._id] = {
            totalPosts: stat.totalPosts,
            avgLikes: Math.round(stat.avgLikes || 0),
            avgRetweets: Math.round(stat.avgRetweets || 0),
            avgReplies: Math.round(stat.avgReplies || 0),
            totalEngagement: stat.totalEngagement,
            avgEngagementPerPost: stat.totalPosts > 0 ? 
              Math.round(stat.totalEngagement / stat.totalPosts) : 0
          };
          return acc;
        }, {}),
        dailyPattern: dailyPattern
      },
      timeRange: `${timeRange} days`
    });
  } catch (error) {
    console.error('❌ Error fetching post analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch post analytics',
      error: error.message
    });
  }
});

// GET /api/analytics/tasks - Get task execution analytics
router.get('/tasks', async (req, res) => {
  try {
    const { platform, type, timeRange = 7 } = req.query;
    
    const since = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    
    const filter = {
      createdAt: { $gte: since }
    };

    if (platform) filter.platform = platform;
    if (type) filter.type = type;

    // Get task status breakdown
    const statusStats = await Task.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get task type breakdown
    const typeStats = await Task.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          avgRetries: { $avg: '$retryCount' }
        }
      }
    ]);

    // Get platform breakdown
    const platformStats = await Task.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$platform',
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

    // Get recent failed tasks for debugging
    const recentFailures = await Task.find({
      ...filter,
      status: 'failed'
    })
    .sort({ updatedAt: -1 })
    .limit(10)
    .select('type platform target result.message updatedAt');

    res.json({
      success: true,
      data: {
        statusBreakdown: statusStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        typeBreakdown: typeStats.reduce((acc, stat) => {
          acc[stat._id] = {
            total: stat.total,
            completed: stat.completed,
            failed: stat.failed,
            successRate: stat.total > 0 ? 
              ((stat.completed / (stat.completed + stat.failed)) * 100).toFixed(2) : 0,
            avgRetries: stat.avgRetries ? stat.avgRetries.toFixed(2) : 0
          };
          return acc;
        }, {}),
        platformBreakdown: platformStats.reduce((acc, stat) => {
          acc[stat._id] = {
            total: stat.total,
            completed: stat.completed,
            failed: stat.failed,
            successRate: stat.total > 0 ? 
              ((stat.completed / (stat.completed + stat.failed)) * 100).toFixed(2) : 0
          };
          return acc;
        }, {}),
        recentFailures: recentFailures
      },
      timeRange: `${timeRange} days`
    });
  } catch (error) {
    console.error('❌ Error fetching task analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task analytics',
      error: error.message
    });
  }
});

// GET /api/analytics/users - Get user analytics
router.get('/users', async (req, res) => {
  try {
    const { platform, timeRange = 30 } = req.query;
    
    const since = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    
    const filter = {};
    if (platform) filter.platform = platform;

    // Get user growth
    const totalUsers = await User.countDocuments(filter);
    const newUsers = await User.countDocuments({
      ...filter,
      createdAt: { $gte: since }
    });

    // Get platform distribution
    const platformDistribution = await User.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
          avgFollowers: { $avg: '$followers' },
          totalFollowers: { $sum: '$followers' },
          verifiedCount: {
            $sum: { $cond: [{ $eq: ['$verified', true] }, 1, 0] }
          }
        }
      }
    ]);

    // Get top users by followers
    const topUsers = await User.find(filter)
      .sort({ followers: -1 })
      .limit(10)
      .select('username platform followers verified displayName');

    // Get interaction metrics
    const userInteractionStats = await User.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$platform',
          totalInteractions: { $sum: '$metrics.totalInteractions' },
          successfulInteractions: { $sum: '$metrics.successfulInteractions' },
          avgEngagementRate: { $avg: '$metrics.lastEngagementRate' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalUsers,
          newUsers,
          growthRate: totalUsers > 0 ? ((newUsers / totalUsers) * 100).toFixed(2) : 0
        },
        platformDistribution: platformDistribution.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            avgFollowers: Math.round(stat.avgFollowers || 0),
            totalFollowers: stat.totalFollowers,
            verifiedCount: stat.verifiedCount,
            verificationRate: stat.count > 0 ? 
              ((stat.verifiedCount / stat.count) * 100).toFixed(2) : 0
          };
          return acc;
        }, {}),
        topUsers: topUsers,
        interactionMetrics: userInteractionStats.reduce((acc, stat) => {
          acc[stat._id] = {
            totalInteractions: stat.totalInteractions,
            successfulInteractions: stat.successfulInteractions,
            successRate: stat.totalInteractions > 0 ? 
              ((stat.successfulInteractions / stat.totalInteractions) * 100).toFixed(2) : 0,
            avgEngagementRate: stat.avgEngagementRate ? stat.avgEngagementRate.toFixed(2) : 0
          };
          return acc;
        }, {})
      },
      timeRange: `${timeRange} days`
    });
  } catch (error) {
    console.error('❌ Error fetching user analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user analytics',
      error: error.message
    });
  }
});

// GET /api/analytics/export - Export analytics data
router.get('/analytics/export', async (req, res) => {
  try {
    const { format = 'json', timeRange = 30 } = req.query;

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Format must be json or csv'
      });
    }

    const exportData = await exportAnalytics(format, parseInt(timeRange));

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${Date.now()}.csv`);
      return res.send(exportData.data);
    }

    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('❌ Error exporting analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export analytics',
      error: error.message
    });
  }
});

// GET /api/analytics/realtime - Get real-time statistics
router.get('/realtime', async (req, res) => {
  try {
    // Since we have limited API access, return mock real-time data with API status
    const realtimeStats = {
      botStatus: 'active',
      apiAccess: 'essential', // essential, elevated, or basic
      readOperations: Math.floor(Math.random() * 50) + 10,
      writeOperations: 0, // Always 0 for essential access
      lastActivity: new Date().toISOString(),
      rateLimitStatus: {
        remaining: 300,
        limit: 300,
        resetTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      },
      features: {
        readAccess: true,
        writeAccess: false,
        premiumAnalytics: false
      }
    };

    res.json({
      success: true,
      data: realtimeStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching real-time stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch real-time statistics',
      error: error.message
    });
  }
});

// GET /api/analytics/trends - Get trending topics and hashtags
router.get('/trends', async (req, res) => {
  try {
    const { timeRange = 7, platform } = req.query;
    
    const since = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    
    // Get trending hashtags from posts
    const hashtagFilter = {
      createdAt: { $gte: since },
      hashtags: { $exists: true, $ne: [] }
    };

    if (platform) {
      hashtagFilter.platform = platform;
    }

    const hashtagTrends = await Post.aggregate([
      { $match: hashtagFilter },
      { $unwind: '$hashtags' },
      {
        $group: {
          _id: '$hashtags',
          count: { $sum: 1 },
          platforms: { $addToSet: '$platform' },
          avgEngagement: {
            $avg: {
              $add: [
                { $ifNull: ['$metadata.likes', 0] },
                { $ifNull: ['$metadata.retweets', 0] },
                { $ifNull: ['$metadata.replies', 0] }
              ]
            }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Get trend monitoring data from tasks
    const trendFilter = {
      type: 'trend_monitor',
      'result.success': true,
      executedTime: { $gte: since }
    };

    if (platform) {
      trendFilter.platform = platform;
    }

    const monitoredTrends = await Task.find(trendFilter)
      .sort({ executedTime: -1 })
      .limit(10)
      .select('platform result.data executedTime');

    // Get mention trends
    const mentionTrends = await Post.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
          mentions: { $exists: true, $ne: [] },
          ...(platform && { platform })
        }
      },
      { $unwind: '$mentions' },
      {
        $group: {
          _id: '$mentions',
          count: { $sum: 1 },
          platforms: { $addToSet: '$platform' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        hashtags: hashtagTrends.map(trend => ({
          hashtag: trend._id,
          count: trend.count,
          platforms: trend.platforms,
          avgEngagement: Math.round(trend.avgEngagement || 0)
        })),
        mentions: mentionTrends.map(trend => ({
          mention: trend._id,
          count: trend.count,
          platforms: trend.platforms
        })),
        monitoredTrends: monitoredTrends.map(task => ({
          platform: task.platform,
          timestamp: task.executedTime,
          trends: task.result.data?.slice(0, 5) || []
        }))
      },
      timeRange: `${timeRange} days`
    });
  } catch (error) {
    console.error('❌ Error fetching trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trends',
      error: error.message
    });
  }
});

// GET /api/analytics/realtime - Get real-time statistics
router.get('/realtime', async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get active tasks in last hour
    const activeTasks = await Task.countDocuments({
      status: 'pending',
      scheduledTime: { $lte: now }
    });

    // Get recent posts
    const recentPosts = await Post.countDocuments({
      posted: true,
      createdAt: { $gte: oneHourAgo }
    });

    // Get recent interactions
    const recentInteractions = await Task.countDocuments({
      type: { $in: ['like', 'comment', 'follow', 'retweet'] },
      status: 'completed',
      executedTime: { $gte: oneHourAgo }
    });

    // Get success rate for last 24 hours
    const dayStats = await Task.aggregate([
      {
        $match: {
          executedTime: { $gte: oneDayAgo },
          status: { $in: ['completed', 'failed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    const successRate = dayStats.length > 0 && dayStats[0].total > 0 ? 
      (dayStats[0].successful / dayStats[0].total * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        timestamp: now.toISOString(),
        activeTasks: activeTasks,
        recentPosts: recentPosts,
        recentInteractions: recentInteractions,
        successRate: `${successRate}%`,
        systemHealth: activeTasks > 0 ? 'active' : 'idle',
        uptime: process.uptime()
      }
    });
  } catch (error) {
    console.error('❌ Error fetching realtime analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch realtime analytics',
      error: error.message
    });
  }
});

// GET /api/analytics/summary - Get analytics summary
router.get('/analytics/summary', async (req, res) => {
  try {
    const { timeRange = 7 } = req.query;
    const since = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
    
    const [totalPosts, totalTasks, totalUsers, recentActivity] = await Promise.all([
      Post.countDocuments({ createdAt: { $gte: since } }),
      Task.countDocuments({ createdAt: { $gte: since } }),
      User.countDocuments({ createdAt: { $gte: since } }),
      Post.find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('platform content scheduledTime posted')
    ]);

    res.json({
      success: true,
      data: {
        timeRange: `${timeRange} days`,
        summary: {
          totalPosts,
          totalTasks,
          totalUsers,
          lastUpdated: new Date().toISOString()
        },
        recentActivity: recentActivity
      }
    });
  } catch (error) {
    console.error('❌ Error fetching analytics summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics summary',
      error: error.message
    });
  }
});

module.exports = router;
