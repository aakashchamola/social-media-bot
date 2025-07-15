const axios = require('axios');
const { spawn } = require('child_process');

class PlatformTester {
  constructor() {
    this.baseURL = 'http://localhost:3000';
    this.server = null;
    this.apiTests = {
      twitter: [
        { endpoint: '/api/users', method: 'GET', description: 'Get users' },
        { endpoint: '/api/analytics/platform/twitter', method: 'GET', description: 'Twitter analytics' },
        { endpoint: '/api/schedule', method: 'POST', description: 'Schedule tweet', 
          data: { content: 'Test tweet from API', platform: 'twitter', scheduledTime: new Date(Date.now() + 60000) }
        }
      ],
      reddit: [
        { endpoint: '/api/analytics/platform/reddit', method: 'GET', description: 'Reddit analytics' },
        { endpoint: '/api/schedule', method: 'POST', description: 'Schedule Reddit post',
          data: { content: 'Test Reddit post', platform: 'reddit', scheduledTime: new Date(Date.now() + 60000) }
        }
      ],
      instagram: [
        { endpoint: '/api/analytics/platform/instagram', method: 'GET', description: 'Instagram analytics' },
        { endpoint: '/api/schedule', method: 'POST', description: 'Schedule Instagram post',
          data: { content: 'Test Instagram post', platform: 'instagram', scheduledTime: new Date(Date.now() + 60000) }
        }
      ],
      facebook: [
        { endpoint: '/api/analytics/platform/facebook', method: 'GET', description: 'Facebook analytics' },
        { endpoint: '/api/schedule', method: 'POST', description: 'Schedule Facebook post',
          data: { content: 'Test Facebook post', platform: 'facebook', scheduledTime: new Date(Date.now() + 60000) }
        }
      ]
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      error: '\x1b[31m',   // Red
      warning: '\x1b[33m', // Yellow
      server: '\x1b[35m'   // Magenta
    };
    const reset = '\x1b[0m';
    console.log(`${colors[type]}[${timestamp}] ${message}${reset}`);
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.log('🚀 Starting Social Media Bot Server...', 'info');
      
      this.server = spawn('node', ['src/app.js'], {
        stdio: 'pipe',
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let serverReady = false;
      let startupOutput = '';

      this.server.stdout.on('data', (data) => {
        const output = data.toString();
        startupOutput += output;
        
        if (output.includes('Social Media Bot Server running on port 3000')) {
          this.log('✨ Server is ready!', 'success');
          serverReady = true;
          setTimeout(resolve, 3000); // Give extra time for full initialization
        }
        
        // Log important server messages
        if (output.includes('MongoDB Connected') || 
            output.includes('schedulers initialized') ||
            output.includes('Error')) {
          this.log(`Server: ${output.trim()}`, 'server');
        }
      });

      this.server.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('DeprecationWarning')) {
          this.log(`Server Error: ${error}`, 'error');
        }
      });

