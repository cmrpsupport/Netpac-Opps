/**
 * Business-Specific Snapshot Scheduler
 * Purpose: Handle snapshots according to actual business meeting schedule
 * 
 * Meeting Schedule:
 * - Weekly Reports: Every Wednesday (compare to previous Wednesday)
 * - Townhall Meetings: First Friday of month (sometimes second Friday)
 * - Monthly Comparison: Compare to first day of previous month
 */

const cron = require('node-cron');

class BusinessSnapshotScheduler {
    constructor(db) {
        this.db = db;
        this.isRunning = false;
        this.lastRunStatus = {
            weekly_president: { success: false, timestamp: null, errors: [], next_wednesday: null },
            monthly_townhall: { success: false, timestamp: null, errors: [], next_townhall: null }
        };
    }

    /**
     * Start the business-specific automated snapshot service
     */
    start() {
        if (this.isRunning) {
            console.log('[BUSINESS-SNAPSHOT] Service already running');
            return;
        }

        console.log('[BUSINESS-SNAPSHOT] Starting business-specific snapshot service...');
        
        // Weekly Reports: Every Monday at 1:30 PM
        cron.schedule('30 13 * * 1', () => {
            this.createPresidentReportSnapshot();
        }, {
            scheduled: true,
            timezone: "Asia/Manila"
        });

        // Monthly Townhall Prep: First Friday 7 AM
        cron.schedule('0 7 1-7 * 5', () => {
            this.createTownhallSnapshot();
        }, {
            scheduled: true,
            timezone: "Asia/Manila"
        });

        // Also check for second Friday if first Friday is not available
        cron.schedule('0 7 8-14 * 5', () => {
            this.checkSecondFridayTownhall();
        }, {
            scheduled: true,
            timezone: "Asia/Manila"
        });

        this.isRunning = true;
        console.log('[BUSINESS-SNAPSHOT] Business snapshot service started successfully');
        console.log('[BUSINESS-SNAPSHOT] - Weekly reports: Every Monday 1:30 PM');
        console.log('[BUSINESS-SNAPSHOT] - Townhall prep: First Friday 7 AM (or second Friday)');
    }

