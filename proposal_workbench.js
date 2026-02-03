// --- API Configuration ---
function getApiUrl(endpoint) {
    const baseUrl = window.APP_CONFIG?.API_BASE_URL || '';
    return `${baseUrl}${endpoint}`;
}

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        // Token is invalid or expired, redirect to login
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
        throw new Error('Unauthorized');
    }
    
    return response;
}

// --- Global Variables ---
let proposals = [];
let scheduledTasks = {};
let customTasks = {};
let draggedItem = null;
let currentClientFilter = 'All Clients';
let accountManagerFilter = 'All Account Managers';
let solutionFilter = 'All Solutions';
let currentPicFilter = ''; // Empty string means "All PICs"
let currentSearchText = ''; // Store current search text
let currentWeekOffset = 0; // 0 = current week
let allProposals = []; // To store the original unfiltered list
let includeWeekends = true;
let hideOldSubmissions = false;
let nextTaskId = 1;
let currentDayIndex = null;
let filteredProposalsForSchedule = [];
let currentScheduleUserFilter = 'current'; // 'current' means logged-in user, 'all' means all users, or specific user ID
let currentUserInfo = null; // Store current user info
let scheduleUsers = []; // Store available users for filtering

// User Preferences (similar to main dashboard)
let userPreferences = {
    filters: {
        search: '',
        client: 'All Clients',
        accountManager: 'All Account Managers',
        solution: 'All Solutions',
        pic: ''
    },
    hasLoadedBefore: false
};

// --- DOM Elements ---
let clientFilter, accountManagerFilterSelect, picFilterSelect;
let scheduleUserFilter, scheduleFilterInfo;
let notStartedBody, ongoingBody, forApprovalBody, submittedBody, forRevisionBody, noDecisionBody;
let notStartedCount, ongoingCount, forApprovalCount, submittedCount, forRevisionCount, noDecisionCount;
let scheduleHeaderRow, scheduleBodyRow;
let currentWeekDisplay;
let themeToggle;
let proposalEditModal, proposalEditForm;
let taskModalOverlay, taskModalTitle, taskForm, taskIdInput, taskIsEditInput, taskDayIndexInput;
let weekendToggle;
let proposalViewBtn, scheduleViewBtn;
let proposalSearch; // Search input element

// --- Utility Functions ---
function formatCurrency(num) {
    const number = Number(num);
    if (isNaN(number)) return '₱0.00';
    return '₱' + number.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatNumberWithCommas(number) {
    if (!number && number !== 0) return '';
    // Convert to number if it's a string, then format with commas
    const num = typeof number === 'string' ? parseFloat(number.replace(/,/g, '')) : number;
    return isNaN(num) ? '' : num.toLocaleString('en-US');
}

function removeCommas(numberString) {
    if (!numberString) return '';
    // Remove commas, currency symbols, and other non-numeric characters except decimal points and minus signs
    return numberString.toString().replace(/[₱$,\s]/g, '');
}

function formatFinalAmountInput(event) {
    const field = event.target;
    const cursorPosition = field.selectionStart;
    const oldValue = field.value;
    
    // Remove commas and get numeric value
    const numericValue = removeCommas(oldValue);
    
    // Only format if it's a valid number
    if (numericValue && !isNaN(numericValue)) {
        const formattedValue = formatNumberWithCommas(numericValue);
        
        // Calculate new cursor position (account for added commas)
        const addedCommas = formattedValue.length - oldValue.length;
        const newCursorPosition = cursorPosition + addedCommas;
        
        field.value = formattedValue;
        
        // Restore cursor position
        setTimeout(() => {
            field.setSelectionRange(newCursorPosition, newCursorPosition);
        }, 0);
    }
}

// Check if user can view all schedules (admin/manager roles)
function canViewAllSchedules(userRoles) {
    if (!userRoles || !Array.isArray(userRoles)) return false;
    const adminRoles = ['ADMIN', 'MANAGER'];
    return userRoles.some(role => adminRoles.includes(role.toUpperCase()));
}

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

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const authLoadingScreen = document.getElementById('auth-loading-screen');

    // Shared navigation will auto-initialize via shared-navigation.js
    console.log('[PROPOSAL-WORKBENCH] Waiting for shared navigation to initialize...');

    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        // Validate token format
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userRoles = payload.roles || [];
            console.log(`[ACCESS] User ${payload.name} accessing proposal workbench with roles: ${userRoles.join(', ')}`);
            
            // Store current user info for filtering
            currentUserInfo = {
                id: payload.id,
                name: payload.name,
                roles: userRoles,
                canViewAllSchedules: canViewAllSchedules(userRoles)
            };
            
            // Check if token is expired
            if (payload.exp && payload.exp < Date.now() / 1000) {
                console.log('Token has expired, redirecting to login');
                localStorage.removeItem('authToken');
                window.location.href = 'login.html';
                return;
            }
        } catch (tokenError) {
            console.error('Invalid token format:', tokenError);
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
            return;
        }

        // Initialize the app
        initializeElements();
        
        // Wait for navigation to load before setting up event listeners and applying theme
        if (document.readyState === 'complete') {
            // Navigation should be loaded already
            setTimeout(() => {
                setupEventListeners();
                applyTheme(localStorage.getItem('theme') || 'dark');
            }, 100);
        } else {
            // Wait for navigation loaded event
            document.addEventListener('navigationLoaded', () => {
                setTimeout(() => {
                    setupEventListeners();
                    applyTheme(localStorage.getItem('theme') || 'dark');
                }, 100);
            });
            
            // Fallback - setup after a delay if navigation event doesn't fire
            setTimeout(() => {
                if (!window.navigationListenersSetup) {
                    setupEventListeners();
                    applyTheme(localStorage.getItem('theme') || 'dark');
                }
            }, 2000);
        }
        
        // Initialize view system after DOM elements are set up
        initViewSystem();

        // Try to load data with better error handling
        let hasErrors = false;
        
        try {
            await loadPicOptions(); // Load PIC filter options first
        } catch (error) {
            console.warn('Failed to load PIC options:', error);
            // Continue without PIC filter - this is not critical
        }
        
        try {
            await loadScheduleUsers(); // Load schedule users for filtering
        } catch (error) {
            console.warn('Failed to load schedule users:', error);
            // Continue without schedule user filter - this is not critical for non-admin users
        }
        
        try {
            await loadProposals();
        } catch (error) {
            console.error('Failed to load proposals:', error);
            hasErrors = true;
            // Show error in the proposals section but continue
            showProposalLoadError();
        }
        
        try {
            await loadSchedule();
        } catch (error) {
            console.error('Failed to load schedule:', error);
            hasErrors = true;
            // Show error in schedule section but continue
            showScheduleLoadError();
        }

        // Hide loading screen even if there were some errors
        if (authLoadingScreen) {
            authLoadingScreen.classList.add('hidden');
            console.log('[PROPOSAL-WORKBENCH] Loading screen hidden');
        }
        
        // Show main content - ALWAYS show this regardless of API errors
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.classList.remove('hidden');
            console.log('[PROPOSAL-WORKBENCH] Main content shown');
        } else {
            console.error('[PROPOSAL-WORKBENCH] Main content element not found!');
        }
        
        // Initialize user preferences system
        console.log('[PROPOSAL-WORKBENCH] Initializing user preferences...');
        await loadUserPreferences();
        setupFilterChangeListeners();
        
        // Enhance task modal with priority and category fields
        enhanceTaskModal();
        
        if (hasErrors) {
            // Show a notification about partial loading
            showPartialLoadNotification();
        }
        
    } catch (error) {
        console.error('Initialization failed:', error);
        
        // Check if it's an authentication error
        if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
            return;
        }
        
        // FAILSAFE: Always try to show main content even on error
        const mainContent = document.getElementById('main-content');
        const authLoadingScreen = document.getElementById('auth-loading-screen');
        
        if (authLoadingScreen) {
            authLoadingScreen.classList.add('hidden');
        }
        
        if (mainContent) {
            mainContent.classList.remove('hidden');
            console.log('[PROPOSAL-WORKBENCH] Main content shown (failsafe)');
            
            // Show error message in the main content area
            const errorDiv = document.createElement('div');
            errorDiv.className = 'p-6 m-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg';
            errorDiv.innerHTML = `
                <div class="flex items-center mb-4">
                    <span class="material-icons text-red-500 mr-2">error</span>
                    <h2 class="text-lg font-semibold text-red-800 dark:text-red-200">Loading Error</h2>
                </div>
                <p class="text-red-700 dark:text-red-300 mb-4">Some features may not work properly due to initialization errors.</p>
                <p class="text-sm text-red-600 dark:text-red-400 mb-4">Error: ${error.message}</p>
                <div class="space-x-2">
                    <button onclick="location.reload()" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Retry</button>
                </div>
            `;
            mainContent.prepend(errorDiv);
        } else {
            // Last resort - show error in loading screen
            if (authLoadingScreen) {
                authLoadingScreen.innerHTML = `
                    <div class="text-center text-red-500">
                        <h1 class="text-2xl font-bold mb-2">Error</h1>
                        <p>An error occurred during initialization. Please try again later.</p>
                        <p class="text-sm mt-2 text-gray-600">Error: ${error.message}</p>
                        <div class="mt-4 space-x-2">
                            <button onclick="location.reload()" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Retry</button>
                            <a href="login.html" class="inline-block bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Login</a>
                        </div>
                    </div>
                `;
            }
        }
    }
});

function initializeElements() {
    clientFilter = document.getElementById('clientFilter');
    accountManagerFilterSelect = document.getElementById('accountManagerFilter');
    picFilterSelect = document.getElementById('picFilter');
    solutionFilterSelect = document.getElementById('solutionFilter');
    
    console.log('[INIT-ELEMENTS] Filter elements found:', {
        clientFilter: !!clientFilter,
        accountManagerFilterSelect: !!accountManagerFilterSelect,
        picFilterSelect: !!picFilterSelect,
        solutionFilterSelect: !!solutionFilterSelect
    });
    
    // Schedule filter elements
    scheduleUserFilter = document.getElementById('scheduleUserFilter');
    scheduleFilterInfo = document.getElementById('scheduleFilterInfo');
    
    notStartedBody = document.getElementById('notStartedBody');
    ongoingBody = document.getElementById('ongoingBody');
    forApprovalBody = document.getElementById('forApprovalBody');
    submittedBody = document.getElementById('submittedBody');
    forRevisionBody = document.getElementById('forRevisionBody');
    noDecisionBody = document.getElementById('noDecisionBody');
    
    notStartedCount = document.getElementById('notStartedCount');
    ongoingCount = document.getElementById('ongoingCount');
    forApprovalCount = document.getElementById('forApprovalCount');
    submittedCount = document.getElementById('submittedCount');
    forRevisionCount = document.getElementById('forRevisionCount');
    noDecisionCount = document.getElementById('noDecisionCount');
    
    scheduleHeaderRow = document.getElementById('scheduleHeaderRow');
    scheduleBodyRow = document.getElementById('scheduleBodyRow');
    currentWeekDisplay = document.getElementById('current-week-display');

    themeToggle = document.getElementById('themeToggle');
    console.log('[INIT] Theme toggle element found:', themeToggle);
    
    proposalEditModal = document.getElementById('proposalEditModal');
    proposalEditForm = document.getElementById('proposalEditForm');

    taskModalOverlay = document.getElementById('taskModalOverlay');
    taskModalTitle = document.getElementById('taskModalTitle');
    taskForm = document.getElementById('taskForm');
    taskIdInput = document.getElementById('taskId');
    taskIsEditInput = document.getElementById('taskIsEdit');
    taskDayIndexInput = document.getElementById('taskDayIndex');

    weekendToggle = document.getElementById('weekend-toggle');

    // Initialize custom tasks
    loadCustomTasks();

    createWeeklyScheduleDOM();

    proposalSearch = document.getElementById('proposalSearch');
    console.log('[INIT-ELEMENTS] Search element found:', !!proposalSearch);
}

// Initialize the view toggle system
function initViewSystem() {
    console.log("Initializing view system");
    // Set initial view
    switchView('proposal');
}

function setupEventListeners() {
    // Mark that listeners are being set up
    window.navigationListenersSetup = true;
    
    // View Toggle System - Get button references
    proposalViewBtn = document.getElementById('proposalViewBtn');
    scheduleViewBtn = document.getElementById('scheduleViewBtn');
    
    // Add view toggle event listeners
    if (proposalViewBtn) {
        proposalViewBtn.addEventListener('click', () => switchView('proposal'));
    }
    if (scheduleViewBtn) {
        scheduleViewBtn.addEventListener('click', () => switchView('schedule'));
    }
    
    // Add search event listener
    if (proposalSearch) {
        console.log('[SEARCH] Setting up search event listener');
        
        const clearSearchBtn = document.getElementById('clearSearch');
        
        proposalSearch.addEventListener('input', debounce((event) => {
            currentSearchText = event.target.value.toLowerCase().trim();
            console.log('[SEARCH] Search text:', currentSearchText);
            
            // Show/hide clear button
            if (clearSearchBtn) {
                if (currentSearchText) {
                    clearSearchBtn.classList.remove('hidden');
                } else {
                    clearSearchBtn.classList.add('hidden');
                }
            }
            
            renderProposals();
        }, 300));
        
        // Clear search button event listener
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                proposalSearch.value = '';
                currentSearchText = '';
                clearSearchBtn.classList.add('hidden');
                renderProposals();
                proposalSearch.focus();
            });
        }
    } else {
        console.warn('[SEARCH] proposalSearch element not found');
    }
    
    picFilterSelect.addEventListener('change', async () => {
        console.log('[PIC-FILTER-EVENT] PIC filter changed from', currentPicFilter, 'to', picFilterSelect.value);
        currentPicFilter = picFilterSelect.value;
        
        // Store user's filter preference
        localStorage.setItem('picFilterPreference', currentPicFilter);
        console.log(`[PIC-FILTER] Stored filter preference: ${currentPicFilter || 'All PICs'}`);
        
        // Apply filter client-side like other filters
        renderProposals();
        renderNoDecisionProposals(); // Keep no decision count in sync
    });

    clientFilter.addEventListener('change', () => {
        console.log('[FILTER-EVENT] Client filter changed from', currentClientFilter, 'to', clientFilter.value);
        currentClientFilter = clientFilter.value;
        renderProposals();
        renderNoDecisionProposals(); // Keep no decision count in sync
    });

    accountManagerFilterSelect.addEventListener('change', () => {
        console.log('[FILTER-EVENT] Account Manager filter changed from', accountManagerFilter, 'to', accountManagerFilterSelect.value);
        accountManagerFilter = accountManagerFilterSelect.value;
        renderProposals();
        renderNoDecisionProposals(); // Keep no decision count in sync
    });
    
    solutionFilterSelect.addEventListener('change', () => {
        console.log('[FILTER-EVENT] Solution filter changed from', solutionFilter, 'to', solutionFilterSelect.value);
        solutionFilter = solutionFilterSelect.value;
        renderProposals();
        renderNoDecisionProposals(); // Keep no decision count in sync
    });

    // Last 10 submitted toggle
    const hideOldSubmittedToggle = document.getElementById('hideOldSubmitted');
    if (hideOldSubmittedToggle) {
        hideOldSubmittedToggle.addEventListener('change', () => {
            renderProposals(); // Re-render with new limit setting
        });
    }

    // Schedule user filter
    if (scheduleUserFilter) {
        scheduleUserFilter.addEventListener('change', async () => {
            currentScheduleUserFilter = scheduleUserFilter.value;
            await loadSchedule(); // Reload schedule with new user filter
            updateScheduleFilterInfo();
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Updated logout button ID to match the shared navigation structure
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        });
    }
    
    // Add change password button event listener
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    console.log('[SETUP] Change password button found:', changePasswordBtn);
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            window.location.href = 'update_password.html';
        });
    }
    
    // Kanban board drag-and-drop
    setupDragAndDrop();

    // Proposal Edit Modal
    document.getElementById('saveProposalChanges').addEventListener('click', handleProposalEditSubmit);
    document.getElementById('cancelProposalEdit').addEventListener('click', closeProposalEditModal);
    document.getElementById('closeProposalEditModal').addEventListener('click', closeProposalEditModal);
    document.getElementById('syncFromDriveBtn').addEventListener('click', handleSyncFromDrive);
    
    // Close modal when clicking outside
    document.getElementById('proposalEditModal').addEventListener('click', (e) => {
        if (e.target.id === 'proposalEditModal') {
            closeProposalEditModal();
        }
    });
    
    // Close modal with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('proposalEditModal').classList.contains('hidden')) {
            closeProposalEditModal();
        }
    });

    // Weekly schedule navigation
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const currentWeekBtn = document.getElementById('current-week-btn');

    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
    }
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => navigateWeek(1));
    }
    if (currentWeekBtn) {
        currentWeekBtn.addEventListener('click', goToCurrentWeek);
    }
    if (weekendToggle) {
        weekendToggle.addEventListener('change', toggleWeekends);
    }
    
    // Day Action Menu
    const addTaskAction = document.getElementById('addTaskAction');
    const addProposalAction = document.getElementById('addProposalAction');
    
    if (addTaskAction) {
        addTaskAction.addEventListener('click', () => {
            if (currentDayIndex !== null) {
                openTaskModal(null, currentDayIndex);
                document.getElementById('dayActionMenu').classList.add('hidden');
            }
        });
    }
    
    if (addProposalAction) {
        addProposalAction.addEventListener('click', () => {
            if (currentDayIndex !== null) {
                openProposalSelectionModal(currentDayIndex);
                document.getElementById('dayActionMenu').classList.add('hidden');
            }
        });
    }
    
    // Close day action menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('dayActionMenu');
        const isAddButton = e.target.closest('.add-day-item-btn') || 
                          e.target.closest('.add-day-item-bottom-btn') ||
                          e.target.closest('button[data-day-index]') ||
                          e.target.tagName === 'SPAN' && e.target.textContent === 'add';
        
        if (menu && !menu.contains(e.target) && !isAddButton) {
            menu.classList.add('hidden');
        }
    });

    // Task Modal
    const addTaskBtn = document.getElementById('addTaskBtn');
    const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
    const cancelTaskBtn = document.getElementById('cancelTaskBtn');
    const taskModalCloseBtn = document.getElementById('taskModalCloseBtn');
    const taskModalCancelBtn = document.getElementById('taskModalCancelBtn');

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => openTaskModal(null));
    }
    if (closeTaskModalBtn) {
        closeTaskModalBtn.addEventListener('click', closeTaskModal);
    }
    if (cancelTaskBtn) {
        cancelTaskBtn.addEventListener('click', closeTaskModal);
    }
    if (taskModalCloseBtn) {
        taskModalCloseBtn.addEventListener('click', closeTaskModal);
    }
    if (taskModalCancelBtn) {
        taskModalCancelBtn.addEventListener('click', closeTaskModal);
    }
    if (taskForm) {
        taskForm.addEventListener('submit', saveTask);
    }

    // No Decision Yet Modal
    const noDecisionToggleBtn = document.getElementById('noDecisionToggleBtn');
    const closeNoDecisionBtn = document.getElementById('closeNoDecisionBtn');
    
    if (noDecisionToggleBtn) {
        noDecisionToggleBtn.addEventListener('click', toggleNoDecisionModal);
    }
    if (closeNoDecisionBtn) {
        closeNoDecisionBtn.addEventListener('click', closeNoDecisionModal);
    }
    
    // View Toggle - assign to global variables
    proposalViewBtn = document.getElementById('proposalViewBtn');
    scheduleViewBtn = document.getElementById('scheduleViewBtn');
    
    if (proposalViewBtn) {
        proposalViewBtn.addEventListener('click', () => switchView('proposal'));
    }
    if (scheduleViewBtn) {
        scheduleViewBtn.addEventListener('click', () => switchView('schedule'));
    }
    
    // Proposal Selection Modal for Scheduling
    const addProposalToScheduleBtn = document.getElementById('addProposalToScheduleBtn');
    const closeProposalSelectionBtn = document.getElementById('closeProposalSelectionBtn');
    const proposalSelectionModal = document.getElementById('proposalSelectionModal');
    
    if (addProposalToScheduleBtn) {
        addProposalToScheduleBtn.addEventListener('click', openProposalSelectionModal);
    }
    
    // Fix close button - use the new ID
    const proposalModalCloseBtn = document.getElementById('proposalModalCloseBtn');
    if (proposalModalCloseBtn) {
        proposalModalCloseBtn.addEventListener('click', closeProposalSelectionModal);
    }
    
    // Ensure these elements exist before adding event listeners
    const proposalSearchInput = document.getElementById('proposalSearchInput');
    const proposalStatusFilter = document.getElementById('proposalStatusFilter');
    const proposalPicFilter = document.getElementById('proposalPicFilter');
    
    if (proposalSearchInput) {
        proposalSearchInput.addEventListener('input', filterProposalSelection);
    }
    
    if (proposalStatusFilter) {
        proposalStatusFilter.addEventListener('change', filterProposalSelection);
    }
    
    if (proposalPicFilter) {
        proposalPicFilter.addEventListener('change', filterProposalSelection);
    }
    
    // Close proposal selection modal when clicking outside
    if (proposalSelectionModal) {
        proposalSelectionModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeProposalSelectionModal();
            }
        });
    }
    
    // Make the modal draggable
    makeModalDraggable();
}

