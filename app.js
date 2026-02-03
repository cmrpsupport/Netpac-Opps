// --- API Configuration ---
function getApiUrl(endpoint) {
    const baseUrl = window.APP_CONFIG?.API_BASE_URL || '';
    return `${baseUrl}${endpoint}`;
}

// --- Global Variables ---
let opportunities = [];
let headers = [];
let headerIndices = {};
let particularsIndices = [];
// Multi-level sorting - replace single sort with array of criteria
let sortCriteria = []; // Array of {columnIndex, direction, columnName}
// Keep legacy variables for backward compatibility
let currentSortColumnIndex = -1;
let currentSortDirection = 'asc';
let isLoginMode = true;
let isCreateMode = false;
let currentEditRowIndex = -1;
let showACRUD = false;
let columnVisibility = {}; // Add missing global variable for column visibility
let oppStatusColorsEnabled = false; // Toggle for OPP Status color coding

// Column resize variables
let columnWidths = {}; // Store custom column widths

// User Preferences System
let userPreferences = {
    filters: {
        search: '',
        status: [],
        accountMgr: '',
        pic: '',
        client: '',
        dateRange: { start: '', end: '' }
    },
    sorting: {
        columnIndex: -1,
        direction: 'desc'
    },
    // Multi-level sorting preferences
    multiLevelSorting: {
        enabled: false,
        criteria: []
    },
    columnWidths: {},
    columnVisibility: {},
    tableSettings: {
        oppStatusColorEnabled: false
    }
};
let justFinishedResize = false; // Track recent resize to prevent accidental sorting

// --- DOM Elements ---
let htmlElement;
let themeToggle;
let table;
let tableHead;
let tableBody;
let loadingText;
let searchInput;
let statusFilterButtonsContainer;
let solutionsFilterDropdown;
let accountMgrFilterDropdown;
let picFilterDropdown;
let createOpportunityButton;
let exportExcelButton;
let toggleColumnsButton;
let columnToggleContainer;
let authModalOverlay;
let authModal;
let authForm;
let authEmail;
let authPassword;
let authError;
let authSuccess;
let authSubmitBtn;
let switchAuthMode;
let logoutBtn;
let totalOpportunities;
let totalSubmitted;
let op100Summary;
let op90Summary;
let totalDeclined;
let totalInactive;
let lostSummary;
let declinedSummary;

// --- Constants ---
const DROPDOWN_FIELDS = ['solutions', 'sol_particulars', 'industries', 'ind_particulars', 'decision', 'account_mgr', 'pic', 'bom', 'status', 'opp_status', 'lost_rca', 'l_particulars', 'a', 'c', 'r', 'u', 'd'];
const DROPDOWN_FIELDS_NORM = DROPDOWN_FIELDS.map(field => field.toLowerCase().replace(/[^a-z0-9]/g, ''));
const encodedDateHeaders = ['encodeddate'];
const withDayHeaders = ['datereceived', 'clientdeadline', 'submitteddate', 'dateawardedlost', 'forecastdate'];
const rightAlignColumns = ['finalamt'];
const centerAlignColumns = ['mgr', 'pic', 'bom', 'rev', 'revision', 'margin', 'oppstatus', 'opportunitystatus', 'accountmanager', 'accountmgr', 'dateawardedlost'];
let dropdownOptions = {};

// --- Utility Functions ---
function debounce(func, wait) {
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

function normalizeField(field) {
    if (!field) return '';
    return field.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isDateField(header) {
    const norm = normalizeField(header || '');
    return encodedDateHeaders.includes(norm) || withDayHeaders.includes(norm) || norm === 'forecastdate';
}

function isCurrencyField(header) {
    return normalizeField(header || '').includes('amt');
}

function isMarginField(header) {
    return normalizeField(header || '').includes('margin');
}

function parseDateString(dateString) {
    if (!dateString) return null;
    dateString = String(dateString).trim();
    if (!dateString) return null;

    // Try parsing as ISO date first
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) return date;

    // Try parsing common formats
    const formats = [
        'MM/DD/YYYY',
        'MM-DD-YYYY',
        'YYYY/MM/DD',
        'YYYY-MM-DD',
        'DD/MM/YYYY',
        'DD-MM-YYYY',
        'MMM DD, YYYY',
        'MMMM DD, YYYY',
        'DD MMM YYYY',
        'DD MMMM YYYY'
    ];

    for (let format of formats) {
        try {
            const momentDate = moment(dateString, format);
            if (momentDate.isValid()) return momentDate.toDate();
        } catch (e) {
            continue;
        }
    }

    // If all else fails, try to extract numbers and make best guess
    const numbers = dateString.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
        const [n1, n2, n3] = numbers.map(n => parseInt(n));
        // Assume American format (MM/DD/YYYY) if month and day are ambiguous
        if (n1 <= 12 && n2 <= 31) {
            return new Date(n3 >= 100 ? n3 : 2000 + n3, n1 - 1, n2);
        }
    }

    // Date parsing failed silently
    return null;
}

function parseCurrency(currencyString) {
    if (!currencyString) return 0;
    if (typeof currencyString === 'number') return currencyString;
    
    // Remove currency symbols, commas, and other non-numeric characters except decimal point and minus
    const numStr = String(currencyString).replace(/[^0-9.-]/g, '');
    const value = parseFloat(numStr);
    return isNaN(value) ? 0 : value;
}

