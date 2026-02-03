/**
 * Snapshot Automation Service
 * Purpose: Automatically create snapshots for account managers and global metrics
 * Features: Scheduled snapshots, smart timing, error handling
 */

const cron = require('node-cron');

class SnapshotAutomationService {
    constructor(db) {
        this.db = db;
        this.isRunning = false;
        this.lastRunStatus = {
            weekly: { success: false, timestamp: null, errors: [] },
            monthly: { success: false, timestamp: null, errors: [] }
        };
    }

    /**
     * Start the automated snapshot service
     */
    start() {
        if (this.isRunning) {
            console.log('[SNAPSHOT-AUTO] Service already running');
            return;
        }

        console.log('[SNAPSHOT-AUTO] Starting automated snapshot service...');
        
        // Weekly snapshots: Every Monday at 1:30 PM (after lunch, before weekly meeting presentations)
        cron.schedule('30 13 * * 1', () => {
            this.createWeeklySnapshots();
        }, {
            scheduled: true,
            timezone: "Asia/Manila" // Adjust to your timezone
        });

        // Monthly snapshots: 1st day of every month at 10 AM
        cron.schedule('0 10 1 * *', () => {
            this.createMonthlySnapshots();
        }, {
            scheduled: true,
            timezone: "Asia/Manila" // Adjust to your timezone
        });

        // Daily health check: Every day at 8 AM
        cron.schedule('0 8 * * *', () => {
            this.performHealthCheck();
        }, {
            scheduled: true,
            timezone: "Asia/Manila"
        });

        this.isRunning = true;
        console.log('[SNAPSHOT-AUTO] Automated snapshot service started successfully');
    }

    /**
     * Stop the automated snapshot service
     */
    stop() {
        // Note: node-cron doesn't provide a direct way to stop all tasks
        // In a production environment, you might want to track task references
        this.isRunning = false;
        console.log('[SNAPSHOT-AUTO] Automated snapshot service stopped');
    }

    /**
     * Create weekly snapshots for all account managers and global metrics
     */
    async createWeeklySnapshots() {
        console.log('[SNAPSHOT-AUTO] Starting weekly snapshot creation...');
        
        try {
            const results = await this.createSnapshots('weekly');
            
            this.lastRunStatus.weekly = {
                success: results.success,
                timestamp: new Date(),
                errors: results.errors,
                summary: results.summary
            };

            if (results.success) {
                console.log(`[SNAPSHOT-AUTO] Weekly snapshots completed successfully: ${results.summary.total_created} snapshots created`);
            } else {
                console.error(`[SNAPSHOT-AUTO] Weekly snapshots completed with errors: ${results.errors.length} errors`);
            }

        } catch (error) {
            console.error('[SNAPSHOT-AUTO] Failed to create weekly snapshots:', error);
            this.lastRunStatus.weekly = {
                success: false,
                timestamp: new Date(),
                errors: [error.message]
            };
        }
    }

    /**
     * Create monthly snapshots for all account managers and global metrics
     */
    async createMonthlySnapshots() {
        console.log('[SNAPSHOT-AUTO] Starting monthly snapshot creation...');
        
        try {
            const results = await this.createSnapshots('monthly');
            
            this.lastRunStatus.monthly = {
                success: results.success,
                timestamp: new Date(),
                errors: results.errors,
                summary: results.summary
            };

            if (results.success) {
                console.log(`[SNAPSHOT-AUTO] Monthly snapshots completed successfully: ${results.summary.total_created} snapshots created`);
            } else {
                console.error(`[SNAPSHOT-AUTO] Monthly snapshots completed with errors: ${results.errors.length} errors`);
            }

        } catch (error) {
            console.error('[SNAPSHOT-AUTO] Failed to create monthly snapshots:', error);
            this.lastRunStatus.monthly = {
                success: false,
                timestamp: new Date(),
                errors: [error.message]
            };
        }
    }

