const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { schedulePost, scheduleTask } = require('../controllers/scheduler');

// GET /api/schedule - Get all scheduled posts
router.get('/', async (req, res) => {
  try {
    const { platform, posted, page = 1, limit = 10 } = req.query;
    
    const filter = {};
    if (platform) filter.platform = platform;
    if (posted !== undefined) filter.posted = posted === 'true';

    const skip = (page - 1) * parseInt(limit);
    
    const posts = await Post.find(filter)
      .sort({ scheduledTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(filter);

    res.json({
      success: true,
      data: posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching scheduled posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled posts',
      error: error.message
    });
  }
});

// POST /api/schedule - Schedule a new post
router.post('/', async (req, res) => {
  try {
    const {
      content,
      platform,
      scheduledTime,
      mediaUrls = [],
      hashtags = [],
      mentions = []
    } = req.body;

    // Validation
    if (!content || !platform || !scheduledTime) {
      return res.status(400).json({
        success: false,
        message: 'Content, platform, and scheduledTime are required'
      });
    }

    if (!['twitter', 'instagram', 'facebook'].includes(platform)) {
      return res.status(400).json({
        success: false,
        message: 'Platform must be twitter, instagram, or facebook'
      });
    }

    const scheduleDate = new Date(scheduledTime);
    if (scheduleDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Scheduled time must be in the future'
      });
    }

    const postData = {
      content,
      platform,
      scheduledTime: scheduleDate,
      mediaUrls,
      hashtags,
      mentions
    };

    const post = await schedulePost(postData);

    res.status(201).json({
      success: true,
      message: 'Post scheduled successfully',
      data: post
    });
  } catch (error) {
    console.error('❌ Error scheduling post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule post',
      error: error.message
    });
  }
});

// GET /api/schedule/upcoming - Get upcoming scheduled posts
router.get('/upcoming', async (req, res) => {
  try {
    const { platform, limit = 10 } = req.query;
    
    const filter = {
      posted: false,
      scheduledTime: { $gte: new Date() }
    };
    
    if (platform) {
      filter.platform = platform;
    }

    const posts = await Post.find(filter)
      .sort({ scheduledTime: 1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: posts
    });
  } catch (error) {
    console.error('❌ Error fetching upcoming posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming posts',
      error: error.message
    });
  }
});

// GET /api/schedule/:id - Get specific post details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error('❌ Error fetching post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch post',
      error: error.message
    });
  }
});

// PUT /api/schedule/:id - Update a scheduled post
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    if (post.posted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a post that has already been published'
      });
    }

    // Validate scheduledTime if provided
    if (updates.scheduledTime) {
      const scheduleDate = new Date(updates.scheduledTime);
      if (scheduleDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Scheduled time must be in the future'
        });
      }
      updates.scheduledTime = scheduleDate;
    }

    const updatedPost = await Post.findByIdAndUpdate(id, updates, { new: true });

    res.json({
      success: true,
      message: 'Post updated successfully',
      data: updatedPost
    });
  } catch (error) {
    console.error('❌ Error updating scheduled post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update post',
      error: error.message
    });
  }
});

// DELETE /api/schedule/:id - Cancel a scheduled post
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    if (post.posted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a post that has already been published'
      });
    }

    await Post.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Scheduled post cancelled successfully'
    });
  } catch (error) {
    console.error('❌ Error cancelling scheduled post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel post',
      error: error.message
    });
  }
});

module.exports = router;
