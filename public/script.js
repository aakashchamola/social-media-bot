// Simple Twitter Bot UI JavaScript

// Global Variables
let currentApiCalls = 0;
let usersSearched = 0;
let startTime = Date.now();

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupNavigation();
    setupTabSwitching();
    checkApiStatus();
    updateStats();
    
    // Update stats every 30 seconds
    setInterval(updateStats, 30000);
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
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');
}

// Tab Switching
function setupTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            switchTab(tab);
        });
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'users') {
        document.getElementById('usersTab').classList.add('active');
    } else if (tabName === 'compare') {
        document.getElementById('compareTab').classList.add('active');
    }
}

// API Status Check
async function checkApiStatus() {
    try {
        const response = await fetch('/api/twitter/status');
        const data = await response.json();
        
        const accessLevel = document.getElementById('accessLevel');
        if (accessLevel) {
            if (data.accessLevel) {
                accessLevel.textContent = data.accessLevel;
                accessLevel.className = 'value status-active';
            } else {
                accessLevel.textContent = 'Limited';
                accessLevel.className = 'value';
            }
        }
        
        // Update API status indicator
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        if (statusIndicator && statusText) {
            statusIndicator.innerHTML = '<i class="fas fa-circle"></i>';
            statusText.textContent = data.accessLevel || 'Essential';
        }
        
    } catch (error) {
        console.error('Error checking API status:', error);
        const accessLevel = document.getElementById('accessLevel');
        if (accessLevel) {
            accessLevel.textContent = 'Error';
            accessLevel.className = 'value';
        }
    }
}

// Update Stats
function updateStats() {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const uptimeText = formatUptime(uptime);
    
    const usersCountEl = document.getElementById('usersCount');
    const apiCallsEl = document.getElementById('apiCalls');
    const uptimeEl = document.getElementById('uptime');
    
    if (usersCountEl) usersCountEl.textContent = usersSearched;
    if (apiCallsEl) apiCallsEl.textContent = currentApiCalls;
    if (uptimeEl) uptimeEl.textContent = uptimeText;
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// User Search Functions
async function searchUser() {
    const input = document.getElementById('userSearchInput');
    const username = input.value.trim();
    
    if (!username) {
        showMessage('Error', 'Please enter a username');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`/api/twitter/user/${username}`);
        const userData = await response.json();
        
        if (userData.error) {
            hideLoading();
            showMessage('Error', userData.error);
            return;
        }
        
        displayUserProfile(userData);
        usersSearched++;
        currentApiCalls++;
        updateStats();
        
    } catch (error) {
        console.error('Error searching user:', error);
        showMessage('Error', 'Failed to search user');
    }
    
    hideLoading();
}

// New function for searching multiple users
async function searchUsers() {
    const input = document.getElementById('userSearchQuery');
    const query = input.value.trim();
    
    if (!query) {
        showMessage('Error', 'Please enter a search query');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`/api/twitter/search/users?q=${encodeURIComponent(query)}&maxResults=10`);
        const searchData = await response.json();
        
        if (!searchData.success) {
            hideLoading();
            showMessage('Error', searchData.message || 'Search failed');
            return;
        }
        
        displaySearchResults(searchData.data);
        usersSearched += searchData.data.count;
        currentApiCalls++;
        updateStats();
        
    } catch (error) {
        console.error('Error searching users:', error);
        showMessage('Error', 'Failed to search users');
    }
    
    hideLoading();
}

function toggleSearchMode(mode) {
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    
    // Show/hide search modes
    document.querySelectorAll('.search-mode').forEach(modeDiv => {
        modeDiv.classList.remove('active');
    });
    
    if (mode === 'search') {
        document.getElementById('searchMode').classList.add('active');
        // Hide profile results, show search results if they exist
        document.getElementById('userResults').style.display = 'none';
    } else {
        document.getElementById('profileMode').classList.add('active');
        // Hide search results, show profile results if they exist
        document.getElementById('searchResults').style.display = 'none';
    }
}