function formatDate(dateString) { // Target format: Jan-01
    try {
        let date = parseDateString(dateString);
        if (!date) return dateString;
        const month = date.toLocaleString('en-US', { month: 'short' });
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}-${day}`;
    } catch (e) {
        // Date formatting error
        return dateString;
    }
}

function formatDateWithDay(dateString) { // Target format: Mon, Jan-01
    try {
        let date = parseDateString(dateString);
        if (!date) return dateString;
        const day = date.toLocaleString('en-US', { weekday: 'short' });
        const month = date.toLocaleString('en-US', { month: 'short' });
        const dayNum = String(date.getDate()).padStart(2, '0');
        return `${day}, ${month}-${dayNum}`;
    } catch (e) {
        // Date formatting error
        return dateString;
    }
}

function formatMargin(marginValue) {
    if (!marginValue && marginValue !== 0) return '';
    if (typeof marginValue === 'string') {
        if (marginValue.includes('%')) return marginValue;
        marginValue = parseFloat(marginValue);
    }
    if (isNaN(marginValue)) return '';
    return Math.round(marginValue) + '%';
}

function formatCurrency(amountValue) {
    if (!amountValue && amountValue !== 0) return '';
    const amount = parseCurrency(amountValue);
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatCellValue(value, header) {
    if (value === null || value === undefined) return '';
    
    const normHeader = normalizeField(header);
    
    // Special handling for Google Drive folder fields
    if (header === 'google_drive_folder_url' || header === 'google_drive_folder_id') {
        return ''; // Hide raw folder ID/URL from table
    }
    if (header === 'google_drive_folder_name') {
        // Show folder name as a link if URL is available
        return value || '';
    }
    
    if (encodedDateHeaders.includes(normHeader)) {
        return formatDate(value);
    }
    
    if (withDayHeaders.includes(normHeader)) {
        return formatDateWithDay(value);
    }
    
    if (isCurrencyField(normHeader)) {
        return formatCurrency(value);
    }
    
    if (isMarginField(normHeader)) {
        return formatMargin(value);
    }
    
    return value;
}

function formatHeaderText(header) {
    if (!header) return '';
    
    // Ultra-compact header shortcuts to match tight column widths
    const headerShortcuts = {
        'account_manager': 'MGR',        // 3-char data = 3-char header
        'account_mgr': 'MGR',            // 3-char data = 3-char header
        'pic': 'PIC',                    // 3-char data = 3-char header
        'bom': 'BOM',                    // 3-char data = 3-char header
        'revision': 'REVISION',          // Use full name to distinguish from 'rev' column
        'margin': 'MARGIN',              // Percentage data
        'opp_status': 'OP',              // OP30/OP60 data = 2-char header
        'opportunity_status': 'OP',      // OP30/OP60 data = 2-char header
        'submitted_date': 'SUBMTD',      // Date format = compact header
        'project_code': 'Code',          // Short codes = short header
        'status': 'Status',              // Status column
        'encoded_date': 'ENC',           // Date format = compact header
        'date_awarded_lost': 'AWD',      // Ultra-short for date
        'remarks_comments': 'Remarks',
        'final_amt': 'Amount'
    };
    
    // Check for exact matches first (case insensitive)
    const normalizedHeader = header.toLowerCase();
    if (headerShortcuts[normalizedHeader]) {
        return headerShortcuts[normalizedHeader];
    }
    
    // Split on camelCase
    let text = header.replace(/([A-Z])/g, ' $1');
    
    // Split on underscores and remove them
    text = text.replace(/_/g, ' ');
    
    // Capitalize first letter of each word
    text = text.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    
    // Handle special cases
    text = text.replace(/Amt/g, 'Amount')
        .replace(/Mgr/g, 'Manager')
        .replace(/Pic/g, 'PIC')
        .replace(/Op/g, 'OP')
        .replace(/Uid/g, 'ID')
        .replace(/Id/g, 'ID')
        .replace(/Rca/g, 'RCA');
    
    return text.trim();
}

function formatToggleLabelText(header) {
    if (!header) return '';
    
    // Toggle Column Visibility labels - Different from table headers for better clarity
    const toggleLabels = {
        'account_manager': 'Account Manager',    // Full name for clarity
        'account_mgr': 'Account Manager',        // Full name for clarity  
        'pic': 'PIC',                           // Keep as PIC
        'bom': 'BOM',                           // Keep as BOM
        'revision': 'REVISION',                 // Use full name
        'margin': 'Margin',                     // Full word for clarity
        'opp_status': 'OP',                     // Keep as OP
        'opportunity_status': 'OP',             // Keep as OP
        'submitted_date': 'Submitted Date',     // Full descriptive label
        'project_code': 'Project Code',         // Full descriptive label
        'status': 'Status',                     // Keep as Status
        'encoded_date': 'Encoded Date',         // Full descriptive label
        'date_awarded_lost': 'Awarded Date / Lost Date',  // Full descriptive label
        'remarks_comments': 'Remarks',
        'final_amt': 'Amount'
    };
    
    // Check for exact matches first (case insensitive)
    const normalizedHeader = header.toLowerCase();
    if (toggleLabels[normalizedHeader]) {
        return toggleLabels[normalizedHeader];
    }
    
    // Fall back to the standard header formatting
    return formatHeaderText(header);
}

// --- Initialize App ---
// Initialize app directly with a provided token (for auto-login)
async function initializeAppDirectly(token) {
    // Initialize app directly
    return await initializeAppWithToken(token);
}

// Initialize app using getAuthToken() (for normal flow)
async function initializeApp() {
    const token = getAuthToken();
    // Token check
    if (!token) {
        throw new Error('No authentication token found');
    }
    return await initializeAppWithToken(token);
}

// Function to refresh opportunities data from server
async function refreshOpportunitiesData() {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('No authentication token found');
        }

        console.log('🔄 Refreshing opportunities data from server...');

        const response = await fetch(getApiUrl('/api/opportunities'), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch opportunities');
        }

        opportunities = await response.json();
        
        // Re-render the table with updated data
        filterAndSortData();
        
        console.log('✅ Opportunities data refreshed successfully');
    } catch (error) {
        console.error('❌ Failed to refresh opportunities data:', error);
        throw error;
    }
}

// Common initialization logic
async function initializeAppWithToken(token) {
    try {
        // Initializing app

        // Show loading state
        if (loadingText) loadingText.style.display = 'block';

        // Fetch opportunities data
        const response = await fetch(getApiUrl('/api/opportunities'), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // API response received

        if (!response.ok) {
            throw new Error('Failed to fetch opportunities');
        }

        opportunities = await response.json();
        console.log(`✅ [INDEX-DEBUG] Fetched ${opportunities?.length || 0} opportunities from API`);

        // Load user preferences BEFORE table initialization
        console.log('🚀 [INDEX-DEBUG] ===== INITIALIZING APP =====');
        await loadUserPreferences();
        console.log('🚀 [INDEX-DEBUG] User preferences loaded, continuing initialization...');
        
        // Initialize the table with the data (this will apply auto-filters)
        await initializeTable();
        
        
        // Initialize project code duplicate validation
        console.log('🔍 Setting up project code duplicate validation...');
        setupProjectCodeValidation();
        
        // Apply DOM-related preferences after table is ready with better timing
        setTimeout(() => {
            applyDOMPreferences();
            
            // Apply auto-filters only if user hasn't loaded before
            if (!userPreferences.hasLoadedBefore) {
                setTimeout(() => {
                    applyAutoFiltersForUser();
                    userPreferences.hasLoadedBefore = true;
                    
                    // Capture initial state after auto-filtering
                    setTimeout(() => {
                        console.log('[PREFERENCES] Capturing initial state after auto-filtering');
                        if (statusFilterButtonsContainer && accountMgrFilterDropdown && picFilterDropdown && searchInput) {
                            userPreferences.filters = getActiveFilters();
                            userPreferences.sorting = {
                                columnIndex: currentSortColumnIndex,
                                direction: currentSortDirection
                            };
                            userPreferences.columnWidths = { ...columnWidths };
                            userPreferences.columnVisibility = { ...columnVisibility };
                            userPreferences.tableSettings.oppStatusColorEnabled = oppStatusColorsEnabled;
                            saveUserPreferences();
                            console.log('[PREFERENCES] Initial preferences captured and saved');
                        }
                    }, 200);
                }, 100);
            }
        }, 150);
        
        // Small delay to ensure filters are applied, then load dashboard
        setTimeout(() => {
            const userRoles = getCurrentUserRoles();
            const isSalesUser = userRoles.some(role => role.toUpperCase() === 'SALES');
            
            // Loading dashboard
            
            // FIXED: Dashboard cards should always show global metrics (all data)
            // regardless of user role or applied filters. Only the table gets filtered.
            // Loading dashboard with global data
            loadDashboardData(opportunities);
        }, 200);
        
        // Update navigation visibility based on user roles
        updateUserMgmtNavVisibility();
        updateProposalWorkbenchNavVisibility();
        
        // Update change password button visibility
        updateChangePasswordBtnVisibility();
        
        // Hide loading state
        loadingText.style.display = 'none';
        
        // Initialize dashboard comparison toggles
        initializeDashboardToggles();
        
    } catch (error) {
        // Error initializing app
        console.error({
            name: error.name,
            message: error.message,
            stack: error.stack,
            toString: error.toString()
        });
        
        // Check if this is an authentication error vs other errors
        const isAuthError = error.message.includes('authentication') || 
                           error.message.includes('token') || 
                           error.message.includes('unauthorized') ||
                           error.message.includes('403') ||
                           error.message.includes('401');
        
        // Show detailed error to user
        const errorDetails = `
            <strong>App Initialization Error:</strong><br>
            <strong>Message:</strong> ${error.message}<br>
            <strong>Type:</strong> ${error.name}<br>
            <strong>Details:</strong> Check browser console for full stack trace<br>
            <strong>Solution:</strong> ${isAuthError ? 'Please log in again' : 'This might be a network issue. Try refreshing the page.'}
        `;
        showAuthErrorBanner(errorDetails);
        
        // Show the main content anyway in case it's a non-critical error
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'block';
        }
        
        // Hide loading state
        if (loadingText) {
            loadingText.style.display = 'none';
        }
        
        // Check for bypass flags
        const bypassErrorLogout = localStorage.getItem('bypassErrorLogout');
        const emergencyBypass = localStorage.getItem('emergencyBypass');
        
        // Only logout if it's definitely an authentication error AND no bypass is set
        if (isAuthError && !bypassErrorLogout && !emergencyBypass) {
            // Authentication error - logging out
            handleLogout();
        } else {
            // Non-auth error - keeping logged in
            
            if (bypassErrorLogout || emergencyBypass) {
                // Emergency bypass active
                // Clear bypass flags after use to avoid permanent bypass
                localStorage.removeItem('emergencyBypass'); // Clear emergency bypass after one use
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // Note: User preferences will be loaded after table initialization
    // Legacy fallback for column widths if not in user preferences
    loadColumnWidthsFromStorage();
    
    // Initialize DOM elements
    htmlElement = document.documentElement;
    themeToggle = document.getElementById('themeToggle');
    table = document.getElementById('opportunitiesTable');
    tableHead = table.querySelector('thead');
    tableBody = table.querySelector('tbody');
    loadingText = document.getElementById('loadingText');
    searchInput = document.getElementById('searchInput');
    statusFilterButtonsContainer = document.getElementById('statusFilterButtons');
    solutionsFilterDropdown = document.getElementById('solutionsFilter');
    accountMgrFilterDropdown = document.getElementById('accountMgrFilter');
    picFilterDropdown = document.getElementById('picFilter');
    createOpportunityButton = document.getElementById('createOpportunityButton');
    exportExcelButton = document.getElementById('exportExcelButton');
    toggleColumnsButton = document.getElementById('toggleColumnsButton');
    columnToggleContainer = document.getElementById('columnToggleContainer');
    authModalOverlay = document.getElementById('authModalOverlay');
    authModal = document.getElementById('authModal');
    authForm = document.getElementById('authForm');
    authEmail = document.getElementById('authEmail');
    authPassword = document.getElementById('authPassword');
    authError = document.getElementById('authError');
    authSuccess = document.getElementById('authSuccess');
    authSubmitBtn = document.getElementById('authSubmitBtn');
    switchAuthMode = document.getElementById('switchAuthMode');
    logoutBtn = document.getElementById('logoutBtn');
    totalOpportunities = document.getElementById('totalOpportunities');
    totalSubmitted = document.getElementById('totalSubmitted');
    op100Summary = document.getElementById('op100Summary');
    op90Summary = document.getElementById('op90Summary');
    totalDeclined = document.getElementById('totalDeclined');
    totalInactive = document.getElementById('totalInactive');
    lostSummary = document.getElementById('lostSummary');
    declinedSummary = document.getElementById('declinedSummary');

    // Initialize theme
    initializeTheme();

    // CRITICAL SECURITY: Immediate authentication check - no delays or UI exposure
    // Authentication verification
    
    const authLoadingScreen = document.getElementById('authLoadingScreen');
    const appContent = document.getElementById('appContent');
    const authLoadingRedirect = document.getElementById('authLoadingRedirect');
    
    function showAuthenticatedContent() {
        // User authenticated
        if (authLoadingScreen) authLoadingScreen.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
        
        // Initialize the authenticated app
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'block';
        }
        initializeApp();
    }
    
    function showLoginRedirect() {
        // Authentication failed
        if (authLoadingScreen) {
            const spinner = authLoadingScreen.querySelector('.auth-loading-spinner');
            const message = authLoadingScreen.querySelector('.auth-loading-message');
            if (spinner) spinner.style.display = 'none';
            if (message) message.textContent = 'Authentication required';
            if (authLoadingRedirect) authLoadingRedirect.style.display = 'block';
        }
        
        // Auto-redirect after 3 seconds
        setTimeout(() => {
            // Auto-redirecting to login
            window.location.href = 'login.html';
        }, 3000);
    }
    
    // Immediate authentication check - no UI exposure
    const token = getAuthToken();
    // Token check result
    
    if (!token) {
        // In development mode, try auto-login with development credentials
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDevelopment) {
            // Development mode - auto-login
            
            // Clear any existing invalid tokens first
            localStorage.removeItem('authToken');
            // Cleared tokens for auto-login
            
            // Use a more direct approach - directly initialize with the token
            (async () => {
                try {
                    const response = await fetch(getApiUrl('/api/login'), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            email: 'reuel.rivera@cmrpautomation.com',
                            password: 'dev123'
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.token) {
                            // Auto-login successful
                            
                            // Store token and directly initialize app with it
                            localStorage.setItem('authToken', data.token);
                            
                            
                            // Show authenticated content immediately
                            if (authLoadingScreen) authLoadingScreen.style.display = 'none';
                            if (appContent) appContent.style.display = 'block';
                            
                            const mainContent = document.querySelector('.main-content');
                            if (mainContent) {
                                mainContent.style.display = 'block';
                            }
                            
                            // Initialize app directly (bypass getAuthToken timing issues)
                            await initializeAppDirectly(data.token);
                            return;
                        }
                    }
                } catch (error) {
                    // Auto-login failed
                }
                
                // If auto-login failed, show login redirect
                // Auto-login failed - redirecting
                showLoginRedirect();
            })();
            return; // Stop execution here, let the async function handle the flow
        }
        
        // No token - redirecting
        showLoginRedirect();
        return; // Stop execution - don't initialize any app features
    }
    
    // Token exists - verify it's valid before showing content
    // Token found - verifying
    
    // For now, trust the token if it exists (can be enhanced with server verification)
    // TODO: Add server-side token verification for enhanced security
    try {
        // Basic token validation
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            throw new Error('Token expired');
        }
        // Token validation successful
        
        showAuthenticatedContent();
    } catch (error) {
        // Token validation failed
        localStorage.removeItem('authToken');
        showLoginRedirect();
        return;
    }

    // Initialize change password button visibility
    updateChangePasswordBtnVisibility();

    // Initialize event listeners
    initializeEventListeners();
});

// Number formatting functions for Final Amount
function formatNumberWithCommas(num) {
    if (num === '' || num === null || num === undefined) return '';
    const number = parseFloat(num.toString().replace(/,/g, ''));
    if (isNaN(number)) return '';
    return number.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function removeCommas(str) {
    return str.replace(/,/g, '');
}

function formatFinalAmountInput(event) {
    const input = event.target;
    const cursorPosition = input.selectionStart;
    const oldValue = input.value;
    const oldLength = oldValue.length;
    
    // Remove commas and format
    const numericValue = removeCommas(oldValue);
    const formattedValue = formatNumberWithCommas(numericValue);
    
    // Update input value
    input.value = formattedValue;
    
    // Restore cursor position, accounting for added/removed commas
    const newLength = formattedValue.length;
    const lengthDiff = newLength - oldLength;
    const newCursorPosition = Math.max(0, cursorPosition + lengthDiff);
    
    // Set cursor position after a brief delay to ensure the value is updated
    setTimeout(() => {
        input.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
}

function initializeEventListeners() {
    // Global ESC key support for all modals
    initializeGlobalModalSupport();
    // Theme toggle
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    // Auth form submission
    if (authForm) authForm.addEventListener('submit', handleAuthSubmit);

    // Switch auth mode
    if (switchAuthMode) switchAuthMode.addEventListener('click', () => setAuthMode(!isLoginMode));

    // Close auth modal on overlay click
    if (authModalOverlay) {
        authModalOverlay.addEventListener('click', (e) => {
            if (e.target === authModalOverlay) {
                hideAuthModal();
            }
        });
    }
    
    // Prevent modal from closing when clicking inside the modal
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Logout button
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Change password button
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            window.location.href = 'update_password.html';
        });
    }

    // Auth login redirect button
    const authLoginRedirectBtn = document.getElementById('authLoginRedirectBtn');
    if (authLoginRedirectBtn) {
        authLoginRedirectBtn.addEventListener('click', function() {
            window.location.href = 'login.html';
        });
    }

    // Search input
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            filterAndSortData();
            // Save filter preferences
            saveUserPreferences();
        }, 300));
    }

    // Status filter buttons
    if (statusFilterButtonsContainer) {
        statusFilterButtonsContainer.addEventListener('click', function(e) {
            if (e.target.matches('button.filter-button')) {
                const clickedButton = e.target;
                const filterValue = clickedButton.dataset.filterValue;
                
                console.log('[FILTERS] 🎯 Button clicked:', filterValue, 'Button element:', clickedButton);
                
                // Handle "All" button - clear all other selections
                if (filterValue === 'all') {
                    console.log('[FILTERS] 🎯 Handling ALL button click');
                    statusFilterButtonsContainer.querySelectorAll('.filter-button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    clickedButton.classList.add('active');
                } else {
                    console.log('[FILTERS] 🎯 Handling specific filter button:', filterValue);
                    // Handle specific status filters - toggle behavior
                    const allButton = statusFilterButtonsContainer.querySelector('.filter-button[data-filter-value="all"]');
                    
                    // If "All" is currently active, remove it first
                    if (allButton && allButton.classList.contains('active')) {
                        console.log('[FILTERS] 🎯 Removing ALL button active state');
                        allButton.classList.remove('active');
                    }
                    
                    // Toggle the clicked button
                    const wasActive = clickedButton.classList.contains('active');
                    clickedButton.classList.toggle('active');
                    const isNowActive = clickedButton.classList.contains('active');
                    console.log('[FILTERS] 🎯 Button toggle:', filterValue, 'was active:', wasActive, 'now active:', isNowActive);
                    
                    // If no buttons are active, activate "All"
                    const activeButtons = statusFilterButtonsContainer.querySelectorAll('.filter-button.active');
                    console.log('[FILTERS] 🎯 Active buttons after toggle:', activeButtons.length);
                    if (activeButtons.length === 0 && allButton) {
                        console.log('[FILTERS] 🎯 No buttons active, activating ALL');
                        allButton.classList.add('active');
                    }
                }
                
                // Get current state before save
                const currentFilters = getActiveFilters();
                console.log('[FILTERS] 🎯 About to filter and save, current filters:', currentFilters);
                
                filterAndSortData();
                // Save filter preferences
                console.log('[FILTERS] 🎯 Saving preferences after filter button click');
                saveUserPreferences();
            }
        });
    }

    // Account Manager, PIC, and Solutions filters
    if (accountMgrFilterDropdown) {
        accountMgrFilterDropdown.addEventListener('change', function() {
            // Account filter changed
            filterAndSortData();
            // Save filter preferences
            saveUserPreferences();
            
            // FIXED: Dashboard cards should always show global metrics regardless of user role
            // Only the table gets filtered, dashboard cards remain global
            // Table filtered
            // Note: Dashboard cards use snapshot data or global opportunities data, not filtered data
        });
    }
    if (picFilterDropdown) {
        picFilterDropdown.addEventListener('change', function() {
            filterAndSortData();
            // Save filter preferences
            saveUserPreferences();
            // PIC filter should not affect dashboard cards
            // PIC filter applied
        });
    }
    if (solutionsFilterDropdown) {
        solutionsFilterDropdown.addEventListener('change', function() {
            filterAndSortData();
            // Save filter preferences
            saveUserPreferences();
            
            // FIXED: Dashboard cards should always show global metrics regardless of user role
            // Only the table gets filtered, dashboard cards remain global
            // Solutions filter applied
            // Note: Dashboard cards use snapshot data or global opportunities data, not filtered data
        });
    }

    // Create opportunity button
    if (createOpportunityButton) {
        createOpportunityButton.addEventListener('click', showCreateOpportunityModal);
    }

    // Import functionality is now handled within the create modal tabs

    // Upload Excel button
    const uploadExcelButton = document.getElementById('uploadExcelButton');
    if (uploadExcelButton) {
        uploadExcelButton.addEventListener('click', showExcelUploadModal);
    }

    // Export to Excel button
    if (exportExcelButton) {
        exportExcelButton.addEventListener('click', function() {
            const wb = XLSX.utils.table_to_book(opportunitiesTable, {sheet: "Opportunities"});
            XLSX.writeFile(wb, "opportunities.xlsx");
        });
    }

    // Toggle columns button
    if (toggleColumnsButton) {
        toggleColumnsButton.addEventListener('click', () => {
            columnToggleContainer.classList.toggle('hidden');
        });
    }

    // Dashboard toggle buttons for weekly/monthly comparison
    const weeklyToggle = document.getElementById('weeklyToggle');
    const monthlyToggle = document.getElementById('monthlyToggle');
    const noCompareToggle = document.getElementById('noCompareToggle');

    if (weeklyToggle) {
        weeklyToggle.addEventListener('click', () => setComparisonMode('weekly'));
    }
    if (monthlyToggle) {
        monthlyToggle.addEventListener('click', () => setComparisonMode('monthly'));
    }
    if (noCompareToggle) {
        noCompareToggle.addEventListener('click', () => setComparisonMode('none'));
    }
    
    // OPP Status Color Coding Toggle
    const oppStatusColorToggle = document.getElementById('oppStatusColorToggle');
    if (oppStatusColorToggle) {
        oppStatusColorToggle.addEventListener('click', function() {
            oppStatusColorsEnabled = !oppStatusColorsEnabled;
            // Status color toggle changed
            
            // Update button appearance and text
            if (oppStatusColorsEnabled) {
                oppStatusColorToggle.classList.add('active');
                oppStatusColorToggle.innerHTML = '<span class="material-icons" style="font-size: 1rem;">palette</span>On';
            } else {
                oppStatusColorToggle.classList.remove('active');
                oppStatusColorToggle.innerHTML = '<span class="material-icons" style="font-size: 1rem;">palette</span>Off';
            }
            
            // Apply color coding to current table
            applyOppStatusColorCoding();
            
            // Save table settings preferences
            saveUserPreferences();
        });
    }

    // Storage event listener (for multi-tab support)
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken') {
            if (!e.newValue) {
                showMainContent(false);
                setAuthMode(true);
                showAuthModal();
            } else {
                showMainContent(true);
                hideAuthModal();
            }
            // Update navigation visibility based on user roles when auth token changes
            updateUserMgmtNavVisibility();
            updateProposalWorkbenchNavVisibility();
            updateChangePasswordBtnVisibility();
        }
    });

    // Edit modal events
    document.getElementById('editRowModalCloseX').addEventListener('click', hideEditRowModal);
    document.getElementById('closeEditRowModalButton').addEventListener('click', hideEditRowModal);
    document.getElementById('editRowForm').addEventListener('submit', handleEditFormSubmit);
    document.getElementById('syncFromDriveBtn').addEventListener('click', handleSyncFromDrive);

    // Revision history modal events
    document.getElementById('closeRevisionHistoryButton').addEventListener('click', hideRevisionHistoryModal);
    document.getElementById('closeRevisionHistoryModalX').addEventListener('click', hideRevisionHistoryModal);
    
    // Handle click outside revision history modal to close
    document.getElementById('revisionHistoryModalOverlay').addEventListener('click', function(e) {
        if (e.target === this) {
            hideRevisionHistoryModal();
        }
    });

    // Handle ESC key for modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideEditRowModal();
            hideRevisionHistoryModal();
        }
    });

    // Handle click outside modal for edit modal
    document.getElementById('editRowModalOverlay').addEventListener('click', function(e) {
        if (e.target === this) {
            hideEditRowModal();
        }
    });

    // Create Opportunity modal events
    var createOpportunityButton = document.getElementById('createOpportunityButton');
    var createOpportunityModal = document.getElementById('createOpportunityModal');
    var createOpportunityModalOverlay = document.getElementById('createOpportunityModalOverlay');
    var closeCreateOpportunityModalButton = document.getElementById('closeCreateOpportunityModalButton');
    var createOpportunityModalCloseX = document.getElementById('createOpportunityModalCloseX');
    var createOpportunityForm = document.getElementById('createOpportunityForm');

    if (createOpportunityButton && createOpportunityModal && createOpportunityModalOverlay) {
        createOpportunityButton.addEventListener('click', function() {
            // Call our function to dynamically create the form with proper dropdowns
            showCreateOpportunityModal();
        });
    }
    
    // Add form submission handler for create opportunity
    if (createOpportunityForm) {
        createOpportunityForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Only proceed if the form was submitted via button click, not Enter key
            if (!e.submitter || e.submitter.id !== 'saveCreateOpportunityButton') {
                console.log('⚠️ Form submission blocked - must use "Create Opportunity" button');
                return;
            }
            
            console.log('✅ Form submitted via button click');
            
            // Set create mode variables
            isCreateMode = true;
            currentEditRowIndex = -1;
            
            // Use the same handler as edit form
            await handleEditFormSubmit(e);
        });
    }
    
    // Add formatting to create modal Final Amount field
    const createFinalAmountField = document.getElementById('newFinalAmount');
    if (createFinalAmountField) {
        createFinalAmountField.addEventListener('input', formatFinalAmountInput);
    }
    // closeCreateModal function moved to global scope
    if (closeCreateOpportunityModalButton) {
        closeCreateOpportunityModalButton.addEventListener('click', closeCreateModal);
    }
    if (createOpportunityModalCloseX) {
        createOpportunityModalCloseX.addEventListener('click', closeCreateModal);
    }
    if (createOpportunityModalOverlay) {
        createOpportunityModalOverlay.addEventListener('click', function(e) {
            if (e.target === createOpportunityModalOverlay) closeCreateModal();
        });
    }

    // Excel Upload Modal event listeners
    const excelUploadModalOverlay = document.getElementById('excelUploadModalOverlay');
    const closeExcelUploadModalButton = document.getElementById('closeExcelUploadModalButton');
    const excelUploadModalCloseX = document.getElementById('excelUploadModalCloseX');
    const processExcelUploadButton = document.getElementById('processExcelUploadButton');
    
    if (closeExcelUploadModalButton) {
        closeExcelUploadModalButton.addEventListener('click', hideExcelUploadModal);
    }
    if (excelUploadModalCloseX) {
        excelUploadModalCloseX.addEventListener('click', hideExcelUploadModal);
    }
    if (excelUploadModalOverlay) {
        excelUploadModalOverlay.addEventListener('click', function(e) {
            if (e.target === excelUploadModalOverlay) hideExcelUploadModal();
        });
    }
    if (processExcelUploadButton) {
        processExcelUploadButton.addEventListener('click', processExcelUpload);
    }

    // Google Drive Import Modal event listeners
    const googleDriveImportModalOverlay = document.getElementById('googleDriveImportModalOverlay');
    const closeGoogleDriveImportModalButton = document.getElementById('closeGoogleDriveImportModalButton');
    const googleDriveImportModalCloseX = document.getElementById('googleDriveImportModalCloseX');
    const importSearchFoldersButton = document.getElementById('importSearchFoldersButton');
    const importFromManualFolderButtonNew = document.getElementById('importFromManualFolderButton');
    
    if (closeGoogleDriveImportModalButton) {
        closeGoogleDriveImportModalButton.addEventListener('click', hideGoogleDriveImportModal);
    }
    if (googleDriveImportModalCloseX) {
        googleDriveImportModalCloseX.addEventListener('click', hideGoogleDriveImportModal);
    }
    if (googleDriveImportModalOverlay) {
        googleDriveImportModalOverlay.addEventListener('click', function(e) {
            if (e.target === googleDriveImportModalOverlay) hideGoogleDriveImportModal();
        });
    }
    if (importSearchFoldersButton) {
        importSearchFoldersButton.addEventListener('click', performImportModalFolderSearch);
    }
    if (importFromManualFolderButtonNew) {
        importFromManualFolderButtonNew.addEventListener('click', handleImportFromManualFolder);
    }

    // Enhanced import modal search input with instant suggestions
    const importFolderSearchInput = document.getElementById('importFolderSearchInput');
    if (importFolderSearchInput) {
        // Enter key support
        importFolderSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performImportModalFolderSearch();
            }
        });
        
        // Real-time suggestions as user types
        let searchTimeout;
        importFolderSearchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length >= 2) {
                // Debounce search to avoid too many calls
                searchTimeout = setTimeout(() => {
                    showInstantSuggestions(query);
                }, 300);
            } else {
                hideInstantSuggestions();
            }
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', function(e) {
            if (!importFolderSearchInput.contains(e.target) && 
                !document.getElementById('instantSuggestionsDropdown').contains(e.target)) {
                hideInstantSuggestions();
            }
        });
        
        // Keyboard navigation for suggestions
        importFolderSearchInput.addEventListener('keydown', function(e) {
            const dropdown = document.getElementById('instantSuggestionsDropdown');
            const suggestions = dropdown.querySelectorAll('.suggestion-item');
            
            if (suggestions.length === 0) return;
            
            let selectedIndex = Array.from(suggestions).findIndex(item => 
                item.classList.contains('suggestion-selected'));
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = selectedIndex < suggestions.length - 1 ? selectedIndex + 1 : 0;
                updateSelectedSuggestion(suggestions, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : suggestions.length - 1;
                updateSelectedSuggestion(suggestions, selectedIndex);
            } else if (e.key === 'Tab' && selectedIndex >= 0) {
                e.preventDefault();
                selectSuggestion(suggestions[selectedIndex]);
            }
        });
    }

    // Add Enter key support for manual folder input in import modal
    const importManualFolderInput = document.getElementById('importManualFolderIdInput');
    if (importManualFolderInput) {
        importManualFolderInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleImportFromManualFolder();
            }
        });
    }

    // "Import from Google Drive" button in Create Modal
    const openGoogleDriveImportButton = document.getElementById('openGoogleDriveImportButton');
    if (openGoogleDriveImportButton) {
        openGoogleDriveImportButton.addEventListener('click', function(e) {
            console.log('🔄 Import button clicked! Opening import results modal');
            e.preventDefault();
            showImportResultsModal();
        });
    }
    
    // Import Results Modal event listeners
    const importResultsCloseButton = document.getElementById('importResultsCloseButton');
    const importResultsModalCloseX = document.getElementById('importResultsModalCloseX');
    const importResultsModalOverlay = document.getElementById('importResultsModalOverlay');
    const tryAgainButton = document.getElementById('tryAgainButton');
    
    if (importResultsCloseButton) {
        importResultsCloseButton.addEventListener('click', hideImportResultsModal);
    }
    if (importResultsModalCloseX) {
        importResultsModalCloseX.addEventListener('click', hideImportResultsModal);
    }
    if (importResultsModalOverlay) {
        importResultsModalOverlay.addEventListener('click', function(e) {
            if (e.target === importResultsModalOverlay) hideImportResultsModal();
        });
    }
    if (tryAgainButton) {
        tryAgainButton.addEventListener('click', function() {
            resetImportResultsModal();
        });
    }
    
    // Search functionality for import results modal
    const quickImportSearchButton = document.getElementById('quickImportSearchButton');
    const quickImportSearchInput = document.getElementById('quickImportSearchInput');
    
    if (quickImportSearchButton) {
        quickImportSearchButton.addEventListener('click', function() {
            performUserImportSearch();
        });
    }
    
    if (quickImportSearchInput) {
        quickImportSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performUserImportSearch();
            }
        });
    }
    
    // Event delegation for dynamic buttons
    document.addEventListener('click', function(e) {
        // Handle notification close buttons
        if (e.target.closest('[data-action="close-notification"]')) {
            const notification = e.target.closest('.notification');
            if (notification) {
                notification.remove();
            }
        }
        
        // Handle import project buttons
        if (e.target.closest('[data-action="import-project"]')) {
            const button = e.target.closest('[data-action="import-project"]');
            const folderId = button.getAttribute('data-folder-id');
            const folderName = button.getAttribute('data-folder-name');
            if (folderId && folderName) {
                importProjectDataFromFolder(folderId, folderName);
            }
        }
        
        // Handle confirm import button
        if (e.target.closest('#confirmImportButton')) {
            console.log('🔘 Confirm import button clicked!');
            console.log('🔍 importPreviewData:', importPreviewData);
            if (importPreviewData) {
                confirmImportAndCreateOpportunity();
            } else {
                console.error('❌ No importPreviewData found!');
            }
        }
        
        // Handle back to search button
        if (e.target.closest('#backToSearchButton')) {
            // Go back to results view
            hideElement('importPreviewState');
            showElement('importResultsState');
        }
    });
    
    // Excel file input change handler
    const excelFileInput = document.getElementById('excelFileInput');
    if (excelFileInput) {
        excelFileInput.addEventListener('change', analyzeFileName);
    }
    
    // Optionally: ESC key closes modal
    document.addEventListener('keydown', function(e) {
        if (!createOpportunityModal.classList.contains('hidden') && e.key === 'Escape') {
            closeCreateModal();
        }
    });
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    authError.style.display = 'none';
    authSuccess.style.display = 'none';
    authSubmitBtn.disabled = true;
    
    const email = authEmail.value.trim();
    const password = authPassword.value;
    
    if (!validateEmail(email)) {
        authError.textContent = 'Invalid email format.';
        authError.style.display = 'block';
        authSubmitBtn.disabled = false;
        return;
    }
    
    if (!validatePassword(password)) {
        authError.textContent = 'Password must be 8-100 characters.';
        authError.style.display = 'block';
        authSubmitBtn.disabled = false;
        return;
    }
    
    try {
        const res = await fetch(getApiUrl('/api/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        
        localStorage.setItem('authToken', data.token);
        
        
        updateUserMgmtNavVisibility();
        updateProposalWorkbenchNavVisibility();
        updateChangePasswordBtnVisibility();
        showMainContent(true);
        hideAuthModal();
        await initializeApp();
    } catch (err) {
        authError.textContent = err.message;
        authError.style.display = 'block';
    } finally {
        authSubmitBtn.disabled = false;
    }
}

function handleLogout() {
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
}

// --- Theme Management ---
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    // Default to dark theme if no saved preference
    const theme = savedTheme || 'dark';
    if (savedTheme === null) {
        localStorage.setItem('theme', 'dark');
    }
    
    applyTheme(theme);
    
    const logo = document.getElementById('cmrpLogo');
    if (logo) {
        logo.src = 'Logo/CMRP Logo Light.svg';
    }
    
    // Theme initialized
}

function applyTheme(theme) {
    const isDark = theme === 'dark';
    htmlElement.classList.toggle('dark', isDark);
    
    // Update theme toggle button icon - always show sun icon
    const themeToggle = document.getElementById('themeToggle');
    const icon = themeToggle?.querySelector('.material-icons');
    if (icon) {
        icon.textContent = 'wb_sunny';
    }
    
    // Update logo for theme - always use light logo (header is always dark)
    const logo = document.getElementById('cmrpLogo');
    if (logo) {
        logo.src = 'Logo/CMRP Logo Light.svg';
    }
    
    // Force refresh of table styling if table exists
    const table = document.getElementById('opportunitiesTable');
    if (table) {
        // Trigger a repaint to ensure CSS variables are applied
        table.style.display = 'none';
        table.offsetHeight; // Force reflow
        table.style.display = 'table';
    }
    
    // Theme applied
}

function toggleTheme() {
    const currentTheme = htmlElement.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
}

// --- Auth Modal Logic ---
function showAuthModal() {
    authModalOverlay.style.display = 'block';
    authModal.style.display = 'block';
}

function hideAuthModal() {
    try {
        if (authModalOverlay) authModalOverlay.style.display = 'none';
        if (authModal) authModal.style.display = 'none';
        if (authError) authError.style.display = 'none';
        if (authSuccess) authSuccess.style.display = 'none';
        if (authForm) authForm.reset();
    } catch (error) {
        // Error hiding auth modal
    }
}

function setAuthMode(login) {
    isLoginMode = login;
    document.getElementById('authModalTitle').textContent = login ? 'Login' : 'Register';
    authSubmitBtn.textContent = login ? 'Login' : 'Register';
    document.getElementById('registerFields').style.display = login ? 'none' : 'block';
    switchAuthMode.textContent = login ? "Don't have an account? Register" : "Already have an account? Login";
    authError.style.display = 'none';
    authSuccess.style.display = 'none';
    authForm.reset();
}

function hideRemarksModal() {
    const overlay = document.getElementById('remarksModalOverlay');
    const modal = document.getElementById('remarksModal');
    
    if (overlay) {
        overlay.classList.add('hidden');
        // Remove any event listeners that might be attached
        overlay.replaceWith(overlay.cloneNode(true));
    }
    if (modal) {
        modal.classList.add('hidden');
    }
}

function hideRevisionHistoryModal() {
    const overlay = document.getElementById('revisionHistoryModalOverlay');
    const modal = document.getElementById('revisionHistoryModal');
    if (overlay) overlay.classList.add('hidden');
    if (modal) modal.classList.add('hidden');
    
    // Restore body scroll
    document.body.style.overflow = '';
}

function hideEditRowModal() {
    const overlay = document.getElementById('editRowModalOverlay');
    const modal = document.getElementById('editRowModal');
    if (overlay) overlay.classList.add('hidden');
    if (modal) modal.classList.add('hidden');
    
    // Restore body scroll
    document.body.style.overflow = '';
}

function createEditFieldContainer(field, rowData, headers) {
    const headerExists = headers.includes(field);
    const normalizedField = normalizeField(field);
    const normalizedHeaderExists = headers.some(h => normalizeField(h) === normalizedField);
    
    // Checking field
    
    // Special debug for ACRUD fields
    if (['a', 'c', 'r', 'u', 'd'].includes(field.toLowerCase())) {
        // ACRUD field detected
    }
    
    // Always create field inputs for all editable fields to match create modal behavior
    const actualHeader = headers.find(h => normalizeField(h) === normalizedField) || field;
    const value = rowData[actualHeader] || '';
    
    // Creating form field
    
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'enhanced-field';
    
    const label = document.createElement('label');
    
    // Special handling for ACRUD fields to show full meaning
    let labelText = actualHeader.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (field === 'a') {
        labelText = 'A - Account Review';
    } else if (field === 'c') {
        labelText = 'C - Complexity';
    } else if (field === 'r') {
        labelText = 'R - Requirement';
    } else if (field === 'u') {
        labelText = 'U - Urgency';
    } else if (field === 'd') {
        labelText = 'D - Data Availability';
    }
    
    label.textContent = labelText;
    label.setAttribute('for', field);
    
    let input;
    // Use dropdown if getFieldOptions returns options
    const options = getFieldOptions(field);
    // Field options retrieved
    if (options && options.length > 0) {
        input = document.createElement('select');
        input.className = 'inline-edit-dropdown'; // Apply custom styling
        // Clear any existing options first
        input.innerHTML = '';
        options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option;
            optionEl.textContent = option;
            if (option === value) {
                optionEl.selected = true;
            }
            input.appendChild(optionEl);
        });
    } else if (field === 'remarks_comments') {
        input = document.createElement('textarea');
        input.rows = 4;
        input.placeholder = 'Add any additional comments or notes here...';
    } else if (field.includes('date') || field === 'client_deadline') {
        input = document.createElement('input');
        input.type = 'date';
        if (value) {
            // Format date properly for date inputs
            try {
                const dateObj = new Date(value);
                if (!isNaN(dateObj)) {
                    input.value = dateObj.toISOString().split('T')[0];
                }
            } catch (e) {
                // Date formatting error
            }
        }
    } else if (field === 'margin') {
        input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.min = '0';
        input.max = '100';
        // For margin field, strip % sign and convert to number
        if (value) {
            const numericValue = parseFloat(value.toString().replace('%', ''));
            if (!isNaN(numericValue)) {
                input.value = numericValue;
            }
        }
    } else if (field === 'final_amt') {
        input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '0';
        // For final_amount, format with commas for display
        if (value) {
            const numericValue = parseCurrency(value);
            if (!isNaN(numericValue)) {
                input.value = formatNumberWithCommas(numericValue);
            }
        }
        // Add real-time formatting
        input.addEventListener('input', formatFinalAmountInput);
    } else if (field === 'google_drive_folder') {
        // Special handling for Google Drive folder field
        return createGoogleDriveFolderField(rowData);
    } else {
        input = document.createElement('input');
        input.type = 'text';
    }
    
    input.id = field;
    input.name = field;
    if (input.type !== 'date' && field !== 'margin' && field !== 'final_amt') {
        input.value = value;
    }
        
    // Store original value for change detection
    if (!window.originalFormValues) window.originalFormValues = {};
    window.originalFormValues[field] = value;
    
    fieldContainer.appendChild(label);
    fieldContainer.appendChild(input);
    return fieldContainer;
}

function createGoogleDriveFolderField(rowData) {
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'enhanced-field google-drive-field';
    
    const label = document.createElement('label');
    label.textContent = 'Google Drive Folder';
    fieldContainer.appendChild(label);
    
    // Check if opportunity has an existing Drive folder
    const hasFolder = rowData.google_drive_folder_id && rowData.google_drive_folder_url;
    
    if (hasFolder) {
        // Show existing folder information
        const folderInfo = document.createElement('div');
        folderInfo.className = 'drive-folder-info';
        folderInfo.innerHTML = `
            <div class="drive-folder-existing">
                <span class="material-icons">folder</span>
                <a href="${rowData.google_drive_folder_url}" target="_blank" class="drive-folder-link">
                    ${rowData.google_drive_folder_name || 'Open Drive Folder'}
                </a>
                <button type="button" class="drive-folder-unlink-btn" data-uid="${rowData.uid}">
                    <span class="material-icons">link_off</span>
                    Unlink
                </button>
            </div>
        `;
        fieldContainer.appendChild(folderInfo);
        
        // Add unlink functionality
        const unlinkBtn = folderInfo.querySelector('.drive-folder-unlink-btn');
        unlinkBtn.addEventListener('click', () => unlinkDriveFolder(rowData.uid));
        
    } else {
        // Show controls to create or link folder
        const folderControls = document.createElement('div');
        folderControls.className = 'drive-folder-controls';
        folderControls.innerHTML = `
            <div class="drive-folder-actions">
                <button type="button" class="drive-folder-create-btn" data-uid="${rowData.uid}">
                    <span class="material-icons">create_new_folder</span>
                    Create Folder
                </button>
                <span class="drive-folder-or">or</span>
                <button type="button" class="drive-folder-search-btn" data-uid="${rowData.uid}">
                    <span class="material-icons">search</span>
                    Search & Link
                </button>
                <span class="drive-folder-or">or</span>
                <div class="drive-folder-link-section">
                    <input type="text" placeholder="Paste Google Drive folder ID or URL" class="drive-folder-id-input" />
                    <button type="button" class="drive-folder-link-btn" data-uid="${rowData.uid}">
                        <span class="material-icons">link</span>
                        Link Manually
                    </button>
                </div>
            </div>
        `;
        fieldContainer.appendChild(folderControls);
        
        // Add create folder functionality
        const createBtn = folderControls.querySelector('.drive-folder-create-btn');
        createBtn.addEventListener('click', () => createDriveFolder(rowData.uid));
        
        // Add search functionality
        const searchBtn = folderControls.querySelector('.drive-folder-search-btn');
        searchBtn.addEventListener('click', () => showDriveFolderSearchModal(rowData));
        
        // Add link existing folder functionality
        const linkBtn = folderControls.querySelector('.drive-folder-link-btn');
        const folderIdInput = folderControls.querySelector('.drive-folder-id-input');
        linkBtn.addEventListener('click', () => {
            let folderId = folderIdInput.value.trim();
            
            if (!folderId) {
                alert('Please enter a Google Drive folder ID or URL');
                return;
            }
            
            // Extract folder ID from URL if a full URL was pasted
            if (folderId.includes('drive.google.com/drive/folders/')) {
                const urlParts = folderId.split('/folders/');
                if (urlParts.length > 1) {
                    folderId = urlParts[1].split('?')[0]; // Remove query parameters
                }
            }
            
            // Validate folder ID format (Google Drive folder IDs are typically 25-50 characters)
            if (folderId.length < 10 || folderId.length > 100) {
                alert('Invalid folder ID format. Please check the ID and try again.');
                return;
            }
            
            // Linking folder
            linkExistingDriveFolder(rowData.uid, folderId);
        });
    }
    
    return fieldContainer;
}

// Google Drive folder API functions
async function createDriveFolder(opportunityUid) {
    try {
        const btn = document.querySelector(`[data-uid="${opportunityUid}"].drive-folder-create-btn`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons">hourglass_empty</span> Creating...';
        }
        
        const response = await fetch(getApiUrl(`/api/opportunities/${opportunityUid}/drive-folder`), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert('Drive folder created successfully!');
            // Refresh the form to show the new folder
            location.reload();
        } else {
            throw new Error(data.message || 'Failed to create Drive folder');
        }
    } catch (error) {
        // Error creating Drive folder
        let errorMessage = error.message;
        
        // Provide more helpful error messages
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
            errorMessage = 'Access denied. This could be:\n' +
                          '1. Authentication token expired (try refreshing the page)\n' +
                          '2. Google Drive API not enabled in Google Cloud Console\n' +
                          '3. Service account lacks proper permissions\n' +
                          '4. Root folder is not shared with the service account';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMessage = 'Authentication required. Please refresh the page and try again.';
        }
        
        alert(`Error creating Drive folder:\n\n${errorMessage}`);
    } finally {
        const btn = document.querySelector(`[data-uid="${opportunityUid}"].drive-folder-create-btn`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons">create_new_folder</span> Create Folder';
        }
    }
}

async function linkExistingDriveFolder(opportunityUid, folderId, skipReload = false) {
    try {
        // Linking folder to opportunity
        
        const btn = document.querySelector(`[data-uid="${opportunityUid}"].drive-folder-link-btn`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons">hourglass_empty</span> Linking...';
        }
        
        const requestBody = { folderId };
        // Sending request
        
        const response = await fetch(getApiUrl(`/api/opportunities/${opportunityUid}/drive-folder`), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        // Response received
        
        const data = await response.json();
        // Response data received
        
        if (response.ok && data.success) {
            if (!skipReload) {
                alert('Drive folder linked successfully!');
                // Refresh the form to show the linked folder
                location.reload();
            }
            // If skipReload is true, the calling function will handle the UI update
        } else {
            throw new Error(data.message || 'Failed to link Drive folder');
        }
    } catch (error) {
        // Error linking Drive folder
        let errorMessage = error.message;
        
        // Provide more helpful error messages
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
            errorMessage = 'Access denied. This could be:\n' +
                          '1. Authentication token expired (try refreshing the page)\n' +
                          '2. Google Drive API not enabled in Google Cloud Console\n' +
                          '3. Service account lacks proper permissions\n' +
                          '4. Folder is not shared with the service account';
        } else if (error.message.includes('404') || error.message.includes('not found')) {
            errorMessage = 'Folder not found. Please check:\n' +
                          '1. Folder ID is correct\n' +
                          '2. Folder exists and is accessible\n' +
                          '3. Service account has access to the folder';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMessage = 'Authentication required. Please refresh the page and try again.';
        }
        
        alert(`Error linking Drive folder:\n\n${errorMessage}`);
    } finally {
        const btn = document.querySelector(`[data-uid="${opportunityUid}"].drive-folder-link-btn`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons">link</span> Link Existing';
        }
    }
}

async function unlinkDriveFolder(opportunityUid) {
    if (!confirm('Are you sure you want to unlink this Drive folder? The folder will remain in Drive but will no longer be associated with this opportunity.')) {
        return;
    }
    
    try {
        const btn = document.querySelector(`[data-uid="${opportunityUid}"].drive-folder-unlink-btn`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons">hourglass_empty</span> Unlinking...';
        }
        
        const response = await fetch(getApiUrl(`/api/opportunities/${opportunityUid}/drive-folder`), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert('Drive folder unlinked successfully!');
            // Refresh the form to show the updated state
            location.reload();
        } else {
            throw new Error(data.message || 'Failed to unlink Drive folder');
        }
    } catch (error) {
        // Error unlinking Drive folder
        alert(`Error unlinking Drive folder: ${error.message}`);
    } finally {
        const btn = document.querySelector(`[data-uid="${opportunityUid}"].drive-folder-unlink-btn`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons">link_off</span> Unlink';
        }
    }
}

// Google Drive Search Modal Functions
function showDriveFolderSearchModal(rowData) {
    // Create modal overlay if it doesn't exist
    let searchModalOverlay = document.getElementById('driveFolderSearchModalOverlay');
    if (!searchModalOverlay) {
        searchModalOverlay = createDriveFolderSearchModal();
        document.body.appendChild(searchModalOverlay);
    }

    // Set up modal content
    const modalTitle = searchModalOverlay.querySelector('.search-modal-title');
    const searchInput = searchModalOverlay.querySelector('.drive-search-input');
    const searchBtn = searchModalOverlay.querySelector('.drive-search-btn');
    const resultsContainer = searchModalOverlay.querySelector('.search-results-container');
    
    modalTitle.textContent = `Search Google Drive Folders for ${rowData.project_code || rowData.project_name || 'Project'}`;
    
    // Auto-search based on opportunity data
    performSmartSearch(rowData, resultsContainer);
    
    // Set up search functionality
    searchBtn.onclick = () => {
        const query = searchInput.value.trim();
        if (query) {
            performManualSearch(query, resultsContainer);
        }
    };
    
    searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    };
    
    // Show modal
    searchModalOverlay.classList.remove('hidden');
}

function createDriveFolderSearchModal() {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'driveFolderSearchModalOverlay';
    modalOverlay.className = 'modal-overlay hidden';
    
    modalOverlay.innerHTML = `
        <div class="modal" style="max-width: 800px;">
            <div class="modal-header">
                <h2 class="search-modal-title">Search Google Drive Folders</h2>
                <button type="button" class="modal-close-x">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="drive-search-section">
                    <div class="drive-search-input-container">
                        <input type="text" placeholder="Search for folders by name..." class="drive-search-input" />
                        <button type="button" class="drive-search-btn">
                            <span class="material-icons">search</span>
                            Search
                        </button>
                    </div>
                    <div class="search-help">
                        Search will automatically include project code, project name, and client name.<br>
                        <small>For OP100 opportunities, will also search in OP100 completed projects folder.</small>
                    </div>
                </div>
                <div class="search-results-container">
                    <div class="search-loading">
                        <span class="material-icons">autorenew</span>
                        Searching for relevant folders...
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="modal-close-btn">Cancel</button>
            </div>
        </div>
    `;
    
    // Add event listeners
    const closeBtn = modalOverlay.querySelector('.modal-close-x');
    const cancelBtn = modalOverlay.querySelector('.modal-close-btn');
    
    closeBtn.onclick = () => modalOverlay.classList.add('hidden');
    cancelBtn.onclick = () => modalOverlay.classList.add('hidden');
    
    // Close on overlay click
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.add('hidden');
        }
    };
    
    return modalOverlay;
}

async function performSmartSearch(rowData, resultsContainer) {
    try {
        resultsContainer.innerHTML = '<div class="search-loading"><span class="material-icons rotating">autorenew</span> Searching for relevant folders...</div>';
        
        const response = await fetch(getApiUrl(`/api/opportunities/${rowData.uid}/drive-folder/search`), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Search failed');
        }
        
        displaySearchResults(data.folders, resultsContainer, rowData.uid);
        
    } catch (error) {
        console.error('Smart search failed:', error);
        resultsContainer.innerHTML = `
            <div class="search-error">
                <span class="material-icons">error</span>
                Smart search failed: ${error.message}
                <br><small>Try searching manually above.</small>
            </div>
        `;
    }
}

async function performManualSearch(query, resultsContainer) {
    try {
        resultsContainer.innerHTML = '<div class="search-loading"><span class="material-icons rotating">autorenew</span> Searching...</div>';
        
        const response = await fetch(getApiUrl(`/api/drive/search?query=${encodeURIComponent(query)}&maxResults=10`), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Search failed');
        }
        
        displaySearchResults(data.folders, resultsContainer);
        
    } catch (error) {
        console.error('Manual search failed:', error);
        resultsContainer.innerHTML = `
            <div class="search-error">
                <span class="material-icons">error</span>
                Search failed: ${error.message}
            </div>
        `;
    }
}

function displaySearchResults(folders, resultsContainer, opportunityUid = null) {
    if (!folders || folders.length === 0) {
        resultsContainer.innerHTML = `
            <div class="search-no-results">
                <span class="material-icons">folder_off</span>
                No folders found. Try a different search term or create a new folder.
            </div>
        `;
        return;
    }
    
    const resultsHtml = folders.map(folder => `
        <div class="search-result-item" data-folder-id="${folder.id}">
            <div class="result-icon">
                <span class="material-icons">${folder.isInOP100Folder ? 'folder_special' : 'folder'}</span>
            </div>
            <div class="result-details">
                <div class="result-name">${folder.name}</div>
                <div class="result-info">
                    ${folder.location ? `<span class="folder-location ${folder.isInOP100Folder ? 'op100-location' : 'drive-location'}">${folder.location}</span>` : ''}
                    ${folder.createdTime ? `<span class="result-created">Created: ${new Date(folder.createdTime).toLocaleDateString()}</span>` : ''}
                    ${folder.relevanceScore ? `<span class="relevance-score">Match: ${folder.relevanceScore}/5</span>` : ''}
                </div>
            </div>
            <div class="result-actions">
                <button type="button" class="link-folder-btn" 
                        data-folder-id="${folder.id}" 
                        data-folder-name="${folder.name}"
                        ${opportunityUid ? `data-opportunity-uid="${opportunityUid}"` : ''}>
                    <span class="material-icons">link</span>
                    Link This Folder
                </button>
                <a href="${folder.url}" target="_blank" class="view-folder-btn">
                    <span class="material-icons">open_in_new</span>
                    View
                </a>
            </div>
        </div>
    `).join('');
    
    resultsContainer.innerHTML = `
        <div class="search-results-header">
            <h3>Found ${folders.length} folder${folders.length === 1 ? '' : 's'}</h3>
        </div>
        <div class="search-results-list">
            ${resultsHtml}
        </div>
    `;
    
    // Add click handlers for link buttons
    resultsContainer.querySelectorAll('.link-folder-btn').forEach(btn => {
        btn.onclick = async () => {
            const folderId = btn.dataset.folderId;
            const folderName = btn.dataset.folderName;
            const uid = btn.dataset.opportunityUid || getCurrentOpportunityUid();
            
            if (uid && folderId) {
                await linkSelectedFolder(uid, folderId, folderName);
            }
        };
    });
    
    // Auto-scroll to results section so user sees the search worked
    setTimeout(() => {
        if (resultsContainer) {
            // Smooth scroll to the results container
            resultsContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });
            console.log('📜 Auto-scrolled to general search results');
        }
    }, 100); // Small delay to ensure DOM is fully rendered
}

async function linkSelectedFolder(opportunityUid, folderId, folderName) {
    try {
        // Update button state
        const btn = document.querySelector(`[data-folder-id="${folderId}"].link-folder-btn`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons rotating">hourglass_empty</span> Linking...';
        }
        
        // Call the existing link function with skipReload flag
        await linkExistingDriveFolder(opportunityUid, folderId, true);
        
        // Close the search modal
        const searchModal = document.getElementById('driveFolderSearchModalOverlay');
        if (searchModal) {
            searchModal.classList.add('hidden');
        }
        
        // Update the opportunity data and refresh only the Google Drive section
        if (currentEditRowIndex >= 0 && opportunities[currentEditRowIndex]) {
            try {
                // Fetch the updated folder information for just this opportunity
                const response = await fetch(getApiUrl(`/api/opportunities/${opportunityUid}/drive-folder`), {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
                
                if (response.ok) {
                    const folderData = await response.json();
                    
                    // Update the opportunity in the local array with new folder info
                    if (folderData.hasFolder) {
                        Object.assign(opportunities[currentEditRowIndex], {
                            google_drive_folder_id: folderData.folder.id,
                            google_drive_folder_url: folderData.folder.url,
                            google_drive_folder_name: folderData.folder.name,
                            drive_folder_created_at: folderData.folder.createdAt,
                            drive_folder_created_by: folderData.folder.createdBy
                        });
                    }
                    
                    // Re-render the table with updated data (preserves filters)
                    filterAndSortData();
                    
                    // Refresh only the Google Drive section in the edit modal
                    refreshGoogleDriveSection(opportunities[currentEditRowIndex]);
                    
                    // Show subtle success message
                    showSuccessNotification(`Successfully linked folder: ${folderName}`);
                    
                } else {
                    // Fallback: show message
                    showErrorNotification(`Successfully linked folder, but could not refresh the display. Please close and reopen the edit modal.`);
                }
                
            } catch (refreshError) {
                console.warn('Could not refresh folder data:', refreshError);
                // Still show success message even if refresh fails
                showErrorNotification(`Successfully linked folder, but could not refresh the display. Please close and reopen the edit modal.`);
            }
        } else {
            showSuccessNotification(`Successfully linked folder: ${folderName}`);
        }
        
    } catch (error) {
        console.error('Failed to link selected folder:', error);
        alert(`Failed to link folder: ${error.message}`);
        
        // Reset button state
        const btn = document.querySelector(`[data-folder-id="${folderId}"].link-folder-btn`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons">link</span> Link This Folder';
        }
    }
}

function getCurrentOpportunityUid() {
    // Extract opportunity UID from current edit modal context
    // This might need adjustment based on how you track the current opportunity
    const editModal = document.getElementById('editRowModal');
    if (editModal && currentEditRowIndex >= 0) {
        return opportunities[currentEditRowIndex]?.uid;
    }
    return null;
}

// Function to refresh only the Google Drive section in the edit modal
function refreshGoogleDriveSection(rowData) {
    try {
        // Find the Google Drive field container in the edit modal
        const editForm = document.getElementById('editRowForm');
        if (!editForm) return;
        
        // Find the existing Google Drive field by looking for the enhanced-field with google-drive-field class
        const existingDriveField = editForm.querySelector('.google-drive-field');
        if (!existingDriveField) return;
        
        // Create a new Google Drive field with updated data
        const newDriveField = createGoogleDriveFolderField(rowData);
        
        // Replace the existing field with the new one
        existingDriveField.parentNode.replaceChild(newDriveField, existingDriveField);
        
        console.log('✅ Google Drive section refreshed successfully');
        
    } catch (error) {
        console.error('❌ Failed to refresh Google Drive section:', error);
    }
}

// Subtle notification functions
function showSuccessNotification(message) {
    showNotification(message, 'success');
}

function showErrorNotification(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.drive-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `drive-notification drive-notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="material-icons">${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}</span>
            <span class="notification-message">${message}</span>
            <button type="button" class="notification-close" data-action="close-notification">
                <span class="material-icons">close</span>
            </button>
        </div>
    `;
    
    // Add to edit modal or create modal
    const editModal = document.getElementById('editRowModal');
    const createModal = document.getElementById('createOpportunityModal');
    
    let targetModal = null;
    
    // Determine which modal is open
    if (createModal && !createModal.classList.contains('hidden')) {
        targetModal = createModal;
    } else if (editModal && !editModal.classList.contains('hidden')) {
        targetModal = editModal;
    }
    
    if (targetModal) {
        const modalBody = targetModal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.insertBefore(notification, modalBody.firstChild);
        }
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function showEditRowModal(rowIndex, isDuplicate = false) {
    const overlay = document.getElementById('editRowModalOverlay');
    const modal = document.getElementById('editRowModal');
    const form = document.getElementById('editRowForm');
    
    if (!overlay || !modal || !form) {
        // Edit row modal not found
        return;
    }

    // Update dropdown options before showing the modal
    dropdownOptions = getDropdownOptions(headers, opportunities);

    // Set mode variables
    isCreateMode = isDuplicate;
    currentEditRowIndex = isDuplicate ? -1 : rowIndex;
    
    // Get the current row data
    const rowData = opportunities[rowIndex];
    if (!rowData) {
        // No data found for row
        return;
    }
    
    // Store original values for change detection
    window.originalFormValues = {};
    
    // Clear and populate the form
    form.innerHTML = '';
    
    // Creating edit form
    
    // Define field sections for organized layout
    const fieldSections = {
        'Basic Information': ['project_name', 'project_code', 'rev', 'client', 'solutions', 'sol_particulars', 'industries', 'ind_particulars'],
        'Assignment Information': ['account_mgr', 'pic', 'bom', 'status'],
        'Financial Information': ['margin', 'final_amt', 'opp_status', 'submitted_date'],
        'Important Dates': ['date_received', 'client_deadline', 'date_awarded_lost', 'forecast_date'],
        'Decision & Comments': ['decision', 'remarks_comments'],
        'Lost Analysis': ['lost_rca', 'l_particulars'],
        'ACRUD Fields': ['a', 'c', 'r', 'u', 'd', 'revision'],
        'Google Drive': ['google_drive_folder']
    };
    
    // Create sectioned form
    Object.entries(fieldSections).forEach(([sectionTitle, fields]) => {
        // Create section container
        const section = document.createElement('div');
        section.className = 'form-section';
        
        // Create section title
        const title = document.createElement('div');
        title.className = 'form-section-title';
        title.textContent = sectionTitle;
        section.appendChild(title);
        
        // Group fields into rows (2 per row)
        for (let i = 0; i < fields.length; i += 2) {
            const row = document.createElement('div');
            row.className = fields.length === 1 || i === fields.length - 1 ? 'form-row single-column' : 'form-row';
            
            // Add first field
            const field1 = fields[i];
            if (field1) {
                const fieldContainer = createEditFieldContainer(field1, rowData, headers);
                row.appendChild(fieldContainer);
            }
            
            // Add second field if exists
            const field2 = fields[i + 1];
            if (field2) {
                const fieldContainer = createEditFieldContainer(field2, rowData, headers);
                row.appendChild(fieldContainer);
            } else if (fields.length > 1) {
                // Add empty field for layout balance
                const emptyField = document.createElement('div');
                emptyField.className = 'enhanced-field';
                row.appendChild(emptyField);
            }
            
            section.appendChild(row);
        }
        
        form.appendChild(section);
    });
    
    // Update modal title
    const modalTitle = modal.querySelector('h2');
    if (modalTitle) {
        modalTitle.textContent = isDuplicate ? 'Duplicate Opportunity' : 'Edit Opportunity';
    }
    
    // Lock body scroll to prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    // Show the modal
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
}

async function showCreateOpportunityModal(duplicateFromIndex = null) {
    // Use global variables instead of creating local ones
    const overlay = createOpportunityModalOverlay;
    const modal = createOpportunityModal;
    const form = document.getElementById('createOpportunityForm');
    if (!overlay || !modal || !form) return;
    
    // Update dropdown options before showing the modal
    dropdownOptions = getDropdownOptions(headers, opportunities);
    
    // Populate dynamic dropdowns in create modal
    populateCreateModalDropdowns();
    
    // Clear form values for new opportunity
    form.reset();
    
    // If duplicating, populate form with existing data
    if (duplicateFromIndex !== null && opportunities[duplicateFromIndex]) {
        const sourceData = opportunities[duplicateFromIndex];
        
        // Update modal title
        const modalTitle = modal.querySelector('h2');
        if (modalTitle) {
            modalTitle.textContent = 'Duplicate Opportunity';
        }
        
        // Populate form fields with source data (excluding unique fields)
        const fieldsToSkip = ['uid', 'encoded_date', 'rev']; // Don't copy these fields
        
        Object.keys(sourceData).forEach(fieldName => {
            if (fieldsToSkip.includes(fieldName)) return;
            
            const fieldElement = form.querySelector(`[name="${fieldName}"]`);
            if (fieldElement && sourceData[fieldName]) {
                if (fieldElement.type === 'date') {
                    // Format date properly for date inputs
                    try {
                        const dateObj = new Date(sourceData[fieldName]);
                        if (!isNaN(dateObj)) {
                            fieldElement.value = dateObj.toISOString().split('T')[0];
                        }
                    } catch (e) {
                        // Date formatting error
                    }
                } else {
                    fieldElement.value = sourceData[fieldName];
                }
            }
        });
        
        // Set revision to 0 for new duplicate
        const revField = form.querySelector('[name="rev"]');
        if (revField) {
            revField.value = '0';
        }
        
        // Clear project_code to force user to set new one
        const projectCodeField = form.querySelector('[name="project_code"]');
        if (projectCodeField) {
            projectCodeField.value = '';
        }
    } else {
        // Update modal title for new opportunity
        const modalTitle = modal.querySelector('h2');
        if (modalTitle) {
            modalTitle.textContent = 'Create New Opportunity';
        }
    }
    
    // Set create mode variables
    isCreateMode = true;
    currentEditRowIndex = -1;
    
    // Set up tab functionality
    setupCreateModalTabs();
    
    // Lock body scroll to prevent background scrolling
    document.body.style.overflow = 'hidden';
    console.log('🔒 Body scroll locked for create opportunity modal');
    
    // Show the modal
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    // Ensure modal content can scroll
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
        modalBody.style.overflowY = 'auto';
        modalBody.style.maxHeight = 'calc(90vh - 160px)';
        console.log('📜 Modal body scroll enabled:', modalBody.style.overflowY);
    }
    
    // Auto-generate and pre-fill project code for new opportunities (after modal is shown)
    if (duplicateFromIndex === null) {
        console.log('🔢 Loading next project code for new opportunity...');
        try {
            await loadNextProjectCode();
        } catch (error) {
            console.error('❌ Error loading project code:', error);
        }
    } else {
        console.log('📋 Duplicating opportunity - skipping project code generation');
    }
}

// Helper function to set up Drive folder option handlers
function setupDriveFolderOptionHandlers() {
    const driveOptions = document.querySelectorAll('input[name="drive_folder_option"]');
    const existingFolderOptions = document.getElementById('existingFolderOptions');
    const importFromExistingOptions = document.getElementById('importFromExistingOptions');
    const searchBtn = document.getElementById('searchExistingFolders');
    const searchResults = document.getElementById('createModalSearchResults');
    
    driveOptions.forEach(radio => {
        radio.addEventListener('change', function() {
            // Hide all option sections first
            if (existingFolderOptions) {
                existingFolderOptions.style.display = 'none';
            }
            if (importFromExistingOptions) {
                importFromExistingOptions.style.display = 'none';
            }
            
            // Show the appropriate section based on selection
            if (this.value === 'link_existing') {
                existingFolderOptions.style.display = 'block';
            } else if (this.value === 'import_from_existing') {
                importFromExistingOptions.style.display = 'block';
            }
            
            // Hide search results when switching options
            if (searchResults) {
                searchResults.style.display = 'none';
                searchResults.innerHTML = '';
            }
            
            const importModalSearchResults = document.getElementById('importModalSearchResults');
            if (importModalSearchResults) {
                importModalSearchResults.style.display = 'none';
                importModalSearchResults.innerHTML = '';
            }
        });
    });
    
    // Set up search button functionality for linking existing
    if (searchBtn) {
        searchBtn.addEventListener('click', async function() {
            await performCreateModalFolderSearch();
        });
    }
    
    // Set up import functionality
    const importFromExistingFoldersBtn = document.getElementById('importFromExistingFolders');
    const importFromFolderBtn = document.getElementById('importFromFolderBtn');
    const importFolderIdInput = document.getElementById('importFolderId');
    
    if (importFromExistingFoldersBtn) {
        importFromExistingFoldersBtn.addEventListener('click', async function() {
            await performImportFolderSearch();
        });
    }
    
    if (importFromFolderBtn) {
        importFromFolderBtn.addEventListener('click', async function() {
            const folderId = importFolderIdInput?.value?.trim();
            if (folderId) {
                await importProjectDataFromFolder(folderId);
            } else {
                alert('Please enter a Google Drive folder ID or URL');
            }
        });
    }
}

// Helper function to perform folder search in create modal
async function performCreateModalFolderSearch() {
    const searchResults = document.getElementById('createModalSearchResults');
    const searchBtn = document.getElementById('searchExistingFolders');
    
    if (!searchResults || !searchBtn) return;
    
    try {
        // Disable search button and show loading
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Searching...';
        
        // Show search results container
        searchResults.style.display = 'block';
        searchResults.innerHTML = `
            <div class="search-loading p-4 text-center">
                <span class="material-icons rotating">autorenew</span>
                <div>Searching for folders...</div>
                <small>Based on project code and name</small>
            </div>
        `;
        
        // Get current form data to build search criteria
        const projectCode = document.getElementById('newProjectCode')?.value || '';
        const projectName = document.getElementById('newProjectName')?.value || '';
        const client = document.getElementById('newClient')?.value || '';
        const oppStatus = document.getElementById('newOppStatus')?.value || '';
        
        // Build search query from available data
        const searchTerms = [];
        if (projectCode) searchTerms.push(projectCode);
        if (projectName) {
            // Add first few words of project name
            const nameWords = projectName.split(' ').slice(0, 3).join(' ');
            searchTerms.push(nameWords);
        }
        if (client) searchTerms.push(client);
        
        if (searchTerms.length === 0) {
            searchResults.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <span class="material-icons">info</span>
                    <div>Please fill in Project Code or Project Name to search for folders</div>
                </div>
            `;
            return;
        }
        
        // Perform search
        const searchQuery = searchTerms.join(' ');
        let searchUrl = getApiUrl(`/api/drive/search?query=${encodeURIComponent(searchQuery)}&maxResults=10`);
        
        // If we detect OP100 status, use the smarter search that includes OP100 folder
        const isOP100 = oppStatus === 'OP100' || (oppStatus && oppStatus.toLowerCase().includes('op100'));
        if (isOP100) {
            // Use smart search if it's OP100 (though we need a temporary UID for the API)
            // For now, we'll just use regular search and trust that it will include OP100 results
        }
        
        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Search failed');
        }
        
        const data = await response.json();
        displayCreateModalSearchResults(data.folders || [], searchResults);
        
    } catch (error) {
        console.error('Create modal folder search failed:', error);
        searchResults.innerHTML = `
            <div class="search-error p-4 text-center text-red-600">
                <span class="material-icons">error</span>
                <div>Search failed: ${error.message}</div>
                <small>Try entering folder ID manually below</small>
            </div>
        `;
    } finally {
        // Re-enable search button
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<span class="material-icons">search</span> Search for Existing Folders';
    }
}

// Helper function to display search results in create modal
function displayCreateModalSearchResults(folders, resultsContainer) {
    if (!folders || folders.length === 0) {
        resultsContainer.innerHTML = `
            <div class="p-4 text-center text-gray-500">
                <span class="material-icons">folder_off</span>
                <div>No folders found matching your project details</div>
                <small>Try entering folder ID manually below</small>
            </div>
        `;
        return;
    }
    
    const resultsHtml = folders.map(folder => `
        <div class="search-result-item">
            <div class="result-icon">
                <span class="material-icons">${folder.isInOP100Folder ? 'folder_special' : 'folder'}</span>
            </div>
            <div class="result-details">
                <div class="result-name" title="${folder.name}">${folder.name}</div>
                <div class="result-info">
                    ${folder.location ? `<span class="folder-location ${folder.isInOP100Folder ? 'op100-location' : 'drive-location'}">${folder.location}</span>` : ''}
                    ${folder.createdTime ? `<span class="result-created">Created: ${new Date(folder.createdTime).toLocaleDateString()}</span>` : ''}
                    ${folder.relevanceScore ? `<span class="relevance-score">Match: ${folder.relevanceScore}/5</span>` : ''}
                </div>
            </div>
            <div class="result-actions">
                <button type="button" class="link-folder-btn create-modal-select-folder" 
                        data-folder-id="${folder.id}" 
                        data-folder-name="${folder.name}">
                    <span class="material-icons">check</span>
                    Select
                </button>
                <a href="${folder.url}" target="_blank" class="view-folder-btn">
                    <span class="material-icons">open_in_new</span>
                    View
                </a>
            </div>
        </div>
    `).join('');
    
    resultsContainer.innerHTML = `
        <div class="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
            <h4 class="font-medium text-sm">Found ${folders.length} folder${folders.length === 1 ? '' : 's'}</h4>
        </div>
        ${resultsHtml}
    `;
    
    // Add event listeners for folder selection buttons
    resultsContainer.querySelectorAll('.create-modal-select-folder').forEach(button => {
        button.addEventListener('click', function() {
            const folderId = this.dataset.folderId;
            const folderName = this.dataset.folderName;
            selectFolderInCreateModal(folderId, folderName);
        });
    });
    
    // Auto-scroll to results section so user sees the search worked
    setTimeout(() => {
        const modal = document.getElementById('createOpportunityModal');
        if (modal && resultsContainer) {
            // Scroll the modal body to show the results
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                // Smooth scroll to the results container
                resultsContainer.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
                console.log('📜 Auto-scrolled to create modal search results');
            }
        }
    }, 100); // Small delay to ensure DOM is fully rendered
}

