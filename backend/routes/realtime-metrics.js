/**
 * Realtime Metrics API Module
 * Purpose: Handle realtime account manager metrics and automated snapshots
 * Features: Live metrics, auto-snapshots, performance optimized queries
 */

const db = require('../../db_adapter');
const express = require('express');
const router = express.Router();

/**
 * GET /api/realtime/account-managers
 * Get list of all account managers with basic metrics
 */
router.get('/realtime/account-managers', async (req, res) => {
    try {
        const query = `
            SELECT 
                om.account_mgr as account_manager,
                COUNT(*) as total_opportunities,
                COUNT(CASE WHEN om.status = 'Submitted' THEN 1 END) as submitted_count,
                COALESCE(SUM(CASE WHEN om.status = 'Submitted' THEN om.final_amt END), 0) as submitted_amount,
                COUNT(CASE WHEN om.opp_status IN ('OP100', 'OP90', 'OP60', 'OP30') THEN 1 END) as active_pipeline_count,
                COALESCE(SUM(CASE WHEN om.opp_status IN ('OP100', 'OP90', 'OP60', 'OP30') THEN om.final_amt END), 0) as active_pipeline_amount,
                MAX(om.date_received) as last_activity
            FROM opps_monitoring om
            INNER JOIN role_definitions rd ON rd.code = om.account_mgr 
            WHERE rd.role_type = 'account_manager' 
            AND rd.is_active = 1
            AND (om.is_deleted = 0 OR om.is_deleted IS NULL)
            AND om.account_mgr IS NOT NULL 
            AND om.account_mgr != ''
            GROUP BY om.account_mgr
            ORDER BY submitted_amount DESC, om.account_mgr
        `;

        const result = await db.query(query);

        res.json({
            success: true,
            account_managers: result.rows.map(row => ({
                name: row.account_manager,
                metrics: {
                    total_opportunities: parseInt(row.total_opportunities),
                    submitted_count: parseInt(row.submitted_count),
                    submitted_amount: parseFloat(row.submitted_amount) || 0,
                    active_pipeline_count: parseInt(row.active_pipeline_count),
                    active_pipeline_amount: parseFloat(row.active_pipeline_amount) || 0
                },
                last_activity: row.last_activity
            })),
            count: result.rows.length,
            generated_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ERROR] Failed to fetch account managers list:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve account managers data'
        });
    }
});

/**
 * GET /api/realtime/account-managers/:name/metrics
 * Get detailed realtime metrics for specific account manager
 */
