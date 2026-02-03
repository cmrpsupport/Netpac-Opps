/**
 * Flexible Snapshots API Module
 * Purpose: Handle flexible snapshot date management and retrieval
 * Features: Custom date snapshots, manual snapshots, date selection
 */

const db = require('../../db_adapter');
const express = require('express');
const router = express.Router();

/**
 * GET /api/snapshots/available-dates/:type
 * Returns all available snapshot dates for a specific type
 */
router.get('/snapshots/available-dates/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { account_manager } = req.query;
        
        // Validate snapshot type
        if (!['weekly', 'monthly'].includes(type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot type',
                message: 'Snapshot type must be either "weekly" or "monthly"'
            });
        }

        let query, values;
        
        if (account_manager) {
            // Get account manager specific snapshots
            query = `
                SELECT 
                    snapshot_date,
                    description,
                    is_manual,
                    created_by,
                    created_at,
                    total_opportunities,
                    submitted_count,
                    submitted_amount
                FROM account_manager_snapshots
                WHERE snapshot_type = ? AND account_manager = ?
                ORDER BY snapshot_date DESC
                LIMIT 50
            `;
            values = [type, account_manager];
        } else {
            // Get global snapshots
            query = `
                SELECT
                    snapshot_date,
                    description,
                    is_manual,
                    created_by,
                    created_at,
                    total_opportunities,
                    submitted_count,
                    submitted_amount
                FROM dashboard_snapshots
                WHERE snapshot_type = ?
                ORDER BY snapshot_date DESC
                LIMIT 50
            `;
            values = [type];
        }

        const result = await db.query(query, values);

        res.json({
            success: true,
            type: type,
            account_manager: account_manager || 'global',
            count: result.rows.length,
            dates: result.rows.map(row => ({
                date: row.snapshot_date,
                description: row.description,
                is_manual: row.is_manual,
                created_by: row.created_by,
                created_at: row.created_at,
                preview: {
                    total_opportunities: row.total_opportunities,
                    submitted_count: row.submitted_count,
                    submitted_amount: parseFloat(row.submitted_amount) || 0
                }
            }))
        });

    } catch (error) {
        console.error(`[ERROR] Failed to fetch available dates for ${req.params.type}:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve available snapshot dates'
        });
    }
});

/**
 * GET /api/snapshots/:type/by-date/:date
 * Retrieve snapshot for specific date (global)
 */
router.get('/snapshots/:type/by-date/:date', async (req, res) => {
    try {
        const { type, date } = req.params;
        
        // Validate snapshot type
        if (!['weekly', 'monthly'].includes(type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot type',
                message: 'Snapshot type must be either "weekly" or "monthly"'
            });
        }

        // Validate date format
        const snapshotDate = new Date(date);
        if (isNaN(snapshotDate.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format',
                message: 'Date must be in YYYY-MM-DD format'
            });
        }

        const query = `
            SELECT 
                id,
                snapshot_type,
                snapshot_date,
                total_opportunities,
                submitted_count,
                submitted_amount,
                op100_count,
                op100_amount,
                op90_count,
                op90_amount,
                op60_count,
                op60_amount,
                op30_count,
                op30_amount,
                lost_count,
                lost_amount,
                inactive_count,
                ongoing_count,
                pending_count,
                declined_count,
                revised_count,
                is_manual,
                description,
                created_by,
                created_at
            FROM dashboard_snapshots
            WHERE snapshot_type = ? AND snapshot_date = ?
        `;

        const result = await db.query(query, [type, date]);
        
        if (result.rows.length === 0) {
            // Try to find nearest snapshot
            const nearestQuery = `
                SELECT * FROM get_nearest_snapshot_date(?, ?, NULL)
            `;
            const nearestResult = await db.query(nearestQuery, [date, type]);
            
            return res.status(404).json({ 
                error: 'Snapshot not found for this date',
                message: `No ${type} snapshot available for ${date}`,
                suggestion: nearestResult.rows.length > 0 ? {
                    nearest_date: nearestResult.rows[0].snapshot_date,
                    days_difference: nearestResult.rows[0].days_difference,
                    message: `Nearest snapshot is ${nearestResult.rows[0].days_difference} days away`
                } : null
            });
        }
        
        res.json({ 
            success: true, 
            data: result.rows[0],
            message: `${type} snapshot retrieved for ${date}`
        });

    } catch (error) {
        console.error(`[ERROR] Failed to fetch snapshot for date ${req.params.date}:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve snapshot data'
        });
    }
});

/**
 * GET /api/snapshots/:type/by-date/:date/:accountManager
 * Retrieve snapshot for specific date and account manager
 */
