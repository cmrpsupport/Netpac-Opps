/**
 * Dashboard Snapshots API Module
 * Purpose: Handle dashboard snapshot storage and retrieval
 * Integration: Add to existing Express.js backend
 */

const express = require('express');
const router = express.Router();
const db = require('../../db_adapter');

/**
 * GET /api/snapshots/:type
 * Retrieve a specific snapshot (weekly or monthly)
 */
router.get('/snapshots/:type', async (req, res) => {
    try {
        const { type } = req.params;
        
        // Validate snapshot type
        if (!['weekly', 'monthly'].includes(type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot type',
                message: 'Snapshot type must be either "weekly" or "monthly"'
            });
        }

        // Query database for latest snapshot of specified type
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
                saved_date,
                created_at
            FROM dashboard_snapshots
            WHERE snapshot_type = ?
            ORDER BY snapshot_date DESC, created_at DESC
            LIMIT 1
        `;

        const result = await db.query(query, [type]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Snapshot not found',
                message: `No ${type} snapshot available`
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(`[ERROR] Failed to fetch ${req.params.type} snapshot:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve snapshot data'
        });
    }
});

/**
 * POST /api/snapshots
 * Save or update a snapshot
 */
router.post('/snapshots', async (req, res) => {
    try {
        const {
            snapshot_type,
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

        if (total_opportunities === undefined || total_opportunities === null) {
            return res.status(400).json({ 
                error: 'Missing required field',
                message: 'total_opportunities is required'
            });
        }

        // Upsert snapshot data
        const query = `
            INSERT INTO dashboard_snapshots (
                snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
                op100_count, op100_amount, op90_count, op90_amount,
                op60_count, op60_amount, op30_count, op30_amount,
                lost_count, lost_amount, inactive_count, ongoing_count,
                pending_count, declined_count, revised_count
            ) VALUES (
                ?, CURRENT_DATE, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            ON CONFLICT (snapshot_type)
            DO UPDATE SET
                snapshot_date = CURRENT_DATE,
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
                saved_date = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const values = [
            snapshot_type, total_opportunities, submitted_count, submitted_amount,
            op100_count, op100_amount, op90_count, op90_amount,
            op60_count, op60_amount, op30_count, op30_amount,
            lost_count, lost_amount, inactive_count, ongoing_count,
            pending_count, declined_count, revised_count
        ];

        const result = await db.query(query, values);

        res.status(201).json({
            success: true,
            message: `${snapshot_type} snapshot saved successfully`,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[ERROR] Failed to save snapshot:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to save snapshot data'
        });
    }
});

/**
 * GET /api/snapshots
 * Retrieve all snapshots (optional - for admin/debugging)
 */
router.get('/snapshots', async (req, res) => {
    try {
        const query = `
            SELECT * FROM dashboard_snapshots
            ORDER BY snapshot_type, created_at DESC
        `;

        const result = await db.query(query);

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error('[ERROR] Failed to fetch all snapshots:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve snapshots'
        });
    }
});

/**
 * DELETE /api/snapshots/:type
 * Delete a specific snapshot (admin only)
 */
router.delete('/snapshots/:type', async (req, res) => {
    try {
        const { type } = req.params;
        
        if (!['weekly', 'monthly'].includes(type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot type',
                message: 'Snapshot type must be either "weekly" or "monthly"'
            });
        }

        const query = 'DELETE FROM dashboard_snapshots WHERE snapshot_type = ? RETURNING *';
        const result = await db.query(query, [type]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Snapshot not found',
                message: `No ${type} snapshot to delete`
            });
        }

        res.json({
            success: true,
            message: `${type} snapshot deleted successfully`,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(`[ERROR] Failed to delete ${req.params.type} snapshot:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to delete snapshot'
        });
    }
});

/**
 * GET /api/snapshots/:type/:accountManager
 * Retrieve a specific snapshot for a specific account manager
 */
router.get('/snapshots/:type/:accountManager', async (req, res) => {
    try {
        const { type, accountManager } = req.params;
        
        // Validate snapshot type
        if (!['weekly', 'monthly'].includes(type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot type',
                message: 'Snapshot type must be either "weekly" or "monthly"'
            });
        }

        // Query database for latest snapshot of specified type and account manager
        const query = `
            SELECT
                id,
                account_manager,
                snapshot_type,
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
                created_at
            FROM account_manager_snapshots
            WHERE snapshot_type = ? AND account_manager = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const result = await db.query(query, [type, accountManager]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Snapshot not found',
                message: `No ${type} snapshot found for account manager ${accountManager}`
            });
        }

        const snapshot = result.rows[0];
        
        res.json({
            success: true,
            data: snapshot,
            message: `${type} snapshot for ${accountManager} retrieved successfully`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`Error retrieving ${req.params.type} snapshot for ${req.params.accountManager}:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve account manager snapshot'
        });
    }
});