router.get('/realtime/account-managers/:name/metrics', async (req, res) => {
    try {
        const { name } = req.params;
        const { comparison_date, comparison_type } = req.query;

        // Validate that the person is actually an account manager (SQLite version)
        const validationQuery = `
            SELECT COUNT(*) as count
            FROM opps_monitoring
            WHERE account_mgr = ?
            AND (is_deleted = 0 OR is_deleted IS NULL)
            LIMIT 1
        `;
        const validationResult = await db.query(validationQuery, [name]);

        if (!validationResult.rows[0].count || validationResult.rows[0].count === 0) {
            return res.status(404).json({
                error: 'Invalid account manager',
                message: `${name} is not a valid account manager. Only active account managers can be tracked.`
            });
        }

        // Get current metrics for this account manager
        const metricsQuery = `
            SELECT 
                account_mgr as account_manager,
                COUNT(*) as total_opportunities,
                
                -- Submitted metrics
                COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as submitted_count,
                COALESCE(SUM(CASE WHEN status = 'Submitted' THEN final_amt END), 0) as submitted_amount,
                
                -- Pipeline metrics
                COUNT(CASE WHEN opp_status = 'OP100' THEN 1 END) as op100_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP100' THEN final_amt END), 0) as op100_amount,
                COUNT(CASE WHEN opp_status = 'OP90' THEN 1 END) as op90_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP90' THEN final_amt END), 0) as op90_amount,
                COUNT(CASE WHEN opp_status = 'OP60' THEN 1 END) as op60_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP60' THEN final_amt END), 0) as op60_amount,
                COUNT(CASE WHEN opp_status = 'OP30' THEN 1 END) as op30_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP30' THEN final_amt END), 0) as op30_amount,
                
                -- Final status metrics
                COUNT(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN 1 END) as lost_count,
                COALESCE(SUM(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN final_amt END), 0) as lost_amount,
                COUNT(CASE WHEN opp_status = 'Inactive' THEN 1 END) as inactive_count,
                COUNT(CASE WHEN status = 'On-Going' THEN 1 END) as ongoing_count,
                COUNT(CASE WHEN decision = 'Pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN decision = 'Decline' THEN 1 END) as declined_count,
                
                -- Revision metrics
                COUNT(CASE WHEN opp_status = 'Revised' THEN 1 END) as revised_count,
                
                -- Activity metrics
                MAX(date_received) as last_activity,
                COUNT(CASE WHEN date_received = date('now') THEN 1 END) as today_updates
                
            FROM opps_monitoring
            WHERE account_mgr = ?
            AND (is_deleted = 0 OR is_deleted IS NULL)
            GROUP BY account_mgr
        `;

        const metricsResult = await db.query(metricsQuery, [name]);

        if (metricsResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Account manager not found',
                message: `No data found for account manager: ${name}`
            });
        }

        const currentMetrics = metricsResult.rows[0];

        // Get comparison data if requested
        let comparisonData = null;
        let deltaMetrics = null;

        if (comparison_date && comparison_type) {
            if (comparison_type === 'custom') {
                // For custom snapshots, get account manager data as of the custom date
                // by querying opps_monitoring table with date filter
                const customComparisonQuery = `
                    SELECT 
                        account_mgr as account_manager,
                        COUNT(*) as total_opportunities,
                        
                        -- Submitted metrics
                        COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as submitted_count,
                        COALESCE(SUM(CASE WHEN status = 'Submitted' THEN final_amt END), 0) as submitted_amount,
                        
                        -- Pipeline metrics
                        COUNT(CASE WHEN opp_status = 'OP100' THEN 1 END) as op100_count,
                        COALESCE(SUM(CASE WHEN opp_status = 'OP100' THEN final_amt END), 0) as op100_amount,
                        COUNT(CASE WHEN opp_status = 'OP90' THEN 1 END) as op90_count,
                        COALESCE(SUM(CASE WHEN opp_status = 'OP90' THEN final_amt END), 0) as op90_amount,
                        COUNT(CASE WHEN opp_status = 'OP60' THEN 1 END) as op60_count,
                        COALESCE(SUM(CASE WHEN opp_status = 'OP60' THEN final_amt END), 0) as op60_amount,
                        COUNT(CASE WHEN opp_status = 'OP30' THEN 1 END) as op30_count,
                        COALESCE(SUM(CASE WHEN opp_status = 'OP30' THEN final_amt END), 0) as op30_amount,
                        
                        -- Final status metrics
                        COUNT(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN 1 END) as lost_count,
                        COALESCE(SUM(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN final_amt END), 0) as lost_amount,
                        COUNT(CASE WHEN opp_status = 'Inactive' THEN 1 END) as inactive_count,
                        COUNT(CASE WHEN status = 'On-Going' THEN 1 END) as ongoing_count,
                        COUNT(CASE WHEN decision = 'Pending' THEN 1 END) as pending_count,
                        COUNT(CASE WHEN decision = 'Decline' THEN 1 END) as declined_count,
                        
                        -- Revision metrics
                        COUNT(CASE WHEN opp_status = 'Revised' THEN 1 END) as revised_count
                        
                    FROM opps_monitoring
                    WHERE account_mgr = ?
                    AND date_received <= ?
                    AND (is_deleted = 0 OR is_deleted IS NULL)
                    GROUP BY account_mgr
                `;

                const customComparisonResult = await db.query(customComparisonQuery, [name, comparison_date]);
                
                if (customComparisonResult.rows.length > 0) {
                    comparisonData = customComparisonResult.rows[0];
                    
                    // Calculate deltas
                    deltaMetrics = {
                        total_opportunities: parseInt(currentMetrics.total_opportunities) - (parseInt(comparisonData.total_opportunities) || 0),
                        submitted_count: parseInt(currentMetrics.submitted_count) - (parseInt(comparisonData.submitted_count) || 0),
                        submitted_amount: (parseFloat(currentMetrics.submitted_amount) || 0) - (parseFloat(comparisonData.submitted_amount) || 0),
                        op100_count: parseInt(currentMetrics.op100_count) - (parseInt(comparisonData.op100_count) || 0),
                        op100_amount: (parseFloat(currentMetrics.op100_amount) || 0) - (parseFloat(comparisonData.op100_amount) || 0),
                        op90_count: parseInt(currentMetrics.op90_count) - (parseInt(comparisonData.op90_count) || 0),
                        op90_amount: (parseFloat(currentMetrics.op90_amount) || 0) - (parseFloat(comparisonData.op90_amount) || 0),
                        op60_count: parseInt(currentMetrics.op60_count) - (parseInt(comparisonData.op60_count) || 0),
                        op60_amount: (parseFloat(currentMetrics.op60_amount) || 0) - (parseFloat(comparisonData.op60_amount) || 0),
                        op30_count: parseInt(currentMetrics.op30_count) - (parseInt(comparisonData.op30_count) || 0),
                        op30_amount: (parseFloat(currentMetrics.op30_amount) || 0) - (parseFloat(comparisonData.op30_amount) || 0),
                        lost_count: parseInt(currentMetrics.lost_count) - (parseInt(comparisonData.lost_count) || 0),
                        lost_amount: (parseFloat(currentMetrics.lost_amount) || 0) - (parseFloat(comparisonData.lost_amount) || 0),
                        inactive_count: parseInt(currentMetrics.inactive_count) - (parseInt(comparisonData.inactive_count) || 0),
                        ongoing_count: parseInt(currentMetrics.ongoing_count) - (parseInt(comparisonData.ongoing_count) || 0),
                        pending_count: parseInt(currentMetrics.pending_count) - (parseInt(comparisonData.pending_count) || 0),
                        declined_count: parseInt(currentMetrics.declined_count) - (parseInt(comparisonData.declined_count) || 0),
                        revised_count: parseInt(currentMetrics.revised_count) - (parseInt(comparisonData.revised_count) || 0)
                    };
                }
            } else {
                // For weekly/monthly snapshots, use account manager snapshots table
                const comparisonQuery = `
                    SELECT *
                    FROM account_manager_snapshots
                    WHERE account_manager = ?
                    AND snapshot_type = ?
                    AND snapshot_date = ?
                    LIMIT 1
                `;

                const comparisonResult = await db.query(comparisonQuery, [name, comparison_type, comparison_date]);
                
                if (comparisonResult.rows.length > 0) {
                    comparisonData = comparisonResult.rows[0];
                    
                    // Calculate deltas
                    deltaMetrics = {
                        total_opportunities: parseInt(currentMetrics.total_opportunities) - (comparisonData.total_opportunities || 0),
                        submitted_count: parseInt(currentMetrics.submitted_count) - (comparisonData.submitted_count || 0),
                        submitted_amount: (parseFloat(currentMetrics.submitted_amount) || 0) - (parseFloat(comparisonData.submitted_amount) || 0),
                        op100_count: parseInt(currentMetrics.op100_count) - (comparisonData.op100_count || 0),
                        op100_amount: (parseFloat(currentMetrics.op100_amount) || 0) - (parseFloat(comparisonData.op100_amount) || 0),
                        op90_count: parseInt(currentMetrics.op90_count) - (comparisonData.op90_count || 0),
                        op90_amount: (parseFloat(currentMetrics.op90_amount) || 0) - (parseFloat(comparisonData.op90_amount) || 0),
                        op60_count: parseInt(currentMetrics.op60_count) - (comparisonData.op60_count || 0),
                        op60_amount: (parseFloat(currentMetrics.op60_amount) || 0) - (parseFloat(comparisonData.op60_amount) || 0),
                        op30_count: parseInt(currentMetrics.op30_count) - (comparisonData.op30_count || 0),
                        op30_amount: (parseFloat(currentMetrics.op30_amount) || 0) - (parseFloat(comparisonData.op30_amount) || 0),
                        lost_count: parseInt(currentMetrics.lost_count) - (comparisonData.lost_count || 0),
                        lost_amount: (parseFloat(currentMetrics.lost_amount) || 0) - (parseFloat(comparisonData.lost_amount) || 0),
                        inactive_count: parseInt(currentMetrics.inactive_count) - (comparisonData.inactive_count || 0),
                        ongoing_count: parseInt(currentMetrics.ongoing_count) - (comparisonData.ongoing_count || 0),
                        pending_count: parseInt(currentMetrics.pending_count) - (comparisonData.pending_count || 0),
                        declined_count: parseInt(currentMetrics.declined_count) - (comparisonData.declined_count || 0),
                        revised_count: parseInt(currentMetrics.revised_count) - (comparisonData.revised_count || 0)
                    };
                }
            }
        }

        // Format response
        const response = {
            success: true,
            account_manager: name,
            current_metrics: {
                total_opportunities: parseInt(currentMetrics.total_opportunities),
                submitted_count: parseInt(currentMetrics.submitted_count),
                submitted_amount: parseFloat(currentMetrics.submitted_amount) || 0,
                op100_count: parseInt(currentMetrics.op100_count),
                op100_amount: parseFloat(currentMetrics.op100_amount) || 0,
                op90_count: parseInt(currentMetrics.op90_count),
                op90_amount: parseFloat(currentMetrics.op90_amount) || 0,
                op60_count: parseInt(currentMetrics.op60_count),
                op60_amount: parseFloat(currentMetrics.op60_amount) || 0,
                op30_count: parseInt(currentMetrics.op30_count),
                op30_amount: parseFloat(currentMetrics.op30_amount) || 0,
                lost_count: parseInt(currentMetrics.lost_count),
                lost_amount: parseFloat(currentMetrics.lost_amount) || 0,
                inactive_count: parseInt(currentMetrics.inactive_count),
                ongoing_count: parseInt(currentMetrics.ongoing_count),
                pending_count: parseInt(currentMetrics.pending_count),
                declined_count: parseInt(currentMetrics.declined_count),
                revised_count: parseInt(currentMetrics.revised_count)
            },
            activity: {
                last_activity: currentMetrics.last_activity,
                today_updates: parseInt(currentMetrics.today_updates)
            },
            generated_at: new Date().toISOString()
        };

        // Add comparison data if available
        if (comparisonData && deltaMetrics) {
            response.comparison = {
                type: comparison_type,
                date: comparison_date,
                baseline_metrics: {
                    total_opportunities: comparisonData.total_opportunities || 0,
                    submitted_count: comparisonData.submitted_count || 0,
                    submitted_amount: parseFloat(comparisonData.submitted_amount) || 0,
                    op100_count: comparisonData.op100_count || 0,
                    op100_amount: parseFloat(comparisonData.op100_amount) || 0,
                    op90_count: comparisonData.op90_count || 0,
                    op90_amount: parseFloat(comparisonData.op90_amount) || 0,
                    op60_count: comparisonData.op60_count || 0,
                    op60_amount: parseFloat(comparisonData.op60_amount) || 0,
                    op30_count: comparisonData.op30_count || 0,
                    op30_amount: parseFloat(comparisonData.op30_amount) || 0,
                    lost_count: comparisonData.lost_count || 0,
                    lost_amount: parseFloat(comparisonData.lost_amount) || 0,
                    inactive_count: comparisonData.inactive_count || 0,
                    ongoing_count: comparisonData.ongoing_count || 0,
                    pending_count: comparisonData.pending_count || 0,
                    declined_count: comparisonData.declined_count || 0,
                    revised_count: comparisonData.revised_count || 0
                },
                delta_metrics: deltaMetrics
            };
        }

        res.json(response);

    } catch (error) {
        console.error(`[ERROR] Failed to fetch metrics for ${req.params.name}:`, error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve account manager metrics'
        });
    }
});

