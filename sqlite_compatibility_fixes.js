/**
 * SQLite Compatibility Helper Functions
 * Handles differences between PostgreSQL and SQLiteCloud
 */

const db = require('./db_adapter');

/**
 * Helper to handle RETURNING * for INSERT/UPDATE queries
 * PostgreSQL: INSERT ... RETURNING *
 * SQLite: INSERT ... then SELECT last row
 */
async function insertWithReturning(sql, params, tableName) {
    const dbType = db.getDBType();

    if (dbType === 'postgresql') {
        // PostgreSQL supports RETURNING *
        const result = await db.query(sql, params);
        return result.rows[0];
    } else {
        // SQLite: Remove RETURNING *, insert, then fetch
        const cleanSql = sql.replace(/RETURNING \*/gi, '').trim();
        const result = await db.query(cleanSql, params);

        // Fetch the last inserted row
        if (result.lastID) {
            const selectResult = await db.query(
                `SELECT * FROM ${tableName} WHERE rowid = ?`,
                [result.lastID]
            );
            return selectResult.rows[0];
        }

        return null;
    }
}

/**
 * Helper to handle UPDATE ... RETURNING *
 */
async function updateWithReturning(sql, params, tableName, whereClause, whereParams) {
    const dbType = db.getDBType();

    if (dbType === 'postgresql') {
        const result = await db.query(sql, params);
        return result.rows[0];
    } else {
        // SQLite: Remove RETURNING *, update, then fetch
        const cleanSql = sql.replace(/RETURNING \*/gi, '').trim();
        await db.query(cleanSql, params);

        // Fetch the updated row
        const selectResult = await db.query(
            `SELECT * FROM ${tableName} WHERE ${whereClause}`,
            whereParams
        );
        return selectResult.rows[0];
    }
}

/**
 * Convert boolean values for SQLite (0/1 instead of true/false)
 */
function toSQLiteBoolean(value) {
    const dbType = db.getDBType();
    if (dbType === 'sqlitecloud') {
        return value ? 1 : 0;
    }
    return value;
}

/**
 * Convert SQLite boolean back to JavaScript boolean
 */
function fromSQLiteBoolean(value) {
    const dbType = db.getDBType();
    if (dbType === 'sqlitecloud') {
        return value === 1 || value === '1' || value === true;
    }
    return Boolean(value);
}

/**
 * Handle JSON fields for SQLite (must stringify/parse)
 */
function toSQLiteJSON(value) {
    const dbType = db.getDBType();
    if (dbType === 'sqlitecloud') {
        return typeof value === 'string' ? value : JSON.stringify(value);
    }
    return value;
}

/**
 * Parse JSON from SQLite
 */
function fromSQLiteJSON(value) {
    const dbType = db.getDBType();
    if (dbType === 'sqlitecloud' && typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }
    return value;
}

/**
 * Handle array fields (PostgreSQL arrays vs SQLite JSON strings)
 */
function toSQLiteArray(value) {
    const dbType = db.getDBType();
    if (dbType === 'sqlitecloud') {
        if (Array.isArray(value)) {
            return JSON.stringify(value);
        }
        return value;
    }
    return value;
}

/**
 * Parse array from SQLite
 */
function fromSQLiteArray(value) {
    const dbType = db.getDBType();
    if (dbType === 'sqlitecloud') {
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        return Array.isArray(value) ? value : [];
    }
    return value;
}

/**
 * Normalize query result format
 * Ensures consistent .rows array structure
 */
function normalizeResult(result) {
    if (!result) return { rows: [], rowCount: 0 };

    if (Array.isArray(result)) {
        return {
            rows: result,
            rowCount: result.length
        };
    }

    if (result.rows) {
        return result;
    }

    return { rows: [], rowCount: 0 };
}

/**
 * Process row after fetching from database
 * Converts SQLite types to JavaScript types
 */
function processRow(row) {
    if (!row) return row;

    const dbType = db.getDBType();
    if (dbType !== 'sqlitecloud') return row;

    const processed = { ...row };

    // Convert known boolean fields
    const booleanFields = ['is_deleted', 'is_all_day', 'is_verified', 'is_active'];
    booleanFields.forEach(field => {
        if (field in processed) {
            processed[field] = fromSQLiteBoolean(processed[field]);
        }
    });

    // Convert known JSON fields
    const jsonFields = ['column_settings', 'roles', 'metadata'];
    jsonFields.forEach(field => {
        if (field in processed) {
            processed[field] = fromSQLiteJSON(processed[field]);
        }
    });

    return processed;
}

/**
 * Process multiple rows
 */
function processRows(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.map(processRow);
}

module.exports = {
    insertWithReturning,
    updateWithReturning,
    toSQLiteBoolean,
    fromSQLiteBoolean,
    toSQLiteJSON,
    fromSQLiteJSON,
    toSQLiteArray,
    fromSQLiteArray,
    normalizeResult,
    processRow,
    processRows
};
