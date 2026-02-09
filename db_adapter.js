/**
 * Database Adapter for PostgreSQL, SQLiteCloud, and local SQLite
 * Set USE_SQLITE_LOCAL=1 and run `node scripts/init-local-sqlite.js` to use a local SQLite DB.
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');

let db = null;
let dbType = null;

/**
 * Initialize database connection.
 * Uses local SQLite if USE_SQLITE_LOCAL=1 (or SQLITE_DB_PATH is set). Otherwise attempts PostgreSQL/SQLiteCloud if DATABASE_URL is set.
 * If none are set, no connection is made (mock/disabled mode).
 */
async function initDatabase() {
    const useLocalSqlite = process.env.USE_SQLITE_LOCAL === '1' || process.env.USE_SQLITE_LOCAL === 'true' || process.env.SQLITE_DB_PATH;
    const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, 'data', 'local.db');

    if (useLocalSqlite) {
        try {
            const Database = require('better-sqlite3');
            const dir = path.dirname(dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            db = new Database(dbPath);
            db.pragma('journal_mode = WAL');
            db.pragma('foreign_keys = ON');
            dbType = 'sqlite';
            console.log('✅ Local SQLite database connected:', dbPath);
            // Return pool-like object so server's pool.connect() works
            return {
                connect: async () => ({ query, release: () => {} })
            };
        } catch (error) {
            console.error('❌ Local SQLite connection error:', error.message);
            console.warn('⚠️  Falling back to no DB. Create the DB with: node scripts/init-local-sqlite.js');
            db = null;
            dbType = null;
            return null;
        }
    }

    if (process.env.DATABASE_URL) {
        const url = process.env.DATABASE_URL;
        if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
            const { Pool } = require('pg');
            db = new Pool({ connectionString: url });
            dbType = 'postgresql';
            console.log('✅ PostgreSQL database connected');
            return db;
        }
        if (url.startsWith('sqlitecloud://') || url.includes('sqlitecloud')) {
            const { SQLiteCloud } = require('@sqlitecloud/drivers');
            db = new SQLiteCloud(url);
            await db.connect();
            dbType = 'sqlitecloud';
            console.log('✅ SQLiteCloud database connected');
            return db;
        }
    }

    // No DB configured
    console.warn('⚠️  SQL database connection is disabled. All DB queries return empty results.');
    console.warn('   To use local SQLite: set USE_SQLITE_LOCAL=1 and run node scripts/init-local-sqlite.js');
    return null;
}

/**
 * Execute a SQL query.
 * @param {string} sql - SQL query (use ? for params)
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result { rows, rowCount, lastID }
 */
async function query(sql, params = []) {
    if (!db) {
        return { rows: [], rowCount: 0 };
    }

    if (dbType === 'sqlite') {
        return new Promise((resolve, reject) => {
            try {
                const runSql = dbType === 'sqlite' ? convertSQL(sql) : sql;
                const stmt = db.prepare(runSql);
                const first = runSql.trim().toUpperCase();
                if (first.startsWith('SELECT') || first.startsWith('WITH')) {
                    const rows = stmt.all(...params);
                    resolve({ rows, rowCount: rows.length });
                } else {
                    const result = stmt.run(...params);
                    resolve({
                        rows: [],
                        rowCount: result.changes,
                        lastID: result.lastInsertRowid
                    });
                }
            } catch (error) {
                console.error('SQLite query error:', error.message);
                reject(error);
            }
        });
    }

    if (dbType === 'sqlitecloud') {
        try {
            const runSql = convertSQL(sql);
            const result = await db.sql(runSql, ...params);
            if (Array.isArray(result)) {
                return { rows: result, rowCount: result.length };
            }
            return {
                rows: [],
                rowCount: result.changes || 0,
                lastID: result.lastID
            };
        } catch (error) {
            console.error('SQLiteCloud query error:', error);
            throw error;
        }
    }

    if (dbType === 'postgresql') {
        return await db.query(sql, params);
    }

    return { rows: [], rowCount: 0 };
}

/**
 * Execute a transaction.
 */
async function transaction(callback) {
    if (!db) {
        const noopQuery = async () => ({ rows: [], rowCount: 0 });
        await callback(noopQuery);
        return;
    }

    if (dbType === 'sqlite') {
        db.exec('BEGIN TRANSACTION');
        try {
            const queryFn = async (sql, params = []) => {
                const runSql = convertSQL(sql);
                const stmt = db.prepare(runSql);
                const first = runSql.trim().toUpperCase();
                if (first.startsWith('SELECT') || first.startsWith('WITH')) {
                    const rows = stmt.all(...params);
                    return { rows, rowCount: rows.length };
                }
                const result = stmt.run(...params);
                return { rows: [], rowCount: result.changes, lastID: result.lastInsertRowid };
            };
            await callback(queryFn);
            db.exec('COMMIT');
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
        return;
    }

    if (dbType === 'sqlitecloud') {
        await query('BEGIN TRANSACTION');
        try {
            await callback(query);
            await query('COMMIT');
        } catch (error) {
            await query('ROLLBACK');
            throw error;
        }
    } else if (dbType === 'postgresql') {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await callback((sql, params) => client.query(sql, params));
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

/**
 * Get a client for connection pooling.
 */
async function getClient() {
    if (!db) {
        return {
            query: async () => ({ rows: [], rowCount: 0 }),
            release: () => {}
        };
    }
    if (dbType === 'postgresql') {
        return await db.connect();
    }
    if (dbType === 'sqlite' || dbType === 'sqlitecloud') {
        return { query: query, release: () => {} };
    }
    return { query: async () => ({ rows: [], rowCount: 0 }), release: () => {} };
}

/**
 * Close database connection.
 */
async function close() {
    if (db) {
        if (dbType === 'postgresql') {
            await db.end();
        } else if (dbType === 'sqlitecloud') {
            db.close();
        } else if (dbType === 'sqlite') {
            db.close();
        }
        db = null;
        dbType = null;
        console.log('✅ Database connection closed');
    }
}

function getDB() {
    return db;
}

function getDBType() {
    return dbType;
}

/**
 * Convert PostgreSQL-specific SQL to SQLite-compatible SQL.
 */
function convertSQL(sql) {
    if (dbType !== 'sqlite' && dbType !== 'sqlitecloud') {
        return sql;
    }

    let converted = sql;
    converted = converted.replace(/RETURNING \*/gi, '');
    converted = converted.replace(/gen_random_uuid\(\)/gi, "lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random())%4+1,1) || hex(randomblob(2)) || '-' || hex(randomblob(6)))");
    converted = converted.replace(/NOW\(\)/gi, "datetime('now')");
    converted = converted.replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");
    converted = converted.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    converted = converted.replace(/BOOLEAN/gi, 'INTEGER');
    converted = converted.replace(/UUID/gi, 'TEXT');
    converted = converted.replace(/JSONB/gi, 'TEXT');
    converted = converted.replace(/TEXT\[\]/gi, 'TEXT');
    return converted;
}

module.exports = {
    initDatabase,
    query,
    transaction,
    getClient,
    close,
    getDB,
    getDBType,
    convertSQL
};
