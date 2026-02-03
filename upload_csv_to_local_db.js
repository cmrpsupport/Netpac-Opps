// Script to delete existing data and upload CSV to local database
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

async function uploadCSVToDatabase() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting CSV upload process...');
        
        // Step 1: Delete all existing data from opps_monitoring table
        console.log('🗑️  Deleting existing data from opps_monitoring table...');
        await client.query('DELETE FROM opps_monitoring');
        console.log('✅ All existing data deleted');
        
        // Step 2: Read and parse CSV file
        console.log('📖 Reading CSV file...');
        const csvData = [];
        
        return new Promise((resolve, reject) => {
            fs.createReadStream('formatted_opps_monitoring.csv')
                .pipe(csv.parse({ headers: false, ignoreEmpty: true, trim: true }))
                .on('error', error => {
                    console.error('❌ CSV parse error:', error);
                    reject(error);
                })
                .on('data', row => {
                    // Clean up empty strings and convert to null
                    const cleanedRow = row.map(cell => {
                        if (cell === '' || cell === 'NULL' || cell === 'null') {
                            return null;
                        }
                        return cell;
                    });
                    csvData.push(cleanedRow);
                })
                .on('end', async () => {
                    console.log(`✅ CSV parsed successfully. Found ${csvData.length} records`);
                    
                    try {
                        // Step 3: Insert data into database
                        console.log('💾 Inserting data into database...');
                        
                        // Define the columns in the correct order based on CSV structure
                        const columns = [
                            'encoded_date', 'project_name', 'project_code', 'rev', 'client',
                            'solutions', 'sol_particulars', 'industries', 'ind_particulars',
                            'date_received', 'client_deadline', 'decision', 'account_mgr',
                            'pic', 'bom', 'status', 'submitted_date', 'margin', 'final_amt',
                            'opp_status', 'date_awarded_lost', 'lost_rca', 'l_particulars',
                            'a', 'c', 'r', 'u', 'd', 'remarks_comments', 'uid', 'forecast_date'
                        ];
                        
                        let insertedCount = 0;
                        let errorCount = 0;
                        
                        for (const row of csvData) {
                            try {
                                // Prepare values in the correct order
                                const values = columns.map((col, index) => {
                                    let value = row[index];
                                    
                                    // Handle date conversions
                                    if (col.includes('date') && value) {
                                        // Convert date strings to proper format
                                        if (typeof value === 'string') {
                                            const date = new Date(value);
                                            if (!isNaN(date.getTime())) {
                                                value = date.toISOString().split('T')[0];
                                            }
                                        }
                                    }
                                    
                                    // Handle numeric conversions
                                    if ((col === 'margin' || col === 'final_amt' || col === 'rev') && value) {
                                        if (typeof value === 'string') {
                                            // Remove currency symbols and commas
                                            value = value.replace(/[₱$,]/g, '').trim();
                                        }
                                        const numValue = parseFloat(value);
                                        if (!isNaN(numValue)) {
                                            value = numValue;
                                        } else {
                                            value = null;
                                        }
                                    }
                                    
                                    return value;
                                });
                                
                                // Create the INSERT statement
                                const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
                                const columnNames = columns.map(col => `"${col}"`).join(', ');
                                
                                const insertSql = `
                                    INSERT INTO opps_monitoring (${columnNames})
                                    VALUES (${placeholders})
                                `;
                                
                                await client.query(insertSql, values);
                                insertedCount++;
                                
                                if (insertedCount % 50 === 0) {
                                    console.log(`📊 Processed ${insertedCount} records...`);
                                }
                                
                            } catch (error) {
                                console.error(`❌ Error inserting row:`, error.message);
                                console.error('Row data:', row);
                                errorCount++;
                            }
                        }
                        
                        console.log(`✅ Upload completed!`);
                        console.log(`📊 Successfully inserted: ${insertedCount} records`);
                        if (errorCount > 0) {
                            console.log(`⚠️  Errors encountered: ${errorCount} records`);
                        }
                        
                        // Step 4: Verify the upload
                        console.log('🔍 Verifying upload...');
                        const countResult = await client.query('SELECT COUNT(*) as total FROM opps_monitoring');
                        console.log(`✅ Database now contains ${countResult.rows[0].total} records`);
                        
                        resolve();
                        
                    } catch (error) {
                        console.error('❌ Database error:', error);
                        reject(error);
                    }
                });
        });
        
    } catch (error) {
        console.error('❌ Error during upload process:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the upload
uploadCSVToDatabase()
    .then(() => {
        console.log('🎉 CSV upload completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('💥 Upload failed:', error);
        process.exit(1);
    }); 