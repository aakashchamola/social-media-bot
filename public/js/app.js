// Twitter Bot Dashboard JavaScript
class TwitterBotDashboard {
    constructor() {
        this.apiBaseUrl = '/api';
        this.currentSection = 'dashboard';
        this.refreshInterval = null;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.loadInitialData();
        this.startAutoRefresh();
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.getAttribute('href').substring(1);
                this.showSection(sectionId);
                this.updateActiveNav(link);
            });
        });
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('userSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.searchUsers(e.target.value);
            }, 500));
        }

        // Bot status toggle
        const botStatusSelect = document.getElementById('botStatusSelect');
        if (botStatusSelect) {
            botStatusSelect.addEventListener('change', (e) => {
                this.updateBotStatus(e.target.value);
            });
        }

        // Refresh interval setting
        const refreshInterval = document.getElementById('refreshInterval');
        if (refreshInterval) {
            refreshInterval.addEventListener('change', (e) => {
                this.updateRefreshInterval(parseInt(e.target.value));
            });
        }
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionId;
            this.loadSectionData(sectionId);
        }
    }

    updateActiveNav(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }

    async loadInitialData() {
        try {
            await this.loadDashboardData();
            await this.checkApiStatus();
            await this.loadProfileAnalytics();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Error loading data', 'error');
        }
    }

    async loadSectionData(sectionId) {
        switch (sectionId) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'posts':
                await this.loadPosts();
                break;
            case 'analytics':
                await this.loadProfileAnalytics();
                break;
            case 'interactions':
                await this.loadInteractions();
                break;
            case 'settings':
                await this.loadSettings();
                break;
        }
    }

    async loadDashboardData() {
        try {
            // Update read operations count
            const readOps = Math.floor(Math.random() * 50) + 10; // Mock data
            document.getElementById('readOperations').textContent = readOps;

            // Load recent activity
            await this.loadRecentActivity();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async loadRecentActivity() {
        const timeline = document.getElementById('activityTimeline');
        
        // Mock activity data (in real app, this would come from API)
        const activities = [
            {
                icon: 'fas fa-user-check',
                type: 'success',
                title: 'Profile data retrieved',
                description: 'Successfully fetched Twitter profile information',
                time: '2 minutes ago'
            },
            {
                icon: 'fas fa-search',
                type: 'info',
                title: 'User search performed',
                description: 'Searched for users matching criteria',
                time: '15 minutes ago'
            },
            {
                icon: 'fas fa-exclamation-triangle',
                type: 'warning',
                title: 'Write operation blocked',
                description: 'Tweet posting requires elevated API access',
                time: '1 hour ago'
            },
            {
                icon: 'fas fa-sync-alt',
                type: 'info',
                title: 'Dashboard refreshed',
                description: 'Real-time data synchronization completed',
                time: '2 hours ago'
            }
        ];

        timeline.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <h4>${activity.title}</h4>
                    <p>${activity.description}</p>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');
    }

    async checkApiStatus() {
        try {
            // Try to make a test API call to check status
            const response = await fetch('/api/analytics/realtime');
            
            if (response.ok) {
                document.getElementById('apiStatusIndicator').innerHTML = `
                    <span class="status-dot success"></span>
                    Read Access Active
                `;
            } else {
                document.getElementById('apiStatusIndicator').innerHTML = `
                    <span class="status-dot warning"></span>
                    Limited Access
                `;
            }
        } catch (error) {
            document.getElementById('apiStatusIndicator').innerHTML = `
                <span class="status-dot error"></span>
                Connection Error
            `;
        }
    }

    async loadProfileAnalytics() {
        const profileAnalytics = document.getElementById('profileAnalytics');
        
        try {
            profileAnalytics.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading profile data...</p>
                </div>
            `;

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Try to get real profile data (this would work with read permissions)
            const mockProfile = {
                username: 'your_bot_account',
                followers: '1,234',
                following: '567',
                tweets: '89',
                verified: false
            };

            profileAnalytics.innerHTML = `
                <div class="profile-stats">
                    <div class="profile-stat">
                        <div class="stat-value">${mockProfile.followers}</div>
                        <div class="stat-label">Followers</div>
                    </div>
                    <div class="profile-stat">
                        <div class="stat-value">${mockProfile.following}</div>
                        <div class="stat-label">Following</div>
                    </div>
                    <div class="profile-stat">
                        <div class="stat-value">${mockProfile.tweets}</div>
                        <div class="stat-label">Tweets</div>
                    </div>
                    <div class="profile-stat">
                        <div class="stat-value">${mockProfile.verified ? 'Yes' : 'No'}</div>
                        <div class="stat-label">Verified</div>
                    </div>
                </div>
                <style>
                    .profile-stats {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                        gap: 1rem;
                        padding: 1rem;
                    }
                    .profile-stat {
                        text-align: center;
                        padding: 1rem;
                        background: #f8fafc;
                        border-radius: 8px;
                    }
                    .stat-value {
                        font-size: 1.5rem;
                        font-weight: 700;
                        color: #1e293b;
                        margin-bottom: 0.25rem;
                    }
                    .stat-label {
                        color: #64748b;
                        font-size: 0.9rem;
                    }
                </style>
            `;
        } catch (error) {
            profileAnalytics.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to load profile data</h3>
                    <p>Check your API credentials and connection</p>
                </div>
            `;
        }
    }

    async loadPosts() {
        const postsList = document.getElementById('postsList');
        
        // Since we can't actually create posts, show empty state with upgrade message
        postsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-plus"></i>
                <h3>No posts scheduled</h3>
                <p>Post scheduling requires Elevated API access with write permissions</p>
                <button class="btn-outline premium-feature" onclick="showPremiumModal('post scheduling')">
                    Learn How to Upgrade
                </button>
            </div>
        `;
    }

    async loadInteractions() {
        // Interactions would require write permissions, so show upgrade prompts
        console.log('Interactions section loaded - showing premium features');
    }

    async loadSettings() {
        // Settings are already static in HTML, but we could load dynamic config here
        console.log('Settings section loaded');
    }

    async searchUsers(query) {
        const searchResults = document.getElementById('searchResults');
        
        if (!query.trim()) {
            searchResults.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Enter a username to search</p>
                </div>
            `;
            return;
        }

        searchResults.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Searching users...</p>
            </div>
        `;

        try {
            // This would be a real API call with read permissions
            // For demo purposes, showing mock results
            await new Promise(resolve => setTimeout(resolve, 1000));

            const mockUsers = [
                {
                    username: `@${query}`,
                    displayName: `${query.charAt(0).toUpperCase() + query.slice(1)} User`,
                    followers: '1.2K',
                    verified: false
                },
                {
                    username: `@${query}_official`,
                    displayName: `Official ${query.charAt(0).toUpperCase() + query.slice(1)}`,
                    followers: '10.5K',
                    verified: true
                }
            ];

            searchResults.innerHTML = mockUsers.map(user => `
                <div class="user-result">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-info">
                        <h4>${user.displayName} ${user.verified ? '<i class="fas fa-check-circle" style="color: #1da1f2;"></i>' : ''}</h4>
                        <p>${user.username} • ${user.followers} followers</p>
                    </div>
                    <button class="btn-outline premium-feature" onclick="showPremiumModal('user interaction')">
                        <i class="fas fa-user-plus"></i>
                        Follow
                    </button>
                </div>
            `).join('');
        } catch (error) {
            searchResults.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Search failed</h3>
                    <p>Unable to search users at this time</p>
                </div>
            `;
        }
    }

    updateBotStatus(status) {
        document.getElementById('botStatus').textContent = status === 'active' ? 'Active (Read-Only)' : 'Inactive';
        this.showNotification(`Bot status updated to ${status}`, 'success');
    }

    updateRefreshInterval(minutes) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.startAutoRefresh(minutes);
        this.showNotification(`Auto-refresh set to ${minutes} minutes`, 'success');
    }

    startAutoRefresh(intervalMinutes = 15) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            this.loadSectionData(this.currentSection);
        }, intervalMinutes * 60 * 1000);
    }

    showNotification(message, type = 'info') {
        // Create and show a toast notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        // Add notification styles if not already present
        if (!document.querySelector('.notification-styles')) {
            const styles = document.createElement('style');
            styles.className = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 100px;
                    right: 20px;
                    background: white;
                    padding: 1rem 1.5rem;
                    border-radius: 8px;
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    z-index: 3000;
                    animation: slideIn 0.3s ease;
                    min-width: 300px;
                }
                .notification.success { border-left: 4px solid #10b981; }
                .notification.error { border-left: 4px solid #ef4444; }
                .notification.info { border-left: 4px solid #3b82f6; }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Premium Modal Functions
function showPremiumModal(featureName) {
    const modal = document.getElementById('premiumModal');
    const title = document.getElementById('premiumFeatureTitle');
    const description = document.getElementById('premiumFeatureDescription');

    const featureInfo = {
        'post creation': {
            title: 'Post Creation Requires Elevated Access',
            description: 'Creating and scheduling tweets requires Twitter API Elevated access with write permissions.'
        },
        'post scheduling': {
            title: 'Post Scheduling Requires Elevated Access',
            description: 'Scheduling posts for future publication requires Twitter API write permissions.'
        },
        'automated interactions': {
            title: 'Automated Interactions Require Write Access',
            description: 'Liking, retweeting, and following users requires Twitter API Elevated access.'
        },
        'auto-like': {
            title: 'Auto-Like Feature Requires Write Access',
            description: 'Automatically liking tweets requires Twitter API write permissions.'
        },
        'auto-follow': {
            title: 'Auto-Follow Feature Requires Write Access',
            description: 'Automatically following users requires Twitter API write permissions.'
        },
        'user interaction': {
            title: 'User Interactions Require Write Access',
            description: 'Following, liking, and retweeting require Twitter API write permissions.'
        },
        'engagement analytics': {
            title: 'Advanced Analytics Require Elevated Access',
            description: 'Detailed engagement metrics require Twitter API Elevated access for comprehensive data.'
        },
        'growth analytics': {
            title: 'Growth Analytics Require Elevated Access',
            description: 'Follower growth and trend analysis require Twitter API Elevated access.'
        }
    };

    const info = featureInfo[featureName] || {
        title: 'Premium Feature',
        description: 'This feature requires Twitter API Elevated access.'
    };

    title.textContent = info.title;
    description.textContent = info.description;

    modal.classList.add('active');
}

function closePremiumModal() {
    document.getElementById('premiumModal').classList.remove('active');
}

function showUpgradeModal() {
    document.getElementById('upgradeModal').classList.add('active');
}

function closeUpgradeModal() {
    document.getElementById('upgradeModal').classList.remove('active');
}

function refreshActivity() {
    const dashboard = window.twitterBot;
    if (dashboard) {
        dashboard.loadRecentActivity();
        dashboard.showNotification('Activity refreshed', 'success');
    }
}

function loadProfileAnalytics() {
    const dashboard = window.twitterBot;
    if (dashboard) {
        dashboard.loadProfileAnalytics();
    }
}

function searchUsers() {
    const input = document.getElementById('userSearchInput');
    if (input) {
        const dashboard = window.twitterBot;
        if (dashboard) {
            dashboard.searchUsers(input.value);
        }
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.twitterBot = new TwitterBotDashboard();
});

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});
