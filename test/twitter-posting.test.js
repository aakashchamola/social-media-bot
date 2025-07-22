/**
 * Comprehensive Twitter Posting Test
 * This will attempt to post a real tweet using multiple methods
 */

const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto-js');
require('dotenv').config();

async function testTwitterPosting() {
  console.log('🐦 COMPREHENSIVE TWITTER POSTING TEST');
  console.log('=====================================');
  
  const timestamp = new Date().toISOString().substring(0, 19);
  const testTweet = `🤖 Social Media Bot Test - ${timestamp} #BotTest #TwitterAPI`;
  
  console.log(`📝 Test Tweet: "${testTweet}"`);
  console.log(`📏 Tweet Length: ${testTweet.length} characters`);
  
  // Test credentials
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  
  console.log('\n🔐 Credentials Check:');
  console.log(`   API Key: ${apiKey ? '✅ Present' : '❌ Missing'}`);
  console.log(`   API Secret: ${apiSecret ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Access Token: ${accessToken ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Access Token Secret: ${accessTokenSecret ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Bearer Token: ${bearerToken ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Client ID: ${clientId ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Client Secret: ${clientSecret ? '✅ Present' : '❌ Missing'}`);
  
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    console.log('\n❌ Missing required OAuth 1.0a credentials');
    return;
  }
  
  // Method 1: Try Twitter API v2 with OAuth 1.0a
  console.log('\n🧪 METHOD 1: Twitter API v2 + OAuth 1.0a');
  console.log('━'.repeat(50));
  
  try {
    const oauth = OAuth({
      consumer: { key: apiKey, secret: apiSecret },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.HmacSHA1(base_string, key).toString(crypto.enc.Base64);
      }
    });

    const userTokens = { key: accessToken, secret: accessTokenSecret };
    
    const requestData = {
      url: 'https://api.twitter.com/2/tweets',
      method: 'POST',
      data: { text: testTweet }
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, userTokens));
    
    const response = await axios.post(requestData.url, requestData.data, {
      headers: {
        ...authHeader,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ SUCCESS! Twitter API v2 + OAuth 1.0a worked!');
    console.log(`   Tweet ID: ${response.data.data.id}`);
    console.log(`   Tweet Text: "${response.data.data.text}"`);
    console.log(`   🔗 View at: https://twitter.com/i/status/${response.data.data.id}`);
    
    return {
      success: true,
      method: 'API v2 + OAuth 1.0a',
      tweetId: response.data.data.id,
      tweetUrl: `https://twitter.com/i/status/${response.data.data.id}`
    };
    
  } catch (error) {
    console.log(`❌ Failed: ${error.response?.data?.detail || error.response?.data?.errors?.[0]?.message || error.message}`);
    if (error.response?.data?.errors) {
      error.response.data.errors.forEach(err => {
        console.log(`     Error ${err.code}: ${err.message}`);
      });
    }
  }
  
  // Method 2: Try Twitter API v1.1 with OAuth 1.0a
  console.log('\n🧪 METHOD 2: Twitter API v1.1 + OAuth 1.0a');
  console.log('━'.repeat(50));
  
  try {
    const oauth = OAuth({
      consumer: { key: apiKey, secret: apiSecret },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.HmacSHA1(base_string, key).toString(crypto.enc.Base64);
      }
    });

    const userTokens = { key: accessToken, secret: accessTokenSecret };
    
    const tweetUrl = 'https://api.twitter.com/1.1/statuses/update.json';
    const tweetData = { status: testTweet };
    
    const authHeader = oauth.toHeader(oauth.authorize({
      url: tweetUrl,
      method: 'POST',
      data: tweetData
    }, userTokens));
    
    const response = await axios.post(tweetUrl, null, {
      headers: {
        ...authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      params: tweetData
    });
    
    console.log('✅ SUCCESS! Twitter API v1.1 + OAuth 1.0a worked!');
    console.log(`   Tweet ID: ${response.data.id_str}`);
    console.log(`   Tweet Text: "${response.data.text}"`);
    console.log(`   Screen Name: @${response.data.user.screen_name}`);
    console.log(`   🔗 View at: https://twitter.com/${response.data.user.screen_name}/status/${response.data.id_str}`);
    
    return {
      success: true,
      method: 'API v1.1 + OAuth 1.0a',
      tweetId: response.data.id_str,
      tweetUrl: `https://twitter.com/${response.data.user.screen_name}/status/${response.data.id_str}`,
      screenName: response.data.user.screen_name
    };
    
  } catch (error) {
    console.log(`❌ Failed: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    if (error.response?.data?.errors) {
      error.response.data.errors.forEach(err => {
        console.log(`     Error ${err.code}: ${err.message}`);
      });
    }
  }
  
  // Method 3: Try with Bearer token (read-only test first)
  console.log('\n🧪 METHOD 3: Verify Account Access with Bearer Token');
  console.log('━'.repeat(50));
  
  if (bearerToken) {
    try {
      const response = await axios.get('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${bearerToken}`
        }
      });
      
      console.log('✅ Bearer token works for account verification');
      console.log(`   User ID: ${response.data.data.id}`);
      console.log(`   Username: @${response.data.data.username}`);
      console.log(`   Name: ${response.data.data.name}`);
      
    } catch (error) {
      console.log(`❌ Bearer token failed: ${error.response?.data?.detail || error.message}`);
    }
  } else {
    console.log('❌ No Bearer token available');
  }
  
  console.log('\n🎯 FINAL RESULT:');
  console.log('================');
  console.log('❌ All posting methods failed');
  console.log('');
  console.log('🔧 TROUBLESHOOTING STEPS:');
  console.log('1. Ensure your Twitter app has "Read and Write" permissions');
  console.log('2. Regenerate Access Token & Secret AFTER changing permissions');
  console.log('3. Wait 15 minutes after regenerating tokens');
  console.log('4. Check if your app needs Elevated Access for posting');
  console.log('');
  console.log('📋 To fix this:');
  console.log('   1. Go to https://developer.twitter.com/en/portal/dashboard');
  console.log('   2. Select your app');
  console.log('   3. Go to "Settings" → Change to "Read and Write"');
  console.log('   4. Go to "Keys and tokens" → Regenerate Access Token & Secret');
  console.log('   5. Update your .env file with the NEW tokens');
  console.log('   6. Run this test again');
  
  return { success: false };
}

