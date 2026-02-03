// Quick test to verify filter mappings work
console.log('Testing filter mappings...');

// Test data that matches our database findings
const testData = [
    { status: 'On-Going', decision: 'GO', opp_status: 'OP30', opp_name: 'Test Project 1' },
    { status: 'Not Yet Started', decision: 'PENDING', opp_status: 'OP30', opp_name: 'Test Project 2' },
    { status: 'Submitted', decision: 'PENDING', opp_status: 'OP60', opp_name: 'Test Project 3' },
    { status: 'On-Going', decision: 'GO', opp_status: 'OP100', opp_name: 'Test Project 4' }
];

// Simulate the filter logic from app.js
function testFilter(filterValue, data) {
    console.log(`\nTesting filter: ${filterValue}`);
    
    return data.filter(opp => {
        const oppStatus = (opp.opp_status || '').toLowerCase();
        const currentStatus = (opp.status || '').toLowerCase();
        const decision = (opp.decision || '').toLowerCase();
        
        switch (filterValue) {
            case 'ongoing':
                return currentStatus === 'on-going';
            case 'not_yet_started':
                return currentStatus === 'not yet started';
            case 'no_decision':
                return decision === 'pending';
            case 'op100':
                return oppStatus === 'op100';
            case 'op60':
                return oppStatus === 'op60';
            case 'op30':
                return oppStatus === 'op30';
            default:
                return true;
        }
    });
}

// Test each filter
const filters = ['ongoing', 'not_yet_started', 'no_decision', 'op100', 'op60', 'op30'];

filters.forEach(filter => {
    const results = testFilter(filter, testData);
    console.log(`Filter "${filter}" matches:`, results.map(r => r.opp_name));
});

console.log('\nFilter test completed!');
