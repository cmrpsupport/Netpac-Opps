// Direct database update for August 1 snapshot
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
    connectionString: 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require'
});

async function updateAugust1Snapshot() {
    const client = await pool.connect();
    
    try {
        // Convert currency strings to numbers (remove commas and peso sign)
        const parseAmount = (str) => {
            if (!str || str === '') return 0;
            return parseFloat(str.replace(/[₱,]/g, '')) || 0;
        };

        // August 1 snapshot data (matching table schema)
        const snapshotData = {
            snapshot_date: '2024-08-01',
            description: 'August 1 snapshot - Manual update',
            total_opportunities: 534,
            submitted_count: 333,
            submitted_amount: parseAmount('₱1,432,027,272.55'), // 1432027272.55
            op100_count: 67,
            op100_amount: parseAmount('₱67,327,016.64'),       // 67327016.64
            op90_count: 25,
            op90_amount: parseAmount('₱49,813,512.69'),        // 49813512.69
            op60_count: 42,
            op60_amount: parseAmount('₱137,709,494.36'),       // 137709494.36
            op30_count: 136,
            op30_amount: parseAmount('₱972,753,811.26'),       // 972753811.26
            lost_count: 42,
            lost_amount: parseAmount('₱116,913,075.78'),       // 116913075.78
            inactive_count: 27,
            ongoing_count: 29,
            pending_count: 25,
            declined_count: 145,
            revised_count: 266,
            is_manual: true
        };

        console.log('Updating August 1 snapshot with data:');
        console.log(JSON.stringify(snapshotData, null, 2));

        // Check if snapshot exists for this date
        const checkQuery = `
            SELECT id FROM custom_snapshots 
            WHERE snapshot_date = $1
        `;
        
        const existingResult = await client.query(checkQuery, [snapshotData.snapshot_date]);
        
        if (existingResult.rows.length > 0) {
            // Update existing snapshot
            const updateQuery = `
                UPDATE custom_snapshots SET 
                    description = $2,
                    total_opportunities = $3,
                    submitted_count = $4,
                    submitted_amount = $5,
                    op100_count = $6,
                    op100_amount = $7,
                    op90_count = $8,
                    op90_amount = $9,
                    op60_count = $10,
                    op60_amount = $11,
                    op30_count = $12,
                    op30_amount = $13,
                    lost_count = $14,
                    lost_amount = $15,
                    inactive_count = $16,
                    ongoing_count = $17,
                    pending_count = $18,
                    declined_count = $19,
                    revised_count = $20,
                    is_manual = $21,
                    updated_at = CURRENT_TIMESTAMP
                WHERE snapshot_date = $1
                RETURNING *
            `;
            
            const result = await client.query(updateQuery, [
                snapshotData.snapshot_date,
                snapshotData.description,
                snapshotData.total_opportunities,
                snapshotData.submitted_count,
                snapshotData.submitted_amount,
                snapshotData.op100_count,
                snapshotData.op100_amount,
                snapshotData.op90_count,
                snapshotData.op90_amount,
                snapshotData.op60_count,
                snapshotData.op60_amount,
                snapshotData.op30_count,
                snapshotData.op30_amount,
                snapshotData.lost_count,
                snapshotData.lost_amount,
                snapshotData.inactive_count,
                snapshotData.ongoing_count,
                snapshotData.pending_count,
                snapshotData.declined_count,
                snapshotData.revised_count,
                snapshotData.is_manual
            ]);
            
            console.log('✅ Successfully UPDATED August 1 snapshot:', result.rows[0]);
        } else {
            // Insert new snapshot
            const insertQuery = `
                INSERT INTO custom_snapshots (
                    snapshot_date, description, total_opportunities, submitted_count, submitted_amount,
                    op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
                    op30_count, op30_amount, lost_count, lost_amount, inactive_count,
                    ongoing_count, pending_count, declined_count, revised_count, is_manual,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                    $17, $18, $19, $20, $21, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING *
            `;
            
            const result = await client.query(insertQuery, [
                snapshotData.snapshot_date,
                snapshotData.description,
                snapshotData.total_opportunities,
                snapshotData.submitted_count,
                snapshotData.submitted_amount,
                snapshotData.op100_count,
                snapshotData.op100_amount,
                snapshotData.op90_count,
                snapshotData.op90_amount,
                snapshotData.op60_count,
                snapshotData.op60_amount,
                snapshotData.op30_count,
                snapshotData.op30_amount,
                snapshotData.lost_count,
                snapshotData.lost_amount,
                snapshotData.inactive_count,
                snapshotData.ongoing_count,
                snapshotData.pending_count,
                snapshotData.declined_count,
                snapshotData.revised_count,
                snapshotData.is_manual
            ]);
            
            console.log('✅ Successfully CREATED August 1 snapshot:', result.rows[0]);
        }

    } catch (error) {
        console.error('❌ Error updating August 1 snapshot:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the update
updateAugust1Snapshot()
    .then(() => {
        console.log('🎉 August 1 snapshot update completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Failed to update August 1 snapshot:', error);
        process.exit(1);
    });