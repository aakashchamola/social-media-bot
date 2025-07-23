const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['like', 'comment', 'follow', 'retweet', 'scrape', 'trend_monitor']
  },
  platform: {
    type: String,
    required: true,
    enum: ['twitter']
  },
  target: {
    type: String, // Username, hashtag, or post ID
    required: true
  },
  action: {
    type: String, // Specific action details
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'scheduled'],
    default: 'pending'
  },
  scheduledTime: {
    type: Date,
    default: Date.now
  },
  executedTime: {
    type: Date
  },
  result: {
    success: { type: Boolean, default: false },
    message: { type: String },
    data: { type: mongoose.Schema.Types.Mixed } // Store any result data
  },
  retryCount: {
    type: Number,
    default: 0,
    max: 3
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  metadata: {
    filters: { type: mongoose.Schema.Types.Mixed }, // Search filters for scraping
    limits: { type: mongoose.Schema.Types.Mixed }, // Rate limits and constraints
    settings: { type: mongoose.Schema.Types.Mixed } // Additional settings
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
taskSchema.index({ status: 1, scheduledTime: 1 });
taskSchema.index({ platform: 1, type: 1 });
taskSchema.index({ priority: -1, scheduledTime: 1 });

// Pre-save middleware
taskSchema.pre('save', function(next) {
  if (this.status === 'completed' && !this.executedTime) {
    this.executedTime = new Date();
  }
  next();
});

// Static method to get pending tasks
taskSchema.statics.getPendingTasks = function() {
  return this.find({
    status: 'pending',
    scheduledTime: { $lte: new Date() }
  }).sort({ priority: -1, scheduledTime: 1 });
};

// Instance method to mark as completed
taskSchema.methods.markCompleted = function(result) {
  this.status = 'completed';
  this.executedTime = new Date();
  this.result = result;
  return this.save();
};

// Instance method to mark as failed
taskSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.result = {
    success: false,
    message: error.message || 'Task failed'
  };
  this.retryCount += 1;
  return this.save();
};

module.exports = mongoose.model('Task', taskSchema);