    /**
     * Create snapshot for Wednesday Weekly Reports
     * Compare against previous Wednesday
     */
    async createPresidentReportSnapshot() {
        console.log('[BUSINESS-SNAPSHOT] Creating Weekly Report snapshots for Wednesday...');
        
        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            // Create both global and account manager snapshots
            const results = await this.createSnapshots('weekly_president', todayStr, 'Weekly Report - ' + this.formatDate(today));
            
            this.lastRunStatus.weekly_president = {
                success: results.success,
                timestamp: new Date(),
                errors: results.errors,
                summary: results.summary,
                next_wednesday: this.getNextWednesday()
            };

            if (results.success) {
                console.log(`[BUSINESS-SNAPSHOT] Weekly Report snapshots completed: ${results.summary.total_created} snapshots created`);
            } else {
                console.error(`[BUSINESS-SNAPSHOT] Weekly Report snapshots had errors: ${results.errors.length} errors`);
            }

        } catch (error) {
            console.error('[BUSINESS-SNAPSHOT] Failed to create Weekly Report snapshots:', error);
            this.lastRunStatus.weekly_president = {
                success: false,
                timestamp: new Date(),
                errors: [error.message],
                next_wednesday: this.getNextWednesday()
            };
        }
    }

    /**
     * Create snapshot for First Friday Townhall
     * Compare against first day of previous month
     */
    async createTownhallSnapshot() {
        console.log('[BUSINESS-SNAPSHOT] Creating Townhall snapshots for First Friday...');
        
        try {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            // Check if this is actually the first Friday
            const isFirstFriday = this.isFirstFridayOfMonth(today);
            
            if (!isFirstFriday) {
                console.log('[BUSINESS-SNAPSHOT] Not first Friday, skipping...');
                return;
            }

            const results = await this.createSnapshots('monthly_townhall', todayStr, 'Townhall Meeting - ' + this.formatDate(today));
            
            this.lastRunStatus.monthly_townhall = {
                success: results.success,
                timestamp: new Date(),
                errors: results.errors,
                summary: results.summary,
                next_townhall: this.getNextTownhallFriday()
            };

            if (results.success) {
                console.log(`[BUSINESS-SNAPSHOT] Townhall snapshots completed: ${results.summary.total_created} snapshots created`);
            } else {
                console.error(`[BUSINESS-SNAPSHOT] Townhall snapshots had errors: ${results.errors.length} errors`);
            }

        } catch (error) {
            console.error('[BUSINESS-SNAPSHOT] Failed to create Townhall snapshots:', error);
        }
    }

    /**
     * Check if second Friday should be used for townhall
     */
    async checkSecondFridayTownhall() {
        const today = new Date();
        const firstFriday = this.getFirstFridayOfMonth(today);
        
        // Only use second Friday if no townhall snapshot was created on first Friday
        const hasFirstFridaySnapshot = await this.hasSnapshotForDate('monthly_townhall', firstFriday.toISOString().split('T')[0]);
        
        if (!hasFirstFridaySnapshot) {
            console.log('[BUSINESS-SNAPSHOT] Using Second Friday for Townhall (First Friday was skipped)');
            await this.createTownhallSnapshot();
        }
    }

    /**
     * Get comparison snapshot for Weekly Reports (previous Wednesday)
     */
    async getPresidentReportComparison(currentDate = new Date()) {
        const previousWednesday = this.getPreviousWednesday(currentDate);
        const previousWedStr = previousWednesday.toISOString().split('T')[0];
        
        try {
            // Look for snapshot from previous Wednesday
            const query = `
                SELECT * FROM dashboard_snapshots 
                WHERE snapshot_type = 'weekly_president' 
                AND snapshot_date = $1
                ORDER BY created_at DESC 
                LIMIT 1
            `;
            
            const result = await this.db.query(query, [previousWedStr]);
            
            if (result.rows.length > 0) {
                return {
                    found: true,
                    snapshot: result.rows[0],
                    comparison_date: previousWedStr,
                    comparison_label: `Previous Wednesday (${this.formatDate(previousWednesday)})`
                };
            } else {
                // Fallback to nearest snapshot
                const nearestQuery = `
                    SELECT * FROM get_nearest_snapshot_date($1, 'weekly_president', NULL)
                `;
                const nearestResult = await this.db.query(nearestQuery, [previousWedStr]);
                
                return {
                    found: false,
                    nearest: nearestResult.rows[0] || null,
                    comparison_date: previousWedStr,
                    comparison_label: `Target: Previous Wednesday (${this.formatDate(previousWednesday)}) - Not found`
                };
            }
            
        } catch (error) {
            console.error('[BUSINESS-SNAPSHOT] Error getting Weekly Report comparison:', error);
            return null;
        }
    }

    /**
     * Get comparison snapshot for Townhall (first day of previous month)
     */
    async getTownhallComparison(currentDate = new Date()) {
        const firstDayPrevMonth = this.getFirstDayOfPreviousMonth(currentDate);
        const firstDayStr = firstDayPrevMonth.toISOString().split('T')[0];
        
        try {
            // Look for snapshot from first day of previous month
            const query = `
                SELECT * FROM dashboard_snapshots 
                WHERE snapshot_type = 'monthly_townhall' 
                AND snapshot_date = $1
                ORDER BY created_at DESC 
                LIMIT 1
            `;
            
            const result = await this.db.query(query, [firstDayStr]);
            
            if (result.rows.length > 0) {
                return {
                    found: true,
                    snapshot: result.rows[0],
                    comparison_date: firstDayStr,
                    comparison_label: `First day of previous month (${this.formatDate(firstDayPrevMonth)})`
                };
            } else {
                // Look for nearest snapshot to first day of previous month
                const nearestQuery = `
                    SELECT * FROM get_nearest_snapshot_date($1, 'monthly_townhall', NULL)
                `;
                const nearestResult = await this.db.query(nearestQuery, [firstDayStr]);
                
                return {
                    found: false,
                    nearest: nearestResult.rows[0] || null,
                    comparison_date: firstDayStr,
                    comparison_label: `Target: First day of previous month (${this.formatDate(firstDayPrevMonth)}) - Not found`
                };
            }
            
        } catch (error) {
            console.error('[BUSINESS-SNAPSHOT] Error getting Townhall comparison:', error);
            return null;
        }
    }

    /**
     * Create snapshots using the base snapshot creation logic
     */
    async createSnapshots(snapshotType, snapshotDate, description) {
        const errors = [];
        let totalCreated = 0;

        try {
            // 1. Create global snapshot
            const globalMetrics = await this.getGlobalMetrics();
            if (globalMetrics) {
                await this.createGlobalSnapshot(snapshotType, snapshotDate, globalMetrics, description);
                totalCreated++;
                console.log(`[BUSINESS-SNAPSHOT] Created global ${snapshotType} snapshot`);
            }

            // 2. Create account manager snapshots
            const accountManagers = await this.getAccountManagers();
            
            for (const manager of accountManagers) {
                try {
                    const managerMetrics = await this.getAccountManagerMetrics(manager.code);
                    if (managerMetrics) {
                        await this.createAccountManagerSnapshot(manager.code, snapshotType, snapshotDate, managerMetrics, description);
                        totalCreated++;
                        console.log(`[BUSINESS-SNAPSHOT] Created ${snapshotType} snapshot for ${manager.code}`);
                    }
                } catch (error) {
                    console.error(`[BUSINESS-SNAPSHOT] Failed to create ${snapshotType} snapshot for ${manager.code}:`, error);
                    errors.push({
                        account_manager: manager.code,
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
                    snapshot_date: snapshotDate
                }
            };

        } catch (error) {
            console.error(`[BUSINESS-SNAPSHOT] Critical error during ${snapshotType} snapshot creation:`, error);
            throw error;
        }
    }

    // Database query methods (reused from original automation service)
    async getGlobalMetrics() {
        const query = `
            SELECT
                COUNT(*) as total_opportunities,
                -- Cumulative submitted count: each submitted opp = 1 + number of revisions
                -- This tracks: On-Going→Submitted (+1), Submitted→Revision (no change), Revision→Submitted (+1 per rev)
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

    async getAccountManagers() {
        const query = `
            SELECT code, name
            FROM role_definitions
            WHERE role_type = 'account_manager'
            AND is_active = TRUE
            AND is_resigned = FALSE
            ORDER BY code
        `;
        const result = await this.db.query(query);
        return result.rows;
    }

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

    async createGlobalSnapshot(snapshotType, snapshotDate, metrics, description) {
        // First, check if a snapshot already exists
        const checkQuery = `
            SELECT id FROM dashboard_snapshots 
            WHERE snapshot_type = $1 AND snapshot_date = $2
            LIMIT 1
        `;
        
        const existingSnapshot = await this.db.query(checkQuery, [snapshotType, snapshotDate]);
        
        if (existingSnapshot.rows.length > 0) {
            // Update existing snapshot
            const updateQuery = `
                UPDATE dashboard_snapshots SET
                    total_opportunities = $3,
                    submitted_count = $4,
                    submitted_amount = $5,
                    op100_count = $6,
                    op100_amount = $7,
                    op90_count = $8,
                    op90_amount = $9,
                    op60_count = $10,
                    op60_amount = $11,
                    op30_count = $12,
                    op30_amount = $13,
                    lost_count = $14,
                    lost_amount = $15,
                    inactive_count = $16,
                    ongoing_count = $17,
                    pending_count = $18,
                    declined_count = $19,
                    revised_count = $20,
                    description = $21,
                    created_at = CURRENT_TIMESTAMP,
                    is_manual = FALSE,
                    created_by = 'Business Scheduler'
                WHERE snapshot_type = $1 AND snapshot_date = $2
            `;
            
            const values = [
                snapshotType, snapshotDate,
                metrics.total_opportunities, metrics.submitted_count, metrics.submitted_amount,
                metrics.op100_count, metrics.op100_amount, metrics.op90_count, metrics.op90_amount,
                metrics.op60_count, metrics.op60_amount, metrics.op30_count, metrics.op30_amount,
                metrics.lost_count, metrics.lost_amount, metrics.inactive_count, metrics.ongoing_count,
                metrics.pending_count, metrics.declined_count, metrics.revised_count,
                description
            ];
            
            await this.db.query(updateQuery, values);
            
        } else {
            // Insert new snapshot
            const insertQuery = `
                INSERT INTO dashboard_snapshots (
                    snapshot_type, snapshot_date, total_opportunities, submitted_count, submitted_amount,
                    op100_count, op100_amount, op90_count, op90_amount, 
                    op60_count, op60_amount, op30_count, op30_amount,
                    lost_count, lost_amount, inactive_count, ongoing_count,
                    pending_count, declined_count, revised_count,
                    is_manual, description, created_by, created_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                    FALSE, $21, 'Business Scheduler', CURRENT_TIMESTAMP
                )
            `;
            
            const values = [
                snapshotType, snapshotDate, 
                metrics.total_opportunities, metrics.submitted_count, metrics.submitted_amount,
                metrics.op100_count, metrics.op100_amount, metrics.op90_count, metrics.op90_amount,
                metrics.op60_count, metrics.op60_amount, metrics.op30_count, metrics.op30_amount,
                metrics.lost_count, metrics.lost_amount, metrics.inactive_count, metrics.ongoing_count,
                metrics.pending_count, metrics.declined_count, metrics.revised_count,
                description
            ];
            
            await this.db.query(insertQuery, values);
        }
    }

    async createAccountManagerSnapshot(accountManager, snapshotType, snapshotDate, metrics, description) {
        const query = `
            INSERT INTO account_manager_snapshots (
                account_manager, snapshot_type, snapshot_date,
                total_opportunities, submitted_count, submitted_amount,
                op100_count, op100_amount, op90_count, op90_amount,
                op60_count, op60_amount, op30_count, op30_amount,
                lost_count, lost_amount, inactive_count, ongoing_count,
                pending_count, declined_count, revised_count,
                created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
                $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP
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

    // Utility methods for date calculations
    getPreviousWednesday(currentDate = new Date()) {
        const date = new Date(currentDate);
        const day = date.getDay();
        const diff = day === 3 ? 7 : (day + 7 - 3) % 7; // If today is Wednesday, go back 7 days
        date.setDate(date.getDate() - diff);
        return date;
    }

    getNextWednesday(currentDate = new Date()) {
        const date = new Date(currentDate);
        const day = date.getDay();
        const diff = (3 - day + 7) % 7 || 7; // Next Wednesday
        date.setDate(date.getDate() + diff);
        return date;
    }

    getFirstDayOfPreviousMonth(currentDate = new Date()) {
        const date = new Date(currentDate);
        date.setMonth(date.getMonth() - 1);
        date.setDate(1);
        return date;
    }

    getFirstFridayOfMonth(currentDate = new Date()) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        while (date.getDay() !== 5) { // 5 = Friday
            date.setDate(date.getDate() + 1);
        }
        return date;
    }

    isFirstFridayOfMonth(currentDate) {
        const firstFriday = this.getFirstFridayOfMonth(currentDate);
        return currentDate.getDate() === firstFriday.getDate();
    }

    getNextTownhallFriday(currentDate = new Date()) {
        const nextMonth = new Date(currentDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return this.getFirstFridayOfMonth(nextMonth);
    }

    formatDate(date) {
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    async hasSnapshotForDate(snapshotType, date) {
        const query = `
            SELECT COUNT(*) as count 
            FROM dashboard_snapshots 
            WHERE snapshot_type = $1 AND snapshot_date = $2
        `;
        const result = await this.db.query(query, [snapshotType, date]);
        return parseInt(result.rows[0].count) > 0;
    }

    getStatus() {
        return {
            running: this.isRunning,
            last_run_status: this.lastRunStatus,
            next_schedules: {
                weekly_report: `Every Wednesday at 1:30 PM (Next: ${this.lastRunStatus.weekly_president.next_wednesday || 'calculating...'})`,
                townhall_meeting: `First Friday of each month at 7:00 AM (Next: ${this.lastRunStatus.monthly_townhall.next_townhall || 'calculating...'})`,
                comparison_logic: {
                    weekly: 'Compare to Previous Wednesday',
                    monthly: 'Compare to First Day of Previous Month'
                }
            }
        };
    }

    // Manual trigger for testing
    async triggerPresidentReport(description = '') {
        console.log('[BUSINESS-SNAPSHOT] Manual trigger for Weekly Report snapshot');
        try {
            const today = new Date().toISOString().split('T')[0];
            const results = await this.createSnapshots('weekly_president', today, description || `Manual Weekly Report - ${today}`);
            return results;
        } catch (error) {
            console.error('[BUSINESS-SNAPSHOT] Manual Weekly Report trigger failed:', error);
            throw error;
        }
    }

    async triggerTownhall(description = '') {
        console.log('[BUSINESS-SNAPSHOT] Manual trigger for Townhall snapshot');
        try {
            const today = new Date().toISOString().split('T')[0];
            const results = await this.createSnapshots('monthly_townhall', today, description || `Manual Townhall Meeting - ${today}`);
            return results;
        } catch (error) {
            console.error('[BUSINESS-SNAPSHOT] Manual Townhall trigger failed:', error);
            throw error;
        }
    }
}

module.exports = BusinessSnapshotScheduler;