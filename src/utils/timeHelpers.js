// Time parsing utilities
const parseTimeString = (timeStr) => {
  const time = new Date(timeStr);
  if (isNaN(time.getTime())) {
    throw new Error('Invalid time format');
  }
  return time;
};

const addMinutes = (date, minutes) => {
  return new Date(date.getTime() + minutes * 60000);
};

const addHours = (date, hours) => {
  return new Date(date.getTime() + hours * 3600000);
};

const addDays = (date, days) => {
  return new Date(date.getTime() + days * 86400000);
};

const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const isValidCronTime = (cronExpression) => {
  // Basic cron validation (minute hour day month dayOfWeek)
  const parts = cronExpression.split(' ');
  return parts.length === 5;
};

const getTimeUntilNext = (cronExpression) => {
  // This would calculate time until next cron execution
  // For now, return a placeholder
  return new Date(Date.now() + 60000); // 1 minute from now
};

const formatRelativeTime = (date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

const getSchedulePattern = (posts) => {
  // Analyze posting schedule patterns
  const hours = {};
  const days = {};
  
  posts.forEach(post => {
    const date = new Date(post.scheduledTime);
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    hours[hour] = (hours[hour] || 0) + 1;
    days[day] = (days[day] || 0) + 1;
  });

  const bestHours = Object.entries(hours)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }));

  const bestDays = Object.entries(days)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([day, count]) => ({ 
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day], 
      count 
    }));

  return { bestHours, bestDays };
};

module.exports = {
  parseTimeString,
  addMinutes,
  addHours,
  addDays,
  formatDuration,
  isValidCronTime,
  getTimeUntilNext,
  formatRelativeTime,
  getSchedulePattern
};
