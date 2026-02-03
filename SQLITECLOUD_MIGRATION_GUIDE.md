# SQLiteCloud Migration Guide

This guide will help you migrate from PostgreSQL (Neon) to SQLiteCloud without losing any data.

## 📊 Migration Summary

Your PostgreSQL database has been analyzed and exported:
- **29 tables** found
- **4,316 total rows** of data exported
- All schemas converted to SQLite format
- Foreign key relationships documented

### Tables Exported:
- account_manager_snapshots (135 rows)
- catalog_items (5 rows)
- custom_snapshots (4 rows)
- custom_tasks (385 rows)
- dashboard_snapshots (5 rows)
- drive_folder_audit (390 rows)
- forecast_revisions (503 rows)
- opportunity_revisions (688 rows)
- opps_monitoring (744 rows)
- proposal_schedule (80 rows)
- proposal_status_history (662 rows)
- quotations and related tables
- users, roles, and permissions
- And more...

## 🚀 Migration Steps

### Step 1: Create SQLiteCloud Database

1. Go to https://dashboard.sqlitecloud.io/
2. Sign up or log in
3. Click "Create New Database"
4. Choose a database name (e.g., `opps_management`)
5. Select your preferred region
6. Click "Create"

### Step 2: Get Connection String

After creating the database:
1. Click on your database
2. Go to "Connection" tab
3. Copy the connection string (format: `sqlitecloud://user:password@host.sqlitecloud.io:8860/dbname`)

### Step 3: Run the Import Script

```bash
node import_to_sqlitecloud.js
```

When prompted, paste your SQLiteCloud connection string.

The script will:
- ✅ Create all tables
- ✅ Import all data
- ✅ Preserve relationships
- ✅ Convert data types

### Step 4: Update Environment Variables

Create or update your `.env` file:

```env
# Comment out or remove PostgreSQL connection
# DATABASE_URL=postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require

# Add SQLiteCloud connection
DATABASE_URL=sqlitecloud://your-connection-string-here
```

### Step 5: Update Application Code

You have two options:

#### Option A: Use the Database Adapter (Recommended)

The `db_adapter.js` module provides a unified interface that works with both PostgreSQL and SQLiteCloud.

In your `server.js` or database initialization code:

```javascript
// Replace this:
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// With this:
const db = require('./db_adapter');
await db.initDatabase();

// Then use db.query() instead of pool.query()
const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
```

#### Option B: Direct SQLiteCloud Usage

```javascript
const { Database } = require('@sqlitecloud/drivers');
const db = new Database(process.env.DATABASE_URL);

// Enable foreign keys
await db.sql`PRAGMA foreign_keys = ON`;

// Run queries
const users = await db.sql`SELECT * FROM users WHERE email = ${email}`;
```

### Step 6: Handle Database-Specific Differences

#### UUID Generation
PostgreSQL uses `gen_random_uuid()`, but SQLite doesn't have this built-in.

Use the `uuid` package (already installed):

```javascript
const { v4: uuidv4 } = require('uuid');

// When inserting:
const id = uuidv4();
await db.query('INSERT INTO users (id, email, ...) VALUES ($1, $2, ...)', [id, email, ...]);
```

#### Boolean Values
SQLiteCloud stores booleans as integers (0/1).

When reading:
```javascript
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
const isVerified = user.rows[0].is_verified === 1; // or Boolean(user.rows[0].is_verified)
```

When writing:
```javascript
await db.query('UPDATE users SET is_verified = $1 WHERE id = $2', [isVerified ? 1 : 0, userId]);
```

#### JSON/JSONB Fields
SQLite stores JSON as TEXT. You need to parse/stringify:

```javascript
// Reading
const result = await db.query('SELECT column_settings FROM user_column_preferences WHERE id = $1', [id]);
const settings = JSON.parse(result.rows[0].column_settings);

// Writing
const settings = { column1: true, column2: false };
await db.query('UPDATE user_column_preferences SET column_settings = $1 WHERE id = $2',
    [JSON.stringify(settings), id]);
```