// Helper function to select a folder from create modal search results
function selectFolderInCreateModal(folderId, folderName) {
    const existingFolderIdInput = document.getElementById('existingFolderId');
    const searchResults = document.getElementById('createModalSearchResults');
    
    if (existingFolderIdInput) {
        existingFolderIdInput.value = folderId;
        existingFolderIdInput.placeholder = `Selected: ${folderName}`;
        
        // Hide search results after selection
        if (searchResults) {
            searchResults.style.display = 'none';
        }
        
        // Show success feedback
        showSuccessNotification(`Selected folder: ${folderName}`);
    }
}

// Helper function to perform import folder search (similar to regular folder search)
async function performImportFolderSearch() {
    const searchResults = document.getElementById('importModalSearchResults');
    
    if (!searchResults) {
        console.error('Import modal search results container not found');
        return;
    }
    
    try {
        searchResults.style.display = 'block';
        searchResults.innerHTML = `
            <div class="p-4 text-center">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div class="text-sm text-gray-600">Searching for project folders...</div>
            </div>
        `;
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        // For import, we search all folders since we don't have specific opportunity data yet
        const response = await fetch(getApiUrl('/api/google-drive/folders/search?q='), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.folders) {
            displayImportModalSearchResults(data.folders, searchResults);
        } else {
            searchResults.innerHTML = `
                <div class="p-4 text-center text-red-600">
                    <span class="material-icons">error</span>
                    <div>Failed to search folders</div>
                    <small>${data.error || 'Unknown error'}</small>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Import folder search failed:', error);
        searchResults.innerHTML = `
            <div class="p-4 text-center text-red-600">
                <span class="material-icons">error</span>
                <div>Search failed</div>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// Helper function to display import modal search results
function displayImportModalSearchResults(folders, resultsContainer) {
    if (!folders || folders.length === 0) {
        resultsContainer.innerHTML = `
            <div class="p-4 text-center text-gray-500">
                <span class="material-icons">folder_off</span>
                <div>No folders found</div>
                <small>Try entering folder ID manually below</small>
            </div>
        `;
        return;
    }
    
    const resultsHtml = folders.map(folder => `
        <div class="search-result-item">
            <div class="result-icon">
                <span class="material-icons">${folder.isInOP100Folder ? 'folder_special' : 'folder'}</span>
            </div>
            <div class="result-details">
                <div class="result-name" title="${folder.name}">${folder.name}</div>
                <div class="result-info">
                    ${folder.location ? `<span class="folder-location ${folder.isInOP100Folder ? 'op100-location' : 'drive-location'}">${folder.location}</span>` : ''}
                    ${folder.createdTime ? `<span class="result-created">Created: ${new Date(folder.createdTime).toLocaleDateString()}</span>` : ''}
                </div>
            </div>
            <div class="result-actions">
                <button type="button" class="link-folder-btn import-modal-select-folder" 
                        data-folder-id="${folder.id}" 
                        data-folder-name="${folder.name}">
                    <span class="material-icons">file_download</span>
                    Import
                </button>
            </div>
        </div>
    `).join('');
    
    resultsContainer.innerHTML = resultsHtml;
    
    // Add event listeners to import buttons
    resultsContainer.querySelectorAll('.import-modal-select-folder').forEach(button => {
        button.addEventListener('click', async function() {
            const folderId = this.dataset.folderId;
            const folderName = this.dataset.folderName;
            await importProjectDataFromFolder(folderId, folderName);
        });
    });
    
    // Auto-scroll to results section so user sees the search worked
    setTimeout(() => {
        const modal = document.getElementById('googleDriveImportModal');
        const resultsSection = document.getElementById('importFolderSearchResults');
        if (modal && resultsSection) {
            // Show the results section first
            resultsSection.classList.remove('hidden');
            
            // Scroll the modal body to show the results
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                // Calculate the position of the results section relative to modal body
                const resultsTop = resultsSection.offsetTop;
                // Scroll the modal body to show the results
                modalBody.scrollTo({
                    top: resultsTop - 20, // Small offset from top
                    behavior: 'smooth'
                });
                console.log('📜 Auto-scrolled Google Drive import modal to search results');
            }
        }
    }, 150); // Slightly longer delay to ensure DOM updates
}


// Helper function to handle Drive folder creation/linking for new opportunities
async function handleDriveFolderForNewOpportunity(opportunityUid, driveFolderChoice = null) {
    try {
        // Use passed parameters if available, otherwise fall back to DOM reading
        let option, existingFolderId;
        
        if (driveFolderChoice) {
            option = driveFolderChoice.option;
            existingFolderId = driveFolderChoice.existingFolderId;
            console.log('📁 Using captured Drive folder choice:', driveFolderChoice);
        } else {
            // Fallback to DOM reading (for backwards compatibility)
            const selectedOption = document.querySelector('input[name="drive_folder_option"]:checked');
            option = selectedOption?.value;
            existingFolderId = document.getElementById('existingFolderId')?.value?.trim() || '';
            
            console.log('🔍 Drive folder option from DOM:', {
                selectedOption: selectedOption,
                value: option,
                existingFolderId: existingFolderId
            });
        }
        
        if (!option || option === 'none') {
            console.log('⚠️ No drive folder option selected or "none" selected');
            
            // Check if we have imported folder data that should be linked
            if (window.importedFolderData) {
                console.log('📁 Found imported folder data, linking to opportunity...');
                await linkImportedFolderToOpportunity(opportunityUid, window.importedFolderData);
                // Clear the imported data after using it
                delete window.importedFolderData;
            }
            return; // No option selected or "none" selected, skip
        }
        
        console.log(`📁 Processing drive folder option: ${option}`);
        
        switch (option) {
            case 'none':
                // User chose to skip folder creation
                console.log('User chose to skip Google Drive folder creation');
                break;
                
            case 'create_new':
                // User wants to create a new folder
                showLoadingModal('Creating Google Drive folder...');
                try {
                    const response = await fetch(getApiUrl(`/api/opportunities/${opportunityUid}/drive-folder`), {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('✅ Google Drive folder created successfully:', result.folder.name);
                        
                        // Update the opportunity in the local array with the new folder info
                        const oppIndex = opportunities.findIndex(opp => opp.uid === opportunityUid);
                        if (oppIndex !== -1) {
                            Object.assign(opportunities[oppIndex], {
                                google_drive_folder_id: result.folder.id,
                                google_drive_folder_url: result.folder.url,
                                google_drive_folder_name: result.folder.name
                            });
                        }
                        
                        showSuccessNotification(`Google Drive folder created: ${result.folder.name}`);
                    } else {
                        const error = await response.json();
                        console.error('❌ Failed to create Google Drive folder:', error.message);
                        showErrorNotification(`Failed to create Google Drive folder: ${error.message}`);
                    }
                } finally {
                    hideLoadingModal();
                }
                break;
                
            case 'link_existing':
                // User wants to link an existing folder
                console.log('🔗 Link existing folder attempt:', {
                    rawInput: existingFolderId,
                    source: driveFolderChoice ? 'captured' : 'DOM'
                });
                
                if (!existingFolderId) {
                    console.log('❌ No folder ID provided');
                    showErrorNotification('Please provide a Google Drive folder ID or URL');
                    return;
                }
                
                // Extract folder ID from URL if needed
                let folderId = existingFolderId;
                if (folderId.includes('drive.google.com/drive/folders/')) {
                    const urlParts = folderId.split('/folders/');
                    if (urlParts.length > 1) {
                        folderId = urlParts[1].split('?')[0];
                    }
                }
                
                console.log('🔗 Processed folder ID:', folderId);
                showLoadingModal('Linking Google Drive folder...');
                try {
                    const response = await fetch(getApiUrl(`/api/opportunities/${opportunityUid}/drive-folder`), {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ folderId: folderId })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('✅ Google Drive folder linked successfully:', result.folder.name);
                        
                        // Update the opportunity in the local array with the folder info
                        const oppIndex = opportunities.findIndex(opp => opp.uid === opportunityUid);
                        if (oppIndex !== -1) {
                            Object.assign(opportunities[oppIndex], {
                                google_drive_folder_id: result.folder.id,
                                google_drive_folder_url: result.folder.url,
                                google_drive_folder_name: result.folder.name
                            });
                        }
                        
                        showSuccessNotification(`Google Drive folder linked: ${result.folder.name}`);
                    } else {
                        const error = await response.json();
                        console.error('❌ Failed to link Google Drive folder:', error.message);
                        showErrorNotification(`Failed to link Google Drive folder: ${error.message}`);
                    }
                } finally {
                    hideLoadingModal();
                }
                break;
        }
    } catch (error) {
        console.error('❌ Error handling Drive folder for new opportunity:', error);
        showErrorNotification(`Error with Google Drive folder: ${error.message}`);
        hideLoadingModal();
    }
}

// Helper function to link imported folder data to the newly created opportunity
async function linkImportedFolderToOpportunity(opportunityUid, folderData) {
    try {
        console.log(`📁 Linking imported folder to opportunity ${opportunityUid}:`, folderData);
        
        const response = await fetch(getApiUrl(`/api/opportunities/${opportunityUid}/drive-folder`), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                folderId: folderData.id
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Imported Google Drive folder linked successfully:', result.folder?.name || folderData.name);
            showSuccessNotification(`Google Drive folder "${folderData.name}" linked to opportunity`);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to link imported folder');
        }
        
    } catch (error) {
        console.error('❌ Failed to link imported folder:', error);
        showErrorNotification(`Failed to link imported folder: ${error.message}`);
    }
}

// Helper function to populate dynamic dropdowns in create modal
function populateCreateModalDropdowns() {
    const dynamicFields = [
        { field: 'account_mgr', id: 'newAccountMgr' },
        { field: 'pic', id: 'newPIC' },
        { field: 'bom', id: 'newBOM' }
    ];
    
    dynamicFields.forEach(({ field, id }) => {
        const selectElement = document.getElementById(id);
        if (selectElement) {
            // Clear existing options except the first one (-- Select --)
            while (selectElement.children.length > 1) {
                selectElement.removeChild(selectElement.lastChild);
            }
            
            // Get options for this field
            const options = getFieldOptions(field);
            
            // Add options (skip the first empty option since we already have "-- Select --")
            for (let i = 1; i < options.length; i++) {
                const option = document.createElement('option');
                option.value = options[i];
                option.textContent = options[i];
                selectElement.appendChild(option);
            }
        }
    });
}

// Helper function to get field options for dropdowns
function getFieldOptions(field) {
    switch (field) {
        case 'decision':
            return ['', 'GO', 'DECLINE', 'Pending'];
        case 'status':
            return ['', 'On-Going', 'For Revision', 'For Approval', 'Submitted', 'No Decision Yet', 'Not Yet Started'];
        case 'opp_status':
            return ['', 'OP100', 'LOST', 'OP90', 'OP60', 'OP30', 'Inactive'];
        case 'a':
            return ['', '10-Existing', '10-Strategic', '8-With Account Champion', '5-New Account, No champion', '2-Existing Account with No Orders'];
        case 'c':
            return ['', '10-Existing Solution', '8-Need to Customize', '5-Needs External Resource', '3-No Previous Experience'];
        case 'r':
            return ['', '10-Core Business', '10-Focus Business', '8-Strategic Business', '7-Core + Peripheral', '5-Peripheral Scope', '2-NonCore / For Subcon'];
        case 'u':
            return ['', '10-Reasonable timeline', '7-Urgent', '2-Budgetary'];
        case 'd':
            return ['', '10-Complete', '5-Limited', '2-No Data'];
        case 'solutions':
            return ['', 'Digitalization', 'Automation', 'Electrification'];
        case 'sol_particulars':
            return ['', 'ELECTRICAL', 'FDAS', 'CCTV', 'ACS', 'SOLAR', 'EE & AUX', 'PABGM', 'SCS', 'PLC / SCADA', 'BMS', 'IT', 'INSTRUMENTATION', 'MECHANICAL', 'CIVIL', 'AUXILIARY', 'MEPFS', 'OTHERS'];
        case 'industries':
            return ['', 'Power', 'Manufacturing', 'Buildings'];
        case 'ind_particulars':
            return ['', 'F&B', 'PHARMA', 'CEMENT', 'COLD STORAGE', 'CONSTRUCTION', 'UTILITIES', 'SEMICON', 'POWER PLANT', 'OIL & GAS', 'MANUFACTURING', 'OTHERS'];
        case 'account_mgr':
            // Get values from dropdownOptions if available, otherwise return empty array with blank option
            return dropdownOptions.accountmgr ? ['', ...dropdownOptions.accountmgr] : [''];
        case 'pic':
            // Get values from dropdownOptions if available, otherwise return empty array with blank option
            return dropdownOptions.pic ? ['', ...dropdownOptions.pic] : [''];
        case 'bom':
            // Get values from dropdownOptions if available, otherwise return empty array with blank option
            return dropdownOptions.bom ? ['', ...dropdownOptions.bom] : [''];
        default:
            return [];
    }
}

// Import Results Modal Functions
function showImportResultsModal() {
    const overlay = document.getElementById('importResultsModalOverlay');
    const modal = document.getElementById('importResultsModal');
    if (!overlay || !modal) return;
    
    // Reset to loading state
    resetImportResultsModal();
    
    // Show the modal
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    console.log('📋 Import results modal opened');
}

function hideImportResultsModal() {
    const overlay = document.getElementById('importResultsModalOverlay');
    const modal = document.getElementById('importResultsModal');
    if (!overlay || !modal) return;
    
    overlay.classList.add('hidden');
    modal.classList.add('hidden');
    
    console.log('📋 Import results modal closed');
}

function resetImportResultsModal() {
    // Reset title
    const title = document.getElementById('importResultsTitle');
    if (title) title.textContent = 'Link Google Drive Folder';
    
    // Show search state, hide others
    const searchState = document.getElementById('importSearchState');
    const loadingState = document.getElementById('importLoadingState');
    const resultsState = document.getElementById('importResultsState');
    const noResultsState = document.getElementById('importNoResultsState');
    
    if (searchState) searchState.classList.remove('hidden');
    if (loadingState) loadingState.classList.add('hidden');
    if (resultsState) resultsState.classList.add('hidden');
    if (noResultsState) noResultsState.classList.add('hidden');
    
    // Clear search input
    const searchInput = document.getElementById('quickImportSearchInput');
    if (searchInput) searchInput.value = '';
    
    // Reset search button
    const searchButton = document.getElementById('quickImportSearchButton');
    if (searchButton) {
        searchButton.innerHTML = '<span class="material-icons">search</span> Search';
        searchButton.disabled = false;
    }
}

function showImportResultsLoading(message = 'Searching for project folders...') {
    const title = document.getElementById('importResultsTitle');
    const loadingText = document.getElementById('importLoadingText');
    const searchState = document.getElementById('importSearchState');
    const loadingState = document.getElementById('importLoadingState');
    const resultsState = document.getElementById('importResultsState');
    const noResultsState = document.getElementById('importNoResultsState');
    
    if (title) title.textContent = 'Searching Google Drive...';
    if (loadingText) loadingText.textContent = message;
    if (searchState) searchState.classList.add('hidden');
    if (loadingState) loadingState.classList.remove('hidden');
    if (resultsState) resultsState.classList.add('hidden');
    if (noResultsState) noResultsState.classList.add('hidden');
}

function showImportResultsData(folders) {
    const title = document.getElementById('importResultsTitle');
    const searchState = document.getElementById('importSearchState');
    const loadingState = document.getElementById('importLoadingState');
    const resultsState = document.getElementById('importResultsState');
    const noResultsState = document.getElementById('importNoResultsState');
    const resultsList = document.getElementById('importResultsList');
    const resultsCount = document.getElementById('importResultsCount');
    
    if (folders && folders.length > 0) {
        // Show results
        if (title) title.textContent = 'Select Folder to Import';
        if (searchState) searchState.classList.add('hidden');
        if (loadingState) loadingState.classList.add('hidden');
        if (resultsState) resultsState.classList.remove('hidden');
        if (noResultsState) noResultsState.classList.add('hidden');
        
        // Update count
        if (resultsCount) {
            resultsCount.textContent = `${folders.length} folder${folders.length === 1 ? '' : 's'} found`;
        }
        
        // Populate results
        if (resultsList) {
            displayImportResultsModalData(folders, resultsList);
        }
    } else {
        // Show no results
        if (title) title.textContent = 'No Folders Found';
        if (searchState) searchState.classList.add('hidden');
        if (loadingState) loadingState.classList.add('hidden');
        if (resultsState) resultsState.classList.add('hidden');
        if (noResultsState) noResultsState.classList.remove('hidden');
    }
}

function displayImportResultsModalData(folders, container) {
    container.innerHTML = folders.map(folder => `
        <div class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <div class="flex items-start gap-3">
                <div class="text-blue-600 dark:text-blue-400 mt-1">
                    <span class="material-icons">${folder.isInOP100Folder ? 'folder_special' : 'folder'}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 dark:text-gray-100 truncate">
                        ${folder.name}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        ${folder.location ? `<span class="folder-location ${folder.isInOP100Folder ? 'op100-location' : 'drive-location'}">${folder.location}</span>` : ''}
                        ${folder.createdTime ? `<span class="ml-2">Created: ${new Date(folder.createdTime).toLocaleDateString()}</span>` : ''}
                    </div>
                </div>
                <div class="flex gap-2">
                    <button data-action="import-project" data-folder-id="${folder.id}" data-folder-name="${folder.name.replace(/'/g, '&apos;')}" 
                            class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-1">
                        <span class="material-icons text-sm">file_download</span>
                        Import
                    </button>
                    <a href="${folder.url}" target="_blank" 
                       class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded text-sm no-underline flex items-center gap-1">
                        <span class="material-icons text-sm">open_in_new</span>
                        View
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

// User-initiated import search function
async function performUserImportSearch() {
    const searchInput = document.getElementById('quickImportSearchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    if (!query) {
        alert('Please enter a search term');
        searchInput.focus();
        return;
    }
    
    console.log(`🔍 Performing user import search for: "${query}"`);
    
    // Update search button state
    const searchButton = document.getElementById('quickImportSearchButton');
    if (searchButton) {
        searchButton.innerHTML = '<span class="material-icons animate-spin">refresh</span> Searching...';
        searchButton.disabled = true;
    }
    
    try {
        // Show loading state
        showImportResultsLoading(`Searching for "${query}"...`);
        
        // Search for folders using user's query
        const folders = await searchGoogleDriveFolders(query);
        
        // Display results
        showImportResultsData(folders);
        
        console.log(`✅ Found ${folders.length} folders for query: "${query}"`);
    } catch (error) {
        console.error('❌ User import search failed:', error);
        
        // Show no results state with error message
        const title = document.getElementById('importResultsTitle');
        const searchState = document.getElementById('importSearchState');
        const loadingState = document.getElementById('importLoadingState');
        const resultsState = document.getElementById('importResultsState');
        const noResultsState = document.getElementById('importNoResultsState');
        
        if (title) title.textContent = 'Search Failed';
        if (searchState) searchState.classList.add('hidden');
        if (loadingState) loadingState.classList.add('hidden');
        if (resultsState) resultsState.classList.add('hidden');
        if (noResultsState) noResultsState.classList.remove('hidden');
        
        // Update no results message
        const noResultsElement = document.querySelector('#importNoResultsState h3');
        const noResultsDesc = document.querySelector('#importNoResultsState p');
        if (noResultsElement) noResultsElement.textContent = 'Search Failed';
        if (noResultsDesc) noResultsDesc.textContent = `Unable to search for "${query}". Please try again or check your connection.`;
    } finally {
        // Reset search button
        if (searchButton) {
            searchButton.innerHTML = '<span class="material-icons">search</span> Search';
            searchButton.disabled = false;
        }
    }
}

// Quick import search function (legacy - can be removed later)
async function performQuickImportSearch() {
    console.log('🔍 Performing quick import search...');
    
    try {
        // Show loading message
        showImportResultsLoading('Searching for recent project folders...');
        
        // Search for folders using common project terms
        const searchQuery = 'CMRP OR project OR proposal';
        const folders = await searchGoogleDriveFolders(searchQuery);
        
        // Display results
        showImportResultsData(folders);
        
        console.log(`✅ Found ${folders.length} folders for quick import`);
    } catch (error) {
        console.error('❌ Quick import search failed:', error);
        
        // Show no results state with error message
        const title = document.getElementById('importResultsTitle');
        const loadingState = document.getElementById('importLoadingState');
        const resultsState = document.getElementById('importResultsState');
        const noResultsState = document.getElementById('importNoResultsState');
        
        if (title) title.textContent = 'Search Failed';
        if (loadingState) loadingState.classList.add('hidden');
        if (resultsState) resultsState.classList.add('hidden');
        if (noResultsState) noResultsState.classList.remove('hidden');
        
        // Update no results message
        const noResultsElement = document.querySelector('#importNoResultsState h3');
        const noResultsDesc = document.querySelector('#importNoResultsState p');
        if (noResultsElement) noResultsElement.textContent = 'Search Failed';
        if (noResultsDesc) noResultsDesc.textContent = 'Unable to search Google Drive. Please try again or check your connection.';
    }
}

// Google Drive Import Modal Functions
function showGoogleDriveImportModal() {
    const overlay = document.getElementById('googleDriveImportModalOverlay');
    const modal = document.getElementById('googleDriveImportModal');
    if (!overlay || !modal) return;
    
    // Reset modal state
    resetGoogleDriveImportModal();
    
    // Lock body scroll to prevent background scrolling
    document.body.style.overflow = 'hidden';
    console.log('🔒 Body scroll locked for Google Drive import modal');
    
    // Show the modal
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    // Ensure modal content can scroll
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) {
        modalBody.style.overflowY = 'auto';
        modalBody.style.maxHeight = 'calc(90vh - 160px)';
        console.log('📜 Import modal body scroll enabled');
    }
}

function hideGoogleDriveImportModal() {
    const overlay = document.getElementById('googleDriveImportModalOverlay');
    const modal = document.getElementById('googleDriveImportModal');
    if (!overlay || !modal) return;
    
    overlay.classList.add('hidden');
    modal.classList.add('hidden');
    
    // Restore body scroll
    document.body.style.overflow = '';
    console.log('🔓 Body scroll restored after closing import modal');
    
    // Reset modal state
    resetGoogleDriveImportModal();
}

function resetGoogleDriveImportModal() {
    // Reset search input
    const searchInput = document.getElementById('importFolderSearchInput');
    if (searchInput) searchInput.value = '';
    
    const manualInput = document.getElementById('importManualFolderIdInput');
    if (manualInput) manualInput.value = '';
    
    // Hide sections
    const sections = ['importFolderSearchResults', 'importProgressSection', 'importPreviewSection'];
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) section.classList.add('hidden');
    });
    
    // Show empty state
    const emptyState = document.getElementById('importEmptyState');
    if (emptyState) emptyState.classList.remove('hidden');
    
    // Hide confirm button
    const confirmButton = document.getElementById('confirmImportButton');
    if (confirmButton) confirmButton.classList.add('hidden');
    
    console.log('🧹 Google Drive import modal reset');
}

// Google Drive folder search function (used by both modals)
async function searchGoogleDriveFolders(searchQuery) {
    console.log(`🔍 Searching Google Drive folders with query: "${searchQuery}"`);
    
    const token = localStorage.getItem('authToken');
    if (!token) {
        throw new Error('No authentication token found');
    }
    
    // Use existing Google Drive search endpoint
    const response = await fetch(getApiUrl(`/api/google-drive/folders/search?q=${encodeURIComponent(searchQuery)}`), {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.error || 'Search failed');
    }
    
    console.log(`✅ Found ${data.folders?.length || 0} folders`);
    return data.folders || [];
}

// Enhanced Google Drive Import Modal Search Functions with Preloaded Data
async function performImportModalFolderSearch() {
    const searchInput = document.getElementById('importFolderSearchInput');
    const searchResults = document.getElementById('importFolderSearchResults');
    const searchResultsList = document.getElementById('importFolderSearchResultsList');
    const searchResultsCount = document.getElementById('importSearchResultsCount');
    const emptyState = document.getElementById('importEmptyState');
    const searchBtn = document.getElementById('importSearchFoldersButton');
    
    if (!searchInput || !searchResults || !searchResultsList || !searchBtn) return;
    
    const query = searchInput.value.trim();
    if (!query) {
        alert('Please enter a search term');
        return;
    }
    
    // Show loading state
    searchBtn.innerHTML = '<span class="material-icons animate-spin">refresh</span> Searching...';
    searchBtn.disabled = true;
    
    try {
        console.log('🔍 Enhanced search starting with query:', query);
        
        let allFolders = [];
        let liveResults = [];
        
        // Perform live search for current results
        console.log('🔍 Performing live Google Drive search...');
        try {
            liveResults = await searchGoogleDriveFolders(query);
            
            // Convert live results and merge with cache results
            const liveFormatted = liveResults.map(folder => ({
                ...folder,
                source: 'live',
                relevanceScore: calculateRelevanceScore(folder, query)
            }));
            
            // Merge and deduplicate based on folder ID
            const combinedResults = [...allFolders];
            liveFormatted.forEach(liveFolder => {
                if (!combinedResults.some(existing => existing.id === liveFolder.id)) {
                    combinedResults.push(liveFolder);
                } else {
                    // Update existing with live data (more current)
                    const index = combinedResults.findIndex(existing => existing.id === liveFolder.id);
                    combinedResults[index] = { ...combinedResults[index], ...liveFolder, source: 'both' };
                }
            });
            
            allFolders = combinedResults;
            console.log(`🔍 Live search added ${liveResults.length} results, total unique: ${allFolders.length}`);
            
        } catch (liveError) {
            console.warn('⚠️ Live search failed, using cached results only:', liveError.message);
            if (allFolders.length === 0) {
                throw liveError; // Re-throw if we have no cached results
            }
        }
        
        // Sort by relevance score (highest first)
        allFolders.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        
        if (allFolders.length > 0) {
            // Hide empty state, show results
            if (emptyState) emptyState.classList.add('hidden');
            searchResults.classList.remove('hidden');
            
            // Update count with source information
            if (searchResultsCount) {
                const cacheCount = allFolders.filter(f => f.source === 'cache' || f.source === 'both').length;
                const liveCount = allFolders.filter(f => f.source === 'live' || f.source === 'both').length;
                searchResultsCount.innerHTML = `
                    ${allFolders.length} folder${allFolders.length !== 1 ? 's' : ''} found
                    ${cacheCount > 0 ? `<span class="text-green-600 text-xs ml-2">⚡ ${cacheCount} instant</span>` : ''}
                    ${liveCount > 0 ? `<span class="text-blue-600 text-xs ml-2">🔍 ${liveCount} live</span>` : ''}
                `;
            }
            
            // Display enhanced results
            displayEnhancedImportModalSearchResults(allFolders, searchResultsList);
            
        } else {
            // Show no results
            if (searchResultsCount) searchResultsCount.textContent = 'No folders found';
            searchResults.classList.remove('hidden');
            searchResultsList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <span class="material-icons text-4xl mb-2">folder_off</span>
                    <p>No folders found matching "${query}"</p>
                    <p class="text-sm">Try a different search term or check your Google Drive access</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('❌ Enhanced search error:', error);
        alert('Failed to search folders: ' + error.message);
    } finally {
        // Restore button
        searchBtn.innerHTML = '<span class="material-icons">search</span> Search';
        searchBtn.disabled = false;
    }
}

// Calculate relevance score for search results
function calculateRelevanceScore(item, query) {
    let score = 0;
    const queryLower = query.toLowerCase();
    const nameLower = (item.name || '').toLowerCase();
    const projectCode = item.projectCode || '';
    
    // Exact project code match gets highest score
    if (projectCode && projectCode.toLowerCase() === queryLower) {
        score += 100;
    }
    
    // Project code partial match
    if (projectCode && projectCode.toLowerCase().includes(queryLower)) {
        score += 50;
    }
    
    // Name starts with query
    if (nameLower.startsWith(queryLower)) {
        score += 30;
    }
    
    // Name contains query
    if (nameLower.includes(queryLower)) {
        score += 20;
    }
    
    // Bonus for OP100 folder items
    if (item.isInOP100Folder || item.location === 'OP100 Folder') {
        score += 10;
    }
    
    // Bonus for cache results (instant)
    if (item.source === 'cache') {
        score += 5;
    }
    
    return score;
}

// Enhanced display function for import modal results
function displayEnhancedImportModalSearchResults(folders, container) {
    if (!container) return;
    
    // Detect if we're in dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');
    const nameColor = isDarkMode ? '#ffffff' : '#202124';
    const infoColor = isDarkMode ? '#c0c0c0' : '#5f6368';
    
    container.innerHTML = folders.map(folder => {
        const sourceIcon = folder.source === 'cache' ? '⚡' : 
                          folder.source === 'live' ? '🔍' : 
                          folder.source === 'both' ? '⚡🔍' : '📁';
        
        const locationBadge = folder.location === 'OP100 Folder' ? 
            '<span class="op100-location">OP100</span>' : 
            '<span class="drive-location">Drive</span>';
        
        const relevanceScore = folder.relevanceScore || 0;
        const scoreDisplay = relevanceScore > 0 ? 
            `<span class="relevance-score">${relevanceScore}% match</span>` : '';
        
        return `
            <div class="search-result-item border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div class="flex items-start gap-3">
                    <div class="result-icon text-blue-600 dark:text-blue-400 mt-1">
                        <span class="material-icons">folder</span>
                    </div>
                    <div class="result-details flex-1 min-w-0">
                        <div class="result-name font-medium truncate" style="color: ${nameColor} !important;">
                            ${sourceIcon} ${folder.name}
                        </div>
                        <div class="result-info text-sm mt-1" style="color: ${infoColor} !important;">
                            ${locationBadge}
                            ${folder.createdTime ? `<span class="result-created">Created: ${new Date(folder.createdTime).toLocaleDateString()}</span>` : ''}
                            ${scoreDisplay}
                        </div>
                    </div>
                    <div class="result-actions flex gap-2">
                        <button data-action="import-project" data-folder-id="${folder.id}" data-folder-name="${folder.name.replace(/'/g, '&apos;')}" 
                                class="link-folder-btn bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">
                            <span class="material-icons text-sm mr-1">file_download</span>
                            Import
                        </button>
                        <a href="${folder.url}" target="_blank" 
                           class="view-folder-btn bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-3 py-1 rounded text-sm no-underline">
                            <span class="material-icons text-sm mr-1">open_in_new</span>
                            View
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Auto-scroll to results section so user sees the search worked
    setTimeout(() => {
        const modal = document.getElementById('googleDriveImportModal');
        const resultsSection = document.getElementById('importFolderSearchResults');
        if (modal && resultsSection) {
            // Scroll the modal body to show the results
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                // Calculate the position of the results section relative to modal body
                const resultsTop = resultsSection.offsetTop;
                // Scroll the modal body to show the results
                modalBody.scrollTo({
                    top: resultsTop - 20, // Small offset from top
                    behavior: 'smooth'
                });
                console.log('📜 Auto-scrolled enhanced Google Drive import modal to search results');
            }
        }
    }, 150); // Slightly longer delay to ensure DOM updates
}

// Instant suggestions functions for import modal
function showInstantSuggestions(query) {
    const dropdown = document.getElementById('instantSuggestionsDropdown');
    if (!dropdown) return;
    
    // Hide suggestions for now since preloader is removed
    dropdown.classList.add('hidden');
    return;
}

function hideInstantSuggestions() {
    const dropdown = document.getElementById('instantSuggestionsDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
}

function updateSelectedSuggestion(suggestions, selectedIndex) {
    suggestions.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('suggestion-selected', 'bg-blue-100', 'dark:bg-blue-900');
        } else {
            item.classList.remove('suggestion-selected', 'bg-blue-100', 'dark:bg-blue-900');
        }
    });
}

function selectSuggestion(suggestionElement) {
    const projectId = suggestionElement.dataset.projectId;
    const projectName = suggestionElement.dataset.projectName;
    
    if (projectId && projectName) {
        selectSuggestionFromDropdown(projectId, projectName);
    }
}

function selectSuggestionFromDropdown(projectId, projectName) {
    // Fill the search input with the selected project name
    const searchInput = document.getElementById('importFolderSearchInput');
    if (searchInput) {
        searchInput.value = projectName;
    }
    
    // Hide suggestions
    hideInstantSuggestions();
    
    // Automatically import the selected project
    console.log(`⚡ Auto-importing selected project: ${projectName} (${projectId})`);
    importProjectDataFromFolder(projectId, projectName);
}


async function handleImportFromManualFolder() {
    const manualInput = document.getElementById('importManualFolderIdInput');
    if (!manualInput) return;
    
    const folderInput = manualInput.value.trim();
    if (!folderInput) {
        alert('Please enter a Google Drive folder ID or URL');
        return;
    }
    
    // Extract folder ID from URL if needed
    let folderId = folderInput;
    if (folderInput.includes('drive.google.com')) {
        const match = folderInput.match(/\/folders\/([a-zA-Z0-9-_]+)/);
        if (match) {
            folderId = match[1];
        }
    }
    
    console.log('📁 Importing from manual folder ID in import modal:', folderId);
    
    try {
        // Use existing import function but pass the folder name as ID for now
        await importProjectDataFromFolder(folderId, 'Manual Folder');
    } catch (error) {
        console.error('❌ Manual import error:', error);
        alert('Failed to import from folder: ' + error.message);
    }
}

// Excel Upload Modal Functions
function showExcelUploadModal() {
    const overlay = document.getElementById('excelUploadModalOverlay');
    const modal = document.getElementById('excelUploadModal');
    if (!overlay || !modal) return;
    
    // Reset modal state
    resetExcelUploadModal();
    
    // Lock body scroll to prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    // Show the modal
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
}

function hideExcelUploadModal() {
    const overlay = document.getElementById('excelUploadModalOverlay');
    const modal = document.getElementById('excelUploadModal');
    if (!overlay || !modal) return;
    
    overlay.classList.add('hidden');
    modal.classList.add('hidden');
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Reset modal state
    resetExcelUploadModal();
}

function resetExcelUploadModal() {
    // Reset form
    const form = document.getElementById('excelUploadForm');
    if (form) form.reset();
    
    // Hide progress and results
    const progress = document.getElementById('excelUploadProgress');
    const results = document.getElementById('excelUploadResults');
    if (progress) progress.classList.add('hidden');
    if (results) results.classList.add('hidden');
    
    // Reset progress bar
    const progressBar = document.getElementById('excelUploadProgressBar');
    if (progressBar) progressBar.style.width = '0%';
}

async function processExcelUpload() {
    const fileInput = document.getElementById('excelFileInput');
    const passwordInput = document.getElementById('excelPasswordInput');
    const progressDiv = document.getElementById('excelUploadProgress');
    const progressBar = document.getElementById('excelUploadProgressBar');
    const statusText = document.getElementById('excelUploadStatus');
    const resultsDiv = document.getElementById('excelUploadResults');
    const summaryDiv = document.getElementById('excelUploadSummary');
    const errorsDiv = document.getElementById('excelUploadErrors');
    const processButton = document.getElementById('processExcelUploadButton');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select an Excel file to upload.');
        return;
    }
    
    const file = fileInput.files[0];
    const password = passwordInput.value.trim();
    
    // Show progress
    progressDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    processButton.disabled = true;
    processButton.textContent = 'Processing...';
    
    // Update progress: File validation
    progressBar.style.width = '20%';
    statusText.textContent = 'Validating file...';
    
    try {
        // Create FormData
        const formData = new FormData();
        formData.append('excelFile', file);
        if (password) {
            formData.append('password', password);
        }
        
        // Add filename analysis data if available
        const analysisDiv = document.getElementById('filenameAnalysis');
        if (analysisDiv && analysisDiv.dataset.isCmrpFormat === 'true') {
            formData.append('proposalCode', analysisDiv.dataset.proposalCode);
            formData.append('expectedRevision', analysisDiv.dataset.revisionNumber);
            formData.append('projectName', analysisDiv.dataset.projectName);
            log(`📄 Sending CMRP file metadata: ${analysisDiv.dataset.proposalCode}, Rev: ${analysisDiv.dataset.revisionNumber}`, 'info');
        }
        
        // Update progress: Uploading
        progressBar.style.width = '40%';
        statusText.textContent = 'Uploading file...';
        
        // Get auth token
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Authentication token not found. Please login again.');
        }
        
        // Upload and process
        progressBar.style.width = '60%';
        statusText.textContent = 'Processing Excel data...';
        
        const response = await fetch('/api/opportunities/bulk-update-excel', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        // Update progress: Getting results
        progressBar.style.width = '80%';
        statusText.textContent = 'Getting results...';
        
        const result = await response.json();
        
        // Complete progress
        progressBar.style.width = '100%';
        statusText.textContent = 'Complete!';
        
        // Hide progress and show results
        setTimeout(() => {
            progressDiv.classList.add('hidden');
            showExcelUploadResults(result, response.ok);
        }, 500);
        
        // Refresh opportunities data if successful
        if (response.ok && result.success && result.updated > 0) {
            await refreshOpportunitiesData(); // Refresh the table data
        }
        
    } catch (error) {
        // Excel upload error
        progressDiv.classList.add('hidden');
        showExcelUploadResults({
            success: false,
            error: error.message,
            details: 'An unexpected error occurred during upload.'
        }, false);
    } finally {
        processButton.disabled = false;
        processButton.textContent = 'Upload & Process';
    }
}

function showExcelUploadResults(result, success) {
    const resultsDiv = document.getElementById('excelUploadResults');
    const summaryDiv = document.getElementById('excelUploadSummary');
    const errorsDiv = document.getElementById('excelUploadErrors');
    
    if (!resultsDiv || !summaryDiv || !errorsDiv) return;
    
    // Clear previous results
    summaryDiv.innerHTML = '';
    errorsDiv.innerHTML = '';
    
    if (success && result.success) {
        // Success case
        summaryDiv.innerHTML = `
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <h5 class="font-medium text-green-800 dark:text-green-200 mb-2">✅ Upload Successful!</h5>
                <div class="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <p><strong>Records Updated:</strong> ${result.updated}</p>
                    <p><strong>Errors:</strong> ${result.errors}</p>
                </div>
            </div>
        `;
        
        // Show updated records details
        if (result.results && result.results.updatedRecords && result.results.updatedRecords.length > 0) {
            const updatedList = result.results.updatedRecords.map(record => 
                `<li class="text-sm">Row ${record.row}: ${record.uid} - ${Object.keys(record.changes).join(', ')}</li>`
            ).join('');
            
            summaryDiv.innerHTML += `
                <div class="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <h6 class="font-medium text-blue-800 dark:text-blue-200 mb-2">Updated Records:</h6>
                    <ul class="text-blue-700 dark:text-blue-300 list-disc list-inside max-h-32 overflow-y-auto">
                        ${updatedList}
                    </ul>
                </div>
            `;
        }
        
        // Show errors if any
        if (result.results && result.results.errors && result.results.errors.length > 0) {
            const errorList = result.results.errors.map(error => 
                `<li class="text-sm">${error}</li>`
            ).join('');
            
            errorsDiv.innerHTML = `
                <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <h6 class="font-medium text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Warnings:</h6>
                    <ul class="text-yellow-700 dark:text-yellow-300 list-disc list-inside max-h-32 overflow-y-auto">
                        ${errorList}
                    </ul>
                </div>
            `;
        }
        
    } else {
        // Error case
        summaryDiv.innerHTML = `
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <h5 class="font-medium text-red-800 dark:text-red-200 mb-2">❌ Upload Failed</h5>
                <div class="text-sm text-red-700 dark:text-red-300">
                    <p><strong>Error:</strong> ${result.error || 'Unknown error occurred'}</p>
                    ${result.details ? `<p><strong>Details:</strong> ${result.details}</p>` : ''}
                </div>
            </div>
        `;
    }
    
    resultsDiv.classList.remove('hidden');
}

