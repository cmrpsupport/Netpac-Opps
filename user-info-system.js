/**
 * User Info and Online Users System
 * Handles user authentication display and real-time online user tracking
 */

class UserInfoSystem {
    constructor() {
        this.onlineUsersData = new Map();
        this.heartbeatInterval = null;
        this.currentUserId = null;
        this.currentUserInfo = null;
    }

    // Get API URL helper function
    getApiUrl(endpoint) {
        return (window.APP_CONFIG?.API_BASE_URL || '') + endpoint;
    }

    // Initialize user info display and online users tracking
    initializeUserInfoSystem() {
        console.log('[USER-INFO] Initializing user info system...');
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn('[USER-INFO] No auth token found');
            return;
        }
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            this.currentUserId = payload.id;
            this.currentUserInfo = {
                id: payload.id,
                name: payload.name || payload.username || payload.email || 'Unknown User',
                email: payload.email,
                roles: payload.roles || [],
                accountType: payload.accountType || payload.account_type || 'User'
            };
            
            this.updateUserInfoDisplay();
            this.initializeOnlineUsersTracking();
            this.startHeartbeat();
            
        } catch (error) {
            console.error('[USER-INFO] Error parsing user token:', error);
        }
    }

    // Update the user info display
    updateUserInfoDisplay() {
        if (!this.currentUserInfo) return;
        
        const userNameElement = document.getElementById('currentUserName');
        const userRoleElement = document.getElementById('currentUserRole');
        
        if (userNameElement) {
            userNameElement.textContent = this.currentUserInfo.name;
        }
        
        if (userRoleElement) {
            const rolesText = this.currentUserInfo.roles.length > 0 
                ? this.currentUserInfo.roles.join(', ') 
                : this.currentUserInfo.accountType;
            userRoleElement.textContent = rolesText;
        }
    }

    // Initialize online users tracking
    initializeOnlineUsersTracking() {
        this.onlineUsersData.set(this.currentUserId, {
            id: this.currentUserId,
            name: this.currentUserInfo.name,
            email: this.currentUserInfo.email,
            lastSeen: Date.now(),
            status: 'online'
        });
        
        this.updateOnlineUsersDisplay();
        setInterval(() => this.cleanupOfflineUsers(), 30000);
    }

    // Start heartbeat mechanism
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(async () => {
            await this.sendHeartbeat();
        }, 30000);
        
        this.sendHeartbeat();
    }

    // Send heartbeat to server
    async sendHeartbeat() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;
            
            const response = await fetch(this.getApiUrl('/api/heartbeat'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    page: window.location.pathname,
                    timestamp: Date.now()
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.onlineUsers) {
                    this.updateOnlineUsersFromServer(data.onlineUsers);
                }
            }
            
        } catch (error) {
            console.error('[HEARTBEAT] Error:', error);
        }
    }

    // Update online users from server response
    updateOnlineUsersFromServer(serverUsers) {
        const currentUserData = this.onlineUsersData.get(this.currentUserId);
        this.onlineUsersData.clear();
        if (currentUserData) {
            this.onlineUsersData.set(this.currentUserId, currentUserData);
        }
        
        serverUsers.forEach(user => {
            this.onlineUsersData.set(user.id, {
                id: user.id,
                name: user.name,
                email: user.email,
                lastSeen: user.lastSeen,
                status: 'online',
                page: user.page
            });
        });
        
        this.updateOnlineUsersDisplay();
    }

    // Update online users display
    updateOnlineUsersDisplay() {
        const onlineCountElement = document.getElementById('onlineCount');
        const onlineUsersListElement = document.getElementById('onlineUsersList');
        
        if (!onlineCountElement || !onlineUsersListElement) return;
        
        const onlineUsers = Array.from(this.onlineUsersData.values())
            .filter(user => user.status === 'online')
            .sort((a, b) => {
                if (a.id === this.currentUserId) return -1;
                if (b.id === this.currentUserId) return 1;
                return a.name.localeCompare(b.name);
            });
        
        onlineCountElement.textContent = onlineUsers.length;
        onlineUsersListElement.innerHTML = '';
        
        onlineUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'online-user-item';
            
            const isCurrentUser = user.id === this.currentUserId;
            const displayName = isCurrentUser ? 'You' : user.name;
            
            userItem.innerHTML = `
                <span class="material-icons">${isCurrentUser ? 'account_circle' : 'person'}</span>
                <span class="online-user-name">${displayName}</span>
                ${user.page && user.page !== window.location.pathname ? 
                    `<span class="material-icons online-user-page" title="Currently on: ${user.page}" style="font-size: 0.875rem; color: var(--text-secondary); opacity: 0.7;">open_in_browser</span>` : ''}
            `;
            
            onlineUsersListElement.appendChild(userItem);
        });
    }

    // Cleanup offline users
    cleanupOfflineUsers() {
        const currentTime = Date.now();
        const offlineThreshold = 90000;
        
        for (const [userId, userData] of this.onlineUsersData.entries()) {
            const timeSinceLastSeen = currentTime - userData.lastSeen;
            
            if (timeSinceLastSeen > offlineThreshold && userId !== this.currentUserId) {
                this.onlineUsersData.delete(userId);
            }
        }
        
        this.updateOnlineUsersDisplay();
    }

    // Initialize system when ready
    initialize() {
        const token = localStorage.getItem('authToken');
        if (token) {
            this.initializeUserInfoSystem();
        }
    }

    // Clean up on page unload
    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }
}

// Global instance
window.UserInfoSystem = new UserInfoSystem();

// Initialize when navigation is loaded
document.addEventListener('navigationLoaded', () => {
    // Delay to ensure elements are ready
    setTimeout(() => {
        window.UserInfoSystem.initialize();
    }, 500);
});

// Fallback initialization if navigationLoaded event doesn't fire
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (!window.UserInfoSystem.currentUserId) {
            window.UserInfoSystem.initialize();
        }
    }, 2000);
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    window.UserInfoSystem.cleanup();
}); 