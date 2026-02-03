// Quick script to update snapshots with correct data
// Run this with: node update_snapshots_endpoint.js

const { Pool } = require('pg');

// Database configuration (uses environment variables like your server.js)
require('dotenv').config(); // Load environment variables

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateSnapshots() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Updating snapshots with correct data...');
        
        // Update Weekly Snapshot (June 11 data)
        console.log('📅 Updating weekly snapshot...');
        await client.query(`
            UPDATE dashboard_snapshots 
            SET 
                total_opportunities = 428,
                submitted_count = 270,
                submitted_amount = 988982107.40,
                op100_count = 38,
                op100_amount = 59237774.52,
                op90_count = 27,
                op90_amount = 48294418.13,
                op60_count = 41,
                op60_amount = 166184874.70,
                op30_count = 120,
                op30_amount = 661162427.75,
                lost_count = 31,
                lost_amount = 59020750.46,
                inactive_count = 8,
                ongoing_count = 19,
                pending_count = 29,
                declined_count = 109,
                revised_count = 104,
                saved_date = CURRENT_TIMESTAMP
            WHERE snapshot_type = 'weekly'
            AND id = (
                SELECT id FROM dashboard_snapshots 
                WHERE snapshot_type = 'weekly' 
                ORDER BY saved_date DESC 
                LIMIT 1
            )
        `);
        
        // Update Monthly Snapshot
        console.log('📅 Updating monthly snapshot...');
        await client.query(`
            UPDATE dashboard_snapshots 
            SET 
                total_opportunities = 409,
                submitted_count = 271,
                submitted_amount = 939235994.10,
                op100_count = 34,
                op100_amount = 56135271.31,
                op90_count = 29,
                op90_amount = 43222843.87,
                op60_count = 41,
                op60_amount = 188367129.90,
                op30_count = 108,
                op30_amount = 620682214.65,
                lost_count = 31,
                lost_amount = 52993964.75,
                inactive_count = 7,
                ongoing_count = 22,
                pending_count = 27,
                declined_count = 102,
                revised_count = 99,
                saved_date = CURRENT_TIMESTAMP
            WHERE snapshot_type = 'monthly'
            AND id = (
                SELECT id FROM dashboard_snapshots 
                WHERE snapshot_type = 'monthly' 
                ORDER BY saved_date DESC 
                LIMIT 1
            )
        `);
        
        // Verify the updates
        console.log('✅ Verifying updates...');
        const result = await client.query(`
            SELECT 
                snapshot_type,
                op100_count,
                op100_amount,
                total_opportunities,
                saved_date
            FROM dashboard_snapshots 
            WHERE snapshot_type IN ('weekly', 'monthly')
            ORDER BY snapshot_type, saved_date DESC
            LIMIT 2
        `);
        
        console.log('📊 Updated snapshot data:');
        result.rows.forEach(row => {
            console.log(`${row.snapshot_type}: OP100 = ₱${row.op100_amount.toLocaleString()} (${row.op100_count} count)`);
        });
        
        console.log('🎉 Snapshots updated successfully!');
        console.log('🔄 Refresh your executive dashboard to see the corrected OP100 deltas.');
        
    } catch (error) {
        console.error('❌ Error updating snapshots:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

updateSnapshots(); 