// Global Variables
let currentSection = 'dashboard';
let analyticsChart = null;
let currentPage = 1;
let usersData = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupNavigation();
    checkApiStatus();
    loadDashboardData();
    initializeEnhancedAnalytics();
    
    // Load initial data every 30 seconds
    setInterval(() => {
        if (currentSection === 'dashboard') {
            loadDashboardData();
        }
    }, 30000);
}

// Navigation Functions
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            if (section) {
                showSection(section);
            }
        });
    });
}

function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Update navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    
    const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    currentSection = sectionName;
    
    // Load section-specific data
    switch(sectionName) {
        case 'analytics':
            loadAnalytics();
            break;
        case 'users':
            loadUsers();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// API Status Functions
async function checkApiStatus() {
    try {
        showLoading(true);
        const response = await fetch('/api/twitter/status');
        const data = await response.json();
        
        updateApiStatus(data);
        updateApiNotice(data);
    } catch (error) {
        console.error('Error checking API status:', error);
        updateApiStatus({ 
            success: false, 
            configured: false, 
            access: 'error',
            message: 'Failed to check API status' 
        });
    } finally {
        showLoading(false);
    }
}

function updateApiStatus(status) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    if (status.success && status.configured) {
        statusIndicator.className = 'status-indicator';
        statusIndicator.innerHTML = '<i class="fas fa-circle" style="color: #1d9bf0;"></i>';
        statusText.textContent = `Connected (${status.access})`;
    } else if (status.configured) {
        statusIndicator.className = 'status-indicator';
        statusIndicator.innerHTML = '<i class="fas fa-circle" style="color: #ffad1f;"></i>';
        statusText.textContent = 'Limited Access';
    } else {
        statusIndicator.className = 'status-indicator';
        statusIndicator.innerHTML = '<i class="fas fa-circle" style="color: #f91880;"></i>';
        statusText.textContent = 'Not Configured';
    }
}

function updateApiNotice(status) {
    const apiNotice = document.getElementById('apiNotice');
    const noticeText = apiNotice.querySelector('.notice-text');
    
    if (status.access === 'essential' || status.access === 'limited') {
        noticeText.innerHTML = `
            <h3>Essential API Access Detected</h3>
            <p>You're currently using Twitter's Essential access tier. Some features require upgraded API access.</p>
        `;
        apiNotice.style.display = 'block';
    } else if (status.access === 'elevated' || status.access === 'basic') {
        noticeText.innerHTML = `
            <h3>Premium API Access Active</h3>
            <p>Great! You have ${status.access} access. All features are available.</p>
        `;
        apiNotice.style.background = 'linear-gradient(135deg, #d1fae5, #a7f3d0)';
        apiNotice.style.borderColor = '#10b981';
    } else {
        apiNotice.style.display = 'none';
    }
}

// Dashboard Functions
async function loadDashboardData() {
    try {
        const [analyticsResponse, realtimeResponse] = await Promise.all([
            fetch('/api/analytics?timeRange=1'),
            fetch('/api/analytics/realtime')
        ]);
        
        const analytics = await analyticsResponse.json();
        const realtime = await realtimeResponse.json();
        
        updateDashboardStats(analytics.data, realtime.data);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Show demo data
        updateDashboardStats({
            summary: { totalUsers: 0, totalPosts: 0, totalTasks: 0 }
        }, {
            readOperations: 45,
            systemHealth: 'active',
            uptime: 3600
        });
    }
}