router.get('/snapshots/:type/by-date/:date/:accountManager', async (req, res) => {
    try {
        const { type, date, accountManager } = req.params;
        
        // Validate inputs
        if (!['weekly', 'monthly'].includes(type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot type',
                message: 'Snapshot type must be either "weekly" or "monthly"'
            });
        }

        const snapshotDate = new Date(date);
        if (isNaN(snapshotDate.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format',
                message: 'Date must be in YYYY-MM-DD format'
            });
        }

        const query = `
            SELECT *
            FROM account_manager_snapshots
            WHERE snapshot_type = ?
            AND snapshot_date = ?
            AND account_manager = ?
        `;

        const result = await db.query(query, [type, date, accountManager]);
        
        if (result.rows.length === 0) {
            // Try to find nearest snapshot for this account manager
            const nearestQuery = `
                SELECT * FROM get_nearest_snapshot_date(?, ?, ?)
            `;
            const nearestResult = await db.query(nearestQuery, [date, type, accountManager]);
            
            return res.status(404).json({ 
                error: 'Snapshot not found for this date and account manager',
                message: `No ${type} snapshot available for ${accountManager} on ${date}`,
                suggestion: nearestResult.rows.length > 0 ? {
                    nearest_date: nearestResult.rows[0].snapshot_date,
                    days_difference: nearestResult.rows[0].days_difference,
                    message: `Nearest snapshot for ${accountManager} is ${nearestResult.rows[0].days_difference} days away`
                } : null
            });
        }
        
        res.json({ 
            success: true, 
            data: result.rows[0],
            message: `${type} snapshot retrieved for ${accountManager} on ${date}`
        });

    } catch (error) {
        console.error(`[ERROR] Failed to fetch snapshot for ${req.params.accountManager} on ${req.params.date}:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve account manager snapshot data'
        });
    }
});

/**
 * POST /api/snapshots/manual
 * Create manual snapshot for any date (global)
 */
router.post('/snapshots/manual', async (req, res) => {
    try {
        const {
            snapshot_type,
            snapshot_date,
            description,
            created_by,
            total_opportunities,
            submitted_count,
            submitted_amount,
            op100_count,
            op100_amount,
            op90_count,
            op90_amount,
            op60_count,
            op60_amount,
            op30_count,
            op30_amount,
            lost_count,
            lost_amount,
            inactive_count,
            ongoing_count,
            pending_count,
            declined_count,
            revised_count
        } = req.body;

        // Validate required fields
        if (!snapshot_type || !['weekly', 'monthly'].includes(snapshot_type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot_type',
                message: 'snapshot_type must be either "weekly" or "monthly"'
            });
        }

        if (!snapshot_date) {
            return res.status(400).json({ 
                error: 'Missing snapshot_date',
                message: 'snapshot_date is required in YYYY-MM-DD format'
            });
        }

        // Validate date
        const dateObj = new Date(snapshot_date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format',
                message: 'snapshot_date must be in YYYY-MM-DD format'
            });
        }

        if (total_opportunities === undefined || total_opportunities === null) {
            return res.status(400).json({ 
                error: 'Missing required field',
                message: 'total_opportunities is required'
            });
        }

        const query = `
            INSERT INTO dashboard_snapshots (
                snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
                op100_count, op100_amount, op90_count, op90_amount, 
                op60_count, op60_amount, op30_count, op30_amount,
                lost_count, lost_amount, inactive_count, ongoing_count,
                pending_count, declined_count, revised_count,
                is_manual, description, created_by
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                TRUE, ?, ?
            )
            ON CONFLICT (snapshot_type, snapshot_date)
            DO UPDATE SET
                total_opportunities = EXCLUDED.total_opportunities,
                submitted_count = EXCLUDED.submitted_count,
                submitted_amount = EXCLUDED.submitted_amount,
                op100_count = EXCLUDED.op100_count,
                op100_amount = EXCLUDED.op100_amount,
                op90_count = EXCLUDED.op90_count,
                op90_amount = EXCLUDED.op90_amount,
                op60_count = EXCLUDED.op60_count,
                op60_amount = EXCLUDED.op60_amount,
                op30_count = EXCLUDED.op30_count,
                op30_amount = EXCLUDED.op30_amount,
                lost_count = EXCLUDED.lost_count,
                lost_amount = EXCLUDED.lost_amount,
                inactive_count = EXCLUDED.inactive_count,
                ongoing_count = EXCLUDED.ongoing_count,
                pending_count = EXCLUDED.pending_count,
                declined_count = EXCLUDED.declined_count,
                revised_count = EXCLUDED.revised_count,
                is_manual = TRUE,
                description = EXCLUDED.description,
                created_by = EXCLUDED.created_by,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, snapshot_date, created_at
        `;

        const values = [
            snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
            op100_count, op100_amount, op90_count, op90_amount,
            op60_count, op60_amount, op30_count, op30_amount,
            lost_count, lost_amount, inactive_count, ongoing_count,
            pending_count, declined_count, revised_count,
            description, created_by
        ];

        const result = await db.query(query, values);

        res.status(201).json({
            success: true,
            message: `Manual ${snapshot_type} snapshot created for ${snapshot_date}`,
            data: {
                id: result.rows[0].id,
                snapshot_type,
                snapshot_date,
                description,
                created_by,
                created_at: result.rows[0].created_at,
                is_manual: true
            }
        });

    } catch (error) {
        console.error('[ERROR] Failed to create manual snapshot:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to create manual snapshot'
        });
    }
});

/**
 * POST /api/snapshots/manual/account-manager
 * Create manual snapshot for specific account manager and date
 */
router.post('/snapshots/manual/account-manager', async (req, res) => {
    try {
        const {
            account_manager,
            snapshot_type,
            snapshot_date,
            description,
            created_by,
            total_opportunities,
            submitted_count,
            submitted_amount,
            op100_count,
            op100_amount,
            op90_count,
            op90_amount,
            op60_count,
            op60_amount,
            op30_count,
            op30_amount,
            lost_count,
            lost_amount,
            inactive_count,
            ongoing_count,
            pending_count,
            declined_count,
            revised_count
        } = req.body;

        // Validate required fields
        if (!account_manager || !snapshot_type || !snapshot_date) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'account_manager, snapshot_type, and snapshot_date are required'
            });
        }

        // Validate snapshot type
        if (!['weekly', 'monthly'].includes(snapshot_type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot type',
                message: 'Snapshot type must be either "weekly" or "monthly"'
            });
        }

        // Validate date
        const dateObj = new Date(snapshot_date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format',
                message: 'snapshot_date must be in YYYY-MM-DD format'
            });
        }

        const query = `
            INSERT INTO account_manager_snapshots (
                account_manager,
                snapshot_type,
                snapshot_date,
                total_opportunities,
                submitted_count,
                submitted_amount,
                op100_count,
                op100_amount,
                op90_count,
                op90_amount,
                op60_count,
                op60_amount,
                op30_count,
                op30_amount,
                lost_count,
                lost_amount,
                inactive_count,
                ongoing_count,
                pending_count,
                declined_count,
                revised_count,
                is_manual,
                description,
                created_by
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?
            )
            ON CONFLICT (account_manager, snapshot_type, snapshot_date) 
            DO UPDATE SET
                total_opportunities = EXCLUDED.total_opportunities,
                submitted_count = EXCLUDED.submitted_count,
                submitted_amount = EXCLUDED.submitted_amount,
                op100_count = EXCLUDED.op100_count,
                op100_amount = EXCLUDED.op100_amount,
                op90_count = EXCLUDED.op90_count,
                op90_amount = EXCLUDED.op90_amount,
                op60_count = EXCLUDED.op60_count,
                op60_amount = EXCLUDED.op60_amount,
                op30_count = EXCLUDED.op30_count,
                op30_amount = EXCLUDED.op30_amount,
                lost_count = EXCLUDED.lost_count,
                lost_amount = EXCLUDED.lost_amount,
                inactive_count = EXCLUDED.inactive_count,
                ongoing_count = EXCLUDED.ongoing_count,
                pending_count = EXCLUDED.pending_count,
                declined_count = EXCLUDED.declined_count,
                revised_count = EXCLUDED.revised_count,
                is_manual = TRUE,
                description = EXCLUDED.description,
                created_by = EXCLUDED.created_by,
                created_at = CURRENT_TIMESTAMP
            RETURNING id, created_at
        `;

        const values = [
            account_manager,
            snapshot_type,
            snapshot_date,
            total_opportunities || 0,
            submitted_count || 0,
            submitted_amount || 0,
            op100_count || 0,
            op100_amount || 0,
            op90_count || 0,
            op90_amount || 0,
            op60_count || 0,
            op60_amount || 0,
            op30_count || 0,
            op30_amount || 0,
            lost_count || 0,
            lost_amount || 0,
            inactive_count || 0,
            ongoing_count || 0,
            pending_count || 0,
            declined_count || 0,
            revised_count || 0,
            description,
            created_by
        ];

        const result = await db.query(query, values);

        res.json({
            success: true,
            data: {
                id: result.rows[0].id,
                account_manager,
                snapshot_type,
                snapshot_date,
                description,
                created_by,
                created_at: result.rows[0].created_at,
                is_manual: true
            },
            message: `Manual ${snapshot_type} snapshot created for ${account_manager} on ${snapshot_date}`
        });

    } catch (error) {
        console.error('Error creating manual account manager snapshot:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to create manual account manager snapshot'
        });
    }
});

/**
 * GET /api/snapshots/summary
 * Get summary of all snapshots for analytics
 */
router.get('/snapshots/summary', async (req, res) => {
    try {
        const summaryQuery = `SELECT * FROM get_snapshot_summary()`;
        const summaryResult = await db.query(summaryQuery);

        // Get account manager snapshot counts
        const accountMgrQuery = `
            SELECT
                snapshot_type,
                COUNT(*) as total_snapshots,
                COUNT(DISTINCT account_manager) as unique_account_managers,
                COUNT(CASE WHEN is_manual THEN 1 END) as manual_snapshots,
                MAX(snapshot_date) as latest_date,
                MIN(snapshot_date) as oldest_date
            FROM account_manager_snapshots
            GROUP BY snapshot_type
        `;
        const accountMgrResult = await db.query(accountMgrQuery);

        res.json({
            success: true,
            summary: {
                global_snapshots: summaryResult.rows,
                account_manager_snapshots: accountMgrResult.rows,
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[ERROR] Failed to fetch snapshot summary:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve snapshot summary'
        });
    }
});

module.exports = router;