// --- Theme Management ---
function applyTheme(theme) {
    const html = document.documentElement;
    const logo = document.getElementById('cmrpLogo');
    const isDark = theme === 'dark';

    html.classList.toggle('dark', isDark);

    // Per style guide, header is always dark, so always use light logo
    if (logo) {
        logo.src = 'Logo/CMRP Logo Light.svg';
    }
    
    // Always show sun icon per user request - check if themeToggle exists
    if (themeToggle) {
        const themeIcon = themeToggle.querySelector('.material-icons');
        if (themeIcon) {
            themeIcon.textContent = 'wb_sunny';
        }
    }
    
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// --- Data Loading ---
async function loadPicOptions() {
    try {
        const response = await fetchWithAuth(getApiUrl('/api/proposal-workbench/proposals/pics'));
        if (!response.ok) {
            // If user doesn't have permission (403), skip loading PIC options
            if (response.status === 403) {
                console.log('User does not have permission to view PIC filter options');
                return;
            }
            throw new Error(`Failed to fetch PIC options: ${response.statusText}`);
        }
        const pics = await response.json();
        
        // Clear existing options except "All PICs"
        picFilterSelect.innerHTML = '<option value="">All PICs</option>';
        
        // Add PIC options
        pics.forEach(pic => {
            const option = document.createElement('option');
            option.value = pic.pic;
            option.textContent = `${pic.pic} (${pic.count})`;
            picFilterSelect.appendChild(option);
        });
        
        // Also populate the proposal selection modal PIC filter
        const proposalPicFilter = document.getElementById('proposalPicFilter');
        if (proposalPicFilter) {
            // Clear existing options
            proposalPicFilter.innerHTML = '<option value="">All PICs</option>';
            
            // Add PIC options
            pics.forEach(pic => {
                const option = document.createElement('option');
                option.value = pic.pic;
                option.textContent = `${pic.pic} (${pic.count})`;
                proposalPicFilter.appendChild(option);
            });
        }
        
        // Auto-select current user's PIC by default
        const token = localStorage.getItem('authToken');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userRoles = payload.roles || [];
            const userName = payload.name;
            
            // Find the user's PIC option if it exists
            const userOption = Array.from(picFilterSelect.options).find(option => 
                option.value === userName
            );
            
            // Only auto-select if user has proposals assigned to them AND no filter preference is stored
            const storedPicFilter = localStorage.getItem('picFilterPreference');
            
            if (userOption && !storedPicFilter) {
                picFilterSelect.value = userName;
                currentPicFilter = userName;
                console.log(`[PIC-FILTER] Auto-selected PIC filter for user: ${userName}`);
                console.log(`[PIC-FILTER] To see all proposals, change the PIC filter to "All PICs"`);
                
                // Show a notification to the user about the auto-filtering
                showPicFilterNotification(userName);
            } else if (storedPicFilter) {
                // Use stored preference
                const storedOption = Array.from(picFilterSelect.options).find(option => 
                    option.value === storedPicFilter
                );
                if (storedOption) {
                    picFilterSelect.value = storedPicFilter;
                    currentPicFilter = storedPicFilter;
                    console.log(`[PIC-FILTER] Using stored PIC filter preference: ${storedPicFilter}`);
                }
            } else {
                console.log(`[PIC-FILTER] User ${userName} not found in PIC options or preference set, keeping "All PICs" selected`);
            }
        }
        
    } catch (error) {
        console.error('Error loading PIC options:', error);
        // Hide PIC filter if it fails to load
        const picFilterContainer = picFilterSelect.closest('.flex');
        if (picFilterContainer) {
            picFilterContainer.style.display = 'none';
        }
    }
}

async function loadProposals() {
    try {
        // Load all proposals from server (PIC filtering will be done client-side)
        let url = getApiUrl('/api/proposal-workbench/proposals/workbench');
        console.log('[LOAD-PROPOSALS] Loading all proposals (PIC filtering done client-side)');
        
        console.log(`[LOAD-PROPOSALS] Fetching from URL: ${url}`);
        const response = await fetchWithAuth(url);
        if (!response.ok) throw new Error(`Failed to fetch proposals: ${response.statusText}`);
        
        const data = await response.json();
        allProposals = data.proposals || [];
        proposals = [...allProposals];
        
        const user = data.user;
        
        console.log(`[LOAD-PROPOSALS] Loaded ${allProposals.length} proposals`);
        console.log('[LOAD-PROPOSALS] Current PIC filter:', currentPicFilter);
        
        // Debug status values specifically for revision issues
        const statusCounts = {};
        allProposals.forEach(p => {
            const status = p.status || 'no status';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        console.log('[LOAD-PROPOSALS] Status distribution:', statusCounts);
        
        // Check for any revision-related proposals specifically
        const revisionProposals = allProposals.filter(p => 
            p.status && p.status.toLowerCase().includes('revision')
        );
        if (revisionProposals.length > 0) {
            console.log('[LOAD-PROPOSALS] Revision proposals found:', revisionProposals.map(p => ({
                name: p.project_name || p.proposal_name,
                status: p.status,
                pic: p.pic
            })));
        }
        
        // Log some details about loaded proposals
        if (allProposals.length > 0) {
            console.log('[LOAD-PROPOSALS] Sample proposals:', allProposals.slice(0, 3).map(p => ({
                project_name: p.project_name,
                client_name: p.client_name,
                pic: p.pic,
                status: p.status
            })));
        }
        
        // Auto-select Account Manager filter for sales users
        if (user && !user.isAdmin) {
            const accountMgrFilter = document.getElementById('accountMgrFilter');
            if (accountMgrFilter) {
                // Find the option that matches the user's name
                const userOption = Array.from(accountMgrFilter.options).find(option => 
                    option.value.toLowerCase() === user.name.toLowerCase()
                );
                
                if (userOption) {
                    accountMgrFilter.value = userOption.value;
                    accountManagerFilter = userOption.value; // Update the global variable
                    console.log('[FILTER] Auto-selected Account Manager filter:', userOption.value);
                }
            }
            
            // Reset PIC filter to "All PICs"
            const picFilter = document.getElementById('picFilter');
            if (picFilter) {
                picFilter.value = '';
                currentPicFilter = ''; // Update the global variable
                console.log('[FILTER] Reset PIC filter to "All PICs"');
            }
        }
        
        populateFilters(proposals);
        
        // Apply auto-filters for DS/SE users after filters are populated
        applyAutoFiltersForUser();
        
        renderProposals();
        renderNoDecisionProposals(); // Update no decision count and prepare modal content
    } catch (error) {
        console.error('Error loading proposals:', error);
        showProposalLoadError();
        throw error; // Re-throw to handle in the calling function
    }
}

async function loadSchedule() {
    // Don't reset drag setup here - let renderSchedule handle it
    const weekStartDate = getWeekStartDate(currentWeekOffset).toISOString().split('T')[0];
    try {
        // Build URL with user filter
        let url = getApiUrl(`/api/proposal-workbench/schedule?week=${weekStartDate}`);
        if (currentScheduleUserFilter && currentScheduleUserFilter !== 'current') {
            if (currentScheduleUserFilter === 'all') {
                url += '&user_id=all';
            } else {
                url += `&user_id=${encodeURIComponent(currentScheduleUserFilter)}`;
            }
        }
        
        const response = await fetchWithAuth(url);
        if (!response.ok) {
            if (response.status === 403) {
                // Permission denied - show message but don't treat as full error
                console.warn(`Access denied to schedule for user: ${currentScheduleUserFilter}`);
                showSchedulePermissionMessage(currentScheduleUserFilter);
                scheduledTasks = {}; // Empty schedule for this user
                customTasks = currentScheduleUserFilter === 'current' ? 
                    JSON.parse(localStorage.getItem('customTasks')) || {} : {};
                renderSchedule();
                return;
            }
            throw new Error(`Failed to fetch schedule: ${response.statusText}`);
        }
        const data = await response.json();
        scheduledTasks = data.proposals || {};
        customTasks = data.customTasks || JSON.parse(localStorage.getItem('customTasks')) || {};
        renderSchedule();
    } catch (error) {
        console.error('Error loading schedule:', error);
        // Use local storage as fallback for custom tasks
        customTasks = JSON.parse(localStorage.getItem('customTasks')) || {};
        renderSchedule();
    }
}

async function loadScheduleUsers() {
    try {
        // Allow all users to view schedule users for better collaboration
        // Users can see who has scheduled items even if they can't edit others' schedules
        
        console.log('[SCHEDULE-FILTER] Loading schedule users...');
        const response = await fetchWithAuth(getApiUrl('/api/proposal-workbench/schedule/users'));
        
        if (!response.ok) {
            if (response.status === 403) {
                console.log('[SCHEDULE-FILTER] User does not have permission to view schedule users');
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        scheduleUsers = await response.json();
        console.log(`[SCHEDULE-FILTER] Loaded ${scheduleUsers.length} schedule users`);
        
        // Populate schedule user filter
        populateScheduleUserFilter();
        
    } catch (error) {
        console.error('[SCHEDULE-FILTER] Failed to load schedule users:', error);
        throw error;
    }
}

function populateScheduleUserFilter() {
    if (!scheduleUserFilter) return;
    
    // Clear existing options
    scheduleUserFilter.innerHTML = '';
    
    // Add default options
    const currentOption = document.createElement('option');
    currentOption.value = 'current';
    currentOption.textContent = 'My Schedule';
    scheduleUserFilter.appendChild(currentOption);
    
    // Add "All Users" option for all authenticated users
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Users';
    scheduleUserFilter.appendChild(allOption);

    // Add individual users
    scheduleUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.username} (${user.schedule_count} items)`;
        scheduleUserFilter.appendChild(option);
    });
    
    // Update filter info
    updateScheduleFilterInfo();
}

function updateScheduleFilterInfo() {
    if (!scheduleFilterInfo) return;
    
    let infoText = '';
    
    if (currentScheduleUserFilter === 'current') {
        infoText = `Showing your schedule`;
    } else if (currentScheduleUserFilter === 'all') {
        infoText = `Showing all users' schedules`;
    } else {
        const selectedUser = scheduleUsers.find(u => u.id === currentScheduleUserFilter);
        if (selectedUser) {
            infoText = `Showing ${selectedUser.username}'s schedule`;
        }
    }
    
    // Show helpful info for current user view
    if (currentScheduleUserFilter === 'current') {
        infoText += ` (Add tasks to see them in your schedule)`;
    }
    
    scheduleFilterInfo.textContent = infoText;
}

// --- UI Rendering ---
function createWeeklyScheduleDOM() {
    resetDragSetup(); // Reset drag setup when creating new DOM
    scheduleHeaderRow.innerHTML = '';
    scheduleBodyRow.innerHTML = '';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 0; i < 7; i++) {
        const dayIndex = i;
        const dayName = days[dayIndex];

        // Create header
        const header = document.createElement('div');
        header.id = `day-header-${dayIndex}`;
        header.className = `schedule-header relative p-2 rounded-t-lg text-center font-semibold text-sm bg-blue-600 dark:bg-gray-700`;
        if (dayIndex === 0 || dayIndex === 6) {
            header.classList.add('weekend-day');
        }
        
        // Create day name and date elements
        const dayNameDiv = document.createElement('div');
        dayNameDiv.className = 'day-name';
        dayNameDiv.textContent = dayName;
        
        const dayDateDiv = document.createElement('div');
        dayDateDiv.className = 'day-date text-xs font-normal';
        dayDateDiv.textContent = '';
        
        header.appendChild(dayNameDiv);
        header.appendChild(dayDateDiv);
        
        // Add the "today" indicator if this is today
        const today = new Date();
        const weekStart = getWeekStartDate(currentWeekOffset);
        const currentDay = new Date(weekStart);
        currentDay.setDate(currentDay.getDate() + dayIndex);
        
        if (currentDay.toDateString() === today.toDateString()) {
            const todayIndicator = document.createElement('div');
            todayIndicator.className = 'today-indicator';
            todayIndicator.textContent = 'Today';
            header.appendChild(todayIndicator);
        }
        
        // Add header add button
        const addButton = document.createElement('button');
        addButton.className = 'add-day-item-btn';
        addButton.setAttribute('data-day-index', dayIndex);
        addButton.innerHTML = '<span class="material-icons">add</span>';
        addButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showDayActionMenu(dayIndex, addButton);
        });
        header.appendChild(addButton);

        // Create body
        const body = document.createElement('div');
        body.id = `day-cell-${dayIndex}`;
        body.className = `day-column bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-2 min-h-96`;
        if (dayIndex === 0 || dayIndex === 6) {
            body.classList.add('weekend-day');
        }
        
        // Note: Removed bottom add button creation

        scheduleHeaderRow.appendChild(header);
        scheduleBodyRow.appendChild(body);
    }
    
    updateWeeklyScheduleHeaders();
}

function createScheduleFilterSection() {
    const scheduleView = document.getElementById('scheduleView');
    if (!scheduleView) return;
    
    // Check if filter section already exists
    let existingFilter = document.getElementById('scheduleFilterSection');
    if (existingFilter) {
        return; // Already exists, don't create again
    }
    
    // Create the filter section
    const filterContainer = document.createElement('div');
    filterContainer.className = 'mb-6';
    
    const filterSection = document.createElement('div');
    filterSection.id = 'scheduleFilterSection';
    filterSection.className = 'flex justify-between items-center';
    
    // Left side - description
    const filterDescription = document.createElement('div');
    filterDescription.className = 'text-sm text-gray-600 dark:text-gray-400';
    filterDescription.textContent = 'Filter & customize your schedule view';
    
    // Right side - filters
    const filterControls = document.createElement('div');
    filterControls.className = 'flex items-center space-x-3';
    
    // User filter dropdown
    const userFilterContainer = document.createElement('div');
    userFilterContainer.className = 'flex items-center gap-2';
    
    const userLabel = document.createElement('label');
    userLabel.htmlFor = 'scheduleUserFilter';
    userLabel.className = 'filter-label text-sm font-medium text-gray-700 dark:text-gray-300';
    userLabel.textContent = 'User:';
    
    const userSelect = document.createElement('select');
    userSelect.id = 'scheduleUserFilter';
    userSelect.className = 'filter-dropdown mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white';
    
    // Add options
    const currentOption = document.createElement('option');
    currentOption.value = 'current';
    currentOption.textContent = 'My Schedule';
    userSelect.appendChild(currentOption);
    
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Users';
    userSelect.appendChild(allOption);
    
    // Add event listener for user filter change
    userSelect.addEventListener('change', function(e) {
        const selectedUser = e.target.value;
        
        // Check if user is trying to view someone else's schedule
        if (selectedUser !== 'current' && selectedUser !== 'all') {
            // Show warning that they can only view, not edit other users' schedules
            showScheduleViewWarning(selectedUser);
        }
        
        currentScheduleUserFilter = selectedUser;
        loadSchedule(); // Reload schedule with new filter
    });
    
    // Assemble the components
    userFilterContainer.appendChild(userLabel);
    userFilterContainer.appendChild(userSelect);
    filterControls.appendChild(userFilterContainer);
    
    filterSection.appendChild(filterDescription);
    filterSection.appendChild(filterControls);
    filterContainer.appendChild(filterSection);
    
    // Insert at the beginning of scheduleView
    scheduleView.insertBefore(filterContainer, scheduleView.firstChild);
    
    // Store reference for later use
    scheduleUserFilter = userSelect;
    
    // Load individual users and populate dropdown
    loadScheduleUsers();
}