// Also test using the project's TwitterService
async function testWithProjectService() {
  console.log('\n\n🏗️ TESTING WITH PROJECT TWITTER SERVICE');
  console.log('=========================================');
  
  try {
    const { TwitterService } = require('../src/services/twitterService');
    const twitterService = new TwitterService();
    
    console.log('📋 Service Configuration Check:');
    console.log(`   Is Configured: ${twitterService.isConfigured()}`);
    
    if (!twitterService.isConfigured()) {
      console.log('❌ Twitter service not properly configured');
      return;
    }
    
    // Test connection first
    console.log('\n🔍 Testing connection...');
    const connectionTest = await twitterService.testConnection();
    console.log(`   Connection: ${connectionTest.success ? '✅ Success' : '❌ Failed'}`);
    if (!connectionTest.success) {
      console.log(`   Error: ${connectionTest.error}`);
    }
    
    // Try posting a tweet
    console.log('\n📝 Attempting to post tweet...');
    const timestamp = new Date().toISOString().substring(0, 19);
    const testContent = `🤖 Project Service Test - ${timestamp} #TwitterService #BotTest`;
    
    const result = await twitterService.postTweet(testContent);
    
    if (result.success) {
      console.log('✅ SUCCESS! Project TwitterService worked!');
      console.log(`   Tweet ID: ${result.postId}`);
      console.log(`   Tweet Text: "${result.text || testContent}"`);
      console.log(`   🔗 View at: https://twitter.com/i/status/${result.postId}`);
      return result;
    } else {
      console.log('❌ Project TwitterService failed');
      console.log(`   Error: ${result.error}`);
    }
    
  } catch (error) {
    console.log('❌ Error testing project service:', error.message);
  }
}

// Main execution
async function runFullTest() {
  const directTestResult = await testTwitterPosting();
  const serviceTestResult = await testWithProjectService();
  
  console.log('\n\n📊 SUMMARY REPORT');
  console.log('=================');
  
  if (directTestResult.success || serviceTestResult?.success) {
    console.log('🎉 TWITTER POSTING IS WORKING!');
    
    if (directTestResult.success) {
      console.log(`✅ Direct API Method: ${directTestResult.method}`);
      console.log(`   Tweet URL: ${directTestResult.tweetUrl}`);
    }
    
    if (serviceTestResult?.success) {
      console.log(`✅ Project Service Method worked`);
      console.log(`   Tweet ID: ${serviceTestResult.postId}`);
    }
    
  } else {
    console.log('❌ TWITTER POSTING IS NOT WORKING');
    console.log('   All methods failed - credentials need to be fixed');
  }
  
  console.log('\n🔄 Test completed at:', new Date().toISOString());
}

if (require.main === module) {
  runFullTest().catch(console.error);
}
