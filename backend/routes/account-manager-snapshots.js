/**
 * Account Manager Snapshots API Module
 * Purpose: Handle account manager-specific snapshot storage and retrieval
 */

const db = require('../../db_adapter');
const express = require('express');
const router = express.Router();

/**
 * GET /api/snapshots/:type/:accountManager
 * Retrieve a specific snapshot (weekly or monthly) for a specific account manager
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
            SELECT *
            FROM account_manager_snapshots
            WHERE snapshot_type = ?
            AND account_manager = ?
            ORDER BY saved_date DESC
            LIMIT 1
        `;

        const result = await db.query(query, [type, accountManager]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Snapshot not found',
                message: `No ${type} snapshot available for account manager ${accountManager}`
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(`[ERROR] Failed to fetch ${req.params.type} snapshot for ${req.params.accountManager}:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve snapshot data'
        });
    }
});

module.exports = router;
