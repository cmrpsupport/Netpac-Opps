/**
 * Comprehensive Test Script for Selective Dashboard Updates
 * This script tests the new behavior where dashboard cards update only for Account Manager and Solutions filters
 */

console.log('🎯 Starting Selective Dashboard Updates Test');

// Helper function to capture dashboard values
function captureDashboardValues() {
    const values = {};
    
    // Capture all dashboard cards
    const dashboardCards = [
        { id: 'op100-count', name: 'OP100 Count' },
        { id: 'op90-count', name: 'OP90 Count' },
        { id: 'total-opportunities', name: 'Total Opportunities' },
        { id: 'total-value', name: 'Total Value' },
        { id: 'op100-value', name: 'OP100 Value' },
        { id: 'op90-value', name: 'OP90 Value' },
        { id: 'avg-opportunity-value', name: 'Average Opportunity Value' }
    ];
    
    dashboardCards.forEach(card => {
        const element = document.getElementById(card.id);
        if (element) {
            values[card.name] = element.textContent.trim();
        } else {
            console.warn(`Dashboard card not found: ${card.id}`);
        }
    });
    
    return values;
}

// Helper function to apply filter and wait
async function applyFilterAndWait(filterId, value, waitTime = 1500) {
    console.log(`Applying filter: ${filterId} = ${value}`);
    
    const filterElement = document.getElementById(filterId);
    if (!filterElement) {
        console.error(`Filter element not found: ${filterId}`);
        return false;
    }
    
    const originalValue = filterElement.value;
    filterElement.value = value;
    filterElement.dispatchEvent(new Event('change'));
    
    // Wait for update
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    return originalValue;
}

// Helper function to click status button and wait
async function clickStatusButtonAndWait(buttonValue, waitTime = 1500) {
    console.log(`Clicking status button: ${buttonValue}`);
    
    const button = document.querySelector(`[data-filter-value="${buttonValue}"]`);
    if (!button) {
        console.error(`Status button not found: ${buttonValue}`);
        return false;
    }
    
    button.click();
    
    // Wait for update
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    return true;
}

// Helper function to compare dashboard values
function compareDashboardValues(before, after, testName) {
    console.log(`\n=== ${testName} ===`);
    
    let allSame = true;
    let changedCards = [];
    
    for (const [key, beforeValue] of Object.entries(before)) {
        const afterValue = after[key];
        const isSame = beforeValue === afterValue;
        
        console.log(`${key}:`);
        console.log(`  Before: ${beforeValue}`);
        console.log(`  After:  ${afterValue}`);
        console.log(`  Status: ${isSame ? '✅ UNCHANGED' : '🔄 CHANGED'}`);
        
        if (!isSame) {
            allSame = false;
            changedCards.push(key);
        }
    }
    
    return { allSame, changedCards };
}

