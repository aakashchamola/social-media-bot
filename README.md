# 🐦 Twitter Bot Server

A powerful Node.js server that acts as a Twitter automation bot. Features include scheduled posting, automated interactions, data scraping, trend monitoring, and comprehensive analytics.

## 🌟 Features

- ✅ **Scheduled Posting** - Automate Twitter content publishing
- ✅ **Automated Interactions** - Like, comment, follow, and retweet automatically
- ✅ **Data Scraping** - Collect and analyze Twitter data
- ✅ **Trend Monitoring** - Track trending topics and hashtags
- ✅ **Analytics & Reporting** - Comprehensive Twitter metrics and insights
- ✅ **Twitter API Integration** - Full Twitter API v2 and v1.1 support
- ✅ **Rate Limiting** - Respects Twitter API limits and platform rules
- ✅ **RESTful API** - Easy integration with web interfaces

## 🛠️ Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose
- **Scheduler**: node-cron for automated tasks
- **HTTP Client**: Axios for API requests
- **Social Media APIs**: Twitter API v2 and v1.1

## 🚀 Quick Start

### Prerequisites

- Node.js (≥16.0.0)
- MongoDB (local or cloud)
- API credentials for your chosen platforms

### Installation

1. **Clone and setup**
   ```bash
   cd social-media-bot
   npm install
   npm run setup
   ```

2. **Configure environment**
   ```bash
   # Edit .env file with your API credentials
   cp .env.example .env
   nano .env
   ```

3. **Start the server**
   ```bash
   # Production
   npm start
   
   # Development (with auto-restart)
   npm run dev
   ```

The server will start on `http://localhost:3000`

## 🧪 Testing

All test files are located in the `/test` directory. The project uses a structured testing approach:

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test twitter-api.test.js

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- **Unit Tests**: `*.test.js` - Individual function/module tests
- **Integration Tests**: `*.integration.test.js` - Component interaction tests
- **API Tests**: `*.api.test.js` - External API integration tests
- **E2E Tests**: `*.e2e.test.js` - End-to-end system tests

### Platform-Specific Tests
- **Twitter**: `twitter-*.test.js`

**Important**: All test files must be created in the `/test` directory, not in the project root.

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following credentials:

```env
# Database
MONGO_URI=mongodb://localhost:27017/social-media-bot

# Server
PORT=3000
NODE_ENV=development

# Twitter API v2
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
TWITTER_BEARER_TOKEN=your_bearer_token
```

### Getting API Credentials

#### Twitter API v2
1. Visit [developer.twitter.com](https://developer.twitter.com)
2. Create a new app and get your API keys
3. Enable API v2 access

## 📡 API Endpoints

### Health Check
```http
GET /
```

### Posts & Scheduling
```http
GET    /api/schedule              # Get all scheduled posts
POST   /api/schedule              # Schedule a new post
PUT    /api/schedule/:id          # Update scheduled post
DELETE /api/schedule/:id          # Cancel scheduled post
POST   /api/schedule/bulk         # Schedule multiple posts
POST   /api/schedule/task         # Schedule interaction task
```

### Users
```http
GET    /api/users                 # Get all users
POST   /api/users                 # Add/update user
GET    /api/users/:id             # Get user details
PUT    /api/users/:id             # Update user
DELETE /api/users/:id             # Delete user
GET    /api/users/search          # Search users
```

### Analytics
```http
GET /api/analytics                # Dashboard analytics
GET /api/analytics/platform/:platform  # Platform-specific analytics
GET /api/analytics/posts          # Post performance
GET /api/analytics/tasks          # Task execution stats
GET /api/analytics/users          # User analytics
GET /api/analytics/trends         # Trending topics
GET /api/analytics/export         # Export data
```

## 🤖 Usage Examples

### Schedule a Post

```javascript
const response = await fetch('/api/schedule', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: "Hello from the social media bot! 🤖 #automation #nodejs",
    platform: "twitter",
    scheduledTime: "2025-01-01T12:00:00Z",
    hashtags: ["automation", "nodejs"],
    mediaUrls: ["https://example.com/image.jpg"]
  })
});
```

### Create Interaction Tasks

```javascript
const response = await fetch('/api/schedule/task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: "like",
    platform: "twitter",
    target: "1234567890",  // Tweet ID
    action: "Automated like",
    priority: 2
  })
});
```

### Get Analytics

```javascript
const analytics = await fetch('/api/analytics?timeRange=7');
const data = await analytics.json();

console.log('Posts published:', data.summary.totalPosts);
console.log('Success rate:', data.taskStatistics.successRate);
```

## 🔄 Automated Features

The bot runs several automated processes:

- **Every 5 minutes**: Check and publish scheduled posts
- **Every 10 minutes**: Process automated interactions
- **Every 2 hours**: Monitor trending topics
- **Every 6 hours**: Scrape data for analysis
- **Daily at midnight**: Generate analytics reports

## 📊 Data Models

### Post
```javascript
{
  content: String,           // Post content
  platform: String,          // 'twitter'
  scheduledTime: Date,       // When to publish
  posted: Boolean,           // Publication status
  postId: String,            // Platform-specific ID after posting
  mediaUrls: [String],       // Attached media
  hashtags: [String],        // Extracted hashtags
  metadata: {                // Engagement metrics
    likes: Number,
    retweets: Number,
    replies: Number
  }
}
```

### Task
```javascript
{
  type: String,              // 'like', 'comment', 'follow', etc.
  platform: String,          // Target platform
  target: String,            // Username, post ID, or hashtag
  action: String,            // Action description
  status: String,            // 'pending', 'completed', 'failed'
  scheduledTime: Date,       // When to execute
  priority: Number,          // 1-5 priority level
  result: {                  // Execution result
    success: Boolean,
    message: String,
    data: Mixed
  }
}
```

### User
```javascript
{
  username: String,          // Platform username
  platform: String,          // 'twitter'
  userId: String,            // Platform-specific ID
  followers: Number,         // Follower count
  verified: Boolean,         // Verification status
  interactionHistory: [{     // Bot interaction history
    type: String,
    timestamp: Date,
    success: Boolean
  }],
  metrics: {                 // Interaction metrics
    totalInteractions: Number,
    successfulInteractions: Number,
    lastEngagementRate: Number
  }
}
```

## 🔒 Security & Rate Limiting

- **API Rate Limiting**: Respects platform-specific rate limits
- **Error Handling**: Comprehensive error handling and retry logic
- **Environment Variables**: Sensitive data stored securely
- **Input Validation**: Validates all user inputs
- **Graceful Degradation**: Continues operating if one platform fails

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Make sure MongoDB is running
   brew services start mongodb-community
   # Or using Docker
   docker run -d -p 27017:27017 mongo
   ```

2. **Twitter API Errors**
   - Check your API credentials in `.env`
   - Ensure you have API v2 access
   - Verify rate limits haven't been exceeded

### Debug Mode

```bash
NODE_ENV=development npm run dev
```

## 📈 Monitoring

The bot provides several monitoring endpoints:

- **Health Check**: `GET /` - Server status
- **Real-time Stats**: `GET /api/analytics/realtime` - Live metrics
- **System Status**: Check logs for error messages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Resources

- [Node.js Documentation](https://nodejs.org/docs/latest/api/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Twitter API v2 Docs](https://developer.twitter.com/en/docs/twitter-api)
## 📞 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Include error logs and environment details

---

**⚠️ Important**: Always comply with platform terms of service and rate limits. Use responsibly and respect other users' privacy and content.