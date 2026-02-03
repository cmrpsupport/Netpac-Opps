// Add missing last_login_at column to users table
const { Pool } = require('pg');
require('dotenv').config();

const PRODUCTION_DB_URL = 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require';

const pool = new Pool({
  connectionString: PRODUCTION_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function addLastLoginColumn() {
  console.log('=== ADDING LAST_LOGIN_AT COLUMN ===');
  
  try {
    // Check if last_login_at column exists
    console.log('1. Checking if last_login_at column exists...');
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'last_login_at'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ last_login_at column already exists');
      return;
    }
    
    console.log('❌ last_login_at column missing, adding it...');
    
    // Add last_login_at column
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE
    `);
    console.log('✅ Added last_login_at column');
    
    // Create index for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at)
    `);
    console.log('✅ Added index on last_login_at');
    
    // Test the users API query
    console.log('2. Testing users API query...');
    const testResult = await pool.query(`
      SELECT id, email, name, is_verified, roles, account_type, last_login_at 
      FROM users 
      ORDER BY email ASC 
      LIMIT 3
    `);
    
    console.log(`✅ Users API query successful - returned ${testResult.rows.length} users`);
    console.log('   Sample data:');
    testResult.rows.forEach(user => {
      console.log(`   - ${user.email}: ${user.account_type} (last_login: ${user.last_login_at || 'never'})`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
addLastLoginColumn().catch(console.error);