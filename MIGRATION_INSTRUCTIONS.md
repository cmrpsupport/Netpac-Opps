
# Migration to SQLiteCloud Instructions

## Step 1: Create SQLiteCloud Database
1. Go to https://dashboard.sqlitecloud.io/
2. Create a new database
3. Get your connection string (should look like: sqlitecloud://user:password@host.sqlitecloud.io:8860/dbname)

## Step 2: Install SQLiteCloud Node.js Driver
```bash
npm install @sqlitecloud/drivers
```

## Step 3: Import Schema
Run the schema import script:
```bash
node import_to_sqlitecloud.js
```

## Step 4: Update Application Configuration
Update your .env file:
```
# Replace PostgreSQL connection
# DATABASE_URL=postgresql://...

# With SQLiteCloud connection
DATABASE_URL=sqlitecloud://YOUR_CONNECTION_STRING
```

## Step 5: Update server.js
Replace the pg (PostgreSQL) client with SQLiteCloud client.

## Notes:
- All your tables have been exported
- Data is preserved in postgres_data_export.json
- Foreign key relationships are documented in the schema file
- UUID generation will need to be handled in the application layer