// Analyze CMRP filename format: [Proposal Code]-PCS001-[rev#] [Project Name]
// Example: CMRP25060304-PCS001-00 SLTEC Fortigate Renewal
function analyzeFileName() {
    const fileInput = document.getElementById('excelFileInput');
    const analysisDiv = document.getElementById('filenameAnalysis');
    const detailsDiv = document.getElementById('filenameDetails');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        analysisDiv.classList.add('hidden');
        return;
    }
    
    const filename = fileInput.files[0].name;
    const nameWithoutExt = filename.replace(/\.(xlsx|xls)$/i, '');
    
    // CMRP filename pattern: [ProposalCode]-PCS001-[RevNum] [ProjectName]
    const cmrpPattern = /^([A-Z0-9]+)-PCS001-(\d{2})\s+(.+)$/i;
    const match = nameWithoutExt.match(cmrpPattern);
    
    if (match) {
        const [, proposalCode, revisionNumber, projectName] = match;
        
        detailsDiv.innerHTML = `
            <div><strong>✅ CMRP Calcsheet Format Detected</strong></div>
            <div><strong>Proposal Code:</strong> ${proposalCode}</div>
            <div><strong>Revision Number:</strong> ${revisionNumber}</div>
            <div><strong>Project Name:</strong> ${projectName}</div>
            <div class="mt-2 text-xs">
                <em>This file will be processed with CMRP calcsheet format expectations.</em>
            </div>
        `;
        analysisDiv.classList.remove('hidden');
        
        // Store extracted info for potential use in processing
        analysisDiv.dataset.proposalCode = proposalCode;
        analysisDiv.dataset.revisionNumber = revisionNumber;
        analysisDiv.dataset.projectName = projectName;
        analysisDiv.dataset.isCmrpFormat = 'true';
        
        // CMRP filename analyzed
        console.log('CMRP filename analyzed:', {
            filename,
            proposalCode,
            revisionNumber,
            projectName
        });
        
    } else {
        // Try simpler patterns or show generic info
        detailsDiv.innerHTML = `
            <div><strong>📄 Custom Excel File</strong></div>
            <div><strong>Filename:</strong> ${filename}</div>
            <div class="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
                <em>Filename doesn't match CMRP format ([Code]-PCS001-[Rev] [Name]). 
                Make sure your Excel contains UID, Revision Number, Final Amount, and Margin columns.</em>
            </div>
        `;
        analysisDiv.classList.remove('hidden');
        analysisDiv.dataset.isCmrpFormat = 'false';
        
        // Non-CMRP filename
    }
}

function showRevisionHistoryModal(uid) {
    // Show revision history modal
    
    const overlay = document.getElementById('revisionHistoryModalOverlay');
    const modal = document.getElementById('revisionHistoryModal');
    const tableBody = document.querySelector('#revisionHistoryContent tbody');
    
    // Modal elements found
    console.log('Modal elements found:', {
        overlay: !!overlay,
        modal: !!modal,
        tableBody: !!tableBody
    });
    
    if (!overlay || !modal || !tableBody) {
        // Revision history modal not found
        alert('Error: Modal elements not found. Please refresh the page and try again.');
        return;
    }
    
    // Show loading state
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4 loading-text">Loading revision history...</td></tr>';
    
    // Lock body scroll to prevent background scrolling
    document.body.style.overflow = 'hidden';
    
    // Show the modal
    // Showing modal
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    
    // Verify modal is visible
    const isVisible = !overlay.classList.contains('hidden');
    // Modal visibility checked
    
    if (!isVisible) {
        // Modal failed to show
        alert('Error: Modal failed to display. Please check browser console for details.');
        return;
    }
    
    // Load and display revision history
    loadRevisionHistory(uid, tableBody);
}

async function loadRevisionHistory(uid, tableBody) {
    try {
        // Load revision history
        
        const token = getAuthToken();
        if (!token) {
            throw new Error('No authentication token found. Please log in again.');
        }
        
        // Making API call
        const apiUrl = getApiUrl(`/api/opportunities/${encodeURIComponent(uid)}/revisions`);
        // API URL set

        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Response status received
        
        if (!response.ok) {
            const errorText = await response.text();
            // API Error
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const revisions = await response.json();
        // Received revisions data
        
        if (revisions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No revision history found for this opportunity.</td></tr>';
            return;
        }

        // Populate the table with revision data
        // Populating revision table
        tableBody.innerHTML = '';
        revisions.forEach((revision, index) => {
            // Processing revision
            const row = document.createElement('tr');
            
            // Revision number
            const revCell = document.createElement('td');
            revCell.className = 'px-3 py-2 border-b text-center';
            revCell.textContent = revision.revision_number || 'N/A';
            row.appendChild(revCell);
            
            // Changed by
            const changedByCell = document.createElement('td');
            changedByCell.className = 'px-3 py-2 border-b';
            changedByCell.textContent = revision.changed_by || 'N/A';
            row.appendChild(changedByCell);
            
            // Changed at
            const changedAtCell = document.createElement('td');
            changedAtCell.className = 'px-3 py-2 border-b';
            const date = new Date(revision.changed_at);
            changedAtCell.textContent = formatDateWithDay(revision.changed_at);
            row.appendChild(changedAtCell);
            
            // Parse changed fields to show individual field changes
            let changedFields = {};
            
            // Processing changed fields
            
            try {
                // Handle case where changed_fields might already be an object (depending on DB driver)
                if (typeof revision.changed_fields === 'string') {
                    changedFields = JSON.parse(revision.changed_fields || '{}');
                    // Parsed changed fields
                } else if (typeof revision.changed_fields === 'object' && revision.changed_fields !== null) {
                    changedFields = revision.changed_fields;
                    // Using changed fields object
                } else {
                    changedFields = {};
                    // Empty changed fields
                }
            } catch (e) {
                // Failed to parse changed fields
                changedFields = {};
            }
            
            // If we have field changes, create a row for each
            const fieldNames = Object.keys(changedFields);
            // Field names found
            
            if (fieldNames.length === 0) {
                // No specific field changes, show general info
                const fieldCell = document.createElement('td');
                fieldCell.className = 'px-3 py-2 border-b text-gray-500';
                fieldCell.textContent = revision.revision_number === 1 ? 'Initial revision' : 'General update';
                row.appendChild(fieldCell);
                
                const oldValueCell = document.createElement('td');
                oldValueCell.className = 'px-3 py-2 border-b text-gray-400';
                oldValueCell.textContent = '-';
                row.appendChild(oldValueCell);
                
                const newValueCell = document.createElement('td');
                newValueCell.className = 'px-3 py-2 border-b text-gray-400';
                newValueCell.textContent = '-';
                row.appendChild(newValueCell);
                
                tableBody.appendChild(row);
            } else {
                // Show first field in this row, then create additional rows for other fields
                let isFirstField = true;
                fieldNames.forEach(fieldName => {
                    const currentRow = isFirstField ? row : document.createElement('tr');
                    
                    if (!isFirstField) {
                        // For additional fields, add empty cells for revision, changed_by, changed_at
                        ['', '', ''].forEach(() => {
                            const emptyCell = document.createElement('td');
                            emptyCell.className = 'px-3 py-2 border-b text-gray-400';
                            emptyCell.textContent = '↳';
                            currentRow.appendChild(emptyCell);
                        });
                    }
                    
                    // Field name
                    const fieldCell = document.createElement('td');
                    fieldCell.className = 'px-3 py-2 border-b';
                    fieldCell.textContent = fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    currentRow.appendChild(fieldCell);
                    
                    const changeInfo = changedFields[fieldName];
                    let oldValue = '-';
                    let newValue = '-';
                    
                    // Handle enhanced field tracking format with old/new values
                    if (changeInfo && typeof changeInfo === 'object' && changeInfo.hasOwnProperty('old') && changeInfo.hasOwnProperty('new')) {
                        oldValue = changeInfo.old !== null && changeInfo.old !== undefined ? changeInfo.old : '(empty)';
                        newValue = changeInfo.new !== null && changeInfo.new !== undefined ? changeInfo.new : '(empty)';
                    } else {
                        // Fallback for legacy format where changeInfo is just the new value
                        oldValue = '(unknown)';
                        newValue = changeInfo !== null && changeInfo !== undefined ? changeInfo : '(empty)';
                    }
                    
                    // Apply formatting to old and new values using the same logic as the main table
                    if (oldValue !== '(empty)' && oldValue !== '(unknown)' && oldValue !== '-') {
                        oldValue = formatCellValue(oldValue, fieldName);
                    }
                    if (newValue !== '(empty)' && newValue !== '-') {
                        newValue = formatCellValue(newValue, fieldName);
                    }
                    
                    // Old value
                    const oldValueCell = document.createElement('td');
                    oldValueCell.className = 'px-3 py-2 border-b';
                    oldValueCell.textContent = oldValue;
                    currentRow.appendChild(oldValueCell);
                    
                    // New value
                    const newValueCell = document.createElement('td');
                    newValueCell.className = 'px-3 py-2 border-b';
                    newValueCell.textContent = newValue;
                    currentRow.appendChild(newValueCell);
                    
                    tableBody.appendChild(currentRow);
                    isFirstField = false;
                });
            }
        });

    } catch (error) {
        // Error loading revision history
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-600">Error loading revision history: ${error.message}</td></tr>`;
    }
}

// --- Helper Functions ---
function isAuthenticated() {
    return !!localStorage.getItem('authToken');
}

function showMainContent(show) {
    document.querySelector('.main-content').style.display = show ? 'block' : 'none';
    authModalOverlay.style.display = show ? 'none' : 'block';
    authModal.style.display = show ? 'none' : 'block';
}

// --- User Management Nav Visibility ---
function updateUserMgmtNavVisibility() {
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
        userMgmtBtn.style.display = (accountType === 'Admin') ? '' : 'none';
        
        // Update proposal workbench visibility when checking user management visibility
        updateProposalWorkbenchNavVisibility();
    } catch {
        userMgmtBtn.style.display = 'none';
    }
}

function updateProposalWorkbenchNavVisibility() {
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

// --- Change Password Button Visibility ---
function updateChangePasswordBtnVisibility() {
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (!changePasswordBtn) return;
    
    const token = localStorage.getItem('authToken');
    if (!token) {
        changePasswordBtn.style.display = 'none';
    } else {
        changePasswordBtn.style.display = '';
    }
}

// --- Table Operations ---
function buildHeaderMap(headersToMap) { // Map normalized header to actual header
    headerIndices = {};
    headersToMap.forEach((header, index) => {
        const norm = normalizeField(header);
        headerIndices[norm] = index;
        if (norm.includes('particulars')) {
            particularsIndices.push(index);
        }
    });
}

function getDropdownOptions(headersToUse, data) {
    const options = {};
    DROPDOWN_FIELDS.forEach(field => {
        const normField = normalizeField(field);
        let values = new Set();

        // Find the index of this field in the headers array
        let fieldIndex = -1;
        for (let i = 0; i < headersToUse.length; i++) {
            if (normalizeField(headersToUse[i]) === normField) {
                fieldIndex = i;
                break;
            }
        }

        // If field found in headers, collect unique values
        if (fieldIndex !== -1) {
            data.forEach(row => {
                const value = row[headersToUse[fieldIndex]];
                if (value) values.add(value);
            });
        }

        // Special handling for Account Manager, PIC and BOM
        if (normField === 'accountmgr') {
            for (let i = 0; i < headersToUse.length; i++) {
                if (normalizeField(headersToUse[i]) === 'accountmgr') {
                    data.forEach(row => {
                        const value = row[headersToUse[i]];
                        if (value) values.add(value);
                    });
                }
            }
        } 
        else if (normField === 'pic') {
            for (let i = 0; i < headersToUse.length; i++) {
                if (normalizeField(headersToUse[i]) === 'pic') {
                    data.forEach(row => {
                        const value = row[headersToUse[i]];
                        if (value) values.add(value);
                    });
                }
            }
        }
        else if (normField === 'bom') {
            for (let i = 0; i < headersToUse.length; i++) {
                if (normalizeField(headersToUse[i]) === 'bom') {
                    data.forEach(row => {
                        const value = row[headersToUse[i]];
                        if (value) values.add(value);
                    });
                }
            }
        }

        options[normField] = Array.from(values).sort();
    });

    return options;
}

// This function has been replaced by initializeTableHeader() which includes Actions column

// Store the last known column visibility state to detect changes
let lastColumnVisibilityState = null;

// Function to ensure column visibility is properly initialized
function ensureColumnVisibilityInitialized() {
    // FORCE RESET: Always initialize all columns to visible
    columnVisibility = {};
    headers.forEach(h => columnVisibility[h] = true);
    console.log(`[COLUMN-VIS] Initialized ${headers.length} columns to visible`);
    return true;
}

// Function to check if column visibility changed and rebuild header if needed
function checkAndRebuildHeaderIfNeeded() {
    const currentState = JSON.stringify(columnVisibility);
    if (lastColumnVisibilityState !== currentState) {
        lastColumnVisibilityState = currentState;
        initializeTableHeader();
        return true; // Header was rebuilt
    }
    return false; // No rebuild needed
}

function populateTableBody(data) {
    if (!data || !data.length) {
        tableBody.innerHTML = '<tr><td colspan="100%" class="text-center p-4">No data available</td></tr>';
        return;
    }
    
    // Ensure column visibility is initialized
    ensureColumnVisibilityInitialized();
    
    tableBody.innerHTML = '';
    // Find first visible column index
    const firstVisibleIndex = headers.findIndex((h, i) => columnVisibility[h]);
    data.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        // Store the original index from opportunities array
        const originalIndex = opportunities.findIndex(opp => opp.uid === row.uid);
        tr.dataset.originalIndex = originalIndex;

        // Add status-based classes
        const status = row.opp_status?.toLowerCase();
        if (status === 'op100') {
            tr.classList.add('bg-op100');
        } else if (status === 'lost') {
            tr.classList.add('bg-lost');
        } else if (row.decision?.toLowerCase() === 'decline') {
            tr.classList.add('bg-declined');
        }

        let visibleColumnIndex = 0; // Track visible column position
        
        headers.forEach((header, index) => {
            // If specific column visibility is not set, default to visible
            if (columnVisibility[header] === undefined) {
                columnVisibility[header] = true;
            }
            
            if (!columnVisibility[header]) return; // Skip hidden columns
            const td = document.createElement('td');
            
            // Special handling for Google Drive folder column
            if (header === 'google_drive_folder_name' && row.google_drive_folder_url) {
                td.innerHTML = `
                    <div class="drive-folder-cell">
                        <a href="${row.google_drive_folder_url}" target="_blank" class="drive-folder-table-link">
                            <span class="material-icons">folder</span>
                            ${row.google_drive_folder_name || 'Drive Folder'}
                        </a>
                    </div>
                `;
            } else if (header === 'google_drive_folder_name' && !row.google_drive_folder_url) {
                td.innerHTML = `
                    <div class="drive-folder-cell">
                        <span class="drive-folder-none">No folder</span>
                    </div>
                `;
            } else {
                // Check if this is the project name column before formatting
                const normalizedHeader = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const isProjectNameColumn = normalizedHeader === 'projectname' || header.toLowerCase() === 'project_name';
                
                if (isProjectNameColumn && row[header]) {
                    // Make project name clickable with link to project detail page
                    td.innerHTML = `
                        <a href="project-detail.html?uid=${encodeURIComponent(row.uid)}" 
                           class="project-name-link text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
                           title="View project details">
                            ${formatCellValue(row[header], header)}
                        </a>
                    `;
                } else {
                    td.innerHTML = formatCellValue(row[header], header);
                }
            }
            
            // Set the appropriate width based on column type
            const columnWidth = getDefaultColumnWidth(header);
            td.style.minWidth = columnWidth;
            td.style.width = columnWidth;
            
            // Add appropriate classes
            const normalizedHeaderForAlignment = normalizeField(header);
            if (rightAlignColumns.includes(normalizedHeaderForAlignment)) {
                td.classList.add('numeric-column');
                td.style.textAlign = 'right';
            } else if (centerAlignColumns.includes(normalizedHeaderForAlignment)) {
                td.style.textAlign = 'center';
            }
            
            // Check if this is the project name column (with various possible field names)
            const normalizedHeader = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const isProjectNameColumn = normalizedHeader === 'projectname' || header.toLowerCase() === 'project_name';
            const isFirstVisibleColumn = visibleColumnIndex === 0;
            
            if (isProjectNameColumn || isFirstVisibleColumn) {
                td.classList.add('project-name-cell');
                // Make project name column sticky - using class for styling
                td.classList.add('sticky-col');
                // Forcefully apply styles for text wrapping
                td.style.whiteSpace = 'normal';
                td.style.wordBreak = 'break-word'; 
                td.style.wordWrap = 'break-word';
                td.style.overflow = 'visible';
                td.style.textOverflow = 'unset';
                td.style.padding = '12px';
                
                // Set background color based on row status
                // Using custom data attribute for status to use in CSS
                if (row.opp_status?.toLowerCase() === 'op100') {
                    td.dataset.rowStatus = 'op100';
                } else if (status === 'lost') {
                    td.dataset.rowStatus = 'lost';
                } else if (row.decision?.toLowerCase() === 'decline') {
                    td.dataset.rowStatus = 'declined';
                }
            }
            
            // Check if this is the remarks_comments column
            const normalizedHeaderForRemarks = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normalizedHeaderForRemarks === 'remarkscomments' || header.toLowerCase().includes('remarks')) {
                td.classList.add('remarks-cell');
            }
            
            // Add multi-select functionality for selectable columns
            if (isSelectableColumn(header)) {
                // Add data attributes for cell selection
                td.dataset.cellRef = `${originalIndex}-${header}`;
                td.dataset.cellValue = row[header] || '';
                td.dataset.cellType = 'numeric';
                
                // Add visual indicator that this cell is selectable
                td.classList.add('selectable-cell');
                
                // Add click handler for multi-select functionality
                td.addEventListener('click', (e) => {
                    // Only handle multi-select if not in edit mode and this is a selectable column
                    if (!td.classList.contains('editing') && isSelectableColumn(header)) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const cellRef = td.dataset.cellRef;
                        const cellValue = parseFloat(td.dataset.cellValue) || 0;
                        
                        if (e.ctrlKey || e.metaKey) {
                            // Ctrl/Cmd click: toggle selection
                            handleCellToggleSelect(td, cellRef, cellValue);
                        } else if (e.shiftKey && selectedCells.size > 0) {
                            // Shift click: range selection
                            handleCellRangeSelect(td, cellRef, cellValue);
                        } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                            // Regular click: clear and select single cell
                            handleCellSingleSelect(td, cellRef, cellValue);
                        }
                        
                        updateCellSelectionSummary();
                    }
                });
            }
            
            // Make cell editable
            makeEditable(td, row, header, originalIndex);
            
            tr.appendChild(td);
            visibleColumnIndex++; // Increment visible column counter
        });

        // Add action buttons
        const actionsTd = document.createElement('td');
        actionsTd.className = 'center-align-cell';
        
        const btnContainer = document.createElement('div');
        btnContainer.className = 'flex justify-center items-center gap-2';

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.innerHTML = '<span class="material-icons" style="font-size:1em;vertical-align:middle;">edit</span>';
        editBtn.className = 'action-button px-2 py-1 rounded text-xs';
        editBtn.title = 'Edit Opportunity';
        editBtn.onclick = () => showEditRowModal(originalIndex);
        btnContainer.appendChild(editBtn);

        // Duplicate button
        const duplicateBtn = document.createElement('button');
        duplicateBtn.innerHTML = '<span class="material-icons" style="font-size:1em;vertical-align:middle;">content_copy</span>';
        duplicateBtn.className = 'theme-button px-2 py-1 rounded text-xs';
        duplicateBtn.title = 'Duplicate Opportunity';
        duplicateBtn.onclick = () => showCreateOpportunityModal(originalIndex);
        btnContainer.appendChild(duplicateBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<span class="material-icons" style="font-size:1em;vertical-align:middle;">delete</span>';
        deleteBtn.className = 'theme-button px-2 py-1 rounded text-xs';
        deleteBtn.title = 'Delete Opportunity';
        deleteBtn.onclick = async () => {
            if (confirm('Are you sure you want to delete this opportunity?')) {
                try {
                    const token = getAuthToken();
                    const response = await fetch(getApiUrl(`/api/opportunities/${encodeURIComponent(row.uid)}`), {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) {
                        let errorMessage = response.statusText;
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            try {
                                const err = await response.json();
                                errorMessage = err.error || err.message || response.statusText;
                            } catch (parseError) {
                                errorMessage = `Server error (${response.status}): ${response.statusText}`;
                            }
                        } else {
                            errorMessage = `Server error (${response.status}): ${response.statusText}`;
                        }
                        throw new Error(errorMessage);
                    }
                    // Remove from local data and re-render
                    const idx = opportunities.findIndex(opp => opp.uid === row.uid);
                    if (idx !== -1) opportunities.splice(idx, 1);
                    filterAndSortData();
                    updateRowCount();
                    // FIXED: Dashboard cards should always show global metrics
                    loadDashboardData(opportunities);
                    alert('Opportunity deleted successfully.');
                } catch (err) {
                    alert('Failed to delete: ' + err.message);
                }
            }
        };
        btnContainer.appendChild(deleteBtn);

        // Proposal Story button (replaces revision history with enhanced timeline)
        const historyBtn = document.createElement('button');
        historyBtn.innerHTML = '<span class="material-icons" style="font-size:1em;vertical-align:middle;">timeline</span>';
        historyBtn.className = 'theme-button px-2 py-1 rounded text-xs';
        historyBtn.title = 'View Proposal Story & Timeline';
        historyBtn.onclick = () => showProposalStory(row.uid);
        btnContainer.appendChild(historyBtn);

        actionsTd.appendChild(btnContainer);
        tr.appendChild(actionsTd);
        tableBody.appendChild(tr);
    });
    
    // Apply OPP Status color coding if enabled
    if (oppStatusColorsEnabled) {
        applyOppStatusColorCoding();
    }
}

function getCellClass(header) {
    const normHeader = normalizeField(header);
    if (rightAlignColumns.includes(normHeader)) return 'text-right';
    if (centerAlignColumns.includes(normHeader)) return 'text-center';
    return '';
}

function handleSortClick(columnIndex) {
    // Check if any column is currently being resized or just finished resizing
    const isAnyColumnResizing = document.querySelector('.table-container.resizing') !== null;
    if (isAnyColumnResizing || justFinishedResize) {
        // Prevented sort during resize
        return;
    }
    
    // Check if multi-level sorting is enabled
    if (sortCriteria.length > 0) {
        // Multi-level sorting mode - modify existing criteria or add new
        const existingIndex = sortCriteria.findIndex(c => c.columnIndex === columnIndex);
        
        if (existingIndex !== -1) {
            // Column already in sort criteria - toggle direction
            sortCriteria[existingIndex].direction = 
                sortCriteria[existingIndex].direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Add new column to sort criteria
            const columnName = headers[columnIndex];
            sortCriteria.push({
                columnIndex: columnIndex,
                direction: 'asc',
                columnName: columnName
            });
        }
    } else {
        // Legacy single-column sorting
        if (currentSortColumnIndex === columnIndex) {
            // Toggle direction if same column
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to ascending
            currentSortColumnIndex = columnIndex;
            currentSortDirection = 'asc';
        }
    }
    
    filterAndSortData();
    updateSortIndicators();
    updateSortDisplay();
    
    // Save sorting preferences
    saveUserPreferences();
}

function updateSortIndicators() {
    const headers = tableHead.querySelectorAll('th');
    headers.forEach((th, index) => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (index === currentSortColumnIndex) {
            th.classList.add(`sort-${currentSortDirection}`);
        }
    });
}