function showScheduleViewWarning(userName) {
    // Remove any existing warnings
    const existingWarning = document.querySelector('.schedule-view-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    // Create warning notification
    const warning = document.createElement('div');
    warning.className = 'schedule-view-warning fixed top-4 right-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-400 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm';
    warning.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <span class="material-icons text-yellow-600 dark:text-yellow-400" style="font-size: 20px;">visibility</span>
            </div>
            <div class="ml-3">
                <p class="text-sm font-medium">Viewing ${userName}'s Schedule</p>
                <p class="text-xs mt-1">You can view but cannot edit other users' schedules. Switch back to "My Schedule" to make changes.</p>
                <button class="dismiss-warning-btn text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 mt-1 underline">Dismiss</button>
            </div>
            <button class="ml-auto text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200">
                <span class="material-icons text-sm">close</span>
            </button>
        </div>
    `;
    
    document.body.appendChild(warning);
    
    // Add click handlers to dismiss the warning
    const dismissBtn = warning.querySelector('.dismiss-warning-btn');
    const closeBtn = warning.querySelector('button:last-child');
    
    [dismissBtn, closeBtn].forEach(btn => {
        btn.addEventListener('click', () => warning.remove());
    });
    
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
        if (warning.parentElement) {
            warning.remove();
        }
    }, 8000);
}

function showSchedulePermissionMessage(userName) {
    // Remove any existing permission messages
    const existingMessage = document.querySelector('.schedule-permission-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create permission message
    const message = document.createElement('div');
    message.className = 'schedule-permission-message fixed top-4 right-4 bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm';
    message.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <span class="material-icons text-red-600 dark:text-red-400" style="font-size: 20px;">block</span>
            </div>
            <div class="ml-3">
                <p class="text-sm font-medium">Access Denied</p>
                <p class="text-xs mt-1">You don't have permission to view ${userName}'s schedule. Switch to "My Schedule" or "All Users".</p>
                <button class="dismiss-permission-btn text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 mt-1 underline">Dismiss</button>
            </div>
            <button class="ml-auto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200">
                <span class="material-icons text-sm">close</span>
            </button>
        </div>
    `;
    
    document.body.appendChild(message);
    
    // Add click handlers to dismiss the message
    const dismissBtn = message.querySelector('.dismiss-permission-btn');
    const closeBtn = message.querySelector('button:last-child');
    
    [dismissBtn, closeBtn].forEach(btn => {
        btn.addEventListener('click', () => message.remove());
    });
    
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
        if (message.parentElement) {
            message.remove();
        }
    }, 6000);
}

function updateWeeklyScheduleHeaders() {
    const weekStartDate = getWeekStartDate(currentWeekOffset);
    
    const startStr = weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = new Date(weekStartDate);
    endDate.setDate(endDate.getDate() + 6);
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    currentWeekDisplay.textContent = `Current Week (${startStr} - ${endStr})`;
    if (currentWeekOffset !== 0) {
        currentWeekDisplay.textContent = `${startStr} - ${endStr}`;
    }

    const today = new Date();
    
    document.querySelectorAll('.today-indicator').forEach(el => el.remove());
    document.querySelectorAll('.today-column').forEach(el => el.classList.remove('today-column'));


    for (let i = 0; i < 7; i++) {
        const dayIndex = i;
        const currentDay = new Date(weekStartDate);
        currentDay.setDate(currentDay.getDate() + dayIndex);

        const header = document.getElementById(`day-header-${dayIndex}`);
        
        // Ensure the header has the proper theme-responsive classes
        header.className = `schedule-header relative p-2 rounded-t-lg text-center font-semibold text-sm bg-blue-600 dark:bg-gray-700`;
        if (dayIndex === 0 || dayIndex === 6) {
            header.classList.add('weekend-day');
        }
        
        // Update day name
        const dayNameEl = header.querySelector('.day-name');
        if (dayNameEl) {
            dayNameEl.style.fontWeight = '500';
        }
        
        // Update day date
        const dayDateEl = header.querySelector('.day-date');
        if (dayDateEl) {
            dayDateEl.textContent = currentDay.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            dayDateEl.style.fontWeight = 'normal';
        }
        
        const isToday = currentDay.toDateString() === today.toDateString();
        if (isToday) {
            header.classList.add('today-column');
            const todayIndicator = document.createElement('span');
                            todayIndicator.className = 'today-indicator absolute top-1 right-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full';
            todayIndicator.textContent = 'Today';
            header.appendChild(todayIndicator);
        }
    }
}

function getWeekStartDate(offset = 0) {
    const now = new Date();
    // Start of the week is Sunday (day 0)
    const dayOfWeek = now.getDay();
    const date = new Date(now);
    date.setDate(now.getDate() - dayOfWeek + (offset * 7));
    date.setHours(0, 0, 0, 0);
    return date;
}

function navigateWeek(direction) {
    currentWeekOffset += direction;
    updateWeeklyScheduleHeaders();
    loadSchedule();
}

function goToCurrentWeek() {
    currentWeekOffset = 0;
    updateWeeklyScheduleHeaders();
    loadSchedule();
}

function toggleWeekends() {
    const showWeekends = weekendToggle.checked;
    const scheduleBoard = document.getElementById('schedule');
    if (showWeekends) {
        scheduleBoard.classList.remove('hide-weekends');
        scheduleBoard.style.gridTemplateColumns = 'repeat(7, 1fr)';
    } else {
        scheduleBoard.classList.add('hide-weekends');
        scheduleBoard.style.gridTemplateColumns = 'repeat(5, 1fr)';
    }
}

function populateFilters(data) {
    console.log('[POPULATE-FILTERS] Starting filter population with data:', data.length, 'proposals');
    
    // Log first few proposals to see the actual structure
    if (data.length > 0) {
        console.log('[POPULATE-FILTERS] Sample data structure:', data.slice(0, 2));
    }
    
    // Extract unique clients from multiple possible field names
    const clients = [...new Set(data.map(p => p.client_name || p.client).filter(Boolean))].sort();
    
    // Extract unique account managers from multiple possible field names  
    const accountManagers = [...new Set(data.map(p => p.account_manager || p.account_mgr).filter(Boolean))].sort();
    
    // Extract unique solutions
    const solutions = [...new Set(data.map(p => p.solutions || p.solution).filter(Boolean))].sort();
    
    console.log('[POPULATE-FILTERS] Found unique values:', {
        clients: clients.length,
        accountManagers: accountManagers.length,
        solutions: solutions.length
    });
    
    // Populate client filter
    if (clientFilter) {
        clientFilter.innerHTML = '<option value="All Clients">All Clients</option>';
        clients.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            clientFilter.appendChild(option);
        });
        console.log('[POPULATE-FILTERS] Populated client filter with', clients.length, 'clients');
    } else {
        console.warn('[POPULATE-FILTERS] clientFilter element not found');
    }

    // Populate account manager filter
    if (accountManagerFilterSelect) {
        accountManagerFilterSelect.innerHTML = '<option value="All Account Managers">All Account Managers</option>';
        accountManagers.forEach(am => {
            const option = document.createElement('option');
            option.value = am;
            option.textContent = am;
            accountManagerFilterSelect.appendChild(option);
        });
        console.log('[POPULATE-FILTERS] Populated account manager filter with', accountManagers.length, 'managers');
    } else {
        console.warn('[POPULATE-FILTERS] accountManagerFilterSelect element not found');
    }
    
    // Populate solution filter (only add options that aren't already hardcoded)
    if (solutionFilterSelect) {
        // Keep existing hardcoded options and add dynamic ones
        const existingOptions = Array.from(solutionFilterSelect.options).map(opt => opt.value);
        
        solutions.forEach(sol => {
            if (!existingOptions.includes(sol) && sol) {
                const option = document.createElement('option');
                option.value = sol;
                option.textContent = sol;
                solutionFilterSelect.appendChild(option);
            }
        });
        console.log('[POPULATE-FILTERS] Added dynamic solutions to filter:', solutions.filter(s => !existingOptions.includes(s)));
    } else {
        console.warn('[POPULATE-FILTERS] solutionFilterSelect element not found');
    }
}

function renderProposals(data = proposals, limitSubmitted = document.getElementById('hideOldSubmitted').checked) {
    try {
        console.log('[RENDER] Rendering proposals with search text:', currentSearchText);
        console.log('[RENDER] Data length:', data.length);
        console.log('[RENDER] Current filters:', {
            client: currentClientFilter,
            accountManager: accountManagerFilter,
            solution: solutionFilter,
            pic: currentPicFilter
        });
        
        // Log all proposal names to see what we're working with
        console.log('[RENDER] All proposals:', data.map(p => ({
            name: p.project_name || p.proposal_name,
            pic: p.pic,
            status: p.status,
            client: p.client_name || p.client
        })));
        
        // Clear all columns
        notStartedBody.innerHTML = '';
        ongoingBody.innerHTML = '';
        forRevisionBody.innerHTML = '';
        forApprovalBody.innerHTML = '';
        submittedBody.innerHTML = '';

        // Reset counts
        let notStartedCount = 0;
        let ongoingCount = 0;
        let forRevisionCount = 0;
        let forApprovalCount = 0;
        let submittedCount = 0;

        // Filter data based on current filters and search text
        const filteredData = data.filter(proposal => {
            // Client filter - use correct field names
            const matchesClient = currentClientFilter === 'All Clients' || 
                                proposal.client === currentClientFilter || 
                                proposal.client_name === currentClientFilter;
            
            // Account Manager filter - only apply if not empty
            const matchesAccountManager = !accountManagerFilter || 
                                       accountManagerFilter === 'All Account Managers' || 
                                       proposal.account_manager === accountManagerFilter;
            
            // Solution filter
            const matchesSolution = !solutionFilter || 
                                  solutionFilter === 'All Solutions' || 
                                  proposal.solution === solutionFilter ||
                                  proposal.solutions === solutionFilter;
            
            // PIC filter
            const matchesPic = !currentPicFilter || 
                             currentPicFilter === '' || 
                             proposal.pic === currentPicFilter ||
                             proposal.bom === currentPicFilter;
            
            // Debug PIC filtering for all proposals when PIC filter is active
            if (currentPicFilter) {
                console.log('[PIC-FILTER-DEBUG] Checking proposal:', {
                    name: proposal.project_name || proposal.proposal_name,
                    pic: proposal.pic,
                    bom: proposal.bom,
                    currentPicFilter: currentPicFilter,
                    picMatch: proposal.pic === currentPicFilter,
                    bomMatch: proposal.bom === currentPicFilter,
                    matchesPic: matchesPic
                });
            }
            
            // Search text matching - check multiple fields with correct field names
            const matchesSearch = !currentSearchText || [
                proposal.proposal_name,
                proposal.project_name,
                proposal.client,
                proposal.client_name,
                proposal.account_manager,
                proposal.pic,
                proposal.bom,
                proposal.solution,
                proposal.solutions,
                proposal.status,
                proposal.proposal_number,
                proposal.uid
            ].some(field => field && field.toString().toLowerCase().includes(currentSearchText));

            const matches = matchesClient && matchesAccountManager && matchesSolution && matchesPic && matchesSearch;
            
            // Debug specific proposal
            if ((proposal.project_name || proposal.proposal_name || '').toLowerCase().includes('contempo')) {
                console.log('[FILTER-DEBUG] Contempo proposal filtering:', {
                    name: proposal.project_name || proposal.proposal_name,
                    pic: proposal.pic,
                    currentPicFilter: currentPicFilter,
                    status: proposal.status,
                    matchesClient,
                    matchesAccountManager,
                    matchesSolution,
                    matchesPic,
                    matchesSearch,
                    finalMatches: matches
                });
            }
            
            if (currentSearchText) {
                console.log('[FILTER] Proposal:', proposal.project_name, 'matches:', matches);
            }
            
            return matches;
        });

        console.log('[RENDER] Filtered data length:', filteredData.length);
        console.log('[RENDER] Filtered proposals:', filteredData.map(p => p.project_name || p.proposal_name));

        // Sort submitted proposals by date if limiting
        let submittedProposals = filteredData.filter(p => p.status && p.status.toLowerCase() === 'submitted');
        let nonSubmittedProposals = filteredData.filter(p => !p.status || p.status.toLowerCase() !== 'submitted');
    
        if (limitSubmitted && submittedProposals.length > 0) {
            submittedProposals = submittedProposals.sort((a, b) => {
                const dateA = new Date(a.submission_date || 0);
                const dateB = new Date(b.submission_date || 0);
                return dateB - dateA; // Most recent first
            }).slice(0, 10);
        }
    
        const finalFilteredData = [...nonSubmittedProposals, ...submittedProposals];

        // Distribute proposals to their respective columns
        finalFilteredData.forEach(proposal => {
            const card = createProposalCard(proposal);
            const originalStatus = proposal.status || 'not started';
            const status = originalStatus.toLowerCase().trim();
            
            // Comprehensive debug for all status values
            console.log('[STATUS-DEBUG] Processing proposal:', {
                name: proposal.project_name || proposal.proposal_name,
                originalStatus: originalStatus,
                processedStatus: status
            });
            
            // Debug for specific statuses
            if (status.includes('approval')) {
                console.log('[STATUS-DEBUG] Approval status detected:', {
                    original: originalStatus,
                    processed: status,
                    proposalName: proposal.project_name || proposal.proposal_name
                });
            }
            
            if (status.includes('revision')) {
                console.log('[STATUS-DEBUG] Revision status detected:', {
                    original: originalStatus,
                    processed: status,
                    proposalName: proposal.project_name || proposal.proposal_name
                });
            }

            switch (status) {
                case 'not started':
                case 'not yet started':
                case 'not_yet_started':
                    notStartedBody.appendChild(card);
                    notStartedCount++;
                    break;
                case 'ongoing':
                case 'on-going':
                    ongoingBody.appendChild(card);
                    ongoingCount++;
                    break;
                case 'for revision':
                case 'for_revision':
                case 'revision':
                case 'forrevision':
                    forRevisionBody.appendChild(card);
                    forRevisionCount++;
                    console.log('[STATUS-DEBUG] Added to revision column:', proposal.project_name || proposal.proposal_name);
                    break;
                case 'for approval':
                case 'for_approval':
                case 'approval':
                case 'forapproval':
                    forApprovalBody.appendChild(card);
                    forApprovalCount++;
                    console.log('[STATUS-DEBUG] Added to approval column:', proposal.project_name || proposal.proposal_name);
                    break;
                case 'submitted':
                    submittedBody.appendChild(card);
                    submittedCount++;
                    break;
                default:
                    console.warn(`[STATUS-DEBUG] Unknown status: ${status} for proposal:`, proposal.project_name || proposal.proposal_name);
            }
        });

        // Update counts
        document.getElementById('notStartedCount').textContent = notStartedCount;
        document.getElementById('ongoingCount').textContent = ongoingCount;
        document.getElementById('forRevisionCount').textContent = forRevisionCount;
        document.getElementById('forApprovalCount').textContent = forApprovalCount;
        document.getElementById('submittedCount').textContent = submittedCount;
        
        // Apply saved sort order to each column
        applyColumnSorting();

        // Show empty state if no proposals
        if (finalFilteredData.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'text-center text-gray-500 dark:text-gray-400 py-4';
            emptyState.textContent = currentSearchText ? 'No proposals match your search' : 'No proposals found';
            notStartedBody.appendChild(emptyState.cloneNode(true));
            ongoingBody.appendChild(emptyState.cloneNode(true));
            forRevisionBody.appendChild(emptyState.cloneNode(true));
            forApprovalBody.appendChild(emptyState.cloneNode(true));
            submittedBody.appendChild(emptyState.cloneNode(true));
        }

    } catch (error) {
        console.error('Error rendering proposals:', error);
        showErrorMessage('Failed to render proposals. Please try again.');
    }
}

function createProposalCard(proposal) {
    const card = document.createElement('div');
    card.className = 'proposal-card bg-white dark:bg-gray-900/50 p-3 mb-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab';
    card.draggable = true;
    card.dataset.proposalId = proposal.uid;

    const commentHTML = proposal.comment ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-600 italic">"${proposal.comment}"</p>` : '';
    
    // Create PIC/BOM display
    const picBomHTML = (() => {
        const pic = proposal.pic || '';
        const bom = proposal.bom || '';
        
        if (pic && bom && pic !== bom) {
            return `<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span class="inline-block bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded text-xs mr-1">PIC: ${pic}</span>
                <span class="inline-block bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded text-xs">BOM: ${bom}</span>
            </div>`;
        } else if (pic && bom && pic === bom) {
            return `<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span class="inline-block bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 px-1.5 py-0.5 rounded text-xs">PIC & BOM: ${pic}</span>
            </div>`;
        } else if (pic) {
            return `<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span class="inline-block bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded text-xs">PIC: ${pic}</span>
            </div>`;
        } else if (bom) {
            return `<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span class="inline-block bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 px-1.5 py-0.5 rounded text-xs">BOM: ${bom}</span>
            </div>`;
        }
        return '';
    })();

    // Show return to no decision button only if not already in no decision status
    const showReturnButton = proposal.status !== 'no_decision_yet' && proposal.status !== 'pending';
    
    card.innerHTML = `
        <div class="flex justify-between items-start">
            <h4 class="font-bold text-sm text-gray-900 dark:text-white">${proposal.project_name}</h4>
            <div class="flex items-center space-x-1">
                ${showReturnButton ? '<button class="return-to-no-decision-btn material-icons text-base text-yellow-500 hover:text-yellow-600" title="Return to No Decision">help_outline</button>' : ''}
                <button class="edit-proposal-btn material-icons text-base text-gray-400 hover:text-indigo-500" title="Edit Proposal">edit</button>
            </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">${proposal.client_name}</p>
        ${picBomHTML}
        <div class="flex justify-between items-end mt-2">
            <span class="text-xs text-gray-500 dark:text-gray-400">Rev: ${proposal.revision_number !== undefined && proposal.revision_number !== null ? proposal.revision_number : 'N/A'}</span>
            <span class="text-sm font-semibold text-gray-800 dark:text-gray-200">${formatCurrency(proposal.final_amount)}</span>
        </div>
        ${commentHTML}
    `;

    card.addEventListener('dragstart', (e) => {
        console.log('Drag start for proposal:', proposal.uid, proposal.project_name); // Debug log
        draggedItem = { type: 'proposal', id: proposal.uid, name: proposal.project_name, element: card };
        e.dataTransfer.setData('text/plain', proposal.uid);
        setTimeout(() => card.classList.add('opacity-50'), 0);
    });

    card.addEventListener('dragend', () => {
        console.log('Drag end for proposal:', proposal.uid);
        draggedItem = null;
        card.classList.remove('opacity-50');
        
        // Clean up any lingering drag-over classes from all columns
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    });

    card.querySelector('.edit-proposal-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openProposalEditModal(proposal.uid);
    });

    // Add return to no decision functionality
    const returnBtn = card.querySelector('.return-to-no-decision-btn');
    if (returnBtn) {
        returnBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await returnProposalToNoDecision(proposal.uid);
        });
    }

    return card;
}