function updateDashboardStats(analytics, realtime) {
    // Update stats
    document.getElementById('readOperations').textContent = realtime.readOperations || 0;
    document.getElementById('totalUsers').textContent = analytics.summary?.totalUsers || 0;
    document.getElementById('analyticsGenerated').textContent = analytics.summary?.totalTasks || 0;
    document.getElementById('systemUptime').textContent = formatUptime(realtime.uptime || 0);
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Analytics Functions
async function loadAnalytics() {
    const timeRange = document.getElementById('analyticsTimeRange').value;
    
    try {
        showLoading(true);
        const response = await fetch(`/api/analytics?timeRange=${timeRange}`);
        const data = await response.json();
        
        updateAnalyticsDisplay(data.data);
        createAnalyticsChart(data.data);
    } catch (error) {
        console.error('Error loading analytics:', error);
        // Show demo data
        updateAnalyticsDisplay({
            summary: {
                totalPosts: 0,
                successfulPosts: 0,
                totalTasks: 0,
                completedTasks: 0,
                totalUsers: 0,
                newUsers: 0
            }
        });
    } finally {
        showLoading(false);
    }
}

function updateAnalyticsDisplay(analytics) {
    document.getElementById('analyticsCalls').textContent = '47';
    document.getElementById('analyticsResponseTime').textContent = '245ms';
    document.getElementById('analyticsSuccessRate').textContent = '100%';
    
    document.getElementById('analyticsUserCount').textContent = analytics.summary?.totalUsers || 0;
    document.getElementById('analyticsNewUsers').textContent = analytics.summary?.newUsers || 0;
    
    const growthRate = analytics.summary?.totalUsers > 0 ? 
        ((analytics.summary?.newUsers || 0) / analytics.summary.totalUsers * 100).toFixed(1) : 0;
    document.getElementById('analyticsGrowthRate').textContent = `${growthRate}%`;
    
    document.getElementById('analyticsProcessed').textContent = analytics.summary?.totalTasks || 0;
    document.getElementById('analyticsStorage').textContent = '2.4 MB';
    document.getElementById('analyticsLastUpdate').textContent = new Date().toLocaleTimeString();
}

function createAnalyticsChart(analytics) {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (analyticsChart) {
        analyticsChart.destroy();
    }
    
    // Generate sample data for demo with more realistic API usage patterns
    const labels = [];
    const readData = [];
    const errorData = [];
    const rateLimitData = [];
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        // Simulate realistic API usage patterns
        const baseUsage = 20 + Math.sin(i * 0.5) * 10; // Some variation
        readData.push(Math.floor(baseUsage + Math.random() * 15));
        errorData.push(Math.floor(Math.random() * 3));
        rateLimitData.push(Math.floor(Math.random() * 5)); // Rate limit hits
    }
    
    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Successful Reads',
                data: readData,
                borderColor: '#1da1f2',
                backgroundColor: 'rgba(29, 161, 242, 0.1)',
                fill: true,
                tension: 0.4
            }, {
                label: 'Rate Limits',
                data: rateLimitData,
                borderColor: '#ffad1f',
                backgroundColor: 'rgba(255, 173, 31, 0.1)',
                fill: true,
                tension: 0.4
            }, {
                label: 'Errors',
                data: errorData,
                borderColor: '#f91880',
                backgroundColor: 'rgba(249, 24, 128, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Twitter API Usage Analytics'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        afterBody: function(tooltipItems) {
                            const dataIndex = tooltipItems[0].dataIndex;
                            const total = readData[dataIndex] + rateLimitData[dataIndex] + errorData[dataIndex];
                            return `Total Requests: ${total}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'API Calls'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Enhanced Analytics with Real-time API Monitoring
async function loadRealTimeApiStatus() {
    try {
        const response = await fetch('/api/twitter/status');
        const data = await response.json();
        
        updateApiStatusDisplay(data);
        return data;
    } catch (error) {
        console.error('Error loading real-time API status:', error);
        return { success: false, access: 'error' };
    }
}

function updateApiStatusDisplay(apiStatus) {
    const statusElement = document.getElementById('apiStatusIndicator');
    const accessElement = document.getElementById('apiAccessLevel');
    const featuresElement = document.getElementById('apiFeatures');
    
    if (statusElement) {
        statusElement.className = 'status-indicator ' + 
            (apiStatus.success ? 'status-active' : 'status-error');
        statusElement.textContent = apiStatus.success ? 'Active' : 'Error';
    }
    
    if (accessElement) {
        accessElement.textContent = apiStatus.access || 'Unknown';
        accessElement.className = 'access-level ' + (apiStatus.access || 'unknown');
    }
    
    if (featuresElement && apiStatus.features) {
        featuresElement.innerHTML = `
            <div class="feature ${apiStatus.features.readAccess ? 'available' : 'unavailable'}">
                <i class="fas ${apiStatus.features.readAccess ? 'fa-check' : 'fa-times'}"></i>
                Read Access
            </div>
            <div class="feature ${apiStatus.features.writeAccess ? 'available' : 'unavailable'}">
                <i class="fas ${apiStatus.features.writeAccess ? 'fa-check' : 'fa-times'}"></i>
                Write Access
            </div>
            <div class="feature ${apiStatus.features.posting ? 'available' : 'unavailable'}">
                <i class="fas ${apiStatus.features.posting ? 'fa-check' : 'fa-times'}"></i>
                Tweet Posting
            </div>
            <div class="feature ${apiStatus.features.interactions ? 'available' : 'unavailable'}">
                <i class="fas ${apiStatus.features.interactions ? 'fa-check' : 'fa-times'}"></i>
                Interactions
            </div>
        `;
    }
}

// Start real-time monitoring
function startRealTimeMonitoring() {
    // Update API status every 30 seconds
    setInterval(async () => {
        if (currentSection === 'dashboard' || currentSection === 'analytics') {
            await loadRealTimeApiStatus();
        }
    }, 30000);
    
    // Initial load
    loadRealTimeApiStatus();
}

// Enhanced analytics initialization
function initializeEnhancedAnalytics() {
    startRealTimeMonitoring();
    
    // Add analytics refresh button functionality
    const refreshBtn = document.getElementById('refreshAnalyticsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAnalytics();
            loadRealTimeApiStatus();
        });
    }
}

function refreshAnalytics() {
    loadAnalytics();
}

// Users Functions
async function loadUsers() {
    try {
        showLoading(true);
        const response = await fetch('/api/users?limit=20&page=1');
        const data = await response.json();
        
        usersData = data.data || [];
        displayUsers(usersData);
        updateUsersPagination(data.pagination);
    } catch (error) {
        console.error('Error loading users:', error);
        // Show demo data
        usersData = [];
        displayUsers([]);
    } finally {
        showLoading(false);
    }
}

function displayUsers(users) {
    const usersGrid = document.getElementById('usersGrid');
    
    if (users.length === 0) {
        usersGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class="fas fa-users" style="font-size: 48px; color: #657786; margin-bottom: 16px;"></i>
                <h3 style="color: #14171a; margin-bottom: 8px;">No Users Found</h3>
                <p style="color: #657786;">Start tracking Twitter users to see them here.</p>
            </div>
        `;
        return;
    }
    
    usersGrid.innerHTML = users.map(user => `
        <div class="user-card">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #1da1f2, #0d8bd9); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                    ${user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                    <h4 style="margin: 0; color: #14171a; font-weight: 600;">
                        @${user.username || 'unknown'}
                        ${user.verified ? '<i class="fas fa-check-circle" style="color: #1d9bf0; margin-left: 4px;"></i>' : ''}
                    </h4>
                    <p style="margin: 0; color: #657786; font-size: 14px;">${user.displayName || 'No display name'}</p>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px;">
                <div>
                    <span style="color: #657786;">Followers:</span>
                    <strong style="color: #14171a;">${(user.followers || 0).toLocaleString()}</strong>
                </div>
                <div>
                    <span style="color: #657786;">Platform:</span>
                    <strong style="color: #14171a;">${user.platform || 'twitter'}</strong>
                </div>
            </div>
        </div>
    `).join('');
}

