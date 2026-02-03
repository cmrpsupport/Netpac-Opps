// Real-time Dashboard Monitoring Script
// Run this in the browser console on the main index.html page

console.log('🔍 Dashboard Monitor Script Loaded');

let monitoringActive = false;
let lastValues = {};
let changeCount = 0;

function getCurrentDashboardValues() {
    const values = {};
    
    // Get dashboard card values
    const totalOpps = document.getElementById('totalOpportunities');
    const op100 = document.getElementById('op100Summary');
    const op90 = document.getElementById('op90Summary');
    const totalSub = document.getElementById('totalSubmitted');
    const totalDeclined = document.getElementById('totalDeclined');
    const totalInactive = document.getElementById('totalInactive');
    
    values.totalOpportunities = totalOpps ? totalOpps.textContent : 'N/A';
    values.op100Summary = op100 ? op100.textContent : 'N/A';
    values.op90Summary = op90 ? op90.textContent : 'N/A';
    values.totalSubmitted = totalSub ? totalSub.textContent : 'N/A';
    values.totalDeclined = totalDeclined ? totalDeclined.textContent : 'N/A';
    values.totalInactive = totalInactive ? totalInactive.textContent : 'N/A';
    
    return values;
}

function logChange(key, oldValue, newValue) {
    console.log(`🔴 DASHBOARD CHANGE DETECTED: ${key} changed from "${oldValue}" to "${newValue}"`);
    changeCount++;
}

function checkForChanges() {
    const currentValues = getCurrentDashboardValues();
    let hasChanges = false;
    
    for (const key in currentValues) {
        if (lastValues[key] && lastValues[key] !== currentValues[key]) {
            logChange(key, lastValues[key], currentValues[key]);
            hasChanges = true;
        }
    }
    
    if (hasChanges) {
        console.log(`⚠️ Total changes detected: ${changeCount}`);
        console.log('🚨 Dashboard is NOT independent of filters!');
    } else if (Object.keys(lastValues).length > 0) {
        console.log('✅ Dashboard values stable');
    }
    
    lastValues = { ...currentValues };
    return currentValues;
}

function startMonitoring() {
    if (monitoringActive) {
        console.log('❌ Monitoring already active');
        return;
    }
    
    monitoringActive = true;
    changeCount = 0;
    console.log('🚀 Starting dashboard monitoring...');
    
    // Initial values
    const initialValues = getCurrentDashboardValues();
    console.log('📊 Initial dashboard values:', initialValues);
    lastValues = { ...initialValues };
    
    // Monitor every 1 second
    const monitorInterval = setInterval(() => {
        if (!monitoringActive) {
            clearInterval(monitorInterval);
            return;
        }
        checkForChanges();
    }, 1000);
    
    // Store interval ID for stopping
    window.dashboardMonitorInterval = monitorInterval;
    
    console.log('✅ Monitoring started. Now change filters and watch for dashboard changes.');
    console.log('💡 Use stopMonitoring() to stop monitoring');
}

function stopMonitoring() {
    monitoringActive = false;
    if (window.dashboardMonitorInterval) {
        clearInterval(window.dashboardMonitorInterval);
        window.dashboardMonitorInterval = null;
    }
    console.log('🛑 Dashboard monitoring stopped');
    console.log(`📈 Total changes detected during session: ${changeCount}`);
}

function testAccountManagerFilter() {
    console.log('🧪 Testing Account Manager filter...');
    const accountMgrDropdown = document.getElementById('accountMgrFilterDropdown');
    if (accountMgrDropdown && accountMgrDropdown.options.length > 1) {
        console.log('🔄 Changing Account Manager filter...');
        accountMgrDropdown.selectedIndex = 1; // Select first non-"All" option
        accountMgrDropdown.dispatchEvent(new Event('change'));
        console.log(`📌 Account Manager filter set to: ${accountMgrDropdown.value}`);
        
        setTimeout(() => {
            console.log('⏰ Checking dashboard after Account Manager filter change...');
            checkForChanges();
        }, 2000);
    } else {
        console.log('❌ Account Manager dropdown not found or empty');
    }
}

function testSolutionsFilter() {
    console.log('🧪 Testing Solutions filter...');
    const solutionsDropdown = document.getElementById('solutionsFilterDropdown');
    if (solutionsDropdown && solutionsDropdown.options.length > 1) {
        console.log('🔄 Changing Solutions filter...');
        solutionsDropdown.selectedIndex = 1; // Select first non-"All" option
        solutionsDropdown.dispatchEvent(new Event('change'));
        console.log(`📌 Solutions filter set to: ${solutionsDropdown.value}`);
        
        setTimeout(() => {
            console.log('⏰ Checking dashboard after Solutions filter change...');
            checkForChanges();
        }, 2000);
    } else {
        console.log('❌ Solutions dropdown not found or empty');
    }
}

function resetFilters() {
    console.log('🔄 Resetting all filters to "All"...');
    
    const accountMgrDropdown = document.getElementById('accountMgrFilterDropdown');
    const solutionsDropdown = document.getElementById('solutionsFilterDropdown');
    
    if (accountMgrDropdown) {
        accountMgrDropdown.value = 'all';
        accountMgrDropdown.dispatchEvent(new Event('change'));
    }
    
    if (solutionsDropdown) {
        solutionsDropdown.value = 'all';
        solutionsDropdown.dispatchEvent(new Event('change'));
    }
    
    setTimeout(() => {
        console.log('⏰ Checking dashboard after filter reset...');
        checkForChanges();
    }, 2000);
}

function runFullTest() {
    console.log('🎯 Running full dashboard independence test...');
    
    if (!monitoringActive) {
        startMonitoring();
    }
    
    setTimeout(() => {
        testAccountManagerFilter();
    }, 3000);
    
    setTimeout(() => {
        testSolutionsFilter();
    }, 8000);
    
    setTimeout(() => {
        resetFilters();
    }, 13000);
    
    setTimeout(() => {
        stopMonitoring();
        console.log('🏁 Full test completed');
        if (changeCount === 0) {
            console.log('✅ SUCCESS: Dashboard is independent of filters!');
        } else {
            console.log('❌ FAILURE: Dashboard changed during filtering!');
        }
    }, 18000);
}

// Make functions available globally
window.startMonitoring = startMonitoring;
window.stopMonitoring = stopMonitoring;
window.testAccountManagerFilter = testAccountManagerFilter;
window.testSolutionsFilter = testSolutionsFilter;
window.resetFilters = resetFilters;
window.runFullTest = runFullTest;
window.checkForChanges = checkForChanges;

console.log('📋 Available commands:');
console.log('  startMonitoring() - Start monitoring dashboard values');
console.log('  stopMonitoring() - Stop monitoring');
console.log('  testAccountManagerFilter() - Test account manager filter');
console.log('  testSolutionsFilter() - Test solutions filter');
console.log('  resetFilters() - Reset all filters to "All"');
console.log('  runFullTest() - Run complete automated test');
console.log('  checkForChanges() - Manual check for changes');
