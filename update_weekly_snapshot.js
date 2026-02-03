const { Pool } = require('pg');

const connectionString = 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
});

// Weekly snapshot data for Aug 20, 2025
const weeklyData = [
  { status: 'Total Opps', count: 582, amount: null },
  { status: 'Submitted', count: 377, amount: 1519270146.48 },
  { status: 'OP100', count: 72, amount: 77201539.80 },
  { status: 'OP90', count: 22, amount: 40729015.58 },
  { status: 'OP60', count: 48, amount: 237549182.43 },
  { status: 'OP30', count: 159, amount: 836643163.78 },
  { status: 'LOST', count: 49, amount: 165740700.88 },
  { status: 'Inactive', count: 30, amount: 204389497.17 },
  { status: 'On-going', count: 30, amount: null },
  { status: 'Pending', count: 23, amount: null },
  { status: 'Decline', count: 150, amount: null },
  { status: 'Revised', count: 300, amount: null }
];

// Account Manager specific data for Aug 20, 2025
const accountManagerData = {
  'NSG': {
    total_opps: 143,
    submitted_count: 109, submitted_amount: 401727297.74,
    op100_count: 26, op100_amount: 8867961.36,
    op90_count: 5, op90_amount: 6085393.79,
    op60_count: 5, op60_amount: 2029248.48,
    op30_count: 68, op30_amount: 384538602.69,
    lost_count: 0, lost_amount: 0.00,
    inactive_count: 4, inactive_amount: 206091.42,
    ongoing_count: 0,
    pending_count: 0,
    declined_count: 32,
    revised_count: null
  },
  'CBD': {
    total_opps: 123,
    submitted_count: 86, submitted_amount: 418714871.68,
    op100_count: 16, op100_amount: 44217281.77,
    op90_count: 1, op90_amount: 1160012.94,
    op60_count: 7, op60_amount: 12052786.48,
    op30_count: 37, op30_amount: 187115216.11,
    lost_count: 10, lost_amount: 43686270.04,
    inactive_count: 14, inactive_amount: 115626139.69,
    ongoing_count: 0,
    pending_count: 1,
    declined_count: 37,
    revised_count: null
  },
  'JMO': {
    total_opps: 188,
    submitted_count: 100, submitted_amount: 259287065.24,
    op100_count: 18, op100_amount: 12771025.19,
    op90_count: 5, op90_amount: 1783687.47,
    op60_count: 16, op60_amount: 31862573.84,
    op30_count: 23, op30_amount: 61562712.99,
    lost_count: 35, lost_amount: 115302527.36,
    inactive_count: 11, inactive_amount: 85186015.95,
    ongoing_count: 15,
    pending_count: 14,
    declined_count: 63,
    revised_count: null
  },
  'ISP': {
    total_opps: 15,
    submitted_count: 9, submitted_amount: 17830820.54,
    op100_count: 2, op100_amount: 470901.80,
    op90_count: 0, op90_amount: 0.00,
    op60_count: 5, op60_amount: 14936842.49,
    op30_count: 1, op30_amount: 643200.00,
    lost_count: 3, lost_amount: 5551919.29,
    inactive_count: 0, inactive_amount: 0.00,
    ongoing_count: 3,
    pending_count: 3,
    declined_count: 0,
    revised_count: null
  },
  'RTR': {
    total_opps: 64,
    submitted_count: 43, submitted_amount: 134933687.08,
    op100_count: 10, op100_amount: 10874369.68,
    op90_count: 7, op90_amount: 28323202.00,
    op60_count: 8, op60_amount: 18628032.44,
    op30_count: 13, op30_amount: 77423445.86,
    lost_count: 1, lost_amount: 1199984.19,
    inactive_count: 1, inactive_amount: 3371250.11,
    ongoing_count: 6,
    pending_count: 4,
    declined_count: 10,
    revised_count: null
  },
  'LOS': {
    total_opps: 36,
    submitted_count: 27, submitted_amount: 283889903.26,
    op100_count: 0, op100_amount: 0.00,
    op90_count: 4, op90_amount: 3376719.38,
    op60_count: 5, op60_amount: 155479467.07,
    op30_count: 16, op30_amount: 125033716.81,
    lost_count: 0, lost_amount: 0.00,
    inactive_count: 0, inactive_amount: 0.00,
    ongoing_count: 4,
    pending_count: 1,
    declined_count: 4,
    revised_count: null
  }
};

