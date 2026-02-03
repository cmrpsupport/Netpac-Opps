const { Pool } = require('pg');

const connectionString = 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
});

async function updateDashboardSnapshots() {
  const client = await pool.connect();
  
  try {
    console.log('Updating dashboard_snapshots table with new weekly data...');
    
    // First, let's see if there's already a weekly snapshot
    const existingWeekly = await client.query(`
      SELECT * FROM dashboard_snapshots WHERE snapshot_type = 'weekly' ORDER BY created_at DESC LIMIT 1
    `);
    
    if (existingWeekly.rows.length > 0) {
      console.log('Found existing weekly snapshot:', existingWeekly.rows[0]);
    }
    
    // Calculate total opportunities
    const totalOpportunities = 330 + 64 + 26 + 42 + 132 + 44 + 26 + 29 + 24 + 145 + 263;
    
    // Prepare the new weekly snapshot data
    const weeklySnapshotData = {
      snapshot_type: 'weekly',
      total_opportunities: totalOpportunities,
      submitted_count: 330,
      submitted_amount: 429914307.84,
      op100_count: 64,
      op100_amount: 72832918.71,
      op90_count: 26,
      op90_amount: 42819699.31,
      op60_count: 42,
      op60_amount: 138696192.85,
      op30_count: 132,
      op30_amount: 967778708.22,
      lost_count: 44,
      lost_amount: 119235266.80,
      inactive_count: 26,
      ongoing_count: 29,
      pending_count: 24,
      declined_count: 145,
      revised_count: 263,
      saved_date: new Date(),
      created_at: new Date()
    };
    
    // Delete existing weekly snapshot if it exists
    const deleteResult = await client.query(`
      DELETE FROM dashboard_snapshots WHERE snapshot_type = 'weekly'
    `);
    
    if (deleteResult.rowCount > 0) {
      console.log(`Deleted ${deleteResult.rowCount} existing weekly snapshot(s)`);
    }
    
    // Insert new weekly snapshot
    const insertQuery = `
      INSERT INTO dashboard_snapshots (
        snapshot_type, total_opportunities, submitted_count, submitted_amount,
        op100_count, op100_amount, op90_count, op90_amount, 
        op60_count, op60_amount, op30_count, op30_amount,
        lost_count, lost_amount, inactive_count, ongoing_count,
        pending_count, declined_count, revised_count, saved_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *;
    `;
    
    const values = [
      weeklySnapshotData.snapshot_type,
      weeklySnapshotData.total_opportunities,
      weeklySnapshotData.submitted_count,
      weeklySnapshotData.submitted_amount,
      weeklySnapshotData.op100_count,
      weeklySnapshotData.op100_amount,
      weeklySnapshotData.op90_count,
      weeklySnapshotData.op90_amount,
      weeklySnapshotData.op60_count,
      weeklySnapshotData.op60_amount,
      weeklySnapshotData.op30_count,
      weeklySnapshotData.op30_amount,
      weeklySnapshotData.lost_count,
      weeklySnapshotData.lost_amount,
      weeklySnapshotData.inactive_count,
      weeklySnapshotData.ongoing_count,
      weeklySnapshotData.pending_count,
      weeklySnapshotData.declined_count,
      weeklySnapshotData.revised_count,
      weeklySnapshotData.saved_date,
      weeklySnapshotData.created_at
    ];
    
    const result = await client.query(insertQuery, values);
    
    console.log('Successfully inserted new weekly snapshot into dashboard_snapshots');
    console.log('New weekly snapshot:', result.rows[0]);
    
    // Now delete the weekly_snapshot table we created earlier
    console.log('\nDropping the weekly_snapshot table...');
    await client.query('DROP TABLE IF EXISTS weekly_snapshot');
    console.log('Successfully deleted the weekly_snapshot table');
    
    // Verify the update
    console.log('\nVerifying dashboard_snapshots table...');
    const verification = await client.query(`
      SELECT snapshot_type, total_opportunities, submitted_count, submitted_amount, 
             op100_count, op100_amount, op90_count, op90_amount, op60_count, op60_amount,
             op30_count, op30_amount, lost_count, lost_amount, inactive_count,
             ongoing_count, pending_count, declined_count, revised_count, saved_date
      FROM dashboard_snapshots 
      ORDER BY created_at DESC;
    `);
    
    console.log('Current dashboard snapshots:');
    verification.rows.forEach(row => {
      console.log(`${row.snapshot_type.toUpperCase()} - Total: ${row.total_opportunities}, Submitted: ${row.submitted_count} (₱${parseFloat(row.submitted_amount || 0).toLocaleString()})`);
    });
    
  } catch (error) {
    console.error('Error updating dashboard snapshots:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateDashboardSnapshots()
  .then(() => {
    console.log('\nDashboard snapshots update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Dashboard snapshots update failed:', error);
    process.exit(1);
  });