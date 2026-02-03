const { Pool } = require('pg');

const connectionString = 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
});

async function forceManualSnapshot() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Delete any existing snapshot for this type and date
    const deleteQuery = `
      DELETE FROM dashboard_snapshots
      WHERE snapshot_type = 'monthly' AND snapshot_date = '2025-08-01';
    `;
    const deleteResult = await client.query(deleteQuery);
    console.log(`Deleted ${deleteResult.rowCount} existing snapshot(s) for the target date.`);

    // Step 2: Insert the new snapshot data
    const insertQuery = `
      INSERT INTO dashboard_snapshots (
          snapshot_type, snapshot_date, description, created_by, is_manual,
          total_opportunities,
          submitted_count, submitted_amount,
          op100_count, op100_amount,
          op90_count, op90_amount,
          op60_count, op60_amount,
          op30_count, op30_amount,
          lost_count, lost_amount,
          inactive_count,
          ongoing_count,
          pending_count,
          declined_count,
          revised_count
      ) VALUES (
          'monthly', '2025-08-01', 'August 1', 'Manual Update via Gemini CLI', TRUE,
          534, 333, 1432027272.55,
          67, 67327016.64, 25, 49813512.69,
          42, 137709494.36, 136, 972753811.26,
          42, 116913075.78, 27, 29, 25, 145, 266
      ) RETURNING id, snapshot_date;
    `;
    const insertResult = await client.query(insertQuery);

    await client.query('COMMIT');

    if (insertResult.rows.length > 0) {
      console.log('Successfully created manual snapshot for August 1, 2025.');
      console.log('Snapshot ID:', insertResult.rows[0].id);
    } else {
      throw new Error('Insert query did not return the expected row.');
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating manual snapshot:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

forceManualSnapshot();