function filterAndSortData() {
    const filters = getActiveFilters();
    
    // Ensure column visibility is consistent before filtering
    ensureColumnVisibilityInitialized();
    
    // Check if header needs to be rebuilt due to column visibility changes
    checkAndRebuildHeaderIfNeeded();
    
    // Filter data
    const filteredData = opportunities.filter(opp => {
        // Search filter
        if (filters.search) {
            const searchStr = filters.search.toLowerCase();
            const matchFound = Object.values(opp).some(value => 
                String(value).toLowerCase().includes(searchStr)
            );
            if (!matchFound) return false;
        }

        // Status filter - now supports multiple selections
        if (filters.status && filters.status.length > 0 && !filters.status.includes('all')) {
            const oppStatus = (opp.opp_status || '').toLowerCase();
            const currentStatus = (opp.status || '').toLowerCase();
            const decision = (opp.decision || '').toLowerCase();
            
            // Check if the opportunity matches any of the selected status filters
            const matchesAnyStatus = filters.status.some(status => {
                const statusLower = status.toLowerCase();
                
                // Map filter button values to actual data values
                switch (statusLower) {
                    case 'op100':
                        return oppStatus === 'op100';
                    case 'op90':
                        return oppStatus === 'op90';
                    case 'op60':
                        return oppStatus === 'op60';
                    case 'op30':
                        return oppStatus === 'op30';
                    case 'submitted':
                        return oppStatus === 'op30' || oppStatus === 'op60';
                    case 'ongoing':
                        return currentStatus === 'on-going';
                    case 'not_yet_started':
                        return currentStatus === 'not yet started';
                    case 'no_decision':
                        return decision !== 'go' && decision !== 'decline';
                    case 'lost':
                        return oppStatus === 'lost' || decision === 'lost';
                    case 'declined':
                        return decision === 'decline';
                    case 'inactive':
                        return oppStatus === 'inactive';
                    default:
                        return false;
                }
            });
            
            if (!matchesAnyStatus) return false;
        }

        // Solutions filter
        if (filters.solutions && filters.solutions !== 'all' && opp.solutions !== filters.solutions) {
            return false;
        }

        // Account Manager filter
        if (filters.accountMgr && filters.accountMgr !== 'all' && opp.account_mgr !== filters.accountMgr) {
            return false;
        }

        // PIC filter
        if (filters.pic && filters.pic !== 'all' && opp.pic !== filters.pic) {
            return false;
        }

        return true;
    });

    // Sort data - use multi-level sorting if enabled, otherwise fall back to single-column
    if (sortCriteria.length > 0) {
        // Multi-level sorting
        filteredData.sort((a, b) => {
            for (let i = 0; i < sortCriteria.length; i++) {
                const criterion = sortCriteria[i];
                const sortHeader = headers[criterion.columnIndex];
                
                if (!sortHeader) continue;
                
                let aVal = a[sortHeader];
                let bVal = b[sortHeader];
                
                // Handle different types of values
                if (isDateField(sortHeader)) {
                    aVal = parseDateString(aVal) || new Date(0);
                    bVal = parseDateString(bVal) || new Date(0);
                } else if (isCurrencyField(sortHeader)) {
                    aVal = parseFloat(String(aVal).replace(/[^0-9.-]+/g, '') || '0');
                    bVal = parseFloat(String(bVal).replace(/[^0-9.-]+/g, '') || '0');
                } else {
                    // Convert to lowercase strings for comparison
                    aVal = String(aVal || '').toLowerCase();
                    bVal = String(bVal || '').toLowerCase();
                }
                
                // Compare values for this criterion
                let result = 0;
                if (aVal < bVal) result = criterion.direction === 'asc' ? -1 : 1;
                else if (aVal > bVal) result = criterion.direction === 'asc' ? 1 : -1;
                
                // If not equal, return this result
                if (result !== 0) return result;
                
                // If equal, continue to next criterion
            }
            return 0; // All criteria resulted in equal values
        });
    } else if (currentSortColumnIndex >= 0 && headers[currentSortColumnIndex]) {
        // Fallback to legacy single-column sorting
        const sortHeader = headers[currentSortColumnIndex];
        filteredData.sort((a, b) => {
            let aVal = a[sortHeader];
            let bVal = b[sortHeader];

            // Handle different types of values
            if (isDateField(sortHeader)) {
                aVal = parseDateString(aVal) || new Date(0);
                bVal = parseDateString(bVal) || new Date(0);
            } else if (isCurrencyField(sortHeader)) {
                aVal = parseFloat(String(aVal).replace(/[^0-9.-]+/g, '') || '0');
                bVal = parseFloat(String(bVal).replace(/[^0-9.-]+/g, '') || '0');
            } else {
                // Convert to lowercase strings for comparison
                aVal = String(aVal || '').toLowerCase();
                bVal = String(bVal || '').toLowerCase();
            }

            // Compare values
            if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Update table body with filtered data
    populateTableBody(filteredData);
    
    // Ensure column widths are preserved after sorting
    reapplyColumnWidths();
    
    // Update row count with filtered data
    updateRowCount(filteredData);
    
    // Note: Dashboard cards are no longer updated here automatically
    // They are only updated when solutions or account manager filters change
}

// Function to get currently filtered data (used for selective dashboard updates)
function getCurrentFilteredData(ignorePicFilter = false) {
    const filters = getActiveFilters();
    
    // Apply the same filtering logic as filterAndSortData()
    const filteredData = opportunities.filter(opp => {
        // Search filter
        if (filters.search) {
            const searchStr = filters.search.toLowerCase();
            const matchFound = Object.values(opp).some(value => 
                String(value).toLowerCase().includes(searchStr)
            );
            if (!matchFound) return false;
        }

        // Status filter - supports multiple selections
        if (filters.status && filters.status.length > 0 && !filters.status.includes('all')) {
            const oppStatus = (opp.opp_status || '').toLowerCase();
            const currentStatus = (opp.status || '').toLowerCase();
            const decision = (opp.decision || '').toLowerCase();
            
            // Check if the opportunity matches any of the selected status filters
            const matchesAnyStatus = filters.status.some(status => {
                const statusLower = status.toLowerCase();
                
                // Map filter button values to actual data values
                switch (statusLower) {
                    case 'op100':
                        return oppStatus === 'op100';
                    case 'op90':
                        return oppStatus === 'op90';
                    case 'op60':
                        return oppStatus === 'op60';
                    case 'op30':
                        return oppStatus === 'op30';
                    case 'submitted':
                        return oppStatus === 'op30' || oppStatus === 'op60';
                    case 'ongoing':
                        return currentStatus === 'on-going';
                    case 'not_yet_started':
                        return currentStatus === 'not yet started';
                    case 'no_decision':
                        return decision !== 'go' && decision !== 'decline';
                    case 'lost':
                        return oppStatus === 'lost' || decision === 'lost';
                    case 'declined':
                        return decision === 'decline';
                    case 'inactive':
                        return oppStatus === 'inactive';
                    default:
                        return false;
                }
            });
            
            if (!matchesAnyStatus) return false;
        }

        // Solutions filter
        if (filters.solutions && filters.solutions !== 'all' && opp.solutions !== filters.solutions) {
            return false;
        }

        // Account Manager filter
        if (filters.accountMgr && filters.accountMgr !== 'all' && opp.account_mgr !== filters.accountMgr) {
            return false;
        }

        // PIC filter - only apply if not ignored
        if (!ignorePicFilter && filters.pic && filters.pic !== 'all' && opp.pic !== filters.pic) {
            return false;
        }

        return true;
    });

    return filteredData;
}

function updateRowCount(filteredData = null) {
    const rowCountElement = document.getElementById('rowCount');
    if (!rowCountElement) {
        // Row count element not found
        return;
    }
    
    // If filteredData is provided, use it; otherwise count visible rows in table body
    let actualCount;
    if (filteredData) {
        actualCount = filteredData.length;
    } else {
        const visibleRows = tableBody.querySelectorAll('tr').length;
        // Don't count the "No data available" row
        actualCount = (visibleRows === 1 && tableBody.querySelector('tr td[colspan]')) ? 0 : visibleRows;
    }
    
    // Update the row count element with the count and total
    const totalCount = opportunities.length;
    const activeFilters = getActiveFiltersDescription();
    const filterText = activeFilters ? ` (${activeFilters})` : '';
    rowCountElement.textContent = `Showing ${actualCount} of ${totalCount} opportunities${filterText}`;
    
    // Add debug logging
    // Row count updated
}

function getDefaultColumnWidth(header) {
    // Customize widths for specific columns based on content vs header length
    const normHeader = (header || '').toLowerCase();
    
    // Wide columns for content-heavy fields
    if (normHeader.includes('project') && normHeader.includes('name')) return '200px';
    if (normHeader.includes('client')) return '160px';
    if (normHeader.includes('remarks') || normHeader.includes('comment')) return '180px';
    
    // Ultra-compact columns based on actual data content
    if (normHeader.includes('revision') || normHeader.includes('rev')) return '50px'; // REV: 1-2 digits + center align
    if (normHeader.includes('account') && (normHeader.includes('manager') || normHeader.includes('mgr'))) return '50px'; // MGR: 3 chars + center align
    if (normHeader.includes('pic')) return '50px'; // PIC: 3 chars + center align
    if (normHeader.includes('bom')) return '50px'; // BOM: 3 chars + center align
    if (normHeader.includes('margin')) return '70px'; // MARGIN: percentage + center align
    if (normHeader.includes('opp') && normHeader.includes('status')) return '50px'; // OP: OP30, OP60, OP90, OP100 + center align
    if (normHeader.includes('submitted') && normHeader.includes('date')) return '70px'; // SUBMTD: date format
    if (normHeader.includes('awarded') && normHeader.includes('date')) return '55px'; // AWD: ultra-compact for date
    if (normHeader.includes('project') && normHeader.includes('code')) return '70px'; // Project Code - typically short codes
    if (normHeader.includes('encoded') && normHeader.includes('date')) return '85px'; // Encoded Date - date format
    
    // Medium columns for other standard fields
    if (normHeader.includes('code') && !normHeader.includes('project')) return '100px';
    if (normHeader.includes('amount') || normHeader.includes('amt')) return '110px';
    if (normHeader.includes('manager') || normHeader.includes('account_mgr')) return '120px'; // Fallback for other managers
    if (normHeader.includes('solution') && !normHeader.includes('particular')) return '100px';
    if (normHeader.includes('industry') && !normHeader.includes('particular')) return '100px';
    
    // Narrow columns for short content
    if (normHeader.includes('date')) return '100px';
    if (normHeader.includes('status') && !normHeader.includes('opp')) return '90px';
    if (normHeader.includes('pic')) return '80px';
    if (normHeader.includes('bom')) return '80px';
    if (normHeader.includes('margin')) return '80px';
    if (normHeader.includes('decision')) return '90px';
    if (normHeader.includes('submitted')) return '90px';
    
    // Very narrow for single letters (ACRUD fields)
    if (normHeader.length === 1) return '50px';
    
    // Default width for other fields
    return '100px';
}

// --- Column Resize Functionality ---
function setupColumnResize(th, header) {
    // Remove any existing resize handle
    const existingHandle = th.querySelector('.column-resize-handle');
    if (existingHandle) {
        existingHandle.remove();
    }
    
    // Create a dedicated resize handle element
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'column-resize-handle';
    
    // Position the th relatively to allow absolute positioning of the handle
    th.style.position = 'relative';
    th.appendChild(resizeHandle);
    
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;
    let resizeLine = null;
    
    // Handle resize initiation
    resizeHandle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        isDragging = true;
        startX = e.clientX;
        startWidth = parseInt(window.getComputedStyle(th).width, 10);
        
        // Add visual feedback
        th.classList.add('resizing');
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.classList.add('resizing');
        }
        
        // Create resize line
        resizeLine = document.createElement('div');
        resizeLine.className = 'resize-line';
        resizeLine.style.cssText = `
            position: fixed;
            top: 0;
            left: ${e.clientX}px;
            width: 2px;
            height: 100vh;
            background-color: var(--border-focus);
            z-index: 1000;
            pointer-events: none;
            opacity: 0.7;
        `;
        document.body.appendChild(resizeLine);
        
        // Prevent text selection
        document.body.style.userSelect = 'none';
        
        // Add global listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
    
    function handleMouseMove(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(20, startWidth + deltaX); // Minimum width of 20px to allow very narrow columns
        
        // Update resize line position
        if (resizeLine) {
            resizeLine.style.left = e.clientX + 'px';
        }
        
        // Update column width with more aggressive styling
        th.style.setProperty('width', newWidth + 'px', 'important');
        th.style.setProperty('min-width', newWidth + 'px', 'important');
        th.style.setProperty('max-width', newWidth + 'px', 'important');
        
        // Update corresponding body cells
        updateColumnWidthInTable(header, newWidth + 'px');
    }
    
    function handleMouseUp(e) {
        if (!isDragging) return;
        
        isDragging = false;
        
        // Clean up visual indicators
        if (resizeLine && resizeLine.parentNode) {
            resizeLine.parentNode.removeChild(resizeLine);
            resizeLine = null;
        }
        
        th.classList.remove('resizing');
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.classList.remove('resizing');
        }
        
        // Restore text selection
        document.body.style.userSelect = '';
        
        // Save column width
        const finalWidth = th.style.width;
        columnWidths[header] = finalWidth;
        saveColumnWidthsToStorage();
        
        
        // Remove global listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Set flag to prevent accidental sorting
        justFinishedResize = true;
        setTimeout(() => {
            justFinishedResize = false;
        }, 100); // Reset after 100ms
    }
    
    // Handle double-click for auto-resize
    resizeHandle.addEventListener('dblclick', function(e) {
        e.preventDefault();
        e.stopPropagation();
        autoResizeColumn(th, header);
    });
    
    // Prevent other events from interfering
    resizeHandle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
}

function autoResizeColumn(th, header) {
    const optimalWidth = calculateOptimalColumnWidth(header);
    
    
    // Apply the new width with aggressive styling
    th.style.setProperty('width', optimalWidth + 'px', 'important');
    th.style.setProperty('min-width', optimalWidth + 'px', 'important');
    th.style.setProperty('max-width', optimalWidth + 'px', 'important');
    
    // Update corresponding body cells
    updateColumnWidthInTable(header, optimalWidth + 'px');
    
    // Save the new width
    columnWidths[header] = optimalWidth + 'px';
    saveColumnWidthsToStorage();
    
    // Save to user preferences
    saveUserPreferences();
    
    // Set flag to prevent accidental sorting
    justFinishedResize = true;
    setTimeout(() => {
        justFinishedResize = false;
    }, 100); // Reset after 100ms
}

function calculateOptimalColumnWidth(header) {
    
    // Create temporary element that matches table styling
    const measureDiv = document.createElement('div');
    measureDiv.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        visibility: hidden;
        white-space: nowrap;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        padding: 8px 12px;
        border: 1px solid transparent;
    `;
    document.body.appendChild(measureDiv);
    
    let maxWidth = 0;
    
    // Measure header text width
    const headerText = formatHeaderText(header);
    console.log(`Formatted header text: "${headerText}"`);
    measureDiv.textContent = headerText;
    measureDiv.style.fontWeight = '600'; // Headers are semi-bold
    const headerWidth = measureDiv.offsetWidth;
    maxWidth = Math.max(maxWidth, headerWidth);
    console.log(`Header width measured: ${headerWidth}px, maxWidth now: ${maxWidth}px`);
    
    // Get the column index
    const headerRow = document.querySelector('.table-container thead tr');
    if (!headerRow) {
        console.log('ERROR: No header row found!');
        document.body.removeChild(measureDiv);
        return 80; // fallback
    }
    
    console.log(`Found header row:`, headerRow);
    
    const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent.trim());
    console.log(`All headers found:`, headers);
    console.log(`Looking for formatted header: "${formatHeaderText(header)}"`);
    // Remove sorting indicators (↕) from headers for comparison
    const cleanHeaders = headers.map(h => h.replace(/\s*↕\s*$/, '').trim());
    const columnIndex = cleanHeaders.findIndex(h => h === formatHeaderText(header));
    console.log(`Column index found: ${columnIndex}`);
    
    if (columnIndex === -1) {
        console.log('ERROR: Column not found in headers!');
        document.body.removeChild(measureDiv);
        return 80; // fallback
    }
    
    // Reset font weight for body content
    measureDiv.style.fontWeight = 'normal';
    
    // Measure content width in visible rows (sample more rows for better accuracy)
    const tableBody = document.querySelector('.table-container tbody');
    if (tableBody) {
        const rows = Array.from(tableBody.querySelectorAll('tr:not(.no-results)'));
        const sampleSize = Math.min(50, rows.length); // Increased sample size
        console.log(`Found ${rows.length} data rows, sampling ${sampleSize} rows`);
        
        for (let i = 0; i < sampleSize; i++) {
            const row = rows[i];
            const cell = row.children[columnIndex];
            if (cell) {
                const cellText = cell.textContent.trim();
                if (cellText) {
                    measureDiv.textContent = cellText;
                    const cellWidth = measureDiv.offsetWidth;
                    maxWidth = Math.max(maxWidth, cellWidth);
                }
            }
        }
    }
    
    // Clean up
    document.body.removeChild(measureDiv);
    
    // Column-specific optimizations for better sizing
    const normalizedHeader = header.toLowerCase();
    let optimalWidth;
    
    if (normalizedHeader === 'project_code') {
        // Project codes are typically 8-12 characters (e.g., "BP2024-001")
        optimalWidth = Math.max(maxWidth, 110) + 15;
    } else if (normalizedHeader === 'submitted_date') {
        // Date format like "2024-08-15" needs consistent width
        optimalWidth = Math.max(maxWidth, 120) + 15;
    } else if (normalizedHeader === 'status') {
        // Status values like "Ongoing", "Pending", "Awarded", "Lost"
        optimalWidth = Math.max(maxWidth, 85) + 15;
    } else if (normalizedHeader === 'opp_status' || normalizedHeader === 'opportunity_status') {
        // OP status like "OP30", "OP60", "OP100"
        optimalWidth = Math.max(maxWidth, 60) + 15;
    } else {
        // Default calculation for other columns
        optimalWidth = Math.ceil(maxWidth + 20);
    }
    
    // Set reasonable absolute limits
    const minWidth = 30;  // Allow narrow columns
    const maxWidthLimit = 400; // Prevent extremely wide columns
    
    optimalWidth = Math.max(minWidth, Math.min(maxWidthLimit, optimalWidth));
    return optimalWidth;
}


function handleColumnResize(e) {
    if (!isResizing || !resizingColumn) {
        console.log('Not resizing or no resizing column');
        return;
    }
    
    e.preventDefault();
    
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(50, Math.min(500, startWidth + deltaX)); // Constrain width
    
    console.log('Delta X:', deltaX, 'New width:', newWidth);
    
    // Update the visual resize line
    const resizeLine = document.querySelector('.resize-line');
    if (resizeLine) {
        resizeLine.style.left = e.clientX + 'px';
    }
    
    // Update column width immediately
    resizingColumn.th.style.width = newWidth + 'px';
    resizingColumn.th.style.minWidth = newWidth + 'px';
    
    // Update corresponding body cells
    updateColumnWidthInTable(resizingColumn.header, newWidth + 'px');
}

function stopColumnResize(e) {
    console.log('Stopping column resize');
    
    if (!isResizing) return;
    
    // Clean up resize line
    const resizeLine = document.querySelector('.resize-line');
    if (resizeLine && resizeLine.parentNode) {
        resizeLine.parentNode.removeChild(resizeLine);
    }
    
    // Restore text selection
    document.body.style.userSelect = '';
    
    if (resizingColumn) {
        const finalWidth = resizingColumn.th.style.width;
        console.log('Final width:', finalWidth);
        
        // Save the new width
        columnWidths[resizingColumn.header] = finalWidth;
        saveColumnWidthsToStorage();
        
        // Save to user preferences
        saveUserPreferences();
        
        // Remove resizing classes
        resizingColumn.th.classList.remove('resizing');
        
        // Clear any resize handle classes
        const resizeHandle = resizingColumn.th.querySelector('.column-resize-handle');
        if (resizeHandle) {
            resizeHandle.classList.remove('resizing');
        }
    }
    
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) {
        tableContainer.classList.remove('resizing');
    }
    
    // Remove global event listeners (handleColumnResize will be removed automatically due to {once: true})
    document.removeEventListener('mousemove', handleColumnResize);
    
    // Reset resize state with a small delay to prevent any pending click events from triggering sort
    setTimeout(() => {
        isResizing = false;
        resizingColumn = null;
    }, 10);
}

function updateColumnWidthInTable(header, width) {
    // Update all cells in this column
    const table = document.getElementById('opportunitiesTable');
    if (!table) {
        // Table not found
        return;
    }
    
    // Find the column index for this header among visible columns
    const headerCells = table.querySelectorAll('thead th');
    let columnIndex = -1;
    
    headerCells.forEach((th, index) => {
        if (th.dataset.field === header) {
            columnIndex = index;
        }
    });
    
    // Column index found
    
    if (columnIndex === -1) {
        // Column index not found
        return;
    }
    
    // Update all body cells in this column
    const bodyCells = table.querySelectorAll(`tbody tr td:nth-child(${columnIndex + 1})`);
    // Found body cells to update
    
    bodyCells.forEach(td => {
        td.style.setProperty('width', width, 'important');
        td.style.setProperty('min-width', width, 'important');
        td.style.setProperty('max-width', width, 'important');
    });
}

function saveColumnWidthsToStorage() {
    try {
        localStorage.setItem('columnWidths', JSON.stringify(columnWidths));
    } catch (error) {
        // Could not save column widths
    }
}

function reapplyColumnWidths() {
    // Force reapplication of saved column widths after table operations
    const headerCells = document.querySelectorAll('.table-container thead th[data-field]');
    headerCells.forEach(th => {
        const header = th.dataset.field;
        const savedWidth = columnWidths[header];
        if (savedWidth) {
            // Use the same aggressive styling approach as the manual resize
            th.style.setProperty('width', savedWidth, 'important');
            th.style.setProperty('min-width', savedWidth, 'important');
            th.style.setProperty('max-width', savedWidth, 'important');
        }
    });
}

// === USER PREFERENCES SYSTEM ===

function getCurrentUserId() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) return null;
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id || payload.sub || null;
    } catch (error) {
        return null;
    }
}

async function saveUserPreferences() {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    try {
        // Only update filters if DOM elements are available to avoid overwriting with empty data
        const currentFilters = getActiveFilters();
        if (statusFilterButtonsContainer && accountMgrFilterDropdown && picFilterDropdown && searchInput) {
            userPreferences.filters = currentFilters;
            console.log('💾 [INDEX-DEBUG] Updated filters from DOM:', currentFilters);
        } else {
            console.log('💾 [INDEX-DEBUG] DOM elements not available, preserving existing filter preferences');
        }
        
        userPreferences.sorting = {
            columnIndex: currentSortColumnIndex,
            direction: currentSortDirection
        };
        userPreferences.columnWidths = { ...columnWidths };
        userPreferences.columnVisibility = { ...columnVisibility };
        userPreferences.tableSettings.oppStatusColorEnabled = oppStatusColorsEnabled;
        userPreferences.hasLoadedBefore = true; // Mark that user has used the system
        
        console.log('💾 [INDEX-DEBUG] ===== SAVING USER PREFERENCES =====');
        console.log('💾 [INDEX-DEBUG] User ID:', userId);
        console.log('💾 [INDEX-DEBUG] Current filters:', userPreferences.filters);
        console.log('💾 [INDEX-DEBUG] Current sorting:', userPreferences.sorting);
        console.log('💾 [INDEX-DEBUG] oppStatusColorsEnabled:', oppStatusColorsEnabled);
        console.log('💾 [INDEX-DEBUG] Column visibility count:', Object.keys(userPreferences.columnVisibility).length);
        console.log('💾 [INDEX-DEBUG] Column widths count:', Object.keys(userPreferences.columnWidths).length);
        
        // Save to localStorage with user ID
        const prefKey = `userPreferences_${userId}`;
        localStorage.setItem(prefKey, JSON.stringify(userPreferences));
        console.log('💾 [INDEX-DEBUG] Saved to localStorage with key:', prefKey);
        console.log('💾 [INDEX-DEBUG] ===== PREFERENCES SAVE COMPLETED =====');
        
        // Also try to save to server if available
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const response = await fetch(getApiUrl('/api/user-preferences'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        preferences: userPreferences,
                        category: 'opportunities'
                    })
                });
                
                if (!response.ok) {
                    // Server save failed, but localStorage backup is available
                }
            } catch (serverError) {
                // Server not available, localStorage backup sufficient
            }
        }
    } catch (error) {
        console.error('Failed to save user preferences:', error);
    }
}

async function loadUserPreferences() {
    console.log('📂 [INDEX-DEBUG] ===== LOADING USER PREFERENCES =====');
    const userId = getCurrentUserId();
    console.log('📂 [INDEX-DEBUG] User ID:', userId);
    if (!userId) {
        console.log('❌ [INDEX-DEBUG] No user ID found, skipping preferences load');
        return;
    }
    
    try {
        // Check localStorage first for more recent preferences
        const prefKey = `userPreferences_${userId}`;
        const localStored = localStorage.getItem(prefKey);
        let localPrefs = null;
        let useLocalStorage = false;
        
        if (localStored) {
            try {
                localPrefs = JSON.parse(localStored);
                console.log('📂 [INDEX-DEBUG] 💾 Found localStorage preferences');
                console.log('📂 [INDEX-DEBUG] 💾 Local filters:', localPrefs.filters);
                console.log('📂 [INDEX-DEBUG] 💾 Local filters.status:', localPrefs.filters?.status);
            } catch (e) {
                console.warn('📂 [INDEX-DEBUG] ❌ Failed to parse localStorage preferences');
            }
        }
        
        // Try to load from server
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                const response = await fetch(getApiUrl('/api/user-preferences?category=opportunities'), {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('📂 [INDEX-DEBUG] 🌐 Server response received:', data);
                    if (data.preferences) {
                        console.log('📂 [INDEX-DEBUG] 🌐 Server preferences found');
                        console.log('📂 [INDEX-DEBUG] 🌐 Server filters:', data.preferences.filters);
                        console.log('📂 [INDEX-DEBUG] 🌐 Server filters.status:', data.preferences.filters?.status);
                        
                        // Compare server vs local - prioritize localStorage if it has filters
                        const serverFilters = data.preferences.filters?.status || [];
                        const localFilters = localPrefs?.filters?.status || [];
                        
                        console.log('📂 [INDEX-DEBUG] 🤔 Choosing between server and local:');
                        console.log('📂 [INDEX-DEBUG] 🤔 - Server has', serverFilters.length, 'status filters');
                        console.log('📂 [INDEX-DEBUG] 🤔 - Local has', localFilters.length, 'status filters');
                        
                        if (localPrefs && localFilters.length > 0 && serverFilters.length === 0) {
                            console.log('📂 [INDEX-DEBUG] ✅ Using LOCAL preferences (has filters, server is empty)');
                            useLocalStorage = true;
                        } else {
                            console.log('📂 [INDEX-DEBUG] ✅ Using SERVER preferences');
                            userPreferences = { ...userPreferences, ...data.preferences };
                            userPreferences.hasLoadedBefore = true;
                            console.log('📂 [INDEX-DEBUG] 🌐 Final preferences after server merge:', userPreferences.filters);
                            applyUserPreferences();
                            return;
                        }
                    }
                }
            } catch (serverError) {
                console.log('📂 [INDEX-DEBUG] ❌ Server error, falling back to localStorage');
                useLocalStorage = true;
            }
        } else {
            useLocalStorage = true;
        }
        
        // Use localStorage if determined above
        if (useLocalStorage && localPrefs) {
            console.log('📂 [INDEX-DEBUG] 💾 Using localStorage preferences');
            userPreferences = { ...userPreferences, ...localPrefs };
            userPreferences.hasLoadedBefore = true;
            console.log('📂 [INDEX-DEBUG] 💾 Final preferences after local merge:', userPreferences.filters);
            applyUserPreferences();
            return;
        }
        
        // Fallback - no preferences found anywhere
        console.log('❌ [INDEX-DEBUG] No preferences found in server or localStorage');
    } catch (error) {
        console.error('Failed to load user preferences:', error);
    }
}

function applyUserPreferences() {
    console.log('🔄 [INDEX-DEBUG] ===== APPLYING USER PREFERENCES =====');
    console.log('🔄 [INDEX-DEBUG] userPreferences object:', userPreferences);
    
    // Apply column widths
    columnWidths = { ...userPreferences.columnWidths };
    console.log('🔄 [INDEX-DEBUG] Restoring column widths:', Object.keys(columnWidths).length, 'columns');
    
    // Apply column visibility
    columnVisibility = { ...userPreferences.columnVisibility };
    console.log('[PREFERENCES] Restoring column visibility:', Object.keys(columnVisibility).length, 'columns');
    
    // Apply table settings
    oppStatusColorsEnabled = userPreferences.tableSettings.oppStatusColorEnabled;
    console.log('[PREFERENCES] Restoring OP status colors enabled:', oppStatusColorsEnabled);
    
    // Apply sorting
    console.log('🔄 [INDEX-DEBUG] Checking sorting restoration...');
    console.log('🔄 [INDEX-DEBUG] userPreferences.sorting:', userPreferences.sorting);
    console.log('🔄 [INDEX-DEBUG] userPreferences.sorting.columnIndex:', userPreferences.sorting?.columnIndex);
    console.log('🔄 [INDEX-DEBUG] typeof columnIndex:', typeof userPreferences.sorting?.columnIndex);
    console.log('🔄 [INDEX-DEBUG] columnIndex === -1:', userPreferences.sorting?.columnIndex === -1);
    console.log('🔄 [INDEX-DEBUG] columnIndex !== -1:', userPreferences.sorting?.columnIndex !== -1);
    console.log('🔄 [INDEX-DEBUG] Number(columnIndex) !== -1:', Number(userPreferences.sorting?.columnIndex) !== -1);
    
    if (userPreferences.sorting && userPreferences.sorting.columnIndex !== undefined && userPreferences.sorting.columnIndex !== null && userPreferences.sorting.columnIndex !== -1) {
        console.log('🔄 [INDEX-DEBUG] ✅ Condition met - Restoring sorting - before:', {
            columnIndex: currentSortColumnIndex,
            direction: currentSortDirection
        });
        // Ensure we're dealing with numbers
        currentSortColumnIndex = Number(userPreferences.sorting.columnIndex);
        currentSortDirection = userPreferences.sorting.direction;
        console.log('🔄 [INDEX-DEBUG] ✅ Restoring sorting - after:', {
            columnIndex: currentSortColumnIndex,
            direction: currentSortDirection
        });
    } else {
        console.log('🔄 [INDEX-DEBUG] ❌ Condition NOT met - sorting not restored');
        console.log('🔄 [INDEX-DEBUG] Reason breakdown:');
        console.log('🔄 [INDEX-DEBUG] - sorting object exists?', !!userPreferences.sorting);
        console.log('🔄 [INDEX-DEBUG] - columnIndex value:', userPreferences.sorting?.columnIndex);
        console.log('🔄 [INDEX-DEBUG] - columnIndex type:', typeof userPreferences.sorting?.columnIndex);
        console.log('🔄 [INDEX-DEBUG] - columnIndex !== undefined:', userPreferences.sorting?.columnIndex !== undefined);
        console.log('🔄 [INDEX-DEBUG] - columnIndex !== null:', userPreferences.sorting?.columnIndex !== null);
        console.log('🔄 [INDEX-DEBUG] - columnIndex !== -1:', userPreferences.sorting?.columnIndex !== -1);
    }
    
    // Apply preferences immediately since we're loading before table init
    console.log('[PREFERENCES] Applying preferences immediately before table initialization');
}

function applyDOMPreferences() {
    console.log('[PREFERENCES] Applying DOM-related preferences after table initialization');
    
    // Check if table is properly initialized
    const table = document.getElementById('opportunitiesTable');
    const tableBody = table?.querySelector('tbody');
    if (!table || !tableBody) {
        console.warn('[PREFERENCES] Table not ready, deferring DOM preference application');
        setTimeout(() => applyDOMPreferences(), 100);
        return;
    }
    
    // Apply column widths to DOM
    if (Object.keys(columnWidths).length > 0) {
        reapplyColumnWidths();
        console.log('[PREFERENCES] Applied column widths to DOM');
    }
    
    // Apply filter preferences
    applyFilterPreferences();
    
    // Apply table settings preferences
    applyTableSettingsPreferences();
    
    // Apply loaded filters and sorting
    if (userPreferences.filters || userPreferences.sorting.columnIndex !== -1) {
        filterAndSortData();
        updateSortIndicators();
        console.log('[PREFERENCES] Applied filters and sorting');
    }
}

function applyFilterPreferences() {
    const prefs = userPreferences.filters;
    console.log('[PREFERENCES] Applying filter preferences:', prefs);
    
    // Safeguard: Make sure prefs exists
    if (!prefs) {
        console.log('[PREFERENCES] No filter preferences to apply');
        return;
    }
    
    // Check if essential DOM elements are available
    const searchInput = document.getElementById('searchInput');
    const statusButtons = document.querySelectorAll('.filter-button[data-filter-value]');
    const accountMgrSelect = document.getElementById('accountMgrFilter');
    const picSelect = document.getElementById('picFilter');
    
    if (!searchInput || statusButtons.length === 0 || !accountMgrSelect || !picSelect) {
        console.warn('[PREFERENCES] Essential DOM elements not ready, deferring filter preference application');
        console.warn('[PREFERENCES] Missing elements - searchInput:', !!searchInput, 'statusButtons:', statusButtons.length, 'accountMgr:', !!accountMgrSelect, 'picSelect:', !!picSelect);
        // Retry after a longer delay with more retries
        let retryCount = window.filterPreferenceRetryCount || 0;
        if (retryCount < 10) {
            window.filterPreferenceRetryCount = retryCount + 1;
            setTimeout(() => applyFilterPreferences(), 200 + (retryCount * 100));
        } else {
            console.error('[PREFERENCES] Failed to apply filter preferences after 10 retries');
        }
        return;
    }
    
    // Reset retry counter on success
    window.filterPreferenceRetryCount = 0;
    
    // Apply search filter
    if (searchInput && prefs.search) {
        searchInput.value = prefs.search;
        console.log('[PREFERENCES] Applied search filter:', prefs.search);
    }
    
    // Apply status filters
    if (prefs.status && prefs.status.length > 0) {
        const statusButtons = document.querySelectorAll('.filter-button[data-filter-value]');
        console.log('[PREFERENCES] Found', statusButtons.length, 'status buttons');
        console.log('[PREFERENCES] Restoring status filters:', prefs.status);
        
        // First, clear all active states
        statusButtons.forEach(btn => btn.classList.remove('active'));
        
        // Then apply saved filter states
        statusButtons.forEach(btn => {
            const filterValue = btn.dataset.filterValue;
            if (prefs.status.includes(filterValue)) {
                btn.classList.add('active');
                console.log('[PREFERENCES] Activated status button:', filterValue);
            }
        });
    }
    
    // Apply account manager filter
    if (accountMgrSelect && prefs.accountMgr && prefs.accountMgr !== 'all') {
        accountMgrSelect.value = prefs.accountMgr;
        console.log('[PREFERENCES] Applied account manager filter:', prefs.accountMgr);
    }
    
    // Apply PIC filter
    if (picSelect && prefs.pic && prefs.pic !== 'all') {
        picSelect.value = prefs.pic;
        console.log('[PREFERENCES] Applied PIC filter:', prefs.pic);
    }
    
    // Apply solutions filter
    const solutionsSelect = document.getElementById('solutionsFilter');
    if (solutionsSelect && prefs.solutions && prefs.solutions !== 'all') {
        solutionsSelect.value = prefs.solutions;
        console.log('[PREFERENCES] Applied solutions filter:', prefs.solutions);
    }
    
    // Apply client filter
    const clientSelect = document.getElementById('clientFilter');
    if (clientSelect && prefs.client) {
        clientSelect.value = prefs.client;
    }
}

function applyTableSettingsPreferences() {
    console.log('[PREFERENCES] Applying table settings preferences');
    
    // Apply OPP Status color toggle
    const oppStatusToggle = document.getElementById('oppStatusColorToggle');
    console.log('[PREFERENCES] applyTableSettingsPreferences called, toggle element:', oppStatusToggle ? 'found' : 'not found');
    console.log('[PREFERENCES] userPreferences.tableSettings:', userPreferences.tableSettings);
    console.log('[PREFERENCES] oppStatusColorsEnabled from preferences:', userPreferences.tableSettings?.oppStatusColorEnabled);
    
    if (oppStatusToggle) {
        // Update the global variable - handle undefined gracefully
        oppStatusColorsEnabled = userPreferences.tableSettings?.oppStatusColorEnabled || false;
        console.log('[PREFERENCES] Setting oppStatusColorsEnabled to:', oppStatusColorsEnabled);
        
        // Update button appearance and text to match saved preference
        if (oppStatusColorsEnabled) {
            oppStatusToggle.classList.add('active');
            oppStatusToggle.innerHTML = '<span class="material-icons" style="font-size: 1rem;">palette</span>On';
            console.log('[PREFERENCES] Button set to ON state');
        } else {
            oppStatusToggle.classList.remove('active');
            oppStatusToggle.innerHTML = '<span class="material-icons" style="font-size: 1rem;">palette</span>Off';
            console.log('[PREFERENCES] Button set to OFF state');
        }
        
        // Apply color coding to current table if enabled
        if (oppStatusColorsEnabled) {
            applyOppStatusColorCoding();
            console.log('[PREFERENCES] Applied color coding to table');
        }
    } else {
        console.warn('[PREFERENCES] oppStatusColorToggle button not found in DOM');
        // Retry finding the toggle button
        let retryCount = window.toggleRetryCount || 0;
        if (retryCount < 5) {
            window.toggleRetryCount = retryCount + 1;
            console.log('[PREFERENCES] Retrying toggle application, attempt:', retryCount + 1);
            setTimeout(() => applyTableSettingsPreferences(), 300 + (retryCount * 200));
        } else {
            console.error('[PREFERENCES] Failed to find OPP Status toggle after 5 retries');
        }
    }
}

// Diagnostic function to check preference system status
function debugPreferences() {
    console.log('🔍 [PREFERENCES-DEBUG] ===== DIAGNOSTIC REPORT =====');
    
    const userId = getCurrentUserId();
    console.log('User ID:', userId);
    
    // Check localStorage
    const prefKey = `userPreferences_${userId}`;
    const stored = localStorage.getItem(prefKey);
    console.log('Stored preferences exist:', !!stored);
    if (stored) {
        try {
            const prefs = JSON.parse(stored);
            console.log('Stored preferences:', prefs);
        } catch (e) {
            console.error('Error parsing stored preferences:', e);
        }
    }
    
    // Check current state
    console.log('Current userPreferences object:', userPreferences);
    console.log('Current oppStatusColorsEnabled:', oppStatusColorsEnabled);
    
    // Check DOM elements
    const statusButtons = document.querySelectorAll('.filter-button[data-filter-value]');
    const oppToggle = document.getElementById('oppStatusColorToggle');
    const searchInput = document.getElementById('searchInput');
    const accountMgrSelect = document.getElementById('accountMgrFilter');
    const picSelect = document.getElementById('picFilter');
    
    console.log('DOM Elements:');
    console.log('- Status buttons found:', statusButtons.length);
    console.log('- OPP Status toggle found:', !!oppToggle);
    console.log('- Search input found:', !!searchInput);
    console.log('- Account Mgr select found:', !!accountMgrSelect);
    console.log('- PIC select found:', !!picSelect);
    
    // Check active filters
    if (statusButtons.length > 0) {
        console.log('Active filter buttons:');
        statusButtons.forEach(btn => {
            if (btn.classList.contains('active')) {
                console.log(`- ${btn.dataset.filterValue}: ACTIVE`);
            }
        });
    }
    
    // Check toggle state
    if (oppToggle) {
        console.log('OPP Status Toggle:');
        console.log('- Has active class:', oppToggle.classList.contains('active'));
        console.log('- Button text:', oppToggle.textContent.trim());
    }
    
    console.log('🔍 [PREFERENCES-DEBUG] ===== END DIAGNOSTIC =====');
}

// Make it globally available for console debugging
window.debugPreferences = debugPreferences;

function loadColumnWidthsFromStorage() {
    try {
        // First try to load from user preferences
        const userId = getCurrentUserId();
        if (userId) {
            const prefKey = `userPreferences_${userId}`;
            const userPrefs = localStorage.getItem(prefKey);
            if (userPrefs) {
                const prefs = JSON.parse(userPrefs);
                if (prefs.columnWidths && Object.keys(prefs.columnWidths).length > 0) {
                    columnWidths = { ...prefs.columnWidths };
                    console.log('[COLUMN-WIDTHS] Loaded from user preferences:', Object.keys(columnWidths).length, 'columns');
                    return;
                }
            }
        }
        
        // Fallback to legacy localStorage
        const saved = localStorage.getItem('columnWidths');
        if (saved) {
            columnWidths = JSON.parse(saved);
            console.log('[COLUMN-WIDTHS] Loaded from legacy localStorage:', Object.keys(columnWidths).length, 'columns');
        }
    } catch (error) {
        // Could not load column widths
        columnWidths = {};
        console.log('[COLUMN-WIDTHS] Could not load column widths, starting fresh');
    }
}

// --- Cell Editing Functions ---
// Updated to use Proposal Story instead of simple remarks
function showRemarksModal(currentValue, header, uid, td) {
    // Find the opportunity data for this UID
    const opportunityData = opportunities.find(opp => opp.uid === uid);
    
    // Use the new proposal story modal instead of the old remarks modal
    if (typeof showProposalStory === 'function') {
        showProposalStory(uid, opportunityData);
    } else if (typeof window.showProposalStory === 'function') {
        window.showProposalStory(uid, opportunityData);
    } else {
        console.error('[App] Proposal story function not available, waiting...');
        
        // Try again after a short delay to allow scripts to load
        setTimeout(() => {
            if (typeof showProposalStory === 'function') {
                showProposalStory(uid, opportunityData);
            } else if (typeof window.showProposalStory === 'function') {
                window.showProposalStory(uid, opportunityData);
            } else {
                console.error('[App] Proposal story function still not available');
                alert('Proposal story feature is loading. Please refresh the page and try again.');
            }
        }, 1000);
    }
}

function makeEditable(td, originalFullRow, header, originalIndex) {
    const normHeader = normalizeField(header);
    // Don't make certain columns editable
    const nonEditableColumns = ['uid', 'encodeddate', 'google_drive_folder_id', 'google_drive_folder_url', 'google_drive_folder_name', 'drive_folder_created_at', 'drive_folder_created_by'];
    if (nonEditableColumns.includes(normHeader) || nonEditableColumns.includes(header)) return;

    td.classList.add('editable-cell');
    td.title = "Double-click to edit";

    td.addEventListener('dblclick', function(e) {
        if (td.querySelector('input, select, textarea')) return; // Already editing

        const currentValue = originalFullRow[header] ?? '';

        // Special handling for remarks_comments
        if (normHeader === 'remarkscomments') {
            showRemarksModal(currentValue, header, originalFullRow.uid, td);
            return;
        }

        // Regular inline editing for other fields
        const input = createEditInput(normHeader, currentValue);

        // --- Fixed: Constrained inline editor styling ---
        input.style.background = getComputedStyle(document.body).getPropertyValue('--bg-modal') || '#fff';
        input.style.color = getComputedStyle(document.body).getPropertyValue('--text-body') || '#222';
        input.style.border = '2px solid #4f46e5';
        input.style.outline = 'none';
        input.style.fontFamily = 'inherit';
        input.style.fontSize = 'inherit';
        input.style.padding = '4px 8px';
        input.style.borderRadius = '4px';
        input.style.boxSizing = 'border-box';
        input.style.zIndex = 1000;
        
        // Set cell to relative positioning to contain the input
        td.style.position = 'relative';
        td.style.overflow = 'visible';
        
        if (input.tagName === 'SELECT') {
            input.style.position = 'relative';
            input.style.width = '100%';
            input.style.minWidth = '120px';
            input.style.maxWidth = '200px';
            input.style.height = 'auto';
        } else {
            // For text inputs, constrain to cell dimensions
            const cellRect = td.getBoundingClientRect();
            input.style.position = 'absolute';
            input.style.left = '0';
            input.style.top = '0';
            input.style.width = `${cellRect.width - 4}px`; // Account for border
            input.style.height = `${cellRect.height - 4}px`; // Account for border
            input.style.minWidth = '80px';
            input.style.maxWidth = '300px';
        }

        // Store original content
        const originalContent = td.innerHTML;
        td.innerHTML = '';
        td.appendChild(input);
        input.focus();

        // Enhanced dropdown behavior
        if (input.tagName === 'SELECT') {
            // Add smooth opening animation
            input.style.opacity = '0';
            input.style.transform = 'scale(0.95)';
            setTimeout(() => {
                input.style.opacity = '1';
                input.style.transform = 'scale(1)';
            }, 10);
            
            // Auto-open dropdown on focus for better UX
            input.addEventListener('focus', () => {
                // Try to open dropdown programmatically (browser dependent)
                if (input.showPicker) {
                    try {
                        input.showPicker();
                    } catch(e) {
                        // Fallback for browsers that don't support showPicker
                        input.click();
                    }
                }
            });
            
            // Add keyboard navigation hints
            input.title = 'Use arrow keys to navigate options, Enter to select, Escape to cancel';
            
            // Add keyboard event handler for better UX
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    // Cancel editing and restore original content
                    td.innerHTML = originalContent;
                    e.preventDefault();
                    e.stopPropagation();
                } else if (e.key === 'Enter') {
                    // Trigger save on Enter key
                    input.blur();
                    e.preventDefault();
                }
            });
        }

        let isProcessingSave = false;
        let saveOnBlur = async () => {
            if (isProcessingSave) return;
            let value = input.value;
            if (input.tagName === 'SELECT') value = input.options[input.selectedIndex].value;
            // Only save if value actually changed
            if (value === currentValue) {
                td.innerHTML = originalContent;
                return;
            }
            isProcessingSave = true;
            await saveEdit(value, header, originalFullRow.uid);
            td.innerHTML = formatCellValue(value, header);
            isProcessingSave = false;
        };

        // Save on Enter, Cancel on ESC
        input.addEventListener('keydown', async function(e) {
            if (e.key === 'Enter' && !isProcessingSave) {
                e.preventDefault();
                await saveOnBlur();
            } else if (e.key === 'Escape') {
                td.innerHTML = originalContent;
            }
        });

        // Save on blur for all input types
        input.addEventListener('blur', function() {
            setTimeout(async () => {
                if (td.contains(input)) {
                    await saveOnBlur();
                }
            }, 100);
        });

        // For select, also save on change
        if (input.tagName === 'SELECT' || input.type === 'date') {
            input.addEventListener('change', async function() {
                await saveOnBlur();
            });
        }
    });
}

function createEditInput(normHeader, currentValue) {
    let input;
    
    if (DROPDOWN_FIELDS_NORM.includes(normHeader)) {
        input = document.createElement('select');
        input.className = 'inline-edit-dropdown'; // Apply custom styling
        const options = dropdownOptions[normHeader] || [];
        // Add default empty option for better UX
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Select --';
        input.appendChild(defaultOpt);
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            if (option === currentValue) {
                opt.selected = true;
            }
            input.appendChild(opt);
        });
    } else if (normHeader === 'remarkscomments') {
        input = document.createElement('textarea');
        input.value = currentValue || '';
        input.style.minHeight = '200px';
        input.style.width = '100%';
        input.style.padding = '0.5rem';
        input.style.marginTop = '0.5rem';
        input.style.marginBottom = '0.5rem';
        input.style.fontFamily = 'inherit';
        input.style.borderRadius = '4px';
        input.style.border = '1px solid var(--border-color)';
    } else if (isDateField(normHeader)) {
        input = document.createElement('input');
        input.type = 'date';
        input.className = 'w-full p-2 border rounded mt-1 text-sm';
        input.value = currentValue || '';
    } else {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'w-full p-2 border rounded mt-1 text-sm';
        input.value = currentValue || '';
    }
    
    return input;
}

async function saveEdit(newValue, header, uid) {
    try {
        const token = getAuthToken();
        if (!token) {
            throw new Error('No authentication token found. Please log in again.');
        }

        // Prepare update data with changed_by
        const updateData = {
            [header]: newValue,
            changed_by: getCurrentUserName()
        };
        
        const response = await fetch(getApiUrl(`/api/opportunities/${encodeURIComponent(uid)}`), {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const err = await response.json();
            let errorMessage = err.message || err.error || response.statusText;
            if (err.details) {
                // Detailed error info
                errorMessage += '\n\nDetails: ' + err.details;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        
        // Update local data
        const index = opportunities.findIndex(opp => opp.uid === uid);
        if (index !== -1) {
            opportunities[index][header] = newValue;
            
            // If the server returned updated data, use that to ensure consistency
            if (result.data) {
                Object.assign(opportunities[index], result.data);
            }
            
            // FIXED: Refresh dashboard cards with global data after successful save
            loadDashboardData(opportunities);
            // Do NOT update the DOM cell here; let makeEditable handle it
        }
        
        return result;
        
    } catch (error) {
        // Error saving edit
        alert(`Error saving: ${error.message}`);
        throw error; // Re-throw to let makeEditable handle the revert
    }
}

// Setup project code duplicate validation
function setupProjectCodeValidation() {
    const projectCodeInput = document.getElementById('newProjectCode');
    if (!projectCodeInput) {
        console.warn('⚠️ Project code input field not found');
        return;
    }
    
    let validationTimeout;
    
    projectCodeInput.addEventListener('input', function() {
        const projectCode = this.value.trim();
        
        // Clear previous validation timeout
        clearTimeout(validationTimeout);
        
        // Clear previous validation messages
        clearValidationMessage(this);
        
        if (projectCode.length === 0) {
            return; // Don't validate empty input
        }
        
        // Debounce validation by 500ms
        validationTimeout = setTimeout(async () => {
            await validateProjectCodeDuplicate(this, projectCode);
        }, 500);
    });
    
    console.log('✅ Project code duplicate validation listener added');
}

// Validate project code for duplicates
async function validateProjectCodeDuplicate(inputElement, projectCode) {
    try {
        // Check local opportunities data first (faster)
        const localDuplicate = opportunities.find(opp => 
            opp.project_code && opp.project_code.toLowerCase() === projectCode.toLowerCase()
        );
        
        if (localDuplicate) {
            showValidationError(inputElement, `Project code "${projectCode}" already exists`);
            return false;
        }
        
        // If not found locally, check server
        const response = await fetch(getApiUrl(`/api/opportunities/check-project-code?code=${encodeURIComponent(projectCode)}`), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.exists) {
                showValidationError(inputElement, `Project code "${projectCode}" already exists`);
                return false;
            } else {
                showValidationSuccess(inputElement, 'Project code is available');
                return true;
            }
        }
    } catch (error) {
        console.warn('❌ Error validating project code:', error.message);
        // Don't show error to user for validation failures
    }
    
    return true; // Default to valid if validation fails
}

// Show validation error message
function showValidationError(inputElement, message) {
    clearValidationMessage(inputElement);
    
    inputElement.classList.add('validation-error');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'validation-message validation-error-msg';
    errorDiv.textContent = message;
    
    inputElement.parentNode.appendChild(errorDiv);
}

// Show validation success message
function showValidationSuccess(inputElement, message) {
    clearValidationMessage(inputElement);
    
    inputElement.classList.remove('validation-error');
    inputElement.classList.add('validation-success');
    
    const successDiv = document.createElement('div');
    successDiv.className = 'validation-message validation-success-msg';
    successDiv.textContent = message;
    
    inputElement.parentNode.appendChild(successDiv);
}

// Clear validation message
function clearValidationMessage(inputElement) {
    inputElement.classList.remove('validation-error', 'validation-success');
    
    const existingMessages = inputElement.parentNode.querySelectorAll('.validation-message');
    existingMessages.forEach(msg => msg.remove());
}


// Show project code loading overlay
function showProjectCodeLoading() {
    const overlay = document.getElementById('projectCodeLoadingOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

// Hide project code loading overlay
function hideProjectCodeLoading() {
    const overlay = document.getElementById('projectCodeLoadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Global function to load next project code and pre-fill it
async function loadNextProjectCode() {
    console.log('🚀 loadNextProjectCode() function called');
    
    // Show loading state
    showProjectCodeLoading();
    
    try {
        console.log('🔄 Loading next project code from server...');
        
        const response = await fetch(getApiUrl('/api/next-project-code'), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const projectCodeField = document.getElementById('newProjectCode');
            
            if (projectCodeField && data.nextProjectCode) {
                projectCodeField.value = data.nextProjectCode;
                
                // Log detailed information about the code generation
                if (data.fallbackUsed) {
                    console.log(`⚠️ Project code generated using database fallback: ${data.nextProjectCode}`);
                    if (data.warning) console.log(`Warning: ${data.warning}`);
                } else {
                    console.log(`✅ Project code generated from Google Drive scan: ${data.nextProjectCode}`);
                    console.log(`📁 Found ${data.existingCodesFound} existing codes in Google Drive`);
                    console.log(`🔢 Highest sequence for current month: ${data.highestSequence}`);
                }
            }
        } else {
            console.warn('Failed to load next project code, user will need to enter manually');
        }
    } catch (error) {
        console.warn('Error loading next project code:', error.message);
    } finally {
        // Hide loading state
        hideProjectCodeLoading();
    }
}

// Global function to show loading modal
function showLoadingModal(message = 'Creating Google Drive folder...') {
    const loadingModal = document.getElementById('loadingModal');
    const loadingModalOverlay = document.getElementById('loadingModalOverlay');
    const progressText = document.getElementById('loadingProgressText');
    
    if (progressText) progressText.textContent = message;
    if (loadingModal) loadingModal.classList.remove('hidden');
    if (loadingModalOverlay) loadingModalOverlay.classList.remove('hidden');
}

// Global function to hide loading modal
function hideLoadingModal() {
    const loadingModal = document.getElementById('loadingModal');
    const loadingModalOverlay = document.getElementById('loadingModalOverlay');
    
    if (loadingModal) loadingModal.classList.add('hidden');
    if (loadingModalOverlay) loadingModalOverlay.classList.add('hidden');
}

// Global function to close create opportunity modal
function closeCreateModal() {
    console.log('closeCreateModal called');
    const createOpportunityModal = document.getElementById('createOpportunityModal');
    const createOpportunityModalOverlay = document.getElementById('createOpportunityModalOverlay');
    const createOpportunityForm = document.getElementById('createOpportunityForm');
    
    console.log('Modal elements:', { modal: createOpportunityModal, overlay: createOpportunityModalOverlay });
    
    if (createOpportunityModal) createOpportunityModal.classList.add('hidden');
    if (createOpportunityModalOverlay) createOpportunityModalOverlay.classList.add('hidden');
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Clear any imported folder data if user cancels
    if (window.importedFolderData) {
        console.log('🧹 Clearing imported folder data on modal close');
        window.importedFolderData = null;
    }
    
    // Reset form values but keep the structure
    if (createOpportunityForm) {
        createOpportunityForm.reset();
        
        // Reset tabs to default state
        switchToCreateTab();
        resetImportTab();
        
        // Clear search results
        const searchResults = document.getElementById('createModalSearchResults');
        if (searchResults) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
        }
        
        // Reset search button
        const searchBtn = document.getElementById('searchExistingFolders');
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.innerHTML = '<span class="material-icons">search</span> Search for Existing Folders';
        }
    }
}

async function handleEditFormSubmit(e) {
    e.preventDefault();
    
    // Validate project code for duplicates before submitting (for create mode only)
    if (isCreateMode) {
        const projectCodeInput = document.getElementById('newProjectCode');
        if (projectCodeInput && projectCodeInput.value.trim()) {
            const projectCode = projectCodeInput.value.trim();
            console.log(`🔍 Validating project code "${projectCode}" before form submission...`);
            
            const isDuplicate = await validateProjectCodeDuplicate(projectCodeInput, projectCode);
            if (isDuplicate === false) {
                console.log(`❌ Project code "${projectCode}" is duplicate, stopping submission`);
                showErrorNotification(`Cannot create opportunity: Project code "${projectCode}" already exists`);
                return; // Stop submission
            } else {
                console.log(`✅ Project code "${projectCode}" is available, proceeding with submission`);
                // Clear any validation styling since it's valid
                clearValidationMessage(projectCodeInput);
            }
        }
    }
    
    // Small delay to ensure form is fully populated
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Get form data
    const formData = new FormData(e.target);
    const opportunityData = {};
    
    // Convert FormData to a regular object
    for (const [key, value] of formData.entries()) {
        // Skip fields that are only for frontend logic, not database storage
        if (key === 'drive_folder_option' || key === 'existingFolderId') {
            continue; // Don't include these in the database submission
        }
        
        // Strip commas from Final Amount fields for proper numeric processing
        if ((key === 'final_amount' || key === 'final_amt') && value) {
            opportunityData[key] = removeCommas(value);
        } else {
            opportunityData[key] = value;
        }
    }
    
    // Google Drive folder handling moved to separate import modal
    
    // Form submission data collected
    console.log('📋 Opportunity data being submitted:', Object.keys(opportunityData));
    console.log('📋 Full opportunity data:', opportunityData);
    
    try {
        // For create mode, validate all required fields and use all data
        if (isCreateMode) {
            // Automatically generate encoded_date for new opportunities
            if (!opportunityData.encoded_date) {
                const currentDate = new Date();
                opportunityData.encoded_date = currentDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                // Auto-generated encoded_date
            }
            // Remove UID so server generates new one for duplicates
            delete opportunityData.uid;
            
            // Validate all required fields for new records
            let hasError = false;
            const allInputs = e.target.querySelectorAll('input, select, textarea');
            allInputs.forEach(input => input.classList.remove('error'));
            
            // FLEXIBLE VALIDATION: Only require absolutely essential fields
            // Sales people can now save opportunities with minimal information
            const essentialFieldPatterns = [
                {
                    pattern: /project.*name|name.*project|project_name|projectname/i,
                    description: 'Project Name'
                }
                // Note: Removed status requirement - sales can fill this later
            ];
            
            // Optional fields that should be filled eventually (show warning but don't block)
            const recommendedFieldPatterns = [
                {
                    pattern: /^status$|opp.*status|opportunity.*status/i,
                    description: 'Status'
                },
                {
                    pattern: /client/i,
                    description: 'Client'
                }
            ];
            
            let hasEssentialError = false;
            let missingRecommended = [];
            
            // Check essential fields (will block save if missing)
            for (const [fieldName, value] of Object.entries(opportunityData)) {
                for (const essentialPattern of essentialFieldPatterns) {
                    if (essentialPattern.pattern.test(fieldName)) {
                        const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
                        if (isEmpty) {
                            const fieldElement = e.target.querySelector(`[name="${fieldName}"]`);
                            if (fieldElement) {
                                fieldElement.classList.add('error');
                                hasEssentialError = true;
                            }
                        }
                        break;
                    }
                }
            }
            
            // Check recommended fields (will show warning but not block save)
            for (const [fieldName, value] of Object.entries(opportunityData)) {
                for (const recommendedPattern of recommendedFieldPatterns) {
                    if (recommendedPattern.pattern.test(fieldName)) {
                        const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
                        if (isEmpty) {
                            missingRecommended.push(recommendedPattern.description);
                        }
                        break;
                    }
                }
            }
            
            // Block save only if essential fields are missing
            if (hasEssentialError) {
                alert('Please fill in the Project Name field (required).');
                return;
            }
            
            // Show warning for missing recommended fields but allow save to continue
            if (missingRecommended.length > 0) {
                const proceed = confirm(
                    `Warning: The following recommended fields are empty: ${missingRecommended.join(', ')}\n\n` +
                    `You can save now and fill these details later, or click Cancel to complete them now.\n\n` +
                    `Click OK to save anyway, or Cancel to return to the form.`
                );
                if (!proceed) {
                    return; // User chose to go back and fill the fields
                }
            }
            
            // Add metadata
            opportunityData.changed_by = getCurrentUserName();
            
            // Filter out empty string values to avoid server-side validation errors
            // Server expects either valid values or null, not empty strings
            const cleanedData = {};
            for (const [key, value] of Object.entries(opportunityData)) {
                if (value !== null && value !== undefined && value !== '') {
                    cleanedData[key] = value;
                }
            }
            
            // Data cleaned for server
            
            // Final duplicate check for project code (create mode only)
            if (isCreateMode && cleanedData.project_code) {
                console.log(`🔍 Final duplicate check for project code: ${cleanedData.project_code}`);
                const finalCheck = await fetch(getApiUrl(`/api/opportunities/check-project-code?code=${encodeURIComponent(cleanedData.project_code)}`), {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
                if (finalCheck.ok) {
                    const finalResult = await finalCheck.json();
                    if (finalResult.exists) {
                        console.log(`❌ Final check: Project code "${cleanedData.project_code}" already exists`);
                        showErrorNotification(`Cannot create opportunity: Project code "${cleanedData.project_code}" already exists`);
                        return; // Stop submission
                    }
                }
            }
            
            // Show loading modal while creating opportunity
            showLoadingModal('Creating opportunity...');
            
            const response = await fetch(getApiUrl('/api/opportunities'), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(cleanedData)
            });
            
            if (!response.ok) {
                let errorMessage = 'Failed to create opportunity';
                try {
                    const error = await response.json();
                    console.error('Server error response:', error);
                    
                    if (error.details && Array.isArray(error.details)) {
                        // Show validation errors from express-validator
                        const validationErrors = error.details.map(detail => {
                            // Special handling for project code validation errors
                            if (detail.param === 'project_code' && detail.msg.includes('already exists')) {
                                return detail.msg; // Just show the message without param prefix
                            }
                            return `${detail.param}: ${detail.msg}`;
                        }).join(', ');
                        errorMessage = `Validation error: ${validationErrors}`;
                    } else if (error.details && typeof error.details === 'string') {
                        // Single error detail from server
                        errorMessage = `Server error: ${error.details}`;
                    } else if (error.hint) {
                        // Database hint
                        errorMessage = `Database error: ${error.hint}`;
                    } else if (error.message) {
                        errorMessage = error.message;
                    } else if (error.error) {
                        errorMessage = error.error;
                    }
                } catch (e) {
                    console.error('Failed to parse error response:', e);
                    errorMessage = `Server error (${response.status}): ${response.statusText}`;
                }
                console.error('Full error details:', errorMessage);
                throw new Error(errorMessage);
            }
            
            // Add to opportunities array
            const newOpportunity = await response.json();
            opportunities.unshift(newOpportunity);
            
            // Automatic Google Drive folder linking for imported data
            if (window.importedFolderData && newOpportunity.uid) {
                console.log('🔗 Auto-linking imported Google Drive folder to new opportunity...');
                try {
                    await linkImportedFolderToOpportunity(newOpportunity.uid, window.importedFolderData);
                    
                    // Update the newly created opportunity with folder info in local array
                    const oppIndex = opportunities.findIndex(opp => opp.uid === newOpportunity.uid);
                    if (oppIndex !== -1) {
                        Object.assign(opportunities[oppIndex], {
                            google_drive_folder_id: window.importedFolderData.id,
                            google_drive_folder_url: window.importedFolderData.url,
                            google_drive_folder_name: window.importedFolderData.name
                        });
                    }
                    
                    // Clear the imported folder data after successful linking
                    window.importedFolderData = null;
                    console.log('✅ Automatic Google Drive folder linking completed');
                } catch (error) {
                    console.error('❌ Failed to auto-link Google Drive folder:', error);
                    // Don't fail the entire creation process if folder linking fails
                    showErrorNotification('Opportunity created but failed to link Google Drive folder automatically');
                }
            }
            
        } else {
            // For edit mode, only validate and submit changed fields
            const changedFields = {};
            let hasError = false;
            
            // Clear any previous error styling
            const allInputs = e.target.querySelectorAll('input, select, textarea');
            allInputs.forEach(input => input.classList.remove('error'));
            
            // Starting change detection validation
            
            // Detect which fields have actually changed
            for (const [fieldName, currentValue] of Object.entries(opportunityData)) {
                const originalValue = window.originalFormValues?.[fieldName] || '';
                const normalizedCurrent = (currentValue || '').toString().trim();
                const normalizedOriginal = (originalValue || '').toString().trim();
                
                if (normalizedCurrent !== normalizedOriginal) {
                    changedFields[fieldName] = currentValue;
                    // Field changed
                }
            }
            
            // Changed fields detected
            
            // If no fields changed, close modal without making API call
            if (Object.keys(changedFields).length === 0) {
                // No fields changed
                hideEditRowModal();
                return;
            }
            
            // FLEXIBLE VALIDATION FOR EDITS: Only validate essential fields that are being changed
            // Use same flexible approach as create mode
            const essentialFieldPatterns = [
                {
                    pattern: /project.*name|name.*project|project_name|projectname/i,
                    description: 'Project Name'
                }
                // Note: Removed status requirement - sales can clear/change this freely
            ];
            
            const recommendedFieldPatterns = [
                {
                    pattern: /^status$|opp.*status|opportunity.*status/i,
                    description: 'Status'
                },
                {
                    pattern: /client/i,
                    description: 'Client'
                }
            ];
            
            let hasEssentialError = false;
            let clearingRecommended = [];
            
            // Check if any changed essential fields are being set to empty
            for (const [changedFieldName, changedValue] of Object.entries(changedFields)) {
                for (const essentialPattern of essentialFieldPatterns) {
                    if (essentialPattern.pattern.test(changedFieldName)) {
                        // Validating essential field
                        
                        const isEmpty = !changedValue || (typeof changedValue === 'string' && changedValue.trim() === '');
                        
                        if (isEmpty) {
                            const fieldElement = e.target.querySelector(`[name="${changedFieldName}"]`);
                            if (fieldElement) {
                                fieldElement.classList.add('error');
                                hasEssentialError = true;
                                // Essential field cleared
                            }
                        } else {
                            // Essential field validation passed
                        }
                        break;
                    }
                }
                
                // Check for recommended fields being cleared (warn but don't block)
                for (const recommendedPattern of recommendedFieldPatterns) {
                    if (recommendedPattern.pattern.test(changedFieldName)) {
                        const isEmpty = !changedValue || (typeof changedValue === 'string' && changedValue.trim() === '');
                        if (isEmpty) {
                            clearingRecommended.push(recommendedPattern.description);
                        }
                        break;
                    }
                }
            }
            
            // Validation completed
            
            // Block save only if essential fields are being cleared
            if (hasEssentialError) {
                alert('Cannot clear the Project Name field (required).');
                return;
            }
            
            // Warn about clearing recommended fields but allow save to continue
            if (clearingRecommended.length > 0) {
                const proceed = confirm(
                    `Warning: You are clearing these recommended fields: ${clearingRecommended.join(', ')}\n\n` +
                    `Click OK to save anyway, or Cancel to keep the current values.`
                );
                if (!proceed) {
                    return; // User chose to keep existing values
                }
            }
            
            // Add metadata to changed fields
            const submissionData = {
                ...changedFields,
                changed_by: getCurrentUserName()
            };
            
            // Submitting changed data
            
            // Get UID for update
            const uid = opportunities[currentEditRowIndex]?.uid;
            if (!uid) {
                throw new Error('No UID found for update operation');
            }
            
            // Making PUT request
            // Request payload prepared
            
            const response = await fetch(getApiUrl(`/api/opportunities/${uid}`), {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(submissionData)
            });
            
            // Response status received
            
            if (!response.ok) {
                const error = await response.json();
                // Error response
                throw new Error(error.message || `Failed to update opportunity (${response.status})`);
            }
            
            // Update the opportunity in the array with the changed fields
            Object.assign(opportunities[currentEditRowIndex], changedFields);
        }
        
        // For create mode, refresh data from server to get auto-created Google Drive folder info
        if (isCreateMode) {
            console.log('🔄 Refreshing data to get auto-created Google Drive folder info...');
            await refreshOpportunitiesData();
        } else {
            // For edit mode, just re-render with existing data
            filterAndSortData();
        }
        
        // FIXED: Refresh dashboard cards with global data after successful update
        loadDashboardData(opportunities);
        
        // Hide loading modal first
        hideLoadingModal();
        
        // Hide the appropriate modal
        if (isCreateMode) {
            console.log('Closing create modal...');
            closeCreateModal();
        } else {
            console.log('Closing edit modal...');
            hideEditRowModal();
        }
        
        // Show success message
        alert(isCreateMode ? 'Opportunity created successfully!' : 'Opportunity updated successfully!');
    } catch (err) {
        // Hide loading modal on error
        hideLoadingModal();
        alert(`Error: ${err.message}`);
        // Error submitting form
    }
}

// --- Populate Filter Dropdowns ---
function populateFilterDropdowns() {
    // Clear existing options
    accountMgrFilterDropdown.innerHTML = '<option value="all">All</option>';
    picFilterDropdown.innerHTML = '<option value="all">All</option>';
    if (solutionsFilterDropdown) {
        solutionsFilterDropdown.innerHTML = '<option value="all">All</option>';
    }
    
    // Add options from the data
    if (dropdownOptions.accountmgr) {
        dropdownOptions.accountmgr.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            accountMgrFilterDropdown.appendChild(option);
        });
    }
    
    if (dropdownOptions.pic) {
        dropdownOptions.pic.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            picFilterDropdown.appendChild(option);
        });
    }
    
    // Add solutions filter options
    if (solutionsFilterDropdown && dropdownOptions.solutions) {
        dropdownOptions.solutions.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            solutionsFilterDropdown.appendChild(option);
        });
    }
}

// --- Helper function to abbreviate amounts ---
function abbreviateAmount(value) {
    const absValue = Math.abs(value);
    if (absValue >= 1e9) {
        return '₱' + (value / 1e9).toFixed(1) + 'B';
    }
    if (absValue >= 1e6) {
        return '₱' + (value / 1e6).toFixed(1) + 'M';
    }
    if (absValue >= 1e3) {
        return '₱' + (value / 1e3).toFixed(1) + 'K';
    }
    return '₱' + value.toFixed(2);
}

// --- Load Dashboard Data ---
async function loadDashboardData(dataToUse = null) {
    try {
        // Get current date info
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayOfMonth = now.getDate();
        
        let dashboardData = null;
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds
        
        // Function to fetch snapshot with retry logic
        async function fetchSnapshot(type) {
            while (retryCount < maxRetries) {
                try {
                    const response = await fetch(getApiUrl(window.APP_CONFIG.ENDPOINTS.SNAPSHOTS + '/' + type), {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                        }
                    });
                    
                    if (response.ok) {
                        const snapshotData = await response.json();
                        // Snapshot data fetched
                        
                        // Check if we have data in the response
                        if (snapshotData && snapshotData.data) {
                            return snapshotData.data;
                        }
                    }
                    
                    // If we get here, either response wasn't ok or data was missing
                    retryCount++;
                    if (retryCount < maxRetries) {
                        // Retry attempt
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                } catch (error) {
                    // Error fetching snapshot
                    retryCount++;
                    if (retryCount < maxRetries) {
                        // Retry attempt
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }
            return null;
        }
        
        // FIXED: Always use live data for main dashboard cards, with comparison support
        const metrics = calculateMetrics(dataToUse || opportunities);
        
        // Get current comparison mode from localStorage
        const comparisonMode = localStorage.getItem('dashboardComparisonMode') || 'none';
        // Dashboard comparison mode set
        
        // Fetch snapshot data for comparison if needed
        let snapshotData = null;
        if (comparisonMode !== 'none') {
            const snapshotType = comparisonMode === 'weekly' ? 'weekly' : 'monthly';
            snapshotData = await fetchSnapshot(snapshotType);
            // Snapshot fetched for comparison
        }
        
        // Helper function to format value with delta if comparison data exists
        function formatWithDelta(currentValue, snapshotValue, isAmount = false) {
            if (snapshotData && typeof snapshotValue === 'number' && !isNaN(snapshotValue)) {
                const delta = currentValue - snapshotValue;
                const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
                if (isAmount) {
                    return `${abbreviateAmount(currentValue)} (${deltaStr >= 0 ? '+' : ''}${abbreviateAmount(delta)})`;
                } else {
                    return `${currentValue} (${deltaStr})`;
                }
            }
            return isAmount ? abbreviateAmount(currentValue) : currentValue;
        }
        
        // Update main dashboard cards with live data and optional deltas
        if (totalOpportunities) {
            totalOpportunities.textContent = formatWithDelta(metrics.totalOpportunities, snapshotData?.total_opportunities) || '--';
        }
        if (totalSubmitted) {
            totalSubmitted.textContent = formatWithDelta(metrics.submittedCount, snapshotData?.submitted_count) || '--';
        }
        if (op100Summary) {
            const op100CountStr = formatWithDelta(metrics.op100Count, snapshotData?.op100_count);
            const op100AmountStr = formatWithDelta(metrics.op100Amount, snapshotData?.op100_amount, true);
            op100Summary.textContent = `${op100CountStr} / ${op100AmountStr}`;
        }
        if (op90Summary) {
            const op90CountStr = formatWithDelta(metrics.op90Count, snapshotData?.op90_count);
            const op90AmountStr = formatWithDelta(metrics.op90Amount, snapshotData?.op90_amount, true);
            op90Summary.textContent = `${op90CountStr} / ${op90AmountStr}`;
        }
        if (totalDeclined) {
            totalDeclined.textContent = formatWithDelta(metrics.declinedCount, snapshotData?.declined_count) || '--';
        }
        if (totalInactive) {
            totalInactive.textContent = formatWithDelta(metrics.inactiveCount, snapshotData?.inactive_count) || '--';
        }
        
        // Dashboard loaded with live data
    } catch (error) {
        // Error loading dashboard
        // Set default values on error
        if (totalOpportunities) totalOpportunities.textContent = '--';
        if (totalSubmitted) totalSubmitted.textContent = '--';
        if (op100Summary) op100Summary.textContent = '--';
        if (op90Summary) op90Summary.textContent = '--';
        if (totalDeclined) totalDeclined.textContent = '--';
        if (totalInactive) totalInactive.textContent = '--';
    }
}

// Helper function to calculate dashboard metrics from opportunities data
function calculateMetrics(data) {
    if (!data || !Array.isArray(data)) {
        return {
            totalOpportunities: 0,
            submittedCount: 0,
            op100Count: 0,
            op100Amount: 0,
            op90Count: 0,
            op90Amount: 0,
            declinedCount: 0,
            inactiveCount: 0
        };
    }
    
    const op100Opportunities = data.filter(opp => opp.opp_status?.toLowerCase() === 'op100');
    const op90Opportunities = data.filter(opp => opp.opp_status?.toLowerCase() === 'op90');
    
    return {
        totalOpportunities: data.length,
        submittedCount: data.filter(opp => opp.status?.toLowerCase() === 'submitted').length,
        op100Count: op100Opportunities.length,
        op100Amount: op100Opportunities.reduce((sum, opp) => sum + (parseCurrency(opp.final_amt) || 0), 0),
        op90Count: op90Opportunities.length,
        op90Amount: op90Opportunities.reduce((sum, opp) => sum + (parseCurrency(opp.final_amt) || 0), 0),
        declinedCount: data.filter(opp => opp.decision?.toLowerCase() === 'decline').length,
        inactiveCount: data.filter(opp => opp.opp_status?.toLowerCase() === 'inactive').length
    };
}

// --- Real-time Category Tracking ---
function updateCategoryMetrics(dataToUse = null) {
    try {
        const opportunitiesData = dataToUse || opportunities;
        
        // Calculate category metrics for each solution type
        const electrificationOpps = opportunitiesData.filter(opp => {
            const solution = (opp.solutions || '').toLowerCase();
            return solution.includes('electrification') || solution.includes('electric');
        });
        
        const automationOpps = opportunitiesData.filter(opp => {
            const solution = (opp.solutions || '').toLowerCase();
            return solution.includes('automation') || solution.includes('auto');
        });
        
        const digitalizationOpps = opportunitiesData.filter(opp => {
            const solution = (opp.solutions || '').toLowerCase();
            return solution.includes('digitalization') || solution.includes('digital') || 
                   solution.includes('digitalisation') || solution.includes('it');
        });
        
        // Calculate metrics for each category
        const electrificationMetrics = calculateCategoryMetrics(electrificationOpps);
        const automationMetrics = calculateCategoryMetrics(automationOpps);
        const digitalizationMetrics = calculateCategoryMetrics(digitalizationOpps);
        
        // Update Electrification card
        updateCategoryCard('electrification', electrificationMetrics);
        
        // Update Automation card
        updateCategoryCard('automation', automationMetrics);
        
        // Update Digitalization card
        updateCategoryCard('digitalization', digitalizationMetrics);
        
        // Category metrics updated
        console.log('Category metrics updated:', {
            electrification: electrificationMetrics,
            automation: automationMetrics,
            digitalization: digitalizationMetrics
        });
        
    } catch (error) {
        // Error updating metrics
    }
}

function calculateCategoryMetrics(categoryOpps) {
    const count = categoryOpps.length;
    const value = categoryOpps.reduce((sum, opp) => sum + (parseCurrency(opp.final_amt) || 0), 0);
    const active = categoryOpps.filter(opp => 
        opp.opp_status?.toLowerCase() === 'op100' || opp.opp_status?.toLowerCase() === 'op90'
    ).length;
    const submitted = categoryOpps.filter(opp => opp.status?.toLowerCase() === 'submitted').length;
    
    return { count, value, active, submitted };
}

function updateCategoryCard(category, metrics) {
    // Check if the category elements exist (they might not if we've removed them from index.html)
    const categoryCountElement = document.getElementById(`${category}Count`);
    if (!categoryCountElement) {
        // Elements don't exist, so don't try to update them
        return;
    }
    
    // Add visual update flash effect
    const card = categoryCountElement.closest('.category-card');
    if (card) {
        card.classList.add('update-flash');
        setTimeout(() => card.classList.remove('update-flash'), 800);
    }
    
    // Update count
    setDashboardValue(`${category}Count`, metrics.count);
    
    // Update value with abbreviated format
    setDashboardValue(`${category}Value`, abbreviateAmount(metrics.value));
    
    // Update active count
    setDashboardValue(`${category}Active`, metrics.active);
    
    // Update submitted count
    setDashboardValue(`${category}Submitted`, metrics.submitted);
}

// --- Dashboard Toggle Helper Functions ---
function setComparisonMode(mode) {
    // Setting comparison mode
    localStorage.setItem('dashboardComparisonMode', mode);
    updateToggleStates(mode);
    
    // FIXED: Dashboard cards should always show global metrics regardless of user role
    // Reload dashboard data with new comparison mode using all opportunities
    // Loading dashboard for comparison mode
    loadDashboardData(opportunities);
}

function updateToggleStates(activeMode) {
    const buttons = ['weeklyToggle', 'monthlyToggle', 'noCompareToggle'];
    
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('active');
        }
    });
    
    const activeButtonId = activeMode === 'weekly' ? 'weeklyToggle' :
                         activeMode === 'monthly' ? 'monthlyToggle' : 'noCompareToggle';
    
    const activeBtn = document.getElementById(activeButtonId);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}


// Function to apply or remove OPP Status color coding
function applyOppStatusColorCoding() {
    const table = document.getElementById('opportunitiesTable');
    if (!table) {
        // Table not found for status colors
        return;
    }
    
    // Applying OPP status colors
    
    // Find the OPP Status column index - try multiple variations
    let oppStatusColumnIndex = -1;
    const headerCells = table.querySelectorAll('thead th');
    
    headerCells.forEach((cell, index) => {
        const headerText = cell.textContent.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Processing header
        
        // Check multiple possible header names for OPP Status (including just "OP")
        if (headerText === 'oppstatus' || 
            headerText.includes('oppstatus') || 
            headerText === 'opportunitystatus' ||
            headerText.includes('opportunitystatus') ||
            headerText === 'op' || // Add check for just "OP"
            (cell.textContent.toLowerCase().includes('opp') && cell.textContent.toLowerCase().includes('status'))) {
            oppStatusColumnIndex = index;
            // Found OPP Status column
        }
    });
    
    if (oppStatusColumnIndex === -1) {
        // OPP Status column not found
        console.warn('OPP Status column not found. Headers:', 
            Array.from(headerCells).map(cell => cell.textContent));
        return; 
    }
    
    // Apply or remove color coding to entire rows
    const rows = table.querySelectorAll('tbody tr');
    // Processing table rows
    
    // Find Decision column index for declined status
    let decisionColumnIndex = -1;
    headerCells.forEach((cell, index) => {
        const headerText = cell.textContent.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (headerText === 'decision' || headerText.includes('decision')) {
            decisionColumnIndex = index;
            // Found Decision column
        }
    });
    
    rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td');
        if (cells.length > oppStatusColumnIndex) {
            const oppStatusCell = cells[oppStatusColumnIndex];
            const oppStatusValue = oppStatusCell.textContent.toLowerCase().trim();
            
            // Get decision value if available
            let decisionValue = '';
            if (decisionColumnIndex !== -1 && cells.length > decisionColumnIndex) {
                decisionValue = cells[decisionColumnIndex].textContent.toLowerCase().trim();
            }
            
            // Remove existing color classes from the row
            row.classList.remove('opp-status-colored', 'op30', 'op60', 'op90', 'op100', 'declined', 'lost');
            
            // Apply color coding if enabled
            if (oppStatusColorsEnabled) {
                row.classList.add('opp-status-colored');
                
                // Processing row status
                
                // Priority: Check for declined decision first, then opp status, then lost status
                if (decisionValue === 'decline') {
                    row.classList.add('declined');
                    // Applied declined status
                } else if (oppStatusValue === 'lost') {
                    row.classList.add('lost');
                    // Applied lost status
                } else if (oppStatusValue === 'op30') {
                    row.classList.add('op30');
                    // Applied OP30 status
                } else if (oppStatusValue === 'op60') {
                    row.classList.add('op60');
                    // Applied OP60 status
                } else if (oppStatusValue === 'op90') {
                    row.classList.add('op90');
                    // Applied OP90 status
                } else if (oppStatusValue === 'op100') {
                    row.classList.add('op100');
                    // Applied OP100 status
                }
            }
        }
    });
    
    // OPP status color coding complete
}

function updateSummaryCounters(data) {
    // Update summary counters based on the data
    if (!data) return;

    
    // Calculate counts and amounts
    const op100Opportunities = data.filter(opp => 
        opp.opp_status?.toLowerCase() === 'op100'
    );
    const op100Count = op100Opportunities.length;
    const op100Amount = op100Opportunities.reduce((sum, opp) => 
        sum + (parseCurrency(opp.final_amt) || 0), 0
    );
    
    const op90Opportunities = data.filter(opp => 
        opp.opp_status?.toLowerCase() === 'op90'
    );
    const op90Count = op90Opportunities.length;
    const op90Amount = op90Opportunities.reduce((sum, opp) => 
        sum + (parseCurrency(opp.final_amt) || 0), 0
    );
    
    const inactiveCount = data.filter(opp => 
        opp.opp_status?.toLowerCase() === 'inactive'
    ).length;
    
    const submittedOppsCount = data.filter(opp => 
        opp.status?.toLowerCase() === 'submitted'
    ).length;
    
    const declinedCount = data.filter(opp => 
        opp.decision?.toLowerCase() === 'decline'
    ).length;
    
    const lostCount = data.filter(opp => 
        opp.decision?.toLowerCase() === 'lost'
    ).length;

    // Update the DOM elements if they exist
    if (totalOpportunities) totalOpportunities.textContent = data.length;
    if (op100Summary) op100Summary.textContent = `${op100Count} / ${abbreviateAmount(op100Amount)}`;
    if (op90Summary) op90Summary.textContent = `${op90Count} / ${abbreviateAmount(op90Amount)}`;
    if (totalInactive) totalInactive.textContent = inactiveCount;
    if (totalSubmitted) totalSubmitted.textContent = submittedOppsCount;
       if (totalDeclined) totalDeclined.textContent = declinedCount;
    if (lostSummary) lostSummary.textContent = lostCount;
}

// --- Filter Functions ---
function getActiveFilters() {
    // Safeguard against null DOM elements
    if (!statusFilterButtonsContainer || !accountMgrFilterDropdown || !picFilterDropdown || !searchInput) {
        console.warn('[FILTERS] Some filter elements not found, returning empty filters');
        return {
            search: '',
            status: [],
            accountMgr: 'all',
            pic: 'all',
            solutions: 'all'
        };
    }
    
    const activeButtons = statusFilterButtonsContainer.querySelectorAll('.filter-button.active');
    const statusFilters = Array.from(activeButtons).map(btn => btn.dataset.filterValue);
    
    const filters = {
        search: searchInput.value.toLowerCase(),
        status: statusFilters,
        accountMgr: accountMgrFilterDropdown.value,
        pic: picFilterDropdown.value,
        solutions: solutionsFilterDropdown ? solutionsFilterDropdown.value : 'all'
    };
    
    console.log('[FILTERS] 🔍 getActiveFilters DETAILED DEBUG:', {
        activeButtonsCount: activeButtons.length,
        statusFilters: statusFilters,
        activeButtonsDetails: Array.from(activeButtons).map(btn => ({
            text: btn.textContent,
            value: btn.dataset.filterValue,
            hasActive: btn.classList.contains('active')
        })),
        search: filters.search,
        accountMgr: filters.accountMgr,
        pic: filters.pic,
        solutions: filters.solutions
    });
    
    return filters;
}

function getActiveFiltersDescription() {
    const filters = getActiveFilters();
    const descriptions = [];
    
    // Status filter
    if (filters.status && filters.status.length > 0 && !filters.status.includes('all')) {
        const statusText = filters.status.map(s => s.toUpperCase()).join(', ');
        descriptions.push(`Status: ${statusText}`);
    }
    
    // Solutions filter
    if (filters.solutions && filters.solutions !== 'all') {
        descriptions.push(`Solutions: ${filters.solutions}`);
    }
    
    // Account Manager filter
    if (filters.accountMgr && filters.accountMgr !== 'all') {
        descriptions.push(`Account Mgr: ${filters.accountMgr}`);
    }
    
    // PIC filter
    if (filters.pic && filters.pic !== 'all') {
        descriptions.push(`PIC: ${filters.pic}`);
    }
    
    // Search filter
    if (filters.search && filters.search.trim()) {
        descriptions.push(`Search: "${filters.search}"`);
    }
    
    return descriptions.length > 0 ? descriptions.join(', ') : '';
}

async function initializeTable() {
    if (!opportunities || !opportunities.length) {
        tableBody.innerHTML = '<tr><td colspan="100%" class="text-center p-4">No data available</td></tr>';
        return;
    }

    // Get headers from the first row and reorder so project_name is first, and remove UID
    let rawHeaders = Object.keys(opportunities[0]);
    // Raw headers from database
    let norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let projectNameHeader = rawHeaders.find(h => norm(h) === 'projectname');
    let otherHeaders = rawHeaders.filter(h => 
        norm(h) !== 'projectname' && 
        norm(h) !== 'uid' && 
        h !== 'revision' &&  // Hide unused revision column
        h !== 'google_drive_folder_id' &&  // Hide Google Drive folder ID
        h !== 'google_drive_folder_url'    // Hide Google Drive folder URL
    );
    headers = [projectNameHeader, ...otherHeaders].filter(Boolean);
    // Final headers for table
    
    // Check if A,C,R,U,D fields are present
    const acrudFields = ['a', 'c', 'r', 'u', 'd'];
    acrudFields.forEach(field => {
        const found = headers.includes(field);
        // Field presence checked
    });

    // Build headerIndices
    headerIndices = {};
    headers.forEach((header, index) => {
        headerIndices[header] = index;
    });

    // Initialize column visibility using user-specific preferences
    try {
        // Try to load user preferences first
        const userPreferences = await loadUserColumnPreferences('opportunities');
        
        if (userPreferences) {
            // User has saved preferences, use them
            columnVisibility = userPreferences;
        } else {
            // No user preferences found, check localStorage for migration
            const stored = localStorage.getItem('columnVisibility');
            if (stored) {
                // Migrate from localStorage
                columnVisibility = JSON.parse(stored);
                await saveUserColumnPreferences('opportunities', columnVisibility);
                localStorage.removeItem('columnVisibility');
            } else {
                // Set and save defaults
                await resetColumnVisibilityToDefaults();
            }
        }
    } catch (error) {
        // Error initializing columns
        // Fallback to legacy localStorage initialization
        if (!localStorage.getItem('columnVisibility')) {
            await resetColumnVisibilityToDefaults();
        } else {
            await initializeColumnVisibility();
        }
    }
    
    // Populate column toggle container
    populateColumnToggleContainer();

    // Populate dropdown options for filters (Account Manager, PIC, etc.)
    dropdownOptions = getDropdownOptions(headers, opportunities);
    populateFilterDropdowns();

    // Apply user-based auto-filtering after dropdowns are populated
    applyAutoFiltersForUser();

    // Start real-time auto-refresh for category tracking
    startRealTimeUpdates();

    // Initialize table header
    initializeTableHeader();

    // Initialize advanced sorting and multi-select functionality
    initAdvancedSorting();
    initMultiSelectCells();

    // Set default sort by encoded_date in descending order
    const encodedDateIndex = headers.findIndex(header => 
        normalizeField(header) === 'encodeddate'
    );
    if (encodedDateIndex !== -1) {
        currentSortColumnIndex = encodedDateIndex;
        currentSortDirection = 'desc';
        // Setting default sort
    } else {
        // encoded_date column not found
    }

    // Initialize table body
    filterAndSortData();

    // Update sort indicators to show the default sort
    updateSortIndicators();

    // Update sort display
    updateSortDisplay();

    // Update row count
    updateRowCount();
}

function initializeTableHeader() {
    // Ensure column visibility is initialized
    ensureColumnVisibilityInitialized();
    
    const headerRow = document.createElement('tr');
    let visibleColumnIndex = 0; // Track visible column position
    
    headers.forEach((header, index) => {
        // If specific column visibility is not set, default to visible
        if (columnVisibility[header] === undefined) {
            columnVisibility[header] = true;
        }
        
        if (!columnVisibility[header]) return; // Only render visible columns
        const th = document.createElement('th');
        
        // Add consistent styling to match Actions column
        th.className = 'px-3 py-2 bg-header text-left';
        
        // Create a container for header content to improve layout
        const headerContent = document.createElement('div');
        headerContent.className = 'header-content';
        headerContent.textContent = formatHeaderText(header);
        
        // Add sort indicator in a separate element for better styling
        const sortIndicator = document.createElement('span');
        sortIndicator.className = 'sort-indicator';
        sortIndicator.innerHTML = '&nbsp;↕';
        headerContent.appendChild(sortIndicator);
        
        th.appendChild(headerContent);
        th.dataset.field = header;
        
        // Set width based on column type (use saved width if available)
        const savedWidth = columnWidths[header];
        const columnWidth = savedWidth || getDefaultColumnWidth(header);
        th.style.minWidth = columnWidth;
        th.style.width = columnWidth;
        
        // Add resize functionality
        setupColumnResize(th, header);
        
        // Add appropriate classes
        const normalizedHeaderForAlignment = normalizeField(header);
        if (rightAlignColumns.includes(normalizedHeaderForAlignment)) {
            th.classList.add('numeric-column');
            th.style.textAlign = 'right';
        } else if (centerAlignColumns.includes(normalizedHeaderForAlignment)) {
            th.style.textAlign = 'center';
        }
        
        // Check if this is the project name column (with various possible field names)
        const normalizedHeader = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const isProjectNameColumn = normalizedHeader === 'projectname' || header.toLowerCase() === 'project_name';
        const isFirstVisibleColumn = visibleColumnIndex === 0;
        
        if (isProjectNameColumn || isFirstVisibleColumn) {
            th.classList.add('project-name-cell');
            // Make project name column sticky
            th.classList.add('sticky-col');
        }
        
        // Check if this is the remarks_comments column
        const normalizedHeaderForRemarks = (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedHeaderForRemarks === 'remarkscomments' || header.toLowerCase().includes('remarks')) {
            th.classList.add('remarks-cell');
        }
        // Add click handler for sorting
        th.addEventListener('click', () => handleSortClick(index));
        headerRow.appendChild(th);
        
        visibleColumnIndex++; // Increment visible column counter
    });

    // Add Actions column header with consistent styling
    const actionsHeader = document.createElement('th');
    actionsHeader.textContent = 'Actions';
    actionsHeader.className = 'px-3 py-2 bg-header text-left center-align-cell';
    actionsHeader.style.minWidth = '120px'; // Ensure enough space for the action buttons
    headerRow.appendChild(actionsHeader);

    tableHead.innerHTML = '';
    tableHead.appendChild(headerRow);
}

function formatShortCurrency(num) {
    const prefix = '₱';
    if (num >= 1e9) {
        return prefix + (num / 1e9).toFixed(1) + 'B';
    }
    if (num >= 1e6) {
        return prefix + (num / 1e6).toFixed(1) + 'M';
    }
    if (num >= 1e3) {
        return prefix + (num / 1e3).toFixed(1) + 'K';
    }
    return prefix + num.toFixed(0);
}

function getAuthToken() {
    // Getting auth token
    const token = localStorage.getItem('authToken');
    // Raw token retrieved
    
    if (!token) {
        // No token found
        return null;
    }
    
    try {
        // Check if token is expired
        const parts = token.split('.');
        // Token parts checked
        
        const payload = JSON.parse(atob(parts[1]));
        const now = Date.now() / 1000;
        // Token payload checked
        
        if (payload.exp && payload.exp < now) {
            // Token expired
            localStorage.removeItem('authToken');
            return null;
        }
        // Token is valid
        return token;
    } catch (error) {
        // Invalid token format
        localStorage.removeItem('authToken');
        return null;
    }
}

function getCurrentUserName() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            // No token for username
            return 'Unknown User';
        }
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.name || payload.username || payload.email || 'Unknown User';
    } catch (error) {
        // Error parsing token
        return 'Unknown User';
    }
}

function showAuthErrorBanner(message) {
    // Showing error banner
    const banner = document.getElementById('authErrorBanner');
    if (banner) {
        banner.innerHTML = message; // Changed from textContent to innerHTML
        banner.style.display = 'block';
        setTimeout(() => {
            banner.style.display = 'none';
        }, 10000); // Increased timeout to 10 seconds
    } else {
        // Auth error banner not found
        // Create a fallback banner if the element doesn't exist
        const fallbackBanner = document.createElement('div');
        fallbackBanner.style.cssText = `
            position: fixed; top: 10px; left: 10px; right: 10px; z-index: 9999;
            background: #ff6b6b; color: white; padding: 15px; border-radius: 5px;
            font-family: Arial, sans-serif; font-size: 14px;
        `;
        fallbackBanner.innerHTML = message;
        document.body.appendChild(fallbackBanner);
        
        setTimeout(() => {
            if (fallbackBanner.parentNode) {
                fallbackBanner.parentNode.removeChild(fallbackBanner);
            }
        }, 10000);
    }
}

// --- Validation Functions ---
function validateEmail(email) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function validatePassword(password) {
    return typeof password === 'string' && password.length >= 8 && password.length <= 100;
}

// Helper function to enable horizontal scrolling with mousewheel
function setupHorizontalScroll() {
    const tableContainer = document.querySelector('.table-container');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    
    if (tableContainer) {
        // FIXED: Only enable horizontal scroll when SHIFT+wheel or when primarily horizontal movement
        tableContainer.addEventListener('wheel', function(e) {
            // Only intercept if shift is held
            if (e.shiftKey) {
                e.preventDefault();
                
                // Use deltaY for shift+wheel, deltaX for normal horizontal wheel
                const scrollAmount = e.shiftKey ? e.deltaY : e.deltaX;
                const scrollSpeed = Math.min(80, Math.abs(scrollAmount) * 0.8);
                this.scrollLeft += scrollAmount > 0 ? scrollSpeed : -scrollSpeed;
                
                // Add visual feedback for horizontal scrolling
                tableContainer.classList.add('scrolling');
                setTimeout(() => {
                    tableContainer.classList.remove('scrolling');
                }, 300);
            }
            // Let vertical scrolling work normally for all other cases
        }, { passive: false });
        
        // Hide scroll indicator when we reach the end of the table
        tableContainer.addEventListener('scroll', function() {
            if (scrollIndicator) {
                const maxScroll = this.scrollWidth - this.clientWidth;
                const scrollPosition = this.scrollLeft;
                
                // If we're near the end of the scroll area
                if (scrollPosition > maxScroll - 20) {
                    scrollIndicator.style.opacity = '0';
                } else {
                    scrollIndicator.style.opacity = '0.8';
                }
            }
        });
        
        // Update scroll indicator visibility on window resize
        window.addEventListener('resize', function() {
            if (scrollIndicator) {
                if (tableContainer.scrollWidth <= tableContainer.clientWidth) {
                    // No horizontal scroll needed
                    scrollIndicator.style.display = 'none';
                } else {
                    scrollIndicator.style.display = 'block';
                }
            }
        });
        
        // Initial check
        setTimeout(() => {
            if (scrollIndicator) {
                if (tableContainer.scrollWidth <= tableContainer.clientWidth) {
                    scrollIndicator.style.display = 'none';
                } else {
                    scrollIndicator.style.display = 'block';
                }
            }
        }, 1000); // Wait for table to fully render
    }
}

setupHorizontalScroll();

// --- Reset Table Function ---
function resetTable() {
    // Clear search input
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Reset status filter buttons
    const activeStatusButtons = document.querySelectorAll('.filter-button.active');
    activeStatusButtons.forEach(button => {
        button.classList.remove('active');
    });
    // Set 'All' as active after clearing
    const allStatusButton = document.querySelector('.filter-button[data-filter-value="all"]');
    if (allStatusButton) {
        allStatusButton.classList.add('active');
    }
    
    // Reset dropdown filters
    if (accountMgrFilterDropdown) {
        accountMgrFilterDropdown.value = 'all';
    }
    
    if (picFilterDropdown) {
        picFilterDropdown.value = 'all';
    }
    
    if (solutionsFilterDropdown) {
        solutionsFilterDropdown.value = 'all';
    }
    
    // Re-render the table with all data
    filterAndSortData();
    
    // Update dashboard cards since Account Manager and Solutions filters were reset
    updateSummaryCounters(opportunities);
}

async function initializeColumnVisibility() {
    // Default hidden columns (specific columns that should be hidden on initial load for new users)
    const defaultHiddenColumns = [
        'description', 'comments', 'uid', 'created_at', 'updated_at', 
        'encoded_date', 'a', 'c', 'r', 'u', 'd', 'rev', 'project_code',
        'sol_particulars', 'ind_particulars', 'lost_rca', 'l_particulars',
        'client_deadline', 'submitted_date', 'date_awarded_lost', 'forecast_date'
    ];
    
    let visibilitySettings = {};
    
    try {
        // Try to load user-specific preferences from server
        const userPreferences = await loadUserColumnPreferences('opportunities');
        
        if (userPreferences) {
            // User has saved preferences, use them
            visibilitySettings = userPreferences;
        } else {
            // No user preferences found, check localStorage as fallback
            const stored = localStorage.getItem('columnVisibility');
            if (stored) {
                visibilitySettings = JSON.parse(stored);
                // Migrate localStorage preferences to user-specific storage
                await saveUserColumnPreferences('opportunities', visibilitySettings);
                // Clear localStorage after migration
                localStorage.removeItem('columnVisibility');
            } else {
                // Set defaults if no stored preferences
                headers.forEach(header => {
                    const shouldHide = defaultHiddenColumns.some(col => 
                        header.toLowerCase() === col.toLowerCase()
                    );
                    visibilitySettings[header] = !shouldHide;
                });
                
                // Save default settings to user-specific storage
                await saveUserColumnPreferences('opportunities', visibilitySettings);
            }
        }
    } catch (e) {
        // Error loading column preferences
        // Fallback to localStorage for backward compatibility
        try {
            const stored = localStorage.getItem('columnVisibility');
            if (stored) {
                visibilitySettings = JSON.parse(stored);
            } else {
                // Set defaults
                headers.forEach(header => {
                    const shouldHide = defaultHiddenColumns.some(col => 
                        header.toLowerCase() === col.toLowerCase()
                    );
                    visibilitySettings[header] = !shouldHide;
                });
            }
        } catch (fallbackError) {
            // Final fallback to showing all columns
            headers.forEach(header => {
                visibilitySettings[header] = true;
            });
        }
    }
    
    // Apply visibility settings
    columnVisibility = visibilitySettings;
}

// Function to reset column visibility to defaults
async function resetColumnVisibilityToDefaults() {
    // Default hidden columns (specific columns that should be hidden on initial load for new users)
    const defaultHiddenColumns = [
        'description', 'comments', 'uid', 'created_at', 'updated_at', 
        'encoded_date', 'a', 'c', 'r', 'u', 'd', 'rev', 'project_code',
        'sol_particulars', 'ind_particulars', 'lost_rca', 'l_particulars',
        'client_deadline', 'submitted_date', 'date_awarded_lost', 'forecast_date'
    ];
    
    let visibilitySettings = {};
    
    if (headers && headers.length > 0) {
        // Set defaults based on headers
        headers.forEach(header => {
            const shouldHide = defaultHiddenColumns.some(col => 
                header.toLowerCase() === col.toLowerCase()
            );
            visibilitySettings[header] = !shouldHide;
        });
    } else {
        // Headers not available for reset
        return;
    }
    
    // Apply visibility settings
    columnVisibility = visibilitySettings;
    
    // Save to localStorage as fallback
    localStorage.setItem('columnVisibility', JSON.stringify(visibilitySettings));
    
    try {
        // Save to user-specific storage if authenticated
        await saveUserColumnPreferences('opportunities', visibilitySettings);
    } catch (error) {
        // Error saving default preferences
    }
    
    // Column visibility reset
}

async function resetUserColumnPreferences(pageName) {
    try {
        const token = getAuthToken();
        if (!token) {
            // Cannot reset - not authenticated
            return false;
        }
        
        const response = await fetch(getApiUrl(`/api/user-column-preferences/${pageName}`), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to reset column preferences: ${response.statusText}`);
        }
        
        const data = await response.json();
        // Preferences reset successfully
        return true;
    } catch (error) {
        // Error resetting preferences
        return false;
    }
}