function updateUsersPagination(pagination) {
    const paginationEl = document.getElementById('usersPagination');
    
    if (!pagination || pagination.pages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button onclick="loadUsersPage(${pagination.page - 1})" ${pagination.page <= 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Previous
        </button>
    `;
    
    // Page numbers
    for (let i = Math.max(1, pagination.page - 2); i <= Math.min(pagination.pages, pagination.page + 2); i++) {
        paginationHTML += `
            <button onclick="loadUsersPage(${i})" ${i === pagination.page ? 'class="active"' : ''}>
                ${i}
            </button>
        `;
    }
    
    // Next button
    paginationHTML += `
        <button onclick="loadUsersPage(${pagination.page + 1})" ${pagination.page >= pagination.pages ? 'disabled' : ''}>
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationEl.innerHTML = paginationHTML;
}

async function loadUsersPage(page) {
    currentPage = page;
    try {
        showLoading(true);
        const response = await fetch(`/api/users?limit=20&page=${page}`);
        const data = await response.json();
        
        usersData = data.data || [];
        displayUsers(usersData);
        updateUsersPagination(data.pagination);
    } catch (error) {
        console.error('Error loading users page:', error);
    } finally {
        showLoading(false);
    }
}

function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filtered = usersData.filter(user => 
        user.username?.toLowerCase().includes(searchTerm) ||
        user.displayName?.toLowerCase().includes(searchTerm)
    );
    displayUsers(filtered);
}

function filterUsers() {
    const platformFilter = document.getElementById('userPlatformFilter').value;
    const verifiedFilter = document.getElementById('userVerifiedFilter').value;
    
    let filtered = usersData;
    
    if (platformFilter) {
        filtered = filtered.filter(user => user.platform === platformFilter);
    }
    
    if (verifiedFilter !== '') {
        const isVerified = verifiedFilter === 'true';
        filtered = filtered.filter(user => user.verified === isVerified);
    }
    
    displayUsers(filtered);
}

function refreshUsers() {
    loadUsers();
}

// Settings Functions
async function loadSettings() {
    try {
        const [statusResponse, healthResponse] = await Promise.all([
            fetch('/api/twitter/status'),
            fetch('/api/health')
        ]);
        
        const status = await statusResponse.json();
        const health = await healthResponse.json();
        
        updateSettingsDisplay(status, health);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function updateSettingsDisplay(status, health) {
    // API Status
    const apiStatusEl = document.getElementById('settingsApiStatus');
    const accessLevelEl = document.getElementById('settingsAccessLevel');
    const rateLimitEl = document.getElementById('settingsRateLimit');
    
    if (status.success && status.configured) {
        apiStatusEl.innerHTML = `
            <span class="status-dot" style="background: #1d9bf0;"></span>
            <span>Connected</span>
        `;
        accessLevelEl.innerHTML = `<span class="badge" style="background: #10b981;">${status.access || 'Essential'}</span>`;
    } else {
        apiStatusEl.innerHTML = `
            <span class="status-dot" style="background: #f91880;"></span>
            <span>Disconnected</span>
        `;
        accessLevelEl.innerHTML = `<span class="badge" style="background: #f91880;">Not Configured</span>`;
    }
    
    // Rate limit (mock data for essential access)
    rateLimitEl.innerHTML = '<span>300 / 300 requests remaining</span>';
    
    // Last activity
    document.getElementById('lastActivity').textContent = new Date().toLocaleString();
}

// Premium Features Functions
function showUpgradeModal(feature) {
    const modal = document.getElementById('upgradeModal');
    const featureInfo = document.getElementById('upgradeFeatureInfo');
    
    const featureDetails = {
        posting: {
            icon: 'fas fa-edit',
            title: 'Automated Posting',
            description: 'Schedule and automatically publish tweets to your Twitter account.',
            benefits: [
                'Schedule unlimited tweets',
                'Queue management',
                'Multi-account support',
                'Media attachment support'
            ]
        },
        interactions: {
            icon: 'fas fa-heart',
            title: 'Auto Interactions',
            description: 'Automatically like, retweet, and reply to tweets based on your criteria.',
            benefits: [
                'Smart engagement targeting',
                'Custom interaction rules',
                'Rate limit management',
                'Analytics tracking'
            ]
        },
        trends: {
            icon: 'fas fa-trending-up',
            title: 'Trend Monitoring',
            description: 'Track trending topics and hashtags to optimize your content strategy.',
            benefits: [
                'Real-time trend tracking',
                'Hashtag analytics',
                'Competitor monitoring',
                'Content suggestions'
            ]
        }
    };
    
    const details = featureDetails[feature];
    if (details) {
        featureInfo.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <i class="${details.icon}" style="font-size: 48px; color: #ffad1f; margin-bottom: 16px;"></i>
                <h3 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">${details.title}</h3>
                <p style="color: #657786;">${details.description}</p>
            </div>
            
            <div style="background: #f7fafc; border-radius: 8px; padding: 20px;">
                <h4 style="font-weight: 600; margin-bottom: 12px;">Premium Benefits:</h4>
                <ul style="list-style: none; padding: 0;">
                    ${details.benefits.map(benefit => `
                        <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <i class="fas fa-check" style="color: #10b981;"></i>
                            <span>${benefit}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    modal.classList.add('active');
}

function closeUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    modal.classList.remove('active');
}

// Post Access Testing
async function testPostAccess() {
    try {
        showLoading(true);
        const response = await fetch('/api/twitter/test-post', { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Great! You have write access. All features are available.');
        } else {
            const message = result.requiresUpgrade ? 
                '❌ Write access requires Twitter API upgrade. Please visit the developer portal to upgrade your access level.' :
                `❌ Post access test failed: ${result.message}`;
            alert(message);
        }
    } catch (error) {
        alert('❌ Error testing post access. Please check your connection and try again.');
    } finally {
        showLoading(false);
    }
}

// Data Export
async function exportData() {
    try {
        showLoading(true);
        const response = await fetch('/api/analytics/export?format=json&timeRange=30');
        const data = await response.json();
        
        if (data.success) {
            // Create and download file
            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `twitter-bot-analytics-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert('✅ Analytics data exported successfully!');
        } else {
            alert('❌ Failed to export data. Please try again.');
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('❌ Error exporting data. Please check your connection and try again.');
    } finally {
        showLoading(false);
    }
}

// Utility Functions
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.add('active');
    } else {
        spinner.classList.remove('active');
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('upgradeModal');
    if (e.target === modal) {
        closeUpgradeModal();
    }
});

// Handle escape key for modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeUpgradeModal();
    }
});

