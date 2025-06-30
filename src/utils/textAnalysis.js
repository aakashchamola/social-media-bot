const extractHashtags = (text) => {
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const hashtags = text.match(hashtagRegex) || [];
  return hashtags.map(tag => tag.toLowerCase());
};

const extractMentions = (text) => {
  const mentionRegex = /@[a-zA-Z0-9_]+/g;
  const mentions = text.match(mentionRegex) || [];
  return mentions.map(mention => mention.toLowerCase());
};

const extractUrls = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

const cleanText = (text) => {
  // Remove extra whitespace and normalize
  return text.replace(/\s+/g, ' ').trim();
};

const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

const calculateTrendScore = (data) => {
  // Calculate trend score based on volume, velocity, and engagement
  const { volume = 0, velocity = 0, engagement = 0 } = data;
  
  // Weighted score calculation
  const volumeWeight = 0.4;
  const velocityWeight = 0.3;
  const engagementWeight = 0.3;
  
  return (volume * volumeWeight) + (velocity * velocityWeight) + (engagement * engagementWeight);
};

const analyzeHashtagTrends = (posts, timeWindow = 24) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - timeWindow * 60 * 60 * 1000);
  
  const hashtagCounts = {};
  const hashtagTimestamps = {};
  
  posts.forEach(post => {
    if (new Date(post.createdAt) >= cutoff) {
      post.hashtags?.forEach(hashtag => {
        hashtagCounts[hashtag] = (hashtagCounts[hashtag] || 0) + 1;
        
        if (!hashtagTimestamps[hashtag]) {
          hashtagTimestamps[hashtag] = [];
        }
        hashtagTimestamps[hashtag].push(new Date(post.createdAt));
      });
    }
  });
  
  // Calculate velocity (posts per hour)
  const trends = Object.entries(hashtagCounts).map(([hashtag, count]) => {
    const timestamps = hashtagTimestamps[hashtag];
    const velocity = count / timeWindow; // posts per hour
    
    return {
      hashtag,
      count,
      velocity: velocity.toFixed(2),
      score: calculateTrendScore({ volume: count, velocity, engagement: 0 })
    };
  });
  
  return trends.sort((a, b) => b.score - a.score);
};

const detectSpam = (text) => {
  const spamIndicators = [
    /(.)\1{4,}/, // Repeated characters
    /[A-Z]{5,}/, // Too many uppercase letters
    /(buy now|click here|free money|urgent)/gi, // Spam phrases
    /(.{1,10})\1{3,}/ // Repeated patterns
  ];
  
  return spamIndicators.some(pattern => pattern.test(text));
};

const calculateEngagementRate = (metrics) => {
  const { likes = 0, retweets = 0, replies = 0, followers = 0 } = metrics;
  
  if (followers === 0) return 0;
  
  const totalEngagement = likes + retweets + replies;
  return ((totalEngagement / followers) * 100).toFixed(2);
};

const extractKeywords = (text) => {
  // Remove common stop words and extract meaningful keywords
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
  ]);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Count word frequency
  const wordCounts = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  // Return top keywords
  return Object.entries(wordCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));
};

const analyzeSentiment = (text) => {
  // Simple sentiment analysis based on word lists
  const positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'awesome', 'love', 'like', 'happy', 'joy',
    'wonderful', 'fantastic', 'brilliant', 'perfect', 'best', 'incredible', 'outstanding'
  ];
  
  const negativeWords = [
    'bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'disappointed',
    'horrible', 'worst', 'annoying', 'frustrating', 'disgusting', 'pathetic'
  ];
  
  const words = text.toLowerCase().split(/\s+/);
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  words.forEach(word => {
    if (positiveWords.includes(word)) positiveScore++;
    if (negativeWords.includes(word)) negativeScore++;
  });
  
  const total = positiveScore + negativeScore;
  if (total === 0) return 'neutral';
  
  const positiveRatio = positiveScore / total;
  
  if (positiveRatio > 0.6) return 'positive';
  if (positiveRatio < 0.4) return 'negative';
  return 'neutral';
};

const generatePostSuggestions = (userHistory, trends) => {
  // Generate content suggestions based on user history and current trends
  const userHashtags = new Set();
  const userTopics = new Set();
  
  userHistory.forEach(post => {
    post.hashtags?.forEach(tag => userHashtags.add(tag));
    extractKeywords(post.content).forEach(({ word }) => userTopics.add(word));
  });
  
  const suggestions = [];
  
  // Suggest trending hashtags that align with user's content
  trends.hashtags?.forEach(trend => {
    if (userHashtags.has(trend.hashtag) || 
        Array.from(userTopics).some(topic => trend.hashtag.includes(topic))) {
      suggestions.push({
        type: 'trending_hashtag',
        content: trend.hashtag,
        reason: 'Trending topic that matches your content style',
        score: trend.score || 0
      });
    }
  });
  
  // Suggest optimal posting times based on engagement patterns
  if (userHistory.length > 5) {
    const bestTimes = analyzeBestPostingTimes(userHistory);
    suggestions.push({
      type: 'posting_time',
      content: `Best time to post: ${bestTimes.hour}:00`,
      reason: 'Based on your historical engagement patterns',
      score: bestTimes.avgEngagement || 0
    });
  }
  
  return suggestions.sort((a, b) => b.score - a.score);
};

const analyzeBestPostingTimes = (posts) => {
  const hourlyEngagement = {};
  
  posts.forEach(post => {
    const hour = new Date(post.createdAt).getHours();
    const engagement = (post.metadata?.likes || 0) + 
                     (post.metadata?.retweets || 0) + 
                     (post.metadata?.replies || 0);
    
    if (!hourlyEngagement[hour]) {
      hourlyEngagement[hour] = { total: 0, count: 0 };
    }
    
    hourlyEngagement[hour].total += engagement;
    hourlyEngagement[hour].count += 1;
  });
  
  // Find hour with highest average engagement
  let bestHour = 0;
  let bestAvgEngagement = 0;
  
  Object.entries(hourlyEngagement).forEach(([hour, data]) => {
    const avgEngagement = data.total / data.count;
    if (avgEngagement > bestAvgEngagement) {
      bestAvgEngagement = avgEngagement;
      bestHour = parseInt(hour);
    }
  });
  
  return { hour: bestHour, avgEngagement: bestAvgEngagement };
};

module.exports = {
  extractHashtags,
  extractMentions,
  extractUrls,
  cleanText,
  truncateText,
  calculateTrendScore,
  analyzeHashtagTrends,
  detectSpam,
  calculateEngagementRate,
  extractKeywords,
  analyzeSentiment,
  generatePostSuggestions,
  analyzeBestPostingTimes
};
