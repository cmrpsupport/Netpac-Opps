/**
 * Shared Navigation Component Loader
 * This script loads the top bar and sidebar from shared HTML files
 * and handles active page highlighting and initialization
 */

class SharedNavigation {
    constructor() {
        this.currentPage = this.getCurrentPageName();
        this.loadPromises = [];
        
        // Online users tracking properties
        this.onlineUsersData = new Map();
        this.heartbeatInterval = null;
        this.currentUserId = null;
        this.currentUserInfo = null;
    }

    getCurrentPageName() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        
        // Map filenames to page identifiers
        const pageMap = {
            'index.html': 'index',
            '': 'index', // Root path
            'executive_dashboard.html': 'executive_dashboard',
            'forecastr_dashboard.html': 'forecastr_dashboard',
            'proposal_workbench.html': 'proposal_workbench',
            'win-loss_dashboard.html': 'win-loss_dashboard',
            'user_management.html': 'user_management',
            'csv_formatter.html': 'csv_formatter',
            'opps_monitoring_import_export.html': 'opps_monitoring_import_export',
            'project-detail.html': 'index' // Project detail pages should highlight opportunities
        };

        return pageMap[filename] || 'index';
    }

    getAuthHeaders() {
        const authToken = localStorage.getItem('authToken');
        return authToken ? {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        } : null;
    }

    async loadComponent(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.error(`Error loading component ${url}:`, error);
            return null;
        }
    }

    async loadTopBar() {
        const topBarHtml = await this.loadComponent('shared-topbar.html');
        if (topBarHtml) {
            const topBarContainer = document.getElementById('shared-topbar');
            if (topBarContainer) {
                topBarContainer.innerHTML = topBarHtml;
            } else {
                console.error('[SHARED-NAV] Top bar container not found!');
            }
        } else {
            console.error('[SHARED-NAV] Failed to load top bar HTML');
        }
    }

    async loadSidebar() {
        const sidebarHtml = await this.loadComponent('shared-sidebar.html');
        if (sidebarHtml) {
            const sidebarContainer = document.getElementById('shared-sidebar');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = sidebarHtml;
                this.setActiveMenuItem();
            } else {
                console.error('[SHARED-NAV] Sidebar container not found!');
            }
        } else {
            console.error('[SHARED-NAV] Failed to load sidebar HTML');
        }
    }

    setActiveMenuItem() {
        // Remove all active classes from sidebar items and action buttons
        const sidebarItems = document.querySelectorAll('.sidebar-item, .sidebar-action-btn');
        sidebarItems.forEach(item => item.classList.remove('active'));

        // Add active class to current page
        const currentPageItem = document.querySelector(`[data-page="${this.currentPage}"]`);
        if (currentPageItem) {
            currentPageItem.classList.add('active');
        }
        
        // Explicitly ensure theme toggle never has active class
        const themeToggle = document.querySelector('#themeToggle');
        if (themeToggle) {
            themeToggle.classList.remove('active');
        }
        
        // Update page title in the top bar
        this.updatePageTitle();
    }
    
    updatePageTitle() {
        // Use oppX for all pages
        const pageTitle = 'oppX';
        
        // Update the title in the top bar
        const titleElement = document.querySelector('.top-bar-title');
        if (titleElement) {
            titleElement.textContent = pageTitle;
        } else {
            console.warn(`[SHARED-NAV] Title element not found! Cannot update page title`);
        }
        
        // Also update document title
        document.title = pageTitle;
    }

    async initialize() {
        
        // Load components in parallel
        this.loadPromises = [
            this.loadTopBar(),
            this.loadSidebar()
        ];

        await Promise.all(this.loadPromises);
        
        // Initialize other navigation-related functionality
        await this.initializeEventListeners();
        
        // Initialize theme state
        this.initializeTheme();
        
        // Update navigation visibility based on user roles
        this.updateNavigationVisibility();
        
        // Initialize notification system after topbar is loaded
        this.initializeNotificationSystem();
        
        // Initialize calendar interface after topbar is loaded
        this.initializeCalendarInterface();
        
        // Note: User info initialization is now handled in the DOMContentLoaded listener
        
    }
    
    initializeNotificationSystem() {
        console.log('[SHARED-NAV] Initializing notification system...');
        
        // Check if notification system is available and user is authenticated
        if (typeof NotificationManager !== 'undefined' && localStorage.getItem('authToken') && document.getElementById('notificationsBell')) {
            console.log('[SHARED-NAV] Creating NotificationManager instance...');
            window.notificationManager = new NotificationManager();
        } else {
            console.log('[SHARED-NAV] Notification system not ready:', {
                NotificationManagerExists: typeof NotificationManager !== 'undefined',
                tokenExists: !!localStorage.getItem('authToken'),
                bellExists: !!document.getElementById('notificationsBell')
            });
        }
    }

    initializeEventListeners() {
        // Theme toggle functionality (sidebar only)
        const sidebarThemeToggle = document.querySelector('.sidebar #themeToggle');
        if (sidebarThemeToggle && !sidebarThemeToggle.hasAttribute('data-listener-attached')) {
            let isToggling = false; // Prevent rapid toggling
            
            sidebarThemeToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Prevent rapid toggling
                if (isToggling) {
                    return;
                }
                
                isToggling = true;
                
                // Toggle theme class on html element
                document.documentElement.classList.toggle('dark');
                
                // Update localStorage
                const isDark = document.documentElement.classList.contains('dark');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                
                // Update icon and state
                this.updateThemeToggleState();
                
                // Force immediate update of theme-sensitive elements
                setTimeout(() => {
                    this.updateThemeSensitiveElements();
                    isToggling = false; // Re-enable toggling after update
                }, 100);
                
            });
            sidebarThemeToggle.setAttribute('data-listener-attached', 'true');
        }

        // Logout button functionality
        const logoutButton = document.querySelector('#logoutBtn');
        if (logoutButton && !logoutButton.hasAttribute('data-listener-attached')) {
            logoutButton.addEventListener('click', () => {
                this.handleLogout();
            });
            logoutButton.setAttribute('data-listener-attached', 'true');
        }

        // Change password button functionality
        const changePasswordButton = document.querySelector('#changePasswordBtn');
        if (changePasswordButton && !changePasswordButton.hasAttribute('data-listener-attached')) {
            changePasswordButton.addEventListener('click', () => {
                window.location.href = 'update_password.html';
            });
            changePasswordButton.setAttribute('data-listener-attached', 'true');
        }

            // Mobile sidebar toggle
            const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
            if (mobileSidebarToggle && !mobileSidebarToggle.hasAttribute('data-listener-attached')) {
                mobileSidebarToggle.addEventListener('click', () => {
                    const sidebar = document.querySelector('.sidebar');
                    if (sidebar) {
                        sidebar.classList.toggle('mobile-open');
                    }
                });
                mobileSidebarToggle.setAttribute('data-listener-attached', 'true');
            }
        
        // Initialize theme state
        this.initializeTheme();
        
        // Listen for theme changes to update logo
        this.setupThemeChangeListener();
        
        // Note: User info initialization is now handled separately with a delay
    }
    
    setupThemeChangeListener() {
        // Set up mutation observer to watch for theme class changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Update logo
                    this.updateLogo();
                    
                    // Update theme-sensitive elements
                    this.updateThemeSensitiveElements();
                }
            });
        });
        
        // Start observing theme changes on the html element
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    initializeTheme() {
        // Load saved theme or use system preference as fallback
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldBeDark = savedTheme === 'dark' || (savedTheme === null && prefersDark);
        
        // Apply theme
        if (shouldBeDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        // Update localStorage if not set
        if (!savedTheme) {
            localStorage.setItem('theme', shouldBeDark ? 'dark' : 'light');
        }
        
        // Update theme toggle state
        this.updateThemeToggleState();
        
        // Update logo for current theme
        this.updateLogo();
        
        // Force update theme-sensitive elements after DOM is ready
        setTimeout(() => this.updateThemeSensitiveElements(), 100);
        
    }
    
    updateThemeToggleState() {
        const sidebarThemeToggle = document.querySelector('.sidebar #themeToggle');
        if (sidebarThemeToggle) {
            // Always keep sun icon as per user preference
            const icon = sidebarThemeToggle.querySelector('.material-icons');
            if (icon) {
                icon.textContent = 'wb_sunny';
            }
            
            // Remove active state as per user preference
            sidebarThemeToggle.classList.remove('active');
        }
    }
    
    updateLogo() {
        const logo = document.getElementById('cmrpLogo');
        if (logo) {
            // Always use light logo since topbar is dark in both themes
            logo.src = 'Logo/CMRP Logo Light.svg';
        }
    }
    
    async initializeUserInfo() {
        try {
            // Get current user info from token
            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                console.warn('[SHARED-NAV] No auth token available');
                return;
            }

            // Parse user info from token
            const tokenParts = authToken.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                this.currentUserInfo = {
                    id: payload.id,
                    name: payload.name,
                    email: payload.email,
                    roles: payload.roles,
                    accountType: payload.accountType
                };
                this.currentUserId = payload.id;
                
                
                // Update user info display
                this.updateUserInfoDisplay();
                
                // Initialize online users tracking
                await this.initializeOnlineUsersTracking();
            }
        } catch (error) {
            console.error('[SHARED-NAV] Error initializing user info:', error);
        }
    }
    
    updateUserInfoDisplay() {
        if (!this.currentUserInfo) {
            console.warn('[SHARED-NAV] No current user info available');
            return;
        }

        const userNameElement = document.getElementById('currentUserName');
        const userRoleElement = document.getElementById('currentUserRole');
        
        
        if (userNameElement) {
            const nameToSet = this.currentUserInfo.name || 'Unknown User';
            userNameElement.textContent = nameToSet;
            // Force white color for visibility
            userNameElement.style.color = '#ffffff';
            userNameElement.style.fontWeight = '500';
        } else {
            console.error('[SHARED-NAV-DEBUG] User name element not found!');
        }
        
        if (userRoleElement) {
            const roles = this.currentUserInfo.roles || [];
            const roleText = Array.isArray(roles) ? roles.join(', ') : roles;
            userRoleElement.textContent = roleText || 'No Role';
            // Force light gray color for visibility
            userRoleElement.style.color = '#e5e7eb';
        } else {
            console.error('[SHARED-NAV-DEBUG] User role element not found!');
        }
        
        // Also force online count styling
        const onlineCountElement = document.getElementById('onlineCount');
        if (onlineCountElement) {
            onlineCountElement.style.color = '#ffffff';
            onlineCountElement.style.fontWeight = '500';
        }
        
        // Update navigation visibility based on user roles
        this.updateNavigationVisibility();
        
    }
    
    async initializeOnlineUsersTracking() {
        if (!this.currentUserId) {
            console.warn('[SHARED-NAV] Cannot initialize online users tracking without user ID');
            return;
        }

        try {
            // Start heartbeat (this will handle its own errors gracefully)
            this.startHeartbeat();
            
            // Initial fetch of online users (this will handle its own errors gracefully)
            await this.fetchOnlineUsers();
            
            // Set up visibility change handler
            document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
            
        } catch (error) {
            console.warn('[SHARED-NAV] Error initializing online users tracking (non-critical):', error.message);
            // Don't break the application if online users feature fails to initialize
        }
    }
    
    startHeartbeat() {
        // Clear any existing interval
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        // Send initial heartbeat
        this.sendHeartbeat();
        
        // Set up interval for regular heartbeats
        this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 30000);
        
    }
    
    async sendHeartbeat() {
        try {
            const headers = this.getAuthHeaders();
            if (!headers) {
                console.warn('[SHARED-NAV] No auth token available for heartbeat');
                return;
            }

            // Check if config is available
            if (!window.APP_CONFIG || !window.APP_CONFIG.ENDPOINTS) {
                console.warn('[SHARED-NAV] App config not available, skipping heartbeat');
                return;
            }

            const currentPage = window.location.pathname;
            const endpoint = window.APP_CONFIG.ENDPOINTS.HEARTBEAT;
            
            
            const response = await fetch(getApiUrl(endpoint), {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({ currentPage })
            });
            
            if (!response.ok) {
                // If heartbeat endpoint doesn't exist (404), just log and continue
                if (response.status === 404) {
                    console.log('[SHARED-NAV] Heartbeat endpoint not available (404), continuing without heartbeat');
                    return;
                }
                
                const errorText = await response.text();
                throw new Error(`Heartbeat failed: ${response.status} - ${errorText}`);
            }
            
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.warn('[SHARED-NAV] Heartbeat response is not JSON, assuming success');
                return;
            }
            
            
            if (data.success) {
                if (data.onlineUsers) {
                    this.onlineUsersData = new Map(data.onlineUsers.map(user => [user.id, user]));
                    this.updateOnlineUsersDisplay();
                }
            } else {
                // Don't throw error for unsuccessful heartbeat, just log it quietly
                if (data.error && !data.error.includes('token')) {
                    console.warn('[SHARED-NAV] Heartbeat response indicates failure:', data.error || 'Unknown error');
                }
                // Silently handle token errors to avoid spam
            }
        } catch (error) {
            // Don't let heartbeat errors break the application
            console.warn('[SHARED-NAV] Heartbeat error (non-critical):', error.message);
            
            // If it's a network error, we might want to retry less frequently
            if (error.message.includes('fetch')) {
            }
        }
    }
    
    async fetchOnlineUsers() {
        try {
            const headers = this.getAuthHeaders();
            if (!headers) {
                console.warn('[SHARED-NAV] No auth token available for fetching online users');
                return;
            }

            // Check if config is available
            if (!window.APP_CONFIG || !window.APP_CONFIG.ENDPOINTS) {
                console.warn('[SHARED-NAV] App config not available, skipping online users fetch');
                return;
            }

            const endpoint = window.APP_CONFIG.ENDPOINTS.ONLINE_USERS;
            const response = await fetch(getApiUrl(endpoint), {
                method: 'GET',
                headers,
                credentials: 'include'
            });
            
            if (!response.ok) {
                // If online users endpoint doesn't exist (404), just log and continue
                if (response.status === 404) {
                            return;
                }
                throw new Error(`Failed to fetch online users: ${response.status}`);
            }
            
            const data = await response.json();
            this.onlineUsersData = new Map(data.map(user => [user.id, user]));
            this.updateOnlineUsersDisplay();
            
        } catch (error) {
            console.warn('[SHARED-NAV] Error fetching online users (non-critical):', error.message);
            // Don't break the application if online users feature fails
        }
    }
    
    updateOnlineUsersDisplay() {
        const onlineCountElement = document.getElementById('onlineCount');
        const onlineUsersListElement = document.getElementById('onlineUsersList');
        
        if (!onlineCountElement || !onlineUsersListElement) {
            console.warn('[SHARED-NAV] Online users display elements not found');
            return;
        }

        const onlineUsers = Array.from(this.onlineUsersData.values())
            .sort((a, b) => {
                // Current user first, then alphabetical
                if (a.id === this.currentUserId) return -1;
                if (b.id === this.currentUserId) return 1;
                return (a.name || '').localeCompare(b.name || '');
            });
        
        
        // Update count
        onlineCountElement.textContent = onlineUsers.length;

        // Update list
        onlineUsersListElement.innerHTML = '';
        
        onlineUsers.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'online-user-item';
            
            const isCurrentUser = user.id === this.currentUserId;
            const displayName = isCurrentUser ? 'You' : (user.name || 'Unknown User');
            
            // Get a user-friendly page name
            const pageDisplayName = user.currentPage ? this.getPageDisplayName(user.currentPage) : 'Unknown';
            
            userItem.innerHTML = `
                <span class="material-icons">${isCurrentUser ? 'account_circle' : 'person'}</span>
                <div style="display: flex; flex-direction: column; flex: 1;">
                    <span class="online-user-name">${displayName}</span>
                    <span class="online-user-page">${pageDisplayName}</span>
                </div>
            `;
            
            onlineUsersListElement.appendChild(userItem);
        });
        
    }

    getPageDisplayName(page) {
        const pageMap = {
            '/index.html': 'Opportunities',
            '/win-loss_dashboard.html': 'Win-Loss',
            '/forecastr_dashboard.html': 'Forecasts',
            '/executive_dashboard.html': 'Executive',
            '/proposal_workbench.html': 'Proposals',
            '/user_management.html': 'Users',
            '/csv_formatter.html': 'CSV Formatter',
            '/opps_monitoring_import_export.html': 'Import/Export'
        };
        return pageMap[page] || 'Unknown Page';
    }

    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Page is now visible, send heartbeat and fetch online users
            this.sendHeartbeat();
        }
    }

    handleLogout() {
        
        // Clear authentication data
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        // Clear user presence data (server will handle cleanup automatically)
        
        // Clear heartbeat interval
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        // Redirect to login page
        window.location.href = 'login.html';
    }

    // Method to update navigation if needed
    updateNavigation() {
        this.setActiveMenuItem();
        this.updateNavigationVisibility();
    }

    updateNavigationVisibility() {
        
        // Update User Management visibility
        this.updateUserMgmtNavVisibility();
        
        // Update Proposal Workbench visibility
        this.updateProposalWorkbenchNavVisibility();
        
        // Update CSV Formatter visibility
        this.updateCsvFormatterNavVisibility();
        
        // Update Import/Export visibility
        this.updateImportExportNavVisibility();
    }

    updateUserMgmtNavVisibility() {
        const userMgmtBtn = document.getElementById('userMgmtNavBtn');
        if (!userMgmtBtn) return;
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            userMgmtBtn.style.display = 'none';
            return;
        }
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const accountType = payload.accountType || payload.account_type || null;
            const name = payload.name || '';
            // Show user management for Admin accounts or user RJR
            userMgmtBtn.style.display = (accountType === 'Admin' || name === 'RJR') ? '' : 'none';
        } catch {
            userMgmtBtn.style.display = 'none';
        }
    }

    updateProposalWorkbenchNavVisibility() {
        const proposalWorkbenchBtn = document.getElementById('proposalWorkbenchNavBtn');
        if (!proposalWorkbenchBtn) return;
        
        // Make proposal workbench available to all authenticated users
        const token = localStorage.getItem('authToken');
        if (!token) {
            proposalWorkbenchBtn.style.display = 'none';
            return;
        }
        
        // Show for all authenticated users
        proposalWorkbenchBtn.style.display = '';
    }

    updateCsvFormatterNavVisibility() {
        const csvFormatterBtn = document.getElementById('csvFormatterNavBtn');
        if (!csvFormatterBtn) return;
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            csvFormatterBtn.style.display = 'none';
            return;
        }
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const name = payload.name || '';
            // Only show CSV formatter for user RJR
            csvFormatterBtn.style.display = (name === 'RJR') ? '' : 'none';
        } catch {
            csvFormatterBtn.style.display = 'none';
        }
    }

    updateImportExportNavVisibility() {
        const importExportBtn = document.getElementById('oppsImportExportNavBtn');
        if (!importExportBtn) return;
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            importExportBtn.style.display = 'none';
            return;
        }
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const accountType = payload.accountType || payload.account_type || null;
            importExportBtn.style.display = (accountType === 'Admin') ? '' : 'none';
        } catch {
            importExportBtn.style.display = 'none';
        }
    }

    getCurrentUserRoles() {
        const token = localStorage.getItem('authToken');
        if (!token) return [];
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.roles || [];
        } catch {
            return [];
        }
    }

    // Public method to force refresh user info (for debugging)
    forceRefreshUserInfo() {
        this.initializeUserInfo().catch(error => {
            console.error('[SHARED-NAV] Error during force refresh:', error);
        });
    }

    // Debug method to test online users dropdown
    debugOnlineUsersDropdown() {
        const dropdown = document.getElementById('onlineUsersList');
        const container = document.querySelector('.online-users-container');
        const display = document.querySelector('.online-users-display');
        
    }

    updateThemeSensitiveElements() {
        const isDark = document.documentElement.classList.contains('dark');
        
        // Update Other Status card values and labels
        const otherStatusElements = [
            'ongoingCount',
            'ongoingCountChange',
            'pendingCount',
            'pendingCountChange'
        ];
        
        // Update metric values
        otherStatusElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (isDark) {
                    element.style.color = '#f3f4f6'; // Light gray for dark mode
                } else {
                    element.style.color = '#111827'; // Very dark gray for light mode
                }
            }
        });

        // Update metric labels
        const metricLabels = document.querySelectorAll('.metric-label');
        metricLabels.forEach(label => {
            if (isDark) {
                label.style.color = '#e5e7eb'; // Light gray for dark mode
            } else {
                label.style.color = '#374151'; // Dark gray for light mode
            }
        });
        
        // Update chart colors if charts exist (accessing global variables)
        if (window.pipelineChartInstance) {
            window.pipelineChartInstance.options.plugins.legend.labels.color = isDark ? '#e5e7eb' : '#374151';
            window.pipelineChartInstance.options.plugins.tooltip.backgroundColor = isDark ? '#1f2937' : '#ffffff';
            window.pipelineChartInstance.options.plugins.tooltip.titleColor = isDark ? '#e5e7eb' : '#374151';
            window.pipelineChartInstance.options.plugins.tooltip.bodyColor = isDark ? '#e5e7eb' : '#374151';
            window.pipelineChartInstance.update();
        }
        
        if (window.statusChartInstance) {
            window.statusChartInstance.options.plugins.legend.labels.color = isDark ? '#e5e7eb' : '#374151';
            window.statusChartInstance.options.plugins.tooltip.backgroundColor = isDark ? '#1f2937' : '#ffffff';
            window.statusChartInstance.options.plugins.tooltip.titleColor = isDark ? '#e5e7eb' : '#374151';
            window.statusChartInstance.options.plugins.tooltip.bodyColor = isDark ? '#e5e7eb' : '#374151';
            window.statusChartInstance.update();
        }
        
        if (window.historicalChartInstance) {
            window.historicalChartInstance.options.plugins.legend.labels.color = isDark ? '#e5e7eb' : '#374151';
            window.historicalChartInstance.options.plugins.tooltip.backgroundColor = isDark ? '#1f2937' : '#ffffff';
            window.historicalChartInstance.options.plugins.tooltip.titleColor = isDark ? '#e5e7eb' : '#374151';
            window.historicalChartInstance.options.plugins.tooltip.bodyColor = isDark ? '#e5e7eb' : '#374151';
            window.historicalChartInstance.update();
        }
    }
    
    // Force refresh theme state - useful when navigating between pages
    forceRefreshTheme() {
        
        // Re-read theme from localStorage
        const savedTheme = localStorage.getItem('theme');
        const shouldBeDark = savedTheme === 'dark';
        
        // Ensure HTML element matches localStorage
        if (shouldBeDark && !document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.add('dark');
        } else if (!shouldBeDark && document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
        }
        
        // Update all theme-dependent elements
        this.updateThemeToggleState();
        this.updateLogo();
        this.updateThemeSensitiveElements();
        
    }

    // === GOOGLE CALENDAR INTEGRATION ===
    
    initializeCalendarInterface() {
        console.log('[SHARED-NAV] Initializing calendar interface...');
        
        const calendarBtn = document.getElementById('calendarConnectionBtn');
        const calendarDropdown = document.getElementById('calendarDropdown');
        
        if (!calendarBtn || !calendarDropdown) {
            console.warn('[SHARED-NAV] Calendar interface elements not found');
            return;
        }

        // Set up click handler for calendar button
        calendarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCalendarDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!calendarBtn.contains(e.target) && !calendarDropdown.contains(e.target)) {
                this.hideCalendarDropdown();
            }
        });

        // Load initial calendar status
        this.loadCalendarStatus();
    }

    toggleCalendarDropdown() {
        const dropdown = document.getElementById('calendarDropdown');
        if (dropdown) {
            const isHidden = dropdown.classList.contains('hidden');
            if (isHidden) {
                this.showCalendarDropdown();
            } else {
                this.hideCalendarDropdown();
            }
        }
    }

    showCalendarDropdown() {
        const dropdown = document.getElementById('calendarDropdown');
        if (dropdown) {
            dropdown.classList.remove('hidden');
            this.loadCalendarStatus(); // Refresh status when opening
        }
    }

    hideCalendarDropdown() {
        const dropdown = document.getElementById('calendarDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }

    async loadCalendarStatus() {
        console.log('[SHARED-NAV] Loading calendar status...');
        
        const content = document.getElementById('calendarDropdownContent');
        const statusText = document.getElementById('calendarStatusText');
        const calendarIcon = document.getElementById('calendarIcon');
        const calendarBtn = document.getElementById('calendarConnectionBtn');
        
        if (!content) {
            console.error('[SHARED-NAV] Calendar dropdown content not found');
            return;
        }

        // Show loading state
        content.innerHTML = `
            <div class="calendar-status-loading">
                <span class="material-icons">hourglass_empty</span>
                <p>Loading calendar status...</p>
            </div>
        `;

        try {
            const headers = this.getAuthHeaders();
            if (!headers) {
                throw new Error('No authentication token');
            }

            const response = await fetch(getApiUrl('/api/calendar/status'), {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Failed to load calendar status: ${response.status}`);
            }

            const data = await response.json();
            console.log('[SHARED-NAV] Calendar status loaded:', data);

            if (data.setupRequired) {
                this.renderCalendarSetupRequired();
                if (statusText) statusText.textContent = 'Setup Required';
                if (calendarIcon) calendarIcon.textContent = 'settings';
                if (calendarBtn) {
                    calendarBtn.classList.remove('connected', 'disconnected');
                    calendarBtn.classList.add('setup-required');
                }
            } else if (data.connected) {
                this.renderConnectedCalendarStatus(data);
                if (statusText) statusText.textContent = 'Connected';
                if (calendarIcon) calendarIcon.textContent = 'event_available';
                if (calendarBtn) {
                    calendarBtn.classList.remove('disconnected', 'setup-required');
                    calendarBtn.classList.add('connected');
                }
            } else {
                this.renderDisconnectedCalendarStatus();
                if (statusText) statusText.textContent = 'Calendar';
                if (calendarIcon) calendarIcon.textContent = 'event';
                if (calendarBtn) {
                    calendarBtn.classList.remove('connected', 'setup-required');
                    calendarBtn.classList.add('disconnected');
                }
            }

        } catch (error) {
            console.error('[SHARED-NAV] Failed to load calendar status:', error);
            this.renderCalendarError(error.message);
            if (statusText) statusText.textContent = 'Error';
            if (calendarIcon) calendarIcon.textContent = 'event_busy';
        }
    }

    renderConnectedCalendarStatus(data) {
        const content = document.getElementById('calendarDropdownContent');
        if (!content) return;

        const lastSyncText = data.lastSync 
            ? `Last sync: ${new Date(data.lastSync).toLocaleString()}`
            : 'Never synced';

        content.innerHTML = `
            <div class="calendar-status-connected">
                <div class="calendar-connected-info">
                    <span class="material-icons">check_circle</span>
                    <div class="calendar-connected-details">
                        <div class="calendar-connected-email">${data.googleEmail || 'Connected'}</div>
                        <div class="calendar-last-sync">${lastSyncText}</div>
                    </div>
                </div>
                <button class="calendar-action-button calendar-sync-btn" data-action="sync">
                    <span class="material-icons">sync</span>
                    Sync Now
                </button>
                <button class="calendar-action-button calendar-disconnect-btn" data-action="disconnect">
                    <span class="material-icons">link_off</span>
                    Disconnect
                </button>
            </div>
        `;

        // Add event listeners for the buttons
        const syncBtn = content.querySelector('.calendar-sync-btn');
        const disconnectBtn = content.querySelector('.calendar-disconnect-btn');
        
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncCalendar());
        }
        
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnectCalendar());
        }
    }

    renderCalendarSetupRequired() {
        const content = document.getElementById('calendarDropdownContent');
        if (!content) return;

        content.innerHTML = `
            <div class="calendar-status-error">
                <span class="material-icons">settings</span>
                <p><strong>Setup Required</strong></p>
                <p>Google Calendar OAuth credentials not configured.</p>
                <p style="font-size: 0.75rem; margin-top: 0.5rem;">
                    Please set up Google OAuth credentials in your environment variables.
                    See GOOGLE_CALENDAR_SETUP.md for instructions.
                </p>
            </div>
        `;
    }

    renderDisconnectedCalendarStatus() {
        const content = document.getElementById('calendarDropdownContent');
        if (!content) return;

        content.innerHTML = `
            <div class="calendar-status-disconnected">
                <span class="material-icons">event_note</span>
                <p>Connect your Google Calendar to sync events with your weekly schedule.</p>
                <button class="calendar-action-button calendar-connect-btn" data-action="connect">
                    <span class="material-icons">link</span>
                    Connect Google Calendar
                </button>
            </div>
        `;

        // Add event listener for the connect button
        const connectBtn = content.querySelector('.calendar-connect-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectCalendar());
        }
    }

    renderCalendarError(errorMessage) {
        const content = document.getElementById('calendarDropdownContent');
        if (!content) return;

        content.innerHTML = `
            <div class="calendar-status-error">
                <span class="material-icons">error</span>
                <p>Error loading calendar status</p>
                <p style="font-size: 0.75rem; margin-top: 0.5rem;">${errorMessage}</p>
                <button class="calendar-action-button calendar-connect-btn" data-action="retry">
                    <span class="material-icons">refresh</span>
                    Retry
                </button>
            </div>
        `;

        // Add event listener for the retry button
        const retryBtn = content.querySelector('[data-action="retry"]');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.loadCalendarStatus());
        }
    }

    async connectCalendar() {
        console.log('[SHARED-NAV] Starting calendar connection...');
        
        try {
            const headers = this.getAuthHeaders();
            if (!headers) {
                throw new Error('No authentication token');
            }

            // Get OAuth URL from server
            const response = await fetch('/auth/google/calendar', {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Failed to start OAuth flow: ${response.status}`);
            }

            const data = await response.json();
            console.log('[SHARED-NAV] Got OAuth URL:', data.authUrl);

            // Redirect to Google OAuth
            window.location.href = data.authUrl;

        } catch (error) {
            console.error('[SHARED-NAV] Failed to connect calendar:', error);
            alert('Failed to connect calendar: ' + error.message);
        }
    }

    async syncCalendar() {
        console.log('[SHARED-NAV] Starting manual calendar sync...');
        
        const syncBtn = document.querySelector('.calendar-sync-btn');
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = `
                <span class="material-icons">sync</span>
                Syncing...
            `;
        }

        try {
            const headers = this.getAuthHeaders();
            if (!headers) {
                throw new Error('No authentication token');
            }

            const response = await fetch(getApiUrl('/api/calendar/sync'), {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({})
            });

            if (!response.ok) {
                throw new Error(`Sync failed: ${response.status}`);
            }

            const data = await response.json();
            console.log('[SHARED-NAV] Calendar sync completed:', data);

            // Show success feedback
            alert(`Calendar sync completed! Processed ${data.results?.processed || 0} events.`);
            
            // Refresh calendar status
            this.loadCalendarStatus();

        } catch (error) {
            console.error('[SHARED-NAV] Calendar sync failed:', error);
            alert('Calendar sync failed: ' + error.message);
        } finally {
            // Reset sync button
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = `
                    <span class="material-icons">sync</span>
                    Sync Now
                `;
            }
        }
    }

    async disconnectCalendar() {
        console.log('[SHARED-NAV] Disconnecting calendar...');
        
        const confirmed = confirm('Are you sure you want to disconnect your Google Calendar? This will remove all synced events.');
        if (!confirmed) {
            return;
        }

        try {
            const headers = this.getAuthHeaders();
            if (!headers) {
                throw new Error('No authentication token');
            }

            const response = await fetch(getApiUrl('/api/calendar/connection'), {
                method: 'DELETE',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Failed to disconnect: ${response.status}`);
            }

            console.log('[SHARED-NAV] Calendar disconnected successfully');
            alert('Google Calendar disconnected successfully.');
            
            // Refresh calendar status
            this.loadCalendarStatus();

        } catch (error) {
            console.error('[SHARED-NAV] Failed to disconnect calendar:', error);
            alert('Failed to disconnect calendar: ' + error.message);
        }
    }

    handleCalendarAuthCallback() {
        // Handle OAuth callback results from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const authResult = urlParams.get('calendar_auth');
        const email = urlParams.get('email');

        if (authResult === 'success') {
            console.log('[SHARED-NAV] Calendar connected successfully');
            alert(`Google Calendar connected successfully! Email: ${email || 'Unknown'}`);
            
            // Clean up URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
            // Refresh calendar status
            setTimeout(() => this.loadCalendarStatus(), 1000);
            
        } else if (authResult === 'denied') {
            console.log('[SHARED-NAV] Calendar authorization denied by user');
            alert('Calendar connection was cancelled. You can try again anytime.');
            
            // Clean up URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
        } else if (authResult === 'error') {
            console.error('[SHARED-NAV] Calendar authorization failed');
            alert('Failed to connect Google Calendar. Please try again.');
            
            // Clean up URL
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }

    // === END GOOGLE CALENDAR INTEGRATION ===
    
}

// Conditional initialization - only initialize if not already done by page-specific script
document.addEventListener('DOMContentLoaded', async function() {
    // Check if another script has already initialized or will initialize shared navigation
    if (window.sharedNavigationInstance || document.querySelector('script[src*="executive_dashboard_init"]')) {
        return;
    }
    
    
    const sharedNav = new SharedNavigation();
    window.sharedNavigationInstance = sharedNav;
    
    await sharedNav.initialize();
    
    // Handle calendar OAuth callback if present
    sharedNav.handleCalendarAuthCallback();
    
    // Delay user info initialization to ensure DOM is fully ready
    setTimeout(() => {
        sharedNav.initializeUserInfo();
    }, 100);
    
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedNavigation;
} 