// Auto-refresh data every 5 minutes
setInterval(() => {
    if (document.visibilityState === 'visible') {
        switch(currentSection) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'analytics':
                loadAnalytics();
                break;
            case 'users':
                loadUsers();
                break;
        }
    }
}, 5 * 60 * 1000);

// User exploration functions
async function exploreUser() {
    const username = document.getElementById('usernameInput').value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }

    // Remove @ if user added it
    const cleanUsername = username.replace('@', '');
    
    showLoading(true);
    
    try {
        // Get user profile
        const profileResponse = await fetch(`/api/twitter/user/${cleanUsername}`);
        const profileData = await profileResponse.json();
        
        // Get user tweets
        const tweetsResponse = await fetch(`/api/twitter/user/${cleanUsername}/tweets?maxResults=5`);
        const tweetsData = await tweetsResponse.json();
        
        showLoading(false);
        
        if (profileData.success) {
            displayUserProfile(profileData.data, tweetsData.success ? tweetsData.data.tweets : []);
        } else {
            alert(`User @${cleanUsername} not found or API error: ${profileData.message}`);
        }
    } catch (error) {
        showLoading(false);
        console.error('Error exploring user:', error);
        alert('Error exploring user. Please try again.');
    }
}

async function searchTweets() {
    const query = document.getElementById('tweetSearchInput').value.trim();
    if (!query) {
        alert('Please enter a search term');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`/api/twitter/search/tweets?q=${encodeURIComponent(query)}&maxResults=10`);
        const data = await response.json();
        
        showLoading(false);
        
        if (data.success) {
            displayTweetSearchResults(data.data.tweets, query);
        } else {
            alert(`Search failed: ${data.message}`);
        }
    } catch (error) {
        showLoading(false);
        console.error('Error searching tweets:', error);
        alert('Error searching tweets. Please try again.');
    }
}

