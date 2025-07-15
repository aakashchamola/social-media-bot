#!/usr/bin/env node

const { TwitterService } = require('./src/services/twitterService');
const { RedditService } = require('./src/services/redditService');
const { InstagramService } = require('./src/services/instagramService');
const { FacebookService } = require('./src/services/facebookService');

require('dotenv').config();

class PlatformTester {
  constructor() {
    this.results = {
      twitter: { configured: false, connected: false },
      reddit: { configured: false, connected: false },
      instagram: { configured: false, connected: false },
      facebook: { configured: false, connected: false }
    };
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m',  // Green
      warning: '\x1b[33m',  // Yellow
      error: '\x1b[31m',    // Red
      reset: '\x1b[0m'      // Reset
    };
    
    const color = colors[type] || colors.info;
    console.log(`${color}${message}${colors.reset}`);
  }

  async testPlatforms() {
    this.log('\n🚀 Testing Social Media Platform Connections\n', 'info');
    this.log('=' * 60, 'info');

    // Test Twitter
    await this.testTwitter();
    
    // Test Reddit
    await this.testReddit();
    
    // Test Instagram
    await this.testInstagram();
    
    // Test Facebook
    await this.testFacebook();

    // Show summary
    this.showSummary();
  }

  async testTwitter() {
    this.log('\n🐦 Testing Twitter/X API...', 'info');
    
    try {
      const twitter = new TwitterService();
      this.results.twitter.configured = twitter.isConfigured();
      
      if (this.results.twitter.configured) {
        this.log('✅ Twitter credentials configured', 'success');
        
        // Test rate limit endpoint (doesn't require posting)
        const rateLimit = await twitter.getRateLimitStatus();
        if (rateLimit.configured) {
          this.results.twitter.connected = true;
          this.log('✅ Twitter API connection successful', 'success');
        } else {
          this.log('❌ Twitter API connection failed', 'error');
        }
      } else {
        this.log('⚠️ Twitter credentials not configured', 'warning');
        this.log('   Set TWITTER_API_KEY, TWITTER_API_SECRET, etc. in .env', 'warning');
      }
    } catch (error) {
      this.log(`❌ Twitter error: ${error.message}`, 'error');
    }
  }

  async testReddit() {
    this.log('\n🤖 Testing Reddit API...', 'info');
    
    try {
      const reddit = new RedditService();
      this.results.reddit.configured = reddit.isConfigured();
      
      if (this.results.reddit.configured) {
        this.log('✅ Reddit credentials configured', 'success');
        
        // Test by getting rate limit status
        const rateLimit = await reddit.getRateLimitStatus();
        if (rateLimit.configured) {
          this.results.reddit.connected = true;
          this.log('✅ Reddit API connection successful', 'success');
        } else {
          this.log('❌ Reddit API connection failed', 'error');
        }
      } else {
        this.log('⚠️ Reddit credentials not configured', 'warning');
        this.log('   Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, etc. in .env', 'warning');
      }
    } catch (error) {
      this.log(`❌ Reddit error: ${error.message}`, 'error');
    }
  }

  async testInstagram() {
    this.log('\n📸 Testing Instagram API...', 'info');
    
    try {
      const instagram = new InstagramService();
      this.results.instagram.configured = instagram.isConfigured();
      
      if (this.results.instagram.configured) {
        this.log('✅ Instagram credentials configured', 'success');
        
        // Test by getting rate limit status
        const rateLimit = await instagram.getRateLimitStatus();
        if (rateLimit.configured) {
          this.results.instagram.connected = true;
          this.log('✅ Instagram API connection successful', 'success');
        } else {
          this.log('❌ Instagram API connection failed', 'error');
        }
      } else {
        this.log('⚠️ Instagram credentials not configured', 'warning');
        this.log('   Set INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID in .env', 'warning');
      }
    } catch (error) {
      this.log(`❌ Instagram error: ${error.message}`, 'error');
    }
  }

  async testFacebook() {
    this.log('\n📘 Testing Facebook API...', 'info');
    
    try {
      const facebook = new FacebookService();
      this.results.facebook.configured = facebook.isConfigured();
      
      if (this.results.facebook.configured) {
        this.log('✅ Facebook credentials configured', 'success');
        
        // Test by getting rate limit status
        const rateLimit = await facebook.getRateLimitStatus();
        if (rateLimit.configured) {
          this.results.facebook.connected = true;
          this.log('✅ Facebook API connection successful', 'success');
        } else {
          this.log('❌ Facebook API connection failed', 'error');
        }
      } else {
        this.log('⚠️ Facebook credentials not configured', 'warning');
        this.log('   Set FACEBOOK_ACCESS_TOKEN, FACEBOOK_PAGE_ID in .env', 'warning');
      }
    } catch (error) {
      this.log(`❌ Facebook error: ${error.message}`, 'error');
    }
  }

  showSummary() {
    this.log('\n📊 Platform Connection Summary:', 'info');
    this.log('=' * 40, 'info');
    
    Object.entries(this.results).forEach(([platform, status]) => {
      const name = platform.charAt(0).toUpperCase() + platform.slice(1);
      const configStatus = status.configured ? '✅' : '❌';
      const connectStatus = status.connected ? '✅' : '❌';
      
      this.log(`${name.padEnd(12)} Config: ${configStatus} | Connected: ${connectStatus}`, 'info');
    });

    const totalConfigured = Object.values(this.results).filter(r => r.configured).length;
    const totalConnected = Object.values(this.results).filter(r => r.connected).length;
    
    this.log(`\n📈 Summary: ${totalConfigured}/4 configured, ${totalConnected}/4 connected`, 'info');
    
    if (totalConnected === 0) {
      this.log('\n⚠️ No platforms connected. Please set up API credentials.', 'warning');
      this.log('📖 See SETUP.md for detailed setup instructions.', 'info');
    } else if (totalConnected < 4) {
      this.log('\n✨ Some platforms connected! Add more credentials for full functionality.', 'success');
    } else {
      this.log('\n🎉 All platforms connected! Your bot is ready to go!', 'success');
    }
  }
}

// Run the test
if (require.main === module) {
  const tester = new PlatformTester();
  tester.testPlatforms().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = PlatformTester;
