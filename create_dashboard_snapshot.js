const { Pool } = require('pg');

const connectionString = 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
});

// Aug 20 data for dashboard_snapshots table
const snapshotData = {
  snapshot_type: 'weekly',
  total_opportunities: 582,
  submitted_count: 377,
  submitted_amount: 1519270146.48,
  op100_count: 72,
  op100_amount: 77201539.80,
  op90_count: 22,
  op90_amount: 40729015.58,
  op60_count: 48,
  op60_amount: 237549182.43,
  op30_count: 159,
  op30_amount: 836643163.78,
  lost_count: 49,
  lost_amount: 165740700.88,
  inactive_count: 30,
  ongoing_count: 30,
  pending_count: 23,
  declined_count: 150,
  revised_count: 300
};

async function createDashboardSnapshot() {
  const client = await pool.connect();
  
  try {
    console.log('Creating/updating dashboard snapshot for Aug 20 data...');
    
    const query = `
        INSERT INTO dashboard_snapshots (
            snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
            op100_count, op100_amount, op90_count, op90_amount, 
            op60_count, op60_amount, op30_count, op30_amount,
            lost_count, lost_amount, inactive_count, ongoing_count,
            pending_count, declined_count, revised_count, created_by, description
        ) VALUES (
            $1, '2025-08-20', $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, 'system', 'Aug 20 weekly snapshot data'
        ) 
        ON CONFLICT (snapshot_type) 
        DO UPDATE SET
            snapshot_date = '2025-08-20',
            total_opportunities = EXCLUDED.total_opportunities,
            submitted_count = EXCLUDED.submitted_count,
            submitted_amount = EXCLUDED.submitted_amount,
            op100_count = EXCLUDED.op100_count,
            op100_amount = EXCLUDED.op100_amount,
            op90_count = EXCLUDED.op90_count,
            op90_amount = EXCLUDED.op90_amount,
            op60_count = EXCLUDED.op60_count,
            op60_amount = EXCLUDED.op60_amount,
            op30_count = EXCLUDED.op30_count,
            op30_amount = EXCLUDED.op30_amount,
            lost_count = EXCLUDED.lost_count,
            lost_amount = EXCLUDED.lost_amount,
            inactive_count = EXCLUDED.inactive_count,
            ongoing_count = EXCLUDED.ongoing_count,
            pending_count = EXCLUDED.pending_count,
            declined_count = EXCLUDED.declined_count,
            revised_count = EXCLUDED.revised_count,
            created_by = EXCLUDED.created_by,
            description = EXCLUDED.description,
            saved_date = CURRENT_TIMESTAMP
        RETURNING id, snapshot_date, saved_date
    `;

    const values = [
        snapshotData.snapshot_type,
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
        snapshotData.revised_count
    ];

    const result = await client.query(query, values);
    
    console.log('SUCCESS! Dashboard snapshot created/updated:');
    console.log('ID:', result.rows[0].id);
    console.log('Snapshot date:', result.rows[0].snapshot_date);
    console.log('Saved at:', result.rows[0].saved_date);
    
    // Verify the data
    const verifyQuery = `SELECT * FROM dashboard_snapshots WHERE snapshot_type = 'weekly' ORDER BY saved_date DESC LIMIT 1`;
    const verifyResult = await client.query(verifyQuery);
    
    console.log('\nVerification - Dashboard snapshot data:');
    const snapshot = verifyResult.rows[0];
    console.log(`Total Opportunities: ${snapshot.total_opportunities}`);
    console.log(`Submitted: ${snapshot.submitted_count} (₱${parseFloat(snapshot.submitted_amount).toLocaleString()})`);
    console.log(`OP100: ${snapshot.op100_count} (₱${parseFloat(snapshot.op100_amount).toLocaleString()})`);
    console.log(`OP90: ${snapshot.op90_count} (₱${parseFloat(snapshot.op90_amount).toLocaleString()})`);
    console.log(`OP60: ${snapshot.op60_count} (₱${parseFloat(snapshot.op60_amount).toLocaleString()})`);
    console.log(`OP30: ${snapshot.op30_count} (₱${parseFloat(snapshot.op30_amount).toLocaleString()})`);
    console.log(`LOST: ${snapshot.lost_count} (₱${parseFloat(snapshot.lost_amount).toLocaleString()})`);
    console.log(`Inactive: ${snapshot.inactive_count}`);
    console.log(`Ongoing: ${snapshot.ongoing_count}`);
    console.log(`Pending: ${snapshot.pending_count}`);
    console.log(`Declined: ${snapshot.declined_count}`);
    console.log(`Revised: ${snapshot.revised_count}`);
    
  } catch (error) {
    console.error('Error creating dashboard snapshot:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createDashboardSnapshot()
  .then(() => {
    console.log('\nDashboard snapshot creation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Dashboard snapshot creation failed:', error);
    process.exit(1);
  });