/**
 * POST /api/realtime/snapshots/auto-create
 * Automatically create snapshots for all account managers
 */
router.post('/realtime/snapshots/auto-create', async (req, res) => {
    try {
        const { snapshot_type, snapshot_date, created_by } = req.body;

        // Validate inputs
        if (!snapshot_type || !['weekly', 'monthly'].includes(snapshot_type)) {
            return res.status(400).json({ 
                error: 'Invalid snapshot_type',
                message: 'snapshot_type must be either "weekly" or "monthly"'
            });
        }

        const useDate = snapshot_date || new Date().toISOString().split('T')[0];
        const createdBy = created_by || 'System Auto-Create';

        // Get current metrics for all account managers
        const metricsQuery = `
            SELECT 
                account_mgr as account_manager,
                COUNT(*) as total_opportunities,
                COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as submitted_count,
                COALESCE(SUM(CASE WHEN status = 'Submitted' THEN final_amt END), 0) as submitted_amount,
                COUNT(CASE WHEN opp_status = 'OP100' THEN 1 END) as op100_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP100' THEN final_amt END), 0) as op100_amount,
                COUNT(CASE WHEN opp_status = 'OP90' THEN 1 END) as op90_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP90' THEN final_amt END), 0) as op90_amount,
                COUNT(CASE WHEN opp_status = 'OP60' THEN 1 END) as op60_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP60' THEN final_amt END), 0) as op60_amount,
                COUNT(CASE WHEN opp_status = 'OP30' THEN 1 END) as op30_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP30' THEN final_amt END), 0) as op30_amount,
                COUNT(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN 1 END) as lost_count,
                COALESCE(SUM(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN final_amt END), 0) as lost_amount,
                COUNT(CASE WHEN opp_status = 'Inactive' THEN 1 END) as inactive_count,
                COUNT(CASE WHEN status = 'On-Going' THEN 1 END) as ongoing_count,
                COUNT(CASE WHEN decision = 'Pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN decision = 'Decline' THEN 1 END) as declined_count,
                COALESCE(SUM(CASE WHEN rev IS NOT NULL AND rev > 0 THEN rev ELSE 0 END), 0) as revised_count
            FROM opps_monitoring 
            WHERE account_mgr IS NOT NULL AND account_mgr != ''
            AND (is_deleted = 0 OR is_deleted IS NULL)
            GROUP BY account_mgr
            ORDER BY account_mgr
        `;

        const metricsResult = await db.query(metricsQuery);

        if (metricsResult.rows.length === 0) {
            return res.status(400).json({
                error: 'No account managers found',
                message: 'No account manager data available to create snapshots'
            });
        }

        // Create snapshots for each account manager
        const createdSnapshots = [];
        const errors = [];

        for (const metrics of metricsResult.rows) {
            try {
                const insertQuery = `
                    INSERT INTO account_manager_snapshots (
                        account_manager, snapshot_type, snapshot_date,
                        total_opportunities, submitted_count, submitted_amount,
                        op100_count, op100_amount, op90_count, op90_amount,
                        op60_count, op60_amount, op30_count, op30_amount,
                        lost_count, lost_amount, inactive_count, ongoing_count,
                        pending_count, declined_count, revised_count,
                        is_manual, created_by
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, FALSE, ?
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
                        created_by = EXCLUDED.created_by,
                        created_at = datetime('now')
                    RETURNING id, created_at
                `;

                const values = [
                    metrics.account_manager, snapshot_type, useDate,
                    metrics.total_opportunities, metrics.submitted_count, metrics.submitted_amount,
                    metrics.op100_count, metrics.op100_amount, metrics.op90_count, metrics.op90_amount,
                    metrics.op60_count, metrics.op60_amount, metrics.op30_count, metrics.op30_amount,
                    metrics.lost_count, metrics.lost_amount, metrics.inactive_count, metrics.ongoing_count,
                    metrics.pending_count, metrics.declined_count, metrics.revised_count,
                    createdBy
                ];

                const insertResult = await db.query(insertQuery, values);
                
                createdSnapshots.push({
                    account_manager: metrics.account_manager,
                    id: insertResult.rows[0].id,
                    created_at: insertResult.rows[0].created_at
                });

            } catch (error) {
                errors.push({
                    account_manager: metrics.account_manager,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Auto-created ${snapshot_type} snapshots for ${useDate}`,
            summary: {
                total_account_managers: metricsResult.rows.length,
                snapshots_created: createdSnapshots.length,
                errors: errors.length
            },
            snapshots_created: createdSnapshots,
            errors: errors.length > 0 ? errors : undefined,
            snapshot_type,
            snapshot_date: useDate
        });

    } catch (error) {
        console.error('[ERROR] Failed to auto-create snapshots:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to auto-create account manager snapshots'
        });
    }
});

/**
 * GET /api/realtime/metrics/global
 * Get global realtime metrics (all account managers combined)
 */
router.get('/realtime/metrics/global', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_opportunities,
                COUNT(CASE WHEN status = 'Submitted' THEN 1 END) as submitted_count,
                COALESCE(SUM(CASE WHEN status = 'Submitted' THEN final_amt END), 0) as submitted_amount,
                COUNT(CASE WHEN opp_status = 'OP100' THEN 1 END) as op100_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP100' THEN final_amt END), 0) as op100_amount,
                COUNT(CASE WHEN opp_status = 'OP90' THEN 1 END) as op90_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP90' THEN final_amt END), 0) as op90_amount,
                COUNT(CASE WHEN opp_status = 'OP60' THEN 1 END) as op60_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP60' THEN final_amt END), 0) as op60_amount,
                COUNT(CASE WHEN opp_status = 'OP30' THEN 1 END) as op30_count,
                COALESCE(SUM(CASE WHEN opp_status = 'OP30' THEN final_amt END), 0) as op30_amount,
                COUNT(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN 1 END) as lost_count,
                COALESCE(SUM(CASE WHEN opp_status = 'LOST' OR decision = 'Lost' THEN final_amt END), 0) as lost_amount,
                COUNT(CASE WHEN opp_status = 'Inactive' THEN 1 END) as inactive_count,
                COUNT(CASE WHEN status = 'On-Going' THEN 1 END) as ongoing_count,
                COUNT(CASE WHEN decision = 'Pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN decision = 'Decline' THEN 1 END) as declined_count,
                COUNT(CASE WHEN opp_status = 'Revised' THEN 1 END) as revised_count,
                COUNT(DISTINCT account_mgr) as unique_account_managers,
                MAX(MAX(
                    COALESCE(created_at, '1970-01-01'), 
                    COALESCE(updated_at, '1970-01-01')
                )) as last_global_activity
            FROM opps_monitoring
            WHERE (is_deleted = 0 OR is_deleted IS NULL)
        `;

        const result = await db.query(query);
        const metrics = result.rows[0];

        res.json({
            success: true,
            global_metrics: {
                total_opportunities: parseInt(metrics.total_opportunities),
                submitted_count: parseInt(metrics.submitted_count),
                submitted_amount: parseFloat(metrics.submitted_amount) || 0,
                op100_count: parseInt(metrics.op100_count),
                op100_amount: parseFloat(metrics.op100_amount) || 0,
                op90_count: parseInt(metrics.op90_count),
                op90_amount: parseFloat(metrics.op90_amount) || 0,
                op60_count: parseInt(metrics.op60_count),
                op60_amount: parseFloat(metrics.op60_amount) || 0,
                op30_count: parseInt(metrics.op30_count),
                op30_amount: parseFloat(metrics.op30_amount) || 0,
                lost_count: parseInt(metrics.lost_count),
                lost_amount: parseFloat(metrics.lost_amount) || 0,
                inactive_count: parseInt(metrics.inactive_count),
                ongoing_count: parseInt(metrics.ongoing_count),
                pending_count: parseInt(metrics.pending_count),
                declined_count: parseInt(metrics.declined_count),
                revised_count: parseInt(metrics.revised_count),
                unique_account_managers: parseInt(metrics.unique_account_managers)
            },
            activity: {
                last_global_activity: metrics.last_global_activity
            },
            generated_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ERROR] Failed to fetch global metrics:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Failed to retrieve global metrics'
        });
    }
});

module.exports = router;