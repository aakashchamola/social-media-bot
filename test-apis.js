const axios = require('axios');
const { spawn } = require('child_process');

// Configuration
const BASE_URL = 'http://localhost:3000';
const SERVER_START_DELAY = 5000; // 5 seconds for server to start

class APITester {
  constructor() {
    this.server = null;
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      server: '🚀'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.log('Starting Social Media Bot Server...', 'server');
      
      this.server = spawn('npm', ['start'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      this.server.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Social Media Bot Server running')) {
          this.log('Server started successfully', 'success');
          setTimeout(resolve, 2000); // Give extra time for initialization
        }
        console.log(`Server: ${output.trim()}`);
      });

      this.server.stderr.on('data', (data) => {
        const error = data.toString();
        console.error(`Server Error: ${error.trim()}`);
      });

      this.server.on('error', (error) => {
        this.log(`Failed to start server: ${error.message}`, 'error');
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Server start timeout'));
      }, 30000);
    });
  }

  async stopServer() {
    if (this.server) {
      this.log('Stopping server...', 'server');
      this.server.kill('SIGTERM');
      
      // Force kill if not stopped in 5 seconds
      setTimeout(() => {
        if (this.server && !this.server.killed) {
          this.server.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  async testAPI(method, endpoint, data = null, expectedStatus = 200, description = '') {
    try {
      this.log(`Testing ${method.toUpperCase()} ${endpoint} - ${description}`, 'info');
      
      const config = {
        method: method.toLowerCase(),
        url: `${BASE_URL}${endpoint}`,
        timeout: 10000,
        validateStatus: () => true // Don't throw on any status code
      };

      if (data) {
        config.data = data;
        config.headers = {
          'Content-Type': 'application/json'
        };
      }

      const response = await axios(config);
      
      if (response.status === expectedStatus) {
        this.log(`✓ ${method} ${endpoint} - Status: ${response.status}`, 'success');
        this.results.passed++;
        return response.data;
      } else {
        this.log(`✗ ${method} ${endpoint} - Expected: ${expectedStatus}, Got: ${response.status}`, 'error');
        this.log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'error');
        this.results.failed++;
        this.results.errors.push({
          endpoint,
          method,
          expected: expectedStatus,
          actual: response.status,
          response: response.data
        });
        return null;
      }
    } catch (error) {
      this.log(`✗ ${method} ${endpoint} - Error: ${error.message}`, 'error');
      this.results.failed++;
      this.results.errors.push({
        endpoint,
        method,
        error: error.message,
        stack: error.stack
      });
      return null;
    }
  }

  async runAllTests() {
    try {
      // Test 1: Health Check
      await this.testAPI('GET', '/', null, 200, 'Health check');

      // Test 2: Schedule Routes
      this.log('\n=== Testing Schedule Routes ===', 'info');
      
      // Get all scheduled posts
      await this.testAPI('GET', '/api/schedule', null, 200, 'Get all scheduled posts');
      
      // Schedule a new post
      const newPost = {
        content: 'Test post from API tester',
        platform: 'twitter',
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        hashtags: ['test', 'automation'],
        mentions: []
      };
      
      const scheduledPost = await this.testAPI('POST', '/api/schedule', newPost, 201, 'Schedule new post');
      let postId = null;
      if (scheduledPost && scheduledPost.data) {
        postId = scheduledPost.data._id;
      }

      // Get upcoming posts
      await this.testAPI('GET', '/api/schedule/upcoming', null, 200, 'Get upcoming posts');

      if (postId) {
        // Get specific post
        await this.testAPI('GET', `/api/schedule/${postId}`, null, 200, 'Get specific post');
        
        // Update post
        const updateData = {
          content: 'Updated test post from API tester',
          hashtags: ['test', 'automation', 'updated']
        };
        await this.testAPI('PUT', `/api/schedule/${postId}`, updateData, 200, 'Update scheduled post');
        
        // Delete post
        await this.testAPI('DELETE', `/api/schedule/${postId}`, null, 200, 'Delete scheduled post');
      }

      // Test 3: User Routes
      this.log('\n=== Testing User Routes ===', 'info');
      
      // Get all users
      await this.testAPI('GET', '/api/users', null, 200, 'Get all users');
      
      // Add a new user
      const newUser = {
        username: 'test_user_' + Date.now(),
        platform: 'twitter',
        userId: 'test_' + Date.now(),
        displayName: 'Test User',
        bio: 'Test user created by API tester',
        followers: 1000,
        following: 500,
        postsCount: 50,
        verified: false,
        tags: ['test', 'automation']
      };
      
      const createdUser = await this.testAPI('POST', '/api/users', newUser, 201, 'Add new user');
      let userId = null;
      if (createdUser && createdUser.data) {
        userId = createdUser.data._id;
      }

      // Search users
      await this.testAPI('GET', '/api/users/search?q=test', null, 200, 'Search users');
      
      // Get users by platform
      await this.testAPI('GET', '/api/users/platform/twitter', null, 200, 'Get Twitter users');

      if (userId) {
        // Get specific user
        await this.testAPI('GET', `/api/users/${userId}`, null, 200, 'Get specific user');
        
        // Update user
        const userUpdate = {
          bio: 'Updated test user bio',
          followers: 1100
        };
        await this.testAPI('PUT', `/api/users/${userId}`, userUpdate, 200, 'Update user');
      }

      // Test 4: Interaction Routes
      this.log('\n=== Testing Interaction Routes ===', 'info');
      
      // Get all interaction tasks
      await this.testAPI('GET', '/api/interact', null, 200, 'Get all interaction tasks');
      
      // Create a new interaction task
      const newTask = {
        type: 'like',
        platform: 'twitter',
        target: 'test_user',
        action: 'like posts with hashtag #nodejs',
        priority: 3,
        metadata: {
          filters: { hashtags: ['nodejs'] },
          limits: { maxLikes: 10 },
          settings: { delayBetweenActions: 5000 }
        }
      };
      
      const createdTask = await this.testAPI('POST', '/api/interact', newTask, 201, 'Create interaction task');
      let taskId = null;
      if (createdTask && createdTask.data) {
        taskId = createdTask.data._id;
      }

      if (taskId) {
        // Get specific task
        await this.testAPI('GET', `/api/interact/${taskId}`, null, 200, 'Get specific task');
        
        // Update task
        const taskUpdate = {
          priority: 4,
          action: 'like and comment on posts with hashtag #nodejs'
        };
        await this.testAPI('PUT', `/api/interact/${taskId}`, taskUpdate, 200, 'Update task');
        
        // Execute task (this might fail if no API keys are configured)
        await this.testAPI('POST', `/api/interact/${taskId}/execute`, null, 200, 'Execute task');
      }

      // Test 5: Analytics Routes
      this.log('\n=== Testing Analytics Routes ===', 'info');
      
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
      
      // Get user analytics
      await this.testAPI('GET', '/api/analytics/users', null, 200, 'Get user analytics');
      
      // Get trends
      await this.testAPI('GET', '/api/analytics/trends', null, 200, 'Get trends analytics');
      
      // Get real-time stats
      await this.testAPI('GET', '/api/analytics/realtime', null, 200, 'Get real-time analytics');

      // Test 6: Error Cases
      this.log('\n=== Testing Error Cases ===', 'info');
      
      // Test 404
      await this.testAPI('GET', '/api/nonexistent', null, 404, 'Test 404 error');
      
      // Test invalid data
      await this.testAPI('POST', '/api/schedule', { invalid: 'data' }, 400, 'Test invalid post data');
      
      // Test invalid platform
      await this.testAPI('GET', '/api/analytics/platform/invalid', null, 400, 'Test invalid platform');

      // Cleanup: Delete created resources
      this.log('\n=== Cleanup ===', 'info');
      if (taskId) {
        await this.testAPI('DELETE', `/api/interact/${taskId}`, null, 200, 'Cleanup: Delete test task');
      }
      if (userId) {
        await this.testAPI('DELETE', `/api/users/${userId}`, null, 200, 'Cleanup: Delete test user');
      }

    } catch (error) {
      this.log(`Test execution error: ${error.message}`, 'error');
      this.results.errors.push({
        type: 'execution_error',
        error: error.message,
        stack: error.stack
      });
    }
  }

  printResults() {
    this.log('\n=== TEST RESULTS ===', 'info');
    this.log(`Total Tests: ${this.results.passed + this.results.failed}`, 'info');
    this.log(`Passed: ${this.results.passed}`, 'success');
    this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'success');
    
    if (this.results.errors.length > 0) {
      this.log('\n=== ERROR DETAILS ===', 'error');
      this.results.errors.forEach((error, index) => {
        this.log(`\nError ${index + 1}:`, 'error');
        if (error.endpoint) {
          this.log(`  Endpoint: ${error.method} ${error.endpoint}`, 'error');
        }
        if (error.expected && error.actual) {
          this.log(`  Expected Status: ${error.expected}, Got: ${error.actual}`, 'error');
        }
        if (error.response) {
          this.log(`  Response: ${JSON.stringify(error.response, null, 2)}`, 'error');
        }
        if (error.error) {
          this.log(`  Error: ${error.error}`, 'error');
        }
        if (error.stack) {
          this.log(`  Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`, 'error');
        }
      });
    }

    // Overall result
    const success = this.results.failed === 0;
    this.log(`\n=== OVERALL RESULT: ${success ? 'PASSED' : 'FAILED'} ===`, 
      success ? 'success' : 'error');
    
    return success;
  }
}

// Main execution
async function main() {
  const tester = new APITester();
  
  try {
    // Start server
    await tester.startServer();
    
    // Wait a bit more for full initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Run all tests
    await tester.runAllTests();
    
  } catch (error) {
    tester.log(`Failed to run tests: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    // Print results
    const success = tester.printResults();
    
    // Stop server
    await tester.stopServer();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, stopping server...');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, stopping server...');
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  main();
}

module.exports = APITester;
