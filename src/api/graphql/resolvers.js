const Post = require('../../models/Post');
const Task = require('../../models/Task');
const User = require('../../models/User');
const { GraphQLScalarType } = require('graphql');
const { Kind } = require('graphql/language');

// Custom Date scalar
const DateType = new GraphQLScalarType({
  name: 'Date',
  description: 'Date custom scalar type',
  serialize(value) {
    return value instanceof Date ? value.toISOString() : value;
  },
  parseValue(value) {
    return new Date(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

const resolvers = {
  Date: DateType,

  // Platform enum mapping
  Platform: {
    TWITTER: 'twitter',
    INSTAGRAM: 'instagram',
    FACEBOOK: 'facebook'
  },

  // Task Type enum mapping
  TaskType: {
    LIKE: 'like',
    COMMENT: 'comment',
    FOLLOW: 'follow',
    RETWEET: 'retweet',
    SCRAPE: 'scrape',
    TREND_MONITOR: 'trend_monitor'
  },

  // Task Status enum mapping
  TaskStatus: {
    PENDING: 'pending',
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },

  Query: {
    // Posts queries
    posts: async (_, { platform, limit = 10, offset = 0 }) => {
      const filter = platform ? { platform: platform.toLowerCase() } : {};
      return await Post.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset);
    },

    post: async (_, { id }) => {
      return await Post.findById(id);
    },

    upcomingPosts: async (_, { limit = 10 }) => {
      return await Post.find({
        posted: false,
        scheduledTime: { $gte: new Date() }
      })
      .sort({ scheduledTime: 1 })
      .limit(limit);
    },

    // Users queries
    users: async (_, { platform, limit = 10, offset = 0 }) => {
      const filter = platform ? { platform: platform.toLowerCase() } : {};
      return await User.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset);
    },

    user: async (_, { id }) => {
      return await User.findById(id);
    },

    searchUsers: async (_, { query, platform }) => {
      const filter = {
        username: { $regex: query, $options: 'i' }
      };
      if (platform) {
        filter.platform = platform.toLowerCase();
      }
      return await User.find(filter).limit(20);
    },

    // Tasks queries
    tasks: async (_, { platform, status, limit = 10, offset = 0 }) => {
      const filter = {};
      if (platform) filter.platform = platform.toLowerCase();
      if (status) filter.status = status.toLowerCase();
      
      return await Task.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset);
    },

    task: async (_, { id }) => {
      return await Task.findById(id);
    },

    pendingTasks: async (_, { platform }) => {
      const filter = { status: 'pending' };
      if (platform) filter.platform = platform.toLowerCase();
      
      return await Task.find(filter)
        .sort({ priority: -1, createdAt: 1 });
    },

    // Analytics queries
    analytics: async (_, { timeRange = 30 }) => {
      const since = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      
      const [totalPosts, totalUsers, totalTasks, platforms, trends] = await Promise.all([
        Post.countDocuments({ createdAt: { $gte: since } }),
        User.countDocuments({ createdAt: { $gte: since } }),
        Task.countDocuments({ createdAt: { $gte: since } }),
        getPlatformAnalytics(since),
        getTrends(timeRange)
      ]);

      const successfulTasks = await Task.countDocuments({
        createdAt: { $gte: since },
        status: 'completed'
      });

      const engagement = await getEngagementMetrics(since);

      return {
        summary: {
          totalPosts,
          totalUsers,
          totalTasks,
          successRate: totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0
        },
        platforms,
        engagement,
        trends
      };
    },

    platformAnalytics: async (_, { platform, timeRange = 30 }) => {
      const since = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      const platformLower = platform.toLowerCase();
      
      const [posts, users] = await Promise.all([
        Post.countDocuments({ platform: platformLower, createdAt: { $gte: since } }),
        User.countDocuments({ platform: platformLower, createdAt: { $gte: since } })
      ]);

      const engagement = await getEngagementMetrics(since, platformLower);

      return {
        platform: platform.toUpperCase(),
        posts,
        users,
        engagement: engagement.avgTotalEngagement || 0
      };
    },

    trends: async (_, { timeRange = 7 }) => {
      return await getTrends(timeRange);
    },

    realTimeStats: async () => {
      // Real-time analytics - last 24 hours
      return await resolvers.Query.analytics(null, { timeRange: 1 });
    }
  },

  Mutation: {
    // Posts mutations
    createPost: async (_, { input }) => {
      const postData = {
        ...input,
        platform: input.platform.toLowerCase(),
        posted: false
      };
      
      const post = new Post(postData);
      await post.save();
      
      console.log(`📅 Post scheduled for ${post.scheduledTime} on ${post.platform}`);
      return post;
    },

    updatePost: async (_, { id, input }) => {
      const updateData = { ...input };
      if (input.platform) {
        updateData.platform = input.platform.toLowerCase();
      }
      
      const post = await Post.findByIdAndUpdate(id, updateData, { new: true });
      if (!post) throw new Error('Post not found');
      
      return post;
    },

    deletePost: async (_, { id }) => {
      const post = await Post.findByIdAndDelete(id);
      return !!post;
    },

    publishPost: async (_, { id }) => {
      const post = await Post.findById(id);
      if (!post) throw new Error('Post not found');
      
      // Here you would trigger the actual publishing logic
      // For now, just mark as posted
      post.posted = true;
      await post.save();
      
      return post;
    },

    // Tasks mutations
    createTask: async (_, { input }) => {
      const taskData = {
        ...input,
        platform: input.platform.toLowerCase(),
        type: input.type.toLowerCase(),
        status: 'pending'
      };
      
      const task = new Task(taskData);
      await task.save();
      
      console.log(`🎯 Task created: ${task.type} on ${task.platform}`);
      return task;
    },

    updateTask: async (_, { id, input }) => {
      const updateData = { ...input };
      if (input.status) {
        updateData.status = input.status.toLowerCase();
      }
      
      const task = await Task.findByIdAndUpdate(id, updateData, { new: true });
      if (!task) throw new Error('Task not found');
      
      return task;
    },

    deleteTask: async (_, { id }) => {
      const task = await Task.findByIdAndDelete(id);
      return !!task;
    },

    executeTask: async (_, { id }) => {
      const task = await Task.findById(id);
      if (!task) throw new Error('Task not found');
      
      // Here you would trigger the actual task execution
      // For now, just mark as completed
      task.status = 'completed';
      task.executedTime = new Date();
      task.result = {
        success: true,
        message: 'Task executed via GraphQL',
        data: null
      };
      await task.save();
      
      return task;
    },

    // Users mutations
    createUser: async (_, { input }) => {
      const userData = {
        ...input,
        platform: input.platform.toLowerCase()
      };
      
      const user = new User(userData);
      await user.save();
      
      return user;
    },

    updateUser: async (_, { id, input }) => {
      const updateData = { ...input };
      if (input.platform) {
        updateData.platform = input.platform.toLowerCase();
      }
      
      const user = await User.findByIdAndUpdate(id, updateData, { new: true });
      if (!user) throw new Error('User not found');
      
      return user;
    },

    deleteUser: async (_, { id }) => {
      const user = await User.findByIdAndDelete(id);
      return !!user;
    },

    // Bulk operations
    createBulkTasks: async (_, { inputs }) => {
      const tasks = inputs.map(input => ({
        ...input,
        platform: input.platform.toLowerCase(),
        type: input.type.toLowerCase(),
        status: 'pending'
      }));
      
      const createdTasks = await Task.insertMany(tasks);
      console.log(`🎯 Created ${createdTasks.length} bulk tasks`);
      
      return createdTasks;
    },

    scheduleBulkPosts: async (_, { inputs }) => {
      const posts = inputs.map(input => ({
        ...input,
        platform: input.platform.toLowerCase(),
        posted: false
      }));
      
      const createdPosts = await Post.insertMany(posts);
      console.log(`📅 Scheduled ${createdPosts.length} bulk posts`);
      
      return createdPosts;
    }
  },

  // Subscriptions would go here when implementing real-time features
  Subscription: {
    taskUpdated: {
      // Will implement with subscription server
      subscribe: () => {
        // Placeholder for real-time subscriptions
      }
    }
  }
};

// Helper functions
async function getPlatformAnalytics(since) {
  const platforms = ['twitter', 'instagram', 'facebook'];
  const analytics = [];
  
  for (const platform of platforms) {
    const [posts, users] = await Promise.all([
      Post.countDocuments({ platform, createdAt: { $gte: since } }),
      User.countDocuments({ platform, createdAt: { $gte: since } })
    ]);
    
    const engagement = await getEngagementMetrics(since, platform);
    
    analytics.push({
      platform: platform.toUpperCase(),
      posts,
      users,
      engagement: engagement.avgTotalEngagement || 0
    });
  }
  
  return analytics;
}

async function getEngagementMetrics(since, platform = null) {
  const filter = { 
    posted: true, 
    createdAt: { $gte: since } 
  };
  if (platform) filter.platform = platform;
  
  const posts = await Post.find(filter);
  
  if (posts.length === 0) {
    return {
      avgLikes: 0,
      avgRetweets: 0,
      avgReplies: 0,
      totalEngagement: 0,
      avgTotalEngagement: 0
    };
  }
  
  const totals = posts.reduce((acc, post) => ({
    likes: acc.likes + (post.metadata?.likes || 0),
    retweets: acc.retweets + (post.metadata?.retweets || 0),
    replies: acc.replies + (post.metadata?.replies || 0)
  }), { likes: 0, retweets: 0, replies: 0 });
  
  const avgLikes = totals.likes / posts.length;
  const avgRetweets = totals.retweets / posts.length;
  const avgReplies = totals.replies / posts.length;
  
  return {
    avgLikes,
    avgRetweets,
    avgReplies,
    totalEngagement: totals.likes + totals.retweets + totals.replies,
    avgTotalEngagement: avgLikes + avgRetweets + avgReplies
  };
}

async function getTrends(timeRange) {
  const since = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
  
  const trends = await Post.aggregate([
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
  
  return trends.map(trend => ({
    hashtag: trend._id,
    count: trend.count,
    platforms: trend.platforms.map(p => p.toUpperCase()),
    timestamp: new Date()
  }));
}

module.exports = resolvers;
