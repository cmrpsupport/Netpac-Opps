const { Database } = require('@sqlitecloud/drivers');
const fs = require('fs');
const readline = require('readline');

// Prompt for SQLiteCloud connection string
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise(resolve => {
        rl.question(prompt, resolve);
    });
}

async function importToSQLiteCloud() {
    try {
        console.log('🌩️  SQLiteCloud Migration Tool\n');

        // Get connection string from user
        const connectionString = await question('Enter your SQLiteCloud connection string: ');

        if (!connectionString || !connectionString.startsWith('sqlitecloud://')) {
            console.error('❌ Invalid connection string. Should start with sqlitecloud://');
            rl.close();
            process.exit(1);
        }

        console.log('\n📡 Connecting to SQLiteCloud...');
        const db = new Database(connectionString);

        // Enable foreign keys
        await db.sql`PRAGMA foreign_keys = ON`;
        console.log('✅ Connected to SQLiteCloud');

        // Read schema file
        console.log('\n📋 Reading schema file...');
        const schema = fs.readFileSync('sqlite_schema.sql', 'utf8');

        // Split schema into individual CREATE TABLE statements
        const statements = schema
            .split('\n')
            .filter(line => !line.startsWith('--') && line.trim().length > 0)
            .join('\n')
            .split(';')
            .filter(stmt => stmt.trim().length > 0);

        console.log(`Found ${statements.length} schema statements\n`);

        // Execute schema
        console.log('🏗️  Creating tables...');
        for (const statement of statements) {
            const tableName = statement.match(/CREATE TABLE (\w+)/i)?.[1];
            if (tableName) {
                try {
                    await db.sql(statement + ';');
                    console.log(`  ✅ Created table: ${tableName}`);
                } catch (error) {
                    console.error(`  ⚠️  Error creating ${tableName}: ${error.message}`);
                }
            }
        }

        // Read data file
        console.log('\n📦 Reading data export...');
        const data = JSON.parse(fs.readFileSync('postgres_data_export.json', 'utf8'));
        const tableNames = Object.keys(data);
        console.log(`Found data for ${tableNames.length} tables\n`);

        // Import data
        console.log('📥 Importing data...');
        for (const tableName of tableNames) {
            const rows = data[tableName];

            if (rows.length === 0) {
                console.log(`  ⏭️  Skipping ${tableName} (no data)`);
                continue;
            }

            console.log(`  📊 Importing ${rows.length} rows into ${tableName}...`);

            // Get column names from first row
            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(', ');
            const columnNames = columns.join(', ');

            const insertSQL = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;

            let successCount = 0;
            let errorCount = 0;

            for (const row of rows) {
                try {
                    const values = columns.map(col => {
                        let val = row[col];

                        // Handle boolean conversion
                        if (typeof val === 'boolean') {
                            return val ? 1 : 0;
                        }

                        // Handle dates
                        if (val instanceof Date) {
                            return val.toISOString();
                        }

                        // Handle JSON/JSONB
                        if (val !== null && typeof val === 'object') {
                            return JSON.stringify(val);
                        }

                        return val;
                    });

                    await db.sql(insertSQL, ...values);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    if (errorCount <= 3) {
                        console.error(`    ⚠️  Error importing row: ${error.message}`);
                    }
                }
            }

            console.log(`  ✅ ${tableName}: ${successCount} imported, ${errorCount} errors`);
        }

        console.log('\n✅ Migration completed!');
        console.log('\n📝 Next steps:');
        console.log('1. Update your .env file with:');
        console.log(`   DATABASE_URL=${connectionString}`);
        console.log('2. Update server.js to use SQLiteCloud instead of PostgreSQL');
        console.log('3. Test the application');

        // Save connection string to .env.sqlitecloud for reference
        fs.writeFileSync('.env.sqlitecloud', `DATABASE_URL=${connectionString}\n`);
        console.log('\n💾 Connection string saved to .env.sqlitecloud');

        db.close();
        rl.close();

    } catch (error) {
        console.error('\n❌ Migration error:', error.message);
        console.error(error);
        rl.close();
        process.exit(1);
    }
}

importToSQLiteCloud();