function displaySearchResults(data) {
    const searchResults = document.getElementById('searchResults');
    const searchResultsList = document.getElementById('searchResultsList');
    
    if (!searchResults || !searchResultsList) return;
    
    // Clear previous results
    searchResultsList.innerHTML = '';
    
    if (!data.users || data.users.length === 0) {
        searchResultsList.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h4>No users found</h4>
                <p>Try searching with different keywords</p>
            </div>
        `;
        searchResults.style.display = 'block';
        return;
    }
    
    data.users.forEach(user => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.onclick = () => viewUserProfile(user.username);
        
        resultItem.innerHTML = `
            <img src="${user.profile_image_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'}" 
                 alt="${user.name}" class="search-result-avatar">
            <div class="search-result-info">
                <div class="search-result-name">${user.name}</div>
                <div class="search-result-username">@${user.username}</div>
                ${user.description ? `<div class="search-result-description">${user.description.substring(0, 120)}${user.description.length > 120 ? '...' : ''}</div>` : ''}
            </div>
            <div class="search-result-metrics">
                <div class="search-result-metric">
                    <div class="search-result-metric-value">${formatNumber(user.public_metrics?.followers_count || 0)}</div>
                    <div class="search-result-metric-label">Followers</div>
                </div>
                <div class="search-result-metric">
                    <div class="search-result-metric-value">${formatNumber(user.public_metrics?.following_count || 0)}</div>
                    <div class="search-result-metric-label">Following</div>
                </div>
                <div class="search-result-metric">
                    <div class="search-result-metric-value">${formatNumber(user.public_metrics?.tweet_count || 0)}</div>
                    <div class="search-result-metric-label">Tweets</div>
                </div>
            </div>
        `;
        
        searchResultsList.appendChild(resultItem);
    });
    
    searchResults.style.display = 'block';
}

function searchUsersExample(query) {
    document.getElementById('userSearchQuery').value = query;
    searchUsers();
}

function viewUserProfile(username) {
    // Switch to profile mode and search for the specific user
    toggleSearchMode('profile');
    document.getElementById('userSearchInput').value = username;
    searchUser();
}

function exportSearchResults() {
    const searchResultsList = document.getElementById('searchResultsList');
    if (!searchResultsList) return;
    
    const results = [];
    const resultItems = searchResultsList.querySelectorAll('.search-result-item');
    
    resultItems.forEach(item => {
        const name = item.querySelector('.search-result-name')?.textContent;
        const username = item.querySelector('.search-result-username')?.textContent;
        const description = item.querySelector('.search-result-description')?.textContent;
        const metrics = {};
        
        item.querySelectorAll('.search-result-metric').forEach(metric => {
            const label = metric.querySelector('.search-result-metric-label')?.textContent.toLowerCase();
            const value = metric.querySelector('.search-result-metric-value')?.textContent;
            if (label && value) {
                metrics[label] = value;
            }
        });
        
        results.push({
            name,
            username,
            description,
            metrics,
            timestamp: new Date().toISOString()
        });
    });
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `twitter_search_results_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function searchExample(username) {
    document.getElementById('userSearchInput').value = username;
    searchUser();
}

function displayUserProfile(user) {
    const userResults = document.getElementById('userResults');
    const userProfile = document.getElementById('userProfile');
    
    if (!userResults || !userProfile) return;
    
    userProfile.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <img src="${user.profile_image_url || 'https://via.placeholder.com/128'}" alt="Profile" class="profile-image">
                <div class="profile-info">
                    <h3>${user.name || 'Unknown'}</h3>
                    <p class="username">@${user.username}</p>
                    <p class="description">${user.description || 'No description available'}</p>
                </div>
            </div>
            <div class="profile-stats">
                <div class="stat">
                    <strong>${formatNumber(user.public_metrics?.followers_count || 0)}</strong>
                    <span>Followers</span>
                </div>
                <div class="stat">
                    <strong>${formatNumber(user.public_metrics?.following_count || 0)}</strong>
                    <span>Following</span>
                </div>
                <div class="stat">
                    <strong>${formatNumber(user.public_metrics?.tweet_count || 0)}</strong>
                    <span>Tweets</span>
                </div>
            </div>
            <div class="profile-details">
                <p><i class="fas fa-calendar"></i> Joined ${formatDate(user.created_at)}</p>
                ${user.location ? `<p><i class="fas fa-map-marker-alt"></i> ${user.location}</p>` : ''}
                ${user.url ? `<p><i class="fas fa-link"></i> <a href="${user.url}" target="_blank">Website</a></p>` : ''}
            </div>
        </div>
    `;
    
    userResults.style.display = 'block';
}

// User Comparison Functions
async function compareUsers() {
    const user1 = document.getElementById('user1Input').value.trim();
    const user2 = document.getElementById('user2Input').value.trim();
    const user3 = document.getElementById('user3Input').value.trim();
    
    if (!user1 || !user2) {
        showMessage('Error', 'Please enter at least 2 usernames to compare');
        return;
    }
    
    showLoading();
    
    try {
        const users = [];
        const usernames = [user1, user2, user3].filter(u => u);
        
        for (const username of usernames) {
            const response = await fetch(`/api/twitter/user/${username}`);
            const userData = await response.json();
            
            if (!userData.error) {
                users.push(userData);
                currentApiCalls++;
            }
        }
        
        if (users.length < 2) {
            hideLoading();
            showMessage('Error', 'Could not fetch enough users for comparison');
            return;
        }
        
        displayComparison(users);
        updateStats();
        
    } catch (error) {
        console.error('Error comparing users:', error);
        showMessage('Error', 'Failed to compare users');
    }
    
    hideLoading();
}

function displayComparison(users) {
    const comparisonResults = document.getElementById('comparisonResults');
    const comparisonGrid = document.getElementById('comparisonGrid');
    
    if (!comparisonResults || !comparisonGrid) return;
    
    let html = '<div class="comparison-cards">';
    
    users.forEach(user => {
        html += `
            <div class="comparison-card">
                <img src="${user.profile_image_url || 'https://via.placeholder.com/80'}" alt="Profile" class="comparison-avatar">
                <h4>${user.name}</h4>
                <p class="comparison-username">@${user.username}</p>
                <div class="comparison-stats">
                    <div class="comparison-stat">
                        <strong>${formatNumber(user.public_metrics?.followers_count || 0)}</strong>
                        <span>Followers</span>
                    </div>
                    <div class="comparison-stat">
                        <strong>${formatNumber(user.public_metrics?.following_count || 0)}</strong>
                        <span>Following</span>
                    </div>
                    <div class="comparison-stat">
                        <strong>${formatNumber(user.public_metrics?.tweet_count || 0)}</strong>
                        <span>Tweets</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Add insights
    const insights = generateInsights(users);
    html += `<div class="comparison-insights">${insights}</div>`;
    
    comparisonGrid.innerHTML = html;
    comparisonResults.style.display = 'block';
}

function generateInsights(users) {
    if (users.length < 2) return '';
    
    // Find user with most followers
    const mostFollowers = users.reduce((prev, current) => 
        (current.public_metrics?.followers_count || 0) > (prev.public_metrics?.followers_count || 0) ? current : prev
    );
    
    // Find user with most tweets
    const mostTweets = users.reduce((prev, current) => 
        (current.public_metrics?.tweet_count || 0) > (prev.public_metrics?.tweet_count || 0) ? current : prev
    );
    
    return `
        <h4><i class="fas fa-lightbulb"></i> Insights</h4>
        <ul class="insights-list">
            <li><strong>@${mostFollowers.username}</strong> has the most followers (${formatNumber(mostFollowers.public_metrics?.followers_count || 0)})</li>
            <li><strong>@${mostTweets.username}</strong> is most active with ${formatNumber(mostTweets.public_metrics?.tweet_count || 0)} tweets</li>
        </ul>
    `;
}

function loadExampleComparison() {
    document.getElementById('user1Input').value = 'github';
    document.getElementById('user2Input').value = 'nodejs';
    document.getElementById('user3Input').value = 'vercel';
    compareUsers();
}

function clearComparison() {
    document.getElementById('user1Input').value = '';
    document.getElementById('user2Input').value = '';
    document.getElementById('user3Input').value = '';
    document.getElementById('comparisonResults').style.display = 'none';
}

// Export Functions
function exportUserData() {
    const userProfile = document.getElementById('userProfile');
    if (!userProfile || userProfile.innerHTML.trim() === '') {
        showMessage('Warning', 'No user data to export');
        return;
    }
    
    // Simple export - in a real app you'd export the actual data
    showMessage('Success', 'Export functionality would download user data as JSON');
}

function exportComparison() {
    const comparisonGrid = document.getElementById('comparisonGrid');
    if (!comparisonGrid || comparisonGrid.innerHTML.trim() === '') {
        showMessage('Warning', 'No comparison data to export');
        return;
    }
    
    // Simple export - in a real app you'd export the actual data
    showMessage('Success', 'Export functionality would download comparison data as JSON');
}

// Utility Functions
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Loading and Modal Functions
function showLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = 'flex';
    }
}

