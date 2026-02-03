// win-loss_dashboard.js - All logic moved from inline <script> in win-loss_dashboard.html

// --- COMPREHENSIVE FILTER LABEL COLOR FIX ---
function forceFilterLabelColors() {
    console.log('🔧 Forcing filter label colors...');
    
    // More comprehensive selectors including all possible variations
    const labelSelectors = [
        'label.text-sm.font-medium',
        'span.text-sm.font-medium.mr-2', 
        'span.text-sm.font-medium',
        '.comparison-label.text-sm.font-medium',
        'label.comparison-label',
        '.flex.items-center.gap-2 label'
    ];
    
    const labels = document.querySelectorAll(labelSelectors.join(', '));
    const selects = document.querySelectorAll('select.filter-dropdown, select');
    const isDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    
    console.log(`Found ${labels.length} labels, isDark: ${isDark}`);
    
    labels.forEach((label, index) => {
        const color = isDark ? '#f3f4f6' : '#374151';
        const text = label.textContent.trim();
        
        // Apply multiple CSS properties to override any conflicting styles
        label.style.setProperty('color', color, 'important');
        label.style.setProperty('text-color', color, 'important'); // Tailwind utility
        label.style.removeProperty('color'); // Remove any existing color
        label.style.setProperty('color', color, 'important'); // Re-apply
        
        console.log(`Label ${index}: "${text}" → ${color}`);
        
        // Also apply to parent if needed
        if (label.parentElement && label.parentElement.classList.contains('flex')) {
            label.parentElement.style.setProperty('color', color, 'important');
        }
    });
    
    selects.forEach((select, index) => {
        console.log(`Dropdown ${index}: ${select.id || select.className}`);
        
        if (isDark) {
            // Use CSS variables to match executive dashboard
            select.style.setProperty('background-color', 'var(--bg-control)', 'important');
            select.style.setProperty('color', 'var(--text-control)', 'important');
            select.style.setProperty('border-color', 'var(--border-control)', 'important');
            
            // Also style the options
            const options = select.querySelectorAll('option');
            options.forEach(option => {
                option.style.setProperty('background-color', 'var(--bg-control)', 'important');
                option.style.setProperty('color', 'var(--text-control)', 'important');
            });
        } else {
            select.style.setProperty('background-color', '#ffffff', 'important');
            select.style.setProperty('color', '#374151', 'important');
            select.style.setProperty('border-color', '#d1d5db', 'important');
            
            // Also style the options for light mode
            const options = select.querySelectorAll('option');
            options.forEach(option => {
                option.style.setProperty('background-color', '#ffffff', 'important');
                option.style.setProperty('color', '#374151', 'important');
            });
        }
    });
    
    console.log('✅ Filter label colors applied');
}

// --- API URL Helper ---
// Using shared getApiUrl function from api-utils.js

// --- SETTINGS PERSISTENCE ---
const SETTINGS_KEY = 'winLossDashboardSettings';

function saveSettings() {
    const settings = {
        currentSolutionFilter,
        currentAccountMgrFilter,
        currentClientFilter,
        activeQuarters,
        currentTableStatusFilter,
        currentSort,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    console.log('💾 [WIN-LOSS-DEBUG] SAVED SETTINGS:', {
        solutionFilter: settings.currentSolutionFilter,
        accountMgrFilter: settings.currentAccountMgrFilter,
        clientFilter: settings.currentClientFilter,
        tableStatusFilter: settings.currentTableStatusFilter,
        theme: settings.theme,
        activeQuarters: settings.activeQuarters,
        sort: settings.currentSort
    });
}

function loadSettings() {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            const settings = JSON.parse(saved);
            console.log('📂 [WIN-LOSS-DEBUG] LOADED SETTINGS:', {
                solutionFilter: settings.currentSolutionFilter,
                accountMgrFilter: settings.currentAccountMgrFilter,
                clientFilter: settings.currentClientFilter,
                tableStatusFilter: settings.currentTableStatusFilter,
                theme: settings.theme,
                activeQuarters: settings.activeQuarters,
                sort: settings.currentSort
            });
            
            // Restore filter states
            console.log('🔧 [WIN-LOSS-DEBUG] ===== RESTORING GLOBAL VARIABLES =====');
            if (settings.currentSolutionFilter !== undefined) {
                console.log('🔧 [WIN-LOSS-DEBUG] Setting currentSolutionFilter from', currentSolutionFilter, 'to', settings.currentSolutionFilter);
                currentSolutionFilter = settings.currentSolutionFilter;
            }
            if (settings.currentAccountMgrFilter !== undefined) {
                console.log('🔧 [WIN-LOSS-DEBUG] Setting currentAccountMgrFilter from', currentAccountMgrFilter, 'to', settings.currentAccountMgrFilter);
                currentAccountMgrFilter = settings.currentAccountMgrFilter;
            }
            if (settings.currentClientFilter !== undefined) {
                console.log('🔧 [WIN-LOSS-DEBUG] Setting currentClientFilter from', currentClientFilter, 'to', settings.currentClientFilter);
                currentClientFilter = settings.currentClientFilter;
            }
            if (settings.activeQuarters !== undefined) {
                console.log('🔧 [WIN-LOSS-DEBUG] Setting activeQuarters from', activeQuarters, 'to', settings.activeQuarters);
                activeQuarters = settings.activeQuarters;
            }
            if (settings.currentTableStatusFilter !== undefined) {
                console.log('🔧 [WIN-LOSS-DEBUG] Setting currentTableStatusFilter from', currentTableStatusFilter, 'to', settings.currentTableStatusFilter);
                currentTableStatusFilter = settings.currentTableStatusFilter;
            }
            if (settings.currentSort !== undefined) {
                console.log('🔧 [WIN-LOSS-DEBUG] Setting currentSort from', currentSort, 'to', settings.currentSort);
                currentSort = settings.currentSort;
            }
            
            console.log('🔧 [WIN-LOSS-DEBUG] ===== GLOBAL VARIABLES RESTORED =====');
            console.log('🔧 [WIN-LOSS-DEBUG] Final values:', {
                solutionFilter: currentSolutionFilter,
                accountMgrFilter: currentAccountMgrFilter,
                clientFilter: currentClientFilter,
                tableStatusFilter: currentTableStatusFilter,
                activeQuarters: activeQuarters,
                sort: currentSort
            });
            
            return settings;
        }
    } catch (error) {
        console.error('❌ [WIN-LOSS-DEBUG] ERROR loading settings:', error);
    }
    console.log('❌ [WIN-LOSS-DEBUG] No saved settings found');
    return null;
}

