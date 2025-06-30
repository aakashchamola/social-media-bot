const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3000';
const SERVER_START_DELAY = 8000; // 8 seconds for server to start

class ComprehensiveAPITester {
  constructor() {
    this.server = null;
    this.results = {
      passed: 0,
      failed: 0,
      errors: [],
      testDetails: []
    };
    this.testData = {
      postId: null,
      userId: null,
      taskId: null
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const colors = {
      info: '\x1b[36m',     // Cyan
      success: '\x1b[32m',  // Green
      error: '\x1b[31m',    // Red
      warning: '\x1b[33m',  // Yellow
      server: '\x1b[35m',   // Magenta
      reset: '\x1b[0m'      // Reset
    };
    
    const prefix = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      server: '🚀'
    }[type];
    
    console.log(`${colors[type]}${prefix} [${timestamp}] ${message}${colors.reset}`);
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.log('🔄 Starting Social Media Bot Server...', 'server');
      
      // Kill any existing process on port 3000
      this.killExistingProcess();
      
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
          setTimeout(resolve, 2000); // Give extra time for full initialization
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
        if (!error.includes('DeprecationWarning')) { // Ignore deprecation warnings
          this.log(`Server Error: ${error.trim()}`, 'warning');
        }
      });

      this.server.on('error', (error) => {
        this.log(`Failed to start server: ${error.message}`, 'error');
        reject(error);
      });

      this.server.on('exit', (code) => {
        if (code !== 0 && !serverReady) {
          this.log(`Server exited with code ${code}`, 'error');
          this.log(`Startup output: ${startupOutput}`, 'error');
          reject(new Error(`Server failed to start (exit code ${code})`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!serverReady) {
          this.log('Server startup timeout!', 'error');
          this.log(`Last output: ${startupOutput}`, 'error');
          reject(new Error('Server startup timeout'));
        }
      }, 30000);
    });
  }

  killExistingProcess() {
    try {
      const { exec } = require('child_process');
      exec('lsof -ti:3000 | xargs kill -9', (error) => {
        if (!error) {
          this.log('Killed existing process on port 3000', 'info');
        }
      });
    } catch (error) {
      // Ignore errors when trying to kill existing process
    }
  }

  async stopServer() {
    if (this.server) {
      this.log('🛑 Stopping server...', 'server');
      this.server.kill('SIGTERM');
      
      // Force kill if not stopped in 5 seconds
      setTimeout(() => {
        if (this.server) {
          this.server.kill('SIGKILL');
          this.log('Force killed server', 'warning');
        }
      }, 5000);
    }
  }

  async testAPI(method, endpoint, data = null, expectedStatus = 200, description = '', shouldSucceed = true) {
    try {
      const testStart = Date.now();
      this.log(`🧪 Testing ${method.toUpperCase()} ${endpoint} - ${description}`, 'info');
      
      const config = {
        method: method.toLowerCase(),
        url: `${BASE_URL}${endpoint}`,
        timeout: 15000,
        validateStatus: () => true, // Don't throw on HTTP error status
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      if (data && (method.toLowerCase() === 'post' || method.toLowerCase() === 'put')) {
        config.data = data;
      } else if (data && method.toLowerCase() === 'get') {
        config.params = data;
      }

      const response = await axios(config);
      const duration = Date.now() - testStart;
      
      const testResult = {
        method,
        endpoint,
        description,
        status: response.status,
        expectedStatus,
        duration,
        success: response.status === expectedStatus,
        data: response.data
      };

      if (response.status === expectedStatus) {
        this.log(`  ✅ ${method} ${endpoint} (${response.status}) - ${duration}ms`, 'success');
        if (response.data && typeof response.data === 'object') {
          this.log(`  📊 Response: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`, 'info');
        }
        this.results.passed++;
        
        // Store test data for later use
        if (shouldSucceed && response.data && response.data.data) {
          if (endpoint.includes('/schedule') && method === 'POST') {
            this.testData.postId = response.data.data._id;
            this.log(`  💾 Stored Post ID: ${this.testData.postId}`, 'info');
          }
          if (endpoint.includes('/users') && method === 'POST') {
            this.testData.userId = response.data.data._id;
            this.log(`  💾 Stored User ID: ${this.testData.userId}`, 'info');
          }
          if (endpoint.includes('/interact') && method === 'POST') {
            this.testData.taskId = response.data.data._id;
            this.log(`  💾 Stored Task ID: ${this.testData.taskId}`, 'info');
          }
        }
      } else {
        this.log(`  ❌ ${method} ${endpoint} - Expected ${expectedStatus}, got ${response.status} (${duration}ms)`, 'error');
        this.log(`  📄 Response: ${JSON.stringify(response.data, null, 2)}`, 'error');
        this.results.failed++;
        this.results.errors.push({
          endpoint,
          method,
          expectedStatus,
          actualStatus: response.status,
          response: response.data,
          description
        });
      }

      this.results.testDetails.push(testResult);
      return response.data;
      
    } catch (error) {
      this.log(`  💥 ${method} ${endpoint} - Network Error: ${error.message}`, 'error');
      this.results.failed++;
      this.results.errors.push({
        endpoint,
        method,
        error: error.message,
        description,
        type: 'network_error'
      });
      return null;
    }
  }

  async waitForServer() {
    this.log('⏳ Waiting for server to be ready...', 'info');
    const maxAttempts = 20;
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(`${BASE_URL}/`, { timeout: 5000 });
        if (response.status === 200) {
          this.log('🎯 Server is responding!', 'success');
          return true;
        }
      } catch (error) {
        this.log(`Attempt ${i + 1}/${maxAttempts} - Server not ready yet...`, 'warning');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Server did not become ready in time');
  }

  async runAllTests() {
    try {
      this.log('\n🚀 === COMPREHENSIVE API TESTING STARTED ===', 'server');
      
      // Test 1: Health Check
      this.log('\n📋 === HEALTH CHECK ===', 'info');
      await this.testAPI('GET', '/', null, 200, 'Server health check');

      // Test 2: Schedule API
      this.log('\n📅 === SCHEDULE API TESTS ===', 'info');
      
      // Get all scheduled posts
      await this.testAPI('GET', '/api/schedule', null, 200, 'Get all scheduled posts');
      
      // Schedule a new post
      const newPost = {
        content: `Test post created at ${new Date().toISOString()}`,
        platform: 'twitter',
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        hashtags: ['test', 'automation', 'bot'],
        mentions: ['testuser'],
        mediaUrls: []
      };
      
      await this.testAPI('POST', '/api/schedule', newPost, 201, 'Schedule new post');
      
      // Get upcoming posts
      await this.testAPI('GET', '/api/schedule/upcoming', null, 200, 'Get upcoming scheduled posts');
      
      // Get specific post if we have an ID
      if (this.testData.postId) {
        await this.testAPI('GET', `/api/schedule/${this.testData.postId}`, null, 200, 'Get specific post by ID');
        
        // Update the post
        const updateData = {
          content: 'Updated test post content',
          hashtags: ['updated', 'test']
        };
        await this.testAPI('PUT', `/api/schedule/${this.testData.postId}`, updateData, 200, 'Update scheduled post');
      }

      // Test 3: User API
      this.log('\n👥 === USER API TESTS ===', 'info');
      
      // Get all users
      await this.testAPI('GET', '/api/users', null, 200, 'Get all users');
      
      // Add a new user
      const newUser = {
        username: `testuser_${Date.now()}`,
        platform: 'twitter',
        userId: `test_${Date.now()}`,
        displayName: 'Test User',
        bio: 'This is a test user created by the API tester',
        followers: 1000,
        following: 500,
        postsCount: 250,
        verified: false,
        tags: ['test', 'automation']
      };
      
      await this.testAPI('POST', '/api/users', newUser, 201, 'Add new user');
      
      // Search users
      await this.testAPI('GET', '/api/users/search', { q: 'test', limit: 5 }, 200, 'Search users');
      
      // Get users by platform
      await this.testAPI('GET', '/api/users/platform/twitter', null, 200, 'Get Twitter users');

      // Test 4: Interaction API
      this.log('\n🤖 === INTERACTION API TESTS ===', 'info');
      
      // Get all interaction tasks
      await this.testAPI('GET', '/api/interact', null, 200, 'Get all interaction tasks');
      
      // Create a new interaction task
      const newTask = {
        type: 'like',
        platform: 'twitter',
        target: 'test_hashtag',
        action: 'like posts with #test_hashtag',
        priority: 3,
        metadata: {
          filters: { hashtag: 'test_hashtag' },
          limits: { maxActions: 10 }
        }
      };
      
      await this.testAPI('POST', '/api/interact', newTask, 201, 'Create interaction task');

      // Test 5: Analytics API
      this.log('\n📊 === ANALYTICS API TESTS ===', 'info');
      
      // Get dashboard analytics
      await this.testAPI('GET', '/api/analytics', null, 200, 'Get dashboard analytics');
      
      // Get platform analytics
      await this.testAPI('GET', '/api/analytics/platform/twitter', null, 200, 'Get Twitter analytics');
      
      // Get interaction analytics
      await this.testAPI('GET', '/api/analytics/interactions', null, 200, 'Get interaction analytics');
      
      // Get post analytics
      await this.testAPI('GET', '/api/analytics/posts', null, 200, 'Get post analytics');
      
      // Get task analytics
      await this.testAPI('GET', '/api/analytics/tasks', null, 200, 'Get task analytics');

      // Test 6: Error Handling
      this.log('\n🚨 === ERROR HANDLING TESTS ===', 'info');
      
      // Test 404 error
      await this.testAPI('GET', '/api/nonexistent', null, 404, 'Test 404 error', false);
      
      // Test invalid data
      await this.testAPI('POST', '/api/schedule', { invalid: 'data' }, 400, 'Test invalid schedule data', false);
      
      // Test invalid platform
      await this.testAPI('GET', '/api/analytics/platform/invalid', null, 400, 'Test invalid platform', false);

      // Test 7: Pagination and Filtering
      this.log('\n🔍 === PAGINATION & FILTERING TESTS ===', 'info');
      
      // Test pagination
      await this.testAPI('GET', '/api/users', { page: 1, limit: 5 }, 200, 'Test user pagination');
      
      // Test filtering
      await this.testAPI('GET', '/api/schedule', { platform: 'twitter', posted: false }, 200, 'Test schedule filtering');

      // Cleanup: Delete created resources
      this.log('\n🧹 === CLEANUP ===', 'info');
      
      if (this.testData.postId) {
        await this.testAPI('DELETE', `/api/schedule/${this.testData.postId}`, null, 200, 'Delete test post');
      }
      
      if (this.testData.userId) {
        await this.testAPI('DELETE', `/api/users/${this.testData.userId}`, null, 200, 'Delete test user');
      }

    } catch (error) {
      this.log(`Critical error during testing: ${error.message}`, 'error');
      this.results.errors.push({
        type: 'critical_error',
        error: error.message,
        stack: error.stack
      });
    }
  }

  printResults() {
    this.log('\n📊 === COMPREHENSIVE TEST RESULTS ===', 'info');
    this.log(`Total Tests: ${this.results.passed + this.results.failed}`, 'info');
    this.log(`✅ Passed: ${this.results.passed}`, 'success');
    this.log(`❌ Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'success');
    
    if (this.results.errors.length > 0) {
      this.log('\n🔍 === DETAILED ERROR REPORT ===', 'error');
      this.results.errors.forEach((error, index) => {
        this.log(`\n${index + 1}. ${error.endpoint || 'Unknown'} (${error.method || 'Unknown'})`, 'error');
        this.log(`   Description: ${error.description || 'N/A'}`, 'error');
        if (error.expectedStatus && error.actualStatus) {
          this.log(`   Expected: ${error.expectedStatus}, Got: ${error.actualStatus}`, 'error');
        }
        if (error.error) {
          this.log(`   Error: ${error.error}`, 'error');
        }
        if (error.response) {
          this.log(`   Response: ${JSON.stringify(error.response, null, 2)}`, 'error');
        }
      });
    }

    // Performance summary
    const successfulTests = this.results.testDetails.filter(t => t.success);
    if (successfulTests.length > 0) {
      const avgDuration = successfulTests.reduce((sum, t) => sum + t.duration, 0) / successfulTests.length;
      const maxDuration = Math.max(...successfulTests.map(t => t.duration));
      const minDuration = Math.min(...successfulTests.map(t => t.duration));
      
      this.log('\n⚡ === PERFORMANCE SUMMARY ===', 'info');
      this.log(`Average Response Time: ${avgDuration.toFixed(2)}ms`, 'info');
      this.log(`Fastest Response: ${minDuration}ms`, 'info');
      this.log(`Slowest Response: ${maxDuration}ms`, 'info');
    }

    // Overall result
    const success = this.results.failed === 0;
    const successRate = ((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1);
    
    this.log(`\n🎯 Success Rate: ${successRate}%`, success ? 'success' : 'warning');
    this.log(`\n🏁 === OVERALL RESULT: ${success ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'} ===`, 
      success ? 'success' : 'error');
    
    return success;
  }
}

// Main execution
async function main() {
  const tester = new ComprehensiveAPITester();
  
  // Handle graceful shutdown
  const cleanup = async () => {
    console.log('\n🛑 Received termination signal, cleaning up...');
    await tester.stopServer();
    process.exit(1);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  try {
    // Start server and wait for it to be ready
    await tester.startServer();
    await tester.waitForServer();
    
    // Run all tests
    await tester.runAllTests();
    
  } catch (error) {
    tester.log(`Failed to run tests: ${error.message}`, 'error');
    console.error(error.stack);
    return false;
  } finally {
    // Print results
    const success = tester.printResults();
    
    // Stop server
    await tester.stopServer();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  }
}

// Export for programmatic use
module.exports = ComprehensiveAPITester;

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
