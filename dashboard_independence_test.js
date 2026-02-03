/**
 * Dashboard Independence Test Script
 * This script tests that dashboard cards remain unchanged when filters are applied
 */

console.log('=== Dashboard Independence Test ===');

// Function to capture dashboard values
function captureDashboardValues() {
    const values = {};
    
    // Get all dashboard cards
    const cards = [
        { id: 'op100-count', name: 'OP100 Count' },
        { id: 'op90-count', name: 'OP90 Count' },
        { id: 'total-opportunities', name: 'Total Opportunities' },
        { id: 'total-value', name: 'Total Value' },
        { id: 'op100-value', name: 'OP100 Value' },
        { id: 'op90-value', name: 'OP90 Value' },
        { id: 'avg-opportunity-value', name: 'Average Opportunity Value' }
    ];
    
    cards.forEach(card => {
        const element = document.getElementById(card.id);
        if (element) {
            values[card.name] = element.textContent.trim();
        } else {
            console.warn(`Dashboard card not found: ${card.id}`);
        }
    });
    
    return values;
}

// Function to apply a filter
function applyFilter(filterId, value) {
    console.log(`Applying filter: ${filterId} = ${value}`);
    const filterElement = document.getElementById(filterId);
    if (filterElement) {
        filterElement.value = value;
        filterElement.dispatchEvent(new Event('change'));
        return true;
    } else {
        console.error(`Filter element not found: ${filterId}`);
        return false;
    }
}

// Function to compare dashboard values
function compareDashboardValues(before, after) {
    console.log('\n=== Dashboard Values Comparison ===');
    let allSame = true;
    
    for (const [key, beforeValue] of Object.entries(before)) {
        const afterValue = after[key];
        const isSame = beforeValue === afterValue;
        
        console.log(`${key}:`);
        console.log(`  Before: ${beforeValue}`);
        console.log(`  After:  ${afterValue}`);
        console.log(`  Status: ${isSame ? '✅ UNCHANGED' : '❌ CHANGED'}`);
        
        if (!isSame) {
            allSame = false;
        }
    }
    
    console.log(`\n=== Overall Result: ${allSame ? '✅ PASS - Dashboard cards are independent' : '❌ FAIL - Dashboard cards changed with filter'} ===`);
    return allSame;
}

// Main test function
async function testDashboardIndependence() {
    console.log('Starting dashboard independence test...\n');
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Capture initial dashboard values
    console.log('1. Capturing initial dashboard values...');
    const initialValues = captureDashboardValues();
    console.log('Initial values captured:', initialValues);
    
    // Apply account manager filter
    console.log('\n2. Applying account manager filter...');
    const filterApplied = applyFilter('accountMgrFilter', 'John Smith'); // Change to an actual account manager name
    
    if (!filterApplied) {
        console.error('Failed to apply filter. Test aborted.');
        return false;
    }
    
    // Wait for filter to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Capture dashboard values after filter
    console.log('\n3. Capturing dashboard values after filter...');
    const filteredValues = captureDashboardValues();
    
    // Compare values
    const testPassed = compareDashboardValues(initialValues, filteredValues);
    
    // Reset filter
    console.log('\n4. Resetting filter...');
    applyFilter('accountMgrFilter', 'all');
    
    return testPassed;
}

// Run the test
testDashboardIndependence()
    .then(result => {
        console.log(`\n=== Test ${result ? 'PASSED' : 'FAILED'} ===`);
    })
    .catch(error => {
        console.error('Test error:', error);
    });
