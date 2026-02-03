// Database Diagnostic Script
// Check if production database has all required tables and data

const { Pool } = require('pg');
require('dotenv').config();

// Use production database URL
const PRODUCTION_DB_URL = 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require';

const pool = new Pool({
  connectionString: PRODUCTION_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
  console.log('=== DATABASE DIAGNOSTIC ===');
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'From ENV' : 'Hardcoded'}`);
  
  try {
    // Test basic connectivity
    console.log('\n1. Testing database connection...');
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully');
    console.log(`   Current time: ${testResult.rows[0].current_time}`);
    
    // Check required tables
    console.log('\n2. Checking required tables...');
    const requiredTables = ['users', 'opps_monitoring', 'proposal_schedule', 'dashboard_snapshots', 'account_manager_snapshots'];
    
    for (const table of requiredTables) {
      try {
        const result = await pool.query(`
          SELECT table_name, table_type 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        `, [table]);
        
        if (result.rows.length > 0) {
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`✅ ${table} exists (${countResult.rows[0].count} rows)`);
        } else {
          console.log(`❌ ${table} MISSING`);
        }
      } catch (error) {
        console.log(`❌ ${table} ERROR: ${error.message}`);
      }
    }
    
    // Check users table structure
    console.log('\n3. Checking users table structure...');
    try {
      const userColumns = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position
      `);
      
      if (userColumns.rows.length > 0) {
        console.log('   Users table columns:');
        userColumns.rows.forEach(col => {
          console.log(`   - ${col.column_name} (${col.data_type})`);
        });
        
        // Check for admin users
        const adminUsers = await pool.query(`
          SELECT id, email, name, account_type, roles 
          FROM users 
          WHERE account_type = 'Admin' OR 'Admin' = ANY(roles)
          LIMIT 5
        `);
        console.log(`   Admin users found: ${adminUsers.rows.length}`);
        adminUsers.rows.forEach(user => {
          console.log(`   - ${user.email} (${user.account_type}, roles: ${JSON.stringify(user.roles)})`);
        });
      } else {
        console.log('   No users table found or no columns');
      }
    } catch (error) {
      console.log(`   Error checking users: ${error.message}`);
    }
    
    // Check opps_monitoring table
    console.log('\n4. Checking opps_monitoring table...');
    try {
      const oppsResult = await pool.query('SELECT COUNT(*) as count FROM opps_monitoring LIMIT 1');
      console.log(`✅ opps_monitoring has ${oppsResult.rows[0].count} records`);
      
      // Check for required columns
      const oppsColumns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'opps_monitoring' 
        AND column_name IN ('uid', 'proposal_status', 'pic', 'account_mgr', 'project_name')
      `);
      
      console.log('   Key columns present:', oppsColumns.rows.map(r => r.column_name).join(', '));
    } catch (error) {
      console.log(`❌ opps_monitoring error: ${error.message}`);
    }
    
    // Test API-like queries
    console.log('\n5. Testing API-like queries...');
    
    try {
      // Test proposal workbench query
      const proposalsResult = await pool.query(`
        SELECT uid, project_name, client, pic, account_mgr, proposal_status 
        FROM opps_monitoring 
        WHERE proposal_status IS NOT NULL 
        LIMIT 5
      `);
      console.log(`✅ Proposal workbench query returned ${proposalsResult.rows.length} records`);
    } catch (error) {
      console.log(`❌ Proposal workbench query failed: ${error.message}`);
    }
    
    try {
      // Test users query  
      const usersResult = await pool.query(`
        SELECT id, email, name, roles, account_type 
        FROM users 
        LIMIT 5
      `);
      console.log(`✅ Users query returned ${usersResult.rows.length} records`);
    } catch (error) {
      console.log(`❌ Users query failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Database diagnostic failed:', error.message);
  } finally {
    await pool.end();
  }
}

// Run diagnostic
checkDatabase().catch(console.error);