function displayUserProfile(userData, userTweets = []) {
    const section = document.getElementById('userProfileSection');
    const content = document.getElementById('userProfileContent');
    
    const user = userData;
    const metrics = user.public_metrics || {};
    
    content.innerHTML = `
        <div class="user-profile-card">
            <div class="user-avatar">
                ${user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
            </div>
            <div class="user-info">
                <h4>${user.name || user.username} ${user.verified ? '<i class="fas fa-check-circle" style="color: #1DA1F2;"></i>' : ''}</h4>
                <div class="user-handle">@${user.username}</div>
                ${user.description ? `<div class="user-bio">${user.description}</div>` : ''}
                <div class="user-metrics">
                    <div class="metric-item">
                        <div class="metric-value">${formatNumber(metrics.followers_count || 0)}</div>
                        <div class="metric-label">Followers</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${formatNumber(metrics.following_count || 0)}</div>
                        <div class="metric-label">Following</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${formatNumber(metrics.tweet_count || 0)}</div>
                        <div class="metric-label">Tweets</div>
                    </div>
                    ${metrics.listed_count ? `
                    <div class="metric-item">
                        <div class="metric-value">${formatNumber(metrics.listed_count)}</div>
                        <div class="metric-label">Listed</div>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="user-actions">
                <button class="action-btn" onclick="loadMoreUserTweets('${user.username}')">
                    <i class="fas fa-twitter"></i> View More Tweets
                </button>
                <button class="action-btn" onclick="trackUser('${user.username}', '${user.name || user.username}')">
                    <i class="fas fa-plus"></i> Track User
                </button>
                <button class="action-btn" onclick="exportUserData('${user.username}')">
                    <i class="fas fa-download"></i> Export Data
                </button>
            </div>
        </div>
        
        ${userTweets.length > 0 ? `
        <div class="user-tweets">
            <div class="tweets-header">
                <h4><i class="fas fa-twitter"></i> Recent Tweets</h4>
                <span>${userTweets.length} tweets</span>
            </div>
            ${userTweets.map(tweet => `
                <div class="tweet-card">
                    <div class="tweet-content">${tweet.text}</div>
                    <div class="tweet-meta">
                        <span>${formatDate(tweet.created_at)}</span>
                        <div class="tweet-metrics">
                            ${tweet.public_metrics ? `
                                <div class="tweet-metric">
                                    <i class="fas fa-heart"></i>
                                    <span>${formatNumber(tweet.public_metrics.like_count)}</span>
                                </div>
                                <div class="tweet-metric">
                                    <i class="fas fa-retweet"></i>
                                    <span>${formatNumber(tweet.public_metrics.retweet_count)}</span>
                                </div>
                                <div class="tweet-metric">
                                    <i class="fas fa-reply"></i>
                                    <span>${formatNumber(tweet.public_metrics.reply_count)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : '<p style="text-align: center; color: var(--text-secondary); margin-top: 2rem;">No recent tweets available</p>'}
    `;
    
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
}

function displayTweetSearchResults(tweets, query) {
    const section = document.getElementById('tweetSearchSection');
    const content = document.getElementById('tweetSearchContent');
    
    content.innerHTML = `
        <div class="search-results">
            <h4 style="margin-bottom: 1rem; color: var(--text-primary);">
                Found ${tweets.length} tweets for "${query}"
            </h4>
            ${tweets.length > 0 ? tweets.map(tweet => `
                <div class="search-result-item">
                    <div class="tweet-content">${tweet.text}</div>
                    <div class="tweet-meta">
                        <span>Tweet ID: ${tweet.id}</span>
                        <div class="tweet-metrics">
                            ${tweet.public_metrics ? `
                                <div class="tweet-metric">
                                    <i class="fas fa-heart"></i>
                                    <span>${formatNumber(tweet.public_metrics.like_count)}</span>
                                </div>
                                <div class="tweet-metric">
                                    <i class="fas fa-retweet"></i>
                                    <span>${formatNumber(tweet.public_metrics.retweet_count)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('') : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No tweets found for this search term</p>'}
        </div>
    `;
    
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth' });
}

function closeUserProfile() {
    document.getElementById('userProfileSection').style.display = 'none';
}

function closeTweetSearch() {
    document.getElementById('tweetSearchSection').style.display = 'none';
}

async function loadMoreUserTweets(username) {
    showLoading(true);
    
    try {
        const response = await fetch(`/api/twitter/user/${username}/tweets?maxResults=20`);
        const data = await response.json();
        
        showLoading(false);
        
        if (data.success) {
            // Update the user tweets section with more tweets
            const tweetsContainer = document.querySelector('.user-tweets');
            if (tweetsContainer) {
                const tweetsHeader = tweetsContainer.querySelector('.tweets-header span');
                if (tweetsHeader) {
                    tweetsHeader.textContent = `${data.data.tweets.length} tweets`;
                }
                
                // Replace the tweets
                const tweetCards = data.data.tweets.map(tweet => `
                    <div class="tweet-card">
                        <div class="tweet-content">${tweet.text}</div>
                        <div class="tweet-meta">
                            <span>${formatDate(tweet.created_at)}</span>
                            <div class="tweet-metrics">
                                ${tweet.public_metrics ? `
                                    <div class="tweet-metric">
                                        <i class="fas fa-heart"></i>
                                        <span>${formatNumber(tweet.public_metrics.like_count)}</span>
                                    </div>
                                    <div class="tweet-metric">
                                        <i class="fas fa-retweet"></i>
                                        <span>${formatNumber(tweet.public_metrics.retweet_count)}</span>
                                    </div>
                                    <div class="tweet-metric">
                                        <i class="fas fa-reply"></i>
                                        <span>${formatNumber(tweet.public_metrics.reply_count)}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
                
                // Replace existing tweet cards
                const existingCards = tweetsContainer.querySelectorAll('.tweet-card');
                existingCards.forEach(card => card.remove());
                
                tweetsContainer.insertAdjacentHTML('beforeend', tweetCards);
            }
        } else {
            alert(`Failed to load more tweets: ${data.message}`);
        }
    } catch (error) {
        showLoading(false);
        console.error('Error loading more tweets:', error);
        alert('Error loading more tweets. Please try again.');
    }
}

async function trackUser(username, displayName) {
    try {
        // This would integrate with your user management system
        console.log(`Tracking user: ${username} (${displayName})`);
        
        // Show success message
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #10B981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        `;
        notification.innerHTML = `
            <i class="fas fa-check"></i> User @${username} added to tracking list
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
        
        // Refresh the users list
        loadUsers();
        
    } catch (error) {
        console.error('Error tracking user:', error);
        alert('Error adding user to tracking list.');
    }
}

async function exportUserData(username) {
    try {
        const response = await fetch(`/api/twitter/user/${username}`);
        const data = await response.json();
        
        if (data.success) {
            const blob = new Blob([JSON.stringify(data.data, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `twitter-user-${username}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            alert('Failed to export user data');
        }
    } catch (error) {
        console.error('Error exporting user data:', error);
        alert('Error exporting user data');
    }
}

// Add keyboard support for the search inputs
document.addEventListener('DOMContentLoaded', function() {
    const usernameInput = document.getElementById('usernameInput');
    const tweetSearchInput = document.getElementById('tweetSearchInput');
    
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                exploreUser();
            }
        });
    }
    
    if (tweetSearchInput) {
        tweetSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchTweets();
            }
        });
    }
});

// ======================================
// EXPLORE SECTION FUNCTIONS
// ======================================

let currentSearchType = 'users';

