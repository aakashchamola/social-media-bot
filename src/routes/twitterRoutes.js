const express = require('express');
const router = express.Router();
const { TwitterService } = require('../services/twitterService');

// GET /api/twitter/status - Check Twitter API connection status
router.get('/status', async (req, res) => {
  try {
    const twitterService = new TwitterService();
    
    // Check if credentials are configured
    if (!twitterService.isConfigured()) {
      return res.json({
        success: false,
        configured: false,
        access: 'not-configured',
        message: 'Twitter API credentials not configured',
        features: {
          readAccess: false,
          writeAccess: false,
          posting: false,
          interactions: false
        }
      });
    }

    // Test connection with a simple API call
    try {
      const connectionTest = await twitterService.testConnection();
      
      if (connectionTest.success) {
        return res.json({
          success: true,
          configured: true,
          access: connectionTest.accessLevel || 'essential',
          message: 'Twitter API connection successful',
          features: {
            readAccess: true,
            writeAccess: connectionTest.writeAccess || false,
            posting: connectionTest.writeAccess || false,
            interactions: connectionTest.writeAccess || false
          },
          user: connectionTest.user,
          rateLimits: connectionTest.rateLimits
        });
      } else {
        return res.json({
          success: false,
          configured: true,
          access: 'error',
          message: connectionTest.message || 'Twitter API connection failed',
          error: connectionTest.error,
          features: {
            readAccess: false,
            writeAccess: false,
            posting: false,
            interactions: false
          }
        });
      }
    } catch (apiError) {
      return res.json({
        success: false,
        configured: true,
        access: 'limited',
        message: 'Limited API access detected',
        error: apiError.message,
        features: {
          readAccess: false,
          writeAccess: false,
          posting: false,
          interactions: false
        }
      });
    }

  } catch (error) {
    console.error('❌ Error checking Twitter API status:', error);
    res.status(500).json({
      success: false,
      configured: false,
      access: 'error',
      message: 'Failed to check Twitter API status',
      error: error.message,
      features: {
        readAccess: false,
        writeAccess: false,
        posting: false,
        interactions: false
      }
    });
  }
});

// GET /api/twitter/profile - Get bot's Twitter profile (read-only)
router.get('/profile', async (req, res) => {
  try {
    const twitterService = new TwitterService();
    
    if (!twitterService.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Twitter API credentials not configured'
      });
    }

    const profile = await twitterService.getMyProfile();
    
    res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    console.error('❌ Error fetching Twitter profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Twitter profile',
      error: error.message
    });
  }
});

// GET /api/twitter/user/:username - Get any user's profile and metrics
router.get('/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const twitterService = new TwitterService();
    
    const userMetrics = await twitterService.getUserMetrics(username);
    
    if (userMetrics.success) {
      res.json({
        success: true,
        data: userMetrics.user || userMetrics.data?.data
      });
    } else {
      res.status(404).json({
        success: false,
        message: `User @${username} not found`,
        error: userMetrics.error || 'User not found'
      });
    }

  } catch (error) {
    console.error('❌ Error fetching user metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user metrics',
      error: error.message
    });
  }
});

// GET /api/twitter/user/:username/tweets - Get any user's tweets
router.get('/user/:username/tweets', async (req, res) => {
  try {
    const { username } = req.params;
    const { maxResults = 10, sinceId, untilId } = req.query;
    
    const twitterService = new TwitterService();
    
    const tweets = await twitterService.getUserTweets(username, parseInt(maxResults));
    
    if (tweets.success) {
      res.json({
        success: true,
        data: {
          username,
          tweets: tweets.tweets || [],
          meta: tweets.meta || {},
          includes: tweets.includes || {}
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Could not fetch tweets for @${username}`,
        error: tweets.error || 'Tweets not available'
      });
    }

  } catch (error) {
    console.error('❌ Error fetching user tweets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user tweets',
      error: error.message
    });
  }
});

// GET /api/twitter/search/users - Search for users
router.get('/search/users', async (req, res) => {
  try {
    const { q: query, maxResults = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const twitterService = new TwitterService();
    
    if (!twitterService.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Twitter API credentials not configured'
      });
    }

    const searchResults = await twitterService.searchUsers(query, {
      maxResults: parseInt(maxResults)
    });
    
    res.json({
      success: true,
      data: {
        query,
        users: searchResults.users || [],
        count: searchResults.users?.length || 0
      }
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

// GET /api/twitter/search/tweets - Search for tweets
router.get('/search/tweets', async (req, res) => {
  try {
    const { q: query, maxResults = 10, sinceId, untilId } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const twitterService = new TwitterService();
    
    const searchResults = await twitterService.searchTweets(query, {
      maxResults: parseInt(maxResults),
      sinceId,
      untilId
    });
    
    res.json({
      success: true,
      data: {
        query,
        tweets: searchResults.tweets || [],
        meta: searchResults.meta
      }
    });

  } catch (error) {
    console.error('❌ Error searching tweets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search tweets',
      error: error.message
    });
  }
});

// POST /api/twitter/test-post - Test tweet posting (will show premium requirement)
router.post('/test-post', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Tweet content is required'
      });
    }

    const twitterService = new TwitterService();
    
    if (!twitterService.isConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Twitter API credentials not configured'
      });
    }

    // Attempt to post (this will likely fail with Essential access)
    const result = await twitterService.postTweet(content);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Tweet posted successfully!',
        data: result
      });
    } else {
      // Check if it's an access level issue
      if (result.error && result.error.includes('access to a subset')) {
        res.status(403).json({
          success: false,
          message: 'Premium feature: Tweet posting requires Elevated API access',
          error: 'ELEVATED_ACCESS_REQUIRED',
          upgradeInfo: {
            currentTier: 'Essential (Free)',
            requiredTier: 'Elevated or Basic',
            upgradeUrl: 'https://developer.twitter.com/en/portal/dashboard'
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Failed to post tweet',
          error: result.error
        });
      }
    }

  } catch (error) {
    console.error('❌ Error testing tweet post:', error);
    
    // Check if it's the specific elevated access error
    if (error.message && error.message.includes('access to a subset')) {
      res.status(403).json({
        success: false,
        message: 'Premium feature: Tweet posting requires Elevated API access',
        error: 'ELEVATED_ACCESS_REQUIRED',
        upgradeInfo: {
          currentTier: 'Essential (Free)',
          requiredTier: 'Elevated or Basic',
          upgradeUrl: 'https://developer.twitter.com/en/portal/dashboard'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to test tweet posting',
        error: error.message
      });
    }
  }
});

module.exports = router;
