// Notification Manager
// Handles all notification-related functionality

// API URL helper function
function getApiUrl(endpoint) {
    if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) {
        return window.APP_CONFIG.API_BASE_URL + endpoint;
    }
    // Fallback for development
    const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000' 
        : 'https://cmrp-opps-backend.onrender.com';
    return baseUrl + endpoint;
}

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.isDropdownOpen = false;
        this.refreshInterval = null;
        
        this.init();
    }
    
    init() {
        this.bindEventListeners();
        this.loadNotifications();
        this.startPeriodicRefresh();
    }
    
    bindEventListeners() {
        // Notification bell click
        const notificationsBell = document.getElementById('notificationsBell');
        if (notificationsBell) {
            notificationsBell.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }
        
        // Mark all as read button
        const markAllReadBtn = document.getElementById('markAllReadBtn');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }
        
        // View all notifications button
        const viewAllBtn = document.getElementById('viewAllNotificationsBtn');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                this.viewAllNotifications();
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('notificationsDropdown');
            const bell = document.getElementById('notificationsBell');
            
            if (!dropdown?.contains(e.target) && !bell?.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        // Escape key to close dropdown
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDropdownOpen) {
                this.closeDropdown();
            }
        });
    }
    
    async loadNotifications(limit = 10) {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;
            
            const response = await fetch(getApiUrl(`/api/notifications?limit=${limit}`), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load notifications: ${response.status}`);
            }
            
            const data = await response.json();
            this.notifications = data.notifications || [];
            this.updateUnreadCount();
            this.renderNotifications();
            
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }
    
    async updateUnreadCount() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;
            
            const response = await fetch(getApiUrl('/api/notifications/unread-count'), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            this.unreadCount = data.count || 0;
            this.updateBadge();
            
        } catch (error) {
            console.error('Error updating unread count:', error);
        }
    }
    
    updateBadge() {
        const badge = document.getElementById('notificationsBadge');
        if (!badge) return;
        
        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    
    renderNotifications() {
        const notificationsList = document.getElementById('notificationsList');
        const notificationsEmpty = document.getElementById('notificationsEmpty');
        
        if (!notificationsList) return;
        
        // Clear existing notifications (except empty state)
        const existingNotifications = notificationsList.querySelectorAll('.notification-item');
        existingNotifications.forEach(item => item.remove());
        
        if (this.notifications.length === 0) {
            notificationsEmpty.classList.remove('hidden');
            return;
        }
        
        notificationsEmpty.classList.add('hidden');
        
        this.notifications.forEach(notification => {
            const notificationElement = this.createNotificationElement(notification);
            notificationsList.appendChild(notificationElement);
        });
    }
    
    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification-item ${!notification.is_read ? 'unread' : 'read'}`;
        element.dataset.notificationId = notification.id;
        
        const iconMap = {
            'pic_assignment': 'person_add',
            'bom_assignment': 'engineering',
            'account_mgr_assignment': 'manage_accounts',
            'mention': 'alternate_email',
            'status_change': 'update',
            'deadline_alert': 'schedule',
            'submission_reminder': 'send',
            'decision_update': 'gavel',
            'financial_update': 'monetization_on',
            'drive_activity': 'folder',
            'revision_update': 'edit'
        };
        
        const icon = iconMap[notification.type] || 'notifications';
        const timeAgo = this.getTimeAgo(notification.created_at);
        
        element.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <span class="material-icons">${icon}</span>
                </div>
                <div class="notification-body">
                    <div class="notification-title">${this.escapeHtml(notification.title)}</div>
                    <div class="notification-message">${this.escapeHtml(notification.message)}</div>
                    <div class="notification-meta">
                        ${notification.project_name ? `<span class="project-name">${this.escapeHtml(notification.project_name)}</span> • ` : ''}
                        <span class="notification-time">${timeAgo}</span>
                    </div>
                </div>
                ${!notification.is_read ? '<div class="notification-unread-dot"></div>' : ''}
            </div>
        `;
        
        // Add click handler
        element.addEventListener('click', () => {
            this.handleNotificationClick(notification);
        });
        
        return element;
    }
    
    async handleNotificationClick(notification) {
        // Mark as read if unread
        if (!notification.is_read) {
            await this.markAsRead(notification.id);
        }
        
        // Navigate to relevant page/modal
        if (notification.opportunity_uid) {
            this.navigateToOpportunity(notification.opportunity_uid);
        }
        
        this.closeDropdown();
    }
    
    navigateToOpportunity(opportunityUid) {
        // If we're on the main page, try to highlight or scroll to the row
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            this.highlightOpportunityRow(opportunityUid);
        } else {
            // Navigate to main page with opportunity highlighted
            window.location.href = `/?highlight=${opportunityUid}`;
        }
    }
    
    highlightOpportunityRow(opportunityUid) {
        // Find the row with this opportunity UID
        const table = document.getElementById('opportunitiesTable');
        if (!table) return;
        
        const rows = table.querySelectorAll('tbody tr');
        for (const row of rows) {
            const uidCell = row.querySelector('[data-field="uid"]');
            if (uidCell && uidCell.textContent.trim() === opportunityUid) {
                // Scroll to row and highlight it
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('highlighted-row');
                
                // Remove highlight after 3 seconds
                setTimeout(() => {
                    row.classList.remove('highlighted-row');
                }, 3000);
                break;
            }
        }
    }
    
    async markAsRead(notificationId) {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;
            
            const response = await fetch(getApiUrl(`/api/notifications/${notificationId}/read`), {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) return;
            
            // Update local state
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.is_read = true;
            }
            
            this.updateUnreadCount();
            this.renderNotifications();
            
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
    
    async markAllAsRead() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;
            
            const response = await fetch(getApiUrl('/api/notifications/mark-all-read'), {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) return;
            
            // Update local state
            this.notifications.forEach(notification => {
                notification.is_read = true;
            });
            
            this.unreadCount = 0;
            this.updateBadge();
            this.renderNotifications();
            
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }
    
    toggleDropdown() {
        const dropdown = document.getElementById('notificationsDropdown');
        if (!dropdown) return;
        
        if (this.isDropdownOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
    openDropdown() {
        const dropdown = document.getElementById('notificationsDropdown');
        if (!dropdown) return;
        
        dropdown.classList.remove('hidden');
        this.isDropdownOpen = true;
        
        // Load fresh notifications when opening
        this.loadNotifications();
    }
    
    closeDropdown() {
        const dropdown = document.getElementById('notificationsDropdown');
        if (!dropdown) return;
        
        dropdown.classList.add('hidden');
        this.isDropdownOpen = false;
    }
    
    viewAllNotifications() {
        // For now, just close the dropdown and potentially navigate to a dedicated page
        // This could be extended to open a modal or navigate to a notifications page
        this.closeDropdown();
        console.log('View all notifications - TODO: implement dedicated page');
    }
    
    startPeriodicRefresh() {
        // Refresh unread count every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.updateUnreadCount();
        }, 30000);
    }
    
    stopPeriodicRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    getTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) {
            return 'Just now';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes}m ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours}h ago`;
        } else if (diffInSeconds < 604800) {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Public method to create notifications from other parts of the app
    async createNotification(data) {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) return;
            
            const response = await fetch(getApiUrl('/api/notifications'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            
            if (!response.ok) return;
            
            // Refresh notifications after creating one
            this.loadNotifications();
            
        } catch (error) {
            console.error('Error creating notification:', error);
        }
    }
}

// Note: Notification system is now initialized by SharedNavigation after topbar loads
// This ensures the notification bell element exists when we try to initialize

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}