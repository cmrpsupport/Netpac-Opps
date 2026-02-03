const { Pool } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');

// Neon database connection
const pool = new Pool({
  connectionString: 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require'
});

function cleanDateValue(dateStr) {
  if (!dateStr || dateStr.trim() === '' || dateStr.trim() === '""' || dateStr.trim() === "''" || dateStr === '""') return null;
  
  const cleaned = dateStr.trim().replace(/^["']|["']$/g, ''); // Remove quotes
  if (!cleaned) return null;
  
  // Handle various date formats
  if (cleaned.includes(',')) {
    // Format like "Thu, 30/7/25" - extract date part after comma
    const datePart = cleaned.split(',')[1].trim();
    const parts = datePart.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month}-${day}`;
    }
  }
  
  // Already in YYYY-MM-DD format
  if (cleaned.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return cleaned;
  }
  
  return null;
}

function cleanNumericValue(numStr) {
  if (!numStr || numStr.trim() === '') return null;
  const cleaned = numStr.replace(/[^\d.-]/g, '');
  return cleaned === '' ? null : parseFloat(cleaned);
}

async function uploadCSV() {
  try {
    const results = [];
    
    fs.createReadStream('/Users/reuelrivera/Documents/CMRP Opps Management/CMRP-Opps-Management/formatted_opps_monitoring.csv')
      .pipe(csv({ headers: false }))
      .on('data', (data) => {
        const row = Object.values(data);
        if (row.length >= 31) {
          // Clean the data
          const cleanedRow = [
            cleanDateValue(row[0]), // date_created
            row[1], // project_name
            row[2], // opp_id
            cleanNumericValue(row[3]), // dept
            row[4], // company
            row[5], // category
            row[6], // subcategory
            row[7], // industry
            row[8], // sub_industry
            cleanDateValue(row[9]), // date_endorsed
            cleanDateValue(row[10]), // client_deadline
            row[11], // status
            row[12], // pic
            row[13], // bom
            row[14], // source
            row[15], // proposal_status
            cleanDateValue(row[16]), // date_submitted
            cleanNumericValue(row[17]), // lead_time
            cleanNumericValue(row[18]), // amount
            row[19], // output_stage
            cleanDateValue(row[20]), // won_date
            row[21], // lost_reason
            row[22], // probability
            row[23], // demand_gen
            row[24], // solution_fit
            row[25], // business_case
            row[26], // timing
            row[27], // authority
            row[28], // notes
            row[29], // id (UUID)
            row[30], // created_at
            cleanNumericValue(row[31]) || 1 // version
          ];
          
          results.push(cleanedRow);
        }
      })
      .on('end', async () => {
        console.log(`Processing ${results.length} rows...`);
        
        for (let i = 0; i < results.length; i++) {
          const row = results[i];
          try {
            await pool.query(`
              INSERT INTO opps_monitoring (
                encoded_date, project_name, project_code, rev, client, solutions, sol_particulars,
                industries, ind_particulars, date_received, client_deadline, decision, account_mgr, pic,
                bom, status, submitted_date, margin, final_amt, opp_status,
                date_awarded_lost, lost_rca, l_particulars, a, c, r,
                u, d, remarks_comments, uid, forecast_date, revision
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                       $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, 
                       $30, $31, $32)
            `, row);
            
            if ((i + 1) % 50 === 0) {
              console.log(`Inserted ${i + 1} rows...`);
            }
          } catch (err) {
            console.error(`Error inserting row ${i + 1}:`, err.message);
            console.error('Row data:', row);
          }
        }
        
        console.log('Upload completed!');
        await pool.end();
      });
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

uploadCSV();