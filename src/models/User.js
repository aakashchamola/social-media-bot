const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['twitter']
  },
  userId: {
    type: String, // Platform-specific user ID
    required: true
  },
  displayName: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    maxlength: 500
  },
  profileImage: {
    type: String // URL to profile image
  },
  followers: {
    type: Number,
    default: 0
  },
  following: {
    type: Number,
    default: 0
  },
  postsCount: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  },
  isBot: {
    type: Boolean,
    default: false
  },
  lastInteraction: {
    type: Date
  },
  interactionHistory: [{
    type: {
      type: String,
      enum: ['like', 'comment', 'follow', 'retweet', 'message']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    postId: String,
    success: Boolean,
    notes: String
  }],
  tags: [{
    type: String // Custom tags for categorization
  }],
  metrics: {
    totalInteractions: { type: Number, default: 0 },
    successfulInteractions: { type: Number, default: 0 },
    lastEngagementRate: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 } // in hours
  },
  preferences: {
    autoFollow: { type: Boolean, default: false },
    autoLike: { type: Boolean, default: false },
    maxInteractionsPerDay: { type: Number, default: 10 }
  }
}, {
  timestamps: true
});

// Compound indexes
userSchema.index({ platform: 1, username: 1 }, { unique: true });
userSchema.index({ platform: 1, followers: -1 });
userSchema.index({ lastInteraction: 1 });

// Virtual for engagement rate
userSchema.virtual('engagementRate').get(function() {
  if (this.metrics.totalInteractions === 0) return 0;
  return (this.metrics.successfulInteractions / this.metrics.totalInteractions) * 100;
});

// Instance method to add interaction
userSchema.methods.addInteraction = function(interactionData) {
  this.interactionHistory.push(interactionData);
  this.lastInteraction = new Date();
  this.metrics.totalInteractions += 1;
  
  if (interactionData.success) {
    this.metrics.successfulInteractions += 1;
  }
  
  // Keep only last 100 interactions to prevent document bloat
  if (this.interactionHistory.length > 100) {
    this.interactionHistory = this.interactionHistory.slice(-100);
  }
  
  return this.save();
};

// Static method to find users for interaction
userSchema.statics.findUsersForInteraction = function(platform, limit = 10) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return this.find({
    platform: platform,
    isBot: false,
    $or: [
      { lastInteraction: { $lt: oneDayAgo } },
      { lastInteraction: { $exists: false } }
    ]
  })
  .sort({ followers: -1, lastInteraction: 1 })
  .limit(limit);
};

module.exports = mongoose.model('User', userSchema);
