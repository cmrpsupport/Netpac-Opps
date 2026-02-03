const pg = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL connection
const pgClient = new pg.Client('postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require');

async function exportSchema() {
    try {
        await pgClient.connect();
        console.log('✅ Connected to PostgreSQL');

        // Get list of tables
        const tablesResult = await pgClient.query(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);

        console.log('\n📊 Found tables:');
        tablesResult.rows.forEach(row => console.log(`  - ${row.tablename}`));

        const allSchemas = [];
        const allData = {};

        for (const row of tablesResult.rows) {
            const tableName = row.tablename;
            console.log(`\n🔍 Processing table: ${tableName}`);

            // Get table schema
            const schemaResult = await pgClient.query(`
                SELECT
                    column_name,
                    data_type,
                    character_maximum_length,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = $1
                ORDER BY ordinal_position
            `, [tableName]);

            // Get primary key info
            const pkResult = await pgClient.query(`
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = $1::regclass AND i.indisprimary
            `, [tableName]);

            const primaryKeys = pkResult.rows.map(r => r.attname);

            // Generate SQLite CREATE TABLE statement
            let createTable = `CREATE TABLE ${tableName} (\n`;
            const columns = schemaResult.rows.map(col => {
                let colDef = `  ${col.column_name} `;

                // Map PostgreSQL types to SQLite types
                const pgType = col.data_type.toLowerCase();
                if (pgType.includes('int') || pgType === 'serial') {
                    colDef += 'INTEGER';
                } else if (pgType.includes('numeric') || pgType.includes('decimal') || pgType.includes('real') || pgType.includes('double')) {
                    colDef += 'REAL';
                } else if (pgType.includes('bool')) {
                    colDef += 'INTEGER'; // SQLite uses 0/1 for boolean
                } else if (pgType === 'uuid') {
                    colDef += 'TEXT';
                } else if (pgType.includes('time') || pgType.includes('date')) {
                    colDef += 'TEXT'; // SQLite stores dates as TEXT or INTEGER
                } else if (pgType === 'jsonb' || pgType === 'json') {
                    colDef += 'TEXT';
                } else {
                    colDef += 'TEXT';
                }

                // Add PRIMARY KEY constraint
                if (primaryKeys.includes(col.column_name)) {
                    colDef += ' PRIMARY KEY';
                    if (col.column_default && col.column_default.includes('gen_random_uuid')) {
                        // SQLite doesn't have uuid generation, we'll handle this in the app
                    } else if (col.column_default && col.column_default.includes('nextval')) {
                        colDef += ' AUTOINCREMENT';
                    }
                }

                // Add NOT NULL constraint
                if (col.is_nullable === 'NO' && !primaryKeys.includes(col.column_name)) {
                    colDef += ' NOT NULL';
                }

                // Add DEFAULT constraint
                if (col.column_default && !col.column_default.includes('nextval') && !col.column_default.includes('gen_random_uuid')) {
                    let defaultVal = col.column_default;
                    if (defaultVal.includes('NOW()') || defaultVal.includes('CURRENT_TIMESTAMP')) {
                        colDef += " DEFAULT CURRENT_TIMESTAMP";
                    } else if (defaultVal === 'false' || defaultVal === 'true') {
                        colDef += ` DEFAULT ${defaultVal === 'true' ? '1' : '0'}`;
                    } else {
                        colDef += ` DEFAULT ${defaultVal}`;
                    }
                }

                return colDef;
            });

            createTable += columns.join(',\n') + '\n);';
            allSchemas.push(createTable);

            // Export data
            console.log(`  📦 Exporting data from ${tableName}...`);
            const dataResult = await pgClient.query(`SELECT * FROM ${tableName}`);
            allData[tableName] = dataResult.rows;
            console.log(`  ✅ Exported ${dataResult.rows.length} rows`);
        }

        // Get foreign key constraints
        const fkResult = await pgClient.query(`
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        `);

        const foreignKeys = fkResult.rows.map(fk =>
            `-- Foreign key: ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`
        );

        // Save schema to file
        const schemaOutput = [
            '-- SQLite Schema for CMRP Opportunities Management',
            '-- Generated from PostgreSQL database',
            '',
            '-- Foreign Key Constraints:',
            ...foreignKeys,
            '',
            ...allSchemas
        ].join('\n');

        fs.writeFileSync('sqlite_schema.sql', schemaOutput);
        console.log('\n✅ Schema exported to sqlite_schema.sql');

        // Save data to JSON
        fs.writeFileSync('postgres_data_export.json', JSON.stringify(allData, null, 2));
        console.log('✅ Data exported to postgres_data_export.json');

        // Generate migration instructions
        const instructions = `
# Migration to SQLiteCloud Instructions

## Step 1: Create SQLiteCloud Database
1. Go to https://dashboard.sqlitecloud.io/
2. Create a new database
3. Get your connection string (should look like: sqlitecloud://user:password@host.sqlitecloud.io:8860/dbname)

## Step 2: Install SQLiteCloud Node.js Driver
\`\`\`bash
npm install @sqlitecloud/drivers
\`\`\`

## Step 3: Import Schema
Run the schema import script:
\`\`\`bash
node import_to_sqlitecloud.js
\`\`\`

## Step 4: Update Application Configuration
Update your .env file:
\`\`\`
# Replace PostgreSQL connection
# DATABASE_URL=postgresql://...

# With SQLiteCloud connection
DATABASE_URL=sqlitecloud://YOUR_CONNECTION_STRING
\`\`\`

## Step 5: Update server.js
Replace the pg (PostgreSQL) client with SQLiteCloud client.

## Notes:
- All your tables have been exported
- Data is preserved in postgres_data_export.json
- Foreign key relationships are documented in the schema file
- UUID generation will need to be handled in the application layer
`;

        fs.writeFileSync('MIGRATION_INSTRUCTIONS.md', instructions);
        console.log('✅ Instructions saved to MIGRATION_INSTRUCTIONS.md');

        await pgClient.end();
        console.log('\n🎉 Export completed successfully!');

    } catch (error) {
        console.error('❌ Export error:', error.message);
        console.error(error);
        await pgClient.end();
        process.exit(1);
    }
}

exportSchema();