// --- Drag and Drop ---
function setupDragAndDrop() {
    console.log('[DRAG] Setting up drag and drop');
    
    // Clear any existing drag-over classes first
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    
    // Set up drop zones for column bodies - without cloning to preserve existing cards
    const columnBodies = document.querySelectorAll('.kanban-column-body');
    
    // Also add the no decision modal body if it exists
    const noDecisionModalBody = document.getElementById('noDecisionBody');
    const allDropZones = [...columnBodies];
    if (noDecisionModalBody) {
        allDropZones.push(noDecisionModalBody);
    }
    
    allDropZones.forEach(col => {
        // Remove existing event listeners by replacing with clean versions
        col.removeEventListener('dragover', col._dragoverHandler);
        col.removeEventListener('dragleave', col._dragleaveHandler);
        col.removeEventListener('drop', col._dropHandler);
        
        // Create and store new event handlers
        col._dragoverHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (draggedItem && draggedItem.type === 'proposal') {
                col.classList.add('drag-over');
                col.parentElement.classList.add('drag-over');
                console.log('[DRAG] Dragover on column:', col.id);
                
                // Handle sorting within the same column
                const afterElement = getDragAfterElement(col, e.clientY);
                const draggedElement = draggedItem.element;
                
                // Remove existing sort indicators
                col.querySelectorAll('.sort-indicator').forEach(el => el.remove());
                
                // Add visual sort indicator
                if (afterElement == null) {
                    // Insert at end
                    const indicator = document.createElement('div');
                    indicator.className = 'sort-indicator h-1 bg-indigo-500 rounded mx-2 mb-2';
                    col.appendChild(indicator);
                } else {
                    // Insert before afterElement
                    const indicator = document.createElement('div');
                    indicator.className = 'sort-indicator h-1 bg-indigo-500 rounded mx-2 mb-2';
                    col.insertBefore(indicator, afterElement);
                }
            }
        };
        
        col._dragleaveHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Use relatedTarget to check if we're really leaving the drop zone
            // This prevents flickering when dragging over child elements
            if (!col.contains(e.relatedTarget)) {
                col.classList.remove('drag-over');
                col.parentElement.classList.remove('drag-over');
                // Remove sort indicators when leaving
                col.querySelectorAll('.sort-indicator').forEach(el => el.remove());
            }
        };
        
        col._dropHandler = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            col.classList.remove('drag-over');
            col.parentElement.classList.remove('drag-over');
            
            // Remove sort indicators
            col.querySelectorAll('.sort-indicator').forEach(el => el.remove());
            
            if (!draggedItem || draggedItem.type !== 'proposal') {
                console.log('[DRAG] No valid dragged item');
                return;
            }
            
            const proposalId = draggedItem.id;
            const draggedElement = draggedItem.element;
            console.log('[DRAG] Drop event on column:', col.id, 'with proposal:', proposalId);
            
            // Check if dropping in same column (for sorting)
            const sourceParent = draggedElement.parentElement;
            if (sourceParent === col) {
                // Handle sorting within the same column
                console.log('[DRAG] Sorting within same column');
                const afterElement = getDragAfterElement(col, e.clientY);
                
                if (afterElement == null) {
                    col.appendChild(draggedElement);
                } else {
                    col.insertBefore(draggedElement, afterElement);
                }
                
                // Save the new order to localStorage for persistence
                saveColumnOrder(col.id, Array.from(col.children).map(card => card.dataset.proposalId).filter(id => id));
                return;
            }
            
            // Map column IDs to status values (match backend database format)
            let newStatus = '';
            switch(col.id) {
                case 'notStartedBody':
                    newStatus = 'Not Yet Started';
                    break;
                case 'ongoingBody':
                    newStatus = 'On-Going'; // Fixed: changed from 'Ongoing' to 'On-Going'
                    break;
                case 'forApprovalBody':
                    newStatus = 'For Approval';
                    break;
                case 'submittedBody':
                    newStatus = 'Submitted';
                    break;
                case 'forRevisionBody':
                    newStatus = 'For Revision';
                    break;
                default:
                    if (col.id === 'noDecisionBody') {
                        newStatus = 'No Decision Yet';
                    } else {
                        console.warn('[DRAG] Unknown column:', col.id);
                    }
                    if (col.id !== 'noDecisionBody') {
                        return;
                    }
            }
            
            console.log('[DRAG] Mapped status:', newStatus);
            
            try {
                // Update the proposal status
                await updateProposalStatus(proposalId, newStatus);
                
            } catch (error) {
                console.error('[DRAG] Error updating proposal status:', error);
                // Reload proposals on error to reset the UI
                await loadProposals();
            }
        };
        
        // Add the new event listeners
        col.addEventListener('dragover', col._dragoverHandler);
        col.addEventListener('dragleave', col._dragleaveHandler);
        col.addEventListener('drop', col._dropHandler);
    });

    // Add visual feedback styles
    const style = document.createElement('style');
    style.textContent = `
        .drag-over {
            background-color: rgba(99, 102, 241, 0.1) !important;
            border-color: rgba(99, 102, 241, 0.5) !important;
            border-width: 2px !important;
            border-style: dashed !important;
        }
        .dark .drag-over {
            background-color: rgba(99, 102, 241, 0.2) !important;
        }
        .proposal-card.opacity-50 {
            opacity: 0.5 !important;
            transform: rotate(2deg) !important;
        }
    `;
    
    // Remove existing style if it exists
    const existingStyle = document.getElementById('drag-drop-styles');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    style.id = 'drag-drop-styles';
    document.head.appendChild(style);
    
    console.log('[DRAG] Drag and drop setup complete');
}

// Global flag to prevent multiple drag setups
let dragSetupInitialized = false;

// Function to reset drag setup (called when switching weeks or refreshing)
function resetDragSetup() {
    dragSetupInitialized = false;
    console.log('[SCHEDULE-DRAG] Drag setup reset');
}

// Schedule drag and drop setup
function setupScheduleDragAndDrop() {
    if (dragSetupInitialized) {
        console.log('[SCHEDULE-DRAG] Drag and drop already initialized, skipping...');
        return;
    }
    
    console.log('[SCHEDULE-DRAG] Setting up schedule drag and drop');
    dragSetupInitialized = true;
    
    // Set up drop zones for day columns
    const dayColumns = document.querySelectorAll('.day-column');
    
    dayColumns.forEach((col, dayIndex) => {
        // Remove existing event listeners
        col.removeEventListener('dragover', col._scheduleDragoverHandler);
        col.removeEventListener('dragleave', col._scheduleDragleaveHandler);
        col.removeEventListener('drop', col._scheduleDropHandler);
        
        // Create and store new event handlers
        col._scheduleDragoverHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check if we're over the summary area - if so, don't allow drop
            if (e.target.closest('.schedule-day-summary')) {
                return;
            }
            
            if (draggedItem && (draggedItem.type === 'task' || draggedItem.type === 'proposal')) {
                col.classList.add('schedule-drag-over');
                console.log('[SCHEDULE-DRAG] Dragover on day column:', dayIndex, col.id);
                
                // Handle sorting within the same column
                const afterElement = getScheduleDragAfterElement(col, e.clientY);
                const draggedElement = draggedItem.element;
                
                // Remove existing sort indicators
                col.querySelectorAll('.schedule-sort-indicator').forEach(el => el.remove());
                
                // Add sort indicator
                if (afterElement && afterElement !== draggedElement) {
                    const indicator = document.createElement('div');
                    indicator.className = 'schedule-sort-indicator h-0.5 bg-indigo-500 rounded mx-2 my-1';
                    afterElement.parentNode.insertBefore(indicator, afterElement);
                } else if (!afterElement) {
                    const indicator = document.createElement('div');
                    indicator.className = 'schedule-sort-indicator h-0.5 bg-indigo-500 rounded mx-2 my-1';
                    col.appendChild(indicator);
                }
            }
        };
        
        col._scheduleDragleaveHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Use relatedTarget to check if we're really leaving the drop zone
            if (!col.contains(e.relatedTarget)) {
                col.classList.remove('schedule-drag-over');
                col.querySelectorAll('.schedule-sort-indicator').forEach(el => el.remove());
            }
        };
        
        col._scheduleDropHandler = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Check if we're dropping on the summary area - if so, don't allow drop
            if (e.target.closest('.schedule-day-summary')) {
                col.classList.remove('schedule-drag-over');
                col.querySelectorAll('.schedule-sort-indicator').forEach(el => el.remove());
                return;
            }
            
            col.classList.remove('schedule-drag-over');
            col.querySelectorAll('.schedule-sort-indicator').forEach(el => el.remove());
            
            if (!draggedItem || (draggedItem.type !== 'task' && draggedItem.type !== 'proposal')) {
                console.log('[SCHEDULE-DRAG] No valid dragged item');
                return;
            }
            
            const taskId = draggedItem.id;
            const sourceDayIndex = parseInt(draggedItem.dayIndex);
            const targetDayIndex = dayIndex;
            const draggedElement = draggedItem.element;
            
            console.log('[SCHEDULE-DRAG] Drop event on day column:', dayIndex, 'with task:', taskId, 'from day:', sourceDayIndex);
            
            // Check if dropping in same column (for sorting)
            if (sourceDayIndex === targetDayIndex) {
                // Handle sorting within the same column
                console.log('[SCHEDULE-DRAG] Sorting within same day');
                const afterElement = getScheduleDragAfterElement(col, e.clientY);
                
                if (afterElement == null) {
                    col.appendChild(draggedElement);
                } else {
                    col.insertBefore(draggedElement, afterElement);
                }
                
                // Save the new order to localStorage for persistence
                const taskElements = col.querySelectorAll('.schedule-task');
                const taskOrder = Array.from(taskElements).map(el => el.dataset.taskId);
                saveScheduleOrder(targetDayIndex, taskOrder);
                
                return;
            }
            
            // Move task to different day
            try {
                if (draggedItem.type === 'proposal') {
                    // Move proposal task to different day
                    await moveProposalToDay(taskId, sourceDayIndex, targetDayIndex);
                    // Reload schedule to get updated data and refresh UI with new date information
                    await loadSchedule();
                } else {
                    // Move custom task to different day
                    await moveTaskToDay(taskId, sourceDayIndex, targetDayIndex);
                    // Reload schedule to get updated data and refresh UI with new date information
                    await loadSchedule();
                }
                
                console.log('[SCHEDULE-DRAG] Successfully moved task to day:', targetDayIndex);
                
            } catch (error) {
                console.error('[SCHEDULE-DRAG] Failed to move task:', error);
                // Reload schedule to revert any partial changes
                await loadSchedule();
            }
        };
        
        // Add the new event listeners
        col.addEventListener('dragover', col._scheduleDragoverHandler);
        col.addEventListener('dragleave', col._scheduleDragleaveHandler);
        col.addEventListener('drop', col._scheduleDropHandler);
    });
    
    // Add visual feedback styles for schedule drag/drop
    const existingScheduleStyle = document.getElementById('schedule-drag-drop-styles');
    if (existingScheduleStyle) {
        existingScheduleStyle.remove();
    }
    
    const scheduleStyle = document.createElement('style');
    scheduleStyle.id = 'schedule-drag-drop-styles';
    scheduleStyle.textContent = `
        .schedule-drag-over {
            background-color: rgba(99, 102, 241, 0.1) !important;
            border-color: rgba(99, 102, 241, 0.5) !important;
            border-width: 2px !important;
            border-style: dashed !important;
        }
        .dark .schedule-drag-over {
            background-color: rgba(99, 102, 241, 0.2) !important;
        }
        .schedule-task.opacity-50 {
            opacity: 0.5 !important;
        }
        .schedule-sort-indicator {
            transition: all 0.2s ease;
        }
    `;
    document.head.appendChild(scheduleStyle);
    
    console.log('[SCHEDULE-DRAG] Schedule drag and drop setup complete');
}

function getScheduleDragAfterElement(container, y) {
    // Only consider draggable tasks, exclude summaries and non-sortable elements
    const draggableElements = [...container.querySelectorAll('.schedule-task:not(.opacity-50):not([data-non-sortable])')];
    
    return draggableElements.reduce((closest, child) => {
        // Skip elements that shouldn't be sorted
        if (child.hasAttribute('data-non-sortable') || child.classList.contains('schedule-day-summary')) {
            return closest;
        }
        
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Functions to move tasks between days
async function moveProposalToDay(taskId, sourceDayIndex, targetDayIndex) {
    // Move in local data structure
    if (scheduledTasks[sourceDayIndex]) {
        const taskIndex = scheduledTasks[sourceDayIndex].findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = scheduledTasks[sourceDayIndex].splice(taskIndex, 1)[0];
            if (!scheduledTasks[targetDayIndex]) {
                scheduledTasks[targetDayIndex] = [];
            }
            scheduledTasks[targetDayIndex].push(task);
        }
    }
    
    // Update in database
    const newWeekStartDate = getWeekStartDate(currentWeekOffset).toISOString().split('T')[0];
    const response = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/schedule/proposals/${taskId}/move`), {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            newWeekStartDate: newWeekStartDate,
            newDayIndex: targetDayIndex,
            sourceDayIndex: sourceDayIndex,
            sourceWeekStartDate: newWeekStartDate  // Same week for now
        })
    });
    
    if (!response.ok) throw new Error('Failed to move proposal task');
}

async function moveTaskToDay(taskId, sourceDayIndex, targetDayIndex) {
    // Move in local data structure
    if (customTasks[sourceDayIndex]) {
        const taskIndex = customTasks[sourceDayIndex].findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            const task = customTasks[sourceDayIndex].splice(taskIndex, 1)[0];
            if (!customTasks[targetDayIndex]) {
                customTasks[targetDayIndex] = [];
            }
            customTasks[targetDayIndex].push(task);
        }
    }
    
    // Update in database
    const newWeekStartDate = getWeekStartDate(currentWeekOffset).toISOString().split('T')[0];
    const response = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/schedule/tasks/${taskId}/move`), {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            newWeekStartDate: newWeekStartDate,
            newDayIndex: targetDayIndex
        })
    });
    
    if (!response.ok) throw new Error('Failed to move custom task');
}

function saveScheduleOrder(dayIndex, taskOrder) {
    try {
        const orderData = JSON.parse(localStorage.getItem('scheduleTaskOrder') || '{}');
        const weekKey = `week_${currentWeekOffset}`;
        if (!orderData[weekKey]) {
            orderData[weekKey] = {};
        }
        orderData[weekKey][dayIndex] = taskOrder;
        localStorage.setItem('scheduleTaskOrder', JSON.stringify(orderData));
        console.log('[SCHEDULE-SORT] Saved task order for day', dayIndex, ':', taskOrder);
    } catch (error) {
        console.error('[SCHEDULE-SORT] Error saving task order:', error);
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.proposal-card:not(.opacity-50)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveColumnOrder(columnId, proposalIds) {
    try {
        const orderData = JSON.parse(localStorage.getItem('proposalColumnOrder') || '{}');
        orderData[columnId] = proposalIds;
        localStorage.setItem('proposalColumnOrder', JSON.stringify(orderData));
        console.log('[SORT] Saved column order for', columnId, ':', proposalIds);
    } catch (error) {
        console.error('[SORT] Error saving column order:', error);
    }
}

function loadColumnOrder(columnId) {
    try {
        const orderData = JSON.parse(localStorage.getItem('proposalColumnOrder') || '{}');
        return orderData[columnId] || [];
    } catch (error) {
        console.error('[SORT] Error loading column order:', error);
        return [];
    }
}

function applyColumnSorting() {
    const columns = {
        'notStartedBody': notStartedBody,
        'ongoingBody': ongoingBody,
        'forApprovalBody': forApprovalBody,
        'forRevisionBody': forRevisionBody,
        'submittedBody': submittedBody
    };
    
    Object.entries(columns).forEach(([columnId, columnElement]) => {
        const savedOrder = loadColumnOrder(columnId);
        if (savedOrder.length === 0) return; // No saved order
        
        const cards = Array.from(columnElement.children);
        const orderedCards = [];
        
        // First, add cards in the saved order
        savedOrder.forEach(proposalId => {
            const card = cards.find(c => c.dataset.proposalId === proposalId);
            if (card) {
                orderedCards.push(card);
            }
        });
        
        // Then, add any cards not in the saved order (new cards)
        cards.forEach(card => {
            if (!orderedCards.includes(card)) {
                orderedCards.push(card);
            }
        });
        
        // Clear the column and re-append in the correct order
        columnElement.innerHTML = '';
        orderedCards.forEach(card => {
            columnElement.appendChild(card);
        });
        
        console.log('[SORT] Applied sorting to', columnId, 'with order:', savedOrder);
    });
}

async function updateProposalStatus(proposalId, newStatus) {
    try {
        console.log('[API-UPDATE] Starting status update with:', newStatus);
        
        const response = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/proposals/${proposalId}/status`), {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }
        
        let responseData;
        try {
            responseData = await response.json();
            console.log('[API-UPDATE] ✅ SUCCESS:', responseData);
        } catch (e) {
            console.log('[API-UPDATE] ✅ SUCCESS (no JSON response)');
        }
        
        // Record status change in history
        try {
            await recordProposalStatusChange(proposalId, newStatus, 'Status changed via drag and drop');
        } catch (historyError) {
            console.warn('[API-UPDATE] Failed to record status change in history:', historyError);
            // Don't fail the whole operation if history recording fails
        }

        // Update local data - find proposal and update its status to match backend format
        const proposal = allProposals.find(p => p.uid === proposalId);
        if (proposal) {
            console.log('[API-UPDATE] Before update - local proposal status:', proposal.status);
            
            // Map the database status back to workbench format for local storage
            const statusMap = {
                'Submitted': 'submitted',
                'On-Going': 'ongoing', 
                'For Approval': 'for_approval',
                'For Revision': 'for_revision',
                'Not Yet Started': 'not_yet_started',
                'No Decision Yet': 'no_decision_yet'
            };
            
            proposal.status = statusMap[newStatus] || newStatus.toLowerCase().replace(/ /g, '_');
            console.log('[API-UPDATE] After update - local proposal status:', proposal.status);
        } else {
            console.error('[API-UPDATE] Could not find proposal in local data:', proposalId);
        }
        
        // If moved to submitted, automatically open edit modal with today's date
        if (newStatus.toLowerCase().includes('submit')) {
            setTimeout(() => {
                openProposalEditModalForSubmission(proposalId);
            }, 300);
        }
        
        console.log('[API-UPDATE] Re-rendering proposals with updated data');
        renderProposals(allProposals);
        renderNoDecisionProposals();
        
        console.log(`[API-UPDATE] 🎉 SUCCESS! Status updated to: "${newStatus}"`);
        
    } catch (error) {
        console.error('[API-UPDATE] ❌ Status update failed:', error);
        console.error('[API-UPDATE] Error details:', {
            message: error.message,
            stack: error.stack
        });
        
        // Reload proposals on error to reset the UI
        renderProposals(allProposals);
        renderNoDecisionProposals();
        
        // Show user-friendly error
        alert(`Failed to update proposal status: ${error.message}`);
        throw error;
    }
}

async function returnProposalToNoDecision(proposalId) {
    try {
        console.log('[RETURN-TO-NO-DECISION] Returning proposal to no decision:', proposalId);
        
        // First confirm with the user
        const proposal = allProposals.find(p => p.uid === proposalId);
        const projectName = proposal ? proposal.project_name : 'this proposal';
        
        if (!confirm(`Are you sure you want to return "${projectName}" to No Decision Yet status?`)) {
            return;
        }
        
        // Update status using the existing function
        await updateProposalStatus(proposalId, 'No Decision Yet');
        
        console.log('[RETURN-TO-NO-DECISION] ✅ Successfully returned to no decision');
        
    } catch (error) {
        console.error('[RETURN-TO-NO-DECISION] ❌ Failed to return to no decision:', error);
        alert(`Failed to return proposal to No Decision: ${error.message}`);
    }
}

async function removeFromSchedule(proposalId, dayIndex) {
    try {
        const response = await fetchWithAuth(getApiUrl('/api/proposal-workbench/schedule/remove'), {
            method: 'POST',
            body: JSON.stringify({ proposalId, week: getWeekStartDate(currentWeekOffset).toISOString().split('T')[0] })
        });
        if (!response.ok) throw new Error('Failed to remove from schedule');
        await loadSchedule();
    } catch (error) {
        console.error('Error removing from schedule:', error);
    }
}

async function moveCustomTask(taskId, fromDay, toDay) {
    try {
        // Move task in database
        const newWeekStartDate = getWeekStartDate(currentWeekOffset).toISOString().split('T')[0];
        const response = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/schedule/tasks/${taskId}/move`), {
            method: 'PUT',
            body: JSON.stringify({
                newWeekStartDate: newWeekStartDate,
                newDayIndex: parseInt(toDay)
            })
        });
        if (!response.ok) throw new Error('Failed to move task');
        
        // Reload schedule to get updated data from database
        await loadSchedule();
    } catch (error) {
        console.error('Error moving task:', error);
        // Fallback to localStorage if database fails
        const task = customTasks[fromDay]?.find(t => t.id === taskId);
        if (!task) return;

        customTasks[fromDay] = customTasks[fromDay].filter(t => t.id !== taskId);
        if (customTasks[fromDay].length === 0) delete customTasks[fromDay];
        
        if (!customTasks[toDay]) customTasks[toDay] = [];
        customTasks[toDay].push(task);

        saveCustomTasks();
        renderSchedule();
    }
}