function restoreUIState() {
    console.log('🔄 [WIN-LOSS-DEBUG] ===== RESTORING UI STATE =====');
    console.log('🔄 [WIN-LOSS-DEBUG] Current values to restore:', {
        solutionFilter: currentSolutionFilter,
        accountMgrFilter: currentAccountMgrFilter,
        clientFilter: currentClientFilter,
        activeQuarters: activeQuarters,
        tableStatusFilter: currentTableStatusFilter,
        sort: currentSort
    });
    
    // Restore dropdown values (these should already be set in populateDropdowns)
    const solutionDropdown = document.getElementById('solutionFilter');
    if (solutionDropdown) {
        console.log('🔄 [WIN-LOSS-DEBUG] Solution dropdown - current:', solutionDropdown.value, 'should be:', currentSolutionFilter);
        if (solutionDropdown.value !== currentSolutionFilter) {
            solutionDropdown.value = currentSolutionFilter;
            console.log('🔄 [WIN-LOSS-DEBUG] Updated solution dropdown to:', solutionDropdown.value);
        }
    } else {
        console.log('❌ [WIN-LOSS-DEBUG] Solution dropdown not found!');
    }
    
    const mgrDropdown = document.getElementById('accountMgrFilter');
    if (mgrDropdown) {
        console.log('[SETTINGS] Account Manager dropdown current value:', mgrDropdown.value, 'should be:', currentAccountMgrFilter);
        if (mgrDropdown.value !== currentAccountMgrFilter) {
            mgrDropdown.value = currentAccountMgrFilter;
            console.log('[SETTINGS] Updated account manager dropdown to:', mgrDropdown.value);
        }
    }
    
    const clientDropdown = document.getElementById('clientFilter');
    if (clientDropdown) {
        console.log('[SETTINGS] Client dropdown current value:', clientDropdown.value, 'should be:', currentClientFilter);
        if (clientDropdown.value !== currentClientFilter) {
            clientDropdown.value = currentClientFilter;
            console.log('[SETTINGS] Updated client dropdown to:', clientDropdown.value);
        }
    }
    
    // Restore quarter button states
    console.log('[SETTINGS] Restoring quarter button states:', activeQuarters);
    updateQuarterButtonStates();
    
    // Restore table filter buttons
    console.log('[SETTINGS] Restoring table filter to:', currentTableStatusFilter);
    if (currentTableStatusFilter === 'OP100') {
        setTableFilterActive('filterOP100Btn');
    } else if (currentTableStatusFilter === 'LOST') {
        setTableFilterActive('filterLOSTBtn');
    }
    
    // Restore table sorting visual indicators
    if (currentSort.col) {
        console.log('[SETTINGS] Restoring table sort:', currentSort);
        const tableHeaders = document.querySelectorAll('#opportunitiesTable th');
        const headerKeys = ['project_name', 'client', 'account_mgr', 'date_awarded', 'final_amt', 'margin'];
        const colIndex = headerKeys.indexOf(currentSort.col);
        if (colIndex >= 0 && tableHeaders[colIndex]) {
            tableHeaders.forEach((h, i) => {
                h.classList.toggle('sorted', i === colIndex);
                h.setAttribute('data-sort-dir', (i === colIndex) ? (currentSort.dir === 1 ? 'asc' : 'desc') : '');
            });
            console.log('[SETTINGS] Applied sort indicators to column:', colIndex, 'direction:', currentSort.dir === 1 ? 'asc' : 'desc');
        }
    }
    
    console.log('✅ [WIN-LOSS-DEBUG] ===== UI STATE RESTORATION COMPLETED =====');
}

// --- Global Variables ---
let dashboardDataCache = null; // Cache fetched data (includes ALL opportunities)
let winChartInstance = null;   // Instance for the Wins chart
let lossChartInstance = null;  // Instance for the Losses chart
let currentSolutionFilter = 'all'; // State for the solution filter
let currentAccountMgrFilter = 'all';
let currentClientFilter = 'all';
// let currentQuarterFilter = 'all'; // Replaced by activeQuarters

// Initialize activeQuarters based on current date
function initializeActiveQuarters() {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentQuarter = Math.floor(currentMonth / 3) + 1; // 1-4
    
    // Initialize all quarters as inactive
    const quarters = { '1': false, '2': false, '3': false, '4': false };
    
    // Activate current quarter and all previous quarters in the current year
    for (let q = 1; q <= currentQuarter; q++) {
        quarters[q] = true;
    }
    
    return quarters;
}

let activeQuarters = initializeActiveQuarters(); // Initialize based on current date
let currentTableStatusFilter = 'OP100'; // Default to OP100 only
let currentSort = { col: null, dir: 1 };
// ...existing code for all helper functions, rendering, filters, etc...

// Input validation functions removed - no longer needed since we use dedicated login.html

// --- Robust Date Parsing Helper ---
function robustParseDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) return val;
    // Try ISO, yyyy-mm-dd, mm/dd/yyyy, dd-mm-yyyy, etc.
    let d = new Date(val);
    if (!isNaN(d)) return d;
    // Try yyyy-mm-dd
    const isoMatch = /^\d{4}-\d{2}-\d{2}/.exec(val);
    if (isoMatch) {
        d = new Date(val.replace(/-/g, '/'));
        if (!isNaN(d)) return d;
    }
    // Try mm/dd/yyyy
    const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(val);
    if (usMatch) {
        d = new Date(`${usMatch[3]}-${usMatch[1].padStart(2,'0')}-${usMatch[2].padStart(2,'0')}`);
        if (!isNaN(d)) return d;
    }
    // Try dd-mm-yyyy
    const euMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(val);
    if (euMatch) {
        d = new Date(`${euMatch[3]}-${euMatch[2].padStart(2,'0')}-${euMatch[1].padStart(2,'0')}`);
        if (!isNaN(d)) return d;
    }
    return null;
}

// Patch: Ensure date_awarded is populated from date_awarded_lost if missing
function patchDateAwardedField(data) {
    if (!Array.isArray(data)) return data;
    data.forEach(item => {
        if (!item.date_awarded && item.date_awarded_lost) {
            item.date_awarded = item.date_awarded_lost;
        }
    });
    return data;
}

// Auth helper functions 
// Legacy function - no longer used with auth loading screen pattern
function showMainContent(show) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.display = show ? 'block' : 'none';
    }
}

// Legacy functions removed - we now use dedicated login.html page instead of modal

// Check if user is authenticated
function isAuthenticated() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.log('[AUTH] No token found');
        return false;
    }
    
    console.log('[AUTH] Token found, user is authenticated');
    return true;
}

// Update user management navigation visibility based on user role
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
    } catch {
        userMgmtBtn.style.display = 'none';
    }
}

// --- DASHBOARD DATA FETCH (with debug) ---
async function fetchDashboardData() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(getApiUrl('/api/opportunities'), {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Failed to fetch data: ' + res.status);
        const data = await res.json();
        dashboardDataCache = data;
        console.log('[DEBUG] Dashboard data fetched:', data);
        renderDashboard(data);
        if (!data || (Array.isArray(data) && data.length === 0)) {
            const main = document.querySelector('.main-content');
            if (main) main.innerHTML = '<div style="color:#dc2626;padding:2rem;text-align:center;">No dashboard data available.</div>';
        }
        populateDropdowns(data);
        setupTableFilterButtons();
        setupQuarterFilterButtons(); // Added call
        
        // Restore UI state immediately after setup
        console.log('🔄 [WIN-LOSS-DEBUG] About to restore UI state after dropdown population');
        restoreUIState();
        
        // Save current state to ensure consistency
        console.log('💾 [WIN-LOSS-DEBUG] Saving final state for consistency');
        saveSettings();
        
        console.log('🎉 [WIN-LOSS-DEBUG] ===== INITIALIZATION COMPLETED =====');
    } catch (err) {
        console.error('[DEBUG] Dashboard data fetch error:', err);
        const main = document.querySelector('.main-content');
        if (main) main.innerHTML = '<div style="color:#dc2626;padding:2rem;text-align:center;">Failed to load dashboard data.<br>' + err.message + '</div>';
    }
}

