// Script to upload cleaned CSV to local database
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const csv = require('fast-csv');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://reuelrivera@localhost:5432/opps_management',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Set search path for consistency
pool.on('connect', (client) => {
    client.query('SET search_path TO public');
});

async function uploadCleanedCSVToDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting cleaned CSV upload process...');
        
        // Step 1: Delete all existing data from opps_monitoring table
        console.log('🗑️  Deleting existing data from opps_monitoring table...');
        await client.query('DELETE FROM opps_monitoring');
        console.log('✅ Existing data deleted successfully');
        
        // Step 2: Upload cleaned CSV data
        console.log('📤 Uploading cleaned CSV data...');
        
        let rowCount = 0;
        let errorCount = 0;
        const errors = [];
        
        return new Promise((resolve, reject) => {
            fs.createReadStream('formatted_opps_monitoring_cleaned.csv')
                .pipe(csv.parse({ headers: false, ignoreEmpty: true, trim: true }))
                .on('error', error => {
                    console.error('❌ CSV parse error:', error);
                    reject(error);
                })
                .on('data', async (row) => {
                    try {
                        rowCount++;
                        
                        // Clean the row data
                        const cleanedRow = row.map(cell => {
                            if (cell === '' || cell === 'NULL' || cell === 'null') {
                                return null;
                            }
                            return cell;
                        });
                        
                        // Verify we have exactly 31 columns
                        if (cleanedRow.length !== 31) {
                            console.log(`⚠️  Row ${rowCount}: Expected 31 columns, got ${cleanedRow.length}`);
                            errorCount++;
                            errors.push({ row: rowCount, data: cleanedRow, issue: 'Column count mismatch' });
                            return;
                        }
                        
                        // Insert the row
                        const query = `
                            INSERT INTO opps_monitoring (
                                id, project_name, client, status, probability, 
                                submitted_amount, submitted_date, decision_date, 
                                account_manager, proposal_engineer, technical_lead, 
                                win_loss_reason, notes, created_at, updated_at,
                                opportunity_type, industry, region, 
                                estimated_value, actual_value, 
                                start_date, end_date, 
                                contact_person, contact_email, contact_phone,
                                competitor_analysis, risk_assessment, 
                                resource_requirements, timeline, 
                                budget_allocation, strategic_importance
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                                     $11, $12, $13, $14, $15, $16, $17, $18, 
                                     $19, $20, $21, $22, $23, $24, $25, $26, 
                                     $27, $28, $29, $30, $31)
                        `;
                        
                        await client.query(query, cleanedRow);
                        
                        if (rowCount % 50 === 0) {
                            console.log(`📊 Processed ${rowCount} rows...`);
                        }
                        
                    } catch (error) {
                        errorCount++;
                        errors.push({ 
                            row: rowCount, 
                            data: row, 
                            issue: error.message 
                        });
                        console.log(`❌ Row ${rowCount} error: ${error.message}`);
                    }
                })
                .on('end', async () => {
                    console.log(`\n📊 Upload complete!`);
                    console.log(`   Total rows processed: ${rowCount}`);
                    console.log(`   Successful inserts: ${rowCount - errorCount}`);
                    console.log(`   Errors: ${errorCount}`);
                    
                    if (errors.length > 0) {
                        console.log('\n❌ Errors encountered:');
                        errors.forEach(error => {
                            console.log(`   Row ${error.row}: ${error.issue}`);
                        });
                    }
                    
                    // Step 3: Verify the upload
                    console.log('\n🔍 Verifying upload...');
                    const result = await client.query('SELECT COUNT(*) FROM opps_monitoring');
                    const count = parseInt(result.rows[0].count);
                    console.log(`✅ Database now contains ${count} records`);
                    
                    if (count === rowCount - errorCount) {
                        console.log('🎉 Upload verification successful!');
                    } else {
                        console.log('⚠️  Upload verification failed - count mismatch');
                    }
                    
                    resolve();
                });
        });
        
    } catch (error) {
        console.error('💥 Upload failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the upload
uploadCleanedCSVToDatabase()
    .then(() => {
        console.log('\n🎉 Cleaned CSV upload completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Upload failed:', error);
        process.exit(1);
    }); 