#### RETURNING Clause
SQLite doesn't support `RETURNING *` in the same way as PostgreSQL.

Instead of:
```javascript
const result = await db.query('INSERT INTO users (...) VALUES (...) RETURNING *');
```

Use:
```javascript
const result = await db.query('INSERT INTO users (...) VALUES (...)');
const lastID = result.lastID; // SQLite provides lastID
const inserted = await db.query('SELECT * FROM users WHERE id = $1', [lastID]);
```

### Step 7: Test the Migration

1. Start your application:
   ```bash
   npm start
   ```

2. Test key functionality:
   - User login/authentication
   - Data retrieval from main tables
   - Creating new records
   - Updating existing records
   - Dashboard views
   - Reports and exports

3. Check for errors in the console

### Step 8: Verify Data Integrity

Run these queries to verify your data:

```bash
node -e "
const db = require('./db_adapter');
(async () => {
  await db.initDatabase();

  // Count rows in key tables
  const tables = ['users', 'opps_monitoring', 'custom_tasks', 'proposal_schedule'];

  for (const table of tables) {
    const result = await db.query(\`SELECT COUNT(*) as count FROM \${table}\`);
    console.log(\`\${table}: \${result.rows[0].count} rows\`);
  }

  await db.close();
})();
"
```

## 🔄 Rollback Plan

If you need to rollback to PostgreSQL:

1. Update `.env`:
   ```env
   DATABASE_URL=postgresql://opps_management_owner:npg_Br9RoWqlTPZ0@ep-quiet-dawn-a1jwkxgx-pooler.ap-southeast-1.aws.neon.tech/opps_management?sslmode=require
   ```

2. Restart the application

The `db_adapter.js` will automatically detect PostgreSQL and use the appropriate driver.

## 📝 Key Differences: PostgreSQL vs SQLiteCloud

| Feature | PostgreSQL | SQLiteCloud |
|---------|-----------|-------------|
| Connection | Pool-based | Direct connection |
| UUID | `gen_random_uuid()` | Use `uuid` npm package |
| Boolean | Native BOOLEAN | INTEGER (0/1) |
| JSON | JSONB native | TEXT (parse/stringify) |
| Arrays | Native arrays | JSON strings |
| RETURNING | Supported | Use lastID |
| Foreign Keys | Default ON | Must enable with PRAGMA |

## 🎯 Benefits of SQLiteCloud

- ✅ Simpler connection management
- ✅ Lower latency (depending on region)
- ✅ Cost-effective for small to medium apps
- ✅ Built-in replication
- ✅ Easy scaling

## 📞 Support

- SQLiteCloud Docs: https://docs.sqlitecloud.io/
- SQLiteCloud Node.js Driver: https://github.com/sqlitecloud/sqlitecloud-js

## 🔒 Security Note

**IMPORTANT**: Your PostgreSQL credentials were exposed in the connection string you shared.

After migration, please:
1. Reset your Neon database password
2. Revoke any exposed credentials
3. Store connection strings only in `.env` files
4. Never commit `.env` files to git (ensure `.gitignore` includes `.env`)

## ✅ Checklist

- [ ] Created SQLiteCloud database
- [ ] Got connection string
- [ ] Ran `import_to_sqlitecloud.js`
- [ ] Updated `.env` file
- [ ] Updated application code to use `db_adapter.js`
- [ ] Tested user authentication
- [ ] Tested data retrieval
- [ ] Tested data creation/updates
- [ ] Verified data integrity
- [ ] Checked application logs for errors
- [ ] Updated documentation
- [ ] Informed team members

## 📊 Files Generated

- `sqlite_schema.sql` - Complete SQLite schema
- `postgres_data_export.json` - All data (4,316 rows)
- `migrate_to_sqlitecloud.js` - Export script
- `import_to_sqlitecloud.js` - Import script
- `db_adapter.js` - Unified database interface
- `.env.sqlitecloud` - Saved connection string (after import)

---

**Ready to migrate?** Run `node import_to_sqlitecloud.js` to start!
