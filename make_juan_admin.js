const { Pool } = require('pg');

// Local development database connection
const DATABASE_URL = "postgresql://localhost:5432/cmrp_opps_db";

const pool = new Pool({
    connectionString: DATABASE_URL,
});

async function makeJuanAdmin() {
    console.log('🔧 Making Juan Ortiz an admin user...');
    
    try {
        const client = await pool.connect();
        console.log('✅ Connected to local development database');
        
        // Update Juan to be an admin
        const updateQuery = `
            UPDATE users 
            SET 
                account_type = 'Admin',
                roles = ARRAY['Admin', 'DS', 'SE']::text[]
            WHERE email = 'juan.ortiz@cmrpautomation.com'
            RETURNING id, email, name, roles, account_type;
        `;
        
        const result = await client.query(updateQuery);
        
        if (result.rows.length > 0) {
            console.log('✅ Successfully updated Juan to Admin!');
            console.table(result.rows);
        } else {
            console.log('❌ No user found with that email');
        }
        
        // Verify all admin users
        const adminQuery = `
            SELECT id, email, name, roles, account_type 
            FROM users 
            WHERE account_type = 'Admin'
            ORDER BY created_at ASC;
        `;
        
        const adminResult = await client.query(adminQuery);
        console.log('\n👑 All admin users:');
        console.table(adminResult.rows);
        
        client.release();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

makeJuanAdmin();