// --- Task Modal ---
function openTaskModal(taskId = null, dayIndex = null) {
    const modal = document.getElementById('taskModalOverlay');
    const form = document.getElementById('taskForm');
    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    const daySelect = document.getElementById('taskDay');
    const timeInput = document.getElementById('taskTime');
    const allDayCheck = document.getElementById('taskIsAllDay');
    const commentInput = document.getElementById('taskComment');
    const taskIdInput = document.getElementById('taskId');
    const taskIsEditInput = document.getElementById('taskIsEdit');
    const taskDayIndexInput = document.getElementById('taskDayIndex');
    
    // Reset form
    form.reset();
    
    // Set day index if provided
    if (dayIndex !== null) {
        daySelect.value = dayIndex;
        taskDayIndexInput.value = dayIndex;
    }
    
    // Set task ID if editing
    if (taskId) {
        const task = customTasks[dayIndex]?.find(t => t.id === taskId);
        if (task) {
            titleInput.value = task.title;
            descInput.value = task.description || '';
            timeInput.value = task.time || '';
            allDayCheck.checked = task.isAllDay || false;
            commentInput.value = task.comment || '';
            taskIdInput.value = taskId;
            taskIsEditInput.value = 'true';
        }
    } else {
        taskIdInput.value = '';
        taskIsEditInput.value = 'false';
    }
    
    modal.classList.remove('hidden');
}

function closeTaskModal() {
    taskModalOverlay.classList.add('hidden');
}

async function saveTask(event) {
    event.preventDefault();
    
    const id = taskIdInput.value;
    const isEdit = taskIsEditInput.value === 'true';
    const day = document.getElementById('taskDay').value;
    
    const taskData = {
        taskId: isEdit ? id : Date.now().toString(), // Generate new ID for new tasks
        weekStartDate: getWeekStartDate(currentWeekOffset).toISOString().split('T')[0],
        dayIndex: parseInt(day),
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        time: document.getElementById('taskTime')?.value || '',
        isAllDay: document.getElementById('taskIsAllDay')?.checked || false,
        comment: document.getElementById('taskComment')?.value || '',
        priority: document.getElementById('taskPriority')?.value || 'medium',
        category: document.getElementById('taskCategory')?.value || 'general',
    };

    try {
        if (isEdit) {
            // Update existing task in database
            const response = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/schedule/tasks/${id}`), {
                method: 'PUT',
                body: JSON.stringify(taskData)
            });
            if (!response.ok) throw new Error('Failed to update task');
        } else {
            // Add new task to database
            const response = await fetchWithAuth(getApiUrl('/api/proposal-workbench/schedule/tasks/add'), {
                method: 'POST',
                body: JSON.stringify(taskData)
            });
            if (!response.ok) throw new Error('Failed to add task');
        }
        
        // Reload schedule to get updated data from database
        await loadSchedule();
        closeTaskModal();
    } catch (error) {
        console.error('Error saving task:', error);
        // Fallback to localStorage if database fails
        const localTaskData = {
            id: taskData.taskId,
            type: 'custom',
            title: taskData.title,
            description: taskData.description,
            time: taskData.time,
            isAllDay: taskData.isAllDay,
            comment: taskData.comment,
        };

        if (isEdit) {
            const originalDay = taskDayIndexInput.value;
            if (customTasks[originalDay]) {
                customTasks[originalDay] = customTasks[originalDay].filter(t => t.id !== id);
                 if (customTasks[originalDay].length === 0) delete customTasks[originalDay];
            }
            
            // For editing, add to the new day
            if (!customTasks[day]) {
                customTasks[day] = [];
            }
            customTasks[day].push(localTaskData);
        } else {
            // For new tasks, simply add to the day
            if (!customTasks[day]) {
                customTasks[day] = [];
            }
            customTasks[day].push(localTaskData);
        }
        
        saveCustomTasks();
        renderSchedule();
        closeTaskModal();
    }
}

function saveCustomTasks() {
    localStorage.setItem('customTasks', JSON.stringify(customTasks));
}

function loadCustomTasks() {
    const savedTasks = localStorage.getItem('customTasks');
    if (savedTasks) {
        customTasks = JSON.parse(savedTasks);
    }
}

async function deleteTask(taskId, dayIndex) {
    try {
        // Delete from database
        const response = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/schedule/tasks/${taskId}`), {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete task');
        
        // Reload schedule to get updated data from database
        await loadSchedule();
    } catch (error) {
        console.error('Error deleting task:', error);
        // Fallback to localStorage if database fails
        if (customTasks[dayIndex]) {
            customTasks[dayIndex] = customTasks[dayIndex].filter(t => t.id !== taskId);
            if (customTasks[dayIndex].length === 0) {
                delete customTasks[dayIndex];
            }
            saveCustomTasks();
            renderSchedule();
        }
    }
}

async function duplicateTask(taskId, dayIndex) {
    try {
        // Calculate next day (with weekend consideration)
        let nextDayIndex = dayIndex + 1;
        
        // Handle weekend logic - if weekends are hidden and we're at Friday (5), skip to Monday (1)
        if (!includeWeekends) {
            if (nextDayIndex === 6) { // Saturday
                nextDayIndex = 1; // Monday of next week - we'll need to handle this specially
            } else if (nextDayIndex === 0) { // Sunday  
                nextDayIndex = 1; // Monday
            }
        }
        
        // If we go beyond Saturday (6), wrap to Sunday (0) or Monday (1) depending on weekend setting
        if (nextDayIndex > 6) {
            nextDayIndex = includeWeekends ? 0 : 1;
        }
        
        // Find the task to duplicate
        const originalTask = findTaskById(taskId);
        if (!originalTask) {
            console.error('Task not found for duplication:', taskId);
            return;
        }
        
        // Create a new task with the same properties but a new ID
        const duplicatedTask = {
            ...originalTask,
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
            name: `${originalTask.name} (Copy)`,
            title: `${originalTask.title || originalTask.name} (Copy)`
        };
        
        // Save to database for the next day
        const weekStartDate = getWeekStartDate(currentWeekOffset).toISOString().split('T')[0];
        const response = await fetchWithAuth(getApiUrl('/api/proposal-workbench/schedule/tasks/add'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: duplicatedTask.title || duplicatedTask.name,
                description: duplicatedTask.description || '',
                time: duplicatedTask.time || '',
                priority: duplicatedTask.priority || 'medium',
                category: duplicatedTask.category || 'general',
                comment: duplicatedTask.comment || '',
                weekStartDate: weekStartDate,
                dayIndex: nextDayIndex
            })
        });
        
        if (!response.ok) throw new Error('Failed to duplicate task');
        
        // Reload schedule to show the duplicated task
        await loadSchedule();
    } catch (error) {
        console.error('Error duplicating task:', error);
        // Fallback to localStorage if database fails
        const originalTask = findTaskById(taskId);
        if (originalTask) {
            // Calculate next day for fallback too
            let nextDayIndex = dayIndex + 1;
            
            if (!includeWeekends) {
                if (nextDayIndex === 6) { // Saturday
                    nextDayIndex = 1; // Monday
                } else if (nextDayIndex === 0) { // Sunday  
                    nextDayIndex = 1; // Monday
                }
            }
            
            if (nextDayIndex > 6) {
                nextDayIndex = includeWeekends ? 0 : 1;
            }
            
            const duplicatedTask = {
                ...originalTask,
                id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: `${originalTask.name} (Copy)`,
                title: `${originalTask.title || originalTask.name} (Copy)`
            };
            
            // Add to local storage for next day
            if (!customTasks[nextDayIndex]) {
                customTasks[nextDayIndex] = [];
            }
            customTasks[nextDayIndex].push(duplicatedTask);
            saveCustomTasks();
            renderSchedule();
        }
    }
}

async function duplicateProposalToNextDay(taskId, dayIndex) {
    try {
        // Calculate next day (with weekend consideration)
        let nextDayIndex = dayIndex + 1;
        
        // Handle weekend logic - if weekends are hidden and we're at Friday (5), skip to Monday (1)
        if (!includeWeekends) {
            if (nextDayIndex === 6) { // Saturday
                nextDayIndex = 1; // Monday of next week - we'll need to handle this specially
            } else if (nextDayIndex === 0) { // Sunday  
                nextDayIndex = 1; // Monday
            }
        }
        
        // If we go beyond Saturday (6), wrap to Sunday (0) or Monday (1) depending on weekend setting
        if (nextDayIndex > 6) {
            nextDayIndex = includeWeekends ? 0 : 1;
        }
        
        // Find the proposal task to duplicate
        let originalTask = null;
        if (scheduledTasks[dayIndex]) {
            originalTask = scheduledTasks[dayIndex].find(t => t.id === taskId);
        }
        
        if (!originalTask) {
            console.error('Proposal task not found for duplication:', taskId);
            return;
        }
        
        // Create a copy with the same proposal data but for the next day
        const duplicatedTask = {
            ...originalTask,
            id: `${originalTask.id}_copy_${Date.now()}`, // Create unique ID for the duplicate
            type: 'proposal'
        };
        
        // Add to next day in local data structure
        if (!scheduledTasks[nextDayIndex]) {
            scheduledTasks[nextDayIndex] = [];
        }
        scheduledTasks[nextDayIndex].push(duplicatedTask);
        
        // Save to database - add proposal to next day's schedule
        const weekStartDate = getWeekStartDate(currentWeekOffset).toISOString().split('T')[0];
        const response = await fetchWithAuth(getApiUrl('/api/proposal-workbench/schedule/proposals/add'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                proposalId: originalTask.uid || originalTask.id, // Use original proposal ID
                weekStartDate: weekStartDate,
                dayIndex: nextDayIndex
            })
        });
        
        if (!response.ok) throw new Error('Failed to duplicate proposal to next day');
        
        // Reload schedule to show the duplicated proposal
        await loadSchedule();
    } catch (error) {
        console.error('Error duplicating proposal to next day:', error);
        // If database fails, just reload to ensure consistency
        await loadSchedule();
    }
}

function findTaskById(taskId) {
    for (const day in customTasks) {
        const task = customTasks[day].find(t => t.id === taskId);
        if (task) return task;
    }
    return null;
}

function getApiUrl(endpoint) {
    const baseUrl = window.APP_CONFIG?.API_BASE_URL || '';
    return `${baseUrl}${endpoint}`;
}

// Function to generate the weekly schedule
function generateWeeklySchedule(startDate) {
    const scheduleHeaderRow = document.getElementById('scheduleHeaderRow');
    const scheduleBodyRow = document.getElementById('scheduleBodyRow');
    
    // Clear existing content
    scheduleHeaderRow.innerHTML = '';
    scheduleBodyRow.innerHTML = '';
    
    // Update the current week display
    document.getElementById('current-week-display').textContent = `Current Week (${formatDate(startDate)} - ${formatDate(addDays(startDate, 6))})`;
    
    // Create columns for each day of the week
    for (let i = 0; i < 7; i++) {
        const currentDate = addDays(startDate, i);
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = formatDate(currentDate);
        const isWeekend = [0, 6].includes(currentDate.getDay());
        const isToday = isSameDay(currentDate, new Date());
        
        // Create header
        const headerDiv = document.createElement('div');
        headerDiv.id = `day-header-${i}`;
        headerDiv.className = `schedule-header relative p-2 rounded-t-lg text-center font-semibold text-sm ${isWeekend ? 'weekend-day' : ''}`;
        
        // Create day name
        const dayNameDiv = document.createElement('div');
        dayNameDiv.className = 'day-name';
        dayNameDiv.textContent = dayName;
        
        // Create date
        const dateDiv = document.createElement('div');
        dateDiv.className = 'day-date text-xs font-normal';
        dateDiv.textContent = dateStr;
        
        // Add today indicator if applicable
        if (isToday) {
            const todayBadge = document.createElement('span');
            todayBadge.className = 'today-indicator absolute top-1 right-1 text-xs bg-blue-500 text-white px-1 rounded';
            todayBadge.textContent = 'Today';
            headerDiv.appendChild(todayBadge);
        }
        
        // Add header add button
        const addButton = document.createElement('button');
        addButton.className = 'add-day-item-btn';
        addButton.setAttribute('data-day-index', i);
        addButton.innerHTML = '<span class="material-icons">add</span>';
        addButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showDayActionMenu(i, addButton);
        });
        headerDiv.appendChild(addButton);

        headerDiv.appendChild(dayNameDiv);
        headerDiv.appendChild(dateDiv);
        scheduleHeaderRow.appendChild(headerDiv);
        
        // Create column body
        const columnDiv = document.createElement('div');
        columnDiv.id = `day-column-${i}`;
        columnDiv.className = 'day-column bg-white dark:bg-gray-700 p-2 min-h-[150px] rounded-b-lg relative';
        
        // Add a "+" button at the bottom of each column with improved visibility
        const addBottomButton = document.createElement('button');
        addBottomButton.className = 'add-day-item-bottom-btn';
        addBottomButton.style.zIndex = '20';
        addBottomButton.style.position = 'absolute';
        addBottomButton.style.bottom = '4px';
        addBottomButton.style.right = '4px';
        addBottomButton.style.width = '28px';
        addBottomButton.style.height = '28px';
        addBottomButton.style.backgroundColor = '#e5e7eb';
        addBottomButton.style.color = '#4b5563';
        addBottomButton.style.borderRadius = '50%';
        addBottomButton.style.display = 'flex';
        addBottomButton.style.alignItems = 'center';
        addBottomButton.style.justifyContent = 'center';
        addBottomButton.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        addBottomButton.innerHTML = '<span class="material-icons" style="font-size: 20px; line-height: 1;">add</span>';
        addBottomButton.setAttribute('data-day-index', i);
        addBottomButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showDayActionMenu(i, e.target.closest('button'));
        });
        
        columnDiv.appendChild(addBottomButton);
        scheduleBodyRow.appendChild(columnDiv);
    }
    
    // Load schedule data for the current week
    fetchWeeklySchedule(formatDateISO(startDate));
}

// --- No Decision Yet Modal Functions ---
function toggleNoDecisionModal() {
    const modal = document.getElementById('noDecisionModal');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        // Force re-render to ensure proposals are shown
        renderNoDecisionProposals();
    } else {
        modal.classList.add('hidden');
    }
}

function closeNoDecisionModal() {
    const modal = document.getElementById('noDecisionModal');
    modal.classList.add('hidden');
}

