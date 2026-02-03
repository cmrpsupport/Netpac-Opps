const { Database } = require('@sqlitecloud/drivers');
const fs = require('fs');

const CONNECTION_STRING = 'sqlitecloud://cguxse6mvk.g4.sqlite.cloud:8860/cmrp-oppx?apikey=22C0CAgc51jfEnavN6i0kGGUNafnvDzW01U53xD2aMI';

async function importRemaining() {
    try {
        console.log('📦 Importing Remaining Data\n');
        console.log('📡 Connecting...');
        const db = new Database(CONNECTION_STRING);
        console.log('✅ Connected\n');

        const data = JSON.parse(fs.readFileSync('postgres_data_export.json', 'utf8'));

        const tablesToImport = [
            'custom_tasks',
            'account_manager_snapshots',
            'dashboard_snapshots',
            'custom_snapshots',
            'weekly_snapshot',
            'schedule_task_completion',
            'user_notifications',
            'quotations',
            'quotation_line_items',
            'quotation_revisions',
            'quotation_comments'
        ];

        for (const tableName of tablesToImport) {
            if (!data[tableName] || data[tableName].length === 0) {
                console.log(`⏭️  Skipping ${tableName} (no data)`);
                continue;
            }

            const rows = data[tableName];
            console.log(`📊 Importing ${rows.length} rows into ${tableName}...`);

            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(', ');
            const columnNames = columns.join(', ');
            const insertSQL = `INSERT OR IGNORE INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;

            let successCount = 0;
            let errorCount = 0;

            for (const row of rows) {
                try {
                    const values = columns.map(col => {
                        let val = row[col];

                        if (typeof val === 'boolean') {
                            return val ? 1 : 0;
                        }

                        if (val instanceof Date) {
                            return val.toISOString();
                        }

                        if (val !== null && typeof val === 'object') {
                            return JSON.stringify(val);
                        }

                        return val;
                    });

                    await db.sql(insertSQL, ...values);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    if (errorCount <= 2) {
                        console.error(`  ⚠️  Error: ${error.message}`);
                    }
                }
            }

            console.log(`✅ ${tableName}: ${successCount}/${rows.length} imported (${errorCount} errors)\n`);
        }

        console.log('📊 Final count:');
        for (const table of tablesToImport) {
            try {
                const result = await db.sql(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`  ${table}: ${result[0].count} rows`);
            } catch (error) {
                console.log(`  ${table}: error`);
            }
        }

        db.close();
        console.log('\n✅ Import complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

importRemaining();
