/**
 * Database Adapter for PostgreSQL and SQLiteCloud
 * SQL database connection has been removed: no connections are made; all queries return empty results.
 */

require('dotenv').config();

let db = null;
let dbType = null;

/**
 * Initialize database connection — disabled. No SQL connection is made.
 */
async function initDatabase() {
    // SQL DB connection removed: never connect to PostgreSQL or SQLiteCloud
    console.warn('⚠️  SQL database connection is disabled. All DB queries return empty results.');
    return null;
}

/**
 * Execute a SQL query — when DB is disabled, returns empty result.
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(sql, params = []) {
    if (!db) {
        return { rows: [], rowCount: 0 };
    }

    if (dbType === 'sqlitecloud') {
        // SQLiteCloud query
        try {
            const result = await db.sql(sql, ...params);

            // Normalize result format to match PostgreSQL
            if (Array.isArray(result)) {
                return {
                    rows: result,
                    rowCount: result.length
                };
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
    } else if (dbType === 'postgresql') {
        // PostgreSQL query
        return await db.query(sql, params);
    }
}

/**
 * Execute a transaction — no-op when DB is disabled.
 */
async function transaction(callback) {
    if (!db) {
        const noopQuery = async () => ({ rows: [], rowCount: 0 });
        await callback(noopQuery);
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
 * Get a client for connection pooling — when DB disabled, returns no-op client.
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
    } else if (dbType === 'sqlitecloud') {
        return {
            query: query,
            release: () => {}
        };
    }
    return { query: async () => ({ rows: [], rowCount: 0 }), release: () => {} };
}

/**
 * Close database connection
 */
async function close() {
    if (db) {
        if (dbType === 'postgresql') {
            await db.end();
        } else if (dbType === 'sqlitecloud') {
            db.close();
        }
        console.log('✅ Database connection closed');
    }
}

/**
 * Get raw database instance
 */
function getDB() {
    return db;
}

/**
 * Get database type
 */
function getDBType() {
    return dbType;
}

/**
 * Helper to convert PostgreSQL-specific SQL to SQLite-compatible SQL
 * @param {string} sql - PostgreSQL SQL
 * @returns {string} SQLite-compatible SQL
 */
function convertSQL(sql) {
    if (dbType !== 'sqlitecloud') {
        return sql;
    }

    let converted = sql;

    // Replace RETURNING * with SQLite equivalent (will need to fetch last insert id)
    converted = converted.replace(/RETURNING \*/gi, '');

    // Replace gen_random_uuid() with a placeholder (handle in app)
    converted = converted.replace(/gen_random_uuid\(\)/gi, '?');

    // Replace NOW() with datetime('now')
    converted = converted.replace(/NOW\(\)/gi, "datetime('now')");
    converted = converted.replace(/CURRENT_TIMESTAMP/gi, "datetime('now')");

    // Replace SERIAL with INTEGER PRIMARY KEY AUTOINCREMENT
    converted = converted.replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT');

    // Replace BOOLEAN type
    converted = converted.replace(/BOOLEAN/gi, 'INTEGER');

    // Replace UUID type
    converted = converted.replace(/UUID/gi, 'TEXT');

    // Replace JSONB with JSON (SQLite stores as TEXT)
    converted = converted.replace(/JSONB/gi, 'TEXT');

    // Replace TEXT[] with TEXT (arrays stored as JSON strings)
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
