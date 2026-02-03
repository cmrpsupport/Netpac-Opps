// account-manager-dashboard.js - Account Manager Dashboard Implementation

// --- Global Variables ---
let currentAccountManager = null;
let availableAccountManagers = [];
let currentComparisonMode = 'weekly';
let selectedSnapshotDate = null;
let availableSnapshotDates = [];
let realtimeUpdateInterval = null;
let lastUpdateTimestamp = null;

// Chart instances
let accountManagerPipelineChart = null;
let accountManagerStatusChart = null;

// --- API Helper Functions ---
function getApiUrl(endpoint) {
    if (typeof window !== 'undefined' && window.APP_CONFIG) {
        return window.APP_CONFIG.API_BASE_URL + endpoint;
    }
    return (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://cmrp-opps-backend.onrender.com') + endpoint;
}

// --- Authentication Functions ---
function isAuthenticated() {
    return !!localStorage.getItem('authToken');
}

function requireAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function getCurrentUserName() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) return 'Unknown User';
        
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.name || payload.username || payload.email || 'Unknown User';
    } catch (error) {
        console.error('[getCurrentUserName] Error parsing token:', error);
        return 'Unknown User';
    }
}

// --- Account Manager Loading Functions ---
async function loadAccountManagers() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(getApiUrl('/api/realtime/account-managers'), {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) throw new Error('Failed to fetch account managers: ' + response.status);

        const data = await response.json();
        availableAccountManagers = data.account_managers || [];

        populateAccountManagerSelector();
        setupQuickSelectButtons();
        
        console.log('[DEBUG] Loaded account managers:', availableAccountManagers.length);

    } catch (error) {
        console.error('[ERROR] Failed to load account managers:', error);
        showError('Failed to load account managers: ' + error.message);
    }
}

function populateAccountManagerSelector() {
    const selector = document.getElementById('accountManagerSelect');
    if (!selector) return;

    selector.innerHTML = '<option value="">Choose an account manager...</option>';

    availableAccountManagers
        .sort((a, b) => b.metrics.submitted_amount - a.metrics.submitted_amount)
        .forEach(manager => {
            const option = document.createElement('option');
            option.value = manager.name;
            option.textContent = `${manager.name} (${manager.metrics.total_opportunities} opps, ₱${formatAmount(manager.metrics.submitted_amount)})`;
            selector.appendChild(option);
        });
}

function setupQuickSelectButtons() {
    const container = document.getElementById('managerQuickSelect');
    if (!container) return;

    container.innerHTML = '';

    // Show top 6 account managers by submitted amount
    const topManagers = availableAccountManagers
        .sort((a, b) => b.metrics.submitted_amount - a.metrics.submitted_amount)
        .slice(0, 6);

    topManagers.forEach(manager => {
        const button = document.createElement('button');
        button.className = 'manager-quick-btn';
        button.textContent = manager.name;
        button.onclick = () => selectAccountManager(manager.name);
        container.appendChild(button);
    });
}

// --- Account Manager Selection ---
async function selectAccountManager(managerName) {
    if (!managerName) {
        hideManagerDashboard();
        return;
    }

    currentAccountManager = managerName;
    
    // Update UI selections
    document.getElementById('accountManagerSelect').value = managerName;
    updateQuickSelectButtons();
    
    // Show manager info card
    showManagerInfo(managerName);
    
    // Load snapshot dates for this manager
    await loadSnapshotDates();
    
    // Load manager metrics
    await loadAccountManagerMetrics();
    
    // Start realtime updates
    startRealtimeUpdates();
}

