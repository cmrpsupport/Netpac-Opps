/**
 * Manual Trigger for Weekly Snapshot
 * Run this script to immediately create a weekly snapshot in production
 *
 * Usage: node trigger_weekly_snapshot_now.js
 */

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function triggerWeeklySnapshot() {
    console.log('🔄 Manual Weekly Snapshot Trigger');
    console.log('================================\n');

    // Get auth token from user
    rl.question('Please paste your auth token (from browser localStorage): ', async (token) => {
        if (!token || token.trim() === '') {
            console.error('❌ Error: Auth token is required');
            rl.close();
            process.exit(1);
        }

        const API_URL = 'https://cmrp-opps-backend.onrender.com';
        const endpoint = `${API_URL}/api/snapshots/business/weekly-report`;

        console.log('\n📡 Triggering weekly snapshot...');
        console.log(`Endpoint: ${endpoint}\n`);

        try {
            const fetch = (await import('node-fetch')).default;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token.trim()}`
                },
                body: JSON.stringify({
                    description: `Manual trigger - Schedule change to Monday 1:30 PM (${new Date().toISOString()})`
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log('✅ SUCCESS! Weekly snapshot created\n');
                console.log('📊 Results:');
                console.log('  - Total snapshots created:', data.results?.summary?.total_created || 'N/A');
                console.log('  - Account managers processed:', data.results?.summary?.account_managers_processed || 'N/A');
                console.log('  - Snapshot type:', data.results?.summary?.snapshot_type || 'weekly_president');
                console.log('  - Snapshot date:', data.results?.summary?.snapshot_date || new Date().toISOString().split('T')[0]);

                if (data.results?.errors && data.results.errors.length > 0) {
                    console.log('\n⚠️  Some errors occurred:');
                    data.results.errors.forEach(err => {
                        console.log(`  - ${err.account_manager}: ${err.error}`);
                    });
                }

                console.log('\n📝 Comparison Info:');
                console.log('  - Type:', data.comparison_info?.type);
                console.log('  - Compares to:', data.comparison_info?.compares_to);
                console.log('  - Purpose:', data.comparison_info?.purpose);

                console.log('\n✨ You can now refresh the executive dashboard to see the new baseline!');
            } else {
                console.error('❌ FAILED to create snapshot');
                console.error('Response:', JSON.stringify(data, null, 2));
            }

        } catch (error) {
            console.error('❌ ERROR:', error.message);
            if (error.cause) {
                console.error('Cause:', error.cause);
            }
        }

        rl.close();
    });
}

// Instructions for getting the token
console.log('\n📋 Instructions:');
console.log('1. Open your browser and go to: https://cmrp-opps-management.onrender.com');
console.log('2. Make sure you are logged in');
console.log('3. Open Developer Tools (F12)');
console.log('4. Go to Console tab');
console.log('5. Type: localStorage.getItem("authToken")');
console.log('6. Copy the token (without quotes)');
console.log('7. Paste it below\n');

triggerWeeklySnapshot();
