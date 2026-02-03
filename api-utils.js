// Utility functions for API URL handling

/**
 * Constructs a proper API URL by combining the base URL with an endpoint.
 * Handles edge cases like missing/extra slashes and undefined values.
 * 
 * @param {string} endpoint - The API endpoint (e.g., '/api/users')
 * @returns {string} The full API URL
 */
function getApiUrl(endpoint) {
    // Get base URL from config, with fallback
    const baseUrl = window.APP_CONFIG?.API_BASE_URL || (
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3000'
            : 'https://cmrp-opps-backend.onrender.com'
    );

    // Remove trailing slash from base URL
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    // Ensure endpoint starts with slash
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;

    return cleanBaseUrl + cleanEndpoint;
}

// Make available globally
window.getApiUrl = getApiUrl;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getApiUrl };
} 