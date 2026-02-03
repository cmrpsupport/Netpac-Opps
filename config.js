// Configuration for all environments
const config = {
    // API Base URL - automatically determines environment
    API_BASE_URL: (() => {
        // Check if we're in development (localhost)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:3000';  // Local development
        }
        // Production - use same origin (monolithic deployment)
        return window.location.origin;
    })(),
    
    // Environment detection
    ENVIRONMENT: (() => {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'development';
        }
        if (window.location.protocol === 'file:') {
            return 'development'; // Local file access counts as development
        }
        return 'production';
    })(),
    
    // Other configuration options
    APP_NAME: 'CMRP Opps Management',
    VERSION: '1.0.0',
    
    // API endpoints
    ENDPOINTS: {
        AUTH: '/api/auth',
        OPPORTUNITIES: '/api/opportunities',
        USERS: '/api/users',
        DASHBOARD: '/api/dashboard',
        HEARTBEAT: '/api/heartbeat',
        ONLINE_USERS: '/api/online-users',
        AUDIT_LOG: '/api/audit-log-page-access',
        PROPOSAL_WORKBENCH: '/api/proposal-workbench',
        SNAPSHOTS: '/api/snapshots',
        NOTIFICATIONS: '/api/notifications'
    },

    // CORS settings
    CORS: {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }
};

// Make config available globally
window.APP_CONFIG = config;

// Log current environment for debugging
console.log(`🚀 Running in ${config.ENVIRONMENT} mode`);
console.log(`📡 API Base URL: ${config.API_BASE_URL}`);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}