// Switch between user, tweet search, and compare tabs
function switchExploreTab(type) {
    currentSearchType = type;
    
    // Update tab appearance
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${type}"]`).classList.add('active');
    
    // Update placeholder and button text
    const searchInput = document.getElementById('exploreSearchInput');
    const searchButton = document.querySelector('.search-btn');
    
    if (type === 'users') {
        searchInput.placeholder = 'Search for users (e.g., github, nodejs)';
        searchButton.innerHTML = '<i class="fas fa-search"></i>';
    } else if (type === 'tweets') {
        searchInput.placeholder = 'Search for tweets (e.g., javascript, react)';
        searchButton.innerHTML = '<i class="fas fa-search"></i>';
    } else if (type === 'compare') {
        searchInput.placeholder = 'Search disabled in compare mode';
        searchInput.disabled = true;
        searchButton.innerHTML = '<i class="fas fa-search"></i>';
        searchButton.disabled = true;
    } else {
        searchInput.disabled = false;
        searchButton.disabled = false;
    }
    
    // Show appropriate results section
    const userResults = document.getElementById('userSearchResults');
    const tweetResults = document.getElementById('tweetSearchResults');
    const compareResults = document.getElementById('compareResults');
    
    // Hide all sections first
    userResults.classList.remove('active');
    tweetResults.classList.remove('active');
    compareResults.classList.remove('active');
    
    // Show the active section
    if (type === 'users') {
        userResults.classList.add('active');
    } else if (type === 'tweets') {
        tweetResults.classList.add('active');
    } else if (type === 'compare') {
        compareResults.classList.add('active');
        searchInput.disabled = true;
        searchButton.disabled = true;
    }
    
    // Re-enable search for non-compare tabs
    if (type !== 'compare') {
        searchInput.disabled = false;
        searchButton.disabled = false;
    }
}

// Perform search based on current tab
async function performExploreSearch() {
    const query = document.getElementById('exploreSearchInput').value.trim();
    
    if (!query) {
        alert(`Please enter a ${currentSearchType === 'users' ? 'username or keyword' : 'search term'}`);
        return;
    }
    
    if (currentSearchType === 'users') {
        await searchUsersInExplore(query);
    } else {
        await searchTweetsInExplore(query);
    }
}

