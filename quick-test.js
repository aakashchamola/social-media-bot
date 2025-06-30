const axios = require('axios');

// Simple API tester for when server is already running
const BASE_URL = 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(method, endpoint, data = null, description = '') {
  try {
    const config = {
      method: method.toLowerCase(),
      url: `${BASE_URL}${endpoint}`,
      timeout: 5000,
      validateStatus: () => true
    };

    if (data) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const start = Date.now();
    const response = await axios(config);
    const duration = Date.now() - start;

    const status = response.status >= 200 && response.status < 300 ? 'SUCCESS' : 'ERROR';
    const statusColor = status === 'SUCCESS' ? 'green' : 'red';
    
    log(`[${status}] ${method.padEnd(6)} ${endpoint.padEnd(30)} ${response.status} (${duration}ms) - ${description}`, statusColor);
    
    if (status === 'ERROR') {
      log(`  └─ Response: ${JSON.stringify(response.data, null, 2)}`, 'red');
    }
    
    return response;
  } catch (error) {
    log(`[ERROR] ${method.padEnd(6)} ${endpoint.padEnd(30)} Network Error - ${error.message}`, 'red');
    return null;
  }
}

async function quickTest() {
  log('\n🚀 Starting Quick API Test for Social Media Bot Server', 'cyan');
  log('=' .repeat(80), 'blue');

  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/`, { timeout: 2000 });
    log('✅ Server is running at ' + BASE_URL, 'green');
  } catch (error) {
    log('❌ Server is not running at ' + BASE_URL, 'red');
    log('Please start the server with: npm start', 'yellow');
    return;
  }

  log('\n📋 Testing all endpoints...', 'cyan');

  // Health check
  await testEndpoint('GET', '/', null, 'Health check');

  // Schedule endpoints
  log('\n📅 Schedule API Tests:', 'magenta');
  await testEndpoint('GET', '/api/schedule', null, 'Get scheduled posts');
  await testEndpoint('GET', '/api/schedule/upcoming', null, 'Get upcoming posts');
  
  // Test creating a post
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const testPost = {
    content: 'Quick test post',
    platform: 'twitter',
    scheduledTime: futureDate,
    hashtags: ['test']
  };
  const postResponse = await testEndpoint('POST', '/api/schedule', testPost, 'Create test post');
  
  // If post was created, test getting and deleting it
  if (postResponse && postResponse.status === 201 && postResponse.data.data) {
    const postId = postResponse.data.data._id;
    await testEndpoint('GET', `/api/schedule/${postId}`, null, 'Get specific post');
    await testEndpoint('DELETE', `/api/schedule/${postId}`, null, 'Delete test post');
  }

  // User endpoints
  log('\n👥 User API Tests:', 'magenta');
  await testEndpoint('GET', '/api/users', null, 'Get all users');
  await testEndpoint('GET', '/api/users/platform/twitter', null, 'Get Twitter users');
  await testEndpoint('GET', '/api/users/search?q=test', null, 'Search users');

  // Interaction endpoints
  log('\n🤖 Interaction API Tests:', 'magenta');
  await testEndpoint('GET', '/api/interact', null, 'Get interaction tasks');
  
  const testTask = {
    type: 'like',
    platform: 'twitter',
    target: 'nodejs',
    action: 'like posts with nodejs hashtag',
    priority: 2
  };
  const taskResponse = await testEndpoint('POST', '/api/interact', testTask, 'Create test task');
  
  if (taskResponse && taskResponse.status === 201 && taskResponse.data.data) {
    const taskId = taskResponse.data.data._id;
    await testEndpoint('GET', `/api/interact/${taskId}`, null, 'Get specific task');
    await testEndpoint('DELETE', `/api/interact/${taskId}`, null, 'Delete test task');
  }

  // Analytics endpoints
  log('\n📊 Analytics API Tests:', 'magenta');
  await testEndpoint('GET', '/api/analytics', null, 'Dashboard analytics');
  await testEndpoint('GET', '/api/analytics/platform/twitter', null, 'Twitter analytics');
  await testEndpoint('GET', '/api/analytics/interactions', null, 'Interaction analytics');
  await testEndpoint('GET', '/api/analytics/posts', null, 'Post analytics');
  await testEndpoint('GET', '/api/analytics/tasks', null, 'Task analytics');
  await testEndpoint('GET', '/api/analytics/users', null, 'User analytics');
  await testEndpoint('GET', '/api/analytics/trends', null, 'Trends analytics');
  await testEndpoint('GET', '/api/analytics/realtime', null, 'Real-time analytics');

  // Error handling tests
  log('\n🚨 Error Handling Tests:', 'magenta');
  await testEndpoint('GET', '/api/nonexistent', null, 'Test 404 error');
  await testEndpoint('POST', '/api/schedule', { invalid: 'data' }, 'Test invalid data');
  await testEndpoint('GET', '/api/analytics/platform/invalid', null, 'Test invalid platform');

  log('\n✅ Quick API test completed!', 'green');
  log('=' .repeat(80), 'blue');
}

// Run the test
quickTest().catch(error => {
  log(`\n❌ Test failed: ${error.message}`, 'red');
  process.exit(1);
});