    /**
     * Create snapshots for specified type (weekly or monthly)
     */
    async createSnapshots(snapshotType) {
        const today = new Date().toISOString().split('T')[0];
        const errors = [];
        let totalCreated = 0;

        try {
            // 1. Create global snapshot
            const globalMetrics = await this.getGlobalMetrics();
            if (globalMetrics) {
                await this.createGlobalSnapshot(snapshotType, today, globalMetrics);
                totalCreated++;
                console.log(`[SNAPSHOT-AUTO] Created global ${snapshotType} snapshot`);
            }

            // 2. Create account manager snapshots
            const accountManagers = await this.getAccountManagers();
            
            for (const manager of accountManagers) {
                try {
                    const managerMetrics = await this.getAccountManagerMetrics(manager.name);
                    if (managerMetrics) {
                        await this.createAccountManagerSnapshot(manager.name, snapshotType, today, managerMetrics);
                        totalCreated++;
                        console.log(`[SNAPSHOT-AUTO] Created ${snapshotType} snapshot for ${manager.name}`);
                    }
                } catch (error) {
                    console.error(`[SNAPSHOT-AUTO] Failed to create ${snapshotType} snapshot for ${manager.name}:`, error);
                    errors.push({
                        account_manager: manager.name,
                        error: error.message
                    });
                }
            }

            return {
                success: errors.length === 0,
                errors: errors,
                summary: {
                    total_created: totalCreated,
                    account_managers_processed: accountManagers.length,
                    snapshot_type: snapshotType,
                    snapshot_date: today
                }
            };

        } catch (error) {
            console.error(`[SNAPSHOT-AUTO] Critical error during ${snapshotType} snapshot creation:`, error);
            throw error;
        }
    }

    /**
     * Get global metrics from the opportunities table
     */
    async getGlobalMetrics() {
        const query = `
            SELECT
                COUNT(*) as total_opportunities,
                -- Cumulative submitted count: each submitted opp = 1 + number of revisions
                COALESCE(SUM(CASE WHEN status = 'Submitted' THEN 1 + COALESCE(rev, 0) END), 0) as submitted_count,
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
                COUNT(CASE WHEN opp_status = 'Revised' THEN 1 END) as revised_count
            FROM opps_monitoring
        `;

        const result = await this.db.query(query);
        return result.rows[0];
    }

    /**
     * Get list of account managers (only valid ones)
     */
    async getAccountManagers() {
        const query = `
            SELECT rd.code as name
            FROM role_definitions rd
            WHERE rd.role_type = 'account_manager'
            AND rd.is_active = TRUE
            AND rd.is_resigned = FALSE
            ORDER BY rd.code
        `;

        const result = await this.db.query(query);
        return result.rows;
    }

    /**
     * Get metrics for specific account manager
     */
    async getAccountManagerMetrics(accountManager) {
        const query = `
            SELECT
                COUNT(*) as total_opportunities,
                -- Cumulative submitted count: each submitted opp = 1 + number of revisions
                COALESCE(SUM(CASE WHEN status = 'Submitted' THEN 1 + COALESCE(rev, 0) END), 0) as submitted_count,
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
                COUNT(CASE WHEN opp_status = 'Revised' THEN 1 END) as revised_count
            FROM opps_monitoring 
            WHERE account_mgr = $1
        `;

        const result = await this.db.query(query, [accountManager]);
        return result.rows[0];
    }

    /**
     * Create global snapshot
     */
    async createGlobalSnapshot(snapshotType, snapshotDate, metrics) {
        const query = `
            INSERT INTO dashboard_snapshots (
                snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
                op100_count, op100_amount, op90_count, op90_amount, 
                op60_count, op60_amount, op30_count, op30_amount,
                lost_count, lost_amount, inactive_count, ongoing_count,
                pending_count, declined_count, revised_count,
                is_manual, description, created_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                FALSE, $21, 'System Auto-Snapshot'
            )
            ON CONFLICT (snapshot_type)
            DO UPDATE SET
                snapshot_date = EXCLUDED.snapshot_date,
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
                description = EXCLUDED.description,
                created_by = EXCLUDED.created_by,
                is_manual = EXCLUDED.is_manual,
                created_at = CURRENT_TIMESTAMP
        `;

        const values = [
            snapshotType, snapshotDate, 
            metrics.total_opportunities, metrics.submitted_count, metrics.submitted_amount,
            metrics.op100_count, metrics.op100_amount, metrics.op90_count, metrics.op90_amount,
            metrics.op60_count, metrics.op60_amount, metrics.op30_count, metrics.op30_amount,
            metrics.lost_count, metrics.lost_amount, metrics.inactive_count, metrics.ongoing_count,
            metrics.pending_count, metrics.declined_count, metrics.revised_count,
            `Auto-generated ${snapshotType} snapshot`
        ];

        await this.db.query(query, values);
    }