function populateColumnToggleContainer() {
    if (!columnToggleContainer || !headers || headers.length === 0) {
        return;
    }
    
    // Clear the container
    columnToggleContainer.innerHTML = '';
    
    // Create toggle controls for each column
    headers.forEach((header, index) => {
        // Skip actions column - it should always be visible
        if (header.toLowerCase() === 'actions') {
            return;
        }
        
        // Create a wrapper div for the checkbox and label
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center gap-2';
        
        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `column-toggle-${index}`;
        checkbox.dataset.columnName = header;
        checkbox.checked = columnVisibility[header] ?? true;
        
        // Disable the first visible column (usually project name) to prevent hiding it
        const isFirstVisibleColumn = headers.findIndex(h => columnVisibility[h] !== false) === index;
        if (isFirstVisibleColumn) {
            checkbox.disabled = true;
            checkbox.title = 'First column cannot be hidden';
        }
        
        // Create label
        const label = document.createElement('label');
        label.htmlFor = `column-toggle-${index}`;
        label.textContent = formatToggleLabelText(header);
        label.className = 'text-sm select-none';
        
        // Add change event listener
        checkbox.addEventListener('change', async function() {
            // Update column visibility
            columnVisibility[header] = this.checked;
            
            // Save to user-specific preferences with localStorage fallback
            await saveUserColumnPreferences('opportunities', columnVisibility);
            
            // Rebuild table with new visibility settings
            initializeTableHeader();
            filterAndSortData();
            
            // Ensure column widths are preserved after header rebuild
            setTimeout(() => reapplyColumnWidths(), 10);
            
            // Save to user preferences
            saveUserPreferences();
            
            // Update disabled state of first visible column checkbox
            updateFirstVisibleColumnState();
        });
        
        // Append elements to wrapper
        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        
        // Add wrapper to container
        columnToggleContainer.appendChild(wrapper);
    });
    
    // Update disabled state for the first visible column
    updateFirstVisibleColumnState();
}