// --- AUTH FORM INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {
    console.log('[DEBUG] DOM Content Loaded - Starting win-loss dashboard initialization');
    console.log('[DEBUG] Current localStorage authToken:', localStorage.getItem('authToken') ? 'exists' : 'not found');
    
    // Load settings first
    console.log('🔧 [WIN-LOSS-DEBUG] ===== PAGE LOAD STARTED =====');
    console.log('🔧 [WIN-LOSS-DEBUG] Current DOM theme on load:', document.documentElement.classList.contains('dark') ? 'DARK' : 'LIGHT');
    console.log('🔧 [WIN-LOSS-DEBUG] Global theme localStorage:', localStorage.getItem('theme'));
    console.log('🔧 [WIN-LOSS-DEBUG] Loading saved settings...');
    const savedSettings = loadSettings();
    
    // Check theme state and decide what to do
    console.log('🔧 [WIN-LOSS-DEBUG] ===== THEME INITIALIZATION =====');
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const globalTheme = localStorage.getItem('theme');
    const savedTheme = savedSettings ? savedSettings.theme : null;
    
    console.log('🔧 [WIN-LOSS-DEBUG] Current DOM theme:', currentTheme);
    console.log('🔧 [WIN-LOSS-DEBUG] Global localStorage theme:', globalTheme);
    console.log('🔧 [WIN-LOSS-DEBUG] Saved dashboard theme:', savedTheme);
    
    // Only apply theme if there's a specific saved theme that differs from current
    if (savedSettings && savedSettings.theme && savedSettings.theme !== currentTheme) {
        console.log('🔧 [WIN-LOSS-DEBUG] Theme mismatch detected! Applying saved theme:', savedSettings.theme);
        applyTheme(savedSettings.theme);
    } else {
        console.log('🔧 [WIN-LOSS-DEBUG] Theme is already correct or no saved theme, syncing with current state:', currentTheme);
    }
    
    console.log('🔧 [WIN-LOSS-DEBUG] ===== THEME INITIALIZATION COMPLETED =====');
    
    // Title should remain as oppX - removing forced override
    // Initialize filter label color fix (single call with delay)
    setTimeout(forceFilterLabelColors, 100);
    
    // Set up quarterly buttons immediately on DOM load
    console.log('🚀 DOM loaded - setting up quarterly buttons immediately...');
    setTimeout(() => {
        const quarterBtns = document.querySelectorAll('#quarterFilterButtons .quarter-filter-btn');
        console.log('🚀 Found', quarterBtns.length, 'quarterly buttons on DOM load');
        quarterBtns.forEach((btn, index) => {
            console.log(`🚀 Setting up immediate listener for button ${index}, quarter ${btn.dataset.quarter}`);
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚀 IMMEDIATE CLICK DETECTED for quarter', this.dataset.quarter);
            });
        });
    }, 100);
    
    // Theme change watching is now handled by the main theme observer below
    // This prevents conflicts and duplicate observers
    
    // Removed the periodic backup call as it was causing spam
    
    // Set up theme toggle immediately
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
        console.log('🎨 Theme toggle set up');
    }
    
    // Modal-based authentication removed - we now use dedicated login.html page

    // Authentication verification using the loading screen pattern
    const authLoadingScreen = document.getElementById('authLoadingScreen');
    const appContent = document.getElementById('appContent');
    const authLoadingRedirect = document.getElementById('authLoadingRedirect');
    const authLoginRedirectBtn = document.getElementById('authLoginRedirectBtn');
    
    function showAuthenticatedContent() {
        console.log('[AUTH] User authenticated - showing content');
        // User authenticated
        if (authLoadingScreen) authLoadingScreen.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
        
        // Initialize the authenticated app
        updateUserMgmtNavVisibility();
        updateChangePasswordBtnVisibility();
        fetchDashboardData();
    }
    
    function showLoginRedirect() {
        console.log('[AUTH] User not authenticated - showing login redirect');
        // Authentication failed
        if (authLoadingScreen) {
            const spinner = authLoadingScreen.querySelector('.auth-loading-spinner');
            const message = authLoadingScreen.querySelector('.auth-loading-message');
            if (spinner) spinner.style.display = 'none';
            if (message) message.textContent = 'Authentication required';
            if (authLoadingRedirect) authLoadingRedirect.style.display = 'block';
        }
        
        updateUserMgmtNavVisibility();
        updateChangePasswordBtnVisibility();
    }
    
    // Set up login redirect button
    if (authLoginRedirectBtn) {
        authLoginRedirectBtn.addEventListener('click', () => {
            window.location.href = 'login.html';
        });
    }
    
    // Initial authentication check - delay slightly to let shared navigation load
    setTimeout(() => {
        console.log('[AUTH] Performing initial authentication check...');
        if (isAuthenticated()) {
            showAuthenticatedContent();
        } else {
            showLoginRedirect();
        }
    }, 100);

    // --- Theme Toggle Button Setup ---
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // --- Sync login/logout state across tabs/pages ---
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken' || e.key === 'authEvent') {
            const token = localStorage.getItem('authToken');
            if (token) {
                showAuthenticatedContent();
            } else {
                // On logout, redirect to login page instead of showing login redirect
                window.location.href = 'login.html';
            }
        }
    });
});

// Remove any direct logoutBtn.onclick assignment to avoid conflict with delegated event
// (This is a no-op, but ensures no direct assignment remains)
// const logoutBtn = document.getElementById('logoutBtn');
// if (logoutBtn) logoutBtn.onclick = null;