    /**
     * Create account manager snapshot
     */
    async createAccountManagerSnapshot(accountManager, snapshotType, snapshotDate, metrics) {
        const query = `
            INSERT INTO account_manager_snapshots (
                account_manager, snapshot_type, snapshot_date,
                total_opportunities, submitted_count, submitted_amount,
                op100_count, op100_amount, op90_count, op90_amount,
                op60_count, op60_amount, op30_count, op30_amount,
                lost_count, lost_amount, inactive_count, ongoing_count,
                pending_count, declined_count, revised_count
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21
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
                updated_at = CURRENT_TIMESTAMP
        `;

        const values = [
            accountManager, snapshotType, snapshotDate,
            metrics.total_opportunities, metrics.submitted_count, metrics.submitted_amount,
            metrics.op100_count, metrics.op100_amount, metrics.op90_count, metrics.op90_amount,
            metrics.op60_count, metrics.op60_amount, metrics.op30_count, metrics.op30_amount,
            metrics.lost_count, metrics.lost_amount, metrics.inactive_count, metrics.ongoing_count,
            metrics.pending_count, metrics.declined_count, metrics.revised_count
        ];

        await this.db.query(query, values);
    }

    /**
     * Perform daily health check
     */
    async performHealthCheck() {
        console.log('[SNAPSHOT-AUTO] Performing daily health check...');

        try {
            // Check if recent snapshots exist
            const weeklyCheck = await this.checkRecentSnapshot('weekly', 7); // Within last 7 days
            const monthlyCheck = await this.checkRecentSnapshot('monthly', 35); // Within last 35 days

            const healthReport = {
                timestamp: new Date(),
                weekly_snapshots_healthy: weeklyCheck.healthy,
                weekly_last_snapshot: weeklyCheck.lastSnapshot,
                monthly_snapshots_healthy: monthlyCheck.healthy,
                monthly_last_snapshot: monthlyCheck.lastSnapshot,
                last_run_status: this.lastRunStatus
            };

            console.log('[SNAPSHOT-AUTO] Health check completed:', healthReport);

            // Log warnings if snapshots are stale
            if (!weeklyCheck.healthy) {
                console.warn(`[SNAPSHOT-AUTO] WARNING: No recent weekly snapshots found. Last snapshot: ${weeklyCheck.lastSnapshot}`);
            }
            if (!monthlyCheck.healthy) {
                console.warn(`[SNAPSHOT-AUTO] WARNING: No recent monthly snapshots found. Last snapshot: ${monthlyCheck.lastSnapshot}`);
            }

            return healthReport;

        } catch (error) {
            console.error('[SNAPSHOT-AUTO] Health check failed:', error);
            return { error: error.message, timestamp: new Date() };
        }
    }

    /**
     * Check if recent snapshots exist within specified days
     */
    async checkRecentSnapshot(snapshotType, withinDays) {
        const query = `
            SELECT 
                snapshot_date, 
                created_at,
                COUNT(*) OVER() as total_count
            FROM dashboard_snapshots 
            WHERE snapshot_type = $1 
            AND snapshot_date >= CURRENT_DATE - INTERVAL '${withinDays} days'
            ORDER BY snapshot_date DESC 
            LIMIT 1
        `;

        const result = await this.db.query(query, [snapshotType]);
        
        return {
            healthy: result.rows.length > 0,
            lastSnapshot: result.rows.length > 0 ? result.rows[0].snapshot_date : null,
            totalCount: result.rows.length > 0 ? result.rows[0].total_count : 0
        };
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            running: this.isRunning,
            last_run_status: this.lastRunStatus,
            next_schedules: {
                weekly: 'Every Wednesday at 9:00 AM',
                monthly: '1st day of each month at 10:00 AM',
                health_check: 'Every day at 8:00 AM'
            }
        };
    }

    /**
     * Manual trigger for creating snapshots (for testing or admin use)
     */
    async triggerManualSnapshot(snapshotType, description = '') {
        console.log(`[SNAPSHOT-AUTO] Manual trigger for ${snapshotType} snapshots`);
        
        try {
            const results = await this.createSnapshots(snapshotType);
            
            // Update the status with manual trigger info
            this.lastRunStatus[snapshotType] = {
                success: results.success,
                timestamp: new Date(),
                errors: results.errors,
                summary: results.summary,
                manual_trigger: true,
                description: description
            };

            return results;
        } catch (error) {
            console.error(`[SNAPSHOT-AUTO] Manual trigger failed for ${snapshotType}:`, error);
            throw error;
        }
    }
}

module.exports = SnapshotAutomationService;