function updateQuickSelectButtons() {
    const buttons = document.querySelectorAll('.manager-quick-btn');
    buttons.forEach(btn => {
        if (btn.textContent === currentAccountManager) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function showManagerInfo(managerName) {
    const manager = availableAccountManagers.find(m => m.name === managerName);
    if (!manager) return;

    // Show the manager info card
    const infoCard = document.getElementById('managerInfoCard');
    const dashboardMetrics = document.getElementById('dashboardMetrics');
    const emptyState = document.getElementById('emptyState');
    
    if (infoCard) infoCard.style.display = 'block';
    if (dashboardMetrics) dashboardMetrics.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    // Update manager avatar
    const avatar = document.getElementById('managerAvatar');
    if (avatar) {
        const initials = managerName.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
        avatar.textContent = initials;
    }

    // Update manager name and basic info
    const nameEl = document.getElementById('managerName');
    if (nameEl) nameEl.textContent = managerName;

    const statsEl = document.getElementById('managerStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <span id="totalOppsPreview">${manager.metrics.total_opportunities} opportunities</span>
            <span id="submittedPreview">${manager.metrics.submitted_count} submitted</span>
            <span id="pipelinePreview">${manager.metrics.active_pipeline_count} in pipeline</span>
        `;
    }

    // Update activity info
    const activityEl = document.getElementById('managerActivity');
    if (activityEl && manager.last_activity) {
        const lastActivity = new Date(manager.last_activity);
        activityEl.textContent = `Last activity: ${lastActivity.toLocaleDateString()} ${lastActivity.toLocaleTimeString()}`;
    }
}

function hideManagerDashboard() {
    currentAccountManager = null;
    
    const infoCard = document.getElementById('managerInfoCard');
    const dashboardMetrics = document.getElementById('dashboardMetrics');
    const emptyState = document.getElementById('emptyState');
    
    if (infoCard) infoCard.style.display = 'none';
    if (dashboardMetrics) dashboardMetrics.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';

    stopRealtimeUpdates();
    updateQuickSelectButtons();
}

// --- Snapshot Date Management ---
async function loadSnapshotDates() {
    if (!currentAccountManager) return;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(getApiUrl('/api/snapshots/custom-dates'), {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.ok) {
            const data = await response.json();
            availableSnapshotDates = data.success && data.data ? data.data : [];
            updateSnapshotDateSelector();
        } else {
            availableSnapshotDates = [];
            updateSnapshotDateSelector();
        }

    } catch (error) {
        console.error('[ERROR] Failed to load snapshot dates:', error);
        availableSnapshotDates = [];
        updateSnapshotDateSelector();
    }
}

function updateSnapshotDateSelector() {
    const container = document.getElementById('snapshotDatesContainer');
    if (!container) return;

    if (currentComparisonMode === 'none') {
        container.style.display = 'none';
        updateComparisonStatus('No comparison selected');
        return;
    }

    if (availableSnapshotDates.length === 0) {
        container.style.display = 'none';
        updateComparisonStatus(`No ${currentComparisonMode} snapshots available for ${currentAccountManager}`);
        return;
    }

    container.style.display = 'grid';
    container.innerHTML = '';

    // Show available snapshot dates
    availableSnapshotDates.slice(0, 8).forEach(snapshot => {
        const option = document.createElement('div');
        option.className = 'snapshot-date-option';
        option.onclick = () => selectSnapshotDate(snapshot.snapshot_date);

        const date = new Date(snapshot.snapshot_date);
        const isManual = snapshot.is_manual;
        const isCustom = snapshot.snapshot_type === 'custom';
        
        option.innerHTML = `
            <div class="date-label">${date.toLocaleDateString()}</div>
            <div class="date-meta">
                ${isCustom ? 'Custom' : (isManual ? 'Manual' : 'Auto')} • 
                ${snapshot.preview ? snapshot.preview.total_opportunities : '?'} opps • 
                ₱${snapshot.preview ? formatAmount(snapshot.preview.submitted_amount) : '?'}
            </div>
        `;

        container.appendChild(option);
    });

    // Auto-select the latest date if none selected
    if (!selectedSnapshotDate && availableSnapshotDates.length > 0) {
        selectSnapshotDate(availableSnapshotDates[0].snapshot_date);
    }
}

function selectSnapshotDate(date) {
    selectedSnapshotDate = date;
    
    // Update UI selection
    const options = document.querySelectorAll('.snapshot-date-option');
    options.forEach(option => {
        const optionDate = option.querySelector('.date-label').textContent;
        const targetDate = new Date(date).toLocaleDateString();
        
        if (optionDate === targetDate) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });

    updateComparisonStatus(`Comparing against ${currentComparisonMode} snapshot from ${new Date(date).toLocaleDateString()}`);
    
    // Reload metrics with comparison
    if (currentAccountManager) {
        loadAccountManagerMetrics();
    }
}

function updateComparisonStatus(status) {
    const statusEl = document.getElementById('currentComparisonStatus');
    if (statusEl) {
        statusEl.textContent = status;
    }
}

// --- Metrics Loading ---
async function loadAccountManagerMetrics() {
    if (!currentAccountManager) return;

    try {
        const token = localStorage.getItem('authToken');
        let url = getApiUrl(`/api/realtime/account-managers/${encodeURIComponent(currentAccountManager)}/metrics`);
        
        // Add comparison parameters if selected
        if (selectedSnapshotDate && currentComparisonMode !== 'none') {
            // Determine the correct comparison type based on selected snapshot
            const selectedSnapshot = availableSnapshotDates.find(s => s.snapshot_date === selectedSnapshotDate);
            const comparisonType = selectedSnapshot && selectedSnapshot.snapshot_type === 'custom' ? 'custom' : currentComparisonMode;
            
            url += `?comparison_date=${selectedSnapshotDate}&comparison_type=${comparisonType}`;
        }

        const response = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) throw new Error('Failed to fetch metrics: ' + response.status);

        const data = await response.json();
        
        // Update dashboard with metrics
        updateDashboardMetrics(data);
        updateCharts(data);
        updateLastUpdateTime();

        console.log('[DEBUG] Loaded metrics for', currentAccountManager, data);

    } catch (error) {
        console.error('[ERROR] Failed to load metrics:', error);
        showError('Failed to load metrics: ' + error.message);
    }
}

function updateDashboardMetrics(data) {
    const metrics = data.current_metrics;
    const comparison = data.comparison;

    // Helper function to format values with deltas
    function formatWithDelta(currentValue, comparisonValue, elementId) {
        if (comparison && typeof comparisonValue === 'number') {
            const delta = currentValue - comparisonValue;
            const deltaStr = delta > 0 ? `(+${formatMetricValue(delta)})` : delta < 0 ? `(${formatMetricValue(delta)})` : '(0)';
            
            // Color logic - green for positive changes in good metrics, red for negative
            const isNegativeMetric = elementId === 'lostCount' || elementId === 'lostAmount' || elementId === 'declinedCount' || elementId === 'inactiveCount';
            const deltaClass = isNegativeMetric 
                ? (delta > 0 ? 'negative' : delta < 0 ? 'positive' : '') 
                : (delta > 0 ? 'positive' : delta < 0 ? 'negative' : '');
            
            return `${formatMetricValue(currentValue)} <span class="dashboard-delta ${deltaClass}">${deltaStr}</span>`;
        } else {
            return formatMetricValue(currentValue);
        }
    }

    // Update primary metrics
    setElementHTML('totalOpportunities', formatWithDelta(metrics.total_opportunities, comparison?.baseline_metrics.total_opportunities, 'totalOpportunities'));
    setElementHTML('submittedCount', formatWithDelta(metrics.submitted_count, comparison?.baseline_metrics.submitted_count, 'submittedCount'));
    setElementHTML('submittedAmount', formatWithDelta(metrics.submitted_amount, comparison?.baseline_metrics.submitted_amount, 'submittedAmount'));
    setElementHTML('revisedCount', formatWithDelta(metrics.revised_count, comparison?.baseline_metrics.revised_count, 'revisedCount'));

    // Update pipeline metrics
    setElementHTML('op100Count', formatWithDelta(metrics.op100_count, comparison?.baseline_metrics.op100_count, 'op100Count'));
    setElementHTML('op100Amount', formatWithDelta(metrics.op100_amount, comparison?.baseline_metrics.op100_amount, 'op100Amount'));
    setElementHTML('op90Count', formatWithDelta(metrics.op90_count, comparison?.baseline_metrics.op90_count, 'op90Count'));
    setElementHTML('op90Amount', formatWithDelta(metrics.op90_amount, comparison?.baseline_metrics.op90_amount, 'op90Amount'));
    setElementHTML('op60Count', formatWithDelta(metrics.op60_count, comparison?.baseline_metrics.op60_count, 'op60Count'));
    setElementHTML('op60Amount', formatWithDelta(metrics.op60_amount, comparison?.baseline_metrics.op60_amount, 'op60Amount'));
    setElementHTML('op30Count', formatWithDelta(metrics.op30_count, comparison?.baseline_metrics.op30_count, 'op30Count'));
    setElementHTML('op30Amount', formatWithDelta(metrics.op30_amount, comparison?.baseline_metrics.op30_amount, 'op30Amount'));

    // Update final status metrics
    setElementHTML('lostCount', formatWithDelta(metrics.lost_count, comparison?.baseline_metrics.lost_count, 'lostCount'));
    setElementHTML('lostAmount', formatWithDelta(metrics.lost_amount, comparison?.baseline_metrics.lost_amount, 'lostAmount'));
    setElementHTML('declinedCount', formatWithDelta(metrics.declined_count, comparison?.baseline_metrics.declined_count, 'declinedCount'));
    setElementHTML('inactiveCount', formatWithDelta(metrics.inactive_count, comparison?.baseline_metrics.inactive_count, 'inactiveCount'));
    setElementHTML('ongoingCount', formatWithDelta(metrics.ongoing_count, comparison?.baseline_metrics.ongoing_count, 'ongoingCount'));
    setElementHTML('pendingCount', formatWithDelta(metrics.pending_count, comparison?.baseline_metrics.pending_count, 'pendingCount'));

    // Update activity info
    if (data.activity) {
        const todayUpdatesEl = document.getElementById('todayUpdates');
        if (todayUpdatesEl) {
            todayUpdatesEl.textContent = `${data.activity.today_updates || 0} updates today`;
        }

        const lastActivityEl = document.getElementById('lastActivity');
        if (lastActivityEl && data.activity.last_activity) {
            const lastActivity = new Date(data.activity.last_activity);
            lastActivityEl.textContent = `Last activity: ${lastActivity.toLocaleDateString()} ${lastActivity.toLocaleTimeString()}`;
        }
    }
}

// --- Chart Functions ---
function updateCharts(data) {
    const metrics = data.current_metrics;
    
    updatePipelineChart(metrics);
    updateStatusChart(metrics);
}

function updatePipelineChart(metrics) {
    const ctx = document.getElementById('accountManagerPipelineChart');
    if (!ctx) return;

    if (accountManagerPipelineChart) {
        accountManagerPipelineChart.destroy();
    }

    const chartData = [
        metrics.op100_count,
        metrics.op90_count,
        metrics.op60_count,
        metrics.op30_count,
        metrics.submitted_count
    ];

    const total = chartData.reduce((sum, value) => sum + value, 0);

    const data = {
        labels: ['OP100', 'OP90', 'OP60', 'OP30', 'Submitted'],
        datasets: [{
            label: 'Count',
            data: chartData,
            backgroundColor: [
                '#10b981', // emerald-500
                '#06b6d4', // cyan-500
                '#3b82f6', // blue-500
                '#f59e0b', // amber-500
                '#ef4444'  // red-500
            ],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };

    const config = {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                    titleColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    bodyColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb',
                    borderWidth: 1
                }
            }
        }
    };

    accountManagerPipelineChart = new Chart(ctx, config);
}

function updateStatusChart(metrics) {
    const ctx = document.getElementById('accountManagerStatusChart');
    if (!ctx) return;

    if (accountManagerStatusChart) {
        accountManagerStatusChart.destroy();
    }

    const chartData = [
        metrics.op100_count + metrics.op90_count + metrics.op60_count + metrics.op30_count,
        metrics.lost_count,
        metrics.inactive_count,
        metrics.ongoing_count,
        metrics.pending_count,
        metrics.declined_count
    ];

    const data = {
        labels: ['Active Pipeline', 'Lost', 'Inactive', 'On-Going', 'Pending', 'Declined'],
        datasets: [{
            label: 'Count',
            data: chartData,
            backgroundColor: [
                '#10b981', // emerald-500 - active pipeline
                '#ef4444', // red-500 - lost
                '#6b7280', // gray-500 - inactive
                '#3b82f6', // blue-500 - ongoing
                '#f59e0b', // amber-500 - pending
                '#ec4899'  // pink-500 - declined
            ],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };

    const config = {
        type: 'pie',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
                    titleColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    bodyColor: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                    borderColor: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb',
                    borderWidth: 1
                }
            }
        }
    };

    accountManagerStatusChart = new Chart(ctx, config);
}

// --- Realtime Updates ---
function startRealtimeUpdates() {
    stopRealtimeUpdates(); // Clear any existing interval
    
    // Update immediately, then every 30 seconds
    realtimeUpdateInterval = setInterval(() => {
        if (currentAccountManager) {
            loadAccountManagerMetrics();
        }
    }, 30000);
}

function stopRealtimeUpdates() {
    if (realtimeUpdateInterval) {
        clearInterval(realtimeUpdateInterval);
        realtimeUpdateInterval = null;
    }
}

function updateLastUpdateTime() {
    lastUpdateTimestamp = new Date();
    const updateTimeEl = document.getElementById('lastUpdateTime');
    if (updateTimeEl) {
        updateTimeEl.textContent = `Last updated: ${lastUpdateTimestamp.toLocaleTimeString()}`;
    }
}

// --- Manual Snapshot Creation ---
async function createManualSnapshot() {
    if (!currentAccountManager) {
        alert('Please select an account manager first');
        return;
    }

    try {
        const token = localStorage.getItem('authToken');
        const today = new Date().toISOString().split('T')[0];
        
        // Get current metrics first
        const metricsResponse = await fetch(getApiUrl(`/api/realtime/account-managers/${encodeURIComponent(currentAccountManager)}/metrics`), {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!metricsResponse.ok) throw new Error('Failed to get current metrics');

        const metricsData = await metricsResponse.json();
        const currentMetrics = metricsData.current_metrics;

        // Create manual snapshot
        const snapshotResponse = await fetch(getApiUrl('/api/snapshots/manual/account-manager'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                account_manager: currentAccountManager,
                snapshot_type: currentComparisonMode,
                snapshot_date: today,
                description: `Manual snapshot created by ${getCurrentUserName()}`,
                created_by: getCurrentUserName(),
                ...currentMetrics
            })
        });

        if (!snapshotResponse.ok) throw new Error('Failed to create snapshot');

        alert(`Manual ${currentComparisonMode} snapshot created for ${currentAccountManager} on ${today}`);
        
        // Reload snapshot dates
        await loadSnapshotDates();

    } catch (error) {
        console.error('[ERROR] Failed to create manual snapshot:', error);
        alert('Failed to create snapshot: ' + error.message);
    }
}

// --- Utility Functions ---
function formatMetricValue(value) {
    if (typeof value === 'number' && value >= 1000000000) {
        return `₱${(value / 1000000000).toFixed(1)}B`;
    } else if (typeof value === 'number' && value >= 1000000) {
        return `₱${(value / 1000000).toFixed(1)}M`;
    } else if (typeof value === 'number' && value >= 1000) {
        return `₱${(value / 1000).toFixed(1)}K`;
    } else if (typeof value === 'number') {
        return value.toLocaleString();
    }
    return value;
}

function formatAmount(amount) {
    if (amount >= 1000000000) {
        return `${(amount / 1000000000).toFixed(1)}B`;
    } else if (amount >= 1000000) {
        return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
        return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
}

function setElementHTML(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = html;
    }
}

function showError(message) {
    // Simple error display - could be enhanced with a proper toast system
    console.error('[ERROR]', message);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded shadow-lg z-50';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// --- Event Handlers ---
function setupEventHandlers() {
    // Account manager selection
    const accountManagerSelect = document.getElementById('accountManagerSelect');
    if (accountManagerSelect) {
        accountManagerSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                selectAccountManager(e.target.value);
            } else {
                hideManagerDashboard();
            }
        });
    }

    // Refresh managers button
    const refreshBtn = document.getElementById('refreshManagersBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAccountManagers);
    }

    // Comparison mode toggle
    document.querySelectorAll('.comparison-mode-toggle .toggle-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const mode = e.target.getAttribute('data-mode');
            
            // Update active state
            document.querySelectorAll('.comparison-mode-toggle .toggle-option').forEach(opt => {
                opt.classList.remove('active');
            });
            e.target.classList.add('active');
            
            // Update comparison mode
            currentComparisonMode = mode;
            selectedSnapshotDate = null;
            
            // Reload snapshot dates and metrics
            if (currentAccountManager) {
                loadSnapshotDates().then(() => {
                    loadAccountManagerMetrics();
                });
            }
        });
    });

    // Create snapshot button
    const createSnapshotBtn = document.getElementById('createSnapshotBtn');
    if (createSnapshotBtn) {
        createSnapshotBtn.addEventListener('click', createManualSnapshot);
    }
}

// --- Theme Management ---
function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Re-render charts with new theme colors
    if (accountManagerPipelineChart || accountManagerStatusChart) {
        setTimeout(() => {
            if (currentAccountManager) {
                loadAccountManagerMetrics();
            }
        }, 100);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    // Set initial theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
    
    // Check authentication
    if (!requireAuth()) return;
    
    // Initialize components
    setupEventHandlers();
    loadAccountManagers();
    
    // Update last update time initially
    updateLastUpdateTime();
    
    // Update time every minute
    setInterval(updateLastUpdateTime, 60000);
    
    console.log('[DEBUG] Account Manager Dashboard initialized');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopRealtimeUpdates();
});