// --- CHART RENDERING (robust, with fallback) ---
function renderWinLossCharts(data) {
    if (!Array.isArray(data)) {
        console.error('[DEBUG] Invalid data format for charts:', data);
        return;
    }

    // Process monthly data
    const allMonthsLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let chartLabels = [];
    let monthIndices = []; // 0-11, stores indices of months to display

    // Build labels based on active quarters
    console.log('📊 Chart rendering - activeQuarters:', activeQuarters);
    if (activeQuarters['1']) { chartLabels.push('Jan','Feb','Mar'); monthIndices.push(0,1,2); }
    if (activeQuarters['2']) { chartLabels.push('Apr','May','Jun'); monthIndices.push(3,4,5); }
    if (activeQuarters['3']) { chartLabels.push('Jul','Aug','Sep'); monthIndices.push(6,7,8); }
    if (activeQuarters['4']) { chartLabels.push('Oct','Nov','Dec'); monthIndices.push(9,10,11); }
    
    // If no quarters selected, default to all months
    if (chartLabels.length === 0) {
        chartLabels = allMonthsLabels;
        monthIndices = Array.from({length: 12}, (_, i) => i);
    }
    
    console.log('📊 Chart labels:', chartLabels);
    console.log('📊 Month indices:', monthIndices);

    // Initialize arrays for monthly data
    let winMonthlyAmount = Array(12).fill(0);
    let winMonthlyCount = Array(12).fill(0);
    let lossMonthlyAmount = Array(12).fill(0);
    let lossMonthlyCount = Array(12).fill(0);

    // Process data
    data.forEach(item => {
        const date = robustParseDate(item.date_awarded || item.date_awarded_lost);
        if (date && !isNaN(date)) {
            const month = date.getMonth();
            if (monthIndices.includes(month)) {
                if (item.opp_status === 'OP100') {
                    winMonthlyAmount[month] += Number(item.final_amt) || 0;
                    winMonthlyCount[month] += 1;
                } else if (item.opp_status === 'LOST') {
                    lossMonthlyAmount[month] += Number(item.final_amt) || 0;
                    lossMonthlyCount[month] += 1;
                }
            }
        }
    });

    // Filter data for selected quarters
    const winChartAmounts = monthIndices.map(idx => winMonthlyAmount[idx]);
    const winChartCounts = monthIndices.map(idx => winMonthlyCount[idx]);
    const lossChartAmounts = monthIndices.map(idx => lossMonthlyAmount[idx]);
    const lossChartCounts = monthIndices.map(idx => lossMonthlyCount[idx]);

    // Get computed styles for chart colors
    const rootStyle = getComputedStyle(document.documentElement);
    const colorWin = rootStyle.getPropertyValue('--color-win').trim() || '#16a34a';
    const colorWinBg = rootStyle.getPropertyValue('--color-win-bg').trim() || 'rgba(22, 163, 74, 0.2)';
    const colorWinDark = rootStyle.getPropertyValue('--color-win-dark').trim() || '#15803d';
    const colorLoss = rootStyle.getPropertyValue('--color-loss').trim() || '#dc2626';
    const colorLossBg = rootStyle.getPropertyValue('--color-loss-bg').trim() || 'rgba(220, 38, 38, 0.2)';
    const colorLossDark = rootStyle.getPropertyValue('--color-loss-dark').trim() || '#b91c1c';
    const gridColor = rootStyle.getPropertyValue('--chart-grid-color').trim() || '#e5e7eb';
    const tickColor = rootStyle.getPropertyValue('--chart-tick-color').trim() || '#6b7280';
    const titleColor = rootStyle.getPropertyValue('--chart-title-color').trim() || '#111827';
    const legendColor = rootStyle.getPropertyValue('--chart-legend-color').trim() || '#374151';
    const tooltipBgColor = rootStyle.getPropertyValue('--chart-tooltip-bg').trim() || '#ffffff';
    const tooltipTextColor = rootStyle.getPropertyValue('--chart-tooltip-text').trim() || '#111827';

    // Set chart container heights
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
        container.style.height = '500px';
    });

    const winCanvas = document.getElementById('winMonthlyChart');
    const lossCanvas = document.getElementById('lossMonthlyChart');

    if (winCanvas && lossCanvas) {
        // Helper function to get a nice round maximum value
        function getNiceMaxValue(maxValue) {
            // If value is 0, return a default scale
            if (maxValue === 0) return 10;
            
            // Find the magnitude (10^n) just above the max value
            const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
            const normalized = maxValue / magnitude;  // Between 1 and 10
            
            // Choose a nice round number just above the normalized value
            let niceNormalized;
            if (normalized <= 1.5) niceNormalized = 1.5;
            else if (normalized <= 2) niceNormalized = 2;
            else if (normalized <= 2.5) niceNormalized = 2.5;
            else if (normalized <= 3) niceNormalized = 3;
            else if (normalized <= 4) niceNormalized = 4;
            else if (normalized <= 5) niceNormalized = 5;
            else if (normalized <= 6) niceNormalized = 6;
            else if (normalized <= 8) niceNormalized = 8;
            else niceNormalized = 10;
            
            return niceNormalized * magnitude;
        }

        // Get the maximum amount from both win and loss data to set consistent scale
        const maxWinAmount = Math.max(...winChartAmounts);
        const maxLossAmount = Math.max(...lossChartAmounts);
        const maxAmount = Math.max(maxWinAmount, maxLossAmount);
        const niceMaxAmount = getNiceMaxValue(maxAmount);
        
        // Get the maximum count and make it a nice round number
        const maxWinCount = Math.max(...winChartCounts);
        const maxLossCount = Math.max(...lossChartCounts);
        const maxCount = Math.max(maxWinCount, maxLossCount);
        const niceMaxCount = getNiceMaxValue(maxCount);

        // Common options with synchronized scales
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: legendColor,
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: tooltipBgColor,
                    titleColor: tooltipTextColor,
                    bodyColor: tooltipTextColor,
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.yAxisID === 'y') {
                                return `Amount: ${abbreviateAmount(context.raw)}`;
                            }
                            return `Count: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: tickColor }
                },
                y: {
                    position: 'left',
                    grid: { color: gridColor },
                    min: 0,
                    max: niceMaxAmount,
                    ticks: {
                        color: tickColor,
                        callback: function(value) {
                            return abbreviateAmount(value);
                        }
                    }
                },
                y1: {
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                        color: gridColor
                    },
                    min: 0,
                    max: niceMaxCount,
                    ticks: {
                        color: tickColor,
                        stepSize: 1,
                        precision: 0
                    }
                }
            }
        };

        // Helper function to abbreviate amounts
        function abbreviateAmount(value) {
            const absValue = Math.abs(value);
            if (absValue >= 1e6) {
                return '₱' + (value / 1e6).toFixed(1) + 'M';
            }
            if (absValue >= 1e3) {
                return '₱' + (value / 1e3).toFixed(1) + 'K';
            }
            return '₱' + value.toFixed(2);
        }

        // Win Chart Configuration
        const winConfig = {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Win Amount',
                        data: winChartAmounts,
                        backgroundColor: colorWinBg,
                        borderColor: colorWin,
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Win Count',
                        data: winChartCounts,
                        type: 'line',
                        borderColor: colorWinDark,
                        borderWidth: 2,
                        pointBackgroundColor: colorWinDark,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: commonOptions
        };

        // Loss Chart Configuration
        const lossConfig = {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Loss Amount',
                        data: lossChartAmounts,
                        backgroundColor: colorLossBg,
                        borderColor: colorLoss,
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Loss Count',
                        data: lossChartCounts,
                        type: 'line',
                        borderColor: colorLossDark,
                        borderWidth: 2,
                        pointBackgroundColor: colorLossDark,
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: commonOptions
        };

        // Create the charts
        if (window.winChart) window.winChart.destroy();
        if (window.lossChart) window.lossChart.destroy();

        window.winChart = new Chart(winCanvas, winConfig);
        window.lossChart = new Chart(lossCanvas, lossConfig);
    }
}

// --- DASHBOARD METRICS CALCULATION ---
// Metrics calculation is now done directly in renderDashboard function for consistency

function formatCurrencyAmount(amount) {
    if (amount >= 1000000) {
        return '₱' + (amount / 1000000).toFixed(1) + 'M';
    }
    if (amount >= 1000) {
        return '₱' + (amount / 1000).toFixed(1) + 'K';
    }
    return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getFilteredTableData(opportunities) {
    if (!Array.isArray(opportunities)) return [];
    
    return opportunities.filter(item => {
        // Apply status filter
        if (currentTableStatusFilter !== 'all') {
            if (item.opp_status !== currentTableStatusFilter) {
                return false;
            }
        }
        
        // Apply solution filter
        if (currentSolutionFilter !== 'all' && item.solutions !== currentSolutionFilter) {
            return false;
        }
        // Apply account manager filter
        if (currentAccountMgrFilter !== 'all' && item.account_mgr !== currentAccountMgrFilter) {
            return false;
        }
        // Apply client filter
        if (currentClientFilter !== 'all' && item.client !== currentClientFilter) {
            return false;
        }
        // Apply quarter filter
        const date = robustParseDate(item.date_awarded || item.date_awarded_lost);
        if (date && !isNaN(date)) {
            const month = date.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            if (!activeQuarters[quarter]) {
                return false;
            }
        }
        return true;
    });
}

// Define table headers for sorting
const tableHeaders = [
    { key: 'project_name' },
    { key: 'client' },
    { key: 'account_mgr' },
    { key: 'date_awarded' },
    { key: 'final_amt' },
    { key: 'margin' }
];

// Initialize sorting state - moved to global variables section above

// --- MAIN DASHBOARD RENDERING FUNCTION ---
function renderDashboard(data) {
    if (!Array.isArray(data)) {
        console.error('[renderDashboard] Invalid data format:', data);
        return;
    }
    
    console.log('[renderDashboard] Rendering dashboard with data:', data.length, 'items');
    
    // Apply common filtering logic once
    const filteredData = data.filter(item => {
        // Apply solution filter
        if (currentSolutionFilter !== 'all' && item.solutions !== currentSolutionFilter) {
            return false;
        }
        // Apply account manager filter
        if (currentAccountMgrFilter !== 'all' && item.account_mgr !== currentAccountMgrFilter) {
            return false;
        }
        // Apply client filter
        if (currentClientFilter !== 'all' && item.client !== currentClientFilter) {
            return false;
        }
        // Apply quarter filter based on date_awarded_lost
        const date = robustParseDate(item.date_awarded || item.date_awarded_lost);
        if (date && !isNaN(date)) {
            const month = date.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            if (!activeQuarters[quarter]) {
                return false;
            }
        }
        return true;
    });
    
    console.log('[renderDashboard] Filtered data:', filteredData.length, 'items');
    console.log('[renderDashboard] Filter values - Solution:', currentSolutionFilter, 'Account Mgr:', currentAccountMgrFilter, 'Client:', currentClientFilter);
    
    // Calculate metrics from filtered data
    const op100Data = filteredData.filter(item => item.opp_status === 'OP100');
    const lostData = filteredData.filter(item => item.opp_status === 'LOST');
    
    const metrics = {
        op100Count: op100Data.length,
        op100Amount: op100Data.reduce((sum, item) => sum + (Number(item.final_amt) || 0), 0),
        lostCount: lostData.length,
        lostAmount: lostData.reduce((sum, item) => sum + (Number(item.final_amt) || 0), 0)
    };
    
    console.log('[renderDashboard] Calculated metrics:', metrics);
    
    // Update dashboard cards
    const op100CountEl = document.getElementById('op100-total-count');
    const op100AmountEl = document.getElementById('op100-total-amount');
    const lossCountEl = document.getElementById('loss-total-count');
    const lossAmountEl = document.getElementById('loss-total-amount');
    
    if (op100CountEl) op100CountEl.textContent = metrics.op100Count.toString();
    if (op100AmountEl) op100AmountEl.textContent = formatCurrencyAmount(metrics.op100Amount);
    if (lossCountEl) lossCountEl.textContent = metrics.lostCount.toString();
    if (lossAmountEl) lossAmountEl.textContent = formatCurrencyAmount(metrics.lostAmount);
    
    // Render charts with already filtered data
    renderWinLossCharts(filteredData);
    
    // Render opportunities table with original data (it will apply its own filtering)
    renderOpportunitiesTable(data);
}

// --- TABLE SORTING (fix: use correct keys and types) ---
document.querySelectorAll('#opportunitiesTable th').forEach((th, idx) => {
    th.style.cursor = 'pointer';
    th.onclick = function() {
        const key = tableHeaders[idx].key;
        if (!key) return;
        if (currentSort.col === key) currentSort.dir *= -1;
        else { currentSort.col = key; currentSort.dir = 1; }
        saveSettings();
        renderOpportunitiesTable(dashboardDataCache);
        // Visual indicator
        document.querySelectorAll('#opportunitiesTable th').forEach((h, i) => {
            h.classList.toggle('sorted', i === idx);
            h.setAttribute('data-sort-dir', (i === idx) ? (currentSort.dir === 1 ? 'asc' : 'desc') : '');
        });
    };
});

// --- Table filter logic (match earlier design) ---
function formatCurrency(num) {
    const number = Number(num);
    if (isNaN(number)) return '₱0.00';
    return '₱' + number.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMargin(value) {
    if (typeof value === 'string' && value.includes('%')) {
        return value;
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
        return value || '';
    }
    if (num !== 0 && Math.abs(num) < 1) {
        return Math.round(num * 100) + '%';
    }
    return Math.round(num) + '%';
}

function formatDateAwardedMDY(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function renderOpportunitiesTable(opportunities) {
    const tableBody = document.getElementById('opportunitiesTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    let filtered = getFilteredTableData(opportunities);
    
    // --- Table Sorting ---
    if (currentSort.col) {
        filtered = filtered.slice().sort((a, b) => {
            let v1, v2;
            switch (currentSort.col) {
                case 'project_name':
                    v1 = (a['opp_name'] || a['project_name'] || '').toLowerCase();
                    v2 = (b['opp_name'] || b['project_name'] || '').toLowerCase();
                    break;
                case 'client':
                    v1 = (a['client'] || '').toLowerCase();
                    v2 = (b['client'] || '').toLowerCase();
                    break;
                case 'account_mgr':
                    v1 = (a['account_mgr'] || '').toLowerCase();
                    v2 = (b['account_mgr'] || '').toLowerCase();
                    break;
                case 'date_awarded':
                    v1 = a['date_awarded_lost'] ? new Date(a['date_awarded_lost']) : new Date(0);
                    v2 = b['date_awarded_lost'] ? new Date(b['date_awarded_lost']) : new Date(0);
                    break;
                case 'final_amt':
                    v1 = Number(a['final_amt']) || 0;
                    v2 = Number(b['final_amt']) || 0;
                    break;
                case 'margin':
                    v1 = parseFloat(a['margin_percentage'] || a['margin'] || 0) || 0;
                    v2 = parseFloat(b['margin_percentage'] || b['margin'] || 0) || 0;
                    break;
                default:
                    v1 = (a[currentSort.col] || '').toString().toLowerCase();
                    v2 = (b[currentSort.col] || '').toString().toLowerCase();
            }
            if (v1 < v2) return -1 * currentSort.dir;
            if (v1 > v2) return 1 * currentSort.dir;
            return 0;
        });
    }
    filtered.forEach((opp) => {
        const tr = document.createElement('tr');
        const projectName = opp['opp_name'] || opp['project_name'] || '';
        const client = opp['client'] || '';
        const acctMgr = opp['account_mgr'] || '';
        let dateAwarded = '';
        if (opp['date_awarded_lost']) {
            dateAwarded = formatDateAwardedMDY(opp['date_awarded_lost']);
        }
        const finalAmtValue = opp['final_amt'] || '';
        const marginValue = opp['margin_percentage'] || opp['margin'] || '';

        // Add status-based classes
        const status = (opp['opp_status'] || '').toUpperCase();
        if (status === 'OP100') {
            tr.classList.add('bg-op100');
        } else if (status === 'LOST') {
            tr.classList.add('bg-lost');
        }

        tr.innerHTML = `
            <td class="project-name-cell px-3 py-2 whitespace-normal text-sm">${projectName}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm">${client}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm">${acctMgr}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm">${dateAwarded}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-right">${formatCurrency(finalAmtValue)}</td>
            <td class="px-3 py-2 whitespace-nowrap text-sm text-right">${formatMargin(marginValue)}</td>
        `;

        tableBody.appendChild(tr);
    });
}

// --- Dropdown population for chart filters ---
function populateDropdowns(data) {
    console.log('🔽 [WIN-LOSS-DEBUG] ===== POPULATING DROPDOWNS =====');
    console.log('🔽 [WIN-LOSS-DEBUG] Current filter values:', {
        solutionFilter: currentSolutionFilter,
        accountMgrFilter: currentAccountMgrFilter,
        clientFilter: currentClientFilter
    });
    
    // Solution
    const solutionDropdown = document.getElementById('solutionFilter');
    if (solutionDropdown) {
        const solutions = Array.from(new Set(data.map(opp => opp['solutions']).filter(Boolean)));
        solutionDropdown.innerHTML = '<option value="all">All</option>';
        solutions.forEach(sol => {
            const opt = document.createElement('option');
            opt.value = sol;
            opt.textContent = sol;
            solutionDropdown.appendChild(opt);
        });
        // Set the saved value, but only if it exists in the options
        const availableOptions = Array.from(solutionDropdown.options).map(opt => opt.value);
        console.log('🔽 [WIN-LOSS-DEBUG] Solution - available options:', availableOptions);
        console.log('🔽 [WIN-LOSS-DEBUG] Solution - trying to set to:', currentSolutionFilter);
        
        if (availableOptions.includes(currentSolutionFilter)) {
            solutionDropdown.value = currentSolutionFilter;
            console.log('✅ [WIN-LOSS-DEBUG] Solution dropdown set to:', solutionDropdown.value);
        } else {
            console.log('❌ [WIN-LOSS-DEBUG] Solution filter value not found! Expected:', currentSolutionFilter, 'Available:', availableOptions);
            currentSolutionFilter = 'all'; // Reset to default if value not found
            solutionDropdown.value = 'all';
            console.log('🔧 [WIN-LOSS-DEBUG] Solution reset to "all"');
        }
        
        solutionDropdown.onchange = function() {
            currentSolutionFilter = this.value;
            saveSettings();
            renderDashboard(dashboardDataCache);
        };
    }
    // Account Manager
    const mgrDropdown = document.getElementById('accountMgrFilter');
    if (mgrDropdown) {
        const mgrs = Array.from(new Set(data.map(opp => opp['account_mgr']).filter(Boolean)));
        mgrDropdown.innerHTML = '<option value="all">All</option>';
        mgrs.forEach(mgr => {
            const opt = document.createElement('option');
            opt.value = mgr;
            opt.textContent = mgr;
            mgrDropdown.appendChild(opt);
        });
        // Set the saved value, but only if it exists in the options
        const availableMgrOptions = Array.from(mgrDropdown.options).map(opt => opt.value);
        if (availableMgrOptions.includes(currentAccountMgrFilter)) {
            mgrDropdown.value = currentAccountMgrFilter;
            console.log('[SETTINGS] Account Manager dropdown set to:', mgrDropdown.value);
        } else {
            console.log('[SETTINGS] Account Manager filter value not found in options:', currentAccountMgrFilter, 'Available:', availableMgrOptions);
            currentAccountMgrFilter = 'all'; // Reset to default if value not found
            mgrDropdown.value = 'all';
        }
        
        mgrDropdown.onchange = function() {
            currentAccountMgrFilter = this.value;
            saveSettings();
            renderDashboard(dashboardDataCache);
        };
    }
    // Client
    const clientDropdown = document.getElementById('clientFilter');
    if (clientDropdown) {
        const clients = Array.from(new Set(data.map(opp => opp['client']).filter(Boolean)));
        clientDropdown.innerHTML = '<option value="all">All</option>';
        clients.forEach(client => {
            const opt = document.createElement('option');
            opt.value = client;
            opt.textContent = client;
            clientDropdown.appendChild(opt);
        });
        // Set the saved value, but only if it exists in the options
        const availableClientOptions = Array.from(clientDropdown.options).map(opt => opt.value);
        if (availableClientOptions.includes(currentClientFilter)) {
            clientDropdown.value = currentClientFilter;
            console.log('[SETTINGS] Client dropdown set to:', clientDropdown.value);
        } else {
            console.log('[SETTINGS] Client filter value not found in options:', currentClientFilter, 'Available:', availableClientOptions);
            currentClientFilter = 'all'; // Reset to default if value not found
            clientDropdown.value = 'all';
        }
        
        clientDropdown.onchange = function() {
            currentClientFilter = this.value;
            saveSettings();
            renderDashboard(dashboardDataCache);
        };
    }
    
    // Apply auto-filtering after dropdowns are populated (but don't override saved settings)
    console.log('🔽 [WIN-LOSS-DEBUG] Checking if auto-filter should apply...');
    console.log('🔽 [WIN-LOSS-DEBUG] Current filters before auto-filter check:', {
        solution: currentSolutionFilter,
        accountMgr: currentAccountMgrFilter,
        client: currentClientFilter
    });
    
    if (currentSolutionFilter === 'all' && currentAccountMgrFilter === 'all' && currentClientFilter === 'all') {
        console.log('🔽 [WIN-LOSS-DEBUG] All filters are "all", applying auto-filters...');
        applyAutoFiltersForUser();
    } else {
        console.log('🔽 [WIN-LOSS-DEBUG] Some filters are set, skipping auto-filters to preserve user settings');
    }
}

// --- Table filter buttons (OP100/LOST/All) ---
function setTableFilterActive(activeId) {
    ['filterOP100Btn','filterLOSTBtn'/*,'filterAllBtn'*/].forEach(id => { // Removed filterAllBtn
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('active', id === activeId);
    });
}
function setupTableFilterButtons() {
    const op100Btn = document.getElementById('filterOP100Btn');
    const lostBtn = document.getElementById('filterLOSTBtn');
    // const allBtn = document.getElementById('filterAllBtn'); // Removed allBtn

    if (op100Btn) op100Btn.onclick = function() {
        currentTableStatusFilter = 'OP100';
        setTableFilterActive('filterOP100Btn');
        saveSettings();
        renderOpportunitiesTable(dashboardDataCache);
    };
    if (lostBtn) lostBtn.onclick = function() {
        currentTableStatusFilter = 'LOST';
        setTableFilterActive('filterLOSTBtn');
        saveSettings();
        renderOpportunitiesTable(dashboardDataCache);
    };
    // if (allBtn) allBtn.onclick = function() { // Removed allBtn logic
    //     currentTableStatusFilter = 'all';
    //     setTableFilterActive('filterAllBtn');
    //     renderOpportunitiesTable(dashboardDataCache);
    // };
    // Set initial state (OP100 is default)
    setTableFilterActive('filterOP100Btn');
}

// --- Quarter Filter Buttons --- 
function updateQuarterButtonStates() {
    document.querySelectorAll('#quarterFilterButtons .quarter-filter-btn').forEach(btn => {
        const quarter = btn.dataset.quarter;
        if (activeQuarters[quarter]) {
            btn.style.opacity = '1';
            btn.classList.add('active'); // Use active class for styling if desired, or just opacity
        } else {
            btn.style.opacity = '0.5';
            btn.classList.remove('active');
        }
    });
}

function setupQuarterFilterButtons() {
    console.log('🔧 Setting up quarter filter buttons...');
    const quarterButtons = document.querySelectorAll('#quarterFilterButtons .quarter-filter-btn');
    console.log('🔧 Found', quarterButtons.length, 'quarter buttons');
    console.log('🔧 Current activeQuarters:', activeQuarters);
    
    // Set initial states based on activeQuarters
    quarterButtons.forEach((button, index) => {
        const quarter = button.dataset.quarter;
        console.log(`🔧 Setting up button ${index} for quarter ${quarter}`);
        
        // Set initial opacity based on activeQuarters
        button.style.opacity = activeQuarters[quarter] ? '1' : '0.5';
        button.classList.toggle('active', activeQuarters[quarter]);
        
        // Remove any existing event listeners by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', function() {
            const quarter = this.dataset.quarter;
            console.log(`🔘 Quarter button ${quarter} clicked!`);
            activeQuarters[quarter] = !activeQuarters[quarter]; // Toggle the state
            console.log(`🔘 Quarter ${quarter} is now:`, activeQuarters[quarter]);
            console.log('🔘 Updated activeQuarters:', activeQuarters);
            updateQuarterButtonStates();
            saveSettings();
            console.log('🔘 Calling renderDashboard...');
            renderDashboard(dashboardDataCache); // Re-render dashboard with new quarter filter
        });
    });
}

const changePasswordBtn = document.getElementById('changePasswordBtn');
if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', function() {
        window.location.href = 'update_password.html';
    });
}
// Hide Change Password button if not authenticated
function updateChangePasswordBtnVisibility() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        if (changePasswordBtn) changePasswordBtn.style.display = 'none';
    } else {
        if (changePasswordBtn) changePasswordBtn.style.display = '';
    }
}
updateChangePasswordBtnVisibility();
window.addEventListener('storage', function(e) {
    if (e.key === 'authToken' || e.key === 'authEvent') {
        updateChangePasswordBtnVisibility();
    }
});
// --- CHANGE PASSWORD BUTTON HANDLER ---
function setupChangePasswordButton() {
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        // Remove any previous event listeners by replacing the node
        const newBtn = changePasswordBtn.cloneNode(true);
        changePasswordBtn.parentNode.replaceChild(newBtn, changePasswordBtn);
        newBtn.addEventListener('click', function() {
            window.location.href = 'update_password.html';
        });
    }
}

// --- LOGOUT BUTTON HANDLER ---
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        // Remove any previous event listeners by replacing the node
        const newBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
        newBtn.addEventListener('click', function() {
            localStorage.removeItem('authToken');
            localStorage.setItem('authEvent', JSON.stringify({ type: 'logout', ts: Date.now() }));
            window.location.href = 'login.html';
        });
    }
}
document.addEventListener('DOMContentLoaded', setupChangePasswordButton);
window.addEventListener('storage', function(e) {
    if (e.key === 'authToken' || e.key === 'authEvent') {
        setupChangePasswordButton();
    }
});

document.addEventListener('DOMContentLoaded', setupLogoutButton);
window.addEventListener('storage', function(e) {
    if (e.key === 'authToken' || e.key === 'authEvent') {
        setupLogoutButton();
    }
});

// --- THEME MANAGEMENT ---
function applyTheme(theme) {
    console.log('🎨 [WIN-LOSS-DEBUG] ===== APPLYING THEME =====');
    console.log('🎨 [WIN-LOSS-DEBUG] Requested theme:', theme);
    
    const isDark = theme === 'dark';
    
    // Only update DOM if different from current state
    const currentlyDark = document.documentElement.classList.contains('dark');
    console.log('🎨 [WIN-LOSS-DEBUG] Current DOM state:', currentlyDark ? 'DARK' : 'LIGHT');
    console.log('🎨 [WIN-LOSS-DEBUG] Target state:', isDark ? 'DARK' : 'LIGHT');
    
    if (currentlyDark !== isDark) {
        document.documentElement.classList.toggle('dark', isDark);
        console.log('🎨 [WIN-LOSS-DEBUG] DOM theme UPDATED from', currentlyDark ? 'DARK' : 'LIGHT', 'to', theme);
    } else {
        console.log('🎨 [WIN-LOSS-DEBUG] DOM theme already correct, no change needed');
    }
    
    // Update theme storage (this should match the shared navigation)
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    console.log('🎨 [WIN-LOSS-DEBUG] Updated localStorage theme to:', isDark ? 'dark' : 'light');
    
    // Don't update theme toggle icon here - let shared navigation handle it
    // The shared navigation manages the global theme toggle
    
    // Update logo for theme - always use light logo (header is always dark)
    const logo = document.getElementById('cmrpLogo');
    if (logo) {
        logo.src = 'Logo/CMRP Logo Light.svg';
    }
    
    console.log('🎨 [WIN-LOSS-DEBUG] ===== THEME APPLICATION COMPLETED =====');
}

function toggleTheme() {
    // Let the shared navigation handle the theme toggle
    // This function might not be needed if shared navigation handles it
    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        // Trigger the shared navigation theme toggle instead
        themeToggleBtn.click();
    } else {
        // Fallback if no shared theme toggle available
        const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        saveSettings();
    }
    
    // Re-render charts with new theme colors if data is available
    if (dashboardDataCache) {
        renderWinLossCharts(dashboardDataCache);
    }
}

// --- INITIAL THEME SETUP ---
document.addEventListener('DOMContentLoaded', function() {
    // Apply saved theme on initial load - this is now handled above in the main DOMContentLoaded event
    // to ensure settings are loaded first
});

// --- Sync theme changes across tabs/pages and from shared navigation ---
window.addEventListener('storage', function(e) {
    if (e.key === 'theme') {
        const newTheme = e.newValue || 'light';
        console.log('[SETTINGS] Theme change detected via storage event:', newTheme);
        // Don't call applyTheme here since the DOM should already be updated by shared navigation
        // Just update our settings to match
        const currentSettings = loadSettings() || {};
        currentSettings.theme = newTheme;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
        
        // Re-render charts with new theme colors if data is available
        if (dashboardDataCache) {
            setTimeout(() => renderWinLossCharts(dashboardDataCache), 100);
        }
    }
});

// Watch for theme changes made by shared navigation on the same page
let themeChangeTimeout;
const themeObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            // Debounce to prevent excessive calls
            clearTimeout(themeChangeTimeout);
            themeChangeTimeout = setTimeout(() => {
                const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                console.log('[SETTINGS] Theme change detected via DOM mutation:', newTheme);
                
                // Update our settings to match the DOM state
                const currentSettings = loadSettings() || {};
                if (currentSettings.theme !== newTheme) {
                    currentSettings.theme = newTheme;
                    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
                    console.log('[SETTINGS] Updated settings to match theme:', newTheme);
                    
                    // Re-render charts with new theme colors if data is available
                    if (dashboardDataCache) {
                        setTimeout(() => renderWinLossCharts(dashboardDataCache), 100);
                    }
                }
                
                // Also fix filter label colors for theme changes
                console.log('🔄 Theme change detected, reapplying filter colors...');
                forceFilterLabelColors();
            }, 150);
        }
    });
});

// Observe theme changes on the HTML element
themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});

// --- User-Based Auto-Filtering Functions ---

// Get current user roles from JWT token
function getCurrentUserRoles() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn('[getCurrentUserRoles] No token found');
            return [];
        }
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.roles || [];
    } catch (error) {
        console.error('[getCurrentUserRoles] Error parsing token:', error);
        return [];
    }
}

// Map user roles to appropriate filter values
function mapUserRolesToFilters(userRoles, availableData) {
    const filters = {};
    
    if (!userRoles || userRoles.length === 0 || !availableData) {
        return filters;
    }
    
    console.log('[ROLE-FILTER] Mapping roles:', userRoles);
    
    // Get available filter values from data
    const accountMgrs = Array.from(new Set(availableData.map(opp => opp['account_mgr']).filter(Boolean)));
    const solutions = Array.from(new Set(availableData.map(opp => opp['solutions']).filter(Boolean)));
    
    // Role-based filtering logic
    userRoles.forEach(role => {
        switch(role.toUpperCase()) {
            case 'DS':
                // DS (Data Solutions) - filter by specific solutions
                const dsFilters = solutions.filter(sol => 
                    sol.toLowerCase().includes('data') || 
                    sol.toLowerCase().includes('analytics') ||
                    sol.toLowerCase().includes('intelligence') ||
                    sol.toLowerCase().includes('ds')
                );
                if (dsFilters.length > 0) {
                    filters.solutions = dsFilters[0];
                    console.log('[ROLE-FILTER] DS role mapped to solutions filter:', filters.solutions);
                }
                break;
                
            case 'SE':
                // SE (Smart Energy) - filter by technical solutions
                const seFilters = solutions.filter(sol => 
                    sol.toLowerCase().includes('engineering') || 
                    sol.toLowerCase().includes('technical') ||
                    sol.toLowerCase().includes('se')
                );
                if (seFilters.length > 0) {
                    filters.solutions = seFilters[0];
                    console.log('[ROLE-FILTER] SE role mapped to solutions filter:', filters.solutions);
                }
                break;
                
            case 'SALES':
                // Sales role - no automatic filtering
                console.log('[ROLE-FILTER] SALES role - no automatic filtering applied');
                break;
                
            case 'ADMIN':
                // Admin - full access, no filtering
                console.log('[ROLE-FILTER] ADMIN role - no filtering applied');
                break;
                
            default:
                console.log('[ROLE-FILTER] Unknown role:', role);
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
        // First try role-based filtering
        const userRoles = getCurrentUserRoles();
        console.log('[AUTO-FILTER] Checking role-based auto-filter for roles:', userRoles);
        
        if (userRoles && userRoles.length > 0 && dashboardDataCache && dashboardDataCache.length > 0) {
            const roleFilters = mapUserRolesToFilters(userRoles, dashboardDataCache);
            let roleFilterApplied = false;
            
            // Apply role-based solutions filter
            if (roleFilters.solutions) {
                console.log('[AUTO-FILTER] Applying role-based solutions filter:', roleFilters.solutions);
                currentSolutionsFilter = roleFilters.solutions;
                
                // Update dropdown if it exists
                const solutionsDropdown = document.getElementById('solutionsFilter');
                if (solutionsDropdown) {
                    solutionsDropdown.value = roleFilters.solutions;
                }
                roleFilterApplied = true;
            }
            
            if (roleFilterApplied) {
                console.log('[AUTO-FILTER] Role-based auto-filter applied, refreshing dashboard...');
                renderDashboard(dashboardDataCache);
                return; // Exit early if role-based filtering was applied
            }
        }
        
        // Fallback to username-based filtering if no role-based filtering was applied
        const userName = getCurrentUserName();
        console.log('[AUTO-FILTER] Checking username-based auto-filter for user:', userName);
        
        if (!userName || userName === 'Unknown User') {
            console.log('[AUTO-FILTER] No valid user found, skipping auto-filter');
            return;
        }
        
        if (!dashboardDataCache || !Array.isArray(dashboardDataCache)) {
            console.log('[AUTO-FILTER] Dashboard data not ready yet, skipping auto-filter');
            return;
        }
        
        let filterApplied = false;
        
        // Get available values from data
        const accountMgrs = Array.from(new Set(dashboardDataCache.map(opp => opp['account_mgr']).filter(Boolean)));
        
        // Try to match Account Manager first
        if (accountMgrs.length > 0) {
            const accountMgrMatch = mapUserNameToFilterValue(userName, accountMgrs);
            if (accountMgrMatch) {
                console.log('[AUTO-FILTER] Applying Account Manager filter:', accountMgrMatch);
                currentAccountMgrFilter = accountMgrMatch;
                
                // Update dropdown if it exists
                const mgrDropdown = document.getElementById('accountMgrFilter');
                if (mgrDropdown) {
                    mgrDropdown.value = accountMgrMatch;
                }
                filterApplied = true;
            }
        }
        
        // Apply the filters if any were set
        if (filterApplied) {
            console.log('[AUTO-FILTER] Username-based auto-filter applied, refreshing dashboard...');
            renderDashboard(dashboardDataCache);
        } else {
            console.log('[AUTO-FILTER] No matching filter found for user:', userName);
        }
        
    } catch (error) {
        console.error('[AUTO-FILTER] Error applying auto-filter:', error);
    }
}

function getCurrentUserName() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.warn('[getCurrentUserName] No token found');
            return 'Unknown User';
        }
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.name || payload.username || payload.email || 'Unknown User';
    } catch (error) {
        console.error('[getCurrentUserName] Error parsing token:', error);
        return 'Unknown User';
    }
}

// Apply user-based auto-filters on dashboard load
document.addEventListener('DOMContentLoaded', function() {
    // --- Existing code for initialization ---
    
    // Apply auto-filters for user
    applyAutoFiltersForUser();
    
    // --- Existing code for theme setup, etc. ---
});