function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

function showMessage(title, message) {
    const modal = document.getElementById('messageModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    
    if (modal && modalTitle && modalMessage) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.style.display = 'flex';
    }
}

function closeModal() {
    const modal = document.getElementById('messageModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }
}

function showUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

function closeUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    }
}

function showMessageModal(title, message) {
    const modal = document.getElementById('messageModal');
    const titleElement = document.getElementById('modalTitle');
    const messageElement = document.getElementById('modalMessage');
    
    if (modal && titleElement && messageElement) {
        titleElement.textContent = title;
        messageElement.textContent = message;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
}

// Keyboard support for modals
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
        closeUpgradeModal();
    }
});

// Add some CSS for the new elements
const additionalCSS = `
    .profile-card {
        padding: 1rem;
        border-radius: 8px;
        background: var(--card-background);
    }
    
    .profile-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
    }
    
    .profile-image {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
    }
    
    .profile-info h3 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--text-primary);
    }
    
    .username {
        color: var(--text-secondary);
        margin: 0.25rem 0;
    }
    
    .description {
        color: var(--text-secondary);
        margin: 0.5rem 0;
    }
    
    .profile-stats {
        display: flex;
        gap: 2rem;
        margin: 1rem 0;
        padding: 1rem;
        background: rgba(29, 161, 242, 0.05);
        border-radius: 8px;
    }
    
    .stat {
        text-align: center;
    }
    
    .stat strong {
        display: block;
        font-size: 1.25rem;
        color: var(--text-primary);
    }
    
    .stat span {
        font-size: 0.9rem;
        color: var(--text-secondary);
    }
    
    .profile-details {
        border-top: 1px solid var(--border-color);
        padding-top: 1rem;
    }
    
    .profile-details p {
        margin: 0.5rem 0;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .comparison-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
    }
    
    .comparison-card {
        background: var(--card-background);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 1.5rem;
        text-align: center;
    }
    
    .comparison-avatar {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        object-fit: cover;
        margin-bottom: 0.5rem;
    }
    
    .comparison-card h4 {
        margin: 0.5rem 0 0.25rem 0;
        color: var(--text-primary);
    }
    
    .comparison-username {
        color: var(--text-secondary);
        margin-bottom: 1rem;
    }
    
    .comparison-stats {
        display: flex;
        justify-content: space-around;
    }
    
    .comparison-stat {
        text-align: center;
    }
    
    .comparison-stat strong {
        display: block;
        font-size: 1rem;
        color: var(--text-primary);
    }
    
    .comparison-stat span {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .comparison-insights {
        background: rgba(29, 161, 242, 0.05);
        border-radius: 8px;
        padding: 1rem;
        border: 1px solid var(--border-color);
    }
    
    .insights-list {
        list-style: none;
        padding: 0;
        margin: 0.5rem 0 0 0;
    }
    
    .insights-list li {
        padding: 0.25rem 0;
        color: var(--text-secondary);
    }
`;

// Add the CSS to the document
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);