/**
 * POST /api/snapshots/account-manager
 * Save a new account manager-specific snapshot
 */
router.post('/snapshots/account-manager', async (req, res) => {
    try {
        const {
            account_manager,
            snapshot_type,
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
        if (!account_manager || !snapshot_type) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                message: 'account_manager and snapshot_type are required'
            });
        }

        // Validate snapshot type
        if (!['weekly', 'monthly'].includes(snapshot_type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot type',
                message: 'Snapshot type must be either "weekly" or "monthly"'
            });
        }

        // Insert or update snapshot
        const query = `
            INSERT INTO account_manager_snapshots (
                account_manager,
                snapshot_type,
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
                saved_date
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
            )
            ON CONFLICT (account_manager, snapshot_type)
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
                saved_date = CURRENT_TIMESTAMP
            RETURNING id, saved_date
        `;

        const values = [
            account_manager,
            snapshot_type,
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
            revised_count || 0
        ];

        const result = await db.query(query, values);
        
        res.json({
            success: true,
            data: {
                id: result.rows[0].id,
                account_manager,
                snapshot_type,
                saved_date: result.rows[0].saved_date
            },
            message: `Account manager ${snapshot_type} snapshot saved successfully`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error saving account manager snapshot:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to save account manager snapshot'
        });
    }
});

/**
 * GET /api/snapshots/custom-dates
 * Get all available snapshot dates for custom date selection
 */
router.get('/snapshots/custom-dates', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT
                snapshot_date,
                snapshot_type,
                created_at,
                'Global' as description
            FROM dashboard_snapshots
            UNION ALL
            SELECT DISTINCT
                snapshot_date,
                'custom' as snapshot_type,
                created_at,
                COALESCE(description, CONCAT('Custom - ', snapshot_date)) as description
            FROM custom_snapshots
            ORDER BY snapshot_date DESC, created_at DESC
        `;

        const result = await db.query(query);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('[ERROR] Failed to fetch snapshot dates:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve snapshot dates'
        });
    }
});

/**
 * POST /api/snapshots/custom
 * Create a custom snapshot for a specific date
 */
router.post('/snapshots/custom', async (req, res) => {
    try {
        const {
            snapshot_date,
            description,
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
        if (!snapshot_date) {
            return res.status(400).json({ 
                error: 'Missing required field',
                message: 'snapshot_date is required'
            });
        }

        if (total_opportunities === undefined || total_opportunities === null) {
            return res.status(400).json({ 
                error: 'Missing required field',
                message: 'total_opportunities is required'
            });
        }

        // Insert custom snapshot
        const query = `
            INSERT INTO custom_snapshots (
                snapshot_date, description, total_opportunities, submitted_count, submitted_amount,
                op100_count, op100_amount, op90_count, op90_amount,
                op60_count, op60_amount, op30_count, op30_amount,
                lost_count, lost_amount, inactive_count, ongoing_count,
                pending_count, declined_count, revised_count
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            RETURNING *
        `;

        const values = [
            snapshot_date, description || `Custom snapshot - ${snapshot_date}`,
            total_opportunities, submitted_count, submitted_amount,
            op100_count, op100_amount, op90_count, op90_amount,
            op60_count, op60_amount, op30_count, op30_amount,
            lost_count, lost_amount, inactive_count, ongoing_count,
            pending_count, declined_count, revised_count
        ];

        const result = await db.query(query, values);

        res.status(201).json({
            success: true,
            message: 'Custom snapshot saved successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[ERROR] Failed to save custom snapshot:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to save custom snapshot data'
        });
    }
});

/**
 * GET /api/snapshots/custom/:date
 * Retrieve a specific custom snapshot by date
 */
router.get('/snapshots/custom/:date', async (req, res) => {
    try {
        const { date } = req.params;

        const query = `
            SELECT
                id,
                snapshot_date,
                description,
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
                created_at
            FROM custom_snapshots
            WHERE snapshot_date = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const result = await db.query(query, [date]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Snapshot not found',
                message: `No custom snapshot found for date ${date}`
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(`[ERROR] Failed to fetch custom snapshot for ${req.params.date}:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve custom snapshot data'
        });
    }
});

module.exports = router;