function renderNoDecisionProposals() {
    // This function will be called when the modal opens to ensure 
    // the "No Decision Yet" proposals are properly displayed
    let noDecisionProposals = allProposals.filter(p => 
        p.status === 'no_decision_yet' || p.status === 'pending'
    );
    
    // Apply filters to no decision proposals
    if (currentClientFilter !== 'All Clients') {
        noDecisionProposals = noDecisionProposals.filter(p => p.client_name === currentClientFilter);
    }
    if (accountManagerFilter !== 'All Account Managers') {
        noDecisionProposals = noDecisionProposals.filter(p => p.account_manager === accountManagerFilter);
    }
    if (solutionFilter !== 'All Solutions' && solutionFilter !== '') {
        noDecisionProposals = noDecisionProposals.filter(p => {
            if (!p.solutions) return false;
            return p.solutions === solutionFilter || 
                   p.solutions.toLowerCase() === solutionFilter.toLowerCase() ||
                   p.solutions.trim() === solutionFilter.trim();
        });
    }
    
    const noDecisionBody = document.getElementById('noDecisionBody');
    noDecisionBody.innerHTML = '';
    
    noDecisionProposals.forEach(proposal => {
        const card = createProposalCard(proposal);
        noDecisionBody.appendChild(card);
    });
    
    // Update the count in the toggle button too
    const count = noDecisionProposals.length;
    const noDecisionCount = document.getElementById('noDecisionCount');
    if (noDecisionCount) {
        noDecisionCount.textContent = count;
    }
}

function makeModalDraggable() {
    const modal = document.getElementById('noDecisionModalContent');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    modal.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.closest('#closeNoDecisionBtn') || e.target.closest('#noDecisionBody')) {
            return; // Don't drag if clicking close button or proposal cards
        }
        
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        
        if (e.target === modal || e.target.closest('.flex.justify-between.items-center')) {
            isDragging = true;
            modal.style.cursor = 'grabbing';
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            
            modal.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    }

    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        modal.style.cursor = 'move';
    }
}

// --- View Toggle Functions ---
let currentView = 'proposal'; // Track current view

function switchView(view) {
    const proposalView = document.getElementById('proposalView');
    const scheduleView = document.getElementById('scheduleView');
    const filterSection = document.getElementById('filterSection');
    const proposalViewBtn = document.getElementById('proposalViewBtn');
    const scheduleViewBtn = document.getElementById('scheduleViewBtn');
    const pageTitle = document.getElementById('pageTitle');

    if (view === 'proposal') {
        // Show proposal view
        if (proposalView) proposalView.classList.remove('hidden');
        if (scheduleView) scheduleView.classList.add('hidden');
        if (filterSection) filterSection.classList.remove('hidden');
        
        // Update button styles
        if (proposalViewBtn) proposalViewBtn.className = 'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 bg-indigo-600 text-white shadow-sm';
        if (scheduleViewBtn) scheduleViewBtn.className = 'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700';
        
        // Update title
        if (pageTitle) pageTitle.textContent = 'Proposal Workbench';
        
        // Ensure proposals are rendered
        renderProposals(proposals);
    } else if (view === 'schedule') {
        // Show schedule view
        if (proposalView) proposalView.classList.add('hidden');
        if (scheduleView) scheduleView.classList.remove('hidden');
        if (filterSection) filterSection.classList.add('hidden');
        
        // Update button styles
        if (scheduleViewBtn) scheduleViewBtn.className = 'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 bg-indigo-600 text-white shadow-sm';
        if (proposalViewBtn) proposalViewBtn.className = 'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700';
        
        // Update title
        if (pageTitle) pageTitle.textContent = 'Weekly Schedule';
        
        // Create schedule filter section if it doesn't exist
        createScheduleFilterSection();
        
        // Reinitialize schedule view
        createWeeklyScheduleDOM();
        loadSchedule();
        // Drag setup will be handled by renderSchedule()
    }
}

// --- Proposal Selection Modal Functions ---
function openProposalSelectionModal(dayIndex) {
    const modal = document.getElementById('proposalSelectionModal');
    if (!modal) {
        console.error('Proposal selection modal not found');
        return;
    }
    
    // Store the day index for later use
    modal.setAttribute('data-day-index', dayIndex);
    
    // Reset filters
    const searchInput = document.getElementById('proposalSearchInput');
    const statusFilter = document.getElementById('proposalStatusFilter');
    const modalPicFilter = document.getElementById('proposalPicFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = '';
    if (modalPicFilter) modalPicFilter.value = '';
    
    // Populate the PIC filter in the modal (same as the main PIC filter)
    if (modalPicFilter && picFilterSelect) {
        modalPicFilter.innerHTML = picFilterSelect.innerHTML;
    }
    
    // Reset filtered proposals to show all
    filteredProposalsForSchedule = [];
    
    // Render the full proposal list
    renderProposalSelectionList();
    
    // Show the modal
    modal.classList.remove('hidden');
}

function closeProposalSelectionModal() {
    const modal = document.getElementById('proposalSelectionModal');
    modal.classList.add('hidden');
}

function filterProposalSelection() {
    const searchTerm = document.getElementById('proposalSearchInput').value.toLowerCase();
    const statusFilter = document.getElementById('proposalStatusFilter').value;
    const picFilter = document.getElementById('proposalPicFilter')?.value || '';
    
    filteredProposalsForSchedule = allProposals.filter(proposal => {
        // Enhanced search that checks multiple fields
        const matchesSearch = searchTerm === '' || 
                              (proposal.project_name && proposal.project_name.toLowerCase().includes(searchTerm)) || 
                              (proposal.client_name && proposal.client_name.toLowerCase().includes(searchTerm)) ||
                              (proposal.pic && proposal.pic.toLowerCase().includes(searchTerm)) ||
                              (proposal.account_manager && proposal.account_manager.toLowerCase().includes(searchTerm)) ||
                              (proposal.uid && proposal.uid.toString().toLowerCase().includes(searchTerm));
                              
        const matchesStatus = !statusFilter || proposal.status === statusFilter;
        const matchesPic = !picFilter || (proposal.pic && proposal.pic === picFilter);
        
        return matchesSearch && matchesStatus && matchesPic;
    });
    
    renderProposalSelectionList();
}

function renderProposalSelectionList() {
    const listContainer = document.getElementById('proposalList');
    if (!listContainer) {
        console.error('Proposal list container not found');
        return;
    }
    
    listContainer.innerHTML = '';
    
    // Get current filter values
    const searchTerm = document.getElementById('proposalSearchInput')?.value || '';
    const statusFilter = document.getElementById('proposalStatusFilter')?.value || '';
    const picFilter = document.getElementById('proposalPicFilter')?.value || '';
    
    // Use filtered proposals if any filters are applied, otherwise show all
    const proposalsToShow = searchTerm || statusFilter || picFilter 
                           ? filteredProposalsForSchedule 
                           : allProposals;
    
    if (proposalsToShow.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-8">No proposals found</p>';
        return;
    }
    
    proposalsToShow.forEach(proposal => {
        const proposalItem = document.createElement('div');
        proposalItem.className = 'proposal-selection-item flex justify-between items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors mb-2';
        
        const statusColors = {
            'not_yet_started': 'bg-gray-100 text-gray-800',
            'ongoing': 'bg-blue-100 text-blue-800',
            'for_revision': 'bg-orange-100 text-orange-800',
            'for_approval': 'bg-yellow-100 text-yellow-800',
            'submitted': 'bg-green-100 text-green-800'
        };
        
        const statusLabels = {
            'not_yet_started': 'Not Started',
            'ongoing': 'Ongoing',
            'for_revision': 'For Revision',
            'for_approval': 'For Approval',
            'submitted': 'Submitted'
        };
        
        proposalItem.innerHTML = `
            <div class="flex-1">
                <h4 class="font-semibold text-gray-900 dark:text-white">${proposal.project_name}</h4>
                <p class="text-sm text-gray-600 dark:text-gray-400">${proposal.client_name}</p>
                <div class="flex items-center mt-2">
                    <span class="inline-block px-2 py-1 text-xs font-medium rounded-full ${statusColors[proposal.status] || 'bg-gray-100 text-gray-800'}">
                        ${statusLabels[proposal.status] || proposal.status}
                    </span>
                    <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">${formatCurrency(proposal.final_amount)}</span>
                </div>
            </div>
            <button class="add-to-schedule-btn px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors" data-proposal-id="${proposal.uid}" data-proposal-name="${proposal.project_name}">
                Add to Schedule
            </button>
        `;
        
        // Add click handler for the add button
        const addBtn = proposalItem.querySelector('.add-to-schedule-btn');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectProposalForScheduling(proposal.uid, proposal.project_name);
        });
        
        listContainer.appendChild(proposalItem);
    });
}

function selectProposalForScheduling(proposalId, proposalName) {
    const modal = document.getElementById('proposalSelectionModal');
    const dayIndex = modal.getAttribute('data-day-index');
    
    if (dayIndex !== null) {
        addToSchedule(proposalId, proposalName, parseInt(dayIndex));
        closeProposalSelectionModal();
    } else {
        showScheduleInstruction();
    }
}

function showScheduleInstruction() {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="material-icons mr-2">info</i>
            <span>Click on any day in the schedule below to add "${selectedProposalForScheduling.name}"</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
    
    // Add visual cue to schedule cells
    const scheduleCells = document.querySelectorAll('.day-column');
    scheduleCells.forEach(cell => {
        cell.classList.add('schedule-ready');
        cell.style.cursor = 'pointer';
        cell.style.borderColor = '#4F46E5';
        cell.style.borderWidth = '2px';
        cell.style.borderStyle = 'dashed';
    });
}

// Global variable to track selected proposal for scheduling
let selectedProposalForScheduling = null;

// --- Day Action Menu Functions ---
function showDayActionMenu(dayIndex, targetElement) {
    currentDayIndex = dayIndex;
    const menu = document.getElementById('dayActionMenu');
    
    // Position the menu near the clicked button
    const rect = targetElement.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.top}px`;
    menu.style.left = `${rect.right + 5}px`;
    menu.classList.remove('hidden');
    
    // Ensure the menu is visible within viewport
    setTimeout(() => {
        const menuRect = menu.getBoundingClientRect();
        
        // If menu would go off the right edge, position it to the left of the button
        if (menuRect.right > window.innerWidth) {
            menu.style.left = `${rect.left - menuRect.width - 5}px`;
        }
        
        // If menu would go off the bottom edge, adjust its top position
        if (menuRect.bottom > window.innerHeight) {
            menu.style.top = `${rect.top - (menuRect.bottom - window.innerHeight) - 5}px`;
        }
        
        // If menu would go off the top edge, position it below the button
        if (menuRect.top < 0) {
            menu.style.top = `${rect.bottom + 5}px`;
        }
    }, 0);
}

function showProposalLoadError() {
    const proposalView = document.getElementById('proposalView');
    if (proposalView) {
        proposalView.innerHTML = `
            <div class="text-center text-red-500 py-8">
                <h3 class="text-lg font-bold mb-2">Failed to Load Proposals</h3>
                <p class="mb-4">You don't have permission to access proposals or there was a connection error.</p>
                <button onclick="location.reload()" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Retry</button>
            </div>
        `;
    }
}

function showScheduleLoadError() {
    const scheduleView = document.getElementById('scheduleView');
    if (scheduleView) {
        scheduleView.innerHTML = `
            <div class="text-center text-red-500 py-8">
                <h3 class="text-lg font-bold mb-2">Failed to Load Schedule</h3>
                <p class="mb-4">You don't have permission to access the schedule or there was a connection error.</p>
                <button onclick="location.reload()" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Retry</button>
            </div>
        `;
    }
}

function showPartialLoadNotification() {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300';
    notification.innerHTML = `
        <div class="flex items-center">
            <span class="material-icons mr-2">warning</span>
            <span>Some features may not be available due to permission restrictions.</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <span class="material-icons">close</span>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

function showPicFilterNotification(userName) {
    // Create a temporary notification to inform the user about auto-filtering
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-100 dark:bg-blue-900 border border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200 px-4 py-3 rounded-lg shadow-lg z-[250] max-w-sm';
    notification.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <span class="material-icons text-blue-600 dark:text-blue-400" style="font-size: 20px;">info</span>
            </div>
            <div class="ml-3">
                <p class="text-sm font-medium">Filtered by your PIC</p>
                <p class="text-xs mt-1">Showing only proposals where you're the PIC. Change the "PIC/BOM" filter to "All PICs" to see all proposals.</p>
                <button class="dismiss-notification-btn text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 mt-1 underline">Dismiss</button>
            </div>
        </div>
    `;
    
    // Add event listener for dismiss button
    const dismissBtn = notification.querySelector('.dismiss-notification-btn');
    dismissBtn.addEventListener('click', () => {
        notification.remove();
    });
    
    document.body.appendChild(notification);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 8000);
}

// --- Proposal Edit Modal ---
function openProposalEditModal(proposalId) {
    const proposal = allProposals.find(p => p.uid === proposalId);
    if (!proposal) return;

    // Basic Information
    document.getElementById('editProposalId').value = proposal.uid;
    document.getElementById('editProposalName').value = proposal.project_name || '';
    document.getElementById('editClient').value = proposal.client || '';
    document.getElementById('editRevision').value = proposal.revision_number !== undefined && proposal.revision_number !== null ? proposal.revision_number : (proposal.rev || '');
    document.getElementById('editSolution').value = proposal.solution || '';
    document.getElementById('editIndustry').value = proposal.industry || '';
    
    // Assignment Information
    document.getElementById('editPic').value = proposal.pic || '';
    document.getElementById('editBom').value = proposal.bom || '';
    document.getElementById('editAccountManager').value = proposal.account_manager || '';
    document.getElementById('editStatus').value = proposal.status || 'not_yet_started';
    
    // Financial Information  
    document.getElementById('editMargin').value = proposal.margin || '';
    document.getElementById('editFinalAmount').value = proposal.final_amount ? formatNumberWithCommas(proposal.final_amount) : '';
    document.getElementById('editOpportunityStatus').value = proposal.opp_status || '';
    
    // Dates
    document.getElementById('editSubmissionDate').value = proposal.submission_date ? proposal.submission_date.split('T')[0] : '';
    document.getElementById('editDateAwarded').value = proposal.date_awarded ? formatDate(proposal.date_awarded) : '';
    document.getElementById('editForecastDate').value = proposal.forecast_date ? formatDate(proposal.forecast_date) : '';
    document.getElementById('editDecision').value = proposal.decision || '';
    
    // Comments and Notes
    document.getElementById('editComment').value = proposal.comment || '';
    document.getElementById('editRemarks').value = proposal.remarks || '';
    
    proposalEditModal.classList.remove('hidden');
}

function closeProposalEditModal() {
    proposalEditModal.classList.add('hidden');
}

function openProposalEditModalForSubmission(proposalId) {
    openProposalEditModal(proposalId);
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('editSubmissionDate').value = today;
    
    const submissionField = document.getElementById('editSubmissionDate');
    if (submissionField) {
        submissionField.style.animation = 'pulse 2s';
        submissionField.style.borderColor = '#10b981';
        submissionField.style.borderWidth = '3px';
        
        setTimeout(() => {
            submissionField.style.animation = '';
            submissionField.style.borderColor = '#3b82f6';
            submissionField.style.borderWidth = '2px';
        }, 2000);
    }
    
    setTimeout(() => {
        submissionField?.focus();
        submissionField?.select();
    }, 100);
}

async function handleProposalEditSubmit(event) {
    event.preventDefault();
    const proposalId = document.getElementById('editProposalId').value;
    
    // Get original proposal data for fallback values
    const originalProposal = allProposals.find(p => p.uid === proposalId);
    
    // Parse form values with original values as fallbacks
    const revisionField = document.getElementById('editRevision');
    const finalAmountField = document.getElementById('editFinalAmount');
    const marginField = document.getElementById('editMargin');
    
    const revisionValue = revisionField ? revisionField.value : '';
    const finalAmountValue = finalAmountField ? finalAmountField.value : '';
    const marginValue = marginField ? marginField.value : '';
    
    // Debug logging - RAW form values
    console.log('[FORM_SAVE] RAW form values:', {
        revisionElement: revisionField,
        finalAmountElement: finalAmountField,
        marginElement: marginField,
        revisionValue: `"${revisionValue}"`,
        finalAmountValue: `"${finalAmountValue}"`,
        marginValue: `"${marginValue}"`,
        originalProposal: originalProposal
    });
    
    // Process the values with better validation
    let processedRevision;
    if (revisionValue && revisionValue.trim()) {
        const parsedRevision = parseInt(revisionValue.trim());
        processedRevision = !isNaN(parsedRevision) && parsedRevision >= 0 ? parsedRevision : (originalProposal?.revision_number || originalProposal?.rev || 1);
    } else {
        processedRevision = originalProposal?.revision_number || originalProposal?.rev || 1;
    }
    
    const cleanedFinalAmount = removeCommas(finalAmountValue);
    let processedFinalAmount;
    if (finalAmountValue && finalAmountValue.trim()) {
        const parsedAmount = parseFloat(cleanedFinalAmount);
        processedFinalAmount = !isNaN(parsedAmount) && parsedAmount >= 0 ? parsedAmount : (originalProposal?.final_amount || 0);
    } else {
        processedFinalAmount = originalProposal?.final_amount || 0;
    }
    
    let processedMargin;
    if (marginValue && marginValue.trim()) {
        const parsedMargin = parseFloat(marginValue.trim());
        processedMargin = !isNaN(parsedMargin) && parsedMargin >= 0 ? parsedMargin : (originalProposal?.margin || 0);
    } else {
        processedMargin = originalProposal?.margin || 0;
    }
    
    console.log('[FORM_SAVE] Processing:', {
        cleanedFinalAmount: `"${cleanedFinalAmount}"`,
        processedRevision: processedRevision,
        processedFinalAmount: processedFinalAmount,
        processedMargin: processedMargin,
        revisionIsValid: !isNaN(processedRevision) && processedRevision >= 0,
        finalAmountIsValid: !isNaN(processedFinalAmount) && processedFinalAmount >= 0,
        marginIsValid: !isNaN(processedMargin) && processedMargin >= 0
    });
    
    const updates = {
        comment: document.getElementById('editComment').value,
        status: document.getElementById('editStatus').value,
        revision_number: processedRevision,
        final_amount: processedFinalAmount,
        margin: processedMargin,
        opp_status: document.getElementById('editOpportunityStatus').value,
        submission_date: document.getElementById('editSubmissionDate').value
    };
    
    try {
        const commentResponse = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/proposals/${proposalId}/comment`), {
            method: 'PUT',
            body: JSON.stringify({ comment: updates.comment })
        });

        if (!commentResponse.ok) throw new Error('Failed to save comment');
        
        const originalProposal = allProposals.find(p => p.uid === proposalId);
        if (originalProposal && originalProposal.status !== updates.status) {
            await updateProposalStatus(proposalId, updates.status);
        }
        
        const fieldsPayload = {
            revision_number: updates.revision_number,
            final_amount: updates.final_amount,
            margin: updates.margin,
            opp_status: updates.opp_status,
            submission_date: updates.submission_date
        };
        
        console.log('[FORM_SAVE] Sending fields update:', fieldsPayload);
        
        const fieldsResponse = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/proposals/${proposalId}/fields`), {
            method: 'PUT',
            body: JSON.stringify(fieldsPayload)
        });

        if (!fieldsResponse.ok) {
            const errorText = await fieldsResponse.text();
            console.error('Failed to save fields:', errorText);
            console.error('Fields payload that failed:', fieldsPayload);
            alert(`Comment and status were saved, but failed to update other fields (revision: ${updates.revision_number}, final amount: ${updates.final_amount}). Error: ${errorText}`);
        } else {
            const responseData = await fieldsResponse.json();
            console.log('All fields updated successfully:', responseData);
        }
        
        const proposal = allProposals.find(p => p.uid === proposalId);
        if (proposal) {
            proposal.comment = updates.comment;
            proposal.status = updates.status;
            proposal.revision_number = updates.revision_number;
            proposal.final_amount = updates.final_amount;
            proposal.margin = updates.margin;
            proposal.opp_status = updates.opp_status;
            proposal.submission_date = updates.submission_date;
        }
        
        renderProposals();
        renderNoDecisionProposals();
        renderSchedule();
        closeProposalEditModal();

    } catch (error) {
        console.error('Error saving proposal changes:', error);
        alert('Failed to save changes. Please try again.');
    }
}

async function handleSyncFromDrive(event) {
    event.preventDefault();
    
    const proposalId = document.getElementById('editProposalId').value;
    if (!proposalId) {
        alert('No proposal selected for sync');
        return;
    }
    
    // Show loading state
    const syncBtn = document.getElementById('syncFromDriveBtn');
    const originalText = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<span class="material-icons text-sm mr-2 animate-spin">sync</span>Syncing...';
    
    try {
        console.log(`[SYNC] Starting sync for proposal: ${proposalId}`);
        
        // Call the sync API endpoint
        const response = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/sync-from-drive/${proposalId}`), {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Sync failed');
        }
        
        if (result.success) {
            console.log('[SYNC] Successfully synced proposal data:', result.syncedData);
            
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
        const revisionField = document.getElementById('editRevision');
        if (revisionField) {
            revisionField.value = syncedData.revisionNumber;
            highlightUpdatedField(revisionField);
        }
    }
    
    if (syncedData.margin !== undefined) {
        const marginField = document.getElementById('editMargin');
        if (marginField) {
            marginField.value = formatNumberWithCommas(syncedData.margin);
            highlightUpdatedField(marginField);
        }
    }
    
    if (syncedData.finalAmount !== undefined) {
        const finalAmountField = document.getElementById('editFinalAmount');
        if (finalAmountField) {
            finalAmountField.value = formatNumberWithCommas(syncedData.finalAmount);
            highlightUpdatedField(finalAmountField);
        }
    }
    
    if (syncedData.submittedDate) {
        const submissionField = document.getElementById('editSubmissionDate');
        if (submissionField) {
            // Convert ISO date to YYYY-MM-DD format for date input
            const date = new Date(syncedData.submittedDate);
            submissionField.value = date.toISOString().split('T')[0];
            highlightUpdatedField(submissionField);
        }
    }
}

