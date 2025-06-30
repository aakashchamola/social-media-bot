const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const { createInteractionTasks, findUsersForInteraction } = require('../controllers/interactions');

// GET /api/users - Get all users with filtering and pagination
router.get('/users', async (req, res) => {
  try {
    const {
      platform,
      verified,
      minFollowers,
      maxFollowers,
      page = 1,
      limit = 20,
      sortBy = 'followers',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    if (platform) filter.platform = platform;
    if (verified !== undefined) filter.verified = verified === 'true';
    if (minFollowers) filter.followers = { $gte: parseInt(minFollowers) };
    if (maxFollowers) {
      filter.followers = { ...filter.followers, $lte: parseInt(maxFollowers) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-interactionHistory'); // Exclude interaction history for performance

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// GET /api/users/search - Search users
router.get('/users/search', async (req, res) => {
  try {
    const { q, platform, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query (q) is required'
      });
    }

    const filter = {
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } }
      ]
    };

    if (platform) {
      filter.platform = platform;
    }

    const users = await User.find(filter)
      .sort({ followers: -1 })
      .limit(parseInt(limit))
      .select('username displayName platform followers verified bio');

    res.json({
      success: true,
      data: users,
      count: users.length,
      query: q
    });
  } catch (error) {
    console.error('❌ Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
      error: error.message
    });
  }
});

// GET /api/users/:id - Get specific user details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeHistory = false } = req.query;

    let query = User.findById(id);
    if (!includeHistory) {
      query = query.select('-interactionHistory');
    }

    const user = await query;
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get recent interaction stats
    const recentInteractions = await Task.find({
      platform: user.platform,
      $or: [
        { target: user.username },
        { 'metadata.username': user.username }
      ],
      executedTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    }).sort({ executedTime: -1 });

    res.json({
      success: true,
      data: {
        ...user.toObject(),
        recentInteractions: recentInteractions.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

// POST /api/users - Add or update a user
router.post('/users', async (req, res) => {
  try {
    const {
      username,
      platform,
      userId,
      displayName,
      bio,
      profileImage,
      followers,
      following,
      postsCount,
      verified = false,
      tags = []
    } = req.body;

    // Validation
    if (!username || !platform || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Username, platform, and userId are required'
      });
    }

    if (!['twitter', 'reddit', 'instagram'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Platform must be twitter, reddit, or instagram'
      });
    }

    const userData = {
      username,
      platform,
      userId,
      displayName,
      bio,
      profileImage,
      followers: followers || 0,
      following: following || 0,
      postsCount: postsCount || 0,
      verified,
      tags
    };

    const user = await User.findOneAndUpdate(
      { platform, userId },
      userData,
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: 'User added/updated successfully',
      data: user
    });
  } catch (error) {
    console.error('❌ Error adding/updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add/update user',
      error: error.message
    });
  }
});

// PUT /api/users/:id - Update user information
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.userId;
    delete updates.platform;
    delete updates.interactionHistory;
    delete updates.metrics;

    const user = await User.findByIdAndUpdate(id, updates, { new: true });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// DELETE /api/users/:id - Delete a user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// GET /api/users/platform/:platform - Get users by platform
router.get('/users/platform/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { 
      limit = 50,
      minFollowers = 0,
      verified,
      sortBy = 'followers'
    } = req.query;

    if (!['twitter', 'reddit', 'instagram'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform'
      });
    }

    const filter = { 
      platform,
      followers: { $gte: parseInt(minFollowers) }
    };

    if (verified !== undefined) {
      filter.verified = verified === 'true';
    }

    const sort = {};
    sort[sortBy] = -1;

    const users = await User.find(filter)
      .sort(sort)
      .limit(parseInt(limit))
      .select('username displayName followers verified tags');

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('❌ Error fetching platform users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform users',
      error: error.message
    });
  }
});

// POST /api/users/import - Bulk import users
router.post('/users/import', async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Users array is required'
      });
    }

    if (users.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Cannot import more than 1000 users at once'
      });
    }

    const imported = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      try {
        const userData = users[i];
        
        if (!userData.username || !userData.platform || !userData.userId) {
          errors.push({
            index: i,
            message: 'Username, platform, and userId are required'
          });
          continue;
        }

        const user = await User.findOneAndUpdate(
          { platform: userData.platform, userId: userData.userId },
          userData,
          { upsert: true, new: true }
        );

        imported.push(user);
      } catch (error) {
        errors.push({
          index: i,
          message: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Imported ${imported.length} users`,
      data: {
        imported: imported.length,
        errors: errors.length,
        errorDetails: errors
      }
    });
  } catch (error) {
    console.error('❌ Error importing users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import users',
      error: error.message
    });
  }
});

// POST /api/users/interactions/bulk - Create bulk interaction tasks
router.post('/users/interactions/bulk', async (req, res) => {
  try {
    const { 
      platform,
      type,
      userIds,
      action,
      priority = 1
    } = req.body;

    if (!platform || !type || !Array.isArray(userIds) || !action) {
      return res.status(400).json({
        success: false,
        message: 'Platform, type, userIds array, and action are required'
      });
    }

    if (userIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create more than 100 interaction tasks at once'
      });
    }

    // Get usernames for the user IDs
    const users = await User.find({
      _id: { $in: userIds },
      platform: platform
    }).select('username');

    const targets = users.map(user => user.username);

    const tasks = await createInteractionTasks(platform, {
      type,
      targets,
      action,
      priority
    });

    res.status(201).json({
      success: true,
      message: `Created ${tasks.length} interaction tasks`,
      data: tasks
    });
  } catch (error) {
    console.error('❌ Error creating bulk interactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create interaction tasks',
      error: error.message
    });
  }
});

// GET /api/users/recommendations - Get user recommendations for interaction
router.get('/users/recommendations', async (req, res) => {
  try {
    const {
      platform,
      minFollowers = 100,
      maxFollowers = 10000,
      verified = false,
      excludeBots = true,
      limit = 10
    } = req.query;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'Platform is required'
      });
    }

    const criteria = {
      minFollowers: parseInt(minFollowers),
      maxFollowers: parseInt(maxFollowers),
      verified: verified === 'true',
      excludeBots: excludeBots === 'true',
      limit: parseInt(limit)
    };

    const users = await findUsersForInteraction(platform, criteria);

    res.json({
      success: true,
      data: users,
      count: users.length,
      criteria: criteria
    });
  } catch (error) {
    console.error('❌ Error getting user recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user recommendations',
      error: error.message
    });
  }
});

module.exports = router;
