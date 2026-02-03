const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: 'postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require'
});

async function exportOppsMonitoring() {
    const client = await pool.connect();

    try {
        console.log('🔄 Exporting opps_monitoring table...');

        const query = `
            SELECT
                uid,
                project_code,
                account_mgr,
                client,
                project_name,
                opp_status,
                status,
                decision,
                final_amt,
                encoded_date,
                date_received,
                client_deadline,
                remarks_comments
            FROM opps_monitoring
            ORDER BY encoded_date DESC
        `;

        const result = await client.query(query);
        console.log(`📊 Found ${result.rows.length} records`);

        // Convert to CSV format
        const csvHeader = 'UID,Project Code,Account Manager,Client,Project Name,Opp Status,Status,Decision,Final Amount,Encoded Date,Date Received,Client Deadline,Remarks\n';

        const csvRows = result.rows.map(row => {
            return [
                row.uid || '',
                row.project_code || '',
                row.account_mgr || '',
                row.client || '',
                row.project_name || '',
                row.opp_status || '',
                row.status || '',
                row.decision || '',
                row.final_amt || '',
                row.encoded_date ? row.encoded_date.toISOString() : '',
                row.date_received ? row.date_received.toISOString() : '',
                row.client_deadline ? row.client_deadline.toISOString() : '',
                row.remarks_comments || ''
            ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
        }).join('\n');

        const csvContent = csvHeader + csvRows;

        // Write to file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `opps_monitoring_export_${timestamp}.csv`;

        fs.writeFileSync(filename, csvContent, 'utf8');

        console.log(`✅ Export completed: ${filename}`);
        console.log(`📁 File saved with ${result.rows.length} records`);
        console.log(`📍 File location: ${process.cwd()}/${filename}`);

        // Show summary statistics
        console.log('\n📈 Summary Statistics:');

        const stats = await client.query(`
            SELECT
                COUNT(*) as total_opportunities,
                COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as submitted_count,
                COALESCE(SUM(CASE WHEN status = 'Submitted' THEN final_amt END), 0) as submitted_amount,
                COUNT(CASE WHEN opp_status = 'OP100' THEN 1 END) as op100_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP100' THEN final_amt END), 0) as op100_amount,
                COUNT(CASE WHEN opp_status = 'OP90' THEN 1 END) as op90_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP90' THEN final_amt END), 0) as op90_amount,
                COUNT(CASE WHEN opp_status = 'OP60' THEN 1 END) as op60_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP60' THEN final_amt END), 0) as op60_amount,
                COUNT(CASE WHEN opp_status = 'OP30' THEN 1 END) as op30_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP30' THEN final_amt END), 0) as op30_amount,
                COUNT(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN 1 END) as lost_count,
                COALESCE(SUM(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN final_amt END), 0) as lost_amount
            FROM opps_monitoring
        `);

        const currentStats = stats.rows[0];
        console.log(`Total Opportunities: ${currentStats.total_opportunities}`);
        console.log(`Submitted: ${currentStats.submitted_count} (₱${Number(currentStats.submitted_amount).toLocaleString()})`);
        console.log(`OP100: ${currentStats.op100_count} (₱${Number(currentStats.op100_amount).toLocaleString()})`);
        console.log(`OP90: ${currentStats.op90_count} (₱${Number(currentStats.op90_amount).toLocaleString()})`);
        console.log(`OP60: ${currentStats.op60_count} (₱${Number(currentStats.op60_amount).toLocaleString()})`);
        console.log(`OP30: ${currentStats.op30_count} (₱${Number(currentStats.op30_amount).toLocaleString()})`);
        console.log(`Lost: ${currentStats.lost_count} (₱${Number(currentStats.lost_amount).toLocaleString()})`);

        return filename;

    } catch (error) {
        console.error('❌ Error exporting data:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

exportOppsMonitoring().catch(console.error);