function highlightUpdatedField(field) {
    // Add visual feedback for updated fields
    const originalBorderColor = field.style.borderColor;
    const originalBorderWidth = field.style.borderWidth;
    
    field.style.borderColor = '#10b981'; // Green color
    field.style.borderWidth = '2px';
    field.style.animation = 'pulse 1s';
    
    setTimeout(() => {
        field.style.borderColor = originalBorderColor;
        field.style.borderWidth = originalBorderWidth;
        field.style.animation = '';
    }, 2000);
}

function showSyncSuccessMessage(syncedData) {
    const message = `Successfully synced from Excel file!
    
Updated fields:
${syncedData.revisionNumber !== undefined ? `• Revision: ${syncedData.revisionNumber}` : ''}
${syncedData.margin !== undefined ? `• Margin: ${formatNumberWithCommas(syncedData.margin)}%` : ''}
${syncedData.finalAmount !== undefined ? `• Final Amount: ${formatCurrency(syncedData.finalAmount)}` : ''}
${syncedData.submittedDate ? `• Submitted Date: ${new Date(syncedData.submittedDate).toLocaleDateString()}` : ''}
${syncedData.excelFileName ? `• Source: ${syncedData.excelFileName}` : ''}`;
    
    alert(message);
}

function showSyncErrorMessage(errorMessage) {
    let userFriendlyMessage = 'Failed to sync proposal data from Google Drive.';
    
    if (errorMessage.includes('Calcsheet folder not found')) {
        userFriendlyMessage = 'No "Calcsheet" folder found in the linked Google Drive folder.';
    } else if (errorMessage.includes('No Excel files found')) {
        userFriendlyMessage = 'No Excel files found in the Calcsheet folder.';
    } else if (errorMessage.includes('No Google Drive folder linked')) {
        userFriendlyMessage = 'This proposal is not linked to a Google Drive folder.';
    } else if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
        userFriendlyMessage = 'Failed to open Excel file. Please check if the file is properly encrypted with the expected password.';
    } else if (errorMessage.includes('Summary sheet not found')) {
        userFriendlyMessage = 'Excel file does not contain a "Summary" sheet.';
    }
    
    alert(`${userFriendlyMessage}

Error: ${errorMessage}`);
}

async function addToSchedule(proposalId, proposalName, dayIndex) {
    try {
        const response = await fetchWithAuth(getApiUrl('/api/proposal-workbench/schedule/add'), {
            method: 'POST',
            body: JSON.stringify({ proposalId, proposalName, dayIndex, week: getWeekStartDate(currentWeekOffset).toISOString().split('T')[0] })
        });
        if (!response.ok) throw new Error('Failed to add to schedule');
        await loadSchedule();
    } catch (error) {
        console.error('Error adding to schedule:', error);
    }
}

// --- Schedule Management ---
function renderSchedule() {
    // Clear existing tasks and messages
    document.querySelectorAll('.schedule-task').forEach(task => task.remove());
    document.querySelectorAll('.empty-schedule-message').forEach(msg => msg.remove());
    document.querySelectorAll('.schedule-day-summary').forEach(summary => summary.remove());

    const renderTask = (task, dayIndex) => {
        const cell = document.getElementById(`day-cell-${dayIndex}`);
        if (cell) {
            const taskElement = createScheduleTask(task, dayIndex);
            cell.appendChild(taskElement);
        }
    };
    
    // Enhanced schedule data tracking
    let totalTasks = 0;
    const dailyStats = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Initialize daily stats
    for (let i = 0; i < 7; i++) {
        dailyStats[i] = {
            proposalTasks: 0,
            customTasks: 0,
            totalTasks: 0,
            priorities: { high: 0, medium: 0, low: 0 },
            categories: {}
        };
    }
    
    // Process scheduled proposal tasks
    if(scheduledTasks) {
        for (const dayIndex in scheduledTasks) {
            scheduledTasks[dayIndex].forEach(task => {
                renderTask({ ...task, type: 'proposal' }, dayIndex);
                totalTasks++;
                dailyStats[dayIndex].proposalTasks++;
                dailyStats[dayIndex].totalTasks++;
            });
        }
    }
    
    // Process custom tasks with enhanced categorization
    if(customTasks) {
        for (const dayIndex in customTasks) {
            const dayIndexInt = parseInt(dayIndex);
            customTasks[dayIndex].forEach(task => {
                renderTask({ ...task, type: 'custom' }, dayIndex);
                totalTasks++;
                if (dailyStats[dayIndexInt]) {
                    dailyStats[dayIndexInt].customTasks++;
                    dailyStats[dayIndexInt].totalTasks++;
                    
                    // Track priorities
                    const priority = task.priority || 'medium';
                    if (dailyStats[dayIndexInt].priorities[priority] !== undefined) {
                        dailyStats[dayIndexInt].priorities[priority]++;
                    }
                    
                    // Track categories
                    const category = task.category || 'general';
                    if (!dailyStats[dayIndexInt].categories[category]) {
                        dailyStats[dayIndexInt].categories[category] = 0;
                    }
                    dailyStats[dayIndexInt].categories[category]++;
                }
            });
        }
    }
    
    // Add enhanced day summaries
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        addDaySummary(dayIndex, dailyStats[dayIndex]);
    }
    
    // Show week overview statistics
    updateWeekOverview(dailyStats, totalTasks);
    
    if (totalTasks === 0 && currentScheduleUserFilter === 'current') {
        showEmptyScheduleMessage();
    }
    
    // Reset and setup drag and drop for schedule tasks after rendering
    // Since DOM elements have changed, we need to reinitialize
    resetDragSetup();
    setTimeout(() => setupScheduleDragAndDrop(), 100);
}

function showEmptyScheduleMessage() {
    const firstDayCell = document.getElementById('day-cell-1');
    if (firstDayCell) {
        const messageEl = document.createElement('div');
        messageEl.className = 'empty-schedule-message text-center p-4 text-gray-500 dark:text-gray-400 italic';
        messageEl.innerHTML = `
            <div class="mb-2">
                <span class="material-icons text-2xl opacity-50">event_note</span>
            </div>
            <p class="text-sm">No tasks scheduled for this week.</p>
            <p class="text-xs mt-1">Click the + button to add tasks or proposals.</p>
        `;
        firstDayCell.appendChild(messageEl);
    }
}

function createScheduleTask(task, dayIndex) {
    const taskEl = document.createElement('div');
    taskEl.className = 'schedule-task p-2 mb-1 rounded-md text-xs relative cursor-grab group';
    taskEl.draggable = true;
    taskEl.dataset.taskId = task.id;
    taskEl.dataset.dayIndex = dayIndex;

    const isProposal = task.type === 'proposal';
    taskEl.classList.add(isProposal ? 'proposal-task' : 'general-task');
    
    // Add priority-based styling for custom tasks
    if (!isProposal && task.priority) {
        taskEl.classList.add(`priority-${task.priority}`);
    }

    const commentHTML = task.comment ? `<p class="task-comment italic opacity-80 mt-1 pt-1 border-t border-dashed border-white/20">"${task.comment}"</p>` : '';
    
    // Enhanced task metadata for custom tasks
    const metaElements = [];
    if (!isProposal) {
        if (task.time) {
            metaElements.push(`<span class="task-time" title="Scheduled time">${task.time}</span>`);
        }
        if (task.priority) {
            const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
            metaElements.push(`<span class="task-priority" title="${task.priority} priority">${priorityIcon}</span>`);
        }
        if (task.category && task.category !== 'general') {
            const categoryIcons = {
                'meeting': '🤝',
                'deadline': '⏰',
                'review': '👀',
                'planning': '📋',
                'followup': '📞'
            };
            const icon = categoryIcons[task.category] || '📌';
            metaElements.push(`<span class="task-category" title="${task.category}">${icon}</span>`);
        }
    }
    
    const metaHTML = metaElements.length > 0 ? `<div class="task-meta flex items-center gap-1 mt-1">${metaElements.join('')}</div>` : '';

    // Add description for custom tasks
    const descriptionHTML = (!isProposal && task.description) ? 
        `<div class="task-description text-gray-600 dark:text-gray-400 mt-1 text-xs opacity-90">${task.description}</div>` : '';
    
    // Get historical status for proposals
    let displayStatus = '';
    let statusColor = 'text-gray-500';
    if (isProposal) {
        // Use historical status if available, otherwise current status
        displayStatus = task.historical_status || task.status || task.current_status || 'unknown';
        const statusLabels = {
            'not_yet_started': 'Not Started',
            'not_started': 'Not Started', 
            'ongoing': 'On-Going',
            'for_approval': 'For Approval',
            'for_revision': 'For Revision',
            'submitted': 'Submitted',
            'declined': 'Declined',
            'pending': 'Pending',
            'no_decision_yet': 'No Decision',
            'inactive': 'Inactive',
            'lost': 'Lost'
        };
        
        // Status colors
        const statusColors = {
            'ongoing': 'text-blue-600',
            'submitted': 'text-green-600',
            'for_approval': 'text-yellow-600',
            'for_revision': 'text-orange-600',
            'declined': 'text-red-600',
            'lost': 'text-red-600'
        };
        
        displayStatus = statusLabels[displayStatus] || displayStatus;
        statusColor = statusColors[displayStatus] || 'text-gray-500';
    }

    // Add type badge  
    const typeBadge = isProposal ? 
        '<span class="task-type-badge absolute -top-1 -right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold shadow-sm" title="Proposal Task">P</span>' :
        '<span class="task-type-badge absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold shadow-sm" title="Custom Task">C</span>';
    
    // Check if task is completed (will be loaded from database)
    const isCompleted = task.is_completed || false;
    
    taskEl.innerHTML = `
        ${typeBadge}
        <div class="flex items-start gap-2">
            <input type="checkbox" 
                   class="task-completion-checkbox mt-1 flex-shrink-0" 
                   data-task-id="${task.id}" 
                   data-task-type="${isProposal ? 'proposal' : 'custom'}"
                   data-day-index="${dayIndex}"
                   ${isCompleted ? 'checked' : ''}
                   title="Mark as completed">
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0">
                        <span class="font-bold ${isCompleted ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}">${task.name || task.title}</span>
                        ${isProposal ? `<div class="text-gray-600 dark:text-gray-400 text-xs truncate">${task.client || ''}</div>` : ''}
                        ${isProposal ? `<div class="text-gray-700 dark:text-gray-300 text-xs font-medium">${formatCurrency(task.final_amt || task.final_amount || 0)}</div>` : ''}
                        ${isProposal ? `<div class="text-xs ${statusColor} dark:text-gray-400">Status: ${displayStatus}</div>` : ''}
                        ${descriptionHTML}
                        ${metaHTML}
                    </div>
                    <div class="task-actions opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-2 flex-shrink-0">
                         ${!isProposal ? `<button class="task-action-btn edit-task-btn material-icons text-xs" data-task-id="${task.id}" data-day-index="${dayIndex}">edit</button>` : ''}
                         ${!isProposal ? `<button class="task-action-btn duplicate-task-btn material-icons text-xs" data-task-id="${task.id}" data-day-index="${dayIndex}" title="Duplicate to next day">content_copy</button>` : ''}
                         ${isProposal ? `<button class="task-action-btn duplicate-proposal-btn material-icons text-xs" data-task-id="${task.id}" data-day-index="${dayIndex}" title="Duplicate to next day">next_plan</button>` : ''}
                         <button class="task-action-btn remove-task-btn material-icons text-xs" data-task-id="${task.id}" data-is-proposal="${isProposal}">close</button>
                    </div>
                </div>
                ${commentHTML}
            </div>
        </div>
    `;

    taskEl.addEventListener('dragstart', (e) => {
        console.log('[DRAG] Starting drag for:', isProposal ? 'proposal' : 'task', task.id);
        draggedItem = { type: isProposal ? 'proposal' : 'task', id: task.id, dayIndex: dayIndex, element: taskEl };
        e.dataTransfer.setData('text/plain', task.id);
        setTimeout(() => taskEl.classList.add('opacity-50'), 0);
    });

    taskEl.addEventListener('dragend', () => {
        draggedItem = null;
        taskEl.classList.remove('opacity-50');
    });

    // Add completion checkbox event listener
    const completionCheckbox = taskEl.querySelector('.task-completion-checkbox');
    if (completionCheckbox) {
        completionCheckbox.addEventListener('change', async (e) => {
            e.stopPropagation(); // Prevent triggering drag or other events
            const taskId = e.target.dataset.taskId;
            const taskType = e.target.dataset.taskType;
            const dayIndex = parseInt(e.target.dataset.dayIndex);
            const isCompleted = e.target.checked;
            
            try {
                await toggleTaskCompletion(taskId, taskType, dayIndex, isCompleted);
                
                // Update visual styling
                const taskTitle = taskEl.querySelector('.font-bold');
                if (taskTitle) {
                    if (isCompleted) {
                        taskTitle.classList.add('line-through', 'text-gray-500', 'dark:text-gray-400');
                        taskTitle.classList.remove('text-gray-900', 'dark:text-white');
                    } else {
                        taskTitle.classList.remove('line-through', 'text-gray-500', 'dark:text-gray-400');
                        taskTitle.classList.add('text-gray-900', 'dark:text-white');
                    }
                }
                
            } catch (error) {
                console.error('Error toggling task completion:', error);
                // Revert checkbox state on error
                e.target.checked = !isCompleted;
                alert('Failed to update task completion. Please try again.');
            }
        });
    }
    
    const editBtn = taskEl.querySelector('.edit-task-btn');
    if(editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTaskModal(task.id, dayIndex);
        });
    }

    const duplicateBtn = taskEl.querySelector('.duplicate-task-btn');
    if(duplicateBtn) {
        duplicateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            duplicateTask(task.id, dayIndex);
        });
    }

    const duplicateProposalBtn = taskEl.querySelector('.duplicate-proposal-btn');
    if(duplicateProposalBtn) {
        duplicateProposalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            duplicateProposalToNextDay(task.id, dayIndex);
        });
    }

    const removeBtn = taskEl.querySelector('.remove-task-btn');
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isProposal) {
            removeFromSchedule(task.id, dayIndex);
        } else {
            deleteTask(task.id, dayIndex);
        }
    });

    return taskEl;
}

// --- Enhanced Schedule Functions ---

function addDaySummary(dayIndex, stats) {
    const cell = document.getElementById(`day-cell-${dayIndex}`);
    if (!cell || stats.totalTasks === 0) return;

    const summaryEl = document.createElement('div');
    // Add non-draggable attributes and positioning classes
    summaryEl.className = 'schedule-day-summary mt-2 p-2 bg-gray-800 dark:bg-gray-600 text-white dark:text-gray-100 rounded text-xs border-t border-gray-600 dark:border-gray-500 order-last sticky bottom-0';
    summaryEl.draggable = false; // Make non-draggable
    summaryEl.setAttribute('data-non-sortable', 'true'); // Mark as non-sortable
    
    const priorityDots = [];
    if (stats.priorities.high > 0) priorityDots.push(`<span class="priority-dot high" title="${stats.priorities.high} high priority">🔴</span>`);
    if (stats.priorities.medium > 0) priorityDots.push(`<span class="priority-dot medium" title="${stats.priorities.medium} medium priority">🟡</span>`);
    if (stats.priorities.low > 0) priorityDots.push(`<span class="priority-dot low" title="${stats.priorities.low} low priority">🟢</span>`);
    
    summaryEl.innerHTML = `
        <div class="flex justify-between items-center text-xs">
            <span class="font-medium">${stats.totalTasks} tasks</span>
            <div class="priority-indicators">${priorityDots.join(' ')}</div>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ${stats.proposalTasks > 0 ? `${stats.proposalTasks} proposals` : ''}
            ${stats.customTasks > 0 ? `${stats.customTasks > 0 && stats.proposalTasks > 0 ? ', ' : ''}${stats.customTasks} custom` : ''}
        </div>
    `;
    
    // Ensure it's added as the last element and cannot be moved
    cell.appendChild(summaryEl);
}

