const { gql } = require('graphql-tag');

const typeDefs = gql`
  scalar Date

  type User {
    id: ID!
    username: String!
    platform: Platform!
    userId: String
    followers: Int
    verified: Boolean
    createdAt: Date!
    interactionHistory: [Interaction!]
    metrics: UserMetrics
  }

  type UserMetrics {
    totalInteractions: Int!
    successfulInteractions: Int!
    lastEngagementRate: Float
  }

  type Post {
    id: ID!
    content: String!
    platform: Platform!
    scheduledTime: Date!
    posted: Boolean!
    postId: String
    mediaUrls: [String!]
    hashtags: [String!]
    createdAt: Date!
    metadata: PostMetadata
  }

  type PostMetadata {
    likes: Int
    retweets: Int
    replies: Int
    shares: Int
  }

  type Task {
    id: ID!
    type: TaskType!
    platform: Platform!
    target: String!
    action: String!
    status: TaskStatus!
    scheduledTime: Date
    executedTime: Date
    priority: Int!
    createdAt: Date!
    result: TaskResult
  }

  type TaskResult {
    success: Boolean!
    message: String
    data: String
  }

  type Interaction {
    id: ID!
    type: String!
    timestamp: Date!
    success: Boolean!
  }

  type Analytics {
    summary: AnalyticsSummary!
    platforms: [PlatformAnalytics!]!
    engagement: EngagementMetrics!
    trends: [Trend!]!
  }

  type AnalyticsSummary {
    totalPosts: Int!
    totalUsers: Int!
    totalTasks: Int!
    successRate: Float!
  }

  type PlatformAnalytics {
    platform: Platform!
    posts: Int!
    users: Int!
    engagement: Float!
  }

  type EngagementMetrics {
    avgLikes: Float!
    avgRetweets: Float!
    avgReplies: Float!
    totalEngagement: Int!
  }

  type Trend {
    hashtag: String!
    count: Int!
    platforms: [Platform!]!
    timestamp: Date!
  }

  enum Platform {
    TWITTER
    INSTAGRAM
    FACEBOOK
  }

  enum TaskType {
    LIKE
    COMMENT
    FOLLOW
    RETWEET
    SCRAPE
    TREND_MONITOR
  }

  enum TaskStatus {
    PENDING
    SCHEDULED
    COMPLETED
    FAILED
  }

  input CreatePostInput {
    content: String!
    platform: Platform!
    scheduledTime: Date!
    mediaUrls: [String!]
    hashtags: [String!]
  }

  input CreateTaskInput {
    type: TaskType!
    platform: Platform!
    target: String!
    action: String!
    scheduledTime: Date
    priority: Int = 3
  }

  input CreateUserInput {
    username: String!
    platform: Platform!
    userId: String
    followers: Int
    verified: Boolean
  }

  input UpdatePostInput {
    content: String
    scheduledTime: Date
    mediaUrls: [String!]
    hashtags: [String!]
  }

  input UpdateTaskInput {
    action: String
    scheduledTime: Date
    priority: Int
    status: TaskStatus
  }

  type Query {
    # Posts
    posts(platform: Platform, limit: Int = 10, offset: Int = 0): [Post!]!
    post(id: ID!): Post
    upcomingPosts(limit: Int = 10): [Post!]!
    
    # Users
    users(platform: Platform, limit: Int = 10, offset: Int = 0): [User!]!
    user(id: ID!): User
    searchUsers(query: String!, platform: Platform): [User!]!
    
    # Tasks
    tasks(platform: Platform, status: TaskStatus, limit: Int = 10, offset: Int = 0): [Task!]!
    task(id: ID!): Task
    pendingTasks(platform: Platform): [Task!]!
    
    # Analytics
    analytics(timeRange: Int = 30): Analytics!
    platformAnalytics(platform: Platform!, timeRange: Int = 30): PlatformAnalytics!
    trends(timeRange: Int = 7): [Trend!]!
    
    # Real-time data
    realTimeStats: Analytics!
  }

  type Mutation {
    # Posts
    createPost(input: CreatePostInput!): Post!
    updatePost(id: ID!, input: UpdatePostInput!): Post!
    deletePost(id: ID!): Boolean!
    publishPost(id: ID!): Post!
    
    # Tasks
    createTask(input: CreateTaskInput!): Task!
    updateTask(id: ID!, input: UpdateTaskInput!): Task!
    deleteTask(id: ID!): Boolean!
    executeTask(id: ID!): Task!
    
    # Users
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: CreateUserInput!): User!
    deleteUser(id: ID!): Boolean!
    
    # Bulk operations
    createBulkTasks(inputs: [CreateTaskInput!]!): [Task!]!
    scheduleBulkPosts(inputs: [CreatePostInput!]!): [Post!]!
  }

  type Subscription {
    # Real-time updates
    taskUpdated: Task!
    postPublished: Post!
    analyticsUpdated: Analytics!
    
    # Platform-specific subscriptions
    twitterTaskCompleted: Task!
    instagramPostPublished: Post!
    facebookEngagementUpdate: Post!
  }
`;

module.exports = typeDefs;