function updateFirstVisibleColumnState() {
    if (!columnToggleContainer || !headers) return;
    
    // Find the first visible column
    const firstVisibleIndex = headers.findIndex(h => columnVisibility[h] !== false);
    
    // Enable all checkboxes first
    columnToggleContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.disabled = false;
        checkbox.title = '';
    });
    
    // Disable the first visible column checkbox
    if (firstVisibleIndex >= 0) {
        const firstVisibleHeader = headers[firstVisibleIndex];
        const firstVisibleCheckbox = columnToggleContainer.querySelector(`input[data-column-name="${firstVisibleHeader}"]`);
        if (firstVisibleCheckbox) {
            firstVisibleCheckbox.disabled = true;
            firstVisibleCheckbox.title = 'First visible column cannot be hidden';
        }
    }
}

// --- User Column Preferences Functions ---
async function loadUserColumnPreferences(pageName) {
    try {
        const token = getAuthToken();
        if (!token) {
            return null; // Not authenticated, can't load user preferences
        }
        
        const response = await fetch(getApiUrl(`/api/user-column-preferences/${pageName}`), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 404 || response.status === 401) {
                return null; // No preferences found or not authenticated
            }
            throw new Error(`Failed to load column preferences: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.columnSettings;
    } catch (error) {
        // Error loading user preferences
        return null; // Fall back to localStorage or defaults
    }
}

async function saveUserColumnPreferences(pageName, columnSettings) {
    try {
        const token = getAuthToken();
        if (!token) {
            // Cannot save - not authenticated
            return false;
        }
        
        const response = await fetch(getApiUrl(`/api/user-column-preferences/${pageName}`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ columnSettings })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save column preferences: ${response.statusText}`);
        }
        
        const data = await response.json();
        // Preferences saved successfully
        return true;
    } catch (error) {
        // Error saving preferences
        // Fallback to localStorage for backward compatibility
        try {
            localStorage.setItem('columnVisibility', JSON.stringify(columnSettings));
            // Saved to localStorage fallback
        } catch (localStorageError) {
            // Failed localStorage fallback
        }
        return false;
    }
}

// --- Dashboard Toggles Initialization ---
function initializeDashboardToggles() {
    // Initializing dashboard toggles
    try {
        // Force set default comparison mode to 'none' if not already set
        const currentMode = localStorage.getItem('dashboardComparisonMode');
        if (!currentMode) {
            localStorage.setItem('dashboardComparisonMode', 'none');
        }
        
        // Initialize toggle states based on saved comparison mode (default: none)
        const savedMode = localStorage.getItem('dashboardComparisonMode') || 'none';
        // Initializing toggle states
        
        // Update toggle button states
        updateToggleStates(savedMode);
        
        // Double-check the button states are applied correctly
        setTimeout(() => {
            const activeButton = document.getElementById('noCompareToggle');
            if (activeButton && savedMode === 'none' && !activeButton.classList.contains('active')) {
                // Force-applying active state
                updateToggleStates('none');
            }
        }, 100);
        
        // Dashboard toggles initialized
    } catch (error) {
        // Error in dashboard toggles
    }
}

// --- User-Based Auto-Filtering Functions ---

// Get current user roles from JWT token
function getCurrentUserRoles() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            // No token for roles
            return [];
        }
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.roles || [];
    } catch (error) {
        // Error parsing token for roles
        return [];
    }
}

// Map user roles to appropriate filter values
function mapUserRolesToFilters(userRoles, availableData) {
    const filters = {};
    
    if (!userRoles || userRoles.length === 0 || !availableData) {
        return filters;
    }
    
    // Mapping user roles
    
    // Get available filter values from data
    const accountMgrs = Array.from(new Set(availableData.map(item => item.account_mgr || item['account_mgr']).filter(Boolean)));
    const solutions = Array.from(new Set(availableData.map(item => item.solutions).filter(Boolean)));
    const pics = Array.from(new Set(availableData.map(item => item.pic).filter(Boolean)));
    
    // Available account managers and PICs
    
    // Role-based filtering logic
    userRoles.forEach(role => {
        switch(role.toUpperCase()) {
            case 'DS':
            case 'SE':
                // DS/SE roles - filter PIC by username, but dashboard remains "all"
                const userNameDSSE = getCurrentUserName();
                // DS/SE role - checking PIC filter
                
                if (userNameDSSE && userNameDSSE !== 'Unknown User') {
                    const picMatch = mapUserNameToFilterValue(userNameDSSE, pics);
                    if (picMatch) {
                        filters.pic = picMatch;
                        filters.dashboardIgnorePic = true; // Dashboard should ignore PIC filter
                        // DS/SE mapped to PIC filter
                    }
                }
                break;
                
            case 'SALES':
                // Sales role - filter by account manager matching current user
                const userNameSales = getCurrentUserName();
                // SALES role - checking account manager
                
                if (userNameSales && userNameSales !== 'Unknown User') {
                    // Try to match current user to an account manager
                    const accountMgrMatch = mapUserNameToFilterValue(userNameSales, accountMgrs);
                    if (accountMgrMatch) {
                        filters.accountManager = accountMgrMatch;
                        // SALES mapped to account manager
                    } else {
                        // SALES - no account manager match
                    }
                } else {
                    // SALES - no valid username
                }
                break;
                
            case 'ADMIN':
                // Admin - full access, no filtering
                // ADMIN role - no filtering
                break;
                
            default:
                // Unknown role
        }
    });
    
    return filters;
}

function mapUserNameToFilterValue(userName, availableValues) {
    if (!userName || !availableValues || availableValues.length === 0) {
        return null;
    }
    
    const userLower = userName.toLowerCase();
    
    // Direct exact match first
    const exactMatch = availableValues.find(value => 
        value.toLowerCase() === userLower
    );
    if (exactMatch) return exactMatch;
    
    // Check if user name contains email, extract initials
    if (userLower.includes('@')) {
        const emailPrefix = userLower.split('@')[0];
        const parts = emailPrefix.split('.');
        if (parts.length >= 2) {
            const initials = parts.map(part => part.charAt(0).toUpperCase()).join('');
            const initialsMatch = availableValues.find(value => 
                value.toLowerCase().includes(initials.toLowerCase())
            );
            if (initialsMatch) return initialsMatch;
        }
    }
    
    // Check if userName contains parts of any available values
    const partialMatch = availableValues.find(value => {
        const valueParts = value.toLowerCase().split(/[\s\._\-]+/);
        const userParts = userLower.split(/[\s\._\-@]+/);
        
        return valueParts.some(vPart => 
            userParts.some(uPart => 
                uPart.length > 1 && (vPart.includes(uPart) || uPart.includes(vPart))
            )
        );
    });
    if (partialMatch) return partialMatch;
    
    // Check if any available value contains parts of userName
    const containsMatch = availableValues.find(value => {
        const valueWords = value.toLowerCase().split(/[\s\._\-]+/);
        const userWords = userLower.split(/[\s\._\-@]+/);
        
        return userWords.some(userWord => 
            userWord.length > 2 && valueWords.some(valueWord => 
                valueWord.includes(userWord) || userWord.includes(valueWord)
            )
        );
    });
    
    return containsMatch || null;
}

function applyAutoFiltersForUser() {
    try {
        // Skip auto-filtering if user has preferences saved (indicating they've used the system before)
        if (userPreferences && userPreferences.hasLoadedBefore) {
            console.log('[AUTO-FILTER] Skipping auto-filter - user has used system before');
            return;
        }
        
        // For debugging - show current filter values
        if (userPreferences && userPreferences.filters) {
            console.log('[AUTO-FILTER] Current filter preferences:', userPreferences.filters);
        } else {
            console.log('[AUTO-FILTER] No user preferences found');
        }
        
        // First try role-based filtering
        const userRoles = getCurrentUserRoles();
        // Checking role-based auto-filter
        
        if (userRoles && userRoles.length > 0 && opportunities && opportunities.length > 0) {
            const roleFilters = mapUserRolesToFilters(userRoles, opportunities);
            let roleFilterApplied = false;
            
            // Apply role-based solutions filter
            if (roleFilters.solutions && solutionsFilterDropdown) {
                // Applying solutions filter
                solutionsFilterDropdown.value = roleFilters.solutions;
                roleFilterApplied = true;
            }
            
            // Apply role-based account manager filter
            if (roleFilters.accountManager && accountMgrFilterDropdown) {
                // Applying account manager filter
                accountMgrFilterDropdown.value = roleFilters.accountManager;
                roleFilterApplied = true;
            } else {
                // No account manager filter
                console.log('No account manager filter:', {
                    roleFiltersAccountManager: roleFilters.accountManager,
                    accountMgrDropdownExists: !!accountMgrFilterDropdown
                });
            }
            
            // Apply role-based PIC filter (for DS/SE roles)
            if (roleFilters.pic && picFilterDropdown) {
                // Applying PIC filter
                picFilterDropdown.value = roleFilters.pic;
                roleFilterApplied = true;
            }
            
            if (roleFilterApplied) {
                // Role-based filter applied
                filterAndSortData();
                
                // Note: Dashboard will be loaded separately after auto-filters are applied
                // This ensures proper snapshot comparison handling
                // Role-based filters completed
                return; // Exit early if role-based filtering was applied
            }
        }
        
        // Fallback to username-based filtering if no role-based filtering was applied
        const userName = getCurrentUserName();
        // Checking username-based filter
        
        if (!userName || userName === 'Unknown User') {
            // No valid user for filter
            return;
        }
        
        // Check if we have dropdown data available
        if (!dropdownOptions || (!dropdownOptions.accountmgr && !dropdownOptions.pic)) {
            // Dropdown options not ready
            return;
        }
        
        let filterApplied = false;
        
        // Try to match Account Manager first
        if (dropdownOptions.accountmgr && accountMgrFilterDropdown) {
            const accountMgrMatch = mapUserNameToFilterValue(userName, dropdownOptions.accountmgr);
            if (accountMgrMatch) {
                // Applying account manager match
                accountMgrFilterDropdown.value = accountMgrMatch;
                filterApplied = true;
            }
        }
        
        // If no Account Manager match, try PIC
        if (!filterApplied && dropdownOptions.pic && picFilterDropdown) {
            const picMatch = mapUserNameToFilterValue(userName, dropdownOptions.pic);
            if (picMatch) {
                // Applying PIC match
                picFilterDropdown.value = picMatch;
                filterApplied = true;
            }
        }
        
                    // Apply the filters if any were set
        if (filterApplied) {
            // Username-based filter applied
            filterAndSortData();
            // Note: Dashboard will be loaded separately after auto-filters are applied
            // Username-based filters completed
        } else {
            // No matching filter found
        }
        
    } catch (error) {
        // Error applying auto-filter
    }
}

// Function to handle real-time updates for category tracking
function startRealTimeUpdates() {
    // Update categories every 5 minutes
    const updateInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    // Initial update
    updateCategoryMetrics();
    
    // Set up periodic updates
    const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
            updateCategoryMetrics();
        }
    }, updateInterval);
    
    // Clean up interval when page is unloaded
    window.addEventListener('unload', () => {
        clearInterval(intervalId);
    });
    
    // Pause updates when page is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateCategoryMetrics();
        }
    });
}

// Helper function to set dashboard values
function setDashboardValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        // Setting dashboard value
        el.textContent = value;
    } else {
        // Dashboard element not found
    }
}

// =================================================================
// ENHANCED MODAL SUPPORT SYSTEM
// =================================================================

function initializeGlobalModalSupport() {
    // Add ESC key support for all modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeActiveModal();
        }
    });

    // Initialize modal overlays with click-to-close
    const modalOverlays = document.querySelectorAll('.modal-overlay');
    modalOverlays.forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeModalByOverlay(overlay);
            }
        });
    });

    // Enhanced modal support initialized
}

function closeActiveModal() {
    const activeOverlay = document.querySelector('.modal-overlay:not(.hidden)');
    if (activeOverlay) {
        closeModalByOverlay(activeOverlay);
        return true;
    }
    return false;
}

function closeModalByOverlay(overlay) {
    const modal = overlay.querySelector('.modal');
    
    if (modal) {
        modal.style.transform = 'scale(0.95)';
        modal.style.opacity = '0';
    }
    
    overlay.style.opacity = '0';
    
    setTimeout(() => {
        overlay.classList.add('hidden');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.transform = '';
            modal.style.opacity = '';
        }
        overlay.style.opacity = '';
    }, 300);
}

// Prevent multiple initializations
let sidebarInitialized = false;

// Sidebar toggle functionality - moved from inline script to avoid CSP issues
function initializeSidebar() {
    if (sidebarInitialized) {
        // Sidebar already initialized
        return;
    }
    
    // Sidebar debug start
    sidebarInitialized = true;
    
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.sidebar-toggle-btn');
    const mainContent = document.querySelector('.main-content');
    
    // Elements found
    console.log('Elements found:', {
        sidebar: !!sidebar,
        toggleBtn: !!toggleBtn,
        mainContent: !!mainContent,
        sidebarClasses: sidebar ? sidebar.className : 'NOT FOUND',
        sidebarWidth: sidebar ? getComputedStyle(sidebar).width : 'NOT FOUND'
    });
    
    if (!sidebar) {
        console.error('SIDEBAR NOT FOUND!');
        return;
    }
    
    if (!toggleBtn) {
        console.error('TOGGLE BUTTON NOT FOUND!');
        return;
    }
    
    // FORCE initial collapsed state with inline styles
    console.log('FORCING COLLAPSED STATE...');
    sidebar.classList.add('collapsed');
    sidebar.style.setProperty('width', '50px', 'important');
    sidebar.style.setProperty('min-width', '50px', 'important');
    sidebar.style.setProperty('max-width', '50px', 'important');
    sidebar.style.transition = 'none'; // Disable transitions for debugging
    
    // Force hide text labels initially
    const textElements = sidebar.querySelectorAll('.sidebar-item-text, .sidebar-section-title');
    textElements.forEach(el => {
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('width', '0', 'important');
        el.style.transition = 'none'; // Disable transitions for debugging
    });
    
    if (mainContent) {
        mainContent.style.setProperty('margin-left', '50px', 'important');
        mainContent.style.transition = 'none'; // Disable transitions for debugging
    }
    
    console.log('After forcing collapsed:', {
        sidebarClasses: sidebar.className,
        sidebarWidth: getComputedStyle(sidebar).width,
        sidebarInlineWidth: sidebar.style.width,
        mainContentMargin: mainContent ? getComputedStyle(mainContent).marginLeft : 'NOT FOUND'
    });
    
    // Simple toggle function without complex verification
    let isToggling = false;
    
    // Toggle function with FORCE
    function toggleSidebar() {
        // Prevent rapid clicking
        if (isToggling) {
            console.log('🚫 Toggle already in progress, ignoring click');
            return;
        }
        
        isToggling = true;
        console.log('=== TOGGLE CLICKED ===');
        const currentWidth = getComputedStyle(sidebar).width;
        const wasCollapsed = currentWidth === '50px' || sidebar.classList.contains('collapsed');
        console.log('Was collapsed:', wasCollapsed, 'Current width:', currentWidth);
        
        if (wasCollapsed) {
            // EXPAND - Use aggressive approach like collapse
            console.log('🔄 EXPANDING with aggressive override...');
            sidebar.className = 'sidebar';
            
            // Add a unique ID for maximum CSS specificity
            sidebar.id = 'sidebar-force-expanded';
            
            // Force styles with maximum priority using cssText
            sidebar.style.cssText = 'width: 280px !important; min-width: 280px !important; max-width: 280px !important; transition: none !important;';
            
            // Also inject a style tag for maximum override power
            const expandStyleSheet = document.createElement('style');
            expandStyleSheet.setAttribute('data-sidebar-expand', 'true');
            expandStyleSheet.textContent = `
                #sidebar-force-expanded {
                    width: 280px !important;
                    min-width: 280px !important;
                    max-width: 280px !important;
                }
            `;
            document.head.appendChild(expandStyleSheet);
            
            // Force show text labels
            const textElements = sidebar.querySelectorAll('.sidebar-item-text, .sidebar-section-title');
            textElements.forEach(el => {
                el.style.cssText = 'opacity: 1 !important; width: auto !important; display: block !important; visibility: visible !important;';
            });
            
            if (mainContent) {
                mainContent.style.cssText = mainContent.style.cssText.replace(/margin-left: [^;]+;?/, '') + '; margin-left: 280px !important;';
            }
            console.log('EXPANDED - Sidebar: 280px, Main: 280px margin, Text shown');
            
            // Debug: Check if styles are being applied (immediate check)
            const actualWidth = getComputedStyle(sidebar).width;
            const actualMargin = mainContent ? getComputedStyle(mainContent).marginLeft : 'N/A';
            console.log('🔍 Immediate post-expand check:', {
                expectedWidth: '280px',
                actualWidth: actualWidth,
                expectedMargin: '280px',
                actualMargin: actualMargin,
                sidebarClasses: sidebar.className,
                inlineStyles: sidebar.style.cssText
            });
            
            if (actualWidth !== '280px') {
                console.error('❌ Expansion failed immediately - something is blocking the styles');
            }
        } else {
            // COLLAPSE - Use aggressive approach like expand
            console.log('🔄 COLLAPSING with aggressive override...');
            
            // Remove expand stylesheets and ID
            const expandStyles = document.querySelectorAll('style[data-sidebar-expand]');
            expandStyles.forEach(style => style.remove());
            sidebar.removeAttribute('id');
            
            sidebar.className = 'sidebar collapsed';
            
            // Force styles with maximum priority
            sidebar.style.cssText = 'width: 50px !important; min-width: 50px !important; max-width: 50px !important; transition: none !important;';
            
            // Force hide text labels
            const textElements = sidebar.querySelectorAll('.sidebar-item-text, .sidebar-section-title');
            textElements.forEach(el => {
                el.style.cssText = 'opacity: 0 !important; width: 0 !important; display: none !important; visibility: hidden !important;';
            });
            
            if (mainContent) {
                mainContent.style.cssText = mainContent.style.cssText.replace(/margin-left: [^;]+;?/, '') + '; margin-left: 50px !important;';
            }
            console.log('COLLAPSED - Sidebar: 50px, Main: 50px margin, Text hidden');
        }
        
        // Simple completion - just reset the toggle lock after a short delay
        setTimeout(() => {
            isToggling = false;
            console.log('✅ Toggle completed, lock released');
        }, 200);
        
        // Save state
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        

    }
    
    // Add click event with debugging
    toggleBtn.addEventListener('click', function(e) {
        console.log('Button clicked event fired');
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar();
    });
    
    console.log('Toggle button event listener added');
    
    // REMOVED: Automatic programmatic test that might interfere with manual clicks
    // Let's see if removing this helps with manual expansion
    
    console.log('=== SIDEBAR DEBUG END ===');
    
    // Add global function for manual testing
    window.testSidebarToggle = function() {
        console.log('🧪 MANUAL TEST TOGGLE');
        toggleSidebar();
    };
    
    window.forceSidebarExpand = function() {
        console.log('🔧 MANUAL FORCE EXPAND');
        sidebar.classList.remove('collapsed');
        sidebar.style.setProperty('width', '280px', 'important');
        sidebar.style.setProperty('min-width', '280px', 'important');
        sidebar.style.setProperty('max-width', '280px', 'important');
        
        const textElements = sidebar.querySelectorAll('.sidebar-item-text, .sidebar-section-title');
        textElements.forEach(el => {
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('width', 'auto', 'important');
            el.style.setProperty('display', 'block', 'important');
        });
        
        if (mainContent) {
            mainContent.style.setProperty('margin-left', '280px', 'important');
        }
        console.log('✅ FORCED EXPANSION COMPLETE');
    };
}

// Sidebar initialization is now handled by shared-navigation.js
// These event listeners are no longer needed

// Sidebar functionality is now handled by shared-navigation.js
// This legacy sidebar code is no longer needed

// --- User Info and Online Users Tracking ---
// Now handled by shared-navigation.js
// This section has been moved to the SharedNavigation class for unified implementation

// Start heartbeat mechanism
function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    console.log('[HEARTBEAT] Starting heartbeat...');
    
    // Send heartbeat every 30 seconds
    heartbeatInterval = setInterval(async () => {
        await sendHeartbeat();
    }, 30000);
    
    // Send initial heartbeat
    sendHeartbeat();
}

// Send heartbeat to server and update local presence
async function sendHeartbeat() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn('[HEARTBEAT] No auth token available');
            return;
        }
        
        console.log('[HEARTBEAT] Sending heartbeat with token:', token ? 'present' : 'missing');
        
        const response = await fetch(getApiUrl(window.APP_CONFIG.ENDPOINTS.HEARTBEAT), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPage: window.location.pathname
            })
        });
        
        console.log('[HEARTBEAT] Response status:', response.status);
        
        // Handle empty response
        const responseText = await response.text();
        if (!responseText) {
            console.warn('[HEARTBEAT] Empty response received');
            return;
        }
        
        // Try to parse JSON response
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.warn('[HEARTBEAT] Invalid JSON response:', responseText);
            return;
        }
        
        if (data.success) {
            // Update online users list
            if (data.onlineUsers) {
                onlineUsersData = new Map(data.onlineUsers.map(user => [user.id, user]));
                updateOnlineUsersDisplay();
            }
        } else {
            throw new Error(data.error || 'Unknown error in heartbeat response');
        }
    } catch (error) {
        console.error('[HEARTBEAT] Error sending heartbeat:', error);
    }
}

// Fallback method using localStorage when server is unavailable
async function fallbackToLocalStorage() {
    const heartbeatData = {
        userId: currentUserId,
        userInfo: currentUserInfo,
        timestamp: Date.now(),
        page: window.location.pathname
    };
    
    // Store in localStorage with expiration
    const storageKey = `user_heartbeat_${currentUserId}`;
    localStorage.setItem(storageKey, JSON.stringify(heartbeatData));
    
    // Fetch other users' heartbeats from localStorage
    await fetchOtherUsersPresence();
}

// Update online users data from server response
function updateOnlineUsersFromServer(serverUsers) {
    let hasChanges = false;
    
    // Clear existing data except current user
    const currentUserData = onlineUsersData.get(currentUserId);
    onlineUsersData.clear();
    if (currentUserData) {
        onlineUsersData.set(currentUserId, currentUserData);
    }
    
    // Add users from server
    serverUsers.forEach(user => {
        if (!onlineUsersData.has(user.id)) {
            hasChanges = true;
        }
        onlineUsersData.set(user.id, {
            id: user.id,
            name: user.name,
            email: user.email,
            lastSeen: user.lastSeen,
            status: 'online',
            page: user.page
        });
    });
    
    if (hasChanges) {
        updateOnlineUsersDisplay();
    }
}

// Fetch other users' presence data (fallback to localStorage)
async function fetchOtherUsersPresence() {
    const currentTime = Date.now();
    const maxAge = 60000; // 1 minute
    
    // Get all heartbeat keys from localStorage
    const heartbeatKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('user_heartbeat_') && key !== `user_heartbeat_${currentUserId}`
    );
    
    let hasChanges = false;
    
    heartbeatKeys.forEach(key => {
        try {
            const heartbeatData = JSON.parse(localStorage.getItem(key));
            const age = currentTime - heartbeatData.timestamp;
            
            // Only consider users active within the last minute
            if (age <= maxAge) {
                const userId = heartbeatData.userId;
                
                if (!onlineUsersData.has(userId)) {
                    // New user detected
                    onlineUsersData.set(userId, {
                        id: userId,
                        name: heartbeatData.userInfo.name,
                        email: heartbeatData.userInfo.email,
                        lastSeen: heartbeatData.timestamp,
                        status: 'online',
                        page: heartbeatData.page
                    });
                    hasChanges = true;
                    console.log('[ONLINE-USERS] New user detected:', heartbeatData.userInfo.name);
                } else {
                    // Update existing user
                    const userData = onlineUsersData.get(userId);
                    userData.lastSeen = heartbeatData.timestamp;
                    userData.status = 'online';
                    userData.page = heartbeatData.page;
                    onlineUsersData.set(userId, userData);
                }
            }
        } catch (error) {
            console.warn('[ONLINE-USERS] Error parsing heartbeat data:', error);
        }
    });
    
    if (hasChanges) {
        updateOnlineUsersDisplay();
    }
}

// Clean up offline users
function cleanupOfflineUsers() {
    const currentTime = Date.now();
    const offlineThreshold = 90000; // 1.5 minutes
    let hasChanges = false;
    
    for (const [userId, userData] of onlineUsersData.entries()) {
        const timeSinceLastSeen = currentTime - userData.lastSeen;
        
        if (timeSinceLastSeen > offlineThreshold && userId !== currentUserId) {
            onlineUsersData.delete(userId);
            hasChanges = true;
            console.log('[ONLINE-USERS] User went offline:', userData.name);
            
            // Clean up localStorage
            localStorage.removeItem(`user_heartbeat_${userId}`);
        }
    }
    
    if (hasChanges) {
        updateOnlineUsersDisplay();
    }
}

// Update the online users display
function updateOnlineUsersDisplay() {
    const onlineCountElement = document.getElementById('onlineCount');
    const onlineUsersListElement = document.getElementById('onlineUsersList');
    
    if (!onlineCountElement || !onlineUsersListElement) {
        console.warn('[ONLINE-USERS] Display elements not found');
        return;
    }
    
    const onlineUsers = Array.from(onlineUsersData.values())
        .filter(user => user.status === 'online')
        .sort((a, b) => {
            // Current user first, then alphabetical
            if (a.id === currentUserId) return -1;
            if (b.id === currentUserId) return 1;
            return a.name.localeCompare(b.name);
        });
    
    // Update count
    onlineCountElement.textContent = onlineUsers.length;
    
    // Update list
    onlineUsersListElement.innerHTML = '';
    
    onlineUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'online-user-item';
        
        const isCurrentUser = user.id === currentUserId;
        const displayName = isCurrentUser ? 'You' : user.name;
        
        userItem.innerHTML = `
            <span class="material-icons">${isCurrentUser ? 'account_circle' : 'person'}</span>
            <span class="online-user-name">${displayName}</span>
            ${user.page && user.page !== window.location.pathname ? 
                `<span class="material-icons online-user-page" title="Currently on: ${user.page}" style="font-size: 0.875rem; color: var(--text-secondary); opacity: 0.7;">open_in_browser</span>` : ''}
        `;
        
        onlineUsersListElement.appendChild(userItem);
    });
    
    console.log('[ONLINE-USERS] Updated display with', onlineUsers.length, 'online users');
}

// Clean up when user leaves
function cleanupUserPresence() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    
    if (currentUserId) {
        localStorage.removeItem(`user_heartbeat_${currentUserId}`);
        console.log('[USER-INFO] Cleaned up user presence');
    }
}

// Handle page visibility changes
function handleVisibilityChange() {
    if (document.hidden) {
        console.log('[USER-INFO] Page hidden, reducing heartbeat frequency');
        // Reduce heartbeat frequency when page is hidden
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(sendHeartbeat, 60000); // Every minute when hidden
        }
    } else {
        console.log('[USER-INFO] Page visible, resuming normal heartbeat');
        // Resume normal heartbeat when page becomes visible
        startHeartbeat();
    }
}

// Initialize user info system when DOM is ready
function initializeUserInfoOnDOMReady() {
    // User info is now handled by shared-navigation.js
    console.log('[USER-INFO] User info initialization is now handled by shared navigation');
}

// Set up event listeners
document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('beforeunload', cleanupUserPresence);
window.addEventListener('unload', cleanupUserPresence);

// Listen for storage changes (when other tabs update presence)
window.addEventListener('storage', function(e) {
    if (e.key && e.key.startsWith('user_heartbeat_') && e.key !== `user_heartbeat_${currentUserId}`) {
        console.log('[ONLINE-USERS] Detected presence update from another tab');
        fetchOtherUsersPresence();
    }
});

// Data Sync from Drive functionality
async function handleSyncFromDrive(event) {
    event.preventDefault();
    
    // Get the current opportunity UID from the edit modal
    const opportunityUid = getCurrentOpportunityUid();
    if (!opportunityUid) {
        alert('No opportunity selected for sync');
        return;
    }
    
    // Show loading state
    const syncBtn = document.getElementById('syncFromDriveBtn');
    const originalText = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<span class="material-icons text-sm mr-2 animate-spin">sync</span>Syncing...';
    
    try {
        console.log(`[SYNC] Starting sync for opportunity: ${opportunityUid}`);
        
        // Call the sync API endpoint
        const response = await fetch(getApiUrl(`/api/proposal-workbench/sync-from-drive/${opportunityUid}`), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Sync failed');
        }
        
        if (result.success) {
            console.log('[SYNC] Successfully synced opportunity data:', result.syncedData);
            
            // Update the form fields with synced data
            updateFormWithSyncedData(result.syncedData);
            
            // Show success message
            showSyncSuccessMessage(result.syncedData);
            
            // Note: In-memory data and views will be updated only when user clicks "Save Changes"
            
        } else {
            throw new Error(result.error || 'Sync failed');
        }
        
    } catch (error) {
        console.error('[SYNC] Sync failed:', error);
        showSyncErrorMessage(error.message);
    } finally {
        // Restore button state
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalText;
    }
}

function updateFormWithSyncedData(syncedData) {
    // Update form fields with synced data
    if (syncedData.revisionNumber !== undefined) {
        const revisionField = document.querySelector('#editRowForm input[name="rev"], #editRowForm input[name="revision"]');
        if (revisionField) {
            revisionField.value = syncedData.revisionNumber;
            highlightUpdatedField(revisionField);
        }
    }
    
    if (syncedData.margin !== undefined) {
        const marginField = document.querySelector('#editRowForm input[name="margin"]');
        if (marginField) {
            marginField.value = syncedData.margin.toFixed(2);
            highlightUpdatedField(marginField);
        }
    }
    
    if (syncedData.finalAmount !== undefined) {
        const finalAmountField = document.querySelector('#editRowForm input[name="final_amount"], #editRowForm input[name="final_amt"]');
        if (finalAmountField) {
            finalAmountField.value = formatNumberWithCommas(syncedData.finalAmount);
            highlightUpdatedField(finalAmountField);
        }
    }
    
    if (syncedData.submittedDate) {
        const submittedDateField = document.querySelector('#editRowForm input[name="submitted_date"]');
        if (submittedDateField) {
            submittedDateField.value = new Date(syncedData.submittedDate).toISOString().split('T')[0];
            highlightUpdatedField(submittedDateField);
        }
    }
}

function highlightUpdatedField(field) {
    // Add a visual highlight to show which fields were updated
    field.style.border = '2px solid #10b981';
    field.style.backgroundColor = '#f0fdf4';
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
        field.style.border = '';
        field.style.backgroundColor = '';
    }, 3000);
}