function updateWeekOverview(dailyStats, totalTasks) {
    // Create or update week overview
    let overviewEl = document.getElementById('week-overview');
    if (!overviewEl) {
        overviewEl = document.createElement('div');
        overviewEl.id = 'week-overview';
        overviewEl.className = 'week-overview bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-700';
        
        const scheduleContainer = document.querySelector('.schedule-container');
        if (scheduleContainer) {
            scheduleContainer.parentNode.insertBefore(overviewEl, scheduleContainer);
        }
    }
    
    // Calculate weekly statistics
    let totalProposals = 0;
    let totalCustomTasks = 0;
    let busiestDay = { day: 0, count: 0 };
    let priorities = { high: 0, medium: 0, low: 0 };
    
    for (let i = 0; i < 7; i++) {
        totalProposals += dailyStats[i].proposalTasks;
        totalCustomTasks += dailyStats[i].customTasks;
        priorities.high += dailyStats[i].priorities.high;
        priorities.medium += dailyStats[i].priorities.medium;
        priorities.low += dailyStats[i].priorities.low;
        
        if (dailyStats[i].totalTasks > busiestDay.count) {
            busiestDay = { day: i, count: dailyStats[i].totalTasks };
        }
    }
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const workload = totalTasks === 0 ? 'Light' : totalTasks <= 5 ? 'Light' : totalTasks <= 10 ? 'Moderate' : totalTasks <= 15 ? 'Heavy' : 'Very Heavy';
    const workloadColor = workload === 'Light' ? 'text-green-600' : workload === 'Moderate' ? 'text-yellow-600' : workload === 'Heavy' ? 'text-orange-600' : 'text-red-600';
    
    overviewEl.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <span class="material-icons mr-2">analytics</span>
                Week Overview
            </h3>
            <span class="text-sm ${workloadColor} font-medium">${workload} Workload</span>
        </div>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div class="stat-card bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <div class="text-blue-600 dark:text-blue-400 font-semibold">${totalTasks}</div>
                <div class="text-gray-600 dark:text-gray-400">Total Tasks</div>
            </div>
            
            <div class="stat-card bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <div class="text-green-600 dark:text-green-400 font-semibold">${totalProposals}</div>
                <div class="text-gray-600 dark:text-gray-400">Proposals</div>
            </div>
            
            <div class="stat-card bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                <div class="text-purple-600 dark:text-purple-400 font-semibold">${totalCustomTasks}</div>
                <div class="text-gray-600 dark:text-gray-400">Custom Tasks</div>
            </div>
            
            <div class="stat-card bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                <div class="text-orange-600 dark:text-orange-400 font-semibold">${busiestDay.count > 0 ? dayNames[busiestDay.day] : 'N/A'}</div>
                <div class="text-gray-600 dark:text-gray-400">Busiest Day</div>
            </div>
        </div>
        
        ${priorities.high > 0 || priorities.medium > 0 || priorities.low > 0 ? `
        <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">Priority Breakdown:</div>
            <div class="flex gap-4 text-sm">
                ${priorities.high > 0 ? `<span class="flex items-center"><span class="w-3 h-3 bg-red-500 rounded-full mr-1"></span>${priorities.high} High</span>` : ''}
                ${priorities.medium > 0 ? `<span class="flex items-center"><span class="w-3 h-3 bg-yellow-500 rounded-full mr-1"></span>${priorities.medium} Medium</span>` : ''}
                ${priorities.low > 0 ? `<span class="flex items-center"><span class="w-3 h-3 bg-green-500 rounded-full mr-1"></span>${priorities.low} Low</span>` : ''}
            </div>
        </div>` : ''}
    `;
}

function enhanceTaskModal() {
    // Add priority and category fields to the task modal
    const taskModal = document.getElementById('taskModalOverlay');
    if (!taskModal) return;
    
    const form = taskModal.querySelector('#taskForm');
    if (!form) return;
    
    // Check if enhancements are already added
    if (form.querySelector('#taskPriority')) return;
    
    // Find insertion point (after description field)
    const descField = form.querySelector('#taskDescription');
    if (!descField) return;
    
    const enhancedFields = document.createElement('div');
    enhancedFields.innerHTML = `
        <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="form-field">
                <label for="taskPriority" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                <select id="taskPriority" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            
            <div class="form-field">
                <label for="taskCategory" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                <select id="taskCategory" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white">
                    <option value="general">General</option>
                    <option value="meeting">Meeting</option>
                    <option value="deadline">Deadline</option>
                    <option value="review">Review</option>
                    <option value="planning">Planning</option>
                    <option value="followup">Follow-up</option>
                </select>
            </div>
        </div>
        
        <div class="form-field mt-4">
            <label for="taskTime" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time (Optional)</label>
            <input type="time" id="taskTime" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white">
        </div>
    `;
    
    // Insert after description field
    descField.parentNode.insertBefore(enhancedFields, descField.nextSibling);
}

// Initialize workbench data and filters
async function initializeWorkbench() {
    try {
        // Fetch proposals from backend
        const response = await fetch('/api/proposals/workbench');
        const data = await response.json();
        
        // Store proposals and user info
        proposals = data.proposals;
        const user = data.user;
        
        // Initialize filters
        await initializeFilters();
        
        // Auto-select Account Manager filter if user is not admin
        if (!user.isAdmin) {
            const accountMgrFilter = document.getElementById('accountMgrFilter');
            if (accountMgrFilter) {
                // Find the option that matches the user's name
                const userOption = Array.from(accountMgrFilter.options).find(option => 
                    option.value.toLowerCase() === user.name.toLowerCase()
                );
                
                if (userOption) {
                    accountMgrFilter.value = userOption.value;
                    console.log('[FILTER] Auto-selected Account Manager filter:', userOption.value);
                }
            }
        }
        
        // Apply initial filters and render
        filterAndRenderProposals();
        
    } catch (error) {
        console.error('[ERROR] Failed to initialize workbench:', error);
        showErrorMessage('Failed to load proposals. Please try again.');
    }
}

// Filter and render proposals
function filterAndRenderProposals() {
    try {
        // Get current filter values
        const accountMgrFilter = document.getElementById('accountMgrFilter')?.value || '';
        const picFilter = document.getElementById('picFilter')?.value || '';
        const clientFilter = document.getElementById('clientFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        
        console.log('[FILTER] Applying filters:', {
            accountMgr: accountMgrFilter,
            pic: picFilter,
            client: clientFilter,
            status: statusFilter
        });
        
        // Apply filters
        let filteredProposals = proposals;
        
        if (accountMgrFilter) {
            filteredProposals = filteredProposals.filter(p => 
                p.account_manager?.toLowerCase() === accountMgrFilter.toLowerCase()
            );
        }
        
        if (picFilter) {
            filteredProposals = filteredProposals.filter(p => 
                p.pic?.toLowerCase() === picFilter.toLowerCase() ||
                p.bom?.toLowerCase() === picFilter.toLowerCase()
            );
        }
        
        if (clientFilter) {
            filteredProposals = filteredProposals.filter(p => 
                p.client_name?.toLowerCase() === clientFilter.toLowerCase()
            );
        }
        
        if (statusFilter) {
            filteredProposals = filteredProposals.filter(p => 
                p.status?.toLowerCase() === statusFilter.toLowerCase()
            );
        }
        
        // Render filtered proposals
        renderProposals(filteredProposals);
        
    } catch (error) {
        console.error('[ERROR] Failed to filter and render proposals:', error);
        showErrorMessage('Failed to update proposals view. Please try again.');
    }
}

// --- Authentication and Role Management ---

function getCurrentUserRoles() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('[GET-USER-ROLES] No auth token found');
            return [];
        }
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        const roles = payload.roles || [];
        console.log('[GET-USER-ROLES] User roles:', roles);
        return roles;
    } catch (error) {
        console.error('[GET-USER-ROLES] Error extracting roles from token:', error);
        return [];
    }
}

function getCurrentUserName() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('[GET-USER-NAME] No auth token found');
            return 'Unknown User';
        }
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.username || payload.name || 'Unknown User';
    } catch (error) {
        console.error('[GET-USER-NAME] Error extracting username from token:', error);
        return 'Unknown User';
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
    const solutions = [...new Set(availableData.map(p => p.solutions).filter(Boolean))];
    const pics = [...new Set(availableData.map(p => p.pic).filter(Boolean))];
    
    // Role-based filtering logic
    userRoles.forEach(role => {
        switch(role.toUpperCase()) {
            case 'DS':
                // DS (Data Solutions) - filter by PIC (username) and solutions containing data-related terms
                const userName = getCurrentUserName();
                console.log('[ROLE-FILTER] DS role - checking for PIC filter for user:', userName);
                
                if (userName && userName !== 'Unknown User') {
                    // Try to match PIC by username
                    const picMatch = pics.find(pic => 
                        pic && pic.toLowerCase().includes(userName.toLowerCase())
                    );
                    if (picMatch) {
                        filters.pic = picMatch;
                        console.log('[ROLE-FILTER] DS role mapped to PIC filter:', filters.pic);
                    }
                }
                
                // Also try to filter by data-related solutions
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
                // SE (Systems Engineer) - filter by PIC (username) and engineering solutions
                const userNameSE = getCurrentUserName();
                console.log('[ROLE-FILTER] SE role - checking for PIC filter for user:', userNameSE);
                
                if (userNameSE && userNameSE !== 'Unknown User') {
                    // Try to match PIC by username
                    const picMatchSE = pics.find(pic => 
                        pic && pic.toLowerCase().includes(userNameSE.toLowerCase())
                    );
                    if (picMatchSE) {
                        filters.pic = picMatchSE;
                        console.log('[ROLE-FILTER] SE role mapped to PIC filter:', filters.pic);
                    }
                }
                
                // Also try to filter by engineering solutions
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
            case 'ADMIN':
                // No automatic filtering for Sales and Admin roles
                console.log('[ROLE-FILTER] Sales/Admin role - no automatic filtering');
                break;
                
            default:
                console.log('[ROLE-FILTER] Unknown role:', role);
        }
    });
    
    return filters;
}

function applyAutoFiltersForUser() {
    try {
        // First try role-based filtering
        const userRoles = getCurrentUserRoles();
        console.log('[AUTO-FILTER] Checking role-based auto-filter for roles:', userRoles);
        
        if (userRoles && userRoles.length > 0 && allProposals && allProposals.length > 0) {
            const roleFilters = mapUserRolesToFilters(userRoles, allProposals);
            let roleFilterApplied = false;
            
            // Apply role-based solutions filter
            if (roleFilters.solutions && solutionFilterSelect) {
                console.log('[AUTO-FILTER] Applying role-based solutions filter:', roleFilters.solutions);
                solutionFilterSelect.value = roleFilters.solutions;
                solutionFilter = roleFilters.solutions;
                roleFilterApplied = true;
            }
            
            // Apply role-based PIC filter (for DS/SE roles)
            if (roleFilters.pic && picFilterSelect) {
                console.log('[AUTO-FILTER] Applying role-based PIC filter:', roleFilters.pic);
                picFilterSelect.value = roleFilters.pic;
                currentPicFilter = roleFilters.pic;
                roleFilterApplied = true;
            }
            
            if (roleFilterApplied) {
                console.log('[AUTO-FILTER] Role-based auto-filter applied, refreshing proposals...');
                renderProposals();
                renderNoDecisionProposals();
                return; // Exit early if role-based filtering was applied
            }
        }
        
        console.log('[AUTO-FILTER] No role-based filters applied');
        
    } catch (error) {
        console.error('[AUTO-FILTER] Error in applyAutoFiltersForUser:', error);
    }
}

// --- USER PREFERENCES ---

// Get current user ID from token
function getCurrentUserId() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) return null;
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.id;
    } catch (error) {
        console.error('[PREFERENCES] Error getting user ID:', error);
        return null;
    }
}

// Get current active filters
function getActiveFilters() {
    return {
        search: currentSearchText,
        client: currentClientFilter,
        accountManager: accountManagerFilter,
        solution: solutionFilter,
        pic: currentPicFilter
    };
}

// Save user preferences to localStorage
async function saveUserPreferences() {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    try {
        // Update preferences with current filter state
        const currentFilters = getActiveFilters();
        userPreferences.filters = currentFilters;
        userPreferences.hasLoadedBefore = true;
        
        // Save to localStorage
        const prefKey = `workbenchPreferences_${userId}`;
        localStorage.setItem(prefKey, JSON.stringify(userPreferences));
        
        console.log('[PREFERENCES] Saved workbench preferences:', userPreferences);
        
    } catch (error) {
        console.error('[PREFERENCES] Error saving preferences:', error);
    }
}

// Load user preferences from localStorage
async function loadUserPreferences() {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    try {
        const prefKey = `workbenchPreferences_${userId}`;
        const stored = localStorage.getItem(prefKey);
        
        if (stored) {
            const loadedPrefs = JSON.parse(stored);
            userPreferences = { ...userPreferences, ...loadedPrefs };
            
            console.log('[PREFERENCES] Loaded workbench preferences:', userPreferences);
            
            // Apply loaded filters if user has used the system before
            if (userPreferences.hasLoadedBefore && userPreferences.filters) {
                applyStoredFilters();
            }
        } else {
            console.log('[PREFERENCES] No stored preferences found');
        }
        
    } catch (error) {
        console.error('[PREFERENCES] Error loading preferences:', error);
    }
}

// Apply stored filters to UI
function applyStoredFilters() {
    try {
        const filters = userPreferences.filters;
        
        console.log('[PREFERENCES] Applying stored filters:', filters);
        
        // Update global variables
        currentSearchText = filters.search || '';
        currentClientFilter = filters.client || 'All Clients';
        accountManagerFilter = filters.accountManager || 'All Account Managers';
        solutionFilter = filters.solution || 'All Solutions';
        currentPicFilter = filters.pic || '';
        
        // Update UI elements
        const searchEl = document.getElementById('proposalSearch');
        const clientFilterEl = document.getElementById('clientFilter');
        const accountManagerFilterEl = document.getElementById('accountManagerFilter');
        const solutionFilterEl = document.getElementById('solutionFilter');
        const picFilterEl = document.getElementById('picFilter');
        
        if (searchEl && filters.search) {
            searchEl.value = filters.search;
        }
        
        if (clientFilterEl && filters.client) {
            clientFilterEl.value = filters.client;
        }
        
        if (accountManagerFilterEl && filters.accountManager) {
            accountManagerFilterEl.value = filters.accountManager;
        }
        
        if (solutionFilterEl && filters.solution) {
            solutionFilterEl.value = filters.solution;
        }
        
        if (picFilterEl && filters.pic) {
            picFilterEl.value = filters.pic;
        }
        
        // Re-render proposals with applied filters
        setTimeout(() => {
            renderProposals();
        }, 100);
        
        console.log('[PREFERENCES] Applied stored filters successfully');
        
    } catch (error) {
        console.error('[PREFERENCES] Error applying stored filters:', error);
    }
}

// Setup filter change listeners to save preferences
function setupFilterChangeListeners() {
    const elements = [
        { id: 'proposalSearch', event: 'input' },
        { id: 'clientFilter', event: 'change' },
        { id: 'accountManagerFilter', event: 'change' },
        { id: 'solutionFilter', event: 'change' },
        { id: 'picFilter', event: 'change' }
    ];
    
    elements.forEach(({ id, event }) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, () => {
                // Debounce saves to avoid too frequent localStorage writes
                clearTimeout(element._saveTimeout);
                element._saveTimeout = setTimeout(() => {
                    saveUserPreferences();
                }, 500);
            });
        }
    });
    
    console.log('[PREFERENCES] Setup filter change listeners');
}

// --- Task Completion Functions ---

async function toggleTaskCompletion(taskId, taskType, dayIndex, isCompleted) {
    try {
        const weekStartDate = getWeekStartDate(currentWeekOffset).toISOString().split('T')[0];
        const currentUser = getCurrentUserId() || 'unknown';
        
        console.log('[COMPLETION] Toggling completion for task:', {
            taskId,
            taskType,
            dayIndex,
            isCompleted,
            weekStartDate,
            currentUser
        });
        
        const response = await fetchWithAuth(getApiUrl('/api/proposal-workbench/schedule/completion/toggle'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taskId,
                taskType,
                weekStartDate,
                dayIndex,
                userId: currentUser,
                isCompleted
            })
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to toggle completion: ${errorData}`);
        }
        
        const result = await response.json();
        console.log('[COMPLETION] Successfully toggled completion:', result);
        
        return result;
        
    } catch (error) {
        console.error('[COMPLETION] Error toggling task completion:', error);
        throw error;
    }
}

// --- Status Change Tracking Functions ---

async function recordProposalStatusChange(proposalId, newStatus, changeReason = null) {
    try {
        const currentUser = getCurrentUserId() || 'unknown';
        
        console.log('[STATUS-HISTORY] Recording status change:', {
            proposalId,
            newStatus,
            changeReason,
            currentUser
        });
        
        const response = await fetchWithAuth(getApiUrl('/api/proposal-workbench/status-history'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                proposalId,
                newStatus,
                changedBy: currentUser,
                changeReason
            })
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to record status change: ${errorData}`);
        }
        
        const result = await response.json();
        console.log('[STATUS-HISTORY] Successfully recorded status change:', result);
        
        return result;
        
    } catch (error) {
        console.error('[STATUS-HISTORY] Error recording status change:', error);
        throw error;
    }
}

async function getProposalStatusOnDate(proposalId, date) {
    try {
        const response = await fetchWithAuth(getApiUrl(`/api/proposal-workbench/status-history/${proposalId}?date=${date}`));
        
        if (!response.ok) {
            throw new Error('Failed to get historical status');
        }
        
        const result = await response.json();
        return result.status;
        
    } catch (error) {
        console.error('[STATUS-HISTORY] Error getting historical status:', error);
        return null;
    }
}

