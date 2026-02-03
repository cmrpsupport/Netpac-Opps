const { Pool } = require('pg');

const connectionString = 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
});

async function updateSubmittedAmount() {
  const client = await pool.connect();
  
  try {
    console.log('Updating submitted amount to this week\'s amount...\n');
    
    // Update the submitted amount to this week's amount
    const thisWeekAmount = 1447313507.86;
    
    const updateResult = await client.query(`
      UPDATE dashboard_snapshots 
      SET submitted_amount = $1
      WHERE snapshot_type = 'weekly'
      RETURNING submitted_count, submitted_amount;
    `, [thisWeekAmount]);
    
    if (updateResult.rows.length > 0) {
      const updated = updateResult.rows[0];
      console.log('Successfully updated weekly submitted amount:');
      console.log(`- Submitted count: ${updated.submitted_count}`);
      console.log(`- Submitted amount: ₱${parseFloat(updated.submitted_amount).toLocaleString()}`);
    }
    
    // Show the comparison
    const actualAmount = 1492135581.64; // From database
    const weeklyAmount = thisWeekAmount;
    const difference = actualAmount - weeklyAmount;
    
    console.log('\nDashboard comparison:');
    console.log(`- Actual database amount: ₱${actualAmount.toLocaleString()}`);
    console.log(`- Weekly snapshot amount: ₱${weeklyAmount.toLocaleString()}`);
    console.log(`- Difference: ₱${difference.toLocaleString()}`);
    
    console.log('\nFor reference:');
    console.log(`- This week: ₱${thisWeekAmount.toLocaleString()}`);
    console.log('- Last week: ₱429,914,307.84');
    
  } catch (error) {
    console.error('Error updating submitted amount:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateSubmittedAmount()
  .then(() => {
    console.log('\nSubmitted amount update completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Update failed:', error);
    process.exit(1);
  });