function formatNumberWithCommas(num) {
    if (num === null || num === undefined) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getCurrentOpportunityUid() {
    // Extract opportunity UID from current edit modal context
    if (currentEditRowIndex >= 0 && opportunities[currentEditRowIndex]) {
        return opportunities[currentEditRowIndex].uid;
    }
    return null;
}

function showSyncSuccessMessage(syncedData) {
    const message = `Successfully synced data from Drive:\n` +
                   `• Revision: ${syncedData.revisionNumber !== null && syncedData.revisionNumber !== undefined ? syncedData.revisionNumber : 'N/A'}\n` +
                   `• Margin: ${syncedData.margin ? syncedData.margin.toFixed(2) + '%' : 'N/A'}\n` +
                   `• Amount: ${syncedData.finalAmount ? '₱' + formatNumberWithCommas(syncedData.finalAmount) : 'N/A'}\n` +
                   `• File: ${syncedData.excelFileName || 'N/A'}`;
    
    alert(message);
}

function showSyncErrorMessage(errorMessage) {
    alert(`Sync failed: ${errorMessage}`);
}

// Initialize when app is ready
document.addEventListener('DOMContentLoaded', initializeUserInfoOnDOMReady);

// Login success is now handled by shared-navigation.js
function onLoginSuccess() {
    console.log('[USER-INFO] Login success handling is now managed by shared navigation');
}

// Update the existing initializeApp function to include user info initialization
const originalInitializeApp = initializeApp;
if (typeof initializeApp === 'function') {
    initializeApp = async function() {
        await originalInitializeApp();
        initializeUserInfoOnDOMReady();
    };
}

// User Info and Online Users Functionality
function initializeUserInfo() {
    // User info is now handled by shared-navigation.js
    console.log('[USER-INFO] User info initialization is now handled by shared navigation');
    return;
    
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Ensure the navigation elements are present before updating
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');

    if (!userNameEl || !userRoleEl) {
        // Wait for shared navigation to finish loading, then retry once
        document.addEventListener('navigationLoaded', () => {
            initializeUserInfo();
        }, { once: true });
        return;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    userNameEl.textContent = payload.name;
    userRoleEl.textContent = payload.role;
}

// Online Users Tracking
function startHeartbeat() {
    // Send initial heartbeat
    sendHeartbeat();
    
    // Set up periodic heartbeat
    heartbeatInterval = setInterval(sendHeartbeat, 30000);
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearInterval(heartbeatInterval);
        } else {
            sendHeartbeat();
            heartbeatInterval = setInterval(sendHeartbeat, 30000);
        }
    });
}

async function sendHeartbeat() {
    try {
        const token = localStorage.getItem('authToken');
        console.log('[HEARTBEAT] Sending heartbeat with token:', token ? 'present' : 'missing');
        
        const response = await fetch(getApiUrl(window.APP_CONFIG.ENDPOINTS.HEARTBEAT), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPage: window.location.pathname
            })
        });
        
        console.log('[HEARTBEAT] Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[HEARTBEAT] Server error response:', errorText);
            throw new Error(`Heartbeat failed: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('[HEARTBEAT] Success response:', data);
        
        // Update online users list
        updateOnlineUsers();
    } catch (error) {
        console.error('Error sending heartbeat:', error);
    }
}

async function updateOnlineUsers() {
    // Online users functionality is now handled by shared-navigation.js
    console.log('[ONLINE-USERS] Online users functionality is now handled by shared navigation');
    return;
    
    try {
        const response = await fetch('/api/online-users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch online users');
        }
        
        const users = await response.json();
        
        // Safely update counter - check if element exists
        const onlineUsersCountEl = document.getElementById('onlineUsersCount');
        if (onlineUsersCountEl) {
            onlineUsersCountEl.textContent = users.length;
        }
        
        // Safely update dropdown list - check if element exists
        const usersListEl = document.getElementById('onlineUsersList');
        if (usersListEl) {
            usersListEl.innerHTML = users.map(user => `
                <div class="flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <div class="flex items-center space-x-2">
                        <span class="material-icons text-gray-500 dark:text-gray-400">account_circle</span>
                        <span class="text-sm text-gray-700 dark:text-gray-300">${user.name}</span>
                    </div>
                    <span class="text-xs text-gray-500 dark:text-gray-400">${user.currentPage}</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error updating online users:', error);
    }
}

// Safely initialize the online-users dropdown after the required elements are in the DOM
function initializeOnlineUsersDropdown() {
    const button = document.getElementById('onlineUsersButton');
    const dropdown = document.getElementById('onlineUsersDropdown');

    // If either element is missing, exit early. This prevents runtime errors on pages
    // that do not include the shared navigation or render it asynchronously.
    if (!button || !dropdown) {
        return;
    }

    // Toggle dropdown visibility when the button is clicked
    button.addEventListener('click', () => {
        dropdown.classList.toggle('hidden');
    });

    // Hide the dropdown when clicking outside of it
    document.addEventListener('click', (event) => {
        if (!dropdown.contains(event.target) && !button.contains(event.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

// Initialize features when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // initializeUserInfo(); // Now handled by shared navigation
    startHeartbeat();
    initializeOnlineUsersDropdown();
    
    // Add global click listener to save preferences before navigation
    document.addEventListener('click', function(e) {
        // Check if clicked element is a navigation link
        const link = e.target.closest('a[href]');
        if (link && link.href && link.href.includes('.html') && getCurrentUserId()) {
            // Save preferences before navigation
            saveUserPreferences();
            console.log('[PREFERENCES] Saved preferences before navigation to:', link.href);
        }
    });
});

// Re-initialize the online users dropdown once shared navigation has fully loaded
document.addEventListener('navigationLoaded', () => {
    initializeOnlineUsersDropdown();
    // Also update online users display if we have data
    // updateOnlineUsers(); // Now handled by shared navigation
});

// =====================================
// CREATE MODAL TABS FUNCTIONALITY
// =====================================

// Global variable to store import preview data
let importPreviewData = null;

// Set up tab functionality for create modal
function setupCreateModalTabs() {
    const createNewTab = document.getElementById('createNewTab');
    const importFromDriveTab = document.getElementById('importFromDriveTab');
    const createForm = document.getElementById('createOpportunityForm');
    const importContent = document.getElementById('importFromDriveContent');
    const saveButton = document.getElementById('saveCreateOpportunityButton');
    const confirmButton = document.getElementById('confirmImportButton');
    
    // Set up tab click handlers
    if (createNewTab) {
        createNewTab.addEventListener('click', () => switchToCreateTab());
    }
    
    if (importFromDriveTab) {
        importFromDriveTab.addEventListener('click', () => switchToImportTab());
    }
    
    // Set up import functionality
    setupImportTabEventListeners();
    
    // Start on create tab
    switchToCreateTab();
}

// Switch to create new tab
function switchToCreateTab() {
    // Update tab buttons
    const createTab = document.getElementById('createNewTab');
    const importTab = document.getElementById('importFromDriveTab');
    const createForm = document.getElementById('createOpportunityForm');
    const importContent = document.getElementById('importFromDriveContent');
    const saveButton = document.getElementById('saveCreateOpportunityButton');
    const confirmButton = document.getElementById('confirmImportButton');
    
    if (createTab) {
        createTab.classList.add('active', 'border-blue-600', 'text-blue-600');
        createTab.classList.remove('border-transparent', 'text-gray-500');
    }
    
    if (importTab) {
        importTab.classList.remove('active', 'border-blue-600', 'text-blue-600');
        importTab.classList.add('border-transparent', 'text-gray-500');
    }
    
    // Show/hide content
    if (createForm) createForm.classList.remove('hidden');
    if (importContent) importContent.classList.add('hidden');
    
    // Show/hide buttons
    if (saveButton) saveButton.classList.remove('hidden');
    if (confirmButton) confirmButton.classList.add('hidden');
}

// Switch to import tab
function switchToImportTab() {
    // Update tab buttons
    const createTab = document.getElementById('createNewTab');
    const importTab = document.getElementById('importFromDriveTab');
    const createForm = document.getElementById('createOpportunityForm');
    const importContent = document.getElementById('importFromDriveContent');
    const saveButton = document.getElementById('saveCreateOpportunityButton');
    const confirmButton = document.getElementById('confirmImportButton');
    
    if (createTab) {
        createTab.classList.remove('active', 'border-blue-600', 'text-blue-600');
        createTab.classList.add('border-transparent', 'text-gray-500');
    }
    
    if (importTab) {
        importTab.classList.add('active', 'border-blue-600', 'text-blue-600');
        importTab.classList.remove('border-transparent', 'text-gray-500');
    }
    
    // Show/hide content
    if (createForm) createForm.classList.add('hidden');
    if (importContent) importContent.classList.remove('hidden');
    
    // Show/hide buttons
    if (saveButton) saveButton.classList.add('hidden');
    if (confirmButton) confirmButton.classList.remove('hidden');
    
    // Reset import state
    resetImportTab();
    
    // Focus on search input
    const searchInput = document.getElementById('folderSearchInput');
    if (searchInput) {
        setTimeout(() => searchInput.focus(), 100);
    }
}

// Reset import tab to initial state
function resetImportTab() {
    // Clear search input
    const searchInput = document.getElementById('folderSearchInput');
    if (searchInput) searchInput.value = '';
    
    const manualInput = document.getElementById('manualFolderIdInput');
    if (manualInput) manualInput.value = '';
    
    // Hide sections
    hideElement('folderSearchResults');
    hideElement('importProgressSection');
    hideElement('importPreviewSection');
    
    // Show empty state
    showElement('importEmptyState');
    
    // Clear global data
    importPreviewData = null;
}

// Set up event listeners for import tab
function setupImportTabEventListeners() {
    // Search button
    const searchButton = document.getElementById('searchFoldersButton');
    const searchInput = document.getElementById('folderSearchInput');
    
    if (searchButton) {
        searchButton.addEventListener('click', performFolderSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performFolderSearch();
            }
        });
    }
    
    // Manual import button
    const manualImportButton = document.getElementById('importFromManualFolderButton');
    if (manualImportButton) {
        manualImportButton.addEventListener('click', importFromManualFolder);
    }
    
    // Confirm import button
    const confirmButton = document.getElementById('confirmImportButton');
    if (confirmButton) {
        confirmButton.addEventListener('click', confirmImportAndCreateOpportunity);
    }
}

// Perform folder search
async function performFolderSearch() {
    const searchInput = document.getElementById('folderSearchInput');
    const searchQuery = searchInput?.value?.trim() || '';
    
    console.log(`🔍 Searching for folders with query: "${searchQuery}"`);
    
    // Show loading state
    hideElement('importEmptyState');
    showElement('folderSearchResults');
    
    const resultsList = document.getElementById('folderSearchResultsList');
    const resultsCount = document.getElementById('searchResultsCount');
    
    if (resultsList) {
        resultsList.innerHTML = `
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p class="text-gray-600 dark:text-gray-400">Searching Google Drive folders...</p>
            </div>
        `;
    }
    
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        // Use existing Google Drive search endpoint
        const response = await fetch(getApiUrl(`/api/google-drive/folders/search?q=${encodeURIComponent(searchQuery)}`), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.folders) {
            displayFolderSearchResults(data.folders);
            if (resultsCount) {
                resultsCount.textContent = `${data.folders.length} folders found`;
            }
        } else {
            throw new Error(data.error || 'Failed to search folders');
        }
        
    } catch (error) {
        console.error('Folder search failed:', error);
        if (resultsList) {
            resultsList.innerHTML = `
                <div class="text-center py-8 text-red-600">
                    <span class="material-icons text-4xl mb-2">error</span>
                    <p class="font-medium">Search failed</p>
                    <p class="text-sm">${error.message}</p>
                </div>
            `;
        }
    }
}

// Display folder search results
function displayFolderSearchResults(folders) {
    const resultsList = document.getElementById('folderSearchResultsList');
    
    if (!resultsList) return;
    
    if (folders.length === 0) {
        resultsList.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <span class="material-icons text-4xl mb-2">folder_off</span>
                <p>No folders found</p>
                <p class="text-sm">Try a different search term or use the manual input below</p>
            </div>
        `;
        return;
    }
    
    const resultsHtml = folders.map(folder => `
        <div class="folder-result-item border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
             data-folder-id="${folder.id}" data-folder-name="${folder.name}">
            <div class="flex items-start justify-between">
                <div class="flex items-start space-x-3">
                    <div class="flex-shrink-0">
                        <span class="material-icons text-2xl ${folder.isInOP100Folder ? 'text-blue-600' : 'text-gray-600'}">${folder.isInOP100Folder ? 'folder_special' : 'folder'}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate">${folder.name}</h4>
                        <div class="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                            ${folder.location ? `<span class="flex items-center"><span class="material-icons text-xs mr-1">folder</span>${folder.location}</span>` : ''}
                            ${folder.createdTime ? `<span class="flex items-center"><span class="material-icons text-xs mr-1">schedule</span>${new Date(folder.createdTime).toLocaleDateString()}</span>` : ''}
                        </div>
                    </div>
                </div>
                <button class="import-folder-btn flex-shrink-0 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center space-x-1">
                    <span class="material-icons text-sm">file_download</span>
                    <span>Import</span>
                </button>
            </div>
        </div>
    `).join('');
    
    resultsList.innerHTML = resultsHtml;
    
    // Add click handlers
    resultsList.querySelectorAll('.import-folder-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const item = this.closest('.folder-result-item');
            const folderId = item.dataset.folderId;
            const folderName = item.dataset.folderName;
            
            importProjectDataFromFolder(folderId, folderName);
        });
    });
}

// Import from manual folder input
async function importFromManualFolder() {
    const manualInput = document.getElementById('manualFolderIdInput');
    const folderId = manualInput?.value?.trim();
    
    if (!folderId) {
        alert('Please enter a Google Drive folder ID or URL');
        return;
    }
    
    console.log(`📁 Importing from manual folder input: ${folderId}`);
    await importProjectDataFromFolder(folderId);
}

// Main function to import project data from a folder
async function importProjectDataFromFolder(folderId, folderName = null) {
    console.log(`📁 Starting import from folder: ${folderId}`);
    
    // Show progress in the new modal
    hideElement('importSearchState');
    hideElement('importResultsState');
    hideElement('importPreviewState');
    hideElement('importNoResultsState');
    showElement('importLoadingState');
    
    const progressText = document.getElementById('importLoadingText');
    
    try {
        if (progressText) progressText.textContent = 'Connecting to Google Drive...';
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('No authentication token found');
        }
        
        if (progressText) progressText.textContent = 'Analyzing folder contents...';
        
        // Call the parse folder API
        const response = await fetch(getApiUrl('/api/google-drive/parse-folder-for-creation'), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ folderId: folderId })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to parse folder data');
        }
        
        if (progressText) progressText.textContent = 'Data extracted successfully!';
        
        // Store the import data
        importPreviewData = {
            projectData: data.projectData,
            folderData: data.folderData,
            excelFile: data.excelFile
        };
        
        // Show preview
        setTimeout(() => {
            console.log('🔄 Switching from loading to preview state...');
            hideElement('importLoadingState');
            displayImportPreview(importPreviewData);
            showElement('importPreviewState');
            
            const previewState = document.getElementById('importPreviewState');
            console.log('🔍 Preview state element:', previewState);
            console.log('🔍 Preview state classes:', previewState?.className);
            console.log('🔍 Preview state style.display:', previewState?.style.display);
            console.log('🔍 Preview state computed display:', window.getComputedStyle(previewState).display);
            console.log('🔍 Preview state offsetHeight:', previewState?.offsetHeight);
            console.log('🔍 Preview state classList contains hidden:', previewState?.classList.contains('hidden'));
            
            // Update button text to be clearer
            const confirmButton = document.getElementById('confirmImportButton');
            if (confirmButton) {
                confirmButton.innerHTML = '<span class="material-icons">edit</span>Use This Data';
                confirmButton.classList.remove('hidden');
            }
        }, 500);
        
    } catch (error) {
        console.error('Failed to import project data:', error);
        
        hideElement('importLoadingState');
        showElement('importResultsState');
        
        // Show error message
        showErrorNotification(`Import failed: ${error.message}`);
    }
}

// Display import preview
function displayImportPreview(data) {
    console.log('🔍 displayImportPreview called with data:', data);
    console.log('🔍 Data structure check:', {
        hasProjectData: !!data.projectData,
        hasFolderData: !!data.folderData,
        hasExcelFile: !!data.excelFile,
        excelFileValue: data.excelFile
    });
    
    const projectInfoDiv = document.getElementById('modalImportPreviewProjectInfo');
    const financialInfoDiv = document.getElementById('modalImportPreviewFinancialInfo');
    const sourceInfoDiv = document.getElementById('modalImportPreviewSourceInfo');
    
    console.log('🔍 Found elements:', { projectInfoDiv, financialInfoDiv, sourceInfoDiv });
    
    // Fix text visibility by updating CSS classes
    if (projectInfoDiv) {
        projectInfoDiv.className = 'space-y-1 text-sm text-gray-900 dark:text-gray-100';
    }
    if (financialInfoDiv) {
        financialInfoDiv.className = 'space-y-1 text-sm text-gray-900 dark:text-gray-100';
    }
    if (sourceInfoDiv) {
        sourceInfoDiv.className = 'text-sm text-gray-900 dark:text-gray-100';
    }
    
    if (projectInfoDiv) {
        const content = `
            <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Project Name:</strong> ${data.projectData.projectName || 'Not found'}</div>
            <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Project Code:</strong> ${data.projectData.projectCode || 'Not found'}</div>
            <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Revision:</strong> ${data.projectData.revision !== null && data.projectData.revision !== undefined ? data.projectData.revision : 'Not found'}</div>
            <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Client:</strong> ${data.projectData.clientName || 'Not found'}</div>
            <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>PIC:</strong> ${data.projectData.pic || 'Not found'}</div>
            <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Account Manager:</strong> ${data.projectData.accountManager || 'Not found'}</div>
        `;
        projectInfoDiv.innerHTML = content;
        console.log('🔍 Project info populated with responsive classes');
    }
    
    if (financialInfoDiv) {
        financialInfoDiv.innerHTML = `
            <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Margin:</strong> ${data.projectData.margin !== null ? data.projectData.margin + '%' : 'Not found'}</div>
            <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Final Amount:</strong> ${data.projectData.finalAmount !== null ? formatNumberWithCommas(data.projectData.finalAmount) : 'Not found'}</div>
        `;
    }
    
    if (sourceInfoDiv) {
        let sourceInfo = `<div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Google Drive Folder:</strong> ${data.folderData.name}</div>`;
        
        if (data.excelFile && data.excelFile.name) {
            sourceInfo += `
                <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Excel File:</strong> ${data.excelFile.name}</div>
                <div class="text-gray-900 dark:text-gray-100 mb-1"><strong>Last Modified:</strong> ${new Date(data.excelFile.modifiedTime).toLocaleDateString()}</div>
            `;
        } else {
            sourceInfo += `<div class="text-gray-900 dark:text-gray-100 mb-1 text-yellow-600 dark:text-yellow-400"><strong>Data Source:</strong> Extracted from folder name (no calcsheet found)</div>`;
        }
        
        sourceInfoDiv.innerHTML = sourceInfo;
    }
}

// Confirm import and populate form for editing
async function confirmImportAndCreateOpportunity() {
    if (!importPreviewData) {
        showErrorNotification('No import data available');
        return;
    }
    
    console.log('✅ Using imported data to create new opportunity');
    
    try {
        // Store the imported data globally for the create modal
        window.pendingImportData = importPreviewData;
        
        // Store the folder data separately for automatic linking after opportunity creation
        if (importPreviewData.folderData) {
            window.importedFolderData = importPreviewData.folderData;
            console.log('📁 Stored folder data for automatic linking:', importPreviewData.folderData.name);
        }
        
        // Close the import modal first
        hideImportResultsModal();
        
        // Give a moment for the modal to close
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Open a fresh create opportunity modal
        await showCreateOpportunityModal();
        
        // Give the DOM a moment to create the form
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Populate dropdowns first
        populateCreateModalDropdowns();
        
        // Wait for dropdowns to populate
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Populate the form with imported data
        populateCreateFormWithImportedData(window.pendingImportData);
        
        // Store the folder data for later linking when opportunity is created
        window.importedFolderData = window.pendingImportData.folderData;
        
        // Clear the pending data
        window.pendingImportData = null;
        
        // Show success message
        showSuccessNotification('Data imported successfully! Review and modify as needed, then click "Create Opportunity".');
        
        // Scroll the modal content to the top and ensure focus
        const createForm = document.getElementById('createOpportunityForm');
        if (createForm) {
            createForm.scrollTop = 0;
            console.log('📜 Create modal scrolled to top after import');
        }
        
        // Focus on the first input field
        const firstInput = document.querySelector('#createOpportunityForm input');
        if (firstInput) {
            setTimeout(() => {
                firstInput.focus();
                console.log('🎯 Focus set on first input field in create modal');
            }, 300);
        }
        
    } catch (error) {
        console.error('❌ Failed to create opportunity from import:', error);
        showErrorNotification(`Failed to use imported data: ${error.message}`);
    }
}

// Helper function to clear import search results
function clearImportSearch() {
    console.log('🧹 Clearing import search results');
    
    // Clear search input
    const searchInput = document.getElementById('folderSearchInput');
    if (searchInput) searchInput.value = '';
    
    // Clear manual input
    const manualInput = document.getElementById('manualFolderInput');
    if (manualInput) manualInput.value = '';
    
    // Hide search results
    const searchResults = document.getElementById('searchResults');
    if (searchResults) searchResults.style.display = 'none';
    
    // Hide progress section
    const progressSection = document.getElementById('importProgress');
    if (progressSection) progressSection.style.display = 'none';
    
    // Hide preview section
    const previewSection = document.getElementById('importPreview');
    if (previewSection) previewSection.style.display = 'none';
    
    // Reset import data
    window.importPreviewData = null;
}

// Helper function to populate create form with imported data
function populateCreateFormWithImportedData(data) {
    console.log('📝 Populating form with imported data:', data.projectData);
    
    // Verify form exists
    const form = document.getElementById('createOpportunityForm');
    if (!form) {
        console.error('❌ Create form not found - cannot populate fields');
        return;
    }
    
    let fieldsPopulated = 0;
    let fieldsAttempted = 0;
    
    // Helper function to set field value with error handling
    function setFieldValue(fieldId, value, fieldName) {
        fieldsAttempted++;
        const field = document.getElementById(fieldId);
        if (field && value) {
            field.value = value;
            fieldsPopulated++;
            console.log(`✅ Set ${fieldName}: ${value}`);
        } else if (!field) {
            console.warn(`⚠️ Field ${fieldId} not found for ${fieldName}`);
        } else {
            console.log(`ℹ️ No value to set for ${fieldName}`);
        }
    }
    
    // Helper function to set dropdown value
    function setDropdownValue(fieldId, value, fieldName) {
        fieldsAttempted++;
        const field = document.getElementById(fieldId);
        if (field && value) {
            let optionSet = false;
            for (let option of field.options) {
                if (option.value === value || option.text === value) {
                    option.selected = true;
                    optionSet = true;
                    fieldsPopulated++;
                    console.log(`✅ Set ${fieldName} dropdown: ${value}`);
                    break;
                }
            }
            if (!optionSet) {
                console.warn(`⚠️ No matching option found for ${fieldName}: ${value}`);
            }
        } else if (!field) {
            console.warn(`⚠️ Dropdown ${fieldId} not found for ${fieldName}`);
        }
    }
    
    // Project basic information
    setFieldValue('newProjectName', data.projectData.projectName, 'Project Name');
    setFieldValue('newProjectCode', data.projectData.projectCode, 'Project Code');
    setFieldValue('newRev', data.projectData.revision, 'Revision');
    setFieldValue('newClient', data.projectData.clientName, 'Client');
    
    // Dropdown fields
    setDropdownValue('newPIC', data.projectData.pic, 'PIC');
    setDropdownValue('newAccountMgr', data.projectData.accountManager, 'Account Manager');
    
    // Financial information
    if (data.projectData.margin !== null && data.projectData.margin !== undefined) {
        setFieldValue('newMargin', data.projectData.margin, 'Margin');
    }
    
    if (data.projectData.finalAmount !== null && data.projectData.finalAmount !== undefined) {
        const formatted = formatNumberWithCommas(data.projectData.finalAmount);
        setFieldValue('newFinalAmount', formatted, 'Final Amount');
    }
    
    // Set default values for required fields
    const today = new Date().toISOString().split('T')[0];
    const dateReceivedField = document.getElementById('newDateReceived');
    if (dateReceivedField && !dateReceivedField.value) {
        dateReceivedField.value = today;
    }
    
    const encodedDateField = document.getElementById('newEncodedDate');
    if (encodedDateField && !encodedDateField.value) {
        encodedDateField.value = today;
    }
    
    // Set default status if not set
    const statusField = document.getElementById('newOppStatus');
    if (statusField && !statusField.value) {
        statusField.value = 'OP30';
    }
    
    console.log(`✅ Form population complete: ${fieldsPopulated}/${fieldsAttempted} fields successfully populated`);
}

// Helper functions
function showElement(id) {
    const element = document.getElementById(id);
    if (element) element.classList.remove('hidden');
}

function hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.classList.add('hidden');
}

// ===== MULTI-LEVEL SORTING FUNCTIONS =====

// Initialize advanced sorting panel
function initAdvancedSorting() {
    const advancedSortToggle = document.getElementById('advancedSortToggle');
    const advancedSortPanel = document.getElementById('advancedSortPanel');
    const sortToggleIcon = document.getElementById('sortToggleIcon');
    const addSortCriteria = document.getElementById('addSortCriteria');
    const clearAllSorts = document.getElementById('clearAllSorts');
    
    if (!advancedSortToggle || !advancedSortPanel) return;
    
    // Toggle advanced sorting panel
    advancedSortToggle.addEventListener('click', () => {
        const isHidden = advancedSortPanel.classList.contains('hidden');
        if (isHidden) {
            advancedSortPanel.classList.remove('hidden');
            sortToggleIcon.textContent = 'expand_less';
        } else {
            advancedSortPanel.classList.add('hidden');
            sortToggleIcon.textContent = 'expand_more';
        }
    });
    
    // Add sort criteria
    addSortCriteria?.addEventListener('click', () => {
        addSortCriterion();
    });
    
    // Clear all sorts
    clearAllSorts?.addEventListener('click', () => {
        clearAllSortCriteria();
    });
    
    updateSortDisplay();
}

// Add a new sort criterion
function addSortCriterion(columnIndex = null, direction = 'asc') {
    // Auto-select first available column if none specified
    if (columnIndex === null && headers.length > 0) {
        // Find first column not already in sort criteria
        for (let i = 0; i < headers.length; i++) {
            if (!sortCriteria.find(c => c.columnIndex === i)) {
                columnIndex = i;
                break;
            }
        }
        if (columnIndex === null) columnIndex = 0; // fallback to first column
    }
    
    const columnName = headers[columnIndex];
    const criterion = {
        columnIndex: columnIndex,
        direction: direction,
        columnName: columnName
    };
    
    sortCriteria.push(criterion);
    renderSortCriteria();
    filterAndSortData();
    updateSortIndicators();
    updateSortDisplay();
    saveUserPreferences();
}

// Remove sort criterion
function removeSortCriterion(index) {
    sortCriteria.splice(index, 1);
    renderSortCriteria();
    filterAndSortData();
    updateSortIndicators();
    updateSortDisplay();
    saveUserPreferences();
}

// Move sort criterion up or down in priority
function moveSortCriterion(index, direction) {
    if (direction === 'up' && index > 0) {
        [sortCriteria[index], sortCriteria[index - 1]] = [sortCriteria[index - 1], sortCriteria[index]];
    } else if (direction === 'down' && index < sortCriteria.length - 1) {
        [sortCriteria[index], sortCriteria[index + 1]] = [sortCriteria[index + 1], sortCriteria[index]];
    }
    
    renderSortCriteria();
    filterAndSortData();
    updateSortIndicators();
    updateSortDisplay();
    saveUserPreferences();
}

// Functions are now called via event listeners, no need for global access

// Clear all sort criteria
function clearAllSortCriteria() {
    sortCriteria = [];
    // Also clear legacy sorting
    currentSortColumnIndex = -1;
    currentSortDirection = 'asc';
    
    renderSortCriteria();
    filterAndSortData();
    updateSortIndicators();
    updateSortDisplay();
    saveUserPreferences();
}

// Render sort criteria list
function renderSortCriteria() {
    const container = document.getElementById('sortCriteriaList');
    const emptyState = document.getElementById('emptySortState');
    
    if (!container || !emptyState) return;
    
    if (sortCriteria.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    container.innerHTML = sortCriteria.map((criterion, index) => {
        const columnOptions = headers.map((header, headerIndex) => 
            `<option value="${headerIndex}" ${headerIndex === criterion.columnIndex ? 'selected' : ''}>
                ${formatHeaderText(header)}
            </option>`
        ).join('');
        
        return `
            <div class="sort-criteria-item" data-index="${index}">
                <div class="sort-priority-badge">${index + 1}</div>
                
                <select class="sort-column-select" data-index="${index}">
                    ${columnOptions}
                </select>
                
                <button class="sort-direction-btn ${criterion.direction}" data-index="${index}" data-action="direction">
                    <span class="material-icons text-xs">${criterion.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                    <span>${criterion.direction.toUpperCase()}</span>
                </button>
                
                <div class="flex items-center gap-1">
                    ${index > 0 ? `<button class="sort-move-btn" data-index="${index}" data-direction="up" title="Move Up">
                        <span class="material-icons text-sm">keyboard_arrow_up</span>
                    </button>` : ''}
                    
                    ${index < sortCriteria.length - 1 ? `<button class="sort-move-btn" data-index="${index}" data-direction="down" title="Move Down">
                        <span class="material-icons text-sm">keyboard_arrow_down</span>
                    </button>` : ''}
                </div>
                
                <button class="sort-remove-btn" data-index="${index}" title="Remove">
                    <span class="material-icons text-sm">close</span>
                </button>
            </div>
        `;
    }).join('');
    
    // Add event listeners after HTML is generated
    attachSortCriteriaEventListeners();
}

// Attach event listeners to sort criteria elements
function attachSortCriteriaEventListeners() {
    const container = document.getElementById('sortCriteriaList');
    if (!container) return;
    
    // Column select dropdowns
    container.querySelectorAll('.sort-column-select').forEach(select => {
        select.addEventListener('change', function() {
            const index = parseInt(this.dataset.index);
            updateSortCriterion(index, 'column', this.value);
        });
    });
    
    // Direction toggle buttons
    container.querySelectorAll('.sort-direction-btn').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            updateSortCriterion(index, 'direction');
        });
    });
    
    // Move up/down buttons
    container.querySelectorAll('.sort-move-btn').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const direction = this.dataset.direction;
            moveSortCriterion(index, direction);
        });
    });
    
    // Remove buttons
    container.querySelectorAll('.sort-remove-btn').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            removeSortCriterion(index);
        });
    });
}

// Update sort criterion
function updateSortCriterion(index, type, value) {
    if (index >= sortCriteria.length) return;
    
    if (type === 'column') {
        sortCriteria[index].columnIndex = parseInt(value);
        sortCriteria[index].columnName = headers[parseInt(value)];
    } else if (type === 'direction') {
        sortCriteria[index].direction = sortCriteria[index].direction === 'asc' ? 'desc' : 'asc';
    }
    
    renderSortCriteria();
    filterAndSortData();
    updateSortIndicators();
    updateSortDisplay();
    saveUserPreferences();
}

// Functions are now called via event listeners, no need for global access

// Update sort display
function updateSortDisplay() {
    const display = document.getElementById('currentSortDisplay');
    if (!display) return;
    
    if (sortCriteria.length === 0 && currentSortColumnIndex === -1) {
        display.textContent = '';
        return;
    }
    
    if (sortCriteria.length > 0) {
        const sortText = sortCriteria.map((criterion, index) => 
            `${index + 1}. ${formatHeaderText(criterion.columnName)} (${criterion.direction.toUpperCase()})`
        ).join(', ');
        display.textContent = sortText;
    } else {
        // Legacy single sort display
        display.textContent = `${formatHeaderText(headers[currentSortColumnIndex])} (${currentSortDirection.toUpperCase()})`;
    }
}

// ===== MULTI-SELECT CELL FUNCTIONALITY (Excel/Google Sheets style) =====

let selectedCells = new Set(); // Store selected cell references
let isSelectingCells = false;
let lastSelectedCell = null;

// Initialize multi-select functionality
function initMultiSelectCells() {
    // Add CSS for selected cells
    if (!document.getElementById('multiSelectStyles')) {
        const style = document.createElement('style');
        style.id = 'multiSelectStyles';
        style.textContent = `
            table td.selected-cell,
            .table-container td.selected-cell,
            #opportunitiesTable td.selected-cell {
                background-color: #e3f2fd !important;
                border: 3px solid #1976d2 !important;
                box-shadow: 
                    inset 0 0 0 1px #1976d2, 
                    0 0 0 2px #1976d2, 
                    0 0 8px rgba(25, 118, 210, 0.3) !important;
                position: relative !important;
                z-index: 10 !important;
                animation: cellSelected 0.2s ease-out !important;
            }
            html.dark table td.selected-cell,
            html.dark .table-container td.selected-cell,
            html.dark #opportunitiesTable td.selected-cell {
                background-color: #1a237e !important;
                border-color: #3f51b5 !important;
                box-shadow: 
                    inset 0 0 0 1px #3f51b5, 
                    0 0 0 2px #3f51b5, 
                    0 0 8px rgba(63, 81, 181, 0.4) !important;
            }
            @keyframes cellSelected {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
            .selectable-cell {
                cursor: pointer !important;
                transition: all 0.1s ease !important;
                position: relative !important;
            }
            .selectable-cell:hover:not(.selected-cell) {
                background-color: rgba(33, 150, 243, 0.1) !important;
                box-shadow: inset 0 0 0 1px rgba(33, 150, 243, 0.3) !important;
            }
            html.dark .selectable-cell:hover:not(.selected-cell) {
                background-color: rgba(144, 202, 249, 0.1) !important;
                box-shadow: inset 0 0 0 1px rgba(144, 202, 249, 0.3) !important;
            }
            body.multi-select-mode {
                cursor: crosshair;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add summary display container
    if (!document.getElementById('cellSummaryDisplay')) {
        const summaryDiv = document.createElement('div');
        summaryDiv.id = 'cellSummaryDisplay';
        summaryDiv.className = 'fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border hidden z-50';
        summaryDiv.innerHTML = `
            <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">Selected cells:</div>
            <div id="selectedCellCount" class="text-sm font-semibold mb-2">0 cells</div>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div>Sum: <span id="selectedSum" class="font-mono">0</span></div>
                <div>Avg: <span id="selectedAvg" class="font-mono">0</span></div>
                <div>Count: <span id="selectedCount" class="font-mono">0</span></div>
                <div>Max: <span id="selectedMax" class="font-mono">0</span></div>
            </div>
            <div class="mt-2 pt-2 border-t text-xs text-gray-500">
                <div>Hold Ctrl/⌘ to multi-select</div>
                <div>Hold Shift for range select</div>
                <div>Press Esc to clear</div>
            </div>
        `;
        document.body.appendChild(summaryDiv);
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', handleCellSelectionKeyboard);
    document.addEventListener('keyup', handleCellSelectionKeyboard);
}

// Clear cell selection
function clearCellSelection() {
    selectedCells.clear();
    document.querySelectorAll('.selected-cell').forEach(cell => {
        cell.classList.remove('selected-cell');
    });
    updateCellSummary();
}

// Update summary calculations
function updateCellSummary() {
    const summaryDisplay = document.getElementById('cellSummaryDisplay');
    if (!summaryDisplay) return;
    
    if (selectedCells.size === 0) {
        summaryDisplay.classList.add('hidden');
        return;
    }
    
    summaryDisplay.classList.remove('hidden');
    
    const values = [];
    selectedCells.forEach(cellRef => {
        const cell = document.querySelector(`[data-cell-ref="${cellRef}"]`);
        if (cell) {
            const text = cell.textContent.trim();
            // Try to extract numeric value - handle currency and percentages
            const cleanText = text.replace(/[₱$,%\s]/g, '');
            const numericValue = parseFloat(cleanText);
            if (!isNaN(numericValue)) {
                values.push(numericValue);
            }
        }
    });
    
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length > 0 ? sum / values.length : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    
    document.getElementById('selectedCellCount').textContent = `${selectedCells.size} cells`;
    document.getElementById('selectedSum').textContent = formatNumber(sum);
    document.getElementById('selectedAvg').textContent = formatNumber(avg);
    document.getElementById('selectedCount').textContent = values.length;
    document.getElementById('selectedMax').textContent = formatNumber(max);
}

// Handle keyboard shortcuts
function handleCellSelectionKeyboard(event) {
    if (event.type === 'keydown' && event.key === 'Escape') {
        clearCellSelection();
    }
    
    // Track ctrl/cmd key for multi-select mode
    if (event.ctrlKey || event.metaKey) {
        document.body.classList.add('multi-select-mode');
    } else if (event.type === 'keyup') {
        document.body.classList.remove('multi-select-mode');
    }
}

// Format number for summary display
function formatNumber(value) {
    if (!value || isNaN(value)) return '0';
    
    // If it looks like currency (> 1000), format as currency
    if (Math.abs(value) >= 1000) {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    }
    
    // Otherwise format as number with 2 decimals
    return value.toFixed(2);
}

// Check if a column is selectable for multi-select functionality
function isSelectableColumn(header) {
    const selectableColumns = [
        'final', 'finalamt', 'margin', 'cost', 'price', 'amount', 'total', 
        'budget', 'revenue', 'profit', 'percentage', 'rate', 'amt'
    ];
    const normalizedHeader = normalizeField(header);
    return selectableColumns.some(col => normalizedHeader.includes(col.toLowerCase()));
}

// Handle toggle selection (Ctrl/Cmd + click)
function handleCellToggleSelect(td, cellRef, cellValue) {
    if (selectedCells.has(cellRef)) {
        // Unselect cell
        selectedCells.delete(cellRef);
        td.classList.remove('selected-cell');
    } else {
        // Select cell
        selectedCells.add(cellRef);
        td.classList.add('selected-cell');
    }
    lastSelectedCell = cellRef;
}

// Handle single cell selection (regular click)
function handleCellSingleSelect(td, cellRef, cellValue) {
    // Clear all previous selections
    clearCellSelection();
    
    // Select new cell
    selectedCells.add(cellRef);
    td.classList.add('selected-cell');
    lastSelectedCell = cellRef;
}

// Handle range selection (Shift + click)
function handleCellRangeSelect(td, cellRef, cellValue) {
    if (!lastSelectedCell) {
        // No previous selection, treat as single select
        handleCellSingleSelect(td, cellRef, cellValue);
        return;
    }
    
    // Parse cell references to get row and column info
    const [startRow, startCol] = lastSelectedCell.split('-');
    const [endRow, endCol] = cellRef.split('-');
    
    // Select all cells in the same column between start and end rows
    if (startCol === endCol) {
        const startRowIndex = parseInt(startRow);
        const endRowIndex = parseInt(endRow);
        const minRow = Math.min(startRowIndex, endRowIndex);
        const maxRow = Math.max(startRowIndex, endRowIndex);
        
        for (let row = minRow; row <= maxRow; row++) {
            const rangeRef = `${row}-${startCol}`;
            const cellElement = document.querySelector(`[data-cell-ref="${rangeRef}"]`);
            if (cellElement) {
                selectedCells.add(rangeRef);
                cellElement.classList.add('selected-cell');
            }
        }
    }
}

// Wrapper function to maintain compatibility
function updateCellSelectionSummary() {
    updateCellSummary();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    clearInterval(heartbeatInterval);
    // Save user preferences before page unload to prevent data loss
    if (getCurrentUserId()) {
        saveUserPreferences();
        console.log('[PREFERENCES] Saved preferences before page unload');
    }
});