async function updateWeeklySnapshot() {
  const client = await pool.connect();
  
  try {
    console.log('Starting weekly snapshot update...');
    
    // Check if weekly_snapshot table exists, if not create it
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_snapshot (
        id SERIAL PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        count INTEGER NOT NULL,
        amount DECIMAL(15,2),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(status)
      )
    `);
    
    console.log('Weekly snapshot table ready');
    
    // Clear existing data and insert new data
    await client.query('TRUNCATE TABLE weekly_snapshot RESTART IDENTITY');
    console.log('Cleared existing weekly snapshot data');
    
    // Insert new data
    for (const data of weeklyData) {
      const insertQuery = `
        INSERT INTO weekly_snapshot (status, count, amount) 
        VALUES ($1, $2, $3)
      `;
      
      await client.query(insertQuery, [data.status, data.count, data.amount]);
      console.log(`Inserted: ${data.status} - Count: ${data.count}, Amount: ${data.amount || 'N/A'}`);
    }
    
    console.log(`Successfully updated weekly snapshot with ${weeklyData.length} records`);
    
    // Update account manager snapshots
    console.log('\nUpdating account manager snapshots...');
    
    // Ensure account_manager_snapshots table exists with all required columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_manager_snapshots (
        id SERIAL PRIMARY KEY,
        account_manager VARCHAR(50) NOT NULL,
        snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('weekly', 'monthly')),
        total_opportunities INTEGER,
        submitted_count INTEGER,
        submitted_amount DECIMAL(15,2),
        op100_count INTEGER,
        op100_amount DECIMAL(15,2),
        op90_count INTEGER,
        op90_amount DECIMAL(15,2),
        op60_count INTEGER,
        op60_amount DECIMAL(15,2),
        op30_count INTEGER,
        op30_amount DECIMAL(15,2),
        lost_count INTEGER,
        lost_amount DECIMAL(15,2),
        inactive_count INTEGER,
        ongoing_count INTEGER,
        pending_count INTEGER,
        declined_count INTEGER,
        revised_count INTEGER,
        saved_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(account_manager, snapshot_type)
      )
    `);
    
    // Add missing columns if they don't exist
    await client.query(`
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE account_manager_snapshots ADD COLUMN declined_count INTEGER;
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
        
        BEGIN
          ALTER TABLE account_manager_snapshots ADD COLUMN revised_count INTEGER;
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists, do nothing
        END;
      END $$;
    `);

    // Update each account manager's weekly snapshot
    for (const [accountManager, data] of Object.entries(accountManagerData)) {
      const upsertQuery = `
        INSERT INTO account_manager_snapshots (
          account_manager, snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
          op100_count, op100_amount, op90_count, op90_amount, 
          op60_count, op60_amount, op30_count, op30_amount,
          lost_count, lost_amount, inactive_count, inactive_amount,
          ongoing_count, pending_count, decline_count, declined_count, revised_count, updated_at
        ) VALUES ($1, 'weekly', CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
        ON CONFLICT (account_manager, snapshot_type, snapshot_date) 
        DO UPDATE SET
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
          inactive_amount = EXCLUDED.inactive_amount,
          ongoing_count = EXCLUDED.ongoing_count,
          pending_count = EXCLUDED.pending_count,
          decline_count = EXCLUDED.decline_count,
          declined_count = EXCLUDED.declined_count,
          revised_count = EXCLUDED.revised_count,
          updated_at = EXCLUDED.updated_at
      `;
      
      await client.query(upsertQuery, [
        accountManager,
        data.total_opps,
        data.submitted_count,
        data.submitted_amount,
        data.op100_count,
        data.op100_amount,
        data.op90_count,
        data.op90_amount,
        data.op60_count,
        data.op60_amount,
        data.op30_count,
        data.op30_amount,
        data.lost_count,
        data.lost_amount,
        data.inactive_count,
        data.inactive_amount,
        data.ongoing_count,
        data.pending_count,
        data.declined_count,
        data.declined_count,
        data.revised_count
      ]);
      
      console.log(`Updated ${accountManager}: ${data.total_opps} total opps, Submitted: ₱${data.submitted_amount.toLocaleString()}`);
    }
    
    console.log(`Successfully updated account manager snapshots for ${Object.keys(accountManagerData).length} managers`);
    
    // Verify the data
    const result = await client.query('SELECT status, count, amount FROM weekly_snapshot ORDER BY id');
    console.log('\nVerification - Current weekly snapshot:');
    result.rows.forEach(row => {
      const amount = row.amount ? `₱${parseFloat(row.amount).toLocaleString()}` : 'N/A';
      console.log(`${row.status}: ${row.count} records, ${amount}`);
    });
    
    // Verify account manager data
    const amResult = await client.query(`
      SELECT account_manager, total_opportunities, submitted_count, submitted_amount 
      FROM account_manager_snapshots 
      WHERE snapshot_type = 'weekly' 
      ORDER BY account_manager
    `);
    console.log('\nVerification - Account Manager weekly snapshots:');
    amResult.rows.forEach(row => {
      const amount = row.submitted_amount ? `₱${parseFloat(row.submitted_amount).toLocaleString()}` : 'N/A';
      console.log(`${row.account_manager}: ${row.total_opportunities} opps, ${row.submitted_count} submitted (${amount})`);
    });
    
  } catch (error) {
    console.error('Error updating weekly snapshot:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateWeeklySnapshot()
  .then(() => {
    console.log('\nWeekly snapshot update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Weekly snapshot update failed:', error);
    process.exit(1);
  });