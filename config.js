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

// --- Session-based token expiry ---
// If the user did not check "Remember me", clear the auth token when the browser is reopened.
// sessionStorage is cleared when the browser closes; localStorage persists.
// On login, we set sessionStorage.authSessionActive = '1'. If it's gone on page load
// and rememberMe was not checked, the token is expired.
(function checkSessionToken() {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    const rememberMe = localStorage.getItem('authRememberMe') === '1';
    const sessionActive = sessionStorage.getItem('authSessionActive') === '1';
    if (!rememberMe && !sessionActive) {
        // Browser was closed and reopened without "Remember me" — expire the token
        localStorage.removeItem('authToken');
        localStorage.removeItem('authRememberMe');
        // Redirect to login if not already on login page
        if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('/')) {
            window.location.href = 'login.html';
        }
    }
})();

// Log current environment for debugging
console.log(`🚀 Running in ${config.ENVIRONMENT} mode`);
console.log(`📡 API Base URL: ${config.API_BASE_URL}`);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}