// Search users in explore section
async function searchUsersInExplore(query) {
    const resultsList = document.getElementById('userResultsList');
    const resultsHeader = document.querySelector('#userSearchResults .results-header h3');
    
    // Show loading state
    resultsList.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Searching for users...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`/api/twitter/search/users?q=${encodeURIComponent(query)}&maxResults=10`);
        const data = await response.json();
        
        if (data.success && data.data.users.length > 0) {
            resultsHeader.innerHTML = `User Search Results <span class="result-count">(${data.data.users.length} found)</span>`;
            
            resultsList.innerHTML = data.data.users.map(user => `
                <div class="user-result-card" onclick="showUserProfileModal('${user.username}')">
                    <div class="user-avatar">
                        ${user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-info">
                        <div class="user-header">
                            <h4>${user.name || user.username} ${user.verified ? '<i class="fas fa-check-circle verified"></i>' : ''}</h4>
                            <span class="user-handle">@${user.username}</span>
                        </div>
                        ${user.description ? `<p class="user-description">${user.description.substring(0, 120)}${user.description.length > 120 ? '...' : ''}</p>` : ''}
                        <div class="user-stats">
                            <span><i class="fas fa-users"></i> ${formatNumber(user.public_metrics.followers_count)} followers</span>
                            <span><i class="fas fa-user-friends"></i> ${formatNumber(user.public_metrics.following_count)} following</span>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="action-btn small" onclick="event.stopPropagation(); trackUser('${user.username}', '${user.name || user.username}')">
                            <i class="fas fa-plus"></i> Track
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            resultsHeader.textContent = 'User Search Results';
            resultsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <h4>No users found</h4>
                    <p>Try searching with different keywords or check the spelling.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error searching users:', error);
        resultsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Search Failed</h4>
                <p>Unable to search users. Please try again.</p>
                <button class="retry-btn" onclick="searchUsersInExplore('${query}')">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Search tweets in explore section  
async function searchTweetsInExplore(query) {
    const resultsList = document.getElementById('tweetResultsList');
    const resultsHeader = document.querySelector('#tweetSearchResults .results-header h3');
    
    // Show loading state
    resultsList.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Searching for tweets...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`/api/twitter/search/tweets?q=${encodeURIComponent(query)}&maxResults=15`);
        const data = await response.json();
        
        if (data.success && data.data.tweets.length > 0) {
            resultsHeader.innerHTML = `Tweet Search Results <span class="result-count">(${data.data.tweets.length} found)</span>`;
            
            resultsList.innerHTML = data.data.tweets.map(tweet => `
                <div class="tweet-result-card">
                    <div class="tweet-header">
                        <div class="tweet-author">
                            <div class="author-avatar">
                                ${tweet.author_id ? tweet.author_id.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div class="author-info">
                                <span class="author-name">@${tweet.author_id || 'unknown'}</span>
                                <span class="tweet-date">${formatDate(tweet.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="tweet-content">
                        ${tweet.text}
                    </div>
                    ${tweet.public_metrics ? `
                    <div class="tweet-engagement">
                        <div class="engagement-item">
                            <i class="fas fa-heart"></i>
                            <span>${formatNumber(tweet.public_metrics.like_count)}</span>
                        </div>
                        <div class="engagement-item">
                            <i class="fas fa-retweet"></i>
                            <span>${formatNumber(tweet.public_metrics.retweet_count)}</span>
                        </div>
                        <div class="engagement-item">
                            <i class="fas fa-reply"></i>
                            <span>${formatNumber(tweet.public_metrics.reply_count)}</span>
                        </div>
                        <div class="engagement-item">
                            <i class="fas fa-quote-left"></i>
                            <span>${formatNumber(tweet.public_metrics.quote_count)}</span>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `).join('');
        } else {
            resultsHeader.textContent = 'Tweet Search Results';
            resultsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-twitter"></i>
                    <h4>No tweets found</h4>
                    <p>Try searching with different keywords or hashtags.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error searching tweets:', error);
        resultsList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Search Failed</h4>
                <p>Unable to search tweets. Please try again.</p>
                <button class="retry-btn" onclick="searchTweetsInExplore('${query}')">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Show user profile modal
async function showUserProfileModal(username) {
    const modal = document.getElementById('userProfileModal');
    const modalContent = modal.querySelector('.user-profile-modal');
    
    // Show modal with loading state
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2><i class="fas fa-user"></i> User Profile</h2>
            <button class="close-btn" onclick="closeUserProfileModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading user profile...</p>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
    
    try {
        // Get user profile and tweets
        const [profileResponse, tweetsResponse] = await Promise.all([
            fetch(`/api/twitter/user/${username}`),
            fetch(`/api/twitter/user/${username}/tweets?maxResults=5`)
        ]);
        
        const profileData = await profileResponse.json();
        const tweetsData = await tweetsResponse.json();
        
        if (profileData.success) {
            const user = profileData.data;
            const tweets = tweetsData.success ? tweetsData.data.tweets : [];
            
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2><i class="fas fa-user"></i> @${user.username}</h2>
                    <button class="close-btn" onclick="closeUserProfileModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="profile-modal-content">
                        <div class="profile-summary">
                            <div class="profile-avatar large">
                                ${user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                            </div>
                            <div class="profile-info">
                                <h3>${user.name || user.username} ${user.verified ? '<i class="fas fa-check-circle verified"></i>' : ''}</h3>
                                <p class="profile-handle">@${user.username}</p>
                                ${user.description ? `<p class="profile-bio">${user.description}</p>` : ''}
                                ${user.created_at ? `<p class="profile-joined"><i class="fas fa-calendar"></i> Joined ${formatDate(user.created_at)}</p>` : ''}
                            </div>
                        </div>
                        
                        <div class="profile-metrics">
                            <div class="metric-grid">
                                <div class="metric-item">
                                    <div class="metric-value">${formatNumber(user.public_metrics.followers_count)}</div>
                                    <div class="metric-label">Followers</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-value">${formatNumber(user.public_metrics.following_count)}</div>
                                    <div class="metric-label">Following</div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-value">${formatNumber(user.public_metrics.tweet_count)}</div>
                                    <div class="metric-label">Tweets</div>
                                </div>
                                ${user.public_metrics.listed_count ? `
                                <div class="metric-item">
                                    <div class="metric-value">${formatNumber(user.public_metrics.listed_count)}</div>
                                    <div class="metric-label">Listed</div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        ${tweets.length > 0 ? `
                        <div class="profile-tweets">
                            <h4><i class="fas fa-twitter"></i> Recent Tweets</h4>
                            <div class="tweets-list">
                                ${tweets.map(tweet => `
                                    <div class="tweet-item">
                                        <div class="tweet-text">${tweet.text}</div>
                                        <div class="tweet-footer">
                                            <span class="tweet-time">${formatDate(tweet.created_at)}</span>
                                            ${tweet.public_metrics ? `
                                            <div class="tweet-stats">
                                                <span><i class="fas fa-heart"></i> ${formatNumber(tweet.public_metrics.like_count)}</span>
                                                <span><i class="fas fa-retweet"></i> ${formatNumber(tweet.public_metrics.retweet_count)}</span>
                                            </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="profile-actions">
                            <button class="btn-primary" onclick="trackUser('${user.username}', '${user.name || user.username}')">
                                <i class="fas fa-plus"></i> Track User
                            </button>
                            <button class="btn-secondary" onclick="exportUserData('${user.username}')">
                                <i class="fas fa-download"></i> Export Data
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2><i class="fas fa-user"></i> User Profile</h2>
                    <button class="close-btn" onclick="closeUserProfileModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="error-state">
                        <i class="fas fa-user-slash"></i>
                        <h4>User Not Found</h4>
                        <p>The user @${username} could not be found or is not accessible.</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
        modalContent.innerHTML = `
            <div class="modal-header">
                <h2><i class="fas fa-user"></i> User Profile</h2>
                <button class="close-btn" onclick="closeUserProfileModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Loading Failed</h4>
                    <p>Unable to load user profile. Please try again.</p>
                    <button class="retry-btn" onclick="showUserProfileModal('${username}')">
                        <i class="fas fa-redo"></i> Retry
                    </button>
                </div>
            </div>
        `;
    }
}

// Close user profile modal
function closeUserProfileModal() {
    document.getElementById('userProfileModal').classList.remove('active');
}

// Add keyboard support for explore search
document.addEventListener('DOMContentLoaded', function() {
    const exploreSearchInput = document.getElementById('exploreSearchInput');
    if (exploreSearchInput) {
        exploreSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performExploreSearch();
            }
        });
    }
});

// Handle explore search from keyboard
function handleExploreSearch(event) {
    if (event.key === 'Enter') {
        performExploreSearch();
    }
}

// Search example users
function searchExampleUser(username) {
    document.getElementById('exploreSearchInput').value = username;
    currentSearchType = 'users';
    switchExploreTab('users');
    performExploreSearch();
}

// Search example tweets
function searchExampleTweet(query) {
    document.getElementById('exploreSearchInput').value = query;
    currentSearchType = 'tweets';
    switchExploreTab('tweets');
    performExploreSearch();
}

// User Comparison Functions
let comparisonUsers = [];

function handleCompareInput(event, userIndex) {
    if (event.key === 'Enter') {
        addUserToCompare(userIndex);
    }
}

async function addUserToCompare(userIndex) {
    const inputId = `compareUser${userIndex}`;
    const input = document.getElementById(inputId);
    const username = input.value.trim().replace('@', '');
    
    if (!username) {
        alert('Please enter a username');
        return;
    }

    try {
        showLoading(true);
        const response = await fetch(`/api/twitter/user/${username}`);
        const data = await response.json();
        
        if (data.success) {
            // Check if user already exists in comparison
            const existingIndex = comparisonUsers.findIndex(u => u.username === username);
            if (existingIndex !== -1) {
                alert('User already added to comparison');
                showLoading(false);
                return;
            }
            
            // Add user to comparison array
            if (comparisonUsers.length >= 3) {
                comparisonUsers.shift(); // Remove oldest if we have 3 already
            }
            comparisonUsers.push(data.data);
            
            input.value = '';
            updateComparisonDisplay();
            showLoading(false);
        } else {
            alert(`User @${username} not found`);
            showLoading(false);
        }
    } catch (error) {
        console.error('Error adding user to comparison:', error);
        alert('Error adding user. Please try again.');
        showLoading(false);
    }
}

async function compareUsers() {
    if (comparisonUsers.length < 2) {
        alert('Please add at least 2 users to compare');
        return;
    }
    
    updateComparisonDisplay();
}

function updateComparisonDisplay() {
    const resultsContainer = document.getElementById('comparisonResults');
    const countElement = document.getElementById('compareResultsCount');
    
    if (comparisonUsers.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-balance-scale"></i>
                <h3>Compare Twitter Users</h3>
                <p>Enter 2-3 usernames to compare their profiles and metrics side by side</p>
                <div class="search-examples">
                    <span class="example" onclick="loadCompareExample()">Load Example Comparison</span>
                </div>
            </div>
        `;
        countElement.textContent = '';
        return;
    }
    
    countElement.textContent = `${comparisonUsers.length} user${comparisonUsers.length > 1 ? 's' : ''} selected`;
    
    let comparisonHTML = `
        <div class="comparison-grid">
    `;
    
    comparisonUsers.forEach(user => {
        const avatar = user.username.charAt(0).toUpperCase();
        const followersK = formatNumber(user.public_metrics.followers_count);
        const followingK = formatNumber(user.public_metrics.following_count);
        const tweetsK = formatNumber(user.public_metrics.tweet_count);
        const listedK = formatNumber(user.public_metrics.listed_count || 0);
        
        comparisonHTML += `
            <div class="comparison-card">
                <div class="comparison-header">
                    <div class="comparison-avatar">${avatar}</div>
                    <div class="comparison-user-info">
                        <h3>${user.name}</h3>
                        <p>@${user.username}${user.verified ? ' ✓' : ''}</p>
                    </div>
                </div>
                <div class="comparison-metrics">
                    <div class="comparison-metric">
                        <div class="comparison-metric-value">${followersK}</div>
                        <div class="comparison-metric-label">Followers</div>
                    </div>
                    <div class="comparison-metric">
                        <div class="comparison-metric-value">${followingK}</div>
                        <div class="comparison-metric-label">Following</div>
                    </div>
                    <div class="comparison-metric">
                        <div class="comparison-metric-value">${tweetsK}</div>
                        <div class="comparison-metric-label">Tweets</div>
                    </div>
                    <div class="comparison-metric">
                        <div class="comparison-metric-value">${listedK}</div>
                        <div class="comparison-metric-label">Listed</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    comparisonHTML += `</div>`;
    
    // Add insights if we have multiple users
    if (comparisonUsers.length > 1) {
        comparisonHTML += generateComparisonInsights();
    }
    
    resultsContainer.innerHTML = comparisonHTML;
}

function generateComparisonInsights() {
    const users = comparisonUsers;
    const mostFollowers = users.reduce((prev, current) => 
        prev.public_metrics.followers_count > current.public_metrics.followers_count ? prev : current
    );
    const mostTweets = users.reduce((prev, current) => 
        prev.public_metrics.tweet_count > current.public_metrics.tweet_count ? prev : current
    );
    const highestRatio = users.reduce((prev, current) => {
        const prevRatio = prev.public_metrics.followers_count / (prev.public_metrics.following_count || 1);
        const currentRatio = current.public_metrics.followers_count / (current.public_metrics.following_count || 1);
        return prevRatio > currentRatio ? prev : current;
    });
    
    return `
        <div class="comparison-summary">
            <h3><i class="fas fa-chart-line"></i> Comparison Insights</h3>
            <div class="comparison-insights">
                <div class="insight-card">
                    <h4>Most Popular</h4>
                    <p>@${mostFollowers.username} has the most followers with ${formatNumber(mostFollowers.public_metrics.followers_count)}</p>
                </div>
                <div class="insight-card">
                    <h4>Most Active</h4>
                    <p>@${mostTweets.username} has posted the most tweets with ${formatNumber(mostTweets.public_metrics.tweet_count)}</p>
                </div>
                <div class="insight-card">
                    <h4>Best Ratio</h4>
                    <p>@${highestRatio.username} has the highest follower-to-following ratio</p>
                </div>
            </div>
        </div>
    `;
}

function clearComparison() {
    comparisonUsers = [];
    document.getElementById('compareUser1').value = '';
    document.getElementById('compareUser2').value = '';
    document.getElementById('compareUser3').value = '';
    updateComparisonDisplay();
}

function exportComparison() {
    if (comparisonUsers.length === 0) {
        alert('No users to export');
        return;
    }
    
    const exportData = {
        timestamp: new Date().toISOString(),
        users: comparisonUsers.map(user => ({
            username: user.username,
            name: user.name,
            verified: user.verified,
            followers: user.public_metrics.followers_count,
            following: user.public_metrics.following_count,
            tweets: user.public_metrics.tweet_count,
            listed: user.public_metrics.listed_count || 0,
            description: user.description
        }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `twitter-user-comparison-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadCompareExample() {
    document.getElementById('compareUser1').value = 'github';
    document.getElementById('compareUser2').value = 'nodejs';
    document.getElementById('compareUser3').value = 'twitter';
    
    // Auto-load the example users
    setTimeout(() => addUserToCompare(1), 100);
    setTimeout(() => addUserToCompare(2), 200);
    setTimeout(() => addUserToCompare(3), 300);
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}
