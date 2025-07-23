const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    maxlength: 280 // Twitter character limit
  },
  platform: {
    type: String,
    required: true,
    enum: ['twitter'],
    default: 'twitter'
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  posted: {
    type: Boolean,
    default: false
  },
  postId: {
    type: String, // Platform-specific post ID after posting
    default: null
  },
  mediaUrls: [{
    type: String // URLs for images/videos
  }],
  hashtags: [{
    type: String
  }],
  mentions: [{
    type: String
  }],
  createdBy: {
    type: String,
    default: 'bot'
  },
  metadata: {
    likes: { type: Number, default: 0 },
    retweets: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

// Index for efficient querying
postSchema.index({ scheduledTime: 1, posted: 1 });
postSchema.index({ platform: 1, posted: 1 });

// Virtual for engagement rate
postSchema.virtual('engagementRate').get(function() {
  const total = this.metadata.likes + this.metadata.retweets + this.metadata.replies;
  return total;
});

// Pre-save middleware to extract hashtags and mentions
postSchema.pre('save', function(next) {
  if (this.content) {
    // Extract hashtags
    const hashtags = this.content.match(/#\w+/g) || [];
    this.hashtags = hashtags.map(tag => tag.toLowerCase());
    
    // Extract mentions
    const mentions = this.content.match(/@\w+/g) || [];
    this.mentions = mentions.map(mention => mention.toLowerCase());
  }
  next();
});

module.exports = mongoose.model('Post', postSchema);
