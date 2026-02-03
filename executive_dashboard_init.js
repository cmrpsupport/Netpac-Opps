/**
 * Executive Dashboard Initialization
 * Handles proper initialization of shared navigation and dashboard
 */

// Initialize shared navigation and dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('[EXECUTIVE-DASHBOARD] DOM loaded, initializing...');
    
    // Clean up any existing shared navigation instances
    if (window.sharedNavigationInstance) {
        console.log('[EXECUTIVE-DASHBOARD] Cleaning up existing navigation instance');
        // Clear any existing intervals
        if (window.sharedNavigationInstance.heartbeatInterval) {
            clearInterval(window.sharedNavigationInstance.heartbeatInterval);
        }
    }
    
    // Initialize fresh shared navigation instance
    const sharedNavigation = new SharedNavigation();
    window.sharedNavigationInstance = sharedNavigation;
    
    await sharedNavigation.initialize();
    
    // Initialize user info after navigation is ready
    await sharedNavigation.initializeUserInfo();
    
    // Force refresh theme state to handle navigation from other pages
    sharedNavigation.forceRefreshTheme();
    
    // Initialize dashboard after navigation is ready
    if (requireAuth()) {
        await fetchDashboardData();
        setupFilters();
        setupPeriodControls();
        setupTableControls();
        setupEventHandlers();
    }
    
    console.log('[EXECUTIVE-DASHBOARD] Initialization complete');
});

// Handle page visibility changes for proper cleanup
document.addEventListener('visibilitychange', function() {
    if (document.hidden && window.sharedNavigationInstance) {
        // Page is hidden, pause heartbeat
        if (window.sharedNavigationInstance.heartbeatInterval) {
            clearInterval(window.sharedNavigationInstance.heartbeatInterval);
            window.sharedNavigationInstance.heartbeatInterval = null;
        }
    } else if (!document.hidden && window.sharedNavigationInstance) {
        // Page is visible again, restart heartbeat
        window.sharedNavigationInstance.startHeartbeat();
    }
});

// Clean up when page is about to unload
window.addEventListener('beforeunload', function() {
    if (window.sharedNavigationInstance && window.sharedNavigationInstance.heartbeatInterval) {
        clearInterval(window.sharedNavigationInstance.heartbeatInterval);
    }
}); 