      this.server.on('close', (code) => {
        if (!serverReady) {
          this.log(`Server exited with code ${code}`, 'error');
          reject(new Error(`Server failed to start (exit code: ${code})`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!serverReady) {
          this.log('❌ Server startup timeout', 'error');
          reject(new Error('Server startup timeout'));
        }
      }, 30000);
    });
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return {
        success: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 500,
        error: error.response?.data || error.message
      };
    }
  }

  async testHealthEndpoint() {
    this.log('🏥 Testing Health Endpoint...', 'info');
    
    const result = await this.makeRequest('/');
    if (result.success) {
      this.log('✅ Health endpoint working', 'success');
      return true;
    } else {
      this.log(`❌ Health endpoint failed: ${result.error}`, 'error');
      return false;
    }
  }

  async testPlatformAPIs() {
    this.log('\n🧪 Testing Platform APIs...', 'info');
    
    const results = {};
    
    for (const [platform, tests] of Object.entries(this.apiTests)) {
      this.log(`\n📱 Testing ${platform.toUpperCase()} APIs:`, 'info');
      results[platform] = [];
      
      for (const test of tests) {
        const result = await this.makeRequest(test.endpoint, test.method, test.data);
        
        if (result.success) {
          this.log(`  ✅ ${test.description}: ${result.status}`, 'success');
          results[platform].push({ ...test, success: true, status: result.status });
        } else {
          this.log(`  ❌ ${test.description}: ${result.status} - ${JSON.stringify(result.error)}`, 'error');
          results[platform].push({ ...test, success: false, status: result.status, error: result.error });
        }
      }
    }
    
    return results;
  }

  async testErrorHandling() {
    this.log('\n🚨 Testing Error Handling...', 'info');
    
    const errorTests = [
      { endpoint: '/api/nonexistent', method: 'GET', expectedStatus: 404, description: 'Test 404 error' },
      { 
        endpoint: '/api/schedule', 
        method: 'POST', 
        data: { invalid: 'data' }, 
        expectedStatus: 400, 
        description: 'Test invalid data' 
      },
      { 
        endpoint: '/api/analytics/platform/invalid', 
        method: 'GET', 
        expectedStatus: 400, 
        description: 'Test invalid platform' 
      }
    ];

    for (const test of errorTests) {
      const result = await this.makeRequest(test.endpoint, test.method, test.data);
      
      if (result.status === test.expectedStatus) {
        this.log(`  ✅ ${test.description}: ${result.status}`, 'success');
      } else {
        this.log(`  ❌ ${test.description}: Expected ${test.expectedStatus}, got ${result.status}`, 'error');
      }
      
      // Show error response for debugging
      if (!result.success) {
        console.log(`    └─ Response: ${JSON.stringify(result.error, null, 2)}`);
      }
    }
  }

  async testScheduling() {
    this.log('\n📅 Testing Scheduling System...', 'info');
    
    const scheduleTests = [
      {
        data: {
          content: 'Test scheduled post for Twitter',
          platform: 'twitter',
          scheduledTime: new Date(Date.now() + 120000) // 2 minutes from now
        },
        description: 'Schedule Twitter post'
      },
      {
        data: {
          content: 'Test scheduled post for Reddit',
          platform: 'reddit',
          scheduledTime: new Date(Date.now() + 180000) // 3 minutes from now
        },
        description: 'Schedule Reddit post'
      }
    ];

    for (const test of scheduleTests) {
      const result = await this.makeRequest('/api/schedule', 'POST', test.data);
      
      if (result.success) {
        this.log(`  ✅ ${test.description}: Post scheduled`, 'success');
        
        // Get the scheduled post
        const getResult = await this.makeRequest('/api/schedule');
        if (getResult.success) {
          this.log(`  📋 Retrieved ${getResult.data.posts?.length || 0} scheduled posts`, 'info');
        }
      } else {
        this.log(`  ❌ ${test.description}: ${result.error}`, 'error');
      }
    }
  }

  async testAnalytics() {
    this.log('\n📊 Testing Analytics...', 'info');
    
    const analyticsTests = [
      { endpoint: '/api/analytics', description: 'General analytics' },
      { endpoint: '/api/analytics/platform/twitter', description: 'Twitter analytics' },
      { endpoint: '/api/analytics/platform/reddit', description: 'Reddit analytics' },
      { endpoint: '/api/analytics/summary', description: 'Analytics summary' }
    ];

    for (const test of analyticsTests) {
      const result = await this.makeRequest(test.endpoint);
      
      if (result.success) {
        this.log(`  ✅ ${test.description}: Retrieved`, 'success');
      } else {
        this.log(`  ❌ ${test.description}: ${result.error}`, 'error');
      }
    }
  }

  async checkEnvironmentSetup() {
    this.log('\n🔧 Checking Environment Setup...', 'info');
    
    const requiredEnvVars = [
      'MONGO_URI',
      'TWITTER_API_KEY',
      'REDDIT_CLIENT_ID',
      'JWT_SECRET'
    ];

    let allConfigured = true;
    
    for (const envVar of requiredEnvVars) {
      const value = process.env[envVar];
      if (!value || value.includes('your_') || value.includes('_here')) {
        this.log(`  ⚠️  ${envVar}: Not properly configured`, 'warning');
        allConfigured = false;
      } else {
        this.log(`  ✅ ${envVar}: Configured`, 'success');
      }
    }

    if (!allConfigured) {
      this.log('\n📖 Some API credentials are not configured. The bot will run in mock mode.', 'warning');
      this.log('📚 See PLATFORM_SETUP.md for configuration instructions.', 'info');
    }

    return allConfigured;
  }

  async stopServer() {
    if (this.server) {
      this.log('🛑 Stopping server...', 'info');
      this.server.kill('SIGTERM');
      
      return new Promise((resolve) => {
        this.server.on('close', () => {
          this.log('✅ Server stopped', 'success');
          resolve();
        });
        
        // Force kill after 5 seconds
        setTimeout(() => {
          this.server.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  }

  async run() {
    console.log('🧪 Social Media Bot Comprehensive Test Suite\n');
    console.log('═'.repeat(60));
    
    try {
      // Check environment
      await this.checkEnvironmentSetup();
      
      // Start server
      await this.startServer();
      
      // Wait for server to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Run tests
      const healthOk = await this.testHealthEndpoint();
      
      if (healthOk) {
        await this.testPlatformAPIs();
        await this.testErrorHandling();
        await this.testScheduling();
        await this.testAnalytics();
      } else {
        this.log('❌ Health check failed, skipping other tests', 'error');
      }
      
    } catch (error) {
      this.log(`❌ Test suite failed: ${error.message}`, 'error');
    } finally {
      await this.stopServer();
    }
    
    console.log('\n═'.repeat(60));
    this.log('🎉 Test suite completed!', 'success');
    
    console.log('\n📋 Next Steps:');
    console.log('1. Configure real API credentials in .env file');
    console.log('2. Run: npm run setup (to test API connections)');
    console.log('3. Start the bot: npm start');
    console.log('4. Check the web interface: http://localhost:3000');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  const tester = new PlatformTester();
  tester.run().catch(console.error);
}

module.exports = PlatformTester;
