#!/usr/bin/env node

// Detailed analysis of column visibility logic
console.log('🔍 Detailed Column Visibility Analysis\n');

// This exactly mirrors the logic from app.js initializeColumnVisibility()
const defaultHiddenColumns = [
    'description', 'comments', 'uid', 'created_at', 'updated_at', 
    'encoded_date', 'A', 'C', 'R', 'U', 'D', 'rev', 'project_code',
    'sol_particulars', 'ind_particulars', 'lost_rca', 'l_particulars',
    'client_deadline', 'submitted_date', 'date_awarded_lost', 'forecast_date'
];

// More realistic sample headers that would come from the actual database
const sampleHeaders = [
    'encoded_date', 'project_name', 'client', 'solutions', 'industries', 
    'date_received', 'decision', 'account_mgr', 'pic', 'bom', 'status', 
    'margin', 'final_amt', 'opp_status', 'A', 'C', 'R', 'U', 'D', 
    'remarks_comments'
];

console.log('📋 Testing column visibility logic for each column:\n');

let visibilitySettings = {};
let visibleColumns = [];
let hiddenColumns = [];

sampleHeaders.forEach(header => {
    const shouldHide = defaultHiddenColumns.some(col => 
        header.toLowerCase().includes(col.toLowerCase())
    );
    const matchedRule = defaultHiddenColumns.find(col => 
        header.toLowerCase().includes(col.toLowerCase())
    );
    
    visibilitySettings[header] = !shouldHide;
    
    const status = shouldHide ? 'HIDDEN' : 'VISIBLE';
    const rule = matchedRule ? `(matches: ${matchedRule})` : '(no match)';
    
    console.log(`${header.padEnd(20)} -> ${status.padEnd(7)} ${rule}`);
    
    if (shouldHide) {
        hiddenColumns.push(header);
    } else {
        visibleColumns.push(header);
    }
});

console.log(`\n📊 SUMMARY:`);
console.log(`===========`);
console.log(`Total columns: ${sampleHeaders.length}`);
console.log(`Visible: ${visibleColumns.length} columns`);
console.log(`Hidden: ${hiddenColumns.length} columns`);

console.log(`\n👁️  VISIBLE COLUMNS:`);
visibleColumns.forEach(col => console.log(`  ✅ ${col}`));

console.log(`\n🙈 HIDDEN COLUMNS:`);
hiddenColumns.forEach(col => console.log(`  ❌ ${col}`));

// Check specifically for the requested columns
const requestedHiddenColumns = ['A', 'C', 'R', 'U', 'D', 'encoded_date'];
console.log(`\n🎯 REQUESTED COLUMNS CHECK:`);
console.log(`============================`);

let allGood = true;
requestedHiddenColumns.forEach(col => {
    const isHidden = hiddenColumns.includes(col);
    const status = isHidden ? '✅ HIDDEN (correct)' : '❌ VISIBLE (error)';
    console.log(`${col}: ${status}`);
    if (!isHidden) allGood = false;
});

if (allGood) {
    console.log('\n🎉 SUCCESS: All requested columns are properly hidden by default!');
} else {
    console.log('\n⚠️  WARNING: Some requested columns are not hidden.');
}

console.log('\n✅ Analysis complete.');