// Main test function
async function runSelectiveDashboardTest() {
    console.log('\n🚀 Starting Comprehensive Selective Dashboard Test...\n');
    
    try {
        // Wait for page to fully load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Capture initial values
        console.log('📊 Capturing initial dashboard values...');
        const initialValues = captureDashboardValues();
        console.log('Initial values:', initialValues);
        
        // Test 1: Account Manager Filter (SHOULD change dashboard)
        console.log('\n=== TEST 1: Account Manager Filter (Should Change Dashboard) ===');
        const accountMgrFilter = document.getElementById('accountMgrFilter');
        
        if (accountMgrFilter && accountMgrFilter.options.length > 1) {
            const testValue = accountMgrFilter.options[1].value;
            const originalAccountMgr = await applyFilterAndWait('accountMgrFilter', testValue);
            
            const afterAccountMgr = captureDashboardValues();
            const accountMgrResult = compareDashboardValues(initialValues, afterAccountMgr, 'Account Manager Filter Test');
            
            console.log(`\n📋 Account Manager Test Result: ${!accountMgrResult.allSame ? '✅ PASS - Dashboard changed as expected' : '❌ FAIL - Dashboard should have changed'}`);
            
            // Reset filter
            await applyFilterAndWait('accountMgrFilter', originalAccountMgr);
        } else {
            console.log('⚠️ Account Manager filter not available or no options');
        }
        
        // Test 2: Solutions Filter (SHOULD change dashboard)
        console.log('\n=== TEST 2: Solutions Filter (Should Change Dashboard) ===');
        const solutionsFilter = document.getElementById('solutionsFilter');
        
        if (solutionsFilter && solutionsFilter.options.length > 1) {
            const testValue = solutionsFilter.options[1].value;
            const originalSolutions = await applyFilterAndWait('solutionsFilter', testValue);
            
            const afterSolutions = captureDashboardValues();
            const solutionsResult = compareDashboardValues(initialValues, afterSolutions, 'Solutions Filter Test');
            
            console.log(`\n📋 Solutions Test Result: ${!solutionsResult.allSame ? '✅ PASS - Dashboard changed as expected' : '❌ FAIL - Dashboard should have changed'}`);
            
            // Reset filter
            await applyFilterAndWait('solutionsFilter', originalSolutions);
        } else {
            console.log('⚠️ Solutions filter not available or no options');
        }
        
        // Test 3: Status Filter (should NOT change dashboard)
        console.log('\n=== TEST 3: Status Filter (Should NOT Change Dashboard) ===');
        
        const statusButtonClicked = await clickStatusButtonAndWait('op100');
        
        if (statusButtonClicked) {
            const afterStatus = captureDashboardValues();
            const statusResult = compareDashboardValues(initialValues, afterStatus, 'Status Filter Test');
            
            console.log(`\n📋 Status Test Result: ${statusResult.allSame ? '✅ PASS - Dashboard unchanged as expected' : '❌ FAIL - Dashboard should not have changed'}`);
            
            // Reset to All
            await clickStatusButtonAndWait('all');
        }
        
        // Test 4: PIC Filter (should NOT change dashboard)
        console.log('\n=== TEST 4: PIC Filter (Should NOT Change Dashboard) ===');
        const picFilter = document.getElementById('picFilter');
        
        if (picFilter && picFilter.options.length > 1) {
            const testValue = picFilter.options[1].value;
            const originalPic = await applyFilterAndWait('picFilter', testValue);
            
            const afterPic = captureDashboardValues();
            const picResult = compareDashboardValues(initialValues, afterPic, 'PIC Filter Test');
            
            console.log(`\n📋 PIC Test Result: ${picResult.allSame ? '✅ PASS - Dashboard unchanged as expected' : '❌ FAIL - Dashboard should not have changed'}`);
            
            // Reset filter
            await applyFilterAndWait('picFilter', originalPic);
        } else {
            console.log('⚠️ PIC filter not available or no options');
        }
        
        // Test 5: Search Filter (should NOT change dashboard)
        console.log('\n=== TEST 5: Search Filter (Should NOT Change Dashboard) ===');
        const searchInput = document.getElementById('searchInput');
        
        if (searchInput) {
            const originalSearch = searchInput.value;
            searchInput.value = 'test';
            searchInput.dispatchEvent(new Event('input'));
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const afterSearch = captureDashboardValues();
            const searchResult = compareDashboardValues(initialValues, afterSearch, 'Search Filter Test');
            
            console.log(`\n📋 Search Test Result: ${searchResult.allSame ? '✅ PASS - Dashboard unchanged as expected' : '❌ FAIL - Dashboard should not have changed'}`);
            
            // Reset search
            searchInput.value = originalSearch;
            searchInput.dispatchEvent(new Event('input'));
        } else {
            console.log('⚠️ Search input not available');
        }
        
        // Test 6: Reset Table (should reset dashboard to original values)
        console.log('\n=== TEST 6: Reset Table (Should Reset Dashboard) ===');
        
        // Apply a filter first
        if (accountMgrFilter && accountMgrFilter.options.length > 1) {
            await applyFilterAndWait('accountMgrFilter', accountMgrFilter.options[1].value);
            
            // Now reset
            const resetButton = document.querySelector('button[onclick*="resetTable"]') || 
                              document.getElementById('resetTableBtn') ||
                              document.querySelector('button:contains("Reset")');
            
            if (resetButton) {
                resetButton.click();
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                const afterReset = captureDashboardValues();
                const resetResult = compareDashboardValues(initialValues, afterReset, 'Reset Table Test');
                
                console.log(`\n📋 Reset Test Result: ${resetResult.allSame ? '✅ PASS - Dashboard reset to original values' : '❌ FAIL - Dashboard should have reset'}`);
            } else {
                console.log('⚠️ Reset button not found');
            }
        }
        
        console.log('\n🎯 Test Complete! Check results above.');
        
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

// Run the test
console.log('To run the test, execute: runSelectiveDashboardTest()');

// Auto-run if this script is loaded directly
if (typeof window !== 'undefined') {
    // Wait a bit for page to load, then run
    setTimeout(() => {
        runSelectiveDashboardTest();
    }, 3000);
}
